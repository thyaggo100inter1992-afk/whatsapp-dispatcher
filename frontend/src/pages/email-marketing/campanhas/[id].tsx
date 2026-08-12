import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import {
  FaBullhorn, FaArrowLeft, FaPlay, FaPause, FaBan, FaSpinner, FaSync,
  FaEnvelope, FaEye, FaMousePointer, FaExclamationTriangle, FaFlag,
  FaTimesCircle, FaClock, FaCalendarAlt,
  FaUsers, FaListUl, FaTimes, FaSearch, FaEdit, FaDownload, FaSave
} from 'react-icons/fa';
import api from '@/services/api';
import { useNotification } from '@/hooks/useNotification';
import { useConfirm } from '@/hooks/useConfirm';

interface Campaign {
  id: number; name: string; subject: string; subjects?: string[];
  from_name: string; from_email: string; from_senders?: Array<{ from_name: string; from_email: string }>;
  status: string; total_contacts: number; sent_count: number; failed_count: number;
  opened_count: number; clicked_count: number; bounced_count: number; complained_count: number;
  domain_name: string; list_name: string; template_name: string;
  created_at: string; started_at: string | null; completed_at: string | null; scheduled_at: string | null;
  work_start_time: string | null; work_end_time: string | null;
  delay_seconds_min: number; delay_seconds_max: number;
  pause_after: number; pause_duration_minutes: number;
  pause_started_at: string | null; sent_in_session: number;
}

interface Recipient {
  id: number; email: string; name: string | null; status: string;
  error_message: string | null; sent_at: string | null;
  opened_at: string | null; clicked_at: string | null; updated_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft:     'bg-gray-500/20 text-gray-300 border-gray-500/40',
  scheduled: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
  sending:   'bg-blue-500/20 text-blue-300 border-blue-500/40',
  paused:    'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
  completed: 'bg-green-500/20 text-green-300 border-green-500/40',
  failed:    'bg-red-500/20 text-red-300 border-red-500/40',
  cancelled: 'bg-red-900/20 text-red-400 border-red-900/40',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Rascunho', scheduled: 'Agendada', sending: 'Enviando',
  paused: 'Pausada', completed: 'Concluída', failed: 'Falhou', cancelled: 'Cancelada',
};

const RECIPIENT_STATUS: Record<string, { label: string; color: string }> = {
  pending:   { label: 'Pendente',  color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
  sent:      { label: 'Enviado',   color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  failed:    { label: 'Falhou',    color: 'bg-red-500/20 text-red-300 border-red-500/30' },
  opened:    { label: 'Aberto',    color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  clicked:   { label: 'Clicado',   color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' },
  bounced:   { label: 'Rejeitado', color: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
  complained:{ label: 'Spam',      color: 'bg-red-500/20 text-red-300 border-red-500/30' },
};

const POLL_INTERVAL = 6;

export default function CampaignDetail() {
  const router = useRouter();
  const { id } = router.query;
  const notification = useNotification();
  const { confirm, ConfirmDialog } = useConfirm();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(POLL_INTERVAL);
  const [isPolling, setIsPolling] = useState(false);
  const [showAllContacts, setShowAllContacts] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '', work_start_time: '', work_end_time: '',
    delay_seconds_min: 1, delay_seconds_max: 3,
    pause_after: 0, pause_duration_minutes: 30, scheduled_at: ''
  });
  const [saving, setSaving] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const campaignRef = useRef<Campaign | null>(null);
  campaignRef.current = campaign;

  useEffect(() => {
    if (!id) return;
    loadData();
    const clockTimer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => {
      clearInterval(clockTimer);
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, [id]);

  useEffect(() => {
    if (campaign) schedulePoll();
  }, [campaign?.status]);

  const isActive = (c: Campaign | null) =>
    c ? ['sending', 'paused', 'scheduled'].includes(c.status) : false;

  const schedulePoll = () => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    if (!isActive(campaignRef.current)) return;

    setCountdown(POLL_INTERVAL);
    countdownTimerRef.current = setInterval(() => {
      setCountdown(prev => (prev <= 1 ? POLL_INTERVAL : prev - 1));
    }, 1000);
    pollTimerRef.current = setTimeout(async () => {
      pollTimerRef.current = null;
      setIsPolling(true);
      await loadData(true);
      setIsPolling(false);
    }, POLL_INTERVAL * 1000);
  };

  const loadData = async (silent = false) => {
    if (!id) return;
    if (!silent) setLoading(true);
    try {
      const r = await api.get(`/email-marketing/campaigns/${id}`);
      setCampaign(r.data.data);
      setLastUpdated(new Date());
    } catch { }
    finally { if (!silent) setLoading(false); }
  };

  const loadRecipients = async () => {
    if (!id) return;
    setLoadingRecipients(true);
    try {
      const r = await api.get(`/email-marketing/campaigns/${id}/recipients?limit=1000`);
      setRecipients(r.data.data || []);
    } catch { }
    finally { setLoadingRecipients(false); }
  };

  const handleStart = async () => {
    try { await api.post(`/email-marketing/campaigns/${id}/start`); notification.success('Campanha iniciada!', ''); loadData(); }
    catch (e: any) { notification.error('Erro', e.response?.data?.message || e.message); }
  };
  const handlePause = async () => {
    const ok = await confirm({ title: 'Pausar Campanha', message: 'Deseja pausar esta campanha?', confirmText: 'Sim, Pausar', type: 'warning' });
    if (!ok) return;
    try { await api.post(`/email-marketing/campaigns/${id}/pause`); notification.success('Campanha pausada', ''); loadData(); }
    catch (e: any) { notification.error('Erro', e.response?.data?.message || e.message); }
  };
  const handleCancel = async () => {
    const ok = await confirm({ title: 'Cancelar Campanha', message: 'Deseja cancelar esta campanha? Esta ação não pode ser desfeita.', confirmText: 'Sim, Cancelar', type: 'danger' });
    if (!ok) return;
    try { await api.post(`/email-marketing/campaigns/${id}/cancel`); notification.success('Campanha cancelada', ''); loadData(); }
    catch (e: any) { notification.error('Erro', e.response?.data?.message || e.message); }
  };

  const openEditModal = () => {
    if (!campaign) return;
    setEditForm({
      name: campaign.name,
      work_start_time: campaign.work_start_time || '08:00',
      work_end_time: campaign.work_end_time || '20:00',
      delay_seconds_min: campaign.delay_seconds_min || 1,
      delay_seconds_max: campaign.delay_seconds_max || 3,
      pause_after: campaign.pause_after || 0,
      pause_duration_minutes: campaign.pause_duration_minutes || 30,
      scheduled_at: campaign.scheduled_at ? campaign.scheduled_at.slice(0, 16) : '',
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      await api.patch(`/email-marketing/campaigns/${id}`, editForm);
      notification.success('Campanha atualizada!', '');
      setShowEditModal(false);
      loadData();
    } catch (e: any) {
      notification.error('Erro ao salvar', e.response?.data?.message || e.message);
    } finally {
      setSaving(false);
    }
  };

  const downloadReport = async () => {
    if (!campaign) return;
    try {
      const r = await api.get(`/email-marketing/campaigns/${id}/recipients?limit=100000`);
      const rows: Recipient[] = r.data.data || [];
      const headers = ['E-mail', 'Nome', 'Status', 'Enviado em', 'Aberto em', 'Clicado em', 'Erro'];
      const lines = [
        `Relatório da Campanha: ${campaign.name}`,
        `Gerado em: ${new Date().toLocaleString('pt-BR')}`,
        `Status: ${STATUS_LABELS[campaign.status]}`,
        `Total: ${campaign.total_contacts} | Enviados: ${campaign.sent_count} | Abertos: ${campaign.opened_count} | Cliques: ${campaign.clicked_count} | Rejeitados: ${campaign.bounced_count} | Spam: ${campaign.complained_count} | Falhos: ${campaign.failed_count}`,
        '',
        headers.join(';'),
        ...rows.map(r2 => [
          r2.email,
          r2.name || '',
          RECIPIENT_STATUS[r2.status]?.label || r2.status,
          r2.sent_at ? new Date(r2.sent_at).toLocaleString('pt-BR') : '',
          r2.opened_at ? new Date(r2.opened_at).toLocaleString('pt-BR') : '',
          r2.clicked_at ? new Date(r2.clicked_at).toLocaleString('pt-BR') : '',
          r2.error_message || '',
        ].join(';'))
      ];
      const bom = '\uFEFF';
      const blob = new Blob([bom + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relatorio-${campaign.name.replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      notification.success('Relatório baixado!', '');
    } catch (e: any) {
      notification.error('Erro ao gerar relatório', e.message);
    }
  };

  const formatDt = (v: string | null) =>
    v ? new Date(v).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';

  const formatElapsed = (start: string | null): string => {
    if (!start) return '—';
    const secs = Math.floor((currentTime.getTime() - new Date(start).getTime()) / 1000);
    if (secs < 60) return `${secs}s`;
    const m = Math.floor(secs / 60), s = secs % 60;
    if (m < 60) return `${m}min ${s}s`;
    return `${Math.floor(m / 60)}h ${m % 60}min`;
  };

  const formatEstimated = (): string => {
    if (!campaign || campaign.status === 'completed' || !campaign.started_at) return '—';
    const remaining = campaign.total_contacts - campaign.sent_count - campaign.failed_count;
    if (remaining <= 0) return '0s';
    const avgDelay = ((campaign.delay_seconds_min || 1) + (campaign.delay_seconds_max || 3)) / 2;
    const secs = Math.round(remaining * avgDelay);
    if (secs < 60) return `${secs}s`;
    const m = Math.floor(secs / 60);
    if (m < 60) return `${m}min`;
    return `${Math.floor(m / 60)}h ${m % 60}min`;
  };

  const getProgress = (): number => {
    if (!campaign || campaign.total_contacts === 0) return 0;
    return Math.min(100, Math.round(((campaign.sent_count + campaign.failed_count) / campaign.total_contacts) * 100));
  };

  const openRate = campaign && campaign.sent_count > 0 ? ((campaign.opened_count / campaign.sent_count) * 100).toFixed(1) : '0.0';
  const clickRate = campaign && campaign.sent_count > 0 ? ((campaign.clicked_count / campaign.sent_count) * 100).toFixed(1) : '0.0';

  const filteredRecipients = recipients.filter(r => {
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      return (r.email || '').toLowerCase().includes(q) || (r.name || '').toLowerCase().includes(q);
    }
    return true;
  });

  const recipientCounts: Record<string, number> = { all: recipients.length };
  for (const r of recipients) recipientCounts[r.status] = (recipientCounts[r.status] || 0) + 1;

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 flex items-center justify-center">
      <div className="text-center"><FaSpinner className="text-5xl text-orange-400 animate-spin mx-auto mb-4" /><p className="text-white/70 text-xl">Carregando...</p></div>
    </div>
  );

  if (!campaign) return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-400 text-xl mb-6">Campanha não encontrada</p>
        <button onClick={() => router.push('/email-marketing/campanhas')} className="px-6 py-3 bg-orange-500 text-white rounded-xl font-bold">Voltar</button>
      </div>
    </div>
  );

  const statusColor = STATUS_COLORS[campaign.status] || STATUS_COLORS.draft;
  const active = isActive(campaign);
  const progress = getProgress();
  const senders = campaign.from_senders?.length ? campaign.from_senders : [{ from_name: campaign.from_name, from_email: campaign.from_email }];
  const subjects = campaign.subjects?.length ? campaign.subjects : [campaign.subject];

  return (
    <>
      <Head><title>{campaign.name} | Detalhes | E-mail Marketing</title></Head>
      <notification.NotificationContainer />
      <ConfirmDialog />

      {/* Modal Editar Campanha */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-dark-800 rounded-2xl shadow-2xl border-2 border-orange-500/40 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-orange-600/30 via-orange-500/20 to-orange-600/30 backdrop-blur-xl border-b-2 border-orange-500/40 p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="bg-orange-500/20 p-3 rounded-xl"><FaEdit className="text-3xl text-orange-400" /></div>
                <div>
                  <h2 className="text-2xl font-black text-white">Editar Campanha</h2>
                  <p className="text-white/60 text-sm">As alterações são aplicadas imediatamente, mesmo em andamento</p>
                </div>
              </div>
              <button onClick={() => setShowEditModal(false)} className="p-2 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white"><FaTimes className="text-xl" /></button>
            </div>
            <div className="p-6 space-y-6">
              {/* Nome */}
              <div>
                <label className="block text-sm font-bold text-white/80 mb-2">Nome da Campanha</label>
                <input
                  value={editForm.name}
                  onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-4 py-3 bg-dark-700/80 border border-white/10 rounded-xl text-white text-sm placeholder-gray-500 focus:outline-none focus:border-orange-500/60"
                  placeholder="Nome da campanha"
                />
              </div>
              {/* Horário de trabalho */}
              <div>
                <label className="block text-sm font-bold text-white/80 mb-2">🕐 Horário de Trabalho</label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Início</label>
                    <input type="time" value={editForm.work_start_time}
                      onChange={e => setEditForm(f => ({ ...f, work_start_time: e.target.value }))}
                      className="w-full px-4 py-3 bg-dark-700/80 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-orange-500/60" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Fim</label>
                    <input type="time" value={editForm.work_end_time}
                      onChange={e => setEditForm(f => ({ ...f, work_end_time: e.target.value }))}
                      className="w-full px-4 py-3 bg-dark-700/80 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-orange-500/60" />
                  </div>
                </div>
              </div>
              {/* Delay */}
              <div>
                <label className="block text-sm font-bold text-white/80 mb-2">⏱️ Delay entre Envios (segundos)</label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Mínimo</label>
                    <input type="number" min="0" value={editForm.delay_seconds_min}
                      onChange={e => setEditForm(f => ({ ...f, delay_seconds_min: Number(e.target.value) }))}
                      className="w-full px-4 py-3 bg-dark-700/80 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-orange-500/60" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Máximo</label>
                    <input type="number" min="0" value={editForm.delay_seconds_max}
                      onChange={e => setEditForm(f => ({ ...f, delay_seconds_max: Number(e.target.value) }))}
                      className="w-full px-4 py-3 bg-dark-700/80 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-orange-500/60" />
                  </div>
                </div>
              </div>
              {/* Pausa automática */}
              <div>
                <label className="block text-sm font-bold text-white/80 mb-2">💤 Pausa Automática</label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Pausar a cada (envios, 0 = desativado)</label>
                    <input type="number" min="0" value={editForm.pause_after}
                      onChange={e => setEditForm(f => ({ ...f, pause_after: Number(e.target.value) }))}
                      className="w-full px-4 py-3 bg-dark-700/80 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-orange-500/60" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Duração da pausa (minutos)</label>
                    <input type="number" min="1" value={editForm.pause_duration_minutes}
                      onChange={e => setEditForm(f => ({ ...f, pause_duration_minutes: Number(e.target.value) }))}
                      className="w-full px-4 py-3 bg-dark-700/80 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-orange-500/60" />
                  </div>
                </div>
              </div>
              {/* Agendamento (só em draft/scheduled) */}
              {['draft', 'scheduled'].includes(campaign.status) && (
                <div>
                  <label className="block text-sm font-bold text-white/80 mb-2">📅 Data/Hora de Início</label>
                  <input type="datetime-local" value={editForm.scheduled_at}
                    onChange={e => setEditForm(f => ({ ...f, scheduled_at: e.target.value }))}
                    className="w-full px-4 py-3 bg-dark-700/80 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-orange-500/60" />
                  <p className="text-xs text-gray-500 mt-1">Deixe em branco para iniciar manualmente</p>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-white/10 flex gap-3">
              <button onClick={() => setShowEditModal(false)}
                className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2">
                <FaTimes /> Cancelar
              </button>
              <button onClick={handleSaveEdit} disabled={saving}
                className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                {saving ? <FaSpinner className="animate-spin" /> : <FaSave />}
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ver Destinatários */}
      {showAllContacts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-dark-800 rounded-2xl shadow-2xl border-2 border-orange-500/40 max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="sticky top-0 bg-gradient-to-r from-orange-600/30 via-orange-500/20 to-orange-600/30 backdrop-blur-xl border-b-2 border-orange-500/40 p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="bg-orange-500/20 p-3 rounded-xl"><FaListUl className="text-3xl text-orange-400" /></div>
                <div>
                  <h2 className="text-2xl font-black text-white">Destinatários da Campanha</h2>
                  <p className="text-white/60">{recipients.length} contato{recipients.length !== 1 ? 's' : ''} carregado{recipients.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <button onClick={() => setShowAllContacts(false)} className="p-2 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white"><FaTimes className="text-xl" /></button>
            </div>
            <div className="p-4 border-b border-white/10 flex gap-3 flex-wrap">
              <div className="flex-1 relative min-w-[200px]">
                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por e-mail ou nome..." className="w-full pl-9 pr-4 py-2.5 bg-dark-700/80 border border-white/10 rounded-xl text-white text-sm placeholder-gray-500 focus:outline-none focus:border-orange-500/50" />
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {(['all', 'pending', 'sent', 'opened', 'clicked', 'bounced', 'failed'] as const).map(s => (
                  <button key={s} onClick={() => setFilterStatus(s)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${filterStatus === s ? 'bg-orange-500 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'}`}>
                    {s === 'all' ? `Todos (${recipients.length})` : `${RECIPIENT_STATUS[s]?.label} (${recipientCounts[s] || 0})`}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {loadingRecipients ? (
                <div className="text-center py-12"><FaSpinner className="animate-spin text-4xl text-orange-400 mx-auto mb-3" /></div>
              ) : filteredRecipients.length === 0 ? (
                <div className="text-center py-12 text-gray-400"><FaUsers className="text-5xl mx-auto mb-4 text-gray-600" /><p>Nenhum destinatário encontrado</p></div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-dark-800/90 backdrop-blur-md">
                    <tr>
                      {['E-mail', 'Nome', 'Status', 'Enviado em', 'Aberto em', 'Clicado em', 'Erro'].map(h => (
                        <th key={h} className="text-left py-3 px-3 text-xs font-bold text-gray-400 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecipients.map(r => {
                      const rs = RECIPIENT_STATUS[r.status] || RECIPIENT_STATUS.pending;
                      return (
                        <tr key={r.id} className="border-b border-white/5 hover:bg-white/5">
                          <td className="py-3 px-3 text-white font-medium">{r.email}</td>
                          <td className="py-3 px-3 text-gray-400">{r.name || '—'}</td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-1 rounded-lg text-xs font-bold border ${rs.color}`}>{rs.label}</span>
                          </td>
                          <td className="py-3 px-3 text-gray-500 text-xs">{r.sent_at ? new Date(r.sent_at).toLocaleString('pt-BR') : '—'}</td>
                          <td className="py-3 px-3 text-purple-400 text-xs">{r.opened_at ? new Date(r.opened_at).toLocaleString('pt-BR') : '—'}</td>
                          <td className="py-3 px-3 text-indigo-400 text-xs">{r.clicked_at ? new Date(r.clicked_at).toLocaleString('pt-BR') : '—'}</td>
                          <td className="py-3 px-3 text-red-400 text-xs max-w-[180px] truncate">{r.error_message || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
            <div className="p-4 border-t border-white/10">
              <button onClick={() => setShowAllContacts(false)} className="w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all">
                <FaTimes /> Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 py-8 px-4">
        <div className="max-w-7xl mx-auto space-y-8">

          {/* VOLTAR */}
          <button onClick={() => router.push('/email-marketing/campanhas')}
            className="inline-flex items-center gap-3 px-6 py-3 bg-dark-700/60 hover:bg-dark-700 backdrop-blur-xl border-2 border-white/10 hover:border-orange-500/40 text-white font-bold rounded-xl transition-all">
            <FaArrowLeft /> Voltar para Campanhas
          </button>

          {/* HEADER */}
          <div className="relative overflow-hidden bg-gradient-to-r from-orange-600/30 via-orange-500/20 to-orange-600/30 backdrop-blur-xl border-2 border-orange-500/40 rounded-3xl p-10 shadow-2xl shadow-orange-500/20">
            <div className="absolute inset-0 bg-grid-white/[0.02]"></div>
            <div className="relative">
              <div className="flex items-start justify-between flex-wrap gap-6">
                <div className="flex items-start gap-5 flex-1">
                  <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-5 rounded-2xl shadow-lg shadow-orange-500/50 flex-shrink-0">
                    <FaBullhorn className="text-4xl text-white" />
                  </div>
                  <div>
                    <h1 className="text-4xl font-black text-white mb-3">{campaign.name}</h1>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className={`px-4 py-2 rounded-xl text-sm font-bold border-2 flex items-center gap-2 ${statusColor}`}>
                        {campaign.status === 'sending' && <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse inline-block"></span>}
                        {STATUS_LABELS[campaign.status] || campaign.status}
                      </span>
                      {campaign.scheduled_at && campaign.status === 'scheduled' && (
                        <span className="px-3 py-2 rounded-xl text-sm font-bold bg-purple-500/20 text-purple-300 border-2 border-purple-500/30 flex items-center gap-2">
                          <FaCalendarAlt /> {formatDt(campaign.scheduled_at)}
                        </span>
                      )}
                      <span className="text-white/60 text-sm">Criada em {formatDt(campaign.created_at)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 flex-wrap">
                  <button onClick={() => { loadRecipients(); setShowAllContacts(true); }}
                    className="px-5 py-3 bg-white/10 hover:bg-white/20 text-white border-2 border-white/20 rounded-xl font-bold flex items-center gap-2 transition-all">
                    <FaListUl /> Ver Destinatários
                  </button>
                  <button onClick={openEditModal}
                    className="px-5 py-3 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border-2 border-yellow-500/30 rounded-xl font-bold flex items-center gap-2 transition-all">
                    <FaEdit /> Editar
                  </button>
                  <button onClick={downloadReport}
                    className="px-5 py-3 bg-green-500/20 hover:bg-green-500/30 text-green-300 border-2 border-green-500/30 rounded-xl font-bold flex items-center gap-2 transition-all">
                    <FaDownload /> Relatório CSV
                  </button>
                  <button onClick={() => loadData()}
                    className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all" title="Atualizar">
                    <FaSync className={`text-lg ${isPolling ? 'animate-spin' : ''}`} />
                  </button>
                  {['draft', 'scheduled'].includes(campaign.status) && (
                    <button onClick={handleStart} className="px-5 py-3 bg-green-500/20 hover:bg-green-500/30 text-green-300 border-2 border-green-500/40 rounded-xl font-bold flex items-center gap-2">
                      <FaPlay /> Iniciar
                    </button>
                  )}
                  {campaign.status === 'paused' && (
                    <button onClick={handleStart} className="px-5 py-3 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border-2 border-blue-500/40 rounded-xl font-bold flex items-center gap-2">
                      <FaPlay /> Retomar
                    </button>
                  )}
                  {campaign.status === 'sending' && (
                    <button onClick={handlePause} className="px-5 py-3 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border-2 border-yellow-500/40 rounded-xl font-bold flex items-center gap-2">
                      <FaPause /> Pausar
                    </button>
                  )}
                  {['sending', 'paused', 'draft', 'scheduled'].includes(campaign.status) && (
                    <button onClick={handleCancel} className="px-5 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-300 border-2 border-red-500/40 rounded-xl font-bold flex items-center gap-2">
                      <FaBan /> Cancelar
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Polling indicator */}
          {active && (
            <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-white/10 rounded-2xl px-6 py-3 flex items-center gap-4">
              {isPolling
                ? <FaSpinner className="text-orange-400 animate-spin flex-shrink-0" />
                : <FaSync className={`flex-shrink-0 ${countdown <= 3 ? 'text-yellow-400 animate-pulse' : 'text-green-400'}`} />
              }
              <div className="flex-1">
                <p className="text-white text-sm font-semibold">
                  {isPolling ? 'Atualizando...' : `Monitorando em tempo real — próxima atualização em ${countdown}s`}
                </p>
                {lastUpdated && <p className="text-gray-400 text-xs">Última: {lastUpdated.toLocaleTimeString('pt-BR')}</p>}
              </div>
              <div className="w-full max-w-xs">
                <div className="bg-white/10 rounded-full h-1.5 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-1000 bg-gradient-to-r from-orange-500 to-yellow-400"
                    style={{ width: `${((POLL_INTERVAL - countdown) / POLL_INTERVAL) * 100}%` }} />
                </div>
              </div>
            </div>
          )}

          {/* DATAS + CONFIGURAÇÕES */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-8 shadow-xl">
              <h3 className="text-2xl font-black text-white mb-6 flex items-center gap-3">
                <span className="text-3xl">📅</span> Datas
              </h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-white/60 w-32 flex-shrink-0">⏳ Criada em:</span>
                  <strong className="text-white">{formatDt(campaign.created_at)}</strong>
                </div>
                {campaign.scheduled_at && (
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-white/60 w-32 flex-shrink-0">📅 Agendada:</span>
                    <strong className="text-purple-300">{formatDt(campaign.scheduled_at)}</strong>
                  </div>
                )}
                {campaign.started_at && (
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-white/60 w-32 flex-shrink-0">🚀 Iniciada:</span>
                    <strong className="text-white">{formatDt(campaign.started_at)}</strong>
                  </div>
                )}
                {campaign.completed_at && (
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-white/60 w-32 flex-shrink-0">✅ Concluída:</span>
                    <strong className="text-green-300">{formatDt(campaign.completed_at)}</strong>
                  </div>
                )}
                {campaign.list_name && (
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-white/60 w-32 flex-shrink-0">📋 Lista:</span>
                    <strong className="text-white">{campaign.list_name}</strong>
                  </div>
                )}
                {campaign.domain_name && (
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-white/60 w-32 flex-shrink-0">🌐 Domínio:</span>
                    <strong className="text-white">{campaign.domain_name}</strong>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-8 shadow-xl">
              <h3 className="text-2xl font-black text-white mb-6 flex items-center gap-3">
                <span className="text-3xl">⚙️</span> Configurações
              </h3>
              <div className="space-y-3">
                {(campaign.work_start_time || campaign.work_end_time) && (
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-white/60 w-36 flex-shrink-0">🕐 Horário:</span>
                    <strong className="text-white">{campaign.work_start_time || '00:00'} – {campaign.work_end_time || '23:59'}</strong>
                  </div>
                )}
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-white/60 w-36 flex-shrink-0">⏱️ Delay:</span>
                  <strong className="text-white">{campaign.delay_seconds_min || 1}s – {campaign.delay_seconds_max || 3}s entre envios</strong>
                </div>
                {(campaign.pause_after || 0) > 0 && (
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-white/60 w-36 flex-shrink-0">💤 Pausa:</span>
                    <strong className="text-white">A cada {campaign.pause_after} envios por {campaign.pause_duration_minutes} min</strong>
                  </div>
                )}
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-white/60 w-36 flex-shrink-0">👤 Remetentes:</span>
                  <strong className="text-white">{senders.length} remetente{senders.length !== 1 ? 's' : ''}</strong>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-white/60 w-36 flex-shrink-0">📝 Assuntos:</span>
                  <strong className="text-white">{subjects.length} assunto{subjects.length !== 1 ? 's' : ''}</strong>
                </div>
                {/* Lista de remetentes quando múltiplos */}
                {senders.length > 1 && (
                  <div className="mt-2 bg-black/30 rounded-xl p-3">
                    <p className="text-xs text-gray-500 mb-2 font-bold">Remetentes configurados:</p>
                    <div className="space-y-1 max-h-24 overflow-y-auto">
                      {senders.map((s, i) => (
                        <p key={i} className="text-xs text-gray-300">{s.from_name} &lt;{s.from_email}&gt;</p>
                      ))}
                    </div>
                  </div>
                )}
                {subjects.length > 1 && (
                  <div className="mt-2 bg-black/30 rounded-xl p-3">
                    <p className="text-xs text-gray-500 mb-2 font-bold">Assuntos configurados (A/B):</p>
                    <div className="space-y-1 max-h-24 overflow-y-auto">
                      {subjects.map((s, i) => <p key={i} className="text-xs text-gray-300">• {s}</p>)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* PROGRESSO */}
          <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-orange-500/30 rounded-2xl p-8 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-3xl font-black text-white flex items-center gap-3"><span className="text-4xl">📊</span> Progresso</h3>
              <span className="text-5xl font-black text-orange-300">{progress}%</span>
            </div>
            <div className="w-full bg-dark-700 rounded-xl h-6 overflow-hidden mb-8 border-2 border-white/10">
              <div className="bg-gradient-to-r from-orange-500 to-yellow-500 h-full transition-all duration-500 rounded-lg" style={{ width: `${progress}%` }} />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              {[
                { label: 'Total', value: campaign.total_contacts, color: 'text-white', bg: 'from-white/10 to-white/5 border-white/10' },
                { label: '⏳ Pendentes', value: Math.max(0, campaign.total_contacts - campaign.sent_count - campaign.failed_count), color: 'text-yellow-400', bg: 'from-yellow-500/10 to-yellow-600/5 border-yellow-500/20' },
                { label: '📤 Enviados', value: campaign.sent_count, color: 'text-blue-400', bg: 'from-blue-500/10 to-blue-600/5 border-blue-500/20' },
                { label: '✅ Abertos', value: campaign.opened_count, color: 'text-purple-400', bg: 'from-purple-500/10 to-purple-600/5 border-purple-500/20' },
                { label: '👆 Cliques', value: campaign.clicked_count, color: 'text-indigo-400', bg: 'from-indigo-500/10 to-indigo-600/5 border-indigo-500/20' },
                { label: '↩️ Rejeitados', value: campaign.bounced_count, color: 'text-orange-400', bg: 'from-orange-500/10 to-orange-600/5 border-orange-500/20' },
                { label: '🚩 Spam', value: campaign.complained_count, color: 'text-red-400', bg: 'from-red-500/10 to-red-600/5 border-red-500/20' },
                { label: '❌ Falhos', value: campaign.failed_count, color: 'text-red-400', bg: 'from-red-500/10 to-red-600/5 border-red-500/20' },
              ].map((m, i) => (
                <div key={i} className={`bg-gradient-to-br ${m.bg} backdrop-blur-md border-2 rounded-xl p-4 text-center hover:scale-105 transition-all`}>
                  <div className={`text-3xl font-black mb-1 ${m.color}`}>{m.value}</div>
                  <div className="text-xs font-bold text-white/60">{m.label}</div>
                </div>
              ))}
            </div>

            {/* Taxas */}
            {campaign.sent_count > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                {[
                  { label: 'Taxa de Abertura', value: `${openRate}%`, color: 'text-purple-300', icon: '👁️' },
                  { label: 'Taxa de Cliques', value: `${clickRate}%`, color: 'text-indigo-300', icon: '👆' },
                  { label: 'Taxa de Rejeição', value: `${campaign.sent_count > 0 ? ((campaign.bounced_count / campaign.sent_count) * 100).toFixed(1) : '0.0'}%`, color: 'text-orange-300', icon: '↩️' },
                  { label: 'Taxa de Falha', value: `${campaign.total_contacts > 0 ? ((campaign.failed_count / campaign.total_contacts) * 100).toFixed(1) : '0.0'}%`, color: 'text-red-300', icon: '❌' },
                ].map((t, i) => (
                  <div key={i} className="bg-black/30 rounded-xl p-4 text-center border border-white/10">
                    <div className={`text-2xl font-black ${t.color}`}>{t.icon} {t.value}</div>
                    <div className="text-xs text-white/50 mt-1">{t.label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* TEMPO E STATUS (só quando ativa) */}
          {active && (
            <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-8 shadow-xl">
              <h3 className="text-3xl font-black text-white mb-8 flex items-center gap-3"><span className="text-4xl">⏱️</span> Tempo e Status</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border-2 border-blue-500/30 rounded-2xl p-6">
                  <div className="flex items-center gap-3 mb-4"><FaClock className="text-3xl text-blue-400" /><span className="text-white/70 font-bold">Tempo Decorrido</span></div>
                  <div className="text-4xl font-black text-blue-300">{formatElapsed(campaign.started_at)}</div>
                  {campaign.started_at && <div className="text-sm text-white/50 mt-2">Início: {new Date(campaign.started_at).toLocaleTimeString('pt-BR')}</div>}
                </div>
                <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 border-2 border-green-500/30 rounded-2xl p-6">
                  <div className="flex items-center gap-3 mb-4"><FaClock className="text-3xl text-green-400" /><span className="text-white/70 font-bold">Estimativa Restante</span></div>
                  <div className="text-4xl font-black text-green-300">{formatEstimated()}</div>
                  <div className="text-sm text-white/50 mt-2">Faltam {Math.max(0, campaign.total_contacts - campaign.sent_count - campaign.failed_count)} contatos</div>
                </div>
                <div className={`bg-gradient-to-br border-2 rounded-2xl p-6 ${campaign.status === 'sending' ? 'from-green-500/20 to-green-600/10 border-green-500/30' : 'from-yellow-500/20 to-yellow-600/10 border-yellow-500/30'}`}>
                  <div className="flex items-center gap-3 mb-4">
                    {campaign.status === 'sending' ? <FaPlay className="text-3xl text-green-400" /> : <FaPause className="text-3xl text-yellow-400" />}
                    <span className="text-white/70 font-bold">Status Atual</span>
                  </div>
                  <div className={`text-2xl font-black ${campaign.status === 'sending' ? 'text-green-300' : 'text-yellow-300'}`}>
                    {campaign.status === 'sending' ? '🔄 ENVIANDO' : campaign.status === 'paused' ? '⏸️ PAUSADA' : '📅 AGENDADA'}
                  </div>
                  {campaign.pause_started_at && campaign.status === 'paused' && (
                    <div className="text-sm text-white/50 mt-2">Pausada em: {new Date(campaign.pause_started_at).toLocaleTimeString('pt-BR')}</div>
                  )}
                </div>
                <div className="bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 border-2 border-cyan-500/30 rounded-2xl p-6">
                  <div className="flex items-center gap-3 mb-4"><span className="text-3xl">⚡</span><span className="text-white/70 font-bold">Ritmo de Envio</span></div>
                  <div className="text-3xl font-black text-cyan-300">{campaign.delay_seconds_min}–{campaign.delay_seconds_max}s</div>
                  <div className="text-sm text-white/50 mt-2">delay entre e-mails</div>
                  {(campaign.pause_after || 0) > 0 && (
                    <div className="text-xs text-cyan-400 mt-2 pt-2 border-t border-white/10">
                      Pausa a cada {campaign.pause_after} envios ({campaign.pause_duration_minutes}min)
                    </div>
                  )}
                  {(campaign.sent_in_session || 0) > 0 && (
                    <div className="text-xs text-white/40 mt-1">
                      {campaign.sent_in_session} enviados nesta sessão
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TABELA DE DESTINATÁRIOS RESUMIDA */}
          <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-8 shadow-xl">
            <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
              <h3 className="text-3xl font-black text-white flex items-center gap-3">
                <span className="text-4xl">📨</span> Destinatários
              </h3>
              <button
                onClick={() => { loadRecipients(); setShowAllContacts(true); }}
                disabled={loadingRecipients}
                className="px-6 py-3 bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 border-2 border-orange-500/40 rounded-xl font-bold flex items-center gap-2 transition-all disabled:opacity-50">
                {loadingRecipients ? <FaSpinner className="animate-spin" /> : <FaUsers />}
                Ver Todos os Destinatários
              </button>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-7 gap-3">
              {[
                { label: 'Pendentes', key: 'pending', color: 'text-yellow-300 border-yellow-500/30 bg-yellow-500/10', icon: <FaClock /> },
                { label: 'Enviados',  key: 'sent',    color: 'text-blue-300 border-blue-500/30 bg-blue-500/10',      icon: <FaEnvelope /> },
                { label: 'Abertos',   key: 'opened',  color: 'text-purple-300 border-purple-500/30 bg-purple-500/10', icon: <FaEye /> },
                { label: 'Clicados',  key: 'clicked', color: 'text-indigo-300 border-indigo-500/30 bg-indigo-500/10', icon: <FaMousePointer /> },
                { label: 'Rejeitados',key: 'bounced', color: 'text-orange-300 border-orange-500/30 bg-orange-500/10', icon: <FaExclamationTriangle /> },
                { label: 'Spam',      key: 'complained',color:'text-red-300 border-red-500/30 bg-red-500/10',         icon: <FaFlag /> },
                { label: 'Falhos',    key: 'failed',  color: 'text-red-300 border-red-500/30 bg-red-500/10',          icon: <FaTimesCircle /> },
              ].map(item => {
                const val = item.key === 'pending'
                  ? Math.max(0, campaign.total_contacts - campaign.sent_count - campaign.failed_count)
                  : item.key === 'sent' ? campaign.sent_count
                  : item.key === 'opened' ? campaign.opened_count
                  : item.key === 'clicked' ? campaign.clicked_count
                  : item.key === 'bounced' ? campaign.bounced_count
                  : item.key === 'complained' ? campaign.complained_count
                  : campaign.failed_count;
                return (
                  <div key={item.key} className={`rounded-xl p-4 text-center border ${item.color} transition-all`}>
                    <div className="text-2xl mb-2 flex justify-center">{item.icon}</div>
                    <div className="text-2xl font-black">{val}</div>
                    <div className="text-xs font-bold mt-1 opacity-80">{item.label}</div>
                  </div>
                );
              })}
            </div>

            <p className="text-center text-sm text-gray-500 mt-4">
              Clique em "Ver Todos os Destinatários" para ver a lista completa com status individual de cada e-mail
            </p>
          </div>

        </div>
      </div>

      <style jsx>{`
        .bg-grid-white {
          background-image: linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px);
          background-size: 20px 20px;
        }
      `}</style>
    </>
  );
}
