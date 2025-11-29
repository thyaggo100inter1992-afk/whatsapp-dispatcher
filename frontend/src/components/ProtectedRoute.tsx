import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { usePermissions } from '../hooks/usePermissions';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: string;
  fallbackPath?: string;
}

export default function ProtectedRoute({ 
  children, 
  requiredPermission,
  fallbackPath = '/'
}: ProtectedRouteProps) {
  const router = useRouter();
  const { hasPermission, loading } = usePermissions();

  useEffect(() => {
    if (!loading && requiredPermission) {
      const allowed = hasPermission(requiredPermission);
      
      if (!allowed) {
        alert(`❌ Você não tem permissão para acessar "${requiredPermission}".\n\nContate o administrador do seu tenant.`);
        router.push(fallbackPath);
      }
    }
  }, [loading, hasPermission, requiredPermission, router, fallbackPath]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-primary-500 border-solid mx-auto mb-4"></div>
          <p className="text-white text-lg">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return null;
  }

  return <>{children}</>;
}
