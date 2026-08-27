const express = require('express');
const router = express.Router();
const { query } = require('../database/connection');
const { tenantQuery } = require('../database/tenant-query');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs').promises;
const { checkUserLimit } = require('../middlewares/tenant-limits.middleware');

/**
 * GET /api/gestao/usage
 * Obter estatísticas de uso do tenant
 */
router.get('/usage', async (req, res) => {
  try {
    const tenantId = req.tenant?.id;
    
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant não identificado'
      });
    }

    console.log(`📊 Buscando estatísticas de uso do tenant ${tenantId}`);

    // Buscar estatísticas de uso
    const result = await query(`
      SELECT 
        -- USUÁRIOS
        (SELECT COUNT(*) FROM tenant_users WHERE tenant_id = $1 AND role != 'super_admin') as total_usuarios,
        
        -- CONTAS WHATSAPP
        (SELECT COUNT(*) FROM whatsapp_accounts WHERE tenant_id = $1 AND is_active = true) as total_contas_api,
        (SELECT COUNT(*) FROM uaz_instances WHERE tenant_id = $1 AND status = 'connected') as total_contas_qr,
        
        -- CAMPANHAS (MÊS ATUAL)
        (SELECT COUNT(*) FROM campaigns 
         WHERE tenant_id = $1 
         AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM CURRENT_DATE)
         AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE)
        ) as campanhas_mes_api,
        (SELECT COUNT(*) FROM qr_campaigns 
         WHERE tenant_id = $1 
         AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM CURRENT_DATE)
         AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE)
        ) as campanhas_mes_qr,
        
        -- MENSAGENS (DIA ATUAL)
        (SELECT COALESCE(SUM(sent_count), 0) FROM campaigns 
         WHERE tenant_id = $1 
         AND DATE(created_at) = CURRENT_DATE
        ) as mensagens_dia_api,
        (SELECT COALESCE(SUM(sent_count), 0) FROM qr_campaigns 
         WHERE tenant_id = $1 
         AND DATE(created_at) = CURRENT_DATE
        ) as mensagens_dia_qr
    `, [tenantId]);

    const stats = result.rows[0];

    res.json({
      success: true,
      data: {
        total_usuarios: parseInt(stats.total_usuarios) || 0,
        total_contas: (parseInt(stats.total_contas_api) || 0) + (parseInt(stats.total_contas_qr) || 0),
        campanhas_mes: (parseInt(stats.campanhas_mes_api) || 0) + (parseInt(stats.campanhas_mes_qr) || 0),
        mensagens_dia: (parseInt(stats.mensagens_dia_api) || 0) + (parseInt(stats.mensagens_dia_qr) || 0)
      }
    });
  } catch (error) {
    console.error('❌ Erro ao buscar estatísticas de uso:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar estatísticas de uso',
      error: error.message
    });
  }
});

/**
 * GET /api/gestao/users
 * Listar todos os usuários do tenant do admin logado
 */
router.get('/users', async (req, res) => {
  try {
    const tenantId = req.tenant?.id;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    console.log(`🔍 Listando usuários - TenantID: ${tenantId}, UserID: ${userId}, Role: ${userRole}`);

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant não identificado'
      });
    }

    // Apenas admins ou super_admins podem listar usuários
    if (userRole !== 'admin' && userRole !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado. Apenas administradores podem visualizar usuários.'
      });
    }

    const result = await query(`
      SELECT 
        id, 
        nome, 
        email, 
        telefone,
        documento,
        role, 
        permissoes, 
        ativo, 
        avatar,
        created_at, 
        ultimo_login
      FROM tenant_users 
      WHERE tenant_id = $1 AND role != 'super_admin'
      ORDER BY role DESC, created_at DESC
    `, [tenantId]);

    console.log(`✅ Encontrados ${result.rows.length} usuários no tenant ${tenantId}`);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('❌ Erro ao listar usuários:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao listar usuários',
      error: error.message
    });
  }
});

/**
 * POST /api/gestao/users
 * Criar novo usuário no tenant do admin logado
 */
router.post('/users', checkUserLimit, async (req, res) => {
  try {
    const tenantId = req.tenant?.id;
    const userRole = req.user?.role;
    const { nome, email, senha, role, permissoes, ativo } = req.body;

    console.log(`🔄 Criando usuário - TenantID: ${tenantId}, Role: ${userRole}`);

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant não identificado'
      });
    }

    if (userRole !== 'admin' && userRole !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado. Apenas administradores podem criar usuários.'
      });
    }

    if (!nome || !email || !senha) {
      return res.status(400).json({
        success: false,
        message: 'Nome, email e senha são obrigatórios'
      });
    }

    // Verificar se o email já existe no tenant
    const existingUser = await query(
      'SELECT id FROM tenant_users WHERE email = $1 AND tenant_id = $2',
      [email, tenantId]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Este email já está em uso neste tenant'
      });
    }

    // Hash da senha
    const senhaHash = await bcrypt.hash(senha, 10);

    // Preparar permissões (se não fornecidas, usar vazio)
    const permissoesJson = permissoes && Object.keys(permissoes).length > 0 
      ? JSON.stringify(permissoes) 
      : '{}';

    // Inserir novo usuário
    const result = await query(`
      INSERT INTO tenant_users 
        (tenant_id, nome, email, senha_hash, role, permissoes, ativo)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, nome, email, role, permissoes, ativo, created_at
    `, [
      tenantId,
      nome,
      email,
      senhaHash,
      role || 'user',
      permissoesJson,
      ativo !== undefined ? ativo : true
    ]);

    console.log(`✅ Usuário criado: ${result.rows[0].nome}`);

    res.status(201).json({
      success: true,
      message: 'Usuário criado com sucesso',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Erro ao criar usuário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao criar usuário',
      error: error.message
    });
  }
});

/**
 * PUT /api/gestao/users/:userId
 * Atualizar usuário no tenant do admin logado
 */
router.put('/users/:userId', async (req, res) => {
  try {
    const tenantId = req.tenant?.id;
    const userRole = req.user?.role;
    const { userId } = req.params;
    const { nome, email, role, permissoes, ativo, senha, telefone, documento } = req.body;

    console.log(`✏️ Atualizando usuário ID: ${userId} do tenant ID: ${tenantId}`);
    console.log(`📞 Dados recebidos - telefone: ${telefone}, documento: ${documento}`);

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant não identificado'
      });
    }

    if (userRole !== 'admin' && userRole !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado. Apenas administradores podem editar usuários.'
      });
    }

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

    if (telefone !== undefined) {
      updateFields.push(`telefone = $${paramCount}`);
      updateValues.push(telefone);
      paramCount++;
    }

    if (documento !== undefined) {
      updateFields.push(`documento = $${paramCount}`);
      updateValues.push(documento);
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

    const result = await query(`
      UPDATE tenant_users 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, nome, email, role, permissoes, ativo, telefone, documento, avatar, created_at, updated_at
    `, [...updateValues, userId]);

    const updatedUser = result.rows[0];
    // Parse permissoes back to object before sending to frontend
    if (updatedUser.permissoes && typeof updatedUser.permissoes === 'string') {
      updatedUser.permissoes = JSON.parse(updatedUser.permissoes);
    }

    console.log(`✅ Usuário atualizado: ${updatedUser.nome}`);

    res.json({
      success: true,
      message: 'Usuário atualizado com sucesso',
      data: updatedUser
    });
  } catch (error) {
    console.error('❌ Erro ao atualizar usuário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar usuário',
      error: error.message
    });
  }
});

/**
 * DELETE /api/gestao/users/:userId
 * Excluir usuário no tenant do admin logado
 */
router.delete('/users/:userId', async (req, res) => {
  try {
    const tenantId = req.tenant?.id;
    const userRole = req.user?.role;
    const { userId } = req.params;

    console.log(`🗑️ Excluindo usuário ID: ${userId} do tenant ID: ${tenantId}`);

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant não identificado'
      });
    }

    if (userRole !== 'admin' && userRole !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado. Apenas administradores podem excluir usuários.'
      });
    }

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

    // Não permitir excluir o admin principal do tenant
    if (userCheck.rows[0].role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Não é possível excluir o administrador principal do tenant'
      });
    }

    await query('DELETE FROM tenant_users WHERE id = $1', [userId]);

    console.log(`✅ Usuário ID ${userId} excluído com sucesso`);

    res.json({
      success: true,
      message: 'Usuário excluído com sucesso'
    });
  } catch (error) {
    console.error('❌ Erro ao excluir usuário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao excluir usuário',
      error: error.message
    });
  }
});

/**
 * POST /api/gestao/users/:userId/avatar
 * Upload de avatar para qualquer usuário (apenas admin)
 */
router.post('/users/:userId/avatar', async (req, res) => {
  try {
    const tenantId = req.tenant?.id;
    const userRole = req.user?.role;
    const { userId } = req.params;

    console.log(`📸 Upload de avatar - UserID: ${userId}, TenantID: ${tenantId}, Role: ${userRole}`);

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant não identificado'
      });
    }

    // Apenas admins ou super_admins podem fazer upload de avatar de outros usuários
    if (userRole !== 'admin' && userRole !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado. Apenas administradores podem alterar avatares de usuários.'
      });
    }

    // Verificar se o arquivo foi enviado
    if (!req.files || !req.files.avatar) {
      return res.status(400).json({ 
        success: false, 
        message: 'Nenhuma imagem foi enviada' 
      });
    }

    const avatar = req.files.avatar;

    // Validar tipo de arquivo
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(avatar.mimetype)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Formato de imagem inválido. Use: JPG, PNG, GIF ou WEBP' 
      });
    }

    // Validar tamanho (max 5MB)
    if (avatar.size > 5 * 1024 * 1024) {
      return res.status(400).json({ 
        success: false, 
        message: 'A imagem deve ter no máximo 5MB' 
      });
    }

    // Verificar se o usuário pertence ao tenant
    const userCheck = await query(
      'SELECT id, avatar FROM tenant_users WHERE id = $1 AND tenant_id = $2',
      [userId, tenantId]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado neste tenant'
      });
    }

    const oldAvatar = userCheck.rows[0].avatar;

    // Criar diretório de uploads se não existir
    const uploadsDir = path.join(__dirname, '../../uploads/avatars');
    try {
      await fs.mkdir(uploadsDir, { recursive: true });
    } catch (err) {
      // Diretório já existe
    }

    // Gerar nome único para o arquivo
    const timestamp = Date.now();
    const extension = path.extname(avatar.name);
    const filename = `avatar-${userId}-${timestamp}${extension}`;
    const filepath = path.join(uploadsDir, filename);

    // Mover arquivo
    await avatar.mv(filepath);

    // Deletar avatar antigo se existir
    if (oldAvatar && oldAvatar !== filename) {
      const oldFilepath = path.join(uploadsDir, oldAvatar);
      try {
        await fs.unlink(oldFilepath);
        console.log(`🗑️ Avatar antigo deletado: ${oldAvatar}`);
      } catch (err) {
        console.log(`⚠️ Erro ao deletar avatar antigo (não crítico):`, err.message);
      }
    }

    // Atualizar no banco de dados
    await query(
      'UPDATE tenant_users SET avatar = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [filename, userId]
    );

    console.log(`✅ Avatar atualizado com sucesso para usuário ${userId}: ${filename}`);

    res.json({
      success: true,
      message: 'Avatar atualizado com sucesso',
      data: {
        avatar: filename,
        avatarUrl: `/uploads/avatars/${filename}`
      }
    });
  } catch (error) {
    console.error('❌ Erro ao fazer upload do avatar:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao fazer upload do avatar',
      error: error.message 
    });
  }
});

/**
 * DELETE /api/gestao/users/:userId/avatar
 * Remover avatar de qualquer usuário (apenas admin)
 */
router.delete('/users/:userId/avatar', async (req, res) => {
  try {
    const tenantId = req.tenant?.id;
    const userRole = req.user?.role;
    const { userId } = req.params;

    console.log(`🗑️ Removendo avatar - UserID: ${userId}, TenantID: ${tenantId}`);

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant não identificado'
      });
    }

    // Apenas admins ou super_admins podem remover avatar de outros usuários
    if (userRole !== 'admin' && userRole !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado. Apenas administradores podem remover avatares de usuários.'
      });
    }

    // Verificar se o usuário pertence ao tenant e obter avatar atual
    const userCheck = await query(
      'SELECT id, avatar FROM tenant_users WHERE id = $1 AND tenant_id = $2',
      [userId, tenantId]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado neste tenant'
      });
    }

    const oldAvatar = userCheck.rows[0].avatar;

    // Deletar arquivo se existir
    if (oldAvatar) {
      const uploadsDir = path.join(__dirname, '../../uploads/avatars');
      const oldFilepath = path.join(uploadsDir, oldAvatar);
      try {
        await fs.unlink(oldFilepath);
        console.log(`🗑️ Avatar deletado: ${oldAvatar}`);
      } catch (err) {
        console.log(`⚠️ Erro ao deletar arquivo (não crítico):`, err.message);
      }
    }

    // Atualizar no banco de dados (set avatar to NULL)
    await query(
      'UPDATE tenant_users SET avatar = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [userId]
    );

    console.log(`✅ Avatar removido com sucesso para usuário ${userId}`);

    res.json({
      success: true,
      message: 'Avatar removido com sucesso'
    });
  } catch (error) {
    console.error('❌ Erro ao remover avatar:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao remover avatar',
      error: error.message 
    });
  }
});

/**
 * POST /api/gestao/users/deactivate-multiple
 * Desativar múltiplos usuários (ativo = false)
 */
router.post('/users/deactivate-multiple', async (req, res) => {
  try {
    const tenantId = req.tenant?.id;
    const userRole = req.user?.role;
    const { user_ids } = req.body;

    console.log(`⏸️ Desativando múltiplos usuários - TenantID: ${tenantId}`);

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant não identificado'
      });
    }

    if (userRole !== 'admin' && userRole !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado. Apenas administradores podem desativar usuários.'
      });
    }

    if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'user_ids deve ser um array não-vazio'
      });
    }

    // Não permitir desativar admins
    const result = await query(`
      UPDATE tenant_users 
      SET ativo = false, updated_at = NOW()
      WHERE id = ANY($1::int[]) 
        AND tenant_id = $2 
        AND role != 'admin'
        AND ativo = true
      RETURNING id, nome
    `, [user_ids, tenantId]);

    console.log(`✅ ${result.rows.length} usuário(s) desativado(s)`);

    res.json({
      success: true,
      count: result.rows.length,
      users: result.rows,
      message: `${result.rows.length} usuário(s) desativado(s) com sucesso`
    });
  } catch (error) {
    console.error('❌ Erro ao desativar usuários:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao desativar usuários',
      error: error.message
    });
  }
});

/**
 * POST /api/gestao/users/deactivate-all
 * Desativar todos os usuários comuns do tenant (ativo = false)
 */
router.post('/users/deactivate-all', async (req, res) => {
  try {
    const tenantId = req.tenant?.id;
    const userRole = req.user?.role;

    console.log(`🚨 Desativando TODOS os usuários - TenantID: ${tenantId}`);

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant não identificado'
      });
    }

    if (userRole !== 'admin' && userRole !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado. Apenas administradores podem desativar usuários.'
      });
    }

    // Desativar todos os usuários comuns (não admins)
    const result = await query(`
      UPDATE tenant_users 
      SET ativo = false, updated_at = NOW()
      WHERE tenant_id = $1 
        AND role != 'admin'
        AND ativo = true
      RETURNING id, nome
    `, [tenantId]);

    console.log(`✅ ${result.rows.length} usuário(s) desativado(s)`);

    res.json({
      success: true,
      count: result.rows.length,
      users: result.rows,
      message: `${result.rows.length} usuário(s) desativado(s) com sucesso`
    });
  } catch (error) {
    console.error('❌ Erro ao desativar usuários:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao desativar todos os usuários',
      error: error.message
    });
  }
});

/**
 * POST /api/gestao/users/activate-selected
 * Ativar usuários selecionados (ativo = true)
 */
router.post('/users/activate-selected', async (req, res) => {
  try {
    const { userIds } = req.body;
    const tenantId = req.tenant?.id;
    const userRole = req.user?.role;

    console.log(`✅ Ativando usuários selecionados - TenantID: ${tenantId}`, userIds);

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant não identificado'
      });
    }

    if (userRole !== 'admin' && userRole !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado. Apenas administradores podem ativar usuários.'
      });
    }

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'IDs de usuários inválidos ou vazios'
      });
    }

    // Ativar usuários selecionados
    const result = await query(`
      UPDATE tenant_users 
      SET ativo = true, updated_at = NOW()
      WHERE tenant_id = $1 
        AND id = ANY($2::int[])
        AND role != 'admin'
        AND ativo = false
      RETURNING id, nome
    `, [tenantId, userIds]);

    console.log(`✅ ${result.rows.length} usuário(s) ativado(s)`);

    res.json({
      success: true,
      count: result.rows.length,
      users: result.rows,
      message: `${result.rows.length} usuário(s) ativado(s) com sucesso`
    });
  } catch (error) {
    console.error('❌ Erro ao ativar usuários:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao ativar usuários selecionados',
      error: error.message
    });
  }
});

/**
 * POST /api/gestao/users/activate-all
 * Ativar todos os usuários comuns do tenant (ativo = true)
 */
router.post('/users/activate-all', async (req, res) => {
  try {
    const tenantId = req.tenant?.id;
    const userRole = req.user?.role;

    console.log(`✅ Ativando TODOS os usuários - TenantID: ${tenantId}`);

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant não identificado'
      });
    }

    if (userRole !== 'admin' && userRole !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado. Apenas administradores podem ativar usuários.'
      });
    }

    // Ativar todos os usuários comuns (não admins)
    const result = await query(`
      UPDATE tenant_users 
      SET ativo = true, updated_at = NOW()
      WHERE tenant_id = $1 
        AND role != 'admin'
        AND ativo = false
      RETURNING id, nome
    `, [tenantId]);

    console.log(`✅ ${result.rows.length} usuário(s) ativado(s)`);

    res.json({
      success: true,
      count: result.rows.length,
      users: result.rows,
      message: `${result.rows.length} usuário(s) ativado(s) com sucesso`
    });
  } catch (error) {
    console.error('❌ Erro ao ativar usuários:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao ativar todos os usuários',
      error: error.message
    });
  }
});

/**
 * POST /api/gestao/users/:userId/deactivate-accounts
 * Desativa todas as contas de WhatsApp (API e QR) de um usuário específico
 */
router.post('/users/:userId/deactivate-accounts', async (req, res) => {
  try {
    const { userId } = req.params;
    const tenantId = req.tenant?.id;
    const userRole = req.user?.role;

    console.log(`🔴 Desativando contas do usuário ${userId} - TenantID: ${tenantId}`);

    // Apenas admins podem desativar contas
    if (userRole !== 'admin' && userRole !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado. Apenas administradores podem desativar contas.'
      });
    }

    // Verificar se o usuário pertence ao tenant
    const userCheck = await query(`
      SELECT id, nome FROM tenant_users 
      WHERE id = $1 AND tenant_id = $2
    `, [userId, tenantId]);

    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    // Desativar contas da API Oficial do usuário
    const apiAccountsResult = await query(`
      UPDATE whatsapp_accounts 
      SET is_active = false, updated_at = NOW()
      WHERE tenant_id = $1 AND is_active = true
      RETURNING id, name
    `, [tenantId]);

    // Desativar instâncias UAZ do usuário
    const uazInstancesResult = await query(`
      UPDATE uaz_instances 
      SET is_active = false, updated_at = NOW()
      WHERE tenant_id = $1 AND is_active = true
      RETURNING id, name
    `, [tenantId]);

    const totalDeactivated = apiAccountsResult.rows.length + uazInstancesResult.rows.length;

    console.log(`✅ ${totalDeactivated} conta(s) desativada(s) do usuário ${userCheck.rows[0].nome}`);

    res.json({
      success: true,
      api_accounts: apiAccountsResult.rows.length,
      uaz_instances: uazInstancesResult.rows.length,
      total: totalDeactivated,
      message: `${totalDeactivated} conta(s) de WhatsApp desativada(s) do usuário ${userCheck.rows[0].nome}`
    });
  } catch (error) {
    console.error('❌ Erro ao desativar contas do usuário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao desativar contas do usuário',
      error: error.message
    });
  }
});

/**
 * POST /api/gestao/users/deactivate-all-accounts
 * Desativa TODAS as contas de WhatsApp (API e QR) de TODOS os usuários do tenant
 */
router.post('/users/deactivate-all-accounts', async (req, res) => {
  try {
    const tenantId = req.tenant?.id;
    const userRole = req.user?.role;

    console.log(`🚨 Desativando TODAS as contas do tenant ${tenantId}`);

    // Apenas admins podem desativar todas as contas
    if (userRole !== 'admin' && userRole !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado. Apenas administradores podem desativar todas as contas.'
      });
    }

    // Desativar TODAS as contas da API Oficial do tenant
    const apiAccountsResult = await query(`
      UPDATE whatsapp_accounts 
      SET is_active = false, updated_at = NOW()
      WHERE tenant_id = $1 AND is_active = true
      RETURNING id, name
    `, [tenantId]);

    // Desativar TODAS as instâncias UAZ do tenant
    const uazInstancesResult = await query(`
      UPDATE uaz_instances 
      SET is_active = false, updated_at = NOW()
      WHERE tenant_id = $1 AND is_active = true
      RETURNING id, name
    `, [tenantId]);

    const totalDeactivated = apiAccountsResult.rows.length + uazInstancesResult.rows.length;

    console.log(`✅ ${totalDeactivated} conta(s) desativada(s) no total`);
    console.log(`   📊 API Oficial: ${apiAccountsResult.rows.length}`);
    console.log(`   📊 UAZ Instances: ${uazInstancesResult.rows.length}`);

    res.json({
      success: true,
      api_accounts: apiAccountsResult.rows.length,
      uaz_instances: uazInstancesResult.rows.length,
      total: totalDeactivated,
      message: `${totalDeactivated} conta(s) de WhatsApp desativada(s) no total (${apiAccountsResult.rows.length} API + ${uazInstancesResult.rows.length} QR)`
    });
  } catch (error) {
    console.error('❌ Erro ao desativar todas as contas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao desativar todas as contas',
      error: error.message
    });
  }
});

/**
 * GET /api/gestao/users/:userId/whatsapp-accounts
 * Buscar contas WhatsApp associadas a um usuário
 */
router.get('/users/:userId/whatsapp-accounts', async (req, res) => {
  try {
    const { userId } = req.params;
    const tenantId = req.tenant?.id;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant não identificado'
      });
    }

    // Buscar contas API associadas ao usuário
    const apiAccounts = await tenantQuery(req, `
      SELECT uwa.id as association_id, wa.id, wa.name, wa.phone_number, wa.is_active
      FROM user_whatsapp_accounts uwa
      INNER JOIN whatsapp_accounts wa ON uwa.whatsapp_account_id = wa.id
      WHERE uwa.user_id = $1 AND uwa.tenant_id = $2
      ORDER BY wa.name
    `, [userId, tenantId]);

    // Buscar instâncias UAZ associadas ao usuário (se a tabela existir)
    let uazInstances = { rows: [] };
    try {
      uazInstances = await tenantQuery(req, `
        SELECT uui.id as association_id, ui.id, ui.name, ui.phone_number as phone, ui.is_active
        FROM user_uaz_instances uui
        INNER JOIN uaz_instances ui ON uui.uaz_instance_id = ui.id
        WHERE uui.user_id = $1 AND uui.tenant_id = $2
        ORDER BY ui.name
      `, [userId, tenantId]);
    } catch (error) {
      console.log('⚠️ Tabela uaz_instances não encontrada ou sem dados');
    }

    res.json({
      success: true,
      apiAccounts: apiAccounts.rows,
      uazInstances: uazInstances.rows
    });
  } catch (error) {
    console.error('❌ Erro ao buscar contas do usuário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar contas do usuário',
      error: error.message
    });
  }
});

/**
 * GET /api/gestao/whatsapp-accounts/available
 * Buscar todas as contas WhatsApp disponíveis do tenant
 */
router.get('/whatsapp-accounts/available', async (req, res) => {
  try {
    const tenantId = req.tenant?.id;

    console.log(`🔍 [Gestão] Buscando contas disponíveis para tenant ${tenantId}`);

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant não identificado'
      });
    }

    // Buscar todas as contas API do tenant
    const apiAccounts = await tenantQuery(req, `
      SELECT id, name, phone_number, is_active
      FROM whatsapp_accounts
      WHERE tenant_id = $1
      ORDER BY name
    `, [tenantId]);

    console.log(`📱 [Gestão] Contas API encontradas: ${apiAccounts.rows.length}`);

    // Buscar todas as instâncias UAZ do tenant (se a tabela existir)
    let uazInstances = { rows: [] };
    try {
      // Primeiro, verificar TODAS as instâncias UAZ no sistema
      const allUazInstances = await tenantQuery(req, `
        SELECT id, name, tenant_id, phone_number as phone, is_active
        FROM uaz_instances
        ORDER BY tenant_id, name
      `);
      console.log(`🌍 [Gestão] TODAS instâncias QR no sistema: ${allUazInstances.rows.length}`);
      allUazInstances.rows.forEach(inst => {
        console.log(`   - ID: ${inst.id}, Nome: ${inst.name}, Tenant: ${inst.tenant_id}, Ativa: ${inst.is_active}`);
      });

      // Agora buscar apenas as do tenant atual
      uazInstances = await tenantQuery(req, `
        SELECT id, name, phone_number as phone, is_active
        FROM uaz_instances
        WHERE tenant_id = $1
        ORDER BY name
      `, [tenantId]);
      console.log(`🔗 [Gestão] Instâncias QR do tenant ${tenantId}: ${uazInstances.rows.length}`);
    } catch (error) {
      console.log('⚠️ Erro ao buscar instâncias UAZ:', error.message);
      console.error(error);
    }

    const response = {
      success: true,
      apiAccounts: apiAccounts.rows,
      uazInstances: uazInstances.rows
    };

    console.log(`✅ [Gestão] Retornando: ${apiAccounts.rows.length} API + ${uazInstances.rows.length} QR`);

    res.json(response);
  } catch (error) {
    console.error('❌ Erro ao buscar contas disponíveis:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar contas disponíveis',
      error: error.message
    });
  }
});

/**
 * POST /api/gestao/users/:userId/whatsapp-accounts
 * Associar contas WhatsApp a um usuário
 */
router.post('/users/:userId/whatsapp-accounts', async (req, res) => {
  try {
    const { userId } = req.params;
    const { apiAccountIds, uazInstanceIds } = req.body;
    const tenantId = req.tenant?.id;
    const userRole = req.user?.role;

    console.log(`🔗 Associando contas ao usuário ${userId} - TenantID: ${tenantId}`);

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant não identificado'
      });
    }

    if (userRole !== 'admin' && userRole !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado. Apenas administradores podem gerenciar associações.'
      });
    }

    // Verificar se o usuário pertence ao tenant
    const userCheck = await query(`
      SELECT id FROM tenant_users 
      WHERE id = $1 AND tenant_id = $2
    `, [userId, tenantId]);

    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    // Remover associações antigas
    await query(`DELETE FROM user_whatsapp_accounts WHERE user_id = $1 AND tenant_id = $2`, [userId, tenantId]);
    await query(`DELETE FROM user_uaz_instances WHERE user_id = $1 AND tenant_id = $2`, [userId, tenantId]);

    let apiCount = 0;
    let uazCount = 0;

    // Adicionar novas associações de contas API
    if (apiAccountIds && Array.isArray(apiAccountIds) && apiAccountIds.length > 0) {
      for (const accountId of apiAccountIds) {
        const id = parseInt(String(accountId), 10);
        if (!Number.isFinite(id) || id <= 0) continue;
        await query(`
          INSERT INTO user_whatsapp_accounts (tenant_id, user_id, whatsapp_account_id)
          VALUES ($1, $2, $3)
          ON CONFLICT (user_id, whatsapp_account_id) DO NOTHING
        `, [tenantId, userId, id]);
        apiCount++;
      }
    }

    // Adicionar novas associações de instâncias UAZ
    if (uazInstanceIds && Array.isArray(uazInstanceIds) && uazInstanceIds.length > 0) {
      for (const instanceId of uazInstanceIds) {
        const id = parseInt(String(instanceId), 10);
        if (!Number.isFinite(id) || id <= 0) continue;
        await query(`
          INSERT INTO user_uaz_instances (tenant_id, user_id, uaz_instance_id)
          VALUES ($1, $2, $3)
          ON CONFLICT (user_id, uaz_instance_id) DO NOTHING
        `, [tenantId, userId, id]);
        uazCount++;
      }
    }

    console.log(`✅ Associadas ${apiCount} contas API e ${uazCount} instâncias UAZ`);

    res.json({
      success: true,
      apiCount,
      uazCount,
      message: `${apiCount + uazCount} conta(s) associada(s) com sucesso`
    });
  } catch (error) {
    console.error('❌ Erro ao associar contas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao associar contas ao usuário',
      error: error.message
    });
  }
});

/**
 * DELETE /api/gestao/users/:userId/whatsapp-accounts/:accountId
 * Remover associação de uma conta específica
 */
router.delete('/users/:userId/whatsapp-accounts/:accountId', async (req, res) => {
  try {
    const { userId, accountId } = req.params;
    const { type } = req.query; // 'api' ou 'uaz'
    const tenantId = req.tenant?.id;
    const userRole = req.user?.role;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant não identificado'
      });
    }

    if (userRole !== 'admin' && userRole !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado.'
      });
    }

    if (type === 'uaz') {
      await query(`
        DELETE FROM user_uaz_instances 
        WHERE user_id = $1 AND uaz_instance_id = $2 AND tenant_id = $3
      `, [userId, accountId, tenantId]);
    } else {
      await query(`
        DELETE FROM user_whatsapp_accounts 
        WHERE user_id = $1 AND whatsapp_account_id = $2 AND tenant_id = $3
      `, [userId, accountId, tenantId]);
    }

    res.json({
      success: true,
      message: 'Associação removida com sucesso'
    });
  } catch (error) {
    console.error('❌ Erro ao remover associação:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao remover associação',
      error: error.message
    });
  }
});

module.exports = router;









