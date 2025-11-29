/**
 * Middleware para verificar permissões de funcionalidades do tenant
 */

const { query } = require('../database/connection');

/**
 * Verifica se o tenant tem acesso a uma funcionalidade específica
 */
const checkPermission = (funcionalidade) => {
  return async (req, res, next) => {
    try {
      const tenantId = req.tenant?.id;

      if (!tenantId) {
        return res.status(403).json({
          success: false,
          error: 'Tenant não identificado'
        });
      }

      // Super admin tem acesso total
      if (req.user?.role === 'super_admin') {
        return next();
      }

      // Buscar configuração de funcionalidades do tenant
      const result = await query(`
        SELECT 
          t.funcionalidades_customizadas,
          t.funcionalidades_config,
          p.funcionalidades as plano_funcionalidades
        FROM tenants t
        LEFT JOIN plans p ON t.plan_id = p.id
        WHERE t.id = $1
      `, [tenantId]);

      if (result.rows.length === 0) {
        return res.status(403).json({
          success: false,
          error: 'Tenant não encontrado'
        });
      }

      const tenant = result.rows[0];

      // Se tem customização, usa as configurações customizadas
      let funcionalidades = {};
      if (tenant.funcionalidades_customizadas && tenant.funcionalidades_config) {
        funcionalidades = tenant.funcionalidades_config;
      } else if (tenant.plano_funcionalidades) {
        funcionalidades = tenant.plano_funcionalidades;
      }

      // Verificar se a funcionalidade está habilitada
      const permitido = funcionalidades[funcionalidade] === true;

      if (!permitido) {
        console.log(`🚫 Acesso negado à funcionalidade "${funcionalidade}" para tenant ${tenantId}`);
        return res.status(403).json({
          success: false,
          error: `Acesso à funcionalidade "${funcionalidade}" não permitido`,
          funcionalidade_bloqueada: funcionalidade
        });
      }

      console.log(`✅ Acesso permitido à funcionalidade "${funcionalidade}" para tenant ${tenantId}`);
      next();
    } catch (error) {
      console.error('❌ Erro ao verificar permissão:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao verificar permissões'
      });
    }
  };
};

module.exports = {
  checkPermission
};



