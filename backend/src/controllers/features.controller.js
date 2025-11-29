const { query } = require('../database/connection');

/**
 * Controller para gerenciar funcionalidades por plano/tenant
 */

/**
 * GET /api/features - Obter funcionalidades do tenant autenticado
 */
const getFeatures = async (req, res) => {
  try {
    const tenantId = req.tenant?.id;

    if (!tenantId) {
      return res.status(401).json({ 
        success: false, 
        message: 'Tenant não identificado' 
      });
    }

    // Buscar dados do tenant e plano
    const result = await query(`
      SELECT 
        t.id as tenant_id,
        t.nome as tenant_nome,
        t.plano as tenant_plano,
        t.status as tenant_status,
        t.is_trial,
        t.trial_ends_at,
        t.funcionalidades_customizadas,
        t.funcionalidades_config,
        t.created_at as tenant_created_at,
        p.id as plan_id,
        p.nome as plan_nome,
        p.slug as plan_slug,
        p.funcionalidades as plan_funcionalidades
      FROM tenants t
      LEFT JOIN plans p ON t.plan_id = p.id OR t.plano = p.slug
      WHERE t.id = $1
    `, [tenantId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tenant não encontrado'
      });
    }

    const tenantData = result.rows[0];
    let funcionalidades = {};

    // =====================================================
    // VERIFICAR SE HÁ PAGAMENTO CONFIRMADO
    // =====================================================
    
    // Buscar se tenant tem algum pagamento confirmado
    const paymentCheck = await query(`
      SELECT COUNT(*) as payment_count
      FROM payments pay
      WHERE pay.tenant_id = $1
        AND pay.status IN ('confirmed', 'received')
        AND (pay.metadata->>'tipo' IS NULL OR pay.metadata->>'tipo' != 'consultas_avulsas')
      LIMIT 1
    `, [tenantId]);

    const hasPaidPlan = parseInt(paymentCheck.rows[0]?.payment_count || 0) > 0;

    console.log(`💰 Tenant ${tenantId} - Pagamento confirmado: ${hasPaidPlan ? 'SIM' : 'NÃO'}`);

    // =====================================================
    // LÓGICA ESPECIAL PARA TRIAL
    // =====================================================
    
    // Verificar se tenant está em trial
    const now = new Date();
    const createdAt = new Date(tenantData.tenant_created_at);
    const daysSinceCreation = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
    
    // Tenant está em TRIAL APENAS se:
    // 1. NÃO tem pagamento confirmado E
    // 2. (Flag is_trial está ativa OU status é 'trial' OU foi criado há menos de 3 dias)
    const isInTrial = !hasPaidPlan && (
                      tenantData.is_trial || 
                      tenantData.tenant_status === 'trial' || 
                      tenantData.tenant_status === 'teste' ||
                      tenantData.tenant_plano === 'trial' ||
                      tenantData.tenant_plano === 'teste' ||
                      (daysSinceCreation < 3 && tenantData.tenant_status !== 'paid' && tenantData.tenant_status !== 'active')
    );

    // =====================================================
    // FUNCIONALIDADES CUSTOMIZADAS (Super Admin editou)
    // PRIORIDADE MÁXIMA - Ignora restrições de trial
    // =====================================================
    if (tenantData.funcionalidades_customizadas && tenantData.funcionalidades_config) {
      console.log(`⚙️ Tenant ${tenantId} tem funcionalidades CUSTOMIZADAS`);
      console.log(`   🔓 Ignorando restrições de trial - funcionalidades habilitadas pelo admin`);
      funcionalidades = tenantData.funcionalidades_config;
    }
    // =====================================================
    // TRIAL - Apenas se NÃO tiver customizações
    // =====================================================
    else if (isInTrial) {
      // Durante o TRIAL: APENAS API Oficial + QR Connect
      console.log(`🆓 Tenant ${tenantId} está em TRIAL - aplicando restrições`);
      console.log(`   Criado há ${daysSinceCreation} dias`);
      console.log(`   Status: ${tenantData.tenant_status}`);
      console.log(`   Plano: ${tenantData.tenant_plano}`);
      
      funcionalidades = {
        whatsapp_api: true,
        whatsapp_qr: true,
        consulta_dados: false,
        verificar_numeros: false,
        gerenciar_proxies: false,
        campanhas: true,
        templates: true,
        lista_restricao: false,
        webhooks: false,
        relatorios: false,
        nova_vida: false,
        envio_imediato: true,
        catalogo: false,
        dashboard: true
      };
    }
    // =====================================================
    // FUNCIONALIDADES DO PLANO (PAGO)
    // =====================================================
    else if (tenantData.plan_funcionalidades) {
      console.log(`💎 Tenant ${tenantId} - PLANO PAGO: ${tenantData.plan_slug}`);
      console.log(`   Liberando todas as funcionalidades do plano`);
      funcionalidades = tenantData.plan_funcionalidades;
    }
    // =====================================================
    // FALLBACK: Liberar tudo (segurança)
    // =====================================================
    else {
      console.warn(`⚠️ Tenant ${tenantId} sem configuração de funcionalidades - liberando tudo`);
      funcionalidades = {
        whatsapp_api: true,
        whatsapp_qr: true,
        consulta_dados: true,
        verificar_numeros: true,
        gerenciar_proxies: true,
        campanhas: true,
        templates: true,
        lista_restricao: true,
        webhooks: true,
        relatorios: true,
        nova_vida: true,
        envio_imediato: true,
        catalogo: true,
        dashboard: true
      };
    }

    res.json({
      success: true,
      data: {
        tenant: {
          id: tenantData.tenant_id,
          nome: tenantData.tenant_nome,
          plano: tenantData.tenant_plano,
          status: tenantData.tenant_status,
          is_trial: isInTrial,
          trial_ends_at: tenantData.trial_ends_at
        },
        plan: {
          id: tenantData.plan_id,
          nome: tenantData.plan_nome,
          slug: tenantData.plan_slug
        },
        funcionalidades,
        funcionalidades_customizadas: tenantData.funcionalidades_customizadas
      }
    });

  } catch (error) {
    console.error('❌ Erro ao buscar funcionalidades:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao buscar funcionalidades' 
    });
  }
};

/**
 * GET /api/features/check/:feature - Verificar se tenant tem acesso a uma funcionalidade
 */
const checkFeature = async (req, res) => {
  try {
    const tenantId = req.tenant?.id;
    const { feature } = req.params;

    if (!tenantId) {
      return res.status(401).json({ 
        success: false, 
        message: 'Tenant não identificado' 
      });
    }

    // Reutilizar a lógica de getFeatures
    const featuresResponse = await getFeatures(req, { json: () => {} });
    const funcionalidades = featuresResponse.data?.funcionalidades || {};

    const hasAccess = funcionalidades[feature] === true;

    res.json({
      success: true,
      data: {
        feature,
        hasAccess,
        message: hasAccess 
          ? `Funcionalidade "${feature}" disponível` 
          : `Funcionalidade "${feature}" não disponível no seu plano`
      }
    });

  } catch (error) {
    console.error('❌ Erro ao verificar funcionalidade:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao verificar funcionalidade' 
    });
  }
};

module.exports = {
  getFeatures,
  checkFeature
};

