import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import {
  FaArrowLeft, FaPhone, FaUser, FaLock, FaChartBar, FaBell,
  FaDollarSign, FaCog, FaSave, FaImage,
  FaQrcode, FaHeartbeat, FaFacebook, FaCheckCircle, FaGlobe, FaShieldAlt, FaInfoCircle, FaTimesCircle, FaFileAlt, FaSearch
} from 'react-icons/fa';
import api from '@/services/api';
import { useToast } from '@/hooks/useToast';
import ToastContainer from '@/components/ToastContainer';

interface WhatsAppAccount {
  id: number;
  name: string;
  phone_number: string;
  phone_number_id: string;
  access_token: string;
  is_active: boolean;
  facebook_access_token?: string;
  facebook_ad_account_id?: string;
  facebook_business_id?: string;
}

interface BusinessProfile {
  verified_name?: string;
  display_phone_number?: string;
  display_name?: string;
  about?: string;
  address?: string;
  description?: string;
  email?: string;
  vertical?: string;
  websites?: string[];
  profile_picture_url?: string;
}

type TabType = 'basico' | 'perfil' | 'seguranca' | 'webhooks' | 'financeiro' | 'avancado' | 'proxy' | 'templates';

export default function ConfigurarConta() {
  const router = useRouter();
  const { id } = router.query;
  const toast = useToast();

  const [account, setAccount] = useState<WhatsAppAccount | null>(null);
  const [profile, setProfile] = useState<BusinessProfile>({});
  const [activeTab, setActiveTab] = useState<TabType>('basico');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Estados para cada aba
  const [twoStepPin, setTwoStepPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [facebookToken, setFacebookToken] = useState('');
  const [facebookAdAccount, setFacebookAdAccount] = useState('');
  const [facebookBusiness, setFacebookBusiness] = useState('');
  const [editingFacebookCredentials, setEditingFacebookCredentials] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [qrCode, setQrCode] = useState<any>(null);
  const [healthCheck, setHealthCheck] = useState<any>(null);
  const [permissionsTest, setPermissionsTest] = useState<any>(null);
  const [testingPermissions, setTestingPermissions] = useState(false);
  const [experimentalTests, setExperimentalTests] = useState<any>(null);
  const [runningExperiments, setRunningExperiments] = useState(false);
  // Analytics removido - causava erros
const [analytics, setAnalytics] = useState<any>(null);
const [loadingAnalytics, setLoadingAnalytics] = useState(false);
const [analyticsPeriod, setAnalyticsPeriod] = useState('30');
const [filterType, setFilterType] = useState<'quick' | 'custom' | 'single'>('quick');
const [customStartDate, setCustomStartDate] = useState('');
const [customEndDate, setCustomEndDate] = useState('');
const [singleDate, setSingleDate] = useState('');

  // Estados para proxy
  const [proxyConfig, setProxyConfig] = useState<any>(null);
  const [proxyName, setProxyName] = useState('');
  const [proxyEnabled, setProxyEnabled] = useState(false);
  const [proxyType, setProxyType] = useState<'socks5' | 'http'>('socks5');
  const [proxyHost, setProxyHost] = useState('');
  const [proxyPort, setProxyPort] = useState('');
  const [proxyUsername, setProxyUsername] = useState('');
  const [proxyPassword, setProxyPassword] = useState('');
  const [testingProxy, setTestingProxy] = useState(false);
  const [proxyTestResult, setProxyTestResult] = useState<any>(null);

  // Estados para webhooks
  const [webhookConfig, setWebhookConfig] = useState<any>(null);
  const [webhookStats, setWebhookStats] = useState<any>(null);
  const [webhookLogs, setWebhookLogs] = useState<any[]>([]);
  const [webhookStatusCard, setWebhookStatusCard] = useState<any>(null);
  const [loadingWebhook, setLoadingWebhook] = useState(false);
  const [webhookPeriod, setWebhookPeriod] = useState('24h');
  const [showLogsDetails, setShowLogsDetails] = useState<number | null>(null);

  // Estados para financeiro
  const [facebookBilling, setFacebookBilling] = useState<any>(null);
  const [loadingBilling, setLoadingBilling] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState('today');
  const [billingStartDate, setBillingStartDate] = useState('');
  const [billingEndDate, setBillingEndDate] = useState('');

  // Estados para templates
  const [templates, setTemplates] = useState<any[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templatesSearch, setTemplatesSearch] = useState('');
  const [templatesFilter, setTemplatesFilter] = useState<'all' | 'APPROVED' | 'PENDING' | 'REJECTED'>('all');


  useEffect(() => {
    if (id) {
      loadAccount();
      loadProfile();
    }
  }, [id]);


  useEffect(() => {
    if (id && activeTab === 'webhooks') {
      loadWebhookData();
    }
  }, [id, activeTab, webhookPeriod]);

  useEffect(() => {
    if (id && activeTab === 'financeiro') {
      loadFacebookBilling();
    }
  }, [id, activeTab, billingPeriod, billingStartDate, billingEndDate]);

  useEffect(() => {
    if (id && activeTab === 'templates') {
      loadTemplates();
    }
  }, [id, activeTab]);

  const loadAccount = async () => {
    try {
      const response = await api.get(`/whatsapp-accounts/${id}`);
      if (response.data.success) {
        setAccount(response.data.data);
      }
    } catch (error) {
      console.error('Erro ao carregar conta:', error);
      toast.error('Erro ao carregar conta');
    } finally {
      setLoading(false);
    }
  };

  const loadProfile = async () => {
    try {
      const response = await api.get(`/whatsapp-accounts/${id}/profile`);
      if (response.data.success) {
        setProfile(response.data.data);
      }
    } catch (error) {
      console.error('Erro ao carregar perfil:', error);
    }
  };

  const loadTemplates = async () => {
    try {
      setLoadingTemplates(true);
      const response = await api.get(`/whatsapp-accounts/${id}/templates`);
      if (response.data.success) {
        setTemplates(response.data.data || []);
      }
    } catch (error) {
      console.error('Erro ao carregar templates:', error);
      toast.error('Erro ao carregar templates');
    } finally {
      setLoadingTemplates(false);
    }
  };

  // Analytics removido - causava erros
  /*
  const loadAnalytics = async () => {
    setLoadingAnalytics(true);
    try {
      const params = new URLSearchParams();

      if (filterType === 'quick') {
        params.append('period', analyticsPeriod);
      } else if (filterType === 'single') {
        if (singleDate) {
          params.append('start_date', singleDate);
          params.append('end_date', singleDate);
        }
      } else if (filterType === 'custom') {
        if (customStartDate && customEndDate) {
          params.append('start_date', customStartDate);
          params.append('end_date', customEndDate);
        }
      }

      const queryString = params.toString() ? `?${params.toString()}` : '';
      const response = await api.get(`/whatsapp-accounts/${id}/analytics${queryString}`);
      
      if (response.data.success) {
        setAnalytics(response.data.data);
      } else {
        toast.error(response.data.error || 'Erro ao carregar estatísticas');
      }
    } catch (error) {
      toast.error('Erro ao carregar estatísticas');
    } finally {
      setLoadingAnalytics(false);
    }
  };
  */

  // Carregar dados de webhook
  const loadWebhookData = async () => {
    setLoadingWebhook(true);
    try {
      // Carregar configuração
      const configResponse = await api.get(`/webhook/config?account_id=${id}`);
      if (configResponse.data.success) {
        setWebhookConfig(configResponse.data.data);
      }

      // Carregar estatísticas
      const statsResponse = await api.get(`/webhook/stats?account_id=${id}&period=${webhookPeriod}`);
      if (statsResponse.data.success) {
        setWebhookStats(statsResponse.data.data);
      }

      // Carregar logs recentes
      const logsResponse = await api.get(`/webhook/logs?account_id=${id}&limit=10`);
      if (logsResponse.data.success) {
        setWebhookLogs(logsResponse.data.data);
      }

      const statusResponse = await api.get(`/webhook/status?account_id=${id}&period=${webhookPeriod}`);
      if (statusResponse.data.success) {
        setWebhookStatusCard(statusResponse.data.data);
      } else {
        setWebhookStatusCard(null);
      }
    } catch (error) {
      console.error('Erro ao carregar dados de webhook:', error);
      toast.error('Erro ao carregar dados de webhook');
    } finally {
      setLoadingWebhook(false);
    }
  };

  // Carregar dados financeiros do WhatsApp API
  const loadFacebookBilling = async () => {
    setLoadingBilling(true);
    try {
      console.log('🔍 Carregando custos do WhatsApp para conta:', id);
      
      // Calcular datas baseado no período selecionado
      let startDate = '';
      let endDate = '';
      const today = new Date().toISOString().split('T')[0];
      
      if (billingPeriod === 'today') {
        startDate = today;
        endDate = today;
      } else if (billingPeriod === '7days') {
        const date7DaysAgo = new Date();
        date7DaysAgo.setDate(date7DaysAgo.getDate() - 7);
        startDate = date7DaysAgo.toISOString().split('T')[0];
        endDate = today;
      } else if (billingPeriod === '30days') {
        const date30DaysAgo = new Date();
        date30DaysAgo.setDate(date30DaysAgo.getDate() - 30);
        startDate = date30DaysAgo.toISOString().split('T')[0];
        endDate = today;
      } else if (billingPeriod === 'custom') {
        startDate = billingStartDate;
        endDate = billingEndDate;
      }
      
      // Buscar dados da conta incluindo custos do WhatsApp com filtro de data
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      
      const queryString = params.toString() ? `?${params.toString()}` : '';
      console.log('📅 Período:', { billingPeriod, startDate, endDate });
      
      const response = await api.get(`/whatsapp-accounts/${id}/details${queryString}`);
      
      console.log('📦 Resposta da API:', response.data);
      
      if (response.data.success && response.data.data) {
        console.log('💰 Custos recebidos:', {
          total: response.data.data.total_cost,
          utility: response.data.data.cost_utility,
          marketing: response.data.data.cost_marketing,
          authentication: response.data.data.cost_authentication,
          service: response.data.data.cost_service
        });
        
        console.log('📊 Mensagens recebidas:', {
          utility: response.data.data.stats_utility,
          marketing: response.data.data.stats_marketing
        });
        
        setFacebookBilling({
          whatsappCosts: {
            utility: response.data.data.cost_utility || 0,
            marketing: response.data.data.cost_marketing || 0,
            authentication: response.data.data.cost_authentication || 0,
            service: response.data.data.cost_service || 0,
            total: response.data.data.total_cost || 0,
          },
          messages: {
            utility: response.data.data.stats_utility || 0,
            marketing: response.data.data.stats_marketing || 0,
          },
          period: {
            start: startDate,
            end: endDate,
            label: billingPeriod
          }
        });
        
        console.log('✅ Estado facebookBilling atualizado!');
      } else {
        console.error('❌ Erro ao carregar dados:', response.data.error || 'Resposta inválida');
      }
    } catch (error) {
      console.error('❌ Erro ao carregar dados financeiros:', error);
    } finally {
      setLoadingBilling(false);
    }
  };


  // Carregar configuração de proxy
  const loadProxyConfig = async () => {
    try {
      const response = await api.get(`/whatsapp-accounts/${id}/proxy`);
      
      if (response.data.success && response.data.data) {
        setProxyConfig(response.data.data);
        setProxyName(response.data.data.name || '');
        setProxyEnabled(response.data.data.enabled || false);
        setProxyType(response.data.data.type || 'socks5');
        setProxyHost(response.data.data.host || '');
        setProxyPort(response.data.data.port?.toString() || '');
        setProxyUsername(response.data.data.username || '');
        setProxyPassword(response.data.data.password || '');
      }
    } catch (error) {
      console.error('Erro ao carregar proxy:', error);
    }
  };

  // Salvar configuração de proxy
  const handleSaveProxy = async () => {
    setSaving(true);
    try {
      const proxyData = {
        name: proxyName,
        enabled: proxyEnabled,
        type: proxyType,
        host: proxyHost,
        port: parseInt(proxyPort) || 0,
        username: proxyUsername,
        password: proxyPassword
      };

      const response = await api.post(`/whatsapp-accounts/${id}/proxy`, proxyData);

      if (response.data.success) {
        toast.success('✅ Configuração de proxy salva com sucesso!');
        loadProxyConfig(); // Recarregar
      } else {
        toast.error(response.data.error || 'Erro ao salvar proxy');
      }
    } catch (error) {
      console.error('Erro ao salvar proxy:', error);
      toast.error('Erro ao salvar configuração de proxy');
    } finally {
      setSaving(false);
    }
  };

  // Testar proxy
  const handleTestProxy = async () => {
    setTestingProxy(true);
    setProxyTestResult(null);
    try {
      const proxyData = {
        enabled: proxyEnabled,
        type: proxyType,
        host: proxyHost,
        port: parseInt(proxyPort) || 0,
        username: proxyUsername,
        password: proxyPassword
      };

      const response = await api.post(`/whatsapp-accounts/${id}/proxy/test`, proxyData);
      setProxyTestResult(response.data);
      
      if (response.data.success) {
        toast.success('✅ Proxy funcionando corretamente!');
      } else {
        toast.error(response.data.error || 'Erro ao testar proxy');
      }
    } catch (error) {
      console.error('Erro ao testar proxy:', error);
      setProxyTestResult({ success: false, error: 'Erro ao conectar no proxy' });
      toast.error('Erro ao testar proxy');
    } finally {
      setTestingProxy(false);
    }
  };

  // Carregar proxy quando aba proxy for ativada
  useEffect(() => {
    if (id && activeTab === 'proxy' && !proxyConfig) {
      loadProxyConfig();
    }
  }, [id, activeTab]);

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const response = await api.post(`/whatsapp-accounts/${id}/profile`, profile);

      if (response.data.success) {
        if (response.data.warning) {
          toast.success('⚠️ Perfil parcialmente atualizado!');
          toast.error(response.data.warning);
        } else {
          toast.success('✅ Perfil atualizado com sucesso!');
        }
        loadProfile();
      } else {
        toast.error('❌ Erro ao atualizar perfil: ' + response.data.error);
      }
    } catch (error: any) {
      toast.error('❌ Erro ao atualizar perfil: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTestPermissions = async () => {
    setTestingPermissions(true);
    try {
      const response = await api.get(`/whatsapp-accounts/${id}/test-permissions`);
      
      if (response.data.success) {
        setPermissionsTest(response.data.diagnostics);
        const allPassed = response.data.diagnostics.tests.every((t: any) => t.status === 'success');
        if (allPassed) {
          toast.success('✅ Todos os testes passaram! Você pode fazer o upload.');
        } else {
          toast.error('❌ Alguns testes falharam. Verifique os detalhes abaixo.');
        }
      } else {
        toast.error('❌ Erro no diagnóstico: ' + response.data.error);
      }
    } catch (error: any) {
      toast.error('❌ Erro: ' + error.message);
    } finally {
      setTestingPermissions(false);
    }
  };

  const handleRunExperimentalTests = async () => {
    if (!profilePhoto) {
      toast.error('Selecione uma foto primeiro para testar');
      return;
    }

    setRunningExperiments(true);
    setExperimentalTests(null);
    
    try {
      const formData = new FormData();
      formData.append('photo', profilePhoto);

      toast.info('🧪 Executando 5 testes experimentais... Isso pode levar 30-60 segundos.');

      const response = await api.post(`/whatsapp-accounts/${id}/test-profile-photo-upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      if (response.data.success) {
        setExperimentalTests(response.data);
        
        if (response.data.summary.successful > 0) {
          toast.success(`🎉 INCRÍVEL! ${response.data.summary.successful} de ${response.data.summary.total_tests} testes funcionaram!`);
        } else {
          toast.error(`❌ Todos os ${response.data.summary.total_tests} testes falharam. Confirmada limitação da API.`);
        }
      } else {
        toast.error('❌ Erro nos testes: ' + response.data.error);
      }
    } catch (error: any) {
      toast.error('❌ Erro: ' + error.message);
    } finally {
      setRunningExperiments(false);
    }
  };

  const handleUploadPhoto = async () => {
    if (!profilePhoto) {
      toast.error('Selecione uma foto primeiro');
      return;
    }

    // Validações do arquivo
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!validTypes.includes(profilePhoto.type)) {
      toast.error('❌ Formato não suportado. Use apenas JPG ou PNG');
      return;
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (profilePhoto.size > maxSize) {
      toast.error('❌ Arquivo muito grande. Máximo: 5MB');
      return;
    }

    const minSize = 10 * 1024; // 10KB
    if (profilePhoto.size < minSize) {
      toast.error('❌ Arquivo muito pequeno. Mínimo: 10KB');
      return;
    }

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('photo', profilePhoto);

      const response = await api.post(`/whatsapp-accounts/${id}/profile-photo`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.success) {
        toast.success('✅ Foto de perfil atualizada!');
        setProfilePhoto(null);
        // Limpar o input de arquivo
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
        loadProfile();
      } else {
        // Se houver métodos alternativos, mostrar em modal
        if (response.data.alternative_methods) {
          const message = response.data.error + '\n\n' + 
            response.data.alternative_methods.map((method: any) => 
              `${method.method}:\n` + method.steps.join('\n• ')
            ).join('\n\n');
          
          // Criar modal customizado
          const shouldOpenManager = window.confirm(
            response.data.error + '\n\nDeseja abrir o WhatsApp Business Manager agora?'
          );
          
          if (shouldOpenManager && response.data.alternative_methods[0]?.url) {
            window.open(response.data.alternative_methods[0].url, '_blank');
          }
        } else {
          toast.error('❌ ' + response.data.error);
        }
      }
    } catch (error: any) {
      toast.error('❌ Erro: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSetPin = async () => {
    if (twoStepPin !== confirmPin) {
      toast.error('Os PINs não coincidem!');
      return;
    }

    if (!/^\d{6}$/.test(twoStepPin)) {
      toast.error('PIN deve ter 6 dígitos numéricos');
      return;
    }

    setSaving(true);
    try {
      const response = await api.post(`/whatsapp-accounts/${id}/two-step-pin`, { pin: twoStepPin });

      if (response.data.success) {
        toast.success('✅ PIN configurado com sucesso!');
        setTwoStepPin('');
        setConfirmPin('');
      } else {
        toast.error('❌ Erro: ' + response.data.error);
      }
    } catch (error: any) {
      toast.error('❌ Erro: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateQRCode = async () => {
    try {
      const response = await api.get(`/whatsapp-accounts/${id}/qrcode`);
      if (response.data.success) {
        setQrCode(response.data.data);
        toast.success('✅ QR Code gerado!');
      } else {
        toast.error('❌ Erro: ' + response.data.error);
      }
    } catch (error: any) {
      toast.error('❌ Erro: ' + error.message);
    }
  };

  const handleHealthCheck = async () => {
    try {
      const response = await api.get(`/whatsapp-accounts/${id}/health`);
      setHealthCheck(response.data.data);
      if (response.data.success) {
        toast.success('✅ Saúde da conta verificada!');
      }
    } catch (error: any) {
      toast.error('❌ Erro: ' + error.message);
    }
  };

  const handleSaveFacebookIntegration = async () => {
    setSaving(true);
    try {
      const response = await api.post(`/whatsapp-accounts/${id}/facebook-integration`, {
        facebook_access_token: facebookToken,
        ad_account_id: facebookAdAccount,
        business_id: facebookBusiness,
      });

      if (response.data.success) {
        toast.success('✅ Integração configurada!');
        setEditingFacebookCredentials(false);
        setFacebookToken('');
        setFacebookAdAccount('');
        setFacebookBusiness('');
        loadAccount();
      } else {
        toast.error('❌ Erro: ' + response.data.error);
      }
    } catch (error: any) {
      toast.error('❌ Erro: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'basico' as TabType, label: 'Básico', icon: <FaPhone /> },
    { id: 'perfil' as TabType, label: 'Perfil', icon: <FaUser /> },
    { id: 'seguranca' as TabType, label: 'Segurança', icon: <FaLock /> },
    { id: 'webhooks' as TabType, label: 'Webhooks', icon: <FaBell /> },
    { id: 'templates' as TabType, label: 'Templates', icon: <FaFileAlt /> },
    { id: 'financeiro' as TabType, label: 'Financeiro', icon: <FaDollarSign /> },
    { id: 'avancado' as TabType, label: 'Avançado', icon: <FaCog /> },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 flex items-center justify-center">
        <div className="text-white text-xl">Carregando...</div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 flex items-center justify-center">
        <div className="text-white text-xl">Conta não encontrada</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 py-8 px-4">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

      <div className="max-w-7xl mx-auto space-y-8">
        {/* 🎨 CABEÇALHO PRINCIPAL - ESTILO IGUAL AS OUTRAS PÁGINAS */}
        <div className="relative overflow-hidden bg-gradient-to-r from-purple-600/30 via-purple-500/20 to-purple-600/30 backdrop-blur-xl border-2 border-purple-500/40 rounded-3xl p-10 shadow-2xl shadow-purple-500/20">
          <div className="absolute inset-0 bg-grid-white/[0.02]"></div>
          <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl"></div>
          
          <div className="relative">
            <div className="flex items-center justify-between flex-wrap gap-6">
              <div className="flex items-center gap-6">
                <Link href="/configuracoes">
                  <button className="bg-white/10 hover:bg-white/20 backdrop-blur-sm border-2 border-white/30 rounded-xl px-6 py-4 transition-all duration-200 flex items-center gap-3 text-white font-bold shadow-lg hover:shadow-white/20 transform hover:scale-105">
                    <FaArrowLeft className="text-xl" /> Voltar
                  </button>
                </Link>
                <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-6 rounded-2xl shadow-lg shadow-purple-500/50">
                  <FaCog className="text-5xl text-white" />
                </div>
                <div>
                  <h1 className="text-5xl font-black text-white tracking-tight mb-2">
                    Configurações da Conta
                  </h1>
                  <p className="text-2xl text-white/80 font-medium">
                    {account.name}
                  </p>
                  <p className="text-lg text-white/60 font-medium mt-1">
                    📱 {account.phone_number}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                {account.is_active ? (
                  <span className="px-6 py-4 rounded-2xl text-lg font-bold border-2 bg-green-500/20 text-green-300 border-green-500/30 inline-flex items-center gap-3 shadow-xl shadow-green-500/20">
                    <span className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></span>
                    ATIVA
                  </span>
                ) : (
                  <span className="px-6 py-4 rounded-2xl text-lg font-bold border-2 bg-red-500/20 text-red-300 border-red-500/30 inline-flex items-center gap-3">
                    <span className="w-3 h-3 bg-red-400 rounded-full"></span>
                    INATIVA
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 🎨 NAVEGAÇÃO DE ABAS - DESIGN MODERNO */}
        <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-6 shadow-xl">
          <div className="flex gap-3 flex-wrap">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  px-8 py-4 rounded-xl font-bold text-lg transition-all duration-200 flex items-center gap-3 whitespace-nowrap transform
                  ${activeTab === tab.id
                    ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/40 scale-105 border-2 border-primary-400/50'
                    : 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border-2 border-white/10 hover:border-white/20 hover:scale-102'
                  }
                `}
              >
                <span className="text-2xl">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* 🎨 CONTEÚDO DAS ABAS - DESIGN MODERNO */}
        <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-primary-500/30 rounded-2xl p-10 shadow-2xl">
          {activeTab === 'basico' && (
            <div className="space-y-8">
              {/* Título da Seção */}
              <div className="flex items-center gap-4 pb-6 border-b-2 border-white/10">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-4 rounded-xl shadow-lg">
                  <FaPhone className="text-4xl text-white" />
                </div>
                <div>
                  <h2 className="text-4xl font-black text-white">
                    Informações Básicas
                  </h2>
                  <p className="text-lg text-white/60 mt-1">
                    Dados fundamentais da sua conta WhatsApp API
                  </p>
                </div>
              </div>
              
              <div className="grid gap-6">
                {/* Nome da Conta */}
                <div className="bg-gradient-to-br from-white/10 to-white/5 border-2 border-white/20 rounded-xl p-6 hover:border-white/30 transition-all">
                  <label className="block text-white/80 font-bold text-lg mb-3 flex items-center gap-2">
                    <span className="text-2xl">📝</span> Nome da Conta
                  </label>
                  <input
                    type="text"
                    value={account.name}
                    disabled
                    className="w-full px-6 py-4 text-xl bg-dark-700 border-2 border-white/20 rounded-xl text-white font-medium"
                  />
                </div>

                {/* Número do WhatsApp */}
                <div className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-2 border-green-500/30 rounded-xl p-6 hover:border-green-500/50 transition-all">
                  <label className="block text-green-300 font-bold text-lg mb-3 flex items-center gap-2">
                    <span className="text-2xl">📱</span> Número do WhatsApp
                  </label>
                  <input
                    type="text"
                    value={account.phone_number}
                    disabled
                    className="w-full px-6 py-4 text-xl bg-dark-700 border-2 border-green-500/30 rounded-xl text-white font-medium"
                  />
                  <p className="text-green-200/70 text-sm mt-3 flex items-center gap-2 bg-green-500/10 p-3 rounded-lg">
                    <FaInfoCircle /> Este campo não pode ser alterado após a criação da conta
                  </p>
                </div>

                {/* Phone Number ID */}
                <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-2 border-purple-500/30 rounded-xl p-6 hover:border-purple-500/50 transition-all">
                  <label className="block text-purple-300 font-bold text-lg mb-3 flex items-center gap-2">
                    <span className="text-2xl">🆔</span> Phone Number ID (API)
                  </label>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={account.phone_number_id}
                      disabled
                      className="flex-1 px-6 py-4 text-lg bg-dark-700 border-2 border-purple-500/30 rounded-xl text-white font-mono"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(account.phone_number_id);
                        toast.success('📋 Phone Number ID copiado!');
                      }}
                      className="px-8 py-4 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white border-2 border-purple-400/50 rounded-xl font-bold transition-all shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 transform hover:scale-105 flex items-center gap-2 text-lg"
                    >
                      📋 Copiar
                    </button>
                  </div>
                  <p className="text-purple-200/70 text-sm mt-3 flex items-center gap-2 bg-purple-500/10 p-3 rounded-lg">
                    <FaInfoCircle /> Use este ID para integrar com a WhatsApp Business API
                  </p>
                </div>

                {/* Status da Conta */}
                <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-2 border-emerald-500/30 rounded-xl p-6">
                  <label className="block text-emerald-300 font-bold text-lg mb-4 flex items-center gap-2">
                    <span className="text-2xl">📊</span> Status da Conta
                  </label>
                  <div className="bg-emerald-500/10 border-2 border-emerald-500/30 rounded-xl p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="bg-emerald-500/20 p-4 rounded-xl">
                          <FaCheckCircle className="text-4xl text-emerald-300" />
                        </div>
                        <div>
                          <p className="text-2xl font-black text-white mb-1">Conectada</p>
                          <p className="text-emerald-200/70 text-sm">Conta ativa e funcionando normalmente</p>
                        </div>
                      </div>
                      <span className="w-4 h-4 bg-emerald-400 rounded-full animate-pulse shadow-lg shadow-emerald-400/50"></span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'perfil' && (
            <div className="space-y-8">
              {/* Título da Seção */}
              <div className="flex items-center gap-4 pb-6 border-b-2 border-white/10">
                <div className="bg-gradient-to-br from-pink-500 to-pink-600 p-4 rounded-xl shadow-lg">
                  <FaUser className="text-4xl text-white" />
                </div>
                <div>
                  <h2 className="text-4xl font-black text-white">
                    Perfil do Negócio
                  </h2>
                  <p className="text-lg text-white/60 mt-1">
                    Configure as informações públicas da sua empresa no WhatsApp
                  </p>
                </div>
              </div>

              {/* Foto de Perfil */}
              <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/5 border-2 border-yellow-500/30 rounded-xl p-8 shadow-lg">
                <h3 className="text-2xl font-bold text-white mb-6 flex items-center justify-center gap-3">
                  <FaImage className="text-3xl text-yellow-300" /> 
                  Foto de Perfil WhatsApp
                </h3>
                
                {profile.profile_picture_url && (
                  <div className="mb-8 flex justify-center">
                    <div className="relative">
                      <img
                        src={profile.profile_picture_url}
                        alt="Perfil"
                        className="w-48 h-48 rounded-full object-cover border-4 border-yellow-500 shadow-2xl shadow-yellow-500/30 ring-4 ring-yellow-500/20"
                      />
                      <div className="absolute bottom-2 right-2 w-8 h-8 bg-green-500 rounded-full border-4 border-dark-800"></div>
                    </div>
                  </div>
                )}

                <div className="bg-gradient-to-br from-red-500/20 to-red-600/10 border-2 border-red-500/40 rounded-xl p-6 shadow-lg">
                  <div className="flex flex-col items-center text-center mb-4">
                    <div className="bg-red-500/20 p-4 rounded-full mb-4">
                      <span className="text-5xl">🚫</span>
                    </div>
                    <div>
                      <p className="text-red-200 font-black text-2xl mb-3">
                        Upload NÃO Disponível via API
                      </p>
                      <p className="text-red-200/80 text-base leading-relaxed max-w-2xl">
                        A <strong className="text-red-100">WhatsApp Business Cloud API não permite</strong> alterar a foto de perfil programaticamente.
                        Esta é uma <strong className="text-red-100">limitação oficial da Meta/WhatsApp</strong>.
                      </p>
                    </div>
                  </div>

                  {/* Collapse/Accordion com as instruções */}
                  <details className="group mt-6">
                    <summary className="cursor-pointer list-none">
                      <div className="flex items-center justify-between p-4 bg-red-900/30 hover:bg-red-900/40 rounded-xl transition-all border-2 border-red-500/30">
                        <span className="text-red-100 font-bold text-lg flex items-center gap-3">
                          📱 Como alterar sua foto de perfil?
                        </span>
                        <span className="text-red-200 transform transition-transform group-open:rotate-180 text-2xl">
                          ▼
                        </span>
                      </div>
                    </summary>
                    
                    <div className="mt-4 space-y-4 animate-fade-in">
                      <div className="bg-red-900/30 border-2 border-red-500/30 rounded-xl p-5">
                        <p className="text-red-100 font-black text-lg mb-3 flex items-center gap-3">
                          <span className="text-2xl">1️⃣</span>
                          WhatsApp Business Manager (Recomendado)
                        </p>
                        <ol className="text-red-100/90 text-sm space-y-2 ml-8 mb-4">
                          <li>1. Acesse o link abaixo</li>
                          <li>2. Faça login com sua conta Meta</li>
                          <li>3. Vá em: Telefones → Selecione sua conta</li>
                          <li>4. Clique na aba "Perfil"</li>
                          <li>5. Clique em "Escolher arquivo" na seção "Foto de perfil"</li>
                        </ol>
                        <a 
                          href="https://business.facebook.com/wa/manage/phone-numbers/" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white rounded-xl font-bold text-base transition-all shadow-lg shadow-primary-500/30 hover:shadow-primary-500/50 transform hover:scale-105"
                        >
                          🔗 Abrir Business Manager
                        </a>
                      </div>
                      
                      <div className="bg-red-900/30 border-2 border-red-500/30 rounded-xl p-5">
                        <p className="text-red-100 font-black text-lg mb-3 flex items-center gap-3">
                          <span className="text-2xl">2️⃣</span>
                          App WhatsApp Business (Celular)
                        </p>
                        <ol className="text-red-100/90 text-sm space-y-2 ml-8">
                          <li>1. Abra o aplicativo WhatsApp Business</li>
                          <li>2. Toque em ⋮ (menu) → Configurações</li>
                          <li>3. Toque em "Perfil da empresa"</li>
                          <li>4. Toque na foto de perfil atual</li>
                          <li>5. Escolha "Galeria" ou "Câmera"</li>
                        </ol>
                      </div>

                      <div className="pt-3 border-t-2 border-red-500/20">
                        <p className="text-red-200/80 text-sm italic bg-red-900/20 p-4 rounded-lg">
                          💡 <strong>Dica:</strong> Use imagens no formato JPG ou PNG, tamanho máximo de 5MB, dimensões recomendadas: 640x640 pixels.
                        </p>
                      </div>
                    </div>
                  </details>
                </div>
              </div>

              {/* Campos do Perfil */}
              <div className="space-y-4">
                {/* Nome de Exibição */}
                <div className="p-6 bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-2 border-blue-500/30 rounded-xl">
                  <div className="flex items-start gap-3 mb-4">
                    <span className="text-3xl">👤</span>
                    <div className="flex-1">
                      <label className="block text-blue-300 font-bold text-lg mb-1">
                        Nome de Exibição
                      </label>
                      <p className="text-blue-200/70 text-xs">
                        Nome oficial da sua conta WhatsApp Business
                      </p>
                    </div>
                  </div>

                  {/* Nome Atual na API */}
                  <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-green-400">✓</span>
                      <span className="text-green-300 text-sm font-semibold">Nome Atual na API:</span>
                      <span className="text-white font-bold">
                        {profile.verified_name || account?.name || 'Carregando...'}
                      </span>
                    </div>
                  </div>

                  {/* Campo Editável */}
                  <div className="space-y-3">
                    <label className="block text-white/80 font-medium">
                      ✏️ Editar Nome de Exibição
                    </label>
                    <p className="text-white/60 text-xs mb-2">
                      ⚠️ <strong>ATENÇÃO:</strong> A API do WhatsApp tem limitações. O nome pode não ser alterado mesmo enviando. 
                      Para garantir a alteração, use o <a href="https://business.facebook.com/wa/manage/phone-numbers/" target="_blank" rel="noopener noreferrer" className="text-primary-300 hover:text-primary-200 underline">WhatsApp Business Manager</a>.
                    </p>
                    <input
                      type="text"
                      value={profile.display_name || profile.verified_name || ''}
                      onChange={(e) => setProfile({ ...profile, display_name: e.target.value })}
                      maxLength={512}
                      className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder-white/50 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30 transition-all"
                      placeholder="Digite o novo nome (ex: NETTCRED FINANCEIRA)"
                    />
                    <div className="flex items-center justify-between">
                      <p className="text-white/50 text-xs">
                        {(profile.display_name || profile.verified_name || '').length}/512 caracteres
                      </p>
                      <p className="text-orange-300 text-xs">
                        💡 Clique em "Salvar Perfil" no final da página
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-white/80 font-medium mb-2">Sobre (About)</label>
                  <textarea
                    value={profile.about || ''}
                    onChange={(e) => setProfile({ ...profile, about: e.target.value })}
                    maxLength={139}
                    rows={3}
                    className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder-white/50"
                    placeholder="Breve descrição da empresa"
                  />
                  <p className="text-white/50 text-sm mt-1">
                    {profile.about?.length || 0}/139 caracteres
                  </p>
                </div>

                <div>
                  <label className="block text-white/80 font-medium mb-2">Descrição Completa</label>
                  <textarea
                    value={profile.description || ''}
                    onChange={(e) => setProfile({ ...profile, description: e.target.value })}
                    maxLength={512}
                    rows={5}
                    className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white"
                    placeholder="Descrição detalhada do negócio"
                  />
                  <p className="text-white/50 text-sm mt-1">
                    {profile.description?.length || 0}/512 caracteres
                  </p>
                </div>

                <div>
                  <label className="block text-white/80 font-medium mb-2">Email de Contato</label>
                  <input
                    type="email"
                    value={profile.email || ''}
                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white"
                    placeholder="contato@empresa.com"
                  />
                </div>

                <div>
                  <label className="block text-white/80 font-medium mb-2">Endereço</label>
                  <input
                    type="text"
                    value={profile.address || ''}
                    onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white"
                    placeholder="Rua Exemplo, 123 - Cidade, Estado - CEP 00000-000"
                  />
                </div>

                <div>
                  <label className="block text-white/80 font-medium mb-2">Categoria do Negócio (Vertical)</label>
                  <select
                    value={profile.vertical || ''}
                    onChange={(e) => setProfile({ ...profile, vertical: e.target.value })}
                    className="w-full px-4 py-3 bg-dark-700 border border-white/20 rounded-xl text-white appearance-none cursor-pointer hover:bg-dark-600 transition-colors"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='white'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 0.75rem center',
                      backgroundSize: '1.5em 1.5em',
                      paddingRight: '2.5rem'
                    }}
                  >
                    <option value="" style={{ backgroundColor: '#1a2e1a', color: 'white' }}>Selecione uma categoria</option>
                    <option value="AUTOMOTIVE" style={{ backgroundColor: '#1a2e1a', color: 'white' }}>🚗 Automotivo</option>
                    <option value="BEAUTY" style={{ backgroundColor: '#1a2e1a', color: 'white' }}>💄 Beleza e Estética</option>
                    <option value="APPAREL" style={{ backgroundColor: '#1a2e1a', color: 'white' }}>👕 Vestuário e Moda</option>
                    <option value="EDU" style={{ backgroundColor: '#1a2e1a', color: 'white' }}>📚 Educação</option>
                    <option value="ENTERTAIN" style={{ backgroundColor: '#1a2e1a', color: 'white' }}>🎬 Entretenimento</option>
                    <option value="EVENT_PLAN" style={{ backgroundColor: '#1a2e1a', color: 'white' }}>🎉 Planejamento de Eventos</option>
                    <option value="FINANCE" style={{ backgroundColor: '#1a2e1a', color: 'white' }}>💰 Financeiro</option>
                    <option value="GROCERY" style={{ backgroundColor: '#1a2e1a', color: 'white' }}>🛒 Supermercado</option>
                    <option value="GOVT" style={{ backgroundColor: '#1a2e1a', color: 'white' }}>🏛️ Governo</option>
                    <option value="HOTEL" style={{ backgroundColor: '#1a2e1a', color: 'white' }}>🏨 Hotel e Hospedagem</option>
                    <option value="HEALTH" style={{ backgroundColor: '#1a2e1a', color: 'white' }}>⚕️ Saúde</option>
                    <option value="NONPROFIT" style={{ backgroundColor: '#1a2e1a', color: 'white' }}>❤️ Organização sem fins lucrativos</option>
                    <option value="PROF_SERVICES" style={{ backgroundColor: '#1a2e1a', color: 'white' }}>💼 Serviços Profissionais</option>
                    <option value="RETAIL" style={{ backgroundColor: '#1a2e1a', color: 'white' }}>🛍️ Varejo</option>
                    <option value="TRAVEL" style={{ backgroundColor: '#1a2e1a', color: 'white' }}>✈️ Viagens e Turismo</option>
                    <option value="RESTAURANT" style={{ backgroundColor: '#1a2e1a', color: 'white' }}>🍴 Restaurante</option>
                    <option value="OTHER" style={{ backgroundColor: '#1a2e1a', color: 'white' }}>📦 Outro</option>
                  </select>
                </div>

                {/* Sites (até 2 websites) */}
                <div className="space-y-4 p-6 bg-white/5 border border-white/10 rounded-xl">
                  <h3 className="text-lg font-bold text-white mb-2">
                    🌐 Sites (Websites)
                  </h3>
                  <p className="text-white/60 text-sm mb-4">
                    Você pode adicionar até 2 sites
                  </p>
                  
                  <div>
                    <label className="block text-white/80 font-medium mb-2">Site Principal</label>
                    <input
                      type="url"
                      value={profile.websites?.[0] || ''}
                      onChange={(e) => {
                        const websites = [...(profile.websites || [])];
                        if (e.target.value) {
                          websites[0] = e.target.value;
                        } else {
                          websites.splice(0, 1);
                        }
                        setProfile({ ...profile, websites });
                      }}
                      className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white"
                      placeholder="https://www.seusite.com.br"
                    />
                  </div>

                  <div>
                    <label className="block text-white/80 font-medium mb-2">Site Secundário (opcional)</label>
                    <input
                      type="url"
                      value={profile.websites?.[1] || ''}
                      onChange={(e) => {
                        const websites = [...(profile.websites || [])];
                        if (e.target.value) {
                          // Garante que existe o primeiro antes de adicionar o segundo
                          if (!websites[0]) {
                            websites[0] = '';
                          }
                          websites[1] = e.target.value;
                        } else {
                          websites.splice(1, 1);
                        }
                        setProfile({ ...profile, websites });
                      }}
                      className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white"
                      placeholder="https://www.outrosite.com.br"
                    />
                  </div>

                  <p className="text-white/50 text-sm">
                    💡 URLs completas incluindo https://
                  </p>
                </div>

                <button
                  onClick={handleSaveProfile}
                  disabled={saving}
                  className="w-full px-6 py-4 bg-primary-500 hover:bg-primary-600 text-white rounded-xl font-bold disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? '⏳ Salvando...' : <><FaSave /> Salvar Perfil</>}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'seguranca' && (
            <div className="space-y-8">
              {/* Título da Seção */}
              <div className="flex items-center gap-4 pb-6 border-b-2 border-white/10">
                <div className="bg-gradient-to-br from-red-500 to-red-600 p-4 rounded-xl shadow-lg">
                  <FaLock className="text-4xl text-white" />
                </div>
                <div>
                  <h2 className="text-4xl font-black text-white">
                    Configurações de Segurança
                  </h2>
                  <p className="text-lg text-white/60 mt-1">
                    Proteja sua conta com verificação em duas etapas
                  </p>
                </div>
              </div>

              {/* Card de Verificação em Duas Etapas */}
              <div className="bg-gradient-to-br from-orange-500/10 to-red-500/5 border-2 border-orange-500/30 rounded-xl p-8 shadow-lg">
                <div className="flex items-center gap-4 mb-8">
                  <div className="bg-orange-500/20 p-4 rounded-xl">
                    <FaShieldAlt className="text-4xl text-orange-300" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-1">
                      🔒 Verificação em Duas Etapas (2FA)
                    </h3>
                    <p className="text-orange-200/70 text-sm">
                      Configure um PIN de 6 dígitos para proteger sua conta
                    </p>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Input Novo PIN */}
                  <div className="bg-gradient-to-br from-white/10 to-white/5 border-2 border-white/20 rounded-xl p-6">
                    <label className="block text-white font-bold text-lg mb-4 flex items-center gap-2">
                      <span className="text-2xl">🔐</span> Novo PIN (6 dígitos)
                    </label>
                    <input
                      type="password"
                      value={twoStepPin}
                      onChange={(e) => setTwoStepPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      maxLength={6}
                      className="w-full px-8 py-6 bg-dark-700 border-2 border-orange-500/30 rounded-xl text-white text-center text-4xl font-bold tracking-[1rem] focus:border-orange-500 focus:ring-4 focus:ring-orange-500/30 transition-all"
                      placeholder="● ● ● ● ● ●"
                    />
                    <div className="flex items-center gap-2 mt-3">
                      <div className={`h-2 flex-1 rounded-full transition-all ${twoStepPin.length >= 1 ? 'bg-orange-500' : 'bg-white/10'}`}></div>
                      <div className={`h-2 flex-1 rounded-full transition-all ${twoStepPin.length >= 2 ? 'bg-orange-500' : 'bg-white/10'}`}></div>
                      <div className={`h-2 flex-1 rounded-full transition-all ${twoStepPin.length >= 3 ? 'bg-orange-500' : 'bg-white/10'}`}></div>
                      <div className={`h-2 flex-1 rounded-full transition-all ${twoStepPin.length >= 4 ? 'bg-orange-500' : 'bg-white/10'}`}></div>
                      <div className={`h-2 flex-1 rounded-full transition-all ${twoStepPin.length >= 5 ? 'bg-orange-500' : 'bg-white/10'}`}></div>
                      <div className={`h-2 flex-1 rounded-full transition-all ${twoStepPin.length >= 6 ? 'bg-orange-500' : 'bg-white/10'}`}></div>
                    </div>
                    <p className="text-white/50 text-sm mt-3 text-center">
                      {twoStepPin.length}/6 dígitos
                    </p>
                  </div>

                  {/* Input Confirmar PIN */}
                  <div className="bg-gradient-to-br from-white/10 to-white/5 border-2 border-white/20 rounded-xl p-6">
                    <label className="block text-white font-bold text-lg mb-4 flex items-center gap-2">
                      <span className="text-2xl">✅</span> Confirmar PIN
                    </label>
                    <input
                      type="password"
                      value={confirmPin}
                      onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      maxLength={6}
                      className="w-full px-8 py-6 bg-dark-700 border-2 border-orange-500/30 rounded-xl text-white text-center text-4xl font-bold tracking-[1rem] focus:border-orange-500 focus:ring-4 focus:ring-orange-500/30 transition-all"
                      placeholder="● ● ● ● ● ●"
                    />
                    <div className="flex items-center gap-2 mt-3">
                      <div className={`h-2 flex-1 rounded-full transition-all ${confirmPin.length >= 1 ? 'bg-orange-500' : 'bg-white/10'}`}></div>
                      <div className={`h-2 flex-1 rounded-full transition-all ${confirmPin.length >= 2 ? 'bg-orange-500' : 'bg-white/10'}`}></div>
                      <div className={`h-2 flex-1 rounded-full transition-all ${confirmPin.length >= 3 ? 'bg-orange-500' : 'bg-white/10'}`}></div>
                      <div className={`h-2 flex-1 rounded-full transition-all ${confirmPin.length >= 4 ? 'bg-orange-500' : 'bg-white/10'}`}></div>
                      <div className={`h-2 flex-1 rounded-full transition-all ${confirmPin.length >= 5 ? 'bg-orange-500' : 'bg-white/10'}`}></div>
                      <div className={`h-2 flex-1 rounded-full transition-all ${confirmPin.length >= 6 ? 'bg-orange-500' : 'bg-white/10'}`}></div>
                    </div>
                    <p className="text-white/50 text-sm mt-3 text-center">
                      {confirmPin.length}/6 dígitos
                    </p>
                    {twoStepPin && confirmPin && twoStepPin !== confirmPin && (
                      <p className="text-red-300 text-sm mt-3 text-center font-bold flex items-center justify-center gap-2">
                        <span>❌</span> Os PINs não coincidem
                      </p>
                    )}
                    {twoStepPin && confirmPin && twoStepPin === confirmPin && twoStepPin.length === 6 && (
                      <p className="text-green-300 text-sm mt-3 text-center font-bold flex items-center justify-center gap-2">
                        <span>✅</span> PINs coincidem!
                      </p>
                    )}
                  </div>

                  {/* Alerta de Segurança */}
                  <div className="bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 border-2 border-yellow-500/40 rounded-xl p-6 shadow-lg">
                    <div className="flex items-start gap-4">
                      <div className="bg-yellow-500/20 p-3 rounded-xl flex-shrink-0">
                        <span className="text-3xl">⚠️</span>
                      </div>
                      <div>
                        <p className="text-yellow-200 font-black text-lg mb-2">
                          ATENÇÃO - GUARDE ESTE PIN COM SEGURANÇA!
                        </p>
                        <ul className="text-yellow-200/90 text-sm space-y-2">
                          <li className="flex items-start gap-2">
                            <span className="text-yellow-400 mt-1">•</span>
                            <span>Este PIN será necessário para <strong>reconectar a conta</strong> caso ela seja desconectada</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-yellow-400 mt-1">•</span>
                            <span><strong>Não compartilhe</strong> este PIN com ninguém</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-yellow-400 mt-1">•</span>
                            <span>Anote em um <strong>local seguro e privado</strong></span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-yellow-400 mt-1">•</span>
                            <span>Se perder o PIN, você terá que <strong>aguardar 7 dias</strong> para redefini-lo</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Botão de Ação */}
                  <button
                    onClick={handleSetPin}
                    disabled={saving || !twoStepPin || !confirmPin || twoStepPin !== confirmPin || twoStepPin.length !== 6}
                    className="w-full px-8 py-6 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white text-xl rounded-xl font-bold transition-all shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 transform hover:scale-105 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    {saving ? (
                      <>
                        <span className="animate-spin">⏳</span> Configurando PIN...
                      </>
                    ) : (
                      <>
                        <FaLock className="text-2xl" /> Configurar PIN de Segurança
                      </>
                    )}
                  </button>
                  <p className="text-orange-200/70 text-sm text-center">
                    Configure agora para proteger sua conta com uma camada extra de segurança
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Analytics removido - estava causando erros */}
          {false && (
            <div className="space-y-8">
              {/* Título da Seção */}
              <div className="flex items-center gap-4 pb-6 border-b-2 border-white/10">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-4 rounded-xl shadow-lg">
                  <FaChartBar className="text-4xl text-white" />
                </div>
                <div>
                  <h2 className="text-4xl font-black text-white">
                    Analytics & Relatórios
                  </h2>
                  <p className="text-lg text-white/60 mt-1">
                    Estatísticas detalhadas de mensagens e conversas
                  </p>
                </div>
              </div>

                {/* Filtros Avançados */}
                <div className="bg-gradient-to-br from-white/10 to-white/5 border-2 border-white/20 rounded-xl p-6 shadow-lg space-y-6">
                  {/* Tipo de Filtro */}
                  <div>
                    <label className="block text-white font-bold text-lg mb-3">
                      🔍 Selecione o Tipo de Filtro
                    </label>
                    <div className="flex gap-3 flex-wrap">
                      <button
                        onClick={() => setFilterType('quick')}
                        className={`px-6 py-3 rounded-xl font-bold text-base transition-all transform ${
                          filterType === 'quick'
                            ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/40 scale-105'
                            : 'bg-white/10 text-white/60 hover:bg-white/20 hover:text-white border-2 border-white/20'
                        }`}
                      >
                        📅 Período Rápido
                      </button>
                      <button
                        onClick={() => setFilterType('single')}
                        className={`px-6 py-3 rounded-xl font-bold text-base transition-all transform ${
                          filterType === 'single'
                            ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/40 scale-105'
                            : 'bg-white/10 text-white/60 hover:bg-white/20 hover:text-white border-2 border-white/20'
                        }`}
                      >
                        📆 Dia Específico
                      </button>
                      <button
                        onClick={() => setFilterType('custom')}
                        className={`px-6 py-3 rounded-xl font-bold text-base transition-all transform ${
                          filterType === 'custom'
                            ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/40 scale-105'
                            : 'bg-white/10 text-white/60 hover:bg-white/20 hover:text-white border-2 border-white/20'
                        }`}
                      >
                        📊 Período Personalizado
                      </button>
                    </div>
                  </div>

                  {/* Opções de Filtro */}
                  {filterType === 'quick' && (
                    <div className="bg-blue-500/10 border-2 border-blue-500/30 rounded-xl p-4">
                      <label className="block text-blue-200 font-bold mb-3">Selecione o período:</label>
                      <select
                        value={analyticsPeriod}
                        onChange={(e) => setAnalyticsPeriod(e.target.value)}
                        className="w-full px-6 py-4 bg-dark-700 border-2 border-blue-500/30 rounded-xl text-white text-lg font-medium cursor-pointer hover:bg-dark-600 transition-colors focus:border-blue-500 focus:ring-4 focus:ring-blue-500/30"
                        style={{
                          WebkitAppearance: 'none',
                          MozAppearance: 'none',
                          appearance: 'none',
                          paddingRight: '2.5rem',
                          backgroundPosition: 'right 0.5rem center',
                          backgroundRepeat: 'no-repeat',
                          backgroundSize: '1.5em 1.5em',
                          backgroundImage: 'url("data:image/svg+xml,%3csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3e%3cpath stroke=\'%23fff\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4 4 4-4\'/%3e%3c/svg%3e")'
                        }}
                      >
                        <option value="1" className="bg-dark-700 text-white">📅 Hoje</option>
                        <option value="7" className="bg-dark-700 text-white">📅 Últimos 7 dias</option>
                        <option value="30" className="bg-dark-700 text-white">📅 Últimos 30 dias</option>
                        <option value="90" className="bg-dark-700 text-white">📅 Últimos 90 dias</option>
                        <option value="180" className="bg-dark-700 text-white">📅 Últimos 6 meses</option>
                        <option value="365" className="bg-dark-700 text-white">📅 Último ano</option>
                      </select>
                    </div>
                  )}

                  {filterType === 'single' && (
                    <div className="bg-purple-500/10 border-2 border-purple-500/30 rounded-xl p-4">
                      <label className="block text-purple-200 font-bold mb-3">Selecione a data:</label>
                      <input
                        type="date"
                        value={singleDate}
                        onChange={(e) => setSingleDate(e.target.value)}
                        max={new Date().toISOString().split('T')[0]}
                        className="w-full px-6 py-4 bg-dark-700 border-2 border-purple-500/30 rounded-xl text-white text-lg font-medium cursor-pointer hover:bg-dark-600 transition-colors focus:border-purple-500 focus:ring-4 focus:ring-purple-500/30"
                        style={{
                          colorScheme: 'dark'
                        }}
                      />
                    </div>
                  )}

                  {filterType === 'custom' && (
                    <div className="bg-indigo-500/10 border-2 border-indigo-500/30 rounded-xl p-4">
                      <label className="block text-indigo-200 font-bold mb-4">Período Personalizado:</label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-indigo-200 text-sm font-medium">📅 Data Início:</label>
                          <input
                            type="date"
                            value={customStartDate}
                            onChange={(e) => setCustomStartDate(e.target.value)}
                            max={customEndDate || new Date().toISOString().split('T')[0]}
                            className="w-full px-6 py-4 bg-dark-700 border-2 border-indigo-500/30 rounded-xl text-white text-lg font-medium cursor-pointer hover:bg-dark-600 transition-colors focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/30"
                            style={{
                              colorScheme: 'dark'
                            }}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-indigo-200 text-sm font-medium">📅 Data Fim:</label>
                          <input
                            type="date"
                            value={customEndDate}
                            onChange={(e) => setCustomEndDate(e.target.value)}
                            min={customStartDate}
                            max={new Date().toISOString().split('T')[0]}
                            className="w-full px-6 py-4 bg-dark-700 border-2 border-indigo-500/30 rounded-xl text-white text-lg font-medium cursor-pointer hover:bg-dark-600 transition-colors focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/30"
                            style={{
                              colorScheme: 'dark'
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Info do período atual */}
                  {analytics && (
                    <div className="bg-green-500/10 border-2 border-green-500/30 rounded-xl p-4">
                      <div className="flex items-center gap-3 text-base text-green-200">
                        <span className="text-2xl">📊</span>
                        <div>
                          <p className="font-bold">Período Selecionado:</p>
                          <p className="text-sm text-green-200/80">
                            {new Date(analytics.start_date).toLocaleDateString('pt-BR')} até {new Date(analytics.end_date).toLocaleDateString('pt-BR')}
                            {' '}({analytics.period} {analytics.period === 1 ? 'dia' : 'dias'})
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

              {loadingAnalytics ? (
                <div className="bg-gradient-to-br from-white/10 to-white/5 border-2 border-white/20 rounded-xl p-20 text-center">
                  <div className="animate-spin rounded-full h-20 w-20 border-b-4 border-primary-500 mx-auto mb-6"></div>
                  <p className="text-white text-xl font-bold">Carregando estatísticas...</p>
                </div>
              ) : analytics ? (
                <>
                  {/* Cards de Estatísticas Principais */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Total de Mensagens */}
                    <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-2 border-blue-500/30 rounded-xl p-8 shadow-lg hover:scale-105 transition-transform">
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-blue-300 text-base font-bold">Total de Mensagens</p>
                        <div className="bg-blue-500/20 p-3 rounded-xl">
                          <span className="text-3xl">📨</span>
                        </div>
                      </div>
                      <p className="text-5xl font-black text-white mb-3">
                        {analytics.summary.total_messages.toLocaleString('pt-BR')}
                      </p>
                      <p className="text-blue-300/70 text-sm">
                        Últimos {analytics.period} {analytics.period === 1 ? 'dia' : 'dias'}
                      </p>
                    </div>

                    {/* Taxa de Envio */}
                    <div className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-2 border-green-500/30 rounded-xl p-8 shadow-lg hover:scale-105 transition-transform">
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-green-300 text-base font-bold">Taxa de Envio</p>
                        <div className="bg-green-500/20 p-3 rounded-xl">
                          <span className="text-3xl">✅</span>
                        </div>
                      </div>
                      <p className="text-5xl font-black text-white mb-3">
                        {analytics.summary.delivery_rate}%
                      </p>
                      <p className="text-green-300/70 text-sm">
                        {analytics.summary.sent || analytics.summary.delivered} enviadas
                      </p>
                    </div>

                    {/* Taxa de Leitura */}
                    <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-2 border-purple-500/30 rounded-xl p-8 shadow-lg hover:scale-105 transition-transform">
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-purple-300 text-base font-bold">Taxa de Leitura</p>
                        <div className="bg-purple-500/20 p-3 rounded-xl">
                          <span className="text-3xl">👁️</span>
                        </div>
                      </div>
                      <p className="text-5xl font-black text-white mb-3">
                        {analytics.summary.read_rate}%
                      </p>
                      <p className="text-purple-300/70 text-sm">
                        {analytics.summary.read} lidas
                      </p>
                    </div>

                    {/* Taxa de Falha */}
                    <div className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-2 border-red-500/30 rounded-xl p-8 shadow-lg hover:scale-105 transition-transform">
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-red-300 text-base font-bold">Taxa de Falha</p>
                        <div className="bg-red-500/20 p-3 rounded-xl">
                          <span className="text-3xl">❌</span>
                        </div>
                      </div>
                      <p className="text-5xl font-black text-white mb-3">
                        {analytics.summary.failure_rate}%
                      </p>
                      <p className="text-red-300/70 text-sm">
                        {analytics.summary.failed} falhadas
                      </p>
                    </div>
                  </div>

                  {/* Gráficos e Custos */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Mensagens por Dia */}
                    <div className="p-6 bg-white/5 border border-white/10 rounded-xl">
                      <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        📊 Mensagens por Dia (Últimos 7 dias)
                      </h3>
                      {analytics.charts.messages_by_day.length > 0 ? (
                        <div className="space-y-3">
                          {analytics.charts.messages_by_day.map((day: any, index: number) => (
                            <div key={index} className="flex items-center gap-3">
                              <div className="w-24 text-white/60 text-sm">
                                {new Date(day.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <div 
                                    className="h-6 bg-gradient-to-r from-primary-500 to-primary-600 rounded-lg"
                                    style={{ width: `${(parseInt(day.count) / analytics.charts.messages_by_day[0].count * 100)}%` }}
                                  ></div>
                                  <span className="text-white font-bold text-sm">{day.count}</span>
                                </div>
                                <div className="flex gap-2 text-xs">
                                  <span className="text-green-400">✓ {day.delivered_count}</span>
                                  <span className="text-red-400">✗ {day.failed_count}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-white/40 text-center py-8">Sem dados disponíveis</p>
                      )}
                    </div>

                    {/* Análise de Custos */}
                    <div className="p-6 bg-white/5 border border-white/10 rounded-xl">
                      <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        💰 Análise de Custos
                      </h3>
                      {parseFloat(analytics.costs.total) > 0 ? (
                        <div className="space-y-4">
                          {/* Resumo de Custos */}
                          <div className="grid grid-cols-1 gap-3">
                            <div className="p-4 bg-gradient-to-br from-green-500/10 to-green-600/10 border border-green-500/30 rounded-lg">
                              <p className="text-green-300 text-sm mb-1">💵 Custo Total ({analytics.period} dias)</p>
                              <p className="text-2xl font-bold text-white">
                                R$ {parseFloat(analytics.costs.total).toFixed(2)}
                              </p>
                              <p className="text-green-300/60 text-xs mt-1">
                                {analytics.summary.sent} mensagens enviadas
                              </p>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                                <p className="text-blue-300 text-xs mb-1">📅 Média/Dia</p>
                                <p className="text-lg font-bold text-white">
                                  R$ {parseFloat(analytics.costs.daily_average).toFixed(2)}
                                </p>
                              </div>

                              <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                                <p className="text-purple-300 text-xs mb-1">📊 Proj. Mensal</p>
                                <p className="text-lg font-bold text-white">
                                  R$ {parseFloat(analytics.costs.monthly_projection).toFixed(2)}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Custo por Tipo - Apenas tipos com mensagens */}
                          {analytics.costs.by_type && analytics.costs.by_type.some((t: any) => parseInt(t.count || 0) > 0) && (
                            <div className="pt-4 border-t border-white/10">
                              <p className="text-white/80 text-sm mb-3 font-bold">📋 Seu Gasto por Tipo:</p>
                              {analytics.costs.by_type.map((type: any, index: number) => {
                                const cost = parseFloat(type.total_cost || 0);
                                const count = parseInt(type.count || 0);
                                if (count === 0) return null;
                                
                                return (
                                  <div key={index} className="flex items-center justify-between p-3 bg-gradient-to-r from-white/5 to-white/10 rounded-lg mb-2 hover:bg-white/10 transition-all border border-white/10">
                                    <div className="flex items-center gap-3">
                                      <span className="text-2xl">
                                        {type.message_type === 'Utility' ? '🔧' : 
                                         type.message_type === 'Marketing' ? '📢' : 
                                         type.message_type === 'Authentication' ? '🔐' : '💬'}
                                      </span>
                                      <div>
                                        <p className="text-white font-medium text-sm">{type.message_type}</p>
                                        <p className="text-white/40 text-xs">{count} mensagens enviadas</p>
                                      </div>
                                    </div>
                                    <span className="text-white font-bold">R$ {cost.toFixed(2)}</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Tabela de Preços Oficial - TODOS os tipos */}
                          <div className="pt-4 border-t-2 border-primary-500/30">
                            <p className="text-white/80 text-sm mb-3 font-bold flex items-center gap-2">
                              <span>💵</span>
                              <span>Tabela de Preços (WhatsApp Business API - Brasil):</span>
                            </p>
                            <div className="grid grid-cols-1 gap-2">
                              {/* Utility */}
                              <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-500/10 to-blue-600/10 border border-blue-500/30 rounded-lg">
                                <div className="flex items-center gap-3">
                                  <span className="text-2xl">🔧</span>
                                  <div>
                                    <p className="text-white font-medium text-sm">Utility</p>
                                    <p className="text-white/40 text-xs">Notificações, confirmações</p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-white font-bold">R$ 0,034</p>
                                  <p className="text-white/40 text-xs">por conversa</p>
                                </div>
                              </div>

                              {/* Marketing */}
                              <div className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-500/10 to-purple-600/10 border border-purple-500/30 rounded-lg">
                                <div className="flex items-center gap-3">
                                  <span className="text-2xl">📢</span>
                                  <div>
                                    <p className="text-white font-medium text-sm">Marketing</p>
                                    <p className="text-white/40 text-xs">Promoções, ofertas</p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-white font-bold">R$ 0,3125</p>
                                  <p className="text-white/40 text-xs">por conversa</p>
                                </div>
                              </div>

                              {/* Authentication */}
                              <div className="flex items-center justify-between p-3 bg-gradient-to-r from-green-500/10 to-green-600/10 border border-green-500/30 rounded-lg">
                                <div className="flex items-center gap-3">
                                  <span className="text-2xl">🔐</span>
                                  <div>
                                    <p className="text-white font-medium text-sm">Authentication</p>
                                    <p className="text-white/40 text-xs">OTP, verificação</p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-white font-bold">R$ 0,034</p>
                                  <p className="text-white/40 text-xs">por conversa</p>
                                </div>
                              </div>

                              {/* Service */}
                              <div className="flex items-center justify-between p-3 bg-gradient-to-r from-gray-500/10 to-gray-600/10 border border-gray-500/30 rounded-lg">
                                <div className="flex items-center gap-3">
                                  <span className="text-2xl">💬</span>
                                  <div>
                                    <p className="text-white font-medium text-sm">Service</p>
                                    <p className="text-white/40 text-xs">Atendimento</p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-white font-bold">n/a</p>
                                  <p className="text-white/40 text-xs">não aplicável</p>
                                </div>
                              </div>
                            </div>

                            {/* Nota de rodapé */}
                            <div className="mt-3 pt-3 border-t border-white/10">
                              <p className="text-white/40 text-xs flex items-center gap-2">
                                <span>ℹ️</span>
                                <span>
                                  Custos calculados baseados na tabela oficial do WhatsApp Business API para Brasil
                                  {analytics.costs.currency && ` (${analytics.costs.currency})`}
                                </span>
                              </p>
                              <p className="text-white/30 text-xs italic mt-1">
                                * Valores convertidos de USD $0.0068 (Utility/Auth) e $0.0625 (Marketing) para BRL (cotação: $1 = R$5)
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <p className="text-5xl mb-3">💰</p>
                          <p className="text-white/60 mb-2">Sem custos registrados</p>
                          <p className="text-white/40 text-sm">
                            Envie mensagens para ver a análise de custos
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Distribuição por Horário e Top Contatos */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Distribuição por Horário */}
                    <div className="p-6 bg-white/5 border border-white/10 rounded-xl">
                      <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        ⏰ Distribuição por Horário (24h)
                      </h3>
                      {analytics.charts.messages_by_hour.length > 0 ? (
                        <div className="grid grid-cols-6 gap-2">
                          {Array.from({ length: 24 }, (_, hour) => {
                            const data = analytics.charts.messages_by_hour.find((h: any) => parseInt(h.hour) === hour);
                            const count = data ? parseInt(data.count) : 0;
                            const maxCount = Math.max(...analytics.charts.messages_by_hour.map((h: any) => parseInt(h.count)));
                            const height = maxCount > 0 ? (count / maxCount * 100) : 0;
                            
                            return (
                              <div key={hour} className="flex flex-col items-center">
                                <div className="h-20 w-full flex items-end">
                                  <div 
                                    className="w-full bg-primary-500 rounded-t-lg hover:bg-primary-400 transition-all"
                                    style={{ height: `${height}%` }}
                                    title={`${hour}h: ${count} mensagens`}
                                  ></div>
                                </div>
                                <p className="text-white/40 text-xs mt-1">{hour}h</p>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-white/40 text-center py-8">Sem dados das últimas 24h</p>
                      )}
                    </div>

                    {/* Top Contatos */}
                    <div className="p-6 bg-white/5 border border-white/10 rounded-xl">
                      <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        👥 Top 10 Contatos
                      </h3>
                      {analytics.top_contacts.length > 0 ? (
                        <div className="space-y-2">
                          {analytics.top_contacts.map((contact: any, index: number) => (
                            <div 
                              key={index}
                              className="flex items-center justify-between p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-all"
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-primary-400 font-bold">#{index + 1}</span>
                                <span className="text-white font-mono">{contact.phone_number}</span>
                              </div>
                              <span className="text-white/60 text-sm">
                                {contact.message_count} mensagens
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-white/40 text-center py-8">Nenhum contato encontrado</p>
                      )}
                    </div>
                  </div>

                  {/* Campanhas Ativas */}
                  {analytics.active_campaigns > 0 && (
                    <div className="p-6 bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border-2 border-yellow-500/30 rounded-xl">
                      <div className="flex items-center gap-3">
                        <span className="text-4xl">🚀</span>
                        <div>
                          <p className="text-yellow-300 font-bold text-lg">
                            {analytics.active_campaigns} Campanha{analytics.active_campaigns !== 1 ? 's' : ''} Ativa{analytics.active_campaigns !== 1 ? 's' : ''}
                          </p>
                          <p className="text-yellow-300/60 text-sm">
                            Mensagens sendo enviadas ou agendadas
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12">
                  <FaChartBar className="text-6xl text-white/20 mx-auto mb-4" />
                  <p className="text-white/60">Carregue uma conta para ver as estatísticas</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'proxy' && (
            <div className="space-y-8">
              {/* Título da Seção */}
              <div className="flex items-center gap-4 pb-6 border-b-2 border-white/10">
                <div className="bg-gradient-to-br from-teal-500 to-teal-600 p-4 rounded-xl shadow-lg">
                  <FaGlobe className="text-4xl text-white" />
                </div>
                <div>
                  <h2 className="text-4xl font-black text-white">
                    Configuração de Proxy
                  </h2>
                  <p className="text-lg text-white/60 mt-1">
                    Proteja sua conta com um proxy dedicado
                  </p>
                </div>
              </div>

              {/* Info Banner */}
              <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/5 border-2 border-blue-500/30 rounded-xl p-6 shadow-lg">
                <div className="flex items-start gap-4">
                  <div className="bg-blue-500/20 p-4 rounded-xl flex-shrink-0">
                    <FaShieldAlt className="text-4xl text-blue-300" />
                  </div>
                  <div>
                    <h3 className="text-blue-200 font-black text-xl mb-3">🔒 Proteja sua Conta</h3>
                    <p className="text-white/80 text-base leading-relaxed mb-3">
                      Configure um proxy dedicado para esta conta WhatsApp. Isso garante que todas as requisições da API usem um IP fixo e exclusivo, evitando banimentos por conflito de localização.
                    </p>
                    <p className="text-blue-200/70 text-sm bg-blue-500/10 p-3 rounded-lg">
                      ⚠️ <strong>Recomendado:</strong> Use proxy <strong>Socks5</strong> com IP do Brasil para melhor compatibilidade.
                    </p>
                  </div>
                </div>
              </div>

              {/* Status Indicator */}
              {proxyEnabled && proxyHost && (
                <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/5 border-2 border-green-500/30 rounded-xl p-6 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="bg-green-500/20 p-4 rounded-xl">
                        <FaCheckCircle className="text-4xl text-green-300" />
                      </div>
                      <div>
                        <p className="text-green-200 font-black text-2xl mb-1">Proxy Ativo</p>
                        <p className="text-green-200/70 text-base">
                          {proxyType.toUpperCase()} - {proxyHost}:{proxyPort}
                        </p>
                      </div>
                    </div>
                    <div className="w-4 h-4 bg-green-400 rounded-full animate-pulse shadow-lg shadow-green-400/50"></div>
                  </div>
                </div>
              )}

              {/* Form */}
              <div className="space-y-4">
                {/* Enable Proxy Toggle */}
                <div className="p-5 bg-white/5 border border-white/10 rounded-xl flex items-center justify-between">
                  <div>
                    <h3 className="text-white font-bold mb-1">Habilitar Proxy</h3>
                    <p className="text-white/60 text-sm">
                      Ativar uso de proxy para esta conta
                    </p>
                  </div>
                  <button
                    onClick={() => setProxyEnabled(!proxyEnabled)}
                    className={`relative w-14 h-7 rounded-full transition-colors ${
                      proxyEnabled ? 'bg-primary-500' : 'bg-gray-600'
                    }`}
                  >
                    <div
                      className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${
                        proxyEnabled ? 'translate-x-7' : ''
                      }`}
                    />
                  </button>
                </div>

                {/* Proxy Name */}
                <div>
                  <label className="block text-white/80 mb-2 font-medium">
                    <FaUser className="inline mr-2" />
                    Nome do Proxy
                  </label>
                  <input
                    type="text"
                    value={proxyName}
                    onChange={(e) => setProxyName(e.target.value)}
                    disabled={!proxyEnabled}
                    placeholder="Ex: Proxy Brasil 1, Proxy EUA, etc."
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 disabled:opacity-50 disabled:cursor-not-allowed focus:border-primary-500 focus:outline-none transition-colors"
                  />
                  <p className="text-white/40 text-xs mt-1">
                    Dê um nome para identificar este proxy facilmente
                  </p>
                </div>

                {/* Proxy Type */}
                <div>
                  <label className="block text-white/80 mb-2 font-medium">
                    Tipo de Proxy
                  </label>
                  <select
                    value={proxyType}
                    onChange={(e) => setProxyType(e.target.value as 'socks5' | 'http')}
                    disabled={!proxyEnabled}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white disabled:opacity-50 disabled:cursor-not-allowed focus:border-primary-500 focus:outline-none transition-colors"
                  >
                    <option value="socks5" className="bg-gray-800">Socks5 (Recomendado)</option>
                    <option value="http" className="bg-gray-800">HTTP/HTTPS</option>
                  </select>
                </div>

                {/* Host and Port */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-white/80 mb-2 font-medium">
                      Host / IP do Proxy
                    </label>
                    <input
                      type="text"
                      value={proxyHost}
                      onChange={(e) => setProxyHost(e.target.value)}
                      disabled={!proxyEnabled}
                      placeholder="Ex: 191.5.153.178"
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 disabled:opacity-50 disabled:cursor-not-allowed focus:border-primary-500 focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-white/80 mb-2 font-medium">
                      Porta
                    </label>
                    <input
                      type="number"
                      value={proxyPort}
                      onChange={(e) => setProxyPort(e.target.value)}
                      disabled={!proxyEnabled}
                      placeholder="1080"
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 disabled:opacity-50 disabled:cursor-not-allowed focus:border-primary-500 focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                {/* Username and Password (opcional) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-white/80 mb-2 font-medium">
                      Usuário (opcional)
                    </label>
                    <input
                      type="text"
                      value={proxyUsername}
                      onChange={(e) => setProxyUsername(e.target.value)}
                      disabled={!proxyEnabled}
                      placeholder="usuario"
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 disabled:opacity-50 disabled:cursor-not-allowed focus:border-primary-500 focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-white/80 mb-2 font-medium">
                      Senha (opcional)
                    </label>
                    <input
                      type="password"
                      value={proxyPassword}
                      onChange={(e) => setProxyPassword(e.target.value)}
                      disabled={!proxyEnabled}
                      placeholder="••••••••"
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 disabled:opacity-50 disabled:cursor-not-allowed focus:border-primary-500 focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleTestProxy}
                    disabled={!proxyEnabled || !proxyHost || !proxyPort || testingProxy}
                    className="flex-1 px-6 py-3 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50 text-blue-300 font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {testingProxy ? (
                      <>
                        <div className="w-4 h-4 border-2 border-blue-300 border-t-transparent rounded-full animate-spin"></div>
                        Testando...
                      </>
                    ) : (
                      <>
                        🧪 Testar Proxy
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleSaveProxy}
                    disabled={saving}
                    className="flex-1 px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {saving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Salvando...
                      </>
                    ) : (
                      <>
                        <FaSave />
                        Salvar Configuração
                      </>
                    )}
                  </button>
                </div>

                {/* Test Result */}
                {proxyTestResult && (
                  <div className={`p-5 rounded-xl border-2 ${
                    proxyTestResult.success 
                      ? 'bg-green-500/10 border-green-500/30' 
                      : 'bg-red-500/10 border-red-500/30'
                  }`}>
                    <h3 className={`font-bold mb-3 flex items-center gap-2 ${
                      proxyTestResult.success ? 'text-green-300' : 'text-red-300'
                    }`}>
                      {proxyTestResult.success ? '✅ Teste Bem-Sucedido!' : '❌ Teste Falhou'}
                    </h3>
                    
                    {proxyTestResult.success && proxyTestResult.tests && (
                      <div className="space-y-3">
                        {/* IP Info */}
                        {proxyTestResult.tests.ip_check && (
                          <div className="p-3 bg-white/5 rounded-lg">
                            <p className="text-white/60 text-sm mb-1">IP Detectado:</p>
                            <p className="text-white font-mono text-lg">{proxyTestResult.tests.ip_check.ip}</p>
                            {proxyTestResult.tests.ip_check.country && (
                              <p className="text-white/40 text-sm mt-1">
                                📍 {proxyTestResult.tests.ip_check.country} - {proxyTestResult.tests.ip_check.city}
                              </p>
                            )}
                          </div>
                        )}

                        {/* WhatsApp API Test */}
                        {proxyTestResult.tests.whatsapp_api && (
                          <div className="p-3 bg-white/5 rounded-lg">
                            <p className="text-green-300 text-sm flex items-center gap-2">
                              ✓ Conexão com API do WhatsApp funcionando
                            </p>
                          </div>
                        )}

                        {/* Latency */}
                        {proxyTestResult.tests.latency && (
                          <div className="p-3 bg-white/5 rounded-lg">
                            <p className="text-white/60 text-sm">
                              ⚡ Latência: <span className="text-white font-bold">{proxyTestResult.tests.latency}ms</span>
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {!proxyTestResult.success && (
                      <p className="text-red-200 text-sm">
                        {proxyTestResult.error || 'Erro ao conectar no proxy'}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Help Section */}
              <div className="p-5 bg-purple-500/10 border border-purple-500/30 rounded-xl">
                <h3 className="text-purple-300 font-bold mb-3 flex items-center gap-2">
                  💡 Dicas e Recomendações
                </h3>
                <ul className="space-y-2 text-white/60 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-purple-400 flex-shrink-0">•</span>
                    <span>Use proxies <strong>Socks5</strong> para melhor compatibilidade com a API do WhatsApp</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-400 flex-shrink-0">•</span>
                    <span>Prefira proxies com IP <strong>do Brasil</strong> para evitar problemas de geolocalização</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-400 flex-shrink-0">•</span>
                    <span>Cada conta WhatsApp deve ter seu <strong>próprio proxy exclusivo</strong></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-400 flex-shrink-0">•</span>
                    <span>Teste o proxy antes de salvar para garantir que está funcionando</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-400 flex-shrink-0">•</span>
                    <span>Com proxy ativo, <strong>TODAS</strong> as requisições desta conta passarão pelo proxy configurado</span>
                  </li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'webhooks' && (
            <div className="space-y-8">
              {/* Título da Seção */}
              <div className="flex items-center justify-between pb-6 border-b-2 border-white/10 flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <div className="bg-gradient-to-br from-green-500 to-green-600 p-4 rounded-xl shadow-lg">
                    <FaBell className="text-4xl text-white" />
                  </div>
                  <div>
                    <h2 className="text-4xl font-black text-white">
                      Configurações de Webhook
                    </h2>
                    <p className="text-lg text-white/60 mt-1">
                      Gerencie eventos e notificações em tempo real
                    </p>
                  </div>
                </div>
                
                <select
                  value={webhookPeriod}
                  onChange={(e) => setWebhookPeriod(e.target.value)}
                  className="px-6 py-3 bg-dark-700 border-2 border-white/20 text-white text-base font-bold rounded-xl focus:border-primary-500 focus:ring-4 focus:ring-primary-500/30 transition-all cursor-pointer hover:bg-dark-600"
                  style={{
                    backgroundImage: 'url("data:image/svg+xml,%3csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3e%3cpath stroke=\'%23fff\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4 4 4-4\'/%3e%3c/svg%3e")',
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 0.75rem center',
                    backgroundSize: '1.5em 1.5em',
                    paddingRight: '2.5rem',
                    appearance: 'none'
                  }}
                >
                  <option value="1h" className="bg-dark-700">⏰ Última 1 hora</option>
                  <option value="6h" className="bg-dark-700">⏰ Últimas 6 horas</option>
                  <option value="24h" className="bg-dark-700">⏰ Últimas 24 horas</option>
                  <option value="7d" className="bg-dark-700">📅 Últimos 7 dias</option>
                  <option value="30d" className="bg-dark-700">📅 Últimos 30 dias</option>
                </select>
              </div>

              {loadingWebhook ? (
                <div className="bg-gradient-to-br from-white/10 to-white/5 border-2 border-white/20 rounded-xl p-20 text-center">
                  <div className="animate-spin rounded-full h-20 w-20 border-b-4 border-primary-500 mx-auto mb-6"></div>
                  <p className="text-white text-xl font-bold">Carregando dados de webhook...</p>
                </div>
              ) : (
                <>
                  {webhookStatusCard && (
                    <div
                      className={`border-2 rounded-2xl p-6 flex flex-wrap items-center gap-6 ${
                        webhookStatusCard.isActive
                          ? 'bg-emerald-500/15 border-emerald-400/40'
                          : 'bg-red-500/15 border-red-400/40'
                      }`}
                    >
                      <div className="p-4 rounded-xl bg-white/10">
                        {webhookStatusCard.isActive ? (
                          <FaCheckCircle className="text-4xl text-emerald-300" />
                        ) : (
                          <FaTimesCircle className="text-4xl text-red-300" />
                        )}
                      </div>
                      <div className="flex-1 min-w-[220px]">
                        <p className="text-white/60 text-sm font-semibold">
                          Status do Webhook ({webhookPeriod === '7d' ? 'últimos 7 dias' : webhookPeriod === '30d' ? 'últimos 30 dias' : `últimas ${webhookPeriod}`})
                        </p>
                        <p className="text-2xl font-black text-white mt-1">
                          {webhookStatusCard.isActive ? '🟢 Ativo' : '🔴 Inativo'}
                        </p>
                        <p className="text-white/70 text-sm mt-2">
                          {webhookStatusCard.statusMessage}
                        </p>
                      </div>
                      <div className="flex flex-col gap-2 text-white/70 text-sm min-w-[220px]">
                        <div>
                          <span className="font-bold text-white">Último Sucesso:</span>{' '}
                          {webhookStatusCard.lastSuccess?.received_at
                            ? new Date(webhookStatusCard.lastSuccess.received_at).toLocaleString('pt-BR')
                            : 'Nunca'}
                        </div>
                        <div>
                          <span className="font-bold text-white">Último Evento:</span>{' '}
                          {webhookStatusCard.lastEvent?.received_at
                            ? new Date(webhookStatusCard.lastEvent.received_at).toLocaleString('pt-BR')
                            : 'Nunca'}
                        </div>
                        {webhookStatusCard.lastFailure?.received_at && (
                          <div className="text-red-200">
                            <span className="font-bold text-white">Última Falha:</span>{' '}
                            {new Date(webhookStatusCard.lastFailure.received_at).toLocaleString('pt-BR')}
                            {webhookStatusCard.lastError && (
                              <span className="block text-xs text-red-200/80 mt-1">
                                {webhookStatusCard.lastError}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Configuração do Webhook */}
                  <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/5 border-2 border-indigo-500/30 rounded-xl p-8 shadow-lg">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="bg-indigo-500/20 p-4 rounded-xl">
                        <FaCog className="text-4xl text-indigo-300" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold text-white mb-1">⚙️ Configuração</h3>
                        <p className="text-indigo-200/70 text-sm">URLs e tokens para integração</p>
                      </div>
                    </div>
                    
                    <div className="space-y-6">
                      <div className="bg-white/5 border-2 border-white/10 rounded-xl p-4">
                        <label className="block text-white font-bold text-lg mb-3 flex items-center gap-2">
                          <span className="text-2xl">🔗</span> URL do Webhook
                        </label>
                        <div className="flex gap-3">
                          <input
                            type="text"
                            value={webhookConfig?.webhook_url || 'Carregando...'}
                            readOnly
                            className="flex-1 px-6 py-4 bg-dark-700 text-white text-base font-mono rounded-xl border-2 border-indigo-500/30 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/30 transition-all"
                          />
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(webhookConfig?.webhook_url || '');
                              toast.success('✅ URL copiada!');
                            }}
                            className="px-8 py-4 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white text-base font-bold rounded-xl transition-all shadow-lg shadow-primary-500/30 hover:shadow-primary-500/50 transform hover:scale-105"
                          >
                            📋 Copiar
                          </button>
                        </div>
                      </div>

                      <div className="bg-white/5 border-2 border-white/10 rounded-xl p-4">
                        <label className="block text-white font-bold text-lg mb-3 flex items-center gap-2">
                          <span className="text-2xl">🔐</span> Token de Verificação
                        </label>
                        <div className="flex gap-3">
                          <input
                            type="text"
                            value={webhookConfig?.verify_token || 'Carregando...'}
                            readOnly
                            className="flex-1 px-6 py-4 bg-dark-700 text-white text-base font-mono rounded-xl border-2 border-indigo-500/30 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/30 transition-all"
                          />
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(webhookConfig?.verify_token || '');
                              toast.success('✅ Token copiado!');
                            }}
                            className="px-8 py-4 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white text-base font-bold rounded-xl transition-all shadow-lg shadow-primary-500/30 hover:shadow-primary-500/50 transform hover:scale-105"
                          >
                            📋 Copiar
                          </button>
                        </div>
                      </div>

                      {webhookConfig?.stats?.last_webhook_at && (
                        <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/5 border-2 border-green-500/30 rounded-xl p-5">
                          <div className="flex items-center gap-3">
                            <div className="bg-green-500/20 p-3 rounded-xl">
                              <span className="text-3xl">✅</span>
                            </div>
                            <div>
                              <p className="text-green-200 font-bold text-base">Último webhook recebido</p>
                              <p className="text-green-200/70 text-sm">
                                {new Date(webhookConfig.stats.last_webhook_at).toLocaleString('pt-BR')}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Estatísticas */}
                  {webhookStats && (
                    <div>
                      <div className="flex items-center gap-3 mb-6">
                        <div className="bg-blue-500/20 p-3 rounded-xl">
                          <FaChartBar className="text-3xl text-blue-300" />
                        </div>
                        <div>
                          <h3 className="text-2xl font-bold text-white">📊 Estatísticas</h3>
                          <p className="text-white/60 text-sm">Métricas de uso no período selecionado</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 border-2 border-blue-500/40 p-8 rounded-xl hover:scale-105 transition-transform shadow-lg shadow-blue-500/20">
                          <div className="text-blue-300 text-lg font-bold mb-3 flex items-center gap-2">
                            <span className="text-2xl">📡</span> Total de Webhooks
                          </div>
                          <div className="text-5xl font-black text-white">
                            {webhookStats.stats?.total_webhooks || 0}
                          </div>
                        </div>

                        <div className="bg-gradient-to-br from-green-500/20 to-green-600/20 border-2 border-green-500/40 p-8 rounded-xl hover:scale-105 transition-transform shadow-lg shadow-green-500/20">
                          <div className="text-green-300 text-lg font-bold mb-3 flex items-center gap-2">
                            <span className="text-2xl">✅</span> Bem-sucedidos
                          </div>
                          <div className="text-5xl font-black text-white">
                            {webhookStats.stats?.successful || 0}
                          </div>
                        </div>

                        <div className="bg-gradient-to-br from-red-500/20 to-red-600/20 border-2 border-red-500/40 p-8 rounded-xl hover:scale-105 transition-transform shadow-lg shadow-red-500/20">
                          <div className="text-red-300 text-lg font-bold mb-3 flex items-center gap-2">
                            <span className="text-2xl">❌</span> Falhas
                          </div>
                          <div className="text-5xl font-black text-white">
                            {webhookStats.stats?.failed || 0}
                          </div>
                        </div>

                        <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/20 border-2 border-purple-500/40 p-8 rounded-xl hover:scale-105 transition-transform shadow-lg shadow-purple-500/20">
                          <div className="text-purple-300 text-lg font-bold mb-3 flex items-center gap-2">
                            <span className="text-2xl">📊</span> Status Processados
                          </div>
                          <div className="text-5xl font-black text-white">
                            {webhookStats.stats?.total_statuses_processed || 0}
                          </div>
                        </div>

                        <div className="bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 border-2 border-yellow-500/40 p-8 rounded-xl hover:scale-105 transition-transform shadow-lg shadow-yellow-500/20">
                          <div className="text-yellow-300 text-lg font-bold mb-3 flex items-center gap-2">
                            <span className="text-2xl">💬</span> Mensagens Processadas
                          </div>
                          <div className="text-5xl font-black text-white">
                            {webhookStats.stats?.total_messages_processed || 0}
                          </div>
                        </div>

                        <div className="bg-gradient-to-br from-pink-500/20 to-pink-600/20 border-2 border-pink-500/40 p-8 rounded-xl hover:scale-105 transition-transform shadow-lg shadow-pink-500/20">
                          <div className="text-pink-300 text-lg font-bold mb-3 flex items-center gap-2">
                            <span className="text-2xl">👆</span> Cliques Detectados
                          </div>
                          <div className="text-5xl font-black text-white">
                            {webhookStats.stats?.total_clicks_detected || 0}
                          </div>
                        </div>

                        <div className="bg-gradient-to-br from-indigo-500/20 to-indigo-600/20 border-2 border-indigo-500/40 p-8 rounded-xl hover:scale-105 transition-transform shadow-lg shadow-indigo-500/20">
                          <div className="text-indigo-300 text-lg font-bold mb-3 flex items-center gap-2">
                            <span className="text-2xl">🔍</span> Verificações
                          </div>
                          <div className="text-5xl font-black text-white">
                            {webhookStats.stats?.verifications || 0}
                          </div>
                        </div>

                        <div className="bg-gradient-to-br from-teal-500/20 to-teal-600/20 border-2 border-teal-500/40 p-8 rounded-xl hover:scale-105 transition-transform shadow-lg shadow-teal-500/20">
                          <div className="text-teal-300 text-lg font-bold mb-3 flex items-center gap-2">
                            <span className="text-2xl">🔔</span> Notificações
                          </div>
                          <div className="text-5xl font-black text-white">
                            {webhookStats.stats?.notifications || 0}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Logs Recentes */}
                  <div className="bg-gradient-to-br from-slate-700/30 to-slate-800/20 border-2 border-slate-500/30 rounded-xl p-8 shadow-lg">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="bg-slate-500/20 p-4 rounded-xl">
                        <FaBell className="text-4xl text-slate-300" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold text-white mb-1">📝 Webhooks Recentes</h3>
                        <p className="text-slate-200/70 text-sm">Últimos eventos recebidos</p>
                      </div>
                    </div>

                    {webhookLogs.length === 0 ? (
                      <div className="text-center py-16 bg-white/5 rounded-xl border-2 border-dashed border-white/20">
                        <div className="bg-white/10 p-6 rounded-full inline-block mb-4">
                          <FaBell className="text-6xl text-white/30" />
                        </div>
                        <p className="text-white/60 text-xl font-bold">Nenhum webhook recebido ainda</p>
                        <p className="text-white/40 text-sm mt-2">Os eventos aparecerão aqui quando forem recebidos</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {webhookLogs.map((log: any) => (
                          <div
                            key={log.id}
                            className="bg-dark-700/50 border-2 border-white/10 p-6 rounded-xl hover:border-primary-500/40 hover:bg-dark-700/70 transition-all"
                          >
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-3">
                                <span className={`px-4 py-2 rounded-xl text-sm font-bold border-2 ${
                                  log.request_type === 'verification' 
                                    ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                                    : 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                                }`}>
                                  {log.request_type === 'verification' ? '🔍 Verificação' : '🔔 Notificação'}
                                </span>
                                <span className={`px-4 py-2 rounded-xl text-sm font-bold border-2 ${
                                  log.processing_status === 'success'
                                    ? 'bg-green-500/20 text-green-300 border-green-500/40'
                                    : 'bg-red-500/20 text-red-300 border-red-500/40'
                                }`}>
                                  {log.processing_status === 'success' ? '✅ Sucesso' : '❌ Falha'}
                                </span>
                              </div>
                              <span className="text-sm text-white/60 font-mono bg-white/5 px-4 py-2 rounded-lg border border-white/10">
                                {new Date(log.received_at).toLocaleString('pt-BR')}
                              </span>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                              <div className="bg-blue-500/10 border border-blue-500/30 p-4 rounded-lg">
                                <div className="text-blue-300 text-xs font-bold mb-1 flex items-center gap-1">
                                  <span>💬</span> Mensagens
                                </div>
                                <div className="text-white text-2xl font-black">{log.messages_processed || 0}</div>
                              </div>
                              <div className="bg-purple-500/10 border border-purple-500/30 p-4 rounded-lg">
                                <div className="text-purple-300 text-xs font-bold mb-1 flex items-center gap-1">
                                  <span>📊</span> Status
                                </div>
                                <div className="text-white text-2xl font-black">{log.statuses_processed || 0}</div>
                              </div>
                              <div className="bg-pink-500/10 border border-pink-500/30 p-4 rounded-lg">
                                <div className="text-pink-300 text-xs font-bold mb-1 flex items-center gap-1">
                                  <span>👆</span> Cliques
                                </div>
                                <div className="text-white text-2xl font-black">{log.clicks_detected || 0}</div>
                              </div>
                            </div>

                            {log.processing_error && (
                              <div className="mt-4 p-4 bg-gradient-to-r from-red-500/10 to-red-600/5 border-2 border-red-500/30 rounded-xl">
                                <div className="flex items-start gap-3">
                                  <span className="text-2xl">❌</span>
                                  <div>
                                    <p className="text-red-300 font-bold text-sm mb-1">Erro no Processamento</p>
                                    <p className="text-red-200/70 text-xs">{log.processing_error}</p>
                                  </div>
                                </div>
                              </div>
                            )}

                            <button
                              onClick={() => setShowLogsDetails(showLogsDetails === log.id ? null : log.id)}
                              className="mt-4 w-full px-4 py-3 bg-gradient-to-r from-primary-500/20 to-primary-600/10 hover:from-primary-500/30 hover:to-primary-600/20 border-2 border-primary-500/30 text-primary-300 font-bold rounded-xl transition-all text-sm"
                            >
                              {showLogsDetails === log.id ? '▼ Ocultar detalhes' : '▶ Ver detalhes'}
                            </button>

                            {showLogsDetails === log.id && (
                              <div className="mt-4 bg-dark-800/70 border-2 border-white/10 rounded-xl p-6">
                                <div className="flex items-center gap-2 mb-3">
                                  <span className="text-xl">📄</span>
                                  <h4 className="text-white font-bold text-sm">Dados da Requisição (JSON)</h4>
                                </div>
                                <pre className="text-white/80 overflow-auto max-h-96 bg-dark-900/50 p-4 rounded-lg border border-white/10 text-xs font-mono">
                                  {JSON.stringify(log.request_body, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Instruções */}
                  <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 p-6 rounded-xl border border-blue-500/20">
                    <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                      📘 Como configurar o Webhook no Facebook
                    </h3>
                    <ol className="space-y-2 text-sm text-white/70">
                      <li className="flex gap-2">
                        <span className="font-bold text-primary-400">1.</span>
                        <span>Acesse <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer" className="text-primary-400 hover:underline">Meta App Dashboard</a></span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-bold text-primary-400">2.</span>
                        <span>Selecione seu App &gt; WhatsApp &gt; Configuration</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-bold text-primary-400">3.</span>
                        <span>Na seção Webhooks, clique em "Edit" ou "Configure Webhook"</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-bold text-primary-400">4.</span>
                        <span>Cole a URL e o Token de Verificação acima</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-bold text-primary-400">5.</span>
                        <span>Clique em "Verify and Save"</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-bold text-primary-400">6.</span>
                        <span>Marque o campo "messages" e clique em "Subscribe"</span>
                      </li>
                    </ol>
                  </div>
                </>
              )}
            </div>
          )}


          {activeTab === 'financeiro' && (
            <div className="space-y-8">
              {/* Título da Seção */}
              <div className="flex items-center justify-between pb-6 border-b-2 border-white/10 flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-4 rounded-xl shadow-lg">
                    <FaDollarSign className="text-4xl text-white" />
                  </div>
                  <div>
                    <h2 className="text-4xl font-black text-white">
                      Informações Financeiras
                    </h2>
                    <p className="text-lg text-white/60 mt-1">
                      Custos e tarifas do WhatsApp Business API
                    </p>
                  </div>
                </div>
              </div>

              {/* Filtro de Período */}
              <div className="bg-gradient-to-br from-white/10 to-white/5 border-2 border-white/20 rounded-xl p-6 shadow-lg space-y-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-blue-500/20 p-3 rounded-xl">
                    <span className="text-2xl">📅</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Período de Análise</h3>
                    <p className="text-white/60 text-sm">Selecione o período para visualizar os custos</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <button
                    onClick={() => setBillingPeriod('today')}
                    className={`px-6 py-3 rounded-xl font-bold text-base transition-all transform hover:scale-105 ${
                      billingPeriod === 'today'
                        ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg shadow-green-500/50'
                        : 'bg-white/5 text-white/70 hover:bg-white/10 border-2 border-white/10'
                    }`}
                  >
                    📅 Hoje
                  </button>
                  <button
                    onClick={() => setBillingPeriod('7days')}
                    className={`px-6 py-3 rounded-xl font-bold text-base transition-all transform hover:scale-105 ${
                      billingPeriod === '7days'
                        ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/50'
                        : 'bg-white/5 text-white/70 hover:bg-white/10 border-2 border-white/10'
                    }`}
                  >
                    📊 7 Dias
                  </button>
                  <button
                    onClick={() => setBillingPeriod('30days')}
                    className={`px-6 py-3 rounded-xl font-bold text-base transition-all transform hover:scale-105 ${
                      billingPeriod === '30days'
                        ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/50'
                        : 'bg-white/5 text-white/70 hover:bg-white/10 border-2 border-white/10'
                    }`}
                  >
                    📊 30 Dias
                  </button>
                  <button
                    onClick={() => setBillingPeriod('custom')}
                    className={`px-6 py-3 rounded-xl font-bold text-base transition-all transform hover:scale-105 ${
                      billingPeriod === 'custom'
                        ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/50'
                        : 'bg-white/5 text-white/70 hover:bg-white/10 border-2 border-white/10'
                    }`}
                  >
                    🗓️ Personalizado
                  </button>
                </div>

                {/* Campos de data personalizada */}
                {billingPeriod === 'custom' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t-2 border-white/10">
                    <div>
                      <label className="block text-white/80 mb-2 font-medium text-sm">
                        📅 Data Inicial
                      </label>
                      <input
                        type="date"
                        value={billingStartDate}
                        onChange={(e) => setBillingStartDate(e.target.value)}
                        className="w-full px-4 py-3 bg-white/5 border-2 border-white/20 rounded-xl text-white focus:border-primary-500 focus:outline-none transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-white/80 mb-2 font-medium text-sm">
                        📅 Data Final
                      </label>
                      <input
                        type="date"
                        value={billingEndDate}
                        onChange={(e) => setBillingEndDate(e.target.value)}
                        className="w-full px-4 py-3 bg-white/5 border-2 border-white/20 rounded-xl text-white focus:border-primary-500 focus:outline-none transition-colors"
                      />
                    </div>
                  </div>
                )}

                {/* Informação do período selecionado */}
                {facebookBilling && facebookBilling.period && (
                  <div className="mt-4 pt-4 border-t-2 border-white/10">
                    <p className="text-white/70 text-sm text-center">
                      📊 Exibindo dados de <strong className="text-white">{new Date(facebookBilling.period.start).toLocaleDateString('pt-BR')}</strong> até <strong className="text-white">{new Date(facebookBilling.period.end).toLocaleDateString('pt-BR')}</strong>
                    </p>
                  </div>
                )}
              </div>

              {/* Sempre mostrar custos do WhatsApp primeiro */}
              {loadingBilling ? (
                <div className="bg-gradient-to-br from-white/10 to-white/5 border-2 border-white/20 rounded-xl p-20 text-center">
                  <div className="animate-spin rounded-full h-20 w-20 border-b-4 border-primary-500 mx-auto mb-6"></div>
                  <p className="text-white text-xl font-bold">Carregando custos do WhatsApp...</p>
                </div>
              ) : facebookBilling && facebookBilling.whatsappCosts && facebookBilling.whatsappCosts.total > 0 ? (
                <>
                  {/* Custo Total Hoje */}
                  <div className="bg-gradient-to-br from-green-500/20 to-emerald-600/20 border-2 border-green-500/40 p-10 rounded-xl shadow-2xl shadow-green-500/20">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="bg-green-500/30 p-3 rounded-xl">
                        <span className="text-4xl">💰</span>
                      </div>
                      <div>
                        <div className="text-green-300 text-xl font-bold">Custo Total</div>
                        <div className="text-green-200/60 text-sm">No período selecionado</div>
                      </div>
                    </div>
                    <div className="text-6xl font-black text-white mb-3">
                      R$ {facebookBilling.whatsappCosts.total.toFixed(2)}
                    </div>
                    <div className="text-base text-white/70 bg-white/10 px-4 py-2 rounded-lg inline-block">
                      📨 Mensagens enviadas via WhatsApp Business API
                    </div>
                  </div>

                  {/* Custos por Tipo de Mensagem */}
                  <div>
                    <div className="flex items-center gap-3 mb-6">
                      <div className="bg-purple-500/20 p-3 rounded-xl">
                        <span className="text-3xl">📊</span>
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold text-white">Custos por Categoria</h3>
                        <p className="text-white/60 text-sm">Distribuição dos gastos por tipo de mensagem</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 border-2 border-blue-500/40 p-8 rounded-xl hover:scale-105 transition-transform shadow-lg shadow-blue-500/20">
                        <div className="text-blue-300 text-lg font-bold mb-3 flex items-center gap-2">
                          <span className="text-3xl">📩</span> Utility
                        </div>
                        <div className="text-4xl font-black text-white mb-3">
                          R$ {facebookBilling.whatsappCosts.utility.toFixed(2)}
                        </div>
                        <div className="text-sm text-white/70 bg-white/10 px-3 py-1.5 rounded-lg inline-block mb-2">
                          📨 {facebookBilling.messages.utility} mensagens
                        </div>
                        <div className="text-xs text-white/50 mt-2 bg-blue-500/10 px-3 py-1 rounded">
                          💵 R$ 0,034 por mensagem
                        </div>
                      </div>

                      <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/20 border-2 border-purple-500/40 p-8 rounded-xl hover:scale-105 transition-transform shadow-lg shadow-purple-500/20">
                        <div className="text-purple-300 text-lg font-bold mb-3 flex items-center gap-2">
                          <span className="text-3xl">📢</span> Marketing
                        </div>
                        <div className="text-4xl font-black text-white mb-3">
                          R$ {facebookBilling.whatsappCosts.marketing.toFixed(2)}
                        </div>
                        <div className="text-sm text-white/70 bg-white/10 px-3 py-1.5 rounded-lg inline-block mb-2">
                          📨 {facebookBilling.messages.marketing} mensagens
                        </div>
                        <div className="text-xs text-white/50 mt-2 bg-purple-500/10 px-3 py-1 rounded">
                          💵 R$ 0,3125 por mensagem
                        </div>
                      </div>

                      <div className="bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 border-2 border-yellow-500/40 p-8 rounded-xl hover:scale-105 transition-transform shadow-lg shadow-yellow-500/20">
                        <div className="text-yellow-300 text-lg font-bold mb-3 flex items-center gap-2">
                          <span className="text-3xl">🔐</span> Authentication
                        </div>
                        <div className="text-4xl font-black text-white mb-3">
                          R$ {facebookBilling.whatsappCosts.authentication.toFixed(2)}
                        </div>
                        <div className="text-sm text-white/70 bg-white/10 px-3 py-1.5 rounded-lg inline-block mb-2">
                          🔑 Autenticações
                        </div>
                        <div className="text-xs text-white/50 mt-2 bg-yellow-500/10 px-3 py-1 rounded">
                          💵 R$ 0,034 por autenticação
                        </div>
                      </div>

                      <div className="bg-gradient-to-br from-pink-500/20 to-pink-600/20 border-2 border-pink-500/40 p-8 rounded-xl hover:scale-105 transition-transform shadow-lg shadow-pink-500/20">
                        <div className="text-pink-300 text-lg font-bold mb-3 flex items-center gap-2">
                          <span className="text-3xl">🛠️</span> Service
                        </div>
                        <div className="text-4xl font-black text-white mb-3">
                          R$ {facebookBilling.whatsappCosts.service.toFixed(2)}
                        </div>
                        <div className="text-sm text-white/70 bg-white/10 px-3 py-1.5 rounded-lg inline-block mb-2">
                          💬 Atendimentos
                        </div>
                        <div className="text-xs text-white/50 mt-2 bg-pink-500/10 px-3 py-1 rounded">
                          💵 R$ 0,034 por conversa
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Tabela de Preços */}
                  <div className="bg-gradient-to-br from-slate-700/30 to-slate-800/20 border-2 border-slate-500/30 rounded-xl p-8 shadow-lg">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="bg-slate-500/20 p-4 rounded-xl">
                        <span className="text-4xl">📋</span>
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold text-white mb-1">Tabela de Preços WhatsApp Business API</h3>
                        <p className="text-slate-200/70 text-sm">Valores oficiais para o Brasil</p>
                      </div>
                    </div>
                    
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b-2 border-white/20 bg-white/5">
                            <th className="text-left py-4 px-4 text-white font-bold text-base">Tipo de Mensagem</th>
                            <th className="text-right py-4 px-4 text-white font-bold text-base">Preço (USD)</th>
                            <th className="text-right py-4 px-4 text-white font-bold text-base">Preço (BRL)</th>
                            <th className="text-right py-4 px-4 text-white font-bold text-base">Descrição</th>
                          </tr>
                        </thead>
                        <tbody className="text-white">
                          <tr className="border-b border-white/10 hover:bg-white/5 transition">
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-2 text-base font-bold">
                                <span className="text-2xl">📩</span> Utility
                              </div>
                            </td>
                            <td className="text-right px-4 text-yellow-300 font-mono font-bold">$0.0068</td>
                            <td className="text-right px-4 text-green-300 text-lg font-black">R$ 0,034</td>
                            <td className="text-right px-4 text-white/70">Notificações, atualizações</td>
                          </tr>
                          <tr className="border-b border-white/10 hover:bg-white/5 transition">
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-2 text-base font-bold">
                                <span className="text-2xl">📢</span> Marketing
                              </div>
                            </td>
                            <td className="text-right px-4 text-yellow-300 font-mono font-bold">$0.0625</td>
                            <td className="text-right px-4 text-green-300 text-lg font-black">R$ 0,3125</td>
                            <td className="text-right px-4 text-white/70">Promoções, ofertas</td>
                          </tr>
                          <tr className="border-b border-white/10 hover:bg-white/5 transition">
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-2 text-base font-bold">
                                <span className="text-2xl">🔐</span> Authentication
                              </div>
                            </td>
                            <td className="text-right px-4 text-yellow-300 font-mono font-bold">$0.0068</td>
                            <td className="text-right px-4 text-green-300 text-lg font-black">R$ 0,034</td>
                            <td className="text-right px-4 text-white/70">Códigos OTP, verificação</td>
                          </tr>
                          <tr className="hover:bg-white/5 transition">
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-2 text-base font-bold">
                                <span className="text-2xl">🛠️</span> Service
                              </div>
                            </td>
                            <td className="text-right px-4 text-yellow-300 font-mono font-bold">$0.0068</td>
                            <td className="text-right px-4 text-green-300 text-lg font-black">R$ 0,034</td>
                            <td className="text-right px-4 text-white/70">Atendimento ao cliente</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    
                    <div className="mt-6 bg-blue-500/10 border-2 border-blue-500/30 rounded-xl p-4">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">ℹ️</span>
                        <div className="text-sm text-blue-200">
                          <p className="font-bold mb-1">Informações importantes:</p>
                          <p className="text-blue-200/70">
                            • Cotação: <span className="font-bold text-yellow-300">$1 USD = R$ 5,00</span><br/>
                            • Preços oficiais do WhatsApp Business API para o Brasil<br/>
                            • Valores podem variar de acordo com o volume
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-2 border-blue-500/30 rounded-xl p-12 text-center">
                  <div className="bg-blue-500/20 p-6 rounded-full inline-block mb-4">
                    <FaInfoCircle className="text-6xl text-blue-300" />
                  </div>
                  <p className="text-blue-200 font-bold text-xl mb-2">Nenhuma mensagem enviada hoje
                  </p>
                  <p className="text-white/70 text-base mt-4">
                    Os custos aparecerão automaticamente quando você enviar mensagens via:
                  </p>
                  <ul className="text-white/60 text-sm mt-4 space-y-2 bg-white/5 p-4 rounded-lg inline-block">
                    <li className="flex items-center gap-2">
                      <span className="text-green-400">✓</span> Campanhas programadas
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-green-400">✓</span> Templates do WhatsApp
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-green-400">✓</span> Envios imediatos
                    </li>
                  </ul>
                </div>
              )}

              {/* Seção OPCIONAL de integração Facebook - sempre no final */}
              {editingFacebookCredentials && (
                <div className="bg-gradient-to-br from-blue-600/10 to-indigo-600/5 border-2 border-blue-500/30 rounded-xl p-8 shadow-lg">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="bg-blue-500/20 p-4 rounded-xl">
                      <FaFacebook className="text-4xl text-blue-300" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-white mb-1">
                        Integração Facebook (Opcional)
                      </h3>
                      <p className="text-blue-200/70 text-sm">
                        Configure para acessar dados adicionais do Facebook Business
                      </p>
                    </div>
                  </div>
                  
                  <div className="bg-yellow-500/10 border-2 border-yellow-500/30 rounded-xl p-4 mb-6">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">💡</span>
                      <div className="text-sm text-yellow-200">
                        <p className="font-bold mb-1">Esta integração é opcional</p>
                        <p className="text-yellow-200/70">
                          Necessário apenas para visualizar dados de cobrança do Facebook Business Manager
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="bg-white/5 border-2 border-white/10 rounded-xl p-4">
                      <label className="block text-white font-bold text-base mb-3 flex items-center gap-2">
                        <span className="text-xl">🔑</span> Facebook Access Token
                      </label>
                      <input
                        type="text"
                        value={facebookToken}
                        onChange={(e) => setFacebookToken(e.target.value)}
                        className="w-full px-6 py-4 bg-dark-700 text-white text-base font-mono rounded-xl border-2 border-blue-500/30 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/30 transition-all"
                        placeholder="Cole seu token aqui"
                      />
                      {account.facebook_access_token && !facebookToken && (
                        <div className="mt-3 flex items-center gap-2 text-green-300 text-sm bg-green-500/10 px-3 py-2 rounded-lg">
                          <span className="text-lg">✓</span> Token configurado (mascarado por segurança)
                        </div>
                      )}
                    </div>

                    <div className="bg-white/5 border-2 border-white/10 rounded-xl p-4">
                      <label className="block text-white font-bold text-base mb-3 flex items-center gap-2">
                        <span className="text-xl">📊</span> Ad Account ID
                      </label>
                      <input
                        type="text"
                        value={facebookAdAccount}
                        onChange={(e) => setFacebookAdAccount(e.target.value)}
                        className="w-full px-6 py-4 bg-dark-700 text-white text-base font-mono rounded-xl border-2 border-blue-500/30 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/30 transition-all"
                        placeholder="act_XXXXXXXXXX"
                      />
                      {account.facebook_ad_account_id && (
                        <p className="text-sm text-white/60 mt-2 bg-white/5 px-3 py-1.5 rounded">
                          Atual: <span className="font-mono font-bold">{account.facebook_ad_account_id}</span>
                        </p>
                      )}
                    </div>

                    <div className="bg-white/5 border-2 border-white/10 rounded-xl p-4">
                      <label className="block text-white font-bold text-base mb-3 flex items-center gap-2">
                        <span className="text-xl">🏢</span> Business ID
                      </label>
                      <input
                        type="text"
                        value={facebookBusiness}
                        onChange={(e) => setFacebookBusiness(e.target.value)}
                        className="w-full px-6 py-4 bg-dark-700 text-white text-base font-mono rounded-xl border-2 border-blue-500/30 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/30 transition-all"
                        placeholder="Business Manager ID"
                      />
                      {account.facebook_business_id && (
                        <p className="text-sm text-white/60 mt-2 bg-white/5 px-3 py-1.5 rounded">
                          Atual: <span className="font-mono font-bold">{account.facebook_business_id}</span>
                        </p>
                      )}
                    </div>

                    <div className="flex gap-4">
                      <button
                        onClick={handleSaveFacebookIntegration}
                        disabled={saving || !facebookToken}
                        className="flex-1 px-8 py-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white text-base font-bold rounded-xl transition-all shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                      >
                        {saving ? '⏳ Salvando...' : account.facebook_access_token ? '💾 Atualizar Integração' : '💾 Salvar Integração'}
                      </button>
                      {editingFacebookCredentials && (
                        <button
                          onClick={() => {
                            setEditingFacebookCredentials(false);
                            setFacebookToken('');
                            setFacebookAdAccount('');
                            setFacebookBusiness('');
                          }}
                          className="px-8 py-4 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white text-base font-bold rounded-xl transition-all"
                        >
                          ✕ Cancelar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'templates' && (
            <div className="space-y-8">
              {/* Título da Seção */}
              <div className="flex items-center justify-between pb-6 border-b-2 border-white/10 flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-4 rounded-xl shadow-lg">
                    <FaFileAlt className="text-4xl text-white" />
                  </div>
                  <div>
                    <h2 className="text-4xl font-black text-white">
                      Templates da Conta
                    </h2>
                    <p className="text-lg text-white/60 mt-1">
                      Visualize todos os templates desta conta WhatsApp
                    </p>
                  </div>
                </div>
              </div>

              {/* Busca e Filtros */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative">
                  <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 text-xl" />
                  <input
                    type="text"
                    placeholder="Buscar template..."
                    value={templatesSearch}
                    onChange={(e) => setTemplatesSearch(e.target.value)}
                    className="w-full pl-14 pr-6 py-4 bg-dark-700/80 border-2 border-white/20 rounded-xl text-white placeholder-white/40 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/30 transition-all"
                  />
                </div>
                <select
                  value={templatesFilter}
                  onChange={(e) => setTemplatesFilter(e.target.value as any)}
                  className="px-6 py-4 bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-purple-500 focus:ring-4 focus:ring-purple-500/30 transition-all"
                >
                  <option value="all">Todos os Status</option>
                  <option value="APPROVED">✅ Aprovados</option>
                  <option value="PENDING">⏳ Pendentes</option>
                  <option value="REJECTED">❌ Rejeitados</option>
                </select>
              </div>

              {/* Loading */}
              {loadingTemplates && (
                <div className="flex justify-center items-center py-20">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-purple-500 mx-auto mb-4"></div>
                    <p className="text-white/60">Carregando templates...</p>
                  </div>
                </div>
              )}

              {/* Templates List */}
              {!loadingTemplates && templates.length > 0 && (
                <div className="space-y-4">
                  {templates
                    .filter(template => {
                      const matchSearch = template.name.toLowerCase().includes(templatesSearch.toLowerCase());
                      const matchFilter = templatesFilter === 'all' || template.status === templatesFilter;
                      return matchSearch && matchFilter;
                    })
                    .map((template, index) => (
                      <div
                        key={index}
                        className="bg-dark-800/60 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-6 shadow-xl hover:border-purple-500/50 transition-all"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-xl font-bold text-white">{template.name}</h3>
                              <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                                template.status === 'APPROVED' 
                                  ? 'bg-green-500/20 text-green-300 border border-green-500/40'
                                  : template.status === 'PENDING'
                                  ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40'
                                  : 'bg-red-500/20 text-red-300 border border-red-500/40'
                              }`}>
                                {template.status === 'APPROVED' && '✅ Aprovado'}
                                {template.status === 'PENDING' && '⏳ Pendente'}
                                {template.status === 'REJECTED' && '❌ Rejeitado'}
                              </span>
                              <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                                template.category === 'MARKETING'
                                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                                  : template.category === 'UTILITY'
                                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                                  : 'bg-gray-500/20 text-gray-300 border border-gray-500/40'
                              }`}>
                                {template.category}
                              </span>
                            </div>
                            <p className="text-white/60 text-sm mb-3">
                              <strong>Idioma:</strong> {template.language || 'pt_BR'}
                            </p>
                            {template.components && template.components.length > 0 && (
                              <div className="space-y-2">
                                {template.components.map((component: any, idx: number) => (
                                  <div key={idx} className="bg-white/5 rounded-lg p-3">
                                    <p className="text-xs text-white/40 mb-1 uppercase font-bold">
                                      {component.type}
                                    </p>
                                    {component.text && (
                                      <p className="text-white/80 text-sm whitespace-pre-wrap">
                                        {component.text}
                                      </p>
                                    )}
                                    {component.format && (
                                      <p className="text-white/60 text-sm mt-1">
                                        <strong>Formato:</strong> {component.format}
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {/* Empty State */}
              {!loadingTemplates && templates.length === 0 && (
                <div className="text-center py-20">
                  <FaFileAlt className="text-6xl text-white/20 mx-auto mb-4" />
                  <p className="text-xl text-white/60">Nenhum template encontrado</p>
                  <p className="text-white/40 mt-2">
                    Esta conta ainda não possui templates cadastrados.
                  </p>
                </div>
              )}

              {/* Filtered Empty State */}
              {!loadingTemplates && templates.length > 0 && 
                templates.filter(template => {
                  const matchSearch = template.name.toLowerCase().includes(templatesSearch.toLowerCase());
                  const matchFilter = templatesFilter === 'all' || template.status === templatesFilter;
                  return matchSearch && matchFilter;
                }).length === 0 && (
                <div className="text-center py-20">
                  <FaSearch className="text-6xl text-white/20 mx-auto mb-4" />
                  <p className="text-xl text-white/60">Nenhum template encontrado</p>
                  <p className="text-white/40 mt-2">
                    Tente ajustar seus filtros de busca.
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'avancado' && (
            <div className="space-y-8">
              {/* Título da Seção */}
              <div className="flex items-center gap-4 pb-6 border-b-2 border-white/10">
                <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 p-4 rounded-xl shadow-lg">
                  <FaCog className="text-4xl text-white" />
                </div>
                <div>
                  <h2 className="text-4xl font-black text-white">
                    Configurações Avançadas
                  </h2>
                  <p className="text-lg text-white/60 mt-1">
                    Ferramentas e diagnósticos da conta
                  </p>
                </div>
              </div>

              {/* QR Code */}
              <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/5 border-2 border-indigo-500/30 rounded-xl p-8 shadow-lg">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                    <FaQrcode className="text-3xl text-indigo-300" /> 
                    QR Code da Conta
                  </h3>
                </div>
                
                {qrCode && qrCode.qr_image_url ? (
                  <div className="flex justify-center mb-6">
                    <div className="bg-white p-6 rounded-2xl shadow-2xl">
                      <img 
                        src={qrCode.qr_image_url} 
                        alt="QR Code" 
                        className="w-80 h-80"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-center mb-6">
                    <div className="bg-indigo-500/10 border-2 border-indigo-500/30 rounded-2xl p-20">
                      <FaQrcode className="text-9xl text-indigo-300/30" />
                    </div>
                  </div>
                )}

                <button
                  onClick={handleGenerateQRCode}
                  className="w-full px-8 py-5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-xl rounded-xl font-bold transition-all shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 transform hover:scale-105 flex items-center justify-center gap-3"
                >
                  <FaQrcode className="text-2xl" /> Gerar QR Code
                </button>
                <p className="text-indigo-200/70 text-sm mt-4 text-center">
                  Gere um QR Code para compartilhar o link direto da sua conta WhatsApp
                </p>
              </div>

              {/* Health Check */}
              <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/5 border-2 border-green-500/30 rounded-xl p-8 shadow-lg">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                    <FaHeartbeat className="text-3xl text-green-300" /> 
                    Health Check
                  </h3>
                </div>

                {healthCheck ? (
                  <div className="space-y-4 mb-6">
                    <div className={`p-6 rounded-xl border-2 ${
                      healthCheck.status === 'healthy' 
                        ? 'bg-green-500/10 border-green-500/30' 
                        : 'bg-red-500/10 border-red-500/30'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`p-4 rounded-xl ${
                            healthCheck.status === 'healthy' 
                              ? 'bg-green-500/20' 
                              : 'bg-red-500/20'
                          }`}>
                            {healthCheck.status === 'healthy' ? (
                              <FaCheckCircle className="text-4xl text-green-300" />
                            ) : (
                              <FaShieldAlt className="text-4xl text-red-300" />
                            )}
                          </div>
                          <div>
                            <p className="text-2xl font-black text-white mb-1">
                              {healthCheck.status === 'healthy' ? 'Conta Saudável' : 'Conta com Problemas'}
                            </p>
                            <p className={`text-sm ${
                              healthCheck.status === 'healthy' 
                                ? 'text-green-200/70' 
                                : 'text-red-200/70'
                            }`}>
                              {healthCheck.status === 'healthy' 
                                ? 'Todos os sistemas estão funcionando normalmente' 
                                : 'Verifique as configurações da sua conta'
                              }
                            </p>
                          </div>
                        </div>
                        <span className={`w-4 h-4 rounded-full ${
                          healthCheck.status === 'healthy' 
                            ? 'bg-green-400 animate-pulse shadow-lg shadow-green-400/50' 
                            : 'bg-red-400'
                        }`}></span>
                      </div>
                    </div>
                    
                    {healthCheck.quality_rating && (
                      <div className="bg-white/5 border-2 border-white/10 rounded-xl p-6">
                        <p className="text-white/60 text-sm mb-2">Quality Rating</p>
                        <p className="text-3xl font-black text-white">{healthCheck.quality_rating}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-green-500/10 border-2 border-green-500/30 rounded-xl p-12 mb-6 text-center">
                    <FaHeartbeat className="text-7xl text-green-300/30 mx-auto mb-4" />
                    <p className="text-green-200/70">Clique no botão abaixo para verificar a saúde da conta</p>
                  </div>
                )}

                <button
                  onClick={handleHealthCheck}
                  className="w-full px-8 py-5 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white text-xl rounded-xl font-bold transition-all shadow-lg shadow-green-500/30 hover:shadow-green-500/50 transform hover:scale-105 flex items-center justify-center gap-3"
                >
                  <FaHeartbeat className="text-2xl" /> Verificar Saúde da Conta
                </button>
                <p className="text-green-200/70 text-sm mt-4 text-center">
                  Faça um diagnóstico completo do status e qualidade da sua conta WhatsApp
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 🎨 CSS PERSONALIZADO - GRID E ANIMAÇÕES */}
      <style jsx>{`
        .bg-grid-white {
          background-image: 
            linear-gradient(to right, rgba(255, 255, 255, 0.1) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.1) 1px, transparent 1px);
          background-size: 20px 20px;
        }
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}

