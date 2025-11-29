import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { FaQrcode, FaCog, FaHome, FaGlobe, FaWhatsapp, FaSignOutAlt, FaUser } from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';
import SystemLogo from './SystemLogo';

interface LayoutUazProps {
  children: React.ReactNode;
}

export default function LayoutUaz({ children }: LayoutUazProps) {
  const router = useRouter();
  const { user, signOut } = useAuth();

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

    // Padrão - QR Connect
    return {
      titulo: 'Disparador NettSistemas',
      subtitulo: 'QR CONNECT',
      icon: FaQrcode
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
    } else if (router.pathname === '/dashboard-uaz') {
      // Se está no dashboard, volta para escolha de conexão
      router.push('/');
    } else {
      // Se está em outra página do QR Connect, volta para o dashboard
      router.push('/dashboard-uaz');
    }
  };

  const navigation = [
    { name: 'Configurações', href: '/configuracoes-uaz', icon: FaCog },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900">
      {/* Header WhatsApp QR Connect */}
      <header className="bg-dark-900/95 backdrop-blur-xl border-b-2 border-blue-500/30 sticky top-0 z-50 shadow-2xl">
        <div className="max-w-[1600px] mx-auto px-6">
          <div className="flex items-center justify-between py-8">
            
            {/* Logo e Título - DINÂMICO */}
            <div className="flex items-center gap-4 flex-shrink-0">
              {/* Logo do Sistema */}
              <div className="mr-4 border-r-2 border-gray-700 pr-4">
                <SystemLogo size="medium" />
              </div>
              
              <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-5 rounded-xl shadow-lg">
                <IconComponent className="text-white text-5xl" />
              </div>
              <div>
                <h1 className="text-3xl font-black text-white leading-tight">
                  {titulo}
                </h1>
                <p className="text-lg text-blue-400 font-bold">
                  {subtitulo}
                </p>
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex items-center gap-3 flex-wrap">
              {/* Botão Início INTELIGENTE */}
              <button
                onClick={handleInicioClick}
                className="group flex items-center gap-2 px-5 py-3 rounded-lg font-semibold text-base transition-all duration-200 whitespace-nowrap bg-blue-600 text-white shadow-lg shadow-blue-500/40 hover:bg-blue-700"
                title={
                  isPaginaCompartilhada
                    ? 'Voltar para escolha de conexão' 
                    : router.pathname === '/dashboard-uaz' 
                    ? 'Voltar para escolha de conexão' 
                    : 'Voltar para o menu QR Connect'
                }
              >
                <FaHome className="text-lg" />
                <span>Início</span>
              </button>
              
              {/* Botões de Configurações - Esconder em Funções Extras */}
              {!isPaginaCompartilhada && navigation.map((item) => {
                const Icon = item.icon;
                const isActive = router.pathname === item.href || 
                                 (item.href !== '/dashboard-uaz' && router.pathname.startsWith(item.href));
                
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`group flex items-center gap-2 px-5 py-3 rounded-lg font-semibold text-base transition-all duration-200 whitespace-nowrap ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/40'
                        : 'text-white/70 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 hover:border-blue-500/50'
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
                  {user?.avatar ? (
                    <img 
                      src={`${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:3001'}/uploads/avatars/${user.avatar}`}
                      alt={user.nome}
                      className="w-10 h-10 rounded-full object-cover border-2 border-blue-400"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center border-2 border-blue-400">
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
            Sistema de Disparo em Massa - <span className="text-blue-400 font-semibold">QR Connect</span> © 2024
          </p>
        </div>
      </footer>
    </div>
  );
}

