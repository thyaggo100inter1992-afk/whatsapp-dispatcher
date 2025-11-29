import { ReactNode } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { 
  FaBuilding, FaSignOutAlt, FaUser, FaTachometerAlt, FaCreditCard,
  FaChartBar, FaServer, FaDesktop, FaCloudUploadAlt, FaCog, FaUserCircle, FaVideo, FaFileInvoiceDollar, FaGlobe, FaShieldAlt
} from 'react-icons/fa';
import { useAuth } from '@/contexts/AuthContext';
import SystemLogo from '@/components/SystemLogo';
import { buildFileUrl } from '@/utils/urlHelpers';

interface AdminLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  currentPage: string;
}

export default function AdminLayout({ children, title, subtitle, icon, currentPage }: AdminLayoutProps) {
  const router = useRouter();
  const { user, signOut } = useAuth();

  const handleLogout = () => {
    signOut();
    router.push('/login');
  };

  // Construir URL do avatar sem gerar mixed-content
  const getAvatarUrl = () => {
    if (!user?.avatar) return null;

    if (user.avatar.startsWith('http')) {
      return user.avatar;
    }

    if (user.avatar.startsWith('/uploads')) {
      return buildFileUrl(user.avatar);
    }

    return buildFileUrl(`/uploads/avatars/${user.avatar}`);
  };

  const menuItems = [
    { href: '/admin/dashboard', label: 'Dashboard', icon: <FaTachometerAlt />, page: 'dashboard' },
    { href: '/admin/tenants', label: 'Tenants', icon: <FaBuilding />, page: 'tenants' },
    { href: '/admin/master-users', label: 'Usuários Master', icon: <FaShieldAlt />, page: 'master-users' },
    { href: '/admin/plans', label: 'Planos', icon: <FaCreditCard />, page: 'plans' },
    { href: '/admin/landing-page', label: 'Landing Page', icon: <FaGlobe />, page: 'landing' },
    { href: '/admin/relatorios-financeiros', label: 'Relatórios Financeiros', icon: <FaFileInvoiceDollar />, page: 'relatorios-financeiros' },
    { href: '/admin/credentials', label: 'Credenciais', icon: <FaCog />, page: 'credentials' },
    { href: '/admin/configuracoes', label: 'Configurações', icon: <FaCog />, page: 'configuracoes' },
    { href: '/admin/logs', label: 'Auditoria', icon: <FaChartBar />, page: 'logs' },
    { href: '/admin/logs-backend', label: 'Backend', icon: <FaServer />, page: 'logs-backend' },
    { href: '/admin/logs-frontend', label: 'Frontend', icon: <FaDesktop />, page: 'logs-frontend' },
    { href: '/admin/arquivos', label: 'Arquivos', icon: <FaCloudUploadAlt />, page: 'arquivos' },
    { href: '/admin/tutoriais', label: 'Tutoriais', icon: <FaVideo />, page: 'tutoriais' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <header className="bg-gradient-to-r from-purple-900 via-purple-800 to-indigo-900 border-b-4 border-purple-500 shadow-2xl">
        <div className="max-w-7xl mx-auto px-6 py-4">
          {/* Logo do Sistema */}
          <div className="mb-4 flex justify-center">
            <SystemLogo size="medium" />
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-purple-600 p-3 rounded-xl shadow-lg">
                {icon || <FaTachometerAlt className="text-3xl text-white" />}
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">{title}</h1>
                {subtitle && <p className="text-purple-200 text-sm">{subtitle}</p>}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/admin/perfil')}
                className="flex items-center gap-2 px-4 py-2 bg-purple-700/50 hover:bg-purple-600/50 rounded-lg transition-all"
              >
                {getAvatarUrl() ? (
                  <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-purple-400">
                    <img
                      src={getAvatarUrl() || ''}
                      alt={user?.nome || 'Admin'}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center">
                    <FaUser className="text-white text-sm" />
                  </div>
                )}
                <div className="text-left">
                  <p className="text-white text-sm font-medium">
                    {user?.nome || 'Super Admin'}
                  </p>
                  <p className="text-purple-200 text-xs">Super Administrador</p>
                </div>
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-bold transition-all flex items-center gap-2 shadow-lg hover:shadow-xl"
              >
                <FaSignOutAlt /> Sair
              </button>
            </div>
          </div>

          {/* Menu de Navegação */}
          <nav className="mt-4 flex gap-2 flex-wrap">
            {menuItems.map((item) => (
              <Link
                key={item.page}
                href={item.href}
                className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all ${
                  currentPage === item.page
                    ? 'bg-purple-600 text-white shadow-lg'
                    : 'bg-purple-700/50 hover:bg-purple-600 text-white'
                }`}
              >
                {item.icon} {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-7xl mx-auto p-6">
        {children}
      </div>
    </div>
  );
}
