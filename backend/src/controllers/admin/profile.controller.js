const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs').promises;
const { query } = require('../../database/connection');

/**
 * Obter perfil do Super Admin
 */
const getSuperAdminProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await query(
      `SELECT id, nome, email, role, avatar, created_at, updated_at 
       FROM tenant_users 
       WHERE id = $1 AND role = 'super_admin'`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Super Admin não encontrado' });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Erro ao obter perfil do Super Admin:', error);
    res.status(500).json({ success: false, message: 'Erro ao obter perfil' });
  }
};

/**
 * Atualizar perfil do Super Admin (nome, email, senha)
 */
const updateSuperAdminProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { nome, email, telefone, current_password, new_password } = req.body;

    // Validações
    if (!nome || nome.trim() === '') {
      return res.status(400).json({ success: false, message: 'Nome é obrigatório' });
    }

    if (!email || email.trim() === '') {
      return res.status(400).json({ success: false, message: 'Email é obrigatório' });
    }

    // Verificar se é Super Admin
    const checkAdmin = await query(
      'SELECT role FROM tenant_users WHERE id = $1',
      [userId]
    );

    if (checkAdmin.rows.length === 0 || checkAdmin.rows[0].role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Acesso negado' });
    }

    // Verificar se email já está em uso por outro usuário
    const emailCheck = await query(
      'SELECT id FROM tenant_users WHERE email = $1 AND id != $2',
      [email, userId]
    );

    if (emailCheck.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'Email já está em uso' });
    }

    // Preparar atualização
    let updateQuery = `
      UPDATE tenant_users 
      SET nome = $1, email = $2, telefone = $3, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $4 
      RETURNING id, nome, email, role, avatar, telefone, created_at, updated_at
    `;
    let params = [nome, email, telefone || null, userId];

    // Se estiver alterando senha
    if (new_password) {
      if (!current_password) {
        return res.status(400).json({ 
          success: false, 
          message: 'A senha atual é obrigatória para alterar a senha' 
        });
      }

      if (new_password.length < 6) {
        return res.status(400).json({ 
          success: false, 
          message: 'A nova senha deve ter no mínimo 6 caracteres' 
        });
      }

      // Verificar senha atual
      const userResult = await query(
        'SELECT senha_hash FROM tenant_users WHERE id = $1',
        [userId]
      );

      const isPasswordValid = await bcrypt.compare(
        current_password, 
        userResult.rows[0].senha_hash
      );

      if (!isPasswordValid) {
        return res.status(401).json({ 
          success: false, 
          message: 'Senha atual incorreta' 
        });
      }

      // Hash da nova senha
      const hashedPassword = await bcrypt.hash(new_password, 10);

      // Atualizar com nova senha
      updateQuery = `
        UPDATE tenant_users 
        SET nome = $1, email = $2, telefone = $3, senha_hash = $4, updated_at = CURRENT_TIMESTAMP 
        WHERE id = $5 
        RETURNING id, nome, email, role, avatar, telefone, created_at, updated_at
      `;
      params = [nome, email, telefone || null, hashedPassword, userId];
    }

    // Executar atualização
    const result = await query(updateQuery, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Super Admin não encontrado' });
    }

    console.log(`✅ Perfil do Super Admin ${userId} atualizado com sucesso`);

    res.json({
      success: true,
      message: 'Perfil atualizado com sucesso',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Erro ao atualizar perfil do Super Admin:', error);
    res.status(500).json({ success: false, message: 'Erro ao atualizar perfil' });
  }
};

/**
 * Upload de avatar do Super Admin
 */
const uploadSuperAdminAvatar = async (req, res) => {
  try {
    const userId = req.user.id;

    if (!req.files || !req.files.avatar) {
      return res.status(400).json({ success: false, message: 'Nenhuma imagem foi enviada' });
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

    console.log(`✅ Avatar do Super Admin ${userId} atualizado com sucesso`);

    res.json({
      success: true,
      message: 'Avatar atualizado com sucesso',
      data: {
        avatar: filename,
        avatarUrl: `/uploads/avatars/${filename}`
      }
    });
  } catch (error) {
    console.error('❌ Erro ao fazer upload do avatar do Super Admin:', error);
    res.status(500).json({ success: false, message: 'Erro ao fazer upload do avatar' });
  }
};

module.exports = {
  getSuperAdminProfile,
  updateSuperAdminProfile,
  uploadSuperAdminAvatar
};

