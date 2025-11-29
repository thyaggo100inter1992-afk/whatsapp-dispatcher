import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  FaChartBar, FaCheckCircle, FaTimesCircle,
  FaFilter, FaSearch, FaInfoCircle, FaTrash, FaTimes
} from 'react-icons/fa';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/services/api';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import AdminLayout from '@/components/admin/AdminLayout';
import { ToastContainer, useToast } from '@/components/Toast';

interface Log {
  id: number;
  tenant_id: number;
  user_id: number;
  acao: string;
  entidade: string;
  entidade_id: number | null;
  dados_antes: any | null;
  dados_depois: any | null;
  ip_address: string | null;
  user_agent: string | null;
  metodo_http: string | null;
  url_path: string | null;
  sucesso: boolean;
  erro_mensagem: string | null;
  created_at: string;
  tenant_nome: string;
  user_nome: string;
  user_email: string;
}

interface LogsStats {
  totalLogs: number;
  last24h: number;
  successCount: number;
  errorCount: number;
  topActions: Array<{ acao: string; count: string }>;
  topTenants: Array<{ nome: string; count: string }>;
}

interface Tenant {
  id: number;
  nome: string;
  slug: string;
  status: string;
}

export default function AdminLogs() {
  const router = useRouter();
  const { signOut } = useAuth();
  const { notifications, showNotification, removeNotification } = useToast();
  const [logs, setLogs] = useState<Log[]>([]);
  const [stats, setStats] = useState<LogsStats | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [totalLogs, setTotalLogs] = useState(0);
  const [filter, setFilter] = useState({
    acao: '',
    tenant_id: '',
    sucesso: ''
  });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePeriod, setDeletePeriod] = useState('24h');

  useEffect(() => {
    loadTenants();
    loadStats();
    loadLogs();
  }, [filter]);

  const loadTenants = async () => {
    try {
      const response = await api.get('/admin/tenants');
      setTenants(response.data.data);
    } catch (error: any) {
      console.error('Erro ao carregar tenants:', error);
    }
  };

  const loadStats = async () => {
    try {
      const response = await api.get('/admin/logs/stats');
      setStats(response.data.data);
    } catch (error: any) {
      console.error('Erro ao carregar estatísticas:', error);
    }
  };

  const loadLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filter.acao) params.append('acao', filter.acao);
      if (filter.tenant_id) params.append('tenant_id', filter.tenant_id);
      if (filter.sucesso) params.append('sucesso', filter.sucesso);
      
      const response = await api.get(`/admin/logs?${params.toString()}`);
      setLogs(response.data.data.logs);
      setTotalLogs(response.data.data.total);
      setError('');
    } catch (error: any) {
      console.error('Erro ao carregar logs:', error);
      if (error.response?.status === 403) {
        setError('Acesso negado. Apenas super administradores podem acessar esta página.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    signOut();
    router.push('/login');
  };

  const handleDeleteLogs = async () => {
    try {
      const response = await api.delete(`/admin/logs/bulk?period=${deletePeriod}`);
      if (response.data.success) {
        showNotification(`✅ ${response.data.deletedCount} logs apagados!`, 'success');
        setShowDeleteModal(false);
        loadLogs();
        loadStats();
      }
    } catch (error: any) {
      console.error('Erro ao deletar logs:', error);
      showNotification('❌ Erro ao deletar logs', 'error');
    }
  };

  const getAcaoColor = (acao: string) => {
    const colors: Record<string, string> = {
      // Autenticação
      'login': 'bg-blue-500/20 text-blue-300 border-blue-500',
      'logout': 'bg-gray-500/20 text-gray-300 border-gray-500',
      'register': 'bg-purple-500/20 text-purple-300 border-purple-500',
      // Navegação
      'page_view': 'bg-cyan-500/20 text-cyan-300 border-cyan-500',
      'page_refresh': 'bg-teal-500/20 text-teal-300 border-teal-500',
      // Interações
      'button_click': 'bg-indigo-500/20 text-indigo-300 border-indigo-500',
      'form_submit': 'bg-violet-500/20 text-violet-300 border-violet-500',
      // CRUD
      'create': 'bg-green-500/20 text-green-300 border-green-500',
      'update': 'bg-yellow-500/20 text-yellow-300 border-yellow-500',
      'delete': 'bg-red-500/20 text-red-300 border-red-500',
      // Sistema
      'error': 'bg-red-600/20 text-red-300 border-red-600',
      'api_request': 'bg-orange-500/20 text-orange-300 border-orange-500'
    };
    return colors[acao] || 'bg-gray-500/20 text-gray-300 border-gray-500';
  };

  if (error) {
    return (
      <AdminLayout
        title="Logs e Monitoramento"
        subtitle="Visualize atividades do sistema"
        icon={<FaChartBar className="text-3xl text-white" />}
        currentPage="auditoria"
      >
        <div className="bg-red-500/20 border-2 border-red-500 rounded-xl p-8">
          <h2 className="text-2xl font-bold text-red-400 mb-4">⚠️ Erro de Acesso</h2>
          <p className="text-white mb-6">{error}</p>
          <button
            onClick={handleLogout}
            className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold transition-all"
          >
            Fazer Logout
          </button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="Logs e Monitoramento"
      subtitle="Visualize atividades do sistema"
      icon={<FaChartBar className="text-3xl text-white" />}
      currentPage="auditoria"
    >

      {/* Content */}
      <div className="space-y-6">
        {/* Estatísticas */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl p-6 shadow-xl">
              <h3 className="text-blue-100 text-sm font-medium">Total de Logs</h3>
              <p className="text-4xl font-bold text-white mt-2">{stats.totalLogs}</p>
              <p className="text-blue-200 text-xs mt-1">Registros totais</p>
            </div>

            <div className="bg-gradient-to-br from-green-500 to-green-700 rounded-xl p-6 shadow-xl">
              <h3 className="text-green-100 text-sm font-medium">Últimas 24h</h3>
              <p className="text-4xl font-bold text-white mt-2">{stats.last24h}</p>
              <p className="text-green-200 text-xs mt-1">Ações recentes</p>
            </div>

            <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-xl p-6 shadow-xl">
              <h3 className="text-emerald-100 text-sm font-medium">Sucessos</h3>
              <p className="text-4xl font-bold text-white mt-2">{stats.successCount}</p>
              <p className="text-emerald-200 text-xs mt-1">Ações completadas</p>
            </div>

            <div className="bg-gradient-to-br from-red-500 to-red-700 rounded-xl p-6 shadow-xl">
              <h3 className="text-red-100 text-sm font-medium">Erros</h3>
              <p className="text-4xl font-bold text-white mt-2">{stats.errorCount}</p>
              <p className="text-red-200 text-xs mt-1">Ações com falha</p>
            </div>
          </div>
        )}

        {/* Filtros */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 shadow-xl border-2 border-purple-500/30">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <FaFilter className="text-purple-400" />
            Filtros
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Tenant (Empresa)</label>
              <select
                value={filter.tenant_id}
                onChange={(e) => setFilter({ ...filter, tenant_id: e.target.value })}
                className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-purple-500 focus:outline-none"
              >
                <option value="">Todos os Tenants</option>
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.nome} ({tenant.slug})
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Ação</label>
              <select
                value={filter.acao}
                onChange={(e) => setFilter({ ...filter, acao: e.target.value })}
                className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-purple-500 focus:outline-none"
              >
                <option value="">Todas as Ações</option>
                <optgroup label="Autenticação">
                  <option value="login">Login</option>
                  <option value="logout">Logout</option>
                  <option value="register">Registro</option>
                </optgroup>
                <optgroup label="Navegação">
                  <option value="page_view">Visualizar Página</option>
                  <option value="page_refresh">Atualizar Página</option>
                </optgroup>
                <optgroup label="Interações">
                  <option value="button_click">Clique em Botão</option>
                  <option value="form_submit">Envio de Formulário</option>
                </optgroup>
                <optgroup label="CRUD">
                  <option value="create">Criar</option>
                  <option value="update">Atualizar</option>
                  <option value="delete">Deletar</option>
                </optgroup>
                <optgroup label="Sistema">
                  <option value="error">Erro</option>
                  <option value="api_request">Requisição API</option>
                </optgroup>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Status</label>
              <select
                value={filter.sucesso}
                onChange={(e) => setFilter({ ...filter, sucesso: e.target.value })}
                className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-purple-500 focus:outline-none"
              >
                <option value="">Todos os Status</option>
                <option value="true">Apenas Sucessos</option>
                <option value="false">Apenas Erros</option>
              </select>
            </div>
          </div>

          {/* Filtros Ativos e Botão Limpar */}
          {(filter.tenant_id || filter.acao || filter.sucesso) && (
            <div className="mt-4 flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2 text-gray-300">
                <FaInfoCircle className="text-blue-400" />
                <span className="text-sm font-medium">Filtros ativos:</span>
              </div>
              
              {filter.tenant_id && (
                <span className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-lg text-sm border border-purple-500">
                  Tenant: {tenants.find(t => t.id.toString() === filter.tenant_id)?.nome}
                </span>
              )}
              
              {filter.acao && (
                <span className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-lg text-sm border border-blue-500">
                  Ação: {filter.acao}
                </span>
              )}
              
              {filter.sucesso && (
                <span className={`px-3 py-1 rounded-lg text-sm border ${
                  filter.sucesso === 'true' 
                    ? 'bg-green-500/20 text-green-300 border-green-500' 
                    : 'bg-red-500/20 text-red-300 border-red-500'
                }`}>
                  {filter.sucesso === 'true' ? 'Apenas Sucessos' : 'Apenas Erros'}
                </span>
              )}
              
              <button
                onClick={() => setFilter({ acao: '', tenant_id: '', sucesso: '' })}
                className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg border border-red-500 transition-all flex items-center gap-2"
              >
                <FaTimesCircle /> Limpar Todos
              </button>
            </div>
          )}
        </div>

        {/* Tabela de Logs */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-xl border-2 border-purple-500/30 overflow-hidden">
          <div className="p-6 flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <FaSearch className="text-purple-400" />
              Logs de Auditoria
            </h2>
            <div className="flex items-center gap-4">
              {!loading && (
                <span className="text-gray-400 text-sm">
                  {totalLogs} {totalLogs === 1 ? 'registro encontrado' : 'registros encontrados'}
                </span>
              )}
              <button
                onClick={() => setShowDeleteModal(true)}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-bold transition-all flex items-center gap-2"
              >
                <FaTrash /> Apagar Logs
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-purple-900/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-purple-200 uppercase tracking-wider">Data/Hora</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-purple-200 uppercase tracking-wider">Ação</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-purple-200 uppercase tracking-wider">Usuário</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-purple-200 uppercase tracking-wider">Tenant</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-purple-200 uppercase tracking-wider">Entidade</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-purple-200 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-400">
                      Carregando logs...
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-400">
                      <FaInfoCircle className="inline mr-2" />
                      Nenhum log encontrado
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-700/30 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getAcaoColor(log.acao)}`}>
                          {log.acao}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="text-white font-medium">{log.user_nome}</div>
                        <div className="text-gray-400 text-xs">{log.user_email}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-300">{log.tenant_nome || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-300">{log.entidade || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {log.sucesso ? (
                          <span className="flex items-center gap-1 text-green-400">
                            <FaCheckCircle /> Sucesso
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-red-400">
                            <FaTimesCircle /> Erro
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal de Exclusão de Logs */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-xl shadow-2xl border-2 border-red-500/50 max-w-md w-full p-6">
              <h3 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                <FaTrash className="text-red-500" />
                Apagar Logs por Período
              </h3>
              
              <p className="text-gray-300 mb-6">
                Selecione o período dos logs que deseja apagar. Esta ação não pode ser desfeita.
              </p>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Período:
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-3 bg-gray-700/50 rounded-lg cursor-pointer hover:bg-gray-700 transition-all">
                    <input
                      type="radio"
                      name="period"
                      value="24h"
                      checked={deletePeriod === '24h'}
                      onChange={(e) => setDeletePeriod(e.target.value)}
                      className="w-4 h-4 text-red-500 focus:ring-red-500"
                    />
                    <span className="text-white">Últimas 24 horas</span>
                  </label>
                  
                  <label className="flex items-center gap-3 p-3 bg-gray-700/50 rounded-lg cursor-pointer hover:bg-gray-700 transition-all">
                    <input
                      type="radio"
                      name="period"
                      value="7d"
                      checked={deletePeriod === '7d'}
                      onChange={(e) => setDeletePeriod(e.target.value)}
                      className="w-4 h-4 text-red-500 focus:ring-red-500"
                    />
                    <span className="text-white">Últimos 7 dias</span>
                  </label>
                  
                  <label className="flex items-center gap-3 p-3 bg-gray-700/50 rounded-lg cursor-pointer hover:bg-gray-700 transition-all">
                    <input
                      type="radio"
                      name="period"
                      value="30d"
                      checked={deletePeriod === '30d'}
                      onChange={(e) => setDeletePeriod(e.target.value)}
                      className="w-4 h-4 text-red-500 focus:ring-red-500"
                    />
                    <span className="text-white">Últimos 30 dias</span>
                  </label>
                  
                  <label className="flex items-center gap-3 p-3 bg-gray-700/50 rounded-lg cursor-pointer hover:bg-gray-700 transition-all">
                    <input
                      type="radio"
                      name="period"
                      value="all"
                      checked={deletePeriod === 'all'}
                      onChange={(e) => setDeletePeriod(e.target.value)}
                      className="w-4 h-4 text-red-500 focus:ring-red-500"
                    />
                    <span className="text-white font-bold">Todos os logs (CUIDADO!)</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 px-4 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-bold transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteLogs}
                  className="flex-1 px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-bold transition-all flex items-center justify-center gap-2"
                >
                  <FaTrash /> Confirmar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* 🔔 NOTIFICAÇÕES TOAST */}
      <ToastContainer notifications={notifications} onRemove={removeNotification} />
    </AdminLayout>
  );
}
