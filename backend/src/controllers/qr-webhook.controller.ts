import { Request, Response } from 'express';
import { query } from '../database/connection';

/**
 * Controller para processar webhooks de status de mensagens do WhatsApp QR Connect
 * Processa eventos da UAZAPI: messages_update, messages, connection, etc.
 */
export class QrWebhookController {

  /**
   * Receber eventos do UAZ API (webhook externo)
   * POST /api/qr-webhook/uaz-event
   * 
   * Formato esperado da UAZAPI:
   * {
   *   "instance": "instance-name",
   *   "event": "messages_update" | "messages" | "connection" | etc,
   *   "data": { ... }
   * }
   */
  async receiveUazEvent(req: Request, res: Response) {
    try {
      const payload = req.body;
      
      console.log('\n📨 ===== WEBHOOK UAZAPI RECEBIDO =====');
      console.log('📦 Payload:', JSON.stringify(payload, null, 2));

      // Extrair informações do payload
      const instanceName = payload.instance || payload.instanceName;
      const instanceToken = payload.token || payload.instance_token;
      const eventType = payload.event || payload.type || payload.EventType;
      const eventData = payload.data || payload.event || payload;

      console.log(`📡 Instância: ${instanceName}`);
      console.log(`🔑 Token: ${instanceToken}`);
      console.log(`📋 Evento: ${eventType}`);

      // Buscar instance_id pelo nome da instância OU pelo token
      let instanceId: number | null = null;
      if (instanceName || instanceToken) {
        const instanceResult = await query(
          'SELECT id FROM uaz_instances WHERE name = $1 OR instance_token = $2 LIMIT 1',
          [instanceName || '', instanceToken || '']
        );
        if (instanceResult.rows.length > 0) {
          instanceId = instanceResult.rows[0].id;
          console.log(`✅ Instância encontrada: ID ${instanceId}`);
        } else {
          console.log(`⚠️ Instância não encontrada - Nome: ${instanceName}, Token: ${instanceToken}`);
        }
      }

      // Processar baseado no tipo de evento
      switch (eventType) {
        case 'messages_update':
        case 'message_status':
        case 'messages.update':
          await this.processMessagesUpdate(eventData, instanceId);
          break;

        case 'messages':
        case 'message':
          await this.processIncomingMessage(eventData, instanceId);
          break;

        case 'connection':
        case 'connection.update':
          await this.processConnectionUpdate(eventData, instanceName);
          break;

        default:
          console.log(`ℹ️ Evento não processado: ${eventType}`);
      }

      console.log('===== FIM DO WEBHOOK =====\n');

      res.json({ success: true, message: 'Evento processado' });
    } catch (error: any) {
      console.error('❌ Erro ao processar webhook UAZAPI:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Processar atualização de status de mensagem (messages_update)
   * Atualiza: delivered_count, read_count, failed_count
   */
  private async processMessagesUpdate(data: any, instanceId: number | null) {
    try {
      console.log('\n📩 Processando MESSAGES_UPDATE...');
      
      // A UAZAPI pode enviar um array de atualizações ou um único objeto
      const updates = Array.isArray(data) ? data : [data];

      for (const update of updates) {
        // Extrair message ID e status
        // Formatos possíveis:
        // { id: 'wamid.xxx', status: 'delivered' }
        // { key: { id: 'wamid.xxx' }, update: { status: 3 } }
        // { message: { id: 'wamid.xxx' }, status: 'read' }
        
        let messageId = update.id || update.key?.id || update.message?.id || update.messageId;
        let status = update.status || update.update?.status;
        let errorMessage = update.error || update.errorMessage || update.update?.error;

        // Converter status numérico para string (baileys format)
        if (typeof status === 'number') {
          const statusMap: { [key: number]: string } = {
            0: 'pending',
            1: 'sent',
            2: 'delivered',
            3: 'read',
            4: 'played', // para áudio/vídeo
            5: 'failed'
          };
          status = statusMap[status] || 'unknown';
        }

        // Normalizar status
        if (status === 'DELIVERY_ACK' || status === 'delivery') status = 'delivered';
        if (status === 'READ' || status === 'viewed') status = 'read';
        if (status === 'FAILED' || status === 'error') status = 'failed';
        if (status === 'SENT' || status === 'server') status = 'sent';

        if (!messageId) {
          console.log('⚠️ Message ID não encontrado no update:', update);
          continue;
        }

        console.log(`   📝 Message ID: ${messageId}`);
        console.log(`   📊 Status: ${status}`);

        // Buscar mensagem no banco (qr_campaign_messages)
        const messageResult = await query(
          `SELECT id, campaign_id, status as current_status, instance_id
           FROM qr_campaign_messages 
           WHERE whatsapp_message_id = $1`,
          [messageId]
        );

        if (messageResult.rows.length === 0) {
          console.log(`   ⚠️ Mensagem não encontrada no banco: ${messageId}`);
          continue;
        }

        const message = messageResult.rows[0];
        const campaignId = message.campaign_id;
        const currentStatus = message.current_status;

        console.log(`   ✅ Mensagem encontrada: ID ${message.id}, Campanha ${campaignId}`);
        console.log(`   📊 Status atual: ${currentStatus}`);

        // Hierarquia de status (não permitir downgrade)
        const statusHierarchy: { [key: string]: number } = {
          'pending': 0,
          'sent': 1,
          'delivered': 2,
          'read': 3,
          'played': 3,
          'failed': -1,
        };

        const newPriority = statusHierarchy[status] || 0;
        const currentPriority = statusHierarchy[currentStatus] || 0;

        if (newPriority <= currentPriority && status !== 'failed') {
          console.log(`   ℹ️ Status não atualizado (${currentStatus} → ${status})`);
          continue;
        }

        // Atualizar status da mensagem
        if (status === 'delivered') {
          await query(
            `UPDATE qr_campaign_messages 
             SET status = 'delivered', delivered_at = NOW(), updated_at = NOW()
             WHERE id = $1`,
            [message.id]
          );
          
          // Atualizar contador da campanha
          await query(
            `UPDATE qr_campaigns 
             SET delivered_count = delivered_count + 1, updated_at = NOW()
             WHERE id = $1`,
            [campaignId]
          );
          
          console.log(`   ✅ Atualizado para DELIVERED`);

        } else if (status === 'read' || status === 'played') {
          // Se está passando de delivered para read, ajustar contadores
          if (currentStatus === 'delivered') {
            await query(
              `UPDATE qr_campaigns 
               SET delivered_count = delivered_count - 1, 
                   read_count = read_count + 1, 
                   updated_at = NOW()
               WHERE id = $1`,
              [campaignId]
            );
          } else {
            // Pulou delivered, ir direto para read
            await query(
              `UPDATE qr_campaigns 
               SET read_count = read_count + 1, updated_at = NOW()
               WHERE id = $1`,
              [campaignId]
            );
          }

          await query(
            `UPDATE qr_campaign_messages 
             SET status = 'read', 
                 read_at = NOW(), 
                 delivered_at = COALESCE(delivered_at, NOW()),
                 updated_at = NOW()
             WHERE id = $1`,
            [message.id]
          );
          
          console.log(`   ✅ Atualizado para READ`);

        } else if (status === 'failed') {
          await query(
            `UPDATE qr_campaign_messages 
             SET status = 'failed', 
                 failed_at = NOW(), 
                 error_message = $2,
                 updated_at = NOW()
             WHERE id = $1`,
            [message.id, errorMessage || 'Falha no envio']
          );
          
          // Atualizar contador da campanha
          await query(
            `UPDATE qr_campaigns 
             SET failed_count = failed_count + 1, updated_at = NOW()
             WHERE id = $1`,
            [campaignId]
          );
          
          console.log(`   ❌ Atualizado para FAILED: ${errorMessage}`);
        }
      }
    } catch (error: any) {
      console.error('❌ Erro ao processar messages_update:', error);
    }
  }

  /**
   * Processar mensagem recebida (messages)
   * Detecta cliques em botões e respostas de lista
   */
  private async processIncomingMessage(data: any, instanceId: number | null) {
    try {
      console.log('\n💬 Processando MENSAGEM RECEBIDA...');

      const messages = Array.isArray(data) ? data : [data];

      for (const msg of messages) {
        // Extrair informações
        const from = msg.from || msg.key?.remoteJid || msg.remoteJid;
        const messageType = msg.type || msg.messageType;
        const contextId = msg.context?.id || msg.contextInfo?.stanzaId;

        // Limpar número de telefone
        const phoneNumber = from?.replace('@s.whatsapp.net', '').replace('@c.us', '');

        console.log(`   📱 De: ${phoneNumber}`);
        console.log(`   📋 Tipo: ${messageType}`);
        console.log(`   🔗 Context ID: ${contextId}`);

        // Verificar se é resposta de botão
        let buttonText = '';
        let buttonPayload = '';
        let isButtonClick = false;

        // Formato button_reply
        if (msg.type === 'button_reply' || msg.buttonReply) {
          const reply = msg.buttonReply || msg;
          buttonText = reply.selectedButtonId || reply.id || '';
          buttonPayload = reply.selectedButtonId || reply.id || '';
          isButtonClick = true;
          console.log(`   👆 BOTÃO CLICADO: ${buttonText}`);
        }

        // Formato interactive button
        if (msg.type === 'interactive' || msg.interactive) {
          const interactive = msg.interactive || msg;
          if (interactive.type === 'button_reply') {
            buttonText = interactive.button_reply?.title || '';
            buttonPayload = interactive.button_reply?.id || '';
            isButtonClick = true;
          } else if (interactive.type === 'list_reply') {
            buttonText = interactive.list_reply?.title || '';
            buttonPayload = interactive.list_reply?.id || '';
            isButtonClick = true;
          }
          console.log(`   👆 INTERATIVO CLICADO: ${buttonText}`);
        }

        // Formato list_reply
        if (msg.type === 'list_reply' || msg.listReply) {
          const reply = msg.listReply || msg;
          buttonText = reply.title || reply.selectedRowId || '';
          buttonPayload = reply.id || reply.selectedRowId || '';
          isButtonClick = true;
          console.log(`   👆 LISTA SELECIONADA: ${buttonText}`);
        }

        // Se foi clique em botão, registrar
        if (isButtonClick && phoneNumber) {
          await this.registerButtonClick(phoneNumber, buttonText, buttonPayload, contextId, instanceId);
        }
      }
    } catch (error: any) {
      console.error('❌ Erro ao processar mensagem recebida:', error);
    }
  }

  /**
   * Registrar clique em botão
   */
  private async registerButtonClick(
    phoneNumber: string,
    buttonText: string,
    buttonPayload: string,
    contextMessageId: string | null,
    instanceId: number | null
  ) {
    try {
      console.log('\n👆 Registrando CLIQUE EM BOTÃO...');

      // Buscar campanha relacionada
      let campaignId: number | null = null;
      let messageId: number | null = null;

      if (contextMessageId) {
        const msgResult = await query(
          `SELECT id, campaign_id FROM qr_campaign_messages 
           WHERE whatsapp_message_id = $1`,
          [contextMessageId]
        );
        if (msgResult.rows.length > 0) {
          messageId = msgResult.rows[0].id;
          campaignId = msgResult.rows[0].campaign_id;
        }
      }

      // Se não encontrou pelo context, buscar última mensagem para este número
      if (!campaignId && phoneNumber) {
        const recentMsg = await query(
          `SELECT id, campaign_id FROM qr_campaign_messages 
           WHERE phone_number LIKE $1
           ORDER BY sent_at DESC
           LIMIT 1`,
          [`%${phoneNumber}%`]
        );
        if (recentMsg.rows.length > 0) {
          messageId = recentMsg.rows[0].id;
          campaignId = recentMsg.rows[0].campaign_id;
        }
      }

      console.log(`   📊 Campanha: ${campaignId}`);
      console.log(`   📝 Botão: ${buttonText}`);

      // Verificar se já existe clique duplicado (últimos 60 segundos)
      const existingClick = await query(
        `SELECT id FROM button_clicks 
         WHERE phone_number = $1 AND button_text = $2 
         AND clicked_at > NOW() - INTERVAL '1 minute'`,
        [phoneNumber, buttonText]
      );

      if (existingClick.rows.length > 0) {
        console.log('   ⚠️ Clique duplicado ignorado');
        return;
      }

      // Buscar contact_id
      const contactResult = await query(
        'SELECT id FROM contacts WHERE phone_number = $1 LIMIT 1',
        [phoneNumber]
      );
      const contactId = contactResult.rows[0]?.id || null;

      // Inserir clique
      await query(
        `INSERT INTO button_clicks (
          campaign_id, message_id, contact_id, phone_number, 
          button_text, button_payload, clicked_at, campaign_type
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), 'qr_connect')`,
        [campaignId, messageId, contactId, phoneNumber, buttonText, buttonPayload]
      );

      console.log('   ✅ Clique registrado!');

      // Atualizar contador da campanha
      if (campaignId) {
        await query(
          `UPDATE qr_campaigns 
           SET button_clicks_count = button_clicks_count + 1, updated_at = NOW()
           WHERE id = $1`,
          [campaignId]
        );
        console.log('   ✅ Contador de cliques atualizado!');
      }
    } catch (error: any) {
      console.error('❌ Erro ao registrar clique:', error);
    }
  }

  /**
   * Processar atualização de conexão
   */
  private async processConnectionUpdate(data: any, instanceName: string | null) {
    try {
      console.log('\n🔌 Processando CONNECTION UPDATE...');

      const status = data.state || data.status || data.connection;
      const isConnected = status === 'open' || status === 'connected' || status === true;

      console.log(`   📡 Instância: ${instanceName}`);
      console.log(`   🔗 Status: ${status} (${isConnected ? 'CONECTADO' : 'DESCONECTADO'})`);

      if (instanceName) {
        await query(
          `UPDATE uaz_instances 
           SET is_connected = $1, updated_at = NOW()
           WHERE name = $2 OR instance_token LIKE $3`,
          [isConnected, instanceName, `%${instanceName}%`]
        );
        console.log('   ✅ Status de conexão atualizado!');
      }
    } catch (error: any) {
      console.error('❌ Erro ao processar connection update:', error);
    }
  }

  /**
   * Processar atualização de status de mensagem (endpoint direto)
   * POST /api/qr-webhook/message-status
   */
  async processMessageStatus(req: Request, res: Response) {
    try {
      const { whatsapp_message_id, status, timestamp, error_message, instance_id } = req.body;

      console.log('📩 Webhook direto recebido:', { whatsapp_message_id, status, timestamp, instance_id });

      if (!whatsapp_message_id || !status) {
        return res.status(400).json({
          success: false,
          error: 'whatsapp_message_id e status são obrigatórios',
        });
      }

      // Usar o mesmo processamento do messages_update
      await this.processMessagesUpdate([{
        id: whatsapp_message_id,
        status: status,
        error: error_message
      }], instance_id);

      res.json({ success: true, message: 'Status atualizado com sucesso' });
    } catch (error: any) {
      console.error('❌ Erro ao processar webhook direto:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Processar clique em botão (endpoint direto)
   * POST /api/qr-webhook/button-click
   */
  async processButtonClick(req: Request, res: Response) {
    try {
      const { phone_number, button_text, button_payload, campaign_id, whatsapp_message_id } = req.body;

      console.log('👆 Clique em botão direto:', { phone_number, button_text, campaign_id });

      await this.registerButtonClick(
        phone_number,
        button_text,
        button_payload || '',
        whatsapp_message_id || null,
        null
      );

      res.json({ success: true, message: 'Clique registrado com sucesso' });
    } catch (error: any) {
      console.error('❌ Erro ao processar clique:', error);
      res.status(500).json({ success: false, error: error.message });
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
      events_supported: [
        'messages_update (status de entrega/leitura)',
        'messages (cliques em botões)',
        'connection (status de conexão)'
      ]
    });
  }

  /**
   * Verificar mensagem específica (para debug)
   * GET /api/qr-webhook/check-message/:messageId
   */
  async checkMessage(req: Request, res: Response) {
    try {
      const { messageId } = req.params;

      console.log(`🔍 Verificando mensagem: ${messageId}`);

      const messageResult = await query(
        `SELECT 
          m.id, m.campaign_id, m.instance_id, m.phone_number, m.template_name,
          m.status, m.whatsapp_message_id,
          m.sent_at, m.delivered_at, m.read_at, m.failed_at,
          m.error_message, m.created_at,
          c.name as campaign_name
         FROM qr_campaign_messages m
         LEFT JOIN qr_campaigns c ON m.campaign_id = c.id
         WHERE m.whatsapp_message_id = $1`,
        [messageId]
      );

      if (messageResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Mensagem não encontrada',
          hint: 'Verifique se o Message ID está correto'
        });
      }

      res.json({
        success: true,
        data: messageResult.rows[0]
      });
    } catch (error: any) {
      console.error('❌ Erro ao verificar mensagem:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Obter estatísticas de webhooks recentes
   * GET /api/qr-webhook/stats
   */
  async getStats(req: Request, res: Response) {
    try {
      // Estatísticas das últimas 24 horas
      const statsResult = await query(`
        SELECT 
          COUNT(*) as total_messages,
          COUNT(*) FILTER (WHERE status = 'sent') as sent,
          COUNT(*) FILTER (WHERE status = 'delivered') as delivered,
          COUNT(*) FILTER (WHERE status = 'read') as read,
          COUNT(*) FILTER (WHERE status = 'failed') as failed
        FROM qr_campaign_messages
        WHERE sent_at > NOW() - INTERVAL '24 hours'
      `);

      const clicksResult = await query(`
        SELECT COUNT(*) as total_clicks
        FROM button_clicks
        WHERE campaign_type = 'qr_connect'
        AND clicked_at > NOW() - INTERVAL '24 hours'
      `);

      res.json({
        success: true,
        period: '24 hours',
        data: {
          messages: statsResult.rows[0],
          clicks: parseInt(clicksResult.rows[0].total_clicks) || 0
        }
      });
    } catch (error: any) {
      console.error('❌ Erro ao obter estatísticas:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

export const qrWebhookController = new QrWebhookController();
