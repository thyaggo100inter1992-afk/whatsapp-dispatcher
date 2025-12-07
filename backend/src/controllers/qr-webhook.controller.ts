import { Request, Response } from 'express';
import { query } from '../database/connection';
import { tenantQuery } from '../database/tenant-query';

/**
 * Controller para processar webhooks de status de mensagens do WhatsApp QR Connect
 * Processa eventos da UAZAPI: messages_update, messages, connection, etc.
 */
export class QrWebhookController {

  /**
   * Executa query respeitando tenant (RLS); se não houver tenant, usa query padrão.
   */
  private async runTenantQuery(tenantId: number | undefined | null, text: string, params: any[] = []) {
    if (tenantId) {
      return tenantQuery({ tenant: { id: tenantId } } as any, text, params);
    }
    return query(text, params);
  }

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
      
      console.log("\n[UAZAPI] ===== WEBHOOK RECEBIDO =====");
      console.log("[UAZAPI] Payload:", JSON.stringify(payload, null, 2));

      const instanceName = payload.instance || payload.instanceName;
      const instanceToken = payload.token || payload.instance_token;
      const tenantId = (req as any).tenant?.id || (req as any).tenantIdFromWebhook || payload.tenant_id || payload.tenantId;

      if (tenantId && !(req as any).tenant) {
        (req as any).tenant = { id: tenantId };
      }

      const eventType = payload.EventType 
        || payload.type 
        || (typeof payload.event === "string" ? payload.event : null)
        || payload.event?.type 
        || payload.event?.EventType 
        || payload.event?.Type 
        || payload.data?.EventType 
        || payload.data?.type;

      const eventData = payload.data || payload.event?.data || payload.event || payload;

      console.log(`[UAZAPI] Instancia: ${instanceName}`);
      console.log(`[UAZAPI] Token: ${instanceToken}`);
      console.log(`[UAZAPI] Evento: ${eventType}`);

      let instanceId: number | null = null;
      if (instanceName || instanceToken) {
        let instanceResult;
        if (instanceToken) {
          instanceResult = await this.runTenantQuery(
            (req as any).tenant?.id,
            "SELECT id, name, tenant_id FROM uaz_instances WHERE instance_token = $1 LIMIT 1",
            [instanceToken]
          );
          console.log(`[UAZAPI] Busca por token: ${instanceToken} -> ${instanceResult.rows.length} resultado(s)`);
        }
        
        if (!instanceResult || instanceResult.rows.length === 0) {
          instanceResult = await this.runTenantQuery(
            (req as any).tenant?.id,
            "SELECT id, name, tenant_id FROM uaz_instances WHERE name = $1 LIMIT 1",
            [instanceName || ""]
          );
          console.log(`[UAZAPI] Busca por nome: "${instanceName}" -> ${instanceResult.rows.length} resultado(s)`);
        }
        
        if (instanceResult && instanceResult.rows.length > 0) {
          instanceId = instanceResult.rows[0].id;
          const instanceTenantId = instanceResult.rows[0].tenant_id;
          console.log(`[UAZAPI] Instancia encontrada: ID ${instanceId} (${instanceResult.rows[0].name}) - Tenant: ${instanceTenantId}`);
          (req as any).tenant = { id: instanceTenantId };
        } else {
          console.log(`[UAZAPI] Instancia nao encontrada - Nome: "${instanceName}", Token: ${instanceToken}`);
        }
      }

      switch (eventType) {
        case "messages_update":
        case "message_status":
        case "messages.update":
          await this.processMessagesUpdate(eventData, instanceId, (req as any).tenant?.id);
          break;

        case "messages":
        case "message":
          await this.processIncomingMessage(eventData, instanceId, (req as any).tenant?.id);
          break;

        case "connection":
        case "connection.update":
          await this.processConnectionUpdate(eventData, instanceName, (req as any).tenant?.id);
          break;

        default:
          console.log(`[UAZAPI] Evento nao processado: ${eventType}`);
      }

      console.log("[UAZAPI] ===== FIM DO WEBHOOK =====\n");

      res.json({ success: true, message: "Evento processado" });
    } catch (error: any) {
      console.error("[UAZAPI] Erro ao processar webhook:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Processar atualização de status de mensagem (messages_update)
   * Atualiza: delivered_count, read_count, failed_count
   */
  private async processMessagesUpdate(data: any, instanceId: number | null, tenantId?: number) {
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
        // UAZAPI: { MessageIDs: ['xxx'], Type: 'read' }
        
        let messageIds: string[] = [];
        
        // Se tem MessageIDs (formato UAZAPI), processar array
        if (update.MessageIDs && Array.isArray(update.MessageIDs)) {
          messageIds = update.MessageIDs;
        } else {
          // Formato único
          const singleId = update.id || update.key?.id || update.message?.id || update.messageId;
          if (singleId) messageIds = [singleId];
        }
        
        let status = update.Type || update.status || update.update?.status || update.state || update.State || data?.state || data?.State;
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

        // Normalizar string de status
        if (typeof status === 'string') {
          status = status.toLowerCase();
        }

        // Normalizar status
        if (status === 'delivery_ack' || status === 'delivery' || status === 'delivered') status = 'delivered';
        if (status === 'read' || status === 'viewed' || status === 'played') status = 'read';
        if (status === 'failed' || status === 'error') status = 'failed';
        if (status === 'sent' || status === 'server') status = 'sent';
        if (!status && data?.state) {
          const state = String(data.state).toLowerCase();
          if (state === 'delivered') status = 'delivered';
          if (state === 'read') status = 'read';
        }

        if (messageIds.length === 0) {
          console.log('⚠️ Message ID não encontrado no update:', update);
          continue;
        }

        console.log(`   📝 Message IDs (${messageIds.length}): ${messageIds.join(', ')}`);
        console.log(`   📊 Status: ${status}`);

        // Processar cada message ID
        for (const messageId of messageIds) {
          console.log(`      🔍 Processando Message ID: ${messageId}`);
          console.log(`      📊 Status para atualizar: ${status}`);
          
          // Buscar mensagem no banco (qr_campaign_messages)
          // A UAZAPI envia apenas a parte final do ID (ex: 3EB036AB542D136AF1A206)
          // Mas salvamos com prefixo (ex: 556298669726:3EB036AB542D136AF1A206)
          console.log(`      🔎 Query params: messageId="${messageId}", pattern="%:${messageId}"`);
          const messageResult = await this.runTenantQuery(
            tenantId,
            `SELECT id, campaign_id, status as current_status, instance_id, whatsapp_message_id
             FROM qr_campaign_messages 
             WHERE whatsapp_message_id = $1 OR whatsapp_message_id LIKE $2`,
            [messageId, `%:${messageId}`]
          );
          console.log(`      📊 Resultado da busca: ${messageResult.rows.length} mensagem(ns) encontrada(s)`);

        if (messageResult.rows.length === 0) {
          console.log(`   ⚠️ Mensagem não encontrada no banco: ${messageId}`);
          console.log(`   🔍 Buscando mensagens similares...`);
          const similarResult = await this.runTenantQuery(
            tenantId,
            `SELECT id, whatsapp_message_id, campaign_id, status 
             FROM qr_campaign_messages 
             WHERE whatsapp_message_id LIKE $1 
             LIMIT 5`,
            [`%${messageId.substring(0, 10)}%`]
          );
          console.log(`   📋 Mensagens similares encontradas: ${similarResult.rows.length}`);
          if (similarResult.rows.length > 0) {
            console.log(`   📝 IDs similares:`, similarResult.rows.map(r => r.whatsapp_message_id));
          }
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
          await this.runTenantQuery(
            tenantId,
            `UPDATE qr_campaign_messages 
             SET status = 'delivered', delivered_at = NOW(), updated_at = NOW()
             WHERE id = $1`,
            [message.id]
          );
          
          // Atualizar contador da campanha
          await this.runTenantQuery(
            tenantId,
            `UPDATE qr_campaigns 
             SET delivered_count = delivered_count + 1, updated_at = NOW()
             WHERE id = $1`,
            [campaignId]
          );
          
          console.log(`   ✅ Atualizado para DELIVERED`);

        } else if (status === 'read' || status === 'played') {
          // Se está passando de delivered para read, ajustar contadores
          if (currentStatus === 'delivered') {
            await this.runTenantQuery(
              tenantId,
              `UPDATE qr_campaigns 
               SET delivered_count = delivered_count - 1, 
                   read_count = read_count + 1, 
                   updated_at = NOW()
               WHERE id = $1`,
              [campaignId]
            );
          } else if (currentStatus !== 'read') {
            // Se estava como 'sent' (ou pending), contamos tanto delivered quanto read
            await this.runTenantQuery(
              tenantId,
              `UPDATE qr_campaigns 
               SET delivered_count = delivered_count + 1,
                   read_count = read_count + 1, 
                   updated_at = NOW()
               WHERE id = $1`,
              [campaignId]
            );
          }

          await this.runTenantQuery(
            tenantId,
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
          await this.runTenantQuery(
            tenantId,
            `UPDATE qr_campaign_messages 
             SET status = 'failed', 
                 failed_at = NOW(), 
                 error_message = $2,
                 updated_at = NOW()
             WHERE id = $1`,
            [message.id, errorMessage || 'Falha no envio']
          );
          
          // Atualizar contador da campanha
          await this.runTenantQuery(
            tenantId,
            `UPDATE qr_campaigns 
             SET failed_count = failed_count + 1, updated_at = NOW()
             WHERE id = $1`,
            [campaignId]
          );
          
          console.log(`   ❌ Atualizado para FAILED: ${errorMessage}`);
        }
        } // Fim do loop de messageIds
      } // Fim do loop de updates
    } catch (error: any) {
      console.error('❌ Erro ao processar messages_update:', error);
    }
  }

  /**
   * Processar mensagem recebida (messages)
   * Detecta cliques em botões, respostas de lista E salva no chat
   */
  private async processIncomingMessage(data: any, instanceId: number | null, tenantId?: number) {
    try {
      console.log('\n💬 Processando MENSAGEM RECEBIDA...');

      const messages = Array.isArray(data) ? data : [data];

      for (const msg of messages) {
        // Extrair informações
        const from = msg.from || msg.key?.remoteJid || msg.remoteJid;
        const messageType = msg.type || msg.messageType;
        const contextId = msg.context?.id || msg.contextInfo?.stanzaId;
        const messageId = msg.id || msg.key?.id;

        // Limpar número de telefone
        const phoneNumber = from?.replace('@s.whatsapp.net', '').replace('@c.us', '');

        console.log(`   📱 De: ${phoneNumber}`);
        console.log(`   📋 Tipo: ${messageType}`);
        console.log(`   🔗 Context ID: ${contextId}`);
        console.log(`   🆔 Message ID: ${messageId}`);

        // ===================================
        // 💬 SALVAR MENSAGEM NO CHAT
        // ===================================
        if (phoneNumber && tenantId) {
          await this.saveIncomingMessageToChat(
            phoneNumber,
            messageType,
            msg,
            messageId,
            instanceId,
            tenantId
          );
        }

        // ===================================
        // 👆 DETECTAR CLIQUES EM BOTÕES
        // ===================================
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
          await this.registerButtonClick(phoneNumber, buttonText, buttonPayload, contextId, instanceId, tenantId);
        }
      }
    } catch (error: any) {
      console.error('❌ Erro ao processar mensagem recebida:', error);
    }
  }

  /**
   * Salvar mensagem recebida no sistema de chat
   */
  private async saveIncomingMessageToChat(
    phoneNumber: string,
    messageType: string,
    msg: any,
    messageId: string,
    instanceId: number | null,
    tenantId: number
  ) {
    try {
      // Normalizar número de telefone (remover 9 extra se tiver)
      const { normalizePhoneNumber } = require('../utils/phone-normalizer');
      const normalizedPhone = normalizePhoneNumber(phoneNumber);
      
      console.log('\n💾 Salvando mensagem no chat...');
      console.log(`   📱 Telefone original: ${phoneNumber}`);
      console.log(`   📱 Telefone normalizado: ${normalizedPhone}`);

      // Extrair conteúdo da mensagem
      let messageContent = '';
      let mediaUrl = null;
      let mediaCaption = null;

      // Texto
      if (msg.text || msg.body || msg.content) {
        messageContent = msg.text || msg.body || msg.content;
      }

      // Mídia
      if (msg.mediaUrl || msg.media?.url) {
        mediaUrl = msg.mediaUrl || msg.media?.url;
        mediaCaption = msg.caption || msg.media?.caption;
      }

      // Imagem
      if (messageType === 'image' || messageType === 'imageMessage') {
        mediaUrl = msg.imageMessage?.url || msg.image?.url || mediaUrl;
        messageContent = msg.imageMessage?.caption || msg.caption || '[Imagem]';
      }

      // Vídeo
      if (messageType === 'video' || messageType === 'videoMessage') {
        mediaUrl = msg.videoMessage?.url || msg.video?.url || mediaUrl;
        messageContent = msg.videoMessage?.caption || msg.caption || '[Vídeo]';
      }

      // Áudio
      if (messageType === 'audio' || messageType === 'audioMessage' || messageType === 'ptt') {
        mediaUrl = msg.audioMessage?.url || msg.audio?.url || mediaUrl;
        messageContent = '[Áudio]';
      }

      // Documento
      if (messageType === 'document' || messageType === 'documentMessage') {
        mediaUrl = msg.documentMessage?.url || msg.document?.url || mediaUrl;
        messageContent = msg.documentMessage?.fileName || msg.document?.fileName || '[Documento]';
      }

      // Localização
      if (messageType === 'location' || messageType === 'locationMessage') {
        const lat = msg.location?.latitude || msg.locationMessage?.degreesLatitude;
        const lng = msg.location?.longitude || msg.locationMessage?.degreesLongitude;
        messageContent = `📍 Localização: ${lat}, ${lng}`;
      }

      // Sticker
      if (messageType === 'sticker' || messageType === 'stickerMessage') {
        messageContent = '[Sticker]';
        mediaUrl = msg.stickerMessage?.url || msg.sticker?.url || mediaUrl;
      }

      console.log(`   📝 Conteúdo: ${messageContent?.substring(0, 50)}...`);
      console.log(`   📎 Mídia: ${mediaUrl ? 'Sim' : 'Não'}`);

      // Buscar ou criar conversa
      let conversationId;
      const convCheck = await this.runTenantQuery(
        tenantId,
        'SELECT id FROM conversations WHERE phone_number = $1 AND tenant_id = $2',
        [normalizedPhone, tenantId]
      );

      if (convCheck.rows.length > 0) {
        conversationId = convCheck.rows[0].id;
        console.log(`   ✅ Conversa existente: ${conversationId}`);
      } else {
        // Criar nova conversa
        const newConv = await this.runTenantQuery(
          tenantId,
          `INSERT INTO conversations (
            phone_number,
            tenant_id,
            instance_id,
            unread_count,
            last_message_at,
            last_message_text,
            last_message_direction
          ) VALUES ($1, $2, $3, 1, NOW(), $4, 'inbound')
          RETURNING id`,
          [normalizedPhone, tenantId, instanceId, messageContent?.substring(0, 100) || '[Mensagem]']
        );
        conversationId = newConv.rows[0].id;
        console.log(`   ✨ Nova conversa criada: ${conversationId}`);
      }

      // Verificar se mensagem já foi salva (duplicação)
      const duplicate = await this.runTenantQuery(
        tenantId,
        'SELECT id FROM conversation_messages WHERE whatsapp_message_id = $1 AND tenant_id = $2',
        [messageId, tenantId]
      );

      if (duplicate.rows.length > 0) {
        console.log('   ⚠️ Mensagem já salva, ignorando duplicação');
        return;
      }

      // Salvar mensagem
      await this.runTenantQuery(
        tenantId,
        `INSERT INTO conversation_messages (
          conversation_id,
          message_direction,
          message_type,
          message_content,
          media_url,
          media_caption,
          whatsapp_message_id,
          tenant_id,
          is_read_by_agent
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          conversationId,
          'inbound',
          messageType || 'text',
          messageContent || null,
          mediaUrl || null,
          mediaCaption || null,
          messageId || null,
          tenantId,
          false // Não lida pelo agente
        ]
      );

      // Atualizar conversa
      await this.runTenantQuery(
        tenantId,
        `UPDATE conversations 
         SET last_message_at = NOW(),
             last_message_text = $1,
             last_message_direction = 'inbound',
             unread_count = unread_count + 1,
             updated_at = NOW()
         WHERE id = $2`,
        [messageContent?.substring(0, 100) || '[Mensagem]', conversationId]
      );

      console.log('   ✅ Mensagem salva no chat com sucesso!');

      // Emitir evento Socket.IO para atualização em tempo real
      try {
        const { io } = require('../server');
        if (io) {
          io.to(`tenant:${tenantId}`).emit('chat:new-message', {
            conversationId,
            phoneNumber: normalizedPhone,
            messageType,
            messageContent,
            direction: 'inbound',
            timestamp: new Date()
          });
          console.log('   📡 Evento Socket.IO emitido: chat:new-message');
        }
      } catch (ioError: any) {
        console.warn('⚠️ Erro ao emitir evento Socket.IO:', ioError.message);
      }

    } catch (error: any) {
      console.error('❌ Erro ao salvar mensagem no chat:', error);
      console.error('Stack:', error.stack);
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
    instanceId: number | null,
    tenantId?: number
  ) {
    try {
      console.log('\n👆 Registrando CLIQUE EM BOTÃO...');

      // Buscar campanha relacionada
      let campaignId: number | null = null;
      let messageId: number | null = null;

      if (contextMessageId) {
        const msgResult = await this.runTenantQuery(
          tenantId,
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
        const recentMsg = await this.runTenantQuery(
          tenantId,
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
      const existingClick = await this.runTenantQuery(
        tenantId,
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
      const contactResult = await this.runTenantQuery(
        tenantId,
        'SELECT id FROM contacts WHERE phone_number = $1 LIMIT 1',
        [phoneNumber]
      );
      const contactId = contactResult.rows[0]?.id || null;

      // Inserir clique
      await this.runTenantQuery(
        tenantId,
        `INSERT INTO button_clicks (
          campaign_id, message_id, contact_id, phone_number, 
          button_text, button_payload, clicked_at, campaign_type
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), 'qr_connect')`,
        [campaignId, messageId, contactId, phoneNumber, buttonText, buttonPayload]
      );

      console.log('   ✅ Clique registrado!');

      // Atualizar contador da campanha
      if (campaignId) {
        await this.runTenantQuery(
          tenantId,
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
  private async processConnectionUpdate(data: any, instanceName: string | null, tenantId?: number) {
    try {
      console.log('\n🔌 Processando CONNECTION UPDATE...');

      const status = data.state || data.status || data.connection;
      const isConnected = status === 'open' || status === 'connected' || status === true;

      console.log(`   📡 Instância: ${instanceName}`);
      console.log(`   🔗 Status: ${status} (${isConnected ? 'CONECTADO' : 'DESCONECTADO'})`);

      if (instanceName) {
        await this.runTenantQuery(
          tenantId,
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
      }], instance_id, (req as any).tenant?.id || (req as any).tenantIdFromWebhook);

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
        null,
        (req as any).tenant?.id || (req as any).tenantIdFromWebhook
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
