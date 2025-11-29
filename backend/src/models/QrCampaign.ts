import { query } from '../database/connection';

export interface QrCampaign {
  id?: number;
  name: string;
  tenant_id?: number;
  status: 'pending' | 'scheduled' | 'running' | 'paused' | 'completed' | 'cancelled' | 'failed';
  scheduled_at?: Date;
  started_at?: Date;
  completed_at?: Date;
  pause_started_at?: Date;
  total_contacts: number;
  sent_count: number;
  delivered_count: number;
  read_count: number;
  failed_count: number;
  no_whatsapp_count: number;
  button_clicks_count: number;
  auto_remove_account_failures?: number;
  schedule_config?: any;
  pause_config?: any;
  created_at?: Date;
  updated_at?: Date;
}

export class QrCampaignModel {
  static async create(campaign: QrCampaign) {
    // 🔒 SEGURANÇA: tenant_id é obrigatório
    if (!campaign.tenant_id) {
      throw new Error('tenant_id é obrigatório para criar campanha QR');
    }
    const result = await query(
      `INSERT INTO qr_campaigns 
       (name, tenant_id, status, scheduled_at, schedule_config, pause_config, total_contacts)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        campaign.name,
        campaign.tenant_id,
        campaign.status || 'pending',
        campaign.scheduled_at,
        JSON.stringify(campaign.schedule_config || {}),
        JSON.stringify(campaign.pause_config || {}),
        campaign.total_contacts || 0,
      ]
    );
    return result.rows[0];
  }

  static async findAll(tenantId?: number) {
    // 🔒 SEGURANÇA: SEMPRE filtrar por tenant_id
    if (!tenantId) {
      throw new Error('tenantId é obrigatório para findAll');
    }
    const result = await query(
      'SELECT * FROM qr_campaigns WHERE tenant_id = $1 ORDER BY created_at DESC',
      [tenantId]
    );
    return result.rows;
  }

  static async findById(id: number, tenantId?: number) {
    // 🔒 SEGURANÇA: SEMPRE filtrar por tenant_id
    if (!tenantId) {
      throw new Error('tenantId é obrigatório para findById');
    }
    const result = await query(
      'SELECT * FROM qr_campaigns WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    return result.rows[0];
  }

  static async update(id: number, campaign: Partial<QrCampaign>, tenantId?: number) {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    Object.entries(campaign).forEach(([key, value]) => {
      if (value !== undefined && key !== 'tenant_id') { // Não permitir alterar tenant_id
        if (key === 'schedule_config' || key === 'pause_config') {
          fields.push(`${key} = $${paramCount}`);
          values.push(JSON.stringify(value));
        } else {
          fields.push(`${key} = $${paramCount}`);
          values.push(value);
        }
        paramCount++;
      }
    });

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    // 🔒 SEGURANÇA: SEMPRE filtrar por tenant_id
    let whereClause = `id = $${paramCount}`;
    if (tenantId) {
      paramCount++;
      whereClause += ` AND tenant_id = $${paramCount}`;
      values.push(tenantId);
    }

    const result = await query(
      `UPDATE qr_campaigns SET ${fields.join(', ')} WHERE ${whereClause} RETURNING *`,
      values
    );
    return result.rows[0];
  }

  static async updateStats(id: number, stats: {
    sent_count?: number;
    delivered_count?: number;
    read_count?: number;
    failed_count?: number;
    no_whatsapp_count?: number;
    button_clicks_count?: number;
  }, tenantId?: number) {
    // 🔒 SEGURANÇA: Adicionar filtro tenant_id se fornecido
    let whereClause = 'id = $7';
    const params = [stats.sent_count, stats.delivered_count, stats.read_count, stats.failed_count, stats.no_whatsapp_count, stats.button_clicks_count, id];
    
    if (tenantId) {
      whereClause += ' AND tenant_id = $8';
      params.push(tenantId);
    }
    
    const result = await query(
      `UPDATE qr_campaigns 
       SET sent_count = COALESCE($1, sent_count),
           delivered_count = COALESCE($2, delivered_count),
           read_count = COALESCE($3, read_count),
           failed_count = COALESCE($4, failed_count),
           no_whatsapp_count = COALESCE($5, no_whatsapp_count),
           button_clicks_count = COALESCE($6, button_clicks_count),
           updated_at = CURRENT_TIMESTAMP
       WHERE ${whereClause}
       RETURNING *`,
      params
    );
    return result.rows[0];
  }

  static async delete(id: number, tenantId?: number) {
    // 🔒 SEGURANÇA: SEMPRE filtrar por tenant_id
    if (!tenantId) {
      throw new Error('tenantId é obrigatório para delete');
    }
    await query('DELETE FROM qr_campaigns WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    return true;
  }

  static async getScheduledCampaigns(tenantId?: number) {
    // 🔒 SEGURANÇA: Filtrar por tenant_id se fornecido (workers podem passar)
    let whereClause = "status = 'scheduled' AND scheduled_at <= NOW()";
    const params: any[] = [];
    
    if (tenantId) {
      whereClause += ' AND tenant_id = $1';
      params.push(tenantId);
    }
    
    const result = await query(
      `SELECT * FROM qr_campaigns 
       WHERE ${whereClause}
       ORDER BY scheduled_at ASC`,
      params
    );
    return result.rows;
  }
}

