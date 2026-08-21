import { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import Head from 'next/head';
import {
  FaEnvelope, FaBullhorn, FaPaperPlane, FaArrowLeft, FaSync,
  FaCheckCircle, FaTimesCircle, FaEye, FaMousePointer,
  FaExclamationTriangle, FaUser, FaClock, FaSearch, FaFilter,
  FaCheckDouble, FaFlag, FaBan, FaEdit, FaRedo, FaSpinner, FaTimes, FaSave
} from 'react-icons/fa';
import api from '@/services/api';
import { useNotification } from '@/hooks/useNotification';

const EmailBodyEditor = dynamic(() => import('@/components/EmailBodyEditor'), { ssr: false });

interface Domain { id: number; domain: string; status: string; }

interface Send {
  id: number;
  type: 'campaign' | 'single';
  title: string;
  subject: string;
  from_email: string;
  from_name: string;
  user_id: number | null;
  user_name: string | null;
  status: string;
  total_contacts: number;
  sent_count: number;
  failed_count: number;
  opened_count: number;
  clicked_count: number;
  bounced_count: number;
  complained_count: number;
  sent_at: string | null;
  created_at: string;
  to_email: string | null;
  to_name: string | null;
  mailgun_message_id: string | null;
  error_message?: string | null;
  domain_id?: number | null;
  reply_to?: string | null;
  body_html?: string | null;
}

function extractLocalPart(value: string): string {
  const raw = String(value || '').trim();
  return (raw.includes('@') ? raw.split('@')[0] : raw)
    .replace(/[^a-zA-Z0-9._+-]/g, '')
    .toLowerCase();
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: JSX.Element }> = {
  draft:     { label: 'Rascunho',  color: 'text-gray-400 bg-gray-500/10 border-gray-500/30',      icon: <FaClock /> },
  sending:   { label: 'Enviando', color: 'text-blue-300 bg-blue-500/10 border-blue-500/30',       icon: <FaSync className="animate-spin" /> },
  completed: { label: 'Concluído',color: 'text-green-300 bg-green-500/10 border-green-500/30',    icon: <FaCheckCircle /> },
  sent:      { label: 'Enviado',  color: 'text-green-300 bg-green-500/10 border-green-500/30',    icon: <FaCheckCircle /> },
  paused:    { label: 'Pausado',  color: 'text-yellow-300 bg-yellow-500/10 border-yellow-500/30', icon: <FaClock /> },
  failed:    { label: 'Falhou',   color: 'text-red-300 bg-red-500/10 border-red-500/30',          icon: <FaTimesCircle /> },
  cancelled: { label: 'Cancelado',color: 'text-red-300 bg-red-500/10 border-red-500/30',          icon: <FaTimesCircle /> },
  opened:    { label: 'Aberto',   color: 'text-purple-300 bg-purple-500/10 border-purple-500/30', icon: <FaEye /> },
  clicked:   { label: 'Clicado',  color: 'text-indigo-300 bg-indigo-500/10 border-indigo-500/30', icon: <FaMousePointer /> },
  bounced:   { label: 'Rejeitado',color: 'text-orange-300 bg-orange-500/10 border-orange-500/30', icon: <FaExclamationTriangle /> },
  complained:{ label: 'Spam',     color: 'text-red-300 bg-red-500/10 border-red-500/30',          icon: <FaTimesCircle /> },
};

function formatDateTime(date: string | null) {
  if (!date) return '—';
  return new Date(date).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function pct(num: number, total: number) {
  if (!total) return '0%';
  return `${Math.round((num / total) * 100)}%`;
}

function getTrackingFlags(s: Send) {
  if (s.type === 'campaign') {
    return {
      delivered:  (s.sent_count || 0) > 0,
      opened:     (s.opened_count || 0) > 0,
      clicked:    (s.clicked_count || 0) > 0,
      bounced:    (s.bounced_count || 0) > 0,
      complained: (s.complained_count || 0) > 0,
      failed:     (s.failed_count || 0) > 0,
    };
  }
  const st = s.status;
  return {
    delivered:  !['failed', 'bounced', 'pending'].includes(st) && st !== 'draft',
    opened:     ['opened', 'clicked'].includes(st) || (s.opened_count || 0) > 0,
    clicked:    st === 'clicked' || (s.clicked_count || 0) > 0,
    bounced:    st === 'bounced',
    complained: st === 'complained',
    failed:     st === 'failed',
  };
}

const TRACKING_ICONS = [
  { key: 'delivered',  label: 'Entregue',  icon: <FaCheckDouble />,         activeColor: 'text-green-400 bg-green-500/20 border-green-500/40' },
  { key: 'opened',     label: 'Aberto',    icon: <FaEye />,                  activeColor: 'text-purple-400 bg-purple-500/20 border-purple-500/40' },
  { key: 'clicked',    label: 'Clicado',   icon: <FaMousePointer />,         activeColor: 'text-indigo-400 bg-indigo-500/20 border-indigo-500/40' },
  { key: 'bounced',    label: 'Rejeitado', icon: <FaExclamationTriangle />,  activeColor: 'text-orange-400 bg-orange-500/20 border-orange-500/40' },
  { key: 'complained', label: 'Spam',      icon: <FaFlag />,                 activeColor: 'text-red-400 bg-red-500/20 border-red-500/40' },
  { key: 'failed',     label: 'Falhou',    icon: <FaBan />,                  activeColor: 'text-red-400 bg-red-500/20 border-red-500/40' },
] as const;

export default function Envios() {
  const router = useRouter();
  const notification = useNotification();
  const [sends, setSends] = useState<Send[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'campaign' | 'single'>('all');
  const [domains, setDomains] = useState<Domain[]>([]);
  const [editSend, setEditSend] = useState<Send | null>(null);
  const [resending, setResending] = useState(false);
  const [editForm, setEditForm] = useState({
    domain_id: '',
    from_name: '',
    from_email: '',
    reply_to: '',
    to_name: '',
    to_email: '',
    subject: '',
    body_html: '',
  });

  useEffect(() => {
    loadSends();
    api.get('/email-marketing/domains').then(r => {
      setDomains((r.data.data || []).filter((d: Domain) => d.status === 'active'));
    }).catch(() => {});
  }, []);

  const loadSends = async () => {
    setLoading(true);
    try { const r = await api.get('/email-marketing/sends?limit=200'); setSends(r.data.data || []); }
    catch { } finally { setLoading(false); }
  };

  const selectedDomain = useMemo(
    () => domains.find(d => String(d.id) === String(editForm.domain_id))?.domain || '',
    [domains, editForm.domain_id]
  );

  const openResendModal = async (s: Send) => {
    try {
      const r = await api.get(`/email-marketing/send-single/${s.id}`);
      const d = r.data.data || s;
      setEditForm({
        domain_id: d.domain_id ? String(d.domain_id) : (s.domain_id ? String(s.domain_id) : ''),
        from_name: d.from_name || '',
        from_email: extractLocalPart(d.from_email || ''),
        reply_to: d.reply_to || '',
        to_name: d.to_name || '',
        to_email: d.to_email || '',
        subject: d.subject || '',
        body_html: d.body_html || '',
      });
      setEditSend({ ...s, ...d, type: 'single' });
    } catch (e: any) {
      notification.error('Erro', e.response?.data?.message || e.message);
    }
  };

  const handleResend = async () => {
    if (!editSend) return;
    const local = extractLocalPart(editForm.from_email);
    if (!editForm.domain_id) return notification.error('Erro', 'Selecione um domínio');
    if (!local) return notification.error('Erro', 'Informe o usuário do remetente');
    if (!editForm.to_email) return notification.error('Erro', 'Informe o destinatário');
    if (!editForm.subject) return notification.error('Erro', 'Informe o assunto');
    if (!editForm.body_html?.trim()) {
      return notification.error('Erro', 'Cole ou edite o corpo do e-mail para reenviar');
    }
    setResending(true);
    try {
      await api.post(`/email-marketing/send-single/${editSend.id}/resend`, {
        domain_id: Number(editForm.domain_id),
        from_name: editForm.from_name,
        from_email: local,
        reply_to: editForm.reply_to || undefined,
        to_name: editForm.to_name || undefined,
        to_email: editForm.to_email,
        subject: editForm.subject,
        body_html: editForm.body_html,
      });
      notification.success('Reenviado!', 'E-mail reenviado com sucesso');
      setEditSend(null);
      await loadSends();
    } catch (e: any) {
      notification.error('Falha no reenvio', e.response?.data?.message || e.message);
      await loadSends();
    } finally {
      setResending(false);
    }
  };

  const filtered = sends.filter(s => {
    if (filterType !== 'all' && s.type !== filterType) return false;
    if (search) {
      const q = search.toLowerCase();
      return (s.subject || '').toLowerCase().includes(q) ||
             (s.from_email || '').toLowerCase().includes(q) ||
             (s.to_email || '').toLowerCase().includes(q) ||
             (s.user_name || '').toLowerCase().includes(q) ||
             (s.title || '').toLowerCase().includes(q) ||
             (s.error_message || '').toLowerCase().includes(q);
    }
    return true;
  });

  const totalEnvios = sends.length;
  const totalCampanhas = sends.filter(s => s.type === 'campaign').length;
  const totalUnicos = sends.filter(s => s.type === 'single').length;
  const totalAbertos = sends.reduce((acc, s) => acc + (s.opened_count || 0), 0);

  const inputCls = 'w-full px-4 py-3 bg-dark-700/80 border border-white/15 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500/50';
  const labelCls = 'block text-sm font-bold text-white/80 mb-2';

  return (
    <>
      <Head><title>Histórico de Envios | E-mail Marketing</title></Head>
      <notification.NotificationContainer />
      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 py-8 px-4">
        <div className="max-w-7xl mx-auto space-y-8">

          <div className="relative overflow-hidden bg-gradient-to-r from-red-600/30 via-red-500/20 to-red-600/30 backdrop-blur-xl border-2 border-red-500/40 rounded-3xl p-10 shadow-2xl shadow-red-500/20">
            <div className="absolute inset-0 bg-grid-white/[0.02]"></div>
            <div className="relative">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-6">
                  <button onClick={() => router.push('/email-marketing')} className="p-3 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all">
                    <FaArrowLeft className="text-xl" />
                  </button>
                  <div className="bg-gradient-to-br from-red-500 to-red-600 p-6 rounded-2xl shadow-lg shadow-red-500/50">
                    <FaEnvelope className="text-5xl text-white" />
                  </div>
                  <div>
                    <h1 className="text-5xl font-black text-white mb-2 tracking-tight">Histórico de Envios</h1>
                    <p className="text-xl text-white/80 font-medium">Todos os e-mails enviados — campanhas e envios únicos</p>
                  </div>
                </div>
                <button onClick={loadSends} className="p-4 bg-white/10 hover:bg-white/20 rounded-2xl text-white transition-all" title="Atualizar">
                  <FaSync className={`text-xl ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {totalEnvios > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                  {[
                    { label: 'Total de Envios', value: totalEnvios, icon: <FaEnvelope className="text-blue-300" />, color: 'text-blue-300' },
                    { label: 'Campanhas', value: totalCampanhas, icon: <FaBullhorn className="text-orange-300" />, color: 'text-orange-300' },
                    { label: 'Envios Únicos', value: totalUnicos, icon: <FaPaperPlane className="text-green-300" />, color: 'text-green-300' },
                    { label: 'Total Abertos', value: totalAbertos, icon: <FaEye className="text-purple-300" />, color: 'text-purple-300' },
                  ].map((s, i) => (
                    <div key={i} className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20 flex items-center gap-3">
                      <div className="text-2xl">{s.icon}</div>
                      <div>
                        <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                        <div className="text-sm text-white/70">{s.label}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[200px] relative">
              <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por assunto, e-mail, atendente..."
                className="w-full pl-11 pr-4 py-3.5 bg-dark-800/60 backdrop-blur-xl border-2 border-white/10 hover:border-white/20 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:border-white/30 transition-all" />
            </div>
            <div className="flex items-center gap-2 bg-dark-800/60 backdrop-blur-xl border-2 border-white/10 rounded-xl px-4">
              <FaFilter className="text-gray-500 text-sm flex-shrink-0" />
              {(['all', 'campaign', 'single'] as const).map(t => (
                <button key={t} onClick={() => setFilterType(t)}
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${filterType === t ? 'bg-white/20 text-white' : 'text-gray-400 hover:text-white'}`}>
                  {t === 'all' ? 'Todos' : t === 'campaign' ? '📢 Campanhas' : '✉️ Únicos'}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="text-center py-20 text-gray-400">
              <FaSync className="animate-spin text-5xl text-red-400 mx-auto mb-4" />
              <p className="text-lg">Carregando envios...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-red-500/20 rounded-2xl p-16 text-center">
              <div className="bg-red-500/10 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
                <FaEnvelope className="text-5xl text-red-400" />
              </div>
              <h3 className="text-2xl font-black text-white mb-3">Nenhum envio encontrado</h3>
              <p className="text-gray-400">Os envios aparecerão aqui depois que você enviar campanhas ou e-mails únicos.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filtered.map(s => {
                const st = STATUS_CONFIG[s.status] || STATUS_CONFIG['sent'];
                const isCampaign = s.type === 'campaign';
                const flags = getTrackingFlags(s);
                const canResend = !isCampaign && ['failed', 'bounced'].includes(s.status);
                return (
                  <div key={`${s.type}-${s.id}`}
                    className={`bg-dark-800/60 backdrop-blur-xl rounded-2xl p-6 border-2 transition-all duration-300 shadow-xl
                      ${isCampaign
                        ? 'border-orange-500/20 hover:border-orange-500/40 cursor-pointer'
                        : 'border-blue-500/20 hover:border-blue-500/40'}`}
                    onClick={() => isCampaign && router.push(`/email-marketing/campanhas/${s.id}`)}>

                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex items-start gap-4 flex-1 min-w-0">
                        <div className={`p-3 rounded-xl flex-shrink-0 ${isCampaign ? 'bg-orange-500/20' : 'bg-blue-500/20'}`}>
                          {isCampaign
                            ? <FaBullhorn className="text-orange-300 text-2xl" />
                            : <FaPaperPlane className="text-blue-300 text-2xl" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-2">
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${isCampaign ? 'text-orange-300 bg-orange-500/10 border-orange-500/30' : 'text-blue-300 bg-blue-500/10 border-blue-500/30'}`}>
                              {isCampaign ? '📢 Em Massa' : '✉️ Envio Único'}
                            </span>
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-full border flex items-center gap-1 ${st.color}`}>
                              {st.icon} {st.label}
                            </span>
                          </div>
                          <p className="text-white font-bold text-base truncate">{s.subject}</p>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            <span className="text-gray-400 text-sm flex items-center gap-1">
                              <FaEnvelope className="text-xs" /> {s.from_name ? `${s.from_name} <${s.from_email}>` : s.from_email}
                            </span>
                            {!isCampaign && s.to_email && (
                              <span className="text-gray-400 text-sm">→ {s.to_name ? `${s.to_name} <${s.to_email}>` : s.to_email}</span>
                            )}
                            {s.user_name && (
                              <span className="text-gray-400 text-sm flex items-center gap-1">
                                <FaUser className="text-xs" /> {s.user_name}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                            {TRACKING_ICONS.map(({ key, label, icon, activeColor }) => {
                              const active = flags[key as keyof typeof flags];
                              return (
                                <div key={key} title={label}
                                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all select-none
                                    ${active ? activeColor : 'text-gray-400 bg-white/5 border-white/10'}`}>
                                  {icon}
                                  <span>{label}</span>
                                </div>
                              );
                            })}
                          </div>

                          {!isCampaign && s.error_message && (
                            <div className="mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-200 text-sm break-words">
                              <strong className="text-red-300">Motivo:</strong> {s.error_message}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <span className="text-gray-500 text-sm flex items-center gap-1">
                          <FaClock className="text-xs" /> {formatDateTime(s.sent_at || s.created_at)}
                        </span>

                        {canResend && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); openResendModal(s); }}
                            className="mt-1 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold flex items-center gap-2"
                          >
                            <FaEdit /> Editar e Reenviar
                          </button>
                        )}

                        {isCampaign && (
                          <div className="flex items-center gap-3">
                            <div className="text-center">
                              <p className="text-white font-bold">{s.sent_count}/{s.total_contacts}</p>
                              <p className="text-gray-500 text-xs">Enviados</p>
                            </div>
                            {s.opened_count > 0 && (
                              <div className="text-center">
                                <p className="text-purple-300 font-bold flex items-center gap-1">
                                  <FaEye className="text-xs" /> {s.opened_count}
                                  <span className="text-gray-500 font-normal text-xs">({pct(s.opened_count, s.sent_count)})</span>
                                </p>
                                <p className="text-gray-500 text-xs">Abertos</p>
                              </div>
                            )}
                            {s.clicked_count > 0 && (
                              <div className="text-center">
                                <p className="text-indigo-300 font-bold flex items-center gap-1">
                                  <FaMousePointer className="text-xs" /> {s.clicked_count}
                                </p>
                                <p className="text-gray-500 text-xs">Cliques</p>
                              </div>
                            )}
                            {s.bounced_count > 0 && (
                              <div className="text-center">
                                <p className="text-orange-300 font-bold">{s.bounced_count}</p>
                                <p className="text-gray-500 text-xs">Rejeit.</p>
                              </div>
                            )}
                            {s.failed_count > 0 && (
                              <div className="text-center">
                                <p className="text-red-300 font-bold">{s.failed_count}</p>
                                <p className="text-gray-500 text-xs">Falhou</p>
                              </div>
                            )}
                          </div>
                        )}

                        {!isCampaign && (s.opened_count > 1 || s.clicked_count > 0) && (
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            {s.opened_count > 1 && <span className="text-purple-400">{s.opened_count}x aberto</span>}
                            {s.clicked_count > 0 && <span className="text-indigo-400">{s.clicked_count}x clicado</span>}
                          </div>
                        )}
                      </div>
                    </div>

                    {isCampaign && s.status === 'sending' && s.total_contacts > 0 && (
                      <div className="mt-4 pt-4 border-t border-white/10">
                        <div className="flex justify-between text-xs text-gray-400 mb-1">
                          <span>Progresso do envio</span>
                          <span>{Math.round((s.sent_count / s.total_contacts) * 100)}%</span>
                        </div>
                        <div className="w-full bg-white/10 rounded-full h-2">
                          <div
                            className="bg-gradient-to-r from-orange-500 to-yellow-500 h-2 rounded-full transition-all"
                            style={{ width: `${Math.min(100, Math.round((s.sent_count / s.total_contacts) * 100))}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal editar + reenviar envio único */}
      {editSend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => !resending && setEditSend(null)}>
          <div className="bg-dark-800 rounded-2xl border-2 border-orange-500/40 max-w-3xl w-full max-h-[92vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 z-10 flex items-center justify-between p-5 border-b border-white/10 bg-gradient-to-r from-orange-600/30 to-orange-500/10 backdrop-blur-xl">
              <h2 className="text-xl font-black text-white flex items-center gap-2"><FaRedo className="text-orange-400" /> Editar e Reenviar</h2>
              <button type="button" disabled={resending} onClick={() => setEditSend(null)} className="p-2 text-gray-400 hover:text-white"><FaTimes /></button>
            </div>

            <div className="p-6 space-y-5">
              {editSend.error_message && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-200 text-sm">
                  <strong>Último erro:</strong> {editSend.error_message}
                </div>
              )}

              <div>
                <label className={labelCls}>Domínio *</label>
                <select value={editForm.domain_id} onChange={e => setEditForm(f => ({ ...f, domain_id: e.target.value }))} className={inputCls}>
                  <option value="">Selecione...</option>
                  {domains.map(d => <option key={d.id} value={d.id}>{d.domain}</option>)}
                </select>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Nome remetente *</label>
                  <input value={editForm.from_name} onChange={e => setEditForm(f => ({ ...f, from_name: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Usuário remetente * (sem @)</label>
                  <div className="flex gap-2">
                    <input value={editForm.from_email} onChange={e => setEditForm(f => ({ ...f, from_email: extractLocalPart(e.target.value) }))} className={inputCls} />
                    {selectedDomain && <span className="px-3 flex items-center rounded-xl bg-dark-700 border border-white/15 text-white/70 text-sm whitespace-nowrap">@{selectedDomain}</span>}
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Nome destinatário</label>
                  <input value={editForm.to_name} onChange={e => setEditForm(f => ({ ...f, to_name: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>E-mail destinatário *</label>
                  <input value={editForm.to_email} onChange={e => setEditForm(f => ({ ...f, to_email: e.target.value }))} className={inputCls} />
                </div>
              </div>

              <div>
                <label className={labelCls}>Assunto *</label>
                <input value={editForm.subject} onChange={e => setEditForm(f => ({ ...f, subject: e.target.value }))} className={inputCls} />
              </div>

              <div>
                <label className={labelCls}>Corpo do e-mail *</label>
                <EmailBodyEditor
                  value={editForm.body_html}
                  onChange={html => setEditForm(f => ({ ...f, body_html: html }))}
                  accent="orange"
                  minHeight={240}
                />
                {!editForm.body_html && (
                  <p className="text-yellow-300 text-xs mt-2">Este envio antigo pode não ter o HTML salvo. Cole o conteúdo novamente antes de reenviar.</p>
                )}
              </div>
            </div>

            <div className="sticky bottom-0 p-5 border-t border-white/10 bg-dark-800 flex gap-3">
              <button type="button" disabled={resending} onClick={() => setEditSend(null)}
                className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold flex items-center justify-center gap-2">
                <FaTimes /> Cancelar
              </button>
              <button type="button" disabled={resending} onClick={handleResend}
                className="flex-1 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50">
                {resending ? <FaSpinner className="animate-spin" /> : <FaSave />}
                Salvar e Reenviar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
