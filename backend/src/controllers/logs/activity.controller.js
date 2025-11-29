const { query } = require('../../database/connection');

/**
 * Registrar atividade do usuário (logs do frontend)
 */
const logActivity = async (req, res) => {
  try {
    const userId = req.user?.id || null;
    const tenantId = req.user?.tenant_id || null;
    
    const {
      acao,
      entidade,
      entidade_id,
      dados_antes,
      dados_depois,
      metodo_http,
      url_path,
      erro_mensagem,
      metadata
    } = req.body;

    // IP do usuário
    const ip_address = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    
    // User Agent
    const user_agent = req.headers['user-agent'] || 'Unknown';

    // Determinar se foi sucesso (se não tem erro)
    const sucesso = !erro_mensagem;

    // Inserir no banco
    const result = await query(
      `INSERT INTO audit_logs (
        tenant_id,
        user_id,
        acao,
        entidade,
        entidade_id,
        dados_antes,
        dados_depois,
        ip_address,
        user_agent,
        metodo_http,
        url_path,
        sucesso,
        erro_mensagem,
        metadata,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
      RETURNING id`,
      [
        tenantId,
        userId,
        acao,
        entidade || 'sistema',
        entidade_id || null,
        dados_antes ? JSON.stringify(dados_antes) : null,
        dados_depois ? JSON.stringify(dados_depois) : null,
        ip_address,
        user_agent,
        metodo_http || 'N/A',
        url_path || req.path,
        sucesso,
        erro_mensagem || null,
        metadata ? JSON.stringify(metadata) : null
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Log registrado com sucesso',
      data: { id: result.rows[0].id }
    });
  } catch (error) {
    console.error('❌ Erro ao registrar log de atividade:', error);
    // Não retornar erro para não atrapalhar o fluxo do usuário
    res.status(200).json({
      success: false,
      message: 'Erro ao registrar log (silencioso)'
    });
  }
};

module.exports = {
  logActivity
};



