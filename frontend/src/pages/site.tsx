import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  FaWhatsapp, FaRocket, FaChartLine, FaUsers, FaShieldAlt,
  FaCheckCircle, FaBolt, FaClock, FaHeadset, FaStar,
  FaDatabase, FaQrcode, FaBullhorn, FaFileAlt, FaSearch,
  FaBan, FaLink, FaArrowRight, FaPlay, FaGift, FaChevronDown, FaChevronUp
} from 'react-icons/fa';
import axios from 'axios';
import SystemLogo from '@/components/SystemLogo';

interface Plan {
  id: number;
  nome: string;
  slug: string;
  descricao: string;
  preco_mensal: number;
  preco_anual: number;
  desconto_anual: number;
  limite_usuarios: number;
  limite_contas_whatsapp: number;
  limite_mensagens_dia: number;
  limite_mensagens_mes?: number;
  limite_contatos?: number;
  limite_templates?: number;
  limite_consultas_mes?: number;
  permite_webhook?: boolean;
  limite_campanhas_mes: number;
  funcionalidades: any;
}

interface Feature {
  id: string;
  titulo: string;
  descricao: string;
  icone: string;
  categoria: string;
}

interface Stats {
  clientes: number;
  conexoes: number;
  mensagens_enviadas: number;
}

export default function LandingPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [stats, setStats] = useState<Stats>({ clientes: 0, conexoes: 0, mensagens_enviadas: 0 });
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<'mensal' | 'anual'>('mensal');
  const [showContactModal, setShowContactModal] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState<string | null>(null);
  const [whatsappMessage, setWhatsappMessage] = useState<string>('Olá! Gostaria de saber mais sobre o Disparador NettSistemas');
  const [expandedPlans, setExpandedPlans] = useState<{ [key: string]: boolean }>({});
  const [screenshots, setScreenshots] = useState<any[]>([]);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

  // Garantir que não há outros headers/navbars aparecendo
  useEffect(() => {
    // Esconder qualquer outro header que possa existir
    const style = document.createElement('style');
    style.innerHTML = `
      header:not(.landing-header),
      nav:not(.landing-nav) {
        display: none !important;
      }
      body {
        overflow-x: hidden;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  useEffect(() => {
    loadData();
    loadWhatsappNumber();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const [plansRes, featuresRes, statsRes, screenshotsRes] = await Promise.all([
        axios.get(`${API_URL}/public/landing/plans`),
        axios.get(`${API_URL}/public/landing/features`),
        axios.get(`${API_URL}/public/landing/stats`),
        axios.get(`${API_URL}/public/screenshots`)
      ]);

      setPlans(plansRes.data.data);
      setFeatures(featuresRes.data.data);
      setStats(statsRes.data.data);
      setScreenshots(screenshotsRes.data.data || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadWhatsappNumber = async () => {
    try {
      const response = await axios.get(`${API_URL}/system-settings/public`);
      if (response.data.success && response.data.data) {
        if (response.data.data.landing_whatsapp) {
          setWhatsappNumber(response.data.data.landing_whatsapp);
        }
        if (response.data.data.landing_whatsapp_message) {
          setWhatsappMessage(response.data.data.landing_whatsapp_message);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar WhatsApp:', error);
    }
  };

  const togglePlanDetails = (planSlug: string) => {
    setExpandedPlans(prev => ({
      ...prev,
      [planSlug]: !prev[planSlug]
    }));
  };

  const getIconComponent = (iconName: string) => {
    const icons: any = {
      whatsapp: FaWhatsapp,
      qrcode: FaQrcode,
      bullhorn: FaBullhorn,
      'file-alt': FaFileAlt,
      database: FaDatabase,
      search: FaSearch,
      'check-circle': FaCheckCircle,
      'shield-alt': FaShieldAlt,
      ban: FaBan,
      link: FaLink,
      'chart-line': FaChartLine,
      users: FaUsers
    };
    const Icon = icons[iconName] || FaCheckCircle;
    return <Icon />;
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M+`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}k+`;
    return num.toString();
  };

  const scrollToPlans = () => {
    document.getElementById('planos')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 overflow-x-hidden">
      {/* Header/Navbar - Único e Elegante */}
      <nav className="landing-nav fixed top-0 w-full bg-dark-900/95 backdrop-blur-xl z-50 border-b-2 border-primary-500/30 shadow-2xl">
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            {/* Logo e Nome */}
            <div className="flex items-center gap-4">
              <SystemLogo size="small" showFallback={true} />
              <div>
                <h1 className="text-2xl font-black text-white">Disparador NettSistemas</h1>
                <p className="text-sm text-primary-400">Envios em Massa WhatsApp</p>
              </div>
            </div>

            {/* Menu de Navegação */}
            <div className="hidden md:flex items-center gap-8">
              <button
                onClick={scrollToPlans}
                className="text-white/70 hover:text-white transition-colors font-semibold"
              >
                Planos
              </button>
              <button
                onClick={() => document.getElementById('funcionalidades')?.scrollIntoView({ behavior: 'smooth' })}
                className="text-white/70 hover:text-white transition-colors font-semibold"
              >
                Funcionalidades
              </button>
              <button
                onClick={() => router.push('/login')}
                className="text-white/70 hover:text-white transition-colors font-semibold"
              >
                Login
              </button>
            </div>

            {/* Botão CTA */}
            <button
              onClick={() => router.push('/registro')}
              className="px-8 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-bold hover:scale-105 transition-all shadow-lg shadow-primary-500/40 flex items-center gap-2"
            >
              <FaGift className="text-xl" />
              <span>Teste Grátis 3 Dias</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-40 pb-20 px-4">
        <div className="container mx-auto text-center">
          <div className="inline-block mb-6">
            <span className="px-4 py-2 bg-primary-500/20 border border-primary-500 rounded-full text-primary-300 text-sm font-bold">
              🚀 A Solução Mais Completa do Mercado
            </span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-black text-white mb-6 leading-tight">
            Dispare Mensagens em
            <br />
            <span className="bg-gradient-to-r from-primary-400 to-emerald-400 bg-clip-text text-transparent">
              Massa no WhatsApp
            </span>
          </h1>
          
          <p className="text-xl md:text-2xl text-white/70 mb-12 max-w-3xl mx-auto">
            Envie milhares de mensagens personalizadas com API Oficial e QR Connect.
            Aumente suas vendas, automatize seu marketing e conquiste mais clientes.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button
              onClick={() => router.push('/registro')}
              className="px-8 py-4 bg-primary-600 hover:bg-primary-700 text-white text-lg font-bold rounded-xl hover:scale-105 transition-all shadow-lg shadow-primary-500/40 flex items-center gap-2"
            >
              <FaPlay /> Começar Agora - 3 Dias Grátis
            </button>
            <button
              onClick={scrollToPlans}
              className="px-8 py-4 bg-white/10 backdrop-blur-sm border-2 border-primary-500 text-white text-lg font-bold rounded-xl hover:bg-white/20 transition-all flex items-center gap-2"
            >
              Ver Planos <FaArrowRight />
            </button>
          </div>
        </div>
      </section>

      {/* Benefícios */}
      <section className="py-20 px-4 bg-dark-900/50">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
              Por que escolher o Disparador NettSistemas?
            </h2>
            <p className="text-xl text-white/60">
              A ferramenta mais poderosa para seu negócio crescer
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Envios Rápidos */}
            <div className="bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 hover:from-emerald-500/30 hover:to-emerald-600/20 backdrop-blur-sm rounded-2xl p-6 border-2 border-emerald-500/40 hover:border-emerald-500/60 transition-all hover:scale-105 shadow-lg">
              <div className="text-4xl text-emerald-300 mb-4"><FaBolt /></div>
              <h3 className="text-xl font-bold text-white mb-2">Envios Rápidos</h3>
              <p className="text-white/70">Milhares de mensagens em minutos com nossa infraestrutura otimizada</p>
            </div>

            {/* API Oficial */}
            <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 hover:from-green-500/30 hover:to-green-600/20 backdrop-blur-sm rounded-2xl p-6 border-2 border-green-500/40 hover:border-green-500/60 transition-all hover:scale-105 shadow-lg">
              <div className="text-4xl text-green-300 mb-4"><FaShieldAlt /></div>
              <h3 className="text-xl font-bold text-white mb-2">API Oficial</h3>
              <p className="text-white/70">Use a API oficial do WhatsApp Business com total segurança</p>
            </div>

            {/* Relatórios Completos */}
            <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 hover:from-blue-500/30 hover:to-blue-600/20 backdrop-blur-sm rounded-2xl p-6 border-2 border-blue-500/40 hover:border-blue-500/60 transition-all hover:scale-105 shadow-lg">
              <div className="text-4xl text-blue-300 mb-4"><FaChartLine /></div>
              <h3 className="text-xl font-bold text-white mb-2">Relatórios Completos</h3>
              <p className="text-white/70">Acompanhe cada métrica e tome decisões baseadas em dados</p>
            </div>

            {/* Suporte */}
            <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 hover:from-purple-500/30 hover:to-purple-600/20 backdrop-blur-sm rounded-2xl p-6 border-2 border-purple-500/40 hover:border-purple-500/60 transition-all hover:scale-105 shadow-lg">
              <div className="text-4xl text-purple-300 mb-4"><FaHeadset /></div>
              <h3 className="text-xl font-bold text-white mb-2">Suporte</h3>
              <p className="text-white/70">Nossa equipe está sempre disponível para ajudar você</p>
            </div>

            {/* Multi-Usuário */}
            <div className="bg-gradient-to-br from-pink-500/20 to-pink-600/10 hover:from-pink-500/30 hover:to-pink-600/20 backdrop-blur-sm rounded-2xl p-6 border-2 border-pink-500/40 hover:border-pink-500/60 transition-all hover:scale-105 shadow-lg">
              <div className="text-4xl text-pink-300 mb-4"><FaUsers /></div>
              <h3 className="text-xl font-bold text-white mb-2">Multi-Usuário</h3>
              <p className="text-white/70">Adicione sua equipe e gerencie permissões facilmente</p>
            </div>

            {/* QR Connect */}
            <div className="bg-gradient-to-br from-indigo-500/20 to-indigo-600/10 hover:from-indigo-500/30 hover:to-indigo-600/20 backdrop-blur-sm rounded-2xl p-6 border-2 border-indigo-500/40 hover:border-indigo-500/60 transition-all hover:scale-105 shadow-lg">
              <div className="text-4xl text-indigo-300 mb-4"><FaQrcode /></div>
              <h3 className="text-xl font-bold text-white mb-2">QR Connect</h3>
              <p className="text-white/70">Conecte contas sem API usando nosso sistema de QR Code</p>
            </div>

            {/* Base de Dados */}
            <div className="bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 hover:from-cyan-500/30 hover:to-cyan-600/20 backdrop-blur-sm rounded-2xl p-6 border-2 border-cyan-500/40 hover:border-cyan-500/60 transition-all hover:scale-105 shadow-lg">
              <div className="text-4xl text-cyan-300 mb-4"><FaDatabase /></div>
              <h3 className="text-xl font-bold text-white mb-2">Base de Dados</h3>
              <p className="text-white/70">Importe e gerencie milhares de contatos com facilidade</p>
            </div>

            {/* Agendamento */}
            <div className="bg-gradient-to-br from-orange-500/20 to-orange-600/10 hover:from-orange-500/30 hover:to-orange-600/20 backdrop-blur-sm rounded-2xl p-6 border-2 border-orange-500/40 hover:border-orange-500/60 transition-all hover:scale-105 shadow-lg">
              <div className="text-4xl text-orange-300 mb-4"><FaClock /></div>
              <h3 className="text-xl font-bold text-white mb-2">Agendamento</h3>
              <p className="text-white/70">Programe campanhas para o melhor momento de envio</p>
            </div>
          </div>
        </div>
      </section>

      {/* Funcionalidades */}
      <section id="funcionalidades" className="py-20 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
              Funcionalidades Completas
            </h2>
            <p className="text-xl text-white/60">
              Tudo que você precisa em uma única plataforma
            </p>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-4 border-primary-500"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feature) => (
                <div
                  key={feature.id}
                  className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 hover:border-primary-500/50 transition-all hover:scale-105 shadow-xl"
                >
                  <div className="text-3xl text-primary-400 mb-4">
                    {getIconComponent(feature.icone)}
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">{feature.titulo}</h3>
                  <p className="text-white/70">{feature.descricao}</p>
                  <div className="mt-3">
                    <span className="text-xs px-3 py-1 bg-primary-500/20 text-primary-300 rounded-full border border-primary-500/30">
                      {feature.categoria}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Seção de Screenshots */}
      {screenshots.length > 0 && (
        <section className="py-20 px-4 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-dark-900 to-cyan-600/10"></div>
          
          <div className="container mx-auto relative">
            <div className="text-center mb-16">
              <h2 className="text-5xl md:text-6xl font-black text-white mb-4 leading-tight">
                Veja o Sistema
              </h2>
              <p className="text-xl text-white/60">
                Interface intuitiva e poderosa para gerenciar suas campanhas
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              {screenshots.map((screenshot, index) => (
                <div
                  key={screenshot.id}
                  className="group relative bg-gradient-to-br from-blue-500/10 to-cyan-500/10 backdrop-blur-sm rounded-3xl overflow-hidden border-2 border-blue-500/30 hover:border-cyan-400 transition-all duration-500 hover:scale-[1.03] hover:-translate-y-3 shadow-2xl hover:shadow-cyan-500/60 cursor-pointer"
                  style={{
                    animation: `fadeInUp 0.6s ease-out ${index * 0.15}s both`,
                    transformStyle: 'preserve-3d'
                  }}
                >
                  {/* Glow effect animado */}
                  <div className="absolute -inset-2 bg-gradient-to-r from-blue-500 via-cyan-500 to-purple-500 rounded-3xl blur-2xl opacity-0 group-hover:opacity-40 transition-all duration-500 animate-pulse"></div>
                  
                  {/* Badge com número */}
                  <div className="absolute top-4 left-4 z-10 bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-4 py-2 rounded-full font-black text-sm shadow-xl opacity-0 group-hover:opacity-100 transition-all duration-300 transform -translate-y-2 group-hover:translate-y-0">
                    Screenshot #{index + 1}
                  </div>
                  
                  <div className="relative bg-gray-900 overflow-hidden" style={{ aspectRatio: '16/10' }}>
                    {/* Brilho animado */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out"></div>
                    
                    <img
                      src={`${process.env.NEXT_PUBLIC_API_URL?.replace(/\/api$/, '') || 'http://localhost:3001'}${screenshot.path}`}
                      alt={screenshot.titulo || 'Screenshot do sistema'}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    
                    {/* Overlay gradient com título */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 flex flex-col justify-end p-8">
                      {screenshot.titulo && (
                        <h3 className="text-white font-black text-2xl mb-2 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                          {screenshot.titulo}
                        </h3>
                      )}
                      {screenshot.descricao && (
                        <p className="text-white/90 text-sm transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500 delay-75">
                          {screenshot.descricao}
                        </p>
                      )}
                    </div>
                    
                    {/* Ícone de zoom */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 scale-50 group-hover:scale-100">
                      <div className="bg-white/20 backdrop-blur-md rounded-full p-4 border-2 border-white/40">
                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Badge de confiança */}
            <div className="text-center mt-16">
              <div className="inline-block px-6 py-3 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-500/40 rounded-full">
                <span className="text-blue-300 text-sm font-bold">
                  ✨ Interface moderna e intuitiva • 🚀 Fácil de usar • 💪 Poderoso
                </span>
              </div>
            </div>
          </div>

          <style jsx>{`
            @keyframes fadeInUp {
              from {
                opacity: 0;
                transform: translateY(30px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
          `}</style>
        </section>
      )}

      {/* Seção de Planos */}
      <section id="planos" className="py-20 px-4 relative overflow-hidden">
        {/* Background com efeitos */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary-600/10 via-dark-900 to-emerald-600/10"></div>
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        
        <div className="container mx-auto relative">
          <div className="text-center mb-12">
            {/* Badge chamativo com urgência */}
            <div className="inline-block mb-6 space-y-3">
              <div className="px-6 py-3 bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 text-white text-sm font-black rounded-full shadow-2xl shadow-orange-500/50 animate-pulse">
                🔥 OFERTA ESPECIAL - TESTE GRÁTIS POR 3 DIAS 🔥
              </div>
              <div className="flex items-center justify-center gap-2 text-white/80 text-xs font-bold">
                <span className="px-3 py-1 bg-green-500/20 border border-green-500 rounded-full animate-pulse">
                  ✅ Sem cartão de crédito
                </span>
                <span className="px-3 py-1 bg-blue-500/20 border border-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }}>
                  ⚡ Ativação imediata
                </span>
                <span className="px-3 py-1 bg-purple-500/20 border border-purple-500 rounded-full animate-pulse" style={{ animationDelay: '1s' }}>
                  🎁 Acesso completo
                </span>
              </div>
            </div>
            
            <h2 className="text-5xl md:text-6xl font-black text-white mb-4 leading-tight">
              Escolha o Plano <span className="bg-gradient-to-r from-primary-400 via-emerald-400 to-cyan-400 bg-clip-text text-transparent animate-gradient">Perfeito</span>
            </h2>
            <p className="text-xl text-white/70 mb-8">
              💰 Preços transparentes • 🚀 Comece agora • ✅ Cancele quando quiser
            </p>

            {/* Toggle Mensal/Anual com destaque */}
            <div className="inline-flex bg-dark-800/80 backdrop-blur-sm rounded-full p-1.5 border-2 border-primary-500/50 shadow-xl shadow-primary-500/30 mb-16">
              <button
                onClick={() => setBillingCycle('mensal')}
                className={`px-8 py-3 rounded-full font-bold transition-all ${
                  billingCycle === 'mensal'
                    ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/50 scale-105'
                    : 'text-white/70 hover:text-white hover:bg-white/5'
                }`}
              >
                💳 Mensal
              </button>
              <button
                onClick={() => setBillingCycle('anual')}
                className={`px-8 py-3 rounded-full font-bold transition-all relative ${
                  billingCycle === 'anual'
                    ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/50 scale-105'
                    : 'text-white/70 hover:text-white hover:bg-white/5'
                }`}
              >
                💎 Anual
                <span className="ml-2 text-xs px-3 py-1 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-full font-black shadow-lg animate-pulse">
                  -20% OFF
                </span>
              </button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-4 border-primary-500"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 max-w-7xl mx-auto px-4">
              {plans.map((plan, index) => {
                const preco = billingCycle === 'mensal' ? plan.preco_mensal : plan.preco_anual / 12;
                const isPopular = index === 1; // Segundo plano é o mais popular

                // Definir cores por plano
                const planColors = [
                  { gradient: 'from-blue-500/20 to-indigo-600/20', border: 'border-blue-500/40', shadow: 'shadow-blue-500/30', text: 'text-blue-400', glow: 'bg-blue-500/20' },
                  { gradient: 'from-emerald-500/20 to-green-600/20', border: 'border-emerald-500', shadow: 'shadow-emerald-500/50', text: 'text-emerald-400', glow: 'bg-emerald-500/30' },
                  { gradient: 'from-purple-500/20 to-pink-600/20', border: 'border-purple-500/40', shadow: 'shadow-purple-500/30', text: 'text-purple-400', glow: 'bg-purple-500/20' },
                  { gradient: 'from-orange-500/20 to-red-600/20', border: 'border-orange-500/40', shadow: 'shadow-orange-500/30', text: 'text-orange-400', glow: 'bg-orange-500/20' }
                ];
                const colors = planColors[index] || planColors[0];

                return (
                  <div
                    key={plan.id}
                    className={`relative bg-gradient-to-br ${colors.gradient} backdrop-blur-xl rounded-3xl p-10 border-2 ${colors.border} transition-all duration-300 hover:scale-105 hover:-translate-y-2 shadow-2xl ${colors.shadow} ${
                      isPopular ? 'scale-105 ring-4 ring-emerald-500/50 animate-pulse' : ''
                    }`}
                    style={{ 
                      animation: isPopular ? 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' : 'none'
                    }}
                  >
                    {/* Glow effect */}
                    <div className={`absolute -inset-1 ${colors.glow} rounded-3xl blur-xl opacity-50 group-hover:opacity-75 transition-opacity -z-10`}></div>
                    
                    {isPopular && (
                      <div className="absolute -top-5 left-1/2 transform -translate-x-1/2 z-10">
                        <span className="px-6 py-2 bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 text-white text-sm font-black rounded-full shadow-2xl shadow-orange-500/50 animate-bounce flex items-center gap-2">
                          <FaStar className="animate-spin" /> MAIS POPULAR <FaStar className="animate-spin" />
                        </span>
                      </div>
                    )}

                    {/* Selo de desconto */}
                    {billingCycle === 'anual' && plan.desconto_anual > 0 && (
                      <div className="absolute -top-3 -right-3 z-10">
                        <div className="relative">
                          <div className="absolute inset-0 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full blur-lg animate-pulse"></div>
                          <div className="relative px-4 py-2 bg-gradient-to-br from-green-500 to-emerald-600 text-white text-xs font-black rounded-full shadow-xl transform rotate-12">
                            🎉 -{plan.desconto_anual}%
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="text-center mb-8 relative">
                      <h3 className={`text-3xl font-black text-white mb-3 ${isPopular ? 'text-4xl' : ''}`}>
                        {plan.nome}
                      </h3>
                      <p className="text-white/70 text-sm mb-8">{plan.descricao}</p>
                      
                      <div className="mb-6 relative">
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className={`w-32 h-32 ${colors.glow} rounded-full blur-2xl`}></div>
                        </div>
                        <div className="relative">
                          <div className={`text-xs ${colors.text} font-bold mb-1`}>A partir de</div>
                          <div className={`text-6xl font-black bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent ${isPopular ? 'text-7xl' : ''}`}>
                            R$ {preco.toFixed(2)}
                          </div>
                          <div className="text-white/60 text-base font-semibold">/mês</div>
                          
                          {/* Mostrar valor total anual se for plano anual */}
                          {billingCycle === 'anual' && (
                            <div className="mt-3 pt-3 border-t border-white/20">
                              <div className="text-white/50 text-xs mb-1">Valor cobrado anualmente:</div>
                              <div className="text-2xl font-black text-white">
                                R$ {plan.preco_anual.toFixed(2)}
                              </div>
                              <div className="text-white/60 text-sm">/ano</div>
                            </div>
                          )}
                        </div>
                      </div>

                      {billingCycle === 'anual' && plan.desconto_anual > 0 && (
                        <div className="inline-block px-4 py-1 bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/40 rounded-full">
                          <span className="text-green-300 text-xs font-bold">
                            💰 Economize {plan.desconto_anual}% no plano anual
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Principais Recursos - Resumido */}
                    <div className="space-y-3 mb-8">
                      <div className="flex items-center gap-3 text-white bg-white/5 backdrop-blur-sm rounded-lg p-3 hover:bg-white/10 transition-all">
                        <div className="bg-gradient-to-br from-green-400 to-emerald-500 rounded-full p-1.5">
                          <FaCheckCircle className="text-white text-sm" />
                        </div>
                        <span className="font-semibold">{plan.limite_usuarios === -1 ? '♾️ Usuários ilimitados' : `👥 ${plan.limite_usuarios} usuário(s)`}</span>
                      </div>
                      <div className="flex items-center gap-3 text-white bg-white/5 backdrop-blur-sm rounded-lg p-3 hover:bg-white/10 transition-all">
                        <div className="bg-gradient-to-br from-green-400 to-emerald-500 rounded-full p-1.5">
                          <FaCheckCircle className="text-white text-sm" />
                        </div>
                        <span className="font-semibold">{plan.limite_contas_whatsapp === -1 ? '♾️ Contas ilimitadas' : `📱 ${plan.limite_contas_whatsapp} conta(s) WhatsApp`}</span>
                      </div>
                      <div className="flex items-center gap-3 text-white bg-white/5 backdrop-blur-sm rounded-lg p-3 hover:bg-white/10 transition-all">
                        <div className="bg-gradient-to-br from-green-400 to-emerald-500 rounded-full p-1.5">
                          <FaCheckCircle className="text-white text-sm" />
                        </div>
                        <span className="font-semibold">💬 Mensagens Ilimitadas</span>
                      </div>
                      <div className="flex items-center gap-3 text-white bg-white/5 backdrop-blur-sm rounded-lg p-3 hover:bg-white/10 transition-all">
                        <div className="bg-gradient-to-br from-green-400 to-emerald-500 rounded-full p-1.5">
                          <FaCheckCircle className="text-white text-sm" />
                        </div>
                        <span className="font-semibold">📊 Campanhas Ilimitadas</span>
                      </div>
                      <div className="flex items-center gap-3 text-white bg-white/5 backdrop-blur-sm rounded-lg p-3 hover:bg-white/10 transition-all">
                        <div className="bg-gradient-to-br from-green-400 to-emerald-500 rounded-full p-1.5">
                          <FaCheckCircle className="text-white text-sm" />
                        </div>
                        <span className="font-semibold">✅ WhatsApp API Oficial</span>
                      </div>
                      <div className="flex items-center gap-3 text-white bg-white/5 backdrop-blur-sm rounded-lg p-3 hover:bg-white/10 transition-all">
                        <div className="bg-gradient-to-br from-green-400 to-emerald-500 rounded-full p-1.5">
                          <FaCheckCircle className="text-white text-sm" />
                        </div>
                        <span className="font-semibold">📲 QR Connect</span>
                      </div>
                    </div>

                    {/* Botão Ver Detalhes */}
                    <button
                      onClick={() => togglePlanDetails(plan.slug)}
                      className="w-full mb-6 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/20 hover:border-white/40 rounded-lg text-white font-bold transition-all flex items-center justify-center gap-2"
                    >
                      {expandedPlans[plan.slug] ? (
                        <>
                          <FaChevronUp /> Ocultar Detalhes
                        </>
                      ) : (
                        <>
                          <FaChevronDown /> Ver Todos os Detalhes
                        </>
                      )}
                    </button>

                    {/* Detalhes Completos - Expandível */}
                    {expandedPlans[plan.slug] && (
                      <div className="space-y-6 mb-8 border-t border-white/10 pt-6">
                        {/* Limites Detalhados */}
                        <div>
                          <div className="text-white/80 text-sm font-bold mb-3 flex items-center gap-2">
                            <span className="text-xl">📊</span> LIMITES DO PLANO
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center gap-3 text-white bg-white/5 backdrop-blur-sm rounded-lg p-2.5">
                              <FaCheckCircle className="text-green-400 text-sm flex-shrink-0" />
                              <span className="text-sm">{plan.limite_campanhas_mes === -1 ? '♾️ Campanhas ilimitadas' : `🚀 ${plan.limite_campanhas_mes} campanhas/mês`}</span>
                            </div>
                            <div className="flex items-center gap-3 text-white bg-white/5 backdrop-blur-sm rounded-lg p-2.5">
                              <FaCheckCircle className="text-green-400 text-sm flex-shrink-0" />
                              <span className="text-sm">
                                {(plan.limite_mensagens_mes ?? -1) === -1
                                  ? '♾️ Mensagens ilimitadas'
                                  : `💬 ${(plan.limite_mensagens_mes ?? 0).toLocaleString()} mensagens/mês`}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-white bg-white/5 backdrop-blur-sm rounded-lg p-2.5">
                              <FaCheckCircle className="text-green-400 text-sm flex-shrink-0" />
                              <span className="text-sm">
                                {(plan.limite_contatos ?? -1) === -1
                                  ? '♾️ Contatos ilimitados'
                                  : `📇 ${(plan.limite_contatos ?? 0).toLocaleString()} contatos`}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-white bg-white/5 backdrop-blur-sm rounded-lg p-2.5">
                              <FaCheckCircle className="text-green-400 text-sm flex-shrink-0" />
                              <span className="text-sm">
                                {(plan.limite_templates ?? -1) === -1
                                  ? '♾️ Templates ilimitados'
                                  : `📄 ${(plan.limite_templates ?? 0).toLocaleString()} templates`}
                              </span>
                            </div>
                            {typeof plan.limite_consultas_mes === 'number' && (
                              <div className="flex items-center gap-3 text-white bg-white/5 backdrop-blur-sm rounded-lg p-2.5">
                                <FaCheckCircle className="text-green-400 text-sm flex-shrink-0" />
                                <span className="text-sm">
                                  {plan.limite_consultas_mes === -1
                                    ? '♾️ Consultas ilimitadas'
                                    : `🔍 ${(plan.limite_consultas_mes ?? 0).toLocaleString()} consultas/mês`}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Funcionalidades Incluídas */}
                        <div>
                          <div className="text-white/80 text-sm font-bold mb-3 flex items-center gap-2">
                            <span className="text-xl">✨</span> FUNCIONALIDADES INCLUÍDAS
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center gap-3 text-white bg-white/5 backdrop-blur-sm rounded-lg p-2.5">
                              <FaCheckCircle className="text-green-400 text-sm flex-shrink-0" />
                              <span className="text-sm">⏰ Agendamento de Mensagens</span>
                            </div>
                            <div className="flex items-center gap-3 text-white bg-white/5 backdrop-blur-sm rounded-lg p-2.5">
                              <FaCheckCircle className="text-green-400 text-sm flex-shrink-0" />
                              <span className="text-sm">📈 Relatórios Completos</span>
                            </div>
                            <div className="flex items-center gap-3 text-white bg-white/5 backdrop-blur-sm rounded-lg p-2.5">
                              <FaCheckCircle className="text-green-400 text-sm flex-shrink-0" />
                              <span className="text-sm">📥 Export de Dados</span>
                            </div>
                            {plan.permite_webhook && (
                              <div className="flex items-center gap-3 text-white bg-white/5 backdrop-blur-sm rounded-lg p-2.5">
                                <FaCheckCircle className="text-green-400 text-sm flex-shrink-0" />
                                <span className="text-sm">🔗 Webhooks</span>
                              </div>
                            )}
                            {(plan.slug === 'profissional' || plan.slug === 'empresarial') && (
                              <>
                                <div className="flex items-center gap-3 text-white bg-white/5 backdrop-blur-sm rounded-lg p-2.5">
                                  <FaCheckCircle className="text-green-400 text-sm flex-shrink-0" />
                                  <span className="text-sm">🔍 Consulta Nova Vida</span>
                                </div>
                                <div className="flex items-center gap-3 text-white bg-white/5 backdrop-blur-sm rounded-lg p-2.5">
                                  <FaCheckCircle className="text-green-400 text-sm flex-shrink-0" />
                                  <span className="text-sm">🎯 Suporte Prioritário</span>
                                </div>
                              </>
                            )}
                            {plan.slug === 'empresarial' && (
                              <>
                                <div className="flex items-center gap-3 text-white bg-white/5 backdrop-blur-sm rounded-lg p-2.5">
                                  <FaCheckCircle className="text-green-400 text-sm flex-shrink-0" />
                                  <span className="text-sm">🎨 White Label</span>
                                </div>
                                <div className="flex items-center gap-3 text-white bg-white/5 backdrop-blur-sm rounded-lg p-2.5">
                                  <FaCheckCircle className="text-green-400 text-sm flex-shrink-0" />
                                  <span className="text-sm">🔧 Personalização Avançada</span>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => router.push('/registro')}
                      className={`relative w-full py-4 rounded-xl font-black text-lg transition-all duration-300 flex items-center justify-center gap-3 overflow-hidden group mt-4 ${
                        isPopular
                          ? 'bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-600 hover:from-emerald-600 hover:via-green-600 hover:to-emerald-700 text-white shadow-2xl shadow-emerald-500/60 hover:shadow-emerald-500/80 hover:scale-105'
                          : 'bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white shadow-xl shadow-primary-500/50 hover:shadow-primary-500/70 hover:scale-105 border-2 border-primary-400/50'
                      }`}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                      <FaGift className="text-2xl animate-bounce" />
                      <span className="relative z-10">TESTE GRÁTIS 3 DIAS</span>
                      <FaRocket className="text-xl" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* CTA Extra abaixo dos planos */}
          <div className="text-center mt-16">
            <div className="inline-block bg-gradient-to-r from-primary-500/20 via-emerald-500/20 to-cyan-500/20 backdrop-blur-xl rounded-3xl p-8 border-2 border-primary-500/40 shadow-2xl">
              <div className="flex flex-col md:flex-row items-center gap-6">
                <div className="text-6xl">🎁</div>
                <div className="text-left">
                  <h3 className="text-2xl font-black text-white mb-2">
                    Não sabe qual escolher?
                  </h3>
                  <p className="text-white/70 text-lg">
                    Teste GRÁTIS por 3 dias e descubra o poder da plataforma!
                  </p>
                </div>
                <button
                  onClick={() => router.push('/registro')}
                  className="px-8 py-4 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white text-lg font-black rounded-xl hover:scale-110 transition-all shadow-2xl shadow-orange-500/50 whitespace-nowrap flex items-center gap-2"
                >
                  <FaRocket className="text-xl" />
                  COMEÇAR AGORA
                </button>
              </div>
            </div>
          </div>
        </div>

        <style jsx>{`
          @keyframes gradient {
            0%, 100% {
              background-size: 200% 200%;
              background-position: left center;
            }
            50% {
              background-size: 200% 200%;
              background-position: right center;
            }
          }
          .animate-gradient {
            animation: gradient 3s ease infinite;
          }
        `}</style>
      </section>

      {/* Depoimentos */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
              O que nossos clientes dizem
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {[
              {
                nome: 'João Silva',
                empresa: 'Marketing Digital',
                depoimento: 'Aumentei minhas vendas em 300% no primeiro mês. A melhor ferramenta que já usei!',
                foto: '👨‍💼'
              },
              {
                nome: 'Maria Santos',
                empresa: 'E-commerce',
                depoimento: 'Economizei horas de trabalho manual. O suporte é excepcional!',
                foto: '👩‍💼'
              },
              {
                nome: 'Pedro Costa',
                empresa: 'Agência de Publicidade',
                depoimento: 'Ferramenta completa e fácil de usar. Recomendo para todos!',
                foto: '👨‍💻'
              }
            ].map((testimonial, index) => (
              <div
                key={index}
                className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 hover:border-primary-500/50 transition-all shadow-xl"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="text-5xl">{testimonial.foto}</div>
                  <div>
                    <div className="font-bold text-white">{testimonial.nome}</div>
                    <div className="text-sm text-white/60">{testimonial.empresa}</div>
                  </div>
                </div>
                <div className="flex gap-1 mb-3">
                  {[...Array(5)].map((_, i) => (
                    <FaStar key={i} className="text-yellow-400" />
                  ))}
                </div>
                <p className="text-white/80 italic">"{testimonial.depoimento}"</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-20 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary-600/30 via-primary-500/20 to-primary-600/30"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl"></div>
        
        <div className="container mx-auto text-center relative">
          <h2 className="text-4xl md:text-5xl font-black text-white mb-6">
            Pronto para Transformar seu Negócio?
          </h2>
          <p className="text-xl text-white/80 mb-8 max-w-2xl mx-auto">
            Junte-se a milhares de empresas que já estão usando o Disparador NettSistemas
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => router.push('/registro')}
              className="px-8 py-4 bg-primary-600 hover:bg-primary-700 text-white text-lg font-bold rounded-xl hover:scale-105 transition-all shadow-lg shadow-primary-500/40"
            >
              <FaRocket className="inline mr-2" />
              Começar Teste Grátis
            </button>
            <button
              onClick={() => setShowContactModal(true)}
              className="px-8 py-4 bg-white/10 backdrop-blur-sm border-2 border-white/30 text-white text-lg font-bold rounded-xl hover:bg-white/20 transition-all"
            >
              Falar com Especialista
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 bg-dark-900/80 backdrop-blur-xl border-t-2 border-white/10">
        <div className="container mx-auto text-center text-white/60">
          <div className="flex items-center justify-center gap-3 mb-4">
            <SystemLogo size="small" showFallback={true} />
            <span className="text-xl font-bold text-white">Disparador NettSistemas</span>
          </div>
          <p className="mb-4">A solução mais completa para disparos em massa no WhatsApp</p>
          <p className="text-sm">Sistema de Disparo em Massa - <span className="text-primary-400 font-semibold">NettSistemas API Oficial</span> © 2024</p>
        </div>
      </footer>

      {/* Botão Flutuante do WhatsApp */}
      {whatsappNumber && (
        <a
          href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappMessage)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-6 right-6 z-50 bg-gradient-to-br from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white p-5 rounded-full shadow-2xl hover:scale-110 transition-all duration-300 animate-bounce flex items-center justify-center group"
          title="Fale conosco no WhatsApp"
        >
          <FaWhatsapp className="text-4xl" />
          <div className="absolute right-full mr-3 bg-gray-900 text-white px-4 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            Fale Conosco!
          </div>
        </a>
      )}

      {/* Modal de Contato */}
      {showContactModal && <ContactModal onClose={() => setShowContactModal(false)} apiUrl={API_URL} />}
    </div>
  );
}

// Componente Modal de Contato
function ContactModal({ onClose, apiUrl }: { onClose: () => void; apiUrl: string }) {
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    telefone: '',
    empresa: '',
    mensagem: ''
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await axios.post(`${apiUrl}/public/landing/contact`, formData);
      
      if (response.data.success) {
        setSuccess(true);
        setTimeout(() => onClose(), 3000);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao enviar mensagem');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-dark-800/95 backdrop-blur-xl rounded-2xl p-8 max-w-md w-full border-2 border-green-500 shadow-2xl shadow-green-500/50 text-center">
          <div className="text-6xl mb-4">✅</div>
          <h3 className="text-2xl font-bold text-white mb-2">Mensagem Enviada!</h3>
          <p className="text-white/60">Entraremos em contato em breve.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-dark-800/95 backdrop-blur-xl rounded-2xl p-8 max-w-md w-full border border-primary-500 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold text-white">Fale Conosco</h3>
          <button onClick={onClose} className="text-white/60 hover:text-white text-2xl">×</button>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500 rounded-lg p-3 mb-4 text-red-300 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">Nome *</label>
            <input
              type="text"
              required
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              className="w-full px-4 py-3 bg-white/10 text-white rounded-lg border border-white/20 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">Email *</label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-3 bg-white/10 text-white rounded-lg border border-white/20 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">WhatsApp</label>
            <input
              type="tel"
              value={formData.telefone}
              onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
              className="w-full px-4 py-3 bg-white/10 text-white rounded-lg border border-white/20 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">Empresa</label>
            <input
              type="text"
              value={formData.empresa}
              onChange={(e) => setFormData({ ...formData, empresa: e.target.value })}
              className="w-full px-4 py-3 bg-white/10 text-white rounded-lg border border-white/20 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">Mensagem</label>
            <textarea
              rows={4}
              value={formData.mensagem}
              onChange={(e) => setFormData({ ...formData, mensagem: e.target.value })}
              className="w-full px-4 py-3 bg-white/10 text-white rounded-lg border border-white/20 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30 transition-all"
              placeholder="Como podemos ajudar?"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl hover:scale-105 transition-all shadow-lg shadow-primary-500/40"
          >
            {loading ? 'Enviando...' : 'Enviar Mensagem'}
          </button>
        </form>
      </div>
    </div>
  );
}

