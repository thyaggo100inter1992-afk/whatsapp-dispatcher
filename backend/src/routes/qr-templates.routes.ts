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
import qrTemplateController from '../controllers/qr-template.controller';
const { checkTemplates } = require('../middlewares/check-feature.middleware');
const { checkTemplateLimit } = require('../middlewares/tenant-limits.middleware');

const router = express.Router();

// Aplicar verificação de funcionalidade em TODAS as rotas
router.use(checkTemplates);

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
 * DELETE /api/qr-templates/all
 * Deletar TODOS os templates QR
 */
router.delete('/all', qrTemplateController.deleteAll);

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
router.post('/', checkTemplateLimit, upload.array('files', 10), qrTemplateController.create);

/**
 * PUT /api/qr-templates/:id
 * Atualizar template
 * Body: { name, description, type, text_content, list_config, buttons_config, carousel_config }
 * Files: múltiplos arquivos (image, video, audio, document)
 */
router.put('/:id', upload.array('files', 10), qrTemplateController.update);

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

export default router;

