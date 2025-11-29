const { query } = require('../../database/connection');

/**
 * Controller para administração da Landing Page
 * Endpoints para super admin gerenciar estatísticas e leads
 */

/**
 * GET /api/admin/landing/leads
 * Retorna estatísticas e leads da landing page
 */
exports.getLeadsAndStats = async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    // Criar tabela se não existir
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

    // Buscar total de leads
    const leadsCountQuery = await query(`
      SELECT COUNT(*) as total
      FROM landing_leads
    `);

    // Buscar total de contas trial ATIVAS (ainda em período de teste)
    let trialsCount = 0;
    let conversionsCount = 0;
    
    try {
      const trialsCountQuery = await query(`
        SELECT COUNT(*) as total
        FROM tenants
        WHERE status = 'trial'
          AND (origem_cadastro = 'landing_page' OR origem_cadastro = 'registration_page')
      `);
      trialsCount = parseInt(trialsCountQuery.rows[0]?.total || 0);
      console.log('✅ Contas trial encontradas:', trialsCount);
    } catch (err) {
      console.log('⚠️ Tabela tenants pode não existir:', err.message);
    }

    // Buscar total de conversões (trials que viraram pagantes)
    // São tenants que tinham trial (trial_ends_at não nulo) e agora estão active
    try {
      const conversionsCountQuery = await query(`
        SELECT COUNT(*) as total
        FROM tenants
        WHERE status = 'active'
          AND trial_ends_at IS NOT NULL
          AND (origem_cadastro = 'landing_page' OR origem_cadastro = 'registration_page')
      `);
      conversionsCount = parseInt(conversionsCountQuery.rows[0]?.total || 0);
      console.log('✅ Conversões encontradas:', conversionsCount);
    } catch (err) {
      console.log('⚠️ Erro ao buscar conversões:', err.message);
    }

    // Buscar leads recentes
    const recentLeadsQuery = await query(`
      SELECT 
        id, nome, email, telefone, empresa, mensagem, created_at
      FROM landing_leads
      ORDER BY created_at DESC
      LIMIT $1
    `, [parseInt(limit)]);

    res.json({
      success: true,
      total: parseInt(leadsCountQuery.rows[0]?.total || 0),
      trials: trialsCount,
      conversions: conversionsCount,
      recent: recentLeadsQuery.rows
    });
  } catch (error) {
    console.error('❌ Erro ao buscar leads e estatísticas:', error);
    
    // Sempre retornar dados vazios em caso de erro (não quebrar a interface)
    res.json({
      success: true,
      total: 0,
      trials: 0,
      conversions: 0,
      recent: []
    });
  }
};

/**
 * GET /api/admin/landing/stats
 * Retorna estatísticas detalhadas da landing page
 */
exports.getDetailedStats = async (req, res) => {
  try {
    // Estatísticas por dia (últimos 30 dias)
    const dailyStatsQuery = await query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as total_leads
      FROM landing_leads
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);

    // Leads por origem
    const leadsByOriginQuery = await query(`
      SELECT 
        origem,
        COUNT(*) as total
      FROM landing_leads
      GROUP BY origem
      ORDER BY total DESC
    `);

    // Taxa de conversão por período
    const conversionRateQuery = await query(`
      WITH trials AS (
        SELECT COUNT(*) as total
        FROM tenants
        WHERE status = 'trial'
          AND created_at >= NOW() - INTERVAL '30 days'
      ),
      conversions AS (
        SELECT COUNT(*) as total
        FROM tenants
        WHERE status = 'active'
          AND trial_ends_at IS NOT NULL
          AND created_at >= NOW() - INTERVAL '30 days'
      )
      SELECT 
        trials.total as trials,
        conversions.total as conversions,
        CASE 
          WHEN trials.total > 0 
          THEN ROUND((conversions.total::numeric / trials.total::numeric) * 100, 2)
          ELSE 0
        END as conversion_rate
      FROM trials, conversions
    `);

    res.json({
      success: true,
      data: {
        daily_stats: dailyStatsQuery.rows,
        leads_by_origin: leadsByOriginQuery.rows,
        conversion_rate: conversionRateQuery.rows[0] || { trials: 0, conversions: 0, conversion_rate: 0 }
      }
    });
  } catch (error) {
    console.error('❌ Erro ao buscar estatísticas detalhadas:', error);
    
    if (error.message.includes('does not exist')) {
      return res.json({
        success: true,
        data: {
          daily_stats: [],
          leads_by_origin: [],
          conversion_rate: { trials: 0, conversions: 0, conversion_rate: 0 }
        }
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erro ao carregar estatísticas detalhadas',
      error: error.message
    });
  }
};

/**
 * DELETE /api/admin/landing/leads/:id
 * Remove um lead
 */
exports.deleteLead = async (req, res) => {
  try {
    const { id } = req.params;

    await query('DELETE FROM landing_leads WHERE id = $1', [id]);

    res.json({
      success: true,
      message: 'Lead removido com sucesso'
    });
  } catch (error) {
    console.error('❌ Erro ao remover lead:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao remover lead',
      error: error.message
    });
  }
};

/**
 * GET /api/admin/landing/export
 * Exporta todos os leads em CSV
 */
exports.exportLeads = async (req, res) => {
  try {
    const leadsQuery = await query(`
      SELECT 
        id, nome, email, telefone, empresa, mensagem, origem,
        TO_CHAR(created_at, 'DD/MM/YYYY HH24:MI:SS') as data_cadastro
      FROM landing_leads
      ORDER BY created_at DESC
    `);

    const leads = leadsQuery.rows;

    // Criar CSV
    let csv = 'ID,Nome,Email,Telefone,Empresa,Mensagem,Origem,Data Cadastro\n';
    
    leads.forEach(lead => {
      csv += `${lead.id},"${lead.nome}","${lead.email}","${lead.telefone || ''}","${lead.empresa || ''}","${lead.mensagem || ''}","${lead.origem}","${lead.data_cadastro}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=leads-landing-page.csv');
    res.send('\uFEFF' + csv); // BOM para UTF-8
  } catch (error) {
    console.error('❌ Erro ao exportar leads:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao exportar leads',
      error: error.message
    });
  }
};

