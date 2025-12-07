import { useState, useEffect, useCallback } from 'react';
import api from '@/services/api';

interface Permissions {
  all?: boolean;
  funcionalidades: {
    whatsapp_api?: boolean;
    whatsapp_qr?: boolean;
    campanhas?: boolean;
    templates?: boolean;
    base_dados?: boolean;
    nova_vida?: boolean;
    verificar_numeros?: boolean;
    gerenciar_proxies?: boolean;
    lista_restricao?: boolean;
    webhooks?: boolean;
    configuracoes?: boolean;
    chat_atendimento?: boolean;
    [key: string]: boolean | undefined;
  };
}

export function usePermissions() {
  const [permissions, setPermissions] = useState<Permissions | null>(null);
  const [loading, setLoading] = useState(true);

  const loadPermissions = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/permissions');
      setPermissions(response.data.data);
      console.log('🔐 Permissões carregadas:', response.data.data);
    } catch (error) {
      console.error('❌ Erro ao carregar permissões:', error);
      // Em caso de erro, assume que não tem permissões
      setPermissions({
        all: false,
        funcionalidades: {}
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPermissions();
  }, [loadPermissions]);

  const hasPermission = useCallback((funcionalidade: string): boolean => {
    if (!permissions) return false;
    if (permissions.all) return true;
    return permissions.funcionalidades[funcionalidade] === true;
  }, [permissions]);

  const canAccessWhatsAppAPI = hasPermission('whatsapp_api');
  const canAccessWhatsAppQR = hasPermission('whatsapp_qr');
  const canAccessCampaigns = hasPermission('campanhas');
  const canAccessTemplates = hasPermission('templates');
  const canAccessDatabase = hasPermission('base_dados');
  const canAccessNovaVida = hasPermission('nova_vida');
  const canVerifyNumbers = hasPermission('verificar_numeros');
  const canManageProxies = hasPermission('gerenciar_proxies');
  const canAccessRestrictionList = hasPermission('lista_restricao');
  const canAccessWebhooks = hasPermission('webhooks');
  const canAccessConfiguracoes = hasPermission('configuracoes');
  const canAccessChat = hasPermission('chat_atendimento');

  return {
    permissions,
    loading,
    hasPermission,
    loadPermissions,
    canAccessWhatsAppAPI,
    canAccessWhatsAppQR,
    canAccessCampaigns,
    canAccessTemplates,
    canAccessDatabase,
    canAccessNovaVida,
    canVerifyNumbers,
    canManageProxies,
    canAccessRestrictionList,
    canAccessWebhooks,
    canAccessConfiguracoes,
    canAccessChat,
  };
}

