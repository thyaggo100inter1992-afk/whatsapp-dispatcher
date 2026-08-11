import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { FaBullhorn, FaArrowLeft, FaPlus, FaPlay, FaPause, FaBan, FaTrash, FaChartBar, FaSpinner, FaRocket, FaCalendarAlt } from 'react-icons/fa';
import api from '@/services/api';
import { useNotification } from '@/hooks/useNotification';
import { useConfirm } from '@/hooks/useConfirm';

interface Campaign {
  id: number; name: string; subject: string; from_name: string; from_email: string;
  status: string; total_contacts: number; sent_count: number; failed_count: number;
  opened_count: number; domain_name: string; list_name: string; created_at: string;
  scheduled_at: string | null;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft:     { label: 'Rascunho',  color: 'bg-gray-500/20 text-gray-300 border-gray-500/40' },
  scheduled: { label: 'Agendada', color: 'bg-purple-500/20 text-purple-300 border-purple-500/40' },
  sending:   { label: 'Enviando', color: 'bg-blue-500/20 text-blue-300 border-blue-500/40' },
  paused:    { label: 'Pausada',  color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40' },
  completed: { label: 'Concluída',color: 'bg-green-500/20 text-green-300 border-green-500/40' },
  failed:    { label: 'Falhou',   color: 'bg-red-500/20 text-red-300 border-red-500/40' },
  cancelled: { label: 'Cancelada',color: 'bg-red-900/20 text-red-400 border-red-900/40' },
};

export default function Campanhas() {
  const router = useRouter();
  const notification = useNotification();
  const { confirm, ConfirmDialog } = useConfirm();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadCampaigns(); }, []);

  const loadCampaigns = async () => {
    try { const r = await api.get('/email-marketing/campaigns'); setCampaigns(r.data.data || []); }
    catch { } finally { setLoading(false); }
  };

  const handleStart = async (id: number) => {
    try { await api.post(`/email-marketing/campaigns/${id}/start`); notification.success('Campanha iniciada!', ''); loadCampaigns(); }
    catch (e: any) { notification.error('Erro', e.response?.data?.message || e.message); }
  };
  const handlePause = async (id: number) => {
    try { await api.post(`/email-marketing/campaigns/${id}/pause`); notification.success('Campanha pausada', ''); loadCampaigns(); }
    catch (e: any) { notification.error('Erro', e.response?.data?.message || e.message); }
  };
  const handleCancel = async (id: number, name: string) => {
    const ok = await confirm({ title: 'Cancelar campanha', message: `Cancelar "${name}"?`, confirmText: 'Sim, Cancelar', type: 'danger' });
    if (!ok) return;
    try { await api.post(`/email-marketing/campaigns/${id}/cancel`); notification.success('Cancelada', ''); loadCampaigns(); }
    catch (e: any) { notification.error('Erro', e.response?.data?.message || e.message); }
  };
  const handleDelete = async (id: number, name: string) => {
    const ok = await confirm({ title: 'Excluir campanha', message: `Excluir "${name}"?`, confirmText: 'Sim, Excluir', type: 'danger' });
    if (!ok) return;
    try { await api.delete(`/email-marketing/campaigns/${id}`); notification.success('Excluída', ''); loadCampaigns(); }
    catch (e: any) { notification.error('Erro', e.response?.data?.message || e.message); }
  };

  const total = campaigns.length;
  const sending = campaigns.filter(c => c.status === 'sending').length;
  const completed = campaigns.filter(c => c.status === 'completed').length;
  const scheduled = campaigns.filter(c => c.status === 'scheduled').length;

  return (
    <>
      <Head><title>Campanhas | E-mail Marketing</title></Head>
      <notification.NotificationContainer />
      <ConfirmDialog />
      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 py-8 px-4">
        <div className="max-w-7xl mx-auto space-y-8">

          {/* HEADER */}
          <div className="relative overflow-hidden bg-gradient-to-r from-orange-600/30 via-orange-500/20 to-orange-600/30 backdrop-blur-xl border-2 border-orange-500/40 rounded-3xl p-10 shadow-2xl shadow-orange-500/20">
            <div className="absolute inset-0 bg-grid-white/[0.02]"></div>
            <div className="relative">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-6">
                  <button onClick={() => router.push('/email-marketing')} className="p-3 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all">
                    <FaArrowLeft className="text-xl" />
                  </button>
                  <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-6 rounded-2xl shadow-lg shadow-orange-500/50">
                    <FaBullhorn className="text-5xl text-white" />
                  </div>
                  <div>
                    <h1 className="text-5xl font-black text-white mb-2 tracking-tight">Campanhas</h1>
                    <p className="text-xl text-white/80 font-medium">Gerencie e acompanhe suas campanhas de e-mail</p>
                  </div>
                </div>
                <button onClick={() => router.push('/email-marketing/campanhas/criar')}
                  className="px-8 py-4 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-2xl font-black text-lg transition-all flex items-center gap-3 shadow-xl shadow-orange-500/30 hover:scale-105">
                  <FaPlus /> Nova Campanha
                </button>
              </div>
              {/* Stats rápidas */}
              {total > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                  {[
                    { label: 'Total', value: total, color: 'text-orange-300' },
                    { label: 'Enviando', value: sending, color: 'text-blue-300' },
                    { label: 'Concluídas', value: completed, color: 'text-green-300' },
                    { label: 'Agendadas', value: scheduled, color: 'text-purple-300' },
                  ].map((s, i) => (
                    <div key={i} className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
                      <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                      <div className="text-sm text-white/70">{s.label}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* LISTA */}
          {loading ? (
            <div className="flex justify-center py-20"><FaSpinner className="text-5xl text-orange-400 animate-spin" /></div>
          ) : campaigns.length === 0 ? (
            <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-orange-500/20 rounded-2xl p-16 text-center">
              <div className="bg-orange-500/10 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
                <FaBullhorn className="text-5xl text-orange-400" />
              </div>
              <h3 className="text-2xl font-black text-white mb-3">Nenhuma campanha criada</h3>
              <p className="text-gray-400 mb-6">Crie sua primeira campanha de e-mail em massa</p>
              <button onClick={() => router.push('/email-marketing/campanhas/criar')}
                className="px-8 py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-2xl font-black text-lg inline-flex items-center gap-3 shadow-xl">
                <FaPlus /> Criar Primeira Campanha
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {campaigns.map(c => {
                const st = STATUS_LABELS[c.status] || STATUS_LABELS.draft;
                const progress = c.total_contacts > 0 ? Math.round(((c.sent_count + c.failed_count) / c.total_contacts) * 100) : 0;
                return (
                  <div key={c.id} className="bg-dark-800/60 backdrop-blur-xl border-2 border-orange-500/20 hover:border-orange-500/40 rounded-2xl p-6 shadow-xl transition-all duration-300">
                    <div className="flex items-start justify-between flex-wrap gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3 flex-wrap">
                          <h3 className="text-xl font-black text-white">{c.name}</h3>
                          <span className={`px-3 py-1 rounded-full text-xs font-bold border ${st.color}`}>{st.label}</span>
                          {c.scheduled_at && c.status === 'scheduled' && (
                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-500/10 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                              <FaCalendarAlt /> {new Date(c.scheduled_at).toLocaleString('pt-BR')}
                            </span>
                          )}
                        </div>
                        <p className="text-gray-400 text-sm mb-1">Assunto: <span className="text-gray-200">{c.subject}</span></p>
                        <p className="text-gray-400 text-sm mb-1">De: <span className="text-gray-200">{c.from_name} &lt;{c.from_email}&gt;</span></p>
                        {c.domain_name && <p className="text-gray-400 text-sm mb-1">Domínio: <span className="text-gray-200">{c.domain_name}</span></p>}
                        {c.list_name && <p className="text-gray-400 text-sm">Lista: <span className="text-gray-200">{c.list_name}</span></p>}
                      </div>

                      <div className="text-right">
                        <div className="grid grid-cols-3 gap-3 mb-3">
                          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-center">
                            <p className="text-blue-300 font-black text-lg">{c.sent_count}</p>
                            <p className="text-xs text-gray-500">Enviados</p>
                          </div>
                          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 text-center">
                            <p className="text-green-300 font-black text-lg">{c.opened_count}</p>
                            <p className="text-xs text-gray-500">Abertos</p>
                          </div>
                          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center">
                            <p className="text-red-300 font-black text-lg">{c.failed_count}</p>
                            <p className="text-xs text-gray-500">Falhos</p>
                          </div>
                        </div>
                        {c.total_contacts > 0 && (
                          <>
                            <div className="w-full bg-gray-700 rounded-full h-2 mb-1">
                              <div className="bg-gradient-to-r from-orange-500 to-yellow-500 h-2 rounded-full transition-all" style={{ width: `${progress}%` }}></div>
                            </div>
                            <p className="text-xs text-gray-500">{c.total_contacts.toLocaleString('pt-BR')} contatos • {progress}% processado</p>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-white/10">
                      {['draft', 'scheduled'].includes(c.status) && (
                        <button onClick={() => handleStart(c.id)} className="px-4 py-2.5 bg-green-500/20 hover:bg-green-500/30 text-green-300 border border-green-500/40 rounded-xl font-bold text-sm flex items-center gap-2 transition-all">
                          <FaPlay /> Iniciar
                        </button>
                      )}
                      {c.status === 'paused' && (
                        <button onClick={() => handleStart(c.id)} className="px-4 py-2.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/40 rounded-xl font-bold text-sm flex items-center gap-2 transition-all">
                          <FaPlay /> Retomar
                        </button>
                      )}
                      {c.status === 'sending' && (
                        <button onClick={() => handlePause(c.id)} className="px-4 py-2.5 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border border-yellow-500/40 rounded-xl font-bold text-sm flex items-center gap-2 transition-all">
                          <FaPause /> Pausar
                        </button>
                      )}
                      {['sending', 'paused', 'draft', 'scheduled'].includes(c.status) && (
                        <button onClick={() => handleCancel(c.id, c.name)} className="px-4 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 rounded-xl font-bold text-sm flex items-center gap-2 transition-all">
                          <FaBan /> Cancelar
                        </button>
                      )}
                      <button onClick={() => router.push(`/email-marketing/campanhas/${c.id}`)}
                        className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl font-bold text-sm flex items-center gap-2 transition-all">
                        <FaChartBar /> Relatório
                      </button>
                      {['draft', 'cancelled', 'completed'].includes(c.status) && (
                        <button onClick={() => handleDelete(c.id, c.name)} className="px-4 py-2.5 bg-red-900/20 hover:bg-red-900/30 text-red-400 border border-red-900/40 rounded-xl font-bold text-sm flex items-center gap-2 transition-all">
                          <FaTrash /> Excluir
                        </button>
                      )}
                    </div>
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
