import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { FaBullhorn, FaArrowLeft, FaPlus, FaPlay, FaPause, FaBan, FaTrash, FaChartBar, FaSpinner } from 'react-icons/fa';
import api from '@/services/api';
import { useNotification } from '@/hooks/useNotification';
import { useConfirm } from '@/hooks/useConfirm';

interface Campaign {
  id: number; name: string; subject: string; from_name: string; from_email: string;
  status: string; total_contacts: number; sent_count: number; failed_count: number;
  opened_count: number; domain_name: string; list_name: string; created_at: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: 'Rascunho', color: 'bg-gray-500/20 text-gray-300 border-gray-500/40' },
  sending: { label: 'Enviando', color: 'bg-blue-500/20 text-blue-300 border-blue-500/40' },
  paused: { label: 'Pausada', color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40' },
  completed: { label: 'Concluída', color: 'bg-green-500/20 text-green-300 border-green-500/40' },
  failed: { label: 'Falhou', color: 'bg-red-500/20 text-red-300 border-red-500/40' },
  cancelled: { label: 'Cancelada', color: 'bg-red-900/20 text-red-400 border-red-900/40' },
};

export default function Campanhas() {
  const router = useRouter();
  const notification = useNotification();
  const { confirm, ConfirmDialog } = useConfirm();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadCampaigns(); }, []);

  const loadCampaigns = async () => {
    try {
      const r = await api.get('/email-marketing/campaigns');
      setCampaigns(r.data.data || []);
    } catch { } finally { setLoading(false); }
  };

  const handleStart = async (id: number) => {
    try {
      await api.post(`/email-marketing/campaigns/${id}/start`);
      notification.success('Campanha iniciada!', '');
      loadCampaigns();
    } catch (error: any) {
      notification.error('Erro', error.response?.data?.message || error.message);
    }
  };

  const handlePause = async (id: number) => {
    try {
      await api.post(`/email-marketing/campaigns/${id}/pause`);
      notification.success('Campanha pausada', '');
      loadCampaigns();
    } catch (error: any) {
      notification.error('Erro', error.response?.data?.message || error.message);
    }
  };

  const handleCancel = async (id: number, name: string) => {
    const ok = await confirm({ title: 'Cancelar campanha', message: `Deseja cancelar a campanha "${name}"?`, confirmText: 'Sim, Cancelar', type: 'danger' });
    if (!ok) return;
    try {
      await api.post(`/email-marketing/campaigns/${id}/cancel`);
      notification.success('Campanha cancelada', '');
      loadCampaigns();
    } catch (error: any) {
      notification.error('Erro', error.response?.data?.message || error.message);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    const ok = await confirm({ title: 'Excluir campanha', message: `Deseja excluir a campanha "${name}"?`, confirmText: 'Sim, Excluir', type: 'danger' });
    if (!ok) return;
    try {
      await api.delete(`/email-marketing/campaigns/${id}`);
      notification.success('Campanha excluída', '');
      loadCampaigns();
    } catch (error: any) {
      notification.error('Erro', error.response?.data?.message || error.message);
    }
  };

  return (
    <>
      <Head><title>Campanhas | E-mail Marketing</title></Head>
      <notification.NotificationContainer />
      <ConfirmDialog />
      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <button onClick={() => router.push('/email-marketing')} className="p-3 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all">
                <FaArrowLeft />
              </button>
              <div>
                <h1 className="text-3xl font-black text-white flex items-center gap-3"><FaBullhorn className="text-orange-400" /> Campanhas</h1>
                <p className="text-gray-400">{campaigns.length} campanha(s) no total</p>
              </div>
            </div>
            <button
              onClick={() => router.push('/email-marketing/campanhas/criar')}
              className="px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl font-bold transition-all flex items-center gap-2"
            >
              <FaPlus /> Nova Campanha
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-20"><FaSpinner className="text-4xl text-orange-400 animate-spin" /></div>
          ) : campaigns.length === 0 ? (
            <div className="bg-white/5 rounded-2xl p-12 text-center border border-white/10">
              <FaBullhorn className="text-6xl text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 text-lg">Nenhuma campanha criada ainda</p>
              <button
                onClick={() => router.push('/email-marketing/campanhas/criar')}
                className="mt-4 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold"
              >
                Criar Primeira Campanha
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {campaigns.map(c => {
                const st = STATUS_LABELS[c.status] || STATUS_LABELS.draft;
                const progress = c.total_contacts > 0 ? Math.round(((c.sent_count + c.failed_count) / c.total_contacts) * 100) : 0;
                return (
                  <div key={c.id} className="bg-gradient-to-br from-white/10 to-white/5 rounded-2xl p-6 border border-white/10">
                    <div className="flex items-start justify-between flex-wrap gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <h3 className="text-xl font-black text-white">{c.name}</h3>
                          <span className={`px-3 py-1 rounded-full text-xs font-bold border ${st.color}`}>{st.label}</span>
                        </div>
                        <p className="text-gray-400 text-sm mb-1">Assunto: <span className="text-gray-300">{c.subject}</span></p>
                        <p className="text-gray-400 text-sm mb-1">De: <span className="text-gray-300">{c.from_name} &lt;{c.from_email}&gt;</span></p>
                        {c.domain_name && <p className="text-gray-400 text-sm mb-1">Domínio: <span className="text-gray-300">{c.domain_name}</span></p>}
                        {c.list_name && <p className="text-gray-400 text-sm">Lista: <span className="text-gray-300">{c.list_name}</span></p>}
                      </div>

                      <div className="text-right">
                        <div className="grid grid-cols-3 gap-3 text-center mb-3">
                          <div className="bg-black/20 rounded-lg p-2">
                            <p className="text-blue-300 font-black">{c.sent_count}</p>
                            <p className="text-xs text-gray-500">Enviados</p>
                          </div>
                          <div className="bg-black/20 rounded-lg p-2">
                            <p className="text-green-300 font-black">{c.opened_count}</p>
                            <p className="text-xs text-gray-500">Abertos</p>
                          </div>
                          <div className="bg-black/20 rounded-lg p-2">
                            <p className="text-red-300 font-black">{c.failed_count}</p>
                            <p className="text-xs text-gray-500">Falhos</p>
                          </div>
                        </div>
                        {c.total_contacts > 0 && (
                          <div className="w-full bg-gray-700 rounded-full h-2 mb-1">
                            <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${progress}%` }}></div>
                          </div>
                        )}
                        <p className="text-xs text-gray-500">{c.total_contacts} contatos • {progress}% processado</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mt-4">
                      {c.status === 'draft' && (
                        <button onClick={() => handleStart(c.id)} className="px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-300 border border-green-500/40 rounded-lg font-bold text-sm flex items-center gap-2">
                          <FaPlay /> Iniciar
                        </button>
                      )}
                      {c.status === 'paused' && (
                        <button onClick={() => handleStart(c.id)} className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/40 rounded-lg font-bold text-sm flex items-center gap-2">
                          <FaPlay /> Retomar
                        </button>
                      )}
                      {c.status === 'sending' && (
                        <button onClick={() => handlePause(c.id)} className="px-4 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border border-yellow-500/40 rounded-lg font-bold text-sm flex items-center gap-2">
                          <FaPause /> Pausar
                        </button>
                      )}
                      {['sending', 'paused', 'draft'].includes(c.status) && (
                        <button onClick={() => handleCancel(c.id, c.name)} className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 rounded-lg font-bold text-sm flex items-center gap-2">
                          <FaBan /> Cancelar
                        </button>
                      )}
                      <button
                        onClick={() => router.push(`/email-marketing/campanhas/${c.id}`)}
                        className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-lg font-bold text-sm flex items-center gap-2"
                      >
                        <FaChartBar /> Relatório
                      </button>
                      {['draft', 'cancelled', 'completed'].includes(c.status) && (
                        <button onClick={() => handleDelete(c.id, c.name)} className="px-4 py-2 bg-red-900/20 hover:bg-red-900/30 text-red-400 border border-red-900/40 rounded-lg font-bold text-sm flex items-center gap-2">
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
