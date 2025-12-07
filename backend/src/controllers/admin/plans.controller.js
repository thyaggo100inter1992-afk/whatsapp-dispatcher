const { query } = require('../../database/connection');

/**
 * Controller para Gerenciamento de Planos (Super Admin)
 */

/**
 * GET /api/admin/plans/stats - Estatísticas do sistema
 */
const getSystemStats = async (req, res) => {
  try {
    console.log('📊 Buscando estatísticas do sistema...');

    // Total de tenants
    const tenantsResult = await query('SELECT COUNT(*) as total FROM tenants');
    const totalTenants = parseInt(tenantsResult.rows[0].total);

    // Total de usuários
    const usersResult = await query('SELECT COUNT(*) as total FROM tenant_users');
    const totalUsers = parseInt(usersResult.rows[0].total);

    // Total de contas WhatsApp (API Oficial + QR Connect)
    const accountsApiResult = await query('SELECT COUNT(*) as total FROM whatsapp_accounts');
    const accountsQrResult = await query('SELECT COUNT(*) as total FROM uaz_instances');
    const totalAccounts = parseInt(accountsApiResult.rows[0].total) + parseInt(accountsQrResult.rows[0].total);

    // Distribuição de planos
    const plansDistResult = await query(`
      SELECT 
        COALESCE(p.nome, 'Sem Plano') as plan_name,
        COUNT(t.id) as count
      FROM tenants t
      LEFT JOIN plans p ON t.plan_id = p.id
      GROUP BY p.nome
      ORDER BY count DESC
    `);

    console.log('✅ Estatísticas carregadas com sucesso');

    res.json({
      success: true,
      data: {
        totalTenants,
        totalUsers,
        totalAccounts,
        plansDistribution: plansDistResult.rows
      }
    });
  } catch (error) {
    console.error('❌ Erro ao buscar estatísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar estatísticas do sistema',
      error: error.message
    });
  }
};

/**
 * GET /api/admin/plans - Listar todos os planos
 */
const getAllPlans = async (req, res) => {
  try {
    console.log('📋 Listando todos os planos...');

    const result = await query(`
      SELECT 
        p.*,
        COUNT(DISTINCT t.id) as tenants_count
      FROM plans p
      LEFT JOIN tenants t ON t.plan_id = p.id
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `);

    console.log(`✅ ${result.rows.length} planos encontrados`);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('❌ Erro ao listar planos:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao listar planos',
      error: error.message
    });
  }
};

/**
 * GET /api/admin/plans/:id - Obter plano por ID
 */
const getPlanById = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🔍 Buscando plano ID: ${id}`);

    const result = await query('SELECT * FROM plans WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Plano não encontrado'
      });
    }

    console.log(`✅ Plano encontrado: ${result.rows[0].nome}`);

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Erro ao buscar plano:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar plano',
      error: error.message
    });
  }
};

/**
 * POST /api/admin/plans - Criar novo plano
 */
const createPlan = async (req, res) => {
  try {
    const {
      nome,
      descricao,
      preco_mensal,
      max_users,
      max_whatsapp_accounts,
      max_campaigns_per_month,
      max_messages_per_day,
      max_nova_vida_queries,
      features
    } = req.body;

    console.log(`📝 Criando novo plano: ${nome}`);

    const result = await query(`
      INSERT INTO plans (
        nome, descricao, preco_mensal, max_users, max_whatsapp_accounts,
        max_campaigns_per_month, max_messages_per_day, max_nova_vida_queries, features
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      nome,
      descricao,
      preco_mensal || 0,
      max_users || null,
      max_whatsapp_accounts || null,
      max_campaigns_per_month || null,
      max_messages_per_day || null,
      max_nova_vida_queries || null,
      JSON.stringify(features || {})
    ]);

    console.log(`✅ Plano criado com sucesso: ${result.rows[0].nome}`);

    res.status(201).json({
      success: true,
      message: 'Plano criado com sucesso',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Erro ao criar plano:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao criar plano',
      error: error.message
    });
  }
};

/**
 * PUT /api/admin/plans/:id - Atualizar plano
 */
const updatePlan = async (req, res) => {
  try {
    const { id } = req.params;
    const {
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
      ativo,
      visivel,
      ordem,
      funcionalidades,
      permite_chat_atendimento
    } = req.body;

    console.log(`📝 Atualizando plano ID: ${id}`);
    console.log(`📊 Dados recebidos:`, { nome, slug, limite_usuarios, limite_contas_whatsapp });

    const result = await query(`
      UPDATE plans SET
        nome = COALESCE($1, nome),
        slug = COALESCE($2, slug),
        descricao = COALESCE($3, descricao),
        preco_mensal = COALESCE($4, preco_mensal),
        preco_anual = COALESCE($5, preco_anual),
        limite_usuarios = COALESCE($6, limite_usuarios),
        limite_contas_whatsapp = COALESCE($7, limite_contas_whatsapp),
        limite_campanhas_mes = COALESCE($8, limite_campanhas_mes),
        limite_mensagens_dia = COALESCE($9, limite_mensagens_dia),
        limite_mensagens_mes = COALESCE($10, limite_mensagens_mes),
        limite_templates = COALESCE($11, limite_templates),
        limite_contatos = COALESCE($12, limite_contatos),
        limite_consultas_dia = COALESCE($13, limite_consultas_dia),
        limite_consultas_mes = COALESCE($14, limite_consultas_mes),
        ativo = COALESCE($15, ativo),
        visivel = COALESCE($16, visivel),
        ordem = COALESCE($17, ordem),
        funcionalidades = COALESCE($18, funcionalidades),
        permite_chat_atendimento = COALESCE($19, permite_chat_atendimento),
        updated_at = NOW()
      WHERE id = $20
      RETURNING *
    `, [
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
      ativo,
      visivel,
      ordem,
      funcionalidades ? JSON.stringify(funcionalidades) : null,
      permite_chat_atendimento,
      id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Plano não encontrado'
      });
    }

    console.log(`✅ Plano atualizado: ${result.rows[0].nome}`);

    res.json({
      success: true,
      message: 'Plano atualizado com sucesso',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Erro ao atualizar plano:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar plano',
      error: error.message
    });
  }
};

/**
 * DELETE /api/admin/plans/:id - Deletar plano
 */
const deletePlan = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🗑️ Deletando plano ID: ${id}`);

    // Verificar se há tenants usando este plano
    const tenantsResult = await query(
      'SELECT COUNT(*) as count FROM tenants WHERE plan_id = $1',
      [id]
    );

    if (parseInt(tenantsResult.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        message: 'Não é possível deletar este plano pois há tenants vinculados a ele'
      });
    }

    const result = await query('DELETE FROM plans WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Plano não encontrado'
      });
    }

    console.log(`✅ Plano deletado: ${result.rows[0].nome}`);

    res.json({
      success: true,
      message: 'Plano deletado com sucesso'
    });
  } catch (error) {
    console.error('❌ Erro ao deletar plano:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao deletar plano',
      error: error.message
    });
  }
};

module.exports = {
  getSystemStats,
  getAllPlans,
  getPlanById,
  createPlan,
  updatePlan,
  deletePlan
};
