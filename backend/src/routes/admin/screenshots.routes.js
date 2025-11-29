const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const screenshotsController = require('../../controllers/admin/screenshots.controller');

// Criar diretório de screenshots se não existir
const screenshotsDir = path.join(__dirname, '../../../uploads/screenshots');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

// Configurar multer para upload de screenshots
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, screenshotsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'screenshot-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: function (req, file, cb) {
    const filetypes = /jpeg|jpg|png|gif|webp/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Apenas imagens são permitidas (JPEG, PNG, GIF, WebP)'));
  }
});

/**
 * Rotas de Screenshots da Landing Page (Super Admin)
 * Base: /api/admin/screenshots
 * Todas as rotas requerem autenticação + super_admin
 */

// Middleware de tratamento de erros do Multer
const handleMulterError = (err, req, res, next) => {
  console.error('❌ [MULTER ERROR]:', err);
  
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'Arquivo muito grande. Tamanho máximo: 5MB'
      });
    }
    return res.status(400).json({
      success: false,
      message: `Erro no upload: ${err.message}`
    });
  }
  
  if (err) {
    return res.status(400).json({
      success: false,
      message: err.message || 'Erro ao fazer upload do arquivo'
    });
  }
  
  next();
};

// POST /api/admin/screenshots/upload - Upload de screenshot
router.post('/upload', 
  (req, res, next) => {
    console.log('📸 [ROUTE] Recebendo upload de screenshot...');
    next();
  },
  upload.single('screenshot'), 
  handleMulterError,
  screenshotsController.uploadScreenshot
);

// GET /api/admin/screenshots - Listar screenshots
router.get('/', screenshotsController.listScreenshots);

// PUT /api/admin/screenshots/:id/ordem - Atualizar ordem
router.put('/:id/ordem', screenshotsController.updateScreenshotOrder);

// DELETE /api/admin/screenshots/:id - Deletar screenshot
router.delete('/:id', screenshotsController.deleteScreenshot);

module.exports = router;

