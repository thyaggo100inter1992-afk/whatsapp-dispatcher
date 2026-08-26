/**
 * Autenticação das APIs públicas usadas pelo sistema de vendas.
 * Aceita o mesmo token do tenant (nsk_...) OU email+senha (compatibilidade).
 */

const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { pool } = require('../database/connection');

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token).trim()).digest('hex');
}

function extrairToken(req) {
  const headerKey = req.headers['x-api-key'];
  if (typeof headerKey === 'string' && headerKey.trim()) {
    return headerKey.trim();
  }

  const auth = req.headers.authorization || '';
  if (auth.toLowerCase().startsWith('bearer nsk_')) {
    return auth.slice(7).trim();
  }

  const body = req.body || {};
  const fromBody = body.token || body.api_key || body.apiKey;
  if (fromBody) return String(fromBody).trim();

  const queryToken = req.query.token || req.query.api_key || req.query.key;
  if (typeof queryToken === 'string' && queryToken.trim()) return queryToken.trim();

  return null;
}

let tableReady = false;

async function autenticarPorToken(token) {
  if (!tableReady) {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tenant_integration_keys (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name VARCHAR(120) NOT NULL DEFAULT 'Sistema de Vendas',
        key_prefix VARCHAR(20) NOT NULL,
        key_hash VARCHAR(64) NOT NULL UNIQUE,
        last_used_at TIMESTAMPTZ,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    tableReady = true;
  }
  const hashed = hashToken(token);
  const result = await pool.query(
    `SELECT k.id, k.tenant_id, k.is_active,
            t.ativo as tenant_ativo
     FROM tenant_integration_keys k
     INNER JOIN tenants t ON t.id = k.tenant_id
     WHERE k.key_hash = $1
     LIMIT 1`,
    [hashed]
  );

  if (result.rows.length === 0) {
    return { erro: { status: 401, mensagem: 'Token inválido' } };
  }

  const row = result.rows[0];
  if (!row.is_active) {
    return { erro: { status: 401, mensagem: 'Token desativado' } };
  }
  if (!row.tenant_ativo) {
    return { erro: { status: 403, mensagem: 'Conta suspensa. Entre em contato com o suporte.' } };
  }

  const admin = await pool.query(
    `SELECT id, tenant_id, nome, email, role, ativo
     FROM tenant_users
     WHERE tenant_id = $1 AND ativo = true
     ORDER BY CASE WHEN role = 'admin' THEN 0 WHEN role = 'super_admin' THEN 1 ELSE 2 END, id
     LIMIT 1`,
    [row.tenant_id]
  );

  if (admin.rows.length === 0) {
    return { erro: { status: 401, mensagem: 'Nenhum usuário ativo no tenant' } };
  }

  pool
    .query('UPDATE tenant_integration_keys SET last_used_at = NOW() WHERE id = $1', [row.id])
    .catch(() => undefined);

  return {
    tenantId: row.tenant_id,
    usuario: admin.rows[0],
    via: 'token',
  };
}

async function autenticarPorSenha(email, senha) {
  const userResult = await pool.query(
    `SELECT
       u.id,
       u.tenant_id,
       u.nome,
       u.email,
       u.senha_hash,
       u.ativo,
       t.ativo as tenant_ativo
     FROM tenant_users u
     INNER JOIN tenants t ON t.id = u.tenant_id
     WHERE LOWER(u.email) = LOWER($1)`,
    [email]
  );

  if (userResult.rows.length === 0) {
    return { erro: { status: 401, mensagem: 'Email ou senha inválidos' } };
  }

  const usuario = userResult.rows[0];
  if (!usuario.ativo) {
    return { erro: { status: 403, mensagem: 'Usuário inativo. Entre em contato com o administrador.' } };
  }
  if (!usuario.tenant_ativo) {
    return { erro: { status: 403, mensagem: 'Conta suspensa. Entre em contato com o suporte.' } };
  }

  const senhaValida = await bcrypt.compare(senha, usuario.senha_hash);
  if (!senhaValida) {
    return { erro: { status: 401, mensagem: 'Email ou senha inválidos' } };
  }

  return {
    tenantId: usuario.tenant_id,
    usuario,
    via: 'senha',
  };
}

async function autenticarApiPublica(req) {
  const token = extrairToken(req);
  if (token) {
    return autenticarPorToken(token);
  }

  const email = req.body && req.body.email;
  const senha = req.body && req.body.senha;
  if (email && senha) {
    return autenticarPorSenha(email, senha);
  }

  return {
    erro: {
      status: 401,
      mensagem: 'Informe o token (header X-Api-Key / Authorization Bearer / body.token) ou email e senha',
    },
  };
}

module.exports = {
  autenticarApiPublica,
  extrairToken,
};
