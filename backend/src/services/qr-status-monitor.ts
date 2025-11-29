import { query } from '../database/connection';
import { QrWebhookHelper } from './qr-webhook-helper';
import axios from 'axios';

/**
 * Serviço para monitorar e atualizar status das mensagens do QR Connect
 */
export class QrStatusMonitor {
  private static isRunning = false;
  private static intervalId: NodeJS.Timeout | null = null;
  private static readonly CHECK_INTERVAL = 10000; // 10 segundos
  private static readonly UAZ_API_URL = process.env.UAZ_API_URL || 'http://localhost:8000';

  /**
   * Iniciar monitoramento de status
   */
  static start() {
    if (this.isRunning) {
      console.log('⚠️ Monitor de status QR já está rodando');
      return;
    }

    console.log('🚀 Iniciando monitor de status QR Connect...');
    this.isRunning = true;

    // Executar imediatamente
    this.checkPendingMessages();

    // E depois a cada intervalo
    this.intervalId = setInterval(() => {
      this.checkPendingMessages();
    }, this.CHECK_INTERVAL);
  }

  /**
   * Parar monitoramento
   */
  static stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('🛑 Monitor de status QR Connect parado');
  }

  /**
   * Verificar mensagens pendentes e atualizar status
   */
  private static async checkPendingMessages() {
    try {
      // Buscar mensagens enviadas mas não entregues/lidas nos últimos 30 minutos
      const result = await query(
        `SELECT 
          m.id, 
          m.whatsapp_message_id, 
          m.status, 
          m.instance_id,
          m.campaign_id,
          i.token as instance_token
         FROM qr_campaign_messages m
         INNER JOIN uaz_instances i ON m.instance_id = i.id
         WHERE m.status IN ('sent', 'delivered') 
           AND m.sent_at > NOW() - INTERVAL '30 minutes'
           AND m.whatsapp_message_id IS NOT NULL
         LIMIT 50`
      );

      if (result.rows.length === 0) {
        return;
      }

      console.log(`🔍 Verificando status de ${result.rows.length} mensagens...`);

      for (const msg of result.rows) {
        await this.checkMessageStatus(msg);
      }
    } catch (error: any) {
      console.error('❌ Erro ao verificar mensagens pendentes:', error.message);
    }
  }

  /**
   * Verificar status de uma mensagem específica no UAZ
   */
  private static async checkMessageStatus(msg: any) {
    try {
      // Aqui você pode implementar a lógica para consultar o status da mensagem
      // via API do UAZ, se disponível
      
      // NOTA: O UAZ pode não ter endpoint para verificar status individual
      // Nesse caso, precisamos confiar nos webhooks ou eventos do socket
      
      // Por enquanto, vamos apenas log
      // console.log(`   Mensagem ${msg.whatsapp_message_id}: ${msg.status}`);
      
    } catch (error: any) {
      console.error(`❌ Erro ao verificar mensagem ${msg.whatsapp_message_id}:`, error.message);
    }
  }

  /**
   * Processar evento de status recebido do UAZ (via webhook ou socket)
   */
  static async processStatusEvent(event: {
    messageId: string;
    status: 'delivered' | 'read' | 'failed';
    instanceId?: number;
    errorMessage?: string;
  }) {
    try {
      console.log(`📩 Evento de status recebido:`, event);

      const { messageId, status, instanceId, errorMessage } = event;

      // Notificar webhook interno
      if (status === 'delivered' && instanceId) {
        await QrWebhookHelper.notifyDelivered(messageId, instanceId);
      } else if (status === 'read' && instanceId) {
        await QrWebhookHelper.notifyRead(messageId, instanceId);
      } else if (status === 'failed' && instanceId) {
        await QrWebhookHelper.notifyFailed(messageId, instanceId, errorMessage || 'Erro desconhecido');
      }
    } catch (error: any) {
      console.error('❌ Erro ao processar evento de status:', error.message);
    }
  }

  /**
   * Processar resposta de botão recebida
   */
  static async processButtonResponse(event: {
    phoneNumber: string;
    buttonText: string;
    buttonPayload?: string;
    messageId?: string;
  }) {
    try {
      console.log(`👆 Resposta de botão recebida:`, event);

      // Buscar a campanha relacionada à mensagem
      if (event.messageId) {
        const result = await query(
          'SELECT campaign_id FROM qr_campaign_messages WHERE whatsapp_message_id = $1',
          [event.messageId]
        );

        if (result.rows.length > 0) {
          const campaignId = result.rows[0].campaign_id;
          
          await QrWebhookHelper.notifyButtonClick(
            event.phoneNumber,
            event.buttonText,
            event.buttonPayload || '',
            campaignId,
            event.messageId
          );
        }
      }
    } catch (error: any) {
      console.error('❌ Erro ao processar resposta de botão:', error.message);
    }
  }
}

// Iniciar monitor ao carregar o módulo (se em produção)
if (process.env.NODE_ENV !== 'test') {
  // Aguardar 5 segundos após o servidor iniciar para começar o monitoramento
  setTimeout(() => {
    QrStatusMonitor.start();
  }, 5000);
}







