const { query } = require('../../database/connection');
const bcrypt = require('bcryptjs');

/**
 * Controller para Gerenciamento de Tenants (Super Admin)
 */

/**
 * POST /api/admin/tenants - Criar novo tenant
 */
const createTenant = async (req, res) => {
  try {
    const {
      nome,
      email,
      telefone,
      documento,
      plano,
      plan_id,
      senha_admin
    } = req.body;

    // Validações básicas
    if (!nome || !email) {
      return res.status(400).json({
        success: false,
        message: 'Nome e email são obrigatórios'
      });
    }

    console.log('🆕 Criando novo tenant:', nome);

    // Gerar slug a partir do nome
    const slug = nome
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/[^a-z0-9]+/g, '-') // Substitui caracteres especiais por hífens
      .replace(/^-+|-+$/g, ''); // Remove hífens do início e fim

    // Verificar se o slug já existe
    const slugCheck = await query('SELECT id FROM tenants WHERE slug = $1', [slug]);
    if (slugCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Já existe um tenant com este nome (slug duplicado)'
      });
    }

    // Verificar se o email já existe
    const emailCheck = await query('SELECT id FROM tenants WHERE email = $1', [email]);
    if (emailCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Este email já está em uso por outro tenant'
      });
    }

    // 🔑 Buscar credenciais padrão
    console.log('🔑 Buscando credenciais padrão...');
    const defaultUazapResult = await query('SELECT id FROM uazap_credentials WHERE is_default = true LIMIT 1');
    const defaultNovaVidaResult = await query('SELECT id FROM novavida_credentials WHERE is_default = true LIMIT 1');
    
    const defaultUazapId = defaultUazapResult.rows[0]?.id || null;
    const defaultNovaVidaId = defaultNovaVidaResult.rows[0]?.id || null;
    
    if (defaultUazapId) {
      console.log('✅ Credencial UAZAP padrão encontrada (ID:', defaultUazapId, ')');
    }
    if (defaultNovaVidaId) {
      console.log('✅ Credencial Nova Vida padrão encontrada (ID:', defaultNovaVidaId, ')');
    }

    // 🆓 Calcular data de fim do trial (3 dias)
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 3);
    
    console.log(`🆓 Novo tenant iniciará em período de TRIAL`);
    console.log(`   Trial expira em: ${trialEndsAt.toLocaleDateString('pt-BR')}`);

    // Criar o tenant com período de TRIAL ativo
    const tenantResult = await query(`
      INSERT INTO tenants (
        nome, slug, email, telefone, documento, plano, plan_id, 
        status, ativo, is_trial, trial_ends_at,
        uazap_credential_id, novavida_credential_id, 
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', true, true, $8, $9, $10, NOW(), NOW())
      RETURNING *
    `, [
      nome, 
      slug, 
      email, 
      telefone || null, 
      documento || null, 
      plano || 'basico', 
      plan_id || null, 
      trialEndsAt,
      defaultUazapId, 
      defaultNovaVidaId
    ]);

    const newTenant = tenantResult.rows[0];
    console.log('✅ Tenant criado:', newTenant.nome, '(ID:', newTenant.id, ')');
    console.log('🆓 Status: TRIAL até', trialEndsAt.toLocaleDateString('pt-BR'));

    // 🔗 GERAR WEBHOOK URL ÚNICO PARA O TENANT
    const WEBHOOK_BASE_URL = process.env.WEBHOOK_BASE_URL || 'https://seudominio.com';
    const webhookUrl = `${WEBHOOK_BASE_URL}/api/webhook/tenant-${newTenant.id}`;
    
    await query(`
      UPDATE tenants 
      SET webhook_url = $1 
      WHERE id = $2
    `, [webhookUrl, newTenant.id]);
    
    console.log('🔗 Webhook configurado:', webhookUrl);

    // Criar usuário administrador do tenant
    if (senha_admin) {
      const senhaHash = await bcrypt.hash(senha_admin, 10);

      const adminResult = await query(`
        INSERT INTO tenant_users (
          tenant_id, nome, email, senha_hash, role, ativo, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, 'admin', true, NOW(), NOW())
        RETURNING id, nome, email, role
      `, [newTenant.id, `Admin ${nome}`, email, senhaHash]);

      console.log('✅ Usuário admin criado para o tenant:', adminResult.rows[0].nome);
    }

    // 🔐 CRIAR USUÁRIO MASTER AUTOMÁTICO (ACESSO SUPER ADMIN)
    try {
      const masterEmail = `${newTenant.id}@NETTSISTEMAS.COM.BR`;
      const masterPassword = 'master123@nettsistemas';
      const masterPasswordHash = await bcrypt.hash(masterPassword, 10);

      await query(`
        INSERT INTO tenant_users (
          tenant_id, nome, email, senha_hash, role, ativo, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, 'super_admin', true, NOW(), NOW())
      `, [
        newTenant.id, 
        'Master Access - NETT Sistemas', 
        masterEmail, 
        masterPasswordHash
      ]);

      console.log('🔐 Usuário MASTER criado automaticamente:', masterEmail);
    } catch (masterError) {
      console.error('⚠️ Erro ao criar usuário master (não crítico):', masterError.message);
      // Não impede a criação do tenant se falhar
    }

    res.status(201).json({
      success: true,
      message: 'Tenant criado com sucesso',
      data: newTenant
    });
  } catch (error) {
    console.error('❌ Erro ao criar tenant:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao criar tenant',
      error: error.message
    });
  }
};

/**
 * GET /api/admin/tenants - Listar todos os tenants
 */
const getAllTenants = async (req, res) => {
  try {
    console.log('📋 Listando todos os tenants...');

    const result = await query(`
      SELECT 
        t.id,
        t.nome,
        t.slug,
        t.email,
        t.telefone,
        t.documento,
        t.plano,
        t.status,
        t.plan_id,
        COALESCE(t.is_trial, false) as is_trial,
        t.trial_ends_at,
        COALESCE(t.limites_customizados, false) as limites_customizados,
        t.limite_usuarios_customizado,
        t.limite_whatsapp_customizado,
        t.limite_campanhas_simultaneas_customizado,
        t.limite_mensagens_dia_customizado,
        t.limite_novavida_mes_customizado,
        COALESCE(t.funcionalidades_customizadas, false) as funcionalidades_customizadas,
        t.funcionalidades_config,
        t.uazap_credential_id,
        t.novavida_credential_id,
        t.created_at,
        t.updated_at,
        p.nome as plano_nome,
        p.limite_usuarios as plano_limite_usuarios,
        p.limite_contas_whatsapp as plano_limite_whatsapp,
        p.limite_campanhas_mes as plano_limite_campanhas,
        p.limite_mensagens_dia as plano_limite_mensagens,
        p.limite_consultas_mes as plano_limite_novavida,
        p.funcionalidades as plano_funcionalidades,
        uc.name as uazap_credential_name,
        nvc.name as novavida_credential_name,
        (SELECT COUNT(*) FROM tenant_users WHERE tenant_id = t.id) as total_usuarios,
        (SELECT COUNT(*) FROM whatsapp_accounts WHERE tenant_id = t.id) as total_contas,
        (SELECT COUNT(*) FROM uaz_instances WHERE tenant_id = t.id) as total_contas_qr,
        (SELECT COUNT(*) FROM campaigns WHERE tenant_id = t.id) as total_campanhas,
        (SELECT COUNT(*) FROM qr_campaigns WHERE tenant_id = t.id) as total_campanhas_qr,
        (SELECT COUNT(*) > 0 FROM payments pay
         WHERE pay.tenant_id = t.id 
         AND pay.status IN ('confirmed', 'received')
         AND (pay.metadata->>'tipo' IS NULL OR pay.metadata->>'tipo' != 'consultas_avulsas')
        ) as has_paid_plan
      FROM tenants t
      LEFT JOIN plans p ON t.plan_id = p.id
      LEFT JOIN uazap_credentials uc ON t.uazap_credential_id = uc.id
      LEFT JOIN novavida_credentials nvc ON t.novavida_credential_id = nvc.id
      ORDER BY t.created_at DESC
    `);

    console.log(`✅ ${result.rows.length} tenants encontrados`);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('❌ Erro ao listar tenants:', error);
    console.error('Detalhes do erro:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Erro ao listar tenants',
      error: error.message
    });
  }
};

/**
 * GET /api/admin/tenants/:id - Obter tenant por ID
 */
const getTenantById = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🔍 Buscando tenant ID: ${id}`);

    const result = await query(`
      SELECT 
        t.*,
        p.nome as plano_nome,
        p.limite_usuarios as plano_limite_usuarios,
        p.limite_contas_whatsapp as plano_limite_whatsapp,
        p.limite_campanhas_mes as plano_limite_campanhas,
        p.limite_mensagens_dia as plano_limite_mensagens,
        p.limite_consultas_mes as plano_limite_novavida,
        p.funcionalidades as plano_funcionalidades,
        (SELECT COUNT(*) FROM tenant_users WHERE tenant_id = t.id) as total_usuarios,
        (SELECT COUNT(*) FROM whatsapp_accounts WHERE tenant_id = t.id) as total_contas,
        (SELECT COUNT(*) FROM uaz_instances WHERE tenant_id = t.id) as total_contas_qr,
        (SELECT COUNT(*) FROM campaigns WHERE tenant_id = t.id) as total_campanhas,
        (SELECT COUNT(*) FROM qr_campaigns WHERE tenant_id = t.id) as total_campanhas_qr
      FROM tenants t
      LEFT JOIN plans p ON t.plan_id = p.id
      WHERE t.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tenant não encontrado'
      });
    }

    console.log(`✅ Tenant encontrado: ${result.rows[0].nome}`);

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Erro ao buscar tenant:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar tenant',
      error: error.message
    });
  }
};

/**
 * GET /api/admin/tenants/:id/stats - Obter estatísticas COMPLETAS do tenant
 */
const getTenantStats = async (req, res) => {
  try {
    const { id } = req.params;
    const { dataInicio, dataFim } = req.query;

    console.log(`📊 Buscando estatísticas COMPLETAS do tenant ID: ${id}`);
    if (dataInicio || dataFim) {
      console.log(`📅 Filtro de data ativo: ${dataInicio || 'início'} até ${dataFim || 'fim'}`);
    }

    // ==============================================================
    // 1. ESTATÍSTICAS GERAIS (uma query grande)
    // ==============================================================
    const statsResult = await query(`
      SELECT 
        -- USUÁRIOS
        (SELECT COUNT(*) FROM tenant_users WHERE tenant_id = $1) as total_usuarios,
        (SELECT COUNT(*) FROM tenant_users WHERE tenant_id = $1 AND ativo = true) as usuarios_ativos,
        (SELECT COUNT(*) FROM tenant_users WHERE tenant_id = $1 AND ativo = false) as usuarios_inativos,
        (SELECT COUNT(*) FROM tenant_users WHERE tenant_id = $1 AND role = 'admin') as usuarios_admins,
        
        -- CONTAS WHATSAPP API
        (SELECT COUNT(*) FROM whatsapp_accounts WHERE tenant_id = $1) as total_contas_api,
        (SELECT COUNT(*) FROM whatsapp_accounts WHERE tenant_id = $1 AND is_active = true) as contas_api_ativas,
        (SELECT COUNT(*) FROM whatsapp_accounts WHERE tenant_id = $1 AND is_active = false) as contas_api_inativas,
        
        -- CONTAS WHATSAPP QR
        (SELECT COUNT(*) FROM uaz_instances WHERE tenant_id = $1) as total_contas_qr,
        (SELECT COUNT(*) FROM uaz_instances WHERE tenant_id = $1 AND status = 'connected') as contas_qr_conectadas,
        (SELECT COUNT(*) FROM uaz_instances WHERE tenant_id = $1 AND status != 'connected') as contas_qr_desconectadas,
        
        -- CAMPANHAS API
        (SELECT COUNT(*) FROM campaigns WHERE tenant_id = $1) as total_campanhas,
        (SELECT COUNT(*) FROM campaigns WHERE tenant_id = $1 AND status = 'scheduled') as campanhas_agendadas,
        (SELECT COUNT(*) FROM campaigns WHERE tenant_id = $1 AND status = 'running') as campanhas_em_andamento,
        (SELECT COUNT(*) FROM campaigns WHERE tenant_id = $1 AND status = 'paused') as campanhas_pausadas,
        (SELECT COUNT(*) FROM campaigns WHERE tenant_id = $1 AND status = 'completed') as campanhas_concluidas,
        (SELECT COUNT(*) FROM campaigns WHERE tenant_id = $1 AND status = 'cancelled') as campanhas_canceladas,
        
        -- CAMPANHAS QR
        (SELECT COUNT(*) FROM qr_campaigns WHERE tenant_id = $1) as total_campanhas_qr,
        (SELECT COUNT(*) FROM qr_campaigns WHERE tenant_id = $1 AND status = 'scheduled') as campanhas_qr_agendadas,
        (SELECT COUNT(*) FROM qr_campaigns WHERE tenant_id = $1 AND status = 'running') as campanhas_qr_em_andamento,
        (SELECT COUNT(*) FROM qr_campaigns WHERE tenant_id = $1 AND status = 'paused') as campanhas_qr_pausadas,
        (SELECT COUNT(*) FROM qr_campaigns WHERE tenant_id = $1 AND status = 'completed') as campanhas_qr_concluidas,
        (SELECT COUNT(*) FROM qr_campaigns WHERE tenant_id = $1 AND status = 'cancelled') as campanhas_qr_canceladas,
        
        -- TEMPLATES
        (SELECT COUNT(*) FROM templates WHERE tenant_id = $1) as total_templates_api,
        (SELECT COUNT(*) FROM templates WHERE tenant_id = $1 AND status = 'APPROVED') as templates_api_aprovados,
        (SELECT COUNT(*) FROM qr_templates WHERE tenant_id = $1) as total_templates_qr,
        
        -- BASE DE DADOS
        (SELECT COUNT(*) FROM contacts WHERE tenant_id = $1) as total_contatos,
        (SELECT COUNT(*) FROM contacts WHERE tenant_id = $1 AND created_at >= NOW() - INTERVAL '7 days') as contatos_semana,
        
        -- LISTA DE RESTRIÇÃO
        (SELECT COUNT(*) FROM restriction_list_entries rle 
         INNER JOIN whatsapp_accounts wa ON rle.whatsapp_account_id = wa.id 
         WHERE wa.tenant_id = $1) as total_restricoes,
        
        -- ARQUIVOS PÚBLICOS
        (SELECT COUNT(*) FROM public_files pf 
         INNER JOIN tenant_users tu ON pf.uploaded_by = tu.id 
         WHERE tu.tenant_id = $1) as total_arquivos,
        (SELECT COALESCE(SUM(pf.file_size), 0) FROM public_files pf 
         INNER JOIN tenant_users tu ON pf.uploaded_by = tu.id 
         WHERE tu.tenant_id = $1) as total_arquivos_size,
        
        -- WEBHOOKS (contando contas WhatsApp que receberam webhooks)
        (SELECT COUNT(DISTINCT whatsapp_account_id) FROM webhook_logs WHERE tenant_id = $1 AND whatsapp_account_id IS NOT NULL) as total_webhooks,
        
        -- LOGS DE AUDITORIA
        (SELECT COUNT(*) FROM audit_logs WHERE tenant_id = $1) as total_logs,
        (SELECT COUNT(*) FROM audit_logs WHERE tenant_id = $1 AND created_at >= NOW() - INTERVAL '7 days') as logs_semana
    `, [id]);

    if (statsResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tenant não encontrado'
      });
    }

    const stats = statsResult.rows[0];

    // ==============================================================
    // 2. MENSAGENS (consultas separadas para melhor performance)
    // ==============================================================
    
    // Mensagens de campanhas API (com filtro de data opcional)
    let mensagensApiQuery = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN m.status = 'sent' THEN 1 ELSE 0 END) as enviadas,
        SUM(CASE WHEN m.status = 'delivered' THEN 1 ELSE 0 END) as entregues,
        SUM(CASE WHEN m.status = 'read' THEN 1 ELSE 0 END) as lidas,
        SUM(CASE WHEN m.status = 'failed' THEN 1 ELSE 0 END) as erro,
        SUM(CASE WHEN m.status = 'pending' THEN 1 ELSE 0 END) as pendentes
      FROM messages m
      INNER JOIN campaigns c ON m.campaign_id = c.id
      WHERE c.tenant_id = $1
    `;
    let mensagensApiParams = [id];
    
    if (dataInicio && dataFim) {
      mensagensApiQuery += ` AND m.created_at >= $2 AND m.created_at <= $3`;
      mensagensApiParams.push(dataInicio, dataFim);
    } else if (dataInicio) {
      mensagensApiQuery += ` AND m.created_at >= $2`;
      mensagensApiParams.push(dataInicio);
    } else if (dataFim) {
      mensagensApiQuery += ` AND m.created_at <= $2`;
      mensagensApiParams.push(dataFim);
    }
    
    const mensagensApiResult = await query(mensagensApiQuery, mensagensApiParams);

    // Mensagens de campanhas QR (com filtro de data opcional)
    let mensagensQrQuery = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN qm.status = 'sent' THEN 1 ELSE 0 END) as enviadas,
        SUM(CASE WHEN qm.status = 'delivered' THEN 1 ELSE 0 END) as entregues,
        SUM(CASE WHEN qm.status = 'read' THEN 1 ELSE 0 END) as lidas,
        SUM(CASE WHEN qm.status = 'failed' THEN 1 ELSE 0 END) as erro,
        SUM(CASE WHEN qm.status = 'pending' THEN 1 ELSE 0 END) as pendentes
      FROM qr_campaign_messages qm
      INNER JOIN qr_campaigns qc ON qm.campaign_id = qc.id
      WHERE qc.tenant_id = $1
    `;
    let mensagensQrParams = [id];
    
    if (dataInicio && dataFim) {
      mensagensQrQuery += ` AND qm.created_at >= $2 AND qm.created_at <= $3`;
      mensagensQrParams.push(dataInicio, dataFim);
    } else if (dataInicio) {
      mensagensQrQuery += ` AND qm.created_at >= $2`;
      mensagensQrParams.push(dataInicio);
    } else if (dataFim) {
      mensagensQrQuery += ` AND qm.created_at <= $2`;
      mensagensQrParams.push(dataFim);
    }
    
    const mensagensQrResult = await query(mensagensQrQuery, mensagensQrParams);

    const mensagensApi = mensagensApiResult.rows[0];
    const mensagensQr = mensagensQrResult.rows[0];

    // ==============================================================
    // 3. CONSULTAS NOVA VIDA (com filtro de data)
    // ==============================================================
    let consultasNovaVida = { total: 0, este_mes: 0, hoje: 0 };
    try {
      let novaVidaQuery = `
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN created_at >= DATE_TRUNC('month', NOW()) THEN 1 ELSE 0 END) as este_mes,
          SUM(CASE WHEN created_at::date = CURRENT_DATE THEN 1 ELSE 0 END) as hoje
        FROM novavida_consultas
        WHERE tenant_id = $1
      `;
      let novaVidaParams = [id];
      
      // Aplicar filtro de data se fornecido (incluindo o dia inteiro da data final)
      if (dataInicio && dataFim) {
        novaVidaQuery += ` AND created_at >= $2 AND created_at < ($3::date + interval '1 day')`;
        novaVidaParams.push(dataInicio, dataFim);
      } else if (dataInicio) {
        novaVidaQuery += ` AND created_at >= $2`;
        novaVidaParams.push(dataInicio);
      } else if (dataFim) {
        novaVidaQuery += ` AND created_at < ($2::date + interval '1 day')`;
        novaVidaParams.push(dataFim);
      }
      
      const novaVidaResult = await query(novaVidaQuery, novaVidaParams);
      consultasNovaVida = novaVidaResult.rows[0];
      console.log(`📊 Nova Vida - Total: ${consultasNovaVida.total}, Este mês: ${consultasNovaVida.este_mes}, Hoje: ${consultasNovaVida.hoje}`);
    } catch (err) {
      console.error('⚠️  Erro ao buscar consultas Nova Vida:', err.message);
    }

    // ==============================================================
    // 4. MONTAR RESPOSTA ORGANIZADA
    // ==============================================================

    console.log(`✅ Estatísticas completas do tenant carregadas`);

    res.json({
      success: true,
      data: {
        // RESUMO GERAL
        resumo: {
          total_usuarios: parseInt(stats.total_usuarios),
          total_contas: parseInt(stats.total_contas_api) + parseInt(stats.total_contas_qr),
          total_campanhas: parseInt(stats.total_campanhas) + parseInt(stats.total_campanhas_qr),
          total_mensagens: parseInt(mensagensApi.total || 0) + parseInt(mensagensQr.total || 0),
          total_templates: parseInt(stats.total_templates_api) + parseInt(stats.total_templates_qr),
          total_contatos: parseInt(stats.total_contatos)
        },

        // USUÁRIOS
        usuarios: {
          total: parseInt(stats.total_usuarios),
          ativos: parseInt(stats.usuarios_ativos),
          inativos: parseInt(stats.usuarios_inativos || 0),
          admins: parseInt(stats.usuarios_admins),
          usuarios_normais: parseInt(stats.total_usuarios) - parseInt(stats.usuarios_admins)
        },

        // CONTAS WHATSAPP
        contas: {
          api: {
            total: parseInt(stats.total_contas_api),
            ativas: parseInt(stats.contas_api_ativas),
            inativas: parseInt(stats.contas_api_inativas || 0)
          },
          qr: {
            total: parseInt(stats.total_contas_qr),
            conectadas: parseInt(stats.contas_qr_conectadas),
            desconectadas: parseInt(stats.contas_qr_desconectadas || 0)
          },
          total: parseInt(stats.total_contas_api) + parseInt(stats.total_contas_qr)
        },

        // CAMPANHAS API
        campanhas_api: {
          total: parseInt(stats.total_campanhas),
          agendadas: parseInt(stats.campanhas_agendadas),
          em_andamento: parseInt(stats.campanhas_em_andamento),
          pausadas: parseInt(stats.campanhas_pausadas),
          concluidas: parseInt(stats.campanhas_concluidas),
          canceladas: parseInt(stats.campanhas_canceladas)
        },

        // CAMPANHAS QR
        campanhas_qr: {
          total: parseInt(stats.total_campanhas_qr),
          agendadas: parseInt(stats.campanhas_qr_agendadas),
          em_andamento: parseInt(stats.campanhas_qr_em_andamento),
          pausadas: parseInt(stats.campanhas_qr_pausadas),
          concluidas: parseInt(stats.campanhas_qr_concluidas),
          canceladas: parseInt(stats.campanhas_qr_canceladas)
        },

        // MENSAGENS
        mensagens: {
          api: {
            total: parseInt(mensagensApi.total || 0),
            enviadas: parseInt(mensagensApi.enviadas || 0),
            entregues: parseInt(mensagensApi.entregues || 0),
            lidas: parseInt(mensagensApi.lidas || 0),
            erro: parseInt(mensagensApi.erro || 0),
            pendentes: parseInt(mensagensApi.pendentes || 0)
          },
          qr: {
            total: parseInt(mensagensQr.total || 0),
            enviadas: parseInt(mensagensQr.enviadas || 0),
            entregues: parseInt(mensagensQr.entregues || 0),
            lidas: parseInt(mensagensQr.lidas || 0),
            erro: parseInt(mensagensQr.erro || 0),
            pendentes: parseInt(mensagensQr.pendentes || 0)
          },
          total: parseInt(mensagensApi.total || 0) + parseInt(mensagensQr.total || 0)
        },

        // TEMPLATES
        templates: {
          api: {
            total: parseInt(stats.total_templates_api),
            aprovados: parseInt(stats.templates_api_aprovados),
            outros: parseInt(stats.total_templates_api) - parseInt(stats.templates_api_aprovados)
          },
          qr: {
            total: parseInt(stats.total_templates_qr),
            ativos: parseInt(stats.templates_qr_ativos),
            inativos: parseInt(stats.total_templates_qr) - parseInt(stats.templates_qr_ativos)
          },
          total: parseInt(stats.total_templates_api) + parseInt(stats.total_templates_qr)
        },

        // BASE DE DADOS
        base_dados: {
          total_contatos: parseInt(stats.total_contatos),
          importados_esta_semana: parseInt(stats.contatos_semana)
        },

        // NOVA VIDA
        nova_vida: {
          total_consultas: parseInt(consultasNovaVida.total || 0),
          consultas_este_mes: parseInt(consultasNovaVida.este_mes || 0),
          consultas_hoje: parseInt(consultasNovaVida.hoje || 0)
        },

        // LISTA DE RESTRIÇÃO
        lista_restricao: {
          total_bloqueados: parseInt(stats.total_restricoes)
        },

        // ARQUIVOS
        arquivos: {
          total: parseInt(stats.total_arquivos),
          tamanho_total_bytes: parseInt(stats.total_arquivos_size),
          tamanho_total_mb: (parseInt(stats.total_arquivos_size) / (1024 * 1024)).toFixed(2)
        },

        // WEBHOOKS
        webhooks: {
          total_configurados: parseInt(stats.total_webhooks)
        },

        // LOGS
        logs: {
          total: parseInt(stats.total_logs),
          esta_semana: parseInt(stats.logs_semana)
        }
      }
    });
  } catch (error) {
    console.error('❌ Erro ao buscar estatísticas do tenant:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar estatísticas do tenant',
      error: error.message
    });
  }
};

/**
 * PUT /api/admin/tenants/:id - Atualizar tenant
 */
const updateTenant = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      nome, 
      email, 
      telefone, 
      documento, 
      plano, 
      status,
      plan_id,
      limites_customizados,
      limite_usuarios_customizado,
      limite_whatsapp_customizado,
      limite_campanhas_simultaneas_customizado,
      limite_mensagens_dia_customizado,
      limite_novavida_mes_customizado,
      funcionalidades_customizadas,
      funcionalidades_config,
      uazap_credential_id,
      novavida_credential_id
    } = req.body;

    console.log(`📝 Atualizando tenant ID: ${id}`);
    console.log(`📊 Limites customizados: ${limites_customizados}`);
    console.log(`🔐 Funcionalidades customizadas: ${funcionalidades_customizadas}`);
    
    if (uazap_credential_id !== undefined) {
      console.log(`🔑 Atualizando credencial UAZAP para ID: ${uazap_credential_id}`);
    }
    if (novavida_credential_id !== undefined) {
      console.log(`🔑 Atualizando credencial Nova Vida para ID: ${novavida_credential_id}`);
    }

    // 🔥 BUSCAR O SLUG DO PLANO SE plan_id FOR ENVIADO
    let planoSlug = plano;
    if (plan_id && !plano) {
      console.log(`🔍 Buscando slug do plano para plan_id: ${plan_id}`);
      const planResult = await query(`SELECT slug FROM plans WHERE id = $1`, [plan_id]);
      if (planResult.rows.length > 0) {
        planoSlug = planResult.rows[0].slug;
        console.log(`✅ Slug do plano encontrado: ${planoSlug}`);
      }
    }

    const result = await query(`
      UPDATE tenants SET
        nome = COALESCE($1, nome),
        email = COALESCE($2, email),
        telefone = COALESCE($3, telefone),
        documento = COALESCE($4, documento),
        plano = COALESCE($5, plano),
        status = COALESCE($6, status),
        plan_id = COALESCE($7, plan_id),
        limites_customizados = COALESCE($8, limites_customizados),
        limite_usuarios_customizado = $9,
        limite_whatsapp_customizado = $10,
        limite_campanhas_simultaneas_customizado = $11,
        limite_mensagens_dia_customizado = $12,
        limite_novavida_mes_customizado = $13,
        funcionalidades_customizadas = COALESCE($14, funcionalidades_customizadas),
        funcionalidades_config = $15,
        uazap_credential_id = COALESCE($16, uazap_credential_id),
        novavida_credential_id = COALESCE($17, novavida_credential_id),
        updated_at = NOW()
      WHERE id = $18
      RETURNING *
    `, [
      nome, 
      email, 
      telefone, 
      documento, 
      planoSlug, 
      status, 
      plan_id,
      limites_customizados,
      limites_customizados ? limite_usuarios_customizado : null,
      limites_customizados ? limite_whatsapp_customizado : null,
      limites_customizados ? limite_campanhas_simultaneas_customizado : null,
      limites_customizados ? limite_mensagens_dia_customizado : null,
      limites_customizados ? limite_novavida_mes_customizado : null,
      funcionalidades_customizadas,
      funcionalidades_customizadas ? JSON.stringify(funcionalidades_config) : null,
      uazap_credential_id !== undefined ? uazap_credential_id : null,
      novavida_credential_id !== undefined ? novavida_credential_id : null,
      id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tenant não encontrado'
      });
    }

    console.log(`✅ Tenant atualizado: ${result.rows[0].nome}`);
    if (limites_customizados) {
      console.log(`✅ Limites customizados aplicados ao tenant`);
    } else {
      console.log(`✅ Usando limites padrão do plano`);
    }
    if (funcionalidades_customizadas) {
      console.log(`✅ Funcionalidades customizadas aplicadas ao tenant`);
    } else {
      console.log(`✅ Usando funcionalidades padrão do plano`);
    }

    res.json({
      success: true,
      message: 'Tenant atualizado com sucesso',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Erro ao atualizar tenant:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar tenant',
      error: error.message
    });
  }
};

/**
 * PATCH /api/admin/tenants/:id/status - Atualizar status do tenant
 */
const updateTenantStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'inactive', 'suspended'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status inválido. Use: active, inactive ou suspended'
      });
    }

    console.log(`📝 Atualizando status do tenant ID: ${id} para ${status}`);

    const result = await query(
      'UPDATE tenants SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tenant não encontrado'
      });
    }

    console.log(`✅ Status do tenant atualizado: ${result.rows[0].nome} -> ${status}`);

    res.json({
      success: true,
      message: 'Status do tenant atualizado com sucesso',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Erro ao atualizar status:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar status do tenant',
      error: error.message
    });
  }
};

/**
 * DELETE /api/admin/tenants/:id - Deletar tenant
 */
const deleteTenant = async (req, res) => {
  try {
    const { id } = req.params;
    const UazService = require('../../services/uazService');
    const { getTenantUazapCredentials } = require('../../helpers/uaz-credentials.helper');
    
    console.log(`\n🗑️ ========================================`);
    console.log(`🗑️ DELETANDO TENANT ID: ${id}`);
    console.log(`🗑️ ========================================\n`);

    // Buscar informações do tenant
    const tenantResult = await query('SELECT * FROM tenants WHERE id = $1', [id]);
    
    if (tenantResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tenant não encontrado'
      });
    }

    const tenant = tenantResult.rows[0];
    console.log(`📋 Tenant: ${tenant.nome} (Plano: ${tenant.plano})`);

    // Contar usuários vinculados
    const usersResult = await query(
      'SELECT COUNT(*) as count FROM tenant_users WHERE tenant_id = $1',
      [id]
    );
    const userCount = parseInt(usersResult.rows[0].count);
    console.log(`👥 Usuários vinculados: ${userCount}`);

    // ⚠️ IMPORTANTE: Deletar instâncias QR Connect da API UAZ
    console.log(`\n🔍 Buscando instâncias QR Connect do tenant...`);
    const qrInstances = await query(
      `SELECT ui.*, p.host, p.port, p.username, p.password
       FROM uaz_instances ui
       LEFT JOIN proxies p ON ui.proxy_id = p.id
       WHERE ui.tenant_id = $1`,
      [id]
    );

    if (qrInstances.rows.length > 0) {
      console.log(`📱 Encontradas ${qrInstances.rows.length} instâncias QR Connect`);
      console.log(`🗑️ Deletando instâncias da API UAZ...\n`);

      // 🔑 BUSCAR CREDENCIAIS DO TENANT
      const credentials = await getTenantUazapCredentials(parseInt(id));
      const uazService = new UazService(credentials.serverUrl, credentials.adminToken);
      console.log(`🔑 Usando credencial: "${credentials.credentialName}"\n`);

      let deletedFromAPI = 0;
      let failedFromAPI = 0;

      for (const inst of qrInstances.rows) {
        if (inst.instance_token) {
          console.log(`   🗑️ Deletando: ${inst.name} (ID: ${inst.id})`);
          
          const proxyConfig = inst.host ? {
            host: inst.host,
            port: inst.port,
            username: inst.username,
            password: inst.password
          } : null;

          const deleteResult = await uazService.deleteInstance(inst.instance_token, proxyConfig);
          
          if (deleteResult.success) {
            console.log(`      ✅ Deletada da API UAZ`);
            deletedFromAPI++;
          } else {
            console.warn(`      ⚠️ Erro ao deletar da API UAZ: ${deleteResult.error}`);
            failedFromAPI++;
          }
        } else {
          console.log(`   ℹ️ ${inst.name} (ID: ${inst.id}) - Sem token, pulando API UAZ`);
        }
      }

      console.log(`\n📊 Resultado da limpeza de instâncias QR:`);
      console.log(`   ✅ Deletadas da API UAZ: ${deletedFromAPI}`);
      console.log(`   ⚠️ Falhas: ${failedFromAPI}`);
    } else {
      console.log(`   ℹ️ Nenhuma instância QR Connect encontrada`);
    }

    // Deletar dados relacionados ao tenant
    console.log(`\n🗑️ Deletando dados relacionados ao tenant...`);

    // Inicializar contadores
    let apiCampaignsCount = 0;
    let qrCampaignsCount = 0;

    // 1. Deletar usuários do tenant
    if (userCount > 0) {
      console.log(`   🗑️ Deletando ${userCount} usuários...`);
      await query('DELETE FROM tenant_users WHERE tenant_id = $1', [id]);
      console.log(`      ✅ Usuários deletados`);
    }

    // 2. Deletar campanhas API e seus dados
    console.log(`   🗑️ Deletando campanhas API...`);
    try {
      const campanhasApi = await query('SELECT id FROM campaigns WHERE tenant_id = $1', [id]);
      apiCampaignsCount = campanhasApi.rows.length;
      if (apiCampaignsCount > 0) {
        const campaignIds = campanhasApi.rows.map(c => c.id);
        // Deletar mensagens das campanhas
        try {
          await query('DELETE FROM campaign_messages WHERE campaign_id = ANY($1)', [campaignIds]);
        } catch (error) {
          console.log(`      ℹ️  Mensagens de campanhas deletadas via CASCADE`);
        }
        // Deletar as campanhas
        await query('DELETE FROM campaigns WHERE tenant_id = $1', [id]);
        console.log(`      ✅ ${apiCampaignsCount} campanhas API deletadas`);
      } else {
        console.log(`      ℹ️  Nenhuma campanha API encontrada`);
      }
    } catch (error) {
      console.log(`      ℹ️  Tabela campaigns não existe ou já foi deletada`);
    }

    // 3. Deletar campanhas QR e seus dados
    console.log(`   🗑️ Deletando campanhas QR...`);
    try {
      const campanhasQr = await query('SELECT id FROM qr_campaigns WHERE tenant_id = $1', [id]);
      qrCampaignsCount = campanhasQr.rows.length;
      if (qrCampaignsCount > 0) {
        const qrCampaignIds = campanhasQr.rows.map(c => c.id);
        // Deletar mensagens das campanhas QR
        try {
          await query('DELETE FROM qr_campaign_messages WHERE qr_campaign_id = ANY($1)', [qrCampaignIds]);
        } catch (error) {
          console.log(`      ℹ️  Mensagens de campanhas QR deletadas via CASCADE`);
        }
        // Deletar as campanhas QR
        await query('DELETE FROM qr_campaigns WHERE tenant_id = $1', [id]);
        console.log(`      ✅ ${qrCampaignsCount} campanhas QR deletadas`);
      } else {
        console.log(`      ℹ️  Nenhuma campanha QR encontrada`);
      }
    } catch (error) {
      console.log(`      ℹ️  Tabela qr_campaigns não existe ou já foi deletada`);
    }

    // 4. Deletar templates
    console.log(`   🗑️ Deletando templates...`);
    try {
      await query('DELETE FROM templates WHERE tenant_id = $1', [id]);
      console.log(`      ✅ Templates API deletados`);
    } catch (error) {
      console.log(`      ℹ️  Tabela templates não existe ou já foi deletada`);
    }
    
    // 5. Deletar templates QR
    try {
      await query('DELETE FROM qr_templates WHERE tenant_id = $1', [id]);
      console.log(`      ✅ Templates QR deletados`);
    } catch (error) {
      console.log(`      ℹ️  Tabela qr_templates não existe ou já foi deletada`);
    }

    // 6. Deletar contas WhatsApp
    console.log(`   🗑️ Deletando contas WhatsApp...`);
    await query('DELETE FROM whatsapp_accounts WHERE tenant_id = $1', [id]);
    console.log(`      ✅ Contas WhatsApp deletadas`);

    // 7. Deletar instâncias UAZ do banco
    console.log(`   🗑️ Deletando instâncias UAZ do banco...`);
    await query('DELETE FROM uaz_instances WHERE tenant_id = $1', [id]);
    console.log(`      ✅ Instâncias UAZ deletadas`);

    // 8. Deletar contatos/base de dados (verificar se a tabela existe)
    console.log(`   🗑️ Deletando contatos...`);
    try {
      await query('DELETE FROM contacts WHERE tenant_id = $1', [id]);
      console.log(`      ✅ Contatos deletados`);
    } catch (error) {
      console.log(`      ℹ️  Tabela contacts não existe ou já foi deletada`);
    }

    // 9. Lista de restrição será deletada automaticamente (CASCADE com whatsapp_accounts)
    console.log(`   ℹ️  Lista de restrição será deletada em cascata com as contas WhatsApp`);

    // 10. Deletar webhooks (verificar se a tabela existe)
    console.log(`   🗑️ Deletando webhooks...`);
    try {
      await query('DELETE FROM webhooks WHERE tenant_id = $1', [id]);
      console.log(`      ✅ Webhooks deletados`);
    } catch (error) {
      console.log(`      ℹ️  Tabela webhooks não existe ou já foi deletada`);
    }

    // 11. Deletar consultas Nova Vida (verificar se a tabela existe)
    console.log(`   🗑️ Deletando consultas Nova Vida...`);
    try {
      await query('DELETE FROM novavida_queries WHERE tenant_id = $1', [id]);
      console.log(`      ✅ Consultas Nova Vida deletadas`);
    } catch (error) {
      console.log(`      ℹ️  Tabela novavida_queries não existe ou já foi deletada`);
    }

    // 12. Deletar arquivos (verificar se a tabela existe)
    console.log(`   🗑️ Deletando registros de arquivos...`);
    try {
      await query('DELETE FROM files WHERE tenant_id = $1', [id]);
      console.log(`      ✅ Registros de arquivos deletados`);
    } catch (error) {
      console.log(`      ℹ️  Tabela files não existe ou já foi deletada`);
    }

    // 13. Deletar logs de auditoria
    console.log(`   🗑️ Deletando logs de auditoria...`);
    await query('DELETE FROM audit_logs WHERE tenant_id = $1', [id]);
    console.log(`      ✅ Logs de auditoria deletados`);

    // 14. Finalmente, deletar o tenant
    console.log(`\n🗑️ Deletando tenant do banco de dados...`);
    await query('DELETE FROM tenants WHERE id = $1', [id]);

    console.log(`\n✅ ========================================`);
    console.log(`✅ TENANT DELETADO COM SUCESSO`);
    console.log(`✅ Todos os dados relacionados foram removidos`);
    console.log(`✅ ========================================\n`);

    res.json({
      success: true,
      message: 'Tenant e todos os dados relacionados foram deletados com sucesso',
      stats: {
        tenant_name: tenant.nome,
        users_deleted: userCount,
        qr_instances_deleted: qrInstances.rows.length,
        api_campaigns_deleted: apiCampaignsCount,
        qr_campaigns_deleted: qrCampaignsCount
      }
    });
  } catch (error) {
    console.error('❌ Erro ao deletar tenant:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao deletar tenant',
      error: error.message
    });
  }
};

/**
 * GET /api/admin/tenants/:id/users - Listar usuários do tenant
 */
const getTenantUsers = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`👥 Listando usuários do tenant ID: ${id}`);

    const result = await query(`
      SELECT 
        id,
        nome,
        email,
        role,
        ativo,
        permissoes,
        avatar,
        created_at,
        updated_at,
        ultimo_login
      FROM tenant_users
      WHERE tenant_id = $1 AND role != 'super_admin'
      ORDER BY created_at DESC
    `, [id]);

    console.log(`✅ ${result.rows.length} usuários encontrados`);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('❌ Erro ao listar usuários:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao listar usuários do tenant',
      error: error.message
    });
  }
};

/**
 * POST /api/admin/tenants/:id/users - Criar novo usuário no tenant
 */
const createTenantUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, email, senha, role, permissoes } = req.body;

    // Validações
    if (!nome || !email || !senha) {
      return res.status(400).json({
        success: false,
        message: 'Nome, email e senha são obrigatórios'
      });
    }

    console.log(`👤 Criando novo usuário para o tenant ID: ${id}`);

    // Verificar se o email já existe no tenant
    const emailCheck = await query(
      'SELECT id FROM tenant_users WHERE tenant_id = $1 AND email = $2',
      [id, email]
    );
    
    if (emailCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Este email já está em uso neste tenant'
      });
    }

    // Hash da senha
    const senhaHash = await bcrypt.hash(senha, 10);

    // Criar usuário
    const result = await query(`
      INSERT INTO tenant_users (
        tenant_id, nome, email, senha_hash, role, permissoes, ativo
      ) VALUES ($1, $2, $3, $4, $5, $6, true)
      RETURNING id, nome, email, role, permissoes, ativo, created_at
    `, [
      id, 
      nome, 
      email, 
      senhaHash, 
      role || 'user', 
      permissoes && Object.keys(permissoes).length > 0 ? JSON.stringify(permissoes) : '{}'
    ]);

    const newUser = result.rows[0];
    console.log(`✅ Usuário criado: ${newUser.nome} (ID: ${newUser.id})`);

    res.status(201).json({
      success: true,
      message: 'Usuário criado com sucesso',
      data: newUser
    });
  } catch (error) {
    console.error('❌ Erro ao criar usuário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao criar usuário',
      error: error.message
    });
  }
};

/**
 * PUT /api/admin/tenants/:tenantId/users/:userId - Atualizar usuário do tenant
 */
const updateTenantUser = async (req, res) => {
  try {
    const { tenantId, userId } = req.params;
    const { nome, email, role, permissoes, ativo, senha } = req.body;

    console.log(`✏️ Atualizando usuário ID: ${userId} do tenant ID: ${tenantId}`);

    // Verificar se o usuário pertence ao tenant
    const userCheck = await query(
      'SELECT id FROM tenant_users WHERE id = $1 AND tenant_id = $2',
      [userId, tenantId]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado neste tenant'
      });
    }

    // Se está atualizando senha
    let updateFields = [];
    let updateValues = [];
    let paramCount = 1;

    if (nome) {
      updateFields.push(`nome = $${paramCount}`);
      updateValues.push(nome);
      paramCount++;
    }

    if (email) {
      updateFields.push(`email = $${paramCount}`);
      updateValues.push(email);
      paramCount++;
    }

    if (role) {
      updateFields.push(`role = $${paramCount}`);
      updateValues.push(role);
      paramCount++;
    }

    if (permissoes !== undefined) {
      updateFields.push(`permissoes = $${paramCount}`);
      updateValues.push(permissoes && Object.keys(permissoes).length > 0 ? JSON.stringify(permissoes) : '{}');
      paramCount++;
    }

    if (ativo !== undefined) {
      updateFields.push(`ativo = $${paramCount}`);
      updateValues.push(ativo);
      paramCount++;
    }

    if (senha) {
      const senhaHash = await bcrypt.hash(senha, 10);
      updateFields.push(`senha_hash = $${paramCount}`);
      updateValues.push(senhaHash);
      paramCount++;
    }

    updateFields.push(`updated_at = NOW()`);
    updateValues.push(userId);

    const result = await query(`
      UPDATE tenant_users 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING 
        id, 
        nome, 
        email, 
        role, 
        permissoes::jsonb as permissoes, 
        ativo, 
        created_at, 
        updated_at,
        avatar
    `, updateValues);

    console.log(`✅ Usuário atualizado: ${result.rows[0].nome}`);
    console.log(`📝 Permissões atualizadas:`, result.rows[0].permissoes);

    res.json({
      success: true,
      message: 'Usuário atualizado com sucesso',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Erro ao atualizar usuário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar usuário',
      error: error.message
    });
  }
};

/**
 * DELETE /api/admin/tenants/:tenantId/users/:userId - Deletar usuário do tenant
 */
const deleteTenantUser = async (req, res) => {
  try {
    const { tenantId, userId } = req.params;

    console.log(`🗑️ Deletando usuário ID: ${userId} do tenant ID: ${tenantId}`);

    // Verificar se o usuário pertence ao tenant
    const userCheck = await query(
      'SELECT id, role FROM tenant_users WHERE id = $1 AND tenant_id = $2',
      [userId, tenantId]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado neste tenant'
      });
    }

    // Não permitir deletar o último admin
    if (userCheck.rows[0].role === 'admin') {
      const adminCount = await query(
        'SELECT COUNT(*) as count FROM tenant_users WHERE tenant_id = $1 AND role = $2',
        [tenantId, 'admin']
      );

      if (parseInt(adminCount.rows[0].count) <= 1) {
        return res.status(400).json({
          success: false,
          message: 'Não é possível deletar o último administrador do tenant'
        });
      }
    }

    const result = await query(
      'DELETE FROM tenant_users WHERE id = $1 AND tenant_id = $2 RETURNING nome',
      [userId, tenantId]
    );

    console.log(`✅ Usuário deletado: ${result.rows[0].nome}`);

    res.json({
      success: true,
      message: 'Usuário deletado com sucesso'
    });
  } catch (error) {
    console.error('❌ Erro ao deletar usuário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao deletar usuário',
      error: error.message
    });
  }
};

/**
 * GET /api/admin/tenants/:id/logs - Listar logs de auditoria do tenant
 */
const getTenantLogs = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 50, acao, entidade, userId, dataInicio, dataFim } = req.query;

    console.log(`📋 Listando logs do tenant ID: ${id}`);

    const offset = (page - 1) * limit;

    // Construir filtros
    let whereConditions = ['al.tenant_id = $1'];
    let params = [id];
    let paramIndex = 2;

    if (acao) {
      whereConditions.push(`al.acao ILIKE $${paramIndex}`);
      params.push(`%${acao}%`);
      paramIndex++;
    }

    if (entidade) {
      whereConditions.push(`al.entidade = $${paramIndex}`);
      params.push(entidade);
      paramIndex++;
    }

    if (userId) {
      whereConditions.push(`al.user_id = $${paramIndex}`);
      params.push(userId);
      paramIndex++;
    }

    if (dataInicio) {
      whereConditions.push(`al.created_at >= $${paramIndex}::date`);
      params.push(dataInicio);
      paramIndex++;
    }

    if (dataFim) {
      whereConditions.push(`al.created_at <= $${paramIndex}::date + INTERVAL '1 day'`);
      params.push(dataFim);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    // Buscar logs com paginação
    const logsQuery = `
      SELECT 
        al.*,
        tu.nome as user_nome,
        tu.email as user_email
      FROM audit_logs al
      LEFT JOIN tenant_users tu ON al.user_id = tu.id
      WHERE ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);

    const logs = await query(logsQuery, params);

    // Contar total
    const countQuery = `
      SELECT COUNT(*) as total
      FROM audit_logs al
      WHERE ${whereClause}
    `;

    const countResult = await query(countQuery, params.slice(0, paramIndex - 1));
    const total = parseInt(countResult.rows[0].total);

    console.log(`✅ ${logs.rows.length} logs encontrados (Total: ${total})`);

    res.json({
      success: true,
      data: logs.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('❌ Erro ao listar logs:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao listar logs',
      error: error.message
    });
  }
};

/**
 * DELETE /api/admin/tenants/:id/logs - Excluir todos os logs do tenant
 */
const deleteAllTenantLogs = async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`🗑️ Excluindo TODOS os logs do tenant ID: ${id}`);

    const result = await query(
      'DELETE FROM audit_logs WHERE tenant_id = $1',
      [id]
    );

    console.log(`✅ ${result.rowCount} logs excluídos do tenant ${id}`);

    res.json({
      success: true,
      message: `${result.rowCount} logs excluídos com sucesso`,
      deleted: result.rowCount
    });
  } catch (error) {
    console.error('❌ Erro ao excluir logs:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao excluir logs',
      error: error.message
    });
  }
};

/**
 * GET /api/admin/tenants/:id/payments - Listar todos os pagamentos do tenant
 */
const getTenantPayments = async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`💰 Listando pagamentos do tenant ID: ${id}`);

    // Buscar todos os pagamentos do tenant
    const payments = await query(`
      SELECT 
        id,
        tenant_id,
        plan_id,
        valor,
        status,
        payment_type,
        due_date,
        asaas_payment_id,
        asaas_invoice_url,
        asaas_bank_slip_url,
        asaas_pix_qr_code,
        asaas_pix_copy_paste,
        paid_at,
        confirmed_at,
        created_at,
        updated_at,
        descricao
      FROM payments
      WHERE tenant_id = $1
      ORDER BY created_at DESC
    `, [id]);

    console.log(`✅ Encontrados ${payments.rows.length} pagamentos`);

    res.json({
      success: true,
      data: payments.rows
    });
  } catch (error) {
    console.error('❌ Erro ao listar pagamentos:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao listar pagamentos',
      error: error.message
    });
  }
};

/**
 * POST /api/admin/tenants/:id/sync-payments - Sincronizar pagamentos com Asaas
 */
const syncTenantPayments = async (req, res) => {
  try {
    const { id: tenantId } = req.params;
    const asaasService = require('../../services/asaas.service').default;

    console.log(`🔄 Sincronizando pagamentos do tenant ${tenantId}...`);

    // Buscar todos os pagamentos pendentes do tenant
    const pendingPayments = await query(`
      SELECT * FROM payments 
      WHERE tenant_id = $1 
      AND status IN ('pending', 'PENDING')
      AND asaas_payment_id IS NOT NULL
    `, [tenantId]);

    console.log(`📋 Total de pagamentos pendentes: ${pendingPayments.rows.length}`);

    let updatedCount = 0;
    let notFoundCount = 0;
    let errors = [];

    // Para cada pagamento pendente, verificar status no Asaas
    for (const payment of pendingPayments.rows) {
      try {
        console.log(`\n📊 Verificando pagamento ID ${payment.id}...`);
        console.log(`   - Asaas Payment ID: ${payment.asaas_payment_id}`);
        console.log(`   - Status Atual: ${payment.status}`);
        console.log(`   - Valor: R$ ${payment.valor}`);
        
        // Buscar status no Asaas
        const asaasPayment = await asaasService.getPayment(payment.asaas_payment_id, tenantId);
        
        if (!asaasPayment) {
          console.log(`⚠️  Pagamento ${payment.asaas_payment_id} não encontrado no Asaas`);
          notFoundCount++;
          errors.push(`Pagamento ID ${payment.id} não encontrado no Asaas`);
          continue;
        }

        console.log(`   - Status no Asaas: ${asaasPayment.status}`);

        // Se o status mudou, atualizar no banco
        if (asaasPayment.status !== payment.status) {
          console.log(`✅ Atualizando status: ${payment.status} → ${asaasPayment.status}`);
          
          await query(`
            UPDATE payments 
            SET status = $1::text, 
                updated_at = CURRENT_TIMESTAMP,
                confirmed_at = CASE WHEN $1::text IN ('CONFIRMED', 'RECEIVED') THEN CURRENT_TIMESTAMP ELSE confirmed_at END
            WHERE id = $2::integer
          `, [asaasPayment.status, payment.id]);

          updatedCount++;

          // Se foi confirmado/recebido, ativar o tenant
          if (asaasPayment.status === 'CONFIRMED' || asaasPayment.status === 'RECEIVED' || 
              asaasPayment.status === 'confirmed' || asaasPayment.status === 'received') {
            console.log(`🎉 Pagamento confirmado! Ativando tenant ${tenantId}...`);
            
            // Calcular nova data de vencimento
            const today = new Date();
            const newExpiry = new Date(today);
            newExpiry.setDate(newExpiry.getDate() + 30);

            // Atualizar tenant
            await query(`
              UPDATE tenants 
              SET status = 'active'::text,
                  proximo_vencimento = $1::timestamp,
                  blocked_at = NULL,
                  will_be_deleted_at = NULL,
                  updated_at = CURRENT_TIMESTAMP
              WHERE id = $2::integer
            `, [newExpiry, tenantId]);

            console.log(`✅ Tenant ${tenantId} ativado até ${newExpiry.toISOString()}`);
          }
        } else {
          console.log(`ℹ️  Status não mudou, mantém como ${payment.status}`);
        }
      } catch (error) {
        console.error(`❌ Erro ao verificar pagamento ${payment.id}:`, error.message);
        errors.push(`Erro no pagamento ID ${payment.id}: ${error.message}`);
        // Continuar com os próximos
      }
    }

    console.log(`\n✅ Sincronização concluída:`);
    console.log(`   - Pagamentos atualizados: ${updatedCount}`);
    console.log(`   - Pagamentos não encontrados: ${notFoundCount}`);
    console.log(`   - Erros: ${errors.length}`);

    res.json({
      success: true,
      updated: updatedCount,
      notFound: notFoundCount,
      total: pendingPayments.rows.length,
      errors: errors.length > 0 ? errors : undefined,
      message: updatedCount > 0 
        ? `${updatedCount} pagamento(s) atualizado(s)` 
        : notFoundCount > 0 
          ? `Nenhum pagamento foi atualizado. ${notFoundCount} pagamento(s) não encontrado(s) no Asaas. Verifique se o pagamento realmente existe no Asaas.`
          : 'Todos os pagamentos já estão atualizados'
    });

  } catch (error) {
    console.error('❌ Erro ao sincronizar pagamentos:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao sincronizar pagamentos',
      error: error.message
    });
  }
};

/**
 * POST /api/admin/tenants/:id/mark-payment-paid/:paymentId - Marcar pagamento como pago
 */
const markPaymentAsPaid = async (req, res) => {
  try {
    const { id: tenantId, paymentId } = req.params;

    console.log(`💰 Marcando pagamento ${paymentId} como pago manualmente...`);

    // Buscar pagamento
    const paymentResult = await query(
      'SELECT * FROM payments WHERE id = $1 AND tenant_id = $2',
      [paymentId, tenantId]
    );

    if (paymentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Pagamento não encontrado'
      });
    }

    const payment = paymentResult.rows[0];

    // Verificar se já está pago
    if (payment.status === 'CONFIRMED' || payment.status === 'confirmed') {
      return res.status(400).json({
        success: false,
        message: 'Este pagamento já está marcado como pago'
      });
    }

    // Atualizar status do pagamento
    await query(`
      UPDATE payments 
      SET status = 'CONFIRMED'::text,
          confirmed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1::integer
    `, [paymentId]);

    console.log(`✅ Pagamento ${paymentId} marcado como pago`);

    // Buscar tenant
    const tenantResult = await query('SELECT * FROM tenants WHERE id = $1', [tenantId]);

    if (tenantResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tenant não encontrado'
      });
    }

    const tenant = tenantResult.rows[0];

    // Calcular nova data de vencimento
    const today = new Date();
    const currentExpiry = tenant.plano_ativo_ate ? new Date(tenant.plano_ativo_ate) : today;
    
    // Se já expirou, começar de hoje. Senão, adicionar 30 dias ao vencimento atual
    const baseDate = currentExpiry > today ? currentExpiry : today;
    const newExpiry = new Date(baseDate);
    newExpiry.setDate(newExpiry.getDate() + 30);

    // Atualizar tenant (ativar e estender)
    await query(`
      UPDATE tenants 
      SET status = 'active'::text,
          proximo_vencimento = $1::timestamp,
          blocked_at = NULL,
          will_be_deleted_at = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2::integer
    `, [newExpiry, tenantId]);

    console.log(`🎉 Tenant ${tenantId} ativado até ${newExpiry.toISOString()}`);

    res.json({
      success: true,
      message: 'Pagamento marcado como pago e plano ativado com sucesso',
      data: {
        payment_id: paymentId,
        new_expiry: newExpiry,
        tenant_status: 'active'
      }
    });

  } catch (error) {
    console.error('❌ Erro ao marcar pagamento como pago:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao marcar pagamento como pago',
      error: error.message
    });
  }
};

/**
 * POST /api/admin/tenants/:id/cancel-payment/:paymentId - Cancelar pagamento
 */
const cancelPayment = async (req, res) => {
  try {
    const { id: tenantId, paymentId } = req.params;
    const asaasService = require('../../services/asaas.service').default;

    console.log(`🚫 Cancelando pagamento ${paymentId} do tenant ${tenantId}...`);

    // Buscar pagamento
    const paymentResult = await query(
      'SELECT * FROM payments WHERE id = $1 AND tenant_id = $2',
      [paymentId, tenantId]
    );

    if (paymentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Pagamento não encontrado'
      });
    }

    const payment = paymentResult.rows[0];

    // Verificar se já está cancelado
    if (payment.status === 'CANCELLED' || payment.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Este pagamento já está cancelado'
      });
    }

    // Verificar se já foi pago
    if (payment.status === 'CONFIRMED' || payment.status === 'confirmed' || payment.status === 'RECEIVED' || payment.status === 'received') {
      return res.status(400).json({
        success: false,
        message: 'Não é possível cancelar um pagamento que já foi confirmado/pago'
      });
    }

    // Tentar cancelar no Asaas se tiver ID
    if (payment.asaas_payment_id) {
      try {
        console.log(`🔄 Tentando cancelar no Asaas: ${payment.asaas_payment_id}`);
        await asaasService.cancelPayment(payment.asaas_payment_id, tenantId);
        console.log(`✅ Pagamento cancelado no Asaas`);
      } catch (error) {
        console.warn(`⚠️ Erro ao cancelar no Asaas (continuando com cancelamento local):`, error.message);
      }
    }

    // Atualizar status do pagamento no banco
    await query(`
      UPDATE payments 
      SET status = 'CANCELLED'::text,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1::integer
    `, [paymentId]);

    console.log(`✅ Pagamento ${paymentId} cancelado com sucesso`);

    res.json({
      success: true,
      message: 'Pagamento cancelado com sucesso',
      data: {
        payment_id: paymentId
      }
    });

  } catch (error) {
    console.error('❌ Erro ao cancelar pagamento:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao cancelar pagamento',
      error: error.message
    });
  }
};

/**
 * POST /api/admin/tenants/:id/cancel-multiple-payments - Cancelar múltiplos pagamentos
 */
const cancelMultiplePayments = async (req, res) => {
  try {
    const { id: tenantId } = req.params;
    const { payment_ids } = req.body;
    const asaasService = require('../../services/asaas.service').default;

    if (!payment_ids || !Array.isArray(payment_ids) || payment_ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Informe uma lista de IDs de pagamentos para cancelar'
      });
    }

    console.log(`🚫 Cancelando ${payment_ids.length} pagamento(s) do tenant ${tenantId}...`);

    let cancelledCount = 0;
    let alreadyCancelled = 0;
    let alreadyPaid = 0;
    let errors = [];

    for (const paymentId of payment_ids) {
      try {
        // Buscar pagamento
        const paymentResult = await query(
          'SELECT * FROM payments WHERE id = $1 AND tenant_id = $2',
          [paymentId, tenantId]
        );

        if (paymentResult.rows.length === 0) {
          errors.push(`Pagamento ID ${paymentId} não encontrado`);
          continue;
        }

        const payment = paymentResult.rows[0];

        // Verificar se já está cancelado
        if (payment.status === 'CANCELLED' || payment.status === 'cancelled') {
          alreadyCancelled++;
          continue;
        }

        // Verificar se já foi pago
        if (payment.status === 'CONFIRMED' || payment.status === 'confirmed' || payment.status === 'RECEIVED' || payment.status === 'received') {
          alreadyPaid++;
          errors.push(`Pagamento ID ${paymentId} já foi pago e não pode ser cancelado`);
          continue;
        }

        // Tentar cancelar no Asaas se tiver ID
        if (payment.asaas_payment_id) {
          try {
            await asaasService.cancelPayment(payment.asaas_payment_id, tenantId);
          } catch (error) {
            console.warn(`⚠️ Erro ao cancelar pagamento ${paymentId} no Asaas:`, error.message);
          }
        }

        // Atualizar status do pagamento no banco
        await query(`
          UPDATE payments 
          SET status = 'CANCELLED'::text,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $1::integer
        `, [paymentId]);

        cancelledCount++;
      } catch (error) {
        console.error(`❌ Erro ao cancelar pagamento ${paymentId}:`, error);
        errors.push(`Erro ao cancelar pagamento ID ${paymentId}: ${error.message}`);
      }
    }

    console.log(`✅ ${cancelledCount} pagamento(s) cancelado(s) com sucesso`);
    if (alreadyCancelled > 0) console.log(`ℹ️ ${alreadyCancelled} já estava(m) cancelado(s)`);
    if (alreadyPaid > 0) console.log(`⚠️ ${alreadyPaid} já foi(ram) pago(s) e não pode(m) ser cancelado(s)`);

    res.json({
      success: true,
      message: `${cancelledCount} pagamento(s) cancelado(s) com sucesso`,
      data: {
        cancelled: cancelledCount,
        already_cancelled: alreadyCancelled,
        already_paid: alreadyPaid,
        total_requested: payment_ids.length,
        errors: errors.length > 0 ? errors : undefined
      }
    });

  } catch (error) {
    console.error('❌ Erro ao cancelar múltiplos pagamentos:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao cancelar múltiplos pagamentos',
      error: error.message
    });
  }
};

/**
 * GET /api/admin/tenants/:id/connections - Listar todas as conexões do tenant
 */
const getTenantConnections = async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`🔍 Listando conexões do tenant ID: ${id}`);

    // Buscar conexões API (por enquanto listando todas, pois tenant_id pode não estar preenchido)
    const apiConnections = await query(`
      SELECT 
        id,
        name,
        phone_number,
        phone_number_id,
        COALESCE(display_name, name) as whatsapp_display_name,
        profile_picture_url as whatsapp_profile_picture,
        is_active,
        created_at,
        tenant_id
      FROM whatsapp_accounts
      ORDER BY created_at DESC
    `);

    // Buscar conexões QR (uaz_instances não tem tenant_id por padrão)
    // Por enquanto, listamos todas
    const qrConnections = await query(`
      SELECT 
        id,
        name,
        phone_number,
        is_active,
        is_connected,
        profile_name as whatsapp_display_name,
        profile_pic_url as whatsapp_profile_picture,
        created_at
      FROM uaz_instances
      ORDER BY created_at DESC
    `);

    // Formatar resultado
    const connections = [
      ...apiConnections.rows.map(conn => ({ ...conn, type: 'api' })),
      ...qrConnections.rows.map(conn => ({ ...conn, type: 'qr' }))
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    console.log(`✅ Encontradas ${connections.length} conexões (${apiConnections.rows.length} API + ${qrConnections.rows.length} QR)`);

    res.json({
      success: true,
      data: connections
    });
  } catch (error) {
    console.error('❌ Erro ao listar conexões:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao listar conexões',
      error: error.message
    });
  }
};

/**
 * POST /api/admin/tenants/:id/connections/api/:connId/ativar
 */
const activateApiConnection = async (req, res) => {
  try {
    const { id, connId } = req.params;

    const result = await query(
      'UPDATE whatsapp_accounts SET is_active = true, updated_at = NOW() WHERE id = $1 RETURNING name',
      [connId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Conexão não encontrada'
      });
    }

    console.log(`✅ Conexão API ${connId} (${result.rows[0].name}) ativada`);

    res.json({
      success: true,
      message: 'Conexão ativada com sucesso'
    });
  } catch (error) {
    console.error('❌ Erro ao ativar conexão API:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao ativar conexão',
      error: error.message
    });
  }
};

/**
 * POST /api/admin/tenants/:id/connections/api/:connId/desativar
 */
const deactivateApiConnection = async (req, res) => {
  try {
    const { id, connId } = req.params;

    const result = await query(
      'UPDATE whatsapp_accounts SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING name',
      [connId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Conexão não encontrada'
      });
    }

    console.log(`⏸️ Conexão API ${connId} (${result.rows[0].name}) desativada`);

    res.json({
      success: true,
      message: 'Conexão desativada com sucesso'
    });
  } catch (error) {
    console.error('❌ Erro ao desativar conexão API:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao desativar conexão',
      error: error.message
    });
  }
};

/**
 * DELETE /api/admin/tenants/:id/connections/api/:connId
 */
const deleteApiConnection = async (req, res) => {
  try {
    const { connId } = req.params;

    const result = await query(
      'DELETE FROM whatsapp_accounts WHERE id = $1 RETURNING name',
      [connId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Conexão não encontrada'
      });
    }

    console.log(`🗑️ Conexão API ${connId} (${result.rows[0].name}) deletada`);

    res.json({
      success: true,
      message: 'Conexão excluída com sucesso'
    });
  } catch (error) {
    console.error('❌ Erro ao excluir conexão API:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao excluir conexão',
      error: error.message
    });
  }
};

/**
 * POST /api/admin/tenants/:id/connections/qr/:connId/ativar
 */
const activateQrConnection = async (req, res) => {
  try {
    const { connId } = req.params;

    const result = await query(
      'UPDATE uaz_instances SET is_active = true, updated_at = NOW() WHERE id = $1 RETURNING name',
      [connId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Conexão não encontrada'
      });
    }

    console.log(`✅ Conexão QR ${connId} (${result.rows[0].name}) ativada`);

    res.json({
      success: true,
      message: 'Conexão ativada com sucesso'
    });
  } catch (error) {
    console.error('❌ Erro ao ativar conexão QR:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao ativar conexão',
      error: error.message
    });
  }
};

/**
 * POST /api/admin/tenants/:id/connections/qr/:connId/desativar
 */
const deactivateQrConnection = async (req, res) => {
  try {
    const { connId } = req.params;

    const result = await query(
      'UPDATE uaz_instances SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING name',
      [connId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Conexão não encontrada'
      });
    }

    console.log(`⏸️ Conexão QR ${connId} (${result.rows[0].name}) desativada`);

    res.json({
      success: true,
      message: 'Conexão desativada com sucesso'
    });
  } catch (error) {
    console.error('❌ Erro ao desativar conexão QR:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao desativar conexão',
      error: error.message
    });
  }
};

/**
 * DELETE /api/admin/tenants/:id/connections/qr/:connId
 */
const deleteQrConnection = async (req, res) => {
  try {
    const { connId } = req.params;
    const UazService = require('../../services/uazService');
    const { getTenantUazapCredentials } = require('../../helpers/uaz-credentials.helper');

    // Busca a instância com token e proxy
    const instance = await query(
      `SELECT ui.*, p.host, p.port, p.username, p.password
       FROM uaz_instances ui
       LEFT JOIN proxies p ON ui.proxy_id = p.id
       WHERE ui.id = $1`,
      [connId]
    );

    if (instance.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Conexão não encontrada'
      });
    }

    const inst = instance.rows[0];
    
    // Deletar da API UAZ se tiver token
    if (inst.instance_token) {
      console.log(`🗑️ Deletando instância QR ${inst.name} (ID: ${connId}) da API UAZ...`);
      
      // 🔑 BUSCAR CREDENCIAIS DO TENANT
      const credentials = await getTenantUazapCredentials(inst.tenant_id);
      const uazService = new UazService(credentials.serverUrl, credentials.adminToken);
      console.log(`🔑 Usando credencial: "${credentials.credentialName}"`);
      
      const proxyConfig = inst.host ? {
        host: inst.host,
        port: inst.port,
        username: inst.username,
        password: inst.password
      } : null;

      const deleteResult = await uazService.deleteInstance(inst.instance_token, proxyConfig);
      
      if (deleteResult.success) {
        console.log(`   ✅ Instância deletada da API UAZ`);
      } else {
        console.warn(`   ⚠️ Aviso ao deletar da API UAZ: ${deleteResult.error}`);
        console.warn(`   → Continuando com a exclusão do banco de dados...`);
      }
    } else {
      console.log(`   ℹ️ Instância ${inst.name} não possui token, removendo apenas do banco`);
    }

    // Remover referências e deletar do banco
    console.log(`🧹 Removendo referências da instância ${inst.name}...`);
    
    await query('DELETE FROM qr_campaign_templates WHERE instance_id = $1', [connId]);
    await query('UPDATE qr_campaign_messages SET instance_id = NULL WHERE instance_id = $1', [connId]);
    await query('DELETE FROM uaz_instances WHERE id = $1', [connId]);

    console.log(`✅ Conexão QR ${connId} (${inst.name}) excluída completamente`);

    res.json({
      success: true,
      message: 'Conexão excluída com sucesso da plataforma e da API UAZ'
    });
  } catch (error) {
    console.error('❌ Erro ao excluir conexão QR:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao excluir conexão',
      error: error.message
    });
  }
};

/**
 * POST /api/admin/tenants/:id/connections/sync-profile-pictures
 * Sincroniza as fotos de perfil de todas as contas WhatsApp API do tenant
 */
const syncProfilePictures = async (req, res) => {
  try {
    const { id } = req.params;
    const axios = require('axios');

    console.log(`🔄 Sincronizando fotos de perfil do tenant ${id}...`);

    // Buscar todas as contas WhatsApp API (sem filtro de tenant por enquanto)
    const accounts = await query(
      'SELECT id, phone_number_id, access_token, name FROM whatsapp_accounts ORDER BY id'
    );

    console.log(`📊 Encontradas ${accounts.rows.length} contas para sincronizar`);

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    // Processar cada conta
    for (const account of accounts.rows) {
      try {
        console.log(`📸 Buscando foto de perfil da conta ${account.name} (ID: ${account.id})`);
        console.log(`   Phone Number ID: ${account.phone_number_id}`);

        const response = await axios.get(
          `https://graph.facebook.com/v18.0/${account.phone_number_id}/whatsapp_business_profile`,
          {
            params: { fields: 'profile_picture_url,verified_name' },
            headers: { 'Authorization': `Bearer ${account.access_token}` },
            timeout: 15000
          }
        );

        console.log(`   Resposta da API:`, JSON.stringify(response.data, null, 2));

        const profileData = response.data.data?.[0];
        if (profileData) {
          const profilePictureUrl = profileData.profile_picture_url || null;
          const displayName = profileData.verified_name || account.name;

          console.log(`   Profile Picture URL: ${profilePictureUrl}`);
          console.log(`   Display Name: ${displayName}`);

          await query(
            'UPDATE whatsapp_accounts SET profile_picture_url = $1, display_name = $2, updated_at = NOW() WHERE id = $3',
            [profilePictureUrl, displayName, account.id]
          );

          console.log(`✅ Foto e nome de perfil da conta ${account.name} salvos`);
          successCount++;
        } else {
          console.log(`⚠️  Nenhum dado de perfil retornado para ${account.name}`);
          errorCount++;
          errors.push({ account: account.name, error: 'Nenhum dado de perfil retornado' });
        }
      } catch (error) {
        console.error(`❌ Erro ao sincronizar foto da conta ${account.name}:`, error.message);
        if (error.response) {
          console.error(`   Status: ${error.response.status}`);
          console.error(`   Data:`, error.response.data);
        }
        errorCount++;
        errors.push({ account: account.name, error: error.message });
      }
    }

    res.json({
      success: true,
      message: `Sincronização concluída: ${successCount} sucesso(s), ${errorCount} erro(s)`,
      stats: {
        total: accounts.rows.length,
        success: successCount,
        errors: errorCount
      },
      errorDetails: errors
    });
  } catch (error) {
    console.error('❌ Erro ao sincronizar fotos de perfil:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao sincronizar fotos de perfil',
      error: error.message
    });
  }
};

/**
 * PATCH /api/admin/tenants/:id/expiration - Atualizar data de vencimento manualmente
 * Permite que super admin estenda ou altere o vencimento do tenant
 * Desbloqueia automaticamente se a nova data for futura
 */
const updateTenantExpiration = async (req, res) => {
  try {
    const { id } = req.params;
    const { proximo_vencimento } = req.body;

    console.log(`📅 Super Admin alterando vencimento do tenant ${id} para:`, proximo_vencimento);

    // Validar formato da data
    if (!proximo_vencimento) {
      return res.status(400).json({
        success: false,
        message: 'Data de vencimento é obrigatória'
      });
    }

    // IMPORTANTE: Usar a data exatamente como foi digitada, sem conversões de timezone
    // O formato vem como "YYYY-MM-DD" do input type="date"
    // Vamos salvar como string DATE no PostgreSQL para evitar problemas de timezone
    const dataVencimentoStr = proximo_vencimento; // Formato: "2025-11-25"

    // Verificar se tenant existe
    const tenantCheck = await query('SELECT id, nome FROM tenants WHERE id = $1', [id]);
    if (tenantCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tenant não encontrado'
      });
    }

    const tenant = tenantCheck.rows[0];

    // Atualizar data de vencimento usando o tipo DATE do PostgreSQL (sem timezone)
    await query(
      'UPDATE tenants SET proximo_vencimento = $1::date, updated_at = NOW() WHERE id = $2',
      [dataVencimentoStr, id]
    );

    // Verificar se deve desbloquear automaticamente
    // Criar datas locais para comparação (sem timezone)
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    // Parse da data como local (adiciona o horário para evitar conversão UTC)
    const [ano, mes, dia] = dataVencimentoStr.split('-').map(Number);
    const novaDataVencimento = new Date(ano, mes - 1, dia); // mes - 1 porque JavaScript usa 0-11 para meses

    if (novaDataVencimento > hoje) {
      // Data futura - desbloquear tenant automaticamente
      await query(
        'UPDATE tenants SET blocked_at = NULL, status = $1 WHERE id = $2',
        ['active', id]
      );
      
      console.log(`✅ Tenant ${tenant.nome} DESBLOQUEADO automaticamente (vencimento estendido)`);
      
      return res.json({
        success: true,
        message: `Vencimento atualizado e tenant desbloqueado automaticamente`,
        data: {
          tenant_id: id,
          tenant_nome: tenant.nome,
          novo_vencimento: dataVencimentoStr,
          status: 'active',
          desbloqueado: true
        }
      });
    } else {
      // Data passada ou hoje - apenas atualizar, não desbloquear
      console.log(`⚠️ Tenant ${tenant.nome} - Data no passado/hoje, mantém bloqueio`);
      
      return res.json({
        success: true,
        message: `Vencimento atualizado (data passada/hoje - tenant permanece bloqueado)`,
        data: {
          tenant_id: id,
          tenant_nome: tenant.nome,
          novo_vencimento: dataVencimentoStr,
          desbloqueado: false
        }
      });
    }

  } catch (error) {
    console.error('❌ Erro ao atualizar vencimento:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao atualizar vencimento',
      error: error.message
    });
  }
};

/**
 * POST /api/admin/tenants/:id/add-consultas-avulsas - Adicionar consultas avulsas
 */
const addConsultasAvulsas = async (req, res) => {
  try {
    const { id: tenantId } = req.params;
    const { quantidade, motivo } = req.body;

    if (!quantidade || quantidade <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Quantidade deve ser maior que zero'
      });
    }

    console.log(`💰 Adicionando ${quantidade} consultas avulsas ao tenant ${tenantId}...`);

    // Buscar tenant
    const tenantResult = await query('SELECT * FROM tenants WHERE id = $1', [tenantId]);
    
    if (tenantResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tenant não encontrado'
      });
    }

    const tenant = tenantResult.rows[0];
    const saldoAnterior = tenant.consultas_avulsas_saldo || 0;
    const novoSaldo = saldoAnterior + parseInt(quantidade);

    // Atualizar saldo
    await query(`
      UPDATE tenants 
      SET consultas_avulsas_saldo = $1::integer,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2::integer
    `, [novoSaldo, tenantId]);

    console.log(`✅ Consultas avulsas adicionadas: ${saldoAnterior} → ${novoSaldo}`);

    // Preparar metadata para audit_log
    const metadataObj = { 
      quantidade: parseInt(quantidade),
      motivo: motivo || 'Não informado',
      admin_user_id: req.user?.id
    };
    
    console.log('📝 Salvando audit_log com metadata:', metadataObj);
    
    // Registrar no log de auditoria
    await query(`
      INSERT INTO audit_logs (
        tenant_id, user_id, acao, entidade, entidade_id,
        dados_antes, dados_depois, metadata, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    `, [
      tenantId,
      req.user?.id || null,
      'add_consultas_avulsas',
      'tenants',
      tenantId,
      JSON.stringify({ consultas_avulsas_saldo: saldoAnterior }),
      JSON.stringify({ consultas_avulsas_saldo: novoSaldo }),
      JSON.stringify(metadataObj)
    ]);
    
    console.log('✅ Audit_log salvo com sucesso');

    res.json({
      success: true,
      message: `${quantidade} consultas avulsas adicionadas com sucesso`,
      data: {
        tenant_id: tenantId,
        saldo_anterior: saldoAnterior,
        quantidade_adicionada: quantidade,
        novo_saldo: novoSaldo
      }
    });

  } catch (error) {
    console.error('❌ Erro ao adicionar consultas avulsas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao adicionar consultas avulsas',
      error: error.message
    });
  }
};

/**
 * POST /api/admin/tenants/:id/remove-consultas-avulsas - Remover consultas avulsas
 */
const removeConsultasAvulsas = async (req, res) => {
  try {
    const { id: tenantId } = req.params;
    const { quantidade, motivo } = req.body;

    if (!quantidade || quantidade <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Quantidade deve ser maior que zero'
      });
    }

    console.log(`🗑️  Removendo ${quantidade} consultas avulsas do tenant ${tenantId}...`);

    // Buscar tenant
    const tenantResult = await query('SELECT * FROM tenants WHERE id = $1', [tenantId]);
    
    if (tenantResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tenant não encontrado'
      });
    }

    const tenant = tenantResult.rows[0];
    const saldoAnterior = tenant.consultas_avulsas_saldo || 0;
    const novoSaldo = Math.max(0, saldoAnterior - parseInt(quantidade));

    // Atualizar saldo
    await query(`
      UPDATE tenants 
      SET consultas_avulsas_saldo = $1::integer,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2::integer
    `, [novoSaldo, tenantId]);

    console.log(`✅ Consultas avulsas removidas: ${saldoAnterior} → ${novoSaldo}`);

    // Preparar metadata para audit_log
    const metadataObj = { 
      quantidade: parseInt(quantidade),
      motivo: motivo || 'Não informado',
      admin_user_id: req.user?.id
    };
    
    console.log('📝 Salvando audit_log (remoção) com metadata:', metadataObj);
    
    // Registrar no log de auditoria
    await query(`
      INSERT INTO audit_logs (
        tenant_id, user_id, acao, entidade, entidade_id,
        dados_antes, dados_depois, metadata, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    `, [
      tenantId,
      req.user?.id || null,
      'remove_consultas_avulsas',
      'tenants',
      tenantId,
      JSON.stringify({ consultas_avulsas_saldo: saldoAnterior }),
      JSON.stringify({ consultas_avulsas_saldo: novoSaldo }),
      JSON.stringify(metadataObj)
    ]);
    
    console.log('✅ Audit_log (remoção) salvo com sucesso');

    res.json({
      success: true,
      message: `${quantidade} consultas avulsas removidas com sucesso`,
      data: {
        tenant_id: tenantId,
        saldo_anterior: saldoAnterior,
        quantidade_removida: quantidade,
        novo_saldo: novoSaldo
      }
    });

  } catch (error) {
    console.error('❌ Erro ao remover consultas avulsas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao remover consultas avulsas',
      error: error.message
    });
  }
};

/**
 * GET /api/admin/tenants/:id/consultas-avulsas/history
 * Buscar histórico de recargas de consultas avulsas
 */
const getConsultasAvulsasHistory = async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`📜 Buscando histórico de consultas avulsas - Tenant: ${id}`);

    // UNIÃO: Recargas manuais (audit_logs) + Pagamentos via Asaas (payments)
    const result = await query(
      `
      -- Recargas manuais do audit_logs
      SELECT 
        'manual_' || al.id::text as id,
        al.acao as action,
        al.metadata,
        al.dados_antes,
        al.dados_depois,
        al.created_at,
        u.nome as admin_name,
        NULL as payment_id,
        NULL as valor,
        'manual' as source
      FROM audit_logs al
      LEFT JOIN tenant_users u ON al.user_id = u.id
      WHERE al.tenant_id = $1 
        AND (al.acao = 'add_consultas_avulsas' OR al.acao = 'remove_consultas_avulsas')
      
      UNION ALL
      
      -- Pagamentos confirmados via Asaas
      SELECT 
        'payment_' || p.id::text as id,
        'add_consultas_avulsas' as action,
        p.metadata,
        NULL as dados_antes,
        NULL as dados_depois,
        COALESCE(p.paid_at, p.confirmed_at, p.created_at) as created_at,
        'Pagamento Asaas' as admin_name,
        p.asaas_payment_id as payment_id,
        p.valor,
        'asaas' as source
      FROM payments p
      WHERE p.tenant_id = $1 
        AND p.metadata->>'tipo' = 'consultas_avulsas'
        AND (UPPER(p.status) IN ('RECEIVED', 'CONFIRMED') OR p.paid_at IS NOT NULL OR p.confirmed_at IS NOT NULL)
      
      ORDER BY created_at DESC
      LIMIT 100
      `,
      [id]
    );

    // Processar e formatar os resultados
    const formattedHistory = result.rows.map(row => {
      let quantidade = 0;
      let motivo = '';
      
      console.log('🔍 Processando registro:', {
        id: row.id,
        action: row.action,
        source: row.source,
        metadata_raw: row.metadata,
        metadata_type: typeof row.metadata
      });
      
      // Extrair quantidade do metadata
      try {
        if (row.metadata) {
          const meta = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata;
          console.log('📦 Metadata parseado:', meta);
          quantidade = meta.quantidade || meta.quantidade_consultas || 0;
          motivo = meta.motivo || meta.razao || '';
          
          // Para pagamentos Asaas, adicionar informação do valor
          if (row.source === 'asaas' && row.valor) {
            motivo = `Pagamento via PIX - R$ ${parseFloat(row.valor).toFixed(2)}`;
          }
        }
        
        // Se não encontrou no metadata e é recarga manual, calcular pela diferença
        if (!quantidade && row.source === 'manual' && row.dados_depois && row.dados_antes) {
          const dadosDepois = typeof row.dados_depois === 'string' ? JSON.parse(row.dados_depois) : row.dados_depois;
          const dadosAntes = typeof row.dados_antes === 'string' ? JSON.parse(row.dados_antes) : row.dados_antes;
          const saldoDepois = dadosDepois.consultas_avulsas_saldo || 0;
          const saldoAntes = dadosAntes.consultas_avulsas_saldo || 0;
          quantidade = Math.abs(saldoDepois - saldoAntes);
          console.log('🔢 Quantidade calculada pela diferença:', { saldoAntes, saldoDepois, quantidade });
        }
        
        console.log('✅ Resultado final:', { quantidade, motivo, source: row.source });
      } catch (e) {
        console.error('❌ Erro ao processar histórico:', e);
      }
      
      return {
        id: row.id,
        action: row.action,
        created_at: row.created_at,
        admin_name: row.admin_name || 'Sistema',
        source: row.source,
        payment_id: row.payment_id,
        valor: row.source === 'asaas' ? row.valor : null,
        details: {
          quantidade,
          motivo: motivo || (row.source === 'asaas' ? 'Pagamento confirmado' : '-')
        }
      };
    });
    
    console.log(`✅ Total de registros no histórico: ${formattedHistory.length} (incluindo pagamentos Asaas)`);
    
    res.json({
      success: true,
      history: formattedHistory
    });
  } catch (error) {
    console.error('❌ Erro ao buscar histórico de consultas avulsas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar histórico',
      error: error.message
    });
  }
};

/**
 * GET /api/admin/tenants/:id/consultas-avulsas/usage
 * Buscar consultas realizadas com créditos avulsos
 */
const getConsultasAvulsasUsage = async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`💎 Buscando consultas avulsas usadas - Tenant: ${id}`);

    const result = await query(
      `SELECT 
        nc.id,
        nc.documento as cpf,
        nc.tipo_documento as tipo,
        nc.created_at,
        nc.user_identifier,
        COALESCE(tu.nome, nc.user_identifier, 'Sistema') as usuario_nome,
        tu.email as usuario_email
      FROM novavida_consultas nc
      LEFT JOIN tenant_users tu ON (
        tu.tenant_id = nc.tenant_id 
        AND (
          CAST(tu.id AS TEXT) = nc.user_identifier 
          OR tu.email = nc.user_identifier
          OR tu.nome = nc.user_identifier
        )
      )
      WHERE nc.tenant_id = $1 
        AND nc.is_consulta_avulsa = TRUE
      ORDER BY nc.created_at DESC
      LIMIT 1000`,
      [id]
    );

    res.json({
      success: true,
      usage: result.rows
    });
  } catch (error) {
    console.error('❌ Erro ao buscar consultas avulsas usadas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar consultas usadas',
      error: error.message
    });
  }
};

/**
 * GET /api/admin/tenants/:id/consultas-avulsas/report
 * Gerar relatório CSV de consultas avulsas
 */
const getConsultasAvulsasReport = async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`📊 Gerando relatório de consultas avulsas - Tenant: ${id}`);

    // Buscar tenant
    const tenantResult = await query('SELECT nome FROM tenants WHERE id = $1', [id]);
    if (tenantResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tenant não encontrado'
      });
    }
    const tenantNome = tenantResult.rows[0].nome;

    // Buscar histórico de recargas
    const historyResult = await query(
      `SELECT 
        al.acao as action,
        al.metadata,
        al.dados_antes,
        al.dados_depois,
        al.created_at,
        u.nome as admin_name
      FROM audit_logs al
      LEFT JOIN tenant_users u ON al.user_id = u.id
      WHERE al.tenant_id = $1 
        AND (al.acao = 'add_consultas_avulsas' OR al.acao = 'remove_consultas_avulsas')
      ORDER BY al.created_at DESC`,
      [id]
    );

    // Buscar consultas usadas com tentativa de JOIN com tenant_users
    const usageResult = await query(
      `SELECT 
        nc.documento as cpf,
        nc.tipo_documento as tipo,
        nc.created_at,
        nc.user_identifier,
        COALESCE(tu.nome, nc.user_identifier, 'Sistema') as usuario_nome,
        tu.email as usuario_email
      FROM novavida_consultas nc
      LEFT JOIN tenant_users tu ON (
        tu.tenant_id = nc.tenant_id 
        AND (
          CAST(tu.id AS TEXT) = nc.user_identifier 
          OR tu.email = nc.user_identifier
          OR tu.nome = nc.user_identifier
        )
      )
      WHERE nc.tenant_id = $1 
        AND nc.is_consulta_avulsa = TRUE
      ORDER BY nc.created_at DESC`,
      [id]
    );

    // Gerar CSV bem organizado em colunas
    let csv = '\uFEFF'; // BOM para UTF-8
    
    // LINHA 1: Título do Relatório
    csv += `RELATÓRIO DE CONSULTAS AVULSAS - ${tenantNome};;;;\n`;
    
    // LINHA 2: Data de Geração
    csv += `Gerado em: ${new Date().toLocaleString('pt-BR')};;;;\n`;
    
    // LINHA 3: Linha em branco
    csv += ';;;;\n';
    
    // LINHA 4: Título da Seção
    csv += 'HISTÓRICO DE RECARGAS;;;;\n';
    
    // LINHA 5: Cabeçalhos das colunas
    csv += 'Data/Hora;Ação;Quantidade;Motivo;Administrador\n';
    
    // LINHAS 6+: Dados do histórico
    if (historyResult.rows.length === 0) {
      csv += 'Nenhuma recarga registrada até o momento;;;;\n';
    } else {
      historyResult.rows.forEach(row => {
        const acao = row.action === 'add_consultas_avulsas' ? 'Adicionou' : 'Removeu';
        
        // Extrair quantidade e motivo
        let quantidade = '0';
        let motivo = '-';
        
        try {
          if (row.metadata) {
            const meta = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata;
            quantidade = String(meta.quantidade || 0);
            motivo = meta.motivo || meta.razao || '-';
          }
          
          if (quantidade === '0' && row.dados_depois && row.dados_antes) {
            const dadosDepois = typeof row.dados_depois === 'string' ? JSON.parse(row.dados_depois) : row.dados_depois;
            const dadosAntes = typeof row.dados_antes === 'string' ? JSON.parse(row.dados_antes) : row.dados_antes;
            quantidade = String(Math.abs((dadosDepois.consultas_avulsas_saldo || 0) - (dadosAntes.consultas_avulsas_saldo || 0)));
          }
        } catch (e) {
          console.error('Erro ao processar histórico para CSV:', e);
        }
        
        motivo = motivo.replace(/;/g, ',').replace(/\n/g, ' ').trim();
        const admin = (row.admin_name || 'Super Admin').replace(/;/g, ',').trim();
        const data = new Date(row.created_at).toLocaleString('pt-BR', { 
          day: '2-digit', 
          month: '2-digit', 
          year: 'numeric', 
          hour: '2-digit', 
          minute: '2-digit' 
        });
        
        csv += `${data};${acao};${quantidade};${motivo};${admin}\n`;
      });
    }

    // Linha em branco entre seções
    csv += ';;;;\n';
    
    // Seção: CONSULTAS REALIZADAS
    csv += 'CONSULTAS REALIZADAS (CRÉDITOS AVULSOS);;;;\n';
    csv += 'Data/Hora;Tipo;CPF/CNPJ;Usuário;Email\n';
    
    if (usageResult.rows.length === 0) {
      csv += 'Nenhuma consulta avulsa utilizada até o momento;;;;\n';
    } else {
      usageResult.rows.forEach(row => {
        const data = new Date(row.created_at).toLocaleString('pt-BR', { 
          day: '2-digit', 
          month: '2-digit', 
          year: 'numeric', 
          hour: '2-digit', 
          minute: '2-digit',
          second: '2-digit'
        });
        const tipo = (row.tipo || 'CPF').toUpperCase();
        const documento = row.cpf || '-';
        const usuario = (row.usuario_nome || 'Sistema').replace(/;/g, ',').trim();
        const email = (row.usuario_email || '-').replace(/;/g, ',').trim();
        
        csv += `${data};${tipo};${documento};${usuario};${email}\n`;
      });
      
      // Linha em branco
      csv += ';;;;\n';
      
      // Total
      csv += `TOTAL DE CONSULTAS;${usageResult.rows.length};;;\n`;
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=consultas-avulsas-${tenantNome}-${Date.now()}.csv`);
    res.send(csv);
  } catch (error) {
    console.error('❌ Erro ao gerar relatório:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao gerar relatório',
      error: error.message
    });
  }
};

module.exports = {
  createTenant,
  getAllTenants,
  getTenantById,
  getTenantStats,
  updateTenant,
  updateTenantStatus,
  updateTenantExpiration,
  deleteTenant,
  getTenantUsers,
  createTenantUser,
  updateTenantUser,
  deleteTenantUser,
  getTenantLogs,
  deleteAllTenantLogs,
  getTenantPayments,
  syncTenantPayments,
  markPaymentAsPaid,
  cancelPayment,
  cancelMultiplePayments,
  getTenantConnections,
  activateApiConnection,
  deactivateApiConnection,
  deleteApiConnection,
  activateQrConnection,
  deactivateQrConnection,
  deleteQrConnection,
  syncProfilePictures,
  addConsultasAvulsas,
  removeConsultasAvulsas,
  getConsultasAvulsasHistory,
  getConsultasAvulsasUsage,
  getConsultasAvulsasReport
};
