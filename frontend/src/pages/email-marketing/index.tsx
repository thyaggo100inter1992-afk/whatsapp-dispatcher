import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import {
  FaEnvelope, FaPaperPlane, FaRocket, FaSync, FaBullhorn, FaList,
  FaFileAlt, FaGlobe, FaHistory, FaExclamationTriangle, FaChartPie, FaBan,
  FaInbox, FaAt,
} from 'react-icons/fa';
import ProtectedRoute from '@/components/ProtectedRoute';
import api from '@/services/api';

interface Stats {
  total_campaigns: number;
  active_campaigns: number;
  total_lists: number;
  total_contacts: number;
  total_templates: number;
  total_domains: number;
  active_domains: number;
  total_sends: number;
}

export default function EmailMarketingDashboard() {
  const router = useRouter();
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [stats, setStats] = useState<Stats>({
    total_campaigns: 0, active_campaigns: 0, total_lists: 0,
    total_contacts: 0, total_templates: 0, total_domains: 0, active_domains: 0, total_sends: 0,
  });
  const [loading, setLoading] = useState(true);

  const loadStats = async () => {
    try {
      const safeGet = async (url: string) => {
        try { return await api.get(url); } catch { return { data: { data: [], total: 0 } }; }
      };

      const [campaigns, lists, templates, domains, sends] = await Promise.all([
        safeGet('/email-marketing/campaigns'),
        safeGet('/email-marketing/lists'),
        safeGet('/email-marketing/templates'),
        safeGet('/email-marketing/domains'),
        safeGet('/email-marketing/sends?limit=1'),
      ]);
      const campaignData = campaigns.data.data || [];
      const listData = lists.data.data || [];
      const domainData = domains.data.data || [];
      const totalContacts = listData.reduce((acc: number, l: any) => acc + (l.total_contacts || 0), 0);

      setStats({
        total_campaigns: campaignData.length,
        active_campaigns: campaignData.filter((c: any) => c.status === 'sending').length,
        total_lists: listData.length,
        total_contacts: totalContacts,
        total_templates: (templates.data.data || []).length,
        total_domains: domainData.length,
        active_domains: domainData.filter((d: any) => d.status === 'active').length,
        total_sends: sends.data.total || 0,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(loadStats, 15000);
    return () => clearInterval(t);
  }, [autoRefresh]);

  return (
    <>
      <Head>
        <title>E-mail Marketing | Disparador NettSistemas</title>
      </Head>

      <ProtectedRoute requiredPermission="email_marketing" fallbackPath="/">
        <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 py-8 px-4">
          <div className="max-w-7xl mx-auto space-y-8">

            {/* HERO — mesmo padrão do menu WhatsApp API Oficial */}
            <div className="relative overflow-hidden bg-gradient-to-r from-orange-600/30 via-red-500/20 to-orange-600/30 backdrop-blur-xl border-2 border-orange-500/40 rounded-3xl p-10 shadow-2xl shadow-orange-500/20">
              <div className="absolute inset-0 bg-grid-white/[0.02]"></div>
              <div className="absolute top-0 right-0 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl"></div>
              <div className="absolute bottom-0 left-0 w-96 h-96 bg-red-500/10 rounded-full blur-3xl"></div>

              <div className="relative flex items-center justify-between gap-6 flex-wrap">
                <div className="flex items-center gap-6">
                  <div className="bg-gradient-to-br from-orange-500 to-red-600 p-6 rounded-2xl shadow-lg shadow-orange-500/50">
                    <FaEnvelope className="text-6xl text-white" />
                  </div>
                  <div>
                    <h1 className="text-5xl md:text-6xl font-black text-white mb-2 tracking-tight">
                      E-mail Marketing
                    </h1>
                    <p className="text-xl md:text-2xl text-white/80 font-medium">
                      Gerencie suas campanhas de e-mail com facilidade
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  className={`flex items-center gap-3 px-6 py-4 rounded-xl text-lg font-bold transition-all duration-200 ${
                    autoRefresh
                      ? 'bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/40'
                      : 'bg-white/10 hover:bg-white/20 text-white/80 border-2 border-white/20'
                  }`}
                >
                  <FaSync className={`text-xl ${autoRefresh ? 'animate-spin' : ''}`} />
                  {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
                </button>
              </div>
            </div>

            {/* Aviso domínio */}
            {!loading && stats.active_domains === 0 && (
              <div className="bg-yellow-500/10 border-2 border-yellow-500/40 rounded-2xl p-5 flex items-start gap-4">
                <FaExclamationTriangle className="text-yellow-400 text-2xl mt-1 flex-shrink-0" />
                <div>
                  <p className="text-yellow-300 font-bold">Nenhum domínio ativo</p>
                  <p className="text-gray-400 text-sm">Para enviar e-mails, cadastre e verifique pelo menos um domínio de envio.</p>
                  <button
                    onClick={() => router.push('/email-marketing/dominios')}
                    className="mt-2 text-yellow-300 underline text-sm font-bold"
                  >
                    Configurar domínio agora →
                  </button>
                </div>
              </div>
            )}

            {/* 3 CARDS PRINCIPAIS */}
            <div className="grid md:grid-cols-3 gap-6">

              <button
                onClick={() => router.push('/email-marketing/campanhas/criar')}
                className="group relative overflow-hidden bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 rounded-3xl p-8 text-left transition-all duration-300 hover:scale-105 hover:shadow-2xl shadow-lg shadow-emerald-500/30"
              >
                <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl"></div>
                <div className="relative">
                  <div className="bg-white/20 backdrop-blur-sm p-5 rounded-2xl group-hover:bg-white/30 transition-all duration-300 w-fit mb-6">
                    <FaRocket className="text-5xl text-white" />
                  </div>
                  <h2 className="text-3xl font-black text-white mb-3">Criar Campanha</h2>
                  <p className="text-white/90 text-lg mb-6 leading-relaxed">
                    Crie campanhas programadas para envio em massa
                  </p>
                  <div className="flex items-center gap-3 text-white text-lg font-bold">
                    Acessar agora
                    <FaRocket className="text-base group-hover:translate-x-2 transition-transform duration-200" />
                  </div>
                </div>
              </button>

              <button
                onClick={() => router.push('/email-marketing/envio-unico')}
                className="group relative overflow-hidden bg-gradient-to-br from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 rounded-3xl p-8 text-left transition-all duration-300 hover:scale-105 hover:shadow-2xl shadow-lg shadow-blue-500/30"
              >
                <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl"></div>
                <div className="relative">
                  <div className="bg-white/20 backdrop-blur-sm p-5 rounded-2xl group-hover:bg-white/30 transition-all duration-300 w-fit mb-6">
                    <FaPaperPlane className="text-5xl text-white" />
                  </div>
                  <h2 className="text-3xl font-black text-white mb-3">Envio Único</h2>
                  <p className="text-white/90 text-lg mb-6 leading-relaxed">
                    Envie um e-mail avulso para um destinatário
                  </p>
                  <div className="flex items-center gap-3 text-white text-lg font-bold">
                    Acessar agora
                    <FaRocket className="text-base group-hover:translate-x-2 transition-transform duration-200" />
                  </div>
                </div>
              </button>

              <button
                onClick={() => router.push('/email-marketing/campanhas')}
                className="group relative overflow-hidden bg-gradient-to-br from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 rounded-3xl p-8 text-left transition-all duration-300 hover:scale-105 hover:shadow-2xl shadow-lg shadow-purple-500/30"
              >
                <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl"></div>
                <div className="relative">
                  <div className="bg-white/20 backdrop-blur-sm p-5 rounded-2xl group-hover:bg-white/30 transition-all duration-300 w-fit mb-6">
                    <FaChartPie className="text-5xl text-white" />
                  </div>
                  <h2 className="text-3xl font-black text-white mb-3">Campanhas</h2>
                  <p className="text-white/90 text-lg mb-6 leading-relaxed">
                    Acompanhe status, aberturas, cliques e respostas
                  </p>
                  <div className="flex items-center gap-3 text-white text-lg font-bold">
                    Visualizar
                    <FaRocket className="text-base group-hover:translate-x-2 transition-transform duration-200" />
                  </div>
                </div>
              </button>
            </div>

            {/* Atalhos */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">

              <button
                onClick={() => router.push('/email-marketing/campanhas')}
                className="group relative overflow-hidden bg-gradient-to-br from-blue-500/20 to-blue-600/10 hover:from-blue-500/30 hover:to-blue-600/20 border-2 border-blue-500/40 hover:border-blue-500/60 rounded-2xl p-6 text-left transition-all duration-300 hover:scale-105 shadow-lg"
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="bg-blue-500/20 p-4 rounded-xl">
                    <FaBullhorn className="text-4xl text-blue-300" />
                  </div>
                  <h3 className="text-lg font-bold text-white text-center">Campanhas</h3>
                  <p className="text-sm text-white/70 text-center">
                    {loading ? '…' : `${stats.total_campaigns} campanha(s)`}
                  </p>
                </div>
              </button>

              <button
                onClick={() => router.push('/email-marketing/envio-unico')}
                className="group relative overflow-hidden bg-gradient-to-br from-green-500/20 to-green-600/10 hover:from-green-500/30 hover:to-green-600/20 border-2 border-green-500/40 hover:border-green-500/60 rounded-2xl p-6 text-left transition-all duration-300 hover:scale-105 shadow-lg"
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="bg-green-500/20 p-4 rounded-xl">
                    <FaPaperPlane className="text-4xl text-green-300" />
                  </div>
                  <h3 className="text-lg font-bold text-white text-center">Envio Único</h3>
                  <p className="text-sm text-white/70 text-center">E-mail avulso</p>
                </div>
              </button>

              <button
                onClick={() => router.push('/email-marketing/criar-email')}
                className="group relative overflow-hidden bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 hover:from-cyan-500/30 hover:to-cyan-600/20 border-2 border-cyan-500/40 hover:border-cyan-500/60 rounded-2xl p-6 text-left transition-all duration-300 hover:scale-105 shadow-lg"
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="bg-cyan-500/20 p-4 rounded-xl">
                    <FaAt className="text-4xl text-cyan-300" />
                  </div>
                  <h3 className="text-lg font-bold text-white text-center">Criar E-mail</h3>
                  <p className="text-sm text-white/70 text-center">Caixa no domínio</p>
                </div>
              </button>

              <button
                onClick={() => router.push('/email-marketing/caixa-entrada')}
                className="group relative overflow-hidden bg-gradient-to-br from-indigo-500/20 to-indigo-600/10 hover:from-indigo-500/30 hover:to-indigo-600/20 border-2 border-indigo-500/40 hover:border-indigo-500/60 rounded-2xl p-6 text-left transition-all duration-300 hover:scale-105 shadow-lg"
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="bg-indigo-500/20 p-4 rounded-xl">
                    <FaInbox className="text-4xl text-indigo-300" />
                  </div>
                  <h3 className="text-lg font-bold text-white text-center">Caixa de Entrada</h3>
                  <p className="text-sm text-white/70 text-center">Receber e responder</p>
                </div>
              </button>

              <button
                onClick={() => router.push('/email-marketing/listas')}
                className="group relative overflow-hidden bg-gradient-to-br from-teal-500/20 to-teal-600/10 hover:from-teal-500/30 hover:to-teal-600/20 border-2 border-teal-500/40 hover:border-teal-500/60 rounded-2xl p-6 text-left transition-all duration-300 hover:scale-105 shadow-lg"
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="bg-teal-500/20 p-4 rounded-xl">
                    <FaList className="text-4xl text-teal-300" />
                  </div>
                  <h3 className="text-lg font-bold text-white text-center">Listas</h3>
                  <p className="text-sm text-white/70 text-center">
                    {loading ? '…' : `${stats.total_contacts.toLocaleString('pt-BR')} contatos`}
                  </p>
                </div>
              </button>

              <button
                onClick={() => router.push('/email-marketing/listas-restricao')}
                className="group relative overflow-hidden bg-gradient-to-br from-rose-500/20 to-rose-600/10 hover:from-rose-500/30 hover:to-rose-600/20 border-2 border-rose-500/40 hover:border-rose-500/60 rounded-2xl p-6 text-left transition-all duration-300 hover:scale-105 shadow-lg"
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="bg-rose-500/20 p-4 rounded-xl">
                    <FaBan className="text-4xl text-rose-300" />
                  </div>
                  <h3 className="text-lg font-bold text-white text-center">Restrição</h3>
                  <p className="text-sm text-white/70 text-center">Opt-out / cancelados</p>
                </div>
              </button>

              <button
                onClick={() => router.push('/email-marketing/templates')}
                className="group relative overflow-hidden bg-gradient-to-br from-purple-500/20 to-purple-600/10 hover:from-purple-500/30 hover:to-purple-600/20 border-2 border-purple-500/40 hover:border-purple-500/60 rounded-2xl p-6 text-left transition-all duration-300 hover:scale-105 shadow-lg"
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="bg-purple-500/20 p-4 rounded-xl">
                    <FaFileAlt className="text-4xl text-purple-300" />
                  </div>
                  <h3 className="text-lg font-bold text-white text-center">Templates</h3>
                  <p className="text-sm text-white/70 text-center">
                    {loading ? '…' : `${stats.total_templates} modelo(s)`}
                  </p>
                </div>
              </button>

              <button
                onClick={() => router.push('/email-marketing/dominios')}
                className="group relative overflow-hidden bg-gradient-to-br from-red-500/20 to-red-600/10 hover:from-red-500/30 hover:to-red-600/20 border-2 border-red-500/40 hover:border-red-500/60 rounded-2xl p-6 text-left transition-all duration-300 hover:scale-105 shadow-lg"
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="bg-red-500/20 p-4 rounded-xl">
                    <FaGlobe className="text-4xl text-red-300" />
                  </div>
                  <h3 className="text-lg font-bold text-white text-center">Domínios</h3>
                  <p className="text-sm text-white/70 text-center">
                    {loading ? '…' : `${stats.active_domains} ativo(s)`}
                  </p>
                </div>
              </button>

              <button
                onClick={() => router.push('/email-marketing/envios')}
                className="group relative overflow-hidden bg-gradient-to-br from-orange-500/20 to-orange-600/10 hover:from-orange-500/30 hover:to-orange-600/20 border-2 border-orange-500/40 hover:border-orange-500/60 rounded-2xl p-6 text-left transition-all duration-300 hover:scale-105 shadow-lg"
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="bg-orange-500/20 p-4 rounded-xl">
                    <FaHistory className="text-4xl text-orange-300" />
                  </div>
                  <h3 className="text-lg font-bold text-white text-center">Histórico</h3>
                  <p className="text-sm text-white/70 text-center">
                    {loading ? '…' : `${stats.total_sends} envio(s)`}
                  </p>
                </div>
              </button>
            </div>
          </div>

          <style jsx>{`
            .bg-grid-white {
              background-image:
                linear-gradient(to right, rgba(255, 255, 255, 0.1) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(255, 255, 255, 0.1) 1px, transparent 1px);
              background-size: 20px 20px;
            }
          `}</style>
        </div>
      </ProtectedRoute>
    </>
  );
}
