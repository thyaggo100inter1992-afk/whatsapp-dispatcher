const { query } = require('../../database/connection');
const fs = require('fs');
const path = require('path');

/**
 * Controller para gerenciar screenshots da landing page
 */

/**
 * POST /api/admin/screenshots/upload
 * Upload de screenshot
 */
exports.uploadScreenshot = async (req, res) => {
  try {
    console.log('📸 [SCREENSHOT] Iniciando upload...');
    console.log('📸 [SCREENSHOT] Headers:', req.headers['content-type']);
    console.log('📸 [SCREENSHOT] Body:', req.body);
    console.log('📸 [SCREENSHOT] File:', req.file);

    if (!req.file) {
      console.log('❌ [SCREENSHOT] Nenhum arquivo recebido');
      return res.status(400).json({
        success: false,
        message: 'Nenhum arquivo enviado'
      });
    }

    const { titulo, descricao, ordem } = req.body;
    const filename = req.file.filename;
    const filepath = `/uploads/screenshots/${filename}`;

    console.log('📸 [SCREENSHOT] Salvando no banco:', { filename, filepath, titulo, descricao, ordem });

    // Salvar no banco
    const result = await query(`
      INSERT INTO landing_screenshots (filename, path, titulo, descricao, ordem)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [filename, filepath, titulo || null, descricao || null, ordem || 0]);

    console.log('✅ Screenshot salvo:', filename);

    res.json({
      success: true,
      message: 'Screenshot enviado com sucesso',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('❌ Erro ao fazer upload de screenshot:', error);
    console.error('❌ Stack:', error.stack);
    
    // Se der erro, deletar o arquivo
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
        console.log('🗑️  Arquivo deletado após erro:', req.file.filename);
      } catch (e) {
        console.error('Erro ao deletar arquivo:', e);
      }
    }

    res.status(500).json({
      success: false,
      message: 'Erro ao fazer upload',
      error: error.message
    });
  }
};

/**
 * GET /api/admin/screenshots
 * Listar todos os screenshots
 */
exports.listScreenshots = async (req, res) => {
  try {
    const result = await query(`
      SELECT * FROM landing_screenshots
      WHERE ativo = true
      ORDER BY ordem ASC, created_at DESC
    `);

    res.json({
      success: true,
      data: result.rows,
      total: result.rows.length
    });

  } catch (error) {
    console.error('❌ Erro ao listar screenshots:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao listar screenshots',
      error: error.message
    });
  }
};

/**
 * DELETE /api/admin/screenshots/:id
 * Deletar screenshot
 */
exports.deleteScreenshot = async (req, res) => {
  try {
    const { id } = req.params;

    // Buscar screenshot
    const screenshot = await query(
      'SELECT * FROM landing_screenshots WHERE id = $1',
      [id]
    );

    if (screenshot.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Screenshot não encontrado'
      });
    }

    const file = screenshot.rows[0];

    // Deletar do banco
    await query('DELETE FROM landing_screenshots WHERE id = $1', [id]);

    // Deletar arquivo físico
    try {
      const filePath = path.join(__dirname, '../../../uploads/screenshots', file.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (err) {
      console.error('Erro ao deletar arquivo físico:', err);
    }

    console.log('✅ Screenshot deletado:', file.filename);

    res.json({
      success: true,
      message: 'Screenshot deletado com sucesso'
    });

  } catch (error) {
    console.error('❌ Erro ao deletar screenshot:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao deletar screenshot',
      error: error.message
    });
  }
};

/**
 * PUT /api/admin/screenshots/:id/ordem
 * Atualizar ordem do screenshot
 */
exports.updateScreenshotOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { ordem } = req.body;

    if (ordem === undefined || ordem === null) {
      return res.status(400).json({
        success: false,
        message: 'Ordem é obrigatória'
      });
    }

    await query(
      'UPDATE landing_screenshots SET ordem = $1, updated_at = NOW() WHERE id = $2',
      [ordem, id]
    );

    console.log(`✅ Ordem atualizada para screenshot ${id}: ${ordem}`);

    res.json({
      success: true,
      message: 'Ordem atualizada com sucesso'
    });

  } catch (error) {
    console.error('❌ Erro ao atualizar ordem:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar ordem',
      error: error.message
    });
  }
};

/**
 * GET /api/public/screenshots
 * Listar screenshots públicos (para landing page)
 */
exports.getPublicScreenshots = async (req, res) => {
  try {
    const result = await query(`
      SELECT id, path, titulo, descricao, ordem
      FROM landing_screenshots
      WHERE ativo = true
      ORDER BY ordem ASC, created_at DESC
    `);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('❌ Erro ao buscar screenshots públicos:', error);
    res.json({
      success: true,
      data: [] // Retornar vazio em caso de erro
    });
  }
};

