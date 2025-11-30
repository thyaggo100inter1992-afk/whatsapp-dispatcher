import { useState, useEffect } from 'react';
import { useToast } from '../../hooks/useToast';
import { useConfirm } from '../../hooks/useConfirm';
import ToastContainer from '../../components/ToastContainer';
import api from '../../services/api';
import { FaPlus, FaTrash, FaToggleOn, FaToggleOff, FaArrowLeft, FaInfoCircle, FaFilter, FaEdit, FaClock } from 'react-icons/fa';

interface Keyword {
  id: number;
  list_type: string;
  list_name: string;
  whatsapp_account_id: number;
  account_name: string;
  keyword: string;
  keyword_type: 'text' | 'button_payload' | 'button_text';
  case_sensitive: boolean;
  match_type: 'exact' | 'contains' | 'starts_with' | 'ends_with';
  is_active: boolean;
  created_at: string;
}

interface WhatsAppAccount {
  id: number;
  name: string;
  phone_number: string;
}

interface ListType {
  id: string;
  name: string;
  description: string;
  retention_days: number | null;
  auto_add_enabled: boolean;
  created_at: string;
}

export default function RestrictionConfig() {
  const { toasts, removeToast, success: toastSuccess, error: toastError } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();
  
  const [loading, setLoading] = useState(true);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [accounts, setAccounts] = useState<WhatsAppAccount[]>([]);
  const [listTypes, setListTypes] = useState<ListType[]>([]);
  
  const [selectedListType, setSelectedListType] = useState<string>('');
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDaysModal, setShowDaysModal] = useState(false);
  const [editingListType, setEditingListType] = useState<ListType | null>(null);
  
  const [newKeyword, setNewKeyword] = useState<{
    list_type: 'blocked' | 'do_not_disturb' | 'not_interested';
    whatsapp_account_id: string;
    keyword: string;
    keyword_type: 'text' | 'button_text' | 'button_payload';
    case_sensitive: boolean;
    match_type: 'exact' | 'contains' | 'starts_with' | 'ends_with';
  }>({
    list_type: 'blocked',
    whatsapp_account_id: '',
    keyword: '',
    keyword_type: 'button_text',
    case_sensitive: false,
    match_type: 'exact',
  });

  useEffect(() => {
    loadData();
  }, [selectedListType, selectedAccount]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams();
      if (selectedListType) params.append('list_type', selectedListType);
      if (selectedAccount) params.append('whatsapp_account_id', selectedAccount);

      const keywordsResponse = await api.get(`/restriction-lists/keywords?${params}`);
      setKeywords(keywordsResponse.data);

      const accountsResponse = await api.get(`/whatsapp-accounts/active`);
      setAccounts(Array.isArray(accountsResponse.data) ? accountsResponse.data : []);
      
      const listTypesResponse = await api.get(`/restriction-lists/list-types`);
      setListTypes(listTypesResponse.data);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toastError('❌ Erro ao carregar configurações');
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRetentionDays = async () => {
    if (!editingListType) return;
    
    try {
      const response = await api.patch(`/restriction-lists/list-types/${editingListType.id}`, {
        retention_days: editingListType.retention_days
      });
      
      const updatedCount = response.data.updated_contacts || 0;
      
      if (updatedCount > 0) {
        toastSuccess(`✅ ${response.data.message || `Configuração atualizada! ${updatedCount} contatos recalculados.`}`);
      } else {
        toastSuccess('✅ Configuração atualizada com sucesso!');
      }
      
      setShowDaysModal(false);
      setEditingListType(null);
      loadData();
    } catch (error: any) {
      toastError(error.response?.data?.error || '❌ Erro ao atualizar dias de exclusão');
    }
  };

  const handleAddKeyword = async () => {
    try {
      if (!newKeyword.keyword) {
        toastError('⚠️ Preencha pelo menos uma palavra-chave');
        return;
      }

      const keywordsText = newKeyword.keyword;
      let keywords: string[] = [];
      
      // Se tem quebra de linha, divide por linha
      // Se NÃO tem quebra de linha, considera como UMA ÚNICA palavra-chave
      if (keywordsText.includes('\n')) {
        keywords = keywordsText.split('\n').map(k => k.trim()).filter(k => k.length > 0);
      } else {
        // Cadastrar como uma única palavra-chave, SEM dividir por vírgula
        keywords = [keywordsText.trim()];
      }

      keywords = [...new Set(keywords)];

      if (keywords.length === 0) {
        toastError('⚠️ Nenhuma palavra-chave válida encontrada');
        return;
      }

      const accountId = accounts.length > 0 ? accounts[0].id : null;
      
      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      for (const keyword of keywords) {
        try {
          const payload = {
            ...newKeyword,
            keyword: keyword,
            whatsapp_account_id: accountId
          };

          await api.post(`/restriction-lists/keywords`, payload);
          successCount++;
        } catch (error: any) {
          errorCount++;
          const errorMsg = error.response?.data?.error || 'Erro desconhecido';
          errors.push(`"${keyword}": ${errorMsg}`);
        }
      }

      if (successCount > 0 && errorCount === 0) {
        toastSuccess(`✅ ${successCount} palavra${successCount > 1 ? 's' : ''}-chave adicionada${successCount > 1 ? 's' : ''} com sucesso!`);
      } else if (successCount > 0 && errorCount > 0) {
        toastSuccess(`✅ ${successCount} adicionada${successCount > 1 ? 's' : ''}, ${errorCount} com erro`);
      } else {
        toastError(`❌ Erro ao adicionar palavras-chave: ${errors.join(', ')}`);
      }

      if (successCount > 0) {
        setShowAddModal(false);
        setNewKeyword({
          list_type: 'blocked',
          whatsapp_account_id: '',
          keyword: '',
          keyword_type: 'button_text',
          case_sensitive: false,
          match_type: 'exact',
        });
        loadData();
      }
    } catch (error: any) {
      toastError(error.message || '❌ Erro ao processar palavras-chave');
    }
  };

  const handleToggle = async (id: number) => {
    try {
      await api.patch(`/restriction-lists/keywords/${id}/toggle`);
      toastSuccess('✅ Status atualizado!');
      loadData();
    } catch (error) {
      toastError('❌ Erro ao atualizar status');
    }
  };

  const handleDelete = async (id: number) => {
    const confirmed = await confirm({
      title: '🗑️ Remover Palavra-Chave',
      message: 'Tem certeza que deseja remover esta palavra-chave?',
      type: 'danger',
      confirmText: 'Sim, Remover',
      cancelText: 'Cancelar'
    });
    
    if (!confirmed) return;

    try {
      await api.delete(`/restriction-lists/keywords/${id}`);
      toastSuccess('✅ Palavra-chave removida!');
      loadData();
    } catch (error) {
      toastError('❌ Erro ao remover palavra-chave');
    }
  };

  const getListTypeBadge = (type: string) => {
    const badges = {
      do_not_disturb: { label: 'Não Me Perturbe', color: 'bg-slate-500/20 text-slate-300 border-slate-500/30' },
      blocked: { label: 'Bloqueado', color: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
      not_interested: { label: 'Sem Interesse', color: 'bg-slate-500/20 text-slate-300 border-slate-500/30' },
    };
    const badge = badges[type as keyof typeof badges];
    return (
      <span className={`px-4 py-2 rounded-xl text-sm font-bold border-2 ${badge.color} inline-block`}>
        {badge.label}
      </span>
    );
  };

  const getKeywordTypeBadge = (type: string) => {
    const badges = {
      text: { label: 'Texto Digitado', color: 'bg-green-500/20 text-green-300 border-green-500/30', icon: '💬' },
      button_text: { label: 'Texto do Botão', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30', icon: '🔘' },
      button_payload: { label: 'Payload do Botão', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30', icon: '📦' },
    };
    const badge = badges[type as keyof typeof badges] || { label: type, color: 'bg-gray-500/20 text-gray-300 border-gray-500/30', icon: '❓' };
    return (
      <span className={`px-4 py-2 rounded-xl text-sm font-bold border-2 ${badge.color} inline-block`}>
        {badge.icon} {badge.label}
      </span>
    );
  };

  const getMatchTypeBadge = (type: string) => {
    const labels = {
      exact: 'Exato',
      contains: 'Contém',
      starts_with: 'Começa com',
      ends_with: 'Termina com',
    };
    return (
      <span className="px-4 py-2 rounded-xl text-sm font-bold bg-white/10 text-white/80 border-2 border-white/20 inline-block">
        {labels[type as keyof typeof labels] || type}
      </span>
    );
  };

  if (loading && keywords.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-20 w-20 border-b-4 border-primary-500 mb-4"></div>
          <p className="text-2xl text-white/70">Carregando configurações...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <ToastContainer toasts={toasts} onClose={removeToast} />
      
      {/* Modal de Confirmação Elegante */}
      <ConfirmDialog />
      
      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 py-8 px-4">
        <div className="max-w-7xl mx-auto space-y-8">
          
          {/* CABEÇALHO PRINCIPAL */}
          <div className="relative overflow-hidden bg-gradient-to-r from-purple-600/30 via-purple-500/20 to-purple-600/30 backdrop-blur-xl border-2 border-purple-500/40 rounded-3xl p-10 shadow-2xl shadow-purple-500/20">
            <div className="absolute inset-0 bg-grid-white/[0.02]"></div>
            <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
            
            <div className="relative flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
              <div className="flex items-center gap-6">
                <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-6 rounded-2xl shadow-lg shadow-purple-500/50">
                  <span className="text-6xl">⚙️</span>
                </div>
                <div>
                  <h1 className="text-6xl font-black text-white mb-2 tracking-tight">
                    Configurações de Palavras-Chave
                  </h1>
                  <p className="text-2xl text-white/80 font-medium">
                    Configure palavras-chave e botões para adicionar contatos automaticamente
                  </p>
                </div>
              </div>
              <a
                href="/listas-restricao"
                className="px-8 py-4 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white text-lg font-bold rounded-xl transition-all shadow-lg hover:shadow-primary-500/50 flex items-center gap-3 whitespace-nowrap"
              >
                <FaArrowLeft className="text-xl" />
                Voltar para Listas
              </a>
            </div>
          </div>

          {/* CARD INFORMATIVO */}
          <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-8 shadow-xl">
            <div className="flex items-start gap-6 mb-8">
              <div className="bg-primary-500/20 p-5 rounded-2xl">
                <FaInfoCircle className="text-5xl text-primary-300" />
              </div>
              <div>
                <h3 className="text-4xl font-black text-white mb-3">💡 Como funciona?</h3>
                <p className="text-xl text-white/70 font-medium">Configure gatilhos automáticos para adicionar contatos nas listas de restrição</p>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 border-2 border-green-500/30 rounded-2xl p-6 hover:scale-102 transition-all">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-4xl">💬</span>
                  <div className="text-2xl font-black text-white">Texto Digitado</div>
                </div>
                <div className="text-white/80 text-base">Quando o cliente digitar a palavra-chave configurada</div>
              </div>
              <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border-2 border-blue-500/30 rounded-2xl p-6 hover:scale-102 transition-all">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-4xl">🔘</span>
                  <div className="text-2xl font-black text-white">Texto do Botão</div>
                </div>
                <div className="text-white/80 text-base">Quando o cliente clicar em um botão com o texto configurado</div>
              </div>
              <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 border-2 border-purple-500/30 rounded-2xl p-6 hover:scale-102 transition-all">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-4xl">📦</span>
                  <div className="text-2xl font-black text-white">Payload do Botão</div>
                </div>
                <div className="text-white/80 text-base">Quando o cliente clicar em um botão com o payload configurado</div>
              </div>
              <div className="bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 border-2 border-cyan-500/30 rounded-2xl p-6 hover:scale-102 transition-all">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-4xl">✅</span>
                  <div className="text-2xl font-black text-white">Adição Automática</div>
                </div>
                <div className="text-white/80 text-base">As duas versões do número (com e sem 9º dígito) são cadastradas</div>
              </div>
            </div>
          </div>

          {/* DIAS PARA EXCLUSÃO AUTOMÁTICA */}
          <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-8 shadow-xl">
            <div className="flex items-start gap-6 mb-8">
              <div className="bg-yellow-500/20 p-5 rounded-2xl">
                <FaClock className="text-5xl text-yellow-300" />
              </div>
              <div>
                <h3 className="text-4xl font-black text-white mb-3">⏰ Dias para Exclusão Automática</h3>
                <p className="text-xl text-white/70 font-medium">Configure quantos dias cada contato permanece na lista antes de ser removido</p>
              </div>
            </div>
            
            <div className="grid md:grid-cols-3 gap-6">
              {listTypes.map((listType) => {
                const icons = {
                  do_not_disturb: '🔕',
                  blocked: '🚫',
                  not_interested: '⛔',
                };
                const colors = {
                  do_not_disturb: 'from-slate-500/20 to-slate-600/10 border-slate-500/30',
                  blocked: 'from-orange-500/20 to-orange-600/10 border-orange-500/30',
                  not_interested: 'from-slate-500/20 to-slate-600/10 border-slate-500/30',
                };
                
                return (
                  <div 
                    key={listType.id} 
                    className={`bg-gradient-to-br ${colors[listType.id as keyof typeof colors]} border-2 rounded-2xl p-6 hover:scale-105 transition-all cursor-pointer`}
                    onClick={() => {
                      setEditingListType(listType);
                      setShowDaysModal(true);
                    }}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-5xl">{icons[listType.id as keyof typeof icons]}</span>
                      <div className="bg-white/10 px-4 py-2 rounded-xl text-sm font-bold text-white border-2 border-white/20 flex items-center gap-2">
                        <FaEdit />
                        Editar
                      </div>
                    </div>
                    <h4 className="text-2xl font-black text-white mb-3">{listType.name}</h4>
                    <div className="text-6xl font-black text-white mb-3">
                      {listType.retention_days === null ? '∞' : listType.retention_days}
                    </div>
                    <p className="text-base text-white/70 font-medium">
                      {listType.retention_days === null 
                        ? 'Permanente (nunca expira)' 
                        : `${listType.retention_days} dia${listType.retention_days > 1 ? 's' : ''} para exclusão`}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* AÇÕES E FILTROS */}
          <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-8 shadow-xl">
            <div className="flex flex-col sm:flex-row gap-6 items-stretch">
              <button
                onClick={() => setShowAddModal(true)}
                className="px-8 py-4 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white text-lg font-bold rounded-xl transition-all shadow-lg hover:shadow-primary-500/50 flex items-center justify-center gap-3 whitespace-nowrap"
              >
                <FaPlus className="text-xl" />
                Adicionar Palavra-Chave
              </button>

              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <FaFilter className="text-2xl text-primary-400" />
                  <span className="text-xl font-black text-white">Filtrar por Lista</span>
                </div>
                <select
                  value={selectedListType}
                  onChange={(e) => setSelectedListType(e.target.value)}
                  className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/30 transition-all font-bold"
                >
                  <option value="">📋 Todas as Listas</option>
                  <option value="do_not_disturb">🔕 Não Me Perturbe</option>
                  <option value="blocked">🚫 Bloqueado</option>
                  <option value="not_interested">⛔ Sem Interesse</option>
                </select>
              </div>
            </div>
          </div>

          {/* TABELA DE PALAVRAS-CHAVE */}
          <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-white/10 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-8 border-b-2 border-white/10">
              <h3 className="text-4xl font-black text-white flex items-center gap-3">
                <span className="text-5xl">🔑</span>
                Palavras-Chave Configuradas ({keywords.length})
              </h3>
            </div>

            {loading ? (
              <div className="text-center py-20">
                <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-4 border-primary-500 mb-4"></div>
                <p className="text-xl text-white/70">Carregando...</p>
              </div>
            ) : keywords.length === 0 ? (
              <div className="text-center py-20">
                <div className="text-6xl mb-6">📝</div>
                <p className="text-2xl text-white font-black mb-3">Nenhuma palavra-chave configurada</p>
                <p className="text-lg text-white/70 mb-8">Adicione palavras-chave para automatizar a inclusão de contatos</p>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="px-8 py-4 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white text-lg font-bold rounded-xl transition-all shadow-lg hover:shadow-primary-500/50 inline-flex items-center gap-3"
                >
                  <FaPlus className="text-xl" />
                  Adicionar Primeira Palavra-Chave
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto overflow-y-auto max-h-[600px] custom-scrollbar">
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-primary-600/20 to-primary-700/20 sticky top-0 z-10">
                    <tr>
                      <th className="px-6 py-5 text-left text-base font-black text-white uppercase tracking-wider">
                        📋 LISTA
                      </th>
                      <th className="px-6 py-5 text-left text-base font-black text-white uppercase tracking-wider">
                        🔑 PALAVRA-CHAVE
                      </th>
                      <th className="px-6 py-5 text-left text-base font-black text-white uppercase tracking-wider">
                        📝 TIPO
                      </th>
                      <th className="px-6 py-5 text-left text-base font-black text-white uppercase tracking-wider">
                        🎯 CORRESPONDÊNCIA
                      </th>
                      <th className="px-6 py-5 text-left text-base font-black text-white uppercase tracking-wider">
                        ⚡ STATUS
                      </th>
                      <th className="px-6 py-5 text-center text-base font-black text-white uppercase tracking-wider">
                        🔧 AÇÕES
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {keywords.map((keyword) => (
                      <tr key={keyword.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-5">
                          {getListTypeBadge(keyword.list_type)}
                        </td>
                        <td className="px-6 py-5">
                          <div className="text-lg font-black text-white mb-2">
                            "{keyword.keyword}"
                          </div>
                          {keyword.case_sensitive && (
                            <span className="bg-purple-500/20 text-purple-300 px-3 py-1 rounded-lg border-2 border-purple-500/30 text-sm font-bold">
                              Case sensitive
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-5">
                          {getKeywordTypeBadge(keyword.keyword_type)}
                        </td>
                        <td className="px-6 py-5">
                          {getMatchTypeBadge(keyword.match_type)}
                        </td>
                        <td className="px-6 py-5">
                          <button
                            onClick={() => handleToggle(keyword.id)}
                            className={`flex items-center gap-3 px-6 py-3 rounded-xl text-base font-bold transition-all border-2 ${
                              keyword.is_active
                                ? 'bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 border-primary-500/50 text-white shadow-lg shadow-primary-500/50'
                                : 'bg-dark-700 border-white/20 text-white/50 hover:bg-dark-600'
                            }`}
                          >
                            {keyword.is_active ? <FaToggleOn className="text-2xl" /> : <FaToggleOff className="text-2xl" />}
                            {keyword.is_active ? 'Ativo' : 'Inativo'}
                          </button>
                        </td>
                        <td className="px-6 py-5 text-center">
                          <button
                            onClick={() => handleDelete(keyword.id)}
                            className="px-4 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-300 border-2 border-red-500/40 rounded-xl transition-all duration-200 font-bold"
                            title="Remover"
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
          </div>

          {/* MODAL ADICIONAR PALAVRA-CHAVE */}
          {showAddModal && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-dark-800/95 backdrop-blur-xl border-2 border-white/10 rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                <div className="bg-gradient-to-r from-primary-600 to-primary-700 p-8 rounded-t-3xl border-b-2 border-primary-500/30">
                  <h2 className="text-4xl font-black text-white flex items-center gap-4">
                    <FaPlus className="text-3xl" />
                    Adicionar Nova Palavra-Chave
                  </h2>
                  <p className="text-xl text-white/90 mt-2">Configure uma palavra-chave para adição automática de contatos</p>
                </div>
                
                <div className="p-8 space-y-6">
                  <div>
                    <label className="block text-xl font-black text-white mb-3">
                      📋 Lista de Destino *
                    </label>
                    <select
                      value={newKeyword.list_type}
                      onChange={(e) => setNewKeyword({ ...newKeyword, list_type: e.target.value as any })}
                      className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/30 transition-all font-bold"
                    >
                      <option value="do_not_disturb">🔕 Não Me Perturbe (Permanente)</option>
                      <option value="blocked">🚫 Bloqueado (365 dias)</option>
                      <option value="not_interested">⛔ Sem Interesse (7 dias)</option>
                    </select>
                    <p className="text-base text-white/70 mt-3">
                      Contatos serão adicionados nesta lista quando a palavra-chave for detectada em qualquer conta
                    </p>
                  </div>

                  <div>
                    <label className="block text-xl font-black text-white mb-3">
                      📝 Tipo de Detecção *
                    </label>
                    <select
                      value={newKeyword.keyword_type}
                      onChange={(e) => setNewKeyword({ ...newKeyword, keyword_type: e.target.value as any })}
                      className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/30 transition-all font-bold"
                    >
                      <option value="text">💬 Texto Digitado pelo Cliente</option>
                      <option value="button_text">🔘 Texto do Botão Clicado</option>
                      <option value="button_payload">📦 Payload do Botão (ID técnico)</option>
                    </select>
                    <div className="mt-4 p-4 bg-primary-500/10 rounded-xl border-2 border-primary-500/20">
                      <p className="text-base text-white/90">
                        {newKeyword.keyword_type === 'text' && '✓ Detecta quando o cliente digitar essa palavra na conversa'}
                        {newKeyword.keyword_type === 'button_text' && '✓ Detecta quando o cliente clicar em botão com esse texto visível'}
                        {newKeyword.keyword_type === 'button_payload' && '✓ Detecta quando o cliente clicar em botão com esse payload técnico'}
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xl font-black text-white mb-3">
                      🔑 Palavras-Chave *
                    </label>
                    <textarea
                      value={newKeyword.keyword}
                      onChange={(e) => setNewKeyword({ ...newKeyword, keyword: e.target.value })}
                      placeholder={
                        newKeyword.keyword_type === 'text' 
                          ? 'Digite uma ou várias palavras:\nPARAR\nBLOQUEAR\nNÃO QUERO'
                          : newKeyword.keyword_type === 'button_text'
                          ? 'Digite um ou vários textos de botão:\nBloquear\nNão tenho interesse'
                          : 'Digite um ou vários payloads:\nbtn_block\nopt_out'
                      }
                      rows={5}
                      className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white placeholder-white/40 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/30 transition-all font-mono resize-none"
                    />
                    <p className="text-base text-white/70 mt-3 flex items-start gap-2">
                      <span className="text-2xl text-primary-400">💡</span>
                      <span>Separe múltiplas palavras por vírgula ou uma por linha. Cada palavra será cadastrada individualmente.</span>
                    </p>
                  </div>

                  <div>
                    <label className="block text-xl font-black text-white mb-3">
                      🎯 Tipo de Correspondência *
                    </label>
                    <select
                      value={newKeyword.match_type}
                      onChange={(e) => setNewKeyword({ ...newKeyword, match_type: e.target.value as any })}
                      className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/30 transition-all font-bold"
                    >
                      <option value="exact">✓ Exato (deve ser idêntico)</option>
                      <option value="contains">🔍 Contém (encontra em qualquer parte)</option>
                      <option value="starts_with">▶️ Começa com</option>
                      <option value="ends_with">⏹️ Termina com</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-4 p-5 bg-dark-700/50 border-2 border-white/20 rounded-xl">
                    <input
                      type="checkbox"
                      id="case_sensitive"
                      checked={newKeyword.case_sensitive}
                      onChange={(e) => setNewKeyword({ ...newKeyword, case_sensitive: e.target.checked })}
                      className="w-7 h-7 text-primary-600 bg-dark-700 border-2 border-white/20 rounded focus:ring-4 focus:ring-primary-500/50"
                    />
                    <label htmlFor="case_sensitive" className="text-lg text-white cursor-pointer font-bold">
                      Case sensitive (diferenciar MAIÚSCULAS/minúsculas)
                    </label>
                  </div>
                </div>

                <div className="flex gap-4 justify-end border-t-2 border-white/10 p-8">
                  <button
                    onClick={() => setShowAddModal(false)}
                    className="px-8 py-4 bg-dark-700 hover:bg-dark-600 border-2 border-white/20 rounded-xl transition-all font-bold text-white text-lg"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleAddKeyword}
                    className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white rounded-xl transition-all shadow-lg hover:shadow-primary-500/50 font-bold text-lg"
                  >
                    <FaPlus className="text-xl" />
                    Adicionar Palavra-Chave
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* MODAL EDIÇÃO DE DIAS */}
          {showDaysModal && editingListType && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-dark-800/95 backdrop-blur-xl border-2 border-white/10 rounded-3xl shadow-2xl w-full max-w-2xl">
                <div className="bg-gradient-to-r from-yellow-600 to-yellow-700 p-8 rounded-t-3xl border-b-2 border-yellow-500/30">
                  <h2 className="text-4xl font-black text-white flex items-center gap-4">
                    <FaClock className="text-3xl" />
                    Configurar Dias de Exclusão
                  </h2>
                  <p className="text-xl text-white/90 mt-2">{editingListType.name}</p>
                </div>
                
                <div className="p-8">
                  <div className="mb-6">
                    <label className="block text-xl font-black text-white mb-4">
                      Dias para exclusão automática
                    </label>
                    
                    <div className="flex items-center gap-4 mb-6">
                      <input
                        type="number"
                        min="1"
                        max="3650"
                        value={editingListType.retention_days === null ? '' : editingListType.retention_days}
                        onChange={(e) => setEditingListType({
                          ...editingListType,
                          retention_days: e.target.value === '' ? null : parseInt(e.target.value)
                        })}
                        placeholder="Deixe vazio para permanente"
                        className="flex-1 px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white placeholder-white/40 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/30 transition-all font-mono font-bold"
                      />
                      <button
                        onClick={() => setEditingListType({ ...editingListType, retention_days: null })}
                        className="px-6 py-4 bg-dark-700 hover:bg-dark-600 border-2 border-white/20 rounded-xl text-white text-lg font-bold whitespace-nowrap"
                      >
                        ∞ Permanente
                      </button>
                    </div>
                    
                    <div className="bg-primary-500/10 border-2 border-primary-500/20 rounded-xl p-5">
                      <p className="text-base text-white/90 font-medium">
                        {editingListType.retention_days === null ? (
                          <><strong className="text-white">Permanente:</strong> Contatos nunca serão removidos automaticamente</>
                        ) : editingListType.retention_days === 1 ? (
                          <><strong className="text-white">1 dia:</strong> Contatos serão removidos automaticamente após 1 dia</>
                        ) : (
                          <><strong className="text-white">{editingListType.retention_days} dias:</strong> Contatos serão removidos automaticamente após {editingListType.retention_days} dias</>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="bg-dark-700/50 border-2 border-white/20 rounded-xl p-5">
                    <p className="text-base text-white/70 font-bold mb-3">💡 Sugestões:</p>
                    <div className="flex flex-wrap gap-3">
                      {[1, 7, 30, 90, 180, 365].map(days => (
                        <button
                          key={days}
                          onClick={() => setEditingListType({ ...editingListType, retention_days: days })}
                          className="px-5 py-3 bg-dark-700 hover:bg-primary-600 border-2 border-white/20 hover:border-primary-500 rounded-xl text-base text-white font-bold transition-all"
                        >
                          {days} dia{days > 1 ? 's' : ''}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 justify-end border-t-2 border-white/10 p-8">
                  <button
                    onClick={() => {
                      setShowDaysModal(false);
                      setEditingListType(null);
                    }}
                    className="px-8 py-4 bg-dark-700 hover:bg-dark-600 border-2 border-white/20 rounded-xl transition-all font-bold text-white text-lg"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleUpdateRetentionDays}
                    className="px-8 py-4 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white rounded-xl transition-all shadow-lg hover:shadow-yellow-500/50 font-bold text-lg"
                  >
                    Salvar Configuração
                  </button>
                </div>
              </div>
            </div>
          )}
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
