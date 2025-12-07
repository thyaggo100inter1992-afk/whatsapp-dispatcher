import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  FaCreditCard, FaEdit, FaTrash, FaPlus,
  FaCheckCircle, FaTimesCircle, FaUsers, FaWhatsapp, FaEnvelope,
  FaSave, FaTimes, FaEye, FaEyeSlash, FaSignOutAlt, FaComments
} from 'react-icons/fa';
import api from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/admin/AdminLayout';
import { ToastContainer, useToast } from '@/components/Toast';

interface Plan {
  id: number;
  nome: string;
  slug: string;
  descricao: string;
  preco_mensal: number;
  preco_anual: number;
  limite_usuarios: number;
  limite_contas_whatsapp: number;
  limite_campanhas_mes: number;
  limite_mensagens_dia: number;
  limite_mensagens_mes: number;
  limite_templates: number;
  limite_contatos: number;
  limite_consultas_dia: number;
  limite_consultas_mes: number;
  ativo: boolean;
  visivel: boolean;
  ordem: number;
  total_tenants: number;
  funcionalidades: {
    whatsapp_api?: boolean;
    whatsapp_qr?: boolean;
    nova_vida?: boolean;
    verificar_numeros?: boolean;
    gerenciar_proxies?: boolean;
    chat_atendimento?: boolean;
    [key: string]: boolean | undefined;
  };
}

export default function AdminPlans() {
  const router = useRouter();
  const { signOut } = useAuth();
  const { notifications, showNotification, removeNotification } = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');

  const emptyPlan: Partial<Plan> = {
    nome: '',
    slug: '',
    descricao: '',
    preco_mensal: 0,
    preco_anual: 0,
    limite_usuarios: 1,
    limite_contas_whatsapp: 1,
    limite_campanhas_mes: 10,
    limite_mensagens_dia: 100,
    limite_mensagens_mes: 3000,
    limite_templates: 5,
    limite_contatos: 1000,
    limite_consultas_dia: 10,
    limite_consultas_mes: 300,
    ativo: true,
    visivel: true,
    ordem: 0,
    funcionalidades: {
      whatsapp_api: true,
      whatsapp_qr: true,
      nova_vida: true,
      verificar_numeros: true,
      gerenciar_proxies: true,
      chat_atendimento: false,
    }
  };

  const [formData, setFormData] = useState<Partial<Plan>>(emptyPlan);

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/plans');
      setPlans(response.data.data);
      setError('');
    } catch (error: any) {
      console.error('Erro ao carregar planos:', error);
      if (error.response?.status === 403) {
        setError('Acesso negado.');
      } else {
        setError('Erro ao carregar planos');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (plan: Plan) => {
    setEditingPlan(plan);
    setFormData(plan);
    setIsCreating(false);
  };

  const handleCreate = () => {
    setEditingPlan(null);
    setFormData(emptyPlan);
    setIsCreating(true);
  };

  const handleCancel = () => {
    setEditingPlan(null);
    setIsCreating(false);
    setFormData(emptyPlan);
  };

  const handleSave = async () => {
    try {
      // Adicionar permite_chat_atendimento baseado no funcionalidades.chat_atendimento
      const dataToSend = {
        ...formData,
        permite_chat_atendimento: formData.funcionalidades?.chat_atendimento === true
      };
      
      console.log('📤 Salvando plano com dados:', dataToSend);
      
      if (isCreating) {
        await api.post('/admin/plans', dataToSend);
        showNotification('✅ Plano criado com sucesso!', 'success');
      } else if (editingPlan) {
        await api.put(`/admin/plans/${editingPlan.id}`, dataToSend);
        showNotification('✅ Plano atualizado com sucesso!', 'success');
      }
      await loadPlans();
      handleCancel();
    } catch (error: any) {
      console.error('❌ Erro ao salvar plano:', error);
      showNotification('❌ Erro ao salvar plano', 'error');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir este plano?')) return;

    try {
      await api.delete(`/admin/plans/${id}`);
      showNotification('✅ Plano excluído com sucesso!', 'success');
      await loadPlans();
    } catch (error: any) {
      showNotification('❌ Erro ao excluir plano', 'error');
    }
  };

  const handleLogout = () => {
    signOut();
    router.push('/login');
  };

  const formatLimit = (value: number) => {
    return value === -1 ? 'Ilimitado' : value.toLocaleString('pt-BR');
  };

  if (error) {
    return (
      <AdminLayout
        title="Gerenciamento de Planos"
        subtitle="Configure planos e limites do sistema"
        icon={<FaCreditCard className="text-3xl text-white" />}
        currentPage="plans"
      >
        <div className="bg-red-500/20 border-2 border-red-500 rounded-xl p-8">
          <h2 className="text-2xl font-bold text-red-400 mb-4">⚠️ Erro de Acesso</h2>
          <p className="text-white mb-6">{error}</p>
          <button
            onClick={handleLogout}
            className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-bold transition-all"
          >
            <FaSignOutAlt className="inline mr-2" /> Fazer Logout
          </button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="Gerenciamento de Planos"
      subtitle="Configure planos e limites do sistema"
      icon={<FaCreditCard className="text-3xl text-white" />}
      currentPage="plans"
    >
        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-4 border-purple-500"></div>
            <p className="text-white mt-4 text-xl">Carregando planos...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Botão Criar Novo Plano */}
            {!isCreating && !editingPlan && (
              <div className="flex justify-end">
                <button
                  onClick={handleCreate}
                  className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all"
                >
                  <FaPlus /> Criar Novo Plano
                </button>
              </div>
            )}

            {/* Formulário de Criação/Edição */}
            {(isCreating || editingPlan) && (
              <div className="bg-gray-800/70 backdrop-blur-sm rounded-2xl p-6 shadow-2xl border-2 border-purple-500">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-white">
                    {isCreating ? '🆕 Criar Novo Plano' : `✏️ Editar: ${editingPlan?.nome}`}
                  </h2>
                  <button
                    onClick={handleCancel}
                    className="text-gray-400 hover:text-white"
                  >
                    <FaTimes className="text-2xl" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Informações Básicas */}
                  <div className="space-y-4 md:col-span-2">
                    <h3 className="text-lg font-bold text-purple-300 border-b border-purple-500 pb-2">
                      📋 Informações Básicas
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Nome do Plano</label>
                        <input
                          type="text"
                          value={formData.nome}
                          onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                          className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Slug (identificador)</label>
                        <input
                          type="text"
                          value={formData.slug}
                          onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/\s/g, '-') })}
                          className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-300 mb-2">Descrição</label>
                        <textarea
                          value={formData.descricao}
                          onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                          rows={2}
                          className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Preço Mensal (R$)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.preco_mensal || 0}
                          onChange={(e) => {
                            const value = e.target.value === '' ? 0 : parseFloat(e.target.value);
                            setFormData({ ...formData, preco_mensal: isNaN(value) ? 0 : value });
                          }}
                          className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Preço Anual (R$)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.preco_anual || 0}
                          onChange={(e) => {
                            const value = e.target.value === '' ? 0 : parseFloat(e.target.value);
                            setFormData({ ...formData, preco_anual: isNaN(value) ? 0 : value });
                          }}
                          className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Limites de Uso */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold text-purple-300 border-b border-purple-500 pb-2">
                      📊 Limites de Uso
                    </h3>
                    
                    {[
                      { key: 'limite_usuarios', label: 'Usuários' },
                      { key: 'limite_contas_whatsapp', label: 'Contas WhatsApp' },
                      { key: 'limite_campanhas_mes', label: 'Campanhas/Mês' },
                      { key: 'limite_mensagens_dia', label: 'Mensagens/Dia' },
                      { key: 'limite_mensagens_mes', label: 'Mensagens/Mês' },
                      { key: 'limite_templates', label: 'Templates' },
                      { key: 'limite_contatos', label: 'Contatos' }
                    ].map((field) => (
                      <div key={field.key}>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          {field.label} <span className="text-gray-500 text-xs">(-1 = ilimitado)</span>
                        </label>
                        <input
                          type="number"
                          value={(formData as any)[field.key] || 0}
                          onChange={(e) => {
                            const value = e.target.value === '' ? 0 : parseInt(e.target.value);
                            setFormData({ ...formData, [field.key]: isNaN(value) ? 0 : value });
                          }}
                          className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                    ))}
                  </div>

                  {/* Limites de Consultas */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold text-purple-300 border-b border-purple-500 pb-2">
                      🔍 Limites de Consultas
                    </h3>
                    
                    {[
                      { key: 'limite_consultas_dia', label: 'Consultas/Dia' },
                      { key: 'limite_consultas_mes', label: 'Consultas/Mês' }
                    ].map((field) => (
                      <div key={field.key}>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          {field.label} <span className="text-gray-500 text-xs">(-1 = ilimitado)</span>
                        </label>
                        <input
                          type="number"
                          value={(formData as any)[field.key] || 0}
                          onChange={(e) => {
                            const value = e.target.value === '' ? 0 : parseInt(e.target.value);
                            setFormData({ ...formData, [field.key]: isNaN(value) ? 0 : value });
                          }}
                          className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                    ))}
                  </div>

                  {/* Recursos e Configurações */}
                  <div className="space-y-4 md:col-span-2">
                    <h3 className="text-lg font-bold text-purple-300 border-b border-purple-500 pb-2">
                      ⚙️ Recursos Disponíveis
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {                      [
                        { key: 'whatsapp_api', label: 'WhatsApp API Oficial', icon: <FaWhatsapp /> },
                        { key: 'whatsapp_qr', label: 'WhatsApp QR Connect', icon: <FaWhatsapp /> },
                        { key: 'nova_vida', label: 'Consulta de Dados', icon: <FaCheckCircle /> },
                        { key: 'verificar_numeros', label: 'Verificar Números', icon: <FaCheckCircle /> },
                        { key: 'gerenciar_proxies', label: 'Gerenciar Proxies', icon: <FaCheckCircle /> },
                        { key: 'chat_atendimento', label: 'Chat de Atendimento', icon: <FaComments /> },
                      ].map((field) => (
                        <label key={field.key} className="flex items-center gap-2 text-white cursor-pointer bg-gray-700/50 p-3 rounded-lg hover:bg-gray-700 transition-all">
                          <input
                            type="checkbox"
                            checked={formData.funcionalidades?.[field.key] || false}
                            onChange={(e) => setFormData({ 
                              ...formData, 
                              funcionalidades: {
                                ...formData.funcionalidades,
                                [field.key]: e.target.checked
                              }
                            })}
                            className="w-5 h-5 rounded text-purple-600 focus:ring-purple-500"
                          />
                          <span className="flex items-center gap-2">
                            {field.icon}
                            {field.label}
                          </span>
                        </label>
                      ))}
                    </div>

                    {/* Status do Plano */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-purple-500/30">
                      <label className="flex items-center gap-2 text-white cursor-pointer bg-gray-700/50 p-3 rounded-lg hover:bg-gray-700 transition-all">
                        <input
                          type="checkbox"
                          checked={formData.ativo}
                          onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                          className="w-5 h-5 rounded text-purple-600 focus:ring-purple-500"
                        />
                        <span className="flex items-center gap-2">
                          <FaCheckCircle />
                          Plano Ativo
                        </span>
                      </label>
                      <label className="flex items-center gap-2 text-white cursor-pointer bg-gray-700/50 p-3 rounded-lg hover:bg-gray-700 transition-all">
                        <input
                          type="checkbox"
                          checked={formData.visivel}
                          onChange={(e) => setFormData({ ...formData, visivel: e.target.checked })}
                          className="w-5 h-5 rounded text-purple-600 focus:ring-purple-500"
                        />
                        <span className="flex items-center gap-2">
                          <FaEye />
                          Visível (público)
                        </span>
                      </label>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Ordem de Exibição</label>
                      <input
                        type="number"
                        value={formData.ordem || 0}
                        onChange={(e) => {
                          const value = e.target.value === '' ? 0 : parseInt(e.target.value);
                          setFormData({ ...formData, ordem: isNaN(value) ? 0 : value });
                        }}
                        className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Botões de Ação */}
                <div className="flex gap-4 mt-6 justify-end">
                  <button
                    onClick={handleCancel}
                    className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-xl font-bold flex items-center gap-2 transition-all"
                  >
                    <FaTimes /> Cancelar
                  </button>
                  <button
                    onClick={handleSave}
                    className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold flex items-center gap-2 transition-all"
                  >
                    <FaSave /> Salvar Plano
                  </button>
                </div>
              </div>
            )}

            {/* Lista de Planos */}
            {!isCreating && !editingPlan && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {plans.map((plan) => (
                  <div
                    key={plan.id}
                    className="bg-gray-800/70 backdrop-blur-sm rounded-2xl p-6 shadow-2xl border-2 border-gray-700 hover:border-purple-500 transition-all"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-2xl font-bold text-white mb-1">{plan.nome}</h3>
                        <p className="text-gray-400 text-sm">{plan.descricao}</p>
                      </div>
                      <div className="flex gap-2">
                        {plan.ativo ? (
                          <FaCheckCircle className="text-green-400 text-xl" title="Ativo" />
                        ) : (
                          <FaTimesCircle className="text-red-400 text-xl" title="Inativo" />
                        )}
                        {plan.visivel ? (
                          <FaEye className="text-blue-400 text-xl" title="Visível" />
                        ) : (
                          <FaEyeSlash className="text-gray-400 text-xl" title="Oculto" />
                        )}
                      </div>
                    </div>

                    <div className="space-y-3 mb-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-300">Preço Mensal:</span>
                        <span className="text-white font-bold">R$ {Number(plan.preco_mensal || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-300">Preço Anual:</span>
                        <span className="text-white font-bold">R$ {Number(plan.preco_anual || 0).toFixed(2)}</span>
                      </div>
                      <div className="border-t border-gray-600 pt-2">
                        <p className="text-gray-400 text-xs mb-2">Limites:</p>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="text-gray-300">
                            <FaUsers className="inline mr-1" />
                            Usuários: <span className="text-white font-bold">{formatLimit(plan.limite_usuarios)}</span>
                          </div>
                          <div className="text-gray-300">
                            <FaWhatsapp className="inline mr-1" />
                            WhatsApp: <span className="text-white font-bold">{formatLimit(plan.limite_contas_whatsapp)}</span>
                          </div>
                          <div className="text-gray-300">
                            <FaEnvelope className="inline mr-1" />
                            Msg/dia: <span className="text-white font-bold">{formatLimit(plan.limite_mensagens_dia)}</span>
                          </div>
                          <div className="text-gray-300">
                            🔍 Consultas/dia: <span className="text-white font-bold">{formatLimit(plan.limite_consultas_dia)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="border-t border-gray-600 pt-2">
                        <p className="text-gray-400 text-xs mb-1">Tenants usando este plano:</p>
                        <p className="text-2xl font-bold text-purple-400">{plan.total_tenants}</p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(plan)}
                        className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold flex items-center justify-center gap-2 transition-all"
                      >
                        <FaEdit /> Editar
                      </button>
                      <button
                        onClick={() => handleDelete(plan.id)}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold flex items-center justify-center gap-2 transition-all"
                        disabled={plan.total_tenants > 0}
                        title={plan.total_tenants > 0 ? 'Não é possível excluir um plano em uso' : 'Excluir plano'}
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      
      {/* 🔔 NOTIFICAÇÕES TOAST */}
      <ToastContainer notifications={notifications} onRemove={removeNotification} />
    </AdminLayout>
  );
}

