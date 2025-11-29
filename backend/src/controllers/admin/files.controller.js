const { query } = require('../../database/connection');
const { cloudinaryService } = require('../../services/cloudinary.service');

/**
 * Controller para Gerenciamento de Arquivos Públicos (Super Admin)
 */

/**
 * POST /api/admin/files/upload
 * Upload de arquivo público
 */
const uploadFile = async (req, res) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({
        success: false,
        message: 'Nenhum arquivo foi enviado'
      });
    }

    const file = req.files.file;
    const { description } = req.body;

    console.log(`📤 Upload de arquivo: ${file.name}`);

    // Determinar o tipo de recurso baseado no mimetype
    let resourceType = 'auto';
    if (file.mimetype.startsWith('image/')) {
      resourceType = 'image';
    } else if (file.mimetype.startsWith('video/')) {
      resourceType = 'video';
    } else if (file.mimetype === 'application/pdf') {
      resourceType = 'image'; // Cloudinary aceita PDF como image
    } else {
      resourceType = 'raw'; // Para outros tipos
    }

    // Upload para Cloudinary
    const uploadResult = await cloudinaryService.uploadFile(file.tempFilePath, {
      folder: 'public-files',
      resource_type: resourceType
    });

    // Salvar informações no banco de dados
    const result = await query(`
      INSERT INTO public_files (
        original_name,
        cloudinary_id,
        cloudinary_url,
        secure_url,
        file_type,
        file_size,
        mime_type,
        description,
        uploaded_by,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      RETURNING *
    `, [
      file.name,
      uploadResult.public_id,
      uploadResult.url,
      uploadResult.secure_url,
      resourceType,
      file.size,
      file.mimetype,
      description || null,
      req.user.id
    ]);

    console.log(`✅ Arquivo enviado: ${result.rows[0].original_name}`);

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

    // Deletar do Cloudinary
    try {
      await cloudinaryService.deleteFile(file.cloudinary_id, {
        resource_type: file.file_type
      });
      console.log(`✅ Arquivo deletado do Cloudinary: ${file.cloudinary_id}`);
    } catch (cloudinaryError) {
      console.warn(`⚠️ Erro ao deletar do Cloudinary (continuando): ${cloudinaryError.message}`);
    }

    // Deletar do banco de dados
    await query('DELETE FROM public_files WHERE id = $1', [id]);

    console.log(`✅ Arquivo deletado do banco: ${file.original_name}`);

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

    console.log(`✅ Arquivo atualizado: ${result.rows[0].original_name}`);

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



