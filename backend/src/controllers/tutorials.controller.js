const { query } = require('../database/connection');

// Listar tutoriais ativos para usuários
const getActiveTutorials = async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        id,
        titulo,
        descricao,
        filename,
        categoria,
        ordem,
        created_at
      FROM tutorial_videos
      WHERE ativo = true
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

// Stream de vídeo (para reprodução)
const streamVideo = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('🎥 [STREAM] Requisição de stream recebida para vídeo ID:', id);
    console.log('🎥 [STREAM] Headers de autenticação:', req.headers.authorization ? 'Token presente' : 'Token ausente');
    console.log('🎥 [STREAM] User autenticado:', req.user ? `ID ${req.user.id}` : 'Nenhum');

    const result = await query(
      'SELECT filepath, mime_type, file_size FROM tutorial_videos WHERE id = $1 AND ativo = true',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Vídeo não encontrado'
      });
    }

    const { filepath, mime_type, file_size } = result.rows[0];
    const fs = require('fs');
    const path = require('path');

    // Verificar se arquivo existe
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({
        success: false,
        message: 'Arquivo de vídeo não encontrado no servidor'
      });
    }

    const stat = fs.statSync(filepath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      // Suporte a streaming parcial (range requests)
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(filepath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': mime_type,
      };

      res.writeHead(206, head);
      file.pipe(res);
    } else {
      // Sem range, enviar arquivo completo
      const head = {
        'Content-Length': fileSize,
        'Content-Type': mime_type,
      };
      res.writeHead(200, head);
      fs.createReadStream(filepath).pipe(res);
    }
  } catch (error) {
    console.error('Erro ao fazer stream do vídeo:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao carregar vídeo',
      error: error.message
    });
  }
};

module.exports = {
  getActiveTutorials,
  streamVideo
};

