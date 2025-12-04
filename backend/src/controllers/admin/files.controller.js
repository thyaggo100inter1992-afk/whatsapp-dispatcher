const { query } = require('../../database/connection');
const path = require('path');
const fs = require('fs').promises;

/**
 * Controller para Gerenciamento de Arquivos Públicos (Super Admin)
 */

/**
 * POST /api/admin/files/upload
 * Upload de arquivo público
 */
const uploadFile = async (req, res) => {
  try {
    console.log('📤 [UPLOAD] Iniciando upload...');
    console.log('   Headers:', JSON.stringify(req.headers, null, 2));
    console.log('   req.files:', req.files);
    console.log('   req.body:', req.body);
    
    if (!req.files || !req.files.file) {
      console.log('❌ [UPLOAD] Nenhum arquivo detectado!');
      return res.status(400).json({
        success: false,
        message: 'Nenhum arquivo foi enviado'
      });
    }

    const file = req.files.file;
    const { description = '' } = req.body || {}; // ✅ Fallback para req.body undefined

    console.log(`📤 Upload de arquivo: ${file.name}`);

    // Criar diretório se não existir
    const uploadDir = path.join(__dirname, '../../uploads/public-files');
    await fs.mkdir(uploadDir, { recursive: true });

    // Gerar nome único
    const timestamp = Date.now();
    const uniqueFilename = `${timestamp}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const filePath = path.join(uploadDir, uniqueFilename);

    // Mover arquivo
    await file.mv(filePath);

    // URL pública
    const fileUrl = `/uploads/public-files/${uniqueFilename}`;

    console.log(`✅ Arquivo salvo: ${filePath}`);

    // Salvar informações no banco de dados
    const result = await query(`
      INSERT INTO public_files (
        filename,
        original_filename,
        file_path,
        file_url,
        mime_type,
        file_size,
        description,
        uploaded_by,
        tenant_id,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      RETURNING *
    `, [
      uniqueFilename,
      file.name,
      filePath,
      fileUrl,
      file.mimetype,
      file.size,
      description || null,
      req.user?.id || null,
      req.user?.tenant_id || null
    ]);

    console.log(`✅ Arquivo enviado: ${result.rows[0].original_filename}`);

    res.json({
      success: true,
      message: 'Arquivo enviado com sucesso',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Erro ao fazer upload:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao fazer upload do arquivo',
      error: error.message
    });
  }
};

/**
 * GET /api/admin/files
 * Listar todos os arquivos públicos
 */
const getAllFiles = async (req, res) => {
  try {
    console.log('📋 Listando arquivos públicos...');

    const result = await query(`
      SELECT 
        pf.*,
        u.nome as uploaded_by_name,
        u.email as uploaded_by_email
      FROM public_files pf
      LEFT JOIN tenant_users u ON pf.uploaded_by = u.id
      ORDER BY pf.created_at DESC
    `);

    console.log(`✅ ${result.rows.length} arquivos encontrados`);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('❌ Erro ao listar arquivos:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao listar arquivos',
      error: error.message
    });
  }
};

/**
 * DELETE /api/admin/files/:id
 * Deletar arquivo público
 */
const deleteFile = async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`🗑️ Deletando arquivo ID: ${id}`);

    // Buscar informações do arquivo
    const fileResult = await query('SELECT * FROM public_files WHERE id = $1', [id]);

    if (fileResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Arquivo não encontrado'
      });
    }

    const file = fileResult.rows[0];

    // Deletar arquivo físico
    try {
      await fs.unlink(file.file_path);
      console.log(`✅ Arquivo físico deletado: ${file.file_path}`);
    } catch (fsError) {
      console.warn(`⚠️ Erro ao deletar arquivo físico (continuando): ${fsError.message}`);
    }

    // Deletar do banco de dados
    await query('DELETE FROM public_files WHERE id = $1', [id]);

    console.log(`✅ Arquivo deletado do banco: ${file.original_filename}`);

    res.json({
      success: true,
      message: 'Arquivo deletado com sucesso'
    });
  } catch (error) {
    console.error('❌ Erro ao deletar arquivo:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao deletar arquivo',
      error: error.message
    });
  }
};

/**
 * PUT /api/admin/files/:id
 * Atualizar descrição do arquivo
 */
const updateFile = async (req, res) => {
  try {
    const { id } = req.params;
    const { description } = req.body;

    console.log(`📝 Atualizando arquivo ID: ${id}`);

    const result = await query(
      'UPDATE public_files SET description = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [description, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Arquivo não encontrado'
      });
    }

    console.log(`✅ Arquivo atualizado: ${result.rows[0].original_filename}`);

    res.json({
      success: true,
      message: 'Arquivo atualizado com sucesso',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Erro ao atualizar arquivo:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar arquivo',
      error: error.message
    });
  }
};

module.exports = {
  uploadFile,
  getAllFiles,
  deleteFile,
  updateFile
};



