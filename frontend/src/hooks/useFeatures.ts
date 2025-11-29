import { useState, useEffect, useCallback } from 'react';
import api from '@/services/api';

/**
 * Funcionalidades disponíveis no sistema
 */
export type FeatureKey =
  | 'whatsapp_api'
  | 'whatsapp_qr'
  | 'consulta_dados'
  | 'verificar_numeros'
  | 'gerenciar_proxies'
  | 'campanhas'
  | 'templates'
  | 'lista_restricao'
  | 'webhooks'
  | 'relatorios'
  | 'nova_vida'
  | 'envio_imediato'
  | 'catalogo'
  | 'dashboard';

export interface Features {
  whatsapp_api: boolean;
  whatsapp_qr: boolean;
  consulta_dados: boolean;
  verificar_numeros: boolean;
  gerenciar_proxies: boolean;
  campanhas: boolean;
  templates: boolean;
  lista_restricao: boolean;
  webhooks: boolean;
  relatorios: boolean;
  nova_vida: boolean;
  envio_imediato: boolean;
  catalogo: boolean;
  dashboard: boolean;
}

export interface FeaturesData {
  tenant: {
    id: number;
    nome: string;
    plano: string;
    status: string;
    is_trial: boolean;
    trial_ends_at?: string;
  };
  plan: {
    id: number;
    nome: string;
    slug: string;
  };
  funcionalidades: Features;
  funcionalidades_customizadas: boolean;
}

/**
 * Hook para gerenciar funcionalidades do tenant
 */
export function useFeatures() {
  const [features, setFeatures] = useState<Features | null>(null);
  const [featuresData, setFeaturesData] = useState<FeaturesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Carregar funcionalidades do backend
   */
  const loadFeatures = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.get('/features');

      if (response.data.success) {
        setFeaturesData(response.data.data);
        setFeatures(response.data.data.funcionalidades);
      } else {
        throw new Error(response.data.message || 'Erro ao carregar funcionalidades');
      }
    } catch (err: any) {
      console.error('❌ Erro ao carregar funcionalidades:', err);
      setError(err.message || 'Erro ao carregar funcionalidades');
      
      // Fallback: liberar tudo em caso de erro
      const fallbackFeatures: Features = {
        whatsapp_api: true,
        whatsapp_qr: true,
        consulta_dados: true,
        verificar_numeros: true,
        gerenciar_proxies: true,
        campanhas: true,
        templates: true,
        lista_restricao: true,
        webhooks: true,
        relatorios: true,
        nova_vida: true,
        envio_imediato: true,
        catalogo: true,
        dashboard: true,
      };
      setFeatures(fallbackFeatures);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Verificar se tenant tem acesso a uma funcionalidade
   */
  const hasFeature = useCallback((feature: FeatureKey): boolean => {
    if (!features) return false;
    return features[feature] === true;
  }, [features]);

  /**
   * Verificar se tenant NÃO tem acesso a uma funcionalidade
   */
  const lacksFeature = useCallback((feature: FeatureKey): boolean => {
    return !hasFeature(feature);
  }, [hasFeature]);

  /**
   * Verificar se tenant tem TODAS as funcionalidades listadas
   */
  const hasAllFeatures = useCallback((...featureList: FeatureKey[]): boolean => {
    return featureList.every(feature => hasFeature(feature));
  }, [hasFeature]);

  /**
   * Verificar se tenant tem ALGUMA das funcionalidades listadas
   */
  const hasSomeFeatures = useCallback((...featureList: FeatureKey[]): boolean => {
    return featureList.some(feature => hasFeature(feature));
  }, [hasFeature]);

  /**
   * Verificar se tenant está em período de TRIAL
   */
  const isTrial = useCallback((): boolean => {
    return featuresData?.tenant?.is_trial === true;
  }, [featuresData]);

  /**
   * Obter mensagem de bloqueio para funcionalidade
   */
  const getBlockedMessage = useCallback((feature: FeatureKey): string => {
    if (isTrial()) {
      return '🆓 Funcionalidade não disponível durante o período de teste. Assine um plano para ter acesso!';
    }

    const featureNames: Record<FeatureKey, string> = {
      whatsapp_api: 'WhatsApp API Oficial',
      whatsapp_qr: 'WhatsApp QR Connect',
      consulta_dados: 'Consulta de Dados',
      verificar_numeros: 'Verificar Números',
      gerenciar_proxies: 'Gerenciar Proxies',
      campanhas: 'Campanhas',
      templates: 'Templates',
      lista_restricao: 'Lista de Restrição',
      webhooks: 'Webhooks',
      relatorios: 'Relatórios',
      nova_vida: 'Nova Vida',
      envio_imediato: 'Envio Imediato',
      catalogo: 'Catálogo',
      dashboard: 'Dashboard',
    };

    return `🔒 A funcionalidade "${featureNames[feature]}" não está disponível no seu plano atual. Faça upgrade para ter acesso!`;
  }, [isTrial]);

  // Carregar funcionalidades ao montar o componente
  useEffect(() => {
    loadFeatures();
  }, [loadFeatures]);

  return {
    features,
    featuresData,
    loading,
    error,
    hasFeature,
    lacksFeature,
    hasAllFeatures,
    hasSomeFeatures,
    isTrial,
    getBlockedMessage,
    reload: loadFeatures,
  };
}


