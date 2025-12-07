import { Request, Response } from 'express';
import { query } from '../database/connection';
const { queryNoTenant } = require('../database/connection');

export class ConversationController {
  /**
   * GET /api/conversations
   * Lista todas as conversas do tenant
   */
  async list(req: Request, res: Response) {
    try {
      const tenantId = (req as any).tenant?.id;
      if (!tenantId) {
        return res.status(401).json({ success: false, error: 'Tenant não identificado' });
      }

      const {
        filter = 'all', // all, unread, archived
        search = '',
        limit = 50,
        offset = 0
      } = req.query;

      let whereClause = 'WHERE c.tenant_id = $1';
      const params: any[] = [tenantId];
      let paramIndex = 2;

      // Filtro por status
      if (filter === 'unread') {
        whereClause += ' AND c.unread_count > 0';
      } else if (filter === 'archived') {
        whereClause += ' AND c.is_archived = true';
      } else {
        whereClause += ' AND c.is_archived = false';
      }

      // Busca por nome ou número
      if (search) {
        whereClause += ` AND (c.phone_number ILIKE $${paramIndex} OR c.contact_name ILIKE $${paramIndex})`;
        params.push(`%${search}%`);
        paramIndex++;
      }

      const sql = `
        SELECT 
          c.id,
          c.phone_number,
          c.contact_name,
          c.last_message_at,
          c.last_message_text,
          c.last_message_direction,
          c.unread_count,
          c.is_archived,
          c.whatsapp_account_id,
          c.instance_id,
          c.metadata,
          c.created_at,
          c.updated_at,
          w.name as whatsapp_account_name,
          u.name as instance_name
        FROM conversations c
        LEFT JOIN whatsapp_accounts w ON c.whatsapp_account_id = w.id
        LEFT JOIN uaz_instances u ON c.instance_id = u.id
        ${whereClause}
        ORDER BY c.last_message_at DESC NULLS LAST
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      params.push(limit, offset);

      const result = await query(sql, params);

      // Contar total
      const countSql = `
        SELECT COUNT(*) as total
        FROM conversations c
        ${whereClause}
      `;
      const countResult = await query(countSql, params.slice(0, paramIndex - 1));

      return res.json({
        success: true,
        data: result.rows,
        total: parseInt(countResult.rows[0]?.total || '0'),
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      });

    } catch (error: any) {
      console.error('❌ Erro ao listar conversas:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/conversations/:id
   * Busca uma conversa específica
   */
  async getById(req: Request, res: Response) {
    try {
      const tenantId = (req as any).tenant?.id;
      if (!tenantId) {
        return res.status(401).json({ success: false, error: 'Tenant não identificado' });
      }

      const { id } = req.params;

      const sql = `
        SELECT 
          c.*,
          w.name as whatsapp_account_name,
          u.name as instance_name
        FROM conversations c
        LEFT JOIN whatsapp_accounts w ON c.whatsapp_account_id = w.id
        LEFT JOIN uaz_instances u ON c.instance_id = u.id
        WHERE c.id = $1 AND c.tenant_id = $2
      `;

      const result = await query(sql, [id, tenantId]);

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Conversa não encontrada' });
      }

      return res.json({ success: true, data: result.rows[0] });

    } catch (error: any) {
      console.error('❌ Erro ao buscar conversa:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/conversations/:id/messages
   * Lista mensagens de uma conversa
   */
  async getMessages(req: Request, res: Response) {
    try {
      const tenantId = (req as any).tenant?.id;
      if (!tenantId) {
        return res.status(401).json({ success: false, error: 'Tenant não identificado' });
      }

      const { id } = req.params;
      const { limit = 50, offset = 0 } = req.query;

      // Verificar se a conversa pertence ao tenant
      const checkConv = await query(
        'SELECT id FROM conversations WHERE id = $1 AND tenant_id = $2',
        [id, tenantId]
      );

      if (checkConv.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Conversa não encontrada' });
      }

      const sql = `
        SELECT 
          cm.*,
          tu.nome as sent_by_user_name
        FROM conversation_messages cm
        LEFT JOIN tenant_users tu ON cm.sent_by_user_id = tu.id
        WHERE cm.conversation_id = $1 AND cm.tenant_id = $2
        ORDER BY cm.created_at DESC
        LIMIT $3 OFFSET $4
      `;

      const result = await query(sql, [id, tenantId, limit, offset]);

      // Contar total
      const countResult = await query(
        'SELECT COUNT(*) as total FROM conversation_messages WHERE conversation_id = $1 AND tenant_id = $2',
        [id, tenantId]
      );

      return res.json({
        success: true,
        data: result.rows.reverse(), // Inverter para ordem cronológica
        total: parseInt(countResult.rows[0]?.total || '0'),
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      });

    } catch (error: any) {
      console.error('❌ Erro ao buscar mensagens:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/conversations/:id/messages
   * Envia uma mensagem em uma conversa
   */
  async sendMessage(req: Request, res: Response) {
    try {
      const tenantId = (req as any).tenant?.id;
      const userId = (req as any).user?.id;
      
      if (!tenantId) {
        return res.status(401).json({ success: false, error: 'Tenant não identificado' });
      }

      const { id } = req.params;
      const { message_content, message_type = 'text', media_url } = req.body;

      if (!message_content && !media_url) {
        return res.status(400).json({ success: false, error: 'Mensagem ou mídia é obrigatória' });
      }

      // Buscar conversa
      const convResult = await query(
        `SELECT * FROM conversations WHERE id = $1 AND tenant_id = $2`,
        [id, tenantId]
      );

      if (convResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Conversa não encontrada' });
      }

      const conversation = convResult.rows[0];

      // Criar mensagem no banco
      const insertSql = `
        INSERT INTO conversation_messages (
          conversation_id,
          message_direction,
          message_type,
          message_content,
          media_url,
          status,
          sent_by_user_id,
          tenant_id,
          is_read_by_agent
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;

      const messageResult = await query(insertSql, [
        id,
        'outbound',
        message_type,
        message_content,
        media_url || null,
        'sending',
        userId,
        tenantId,
        true // Já marcada como lida pelo agente pois ele enviou
      ]);

      const savedMessage = messageResult.rows[0];

      // ENVIAR VIA WHATSAPP API
      try {
        let whatsappResult;

        if (conversation.whatsapp_account_id) {
          // Enviar via API Oficial
          const { whatsappService } = await import('../services/whatsapp.service');
          const { WhatsAppAccountModel } = await import('../models/WhatsAppAccount');
          
          const account = await WhatsAppAccountModel.findById(conversation.whatsapp_account_id, tenantId);
          
          if (!account) {
            throw new Error('Conta WhatsApp não encontrada');
          }

          // Enviar mensagem de texto livre (funciona após cliente responder)
          whatsappResult = await whatsappService.sendFreeTextMessage({
            accessToken: account.access_token,
            phoneNumberId: account.phone_number_id,
            to: conversation.phone_number,
            text: message_content,
            accountId: account.id,
            accountName: account.name,
            tenantId
          });

        } else if (conversation.instance_id) {
          // Enviar via UAZ/QR Connect
          const UazService = require('../services/uazService');
          
          whatsappResult = await UazService.sendMessage(
            conversation.instance_id,
            conversation.phone_number,
            message_content,
            message_type,
            media_url,
            tenantId
          );
        }

        // Atualizar status da mensagem
        if (whatsappResult && whatsappResult.success) {
          await query(
            `UPDATE conversation_messages 
             SET status = $1, whatsapp_message_id = $2, updated_at = NOW()
             WHERE id = $3`,
            ['sent', whatsappResult.messageId || null, savedMessage.id]
          );
          savedMessage.status = 'sent';
          savedMessage.whatsapp_message_id = whatsappResult.messageId;
        } else {
          await query(
            `UPDATE conversation_messages 
             SET status = $1, error_message = $2, updated_at = NOW()
             WHERE id = $3`,
            ['failed', whatsappResult?.error || 'Erro desconhecido', savedMessage.id]
          );
          savedMessage.status = 'failed';
        }

        // Atualizar conversa
        await query(
          `UPDATE conversations 
           SET last_message_at = NOW(),
               last_message_text = $1,
               last_message_direction = 'outbound',
               updated_at = NOW()
           WHERE id = $2`,
          [message_content?.substring(0, 100) || '[Mídia]', id]
        );

        // Emitir evento Socket.IO
        const io = (req as any).app.get('io');
        if (io) {
          io.to(`tenant:${tenantId}`).emit('chat:message-sent', {
            conversationId: parseInt(id),
            message: savedMessage
          });
        }

        return res.json({
          success: true,
          data: savedMessage
        });

      } catch (sendError: any) {
        console.error('❌ Erro ao enviar mensagem via WhatsApp:', sendError);
        
        // Atualizar mensagem como falha
        await query(
          `UPDATE conversation_messages 
           SET status = $1, error_message = $2, updated_at = NOW()
           WHERE id = $3`,
          ['failed', sendError.message, savedMessage.id]
        );

        return res.status(500).json({
          success: false,
          error: `Erro ao enviar: ${sendError.message}`,
          data: { ...savedMessage, status: 'failed' }
        });
      }

    } catch (error: any) {
      console.error('❌ Erro ao processar envio de mensagem:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * PUT /api/conversations/:id/read
   * Marca conversa como lida
   */
  async markAsRead(req: Request, res: Response) {
    try {
      const tenantId = (req as any).tenant?.id;
      const userId = (req as any).user?.id;
      
      if (!tenantId) {
        return res.status(401).json({ success: false, error: 'Tenant não identificado' });
      }

      const { id } = req.params;

      // Atualizar mensagens não lidas
      await query(
        `UPDATE conversation_messages 
         SET is_read_by_agent = true,
             read_by_agent_at = NOW(),
             read_by_agent_user_id = $1,
             updated_at = NOW()
         WHERE conversation_id = $2 
           AND tenant_id = $3 
           AND message_direction = 'inbound'
           AND is_read_by_agent = false`,
        [userId, id, tenantId]
      );

      // Zerar contador de não lidas
      await query(
        `UPDATE conversations 
         SET unread_count = 0, updated_at = NOW()
         WHERE id = $1 AND tenant_id = $2`,
        [id, tenantId]
      );

      // Emitir evento Socket.IO
      const io = (req as any).app.get('io');
      if (io) {
        io.to(`tenant:${tenantId}`).emit('chat:conversation-read', {
          conversationId: parseInt(id)
        });
      }

      return res.json({ success: true });

    } catch (error: any) {
      console.error('❌ Erro ao marcar como lida:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * PUT /api/conversations/:id/archive
   * Arquiva/desarquiva conversa
   */
  async toggleArchive(req: Request, res: Response) {
    try {
      const tenantId = (req as any).tenant?.id;
      if (!tenantId) {
        return res.status(401).json({ success: false, error: 'Tenant não identificado' });
      }

      const { id } = req.params;
      const { is_archived } = req.body;

      await query(
        `UPDATE conversations 
         SET is_archived = $1, updated_at = NOW()
         WHERE id = $2 AND tenant_id = $3`,
        [is_archived, id, tenantId]
      );

      return res.json({ success: true });

    } catch (error: any) {
      console.error('❌ Erro ao arquivar conversa:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/conversations/unread-count
   * Conta mensagens não lidas
   */
  async getUnreadCount(req: Request, res: Response) {
    try {
      const tenantId = (req as any).tenant?.id;
      if (!tenantId) {
        return res.status(401).json({ success: false, error: 'Tenant não identificado' });
      }

      const result = await query(
        `SELECT SUM(unread_count) as total 
         FROM conversations 
         WHERE tenant_id = $1 AND is_archived = false`,
        [tenantId]
      );

      return res.json({
        success: true,
        unread_count: parseInt(result.rows[0]?.total || '0')
      });

    } catch (error: any) {
      console.error('❌ Erro ao contar não lidas:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/conversations/create
   * Cria nova conversa (iniciar chat com número novo)
   */
  async create(req: Request, res: Response) {
    try {
      const tenantId = (req as any).tenant?.id;
      if (!tenantId) {
        return res.status(401).json({ success: false, error: 'Tenant não identificado' });
      }

      const { phone_number, contact_name, initial_message } = req.body;

      if (!phone_number) {
        return res.status(400).json({ success: false, error: 'Número de telefone é obrigatório' });
      }

      // Verificar se conversa já existe
      const existing = await query(
        'SELECT id FROM conversations WHERE phone_number = $1 AND tenant_id = $2',
        [phone_number, tenantId]
      );

      if (existing.rows.length > 0) {
        return res.json({
          success: true,
          data: existing.rows[0],
          message: 'Conversa já existe'
        });
      }

      // Criar conversa
      const insertSql = `
        INSERT INTO conversations (
          phone_number,
          contact_name,
          tenant_id,
          unread_count
        ) VALUES ($1, $2, $3, 0)
        RETURNING *
      `;

      const result = await query(insertSql, [phone_number, contact_name || null, tenantId]);

      // Se houver mensagem inicial, enviar
      if (initial_message) {
        // Redirecionar para sendMessage
        req.params.id = result.rows[0].id;
        req.body.message_content = initial_message;
        return await this.sendMessage(req, res);
      }

      return res.json({ success: true, data: result.rows[0] });

    } catch (error: any) {
      console.error('❌ Erro ao criar conversa:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }
}

export const conversationController = new ConversationController();

