const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configurar multer para upload de arquivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/media');
    
    // Criar diretório se não existir
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `media-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
    files: 1 // Apenas 1 arquivo por vez
  },
  fileFilter: (req, file, cb) => {
    console.log('📁 Validando arquivo:');
    console.log(`   Nome: ${file.originalname}`);
    console.log(`   Tipo MIME: ${file.mimetype}`);
    
    // Aceitar todos os tipos de arquivo de mídia
    const allowedExtensions = /jpeg|jpg|png|gif|webp|mp4|avi|mov|mp3|wav|ogg|pdf|doc|docx|xls|xlsx/i;
    const ext = path.extname(file.originalname).toLowerCase();
    const isValidExtension = allowedExtensions.test(ext);
    
    // Lista de tipos MIME permitidos
    const allowedMimeTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/avi', 'video/quicktime',
      'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg',
      'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    const isValidMimeType = allowedMimeTypes.includes(file.mimetype);
    
    if (isValidExtension || isValidMimeType) {
      console.log('✅ Arquivo aceito');
      return cb(null, true);
    } else {
      console.log('❌ Arquivo rejeitado - tipo não suportado');
      cb(new Error(`Tipo de arquivo não suportado: ${file.mimetype}`));
    }
  }
});

/**
 * POST /api/upload/media
 * Upload de arquivo de mídia (imagem, vídeo, áudio, documento)
 * Retorna: { url: string } - URL do arquivo enviado
 */
router.post('/media', (req, res, next) => {
  console.log('📥 Recebida requisição de upload:');
  console.log(`   Content-Type: ${req.headers['content-type']}`);
  console.log(`   Tenant ID: ${req.tenant?.id || 'N/A'}`);
  
  upload.single('file')(req, res, (err) => {
    if (err) {
      console.error('❌ Erro no multer:', err);
      
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            error: 'Arquivo muito grande. Tamanho máximo: 100MB'
          });
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return res.status(400).json({
            success: false,
            error: 'Campo de arquivo inesperado. Use o campo "file"'
          });
        }
        return res.status(400).json({
          success: false,
          error: `Erro no upload: ${err.message}`
        });
      }
      
      return res.status(400).json({
        success: false,
        error: err.message || 'Erro desconhecido no upload'
      });
    }
    
    if (!req.file) {
      console.log('⚠️ Nenhum arquivo foi recebido');
      return res.status(400).json({
        success: false,
        error: 'Nenhum arquivo foi enviado. Certifique-se de usar o campo "file"'
      });
    }

    try {
      console.log('✅ Upload de arquivo realizado com sucesso:');
      console.log(`   ├─ Nome: ${req.file.originalname}`);
      console.log(`   ├─ Tamanho: ${(req.file.size / 1024).toFixed(2)} KB`);
      console.log(`   ├─ MIME: ${req.file.mimetype}`);
      console.log(`   └─ Caminho: /uploads/media/${req.file.filename}`);

      // Retornar URL relativa do arquivo
      const fileUrl = `/uploads/media/${req.file.filename}`;
      
      res.json({
        success: true,
        url: fileUrl, // ✅ Direto na raiz para acesso via uploadResponse.data.url
        filename: req.file.filename,
        originalname: req.file.originalname,
        original_name: req.file.originalname, // ← Alias com underscore
        size: req.file.size,
        mimetype: req.file.mimetype,
        mime_type: req.file.mimetype, // ← Alias com underscore para compatibilidade
        path: fileUrl // ← Adicionar path para compatibilidade
      });
    } catch (error) {
      console.error('❌ Erro ao processar resposta:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
});

module.exports = router;

