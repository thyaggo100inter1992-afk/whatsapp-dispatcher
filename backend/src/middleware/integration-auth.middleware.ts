import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { pool } from '../database/connection';

function hashKey(apiKey: string) {
  return crypto.createHash('sha256').update(String(apiKey).trim()).digest('hex');
}

function extractApiKey(req: Request): string | null {
  const headerKey = req.headers['x-api-key'];
  if (typeof headerKey === 'string' && headerKey.trim()) {
    return headerKey.trim();
  }
  const auth = req.headers.authorization || '';
  if (auth.toLowerCase().startsWith('bearer nsk_')) {
    return auth.slice(7).trim();
  }
  const bodyKey = (req.body && (req.body.token || req.body.api_key || req.body.apiKey)) || '';
  if (bodyKey) return String(bodyKey).trim();
  const queryKey = req.query.token || req.query.api_key || req.query.key;
  if (typeof queryKey === 'string' && queryKey.trim()) return queryKey.trim();
  return null;
}

async function ensureTable() {
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
}

let tableReady = false;

export async function authenticateIntegrationKey(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!tableReady) {
      await ensureTable();
      tableReady = true;
    }

    const apiKey = extractApiKey(req);
    if (!apiKey) {
      res.status(401).json({
        success: false,
        error: 'Informe a chave de API no header X-Api-Key',
      });
      return;
    }

    const hashed = hashKey(apiKey);
    const result = await pool.query(
      `SELECT k.id, k.tenant_id, k.name, k.is_active,
              t.nome as tenant_nome, t.slug as tenant_slug, t.status as tenant_status,
              t.plano as tenant_plano, t.ativo as tenant_ativo
       FROM tenant_integration_keys k
       INNER JOIN tenants t ON t.id = k.tenant_id
       WHERE k.key_hash = $1
       LIMIT 1`,
      [hashed]
    );

    if (result.rows.length === 0) {
      res.status(401).json({ success: false, error: 'Chave de API inválida' });
      return;
    }

    const row = result.rows[0];
    if (!row.is_active) {
      res.status(401).json({ success: false, error: 'Chave de API desativada' });
      return;
    }
    if (!row.tenant_ativo) {
      res.status(403).json({ success: false, error: 'Tenant inativo' });
      return;
    }

    const admin = await pool.query(
      `SELECT id, nome, email, role, permissoes, email_verificado
       FROM tenant_users
       WHERE tenant_id = $1 AND ativo = true
       ORDER BY CASE WHEN role = 'admin' THEN 0 WHEN role = 'super_admin' THEN 1 ELSE 2 END, id
       LIMIT 1`,
      [row.tenant_id]
    );

    if (admin.rows.length === 0) {
      res.status(401).json({ success: false, error: 'Nenhum usuário ativo no tenant' });
      return;
    }

    const user = admin.rows[0];
    const reqAny = req as any;
    reqAny.user = {
      id: user.id,
      nome: user.nome,
      email: user.email,
      role: user.role,
      emailVerificado: user.email_verificado,
      permissoes: Array.isArray(user.permissoes) ? user.permissoes : [],
    };
    reqAny.tenant = {
      id: row.tenant_id,
      nome: row.tenant_nome,
      slug: row.tenant_slug,
      status: row.tenant_status,
      plano: row.tenant_plano,
    };
    reqAny.integrationKey = { id: row.id, name: row.name };

    pool
      .query('UPDATE tenant_integration_keys SET last_used_at = NOW() WHERE id = $1', [row.id])
      .catch(() => undefined);

    next();
  } catch (error: any) {
    console.error('Erro na autenticação da API de integração:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao validar chave de API',
      details: error.message,
    });
  }
}

export { hashKey, ensureTable };
