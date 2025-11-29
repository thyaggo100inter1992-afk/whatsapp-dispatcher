import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { 
  FaArrowLeft, FaPaperPlane, FaPlay, FaPause, FaTimes, FaTrash,
  FaCheckCircle, FaExclamationCircle, FaBan, FaClock, FaFilter, FaCalendarAlt
} from 'react-icons/fa';
import api from '@/services/api';
import { InstanceAvatar } from '@/components/InstanceAvatar';

interface SendingJob {
  id: string;
  type: 'simple' | 'combined';
  status: 'sending' | 'paused' | 'completed' | 'error' | 'cancelled';
  progress: number;
  totalBlocks: number;
  currentBlock: number;
  targetNumber: string;
  instanceId: string;
  startedAt: Date;
  messageType?: string;
  error?: string;
}

interface UazInstance {
  id: number;
  name: string;
  phone_number: string;
  status: string;
  profile_pic_url?: string | null;
  profile_name?: string | null;
  is_connected?: boolean;
}

interface HistoryMessage {
  id: number;
  instance_id: number;
  phone_number: string;
  message_type: string;
  status: string;
  error_message?: string;
  created_at: string;
  instance_name: string;
  instance_phone: string;
}

type PeriodFilter = 'today' | 'week' | 'month' | 'all' | 'custom';

export default function EnviosEmAndamento() {
  const router = useRouter();
  const [sendingJobs, setSendingJobs] = useState<SendingJob[]>([]);
  const [historyMessages, setHistoryMessages] = useState<HistoryMessage[]>([]);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' | 'warning' } | null>(null);
  const [instances, setInstances] = useState<UazInstance[]>([]);
  const previousJobsRef = useRef<SendingJob[]>([]);
  
  // Estados para filtros
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(false);

  // Carregar instâncias
  useEffect(() => {
    const loadInstances = async () => {
      try {
        const response = await api.get('/uaz/instances');
        setInstances(response.data.data || []);
      } catch (error) {
        console.error('Erro ao carregar instâncias:', error);
      }
    };
    loadInstances();
  }, []);

  // Função para carregar histórico do banco de dados
  const loadHistory = async () => {
    setLoading(true);
    try {
      // Calcular datas com base no filtro
      let startDate = '';
      let endDate = '';
      
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      switch (periodFilter) {
        case 'today':
          startDate = today.toISOString();
          endDate = new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString();
          break;
        case 'week':
          const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
          startDate = weekAgo.toISOString();
          endDate = now.toISOString();
          break;
        case 'month':
          const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
          startDate = monthAgo.toISOString();
          endDate = now.toISOString();
          break;
        case 'custom':
          if (customStartDate) startDate = new Date(customStartDate).toISOString();
          if (customEndDate) endDate = new Date(customEndDate + 'T23:59:59').toISOString();
          break;
        case 'all':
          // Sem filtro de data
          break;
      }

      console.log('🔍 Carregando histórico com filtro:', { periodFilter, startDate, endDate });

      const params: any = { limit: 1000 };
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const response = await api.get('/uaz/messages/history', { params });
      
      console.log('✅ Histórico carregado:', response.data.count, 'mensagens');
      setHistoryMessages(response.data.data || []);
      
    } catch (error) {
      console.error('❌ Erro ao carregar histórico:', error);
      showNotification('Erro ao carregar histórico do banco de dados', 'warning');
    } finally {
      setLoading(false);
    }
  };

  // Carregar histórico quando o filtro mudar
  useEffect(() => {
    loadHistory();
  }, [periodFilter, customStartDate, customEndDate]);

  // Função para obter informações da instância
  const getInstanceInfo = (instanceId: string) => {
    const instance = instances.find(inst => inst.id.toString() === instanceId);
    if (instance) {
      return {
        name: instance.name,
        phone: instance.phone_number,
        profilePicUrl: instance.profile_pic_url,
        profileName: instance.profile_name,
        isConnected: instance.is_connected
      };
    }
    return { 
      name: `ID: ${instanceId}`, 
      phone: '',
      profilePicUrl: null,
      profileName: null,
      isConnected: false
    };
  };

  // Carregar jobs do localStorage
  useEffect(() => {
    const loadJobs = () => {
      try {
        const storedJobs = localStorage.getItem('sendingJobs');
        if (storedJobs) {
          const jobs = JSON.parse(storedJobs);
          setSendingJobs(jobs);
        }
      } catch (error) {
        console.error('Erro ao carregar jobs:', error);
      }
    };

    loadJobs();
    
    // Atualizar a cada 500ms (mais responsivo)
    const interval = setInterval(loadJobs, 500);
    
    // Listener para eventos customizados de atualização de jobs (mesma aba/janela)
    const handleJobUpdate = (event: any) => {
      console.log('📢 Evento "sendingJobUpdated" recebido (mesma aba):', event.detail);
      loadJobs(); // Recarregar imediatamente
    };
    
    // Listener para mudanças no localStorage (outras abas/janelas)
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'sendingJobs') {
        console.log('📢 localStorage alterado em outra aba/janela');
        loadJobs(); // Recarregar imediatamente
      }
    };
    
    window.addEventListener('sendingJobUpdated', handleJobUpdate);
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('sendingJobUpdated', handleJobUpdate);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const clearCompletedJobs = () => {
    const activeJobs = sendingJobs.filter(
      j => j.status !== 'completed' && j.status !== 'error' && j.status !== 'cancelled'
    );
    setSendingJobs(activeJobs);
    localStorage.setItem('sendingJobs', JSON.stringify(activeJobs));
  };

  const removeJob = (jobId: string) => {
    const updatedJobs = sendingJobs.filter(j => j.id !== jobId);
    setSendingJobs(updatedJobs);
    localStorage.setItem('sendingJobs', JSON.stringify(updatedJobs));
  };

  const showNotification = (message: string, type: 'success' | 'info' | 'warning' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Monitorar mudanças de status e mostrar notificações
  useEffect(() => {
    sendingJobs.forEach(job => {
      const previousJob = previousJobsRef.current.find(j => j.id === job.id);
      
      // Verificar se o status mudou para "completed"
      if (previousJob && previousJob.status !== 'completed' && job.status === 'completed') {
        showNotification(`✅ Mensagem enviada com sucesso para ${job.targetNumber}!`, 'success');
      }
      
      // Verificar se o status mudou para "error"
      if (previousJob && previousJob.status !== 'error' && job.status === 'error') {
        showNotification(`❌ Erro ao enviar para ${job.targetNumber}: ${job.error || 'Erro desconhecido'}`, 'warning');
      }
      
      // Verificar se o status mudou para "cancelled"
      if (previousJob && previousJob.status !== 'cancelled' && job.status === 'cancelled') {
        showNotification(`🚫 Envio cancelado para ${job.targetNumber}`, 'info');
      }
    });
    
    previousJobsRef.current = [...sendingJobs];
  }, [sendingJobs]);

  const pauseJob = (jobId: string) => {
    const updatedJobs = sendingJobs.map(j => 
      j.id === jobId ? { ...j, status: 'paused' as const, pauseRequested: true } : j
    );
    setSendingJobs(updatedJobs);
    localStorage.setItem('sendingJobs', JSON.stringify(updatedJobs));
    showNotification('⏸️ Envio pausado com sucesso!', 'info');
  };

  const resumeJob = (jobId: string) => {
    const updatedJobs = sendingJobs.map(j => 
      j.id === jobId ? { ...j, status: 'sending' as const, pauseRequested: false } : j
    );
    setSendingJobs(updatedJobs);
    localStorage.setItem('sendingJobs', JSON.stringify(updatedJobs));
    showNotification('▶️ Envio retomado! Continuando de onde parou...', 'success');
  };

  const cancelJob = (jobId: string) => {
    const confirmed = window.confirm(
      '⚠️ ATENÇÃO!\n\n' +
      'Tem certeza que deseja CANCELAR este envio?\n\n' +
      '❌ O envio será interrompido imediatamente\n' +
      '❌ As mensagens ainda não enviadas NÃO serão enviadas\n' +
      '✅ As mensagens já enviadas permanecerão enviadas\n\n' +
      'Esta ação NÃO pode ser desfeita!'
    );
    
    if (!confirmed) return;
    
    const updatedJobs = sendingJobs.map(j => 
      j.id === jobId ? { ...j, status: 'cancelled' as const, cancelRequested: true } : j
    );
    setSendingJobs(updatedJobs);
    localStorage.setItem('sendingJobs', JSON.stringify(updatedJobs));
    showNotification('🚫 Envio cancelado. As mensagens já enviadas permaneceram.', 'warning');
  };


  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sending':
        return <FaClock className="text-blue-400 animate-pulse" />;
      case 'paused':
        return <FaPause className="text-yellow-400" />;
      case 'completed':
        return <FaCheckCircle className="text-green-400" />;
      case 'error':
        return <FaExclamationCircle className="text-red-400" />;
      case 'cancelled':
        return <FaBan className="text-gray-400" />;
      default:
        return <FaClock className="text-blue-400" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'sending':
        return 'Enviando...';
      case 'paused':
        return 'Pausado';
      case 'completed':
        return 'Concluído';
      case 'error':
        return 'Erro';
      case 'cancelled':
        return 'Cancelado';
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sending':
        return 'from-blue-500/20 to-cyan-500/20 border-blue-500/40';
      case 'paused':
        return 'from-yellow-500/20 to-orange-500/20 border-yellow-500/40';
      case 'completed':
        return 'from-green-500/20 to-emerald-500/20 border-green-500/40';
      case 'error':
        return 'from-red-500/20 to-pink-500/20 border-red-500/40';
      case 'cancelled':
        return 'from-gray-500/20 to-slate-500/20 border-gray-500/40';
      default:
        return 'from-blue-500/20 to-cyan-500/20 border-blue-500/40';
    }
  };

  const activeJobs = sendingJobs.filter(j => j.status === 'sending' || j.status === 'paused');
  const completedJobs = sendingJobs.filter(j => j.status === 'completed');
  const failedJobs = sendingJobs.filter(j => j.status === 'error' || j.status === 'cancelled');

  // Combinar jobs do localStorage com histórico do banco
  const allMessages = [
    ...sendingJobs.map(job => {
      const instanceInfo = getInstanceInfo(job.instanceId);
      return {
        id: job.id,
        instance_id: parseInt(job.instanceId),
        phone_number: job.targetNumber,
        message_type: job.messageType || 'unknown',
        status: job.status,
        error_message: job.error,
        created_at: job.startedAt.toString(),
        instance_name: instanceInfo.name,
        instance_phone: instanceInfo.phone,
        instance_profile_pic: instanceInfo.profilePicUrl,
        instance_profile_name: instanceInfo.profileName,
        instance_is_connected: instanceInfo.isConnected,
        isLiveJob: true,
        progress: job.progress,
        currentBlock: job.currentBlock,
        totalBlocks: job.totalBlocks
      };
    }),
    ...historyMessages.map(msg => {
      const instanceInfo = getInstanceInfo(msg.instance_id?.toString() || '');
      return {
        ...msg,
        instance_profile_pic: instanceInfo.profilePicUrl,
        instance_profile_name: instanceInfo.profileName,
        instance_is_connected: instanceInfo.isConnected,
        isLiveJob: false
      };
    })
  ];

  // Estatísticas combinadas
  const stats = {
    active: activeJobs.length,
    completed: completedJobs.length + historyMessages.filter(m => m.status === 'completed').length,
    failed: failedJobs.length + historyMessages.filter(m => m.status === 'error' || m.status === 'cancelled').length
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 py-8 px-4">
      {/* Notificação Toast */}
      {notification && (
        <div 
          className={`fixed top-8 left-1/2 transform -translate-x-1/2 z-50 ${
            notification.type === 'success' ? 'bg-gradient-to-r from-green-500 to-emerald-500' :
            notification.type === 'warning' ? 'bg-gradient-to-r from-yellow-500 to-orange-500' :
            'bg-gradient-to-r from-blue-500 to-cyan-500'
          } text-white px-6 py-4 rounded-xl shadow-2xl border-2 ${
            notification.type === 'success' ? 'border-green-400' :
            notification.type === 'warning' ? 'border-yellow-400' :
            'border-blue-400'
          } flex items-center gap-3 min-w-[350px] animate-bounce`}
          style={{ animation: 'slideDown 0.5s ease-out' }}
        >
          <div className="text-2xl">
            {notification.type === 'success' ? '✅' :
             notification.type === 'warning' ? '⚠️' : 'ℹ️'}
          </div>
          <p className="font-bold">{notification.message}</p>
          <button
            onClick={() => setNotification(null)}
            className="ml-auto text-white/80 hover:text-white p-1 hover:bg-white/10 rounded"
          >
            <FaTimes />
          </button>
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* CABEÇALHO */}
        <div className="bg-gradient-to-r from-purple-600/30 via-blue-500/20 to-purple-600/30 backdrop-blur-xl border-2 border-purple-500/40 rounded-3xl p-10 shadow-2xl">
          <div className="flex items-center gap-6">
            <button
              onClick={() => router.push('/uaz/enviar-mensagem-unificado')}
              className="bg-white/10 hover:bg-white/20 p-4 rounded-xl transition-all duration-200 border-2 border-white/20 hover:border-white/40"
            >
              <FaArrowLeft className="text-3xl text-white" />
            </button>
            
            <div className="bg-gradient-to-br from-purple-500 to-blue-600 p-6 rounded-2xl shadow-lg">
              <FaPaperPlane className="text-5xl text-white" />
            </div>
            
            <div className="flex-1">
              <h1 className="text-5xl font-black text-white tracking-tight mb-2">
                Envios em Andamento
              </h1>
              <p className="text-xl text-white/80 font-medium">
                Acompanhe o progresso e resultados das suas mensagens
              </p>
            </div>

            {(completedJobs.length > 0 || failedJobs.length > 0) && (
              <button
                onClick={clearCompletedJobs}
                className="px-6 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-xl font-bold transition-all border-2 border-red-500/40 hover:border-red-500/60"
              >
                <FaTrash className="inline mr-2" />
                Limpar Finalizados
              </button>
            )}
          </div>
        </div>

        {/* FILTROS DE PERÍODO */}
        <div className="bg-white/5 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <FaFilter className="text-2xl text-blue-400" />
              <h2 className="text-2xl font-bold text-white">Filtrar por Período</h2>
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg font-bold transition-all"
            >
              {showFilters ? 'Ocultar' : 'Mostrar'} Filtros
            </button>
          </div>

          {showFilters && (
            <div className="space-y-4">
              {/* Botões de filtro rápido */}
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => setPeriodFilter('today')}
                  className={`px-6 py-3 rounded-xl font-bold transition-all ${
                    periodFilter === 'today'
                      ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg'
                      : 'bg-white/10 text-white/70 hover:bg-white/20'
                  }`}
                >
                  <FaCalendarAlt className="inline mr-2" />
                  Hoje
                </button>
                <button
                  onClick={() => setPeriodFilter('week')}
                  className={`px-6 py-3 rounded-xl font-bold transition-all ${
                    periodFilter === 'week'
                      ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg'
                      : 'bg-white/10 text-white/70 hover:bg-white/20'
                  }`}
                >
                  Últimos 7 Dias
                </button>
                <button
                  onClick={() => setPeriodFilter('month')}
                  className={`px-6 py-3 rounded-xl font-bold transition-all ${
                    periodFilter === 'month'
                      ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg'
                      : 'bg-white/10 text-white/70 hover:bg-white/20'
                  }`}
                >
                  Últimos 30 Dias
                </button>
                <button
                  onClick={() => setPeriodFilter('all')}
                  className={`px-6 py-3 rounded-xl font-bold transition-all ${
                    periodFilter === 'all'
                      ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg'
                      : 'bg-white/10 text-white/70 hover:bg-white/20'
                  }`}
                >
                  Tudo
                </button>
                <button
                  onClick={() => setPeriodFilter('custom')}
                  className={`px-6 py-3 rounded-xl font-bold transition-all ${
                    periodFilter === 'custom'
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                      : 'bg-white/10 text-white/70 hover:bg-white/20'
                  }`}
                >
                  Personalizado
                </button>
              </div>

              {/* Filtro personalizado */}
              {periodFilter === 'custom' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-purple-500/10 border-2 border-purple-500/30 rounded-xl">
                  <div>
                    <label className="block text-white/80 text-sm font-bold mb-2">Data Inicial</label>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="w-full px-4 py-3 bg-white/10 border-2 border-white/20 rounded-xl text-white font-bold focus:border-purple-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-white/80 text-sm font-bold mb-2">Data Final</label>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="w-full px-4 py-3 bg-white/10 border-2 border-white/20 rounded-xl text-white font-bold focus:border-purple-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Indicador de carregamento */}
              {loading && (
                <div className="text-center py-4">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                  <p className="text-white/70 mt-2">Carregando histórico...</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ESTATÍSTICAS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Ativos */}
          <div className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border-2 border-blue-500/40 rounded-2xl p-6">
            <div className="flex items-center gap-4">
              <div className="bg-blue-500/30 p-4 rounded-xl">
                <FaClock className="text-3xl text-blue-300" />
              </div>
              <div>
                <p className="text-blue-300 text-sm font-bold mb-1">EM ANDAMENTO</p>
                <p className="text-4xl font-black text-white">{stats.active}</p>
              </div>
            </div>
          </div>

          {/* Concluídos */}
          <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 border-2 border-green-500/40 rounded-2xl p-6">
            <div className="flex items-center gap-4">
              <div className="bg-green-500/30 p-4 rounded-xl">
                <FaCheckCircle className="text-3xl text-green-300" />
              </div>
              <div>
                <p className="text-green-300 text-sm font-bold mb-1">CONCLUÍDOS</p>
                <p className="text-4xl font-black text-white">{stats.completed}</p>
              </div>
            </div>
          </div>

          {/* Falhas */}
          <div className="bg-gradient-to-br from-red-500/20 to-pink-500/20 border-2 border-red-500/40 rounded-2xl p-6">
            <div className="flex items-center gap-4">
              <div className="bg-red-500/30 p-4 rounded-xl">
                <FaExclamationCircle className="text-3xl text-red-300" />
              </div>
              <div>
                <p className="text-red-300 text-sm font-bold mb-1">FALHAS</p>
                <p className="text-4xl font-black text-white">{stats.failed}</p>
              </div>
            </div>
          </div>
        </div>

        {/* LISTA DE MENSAGENS (JOBS + HISTÓRICO) */}
        {allMessages.length === 0 ? (
          <div className="bg-white/5 backdrop-blur-xl border-2 border-white/10 rounded-3xl p-16 text-center">
            <FaPaperPlane className="text-6xl text-white/30 mx-auto mb-6" />
            <h2 className="text-3xl font-black text-white mb-4">Nenhuma Mensagem Encontrada</h2>
            <p className="text-xl text-white/60 mb-8">
              {periodFilter !== 'all' 
                ? 'Tente selecionar um período diferente ou vá para "Envio Rápido" e comece a enviar suas mensagens!'
                : 'Vá para "Envio Rápido" e comece a enviar suas mensagens!'}
            </p>
            <button
              onClick={() => router.push('/uaz/enviar-mensagem-unificado')}
              className="px-8 py-4 bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white font-bold rounded-xl transition-all shadow-lg"
            >
              Ir para Envio Rápido
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {allMessages.map((msg: any) => (
              <div
                key={msg.id}
                className={`bg-gradient-to-br ${getStatusColor(msg.status)} backdrop-blur-xl border-2 rounded-2xl p-6 transition-all hover:shadow-xl`}
              >
                <div className="flex items-start gap-4">
                  {/* Ícone de Status */}
                  <div className="text-3xl mt-1">
                    {getStatusIcon(msg.status)}
                  </div>

                  {/* Informações */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold text-white">
                        {msg.isLiveJob ? '📤 Envio em Tempo Real' : '📜 Histórico'}
                      </h3>
                      <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                        msg.status === 'sending' ? 'bg-blue-500/30 text-blue-300' :
                        msg.status === 'paused' ? 'bg-yellow-500/30 text-yellow-300' :
                        msg.status === 'completed' ? 'bg-green-500/30 text-green-300' :
                        msg.status === 'error' ? 'bg-red-500/30 text-red-300' :
                        'bg-gray-500/30 text-gray-300'
                      }`}>
                        {getStatusText(msg.status)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      {/* Número de destino */}
                      <div>
                        <p className="text-white/60 text-sm">📱 Número de Destino</p>
                        <p className="text-white font-bold text-lg">{msg.phone_number}</p>
                      </div>
                      
                      {/* Tipo de mensagem */}
                      <div>
                        <p className="text-white/60 text-sm">📝 Tipo de Mensagem</p>
                        <p className="text-white font-bold capitalize">{msg.message_type}</p>
                      </div>
                      
                      {/* NÚMERO DA INSTÂNCIA - DESTACADO COM FOTO */}
                      <div className="col-span-2 p-4 bg-gradient-to-r from-purple-500/20 to-blue-500/20 border-2 border-purple-500/40 rounded-xl">
                        <p className="text-purple-300 text-sm font-bold mb-3">📞 WhatsApp Usado para Enviar</p>
                        <InstanceAvatar
                          profilePicUrl={msg.instance_profile_pic}
                          instanceName={msg.instance_name}
                          profileName={msg.instance_profile_name}
                          phoneNumber={msg.instance_phone}
                          isConnected={msg.instance_is_connected}
                          size="md"
                          showStatus={true}
                          showNames={true}
                          showPhone={true}
                        />
                      </div>

                      {/* Progresso (apenas para jobs em tempo real) */}
                      {msg.isLiveJob && (
                        <div>
                          <p className="text-white/60 text-sm">Progresso</p>
                          <p className="text-white font-bold">{msg.currentBlock} de {msg.totalBlocks} blocos</p>
                        </div>
                      )}

                      {/* Data de envio */}
                      <div>
                        <p className="text-white/60 text-sm">🕐 {msg.isLiveJob ? 'Iniciado em' : 'Enviado em'}</p>
                        <p className="text-white font-bold">
                          {new Date(msg.created_at).toLocaleString('pt-BR')}
                        </p>
                      </div>
                    </div>

                    {/* Barra de Progresso (apenas para jobs em tempo real) */}
                    {msg.isLiveJob && (
                      <div className="mb-4">
                        <div className="flex justify-between text-sm text-white/70 mb-2">
                          <span>Progresso</span>
                          <span>{msg.progress}%</span>
                        </div>
                        <div className="h-3 bg-black/30 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 ${
                              msg.status === 'completed' ? 'bg-gradient-to-r from-green-500 to-emerald-500' :
                              msg.status === 'error' ? 'bg-gradient-to-r from-red-500 to-pink-500' :
                              msg.status === 'cancelled' ? 'bg-gradient-to-r from-gray-500 to-slate-500' :
                              'bg-gradient-to-r from-blue-500 to-cyan-500'
                            }`}
                            style={{ width: `${msg.progress}%` }}
                          ></div>
                        </div>
                      </div>
                    )}

                    {/* Mensagens de Status */}
                    {msg.error_message && (
                      <div className="bg-red-500/20 border border-red-500/40 rounded-lg p-3 mb-4">
                        <p className="text-red-300 font-bold text-sm">❌ Erro: {msg.error_message}</p>
                      </div>
                    )}
                    
                    {msg.status === 'paused' && (
                      <div className="bg-yellow-500/20 border border-yellow-500/40 rounded-lg p-3 mb-4">
                        <p className="text-yellow-300 font-bold text-sm">⏸️ Envio Pausado - Clique em "Retomar" para continuar</p>
                      </div>
                    )}
                    
                    {msg.status === 'cancelled' && (
                      <div className="bg-gray-500/20 border border-gray-500/40 rounded-lg p-3 mb-4">
                        <p className="text-gray-300 font-bold text-sm">🚫 Envio Cancelado pelo usuário</p>
                      </div>
                    )}
                    
                    {msg.status === 'completed' && (
                      <div className="bg-green-500/20 border border-green-500/40 rounded-lg p-3 mb-4">
                        <p className="text-green-300 font-bold text-sm">✅ Envio Concluído com Sucesso!</p>
                      </div>
                    )}
                  </div>

                  {/* Botões de Controle (apenas para jobs em tempo real) */}
                  {msg.isLiveJob && (
                    <div className="flex flex-col gap-2 min-w-[120px]">
                      {/* Controles para envios ativos */}
                      {msg.status === 'sending' && (
                        <>
                          <button
                            onClick={() => pauseJob(msg.id)}
                            className="px-4 py-3 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 rounded-xl font-bold transition-all border-2 border-yellow-500/40 hover:border-yellow-500/60 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
                            title="Pausar este envio temporariamente"
                          >
                            <FaPause className="text-lg" />
                            <span className="text-sm">Pausar</span>
                          </button>
                          <button
                            onClick={() => cancelJob(msg.id)}
                            className="px-4 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-xl font-bold transition-all border-2 border-red-500/40 hover:border-red-500/60 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
                            title="Cancelar este envio permanentemente"
                          >
                            <FaTimes className="text-lg" />
                            <span className="text-sm">Cancelar</span>
                          </button>
                        </>
                      )}

                      {/* Controles para envios pausados */}
                      {msg.status === 'paused' && (
                        <>
                          <button
                            onClick={() => resumeJob(msg.id)}
                            className="px-4 py-3 bg-green-500/20 hover:bg-green-500/30 text-green-300 rounded-xl font-bold transition-all border-2 border-green-500/40 hover:border-green-500/60 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl animate-pulse"
                            title="Retomar o envio de onde parou"
                          >
                            <FaPlay className="text-lg" />
                            <span className="text-sm">Retomar</span>
                          </button>
                          <button
                            onClick={() => cancelJob(msg.id)}
                            className="px-4 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-xl font-bold transition-all border-2 border-red-500/40 hover:border-red-500/60 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
                            title="Cancelar este envio permanentemente"
                          >
                            <FaTimes className="text-lg" />
                            <span className="text-sm">Cancelar</span>
                          </button>
                        </>
                      )}

                      {/* Botão remover para envios finalizados */}
                      {(msg.status === 'completed' || msg.status === 'error' || msg.status === 'cancelled') && (
                        <button
                          onClick={() => removeJob(msg.id)}
                          className="px-4 py-3 bg-gray-500/20 hover:bg-gray-500/30 text-gray-300 rounded-xl font-bold transition-all border-2 border-gray-500/40 hover:border-gray-500/60 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
                          title="Remover da lista de envios"
                        >
                          <FaTrash className="text-lg" />
                          <span className="text-sm">Remover</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

