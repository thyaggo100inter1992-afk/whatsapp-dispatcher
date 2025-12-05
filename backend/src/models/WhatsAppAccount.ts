import { query } from '../database/connection';

export interface WhatsAppAccount {
  id?: number;
  name: string;
  phone_number: string;
  access_token: string;
  phone_number_id: string;
  business_account_id?: string;
  app_id?: string;
  webhook_verify_token?: string;
  is_active: boolean;
  display_order?: number;
  proxy_id?: number | null;
  created_at?: Date;
  updated_at?: Date;
}

export class WhatsAppAccountModel {
  static async create(account: WhatsAppAccount, tenantId: number) {
    // Buscar o maior display_order atual para este tenant
    const maxOrderResult = await query(
      'SELECT COALESCE(MAX(display_order), 0) as max_order FROM whatsapp_accounts WHERE tenant_id = $1',
      [tenantId]
    );
    const nextOrder = (maxOrderResult.rows[0]?.max_order || 0) + 10;
    
    const result = await query(
      `INSERT INTO whatsapp_accounts 
       (name, phone_number, access_token, phone_number_id, business_account_id, app_id, webhook_verify_token, is_active, display_order, proxy_id, tenant_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        account.name,
        account.phone_number,
        account.access_token,
        account.phone_number_id,
        account.business_account_id,
        account.app_id,
        account.webhook_verify_token,
        account.is_active,
        nextOrder,
        account.proxy_id || null,
        tenantId,
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
      'SELECT * FROM whatsapp_accounts WHERE tenant_id = $1 ORDER BY display_order ASC, created_at DESC',
      [tenantId]
    );
    return result.rows;
  }

  static async findActive(tenantId?: number) {
    // 🔒 SEGURANÇA: SEMPRE filtrar por tenant_id
    if (!tenantId) {
      throw new Error('tenantId é obrigatório para findActive');
    }
    const result = await query(
      'SELECT * FROM whatsapp_accounts WHERE is_active = true AND tenant_id = $1 ORDER BY display_order ASC, created_at DESC',
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
      'SELECT * FROM whatsapp_accounts WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    return result.rows[0];
  }

  static async update(id: number, account: Partial<WhatsAppAccount>, tenantId?: number) {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    Object.entries(account).forEach(([key, value]) => {
      if (value !== undefined) {
        fields.push(`${key} = $${paramCount}`);
        values.push(value);
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
      `UPDATE whatsapp_accounts SET ${fields.join(', ')} WHERE ${whereClause} RETURNING *`,
      values
    );
    return result.rows[0];
  }

  static async delete(id: number, tenantId?: number) {
    // 🔒 SEGURANÇA: SEMPRE filtrar por tenant_id
    if (!tenantId) {
      throw new Error('tenantId é obrigatório para delete');
    }
    await query('DELETE FROM whatsapp_accounts WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    return true;
  }

  static async toggleActive(id: number, tenantId?: number) {
    // 🔒 SEGURANÇA: SEMPRE filtrar por tenant_id
    if (!tenantId) {
      throw new Error('tenantId é obrigatório para toggleActive');
    }
    const result = await query(
      `UPDATE whatsapp_accounts SET is_active = NOT is_active, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1 AND tenant_id = $2 RETURNING *`,
      [id, tenantId]
    );
    return result.rows[0];
  }

  static async deactivate(id: number, tenantId?: number) {
    // 🔒 SEGURANÇA: SEMPRE filtrar por tenant_id
    if (!tenantId) {
      throw new Error('tenantId é obrigatório para deactivate');
    }
    const result = await query(
      `UPDATE whatsapp_accounts SET is_active = false, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1 AND tenant_id = $2 RETURNING *`,
      [id, tenantId]
    );
    return result.rows[0];
  }

  static async deactivateAll(tenantId?: number) {
    // 🔒 SEGURANÇA: SEMPRE filtrar por tenant_id
    if (!tenantId) {
      throw new Error('tenantId é obrigatório para deactivateAll');
    }
    const result = await query(
      `UPDATE whatsapp_accounts SET is_active = false, updated_at = CURRENT_TIMESTAMP 
       WHERE tenant_id = $1 RETURNING *`,
      [tenantId]
    );
    return result.rows.length;
  }

  static async activate(id: number, tenantId?: number) {
    // 🔒 SEGURANÇA: SEMPRE filtrar por tenant_id
    if (!tenantId) {
      throw new Error('tenantId é obrigatório para activate');
    }
    const result = await query(
      `UPDATE whatsapp_accounts SET is_active = true, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1 AND tenant_id = $2 RETURNING *`,
      [id, tenantId]
    );
    return result.rows[0];
  }

  static async activateAll(tenantId?: number) {
    // 🔒 SEGURANÇA: SEMPRE filtrar por tenant_id
    if (!tenantId) {
      throw new Error('tenantId é obrigatório para activateAll');
    }
    const result = await query(
      `UPDATE whatsapp_accounts SET is_active = true, updated_at = CURRENT_TIMESTAMP 
       WHERE tenant_id = $1 RETURNING *`,
      [tenantId]
    );
    return result.rows.length;
  }
}


