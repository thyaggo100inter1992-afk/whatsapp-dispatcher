import { useState, useEffect } from 'react';
import { FaEnvelope, FaBell, FaPaperPlane, FaUsers, FaChartBar, FaEdit, FaTrash, FaEye, FaPause, FaPlay, FaCheckCircle, FaTimesCircle, FaSpinner } from 'react-icons/fa';
import AdminLayout from '@/components/admin/AdminLayout';
import api from '@/services/api';
import { useNotification } from '@/hooks/useNotification';

interface EmailCampaign {
  id: number;
  name: string;
  subject: string;
  content: string;
  recipient_type: string;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  status: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

interface Notification {
  id: number;
  title: string;
  message: string;
  type: string;
  link_url?: string;
  link_text?: string;
  recipient_type: string;
  is_active: boolean;
  created_at: string;
  stats?: {
    total_views: number;
    total_clicks: number;
  };
}

interface EmailAccount {
  id: number;
  name: string;
  email_from: string;
}

export default function Comunicacao() {
  const notification = useNotification();
  
  const [activeTab, setActiveTab] = useState<'email' | 'notification'>('email');
  const [loading, setLoading] = useState(false);
  
  // Email Campaign State
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailForm, setEmailForm] = useState({
    name: '',
    subject: '',
    content: '',
    recipient_type: 'all',
    recipient_list: { tenant_ids: [] as number[], emails: [] as string[] },
    email_accounts: [] as number[],
    delay_seconds: 5
  });
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([]);
  const [previewEmails, setPreviewEmails] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<any>(null);
  const [showCampaignDetails, setShowCampaignDetails] = useState(false);
  
  // Notification State
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotificationForm, setShowNotificationForm] = useState(false);
  const [notificationForm, setNotificationForm] = useState({
    title: '',
    message: '',
    type: 'info',
    link_url: '',
    link_text: '',
    recipient_type: 'all',
    recipient_list: {}
  });
  
  useEffect(() => {
    loadCampaigns();
    loadNotifications();
    loadEmailAccounts();
  }, []);
  
  const loadCampaigns = async () => {
    try {
      const response = await api.get('/admin/communications/campaigns');
      setCampaigns(response.data.campaigns);
    } catch (error) {
      console.error('Erro ao carregar campanhas:', error);
    }
  };
  
  const loadNotifications = async () => {
    try {
      const response = await api.get('/admin/communications/notifications');
      setNotifications(response.data.notifications);
    } catch (error) {
      console.error('Erro ao carregar notificações:', error);
    }
  };
  
  const loadEmailAccounts = async () => {
    try {
      const response = await api.get('/admin/email-accounts');
      setEmailAccounts(response.data.accounts);
    } catch (error) {
      console.error('Erro ao carregar contas de email:', error);
    }
  };
  
  const handlePreviewRecipients = async () => {
    try {
      setLoading(true);
      const response = await api.post('/admin/communications/campaigns/preview-recipients', {
        recipient_type: emailForm.recipient_type,
        recipient_list: emailForm.recipient_list
      });
      setPreviewEmails(response.data.emails);
      setShowPreview(true);
    } catch (error: any) {
      notification.error(error.response?.data?.message || 'Erro ao gerar preview');
    } finally {
      setLoading(false);
    }
  };
  
  const handleCreateCampaign = async () => {
    try {
      setLoading(true);
      
      // Validações
      if (!emailForm.name || !emailForm.subject || !emailForm.content) {
        notification.error('Preencha todos os campos obrigatórios');
        return;
      }
      
      const response = await api.post('/admin/communications/campaigns', emailForm);
      
      notification.success('Campanha criada! Iniciando envio...');
      
      // Iniciar envio
      await api.post(`/admin/communications/campaigns/${response.data.campaign.id}/start`);
      
      notification.success('Envio iniciado com sucesso!');
      
      // Resetar form e recarregar
      setShowEmailForm(false);
      resetEmailForm();
      loadCampaigns();
    } catch (error: any) {
      notification.error(error.response?.data?.message || 'Erro ao criar campanha');
    } finally {
      setLoading(false);
    }
  };
  
  const handleCreateNotification = async () => {
    try {
      setLoading(true);
      
      if (!notificationForm.title || !notificationForm.message) {
        notification.error('Título e mensagem são obrigatórios');
        return;
      }
      
      await api.post('/admin/communications/notifications', notificationForm);
      
      notification.success('Notificação criada com sucesso!');
      
      setShowNotificationForm(false);
      resetNotificationForm();
      loadNotifications();
    } catch (error: any) {
      notification.error(error.response?.data?.message || 'Erro ao criar notificação');
    } finally {
      setLoading(false);
    }
  };
  
  const handleToggleNotification = async (id: number) => {
    try {
      await api.patch(`/admin/communications/notifications/${id}/toggle`);
      notification.success('Status alterado com sucesso!');
      loadNotifications();
    } catch (error: any) {
      notification.error('Erro ao alterar status');
    }
  };
  
  const handleDeleteNotification = async (id: number) => {
    if (!confirm('Tem certeza que deseja deletar esta notificação?')) return;
    
    try {
      await api.delete(`/admin/communications/notifications/${id}`);
      notification.success('Notificação deletada!');
      loadNotifications();
    } catch (error: any) {
      notification.error('Erro ao deletar notificação');
    }
  };

  // Campaign Actions
  const handleViewCampaignDetails = async (id: number) => {
    try {
      setLoading(true);
      const response = await api.get(`/admin/communications/campaigns/${id}`);
      setSelectedCampaign(response.data);
      setShowCampaignDetails(true);
    } catch (error: any) {
      notification.error('Erro ao carregar detalhes da campanha');
    } finally {
      setLoading(false);
    }
  };

  const handlePauseCampaign = async (id: number) => {
    try {
      await api.post(`/admin/communications/campaigns/${id}/pause`);
      notification.success('Campanha pausada!');
      loadCampaigns();
    } catch (error: any) {
      notification.error('Erro ao pausar campanha');
    }
  };

  const handleResumeCampaign = async (id: number) => {
    try {
      await api.post(`/admin/communications/campaigns/${id}/resume`);
      notification.success('Campanha retomada!');
      loadCampaigns();
    } catch (error: any) {
      notification.error('Erro ao retomar campanha');
    }
  };

  const handleCancelCampaign = async (id: number) => {
    if (!confirm('Tem certeza que deseja cancelar esta campanha?')) return;
    
    try {
      await api.post(`/admin/communications/campaigns/${id}/cancel`);
      notification.success('Campanha cancelada!');
      loadCampaigns();
    } catch (error: any) {
      notification.error('Erro ao cancelar campanha');
    }
  };

  const handleDeleteCampaign = async (id: number) => {
    if (!confirm('Tem certeza que deseja deletar esta campanha? Esta ação não pode ser desfeita.')) return;
    
    try {
      await api.delete(`/admin/communications/campaigns/${id}`);
      notification.success('Campanha deletada!');
      loadCampaigns();
    } catch (error: any) {
      notification.error('Erro ao deletar campanha');
    }
  };
  
  const resetEmailForm = () => {
    setEmailForm({
      name: '',
      subject: '',
      content: '',
      recipient_type: 'all',
      recipient_list: { tenant_ids: [] as number[], emails: [] as string[] },
      email_accounts: [] as number[],
      delay_seconds: 5
    });
    setPreviewEmails([]);
    setShowPreview(false);
  };
  
  const resetNotificationForm = () => {
    setNotificationForm({
      title: '',
      message: '',
      type: 'info',
      link_url: '',
      link_text: '',
      recipient_type: 'all',
      recipient_list: {}
    });
  };
  
  const getStatusBadge = (status: string) => {
    const badges: Record<string, { color: string; icon: any; text: string }> = {
      draft: { color: 'bg-gray-500', icon: FaPause, text: 'Rascunho' },
      sending: { color: 'bg-blue-500 animate-pulse', icon: FaSpinner, text: 'Enviando' },
      completed: { color: 'bg-green-500', icon: FaCheckCircle, text: 'Concluído' },
      failed: { color: 'bg-red-500', icon: FaTimesCircle, text: 'Falhou' }
    };
    
    const badge = badges[status] || badges.draft;
    const Icon = badge.icon;
    
    return (
      <span className={`${badge.color} text-white px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2`}>
        <Icon /> {badge.text}
      </span>
    );
  };
  
  const getNotificationTypeBadge = (type: string) => {
    const badges: Record<string, { color: string; text: string }> = {
      info: { color: 'bg-blue-500', text: 'Info' },
      warning: { color: 'bg-yellow-500', text: 'Aviso' },
      urgent: { color: 'bg-red-500', text: 'Urgente' },
      success: { color: 'bg-green-500', text: 'Sucesso' }
    };
    
    const badge = badges[type] || badges.info;
    
    return (
      <span className={`${badge.color} text-white px-3 py-1 rounded-full text-sm font-bold`}>
        {badge.text}
      </span>
    );
  };

  return (
    <AdminLayout
      title="Comunicação"
      subtitle="Envie emails e notificações para os tenants"
      icon={<FaPaperPlane className="text-3xl text-white" />}
      currentPage="comunicacao"
    >
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-blue-900 p-8">
        <div className="max-w-7xl mx-auto">
          {/* Tabs */}
          <div className="flex gap-4 mb-8">
            <button
              onClick={() => setActiveTab('email')}
              className={`flex-1 py-4 px-6 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                activeTab === 'email'
                  ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg scale-105'
                  : 'bg-white/10 text-gray-300 hover:bg-white/20'
              }`}
            >
              <FaEnvelope /> Campanhas de Email
            </button>
            <button
              onClick={() => setActiveTab('notification')}
              className={`flex-1 py-4 px-6 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                activeTab === 'notification'
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg scale-105'
                  : 'bg-white/10 text-gray-300 hover:bg-white/20'
              }`}
            >
              <FaBell /> Notificações Pop-up
            </button>
          </div>

          {/* EMAIL TAB */}
          {activeTab === 'email' && (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white">📧 Campanhas de Email</h2>
                <button
                  onClick={() => setShowEmailForm(!showEmailForm)}
                  className="px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl font-bold transition-all flex items-center gap-2 shadow-lg"
                >
                  <FaPaperPlane /> Nova Campanha
                </button>
              </div>

              {/* Form */}
              {showEmailForm && (
                <div className="bg-gradient-to-br from-white/20 to-white/10 backdrop-blur-md rounded-3xl p-8 border border-white/30">
                  <h3 className="text-2xl font-black text-white mb-6">✉️ Nova Campanha de Email</h3>
                  
                  {/* Nome e Assunto */}
                  <div className="grid grid-cols-2 gap-6 mb-6">
                    <div>
                      <label className="block text-white font-bold mb-2">Nome da Campanha *</label>
                      <input
                        type="text"
                        value={emailForm.name}
                        onChange={(e) => setEmailForm({ ...emailForm, name: e.target.value })}
                        className="w-full p-3 rounded-xl bg-white/10 border-2 border-white/20 text-white placeholder-white/50"
                        placeholder="Ex: Promoção Black Friday"
                      />
                    </div>
                    <div>
                      <label className="block text-white font-bold mb-2">Assunto do Email *</label>
                      <input
                        type="text"
                        value={emailForm.subject}
                        onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })}
                        className="w-full p-3 rounded-xl bg-white/10 border-2 border-white/20 text-white placeholder-white/50"
                        placeholder="Ex: 🔥 Oferta Especial!"
                      />
                    </div>
                  </div>

                  {/* Conteúdo */}
                  <div className="mb-6">
                    <label className="block text-white font-bold mb-2">Conteúdo HTML *</label>
                    <textarea
                      value={emailForm.content}
                      onChange={(e) => setEmailForm({ ...emailForm, content: e.target.value })}
                      className="w-full p-3 rounded-xl bg-white/10 border-2 border-white/20 text-white placeholder-white/50 min-h-[200px] font-mono text-sm"
                      placeholder="<h1>Olá!</h1><p>Conteúdo do email...</p>"
                    />
                  </div>

                  {/* Destinatários */}
                  <div className="mb-6">
                    <label className="block text-white font-bold mb-2">Destinatários *</label>
                    <select
                      value={emailForm.recipient_type}
                      onChange={(e) => setEmailForm({ ...emailForm, recipient_type: e.target.value })}
                      className="w-full p-3 rounded-xl bg-white/10 border-2 border-white/20 text-white"
                    >
                      <option value="all">Todos os Tenants</option>
                      <option value="active">Apenas Ativos</option>
                      <option value="blocked">Apenas Bloqueados</option>
                      <option value="trial">Apenas em Trial</option>
                      <option value="manual">Digitar Emails Manualmente</option>
                    </select>
                  </div>

                  {/* Manual Emails */}
                  {emailForm.recipient_type === 'manual' && (
                    <div className="mb-6">
                      <label className="block text-white font-bold mb-2">Emails (um por linha)</label>
                      <textarea
                        onChange={(e) => {
                          const emails = e.target.value.split('\n').map(e => e.trim()).filter(e => e);
                          setEmailForm({ ...emailForm, recipient_list: { ...emailForm.recipient_list, emails } });
                        }}
                        className="w-full p-3 rounded-xl bg-white/10 border-2 border-white/20 text-white placeholder-white/50 min-h-[150px] font-mono text-sm"
                        placeholder="email1@exemplo.com&#10;email2@exemplo.com&#10;email3@exemplo.com"
                      />
                    </div>
                  )}

                  {/* Configurações de Envio */}
                  <div className="grid grid-cols-2 gap-6 mb-6">
                    <div>
                      <label className="block text-white font-bold mb-2">🔄 Contas de Email (Rotação)</label>
                      <div className="space-y-2 max-h-32 overflow-y-auto bg-white/5 p-3 rounded-xl">
                        {emailAccounts.map(account => (
                          <label key={account.id} className="flex items-center gap-2 text-white cursor-pointer hover:bg-white/10 p-2 rounded">
                            <input
                              type="checkbox"
                              checked={emailForm.email_accounts.includes(account.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setEmailForm({ ...emailForm, email_accounts: [...emailForm.email_accounts, account.id] });
                                } else {
                                  setEmailForm({ ...emailForm, email_accounts: emailForm.email_accounts.filter(id => id !== account.id) });
                                }
                              }}
                              className="w-4 h-4"
                            />
                            {account.name} ({account.email_from})
                          </label>
                        ))}
                      </div>
                      <p className="text-xs text-white/60 mt-2">
                        {emailForm.email_accounts.length === 0 ? 'Usando conta padrão' : `${emailForm.email_accounts.length} conta(s) selecionada(s)`}
                      </p>
                    </div>

                    <div>
                      <label className="block text-white font-bold mb-2">⏱️ Delay entre Envios (segundos)</label>
                      <input
                        type="number"
                        value={emailForm.delay_seconds}
                        onChange={(e) => setEmailForm({ ...emailForm, delay_seconds: parseInt(e.target.value) })}
                        className="w-full p-3 rounded-xl bg-white/10 border-2 border-white/20 text-white"
                        min="1"
                        max="60"
                      />
                      <div className="flex gap-2 mt-2">
                        {[5, 10, 30, 60].map(sec => (
                          <button
                            key={sec}
                            onClick={() => setEmailForm({ ...emailForm, delay_seconds: sec })}
                            className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-sm"
                          >
                            {sec}s
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Preview */}
                  {showPreview && previewEmails.length > 0 && (
                    <div className="mb-6 bg-green-500/20 border-2 border-green-500 rounded-xl p-4">
                      <p className="text-white font-bold mb-2">✅ {previewEmails.length} destinatários encontrados:</p>
                      <div className="max-h-32 overflow-y-auto bg-black/20 p-3 rounded text-white text-sm font-mono">
                        {previewEmails.slice(0, 50).join(', ')}
                        {previewEmails.length > 50 && ` ... e mais ${previewEmails.length - 50}`}
                      </div>
                    </div>
                  )}

                  {/* Buttons */}
                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={() => { setShowEmailForm(false); resetEmailForm(); }}
                      className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition-all"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handlePreviewRecipients}
                      disabled={loading}
                      className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                      <FaEye /> Preview Destinatários
                    </button>
                    <button
                      onClick={handleCreateCampaign}
                      disabled={loading}
                      className="px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl font-bold transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                      <FaPaperPlane /> {loading ? 'Enviando...' : 'Criar e Enviar'}
                    </button>
                  </div>
                </div>
              )}

              {/* Lista de Campanhas */}
              <div className="space-y-4">
                {campaigns.length === 0 && (
                  <div className="text-center text-white/60 py-12">
                    <FaEnvelope className="text-6xl mx-auto mb-4 opacity-50" />
                    <p className="text-xl">Nenhuma campanha criada ainda</p>
                  </div>
                )}

                {campaigns.map(campaign => (
                  <div
                    key={campaign.id}
                    className="bg-gradient-to-br from-white/20 to-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/30"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-2xl font-bold text-white">{campaign.name}</h3>
                          {getStatusBadge(campaign.status)}
                        </div>
                        <p className="text-white/80 mb-4">📧 {campaign.subject}</p>
                        
                        <div className="grid grid-cols-4 gap-4 text-white/90">
                          <div>
                            <p className="text-sm text-white/60">Total</p>
                            <p className="font-bold text-xl">{campaign.total_recipients}</p>
                          </div>
                          <div>
                            <p className="text-sm text-white/60">Enviados</p>
                            <p className="font-bold text-xl text-green-400">{campaign.sent_count}</p>
                          </div>
                          <div>
                            <p className="text-sm text-white/60">Falhas</p>
                            <p className="font-bold text-xl text-red-400">{campaign.failed_count}</p>
                          </div>
                          <div>
                            <p className="text-sm text-white/60">Criado em</p>
                            <p className="font-bold">{new Date(campaign.created_at).toLocaleDateString('pt-BR')}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Botões de Ação */}
                    <div className="flex gap-2 justify-end border-t border-white/20 pt-4">
                      <button
                        onClick={() => handleViewCampaignDetails(campaign.id)}
                        className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-bold transition-all flex items-center gap-2"
                      >
                        <FaEye /> Ver Detalhes
                      </button>

                      {campaign.status === 'sending' && (
                        <button
                          onClick={() => handlePauseCampaign(campaign.id)}
                          className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg font-bold transition-all flex items-center gap-2"
                        >
                          <FaPause /> Pausar
                        </button>
                      )}

                      {campaign.status === 'paused' && (
                        <button
                          onClick={() => handleResumeCampaign(campaign.id)}
                          className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-bold transition-all flex items-center gap-2"
                        >
                          <FaPlay /> Retomar
                        </button>
                      )}

                      {(campaign.status === 'sending' || campaign.status === 'paused') && (
                        <button
                          onClick={() => handleCancelCampaign(campaign.id)}
                          className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-bold transition-all flex items-center gap-2"
                        >
                          <FaTimesCircle /> Cancelar
                        </button>
                      )}

                      {campaign.status !== 'sending' && (
                        <button
                          onClick={() => handleDeleteCampaign(campaign.id)}
                          className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-bold transition-all flex items-center gap-2"
                        >
                          <FaTrash /> Deletar
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* NOTIFICATION TAB */}
          {activeTab === 'notification' && (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white">🔔 Notificações Pop-up</h2>
                <button
                  onClick={() => setShowNotificationForm(!showNotificationForm)}
                  className="px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl font-bold transition-all flex items-center gap-2 shadow-lg"
                >
                  <FaBell /> Nova Notificação
                </button>
              </div>

              {/* Form */}
              {showNotificationForm && (
                <div className="bg-gradient-to-br from-white/20 to-white/10 backdrop-blur-md rounded-3xl p-8 border border-white/30">
                  <h3 className="text-2xl font-black text-white mb-6">🔔 Nova Notificação</h3>
                  
                  {/* Título e Tipo */}
                  <div className="grid grid-cols-2 gap-6 mb-6">
                    <div>
                      <label className="block text-white font-bold mb-2">Título *</label>
                      <input
                        type="text"
                        value={notificationForm.title}
                        onChange={(e) => setNotificationForm({ ...notificationForm, title: e.target.value })}
                        className="w-full p-3 rounded-xl bg-white/10 border-2 border-white/20 text-white placeholder-white/50"
                        placeholder="Ex: Manutenção Programada"
                      />
                    </div>
                    <div>
                      <label className="block text-white font-bold mb-2">Tipo</label>
                      <select
                        value={notificationForm.type}
                        onChange={(e) => setNotificationForm({ ...notificationForm, type: e.target.value })}
                        className="w-full p-3 rounded-xl bg-white/10 border-2 border-white/20 text-white"
                      >
                        <option value="info">Info</option>
                        <option value="warning">Aviso</option>
                        <option value="urgent">Urgente</option>
                        <option value="success">Sucesso</option>
                      </select>
                    </div>
                  </div>

                  {/* Mensagem */}
                  <div className="mb-6">
                    <label className="block text-white font-bold mb-2">Mensagem *</label>
                    <textarea
                      value={notificationForm.message}
                      onChange={(e) => setNotificationForm({ ...notificationForm, message: e.target.value })}
                      className="w-full p-3 rounded-xl bg-white/10 border-2 border-white/20 text-white placeholder-white/50 min-h-[150px]"
                      placeholder="Digite a mensagem que será exibida..."
                    />
                  </div>

                  {/* Link Opcional */}
                  <div className="grid grid-cols-2 gap-6 mb-6">
                    <div>
                      <label className="block text-white font-bold mb-2">Link (opcional)</label>
                      <input
                        type="text"
                        value={notificationForm.link_url}
                        onChange={(e) => setNotificationForm({ ...notificationForm, link_url: e.target.value })}
                        className="w-full p-3 rounded-xl bg-white/10 border-2 border-white/20 text-white placeholder-white/50"
                        placeholder="https://..."
                      />
                    </div>
                    <div>
                      <label className="block text-white font-bold mb-2">Texto do Link</label>
                      <input
                        type="text"
                        value={notificationForm.link_text}
                        onChange={(e) => setNotificationForm({ ...notificationForm, link_text: e.target.value })}
                        className="w-full p-3 rounded-xl bg-white/10 border-2 border-white/20 text-white placeholder-white/50"
                        placeholder="Saiba Mais"
                      />
                    </div>
                  </div>

                  {/* Destinatários */}
                  <div className="mb-6">
                    <label className="block text-white font-bold mb-2">Destinatários *</label>
                    <select
                      value={notificationForm.recipient_type}
                      onChange={(e) => setNotificationForm({ ...notificationForm, recipient_type: e.target.value })}
                      className="w-full p-3 rounded-xl bg-white/10 border-2 border-white/20 text-white"
                    >
                      <option value="all">Todos os Tenants</option>
                      <option value="active">Apenas Ativos</option>
                      <option value="blocked">Apenas Bloqueados</option>
                      <option value="trial">Apenas em Trial</option>
                    </select>
                  </div>

                  {/* Buttons */}
                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={() => { setShowNotificationForm(false); resetNotificationForm(); }}
                      className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition-all"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleCreateNotification}
                      disabled={loading}
                      className="px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl font-bold transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                      <FaBell /> {loading ? 'Criando...' : 'Criar Notificação'}
                    </button>
                  </div>
                </div>
              )}

              {/* Lista de Notificações */}
              <div className="space-y-4">
                {notifications.length === 0 && (
                  <div className="text-center text-white/60 py-12">
                    <FaBell className="text-6xl mx-auto mb-4 opacity-50" />
                    <p className="text-xl">Nenhuma notificação criada ainda</p>
                  </div>
                )}

                {notifications.map(notif => (
                  <div
                    key={notif.id}
                    className="bg-gradient-to-br from-white/20 to-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/30"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-2xl font-bold text-white">{notif.title}</h3>
                          {getNotificationTypeBadge(notif.type)}
                          {notif.is_active ? (
                            <span className="bg-green-500 text-white px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1">
                              <FaCheckCircle /> Ativa
                            </span>
                          ) : (
                            <span className="bg-gray-500 text-white px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1">
                              <FaPause /> Inativa
                            </span>
                          )}
                        </div>
                        <p className="text-white/80 mb-4">{notif.message}</p>
                        
                        {notif.stats && (
                          <div className="flex gap-6 text-white/90">
                            <div>
                              <p className="text-sm text-white/60">Visualizações</p>
                              <p className="font-bold text-xl">{notif.stats.total_views}</p>
                            </div>
                            <div>
                              <p className="text-sm text-white/60">Cliques</p>
                              <p className="font-bold text-xl text-blue-400">{notif.stats.total_clicks}</p>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => handleToggleNotification(notif.id)}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all flex items-center gap-2"
                        >
                          {notif.is_active ? <FaPause /> : <FaPlay />}
                          {notif.is_active ? 'Desativar' : 'Ativar'}
                        </button>
                        <button
                          onClick={() => handleDeleteNotification(notif.id)}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all flex items-center gap-2"
                        >
                          <FaTrash /> Deletar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal de Detalhes da Campanha */}
        {showCampaignDetails && selectedCampaign && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-gradient-to-br from-purple-900 via-purple-800 to-blue-900 rounded-3xl p-8 max-w-6xl w-full max-h-[90vh] overflow-y-auto border-4 border-white/30">
              {/* Header */}
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-3xl font-black text-white mb-2">{selectedCampaign.campaign.name}</h2>
                  <p className="text-white/80 text-lg">📧 {selectedCampaign.campaign.subject}</p>
                </div>
                <button
                  onClick={() => setShowCampaignDetails(false)}
                  className="text-white/60 hover:text-white text-3xl"
                >
                  ✕
                </button>
              </div>

              {/* Estatísticas */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-white/10 rounded-xl p-4">
                  <p className="text-white/60 text-sm mb-1">Total</p>
                  <p className="text-white font-bold text-2xl">{selectedCampaign.campaign.total_recipients}</p>
                </div>
                <div className="bg-green-500/20 rounded-xl p-4">
                  <p className="text-green-300 text-sm mb-1">Enviados</p>
                  <p className="text-green-400 font-bold text-2xl">{selectedCampaign.campaign.sent_count}</p>
                </div>
                <div className="bg-red-500/20 rounded-xl p-4">
                  <p className="text-red-300 text-sm mb-1">Falhas</p>
                  <p className="text-red-400 font-bold text-2xl">{selectedCampaign.campaign.failed_count}</p>
                </div>
                <div className="bg-blue-500/20 rounded-xl p-4">
                  <p className="text-blue-300 text-sm mb-1">Status</p>
                  <div className="mt-1">{getStatusBadge(selectedCampaign.campaign.status)}</div>
                </div>
              </div>

              {/* Contas de Email Usadas */}
              {selectedCampaign.email_accounts && selectedCampaign.email_accounts.length > 0 && (
                <div className="bg-white/10 rounded-xl p-4 mb-6">
                  <h3 className="text-white font-bold mb-3">📮 Contas de Email Usadas (Rotação):</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedCampaign.email_accounts.map((account: any) => (
                      <div key={account.id} className="bg-purple-500/30 px-4 py-2 rounded-lg text-white text-sm">
                        <span className="font-bold">{account.name}</span>
                        <span className="text-white/70 ml-2">({account.email_from})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Lista de Destinatários */}
              <div className="bg-white/10 rounded-xl p-4">
                <h3 className="text-white font-bold mb-3">📋 Destinatários ({selectedCampaign.recipients.length}):</h3>
                <div className="max-h-96 overflow-y-auto space-y-2">
                  {selectedCampaign.recipients.map((recipient: any, idx: number) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg ${
                        recipient.status === 'sent'
                          ? 'bg-green-500/20 border border-green-500/30'
                          : 'bg-red-500/20 border border-red-500/30'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <p className="text-white font-mono font-bold">📧 {recipient.email}</p>
                          {recipient.error_message && (
                            <p className="text-red-300 text-sm mt-1">❌ {recipient.error_message}</p>
                          )}
                        </div>
                        <div className="text-right">
                          {recipient.status === 'sent' ? (
                            <span className="text-green-400 font-bold">✓ Enviado</span>
                          ) : (
                            <span className="text-red-400 font-bold">✗ Falhou</span>
                          )}
                        </div>
                      </div>
                      
                      {/* Informações de Envio */}
                      <div className="flex gap-4 text-sm">
                        {recipient.email_account_name && (
                          <div className="bg-purple-500/30 px-3 py-1 rounded">
                            <span className="text-purple-200">📮 Enviado por:</span>
                            <span className="text-white font-bold ml-2">{recipient.email_account_name}</span>
                            <span className="text-white/70 ml-1">({recipient.email_account_from})</span>
                          </div>
                        )}
                        {recipient.sent_at && (
                          <div className="bg-white/10 px-3 py-1 rounded">
                            <span className="text-white/60">🕐</span>
                            <span className="text-white ml-2">
                              {new Date(recipient.sent_at).toLocaleString('pt-BR')}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Botão Fechar */}
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowCampaignDetails(false)}
                  className="px-6 py-3 bg-white/20 hover:bg-white/30 text-white rounded-xl font-bold transition-all"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

