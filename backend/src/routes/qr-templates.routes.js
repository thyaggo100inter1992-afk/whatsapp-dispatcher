/**
 * ============================================
 * ROTAS - TEMPLATES QR CONNECT
 * ============================================
 * Rotas para gerenciamento de templates
 * do WhatsApp QR Connect
 * ============================================
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import qrTemplateController from '../controllers/qr-template.controller.js';

const router = express.Router();

// Configurar multer para upload de arquivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/temp'); // Temporário, será movido depois
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB
  },
  fileFilter: (req, file, cb) => {
    // Aceitar todos os tipos de arquivo
    cb(null, true);
  }
});

// ============================================
// ROTAS
// ============================================

/**
 * GET /api/qr-templates
 * Listar todos os templates
 */
router.get('/', qrTemplateController.list);

/**
 * GET /api/qr-templates/:id
 * Buscar template por ID
 */
router.get('/:id', qrTemplateController.getById);

/**
 * POST /api/qr-templates
 * Criar novo template
 * Body: { name, description, type, text_content, list_config, buttons_config, carousel_config }
 * Files: múltiplos arquivos (image, video, audio, document)
 */
router.post('/', (req, res, next) => {
  const contentType = req.headers['content-type'] || '';
  
  // Se for JSON, não precisa de Multer
  if (contentType.includes('application/json')) {
    console.log('📝 [CREATE] Requisição JSON - pulando Multer');
    req.files = []; // Garantir que files existe mas está vazio
    return next();
  }
  
  // Se for FormData, usar Multer com tratamento de erro
  if (contentType.includes('multipart/form-data')) {
    const multerMiddleware = upload.array('files', 10);
    multerMiddleware(req, res, (err) => {
      if (err) {
        // Se for erro de "Unexpected end of form", ignorar
        if (err.message && err.message.includes('Unexpected end of form')) {
          console.log('⚠️ [CREATE] Multer encontrou FormData sem arquivos - continuando sem arquivos');
          req.files = [];
          return next();
        }
        // Outros erros do Multer
        console.error('❌ [CREATE] Erro no Multer:', err);
        return res.status(400).json({
          success: false,
          error: 'Erro no upload de arquivos',
          details: err.message
        });
      }
      next();
    });
  } else {
    next();
  }
}, qrTemplateController.create);

/**
 * PUT /api/qr-templates/:id
 * Atualizar template
 * Body: { name, description, type, text_content, list_config, buttons_config, carousel_config }
 * Files: múltiplos arquivos (image, video, audio, document)
 */
router.put('/:id', (req, res, next) => {
  const contentType = req.headers['content-type'] || '';
  
  // Se for JSON, não precisa de Multer
  if (contentType.includes('application/json')) {
    console.log('📝 [UPDATE] Requisição JSON - pulando Multer');
    req.files = [];
    return next();
  }
  
  // Se for FormData, usar Multer com tratamento de erro
  if (contentType.includes('multipart/form-data')) {
    const multerMiddleware = upload.array('files', 10);
    multerMiddleware(req, res, (err) => {
      if (err) {
        // Se for erro de "Unexpected end of form", ignorar
        if (err.message && err.message.includes('Unexpected end of form')) {
          console.log('⚠️ [UPDATE] Multer encontrou FormData sem arquivos - continuando sem arquivos');
          req.files = [];
          return next();
        }
        // Outros erros do Multer
        console.error('❌ [UPDATE] Erro no Multer:', err);
        return res.status(400).json({
          success: false,
          error: 'Erro no upload de arquivos',
          details: err.message
        });
      }
      next();
    });
  } else {
    next();
  }
}, qrTemplateController.update);

/**
 * DELETE /api/qr-templates/:id
 * Deletar template
 */
router.delete('/:id', qrTemplateController.delete);

/**
 * DELETE /api/qr-templates/:templateId/media/:mediaId
 * Deletar arquivo de mídia específico
 */
router.delete('/:templateId/media/:mediaId', qrTemplateController.deleteMedia);

module.exports = router;

