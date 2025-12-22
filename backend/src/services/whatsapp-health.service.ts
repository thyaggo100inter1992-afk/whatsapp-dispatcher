import axios, { AxiosRequestConfig } from 'axios';
import { getProxyConfigFromAccount, applyProxyToRequest, formatProxyInfo } from '../helpers/proxy.helper';

export interface PhoneNumberHealth {
  phone_number_id: string;
  quality_rating: 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN';
  code_verification_status: 'VERIFIED' | 'UNVERIFIED' | 'EXPIRED' | 'UNKNOWN';
  status: 'CONNECTED' | 'DISCONNECTED' | 'FLAGGED' | 'RESTRICTED' | 'BANNED' | 'UNKNOWN';
  display_phone_number?: string;
  verified_name?: string;
  platform_type?: string;
  throughput_level?: string;
}

class WhatsAppHealthService {
  async getPhoneNumberHealth(
    phoneNumberId: string,
    accessToken: string,
    accountId?: number,
    accountName?: string,
    tenantId?: number
  ): Promise<PhoneNumberHealth> {
    try {
      let requestConfig: AxiosRequestConfig = {
        params: {
          fields: 'quality_rating,code_verification_status,status,display_phone_number,verified_name,platform_type,throughput',
        },
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        timeout: 10000,
      };

      // Aplicar proxy se configurado
      const proxyConfig = accountId && tenantId ? await getProxyConfigFromAccount(accountId, tenantId) : null;
      if (proxyConfig) {
        console.log(`🌐 WhatsApp Health Service - Aplicando proxy: ${formatProxyInfo(proxyConfig)}${accountName ? ` - Conta: ${accountName}` : ''}`);
        requestConfig = applyProxyToRequest(requestConfig, proxyConfig, accountName || 'WhatsApp Health');
      } else {
        console.log(`📤 WhatsApp Health Service - Requisição SEM proxy${accountName ? ` - Conta: ${accountName}` : ''}`);
      }

      const response = await axios.get(
        `https://graph.facebook.com/v18.0/${phoneNumberId}`,
        requestConfig
      );

      return {
        phone_number_id: phoneNumberId,
        quality_rating: response.data.quality_rating || 'UNKNOWN',
        code_verification_status: response.data.code_verification_status || 'UNKNOWN',
        status: response.data.status || 'UNKNOWN',
        display_phone_number: response.data.display_phone_number,
        verified_name: response.data.verified_name,
        platform_type: response.data.platform_type,
        throughput_level: response.data.throughput?.level || 'UNKNOWN',
      };
    } catch (error: any) {
      console.error(`❌ Erro ao buscar health do número ${phoneNumberId}:`, error.message);
      if (error.response?.data) {
        console.error(`   Detalhes:`, error.response.data);
      }
      
      // Retornar valores padrão em caso de erro
      return {
        phone_number_id: phoneNumberId,
        quality_rating: 'UNKNOWN',
        code_verification_status: 'UNKNOWN',
        status: 'UNKNOWN',
      };
    }
  }

  /**
   * Verifica se a conta está saudável para enviar mensagens
   * IMPORTANTE: UNKNOWN não é considerado problema - só remove se tiver certeza
   */
  isHealthy(health: PhoneNumberHealth): boolean {
    // Status que indicam problema definitivo
    const badStatus = ['BANNED', 'FLAGGED', 'RESTRICTED', 'DISCONNECTED'].includes(health.status);
    const badQuality = health.quality_rating === 'YELLOW' || health.quality_rating === 'RED';
    const unverified = health.code_verification_status === 'UNVERIFIED';

    // Só é NÃO saudável se temos CERTEZA do problema
    return !badStatus && !badQuality && !unverified;
  }

  /**
   * Verifica se deve remover a conta da campanha
   * Remove quando: BANNED, FLAGGED, RESTRICTED, DISCONNECTED, YELLOW ou RED
   */
  shouldRemoveFromCampaign(health: PhoneNumberHealth): boolean {
    // Status que SEMPRE devem remover
    const badStatus = ['BANNED', 'FLAGGED', 'RESTRICTED', 'DISCONNECTED'].includes(health.status);
    
    // Qualidade ruim também remove
    const badQuality = health.quality_rating === 'YELLOW' || health.quality_rating === 'RED';
    
    return badStatus || badQuality;
  }

  /**
   * Retorna o motivo pelo qual a conta não está saudável
   */
  getUnhealthyReason(health: PhoneNumberHealth): string {
    // Primeiro verificar status da conta (mais crítico)
    if (health.status === 'BANNED') {
      return 'CONTA BANIDA pelo WhatsApp';
    }
    if (health.status === 'FLAGGED') {
      return 'Conta SINALIZADA por violações';
    }
    if (health.status === 'RESTRICTED') {
      return 'Conta RESTRITA pelo WhatsApp';
    }
    if (health.status === 'DISCONNECTED') {
      return 'Conta DESCONECTADA';
    }
    
    // Depois verificar qualidade
    if (health.quality_rating === 'YELLOW') {
      return 'Qualidade YELLOW (atenção necessária)';
    }
    if (health.quality_rating === 'RED') {
      return 'Qualidade RED (limite de envio reduzido)';
    }
    if (health.code_verification_status === 'UNVERIFIED') {
      return 'Conta não verificada';
    }
    
    // Status OK
    return 'Status temporariamente indisponível';
  }

  /**
   * Formata o throughput level para exibição
   */
  formatThroughputLevel(level: string): string {
    const levels: Record<string, string> = {
      STANDARD: 'Padrão (80 msg/s)',
      HIGH: 'Alto (200 msg/s)',
      VERY_HIGH: 'Muito Alto (1000 msg/s)',
      UNKNOWN: 'Desconhecido',
    };

    return levels[level] || level;
  }

  /**
   * Retorna emoji de status de qualidade
   */
  getQualityEmoji(quality: string): string {
    const emojis: Record<string, string> = {
      GREEN: '🟢',
      YELLOW: '🟡',
      RED: '🔴',
      UNKNOWN: '⚪',
    };
    return emojis[quality] || '⚪';
  }

  /**
   * Retorna emoji de status de verificação
   */
  getVerificationEmoji(status: string): string {
    const emojis: Record<string, string> = {
      VERIFIED: '✅',
      EXPIRED: '⏰',
      UNVERIFIED: '❌',
      UNKNOWN: '⚪',
    };
    return emojis[status] || '⚪';
  }
}

export const whatsappHealthService = new WhatsAppHealthService();

