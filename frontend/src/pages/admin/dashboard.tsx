import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  FaBuilding, FaUsers, FaChartLine, FaCreditCard, FaWhatsapp, 
  FaCog, FaTachometerAlt
} from 'react-icons/fa';
import AdminLayout from '@/components/admin/AdminLayout';
import api from '@/services/api';

interface SystemStats {
  totalTenants: number;
  totalUsers: number;
  totalAccounts: number;
  plansDistribution: Array<{
    plan_name: string;
    count: string;
  }>;
}

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/plans/stats');
      setStats(response.data.data);
      setError('');
    } catch (error: any) {
      console.error('Erro ao carregar estatísticas:', error);
      if (error.response?.status === 403) {
        setError('Acesso negado. Apenas super administradores podem acessar esta página.');
      } else {
        setError('Erro ao carregar estatísticas');
      }
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    return (
      <AdminLayout
        title="Super Admin"
        subtitle="Painel de Controle Administrativo"
        icon={<FaTachometerAlt className="text-3xl text-white" />}
        currentPage="dashboard"
      >
        <div className="bg-red-500/20 border-2 border-red-500 rounded-xl p-8">
          <h2 className="text-2xl font-bold text-red-400 mb-4">⚠️ Erro de Acesso</h2>
          <p className="text-white mb-6">{error}</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="Super Admin"
      subtitle="Painel de Controle Administrativo"
      icon={<FaTachometerAlt className="text-3xl text-white" />}
      currentPage="dashboard"
    >
      {loading ? (
        <div className="text-center py-20">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-4 border-purple-500"></div>
          <p className="text-white mt-4 text-xl">Carregando estatísticas...</p>
        </div>
      ) : stats ? (
        <div className="space-y-6">
          {/* Cards de Estatísticas Gerais */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm font-medium">Total de Tenants</p>
                  <p className="text-4xl font-bold text-white mt-2">{stats.totalTenants}</p>
                  <p className="text-blue-200 text-xs mt-1">Empresas cadastradas</p>
                </div>
                <FaBuilding className="text-5xl text-blue-200/50" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-500 to-green-700 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm font-medium">Total de Usuários</p>
                  <p className="text-4xl font-bold text-white mt-2">{stats.totalUsers}</p>
                  <p className="text-green-200 text-xs mt-1">Todos os tenants</p>
                </div>
                <FaUsers className="text-5xl text-green-200/50" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-500 to-purple-700 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-sm font-medium">Contas WhatsApp</p>
                  <p className="text-4xl font-bold text-white mt-2">{stats.totalAccounts}</p>
                  <p className="text-purple-200 text-xs mt-1">Conectadas</p>
                </div>
                <FaWhatsapp className="text-5xl text-purple-200/50" />
              </div>
            </div>
          </div>

          {/* Estatísticas por Plano */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 shadow-xl border-2 border-purple-500/30">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <FaCreditCard className="text-purple-400" />
              Distribuição por Plano
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {stats.plansDistribution && stats.plansDistribution.map((plano, index) => (
                <div 
                  key={index}
                  className="bg-gray-700/50 rounded-xl p-4 border-2 border-gray-600 hover:border-purple-400 transition-all"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-bold text-white">{plano.plan_name}</h3>
                    <FaCreditCard className="text-purple-400 text-xl" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-300 text-sm">Total de Tenants:</span>
                      <span className="text-white font-bold text-2xl">{plano.count}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Ações Rápidas */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 shadow-xl border-2 border-purple-500/30">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <FaCog className="text-purple-400" />
              Ações Rápidas
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link
                href="/admin/tenants"
                className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl p-6 hover:scale-105 transition-transform shadow-lg"
              >
                <FaBuilding className="text-4xl text-white mb-3" />
                <h3 className="text-xl font-bold text-white mb-2">Gerenciar Tenants</h3>
                <p className="text-blue-200 text-sm">Visualize e edite todos os tenants do sistema</p>
              </Link>

              <Link
                href="/admin/plans"
                className="bg-gradient-to-br from-purple-600 to-purple-800 rounded-xl p-6 hover:scale-105 transition-transform shadow-lg"
              >
                <FaCreditCard className="text-4xl text-white mb-3" />
                <h3 className="text-xl font-bold text-white mb-2">Gerenciar Planos</h3>
                <p className="text-purple-200 text-sm">Crie e configure planos de assinatura</p>
              </Link>

              <Link
                href="/admin/logs"
                className="bg-gradient-to-br from-orange-600 to-orange-800 rounded-xl p-6 hover:scale-105 transition-transform shadow-lg"
              >
                <FaChartLine className="text-4xl text-white mb-3" />
                <h3 className="text-xl font-bold text-white mb-2">Ver Logs</h3>
                <p className="text-orange-200 text-sm">Monitore atividades do sistema</p>
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-20">
          <p className="text-gray-400 text-xl">Nenhuma estatística disponível</p>
        </div>
      )}
    </AdminLayout>
  );
}
