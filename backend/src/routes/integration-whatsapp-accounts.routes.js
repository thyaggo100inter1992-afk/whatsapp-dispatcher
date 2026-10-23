/**
 * API de integração — gestão completa de contas WhatsApp (API Oficial).
 * Mesmas funções das telas Configurações / Editar / Configurar Conta.
 * Auth: chave nsk_ (X-Api-Key / Bearer).
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { checkWhatsAppLimit } = require('../middlewares/tenant-limits.middleware');

let checkWhatsAppAPI;
try {
  checkWhatsAppAPI = require('../middlewares/check-feature.middleware').checkWhatsAppAPI;
} catch (e) {
  try {
    checkWhatsAppAPI = require('../../dist/middlewares/check-feature.middleware').checkWhatsAppAPI;
  } catch {
    checkWhatsAppAPI = (_req, _res, next) => next();
  }
}

const uploadMedia = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 16 * 1024 * 1024, files: 1 },
});

const profileUploadDir = path.join(__dirname, '../../uploads/profile-photos');
if (!fs.existsSync(profileUploadDir)) {
  fs.mkdirSync(profileUploadDir, { recursive: true });
}

const uploadProfile = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, profileUploadDir),
    filename: (_req, file, cb) => {
      const safe = String(file.originalname || 'photo').replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, `${Date.now()}-${safe}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

function loadController(srcPath, distPath, exportName) {
  try {
    return require(srcPath)[exportName];
  } catch (e) {
    return require(distPath)[exportName];
  }
}

const WhatsAppAccountController = loadController(
  '../controllers/whatsapp-account.controller',
  '../../dist/controllers/whatsapp-account.controller',
  'WhatsAppAccountController'
);
const WhatsAppSettingsController = loadController(
  '../controllers/whatsapp-settings.controller',
  '../../dist/controllers/whatsapp-settings.controller',
  'WhatsAppSettingsController'
);
const ProxyController = loadController(
  '../controllers/proxy.controller',
  '../../dist/controllers/proxy.controller',
  'ProxyController'
);
const ProxyManagerController = loadController(
  '../controllers/proxy-manager.controller',
  '../../dist/controllers/proxy-manager.controller',
  'ProxyManagerController'
);
const WebhookController = loadController(
  '../controllers/webhook.controller',
  '../../dist/controllers/webhook.controller',
  'WebhookController'
);

const accounts = new WhatsAppAccountController();
const settings = new WhatsAppSettingsController();
const accountProxy = new ProxyController();
const proxies = new ProxyManagerController();
const webhook = new WebhookController();

const router = express.Router();

const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, error: 'Arquivo muito grande. Máximo: 16MB' });
    }
    return res.status(400).json({ success: false, error: `Erro no upload: ${err.message}` });
  }
  if (err) {
    return res.status(500).json({ success: false, error: err.message || 'Erro no upload' });
  }
  next();
};

// ---------- Proxies (dropdown da tela Editar) ----------
router.get('/proxies/active', (req, res) => proxies.listActive(req, res));
router.get('/proxies', (req, res) => proxies.listAll(req, res));
router.get('/proxies/:id', (req, res) => proxies.findById(req, res));
router.post('/proxies', (req, res) => proxies.create(req, res));
router.put('/proxies/:id', (req, res) => proxies.update(req, res));
router.delete('/proxies/:id', (req, res) => proxies.delete(req, res));
router.post('/proxies/:id/test', (req, res) => proxies.test(req, res));

// ---------- Webhook (aba Webhooks) ----------
router.get('/webhook/config', (req, res) => webhook.getConfig(req, res));
router.get('/webhook/stats', (req, res) => webhook.getStats(req, res));
router.get('/webhook/logs', (req, res) => webhook.getLogs(req, res));
router.get('/webhook/status', (req, res) => webhook.getStatus(req, res));
router.get('/webhook/status-batch', (req, res) => webhook.getStatusBatch(req, res));

// ---------- Contas — listagem / card ----------
router.get('/whatsapp-accounts', (req, res) => accounts.findAll(req, res));
router.get('/whatsapp-accounts/active', (req, res) => accounts.findActive(req, res));
router.get('/whatsapp-accounts/status', (req, res) => accounts.getAccountsStatus(req, res));
router.post('/whatsapp-accounts/test-connection', (req, res) => accounts.testConnection(req, res));
router.post('/whatsapp-accounts/subscribe-webhooks-all', (req, res) => accounts.subscribeAllWebhooks(req, res));
router.post('/whatsapp-accounts/remove-proxies', (req, res) => accountProxy.removeProxiesBulk(req, res));
router.post('/whatsapp-accounts/deactivate-multiple', (req, res) => accounts.deactivateMultiple(req, res));
router.post('/whatsapp-accounts/activate-multiple', (req, res) => accounts.activateMultiple(req, res));
router.post('/whatsapp-accounts/deactivate-all', (req, res) => accounts.deactivateAll(req, res));
router.post('/whatsapp-accounts/activate-all', (req, res) => accounts.activateAll(req, res));

// ---------- Contas — criar / editar / excluir ----------
router.post(
  '/whatsapp-accounts',
  checkWhatsAppAPI,
  checkWhatsAppLimit,
  (req, res) => accounts.create(req, res)
);
router.get('/whatsapp-accounts/:id', (req, res) => accounts.findById(req, res));
router.put('/whatsapp-accounts/:id', (req, res) => accounts.update(req, res));
router.delete('/whatsapp-accounts/:id', (req, res) => accounts.delete(req, res));
router.patch('/whatsapp-accounts/:id/toggle', (req, res) => accounts.toggleActive(req, res));
router.post('/whatsapp-accounts/:id/move-up', (req, res) => accounts.moveUp(req, res));
router.post('/whatsapp-accounts/:id/move-down', (req, res) => accounts.moveDown(req, res));

// ---------- Contas — card / Meta / webhook ----------
router.get('/whatsapp-accounts/:id/details', (req, res) => accounts.getAccountDetails(req, res));
router.get('/whatsapp-accounts/:id/meta-app', (req, res) => accounts.getMetaApp(req, res));
router.post('/whatsapp-accounts/:id/meta-app', (req, res) => accounts.updateMetaApp(req, res));
router.post('/whatsapp-accounts/:id/subscribe-webhook', (req, res) => accounts.subscribeWebhook(req, res));
router.get('/whatsapp-accounts/:id/webhook-fields', (req, res) => accounts.getWebhookFieldsStatus(req, res));
router.post('/whatsapp-accounts/:id/webhook-fields/resubscribe', (req, res) =>
  accounts.resubscribeWebhookFields(req, res)
);
router.get('/whatsapp-accounts/:id/templates', (req, res) => accounts.getTemplates(req, res));
router.post(
  '/whatsapp-accounts/:id/upload-media',
  uploadMedia.single('media'),
  handleMulterError,
  (req, res) => accounts.uploadMedia(req, res)
);

// ---------- Configurar conta — Perfil ----------
router.get('/whatsapp-accounts/:id/profile', (req, res) => settings.getBusinessProfile(req, res));
router.post('/whatsapp-accounts/:id/profile', (req, res) => settings.updateBusinessProfile(req, res));
router.post(
  '/whatsapp-accounts/:id/profile-photo',
  uploadProfile.single('photo'),
  handleMulterError,
  (req, res) => settings.uploadProfilePhoto(req, res)
);
router.post(
  '/whatsapp-accounts/:id/test-profile-photo-upload',
  uploadProfile.single('photo'),
  handleMulterError,
  (req, res) => settings.testProfilePhotoUpload(req, res)
);
router.get('/whatsapp-accounts/:id/test-permissions', (req, res) => settings.testPermissions(req, res));

// ---------- Segurança ----------
router.post('/whatsapp-accounts/:id/two-step-pin', (req, res) => settings.setTwoStepPin(req, res));

// ---------- Financeiro / Avançado ----------
router.get('/whatsapp-accounts/:id/analytics', (req, res) => settings.getAnalytics(req, res));
router.get('/whatsapp-accounts/:id/qrcode', (req, res) => settings.getQRCode(req, res));
router.get('/whatsapp-accounts/:id/health', (req, res) => settings.checkHealth(req, res));
router.post('/whatsapp-accounts/:id/facebook-integration', (req, res) =>
  settings.configureFacebookIntegration(req, res)
);
router.get('/whatsapp-accounts/:id/facebook-billing', (req, res) => settings.getFacebookBilling(req, res));

// ---------- Proxy da conta ----------
router.get('/whatsapp-accounts/:id/proxy', (req, res) => accountProxy.getProxyConfig(req, res));
router.post('/whatsapp-accounts/:id/proxy', (req, res) => accountProxy.updateProxyConfig(req, res));
router.post('/whatsapp-accounts/:id/proxy/test', (req, res) => accountProxy.testProxyConfig(req, res));
router.delete('/whatsapp-accounts/:id/proxy', (req, res) => accountProxy.deleteProxyConfig(req, res));

module.exports = router;
