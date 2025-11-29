const { query } = require('../../database/connection');
const bcrypt = require('bcryptjs');

/**
 * Controller para Gerenciamento de Usuários Master (Super Admin)
 * Usuários master são criados automaticamente para cada tenant e invisíveis para os admins do tenant
 */

/**
 * GET /api/admin/master-users - Listar todos os usuários master
 */
const getAllMasterUsers = async (req, res) => {
  try {
    console.log('🔐 Listando todos os usuários master...');

    const result = await query(`
      SELECT 
        tu.id,
        tu.tenant_id,
        tu.nome,
        tu.email,
        tu.ativo,
        tu.created_at,
        tu.updated_at,
        tu.ultimo_login,
        tu.total_logins,
        t.nome as tenant_nome,
        t.slug as tenant_slug,
        t.email as tenant_email,
        t.plano,
        t.status as tenant_status
      FROM tenant_users tu
      INNER JOIN tenants t ON tu.tenant_id = t.id
      WHERE tu.role = 'super_admin'
      ORDER BY tu.created_at DESC
    `);

    console.log(`✅ ${result.rows.length} usuários master encontrados`);

    res.json({
      success: true,
      data: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('❌ Erro ao listar usuários master:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao listar usuários master',
      error: error.message
    });
  }
};

/**
 * GET /api/admin/master-users/:tenantId - Buscar usuário master de um tenant específico
 */
const getMasterUserByTenant = async (req, res) => {
  try {
    const { tenantId } = req.params;
    console.log(`🔍 Buscando usuário master do tenant ID: ${tenantId}`);

    const result = await query(`
      SELECT 
        tu.id,
        tu.tenant_id,
        tu.nome,
        tu.email,
        tu.ativo,
        tu.created_at,
        tu.updated_at,
        tu.ultimo_login,
        tu.total_logins,
        t.nome as tenant_nome,
        t.slug as tenant_slug
      FROM tenant_users tu
      INNER JOIN tenants t ON tu.tenant_id = t.id
      WHERE tu.tenant_id = $1 AND tu.role = 'super_admin'
      LIMIT 1
    `, [tenantId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuário master não encontrado para este tenant'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Erro ao buscar usuário master:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar usuário master',
      error: error.message
    });
  }
};

/**
 * PUT /api/admin/master-users/:id/change-password - Alterar senha de um usuário master
 */
const changeMasterPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Senha inválida. Mínimo de 6 caracteres.'
      });
    }

    console.log(`🔐 Alterando senha do usuário master ID: ${id}`);

    // Verificar se é realmente um usuário master
    const checkResult = await query(
      'SELECT id, email, tenant_id FROM tenant_users WHERE id = $1 AND role = $2',
      [id, 'super_admin']
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuário master não encontrado'
      });
    }

    const masterUser = checkResult.rows[0];

    // Hash da nova senha
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Atualizar senha
    await query(
      'UPDATE tenant_users SET senha_hash = $1, updated_at = NOW() WHERE id = $2',
      [passwordHash, id]
    );

    console.log(`✅ Senha do usuário master alterada: ${masterUser.email}`);

    res.json({
      success: true,
      message: 'Senha do usuário master alterada com sucesso',
      data: {
        id: masterUser.id,
        email: masterUser.email,
        tenant_id: masterUser.tenant_id
      }
    });
  } catch (error) {
    console.error('❌ Erro ao alterar senha do usuário master:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao alterar senha',
      error: error.message
    });
  }
};

/**
 * POST /api/admin/master-users/create-missing - Criar usuários master para tenants que não têm
 */
const createMissingMasterUsers = async (req, res) => {
  try {
    console.log('🔄 Verificando tenants sem usuário master...');

    // Buscar tenants que não têm usuário master
    const tenantsWithoutMaster = await query(`
      SELECT t.id, t.nome, t.slug
      FROM tenants t
      WHERE NOT EXISTS (
        SELECT 1 FROM tenant_users tu 
        WHERE tu.tenant_id = t.id AND tu.role = 'super_admin'
      )
      ORDER BY t.id
    `);

    if (tenantsWithoutMaster.rows.length === 0) {
      return res.json({
        success: true,
        message: 'Todos os tenants já possuem usuário master',
        created: 0
      });
    }

    console.log(`📋 Encontrados ${tenantsWithoutMaster.rows.length} tenants sem usuário master`);

    const masterPassword = 'master123@nettsistemas';
    const masterPasswordHash = await bcrypt.hash(masterPassword, 10);
    const created = [];

    // Criar usuário master para cada tenant
    for (const tenant of tenantsWithoutMaster.rows) {
      try {
        const masterEmail = `${tenant.id}@NETTSISTEMAS.COM.BR`;

        await query(`
          INSERT INTO tenant_users (
            tenant_id, nome, email, senha_hash, role, ativo, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, 'super_admin', true, NOW(), NOW())
        `, [
          tenant.id,
          'Master Access - NETT Sistemas',
          masterEmail,
          masterPasswordHash
        ]);

        console.log(`✅ Usuário master criado para tenant ${tenant.id}: ${masterEmail}`);
        created.push({
          tenant_id: tenant.id,
          tenant_nome: tenant.nome,
          email: masterEmail
        });
      } catch (err) {
        console.error(`⚠️ Erro ao criar master para tenant ${tenant.id}:`, err.message);
      }
    }

    res.json({
      success: true,
      message: `${created.length} usuário(s) master criado(s) com sucesso`,
      created: created.length,
      data: created
    });
  } catch (error) {
    console.error('❌ Erro ao criar usuários master faltantes:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao criar usuários master',
      error: error.message
    });
  }
};

/**
 * GET /api/admin/master-users/config - Obter configuração de senha padrão
 */
const getMasterConfig = async (req, res) => {
  try {
    // Por enquanto retorna hardcoded, depois pode vir do banco
    res.json({
      success: true,
      data: {
        default_password: 'master123@nettsistemas',
        email_pattern: '{tenant_id}@NETTSISTEMAS.COM.BR',
        auto_create: true
      }
    });
  } catch (error) {
    console.error('❌ Erro ao obter config:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao obter configuração',
      error: error.message
    });
  }
};

/**
 * PUT /api/admin/master-users/:id/toggle-active - Ativar/Desativar usuário master
 */
const toggleMasterActive = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🔄 Alternando status do usuário master ID: ${id}`);

    // Verificar se existe e buscar status atual
    const checkResult = await query(
      'SELECT id, email, ativo FROM tenant_users WHERE id = $1 AND role = $2',
      [id, 'super_admin']
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuário master não encontrado'
      });
    }

    const currentStatus = checkResult.rows[0].ativo;
    const newStatus = !currentStatus;

    // Atualizar status
    await query(
      'UPDATE tenant_users SET ativo = $1, updated_at = NOW() WHERE id = $2',
      [newStatus, id]
    );

    console.log(`✅ Usuário master ${newStatus ? 'ativado' : 'desativado'}: ${checkResult.rows[0].email}`);

    res.json({
      success: true,
      message: `Usuário master ${newStatus ? 'ativado' : 'desativado'} com sucesso`,
      data: {
        id: checkResult.rows[0].id,
        email: checkResult.rows[0].email,
        ativo: newStatus
      }
    });
  } catch (error) {
    console.error('❌ Erro ao alterar status do usuário master:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao alterar status',
      error: error.message
    });
  }
};

module.exports = {
  getAllMasterUsers,
  getMasterUserByTenant,
  changeMasterPassword,
  createMissingMasterUsers,
  getMasterConfig,
  toggleMasterActive
};

