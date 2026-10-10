import { Router } from 'express';
import { IntegrationController } from '../controllers/integration.controller';
import { publicImageUpload, savePublicImage } from '../controllers/public-image.controller';
import { authenticateIntegrationKey } from '../middleware/integration-auth.middleware';

const multer = require('multer');

const { authenticate } = require('../middleware/auth.middleware');
const { setTenantContext } = require('../middleware/tenant.middleware');

const router = Router();
const controller = new IntegrationController();

router.use(controller.cors.bind(controller));
router.options('*', controller.cors.bind(controller));

// Gestão de chaves (login do painel)
router.get('/keys', authenticate, setTenantContext, controller.listKeys.bind(controller));
router.post('/keys', authenticate, setTenantContext, controller.createKey.bind(controller));
router.delete('/keys/:id', authenticate, setTenantContext, controller.revokeKey.bind(controller));

// API pública do sistema de vendas (chave nsk_)
router.post('/v1/auth', authenticateIntegrationKey, controller.auth.bind(controller));
router.get('/v1/users', authenticateIntegrationKey, controller.users.bind(controller));
router.get('/v1/connections', authenticateIntegrationKey, controller.connections.bind(controller));
router.get('/v1/oficial/:id/templates', authenticateIntegrationKey, controller.oficialTemplates.bind(controller));
router.post('/v1/oficial/send', authenticateIntegrationKey, controller.oficialSend.bind(controller));
router.get('/v1/qr/templates', authenticateIntegrationKey, controller.qrTemplates.bind(controller));
router.get('/v1/qr/templates/:id', authenticateIntegrationKey, controller.qrTemplateById.bind(controller));
router.post('/v1/qr/send', authenticateIntegrationKey, controller.qrSend.bind(controller));
router.post('/v1/images', authenticateIntegrationKey, (req, res, next) => {
  const contentType = String(req.headers['content-type'] || '');
  if (!contentType.includes('multipart/form-data')) return next();
  publicImageUpload(req, res, (err: any) => {
    if (!err) return next();
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, error: 'Imagem muito grande. Tamanho máximo: 8MB.' });
    }
    return res.status(400).json({ success: false, error: err.message || 'Não foi possível receber a imagem.' });
  });
}, savePublicImage);

export default router;
