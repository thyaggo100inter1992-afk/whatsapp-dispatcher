import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { FaEnvelope, FaCheckCircle, FaTimesCircle, FaClock, FaGlobe, FaFilter, FaSearch, FaArrowLeft } from 'react-icons/fa';
import { format } from 'date-fns';
import { useToast } from '@/hooks/useToast';
import ToastContainer from '@/components/ToastContainer';
import api from '@/services/api';

interface Message {
  id: number;
  phone_number: string;
  template_name: string;
  status: string;
  sent_at?: string;
  delivered_at?: string;
  read_at?: string;
  failed_at?: string;
  error_message?: string;
  whatsapp_message_id?: string;
  campaign_id?: number;
  campaign_name?: string;
  whatsapp_account_id: number;
  account_name?: string;
  proxy_used?: boolean;
  proxy_host?: string;
  proxy_type?: string;
  created_at: string;
  user_id?: number;
  user_name?: string;
}

export default function MensagensPage() {
  const router = useRouter();
  const { toasts, removeToast, success, error } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [proxyFilter, setProxyFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [users, setUsers] = useState<Array<{ id: number; nome: string }>>([]);
  const [page, setPage] = useState(1);
  const [totalMessages, setTotalMessages] = useState(0);
  const limit = 50;

  useEffect(() => {
    loadMessages();
  }, [page]);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const response = await api.get('/uaz/tenant/users');
      if (response.data.success) {
        setUsers(response.data.data || []);
      }
    } catch (err) {
      console.error('Erro ao carregar usuários:', err);
    }
  };

  const loadMessages = async () => {
    setLoading(true);
    try {
      const offset = (page - 1) * limit;
      let url = `/messages?limit=${limit}&offset=${offset}`;
      
      if (dateStart) url += `&date_start=${dateStart}`;
      if (dateEnd) url += `&date_end=${dateEnd}`;
      if (userFilter !== 'all') url += `&user_id=${userFilter}`;
      
      const response = await api.get(url);
      
      if (response.data.success) {
        setMessages(response.data.data || []);
        setTotalMessages(response.data.total || 0);
      } else {
        error('Erro ao carregar mensagens');
      }
    } catch (err) {
      console.error('Erro ao carregar mensagens:', err);
      error('Erro ao carregar mensagens');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilters = () => {
    setPage(1); // Reset para primeira página
    loadMessages();
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      return format(new Date(dateString), 'dd/MM/yyyy HH:mm:ss');
    } catch {
      return '-';
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: { [key: string]: JSX.Element } = {
      sent: (
        <span className="px-4 py-2 bg-gradient-to-r from-blue-500/20 to-blue-600/20 border-2 border-blue-500/50 text-blue-300 rounded-full text-sm font-bold inline-flex items-center gap-2">
          <FaClock className="text-base" /> 📤 Enviada
        </span>
      ),
      delivered: (
        <span className="px-4 py-2 bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-2 border-green-500/50 text-green-300 rounded-full text-sm font-bold inline-flex items-center gap-2">
          <FaCheckCircle className="text-base" /> ✅ Entregue
        </span>
      ),
      read: (
        <span className="px-4 py-2 bg-gradient-to-r from-purple-500/20 to-violet-500/20 border-2 border-purple-500/50 text-purple-300 rounded-full text-sm font-bold inline-flex items-center gap-2">
          <FaCheckCircle className="text-base" /> 👀 Lida
        </span>
      ),
      failed: (
        <span className="px-4 py-2 bg-gradient-to-r from-red-500/20 to-rose-500/20 border-2 border-red-500/50 text-red-300 rounded-full text-sm font-bold inline-flex items-center gap-2">
          <FaTimesCircle className="text-base" /> ❌ Falhou
        </span>
      ),
      pending: (
        <span className="px-4 py-2 bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border-2 border-yellow-500/50 text-yellow-300 rounded-full text-sm font-bold inline-flex items-center gap-2">
          <FaClock className="text-base" /> ⏳ Pendente
        </span>
      ),
    };
    return badges[status] || <span className="text-white/40">-</span>;
  };

  // Filtros
  const filteredMessages = messages.filter((message) => {
    // Filtro de busca
    const matchesSearch = 
      message.phone_number.includes(searchTerm) ||
      message.template_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (message.account_name && message.account_name.toLowerCase().includes(searchTerm.toLowerCase()));

    // Filtro de status
    const matchesStatus = statusFilter === 'all' || message.status === statusFilter;

    // Filtro de proxy
    const matchesProxy = 
      proxyFilter === 'all' ||
      (proxyFilter === 'proxy' && message.proxy_used) ||
      (proxyFilter === 'direct' && !message.proxy_used);

    return matchesSearch && matchesStatus && matchesProxy;
  });

  const totalPages = Math.ceil(totalMessages / limit);

  return (
    <>
      <ToastContainer toasts={toasts} onClose={removeToast} />
      
      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900">
        {/* Background Pattern */}
        <div className="fixed inset-0 opacity-5 pointer-events-none">
          <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
            backgroundSize: '40px 40px'
          }}></div>
        </div>

        <div className="relative max-w-[1800px] mx-auto p-6">
          {/* Header Moderno */}
          <div className="mb-8 pb-6 border-b-2 border-white/10">
            <div className="flex items-center gap-4">
              {/* Botão Voltar */}
              <button
                onClick={() => router.push('/dashboard-oficial')}
                className="bg-white/10 hover:bg-white/20 p-3 rounded-xl transition-all duration-200 border-2 border-white/20 hover:border-white/40"
                title="Voltar para o Dashboard API Oficial"
              >
                <FaArrowLeft className="text-2xl text-white" />
              </button>
              
              <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-4 rounded-xl shadow-lg">
                <FaEnvelope className="text-4xl text-white" />
              </div>
              <div>
                <h1 className="text-5xl font-black text-white">
                  Histórico de Mensagens
                </h1>
                <p className="text-white/60 text-lg mt-1">
                  Todas as mensagens enviadas (campanhas e envios rápidos)
                </p>
              </div>
            </div>
          </div>

          {/* Filtros */}
          <div className="bg-gradient-to-br from-white/10 to-white/5 border-2 border-white/20 rounded-xl p-8 mb-8 shadow-lg">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-blue-500/20 p-3 rounded-xl">
                <FaFilter className="text-2xl text-blue-300" />
              </div>
              <h2 className="text-2xl font-bold text-white">Filtros de Busca</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
              {/* Busca */}
              <div className="lg:col-span-3 bg-white/5 border-2 border-white/10 rounded-xl p-4">
                <label className="block text-white font-bold text-base mb-3 flex items-center gap-2">
                  <FaSearch className="text-lg" />
                  Buscar
                </label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Número, template ou conta..."
                  className="w-full px-6 py-4 bg-dark-700 text-white text-base rounded-xl border-2 border-green-500/30 focus:border-green-500 focus:ring-4 focus:ring-green-500/30 transition-all placeholder-white/40"
                />
              </div>

              {/* Filtro de Status */}
              <div className="bg-white/5 border-2 border-white/10 rounded-xl p-4">
                <label className="block text-white font-bold text-base mb-3 flex items-center gap-2">
                  <FaFilter className="text-lg" />
                  Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-6 py-4 bg-dark-700 text-white text-base rounded-xl border-2 border-green-500/30 focus:border-green-500 focus:ring-4 focus:ring-green-500/30 transition-all cursor-pointer"
                >
                  <option value="all" className="bg-dark-700">📋 Todos</option>
                  <option value="sent" className="bg-dark-700">📤 Enviada</option>
                  <option value="delivered" className="bg-dark-700">✅ Entregue</option>
                  <option value="read" className="bg-dark-700">👀 Lida</option>
                  <option value="failed" className="bg-dark-700">❌ Falhou</option>
                  <option value="pending" className="bg-dark-700">⏳ Pendente</option>
                </select>
              </div>

              {/* Filtro de Proxy */}
              <div className="bg-white/5 border-2 border-white/10 rounded-xl p-4">
                <label className="block text-white font-bold text-base mb-3 flex items-center gap-2">
                  <FaGlobe className="text-lg" />
                  Conexão
                </label>
                <select
                  value={proxyFilter}
                  onChange={(e) => setProxyFilter(e.target.value)}
                  className="w-full px-6 py-4 bg-dark-700 text-white text-base rounded-xl border-2 border-green-500/30 focus:border-green-500 focus:ring-4 focus:ring-green-500/30 transition-all cursor-pointer"
                >
                  <option value="all" className="bg-dark-700">🌐 Todos</option>
                  <option value="proxy" className="bg-dark-700">🔒 Com Proxy</option>
                  <option value="direct" className="bg-dark-700">🔓 Direto</option>
                </select>
              </div>

              {/* Filtro de Usuário */}
              <div className="bg-white/5 border-2 border-white/10 rounded-xl p-4">
                <label className="block text-white font-bold text-base mb-3 flex items-center gap-2">
                  👤 Usuário
                </label>
                <select
                  value={userFilter}
                  onChange={(e) => setUserFilter(e.target.value)}
                  className="w-full px-6 py-4 bg-dark-700 text-white text-base rounded-xl border-2 border-green-500/30 focus:border-green-500 focus:ring-4 focus:ring-green-500/30 transition-all cursor-pointer"
                >
                  <option value="all" className="bg-dark-700">👥 Todos</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id} className="bg-dark-700">
                      👤 {user.nome}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filtro Data Início */}
              <div className="bg-white/5 border-2 border-white/10 rounded-xl p-4">
                <label className="block text-white font-bold text-base mb-3 flex items-center gap-2">
                  📅 Data Início
                </label>
                <input
                  type="date"
                  value={dateStart}
                  onChange={(e) => setDateStart(e.target.value)}
                  className="w-full px-6 py-4 bg-dark-700 text-white text-base rounded-xl border-2 border-green-500/30 focus:border-green-500 focus:ring-4 focus:ring-green-500/30 transition-all"
                />
              </div>

              {/* Filtro Data Fim */}
              <div className="bg-white/5 border-2 border-white/10 rounded-xl p-4">
                <label className="block text-white font-bold text-base mb-3 flex items-center gap-2">
                  📅 Data Fim
                </label>
                <input
                  type="date"
                  value={dateEnd}
                  onChange={(e) => setDateEnd(e.target.value)}
                  className="w-full px-6 py-4 bg-dark-700 text-white text-base rounded-xl border-2 border-green-500/30 focus:border-green-500 focus:ring-4 focus:ring-green-500/30 transition-all"
                />
              </div>

              {/* Botão Aplicar Filtros */}
              <div className="bg-white/5 border-2 border-white/10 rounded-xl p-4 flex items-end">
                <button
                  onClick={handleApplyFilters}
                  className="w-full px-6 py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold text-base rounded-xl transition-all shadow-lg"
                >
                  🔍 Aplicar Filtros
                </button>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 border-2 border-blue-500/40 p-8 rounded-xl hover:scale-105 transition-transform shadow-lg shadow-blue-500/20">
              <div className="text-blue-300 text-lg font-bold mb-3 flex items-center gap-2">
                <span className="text-3xl">📊</span> Total
              </div>
              <div className="text-5xl font-black text-white">{totalMessages}</div>
              <div className="text-blue-200/60 text-sm mt-2">mensagens enviadas</div>
            </div>
            <div className="bg-gradient-to-br from-green-500/20 to-green-600/20 border-2 border-green-500/40 p-8 rounded-xl hover:scale-105 transition-transform shadow-lg shadow-green-500/20">
              <div className="text-green-300 text-lg font-bold mb-3 flex items-center gap-2">
                <span className="text-3xl">🔒</span> Com Proxy
              </div>
              <div className="text-5xl font-black text-white">
                {messages.filter(m => m.proxy_used).length}
              </div>
              <div className="text-green-200/60 text-sm mt-2">via proxy</div>
            </div>
            <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/20 border-2 border-purple-500/40 p-8 rounded-xl hover:scale-105 transition-transform shadow-lg shadow-purple-500/20">
              <div className="text-purple-300 text-lg font-bold mb-3 flex items-center gap-2">
                <span className="text-3xl">🔓</span> Direto
              </div>
              <div className="text-5xl font-black text-white">
                {messages.filter(m => !m.proxy_used).length}
              </div>
              <div className="text-purple-200/60 text-sm mt-2">conexão direta</div>
            </div>
            <div className="bg-gradient-to-br from-red-500/20 to-red-600/20 border-2 border-red-500/40 p-8 rounded-xl hover:scale-105 transition-transform shadow-lg shadow-red-500/20">
              <div className="text-red-300 text-lg font-bold mb-3 flex items-center gap-2">
                <span className="text-3xl">❌</span> Falhas
              </div>
              <div className="text-5xl font-black text-white">
                {messages.filter(m => m.status === 'failed').length}
              </div>
              <div className="text-red-200/60 text-sm mt-2">não enviadas</div>
            </div>
          </div>

          {/* Tabela */}
          <div className="bg-gradient-to-br from-white/10 to-white/5 border-2 border-white/20 rounded-xl overflow-hidden shadow-lg">
            {loading ? (
              <div className="text-center p-20">
                <div className="animate-spin rounded-full h-20 w-20 border-b-4 border-primary-500 mx-auto mb-6"></div>
                <p className="text-white text-xl font-bold">Carregando mensagens...</p>
              </div>
            ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-green-600/30 to-emerald-600/30 border-b-2 border-white/20">
                      <th className="text-left p-5 text-base font-black text-white">📱 Número</th>
                      <th className="text-left p-5 text-base font-black text-white">📄 Template</th>
                      <th className="text-left p-5 text-base font-black text-white">💼 Conta</th>
                      <th className="text-left p-5 text-base font-black text-white">📊 Campanha</th>
                      <th className="text-left p-5 text-base font-black text-white">👤 Usuário</th>
                      <th className="text-center p-5 text-base font-black text-white">🌐 Proxy</th>
                      <th className="text-left p-5 text-base font-black text-white">📈 Status</th>
                      <th className="text-left p-5 text-base font-black text-white">⏰ Enviada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMessages.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center p-20">
                          <div className="bg-white/5 border-2 border-dashed border-white/20 rounded-xl p-16">
                            <div className="bg-white/10 p-8 rounded-full inline-block mb-6">
                              <span className="text-8xl">📭</span>
                            </div>
                            <p className="text-2xl text-white font-bold mb-2">Nenhuma mensagem encontrada</p>
                            <p className="text-white/60 text-base">Tente ajustar os filtros ou envie novas mensagens</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredMessages.map((message) => (
                        <tr key={message.id} className="border-b border-white/10 hover:bg-white/5 transition-all">
                          <td className="p-5 font-mono font-bold text-white">{message.phone_number}</td>
                          <td className="p-5 text-white/90 font-medium">{message.template_name}</td>
                          <td className="p-5">
                            <span className="text-cyan-300 font-bold bg-cyan-500/10 px-3 py-1 rounded-lg">
                              {message.account_name || '-'}
                            </span>
                          </td>
                          <td className="p-5 text-white/70 text-sm">
                            {message.campaign_name || (message.campaign_id ? `#${message.campaign_id}` : '⚡ Envio Rápido')}
                          </td>
                          <td className="p-5">
                            <span className="text-purple-300 font-semibold bg-purple-500/10 px-3 py-1 rounded-lg">
                              👤 {message.user_name || 'Sistema'}
                            </span>
                          </td>
                          <td className="p-5 text-center">
                            {message.proxy_used ? (
                              <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-2 border-green-500/50 rounded-full">
                                <FaGlobe className="text-green-300 text-base" />
                                <span className="text-sm text-green-300 font-bold" title={`${message.proxy_host} (${message.proxy_type})`}>
                                  🔒 Proxy
                                </span>
                              </div>
                            ) : (
                              <span className="text-white/40 text-sm font-bold">🔓 Direto</span>
                            )}
                          </td>
                          <td className="p-5">{getStatusBadge(message.status)}</td>
                          <td className="p-5 text-sm text-white/70 font-mono">
                            {formatDate(message.sent_at || message.created_at)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Paginação */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between p-8 border-t-2 border-white/20 bg-white/5">
                  <div className="text-white font-bold text-base">
                    📄 Página <span className="text-primary-400">{page}</span> de <span className="text-primary-400">{totalPages}</span> • 
                    <span className="text-white/70 ml-2">Total: <span className="text-white">{totalMessages}</span> mensagens</span>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-6 py-3 bg-gradient-to-r from-primary-500/20 to-primary-600/10 hover:from-primary-500/30 hover:to-primary-600/20 border-2 border-primary-500/50 text-primary-200 font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed text-base"
                    >
                      ⬅️ Anterior
                    </button>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="px-6 py-3 bg-gradient-to-r from-primary-500/20 to-primary-600/10 hover:from-primary-500/30 hover:to-primary-600/20 border-2 border-primary-500/50 text-primary-200 font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed text-base"
                    >
                      Próxima ➡️
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
          </div>
        </div>
      </div>
    </>
  );
}

