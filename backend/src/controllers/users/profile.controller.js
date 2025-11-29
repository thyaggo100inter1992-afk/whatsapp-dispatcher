const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs').promises;
const { query } = require('../../database/connection');
const { queryNoTenant } = require('../../database/tenant-query');

/**
 * Obter dados do perfil do usuário
 */
const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const tenantId = req.tenant.id;

    const result = await query(
      `SELECT id, nome, email, role, avatar, telefone, documento, created_at, updated_at 
       FROM tenant_users 
       WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
    }

    const user = result.rows[0];

    // Buscar dados do tenant
    const tenantResult = await query(
      `SELECT id, nome, email, telefone, documento 
       FROM tenants 
       WHERE id = $1`,
      [tenantId]
    );

    const tenant = tenantResult.rows[0] || null;

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          nome: user.nome,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
          telefone: user.telefone,
          documento: user.documento,
          created_at: user.created_at,
          updated_at: user.updated_at
        },
        tenant: tenant
      }
    });
  } catch (error) {
    console.error('❌ Erro ao obter perfil:', error);
    res.status(500).json({ success: false, message: 'Erro ao obter perfil do usuário' });
  }
};

/**
 * Atualizar dados do perfil (nome e telefone - email e documento não podem ser alterados)
 */
const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { nome, telefone } = req.body;

    // Validações
    if (!nome || nome.trim() === '') {
      return res.status(400).json({ success: false, message: 'Nome é obrigatório' });
    }

    // Atualizar dados (apenas nome e telefone)
    const result = await query(
      `UPDATE tenant_users 
       SET nome = $1, telefone = $2, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $3 
       RETURNING id, nome, email, role, avatar, telefone, documento, created_at, updated_at`,
      [nome, telefone, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
    }

    const updatedUser = result.rows[0];

    res.json({
      success: true,
      message: 'Perfil atualizado com sucesso',
      data: {
        id: updatedUser.id,
        nome: updatedUser.nome,
        email: updatedUser.email,
        role: updatedUser.role,
        avatar: updatedUser.avatar,
        telefone: updatedUser.telefone,
        documento: updatedUser.documento,
        created_at: updatedUser.created_at,
        updated_at: updatedUser.updated_at
      }
    });
  } catch (error) {
    console.error('❌ Erro ao atualizar perfil:', error);
    res.status(500).json({ success: false, message: 'Erro ao atualizar perfil' });
  }
};

/**
 * Alterar senha
 */
const changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    // Validações
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ success: false, message: 'Todos os campos são obrigatórios' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'As senhas não coincidem' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'A nova senha deve ter no mínimo 6 caracteres' });
    }

    // Buscar usuário e verificar senha atual
    const result = await query('SELECT senha_hash FROM tenant_users WHERE id = $1', [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
    }

    const user = result.rows[0];

    // Verificar senha atual
    const isPasswordValid = await bcrypt.compare(currentPassword, user.senha_hash);

    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Senha atual incorreta' });
    }

    // Criptografar nova senha
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Atualizar senha
    await query(
      'UPDATE tenant_users SET senha_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [hashedPassword, userId]
    );

    res.json({
      success: true,
      message: 'Senha alterada com sucesso'
    });
  } catch (error) {
    console.error('❌ Erro ao alterar senha:', error);
    res.status(500).json({ success: false, message: 'Erro ao alterar senha' });
  }
};

/**
 * Upload de avatar
 */
const uploadAvatar = async (req, res) => {
  try {
    const userId = req.user.id;

    if (!req.files || !req.files.avatar) {
      return res.status(400).json({ success: false, message: 'Nenhuma imagem foi enviada' });
    }

    const avatar = req.files.avatar;

    // Validar tipo de arquivo
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(avatar.mimetype)) {
      return res.status(400).json({ success: false, message: 'Formato de imagem inválido. Use: JPG, PNG, GIF ou WEBP' });
    }

    // Validar tamanho (max 5MB)
    if (avatar.size > 5 * 1024 * 1024) {
      return res.status(400).json({ success: false, message: 'A imagem deve ter no máximo 5MB' });
    }

    // Criar diretório de uploads se não existir
    const uploadsDir = path.join(__dirname, '../../../uploads/avatars');
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

    // Obter avatar anterior para deletar
    const userResult = await query('SELECT avatar FROM tenant_users WHERE id = $1', [userId]);
    const oldAvatar = userResult.rows[0]?.avatar;

    // Deletar avatar antigo se existir
    if (oldAvatar && oldAvatar !== filename) {
      const oldFilepath = path.join(uploadsDir, oldAvatar);
      try {
        await fs.unlink(oldFilepath);
      } catch (err) {
        // Arquivo não existe ou erro ao deletar, não é crítico
      }
    }

    // Atualizar no banco de dados
    await query(
      'UPDATE tenant_users SET avatar = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [filename, userId]
    );

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
    res.status(500).json({ success: false, message: 'Erro ao fazer upload do avatar' });
  }
};

/**
 * Remover avatar
 */
const removeAvatar = async (req, res) => {
  try {
    const userId = req.user.id;

    // Obter avatar atual
    const result = await query('SELECT avatar FROM tenant_users WHERE id = $1', [userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
    }

    const avatar = result.rows[0].avatar;

    // Deletar arquivo se existir
    if (avatar) {
      const filepath = path.join(__dirname, '../../../uploads/avatars', avatar);
      try {
        await fs.unlink(filepath);
      } catch (err) {
        // Arquivo não existe, não é crítico
      }
    }

    // Remover do banco de dados
    await query(
      'UPDATE tenant_users SET avatar = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [userId]
    );

    res.json({
      success: true,
      message: 'Avatar removido com sucesso'
    });
  } catch (error) {
    console.error('❌ Erro ao remover avatar:', error);
    res.status(500).json({ success: false, message: 'Erro ao remover avatar' });
  }
};

/**
 * Atualizar dados do tenant (apenas admin)
 */
const updateTenant = async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const userRole = req.user.role;
    const { nome, email, telefone, documento } = req.body;

    console.log('🔄 Atualizando dados do tenant ID:', tenantId);
    console.log('📝 Dados recebidos:', { nome, email, telefone, documento });

    // Verificar se o usuário é admin
    if (userRole !== 'admin' && userRole !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Apenas administradores podem editar dados da empresa' });
    }

    // Validações
    if (!nome || nome.trim() === '') {
      return res.status(400).json({ success: false, message: 'Nome da empresa é obrigatório' });
    }

    // Atualizar TODOS os dados do tenant (usar queryNoTenant pois tenants não tem RLS)
    const result = await queryNoTenant(
      `UPDATE tenants 
       SET nome = $1, email = $2, telefone = $3, documento = $4, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $5 
       RETURNING id, nome, email, telefone, documento, updated_at`,
      [nome, email, telefone, documento, tenantId]
    );

    if (result.rows.length === 0) {
      console.error('❌ Tenant não encontrado ID:', tenantId);
      return res.status(404).json({ success: false, message: 'Empresa não encontrada' });
    }

    const updatedTenant = result.rows[0];
    console.log('✅ Tenant atualizado com sucesso:', updatedTenant);

    res.json({
      success: true,
      message: 'Dados da empresa atualizados com sucesso',
      data: updatedTenant
    });
  } catch (error) {
    console.error('❌ Erro ao atualizar dados do tenant:', error);
    res.status(500).json({ success: false, message: 'Erro ao atualizar dados da empresa' });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  updateTenant,
  changePassword,
  uploadAvatar,
  removeAvatar
};

