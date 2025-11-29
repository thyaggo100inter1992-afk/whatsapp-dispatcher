import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { usePermissions } from '../hooks/usePermissions';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: string;
  fallbackPath?: string;
  requireSuperAdmin?: boolean;
}

export default function ProtectedRoute({ 
  children, 
  requiredPermission,
  fallbackPath = '/',
  requireSuperAdmin = false,
}: ProtectedRouteProps) {
  const router = useRouter();
  const { hasPermission, loading } = usePermissions();
  const { user, loading: authLoading } = useAuth();
  const isLoading = loading || authLoading;

  useEffect(() => {
    if (!isLoading && requireSuperAdmin) {
      // Se estiver saindo da aplicação (user null), não mostrar alerta
      if (!user) {
        return;
      }

      const isSuperAdmin = user.role === 'super_admin';
      if (!isSuperAdmin) {
        alert('❌ Apenas super administradores podem acessar esta área.');
        router.push(fallbackPath);
      }
    }
  }, [isLoading, requireSuperAdmin, user, router, fallbackPath]);

  useEffect(() => {
    if (!isLoading && requiredPermission) {
      const allowed = hasPermission(requiredPermission);
      
      if (!allowed) {
        alert(`❌ Você não tem permissão para acessar "${requiredPermission}".\n\nContate o administrador do seu tenant.`);
        router.push(fallbackPath);
      }
    }
  }, [isLoading, hasPermission, requiredPermission, router, fallbackPath]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-primary-500 border-solid mx-auto mb-4"></div>
          <p className="text-white text-lg">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  if (requireSuperAdmin && user?.role !== 'super_admin') {
    return null;
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return null;
  }

  return <>{children}</>;
}
