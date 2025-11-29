const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const tutorialsController = require('../../controllers/admin/tutorials.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { requireSuperAdmin } = require('../../middleware/super-admin.middleware');

// Configurar multer para upload de vídeos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../../../uploads/tutorials');
    
    // Criar diretório se não existir
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Nome único: timestamp + nome original
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const nameWithoutExt = path.basename(file.originalname, ext);
    cb(null, `${nameWithoutExt}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB limite
  },
  fileFilter: (req, file, cb) => {
    // Aceitar apenas vídeos
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos de vídeo são permitidos!'), false);
    }
  }
});

// Todas as rotas requerem autenticação e ser Super Admin
router.use(authenticate);
router.use(requireSuperAdmin);

// Listar todos os tutoriais
router.get('/', tutorialsController.getAllTutorials);

// Upload de tutorial
router.post('/upload', upload.single('video'), tutorialsController.uploadTutorial);

// Obter tutorial específico
router.get('/:id', tutorialsController.getTutorial);

// Atualizar tutorial
router.put('/:id', tutorialsController.updateTutorial);

// Deletar tutorial
router.delete('/:id', tutorialsController.deleteTutorial);

module.exports = router;

