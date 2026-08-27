/**
 * Usuário do disparador nas APIs de integração com o sistema de vendas.
 * A chave nsk_ identifica o tenant. O user_id escolhido no vendas
 * define permissões, conexões e contabilização de envios.
 */

const { pool } = require('../database/connection');

function isTenantOwner(user) {
  return user && (user.role === 'admin' || user.role === 'super_admin');
}

function extractActingUserId(req) {
  const header = req.headers['x-dispatcher-user-id'] || req.headers['x-user-id'];
  const body = req.body || {};
  const query = req.query || {};
  const raw =
    header ||
    body.user_id ||
    body.dispatcher_user_id ||
    query.user_id ||
    query.dispatcher_user_id;
  const id = parseInt(String(raw || ''), 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

async function loadActingUser(tenantId, userId) {
  const result = await pool.query(
    `SELECT id, tenant_id, nome, email, role, permissoes, ativo, email_verificado
     FROM tenant_users
     WHERE id = $1 AND tenant_id = $2 AND ativo = true
     LIMIT 1`,
    [userId, tenantId]
  );
  return result.rows[0] || null;
}

async function loadDefaultTenantUser(tenantId) {
  const result = await pool.query(
    `SELECT id, tenant_id, nome, email, role, permissoes, ativo, email_verificado
     FROM tenant_users
     WHERE tenant_id = $1 AND ativo = true
     ORDER BY CASE WHEN role = 'admin' THEN 0 WHEN role = 'super_admin' THEN 1 ELSE 2 END, id
     LIMIT 1`,
    [tenantId]
  );
  return result.rows[0] || null;
}

async function resolveActingUser(req, tenantId) {
  const actingId = extractActingUserId(req);
  if (actingId) {
    const user = await loadActingUser(tenantId, actingId);
    if (!user) {
      return {
        erro: {
          status: 403,
          mensagem: 'Usuário do disparador não encontrado neste tenant ou está inativo',
        },
      };
    }
    return { usuario: user, viaUserId: true };
  }

  const fallback = await loadDefaultTenantUser(tenantId);
  if (!fallback) {
    return {
      erro: {
        status: 401,
        mensagem: 'Nenhum usuário ativo no tenant',
      },
    };
  }
  return { usuario: fallback, viaUserId: false };
}

async function userHasOficialAccount(tenantId, user, accountId) {
  if (!user || !accountId) return false;
  if (isTenantOwner(user)) {
    const result = await pool.query(
      `SELECT id FROM whatsapp_accounts
       WHERE id = $1 AND tenant_id = $2 AND is_active = true`,
      [accountId, tenantId]
    );
    return result.rows.length > 0;
  }
  const result = await pool.query(
    `SELECT 1
     FROM user_whatsapp_accounts uwa
     INNER JOIN whatsapp_accounts wa ON wa.id = uwa.whatsapp_account_id
     WHERE uwa.user_id = $1
       AND uwa.tenant_id = $2
       AND uwa.whatsapp_account_id = $3
       AND wa.is_active = true
     LIMIT 1`,
    [user.id, tenantId, accountId]
  );
  return result.rows.length > 0;
}

async function userHasQrInstance(tenantId, user, instanceId) {
  if (!user || !instanceId) return false;
  if (isTenantOwner(user)) {
    const result = await pool.query(
      `SELECT id FROM uaz_instances
       WHERE id = $1 AND tenant_id = $2 AND is_active = true`,
      [instanceId, tenantId]
    );
    return result.rows.length > 0;
  }
  const result = await pool.query(
    `SELECT 1
     FROM user_uaz_instances uui
     INNER JOIN uaz_instances ui ON ui.id = uui.uaz_instance_id
     WHERE uui.user_id = $1
       AND uui.tenant_id = $2
       AND uui.uaz_instance_id = $3
       AND ui.is_active = true
     LIMIT 1`,
    [user.id, tenantId, instanceId]
  );
  return result.rows.length > 0;
}

async function listOficialAccounts(tenantId, user) {
  if (isTenantOwner(user)) {
    const result = await pool.query(
      `SELECT id, name, phone_number, is_active
       FROM whatsapp_accounts
       WHERE tenant_id = $1 AND is_active = true
       ORDER BY display_order ASC NULLS LAST, created_at DESC`,
      [tenantId]
    );
    return result.rows;
  }
  const result = await pool.query(
    `SELECT wa.id, wa.name, wa.phone_number, wa.is_active
     FROM whatsapp_accounts wa
     INNER JOIN user_whatsapp_accounts uwa ON wa.id = uwa.whatsapp_account_id
     WHERE uwa.user_id = $1 AND uwa.tenant_id = $2 AND wa.is_active = true
     ORDER BY wa.display_order ASC NULLS LAST, wa.created_at DESC`,
    [user.id, tenantId]
  );
  return result.rows;
}

async function listQrInstances(tenantId, user) {
  if (isTenantOwner(user)) {
    const result = await pool.query(
      `SELECT id, name, session_name, phone_number, profile_name, status, is_active, is_connected
       FROM uaz_instances
       WHERE tenant_id = $1 AND is_active = true
       ORDER BY display_order ASC NULLS LAST, created_at DESC`,
      [tenantId]
    );
    return result.rows;
  }
  const result = await pool.query(
    `SELECT ui.id, ui.name, ui.session_name, ui.phone_number, ui.profile_name,
            ui.status, ui.is_active, ui.is_connected
     FROM uaz_instances ui
     INNER JOIN user_uaz_instances uui ON ui.id = uui.uaz_instance_id
     WHERE uui.user_id = $1 AND uui.tenant_id = $2 AND ui.is_active = true
     ORDER BY ui.display_order ASC NULLS LAST, ui.created_at DESC`,
    [user.id, tenantId]
  );
  return result.rows;
}

function toReqUser(user) {
  return {
    id: user.id,
    nome: user.nome,
    email: user.email,
    role: user.role,
    emailVerificado: user.email_verificado,
    permissoes: Array.isArray(user.permissoes) ? user.permissoes : [],
  };
}

module.exports = {
  isTenantOwner,
  extractActingUserId,
  loadActingUser,
  loadDefaultTenantUser,
  resolveActingUser,
  userHasOficialAccount,
  userHasQrInstance,
  listOficialAccounts,
  listQrInstances,
  toReqUser,
};
