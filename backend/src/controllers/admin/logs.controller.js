const { query } = require('../../database/connection');

/**
 * Controller para Logs e Auditoria (Super Admin)
 */

/**
 * GET /api/admin/logs
 * Listar todos os logs de auditoria
 */
const getAllLogs = async (req, res) => {
  try {
    const { limit = 100, offset = 0, tenant_id, user_id, acao, sucesso } = req.query;

    console.log('📋 Listando logs de auditoria...');

    let whereConditions = [];
    let params = [];
    let paramCount = 1;

    if (tenant_id) {
      whereConditions.push(`al.tenant_id = $${paramCount}`);
      params.push(tenant_id);
      paramCount++;
    }

    if (user_id) {
      whereConditions.push(`al.user_id = $${paramCount}`);
      params.push(user_id);
      paramCount++;
    }

    if (acao) {
      whereConditions.push(`al.acao = $${paramCount}`);
      params.push(acao);
      paramCount++;
    }

    if (sucesso !== undefined && sucesso !== '') {
      whereConditions.push(`al.sucesso = $${paramCount}`);
      params.push(sucesso === 'true');
      paramCount++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const result = await query(`
      SELECT 
        al.id,
        al.tenant_id,
        al.user_id,
        al.acao,
        al.entidade,
        al.entidade_id,
        al.dados_antes,
        al.dados_depois,
        al.ip_address,
        al.user_agent,
        al.metodo_http,
        al.url_path,
        al.sucesso,
        al.erro_mensagem,
        al.created_at,
        t.nome as tenant_nome,
        u.nome as user_nome,
        u.email as user_email
      FROM audit_logs al
      LEFT JOIN tenants t ON al.tenant_id = t.id
      LEFT JOIN tenant_users u ON al.user_id = u.id
      ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `, [...params, limit, offset]);

    // Total de registros
    const countResult = await query(`
      SELECT COUNT(*) as total FROM audit_logs al ${whereClause}
    `, params);

    console.log(`✅ ${result.rows.length} logs encontrados`);

    res.json({
      success: true,
      data: {
        logs: result.rows,
        total: parseInt(countResult.rows[0].total),
        limit: parseInt(limit),
        offset: parseInt(offset)
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
 * GET /api/admin/logs/stats
 * Estatísticas de logs
 */
const getLogsStats = async (req, res) => {
  try {
    console.log('📊 Buscando estatísticas de logs...');

    // Total de logs
    const totalResult = await query('SELECT COUNT(*) as total FROM audit_logs');
    const totalLogs = parseInt(totalResult.rows[0].total);

    // Logs por tipo de ação
    const acoesStat = await query(`
      SELECT acao, COUNT(*) as count
      FROM audit_logs
      GROUP BY acao
      ORDER BY count DESC
      LIMIT 10
    `);

    // Logs com sucesso vs erro
    const successResult = await query(`
      SELECT 
        COUNT(CASE WHEN sucesso = true THEN 1 END) as sucesso,
        COUNT(CASE WHEN sucesso = false THEN 1 END) as erro
      FROM audit_logs
    `);

    // Logs por tenant (top 10)
    const tenantStats = await query(`
      SELECT 
        t.nome,
        COUNT(al.id) as count
      FROM audit_logs al
      LEFT JOIN tenants t ON al.tenant_id = t.id
      WHERE t.nome IS NOT NULL
      GROUP BY t.nome
      ORDER BY count DESC
      LIMIT 10
    `);

    // Logs das últimas 24h
    const last24hResult = await query(`
      SELECT COUNT(*) as count
      FROM audit_logs
      WHERE created_at >= NOW() - INTERVAL '24 hours'
    `);

    console.log('✅ Estatísticas carregadas');

    res.json({
      success: true,
      data: {
        totalLogs,
        last24h: parseInt(last24hResult.rows[0].count),
        successCount: parseInt(successResult.rows[0].sucesso || 0),
        errorCount: parseInt(successResult.rows[0].erro || 0),
        topActions: acoesStat.rows,
        topTenants: tenantStats.rows
      }
    });
  } catch (error) {
    console.error('❌ Erro ao buscar estatísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar estatísticas de logs',
      error: error.message
    });
  }
};

/**
 * DELETE /api/admin/logs/bulk?period={24h|7d|30d|all}
 * Deletar logs por período
 */
const deleteLogs = async (req, res) => {
  try {
    const { period } = req.query;
    
    console.log(`🗑️ Deletando logs do período: ${period}`);

    let deleteQuery = '';
    let params = [];

    switch (period) {
      case '24h':
        deleteQuery = `DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '24 hours'`;
        break;
      case '7d':
        deleteQuery = `DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '7 days'`;
        break;
      case '30d':
        deleteQuery = `DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '30 days'`;
        break;
      case 'all':
        deleteQuery = `DELETE FROM audit_logs`;
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Período inválido. Use: 24h, 7d, 30d ou all'
        });
    }

    const result = await query(deleteQuery, params);
    const deletedCount = result.rowCount;

    console.log(`✅ ${deletedCount} logs deletados`);

    res.json({
      success: true,
      message: `${deletedCount} logs foram deletados com sucesso`,
      deletedCount
    });
  } catch (error) {
    console.error('❌ Erro ao deletar logs:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao deletar logs',
      error: error.message
    });
  }
};

module.exports = {
  getAllLogs,
  getLogsStats,
  deleteLogs
};

