import axios from 'axios';

/**
 * Helper para enviar eventos de status de mensagens para o webhook interno
 */
export class QrWebhookHelper {
  private static baseUrl = 'http://localhost:3001/api/qr-webhook';

  /**
   * Notificar que uma mensagem foi entregue
   */
  static async notifyDelivered(whatsappMessageId: string, instanceId: number) {
    try {
      await axios.post(`${this.baseUrl}/message-status`, {
        whatsapp_message_id: whatsappMessageId,
        status: 'delivered',
        timestamp: new Date().toISOString(),
        instance_id: instanceId,
      });
      console.log(`✅ Webhook notificado: Mensagem ${whatsappMessageId} entregue`);
    } catch (error: any) {
      console.error('❌ Erro ao notificar webhook (delivered):', error.message);
    }
  }

  /**
   * Notificar que uma mensagem foi lida
   */
  static async notifyRead(whatsappMessageId: string, instanceId: number) {
    try {
      await axios.post(`${this.baseUrl}/message-status`, {
        whatsapp_message_id: whatsappMessageId,
        status: 'read',
        timestamp: new Date().toISOString(),
        instance_id: instanceId,
      });
      console.log(`✅ Webhook notificado: Mensagem ${whatsappMessageId} lida`);
    } catch (error: any) {
      console.error('❌ Erro ao notificar webhook (read):', error.message);
    }
  }

  /**
   * Notificar que uma mensagem falhou
   */
  static async notifyFailed(whatsappMessageId: string, instanceId: number, errorMessage: string) {
    try {
      await axios.post(`${this.baseUrl}/message-status`, {
        whatsapp_message_id: whatsappMessageId,
        status: 'failed',
        timestamp: new Date().toISOString(),
        instance_id: instanceId,
        error_message: errorMessage,
      });
      console.log(`✅ Webhook notificado: Mensagem ${whatsappMessageId} falhou`);
    } catch (error: any) {
      console.error('❌ Erro ao notificar webhook (failed):', error.message);
    }
  }

  /**
   * Notificar clique em botão
   */
  static async notifyButtonClick(
    phoneNumber: string,
    buttonText: string,
    buttonPayload: string,
    campaignId: number,
    whatsappMessageId?: string
  ) {
    try {
      await axios.post(`${this.baseUrl}/button-click`, {
        phone_number: phoneNumber,
        button_text: buttonText,
        button_payload: buttonPayload,
        campaign_id: campaignId,
        whatsapp_message_id: whatsappMessageId,
        timestamp: new Date().toISOString(),
      });
      console.log(`✅ Webhook notificado: Clique em botão "${buttonText}" por ${phoneNumber}`);
    } catch (error: any) {
      console.error('❌ Erro ao notificar webhook (button-click):', error.message);
    }
  }
}







