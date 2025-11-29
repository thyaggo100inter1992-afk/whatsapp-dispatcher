const { query } = require('../../database/connection');
const fs = require('fs');
const path = require('path');

// Listar todos os tutoriais (ADMIN)
const getAllTutorials = async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        id,
        titulo,
        descricao,
        filename,
        filepath,
        file_size,
        mime_type,
        duracao,
        categoria,
        ordem,
        ativo,
        uploaded_by,
        created_at,
        updated_at
      FROM tutorial_videos
      ORDER BY ordem ASC, created_at DESC
    `);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Erro ao listar tutoriais:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao listar tutoriais',
      error: error.message
    });
  }
};

// Upload de vídeo tutorial
const uploadTutorial = async (req, res) => {
  try {
    console.log('📤 [TUTORIAL] Iniciando upload...');
    console.log('📤 [TUTORIAL] req.file:', req.file);
    console.log('📤 [TUTORIAL] req.body:', req.body);
    
    if (!req.file) {
      console.log('❌ [TUTORIAL] Nenhum arquivo recebido');
      return res.status(400).json({
        success: false,
        message: 'Nenhum arquivo foi enviado'
      });
    }

    const { titulo, descricao, categoria, ordem, ativo } = req.body;
    const userId = req.user?.id || null;

    if (!titulo) {
      // Deletar arquivo se validação falhar
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        message: 'Título é obrigatório'
      });
    }

    // Validar tipo de arquivo (apenas vídeos)
    if (!req.file.mimetype.startsWith('video/')) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        message: 'Apenas arquivos de vídeo são permitidos'
      });
    }

    console.log('📤 [TUTORIAL] Inserindo no banco...');
    console.log('📤 [TUTORIAL] Parâmetros:', {
      titulo,
      descricao,
      filename: req.file.filename,
      filepath: req.file.path,
      file_size: req.file.size,
      mime_type: req.file.mimetype,
      categoria,
      ordem: parseInt(ordem) || 0,
      ativo: ativo === 'true' || ativo === true,
      userId
    });
    
    const result = await query(`
      INSERT INTO tutorial_videos 
        (titulo, descricao, filename, filepath, file_size, mime_type, categoria, ordem, ativo, uploaded_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      titulo,
      descricao || null,
      req.file.filename,
      req.file.path,
      req.file.size,
      req.file.mimetype,
      categoria || null,
      parseInt(ordem) || 0,
      ativo === 'true' || ativo === true,
      userId
    ]);
    
    console.log('✅ [TUTORIAL] Upload concluído com sucesso!');

    res.json({
      success: true,
      message: 'Vídeo tutorial enviado com sucesso!',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ [TUTORIAL] Erro ao fazer upload de tutorial:', error);
    console.error('❌ [TUTORIAL] Stack:', error.stack);
    
    // Deletar arquivo se houver erro
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
        console.log('🗑️ [TUTORIAL] Arquivo deletado após erro');
      } catch (unlinkError) {
        console.error('❌ [TUTORIAL] Erro ao deletar arquivo:', unlinkError);
      }
    }

    res.status(500).json({
      success: false,
      message: 'Erro ao fazer upload do tutorial',
      error: error.message
    });
  }
};

// Atualizar tutorial
const updateTutorial = async (req, res) => {
  try {
    const { id } = req.params;
    const { titulo, descricao, categoria, ordem, ativo } = req.body;

    const result = await query(`
      UPDATE tutorial_videos 
      SET 
        titulo = COALESCE($1, titulo),
        descricao = COALESCE($2, descricao),
        categoria = COALESCE($3, categoria),
        ordem = COALESCE($4, ordem),
        ativo = COALESCE($5, ativo),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING *
    `, [titulo, descricao, categoria, ordem, ativo, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tutorial não encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Tutorial atualizado com sucesso!',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Erro ao atualizar tutorial:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar tutorial',
      error: error.message
    });
  }
};

// Deletar tutorial
const deleteTutorial = async (req, res) => {
  try {
    const { id } = req.params;

    // Buscar informações do arquivo
    const fileResult = await query(
      'SELECT filepath FROM tutorial_videos WHERE id = $1',
      [id]
    );

    if (fileResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tutorial não encontrado'
      });
    }

    const filepath = fileResult.rows[0].filepath;

    // Deletar do banco
    await query('DELETE FROM tutorial_videos WHERE id = $1', [id]);

    // Deletar arquivo físico
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }

    res.json({
      success: true,
      message: 'Tutorial deletado com sucesso!'
    });
  } catch (error) {
    console.error('Erro ao deletar tutorial:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao deletar tutorial',
      error: error.message
    });
  }
};

// Obter tutorial específico
const getTutorial = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(`
      SELECT *
      FROM tutorial_videos
      WHERE id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tutorial não encontrado'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Erro ao buscar tutorial:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar tutorial',
      error: error.message
    });
  }
};

module.exports = {
  getAllTutorials,
  uploadTutorial,
  updateTutorial,
  deleteTutorial,
  getTutorial
};

