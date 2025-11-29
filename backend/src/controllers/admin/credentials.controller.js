const { query } = require('../../database/connection');

/**
 * ================================
 * CONTROLLER: Gerenciamento de Credenciais (Super Admin)
 * ================================
 */

// ========================================
// UAZAP CREDENTIALS
// ========================================

/**
 * GET /api/admin/credentials/uazap
 * Lista todas as credenciais UAZAP
 */
const getAllUazapCredentials = async (req, res) => {
  try {
    console.log('📋 Listando credenciais UAZAP...');

    const result = await query(`
      SELECT 
        id,
        name,
        description,
        server_url,
        is_default,
        is_active,
        metadata,
        created_at,
        updated_at,
        (SELECT COUNT(*) FROM tenants WHERE uazap_credential_id = uazap_credentials.id) as tenants_using
      FROM uazap_credentials
      ORDER BY is_default DESC, created_at DESC
    `);

    console.log(`✅ ${result.rows.length} credenciais UAZAP encontradas`);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('❌ Erro ao listar credenciais UAZAP:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao listar credenciais UAZAP',
      error: error.message
    });
  }
};

/**
 * GET /api/admin/credentials/uazap/:id
 * Busca uma credencial UAZAP específica
 */
const getUazapCredentialById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT * FROM uazap_credentials WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Credencial UAZAP não encontrada'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Erro ao buscar credencial UAZAP:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar credencial UAZAP',
      error: error.message
    });
  }
};

/**
 * POST /api/admin/credentials/uazap
 * Cria nova credencial UAZAP
 */
const createUazapCredential = async (req, res) => {
  try {
    const { name, description, server_url, admin_token, is_default, metadata } = req.body;

    if (!name || !server_url || !admin_token) {
      return res.status(400).json({
        success: false,
        message: 'Nome, URL do servidor e token admin são obrigatórios'
      });
    }

    console.log('➕ Criando nova credencial UAZAP:', name);

    const result = await query(
      `INSERT INTO uazap_credentials 
       (name, description, server_url, admin_token, is_default, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, description || null, server_url, admin_token, is_default || false, metadata || {}]
    );

    console.log('✅ Credencial UAZAP criada com sucesso!');

    res.status(201).json({
      success: true,
      message: 'Credencial UAZAP criada com sucesso',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Erro ao criar credencial UAZAP:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao criar credencial UAZAP',
      error: error.message
    });
  }
};

/**
 * PUT /api/admin/credentials/uazap/:id
 * Atualiza uma credencial UAZAP
 */
const updateUazapCredential = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, server_url, admin_token, is_default, is_active, metadata } = req.body;

    console.log('🔄 Atualizando credencial UAZAP ID:', id);

    const result = await query(
      `UPDATE uazap_credentials 
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           server_url = COALESCE($3, server_url),
           admin_token = COALESCE($4, admin_token),
           is_default = COALESCE($5, is_default),
           is_active = COALESCE($6, is_active),
           metadata = COALESCE($7, metadata)
       WHERE id = $8
       RETURNING *`,
      [name, description, server_url, admin_token, is_default, is_active, metadata, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Credencial UAZAP não encontrada'
      });
    }

    console.log('✅ Credencial UAZAP atualizada com sucesso!');

    res.json({
      success: true,
      message: 'Credencial UAZAP atualizada com sucesso',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Erro ao atualizar credencial UAZAP:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar credencial UAZAP',
      error: error.message
    });
  }
};

/**
 * DELETE /api/admin/credentials/uazap/:id
 * Deleta uma credencial UAZAP
 */
const deleteUazapCredential = async (req, res) => {
  try {
    const { id } = req.params;

    console.log('🗑️ Deletando credencial UAZAP ID:', id);

    // Verificar se há tenants usando esta credencial
    const tenantsUsing = await query(
      `SELECT COUNT(*) as count FROM tenants WHERE uazap_credential_id = $1`,
      [id]
    );

    if (tenantsUsing.rows[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: `Não é possível deletar. ${tenantsUsing.rows[0].count} tenant(s) estão usando esta credencial.`
      });
    }

    const result = await query(
      `DELETE FROM uazap_credentials WHERE id = $1 RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Credencial UAZAP não encontrada'
      });
    }

    console.log('✅ Credencial UAZAP deletada com sucesso!');

    res.json({
      success: true,
      message: 'Credencial UAZAP deletada com sucesso'
    });
  } catch (error) {
    console.error('❌ Erro ao deletar credencial UAZAP:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao deletar credencial UAZAP',
      error: error.message
    });
  }
};

/**
 * PATCH /api/admin/credentials/uazap/:id/set-default
 * Define uma credencial UAZAP como padrão
 */
const setUazapCredentialAsDefault = async (req, res) => {
  try {
    const { id } = req.params;

    console.log('⭐ Definindo credencial UAZAP ID como padrão:', id);

    const result = await query(
      `UPDATE uazap_credentials SET is_default = true WHERE id = $1 RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Credencial UAZAP não encontrada'
      });
    }

    console.log('✅ Credencial UAZAP definida como padrão!');

    res.json({
      success: true,
      message: 'Credencial UAZAP definida como padrão',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Erro ao definir credencial padrão:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao definir credencial padrão',
      error: error.message
    });
  }
};

// ========================================
// NOVA VIDA CREDENTIALS
// ========================================

/**
 * GET /api/admin/credentials/novavida
 * Lista todas as credenciais Nova Vida
 */
const getAllNovaVidaCredentials = async (req, res) => {
  try {
    console.log('📋 Listando credenciais Nova Vida...');

    const result = await query(`
      SELECT 
        id,
        name,
        description,
        usuario,
        cliente,
        is_default,
        is_active,
        metadata,
        created_at,
        updated_at,
        (SELECT COUNT(*) FROM tenants WHERE novavida_credential_id = novavida_credentials.id) as tenants_using
      FROM novavida_credentials
      ORDER BY is_default DESC, created_at DESC
    `);

    console.log(`✅ ${result.rows.length} credenciais Nova Vida encontradas`);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('❌ Erro ao listar credenciais Nova Vida:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao listar credenciais Nova Vida',
      error: error.message
    });
  }
};

/**
 * GET /api/admin/credentials/novavida/:id
 * Busca uma credencial Nova Vida específica (com senha)
 */
const getNovaVidaCredentialById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT * FROM novavida_credentials WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Credencial Nova Vida não encontrada'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Erro ao buscar credencial Nova Vida:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar credencial Nova Vida',
      error: error.message
    });
  }
};

/**
 * POST /api/admin/credentials/novavida
 * Cria nova credencial Nova Vida
 */
const createNovaVidaCredential = async (req, res) => {
  try {
    const { name, description, usuario, senha, cliente, is_default, metadata } = req.body;

    if (!name || !usuario || !senha) {
      return res.status(400).json({
        success: false,
        message: 'Nome, usuário e senha são obrigatórios'
      });
    }

    console.log('➕ Criando nova credencial Nova Vida:', name);

    const result = await query(
      `INSERT INTO novavida_credentials 
       (name, description, usuario, senha, cliente, is_default, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [name, description || null, usuario, senha, cliente || '', is_default || false, metadata || {}]
    );

    console.log('✅ Credencial Nova Vida criada com sucesso!');

    res.status(201).json({
      success: true,
      message: 'Credencial Nova Vida criada com sucesso',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Erro ao criar credencial Nova Vida:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao criar credencial Nova Vida',
      error: error.message
    });
  }
};

/**
 * PUT /api/admin/credentials/novavida/:id
 * Atualiza uma credencial Nova Vida
 */
const updateNovaVidaCredential = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, usuario, senha, cliente, is_default, is_active, metadata } = req.body;

    console.log('🔄 Atualizando credencial Nova Vida ID:', id);

    const result = await query(
      `UPDATE novavida_credentials 
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           usuario = COALESCE($3, usuario),
           senha = COALESCE($4, senha),
           cliente = COALESCE($5, cliente),
           is_default = COALESCE($6, is_default),
           is_active = COALESCE($7, is_active),
           metadata = COALESCE($8, metadata)
       WHERE id = $9
       RETURNING *`,
      [name, description, usuario, senha, cliente, is_default, is_active, metadata, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Credencial Nova Vida não encontrada'
      });
    }

    console.log('✅ Credencial Nova Vida atualizada com sucesso!');

    res.json({
      success: true,
      message: 'Credencial Nova Vida atualizada com sucesso',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Erro ao atualizar credencial Nova Vida:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar credencial Nova Vida',
      error: error.message
    });
  }
};

/**
 * DELETE /api/admin/credentials/novavida/:id
 * Deleta uma credencial Nova Vida
 */
const deleteNovaVidaCredential = async (req, res) => {
  try {
    const { id } = req.params;

    console.log('🗑️ Deletando credencial Nova Vida ID:', id);

    // Verificar se há tenants usando esta credencial
    const tenantsUsing = await query(
      `SELECT COUNT(*) as count FROM tenants WHERE novavida_credential_id = $1`,
      [id]
    );

    if (tenantsUsing.rows[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: `Não é possível deletar. ${tenantsUsing.rows[0].count} tenant(s) estão usando esta credencial.`
      });
    }

    const result = await query(
      `DELETE FROM novavida_credentials WHERE id = $1 RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Credencial Nova Vida não encontrada'
      });
    }

    console.log('✅ Credencial Nova Vida deletada com sucesso!');

    res.json({
      success: true,
      message: 'Credencial Nova Vida deletada com sucesso'
    });
  } catch (error) {
    console.error('❌ Erro ao deletar credencial Nova Vida:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao deletar credencial Nova Vida',
      error: error.message
    });
  }
};

/**
 * PATCH /api/admin/credentials/novavida/:id/set-default
 * Define uma credencial Nova Vida como padrão
 */
const setNovaVidaCredentialAsDefault = async (req, res) => {
  try {
    const { id } = req.params;

    console.log('⭐ Definindo credencial Nova Vida ID como padrão:', id);

    const result = await query(
      `UPDATE novavida_credentials SET is_default = true WHERE id = $1 RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Credencial Nova Vida não encontrada'
      });
    }

    console.log('✅ Credencial Nova Vida definida como padrão!');

    res.json({
      success: true,
      message: 'Credencial Nova Vida definida como padrão',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Erro ao definir credencial padrão:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao definir credencial padrão',
      error: error.message
    });
  }
};

// ========================================
// ASAAS CREDENTIALS
// ========================================

/**
 * GET /api/admin/credentials/asaas
 * Lista todas as credenciais Asaas
 */
const getAllAsaasCredentials = async (req, res) => {
  try {
    console.log('📋 Listando credenciais Asaas...');

    const result = await query(`
      SELECT 
        id,
        name,
        description,
        api_key,
        environment,
        is_default,
        is_active,
        metadata,
        created_at,
        updated_at,
        (SELECT COUNT(*) FROM tenants WHERE asaas_credential_id = asaas_credentials.id) as tenants_using
      FROM asaas_credentials
      ORDER BY is_default DESC, created_at DESC
    `);

    console.log(`✅ ${result.rows.length} credenciais Asaas encontradas`);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('❌ Erro ao listar credenciais Asaas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao listar credenciais Asaas',
      error: error.message
    });
  }
};

/**
 * GET /api/admin/credentials/asaas/:id
 * Busca uma credencial Asaas específica
 */
const getAsaasCredentialById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT * FROM asaas_credentials WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Credencial Asaas não encontrada'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Erro ao buscar credencial Asaas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar credencial Asaas',
      error: error.message
    });
  }
};

/**
 * POST /api/admin/credentials/asaas
 * Cria nova credencial Asaas
 */
const createAsaasCredential = async (req, res) => {
  try {
    const { name, description, api_key, environment, is_default, metadata } = req.body;

    if (!name || !api_key) {
      return res.status(400).json({
        success: false,
        message: 'Nome e API Key são obrigatórios'
      });
    }

    console.log(`📝 Criando credencial Asaas: ${name}`);

    // Se for definida como padrão, desmarcar outras
    if (is_default) {
      await query('UPDATE asaas_credentials SET is_default = false');
    }

    const result = await query(`
      INSERT INTO asaas_credentials (name, description, api_key, environment, is_default, metadata)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [name, description, api_key, environment || 'production', is_default || false, metadata || {}]);

    console.log(`✅ Credencial Asaas "${name}" criada com sucesso`);

    res.status(201).json({
      success: true,
      message: 'Credencial Asaas criada com sucesso',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Erro ao criar credencial Asaas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao criar credencial Asaas',
      error: error.message
    });
  }
};

/**
 * PUT /api/admin/credentials/asaas/:id
 * Atualiza uma credencial Asaas existente
 */
const updateAsaasCredential = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, api_key, environment, is_default, is_active, metadata } = req.body;

    console.log(`📝 Atualizando credencial Asaas ID: ${id}`);

    // 🔒 PROTEÇÃO: NÃO PERMITIR API_KEY VAZIA
    // Se api_key vier como string vazia ou null, ignorar e manter a existente
    const safeApiKey = (api_key && api_key.trim() !== '') ? api_key : null;

    // Se for definida como padrão, desmarcar outras
    if (is_default) {
      await query('UPDATE asaas_credentials SET is_default = false WHERE id != $1', [id]);
    }

    const result = await query(`
      UPDATE asaas_credentials 
      SET 
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        api_key = COALESCE($3, api_key),
        environment = COALESCE($4, environment),
        is_default = COALESCE($5, is_default),
        is_active = COALESCE($6, is_active),
        metadata = COALESCE($7, metadata),
        updated_at = NOW()
      WHERE id = $8
      RETURNING *
    `, [name, description, safeApiKey, environment, is_default, is_active, metadata, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Credencial Asaas não encontrada'
      });
    }

    console.log(`✅ Credencial Asaas ID ${id} atualizada com sucesso`);

    res.json({
      success: true,
      message: 'Credencial Asaas atualizada com sucesso',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Erro ao atualizar credencial Asaas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar credencial Asaas',
      error: error.message
    });
  }
};

/**
 * DELETE /api/admin/credentials/asaas/:id
 * Deleta uma credencial Asaas
 */
const deleteAsaasCredential = async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`🗑️  Deletando credencial Asaas ID: ${id}`);

    // Verificar se há tenants usando essa credencial
    const checkResult = await query(
      'SELECT COUNT(*) as count FROM tenants WHERE asaas_credential_id = $1',
      [id]
    );

    if (parseInt(checkResult.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        message: 'Não é possível deletar esta credencial pois existem tenants utilizando-a'
      });
    }

    const result = await query(
      'DELETE FROM asaas_credentials WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Credencial Asaas não encontrada'
      });
    }

    console.log(`✅ Credencial Asaas ID ${id} deletada com sucesso`);

    res.json({
      success: true,
      message: 'Credencial Asaas deletada com sucesso'
    });
  } catch (error) {
    console.error('❌ Erro ao deletar credencial Asaas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao deletar credencial Asaas',
      error: error.message
    });
  }
};

/**
 * PUT /api/admin/credentials/asaas/:id/default
 * Define uma credencial Asaas como padrão
 */
const setAsaasCredentialAsDefault = async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`⭐ Definindo credencial Asaas ID ${id} como padrão`);

    // Desmarcar todas as outras como padrão
    await query('UPDATE asaas_credentials SET is_default = false');

    // Marcar esta como padrão
    const result = await query(
      'UPDATE asaas_credentials SET is_default = true WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Credencial Asaas não encontrada'
      });
    }

    console.log(`✅ Credencial Asaas "${result.rows[0].name}" definida como padrão`);

    res.json({
      success: true,
      message: 'Credencial Asaas definida como padrão',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Erro ao definir credencial Asaas como padrão:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao definir credencial como padrão',
      error: error.message
    });
  }
};

module.exports = {
  // UAZAP
  getAllUazapCredentials,
  getUazapCredentialById,
  createUazapCredential,
  updateUazapCredential,
  deleteUazapCredential,
  setUazapCredentialAsDefault,
  
  // Nova Vida
  getAllNovaVidaCredentials,
  getNovaVidaCredentialById,
  createNovaVidaCredential,
  updateNovaVidaCredential,
  deleteNovaVidaCredential,
  setNovaVidaCredentialAsDefault,
  
  // Asaas
  getAllAsaasCredentials,
  getAsaasCredentialById,
  createAsaasCredential,
  updateAsaasCredential,
  deleteAsaasCredential,
  setAsaasCredentialAsDefault
};

