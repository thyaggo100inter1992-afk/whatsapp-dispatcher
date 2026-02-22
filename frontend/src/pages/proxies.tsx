import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useToast } from '@/hooks/useToast';
import ToastContainer from '@/components/ToastContainer';
import { FaGlobe, FaPlus, FaEdit, FaTrash, FaFlask, FaCheckCircle, FaTimesCircle, FaClock, FaSave, FaTimes, FaArrowLeft, FaUsers, FaExchangeAlt, FaPhone, FaCheckSquare, FaSquare } from 'react-icons/fa';
import api from '@/services/api';

interface ProxyPoolItem {
  host: string;
  port: number;
  username?: string;
  password?: string;
}

interface Account {
  id: number;
  name: string;
  phone_number: string;
  status: string;
  is_active: boolean;
}

interface Proxy {
  id: number;
  name: string;
  type: string;
  host: string;
  port: number;
  username?: string;
  password?: string;
  location?: string;
  description?: string;
  status: string;
  last_check?: string;
  last_ip?: string;
  is_active: boolean;
  accounts_count?: number;
  created_at: string;
  rotation_interval?: number; // Em minutos
  proxy_pool?: ProxyPoolItem[]; // Para proxies rotativos
  current_proxy_index?: number; // Qual proxy do pool está ativo
}

export default function ProxiesPage() {
  const router = useRouter();
  const { toasts, removeToast, success, error, info, warning } = useToast();
  const toast = { success, error, info, warning }; // Para manter compatibilidade
  const [proxies, setProxies] = useState<Proxy[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProxy, setEditingProxy] = useState<Proxy | null>(null);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [testingAll, setTestingAll] = useState(false);

  // States para Ver Contas
  const [showAccountsModal, setShowAccountsModal] = useState(false);
  const [proxyAccounts, setProxyAccounts] = useState<Account[]>([]);
  const [viewingProxy, setViewingProxy] = useState<Proxy | null>(null);
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  // States para Transferir Contas
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferTargetProxyId, setTransferTargetProxyId] = useState('');
  const [selectedAccountIds, setSelectedAccountIds] = useState<number[]>([]);
  const [transferring, setTransferring] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    type: 'socks5',
    host: '',
    port: '',
    username: '',
    password: '',
    location: '',
    description: '',
    is_active: true,
    rotation_interval: 30, // Minutos
    proxy_pool: [] as ProxyPoolItem[]
  });

  // Temporary states for adding proxies to pool
  const [poolHost, setPoolHost] = useState('');
  const [poolPort, setPoolPort] = useState('');
  const [poolUsername, setPoolUsername] = useState('');
  const [poolPassword, setPoolPassword] = useState('');

  useEffect(() => {
    loadProxies();
  }, []);

  const loadProxies = async () => {
    setLoading(true);
    try {
      const response = await api.get('/proxies');
      if (response.data.success) {
        setProxies(response.data.data);
      }
    } catch (error) {
      console.error('Erro ao carregar proxies:', error);
      toast.error('Erro ao carregar proxies');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (proxy?: Proxy) => {
    if (proxy) {
      setEditingProxy(proxy);
      setFormData({
        name: proxy.name,
        type: proxy.type,
        host: proxy.host,
        port: proxy.port.toString(),
        username: proxy.username || '',
        password: proxy.password || '',
        location: proxy.location || '',
        description: proxy.description || '',
        is_active: proxy.is_active,
        rotation_interval: proxy.rotation_interval || 30,
        proxy_pool: proxy.proxy_pool || []
      });
    } else {
      setEditingProxy(null);
      setFormData({
        name: '',
        type: 'socks5',
        host: '',
        port: '',
        username: '',
        password: '',
        location: '',
        description: '',
        is_active: true,
        rotation_interval: 30,
        proxy_pool: []
      });
    }
    // Reset pool form
    setPoolHost('');
    setPoolPort('');
    setPoolUsername('');
    setPoolPassword('');
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingProxy(null);
  };

  const handleAddToPool = () => {
    if (!poolHost || !poolPort) {
      toast.error('Host e porta são obrigatórios');
      return;
    }

    const newProxy: ProxyPoolItem = {
      host: poolHost,
      port: parseInt(poolPort),
      username: poolUsername || undefined,
      password: poolPassword || undefined
    };

    setFormData({
      ...formData,
      proxy_pool: [...formData.proxy_pool, newProxy]
    });

    // Reset pool form
    setPoolHost('');
    setPoolPort('');
    setPoolUsername('');
    setPoolPassword('');
    toast.success('✅ Proxy adicionado ao pool!');
  };

  const handleRemoveFromPool = (index: number) => {
    setFormData({
      ...formData,
      proxy_pool: formData.proxy_pool.filter((_, i) => i !== index)
    });
    toast.info('🗑️ Proxy removido do pool');
  };

  const handleSave = async () => {
    try {
      // Validações
      if (formData.type === 'rotating') {
        if (formData.proxy_pool.length === 0) {
          toast.error('Adicione pelo menos 1 proxy ao pool para rotação');
          return;
        }
      } else {
        if (!formData.host || !formData.port) {
          toast.error('Host e porta são obrigatórios');
          return;
        }
      }

      const payload = {
        ...formData,
        port: formData.type === 'rotating' ? 0 : parseInt(formData.port) || 0,
        host: formData.type === 'rotating' ? '' : formData.host,
        rotation_interval: formData.type === 'rotating' ? formData.rotation_interval : null,
        proxy_pool: formData.type === 'rotating' ? formData.proxy_pool : null
      };

      let response;
      if (editingProxy) {
        response = await api.put(`/proxies/${editingProxy.id}`, payload);
      } else {
        response = await api.post('/proxies', payload);
      }

      if (response.data.success) {
        toast.success(editingProxy ? '✅ Proxy atualizado!' : '✅ Proxy criado!');
        handleCloseModal();
        loadProxies();
      } else {
        toast.error(response.data.error || 'Erro ao salvar proxy');
      }
    } catch (error) {
      console.error('Erro ao salvar proxy:', error);
      toast.error('Erro ao salvar proxy');
    }
  };

  const handleDelete = async (id: number, name: string, accountsCount: number) => {
    if (accountsCount > 0) {
      toast.error(`Este proxy está sendo usado por ${accountsCount} conta(s). Remova das contas antes de deletar.`);
      return;
    }

    if (!confirm(`Tem certeza que deseja deletar o proxy "${name}"?`)) {
      return;
    }

    try {
      const response = await api.delete(`/proxies/${id}`);

      if (response.data.success) {
        toast.success('🗑️ Proxy deletado!');
        loadProxies();
      } else {
        toast.error(response.data.error || 'Erro ao deletar proxy');
      }
    } catch (error) {
      console.error('Erro ao deletar proxy:', error);
      toast.error('Erro ao deletar proxy');
    }
  };

  const handleTest = async (id: number) => {
    setTestingId(id);
    try {
      const response = await api.post(`/proxies/${id}/test`);

      if (response.data.success) {
        toast.success('✅ Proxy testado com sucesso!');
      } else {
        toast.error('❌ Teste falhou: ' + (response.data.error || 'Proxy não está funcionando'));
      }
      loadProxies();
    } catch (error) {
      console.error('Erro ao testar proxy:', error);
      toast.error('Erro ao testar proxy');
    } finally {
      setTestingId(null);
    }
  };

  const handleTestAll = async () => {
    setTestingAll(true);
    try {
      const response = await api.post('/proxies/test-all');

      if (response.data.success) {
        toast.success(`✅ Testados: ${response.data.working}/${response.data.tested} funcionando`);
      } else {
        toast.error('Erro ao testar proxies');
      }
      loadProxies();
    } catch (error) {
      console.error('Erro ao testar proxies:', error);
      toast.error('Erro ao testar proxies');
    } finally {
      setTestingAll(false);
    }
  };

  const handleViewAccounts = async (proxy: Proxy) => {
    setViewingProxy(proxy);
    setShowAccountsModal(true);
    setLoadingAccounts(true);
    setProxyAccounts([]);
    try {
      const response = await api.get(`/proxies/${proxy.id}/accounts`);
      if (response.data.success) {
        setProxyAccounts(response.data.data);
      } else {
        toast.error('Erro ao carregar contas');
      }
    } catch (err) {
      console.error('Erro ao carregar contas do proxy:', err);
      toast.error('Erro ao carregar contas');
    } finally {
      setLoadingAccounts(false);
    }
  };

  const handleOpenTransfer = () => {
    setSelectedAccountIds(proxyAccounts.map(a => a.id));
    setTransferTargetProxyId('');
    setShowTransferModal(true);
  };

  const handleToggleAccount = (id: number) => {
    setSelectedAccountIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAllAccounts = () => {
    if (selectedAccountIds.length === proxyAccounts.length) {
      setSelectedAccountIds([]);
    } else {
      setSelectedAccountIds(proxyAccounts.map(a => a.id));
    }
  };

  const handleTransferAccounts = async () => {
    if (!transferTargetProxyId) {
      toast.error('Selecione o proxy de destino');
      return;
    }
    if (selectedAccountIds.length === 0) {
      toast.error('Selecione pelo menos uma conta');
      return;
    }
    setTransferring(true);
    try {
      const response = await api.post('/proxies/transfer-accounts', {
        from_proxy_id: viewingProxy?.id,
        to_proxy_id: parseInt(transferTargetProxyId),
        account_ids: selectedAccountIds
      });
      if (response.data.success) {
        toast.success(`✅ ${response.data.transferred} conta(s) transferida(s) com sucesso!`);
        setShowTransferModal(false);
        setShowAccountsModal(false);
        loadProxies();
      } else {
        toast.error(response.data.error || 'Erro ao transferir contas');
      }
    } catch (err) {
      console.error('Erro ao transferir contas:', err);
      toast.error('Erro ao transferir contas');
    } finally {
      setTransferring(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      working: (
        <span className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-2 border-green-500/50 text-green-300 rounded-full text-sm font-bold">
          <FaCheckCircle className="text-base" /> ✓ Funcionando
        </span>
      ),
      failed: (
        <span className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-500/20 to-rose-500/20 border-2 border-red-500/50 text-red-300 rounded-full text-sm font-bold">
          <FaTimesCircle className="text-base" /> ✗ Falhou
        </span>
      ),
      unchecked: (
        <span className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border-2 border-yellow-500/50 text-yellow-300 rounded-full text-sm font-bold">
          <FaClock className="text-base" /> ⏳ Não testado
        </span>
      )
    };
    return badges[status as keyof typeof badges] || badges.unchecked;
  };

  return (
    <>
      <Head>
        <title>Gerenciar Proxies | Disparador NettSistemas</title>
      </Head>
      
      <ToastContainer toasts={toasts} onClose={removeToast} />
      
      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900">
        {/* Background Pattern */}
        <div className="fixed inset-0 opacity-5 pointer-events-none">
          <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
            backgroundSize: '40px 40px'
          }}></div>
        </div>

        <div className="relative max-w-7xl mx-auto p-6">
          {/* Header Moderno */}
          <div className="mb-8 pb-6 border-b-2 border-white/10">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                {/* Botão Voltar */}
                <button
                  onClick={() => router.push('/dashboard-oficial')}
                  className="bg-white/10 hover:bg-white/20 p-3 rounded-xl transition-all duration-200 border-2 border-white/20 hover:border-white/40"
                  title="Voltar para o Dashboard API Oficial"
                >
                  <FaArrowLeft className="text-2xl text-white" />
                </button>
                
                <div className="bg-gradient-to-br from-cyan-500 to-blue-600 p-4 rounded-xl shadow-lg">
                  <FaGlobe className="text-4xl text-white" />
                </div>
                <div>
                  <h1 className="text-5xl font-black text-white">
                    Gerenciar Proxies
                  </h1>
                  <p className="text-white/60 text-lg mt-1">
                    Gerencie todos os seus proxies em um só lugar
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleTestAll}
                  disabled={testingAll || proxies.length === 0}
                  className="px-6 py-4 bg-gradient-to-r from-blue-500/20 to-blue-600/10 hover:from-blue-500/30 hover:to-blue-600/20 border-2 border-blue-500/50 text-blue-200 font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-base"
                >
                  {testingAll ? (
                    <>
                      <div className="w-5 h-5 border-2 border-blue-300 border-t-transparent rounded-full animate-spin"></div>
                      Testando...
                    </>
                  ) : (
                    <>
                      <FaFlask className="text-lg" /> Testar Todos
                    </>
                  )}
                </button>
                <button
                  onClick={() => handleOpenModal()}
                  className="px-6 py-4 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-primary-500/30 hover:shadow-primary-500/50 transform hover:scale-105 flex items-center gap-2 text-base"
                >
                  <FaPlus className="text-lg" /> Adicionar Proxy
                </button>
              </div>
            </div>
          </div>

          {/* Lista de Proxies */}
          {loading ? (
            <div className="bg-gradient-to-br from-white/10 to-white/5 border-2 border-white/20 rounded-xl p-20 text-center">
              <div className="animate-spin rounded-full h-20 w-20 border-b-4 border-primary-500 mx-auto mb-6"></div>
              <p className="text-white text-xl font-bold">Carregando proxies...</p>
            </div>
          ) : proxies.length === 0 ? (
            <div className="text-center py-20 bg-gradient-to-br from-white/5 to-white/0 border-2 border-dashed border-white/20 rounded-2xl">
              <div className="bg-white/10 p-8 rounded-full inline-block mb-6">
                <FaGlobe className="text-8xl text-white/30" />
              </div>
              <p className="text-white font-bold text-2xl mb-3">Nenhum proxy cadastrado</p>
              <p className="text-white/60 text-base mb-6">Adicione seu primeiro proxy para começar</p>
              <button
                onClick={() => handleOpenModal()}
                className="px-8 py-4 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-primary-500/30 hover:shadow-primary-500/50 transform hover:scale-105 inline-flex items-center gap-2 text-base"
              >
                <FaPlus className="text-lg" /> Adicionar Primeiro Proxy
              </button>
            </div>
          ) : (
          <div className="grid grid-cols-1 gap-6">
            {proxies.map(proxy => (
              <div
                key={proxy.id}
                className="p-8 bg-gradient-to-br from-white/10 to-white/5 border-2 border-white/10 rounded-xl hover:border-primary-500/30 hover:shadow-lg hover:shadow-primary-500/10 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="bg-cyan-500/20 p-2 rounded-lg">
                        <FaGlobe className="text-2xl text-cyan-300" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold text-white">{proxy.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          {getStatusBadge(proxy.status)}
                          {!proxy.is_active && (
                            <span className="px-3 py-1 bg-gray-500/20 border-2 border-gray-500/50 text-gray-300 rounded-full text-xs font-bold">
                              ⏸️ Inativo
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-blue-500/10 border border-blue-500/30 p-4 rounded-lg">
                        <p className="text-blue-300 text-xs font-bold mb-1 flex items-center gap-1">
                          <span>🔧</span> Tipo
                        </p>
                        <p className="text-white font-mono text-lg font-black">
                          {proxy.type === 'rotating' ? '🔄 ROTATIVO' : proxy.type.toUpperCase()}
                        </p>
                      </div>
                      
                      {proxy.type === 'rotating' ? (
                        <>
                          <div className="bg-purple-500/10 border border-purple-500/30 p-4 rounded-lg">
                            <p className="text-purple-300 text-xs font-bold mb-1 flex items-center gap-1">
                              <span>📋</span> Proxies no Pool
                            </p>
                            <p className="text-white text-2xl font-black">{proxy.proxy_pool?.length || 0}</p>
                          </div>
                          <div className="bg-indigo-500/10 border border-indigo-500/30 p-4 rounded-lg">
                            <p className="text-indigo-300 text-xs font-bold mb-1 flex items-center gap-1">
                              <span>⏱️</span> Intervalo
                            </p>
                            <p className="text-white text-sm font-bold">{proxy.rotation_interval || 30} min</p>
                          </div>
                          {proxy.proxy_pool && proxy.proxy_pool.length > 0 && (
                            <div className="bg-green-500/10 border border-green-500/30 p-4 rounded-lg">
                              <p className="text-green-300 text-xs font-bold mb-1 flex items-center gap-1">
                                <span>✓</span> Proxy Atual
                              </p>
                              <p className="text-white font-mono text-xs font-bold">
                                {proxy.proxy_pool[proxy.current_proxy_index || 0]?.host || 'N/A'}
                              </p>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="bg-purple-500/10 border border-purple-500/30 p-4 rounded-lg">
                          <p className="text-purple-300 text-xs font-bold mb-1 flex items-center gap-1">
                            <span>🌐</span> Host:Porta
                          </p>
                          <p className="text-white font-mono text-sm font-bold">{proxy.host}:{proxy.port}</p>
                        </div>
                      )}
                      
                      {proxy.location && (
                        <div className="bg-green-500/10 border border-green-500/30 p-4 rounded-lg">
                          <p className="text-green-300 text-xs font-bold mb-1 flex items-center gap-1">
                            <span>📍</span> Localização
                          </p>
                          <p className="text-white text-sm font-bold">{proxy.location}</p>
                        </div>
                      )}
                      {proxy.last_ip && (
                        <div className="bg-yellow-500/10 border border-yellow-500/30 p-4 rounded-lg">
                          <p className="text-yellow-300 text-xs font-bold mb-1 flex items-center gap-1">
                            <span>🔍</span> IP Detectado
                          </p>
                          <p className="text-white font-mono text-sm font-bold">{proxy.last_ip}</p>
                        </div>
                      )}
                      <div className="bg-pink-500/10 border border-pink-500/30 p-4 rounded-lg">
                        <p className="text-pink-300 text-xs font-bold mb-1 flex items-center gap-1">
                          <span>📱</span> Contas Usando
                        </p>
                        <p className="text-white text-2xl font-black">{proxy.accounts_count || 0}</p>
                      </div>
                    </div>
                    
                    {/* Aviso de fallback quando proxy falhou mas tem contas usando */}
                    {proxy.status === 'failed' && (proxy.accounts_count || 0) > 0 && (
                      <div className="mt-4 flex items-start gap-3 p-4 bg-gradient-to-r from-orange-500/15 to-amber-500/10 border-2 border-orange-500/50 rounded-xl">
                        <span className="text-orange-400 text-xl flex-shrink-0 mt-0.5">⚠️</span>
                        <div>
                          <p className="text-orange-300 font-bold text-sm">
                            Proxy com falha — Modo Fallback Ativo
                          </p>
                          <p className="text-orange-200/70 text-xs mt-1">
                            As <strong>{proxy.accounts_count}</strong> conta(s) associadas estão operando <strong>sem proxy</strong> automaticamente até que o proxy seja corrigido. Nenhuma conta foi bloqueada.
                          </p>
                        </div>
                      </div>
                    )}

                    {proxy.description && (
                      <div className="mt-4 p-3 bg-white/5 border border-white/10 rounded-lg">
                        <p className="text-white/70 text-sm">{proxy.description}</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-col gap-2 ml-6">
                    <button
                      onClick={() => handleTest(proxy.id)}
                      disabled={testingId === proxy.id}
                      className="p-4 bg-blue-500/20 hover:bg-blue-500/30 border-2 border-blue-500/50 text-blue-300 rounded-xl transition-all disabled:opacity-50 hover:scale-110"
                      title="Testar Proxy"
                    >
                      {testingId === proxy.id ? (
                        <div className="w-6 h-6 border-2 border-blue-300 border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <FaFlask className="text-xl" />
                      )}
                    </button>
                    <button
                      onClick={() => handleViewAccounts(proxy)}
                      className="p-4 bg-cyan-500/20 hover:bg-cyan-500/30 border-2 border-cyan-500/50 text-cyan-300 rounded-xl transition-all hover:scale-110"
                      title="Ver Contas"
                    >
                      <FaUsers className="text-xl" />
                    </button>
                    <button
                      onClick={() => handleOpenModal(proxy)}
                      className="p-4 bg-yellow-500/20 hover:bg-yellow-500/30 border-2 border-yellow-500/50 text-yellow-300 rounded-xl transition-all hover:scale-110"
                      title="Editar"
                    >
                      <FaEdit className="text-xl" />
                    </button>
                    <button
                      onClick={() => handleDelete(proxy.id, proxy.name, proxy.accounts_count || 0)}
                      className="p-4 bg-red-500/20 hover:bg-red-500/30 border-2 border-red-500/50 text-red-300 rounded-xl transition-all hover:scale-110"
                      title="Deletar"
                    >
                      <FaTrash className="text-xl" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          )}
        </div>
      </div>

      {/* Modal: Ver Contas do Proxy */}
      {showAccountsModal && viewingProxy && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-dark-800 to-dark-900 border-2 border-cyan-500/30 rounded-2xl p-8 max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl shadow-cyan-500/20">
            {/* Header */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b-2 border-white/10">
              <div className="flex items-center gap-4">
                <div className="bg-gradient-to-br from-cyan-500 to-blue-600 p-3 rounded-xl">
                  <FaUsers className="text-2xl text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-white">Contas usando este Proxy</h2>
                  <p className="text-cyan-300 text-sm mt-1 font-bold">{viewingProxy.name}</p>
                </div>
              </div>
              <button
                onClick={() => setShowAccountsModal(false)}
                className="p-3 bg-white/10 hover:bg-white/20 rounded-xl transition-all border-2 border-white/20"
              >
                <FaTimes className="text-white text-xl" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {loadingAccounts ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="animate-spin rounded-full h-14 w-14 border-b-4 border-cyan-500 mb-4"></div>
                  <p className="text-white/60 text-base">Carregando contas...</p>
                </div>
              ) : proxyAccounts.length === 0 ? (
                <div className="text-center py-16">
                  <div className="bg-white/10 p-6 rounded-full inline-block mb-4">
                    <FaUsers className="text-5xl text-white/30" />
                  </div>
                  <p className="text-white font-bold text-lg mb-2">Nenhuma conta usando este proxy</p>
                  <p className="text-white/50 text-sm">Associe contas a este proxy nas configurações de cada conta</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-white/70 text-sm font-bold">
                      Total: <span className="text-cyan-300 text-base">{proxyAccounts.length}</span> conta(s)
                    </span>
                  </div>
                  <div className="space-y-3">
                    {proxyAccounts.map(account => (
                      <div
                        key={account.id}
                        className="flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-xl hover:border-cyan-500/30 transition-all"
                      >
                        <div className="bg-cyan-500/20 p-2 rounded-lg flex-shrink-0">
                          <FaPhone className="text-cyan-300 text-base" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-bold text-sm truncate">{account.name || 'Sem nome'}</p>
                          <p className="text-white/60 text-xs font-mono mt-0.5">{account.phone_number || '—'}</p>
                        </div>
                        <div className="flex-shrink-0">
                          {account.is_active ? (
                            <span className="px-3 py-1 bg-green-500/20 border border-green-500/40 text-green-300 text-xs font-bold rounded-full">
                              Ativa
                            </span>
                          ) : (
                            <span className="px-3 py-1 bg-gray-500/20 border border-gray-500/40 text-gray-300 text-xs font-bold rounded-full">
                              Inativa
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-3 mt-6 pt-4 border-t-2 border-white/10">
              <button
                onClick={() => setShowAccountsModal(false)}
                className="flex-1 px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition-all border-2 border-white/20 flex items-center justify-center gap-2"
              >
                <FaTimes /> Fechar
              </button>
              {proxyAccounts.length > 0 && (
                <button
                  onClick={handleOpenTransfer}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-orange-500/30 flex items-center justify-center gap-2"
                >
                  <FaExchangeAlt /> Transferir Contas
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Transferir Contas em Massa */}
      {showTransferModal && viewingProxy && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md flex items-center justify-center z-[60] p-4">
          <div className="bg-gradient-to-br from-dark-800 to-dark-900 border-2 border-orange-500/30 rounded-2xl p-8 max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl shadow-orange-500/20">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6 pb-4 border-b-2 border-white/10">
              <div className="bg-gradient-to-br from-orange-500 to-amber-600 p-3 rounded-xl">
                <FaExchangeAlt className="text-2xl text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-white">Transferir Contas em Massa</h2>
                <p className="text-orange-300 text-sm mt-1 font-bold">De: {viewingProxy.name}</p>
              </div>
            </div>

            {/* Proxy destino */}
            <div className="mb-5">
              <label className="block text-white font-bold text-sm mb-2 flex items-center gap-2">
                <FaGlobe className="text-orange-300" /> Proxy de Destino *
              </label>
              <select
                value={transferTargetProxyId}
                onChange={(e) => setTransferTargetProxyId(e.target.value)}
                className="w-full px-5 py-4 bg-dark-700 text-white text-base rounded-xl border-2 border-orange-500/30 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/20 transition-all cursor-pointer"
              >
                <option value="">-- Selecione o proxy de destino --</option>
                {proxies
                  .filter(p => p.id !== viewingProxy.id)
                  .map(p => (
                    <option key={p.id} value={p.id} className="bg-dark-700">
                      {p.name} {p.status === 'working' ? '✓' : p.status === 'failed' ? '✗' : '?'} — {p.accounts_count || 0} contas
                    </option>
                  ))}
              </select>
            </div>

            {/* Seleção de contas */}
            <div className="flex-1 overflow-y-auto min-h-0">
              <div className="flex items-center justify-between mb-3">
                <label className="text-white font-bold text-sm flex items-center gap-2">
                  <FaUsers className="text-orange-300" /> Contas a transferir
                </label>
                <button
                  onClick={handleSelectAllAccounts}
                  className="flex items-center gap-2 px-3 py-1.5 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/40 text-orange-300 text-xs font-bold rounded-lg transition-all"
                >
                  {selectedAccountIds.length === proxyAccounts.length ? (
                    <><FaCheckSquare /> Desmarcar todas</>
                  ) : (
                    <><FaSquare /> Selecionar todas</>
                  )}
                </button>
              </div>

              <div className="space-y-2">
                {proxyAccounts.map(account => (
                  <div
                    key={account.id}
                    onClick={() => handleToggleAccount(account.id)}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                      selectedAccountIds.includes(account.id)
                        ? 'bg-orange-500/15 border-orange-500/50'
                        : 'bg-white/5 border-white/10 hover:border-orange-500/30'
                    }`}
                  >
                    <div className={`flex-shrink-0 text-lg ${selectedAccountIds.includes(account.id) ? 'text-orange-400' : 'text-white/30'}`}>
                      {selectedAccountIds.includes(account.id) ? <FaCheckSquare /> : <FaSquare />}
                    </div>
                    <div className="bg-cyan-500/20 p-1.5 rounded-lg flex-shrink-0">
                      <FaPhone className="text-cyan-300 text-sm" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-sm truncate">{account.name || 'Sem nome'}</p>
                      <p className="text-white/50 text-xs font-mono">{account.phone_number || '—'}</p>
                    </div>
                    {account.is_active ? (
                      <span className="flex-shrink-0 px-2 py-0.5 bg-green-500/20 text-green-300 text-xs font-bold rounded-full">Ativa</span>
                    ) : (
                      <span className="flex-shrink-0 px-2 py-0.5 bg-gray-500/20 text-gray-400 text-xs font-bold rounded-full">Inativa</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Summary + Buttons */}
            <div className="mt-5 pt-4 border-t-2 border-white/10">
              <p className="text-white/60 text-sm mb-4">
                <span className="text-orange-300 font-black text-base">{selectedAccountIds.length}</span> conta(s) selecionada(s) para transferência
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowTransferModal(false)}
                  className="flex-1 px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition-all border-2 border-white/20 flex items-center justify-center gap-2"
                >
                  <FaTimes /> Cancelar
                </button>
                <button
                  onClick={handleTransferAccounts}
                  disabled={transferring || !transferTargetProxyId || selectedAccountIds.length === 0}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-orange-500/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {transferring ? (
                    <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Transferindo...</>
                  ) : (
                    <><FaExchangeAlt /> Confirmar Transferência</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Criar/Editar */}
      {showModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-dark-800 to-dark-900 border-2 border-primary-500/30 rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl shadow-primary-500/20">
            <div className="flex items-center gap-4 mb-8 pb-4 border-b-2 border-white/10">
              <div className="bg-gradient-to-br from-cyan-500 to-blue-600 p-3 rounded-xl">
                <FaGlobe className="text-3xl text-white" />
              </div>
              <div>
                <h2 className="text-3xl font-black text-white">
                  {editingProxy ? '✏️ Editar Proxy' : '➕ Novo Proxy'}
                </h2>
                <p className="text-white/60 text-sm mt-1">
                  {editingProxy ? 'Atualize as informações do proxy' : 'Adicione um novo proxy ao sistema'}
                </p>
              </div>
            </div>

            <div className="space-y-6">
              {/* Nome */}
              <div className="bg-white/5 border-2 border-white/10 rounded-xl p-4">
                <label className="block text-white font-bold text-base mb-3 flex items-center gap-2">
                  <span className="text-xl">📝</span> Nome *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Proxy Brasil SP 01"
                  className="w-full px-6 py-4 bg-dark-700 text-white text-base rounded-xl border-2 border-cyan-500/30 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/30 transition-all placeholder-white/40"
                />
              </div>

              {/* Tipo */}
              <div className="bg-white/5 border-2 border-white/10 rounded-xl p-4">
                <label className="block text-white font-bold text-base mb-3 flex items-center gap-2">
                  <span className="text-xl">🔧</span> Tipo de Proxy *
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-6 py-4 bg-dark-700 text-white text-base rounded-xl border-2 border-cyan-500/30 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/30 transition-all cursor-pointer"
                >
                  <option value="socks5" className="bg-dark-700">📍 Socks5 Fixo (Recomendado)</option>
                  <option value="http" className="bg-dark-700">📍 HTTP/HTTPS Fixo</option>
                  <option value="rotating" className="bg-dark-700">🔄 Rotativo (Múltiplos Proxies)</option>
                </select>
                {formData.type === 'rotating' && (
                  <p className="mt-3 text-yellow-300 text-sm bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                    ⚠️ <strong>Modo Rotativo:</strong> O sistema irá alternar automaticamente entre os proxies do pool no intervalo definido.
                  </p>
                )}
              </div>

              {/* PROXY FIXO: Host e Porta */}
              {formData.type !== 'rotating' && (
                <>
                  <div className="bg-white/5 border-2 border-white/10 rounded-xl p-4">
                    <label className="block text-white font-bold text-base mb-3 flex items-center gap-2">
                      <span className="text-xl">🌐</span> Servidor
                    </label>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="col-span-2">
                        <label className="block text-white/70 text-sm mb-2">Host / IP *</label>
                        <input
                          type="text"
                          value={formData.host}
                          onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                          placeholder="Ex: 191.5.153.178"
                          className="w-full px-6 py-4 bg-dark-700 text-white text-base font-mono rounded-xl border-2 border-cyan-500/30 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/30 transition-all placeholder-white/40"
                        />
                      </div>
                      <div>
                        <label className="block text-white/70 text-sm mb-2">Porta *</label>
                        <input
                          type="number"
                          value={formData.port}
                          onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                          placeholder="1080"
                          className="w-full px-6 py-4 bg-dark-700 text-white text-base font-mono rounded-xl border-2 border-cyan-500/30 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/30 transition-all placeholder-white/40"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Usuário e Senha */}
                  <div className="bg-white/5 border-2 border-white/10 rounded-xl p-4">
                    <label className="block text-white font-bold text-base mb-3 flex items-center gap-2">
                      <span className="text-xl">🔐</span> Autenticação (opcional)
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-white/70 text-sm mb-2">Usuário</label>
                        <input
                          type="text"
                          value={formData.username}
                          onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                          placeholder="usuario"
                          className="w-full px-6 py-4 bg-dark-700 text-white text-base font-mono rounded-xl border-2 border-cyan-500/30 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/30 transition-all placeholder-white/40"
                        />
                      </div>
                      <div>
                        <label className="block text-white/70 text-sm mb-2">Senha</label>
                        <input
                          type="password"
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          placeholder="••••••••"
                          className="w-full px-6 py-4 bg-dark-700 text-white text-base rounded-xl border-2 border-cyan-500/30 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/30 transition-all placeholder-white/40"
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* PROXY ROTATIVO: Pool de Proxies */}
              {formData.type === 'rotating' && (
                <>
                  {/* Intervalo de Rotação */}
                  <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-2 border-purple-500/30 rounded-xl p-6">
                    <label className="block text-white font-bold text-base mb-3 flex items-center gap-2">
                      <span className="text-xl">⏱️</span> Intervalo de Rotação
                    </label>
                    <div className="flex items-center gap-4">
                      <input
                        type="number"
                        min="1"
                        max="1440"
                        value={formData.rotation_interval}
                        onChange={(e) => setFormData({ ...formData, rotation_interval: parseInt(e.target.value) || 30 })}
                        className="w-32 px-6 py-4 bg-dark-700 text-white text-base font-bold text-center rounded-xl border-2 border-purple-500/30 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/30 transition-all"
                      />
                      <span className="text-white text-base font-bold">minutos</span>
                    </div>
                    <p className="text-white/60 text-sm mt-3">
                      O sistema irá trocar de proxy automaticamente a cada {formData.rotation_interval} minutos.
                    </p>
                  </div>

                  {/* Adicionar Proxy ao Pool */}
                  <div className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border-2 border-cyan-500/30 rounded-xl p-6">
                    <label className="block text-white font-bold text-lg mb-4 flex items-center gap-2">
                      <span className="text-2xl">🔄</span> Adicionar Proxy ao Pool
                    </label>
                    
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-2">
                          <label className="block text-white/70 text-sm mb-2">Host / IP *</label>
                          <input
                            type="text"
                            value={poolHost}
                            onChange={(e) => setPoolHost(e.target.value)}
                            placeholder="Ex: 191.5.153.178"
                            className="w-full px-4 py-3 bg-dark-700 text-white text-base font-mono rounded-xl border-2 border-cyan-500/30 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/30 transition-all placeholder-white/40"
                          />
                        </div>
                        <div>
                          <label className="block text-white/70 text-sm mb-2">Porta *</label>
                          <input
                            type="number"
                            value={poolPort}
                            onChange={(e) => setPoolPort(e.target.value)}
                            placeholder="1080"
                            className="w-full px-4 py-3 bg-dark-700 text-white text-base font-mono rounded-xl border-2 border-cyan-500/30 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/30 transition-all placeholder-white/40"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-white/70 text-sm mb-2">Usuário (opcional)</label>
                          <input
                            type="text"
                            value={poolUsername}
                            onChange={(e) => setPoolUsername(e.target.value)}
                            placeholder="usuario"
                            className="w-full px-4 py-3 bg-dark-700 text-white text-base font-mono rounded-xl border-2 border-cyan-500/30 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/30 transition-all placeholder-white/40"
                          />
                        </div>
                        <div>
                          <label className="block text-white/70 text-sm mb-2">Senha (opcional)</label>
                          <input
                            type="password"
                            value={poolPassword}
                            onChange={(e) => setPoolPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full px-4 py-3 bg-dark-700 text-white text-base rounded-xl border-2 border-cyan-500/30 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/30 transition-all placeholder-white/40"
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleAddToPool}
                        className="w-full px-6 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 transform hover:scale-105 flex items-center justify-center gap-2 text-base"
                      >
                        <FaPlus className="text-lg" /> Adicionar ao Pool
                      </button>
                    </div>
                  </div>

                  {/* Lista de Proxies no Pool */}
                  {formData.proxy_pool.length > 0 && (
                    <div className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-2 border-green-500/30 rounded-xl p-6">
                      <label className="block text-white font-bold text-lg mb-4 flex items-center gap-2">
                        <span className="text-2xl">📋</span> Proxies no Pool ({formData.proxy_pool.length})
                      </label>
                      
                      <div className="space-y-3">
                        {formData.proxy_pool.map((proxy, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between bg-dark-700/50 border border-green-500/20 rounded-xl p-4"
                          >
                            <div className="flex items-center gap-4">
                              <div className="bg-green-500/20 px-3 py-1 rounded-lg">
                                <span className="text-green-300 font-black text-sm">#{index + 1}</span>
                              </div>
                              <div>
                                <p className="text-white font-mono font-bold text-base">
                                  {proxy.host}:{proxy.port}
                                </p>
                                {proxy.username && (
                                  <p className="text-white/60 text-sm">
                                    🔐 Auth: {proxy.username}
                                  </p>
                                )}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveFromPool(index)}
                              className="p-3 bg-red-500/20 hover:bg-red-500/30 border-2 border-red-500/50 text-red-300 rounded-xl transition-all hover:scale-110"
                              title="Remover"
                            >
                              <FaTrash className="text-lg" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Localização */}
              <div className="bg-white/5 border-2 border-white/10 rounded-xl p-4">
                <label className="block text-white font-bold text-base mb-3 flex items-center gap-2">
                  <span className="text-xl">📍</span> Localização (opcional)
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="Ex: Brasil - São Paulo"
                  className="w-full px-6 py-4 bg-dark-700 text-white text-base rounded-xl border-2 border-cyan-500/30 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/30 transition-all placeholder-white/40"
                />
              </div>

              {/* Descrição */}
              <div className="bg-white/5 border-2 border-white/10 rounded-xl p-4">
                <label className="block text-white font-bold text-base mb-3 flex items-center gap-2">
                  <span className="text-xl">💬</span> Descrição (opcional)
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Notas sobre este proxy..."
                  rows={3}
                  className="w-full px-6 py-4 bg-dark-700 text-white text-base rounded-xl border-2 border-cyan-500/30 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/30 transition-all placeholder-white/40 resize-none"
                />
              </div>

              {/* Ativo */}
              <div className="flex items-center justify-between p-6 bg-gradient-to-r from-green-500/10 to-emerald-500/5 border-2 border-green-500/30 rounded-xl">
                <div>
                  <p className="text-white font-bold text-lg flex items-center gap-2">
                    <span className="text-2xl">⚡</span> Proxy Ativo
                  </p>
                  <p className="text-white/60 text-sm mt-1">Disponível para uso em contas do WhatsApp</p>
                </div>
                <button
                  onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                  className={`relative w-16 h-8 rounded-full transition-all shadow-lg ${
                    formData.is_active ? 'bg-gradient-to-r from-green-500 to-emerald-600 shadow-green-500/30' : 'bg-gray-600'
                  }`}
                >
                  <div
                    className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform shadow-md ${
                      formData.is_active ? 'translate-x-8' : ''
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Botões */}
            <div className="flex gap-4 mt-8 pt-6 border-t-2 border-white/10">
              <button
                onClick={handleCloseModal}
                className="flex-1 px-8 py-4 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white text-base font-bold rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <FaTimes className="text-lg" /> Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={!formData.name || !formData.host || !formData.port}
                className="flex-1 px-8 py-4 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white text-base font-bold rounded-xl transition-all shadow-lg shadow-primary-500/30 hover:shadow-primary-500/50 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
              >
                <FaSave className="text-lg" /> {editingProxy ? 'Atualizar' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

