import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import { FaWhatsapp, FaQrcode, FaRocket, FaCheckCircle, FaShieldAlt, FaSearch, FaGlobe, FaDatabase, FaSignOutAlt, FaUser, FaBuilding, FaLock, FaBan } from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';
import { useFeatures } from '../hooks/useFeatures';
import { usePermissions } from '../hooks/usePermissions';
import SystemLogo from '../components/SystemLogo';
import { buildFileUrl } from '@/utils/urlHelpers';

export default function ChooseIntegration() {
  const router = useRouter();
  const { user, isAuthenticated, loading, signOut } = useAuth();
  const { hasFeature, isTrial, getBlockedMessage, loading: loadingFeatures } = useFeatures();
  const { canAccessNovaVida, canVerifyNumbers, canManageProxies, loading: loadingPermissions } = usePermissions();
  
  // Verificar tanto o plano quanto as permissões do usuário
  const canAccessConsultaDados = hasFeature('consulta_dados') && canAccessNovaVida;
  const canAccessVerificarNumeros = hasFeature('verificar_numeros') && canVerifyNumbers;
  const canAccessProxies = hasFeature('gerenciar_proxies') && canManageProxies;
  
  // Mensagens de bloqueio personalizadas
  const getBlockedReason = (feature: string, hasFeatureFlag: boolean, hasPermission: boolean) => {
    if (!hasFeatureFlag) {
      return isTrial() ? '🆓 Disponível após período de teste' : '💰 Não incluído no seu plano';
    }
    if (!hasPermission) {
      return '🚫 Não habilitado para seu usuário';
    }
    return '';
  };

  // Redirecionar para login se não estiver autenticado
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  // Mostrar loading
  if (loading || loadingFeatures || loadingPermissions) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-emerald-500 mx-auto"></div>
          <p className="text-white mt-4 text-lg">Carregando funcionalidades...</p>
        </div>
      </div>
    );
  }

  // Se não estiver autenticado, não renderizar nada (vai redirecionar)
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 flex items-center justify-center py-12 px-4">
      {/* Botão de Perfil e Logout no Canto Superior Direito */}
      <div className="fixed top-6 right-6 z-50 flex items-center gap-4">
        <button
          onClick={() => {
            // Admin e super_admin vão para gestão, usuário comum vai para perfil
            if (user?.role === 'admin' || user?.role === 'super_admin') {
              router.push('/gestao');
            } else {
              router.push('/perfil');
            }
          }}
          className="bg-white/10 backdrop-blur-sm px-3 py-2 rounded-lg border border-white/20 hover:bg-white/20 hover:border-white/30 transition-all flex items-center gap-3"
          title={user?.role === 'admin' || user?.role === 'super_admin' ? 'Gestão Administrativa' : 'Meu Perfil'}
        >
          {user?.avatar ? (
            <img 
              src={
                user.avatar.startsWith('http')
                  ? user.avatar
                  : buildFileUrl(
                  user.avatar.startsWith('/uploads')
                    ? user.avatar
                    : `/uploads/avatars/${user.avatar}`
                ) || undefined
              }
              alt={user.nome}
              className="w-10 h-10 rounded-full object-cover border-2 border-emerald-400"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center border-2 border-emerald-400">
              <FaUser className="text-white text-lg" />
            </div>
          )}
          <p className="text-white text-sm font-medium">
            {user?.nome}
          </p>
        </button>
        <button
          onClick={() => {
            signOut();
            router.push('/login');
          }}
          className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-bold transition-all flex items-center gap-2 shadow-lg hover:shadow-xl"
        >
          <FaSignOutAlt /> Sair
        </button>
      </div>

      <div className="max-w-7xl w-full space-y-12">
        
        {/* HERO SECTION - CABEÇALHO PRINCIPAL */}
        <div className="text-center space-y-6">
          <div className="flex justify-center mb-8">
            <SystemLogo size="large" />
          </div>
          
          <p className="text-3xl text-white/80 font-medium max-w-3xl mx-auto">
            Escolha o tipo de integração WhatsApp que deseja utilizar
          </p>
        </div>

        {/* CARDS DE ESCOLHA - MOSTRAR DESABILITADOS SE SEM PERMISSÃO */}
        <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
          
          {/* CARD 1: API OFICIAL */}
          <button
            onClick={() => router.push('/dashboard-oficial')}
            className="group relative overflow-hidden rounded-3xl p-12 text-left transition-all duration-300 bg-gradient-to-br from-green-500/20 to-green-600/10 hover:from-green-500/30 hover:to-green-600/20 border-4 border-green-500/40 hover:border-green-500/60 hover:scale-105 hover:shadow-2xl shadow-lg shadow-green-500/30 cursor-pointer"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-green-500/10 rounded-full blur-3xl"></div>
            
            <div className="relative space-y-8">
              {/* Badge */}
              <div className="inline-block px-6 py-2 bg-green-500/20 border-2 border-green-400 rounded-full">
                <span className="text-green-300 font-black text-sm tracking-wider">RECOMENDADO</span>
              </div>

              {/* Ícone e Título */}
              <div className="space-y-4">
                <div className="bg-green-500/20 backdrop-blur-sm p-8 rounded-3xl group-hover:bg-green-500/30 transition-all duration-300 w-fit">
                  <FaShieldAlt className="text-7xl text-green-300" />
                </div>
                <h2 className="text-5xl font-black text-white">API Oficial WhatsApp</h2>
                <p className="text-white/70 text-xl leading-relaxed">
                  Integração oficial da Meta com máxima segurança e confiabilidade
                </p>
              </div>

              {/* Vantagens */}
              <div className="space-y-4 pt-4">
                <div className="flex items-center gap-4">
                  <div className="bg-green-500/30 p-3 rounded-xl">
                    <FaCheckCircle className="text-2xl text-green-300" />
                  </div>
                  <span className="text-white text-lg font-bold">✅ Oficialmente suportado pela Meta</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="bg-green-500/30 p-3 rounded-xl">
                    <FaCheckCircle className="text-2xl text-green-300" />
                  </div>
                  <span className="text-white text-lg font-bold">✅ Menor risco de banimento</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="bg-green-500/30 p-3 rounded-xl">
                    <FaCheckCircle className="text-2xl text-green-300" />
                  </div>
                  <span className="text-white text-lg font-bold">✅ Melhor para uso comercial</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="bg-green-500/30 p-3 rounded-xl">
                    <FaCheckCircle className="text-2xl text-green-300" />
                  </div>
                  <span className="text-white text-lg font-bold">✅ WhatsApp Business API</span>
                </div>
              </div>

              {/* Botão de Ação */}
              <div className="pt-6">
                <div className="flex items-center gap-4 text-white text-2xl font-black">
                  Acessar Sistema Oficial
                  <FaRocket className="text-3xl group-hover:translate-x-3 transition-transform duration-200" />
                </div>
              </div>
            </div>
          </button>

          {/* CARD 2: WhatsApp QR Connect */}
          <button
            onClick={() => router.push('/dashboard-uaz')}
            className="group relative overflow-hidden rounded-3xl p-12 text-left transition-all duration-300 bg-gradient-to-br from-blue-500/20 to-indigo-600/10 hover:from-blue-500/30 hover:to-indigo-600/20 border-4 border-blue-500/40 hover:border-blue-500/60 hover:scale-105 hover:shadow-2xl shadow-lg shadow-blue-500/30 cursor-pointer"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl"></div>
            
            <div className="relative space-y-8">
              {/* Badge */}
              <div className="inline-block px-6 py-2 bg-blue-500/20 border-2 border-blue-400 rounded-full">
                <span className="text-blue-300 font-black text-sm tracking-wider">INTEGRAL VIP</span>
              </div>

              {/* Ícone e Título */}
              <div className="space-y-4">
                <div className="bg-blue-500/20 backdrop-blur-sm p-8 rounded-3xl group-hover:bg-blue-500/30 transition-all duration-300 w-fit">
                  <FaQrcode className="text-7xl text-blue-300" />
                </div>
                <h2 className="text-5xl font-black text-white">WhatsApp QR Connect</h2>
                <p className="text-white/70 text-xl leading-relaxed">
                  Conexão rápida via QR Code com máxima flexibilidade
                </p>
              </div>

              {/* Vantagens */}
              <div className="space-y-4 pt-4">
                <div className="flex items-center gap-4">
                  <div className="bg-blue-500/30 p-3 rounded-xl">
                    <FaCheckCircle className="text-2xl text-blue-300" />
                  </div>
                  <span className="text-white text-lg font-bold">✅ Setup rápido por QR Code</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="bg-blue-500/30 p-3 rounded-xl">
                    <FaCheckCircle className="text-2xl text-blue-300" />
                  </div>
                  <span className="text-white text-lg font-bold">✅ Múltiplas sessões simultâneas</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="bg-blue-500/30 p-3 rounded-xl">
                    <FaCheckCircle className="text-2xl text-blue-300" />
                  </div>
                  <span className="text-white text-lg font-bold">✅ Mais flexibilidade</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="bg-yellow-500/30 p-3 rounded-xl">
                    <FaCheckCircle className="text-2xl text-yellow-300" />
                  </div>
                  <span className="text-yellow-300 text-lg font-bold">⚠️ Não oficial (usar com cuidado)</span>
                </div>
              </div>

              {/* Botão de Ação */}
              <div className="pt-6">
                <div className="flex items-center gap-4 text-white text-2xl font-black">
                  Acessar WhatsApp QR Connect
                  <FaRocket className="text-3xl group-hover:translate-x-3 transition-transform duration-200" />
                </div>
              </div>
            </div>
          </button>
        </div>

        {/* FUNÇÕES EXTRAS */}
        <div className="max-w-6xl mx-auto space-y-8 pt-12">
          <div className="text-center space-y-4">
            <h2 className="text-5xl font-black text-white">
              🛠️ Funções Extras
            </h2>
            <p className="text-xl text-white/70">
              Recursos adicionais disponíveis para todas as integrações
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            
            {/* CARD: CONSULTAR DADOS - DESABILITAR SE SEM PERMISSÃO DO PLANO OU DO USUÁRIO */}
            {canAccessConsultaDados ? (
              <button
                onClick={() => router.push('/consultar-dados')}
                className="group relative overflow-hidden rounded-2xl p-8 text-left transition-all duration-300 bg-gradient-to-br from-orange-500/20 to-orange-600/10 hover:from-orange-500/30 hover:to-orange-600/20 border-2 border-orange-500/40 hover:border-orange-500/60 hover:scale-105 hover:shadow-xl shadow-lg shadow-orange-500/20 cursor-pointer"
              >
                <div className="absolute top-0 right-0 w-48 h-48 bg-orange-500/10 rounded-full blur-3xl"></div>
                
                <div className="relative space-y-6">
                  {/* Ícone e Título */}
                  <div className="flex items-center gap-6">
                    <div className="bg-orange-500/20 backdrop-blur-sm p-6 rounded-2xl group-hover:bg-orange-500/30 transition-all duration-300">
                      <FaDatabase className="text-5xl text-orange-300" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-3xl font-black text-white mb-2">
                        Consultar Dados
                      </h3>
                      <p className="text-white/70 text-base">
                        API Nova Vida - CPF e CNPJ
                      </p>
                    </div>
                  </div>

                {/* Descrição */}
                <div className="space-y-3 pl-2">
                  <div className="flex items-start gap-3">
                    <div className="bg-orange-500/30 p-2 rounded-lg mt-1">
                      <FaCheckCircle className="text-lg text-orange-300" />
                    </div>
                    <span className="text-white/80 text-base">Dados cadastrais completos</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="bg-orange-500/30 p-2 rounded-lg mt-1">
                      <FaCheckCircle className="text-lg text-orange-300" />
                    </div>
                    <span className="text-white/80 text-base">Consulta única ou em massa</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="bg-orange-500/30 p-2 rounded-lg mt-1">
                      <FaCheckCircle className="text-lg text-orange-300" />
                    </div>
                    <span className="text-white/80 text-base">Export Excel/CSV</span>
                  </div>
                </div>

                  {/* Botão */}
                  <div className="pt-4">
                    <div className="flex items-center gap-3 text-orange-300 text-xl font-bold group-hover:text-white transition-colors duration-200">
                      Acessar Consulta
                      <FaRocket className="text-2xl group-hover:translate-x-2 transition-transform duration-200" />
                    </div>
                  </div>
                </div>
              </button>
            ) : (
              <div className="group relative overflow-hidden rounded-2xl p-8 border-2 border-gray-700/60 bg-gradient-to-br from-gray-800/40 to-gray-900/40 grayscale opacity-60 cursor-not-allowed">
                <div className="relative space-y-6">
                  <div className="flex items-center gap-6">
                    <div className="bg-gray-700/20 p-6 rounded-2xl">
                      <FaDatabase className="text-5xl text-gray-500" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-3xl font-black text-gray-400 mb-2 flex items-center gap-3">
                        Consultar Dados
                        {!hasFeature('consulta_dados') ? <FaLock className="text-xl text-red-400" /> : <FaBan className="text-xl text-red-400" />}
                      </h3>
                      <p className="text-gray-500 text-base">
                        {getBlockedReason('consulta_dados', hasFeature('consulta_dados'), canAccessNovaVida)}
                      </p>
                    </div>
                  </div>
                  {!hasFeature('consulta_dados') && (
                  <div className="pt-4">
                    <button
                      onClick={() => router.push('/gestao?tab=financeiro')}
                      className="px-6 py-3 bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 font-bold rounded-xl transition-all border border-orange-500/50"
                    >
                      Fazer Upgrade
                    </button>
                  </div>
                  )}
                </div>
              </div>
            )}

            {/* CARD: VERIFICAR NÚMEROS */}
            {canAccessVerificarNumeros ? (
              <button
                onClick={() => router.push('/uaz/verificar-numeros')}
                className="group relative overflow-hidden rounded-2xl p-8 text-left transition-all duration-300 bg-gradient-to-br from-purple-500/20 to-purple-600/10 hover:from-purple-500/30 hover:to-purple-600/20 border-2 border-purple-500/40 hover:border-purple-500/60 hover:scale-105 hover:shadow-xl shadow-lg shadow-purple-500/20 cursor-pointer"
              >
                <div className="absolute top-0 right-0 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl"></div>
                
                <div className="relative space-y-6">
                  <div className="flex items-center gap-6">
                    <div className="bg-purple-500/20 backdrop-blur-sm p-6 rounded-2xl group-hover:bg-purple-500/30 transition-all duration-300">
                      <FaSearch className="text-5xl text-purple-300" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-3xl font-black text-white mb-2">
                        Verificar Números
                      </h3>
                      <p className="text-white/70 text-base">
                        Consulte se números têm WhatsApp ativo
                      </p>
                    </div>
                  </div>

                {/* Descrição */}
                <div className="space-y-3 pl-2">
                  <div className="flex items-start gap-3">
                    <div className="bg-purple-500/30 p-2 rounded-lg mt-1">
                      <FaCheckCircle className="text-lg text-purple-300" />
                    </div>
                    <span className="text-white/80 text-base">Consulta única ou em massa</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="bg-purple-500/30 p-2 rounded-lg mt-1">
                      <FaCheckCircle className="text-lg text-purple-300" />
                    </div>
                    <span className="text-white/80 text-base">Exportação para Excel/CSV</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="bg-purple-500/30 p-2 rounded-lg mt-1">
                      <FaCheckCircle className="text-lg text-purple-300" />
                    </div>
                    <span className="text-white/80 text-base">Histórico de consultas</span>
                  </div>
                </div>

                  {/* Botão */}
                  <div className="pt-4">
                    <div className="flex items-center gap-3 text-purple-300 text-xl font-bold group-hover:text-white transition-colors duration-200">
                      Acessar Verificador
                      <FaRocket className="text-2xl group-hover:translate-x-2 transition-transform duration-200" />
                    </div>
                  </div>
                </div>
              </button>
            ) : (
              <div className="group relative overflow-hidden rounded-2xl p-8 border-2 border-gray-700/60 bg-gradient-to-br from-gray-800/40 to-gray-900/40 grayscale opacity-60 cursor-not-allowed">
                <div className="relative space-y-6">
                  <div className="flex items-center gap-6">
                    <div className="bg-gray-700/20 p-6 rounded-2xl">
                      <FaSearch className="text-5xl text-gray-500" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-3xl font-black text-gray-400 mb-2 flex items-center gap-3">
                        Verificar Números
                        {!hasFeature('verificar_numeros') ? <FaLock className="text-xl text-red-400" /> : <FaBan className="text-xl text-red-400" />}
                      </h3>
                      <p className="text-gray-500 text-base">
                        {getBlockedReason('verificar_numeros', hasFeature('verificar_numeros'), canVerifyNumbers)}
                      </p>
                    </div>
                  </div>
                  {!hasFeature('verificar_numeros') && (
                  <div className="pt-4">
                    <button
                      onClick={() => router.push('/gestao?tab=financeiro')}
                      className="px-6 py-3 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 font-bold rounded-xl transition-all border border-purple-500/50"
                    >
                      Fazer Upgrade
                    </button>
                  </div>
                  )}
                </div>
              </div>
            )}

            {/* CARD: GERENCIAR PROXIES */}
            {canAccessProxies ? (
              <button
                onClick={() => router.push('/proxies')}
                className="group relative overflow-hidden rounded-2xl p-8 text-left transition-all duration-300 bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 hover:from-cyan-500/30 hover:to-cyan-600/20 border-2 border-cyan-500/40 hover:border-cyan-500/60 hover:scale-105 hover:shadow-xl shadow-lg shadow-cyan-500/20 cursor-pointer"
              >
              <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl"></div>
              
              <div className="relative space-y-6">
                {/* Ícone e Título */}
                <div className="flex items-center gap-6">
                  <div className="bg-cyan-500/20 backdrop-blur-sm p-6 rounded-2xl group-hover:bg-cyan-500/30 transition-all duration-300">
                    <FaGlobe className="text-5xl text-cyan-300" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-3xl font-black text-white mb-2">
                      Gerenciar Proxies
                    </h3>
                    <p className="text-white/70 text-base">
                      Configure proxies para ambas integrações
                    </p>
                  </div>
                </div>

                {/* Descrição */}
                <div className="space-y-3 pl-2">
                  <div className="flex items-start gap-3">
                    <div className="bg-cyan-500/30 p-2 rounded-lg mt-1">
                      <FaCheckCircle className="text-lg text-cyan-300" />
                    </div>
                    <span className="text-white/80 text-base">Adicione proxies HTTP/SOCKS5</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="bg-cyan-500/30 p-2 rounded-lg mt-1">
                      <FaCheckCircle className="text-lg text-cyan-300" />
                    </div>
                    <span className="text-white/80 text-base">Teste de conexão automático</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="bg-cyan-500/30 p-2 rounded-lg mt-1">
                      <FaCheckCircle className="text-lg text-cyan-300" />
                    </div>
                    <span className="text-white/80 text-base">Gerenciamento centralizado</span>
                  </div>
                </div>

                  {/* Botão */}
                  <div className="pt-4">
                    <div className="flex items-center gap-3 text-cyan-300 text-xl font-bold group-hover:text-white transition-colors duration-200">
                      Gerenciar Proxies
                      <FaRocket className="text-2xl group-hover:translate-x-2 transition-transform duration-200" />
                    </div>
                  </div>
                </div>
              </button>
            ) : (
              <div className="group relative overflow-hidden rounded-2xl p-8 border-2 border-gray-700/60 bg-gradient-to-br from-gray-800/40 to-gray-900/40 grayscale opacity-60 cursor-not-allowed">
                <div className="relative space-y-6">
                  <div className="flex items-center gap-6">
                    <div className="bg-gray-700/20 p-6 rounded-2xl">
                      <FaGlobe className="text-5xl text-gray-500" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-3xl font-black text-gray-400 mb-2 flex items-center gap-3">
                        Gerenciar Proxies
                        {!hasFeature('gerenciar_proxies') ? <FaLock className="text-xl text-red-400" /> : <FaBan className="text-xl text-red-400" />}
                      </h3>
                      <p className="text-gray-500 text-base">
                        {getBlockedReason('gerenciar_proxies', hasFeature('gerenciar_proxies'), canManageProxies)}
                      </p>
                    </div>
                  </div>
                  {!hasFeature('gerenciar_proxies') && (
                  <div className="pt-4">
                    <button
                      onClick={() => router.push('/gestao?tab=financeiro')}
                      className="px-6 py-3 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 font-bold rounded-xl transition-all border border-cyan-500/50"
                    >
                      Fazer Upgrade
                    </button>
                  </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.6s ease-out;
        }
      `}</style>
    </div>
  );
}
