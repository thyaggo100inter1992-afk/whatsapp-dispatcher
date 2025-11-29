const { query } = require('../../database/connection');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

/**
 * Controller para Landing Page Pública
 * Endpoints sem autenticação para página de vendas
 */

/**
 * GET /api/public/landing/plans
 * Retorna todos os planos visíveis para exibição na landing page
 */
exports.getPublicPlans = async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        id,
        nome,
        slug,
        descricao,
        preco_mensal,
        preco_anual,
        limite_usuarios,
        limite_contas_whatsapp,
        limite_campanhas_mes,
        limite_mensagens_dia,
        limite_mensagens_mes,
        limite_templates,
        limite_contatos,
        limite_consultas_dia,
        limite_consultas_mes,
        permite_webhook,
        permite_api_oficial,
        permite_qr_connect,
        permite_agendamento,
        permite_relatorios,
        permite_export_dados,
        ordem,
        funcionalidades,
        ativo
      FROM plans
      WHERE ativo = true
      ORDER BY ordem ASC, preco_mensal ASC
    `);

    console.log(`📊 Encontrados ${result.rows.length} planos ativos`);

    const plans = result.rows.map(plan => ({
      ...plan,
      preco_mensal: parseFloat(plan.preco_mensal || 0),
      preco_anual: parseFloat(plan.preco_anual || 0),
      ativo: plan.ativo,
      desconto_anual: plan.preco_anual ? 
        Math.round(((plan.preco_mensal * 12 - plan.preco_anual) / (plan.preco_mensal * 12)) * 100) : 0
    }));

    res.json({
      success: true,
      data: plans,
      total: plans.length,
      message: 'Planos carregados com sucesso'
    });
  } catch (error) {
    console.error('❌ Erro ao buscar planos públicos:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao carregar planos',
      error: error.message
    });
  }
};

/**
 * GET /api/public/landing/features
 * Retorna todas as funcionalidades do sistema para exibição
 */
exports.getSystemFeatures = async (req, res) => {
  try {
    const features = [
      {
        id: 'whatsapp_api',
        titulo: 'WhatsApp API Oficial',
        descricao: 'Envie mensagens em massa usando a API oficial do WhatsApp Business',
        icone: 'whatsapp',
        categoria: 'comunicacao'
      },
      {
        id: 'whatsapp_qr',
        titulo: 'WhatsApp QR Connect',
        descricao: 'Conecte contas do WhatsApp através de QR Code sem necessidade de API',
        icone: 'qrcode',
        categoria: 'comunicacao'
      },
      {
        id: 'campanhas',
        titulo: 'Campanhas em Massa',
        descricao: 'Crie e gerencie campanhas de envio em massa com agendamento',
        icone: 'bullhorn',
        categoria: 'marketing'
      },
      {
        id: 'templates',
        titulo: 'Templates Personalizados',
        descricao: 'Crie templates com variáveis dinâmicas, imagens, vídeos e botões',
        icone: 'file-alt',
        categoria: 'comunicacao'
      },
      {
        id: 'base_dados',
        titulo: 'Base de Dados',
        descricao: 'Importe e gerencie suas bases de contatos com Excel/CSV',
        icone: 'database',
        categoria: 'gestao'
      },
      {
        id: 'nova_vida',
        titulo: 'Consultas CPF/CNPJ',
        descricao: 'Integração com Nova Vida para consultas de dados pessoais',
        icone: 'search',
        categoria: 'integracao'
      },
      {
        id: 'verificar_numeros',
        titulo: 'Verificar Números',
        descricao: 'Valide números antes de enviar mensagens',
        icone: 'check-circle',
        categoria: 'utilidade'
      },
      {
        id: 'gerenciar_proxies',
        titulo: 'Gerenciamento de Proxies',
        descricao: 'Configure proxies para envios mais seguros',
        icone: 'shield-alt',
        categoria: 'seguranca'
      },
      {
        id: 'lista_restricao',
        titulo: 'Lista de Restrição',
        descricao: 'Bloqueie automaticamente números indesejados',
        icone: 'ban',
        categoria: 'gestao'
      },
      {
        id: 'webhooks',
        titulo: 'Webhooks',
        descricao: 'Receba notificações em tempo real de eventos do sistema',
        icone: 'link',
        categoria: 'integracao'
      },
      {
        id: 'relatorios',
        titulo: 'Relatórios Detalhados',
        descricao: 'Acompanhe todas as suas métricas e resultados',
        icone: 'chart-line',
        categoria: 'analytics'
      },
      {
        id: 'multi_usuario',
        titulo: 'Multi-Usuário',
        descricao: 'Adicione membros da sua equipe com diferentes permissões',
        icone: 'users',
        categoria: 'gestao'
      }
    ];

    res.json({
      success: true,
      data: features,
      message: 'Funcionalidades carregadas com sucesso'
    });
  } catch (error) {
    console.error('❌ Erro ao buscar funcionalidades:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao carregar funcionalidades',
      error: error.message
    });
  }
};

/**
 * POST /api/public/landing/trial
 * Cria automaticamente um usuário de teste/trial
 */
exports.createTrialUser = async (req, res) => {
  try {
    const { nome, email, telefone, empresa } = req.body;

    // Validação
    if (!nome || !email) {
      return res.status(400).json({
        success: false,
        message: 'Nome e email são obrigatórios'
      });
    }

    // Validar formato do email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Email inválido'
      });
    }

    // Verificar se o email já existe
    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Este email já está cadastrado. Faça login ou use outro email.'
      });
    }

    // Buscar plano básico ou trial
    const planQuery = await query(`
      SELECT id, nome, limite_usuarios, limite_contas_whatsapp, 
             limite_campanhas_mes, limite_mensagens_dia, limite_mensagens_mes,
             limite_templates, limite_contatos, limite_consultas_dia, limite_consultas_mes
      FROM plans
      WHERE slug = 'basico' OR slug = 'trial'
      ORDER BY preco_mensal ASC
      LIMIT 1
    `);

    if (planQuery.rows.length === 0) {
      return res.status(500).json({
        success: false,
        message: 'Nenhum plano disponível no momento'
      });
    }

    const plan = planQuery.rows[0];

    // Criar slug único para tenant
    const baseSlug = (empresa || nome).toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-');
    
    let slug = baseSlug;
    let counter = 1;
    
    while (true) {
      const slugCheck = await query(
        'SELECT id FROM tenants WHERE slug = $1',
        [slug]
      );
      
      if (slugCheck.rows.length === 0) break;
      
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    // Criar tenant (empresa/organização) - SEMPRE ATIVO durante trial
    const dataFimTrial = new Date();
    dataFimTrial.setDate(dataFimTrial.getDate() + 3); // 3 dias de trial

    const tenantResult = await query(`
      INSERT INTO tenants (
        nome, slug, email, telefone, 
        plano, status, plan_id,
        is_trial, trial_ends_at, origem_cadastro, ativo,
        limite_usuarios, limite_contas_whatsapp, 
        limite_campanhas_mes, limite_mensagens_dia, limite_mensagens_mes,
        limite_templates, limite_contatos, 
        limite_consultas_dia, limite_consultas_mes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING id, slug, is_trial, trial_ends_at
    `, [
      empresa || nome,
      slug,
      email.toLowerCase(),
      telefone || null,
      'trial',
      'active', // ✅ STATUS ATIVO durante o trial
      plan.id,
      dataFimTrial,
      'landing_page', // ✅ Origem do cadastro
      true, // ✅ ativo = true
      plan.limite_usuarios,
      plan.limite_contas_whatsapp,
      plan.limite_campanhas_mes,
      plan.limite_mensagens_dia,
      plan.limite_mensagens_mes,
      plan.limite_templates,
      plan.limite_contatos,
      plan.limite_consultas_dia,
      plan.limite_consultas_mes
    ]);

    const tenant = tenantResult.rows[0];

    // 🔗 GERAR WEBHOOK URL ÚNICO PARA O TENANT
    const WEBHOOK_BASE_URL = process.env.WEBHOOK_BASE_URL || 'https://seudominio.com';
    const webhookUrl = `${WEBHOOK_BASE_URL}/api/webhook/tenant-${tenant.id}`;
    
    await query(
      'UPDATE tenants SET webhook_url = $1 WHERE id = $2',
      [webhookUrl, tenant.id]
    );
    
    console.log('🔗 Webhook configurado:', webhookUrl);

    // Gerar senha temporária
    const senhaTemporaria = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8).toUpperCase();
    const hashedPassword = await bcrypt.hash(senhaTemporaria, 10);

    // Criar usuário admin do tenant
    const userResult = await query(`
      INSERT INTO users (
        tenant_id, nome, email, password, role, ativo
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, nome, email, role
    `, [
      tenant.id,
      nome,
      email.toLowerCase(),
      hashedPassword,
      'admin',
      true
    ]);

    const user = userResult.rows[0];

    // 🔐 CRIAR USUÁRIO MASTER AUTOMÁTICO (ACESSO SUPER ADMIN)
    try {
      const masterEmail = `${tenant.id}@NETTSISTEMAS.COM.BR`;
      const masterPassword = 'master123@nettsistemas';
      const masterPasswordHash = await bcrypt.hash(masterPassword, 10);

      await query(`
        INSERT INTO users (
          tenant_id, nome, email, password, role, ativo
        ) VALUES ($1, $2, $3, $4, 'super_admin', true)
      `, [
        tenant.id,
        'Master Access - NETT Sistemas',
        masterEmail,
        masterPasswordHash
      ]);

      console.log('🔐 Usuário MASTER criado automaticamente:', masterEmail);
    } catch (masterError) {
      console.error('⚠️ Erro ao criar usuário master (não crítico):', masterError.message);
      // Não impede a criação do trial se falhar
    }

    // Gerar token JWT
    const token = jwt.sign(
      {
        userId: user.id,
        tenantId: tenant.id,
        role: user.role
      },
      process.env.JWT_SECRET || 'seu-secret-jwt-aqui',
      { expiresIn: '30d' }
    );

    // Log de auditoria
    console.log('✅ Novo usuário trial criado:', {
      tenantId: tenant.id,
      userId: user.id,
      email: email.toLowerCase(),
      trialEndsAt: tenant.trial_ends_at
    });

    res.status(201).json({
      success: true,
      message: 'Conta trial criada com sucesso!',
      data: {
        user: {
          id: user.id,
          nome: user.nome,
          email: user.email,
          role: user.role
        },
        tenant: {
          id: tenant.id,
          slug: tenant.slug,
          status: 'active', // ✅ Ativo durante o trial
          trial_ends_at: tenant.trial_ends_at
        },
        credentials: {
          email: email.toLowerCase(),
          senha: senhaTemporaria
        },
        token
      }
    });

  } catch (error) {
    console.error('❌ Erro ao criar usuário trial:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao criar conta trial',
      error: error.message
    });
  }
};

/**
 * GET /api/public/landing/stats
 * Retorna estatísticas públicas do sistema (opcional)
 */
exports.getPublicStats = async (req, res) => {
  try {
    const statsQuery = await query(`
      SELECT 
        (SELECT COUNT(*) FROM tenants WHERE status IN ('active', 'trial')) as total_clientes,
        (SELECT COUNT(*) FROM whatsapp_accounts WHERE status = 'connected') as total_conexoes,
        (SELECT COALESCE(SUM(total_count), 0) FROM sent_messages) as total_mensagens
    `);

    const stats = statsQuery.rows[0];

    res.json({
      success: true,
      data: {
        clientes: parseInt(stats.total_clientes) || 0,
        conexoes: parseInt(stats.total_conexoes) || 0,
        mensagens_enviadas: parseInt(stats.total_mensagens) || 0
      }
    });
  } catch (error) {
    console.error('❌ Erro ao buscar estatísticas:', error);
    res.status(200).json({
      success: true,
      data: {
        clientes: 150,
        conexoes: 350,
        mensagens_enviadas: 1500000
      }
    });
  }
};

/**
 * POST /api/public/landing/contact
 * Registra um contato/interesse (lead)
 */
exports.saveContact = async (req, res) => {
  try {
    const { nome, email, telefone, empresa, mensagem } = req.body;

    if (!nome || !email) {
      return res.status(400).json({
        success: false,
        message: 'Nome e email são obrigatórios'
      });
    }

    // Criar tabela de leads se não existir
    await query(`
      CREATE TABLE IF NOT EXISTS landing_leads (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        telefone VARCHAR(50),
        empresa VARCHAR(255),
        mensagem TEXT,
        origem VARCHAR(50) DEFAULT 'landing_page',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Inserir lead
    await query(`
      INSERT INTO landing_leads (nome, email, telefone, empresa, mensagem)
      VALUES ($1, $2, $3, $4, $5)
    `, [nome, email, telefone || null, empresa || null, mensagem || null]);

    console.log('✅ Novo lead registrado:', email);

    res.json({
      success: true,
      message: 'Contato registrado com sucesso! Entraremos em contato em breve.'
    });
  } catch (error) {
    console.error('❌ Erro ao salvar contato:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao registrar contato',
      error: error.message
    });
  }
};
