import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import {
  FaEnvelope, FaPaperPlane, FaBullhorn, FaList, FaFileAlt, FaGlobe,
  FaChartBar, FaPlus, FaArrowRight, FaCheckCircle, FaExclamationTriangle,
  FaSignOutAlt
} from 'react-icons/fa';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/services/api';

interface Stats {
  total_campaigns: number;
  active_campaigns: number;
  total_lists: number;
  total_contacts: number;
  total_templates: number;
  total_domains: number;
  active_domains: number;
}

export default function EmailMarketingDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({
    total_campaigns: 0, active_campaigns: 0, total_lists: 0,
    total_contacts: 0, total_templates: 0, total_domains: 0, active_domains: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [campaigns, lists, templates, domains] = await Promise.all([
        api.get('/email-marketing/campaigns'),
        api.get('/email-marketing/lists'),
        api.get('/email-marketing/templates'),
        api.get('/email-marketing/domains'),
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
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const menus = [
    {
      title: 'Envio Único',
      description: 'Envie um e-mail avulso para um destinatário específico',
      icon: <FaPaperPlane className="text-4xl text-blue-300" />,
      color: 'blue',
      href: '/email-marketing/envio-unico',
      badge: null,
    },
    {
      title: 'Campanhas',
      description: 'Gerencie e acompanhe suas campanhas em andamento',
      icon: <FaBullhorn className="text-4xl text-orange-300" />,
      color: 'orange',
      href: '/email-marketing/campanhas',
      badge: stats.active_campaigns > 0 ? `${stats.active_campaigns} ativa(s)` : null,
    },
    {
      title: 'Listas de Contatos',
      description: 'Gerencie suas listas e importe contatos via CSV',
      icon: <FaList className="text-4xl text-green-300" />,
      color: 'green',
      href: '/email-marketing/listas',
      badge: stats.total_contacts > 0 ? `${stats.total_contacts.toLocaleString('pt-BR')} contatos` : null,
    },
    {
      title: 'Templates',
      description: 'Crie e edite modelos de e-mail reutilizáveis',
      icon: <FaFileAlt className="text-4xl text-purple-300" />,
      color: 'purple',
      href: '/email-marketing/templates',
      badge: null,
    },
    {
      title: 'Domínios',
      description: 'Configure domínios de envio com autenticação DNS',
      icon: <FaGlobe className="text-4xl text-red-300" />,
      color: 'red',
      href: '/email-marketing/dominios',
      badge: stats.active_domains === 0 ? '⚠️ Nenhum ativo' : `${stats.active_domains} ativo(s)`,
    },
  ];

  const colorMap: Record<string, string> = {
    blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/40 hover:from-blue-500/30 hover:border-blue-500/60 shadow-blue-500/20',
    orange: 'from-orange-500/20 to-orange-600/10 border-orange-500/40 hover:from-orange-500/30 hover:border-orange-500/60 shadow-orange-500/20',
    green: 'from-green-500/20 to-green-600/10 border-green-500/40 hover:from-green-500/30 hover:border-green-500/60 shadow-green-500/20',
    purple: 'from-purple-500/20 to-purple-600/10 border-purple-500/40 hover:from-purple-500/30 hover:border-purple-500/60 shadow-purple-500/20',
    red: 'from-red-500/20 to-red-600/10 border-red-500/40 hover:from-red-500/30 hover:border-red-500/60 shadow-red-500/20',
  };

  return (
    <>
      <Head><title>E-mail Marketing | Disparador</title></Head>
      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 py-12 px-4">
        {/* Header */}
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/')}
                className="p-3 bg-white/10 hover:bg-white/20 rounded-xl transition-all text-white"
                title="Voltar ao início"
              >
                <FaSignOutAlt className="rotate-180" />
              </button>
              <div>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-red-500/20 rounded-2xl">
                    <FaEnvelope className="text-3xl text-red-300" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-black text-white">E-mail Marketing</h1>
                    <p className="text-gray-400">Campanhas de e-mail profissional com Mailgun</p>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={() => router.push('/email-marketing/campanhas/criar')}
              className="px-6 py-3 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white rounded-xl font-bold transition-all flex items-center gap-2 shadow-lg"
            >
              <FaPlus /> Nova Campanha
            </button>
          </div>

          {/* Stats */}
          {!loading && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
              {[
                { label: 'Campanhas', value: stats.total_campaigns, icon: <FaBullhorn className="text-orange-400" /> },
                { label: 'Listas', value: stats.total_lists, icon: <FaList className="text-green-400" /> },
                { label: 'Contatos', value: stats.total_contacts.toLocaleString('pt-BR'), icon: <FaEnvelope className="text-blue-400" /> },
                { label: 'Domínios Ativos', value: stats.active_domains, icon: <FaGlobe className="text-red-400" /> },
              ].map((s, i) => (
                <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-5 flex items-center gap-4">
                  <div className="text-2xl">{s.icon}</div>
                  <div>
                    <p className="text-2xl font-black text-white">{s.value}</p>
                    <p className="text-gray-400 text-sm">{s.label}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Aviso se não tem domínio ativo */}
          {!loading && stats.active_domains === 0 && (
            <div className="bg-yellow-500/10 border-2 border-yellow-500/40 rounded-2xl p-5 mb-8 flex items-start gap-4">
              <FaExclamationTriangle className="text-yellow-400 text-2xl mt-1 flex-shrink-0" />
              <div>
                <p className="text-yellow-300 font-bold">Nenhum domínio ativo</p>
                <p className="text-gray-400 text-sm">Para enviar e-mails, você precisa cadastrar e verificar pelo menos um domínio de envio.</p>
                <button onClick={() => router.push('/email-marketing/dominios')} className="mt-2 text-yellow-300 underline text-sm font-bold">
                  Configurar domínio agora →
                </button>
              </div>
            </div>
          )}

          {/* Menu de navegação */}
          <div className="grid md:grid-cols-3 gap-6">
            {menus.map((menu, i) => (
              <button
                key={i}
                onClick={() => router.push(menu.href)}
                className={`group relative overflow-hidden rounded-2xl p-6 text-left transition-all duration-300 bg-gradient-to-br border-2 hover:scale-105 hover:shadow-xl shadow-lg cursor-pointer ${colorMap[menu.color]}`}
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="p-4 rounded-2xl bg-white/10 group-hover:bg-white/20 transition-all w-fit">
                      {menu.icon}
                    </div>
                    {menu.badge && (
                      <span className="px-3 py-1 bg-white/20 text-white rounded-full text-xs font-bold">
                        {menu.badge}
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="text-xl font-black text-white mb-1">{menu.title}</h3>
                    <p className="text-white/60 text-sm">{menu.description}</p>
                  </div>

                  <div className="flex items-center gap-2 text-white font-bold">
                    Acessar <FaArrowRight className="group-hover:translate-x-2 transition-transform" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
