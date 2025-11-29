/**
 * ROTA DE DIAGNÓSTICO: Verificação de Credenciais UAZAP por Tenant
 * 
 * Este endpoint ajuda a identificar problemas de incompatibilidade entre:
 * - A credencial UAZAP configurada para o tenant
 * - A credencial UAZAP onde as instâncias foram criadas
 */

const express = require('express');
const router = express.Router();
const { query } = require('../database/connection');
const { getTenantUazapCredentials } = require('../helpers/uaz-credentials.helper');
const UazService = require('../services/uazService');

/**
 * GET /api/diagnostic/credentials/tenant-info
 * Mostra informações detalhadas sobre as credenciais do tenant atual
 */
router.get('/tenant-info', async (req, res) => {
  try {
    const tenantId = req.tenant?.id;
    
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        error: 'Tenant não identificado'
      });
    }

    // 1. Buscar informações do tenant e sua credencial
    const tenantInfo = await query(`
      SELECT 
        t.id,
        t.nome,
        t.slug,
        t.uazap_credential_id,
        uc.name as credencial_nome,
        uc.server_url as credencial_url,
        uc.is_default as credencial_padrao,
        uc.is_active as credencial_ativa
      FROM tenants t
      LEFT JOIN uazap_credentials uc ON t.uazap_credential_id = uc.id
      WHERE t.id = $1
    `, [tenantId]);

    if (tenantInfo.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Tenant não encontrado'
      });
    }

    const tenant = tenantInfo.rows[0];

    // 2. Buscar todas as instâncias do tenant
    const instancesResult = await query(`
      SELECT 
        id,
        name,
        session_name,
        instance_token,
        is_connected,
        status,
        phone_number,
        created_at
      FROM uaz_instances
      WHERE tenant_id = $1
      ORDER BY created_at DESC
    `, [tenantId]);

    // 3. Buscar credenciais usando o helper (para ver qual está sendo usada)
    let credentialUsed = null;
    try {
      credentialUsed = await getTenantUazapCredentials(tenantId);
    } catch (error) {
      credentialUsed = { error: error.message };
    }

    // 4. Verificar se as instâncias existem na credencial atual
    let instancesVerification = [];
    
    if (credentialUsed && !credentialUsed.error && instancesResult.rows.length > 0) {
      const uazService = new UazService(credentialUsed.serverUrl, credentialUsed.adminToken);
      
      // Buscar todas as instâncias disponíveis na conta UAZAP atual
      const fetchResult = await uazService.fetchInstances();
      
      if (fetchResult.success) {
        const tokensNaContaAtual = new Set(
          fetchResult.instances.map(inst => inst.token)
        );

        // Verificar cada instância do banco
        for (const instance of instancesResult.rows) {
          const existeNaContaAtual = tokensNaContaAtual.has(instance.instance_token);
          
          instancesVerification.push({
            id: instance.id,
            name: instance.name,
            token: instance.instance_token ? 
              `${instance.instance_token.substring(0, 20)}...` : 
              'sem token',
            is_connected: instance.is_connected,
            status: instance.status,
            phone_number: instance.phone_number,
            existe_na_conta_atual: existeNaContaAtual,
            problema: !existeNaContaAtual ? '⚠️ INSTÂNCIA NÃO EXISTE NA CONTA UAZAP ATUAL!' : null
          });
        }
      }
    }

    // 5. Contar problemas
    const instanciasComProblema = instancesVerification.filter(
      inst => inst.problema !== null
    ).length;

    const temProblemas = instanciasComProblema > 0;

    // 6. Montar resposta
    res.json({
      success: true,
      diagnostic: {
        tenant: {
          id: tenant.id,
          nome: tenant.nome,
          slug: tenant.slug
        },
        credencial_configurada: {
          id: tenant.uazap_credential_id,
          nome: tenant.credencial_nome || 'NENHUMA',
          url: tenant.credencial_url || 'N/A',
          padrao: tenant.credencial_padrao || false,
          ativa: tenant.credencial_ativa || false
        },
        credencial_em_uso: credentialUsed,
        instancias: {
          total: instancesResult.rows.length,
          conectadas: instancesResult.rows.filter(i => i.is_connected).length,
          desconectadas: instancesResult.rows.filter(i => !i.is_connected).length,
          com_problema: instanciasComProblema
        },
        verificacao_detalhada: instancesVerification,
        status: temProblemas ? 'COM_PROBLEMAS' : 'OK',
        recomendacao: temProblemas ? 
          '⚠️ ATENÇÃO: Algumas instâncias não existem na conta UAZAP atual! Você precisa deletar essas instâncias do banco de dados e recriá-las, OU mudar a credencial do tenant de volta para a conta correta.' :
          '✅ Tudo OK! Todas as instâncias existem na conta UAZAP configurada.'
      }
    });

  } catch (error) {
    console.error('❌ Erro no diagnóstico:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

/**
 * GET /api/diagnostic/credentials/all-tenants
 * Lista TODOS os tenants e suas credenciais (apenas para admins)
 */
router.get('/all-tenants', async (req, res) => {
  try {
    // Verificar se é admin (você pode adicionar um middleware de admin aqui)
    
    const result = await query(`
      SELECT 
        t.id,
        t.nome,
        t.slug,
        t.uazap_credential_id,
        uc.name as credencial_nome,
        uc.server_url as credencial_url,
        (SELECT COUNT(*) FROM uaz_instances WHERE tenant_id = t.id) as total_instancias,
        (SELECT COUNT(*) FROM uaz_instances WHERE tenant_id = t.id AND is_connected = true) as instancias_conectadas
      FROM tenants t
      LEFT JOIN uazap_credentials uc ON t.uazap_credential_id = uc.id
      ORDER BY t.id
    `);

    res.json({
      success: true,
      tenants: result.rows
    });

  } catch (error) {
    console.error('❌ Erro ao listar tenants:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/diagnostic/credentials/available
 * Lista todas as credenciais UAZAP disponíveis
 */
router.get('/available', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        id,
        name,
        description,
        server_url,
        is_default,
        is_active,
        (SELECT COUNT(*) FROM tenants WHERE uazap_credential_id = uazap_credentials.id) as tenants_usando,
        created_at
      FROM uazap_credentials
      ORDER BY is_default DESC, name
    `);

    res.json({
      success: true,
      credentials: result.rows
    });

  } catch (error) {
    console.error('❌ Erro ao listar credenciais:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;






