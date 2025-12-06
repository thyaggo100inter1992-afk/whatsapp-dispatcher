const { query } = require('../database/connection');

/**
 * Middleware para verificar limite de usuários do tenant
 */
async function checkUserLimit(req, res, next) {
  try {
    const userRole = req.user?.role;

    // Super admin nunca tem limites
    if (userRole === 'super_admin') {
      return next();
    }

    const tenantId = req.tenant?.id || req.params.id;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant não identificado'
      });
    }

    // Buscar limite e contagem atual
    const result = await query(`
      SELECT 
        COALESCE(t.limite_usuarios_customizado, p.limite_usuarios, 1) as limite,
        COUNT(tu.id) as atual
      FROM tenants t
      LEFT JOIN plans p ON t.plan_id = p.id
      LEFT JOIN tenant_users tu ON tu.tenant_id = t.id AND tu.ativo = true
      WHERE t.id = $1
      GROUP BY t.id, t.limite_usuarios_customizado, p.limite_usuarios
    `, [tenantId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tenant não encontrado'
      });
    }

    const { limite, atual } = result.rows[0];

    // Se o limite for -1, significa ilimitado
    if (parseInt(limite) === -1) {
      console.log(`✅ Limite de usuários ilimitado - Tenant ${tenantId}`);
      return next();
    }

    if (parseInt(atual) >= parseInt(limite)) {
      console.log(`🚫 Limite de usuários atingido - Tenant ${tenantId}: ${atual}/${limite}`);
      return res.status(403).json({
        success: false,
        message: `❌ Limite de usuários atingido! Máximo: ${limite}, Atual: ${atual}`,
        limite: parseInt(limite),
        atual: parseInt(atual)
      });
    }

    console.log(`✅ Limite de usuários OK - Tenant ${tenantId}: ${atual}/${limite}`);
    next();
  } catch (error) {
    console.error('❌ Erro ao verificar limite de usuários:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao verificar limite',
      error: error.message
    });
  }
}

/**
 * Middleware para verificar limite de contas WhatsApp (API + QR Connect)
 */
async function checkWhatsAppLimit(req, res, next) {
  try {
    const userRole = req.user?.role;

    // Super admin nunca tem limites
    if (userRole === 'super_admin') {
      return next();
    }

    const tenantId = req.tenant?.id || req.params.id;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant não identificado'
      });
    }

    // Buscar limite e contagem atual (API + QR Connect)
    const result = await query(`
      SELECT 
        COALESCE(t.limite_whatsapp_customizado, p.limite_contas_whatsapp, 1) as limite,
        (
          -- Contas API
          (SELECT COUNT(*) FROM whatsapp_accounts WHERE tenant_id = t.id) +
          -- Instâncias QR Connect
          (SELECT COUNT(*) FROM uaz_instances WHERE tenant_id = t.id)
        ) as atual
      FROM tenants t
      LEFT JOIN plans p ON t.plan_id = p.id
      WHERE t.id = $1
    `, [tenantId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tenant não encontrado'
      });
    }

    const { limite, atual } = result.rows[0];

    // Se o limite for -1, significa ilimitado
    if (parseInt(limite) === -1) {
      console.log(`✅ Limite de contas WhatsApp ilimitado - Tenant ${tenantId}`);
      return next();
    }

    if (parseInt(atual) >= parseInt(limite)) {
      console.log(`🚫 Limite de contas WhatsApp atingido - Tenant ${tenantId}: ${atual}/${limite}`);
      
      // Buscar nome do plano para mensagem mais clara
      const planResult = await query(`
        SELECT p.nome as plan_name 
        FROM tenants t 
        LEFT JOIN plans p ON t.plan_id = p.id 
        WHERE t.id = $1
      `, [tenantId]);
      
      const planName = planResult.rows[0]?.plan_name || 'Atual';
      
      return res.status(403).json({
        success: false,
        message: `❌ LIMITE DE CONTAS WHATSAPP ATINGIDO!\n\n` +
                 `📊 Seu plano "${planName}" permite no máximo ${limite} contas WhatsApp.\n` +
                 `📱 Você já possui ${atual} contas ativas (API + QR Connect).\n\n` +
                 `💡 Para adicionar mais contas, você precisa:\n` +
                 `   • Fazer upgrade do seu plano\n` +
                 `   • Ou solicitar customização via Super Admin`,
        limite: parseInt(limite),
        atual: parseInt(atual),
        tipo: 'limite_plano'
      });
    }

    console.log(`✅ Limite de contas WhatsApp OK - Tenant ${tenantId}: ${atual}/${limite}`);
    next();
  } catch (error) {
    console.error('❌ Erro ao verificar limite de contas WhatsApp:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao verificar limite',
      error: error.message
    });
  }
}

/**
 * Middleware para verificar limite de campanhas simultâneas
 */
async function checkCampaignLimit(req, res, next) {
  try {
    const userRole = req.user?.role;

    // Super admin nunca tem limites
    if (userRole === 'super_admin') {
      return next();
    }

    const tenantId = req.tenant?.id || req.params.id;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant não identificado'
      });
    }

    // Buscar limite e contagem atual (campanhas ativas API + QR)
    const result = await query(`
      SELECT 
        COALESCE(t.limite_campanhas_simultaneas_customizado, p.limite_campanhas_mes, 10) as limite,
        (
          -- Campanhas API ativas
          (SELECT COUNT(*) FROM campaigns 
           WHERE tenant_id = t.id 
           AND status IN ('running', 'scheduled', 'pending')) +
          -- Campanhas QR Connect ativas
          (SELECT COUNT(*) FROM uaz_campaigns uc
           INNER JOIN uaz_instances ui ON uc.instance_id = ui.id
           WHERE ui.tenant_id = t.id
           AND uc.status IN ('running', 'scheduled', 'pending'))
        ) as atual
      FROM tenants t
      LEFT JOIN plans p ON t.plan_id = p.id
      WHERE t.id = $1
    `, [tenantId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tenant não encontrado'
      });
    }

    const { limite, atual } = result.rows[0];

    // Se o limite for -1, significa ilimitado
    if (parseInt(limite) === -1) {
      console.log(`✅ Limite de campanhas ilimitado - Tenant ${tenantId}`);
      return next();
    }

    if (parseInt(atual) >= parseInt(limite)) {
      console.log(`🚫 Limite de campanhas atingido - Tenant ${tenantId}: ${atual}/${limite}`);
      return res.status(403).json({
        success: false,
        message: `❌ Limite de campanhas simultâneas atingido! Máximo: ${limite}, Atual: ${atual}`,
        limite: parseInt(limite),
        atual: parseInt(atual)
      });
    }

    console.log(`✅ Limite de campanhas OK - Tenant ${tenantId}: ${atual}/${limite}`);
    next();
  } catch (error) {
    console.error('❌ Erro ao verificar limite de campanhas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao verificar limite',
      error: error.message
    });
  }
}

/**
 * Middleware para verificar limite de mensagens diárias
 */
async function checkMessageLimit(req, res, next) {
  try {
    const userRole = req.user?.role;

    // Super admin nunca tem limites
    if (userRole === 'super_admin') {
      return next();
    }

    const tenantId = req.tenant?.id || req.params.id;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant não identificado'
      });
    }

    // Buscar limite e contagem atual do dia
    const result = await query(`
      SELECT 
        COALESCE(t.limite_mensagens_dia_customizado, p.limite_mensagens_dia, 100) as limite,
        (
          -- Mensagens API enviadas hoje
          (SELECT COUNT(*) FROM messages m
           INNER JOIN campaigns c ON m.campaign_id = c.id
           WHERE c.tenant_id = t.id
           AND m.created_at::date = CURRENT_DATE) +
          -- Mensagens QR Connect enviadas hoje
          (SELECT COUNT(*) FROM uaz_messages um
           INNER JOIN uaz_instances ui ON um.instance_id = ui.id
           WHERE ui.tenant_id = t.id
           AND um.created_at::date = CURRENT_DATE)
        ) as atual
      FROM tenants t
      LEFT JOIN plans p ON t.plan_id = p.id
      WHERE t.id = $1
    `, [tenantId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tenant não encontrado'
      });
    }

    const { limite, atual } = result.rows[0];

    // Se o limite for -1, significa ilimitado
    if (parseInt(limite) === -1) {
      console.log(`✅ Limite de mensagens ilimitado - Tenant ${tenantId}`);
      return next();
    }

    if (parseInt(atual) >= parseInt(limite)) {
      console.log(`🚫 Limite de mensagens diárias atingido - Tenant ${tenantId}: ${atual}/${limite}`);
      return res.status(403).json({
        success: false,
        message: `❌ Limite de mensagens diárias atingido! Máximo: ${limite}, Atual: ${atual}`,
        limite: parseInt(limite),
        atual: parseInt(atual)
      });
    }

    console.log(`✅ Limite de mensagens OK - Tenant ${tenantId}: ${atual}/${limite}`);
    next();
  } catch (error) {
    console.error('❌ Erro ao verificar limite de mensagens:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao verificar limite',
      error: error.message
    });
  }
}

/**
 * Middleware para verificar limite de consultas Nova Vida (APENAS MENSAL + AVULSAS)
 * NOTA: Limite diário foi REMOVIDO conforme solicitação
 * Quando acabar as consultas do plano mensal, consome das consultas avulsas
 */
async function checkNovaVidaLimit(req, res, next) {
  try {
    const userRole = req.user?.role;

    // Super admin nunca tem limites
    if (userRole === 'super_admin') {
      return next();
    }

    const tenantId = req.tenant?.id || req.params.id;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant não identificado'
      });
    }

    // Buscar limite MENSAL, contagem atual E saldo de consultas avulsas
    // NOTA: Limite diário foi removido - não é mais verificado
    const result = await query(`
      SELECT 
        COALESCE(t.limite_novavida_mes_customizado, p.limite_consultas_mes, -1) as limite_mes,
        COALESCE(t.consultas_avulsas_saldo, 0) as consultas_avulsas_saldo,
        (
          SELECT COUNT(*) FROM novavida_consultas
          WHERE tenant_id = t.id
          AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)
          AND is_consulta_avulsa = FALSE
        ) as consultas_mes
      FROM tenants t
      LEFT JOIN plans p ON t.plan_id = p.id
      WHERE t.id = $1
    `, [tenantId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tenant não encontrado'
      });
    }

    const { limite_mes, consultas_mes, consultas_avulsas_saldo } = result.rows[0];

    // Verificar APENAS limite MENSAL (se configurado e maior que 0)
    if (parseInt(limite_mes) > 0) {
      if (parseInt(consultas_mes) >= parseInt(limite_mes)) {
        // Limite mensal atingido! Verificar se há consultas avulsas disponíveis
        const consultasAvulsas = parseInt(consultas_avulsas_saldo) || 0;
        
        if (consultasAvulsas > 0) {
          // ✅ Tem consultas avulsas! Desconta 1 e permite
          console.log(`💰 Limite MENSAL atingido, usando CONSULTA AVULSA - Tenant ${tenantId} - Saldo: ${consultasAvulsas}`);
          
          await query(`
            UPDATE tenants 
            SET consultas_avulsas_saldo = consultas_avulsas_saldo - 1,
                consultas_avulsas_usadas = consultas_avulsas_usadas + 1
            WHERE id = $1
          `, [tenantId]);
          
          // Marcar que usou consulta avulsa (para logging e para salvar no banco)
          req.usouConsultaAvulsa = true;
          req.consultasAvulsasRestantes = consultasAvulsas - 1;
          req.isConsultaAvulsa = true; // Flag para identificar que é consulta avulsa
          
          return next();
        } else {
          // ❌ Não tem consultas avulsas!
          console.log(`🚫 Limite MENSAL de consultas Nova Vida atingido e SEM consultas avulsas - Tenant ${tenantId}: ${consultas_mes}/${limite_mes}`);
          return res.status(403).json({
            success: false,
            message: `❌ Limite de consultas MENSAIS atingido! Máximo: ${limite_mes}, Este mês: ${consultas_mes}. Sem consultas avulsas disponíveis.`,
            limite: parseInt(limite_mes),
            atual: parseInt(consultas_mes),
            tipo: 'mensal',
            consultas_avulsas: 0
          });
        }
      }
    }

    console.log(`✅ Limites Nova Vida OK - Tenant ${tenantId} - Mês: ${consultas_mes}/${limite_mes}, Avulsas: ${consultas_avulsas_saldo}`);
    next();
  } catch (error) {
    console.error('❌ Erro ao verificar limite Nova Vida:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao verificar limite',
      error: error.message
    });
  }
}

/**
 * Middleware para verificar limite de templates
 */
async function checkTemplateLimit(req, res, next) {
  try {
    const userRole = req.user?.role;

    // Super admin nunca tem limites
    if (userRole === 'super_admin') {
      return next();
    }

    const tenantId = req.tenant?.id || req.params.id;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant não identificado'
      });
    }

    // Buscar limite e contagem atual (templates API + QR)
    const result = await query(`
      SELECT 
        COALESCE(p.limite_templates, 5) as limite,
        (
          -- Templates API
          (SELECT COUNT(*) FROM templates WHERE tenant_id = t.id) +
          -- Templates QR Connect
          (SELECT COUNT(*) FROM qr_templates WHERE tenant_id = t.id)
        ) as atual
      FROM tenants t
      LEFT JOIN plans p ON t.plan_id = p.id
      WHERE t.id = $1
    `, [tenantId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tenant não encontrado'
      });
    }

    const { limite, atual } = result.rows[0];

    // Se o limite for -1, significa ilimitado
    if (parseInt(limite) === -1) {
      console.log(`✅ Limite de templates ilimitado - Tenant ${tenantId}`);
      return next();
    }

    if (parseInt(atual) >= parseInt(limite)) {
      console.log(`🚫 Limite de templates atingido - Tenant ${tenantId}: ${atual}/${limite}`);
      return res.status(403).json({
        success: false,
        message: `❌ Limite de templates atingido! Máximo: ${limite}, Atual: ${atual}`,
        limite: parseInt(limite),
        atual: parseInt(atual)
      });
    }

    console.log(`✅ Limite de templates OK - Tenant ${tenantId}: ${atual}/${limite}`);
    next();
  } catch (error) {
    console.error('❌ Erro ao verificar limite de templates:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao verificar limite',
      error: error.message
    });
  }
}

/**
 * Middleware para verificar limite de contatos (base de dados)
 */
async function checkContactLimit(req, res, next) {
  try {
    const userRole = req.user?.role;

    // Super admin nunca tem limites
    if (userRole === 'super_admin') {
      return next();
    }

    const tenantId = req.tenant?.id || req.params.id;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant não identificado'
      });
    }

    // Quantidade de contatos que está tentando adicionar
    const novosContatos = req.body?.contacts?.length || req.body?.contatos?.length || 1;

    // Buscar limite e contagem atual
    const result = await query(`
      SELECT 
        COALESCE(p.limite_contatos, 1000) as limite,
        (SELECT COUNT(*) FROM contacts WHERE tenant_id = t.id) as atual
      FROM tenants t
      LEFT JOIN plans p ON t.plan_id = p.id
      WHERE t.id = $1
    `, [tenantId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tenant não encontrado'
      });
    }

    const { limite, atual } = result.rows[0];
    const totalAposImportacao = parseInt(atual) + parseInt(novosContatos);

    // Se o limite for -1, significa ilimitado
    if (parseInt(limite) === -1) {
      console.log(`✅ Limite de contatos ilimitado - Tenant ${tenantId}`);
      return next();
    }

    if (totalAposImportacao > parseInt(limite)) {
      console.log(`🚫 Limite de contatos atingido - Tenant ${tenantId}: ${atual}/${limite} (tentando adicionar ${novosContatos})`);
      return res.status(403).json({
        success: false,
        message: `❌ Limite de contatos atingido! Máximo: ${limite}, Atual: ${atual}, Tentando adicionar: ${novosContatos}`,
        limite: parseInt(limite),
        atual: parseInt(atual),
        tentando_adicionar: parseInt(novosContatos),
        espaco_disponivel: parseInt(limite) - parseInt(atual)
      });
    }

    console.log(`✅ Limite de contatos OK - Tenant ${tenantId}: ${atual}+${novosContatos}/${limite}`);
    next();
  } catch (error) {
    console.error('❌ Erro ao verificar limite de contatos:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao verificar limite',
      error: error.message
    });
  }
}

module.exports = {
  checkUserLimit,
  checkWhatsAppLimit,
  checkCampaignLimit,
  checkMessageLimit,
  checkNovaVidaLimit,
  checkTemplateLimit,
  checkContactLimit
};
