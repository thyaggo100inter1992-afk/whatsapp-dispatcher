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

const CACHE_KEY = '@WhatsAppDispatcher:permissions';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

function getPermissionsFromCache(): Permissions | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL_MS) {
      sessionStorage.removeItem(CACHE_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function savePermissionsToCache(data: Permissions) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
  } catch {
    // sessionStorage indisponível — continua sem cache
  }
}

const PERMISSIONS_TIMEOUT_MS = 5000; // 5 segundos máximo para resposta

export function usePermissions() {
  const [permissions, setPermissions] = useState<Permissions | null>(() => getPermissionsFromCache());
  const [loading, setLoading] = useState<boolean>(() => getPermissionsFromCache() === null);

  const loadPermissions = useCallback(async () => {
    // Verificar cache antes de chamar a API
    const cached = getPermissionsFromCache();
    if (cached) {
      setPermissions(cached);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Timeout: se o servidor demorar mais de 5s, usa fallback em vez de travar
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), PERMISSIONS_TIMEOUT_MS);

      const response = await api.get('/permissions', {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const data: Permissions = response.data.data;
      setPermissions(data);
      savePermissionsToCache(data);
    } catch (error: any) {
      if (error?.name === 'CanceledError' || error?.name === 'AbortError' || error?.code === 'ERR_CANCELED') {
        console.warn('⚠️ Timeout ao carregar permissões — usando acesso total como fallback');
      } else {
        console.error('❌ Erro ao carregar permissões:', error);
      }
      // Fallback: libera acesso total para não bloquear o usuário por falha de rede
      const fallback: Permissions = {
        all: true,
        funcionalidades: {
          whatsapp_api: true, whatsapp_qr: true, campanhas: true,
          templates: true, base_dados: true, nova_vida: true,
          verificar_numeros: true, gerenciar_proxies: true,
          lista_restricao: true, webhooks: true, configuracoes: true,
          chat_atendimento: true, relatorios: true, dashboard: true,
        },
      };
      setPermissions(fallback);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Se já tem cache, não precisa carregar
    if (permissions !== null) return;
    loadPermissions();
  }, [loadPermissions, permissions]);

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

