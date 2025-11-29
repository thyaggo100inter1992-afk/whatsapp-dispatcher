const express = require('express');
const router = express.Router();
const { query } = require('../database/connection');

/**
 * GET /permissions
 * Retorna as permissões do usuário logado (combinando permissões do tenant e do usuário)
 */
router.get('/', async (req, res) => {
  try {
    // CORRIGIDO: buscar userId de req.user.id se req.userId não existir
    const userId = req.userId || req.user?.id;
    const tenantId = req.tenant?.id || req.user?.tenantId;
    const userRole = req.userRole || req.user?.role;
    const reqUser = req.user; // Pode ter info adicional do usuário

    console.log(`🔐 Verificando permissões - UserID: ${userId}, TenantID: ${tenantId}, Role: ${userRole}, ReqUser:`, reqUser);

    // APENAS Super admin tem acesso total (ignora tenant)
    if (userRole === 'super_admin') {
      console.log('✅ Super Admin - Acesso total');
      return res.json({
        success: true,
        data: {
          all: true,
          funcionalidades: {
            whatsapp_api: true,
            whatsapp_qr: true,
            campanhas: true,
            templates: true,
            base_dados: true,
            nova_vida: true,
            verificar_numeros: true,
            gerenciar_proxies: true,
            lista_restricao: true,
            webhooks: true,
            relatorios: true,
            auditoria: true,
            dashboard: true
          }
        }
      });
    }

    // Se não tem userId ou tenantId, usar funcionalidades do tenant
    if (!userId || !tenantId) {
      console.log('⚠️ UserID ou TenantID indefinido - usando funcionalidades do tenant');
      
      if (tenantId) {
        // Buscar funcionalidades do tenant
        const tenantResult = await query(`
          SELECT 
            t.funcionalidades_customizadas,
            t.funcionalidades_config,
            p.funcionalidades as plano_funcionalidades
          FROM tenants t
          LEFT JOIN plans p ON t.plan_id = p.id
          WHERE t.id = $1
        `, [tenantId]);

        if (tenantResult.rows.length > 0) {
          const tenant = tenantResult.rows[0];
          let funcionalidades = {};
          
          if (tenant.funcionalidades_customizadas && tenant.funcionalidades_config) {
            funcionalidades = tenant.funcionalidades_config;
          } else if (tenant.plano_funcionalidades) {
            funcionalidades = tenant.plano_funcionalidades;
          } else {
            funcionalidades = {
              whatsapp_api: true,
              whatsapp_qr: true,
              campanhas: true,
              templates: true,
              base_dados: true,
              nova_vida: true,
              verificar_numeros: true,
              gerenciar_proxies: true,
              lista_restricao: true,
              webhooks: true,
              relatorios: true,
              auditoria: true,
              dashboard: true
            };
          }

          console.log('📋 Funcionalidades do tenant (admin antigo):', funcionalidades);

          return res.json({
            success: true,
            data: {
              all: false,
              funcionalidades
            }
          });
        }
      }
      
      // Fallback se não conseguir buscar tenant
      return res.json({
        success: true,
        data: {
          all: true,
          funcionalidades: {
            whatsapp_api: true,
            whatsapp_qr: true,
            campanhas: true,
            templates: true,
            base_dados: true,
            nova_vida: true,
            verificar_numeros: true,
            gerenciar_proxies: true,
            lista_restricao: true,
            webhooks: true,
            relatorios: true,
            auditoria: true,
            dashboard: true
          }
        }
      });
    }

    // Buscar permissões do USUÁRIO
    const userResult = await query(
      'SELECT role, permissoes FROM tenant_users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      // Se não encontrou na tenant_users, buscar funcionalidades do tenant
      console.log('⚠️ Usuário não encontrado em tenant_users - usando funcionalidades do tenant');
      
      const tenantResult = await query(`
        SELECT 
          t.funcionalidades_customizadas,
          t.funcionalidades_config,
          p.funcionalidades as plano_funcionalidades
        FROM tenants t
        LEFT JOIN plans p ON t.plan_id = p.id
        WHERE t.id = $1
      `, [tenantId]);

      if (tenantResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Tenant não encontrado'
        });
      }

      const tenant = tenantResult.rows[0];
      let funcionalidades = {};
      
      if (tenant.funcionalidades_customizadas && tenant.funcionalidades_config) {
        funcionalidades = tenant.funcionalidades_config;
      } else if (tenant.plano_funcionalidades) {
        funcionalidades = tenant.plano_funcionalidades;
      } else {
        funcionalidades = {
          whatsapp_api: true,
          whatsapp_qr: true,
          campanhas: true,
          templates: true,
          base_dados: true,
          nova_vida: true,
          verificar_numeros: true,
          gerenciar_proxies: true,
          lista_restricao: true,
          webhooks: true,
          relatorios: true,
          auditoria: true,
          dashboard: true
        };
      }

      console.log('📋 Funcionalidades do tenant (usuário não encontrado):', funcionalidades);

      return res.json({
        success: true,
        data: {
          all: false,
          funcionalidades
        }
      });
    }

    const user = userResult.rows[0];

    // Admin do tenant SEMPRE usa funcionalidades do TENANT (não tem restrição de usuário)
    if (user.role === 'admin') {
      console.log('✅ Admin do Tenant - Usando funcionalidades do TENANT (não restringe admin)');
      
      const tenantResult = await query(`
        SELECT 
          t.funcionalidades_customizadas,
          t.funcionalidades_config,
          p.funcionalidades as plano_funcionalidades
        FROM tenants t
        LEFT JOIN plans p ON t.plan_id = p.id
        WHERE t.id = $1
      `, [tenantId]);

      if (tenantResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Tenant não encontrado'
        });
      }

      const tenant = tenantResult.rows[0];
      let funcionalidades = {};
      
      if (tenant.funcionalidades_customizadas && tenant.funcionalidades_config) {
        funcionalidades = tenant.funcionalidades_config;
      } else if (tenant.plano_funcionalidades) {
        funcionalidades = tenant.plano_funcionalidades;
      } else {
        // Se não tem nenhuma configuração, libera tudo
        funcionalidades = {
          whatsapp_api: true,
          whatsapp_qr: true,
          campanhas: true,
          templates: true,
          base_dados: true,
          nova_vida: true,
          verificar_numeros: true,
          gerenciar_proxies: true,
          lista_restricao: true,
          webhooks: true,
          relatorios: true,
          auditoria: true,
          dashboard: true
        };
      }

      console.log('📋 Funcionalidades do tenant (admin):', funcionalidades);

      return res.json({
        success: true,
        data: {
          all: false, // IMPORTANTE: false porque ainda depende das funcionalidades do tenant
          funcionalidades
        }
      });
    }

    // USUÁRIO COMUM - Verificar permissões customizadas do USUÁRIO
    const permissoesUsuario = user.permissoes || {};
    const hasUserCustomPermissions = Object.keys(permissoesUsuario).length > 0 && 
                                      Object.values(permissoesUsuario).some(v => v === true || v === false);

    if (!hasUserCustomPermissions) {
      // Se o usuário não tem permissões customizadas, usar permissões do tenant
      console.log('ℹ️ Usuário sem permissões customizadas - Usando permissões do tenant');
      
      const tenantResult = await query(`
        SELECT 
          t.funcionalidades_customizadas,
          t.funcionalidades_config,
          p.funcionalidades as plano_funcionalidades
        FROM tenants t
        LEFT JOIN plans p ON t.plan_id = p.id
        WHERE t.id = $1
      `, [tenantId]);

      if (tenantResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Tenant não encontrado'
        });
      }

      const tenant = tenantResult.rows[0];
      let funcionalidades = {};
      
      if (tenant.funcionalidades_customizadas && tenant.funcionalidades_config) {
        funcionalidades = tenant.funcionalidades_config;
      } else if (tenant.plano_funcionalidades) {
        funcionalidades = tenant.plano_funcionalidades;
      } else {
        // Se não tem nenhuma configuração, libera tudo
        funcionalidades = {
          whatsapp_api: true,
          whatsapp_qr: true,
          campanhas: true,
          templates: true,
          base_dados: true,
          nova_vida: true,
          verificar_numeros: true,
          gerenciar_proxies: true,
          lista_restricao: true,
          webhooks: true,
          relatorios: true,
          auditoria: true,
          dashboard: true
        };
      }

      console.log('📋 Funcionalidades do tenant:', funcionalidades);

      return res.json({
        success: true,
        data: {
          all: false,
          funcionalidades
        }
      });
    }

    // Usuário tem permissões customizadas
    // MAS: as permissões do usuário NÃO PODEM dar acesso a funcionalidades que o TENANT não tem!
    // Fazer AND lógico entre funcionalidades do tenant e permissões do usuário
    console.log('🔒 Usuário com permissões customizadas - calculando intersecção com tenant');
    
    // Buscar funcionalidades do tenant primeiro
    const tenantResult = await query(`
      SELECT 
        t.funcionalidades_customizadas,
        t.funcionalidades_config,
        p.funcionalidades as plano_funcionalidades
      FROM tenants t
      LEFT JOIN plans p ON t.plan_id = p.id
      WHERE t.id = $1
    `, [tenantId]);

    if (tenantResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Tenant não encontrado'
      });
    }

    const tenant = tenantResult.rows[0];
    let funcionalidadesTenant = {};
    
    if (tenant.funcionalidades_customizadas && tenant.funcionalidades_config) {
      funcionalidadesTenant = tenant.funcionalidades_config;
    } else if (tenant.plano_funcionalidades) {
      funcionalidadesTenant = tenant.plano_funcionalidades;
    } else {
      funcionalidadesTenant = {
        whatsapp_api: true,
        whatsapp_qr: true,
        nova_vida: true,
        verificar_numeros: true,
        gerenciar_proxies: true
      };
    }

    console.log('📋 Funcionalidades do TENANT:', funcionalidadesTenant);
    console.log('👤 Permissões do USUÁRIO:', permissoesUsuario);
    console.log('🔍 Tipo de permissoesUsuario:', typeof permissoesUsuario);
    console.log('🔍 Keys de permissoesUsuario:', Object.keys(permissoesUsuario));
    
    // Fazer AND lógico: usuário só pode ter o que o TENANT tem
    const funcionalidadesFinais = {
      whatsapp_api: (permissoesUsuario.whatsapp_api === true) && (funcionalidadesTenant.whatsapp_api === true),
      whatsapp_qr: (permissoesUsuario.whatsapp_qr === true) && (funcionalidadesTenant.whatsapp_qr === true),
      campanhas: (permissoesUsuario.campanhas === true) && (funcionalidadesTenant.campanhas === true),
      templates: (permissoesUsuario.templates === true) && (funcionalidadesTenant.templates === true),
      base_dados: (permissoesUsuario.base_dados === true) && (funcionalidadesTenant.base_dados === true),
      nova_vida: (permissoesUsuario.nova_vida === true) && (funcionalidadesTenant.nova_vida === true),
      verificar_numeros: (permissoesUsuario.verificar_numeros === true) && (funcionalidadesTenant.verificar_numeros === true),
      gerenciar_proxies: (permissoesUsuario.gerenciar_proxies === true) && (funcionalidadesTenant.gerenciar_proxies === true),
      lista_restricao: (permissoesUsuario.lista_restricao === true) && (funcionalidadesTenant.lista_restricao === true),
      webhooks: (permissoesUsuario.webhooks === true) && (funcionalidadesTenant.webhooks === true),
      relatorios: (permissoesUsuario.relatorios === true) && (funcionalidadesTenant.relatorios === true),
      auditoria: (permissoesUsuario.auditoria === true) && (funcionalidadesTenant.auditoria === true),
      dashboard: true // Dashboard sempre liberado
    };
    
    console.log('📤 Funcionalidades FINAIS (AND lógico) enviadas ao frontend:', funcionalidadesFinais);
    
    res.json({
      success: true,
      data: {
        all: false,
        funcionalidades: funcionalidadesFinais
      }
    });
  } catch (error) {
    console.error('❌ Erro ao buscar permissões:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar permissões',
      message: error.message
    });
  }
});

module.exports = router;
