import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { bulkProfileController } from '../controllers/bulk-profile.controller';

const router = Router();

const logoDir = path.join(__dirname, '../../uploads/bulk-logos');
if (!fs.existsSync(logoDir)) {
  fs.mkdirSync(logoDir, { recursive: true });
}

const uploadLogo = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, logoDir),
    filename: (_req, file, cb) => {
      const safe = String(file.originalname || 'logo.jpg').replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, `bulk-${Date.now()}-${safe}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ok = ['image/jpeg', 'image/jpg', 'image/png'].includes(file.mimetype);
    if (ok) cb(null, true);
    else cb(new Error('Logo deve ser JPG ou PNG'));
  },
});

function parseJsonBody(req: any, _res: any, next: any) {
  // multipart envia JSON como string nos campos
  try {
    if (typeof req.body?.account_ids === 'string') {
      req.body.account_ids = JSON.parse(req.body.account_ids);
    }
    if (typeof req.body?.profile_data === 'string') {
      req.body.profile_data = JSON.parse(req.body.profile_data);
    }
    if (typeof req.body?.fields_to_update === 'string') {
      req.body.fields_to_update = JSON.parse(req.body.fields_to_update);
    }
  } catch (e: any) {
    return _res.status(400).json({ success: false, error: 'JSON inválido nos campos do formulário' });
  }
  next();
}

// Configurar intervalo da fila
router.post('/queue/interval', (req, res) => bulkProfileController.setQueueInterval(req, res));

// Obter status da fila
router.get('/queue/status', (req, res) => bulkProfileController.getQueueStatus(req, res));

// Obter falhas recentes
router.get('/queue/failures', (req, res) => bulkProfileController.getRecentFailures(req, res));

// Re-tentar item que falhou
router.post('/queue/retry/:historyId', (req, res) => bulkProfileController.retryFailedItem(req, res));

// Preview de atualização em massa
router.post('/preview', (req, res) => bulkProfileController.previewBulkUpdate(req, res));

// Atualizar perfis em massa (aceita logo opcional em multipart)
router.post(
  '/update',
  (req, res, next) => {
    uploadLogo.single('logo')(req, res, (err: any) => {
      if (err) {
        return res.status(400).json({ success: false, error: err.message || 'Erro no upload da logo' });
      }
      next();
    });
  },
  parseJsonBody,
  (req, res) => bulkProfileController.updateBulkProfiles(req, res)
);

export default router;
