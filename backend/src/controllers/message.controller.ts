import { Request, Response } from 'express';
import { ContactModel } from '../models/Contact';
import { MessageModel } from '../models/Message';
import { RestrictionListController } from './restriction-list.controller';
import { query as queryNoTenant } from '../database/connection';

export class MessageController {
  async sendImmediate(req: Request, res: Response) {
    try {
      console.log('📨 Recebendo requisição de envio imediato:', req.body);
      
      const {
        whatsapp_account_id,
        phone_number,
        template_name,
        variables,
        media_url,
        media_type,
      } = req.body;

      // Pegar tenant_id do request (vem do middleware de autenticação)
      const tenantId = (req as any).tenant?.id;
      console.log('🏢 Tenant ID:', tenantId);

      // Validações
      if (!whatsapp_account_id || !phone_number || !template_name) {
        console.log('❌ Validação falhou');
        return res.status(400).json({
          success: false,
          error: 'whatsapp_account_id, phone_number and template_name are required',
        });
      }

      // 🚨 VERIFICAR LISTA DE RESTRIÇÃO (BACKEND - OBRIGATÓRIO)
      console.log('═══════════════════════════════════════════════════════');
      console.log('🔍 VERIFICANDO LISTA DE RESTRIÇÃO (ENVIO IMEDIATO)');
      console.log('═══════════════════════════════════════════════════════');
      console.log('   📞 Número:', phone_number);
      console.log('   📱 Conta WhatsApp ID:', whatsapp_account_id);
      console.log('   🏢 Tenant ID:', tenantId);
      
      try {
        const restrictionController = new RestrictionListController();
        
        // Criar request fake para o controller
        const fakeReq: any = {
          body: {
            phone_numbers: [phone_number],
            whatsapp_account_ids: [whatsapp_account_id],
          },
          tenant: { id: tenantId },
        };
        
        let restrictionResult: any = null;
        const fakeRes: any = {
          json: (data: any) => {
            restrictionResult = data;
          },
          status: () => fakeRes,
        };
        
        await restrictionController.checkBulk(fakeReq, fakeRes);
        
        if (restrictionResult && restrictionResult.restricted_count > 0) {
          const detail = restrictionResult.restricted_details[0];
          const listNames = detail.list_names?.join(', ') || 'Lista de Restrição';
          const types = detail.types || [];
          
          console.log('🚫 ═══════════════════════════════════════════════════');
          console.log('🚫 NÚMERO BLOQUEADO - ESTÁ NA LISTA DE RESTRIÇÃO!');
          console.log('🚫 ═══════════════════════════════════════════════════');
          console.log('   📝 Listas:', listNames);
          console.log('   🏷️  Tipos:', types.join(', '));
          console.log('   📞 Número:', phone_number);
          console.log('   🔍 Detalhes completos:', JSON.stringify(detail, null, 2));
          console.log('   ❌ ENVIO CANCELADO!');
          console.log('═══════════════════════════════════════════════════════\n');
          
          return res.status(403).json({
            success: false,
            error: `Número bloqueado! Está na lista: ${listNames}`,
            restricted: true,
            details: {
              lists: listNames,
              types: types,
              phone: phone_number,
              list_names: detail.list_names,
              phone_number_found: detail.phone_number_found,
              contact_name: detail.contact_name,
            },
          });
        }
        
        console.log('✅ ═══════════════════════════════════════════════════');
        console.log('✅ NÚMERO LIVRE - NÃO ESTÁ EM LISTA DE RESTRIÇÃO');
        console.log('✅ ═══════════════════════════════════════════════════');
        console.log('   📞 Número:', phone_number);
        console.log('   📱 Conta:', whatsapp_account_id);
        console.log('   ✅ PROSSEGUINDO COM ENVIO...');
        console.log('═══════════════════════════════════════════════════════\n');
      } catch (error: any) {
        console.error('❌ ═══════════════════════════════════════════════════');
        console.error('❌ ERRO AO VERIFICAR LISTA DE RESTRIÇÃO!');
        console.error('❌ ═══════════════════════════════════════════════════');
        console.error('   Erro:', error.message);
        console.error('   Stack:', error.stack);
        console.error('═══════════════════════════════════════════════════\n');
        
        // ⚠️ SE DER ERRO NA VERIFICAÇÃO, BLOQUEAR POR SEGURANÇA
        return res.status(500).json({
          success: false,
          error: `Erro ao verificar lista de restrição: ${error.message}`,
          details: error.stack,
          security_block: true,
        });
      }

      // Criar ou atualizar contato
      console.log('📇 Buscando/criando contato...');
      let contact = await ContactModel.findByPhoneNumber(phone_number, tenantId);
      
      if (!contact) {
        contact = await ContactModel.create({
          phone_number,
          variables,
          tenant_id: tenantId,
        });
        console.log('✅ Contato criado:', contact.id);
      } else {
        console.log('✅ Contato encontrado:', contact.id);
      }

      // Criar registro de mensagem
      console.log('💬 Criando mensagem...');
      const message = await MessageModel.create({
        contact_id: contact.id!,
        whatsapp_account_id,
        phone_number,
        template_name,
        status: 'pending',
        media_url,
        tenant_id: tenantId,
        user_id: (req as any).user?.id || null,
      });
      console.log('✅ Mensagem criada:', message.id);

      // Buscar dados da conta WhatsApp
      console.log('📇 Buscando dados da conta WhatsApp...');
      
      const { WhatsAppAccountModel } = await import('../models/WhatsAppAccount');
      const account = await WhatsAppAccountModel.findById(whatsapp_account_id, tenantId);
      
      if (!account) {
        throw new Error('WhatsApp account not found');
      }

      // ⚠️ VERIFICAR SE A CONTA ESTÁ ATIVA
      if (!account.is_active) {
        console.log('❌ Conta desativada:', account.name);
        throw new Error('❌ Esta conta WhatsApp está desativada. Ative-a nas configurações para poder enviar mensagens.');
      }

      console.log('✅ Conta encontrada e ativa:', account.name);

      // Enviar mensagem REAL via WhatsApp API
      console.log('📱 Enviando mensagem REAL via WhatsApp API...');
      
      const { whatsappService } = await import('../services/whatsapp.service');
      
      // Se a mídia for local (upload), fazer upload para WhatsApp API primeiro
      let finalMediaUrl = media_url;
      let finalMediaType = media_type;
      
      if (media_url && media_url.includes('localhost')) {
        console.log('📤 Mídia local detectada, fazendo upload para WhatsApp API...');
        
        try {
          const fs = await import('fs');
          const path = await import('path');
          
          // Extrair o caminho do arquivo da URL
          const urlPath = media_url.split('/uploads/')[1];
          const filePath = path.join(__dirname, '../../uploads', urlPath);
          
          console.log('📁 Lendo arquivo:', filePath);
          
          if (fs.existsSync(filePath)) {
            const fileBuffer = fs.readFileSync(filePath);
            
            // Detectar MIME type
            let mimeType = 'image/jpeg';
            if (filePath.endsWith('.png')) mimeType = 'image/png';
            else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) mimeType = 'image/jpeg';
            else if (filePath.endsWith('.gif')) mimeType = 'image/gif';
            else if (filePath.endsWith('.mp4')) mimeType = 'video/mp4';
            else if (filePath.endsWith('.pdf')) mimeType = 'application/pdf';
            else if (filePath.endsWith('.mp3')) mimeType = 'audio/mpeg';
            
            console.log('📤 Fazendo upload para WhatsApp (tamanho:', fileBuffer.length, 'bytes, tipo:', mimeType, ')');
            
            const uploadResult = await whatsappService.uploadMedia(
              account.access_token,
              account.phone_number_id,
              fileBuffer,
              mimeType,
              account.id,
              account.name,
              tenantId
            );
            
            if (uploadResult.success) {
              console.log('✅ Upload concluído! Media ID:', uploadResult.mediaId);
              
              // Determinar o tipo correto baseado no MIME type
              let mediaTypeFromMime = 'image';
              if (mimeType.startsWith('video/')) mediaTypeFromMime = 'video';
              else if (mimeType.startsWith('audio/')) mediaTypeFromMime = 'audio';
              else if (mimeType.startsWith('application/')) mediaTypeFromMime = 'document';
              else if (mimeType.startsWith('image/')) mediaTypeFromMime = 'image';
              
              console.log('📋 Tipo detectado:', mediaTypeFromMime);
              
              // Usar o media_id e indicar que é ID, não URL
              finalMediaUrl = uploadResult.mediaId;
              finalMediaType = mediaTypeFromMime + '_id'; // Ex: 'video_id', 'image_id'
            } else {
              console.error('❌ Erro no upload:', uploadResult.error);
              throw new Error('Falha ao fazer upload da mídia: ' + uploadResult.error);
            }
          } else {
            console.error('❌ Arquivo não encontrado:', filePath);
            throw new Error('Arquivo de mídia não encontrado no servidor');
          }
        } catch (uploadError: any) {
          console.error('❌ Erro ao processar upload:', uploadError);
          throw new Error('Erro ao processar mídia: ' + uploadError.message);
        }
      }
      
      // Construir componentes com variáveis
      const components = whatsappService.buildTemplateComponents(variables || {});
      
      const result = await whatsappService.sendTemplateMessage({
        accessToken: account.access_token,
        phoneNumberId: account.phone_number_id,
        to: whatsappService.formatPhoneNumber(phone_number),
        templateName: template_name,
        languageCode: 'pt_BR',
        components: components,
        mediaUrl: finalMediaUrl,
        mediaType: finalMediaType,
        accountId: account.id,
        accountName: account.name,
        tenantId: tenantId,
      });

      if (result.success) {
        console.log('✅ Mensagem enviada com sucesso!');
        console.log('🆔 WhatsApp Message ID:', result.messageId);
        if (result.proxyUsed) {
          console.log('🌐 Proxy Usado:', result.proxyHost, `(${result.proxyType})`);
        }
        
        // Atualizar mensagem com o ID do WhatsApp e informações do proxy
        await MessageModel.updateStatus(message.id!, 'sent');
        await import('../database/connection').then(({ query }) => 
          query(
            `UPDATE messages 
             SET whatsapp_message_id = $1, 
                 sent_at = CURRENT_TIMESTAMP,
                 proxy_used = $2,
                 proxy_host = $3,
                 proxy_type = $4
             WHERE id = $5`,
            [result.messageId, result.proxyUsed || false, result.proxyHost || null, result.proxyType || null, message.id]
          )
        );

        // 💬 SALVAR NO CHAT TAMBÉM (mensagem enviada)
        await this.saveOutboundMessageToChat(
          phone_number,
          template_name,
          result.messageId,
          whatsapp_account_id,
          tenantId,
          (req as any).user?.id
        );
      } else {
        console.error('❌ Erro ao enviar:', result.error);
        await MessageModel.updateStatus(message.id!, 'failed');
        throw new Error(result.error);
      }

      const response = {
        success: true,
        data: message,
        message: 'Message queued for immediate sending',
      };
      
      console.log('📤 Enviando resposta:', response);
      return res.status(201).json(response);
    } catch (error: any) {
      console.error('❌ Error sending immediate message:', error);
      console.error('Stack trace:', error.stack);
      
      // Mensagens de erro mais específicas e em português
      let errorMessage = error.message || 'Falha ao enviar mensagem';
      
      if (error.message?.includes('tenantId é obrigatório')) {
        errorMessage = '🔐 Erro de autenticação: Faça login novamente';
      } else if (error.message?.includes('Template not found')) {
        errorMessage = '📝 Template não encontrado. Verifique se existe e está aprovado';
      } else if (error.message?.includes('#132012') || error.message?.includes('Parameter format does not match')) {
        // Erro de formato de mídia
        if (error.message?.includes('expected IMAGE')) {
          errorMessage = '🖼️ Este template requer uma IMAGEM. Faça upload de uma imagem antes de enviar';
        } else if (error.message?.includes('expected VIDEO')) {
          errorMessage = '🎥 Este template requer um VÍDEO. Faça upload de um vídeo antes de enviar';
        } else if (error.message?.includes('expected DOCUMENT')) {
          errorMessage = '📄 Este template requer um DOCUMENTO. Faça upload de um arquivo antes de enviar';
        } else {
          errorMessage = '📎 Erro de formato de mídia: Verifique se você enviou o tipo correto de arquivo para este template';
        }
      } else if (error.message?.includes('WhatsApp')) {
        errorMessage = `📱 Erro na API do WhatsApp: ${error.message}`;
      } else if (error.message?.includes('Invalid phone number')) {
        errorMessage = '📞 Número inválido. Use: DDI + DDD + Número (ex: 5562999999999)';
      } else if (error.message?.includes('access_token')) {
        errorMessage = '🔑 Token de acesso inválido. Configure novamente a conta WhatsApp';
      }
      
      return res.status(500).json({ 
        success: false, 
        error: errorMessage,
        originalError: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  async findAll(req: Request, res: Response) {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;
      const campaign_id = req.query.campaign_id ? parseInt(req.query.campaign_id as string) : null;
      const date_start = req.query.date_start as string;
      const date_end = req.query.date_end as string;
      const user_id = req.query.user_id ? parseInt(req.query.user_id as string) : null;

      if (campaign_id) {
        // Buscar mensagens de uma campanha específica
        const messages = await MessageModel.findByCampaign(campaign_id, limit, offset);
        return res.json({ success: true, data: messages });
      } else {
        // Buscar TODAS as mensagens com informações completas
        let query_text = `
          SELECT 
            m.*,
            w.name as account_name,
            c.name as campaign_name,
            m.user_id,
            COALESCE(tu.nome, 'Sistema') as user_name
          FROM messages m
          LEFT JOIN whatsapp_accounts w ON m.whatsapp_account_id = w.id
          LEFT JOIN campaigns c ON m.campaign_id = c.id
          LEFT JOIN tenant_users tu ON m.user_id = tu.id
          WHERE 1=1
        `;
        
        let query_params: any[] = [];
        let paramIndex = 1;

        // Filtro por data de início
        if (date_start) {
          query_text += ` AND m.created_at >= $${paramIndex}::date`;
          query_params.push(date_start);
          paramIndex++;
        }

        // Filtro por data de fim (inclui o dia inteiro)
        if (date_end) {
          query_text += ` AND m.created_at < ($${paramIndex}::date + INTERVAL '1 day')`;
          query_params.push(date_end);
          paramIndex++;
        }

        // Filtro por usuário
        if (user_id) {
          query_text += ` AND m.user_id = $${paramIndex}`;
          query_params.push(user_id);
          paramIndex++;
        }

        query_text += ` ORDER BY m.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        query_params.push(limit, offset);

        // Buscar total de mensagens com os mesmos filtros
        let countQuery = `SELECT COUNT(*) as total FROM messages m WHERE 1=1`;
        let countParams: any[] = [];
        let countIndex = 1;

        if (date_start) {
          countQuery += ` AND m.created_at >= $${countIndex}::date`;
          countParams.push(date_start);
          countIndex++;
        }

        if (date_end) {
          countQuery += ` AND m.created_at < ($${countIndex}::date + INTERVAL '1 day')`;
          countParams.push(date_end);
          countIndex++;
        }

        if (user_id) {
          countQuery += ` AND m.user_id = $${countIndex}`;
          countParams.push(user_id);
          countIndex++;
        }

        const countResult = await import('../database/connection').then(({ query }) =>
          query(countQuery, countParams)
        );
        const total = parseInt(countResult.rows[0]?.total || '0');

        // Buscar mensagens
        const result = await import('../database/connection').then(({ query }) =>
          query(query_text, query_params)
        );

        return res.json({ 
          success: true, 
          data: result.rows,
          total: total,
          limit: limit,
          offset: offset
        });
      }
    } catch (error: any) {
      console.error('Erro ao buscar mensagens:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async findById(req: Request, res: Response) {
    try {
      const tenantId = (req as any).tenant?.id;
      if (!tenantId) {
        return res.status(401).json({ success: false, error: 'Tenant não identificado' });
      }
      
      const message = await MessageModel.findById(parseInt(req.params.id), tenantId);
      
      if (!message) {
        return res.status(404).json({ success: false, error: 'Message not found' });
      }

      res.json({ success: true, data: message });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getQueueStats(req: Request, res: Response) {
    try {
      // Desabilitado temporariamente - sem Redis
      const stats = {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
      };
      res.json({ success: true, data: stats });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Salvar mensagem ENVIADA no chat (outbound)
   */
  private async saveOutboundMessageToChat(
    phoneNumber: string,
    templateName: string,
    whatsappMessageId: string,
    whatsappAccountId: number,
    tenantId: number,
    userId: number | null
  ) {
    try {
      // Normalizar número de telefone
      const { normalizePhoneNumber } = require('../utils/phone-normalizer');
      const normalizedPhone = normalizePhoneNumber(phoneNumber);
      
      console.log('\n💬 Salvando mensagem ENVIADA no chat...');
      console.log(`   📱 Para (original): ${phoneNumber}`);
      console.log(`   📱 Para (normalizado): ${normalizedPhone}`);
      console.log(`   📝 Template: ${templateName}`);

      // Buscar ou criar conversa - POR CONTA WHATSAPP
      let conversationId;
      const convCheck = await queryNoTenant(
        'SELECT id FROM conversations WHERE phone_number = $1 AND tenant_id = $2 AND whatsapp_account_id = $3',
        [normalizedPhone, tenantId, whatsappAccountId]
      );

      if (convCheck.rows.length > 0) {
        conversationId = convCheck.rows[0].id;
        console.log(`   ✅ Conversa existente: ${conversationId}`);
      } else {
        // Criar nova conversa
        const newConv = await queryNoTenant(
          `INSERT INTO conversations (
            phone_number,
            tenant_id,
            whatsapp_account_id,
            unread_count,
            last_message_at,
            last_message_text,
            last_message_direction
          ) VALUES ($1, $2, $3, 0, NOW(), $4, 'outbound')
          RETURNING id`,
          [normalizedPhone, tenantId, whatsappAccountId, `Template: ${templateName}`]
        );
        conversationId = newConv.rows[0].id;
        console.log(`   ✨ Nova conversa criada: ${conversationId}`);
      }

      // Verificar se mensagem já foi salva
      const duplicate = await queryNoTenant(
        'SELECT id FROM conversation_messages WHERE whatsapp_message_id = $1 AND tenant_id = $2',
        [whatsappMessageId, tenantId]
      );

      if (duplicate.rows.length > 0) {
        console.log('   ⚠️ Mensagem já salva no chat');
        return;
      }

      // Salvar mensagem ENVIADA
      await queryNoTenant(
        `INSERT INTO conversation_messages (
          conversation_id,
          message_direction,
          message_type,
          message_content,
          whatsapp_message_id,
          status,
          tenant_id,
          sent_by_user_id,
          is_read_by_agent
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          conversationId,
          'outbound',
          'template',
          `Template: ${templateName}`,
          whatsappMessageId,
          'sent',
          tenantId,
          userId,
          true // Já marcada como lida pois você enviou
        ]
      );

      // Atualizar conversa
      await queryNoTenant(
        `UPDATE conversations 
         SET last_message_at = NOW(),
             last_message_text = $1,
             last_message_direction = 'outbound',
             updated_at = NOW()
         WHERE id = $2`,
        [`Template: ${templateName}`, conversationId]
      );

      console.log('   ✅ Mensagem ENVIADA salva no chat!');

    } catch (error: any) {
      console.error('❌ Erro ao salvar mensagem enviada no chat:', error);
    }
  }
}

export const messageController = new MessageController();

