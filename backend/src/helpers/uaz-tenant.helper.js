/**
 * Helper para garantir isolamento de tenant nas queries UAZ
 * 🔒 SEGURANÇA CRÍTICA
 */

const { pool } = require('../database/connection');

/**
 * Buscar todas as instâncias UAZ do tenant
 */
async function getInstancesByTenant(tenantId) {
  if (!tenantId) {
    throw new Error('🔒 SEGURANÇA: tenantId é obrigatório');
  }

  const result = await pool.query(`
    SELECT 
      ui.*,
      p.name as proxy_name,
      p.host as proxy_host,
      p.port as proxy_port,
      p.username as proxy_username,
      p.password as proxy_password,
      p.type as proxy_type
    FROM uaz_instances ui
    LEFT JOIN proxies p ON ui.proxy_id = p.id
    WHERE ui.tenant_id = $1
    ORDER BY ui.created_at DESC
  `, [tenantId]);

  return result.rows;
}

/**
 * Buscar instância UAZ por ID (com verificação de tenant)
 */
async function getInstanceById(id, tenantId) {
  if (!tenantId) {
    throw new Error('🔒 SEGURANÇA: tenantId é obrigatório');
  }

  const result = await pool.query(`
    SELECT 
      ui.*,
      p.name as proxy_name,
      p.host as proxy_host,
      p.port as proxy_port,
      p.username as proxy_username,
      p.password as proxy_password,
      p.type as proxy_type
    FROM uaz_instances ui
    LEFT JOIN proxies p ON ui.proxy_id = p.id
    WHERE ui.id = $1 AND ui.tenant_id = $2
  `, [id, tenantId]);

  return result.rows[0];
}

/**
 * Criar instância UAZ para tenant
 */
async function createInstance(data, tenantId) {
  if (!tenantId) {
    throw new Error('🔒 SEGURANÇA: tenantId é obrigatório');
  }

  const result = await pool.query(
    `INSERT INTO uaz_instances (
      name, session_name, instance_token, tenant_id, proxy_id, webhook_url, is_active
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *`,
    [
      data.name,
      data.session_name,
      data.instance_token,
      tenantId,
      data.proxy_id || null,
      data.webhook_url || null,
      data.is_active !== false
    ]
  );

  return result.rows[0];
}

/**
 * Atualizar instância UAZ (com verificação de tenant)
 */
async function updateInstance(id, data, tenantId) {
  if (!tenantId) {
    throw new Error('🔒 SEGURANÇA: tenantId é obrigatório');
  }

  const fields = [];
  const values = [];
  let paramCount = 1;

  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined && key !== 'tenant_id' && key !== 'id') {
      fields.push(`${key} = $${paramCount}`);
      values.push(value);
      paramCount++;
    }
  });

  if (fields.length === 0) {
    throw new Error('Nenhum campo para atualizar');
  }

  fields.push(`updated_at = NOW()`);
  values.push(id, tenantId);

  const result = await pool.query(
    `UPDATE uaz_instances 
     SET ${fields.join(', ')}
     WHERE id = $${paramCount} AND tenant_id = $${paramCount + 1}
     RETURNING *`,
    values
  );

  return result.rows[0];
}

/**
 * Deletar instância UAZ (com verificação de tenant)
 */
async function deleteInstance(id, tenantId) {
  if (!tenantId) {
    throw new Error('🔒 SEGURANÇA: tenantId é obrigatório');
  }

  await pool.query(
    'DELETE FROM uaz_instances WHERE id = $1 AND tenant_id = $2',
    [id, tenantId]
  );

  return true;
}

/**
 * Verificar se instância pertence ao tenant
 */
async function verifyInstanceOwnership(id, tenantId) {
  if (!tenantId) {
    throw new Error('🔒 SEGURANÇA: tenantId é obrigatório');
  }

  const result = await pool.query(
    'SELECT id FROM uaz_instances WHERE id = $1 AND tenant_id = $2',
    [id, tenantId]
  );

  return result.rows.length > 0;
}

module.exports = {
  getInstancesByTenant,
  getInstanceById,
  createInstance,
  updateInstance,
  deleteInstance,
  verifyInstanceOwnership
};

