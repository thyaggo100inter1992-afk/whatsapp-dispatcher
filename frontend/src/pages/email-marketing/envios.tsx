import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import {
  FaEnvelope, FaBullhorn, FaPaperPlane, FaSignOutAlt, FaSync,
  FaCheckCircle, FaTimesCircle, FaEye, FaMousePointer,
  FaExclamationTriangle, FaUser, FaClock, FaSearch, FaFilter
} from 'react-icons/fa';
import api from '@/services/api';

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
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: JSX.Element }> = {
  draft:     { label: 'Rascunho',    color: 'text-gray-400 bg-gray-500/10 border-gray-500/30',   icon: <FaClock /> },
  sending:   { label: 'Enviando',    color: 'text-blue-300 bg-blue-500/10 border-blue-500/30',   icon: <FaSync className="animate-spin" /> },
  completed: { label: 'Concluído',   color: 'text-green-300 bg-green-500/10 border-green-500/30', icon: <FaCheckCircle /> },
  sent:      { label: 'Enviado',     color: 'text-green-300 bg-green-500/10 border-green-500/30', icon: <FaCheckCircle /> },
  paused:    { label: 'Pausado',     color: 'text-yellow-300 bg-yellow-500/10 border-yellow-500/30', icon: <FaClock /> },
  failed:    { label: 'Falhou',      color: 'text-red-300 bg-red-500/10 border-red-500/30',      icon: <FaTimesCircle /> },
  cancelled: { label: 'Cancelado',   color: 'text-red-300 bg-red-500/10 border-red-500/30',      icon: <FaTimesCircle /> },
  opened:    { label: 'Aberto',      color: 'text-purple-300 bg-purple-500/10 border-purple-500/30', icon: <FaEye /> },
  clicked:   { label: 'Clicado',     color: 'text-indigo-300 bg-indigo-500/10 border-indigo-500/30', icon: <FaMousePointer /> },
  bounced:   { label: 'Rejeitado',   color: 'text-orange-300 bg-orange-500/10 border-orange-500/30', icon: <FaExclamationTriangle /> },
  complained:{ label: 'Spam',        color: 'text-red-300 bg-red-500/10 border-red-500/30',      icon: <FaTimesCircle /> },
};

function formatDateTime(date: string | null) {
  if (!date) return '—';
  return new Date(date).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function pct(num: number, total: number) {
  if (!total) return '0%';
  return `${Math.round((num / total) * 100)}%`;
}

export default function Envios() {
  const router = useRouter();
  const [sends, setSends] = useState<Send[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'campaign' | 'single'>('all');

  useEffect(() => { loadSends(); }, []);

  const loadSends = async () => {
    setLoading(true);
    try {
      const r = await api.get('/email-marketing/sends?limit=200');
      setSends(r.data.data || []);
    } catch { } finally { setLoading(false); }
  };

  const filtered = sends.filter(s => {
    if (filterType !== 'all' && s.type !== filterType) return false;
    if (search) {
      const q = search.toLowerCase();
      return (s.subject || '').toLowerCase().includes(q) ||
             (s.from_email || '').toLowerCase().includes(q) ||
             (s.to_email || '').toLowerCase().includes(q) ||
             (s.user_name || '').toLowerCase().includes(q) ||
             (s.title || '').toLowerCase().includes(q);
    }
    return true;
  });

  const totalEnvios = sends.length;
  const totalCampanhas = sends.filter(s => s.type === 'campaign').length;
  const totalUnicos = sends.filter(s => s.type === 'single').length;
  const totalAbertos = sends.reduce((acc, s) => acc + (s.opened_count || 0), 0);

  return (
    <>
      <Head><title>Histórico de Envios | E-mail Marketing</title></Head>
      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 py-10 px-4">
        <div className="max-w-7xl mx-auto">

          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <button onClick={() => router.push('/email-marketing')}
              className="p-3 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all">
              <FaSignOutAlt className="rotate-180" />
            </button>
            <div>
              <h1 className="text-2xl font-black text-white flex items-center gap-3">
                <FaEnvelope className="text-red-400" /> Histórico de Envios
              </h1>
              <p className="text-gray-400 text-sm">Todos os e-mails enviados — campanhas e envios únicos</p>
            </div>
            <button onClick={loadSends} className="ml-auto p-3 bg-white/10 hover:bg-white/20 rounded-xl text-white" title="Atualizar">
              <FaSync className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          {/* Stats topo */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Total de Envios', value: totalEnvios, icon: <FaEnvelope className="text-blue-400" />, color: 'border-blue-500/20' },
              { label: 'Campanhas', value: totalCampanhas, icon: <FaBullhorn className="text-orange-400" />, color: 'border-orange-500/20' },
              { label: 'Envios Únicos', value: totalUnicos, icon: <FaPaperPlane className="text-green-400" />, color: 'border-green-500/20' },
              { label: 'Total Abertos', value: totalAbertos, icon: <FaEye className="text-purple-400" />, color: 'border-purple-500/20' },
            ].map((s, i) => (
              <div key={i} className={`bg-white/5 border ${s.color} rounded-2xl p-5 flex items-center gap-4`}>
                <div className="text-2xl">{s.icon}</div>
                <div>
                  <p className="text-2xl font-black text-white">{s.value}</p>
                  <p className="text-gray-400 text-xs">{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap gap-3 mb-6">
            <div className="flex-1 min-w-[200px] relative">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm" />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por assunto, e-mail, atendente..."
                className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:border-white/30"
              />
            </div>
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3">
              <FaFilter className="text-gray-500 text-sm" />
              {(['all', 'campaign', 'single'] as const).map(t => (
                <button key={t} onClick={() => setFilterType(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterType === t ? 'bg-white/20 text-white' : 'text-gray-400 hover:text-white'}`}>
                  {t === 'all' ? 'Todos' : t === 'campaign' ? '📢 Campanhas' : '✉️ Únicos'}
                </button>
              ))}
            </div>
          </div>

          {/* Lista */}
          {loading ? (
            <div className="text-center py-20 text-gray-400">
              <FaSync className="animate-spin text-4xl mx-auto mb-4" />
              <p>Carregando envios...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 bg-white/5 rounded-2xl border border-white/10">
              <FaEnvelope className="text-5xl text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 font-bold text-lg">Nenhum envio encontrado</p>
              <p className="text-gray-500 text-sm mt-1">Os envios aparecerão aqui depois que você enviar campanhas ou e-mails únicos.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(s => {
                const st = STATUS_CONFIG[s.status] || STATUS_CONFIG['sent'];
                const isCampaign = s.type === 'campaign';

                return (
                  <div key={`${s.type}-${s.id}`}
                    className={`bg-gradient-to-br rounded-2xl p-5 border transition-all hover:border-white/20 cursor-pointer
                      ${isCampaign
                        ? 'from-orange-500/5 to-transparent border-orange-500/20'
                        : 'from-blue-500/5 to-transparent border-blue-500/20'}`}
                    onClick={() => isCampaign && router.push(`/email-marketing/campanhas/${s.id}`)}>

                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      {/* Esquerda: tipo + assunto + remetente */}
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className={`p-2.5 rounded-xl flex-shrink-0 ${isCampaign ? 'bg-orange-500/20' : 'bg-blue-500/20'}`}>
                          {isCampaign
                            ? <FaBullhorn className="text-orange-300 text-lg" />
                            : <FaPaperPlane className="text-blue-300 text-lg" />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${isCampaign ? 'text-orange-300 bg-orange-500/10 border-orange-500/30' : 'text-blue-300 bg-blue-500/10 border-blue-500/30'}`}>
                              {isCampaign ? '📢 Em Massa' : '✉️ Envio Único'}
                            </span>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${st.color}`}>
                              {st.icon} {st.label}
                            </span>
                          </div>
                          <p className="text-white font-bold truncate">{s.subject}</p>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            <span className="text-gray-400 text-xs flex items-center gap-1">
                              <FaEnvelope className="text-xs" /> {s.from_name ? `${s.from_name} <${s.from_email}>` : s.from_email}
                            </span>
                            {!isCampaign && s.to_email && (
                              <span className="text-gray-400 text-xs">→ {s.to_name ? `${s.to_name} <${s.to_email}>` : s.to_email}</span>
                            )}
                            {s.user_name && (
                              <span className="text-gray-400 text-xs flex items-center gap-1">
                                <FaUser className="text-xs" /> {s.user_name}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Direita: stats + data */}
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <span className="text-gray-500 text-xs flex items-center gap-1">
                          <FaClock className="text-xs" /> {formatDateTime(s.sent_at || s.created_at)}
                        </span>

                        {/* Métricas */}
                        <div className="flex items-center gap-3">
                          {isCampaign && (
                            <div className="text-center">
                              <p className="text-white font-bold text-sm">{s.sent_count}/{s.total_contacts}</p>
                              <p className="text-gray-500 text-xs">Enviados</p>
                            </div>
                          )}
                          {s.opened_count > 0 && (
                            <div className="text-center">
                              <p className="text-purple-300 font-bold text-sm flex items-center gap-1">
                                <FaEye className="text-xs" /> {s.opened_count}
                                {isCampaign && <span className="text-gray-500 font-normal text-xs">({pct(s.opened_count, s.sent_count)})</span>}
                              </p>
                              <p className="text-gray-500 text-xs">Abertos</p>
                            </div>
                          )}
                          {s.clicked_count > 0 && (
                            <div className="text-center">
                              <p className="text-indigo-300 font-bold text-sm flex items-center gap-1">
                                <FaMousePointer className="text-xs" /> {s.clicked_count}
                              </p>
                              <p className="text-gray-500 text-xs">Cliques</p>
                            </div>
                          )}
                          {s.bounced_count > 0 && (
                            <div className="text-center">
                              <p className="text-orange-300 font-bold text-sm">{s.bounced_count}</p>
                              <p className="text-gray-500 text-xs">Rejeit.</p>
                            </div>
                          )}
                          {s.failed_count > 0 && (
                            <div className="text-center">
                              <p className="text-red-300 font-bold text-sm">{s.failed_count}</p>
                              <p className="text-gray-500 text-xs">Falhou</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Barra de progresso para campanhas em envio */}
                    {isCampaign && s.status === 'sending' && s.total_contacts > 0 && (
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-gray-400 mb-1">
                          <span>Progresso do envio</span>
                          <span>{Math.round((s.sent_count / s.total_contacts) * 100)}%</span>
                        </div>
                        <div className="w-full bg-white/10 rounded-full h-1.5">
                          <div
                            className="bg-gradient-to-r from-orange-500 to-yellow-500 h-1.5 rounded-full transition-all"
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
    </>
  );
}
