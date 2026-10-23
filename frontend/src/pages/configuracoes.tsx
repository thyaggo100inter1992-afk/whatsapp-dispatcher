import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { 
  FaCog, FaPlus, FaEdit, FaTrash, FaCheckCircle, FaTimesCircle, 
  FaSpinner, FaFileAlt, FaWhatsapp, FaCheck, FaTimes, FaBan, FaArrowLeft,
  FaSquare, FaCheckSquare, FaArrowUp, FaArrowDown, FaSearch, FaFilter, FaSync, FaBell
} from 'react-icons/fa';
import api, { whatsappAccountsAPI } from '@/services/api';
import { useConfirm } from '@/hooks/useConfirm';

interface WhatsAppAccount {
  id: number;
  name: string;
  phone_number: string;
  access_token: string;
  phone_number_id: string;
  business_account_id?: string;
  app_id?: string;
  app_secret?: string;
  webhook_verify_token?: string;
  webhook_fields_subscribed?: string;
  is_active: boolean;
  proxy_id?: number | null;
}

/** Campos de webhook Meta — padrão = todos marcados */
const ALL_WHATSAPP_WEBHOOK_FIELDS = [
  'account_alerts',
  'account_review_update',
  'account_settings_update',
  'account_update',
  'automatic_events',
  'business_capability_update',
  'business_status_update',
  'business_username_update',
  'calls',
  'flows',
  'group_lifecycle_update',
  'group_participant_update',
  'group_settings_update',
  'group_status_update',
  'history',
  'message_echoes',
  'message_template_components_update',
  'message_template_quality_update',
  'message_template_status_update',
  'messages',
  'messaging_handovers',
  'partner_solutions',
  'payment_configuration_update',
  'phone_number_name_update',
  'phone_number_quality_update',
  'security',
  'smb_app_state_sync',
  'smb_message_echoes',
  'standby',
  'template_category_update',
  'template_correct_category_detection',
  'tracking_events',
  'user_preferences',
];

interface Proxy {
  id: number;
  name: string;
  host: string;
  port: number;
  location?: string;
  status: string;
}

export default function Configuracoes() {
  const router = useRouter();
  const { confirm, ConfirmDialog } = useConfirm();
  const [accounts, setAccounts] = useState<WhatsAppAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<WhatsAppAccount | null>(null);
  const [testingConnection, setTestingConnection] = useState<number | null>(null);
  const [proxies, setProxies] = useState<Proxy[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<Set<number>>(new Set());
  const [deactivating, setDeactivating] = useState(false);
  const [webhookStatuses, setWebhookStatuses] = useState<{[key: number]: {
    isActive: boolean;
    lastEventAt?: string;
  }}>({});
  
  // 🔄 CARREGAMENTO PROGRESSIVO / ATUALIZAÇÃO META
  const [accountsDetails, setAccountsDetails] = useState<{[key: number]: any}>({});
  const [loadingDetails, setLoadingDetails] = useState<{[key: number]: boolean}>({});
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [subscribingWebhookId, setSubscribingWebhookId] = useState<number | null>(null);
  const [subscribingAllWebhooks, setSubscribingAllWebhooks] = useState(false);
  const [bulkWebhookMode, setBulkWebhookMode] = useState<'waba' | 'fields' | null>(null);
  const [webhookFieldsStatus, setWebhookFieldsStatus] = useState<{[key: number]: any}>({});
  const [checkingWebhookFieldsId, setCheckingWebhookFieldsId] = useState<number | null>(null);
  const [resubscribingFieldsId, setResubscribingFieldsId] = useState<number | null>(null);
  
  // 🔍 BUSCA E FILTROS
  const [searchTerm, setSearchTerm] = useState('');
  const [filterWebhook, setFilterWebhook] = useState<'all' | 'active' | 'inactive'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'connected' | 'disconnected'>('all');
  const [filterQuality, setFilterQuality] = useState<'all' | 'GREEN' | 'YELLOW' | 'RED' | 'FLAGGED'>('all');

  const [formData, setFormData] = useState({
    name: '',
    phone_number: '',
    access_token: '',
    phone_number_id: '',
    business_account_id: '',
    app_id: '',
    app_secret: '',
    webhook_verify_token: '',
    is_active: true,
    proxy_id: null as number | null,
    subscribe_all_webhooks: true,
    webhook_fields: [...ALL_WHATSAPP_WEBHOOK_FIELDS] as string[],
  });
  const [showWebhookFields, setShowWebhookFields] = useState(false);

  useEffect(() => {
    loadAccounts();
    loadProxies();
  }, []);

  // Funções de seleção de contas
  const handleToggleSelectAccount = (accountId: number) => {
    const newSelected = new Set(selectedAccounts);
    if (newSelected.has(accountId)) {
      newSelected.delete(accountId);
    } else {
      newSelected.add(accountId);
    }
    setSelectedAccounts(newSelected);
  };

  const handleSelectAllAccounts = () => {
    if (selectedAccounts.size === accounts.length) {
      setSelectedAccounts(new Set());
    } else {
      setSelectedAccounts(new Set(accounts.map(a => a.id)));
    }
  };

  // Função para desativar contas selecionadas
  const handleDeactivateSelected = async () => {
    if (selectedAccounts.size === 0) {
      await confirm({
        title: '⚠️ Atenção',
        message: 'Nenhuma conta selecionada!',
        type: 'warning',
        confirmText: 'OK',
        showCancel: false
      });
      return;
    }

    const confirmed = await confirm({
      title: '⚠️ Desativar Contas',
      message: (
        <div>
          <p className="mb-4 text-lg font-bold">
            Tem certeza que deseja desativar {selectedAccounts.size} conta(s)?
          </p>
          <p className="text-orange-400 font-bold text-sm">
            As contas selecionadas serão desativadas e não poderão enviar mensagens.
          </p>
        </div>
      ),
      type: 'warning',
      confirmText: 'Sim, Desativar',
      cancelText: 'Cancelar'
    });

    if (!confirmed) return;

    setDeactivating(true);
    try {
      await api.post('/whatsapp-accounts/deactivate-multiple', {
        account_ids: Array.from(selectedAccounts)
      });

      await loadAccounts();
      setSelectedAccounts(new Set());

      await confirm({
        title: '✅ Sucesso!',
        message: `${selectedAccounts.size} conta(s) desativada(s) com sucesso!`,
        type: 'info',
        confirmText: 'OK',
        showCancel: false
      });
    } catch (error: any) {
      await confirm({
        title: '❌ Erro',
        message: 'Erro ao desativar contas: ' + (error.response?.data?.error || error.message),
        type: 'danger',
        confirmText: 'OK',
        showCancel: false
      });
    } finally {
      setDeactivating(false);
    }
  };

  // Função para desativar todas as contas
  const handleDeactivateAll = async () => {
    if (accounts.length === 0) {
      await confirm({
        title: '⚠️ Atenção',
        message: 'Nenhuma conta cadastrada!',
        type: 'warning',
        confirmText: 'OK',
        showCancel: false
      });
      return;
    }

    const confirmed = await confirm({
      title: '🚨 DESATIVAR TODAS AS CONTAS',
      message: (
        <div>
          <p className="mb-4 text-lg font-bold text-red-400">
            ⚠️ ATENÇÃO: Você está prestes a desativar TODAS as {accounts.length} contas!
          </p>
          <p className="text-orange-400 font-bold">
            Todas as contas serão desativadas e não poderão enviar mensagens.
          </p>
        </div>
      ),
      type: 'danger',
      confirmText: 'Sim, Desativar TODAS',
      cancelText: 'Cancelar'
    });

    if (!confirmed) return;

    setDeactivating(true);
    try {
      await api.post('/whatsapp-accounts/deactivate-all');

      await loadAccounts();
      setSelectedAccounts(new Set());

      await confirm({
        title: '✅ Sucesso!',
        message: `Todas as ${accounts.length} contas foram desativadas!`,
        type: 'info',
        confirmText: 'OK',
        showCancel: false
      });
    } catch (error: any) {
      await confirm({
        title: '❌ Erro',
        message: 'Erro ao desativar contas: ' + (error.response?.data?.error || error.message),
        type: 'danger',
        confirmText: 'OK',
        showCancel: false
      });
    } finally {
      setDeactivating(false);
    }
  };

  const handleActivateSelected = async () => {
    if (selectedAccounts.size === 0) {
      await confirm({
        title: '⚠️ Atenção',
        message: 'Nenhuma conta selecionada!',
        type: 'warning',
        confirmText: 'OK',
        showCancel: false
      });
      return;
    }

    const confirmed = await confirm({
      title: '✅ Ativar Contas',
      message: (
        <div>
          <p className="mb-2">Deseja ativar {selectedAccounts.size} conta(s) selecionada(s)?</p>
          <p className="text-sm text-gray-400">As contas voltarão a ficar disponíveis para uso.</p>
        </div>
      ),
      type: 'success',
      confirmText: 'Sim, Ativar',
      cancelText: 'Cancelar'
    });

    if (!confirmed) return;

    setDeactivating(true);
    try {
      await api.post('/whatsapp-accounts/activate-multiple', {
        account_ids: Array.from(selectedAccounts)
      });

      await confirm({
        title: '✅ Sucesso!',
        message: `${selectedAccounts.size} conta(s) ativada(s) com sucesso!`,
        type: 'info',
        confirmText: 'OK',
        showCancel: false
      });

      setSelectedAccounts(new Set());
      await loadAccounts();
    } catch (error: any) {
      console.error('❌ Erro ao ativar contas:', error);
      await confirm({
        title: '❌ Erro',
        message: `Erro ao ativar contas: ${error.response?.data?.error || error.message}`,
        type: 'error',
        confirmText: 'OK',
        showCancel: false
      });
    } finally {
      setDeactivating(false);
    }
  };

  const handleActivateAll = async () => {
    if (accounts.length === 0) {
      await confirm({
        title: '⚠️ Atenção',
        message: 'Nenhuma conta cadastrada!',
        type: 'warning',
        confirmText: 'OK',
        showCancel: false
      });
      return;
    }

    const confirmed = await confirm({
      title: '✅ ATIVAR TODAS AS CONTAS',
      message: (
        <div>
          <p className="mb-2">Deseja ativar TODAS as {accounts.length} conta(s)?</p>
          <p className="text-sm text-gray-400">Todas as contas voltarão a ficar disponíveis para uso.</p>
        </div>
      ),
      type: 'success',
      confirmText: 'Sim, Ativar Todas',
      cancelText: 'Cancelar'
    });

    if (!confirmed) return;

    setDeactivating(true);
    try {
      await api.post('/whatsapp-accounts/activate-all');
      
      await confirm({
        title: '✅ Sucesso!',
        message: 'Todas as contas foram ativadas com sucesso!',
        type: 'info',
        confirmText: 'OK',
        showCancel: false
      });

      setSelectedAccounts(new Set());
      await loadAccounts();
    } catch (error: any) {
      console.error('❌ Erro ao ativar contas:', error);
      await confirm({
        title: '❌ Erro',
        message: `Erro ao ativar contas: ${error.response?.data?.error || error.message}`,
        type: 'error',
        confirmText: 'OK',
        showCancel: false
      });
    } finally {
      setDeactivating(false);
    }
  };

  // 🔼🔽 Funções de reordenação
  const handleMoveUp = async (accountId: number) => {
    try {
      await api.post(`/whatsapp-accounts/${accountId}/move-up`);
      await loadAccounts(); // Recarregar lista
    } catch (error: any) {
      console.error('❌ Erro ao mover conta para cima:', error);
      await confirm({
        title: '❌ Erro',
        message: error.response?.data?.message || 'Erro ao reordenar conta',
        type: 'error',
        confirmText: 'OK',
        showCancel: false
      });
    }
  };

  const handleMoveDown = async (accountId: number) => {
    try {
      await api.post(`/whatsapp-accounts/${accountId}/move-down`);
      await loadAccounts(); // Recarregar lista
    } catch (error: any) {
      console.error('❌ Erro ao mover conta para baixo:', error);
      await confirm({
        title: '❌ Erro',
        message: error.response?.data?.message || 'Erro ao reordenar conta',
        type: 'error',
        confirmText: 'OK',
        showCancel: false
      });
    }
  };

  // 🔍 FILTRAR CONTAS
  const filteredAccounts = accounts.filter((account) => {
    // Contas banidas/sinalizadas/restritas não aparecem em lugar nenhum
    const metaStatus = String((account as any).account_status || '').toUpperCase();
    if (['BANNED', 'FLAGGED', 'RESTRICTED'].includes(metaStatus)) return false;

    // Busca por nome ou telefone
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const matchName = account.name.toLowerCase().includes(search);
      const matchPhone = account.phone_number.includes(searchTerm.replace(/\D/g, ''));
      if (!matchName && !matchPhone) return false;
    }
    
    // Filtro de Webhook
    if (filterWebhook !== 'all') {
      const isWebhookActive = webhookStatuses[account.id]?.isActive || false;
      if (filterWebhook === 'active' && !isWebhookActive) return false;
      if (filterWebhook === 'inactive' && isWebhookActive) return false;
    }
    
    // Filtro de Status (Conectada/Desconectada)
    // Considera "conectada" se a conta está ativa E tem quality_rating (conseguiu comunicar com API)
    if (filterStatus !== 'all') {
      const hasQualityRating = (account as any).quality_rating != null && (account as any).quality_rating !== undefined;
      const isConnected = account.is_active && hasQualityRating;
      if (filterStatus === 'connected' && !isConnected) return false;
      if (filterStatus === 'disconnected' && isConnected) return false;
    }
    
    // Filtro de Qualidade
    if (filterQuality !== 'all') {
      const quality = (account as any).quality_rating;
      if (quality !== filterQuality) return false;
    }
    
    return true;
  });

  const webhookInactiveCount = accounts.filter((account) => {
    const metaStatus = String((account as any).account_status || '').toUpperCase();
    if (['BANNED', 'FLAGGED', 'RESTRICTED'].includes(metaStatus)) return false;
    if (account.is_active === false) return false;
    return !(webhookStatuses[account.id]?.isActive);
  }).length;

  const loadProxies = async () => {
    try {
      const response = await api.get('/proxies/active');
      if (response.data.success) {
        setProxies(response.data.data);
      }
    } catch (error) {
      console.error('Erro ao carregar proxies:', error);
    }
  };

  const applyCachedDetails = (basicAccounts: any[]) => {
    const cached: {[key: number]: any} = {};
    for (const account of basicAccounts) {
      cached[account.id] = {
        whatsapp_profile_picture: account.profile_picture_url || account.whatsapp_profile_picture || null,
        whatsapp_display_name: account.whatsapp_display_name || account.name,
        quality_rating: account.quality_rating || null,
        from_cache: true,
      };
    }
    setAccountsDetails((prev) => ({ ...cached, ...prev }));
  };

  const loadWebhookStatusesBatch = async (basicAccounts: any[]) => {
    const webhookStatusMap: {[key: number]: {isActive: boolean; lastEventAt?: string}} = {};
    basicAccounts.forEach((account: any) => {
      webhookStatusMap[account.id] = { isActive: false };
    });
    try {
      const statusResponse = await api.get('/webhook/status-batch', { params: { period: '24h' } });
      const batch = statusResponse.data?.data || {};
      for (const account of basicAccounts) {
        const row = batch[String(account.id)] || batch[account.id];
        webhookStatusMap[account.id] = {
          isActive: !!row?.isActive,
          lastEventAt: row?.lastEventAt || undefined,
        };
      }
    } catch (error) {
      console.error('Erro ao carregar status de webhook em lote:', error);
    }
    setWebhookStatuses(webhookStatusMap);
  };

  const fetchAccountMetaDetails = async (accountId: number, options?: { light?: boolean }) => {
    setLoadingDetails((prev) => ({ ...prev, [accountId]: true }));
    try {
      const detailsResponse = await api.get(`/whatsapp-accounts/${accountId}/details`, {
        params: options?.light === false ? undefined : { light: 1 },
        timeout: 45000,
      });
      if (detailsResponse.data.success) {
        const details = detailsResponse.data.data;
        setAccountsDetails((prev) => ({
          ...prev,
          [accountId]: {
            whatsapp_profile_picture: details.whatsapp_profile_picture,
            whatsapp_display_name: details.whatsapp_display_name,
            quality_rating: details.quality_rating,
            stats_utility: details.stats_utility,
            stats_marketing: details.stats_marketing,
            total_cost: details.total_cost,
            cost_utility: details.cost_utility,
            cost_marketing: details.cost_marketing,
            from_cache: false,
          },
        }));
        setAccounts((prev) => prev.map((item) => (
          item.id === accountId
            ? {
                ...item,
                quality_rating: details.quality_rating,
                profile_picture_url: details.whatsapp_profile_picture,
              } as any
            : item
        )));
      }
    } catch (error) {
      console.error(`Erro ao atualizar conta ${accountId}:`, error);
    } finally {
      setLoadingDetails((prev) => ({ ...prev, [accountId]: false }));
    }
  };

  const loadAccountsDetailsProgressively = async (basicAccounts: any[]) => {
    const queue = 2;
    for (let i = 0; i < basicAccounts.length; i += queue) {
      const slice = basicAccounts.slice(i, i + queue);
      await Promise.all(slice.map((account) => fetchAccountMetaDetails(account.id, { light: true })));
    }
  };

  const loadAccounts = async (options?: { refreshMeta?: boolean }) => {
    try {
      const response = await whatsappAccountsAPI.getAll();
      const basicAccounts = response.data.data || [];
      setAccounts(basicAccounts);
      applyCachedDetails(basicAccounts);
      await loadWebhookStatusesBatch(basicAccounts);
      if (options?.refreshMeta !== false) {
        loadAccountsDetailsProgressively(basicAccounts);
      }
    } catch (error) {
      console.error('Erro ao carregar contas:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshAccountNow = async (accountId: number) => {
    await fetchAccountMetaDetails(accountId, { light: true });
    await loadWebhookStatusesBatch(accounts);
  };

  const handleRefreshAllNow = async () => {
    if (refreshingAll || accounts.length === 0) return;
    setRefreshingAll(true);
    try {
      await loadWebhookStatusesBatch(accounts);
      const queue = 3;
      for (let i = 0; i < accounts.length; i += queue) {
        const slice = accounts.slice(i, i + queue);
        await Promise.all(slice.map((account) => fetchAccountMetaDetails(account.id, { light: true })));
      }
    } finally {
      setRefreshingAll(false);
    }
  };

  const handleSubscribeWebhook = async (account: WhatsAppAccount) => {
    setSubscribingWebhookId(account.id);
    try {
      const response = await api.post(`/whatsapp-accounts/${account.id}/subscribe-webhook`, {}, { timeout: 30000 });
      await confirm({
        title: response.data.success ? 'Webhook' : 'Atenção no webhook',
        message: response.data.message || 'Inscrição na WABA concluída.',
        type: response.data.success ? 'info' : 'danger',
        confirmText: 'OK',
        showCancel: false,
      });
      await loadWebhookStatusesBatch(accounts);
    } catch (error: any) {
      await confirm({
        title: 'Webhook',
        message: error.response?.data?.message || error.response?.data?.error || error.message,
        type: 'danger',
        confirmText: 'OK',
        showCancel: false,
      });
    } finally {
      setSubscribingWebhookId(null);
    }
  };

  const getBulkWebhookTargets = () => {
    const selectedInView = filteredAccounts.filter((account) => selectedAccounts.has(account.id));
    if (selectedInView.length > 0) return selectedInView;
    return filteredAccounts;
  };

  const handleSubscribeAllWebhooks = async (mode: 'waba' | 'fields', scope: 'all' | 'targets' = 'all') => {
    if (subscribingAllWebhooks || accounts.length === 0) return;

    const targets = scope === 'targets' ? getBulkWebhookTargets() : accounts.filter((a) => a.is_active !== false);
    if (targets.length === 0) {
      await confirm({
        title: 'Nenhuma conta',
        message: scope === 'targets'
          ? 'Selecione contas ou ajuste o filtro para inscrever.'
          : 'Não há contas ativas para inscrever.',
        type: 'danger',
        confirmText: 'OK',
        showCancel: false,
      });
      return;
    }

    const selectedCount = filteredAccounts.filter((account) => selectedAccounts.has(account.id)).length;
    const scopeLabel = scope === 'targets'
      ? (selectedCount > 0 ? `${targets.length} conta(s) selecionada(s)` : `${targets.length} conta(s) filtrada(s)`)
      : `todas as ${targets.length} conta(s) ativas`;

    const ok = await confirm({
      title: mode === 'waba' ? 'Inscrever webhook na WABA' : 'Assinar todos os campos do App',
      message:
        mode === 'waba'
          ? `Inscreve o App na WABA (mesmo botão “Inscrever Webhook nesta WABA”). Não precisa de App Secret.\n\nVai aplicar em ${scopeLabel}. Continuar?`
          : `Assina TODOS os campos de webhook do aplicativo. Precisa de App ID + App Secret em cada conta.\nContas sem isso vão falhar.\n\nVai aplicar em ${scopeLabel}. Continuar?`,
      type: 'warning',
      confirmText: mode === 'waba' ? 'Inscrever WABA' : 'Assinar campos',
      cancelText: 'Cancelar',
    });
    if (!ok) return;

    setSubscribingAllWebhooks(true);
    setBulkWebhookMode(mode);
    try {
      const response = await api.post(
        '/whatsapp-accounts/subscribe-webhooks-all',
        {
          mode,
          account_ids: targets.map((account) => account.id),
        },
        { timeout: 180000 }
      );
      const fails = (response.data?.data?.results || []).filter((r: any) => !r.success).slice(0, 8);
      const failHint = fails.length
        ? `\n\nExemplos:\n${fails.map((r: any) => `• ${r.name}: ${r.message}`).join('\n')}`
        : '';
      await confirm({
        title: response.data.success ? 'Webhooks inscritos' : 'Atenção em algumas contas',
        message: (response.data.message || 'Processo concluído.') + failHint,
        type: response.data.success ? 'info' : 'danger',
        confirmText: 'OK',
        showCancel: false,
      });
      await loadWebhookStatusesBatch(accounts);
    } catch (error: any) {
      await confirm({
        title: 'Webhook em lote',
        message: error.response?.data?.message || error.response?.data?.error || error.message,
        type: 'danger',
        confirmText: 'OK',
        showCancel: false,
      });
    } finally {
      setSubscribingAllWebhooks(false);
      setBulkWebhookMode(null);
    }
  };

  const handleCheckWebhookFields = async (account: WhatsAppAccount) => {
    setCheckingWebhookFieldsId(account.id);
    try {
      const response = await api.get(`/whatsapp-accounts/${account.id}/webhook-fields`, { timeout: 30000 });
      setWebhookFieldsStatus((prev) => ({
        ...prev,
        [account.id]: response.data.data || response.data,
      }));
      if (!response.data.success) {
        await confirm({
          title: 'Campos de webhook',
          message: response.data.message || response.data.error || 'Não foi possível verificar.',
          type: 'danger',
          confirmText: 'OK',
          showCancel: false,
        });
      }
    } catch (error: any) {
      await confirm({
        title: 'Verificar campos',
        message: error.response?.data?.error || error.response?.data?.message || error.message,
        type: 'danger',
        confirmText: 'OK',
        showCancel: false,
      });
    } finally {
      setCheckingWebhookFieldsId(null);
    }
  };

  const handleResubscribeWebhookFields = async (account: WhatsAppAccount) => {
    const ok = await confirm({
      title: 'Setar todos os webhooks de novo',
      message:
        'Vai gravar novamente TODOS os campos de webhook na Meta e depois conferir o que ficou assinado. Continuar?',
      type: 'warning',
      confirmText: 'Setar todos de novo',
      cancelText: 'Cancelar',
    });
    if (!ok) return;

    setResubscribingFieldsId(account.id);
    try {
      const response = await api.post(
        `/whatsapp-accounts/${account.id}/webhook-fields/resubscribe`,
        { subscribe_all_webhooks: true },
        { timeout: 60000 }
      );
      const status = response.data?.data?.status;
      if (status) {
        setWebhookFieldsStatus((prev) => ({ ...prev, [account.id]: status }));
      }
      await confirm({
        title: response.data.success ? 'Campos setados' : 'Atenção nos campos',
        message: response.data.message || 'Concluído.',
        type: response.data.success ? 'info' : 'danger',
        confirmText: 'OK',
        showCancel: false,
      });
      await loadWebhookStatusesBatch(accounts);
    } catch (error: any) {
      await confirm({
        title: 'Setar webhooks',
        message: error.response?.data?.error || error.response?.data?.message || error.message,
        type: 'danger',
        confirmText: 'OK',
        showCancel: false,
      });
    } finally {
      setResubscribingFieldsId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      let savedId: number | null = null;
      let webhookMessage = '';
      if (editingAccount) {
        const response = await whatsappAccountsAPI.update(editingAccount.id, formData);
        savedId = editingAccount.id;
        webhookMessage = response.data?.message || '';
      } else {
        const response = await whatsappAccountsAPI.create(formData);
        savedId = response.data?.data?.id || null;
        webhookMessage = response.data?.message || '';
      }

      const listResponse = await whatsappAccountsAPI.getAll();
      const basicAccounts = listResponse.data.data || [];
      setAccounts(basicAccounts);
      applyCachedDetails(basicAccounts);
      await loadWebhookStatusesBatch(basicAccounts);
      resetForm();

      if (savedId) {
        fetchAccountMetaDetails(savedId, { light: true });
      }

      await confirm({
        title: '✅ Sucesso!',
        message: webhookMessage || 'Conta salva com sucesso!',
        type: 'info',
        confirmText: 'OK',
        showCancel: false
      });
    } catch (error: any) {
      console.error('❌ Erro ao salvar conta:', error);
      
      // Extrair mensagem de erro detalhada
      const errorData = error.response?.data;
      let errorMessage = 'Erro ao salvar conta';
      
      if (errorData?.message) {
        // Usar a mensagem completa do backend
        errorMessage = errorData.message;
      } else if (errorData?.error) {
        errorMessage = errorData.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      await confirm({
        title: '❌ Erro ao Salvar Conta',
        message: errorMessage,
        type: 'danger',
        confirmText: 'OK',
        showCancel: false
      });
    }
  };

  const handleEdit = (account: WhatsAppAccount) => {
    setEditingAccount(account);
    const savedFields = String(account.webhook_fields_subscribed || '')
      .split(',')
      .map((f) => f.trim())
      .filter(Boolean);
    const fields =
      savedFields.length > 0 ? savedFields : [...ALL_WHATSAPP_WEBHOOK_FIELDS];
    const allSelected = fields.length >= ALL_WHATSAPP_WEBHOOK_FIELDS.length;
    setFormData({
      name: account.name,
      phone_number: account.phone_number,
      access_token: account.access_token,
      phone_number_id: account.phone_number_id,
      business_account_id: account.business_account_id || '',
      app_id: account.app_id || '',
      app_secret: account.app_secret || '',
      webhook_verify_token: account.webhook_verify_token || '',
      is_active: account.is_active,
      proxy_id: account.proxy_id || null,
      subscribe_all_webhooks: allSelected,
      webhook_fields: fields,
    });
    setShowWebhookFields(!allSelected);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: number) => {
    const confirmed = await confirm({
      title: '🗑️ EXCLUIR CONTA',
      message: (
        <div>
          <p className="mb-4 text-lg font-bold">
            Tem certeza que deseja excluir esta conta?
          </p>
          <p className="text-red-400 font-black text-lg">
            ❌ Esta ação não pode ser desfeita!
          </p>
        </div>
      ),
      type: 'danger',
      confirmText: 'Sim, Excluir',
      cancelText: 'Cancelar'
    });
    
    if (!confirmed) return;
    
    try {
      await whatsappAccountsAPI.delete(id);
      await loadAccounts({ refreshMeta: false });
      
      // Show success with another confirm modal
      await confirm({
        title: '✅ Sucesso!',
        message: 'Conta excluída com sucesso!',
        type: 'info',
        confirmText: 'OK',
        showCancel: false
      });
    } catch (error: any) {
      await confirm({
        title: '❌ Erro',
        message: 'Erro ao excluir conta: ' + (error.response?.data?.error || error.message),
        type: 'danger',
        confirmText: 'OK',
        showCancel: false
      });
    }
  };

  const handleToggleActive = async (id: number) => {
    try {
      await whatsappAccountsAPI.toggleActive(id);
      await loadAccounts({ refreshMeta: false });
      await confirm({
        title: '✅ Sucesso!',
        message: 'Status alterado com sucesso!',
        type: 'info',
        confirmText: 'OK',
        showCancel: false
      });
    } catch (error: any) {
      await confirm({
        title: '❌ Erro',
        message: 'Erro ao alterar status: ' + (error.response?.data?.error || error.message),
        type: 'danger',
        confirmText: 'OK',
        showCancel: false
      });
    }
  };

  const handleTestConnection = async (account: WhatsAppAccount) => {
    setTestingConnection(account.id);
    
    try {
      const response = await whatsappAccountsAPI.testConnection({
        access_token: account.access_token,
        phone_number_id: account.phone_number_id,
      });
      
      if (response.data.success) {
        await confirm({
          title: '✅ Conexão Testada!',
          message: 'Conexão testada com sucesso!',
          type: 'info',
          confirmText: 'OK',
          showCancel: false
        });
      } else {
        await confirm({
          title: '❌ Erro na Conexão',
          message: 'Erro na conexão: ' + response.data.error,
          type: 'danger',
          confirmText: 'OK',
          showCancel: false
        });
      }
    } catch (error: any) {
      await confirm({
        title: '❌ Erro ao Testar',
        message: 'Erro ao testar conexão: ' + (error.response?.data?.error || error.message),
        type: 'danger',
        confirmText: 'OK',
        showCancel: false
      });
    } finally {
      setTestingConnection(null);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      phone_number: '',
      access_token: '',
      phone_number_id: '',
      business_account_id: '',
      app_id: '',
      app_secret: '',
      webhook_verify_token: '',
      is_active: true,
      proxy_id: null,
      subscribe_all_webhooks: true,
      webhook_fields: [...ALL_WHATSAPP_WEBHOOK_FIELDS],
    });
    setShowWebhookFields(false);
    setEditingAccount(null);
    setShowForm(false);
  };

  const toggleWebhookField = (field: string) => {
    setFormData((prev) => {
      const has = prev.webhook_fields.includes(field);
      const next = has
        ? prev.webhook_fields.filter((f) => f !== field)
        : [...prev.webhook_fields, field];
      const allOn = next.length >= ALL_WHATSAPP_WEBHOOK_FIELDS.length;
      return {
        ...prev,
        webhook_fields: next,
        subscribe_all_webhooks: allOn,
      };
    });
  };

  const selectAllWebhookFields = () => {
    setFormData((prev) => ({
      ...prev,
      subscribe_all_webhooks: true,
      webhook_fields: [...ALL_WHATSAPP_WEBHOOK_FIELDS],
    }));
  };

  if (loading) {
    return (
      <>
        <Head>
          <title>Configurações API Oficial | Disparador NettSistemas</title>
        </Head>
        
        <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-20 w-20 border-b-4 border-primary-500 mb-4"></div>
          <p className="text-2xl text-white/70">Carregando configurações...</p>
        </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Configurações API Oficial | Disparador NettSistemas</title>
      </Head>
      
      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 py-8 px-4">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* 🎨 CABEÇALHO PRINCIPAL */}
        <div className="relative overflow-hidden bg-gradient-to-r from-green-600/30 via-green-500/20 to-green-600/30 backdrop-blur-xl border-2 border-green-500/40 rounded-3xl p-10 shadow-2xl shadow-green-500/20">
          <div className="absolute inset-0 bg-grid-white/[0.02]"></div>
          <div className="relative">
            <div className="flex items-center justify-between flex-wrap gap-6">
              <div className="flex items-center gap-6">
                {/* Botão Voltar */}
                <button
                  onClick={() => router.push('/dashboard-oficial')}
                  className="bg-white/10 hover:bg-white/20 p-4 rounded-xl transition-all duration-200 border-2 border-white/20 hover:border-white/40"
                  title="Voltar para o Dashboard API Oficial"
                >
                  <FaArrowLeft className="text-3xl text-white" />
                </button>
                
                <div className="bg-gradient-to-br from-green-500 to-green-600 p-6 rounded-2xl shadow-lg shadow-green-500/50">
                  <FaCog className="text-5xl text-white" />
                </div>
                <div>
                  <h1 className="text-5xl font-black text-white tracking-tight mb-2">
                    Configurações
                  </h1>
                  <p className="text-xl text-white/80 font-medium">
                    Contas WhatsApp API
                  </p>
                </div>
              </div>
              
              <div className="flex gap-4 flex-wrap">
                <button
                  onClick={() => router.push('/template/gerenciar')}
                  className="flex items-center gap-3 px-6 py-4 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border-2 border-blue-500/40 rounded-xl font-bold transition-all duration-200 shadow-lg hover:shadow-blue-500/30"
                >
                  <FaFileAlt className="text-xl" />
                  Gerenciar Templates
                </button>
                <button
                  onClick={() => router.push('/template/criar')}
                  className="flex items-center gap-3 px-6 py-4 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border-2 border-purple-500/40 rounded-xl font-bold transition-all duration-200 shadow-lg hover:shadow-purple-500/30"
                >
                  <FaPlus className="text-xl" />
                  Criar Template
                </button>
                <button
                  onClick={() => router.push('/api-status')}
                  className="flex items-center gap-3 px-6 py-4 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border-2 border-cyan-500/40 rounded-xl font-bold transition-all duration-200 shadow-lg hover:shadow-cyan-500/30"
                >
                  <FaCog className="text-xl animate-spin-slow" />
                  Status das Contas
                </button>
                <button
                  onClick={handleRefreshAllNow}
                  disabled={refreshingAll || accounts.length === 0}
                  className="flex items-center gap-3 px-6 py-4 bg-orange-500/20 hover:bg-orange-500/30 text-orange-200 border-2 border-orange-500/40 rounded-xl font-bold transition-all duration-200 shadow-lg hover:shadow-orange-500/30 disabled:opacity-50"
                  title="Buscar qualidade, foto e webhook de todas as contas agora"
                >
                  {refreshingAll ? <FaSpinner className="text-xl animate-spin" /> : <FaSync className="text-xl" />}
                  {refreshingAll ? 'Atualizando...' : 'Atualizar Todas Agora'}
                </button>
                <button
                  onClick={() => handleSubscribeAllWebhooks('waba', 'all')}
                  disabled={subscribingAllWebhooks || accounts.length === 0}
                  className="flex items-center gap-3 px-6 py-4 bg-blue-500/20 hover:bg-blue-500/30 text-blue-200 border-2 border-blue-500/40 rounded-xl font-bold transition-all duration-200 shadow-lg hover:shadow-blue-500/30 disabled:opacity-50"
                  title="Inscrever o App na WABA de todas as contas (não precisa de App Secret)"
                >
                  {subscribingAllWebhooks && bulkWebhookMode === 'waba' ? <FaSpinner className="text-xl animate-spin" /> : <FaBell className="text-xl" />}
                  {subscribingAllWebhooks && bulkWebhookMode === 'waba' ? 'Inscrevendo...' : 'Inscrever WABA em Todas'}
                </button>
                <button
                  onClick={() => setShowForm(!showForm)}
                  className={`flex items-center gap-3 px-8 py-4 rounded-xl font-bold transition-all duration-200 shadow-lg ${
                    showForm 
                      ? 'bg-red-500/20 hover:bg-red-500/30 text-red-300 border-2 border-red-500/40 hover:shadow-red-500/30' 
                      : 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-green-500/30 hover:shadow-green-500/50 transform hover:scale-105'
                  }`}
                >
                  {showForm ? <FaTimes className="text-xl" /> : <FaPlus className="text-xl" />}
                  {showForm ? 'Cancelar' : 'Adicionar Conta'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* FORMULÁRIO */}
        {showForm && (
          <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-primary-500/40 rounded-2xl p-8 shadow-2xl">
            <h2 className="text-3xl font-black mb-8 flex items-center gap-3">
              <div className="bg-primary-500/20 p-3 rounded-xl">
                {editingAccount ? <FaEdit className="text-2xl text-primary-400" /> : <FaPlus className="text-2xl text-primary-400" />}
              </div>
              {editingAccount ? 'Editar Conta' : 'Nova Conta'}
            </h2>
            
            <form onSubmit={handleSubmit}>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-lg font-bold mb-3 text-white">
                    Nome/Identificação *
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/30 transition-all"
                    placeholder="Ex: NETTCRED - Atendimento"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-lg font-bold mb-3 text-white">
                    Número de Telefone *
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/30 transition-all"
                    placeholder="Ex: 5562817429510"
                    value={formData.phone_number}
                    onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                  />
                  <p className="text-sm text-white/60 mt-2">
                    Formato: Código país + DDD + número
                  </p>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-lg font-bold mb-3 text-white">
                    Token de Acesso (Access Token) *
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/30 transition-all font-mono"
                    placeholder="EAAxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    value={formData.access_token}
                    onChange={(e) => setFormData({ ...formData, access_token: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-lg font-bold mb-3 text-white">
                    Phone Number ID *
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/30 transition-all font-mono"
                    placeholder="123456789012345"
                    value={formData.phone_number_id}
                    onChange={(e) => setFormData({ ...formData, phone_number_id: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-lg font-bold mb-3 text-white">
                    Business Account ID (WABA) *
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/30 transition-all font-mono"
                    placeholder="987654321098765"
                    value={formData.business_account_id}
                    onChange={(e) => setFormData({ ...formData, business_account_id: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-lg font-bold mb-3 text-white flex items-center gap-2">
                    Application ID (App ID) *
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/30 transition-all font-mono"
                    placeholder="123456789012345"
                    value={formData.app_id}
                    onChange={(e) => setFormData({ ...formData, app_id: e.target.value })}
                  />
                  <p className="text-sm text-white/60 mt-2">
                    Obrigatório para templates com mídia e assinatura de webhooks
                  </p>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-lg font-bold mb-3 text-white">
                    App Secret *
                  </label>
                  <input
                    type="password"
                    required={!editingAccount}
                    className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/30 transition-all font-mono"
                    placeholder={editingAccount ? 'Deixe em branco para manter o atual' : 'App Secret do aplicativo Meta'}
                    value={formData.app_secret}
                    onChange={(e) => setFormData({ ...formData, app_secret: e.target.value })}
                  />
                  <p className="text-sm text-white/60 mt-2">
                    Meta for Developers → Configurações do app → Básico → Chave secreta do app
                  </p>
                </div>

                <div className="md:col-span-2 bg-blue-500/10 border-2 border-blue-500/40 rounded-xl p-6 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-black text-white">Webhooks da Meta</h3>
                      <p className="text-sm text-blue-200/80 mt-1">
                        Por padrão <strong>todos</strong> ficam marcados. Só desmarque se quiser ativar alguns.
                      </p>
                    </div>
                    <span className="px-3 py-1 rounded-lg bg-green-500/20 text-green-300 border border-green-500/40 font-bold text-sm">
                      {formData.subscribe_all_webhooks
                        ? `Todos (${ALL_WHATSAPP_WEBHOOK_FIELDS.length})`
                        : `${formData.webhook_fields.length} de ${ALL_WHATSAPP_WEBHOOK_FIELDS.length}`}
                    </span>
                  </div>

                  <label className="flex items-center gap-3 cursor-pointer p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-all">
                    <input
                      type="checkbox"
                      checked={formData.subscribe_all_webhooks}
                      onChange={(e) => {
                        if (e.target.checked) {
                          selectAllWebhookFields();
                          setShowWebhookFields(false);
                        } else {
                          setFormData({ ...formData, subscribe_all_webhooks: false });
                          setShowWebhookFields(true);
                        }
                      }}
                      className="w-6 h-6 rounded border-2 border-white/20 focus:ring-2 focus:ring-primary-500"
                    />
                    <span className="text-lg font-bold text-white">
                      Marcar todos os webhooks (padrão)
                    </span>
                  </label>

                  <button
                    type="button"
                    onClick={() => {
                      setShowWebhookFields((v) => !v);
                      if (!showWebhookFields) {
                        setFormData({ ...formData, subscribe_all_webhooks: false });
                      }
                    }}
                    className="text-blue-300 hover:text-blue-200 font-bold text-sm underline"
                  >
                    {showWebhookFields
                      ? 'Ocultar lista de campos'
                      : 'Escolher só alguns webhooks'}
                  </button>

                  {showWebhookFields && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-72 overflow-y-auto p-3 bg-dark-800/80 rounded-xl border border-white/10">
                      {ALL_WHATSAPP_WEBHOOK_FIELDS.map((field) => (
                        <label
                          key={field}
                          className="flex items-center gap-2 text-sm text-white/90 cursor-pointer hover:bg-white/5 rounded-lg px-2 py-1.5"
                        >
                          <input
                            type="checkbox"
                            checked={formData.webhook_fields.includes(field)}
                            onChange={() => toggleWebhookField(field)}
                            className="w-4 h-4 rounded"
                          />
                          <span className="font-mono text-xs">{field}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={selectAllWebhookFields}
                    className="px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-200 border border-green-500/40 rounded-lg font-bold text-sm"
                  >
                    Remarcar todos
                  </button>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-lg font-bold mb-3 text-white flex items-center gap-2">
                    🌐 Proxy (opcional)
                    {proxies.length === 0 && (
                      <span className="text-sm font-normal text-yellow-400">
                        - Nenhum proxy cadastrado
                      </span>
                    )}
                  </label>
                  <select
                    className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/30 transition-all"
                    value={formData.proxy_id || ''}
                    onChange={(e) => setFormData({ ...formData, proxy_id: e.target.value ? parseInt(e.target.value) : null })}
                  >
                    <option value="" className="bg-gray-800">Sem Proxy (uso direto)</option>
                    {proxies.map(proxy => (
                      <option key={proxy.id} value={proxy.id} className="bg-gray-800">
                        {proxy.name} ({proxy.host}:{proxy.port}) 
                        {proxy.location && ` - ${proxy.location}`}
                        {proxy.status === 'working' ? ' ✓' : proxy.status === 'failed' ? ' ✗' : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-sm text-white/60 mt-2">
                    💡 Configure proxies em <strong className="text-primary-400">Proxies &gt; Adicionar Proxy</strong>
                  </p>
                </div>

                <div className="md:col-span-2">
                  <label className="flex items-center gap-3 cursor-pointer p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-all">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="w-6 h-6 rounded border-2 border-white/20 focus:ring-2 focus:ring-primary-500"
                    />
                    <span className="text-lg font-bold">✅ Ativar esta conta</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-4 mt-8">
                <button 
                  type="submit" 
                  className="flex-1 px-6 py-4 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white text-lg font-bold rounded-xl transition-all duration-200 shadow-lg shadow-primary-500/40 hover:shadow-primary-500/60 flex items-center justify-center gap-2"
                >
                  <FaCheck />
                  {editingAccount ? 'Atualizar Conta' : 'Salvar Conta'}
                </button>
                <button 
                  type="button" 
                  onClick={resetForm} 
                  className="flex-1 px-6 py-4 bg-dark-700 hover:bg-dark-600 text-white text-lg font-bold rounded-xl transition-all duration-200 border-2 border-white/20 hover:border-white/40 flex items-center justify-center gap-2"
                >
                  <FaTimes />
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {/* LISTA DE CONTAS */}
        {accounts.length === 0 ? (
          <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-20 text-center shadow-xl">
            <div className="text-6xl mb-6">📭</div>
            <p className="text-2xl text-white/70 font-medium mb-4">
              Nenhuma conta configurada ainda
            </p>
            <p className="text-lg text-white/50 mb-8">
              Clique em "Adicionar Conta" para começar
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white text-lg font-bold rounded-xl transition-all duration-200 shadow-lg shadow-primary-500/40 hover:shadow-primary-500/60 transform hover:scale-105"
            >
              <FaPlus className="text-xl" />
              Adicionar Primeira Conta
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Barra de Ação em Massa */}
            <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-primary-500/30 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                {/* Checkbox Selecionar Todos */}
                <button
                  onClick={handleSelectAllAccounts}
                  className="flex items-center gap-3 px-6 py-3 bg-primary-500/20 hover:bg-primary-500/30 text-white rounded-xl transition-all border-2 border-primary-500/40 hover:border-primary-500/60"
                >
                  {selectedAccounts.size === accounts.length ? (
                    <FaCheckSquare className="text-2xl text-primary-400" />
                  ) : (
                    <FaSquare className="text-2xl text-gray-400" />
                  )}
                  <span className="font-bold">
                    {selectedAccounts.size === accounts.length ? 'Desselecionar Todas' : 'Selecionar Todas'}
                  </span>
                </button>

                {/* Contador de Selecionadas */}
                {selectedAccounts.size > 0 && (
                  <div className="px-4 py-2 bg-primary-500/20 border-2 border-primary-500/40 rounded-xl">
                    <span className="text-white font-bold">
                      {selectedAccounts.size} de {accounts.length} selecionada(s)
                    </span>
                  </div>
                )}

                {/* Botões de Ação */}
                <div className="flex gap-3 flex-wrap">
                  <button
                    onClick={handleActivateSelected}
                    disabled={deactivating || selectedAccounts.size === 0}
                    className="flex items-center gap-2 px-6 py-3 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-xl transition-all border-2 border-emerald-500/40 hover:border-emerald-500/60 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deactivating ? (
                      <FaSpinner className="text-xl animate-spin" />
                    ) : (
                      <FaCheck className="text-xl" />
                    )}
                    Ativar Selecionadas
                  </button>

                  <button
                    onClick={handleDeactivateSelected}
                    disabled={deactivating || selectedAccounts.size === 0}
                    className="flex items-center gap-2 px-6 py-3 bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 rounded-xl transition-all border-2 border-orange-500/40 hover:border-orange-500/60 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deactivating ? (
                      <FaSpinner className="text-xl animate-spin" />
                    ) : (
                      <FaBan className="text-xl" />
                    )}
                    Desativar Selecionadas
                  </button>

                  <button
                    onClick={handleActivateAll}
                    disabled={deactivating}
                    className="flex items-center gap-2 px-6 py-3 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 rounded-xl transition-all border-2 border-emerald-600/40 hover:border-emerald-600/60 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deactivating ? (
                      <FaSpinner className="text-xl animate-spin" />
                    ) : (
                      <FaCheck className="text-xl" />
                    )}
                    Ativar TODAS
                  </button>

                  <button
                    onClick={handleDeactivateAll}
                    disabled={deactivating}
                    className="flex items-center gap-2 px-6 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-xl transition-all border-2 border-red-500/40 hover:border-red-500/60 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deactivating ? (
                      <FaSpinner className="text-xl animate-spin" />
                    ) : (
                      <FaBan className="text-xl" />
                    )}
                    Desativar TODAS
                  </button>
                </div>
              </div>
            </div>

            {/* 🔍 BUSCA E FILTROS */}
            <div className="bg-dark-800/80 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-6 shadow-xl mb-8">
              <div className="flex items-center gap-3 mb-6">
                <FaFilter className="text-3xl text-primary-400" />
                <h3 className="text-2xl font-black text-white">Buscar e Filtrar Contas</h3>
              </div>

              <div className="space-y-4">
                {/* Busca */}
                <div className="relative">
                  <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 text-xl" />
                  <input
                    type="text"
                    placeholder="Buscar por nome ou telefone..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-14 pr-6 py-4 bg-dark-700/80 border-2 border-white/20 rounded-xl text-white placeholder-white/40 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/30 transition-all text-lg"
                  />
                </div>

                {/* Atalho Webhook Desativado */}
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setFilterWebhook(filterWebhook === 'inactive' ? 'all' : 'inactive')}
                    className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold border-2 transition-all ${
                      filterWebhook === 'inactive'
                        ? 'bg-red-500/30 text-red-100 border-red-400 shadow-lg shadow-red-500/20'
                        : 'bg-red-500/10 text-red-300 border-red-500/40 hover:bg-red-500/20'
                    }`}
                  >
                    <FaBell className="text-lg" />
                    {filterWebhook === 'inactive' ? 'Mostrando só Webhook Desativado' : 'Filtrar Webhook Desativado'}
                    <span className="ml-1 px-2.5 py-0.5 rounded-lg bg-black/30 text-sm">
                      {webhookInactiveCount}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSubscribeAllWebhooks('waba', 'targets')}
                    disabled={subscribingAllWebhooks || filteredAccounts.length === 0}
                    className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold border-2 border-blue-500/50 bg-blue-500/20 text-blue-200 hover:bg-blue-500/30 disabled:opacity-50"
                    title="Igual a “Inscrever Webhook nesta WABA”. Não precisa de App ID/Secret. Usa as selecionadas; se nenhuma estiver marcada, usa as filtradas."
                  >
                    {subscribingAllWebhooks && bulkWebhookMode === 'waba' ? <FaSpinner className="animate-spin" /> : <FaBell />}
                    Inscrever WABA nas selecionadas / filtradas
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSubscribeAllWebhooks('fields', 'targets')}
                    disabled={subscribingAllWebhooks || filteredAccounts.length === 0}
                    className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold border-2 border-orange-500/50 bg-orange-500/20 text-orange-200 hover:bg-orange-500/30 disabled:opacity-50"
                    title="Assina todos os campos do aplicativo. Precisa de App ID + App Secret em cada conta."
                  >
                    {subscribingAllWebhooks && bulkWebhookMode === 'fields' ? <FaSpinner className="animate-spin" /> : <FaSync />}
                    Assinar todos os campos (App ID/Secret)
                  </button>
                </div>

                {/* Filtros */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Filtro Webhook */}
                  <div>
                    <label className="block text-white/80 text-sm font-bold mb-2">🔗 Webhook</label>
                    <select
                      value={filterWebhook}
                      onChange={(e) => setFilterWebhook(e.target.value as any)}
                      className={`w-full px-4 py-3 bg-dark-700/80 border-2 rounded-xl text-white focus:ring-4 focus:ring-primary-500/30 transition-all ${
                        filterWebhook === 'inactive'
                          ? 'border-red-500 focus:border-red-400'
                          : 'border-white/20 focus:border-primary-500'
                      }`}
                    >
                      <option value="all">Todos</option>
                      <option value="active">✅ Ativado</option>
                      <option value="inactive">❌ Desativado ({webhookInactiveCount})</option>
                    </select>
                  </div>

                  {/* Filtro Status */}
                  <div>
                    <label className="block text-white/80 text-sm font-bold mb-2">📱 Status API</label>
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value as any)}
                      className="w-full px-4 py-3 bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/30 transition-all"
                    >
                      <option value="all">Todos</option>
                      <option value="connected">✅ Conectada</option>
                      <option value="disconnected">❌ Desconectada</option>
                    </select>
                  </div>

                  {/* Filtro Qualidade */}
                  <div>
                    <label className="block text-white/80 text-sm font-bold mb-2">⭐ Qualidade</label>
                    <select
                      value={filterQuality}
                      onChange={(e) => setFilterQuality(e.target.value as any)}
                      className="w-full px-4 py-3 bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/30 transition-all"
                    >
                      <option value="all">Todas</option>
                      <option value="GREEN">🟢 Alta</option>
                      <option value="YELLOW">🟡 Média</option>
                      <option value="RED">🔴 Baixa</option>
                      <option value="FLAGGED">🚫 Restrita</option>
                    </select>
                  </div>
                </div>

                {/* Contador de Resultados */}
                {(searchTerm || filterWebhook !== 'all' || filterStatus !== 'all' || filterQuality !== 'all') && (
                  <div className="flex items-center justify-between p-4 bg-primary-500/10 border-2 border-primary-500/30 rounded-xl">
                    <span className="text-white font-bold">
                      📊 Mostrando {filteredAccounts.length} de {accounts.length} conta(s)
                    </span>
                    <button
                      onClick={() => {
                        setSearchTerm('');
                        setFilterWebhook('all');
                        setFilterStatus('all');
                        setFilterQuality('all');
                      }}
                      className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-all border border-red-500/40 font-bold text-sm"
                    >
                      <FaTimes className="inline mr-2" />
                      Limpar Filtros
                    </button>
                  </div>
                )}
              </div>
            </div>

            {filteredAccounts.map((account) => (
              <div key={account.id} className="bg-dark-800/60 backdrop-blur-xl border-2 border-primary-500/30 rounded-2xl p-8 shadow-xl hover:border-primary-500/50 transition-all duration-300 relative">
                {/* Tag de Status no Canto Direito Superior */}
                <div className="absolute top-4 right-4 z-10">
                  {account.is_active ? (
                    <span className="px-5 py-3 rounded-xl text-base font-bold border-2 bg-green-500/20 text-green-300 border-green-500/40 inline-flex items-center gap-2 shadow-xl">
                      <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                      ATIVO
                    </span>
                  ) : (
                    <span className="px-5 py-3 rounded-xl text-base font-bold border-2 bg-gray-500/20 text-gray-400 border-gray-500/40 inline-flex items-center gap-2 shadow-xl">
                      <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                      INATIVO
                    </span>
                  )}
                </div>

                <div className="flex items-start justify-between gap-8">
                  {/* COLUNA ESQUERDA - Perfil, Info e Botões */}
                  <div className="flex-1 flex flex-col justify-between h-full">
                    {/* TOPO: Perfil com Foto GRANDE e Nome */}
                    <div className="flex items-start gap-6 mb-8 pr-40">
                      {/* Checkbox de Seleção */}
                      <button
                        onClick={() => handleToggleSelectAccount(account.id)}
                        className="flex-shrink-0 mt-12"
                      >
                        {selectedAccounts.has(account.id) ? (
                          <FaCheckSquare className="text-4xl text-primary-400 hover:text-primary-300 transition-colors" />
                        ) : (
                          <FaSquare className="text-4xl text-gray-600 hover:text-gray-500 transition-colors" />
                        )}
                      </button>

                      {/* 🔼🔽 Botões de Reordenação */}
                      <div className="flex flex-col gap-2 mt-8">
                        <button
                          onClick={() => handleMoveUp(account.id)}
                          className="p-3 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border-2 border-blue-500/40 hover:border-blue-500/60 rounded-lg transition-all duration-200 flex items-center justify-center shadow-lg"
                          title="Mover para cima"
                        >
                          <FaArrowUp className="text-xl" />
                        </button>
                        <button
                          onClick={() => handleMoveDown(account.id)}
                          className="p-3 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border-2 border-blue-500/40 hover:border-blue-500/60 rounded-lg transition-all duration-200 flex items-center justify-center shadow-lg"
                          title="Mover para baixo"
                        >
                          <FaArrowDown className="text-xl" />
                        </button>
                      </div>

                      {/* Foto de Perfil MUITO MAIOR E REDONDA - COM CARREGAMENTO PROGRESSIVO */}
                      {(() => {
                        const details = accountsDetails[account.id];
                        const isLoadingPhoto = loadingDetails[account.id];
                        const profilePicture = details?.whatsapp_profile_picture || (account as any).whatsapp_profile_picture;
                        
                        if (profilePicture) {
                          return (
                            <img 
                              src={profilePicture} 
                              alt="Perfil WhatsApp"
                              className={`w-40 h-40 rounded-full object-cover border-4 border-primary-500/50 shadow-2xl flex-shrink-0 ring-4 ring-primary-500/20 transition-all ${
                                !account.is_active ? 'grayscale opacity-50' : ''
                              }`}
                            />
                          );
                        }
                        
                        return (
                          <div className={`w-40 h-40 rounded-full bg-gradient-to-br from-primary-500/30 to-primary-600/30 border-4 border-primary-500/50 flex items-center justify-center shadow-2xl flex-shrink-0 ring-4 ring-primary-500/20 transition-all relative ${
                            !account.is_active ? 'grayscale opacity-50' : ''
                          }`}>
                            {isLoadingPhoto ? (
                              <FaSpinner className="text-5xl text-primary-300 animate-spin" />
                            ) : (
                              <FaWhatsapp className="text-7xl text-primary-300" />
                            )}
                            {isLoadingPhoto && (
                              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-primary-500/90 px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap">
                                Carregando...
                              </div>
                            )}
                          </div>
                        );
                      })()}
                      
                      {/* Nome - MUITO ESPAÇO */}
                      <div className="flex flex-col gap-4 flex-1 min-w-0 py-2">
                        {/* Nome do WhatsApp Business - GRANDE E COM ESPAÇO */}
                        <div>
                          <h3 className="text-4xl font-black text-white break-words leading-tight">
                            {accountsDetails[account.id]?.whatsapp_display_name || (account as any).whatsapp_display_name || account.name}
                          </h3>
                          {/* Nome customizado do sistema (se diferente) */}
                          {(() => {
                            const displayName = accountsDetails[account.id]?.whatsapp_display_name || (account as any).whatsapp_display_name;
                            return displayName && displayName !== account.name && (
                              <p className="text-sm text-white/50 break-words mt-2">
                                Nome no sistema: {account.name}
                              </p>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                    
                    {/* MEIO: Info Cards - Número e Phone ID - ALINHADO COM ESTATÍSTICAS */}
                    <div className="grid grid-cols-2 gap-3 mb-6">
                      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                        <div className="text-white/60 text-xs font-medium mb-1 flex items-center gap-1">
                          <span>📱</span> Número
                        </div>
                        <div className="text-white font-bold truncate">{account.phone_number}</div>
                      </div>
                      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                        <div className="text-white/60 text-xs font-medium mb-1 flex items-center gap-1">
                          <span>🆔</span> Phone ID
                        </div>
                        <div className="text-white font-bold text-sm font-mono truncate">{account.phone_number_id}</div>
                      </div>
                    </div>

                    {/* BAIXO: BOTÕES - MAIORES E ALINHADOS */}
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                      <button
                        onClick={() => handleRefreshAccountNow(account.id)}
                        disabled={!!loadingDetails[account.id]}
                        className="w-full px-6 py-4 bg-orange-500/20 hover:bg-orange-500/30 text-orange-200 border-2 border-orange-500/40 hover:border-orange-500/60 rounded-xl font-bold text-base transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg"
                        title="Atualizar qualidade e foto desta conta agora"
                      >
                        {loadingDetails[account.id] ? (
                          <>
                            <FaSpinner className="animate-spin text-xl" />
                            <span>Atualizando...</span>
                          </>
                        ) : (
                          <>
                            <FaSync className="text-xl" />
                            <span>Atualizar Agora</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => handleTestConnection(account)}
                        disabled={testingConnection === account.id}
                        className="w-full px-6 py-4 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border-2 border-blue-500/40 hover:border-blue-500/60 rounded-xl font-bold text-base transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg"
                        title="Testar conexão"
                      >
                        {testingConnection === account.id ? (
                          <>
                            <FaSpinner className="animate-spin text-xl" />
                            <span>Testando...</span>
                          </>
                        ) : (
                          <>
                            <FaCheckCircle className="text-xl" />
                            <span>Testar</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => handleToggleActive(account.id)}
                        className={`w-full px-6 py-4 ${
                          account.is_active
                            ? 'bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border-yellow-500/40 hover:border-yellow-500/60'
                            : 'bg-green-500/20 hover:bg-green-500/30 text-green-300 border-green-500/40 hover:border-green-500/60'
                        } border-2 rounded-xl font-bold text-base transition-all duration-200 flex items-center justify-center gap-2 shadow-lg`}
                        title={account.is_active ? 'Desativar conta' : 'Ativar conta'}
                      >
                        {account.is_active ? (
                          <>
                            <FaBan className="text-xl" />
                            <span>Desativar</span>
                          </>
                        ) : (
                          <>
                            <FaCheckCircle className="text-xl" />
                            <span>Ativar</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => handleEdit(account)}
                        className="w-full px-6 py-4 bg-green-500/20 hover:bg-green-500/30 text-green-300 border-2 border-green-500/40 hover:border-green-500/60 rounded-xl font-bold text-base transition-all duration-200 flex items-center justify-center gap-2 shadow-lg"
                        title="Editar conta"
                      >
                        <FaEdit className="text-xl" />
                        <span>Editar</span>
                      </button>

                      <button
                        onClick={() => router.push(`/configuracoes/conta/${account.id}`)}
                        className="w-full px-6 py-4 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border-2 border-purple-500/40 hover:border-purple-500/60 rounded-xl font-bold text-base transition-all duration-200 flex items-center justify-center gap-2 shadow-lg"
                        title="Configurações avançadas"
                      >
                        <FaCog className="text-xl" />
                        <span>Configurar</span>
                      </button>

                      <button
                        onClick={async () => {
                          const confirmed = await confirm({
                            title: 'Excluir conta',
                            message: `Tem certeza que deseja excluir a conta ${account.name}?`,
                          });
                          if (confirmed) {
                            handleDelete(account.id);
                          }
                        }}
                        className="w-full col-span-2 px-6 py-4 bg-red-500/20 hover:bg-red-500/30 text-red-300 border-2 border-red-500/40 hover:border-red-500/60 rounded-xl font-bold text-base transition-all duration-200 flex items-center justify-center gap-2 shadow-lg"
                        title="Excluir conta"
                      >
                        <FaTrash className="text-xl" />
                        <span>Excluir</span>
                      </button>
                    </div>
                  </div>

                  {/* Estatísticas da Conta - LAYOUT OTIMIZADO */}
                  <div className="flex-1 max-w-md">
                    <div className="bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-2xl p-6 h-full shadow-2xl">
                      <h4 className="text-white font-black text-xl mb-6 flex items-center gap-3 pb-4 border-b border-white/10">
                        <span className="text-3xl">📊</span> 
                        <span className="bg-gradient-to-r from-primary-400 to-primary-600 bg-clip-text text-transparent">
                          Visão Geral
                        </span>
                      </h4>
                      
                      <div className="space-y-4">
                        {/* Mensagem de carregamento progressivo */}
                        {loadingDetails[account.id] ? (
                          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mb-4">
                            <div className="flex items-center gap-3">
                              <FaSpinner className="text-2xl text-blue-400 animate-spin" />
                              <div>
                                <p className="text-white text-sm font-bold mb-1">
                                  🔄 Atualizando Informações
                                </p>
                                <p className="text-white/60 text-xs">
                                  Buscando foto, quality rating e estatísticas atualizadas...
                                </p>
                              </div>
                            </div>
                          </div>
                        ) : accountsDetails[account.id] ? (
                          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 mb-4">
                            <div className="flex items-center gap-3">
                              <span className="text-2xl">✅</span>
                              <div>
                                <p className="text-white text-sm font-bold mb-1">
                                  Informações Atualizadas
                                </p>
                                <p className="text-white/60 text-xs">
                                  Dados carregados da API do WhatsApp
                                </p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-primary-500/10 border border-primary-500/30 rounded-xl p-4 mb-4">
                            <div className="flex items-start gap-3">
                              <span className="text-2xl">⚡</span>
                              <div>
                                <p className="text-white text-sm font-bold mb-1">
                                  Carregamento Rápido Ativado
                                </p>
                                <p className="text-white/60 text-xs">
                                  As informações estão sendo carregadas automaticamente...
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {/* Qualidade da Conta (progressivo) */}
                        {(() => {
                          const details = accountsDetails[account.id];
                          const qualityRating = details?.quality_rating || (account as any).quality_rating;
                          
                          if (qualityRating) {
                            return (
                              <div className={`rounded-xl p-4 border-2 shadow-lg hover:scale-105 transition-transform duration-200 ${
                                qualityRating === 'GREEN' 
                                  ? 'bg-gradient-to-br from-green-500/20 to-green-600/10 border-green-500/40'
                                  : qualityRating === 'YELLOW'
                                  ? 'bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 border-yellow-500/40'
                                  : qualityRating === 'RED'
                                  ? 'bg-gradient-to-br from-orange-500/20 to-orange-600/10 border-orange-500/40'
                                  : 'bg-gradient-to-br from-red-500/20 to-red-600/10 border-red-500/40'
                              }`}>
                                <div className="flex items-center justify-between">
                                  <div className="flex-1">
                                    <div className={`text-xs font-bold mb-2 ${
                                      qualityRating === 'GREEN' 
                                        ? 'text-green-300'
                                        : qualityRating === 'YELLOW'
                                        ? 'text-yellow-300'
                                        : qualityRating === 'RED'
                                        ? 'text-orange-300'
                                        : 'text-red-300'
                                    }`}>⭐ QUALIDADE {details?.quality_rating ? '(Atualizado)' : '(Cache)'}</div>
                                    <div className="text-white text-2xl font-black">
                                      {qualityRating === 'GREEN' && '✅ ALTA'}
                                      {qualityRating === 'YELLOW' && '⚠️ MÉDIA'}
                                      {qualityRating === 'RED' && '⚠️ BAIXA'}
                                      {qualityRating === 'FLAGGED' && '🚫 RESTRITA'}
                                    </div>
                                  </div>
                                  <div className={`text-5xl ${
                                    qualityRating === 'GREEN' 
                                      ? 'text-green-300'
                                      : qualityRating === 'YELLOW'
                                      ? 'text-yellow-300'
                                      : qualityRating === 'RED'
                                      ? 'text-orange-300'
                                      : 'text-red-300'
                                  }`}>
                                    {qualityRating === 'GREEN' && '😊'}
                                    {qualityRating === 'YELLOW' && '😐'}
                                    {qualityRating === 'RED' && '😟'}
                                    {qualityRating === 'FLAGGED' && '🔴'}
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          
                          return (
                            <div className="bg-gradient-to-br from-gray-500/20 to-gray-600/10 border-2 border-gray-500/40 rounded-xl p-4">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="text-gray-300 text-xs font-bold mb-2">⭐ QUALIDADE</div>
                                  <div className="text-white text-xl font-black">
                                    {loadingDetails[account.id] ? 'Carregando...' : 'Aguardando dados'}
                                  </div>
                                  <p className="text-xs text-gray-400 mt-2">
                                    {loadingDetails[account.id] ? 'Buscando informações...' : 'Será carregado em breve'}
                                  </p>
                                </div>
                                <div className="text-4xl text-gray-400">
                                  {loadingDetails[account.id] ? <FaSpinner className="animate-spin" /> : '❓'}
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                        
                        {/* Status da API */}
                        {(() => {
                          const details = accountsDetails[account.id];
                          const qualityRating = details?.quality_rating || (account as any).quality_rating;
                          const hasQualityRating = qualityRating != null && qualityRating !== undefined;
                          const isConnected = account.is_active && hasQualityRating;
                          
                          return (
                            <div className={`bg-gradient-to-br ${
                              isConnected 
                                ? 'from-green-500/20 to-emerald-600/10 border-green-500/40' 
                                : loadingDetails[account.id]
                                ? 'from-blue-500/20 to-blue-600/10 border-blue-500/40'
                                : 'from-gray-500/20 to-gray-600/10 border-gray-500/40'
                            } border-2 rounded-xl p-4`}>
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className={`${
                                    isConnected ? 'text-green-300' : loadingDetails[account.id] ? 'text-blue-300' : 'text-gray-300'
                                  } text-xs font-bold mb-2`}>
                                    🔌 STATUS API
                                  </div>
                                  <div className="text-white text-xl font-black flex items-center gap-2">
                                    <span className={`w-3 h-3 rounded-full ${
                                      isConnected 
                                        ? 'bg-green-400 animate-pulse shadow-lg shadow-green-400/50' 
                                        : loadingDetails[account.id]
                                        ? 'bg-blue-400 animate-pulse shadow-lg shadow-blue-400/50'
                                        : 'bg-gray-400'
                                    }`}></span>
                                    {isConnected ? 'Conectada' : loadingDetails[account.id] ? 'Verificando...' : 'Aguardando verificação'}
                                  </div>
                                </div>
                                <div className={`${
                                  isConnected ? 'text-green-300' : loadingDetails[account.id] ? 'text-blue-400' : 'text-gray-400'
                                } text-4xl`}>
                                  {isConnected ? '✅' : loadingDetails[account.id] ? <FaSpinner className="animate-spin" /> : '⚙️'}
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                        
                        {/* Status do Webhook */}
                        <div className={`bg-gradient-to-br ${
                          webhookStatuses[account.id]?.isActive 
                            ? 'from-blue-500/20 to-cyan-600/10 border-blue-500/40' 
                            : 'from-red-500/20 to-orange-600/10 border-red-500/40'
                        } border-2 rounded-xl p-4`}>
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className={`${
                                webhookStatuses[account.id]?.isActive ? 'text-blue-300' : 'text-red-300'
                              } text-xs font-bold mb-2`}>🔗 WEBHOOK</div>
                              <div className="text-white text-xl font-black flex items-center gap-2">
                                <span className={`w-3 h-3 rounded-full ${
                                  webhookStatuses[account.id]?.isActive 
                                    ? 'bg-blue-400 animate-pulse shadow-lg shadow-blue-400/50' 
                                    : 'bg-red-400'
                                }`}></span>
                                {webhookStatuses[account.id]?.isActive ? 'Ativado' : 'Desativado'}
                              </div>
                              {webhookStatuses[account.id]?.lastEventAt && (
                                <div className="mt-2 text-xs text-white/60">
                                  📅 Último evento:<br />
                                  <span className="text-blue-300 font-semibold">
                                    {new Date(webhookStatuses[account.id]?.lastEventAt || '').toLocaleString('pt-BR', {
                                      day: '2-digit',
                                      month: '2-digit',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      second: '2-digit'
                                    })}
                                  </span>
                                </div>
                              )}
                              <div className="mt-3 space-y-2">
                                {!webhookStatuses[account.id]?.isActive && (
                                  <button
                                    type="button"
                                    onClick={() => handleSubscribeWebhook(account)}
                                    disabled={subscribingWebhookId === account.id}
                                    className="w-full px-3 py-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-400/40 text-blue-100 text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                                    title="Inscrever o App Meta nesta WABA para a conta nova passar a receber eventos"
                                  >
                                    {subscribingWebhookId === account.id ? (
                                      <FaSpinner className="animate-spin" />
                                    ) : (
                                      <FaBell />
                                    )}
                                    Inscrever Webhook nesta WABA
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleCheckWebhookFields(account)}
                                  disabled={checkingWebhookFieldsId === account.id}
                                  className="w-full px-3 py-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-100 text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                                  title="Consultar na Meta quais campos de webhook estão realmente assinados"
                                >
                                  {checkingWebhookFieldsId === account.id ? (
                                    <FaSpinner className="animate-spin" />
                                  ) : (
                                    <FaSearch />
                                  )}
                                  Ver campos assinados na Meta
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleResubscribeWebhookFields(account)}
                                  disabled={resubscribingFieldsId === account.id}
                                  className="w-full px-3 py-2 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 border border-orange-400/40 text-orange-100 text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                                  title="Setar todos os campos de webhook novamente e confirmar"
                                >
                                  {resubscribingFieldsId === account.id ? (
                                    <FaSpinner className="animate-spin" />
                                  ) : (
                                    <FaSync />
                                  )}
                                  Setar todos os webhooks de novo
                                </button>
                              </div>

                              {webhookFieldsStatus[account.id] && (
                                <div className="mt-3 p-3 rounded-lg bg-black/30 border border-white/10 text-xs space-y-2">
                                  <div className={`font-bold ${
                                    webhookFieldsStatus[account.id].all_ok ? 'text-green-300' : 'text-yellow-300'
                                  }`}>
                                    {webhookFieldsStatus[account.id].all_ok
                                      ? `✅ Todos ok (${webhookFieldsStatus[account.id].subscribed?.length || 0})`
                                      : `⚠️ Faltam ${webhookFieldsStatus[account.id].missing?.length || 0} · Assinados: ${webhookFieldsStatus[account.id].subscribed?.length || 0}`}
                                  </div>
                                  {webhookFieldsStatus[account.id].callback_url && (
                                    <div className="text-white/50 break-all">
                                      URL: {webhookFieldsStatus[account.id].callback_url}
                                    </div>
                                  )}
                                  {Array.isArray(webhookFieldsStatus[account.id].missing) &&
                                    webhookFieldsStatus[account.id].missing.length > 0 && (
                                    <div className="text-red-300">
                                      <div className="font-bold mb-1">Faltando:</div>
                                      <div className="flex flex-wrap gap-1">
                                        {webhookFieldsStatus[account.id].missing.map((f: string) => (
                                          <span key={f} className="px-1.5 py-0.5 rounded bg-red-500/20 border border-red-500/40 font-mono">
                                            {f}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {Array.isArray(webhookFieldsStatus[account.id].subscribed) &&
                                    webhookFieldsStatus[account.id].subscribed.length > 0 && (
                                    <details className="text-white/70">
                                      <summary className="cursor-pointer font-bold text-blue-200">
                                        Ver assinados ({webhookFieldsStatus[account.id].subscribed.length})
                                      </summary>
                                      <div className="mt-2 flex flex-wrap gap-1 max-h-28 overflow-y-auto">
                                        {webhookFieldsStatus[account.id].subscribed.map((f: string) => (
                                          <span key={f} className="px-1.5 py-0.5 rounded bg-blue-500/20 border border-blue-500/40 font-mono">
                                            {f}
                                          </span>
                                        ))}
                                      </div>
                                    </details>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className={`text-4xl ${
                              webhookStatuses[account.id]?.isActive ? 'text-blue-300' : 'text-red-300'
                            }`}>
                              {webhookStatuses[account.id]?.isActive ? '🔔' : '🔕'}
                            </div>
                          </div>
                        </div>
                        
                        {/* Botão de Acesso Rápido às Estatísticas Completas */}
                        <button
                          onClick={() => router.push(`/configuracoes/conta/${account.id}`)}
                          className="w-full px-6 py-4 bg-gradient-to-r from-primary-500/30 to-purple-500/30 hover:from-primary-500/40 hover:to-purple-500/40 text-white border-2 border-primary-500/40 hover:border-primary-500/60 rounded-xl font-bold text-base transition-all duration-200 flex items-center justify-center gap-3 shadow-lg hover:scale-105"
                        >
                          <span className="text-2xl">📊</span>
                          <div className="text-left">
                            <div className="text-sm">Ver Estatísticas Completas</div>
                            <div className="text-xs text-white/60">Custos, Analytics, Templates e mais</div>
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        .bg-grid-white {
          background-image: 
            linear-gradient(to right, rgba(255, 255, 255, 0.1) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.1) 1px, transparent 1px);
          background-size: 20px 20px;
        }
      `}</style>
      
      {/* Modal de Confirmação Elegante */}
      <ConfirmDialog />
    </div>
    </>
  );
}
