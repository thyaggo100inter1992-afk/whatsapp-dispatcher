/**
 * ============================================
 * CONTROLLER: Configurações do Sistema
 * ============================================
 * Gerencia configurações globais do sistema
 * (logo, cores, nome, etc)
 * ============================================
 */

const { query } = require('../../database/connection');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

// ============================================
// Configuração do Multer para Upload de Logo
// ============================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../../uploads/system');
    // Criar diretório se não existir (síncrono)
    const fsSync = require('fs');
    if (!fsSync.existsSync(uploadDir)) {
      fsSync.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'logo-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|svg|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Apenas imagens são permitidas (jpg, png, gif, svg, webp)'));
    }
  }
});

// ============================================
// BUSCAR TODAS AS CONFIGURAÇÕES
// ============================================
const getAllSettings = async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        id,
        setting_key,
        setting_value,
        setting_type,
        description,
        is_public,
        updated_at
      FROM system_settings
      ORDER BY setting_key
    `);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('❌ Erro ao buscar configurações:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar configurações',
      error: error.message
    });
  }
};

// ============================================
// BUSCAR CONFIGURAÇÕES PÚBLICAS (sem autenticação)
// ============================================
const getPublicSettings = async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        setting_key,
        setting_value,
        setting_type
      FROM system_settings
      WHERE is_public = true
    `);
    
    // Converter para objeto chave-valor
    const settings = {};
    result.rows.forEach(row => {
      let value = row.setting_value;
      
      // Converter tipos
      if (row.setting_type === 'boolean') {
        value = value === 'true';
      } else if (row.setting_type === 'number') {
        value = parseFloat(value);
      } else if (row.setting_type === 'json') {
        try {
          value = JSON.parse(value);
        } catch (e) {
          value = null;
        }
      }
      
      settings[row.setting_key] = value;
    });
    
    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('❌ Erro ao buscar configurações públicas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar configurações',
      error: error.message
    });
  }
};

// ============================================
// ATUALIZAR CONFIGURAÇÃO (ou criar se não existir)
// ============================================
const updateSetting = async (req, res) => {
  try {
    const { key, value } = req.body;
    
    if (!key) {
      return res.status(400).json({
        success: false,
        message: 'Chave da configuração é obrigatória'
      });
    }
    
    // Tentar atualizar primeiro
    let result = await query(`
      UPDATE system_settings
      SET setting_value = $1, updated_at = NOW()
      WHERE setting_key = $2
      RETURNING *
    `, [value, key]);
    
    // Se não existir, criar (WhatsApp configs são públicas)
    if (result.rows.length === 0) {
      console.log(`📝 Configuração não existe, criando: ${key}`);
      const isPublic = key.startsWith('landing_'); // Configurações da landing são públicas
      result = await query(`
        INSERT INTO system_settings (setting_key, setting_value, setting_type, description, is_public)
        VALUES ($1, $2, 'string', 'Configuração automática', $3)
        RETURNING *
      `, [key, value, isPublic]);
    }
    
    console.log(`✅ Configuração salva: ${key} = ${value}`);
    
    res.json({
      success: true,
      message: 'Configuração salva com sucesso',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Erro ao atualizar configuração:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar configuração',
      error: error.message
    });
  }
};

// ============================================
// CRIAR NOVA CONFIGURAÇÃO
// ============================================
const createSetting = async (req, res) => {
  try {
    const { key, value, type, description, is_public } = req.body;
    
    if (!key) {
      return res.status(400).json({
        success: false,
        message: 'Chave da configuração é obrigatória'
      });
    }
    
    const result = await query(`
      INSERT INTO system_settings (setting_key, setting_value, setting_type, description, is_public)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (setting_key) DO UPDATE
      SET setting_value = $2, updated_at = NOW()
      RETURNING *
    `, [key, value || '', type || 'string', description || '', is_public !== false]);
    
    console.log(`✅ Configuração criada/atualizada: ${key}`);
    
    res.json({
      success: true,
      message: 'Configuração criada com sucesso',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Erro ao criar configuração:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao criar configuração',
      error: error.message
    });
  }
};

// ============================================
// UPLOAD DE LOGO
// ============================================
const uploadLogo = async (req, res) => {
  try {
    console.log('📥 Upload de logo - req.file:', req.file);
    console.log('📥 Upload de logo - req.body:', req.body);
    
    if (!req.file) {
      console.error('❌ Nenhum arquivo recebido no req.file');
      return res.status(400).json({
        success: false,
        message: 'Nenhum arquivo enviado'
      });
    }
    
    const logoUrl = `/uploads/system/${req.file.filename}`;
    
    // Buscar logo antiga para deletar
    const oldLogoResult = await query(`
      SELECT setting_value FROM system_settings WHERE setting_key = 'system_logo'
    `);
    
    const oldLogoUrl = oldLogoResult.rows[0]?.setting_value;
    
    // Atualizar no banco
    const result = await query(`
      UPDATE system_settings
      SET setting_value = $1, updated_at = NOW()
      WHERE setting_key = 'system_logo'
      RETURNING *
    `, [logoUrl]);
    
    // Deletar logo antiga (se existir)
    if (oldLogoUrl && oldLogoUrl !== logoUrl) {
      try {
        const oldFilePath = path.join(__dirname, '../../../', oldLogoUrl);
        await fs.unlink(oldFilePath);
        console.log('🗑️ Logo antiga deletada:', oldLogoUrl);
      } catch (err) {
        console.log('⚠️ Não foi possível deletar logo antiga:', err.message);
      }
    }
    
    console.log('✅ Logo do sistema atualizada:', logoUrl);
    
    res.json({
      success: true,
      message: 'Logo atualizada com sucesso',
      data: {
        logoUrl: logoUrl,
        filename: req.file.filename
      }
    });
  } catch (error) {
    console.error('❌ Erro ao fazer upload da logo:', error);
    
    // Deletar arquivo se houver erro
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (err) {
        console.error('Erro ao deletar arquivo:', err);
      }
    }
    
    res.status(500).json({
      success: false,
      message: 'Erro ao fazer upload da logo',
      error: error.message
    });
  }
};

// ============================================
// REMOVER LOGO
// ============================================
const removeLogo = async (req, res) => {
  try {
    // Buscar logo atual
    const result = await query(`
      SELECT setting_value FROM system_settings WHERE setting_key = 'system_logo'
    `);
    
    const logoUrl = result.rows[0]?.setting_value;
    
    if (!logoUrl) {
      return res.json({
        success: true,
        message: 'Nenhuma logo para remover'
      });
    }
    
    // Deletar arquivo físico
    try {
      const filePath = path.join(__dirname, '../../../', logoUrl);
      await fs.unlink(filePath);
      console.log('🗑️ Arquivo de logo deletado:', logoUrl);
    } catch (err) {
      console.log('⚠️ Não foi possível deletar arquivo:', err.message);
    }
    
    // Atualizar banco (setar como NULL)
    await query(`
      UPDATE system_settings
      SET setting_value = NULL, updated_at = NOW()
      WHERE setting_key = 'system_logo'
    `);
    
    console.log('✅ Logo do sistema removida');
    
    res.json({
      success: true,
      message: 'Logo removida com sucesso'
    });
  } catch (error) {
    console.error('❌ Erro ao remover logo:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao remover logo',
      error: error.message
    });
  }
};

// ============================================
// BUSCAR APENAS A LOGO (PÚBLICO - SEM AUTH)
// ============================================
const getLogoOnly = async (req, res) => {
  try {
    const result = await query(`
      SELECT setting_value 
      FROM system_settings 
      WHERE setting_key = 'system_logo'
    `);
    
    const logoUrl = result.rows[0]?.setting_value || null;
    
    res.json({
      success: true,
      logo: logoUrl
    });
  } catch (error) {
    console.error('❌ Erro ao buscar logo:', error);
    res.json({
      success: false,
      logo: null
    });
  }
};

module.exports = {
  getAllSettings,
  getPublicSettings,
  updateSetting,
  createSetting,
  uploadLogo,
  removeLogo,
  getLogoOnly,
  upload
};

