import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { 
  FaChartLine, FaWhatsapp, FaPaperPlane, FaCheckCircle, 
  FaExclamationTriangle, FaEye, FaArrowLeft, FaSync, 
  FaCalendarAlt, FaFilter, FaClock, FaRocket, FaUser
} from 'react-icons/fa';
import api from '@/services/api';

interface UazStats {
  instances: {
    total: number;
    connected: number;
    disconnected: number;
  };
  campaign_messages: {
    total: number;
    sent: number;
    delivered: number;
    read: number;
    failed: number;
    total_campaigns: number;
  };
  unique_messages: {
    total: number;
    sent: number;
    delivered: number;
    read: number;
    failed: number;
  };
  recent_campaigns: Array<{
    id: number;
    name: string;
    status: string;
    total_contacts: number;
    sent_count: number;
    delivered_count: number;
    read_count: number;
    failed_count: number;
    created_at: string;
  }>;
  filters: {
    startDate: string | null;
    endDate: string | null;
    filterType: string;
  };
}

export default function DashboardStats() {
  const router = useRouter();
  const [stats, setStats] = useState<UazStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  
  // Estados para abas e filtros
  const [activeTab, setActiveTab] = useState<'campaign' | 'unique'>('campaign');
  const [filterType, setFilterType] = useState<'today' | 'custom' | 'all'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const loadStats = async () => {
    try {
      // Preparar parâmetros de filtro
      const params: any = {};
      
      if (filterType === 'today') {
        const today = new Date().toISOString().split('T')[0];
        params.startDate = today;
        params.endDate = today;
      } else if (filterType === 'custom' && startDate) {
        params.startDate = startDate;
        if (endDate) {
          params.endDate = endDate;
        }
      }

      console.log('📊 Carregando stats com filtros:', params);

      const response = await api.get('/uaz/stats', { params });
      if (response.data.success) {
        setStats(response.data.data);
        console.log('✅ Stats carregadas:', response.data.data);
      }
    } catch (error) {
      console.error('Erro ao carregar estatísticas UAZ:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, [filterType, startDate, endDate]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      loadStats();
    }, 5000); // 5 segundos

    return () => clearInterval(interval);
  }, [autoRefresh, filterType, startDate, endDate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-20 w-20 border-b-4 border-blue-500 mb-4"></div>
          <p className="text-2xl text-white/70">Carregando estatísticas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 py-8 px-4">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* CABEÇALHO */}
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-600/30 via-indigo-500/20 to-blue-600/30 backdrop-blur-xl border-2 border-blue-500/40 rounded-3xl p-10 shadow-2xl shadow-blue-500/20">
          <div className="absolute inset-0 bg-grid-white/[0.02]"></div>
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl"></div>
          
          <div className="relative flex items-center gap-6">
            {/* Botão Voltar */}
            <button
              onClick={() => router.push('/dashboard-uaz')}
              className="bg-white/10 hover:bg-white/20 p-4 rounded-xl transition-all duration-200 border-2 border-white/20 hover:border-white/40"
              title="Voltar ao Dashboard UAZ"
            >
              <FaArrowLeft className="text-3xl text-white" />
            </button>

            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-6 rounded-2xl shadow-lg shadow-blue-500/50">
              <FaChartLine className="text-6xl text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-6xl font-black text-white mb-2 tracking-tight">
                Dashboard
              </h1>
              <p className="text-2xl text-white/80 font-medium">
                Estatísticas WhatsApp QR Connect
              </p>
            </div>

            {/* Atualização Automática */}
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center gap-3 px-6 py-4 rounded-xl text-lg font-bold transition-all duration-200 ${
                autoRefresh 
                  ? 'bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/40' 
                  : 'bg-white/10 hover:bg-white/20 text-white/70 border-2 border-white/20'
              }`}
            >
              <FaSync className={autoRefresh ? 'animate-spin' : ''} />
              Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>

        {/* FILTROS DE DATA */}
        <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-purple-500/30 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <FaFilter className="text-purple-400 text-2xl" />
            <h3 className="text-2xl font-black text-white">Filtros de Data</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Botão: Todos */}
            <button
              onClick={() => {
                setFilterType('all');
                setStartDate('');
                setEndDate('');
              }}
              className={`px-6 py-3 rounded-xl font-bold transition-all ${
                filterType === 'all'
                  ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/40'
                  : 'bg-white/10 text-white/70 hover:bg-white/20'
              }`}
            >
              <FaClock className="inline mr-2" />
              Todos os Períodos
            </button>

            {/* Botão: Hoje */}
            <button
              onClick={() => setFilterType('today')}
              className={`px-6 py-3 rounded-xl font-bold transition-all ${
                filterType === 'today'
                  ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/40'
                  : 'bg-white/10 text-white/70 hover:bg-white/20'
              }`}
            >
              <FaCalendarAlt className="inline mr-2" />
              Hoje
            </button>

            {/* Filtro Customizado */}
            <div className="col-span-2 flex items-center gap-3">
              <button
                onClick={() => setFilterType('custom')}
                className={`px-6 py-3 rounded-xl font-bold transition-all whitespace-nowrap ${
                  filterType === 'custom'
                    ? 'bg-green-500 text-white shadow-lg shadow-green-500/40'
                    : 'bg-white/10 text-white/70 hover:bg-white/20'
                }`}
              >
                Período
              </button>
              
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setFilterType('custom');
                }}
                className="flex-1 px-4 py-3 rounded-xl bg-white/10 border-2 border-white/20 text-white font-semibold focus:border-green-500 focus:outline-none"
                placeholder="Data Início"
              />
              
              <span className="text-white/50 font-bold">até</span>
              
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setFilterType('custom');
                }}
                className="flex-1 px-4 py-3 rounded-xl bg-white/10 border-2 border-white/20 text-white font-semibold focus:border-green-500 focus:outline-none"
                placeholder="Data Fim"
              />
            </div>
          </div>
        </div>

        {/* ESTATÍSTICAS */}
        {stats && (
          <div className="space-y-6">
            {/* INSTÂNCIAS */}
            <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-white/10 rounded-2xl overflow-hidden">
              <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-b-2 border-blue-500/30 p-8">
                <h3 className="text-3xl font-black text-white flex items-center gap-3">
                  <FaWhatsapp className="text-blue-400 text-4xl" />
                  Instâncias
                </h3>
              </div>
              <div className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm rounded-2xl p-8 border-2 border-white/20 hover:border-white/40 transition-all text-center">
                    <div className="text-6xl font-black text-white mb-3">{stats.instances.total}</div>
                    <div className="text-xl text-white/70 font-bold">Total</div>
                  </div>
                  <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/10 backdrop-blur-sm rounded-2xl p-8 border-2 border-green-500/30 hover:border-green-500/50 transition-all text-center">
                    <div className="text-6xl font-black text-green-300 mb-3">{stats.instances.connected}</div>
                    <div className="text-xl text-white/70 font-bold flex items-center justify-center gap-2">
                      <FaCheckCircle />
                      Conectadas
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-red-500/20 to-red-600/10 backdrop-blur-sm rounded-2xl p-8 border-2 border-red-500/30 hover:border-red-500/50 transition-all text-center">
                    <div className="text-6xl font-black text-red-300 mb-3">{stats.instances.disconnected}</div>
                    <div className="text-xl text-white/70 font-bold">Desconectadas</div>
                  </div>
                </div>
              </div>
            </div>

            {/* ABAS DE MENSAGENS */}
            <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-white/10 rounded-2xl overflow-hidden">
              {/* TABS */}
              <div className="flex border-b-2 border-white/10">
                <button
                  onClick={() => setActiveTab('campaign')}
                  className={`flex-1 px-8 py-6 text-xl font-black transition-all ${
                    activeTab === 'campaign'
                      ? 'bg-gradient-to-br from-purple-500/20 to-purple-600/10 text-purple-300 border-b-4 border-purple-500'
                      : 'text-white/50 hover:text-white/80 hover:bg-white/5'
                  }`}
                >
                  <FaRocket className="inline mr-3 text-2xl" />
                  Mensagens por Campanha
                </button>
                <button
                  onClick={() => setActiveTab('unique')}
                  className={`flex-1 px-8 py-6 text-xl font-black transition-all ${
                    activeTab === 'unique'
                      ? 'bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 text-cyan-300 border-b-4 border-cyan-500'
                      : 'text-white/50 hover:text-white/80 hover:bg-white/5'
                  }`}
                >
                  <FaUser className="inline mr-3 text-2xl" />
                  Mensagens Únicas
                </button>
              </div>

              {/* CONTEÚDO DAS ABAS */}
              <div className="p-8">
                {activeTab === 'campaign' ? (
                  <div className="space-y-6">
                    {/* Stats de Campanhas */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                      <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 backdrop-blur-sm rounded-2xl p-6 border-2 border-purple-500/30 hover:border-purple-500/50 transition-all text-center">
                        <div className="text-5xl font-black text-purple-300 mb-2">{stats.campaign_messages.total}</div>
                        <div className="text-lg text-white/70 font-bold">Total</div>
                      </div>
                      <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 backdrop-blur-sm rounded-2xl p-6 border-2 border-blue-500/30 hover:border-blue-500/50 transition-all text-center">
                        <div className="text-5xl font-black text-blue-300 mb-2">{stats.campaign_messages.sent}</div>
                        <div className="text-lg text-white/70 font-bold flex items-center justify-center gap-2">
                          <FaPaperPlane />
                          Enviadas
                        </div>
                      </div>
                      <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/10 backdrop-blur-sm rounded-2xl p-6 border-2 border-green-500/30 hover:border-green-500/50 transition-all text-center">
                        <div className="text-5xl font-black text-green-300 mb-2">{stats.campaign_messages.delivered}</div>
                        <div className="text-lg text-white/70 font-bold flex items-center justify-center gap-2">
                          <FaCheckCircle />
                          Entregues
                        </div>
                      </div>
                      <div className="bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 backdrop-blur-sm rounded-2xl p-6 border-2 border-cyan-500/30 hover:border-cyan-500/50 transition-all text-center">
                        <div className="text-5xl font-black text-cyan-300 mb-2">{stats.campaign_messages.read}</div>
                        <div className="text-lg text-white/70 font-bold flex items-center justify-center gap-2">
                          <FaEye />
                          Lidas
                        </div>
                      </div>
                      <div className="bg-gradient-to-br from-red-500/20 to-red-600/10 backdrop-blur-sm rounded-2xl p-6 border-2 border-red-500/30 hover:border-red-500/50 transition-all text-center">
                        <div className="text-5xl font-black text-red-300 mb-2">{stats.campaign_messages.failed}</div>
                        <div className="text-lg text-white/70 font-bold flex items-center justify-center gap-2">
                          <FaExclamationTriangle />
                          Falhas
                        </div>
                      </div>
                    </div>

                    {/* Total de Campanhas */}
                    <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-2 border-purple-500/30 rounded-xl p-6">
                      <div className="flex items-center justify-between">
                        <span className="text-2xl text-white/70 font-bold">Total de Campanhas:</span>
                        <span className="text-4xl font-black text-purple-300">{stats.campaign_messages.total_campaigns}</span>
                      </div>
                    </div>

                    {/* Campanhas Recentes */}
                    {stats.recent_campaigns.length > 0 && (
                      <div className="bg-white/5 border-2 border-white/10 rounded-xl p-6">
                        <h4 className="text-xl font-black text-white mb-4 flex items-center gap-2">
                          <FaChartLine />
                          Campanhas Recentes
                        </h4>
                        <div className="space-y-3">
                          {stats.recent_campaigns.map((campaign) => (
                            <div
                              key={campaign.id}
                              className="bg-white/5 rounded-lg p-4 hover:bg-white/10 transition-all"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-bold text-white">{campaign.name}</span>
                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                  campaign.status === 'completed' ? 'bg-green-500/20 text-green-300' :
                                  campaign.status === 'running' ? 'bg-blue-500/20 text-blue-300' :
                                  campaign.status === 'paused' ? 'bg-yellow-500/20 text-yellow-300' :
                                  'bg-gray-500/20 text-gray-300'
                                }`}>
                                  {campaign.status === 'completed' ? 'Concluída' :
                                   campaign.status === 'running' ? 'Em Andamento' :
                                   campaign.status === 'paused' ? 'Pausada' :
                                   campaign.status}
                                </span>
                              </div>
                              <div className="grid grid-cols-4 gap-3 text-sm">
                                <div>
                                  <span className="text-white/50">Enviadas:</span>
                                  <span className="ml-2 text-blue-300 font-bold">{campaign.sent_count || 0}</span>
                                </div>
                                <div>
                                  <span className="text-white/50">Entregues:</span>
                                  <span className="ml-2 text-green-300 font-bold">{campaign.delivered_count || 0}</span>
                                </div>
                                <div>
                                  <span className="text-white/50">Lidas:</span>
                                  <span className="ml-2 text-cyan-300 font-bold">{campaign.read_count || 0}</span>
                                </div>
                                <div>
                                  <span className="text-white/50">Falhas:</span>
                                  <span className="ml-2 text-red-300 font-bold">{campaign.failed_count || 0}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Stats de Mensagens Únicas */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                      <div className="bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 backdrop-blur-sm rounded-2xl p-6 border-2 border-cyan-500/30 hover:border-cyan-500/50 transition-all text-center">
                        <div className="text-5xl font-black text-cyan-300 mb-2">{stats.unique_messages.total}</div>
                        <div className="text-lg text-white/70 font-bold">Total</div>
                      </div>
                      <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 backdrop-blur-sm rounded-2xl p-6 border-2 border-blue-500/30 hover:border-blue-500/50 transition-all text-center">
                        <div className="text-5xl font-black text-blue-300 mb-2">{stats.unique_messages.sent}</div>
                        <div className="text-lg text-white/70 font-bold flex items-center justify-center gap-2">
                          <FaPaperPlane />
                          Enviadas
                        </div>
                      </div>
                      <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/10 backdrop-blur-sm rounded-2xl p-6 border-2 border-green-500/30 hover:border-green-500/50 transition-all text-center">
                        <div className="text-5xl font-black text-green-300 mb-2">{stats.unique_messages.delivered}</div>
                        <div className="text-lg text-white/70 font-bold flex items-center justify-center gap-2">
                          <FaCheckCircle />
                          Entregues
                        </div>
                      </div>
                      <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 backdrop-blur-sm rounded-2xl p-6 border-2 border-purple-500/30 hover:border-purple-500/50 transition-all text-center">
                        <div className="text-5xl font-black text-purple-300 mb-2">{stats.unique_messages.read}</div>
                        <div className="text-lg text-white/70 font-bold flex items-center justify-center gap-2">
                          <FaEye />
                          Lidas
                        </div>
                      </div>
                      <div className="bg-gradient-to-br from-red-500/20 to-red-600/10 backdrop-blur-sm rounded-2xl p-6 border-2 border-red-500/30 hover:border-red-500/50 transition-all text-center">
                        <div className="text-5xl font-black text-red-300 mb-2">{stats.unique_messages.failed}</div>
                        <div className="text-lg text-white/70 font-bold flex items-center justify-center gap-2">
                          <FaExclamationTriangle />
                          Falhas
                        </div>
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border-2 border-cyan-500/30 rounded-xl p-6 text-center">
                      <p className="text-white/70 text-lg">
                        Mensagens enviadas individualmente, fora de campanhas
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

