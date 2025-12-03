import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { FaCog, FaPlus, FaEdit, FaTrash, FaStar, FaRegStar, FaToggleOn, FaToggleOff, FaBuilding, FaServer, FaKey, FaCheckCircle, FaCopy, FaLink, FaEnvelope, FaPaperPlane, FaEnvelopeOpen } from 'react-icons/fa';
import AdminLayout from '@/components/admin/AdminLayout';
import api from '@/services/api';
import { useNotification } from '@/hooks/useNotification';
import { useConfirm } from '@/hooks/useConfirm';

interface UazapCredential {
  id: number;
  name: string;
  description: string | null;
  server_url: string;
  is_default: boolean;
  is_active: boolean;
  metadata: any;
  created_at: string;
  updated_at: string;
  tenants_using: number;
}

interface NovaVidaCredential {
  id: number;
  name: string;
  description: string | null;
  api_url: string;
  is_default: boolean;
  is_active: boolean;
  metadata: any;
  created_at: string;
  updated_at: string;
  tenants_using: number;
}

interface AsaasCredential {
  id: number;
  name: string;
  description: string | null;
  api_key: string;
  environment: 'production' | 'sandbox';
  is_default: boolean;
  is_active: boolean;
  metadata: any;
  created_at: string;
  updated_at: string;
  tenants_using: number;
}

interface EmailConfig {
  provider: 'hostinger' | 'gmail' | 'none';
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_user: string;
  smtp_pass?: string;
  email_from: string;
  is_configured: boolean;
  last_test?: string;
  last_test_success?: boolean;
}

export default function AdminCredentials() {
  const notification = useNotification();
  const { confirm, ConfirmDialog } = useConfirm();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'uazap' | 'novavida' | 'asaas' | 'email'>('uazap');
  const [uazapCredentials, setUazapCredentials] = useState<UazapCredential[]>([]);
  const [novaVidaCredentials, setNovaVidaCredentials] = useState<NovaVidaCredential[]>([]);
  const [asaasCredentials, setAsaasCredentials] = useState<AsaasCredential[]>([]);
  const [emailConfig, setEmailConfig] = useState<EmailConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [testingEmail, setTestingEmail] = useState(false);

  const [uazapForm, setUazapForm] = useState({
    name: '',
    description: '',
    server_url: '',
    admin_token: '',
    is_default: false,
    metadata: {}
  });

  const [novaVidaForm, setNovaVidaForm] = useState({
    name: '',
    description: '',
    api_url: '',
    api_key: '',
    is_default: false,
    metadata: {}
  });

  const [asaasForm, setAsaasForm] = useState({
    name: '',
    description: '',
    api_key: '',
    environment: 'production' as 'production' | 'sandbox',
    is_default: false,
    metadata: {}
  });

  const [emailForm, setEmailForm] = useState({
    provider: 'hostinger' as 'hostinger' | 'gmail',
    smtp_host: 'smtp.hostinger.com',
    smtp_port: 587,
    smtp_secure: false,
    smtp_user: '',
    smtp_pass: '',
    email_from: '',
    test_email: ''
  });

  // Função para copiar texto
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    notification.success('Copiado!', `${label} copiado para a área de transferência`);
  };

  // Obter URL base da API
  const getApiBaseUrl = () => {
    return process.env.NEXT_PUBLIC_API_URL?.replace(/\/api$/, '') || 'http://localhost:3001';
  };

  // Obter webhooks URLs e tokens
  const getWebhookInfo = (type: 'uazap' | 'asaas' | 'whatsapp') => {
    const baseUrl = getApiBaseUrl();
    
    switch (type) {
      case 'uazap':
        return {
          url: `${baseUrl}/api/qr-webhook`,
          token: 'Não requer token (autenticação via credenciais UAZ)',
          instructions: [
            '1. Acesse o painel do UAZ API',
            '2. Vá em Configurações → Webhooks',
            '3. Cole a URL acima no campo "Webhook URL"',
            '4. Salve as configurações'
          ]
        };
      case 'asaas':
        return {
          url: `${baseUrl}/api/payments/webhook`,
          token: 'Não requer token (verificação via IP do Asaas)',
          instructions: [
            '1. Acesse o painel do Asaas',
            '2. Vá em Configurações → Integrações → Webhooks',
            '3. Cole a URL acima no campo "URL do Webhook"',
            '4. Marque os eventos: PAYMENT_RECEIVED, PAYMENT_CONFIRMED',
            '5. Salve as configurações'
          ]
        };
      case 'whatsapp':
        return {
          url: `${baseUrl}/api/webhook`,
          token: 'Token configurado nas credenciais da Meta',
          instructions: [
            '1. Acesse o Meta for Developers',
            '2. Selecione seu App → WhatsApp → Configuração',
            '3. Em "Webhooks", clique em "Editar"',
            '4. Cole a URL acima',
            '5. Digite o token de verificação',
            '6. Selecione os eventos necessários',
            '7. Clique em "Verificar e Salvar"'
          ]
        };
      default:
        return { url: '', token: '', instructions: [] };
    }
  };

  useEffect(() => {
    loadCredentials();
    
    // Se vier da URL com ?tab=email, abre a aba de email
    if (router.query.tab === 'email') {
      setActiveTab('email');
    }
  }, [router.query.tab]);

  const loadCredentials = async () => {
    try {
      setLoading(true);
      const [uazapRes, novaVidaRes, asaasRes, emailRes] = await Promise.all([
        api.get('/admin/credentials/uazap'),
        api.get('/admin/credentials/novavida'),
        api.get('/admin/credentials/asaas'),
        api.get('/admin/credentials/email').catch(() => ({ data: { data: null } }))
      ]);
      setUazapCredentials(uazapRes.data.data);
      setNovaVidaCredentials(novaVidaRes.data.data);
      setAsaasCredentials(asaasRes.data.data);
      setEmailConfig(emailRes.data.data);
      
      // Preencher form se já existe configuração
      if (emailRes.data.data) {
        setEmailForm({
          provider: emailRes.data.data.provider || 'hostinger',
          smtp_host: emailRes.data.data.smtp_host || '',
          smtp_port: emailRes.data.data.smtp_port || 587,
          smtp_secure: emailRes.data.data.smtp_secure || false,
          smtp_user: emailRes.data.data.smtp_user || '',
          smtp_pass: '',
          email_from: emailRes.data.data.email_from || '',
          test_email: ''
        });
      }
    } catch (error: any) {
      console.error('Erro ao carregar credenciais:', error);
      notification.error('Erro ao carregar credenciais', error.response?.data?.message || error.message);
    } finally {
      setLoading(false);
    }
  };

  // === UAZAP FUNCTIONS ===
  const handleCreateUazap = async () => {
    if (!uazapForm.name || !uazapForm.server_url || !uazapForm.admin_token) {
      notification.warning('Campos obrigatórios', 'Preencha todos os campos obrigatórios!');
      return;
    }

    try {
      await api.post('/admin/credentials/uazap', uazapForm);
      notification.success('Credencial UAZAP criada!', `A credencial "${uazapForm.name}" foi criada com sucesso.`);
      setIsCreating(false);
      resetUazapForm();
      loadCredentials();
    } catch (error: any) {
      notification.error('Erro ao criar credencial', error.response?.data?.message || error.message);
    }
  };

  const handleUpdateUazap = async () => {
    if (!editingId) return;

    try {
      await api.put(`/admin/credentials/uazap/${editingId}`, uazapForm);
      notification.success('Credencial atualizada!', `A credencial "${uazapForm.name}" foi atualizada com sucesso.`);
      setIsEditing(false);
      setEditingId(null);
      resetUazapForm();
      loadCredentials();
    } catch (error: any) {
      notification.error('Erro ao atualizar credencial', error.response?.data?.message || error.message);
    }
  };

  const handleDeleteUazap = async (id: number, name: string) => {
    const confirmed = await confirm({
      title: 'Excluir Credencial UAZAP',
      message: `Deseja realmente excluir a credencial "${name}"?`,
      confirmText: 'Sim, Excluir',
      type: 'danger',
    });

    if (!confirmed) return;

    try {
      await api.delete(`/admin/credentials/uazap/${id}`);
      notification.success('Credencial excluída!', `A credencial "${name}" foi excluída com sucesso.`);
      loadCredentials();
    } catch (error: any) {
      notification.error('Erro ao excluir credencial', error.response?.data?.message || error.message);
    }
  };

  const handleSetDefaultUazap = async (id: number) => {
    try {
      await api.patch(`/admin/credentials/uazap/${id}/set-default`);
      notification.success('Credencial padrão definida!', 'Esta credencial agora é a padrão para novos tenants.');
      loadCredentials();
    } catch (error: any) {
      notification.error('Erro ao definir como padrão', error.response?.data?.message || error.message);
    }
  };

  const handleEditUazap = (credential: UazapCredential) => {
    setUazapForm({
      name: credential.name,
      description: credential.description || '',
      server_url: credential.server_url,
      admin_token: '', // Não exibir token por segurança
      is_default: credential.is_default,
      metadata: credential.metadata || {}
    });
    setEditingId(credential.id);
    setIsEditing(true);
  };

  // === NOVA VIDA FUNCTIONS ===
  const handleCreateNovaVida = async () => {
    if (!novaVidaForm.name || !novaVidaForm.api_url || !novaVidaForm.api_key) {
      notification.warning('Campos obrigatórios', 'Preencha todos os campos obrigatórios!');
      return;
    }

    try {
      await api.post('/admin/credentials/novavida', novaVidaForm);
      notification.success('Credencial Nova Vida criada!', `A credencial "${novaVidaForm.name}" foi criada com sucesso.`);
      setIsCreating(false);
      resetNovaVidaForm();
      loadCredentials();
    } catch (error: any) {
      notification.error('Erro ao criar credencial', error.response?.data?.message || error.message);
    }
  };

  const handleUpdateNovaVida = async () => {
    if (!editingId) return;

    try {
      await api.put(`/admin/credentials/novavida/${editingId}`, novaVidaForm);
      notification.success('Credencial atualizada!', `A credencial "${novaVidaForm.name}" foi atualizada com sucesso.`);
      setIsEditing(false);
      setEditingId(null);
      resetNovaVidaForm();
      loadCredentials();
    } catch (error: any) {
      notification.error('Erro ao atualizar credencial', error.response?.data?.message || error.message);
    }
  };

  const handleDeleteNovaVida = async (id: number, name: string) => {
    const confirmed = await confirm({
      title: 'Excluir Credencial Nova Vida',
      message: `Deseja realmente excluir a credencial "${name}"?`,
      confirmText: 'Sim, Excluir',
      type: 'danger',
    });

    if (!confirmed) return;

    try {
      await api.delete(`/admin/credentials/novavida/${id}`);
      notification.success('Credencial excluída!', `A credencial "${name}" foi excluída com sucesso.`);
      loadCredentials();
    } catch (error: any) {
      notification.error('Erro ao excluir credencial', error.response?.data?.message || error.message);
    }
  };

  const handleSetDefaultNovaVida = async (id: number) => {
    try {
      await api.patch(`/admin/credentials/novavida/${id}/set-default`);
      notification.success('Credencial padrão definida!', 'Esta credencial agora é a padrão para novos tenants.');
      loadCredentials();
    } catch (error: any) {
      notification.error('Erro ao definir como padrão', error.response?.data?.message || error.message);
    }
  };

  const handleEditNovaVida = (credential: NovaVidaCredential) => {
    setNovaVidaForm({
      name: credential.name,
      description: credential.description || '',
      api_url: credential.api_url,
      api_key: '', // Não exibir chave por segurança
      is_default: credential.is_default,
      metadata: credential.metadata || {}
    });
    setEditingId(credential.id);
    setIsEditing(true);
  };

  const resetUazapForm = () => {
    setUazapForm({
      name: '',
      description: '',
      server_url: '',
      admin_token: '',
      is_default: false,
      metadata: {}
    });
  };

  const resetNovaVidaForm = () => {
    setNovaVidaForm({
      name: '',
      description: '',
      api_url: '',
      api_key: '',
      is_default: false,
      metadata: {}
    });
  };

  // === ASAAS FUNCTIONS ===
  const handleCreateAsaas = async () => {
    if (!asaasForm.name || !asaasForm.api_key) {
      notification.warning('Campos obrigatórios', 'Preencha todos os campos obrigatórios!');
      return;
    }

    try {
      await api.post('/admin/credentials/asaas', asaasForm);
      notification.success('Credencial Asaas criada!', `A credencial "${asaasForm.name}" foi criada com sucesso.`);
      setIsCreating(false);
      resetAsaasForm();
      loadCredentials();
    } catch (error: any) {
      notification.error('Erro ao criar credencial', error.response?.data?.message || error.message);
    }
  };

  const handleUpdateAsaas = async () => {
    if (!editingId) return;
    if (!asaasForm.name) {
      notification.warning('Campos obrigatórios', 'Preencha todos os campos obrigatórios!');
      return;
    }

    try {
      await api.put(`/admin/credentials/asaas/${editingId}`, asaasForm);
      notification.success('Credencial atualizada!', 'As alterações foram salvas com sucesso.');
      setIsEditing(false);
      setEditingId(null);
      resetAsaasForm();
      loadCredentials();
    } catch (error: any) {
      notification.error('Erro ao atualizar credencial', error.response?.data?.message || error.message);
    }
  };

  const handleDeleteAsaas = async (id: number, name: string) => {
    const confirmed = await confirm({
      title: 'Confirmar exclusão',
      message: `Tem certeza que deseja excluir a credencial "${name}"?`,
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
      type: 'danger',
    });

    if (!confirmed) return;

    try {
      await api.delete(`/admin/credentials/asaas/${id}`);
      notification.success('Credencial excluída!', `A credencial "${name}" foi excluída com sucesso.`);
      loadCredentials();
    } catch (error: any) {
      notification.error('Erro ao excluir credencial', error.response?.data?.message || error.message);
    }
  };

  const handleSetAsaasAsDefault = async (id: number, name: string) => {
    try {
      await api.patch(`/admin/credentials/asaas/${id}/set-default`);
      notification.success('Credencial padrão definida!', 'Esta credencial agora é a padrão para novos tenants.');
      loadCredentials();
    } catch (error: any) {
      notification.error('Erro ao definir como padrão', error.response?.data?.message || error.message);
    }
  };

  const handleEditAsaas = (credential: AsaasCredential) => {
    setAsaasForm({
      name: credential.name,
      description: credential.description || '',
      api_key: '', // Não exibir chave por segurança
      environment: credential.environment,
      is_default: credential.is_default,
      metadata: credential.metadata || {}
    });
    setEditingId(credential.id);
    setIsEditing(true);
  };

  const resetAsaasForm = () => {
    setAsaasForm({
      name: '',
      description: '',
      api_key: '',
      environment: 'production',
      is_default: false,
      metadata: {}
    });
  };

  // === EMAIL FUNCTIONS ===
  const handleSaveEmail = async () => {
    if (!emailForm.smtp_user || !emailForm.email_from) {
      notification.warning('Campos obrigatórios', 'Preencha o usuário e email de envio!');
      return;
    }

    try {
      await api.post('/admin/credentials/email', emailForm);
      notification.success('Configuração salva!', 'As configurações de email foram salvas com sucesso.');
      loadCredentials();
    } catch (error: any) {
      notification.error('Erro ao salvar configuração', error.response?.data?.message || error.message);
    }
  };

  const handleTestEmail = async () => {
    if (!emailForm.test_email) {
      notification.warning('Email necessário', 'Digite um email para teste!');
      return;
    }

    try {
      setTestingEmail(true);
      await api.post('/admin/credentials/email/test', {
        test_email: emailForm.test_email
      });
      notification.success('Email enviado!', `Email de teste enviado para ${emailForm.test_email}`);
    } catch (error: any) {
      notification.error('Erro ao enviar email', error.response?.data?.message || error.message);
    } finally {
      setTestingEmail(false);
    }
  };

  const handleProviderChange = (provider: 'hostinger' | 'gmail') => {
    if (provider === 'hostinger') {
      setEmailForm({
        ...emailForm,
        provider: 'hostinger',
        smtp_host: 'smtp.hostinger.com',
        smtp_port: 587,
        smtp_secure: false
      });
    } else if (provider === 'gmail') {
      setEmailForm({
        ...emailForm,
        provider: 'gmail',
        smtp_host: 'smtp.gmail.com',
        smtp_port: 587,
        smtp_secure: false
      });
    }
  };

  if (loading) {
    return (
      <>
        <notification.NotificationContainer />
        <ConfirmDialog />
        <AdminLayout
          title="Gerenciamento de Credenciais"
          subtitle="Gerencie credenciais UAZAP e Nova Vida"
          icon={<FaCog className="text-3xl text-white" />}
          currentPage="credentials"
        >
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-purple-500 mx-auto"></div>
              <p className="text-white mt-4">Carregando credenciais...</p>
            </div>
          </div>
        </AdminLayout>
      </>
    );
  }

  return (
    <>
      <notification.NotificationContainer />
      <ConfirmDialog />
      <AdminLayout
      title="Gerenciamento de Credenciais"
      subtitle="Gerencie credenciais UAZAP, Nova Vida e Asaas"
      icon={<FaCog className="text-3xl text-white" />}
      currentPage="credentials"
    >
      <div>
        {/* Tabs */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setActiveTab('uazap')}
            className={`flex-1 py-4 px-6 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'uazap'
                ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg scale-105'
                : 'bg-white/10 text-gray-300 hover:bg-white/20'
            }`}
          >
            <FaServer /> UAZAP ({uazapCredentials.length})
          </button>
          <button
            onClick={() => setActiveTab('novavida')}
            className={`flex-1 py-4 px-6 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'novavida'
                ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg scale-105'
                : 'bg-white/10 text-gray-300 hover:bg-white/20'
            }`}
          >
            <FaKey /> Nova Vida ({novaVidaCredentials.length})
          </button>
          <button
            onClick={() => setActiveTab('asaas')}
            className={`flex-1 py-4 px-6 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'asaas'
                ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg scale-105'
                : 'bg-white/10 text-gray-300 hover:bg-white/20'
            }`}
          >
            <FaCheckCircle /> Asaas ({asaasCredentials.length})
          </button>
          <button
            onClick={() => setActiveTab('email')}
            className={`flex-1 py-4 px-6 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'email'
                ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg scale-105'
                : 'bg-white/10 text-gray-300 hover:bg-white/20'
            }`}
          >
            <FaEnvelope /> Email {emailConfig?.is_configured && '✅'}
          </button>
        </div>

        {/* Botão Criar */}
        {activeTab !== 'email' && (
          <div className="mb-6 flex justify-end">
            <button
              onClick={() => {
                setIsCreating(true);
                setIsEditing(false);
                setEditingId(null);
                if (activeTab === 'uazap') resetUazapForm();
                else if (activeTab === 'novavida') resetNovaVidaForm();
                else resetAsaasForm();
              }}
              className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-xl font-bold transition-all flex items-center gap-2 shadow-lg"
            >
              <FaPlus /> Adicionar {activeTab === 'uazap' ? 'UAZAP' : activeTab === 'novavida' ? 'Nova Vida' : 'Asaas'}
            </button>
          </div>
        )}

        {/* UAZAP Content */}
        {activeTab === 'uazap' && (
          <div className="space-y-4">
            {uazapCredentials.length === 0 ? (
              <div className="bg-gray-800/50 rounded-xl p-8 text-center">
                <p className="text-gray-400">Nenhuma credencial UAZAP cadastrada</p>
              </div>
            ) : (
              uazapCredentials.map((cred) => (
                <div
                  key={cred.id}
                  className={`bg-gradient-to-br from-white/10 to-white/5 rounded-2xl p-6 border-2 ${
                    cred.is_default ? 'border-yellow-500 shadow-lg shadow-yellow-500/20' : 'border-white/20'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-black text-white">{cred.name}</h3>
                        {cred.is_default && (
                          <span className="px-3 py-1 bg-yellow-500 text-yellow-900 rounded-full text-xs font-bold flex items-center gap-1">
                            <FaStar /> PADRÃO
                          </span>
                        )}
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          cred.is_active ? 'bg-green-500 text-green-900' : 'bg-red-500 text-red-900'
                        }`}>
                          {cred.is_active ? '✅ Ativa' : '❌ Inativa'}
                        </span>
                      </div>
                      {cred.description && (
                        <p className="text-gray-400 text-sm mb-3">{cred.description}</p>
                      )}
                      <div className="space-y-2">
                        <p className="text-gray-300 text-sm flex items-center gap-2">
                          <FaServer className="text-purple-400" />
                          <strong>URL:</strong> {cred.server_url}
                        </p>
                        <p className="text-gray-300 text-sm flex items-center gap-2">
                          <FaBuilding className="text-blue-400" />
                          <strong>Tenants usando:</strong> {cred.tenants_using}
                        </p>
                        <p className="text-gray-500 text-xs">
                          Criado em: {new Date(cred.created_at).toLocaleString('pt-BR')}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-4">
                    {!cred.is_default && (
                      <button
                        onClick={() => handleSetDefaultUazap(cred.id)}
                        className="px-4 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border-2 border-yellow-500/40 rounded-lg font-bold transition-all flex items-center gap-2"
                      >
                        <FaStar /> Tornar Padrão
                      </button>
                    )}
                    <button
                      onClick={() => handleEditUazap(cred)}
                      className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border-2 border-blue-500/40 rounded-lg font-bold transition-all flex items-center gap-2"
                    >
                      <FaEdit /> Editar
                    </button>
                    <button
                      onClick={() => handleDeleteUazap(cred.id, cred.name)}
                      className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 border-2 border-red-500/40 rounded-lg font-bold transition-all flex items-center gap-2"
                      disabled={cred.tenants_using > 0}
                    >
                      <FaTrash /> Excluir
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Nova Vida Content */}
        {activeTab === 'novavida' && (
          <div className="space-y-4">
            {novaVidaCredentials.length === 0 ? (
              <div className="bg-gray-800/50 rounded-xl p-8 text-center">
                <p className="text-gray-400">Nenhuma credencial Nova Vida cadastrada</p>
              </div>
            ) : (
              novaVidaCredentials.map((cred) => (
                <div
                  key={cred.id}
                  className={`bg-gradient-to-br from-white/10 to-white/5 rounded-2xl p-6 border-2 ${
                    cred.is_default ? 'border-yellow-500 shadow-lg shadow-yellow-500/20' : 'border-white/20'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-black text-white">{cred.name}</h3>
                        {cred.is_default && (
                          <span className="px-3 py-1 bg-yellow-500 text-yellow-900 rounded-full text-xs font-bold flex items-center gap-1">
                            <FaStar /> PADRÃO
                          </span>
                        )}
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          cred.is_active ? 'bg-green-500 text-green-900' : 'bg-red-500 text-red-900'
                        }`}>
                          {cred.is_active ? '✅ Ativa' : '❌ Inativa'}
                        </span>
                      </div>
                      {cred.description && (
                        <p className="text-gray-400 text-sm mb-3">{cred.description}</p>
                      )}
                      <div className="space-y-2">
                        <p className="text-gray-300 text-sm flex items-center gap-2">
                          <FaKey className="text-blue-400" />
                          <strong>URL:</strong> {cred.api_url}
                        </p>
                        <p className="text-gray-300 text-sm flex items-center gap-2">
                          <FaBuilding className="text-purple-400" />
                          <strong>Tenants usando:</strong> {cred.tenants_using}
                        </p>
                        <p className="text-gray-500 text-xs">
                          Criado em: {new Date(cred.created_at).toLocaleString('pt-BR')}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-4">
                    {!cred.is_default && (
                      <button
                        onClick={() => handleSetDefaultNovaVida(cred.id)}
                        className="px-4 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border-2 border-yellow-500/40 rounded-lg font-bold transition-all flex items-center gap-2"
                      >
                        <FaStar /> Tornar Padrão
                      </button>
                    )}
                    <button
                      onClick={() => handleEditNovaVida(cred)}
                      className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border-2 border-blue-500/40 rounded-lg font-bold transition-all flex items-center gap-2"
                    >
                      <FaEdit /> Editar
                    </button>
                    <button
                      onClick={() => handleDeleteNovaVida(cred.id, cred.name)}
                      className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 border-2 border-red-500/40 rounded-lg font-bold transition-all flex items-center gap-2"
                      disabled={cred.tenants_using > 0}
                    >
                      <FaTrash /> Excluir
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Asaas Content */}
        {activeTab === 'asaas' && (
          <div className="space-y-4">
            {asaasCredentials.length === 0 ? (
              <div className="bg-gray-800/50 rounded-xl p-8 text-center">
                <p className="text-gray-400">Nenhuma credencial Asaas cadastrada</p>
              </div>
            ) : (
              asaasCredentials.map((cred) => (
                <div
                  key={cred.id}
                  className={`bg-gradient-to-br from-white/10 to-white/5 rounded-2xl p-6 border-2 ${
                    cred.is_default ? 'border-yellow-500 shadow-lg shadow-yellow-500/20' : 'border-white/20'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-black text-white">{cred.name}</h3>
                        {cred.is_default && (
                          <span className="px-3 py-1 bg-yellow-500 text-yellow-900 rounded-full text-xs font-bold flex items-center gap-1">
                            <FaStar /> PADRÃO
                          </span>
                        )}
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          cred.is_active ? 'bg-green-500 text-green-900' : 'bg-red-500 text-red-900'
                        }`}>
                          {cred.is_active ? '✅ Ativa' : '❌ Inativa'}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          cred.environment === 'production' ? 'bg-blue-500 text-blue-900' : 'bg-orange-500 text-orange-900'
                        }`}>
                          {cred.environment === 'production' ? '🔵 Produção' : '🟠 Sandbox'}
                        </span>
                      </div>
                      {cred.description && (
                        <p className="text-gray-400 text-sm mb-3">{cred.description}</p>
                      )}
                      <div className="space-y-2">
                        <p className="text-gray-300 text-sm flex items-center gap-2">
                          <FaKey className="text-green-400" />
                          <strong>API Key:</strong> {cred.api_key.substring(0, 20)}...
                        </p>
                        <p className="text-gray-300 text-sm flex items-center gap-2">
                          <FaBuilding className="text-purple-400" />
                          <strong>Tenants usando:</strong> {cred.tenants_using}
                        </p>
                        <p className="text-gray-500 text-xs">
                          Criado em: {new Date(cred.created_at).toLocaleString('pt-BR')}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-4">
                    {!cred.is_default && (
                      <button
                        onClick={() => handleSetAsaasAsDefault(cred.id, cred.name)}
                        className="px-4 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border-2 border-yellow-500/40 rounded-lg font-bold transition-all flex items-center gap-2"
                      >
                        <FaStar /> Tornar Padrão
                      </button>
                    )}
                    <button
                      onClick={() => handleEditAsaas(cred)}
                      className="px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-300 border-2 border-green-500/40 rounded-lg font-bold transition-all flex items-center gap-2"
                    >
                      <FaEdit /> Editar
                    </button>
                    <button
                      onClick={() => handleDeleteAsaas(cred.id, cred.name)}
                      className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 border-2 border-red-500/40 rounded-lg font-bold transition-all flex items-center gap-2"
                      disabled={cred.tenants_using > 0}
                    >
                      <FaTrash /> Excluir
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Modal Criar/Editar UAZAP */}
        {(isCreating || isEditing) && activeTab === 'uazap' && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 border-2 border-purple-500/50 rounded-2xl p-8 max-w-2xl w-full">
              <h2 className="text-2xl font-black text-white mb-6 flex items-center gap-3">
                <FaServer className="text-purple-400" />
                {isEditing ? 'Editar' : 'Criar'} Credencial UAZAP
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">Nome *</label>
                  <input
                    type="text"
                    value={uazapForm.name}
                    onChange={(e) => setUazapForm({ ...uazapForm, name: e.target.value })}
                    placeholder="Ex: UAZAP Principal"
                    className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">Descrição</label>
                  <input
                    type="text"
                    value={uazapForm.description}
                    onChange={(e) => setUazapForm({ ...uazapForm, description: e.target.value })}
                    placeholder="Descrição opcional"
                    className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">URL do Servidor *</label>
                  <input
                    type="text"
                    value={uazapForm.server_url}
                    onChange={(e) => setUazapForm({ ...uazapForm, server_url: e.target.value })}
                    placeholder="https://api.uazap.com"
                    className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">Admin Token *</label>
                  <input
                    type="password"
                    value={uazapForm.admin_token}
                    onChange={(e) => setUazapForm({ ...uazapForm, admin_token: e.target.value })}
                    placeholder={isEditing ? "Deixe em branco para manter o atual" : "Token de administrador"}
                    className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-purple-500 focus:outline-none"
                  />
                  {isEditing && (
                    <p className="text-xs text-gray-400 mt-1">Deixe vazio para manter o token atual</p>
                  )}
                </div>

                {/* WEBHOOK CONFIG - UAZAP */}
                <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-2 border-purple-500/30 rounded-xl p-6 space-y-4">
                  <h3 className="text-lg font-black text-white flex items-center gap-2">
                    <FaLink className="text-purple-400" />
                    ⚡ Configuração de Webhook
                  </h3>
                  
                  <p className="text-gray-400 text-sm">
                    Configure este webhook no painel do UAZ para receber notificações de eventos:
                  </p>

                  {/* URL */}
                  <div>
                    <label className="block text-sm font-bold text-purple-300 mb-2">📍 URL do Webhook</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={getWebhookInfo('uazap').url}
                        readOnly
                        className="flex-1 px-4 py-3 bg-black/40 border-2 border-purple-500/50 rounded-lg text-white font-mono text-sm cursor-text"
                      />
                      <button
                        onClick={() => copyToClipboard(getWebhookInfo('uazap').url, 'URL do Webhook')}
                        className="px-4 py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-bold transition-all flex items-center gap-2"
                        type="button"
                      >
                        <FaCopy /> Copiar
                      </button>
                    </div>
                  </div>

                  {/* Token */}
                  <div>
                    <label className="block text-sm font-bold text-purple-300 mb-2">🔑 Token de Autenticação</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={getWebhookInfo('uazap').token}
                        readOnly
                        className="flex-1 px-4 py-3 bg-black/40 border-2 border-purple-500/50 rounded-lg text-gray-400 font-mono text-sm italic cursor-not-allowed"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      ℹ️ O UAZ usa autenticação via credenciais próprias
                    </p>
                  </div>

                  {/* Instruções */}
                  <div className="bg-black/30 rounded-lg p-4">
                    <p className="text-white font-bold text-sm mb-2">📋 Instruções:</p>
                    <ol className="text-gray-300 text-sm space-y-1">
                      {getWebhookInfo('uazap').instructions.map((instruction, idx) => (
                        <li key={idx}>{instruction}</li>
                      ))}
                    </ol>
                  </div>
                </div>

                <div className="bg-yellow-500/10 border-2 border-yellow-500/30 rounded-lg p-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={uazapForm.is_default}
                      onChange={(e) => setUazapForm({ ...uazapForm, is_default: e.target.checked })}
                      className="w-5 h-5 rounded"
                    />
                    <div>
                      <span className="text-white font-bold">Definir como padrão</span>
                      <p className="text-gray-400 text-sm">Esta credencial será usada por padrão para novos tenants</p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={isEditing ? handleUpdateUazap : handleCreateUazap}
                  className="flex-1 py-3 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-lg font-bold transition-all"
                >
                  <FaCheckCircle className="inline mr-2" />
                  {isEditing ? 'Salvar' : 'Criar'}
                </button>
                <button
                  onClick={() => {
                    setIsCreating(false);
                    setIsEditing(false);
                    setEditingId(null);
                    resetUazapForm();
                  }}
                  className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-bold transition-all"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Criar/Editar Nova Vida */}
        {(isCreating || isEditing) && activeTab === 'novavida' && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 border-2 border-blue-500/50 rounded-2xl p-8 max-w-2xl w-full">
              <h2 className="text-2xl font-black text-white mb-6 flex items-center gap-3">
                <FaKey className="text-blue-400" />
                {isEditing ? 'Editar' : 'Criar'} Credencial Nova Vida
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">Nome *</label>
                  <input
                    type="text"
                    value={novaVidaForm.name}
                    onChange={(e) => setNovaVidaForm({ ...novaVidaForm, name: e.target.value })}
                    placeholder="Ex: Nova Vida Principal"
                    className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">Descrição</label>
                  <input
                    type="text"
                    value={novaVidaForm.description}
                    onChange={(e) => setNovaVidaForm({ ...novaVidaForm, description: e.target.value })}
                    placeholder="Descrição opcional"
                    className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">URL da API *</label>
                  <input
                    type="text"
                    value={novaVidaForm.api_url}
                    onChange={(e) => setNovaVidaForm({ ...novaVidaForm, api_url: e.target.value })}
                    placeholder="https://api.novavida.com"
                    className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">API Key *</label>
                  <input
                    type="password"
                    value={novaVidaForm.api_key}
                    onChange={(e) => setNovaVidaForm({ ...novaVidaForm, api_key: e.target.value })}
                    placeholder={isEditing ? "Deixe em branco para manter a atual" : "Chave da API"}
                    className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                  />
                  {isEditing && (
                    <p className="text-xs text-gray-400 mt-1">Deixe vazio para manter a chave atual</p>
                  )}
                </div>

                <div className="bg-yellow-500/10 border-2 border-yellow-500/30 rounded-lg p-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={novaVidaForm.is_default}
                      onChange={(e) => setNovaVidaForm({ ...novaVidaForm, is_default: e.target.checked })}
                      className="w-5 h-5 rounded"
                    />
                    <div>
                      <span className="text-white font-bold">Definir como padrão</span>
                      <p className="text-gray-400 text-sm">Esta credencial será usada por padrão para novos tenants</p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={isEditing ? handleUpdateNovaVida : handleCreateNovaVida}
                  className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-lg font-bold transition-all"
                >
                  <FaCheckCircle className="inline mr-2" />
                  {isEditing ? 'Salvar' : 'Criar'}
                </button>
                <button
                  onClick={() => {
                    setIsCreating(false);
                    setIsEditing(false);
                    setEditingId(null);
                    resetNovaVidaForm();
                  }}
                  className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-bold transition-all"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Criar/Editar Asaas */}
        {(isCreating || isEditing) && activeTab === 'asaas' && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 border-2 border-green-500/50 rounded-2xl p-8 max-w-2xl w-full">
              <h2 className="text-2xl font-black text-white mb-6 flex items-center gap-3">
                <FaCheckCircle className="text-green-400" />
                {isEditing ? 'Editar' : 'Criar'} Credencial Asaas
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">Nome *</label>
                  <input
                    type="text"
                    value={asaasForm.name}
                    onChange={(e) => setAsaasForm({ ...asaasForm, name: e.target.value })}
                    placeholder="Ex: Asaas Principal"
                    className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-green-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">Descrição</label>
                  <input
                    type="text"
                    value={asaasForm.description}
                    onChange={(e) => setAsaasForm({ ...asaasForm, description: e.target.value })}
                    placeholder="Descrição opcional"
                    className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-green-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">API Key *</label>
                  <input
                    type="password"
                    value={asaasForm.api_key}
                    onChange={(e) => setAsaasForm({ ...asaasForm, api_key: e.target.value })}
                    placeholder="$aact_YTU5YTE0M2M6N2Q0MDIzOGU5Nz..."
                    className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-green-500 focus:outline-none"
                  />
                  {isEditing && (
                    <p className="text-xs text-gray-500 mt-1">
                      💡 Deixe em branco para manter a chave atual
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">Ambiente *</label>
                  <select
                    value={asaasForm.environment}
                    onChange={(e) => setAsaasForm({ ...asaasForm, environment: e.target.value as 'production' | 'sandbox' })}
                    className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-green-500 focus:outline-none"
                  >
                    <option value="production">🔵 Produção</option>
                    <option value="sandbox">🟠 Sandbox (Testes)</option>
                  </select>
                </div>

                {/* WEBHOOK CONFIG - ASAAS */}
                <div className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-2 border-green-500/30 rounded-xl p-6 space-y-4">
                  <h3 className="text-lg font-black text-white flex items-center gap-2">
                    <FaLink className="text-green-400" />
                    ⚡ Configuração de Webhook
                  </h3>
                  
                  <p className="text-gray-400 text-sm">
                    Configure este webhook no painel do Asaas para receber notificações de pagamentos:
                  </p>

                  {/* URL */}
                  <div>
                    <label className="block text-sm font-bold text-green-300 mb-2">📍 URL do Webhook</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={getWebhookInfo('asaas').url}
                        readOnly
                        className="flex-1 px-4 py-3 bg-black/40 border-2 border-green-500/50 rounded-lg text-white font-mono text-sm cursor-text"
                      />
                      <button
                        onClick={() => copyToClipboard(getWebhookInfo('asaas').url, 'URL do Webhook')}
                        className="px-4 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-bold transition-all flex items-center gap-2"
                        type="button"
                      >
                        <FaCopy /> Copiar
                      </button>
                    </div>
                  </div>

                  {/* Token */}
                  <div>
                    <label className="block text-sm font-bold text-green-300 mb-2">🔑 Token de Autenticação</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={getWebhookInfo('asaas').token}
                        readOnly
                        className="flex-1 px-4 py-3 bg-black/40 border-2 border-green-500/50 rounded-lg text-gray-400 font-mono text-sm italic cursor-not-allowed"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      ℹ️ O Asaas verifica webhooks através do IP de origem
                    </p>
                  </div>

                  {/* Instruções */}
                  <div className="bg-black/30 rounded-lg p-4">
                    <p className="text-white font-bold text-sm mb-2">📋 Instruções:</p>
                    <ol className="text-gray-300 text-sm space-y-1">
                      {getWebhookInfo('asaas').instructions.map((instruction, idx) => (
                        <li key={idx}>{instruction}</li>
                      ))}
                    </ol>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-4 bg-black/20 rounded-lg">
                  <input
                    type="checkbox"
                    id="asaas-default"
                    checked={asaasForm.is_default}
                    onChange={(e) => setAsaasForm({ ...asaasForm, is_default: e.target.checked })}
                    className="w-5 h-5"
                  />
                  <label htmlFor="asaas-default" className="text-sm text-gray-300">
                    ⭐ Definir como credencial padrão para novos tenants
                  </label>
                </div>
              </div>

              <div className="flex gap-4 mt-8">
                <button
                  onClick={isEditing ? handleUpdateAsaas : handleCreateAsaas}
                  className="flex-1 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-lg font-bold transition-all"
                >
                  <FaCheckCircle className="inline mr-2" />
                  {isEditing ? 'Salvar' : 'Criar'}
                </button>
                <button
                  onClick={() => {
                    setIsCreating(false);
                    setIsEditing(false);
                    setEditingId(null);
                    resetAsaasForm();
                  }}
                  className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-bold transition-all"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* EMAIL Content */}
        {activeTab === 'email' && (
          <div className="space-y-6">
            {/* Status Card */}
            <div className={`bg-gradient-to-br rounded-2xl p-6 border-2 ${
              emailConfig?.is_configured
                ? 'from-green-500/10 to-green-600/5 border-green-500/30'
                : 'from-orange-500/10 to-orange-600/5 border-orange-500/30'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-black text-white flex items-center gap-3">
                    <FaEnvelope className="text-orange-400" />
                    Configuração de Email
                  </h3>
                  <p className="text-gray-400 mt-2">
                    Configure o envio de emails para notificações de vencimento e bloqueio
                  </p>
                </div>
                <div className={`px-6 py-3 rounded-xl font-bold text-lg ${
                  emailConfig?.is_configured
                    ? 'bg-green-500 text-green-900'
                    : 'bg-orange-500 text-orange-900'
                }`}>
                  {emailConfig?.is_configured ? '✅ Configurado' : '⚠️ Não Configurado'}
                </div>
              </div>
            </div>

            {/* Botão para Templates */}
            <div className="flex justify-end">
              <button
                onClick={() => router.push('/admin/email-templates')}
                className="px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-xl font-bold transition-all flex items-center gap-2 shadow-lg"
              >
                <FaEnvelopeOpen /> Gerenciar Templates de Email
              </button>
            </div>

            {/* Provider Selection */}
            <div className="bg-gradient-to-br from-white/10 to-white/5 rounded-2xl p-6 border-2 border-white/20">
              <h4 className="text-xl font-black text-white mb-4 flex items-center gap-2">
                <FaServer className="text-orange-400" />
                Escolha o Provedor de Email
              </h4>
              
              <div className="grid grid-cols-2 gap-4">
                {/* Hostinger */}
                <button
                  onClick={() => handleProviderChange('hostinger')}
                  className={`p-6 rounded-xl border-2 transition-all ${
                    emailForm.provider === 'hostinger'
                      ? 'bg-orange-500/20 border-orange-500 shadow-lg shadow-orange-500/20'
                      : 'bg-white/5 border-white/20 hover:border-orange-500/50'
                  }`}
                >
                  <div className="text-center">
                    <div className="text-4xl mb-3">🌐</div>
                    <h5 className="text-lg font-bold text-white mb-2">Hostinger</h5>
                    <p className="text-sm text-gray-400">SMTP da Hostinger</p>
                    {emailForm.provider === 'hostinger' && (
                      <div className="mt-3 px-3 py-1 bg-orange-500 text-orange-900 rounded-full text-xs font-bold inline-block">
                        ✓ Selecionado
                      </div>
                    )}
                  </div>
                </button>

                {/* Gmail */}
                <button
                  onClick={() => handleProviderChange('gmail')}
                  className={`p-6 rounded-xl border-2 transition-all ${
                    emailForm.provider === 'gmail'
                      ? 'bg-red-500/20 border-red-500 shadow-lg shadow-red-500/20'
                      : 'bg-white/5 border-white/20 hover:border-red-500/50'
                  }`}
                >
                  <div className="text-center">
                    <div className="text-4xl mb-3">📧</div>
                    <h5 className="text-lg font-bold text-white mb-2">Gmail</h5>
                    <p className="text-sm text-gray-400">SMTP do Google</p>
                    {emailForm.provider === 'gmail' && (
                      <div className="mt-3 px-3 py-1 bg-red-500 text-red-900 rounded-full text-xs font-bold inline-block">
                        ✓ Selecionado
                      </div>
                    )}
                  </div>
                </button>
              </div>
            </div>

            {/* Configuration Form */}
            <div className="bg-gradient-to-br from-white/10 to-white/5 rounded-2xl p-6 border-2 border-white/20">
              <h4 className="text-xl font-black text-white mb-6 flex items-center gap-2">
                <FaCog className="text-orange-400" />
                Configurações SMTP
              </h4>

              <div className="space-y-4">
                {/* SMTP Host (readonly) */}
                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">
                    🌐 Servidor SMTP
                  </label>
                  <input
                    type="text"
                    value={emailForm.smtp_host}
                    readOnly
                    className="w-full px-4 py-3 bg-black/30 border-2 border-white/10 rounded-lg text-gray-400 cursor-not-allowed"
                  />
                </div>

                {/* SMTP Port (readonly) */}
                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">
                    🔌 Porta
                  </label>
                  <input
                    type="text"
                    value={emailForm.smtp_port}
                    readOnly
                    className="w-full px-4 py-3 bg-black/30 border-2 border-white/10 rounded-lg text-gray-400 cursor-not-allowed"
                  />
                </div>

                {/* SMTP User */}
                <div>
                  <label className="block text-sm font-bold text-orange-300 mb-2">
                    📧 Email / Usuário SMTP *
                  </label>
                  <input
                    type="email"
                    value={emailForm.smtp_user}
                    onChange={(e) => setEmailForm({ ...emailForm, smtp_user: e.target.value })}
                    placeholder={emailForm.provider === 'hostinger' ? 'contato@nettsistemas.com' : 'seu-email@gmail.com'}
                    className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-orange-500 focus:outline-none"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    {emailForm.provider === 'hostinger' 
                      ? 'Digite o email completo da Hostinger'
                      : 'Digite seu email do Gmail'}
                  </p>
                </div>

                {/* SMTP Password */}
                <div>
                  <label className="block text-sm font-bold text-orange-300 mb-2">
                    🔑 Senha {emailConfig?.is_configured && '(deixe vazio para manter a atual)'}
                  </label>
                  <input
                    type="password"
                    value={emailForm.smtp_pass}
                    onChange={(e) => setEmailForm({ ...emailForm, smtp_pass: e.target.value })}
                    placeholder={emailConfig?.is_configured ? 'Deixe vazio para manter' : 'Digite a senha'}
                    className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-orange-500 focus:outline-none"
                  />
                  {emailForm.provider === 'gmail' && (
                    <p className="text-xs text-yellow-400 mt-1">
                      ⚠️ Para Gmail, use uma "Senha de App" (não a senha normal)
                    </p>
                  )}
                </div>

                {/* Email From */}
                <div>
                  <label className="block text-sm font-bold text-orange-300 mb-2">
                    📤 Email de Envio (From) *
                  </label>
                  <input
                    type="email"
                    value={emailForm.email_from}
                    onChange={(e) => setEmailForm({ ...emailForm, email_from: e.target.value })}
                    placeholder="noreply@nettsistemas.com"
                    className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-orange-500 focus:outline-none"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Email que aparecerá como remetente
                  </p>
                </div>

                {/* Save Button */}
                <button
                  onClick={handleSaveEmail}
                  className="w-full py-4 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg"
                >
                  <FaCheckCircle /> Salvar Configurações
                </button>
              </div>
            </div>

            {/* Test Email */}
            {emailConfig?.is_configured && (
              <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 rounded-2xl p-6 border-2 border-blue-500/30">
                <h4 className="text-xl font-black text-white mb-4 flex items-center gap-2">
                  <FaPaperPlane className="text-blue-400" />
                  Testar Envio de Email
                </h4>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-blue-300 mb-2">
                      📧 Email para Teste
                    </label>
                    <input
                      type="email"
                      value={emailForm.test_email}
                      onChange={(e) => setEmailForm({ ...emailForm, test_email: e.target.value })}
                      placeholder="seu-email@gmail.com"
                      className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <button
                    onClick={handleTestEmail}
                    disabled={testingEmail}
                    className="w-full py-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {testingEmail ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        Enviando...
                      </>
                    ) : (
                      <>
                        <FaPaperPlane /> Enviar Email de Teste
                      </>
                    )}
                  </button>

                  {emailConfig.last_test && (
                    <div className={`p-4 rounded-lg ${
                      emailConfig.last_test_success
                        ? 'bg-green-500/20 border-2 border-green-500/50'
                        : 'bg-red-500/20 border-2 border-red-500/50'
                    }`}>
                      <p className={`text-sm font-bold ${
                        emailConfig.last_test_success ? 'text-green-300' : 'text-red-300'
                      }`}>
                        {emailConfig.last_test_success ? '✅ Último teste: Sucesso' : '❌ Último teste: Falhou'}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(emailConfig.last_test).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Info Box */}
            <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 rounded-2xl p-6 border-2 border-purple-500/30">
              <h4 className="text-lg font-black text-white mb-3 flex items-center gap-2">
                <FaCheckCircle className="text-purple-400" />
                📧 Emails Automáticos
              </h4>
              <div className="space-y-2 text-gray-300 text-sm">
                <p>✅ <strong>3 dias antes</strong> do vencimento</p>
                <p>✅ <strong>2 dias antes</strong> do vencimento</p>
                <p>✅ <strong>1 dia antes</strong> do vencimento</p>
                <p>✅ <strong>No bloqueio</strong> (quando o plano vence)</p>
                <p className="text-purple-300 mt-4">
                  ⏰ Os emails são enviados automaticamente a cada <strong>2 horas</strong>
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
    </>
  );
}
