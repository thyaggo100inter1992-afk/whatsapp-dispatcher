import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { 
  FaChartBar, FaPlus, FaEye, FaClock, FaCheckCircle, FaTimesCircle, 
  FaPause, FaPlay, FaBan, FaEdit, FaTrash, FaTrashAlt, FaDownload,
  FaUserSlash, FaMousePointer, FaServer, FaArrowLeft
} from 'react-icons/fa';
import { qrCampaignsAPI } from '@/services/api';
import { format } from 'date-fns';
import { useToast } from '@/hooks/useToast';
import ToastContainer from '@/components/ToastContainer';
import { useConfirm } from '@/hooks/useConfirm';

interface QrCampaign {
  id: number;
  name: string;
  status: string;
  realStatus?: string; // Status real calculado pelo backend
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
  auto_remove_account_failures?: number;
  schedule_config?: any;
  pause_config?: any;
  created_at: string;
}

export default function QrCampanhas() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<QrCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCampaign, setEditingCampaign] = useState<QrCampaign | null>(null);
  const toast = useToast();
  const { confirm, ConfirmDialog } = useConfirm();
  const [editForm, setEditForm] = useState({
    name: '',
    scheduled_at: '',
    work_start_time: '08:00',
    work_end_time: '20:00',
    interval_seconds: '5',
    pause_after: '100',
    pause_duration_minutes: '30',
  });

  useEffect(() => {
    loadCampaigns();
    
    const interval = setInterval(() => {
      loadCampaigns();
    }, 3001);
    
    return () => clearInterval(interval);
  }, []);

  const loadCampaigns = async () => {
    try {
      const response = await qrCampaignsAPI.getAll();
      setCampaigns(response.data.data);
    } catch (error) {
      console.error('Erro ao carregar campanhas QR:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (campaign: QrCampaign) => {
    // Usar realStatus se disponível, caso contrário usar status
    const status = campaign.realStatus || campaign.status;

    const badges: Record<string, { color: string; icon: any; text: string }> = {
      pending: { color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30', icon: '⏳', text: 'Pendente' },
      scheduled: { color: 'bg-blue-500/20 text-blue-300 border-blue-500/30', icon: '📅', text: 'Agendada' },
      running: { color: 'bg-green-500/20 text-green-300 border-green-500/30', icon: '🚀', text: 'Em Execução' },
      paused: { color: 'bg-orange-500/20 text-orange-300 border-orange-500/30', icon: '⏸️', text: 'Pausada' },
      completed: { color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', icon: '✅', text: 'Concluída' },
      cancelled: { color: 'bg-red-500/20 text-red-300 border-red-500/30', icon: '🚫', text: 'Cancelada' },
      failed: { color: 'bg-red-500/20 text-red-300 border-red-500/30', icon: '❌', text: 'Falhou' },
      outside_hours: { color: 'bg-purple-500/20 text-purple-300 border-purple-500/30', icon: '🌙', text: 'Fora do Horário' },
      pause_programmed: { color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30', icon: '⏰', text: 'Pausa Programada' },
    };

    const badge = badges[status] || badges.pending;

    return (
      <span className={`px-4 py-2 rounded-xl text-sm font-bold border-2 ${badge.color} inline-flex items-center gap-2`}>
        <span className="text-lg">{badge.icon}</span>
        {badge.text}
      </span>
    );
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return format(new Date(dateString), 'dd/MM/yyyy HH:mm');
  };

  const getProgress = (campaign: QrCampaign) => {
    if (campaign.total_contacts === 0) return 0;
    const processed = campaign.sent_count + campaign.failed_count + campaign.no_whatsapp_count;
    return Math.round((processed / campaign.total_contacts) * 100);
  };

  const handlePause = async (campaignId: number) => {
    const confirmed = await confirm({
      title: 'Pausar Campanha',
      message: 'Deseja pausar esta campanha? Você poderá retomá-la depois.',
      type: 'warning',
      confirmText: 'Sim, Pausar',
      cancelText: 'Cancelar'
    });
    
    if (!confirmed) return;
    
    try {
      await qrCampaignsAPI.pause(campaignId);
      toast.success('✅ Campanha pausada com sucesso!');
      loadCampaigns();
    } catch (error: any) {
      toast.error('❌ Erro ao pausar campanha: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleResume = async (campaignId: number) => {
    const confirmed = await confirm({
      title: 'Retomar Campanha',
      message: 'Deseja retomar esta campanha? Ela continuará de onde parou.',
      type: 'info',
      confirmText: 'Sim, Retomar',
      cancelText: 'Cancelar'
    });
    
    if (!confirmed) return;
    
    try {
      await qrCampaignsAPI.resume(campaignId);
      toast.success('✅ Campanha retomada com sucesso!');
      loadCampaigns();
    } catch (error: any) {
      toast.error('❌ Erro ao retomar campanha: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleCancel = async (campaignId: number) => {
    const confirmed = await confirm({
      title: '⚠️ ATENÇÃO: Cancelar Campanha',
      message: 'Deseja CANCELAR esta campanha?\n\n❌ Esta ação não pode ser desfeita!',
      type: 'danger',
      confirmText: 'Sim, Cancelar Campanha',
      cancelText: 'Não'
    });
    
    if (!confirmed) return;
    
    try {
      await qrCampaignsAPI.cancel(campaignId);
      toast.success('✅ Campanha cancelada com sucesso!');
      loadCampaigns();
    } catch (error: any) {
      toast.error('❌ Erro ao cancelar campanha: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleDownloadReport = async (campaignId: number, campaignName: string) => {
    try {
      toast.info(`📊 Gerando relatório da campanha "${campaignName}"...`);

      const response = await qrCampaignsAPI.downloadReport(campaignId);
      
      // Criar blob e fazer download
      const blob = new Blob([response.data], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Relatorio_CampanhaQR_${campaignName.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success(`✅ Relatório baixado com sucesso!`);
    } catch (error: any) {
      console.error('Erro ao baixar relatório:', error);
      toast.error(`❌ Erro ao baixar relatório: ${error.response?.data?.error || error.message}`);
    }
  };

  const handleDelete = async (campaignId: number, campaignName: string) => {
    const confirmed = await confirm({
      title: '🗑️ EXCLUIR PERMANENTEMENTE',
      message: (
        <div>
          <p className="mb-4 text-lg font-bold">
            Deseja EXCLUIR PERMANENTEMENTE a campanha "{campaignName}"?
          </p>
          <div className="bg-dark-700/50 rounded-lg p-4 mb-4">
            <p className="font-bold mb-2 text-yellow-300">🗑️ Esta ação irá remover:</p>
            <ul className="list-disc list-inside space-y-1 text-white/80">
              <li>A campanha</li>
              <li>Todas as mensagens</li>
              <li>Todos os dados relacionados</li>
            </ul>
          </div>
          <p className="text-red-400 font-black text-lg">
            ❌ ESTA AÇÃO NÃO PODE SER DESFEITA!
          </p>
        </div>
      ),
      type: 'danger',
      confirmText: 'Sim, Excluir Permanentemente',
      cancelText: 'Cancelar'
    });
    
    if (!confirmed) return;
    
    try {
      await qrCampaignsAPI.delete(campaignId);
      toast.success('✅ Campanha excluída com sucesso!');
      loadCampaigns();
    } catch (error: any) {
      toast.error('❌ Erro ao excluir campanha: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleDeleteAllFinished = async () => {
    const finishedCampaigns = campaigns.filter(c => c.status === 'completed' || c.status === 'cancelled');
    
    if (finishedCampaigns.length === 0) {
      toast.info('ℹ️ Nenhuma campanha finalizada para excluir');
      return;
    }

    const confirmed = await confirm({
      title: '🗑️ EXCLUIR TODAS CAMPANHAS FINALIZADAS',
      message: (
        <div>
          <p className="mb-4 text-lg font-bold">
            Deseja EXCLUIR TODAS as {finishedCampaigns.length} campanha(s) finalizada(s)?
          </p>
          <div className="bg-dark-700/50 rounded-lg p-4 mb-4">
            <p className="font-bold mb-2 text-yellow-300">🗑️ Esta ação irá remover:</p>
            <ul className="list-disc list-inside space-y-1 text-white/80">
              <li>{finishedCampaigns.length} campanha(s) concluída(s) ou cancelada(s)</li>
              <li>Todas as mensagens destas campanhas</li>
              <li>Todos os dados relacionados</li>
            </ul>
          </div>
          <p className="text-red-400 font-black text-lg">
            ❌ ESTA AÇÃO NÃO PODE SER DESFEITA!
          </p>
        </div>
      ),
      type: 'danger',
      confirmText: `Sim, Excluir ${finishedCampaigns.length} Campanhas`,
      cancelText: 'Cancelar'
    });
    
    if (!confirmed) return;
    
    try {
      const response = await qrCampaignsAPI.deleteAllFinished();
      const deletedCount = response.data.data.deleted_count;
      toast.success(`✅ ${deletedCount} campanha(s) excluída(s) com sucesso!`);
      loadCampaigns();
    } catch (error: any) {
      toast.error('❌ Erro ao excluir campanhas: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleOpenEdit = (campaign: QrCampaign) => {
    setEditingCampaign(campaign);
    
    const scheduleConfig = campaign.schedule_config || {};
    const pauseConfig = campaign.pause_config || {};
    
    setEditForm({
      name: campaign.name,
      scheduled_at: campaign.scheduled_at ? campaign.scheduled_at.split('T')[0] + 'T' + campaign.scheduled_at.split('T')[1].substring(0, 5) : '',
      work_start_time: scheduleConfig.work_start_time || '08:00',
      work_end_time: scheduleConfig.work_end_time || '20:00',
      interval_seconds: String(scheduleConfig.interval_seconds || 5),
      pause_after: String(pauseConfig.pause_after || 100),
      pause_duration_minutes: String(pauseConfig.pause_duration_minutes || 30),
    });
  };

  const handleCloseEdit = () => {
    setEditingCampaign(null);
  };

  const handleSaveEdit = async () => {
    if (!editingCampaign) return;
    
    try {
      const data = {
        name: editForm.name,
        scheduled_at: editForm.scheduled_at || null,
        schedule_config: {
          work_start_time: editForm.work_start_time,
          work_end_time: editForm.work_end_time,
          interval_seconds: parseInt(editForm.interval_seconds),
        },
        pause_config: {
          pause_after: parseInt(editForm.pause_after),
          pause_duration_minutes: parseInt(editForm.pause_duration_minutes),
        },
      };

      await qrCampaignsAPI.edit(editingCampaign.id, data);
      toast.success('✅ Campanha editada com sucesso!');
      handleCloseEdit();
      loadCampaigns();
    } catch (error: any) {
      toast.error('❌ Erro ao editar campanha: ' + (error.response?.data?.error || error.message));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-20 w-20 border-b-4 border-primary-500 mb-4"></div>
          <p className="text-2xl text-white/70">Carregando campanhas QR...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 py-8 px-4">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* CABEÇALHO PRINCIPAL */}
        <div className="relative overflow-hidden bg-gradient-to-r from-primary-600/30 via-primary-500/20 to-primary-600/30 backdrop-blur-xl border-2 border-primary-500/40 rounded-3xl p-10 shadow-2xl shadow-primary-500/20">
          <div className="absolute inset-0 bg-grid-white/[0.02]"></div>
          <div className="relative">
            <div className="flex items-center justify-between flex-wrap gap-6">
              <div className="flex items-center gap-6">
                {/* Botão Voltar */}
                <button
                  onClick={() => router.push('/dashboard-uaz')}
                  className="bg-white/10 hover:bg-white/20 p-4 rounded-xl transition-all duration-200 border-2 border-white/20 hover:border-white/40"
                  title="Voltar para o Dashboard QR Connect"
                >
                  <FaArrowLeft className="text-3xl text-white" />
                </button>
                
                <div className="bg-gradient-to-br from-primary-500 to-primary-600 p-6 rounded-2xl shadow-lg shadow-primary-500/50">
                  <FaChartBar className="text-5xl text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-4 mb-2">
                    <h1 className="text-5xl font-black text-white tracking-tight">
                      Campanhas QR Connect
                    </h1>
                    <span className="flex items-center gap-2 px-4 py-2 bg-green-500/20 border-2 border-green-500/40 rounded-xl">
                      <span className="inline-block w-3 h-3 bg-green-400 rounded-full animate-pulse"></span>
                      <span className="text-sm font-bold text-green-300">Tempo Real</span>
                    </span>
                  </div>
                  <p className="text-xl text-white/80 font-medium">
                    Gerencie suas campanhas de envio em massa via QR Connect
                  </p>
                </div>
              </div>
              
              <div className="flex gap-4">
                {campaigns.filter(c => c.status === 'completed' || c.status === 'cancelled').length > 0 && (
                  <button
                    onClick={handleDeleteAllFinished}
                    className="flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white text-lg font-bold rounded-xl transition-all duration-200 shadow-lg shadow-red-500/30 hover:shadow-red-500/50 transform hover:scale-105"
                  >
                    <FaTrashAlt className="text-xl" />
                    Excluir Finalizadas ({campaigns.filter(c => c.status === 'completed' || c.status === 'cancelled').length})
                  </button>
                )}
                
                <Link href="/qr-campanha/criar" className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white text-lg font-bold rounded-xl transition-all duration-200 shadow-lg shadow-green-500/30 hover:shadow-green-500/50 transform hover:scale-105">
                  <FaPlus className="text-xl" />
                  Nova Campanha QR
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* LISTA DE CAMPANHAS */}
        {campaigns.length === 0 ? (
          <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-20 text-center shadow-xl">
            <div className="text-6xl mb-6">📭</div>
            <p className="text-2xl text-white/70 font-medium mb-8">
              Nenhuma campanha QR criada ainda
            </p>
            <Link href="/qr-campanha/criar" className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white text-lg font-bold rounded-xl transition-all duration-200 shadow-lg shadow-primary-500/40 hover:shadow-primary-500/60 transform hover:scale-105">
              <FaPlus className="text-xl" />
              Criar Primeira Campanha QR
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {campaigns.map((campaign) => (
              <div key={campaign.id} className="bg-dark-800/60 backdrop-blur-xl border-2 border-primary-500/30 rounded-2xl p-8 shadow-xl hover:border-primary-500/50 transition-all duration-300">
                
                {/* Cabeçalho da Campanha */}
                <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-4 mb-3 flex-wrap">
                      <h2 className="text-3xl font-black text-white">{campaign.name}</h2>
                      {getStatusBadge(campaign)}
                    </div>
                    
                    <div className="space-y-2 text-base text-white/70">
                      <p className="flex items-center gap-2">
                        <span>📅</span>
                        <strong className="text-white">Criada:</strong> {formatDate(campaign.created_at)}
                      </p>
                      {campaign.scheduled_at && (
                        <p className="flex items-center gap-2">
                          <span>⏰</span>
                          <strong className="text-white">Agendada:</strong> {formatDate(campaign.scheduled_at)}
                        </p>
                      )}
                      {campaign.started_at && (
                        <p className="flex items-center gap-2">
                          <span>🚀</span>
                          <strong className="text-white">Iniciada:</strong> {formatDate(campaign.started_at)}
                        </p>
                      )}
                      {campaign.completed_at && (
                        <p className="flex items-center gap-2">
                          <span>✅</span>
                          <strong className="text-white">Concluída:</strong> {formatDate(campaign.completed_at)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Botões de Ação */}
                  <div className="flex gap-3 flex-wrap">
                    {(campaign.status === 'pending' || campaign.status === 'scheduled' || campaign.status === 'paused' || campaign.status === 'running') && (
                      <button
                        onClick={() => handleOpenEdit(campaign)}
                        className="px-4 py-3 bg-primary-500/20 hover:bg-primary-500/30 text-primary-300 border-2 border-primary-500/40 rounded-xl font-bold transition-all duration-200"
                        title="Editar"
                      >
                        <FaEdit className="text-xl" />
                      </button>
                    )}

                    {(campaign.status === 'running' || campaign.status === 'scheduled' || campaign.status === 'pending') && (
                      <button
                        onClick={() => handlePause(campaign.id)}
                        className="px-4 py-3 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border-2 border-yellow-500/40 rounded-xl font-bold transition-all duration-200"
                        title="Pausar"
                      >
                        <FaPause className="text-xl" />
                      </button>
                    )}

                    {campaign.status === 'paused' && (
                      <button
                        onClick={() => handleResume(campaign.id)}
                        className="px-4 py-3 bg-green-500/20 hover:bg-green-500/30 text-green-300 border-2 border-green-500/40 rounded-xl font-bold transition-all duration-200"
                        title="Retomar"
                      >
                        <FaPlay className="text-xl" />
                      </button>
                    )}

                    {(campaign.status === 'running' || campaign.status === 'paused' || campaign.status === 'scheduled' || campaign.status === 'pending') && (
                      <button
                        onClick={() => handleCancel(campaign.id)}
                        className="px-4 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-300 border-2 border-red-500/40 rounded-xl font-bold transition-all duration-200"
                        title="Cancelar"
                      >
                        <FaBan className="text-xl" />
                      </button>
                    )}

                    {/* Botão Gerenciar Instâncias */}
                    {(campaign.status === 'running' || campaign.status === 'paused') && (
                      <Link href={`/qr-campanha/${campaign.id}`}>
                        <button
                          className="px-4 py-3 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border-2 border-blue-500/40 rounded-xl font-bold transition-all duration-200"
                          title="Gerenciar Instâncias"
                        >
                          <FaServer className="text-xl" />
                        </button>
                      </Link>
                    )}

                    {/* Botão Baixar Relatório */}
                    <button
                      onClick={() => handleDownloadReport(campaign.id, campaign.name)}
                      className="px-4 py-3 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border-2 border-purple-500/40 rounded-xl font-bold transition-all duration-200"
                      title="Baixar Relatório Excel"
                    >
                      <FaDownload className="text-xl" />
                    </button>

                    {(campaign.status === 'completed' || campaign.status === 'cancelled') && (
                      <button
                        onClick={() => handleDelete(campaign.id, campaign.name)}
                        className="px-4 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-300 border-2 border-red-500/40 rounded-xl font-bold transition-all duration-200"
                        title="Excluir"
                      >
                        <FaTrash className="text-xl" />
                      </button>
                    )}

                    <Link
                      href={`/qr-campanha/${campaign.id}`}
                      className="px-4 py-3 bg-dark-700 hover:bg-dark-600 text-white border-2 border-white/20 hover:border-white/40 rounded-xl font-bold transition-all duration-200 flex items-center gap-2"
                    >
                      <FaEye className="text-xl" />
                      <span>Detalhes</span>
                    </Link>
                  </div>
                </div>

                {/* Barra de Progresso */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-lg font-bold text-white">Progresso</span>
                    <span className="text-2xl font-black text-primary-300">{getProgress(campaign)}%</span>
                  </div>
                  <div className="w-full bg-dark-700 rounded-xl h-4 overflow-hidden border-2 border-white/10">
                    <div
                      className="bg-gradient-to-r from-primary-500 to-primary-600 h-full transition-all duration-500 rounded-lg"
                      style={{ width: `${getProgress(campaign)}%` }}
                    />
                  </div>
                </div>

                {/* Estatísticas */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md border-2 border-white/10 rounded-xl p-5 text-center hover:border-white/20 transition-all">
                    <div className="text-4xl font-black text-white mb-2">{campaign.total_contacts}</div>
                    <div className="text-sm font-bold text-white/70">👥 Total</div>
                  </div>
                  
                  <div className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 backdrop-blur-md border-2 border-yellow-500/20 rounded-xl p-5 text-center hover:border-yellow-500/40 transition-all">
                    <div className="text-4xl font-black text-yellow-400 mb-2">{campaign.total_contacts - campaign.sent_count - campaign.failed_count - campaign.no_whatsapp_count}</div>
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
                    <div className="text-sm font-bold text-orange-300">🚫 Sem WhatsApp</div>
                  </div>

                  <div className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 backdrop-blur-md border-2 border-cyan-500/20 rounded-xl p-5 text-center hover:border-cyan-500/40 transition-all">
                    <div className="text-4xl font-black text-cyan-400 mb-2">{campaign.button_clicks_count || 0}</div>
                    <div className="text-sm font-bold text-cyan-300">🖱️ Cliques</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de Edição */}
      {editingCampaign && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border-2 border-primary-500/40 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-8">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-3xl font-black text-white flex items-center gap-3">
                  <div className="bg-primary-500/20 p-3 rounded-xl">
                    <FaEdit className="text-2xl text-primary-400" />
                  </div>
                  Editar Campanha QR
                </h2>
                <button
                  onClick={handleCloseEdit}
                  className="text-white/50 hover:text-white text-4xl font-bold transition-all"
                >
                  ×
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-lg font-bold mb-3 text-white">Nome da Campanha *</label>
                  <input
                    type="text"
                    className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/30 transition-all"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  />
                </div>

                {(editingCampaign.status === 'scheduled' || editingCampaign.status === 'pending') && (
                  <div>
                    <label className="block text-lg font-bold mb-3 text-white">Data/Hora de Início (Opcional)</label>
                    <input
                      type="datetime-local"
                      className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/30 transition-all"
                      value={editForm.scheduled_at}
                      onChange={(e) => setEditForm({ ...editForm, scheduled_at: e.target.value })}
                    />
                    <p className="text-sm text-white/60 mt-2">
                      Deixe em branco para iniciar imediatamente
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-lg font-bold mb-3 text-white">Horário de Funcionamento Diário</label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-white/70 mb-2">Iniciar às</label>
                      <input
                        type="time"
                        className="w-full px-4 py-3 bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30 transition-all"
                        value={editForm.work_start_time}
                        onChange={(e) => setEditForm({ ...editForm, work_start_time: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-white/70 mb-2">Pausar às</label>
                      <input
                        type="time"
                        className="w-full px-4 py-3 bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30 transition-all"
                        value={editForm.work_end_time}
                        onChange={(e) => setEditForm({ ...editForm, work_end_time: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-lg font-bold mb-3 text-white">Intervalo entre envios (segundos)</label>
                  <input
                    type="number"
                    className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/30 transition-all"
                    min="1"
                    value={editForm.interval_seconds}
                    onChange={(e) => setEditForm({ ...editForm, interval_seconds: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-lg font-bold mb-3 text-white">Configurações de Pausa Automática</label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-white/70 mb-2">Pausar após (mensagens)</label>
                      <input
                        type="number"
                        className="w-full px-4 py-3 bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30 transition-all"
                        min="0"
                        value={editForm.pause_after}
                        onChange={(e) => setEditForm({ ...editForm, pause_after: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-white/70 mb-2">Retomar após (minutos)</label>
                      <input
                        type="number"
                        className="w-full px-4 py-3 bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30 transition-all"
                        min="0"
                        value={editForm.pause_duration_minutes}
                        onChange={(e) => setEditForm({ ...editForm, pause_duration_minutes: e.target.value })}
                      />
                    </div>
                  </div>
                  <p className="text-sm text-white/60 mt-2">
                    Deixe "Pausar após" em 0 para não pausar automaticamente
                  </p>
                </div>

                <div className="p-4 bg-yellow-500/10 border-2 border-yellow-500/30 rounded-xl">
                  <p className="text-base text-yellow-300 font-medium">
                    ⚠️ <span className="font-bold">Atenção:</span> Não é possível alterar templates, instâncias ou contatos de uma campanha já criada.
                  </p>
                </div>

                <div className="flex gap-4 mt-8">
                  <button
                    onClick={handleCloseEdit}
                    className="flex-1 px-6 py-4 bg-dark-700 hover:bg-dark-600 text-white font-bold rounded-xl transition-all duration-200 border-2 border-white/20 hover:border-white/40"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    className="flex-1 px-6 py-4 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white font-bold rounded-xl transition-all duration-200 shadow-lg shadow-primary-500/40 hover:shadow-primary-500/60 flex items-center justify-center gap-2"
                  >
                    <FaEdit />
                    Salvar Alterações
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

      {/* Modal de Confirmação */}
      <ConfirmDialog />
      
      <style jsx>{`
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

