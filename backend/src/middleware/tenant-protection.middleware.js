/**
 * 🔒 MIDDLEWARE DE PROTEÇÃO GLOBAL - TENANT ISOLATION
 * Garante que TODAS as requisições têm tenant válido
 * CRÍTICO PARA SEGURANÇA MULT-TENANT
 */

const { pool } = require('../database/connection');

/**
 * Middleware que valida presença de tenant em TODA requisição autenticada
 */
const ensureTenant = (req, res, next) => {
  // Skip para rotas públicas (login, registro, health, webhooks)
  const publicRoutes = ['/api/auth/login', '/api/auth/register', '/api/health', '/api/auth/refresh', '/api/webhook'];
  
  if (publicRoutes.some(route => req.path.startsWith(route))) {
    return next();
  }

  // Skip se não há usuário autenticado (o authenticate vai cuidar disso)
  if (!req.user) {
    return next();
  }

  // Skip para rotas de super admin que não precisam de tenant
  if (req.path.startsWith('/api/admin/') && req.user?.role === 'super_admin') {
    return next();
  }

  // VALIDAÇÃO CRÍTICA: Usuários autenticados DEVEM ter tenant
  if (!req.tenant || !req.tenant.id) {
    console.error(`🚨 SEGURANÇA: Tentativa de acesso sem tenant em ${req.method} ${req.path}`);
    console.error(`   User ID: ${req.user?.id || 'N/A'}`);
    console.error(`   User Email: ${req.user?.email || 'N/A'}`);
    console.error(`   IP: ${req.ip}`);
    
    return res.status(401).json({
      success: false,
      message: '🔒 Tenant não identificado. Acesso negado.',
      code: 'TENANT_REQUIRED',
      forceLogout: true
    });
  }

  // Log de acesso para auditoria (apenas em dev)
  if (process.env.NODE_ENV === 'development') {
    console.log(`🔐 Tenant ${req.tenant.id} (${req.tenant.nome || 'N/A'}) → ${req.method} ${req.path}`);
  }

  next();
};

/**
 * Middleware que intercepta queries perigosas no development
 * APENAS PARA DEBUG - Remove em produção
 */
const detectDangerousQueries = (req, res, next) => {
  // 🔧 Desabilitado por padrão - Use ENABLE_QUERY_AUDIT=true para ativar
  if (process.env.ENABLE_QUERY_AUDIT !== 'true') {
    return next();
  }

  // Cache para evitar avisos duplicados (limita spam de logs)
  const queryWarnings = new Map();
  const WARNING_THROTTLE_MS = 60000; // 1 minuto entre avisos iguais

  // Interceptar query original
  const originalQuery = pool.query.bind(pool);
  
  pool.query = function(...args) {
    const queryText = args[0];
    
    if (typeof queryText === 'string') {
      // Normalizar: remover quebras de linha e espaços extras para facilitar detecção
      const normalizedQuery = queryText.replace(/\s+/g, ' ').toLowerCase();
      
      // Tabelas críticas que DEVEM ter tenant_id
      const tablesWithTenantId = [
        'whatsapp_accounts', 'campaigns', 'templates', 'contacts', 
        'messages', 'qr_campaigns', 'qr_templates', 'uaz_instances',
        'products', 'proxies', 'media', 'button_clicks'
      ];
      
      // Verificar se query envolve tabelas críticas
      const matchedTable = tablesWithTenantId.find(table => 
        normalizedQuery.includes(table)
      );
      
      if (matchedTable) {
        // Verificar se é SELECT, UPDATE ou DELETE
        const isSelect = normalizedQuery.includes('select') && normalizedQuery.includes('from');
        const isUpdate = normalizedQuery.includes('update') && normalizedQuery.includes('set');
        const isDelete = normalizedQuery.includes('delete from');
        
        if (isSelect || isUpdate || isDelete) {
          // Verificar se tem filtro de tenant_id (aceita vários formatos e casos indiretos)
          const hasTenantFilter = 
            normalizedQuery.includes('where tenant_id') ||
            normalizedQuery.includes('where t.tenant_id') ||
            normalizedQuery.includes('and tenant_id') ||
            normalizedQuery.includes('and t.tenant_id') ||
            normalizedQuery.includes('tenant_id = any(') ||
            normalizedQuery.includes('t.tenant_id = any(') ||
            // Casos indiretos (JOIN com tabela que já tem filtro)
            normalizedQuery.includes('campaign_id') || // messages filtradas por campaign já tem tenant
            normalizedQuery.includes('where wa.id') || // JOIN com whatsapp_accounts
            normalizedQuery.includes('where ct.campaign_id') || // campaign_templates já filtrada
            normalizedQuery.includes('where m.campaign_id'); // messages por campanha
          
          if (!hasTenantFilter) {
            // Verificar throttle para não spammar logs
            const warningKey = `${matchedTable}:${req.path}`;
            const lastWarning = queryWarnings.get(warningKey);
            const now = Date.now();
            
            if (!lastWarning || (now - lastWarning) > WARNING_THROTTLE_MS) {
              console.warn('\n⚠️  QUERY PERIGOSA DETECTADA:');
              console.warn('   Query:', queryText.substring(0, 200) + (queryText.length > 200 ? '...' : ''));
              console.warn('   Tabela:', matchedTable);
              console.warn('   Path:', req.path);
              console.warn('   Tenant:', req.tenant?.id || 'N/A');
              console.warn('   ⚠️  Esta query pode estar vazando dados entre tenants!\n');
              
              queryWarnings.set(warningKey, now);
            }
          }
        }
      }
    }
    
    return originalQuery(...args);
  };

  next();
};

/**
 * Helper para verificar se um registro pertence ao tenant
 */
async function verifyOwnership(table, id, tenantId) {
  try {
    const result = await pool.query(
      `SELECT id FROM ${table} WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );
    return result.rows.length > 0;
  } catch (error) {
    console.error(`Erro ao verificar ownership em ${table}:`, error.message);
    return false;
  }
}

/**
 * Middleware para verificar ownership antes de operações críticas
 */
const verifyResourceOwnership = (table) => {
  return async (req, res, next) => {
    const resourceId = req.params.id;
    const tenantId = req.tenant?.id;

    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Tenant não identificado'
      });
    }

    if (!resourceId) {
      return next(); // Sem ID, continuar (pode ser listagem)
    }

    const hasAccess = await verifyOwnership(table, resourceId, tenantId);

    if (!hasAccess) {
      console.error(`🚨 TENTATIVA DE ACESSO NÃO AUTORIZADO:`);
      console.error(`   Tenant ${tenantId} tentou acessar ${table}/${resourceId}`);
      console.error(`   Path: ${req.method} ${req.path}`);
      console.error(`   IP: ${req.ip}`);

      return res.status(404).json({
        success: false,
        message: 'Recurso não encontrado',
        code: 'RESOURCE_NOT_FOUND'
      });
    }

    next();
  };
};

module.exports = {
  ensureTenant,
  detectDangerousQueries,
  verifyOwnership,
  verifyResourceOwnership
};

