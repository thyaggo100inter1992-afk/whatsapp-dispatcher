import { queryWithTenantId } from '../database/tenant-query';

export interface Contact {
  id?: number;
  phone_number: string;
  name?: string;
  variables?: Record<string, any>;
  tenant_id?: number;
  created_at?: Date;
  updated_at?: Date;
}

export class ContactModel {
  static async create(contact: Contact) {
    if (!contact.tenant_id) {
      throw new Error('tenant_id é obrigatório para criar contato');
    }
    const result = await queryWithTenantId(
      contact.tenant_id,
      `INSERT INTO contacts (phone_number, name, variables, tenant_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [contact.phone_number, contact.name, JSON.stringify(contact.variables || {}), contact.tenant_id]
    );
    return result.rows[0];
  }

  static async createBulk(contacts: Contact[], tenantId?: number) {
    // 🔒 SEGURANÇA: OBRIGA tenant_id
    if (!tenantId) {
      throw new Error('tenantId é obrigatório para createBulk');
    }
    
    console.log(`📞 Total de contatos recebidos: ${contacts.length}`);
    
    if (contacts.length === 0) {
      return [];
    }

    const values: any[] = [];
    const placeholders: string[] = [];
    
    contacts.forEach((contact, index) => {
      const offset = index * 4; // Agora são 4 campos
      placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`);
      values.push(
        contact.phone_number,
        contact.name || null,
        JSON.stringify(contact.variables || {}),
        tenantId
      );
    });

    const result = await queryWithTenantId(
      tenantId,
      `INSERT INTO contacts (phone_number, name, variables, tenant_id)
       VALUES ${placeholders.join(', ')}
       ON CONFLICT (phone_number) DO UPDATE
       SET name = COALESCE(EXCLUDED.name, contacts.name),
           variables = COALESCE(EXCLUDED.variables, contacts.variables),
           updated_at = NOW()
       RETURNING *`,
      values
    );
    return result.rows;
  }

  static async findAll(tenantId?: number, limit = 100, offset = 0) {
    // 🔒 SEGURANÇA: OBRIGA tenant_id
    if (!tenantId) {
      throw new Error('tenantId é obrigatório para findAll');
    }
    const result = await queryWithTenantId(
      tenantId,
      'SELECT * FROM contacts WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [tenantId, limit, offset]
    );
    return result.rows;
  }

  static async findById(id: number, tenantId?: number) {
    // 🔒 SEGURANÇA: OBRIGA tenant_id
    if (!tenantId) {
      throw new Error('tenantId é obrigatório para findById');
    }
    const result = await queryWithTenantId(
      tenantId,
      'SELECT * FROM contacts WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    return result.rows[0];
  }

  static async findByPhoneNumber(phone_number: string, tenantId?: number) {
    // 🔒 SEGURANÇA: OBRIGA tenant_id
    if (!tenantId) {
      throw new Error('tenantId é obrigatório para findByPhoneNumber');
    }
    const result = await queryWithTenantId(
      tenantId,
      'SELECT * FROM contacts WHERE phone_number = $1 AND tenant_id = $2',
      [phone_number, tenantId]
    );
    return result.rows[0];
  }

  static async count(tenantId?: number) {
    // 🔒 SEGURANÇA: OBRIGA tenant_id
    if (!tenantId) {
      throw new Error('tenantId é obrigatório para count');
    }
    const result = await queryWithTenantId(tenantId, 'SELECT COUNT(*) as total FROM contacts WHERE tenant_id = $1', [tenantId]);
    return parseInt(result.rows[0].total);
  }
}

