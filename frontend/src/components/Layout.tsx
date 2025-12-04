import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { FaWhatsapp, FaCog, FaChartBar, FaHome, FaBan, FaMousePointer, FaGlobe, FaEnvelope, FaSignOutAlt, FaUser } from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { buildFileUrl } from '@/utils/urlHelpers';
import SystemLogo from './SystemLogo';
import TrialExpiringBanner from './TrialExpiringBanner';
import AdminNotificationModal from './AdminNotificationModal';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const {
    canAccessWhatsAppAPI,
    canAccessCampaigns,
    canAccessDatabase,
    canAccessRestrictionList,
    canAccessWebhooks,
    canAccessNovaVida,
    canAccessConfiguracoes,
    permissions,
  } = usePermissions();
  
  // Admin sempre pode acessar configurações
  const showConfiguracoes = user?.role === 'admin' || user?.role === 'super_admin' || permissions?.all || canAccessConfiguracoes;

  // Definir título e subtítulo com base na rota
  const getTituloSubtitulo = () => {
    // Páginas Compartilhadas (Funções Extras)
    if (router.pathname === '/consultar-dados') {
      return {
        titulo: 'Consultar Dados Nova Vida',
        subtitulo: 'Consulta CPF e CNPJ',
        icon: FaGlobe
      };
    }
    if (router.pathname === '/proxies') {
      return {
        titulo: 'Gerenciar Proxies',
        subtitulo: 'Configuração de Proxies',
        icon: FaGlobe
      };
    }
    if (router.pathname === '/verificar-numeros' || router.pathname === '/uaz/verificar-numeros') {
      return {
        titulo: 'Verificar Números',
        subtitulo: 'Verificação de WhatsApp',
        icon: FaWhatsapp
      };
    }

    // Padrão - API Oficial
    return {
      titulo: 'Disparador NettSistemas',
      subtitulo: 'API OFICIAL',
      icon: FaWhatsapp
    };
  };

  const { titulo, subtitulo, icon: IconComponent } = getTituloSubtitulo();

  // Verificar se está em página compartilhada (Função Extra)
  const paginasCompartilhadas = ['/consultar-dados', '/proxies', '/verificar-numeros', '/uaz/verificar-numeros'];
  const isPaginaCompartilhada = paginasCompartilhadas.includes(router.pathname);

  // Função inteligente para o botão Início
  const handleInicioClick = () => {
    if (isPaginaCompartilhada) {
      // Se é Função Extra, vai direto para escolha de conexão
      router.push('/');
    } else if (router.pathname === '/dashboard-oficial') {
      // Se está no dashboard, volta para escolha de conexão
      router.push('/');
    } else {
      // Se está em outra página da API Oficial, volta para o dashboard
      router.push('/dashboard-oficial');
    }
  };

  const navigation = [
    { name: 'Configurações', href: '/configuracoes', icon: FaCog },
  ];

  const avatarPath = user?.avatar
    ? user.avatar.startsWith('/uploads')
      ? user.avatar
      : `/uploads/avatars/${user.avatar}`
    : null;
  const avatarUrl = avatarPath ? buildFileUrl(avatarPath) : null;

  return (
    <>
      {/* Banner de Trial Expirando */}
      <TrialExpiringBanner />
      
      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900">
        {/* Header LIMPO E ORGANIZADO */}
        <header className="bg-dark-900/95 backdrop-blur-xl border-b-2 border-primary-500/30 sticky top-0 z-40 shadow-2xl">
        <div className="max-w-[1600px] mx-auto px-6">
          <div className="flex items-center justify-between py-8">
            
            {/* Logo e Título - DINÂMICO */}
            <div className="flex items-center gap-4 flex-shrink-0">
              {/* Logo do Sistema */}
              <div className="mr-4">
                <SystemLogo size="medium" />
              </div>
              
              <div className="bg-gradient-to-br from-primary-500 to-primary-600 p-5 rounded-xl shadow-lg">
                <IconComponent className="text-white text-5xl" />
              </div>
              <div>
                <h1 className="text-3xl font-black text-white leading-tight">
                  {titulo}
                </h1>
                <p className="text-lg text-primary-400 font-bold">
                  {subtitulo}
                </p>
              </div>
            </div>

            {/* Navigation - HORIZONTAL E ESPAÇADA */}
            <nav className="flex items-center gap-3 flex-wrap">
              {/* Botão Início INTELIGENTE */}
              <button
                onClick={handleInicioClick}
                className="group flex items-center gap-2 px-5 py-3 rounded-lg font-semibold text-base transition-all duration-200 whitespace-nowrap bg-primary-600 text-white shadow-lg shadow-primary-500/40 hover:bg-primary-700"
                title={
                  isPaginaCompartilhada
                    ? 'Voltar para escolha de conexão' 
                    : router.pathname === '/dashboard-oficial' 
                    ? 'Voltar para escolha de conexão' 
                    : 'Voltar para o menu API Oficial'
                }
              >
                <FaHome className="text-lg" />
                <span>Início</span>
              </button>
              
              {/* Botões de Configurações - Esconder em Funções Extras e verificar permissão */}
              {!isPaginaCompartilhada && showConfiguracoes && navigation.map((item) => {
                const Icon = item.icon;
                const isActive = router.pathname === item.href || 
                                 (item.href !== '/dashboard-oficial' && router.pathname.startsWith(item.href));
                
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`group flex items-center gap-2 px-5 py-3 rounded-lg font-semibold text-base transition-all duration-200 whitespace-nowrap ${
                      isActive
                        ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/40'
                        : 'text-white/70 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 hover:border-primary-500/50'
                    }`}
                  >
                    <Icon className="text-lg" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}

              {/* Separador */}
              <div className="w-px h-8 bg-white/20 mx-2"></div>

              {/* Usuário e Logout */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => router.push('/perfil')}
                  className="bg-white/10 backdrop-blur-sm px-3 py-2 rounded-lg border border-white/20 hover:bg-white/20 hover:border-white/30 transition-all flex items-center gap-3"
                  title="Editar perfil"
                >
                  {avatarUrl ? (
                    <img 
                      src={avatarUrl}
                      alt={user?.nome || 'Usuário'}
                      className="w-10 h-10 rounded-full object-cover border-2 border-emerald-400"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center border-2 border-emerald-400">
                      <FaUser className="text-white text-lg" />
                    </div>
                  )}
                  <p className="text-white text-sm font-medium">
                    {user?.nome || 'Administrador'}
                  </p>
                </button>
                <button
                  onClick={() => {
                    signOut();
                    router.push('/login');
                  }}
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-bold transition-all flex items-center gap-2 shadow-lg hover:shadow-xl"
                  title="Sair do sistema"
                >
                  <FaSignOutAlt /> Sair
                </button>
              </div>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main>
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-dark-900/80 backdrop-blur-xl border-t-2 border-white/10 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-white/60 text-sm font-medium">
            Sistema de Disparo em Massa - <span className="text-primary-400 font-semibold">NettSistemas API Oficial</span> © 2024
          </p>
        </div>
      </footer>

      {/* Modal de Notificações do Admin */}
      <AdminNotificationModal />
      </div>
    </>
  );
}
