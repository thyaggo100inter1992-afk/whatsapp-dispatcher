import { Request, Response } from 'express';
import { tenantQuery, queryNoTenant } from '../database/tenant-query';

export class WebhookController {
  /**
   * GET /webhook - Verificação inicial do WhatsApp (handshake)
   * O WhatsApp envia isso uma vez para verificar se o endpoint está ativo
   */
  async verify(req: Request, res: Response) {
    try {
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];

      console.log('🔔 Webhook Verification Request:', { mode, token });

      // Verificar se o token está correto (mesmo configurado no Facebook)
      const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || 'seu_token_secreto_aqui';

      const success = mode === 'subscribe' && token === VERIFY_TOKEN;

      // Salvar log da verificação
      await queryNoTenant(
        `INSERT INTO webhook_logs 
         (request_type, request_method, verify_mode, verify_token, verify_challenge, 
          verification_success, request_query, request_headers, ip_address, user_agent, processed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
        [
          'verification',
          'GET',
          mode,
          token,
          challenge,
          success,
          JSON.stringify(req.query),
          JSON.stringify(req.headers),
          req.ip || req.socket.remoteAddress,
          req.get('user-agent')
        ]
      );

      if (success) {
        console.log('✅ Webhook verificado com sucesso!');
        res.status(200).send(challenge);
      } else {
        console.log('❌ Webhook verification failed!');
        res.sendStatus(403);
      }
    } catch (error: any) {
      console.error('❌ Erro na verificação do webhook:', error);
      res.sendStatus(500);
    }
  }

  /**
   * POST /webhook - Receber atualizações de status das mensagens
   */
  async receive(req: Request, res: Response) {
    let logId: number | null = null;
    let messagesProcessed = 0;
    let statusesProcessed = 0;
    let clicksDetected = 0;
    let processingStatus = 'success';
    let processingError: string | null = null;

    try {
      console.log('\n🔔 ===== WEBHOOK RECEBIDO =====');
      console.log('📦 Body completo:', JSON.stringify(req.body, null, 2));

      const body = req.body;

      // Obter tenant_id da rota (se disponível)
      const tenantId = (req as any).tenantIdFromWebhook || null;

      // Tentar extrair o phone_number_id ou business_phone_number para identificar a conta
      let whatsappAccountId: number | null = null;
      
      if (tenantId && body.entry && body.entry.length > 0) {
        const entry = body.entry[0];
        const changes = entry.changes || [];
        
        for (const change of changes) {
          const phoneNumberId = change.value?.metadata?.phone_number_id;
          const displayPhoneNumber = change.value?.metadata?.display_phone_number;
          
          if (phoneNumberId || displayPhoneNumber) {
            console.log('🔍 Buscando conta WhatsApp...');
            console.log('   Phone Number ID:', phoneNumberId);
            console.log('   Display Phone:', displayPhoneNumber);
            
            // Primeiro: tentar buscar pelo phone_number_id (mais confiável)
            if (phoneNumberId) {
              const accountByIdQuery = `
                SELECT id FROM whatsapp_accounts 
                WHERE tenant_id = $1 AND phone_number_id = $2
                LIMIT 1
              `;
              
              const accountByIdResult = await queryNoTenant(accountByIdQuery, [
                tenantId,
                phoneNumberId
              ]);
              
              if (accountByIdResult.rows.length > 0) {
                whatsappAccountId = accountByIdResult.rows[0].id;
                console.log('✅ Conta encontrada por phone_number_id:', whatsappAccountId);
                break;
              }
            }
            
            // Segundo: buscar pelo número com múltiplas variações
            if (displayPhoneNumber) {
              // Normalizar: remover todos os caracteres não numéricos
              const cleanNumber = displayPhoneNumber.replace(/\D/g, '');
              console.log('   Número limpo:', cleanNumber);
              
              // Gerar variações do número para busca
              const variations: string[] = [];
              
              // 1. Número original limpo
              variations.push(cleanNumber);
              
              // 2. Se começar com 55, adicionar sem o DDI
              if (cleanNumber.startsWith('55')) {
                const withoutDDI = cleanNumber.substring(2);
                variations.push(withoutDDI);
                
                // 3. Se tiver 11 dígitos após remover DDI (DDD + 9 dígitos), testar sem o 9
                if (withoutDDI.length === 11) {
                  const ddd = withoutDDI.substring(0, 2);
                  const numberPart = withoutDDI.substring(2);
                  if (numberPart.startsWith('9')) {
                    variations.push(ddd + numberPart.substring(1)); // Remove o 9
                  }
                }
              }
              
              // 4. Se NÃO começar com 55, adicionar COM o DDI
              if (!cleanNumber.startsWith('55')) {
                variations.push('55' + cleanNumber);
                
                // 5. Testar variações com/sem 9º dígito
                if (cleanNumber.length === 11) {
                  const ddd = cleanNumber.substring(0, 2);
                  const numberPart = cleanNumber.substring(2);
                  if (numberPart.startsWith('9')) {
                    variations.push(ddd + numberPart.substring(1)); // Remove o 9
                    variations.push('55' + ddd + numberPart.substring(1)); // Com DDI, sem 9
                  }
                } else if (cleanNumber.length === 10) {
                  const ddd = cleanNumber.substring(0, 2);
                  const numberPart = cleanNumber.substring(2);
                  variations.push(ddd + '9' + numberPart); // Adiciona o 9
                  variations.push('55' + ddd + '9' + numberPart); // Com DDI e 9
                }
              }
              
              console.log('   Variações de busca:', variations);
              
              // Buscar conta com qualquer uma das variações
              const accountByPhoneQuery = `
                SELECT id FROM whatsapp_accounts 
                WHERE tenant_id = $1 
                AND phone_number = ANY($2)
                LIMIT 1
              `;
              
              const accountByPhoneResult = await queryNoTenant(accountByPhoneQuery, [
                tenantId,
                variations
              ]);
              
              if (accountByPhoneResult.rows.length > 0) {
                whatsappAccountId = accountByPhoneResult.rows[0].id;
                console.log('✅ Conta encontrada por phone_number:', whatsappAccountId);
              } else {
                console.log('⚠️ Conta WhatsApp não encontrada com nenhuma variação');
                console.log('⚠️ Números no banco podem estar em formato diferente');
              }
            }
            
            break; // Encontrou as informações, não precisa continuar o loop
          }
        }
      }

      // Criar log inicial do webhook COM whatsapp_account_id
      const logResult = await queryNoTenant(
        `INSERT INTO webhook_logs 
         (tenant_id, whatsapp_account_id, request_type, request_method, webhook_object, request_body, 
          request_headers, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id`,
        [
          tenantId,
          whatsappAccountId,
          'notification',
          'POST',
          body.object,
          JSON.stringify(body),
          JSON.stringify(req.headers),
          req.ip || req.socket.remoteAddress,
          req.get('user-agent')
        ]
      );

      logId = logResult.rows[0].id;

      // Verificar se é uma notificação do WhatsApp Business
      if (body.object !== 'whatsapp_business_account') {
        console.log('⚠️ Não é uma notificação do WhatsApp Business');
        processingStatus = 'failed';
        processingError = 'Not a WhatsApp Business notification';
        
        await queryNoTenant(
          `UPDATE webhook_logs 
           SET processing_status = $1, processing_error = $2, processed_at = NOW()
           WHERE id = $3`,
          [processingStatus, processingError, logId]
        );
        
        return res.sendStatus(200); // Sempre retornar 200 para não receber de novo
      }

      // Processar cada entrada (pode haver múltiplas atualizações)
      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          if (change.field === 'messages') {
            // Passar whatsappAccountId e tenantId identificados no início do webhook
            const result = await this.processMessageUpdate(change.value, whatsappAccountId, tenantId);
            messagesProcessed += result.messages || 0;
            statusesProcessed += result.statuses || 0;
            clicksDetected += result.clicks || 0;
          } else if (change.field === 'message_template_status_update') {
            // Processar atualização de status de template
            await this.processTemplateStatusUpdate(change.value, entry.id);
          }
        }
      }

      console.log('✅ Webhook processado com sucesso!');
      console.log('================================\n');

      // Atualizar log com resultados
      await queryNoTenant(
        `UPDATE webhook_logs 
         SET processing_status = $1, messages_processed = $2, 
             statuses_processed = $3, clicks_detected = $4, processed_at = NOW()
         WHERE id = $5`,
        [processingStatus, messagesProcessed, statusesProcessed, clicksDetected, logId]
      );

      // IMPORTANTE: Sempre retornar 200 para o WhatsApp
      res.sendStatus(200);
    } catch (error: any) {
      console.error('❌ Erro ao processar webhook:', error);
      processingStatus = 'failed';
      processingError = error.message;

      // Atualizar log com erro
      if (logId) {
        await queryNoTenant(
          `UPDATE webhook_logs 
           SET processing_status = $1, processing_error = $2, processed_at = NOW()
           WHERE id = $3`,
          [processingStatus, processingError, logId]
        );
      }

      // Mesmo com erro, retornar 200 para não receber novamente
      res.sendStatus(200);
    }
  }

  /**
   * Processar atualização de status de mensagem
   * @param value - O valor do webhook
   * @param identifiedWhatsappAccountId - O ID da conta WhatsApp identificado pelo display_phone_number do webhook
   * @param identifiedTenantId - O ID do tenant identificado
   */
  private async processMessageUpdate(
    value: any, 
    identifiedWhatsappAccountId: number | null, 
    identifiedTenantId: number | null
  ): Promise<{messages: number, statuses: number, clicks: number}> {
    let messagesCount = 0;
    let statusesCount = 0;
    let clicksCount = 0;

    try {
      console.log('\n🔍 [DEBUG] processMessageUpdate chamado');
      console.log('🔍 [DEBUG] value.messages existe?', !!value.messages);
      console.log('🔍 [DEBUG] value.statuses existe?', !!value.statuses);
      console.log('🔍 [DEBUG] identifiedWhatsappAccountId:', identifiedWhatsappAccountId);
      console.log('🔍 [DEBUG] identifiedTenantId:', identifiedTenantId);
      
      // Processar CLIQUES EM BOTÕES (mensagens interativas)
      const messages = value.messages || [];
      messagesCount = messages.length;
      
      console.log(`🔍 [DEBUG] Total de mensagens: ${messages.length}`);
      
      for (const message of messages) {
        console.log(`🔍 [DEBUG] Tipo da mensagem: ${message.type}`);
        console.log(`🔍 [DEBUG] Tem .interactive?`, !!message.interactive);
        
        // Detectar cliques em botões (tipos: 'interactive', 'button')
        if (message.type === 'interactive' || message.type === 'button' || message.interactive) {
          console.log('\n👆 ===== CLIQUE EM BOTÃO DETECTADO =====');
          await this.processButtonClick(message, value, identifiedWhatsappAccountId, identifiedTenantId);
          clicksCount++;
        } 
        // Processar mensagens de texto (para palavras-chave)
        else if (message.type === 'text') {
          console.log('\n💬 ===== MENSAGEM DE TEXTO DETECTADA =====');
          await this.processTextMessage(message, value, identifiedWhatsappAccountId, identifiedTenantId);
        }
        // Processar mensagens de MÍDIA (imagem, áudio, vídeo, documento, sticker)
        else if (['image', 'audio', 'video', 'document', 'sticker', 'voice'].includes(message.type)) {
          console.log(`\n📎 ===== MENSAGEM DE MÍDIA DETECTADA (${message.type}) =====`);
          await this.processMediaMessage(message, value, identifiedWhatsappAccountId, identifiedTenantId);
        }
        // Processar localização
        else if (message.type === 'location') {
          console.log('\n📍 ===== LOCALIZAÇÃO DETECTADA =====');
          await this.processLocationMessage(message, value, identifiedWhatsappAccountId, identifiedTenantId);
        }
        // Processar contatos compartilhados
        else if (message.type === 'contacts') {
          console.log('\n👤 ===== CONTATO COMPARTILHADO DETECTADO =====');
          await this.processContactMessage(message, value, identifiedWhatsappAccountId, identifiedTenantId);
        }
        else {
          console.log(`ℹ️ Mensagem ignorada (tipo: ${message.type})`);
        }
      }
      
      // Processar STATUS das mensagens
      const statuses = value.statuses || [];
      statusesCount = statuses.length;

      console.log(`\n🔍 [DEBUG] Total de statuses para processar: ${statuses.length}`);

      for (const status of statuses) {
        const messageId = status.id; // wamid.xxx
        const newStatus = status.status; // sent, delivered, read, failed
        const timestamp = status.timestamp;
        const recipientId = status.recipient_id;

        console.log('\n📨 Status Update:');
        console.log('   Message ID:', messageId);
        console.log('   Novo Status:', newStatus);
        console.log('   Para:', recipientId);
        console.log('   Timestamp:', new Date(parseInt(timestamp) * 1000).toLocaleString());

        console.log('🔍 [DEBUG] Buscando mensagem no banco...');
        // Buscar mensagem no banco
        const messageResult = await queryNoTenant(
          'SELECT * FROM messages WHERE whatsapp_message_id = $1',
          [messageId]
        );

        console.log(`🔍 [DEBUG] Mensagens encontradas: ${messageResult.rows.length}`);

        if (messageResult.rows.length === 0) {
          console.log('⚠️ Mensagem não encontrada no banco:', messageId);
          continue;
        }

        const message = messageResult.rows[0];
        console.log('   Mensagem encontrada - ID:', message.id);
        console.log('   Status atual:', message.status);

        // Atualizar status da mensagem (SOMENTE se for diferente)
        const oldStatus = message.status;
        
        if (newStatus === 'delivered' && oldStatus !== 'delivered' && oldStatus !== 'read') {
          await queryNoTenant(
            `UPDATE messages 
             SET status = 'delivered', delivered_at = NOW() 
             WHERE whatsapp_message_id = $1`,
            [messageId]
          );
          console.log('   ✅ Status atualizado: delivered');

          // Atualizar contador da campanha (SOMENTE se mudou de status)
          if (message.campaign_id) {
            await queryNoTenant(
              'UPDATE campaigns SET delivered_count = delivered_count + 1 WHERE id = $1',
              [message.campaign_id]
            );
            console.log('   ✅ Contador de entregues atualizado!');
          }
        } else if (newStatus === 'read' && oldStatus !== 'read') {
          // ⚠️ IMPORTANTE: Uma mensagem 'read' sempre foi 'delivered' antes
          // Garantir que delivered_at seja preenchido se ainda não foi
          await queryNoTenant(
            `UPDATE messages 
             SET status = 'read', 
                 read_at = NOW(),
                 delivered_at = COALESCE(delivered_at, NOW())
             WHERE whatsapp_message_id = $1`,
            [messageId]
          );
          console.log('   ✅ Status atualizado: read (delivered_at garantido)');

          // Atualizar contador da campanha (SOMENTE se mudou de status)
          if (message.campaign_id) {
            // ⚠️ CORREÇÃO: Uma mensagem 'read' SEMPRE foi 'delivered' antes
            // Precisamos garantir que delivered_count seja consistente
            if (oldStatus === 'delivered') {
              // Se já estava como delivered, apenas transferir de delivered para read
              await queryNoTenant(
                'UPDATE campaigns SET delivered_count = delivered_count - 1, read_count = read_count + 1 WHERE id = $1',
                [message.campaign_id]
              );
              console.log('   ✅ Transferido de delivered → read');
            } else {
              // Se não estava como delivered (veio de 'sent' direto para 'read'),
              // incrementar AMBOS: delivered E read (porque read implica delivered)
              // MAS como read é o status final, contamos apenas como read
              await queryNoTenant(
                'UPDATE campaigns SET read_count = read_count + 1 WHERE id = $1',
                [message.campaign_id]
              );
              console.log('   ✅ Incrementado read (pulou delivered)');
            }
          }
        } else if (newStatus === 'failed' && oldStatus !== 'failed' && oldStatus !== 'no_whatsapp') {
          const errorCode = status.errors?.[0]?.code || 'unknown';
          const errorTitle = status.errors?.[0]?.title || 'Unknown error';
          const errorMessage = status.errors?.[0]?.message || 'No details';
          const fullErrorMsg = `${errorTitle}: ${errorMessage} (Code: ${errorCode})`;

          console.log('   ❌ FALHA NA ENTREGA:');
          console.log('      Código:', errorCode);
          console.log('      Título:', errorTitle);
          console.log('      Mensagem:', errorMessage);

          // Verificar se é erro de número sem WhatsApp (código 131026 = Message undeliverable)
          const noWhatsappCodes = [131026, 131047];
          const isNoWhatsApp = noWhatsappCodes.includes(Number(errorCode)) ||
            errorTitle.toLowerCase().includes('undeliverable') ||
            errorMessage.toLowerCase().includes('undeliverable') ||
            String(errorCode) === '131026';

          const finalStatus = isNoWhatsApp ? 'no_whatsapp' : 'failed';

          await queryNoTenant(
            `UPDATE messages 
             SET status = $2, 
                 error_message = $3,
                 failed_at = NOW()
             WHERE whatsapp_message_id = $1`,
            [messageId, finalStatus, fullErrorMsg]
          );
          console.log(`   ✅ Status atualizado: ${finalStatus}`);

          // Atualizar contadores da campanha
          if (message.campaign_id) {
            if (isNoWhatsApp) {
              await queryNoTenant(
                'UPDATE campaigns SET failed_count = failed_count + 1, no_whatsapp_count = no_whatsapp_count + 1 WHERE id = $1',
                [message.campaign_id]
              );
              console.log('   ✅ Contadores atualizados: failed_count+1, no_whatsapp_count+1');

              // Adicionar automaticamente à lista de restrição "Sem WhatsApp"
              if (message.phone_number && message.whatsapp_account_id && message.tenant_id) {
                try {
                  const phoneNumber = message.phone_number;
                  const whatsappAccountId = message.whatsapp_account_id;
                  const tenantId = message.tenant_id;

                  const checkExisting = await queryNoTenant(
                    `SELECT id FROM restriction_list_entries 
                     WHERE list_type = 'no_whatsapp' 
                       AND phone_number = $1 
                       AND tenant_id = $2`,
                    [phoneNumber, tenantId]
                  );

                  if (checkExisting.rows.length === 0) {
                    await queryNoTenant(
                      `INSERT INTO restriction_list_entries 
                       (list_type, whatsapp_account_id, phone_number, added_method, notes, tenant_id, added_at)
                       VALUES ('no_whatsapp', $1, $2, 'auto_webhook', $3, $4, NOW())`,
                      [whatsappAccountId, phoneNumber, `Webhook: ${fullErrorMsg.substring(0, 200)}`, tenantId]
                    );
                    console.log(`   📵 Número ${phoneNumber} adicionado à lista Sem WhatsApp (via webhook)`);
                  } else {
                    console.log(`   ℹ️ Número ${phoneNumber} já estava na lista Sem WhatsApp`);
                  }
                } catch (listErr: any) {
                  console.error('   ⚠️ Erro ao adicionar à lista Sem WhatsApp:', listErr.message);
                }
              }
            } else {
              await queryNoTenant(
                'UPDATE campaigns SET failed_count = failed_count + 1 WHERE id = $1',
                [message.campaign_id]
              );
              console.log('   ✅ Contador de falhas atualizado!');
            }
          }
        } else if (newStatus === oldStatus) {
          console.log('   ℹ️ Status duplicado ignorado:', newStatus, '(já era', oldStatus + ')');
        } else {
          console.log('   ℹ️ Status não processado:', newStatus);
        }
      }

      return { messages: messagesCount, statuses: statusesCount, clicks: clicksCount };
    } catch (error: any) {
      console.error('❌ Erro ao processar atualização:', error);
      return { messages: messagesCount, statuses: statusesCount, clicks: clicksCount };
    }
  }

  /**
   * Processar cliques em botões
   * @param identifiedWhatsappAccountId - O ID da conta WhatsApp identificado pelo webhook
   * @param identifiedTenantId - O ID do tenant identificado pelo webhook
   */
  private async processButtonClick(
    message: any, 
    value: any,
    identifiedWhatsappAccountId: number | null,
    identifiedTenantId: number | null
  ) {
    try {
      const from = message.from; // Telefone de quem clicou
      const timestamp = message.timestamp;
      const interactive = message.interactive;

      console.log('📋 Dados do clique:');
      console.log('   De:', from);
      console.log('   Timestamp:', new Date(parseInt(timestamp) * 1000).toLocaleString());
      console.log('   🎯 WhatsApp Account ID (do webhook):', identifiedWhatsappAccountId);
      console.log('   🎯 Tenant ID (do webhook):', identifiedTenantId);
      console.log('   Mensagem completa:', JSON.stringify(message, null, 2));

      // Extrair informações do botão clicado
      let buttonText = '';
      let buttonPayload = '';
      let buttonType = '';

      // Tentar extrair de message.interactive (formato padrão)
      if (interactive) {
        if (interactive.type === 'button_reply') {
          buttonText = interactive.button_reply?.title || '';
          buttonPayload = interactive.button_reply?.id || '';
          buttonType = 'button_reply';
        } else if (interactive.type === 'list_reply') {
          buttonText = interactive.list_reply?.title || '';
          buttonPayload = interactive.list_reply?.id || '';
          buttonType = 'list_reply';
        }
      } 
      // Tentar extrair de message.button (formato alternativo)
      else if (message.button) {
        buttonText = message.button.text || message.button.title || '';
        buttonPayload = message.button.payload || message.button.id || '';
        buttonType = 'button';
      }
      // Se for tipo 'button' mas não tem o campo, tentar extrair do texto
      else if (message.type === 'button' && message.text) {
        buttonText = message.text.body || '';
        buttonPayload = 'button_click';
        buttonType = 'button_text';
      }

      console.log('   👆 Botão clicado:', buttonText);
      console.log('   📦 Payload:', buttonPayload);
      console.log('   📝 Tipo:', buttonType);

      // Criar variações do número para busca (com e sem o 9)
      const { normalizePhoneNumber } = require('../utils/phone-normalizer');
      let phoneVariations = [from, normalizePhoneNumber(from)].filter(Boolean);
      
      if (from.startsWith('55') && from.length >= 12) {
        const ddi = from.substring(0, 2);
        const ddd = from.substring(2, 4);
        const localNumber = from.substring(4);
        if (localNumber.length === 8) {
          phoneVariations.push(`${ddi}${ddd}9${localNumber}`);
        } else if (localNumber.length === 9 && localNumber.startsWith('9')) {
          phoneVariations.push(`${ddi}${ddd}${localNumber.substring(1)}`);
        }
      }
      phoneVariations = [...new Set(phoneVariations)];
      console.log('   📱 Variações de número para busca:', phoneVariations);

      // Buscar contato pelo telefone (todas as variações — WhatsApp às vezes omite o 9)
      const contactResult = await queryNoTenant(
        `SELECT id, name FROM contacts
         WHERE phone_number = ANY($1)
         ORDER BY CASE WHEN cpf IS NOT NULL AND cpf <> '' THEN 0 ELSE 1 END
         LIMIT 1`,
        [phoneVariations]
      );

      let contact = contactResult.rows[0];
      let contactId = contact?.id || null;
      let contactName = contact?.name || null;

      console.log('   👤 Contato encontrado:', contactName || 'Não cadastrado', `(ID: ${contactId})`);

      // Tentar buscar pela mensagem usando o context.id (WhatsApp Message ID)
      const contextMessageId = message.context?.id;
      let messageResult;
      
      if (contextMessageId) {
        console.log('   🔍 Buscando mensagem pelo WhatsApp Message ID:', contextMessageId);
        messageResult = await queryNoTenant(
          `SELECT m.*, c.id as campaign_id, c.name as campaign_name
           FROM messages m
           LEFT JOIN campaigns c ON m.campaign_id = c.id
           WHERE m.whatsapp_message_id = $1
           LIMIT 1`,
          [contextMessageId]
        );
      }
      
      // Se não encontrou pelo context, busca pela última mensagem do número (variações)
      if (!messageResult || messageResult.rows.length === 0) {
        console.log('   🔍 Buscando última mensagem enviada para (variações):', phoneVariations);
        messageResult = await queryNoTenant(
          `SELECT m.*, c.id as campaign_id, c.name as campaign_name
           FROM messages m
           LEFT JOIN campaigns c ON m.campaign_id = c.id
           WHERE m.phone_number = ANY($1)
           ORDER BY m.sent_at DESC
           LIMIT 1`,
          [phoneVariations]
        );
      }

      const sentMessage = messageResult.rows[0];
      const campaignId = sentMessage?.campaign_id || null;
      const campaignName = sentMessage?.campaign_name || null;
      const messageId = sentMessage?.id || null;

      // Fallback: se o clique veio sem o 9º dígito e o contato não bateu, usa o da mensagem
      if (!contactId && sentMessage?.contact_id) {
        contactId = sentMessage.contact_id;
        console.log('   👤 Contato herdado da mensagem:', contactId);
      }

      console.log('   📨 Mensagem ID:', messageId);
      console.log('   📨 Campanha:', campaignName || 'Envio Imediato', `(ID: ${campaignId || 'NULL'})`);

      // Salvar o clique na tabela button_clicks
      await queryNoTenant(
        `INSERT INTO button_clicks 
         (campaign_id, message_id, contact_id, phone_number, contact_name, 
          button_text, button_payload, clicked_at, campaign_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), 'whatsapp_api')`,
        [
          campaignId,
          messageId,
          contactId,
          from,
          contactName,
          buttonText,
          buttonPayload
        ]
      );

      console.log('   ✅ Clique registrado na tabela button_clicks!');

      // Atualizar contador de cliques da campanha
      if (campaignId) {
        await queryNoTenant(
          'UPDATE campaigns SET button_clicks_count = button_clicks_count + 1 WHERE id = $1',
          [campaignId]
        );
        console.log('   ✅ Contador de cliques da campanha atualizado!');
      }

      // ============================================================
      // 🆕 VERIFICAR LISTAS DE RESTRIÇÃO
      // ============================================================
      // Usar o whatsappAccountId do webhook ou fallback para o da mensagem
      const accountIdForRestriction = identifiedWhatsappAccountId || sentMessage?.whatsapp_account_id;
      await this.checkAndAddToRestrictionList(
        from,
        buttonText,
        buttonPayload,
        accountIdForRestriction,
        campaignId,
        messageId,
        contactName
      );

      // ============================================================
      // 💬 SALVAR CLIQUE NO CHAT
      // ============================================================
      // PRIORIZAR o ID identificado pelo webhook (mais confiável!)
      const chatAccountId = identifiedWhatsappAccountId || sentMessage?.whatsapp_account_id;
      const chatTenantId = identifiedTenantId || sentMessage?.tenant_id;
      
      if (chatAccountId && chatTenantId) {
        console.log('   💬 Salvando clique no chat...');
        console.log('   🎯 Usando WhatsApp Account ID:', chatAccountId, '(webhook:', identifiedWhatsappAccountId, ', mensagem:', sentMessage?.whatsapp_account_id, ')');
        await this.saveButtonClickToChat(
          from,
          buttonText,
          buttonPayload,
          buttonType,
          message.id || null,
          chatAccountId,
          chatTenantId
        );
        console.log('   ✅ Clique salvo no chat!');
      } else {
        console.log('   ⚠️ Não foi possível salvar no chat (falta whatsapp_account_id ou tenant_id)');
      }

      console.log('================================\n');

    } catch (error: any) {
      console.error('❌ Erro ao processar clique:', error);
    }
  }

  /**
   * Salvar clique de botão no sistema de chat
   */
  private async saveButtonClickToChat(
    phoneNumber: string,
    buttonText: string,
    buttonPayload: string,
    buttonType: string,
    messageId: string | null,
    whatsappAccountId: number,
    tenantId: number
  ) {
    try {
      const { normalizePhoneNumber } = require('../utils/phone-normalizer');
      const normalizedPhone = normalizePhoneNumber(phoneNumber);
      
      console.log(`   📱 Telefone: ${normalizedPhone}`);
      console.log(`   👆 Botão: ${buttonText}`);

      // Buscar conversa ATIVA
      let conversationId;
      const convCheck = await queryNoTenant(
        `SELECT id, status, is_archived FROM conversations 
         WHERE phone_number = $1 AND tenant_id = $2 AND whatsapp_account_id = $3 
         AND (status != 'archived' AND is_archived = false)
         ORDER BY created_at DESC LIMIT 1`,
        [normalizedPhone, tenantId, whatsappAccountId]
      );

      if (convCheck.rows.length > 0) {
        conversationId = convCheck.rows[0].id;
        // Atualizar status para pending se estava em broadcast
        if (convCheck.rows[0].status === 'broadcast') {
          await queryNoTenant(
            `UPDATE conversations SET status = 'pending', updated_at = NOW() WHERE id = $1`,
            [conversationId]
          );
        }
      } else {
        // Criar nova conversa
        const newConv = await queryNoTenant(
          `INSERT INTO conversations (
            phone_number, tenant_id, whatsapp_account_id, unread_count,
            last_message_at, last_message_text, last_message_direction, status, is_archived
          ) VALUES ($1, $2, $3, 1, NOW(), $4, 'inbound', 'pending', false)
          RETURNING id`,
          [normalizedPhone, tenantId, whatsappAccountId, `👆 ${buttonText}`]
        );
        conversationId = newConv.rows[0].id;
      }

      // Salvar mensagem do clique
      await queryNoTenant(
        `INSERT INTO conversation_messages (
          conversation_id, message_direction, message_type, message_content,
          button_text, button_payload, whatsapp_message_id, tenant_id, is_read_by_agent
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          conversationId,
          'inbound',
          buttonType || 'button',
          buttonText,
          buttonText,
          buttonPayload,
          messageId,
          tenantId,
          false
        ]
      );

      // Atualizar conversa
      await queryNoTenant(
        `UPDATE conversations 
         SET last_message_at = NOW(), last_message_text = $1, last_message_direction = 'inbound',
             unread_count = unread_count + 1, updated_at = NOW()
         WHERE id = $2`,
        [`👆 ${buttonText}`, conversationId]
      );

      // Emitir Socket.IO
      try {
        const { io } = require('../server');
        if (io) {
          io.to(`tenant:${tenantId}`).emit('chat:new-message', {
            conversationId,
            phoneNumber: normalizedPhone,
            messageType: 'button',
            messageContent: buttonText,
            direction: 'inbound',
            timestamp: new Date()
          });
        }
      } catch (socketError) {
        console.error('   ❌ Erro Socket.IO:', socketError);
      }

    } catch (error: any) {
      console.error('❌ Erro ao salvar clique no chat:', error);
    }
  }

  /**
   * Verificar se deve adicionar contato a alguma lista de restrição
   * Baseado em palavras-chave ou payloads configurados
   * 🆕 AGORA REGISTRA TODOS OS CLIQUES, MESMO SEM PALAVRA-CHAVE!
   */
  private async checkAndAddToRestrictionList(
    phoneNumber: string,
    buttonText: string,
    buttonPayload: string,
    whatsappAccountId: number | null,
    campaignId: number | null,
    messageId: number | null,
    contactName: string | null
  ) {
    try {
      if (!whatsappAccountId) {
        console.log('⚠️ Conta WhatsApp não identificada, pulando verificação de listas de restrição');
        return;
      }

      console.log('\n🔍 Verificando listas de restrição...');
      console.log('   Texto:', buttonText);
      console.log('   Payload:', buttonPayload);

      // Buscar palavras-chave ativas desta conta OU globais (todas as contas)
      const keywordsResult = await queryNoTenant(
        `SELECT * FROM restriction_list_keywords 
         WHERE (whatsapp_account_id = $1 OR whatsapp_account_id IS NULL)
         AND is_active = true`,
        [whatsappAccountId]
      );

      console.log(`   📋 ${keywordsResult.rows.length} palavras-chave ativas encontradas`);

      let matchFound = false;

      for (const keyword of keywordsResult.rows) {
        let match = false;
        let matchedValue = '';

        // Verificar tipo de palavra-chave
        if (keyword.keyword_type === 'button_text' && buttonText) {
          match = this.matchKeyword(buttonText, keyword.keyword, keyword.match_type, keyword.case_sensitive);
          matchedValue = buttonText;
        } else if (keyword.keyword_type === 'button_payload' && buttonPayload) {
          match = this.matchKeyword(buttonPayload, keyword.keyword, keyword.match_type, keyword.case_sensitive);
          matchedValue = buttonPayload;
        }

        if (match) {
          matchFound = true;
          console.log(`   ✅ Match encontrado! Palavra-chave: "${keyword.keyword}" (${keyword.keyword_type})`);
          console.log(`   📝 Lista de destino: ${keyword.list_type}`);

          // Verificar se já existe na lista
          const existingCheck = await queryNoTenant(
            `SELECT id FROM restriction_list_entries 
             WHERE list_type = $1 
             AND whatsapp_account_id = $2 
             AND (phone_number = $3 OR phone_number_alt = $3)
             AND (expires_at IS NULL OR expires_at > NOW())`,
            [keyword.list_type, whatsappAccountId, phoneNumber]
          );

          if (existingCheck.rows.length > 0) {
            console.log('   ℹ️ Contato já está nesta lista, pulando...');
            continue;
          }

          // Limpar número (remover caracteres não numéricos)
          const cleanPhone = phoneNumber.replace(/\D/g, '');
          
          if (!cleanPhone) {
            console.log('   ⚠️ Número de telefone vazio');
            continue;
          }

          // Buscar tenant_id da conta WhatsApp
          const accountResult = await queryNoTenant(
            `SELECT tenant_id FROM whatsapp_accounts WHERE id = $1`,
            [whatsappAccountId]
          );

          const tenantId = accountResult.rows[0]?.tenant_id;
          
          if (!tenantId) {
            console.log('   ⚠️ Tenant ID não encontrado para a conta WhatsApp');
            continue;
          }

          // Buscar configuração de dias de retenção da lista
          const listTypeResult = await queryNoTenant(
            `SELECT retention_days FROM restriction_list_types WHERE id = $1`,
            [keyword.list_type]
          );

          const retentionDays = listTypeResult.rows[0]?.retention_days;
          let expiresAt = null;

          if (retentionDays !== null && retentionDays !== undefined) {
            // Calcular data de expiração
            const now = new Date();
            expiresAt = new Date(now.getTime() + retentionDays * 24 * 60 * 60 * 1000);
          }

          // VERSÃO 1: Registrar o número EXATAMENTE como chegou do WhatsApp
          const version1 = cleanPhone; // Ex: 5511930284611
          
          // REGRA: Nome e CPF devem ser o número de telefone (igual ao registro manual)
          const finalName = version1;
          const finalNotes = `CPF: ${version1}`;
          
          await queryNoTenant(
            `INSERT INTO restriction_list_entries 
             (tenant_id, list_type, whatsapp_account_id, phone_number, phone_number_alt, 
              contact_name, keyword_matched, button_payload, button_text, 
              added_method, campaign_id, message_id, notes, expires_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
            [
              tenantId,
              keyword.list_type,
              whatsappAccountId,
              version1,
              null,
              finalName,
              keyword.keyword,
              buttonPayload,
              buttonText,
              'webhook_button',
              campaignId,
              messageId,
              finalNotes,
              expiresAt,
            ]
          );

          console.log(`   ✅ Versão 1 (original) adicionada: ${version1}`);

          // VERSÃO 2: Adicionar um 9 no número local (após o DDD)
          // Ex: 5511930284611 -> 55119930284611
          let version2 = null;
          
          // Se o número tem DDI (55) e tem pelo menos DDD + número
          if (cleanPhone.startsWith('55') && cleanPhone.length >= 12) {
            // Extrair partes: 55 + DDD (2 dígitos) + número local
            const ddi = cleanPhone.substring(0, 2); // 55
            const ddd = cleanPhone.substring(2, 4); // 11
            const localNumber = cleanPhone.substring(4); // 930284611
            
            // Adicionar um 9 no início do número local
            version2 = `${ddi}${ddd}9${localNumber}`; // 55 + 11 + 9 + 930284611 = 55119930284611
            
            // Nome e CPF também devem ser o número (versão 2)
            const finalName2 = version2;
            const finalNotes2 = `CPF: ${version2}`;
            
            await queryNoTenant(
              `INSERT INTO restriction_list_entries 
               (tenant_id, list_type, whatsapp_account_id, phone_number, phone_number_alt, 
                contact_name, keyword_matched, button_payload, button_text, 
                added_method, campaign_id, message_id, notes, expires_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
              [
                tenantId,
                keyword.list_type,
                whatsappAccountId,
                version2,
                null,
                finalName2,
                keyword.keyword,
                buttonPayload,
                buttonText,
                'webhook_button',
                campaignId,
                messageId,
                finalNotes2,
                expiresAt,
              ]
            );

            console.log(`   ✅ Versão 2 (+9 extra) adicionada: ${version2}`);
          }

          console.log(`   ✅ Contato adicionado à lista "${keyword.list_type}" com 2 versões!`);

        }
      }

      // ============================================================
      // ✅ SE NÃO ENCONTROU PALAVRA-CHAVE, APENAS INFORMAR
      // NÃO ADICIONAR EM NENHUMA LISTA!
      // ============================================================
      if (!matchFound) {
        console.log('   ℹ️ Nenhuma palavra-chave correspondente encontrada');
        console.log('   ✅ Clique registrado apenas no button_clicks (não adiciona à lista)');
      }

    } catch (error: any) {
      console.error('❌ Erro ao verificar listas de restrição:', error);
    }
  }

  /**
   * Verificar se texto/payload corresponde à palavra-chave
   */
  private matchKeyword(
    text: string,
    keyword: string,
    matchType: string,
    caseSensitive: boolean
  ): boolean {
    const textToCompare = caseSensitive ? text : text.toLowerCase();
    const keywordToCompare = caseSensitive ? keyword : keyword.toLowerCase();

    switch (matchType) {
      case 'exact':
        return textToCompare === keywordToCompare;
      case 'contains':
        return textToCompare.includes(keywordToCompare);
      case 'starts_with':
        return textToCompare.startsWith(keywordToCompare);
      case 'ends_with':
        return textToCompare.endsWith(keywordToCompare);
      default:
        return textToCompare === keywordToCompare;
    }
  }

  /**
   * Processar mensagens de texto (para palavras-chave digitadas)
   * @param identifiedWhatsappAccountId - O ID da conta WhatsApp identificado pelo webhook (mais confiável!)
   * @param identifiedTenantId - O ID do tenant identificado pelo webhook
   */
  private async processTextMessage(
    message: any, 
    value: any,
    identifiedWhatsappAccountId: number | null,
    identifiedTenantId: number | null
  ) {
    try {
      const from = message.from;
      const text = message.text?.body || '';
      const messageId = message.id;

      if (!text) {
        return;
      }

      console.log('\n💬 Mensagem de texto recebida:', text);
      console.log('   From:', from);
      console.log('   Message ID:', messageId);
      console.log('   🎯 WhatsApp Account ID (do webhook):', identifiedWhatsappAccountId);
      console.log('   🎯 Tenant ID (do webhook):', identifiedTenantId);

      // Normalizar número para busca (gerar variações com e sem o 9)
      const { normalizePhoneNumber } = require('../utils/phone-normalizer');
      const normalizedFrom = normalizePhoneNumber(from);
      
      // Criar variações do número para busca
      let phoneVariations = [from, normalizedFrom];
      
      // Se o número tem DDI BR, criar variação com/sem 9
      if (from.startsWith('55') && from.length >= 12) {
        const ddi = from.substring(0, 2); // 55
        const ddd = from.substring(2, 4); // 62
        const localNumber = from.substring(4);
        
        if (localNumber.length === 8) {
          // Número sem 9, adicionar versão com 9
          phoneVariations.push(`${ddi}${ddd}9${localNumber}`);
        } else if (localNumber.length === 9 && localNumber.startsWith('9')) {
          // Número com 9, adicionar versão sem 9
          phoneVariations.push(`${ddi}${ddd}${localNumber.substring(1)}`);
        }
      }
      
      console.log('   📱 Variações de número:', phoneVariations);

      // USAR O whatsappAccountId e tenantId IDENTIFICADOS PELO WEBHOOK (mais confiável!)
      let whatsappAccountId = identifiedWhatsappAccountId;
      let tenantId = identifiedTenantId;
      let contactName: string | null = null;

      // Só buscar fallback se não tiver identificado pelo webhook
      if (!whatsappAccountId || !tenantId) {
        console.log('   ⚠️ Webhook não identificou conta, fazendo fallback para busca em messages...');
        const messageResult = await queryNoTenant(
          `SELECT m.whatsapp_account_id, m.tenant_id, c.name as contact_name
           FROM messages m
           LEFT JOIN contacts c ON c.phone_number = m.phone_number
           WHERE m.phone_number = ANY($1)
           ORDER BY m.sent_at DESC
           LIMIT 1`,
          [phoneVariations]
        );

        whatsappAccountId = whatsappAccountId || messageResult.rows[0]?.whatsapp_account_id;
        tenantId = tenantId || messageResult.rows[0]?.tenant_id;
        contactName = messageResult.rows[0]?.contact_name;
      }

      // Fallback para conversas se ainda não encontrou
      if (!whatsappAccountId || !tenantId) {
        console.log('   ⚠️ Não encontrou em messages, buscando em conversas...');
        const convResult = await queryNoTenant(
          `SELECT whatsapp_account_id, tenant_id 
           FROM conversations 
           WHERE phone_number = ANY($1) 
           ORDER BY last_message_at DESC 
           LIMIT 1`,
          [phoneVariations]
        );
        
        whatsappAccountId = whatsappAccountId || convResult.rows[0]?.whatsapp_account_id;
        tenantId = tenantId || convResult.rows[0]?.tenant_id;
      }

      if (!whatsappAccountId || !tenantId) {
        console.log('⚠️ Conta WhatsApp ou Tenant não identificado por nenhum método');
        return;
      }
      
      console.log('   ✅ Conta FINAL identificada:', whatsappAccountId, 'Tenant:', tenantId);

      // ===================================
      // 💬 SALVAR MENSAGEM NO CHAT
      // ===================================
      await this.saveIncomingMessageToChat(
        from,
        'text',
        text,
        messageId,
        whatsappAccountId,
        null, // instanceId (API Oficial não usa)
        tenantId
      );

      // Buscar palavras-chave do tipo 'text' desta conta OU globais (todas as contas)
      const keywordsResult = await queryNoTenant(
        `SELECT * FROM restriction_list_keywords 
         WHERE (whatsapp_account_id = $1 OR whatsapp_account_id IS NULL)
         AND keyword_type = 'text'
         AND is_active = true`,
        [whatsappAccountId]
      );

      for (const keyword of keywordsResult.rows) {
        const match = this.matchKeyword(text, keyword.keyword, keyword.match_type, keyword.case_sensitive);

        if (match) {
          console.log(`   ✅ Palavra-chave detectada: "${keyword.keyword}"`);

          // Verificar se já existe
          const existingCheck = await queryNoTenant(
            `SELECT id FROM restriction_list_entries 
             WHERE list_type = $1 
             AND whatsapp_account_id = $2 
             AND (phone_number = $3 OR phone_number_alt = $3)
             AND (expires_at IS NULL OR expires_at > NOW())`,
            [keyword.list_type, whatsappAccountId, from]
          );

          if (existingCheck.rows.length > 0) {
            console.log('   ℹ️ Contato já está nesta lista');
            continue;
          }

          // Limpar número (remover caracteres não numéricos)
          const cleanPhone = from.replace(/\D/g, '');
          
          if (!cleanPhone) {
            console.log('   ⚠️ Número de telefone vazio');
            continue;
          }

          // Buscar configuração de dias de retenção da lista
          const listTypeResult = await queryNoTenant(
            `SELECT retention_days FROM restriction_list_types WHERE id = $1`,
            [keyword.list_type]
          );

          const retentionDays = listTypeResult.rows[0]?.retention_days;
          let expiresAt = null;

          if (retentionDays !== null && retentionDays !== undefined) {
            // Calcular data de expiração
            const now = new Date();
            expiresAt = new Date(now.getTime() + retentionDays * 24 * 60 * 60 * 1000);
          }

          // VERSÃO 1: Registrar o número EXATAMENTE como chegou do WhatsApp
          const version1 = cleanPhone; // Ex: 5511930284611
          
          // REGRA: Nome e CPF devem ser o número de telefone (igual ao registro manual)
          const finalName = version1;
          const finalNotes = `CPF: ${version1}`;
          
          await queryNoTenant(
            `INSERT INTO restriction_list_entries 
             (list_type, whatsapp_account_id, phone_number, phone_number_alt, 
              contact_name, keyword_matched, added_method, notes, expires_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              keyword.list_type,
              whatsappAccountId,
              version1,
              null,
              finalName,
              keyword.keyword,
              'webhook_keyword',
              finalNotes,
              expiresAt,
            ]
          );

          console.log(`   ✅ Versão 1 (original) adicionada: ${version1}`);

          // VERSÃO 2: Adicionar um 9 no número local (após o DDD)
          // Ex: 5511930284611 -> 55119930284611
          let version2 = null;
          
          // Se o número tem DDI (55) e tem pelo menos DDD + número
          if (cleanPhone.startsWith('55') && cleanPhone.length >= 12) {
            // Extrair partes: 55 + DDD (2 dígitos) + número local
            const ddi = cleanPhone.substring(0, 2); // 55
            const ddd = cleanPhone.substring(2, 4); // 11
            const localNumber = cleanPhone.substring(4); // 930284611
            
            // Adicionar um 9 no início do número local
            version2 = `${ddi}${ddd}9${localNumber}`; // 55 + 11 + 9 + 930284611 = 55119930284611
            
            // Nome e CPF também devem ser o número (versão 2)
            const finalName2 = version2;
            const finalNotes2 = `CPF: ${version2}`;
            
            await queryNoTenant(
              `INSERT INTO restriction_list_entries 
               (list_type, whatsapp_account_id, phone_number, phone_number_alt, 
                contact_name, keyword_matched, added_method, notes, expires_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
              [
                keyword.list_type,
                whatsappAccountId,
                version2,
                null,
                finalName2,
                keyword.keyword,
                'webhook_keyword',
                finalNotes2,
                expiresAt,
              ]
            );

            console.log(`   ✅ Versão 2 (+9 extra) adicionada: ${version2}`);
          }

          console.log(`   ✅ Contato adicionado à lista "${keyword.list_type}" via palavra-chave com 2 versões!`);
        }
      }
    } catch (error: any) {
      console.error('❌ Erro ao processar mensagem de texto:', error);
    }
  }

  /**
   * Processar mensagens de MÍDIA (imagem, áudio, vídeo, documento, sticker)
   */
  private async processMediaMessage(
    message: any, 
    value: any,
    identifiedWhatsappAccountId: number | null,
    identifiedTenantId: number | null
  ) {
    try {
      const from = message.from;
      const messageId = message.id;
      const mediaType = message.type;

      console.log(`📎 Mídia recebida: ${mediaType}`);
      console.log('   From:', from);
      console.log('   Message ID:', messageId);
      console.log('   🎯 WhatsApp Account ID (do webhook):', identifiedWhatsappAccountId);
      console.log('   🎯 Tenant ID (do webhook):', identifiedTenantId);

      // Extrair dados da mídia
      let mediaData = message[mediaType] || {};
      let mediaId = mediaData.id;
      let mimeType = mediaData.mime_type || '';
      let caption = mediaData.caption || '';
      let fileName = mediaData.filename || '';

      console.log('   Media ID:', mediaId);
      console.log('   MIME Type:', mimeType);
      console.log('   Caption:', caption);
      console.log('   Filename:', fileName);

      // USAR O whatsappAccountId e tenantId IDENTIFICADOS PELO WEBHOOK (mais confiável!)
      let whatsappAccountId = identifiedWhatsappAccountId;
      let tenantId = identifiedTenantId;

      // Só buscar fallback se não tiver identificado pelo webhook
      if (!whatsappAccountId || !tenantId) {
        console.log('   ⚠️ Webhook não identificou conta, fazendo fallback para busca em messages...');
        
        const { normalizePhoneNumber } = require('../utils/phone-normalizer');
        let phoneVariations = [from, normalizePhoneNumber(from)];
        
        if (from.startsWith('55') && from.length >= 12) {
          const ddi = from.substring(0, 2);
          const ddd = from.substring(2, 4);
          const localNumber = from.substring(4);
          if (localNumber.length === 8) {
            phoneVariations.push(`${ddi}${ddd}9${localNumber}`);
          } else if (localNumber.length === 9 && localNumber.startsWith('9')) {
            phoneVariations.push(`${ddi}${ddd}${localNumber.substring(1)}`);
          }
        }

        const messageResult = await queryNoTenant(
          `SELECT m.whatsapp_account_id, m.tenant_id
           FROM messages m
           WHERE m.phone_number = ANY($1)
           ORDER BY m.sent_at DESC
           LIMIT 1`,
          [phoneVariations]
        );

        whatsappAccountId = whatsappAccountId || messageResult.rows[0]?.whatsapp_account_id;
        tenantId = tenantId || messageResult.rows[0]?.tenant_id;

        if (!whatsappAccountId || !tenantId) {
          const convResult = await queryNoTenant(
            `SELECT whatsapp_account_id, tenant_id 
             FROM conversations 
             WHERE phone_number = ANY($1) 
             ORDER BY last_message_at DESC 
             LIMIT 1`,
            [phoneVariations]
          );
          whatsappAccountId = whatsappAccountId || convResult.rows[0]?.whatsapp_account_id;
          tenantId = tenantId || convResult.rows[0]?.tenant_id;
        }
      }

      if (!whatsappAccountId || !tenantId) {
        console.log('⚠️ Conta WhatsApp ou Tenant não identificado para mídia por nenhum método');
        return;
      }

      console.log('   ✅ Conta FINAL identificada:', whatsappAccountId, 'Tenant:', tenantId);

      // Montar conteúdo da mensagem
      let messageContent = '';
      let mediaUrl = null;

      switch (mediaType) {
        case 'image':
          messageContent = caption || '📷 [Imagem]';
          break;
        case 'video':
          messageContent = caption || '🎥 [Vídeo]';
          break;
        case 'audio':
        case 'voice':
          messageContent = '🎤 [Áudio]';
          break;
        case 'document':
          messageContent = `📄 ${fileName || '[Documento]'}`;
          break;
        case 'sticker':
          messageContent = '🎭 [Sticker]';
          break;
        default:
          messageContent = `📎 [${mediaType}]`;
      }

      // BAIXAR A MÍDIA DO WHATSAPP
      if (mediaId) {
        console.log('   📥 Baixando mídia do WhatsApp...');
        
        // Buscar access token da conta
        const accountResult = await queryNoTenant(
          'SELECT access_token FROM whatsapp_accounts WHERE id = $1',
          [whatsappAccountId]
        );
        
        const accessToken = accountResult.rows[0]?.access_token;
        
        if (accessToken) {
          const { WhatsAppService } = require('../services/whatsapp.service');
          const whatsappService = new WhatsAppService();
          
          const mediaDownload = await whatsappService.downloadMedia(mediaId, accessToken, whatsappAccountId, tenantId);
          
          if (mediaDownload) {
            // Salvar arquivo localmente
            const fs = require('fs');
            const path = require('path');
            
            const mediaDir = path.join(__dirname, '../../public/media');
            if (!fs.existsSync(mediaDir)) {
              fs.mkdirSync(mediaDir, { recursive: true });
            }
            
            const filePath = path.join(mediaDir, mediaDownload.fileName);
            fs.writeFileSync(filePath, mediaDownload.buffer);
            
            // URL pública para acessar a mídia
            mediaUrl = `/media/${mediaDownload.fileName}`;
            
            console.log(`   ✅ Mídia salva: ${mediaUrl}`);
          } else {
            console.log('   ⚠️ Não foi possível baixar a mídia');
          }
        } else {
          console.log('   ⚠️ Access token não encontrado');
        }
      }

      console.log('   ✅ Salvando mídia no chat...');

      await this.saveIncomingMessageToChat(
        from,
        mediaType,
        messageContent,
        messageId,
        whatsappAccountId,
        null,
        tenantId,
        mediaId,
        mimeType,
        mediaUrl // URL local da mídia baixada
      );

      console.log('   ✅ Mídia salva no chat!');

    } catch (error: any) {
      console.error('❌ Erro ao processar mensagem de mídia:', error);
    }
  }

  /**
   * Processar mensagens de LOCALIZAÇÃO
   */
  private async processLocationMessage(
    message: any, 
    value: any,
    identifiedWhatsappAccountId: number | null,
    identifiedTenantId: number | null
  ) {
    try {
      const from = message.from;
      const messageId = message.id;
      const location = message.location || {};
      const latitude = location.latitude;
      const longitude = location.longitude;
      const name = location.name || '';
      const address = location.address || '';

      console.log('📍 Localização recebida:');
      console.log('   From:', from);
      console.log('   Lat/Long:', latitude, longitude);
      console.log('   Nome:', name);
      console.log('   Endereço:', address);
      console.log('   🎯 WhatsApp Account ID (do webhook):', identifiedWhatsappAccountId);
      console.log('   🎯 Tenant ID (do webhook):', identifiedTenantId);

      // USAR O whatsappAccountId e tenantId IDENTIFICADOS PELO WEBHOOK (mais confiável!)
      let whatsappAccountId = identifiedWhatsappAccountId;
      let tenantId = identifiedTenantId;

      // Só buscar fallback se não tiver identificado pelo webhook
      if (!whatsappAccountId || !tenantId) {
        console.log('   ⚠️ Webhook não identificou conta, fazendo fallback para busca em messages...');
        
        const { normalizePhoneNumber } = require('../utils/phone-normalizer');
        let phoneVariations = [from, normalizePhoneNumber(from)];
        
        if (from.startsWith('55') && from.length >= 12) {
          const ddi = from.substring(0, 2);
          const ddd = from.substring(2, 4);
          const localNumber = from.substring(4);
          if (localNumber.length === 8) {
            phoneVariations.push(`${ddi}${ddd}9${localNumber}`);
          } else if (localNumber.length === 9 && localNumber.startsWith('9')) {
            phoneVariations.push(`${ddi}${ddd}${localNumber.substring(1)}`);
          }
        }

        const messageResult = await queryNoTenant(
          `SELECT m.whatsapp_account_id, m.tenant_id
           FROM messages m
           WHERE m.phone_number = ANY($1)
           ORDER BY m.sent_at DESC
           LIMIT 1`,
          [phoneVariations]
        );

        whatsappAccountId = whatsappAccountId || messageResult.rows[0]?.whatsapp_account_id;
        tenantId = tenantId || messageResult.rows[0]?.tenant_id;

        if (!whatsappAccountId || !tenantId) {
          const convResult = await queryNoTenant(
            `SELECT whatsapp_account_id, tenant_id 
             FROM conversations 
             WHERE phone_number = ANY($1) 
             ORDER BY last_message_at DESC 
             LIMIT 1`,
            [phoneVariations]
          );
          whatsappAccountId = whatsappAccountId || convResult.rows[0]?.whatsapp_account_id;
          tenantId = tenantId || convResult.rows[0]?.tenant_id;
        }
      }

      if (!whatsappAccountId || !tenantId) {
        console.log('⚠️ Conta WhatsApp ou Tenant não identificado por nenhum método');
        return;
      }

      console.log('   ✅ Conta FINAL identificada:', whatsappAccountId, 'Tenant:', tenantId);

      const messageContent = `📍 Localização: ${name || address || `${latitude}, ${longitude}`}`;

      await this.saveIncomingMessageToChat(
        from,
        'location',
        messageContent,
        messageId,
        whatsappAccountId,
        null,
        tenantId,
        `${latitude},${longitude}`, // Coordenadas como "media"
        null
      );

      console.log('   ✅ Localização salva no chat!');

    } catch (error: any) {
      console.error('❌ Erro ao processar localização:', error);
    }
  }

  /**
   * Processar CONTATOS compartilhados
   */
  private async processContactMessage(
    message: any, 
    value: any,
    identifiedWhatsappAccountId: number | null,
    identifiedTenantId: number | null
  ) {
    try {
      const from = message.from;
      const messageId = message.id;
      const contacts = message.contacts || [];

      console.log('👤 Contatos compartilhados:');
      console.log('   From:', from);
      console.log('   Quantidade:', contacts.length);
      console.log('   🎯 WhatsApp Account ID (do webhook):', identifiedWhatsappAccountId);
      console.log('   🎯 Tenant ID (do webhook):', identifiedTenantId);

      // USAR O whatsappAccountId e tenantId IDENTIFICADOS PELO WEBHOOK (mais confiável!)
      let whatsappAccountId = identifiedWhatsappAccountId;
      let tenantId = identifiedTenantId;

      // Só buscar fallback se não tiver identificado pelo webhook
      if (!whatsappAccountId || !tenantId) {
        console.log('   ⚠️ Webhook não identificou conta, fazendo fallback para busca em messages...');
        
        const { normalizePhoneNumber } = require('../utils/phone-normalizer');
        let phoneVariations = [from, normalizePhoneNumber(from)];
        
        if (from.startsWith('55') && from.length >= 12) {
          const ddi = from.substring(0, 2);
          const ddd = from.substring(2, 4);
          const localNumber = from.substring(4);
          if (localNumber.length === 8) {
            phoneVariations.push(`${ddi}${ddd}9${localNumber}`);
          } else if (localNumber.length === 9 && localNumber.startsWith('9')) {
            phoneVariations.push(`${ddi}${ddd}${localNumber.substring(1)}`);
          }
        }

        const messageResult = await queryNoTenant(
          `SELECT m.whatsapp_account_id, m.tenant_id
           FROM messages m
           WHERE m.phone_number = ANY($1)
           ORDER BY m.sent_at DESC
           LIMIT 1`,
          [phoneVariations]
        );

        whatsappAccountId = whatsappAccountId || messageResult.rows[0]?.whatsapp_account_id;
        tenantId = tenantId || messageResult.rows[0]?.tenant_id;

        if (!whatsappAccountId || !tenantId) {
          const convResult = await queryNoTenant(
            `SELECT whatsapp_account_id, tenant_id 
             FROM conversations 
             WHERE phone_number = ANY($1) 
             ORDER BY last_message_at DESC 
             LIMIT 1`,
            [phoneVariations]
          );
          whatsappAccountId = whatsappAccountId || convResult.rows[0]?.whatsapp_account_id;
          tenantId = tenantId || convResult.rows[0]?.tenant_id;
        }
      }

      if (!whatsappAccountId || !tenantId) {
        console.log('⚠️ Conta WhatsApp ou Tenant não identificado por nenhum método');
        return;
      }

      console.log('   ✅ Conta FINAL identificada:', whatsappAccountId, 'Tenant:', tenantId);

      // Montar lista de contatos
      let contactNames = contacts.map((c: any) => {
        const name = c.name?.formatted_name || 'Contato';
        const phone = c.phones?.[0]?.phone || '';
        return `${name} (${phone})`;
      }).join(', ');

      const messageContent = `👤 Contato(s): ${contactNames}`;

      await this.saveIncomingMessageToChat(
        from,
        'contact',
        messageContent,
        messageId,
        whatsappAccountId,
        null,
        tenantId,
        JSON.stringify(contacts), // Salvar dados completos
        null
      );

      console.log('   ✅ Contatos salvos no chat!');

    } catch (error: any) {
      console.error('❌ Erro ao processar contatos:', error);
    }
  }

  /**
   * Processar atualização de status de template
   */
  private async processTemplateStatusUpdate(value: any, businessAccountId: string) {
    try {
      console.log('\n📋 ===== ATUALIZAÇÃO DE STATUS DE TEMPLATE =====');
      console.log('   Event:', value.event);
      console.log('   Template ID:', value.message_template_id);
      console.log('   Template Name:', value.message_template_name);
      console.log('   Language:', value.message_template_language);
      console.log('   Category:', value.message_template_category);
      console.log('   Reason:', value.reason);

      const event = value.event; // APPROVED, REJECTED, PENDING, etc.
      const templateName = value.message_template_name;
      const templateId = value.message_template_id;

      // Buscar a conta WhatsApp pelo business_account_id
      const accountResult = await queryNoTenant(
        'SELECT id FROM whatsapp_accounts WHERE business_account_id = $1',
        [businessAccountId]
      );

      if (accountResult.rows.length === 0) {
        console.log('⚠️ Conta WhatsApp não encontrada para business_account_id:', businessAccountId);
        return;
      }

      const accountId = accountResult.rows[0].id;
      console.log('   Account ID:', accountId);

      // Mapear status do webhook para status do banco
      let dbStatus = 'pending';
      if (event === 'APPROVED') {
        dbStatus = 'approved';
      } else if (event === 'REJECTED') {
        dbStatus = 'rejected';
      } else if (event === 'PENDING') {
        dbStatus = 'pending';
      } else if (event === 'PAUSED' || event === 'DISABLED') {
        dbStatus = 'error';
      }

      // Atualizar a tabela templates
      await queryNoTenant(
        `UPDATE templates 
         SET status = $1, updated_at = NOW()
         WHERE whatsapp_account_id = $2 AND template_name = $3`,
        [dbStatus, accountId, templateName]
      );

      console.log('   ✅ Tabela templates atualizada');

      // Atualizar a tabela template_queue_history
      const errorMessage = value.reason && value.reason !== 'NONE' ? value.reason : null;
      
      await queryNoTenant(
        `UPDATE template_queue_history 
         SET status = $1, 
             error_message = $2,
             processed_at = NOW()
         WHERE whatsapp_account_id = $3 
         AND template_name = $4
         AND status IN ('pending', 'processing', 'queued')`,
        [dbStatus, errorMessage, accountId, templateName]
      );

      console.log('   ✅ Tabela template_queue_history atualizada');
      console.log('================================\n');

    } catch (error: any) {
      console.error('❌ Erro ao processar atualização de template:', error);
    }
  }

  /**
   * GET /webhook/logs - Buscar histórico de webhooks
   */
  async getLogs(req: Request, res: Response) {
    try {
      const { 
        limit = '50', 
        offset = '0', 
        type,
        status,
        account_id 
      } = req.query;

      let whereConditions = [];
      let params: any[] = [];
      let paramCount = 1;

      if (type) {
        whereConditions.push(`request_type = $${paramCount}`);
        params.push(type);
        paramCount++;
      }

      if (status) {
        whereConditions.push(`processing_status = $${paramCount}`);
        params.push(status);
        paramCount++;
      }

      if (account_id) {
        whereConditions.push(`whatsapp_account_id = $${paramCount}`);
        params.push(account_id);
        paramCount++;
      }

      const whereClause = whereConditions.length > 0 
        ? 'WHERE ' + whereConditions.join(' AND ')
        : '';

      // Buscar logs
      const logsResult = await queryNoTenant(
        `SELECT 
           wl.*,
           wa.name as account_name,
           wa.phone_number as account_phone
         FROM webhook_logs wl
         LEFT JOIN whatsapp_accounts wa ON wl.whatsapp_account_id = wa.id
         ${whereClause}
         ORDER BY wl.received_at DESC
         LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
        [...params, parseInt(limit as string), parseInt(offset as string)]
      );

      // Buscar total
      const countResult = await queryNoTenant(
        `SELECT COUNT(*) as total FROM webhook_logs ${whereClause}`,
        params
      );

      res.json({
        success: true,
        data: logsResult.rows,
        total: parseInt(countResult.rows[0].total),
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      });
    } catch (error: any) {
      console.error('Erro ao buscar logs:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /webhook/status - Status simplificado (ativo/inativo)
   */
  async getStatus(req: Request, res: Response) {
    try {
      const { account_id, period = '24h' } = req.query;

      const periodMap: Record<string, number> = {
        '1h': 1,
        '6h': 6,
        '24h': 24,
        '7d': 24 * 7,
        '30d': 24 * 30,
      };

      const periodHours = periodMap[String(period)] || 24;
      const cutoffMs = periodHours * 60 * 60 * 1000;

      const baseConditions: string[] = [];
      const params: any[] = [];

      // SEMPRE filtrar por tenant_id (do contexto do usuário logado)
      const tenantId = (req as any).tenantId;
      if (tenantId) {
        baseConditions.push(`tenant_id = $${params.length + 1}`);
        params.push(tenantId);
      }

      if (account_id) {
        baseConditions.push(`whatsapp_account_id = $${params.length + 1}`);
        params.push(parseInt(String(account_id)));
      }

      const buildWhere = (...extra: string[]) => {
        const all = [...baseConditions, ...extra.filter(Boolean)];
        return all.length ? `WHERE ${all.join(' AND ')}` : '';
      };

      const latestResult = await queryNoTenant(
        `SELECT id, request_type, processing_status, received_at, processing_error
         FROM webhook_logs
         ${buildWhere()}
         ORDER BY received_at DESC
         LIMIT 1`,
        params
      );

      const lastSuccessResult = await queryNoTenant(
        `SELECT id, request_type, processing_status, received_at
         FROM webhook_logs
         ${buildWhere(`processing_status = 'success'`)}
         ORDER BY received_at DESC
         LIMIT 1`,
        params
      );

      const lastFailureResult = await queryNoTenant(
        `SELECT id, request_type, processing_status, received_at, processing_error
         FROM webhook_logs
         ${buildWhere(`processing_status = 'failed'`)}
         ORDER BY received_at DESC
         LIMIT 1`,
        params
      );

      const now = Date.now();
      const lastSuccessAt = lastSuccessResult.rows[0]?.received_at
        ? new Date(lastSuccessResult.rows[0].received_at).getTime()
        : null;

      const isActive =
        lastSuccessAt !== null ? now - lastSuccessAt <= cutoffMs : false;

      res.json({
        success: true,
        data: {
          status: isActive ? 'active' : 'inactive',
          isActive,
          periodHours,
          lastEvent: latestResult.rows[0] || null,
          lastSuccess: lastSuccessResult.rows[0] || null,
          lastFailure: lastFailureResult.rows[0] || null,
          lastError: lastFailureResult.rows[0]?.processing_error || null,
          lastEventAt: latestResult.rows[0]?.received_at || null,
          statusMessage: isActive
            ? 'Webhook recebendo eventos normalmente'
            : 'Nenhum webhook bem-sucedido no período selecionado',
        },
      });
    } catch (error: any) {
      console.error('Erro ao buscar status do webhook:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /webhook/stats - Estatísticas de webhooks
   */
  async getStats(req: Request, res: Response) {
    try {
      const { account_id, period = '24h' } = req.query;

      // Calcular período
      let periodHours = 24;
      if (period === '1h') periodHours = 1;
      else if (period === '6h') periodHours = 6;
      else if (period === '24h') periodHours = 24;
      else if (period === '7d') periodHours = 24 * 7;
      else if (period === '30d') periodHours = 24 * 30;

      let whereClause = `WHERE received_at >= NOW() - INTERVAL '${periodHours} hours'`;
      let params: any[] = [];

      // SEMPRE filtrar por tenant_id (do contexto do usuário logado)
      const tenantId = (req as any).tenantId;
      if (tenantId) {
        whereClause += ` AND tenant_id = $${params.length + 1}`;
        params.push(tenantId);
      }

      if (account_id) {
        whereClause += ` AND whatsapp_account_id = $${params.length + 1}`;
        params.push(account_id);
      }

      // Estatísticas gerais
      const statsResult = await queryNoTenant(
        `SELECT 
           COUNT(*) as total_webhooks,
           COUNT(*) FILTER (WHERE request_type = 'verification') as verifications,
           COUNT(*) FILTER (WHERE request_type = 'notification') as notifications,
           COUNT(*) FILTER (WHERE processing_status = 'success') as successful,
           COUNT(*) FILTER (WHERE processing_status = 'failed') as failed,
           SUM(messages_processed) as total_messages_processed,
           SUM(statuses_processed) as total_statuses_processed,
           SUM(clicks_detected) as total_clicks_detected
         FROM webhook_logs
         ${whereClause}`,
        params
      );

      // Últimos 10 webhooks
      const recentResult = await queryNoTenant(
        `SELECT 
           id, request_type, processing_status, 
           messages_processed, statuses_processed, clicks_detected,
           received_at, processed_at
         FROM webhook_logs
         ${whereClause}
         ORDER BY received_at DESC
         LIMIT 10`,
        params
      );

      // Webhooks por hora (últimas 24h se for esse o período)
      let hourlyStats = [];
      if (periodHours <= 24) {
        const hourlyResult = await queryNoTenant(
          `SELECT 
             DATE_TRUNC('hour', received_at) as hour,
             COUNT(*) as count,
             COUNT(*) FILTER (WHERE processing_status = 'success') as successful,
             COUNT(*) FILTER (WHERE processing_status = 'failed') as failed
           FROM webhook_logs
           ${whereClause}
           GROUP BY hour
           ORDER BY hour DESC`,
          params
        );
        hourlyStats = hourlyResult.rows;
      }

      res.json({
        success: true,
        data: {
          stats: statsResult.rows[0],
          recent: recentResult.rows,
          hourly: hourlyStats
        }
      });
    } catch (error: any) {
      console.error('Erro ao buscar estatísticas:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /webhook/config - Buscar configuração de webhook da conta
   */
  async getConfig(req: Request, res: Response) {
    try {
      const { account_id } = req.query;

      if (!account_id) {
        return res.status(400).json({ 
          success: false, 
          error: 'account_id é obrigatório' 
        });
      }

      // Buscar configuração da conta E o tenant_id
      const accountResult = await queryNoTenant(
        `SELECT 
           id, name, phone_number, webhook_verify_token, is_active, tenant_id
         FROM whatsapp_accounts
         WHERE id = $1`,
        [account_id]
      );

      if (accountResult.rows.length === 0) {
        return res.status(404).json({ 
          success: false, 
          error: 'Conta não encontrada' 
        });
      }

      const account = accountResult.rows[0];
      const tenantId = account.tenant_id;

      // 🔍 BUSCAR WEBHOOK_URL ESPECÍFICA DO TENANT
      let webhookUrl = `${process.env.WEBHOOK_URL || 'https://seu-dominio.com'}/api/webhook`;
      
      if (tenantId) {
        const tenantResult = await queryNoTenant(
          'SELECT webhook_url FROM tenants WHERE id = $1',
          [tenantId]
        );
        
        if (tenantResult.rows.length > 0 && tenantResult.rows[0].webhook_url) {
          webhookUrl = tenantResult.rows[0].webhook_url;
        }
      }

      // Buscar estatísticas de webhooks desta conta
      const statsResult = await queryNoTenant(
        `SELECT 
           COUNT(*) as total_webhooks,
           COUNT(*) FILTER (WHERE processing_status = 'success') as successful,
           COUNT(*) FILTER (WHERE processing_status = 'failed') as failed,
           MAX(received_at) as last_webhook_at
         FROM webhook_logs
         WHERE whatsapp_account_id = $1
         AND received_at >= NOW() - INTERVAL '7 days'`,
        [account_id]
      );

      res.json({
        success: true,
        data: {
          account,
          stats: statsResult.rows[0],
          webhook_url: webhookUrl,
          verify_token: process.env.WEBHOOK_VERIFY_TOKEN || 'seu_token_secreto_aqui'
        }
      });
    } catch (error: any) {
      console.error('Erro ao buscar configuração:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Salvar mensagem recebida no sistema de chat (API Oficial)
   */
  private async saveIncomingMessageToChat(
    phoneNumber: string,
    messageType: string,
    messageContent: string,
    messageId: string,
    whatsappAccountId: number,
    instanceId: number | null,
    tenantId: number,
    mediaId: string | null = null,
    mimeType: string | null = null,
    mediaUrl: string | null = null
  ) {
    try {
      // Normalizar número de telefone (remover 9 extra se tiver)
      const { normalizePhoneNumber } = require('../utils/phone-normalizer');
      const normalizedPhone = normalizePhoneNumber(phoneNumber);
      
      console.log('\n💾 Salvando mensagem no chat (API Oficial)...');
      console.log(`   📱 Telefone original: ${phoneNumber}`);
      console.log(`   📱 Telefone normalizado: ${normalizedPhone}`);
      console.log(`   📝 Conteúdo: ${messageContent?.substring(0, 50)}...`);
      console.log(`   🏢 WhatsApp Account ID: ${whatsappAccountId}`);

      // Buscar conversa ATIVA (não arquivada) para esta conta WhatsApp específica
      let conversationId;
      const convCheck = await queryNoTenant(
        `SELECT id, status, is_archived FROM conversations 
         WHERE phone_number = $1 AND tenant_id = $2 AND whatsapp_account_id = $3 
         AND (status != 'archived' AND is_archived = false)
         ORDER BY created_at DESC LIMIT 1`,
        [normalizedPhone, tenantId, whatsappAccountId]
      );

      if (convCheck.rows.length > 0) {
        // Conversa ativa encontrada - usar ela
        conversationId = convCheck.rows[0].id;
        console.log(`   ✅ Conversa ativa existente: ${conversationId}`);
      } else {
        // Não tem conversa ativa - criar nova (mesmo que exista uma arquivada)
        console.log(`   📭 Nenhuma conversa ativa encontrada, criando nova...`);
        const newConv = await queryNoTenant(
          `INSERT INTO conversations (
            phone_number,
            tenant_id,
            whatsapp_account_id,
            unread_count,
            last_message_at,
            last_message_text,
            last_message_direction,
            status,
            is_archived
          ) VALUES ($1, $2, $3, 1, NOW(), $4, 'inbound', 'pending', false)
          RETURNING id`,
          [normalizedPhone, tenantId, whatsappAccountId, messageContent?.substring(0, 100) || '[Mensagem]']
        );
        conversationId = newConv.rows[0].id;
        console.log(`   ✨ Nova conversa criada: ${conversationId} (status: pending)`);
      }

      // Verificar se mensagem já foi salva (duplicação)
      const duplicate = await queryNoTenant(
        'SELECT id FROM conversation_messages WHERE whatsapp_message_id = $1 AND tenant_id = $2',
        [messageId, tenantId]
      );

      if (duplicate.rows.length > 0) {
        console.log('   ⚠️ Mensagem já salva, ignorando duplicação');
        return;
      }

      // Salvar mensagem
      await queryNoTenant(
        `INSERT INTO conversation_messages (
          conversation_id,
          message_direction,
          message_type,
          message_content,
          whatsapp_message_id,
          tenant_id,
          is_read_by_agent,
          media_id,
          media_type,
          media_url
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          conversationId,
          'inbound',
          messageType || 'text',
          messageContent || null,
          messageId || null,
          tenantId,
          false, // Não lida pelo agente
          mediaId || null,
          mimeType || null,
          mediaUrl || null
        ]
      );

      // Atualizar conversa
      await queryNoTenant(
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
}

export const webhookController = new WebhookController();

