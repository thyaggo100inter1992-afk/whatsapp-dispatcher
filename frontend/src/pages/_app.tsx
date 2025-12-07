import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import Layout from '@/components/Layout';
import LayoutUaz from '@/components/LayoutUaz';
import ProtectedRoute from '@/components/ProtectedRoute';
import { AuthProvider } from '@/contexts/AuthContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import logger from '@/services/logger';
import frontendLogger from '@/services/frontend-logger';
import { useInactivityLogout } from '@/hooks/useInactivityLogout';
import api from '@/services/api';
import { buildFileUrl, getApiBaseUrl } from '@/utils/urlHelpers';

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  
  // ⏱️ SISTEMA DE LOGOUT AUTOMÁTICO POR INATIVIDADE (1 HORA)
  useInactivityLogout();
  
  // 🎨 CARREGAR FAVICON DINAMICAMENTE (mesma logo do sistema)
  useEffect(() => {
    const loadFavicon = async () => {
      try {
        const response = await api.get('/public/logo');
        if (response.data?.logo) {
          const assetsHost = getApiBaseUrl();
          const logoUrl = buildFileUrl(response.data.logo) || `${assetsHost}${response.data.logo}`;
          
          // Atualizar o favicon
          let link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']");
          if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.head.appendChild(link);
          }
          link.href = logoUrl;
          console.log('🎨 Favicon atualizado com logo do sistema:', logoUrl);
        } else {
          console.log('🎨 Usando favicon padrão (WhatsApp)');
        }
      } catch (error) {
        console.error('❌ Erro ao carregar favicon:', error);
        // Em caso de erro, mantém o favicon padrão
      }
    };

    loadFavicon();
  }, []);
  
  // Inicializar frontend logger (executar apenas uma vez)
  useEffect(() => {
    // Garantir que o frontendLogger está inicializado
    if (typeof window !== 'undefined') {
      console.log('✅ Frontend Logger carregado e ativo');
      // Adicionar um log de teste
      console.info('Sistema iniciado - logs do frontend sendo capturados');
    }
  }, []);
  
  // Capturar navegação entre páginas
  useEffect(() => {
    const handleRouteChange = (url: string) => {
      logger.logPageView(url);
    };

    // Detectar se é um refresh
    const handleBeforeUnload = () => {
      logger.logPageRefresh(router.pathname);
    };

    // Log da página inicial
    logger.logPageView(router.pathname);

    router.events.on('routeChangeComplete', handleRouteChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [router]);
  
  // Rotas públicas (sem autenticação)
  const publicRoutes = ['/login', '/registro', '/site', '/landing'];
  const isPublicRoute = publicRoutes.includes(router.pathname) || router.pathname.toLowerCase() === '/site';
  
  // Se é rota pública, renderiza sem proteção
  if (isPublicRoute) {
    return (
      <NotificationProvider>
        <AuthProvider>
          <Component {...pageProps} />
        </AuthProvider>
      </NotificationProvider>
    );
  }
  
  // Rotas de Super Admin (requerem autenticação + role super_admin)
  const isSuperAdminRoute = router.pathname.startsWith('/admin/');
  
  if (isSuperAdminRoute) {
    return (
      <NotificationProvider>
        <AuthProvider>
          <ProtectedRoute requireSuperAdmin={true}>
            <Component {...pageProps} />
          </ProtectedRoute>
        </AuthProvider>
      </NotificationProvider>
    );
  }
  
  // Rotas sem layout mas COM autenticação (têm seu próprio design)
  const noLayoutRoutes = ['/', '/configuracoes/webhook', '/perfil', '/gestao', '/tutoriais', '/planos', '/checkout', '/mudar-plano', '/escolher-plano', '/chat'];
  const isNoLayoutRoute = noLayoutRoutes.includes(router.pathname);
  
  if (isNoLayoutRoute) {
    return (
      <NotificationProvider>
        <AuthProvider>
          <ProtectedRoute>
            <Component {...pageProps} />
          </ProtectedRoute>
        </AuthProvider>
      </NotificationProvider>
    );
  }
  
  // Rotas do WhatsApp QR Connect - COM cabeçalho UAZ e autenticação
  const isUazRoute = router.pathname.startsWith('/uaz/') || 
                     router.pathname.startsWith('/qr-') || 
                     router.pathname === '/dashboard-uaz' ||
                     router.pathname === '/configuracoes-uaz';
  
  if (isUazRoute) {
    return (
      <NotificationProvider>
        <AuthProvider>
          <ProtectedRoute>
            <LayoutUaz>
              <Component {...pageProps} />
            </LayoutUaz>
          </ProtectedRoute>
        </AuthProvider>
      </NotificationProvider>
    );
  }
  
  // Rotas da API Oficial - COM cabeçalho API Oficial e autenticação
  return (
    <NotificationProvider>
      <AuthProvider>
        <ProtectedRoute>
          <Layout>
            <Component {...pageProps} />
          </Layout>
        </ProtectedRoute>
      </AuthProvider>
    </NotificationProvider>
  );
}


