import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import api from '@/services/api';
import { ToastContainer, useToast } from '@/components/Toast';
import { 
  FaUser, FaEnvelope, FaPhone, FaFileAlt, FaBuilding, FaCrown, 
  FaUsers, FaWhatsapp, FaBullhorn, FaEnvelopeOpenText, FaFileAlt as FaTemplate,
  FaAddressBook, FaChartLine, FaBan, FaCloud, FaLink, FaClipboardList,
  FaSave, FaArrowLeft, FaChartBar, FaUserFriends, FaSearch, FaCog,
  FaCheckCircle, FaTimesCircle, FaEdit, FaTrash, FaPlus, FaShieldAlt,
  FaTachometerAlt, FaHistory, FaSync, FaDollarSign, FaFileInvoice, FaCopy, FaSpinner,
  FaDatabase, FaInfoCircle, FaCoins, FaDownload, FaTimes, FaComments
} from 'react-icons/fa';
import { buildFileUrl } from '@/utils/urlHelpers';

interface Tenant {
  id: number;
  nome: string;
  slug: string;
  email: string;
  telefone: string;
  documento: string;
  plano: string;
  status: string;
  plan_id: number;
  plano_nome: string;
  proximo_vencimento?: string;
  limites_customizados: boolean;
  limite_usuarios_customizado: number | null;
  limite_whatsapp_customizado: number | null;
  limite_campanhas_simultaneas_customizado: number | null;
  limite_mensagens_dia_customizado: number | null;
  limite_novavida_mes_customizado: number | null;
  funcionalidades_customizadas: boolean;
  funcionalidades_config: any;
  plano_funcionalidades: any;
  uazap_credential_id: number | null;
  novavida_credential_id: number | null;
  uazap_credential_name?: string;
  novavida_credential_name?: string;
  consultas_avulsas_saldo?: number;
  total_usuarios: number;
  total_contas: number;
  total_campanhas: number;
  total_campanhas_qr: number;
  created_at: string;
  updated_at: string;
}

interface Plan {
  id: number;
  nome: string;
  slug: string;
  preco: number;
  limite_usuarios: number;
  limite_contas_whatsapp: number;
  limite_campanhas_mes: number;
  limite_mensagens_dia: number;
  limite_consultas_mes: number;
}

interface TenantStats {
  resumo?: any;
  usuarios?: any;
  contas?: any;
  campanhas_api?: any;
  campanhas_qr?: any;
  mensagens?: any;
  mensagens_api?: any;
  mensagens_qr?: any;
  templates?: any;
  base_dados?: any;
  nova_vida?: any;
  lista_restricao?: any;
  arquivos?: any;
  webhooks?: any;
  logs?: any;
  [key: string]: any;
}

interface TenantUser {
  id: number;
  nome: string;
  email: string;
  role: string;
  ativo: boolean;
  permissoes: any;
  avatar?: string;
  created_at: string;
  updated_at: string;
  ultimo_login?: string;
}

interface WhatsAppConnection {
  id: number;
  type: 'api' | 'qr';
  name: string;
  phone_number: string;
  is_active: boolean;
  is_connected?: boolean;
  whatsapp_display_name?: string;
  whatsapp_profile_picture?: string;
  phone_number_id?: string;
  created_at: string;
}

interface Payment {
  id: number;
  tenant_id: number;
  plan_id: number | null;
  valor: number;
  status: string;
  payment_type: string;
  due_date: string;
  descricao: string | null;
  asaas_payment_id: string | null;
  asaas_invoice_url: string | null;
  asaas_bank_slip_url: string | null;
  asaas_pix_qr_code: string | null;
  asaas_pix_copy_paste: string | null;
  paid_at: string | null;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
  metadata?: {
    tipo?: 'consultas_avulsas' | 'upgrade' | 'renovacao' | 'primeiro_pagamento';
    quantidade_consultas?: number;
    plano_nome?: string;
    plano_anterior?: string;
  };
}

export default function TenantDetailsPage() {
  const router = useRouter();
  const { id } = router.query;
  const { notifications, showNotification, removeNotification } = useToast();
  
  const [activeTab, setActiveTab] = useState<'visao-geral' | 'cadastro' | 'estatisticas' | 'usuarios' | 'conexoes' | 'limites' | 'funcionalidades' | 'financeiro' | 'consultas-avulsas' | 'logs'>('visao-geral');
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [stats, setStats] = useState<TenantStats | null>(null);
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingConnections, setLoadingConnections] = useState(false);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [syncingPayments, setSyncingPayments] = useState(false);
  const [markingAsPaid, setMarkingAsPaid] = useState<number | null>(null);
  const [cancellingPayment, setCancellingPayment] = useState<number | null>(null);
  const [selectedPayments, setSelectedPayments] = useState<Set<number>>(new Set());
  const [cancellingMultiple, setCancellingMultiple] = useState(false);
  const [connections, setConnections] = useState<WhatsAppConnection[]>([]);
  
  // Estados para consultas avulsas
  const [showConsultasAvulsasModal, setShowConsultasAvulsasModal] = useState(false);
  const [consultasAvulsasAction, setConsultasAvulsasAction] = useState<'add' | 'remove'>('add');
  const [consultasAvulsasQuantidade, setConsultasAvulsasQuantidade] = useState('');
  const [consultasAvulsasMotivo, setConsultasAvulsasMotivo] = useState('');
  const [processingConsultasAvulsas, setProcessingConsultasAvulsas] = useState(false);
  const [consultasAvulsasHistory, setConsultasAvulsasHistory] = useState<any[]>([]);
  const [consultasAvulsasUsage, setConsultasAvulsasUsage] = useState<any[]>([]);
  
  // Estados para filtros de dashboard
  const [dashboardDataInicio, setDashboardDataInicio] = useState('');
  const [dashboardDataFim, setDashboardDataFim] = useState('');
  
  // Estados para gerenciamento de pacotes
  const [showPacotesModal, setShowPacotesModal] = useState(false);
  const [pacotes, setPacotes] = useState<any[]>([]);
  const [editingPacote, setEditingPacote] = useState<any>(null);
  const [pacoteForm, setPacoteForm] = useState({
    nome: '',
    quantidade: '',
    preco_unitario: '',
    preco: '',
    desconto: '0',
    popular: false,
    ativo: true,
    ordem: '0'
  });
  const [loadingPacotes, setLoadingPacotes] = useState(false);
  const [savingPacote, setSavingPacote] = useState(false);

  // Estados para gerenciamento de faixas de preço
  const [showFaixasModal, setShowFaixasModal] = useState(false);
  const [faixasPreco, setFaixasPreco] = useState<any[]>([]);
  const [editingFaixa, setEditingFaixa] = useState<any>(null);
  const [faixaForm, setFaixaForm] = useState({
    quantidade_min: '',
    quantidade_max: '',
    preco_unitario: ''
  });
  const [loadingFaixas, setLoadingFaixas] = useState(false);
  const [savingFaixa, setSavingFaixa] = useState(false);

  // Função para atualizar o preço total com base no preço unitário e quantidade
  const handlePacoteFormChange = (field: string, value: any) => {
    const newForm = { ...pacoteForm, [field]: value };

    // Se alterou quantidade ou preço unitário, recalcula o preço total
    if (field === 'quantidade' || field === 'preco_unitario') {
      const qtd = parseFloat(field === 'quantidade' ? value : newForm.quantidade);
      const precoUnit = parseFloat(field === 'preco_unitario' ? value : newForm.preco_unitario);
      
      if (!isNaN(qtd) && !isNaN(precoUnit) && qtd > 0 && precoUnit > 0) {
        newForm.preco = (qtd * precoUnit).toFixed(2);
      }
    }
    
    // Se alterou o preço total, recalcula o preço unitário
    if (field === 'preco') {
      const qtd = parseFloat(newForm.quantidade);
      const precoTotal = parseFloat(value);
      
      if (!isNaN(qtd) && !isNaN(precoTotal) && qtd > 0) {
        newForm.preco_unitario = (precoTotal / qtd).toFixed(2);
      }
    }

    setPacoteForm(newForm);
  };
  const [loadingConsultasAvulsas, setLoadingConsultasAvulsas] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logsPagination, setLogsPagination] = useState({ page: 1, total: 0, pages: 0 });
  const [logDataInicio, setLogDataInicio] = useState('');
  const [logDataFim, setLogDataFim] = useState('');
  
  // Filtros de data para estatísticas
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  
  // Estados para gerenciamento de usuários
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [editingUser, setEditingUser] = useState<TenantUser | null>(null);
  const [userForm, setUserForm] = useState({
    nome: '',
    email: '',
    senha: '',
    role: 'user',
    permissoes: {} as any,
    ativo: true
  });
  
  const [editForm, setEditForm] = useState({
    nome: '',
    email: '',
    telefone: '',
    documento: '',
    plan_id: 0,
    status: 'active',
    proximo_vencimento: '',
    limites_customizados: false,
    limite_usuarios_customizado: null as number | null,
    limite_whatsapp_customizado: null as number | null,
    limite_campanhas_simultaneas_customizado: null as number | null,
    limite_mensagens_dia_customizado: null as number | null,
    limite_novavida_mes_customizado: null as number | null,
    funcionalidades_customizadas: false,
    funcionalidades_config: {} as any,
    uazap_credential_id: null as number | null,
    novavida_credential_id: null as number | null,
  });

  const [uazapCredentials, setUazapCredentials] = useState<any[]>([]);
  const [novaVidaCredentials, setNovaVidaCredentials] = useState<any[]>([]);

  const todasFuncionalidades = [
    { key: 'whatsapp_api', label: 'WhatsApp API Oficial', icon: FaWhatsapp },
    { key: 'whatsapp_qr', label: 'WhatsApp QR Connect', icon: FaWhatsapp },
    { key: 'consulta_dados', label: '📊 Consulta de Dados', icon: FaDatabase },
    { key: 'verificar_numeros', label: '🔍 Verificar Números', icon: FaCheckCircle },
    { key: 'gerenciar_proxies', label: '🌐 Gerenciar Proxies', icon: FaShieldAlt },
    { key: 'chat_atendimento', label: '💬 Chat de Atendimento', icon: FaComments },
    { key: 'campanhas', label: 'Campanhas', icon: FaBullhorn },
    { key: 'templates', label: 'Templates', icon: FaTemplate },
    { key: 'lista_restricao', label: 'Lista de Restrição', icon: FaBan },
    { key: 'webhooks', label: 'Webhooks', icon: FaLink },
    { key: 'relatorios', label: 'Relatórios', icon: FaChartBar },
    { key: 'nova_vida', label: 'Nova Vida', icon: FaSearch },
    { key: 'envio_imediato', label: 'Envio Imediato', icon: FaBullhorn },
    { key: 'catalogo', label: 'Catálogo', icon: FaAddressBook },
    { key: 'dashboard', label: 'Dashboard', icon: FaTachometerAlt },
  ];

  // Filtrar funcionalidades baseadas no plano do tenant
  const funcionalidadesDisponiveis = todasFuncionalidades.filter(func => {
    // Se não temos informações do tenant, não mostrar nada
    if (!tenant) {
      return false;
    }
    
    // Se não temos informações do plano, não mostrar (será exibida mensagem)
    if (!tenant.plano_funcionalidades) {
      console.warn('⚠️ Plano não tem funcionalidades configuradas:', tenant.plano_nome || tenant.plano);
      return false;
    }
    
    // Mostrar apenas funcionalidades que estão habilitadas no plano
    const estaNoPlano = tenant.plano_funcionalidades[func.key] === true;
    
    // Debug: mostrar quais funcionalidades estão sendo filtradas
    if (estaNoPlano) {
      console.log(`✅ ${func.label} - está no plano`);
    } else {
      console.log(`❌ ${func.label} - NÃO está no plano`);
    }
    
    return estaNoPlano;
  });

  useEffect(() => {
    if (id) {
      loadTenantData();
      loadPlans();
      loadStats();
      loadUsers();
      loadCredentials();
      loadPayments(); // Carregar pagamentos para o dashboard
      loadConsultasAvulsasData(); // Carregar consultas avulsas para o dashboard
    }
  }, [id]);

  useEffect(() => {
    if (id && activeTab === 'logs') {
      loadLogs();
    }
  }, [id, activeTab]);

  const loadTenantData = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/admin/tenants/${id}`);
      const tenantData = response.data.data;
      setTenant(tenantData);
      
      setEditForm({
        nome: tenantData.nome || '',
        email: tenantData.email || '',
        telefone: tenantData.telefone || '',
        documento: tenantData.documento || '',
        plan_id: tenantData.plan_id || 0,
        status: tenantData.status || 'active',
        proximo_vencimento: tenantData.proximo_vencimento || '',
        limites_customizados: tenantData.limites_customizados || false,
        limite_usuarios_customizado: tenantData.limite_usuarios_customizado,
        limite_whatsapp_customizado: tenantData.limite_whatsapp_customizado,
        limite_campanhas_simultaneas_customizado: tenantData.limite_campanhas_simultaneas_customizado,
        limite_mensagens_dia_customizado: tenantData.limite_mensagens_dia_customizado,
        limite_novavida_mes_customizado: tenantData.limite_novavida_mes_customizado,
        funcionalidades_customizadas: tenantData.funcionalidades_customizadas || false,
        funcionalidades_config: tenantData.funcionalidades_config || {},
        uazap_credential_id: tenantData.uazap_credential_id || null,
        novavida_credential_id: tenantData.novavida_credential_id || null,
      });
    } catch (error) {
      console.error('Erro ao carregar tenant:', error);
      showNotification('❌ Erro ao carregar dados', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadPlans = async () => {
    try {
      const response = await api.get('/admin/plans');
      setPlans(response.data.data || []);
    } catch (error) {
      console.error('Erro ao carregar planos:', error);
    }
  };

  const loadCredentials = async () => {
    try {
      const [uazapResponse, novaVidaResponse] = await Promise.all([
        api.get('/admin/credentials/uazap'),
        api.get('/admin/credentials/novavida')
      ]);
      setUazapCredentials(uazapResponse.data.data || []);
      setNovaVidaCredentials(novaVidaResponse.data.data || []);
    } catch (error) {
      console.error('Erro ao carregar credenciais:', error);
    }
  };

  const loadStats = async (inicio?: string, fim?: string) => {
    try {
      setLoadingStats(true);
      let url = `/admin/tenants/${id}/stats`;
      const params = new URLSearchParams();
      if (inicio) params.append('dataInicio', inicio);
      if (fim) params.append('dataFim', fim);
      if (params.toString()) url += `?${params.toString()}`;
      
      const response = await api.get(url);
      setStats(response.data.data);
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  const loadUsers = async () => {
    try {
      setLoadingUsers(true);
      const response = await api.get(`/admin/tenants/${id}/users`);
      setUsers(response.data.data || []);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      showNotification('❌ Erro ao carregar usuários', 'error');
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadConnections = async () => {
    try {
      setLoadingConnections(true);
      const response = await api.get(`/admin/tenants/${id}/connections`);
      setConnections(response.data.data || []);
    } catch (error) {
      console.error('Erro ao carregar conexões:', error);
      showNotification('❌ Erro ao carregar conexões', 'error');
    } finally {
      setLoadingConnections(false);
    }
  };

  const loadPayments = async () => {
    try {
      setLoadingPayments(true);
      const response = await api.get(`/admin/tenants/${id}/payments`);
      setPayments(response.data.data || []);
    } catch (error) {
      console.error('Erro ao carregar pagamentos:', error);
      showNotification('❌ Erro ao carregar pagamentos', 'error');
    } finally {
      setLoadingPayments(false);
    }
  };

  // Sincronizar pagamentos com Asaas
  const handleSyncPayments = async () => {
    try {
      setSyncingPayments(true);
      
      const response = await api.post(`/admin/tenants/${id}/sync-payments`);
      
      let message = `📊 Sincronização Concluída:\n\n`;
      message += `✅ Pagamentos atualizados: ${response.data.updated}\n`;
      message += `📋 Total de pendentes verificados: ${response.data.total}\n`;
      
      if (response.data.notFound > 0) {
        message += `⚠️ Pagamentos não encontrados no Asaas: ${response.data.notFound}\n`;
        message += `\n💡 Se o pagamento foi feito, use o botão "Marcar como Pago" para ativar manualmente.`;
      }
      
      if (response.data.errors && response.data.errors.length > 0) {
        message += `\n\n❌ Erros:\n${response.data.errors.slice(0, 3).join('\n')}`;
      }
      
      showNotification(message, 'success');
      
      if (response.data.updated > 0) {
        await loadPayments();
        await loadTenantData();
      }
    } catch (error: any) {
      console.error('Erro ao sincronizar pagamentos:', error);
      showNotification('❌ Erro ao sincronizar', 'error');
    } finally {
      setSyncingPayments(false);
    }
  };

  // Marcar pagamento como pago manualmente
  const handleMarkAsPaid = async (paymentId: number) => {
    if (!confirm('⚠️ Tem certeza que deseja marcar este pagamento como PAGO?\n\nIsso vai:\n✅ Ativar o plano do cliente\n✅ Estender a data de vencimento\n✅ Liberar o acesso ao sistema')) {
      return;
    }

    try {
      setMarkingAsPaid(paymentId);
      
      const response = await api.post(`/admin/tenants/${id}/mark-payment-paid/${paymentId}`);
      
      showNotification('✅ Pagamento confirmado!', 'success');
      
      await loadPayments();
      await loadTenantData();
    } catch (error: any) {
      console.error('Erro ao marcar como pago:', error);
      showNotification('❌ Erro na operação', 'error');
    } finally {
      setMarkingAsPaid(null);
    }
  };

  const handleCancelPayment = async (paymentId: number) => {
    if (!confirm('⚠️ Tem certeza que deseja CANCELAR este pagamento?\n\nIsso vai:\n❌ Cancelar a cobrança no Asaas\n❌ Remover o boleto/PIX\n\nEsta ação não pode ser desfeita!')) {
      return;
    }

    try {
      setCancellingPayment(paymentId);
      
      const response = await api.post(`/admin/tenants/${id}/cancel-payment/${paymentId}`);
      
      showNotification('✅ Pagamento cancelado!', 'success');
      
      await loadPayments();
    } catch (error: any) {
      console.error('Erro ao cancelar pagamento:', error);
      showNotification('❌ Erro na operação', 'error');
    } finally {
      setCancellingPayment(null);
    }
  };

  const handleCancelMultiplePayments = async () => {
    if (selectedPayments.size === 0) {
      showNotification('⚠️ Selecione um pagamento', 'warning');
      return;
    }

    if (!confirm(`⚠️ Tem certeza que deseja CANCELAR ${selectedPayments.size} pagamento(s)?\n\nIsso vai:\n❌ Cancelar as cobranças no Asaas\n❌ Remover os boletos/PIX\n\nEsta ação não pode ser desfeita!`)) {
      return;
    }

    try {
      setCancellingMultiple(true);
      
      const payment_ids = Array.from(selectedPayments);
      const response = await api.post(`/admin/tenants/${id}/cancel-multiple-payments`, {
        payment_ids
      });
      
      let message = `✅ Cancelamento Concluído:\n\n`;
      message += `✅ Pagamentos cancelados: ${response.data.data.cancelled}\n`;
      
      if (response.data.data.already_cancelled > 0) {
        message += `ℹ️ Já estavam cancelados: ${response.data.data.already_cancelled}\n`;
      }
      
      if (response.data.data.already_paid > 0) {
        message += `⚠️ Já foram pagos (não cancelados): ${response.data.data.already_paid}\n`;
      }
      
      if (response.data.data.errors && response.data.data.errors.length > 0) {
        message += `\n❌ Erros:\n${response.data.data.errors.slice(0, 3).join('\n')}`;
      }
      
      showNotification(message, 'success');
      
      setSelectedPayments(new Set());
      await loadPayments();
    } catch (error: any) {
      console.error('Erro ao cancelar múltiplos pagamentos:', error);
      showNotification('❌ Erro na operação', 'error');
    } finally {
      setCancellingMultiple(false);
    }
  };

  const handleTogglePaymentSelection = (paymentId: number) => {
    const newSelection = new Set(selectedPayments);
    if (newSelection.has(paymentId)) {
      newSelection.delete(paymentId);
    } else {
      newSelection.add(paymentId);
    }
    setSelectedPayments(newSelection);
  };

  const handleSelectAllPayments = () => {
    if (selectedPayments.size === payments.length) {
      setSelectedPayments(new Set());
    } else {
      const allIds = payments.map(p => p.id);
      setSelectedPayments(new Set(allIds));
    }
  };

  // Helper para formatar data do input (YYYY-MM-DD) para DD/MM/YYYY sem conversão de timezone
  const formatInputDate = (dateString: string): string => {
    if (!dateString) return '';
    const [ano, mes, dia] = dateString.split('-');
    return `${dia}/${mes}/${ano}`;
  };

  // Funções de filtro do dashboard
  const setDashboardPeriodo = (dias: number) => {
    const hoje = new Date();
    const dataFim = hoje.toISOString().split('T')[0];
    
    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - dias);
    const dataInicioStr = dataInicio.toISOString().split('T')[0];
    
    setDashboardDataInicio(dataInicioStr);
    setDashboardDataFim(dataFim);
  };

  const limparFiltrosDashboard = () => {
    setDashboardDataInicio('');
    setDashboardDataFim('');
  };

  // Filtrar pagamentos por data
  const paymentsFiltered = payments.filter(payment => {
    if (!dashboardDataInicio && !dashboardDataFim) return true;
    
    const paymentDate = new Date(payment.created_at);
    const inicio = dashboardDataInicio ? new Date(dashboardDataInicio + 'T00:00:00') : null;
    const fim = dashboardDataFim ? new Date(dashboardDataFim + 'T23:59:59') : null;
    
    if (inicio && paymentDate < inicio) return false;
    if (fim && paymentDate > fim) return false;
    
    return true;
  });

  // Filtrar histórico de consultas por data
  const consultasHistoryFiltered = consultasAvulsasHistory.filter(history => {
    if (!dashboardDataInicio && !dashboardDataFim) return true;
    
    const historyDate = new Date(history.created_at);
    const inicio = dashboardDataInicio ? new Date(dashboardDataInicio + 'T00:00:00') : null;
    const fim = dashboardDataFim ? new Date(dashboardDataFim + 'T23:59:59') : null;
    
    if (inicio && historyDate < inicio) return false;
    if (fim && historyDate > fim) return false;
    
    return true;
  });

  // Filtrar uso de consultas por data
  const consultasUsageFiltered = consultasAvulsasUsage.filter(usage => {
    if (!dashboardDataInicio && !dashboardDataFim) return true;
    
    const usageDate = new Date(usage.created_at);
    const inicio = dashboardDataInicio ? new Date(dashboardDataInicio + 'T00:00:00') : null;
    const fim = dashboardDataFim ? new Date(dashboardDataFim + 'T23:59:59') : null;
    
    if (inicio && usageDate < inicio) return false;
    if (fim && usageDate > fim) return false;
    
    return true;
  });

  // Gerenciar consultas avulsas
  const handleConsultasAvulsas = async () => {
    const quantidade = parseInt(consultasAvulsasQuantidade);
    
    if (!quantidade || quantidade <= 0) {
      showNotification('⚠️ Quantidade inválida', 'warning');
      return;
    }

    if (!consultasAvulsasMotivo.trim()) {
      showNotification('⚠️ Informe o motivo', 'warning');
      return;
    }

    const action = consultasAvulsasAction === 'add' ? 'adicionar' : 'remover';
    const confirmMsg = `⚠️ Confirma ${action} ${quantidade} consultas avulsas?\n\nMotivo: ${consultasAvulsasMotivo}`;
    
    if (!confirm(confirmMsg)) {
      return;
    }

    try {
      setProcessingConsultasAvulsas(true);
      
      const endpoint = consultasAvulsasAction === 'add' 
        ? `/admin/tenants/${id}/add-consultas-avulsas`
        : `/admin/tenants/${id}/remove-consultas-avulsas`;
      
      const response = await api.post(endpoint, {
        quantidade,
        motivo: consultasAvulsasMotivo
      });
      
      showNotification(`✅ Saldo atualizado: ${response.data.data.novo_saldo}`, 'success');
      
      // Limpar form
      setConsultasAvulsasQuantidade('');
      setConsultasAvulsasMotivo('');
      setShowConsultasAvulsasModal(false);
      
      // Recarregar dados
      await loadTenantData();
      
    } catch (error: any) {
      console.error('Erro ao gerenciar consultas avulsas:', error);
      showNotification('❌ Erro na operação', 'error');
    } finally {
      setProcessingConsultasAvulsas(false);
    }
  };

  const loadLogs = async (page = 1) => {
    try {
      setLoadingLogs(true);
      const params: any = { page, limit: 50 };
      
      if (logDataInicio) {
        params.dataInicio = logDataInicio;
      }
      
      if (logDataFim) {
        params.dataFim = logDataFim;
      }
      
      const response = await api.get(`/admin/tenants/${id}/logs`, { params });
      setLogs(response.data.data || []);
      setLogsPagination(response.data.pagination || { page: 1, total: 0, pages: 0 });
    } catch (error) {
      console.error('Erro ao carregar logs:', error);
      showNotification('❌ Erro ao carregar logs', 'error');
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleDeleteAllLogs = async () => {
    if (!confirm('⚠️ TEM CERTEZA que deseja EXCLUIR TODOS OS LOGS deste tenant?\n\nEsta ação é IRREVERSÍVEL!')) {
      return;
    }

    try {
      await api.delete(`/admin/tenants/${id}/logs`);
      showNotification('✅ Logs excluídos!', 'success');
      loadLogs(1);
    } catch (error: any) {
      console.error('Erro ao excluir logs:', error);
      showNotification('❌ Erro ao excluir logs', 'error');
    }
  };

  const loadConsultasAvulsasData = async () => {
    try {
      setLoadingConsultasAvulsas(true);
      
      // Carregar histórico de recargas (audit_logs)
      const historyResponse = await api.get(`/admin/tenants/${id}/consultas-avulsas/history`);
      setConsultasAvulsasHistory(historyResponse.data.history || []);
      
      // Carregar consultas usadas com créditos avulsos
      const usageResponse = await api.get(`/admin/tenants/${id}/consultas-avulsas/usage`);
      setConsultasAvulsasUsage(usageResponse.data.usage || []);
    } catch (error: any) {
      console.error('Erro ao carregar dados de consultas avulsas:', error);
      showNotification('❌ Erro ao carregar dados', 'error');
    } finally {
      setLoadingConsultasAvulsas(false);
    }
  };

  const handleDownloadConsultasAvulsasReport = async () => {
    try {
      const response = await api.get(`/admin/tenants/${id}/consultas-avulsas/report`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `consultas-avulsas-${tenant?.nome || 'tenant'}-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      showNotification('✅ Relatório baixado!', 'success');
    } catch (error: any) {
      console.error('Erro ao baixar relatório:', error);
      showNotification('❌ Erro ao baixar', 'error');
    }
  };

  // ============================================
  // FUNÇÕES DE GERENCIAMENTO DE PACOTES
  // ============================================

  const loadPacotes = async () => {
    try {
      setLoadingPacotes(true);
      const response = await api.get('/admin/pacotes-consultas');
      
      if (response.data.success) {
        setPacotes(response.data.pacotes || []);
        console.log(`✅ ${response.data.pacotes?.length || 0} pacotes carregados`);
      }
    } catch (error: any) {
      console.error('Erro ao carregar pacotes:', error);
      showNotification('❌ Erro ao carregar pacotes', 'error');
    } finally {
      setLoadingPacotes(false);
    }
  };

  const handleSavePacote = async () => {
    try {
      // Validações
      if (!pacoteForm.nome || !pacoteForm.quantidade || !pacoteForm.preco) {
        showNotification('⚠️ Preencha todos os campos', 'warning');
        return;
      }

      if (parseInt(pacoteForm.quantidade) <= 0 || parseFloat(pacoteForm.preco) <= 0) {
        showNotification('⚠️ Valores inválidos', 'warning');
        return;
      }

      setSavingPacote(true);

      const pacoteData = {
        nome: pacoteForm.nome,
        quantidade: parseInt(pacoteForm.quantidade),
        preco: parseFloat(pacoteForm.preco),
        desconto: parseInt(pacoteForm.desconto || '0'),
        popular: pacoteForm.popular,
        ativo: pacoteForm.ativo,
        ordem: parseInt(pacoteForm.ordem || '0')
      };

      if (editingPacote) {
        // Atualizar pacote existente
        await api.put(`/admin/pacotes-consultas/${editingPacote.id}`, pacoteData);
        showNotification('✅ Pacote atualizado!', 'success');
      } else {
        // Criar novo pacote
        await api.post('/admin/pacotes-consultas', pacoteData);
        showNotification('✅ Pacote criado!', 'success');
      }

      // Recarregar lista
      await loadPacotes();

      // Limpar formulário e fechar modal
      setPacoteForm({
        nome: '',
        quantidade: '',
        preco_unitario: '',
        preco: '',
        desconto: '0',
        popular: false,
        ativo: true,
        ordem: '0'
      });
      setEditingPacote(null);
    } catch (error: any) {
      console.error('Erro ao salvar pacote:', error);
      showNotification('❌ Erro ao salvar pacote', 'error');
    } finally {
      setSavingPacote(false);
    }
  };

  const handleEditPacote = (pacote: any) => {
    setEditingPacote(pacote);
    setPacoteForm({
      nome: pacote.nome,
      quantidade: pacote.quantidade.toString(),
      preco_unitario: pacote.preco_unitario.toString(),
      preco: pacote.preco.toString(),
      desconto: pacote.desconto.toString(),
      popular: pacote.popular,
      ativo: pacote.ativo,
      ordem: pacote.ordem.toString()
    });
  };

  const handleDeletePacote = async (pacoteId: number) => {
    if (!confirm('⚠️ Tem certeza que deseja deletar este pacote?')) {
      return;
    }

    try {
      await api.delete(`/admin/pacotes-consultas/${pacoteId}`);
      showNotification('✅ Pacote deletado!', 'success');
      await loadPacotes();
    } catch (error: any) {
      console.error('Erro ao deletar pacote:', error);
      showNotification('❌ Erro ao deletar pacote', 'error');
    }
  };

  const handleTogglePopular = async (pacoteId: number) => {
    try {
      await api.patch(`/admin/pacotes-consultas/${pacoteId}/toggle-popular`);
      showNotification('✅ Pacote marcado como popular!', 'success');
      await loadPacotes();
    } catch (error: any) {
      console.error('Erro ao marcar pacote como popular:', error);
      showNotification('❌ Erro na operação', 'error');
    }
  };

  // ============================================
  // FUNÇÕES DE GERENCIAMENTO DE FAIXAS DE PREÇO
  // ============================================

  const loadFaixasPreco = async () => {
    try {
      setLoadingFaixas(true);
      const response = await api.get('/admin/faixas-preco-consultas');
      
      if (response.data.success) {
        setFaixasPreco(response.data.faixas || []);
        console.log(`✅ ${response.data.faixas?.length || 0} faixas carregadas`);
      }
    } catch (error: any) {
      console.error('Erro ao carregar faixas:', error);
      showNotification('❌ Erro ao carregar faixas', 'error');
    } finally {
      setLoadingFaixas(false);
    }
  };

  const handleSaveFaixa = async () => {
    try {
      // Validações
      if (!faixaForm.quantidade_min || !faixaForm.preco_unitario) {
        showNotification('⚠️ Preencha todos os campos', 'warning');
        return;
      }

      if (parseInt(faixaForm.quantidade_min) < 0 || parseFloat(faixaForm.preco_unitario) <= 0) {
        showNotification('⚠️ Valores inválidos', 'warning');
        return;
      }

      if (faixaForm.quantidade_max && parseInt(faixaForm.quantidade_max) <= parseInt(faixaForm.quantidade_min)) {
        showNotification('⚠️ Valores inválidos', 'warning');
        return;
      }

      setSavingFaixa(true);

      const faixaData = {
        quantidade_min: parseInt(faixaForm.quantidade_min),
        quantidade_max: faixaForm.quantidade_max ? parseInt(faixaForm.quantidade_max) : null,
        preco_unitario: parseFloat(faixaForm.preco_unitario),
        ativo: true,
        ordem: 0
      };

      if (editingFaixa) {
        // Atualizar faixa existente
        await api.put(`/admin/faixas-preco-consultas/${editingFaixa.id}`, faixaData);
        showNotification('✅ Faixa atualizada!', 'success');
      } else {
        // Criar nova faixa
        await api.post('/admin/faixas-preco-consultas', faixaData);
        showNotification('✅ Faixa criada!', 'success');
      }

      // Recarregar lista
      await loadFaixasPreco();

      // Limpar formulário
      setFaixaForm({
        quantidade_min: '',
        quantidade_max: '',
        preco_unitario: ''
      });
      setEditingFaixa(null);
    } catch (error: any) {
      console.error('Erro ao salvar faixa:', error);
      showNotification('❌ Erro ao salvar faixa', 'error');
    } finally {
      setSavingFaixa(false);
    }
  };

  const handleEditFaixa = (faixa: any) => {
    setEditingFaixa(faixa);
    setFaixaForm({
      quantidade_min: faixa.quantidade_min.toString(),
      quantidade_max: faixa.quantidade_max ? faixa.quantidade_max.toString() : '',
      preco_unitario: faixa.preco_unitario.toString()
    });
  };

  const handleDeleteFaixa = async (faixaId: number) => {
    if (!confirm('⚠️ Tem certeza que deseja deletar esta faixa?')) {
      return;
    }

    try {
      await api.delete(`/admin/faixas-preco-consultas/${faixaId}`);
      showNotification('✅ Faixa deletada!', 'success');
      await loadFaixasPreco();
    } catch (error: any) {
      console.error('Erro ao deletar faixa:', error);
      showNotification('❌ Erro ao deletar faixa', 'error');
    }
  };

  const handleOpenCreateUserModal = () => {
    setUserForm({
      nome: '',
      email: '',
      senha: '',
      role: 'user',
      permissoes: {},
      ativo: true
    });
    setIsCreatingUser(true);
  };

  const handleOpenEditUserModal = (user: TenantUser) => {
    setUserForm({
      nome: user.nome,
      email: user.email,
      senha: '',
      role: user.role,
      permissoes: user.permissoes || {},
      ativo: user.ativo
    });
    setEditingUser(user);
  };

  const handleCreateUser = async () => {
    if (!userForm.nome || !userForm.email || !userForm.senha) {
      showNotification('⚠️ Campos obrigatórios faltando', 'warning');
      return;
    }

    try {
      setSaving(true);
      await api.post(`/admin/tenants/${id}/users`, userForm);
      showNotification('✅ Usuário criado!', 'success');
      setIsCreatingUser(false);
      loadUsers();
    } catch (error: any) {
      showNotification('❌ Erro ao criar usuário', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    
    if (!userForm.nome || !userForm.email) {
      showNotification('⚠️ Nome e email obrigatórios', 'warning');
      return;
    }

    try {
      setSaving(true);
      const updateData: any = {
        nome: userForm.nome,
        email: userForm.email,
        role: userForm.role,
        permissoes: userForm.permissoes,
        ativo: userForm.ativo
      };

      // Só incluir senha se foi alterada
      if (userForm.senha) {
        updateData.senha = userForm.senha;
      }

      await api.put(`/admin/tenants/${id}/users/${editingUser.id}`, updateData);
      showNotification('✅ Usuário atualizado!', 'success');
      setEditingUser(null);
      loadUsers();
    } catch (error: any) {
      showNotification('❌ Erro ao atualizar usuário', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async (user: TenantUser) => {
    if (!confirm(`⚠️ Tem certeza que deseja excluir o usuário "${user.nome}"?\n\nEsta ação não pode ser desfeita!`)) return;

    try {
      await api.delete(`/admin/tenants/${id}/users/${user.id}`);
      showNotification('✅ Usuário excluído!', 'success');
      loadUsers();
    } catch (error: any) {
      showNotification('❌ Erro ao excluir usuário', 'error');
    }
  };

  const handleToggleUserPermissao = (key: string) => {
    setUserForm({
      ...userForm,
      permissoes: {
        ...userForm.permissoes,
        [key]: !userForm.permissoes[key]
      }
    });
  };

  const handleToggleConnectionActive = async (connection: WhatsAppConnection) => {
    const action = connection.is_active ? 'desativar' : 'ativar';
    if (!confirm(`Tem certeza que deseja ${action} a conexão "${connection.name}"?`)) return;

    try {
      const endpoint = connection.type === 'api' 
        ? `/admin/tenants/${id}/connections/api/${connection.id}/${action}`
        : `/admin/tenants/${id}/connections/qr/${connection.id}/${action}`;
      
      await api.post(endpoint);
      showNotification(`✅ Conexão ${action === 'ativar' ? 'ativada' : 'desativada'}!`, 'success');
      loadConnections();
    } catch (error: any) {
      showNotification(`❌ Erro ao ${action} conexão`, 'error');
    }
  };

  const handleDeleteConnection = async (connection: WhatsAppConnection) => {
    if (!confirm(`⚠️ Tem certeza que deseja excluir a conexão "${connection.name}"?\n\nEsta ação não pode ser desfeita!`)) return;

    try {
      const endpoint = connection.type === 'api'
        ? `/admin/tenants/${id}/connections/api/${connection.id}`
        : `/admin/tenants/${id}/connections/qr/${connection.id}`;
      
      await api.delete(endpoint);
      showNotification('✅ Conexão excluída!', 'success');
      loadConnections();
    } catch (error: any) {
      showNotification('❌ Erro ao excluir conexão', 'error');
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      // 1. Atualizar dados básicos do tenant
      await api.put(`/admin/tenants/${id}`, editForm);
      
      // 2. Se o vencimento foi alterado, chamar endpoint especial
      if (editForm.proximo_vencimento && editForm.proximo_vencimento !== tenant?.proximo_vencimento) {
        const response = await api.patch(`/admin/tenants/${id}/expiration`, {
          proximo_vencimento: editForm.proximo_vencimento
        });
        
        if (response.data.data?.desbloqueado) {
          showNotification('✅ Tenant atualizado e desbloqueado!', 'success');
        } else {
          showNotification('✅ Tenant atualizado!', 'success');
        }
      } else {
        showNotification('✅ Tenant atualizado!', 'success');
      }
      
      loadTenantData();
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      showNotification('❌ Erro ao salvar', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAplicarFiltro = () => {
    if (!dataInicio && !dataFim) {
      showNotification('⚠️ Selecione uma data', 'warning');
      return;
    }
    loadStats(dataInicio, dataFim);
  };

  const handleLimparFiltro = () => {
    setDataInicio('');
    setDataFim('');
    loadStats();
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-500/20 text-green-300 border-green-500/50',
      inactive: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50',
      suspended: 'bg-red-500/20 text-red-300 border-red-500/50',
      blocked: 'bg-red-500/20 text-red-300 border-red-500/50'
    };
    return colors[status] || colors.active;
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      active: 'Ativo',
      inactive: 'Inativo',
      suspended: 'Suspenso',
      blocked: 'Bloqueado'
    };
    return labels[status] || status;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-emerald-500 mx-auto"></div>
          <p className="text-white mt-4 text-lg">Carregando dados do tenant...</p>
        </div>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="bg-red-500/20 border-2 border-red-500 rounded-xl p-8">
          <h2 className="text-2xl font-bold text-red-400 mb-4">Tenant não encontrado</h2>
          <button
            onClick={() => router.push('/admin/tenants')}
            className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-bold transition-all"
          >
            Voltar para Lista de Tenants
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <header className="bg-gradient-to-r from-gray-900 to-gray-800 border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/admin/tenants')}
                className="p-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl transition-all"
                title="Voltar"
              >
                <FaArrowLeft className="text-xl" />
              </button>
              <div className="bg-emerald-500 p-3 rounded-2xl">
                <FaBuilding className="text-white text-2xl" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-white">{tenant.nome}</h1>
                <p className="text-sm text-gray-400">
                  ID: {tenant.id} | Slug: <span className="font-mono text-emerald-400">{tenant.slug}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className={`px-4 py-2 rounded-lg font-bold border-2 ${getStatusColor(tenant.status)}`}>
                {getStatusLabel(tenant.status)}
              </span>
              <span className="px-4 py-2 rounded-lg font-bold bg-purple-500/20 text-purple-300 border-2 border-purple-500/50">
                {tenant.plano_nome || tenant.plano}
              </span>
            </div>
          </div>

          {/* Tabs Navigation */}
          <nav className="flex gap-2 overflow-x-auto pb-2">
            <button
              onClick={() => setActiveTab('visao-geral')}
              className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 whitespace-nowrap transition-all ${
                activeTab === 'visao-geral'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-700/50 hover:bg-emerald-600 text-white'
              }`}
            >
              <FaTachometerAlt /> Visão Geral
            </button>
            <button
              onClick={() => setActiveTab('cadastro')}
              className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 whitespace-nowrap transition-all ${
                activeTab === 'cadastro'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-700/50 hover:bg-emerald-600 text-white'
              }`}
            >
              <FaEdit /> Editar Cadastro
            </button>
            <button
              onClick={() => setActiveTab('estatisticas')}
              className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 whitespace-nowrap transition-all ${
                activeTab === 'estatisticas'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-700/50 hover:bg-emerald-600 text-white'
              }`}
            >
              <FaChartBar /> Estatísticas
            </button>
            <button
              onClick={() => setActiveTab('usuarios')}
              className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 whitespace-nowrap transition-all ${
                activeTab === 'usuarios'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-700/50 hover:bg-emerald-600 text-white'
              }`}
            >
              <FaUsers /> Usuários
            </button>
            <button
              onClick={() => {
                setActiveTab('conexoes');
                if (connections.length === 0) loadConnections();
              }}
              className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 whitespace-nowrap transition-all ${
                activeTab === 'conexoes'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-700/50 hover:bg-emerald-600 text-white'
              }`}
            >
              <FaWhatsapp /> Conexões
            </button>
            <button
              onClick={() => setActiveTab('limites')}
              className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 whitespace-nowrap transition-all ${
                activeTab === 'limites'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-700/50 hover:bg-emerald-600 text-white'
              }`}
            >
              <FaShieldAlt /> Limites
            </button>
            <button
              onClick={() => setActiveTab('funcionalidades')}
              className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 whitespace-nowrap transition-all ${
                activeTab === 'funcionalidades'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-700/50 hover:bg-emerald-600 text-white'
              }`}
            >
              <FaCog /> Funcionalidades
            </button>
            <button
              onClick={() => {
                setActiveTab('financeiro');
                if (payments.length === 0) loadPayments();
              }}
              className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 whitespace-nowrap transition-all ${
                activeTab === 'financeiro'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-700/50 hover:bg-emerald-600 text-white'
              }`}
            >
              <FaDollarSign /> Financeiro
            </button>
            <button
              onClick={() => {
                setActiveTab('consultas-avulsas');
                if (consultasAvulsasHistory.length === 0 && consultasAvulsasUsage.length === 0) {
                  loadConsultasAvulsasData();
                }
              }}
              className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 whitespace-nowrap transition-all ${
                activeTab === 'consultas-avulsas'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-700/50 hover:bg-emerald-600 text-white'
              }`}
            >
              <FaCoins /> Consultas Avulsas
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 whitespace-nowrap transition-all ${
                activeTab === 'logs'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-700/50 hover:bg-emerald-600 text-white'
              }`}
            >
              <FaHistory /> Logs
            </button>
          </nav>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-7xl mx-auto p-6">
        {/* ABA: VISÃO GERAL */}
        {activeTab === 'visao-geral' && (
          <div className="space-y-6">
            {/* Cards de Resumo */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border-2 border-blue-500/40 rounded-xl p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-300 text-sm mb-1">Usuários</p>
                    <p className="text-4xl font-black text-white">{stats?.usuarios?.total || tenant.total_usuarios || 0}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {stats?.usuarios?.ativos || 0} ativos
                    </p>
                  </div>
                  <FaUsers className="text-blue-300 text-4xl" />
                </div>
              </div>
              <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 border-2 border-green-500/40 rounded-xl p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-300 text-sm mb-1">Contas WhatsApp</p>
                    <p className="text-4xl font-black text-white">{stats?.contas?.total || (tenant.total_contas || 0)}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      API: {stats?.contas?.api?.total || 0} | QR: {stats?.contas?.qr?.total || 0}
                    </p>
                  </div>
                  <FaWhatsapp className="text-green-300 text-4xl" />
                </div>
              </div>
              <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 border-2 border-purple-500/40 rounded-xl p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-300 text-sm mb-1">Campanhas API</p>
                    <p className="text-4xl font-black text-white">{stats?.campanhas_api?.total || tenant.total_campanhas || 0}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {stats?.campanhas_api?.em_andamento || 0} ativas
                    </p>
                  </div>
                  <FaBullhorn className="text-purple-300 text-4xl" />
                </div>
              </div>
              <div className="bg-gradient-to-br from-orange-500/20 to-orange-600/10 border-2 border-orange-500/40 rounded-xl p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-orange-300 text-sm mb-1">Campanhas QR</p>
                    <p className="text-4xl font-black text-white">{stats?.campanhas_qr?.total || tenant.total_campanhas_qr || 0}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {stats?.campanhas_qr?.em_andamento || 0} ativas
                    </p>
                  </div>
                  <FaBullhorn className="text-orange-300 text-4xl" />
                </div>
              </div>
            </div>

            {/* Filtros de Período */}
            <div className="bg-gradient-to-br from-white/10 to-white/5 border-2 border-white/20 rounded-2xl p-6">
              <h3 className="text-xl font-black text-white mb-4 flex items-center gap-3">
                <FaSearch className="text-emerald-400" />
                Filtrar Dashboards por Período
              </h3>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Campos de Data */}
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-300 mb-2">Data Início</label>
                      <input
                        type="date"
                        value={dashboardDataInicio}
                        onChange={(e) => setDashboardDataInicio(e.target.value)}
                        className="w-full px-4 py-2 bg-dark-700 border border-white/20 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-300 mb-2">Data Fim</label>
                      <input
                        type="date"
                        value={dashboardDataFim}
                        onChange={(e) => setDashboardDataFim(e.target.value)}
                        className="w-full px-4 py-2 bg-dark-700 border border-white/20 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                  
                  <button
                    onClick={limparFiltrosDashboard}
                    className="w-full py-2 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2"
                  >
                    <FaTimes /> Limpar Filtros
                  </button>
                </div>

                {/* Botões de Período Rápido */}
                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">Períodos Rápidos</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setDashboardPeriodo(7)}
                      className="py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-all"
                    >
                      Últimos 7 dias
                    </button>
                    <button
                      onClick={() => setDashboardPeriodo(15)}
                      className="py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-all"
                    >
                      Últimos 15 dias
                    </button>
                    <button
                      onClick={() => setDashboardPeriodo(30)}
                      className="py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition-all"
                    >
                      Últimos 30 dias
                    </button>
                    <button
                      onClick={() => setDashboardPeriodo(60)}
                      className="py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition-all"
                    >
                      Últimos 60 dias
                    </button>
                    <button
                      onClick={() => setDashboardPeriodo(90)}
                      className="py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-all"
                    >
                      Últimos 90 dias
                    </button>
                    <button
                      onClick={() => setDashboardPeriodo(365)}
                      className="py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-all"
                    >
                      Último Ano
                    </button>
                  </div>
                  
                  {(dashboardDataInicio || dashboardDataFim) && (
                    <div className="mt-3 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                      <p className="text-emerald-300 text-sm font-bold">
                        ✓ Filtro ativo: {dashboardDataInicio ? formatInputDate(dashboardDataInicio) : 'Início'} até {dashboardDataFim ? formatInputDate(dashboardDataFim) : 'Fim'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Dashboard Financeiro */}
            <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border-2 border-yellow-500/30 rounded-2xl p-6">
              <h2 className="text-2xl font-black text-white mb-6 flex items-center gap-3">
                <FaDollarSign className="text-yellow-400" />
                Dashboard Financeiro
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                {/* Total de Pagamentos */}
                <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 border border-green-500/30 rounded-xl p-4">
                  <p className="text-green-300 text-sm mb-2 flex items-center gap-2">
                    <FaCheckCircle /> Pagamentos Confirmados
                  </p>
                  <p className="text-3xl font-black text-white">
                    {paymentsFiltered.filter(p => ['CONFIRMED', 'confirmed', 'RECEIVED', 'received'].includes(p.status)).length}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    R$ {paymentsFiltered
                      .filter(p => ['CONFIRMED', 'confirmed', 'RECEIVED', 'received'].includes(p.status))
                      .reduce((sum, p) => sum + Number(p.valor), 0)
                      .toFixed(2)
                      .replace('.', ',')}
                  </p>
                </div>

                {/* Pagamentos Pendentes */}
                <div className="bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 border border-yellow-500/30 rounded-xl p-4">
                  <p className="text-yellow-300 text-sm mb-2 flex items-center gap-2">
                    <FaSpinner /> Pagamentos Pendentes
                  </p>
                  <p className="text-3xl font-black text-white">
                    {paymentsFiltered.filter(p => ['PENDING', 'pending'].includes(p.status)).length}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    R$ {paymentsFiltered
                      .filter(p => ['PENDING', 'pending'].includes(p.status))
                      .reduce((sum, p) => sum + Number(p.valor), 0)
                      .toFixed(2)
                      .replace('.', ',')}
                  </p>
                </div>

                {/* Plano Atual */}
                <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 border border-purple-500/30 rounded-xl p-4">
                  <p className="text-purple-300 text-sm mb-2 flex items-center gap-2">
                    <FaCrown /> Plano Atual
                  </p>
                  <p className="text-2xl font-black text-white truncate">{tenant.plano_nome || 'Sem plano'}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {tenant.proximo_vencimento ? `Vence ${new Date(tenant.proximo_vencimento).toLocaleDateString('pt-BR')}` : 'Sem vencimento'}
                  </p>
                </div>

                {/* Último Pagamento */}
                <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30 rounded-xl p-4">
                  <p className="text-blue-300 text-sm mb-2 flex items-center gap-2">
                    <FaHistory /> Último Pagamento
                  </p>
                  {paymentsFiltered.filter(p => ['CONFIRMED', 'confirmed', 'RECEIVED', 'received'].includes(p.status)).length > 0 ? (
                    <>
                      <p className="text-2xl font-black text-white">
                        R$ {Number(paymentsFiltered.filter(p => ['CONFIRMED', 'confirmed', 'RECEIVED', 'received'].includes(p.status))[0]?.valor || 0).toFixed(2).replace('.', ',')}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(paymentsFiltered.filter(p => ['CONFIRMED', 'confirmed', 'RECEIVED', 'received'].includes(p.status))[0]?.paid_at || paymentsFiltered[0]?.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </>
                  ) : (
                    <p className="text-xl font-bold text-gray-400">Nenhum</p>
                  )}
                </div>
              </div>

              {/* Últimos 5 Pagamentos */}
              {paymentsFiltered.length > 0 && (
                <div>
                  <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                    <FaFileInvoice className="text-yellow-400" /> Últimos Pagamentos
                  </h3>
                  <div className="space-y-2">
                    {paymentsFiltered.slice(0, 5).map((payment) => (
                      <div key={payment.id} className="bg-dark-700/50 rounded-lg p-3 flex items-center justify-between">
                        <div className="flex-1">
                          <p className="text-white font-bold text-sm">
                            {payment.metadata?.tipo === 'consultas_avulsas' ? '🛒 Consultas Avulsas' : 
                             payment.metadata?.tipo === 'renovacao' ? '🔄 Renovação' :
                             payment.metadata?.tipo === 'upgrade' ? '⬆️ Upgrade' : '💰 Pagamento'}
                          </p>
                          <p className="text-gray-400 text-xs">
                            {new Date(payment.created_at).toLocaleDateString('pt-BR')} - {payment.payment_type || 'N/A'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-white font-bold">R$ {Number(payment.valor).toFixed(2).replace('.', ',')}</p>
                          <span className={`text-xs px-2 py-1 rounded ${
                            ['CONFIRMED', 'confirmed', 'RECEIVED', 'received'].includes(payment.status) 
                              ? 'bg-green-500/20 text-green-400' 
                              : ['PENDING', 'pending'].includes(payment.status)
                              ? 'bg-yellow-500/20 text-yellow-400'
                              : 'bg-red-500/20 text-red-400'
                          }`}>
                            {['CONFIRMED', 'confirmed', 'RECEIVED', 'received'].includes(payment.status) ? 'Pago' : 
                             ['PENDING', 'pending'].includes(payment.status) ? 'Pendente' : 'Cancelado'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => {
                      setActiveTab('financeiro');
                      if (payments.length === 0) loadPayments();
                    }}
                    className="mt-4 w-full py-2 bg-yellow-600 hover:bg-yellow-700 text-white font-bold rounded-lg transition-all"
                  >
                    Ver Todos os Pagamentos →
                  </button>
                </div>
              )}
            </div>

            {/* Dashboard Consultas Avulsas */}
            <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-2 border-blue-500/30 rounded-2xl p-6">
              <h2 className="text-2xl font-black text-white mb-6 flex items-center gap-3">
                <FaCoins className="text-blue-400" />
                Dashboard Consultas Avulsas
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                {/* Saldo Atual */}
                <div className="bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30 rounded-xl p-4">
                  <p className="text-emerald-300 text-sm mb-2 flex items-center gap-2">
                    <FaCoins /> Saldo Atual
                  </p>
                  <p className="text-4xl font-black text-white">{tenant.consultas_avulsas_saldo || 0}</p>
                  <p className="text-xs text-emerald-300 mt-1">consultas disponíveis</p>
                </div>

                {/* Total Comprado */}
                <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30 rounded-xl p-4">
                  <p className="text-blue-300 text-sm mb-2 flex items-center gap-2">
                    <FaDollarSign /> Total Comprado
                  </p>
                  <p className="text-3xl font-black text-white">
                    {consultasHistoryFiltered
                      .filter(h => h.source === 'asaas' || (h.action === 'add_consultas_avulsas' && h.source === 'manual'))
                      .reduce((sum, h) => sum + (h.details?.quantidade || 0), 0)}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">consultas adquiridas</p>
                </div>

                {/* Total Usado */}
                <div className="bg-gradient-to-br from-orange-500/20 to-orange-600/10 border border-orange-500/30 rounded-xl p-4">
                  <p className="text-orange-300 text-sm mb-2 flex items-center gap-2">
                    <FaSearch /> Total Usado
                  </p>
                  <p className="text-3xl font-black text-white">{consultasUsageFiltered.length}</p>
                  <p className="text-xs text-gray-400 mt-1">consultas realizadas</p>
                </div>

                {/* Valor Total Gasto */}
                <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 border border-purple-500/30 rounded-xl p-4">
                  <p className="text-purple-300 text-sm mb-2 flex items-center gap-2">
                    <FaFileInvoice /> Valor Gasto
                  </p>
                  <p className="text-2xl font-black text-white">
                    R$ {consultasHistoryFiltered
                      .filter(h => h.source === 'asaas')
                      .reduce((sum, h) => sum + Number(h.valor || 0), 0)
                      .toFixed(2)
                      .replace('.', ',')}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">em compras Asaas</p>
                </div>
              </div>

              {/* Últimas Recargas */}
              {consultasHistoryFiltered.length > 0 && (
                <div>
                  <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                    <FaHistory className="text-blue-400" /> Últimas Recargas
                  </h3>
                  <div className="space-y-2">
                    {consultasHistoryFiltered.slice(0, 5).map((history) => (
                      <div key={history.id} className="bg-dark-700/50 rounded-lg p-3 flex items-center justify-between">
                        <div className="flex-1">
                          <p className="text-white font-bold text-sm flex items-center gap-2">
                            {history.source === 'asaas' ? '💳' : '👤'}
                            {history.action === 'add_consultas_avulsas' ? 'Adicionou' : 'Removeu'} {history.details.quantidade} consultas
                          </p>
                          <p className="text-gray-400 text-xs">
                            {new Date(history.created_at).toLocaleDateString('pt-BR')} • {history.admin_name}
                          </p>
                        </div>
                        {history.source === 'asaas' && (
                          <div className="text-right">
                            <p className="text-emerald-400 font-bold text-sm">
                              R$ {Number(history.valor || 0).toFixed(2).replace('.', ',')}
                            </p>
                            <span className="text-xs text-blue-400">Via Asaas</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => {
                      setActiveTab('consultas-avulsas');
                      if (consultasAvulsasHistory.length === 0) loadConsultasAvulsasData();
                    }}
                    className="mt-4 w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-all"
                  >
                    Ver Histórico Completo →
                  </button>
                </div>
              )}
            </div>

            {/* Informações do Tenant */}
            <div className="bg-gradient-to-br from-white/10 to-white/5 border-2 border-white/20 rounded-2xl p-6">
              <h2 className="text-2xl font-black text-white mb-6 flex items-center gap-3">
                <FaBuilding className="text-emerald-400" />
                Informações do Tenant
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-gray-400 mb-1">Nome</p>
                  <p className="text-lg font-bold text-white">{tenant.nome}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">Email</p>
                  <p className="text-lg font-bold text-white flex items-center gap-2">
                    <FaEnvelope className="text-emerald-400" /> {tenant.email}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">Telefone</p>
                  <p className="text-lg font-bold text-white flex items-center gap-2">
                    <FaPhone className="text-emerald-400" /> {tenant.telefone || 'Não informado'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">Documento</p>
                  <p className="text-lg font-bold text-white flex items-center gap-2">
                    <FaFileAlt className="text-emerald-400" /> {tenant.documento || 'Não informado'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">Plano</p>
                  <p className="text-lg font-bold text-purple-300">{tenant.plano_nome || tenant.plano}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">Status</p>
                  <p className={`text-lg font-bold ${tenant.status === 'active' ? 'text-green-300' : 'text-red-300'}`}>
                    {getStatusLabel(tenant.status)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">Data de Criação</p>
                  <p className="text-lg font-bold text-white">
                    {new Date(tenant.created_at).toLocaleString('pt-BR')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">Última Atualização</p>
                  <p className="text-lg font-bold text-white">
                    {new Date(tenant.updated_at).toLocaleString('pt-BR')}
                  </p>
                </div>
              </div>
            </div>

            {/* Resumo de Limites */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gradient-to-br from-white/10 to-white/5 border-2 border-white/20 rounded-2xl p-6">
                <h3 className="text-xl font-black text-white mb-4 flex items-center gap-2">
                  <FaShieldAlt className="text-blue-400" /> Limites Configurados
                </h3>
                {tenant.limites_customizados ? (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Usuários:</span>
                      <span className="font-bold text-white">
                        {tenant.limite_usuarios_customizado === -1 ? 'Ilimitado' : tenant.limite_usuarios_customizado || 'Padrão do plano'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Contas WhatsApp:</span>
                      <span className="font-bold text-white">
                        {tenant.limite_whatsapp_customizado === -1 ? 'Ilimitado' : tenant.limite_whatsapp_customizado || 'Padrão do plano'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Campanhas Simultâneas:</span>
                      <span className="font-bold text-white">
                        {tenant.limite_campanhas_simultaneas_customizado === -1 ? 'Ilimitado' : tenant.limite_campanhas_simultaneas_customizado || 'Padrão do plano'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Mensagens/Dia:</span>
                      <span className="font-bold text-white">
                        {tenant.limite_mensagens_dia_customizado === -1 ? 'Ilimitado' : tenant.limite_mensagens_dia_customizado || 'Padrão do plano'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Consultas Nova Vida/Mês:</span>
                      <span className="font-bold text-white">
                        {tenant.limite_novavida_mes_customizado === -1 ? 'Ilimitado' : tenant.limite_novavida_mes_customizado || 'Padrão do plano'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-400">Usando limites padrão do plano</p>
                )}
              </div>

              <div className="bg-gradient-to-br from-white/10 to-white/5 border-2 border-white/20 rounded-2xl p-6">
                <h3 className="text-xl font-black text-white mb-4 flex items-center gap-2">
                  <FaCog className="text-green-400" /> Funcionalidades
                </h3>
                {tenant.funcionalidades_customizadas ? (
                  <div className="grid grid-cols-2 gap-2">
                    {funcionalidadesDisponiveis.map(func => {
                      const Icon = func.icon;
                      const ativo = tenant.funcionalidades_config?.[func.key];
                      return (
                        <div key={func.key} className={`flex items-center gap-2 p-2 rounded-lg ${ativo ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                          <Icon className={ativo ? 'text-green-400' : 'text-red-400'} />
                          <span className={`text-xs ${ativo ? 'text-green-300' : 'text-red-300'}`}>
                            {func.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-gray-400">Usando funcionalidades padrão do plano</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ABA: EDITAR CADASTRO */}
        {activeTab === 'cadastro' && (
          <div className="bg-gradient-to-br from-white/10 to-white/5 border-2 border-white/20 rounded-2xl p-8">
            <h2 className="text-2xl font-black text-white mb-6 flex items-center gap-3">
              <FaEdit className="text-blue-400" />
              Editar Informações do Tenant
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-300 mb-2">Nome da Empresa *</label>
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">Telefone</label>
                  <input
                    type="text"
                    value={editForm.telefone}
                    onChange={(e) => setEditForm({ ...editForm, telefone: e.target.value })}
                    placeholder="(11) 98888-8888"
                    className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">Documento (CPF/CNPJ)</label>
                  <input
                    type="text"
                    value={editForm.documento}
                    onChange={(e) => setEditForm({ ...editForm, documento: e.target.value })}
                    placeholder="000.000.000-00"
                    className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">Plano</label>
                  <select
                    value={editForm.plan_id}
                    onChange={(e) => setEditForm({ ...editForm, plan_id: Number(e.target.value) })}
                    className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="0">Selecione um plano</option>
                    {plans.map(plan => (
                      <option key={plan.id} value={plan.id}>
                        {plan.nome} - R$ {plan.preco}/mês
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">Status</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="active">Ativo</option>
                    <option value="inactive">Inativo</option>
                    <option value="suspended">Suspenso</option>
                    <option value="blocked">Bloqueado</option>
                  </select>
                </div>
              </div>

              {/* Data de Vencimento */}
              <div className="mt-6 p-6 bg-yellow-900/20 border-2 border-yellow-500/30 rounded-xl">
                <h3 className="text-xl font-bold text-yellow-300 mb-4 flex items-center gap-2">
                  📅 Data de Vencimento do Plano
                </h3>
                <p className="text-sm text-yellow-200 mb-4">
                  Altere manualmente a data de vencimento. Se for uma data futura, o tenant será <strong>desbloqueado automaticamente</strong>.
                </p>
                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">Próximo Vencimento</label>
                  <input
                    type="date"
                    value={editForm.proximo_vencimento ? new Date(editForm.proximo_vencimento).toISOString().split('T')[0] : ''}
                    onChange={(e) => setEditForm({ ...editForm, proximo_vencimento: e.target.value })}
                    className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-yellow-500 focus:outline-none"
                  />
                  <p className="mt-2 text-xs text-gray-400">
                    💡 Ao salvar uma data futura, o sistema desbloqueará o tenant automaticamente
                  </p>
                </div>
              </div>

              {/* Credenciais */}
              <div className="mt-6 p-6 bg-purple-900/20 border-2 border-purple-500/30 rounded-xl">
                <h3 className="text-xl font-bold text-purple-300 mb-4 flex items-center gap-2">
                  🔐 Credenciais de Integração
                </h3>
                <p className="text-sm text-purple-200 mb-4">
                  Selecione quais credenciais este tenant irá usar para WhatsApp e Nova Vida
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-300 mb-2">
                      📱 Credencial UAZAP (WhatsApp)
                    </label>
                    <select
                      value={editForm.uazap_credential_id || ''}
                      onChange={(e) => setEditForm({ ...editForm, uazap_credential_id: e.target.value ? Number(e.target.value) : null })}
                      className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-purple-500 focus:outline-none"
                    >
                      <option value="">Selecione uma credencial UAZAP</option>
                      {uazapCredentials.map(cred => (
                        <option key={cred.id} value={cred.id}>
                          {cred.name} {cred.is_default ? '⭐ (Padrão)' : ''}
                        </option>
                      ))}
                    </select>
                    {tenant?.uazap_credential_name && (
                      <p className="text-xs text-gray-400 mt-1">
                        Atual: {tenant.uazap_credential_name}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-300 mb-2">
                      🔍 Credencial Nova Vida
                    </label>
                    <select
                      value={editForm.novavida_credential_id || ''}
                      onChange={(e) => setEditForm({ ...editForm, novavida_credential_id: e.target.value ? Number(e.target.value) : null })}
                      className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-purple-500 focus:outline-none"
                    >
                      <option value="">Selecione uma credencial Nova Vida</option>
                      {novaVidaCredentials.map(cred => (
                        <option key={cred.id} value={cred.id}>
                          {cred.name} {cred.is_default ? '⭐ (Padrão)' : ''}
                        </option>
                      ))}
                    </select>
                    {tenant?.novavida_credential_name && (
                      <p className="text-xs text-gray-400 mt-1">
                        Atual: {tenant.novavida_credential_name}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-4 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                  <p className="text-sm text-blue-200">
                    💡 <strong>Dica:</strong> Se não selecionar, o sistema usará as credenciais padrão.
                    Você pode gerenciar credenciais em <a href="/admin/credentials" className="underline hover:text-blue-300">Credenciais</a>
                  </p>
                </div>
              </div>

              <div className="bg-blue-500/10 border-2 border-blue-500/30 rounded-lg p-4 mt-6">
                <p className="text-blue-300 text-sm font-semibold mb-2">ℹ️ Informação:</p>
                <ul className="text-blue-200/80 text-xs space-y-1">
                  <li>• O slug é gerado automaticamente e não pode ser alterado</li>
                  <li>• Configure limites e funcionalidades nas abas específicas</li>
                  <li>• Alterações no plano podem afetar limites e funcionalidades</li>
                </ul>
              </div>

              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full mt-6 py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-lg font-bold text-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg hover:shadow-xl"
              >
                <FaSave /> {saving ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        )}

        {/* ABA: ESTATÍSTICAS */}
        {activeTab === 'estatisticas' && (
          <div className="space-y-6">
            {/* Filtros de Data */}
            <div className="bg-gradient-to-br from-white/10 to-white/5 border-2 border-white/20 rounded-2xl p-6">
              <h3 className="text-xl font-black text-white mb-4 flex items-center gap-2">
                <FaSearch className="text-blue-400" /> Filtrar por Período
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Data Início</label>
                  <input
                    type="date"
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Data Fim</label>
                  <input
                    type="date"
                    value={dataFim}
                    onChange={(e) => setDataFim(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handleAplicarFiltro}
                    disabled={loadingStats}
                    className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <FaSearch /> Filtrar
                  </button>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handleLimparFiltro}
                    disabled={loadingStats}
                    className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-bold transition-all disabled:opacity-50"
                  >
                    Limpar Filtro
                  </button>
                </div>
              </div>
              {(dataInicio || dataFim) && (
                <div className="mt-3 text-sm text-gray-400 flex items-center gap-2">
                  <span className="font-semibold">Período ativo:</span>
                  {dataInicio && <span>De {new Date(dataInicio + 'T00:00:00').toLocaleDateString('pt-BR')}</span>}
                  {dataFim && <span>até {new Date(dataFim + 'T00:00:00').toLocaleDateString('pt-BR')}</span>}
                </div>
              )}
            </div>

            {loadingStats ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-emerald-500 mx-auto"></div>
                <p className="text-white mt-4">Carregando estatísticas...</p>
              </div>
            ) : stats ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* USUÁRIOS */}
                <div className="bg-blue-500/10 border-2 border-blue-500/30 rounded-xl p-6">
                  <h3 className="text-blue-300 font-black text-lg mb-4 flex items-center gap-2">
                    <FaUsers /> USUÁRIOS
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Total:</span>
                      <span className="text-2xl font-bold text-white">{stats.usuarios?.total || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Ativos:</span>
                      <span className="text-lg font-bold text-green-300">{stats.usuarios?.ativos || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Inativos:</span>
                      <span className="text-lg font-bold text-red-300">{stats.usuarios?.inativos || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Admins:</span>
                      <span className="text-lg font-bold text-purple-300">{stats.usuarios?.admins || 0}</span>
                    </div>
                  </div>
                </div>

                {/* WHATSAPP API */}
                <div className="bg-green-500/10 border-2 border-green-500/30 rounded-xl p-6">
                  <h3 className="text-green-300 font-black text-lg mb-4 flex items-center gap-2">
                    <FaWhatsapp /> WHATSAPP API OFICIAL
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Total:</span>
                      <span className="text-2xl font-bold text-white">{stats.contas?.api?.total || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Ativas:</span>
                      <span className="text-lg font-bold text-green-300">{stats.contas?.api?.ativas || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Inativas:</span>
                      <span className="text-lg font-bold text-red-300">{stats.contas?.api?.inativas || 0}</span>
                    </div>
                  </div>
                </div>

                {/* WHATSAPP QR */}
                <div className="bg-teal-500/10 border-2 border-teal-500/30 rounded-xl p-6">
                  <h3 className="text-teal-300 font-black text-lg mb-4 flex items-center gap-2">
                    <FaWhatsapp /> WHATSAPP QR CONNECT
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Total:</span>
                      <span className="text-2xl font-bold text-white">{stats.contas?.qr?.total || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Conectadas:</span>
                      <span className="text-lg font-bold text-green-300">{stats.contas?.qr?.conectadas || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Desconectadas:</span>
                      <span className="text-lg font-bold text-red-300">{stats.contas?.qr?.desconectadas || 0}</span>
                    </div>
                  </div>
                </div>

                {/* CAMPANHAS API */}
                <div className="bg-purple-500/10 border-2 border-purple-500/30 rounded-xl p-6">
                  <h3 className="text-purple-300 font-black text-lg mb-4 flex items-center gap-2">
                    <FaBullhorn /> CAMPANHAS API
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Total:</span>
                      <span className="text-xl font-bold text-white">{stats.campanhas_api?.total || 0}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-blue-500/20 rounded p-2">
                        <p className="text-xs text-gray-400">Agendadas</p>
                        <p className="text-lg font-bold text-blue-300">{stats.campanhas_api?.agendadas || 0}</p>
                      </div>
                      <div className="bg-yellow-500/20 rounded p-2">
                        <p className="text-xs text-gray-400">Em Andamento</p>
                        <p className="text-lg font-bold text-yellow-300">{stats.campanhas_api?.em_andamento || 0}</p>
                      </div>
                      <div className="bg-orange-500/20 rounded p-2">
                        <p className="text-xs text-gray-400">Pausadas</p>
                        <p className="text-lg font-bold text-orange-300">{stats.campanhas_api?.pausadas || 0}</p>
                      </div>
                      <div className="bg-green-500/20 rounded p-2">
                        <p className="text-xs text-gray-400">Concluídas</p>
                        <p className="text-lg font-bold text-green-300">{stats.campanhas_api?.concluidas || 0}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* CAMPANHAS QR */}
                <div className="bg-orange-500/10 border-2 border-orange-500/30 rounded-xl p-6">
                  <h3 className="text-orange-300 font-black text-lg mb-4 flex items-center gap-2">
                    <FaBullhorn /> CAMPANHAS QR CONNECT
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Total:</span>
                      <span className="text-xl font-bold text-white">{stats.campanhas_qr?.total || 0}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-blue-500/20 rounded p-2">
                        <p className="text-xs text-gray-400">Agendadas</p>
                        <p className="text-lg font-bold text-blue-300">{stats.campanhas_qr?.agendadas || 0}</p>
                      </div>
                      <div className="bg-yellow-500/20 rounded p-2">
                        <p className="text-xs text-gray-400">Em Andamento</p>
                        <p className="text-lg font-bold text-yellow-300">{stats.campanhas_qr?.em_andamento || 0}</p>
                      </div>
                      <div className="bg-orange-500/20 rounded p-2">
                        <p className="text-xs text-gray-400">Pausadas</p>
                        <p className="text-lg font-bold text-orange-300">{stats.campanhas_qr?.pausadas || 0}</p>
                      </div>
                      <div className="bg-green-500/20 rounded p-2">
                        <p className="text-xs text-gray-400">Concluídas</p>
                        <p className="text-lg font-bold text-green-300">{stats.campanhas_qr?.concluidas || 0}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* MENSAGENS */}
                <div className="bg-indigo-500/10 border-2 border-indigo-500/30 rounded-xl p-6">
                  <h3 className="text-indigo-300 font-black text-lg mb-4 flex items-center gap-2">
                    <FaEnvelopeOpenText /> MENSAGENS TOTAIS
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div className="bg-white/5 rounded p-3">
                      <p className="text-xs text-gray-400 mb-2">API Oficial</p>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div><span className="text-gray-400">Total:</span> <span className="font-bold text-white">{stats.mensagens?.api?.total || 0}</span></div>
                        <div><span className="text-gray-400">Enviadas:</span> <span className="font-bold text-blue-300">{stats.mensagens?.api?.enviadas || 0}</span></div>
                        <div><span className="text-gray-400">Entregues:</span> <span className="font-bold text-green-300">{stats.mensagens?.api?.entregues || 0}</span></div>
                        <div><span className="text-gray-400">Lidas:</span> <span className="font-bold text-cyan-300">{stats.mensagens?.api?.lidas || 0}</span></div>
                        <div><span className="text-gray-400">Erro:</span> <span className="font-bold text-red-300">{stats.mensagens?.api?.erro || 0}</span></div>
                        <div><span className="text-gray-400">Pendentes:</span> <span className="font-bold text-yellow-300">{stats.mensagens?.api?.pendentes || 0}</span></div>
                      </div>
                    </div>
                    <div className="bg-white/5 rounded p-3">
                      <p className="text-xs text-gray-400 mb-2">QR Connect</p>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div><span className="text-gray-400">Total:</span> <span className="font-bold text-white">{stats.mensagens?.qr?.total || 0}</span></div>
                        <div><span className="text-gray-400">Enviadas:</span> <span className="font-bold text-blue-300">{stats.mensagens?.qr?.enviadas || 0}</span></div>
                        <div><span className="text-gray-400">Entregues:</span> <span className="font-bold text-green-300">{stats.mensagens?.qr?.entregues || 0}</span></div>
                        <div><span className="text-gray-400">Lidas:</span> <span className="font-bold text-cyan-300">{stats.mensagens?.qr?.lidas || 0}</span></div>
                        <div><span className="text-gray-400">Erro:</span> <span className="font-bold text-red-300">{stats.mensagens?.qr?.erro || 0}</span></div>
                        <div><span className="text-gray-400">Pendentes:</span> <span className="font-bold text-yellow-300">{stats.mensagens?.qr?.pendentes || 0}</span></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* TEMPLATES */}
                <div className="bg-yellow-500/10 border-2 border-yellow-500/30 rounded-xl p-6">
                  <h3 className="text-yellow-300 font-black text-lg mb-4 flex items-center gap-2">
                    <FaFileAlt /> TEMPLATES
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">API Total:</span>
                      <span className="text-xl font-bold text-white">{stats.templates?.api?.total || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">API Aprovados:</span>
                      <span className="text-lg font-bold text-green-300">{stats.templates?.api?.aprovados || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">QR Total:</span>
                      <span className="text-xl font-bold text-white">{stats.templates?.qr?.total || 0}</span>
                    </div>
                  </div>
                </div>

                {/* BASE DE DADOS */}
                <div className="bg-cyan-500/10 border-2 border-cyan-500/30 rounded-xl p-6">
                  <h3 className="text-cyan-300 font-black text-lg mb-4 flex items-center gap-2">
                    <FaAddressBook /> BASE DE DADOS
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Total de Contatos:</span>
                      <span className="text-2xl font-bold text-white">{stats.base_dados?.total_contatos || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Importados esta semana:</span>
                      <span className="text-lg font-bold text-green-300">{stats.base_dados?.importados_esta_semana || 0}</span>
                    </div>
                  </div>
                </div>

                {/* NOVA VIDA */}
                <div className="bg-sky-500/10 border-2 border-sky-500/30 rounded-xl p-6">
                  <h3 className="text-sky-300 font-black text-lg mb-4 flex items-center gap-2">
                    <FaSearch /> NOVA VIDA (CONSULTAS)
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Total:</span>
                      <span className="text-2xl font-bold text-white">{stats.nova_vida?.total_consultas || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Este Mês:</span>
                      <span className="text-lg font-bold text-green-300">{stats.nova_vida?.consultas_este_mes || 0}</span>
                    </div>
                  </div>
                </div>

                {/* LISTA DE RESTRIÇÃO */}
                <div className="bg-red-500/10 border-2 border-red-500/30 rounded-xl p-6">
                  <h3 className="text-red-300 font-black text-lg mb-4 flex items-center gap-2">
                    <FaBan /> LISTA DE RESTRIÇÃO
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Números Bloqueados:</span>
                      <span className="text-2xl font-bold text-red-300">{stats.lista_restricao?.total_bloqueados || 0}</span>
                    </div>
                  </div>
                </div>

                {/* ARQUIVOS */}
                <div className="bg-emerald-500/10 border-2 border-emerald-500/30 rounded-xl p-6">
                  <h3 className="text-emerald-300 font-black text-lg mb-4 flex items-center gap-2">
                    <FaCloud /> ARQUIVOS PÚBLICOS
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Total:</span>
                      <span className="text-2xl font-bold text-white">{stats.arquivos?.total || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Tamanho Total:</span>
                      <span className="text-lg font-bold text-blue-300">{stats.arquivos?.tamanho_total_mb || '0.00'} MB</span>
                    </div>
                  </div>
                </div>

                {/* LOGS */}
                <div className="bg-gray-500/10 border-2 border-gray-500/30 rounded-xl p-6">
                  <h3 className="text-gray-300 font-black text-lg mb-4 flex items-center gap-2">
                    <FaClipboardList /> LOGS DE AUDITORIA
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Total:</span>
                      <span className="text-2xl font-bold text-white">{stats.logs?.total || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Esta Semana:</span>
                      <span className="text-lg font-bold text-green-300">{stats.logs?.esta_semana || 0}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-400">Nenhuma estatística disponível</p>
                <button
                  onClick={() => loadStats()}
                  className="mt-4 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-bold transition-all"
                >
                  Carregar Estatísticas
                </button>
              </div>
            )}
          </div>
        )}

        {/* ABA: USUÁRIOS */}
        {activeTab === 'usuarios' && (
          <div className="space-y-6">
            {/* Header */}
            <div className="bg-gradient-to-br from-white/10 to-white/5 border-2 border-white/20 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-black text-white flex items-center gap-3">
                  <FaUsers className="text-blue-400" />
                  Usuários do Tenant
                </h2>
                <button 
                  onClick={handleOpenCreateUserModal}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-bold transition-all flex items-center gap-2 shadow-lg hover:shadow-xl"
                >
                  <FaPlus /> Adicionar Usuário
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-500/20 border border-blue-500/50 rounded-lg p-4">
                  <p className="text-sm text-gray-400 mb-1">Total de Usuários</p>
                  <p className="text-3xl font-black text-white">{users.length}</p>
                </div>
                <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-4">
                  <p className="text-sm text-gray-400 mb-1">Administradores</p>
                  <p className="text-3xl font-black text-green-300">{users.filter(u => u.role === 'admin').length}</p>
                </div>
                <div className="bg-purple-500/20 border border-purple-500/50 rounded-lg p-4">
                  <p className="text-sm text-gray-400 mb-1">Usuários Comuns</p>
                  <p className="text-3xl font-black text-purple-300">{users.filter(u => u.role === 'user').length}</p>
                </div>
              </div>
            </div>

            {/* Lista de Usuários */}
            {loadingUsers ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-emerald-500 mx-auto"></div>
                <p className="text-white mt-4">Carregando usuários...</p>
              </div>
            ) : users.length === 0 ? (
              <div className="bg-gradient-to-br from-white/10 to-white/5 border-2 border-white/20 rounded-2xl p-12 text-center">
                <FaUsers className="text-6xl text-gray-400 mx-auto mb-4" />
                <p className="text-xl text-gray-400 mb-2">Nenhum usuário cadastrado</p>
                <p className="text-sm text-gray-500">Clique em "Adicionar Usuário" para criar o primeiro usuário</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {users.map((user) => (
                  <div
                    key={user.id}
                    className="bg-gradient-to-br from-white/10 to-white/5 border-2 border-white/20 rounded-2xl p-6 hover:border-emerald-500/50 transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          {user.avatar ? (
                            <img 
                              src={buildFileUrl(user.avatar.startsWith('/uploads') ? user.avatar : `/uploads/avatars/${user.avatar}`) || undefined}
                              alt={user.nome}
                              className={`w-12 h-12 rounded-full object-cover border-2 ${
                                user.role === 'admin' ? 'border-orange-500' : 'border-blue-500'
                              }`}
                            />
                          ) : (
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                              user.role === 'admin' ? 'bg-orange-500' : 'bg-blue-500'
                            }`}>
                              {user.role === 'admin' ? (
                                <FaCrown className="text-white text-xl" />
                              ) : (
                                <FaUser className="text-white text-xl" />
                              )}
                            </div>
                          )}
                          <div>
                            <h3 className="text-xl font-black text-white">{user.nome}</h3>
                            <p className="text-sm text-gray-400">{user.email}</p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 mt-3">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                            user.role === 'admin'
                              ? 'bg-orange-500/20 text-orange-300 border border-orange-500/50'
                              : 'bg-blue-500/20 text-blue-300 border border-blue-500/50'
                          }`}>
                            {user.role === 'admin' ? 'Administrador' : 'Usuário'}
                          </span>
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                            user.ativo
                              ? 'bg-green-500/20 text-green-300 border border-green-500/50'
                              : 'bg-red-500/20 text-red-300 border border-red-500/50'
                          }`}>
                            {user.ativo ? 'Ativo' : 'Inativo'}
                          </span>
                          {user.permissoes && Object.keys(user.permissoes).length > 0 && (
                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/50">
                              Permissões Customizadas
                            </span>
                          )}
                        </div>

                        <div className="mt-3 text-xs text-gray-400">
                          <p>Criado em: {new Date(user.created_at).toLocaleString('pt-BR')}</p>
                          {user.ultimo_login && (
                            <p>Último acesso: {new Date(user.ultimo_login).toLocaleString('pt-BR')}</p>
                          )}
                        </div>

                        {/* Permissões */}
                        {user.permissoes && Object.keys(user.permissoes).filter(k => user.permissoes[k]).length > 0 && (
                          <div className="mt-4 p-3 bg-black/30 rounded-lg border border-white/10">
                            <p className="text-xs font-bold text-gray-300 mb-2">Permissões Ativas:</p>
                            <div className="flex flex-wrap gap-1">
                              {Object.keys(user.permissoes).filter(k => user.permissoes[k]).map(perm => (
                                <span key={perm} className="px-2 py-1 bg-emerald-500/20 text-emerald-300 rounded text-xs">
                                  {funcionalidadesDisponiveis.find(f => f.key === perm)?.label || perm}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Ações */}
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => handleOpenEditUserModal(user)}
                          className="px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/40 rounded-lg font-bold transition-all flex items-center gap-2"
                          title="Editar usuário"
                        >
                          <FaEdit />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user)}
                          className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 rounded-lg font-bold transition-all flex items-center gap-2"
                          title="Excluir usuário"
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ABA: CONEXÕES */}
        {activeTab === 'conexoes' && (
          <div className="space-y-6">
            {/* Header */}
            <div className="bg-gradient-to-br from-white/10 to-white/5 border-2 border-white/20 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-black text-white flex items-center gap-3">
                  <FaWhatsapp className="text-green-400" />
                  Conexões WhatsApp do Tenant
                </h2>
                <button
                  onClick={async () => {
                    try {
                      const response = await api.post(`/admin/tenants/${id}/connections/sync-profile-pictures`);
                      const stats = response.data.stats;
                      showNotification(`✅ Sincronizado! ${stats.success}/${stats.total} conexões`, 'success');
                      await loadConnections(); // Recarregar conexões
                      console.log('📊 Resultado da sincronização:', response.data);
                    } catch (err: any) {
                      showNotification('❌ Erro ao sincronizar', 'error');
                      console.error('❌ Erro na sincronização:', err);
                    }
                  }}
                  className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/40 rounded-lg font-bold transition-all flex items-center gap-2"
                  title="Sincronizar fotos de perfil das contas WhatsApp API"
                >
                  <FaSync className="text-blue-300" />
                  Sincronizar Fotos
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-4">
                  <p className="text-sm text-gray-400 mb-1">Total de Conexões</p>
                  <p className="text-3xl font-black text-white">{connections.length}</p>
                </div>
                <div className="bg-blue-500/20 border border-blue-500/50 rounded-lg p-4">
                  <p className="text-sm text-gray-400 mb-1">WhatsApp API</p>
                  <p className="text-3xl font-black text-blue-300">{connections.filter(c => c.type === 'api').length}</p>
                </div>
                <div className="bg-purple-500/20 border border-purple-500/50 rounded-lg p-4">
                  <p className="text-sm text-gray-400 mb-1">QR Connect</p>
                  <p className="text-3xl font-black text-purple-300">{connections.filter(c => c.type === 'qr').length}</p>
                </div>
              </div>
            </div>

            {/* Lista de Conexões */}
            {loadingConnections ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-emerald-500 mx-auto"></div>
                <p className="text-white mt-4">Carregando conexões...</p>
              </div>
            ) : connections.length === 0 ? (
              <div className="bg-gradient-to-br from-white/10 to-white/5 border-2 border-white/20 rounded-2xl p-12 text-center">
                <FaWhatsapp className="text-6xl text-gray-400 mx-auto mb-4" />
                <p className="text-xl text-gray-400 mb-2">Nenhuma conexão cadastrada</p>
                <p className="text-sm text-gray-500">Este tenant ainda não possui contas WhatsApp configuradas</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {connections.map((connection) => (
                  <div
                    key={`${connection.type}-${connection.id}`}
                    className="bg-gradient-to-br from-white/10 to-white/5 border-2 border-white/20 rounded-2xl p-6 hover:border-emerald-500/50 transition-all relative"
                  >
                    {/* Tag de Tipo no canto superior direito */}
                    <div className="absolute top-4 right-4">
                      <span className={`px-4 py-2 rounded-xl text-sm font-bold border-2 ${
                        connection.type === 'api'
                          ? 'bg-blue-500/20 text-blue-300 border-blue-500/50'
                          : 'bg-purple-500/20 text-purple-300 border-purple-500/50'
                      }`}>
                        {connection.type === 'api' ? '📱 WhatsApp API' : '🔗 QR Connect'}
                      </span>
                    </div>

                    <div className="flex items-start justify-between pr-48">
                      <div className="flex-1">
                        <div className="flex items-center gap-4 mb-3">
                          {/* Foto do perfil */}
                          {connection.whatsapp_profile_picture ? (
                            <img 
                              src={connection.whatsapp_profile_picture}
                              alt={connection.name}
                              className={`w-16 h-16 rounded-full object-cover border-4 ${
                                connection.is_active ? 'border-green-500' : 'border-gray-500'
                              } ${!connection.is_active ? 'grayscale opacity-50' : ''}`}
                            />
                          ) : (
                            <div className={`w-16 h-16 rounded-full flex items-center justify-center border-4 ${
                              connection.is_active 
                                ? 'bg-green-500/20 border-green-500'
                                : 'bg-gray-500/20 border-gray-500'
                            }`}>
                              <FaWhatsapp className="text-3xl text-white" />
                            </div>
                          )}
                          
                          <div>
                            <h3 className="text-2xl font-black text-white">{connection.whatsapp_display_name || connection.name}</h3>
                            {connection.whatsapp_display_name && connection.whatsapp_display_name !== connection.name && (
                              <p className="text-sm text-gray-400">Nome do sistema: {connection.name}</p>
                            )}
                            <p className="text-sm text-gray-400 mt-1 flex items-center gap-2">
                              <FaPhone className="text-green-400" />
                              {connection.phone_number}
                            </p>
                            {connection.phone_number_id && (
                              <p className="text-xs text-gray-500 font-mono mt-1">ID: {connection.phone_number_id}</p>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 mt-3">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                            connection.is_active
                              ? 'bg-green-500/20 text-green-300 border border-green-500/50'
                              : 'bg-gray-500/20 text-gray-300 border border-gray-500/50'
                          }`}>
                            {connection.is_active ? '✅ Ativa' : '⏸️ Pausada'}
                          </span>
                          {connection.type === 'qr' && connection.is_connected !== undefined && (
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                              connection.is_connected
                                ? 'bg-green-500/20 text-green-300 border border-green-500/50'
                                : 'bg-red-500/20 text-red-300 border border-red-500/50'
                            }`}>
                              {connection.is_connected ? '🟢 Conectada' : '🔴 Desconectada'}
                            </span>
                          )}
                        </div>

                        <div className="mt-3 text-xs text-gray-400">
                          <p>Criada em: {new Date(connection.created_at).toLocaleString('pt-BR')}</p>
                        </div>
                      </div>

                      {/* Ações */}
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => handleToggleConnectionActive(connection)}
                          className={`px-4 py-3 rounded-lg font-bold transition-all flex items-center gap-2 border-2 ${
                            connection.is_active
                              ? 'bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 border-orange-500/40'
                              : 'bg-green-500/20 hover:bg-green-500/30 text-green-300 border-green-500/40'
                          }`}
                          title={connection.is_active ? 'Desativar conexão' : 'Ativar conexão'}
                        >
                          {connection.is_active ? <FaBan /> : <FaCheckCircle />}
                          {connection.is_active ? 'Desativar' : 'Ativar'}
                        </button>
                        <button
                          onClick={() => handleDeleteConnection(connection)}
                          className="px-4 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-300 border-2 border-red-500/40 rounded-lg font-bold transition-all flex items-center gap-2"
                          title="Excluir conexão"
                        >
                          <FaTrash />
                          Excluir
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ABA: LIMITES */}
        {activeTab === 'limites' && (
          <div className="bg-gradient-to-br from-white/10 to-white/5 border-2 border-white/20 rounded-2xl p-8">
            <h2 className="text-2xl font-black text-white mb-6 flex items-center gap-3">
              <FaShieldAlt className="text-blue-400" />
              Configurar Limites Customizados
            </h2>

            <div className="space-y-6">
              <div className="flex items-center gap-3 p-4 bg-blue-500/10 border-2 border-blue-500/30 rounded-lg">
                <input
                  type="checkbox"
                  id="limites_custom"
                  checked={editForm.limites_customizados}
                  onChange={(e) => setEditForm({ ...editForm, limites_customizados: e.target.checked })}
                  className="w-6 h-6 cursor-pointer"
                />
                <label htmlFor="limites_custom" className="text-white font-bold text-lg cursor-pointer">
                  Ativar Limites Customizados
                </label>
              </div>

              {editForm.limites_customizados && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-300 mb-2">
                      Limite de Usuários <span className="text-xs text-gray-400">(-1 = ilimitado, vazio = usar padrão do plano)</span>
                    </label>
                    <input
                      type="number"
                      placeholder="Ex: 10 ou -1"
                      value={editForm.limite_usuarios_customizado || ''}
                      onChange={(e) => setEditForm({ ...editForm, limite_usuarios_customizado: e.target.value ? Number(e.target.value) : null })}
                      className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-300 mb-2">
                      Limite de Contas WhatsApp <span className="text-xs text-gray-400">(-1 = ilimitado, vazio = usar padrão do plano)</span>
                    </label>
                    <input
                      type="number"
                      placeholder="Ex: 5 ou -1"
                      value={editForm.limite_whatsapp_customizado || ''}
                      onChange={(e) => setEditForm({ ...editForm, limite_whatsapp_customizado: e.target.value ? Number(e.target.value) : null })}
                      className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-300 mb-2">
                      Limite de Campanhas Simultâneas <span className="text-xs text-gray-400">(-1 = ilimitado, vazio = usar padrão do plano)</span>
                    </label>
                    <input
                      type="number"
                      placeholder="Ex: 3 ou -1"
                      value={editForm.limite_campanhas_simultaneas_customizado || ''}
                      onChange={(e) => setEditForm({ ...editForm, limite_campanhas_simultaneas_customizado: e.target.value ? Number(e.target.value) : null })}
                      className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-300 mb-2">
                      Limite de Mensagens por Dia <span className="text-xs text-gray-400">(-1 = ilimitado, vazio = usar padrão do plano)</span>
                    </label>
                    <input
                      type="number"
                      placeholder="Ex: 1000 ou -1"
                      value={editForm.limite_mensagens_dia_customizado || ''}
                      onChange={(e) => setEditForm({ ...editForm, limite_mensagens_dia_customizado: e.target.value ? Number(e.target.value) : null })}
                      className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-300 mb-2">
                      Limite de Consultas Nova Vida por Mês <span className="text-xs text-gray-400">(-1 = ilimitado, vazio = usar padrão do plano)</span>
                    </label>
                    <input
                      type="number"
                      placeholder="Ex: 500 ou -1"
                      value={editForm.limite_novavida_mes_customizado || ''}
                      onChange={(e) => setEditForm({ ...editForm, limite_novavida_mes_customizado: e.target.value ? Number(e.target.value) : null })}
                      className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {!editForm.limites_customizados && (
                <div className="bg-gray-500/10 border-2 border-gray-500/30 rounded-lg p-6 text-center">
                  <p className="text-gray-400">
                    Os limites padrão do plano <span className="font-bold text-white">{tenant.plano_nome || tenant.plano}</span> estão sendo utilizados.
                  </p>
                </div>
              )}

              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full mt-6 py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-lg font-bold text-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg hover:shadow-xl"
              >
                <FaSave /> {saving ? 'Salvando...' : 'Salvar Limites'}
              </button>
            </div>
          </div>
        )}

        {/* ABA: FUNCIONALIDADES */}
        {activeTab === 'funcionalidades' && (
          <div className="bg-gradient-to-br from-white/10 to-white/5 border-2 border-white/20 rounded-2xl p-8">
            <h2 className="text-2xl font-black text-white mb-6 flex items-center gap-3">
              <FaCog className="text-green-400" />
              Configurar Funcionalidades
            </h2>

            <div className="space-y-6">
              {/* Info box explicativo */}
              <div className="bg-blue-500/10 border-2 border-blue-500/30 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <FaInfoCircle className="text-blue-400 text-xl mt-1 flex-shrink-0" />
                  <div className="text-sm text-gray-300">
                    <p className="font-bold text-blue-300 mb-2">📌 Como funciona:</p>
                    <ul className="space-y-1 list-disc list-inside">
                      <li>Abaixo são exibidas <span className="font-bold text-white">apenas as funcionalidades do plano "{tenant?.plano_nome || tenant?.plano}"</span></li>
                      <li>Ao ativar customização, você pode <span className="font-bold text-white">habilitar/desabilitar funcionalidades mesmo durante o período de teste</span></li>
                      <li>Funcionalidades habilitadas aqui <span className="font-bold text-white">funcionarão imediatamente</span>, independente do status do tenant</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-green-500/10 border-2 border-green-500/30 rounded-lg">
                <input
                  type="checkbox"
                  id="funcionalidades_custom"
                  checked={editForm.funcionalidades_customizadas}
                  onChange={(e) => setEditForm({ ...editForm, funcionalidades_customizadas: e.target.checked })}
                  className="w-6 h-6 cursor-pointer"
                />
                <label htmlFor="funcionalidades_custom" className="text-white font-bold text-lg cursor-pointer">
                  Ativar Funcionalidades Customizadas
                </label>
              </div>

              {editForm.funcionalidades_customizadas && (
                <>
                  <div className="bg-yellow-500/10 border-2 border-yellow-500/30 rounded-lg p-4">
                    <p className="text-yellow-300 text-sm">
                      ⚡ <span className="font-bold">Modo customizado ativado!</span> As funcionalidades habilitadas abaixo estarão disponíveis imediatamente, mesmo que o tenant esteja em teste.
                    </p>
                  </div>

                  {/* Mensagem quando não há funcionalidades no plano */}
                  {funcionalidadesDisponiveis.length === 0 && (
                    <div className="bg-red-500/10 border-2 border-red-500/30 rounded-lg p-6 text-center">
                      <p className="text-red-300 font-bold text-lg mb-2">
                        ⚠️ Nenhuma funcionalidade disponível no plano
                      </p>
                      <p className="text-gray-400 text-sm">
                        O plano "{tenant?.plano_nome || tenant?.plano}" não tem funcionalidades configuradas.
                        <br />
                        Por favor, configure as funcionalidades do plano primeiro.
                      </p>
                    </div>
                  )}

                  {/* Grid de funcionalidades */}
                  {funcionalidadesDisponiveis.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {funcionalidadesDisponiveis.map(func => {
                    const Icon = func.icon;
                    const ativo = editForm.funcionalidades_config[func.key] || false;
                    
                    return (
                      <div
                        key={func.key}
                        className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                          ativo
                            ? 'bg-green-500/20 border-green-500/50'
                            : 'bg-red-500/10 border-red-500/30'
                        }`}
                        onClick={() => setEditForm({
                          ...editForm,
                          funcionalidades_config: {
                            ...editForm.funcionalidades_config,
                            [func.key]: !ativo
                          }
                        })}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={ativo}
                            onChange={() => {}} // Handled by div onClick
                            className="w-5 h-5 cursor-pointer"
                          />
                          <Icon className={`text-2xl ${ativo ? 'text-green-400' : 'text-red-400'}`} />
                          <span className={`font-bold ${ativo ? 'text-green-300' : 'text-red-300'}`}>
                            {func.label}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                  )}
                </>
              )}

              {!editForm.funcionalidades_customizadas && (
                <div className="bg-gray-500/10 border-2 border-gray-500/30 rounded-lg p-6 text-center">
                  <p className="text-gray-400">
                    As funcionalidades padrão do plano <span className="font-bold text-white">{tenant.plano_nome || tenant.plano}</span> estão sendo utilizadas.
                  </p>
                </div>
              )}

              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full mt-6 py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-lg font-bold text-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg hover:shadow-xl"
              >
                <FaSave /> {saving ? 'Salvando...' : 'Salvar Funcionalidades'}
              </button>
            </div>
          </div>
        )}

        {/* ABA: FINANCEIRO */}
        {activeTab === 'financeiro' && (
          <div className="space-y-6">
            {/* Header */}
            <div className="bg-gradient-to-br from-white/10 to-white/5 border-2 border-white/20 rounded-2xl p-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h2 className="text-2xl font-black text-white flex items-center gap-3">
                    <FaDollarSign className="text-yellow-400" />
                    Histórico Financeiro
                  </h2>
                  <p className="text-gray-400 mt-2">
                    Todas as faturas e cobranças geradas para este tenant
                  </p>
                </div>
                
                <div className="flex gap-3 flex-wrap">
                  {/* Botão Cancelar Selecionados */}
                  {selectedPayments.size > 0 && (
                    <button
                      onClick={handleCancelMultiplePayments}
                      disabled={cancellingMultiple}
                      className="flex items-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white font-bold rounded-xl transition-all"
                    >
                      {cancellingMultiple ? (
                        <>
                          <FaSpinner className="animate-spin" />
                          Cancelando...
                        </>
                      ) : (
                        <>
                          <FaTimes />
                          Cancelar {selectedPayments.size} Selecionado(s)
                        </>
                      )}
                    </button>
                  )}

                  {/* Botão Atualizar Pagamentos */}
                  <button
                    onClick={handleSyncPayments}
                    disabled={syncingPayments}
                    className="flex items-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-bold rounded-xl transition-all"
                  >
                    {syncingPayments ? (
                      <>
                        <FaSpinner className="animate-spin" />
                        Sincronizando...
                      </>
                    ) : (
                      <>
                        <FaSync />
                        Atualizar Pagamentos
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Checkbox Selecionar Todos */}
              {payments.length > 0 && (
                <div className="mt-4 pt-4 border-t border-white/10">
                  <label className="flex items-center gap-3 cursor-pointer hover:text-white text-gray-300 transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedPayments.size === payments.length && payments.length > 0}
                      onChange={handleSelectAllPayments}
                      className="w-5 h-5 cursor-pointer"
                    />
                    <span className="font-bold">
                      Selecionar Todos ({payments.length} pagamento{payments.length !== 1 ? 's' : ''})
                    </span>
                  </label>
                </div>
              )}
            </div>

            {/* Loading */}
            {loadingPayments && (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto"></div>
                <p className="text-gray-400 mt-4">Carregando pagamentos...</p>
              </div>
            )}

            {/* Lista de Pagamentos */}
            {!loadingPayments && payments.length === 0 && (
              <div className="bg-gradient-to-br from-white/10 to-white/5 border-2 border-white/20 rounded-2xl p-12 text-center">
                <FaDollarSign className="text-6xl text-gray-500 mx-auto mb-4" />
                <p className="text-gray-400 text-lg">Nenhum pagamento encontrado</p>
              </div>
            )}

            {!loadingPayments && payments.length > 0 && (
              <div className="grid grid-cols-1 gap-6">
                {payments.map((payment) => (
                  <div
                    key={payment.id}
                    className={`bg-gradient-to-br from-white/10 to-white/5 border-2 rounded-2xl p-6 transition-all ${
                      selectedPayments.has(payment.id) 
                        ? 'border-emerald-500 shadow-lg shadow-emerald-500/30' 
                        : 'border-white/20'
                    }`}
                  >
                    <div className="flex gap-4">
                      {/* Checkbox de Seleção */}
                      <div className="flex items-start pt-2">
                        <input
                          type="checkbox"
                          checked={selectedPayments.has(payment.id)}
                          onChange={() => handleTogglePaymentSelection(payment.id)}
                          className="w-6 h-6 cursor-pointer"
                        />
                      </div>

                      {/* Conteúdo Principal */}
                      <div className="flex flex-col lg:flex-row gap-6 flex-1">
                        {/* Informações Principais */}
                        <div className="flex-1 space-y-4">
                          {/* Header do Pagamento */}
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2 flex-wrap">
                                <h3 className="text-xl font-black text-white">
                                {payment.metadata?.tipo === 'consultas_avulsas' ? (
                                  <>🛒 Compra de Consultas Avulsas</>
                                ) : payment.metadata?.tipo === 'upgrade' ? (
                                  <>⬆️ Upgrade de Plano</>
                                ) : payment.metadata?.tipo === 'renovacao' ? (
                                  <>🔄 Renovação de Plano</>
                                ) : payment.metadata?.tipo === 'primeiro_pagamento' ? (
                                  <>🎉 Primeiro Pagamento</>
                                ) : payment.descricao?.toLowerCase().includes('upgrade') ? (
                                  <>⬆️ Upgrade de Plano</>
                                ) : payment.descricao?.toLowerCase().includes('renovação') ? (
                                  <>🔄 Renovação de Plano</>
                                ) : payment.descricao?.toLowerCase().includes('consultas avulsas') ? (
                                  <>🛒 Compra de Consultas Avulsas</>
                                ) : payment.descricao?.toLowerCase().includes('primeiro') ? (
                                  <>🎉 Primeiro Pagamento</>
                                ) : (
                                  <>💰 Pagamento</>
                                )}
                              </h3>
                              <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                                payment.status === 'confirmed' || payment.status === 'CONFIRMED' || payment.status === 'RECEIVED' || payment.status === 'received'
                                  ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                                  : payment.status === 'pending' || payment.status === 'PENDING'
                                  ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50'
                                  : payment.status === 'cancelled' || payment.status === 'CANCELLED'
                                  ? 'bg-red-500/20 text-red-400 border border-red-500/50'
                                  : 'bg-gray-500/20 text-gray-400 border border-gray-500/50'
                              }`}>
                                {payment.status === 'confirmed' || payment.status === 'CONFIRMED' || payment.status === 'RECEIVED' || payment.status === 'received' ? '✅ Pago' : 
                                 payment.status === 'pending' || payment.status === 'PENDING' ? '⏳ Pendente' : 
                                 payment.status === 'cancelled' || payment.status === 'CANCELLED' ? '❌ Cancelado' : 
                                 payment.status}
                              </span>
                            </div>

                            {/* Detalhes do Serviço */}
                            {payment.metadata?.tipo === 'consultas_avulsas' && payment.metadata?.quantidade_consultas && (
                              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg px-3 py-2 mb-3 inline-block">
                                <p className="text-blue-300 text-sm font-bold">
                                  📊 {payment.metadata.quantidade_consultas} consultas
                                </p>
                              </div>
                            )}

                            {(payment.metadata?.tipo === 'upgrade' || payment.metadata?.tipo === 'renovacao' || payment.metadata?.tipo === 'primeiro_pagamento') && payment.plan_id && (
                              <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg px-3 py-2 mb-3 inline-block">
                                <p className="text-purple-300 text-sm font-bold">
                                  📦 {plans.find(p => p.id === payment.plan_id)?.nome || `Plano ID: ${payment.plan_id}`}
                                </p>
                              </div>
                            )}

                            <p className="text-3xl font-black text-emerald-400">
                              R$ {Number(payment.valor).toFixed(2).replace('.', ',')}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-400">Tipo de Pagamento</p>
                            <p className="text-lg font-bold text-white">
                              {payment.payment_type === 'PIX' && '📱 PIX'}
                              {payment.payment_type === 'BOLETO' && '🧾 Boleto'}
                              {payment.payment_type === 'CREDIT_CARD' && '💳 Cartão'}
                              {!payment.payment_type && 'Não definido'}
                            </p>
                          </div>
                        </div>

                        {/* Detalhes */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-white/10">
                          <div>
                            <p className="text-sm text-gray-400">Vencimento</p>
                            <p className="text-white font-bold">
                              {new Date(payment.due_date).toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-400">Criado em</p>
                            <p className="text-white font-bold">
                              {new Date(payment.created_at).toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                          {payment.paid_at && (
                            <div>
                              <p className="text-sm text-gray-400">Pago em</p>
                              <p className="text-white font-bold">
                                {new Date(payment.paid_at).toLocaleDateString('pt-BR')}
                              </p>
                            </div>
                          )}
                          {payment.asaas_payment_id && (
                            <div>
                              <p className="text-sm text-gray-400">ID Asaas</p>
                              <p className="text-white font-bold text-xs break-all">
                                {payment.asaas_payment_id}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Ações */}
                        <div className="flex flex-wrap gap-3 pt-4">
                          {/* Marcar como Pago (apenas pendentes) */}
                          {(payment.status === 'pending' || payment.status === 'PENDING') && (
                            <>
                              <button
                                onClick={() => handleMarkAsPaid(payment.id)}
                                disabled={markingAsPaid === payment.id}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-600 text-white font-bold rounded-lg transition flex items-center gap-2"
                              >
                                {markingAsPaid === payment.id ? (
                                  <>
                                    <FaSpinner className="animate-spin" />
                                    Processando...
                                  </>
                                ) : (
                                  <>
                                    <FaCheckCircle />
                                    Marcar como Pago
                                  </>
                                )}
                              </button>
                              
                              {/* Botão de Debug */}
                              <button
                                onClick={() => {
                                  const info = `🔍 Informações do Pagamento:\n\n`;
                                  const details = `ID Banco: ${payment.id}\n`;
                                  const asaasId = `ID Asaas: ${payment.asaas_payment_id || 'Não definido'}\n`;
                                  const status = `Status: ${payment.status}\n`;
                                  const valor = `Valor: R$ ${Number(payment.valor).toFixed(2)}\n`;
                                  const tipo = `Tipo: ${payment.payment_type}\n`;
                                  const criado = `Criado: ${new Date(payment.created_at).toLocaleString('pt-BR')}\n\n`;
                                  const help = `💡 Se o pagamento foi feito mas não aparece como pago:\n1. Use "Atualizar Pagamentos" para verificar no Asaas\n2. Se ainda não atualizar, use "Marcar como Pago" para ativar manualmente`;
                                  showNotification('💡 Detalhes do pagamento exibidos no console', 'info');
                                }}
                                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-lg transition flex items-center gap-2"
                                title="Ver detalhes do pagamento"
                              >
                                <FaSearch className="text-sm" />
                                Info
                              </button>

                              {/* Botão Cancelar Pagamento */}
                              <button
                                onClick={() => handleCancelPayment(payment.id)}
                                disabled={cancellingPayment === payment.id}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white font-bold rounded-lg transition flex items-center gap-2"
                              >
                                {cancellingPayment === payment.id ? (
                                  <>
                                    <FaSpinner className="animate-spin" />
                                    Cancelando...
                                  </>
                                ) : (
                                  <>
                                    <FaTimes />
                                    Cancelar Cobrança
                                  </>
                                )}
                              </button>
                            </>
                          )}

                          {/* Copiar PIX */}
                          {payment.payment_type === 'PIX' && payment.asaas_pix_copy_paste && (
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(payment.asaas_pix_copy_paste!);
                                showNotification('✅ Código PIX copiado!', 'success');
                              }}
                              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition flex items-center gap-2"
                            >
                              <FaCopy /> Copiar Código PIX
                            </button>
                          )}

                          {/* Ver Boleto */}
                          {payment.payment_type === 'BOLETO' && payment.asaas_bank_slip_url && (
                            <a
                              href={payment.asaas_bank_slip_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition flex items-center gap-2"
                            >
                              <FaFileInvoice /> Ver Boleto
                            </a>
                          )}

                          {/* Ver Fatura Completa */}
                          {payment.asaas_invoice_url && (
                            <a
                              href={payment.asaas_invoice_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition flex items-center gap-2"
                            >
                              <FaFileInvoice /> Ver Fatura Completa
                            </a>
                          )}
                        </div>
                      </div>

                      {/* QR Code PIX */}
                      {payment.payment_type === 'PIX' && payment.asaas_pix_qr_code && (
                        <div className="flex items-center justify-center lg:w-64">
                          <div className="bg-white p-4 rounded-xl">
                            <img
                              src={(() => {
                                const qr = payment.asaas_pix_qr_code;
                                // Se for URL HTTP, retorna direto
                                if (qr.startsWith('http')) return qr;
                                // Remove duplicação do prefixo data:image se existir
                                let cleanQr = qr;
                                const duplicatedPrefix = 'data:image/png;base64,data:image/png;base64,';
                                if (cleanQr.startsWith(duplicatedPrefix)) {
                                  cleanQr = cleanQr.replace(duplicatedPrefix, 'data:image/png;base64,');
                                }
                                // Adiciona o prefixo apenas se não existir
                                return cleanQr.startsWith('data:') ? cleanQr : `data:image/png;base64,${cleanQr}`;
                              })()}
                              alt="QR Code PIX"
                              className="w-48 h-48"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          </div>
                        </div>
                      )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ABA: CONSULTAS AVULSAS */}
        {activeTab === 'consultas-avulsas' && (
          <div className="space-y-6">
            {/* Header com Ações */}
            <div className="bg-gradient-to-br from-blue-500/20 to-purple-500/20 border-2 border-blue-500/50 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-black text-white flex items-center gap-3">
                  <FaCoins className="text-blue-400" />
                  Consultas Avulsas (Nova Vida)
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setConsultasAvulsasAction('add');
                      setConsultasAvulsasQuantidade('');
                      setConsultasAvulsasMotivo('');
                      setShowConsultasAvulsasModal(true);
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition flex items-center gap-2"
                  >
                    <FaPlus /> Adicionar
                  </button>
                  <button
                    onClick={() => {
                      setConsultasAvulsasAction('remove');
                      setConsultasAvulsasQuantidade('');
                      setConsultasAvulsasMotivo('');
                      setShowConsultasAvulsasModal(true);
                    }}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition flex items-center gap-2"
                  >
                    <FaTrash /> Remover
                  </button>
                  <button
                    onClick={handleDownloadConsultasAvulsasReport}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition flex items-center gap-2"
                  >
                    <FaDownload /> Baixar Relatório
                  </button>
                </div>
              </div>
              
              {/* Cards de Resumo */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                  <p className="text-sm text-gray-300 mb-2">💰 Saldo Atual</p>
                  <p className="text-4xl font-black text-blue-300">
                    {tenant?.consultas_avulsas_saldo?.toLocaleString('pt-BR') || '0'}
                  </p>
                  <p className="text-xs text-gray-400 mt-2">consultas disponíveis</p>
                </div>
                
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                  <p className="text-sm text-gray-300 mb-2">📊 Status</p>
                  <p className="text-lg font-bold text-white">
                    {(tenant?.consultas_avulsas_saldo || 0) > 0 ? (
                      <span className="text-emerald-400">✅ Com Saldo</span>
                    ) : (
                      <span className="text-gray-400">⚪ Sem Saldo</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-400 mt-2">consultas avulsas</p>
                </div>
                
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                  <p className="text-sm text-gray-300 mb-2">ℹ️ Informação</p>
                  <p className="text-xs text-gray-300 leading-relaxed">
                    Consultas avulsas <strong className="text-blue-300">NÃO expiram</strong> mensalmente e são usadas <strong className="text-purple-300">APÓS</strong> as consultas do plano.
                  </p>
                </div>
              </div>
            </div>

            {/* Gerenciamento de Pacotes */}
            <div className="bg-gradient-to-br from-white/10 to-white/5 border-2 border-white/20 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-black text-white flex items-center gap-2">
                  <FaCog className="text-yellow-400" />
                  Gerenciar Pacotes e Preços
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setShowPacotesModal(true);
                      setEditingPacote(null);
                      loadPacotes();
                    }}
                    className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white font-bold rounded-lg transition flex items-center gap-2"
                  >
                    <FaCog /> Configurar Pacotes
                  </button>
                  <button
                    onClick={() => {
                      setShowFaixasModal(true);
                      setEditingFaixa(null);
                      loadFaixasPreco();
                    }}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition flex items-center gap-2"
                  >
                    💰 Faixas de Preço
                  </button>
                </div>
              </div>
              
              <div className="bg-yellow-500/10 border-2 border-yellow-500/30 rounded-lg p-4 space-y-2">
                <p className="text-gray-300 text-sm">
                  ⚙️ <strong>Super Admins</strong> podem criar e editar:
                </p>
                <ul className="text-gray-300 text-sm list-disc list-inside ml-2">
                  <li><strong>Pacotes:</strong> Conjuntos pré-definidos (ex: 50 consultas por R$ 60,00)</li>
                  <li><strong>Faixas de Preço:</strong> Para quantidade personalizada (ex: 1-49 = R$ 1,50/un)</li>
                </ul>
              </div>
            </div>

            {/* Histórico de Recargas */}
            <div className="bg-gradient-to-br from-white/10 to-white/5 border-2 border-white/20 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <h3 className="text-xl font-black text-white flex items-center gap-2">
                    <FaHistory className="text-emerald-400" />
                    Histórico de Recargas
                  </h3>
                  {!loadingConsultasAvulsas && consultasAvulsasHistory.length > 0 && (
                    <div className="flex items-center gap-4">
                      <span className="text-emerald-300 text-sm font-medium">
                        📊 <span className="font-black text-emerald-200">{consultasAvulsasHistory.length}</span> recargas
                      </span>
                      <span className="text-emerald-300 text-sm font-medium">
                        💎 <span className="font-black text-emerald-200">
                          {consultasAvulsasHistory.reduce((sum, item) => {
                            if (item.action === 'add_consultas_avulsas') {
                              return sum + (item.details?.quantidade || 0);
                            }
                            return sum;
                          }, 0)}
                        </span> créditos
                      </span>
                    </div>
                  )}
                </div>
                <button
                  onClick={loadConsultasAvulsasData}
                  disabled={loadingConsultasAvulsas}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition flex items-center gap-2 disabled:opacity-50"
                >
                  <FaSync className={loadingConsultasAvulsas ? 'animate-spin' : ''} /> Atualizar
                </button>
              </div>
              
              {loadingConsultasAvulsas ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4"></div>
                  <p className="text-gray-400">Carregando histórico...</p>
                </div>
              ) : consultasAvulsasHistory.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <FaInfoCircle className="text-4xl mx-auto mb-2" />
                  <p>Nenhuma recarga registrada ainda.</p>
                </div>
              ) : (
                <div className="overflow-x-auto max-h-96 overflow-y-auto">
                  <table className="w-full">
                    <thead className="sticky top-0 bg-dark-800 z-10">
                      <tr className="border-b-2 border-emerald-500/50 bg-emerald-900/20">
                        <th className="text-left py-3 px-4 text-emerald-300 font-bold">📅 Data/Hora</th>
                        <th className="text-center py-3 px-4 text-emerald-300 font-bold">🎯 Ação</th>
                        <th className="text-center py-3 px-4 text-emerald-300 font-bold">💎 Quantidade</th>
                        <th className="text-left py-3 px-4 text-emerald-300 font-bold">📝 Motivo</th>
                        <th className="text-left py-3 px-4 text-emerald-300 font-bold">👤 Administrador</th>
                      </tr>
                    </thead>
                    <tbody>
                      {consultasAvulsasHistory.map((item: any, index: number) => (
                        <tr key={index} className="border-b border-white/5 hover:bg-emerald-900/10 transition">
                          <td className="py-3 px-4 text-gray-300 font-medium">
                            {new Date(item.created_at).toLocaleString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {item.action === 'add_consultas_avulsas' ? (
                              <div className="flex flex-col items-center gap-1">
                                <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-600/30 text-emerald-300 rounded-lg text-sm font-bold border border-emerald-500/50">
                                  ➕ Adicionou
                                </span>
                                {item.source === 'asaas' && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-600/30 text-blue-300 rounded text-xs font-medium border border-blue-500/50">
                                    💳 Pagamento Asaas
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-600/30 text-red-300 rounded-lg text-sm font-bold border border-red-500/50">
                                ➖ Removeu
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`text-2xl font-black ${item.action === 'add_consultas_avulsas' ? 'text-emerald-400' : 'text-red-400'}`}>
                              {item.action === 'add_consultas_avulsas' ? '+' : '-'}{item.details?.quantidade || '0'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-gray-300">
                            <div className="max-w-xs">
                              <p className="line-clamp-2">{item.details?.motivo || '-'}</p>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="w-8 h-8 bg-emerald-600/30 rounded-full flex items-center justify-center text-emerald-300 font-bold text-xs">
                                {(item.admin_name || 'S')[0].toUpperCase()}
                              </span>
                              <span className="text-gray-300 font-medium">
                                {item.admin_name || 'Super Admin'}
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Consultas Usadas com Créditos Avulsos */}
            <div className="bg-gradient-to-br from-white/10 to-white/5 border-2 border-white/20 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <h3 className="text-xl font-black text-white flex items-center gap-2">
                    <FaChartLine className="text-purple-400" />
                    Consultas Realizadas (Créditos Avulsos)
                  </h3>
                  {!loadingConsultasAvulsas && consultasAvulsasUsage.length > 0 && (
                    <span className="text-purple-300 text-sm font-medium">
                      📊 <span className="font-black text-purple-200">{consultasAvulsasUsage.length}</span> consultas
                    </span>
                  )}
                </div>
              </div>
              
              {loadingConsultasAvulsas ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
                  <p className="text-gray-400">Carregando consultas...</p>
                </div>
              ) : consultasAvulsasUsage.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <FaInfoCircle className="text-4xl mx-auto mb-2" />
                  <p>Nenhuma consulta avulsa utilizada ainda.</p>
                </div>
              ) : (
                <div className="overflow-x-auto max-h-96 overflow-y-auto">
                  <table className="w-full">
                    <thead className="sticky top-0 bg-dark-800 z-10">
                      <tr className="border-b-2 border-purple-500/50 bg-purple-900/20">
                        <th className="text-left py-3 px-4 text-purple-300 font-bold">📅 Data/Hora</th>
                        <th className="text-left py-3 px-4 text-purple-300 font-bold">📄 Tipo Doc</th>
                        <th className="text-left py-3 px-4 text-purple-300 font-bold">🔢 CPF/CNPJ</th>
                        <th className="text-left py-3 px-4 text-purple-300 font-bold">👤 Usuário</th>
                        <th className="text-left py-3 px-4 text-purple-300 font-bold">📧 Email</th>
                      </tr>
                    </thead>
                    <tbody>
                      {consultasAvulsasUsage.map((consulta: any, index: number) => (
                        <tr key={index} className="border-b border-white/5 hover:bg-purple-900/10 transition">
                          <td className="py-3 px-4 text-gray-300 font-medium">
                            {new Date(consulta.created_at).toLocaleString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit'
                            })}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                              consulta.tipo?.toUpperCase() === 'CNPJ' 
                                ? 'bg-blue-600/30 text-blue-300' 
                                : 'bg-emerald-600/30 text-emerald-300'
                            }`}>
                              {consulta.tipo?.toUpperCase() || 'CPF'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-white font-mono font-bold">
                            {consulta.cpf || '-'}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="w-8 h-8 bg-purple-600/30 rounded-full flex items-center justify-center text-purple-300 font-bold text-xs">
                                {(consulta.usuario_nome || 'S')[0].toUpperCase()}
                              </span>
                              <span className="text-gray-300 font-medium">
                                {consulta.usuario_nome || 'Sistema'}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-gray-400 text-sm">
                            {consulta.usuario_email || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ABA: LOGS */}
        {activeTab === 'logs' && (
          <div className="bg-gradient-to-br from-white/10 to-white/5 border-2 border-white/20 rounded-2xl p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black text-white flex items-center gap-3">
                <FaHistory className="text-purple-400" />
                Logs de Atividade do Tenant
              </h2>
              <button
                onClick={handleDeleteAllLogs}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold transition-all flex items-center gap-2"
              >
                <FaTrash /> Excluir Todos os Logs
              </button>
            </div>

            {/* Filtros de Data */}
            <div className="bg-black/30 rounded-lg p-4 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">
                    📅 Data Início:
                  </label>
                  <input
                    type="date"
                    value={logDataInicio}
                    onChange={(e) => setLogDataInicio(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">
                    📅 Data Fim:
                  </label>
                  <input
                    type="date"
                    value={logDataFim}
                    onChange={(e) => setLogDataFim(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <button
                    onClick={() => loadLogs(1)}
                    className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold transition-all flex items-center justify-center gap-2"
                  >
                    <FaSearch /> Filtrar
                  </button>
                  <button
                    onClick={() => {
                      setLogDataInicio('');
                      setLogDataFim('');
                      loadLogs(1);
                    }}
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-bold transition-all"
                    title="Limpar filtros"
                  >
                    ✖️
                  </button>
                </div>
              </div>
            </div>

            {loadingLogs ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
                <p className="text-gray-400 mt-4">Carregando logs...</p>
              </div>
            ) : logs.length === 0 ? (
              <div className="bg-gray-500/10 border-2 border-gray-500/30 rounded-lg p-6 text-center">
                <p className="text-gray-300 font-semibold">📋 Nenhum log encontrado</p>
                <p className="text-gray-400 text-sm mt-2">
                  Ainda não há atividades registradas para este tenant.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Informações de paginação */}
                <div className="flex items-center justify-between text-sm text-gray-400">
                  <p>
                    Mostrando {logs.length} de {logsPagination.total} registros
                  </p>
                  <p>
                    Página {logsPagination.page} de {logsPagination.pages}
                  </p>
                </div>

                {/* Lista de logs */}
                <div className="space-y-2">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        log.sucesso
                          ? 'bg-green-500/10 border-green-500/30 hover:bg-green-500/20'
                          : 'bg-red-500/10 border-red-500/30 hover:bg-red-500/20'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className={`px-2 py-1 rounded text-xs font-bold ${
                              log.sucesso ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'
                            }`}>
                              {log.sucesso ? '✓ Sucesso' : '✗ Erro'}
                            </span>
                            <span className="text-emerald-400 font-bold">{log.acao}</span>
                            {log.entidade && (
                              <span className="text-gray-400 text-sm">
                                → {log.entidade} {log.entidade_id ? `#${log.entidade_id}` : ''}
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-4 text-sm text-gray-400">
                            <span>👤 {log.user_nome || log.user_email || 'Sistema'}</span>
                            <span>🕐 {new Date(log.created_at).toLocaleString('pt-BR')}</span>
                            <span>🌐 {log.metodo_http} {log.url_path}</span>
                          </div>

                          {log.erro_mensagem && (
                            <div className="mt-2 text-red-300 text-sm">
                              ❌ {log.erro_mensagem}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Paginação */}
                {logsPagination.pages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-6">
                    <button
                      onClick={() => loadLogs(logsPagination.page - 1)}
                      disabled={logsPagination.page === 1}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-bold transition-all"
                    >
                      ← Anterior
                    </button>
                    <span className="text-white font-bold">
                      {logsPagination.page} / {logsPagination.pages}
                    </span>
                    <button
                      onClick={() => loadLogs(logsPagination.page + 1)}
                      disabled={logsPagination.page === logsPagination.pages}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-bold transition-all"
                    >
                      Próxima →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL: CRIAR USUÁRIO */}
      {isCreatingUser && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 border-2 border-emerald-500/50 rounded-2xl p-8 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-black text-white mb-6 flex items-center gap-3">
              <FaPlus className="text-emerald-400" />
              Criar Novo Usuário
            </h2>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">Nome Completo *</label>
                  <input
                    type="text"
                    value={userForm.nome}
                    onChange={(e) => setUserForm({ ...userForm, nome: e.target.value })}
                    placeholder="João da Silva"
                    className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">Email *</label>
                  <input
                    type="email"
                    value={userForm.email}
                    onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                    placeholder="usuario@email.com"
                    className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">Senha *</label>
                  <input
                    type="password"
                    value={userForm.senha}
                    onChange={(e) => setUserForm({ ...userForm, senha: e.target.value })}
                    placeholder="Senha forte"
                    className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">Tipo de Usuário *</label>
                  <select
                    value={userForm.role}
                    onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                    className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="user">Usuário Comum</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
              </div>

              {/* Permissões Customizadas */}
              <div className="border-t-2 border-white/20 pt-4">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <FaShieldAlt className="text-purple-400" />
                  Permissões Customizadas
                </h3>
                <p className="text-sm text-gray-400 mb-4">
                  Selecione quais funcionalidades este usuário poderá acessar. Se nenhuma for selecionada, o usuário terá acesso a todas as funcionalidades do tenant.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {funcionalidadesDisponiveis.map(func => {
                    const Icon = func.icon;
                    const ativo = userForm.permissoes[func.key] || false;
                    
                    return (
                      <div
                        key={func.key}
                        className={`p-3 rounded-lg border-2 transition-all cursor-pointer ${
                          ativo
                            ? 'bg-emerald-500/20 border-emerald-500/50'
                            : 'bg-gray-500/10 border-gray-500/30'
                        }`}
                        onClick={() => handleToggleUserPermissao(func.key)}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={ativo}
                            onChange={() => {}} // Handled by div onClick
                            className="w-4 h-4 cursor-pointer"
                          />
                          <Icon className={`text-lg ${ativo ? 'text-emerald-400' : 'text-gray-400'}`} />
                          <span className={`text-sm font-bold ${ativo ? 'text-emerald-300' : 'text-gray-400'}`}>
                            {func.label}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-blue-500/10 border-2 border-blue-500/30 rounded-lg p-4">
                <p className="text-blue-300 text-sm font-semibold mb-2">ℹ️ Informação:</p>
                <ul className="text-blue-200/80 text-xs space-y-1">
                  <li>• Administradores têm acesso total ao sistema, independente das permissões</li>
                  <li>• Usuários comuns só terão acesso às funcionalidades marcadas</li>
                  <li>• Se nenhuma permissão for marcada, o usuário terá acesso a tudo</li>
                  <li>• Você pode editar as permissões posteriormente</li>
                </ul>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleCreateUser}
                disabled={saving}
                className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-lg font-bold transition-all shadow-lg hover:shadow-xl disabled:opacity-50"
              >
                {saving ? 'Criando...' : '✅ Criar Usuário'}
              </button>
              <button
                onClick={() => setIsCreatingUser(false)}
                disabled={saving}
                className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-bold transition-all disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDITAR USUÁRIO */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 border-2 border-blue-500/50 rounded-2xl p-8 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-black text-white mb-6 flex items-center gap-3">
              <FaEdit className="text-blue-400" />
              Editar Usuário
            </h2>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">Nome Completo *</label>
                  <input
                    type="text"
                    value={userForm.nome}
                    onChange={(e) => setUserForm({ ...userForm, nome: e.target.value })}
                    className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">Email *</label>
                  <input
                    type="email"
                    value={userForm.email}
                    onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                    className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">Nova Senha (deixe em branco para não alterar)</label>
                  <input
                    type="password"
                    value={userForm.senha}
                    onChange={(e) => setUserForm({ ...userForm, senha: e.target.value })}
                    placeholder="Digite apenas se quiser alterar"
                    className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">Tipo de Usuário *</label>
                  <select
                    value={userForm.role}
                    onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                    className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                  >
                    <option value="user">Usuário Comum</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="flex items-center gap-3 p-3 bg-gray-700/50 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={userForm.ativo}
                    onChange={(e) => setUserForm({ ...userForm, ativo: e.target.checked })}
                    className="w-5 h-5 cursor-pointer"
                  />
                  <span className="text-white font-bold">Usuário Ativo</span>
                </label>
              </div>

              {/* Permissões Customizadas */}
              <div className="border-t-2 border-white/20 pt-4">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <FaShieldAlt className="text-purple-400" />
                  Permissões Customizadas
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {funcionalidadesDisponiveis.map(func => {
                    const Icon = func.icon;
                    const ativo = userForm.permissoes[func.key] || false;
                    
                    return (
                      <div
                        key={func.key}
                        className={`p-3 rounded-lg border-2 transition-all cursor-pointer ${
                          ativo
                            ? 'bg-emerald-500/20 border-emerald-500/50'
                            : 'bg-gray-500/10 border-gray-500/30'
                        }`}
                        onClick={() => handleToggleUserPermissao(func.key)}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={ativo}
                            onChange={() => {}} // Handled by div onClick
                            className="w-4 h-4 cursor-pointer"
                          />
                          <Icon className={`text-lg ${ativo ? 'text-emerald-400' : 'text-gray-400'}`} />
                          <span className={`text-sm font-bold ${ativo ? 'text-emerald-300' : 'text-gray-400'}`}>
                            {func.label}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleUpdateUser}
                disabled={saving}
                className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-lg font-bold transition-all shadow-lg hover:shadow-xl disabled:opacity-50"
              >
                {saving ? 'Salvando...' : '✅ Salvar Alterações'}
              </button>
              <button
                onClick={() => setEditingUser(null)}
                disabled={saving}
                className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-bold transition-all disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Gerenciamento de Consultas Avulsas */}
      {showConsultasAvulsasModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-800 border-2 border-blue-500/50 rounded-3xl p-8 max-w-md w-full">
            <h2 className="text-2xl font-black text-white mb-6 flex items-center gap-3">
              {consultasAvulsasAction === 'add' ? (
                <>
                  <FaPlus className="text-emerald-400" />
                  Adicionar Consultas Avulsas
                </>
              ) : (
                <>
                  <FaTrash className="text-red-400" />
                  Remover Consultas Avulsas
                </>
              )}
            </h2>

            <div className="space-y-4">
              {/* Quantidade */}
              <div>
                <label className="block text-white font-bold mb-2">
                  Quantidade <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={consultasAvulsasQuantidade}
                  onChange={(e) => setConsultasAvulsasQuantidade(e.target.value)}
                  placeholder="Ex: 500"
                  className="w-full px-4 py-3 bg-dark-700 border-2 border-white/20 rounded-xl text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Motivo */}
              <div>
                <label className="block text-white font-bold mb-2">
                  Motivo <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={consultasAvulsasMotivo}
                  onChange={(e) => setConsultasAvulsasMotivo(e.target.value)}
                  placeholder="Ex: Cliente comprou pacote extra"
                  rows={3}
                  className="w-full px-4 py-3 bg-dark-700 border-2 border-white/20 rounded-xl text-white focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              {/* Info Box */}
              <div className={`${consultasAvulsasAction === 'add' ? 'bg-blue-500/20 border-blue-500/50' : 'bg-red-500/20 border-red-500/50'} border-2 rounded-xl p-4`}>
                <p className="text-sm text-white">
                  {consultasAvulsasAction === 'add' ? (
                    <>
                      <strong>ℹ️ Consultas avulsas:</strong>
                      <br />• NÃO expiram mensalmente
                      <br />• São usadas APÓS as do plano
                      <br />• Acumulam para próximo mês
                    </>
                  ) : (
                    <>
                      <strong>⚠️ Atenção:</strong>
                      <br />Esta ação irá remover consultas avulsas do saldo atual do tenant.
                    </>
                  )}
                </p>
              </div>

              {/* Botões */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleConsultasAvulsas}
                  disabled={processingConsultasAvulsas}
                  className={`flex-1 py-3 ${consultasAvulsasAction === 'add' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'} text-white rounded-xl font-bold transition disabled:opacity-50 flex items-center justify-center gap-2`}
                >
                  {processingConsultasAvulsas ? (
                    <>
                      <FaSpinner className="animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      {consultasAvulsasAction === 'add' ? (
                        <>
                          <FaPlus />
                          Adicionar
                        </>
                      ) : (
                        <>
                          <FaTrash />
                          Remover
                        </>
                      )}
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowConsultasAvulsasModal(false)}
                  disabled={processingConsultasAvulsas}
                  className="flex-1 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-xl font-bold transition disabled:opacity-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Gerenciamento de Pacotes */}
      {showPacotesModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-dark-800 border-2 border-yellow-500/50 rounded-3xl p-8 max-w-6xl w-full my-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-3xl font-black text-white flex items-center gap-3">
                <FaCog className="text-yellow-400" />
                Gerenciar Pacotes de Consultas
              </h2>
              <button
                onClick={() => {
                  setShowPacotesModal(false);
                  setEditingPacote(null);
                  setPacoteForm({
                    nome: '',
                    quantidade: '',
                    preco_unitario: '',
                    preco: '',
                    desconto: '0',
                    popular: false,
                    ativo: true,
                    ordem: '0'
                  });
                }}
                className="text-gray-400 hover:text-white text-2xl transition"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Formulário de Pacote */}
              <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border-2 border-yellow-500/30 rounded-2xl p-6">
                <h3 className="text-xl font-black text-yellow-300 mb-4 flex items-center gap-2">
                  {editingPacote ? <FaEdit /> : <FaPlus />}
                  {editingPacote ? 'Editar Pacote' : 'Novo Pacote'}
                </h3>

                <div className="space-y-4">
                  {/* Nome */}
                  <div>
                    <label className="block text-white font-bold mb-2">
                      📦 Nome do Pacote <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={pacoteForm.nome}
                      onChange={(e) => handlePacoteFormChange('nome', e.target.value)}
                      placeholder="Ex: Intermediário"
                      className="w-full px-4 py-3 bg-dark-700 border-2 border-white/20 rounded-xl text-white focus:outline-none focus:border-yellow-500"
                    />
                  </div>

                  {/* Quantidade */}
                  <div>
                    <label className="block text-white font-bold mb-2">
                      💎 Quantidade de Consultas <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={pacoteForm.quantidade}
                      onChange={(e) => handlePacoteFormChange('quantidade', e.target.value)}
                      placeholder="Ex: 50"
                      className="w-full px-4 py-3 bg-dark-700 border-2 border-white/20 rounded-xl text-white focus:outline-none focus:border-yellow-500"
                    />
                  </div>

                  {/* Preço Unitário e Preço Total */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-white font-bold mb-2">
                        💵 Preço Unitário (R$) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={pacoteForm.preco_unitario}
                        onChange={(e) => handlePacoteFormChange('preco_unitario', e.target.value)}
                        placeholder="Ex: 1.20"
                        className="w-full px-4 py-3 bg-dark-700 border-2 border-white/20 rounded-xl text-white focus:outline-none focus:border-yellow-500"
                      />
                      <p className="text-xs text-gray-400 mt-1">Valor por consulta</p>
                    </div>

                    <div>
                      <label className="block text-white font-bold mb-2">
                        💰 Preço Total (R$) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={pacoteForm.preco}
                        onChange={(e) => handlePacoteFormChange('preco', e.target.value)}
                        placeholder="Ex: 60.00"
                        className="w-full px-4 py-3 bg-dark-700 border-2 border-white/20 rounded-xl text-white focus:outline-none focus:border-yellow-500"
                      />
                      <p className="text-xs text-gray-400 mt-1">Calculado automaticamente</p>
                    </div>
                  </div>

                  {/* Desconto e Ordem */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-white font-bold mb-2">
                        🏷️ Desconto (%)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={pacoteForm.desconto}
                        onChange={(e) => handlePacoteFormChange('desconto', e.target.value)}
                        placeholder="Ex: 20"
                        className="w-full px-4 py-3 bg-dark-700 border-2 border-white/20 rounded-xl text-white focus:outline-none focus:border-yellow-500"
                      />
                    </div>

                    <div>
                      <label className="block text-white font-bold mb-2">
                        📊 Ordem de Exibição
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={pacoteForm.ordem}
                        onChange={(e) => handlePacoteFormChange('ordem', e.target.value)}
                        placeholder="Ex: 1"
                        className="w-full px-4 py-3 bg-dark-700 border-2 border-white/20 rounded-xl text-white focus:outline-none focus:border-yellow-500"
                      />
                    </div>
                  </div>

                  {/* Switches */}
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pacoteForm.popular}
                        onChange={(e) => handlePacoteFormChange('popular', e.target.checked)}
                        className="w-5 h-5 rounded"
                      />
                      <span className="text-white font-bold">⭐ Marcar como Popular</span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pacoteForm.ativo}
                        onChange={(e) => handlePacoteFormChange('ativo', e.target.checked)}
                        className="w-5 h-5 rounded"
                      />
                      <span className="text-white font-bold">✅ Pacote Ativo</span>
                    </label>
                  </div>

                  {/* Botões */}
                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={handleSavePacote}
                      disabled={savingPacote}
                      className="flex-1 py-3 bg-yellow-600 hover:bg-yellow-700 text-white rounded-xl font-bold transition disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {savingPacote ? (
                        <>
                          <FaSpinner className="animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        <>
                          <FaSave />
                          {editingPacote ? 'Atualizar' : 'Criar'}
                        </>
                      )}
                    </button>

                    {editingPacote && (
                      <button
                        onClick={() => {
                          setEditingPacote(null);
                          setPacoteForm({
                            nome: '',
                            quantidade: '',
                            preco_unitario: '',
                            preco: '',
                            desconto: '0',
                            popular: false,
                            ativo: true,
                            ordem: '0'
                          });
                        }}
                        className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-xl font-bold transition"
                      >
                        Cancelar Edição
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Lista de Pacotes */}
              <div className="bg-gradient-to-br from-white/10 to-white/5 border-2 border-white/20 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-black text-white">📦 Pacotes Cadastrados</h3>
                  <button
                    onClick={loadPacotes}
                    disabled={loadingPacotes}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm transition disabled:opacity-50 flex items-center gap-1"
                  >
                    <FaSync className={loadingPacotes ? 'animate-spin' : ''} />
                    Atualizar
                  </button>
                </div>

                {loadingPacotes ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500 mx-auto mb-4"></div>
                    <p className="text-gray-400">Carregando...</p>
                  </div>
                ) : pacotes.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <FaInfoCircle className="text-4xl mx-auto mb-2" />
                    <p>Nenhum pacote cadastrado ainda.</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                    {pacotes.map((pacote) => (
                      <div
                        key={pacote.id}
                        className={`bg-gradient-to-r ${
                          pacote.ativo
                            ? 'from-green-500/20 to-blue-500/20 border-green-500/50'
                            : 'from-gray-500/20 to-gray-600/20 border-gray-500/50'
                        } border-2 rounded-xl p-4`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="text-lg font-black text-white">{pacote.nome}</h4>
                              {pacote.popular && <span className="text-yellow-400 text-sm">⭐ Popular</span>}
                              {!pacote.ativo && <span className="text-gray-400 text-sm">⚫ Inativo</span>}
                            </div>
                            <p className="text-gray-300 text-sm">
                              <strong className="text-blue-300">{pacote.quantidade}</strong> consultas • 
                              <strong className="text-green-300"> R$ {pacote.preco.toFixed(2)}</strong>
                              {pacote.desconto > 0 && (
                                <span className="text-yellow-300"> • 🏷️ {pacote.desconto}% OFF</span>
                              )}
                            </p>
                            <p className="text-gray-400 text-xs mt-1">
                              💵 R$ {pacote.preco_unitario.toFixed(2)} por consulta
                            </p>
                          </div>

                          <div className="flex flex-col gap-1">
                            <button
                              onClick={() => handleEditPacote(pacote)}
                              className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold transition"
                              title="Editar"
                            >
                              <FaEdit />
                            </button>
                            <button
                              onClick={() => handleTogglePopular(pacote.id)}
                              className="px-2 py-1 bg-yellow-600 hover:bg-yellow-700 text-white rounded text-xs font-bold transition"
                              title="Marcar como Popular"
                            >
                              ⭐
                            </button>
                            <button
                              onClick={() => handleDeletePacote(pacote.id)}
                              className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-bold transition"
                              title="Deletar"
                            >
                              <FaTrash />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Gerenciamento de Faixas de Preço */}
      {showFaixasModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-dark-800 border-2 border-purple-500/50 rounded-3xl p-8 max-w-6xl w-full my-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-3xl font-black text-white flex items-center gap-3">
                💰 Gerenciar Faixas de Preço
              </h2>
              <button
                onClick={() => {
                  setShowFaixasModal(false);
                  setEditingFaixa(null);
                  setFaixaForm({
                    quantidade_min: '',
                    quantidade_max: '',
                    preco_unitario: ''
                  });
                }}
                className="text-gray-400 hover:text-white text-2xl transition"
              >
                ✕
              </button>
            </div>

            <div className="bg-blue-500/10 border-2 border-blue-500/30 rounded-xl p-4 mb-6">
              <p className="text-blue-300 text-sm font-bold mb-2">ℹ️ O que são Faixas de Preço?</p>
              <p className="text-gray-300 text-sm">
                Quando o cliente escolhe "Quantidade Personalizada", o preço unitário é calculado automaticamente baseado nessas faixas. Exemplo: Se comprar 75 consultas e a faixa "50-99" custa R$ 1,20/un, o total será R$ 90,00.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Formulário de Faixa */}
              <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-2 border-purple-500/30 rounded-2xl p-6">
                <h3 className="text-xl font-black text-purple-300 mb-4 flex items-center gap-2">
                  {editingFaixa ? <FaEdit /> : <FaPlus />}
                  {editingFaixa ? 'Editar Faixa' : 'Nova Faixa'}
                </h3>

                <div className="space-y-4">
                  {/* Quantidade Mínima e Máxima */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-white font-bold mb-2">
                        📊 Quantidade Mínima <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={faixaForm.quantidade_min}
                        onChange={(e) => setFaixaForm({ ...faixaForm, quantidade_min: e.target.value })}
                        placeholder="Ex: 50"
                        className="w-full px-4 py-3 bg-dark-700 border-2 border-white/20 rounded-xl text-white focus:outline-none focus:border-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block text-white font-bold mb-2">
                        📊 Quantidade Máxima
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={faixaForm.quantidade_max}
                        onChange={(e) => setFaixaForm({ ...faixaForm, quantidade_max: e.target.value })}
                        placeholder="Ex: 99 (vazio = sem limite)"
                        className="w-full px-4 py-3 bg-dark-700 border-2 border-white/20 rounded-xl text-white focus:outline-none focus:border-purple-500"
                      />
                      <p className="text-xs text-gray-400 mt-1">Deixe vazio para "sem limite"</p>
                    </div>
                  </div>

                  {/* Preço Unitário */}
                  <div>
                    <label className="block text-white font-bold mb-2">
                      💵 Preço Unitário (R$) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={faixaForm.preco_unitario}
                      onChange={(e) => setFaixaForm({ ...faixaForm, preco_unitario: e.target.value })}
                      placeholder="Ex: 1.20"
                      className="w-full px-4 py-3 bg-dark-700 border-2 border-white/20 rounded-xl text-white focus:outline-none focus:border-purple-500"
                    />
                    <p className="text-xs text-gray-400 mt-1">Preço por cada consulta nesta faixa</p>
                  </div>

                  {/* Preview */}
                  {faixaForm.quantidade_min && faixaForm.preco_unitario && (
                    <div className="bg-green-500/20 border-2 border-green-500/40 rounded-xl p-4">
                      <p className="text-green-300 text-sm font-bold mb-1">📋 Preview da Faixa:</p>
                      <p className="text-white text-lg font-black">
                        {faixaForm.quantidade_min}-{faixaForm.quantidade_max || '∞'} consultas = R$ {parseFloat(faixaForm.preco_unitario).toFixed(2)}/un
                      </p>
                      <p className="text-gray-300 text-sm mt-2">
                        Exemplo: 100 consultas = R$ {(100 * parseFloat(faixaForm.preco_unitario)).toFixed(2)}
                      </p>
                    </div>
                  )}

                  {/* Botões */}
                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={handleSaveFaixa}
                      disabled={savingFaixa}
                      className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold transition disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {savingFaixa ? (
                        <>
                          <FaSpinner className="animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        <>
                          <FaSave />
                          {editingFaixa ? 'Atualizar' : 'Criar'}
                        </>
                      )}
                    </button>

                    {editingFaixa && (
                      <button
                        onClick={() => {
                          setEditingFaixa(null);
                          setFaixaForm({
                            quantidade_min: '',
                            quantidade_max: '',
                            preco_unitario: ''
                          });
                        }}
                        className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-xl font-bold transition"
                      >
                        Cancelar Edição
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Lista de Faixas */}
              <div className="bg-gradient-to-br from-white/10 to-white/5 border-2 border-white/20 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-black text-white">📊 Faixas Cadastradas</h3>
                  <button
                    onClick={loadFaixasPreco}
                    disabled={loadingFaixas}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm transition disabled:opacity-50 flex items-center gap-1"
                  >
                    <FaSync className={loadingFaixas ? 'animate-spin' : ''} />
                    Atualizar
                  </button>
                </div>

                {loadingFaixas ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
                    <p className="text-gray-400">Carregando...</p>
                  </div>
                ) : faixasPreco.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <FaInfoCircle className="text-4xl mx-auto mb-2" />
                    <p>Nenhuma faixa cadastrada ainda.</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                    {faixasPreco.map((faixa) => (
                      <div
                        key={faixa.id}
                        className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 border-2 border-purple-500/50 rounded-xl p-4"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="text-lg font-black text-white mb-1">
                              {faixa.quantidade_min}-{faixa.quantidade_max || '∞'} consultas
                            </h4>
                            <p className="text-gray-300 text-sm">
                              💵 <strong className="text-green-300">R$ {faixa.preco_unitario.toFixed(2)}</strong> por consulta
                            </p>
                            <p className="text-gray-400 text-xs mt-1">
                              Exemplo: 100 consultas = R$ {(100 * faixa.preco_unitario).toFixed(2)}
                            </p>
                          </div>

                          <div className="flex flex-col gap-1">
                            <button
                              onClick={() => handleEditFaixa(faixa)}
                              className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold transition"
                              title="Editar"
                            >
                              <FaEdit />
                            </button>
                            <button
                              onClick={() => handleDeleteFaixa(faixa.id)}
                              className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-bold transition"
                              title="Deletar"
                            >
                              <FaTrash />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* 🔔 NOTIFICAÇÕES TOAST */}
      <ToastContainer notifications={notifications} onRemove={removeNotification} />
    </div>
  );
}









