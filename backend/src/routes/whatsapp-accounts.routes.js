const express = require('express');
const router = express.Router();
const multer = require('multer');
const { checkWhatsAppLimit } = require('../middlewares/tenant-limits.middleware');
const { checkWhatsAppAPI } = require('../middlewares/check-feature.middleware');

// Configurar multer para armazenar arquivos em memória
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 16 * 1024 * 1024, // 16MB
    files: 1
  }
});

// Middleware de tratamento de erros do multer
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    console.error('❌ Erro do Multer:', err.message);
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        success: false, 
        error: 'Arquivo muito grande. Máximo: 16MB' 
      });
    }
    return res.status(400).json({ 
      success: false, 
      error: `Erro no upload: ${err.message}` 
    });
  }
  
  if (err) {
    console.error('❌ Erro no processamento do upload:', err.message);
    return res.status(500).json({ 
      success: false, 
      error: `Erro no processamento: ${err.message}` 
    });
  }
  
  next();
};

// Importar do arquivo compilado TypeScript
let WhatsAppAccountController;
let WhatsAppSettingsController;
let ProxyController;

try {
  WhatsAppAccountController = require('../controllers/whatsapp-account.controller').WhatsAppAccountController;
  WhatsAppSettingsController = require('../controllers/whatsapp-settings.controller').WhatsAppSettingsController;
  ProxyController = require('../controllers/proxy.controller').ProxyController;
} catch (e) {
  // Fallback para versão compilada
  WhatsAppAccountController = require('../../dist/controllers/whatsapp-account.controller').WhatsAppAccountController;
  WhatsAppSettingsController = require('../../dist/controllers/whatsapp-settings.controller').WhatsAppSettingsController;
  ProxyController = require('../../dist/controllers/proxy.controller').ProxyController;
}

const controller = new WhatsAppAccountController();
const settingsController = new WhatsAppSettingsController();
const proxyController = new ProxyController();

/**
 * Rotas de Contas WhatsApp
 */

// Listar todas as contas
router.get('/', (req, res) => controller.findAll(req, res));

// ⚠️ IMPORTANTE: Rotas específicas ANTES de rotas com parâmetros dinâmicos
// Buscar contas ativas
router.get('/active', (req, res) => controller.findActive(req, res));

// Buscar status e estatísticas de todas as contas
router.get('/status', (req, res) => controller.getAccountsStatus(req, res));

// Testar conexão com credenciais (sem salvar)
router.post('/test-connection', (req, res) => controller.testConnection(req, res));

// Buscar detalhes da conta por ID
router.get('/:id/details', (req, res) => controller.getAccountDetails(req, res));

// Buscar templates de uma conta específica
router.get('/:id/templates', (req, res) => controller.getTemplates(req, res));

// Middleware para debug antes do Multer
const debugRequest = (req, res, next) => {
  console.log('🔍 ===== DEBUG REQUEST =====');
  console.log('   Content-Type:', req.headers['content-type']);
  console.log('   Content-Length:', req.headers['content-length']);
  console.log('   Body:', req.body); // Pode ser undefined antes do Multer
  console.log('   Has file before multer:', !!req.file);
  next();
};

// Upload de mídia para template
router.post('/:id/upload-media', debugRequest, upload.single('media'), handleMulterError, (req, res) => {
  console.log('🔍 ===== APÓS MULTER =====');
  console.log('   Has file after multer:', !!req.file);
  console.log('   File details:', req.file ? `${req.file.originalname} (${req.file.size} bytes)` : 'NENHUM');
  console.log('   Body after multer:', req.body);
  controller.uploadMedia(req, res);
});

// Buscar perfil de negócio
router.get('/:id/profile', (req, res) => settingsController.getBusinessProfile(req, res));

// Atualizar perfil de negócio
router.post('/:id/profile', (req, res) => settingsController.updateBusinessProfile(req, res));

// Upload de foto de perfil
router.post('/:id/profile-photo', (req, res) => settingsController.uploadProfilePhoto(req, res));

// Teste de upload de foto de perfil (experimental)
router.post('/:id/test-profile-photo-upload', (req, res) => settingsController.testProfilePhotoUpload(req, res));

// Testar permissões da conta
router.get('/:id/test-permissions', (req, res) => settingsController.testPermissions(req, res));

// Configurar PIN de verificação em duas etapas
router.post('/:id/two-step-pin', (req, res) => settingsController.setTwoStepPin(req, res));

// Analytics da conta
router.get('/:id/analytics', (req, res) => settingsController.getAnalytics(req, res));

// Gerar QR Code
router.get('/:id/qrcode', (req, res) => settingsController.getQRCode(req, res));

// Health check da conta
router.get('/:id/health', (req, res) => settingsController.checkHealth(req, res));

// Integração com Facebook
router.post('/:id/facebook-integration', (req, res) => settingsController.configureFacebookIntegration(req, res));

// Dados de cobrança do Facebook
router.get('/:id/facebook-billing', (req, res) => settingsController.getFacebookBilling(req, res));

// Proxy - Buscar configuração
router.get('/:id/proxy', (req, res) => proxyController.getProxyConfig(req, res));

// Proxy - Atualizar/Criar configuração
router.post('/:id/proxy', (req, res) => proxyController.updateProxyConfig(req, res));

// Proxy - Testar configuração
router.post('/:id/proxy/test', (req, res) => proxyController.testProxyConfig(req, res));

// Proxy - Deletar configuração
router.delete('/:id/proxy', (req, res) => proxyController.deleteProxyConfig(req, res));

// Ativar/Desativar conta
router.patch('/:id/toggle', (req, res) => controller.toggleActive(req, res));

// Buscar conta por ID
router.get('/:id', (req, res) => controller.findById(req, res));

// Criar nova conta
router.post('/', checkWhatsAppAPI, checkWhatsAppLimit, (req, res) => controller.create(req, res));

// Atualizar conta
router.put('/:id', (req, res) => controller.update(req, res));

// Deletar conta
router.delete('/:id', (req, res) => controller.delete(req, res));

// Desativar múltiplas contas
router.post('/deactivate-multiple', (req, res) => controller.deactivateMultiple(req, res));

// Desativar todas as contas
router.post('/deactivate-all', (req, res) => controller.deactivateAll(req, res));

// Ativar múltiplas contas
router.post('/activate-multiple', (req, res) => controller.activateMultiple(req, res));

// Ativar todas as contas
router.post('/activate-all', (req, res) => controller.activateAll(req, res));

// 🔼🔽 Reordenação de contas
router.post('/:id/move-up', (req, res) => controller.moveUp(req, res));
router.post('/:id/move-down', (req, res) => controller.moveDown(req, res));

module.exports = router;



