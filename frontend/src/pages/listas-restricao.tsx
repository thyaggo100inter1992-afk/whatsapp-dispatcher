import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useToast } from '../hooks/useToast';
import { useConfirm } from '../hooks/useConfirm';
import ToastContainer from '../components/ToastContainer';
import api from '../services/api';
import { FaFileExcel, FaPlus, FaTrash, FaCog, FaBan, FaUserSlash, FaThumbsDown, FaUpload, FaDownload, FaCheckCircle, FaTimesCircle, FaArrowLeft } from 'react-icons/fa';

interface RestrictionEntry {
  id: number;
  list_type: 'do_not_disturb' | 'blocked' | 'not_interested' | 'no_whatsapp';
  list_name: string;
  phone_number: string;
  phone_number_alt: string | null;
  contact_name: string | null;
  keyword_matched: string | null;
  button_text: string | null;
  button_payload: string | null;
  added_method: string;
  added_at: string;
  expires_at: string | null;
  status: string;
  days_until_expiry: number | null;
  account_name: string;
  notes: string | null;
}

interface WhatsAppAccount {
  id: number;
  name: string;
  phone_number: string;
  is_active: boolean;
}

interface Stats {
  total: number;
  added_today: number;
}

export default function ListasRestricao() {
  const router = useRouter();
  const { toasts, removeToast, success: toastSuccess, error: toastError } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();
  
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<RestrictionEntry[]>([]);
  const [accounts, setAccounts] = useState<WhatsAppAccount[]>([]);
  const [stats, setStats] = useState<Record<string, Stats>>({
    do_not_disturb: { total: 0, added_today: 0 },
    blocked: { total: 0, added_today: 0 },
    not_interested: { total: 0, added_today: 0 },
    no_whatsapp: { total: 0, added_today: 0 },
  });

  const [activeTab, setActiveTab] = useState<'do_not_disturb' | 'blocked' | 'not_interested' | 'no_whatsapp'>('blocked');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  
  const [newContact, setNewContact] = useState({
    name: '',
    phone: '',
    cpf: '',
  });

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  
  // 📄 Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalEntries, setTotalEntries] = useState(0);
  const ITEMS_PER_PAGE = 50; // Carregar apenas 50 por página

  // 🎨 Configurações visuais por lista
  const listConfig = {
    do_not_disturb: {
      name: 'NÃO ME PERTURBE',
      color: 'from-slate-600 to-slate-700',
      borderColor: 'border-slate-500',
      icon: '🔕',
      description: 'Contatos que não receberão mensagens indefinidamente'
    },
    blocked: {
      name: 'BLOQUEADO',
      color: 'from-orange-500 to-orange-600',
      borderColor: 'border-orange-500',
      icon: '🚫',
      description: 'Contatos bloqueados por 365 dias'
    },
    not_interested: {
      name: 'SEM INTERESSE',
      color: 'from-slate-600 to-slate-700',
      borderColor: 'border-slate-500',
      icon: '⛔',
      description: 'Contatos sem interesse por 7 dias'
    },
    no_whatsapp: {
      name: 'SEM WHATSAPP',
      color: 'from-red-600 to-red-700',
      borderColor: 'border-red-500',
      icon: '📵',
      description: 'Números sem WhatsApp ou inválidos (adicionados automaticamente)'
    }
  };

  const currentList = listConfig[activeTab];

  useEffect(() => {
    loadAccounts();
    loadStats();
  }, []);

  useEffect(() => {
    setCurrentPage(1); // Resetar para página 1 quando mudar filtros
    loadEntries(1);
    setSelectedIds([]);
  }, [activeTab, searchTerm, selectedAccount]);
  
  useEffect(() => {
    if (currentPage > 1) {
      loadEntries(currentPage);
    }
  }, [currentPage]);

  const loadAccounts = async () => {
    try {
      const response = await api.get(`/whatsapp-accounts/active`);
      setAccounts(Array.isArray(response.data) ? response.data : []);
    } catch (error: any) {
      console.error('Erro ao carregar contas:', error);
      setAccounts([]);
    }
  };

  const loadStats = async () => {
    try {
      const response = await api.get(`/restriction-lists/stats/overview`);
      const { global_totals } = response.data;
      
      setStats({
        do_not_disturb: { total: global_totals.do_not_disturb || 0, added_today: 0 },
        blocked: { total: global_totals.blocked || 0, added_today: 0 },
        not_interested: { total: global_totals.not_interested || 0, added_today: 0 },
      });
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    }
  };

  const loadEntries = async (page: number = 1) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('list_type', activeTab);
      if (searchTerm) params.append('search', searchTerm);
      if (selectedAccount) params.append('whatsapp_account_id', selectedAccount);
      params.append('limit', String(ITEMS_PER_PAGE));
      params.append('page', String(page)); // Backend usa 'page' não 'offset'

      const response = await api.get(`/restriction-lists?${params}`);
      const entries = response.data.data || [];
      // Backend retorna pagination.total
      const pagination = response.data.pagination || {};
      const total = pagination.total || entries.length;
      const pages = pagination.totalPages || Math.ceil(total / ITEMS_PER_PAGE);
      
      setEntries(entries);
      setTotalEntries(total);
      setTotalPages(pages);
    } catch (error: any) {
      console.error('❌ Erro ao carregar contatos:', error);
      setEntries([]);
      setTotalEntries(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  const handleAddContact = async () => {
    try {
      if (!newContact.phone) {
        toastError('⚠️ Telefone é obrigatório!');
        return;
      }

      const finalName = newContact.name.trim() || newContact.phone;
      const finalCpf = newContact.cpf.trim() || newContact.phone;

      const payload = {
        list_type: activeTab,
        whatsapp_account_id: selectedAccount ? parseInt(selectedAccount) : null,
        phone_number: newContact.phone,
        contact_name: finalName,
        notes: `CPF: ${finalCpf}`,
      };

      await api.post(`/restriction-lists`, payload);
      toastSuccess('✅ Contato adicionado com sucesso!');
      setNewContact({ name: '', phone: '', cpf: '' });
      setCurrentPage(1);
      await loadEntries(1);
      await loadStats();
    } catch (error: any) {
      // Backend pode retornar 'error' ou 'message'
      const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message || 'Erro ao adicionar contato';
      
      // Mensagem mais amigável para erro 409 (já existe)
      if (error.response?.status === 409) {
        toastError(`⚠️ Este número já está na lista de restrição!`);
      } else {
        toastError(`❌ ${errorMessage}`);
      }
    }
  };

  const handleDelete = async (id: number) => {
    const confirmed = await confirm({
      title: '🗑️ Excluir Contato',
      message: 'Deseja realmente excluir este contato?',
      type: 'danger',
      confirmText: 'Sim, Excluir',
      cancelText: 'Cancelar'
    });
    
    if (!confirmed) return;

    try {
      await api.delete(`/restriction-lists/${id}`);
      toastSuccess('✅ Contato excluído!');
      loadEntries(currentPage);
      loadStats();
    } catch (error: any) {
      toastError('❌ Erro ao excluir contato');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) {
      toastError('⚠️ Selecione ao menos um contato!');
      return;
    }

    const confirmed = await confirm({
      title: '🗑️ Excluir Múltiplos Contatos',
      message: `Deseja realmente excluir ${selectedIds.length} contato(s)?`,
      type: 'danger',
      confirmText: `Sim, Excluir ${selectedIds.length}`,
      cancelText: 'Cancelar'
    });
    
    if (!confirmed) return;

    try {
      await api.delete(`/restriction-lists/bulk`, {
        data: { ids: selectedIds }
      });
      toastSuccess(`✅ ${selectedIds.length} contato(s) excluído(s)!`);
      setSelectedIds([]);
      setCurrentPage(1);
      loadEntries(1);
      loadStats();
    } catch (error: any) {
      toastError('❌ Erro ao excluir contatos');
    }
  };

  const handleDeleteAll = async () => {
    const totalEntries = stats[activeTab]?.total || 0;
    
    if (totalEntries === 0) {
      toastError('⚠️ Não há contatos para excluir nesta lista!');
      return;
    }

    const confirmed = await confirm({
      title: '🗑️ EXCLUIR TODOS OS CONTATOS',
      message: `⚠️ ATENÇÃO! Esta ação irá excluir TODOS os ${totalEntries} contato(s) da lista "${currentList.name}".\n\nEsta ação NÃO PODE SER DESFEITA!\n\nDeseja realmente continuar?`,
      type: 'danger',
      confirmText: `SIM, EXCLUIR TODOS (${totalEntries})`,
      cancelText: 'NÃO, CANCELAR'
    });
    
    if (!confirmed) return;

    // Segunda confirmação para segurança
    const doubleConfirm = await confirm({
      title: '⚠️ CONFIRMAÇÃO FINAL',
      message: `Tem certeza absoluta? ${totalEntries} contato(s) serão permanentemente excluídos!`,
      type: 'danger',
      confirmText: 'SIM, TENHO CERTEZA',
      cancelText: 'CANCELAR'
    });

    if (!doubleConfirm) return;

    try {
      setLoading(true);
      await api.delete(`/restriction-lists/delete-all/${activeTab}`);
      toastSuccess(`✅ Todos os contato(s) foram excluídos!`);
      setSelectedIds([]);
      setCurrentPage(1);
      await loadEntries(1);
      await loadStats();
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Erro ao excluir todos os contatos';
      toastError(`❌ ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === entries.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(entries.map(e => e.id));
    }
  };

  const toggleSelect = (id: number) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(selectedId => selectedId !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const formatExpiryDate = (expiresAt: string | null) => {
    if (!expiresAt) return '♾️ Permanente';
    
    const expiry = new Date(expiresAt);
    const now = new Date();
    
    if (expiry <= now) return '❌ Expirado';
    
    const diffTime = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return '⚠️ Hoje';
    if (diffDays === 1) return '⚠️ Amanhã';
    if (diffDays <= 7) return `⚠️ ${diffDays} dias`;
    if (diffDays <= 30) return `🟡 ${diffDays} dias`;
    if (diffDays <= 180) return `🟢 ${Math.ceil(diffDays / 30)} meses`;
    return `🟢 ${expiry.toLocaleDateString('pt-BR')}`;
  };

  const handleExport = async () => {
    try {
      const response = await api.get(
        `/restriction-lists/export/excel?list_type=${activeTab}`,
        { responseType: 'blob' }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `lista_${activeTab}_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      toastSuccess('✅ Relatório exportado!');
    } catch (error) {
      toastError('❌ Erro ao exportar relatório');
    }
  };

  const handleImport = async (file: File | null) => {
    console.log('📥 handleImport chamado:', { file, name: file?.name, size: file?.size, type: file?.type });
    
    if (!file) {
      toastError('❌ Nenhum arquivo selecionado');
      return;
    }

    const isCSV = file.name.toLowerCase().endsWith('.csv');
    
    const confirmed = await confirm({
      title: '📤 Importar Arquivo Excel/CSV',
      message: `Deseja importar este arquivo?\n\n📋 Arquivo: ${file.name}\n📊 Tamanho: ${(file.size / 1024).toFixed(2)} KB\n\n📋 Formato esperado:\n• Coluna A = Nome\n• Coluna B = Telefone (5562991785664)\n• Coluna C = CPF\n\n${isCSV ? '⚠️ ATENÇÃO CSV:\n• Salve no formato CSV UTF-8\n• NÃO use formatação de número\n• Telefones como TEXTO (com aspas simples no Excel)\n• Exemplo: \'5562991785664' : '✅ Excel (.xlsx) é mais confiável!'}`,
      type: 'info',
      confirmText: 'Sim, Importar',
      cancelText: 'Cancelar'
    });
    
    console.log('✅ Confirmação:', confirmed);
    if (!confirmed) return;

    try {
      console.log('📦 Criando FormData...');
      const formData = new FormData();
      formData.append('file', file, file.name); // ✅ Incluir nome do arquivo explicitamente
      formData.append('list_type', activeTab);
      if (selectedAccount) {
        formData.append('whatsapp_account_id', selectedAccount);
      }
      
      console.log('📤 Enviando FormData:', {
        filename: file.name,
        size: file.size,
        type: file.type,
        list_type: activeTab,
        whatsapp_account_id: selectedAccount || 'global'
      });

      const response = await api.post(`/restriction-lists/import`, formData, {
        // ⚠️ NÃO definir Content-Type manualmente!
        // O browser define automaticamente com o boundary correto
        timeout: 60000, // 60 segundos para upload
      });

      console.log('✅ Resposta:', response.data);
      toastSuccess(response.data.message || '✅ Arquivo importado com sucesso!');
      
      if (response.data.results?.errors?.length > 0) {
        console.error('⚠️ Erros de importação:', response.data.results.errors);
        toastError(`⚠️ ${response.data.results.errors.length} linha(s) com erro. Veja o console.`);
      }

      setCurrentPage(1);
      loadEntries(1);
      loadStats();
    } catch (error: any) {
      console.error('❌ Erro ao importar:', error);
      toastError(error.response?.data?.error || error.response?.data?.message || '❌ Erro ao importar arquivo');
    }
  };

  const getOriginLabel = (method: string) => {
    const labels = {
      manual: 'Manual',
      webhook_button: 'Botão',
      webhook_keyword: 'Palavra-chave',
      import: 'Importação',
    };
    return labels[method as keyof typeof labels] || method;
  };

  if (loading && entries.length === 0) {
    return (
      <>
        <Head>
          <title>Listas de Restrição | Disparador NettSistemas</title>
        </Head>
        
        <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-20 w-20 border-b-4 border-primary-500 mb-4"></div>
          <p className="text-2xl text-white/70">Carregando listas...</p>
        </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Listas de Restrição | Disparador NettSistemas</title>
      </Head>
      
      <ToastContainer toasts={toasts} onClose={removeToast} />
      
      {/* Modal de Confirmação Elegante */}
      <ConfirmDialog />
      
      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 py-8 px-4">
        <div className="max-w-7xl mx-auto space-y-8">
          
          {/* CABEÇALHO PRINCIPAL */}
          <div className="relative overflow-hidden bg-gradient-to-r from-red-600/30 via-orange-500/20 to-red-600/30 backdrop-blur-xl border-2 border-red-500/40 rounded-3xl p-10 shadow-2xl shadow-red-500/20">
            <div className="absolute inset-0 bg-grid-white/[0.02]"></div>
            <div className="absolute top-0 right-0 w-96 h-96 bg-red-500/10 rounded-full blur-3xl"></div>
            
            <div className="relative flex items-center gap-6">
              {/* Botão Voltar */}
              <button
                onClick={() => router.push('/dashboard-oficial')}
                className="bg-white/10 hover:bg-white/20 p-4 rounded-xl transition-all duration-200 border-2 border-white/20 hover:border-white/40"
                title="Voltar para o Dashboard API Oficial"
              >
                <FaArrowLeft className="text-3xl text-white" />
              </button>
              
              <div className="bg-gradient-to-br from-red-500 to-orange-600 p-6 rounded-2xl shadow-lg shadow-red-500/50">
                <span className="text-6xl">🚫</span>
              </div>
              <div>
                <h1 className="text-6xl font-black text-white mb-2 tracking-tight">
                  Listas de Restrição
                </h1>
                <p className="text-2xl text-white/80 font-medium">
                  Gerencie contatos bloqueados e restrições de envio
                </p>
              </div>
            </div>
          </div>

          {/* SELETOR DE LISTAS */}
          <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-8 shadow-xl">
            <h2 className="text-4xl font-black text-white mb-6 flex items-center gap-3">
              <span className="text-5xl">📋</span>
              Selecione a Lista
            </h2>
            <div className="grid grid-cols-3 gap-6">
              {(['do_not_disturb', 'blocked', 'not_interested'] as const).map((tab) => {
                const config = listConfig[tab];
                const isActive = activeTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`relative p-8 rounded-2xl border-2 transition-all duration-300 ${
                      isActive
                        ? `bg-gradient-to-br ${config.color} ${config.borderColor} shadow-2xl scale-105`
                        : 'bg-dark-700/50 border-white/10 hover:border-white/30 hover:scale-102'
                    }`}
                  >
                    <div className="text-6xl mb-4">{config.icon}</div>
                    <div className="text-2xl font-black text-white mb-2">{config.name}</div>
                    <div className="text-6xl font-black text-white mb-2">{stats[tab].total}</div>
                    <div className="text-lg text-white/80 font-medium">Total de Clientes</div>
                    {isActive && (
                      <div className="absolute top-4 right-4 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-xl text-sm font-bold text-white border-2 border-white/30">
                        ATIVA
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ESTATÍSTICAS */}
          <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-8 shadow-xl">
            <h2 className="text-4xl font-black text-white mb-6 flex items-center gap-3">
              <span className="text-5xl">📊</span>
              Estatísticas
            </h2>
            <div className="grid grid-cols-3 gap-6">
              <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border-2 border-blue-500/30 rounded-2xl p-6">
                <p className="text-white/70 text-lg font-medium mb-2">Total de Clientes</p>
                <p className="text-6xl font-black text-blue-300 mb-2">{stats[activeTab].total}</p>
                <p className="text-white/60 text-base">na lista atual</p>
              </div>
              <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 border-2 border-purple-500/30 rounded-2xl p-6">
                <p className="text-white/70 text-lg font-medium mb-2">Adicionados Manualmente</p>
                <p className="text-6xl font-black text-purple-300 mb-2">{entries.filter(e => e.added_method === 'manual').length}</p>
                <p className="text-white/60 text-base">contatos manuais</p>
              </div>
              <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 border-2 border-green-500/30 rounded-2xl p-6">
                <p className="text-white/70 text-lg font-medium mb-2">Adicionados Automaticamente</p>
                <p className="text-6xl font-black text-green-300 mb-2">{entries.filter(e => e.added_method === 'webhook_button' || e.added_method === 'webhook_keyword').length}</p>
                <p className="text-white/60 text-base">via webhook/botão</p>
              </div>
            </div>
          </div>

          {/* ADICIONAR CLIENTE INDIVIDUAL */}
          <div className={`bg-dark-800/60 backdrop-blur-xl border-2 ${currentList.borderColor} rounded-2xl p-8 shadow-xl`}>
            <h2 className="text-4xl font-black text-white mb-6 flex items-center gap-3">
              <span className="text-5xl">{currentList.icon}</span>
              Adicionar Cliente Individual
            </h2>
            <div className="grid grid-cols-3 gap-6 mb-6">
              <div>
                <label className="block text-xl font-black text-white mb-3">
                  👤 Nome Completo <span className="text-base font-normal text-white/60">(opcional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Digite o nome..."
                  value={newContact.name}
                  onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                  className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white placeholder-white/40 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/30 transition-all"
                />
              </div>
              <div>
                <label className="block text-xl font-black text-white mb-3">
                  📱 Telefone <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="5511999999999"
                  value={newContact.phone}
                  onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                  className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white placeholder-white/40 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/30 transition-all font-mono"
                  required
                />
              </div>
              <div>
                <label className="block text-xl font-black text-white mb-3">
                  🆔 CPF <span className="text-base font-normal text-white/60">(opcional)</span>
                </label>
                <input
                  type="text"
                  placeholder="000.000.000-00"
                  value={newContact.cpf}
                  onChange={(e) => setNewContact({ ...newContact, cpf: e.target.value })}
                  className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white placeholder-white/40 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/30 transition-all font-mono"
                />
              </div>
            </div>
            <div className="flex flex-col items-center gap-6">
              <button
                onClick={handleAddContact}
                className={`px-12 py-5 bg-gradient-to-r ${currentList.color} hover:shadow-2xl text-white text-xl font-black rounded-xl transition-all shadow-lg flex items-center gap-3 w-full max-w-2xl justify-center`}
              >
                <FaPlus className="text-2xl" />
                ADICIONAR À {currentList.name} {currentList.icon}
              </button>
              <div className="bg-yellow-500/20 border-2 border-yellow-500/40 rounded-2xl p-6 w-full">
                <p className="text-yellow-300 text-lg font-bold text-center mb-2">
                  ⚠️ Este contato será bloqueado para TODAS as contas WhatsApp do sistema
                </p>
                <p className="text-yellow-200/80 text-base text-center">
                  🔢 Sistema cria 2 LINHAS separadas: uma COM 9º dígito e outra SEM
                </p>
              </div>
            </div>
          </div>

          {/* AÇÕES RÁPIDAS */}
          <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-8 shadow-xl">
            <h2 className="text-4xl font-black text-white mb-6 flex items-center gap-3">
              <span className="text-5xl">⚡</span>
              Ações Rápidas
            </h2>
            <div className="grid grid-cols-2 gap-6 mb-6">
              <button
                onClick={handleExport}
                className="flex flex-col items-center gap-4 p-8 bg-gradient-to-br from-primary-500/20 to-primary-600/10 border-2 border-primary-500/30 rounded-2xl hover:border-primary-500/50 transition-all hover:scale-105"
              >
                <FaDownload className="text-6xl text-primary-300" />
                <div className="text-2xl font-black text-white">EXPORTAR EXCEL</div>
                <div className="text-base text-white/70">Baixar relatório da lista atual</div>
              </button>
              <button
                onClick={() => window.location.href = '/listas-restricao/configuracoes'}
                className="flex flex-col items-center gap-4 p-8 bg-gradient-to-br from-green-500/20 to-green-600/10 border-2 border-green-500/30 rounded-2xl hover:border-green-500/50 transition-all hover:scale-105"
              >
                <FaCog className="text-6xl text-green-300" />
                <div className="text-2xl font-black text-white">CONFIGURAÇÕES</div>
                <div className="text-base text-white/70">Gerenciar palavras-chave e prazos</div>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <label className="flex flex-col items-center gap-4 p-8 bg-gradient-to-br from-blue-500/20 to-blue-600/10 border-2 border-blue-500/30 rounded-2xl hover:border-blue-500/50 transition-all cursor-pointer hover:scale-105">
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    if (file) {
                      handleImport(file);
                      e.target.value = '';
                    }
                  }}
                  className="hidden"
                />
                <FaUpload className="text-6xl text-blue-300" />
                <div className="text-2xl font-black text-white">IMPORTAR EXCEL</div>
                <div className="text-base text-white/70">Adicionar contatos em massa</div>
              </label>
              <div className="bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 border-2 border-cyan-500/30 rounded-2xl p-8">
                <div className="flex items-start gap-4">
                  <FaFileExcel className="text-5xl text-cyan-300 flex-shrink-0" />
                  <div className="w-full">
                    <div className="text-xl font-black text-white mb-3">📋 FORMATO DO ARQUIVO</div>
                    <div className="text-base text-white/90 mb-2">
                      <strong>Colunas:</strong> A=Nome, B=Telefone (5562991785664), C=CPF
                    </div>
                    <div className="text-sm text-white/70 mb-3">
                      ⚠️ Sistema cria 2 LINHAS por telefone: com e sem 9º dígito
                    </div>
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mt-3">
                      <div className="text-xs font-bold text-yellow-300 mb-1">💡 DICA PARA CSV:</div>
                      <div className="text-xs text-white/80">
                        • Salve como <strong>CSV UTF-8</strong><br/>
                        • Telefones como <strong>TEXTO</strong> (com aspas no Excel)<br/>
                        • Exemplo: <code className="bg-black/30 px-1">'5562991785664</code><br/>
                        • ✅ Prefira <strong>.XLSX</strong> para evitar problemas!
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* PESQUISAR */}
          <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-8 shadow-xl">
            <h2 className="text-4xl font-black text-white mb-6 flex items-center gap-3">
              <span className="text-5xl">🔍</span>
              Pesquisar Contatos
            </h2>
            <input
              type="text"
              placeholder="Pesquisar por nome, telefone ou CPF..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white placeholder-white/40 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/30 transition-all"
            />
          </div>

          {/* LISTA DE CONTATOS */}
          <div className={`bg-dark-800/60 backdrop-blur-xl border-2 ${currentList.borderColor} rounded-2xl overflow-hidden shadow-xl`}>
            <div className="p-8 border-b-2 border-white/10 flex justify-between items-center">
              <h2 className="text-4xl font-black text-white flex items-center gap-3">
                <span className="text-5xl">📋</span>
                Lista de Contatos ({entries.length})
              </h2>
              <div className="flex items-center gap-4">
                {selectedIds.length > 0 && (
                  <button
                    onClick={handleBulkDelete}
                    className="px-8 py-4 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white text-lg font-bold rounded-xl transition-all shadow-lg hover:shadow-red-500/50 flex items-center gap-3"
                  >
                    <FaTrash className="text-xl" />
                    EXCLUIR ({selectedIds.length})
                  </button>
                )}
                {stats[activeTab]?.total > 0 && (
                  <button
                    onClick={handleDeleteAll}
                    disabled={loading}
                    className="px-8 py-4 bg-gradient-to-r from-red-700 to-red-800 hover:from-red-800 hover:to-red-900 text-white text-lg font-bold rounded-xl transition-all shadow-lg hover:shadow-red-700/50 flex items-center gap-3 border-2 border-red-400/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={`Excluir todos os ${stats[activeTab]?.total} contatos desta lista`}
                  >
                    <FaTrash className="text-xl" />
                    EXCLUIR TODOS ({stats[activeTab]?.total})
                  </button>
                )}
              </div>
            </div>

            {loading ? (
              <div className="text-center py-20">
                <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-4 border-primary-500 mb-4"></div>
                <p className="text-xl text-white/70">Carregando...</p>
              </div>
            ) : entries.length === 0 ? (
              <div className="text-center py-20">
                <div className="text-6xl mb-6">📭</div>
                <p className="text-2xl text-white/70 font-medium mb-3">Nenhum contato encontrado</p>
                <p className="text-lg text-white/50">Os contatos aparecerão aqui</p>
              </div>
            ) : (
              <div className="overflow-x-auto overflow-y-auto max-h-[600px] custom-scrollbar">
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-primary-600/20 to-primary-700/20 sticky top-0 z-10">
                    <tr>
                      <th className="px-6 py-5 text-center">
                        <input
                          type="checkbox"
                          checked={entries.length > 0 && selectedIds.length === entries.length}
                          onChange={toggleSelectAll}
                          className="w-6 h-6 rounded border-2 border-white/20 bg-dark-700 text-primary-600 focus:ring-2 focus:ring-primary-500 cursor-pointer"
                        />
                      </th>
                      <th className="px-6 py-5 text-left text-base font-black text-white uppercase tracking-wider">NOME</th>
                      <th className="px-6 py-5 text-left text-base font-black text-white uppercase tracking-wider">TELEFONE</th>
                      <th className="px-6 py-5 text-left text-base font-black text-white uppercase tracking-wider">CPF</th>
                      <th className="px-6 py-5 text-left text-base font-black text-white uppercase tracking-wider">DATA</th>
                      <th className="px-6 py-5 text-left text-base font-black text-white uppercase tracking-wider">HORA</th>
                      <th className="px-6 py-5 text-left text-base font-black text-white uppercase tracking-wider">ORIGEM</th>
                      <th className="px-6 py-5 text-left text-base font-black text-white uppercase tracking-wider">CONTA</th>
                      <th className="px-6 py-5 text-left text-base font-black text-white uppercase tracking-wider">PALAVRA</th>
                      <th className="px-6 py-5 text-left text-base font-black text-white uppercase tracking-wider">EXPIRA</th>
                      <th className="px-6 py-5 text-center text-base font-black text-white uppercase tracking-wider">AÇÕES</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {entries.map((entry) => (
                      <tr
                        key={entry.id}
                        className={`hover:bg-white/5 transition-colors ${selectedIds.includes(entry.id) ? 'bg-primary-500/10' : ''}`}
                      >
                        <td className="px-6 py-5 text-center">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(entry.id)}
                            onChange={() => toggleSelect(entry.id)}
                            className="w-6 h-6 rounded border-2 border-white/20 bg-dark-700 text-primary-600 focus:ring-2 focus:ring-primary-500 cursor-pointer"
                          />
                        </td>
                        <td className="px-6 py-5 text-base text-white font-medium truncate max-w-[150px]" title={entry.contact_name || '-'}>
                          {entry.contact_name || '-'}
                        </td>
                        <td className="px-6 py-5 text-base text-white font-mono font-bold">
                          {entry.phone_number}
                        </td>
                        <td className="px-6 py-5 text-base text-white/80 font-medium truncate max-w-[120px]" title={entry.notes?.includes('CPF:') ? entry.notes.replace('CPF: ', '') : '-'}>
                          {entry.notes?.includes('CPF:') ? entry.notes.replace('CPF: ', '') : '-'}
                        </td>
                        <td className="px-6 py-5 text-base text-white/80 font-medium">
                          {new Date(entry.added_at).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-6 py-5 text-base text-white/80 font-medium">
                          {new Date(entry.added_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-6 py-5">
                          <span className="bg-primary-500/20 text-primary-300 px-4 py-2 rounded-xl font-bold border-2 border-primary-500/30 inline-block text-sm">
                            {getOriginLabel(entry.added_method)}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-base text-white/70 font-medium truncate max-w-[100px]" title={entry.account_name || 'Global'}>
                          {entry.account_name || 'Global'}
                        </td>
                        <td className="px-6 py-5 text-base text-white/70 font-medium truncate max-w-[120px]" title={entry.keyword_matched || entry.button_text || '-'}>
                          {entry.keyword_matched || entry.button_text || '-'}
                        </td>
                        <td className="px-6 py-5 text-base font-bold whitespace-nowrap">
                          {formatExpiryDate(entry.expires_at)}
                        </td>
                        <td className="px-6 py-5 text-center">
                          <button
                            onClick={() => handleDelete(entry.id)}
                            className="px-4 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-300 border-2 border-red-500/40 rounded-xl transition-all duration-200 font-bold"
                            title="Excluir contato"
                          >
                            <FaTrash className="text-lg" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            
            {/* PAGINAÇÃO */}
            {totalPages > 1 && (
              <div className="p-6 border-t-2 border-white/10 flex items-center justify-between bg-dark-700/30">
                <div className="text-white/70 text-lg">
                  Mostrando <span className="font-bold text-white">{((currentPage - 1) * ITEMS_PER_PAGE) + 1}</span> - <span className="font-bold text-white">{Math.min(currentPage * ITEMS_PER_PAGE, totalEntries)}</span> de <span className="font-bold text-primary-400">{totalEntries}</span> contatos
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1 || loading}
                    className="px-4 py-2 bg-dark-600 hover:bg-dark-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-all border border-white/20"
                    title="Primeira página"
                  >
                    ⏮️
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1 || loading}
                    className="px-4 py-2 bg-dark-600 hover:bg-dark-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-all border border-white/20"
                    title="Página anterior"
                  >
                    ◀️
                  </button>
                  
                  {/* Números das páginas */}
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          disabled={loading}
                          className={`w-10 h-10 rounded-lg transition-all font-bold ${
                            currentPage === pageNum 
                              ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/50' 
                              : 'bg-dark-600 hover:bg-dark-500 text-white/70 border border-white/20'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages || loading}
                    className="px-4 py-2 bg-dark-600 hover:bg-dark-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-all border border-white/20"
                    title="Próxima página"
                  >
                    ▶️
                  </button>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages || loading}
                    className="px-4 py-2 bg-dark-600 hover:bg-dark-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-all border border-white/20"
                    title="Última página"
                  >
                    ⏭️
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .bg-grid-white {
          background-image: 
            linear-gradient(to right, rgba(255, 255, 255, 0.1) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.1) 1px, transparent 1px);
          background-size: 20px 20px;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #10b981;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #059669;
        }
      `}</style>
    </>
  );
}
