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

    // 🔥 REMOVER DUPLICADOS (mesmo phone_number)
    const uniqueContacts = contacts.filter((contact, index, self) =>
      index === self.findIndex((c) => c.phone_number === contact.phone_number)
    );
    
    console.log(`📞 Contatos únicos (após remover duplicados): ${uniqueContacts.length}`);

    const values: any[] = [];
    const placeholders: string[] = [];
    
    uniqueContacts.forEach((contact, index) => {
      const offset = index * 4; // Agora são 4 campos
      placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`);
      
      // Converter variáveis de array para objeto se necessário
      let varsToStore = contact.variables || {};
      if (Array.isArray(varsToStore)) {
        // Se for array, converter para objeto com índices numéricos
        const objVars: Record<string, string> = {};
        varsToStore.forEach((v, i) => {
          objVars[i.toString()] = String(v);
        });
        varsToStore = objVars;
        console.log(`📋 [Contact] Variáveis convertidas de array para objeto:`, varsToStore);
      }
      
      values.push(
        contact.phone_number,
        contact.name || null,
        JSON.stringify(varsToStore),
        tenantId
      );
    });

    console.log(`\n🔍 [ContactModel] INSERTING ${uniqueContacts.length} contacts with tenant_id: ${tenantId}`);
    console.log(`🔍 [ContactModel] First 3 phone numbers: ${uniqueContacts.slice(0, 3).map(c => c.phone_number).join(', ')}`);
    
    const result = await queryWithTenantId(
      tenantId,
      `INSERT INTO contacts (phone_number, name, variables, tenant_id)
       VALUES ${placeholders.join(', ')}
       ON CONFLICT (phone_number, tenant_id) DO UPDATE
       SET name = COALESCE(EXCLUDED.name, contacts.name),
           variables = EXCLUDED.variables,
           updated_at = NOW()
       RETURNING *`,
      values
    );
    
    console.log(`✅ [ContactModel] INSERT completed. Rows returned: ${result.rows.length}`);
    if (result.rows.length > 0) {
      console.log(`✅ [ContactModel] Sample returned contacts:`);
      result.rows.slice(0, 3).forEach((c, i) => {
        console.log(`   [${i+1}] ID: ${c.id}, Phone: ${c.phone_number}, Tenant: ${c.tenant_id}`);
      });
    } else {
      console.log(`⚠️  [ContactModel] NO ROWS RETURNED FROM INSERT! This might cause the campaign to have 0 messages!`);
    }
    
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

