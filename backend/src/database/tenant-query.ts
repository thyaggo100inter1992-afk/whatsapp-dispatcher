/**
 * Helper para queries com contexto de tenant
 * Facilita a migração dos controllers existentes
 */

import { Request } from 'express';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

// Carregar .env EXPLICITAMENTE
dotenv.config();

// Pool de conexão (mesmo que o existente)
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'whatsapp_dispatcher',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'Tg130992*', // HARDCODED como fallback
});

/**
 * Executa query com contexto do tenant (RLS ativo)
 * USO: Substituir query() por tenantQuery(req, ...)
 * ✅ CORRIGIDO: Usar set_config dentro de transação para RLS funcionar
 */
export async function tenantQuery(
  req: Request,
  text: string,
  params?: any[]
): Promise<any> {
  // Se não há tenant no request, usar pool normal (rotas públicas)
  if (!req.tenant || !req.tenant.id) {
    console.warn('⚠️  Query sem contexto de tenant - RLS não será aplicado!');
    return await pool.query(text, params);
  }

  // Obter cliente do pool
  const client = await pool.connect();

  try {
    // ✅ INICIAR TRANSAÇÃO (necessário para set_config funcionar com RLS)
    await client.query('BEGIN');
    
    // ✅ CORRIGIDO: Usar set_config ao invés de set_current_tenant
    await client.query('SELECT set_config($1, $2, true)', ['app.current_tenant_id', req.tenant.id.toString()]);

    // Executar query com RLS ativo
    const result = await client.query(text, params);
    
    // ✅ COMMIT da transação
    await client.query('COMMIT');

    return result;
  } catch (error) {
    // ✅ ROLLBACK em caso de erro
    await client.query('ROLLBACK');
    throw error;
  } finally {
    // Sempre liberar o cliente
    client.release();
  }
}

/**
 * Versão para uso sem Request (ex: workers, services)
 * Requer tenant_id manual
 * ✅ CORRIGIDO: Usar set_config dentro de transação para RLS funcionar
 */
export async function queryWithTenantId(
  tenantId: number,
  text: string,
  params?: any[]
): Promise<any> {
  const client = await pool.connect();

  try {
    // ✅ INICIAR TRANSAÇÃO
    await client.query('BEGIN');
    
    // ✅ CORRIGIDO: Usar set_config ao invés de set_current_tenant
    await client.query('SELECT set_config($1, $2, true)', ['app.current_tenant_id', tenantId.toString()]);
    
    const result = await client.query(text, params);
    
    // ✅ COMMIT
    await client.query('COMMIT');
    
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Query sem tenant (para rotas públicas ou operações globais)
 */
export async function queryNoTenant(
  text: string,
  params?: any[]
): Promise<any> {
  return await pool.query(text, params);
}

/**
 * Executar transação com contexto de tenant
 * ✅ CORRIGIDO: Usar set_config para RLS funcionar
 */
export async function tenantTransaction<T>(
  req: Request,
  callback: (client: any) => Promise<T>
): Promise<T> {
  const client = await pool.connect();

  try {
    // Iniciar transação PRIMEIRO
    await client.query('BEGIN');

    // ✅ CORRIGIDO: Definir tenant com set_config
    if (req.tenant && req.tenant.id) {
      await client.query('SELECT set_config($1, $2, true)', ['app.current_tenant_id', req.tenant.id.toString()]);
    }

    // Executar callback
    const result = await callback(client);

    // Commit
    await client.query('COMMIT');

    return result;
  } catch (error) {
    // Rollback em caso de erro
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Adicionar tenant_id automaticamente nos dados
 */
export function addTenantId<T extends object>(
  req: Request,
  data: T
): T & { tenant_id: number } {
  if (!req.tenant || !req.tenant.id) {
    throw new Error('Tenant não definido no request');
  }

  return {
    ...data,
    tenant_id: req.tenant.id,
  };
}

export { pool };



