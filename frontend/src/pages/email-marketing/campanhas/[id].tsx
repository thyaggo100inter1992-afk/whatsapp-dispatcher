import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { FaChartBar, FaArrowLeft, FaSpinner, FaEnvelope, FaEye, FaMousePointer, FaTimesCircle, FaExclamationCircle } from 'react-icons/fa';
import api from '@/services/api';

interface CampaignStats {
  total_contacts: number; sent_count: number; failed_count: number;
  opened_count: number; clicked_count: number; bounced_count: number;
  complained_count: number; status: string; started_at: string; completed_at: string;
}

interface Campaign {
  id: number; name: string; subject: string; from_name: string; from_email: string;
  status: string; domain_name: string; list_name: string;
}

export default function CampaignDetail() {
  const router = useRouter();
  const { id } = router.query;
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.get(`/email-marketing/campaigns/${id}`),
      api.get(`/email-marketing/campaigns/${id}/stats`),
    ]).then(([c, s]) => {
      setCampaign(c.data.data);
      setStats(s.data.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    draft: { label: 'Rascunho', color: 'text-gray-300' },
    sending: { label: '🔄 Enviando', color: 'text-blue-300' },
    paused: { label: '⏸ Pausada', color: 'text-yellow-300' },
    completed: { label: '✅ Concluída', color: 'text-green-300' },
    failed: { label: '❌ Falhou', color: 'text-red-300' },
    cancelled: { label: '🚫 Cancelada', color: 'text-red-400' },
  };

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 flex items-center justify-center">
      <FaSpinner className="text-4xl text-orange-400 animate-spin" />
    </div>
  );

  if (!campaign || !stats) return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 flex items-center justify-center">
      <p className="text-gray-400">Campanha não encontrada</p>
    </div>
  );

  const progress = stats.total_contacts > 0 ? Math.round(((stats.sent_count + stats.failed_count) / stats.total_contacts) * 100) : 0;
  const openRate = stats.sent_count > 0 ? ((stats.opened_count / stats.sent_count) * 100).toFixed(1) : '0.0';
  const clickRate = stats.sent_count > 0 ? ((stats.clicked_count / stats.sent_count) * 100).toFixed(1) : '0.0';
  const st = STATUS_LABELS[campaign.status] || STATUS_LABELS.draft;

  return (
    <>
      <Head><title>{campaign.name} | E-mail Marketing</title></Head>
      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 py-12 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <button onClick={() => router.push('/email-marketing/campanhas')} className="p-3 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all">
              <FaArrowLeft />
            </button>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-black text-white">{campaign.name}</h1>
                <span className={`font-bold ${st.color}`}>{st.label}</span>
              </div>
              <p className="text-gray-400">Assunto: {campaign.subject}</p>
            </div>
          </div>

          {/* Progresso */}
          <div className="bg-white/5 rounded-2xl p-6 border border-white/10 mb-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-white font-bold">Progresso do Envio</span>
              <span className="text-white font-black">{progress}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-500 to-blue-400 h-4 rounded-full transition-all" style={{ width: `${progress}%` }}></div>
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-2">
              <span>{stats.sent_count + stats.failed_count} processados</span>
              <span>{stats.total_contacts} total</span>
            </div>
          </div>

          {/* Métricas */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Enviados', value: stats.sent_count, icon: <FaEnvelope className="text-blue-400" />, sub: `de ${stats.total_contacts}` },
              { label: 'Abertos', value: stats.opened_count, icon: <FaEye className="text-green-400" />, sub: `${openRate}% taxa` },
              { label: 'Cliques', value: stats.clicked_count, icon: <FaMousePointer className="text-purple-400" />, sub: `${clickRate}% taxa` },
              { label: 'Falhos', value: stats.failed_count + stats.bounced_count + stats.complained_count, icon: <FaTimesCircle className="text-red-400" />, sub: 'falhos+bounced' },
            ].map((m, i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-2 text-xl">{m.icon}</div>
                <p className="text-3xl font-black text-white">{m.value}</p>
                <p className="text-gray-400 text-sm font-bold mt-1">{m.label}</p>
                <p className="text-gray-600 text-xs">{m.sub}</p>
              </div>
            ))}
          </div>

          {/* Informações */}
          <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
            <h3 className="text-lg font-black text-white mb-4">Detalhes da Campanha</h3>
            <div className="grid md:grid-cols-2 gap-3 text-sm">
              <p className="text-gray-400">Remetente: <span className="text-gray-200">{campaign.from_name} &lt;{campaign.from_email}&gt;</span></p>
              {campaign.domain_name && <p className="text-gray-400">Domínio: <span className="text-gray-200">{campaign.domain_name}</span></p>}
              {campaign.list_name && <p className="text-gray-400">Lista: <span className="text-gray-200">{campaign.list_name}</span></p>}
              {stats.started_at && <p className="text-gray-400">Iniciado em: <span className="text-gray-200">{new Date(stats.started_at).toLocaleString('pt-BR')}</span></p>}
              {stats.completed_at && <p className="text-gray-400">Concluído em: <span className="text-gray-200">{new Date(stats.completed_at).toLocaleString('pt-BR')}</span></p>}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
