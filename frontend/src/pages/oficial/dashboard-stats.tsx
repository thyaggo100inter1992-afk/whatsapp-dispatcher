import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { 
  FaPaperPlane, FaSync, FaChartLine, 
  FaCheckCircle, FaPauseCircle, FaTimesCircle, FaWhatsapp, FaUsers, 
  FaEye, FaExclamationTriangle, FaChartBar, FaUserCircle, FaEnvelope, FaRocket, FaArrowLeft
} from 'react-icons/fa';
import api from '@/services/api';

interface DashboardStats {
  campaigns: {
    total: number;
    active: number;
    completed: number;
    paused: number;
    cancelled: number;
  };
  messages: {
    total_sent: number;
    total_delivered: number;
    total_read: number;
    total_failed: number;
    total_no_whatsapp: number;
    total_button_clicks: number;
    total_contacts: number;
    unique_buttons?: number;
    unique_click_contacts?: number;
  };
  accounts: {
    total: number;
    active: number;
    inactive: number;
  };
  rates: {
    delivery: number;
    read: number;
    failure: number;
  };
  recent_campaigns: any[];
}

interface ImmediateMessagesStats {
  total_sent: number;
  total_delivered: number;
  total_read: number;
  total_failed: number;
  unique_contacts: number;
  button_clicks?: {
    total_clicks: number;
    unique_buttons: number;
    unique_contacts: number;
  };
  rates: {
    delivery: number;
    read: number;
    failure: number;
  };
}

export default function DashboardStats() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [immediateStats, setImmediateStats] = useState<ImmediateMessagesStats | null>(null);
  const [immediateLog, setImmediateLog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<'today' | 'custom'>('today');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [activeTab, setActiveTab] = useState<'campaigns' | 'immediate'>('campaigns');

  // Valores padrão para evitar erros ao renderizar antes dos dados chegarem
  const safeStats = stats || {
    campaigns: { total: 0, active: 0, completed: 0, paused: 0, cancelled: 0 },
    messages: { total_sent: 0, total_delivered: 0, total_read: 0, total_failed: 0, total_no_whatsapp: 0, total_button_clicks: 0, total_contacts: 0 },
    accounts: { total: 0, active: 0, inactive: 0 },
    rates: { delivery: 0, read: 0, failure: 0 },
    recent_campaigns: []
  };

  const safeImmediateStats = immediateStats || {
    total_sent: 0,
    total_delivered: 0,
    total_read: 0,
    total_failed: 0,
    unique_contacts: 0,
    rates: { delivery: 0, read: 0, failure: 0 }
  };

  const loadStats = async () => {
    try {
      const params: any = {};
      
      if (filterType === 'today') {
        params.startDate = new Date().toISOString().split('T')[0];
      } else if (filterType === 'custom' && startDate && endDate) {
        params.startDate = startDate;
        params.endDate = endDate;
      }

      const response = await api.get('/dashboard/stats', { params });
      if (response.data.success) {
        setStats(response.data.data);
      }

      const immediateResponse = await api.get('/dashboard/immediate-stats', { params });
      if (immediateResponse.data.success) {
        setImmediateStats(immediateResponse.data.data);
      }

      const logParams = { ...params, limit: 50 };
      const logResponse = await api.get('/dashboard/immediate-log', { params: logParams });
      if (logResponse.data.success) {
        setImmediateLog(logResponse.data.data.messages || []);
      }
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
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
    }, 3001);

    return () => clearInterval(interval);
  }, [autoRefresh, filterType, startDate, endDate]);

  const formatNumber = (num: number | undefined | null) => {
    if (num === undefined || num === null || isNaN(num)) return '0';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const getStatusBadge = (status: string) => {
    const statusMap: any = {
      outside_hours: { label: '🌙 Fora do Horário', color: 'bg-blue-500' },
      pause_programmed: { label: '⏸️ Pausa Programada', color: 'bg-orange-500' },
      sending: { label: '🔄 Enviando', color: 'bg-green-500' },
      running: { label: 'Em Execucao', color: 'bg-green-500' },
      completed: { label: 'Concluída', color: 'bg-blue-500' },
      paused: { label: 'Pausada', color: 'bg-yellow-500' },
      cancelled: { label: 'Cancelada', color: 'bg-red-500' },
      pending: { label: 'Pendente', color: 'bg-gray-500' },
      scheduled: { label: 'Agendada', color: 'bg-purple-500' }
    };

    const statusInfo = statusMap[status] || { label: status, color: 'bg-gray-500' };

    return (
      <span className={`${statusInfo.color} text-white text-xs px-3 py-1 rounded-full font-medium`}>
        {statusInfo.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-20 w-20 border-b-4 border-primary-500 mb-4"></div>
          <p className="text-2xl text-white/70">Carregando estatísticas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 py-8 px-4">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* HERO SECTION - CABEÇALHO */}
        <div className="relative overflow-hidden bg-gradient-to-r from-purple-600/30 via-pink-500/20 to-purple-600/30 backdrop-blur-xl border-2 border-purple-500/40 rounded-3xl p-10 shadow-2xl shadow-purple-500/20">
          <div className="absolute inset-0 bg-grid-white/[0.02]"></div>
          <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl"></div>
          
          <div className="relative flex items-center gap-6">
            {/* Botão Voltar */}
            <button
              onClick={() => router.push('/dashboard-oficial')}
              className="bg-white/10 hover:bg-white/20 p-4 rounded-xl transition-all duration-200 border-2 border-white/20 hover:border-white/40"
              title="Voltar para o Dashboard API Oficial"
            >
              <FaArrowLeft className="text-3xl text-white" />
            </button>

            <div className="bg-gradient-to-br from-purple-500 to-pink-600 p-6 rounded-2xl shadow-lg shadow-purple-500/50">
              <FaChartLine className="text-6xl text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-6xl font-black text-white mb-2 tracking-tight">
                Dashboard Completo
              </h1>
              <p className="text-2xl text-white/80 font-medium">
                Visualize todas as estatísticas e métricas do sistema
              </p>
            </div>

            {/* Atualização Automática */}
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center gap-3 px-6 py-4 rounded-xl text-lg font-bold transition-all duration-200 ${
                autoRefresh 
                  ? 'bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/40' 
                  : 'bg-white/10 hover:bg-white/20 text-white/80 border-2 border-white/20'
              }`}
            >
              <FaSync className={`text-xl ${autoRefresh ? 'animate-spin' : ''}`} />
              {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
            </button>
          </div>
        </div>

        {/* DASHBOARD CONTENT */}
        {stats && (
          <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-8 shadow-2xl">
            <div className="space-y-8">
              
              {/* TABS DE NAVEGAÇÃO */}
              <div className="flex items-center gap-4 border-b-2 border-white/20 pb-4">
                <button
                  onClick={() => setActiveTab('campaigns')}
                  className={`flex items-center gap-3 px-8 py-4 rounded-t-2xl font-bold text-lg transition-all duration-200 ${
                    activeTab === 'campaigns'
                      ? 'bg-primary-500/20 text-white border-b-4 border-primary-500'
                      : 'bg-white/5 text-white/60 hover:bg-white/10'
                  }`}
                >
                  <FaChartBar className="text-2xl" />
                  Estatísticas de Campanhas
                </button>
                <button
                  onClick={() => setActiveTab('immediate')}
                  className={`flex items-center gap-3 px-8 py-4 rounded-t-2xl font-bold text-lg transition-all duration-200 ${
                    activeTab === 'immediate'
                      ? 'bg-indigo-500/20 text-white border-b-4 border-indigo-500'
                      : 'bg-white/5 text-white/60 hover:bg-white/10'
                  }`}
                >
                  <FaPaperPlane className="text-2xl" />
                  Estatísticas de Envio Rápido
                </button>
              </div>

              {/* CONTROLES */}
              <div className="flex items-center justify-between flex-wrap gap-6">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setFilterType('today')}
                    className={`px-6 py-4 rounded-xl text-lg font-bold transition-all duration-200 ${
                      filterType === 'today' 
                        ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/40' 
                        : 'bg-white/10 text-white/60 hover:bg-white/20 border-2 border-white/20'
                    }`}
                  >
                    📅 Hoje
                  </button>
                  <button
                    onClick={() => setFilterType('custom')}
                    className={`px-6 py-4 rounded-xl text-lg font-bold transition-all duration-200 ${
                      filterType === 'custom' 
                        ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/40' 
                        : 'bg-white/10 text-white/60 hover:bg-white/20 border-2 border-white/20'
                    }`}
                  >
                    📆 Período Personalizado
                  </button>
                </div>
              </div>

              {filterType === 'custom' && (
                <div className="flex items-center gap-4">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/30 transition-all"
                  />
                  <span className="text-white/60 text-xl font-bold">até</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/30 transition-all"
                  />
                </div>
              )}

              {/* ABA 1: ESTATÍSTICAS DE CAMPANHAS */}
              {activeTab === 'campaigns' && (
                <div className="space-y-8 animate-fade-in">
                  
                  {/* CAMPANHAS */}
                  <div className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-2 border-green-500/30 rounded-2xl p-8">
                    <h3 className="text-3xl font-black text-white mb-6 flex items-center gap-3">
                      <FaChartBar className="text-green-400 text-4xl" />
                      Campanhas
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border-2 border-white/20 hover:border-white/40 transition-all text-center">
                        <div className="text-5xl font-black text-white mb-2">{safeStats.campaigns.total}</div>
                        <div className="text-base text-white/70 font-bold flex items-center justify-center gap-2">
                          <FaChartLine />
                          Total
                        </div>
                      </div>
                      <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border-2 border-green-500/30 hover:border-green-500/50 transition-all text-center">
                        <div className="text-5xl font-black text-green-300 mb-2">{safeStats.campaigns.active}</div>
                        <div className="text-base text-white/70 font-bold flex items-center justify-center gap-2">
                          <FaRocket />
                          Ativas
                        </div>
                      </div>
                      <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border-2 border-blue-500/30 hover:border-blue-500/50 transition-all text-center">
                        <div className="text-5xl font-black text-blue-300 mb-2">{safeStats.campaigns.completed}</div>
                        <div className="text-base text-white/70 font-bold flex items-center justify-center gap-2">
                          <FaCheckCircle />
                          Concluídas
                        </div>
                      </div>
                      <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border-2 border-yellow-500/30 hover:border-yellow-500/50 transition-all text-center">
                        <div className="text-5xl font-black text-yellow-300 mb-2">{safeStats.campaigns.paused}</div>
                        <div className="text-base text-white/70 font-bold flex items-center justify-center gap-2">
                          <FaPauseCircle />
                          Pausadas
                        </div>
                      </div>
                      <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border-2 border-red-500/30 hover:border-red-500/50 transition-all text-center">
                        <div className="text-5xl font-black text-red-300 mb-2">{safeStats.campaigns.cancelled}</div>
                        <div className="text-base text-white/70 font-bold flex items-center justify-center gap-2">
                          <FaTimesCircle />
                          Canceladas
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* MENSAGENS */}
                  <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-2 border-blue-500/30 rounded-2xl p-8">
                    <h3 className="text-3xl font-black text-white mb-6 flex items-center gap-3">
                      <FaWhatsapp className="text-blue-400 text-4xl" />
                      Mensagens
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border-2 border-blue-500/30 hover:border-blue-500/50 transition-all text-center">
                        <div className="text-5xl font-black text-blue-300 mb-2">{formatNumber(safeStats.messages.total_sent)}</div>
                        <div className="text-base text-white/70 font-bold flex items-center justify-center gap-2">
                          <FaPaperPlane />
                          Enviadas
                        </div>
                      </div>
                      <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border-2 border-green-500/30 hover:border-green-500/50 transition-all text-center">
                        <div className="text-5xl font-black text-green-300 mb-2">{formatNumber(safeStats.messages.total_delivered)}</div>
                        <div className="text-base text-white/70 font-bold flex items-center justify-center gap-2">
                          <FaCheckCircle />
                          Entregues
                        </div>
                      </div>
                      <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border-2 border-cyan-500/30 hover:border-cyan-500/50 transition-all text-center">
                        <div className="text-5xl font-black text-cyan-300 mb-2">{formatNumber(safeStats.messages.total_read)}</div>
                        <div className="text-base text-white/70 font-bold flex items-center justify-center gap-2">
                          <FaEye />
                          Lidas
                        </div>
                      </div>
                      <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border-2 border-red-500/30 hover:border-red-500/50 transition-all text-center">
                        <div className="text-5xl font-black text-red-300 mb-2">{formatNumber(safeStats.messages.total_failed)}</div>
                        <div className="text-base text-white/70 font-bold flex items-center justify-center gap-2">
                          <FaExclamationTriangle />
                          Falhas
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* PERFORMANCE DAS CAMPANHAS */}
                  <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-2 border-purple-500/30 rounded-2xl p-8">
                    <h3 className="text-3xl font-black text-white mb-6 flex items-center gap-3">
                      <FaChartLine className="text-purple-400 text-4xl" />
                      Performance das Campanhas
                    </h3>
                    
                    <div className="space-y-6">
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xl text-white/80 font-bold flex items-center gap-3">
                            <FaCheckCircle className="text-green-400 text-2xl" />
                            Taxa de Entrega
                          </span>
                          <span className="text-3xl font-black text-green-300">{safeStats.rates.delivery.toFixed(2)}%</span>
                        </div>
                        <div className="w-full bg-white/20 rounded-full h-4">
                          <div 
                            className="bg-gradient-to-r from-green-500 to-green-600 rounded-full h-4 transition-all duration-1000"
                            style={{ width: `${Math.min(safeStats.rates.delivery, 100)}%` }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xl text-white/80 font-bold flex items-center gap-3">
                            <FaEye className="text-blue-400 text-2xl" />
                            Taxa de Leitura
                          </span>
                          <span className="text-3xl font-black text-blue-300">{safeStats.rates.read.toFixed(2)}%</span>
                        </div>
                        <div className="w-full bg-white/20 rounded-full h-4">
                          <div 
                            className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-full h-4 transition-all duration-1000"
                            style={{ width: `${Math.min(safeStats.rates.read, 100)}%` }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xl text-white/80 font-bold flex items-center gap-3">
                            <FaExclamationTriangle className="text-red-400 text-2xl" />
                            Taxa de Falha
                          </span>
                          <span className="text-3xl font-black text-red-300">{safeStats.rates.failure.toFixed(2)}%</span>
                        </div>
                        <div className="w-full bg-white/20 rounded-full h-4">
                          <div 
                            className="bg-gradient-to-r from-red-500 to-red-600 rounded-full h-4 transition-all duration-1000"
                            style={{ width: `${Math.min(safeStats.rates.failure, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ÚLTIMAS 5 CAMPANHAS */}
                  {safeStats.recent_campaigns.length > 0 && (
                    <div className="bg-gradient-to-br from-indigo-500/10 to-indigo-600/5 border-2 border-indigo-500/30 rounded-2xl p-8">
                      <h3 className="text-3xl font-black text-white mb-6">📋 Últimas 5 Campanhas</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-base">
                          <thead className="bg-white/10">
                            <tr className="border-b-2 border-white/20">
                              <th className="text-left py-4 px-4 text-white font-black">Nome</th>
                              <th className="text-center py-4 px-4 text-white font-black">Status</th>
                              <th className="text-center py-4 px-4 text-white font-black">Enviadas</th>
                              <th className="text-center py-4 px-4 text-white font-black">Taxa</th>
                              <th className="text-center py-4 px-4 text-white font-black">Ações</th>
                            </tr>
                          </thead>
                          <tbody>
                            {safeStats.recent_campaigns.map((campaign: any) => {
                              // ✅ CORRIGIR: Tratar valores null/undefined
                              const sentCount = campaign.sent_count || 0;
                              const deliveredCount = campaign.delivered_count || 0;
                              const readCount = campaign.read_count || 0;
                              
                              const deliveryRate = sentCount > 0
                                ? (((deliveredCount + readCount) / sentCount) * 100).toFixed(1)
                                : '0.0';

                              return (
                                <tr key={campaign.id} className="border-b border-white/10 hover:bg-white/5">
                                  <td className="py-4 px-4 text-white font-medium">{campaign.name}</td>
                                  <td className="py-4 px-4 text-center">{getStatusBadge(campaign.realStatus || campaign.status)}</td>
                                  <td className="py-4 px-4 text-center text-blue-300 font-bold text-lg">{campaign.sent_count || 0}</td>
                                  <td className="py-4 px-4 text-center">
                                    <span className={`font-black text-lg ${
                                      parseFloat(deliveryRate) >= 90 ? 'text-green-300' : 
                                      parseFloat(deliveryRate) >= 70 ? 'text-yellow-300' : 
                                      'text-red-300'
                                    }`}>
                                      {deliveryRate}%
                                    </span>
                                  </td>
                                  <td className="py-4 px-4 text-center">
                                    <button
                                      onClick={() => router.push(`/campanha/${campaign.id}`)}
                                      className="px-6 py-3 bg-primary-500/20 hover:bg-primary-500/30 text-primary-300 border-2 border-primary-500/40 rounded-xl font-bold transition-all duration-200"
                                    >
                                      Ver Detalhes
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* CONTAS WHATSAPP */}
                  <div className="bg-gradient-to-br from-teal-500/10 to-teal-600/5 border-2 border-teal-500/30 rounded-2xl p-8">
                    <h3 className="text-3xl font-black text-white mb-6 flex items-center gap-3">
                      <FaUserCircle className="text-teal-400 text-4xl" />
                      Contas WhatsApp
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border-2 border-white/20 hover:border-white/40 transition-all text-center">
                        <div className="text-5xl font-black text-white mb-2">{safeStats.accounts.total}</div>
                        <div className="text-base text-white/70 font-bold flex items-center justify-center gap-2">
                          <FaWhatsapp />
                          Total
                        </div>
                      </div>
                      <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border-2 border-green-500/30 hover:border-green-500/50 transition-all text-center">
                        <div className="text-5xl font-black text-green-300 mb-2">{safeStats.accounts.active}</div>
                        <div className="text-base text-white/70 font-bold flex items-center justify-center gap-2">
                          <FaCheckCircle />
                          Ativas
                        </div>
                      </div>
                      <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border-2 border-red-500/30 hover:border-red-500/50 transition-all text-center">
                        <div className="text-5xl font-black text-red-300 mb-2">{safeStats.accounts.inactive}</div>
                        <div className="text-base text-white/70 font-bold flex items-center justify-center gap-2">
                          <FaTimesCircle />
                          Inativas
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* OUTROS */}
                  <div className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-2 border-orange-500/30 rounded-2xl p-8">
                    <h3 className="text-3xl font-black text-white mb-6 flex items-center gap-3">
                      <FaChartLine className="text-orange-400 text-4xl" />
                      Outros
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border-2 border-orange-500/30 hover:border-orange-500/50 transition-all text-center">
                        <div className="text-5xl font-black text-orange-300 mb-2">{formatNumber(safeStats.messages.total_no_whatsapp)}</div>
                        <div className="text-base text-white/70 font-bold">📵 Sem WhatsApp</div>
                      </div>
                      <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border-2 border-pink-500/30 hover:border-pink-500/50 transition-all text-center">
                        <div className="text-5xl font-black text-pink-300 mb-2">{formatNumber(safeStats.messages.total_button_clicks)}</div>
                        <div className="text-base text-white/70 font-bold">🔘 Cliques</div>
                      </div>
                      <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border-2 border-purple-500/30 hover:border-purple-500/50 transition-all text-center">
                        <div className="text-5xl font-black text-purple-300 mb-2">{formatNumber(safeStats.messages.total_contacts)}</div>
                        <div className="text-base text-white/70 font-bold flex items-center justify-center gap-2">
                          <FaUsers />
                          Contatos
                        </div>
                      </div>
                      <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border-2 border-teal-500/30 hover:border-teal-500/50 transition-all text-center">
                        <div className="text-5xl font-black text-teal-300 mb-2">{safeStats.messages.unique_buttons || 0}</div>
                        <div className="text-base text-white/70 font-bold">🔘 Botões Únicos</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ABA 2: ESTATÍSTICAS DE ENVIO RÁPIDO */}
              {activeTab === 'immediate' && immediateStats && (
                <div className="space-y-8 animate-fade-in">
                  <div className="bg-gradient-to-br from-indigo-500/10 to-purple-600/10 border-2 border-indigo-500/30 rounded-2xl p-8">
                    <h3 className="text-3xl font-black text-white mb-6 flex items-center gap-3">
                      <FaPaperPlane className="text-indigo-400 text-4xl" />
                      Envios Imediatos (Mensagens Diretas)
                    </h3>
                    
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                      <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border-2 border-blue-500/30 hover:border-blue-500/50 transition-all text-center">
                        <div className="text-5xl font-black text-blue-300 mb-2">{formatNumber(safeImmediateStats.total_sent)}</div>
                        <div className="text-base text-white/70 font-bold flex items-center justify-center gap-2">
                          <FaPaperPlane />
                          Enviadas
                        </div>
                      </div>
                      <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border-2 border-green-500/30 hover:border-green-500/50 transition-all text-center">
                        <div className="text-5xl font-black text-green-300 mb-2">{formatNumber(safeImmediateStats.total_delivered)}</div>
                        <div className="text-base text-white/70 font-bold flex items-center justify-center gap-2">
                          <FaCheckCircle />
                          Entregues
                        </div>
                      </div>
                      <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border-2 border-cyan-500/30 hover:border-cyan-500/50 transition-all text-center">
                        <div className="text-5xl font-black text-cyan-300 mb-2">{formatNumber(safeImmediateStats.total_read)}</div>
                        <div className="text-base text-white/70 font-bold flex items-center justify-center gap-2">
                          <FaEye />
                          Lidas
                        </div>
                      </div>
                      <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border-2 border-red-500/30 hover:border-red-500/50 transition-all text-center">
                        <div className="text-5xl font-black text-red-300 mb-2">{formatNumber(safeImmediateStats.total_failed)}</div>
                        <div className="text-base text-white/70 font-bold flex items-center justify-center gap-2">
                          <FaExclamationTriangle />
                          Falhas
                        </div>
                      </div>
                      <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border-2 border-purple-500/30 hover:border-purple-500/50 transition-all text-center">
                        <div className="text-5xl font-black text-purple-300 mb-2">{formatNumber(safeImmediateStats.unique_contacts)}</div>
                        <div className="text-base text-white/70 font-bold flex items-center justify-center gap-2">
                          <FaUsers />
                          Contatos
                        </div>
                      </div>
                    </div>

                    {/* Performance dos Envios Imediatos */}
                    <div className="space-y-6">
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xl text-white/80 font-bold flex items-center gap-3">
                            <FaCheckCircle className="text-green-400 text-2xl" />
                            Taxa de Entrega
                          </span>
                          <span className="text-3xl font-black text-green-300">{safeImmediateStats.rates.delivery.toFixed(2)}%</span>
                        </div>
                        <div className="w-full bg-white/20 rounded-full h-4">
                          <div 
                            className="bg-gradient-to-r from-green-500 to-green-600 rounded-full h-4 transition-all duration-1000"
                            style={{ width: `${Math.min(safeImmediateStats.rates.delivery, 100)}%` }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xl text-white/80 font-bold flex items-center gap-3">
                            <FaEye className="text-blue-400 text-2xl" />
                            Taxa de Leitura
                          </span>
                          <span className="text-3xl font-black text-blue-300">{safeImmediateStats.rates.read.toFixed(2)}%</span>
                        </div>
                        <div className="w-full bg-white/20 rounded-full h-4">
                          <div 
                            className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-full h-4 transition-all duration-1000"
                            style={{ width: `${Math.min(safeImmediateStats.rates.read, 100)}%` }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xl text-white/80 font-bold flex items-center gap-3">
                            <FaExclamationTriangle className="text-red-400 text-2xl" />
                            Taxa de Falha
                          </span>
                          <span className="text-3xl font-black text-red-300">{safeImmediateStats.rates.failure.toFixed(2)}%</span>
                        </div>
                        <div className="w-full bg-white/20 rounded-full h-4">
                          <div 
                            className="bg-gradient-to-r from-red-500 to-red-600 rounded-full h-4 transition-all duration-1000"
                            style={{ width: `${Math.min(safeImmediateStats.rates.failure, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {safeImmediateStats.total_sent === 0 && (
                      <div className="text-center py-12 mt-8">
                        <div className="text-6xl mb-4">📭</div>
                        <p className="text-white/70 text-2xl mb-3 font-bold">Nenhuma mensagem imediata enviada</p>
                        <p className="text-white/50 text-lg">
                          Use o botão "Enviar Mensagem" para enviar mensagens individuais
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Cliques de Botões */}
                  {safeImmediateStats.button_clicks && (
                    <div className="bg-gradient-to-br from-pink-500/10 to-pink-600/5 border-2 border-pink-500/30 rounded-2xl p-8">
                      <h4 className="text-3xl font-black text-white mb-6 flex items-center gap-3">
                        🔘 Cliques de Botões
                      </h4>
                      
                      <div className="grid grid-cols-3 gap-6">
                        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border-2 border-pink-500/30 hover:border-pink-500/50 transition-all text-center">
                          <div className="text-5xl font-black text-pink-300 mb-2">
                            {formatNumber(safeImmediateStats.button_clicks.total_clicks)}
                          </div>
                          <div className="text-base text-white/70 font-bold">Total de Cliques</div>
                        </div>
                        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border-2 border-purple-500/30 hover:border-purple-500/50 transition-all text-center">
                          <div className="text-5xl font-black text-purple-300 mb-2">
                            {formatNumber(safeImmediateStats.button_clicks.unique_buttons)}
                          </div>
                          <div className="text-base text-white/70 font-bold">Total de Botões</div>
                        </div>
                        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border-2 border-indigo-500/30 hover:border-indigo-500/50 transition-all text-center">
                          <div className="text-5xl font-black text-indigo-300 mb-2">
                            {formatNumber(safeImmediateStats.button_clicks.unique_contacts)}
                          </div>
                          <div className="text-base text-white/70 font-bold">Contatos Únicos</div>
                        </div>
                      </div>

                      {safeImmediateStats.button_clicks.total_clicks === 0 && (
                        <div className="text-center py-8 mt-4">
                          <p className="text-white/50 text-lg">
                            📭 Nenhum clique em botões registrado ainda
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Histórico de Envios */}
                  {immediateLog.length > 0 && (
                    <div className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border-2 border-cyan-500/30 rounded-2xl p-8">
                      <h4 className="text-3xl font-black text-white mb-6 flex items-center gap-3">
                        📋 Histórico de Envios ({immediateLog.length})
                      </h4>
                      <div className="overflow-x-auto overflow-y-auto max-h-[600px] custom-scrollbar">
                        <table className="w-full text-base">
                          <thead className="bg-white/10 sticky top-0">
                            <tr className="border-b-2 border-white/20">
                              <th className="text-left py-4 px-4 text-white font-black">Data/Hora</th>
                              <th className="text-left py-4 px-4 text-white font-black">Telefone</th>
                              <th className="text-left py-4 px-4 text-white font-black">Contato</th>
                              <th className="text-left py-4 px-4 text-white font-black">Template</th>
                              <th className="text-center py-4 px-4 text-white font-black">Status</th>
                              <th className="text-left py-4 px-4 text-white font-black">Erro</th>
                            </tr>
                          </thead>
                          <tbody>
                            {immediateLog.map((msg: any) => (
                              <tr key={msg.id} className="border-b border-white/10 hover:bg-white/5">
                                <td className="py-4 px-4 text-white/80 font-medium">
                                  {msg.sent_at ? new Date(msg.sent_at).toLocaleString('pt-BR') : '-'}
                                </td>
                                <td className="py-4 px-4 text-white font-medium">{msg.phone_number}</td>
                                <td className="py-4 px-4 text-white/80">{msg.contact_name || '-'}</td>
                                <td className="py-4 px-4 text-white/80">{msg.template_name || '-'}</td>
                                <td className="py-4 px-4 text-center">
                                  {msg.status === 'delivered' && (
                                    <span className="px-4 py-2 bg-green-500/20 text-green-400 rounded-full text-sm font-bold">
                                      ✓ Entregue
                                    </span>
                                  )}
                                  {msg.status === 'read' && (
                                    <span className="px-4 py-2 bg-blue-500/20 text-blue-400 rounded-full text-sm font-bold">
                                      ✓✓ Lida
                                    </span>
                                  )}
                                  {msg.status === 'failed' && (
                                    <span className="px-4 py-2 bg-red-500/20 text-red-400 rounded-full text-sm font-bold">
                                      ✗ Falhou
                                    </span>
                                  )}
                                  {msg.status === 'sent' && (
                                    <span className="px-4 py-2 bg-yellow-500/20 text-yellow-400 rounded-full text-sm font-bold">
                                      ⟳ Enviada
                                    </span>
                                  )}
                                  {!['delivered', 'read', 'failed', 'sent'].includes(msg.status) && (
                                    <span className="px-4 py-2 bg-gray-500/20 text-gray-400 rounded-full text-sm font-bold">
                                      {msg.status || 'Pendente'}
                                    </span>
                                  )}
                                </td>
                                <td className="py-4 px-4 text-red-300 text-sm">
                                  {msg.error_message ? (
                                    <span className="line-clamp-2" title={msg.error_message}>
                                      {msg.error_message.substring(0, 50)}
                                      {msg.error_message.length > 50 ? '...' : ''}
                                    </span>
                                  ) : '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
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
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}







