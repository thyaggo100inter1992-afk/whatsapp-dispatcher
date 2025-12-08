import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { 
  FaList, FaTrash, FaCopy, FaSync, FaSearch, FaCheckCircle, FaTimesCircle, 
  FaPlus, FaEye, FaEdit, FaClock, FaCheck, FaTimes, FaMobileAlt, FaArrowLeft, FaHistory
} from 'react-icons/fa';
import api, { whatsappAccountsAPI } from '@/services/api';
import { TemplateQueue } from '@/components/TemplateQueue';
import ToastContainer from '@/components/ToastContainer';
import { useToast } from '@/hooks/useToast';
import TemplatePreview from '@/components/TemplatePreview';

interface WhatsAppAccount {
  id: number;
  name: string;
  phone_number: string;
  is_active: boolean;
}

interface Template {
  id?: number;
  name: string;
  status: string;
  category: string;
  language: string;
  components: any[];
}

export default function GerenciarTemplates() {
  const router = useRouter();
  const toast = useToast();
  
  const [accounts, setAccounts] = useState<WhatsAppAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<Template[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [excludeQuery, setExcludeQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [templateToCopy, setTemplateToCopy] = useState<Template | null>(null);
  const [targetAccountIds, setTargetAccountIds] = useState<number[]>([]);
  const [copying, setCopying] = useState(false);
  
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<Template | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [queueModalOpen, setQueueModalOpen] = useState(false);
  
  const [selectedTemplateNames, setSelectedTemplateNames] = useState<string[]>([]);
  const [bulkCopyModalOpen, setBulkCopyModalOpen] = useState(false);
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);
  const [bulkCopying, setBulkCopying] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  
  // Estado para armazenar os novos nomes dos templates na cópia
  const [templateNewNames, setTemplateNewNames] = useState<{ [originalName: string]: string }>({});
  const [singleCopyNewName, setSingleCopyNewName] = useState<string>('');
  
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    loadAccounts();
  }, []);

  useEffect(() => {
    if (selectedAccountId) {
      loadTemplates(selectedAccountId);
    }
  }, [selectedAccountId]);

  useEffect(() => {
    let filtered = templates;

    if (searchQuery) {
      filtered = filtered.filter(t => 
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (excludeQuery) {
      const excludeWords = excludeQuery.toLowerCase().split(',').map(word => word.trim());
      filtered = filtered.filter(t => {
        const templateName = t.name.toLowerCase();
        return !excludeWords.some(word => templateName.includes(word));
      });
    }

    setFilteredTemplates(filtered);
  }, [searchQuery, excludeQuery, templates]);

  const loadAccounts = async () => {
    try {
      // 🔧 Carregar APENAS contas de API Oficial (não QR Connect)
      const response = await whatsappAccountsAPI.getActive('api');
      setAccounts(response.data.data);
      if (response.data.data.length > 0) {
        setSelectedAccountId(response.data.data[0].id);
      }
    } catch (error) {
      console.error('Erro ao carregar contas:', error);
    }
  };

  const loadTemplates = async (accountId: number) => {
    setLoading(true);
    try {
      const response = await whatsappAccountsAPI.getTemplates(accountId);
      if (response.data.success) {
        setTemplates(response.data.templates || []);
      }
    } catch (error) {
      console.error('Erro ao carregar templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const syncAllTemplates = async () => {
    setSyncing(true);
    try {
      const response = await api.post('/templates/sync-all');
      const data = response.data;
      if (data.success) {
        toast.success(`${data.totalSynced} templates sincronizados com sucesso!`);
        if (selectedAccountId) {
          loadTemplates(selectedAccountId);
        }
      } else {
        toast.error('Erro ao sincronizar: ' + data.error);
      }
    } catch (error: any) {
      toast.error('Erro ao sincronizar: ' + error.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleCopyTemplate = (template: Template) => {
    setTemplateToCopy(template);
    setTargetAccountIds([]);
    setSingleCopyNewName(template.name); // Inicializa com o nome atual
    setCopyModalOpen(true);
  };

  const executeCopyTemplate = async () => {
    if (!templateToCopy || targetAccountIds.length === 0) return;

    // Validar nome do template
    const newName = singleCopyNewName.trim();
    if (!newName) {
      toast.error('Nome do template não pode estar vazio!');
      return;
    }

    setCopying(true);
    try {
      const response = await api.post('/templates/create-multiple', {
        accountIds: targetAccountIds,
        templateData: {
          name: newName, // Usa o novo nome editado
          category: templateToCopy.category,
          language: templateToCopy.language,
          components: templateToCopy.components,
        },
        useQueue: true,
      });

      const data = response.data;
      if (data.success) {
        const successCount = data.results.filter((r: any) => r.success).length;
        toast.success(`Template copiado para ${successCount} conta(s) com sucesso!`);
        setCopyModalOpen(false);
        setTemplateToCopy(null);
        setTargetAccountIds([]);
        setSingleCopyNewName('');
      } else {
        toast.error('Erro ao copiar: ' + data.error);
      }
    } catch (error: any) {
      toast.error('Erro ao copiar: ' + error.message);
    } finally {
      setCopying(false);
    }
  };

  const handleDeleteTemplate = (template: Template) => {
    setTemplateToDelete(template);
    setDeleteModalOpen(true);
  };

  const executeDeleteTemplate = async () => {
    if (!templateToDelete || !selectedAccountId) return;

    setDeleting(true);
    try {
      const response = await api.delete(`/templates/${selectedAccountId}/${templateToDelete.name}`);
      const data = response.data;
      if (data.success) {
        toast.success('Template deletado com sucesso!');
        setDeleteModalOpen(false);
        setTemplateToDelete(null);
        if (selectedAccountId) {
          loadTemplates(selectedAccountId);
        }
      } else {
        toast.error('Erro ao deletar: ' + data.error);
      }
    } catch (error: any) {
      toast.error('Erro ao deletar: ' + error.message);
    } finally {
      setDeleting(false);
    }
  };

  const handleEditTemplate = (template: Template) => {
    const templateData = encodeURIComponent(JSON.stringify({
      name: template.name + '___',
      category: template.category,
      language: template.language,
      components: template.components,
      accountId: selectedAccountId,
      deleteOriginal: true,
      originalName: template.name,
    }));
    router.push(`/template/criar?edit=${templateData}`);
  };

  const toggleTemplateSelection = (templateName: string) => {
    if (selectedTemplateNames.includes(templateName)) {
      setSelectedTemplateNames(selectedTemplateNames.filter(name => name !== templateName));
    } else {
      setSelectedTemplateNames([...selectedTemplateNames, templateName]);
    }
  };

  const toggleSelectAll = () => {
    if (selectedTemplateNames.length === filteredTemplates.length) {
      setSelectedTemplateNames([]);
    } else {
      setSelectedTemplateNames(filteredTemplates.map(t => t.name));
    }
  };

  const clearSelection = () => {
    setSelectedTemplateNames([]);
  };

  const handlePreviewTemplate = (template: Template) => {
    setPreviewTemplate(template);
    setShowPreview(true);
  };

  const parseTemplateForPreview = (template: Template) => {
    const headerComp = template.components?.find((c: any) => c.type === 'HEADER');
    const bodyComp = template.components?.find((c: any) => c.type === 'BODY');
    const footerComp = template.components?.find((c: any) => c.type === 'FOOTER');
    const buttonsComp = template.components?.find((c: any) => c.type === 'BUTTONS');

    return {
      name: template.name,
      category: template.category,
      header_type: headerComp?.format,
      header_text: headerComp?.text,
      body_text: bodyComp?.text || '',
      footer_text: footerComp?.text,
      buttons: buttonsComp?.buttons?.map((btn: any) => ({
        type: btn.type,
        text: btn.text,
        url: btn.url,
        phone_number: btn.phone_number,
      })) || [],
    };
  };

  const handleBulkCopy = () => {
    if (selectedTemplateNames.length === 0) {
      toast.warning('Selecione pelo menos um template');
      return;
    }
    setTargetAccountIds([]);
    // Inicializa os novos nomes com os nomes originais
    const initialNames: { [key: string]: string } = {};
    selectedTemplateNames.forEach(name => {
      initialNames[name] = name;
    });
    setTemplateNewNames(initialNames);
    setBulkCopyModalOpen(true);
  };

  const executeBulkCopy = async () => {
    if (selectedTemplateNames.length === 0 || targetAccountIds.length === 0) return;

    // Validar se todos os nomes estão preenchidos
    const emptyNames = selectedTemplateNames.filter(name => !templateNewNames[name]?.trim());
    if (emptyNames.length > 0) {
      toast.error('Todos os templates precisam ter um nome!');
      return;
    }

    setBulkCopying(true);
    const selectedTemplatesData = filteredTemplates.filter(t => selectedTemplateNames.includes(t.name));
    let totalSuccess = 0;
    let totalError = 0;

    try {
      for (const template of selectedTemplatesData) {
        const newName = templateNewNames[template.name]?.trim() || template.name;
        
        const response = await api.post('/templates/create-multiple', {
          accountIds: targetAccountIds,
          templateData: {
            name: newName, // Usa o novo nome editado
            category: template.category,
            language: template.language,
            components: template.components,
          },
        });

        const data = response.data;
        if (data.success) {
          totalSuccess += data.results.filter((r: any) => r.success).length;
          totalError += data.results.filter((r: any) => !r.success).length;
        } else {
          totalError += targetAccountIds.length;
        }
      }

      if (totalError > 0) {
        toast.warning(`Cópia concluída! Sucesso: ${totalSuccess} | Erro: ${totalError}`);
      } else {
        toast.success(`${totalSuccess} template(s) copiado(s) com sucesso!`);
      }
      setBulkCopyModalOpen(false);
      clearSelection();
      setTargetAccountIds([]);
      setTemplateNewNames({});
    } catch (error: any) {
      toast.error('Erro ao copiar templates: ' + error.message);
    } finally {
      setBulkCopying(false);
    }
  };

  const handleBulkDelete = () => {
    if (selectedTemplateNames.length === 0) {
      toast.warning('Selecione pelo menos um template');
      return;
    }
    setBulkDeleteModalOpen(true);
  };

  const executeBulkDelete = async () => {
    if (selectedTemplateNames.length === 0 || !selectedAccountId) return;

    setBulkDeleting(true);
    let totalSuccess = 0;
    let totalError = 0;

    try {
      for (const templateName of selectedTemplateNames) {
        const response = await api.delete(`/templates/${selectedAccountId}/${templateName}`);
        const data = response.data;
        if (data.success) {
          totalSuccess++;
        } else {
          totalError++;
        }
      }

      if (totalError > 0) {
        toast.warning(`Exclusão concluída! Deletados: ${totalSuccess} | Erro: ${totalError}`);
      } else {
        toast.success(`${totalSuccess} template(s) deletado(s) com sucesso!`);
      }
      setBulkDeleteModalOpen(false);
      clearSelection();
      
      if (selectedAccountId) {
        loadTemplates(selectedAccountId);
      }
    } catch (error: any) {
      toast.error('Erro ao deletar templates: ' + error.message);
    } finally {
      setBulkDeleting(false);
    }
  };

  const selectedAccount = accounts.find(a => a.id === selectedAccountId);

  if (loading && templates.length === 0) {
    return (
      <>
        <Head>
          <title>Gerenciar Templates | Disparador NettSistemas</title>
        </Head>
        
        <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-20 w-20 border-b-4 border-primary-500 mb-4"></div>
            <p className="text-2xl text-white/70">Carregando templates...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Gerenciar Templates | Disparador NettSistemas</title>
      </Head>
      
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />
      
      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 py-8 px-4">
        <div className="max-w-7xl mx-auto space-y-8">
          
          {/* 🎨 CABEÇALHO PRINCIPAL */}
          <div className="relative overflow-hidden bg-gradient-to-r from-blue-600/30 via-blue-500/20 to-blue-600/30 backdrop-blur-xl border-2 border-blue-500/40 rounded-3xl p-10 shadow-2xl shadow-blue-500/20">
            <div className="absolute inset-0 bg-grid-white/[0.02]"></div>
            <div className="relative">
              <div className="flex items-center justify-between flex-wrap gap-6">
                <div className="flex items-center gap-6">
                  {/* Botão Voltar */}
                  <button
                    onClick={() => router.push('/dashboard-oficial')}
                    className="bg-white/10 hover:bg-white/20 p-4 rounded-xl transition-all duration-200 border-2 border-white/20 hover:border-white/40"
                    title="Voltar para o Dashboard API Oficial"
                  >
                    <FaArrowLeft className="text-3xl text-white" />
                  </button>
                  
                  <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-2xl shadow-lg shadow-blue-500/50">
                    <FaList className="text-5xl text-white" />
                  </div>
                  <div>
                    <h1 className="text-5xl font-black text-white tracking-tight mb-2">
                      Gerenciar Templates
                    </h1>
                    <p className="text-xl text-white/80 font-medium">
                      Organize e gerencie seus templates WhatsApp
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-4 flex-wrap">
                  <button
                    onClick={() => setQueueModalOpen(true)}
                    className="flex items-center gap-3 px-6 py-4 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border-2 border-purple-500/40 rounded-xl font-bold transition-all duration-200 shadow-lg hover:shadow-purple-500/30"
                  >
                    <FaClock className="text-xl" />
                    Ver Fila
                  </button>
                  <button
                    onClick={syncAllTemplates}
                    disabled={syncing}
                    className="flex items-center gap-3 px-6 py-4 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border-2 border-yellow-500/40 rounded-xl font-bold transition-all duration-200 shadow-lg hover:shadow-yellow-500/30 disabled:opacity-50"
                  >
                    <FaSync className={`text-xl ${syncing ? 'animate-spin' : ''}`} />
                    {syncing ? 'Sincronizando...' : 'Sincronizar Todos'}
                  </button>
                  <button
                    onClick={() => router.push('/template/criar')}
                    className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white text-lg font-bold rounded-xl transition-all duration-200 shadow-lg shadow-green-500/30 hover:shadow-green-500/50 transform hover:scale-105"
                  >
                    <FaPlus className="text-xl" />
                    Criar Novo
                  </button>
                  <button
                    onClick={() => router.push('/template/historico')}
                    className="flex items-center gap-3 px-6 py-4 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border-2 border-purple-500/40 rounded-xl font-bold transition-all duration-200 shadow-lg hover:shadow-purple-500/30"
                  >
                    <FaHistory className="text-xl" />
                    Ver Histórico
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* SELETOR DE CONTA */}
          <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-8 shadow-xl">
            <label className="block text-2xl font-black mb-4 text-white">📱 Selecionar Conta</label>
            <select
              value={selectedAccountId || ''}
              onChange={(e) => setSelectedAccountId(Number(e.target.value))}
              className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/30 transition-all font-bold"
            >
              {accounts.map(account => (
                <option key={account.id} value={account.id}>
                  {account.name || account.phone_number} - {account.phone_number}
                </option>
              ))}
            </select>
          </div>

          {/* FILTROS DE BUSCA */}
          <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-8 shadow-xl space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xl font-black mb-4 text-white flex items-center gap-2">
                  <span className="text-2xl">🔍</span>
                  Buscar (incluir)
                </label>
                <div className="relative">
                  <FaSearch className="absolute left-6 top-1/2 transform -translate-y-1/2 text-2xl text-white/50" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Ex: saque, promocao..."
                    className="w-full pl-16 px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/30 transition-all"
                  />
                </div>
                <p className="text-sm text-white/60 mt-2 font-medium">
                  Digite palavras para INCLUIR nos resultados
                </p>
              </div>

              <div>
                <label className="block text-xl font-black mb-4 text-white flex items-center gap-2">
                  <span className="text-2xl">🚫</span>
                  Excluir (não mostrar)
                </label>
                <div className="relative">
                  <FaTimesCircle className="absolute left-6 top-1/2 transform -translate-y-1/2 text-2xl text-red-400" />
                  <input
                    type="text"
                    value={excludeQuery}
                    onChange={(e) => setExcludeQuery(e.target.value)}
                    placeholder="Ex: fgts, teste..."
                    className="w-full pl-16 px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-red-500 focus:ring-4 focus:ring-red-500/30 transition-all"
                  />
                </div>
                <p className="text-sm text-white/60 mt-2 font-medium">
                  Digite palavras para EXCLUIR dos resultados (separe por vírgula)
                </p>
              </div>
            </div>

            {(searchQuery || excludeQuery) && (
              <div className="p-6 bg-gradient-to-br from-blue-500/20 to-blue-600/10 border-2 border-blue-500/30 rounded-2xl">
                <div className="text-blue-300 text-xl font-black mb-3">📋 Filtro Ativo:</div>
                <div className="text-white/80 text-base space-y-2">
                  {searchQuery && (
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">✅</span>
                      <strong>Incluindo:</strong> templates que contêm "{searchQuery}"
                    </div>
                  )}
                  {excludeQuery && (
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">❌</span>
                      <strong>Excluindo:</strong> templates que contêm "{excludeQuery}"
                    </div>
                  )}
                  <div className="mt-4 pt-4 border-t border-white/20 text-white/70 font-bold">
                    📊 Resultados: <span className="text-blue-300 text-xl">{filteredTemplates.length}</span> template(s)
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* AÇÕES EM MASSA */}
          {filteredTemplates.length > 0 && (
            <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 backdrop-blur-xl border-2 border-purple-500/30 rounded-2xl p-8 shadow-xl">
              <div className="flex items-center justify-between flex-wrap gap-6">
                <div className="flex items-center gap-6 flex-wrap">
                  <button
                    onClick={toggleSelectAll}
                    className="flex items-center gap-3 px-6 py-4 bg-primary-500/20 hover:bg-primary-500/30 text-primary-300 border-2 border-primary-500/40 rounded-xl font-bold transition-all duration-200"
                  >
                    <FaCheckCircle className="text-xl" />
                    {selectedTemplateNames.length === filteredTemplates.length 
                      ? 'Desmarcar Todos' 
                      : 'Selecionar Todos'}
                  </button>
                  
                  {selectedTemplateNames.length > 0 && (
                    <div className="text-white text-xl font-black bg-primary-500/20 px-6 py-4 rounded-xl border-2 border-primary-500/40">
                      ✅ {selectedTemplateNames.length} template(s) selecionado(s)
                    </div>
                  )}
                </div>

                {selectedTemplateNames.length > 0 && (
                  <div className="flex gap-4 flex-wrap">
                    <button
                      onClick={handleBulkCopy}
                      className="flex items-center gap-3 px-6 py-4 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border-2 border-blue-500/40 rounded-xl font-bold transition-all duration-200"
                    >
                      <FaCopy className="text-xl" />
                      Copiar
                    </button>
                    <button
                      onClick={handleBulkDelete}
                      className="flex items-center gap-3 px-6 py-4 bg-red-500/20 hover:bg-red-500/30 text-red-300 border-2 border-red-500/40 rounded-xl font-bold transition-all duration-200"
                    >
                      <FaTrash className="text-xl" />
                      Deletar
                    </button>
                    <button
                      onClick={clearSelection}
                      className="flex items-center gap-3 px-6 py-4 bg-dark-700 hover:bg-dark-600 text-white border-2 border-white/20 rounded-xl font-bold transition-all duration-200"
                    >
                      <FaTimes className="text-xl" />
                      Limpar
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* LISTA DE TEMPLATES */}
          {loading ? (
            <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-20 text-center shadow-xl">
              <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-4 border-primary-500 mb-4"></div>
              <p className="text-xl text-white/70">Carregando templates...</p>
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-20 text-center shadow-xl">
              <div className="text-6xl mb-6">📭</div>
              <p className="text-2xl text-white/70 font-medium mb-4">
                {searchQuery || excludeQuery ? 'Nenhum template encontrado' : 'Nenhum template disponível'}
              </p>
              {!searchQuery && !excludeQuery && (
                <button
                  onClick={() => router.push('/template/criar')}
                  className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white text-lg font-bold rounded-xl transition-all duration-200 shadow-lg shadow-primary-500/40 hover:shadow-primary-500/60 transform hover:scale-105"
                >
                  <FaPlus className="text-xl" />
                  Criar Primeiro Template
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {filteredTemplates.map((template, index) => (
                <div
                  key={index}
                  className={`bg-dark-800/60 backdrop-blur-xl border-2 rounded-2xl p-8 shadow-xl transition-all duration-300 ${
                    selectedTemplateNames.includes(template.name)
                      ? 'border-green-500/50 bg-green-500/10'
                      : 'border-primary-500/30 hover:border-primary-500/50'
                  }`}
                >
                  <div className="flex items-start gap-6">
                    <div className="pt-2">
                      <input
                        type="checkbox"
                        checked={selectedTemplateNames.includes(template.name)}
                        onChange={() => toggleTemplateSelection(template.name)}
                        className="w-7 h-7 rounded border-2 border-white/20 focus:ring-2 focus:ring-primary-500 cursor-pointer"
                      />
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-4 mb-4 flex-wrap">
                        <h3 className="text-3xl font-black text-white">{template.name}</h3>
                        <span className={`px-4 py-2 rounded-xl text-sm font-bold border-2 ${
                          template.status === 'APPROVED' ? 'bg-green-500/20 text-green-300 border-green-500/30' :
                          template.status === 'PENDING' ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' :
                          'bg-red-500/20 text-red-300 border-red-500/30'
                        }`}>
                          {template.status}
                        </span>
                        <span className="px-4 py-2 rounded-xl text-sm font-bold bg-blue-500/20 text-blue-300 border-2 border-blue-500/30">
                          {template.category}
                        </span>
                      </div>
                      
                      <div className="text-white/70 text-lg space-y-2 mb-6">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">📍</span>
                          <strong>Idioma:</strong> {template.language}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">📋</span>
                          <strong>Componentes:</strong> {template.components?.length || 0}
                        </div>
                      </div>

                      <div className="p-6 bg-dark-900/60 rounded-xl border-2 border-white/10">
                        <div className="text-white/80 text-base space-y-2">
                          {template.components?.map((comp: any, i: number) => (
                            <div key={i} className="flex items-start gap-3">
                              <strong className="text-blue-400 min-w-[100px]">{comp.type}:</strong>
                              <span>{comp.text || comp.format || '(sem texto)'}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3 flex-wrap">
                      <button
                        onClick={() => handlePreviewTemplate(template)}
                        className="px-6 py-4 bg-gradient-to-r from-purple-500/20 to-purple-600/20 hover:from-purple-500/30 hover:to-purple-600/30 text-purple-300 border-2 border-purple-500/40 rounded-xl font-bold transition-all duration-200 flex items-center gap-2 shadow-lg hover:shadow-purple-500/30"
                        title="Visualizar template no celular"
                      >
                        <FaMobileAlt className="text-xl" />
                        Visualizar
                      </button>
                      <button
                        onClick={() => handleEditTemplate(template)}
                        className="px-6 py-4 bg-primary-500/20 hover:bg-primary-500/30 text-primary-300 border-2 border-primary-500/40 rounded-xl font-bold transition-all duration-200 flex items-center gap-2"
                        title="Editar (duplicar e modificar)"
                      >
                        <FaEdit className="text-xl" />
                        Editar
                      </button>
                      <button
                        onClick={() => handleCopyTemplate(template)}
                        className="px-6 py-4 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border-2 border-blue-500/40 rounded-xl font-bold transition-all duration-200 flex items-center gap-2"
                        title="Copiar para outras contas"
                      >
                        <FaCopy className="text-xl" />
                        Copiar
                      </button>
                      <button
                        onClick={() => handleDeleteTemplate(template)}
                        className="px-6 py-4 bg-red-500/20 hover:bg-red-500/30 text-red-300 border-2 border-red-500/40 rounded-xl font-bold transition-all duration-200 flex items-center gap-2"
                        title="Deletar template"
                      >
                        <FaTrash className="text-xl" />
                        Deletar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* MODAIS - Mantendo a funcionalidade mas com estilos atualizados */}
      {queueModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border-2 border-primary-500/40 rounded-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-8">
              <TemplateQueue onClose={() => setQueueModalOpen(false)} toast={toast} />
            </div>
          </div>
        </div>
      )}

      {bulkCopyModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border-2 border-primary-500/40 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-8">
            <h2 className="text-3xl font-black text-white mb-6 flex items-center gap-3">
              <span className="text-4xl">📋</span>
              Copiar {selectedTemplateNames.length} Template(s)
            </h2>

            <div className="mb-8">
              {/* SEÇÃO: Editar Nomes dos Templates */}
              <div className="p-6 bg-gradient-to-br from-blue-500/20 to-blue-600/10 border-2 border-blue-500/30 rounded-2xl mb-6">
                <div className="font-black text-blue-300 text-xl mb-4 flex items-center gap-2">
                  <span className="text-2xl">✏️</span>
                  Editar Nomes dos Templates
                </div>
                <p className="text-white/60 text-sm mb-4">
                  Você pode alterar o nome de cada template antes de copiar para as outras contas
                </p>
                <div className="space-y-4 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                  {selectedTemplateNames.map((originalName, i) => (
                    <div key={i} className="bg-dark-700/60 rounded-xl p-4 border border-white/10">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg text-white/50">#{i + 1}</span>
                        <span className="text-sm text-white/40">Nome original:</span>
                        <span className="text-sm text-white/60 font-mono">{originalName}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="text-white font-bold text-sm whitespace-nowrap">Novo Nome:</label>
                        <input
                          type="text"
                          value={templateNewNames[originalName] || ''}
                          onChange={(e) => {
                            setTemplateNewNames(prev => ({
                              ...prev,
                              [originalName]: e.target.value
                            }));
                          }}
                          placeholder="Digite o novo nome do template"
                          className="flex-1 px-4 py-3 bg-dark-600 border-2 border-white/20 rounded-xl text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 transition-all font-medium"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* SEÇÃO: Selecionar Contas de Destino */}
              <label className="block text-2xl font-black mb-4 text-white flex items-center gap-2">
                <span className="text-2xl">📱</span>
                Selecionar Contas de Destino
              </label>
              
              <div className="space-y-4 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                {accounts.filter(a => a.id !== selectedAccountId).map(account => (
                  <div
                    key={account.id}
                    onClick={() => {
                      if (targetAccountIds.includes(account.id)) {
                        setTargetAccountIds(targetAccountIds.filter(id => id !== account.id));
                      } else {
                        setTargetAccountIds([...targetAccountIds, account.id]);
                      }
                    }}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                      targetAccountIds.includes(account.id)
                        ? 'border-green-500/50 bg-green-500/10'
                        : 'border-white/20 bg-white/5 hover:border-primary-500/50'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <input
                        type="checkbox"
                        checked={targetAccountIds.includes(account.id)}
                        onChange={() => {}}
                        className="w-6 h-6"
                      />
                      <div>
                        <div className="font-black text-white text-lg">{account.name || account.phone_number}</div>
                        <div className="text-base text-white/60">{account.phone_number}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Resumo da operação */}
              {targetAccountIds.length > 0 && (
                <div className="mt-6 p-4 bg-green-500/10 border-2 border-green-500/30 rounded-xl">
                  <div className="text-green-300 font-bold flex items-center gap-2">
                    <span className="text-xl">✅</span>
                    Resumo: {selectedTemplateNames.length} template(s) serão copiados para {targetAccountIds.length} conta(s)
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => {
                  setBulkCopyModalOpen(false);
                  setTargetAccountIds([]);
                  setTemplateNewNames({});
                }}
                className="flex-1 px-6 py-4 bg-dark-700 hover:bg-dark-600 text-white text-lg font-bold rounded-xl transition-all duration-200 border-2 border-white/20"
                disabled={bulkCopying}
              >
                Cancelar
              </button>
              <button
                onClick={executeBulkCopy}
                disabled={bulkCopying || targetAccountIds.length === 0}
                className="flex-1 px-6 py-4 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white text-lg font-bold rounded-xl transition-all duration-200 shadow-lg shadow-primary-500/40 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {bulkCopying ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Copiando...
                  </>
                ) : (
                  <>
                    <FaCopy />
                    Copiar para {targetAccountIds.length} conta(s)
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {bulkDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border-2 border-red-500/40 rounded-2xl max-w-md w-full shadow-2xl p-8">
            <h2 className="text-3xl font-black text-white mb-6 flex items-center gap-3">
              <span className="text-4xl">🗑️</span>
              Deletar {selectedTemplateNames.length} Template(s)
            </h2>

            <div className="mb-8">
              <p className="text-white/80 text-lg mb-6">
                Tem certeza que deseja deletar estes templates?
              </p>
              
              <div className="p-6 bg-red-500/10 border-2 border-red-500/30 rounded-2xl">
                <div className="font-black text-red-300 text-xl mb-4 flex items-center gap-2">
                  <span className="text-2xl">⚠️</span>
                  ATENÇÃO: Esta ação não pode ser desfeita!
                </div>
                <div className="text-white/80 mb-2">
                  <strong>Conta:</strong> {selectedAccount?.phone_number}
                </div>
                <div className="text-white/80 mb-3">
                  <strong>Templates:</strong>
                </div>
                <div className="text-white/70 text-sm space-y-1 max-h-48 overflow-y-auto">
                  {selectedTemplateNames.map((name, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span>•</span>
                      <span>{name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setBulkDeleteModalOpen(false)}
                className="flex-1 px-6 py-4 bg-dark-700 hover:bg-dark-600 text-white text-lg font-bold rounded-xl transition-all duration-200 border-2 border-white/20"
                disabled={bulkDeleting}
              >
                Cancelar
              </button>
              <button
                onClick={executeBulkDelete}
                disabled={bulkDeleting}
                className="flex-1 px-6 py-4 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white text-lg font-bold rounded-xl transition-all duration-200 shadow-lg shadow-red-500/40 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {bulkDeleting ? (
                  'Deletando...'
                ) : (
                  <>
                    <FaTrash />
                    Deletar {selectedTemplateNames.length}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteModalOpen && templateToDelete && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border-2 border-red-500/40 rounded-2xl max-w-md w-full shadow-2xl p-8">
            <h2 className="text-3xl font-black text-white mb-6 flex items-center gap-3">
              <span className="text-4xl">🗑️</span>
              Deletar Template
            </h2>

            <div className="mb-8">
              <p className="text-white/80 text-lg mb-6">
                Tem certeza que deseja deletar este template?
              </p>
              
              <div className="p-6 bg-red-500/10 border-2 border-red-500/30 rounded-2xl">
                <div className="font-black text-red-300 text-xl mb-4 flex items-center gap-2">
                  <span className="text-2xl">⚠️</span>
                  ATENÇÃO: Esta ação não pode ser desfeita!
                </div>
                <div className="text-white/80 mb-2">
                  <strong>Template:</strong> {templateToDelete.name}
                </div>
                <div className="text-white/80">
                  <strong>Conta:</strong> {selectedAccount?.phone_number}
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => {
                  setDeleteModalOpen(false);
                  setTemplateToDelete(null);
                }}
                className="flex-1 px-6 py-4 bg-dark-700 hover:bg-dark-600 text-white text-lg font-bold rounded-xl transition-all duration-200 border-2 border-white/20"
                disabled={deleting}
              >
                Cancelar
              </button>
              <button
                onClick={executeDeleteTemplate}
                disabled={deleting}
                className="flex-1 px-6 py-4 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white text-lg font-bold rounded-xl transition-all duration-200 shadow-lg shadow-red-500/40 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting ? 'Deletando...' : <><FaTrash /> Deletar</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {copyModalOpen && templateToCopy && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border-2 border-primary-500/40 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-8">
            <h2 className="text-3xl font-black text-white mb-6 flex items-center gap-3">
              <span className="text-4xl">📋</span>
              Copiar Template
            </h2>

            <div className="mb-8">
              {/* SEÇÃO: Editar Nome do Template */}
              <div className="p-6 bg-gradient-to-br from-blue-500/20 to-blue-600/10 border-2 border-blue-500/30 rounded-2xl mb-6">
                <div className="font-black text-blue-300 text-xl mb-4 flex items-center gap-2">
                  <span className="text-2xl">✏️</span>
                  Nome do Template
                </div>
                <div className="mb-3">
                  <span className="text-sm text-white/40">Nome original:</span>
                  <span className="text-sm text-white/60 font-mono ml-2">{templateToCopy.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-white font-bold text-sm whitespace-nowrap">Novo Nome:</label>
                  <input
                    type="text"
                    value={singleCopyNewName}
                    onChange={(e) => setSingleCopyNewName(e.target.value)}
                    placeholder="Digite o nome do template"
                    className="flex-1 px-4 py-3 bg-dark-600 border-2 border-white/20 rounded-xl text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 transition-all font-medium"
                  />
                </div>
                <p className="text-white/50 text-xs mt-2">
                  💡 Dica: Você pode manter o nome original ou alterá-lo para criar uma cópia com nome diferente
                </p>
              </div>

              {/* SEÇÃO: Selecionar Contas de Destino */}
              <label className="block text-2xl font-black mb-4 text-white flex items-center gap-2">
                <span className="text-2xl">📱</span>
                Selecionar Contas de Destino
              </label>
              
              <div className="space-y-4 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                {accounts.filter(a => a.id !== selectedAccountId).map(account => (
                  <div
                    key={account.id}
                    onClick={() => {
                      if (targetAccountIds.includes(account.id)) {
                        setTargetAccountIds(targetAccountIds.filter(id => id !== account.id));
                      } else {
                        setTargetAccountIds([...targetAccountIds, account.id]);
                      }
                    }}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                      targetAccountIds.includes(account.id)
                        ? 'border-green-500/50 bg-green-500/10'
                        : 'border-white/20 bg-white/5 hover:border-primary-500/50'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <input
                        type="checkbox"
                        checked={targetAccountIds.includes(account.id)}
                        onChange={() => {}}
                        className="w-6 h-6"
                      />
                      <div>
                        <div className="font-black text-white text-lg">{account.name || account.phone_number}</div>
                        <div className="text-base text-white/60">{account.phone_number}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Resumo da operação */}
              {targetAccountIds.length > 0 && singleCopyNewName.trim() && (
                <div className="mt-6 p-4 bg-green-500/10 border-2 border-green-500/30 rounded-xl">
                  <div className="text-green-300 font-bold flex items-center gap-2">
                    <span className="text-xl">✅</span>
                    Template "{singleCopyNewName.trim()}" será copiado para {targetAccountIds.length} conta(s)
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => {
                  setCopyModalOpen(false);
                  setTemplateToCopy(null);
                  setTargetAccountIds([]);
                  setSingleCopyNewName('');
                }}
                className="flex-1 px-6 py-4 bg-dark-700 hover:bg-dark-600 text-white text-lg font-bold rounded-xl transition-all duration-200 border-2 border-white/20"
                disabled={copying}
              >
                Cancelar
              </button>
              <button
                onClick={executeCopyTemplate}
                disabled={copying || targetAccountIds.length === 0 || !singleCopyNewName.trim()}
                className="flex-1 px-6 py-4 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white text-lg font-bold rounded-xl transition-all duration-200 shadow-lg shadow-primary-500/40 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {copying ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Copiando...
                  </>
                ) : (
                  <>
                    <FaCopy /> 
                    Copiar para {targetAccountIds.length} conta(s)
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview do Template */}
      {previewTemplate && (
        <TemplatePreview
          isOpen={showPreview}
          onClose={() => {
            setShowPreview(false);
            setPreviewTemplate(null);
          }}
          template={parseTemplateForPreview(previewTemplate)}
        />
      )}

      <style jsx>{`
        .bg-grid-white {
          background-image: 
            linear-gradient(to right, rgba(255, 255, 255, 0.1) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.1) 1px, transparent 1px);
          background-size: 20px 20px;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
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
