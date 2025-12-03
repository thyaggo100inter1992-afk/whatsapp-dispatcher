import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { 
  FaArrowLeft, FaCheckCircle, FaTimesCircle, FaClock, FaPause, 
  FaPlay, FaBan, FaUsers, FaRocket, FaBolt, FaChartBar, 
  FaListUl, FaTimes, FaPhone, FaGlobe 
} from 'react-icons/fa';
import { format } from 'date-fns';
import { CampaignInstancesManagerQR } from '@/components/CampaignInstancesManagerQR';
import ToastContainer from '@/components/ToastContainer';
import { useToast } from '@/hooks/useToast';
import { useConfirm } from '@/hooks/useConfirm';
import api from '@/services/api';

interface QrCampaign {
  id: number;
  name: string;
  status: string;
  scheduled_at?: string;
  started_at?: string;
  completed_at?: string;
  total_contacts: number;
  sent_count: number;
  delivered_count: number;
  read_count: number;
  failed_count: number;
  no_whatsapp_count: number;
  button_clicks_count: number;
  schedule_config?: any;
  pause_config?: any;
  created_at: string;
  updated_at: string;
}

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
  contact_id: number;
  campaign_id: number;
  instance_id: number;
  instance_name?: string;
  proxy_used?: boolean;
  proxy_host?: string;
  proxy_type?: string;
}

interface ActivityLog {
  campaign: {
    id: number;
    name: string;
    status: string;
  };
  currentStatus: string;
  statusDetails: {
    isWithinWorkHours: boolean;
    shouldBePaused: boolean;
    pauseRemainingSeconds: number;
    currentTime: string;
    workHours: string;
  };
  intervalInfo: {
    intervalSeconds: number;
    messagesUntilPause: number;
    pauseAfter: number;
    pauseDurationMinutes: number;
  };
  activeAccounts: Array<{
    id: number;
    name: string;
    phone: string;
    isActive: boolean;
    consecutiveFailures: number;
    lastError?: string;
    qualityRating: string;
    accountStatus: string;
    dailyLimit: number;
    sentToday: number;
    remaining: number;
    campaignStatus: string;
    removedAt?: string;
    removalCount: number;
    permanentRemoval: boolean;
    removalHistory: Array<{
      timestamp: string;
      reason: string;
      type: string;
      removal_number?: number;
      is_permanent?: boolean;
      reactivated_at?: string;
      reactivation_reason?: string;
    }>;
  }>;
  lastMessage: {
    instanceName: string;
    phoneNumber: string;
    templateName: string;
    status: string;
    sentAt: string;
    contactPhone: string;
  } | null;
  stats: {
    totalContacts: number;
    sentCount: number;
    deliveredCount: number;
    readCount: number;
    failedCount: number;
    pendingCount: number;
  };
}

export default function QrCampanhaDetalhes() {
  const router = useRouter();
  const { id } = router.query;
  const toast = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

  const [campaign, setCampaign] = useState<QrCampaign | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [managingInstances, setManagingInstances] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [activityLog, setActivityLog] = useState<ActivityLog | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [buttonsStats, setButtonsStats] = useState<any>(null);
  const [showAllContacts, setShowAllContacts] = useState(false);
  const [allContacts, setAllContacts] = useState<Array<{ phone: string; name?: string }>>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [nextMessageTime, setNextMessageTime] = useState<number | null>(null);
  const [pauseEndTime, setPauseEndTime] = useState<number | null>(null);

  useEffect(() => {
    if (id) {
      loadCampaign();
      loadMessages();
      loadActivityLog();
      loadButtonsStats();
      const interval = setInterval(() => {
        loadCampaign();
        loadMessages();
        loadActivityLog();
        loadButtonsStats();
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [id]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
      
      // Decrementar contadores
      if (nextMessageTime !== null && nextMessageTime > 0) {
        setNextMessageTime(prev => (prev !== null && prev > 0 ? prev - 1 : null));
      }
      
      if (pauseEndTime !== null && pauseEndTime > 0) {
        setPauseEndTime(prev => (prev !== null && prev > 0 ? prev - 1 : null));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [nextMessageTime, pauseEndTime]);

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${Math.floor(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    if (minutes < 60) return `${minutes}min ${secs}s`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}min`;
  };

  const formatTimeRemaining = (seconds: number): string => {
    if (seconds <= 0) return '0s';
    if (seconds < 60) return `${Math.floor(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    if (minutes < 60) return `${minutes}min ${secs}s`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}min ${secs}s`;
  };

  const getElapsedTime = (): string => {
    if (!campaign?.started_at) return '--';
    const start = new Date(campaign.started_at);
    const diff = (currentTime.getTime() - start.getTime()) / 1000;
    return formatDuration(diff);
  };

  const getEstimatedTimeRemaining = (): string => {
    if (!campaign || campaign.status === 'completed' || campaign.status === 'cancelled') return '--';
    if (campaign.sent_count === 0) return '--';
    
    const remaining = campaign.total_contacts - campaign.sent_count - campaign.failed_count - campaign.no_whatsapp_count;
    if (remaining <= 0) return '0s';
    
    const intervalSeconds = parseInt(campaign.schedule_config?.interval_seconds || '5');
    const estimatedSeconds = remaining * intervalSeconds;
    return formatDuration(estimatedSeconds);
  };

  const getWaitingReason = (): { reason: string; color: string; details?: string } | null => {
    if (!activityLog || !campaign) return null;
    
    // ✅ PRIORIDADE 1: VERIFICAR SE ESTÁ PAUSADO MANUALMENTE (MAIS IMPORTANTE)
    if (campaign.status === 'paused') {
      return { 
        reason: '⏸️ PAUSADO MANUALMENTE', 
        color: 'text-orange-400',
        details: 'Clique em "Retomar" para continuar'
      };
    }
    
    // ✅ PRIORIDADE 2: VERIFICAR SE ESTÁ CANCELADO
    if (campaign.status === 'cancelled') {
      return { 
        reason: '🛑 CANCELADO', 
        color: 'text-red-400',
        details: 'Campanha foi cancelada'
      };
    }
    
    // ✅ PRIORIDADE 3: VERIFICAR SE ESTÁ CONCLUÍDO
    if (campaign.status === 'completed') {
      return { 
        reason: '✅ CONCLUÍDO', 
        color: 'text-green-400',
        details: 'Todas as mensagens foram enviadas'
      };
    }
    
    // PRIORIDADE 4: VERIFICAR SE ESTÁ FORA DO HORÁRIO
    if (activityLog.currentStatus === 'outside_hours') {
      return { 
        reason: '🌙 FORA DO HORÁRIO', 
        color: 'text-blue-400',
        details: activityLog.statusDetails?.workHours ? `Horário: ${activityLog.statusDetails.workHours}` : undefined
      };
    }
    
    // PRIORIDADE 5: VERIFICAR SE ESTÁ EM PAUSA AUTOMÁTICA
    if (activityLog.currentStatus === 'pause_programmed' && activityLog.statusDetails?.pauseRemainingSeconds > 0) {
      const minutes = Math.floor(activityLog.statusDetails.pauseRemainingSeconds / 60);
      const seconds = activityLog.statusDetails.pauseRemainingSeconds % 60;
      return { 
        reason: '⏸️ PAUSA AUTOMÁTICA', 
        color: 'text-orange-400',
        details: `Restam: ${minutes}min ${seconds}s`
      };
    }
    
    // PRIORIDADE 6: VERIFICAR SE ESTÁ ENVIANDO (MENOR PRIORIDADE)
    if (activityLog.currentStatus === 'sending' && campaign.status === 'running') {
      const intervalSecs = activityLog.intervalInfo?.intervalSeconds || parseInt(campaign.schedule_config?.interval_seconds || '5');
      return { 
        reason: '🔄 ENVIANDO', 
        color: 'text-green-400',
        details: `Intervalo: ${intervalSecs}s entre mensagens`
      };
    }
    
    return null;
  };

  const loadCampaign = async () => {
    try {
      const response = await api.get(`/qr-campaigns/${id}`);
      if (response.data.success) {
        setCampaign(response.data.data);
      }
    } catch (error) {
      console.error('Erro ao carregar campanha:', error);
      toast.error('Erro ao carregar campanha');
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async () => {
    try {
      const response = await api.get(`/qr-campaigns/${id}/messages`);
      if (response.data.success) {
        setMessages(response.data.data);
      }
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
    }
  };

  const loadActivityLog = async () => {
    try {
      const response = await api.get(`/qr-campaigns/${id}/activity-log`);
      if (response.data.success) {
        setActivityLog(response.data.data);
        
        // Calcular tempo para próxima mensagem (intervalo)
        if (response.data.data?.intervalInfo?.nextMessageIn !== undefined) {
          setNextMessageTime(response.data.data.intervalInfo.nextMessageIn);
        }
        
        // Calcular tempo restante da pausa
        if (response.data.data?.statusDetails?.pauseRemainingSeconds !== undefined) {
          setPauseEndTime(response.data.data.statusDetails.pauseRemainingSeconds);
        } else {
          setPauseEndTime(null);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar log de atividades:', error);
    }
  };

  const loadButtonsStats = async () => {
    try {
      const response = await api.get(`/qr-campaigns/${id}/buttons-stats`);
      if (response.data.success) {
        setButtonsStats(response.data.data);
      }
    } catch (error) {
      console.error('Erro ao carregar estatísticas de botões:', error);
    }
  };

  const loadAllContacts = async () => {
    if (loadingContacts) return;
    
    setLoadingContacts(true);
    try {
      const response = await api.get(`/qr-campaigns/${id}/contacts`);
      if (response.data.success) {
        setAllContacts(response.data.data);
        setShowAllContacts(true);
      } else {
        toast.error('Erro ao carregar contatos: ' + response.data.error);
      }
    } catch (error) {
      console.error('Erro ao carregar contatos:', error);
      toast.error('Erro ao carregar contatos da campanha');
    } finally {
      setLoadingContacts(false);
    }
  };

  const handlePause = async () => {
    const confirmed = await confirm({
      title: 'Pausar Campanha',
      message: 'Deseja pausar esta campanha? Você poderá retomá-la depois.',
      type: 'warning',
      confirmText: 'Sim, Pausar',
      cancelText: 'Cancelar'
    });
    
    if (!confirmed) return;
    
    try {
      const response = await api.post(`/qr-campaigns/${id}/pause`);
      if (response.data.success) {
        toast.success('Campanha pausada com sucesso!');
        loadCampaign();
      } else {
        toast.error('Erro ao pausar campanha: ' + response.data.error);
      }
    } catch (error: any) {
      toast.error('Erro: ' + error.message);
    }
  };

  const handleResume = async () => {
    const confirmed = await confirm({
      title: 'Retomar Campanha',
      message: 'Deseja retomar esta campanha? Ela continuará de onde parou.',
      type: 'info',
      confirmText: 'Sim, Retomar',
      cancelText: 'Cancelar'
    });
    
    if (!confirmed) return;
    
    try {
      const response = await api.post(`/qr-campaigns/${id}/resume`);
      if (response.data.success) {
        toast.success('Campanha retomada com sucesso!');
        loadCampaign();
      } else {
        toast.error('Erro ao retomar campanha: ' + response.data.error);
      }
    } catch (error: any) {
      toast.error('Erro: ' + error.message);
    }
  };

  const handleCancel = async () => {
    const confirmed = await confirm({
      title: '⚠️ ATENÇÃO: Cancelar Campanha',
      message: 'Deseja CANCELAR esta campanha?\n\n❌ Esta ação não pode ser desfeita!',
      type: 'danger',
      confirmText: 'Sim, Cancelar Campanha',
      cancelText: 'Não'
    });
    
    if (!confirmed) return;
    
    try {
      const response = await api.post(`/qr-campaigns/${id}/cancel`);
      if (response.data.success) {
        toast.success('Campanha cancelada com sucesso!');
        loadCampaign();
      } else {
        toast.error('Erro ao cancelar campanha: ' + response.data.error);
      }
    } catch (error: any) {
      toast.error('Erro: ' + error.message);
    }
  };

  const handleReactivateInstance = async (instanceId: number, instanceName: string) => {
    const confirmed = await confirm({
      title: 'Reativar Instância',
      message: `Deseja reativar manualmente a instância ${instanceName}?\n\nEla voltará a enviar mensagens nesta campanha.`,
      type: 'info',
      confirmText: 'Sim, Reativar',
      cancelText: 'Cancelar'
    });
    
    if (!confirmed) return;
    
    try {
      const response = await api.post(`/qr-campaigns/${id}/add-account`, { accountId: instanceId });
      if (response.data.success) {
        toast.success(`✅ Instância ${instanceName} reativada com sucesso!`);
        loadCampaign();
        loadActivityLog();
      } else {
        toast.error('Erro ao reativar instância: ' + response.data.error);
      }
    } catch (error: any) {
      toast.error('Erro: ' + error.message);
    }
  };

  const getStatusBadge = (status: string) => {
    // ✅ PRIORIDADE 1: VERIFICAR STATUS DA CAMPANHA PRIMEIRO (MAIS CONFIÁVEL)
    if (status === 'paused') {
      return (
        <span className="px-4 py-2 rounded-xl text-sm font-bold border-2 bg-orange-500/20 text-orange-300 border-orange-500/30 inline-flex items-center gap-2">
          <span className="text-lg">⏸️</span>
          Pausado
        </span>
      );
    }
    
    if (status === 'cancelled') {
      return (
        <span className="px-4 py-2 rounded-xl text-sm font-bold border-2 bg-red-500/20 text-red-300 border-red-500/30 inline-flex items-center gap-2">
          <span className="text-lg">🛑</span>
          Cancelado
        </span>
      );
    }
    
    if (status === 'completed') {
      return (
        <span className="px-4 py-2 rounded-xl text-sm font-bold border-2 bg-emerald-500/20 text-emerald-300 border-emerald-500/30 inline-flex items-center gap-2">
          <span className="text-lg">✅</span>
          Concluído
        </span>
      );
    }
    
    // PRIORIDADE 2: VERIFICAR STATUS DO ACTIVITY LOG (PARA CAMPANHAS EM EXECUÇÃO)
    if (activityLog && status === 'running') {
      if (activityLog.currentStatus === 'outside_hours') {
        return (
          <span className="px-4 py-2 rounded-xl text-sm font-bold border-2 bg-blue-500/20 text-blue-300 border-blue-500/30 inline-flex items-center gap-2">
            <span className="text-lg">🌙</span>
            Fora do Horário
          </span>
        );
      }
      
      if (activityLog.currentStatus === 'pause_programmed') {
        return (
          <span className="px-4 py-2 rounded-xl text-sm font-bold border-2 bg-yellow-500/20 text-yellow-300 border-yellow-500/30 inline-flex items-center gap-2">
            <span className="text-lg">⏸️</span>
            Pausa Programada
          </span>
        );
      }
      
      if (activityLog.currentStatus === 'sending') {
        return (
          <span className="px-4 py-2 rounded-xl text-sm font-bold border-2 bg-green-500/20 text-green-300 border-green-500/30 inline-flex items-center gap-2">
            <span className="text-lg">🔄</span>
            Enviando
          </span>
        );
      }
    }
    
    const badges: Record<string, { color: string; icon: React.ReactNode; text: string }> = {
      pending: { color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30', icon: '⏳', text: 'Pendente' },
      scheduled: { color: 'bg-blue-500/20 text-blue-300 border-blue-500/30', icon: '📅', text: 'Agendada' },
      running: { color: 'bg-green-500/20 text-green-300 border-green-500/30', icon: <FaRocket className="text-lg" />, text: 'Em Execucao' },
      paused: { color: 'bg-orange-500/20 text-orange-300 border-orange-500/30', icon: '⏸️', text: 'Pausada' },
      completed: { color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', icon: '✅', text: 'Concluída' },
      cancelled: { color: 'bg-red-500/20 text-red-300 border-red-500/30', icon: '🚫', text: 'Cancelada' },
      failed: { color: 'bg-red-500/20 text-red-300 border-red-500/30', icon: '❌', text: 'Falhou' },
    };

    const badge = badges[status] || badges.pending;

    return (
      <span className={`px-4 py-2 rounded-xl text-sm font-bold border-2 ${badge.color} inline-flex items-center gap-2`}>
        <span className="text-lg">{badge.icon}</span>
        {badge.text}
      </span>
    );
  };

  const getMessageStatusBadge = (status: string) => {
    const badges: Record<string, { color: string; text: string }> = {
      pending: { color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30', text: 'Pendente' },
      sent: { color: 'bg-green-500/20 text-green-300 border-green-500/30', text: 'Enviada' },
      delivered: { color: 'bg-blue-500/20 text-blue-300 border-blue-500/30', text: 'Entregue' },
      read: { color: 'bg-purple-500/20 text-purple-300 border-purple-500/30', text: 'Lida' },
      failed: { color: 'bg-red-500/20 text-red-300 border-red-500/30', text: 'Falhou' },
      no_whatsapp: { color: 'bg-orange-500/20 text-orange-300 border-orange-500/30', text: '📵 Sem WhatsApp' },
    };

    const badge = badges[status] || badges.pending;

    return (
      <span className={`px-3 py-1 rounded-lg text-xs font-bold border ${badge.color}`}>
        {badge.text}
      </span>
    );
  };

  const formatErrorMessage = (errorMessage: string | null | undefined) => {
    if (!errorMessage || errorMessage === '-') return '-';
    
    if (errorMessage.includes('131026') || errorMessage.toLowerCase().includes('undeliverable')) {
      return '📵 Conta sem WhatsApp';
    }
    
    if (errorMessage.toLowerCase().includes('not registered')) {
      return '📵 Número não registrado no WhatsApp';
    }
    
    if (errorMessage.toLowerCase().includes('invalid phone')) {
      return '❌ Número inválido';
    }
    
    return errorMessage;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return format(new Date(dateString), 'dd/MM/yyyy HH:mm:ss');
  };

  const getProgress = () => {
    if (!campaign || campaign.total_contacts === 0) return 0;
    // Progresso = mensagens processadas (enviadas + falhadas + sem WhatsApp) / total
    const processed = (campaign.sent_count || 0) + (campaign.failed_count || 0) + (campaign.no_whatsapp_count || 0);
    const progress = Math.round((processed / campaign.total_contacts) * 100);
    return Math.min(100, Math.max(0, progress)); // Garantir que fique entre 0 e 100
  };

  const filteredMessages = filterStatus === 'all' 
    ? messages 
    : messages.filter(m => m.status === filterStatus);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-20 w-20 border-b-4 border-primary-500 mb-4"></div>
          <p className="text-2xl text-white/70">Carregando detalhes da campanha...</p>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">❌</div>
          <p className="text-2xl text-red-400 mb-6">Campanha não encontrada</p>
          <Link href="/qr-campanhas" className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white text-lg font-bold rounded-xl transition-all duration-200 shadow-lg shadow-primary-500/40">
            <FaArrowLeft />
            Voltar para Campanhas
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 py-8 px-4">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* 🎨 CABEÇALHO COM BOTÃO VOLTAR */}
        <div>
          <Link href="/qr-campanhas" className="inline-flex items-center gap-3 px-6 py-3 bg-dark-700/60 hover:bg-dark-700 backdrop-blur-xl border-2 border-white/10 hover:border-primary-500/50 text-white text-base font-bold rounded-xl transition-all duration-200 mb-6">
            <FaArrowLeft className="text-lg" />
            Voltar
          </Link>

          <div className="relative overflow-hidden bg-gradient-to-r from-primary-600/30 via-primary-500/20 to-primary-600/30 backdrop-blur-xl border-2 border-primary-500/40 rounded-3xl p-10 shadow-2xl shadow-primary-500/20">
            <div className="absolute inset-0 bg-grid-white/[0.02]"></div>
            <div className="relative">
              <div className="flex items-start justify-between flex-wrap gap-6">
                <div className="flex-1">
                  <h1 className="text-5xl font-black text-white mb-4">{campaign.name} - QR Connect</h1>
                  <div className="flex items-center gap-4 flex-wrap">
                    {getStatusBadge(campaign.status)}
                    <span className="text-lg text-white/70">
                      <strong>Criada:</strong> {formatDate(campaign.created_at)}
                    </span>
                  </div>
                </div>

                <div className="flex gap-3 flex-wrap">
                  {/* Botão Ver Todos os Contatos - Sempre visível */}
                  <button
                    onClick={loadAllContacts}
                    disabled={loadingContacts}
                    className="px-6 py-4 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border-2 border-purple-500/40 rounded-xl font-bold transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loadingContacts ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-300"></div>
                        Carregando...
                      </>
                    ) : (
                      <>
                        <FaListUl className="text-xl" />
                        Ver Todos os Contatos
                      </>
                    )}
                  </button>
                  
                  {(campaign.status === 'running' || campaign.status === 'paused') && (
                    <button
                      onClick={() => setManagingInstances(true)}
                      className="px-6 py-4 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border-2 border-blue-500/40 rounded-xl font-bold transition-all duration-200 flex items-center gap-2"
                    >
                      <FaUsers className="text-xl" />
                      Gerenciar Instâncias
                    </button>
                  )}

                  {(campaign.status === 'running' || campaign.status === 'scheduled' || campaign.status === 'pending') && (
                    <button onClick={handlePause} className="px-6 py-4 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border-2 border-yellow-500/40 rounded-xl font-bold transition-all duration-200 flex items-center gap-2">
                      <FaPause className="text-xl" />
                      Pausar
                    </button>
                  )}

                  {campaign.status === 'paused' && (
                    <button onClick={handleResume} className="px-6 py-4 bg-green-500/20 hover:bg-green-500/30 text-green-300 border-2 border-green-500/40 rounded-xl font-bold transition-all duration-200 flex items-center gap-2">
                      <FaPlay className="text-xl" />
                      Retomar
                    </button>
                  )}

                  {(campaign.status === 'running' || campaign.status === 'paused' || campaign.status === 'scheduled' || campaign.status === 'pending') && (
                    <button onClick={handleCancel} className="px-6 py-4 bg-red-500/20 hover:bg-red-500/30 text-red-300 border-2 border-red-500/40 rounded-xl font-bold transition-all duration-200 flex items-center gap-2">
                      <FaBan className="text-xl" />
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* INFORMAÇÕES DA CAMPANHA */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-8 shadow-xl">
            <h3 className="text-2xl font-black mb-6 flex items-center gap-3">
              <span className="text-3xl">📅</span>
              Datas
            </h3>
            <div className="space-y-4 text-base">
              {campaign.scheduled_at && (
                <p className="flex items-center gap-2">
                  <span className="text-white/60">⏰ Agendada para:</span> 
                  <strong className="text-white">{formatDate(campaign.scheduled_at)}</strong>
                </p>
              )}
              {campaign.started_at && (
                <p className="flex items-center gap-2">
                  <span className="text-white/60">🚀 Iniciada em:</span> 
                  <strong className="text-white">{formatDate(campaign.started_at)}</strong>
                </p>
              )}
              {campaign.completed_at && (
                <p className="flex items-center gap-2">
                  <span className="text-white/60">✅ Concluída em:</span> 
                  <strong className="text-white">{formatDate(campaign.completed_at)}</strong>
                </p>
              )}
            </div>
          </div>

          <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-8 shadow-xl">
            <h3 className="text-2xl font-black mb-6 flex items-center gap-3">
              <span className="text-3xl">⚙️</span>
              Configurações
            </h3>
            <div className="space-y-4 text-base">
              {campaign.schedule_config && (
                <>
                  <p className="flex items-center gap-2">
                    <span className="text-white/60">🕐 Horário:</span> 
                    <strong className="text-white">{campaign.schedule_config.work_start_time} - {campaign.schedule_config.work_end_time}</strong>
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="text-white/60">⏱️ Intervalo:</span> 
                    <strong className="text-white">{campaign.schedule_config.interval_seconds}s entre envios</strong>
                  </p>
                </>
              )}
              {campaign.pause_config && campaign.pause_config.pause_after > 0 && (
                <p className="flex items-center gap-2">
                  <span className="text-white/60">💤 Pausa:</span> 
                  <strong className="text-white">A cada {campaign.pause_config.pause_after} mensagens por {campaign.pause_config.pause_duration_minutes} min</strong>
                </p>
              )}
              
              {/* TEMPO PARA PRÓXIMA MENSAGEM */}
              {nextMessageTime !== null && nextMessageTime > 0 && campaign.status === 'running' && (
                <div className="mt-6 pt-4 border-t border-white/10">
                  <p className="flex items-center gap-2">
                    <span className="text-white/60">⏳ Próxima mensagem em:</span>
                  </p>
                  <p className="text-3xl font-black text-cyan-400 mt-2 animate-pulse">
                    {formatTimeRemaining(nextMessageTime)}
                  </p>
                </div>
              )}
              
              {/* TEMPO RESTANTE DA PAUSA */}
              {pauseEndTime !== null && pauseEndTime > 0 && (
                <div className="mt-6 pt-4 border-t border-white/10">
                  <p className="flex items-center gap-2">
                    <span className="text-white/60">💤 Tempo restante da pausa:</span>
                  </p>
                  <p className="text-3xl font-black text-orange-400 mt-2 animate-pulse">
                    {formatTimeRemaining(pauseEndTime)}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* PROGRESSO E ESTATÍSTICAS */}
        <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-primary-500/30 rounded-2xl p-8 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-3xl font-black text-white flex items-center gap-3">
              <span className="text-4xl">📊</span>
              Progresso
            </h3>
            <span className="text-5xl font-black text-primary-300">{getProgress()}%</span>
          </div>
          <div className="w-full bg-dark-700 rounded-xl h-6 overflow-hidden mb-8 border-2 border-white/10">
            <div
              className="bg-gradient-to-r from-primary-500 to-primary-600 h-full transition-all duration-500 rounded-lg"
              style={{ width: `${getProgress()}%` }}
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md border-2 border-white/10 rounded-xl p-5 text-center hover:border-white/20 transition-all">
              <div className="text-4xl font-black text-white mb-2">{campaign.total_contacts}</div>
              <div className="text-sm font-bold text-white/70">👥 Total</div>
            </div>
            
            <div className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 backdrop-blur-md border-2 border-yellow-500/20 rounded-xl p-5 text-center hover:border-yellow-500/40 transition-all">
              <div className="text-4xl font-black text-yellow-400 mb-2">{Math.max(0, campaign.total_contacts - (campaign.sent_count || 0) - (campaign.failed_count || 0) - (campaign.no_whatsapp_count || 0))}</div>
              <div className="text-sm font-bold text-yellow-300">⏳ Pendentes</div>
            </div>
            
            <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 backdrop-blur-md border-2 border-blue-500/20 rounded-xl p-5 text-center hover:border-blue-500/40 transition-all">
              <div className="text-4xl font-black text-blue-400 mb-2">{campaign.sent_count}</div>
              <div className="text-sm font-bold text-blue-300">📤 Enviadas</div>
            </div>
            
            <div className="bg-gradient-to-br from-green-500/10 to-green-600/5 backdrop-blur-md border-2 border-green-500/20 rounded-xl p-5 text-center hover:border-green-500/40 transition-all">
              <div className="text-4xl font-black text-green-400 mb-2">{campaign.delivered_count}</div>
              <div className="text-sm font-bold text-green-300">✅ Entregues</div>
            </div>
            
            <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 backdrop-blur-md border-2 border-purple-500/20 rounded-xl p-5 text-center hover:border-purple-500/40 transition-all">
              <div className="text-4xl font-black text-purple-400 mb-2">{campaign.read_count}</div>
              <div className="text-sm font-bold text-purple-300">👁️ Lidas</div>
            </div>
            
            <div className="bg-gradient-to-br from-red-500/10 to-red-600/5 backdrop-blur-md border-2 border-red-500/20 rounded-xl p-5 text-center hover:border-red-500/40 transition-all">
              <div className="text-4xl font-black text-red-400 mb-2">{campaign.failed_count}</div>
              <div className="text-sm font-bold text-red-300">❌ Falhas</div>
            </div>
            
            <div className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 backdrop-blur-md border-2 border-orange-500/20 rounded-xl p-5 text-center hover:border-orange-500/40 transition-all">
              <div className="text-4xl font-black text-orange-400 mb-2">{campaign.no_whatsapp_count || 0}</div>
              <div className="text-sm font-bold text-orange-300">📵 Sem WhatsApp</div>
            </div>
          </div>
        </div>

        {/* PAINEL DE TEMPO E STATUS (APENAS PARA CAMPANHAS ATIVAS) */}
        {campaign && (campaign.status === 'running' || campaign.status === 'paused') && (
          <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-8 shadow-xl">
            <h3 className="text-3xl font-black mb-8 flex items-center gap-3">
              <span className="text-4xl">⏱️</span>
              Tempo e Status
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 backdrop-blur-md border-2 border-blue-500/30 rounded-2xl p-6 hover:border-blue-500/50 transition-all">
                <div className="flex items-center gap-3 mb-4">
                  <FaClock className="text-3xl text-blue-400" />
                  <span className="text-base font-bold text-white/70">Tempo Decorrido</span>
                </div>
                <div className="text-4xl font-black text-blue-300 mb-2">{getElapsedTime()}</div>
                {campaign.started_at && (
                  <div className="text-sm text-white/50">
                    Início: {format(new Date(campaign.started_at), 'HH:mm:ss')}
                  </div>
                )}
              </div>

              <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 backdrop-blur-md border-2 border-green-500/30 rounded-2xl p-6 hover:border-green-500/50 transition-all">
                <div className="flex items-center gap-3 mb-4">
                  <FaClock className="text-3xl text-green-400" />
                  <span className="text-base font-bold text-white/70">Tempo Restante</span>
                </div>
                <div className="text-4xl font-black text-green-300 mb-2">{getEstimatedTimeRemaining()}</div>
                <div className="text-sm text-white/50">
                  Faltam {campaign.total_contacts - (campaign.sent_count + campaign.failed_count + campaign.no_whatsapp_count)} contatos
                </div>
              </div>

              <div className={`bg-gradient-to-br ${
                getWaitingReason() 
                  ? 'from-orange-500/20 to-orange-600/10 border-orange-500/30' 
                  : 'from-purple-500/20 to-purple-600/10 border-purple-500/30'
              } backdrop-blur-md border-2 rounded-2xl p-6 hover:border-opacity-50 transition-all`}>
                <div className="flex items-center gap-3 mb-4">
                  {getWaitingReason() ? (
                    <FaPause className={`text-3xl ${getWaitingReason()?.color || 'text-orange-400'}`} />
                  ) : (
                    <FaPlay className="text-3xl text-purple-400" />
                  )}
                  <span className="text-base font-bold text-white/70">Status Atual</span>
                </div>
                <div className={`text-2xl font-black mb-2 ${getWaitingReason()?.color || 'text-purple-300'}`}>
                  {getWaitingReason()?.reason || '▶️ ENVIANDO'}
                </div>
                {getWaitingReason()?.details && (
                  <div className="text-sm text-white/50">
                    {getWaitingReason()?.details}
                  </div>
                )}
              </div>

              <div className="bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 backdrop-blur-md border-2 border-cyan-500/30 rounded-2xl p-6 hover:border-cyan-500/50 transition-all">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-3xl">⏳</span>
                  <span className="text-base font-bold text-white/70">Configurações</span>
                </div>
                
                <div className="mb-3">
                  <div className="text-sm text-white/60 mb-1">Intervalo:</div>
                  <div className="text-2xl font-black text-cyan-300">
                    {activityLog?.intervalInfo?.intervalSeconds || campaign.schedule_config?.interval_seconds || 5}s
                  </div>
                </div>
                
                {activityLog?.intervalInfo && activityLog.intervalInfo.pauseAfter > 0 && (
                  <div className="pt-3 border-t border-white/10">
                    <div className="text-sm text-white/60 mb-1">Pausa a cada:</div>
                    <div className="text-lg font-bold text-cyan-300">
                      {activityLog.intervalInfo.pauseAfter} envios
                    </div>
                    {activityLog.intervalInfo.messagesUntilPause > 0 && (
                      <div className="text-xs text-white/50 mt-1">
                        Faltam {activityLog.intervalInfo.messagesUntilPause} para pausar {activityLog.intervalInfo.pauseDurationMinutes}min
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* LOG DE ATIVIDADES EM TEMPO REAL - INSTÂNCIAS */}
        {activityLog && (campaign.status === 'running' || campaign.status === 'paused') && activityLog.activeAccounts && activityLog.activeAccounts.length > 0 && (
          <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-8 shadow-xl">
            <h3 className="text-3xl font-black mb-8 flex items-center gap-3">
              <span className="text-4xl">📱</span>
              Instâncias Ativas ({activityLog.activeAccounts.filter(a => a.isActive).length}/{activityLog.activeAccounts.length})
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {activityLog.activeAccounts.map((instance) => {
                const getQualityColor = (quality: string) => {
                  if (quality === 'GREEN') return 'text-green-400';
                  if (quality === 'YELLOW') return 'text-yellow-400';
                  if (quality === 'RED') return 'text-red-400';
                  return 'text-gray-400';
                };

                const getStatusColor = (status: string) => {
                  if (status === 'CONECTADO') return 'text-green-400';
                  if (status === 'ATENÇÃO') return 'text-yellow-400';
                  return 'text-red-400';
                };
                
                const formatNumber = (num: number) => {
                  return num.toLocaleString('pt-BR');
                };

                return (
                  <div key={instance.id} className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md border-2 border-white/20 hover:border-primary-500/50 rounded-2xl p-6 shadow-xl transition-all duration-200">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3 flex-1">
                        <span className={`text-3xl ${instance.isActive ? 'text-green-400' : 'text-red-400'}`}>
                          {instance.isActive ? '🟢' : '🔴'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-lg font-black truncate text-white">{instance.name}</div>
                          <div className="text-sm text-white/60 truncate">{instance.phone}</div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 mb-4">
                      <div className="bg-white/5 rounded-xl p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-white/60 text-sm">📊 Qualidade</span>
                          <span className={`font-black text-sm ${getQualityColor(instance.qualityRating)}`}>
                            {instance.qualityRating === 'GREEN' && '🟢 ALTA'}
                            {instance.qualityRating === 'YELLOW' && '🟡 MÉDIA'}
                            {instance.qualityRating === 'RED' && '🔴 BAIXA'}
                            {instance.qualityRating === 'UNKNOWN' && '⚪ N/A'}
                          </span>
                        </div>
                      </div>
                      
                      <div className="bg-white/5 rounded-xl p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-white/60 text-sm">📱 Status</span>
                          <span className={`font-black text-sm ${getStatusColor(instance.accountStatus)}`}>
                            {instance.accountStatus === 'CONECTADO' && '✅'}
                            {instance.accountStatus === 'ATENÇÃO' && '⚠️'}
                            {instance.accountStatus === 'PROBLEMA' && '❌'}
                            {instance.accountStatus === 'NÃO VERIFICADO' && '❓'}
                            {' '}{instance.accountStatus}
                          </span>
                        </div>
                      </div>
                      
                      <div className="bg-white/5 rounded-xl p-3">
                        <div className="text-white/60 mb-2 text-sm font-bold">📈 Limites Diários</div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div>
                            <div className="font-black text-blue-400 text-lg">{formatNumber(instance.dailyLimit)}</div>
                            <div className="text-[10px] text-white/40 font-bold">Limite</div>
                          </div>
                          <div>
                            <div className="font-black text-yellow-400 text-lg">{formatNumber(instance.sentToday)}</div>
                            <div className="text-[10px] text-white/40 font-bold">Enviadas</div>
                          </div>
                          <div>
                            <div className={`font-black text-lg ${instance.remaining < 100 ? 'text-red-400' : 'text-green-400'}`}>
                              {formatNumber(instance.remaining)}
                            </div>
                            <div className="text-[10px] text-white/40 font-bold">Restam</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {instance.permanentRemoval && !instance.isActive && (
                      <div className="border-t border-white/10 pt-4">
                        <button
                          onClick={() => handleReactivateInstance(instance.id, instance.name)}
                          className="w-full px-4 py-3 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border-2 border-yellow-500/40 rounded-xl font-bold transition-all duration-200"
                        >
                          🔄 Reativar Manualmente
                        </button>
                        <div className="text-xs text-yellow-400 mt-2 text-center font-bold">
                          ⚠️ Instância removida permanentemente
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* BOTÕES DA CAMPANHA E RANKING */}
        {buttonsStats && buttonsStats.buttons && buttonsStats.buttons.length > 0 && (
          <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-8 shadow-xl">
            <h3 className="text-3xl font-black mb-8 flex items-center gap-3">
              <span className="text-4xl">🔘</span>
              Botões da Campanha
            </h3>
            
            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 backdrop-blur-md border-2 border-yellow-500/20 rounded-2xl p-6">
                <h4 className="text-2xl font-black mb-6 flex items-center gap-3">
                  <span className="text-3xl">🏆</span>
                  TOP 5 Mais Clicados
                </h4>
                
                <div className="space-y-4">
                  {buttonsStats.topButtons && buttonsStats.topButtons.slice(0, 5).map((button: any) => (
                    <div key={button.rank} className="bg-white/5 rounded-xl p-4 border-2 border-white/10 hover:border-yellow-500/30 transition-all">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className="text-3xl">
                            {button.rank === 1 && '🥇'}
                            {button.rank === 2 && '🥈'}
                            {button.rank === 3 && '🥉'}
                            {button.rank > 3 && `${button.rank}°`}
                          </span>
                          <div>
                            <div className="font-black text-base text-white">{button.text}</div>
                            {button.payload && (
                              <div className="text-xs text-white/40">{button.payload}</div>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-black text-green-400">{button.clickCount}</div>
                          <div className="text-xs text-white/60 font-bold">cliques</div>
                        </div>
                      </div>
                      
                      <div className="text-sm text-white/60 font-bold">
                        <span>👥</span> {button.uniqueContacts} contatos únicos
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 backdrop-blur-md border-2 border-blue-500/20 rounded-2xl p-6">
                <h4 className="text-2xl font-black mb-6 flex items-center gap-3">
                  <span className="text-3xl">📋</span>
                  Todos os Botões ({buttonsStats.buttons.length})
                </h4>
                
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                  {buttonsStats.buttons.map((button: any, index: number) => (
                    <div key={index} className="bg-white/5 rounded-xl p-4 flex items-center justify-between hover:bg-white/10 transition-all">
                      <div className="flex-1">
                        <div className="text-base font-bold text-white">{button.text}</div>
                        {button.payload && (
                          <div className="text-xs text-white/40">{button.payload}</div>
                        )}
                      </div>
                      <div className="text-right ml-4">
                        <div className="text-xl font-black text-blue-400">{button.clickCount}</div>
                        <div className="text-xs text-white/50 font-bold">👥 {button.uniqueContacts}</div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {buttonsStats.summary && (
                  <div className="mt-6 pt-6 border-t border-white/20">
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div>
                        <div className="text-2xl font-black text-blue-400">{buttonsStats.summary.totalButtons}</div>
                        <div className="text-xs text-white/60 font-bold">Total Botões</div>
                      </div>
                      <div>
                        <div className="text-2xl font-black text-green-400">{buttonsStats.summary.totalClicks}</div>
                        <div className="text-xs text-white/60 font-bold">Total Cliques</div>
                      </div>
                      <div>
                        <div className="text-2xl font-black text-yellow-400">{buttonsStats.summary.totalUniqueContacts}</div>
                        <div className="text-xs text-white/60 font-bold">Contatos Únicos</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* MENSAGENS */}
        <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-8 shadow-xl">
          <div className="flex justify-between items-center mb-8 flex-wrap gap-4">
            <h3 className="text-3xl font-black flex items-center gap-3">
              <span className="text-4xl">📨</span>
              Mensagens ({filteredMessages.length})
            </h3>
            
            <div className="flex gap-3">
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-6 py-3 rounded-xl font-bold transition-all duration-200 ${
                  filterStatus === 'all' 
                    ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/40' 
                    : 'bg-dark-700 text-white/70 hover:bg-dark-600'
                }`}
              >
                Todas ({messages.length})
              </button>
              <button
                onClick={() => setFilterStatus('sent')}
                className={`px-6 py-3 rounded-xl font-bold transition-all duration-200 ${
                  filterStatus === 'sent' 
                    ? 'bg-green-500 text-white shadow-lg shadow-green-500/40' 
                    : 'bg-dark-700 text-white/70 hover:bg-dark-600'
                }`}
              >
                Enviadas ({messages.filter(m => m.status === 'sent').length})
              </button>
              <button
                onClick={() => setFilterStatus('failed')}
                className={`px-6 py-3 rounded-xl font-bold transition-all duration-200 ${
                  filterStatus === 'failed' 
                    ? 'bg-red-500 text-white shadow-lg shadow-red-500/40' 
                    : 'bg-dark-700 text-white/70 hover:bg-dark-600'
                }`}
              >
                Falhas ({messages.filter(m => m.status === 'failed').length})
              </button>
              <button
                onClick={() => setFilterStatus('no_whatsapp')}
                className={`px-6 py-3 rounded-xl font-bold transition-all duration-200 ${
                  filterStatus === 'no_whatsapp' 
                    ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/40' 
                    : 'bg-dark-700 text-white/70 hover:bg-dark-600'
                }`}
              >
                Sem WhatsApp ({messages.filter(m => m.status === 'no_whatsapp').length})
              </button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[600px] overflow-y-auto custom-scrollbar">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-primary-600/20 to-primary-700/20 sticky top-0 z-10">
                <tr>
                  <th className="text-left p-4 text-base font-black">Número</th>
                  <th className="text-left p-4 text-base font-black">Template</th>
                  <th className="text-left p-4 text-base font-black">Instância</th>
                  <th className="text-center p-4 text-base font-black">Proxy</th>
                  <th className="text-left p-4 text-base font-black">Status</th>
                  <th className="text-left p-4 text-base font-black">Enviada em</th>
                  <th className="text-left p-4 text-base font-black">Erro</th>
                </tr>
              </thead>
              <tbody>
                {filteredMessages.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center p-12">
                      <div className="text-6xl mb-4">📭</div>
                      <p className="text-xl text-white/60 font-medium">Nenhuma mensagem encontrada</p>
                    </td>
                  </tr>
                ) : (
                  filteredMessages.map((message) => (
                    <tr key={message.id} className="border-b border-white/5 hover:bg-white/5 transition-all">
                      <td className="p-4 font-medium">{message.phone_number}</td>
                      <td className="p-4">{message.template_name}</td>
                      <td className="p-4">
                        <span className="text-blue-400 font-bold">{message.instance_name || '-'}</span>
                      </td>
                      <td className="p-4 text-center">
                        {message.proxy_used ? (
                          <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-500/20 border border-green-500/50 rounded-full">
                            <FaGlobe className="text-green-400" />
                            <span className="text-xs text-green-300 font-bold" title={`${message.proxy_host} (${message.proxy_type})`}>
                              Proxy
                            </span>
                          </div>
                        ) : (
                          <span className="text-white/30 text-xs">Direto</span>
                        )}
                      </td>
                      <td className="p-4">{getMessageStatusBadge(message.status)}</td>
                      <td className="p-4 text-sm text-white/60">
                        {message.sent_at ? formatDate(message.sent_at) : '-'}
                      </td>
                      <td className="p-4 text-sm">
                        <span className={message.error_message && message.error_message !== '-' ? 
                          (message.error_message.includes('131026') || message.error_message.toLowerCase().includes('undeliverable') || message.error_message.toLowerCase().includes('not registered') ? 
                            'text-yellow-400 font-bold' : 'text-red-400 font-bold') 
                          : 'text-white/40'}>
                          {formatErrorMessage(message.error_message)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />
      
      {/* Modal de Confirmação Elegante */}
      <ConfirmDialog />

      {managingInstances && (
        <CampaignInstancesManagerQR
          campaignId={campaign.id}
          onClose={() => {
            setManagingInstances(false);
            loadCampaign();
          }}
        />
      )}

      {/* Modal de Visualização de Todos os Contatos */}
      {showAllContacts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-gradient-to-br from-dark-800 to-dark-900 rounded-2xl shadow-2xl border-2 border-purple-500/50 max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-r from-purple-600/30 via-purple-500/20 to-purple-600/30 backdrop-blur-xl border-b-2 border-purple-500/50 p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="bg-purple-500/20 p-4 rounded-xl">
                    <FaListUl className="text-4xl text-purple-400" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-black text-purple-300">
                      Todos os Contatos da Campanha
                    </h2>
                    <p className="text-base text-white/70 mt-1">
                      Total: {allContacts.length} contato{allContacts.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAllContacts(false)}
                  className="text-white/70 hover:text-white transition-colors p-2"
                >
                  <FaTimes className="text-2xl" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {allContacts.length === 0 ? (
                <div className="text-center py-12">
                  <FaUsers className="text-6xl text-white/20 mx-auto mb-4" />
                  <p className="text-xl text-white/50">Nenhum contato encontrado nesta campanha</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {allContacts.map((contact, index) => (
                    <div
                      key={index}
                      className="bg-dark-700/60 border border-white/10 rounded-xl p-4 hover:bg-dark-700 transition-all duration-200 flex items-center gap-4"
                    >
                      <div className="bg-purple-500/20 p-3 rounded-lg">
                        <FaPhone className="text-purple-400 text-xl" />
                      </div>
                      <div className="flex-1">
                        <p className="text-lg font-bold text-white">{contact.phone}</p>
                        {contact.name && (
                          <p className="text-sm text-white/60">{contact.name}</p>
                        )}
                      </div>
                      <div className="text-sm text-white/40">
                        #{index + 1}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-dark-800/90 backdrop-blur-xl border-t-2 border-white/10 p-6">
              <button
                onClick={() => setShowAllContacts(false)}
                className="w-full py-4 px-6 bg-dark-700 hover:bg-dark-600 text-white font-bold rounded-xl transition-all duration-200 border-2 border-white/20 flex items-center justify-center gap-2"
              >
                <FaTimes className="text-xl" />
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
      
      <style jsx>{`
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
        .bg-grid-white {
          background-image: 
            linear-gradient(to right, rgba(255, 255, 255, 0.1) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.1) 1px, transparent 1px);
          background-size: 20px 20px;
        }
      `}</style>
    </div>
  );
}


