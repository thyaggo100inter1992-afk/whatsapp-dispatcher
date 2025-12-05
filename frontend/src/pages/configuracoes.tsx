import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { 
  FaCog, FaPlus, FaEdit, FaTrash, FaCheckCircle, FaTimesCircle, 
  FaSpinner, FaFileAlt, FaWhatsapp, FaCheck, FaTimes, FaBan, FaArrowLeft,
  FaSquare, FaCheckSquare
} from 'react-icons/fa';
import api, { whatsappAccountsAPI } from '@/services/api';
import { useConfirm } from '@/hooks/useConfirm';

interface WhatsAppAccount {
  id: number;
  name: string;
  phone_number: string;
  access_token: string;
  phone_number_id: string;
  business_account_id?: string;
  app_id?: string;
  webhook_verify_token?: string;
  is_active: boolean;
  proxy_id?: number | null;
}

interface Proxy {
  id: number;
  name: string;
  host: string;
  port: number;
  location?: string;
  status: string;
}

export default function Configuracoes() {
  const router = useRouter();
  const { confirm, ConfirmDialog } = useConfirm();
  const [accounts, setAccounts] = useState<WhatsAppAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<WhatsAppAccount | null>(null);
  const [testingConnection, setTestingConnection] = useState<number | null>(null);
  const [proxies, setProxies] = useState<Proxy[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<Set<number>>(new Set());
  const [deactivating, setDeactivating] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    phone_number: '',
    access_token: '',
    phone_number_id: '',
    business_account_id: '',
    app_id: '',
    webhook_verify_token: '',
    is_active: true,
    proxy_id: null as number | null,
  });

  useEffect(() => {
    loadAccounts();
    loadProxies();
  }, []);

  // Funções de seleção de contas
  const handleToggleSelectAccount = (accountId: number) => {
    const newSelected = new Set(selectedAccounts);
    if (newSelected.has(accountId)) {
      newSelected.delete(accountId);
    } else {
      newSelected.add(accountId);
    }
    setSelectedAccounts(newSelected);
  };

  const handleSelectAllAccounts = () => {
    if (selectedAccounts.size === accounts.length) {
      setSelectedAccounts(new Set());
    } else {
      setSelectedAccounts(new Set(accounts.map(a => a.id)));
    }
  };

  // Função para desativar contas selecionadas
  const handleDeactivateSelected = async () => {
    if (selectedAccounts.size === 0) {
      await confirm({
        title: '⚠️ Atenção',
        message: 'Nenhuma conta selecionada!',
        type: 'warning',
        confirmText: 'OK',
        showCancel: false
      });
      return;
    }

    const confirmed = await confirm({
      title: '⚠️ Desativar Contas',
      message: (
        <div>
          <p className="mb-4 text-lg font-bold">
            Tem certeza que deseja desativar {selectedAccounts.size} conta(s)?
          </p>
          <p className="text-orange-400 font-bold text-sm">
            As contas selecionadas serão desativadas e não poderão enviar mensagens.
          </p>
        </div>
      ),
      type: 'warning',
      confirmText: 'Sim, Desativar',
      cancelText: 'Cancelar'
    });

    if (!confirmed) return;

    setDeactivating(true);
    try {
      await api.post('/whatsapp-accounts/deactivate-multiple', {
        account_ids: Array.from(selectedAccounts)
      });

      await loadAccounts();
      setSelectedAccounts(new Set());

      await confirm({
        title: '✅ Sucesso!',
        message: `${selectedAccounts.size} conta(s) desativada(s) com sucesso!`,
        type: 'info',
        confirmText: 'OK',
        showCancel: false
      });
    } catch (error: any) {
      await confirm({
        title: '❌ Erro',
        message: 'Erro ao desativar contas: ' + (error.response?.data?.error || error.message),
        type: 'danger',
        confirmText: 'OK',
        showCancel: false
      });
    } finally {
      setDeactivating(false);
    }
  };

  // Função para desativar todas as contas
  const handleDeactivateAll = async () => {
    if (accounts.length === 0) {
      await confirm({
        title: '⚠️ Atenção',
        message: 'Nenhuma conta cadastrada!',
        type: 'warning',
        confirmText: 'OK',
        showCancel: false
      });
      return;
    }

    const confirmed = await confirm({
      title: '🚨 DESATIVAR TODAS AS CONTAS',
      message: (
        <div>
          <p className="mb-4 text-lg font-bold text-red-400">
            ⚠️ ATENÇÃO: Você está prestes a desativar TODAS as {accounts.length} contas!
          </p>
          <p className="text-orange-400 font-bold">
            Todas as contas serão desativadas e não poderão enviar mensagens.
          </p>
        </div>
      ),
      type: 'danger',
      confirmText: 'Sim, Desativar TODAS',
      cancelText: 'Cancelar'
    });

    if (!confirmed) return;

    setDeactivating(true);
    try {
      await api.post('/whatsapp-accounts/deactivate-all');

      await loadAccounts();
      setSelectedAccounts(new Set());

      await confirm({
        title: '✅ Sucesso!',
        message: `Todas as ${accounts.length} contas foram desativadas!`,
        type: 'info',
        confirmText: 'OK',
        showCancel: false
      });
    } catch (error: any) {
      await confirm({
        title: '❌ Erro',
        message: 'Erro ao desativar contas: ' + (error.response?.data?.error || error.message),
        type: 'danger',
        confirmText: 'OK',
        showCancel: false
      });
    } finally {
      setDeactivating(false);
    }
  };

  const handleActivateSelected = async () => {
    if (selectedAccounts.size === 0) {
      await confirm({
        title: '⚠️ Atenção',
        message: 'Nenhuma conta selecionada!',
        type: 'warning',
        confirmText: 'OK',
        showCancel: false
      });
      return;
    }

    const confirmed = await confirm({
      title: '✅ Ativar Contas',
      message: (
        <div>
          <p className="mb-2">Deseja ativar {selectedAccounts.size} conta(s) selecionada(s)?</p>
          <p className="text-sm text-gray-400">As contas voltarão a ficar disponíveis para uso.</p>
        </div>
      ),
      type: 'success',
      confirmText: 'Sim, Ativar',
      cancelText: 'Cancelar'
    });

    if (!confirmed) return;

    setDeactivating(true);
    try {
      await api.post('/whatsapp-accounts/activate-multiple', {
        account_ids: Array.from(selectedAccounts)
      });

      await confirm({
        title: '✅ Sucesso!',
        message: `${selectedAccounts.size} conta(s) ativada(s) com sucesso!`,
        type: 'info',
        confirmText: 'OK',
        showCancel: false
      });

      setSelectedAccounts(new Set());
      await loadAccounts();
    } catch (error: any) {
      console.error('❌ Erro ao ativar contas:', error);
      await confirm({
        title: '❌ Erro',
        message: `Erro ao ativar contas: ${error.response?.data?.error || error.message}`,
        type: 'error',
        confirmText: 'OK',
        showCancel: false
      });
    } finally {
      setDeactivating(false);
    }
  };

  const handleActivateAll = async () => {
    if (accounts.length === 0) {
      await confirm({
        title: '⚠️ Atenção',
        message: 'Nenhuma conta cadastrada!',
        type: 'warning',
        confirmText: 'OK',
        showCancel: false
      });
      return;
    }

    const confirmed = await confirm({
      title: '✅ ATIVAR TODAS AS CONTAS',
      message: (
        <div>
          <p className="mb-2">Deseja ativar TODAS as {accounts.length} conta(s)?</p>
          <p className="text-sm text-gray-400">Todas as contas voltarão a ficar disponíveis para uso.</p>
        </div>
      ),
      type: 'success',
      confirmText: 'Sim, Ativar Todas',
      cancelText: 'Cancelar'
    });

    if (!confirmed) return;

    setDeactivating(true);
    try {
      await api.post('/whatsapp-accounts/activate-all');
      
      await confirm({
        title: '✅ Sucesso!',
        message: 'Todas as contas foram ativadas com sucesso!',
        type: 'info',
        confirmText: 'OK',
        showCancel: false
      });

      setSelectedAccounts(new Set());
      await loadAccounts();
    } catch (error: any) {
      console.error('❌ Erro ao ativar contas:', error);
      await confirm({
        title: '❌ Erro',
        message: `Erro ao ativar contas: ${error.response?.data?.error || error.message}`,
        type: 'error',
        confirmText: 'OK',
        showCancel: false
      });
    } finally {
      setDeactivating(false);
    }
  };

  const loadProxies = async () => {
    try {
      const response = await api.get('/proxies/active');
      if (response.data.success) {
        setProxies(response.data.data);
      }
    } catch (error) {
      console.error('Erro ao carregar proxies:', error);
    }
  };

  const loadAccounts = async () => {
    try {
      const response = await whatsappAccountsAPI.getAll();
      const basicAccounts = response.data.data;
      
      // Buscar detalhes enriquecidos de cada conta
      const accountsWithDetails = await Promise.all(
        basicAccounts.map(async (account: any) => {
          try {
            const detailsResponse = await api.get(`/whatsapp-accounts/${account.id}/details`);
            
            if (detailsResponse.data.success) {
              return detailsResponse.data.data;
            }
            return account;
          } catch (error) {
            console.error(`Erro ao buscar detalhes da conta ${account.id}:`, error);
            return account;
          }
        })
      );
      
      setAccounts(accountsWithDetails);
    } catch (error) {
      console.error('Erro ao carregar contas:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingAccount) {
        await whatsappAccountsAPI.update(editingAccount.id, formData);
      } else {
        await whatsappAccountsAPI.create(formData);
      }
      
      await loadAccounts();
      resetForm();
      await confirm({
        title: '✅ Sucesso!',
        message: 'Conta salva com sucesso!',
        type: 'info',
        confirmText: 'OK',
        showCancel: false
      });
    } catch (error: any) {
      await confirm({
        title: '❌ Erro',
        message: 'Erro ao salvar conta: ' + (error.response?.data?.error || error.message),
        type: 'danger',
        confirmText: 'OK',
        showCancel: false
      });
    }
  };

  const handleEdit = (account: WhatsAppAccount) => {
    setEditingAccount(account);
    setFormData({
      name: account.name,
      phone_number: account.phone_number,
      access_token: account.access_token,
      phone_number_id: account.phone_number_id,
      business_account_id: account.business_account_id || '',
      app_id: account.app_id || '',
      webhook_verify_token: account.webhook_verify_token || '',
      is_active: account.is_active,
      proxy_id: account.proxy_id || null,
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: number) => {
    const confirmed = await confirm({
      title: '🗑️ EXCLUIR CONTA',
      message: (
        <div>
          <p className="mb-4 text-lg font-bold">
            Tem certeza que deseja excluir esta conta?
          </p>
          <p className="text-red-400 font-black text-lg">
            ❌ Esta ação não pode ser desfeita!
          </p>
        </div>
      ),
      type: 'danger',
      confirmText: 'Sim, Excluir',
      cancelText: 'Cancelar'
    });
    
    if (!confirmed) return;
    
    try {
      await whatsappAccountsAPI.delete(id);
      await loadAccounts();
      
      // Show success with another confirm modal
      await confirm({
        title: '✅ Sucesso!',
        message: 'Conta excluída com sucesso!',
        type: 'info',
        confirmText: 'OK',
        showCancel: false
      });
    } catch (error: any) {
      await confirm({
        title: '❌ Erro',
        message: 'Erro ao excluir conta: ' + (error.response?.data?.error || error.message),
        type: 'danger',
        confirmText: 'OK',
        showCancel: false
      });
    }
  };

  const handleToggleActive = async (id: number) => {
    try {
      await whatsappAccountsAPI.toggleActive(id);
      await loadAccounts();
      await confirm({
        title: '✅ Sucesso!',
        message: 'Status alterado com sucesso!',
        type: 'info',
        confirmText: 'OK',
        showCancel: false
      });
    } catch (error: any) {
      await confirm({
        title: '❌ Erro',
        message: 'Erro ao alterar status: ' + (error.response?.data?.error || error.message),
        type: 'danger',
        confirmText: 'OK',
        showCancel: false
      });
    }
  };

  const handleTestConnection = async (account: WhatsAppAccount) => {
    setTestingConnection(account.id);
    
    try {
      const response = await whatsappAccountsAPI.testConnection({
        access_token: account.access_token,
        phone_number_id: account.phone_number_id,
      });
      
      if (response.data.success) {
        await confirm({
          title: '✅ Conexão Testada!',
          message: 'Conexão testada com sucesso!',
          type: 'info',
          confirmText: 'OK',
          showCancel: false
        });
      } else {
        await confirm({
          title: '❌ Erro na Conexão',
          message: 'Erro na conexão: ' + response.data.error,
          type: 'danger',
          confirmText: 'OK',
          showCancel: false
        });
      }
    } catch (error: any) {
      await confirm({
        title: '❌ Erro ao Testar',
        message: 'Erro ao testar conexão: ' + (error.response?.data?.error || error.message),
        type: 'danger',
        confirmText: 'OK',
        showCancel: false
      });
    } finally {
      setTestingConnection(null);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      phone_number: '',
      access_token: '',
      phone_number_id: '',
      business_account_id: '',
      app_id: '',
      webhook_verify_token: '',
      is_active: true,
      proxy_id: null,
    });
    setEditingAccount(null);
    setShowForm(false);
  };

  if (loading) {
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
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 py-8 px-4">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* 🎨 CABEÇALHO PRINCIPAL */}
        <div className="relative overflow-hidden bg-gradient-to-r from-green-600/30 via-green-500/20 to-green-600/30 backdrop-blur-xl border-2 border-green-500/40 rounded-3xl p-10 shadow-2xl shadow-green-500/20">
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
                
                <div className="bg-gradient-to-br from-green-500 to-green-600 p-6 rounded-2xl shadow-lg shadow-green-500/50">
                  <FaCog className="text-5xl text-white" />
                </div>
                <div>
                  <h1 className="text-5xl font-black text-white tracking-tight mb-2">
                    Configurações
                  </h1>
                  <p className="text-xl text-white/80 font-medium">
                    Contas WhatsApp API
                  </p>
                </div>
              </div>
              
              <div className="flex gap-4 flex-wrap">
                <button
                  onClick={() => router.push('/template/gerenciar')}
                  className="flex items-center gap-3 px-6 py-4 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border-2 border-blue-500/40 rounded-xl font-bold transition-all duration-200 shadow-lg hover:shadow-blue-500/30"
                >
                  <FaFileAlt className="text-xl" />
                  Gerenciar Templates
                </button>
                <button
                  onClick={() => router.push('/template/criar')}
                  className="flex items-center gap-3 px-6 py-4 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border-2 border-purple-500/40 rounded-xl font-bold transition-all duration-200 shadow-lg hover:shadow-purple-500/30"
                >
                  <FaPlus className="text-xl" />
                  Criar Template
                </button>
                <button
                  onClick={() => setShowForm(!showForm)}
                  className={`flex items-center gap-3 px-8 py-4 rounded-xl font-bold transition-all duration-200 shadow-lg ${
                    showForm 
                      ? 'bg-red-500/20 hover:bg-red-500/30 text-red-300 border-2 border-red-500/40 hover:shadow-red-500/30' 
                      : 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-green-500/30 hover:shadow-green-500/50 transform hover:scale-105'
                  }`}
                >
                  {showForm ? <FaTimes className="text-xl" /> : <FaPlus className="text-xl" />}
                  {showForm ? 'Cancelar' : 'Adicionar Conta'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* FORMULÁRIO */}
        {showForm && (
          <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-primary-500/40 rounded-2xl p-8 shadow-2xl">
            <h2 className="text-3xl font-black mb-8 flex items-center gap-3">
              <div className="bg-primary-500/20 p-3 rounded-xl">
                {editingAccount ? <FaEdit className="text-2xl text-primary-400" /> : <FaPlus className="text-2xl text-primary-400" />}
              </div>
              {editingAccount ? 'Editar Conta' : 'Nova Conta'}
            </h2>
            
            <form onSubmit={handleSubmit}>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-lg font-bold mb-3 text-white">
                    Nome/Identificação *
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/30 transition-all"
                    placeholder="Ex: NETTCRED - Atendimento"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-lg font-bold mb-3 text-white">
                    Número de Telefone *
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/30 transition-all"
                    placeholder="Ex: 5562817429510"
                    value={formData.phone_number}
                    onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                  />
                  <p className="text-sm text-white/60 mt-2">
                    Formato: Código país + DDD + número
                  </p>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-lg font-bold mb-3 text-white">
                    Token de Acesso (Access Token) *
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/30 transition-all font-mono"
                    placeholder="EAAxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    value={formData.access_token}
                    onChange={(e) => setFormData({ ...formData, access_token: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-lg font-bold mb-3 text-white">
                    Phone Number ID *
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/30 transition-all font-mono"
                    placeholder="123456789012345"
                    value={formData.phone_number_id}
                    onChange={(e) => setFormData({ ...formData, phone_number_id: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-lg font-bold mb-3 text-white">
                    Business Account ID
                  </label>
                  <input
                    type="text"
                    className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/30 transition-all font-mono"
                    placeholder="987654321098765"
                    value={formData.business_account_id}
                    onChange={(e) => setFormData({ ...formData, business_account_id: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-lg font-bold mb-3 text-white flex items-center gap-2">
                    📱 Application ID (App ID)
                    <span className="text-sm font-normal text-yellow-400">
                      - Necessário para templates com mídia
                    </span>
                  </label>
                  <input
                    type="text"
                    className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/30 transition-all font-mono"
                    placeholder="123456789012345"
                    value={formData.app_id}
                    onChange={(e) => setFormData({ ...formData, app_id: e.target.value })}
                  />
                  <p className="text-sm text-white/60 mt-2">
                    💡 Use para criar templates com imagem via Resumable Upload API
                  </p>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-lg font-bold mb-3 text-white flex items-center gap-2">
                    🌐 Proxy (opcional)
                    {proxies.length === 0 && (
                      <span className="text-sm font-normal text-yellow-400">
                        - Nenhum proxy cadastrado
                      </span>
                    )}
                  </label>
                  <select
                    className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/30 transition-all"
                    value={formData.proxy_id || ''}
                    onChange={(e) => setFormData({ ...formData, proxy_id: e.target.value ? parseInt(e.target.value) : null })}
                  >
                    <option value="" className="bg-gray-800">Sem Proxy (uso direto)</option>
                    {proxies.map(proxy => (
                      <option key={proxy.id} value={proxy.id} className="bg-gray-800">
                        {proxy.name} ({proxy.host}:{proxy.port}) 
                        {proxy.location && ` - ${proxy.location}`}
                        {proxy.status === 'working' ? ' ✓' : proxy.status === 'failed' ? ' ✗' : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-sm text-white/60 mt-2">
                    💡 Configure proxies em <strong className="text-primary-400">Proxies &gt; Adicionar Proxy</strong>
                  </p>
                </div>

                <div className="md:col-span-2">
                  <label className="flex items-center gap-3 cursor-pointer p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-all">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="w-6 h-6 rounded border-2 border-white/20 focus:ring-2 focus:ring-primary-500"
                    />
                    <span className="text-lg font-bold">✅ Ativar esta conta</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-4 mt-8">
                <button 
                  type="submit" 
                  className="flex-1 px-6 py-4 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white text-lg font-bold rounded-xl transition-all duration-200 shadow-lg shadow-primary-500/40 hover:shadow-primary-500/60 flex items-center justify-center gap-2"
                >
                  <FaCheck />
                  {editingAccount ? 'Atualizar Conta' : 'Salvar Conta'}
                </button>
                <button 
                  type="button" 
                  onClick={resetForm} 
                  className="flex-1 px-6 py-4 bg-dark-700 hover:bg-dark-600 text-white text-lg font-bold rounded-xl transition-all duration-200 border-2 border-white/20 hover:border-white/40 flex items-center justify-center gap-2"
                >
                  <FaTimes />
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {/* LISTA DE CONTAS */}
        {accounts.length === 0 ? (
          <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-20 text-center shadow-xl">
            <div className="text-6xl mb-6">📭</div>
            <p className="text-2xl text-white/70 font-medium mb-4">
              Nenhuma conta configurada ainda
            </p>
            <p className="text-lg text-white/50 mb-8">
              Clique em "Adicionar Conta" para começar
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white text-lg font-bold rounded-xl transition-all duration-200 shadow-lg shadow-primary-500/40 hover:shadow-primary-500/60 transform hover:scale-105"
            >
              <FaPlus className="text-xl" />
              Adicionar Primeira Conta
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Barra de Ação em Massa */}
            <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-primary-500/30 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                {/* Checkbox Selecionar Todos */}
                <button
                  onClick={handleSelectAllAccounts}
                  className="flex items-center gap-3 px-6 py-3 bg-primary-500/20 hover:bg-primary-500/30 text-white rounded-xl transition-all border-2 border-primary-500/40 hover:border-primary-500/60"
                >
                  {selectedAccounts.size === accounts.length ? (
                    <FaCheckSquare className="text-2xl text-primary-400" />
                  ) : (
                    <FaSquare className="text-2xl text-gray-400" />
                  )}
                  <span className="font-bold">
                    {selectedAccounts.size === accounts.length ? 'Desselecionar Todas' : 'Selecionar Todas'}
                  </span>
                </button>

                {/* Contador de Selecionadas */}
                {selectedAccounts.size > 0 && (
                  <div className="px-4 py-2 bg-primary-500/20 border-2 border-primary-500/40 rounded-xl">
                    <span className="text-white font-bold">
                      {selectedAccounts.size} de {accounts.length} selecionada(s)
                    </span>
                  </div>
                )}

                {/* Botões de Ação */}
                <div className="flex gap-3 flex-wrap">
                  <button
                    onClick={handleActivateSelected}
                    disabled={deactivating || selectedAccounts.size === 0}
                    className="flex items-center gap-2 px-6 py-3 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-xl transition-all border-2 border-emerald-500/40 hover:border-emerald-500/60 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deactivating ? (
                      <FaSpinner className="text-xl animate-spin" />
                    ) : (
                      <FaCheck className="text-xl" />
                    )}
                    Ativar Selecionadas
                  </button>

                  <button
                    onClick={handleDeactivateSelected}
                    disabled={deactivating || selectedAccounts.size === 0}
                    className="flex items-center gap-2 px-6 py-3 bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 rounded-xl transition-all border-2 border-orange-500/40 hover:border-orange-500/60 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deactivating ? (
                      <FaSpinner className="text-xl animate-spin" />
                    ) : (
                      <FaBan className="text-xl" />
                    )}
                    Desativar Selecionadas
                  </button>

                  <button
                    onClick={handleActivateAll}
                    disabled={deactivating}
                    className="flex items-center gap-2 px-6 py-3 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 rounded-xl transition-all border-2 border-emerald-600/40 hover:border-emerald-600/60 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deactivating ? (
                      <FaSpinner className="text-xl animate-spin" />
                    ) : (
                      <FaCheck className="text-xl" />
                    )}
                    Ativar TODAS
                  </button>

                  <button
                    onClick={handleDeactivateAll}
                    disabled={deactivating}
                    className="flex items-center gap-2 px-6 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-xl transition-all border-2 border-red-500/40 hover:border-red-500/60 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deactivating ? (
                      <FaSpinner className="text-xl animate-spin" />
                    ) : (
                      <FaBan className="text-xl" />
                    )}
                    Desativar TODAS
                  </button>
                </div>
              </div>
            </div>

            {accounts.map((account) => (
              <div key={account.id} className="bg-dark-800/60 backdrop-blur-xl border-2 border-primary-500/30 rounded-2xl p-8 shadow-xl hover:border-primary-500/50 transition-all duration-300 relative">
                {/* Tag de Status no Canto Direito Superior */}
                <div className="absolute top-4 right-4 z-10">
                  {account.is_active ? (
                    <span className="px-5 py-3 rounded-xl text-base font-bold border-2 bg-green-500/20 text-green-300 border-green-500/40 inline-flex items-center gap-2 shadow-xl">
                      <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                      ATIVO
                    </span>
                  ) : (
                    <span className="px-5 py-3 rounded-xl text-base font-bold border-2 bg-gray-500/20 text-gray-400 border-gray-500/40 inline-flex items-center gap-2 shadow-xl">
                      <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                      INATIVO
                    </span>
                  )}
                </div>

                <div className="flex items-start justify-between gap-8">
                  {/* COLUNA ESQUERDA - Perfil, Info e Botões */}
                  <div className="flex-1 flex flex-col justify-between h-full">
                    {/* TOPO: Perfil com Foto GRANDE e Nome */}
                    <div className="flex items-start gap-6 mb-8 pr-40">
                      {/* Checkbox de Seleção */}
                      <button
                        onClick={() => handleToggleSelectAccount(account.id)}
                        className="flex-shrink-0 mt-12"
                      >
                        {selectedAccounts.has(account.id) ? (
                          <FaCheckSquare className="text-4xl text-primary-400 hover:text-primary-300 transition-colors" />
                        ) : (
                          <FaSquare className="text-4xl text-gray-600 hover:text-gray-500 transition-colors" />
                        )}
                      </button>

                      {/* Foto de Perfil MUITO MAIOR E REDONDA */}
                      {(account as any).whatsapp_profile_picture ? (
                        <img 
                          src={(account as any).whatsapp_profile_picture} 
                          alt="Perfil WhatsApp"
                          className={`w-40 h-40 rounded-full object-cover border-4 border-primary-500/50 shadow-2xl flex-shrink-0 ring-4 ring-primary-500/20 transition-all ${
                            !account.is_active ? 'grayscale opacity-50' : ''
                          }`}
                        />
                      ) : (
                        <div className={`w-40 h-40 rounded-full bg-gradient-to-br from-primary-500/30 to-primary-600/30 border-4 border-primary-500/50 flex items-center justify-center shadow-2xl flex-shrink-0 ring-4 ring-primary-500/20 transition-all ${
                          !account.is_active ? 'grayscale opacity-50' : ''
                        }`}>
                          <FaWhatsapp className="text-7xl text-primary-300" />
                        </div>
                      )}
                      
                      {/* Nome - MUITO ESPAÇO */}
                      <div className="flex flex-col gap-4 flex-1 min-w-0 py-2">
                        {/* Nome do WhatsApp Business - GRANDE E COM ESPAÇO */}
                        <div>
                          <h3 className="text-4xl font-black text-white break-words leading-tight">
                            {(account as any).whatsapp_display_name || account.name}
                          </h3>
                          {/* Nome customizado do sistema (se diferente) */}
                          {(account as any).whatsapp_display_name && (account as any).whatsapp_display_name !== account.name && (
                            <p className="text-sm text-white/50 break-words mt-2">
                              Nome no sistema: {account.name}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* MEIO: Info Cards - Número e Phone ID - ALINHADO COM ESTATÍSTICAS */}
                    <div className="grid grid-cols-2 gap-3 mb-6">
                      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                        <div className="text-white/60 text-xs font-medium mb-1 flex items-center gap-1">
                          <span>📱</span> Número
                        </div>
                        <div className="text-white font-bold truncate">{account.phone_number}</div>
                      </div>
                      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                        <div className="text-white/60 text-xs font-medium mb-1 flex items-center gap-1">
                          <span>🆔</span> Phone ID
                        </div>
                        <div className="text-white font-bold text-sm font-mono truncate">{account.phone_number_id}</div>
                      </div>
                    </div>

                    {/* BAIXO: BOTÕES - MAIORES E ALINHADOS */}
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                      <button
                        onClick={() => handleTestConnection(account)}
                        disabled={testingConnection === account.id}
                        className="w-full px-6 py-4 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border-2 border-blue-500/40 hover:border-blue-500/60 rounded-xl font-bold text-base transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg"
                        title="Testar conexão"
                      >
                        {testingConnection === account.id ? (
                          <>
                            <FaSpinner className="animate-spin text-xl" />
                            <span>Testando...</span>
                          </>
                        ) : (
                          <>
                            <FaCheckCircle className="text-xl" />
                            <span>Testar</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => handleToggleActive(account.id)}
                        className={`w-full px-6 py-4 ${
                          account.is_active
                            ? 'bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border-yellow-500/40 hover:border-yellow-500/60'
                            : 'bg-green-500/20 hover:bg-green-500/30 text-green-300 border-green-500/40 hover:border-green-500/60'
                        } border-2 rounded-xl font-bold text-base transition-all duration-200 flex items-center justify-center gap-2 shadow-lg`}
                        title={account.is_active ? 'Desativar conta' : 'Ativar conta'}
                      >
                        {account.is_active ? (
                          <>
                            <FaBan className="text-xl" />
                            <span>Desativar</span>
                          </>
                        ) : (
                          <>
                            <FaCheckCircle className="text-xl" />
                            <span>Ativar</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => handleEdit(account)}
                        className="w-full px-6 py-4 bg-green-500/20 hover:bg-green-500/30 text-green-300 border-2 border-green-500/40 hover:border-green-500/60 rounded-xl font-bold text-base transition-all duration-200 flex items-center justify-center gap-2 shadow-lg"
                        title="Editar conta"
                      >
                        <FaEdit className="text-xl" />
                        <span>Editar</span>
                      </button>

                      <button
                        onClick={() => router.push(`/configuracoes/conta/${account.id}`)}
                        className="w-full px-6 py-4 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border-2 border-purple-500/40 hover:border-purple-500/60 rounded-xl font-bold text-base transition-all duration-200 flex items-center justify-center gap-2 shadow-lg"
                        title="Configurações avançadas"
                      >
                        <FaCog className="text-xl" />
                        <span>Configurar</span>
                      </button>

                      <button
                        onClick={async () => {
                          const confirmed = await confirm({
                            title: 'Excluir conta',
                            message: `Tem certeza que deseja excluir a conta ${account.name}?`,
                          });
                          if (confirmed) {
                            handleDelete(account.id);
                          }
                        }}
                        className="w-full col-span-2 px-6 py-4 bg-red-500/20 hover:bg-red-500/30 text-red-300 border-2 border-red-500/40 hover:border-red-500/60 rounded-xl font-bold text-base transition-all duration-200 flex items-center justify-center gap-2 shadow-lg"
                        title="Excluir conta"
                      >
                        <FaTrash className="text-xl" />
                        <span>Excluir</span>
                      </button>
                    </div>
                  </div>

                  {/* Estatísticas da Conta - LAYOUT MELHORADO */}
                  <div className="flex-1 max-w-md">
                    <div className="bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-2xl p-6 h-full shadow-2xl">
                      <h4 className="text-white font-black text-xl mb-6 flex items-center gap-3 pb-4 border-b border-white/10">
                        <span className="text-3xl">📊</span> 
                        <span className="bg-gradient-to-r from-primary-400 to-primary-600 bg-clip-text text-transparent">
                          Estatísticas da Conta
                        </span>
                      </h4>
                      
                      <div className="space-y-4">
                        {/* Grid 2x2 para as mensagens */}
                        <div className="grid grid-cols-2 gap-3">
                          {/* Mensagens Utility */}
                          <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border-2 border-blue-500/30 rounded-xl p-4 hover:scale-105 transition-transform duration-200">
                            <div className="flex flex-col h-full">
                              <div className="text-blue-300 text-xs font-bold mb-2 flex items-center gap-1">
                                💼 UTILITY
                              </div>
                              <div className="flex items-baseline gap-1 mb-1">
                                <div className="text-white text-3xl font-black">
                                  {(account as any).stats_utility || '0'}
                                </div>
                                <div className="text-blue-200 text-xs font-medium">msgs</div>
                              </div>
                              <div className="text-blue-300 text-base font-bold">
                                {(account as any).cost_utility || 'R$ 0,00'}
                              </div>
                            </div>
                          </div>
                          
                          {/* Mensagens Marketing */}
                          <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 border-2 border-green-500/30 rounded-xl p-4 hover:scale-105 transition-transform duration-200">
                            <div className="flex flex-col h-full">
                              <div className="text-green-300 text-xs font-bold mb-2 flex items-center gap-1">
                                📣 MARKETING
                              </div>
                              <div className="flex items-baseline gap-1 mb-1">
                                <div className="text-white text-3xl font-black">
                                  {(account as any).stats_marketing || '0'}
                                </div>
                                <div className="text-green-200 text-xs font-medium">msgs</div>
                              </div>
                              <div className="text-green-300 text-base font-bold">
                                {(account as any).cost_marketing || 'R$ 0,00'}
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Qualidade da Conta */}
                        <div className={`rounded-xl p-4 border-2 shadow-lg hover:scale-105 transition-transform duration-200 ${
                          (account as any).quality_rating === 'GREEN' 
                            ? 'bg-gradient-to-br from-green-500/20 to-green-600/10 border-green-500/40'
                            : (account as any).quality_rating === 'YELLOW'
                            ? 'bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 border-yellow-500/40'
                            : (account as any).quality_rating === 'RED'
                            ? 'bg-gradient-to-br from-orange-500/20 to-orange-600/10 border-orange-500/40'
                            : 'bg-gradient-to-br from-red-500/20 to-red-600/10 border-red-500/40'
                        }`}>
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className={`text-xs font-bold mb-2 ${
                                (account as any).quality_rating === 'GREEN' 
                                  ? 'text-green-300'
                                  : (account as any).quality_rating === 'YELLOW'
                                  ? 'text-yellow-300'
                                  : (account as any).quality_rating === 'RED'
                                  ? 'text-orange-300'
                                  : 'text-red-300'
                              }`}>⭐ QUALIDADE</div>
                              <div className="text-white text-2xl font-black">
                                {(account as any).quality_rating === 'GREEN' && '✅ ALTA'}
                                {(account as any).quality_rating === 'YELLOW' && '⚠️ MÉDIA'}
                                {(account as any).quality_rating === 'RED' && '⚠️ BAIXA'}
                                {(account as any).quality_rating === 'FLAGGED' && '🚫 RESTRITA'}
                                {!(account as any).quality_rating && '⚪ N/A'}
                              </div>
                            </div>
                            <div className={`text-5xl ${
                              (account as any).quality_rating === 'GREEN' 
                                ? 'text-green-300'
                                : (account as any).quality_rating === 'YELLOW'
                                ? 'text-yellow-300'
                                : (account as any).quality_rating === 'RED'
                                ? 'text-orange-300'
                                : 'text-red-300'
                            }`}>
                              {(account as any).quality_rating === 'GREEN' && '😊'}
                              {(account as any).quality_rating === 'YELLOW' && '😐'}
                              {(account as any).quality_rating === 'RED' && '😟'}
                              {(account as any).quality_rating === 'FLAGGED' && '🔴'}
                              {!(account as any).quality_rating && '❓'}
                            </div>
                          </div>
                        </div>
                        
                        {/* Status da API */}
                        <div className="bg-gradient-to-br from-green-500/20 to-emerald-600/10 border-2 border-green-500/40 rounded-xl p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="text-green-300 text-xs font-bold mb-2">🔌 STATUS API</div>
                              <div className="text-white text-xl font-black flex items-center gap-2">
                                <span className="w-3 h-3 bg-green-400 rounded-full animate-pulse shadow-lg shadow-green-400/50"></span>
                                Conectada
                              </div>
                            </div>
                            <div className="text-green-300 text-4xl">✅</div>
                          </div>
                        </div>
                        
                        {/* Status do Webhook */}
                        <div className={`bg-gradient-to-br ${
                          (account as any).webhook_verify_token 
                            ? 'from-blue-500/20 to-cyan-600/10 border-blue-500/40' 
                            : 'from-red-500/20 to-orange-600/10 border-red-500/40'
                        } border-2 rounded-xl p-4`}>
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className={`${
                                (account as any).webhook_verify_token ? 'text-blue-300' : 'text-red-300'
                              } text-xs font-bold mb-2`}>🔗 WEBHOOK</div>
                              <div className="text-white text-xl font-black flex items-center gap-2">
                                <span className={`w-3 h-3 rounded-full ${
                                  (account as any).webhook_verify_token 
                                    ? 'bg-blue-400 animate-pulse shadow-lg shadow-blue-400/50' 
                                    : 'bg-red-400'
                                }`}></span>
                                {(account as any).webhook_verify_token ? 'Ativado' : 'Desativado'}
                              </div>
                            </div>
                            <div className={`text-4xl ${
                              (account as any).webhook_verify_token ? 'text-blue-300' : 'text-red-300'
                            }`}>
                              {(account as any).webhook_verify_token ? '🔔' : '🔕'}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        .bg-grid-white {
          background-image: 
            linear-gradient(to right, rgba(255, 255, 255, 0.1) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.1) 1px, transparent 1px);
          background-size: 20px 20px;
        }
      `}</style>
      
      {/* Modal de Confirmação Elegante */}
      <ConfirmDialog />
    </div>
  );
}
