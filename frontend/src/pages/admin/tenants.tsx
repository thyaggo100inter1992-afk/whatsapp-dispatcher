import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { FaBuilding, FaUsers, FaEdit, FaTrash, FaCheckCircle, FaBan, FaPlus, FaFilter, FaGlobe, FaWhatsapp, FaQrcode, FaSignOutAlt, FaArrowLeft, FaCreditCard } from 'react-icons/fa';
import api from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/admin/AdminLayout';
import { useNotification } from '@/hooks/useNotification';
import { useConfirm } from '@/hooks/useConfirm';

interface Tenant {
  id: number;
  nome: string;
  slug: string;
  email: string;
  telefone: string | null;
  documento: string | null;
  plano: string;
  plan_id: number | null;
  plano_nome: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  trial_ends_at: string | null;
  is_trial: boolean;
  has_paid_plan: boolean;
  total_usuarios: number;
  total_contas: number;
  total_contas_qr: number;
  total_campanhas: number;
  total_campanhas_qr: number;
}

interface TenantStats {
  total_usuarios: number;
  total_contas: number;
  total_campanhas: number;
  total_campanhas_qr: number;
  total_mensagens: number;
  total_templates: number;
  total_contatos: number;
  resumo?: {
    total_usuarios: number;
    total_contas: number;
    total_campanhas: number;
    total_mensagens: number;
    total_templates: number;
    total_contatos: number;
  };
  usuarios?: {
    total: number;
    ativos: number;
    inativos: number;
    admins: number;
    usuarios_normais: number;
  };
  contas?: {
    total: number;
    api?: {
      total: number;
      ativas: number;
      inativas: number;
    };
    qr?: {
      total: number;
      conectadas: number;
      desconectadas: number;
    };
  };
  campanhas_api?: {
    total: number;
    agendadas: number;
    em_andamento: number;
    pausadas: number;
    concluidas: number;
    canceladas: number;
  };
  campanhas_qr?: {
    total: number;
    agendadas: number;
    em_andamento: number;
    pausadas: number;
    concluidas: number;
    canceladas: number;
  };
  mensagens?: {
    total: number;
    api?: {
      total: number;
      enviadas: number;
      entregues: number;
      lidas: number;
      erro: number;
      pendentes: number;
    };
    qr?: {
      total: number;
      enviadas: number;
      entregues: number;
      lidas: number;
      erro: number;
      pendentes: number;
    };
  };
  templates?: {
    total: number;
    api?: {
      total: number;
      aprovados: number;
    };
    qr?: {
      total: number;
      ativos: number;
    };
  };
  base_dados?: {
    total_contatos: number;
    importados_esta_semana: number;
  };
  nova_vida?: {
    total_consultas: number;
    consultas_este_mes: number;
  };
  lista_restricao?: {
    total_bloqueados: number;
  };
  arquivos?: {
    total: number;
    tamanho_total_mb: number;
  };
  webhooks?: {
    total_configurados: number;
  };
  logs?: {
    total: number;
    esta_semana: number;
  };
}

export default function AdminTenants() {
  const router = useRouter();
  const { signOut } = useAuth();
  const notification = useNotification();
  const { confirm, ConfirmDialog } = useConfirm();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [viewingStats, setViewingStats] = useState<number | null>(null);
  const [stats, setStats] = useState<TenantStats | null>(null);
  const [error, setError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [planoFilter, setPlanoFilter] = useState<string>('todos'); // 'todos', 'teste', 'pago'
  const [statusFilter, setStatusFilter] = useState<string>('todos'); // 'todos', 'active', 'inactive'
  const [paymentFilter, setPaymentFilter] = useState<string>('todos'); // 'todos', 'trial', 'pago'

  const [editForm, setEditForm] = useState({
    nome: '',
    email: '',
    telefone: '',
    documento: '',
    plano: 'basico',
    plan_id: null as number | null,
    status: 'active',
    limites_customizados: false,
    limite_usuarios_customizado: null as number | null,
    limite_whatsapp_customizado: null as number | null,
    limite_campanhas_simultaneas_customizado: null as number | null,
    limite_mensagens_dia_customizado: null as number | null,
    limite_novavida_mes_customizado: null as number | null,
    funcionalidades_customizadas: false,
    funcionalidades_config: {
      whatsapp_api: true,
      whatsapp_qr: true,
      campanhas: true,
      templates: true,
      base_dados: true,
      nova_vida: true,
      lista_restricao: true,
      webhooks: true,
      catalogo: true,
      dashboard: true,
      relatorios: true,
      envio_imediato: true
    }
  });

  const [createForm, setCreateForm] = useState({
    nome: '',
    email: '',
    telefone: '',
    documento: '',
    plano: 'basico',
    plan_id: null as number | null,
    senha_admin: ''
  });
  
  const [plans, setPlans] = useState<any[]>([]);

  useEffect(() => {
    loadTenants();
    loadPlans();
  }, []);
  
  const loadPlans = async () => {
    try {
      const response = await api.get('/admin/plans');
      setPlans(response.data.data);
    } catch (error: any) {
      console.error('Erro ao carregar planos:', error);
    }
  };

  const loadTenants = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/tenants');
      setTenants(response.data.data);
      setError('');
    } catch (error: any) {
      console.error('Erro ao carregar tenants:', error);
      if (error.response?.status === 403) {
        setError('Acesso negado. Apenas super administradores podem acessar esta página.');
      } else {
        setError('Erro ao carregar tenants: ' + (error.response?.data?.message || error.message));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    signOut();
    router.push('/login');
  };

  const handleOpenCreateModal = () => {
    setCreateForm({
      nome: '',
      email: '',
      telefone: '',
      documento: '',
      plano: 'basico',
      plan_id: null,
      senha_admin: ''
    });
    setIsCreating(true);
  };

  const handleCreateTenant = async () => {
    if (!createForm.nome || !createForm.email) {
      notification.warning('Campos obrigatórios', 'Nome e email são obrigatórios!');
      return;
    }

    if (!createForm.senha_admin) {
      notification.warning('Senha obrigatória', 'A senha do administrador é obrigatória!');
      return;
    }

    try {
      await api.post('/admin/tenants', createForm);
      notification.success('Tenant criado!', `O tenant "${createForm.nome}" foi criado com sucesso.`);
      setIsCreating(false);
      loadTenants();
    } catch (error: any) {
      notification.error('Erro ao criar tenant', error.response?.data?.message || error.message);
    }
  };

  const handleEdit = (tenant: any) => {
    // Redirecionar para a página de detalhes do tenant
    router.push(`/admin/tenants/${tenant.id}`);
  };

  const handleSaveEdit = async () => {
    if (!editingTenant) return;

    try {
      await api.put(`/admin/tenants/${editingTenant.id}`, editForm);
      notification.success('Tenant atualizado!', `O tenant "${editingTenant.nome}" foi atualizado com sucesso.`);
      setEditingTenant(null);
      loadTenants();
    } catch (error: any) {
      notification.error('Erro ao atualizar', error.response?.data?.message || error.message);
    }
  };

  const handleToggleStatus = async (id: number, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    const action = newStatus === 'active' ? 'ativar' : 'desativar';
    const tenant = tenants.find(t => t.id === id);
    
    const confirmed = await confirm({
      title: `${action.charAt(0).toUpperCase() + action.slice(1)} Tenant`,
      message: `Deseja realmente ${action} o tenant "${tenant?.nome}"?`,
      confirmText: action.charAt(0).toUpperCase() + action.slice(1),
      type: newStatus === 'active' ? 'info' : 'warning',
    });

    if (!confirmed) return;

    try {
      await api.patch(`/admin/tenants/${id}/status`, { status: newStatus });
      notification.success('Status alterado!', `O tenant foi ${action === 'ativar' ? 'ativado' : 'desativado'} com sucesso.`);
      loadTenants();
    } catch (error: any) {
      notification.error('Erro ao alterar status', error.response?.data?.message || error.message);
    }
  };

  const handleDelete = async (id: number, nome: string) => {
    const confirmed = await confirm({
      title: '⚠️ EXCLUSÃO PERMANENTE',
      message: (
        <>
          <p className="font-bold mb-3">Você está prestes a EXCLUIR PERMANENTEMENTE:</p>
          <p className="text-xl text-white font-black mb-4">"{nome}"</p>
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-3">
            <p className="font-semibold mb-2">Isso irá deletar TODOS OS DADOS:</p>
            <ul className="space-y-1 text-sm">
              <li>• Todos os usuários do tenant</li>
              <li>• Todas as contas WhatsApp (API e QR)</li>
              <li>• Todas as campanhas e mensagens</li>
              <li>• Todos os templates e contatos</li>
              <li>• Webhooks, logs e configurações</li>
            </ul>
          </div>
          <p className="text-red-400 font-bold">⚠️ ESTA AÇÃO NÃO PODE SER DESFEITA!</p>
        </>
      ),
      confirmText: 'Sim, EXCLUIR PERMANENTEMENTE',
      cancelText: 'Cancelar',
      type: 'danger',
    });

    if (!confirmed) return;

    try {
      const response = await api.delete(`/admin/tenants/${id}`);
      const stats = response.data.stats;
      
      const message = `Tenant "${stats.tenant_name}" excluído!\n\n` +
        `📊 Estatísticas:\n` +
        `• ${stats.users_deleted} usuários deletados\n` +
        `• ${stats.api_campaigns_deleted} campanhas API deletadas\n` +
        `• ${stats.qr_campaigns_deleted} campanhas QR deletadas\n` +
        `• ${stats.qr_instances_deleted} instâncias QR deletadas`;
      
      notification.success('Tenant excluído com sucesso!', message, 8000);
      loadTenants();
    } catch (error: any) {
      notification.error('Erro ao excluir tenant', error.response?.data?.message || error.message);
    }
  };

  const handleActivateAll = async () => {
    const confirmed = await confirm({
      title: 'Ativar TODAS as Empresas',
      message: `Deseja realmente ATIVAR TODAS as ${tenants.length} empresas do sistema?`,
      confirmText: 'Sim, Ativar Todas',
      type: 'info',
    });

    if (!confirmed) return;

    try {
      const promises = tenants.map(tenant => 
        api.patch(`/admin/tenants/${tenant.id}/status`, { status: 'active' })
      );
      await Promise.all(promises);
      notification.success('Empresas ativadas!', `Todas as ${tenants.length} empresas foram ATIVADAS com sucesso!`);
      loadTenants();
    } catch (error: any) {
      notification.error('Erro ao ativar empresas', error.response?.data?.message || error.message);
    }
  };

  const handleDeactivateAll = async () => {
    const confirmed = await confirm({
      title: 'Desativar TODAS as Empresas',
      message: (
        <>
          <p className="mb-3">Deseja realmente DESATIVAR TODAS as {tenants.length} empresas do sistema?</p>
          <p className="text-yellow-400 font-semibold">⚠️ Esta ação bloqueará o acesso de todos os tenants!</p>
        </>
      ),
      confirmText: 'Sim, Desativar Todas',
      type: 'warning',
    });

    if (!confirmed) return;

    try {
      const promises = tenants.map(tenant => 
        api.patch(`/admin/tenants/${tenant.id}/status`, { status: 'inactive' })
      );
      await Promise.all(promises);
      notification.warning('Empresas desativadas!', `Todas as ${tenants.length} empresas foram DESATIVADAS.`);
      loadTenants();
    } catch (error: any) {
      notification.error('Erro ao desativar empresas', error.response?.data?.message || error.message);
    }
  };

  const handleViewStats = async (id: number) => {
    try {
      setViewingStats(id);
      const response = await api.get(`/admin/tenants/${id}/stats`);
      setStats(response.data.data);
    } catch (error: any) {
      notification.error('Erro ao carregar estatísticas', error.response?.data?.message || error.message);
      setViewingStats(null);
    }
  };

  const getPlanoBadge = (plano: string) => {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      basico: { bg: 'bg-blue-500', text: 'text-blue-900', label: 'Básico' },
      pro: { bg: 'bg-purple-500', text: 'text-purple-900', label: 'Pro' },
      enterprise: { bg: 'bg-orange-500', text: 'text-orange-900', label: 'Enterprise' }
    };
    const badge = badges[plano] || badges.basico;
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-bold ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      active: { bg: 'bg-green-500', text: 'text-green-900', label: 'Ativo' },
      inactive: { bg: 'bg-yellow-500', text: 'text-yellow-900', label: 'Inativo' },
      deleted: { bg: 'bg-red-500', text: 'text-red-900', label: 'Excluído' }
    };
    const badge = badges[status] || badges.active;
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-bold ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
        <div className="bg-red-500/20 border-2 border-red-500 rounded-xl p-8 max-w-2xl">
          <h2 className="text-2xl font-bold text-red-400 mb-4">⚠️ Erro de Acesso</h2>
          <p className="text-white mb-6">{error}</p>
          
          <div className="bg-yellow-500/20 border-2 border-yellow-500/50 rounded-lg p-4 mb-6">
            <p className="text-yellow-300 font-semibold mb-2">💡 Dica:</p>
            <p className="text-yellow-200/80 text-sm">
              Você está logado com um usuário que não tem permissão. 
              Faça logout e entre com o Super Admin.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                signOut();
                router.push('/login');
              }}
              className="flex-1 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-bold transition-all flex items-center justify-center gap-2"
            >
              <FaSignOutAlt /> Fazer Logout
            </button>
            <button
              onClick={() => router.push('/')}
              className="flex-1 px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-bold transition-all flex items-center justify-center gap-2"
            >
              <FaArrowLeft /> Voltar
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-emerald-500 mx-auto"></div>
          <p className="text-white mt-4 text-lg">Carregando tenants...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <notification.NotificationContainer />
      <ConfirmDialog />
      <AdminLayout
        title="Administração de Tenants"
        subtitle="Gerenciar todas as empresas do sistema"
        icon={<FaBuilding className="text-3xl text-white" />}
        currentPage="tenants"
      >
        <div>
        {/* Botão Criar Tenant */}
        <div className="mb-6 flex justify-end">
          <button
            onClick={handleOpenCreateModal}
            className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-xl font-bold transition-all flex items-center gap-2 shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            <FaPlus /> Criar Novo Tenant
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border-2 border-blue-500/30 rounded-xl p-6">
            <p className="text-blue-300 text-sm font-semibold mb-2">Total de Tenants</p>
            <p className="text-4xl font-black text-white">{tenants.length}</p>
          </div>
          <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 border-2 border-green-500/30 rounded-xl p-6">
            <p className="text-green-300 text-sm font-semibold mb-2">Ativos</p>
            <p className="text-4xl font-black text-white">{tenants.filter(t => t.status === 'active').length}</p>
          </div>
          <div className="bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 border-2 border-yellow-500/30 rounded-xl p-6">
            <p className="text-yellow-300 text-sm font-semibold mb-2">Inativos</p>
            <p className="text-4xl font-black text-white">{tenants.filter(t => t.status === 'inactive').length}</p>
          </div>
          <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 border-2 border-purple-500/30 rounded-xl p-6">
            <p className="text-purple-300 text-sm font-semibold mb-2">Total de Usuários</p>
            <p className="text-4xl font-black text-white">{tenants.reduce((sum, t) => sum + parseInt(String(t.total_usuarios)), 0)}</p>
          </div>
        </div>

        {/* Filtros de Plano */}
        <div className="mb-6">
          <p className="text-gray-300 font-semibold mb-3 flex items-center gap-2">
            <FaFilter /> Filtrar por Plano:
          </p>
          
          {/* Filtros Gerais */}
          <div className="flex flex-wrap gap-3 mb-4">
            <button
              onClick={() => setPlanoFilter('todos')}
              className={`px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2 border-2 ${
                planoFilter === 'todos'
                  ? 'bg-emerald-500 text-white border-emerald-600 shadow-lg scale-105'
                  : 'bg-white/10 text-gray-300 border-white/20 hover:bg-white/20'
              }`}
            >
              <FaGlobe /> Todos ({tenants.length})
            </button>
            <button
              onClick={() => setPlanoFilter('teste')}
              className={`px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2 border-2 ${
                planoFilter === 'teste'
                  ? 'bg-orange-500 text-white border-orange-600 shadow-lg scale-105 animate-pulse'
                  : 'bg-orange-500/20 text-orange-300 border-orange-500/40 hover:bg-orange-500/30'
              }`}
            >
              ⚠️ Plano Teste ({tenants.filter(t => t.plano === 'teste').length})
            </button>
          </div>

          {/* Filtros por Planos Específicos */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <p className="text-gray-400 text-sm font-semibold mb-3">Planos Específicos:</p>
            <div className="flex flex-wrap gap-2">
              {plans.map((plan) => {
                const count = tenants.filter(t => t.plan_id === plan.id || t.plano_nome === plan.nome).length;
                const colors = {
                  'Básico': 'bg-blue-500/20 text-blue-300 border-blue-500/40 hover:bg-blue-500/30',
                  'Pro': 'bg-purple-500/20 text-purple-300 border-purple-500/40 hover:bg-purple-500/30',
                  'Enterprise': 'bg-pink-500/20 text-pink-300 border-pink-500/40 hover:bg-pink-500/30',
                  'Premium': 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40 hover:bg-yellow-500/30',
                  'Starter': 'bg-teal-500/20 text-teal-300 border-teal-500/40 hover:bg-teal-500/30',
                };
                const activeColors = {
                  'Básico': 'bg-blue-500 text-white border-blue-600',
                  'Pro': 'bg-purple-500 text-white border-purple-600',
                  'Enterprise': 'bg-pink-500 text-white border-pink-600',
                  'Premium': 'bg-yellow-500 text-white border-yellow-600',
                  'Starter': 'bg-teal-500 text-white border-teal-600',
                };
                
                const planNome = plan.nome as keyof typeof colors;
                return (
                  <button
                    key={plan.id}
                    onClick={() => setPlanoFilter(plan.id.toString())}
                    className={`px-4 py-2 rounded-lg font-bold transition-all flex items-center gap-2 border ${
                      planoFilter === plan.id.toString()
                        ? (activeColors[planNome] || 'bg-green-500 text-white border-green-600') + ' shadow-lg scale-105'
                        : (colors[planNome] || 'bg-green-500/20 text-green-300 border-green-500/40 hover:bg-green-500/30')
                    }`}
                    disabled={count === 0}
                  >
                    <FaCreditCard /> {plan.nome} ({count})
                  </button>
                );
              })}
              {plans.length === 0 && (
                <p className="text-gray-500 text-sm italic">Carregando planos...</p>
              )}
            </div>
          </div>
        </div>

        {/* Filtros de Status */}
        <div className="mb-6">
          <p className="text-gray-300 font-semibold mb-3 flex items-center gap-2">
            <FaFilter /> Filtrar por Status:
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setStatusFilter('todos')}
              className={`px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2 border-2 ${
                statusFilter === 'todos'
                  ? 'bg-emerald-500 text-white border-emerald-600 shadow-lg scale-105'
                  : 'bg-white/10 text-gray-300 border-white/20 hover:bg-white/20'
              }`}
            >
              <FaGlobe /> Todos ({tenants.length})
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2 border-2 ${
                statusFilter === 'active'
                  ? 'bg-green-500 text-white border-green-600 shadow-lg scale-105'
                  : 'bg-green-500/20 text-green-300 border-green-500/40 hover:bg-green-500/30'
              }`}
            >
              <FaCheckCircle /> Ativos ({tenants.filter(t => t.status === 'active').length})
            </button>
            <button
              onClick={() => setStatusFilter('inactive')}
              className={`px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2 border-2 ${
                statusFilter === 'inactive'
                  ? 'bg-red-500 text-white border-red-600 shadow-lg scale-105'
                  : 'bg-red-500/20 text-red-300 border-red-500/40 hover:bg-red-500/30'
              }`}
            >
              <FaBan /> Desativados ({tenants.filter(t => t.status === 'inactive').length})
            </button>
          </div>

          {/* Botões de Ação em Massa */}
          <div className="flex gap-3 mt-4">
            <button
              onClick={handleActivateAll}
              className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold transition-all flex items-center gap-2 shadow-lg"
            >
              <FaCheckCircle /> Ativar TODAS as Empresas
            </button>
            <button
              onClick={handleDeactivateAll}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-all flex items-center gap-2 shadow-lg"
            >
              <FaBan /> Desativar TODAS as Empresas
            </button>
          </div>
        </div>

        {/* Filtros de Pagamento (TRIAL vs PAGO) */}
        <div className="mb-6">
          <p className="text-gray-300 font-semibold mb-3 flex items-center gap-2">
            <FaCreditCard /> Filtrar por Tipo de Conta:
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setPaymentFilter('todos')}
              className={`px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2 border-2 ${
                paymentFilter === 'todos'
                  ? 'bg-indigo-500 text-white border-indigo-600 shadow-lg scale-105'
                  : 'bg-white/10 text-gray-300 border-white/20 hover:bg-white/20'
              }`}
            >
              <FaGlobe /> Todos ({tenants.length})
            </button>
            <button
              onClick={() => setPaymentFilter('trial')}
              className={`px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2 border-2 ${
                paymentFilter === 'trial'
                  ? 'bg-gradient-to-r from-yellow-500 to-orange-600 text-white border-yellow-400 shadow-lg scale-105'
                  : 'bg-gradient-to-r from-yellow-500/20 to-orange-600/10 text-yellow-300 border-yellow-500/40 hover:from-yellow-500/30 hover:to-orange-600/20'
              }`}
            >
              🆓 TRIAL ({tenants.filter(t => (t.is_trial || !t.has_paid_plan) && t.status !== 'inactive').length})
            </button>
            <button
              onClick={() => setPaymentFilter('pago')}
              className={`px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2 border-2 ${
                paymentFilter === 'pago'
                  ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white border-emerald-400 shadow-lg scale-105'
                  : 'bg-gradient-to-r from-emerald-500/20 to-green-600/10 text-emerald-300 border-emerald-500/40 hover:from-emerald-500/30 hover:to-green-600/20'
              }`}
            >
              💎 PAGO ({tenants.filter(t => t.has_paid_plan).length})
            </button>
          </div>
        </div>

        {/* Campo de Busca */}
        <div className="mb-6">
          <div className="relative">
            <input
              type="text"
              placeholder="🔍 Buscar tenant por nome, email ou slug..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-6 py-4 bg-white/10 border-2 border-white/20 rounded-xl text-white placeholder-gray-400 focus:border-emerald-500 focus:outline-none transition-all text-lg"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
              >
                ✖
              </button>
            )}
          </div>
          {searchTerm && (
            <p className="text-gray-400 text-sm mt-2">
              Encontrados: <span className="text-emerald-400 font-bold">{tenants.filter(t => 
                t.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                t.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                t.slug.toLowerCase().includes(searchTerm.toLowerCase())
              ).length}</span> tenant(s)
            </p>
          )}
        </div>

        {/* Tenants List */}
        <div className="space-y-4">
          {tenants
            .filter(t => {
              // Filtro de busca
              const matchesSearch = t.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
              t.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                t.slug.toLowerCase().includes(searchTerm.toLowerCase());
              
              // Filtro de plano
              let matchesPlano = true;
              if (planoFilter === 'todos') {
                matchesPlano = true;
              } else if (planoFilter === 'teste') {
                matchesPlano = t.plano === 'teste';
              } else {
                // Filtro por plano específico (plan_id)
                matchesPlano = t.plan_id === parseInt(planoFilter);
              }
              
              // Filtro de status
              let matchesStatus = true;
              if (statusFilter === 'active') {
                matchesStatus = t.status === 'active';
              } else if (statusFilter === 'inactive') {
                matchesStatus = t.status === 'inactive';
              }
              
              // Filtro de pagamento (TRIAL vs PAGO)
              let matchesPayment = true;
              if (paymentFilter === 'trial') {
                // TRIAL: não tem pagamento confirmado OU is_trial = true (e não está inativo)
                matchesPayment = (t.is_trial || !t.has_paid_plan) && t.status !== 'inactive';
              } else if (paymentFilter === 'pago') {
                // PAGO: tem pagamento confirmado
                matchesPayment = t.has_paid_plan === true;
              }
              
              return matchesSearch && matchesPlano && matchesStatus && matchesPayment;
            })
            .map((tenant) => {
              const isSuperJimmy = tenant.nome.toLowerCase().includes('super jimmy') || tenant.slug.toLowerCase().includes('super-jimmy');
              return (
            <div
              key={tenant.id}
              className={`rounded-2xl p-6 transition-all relative ${
                tenant.status === 'inactive'
                  ? 'bg-gradient-to-br from-red-500/20 to-gray-500/20 border-4 border-red-500 opacity-60 grayscale'
                  : isSuperJimmy
                  ? 'bg-gradient-to-br from-yellow-500/30 to-orange-500/20 border-4 border-yellow-400 shadow-2xl shadow-yellow-500/20'
                  : tenant.plano === 'teste'
                  ? 'bg-gradient-to-br from-orange-500/10 to-red-500/10 border-2 border-orange-500/50 hover:border-orange-500/70'
                  : 'bg-gradient-to-br from-white/10 to-white/5 border-2 border-white/20 hover:border-emerald-500/50'
              }`}
            >
              {/* Banner DESATIVADA - Prioridade Máxima */}
              {tenant.status === 'inactive' && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-red-600 via-red-700 to-red-800 text-white px-8 py-2 rounded-full font-black text-base shadow-2xl flex items-center gap-2 animate-pulse z-20 border-2 border-white">
                  <FaBan className="text-xl" />
                  EMPRESA DESATIVADA
                </div>
              )}

              {/* Banner PLANO TESTE - Bem Destacado */}
              {tenant.plano === 'teste' && tenant.status !== 'inactive' && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 text-white px-6 py-1.5 rounded-full font-black text-sm shadow-lg flex items-center gap-2 animate-pulse z-10">
                  <span className="text-base">⚠️</span>
                  PLANO TESTE
                  {tenant.trial_ends_at && (
                    <span className="text-xs bg-black/30 px-2 py-0.5 rounded-full ml-1">
                      Exp: {new Date(tenant.trial_ends_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                    </span>
                  )}
                </div>
              )}

              {/* Badge do ID do Tenant - Canto Superior Direito */}
              <div className="absolute top-4 right-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-xl font-black text-lg shadow-lg border-2 border-white/20 flex items-center gap-2">
                <span className="text-sm opacity-70">#</span>
                <span>{tenant.id}</span>
              </div>

              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <h3 className="text-xl font-black text-white">{tenant.nome}</h3>
                    {getStatusBadge(tenant.status)}
                    
                    {/* Badge TRIAL vs PAGO - DESTAQUE PRINCIPAL */}
                    {tenant.is_trial || (!tenant.has_paid_plan && tenant.status !== 'inactive') ? (
                      <span className="px-4 py-1.5 rounded-full text-xs font-black bg-gradient-to-r from-yellow-500 to-orange-600 text-white border-2 border-yellow-300 shadow-lg flex items-center gap-2 animate-pulse">
                        🆓 TRIAL
                        {tenant.trial_ends_at && (() => {
                          const now = new Date();
                          const trialEnd = new Date(tenant.trial_ends_at);
                          const daysLeft = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                          return daysLeft > 0 ? (
                            <span className="bg-black/30 px-2 py-0.5 rounded-full text-[10px]">
                              {daysLeft}d restantes
                            </span>
                          ) : null;
                        })()}
                      </span>
                    ) : tenant.has_paid_plan ? (
                      <span className="px-4 py-1.5 rounded-full text-xs font-black bg-gradient-to-r from-emerald-500 to-green-600 text-white border-2 border-emerald-300 shadow-lg flex items-center gap-2">
                        💎 PAGO
                      </span>
                    ) : null}
                    
                    {/* Badge do Plano */}
                    <span className={`px-3 py-1 rounded-full text-xs font-black border ${
                      tenant.plano === 'teste' 
                        ? 'bg-orange-500 text-white border-orange-600' 
                        : 'bg-indigo-500 text-white border-indigo-600'
                    }`}>
                      {tenant.plano === 'teste' ? 'TESTE' : (tenant.plano_nome || tenant.plano || 'Plano').toUpperCase()}
                    </span>
                  </div>
                  <p className="text-gray-400 text-sm">
                    <strong>Email:</strong> {tenant.email} | <strong>Slug:</strong> {tenant.slug}
                  </p>
                  {tenant.telefone && (
                    <p className="text-gray-400 text-sm">
                      <strong>Telefone:</strong> {tenant.telefone}
                    </p>
                  )}
                  {tenant.documento && (
                    <p className="text-gray-400 text-sm">
                      <strong>Documento:</strong> {tenant.documento}
                    </p>
                  )}
                  <p className="text-gray-500 text-xs mt-2">
                    Criado em: {new Date(tenant.created_at).toLocaleString('pt-BR')}
                  </p>
                </div>
              </div>

              {/* Stats - Simplificados */}
              <div className="grid grid-cols-3 gap-4 mb-4">
                {/* Usuários */}
                <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30 rounded-xl p-4 hover:scale-105 transition-transform">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="bg-blue-500/20 rounded-lg p-2">
                      <FaUsers className="text-blue-400 text-xl" />
                </div>
                    <p className="text-blue-300 text-sm font-semibold">Usuários</p>
                </div>
                  <p className="text-white font-black text-3xl ml-1">{tenant.total_usuarios}</p>
                </div>

                {/* Contas WhatsApp API */}
                <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 border border-green-500/30 rounded-xl p-4 hover:scale-105 transition-transform">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="bg-green-500/20 rounded-lg p-2">
                      <FaWhatsapp className="text-green-400 text-xl" />
                    </div>
                    <p className="text-green-300 text-sm font-semibold">WhatsApp API</p>
                  </div>
                  <p className="text-white font-black text-3xl ml-1">{tenant.total_contas || 0}</p>
                </div>

                {/* Conexões QR Connect */}
                <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 border border-purple-500/30 rounded-xl p-4 hover:scale-105 transition-transform">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="bg-purple-500/20 rounded-lg p-2">
                      <FaQrcode className="text-purple-400 text-xl" />
                    </div>
                    <p className="text-purple-300 text-sm font-semibold">QR Connect</p>
                  </div>
                  <p className="text-white font-black text-3xl ml-1">{tenant.total_contas_qr || 0}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleEdit(tenant)}
                  className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border-2 border-blue-500/40 rounded-lg font-bold transition-all flex items-center gap-2"
                >
                  <FaEdit /> Editar
                </button>
                <button
                  onClick={() => handleToggleStatus(tenant.id, tenant.status)}
                  className={`px-4 py-2 ${
                    tenant.status === 'active'
                      ? 'bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border-yellow-500/40'
                      : 'bg-green-500/20 hover:bg-green-500/30 text-green-300 border-green-500/40'
                  } border-2 rounded-lg font-bold transition-all flex items-center gap-2`}
                >
                  {tenant.status === 'active' ? (
                    <>
                      <FaBan /> Desativar
                    </>
                  ) : (
                    <>
                      <FaCheckCircle /> Ativar
                    </>
                  )}
                </button>
                <button
                  onClick={() => handleDelete(tenant.id, tenant.nome)}
                  className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 border-2 border-red-500/40 rounded-lg font-bold transition-all flex items-center gap-2 hover:scale-105"
                  title="Excluir tenant e todos os dados relacionados permanentemente"
                >
                  <FaTrash /> Excluir Permanentemente
                </button>
              </div>
              {isSuperJimmy && (
                <div className="mt-4 bg-yellow-500/20 border-2 border-yellow-400/50 rounded-lg p-3">
                  <p className="text-yellow-300 font-bold text-sm">⭐ Tenant Super Admin Principal</p>
                </div>
              )}
            </div>
          );
            })}
        </div>
      </div>

      {/* Edit Modal */}
      {editingTenant && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 border-2 border-white/20 rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-black text-white mb-6">Editar Tenant: {editingTenant.nome}</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-300 mb-2">Nome *</label>
                <input
                  type="text"
                  value={editForm.nome}
                  onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })}
                  className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-300 mb-2">Email *</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-300 mb-2">Telefone</label>
                <input
                  type="text"
                  value={editForm.telefone}
                  onChange={(e) => setEditForm({ ...editForm, telefone: e.target.value })}
                  className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-300 mb-2">Documento (CPF/CNPJ)</label>
                <input
                  type="text"
                  value={editForm.documento}
                  onChange={(e) => setEditForm({ ...editForm, documento: e.target.value })}
                  className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-300 mb-2">Plano</label>
                <select
                  value={editForm.plan_id || ''}
                  onChange={(e) => {
                    const selectedPlanId = e.target.value ? parseInt(e.target.value) : null;
                    const selectedPlan = plans.find(p => p.id === selectedPlanId);
                    setEditForm({ 
                      ...editForm, 
                      plan_id: selectedPlanId,
                      plano: selectedPlan?.nome || 'basico'
                    });
                  }}
                  className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-emerald-500 focus:outline-none"
                >
                  <option value="">Selecione um plano</option>
                  {plans.map(plan => (
                    <option key={plan.id} value={plan.id}>
                      {plan.nome} - R$ {Number(plan.preco_mensal || 0).toFixed(2)}/mês
                    </option>
                  ))}
                </select>
              </div>

              {/* Checkbox para customizar limites */}
              <div className="bg-purple-500/10 border-2 border-purple-500/30 rounded-lg p-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForm.limites_customizados}
                    onChange={(e) => setEditForm({ ...editForm, limites_customizados: e.target.checked })}
                    className="w-5 h-5 rounded border-2 border-purple-500 bg-black/30 text-purple-500 focus:ring-purple-500"
                  />
                  <div>
                    <span className="text-white font-bold">Customizar Limites para este Tenant</span>
                    <p className="text-gray-400 text-sm">Se desmarcado, usa os limites padrão do plano</p>
                  </div>
                </label>
              </div>

              {/* Campos de limites customizados (mostrar apenas se checkbox marcado) */}
              {editForm.limites_customizados && editForm.plan_id && (
                <div className="bg-blue-500/10 border-2 border-blue-500/30 rounded-lg p-6 space-y-4">
                  <h3 className="text-lg font-bold text-blue-300 mb-4 flex items-center gap-2">
                    <FaCreditCard /> Limites Customizados
                  </h3>
                  
                  {(() => {
                    const selectedPlan = plans.find(p => p.id === editForm.plan_id);
                    return (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-bold text-gray-300 mb-2">
                              Limite de Usuários
                              {selectedPlan && (
                                <span className="text-gray-500 font-normal ml-2">
                                  (Padrão: {selectedPlan.limite_usuarios === -1 ? 'Ilimitado' : selectedPlan.limite_usuarios})
                                </span>
                              )}
                            </label>
                            <input
                              type="number"
                              min="-1"
                              value={editForm.limite_usuarios_customizado ?? ''}
                              onChange={(e) => setEditForm({ ...editForm, limite_usuarios_customizado: e.target.value ? parseInt(e.target.value) : null })}
                              placeholder="Digite -1 para ilimitado"
                              className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-bold text-gray-300 mb-2">
                              Limite de Contas WhatsApp
                              {selectedPlan && (
                                <span className="text-gray-500 font-normal ml-2">
                                  (Padrão: {selectedPlan.limite_whatsapp === -1 ? 'Ilimitado' : selectedPlan.limite_whatsapp})
                                </span>
                              )}
                            </label>
                            <input
                              type="number"
                              min="-1"
                              value={editForm.limite_whatsapp_customizado ?? ''}
                              onChange={(e) => setEditForm({ ...editForm, limite_whatsapp_customizado: e.target.value ? parseInt(e.target.value) : null })}
                              placeholder="Digite -1 para ilimitado"
                              className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-bold text-gray-300 mb-2">
                              Campanhas Simultâneas
                              {selectedPlan && (
                                <span className="text-gray-500 font-normal ml-2">
                                  (Padrão: {selectedPlan.limite_campanhas_simultaneas === -1 ? 'Ilimitado' : selectedPlan.limite_campanhas_simultaneas})
                                </span>
                              )}
                            </label>
                            <input
                              type="number"
                              min="-1"
                              value={editForm.limite_campanhas_simultaneas_customizado ?? ''}
                              onChange={(e) => setEditForm({ ...editForm, limite_campanhas_simultaneas_customizado: e.target.value ? parseInt(e.target.value) : null })}
                              placeholder="Digite -1 para ilimitado"
                              className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-bold text-gray-300 mb-2">
                              Mensagens por Dia
                              {selectedPlan && (
                                <span className="text-gray-500 font-normal ml-2">
                                  (Padrão: {selectedPlan.limite_mensagens_dia === -1 ? 'Ilimitado' : selectedPlan.limite_mensagens_dia})
                                </span>
                              )}
                            </label>
                            <input
                              type="number"
                              min="-1"
                              value={editForm.limite_mensagens_dia_customizado ?? ''}
                              onChange={(e) => setEditForm({ ...editForm, limite_mensagens_dia_customizado: e.target.value ? parseInt(e.target.value) : null })}
                              placeholder="Digite -1 para ilimitado"
                              className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                            />
                          </div>

                          <div className="md:col-span-2">
                            <label className="block text-sm font-bold text-gray-300 mb-2">
                              Consultas Nova Vida por Mês
                              {selectedPlan && (
                                <span className="text-gray-500 font-normal ml-2">
                                  (Padrão: {selectedPlan.limite_novavida_mes === -1 ? 'Ilimitado' : selectedPlan.limite_novavida_mes})
                                </span>
                              )}
                            </label>
                            <input
                              type="number"
                              min="-1"
                              value={editForm.limite_novavida_mes_customizado ?? ''}
                              onChange={(e) => setEditForm({ ...editForm, limite_novavida_mes_customizado: e.target.value ? parseInt(e.target.value) : null })}
                              placeholder="Digite -1 para ilimitado"
                              className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                            />
                          </div>
                        </div>

                        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mt-4">
                          <p className="text-yellow-300 text-sm">
                            💡 <strong>Dica:</strong> Use -1 para ilimitado. Deixe vazio para usar o limite padrão do plano.
                          </p>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* Checkbox para customizar funcionalidades */}
              <div className="bg-orange-500/10 border-2 border-orange-500/30 rounded-lg p-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForm.funcionalidades_customizadas}
                    onChange={(e) => setEditForm({ ...editForm, funcionalidades_customizadas: e.target.checked })}
                    className="w-5 h-5 rounded border-2 border-orange-500 bg-black/30 text-orange-500 focus:ring-orange-500"
                  />
                  <div>
                    <span className="text-white font-bold">Customizar Funcionalidades para este Tenant</span>
                    <p className="text-gray-400 text-sm">Se desmarcado, usa as funcionalidades padrão do plano</p>
                  </div>
                </label>
              </div>

              {/* Grid de funcionalidades customizadas (mostrar apenas se checkbox marcado) */}
              {editForm.funcionalidades_customizadas && (
                <div className="bg-green-500/10 border-2 border-green-500/30 rounded-lg p-6 space-y-4">
                  <h3 className="text-lg font-bold text-green-300 mb-4 flex items-center gap-2">
                    🔐 Funcionalidades Customizadas
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* WhatsApp API Oficial */}
                    <label className="flex items-center gap-3 cursor-pointer bg-black/20 p-3 rounded-lg hover:bg-black/30 transition-all">
                      <input
                        type="checkbox"
                        checked={editForm.funcionalidades_config.whatsapp_api}
                        onChange={(e) => setEditForm({
                          ...editForm,
                          funcionalidades_config: {
                            ...editForm.funcionalidades_config,
                            whatsapp_api: e.target.checked
                          }
                        })}
                        className="w-5 h-5 rounded border-2 border-green-500 bg-black/30 text-green-500"
                      />
                      <div>
                        <span className="text-white font-semibold">WhatsApp API Oficial</span>
                        <p className="text-gray-400 text-xs">Contas API, Campanhas, Templates</p>
                      </div>
                    </label>

                    {/* WhatsApp QR Connect */}
                    <label className="flex items-center gap-3 cursor-pointer bg-black/20 p-3 rounded-lg hover:bg-black/30 transition-all">
                      <input
                        type="checkbox"
                        checked={editForm.funcionalidades_config.whatsapp_qr}
                        onChange={(e) => setEditForm({
                          ...editForm,
                          funcionalidades_config: {
                            ...editForm.funcionalidades_config,
                            whatsapp_qr: e.target.checked
                          }
                        })}
                        className="w-5 h-5 rounded border-2 border-green-500 bg-black/30 text-green-500"
                      />
                      <div>
                        <span className="text-white font-semibold">WhatsApp QR Connect</span>
                        <p className="text-gray-400 text-xs">UAZ, Campanhas QR, Templates QR</p>
                      </div>
                    </label>

                    {/* Campanhas */}
                    <label className="flex items-center gap-3 cursor-pointer bg-black/20 p-3 rounded-lg hover:bg-black/30 transition-all">
                      <input
                        type="checkbox"
                        checked={editForm.funcionalidades_config.campanhas}
                        onChange={(e) => setEditForm({
                          ...editForm,
                          funcionalidades_config: {
                            ...editForm.funcionalidades_config,
                            campanhas: e.target.checked
                          }
                        })}
                        className="w-5 h-5 rounded border-2 border-green-500 bg-black/30 text-green-500"
                      />
                      <div>
                        <span className="text-white font-semibold">Campanhas</span>
                        <p className="text-gray-400 text-xs">Criar e gerenciar campanhas</p>
                      </div>
                    </label>

                    {/* Templates */}
                    <label className="flex items-center gap-3 cursor-pointer bg-black/20 p-3 rounded-lg hover:bg-black/30 transition-all">
                      <input
                        type="checkbox"
                        checked={editForm.funcionalidades_config.templates}
                        onChange={(e) => setEditForm({
                          ...editForm,
                          funcionalidades_config: {
                            ...editForm.funcionalidades_config,
                            templates: e.target.checked
                          }
                        })}
                        className="w-5 h-5 rounded border-2 border-green-500 bg-black/30 text-green-500"
                      />
                      <div>
                        <span className="text-white font-semibold">Templates</span>
                        <p className="text-gray-400 text-xs">Gerenciar templates de mensagem</p>
                      </div>
                    </label>

                    {/* Base de Dados */}
                    <label className="flex items-center gap-3 cursor-pointer bg-black/20 p-3 rounded-lg hover:bg-black/30 transition-all">
                      <input
                        type="checkbox"
                        checked={editForm.funcionalidades_config.base_dados}
                        onChange={(e) => setEditForm({
                          ...editForm,
                          funcionalidades_config: {
                            ...editForm.funcionalidades_config,
                            base_dados: e.target.checked
                          }
                        })}
                        className="w-5 h-5 rounded border-2 border-green-500 bg-black/30 text-green-500"
                      />
                      <div>
                        <span className="text-white font-semibold">Base de Dados</span>
                        <p className="text-gray-400 text-xs">Importar e gerenciar contatos</p>
                      </div>
                    </label>

                    {/* Nova Vida */}
                    <label className="flex items-center gap-3 cursor-pointer bg-black/20 p-3 rounded-lg hover:bg-black/30 transition-all">
                      <input
                        type="checkbox"
                        checked={editForm.funcionalidades_config.nova_vida}
                        onChange={(e) => setEditForm({
                          ...editForm,
                          funcionalidades_config: {
                            ...editForm.funcionalidades_config,
                            nova_vida: e.target.checked
                          }
                        })}
                        className="w-5 h-5 rounded border-2 border-green-500 bg-black/30 text-green-500"
                      />
                      <div>
                        <span className="text-white font-semibold">Consultas Nova Vida</span>
                        <p className="text-gray-400 text-xs">Sistema de consultas Nova Vida</p>
                      </div>
                    </label>

                    {/* Lista de Restrição */}
                    <label className="flex items-center gap-3 cursor-pointer bg-black/20 p-3 rounded-lg hover:bg-black/30 transition-all">
                      <input
                        type="checkbox"
                        checked={editForm.funcionalidades_config.lista_restricao}
                        onChange={(e) => setEditForm({
                          ...editForm,
                          funcionalidades_config: {
                            ...editForm.funcionalidades_config,
                            lista_restricao: e.target.checked
                          }
                        })}
                        className="w-5 h-5 rounded border-2 border-green-500 bg-black/30 text-green-500"
                      />
                      <div>
                        <span className="text-white font-semibold">Lista de Restrição</span>
                        <p className="text-gray-400 text-xs">Gerenciar lista de restrição</p>
                      </div>
                    </label>

                    {/* Webhooks */}
                    <label className="flex items-center gap-3 cursor-pointer bg-black/20 p-3 rounded-lg hover:bg-black/30 transition-all">
                      <input
                        type="checkbox"
                        checked={editForm.funcionalidades_config.webhooks}
                        onChange={(e) => setEditForm({
                          ...editForm,
                          funcionalidades_config: {
                            ...editForm.funcionalidades_config,
                            webhooks: e.target.checked
                          }
                        })}
                        className="w-5 h-5 rounded border-2 border-green-500 bg-black/30 text-green-500"
                      />
                      <div>
                        <span className="text-white font-semibold">Webhooks</span>
                        <p className="text-gray-400 text-xs">Configurar webhooks</p>
                      </div>
                    </label>

                    {/* Catálogo */}
                    <label className="flex items-center gap-3 cursor-pointer bg-black/20 p-3 rounded-lg hover:bg-black/30 transition-all">
                      <input
                        type="checkbox"
                        checked={editForm.funcionalidades_config.catalogo}
                        onChange={(e) => setEditForm({
                          ...editForm,
                          funcionalidades_config: {
                            ...editForm.funcionalidades_config,
                            catalogo: e.target.checked
                          }
                        })}
                        className="w-5 h-5 rounded border-2 border-green-500 bg-black/30 text-green-500"
                      />
                      <div>
                        <span className="text-white font-semibold">Catálogo</span>
                        <p className="text-gray-400 text-xs">Gerenciar catálogo de produtos</p>
                      </div>
                    </label>

                    {/* Dashboard */}
                    <label className="flex items-center gap-3 cursor-pointer bg-black/20 p-3 rounded-lg hover:bg-black/30 transition-all">
                      <input
                        type="checkbox"
                        checked={editForm.funcionalidades_config.dashboard}
                        onChange={(e) => setEditForm({
                          ...editForm,
                          funcionalidades_config: {
                            ...editForm.funcionalidades_config,
                            dashboard: e.target.checked
                          }
                        })}
                        className="w-5 h-5 rounded border-2 border-green-500 bg-black/30 text-green-500"
                      />
                      <div>
                        <span className="text-white font-semibold">Dashboard</span>
                        <p className="text-gray-400 text-xs">Dashboard e estatísticas</p>
                      </div>
                    </label>

                    {/* Relatórios */}
                    <label className="flex items-center gap-3 cursor-pointer bg-black/20 p-3 rounded-lg hover:bg-black/30 transition-all">
                      <input
                        type="checkbox"
                        checked={editForm.funcionalidades_config.relatorios}
                        onChange={(e) => setEditForm({
                          ...editForm,
                          funcionalidades_config: {
                            ...editForm.funcionalidades_config,
                            relatorios: e.target.checked
                          }
                        })}
                        className="w-5 h-5 rounded border-2 border-green-500 bg-black/30 text-green-500"
                      />
                      <div>
                        <span className="text-white font-semibold">Relatórios</span>
                        <p className="text-gray-400 text-xs">Gerar e baixar relatórios</p>
                      </div>
                    </label>

                    {/* Envio Imediato */}
                    <label className="flex items-center gap-3 cursor-pointer bg-black/20 p-3 rounded-lg hover:bg-black/30 transition-all">
                      <input
                        type="checkbox"
                        checked={editForm.funcionalidades_config.envio_imediato}
                        onChange={(e) => setEditForm({
                          ...editForm,
                          funcionalidades_config: {
                            ...editForm.funcionalidades_config,
                            envio_imediato: e.target.checked
                          }
                        })}
                        className="w-5 h-5 rounded border-2 border-green-500 bg-black/30 text-green-500"
                      />
                      <div>
                        <span className="text-white font-semibold">Envio Imediato</span>
                        <p className="text-gray-400 text-xs">Enviar mensagens imediatas</p>
                      </div>
                    </label>
                  </div>

                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mt-4">
                    <p className="text-blue-300 text-sm">
                      💡 <strong>Dica:</strong> Desmarque as funcionalidades que este tenant NÃO deve ter acesso. Os menus ficarão ocultos para este tenant.
                    </p>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-gray-300 mb-2">Status</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-emerald-500 focus:outline-none"
                >
                  <option value="active">Ativo</option>
                  <option value="inactive">Inativo</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSaveEdit}
                className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-bold transition-all"
              >
                💾 Salvar
              </button>
              <button
                onClick={() => setEditingTenant(null)}
                className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-bold transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats Modal - COMPLETO */}
      {viewingStats !== null && stats && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 border-2 border-white/20 rounded-2xl p-8 max-w-7xl w-full my-8">
            <h2 className="text-3xl font-black text-white mb-6 flex items-center gap-3">
              📊 Estatísticas Completas do Tenant
            </h2>

            {/* RESUMO GERAL */}
            <div className="mb-6">
              <h3 className="text-xl font-bold text-emerald-400 mb-4">📈 Resumo Geral</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="bg-blue-500/20 border-2 border-blue-500/40 rounded-xl p-4">
                  <p className="text-blue-300 text-xs font-semibold mb-1">Usuários</p>
                  <p className="text-3xl font-black text-white">{stats.resumo?.total_usuarios || 0}</p>
                </div>
                <div className="bg-green-500/20 border-2 border-green-500/40 rounded-xl p-4">
                  <p className="text-green-300 text-xs font-semibold mb-1">Contas</p>
                  <p className="text-3xl font-black text-white">{stats.resumo?.total_contas || 0}</p>
                </div>
                <div className="bg-purple-500/20 border-2 border-purple-500/40 rounded-xl p-4">
                  <p className="text-purple-300 text-xs font-semibold mb-1">Campanhas</p>
                  <p className="text-3xl font-black text-white">{stats.resumo?.total_campanhas || 0}</p>
                </div>
                <div className="bg-pink-500/20 border-2 border-pink-500/40 rounded-xl p-4">
                  <p className="text-pink-300 text-xs font-semibold mb-1">Mensagens</p>
                  <p className="text-3xl font-black text-white">{stats.resumo?.total_mensagens || 0}</p>
                </div>
                <div className="bg-yellow-500/20 border-2 border-yellow-500/40 rounded-xl p-4">
                  <p className="text-yellow-300 text-xs font-semibold mb-1">Templates</p>
                  <p className="text-3xl font-black text-white">{stats.resumo?.total_templates || 0}</p>
                </div>
                <div className="bg-cyan-500/20 border-2 border-cyan-500/40 rounded-xl p-4">
                  <p className="text-cyan-300 text-xs font-semibold mb-1">Contatos</p>
                  <p className="text-3xl font-black text-white">{stats.resumo?.total_contatos || 0}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* USUÁRIOS */}
              <div className="bg-blue-500/10 border-2 border-blue-500/30 rounded-xl p-6">
                <h3 className="text-lg font-bold text-blue-300 mb-4 flex items-center gap-2">
                  👥 Usuários
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">Total:</span>
                    <span className="text-white font-bold text-xl">{stats.usuarios?.total || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">✅ Ativos:</span>
                    <span className="text-green-400 font-bold">{stats.usuarios?.ativos || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">❌ Inativos:</span>
                    <span className="text-red-400 font-bold">{stats.usuarios?.inativos || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">👨‍💼 Administradores:</span>
                    <span className="text-purple-400 font-bold">{stats.usuarios?.admins || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">👤 Usuários Normais:</span>
                    <span className="text-blue-400 font-bold">{stats.usuarios?.usuarios_normais || 0}</span>
                  </div>
                </div>
              </div>

              {/* CONTAS WHATSAPP */}
              <div className="bg-green-500/10 border-2 border-green-500/30 rounded-xl p-6">
                <h3 className="text-lg font-bold text-green-300 mb-4 flex items-center gap-2">
                  📱 Contas WhatsApp
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">Total:</span>
                    <span className="text-white font-bold text-xl">{stats.contas?.total || 0}</span>
                  </div>
                  <div className="border-t border-white/10 pt-3">
                    <p className="text-emerald-300 font-semibold mb-2">API Oficial:</p>
                    <div className="pl-4 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-400 text-sm">Total:</span>
                        <span className="text-white font-bold">{stats.contas?.api?.total || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400 text-sm">✅ Ativas:</span>
                        <span className="text-green-400 font-bold">{stats.contas?.api?.ativas || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400 text-sm">❌ Inativas:</span>
                        <span className="text-red-400 font-bold">{stats.contas?.api?.inativas || 0}</span>
                      </div>
                    </div>
                  </div>
                  <div className="border-t border-white/10 pt-3">
                    <p className="text-cyan-300 font-semibold mb-2">QR Connect:</p>
                    <div className="pl-4 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-400 text-sm">Total:</span>
                        <span className="text-white font-bold">{stats.contas?.qr?.total || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400 text-sm">✅ Conectadas:</span>
                        <span className="text-green-400 font-bold">{stats.contas?.qr?.conectadas || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400 text-sm">❌ Desconectadas:</span>
                        <span className="text-red-400 font-bold">{stats.contas?.qr?.desconectadas || 0}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* CAMPANHAS API */}
              <div className="bg-purple-500/10 border-2 border-purple-500/30 rounded-xl p-6">
                <h3 className="text-lg font-bold text-purple-300 mb-4 flex items-center gap-2">
                  📢 Campanhas API Oficial
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">Total:</span>
                    <span className="text-white font-bold text-xl">{stats.campanhas_api?.total || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">🕐 Agendadas:</span>
                    <span className="text-yellow-400 font-bold">{stats.campanhas_api?.agendadas || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">▶️ Em Andamento:</span>
                    <span className="text-blue-400 font-bold">{stats.campanhas_api?.em_andamento || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">⏸️ Pausadas:</span>
                    <span className="text-orange-400 font-bold">{stats.campanhas_api?.pausadas || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">✅ Concluídas:</span>
                    <span className="text-green-400 font-bold">{stats.campanhas_api?.concluidas || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">❌ Canceladas:</span>
                    <span className="text-red-400 font-bold">{stats.campanhas_api?.canceladas || 0}</span>
                  </div>
                </div>
              </div>

              {/* CAMPANHAS QR */}
              <div className="bg-orange-500/10 border-2 border-orange-500/30 rounded-xl p-6">
                <h3 className="text-lg font-bold text-orange-300 mb-4 flex items-center gap-2">
                  📢 Campanhas QR Connect
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">Total:</span>
                    <span className="text-white font-bold text-xl">{stats.campanhas_qr?.total || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">🕐 Agendadas:</span>
                    <span className="text-yellow-400 font-bold">{stats.campanhas_qr?.agendadas || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">▶️ Em Andamento:</span>
                    <span className="text-blue-400 font-bold">{stats.campanhas_qr?.em_andamento || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">⏸️ Pausadas:</span>
                    <span className="text-orange-400 font-bold">{stats.campanhas_qr?.pausadas || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">✅ Concluídas:</span>
                    <span className="text-green-400 font-bold">{stats.campanhas_qr?.concluidas || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">❌ Canceladas:</span>
                    <span className="text-red-400 font-bold">{stats.campanhas_qr?.canceladas || 0}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* MENSAGENS */}
            <div className="mb-6 bg-pink-500/10 border-2 border-pink-500/30 rounded-xl p-6">
              <h3 className="text-lg font-bold text-pink-300 mb-4 flex items-center gap-2">
                💬 Mensagens
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Mensagens API */}
                <div>
                  <p className="text-emerald-300 font-semibold mb-3">API Oficial:</p>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-300 text-sm">Total:</span>
                      <span className="text-white font-bold">{stats.mensagens?.api?.total || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300 text-sm">📤 Enviadas:</span>
                      <span className="text-blue-400 font-bold">{stats.mensagens?.api?.enviadas || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300 text-sm">✅ Entregues:</span>
                      <span className="text-green-400 font-bold">{stats.mensagens?.api?.entregues || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300 text-sm">👁️ Lidas:</span>
                      <span className="text-purple-400 font-bold">{stats.mensagens?.api?.lidas || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300 text-sm">❌ Erro:</span>
                      <span className="text-red-400 font-bold">{stats.mensagens?.api?.erro || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300 text-sm">⏳ Pendentes:</span>
                      <span className="text-yellow-400 font-bold">{stats.mensagens?.api?.pendentes || 0}</span>
                    </div>
                  </div>
                </div>

                {/* Mensagens QR */}
                <div>
                  <p className="text-cyan-300 font-semibold mb-3">QR Connect:</p>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-300 text-sm">Total:</span>
                      <span className="text-white font-bold">{stats.mensagens?.qr?.total || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300 text-sm">📤 Enviadas:</span>
                      <span className="text-blue-400 font-bold">{stats.mensagens?.qr?.enviadas || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300 text-sm">✅ Entregues:</span>
                      <span className="text-green-400 font-bold">{stats.mensagens?.qr?.entregues || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300 text-sm">👁️ Lidas:</span>
                      <span className="text-purple-400 font-bold">{stats.mensagens?.qr?.lidas || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300 text-sm">❌ Erro:</span>
                      <span className="text-red-400 font-bold">{stats.mensagens?.qr?.erro || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300 text-sm">⏳ Pendentes:</span>
                      <span className="text-yellow-400 font-bold">{stats.mensagens?.qr?.pendentes || 0}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-pink-500/30">
                <div className="flex justify-between items-center">
                  <span className="text-white font-semibold">📊 Total Geral:</span>
                  <span className="text-white font-black text-2xl">{stats.mensagens?.total || 0}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* TEMPLATES */}
              <div className="bg-yellow-500/10 border-2 border-yellow-500/30 rounded-xl p-6">
                <h3 className="text-lg font-bold text-yellow-300 mb-4">📝 Templates</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-300">Total:</span>
                    <span className="text-white font-bold text-xl">{stats.templates?.total || 0}</span>
                  </div>
                  <div className="border-t border-white/10 pt-2">
                    <p className="text-emerald-300 text-sm font-semibold mb-2">API:</p>
                    <div className="pl-3 space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Total:</span>
                        <span className="text-white font-bold">{stats.templates?.api?.total || 0}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">✅ Aprovados:</span>
                        <span className="text-green-400 font-bold">{stats.templates?.api?.aprovados || 0}</span>
                      </div>
                    </div>
                  </div>
                  <div className="border-t border-white/10 pt-2">
                    <p className="text-cyan-300 text-sm font-semibold mb-2">QR:</p>
                    <div className="pl-3 space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Total:</span>
                        <span className="text-white font-bold">{stats.templates?.qr?.total || 0}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">✅ Ativos:</span>
                        <span className="text-green-400 font-bold">{stats.templates?.qr?.ativos || 0}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* BASE DE DADOS */}
              <div className="bg-cyan-500/10 border-2 border-cyan-500/30 rounded-xl p-6">
                <h3 className="text-lg font-bold text-cyan-300 mb-4">📇 Base de Dados</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-300">Total Contatos:</span>
                    <span className="text-white font-bold text-xl">{stats.base_dados?.total_contatos || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300 text-sm">📅 Esta Semana:</span>
                    <span className="text-green-400 font-bold">{stats.base_dados?.importados_esta_semana || 0}</span>
                  </div>
                </div>
              </div>

              {/* NOVA VIDA */}
              <div className="bg-indigo-500/10 border-2 border-indigo-500/30 rounded-xl p-6">
                <h3 className="text-lg font-bold text-indigo-300 mb-4">🔍 Nova Vida</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-300">Total Consultas:</span>
                    <span className="text-white font-bold text-xl">{stats.nova_vida?.total_consultas || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300 text-sm">📅 Este Mês:</span>
                    <span className="text-blue-400 font-bold">{stats.nova_vida?.consultas_este_mes || 0}</span>
                  </div>
                </div>
              </div>

              {/* LISTA DE RESTRIÇÃO */}
              <div className="bg-red-500/10 border-2 border-red-500/30 rounded-xl p-6">
                <h3 className="text-lg font-bold text-red-300 mb-4">🚫 Lista de Restrição</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-300">Números Bloqueados:</span>
                    <span className="text-white font-bold text-xl">{stats.lista_restricao?.total_bloqueados || 0}</span>
                  </div>
                </div>
              </div>

              {/* ARQUIVOS */}
              <div className="bg-teal-500/10 border-2 border-teal-500/30 rounded-xl p-6">
                <h3 className="text-lg font-bold text-teal-300 mb-4">📁 Arquivos</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-300">Total:</span>
                    <span className="text-white font-bold text-xl">{stats.arquivos?.total || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300 text-sm">💾 Tamanho:</span>
                    <span className="text-blue-400 font-bold">{stats.arquivos?.tamanho_total_mb || 0} MB</span>
                  </div>
                </div>
              </div>

              {/* WEBHOOKS E LOGS */}
              <div className="bg-gray-500/10 border-2 border-gray-500/30 rounded-xl p-6">
                <h3 className="text-lg font-bold text-gray-300 mb-4">⚙️ Sistema</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-300 text-sm">🔗 Webhooks:</span>
                    <span className="text-white font-bold">{stats.webhooks?.total_configurados || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300 text-sm">📄 Logs Total:</span>
                    <span className="text-white font-bold">{stats.logs?.total || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300 text-sm">📅 Logs Semana:</span>
                    <span className="text-blue-400 font-bold">{stats.logs?.esta_semana || 0}</span>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={() => { setViewingStats(null); setStats(null); }}
              className="w-full py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-bold transition-all mt-6"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Modal de Criação */}
      {isCreating && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 border-2 border-emerald-500/50 rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-black text-white mb-6 flex items-center gap-3">
              <FaPlus className="text-emerald-400" />
              Criar Novo Tenant
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-300 mb-2">Nome da Empresa *</label>
                <input
                  type="text"
                  value={createForm.nome}
                  onChange={(e) => setCreateForm({ ...createForm, nome: e.target.value })}
                  placeholder="Ex: Minha Empresa"
                  className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-300 mb-2">Email *</label>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  placeholder="admin@empresa.com"
                  className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-emerald-500 focus:outline-none"
                />
                <p className="text-xs text-gray-400 mt-1">Este será o email de login do administrador</p>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-300 mb-2">Senha do Administrador *</label>
                <input
                  type="password"
                  value={createForm.senha_admin}
                  onChange={(e) => setCreateForm({ ...createForm, senha_admin: e.target.value })}
                  placeholder="Digite uma senha segura"
                  className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-emerald-500 focus:outline-none"
                />
                <p className="text-xs text-gray-400 mt-1">A senha deve ter pelo menos 6 caracteres</p>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-300 mb-2">Telefone</label>
                <input
                  type="text"
                  value={createForm.telefone}
                  onChange={(e) => setCreateForm({ ...createForm, telefone: e.target.value })}
                  placeholder="(11) 98888-8888"
                  className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-300 mb-2">Documento (CPF/CNPJ)</label>
                <input
                  type="text"
                  value={createForm.documento}
                  onChange={(e) => setCreateForm({ ...createForm, documento: e.target.value })}
                  placeholder="000.000.000-00"
                  className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-300 mb-2">Plano</label>
                <select
                  value={createForm.plan_id || ''}
                  onChange={(e) => {
                    const planId = e.target.value ? parseInt(e.target.value) : null;
                    const selectedPlan = plans.find(p => p.id === planId);
                    setCreateForm({ 
                      ...createForm, 
                      plan_id: planId,
                      plano: selectedPlan?.nome?.toLowerCase() || 'basico'
                    });
                  }}
                  className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-emerald-500 focus:outline-none"
                >
                  <option value="">Selecione um plano</option>
                  {plans.map(plan => (
                    <option key={plan.id} value={plan.id}>
                      {plan.nome} - R$ {plan.preco}/mês
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-blue-500/10 border-2 border-blue-500/30 rounded-lg p-4">
                <p className="text-blue-300 text-sm font-semibold mb-2">ℹ️ Informação:</p>
                <ul className="text-blue-200/80 text-xs space-y-1">
                  <li>• O slug será gerado automaticamente a partir do nome</li>
                  <li>• Um usuário administrador será criado com o email e senha informados</li>
                  <li>• O tenant será criado com status ATIVO</li>
                  <li>• Você poderá editar os limites e funcionalidades depois da criação</li>
                </ul>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleCreateTenant}
                className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-lg font-bold transition-all shadow-lg hover:shadow-xl"
              >
                ✅ Criar Tenant
              </button>
              <button
                onClick={() => setIsCreating(false)}
                className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-bold transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
      </AdminLayout>
    </>
  );
}

