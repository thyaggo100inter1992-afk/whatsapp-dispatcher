import { Request, Response } from 'express';
import { tenantQuery } from '../database/tenant-query';

/**
 * Controller para processar webhooks de status de mensagens do WhatsApp QR Connect
 */
export class QrWebhookController {
  /**
   * Processar atualização de status de mensagem
   * POST /api/qr-webhook/message-status
   */
  async processMessageStatus(req: Request, res: Response) {
    try {
      const {
        whatsapp_message_id,
        status, // 'delivered', 'read', 'failed'
        timestamp,
        error_message,
        instance_id,
      } = req.body;

      console.log('📩 Webhook recebido:', {
        whatsapp_message_id,
        status,
        timestamp,
        instance_id,
      });

      // Validar dados recebidos
      if (!whatsapp_message_id || !status) {
        return res.status(400).json({
          success: false,
          error: 'whatsapp_message_id e status são obrigatórios',
        });
      }

      // Buscar mensagem no banco
      const messageResult = await tenantQuery(req, 
        `SELECT id, campaign_id, status as current_status 
         FROM qr_campaign_messages 
         WHERE whatsapp_message_id = $1`,
        [whatsapp_message_id]
      );

      if (messageResult.rows.length === 0) {
        console.log('⚠️ Mensagem não encontrada:', whatsapp_message_id);
        return res.status(404).json({
          success: false,
          error: 'Mensagem não encontrada',
        });
      }

      const message = messageResult.rows[0];
      const campaignId = message.campaign_id;
      const currentStatus = message.current_status;

      // Não permitir downgrade de status
      const statusHierarchy = {
        'pending': 0,
        'sent': 1,
        'delivered': 2,
        'read': 3,
        'failed': -1,
      };

      if (statusHierarchy[status] < statusHierarchy[currentStatus] && status !== 'failed') {
        console.log('⚠️ Tentativa de downgrade de status ignorada');
        return res.json({ success: true, message: 'Status não atualizado (downgrade)' });
      }

      // Atualizar status da mensagem
      let updateQuery = '';
      const updateParams: any[] = [status, whatsapp_message_id];

      if (status === 'delivered') {
        updateQuery = `
          UPDATE qr_campaign_messages 
          SET status = $1, delivered_at = NOW(), updated_at = NOW()
          WHERE whatsapp_message_id = $2
          RETURNING id
        `;
      } else if (status === 'read') {
        updateQuery = `
          UPDATE qr_campaign_messages 
          SET status = $1, read_at = NOW(), updated_at = NOW()
          WHERE whatsapp_message_id = $2
          RETURNING id
        `;
      } else if (status === 'failed') {
        updateQuery = `
          UPDATE qr_campaign_messages 
          SET status = $1, failed_at = NOW(), error_message = $3, updated_at = NOW()
          WHERE whatsapp_message_id = $2
          RETURNING id
        `;
        updateParams.push(error_message || 'Erro desconhecido');
      } else {
        updateQuery = `
          UPDATE qr_campaign_messages 
          SET status = $1, updated_at = NOW()
          WHERE whatsapp_message_id = $2
          RETURNING id
        `;
      }

      await tenantQuery(req, updateQuery, updateParams);

      console.log(`✅ Mensagem ${whatsapp_message_id} atualizada para ${status}`);

      // Atualizar contadores da campanha
      await this.updateCampaignCounters(req, campaignId);

      res.json({
        success: true,
        message: 'Status atualizado com sucesso',
      });
    } catch (error: any) {
      console.error('❌ Erro ao processar webhook:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Processar clique em botão (se disponível)
   * POST /api/qr-webhook/button-click
   */
  async processButtonClick(req: Request, res: Response) {
    try {
      const {
        phone_number,
        button_text,
        button_payload,
        campaign_id,
        whatsapp_message_id,
        timestamp,
      } = req.body;

      console.log('👆 Clique em botão recebido:', {
        phone_number,
        button_text,
        campaign_id,
      });

      // Verificar se o clique já foi registrado (evitar duplicatas)
      const existingClick = await tenantQuery(req, 
        `SELECT id FROM button_clicks 
         WHERE campaign_id = $1 AND phone_number = $2 AND button_text = $3 AND clicked_at > NOW() - INTERVAL '1 minute'`,
        [campaign_id, phone_number, button_text]
      );

      if (existingClick.rows.length > 0) {
        console.log('⚠️ Clique duplicado ignorado');
        return res.json({ success: true, message: 'Clique já registrado' });
      }

      // Buscar contact_id
      const contactResult = await tenantQuery(req, 
        'SELECT id FROM contacts WHERE phone_number = $1',
        [phone_number]
      );

      const contactId = contactResult.rows[0]?.id || null;

      // Registrar clique no botão
      await tenantQuery(req, 
        `INSERT INTO button_clicks (
          campaign_id, contact_id, phone_number, button_text, button_payload, clicked_at, campaign_type
        ) VALUES ($1, $2, $3, $4, $5, NOW(), 'qr_connect')`,
        [campaign_id, contactId, phone_number, button_text, button_payload || '']
      );

      // Incrementar contador de cliques na campanha
      await tenantQuery(req, 
        `UPDATE qr_campaigns 
         SET button_clicks_count = button_clicks_count + 1, updated_at = NOW()
         WHERE id = $1`,
        [campaign_id]
      );

      console.log(`✅ Clique registrado: ${button_text}`);

      res.json({
        success: true,
        message: 'Clique registrado com sucesso',
      });
    } catch (error: any) {
      console.error('❌ Erro ao processar clique:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Atualizar contadores da campanha baseado nas mensagens
   */
  private async updateCampaignCounters(req: Request, campaignId: number) {
    try {
      const result = await tenantQuery(req, 
        `SELECT 
          COUNT(*) FILTER (WHERE status = 'delivered') as delivered_count,
          COUNT(*) FILTER (WHERE status = 'read') as read_count,
          COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
          COUNT(*) FILTER (WHERE error_message LIKE '%not registered%' OR error_message LIKE '%unregistered%' OR error_message LIKE '%131026%') as no_whatsapp_count
         FROM qr_campaign_messages 
         WHERE campaign_id = $1`,
        [campaignId]
      );

      const counters = result.rows[0];

      await tenantQuery(req, 
        `UPDATE qr_campaigns 
         SET 
           delivered_count = $1,
           read_count = $2,
           failed_count = $3,
           no_whatsapp_count = $4,
           updated_at = NOW()
         WHERE id = $5`,
        [
          parseInt(counters.delivered_count) || 0,
          parseInt(counters.read_count) || 0,
          parseInt(counters.failed_count) || 0,
          parseInt(counters.no_whatsapp_count) || 0,
          campaignId,
        ]
      );

      console.log(`📊 Contadores atualizados para campanha ${campaignId}`);
    } catch (error: any) {
      console.error('❌ Erro ao atualizar contadores:', error);
    }
  }

  /**
   * Health check do webhook
   * GET /api/qr-webhook/health
   */
  async health(req: Request, res: Response) {
    res.json({
      success: true,
      message: 'Webhook QR Connect está funcionando',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Receber eventos do UAZ API (webhook externo)
   * POST /api/qr-webhook/uaz-event
   */
  async receiveUazEvent(req: Request, res: Response) {
    try {
      const event = req.body;
      console.log('📨 Evento UAZ recebido:', JSON.stringify(event, null, 2));

      // O UAZ pode enviar diferentes tipos de eventos
      // Você precisará adaptar isso baseado na documentação do UAZ
      
      const { type, data } = event;

      if (type === 'message.status' || type === 'message_status') {
        // Evento de atualização de status
        const { messageId, status, error } = data;
        
        if (status === 'delivered' || status === 'DELIVERY_ACK') {
          // Processar internamente sem response
          const fakeReq = {
            body: {
              whatsapp_message_id: messageId,
              status: 'delivered',
              timestamp: new Date().toISOString(),
            },
          } as Request;
          
          const fakeRes = {
            json: (data: any) => console.log('✅ Status atualizado:', data),
            status: (code: number) => ({
              json: (data: any) => console.log(`Status ${code}:`, data),
            }),
          } as unknown as Response;
          
          await this.processMessageStatus(fakeReq, fakeRes);
        } else if (status === 'read' || status === 'READ') {
          const fakeReq = {
            body: {
              whatsapp_message_id: messageId,
              status: 'read',
              timestamp: new Date().toISOString(),
            },
          } as Request;
          
          const fakeRes = {
            json: (data: any) => console.log('✅ Status atualizado:', data),
            status: (code: number) => ({
              json: (data: any) => console.log(`Status ${code}:`, data),
            }),
          } as unknown as Response;
          
          await this.processMessageStatus(fakeReq, fakeRes);
        } else if (status === 'failed' || status === 'FAILED') {
          const fakeReq = {
            body: {
              whatsapp_message_id: messageId,
              status: 'failed',
              error_message: error || 'Falha no envio',
              timestamp: new Date().toISOString(),
            },
          } as Request;
          
          const fakeRes = {
            json: (data: any) => console.log('✅ Status atualizado:', data),
            status: (code: number) => ({
              json: (data: any) => console.log(`Status ${code}:`, data),
            }),
          } as unknown as Response;
          
          await this.processMessageStatus(fakeReq, fakeRes);
        }
      } else if (type === 'message.button' || type === 'button_click') {
        // Evento de clique em botão
        const { phoneNumber, buttonText, buttonPayload, messageId } = data;
        
        const fakeReq = {
          body: {
            phone_number: phoneNumber,
            button_text: buttonText,
            button_payload: buttonPayload,
            whatsapp_message_id: messageId,
            timestamp: new Date().toISOString(),
          },
        } as Request;
        
        const fakeRes = {
          json: (data: any) => console.log('✅ Clique registrado:', data),
          status: (code: number) => ({
            json: (data: any) => console.log(`Status ${code}:`, data),
          }),
        } as unknown as Response;
        
        await this.processButtonClick(fakeReq, fakeRes);
      }

      res.json({
        success: true,
        message: 'Evento processado',
      });
    } catch (error: any) {
      console.error('❌ Erro ao processar evento UAZ:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Verificar mensagem específica (para testes)
   * GET /api/qr-webhook/check-message/:messageId
   */
  async checkMessage(req: Request, res: Response) {
    try {
      const { messageId } = req.params;

      console.log(`🔍 Verificando mensagem: ${messageId}`);

      const messageResult = await tenantQuery(req, 
        `SELECT 
          id, campaign_id, instance_id, phone_number, template_name,
          status, whatsapp_message_id,
          sent_at, delivered_at, read_at, failed_at,
          error_message, created_at
         FROM qr_campaign_messages 
         WHERE whatsapp_message_id = $1`,
        [messageId]
      );

      if (messageResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Mensagem não encontrada no banco',
          hint: 'Verifique se o Message ID está correto e se a mensagem foi realmente enviada'
        });
      }

      const message = messageResult.rows[0];

      res.json({
        success: true,
        data: message,
        message: 'Mensagem encontrada'
      });
    } catch (error: any) {
      console.error('❌ Erro ao verificar mensagem:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}

