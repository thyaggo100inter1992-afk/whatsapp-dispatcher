import { query } from '../database/connection';
import { queryWithTenantId } from '../database/tenant-query';

export interface Message {
  id?: number;
  campaign_id?: number;
  campaign_template_id?: number;
  contact_id: number;
  whatsapp_account_id: number;
  whatsapp_message_id?: string;
  phone_number: string;
  template_name: string;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  sent_at?: Date;
  delivered_at?: Date;
  read_at?: Date;
  failed_at?: Date;
  error_message?: string;
  media_url?: string;
  tenant_id?: number;
  created_at?: Date;
  updated_at?: Date;
}

export class MessageModel {
  static async create(message: Message) {
    if (!message.tenant_id) {
      throw new Error('tenant_id é obrigatório para criar mensagem');
    }
    const result = await queryWithTenantId(
      message.tenant_id,
      `INSERT INTO messages 
       (campaign_id, campaign_template_id, contact_id, whatsapp_account_id, phone_number, template_name, status, media_url, tenant_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        message.campaign_id,
        message.campaign_template_id,
        message.contact_id,
        message.whatsapp_account_id,
        message.phone_number,
        message.template_name,
        message.status || 'pending',
        message.media_url,
        message.tenant_id,
      ]
    );
    return result.rows[0];
  }

  static async updateStatus(
    id: number,
    status: Message['status'],
    whatsapp_message_id?: string,
    error_message?: string,
    tenantId?: number
  ) {
    // 🔒 SEGURANÇA: Filtrar por tenant_id se fornecido
    const statusField = `${status}_at`;
    let whereClause = 'id = $4';
    const params = [status, whatsapp_message_id, error_message, id];
    
    if (tenantId) {
      whereClause += ' AND tenant_id = $5';
      params.push(tenantId);
    }
    
    const executor = tenantId ? queryWithTenantId.bind(null, tenantId) : query;
    const result = await executor(
      `UPDATE messages 
       SET status = $1, 
           whatsapp_message_id = COALESCE($2, whatsapp_message_id),
           ${statusField} = CURRENT_TIMESTAMP,
           error_message = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE ${whereClause}
       RETURNING *`,
      params
    );
    return result.rows[0];
  }

  static async findById(id: number, tenantId?: number) {
    // 🔒 SEGURANÇA: Filtrar por tenant_id se fornecido
    let whereClause = 'id = $1';
    const params: any[] = [id];
    
    if (tenantId) {
      whereClause += ' AND tenant_id = $2';
      params.push(tenantId);
    }
    
    const executor = tenantId ? queryWithTenantId.bind(null, tenantId) : query;
    const result = await executor(
      `SELECT * FROM messages WHERE ${whereClause}`,
      params
    );
    return result.rows[0];
  }

  static async findByCampaign(campaign_id: number, limit = 100, offset = 0) {
    const result = await query(
      `SELECT m.*, c.name as contact_name, w.name as account_name
       FROM messages m
       LEFT JOIN contacts c ON m.contact_id = c.id
       LEFT JOIN whatsapp_accounts w ON m.whatsapp_account_id = w.id
       WHERE m.campaign_id = $1
       ORDER BY m.created_at DESC
       LIMIT $2 OFFSET $3`,
      [campaign_id, limit, offset]
    );
    return result.rows;
  }

  static async getCampaignStats(campaign_id: number) {
    const result = await query(
      `SELECT 
         COUNT(*) FILTER (WHERE status = 'sent') as sent_count,
         COUNT(*) FILTER (WHERE status = 'delivered') as delivered_count,
         COUNT(*) FILTER (WHERE status = 'read') as read_count,
         COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
         COUNT(*) FILTER (WHERE status = 'pending') as pending_count
       FROM messages
       WHERE campaign_id = $1`,
      [campaign_id]
    );
    return result.rows[0];
  }

  /**
   * Contar números que não têm WhatsApp
   */
  static async getNoWhatsAppCount(campaign_id: number) {
    const result = await query(
      `SELECT COUNT(*) as no_whatsapp_count
       FROM messages
       WHERE campaign_id = $1 
       AND status = 'failed' 
       AND (
         error_message ILIKE '%not registered%' 
         OR error_message ILIKE '%no whatsapp%'
         OR error_message ILIKE '%invalid phone%'
         OR error_message ILIKE '%not a whatsapp user%'
         OR error_message ILIKE '%131026%'
         OR error_message ILIKE '%undeliverable%'
       )`,
      [campaign_id]
    );
    return parseInt(result.rows[0].no_whatsapp_count) || 0;
  }

  /**
   * Contar cliques nos botões da campanha
   */
  static async getButtonClicksCount(campaign_id: number) {
    const result = await query(
      `SELECT COUNT(*) as button_clicks_count
       FROM button_clicks
       WHERE campaign_id = $1`,
      [campaign_id]
    );
    return parseInt(result.rows[0].button_clicks_count) || 0;
  }
}


