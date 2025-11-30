/**
 * Middleware de Contexto do Tenant
 * Define o tenant_id atual na sessão do PostgreSQL para ativar RLS
 */

const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'whatsapp_dispatcher',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  client_encoding: 'UTF8', // 🔤 Fix para caracteres especiais
});

/**
 * Define o contexto do tenant na sessão do PostgreSQL
 * Isso ativa automaticamente o Row Level Security (RLS)
 */
const setTenantContext = async (req, res, next) => {
  // Se não há tenant no request, continua sem definir contexto
  if (!req.tenant || !req.tenant.id) {
    return next();
  }

  try {
    // Obter conexão do pool
    const client = await pool.connect();

    // Definir tenant_id na sessão do PostgreSQL
    await client.query('SELECT set_current_tenant($1)', [req.tenant.id]);

    // Guardar cliente no request para uso posterior
    req.dbClient = client;
    req.dbClientReleased = false; // Flag para evitar double release

    // Liberar cliente quando response terminar
    res.on('finish', () => {
      if (req.dbClient && !req.dbClientReleased) {
        req.dbClient.release();
        req.dbClientReleased = true;
        req.dbClient = null;
      }
    });

    // Também liberar em caso de erro na response
    res.on('error', () => {
      if (req.dbClient && !req.dbClientReleased) {
        req.dbClient.release();
        req.dbClientReleased = true;
        req.dbClient = null;
      }
    });

    next();
  } catch (error) {
    console.error('Erro ao definir contexto do tenant:', error);
    
    // Liberar cliente se houver erro
    if (req.dbClient && !req.dbClientReleased) {
      req.dbClient.release();
      req.dbClientReleased = true;
      req.dbClient = null;
    }

    return res.status(500).json({
      success: false,
      message: 'Erro ao configurar contexto do tenant'
    });
  }
};

/**
 * Obter cliente de banco com contexto do tenant já configurado
 * Use isso nos controllers ao invés de pool.query()
 */
const getTenantClient = (req) => {
  if (req.dbClient) {
    return req.dbClient;
  }
  
  // Fallback para pool normal (sem RLS)
  console.warn('⚠️  Usando pool sem contexto de tenant - RLS não será aplicado!');
  return pool;
};

/**
 * Executar query com contexto do tenant
 */
const queryWithTenant = async (req, sql, params = []) => {
  const client = getTenantClient(req);
  return await client.query(sql, params);
};

/**
 * Middleware para bypass de RLS (apenas super admins)
 * Útil para rotas administrativas que precisam ver dados de todos os tenants
 */
const bypassRLS = async (req, res, next) => {
  // Verificar se é super admin
  if (!req.user || req.user.role !== 'super_admin') {
    return res.status(403).json({
      success: false,
      message: 'Acesso negado: apenas super admins'
    });
  }

  try {
    const client = await pool.connect();

    // Definir flag de super admin na sessão
    await client.query("SELECT set_config('app.is_super_admin', 'true', false)");

    req.dbClient = client;
    req.dbClientReleased = false; // Flag para evitar double release

    res.on('finish', () => {
      if (req.dbClient && !req.dbClientReleased) {
        req.dbClient.release();
        req.dbClientReleased = true;
        req.dbClient = null;
      }
    });

    res.on('error', () => {
      if (req.dbClient && !req.dbClientReleased) {
        req.dbClient.release();
        req.dbClientReleased = true;
        req.dbClient = null;
      }
    });

    next();
  } catch (error) {
    console.error('Erro ao configurar bypass de RLS:', error);
    
    if (req.dbClient && !req.dbClientReleased) {
      req.dbClient.release();
      req.dbClientReleased = true;
      req.dbClient = null;
    }

    return res.status(500).json({
      success: false,
      message: 'Erro ao configurar permissões administrativas'
    });
  }
};

/**
 * Adicionar tenant_id automaticamente em INSERT/UPDATE
 */
const addTenantToQuery = (req, data) => {
  if (!req.tenant || !req.tenant.id) {
    console.warn('⚠️  Tentando adicionar tenant_id mas tenant não está definido no request');
    return data;
  }

  return {
    ...data,
    tenant_id: req.tenant.id
  };
};

/**
 * Verificar se registro pertence ao tenant atual
 */
const verifyTenantOwnership = async (req, tableName, recordId) => {
  if (!req.tenant || !req.tenant.id) {
    return false;
  }

  try {
    const result = await pool.query(
      `SELECT tenant_id FROM ${tableName} WHERE id = $1`,
      [recordId]
    );

    if (result.rows.length === 0) {
      return false;
    }

    return result.rows[0].tenant_id === req.tenant.id;
  } catch (error) {
    console.error('Erro ao verificar propriedade do tenant:', error);
    return false;
  }
};

module.exports = {
  setTenantContext,
  getTenantClient,
  queryWithTenant,
  bypassRLS,
  addTenantToQuery,
  verifyTenantOwnership,
  pool
};


