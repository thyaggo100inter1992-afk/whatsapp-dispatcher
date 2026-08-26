import { Router } from 'express';
import { templateAnalyzerController } from '../controllers/template-analyzer.controller';

// Import middleware de autenticação e tenant
const { authenticate } = require('../middleware/auth.middleware');
const { requireSuperAdmin } = require('../middleware/super-admin.middleware');
const { setTenantContext } = require('../middleware/tenant.middleware');

// Import de TODAS as rotas usando CommonJS para compatibilidade com tsx watch
const authRoutes = require('./auth.routes').default;
const qrTemplatesRoutes = require('./qr-templates.routes').default;
const qrCampaignsRoutes = require('./qr-campaigns.routes').default;
const qrWebhookRoutes = require('./qr-webhook.routes').default;
const baseDadosRoutes = require('./baseDados').default;
const profileRoutes = require('./users/profile.routes');
const featuresRoutes = require('./features.routes');
const notificationsRoutes = require('./notifications.routes');
const uazRoutes = require('./uaz');
const novaVidaRoutes = require('./novaVida');
const listaRestricaoRoutes = require('./listaRestricao');

// Rotas principais (API Oficial)
const whatsappAccountsRoutes = require('./whatsapp-accounts.routes');
const campaignsRoutes = require('./campaigns.routes');
const messagesRoutes = require('./messages.routes');
const proxiesRoutes = require('./proxies.routes');
const templatesRoutes = require('./template.routes').default;
const webhookRoutes = require('./webhook.routes');
const restrictionListsRoutes = require('./restriction-lists.routes');
const dashboardRoutes = require('./dashboard.routes');
const buttonClicksRoutes = require('./button-clicks.routes').default;
const bulkProfileRoutes = require('./bulk-profile.routes').default;

// Import rotas de pagamentos
const paymentsRoutes = require('./payments.routes').default;
const consultasAvulsasRoutes = require('./consultas-avulsas.routes').default;

// Import rotas de conversas (chat)
const conversationsRoutes = require('./conversations.routes').default;

// Import rotas de email marketing
const emailMarketingRoutes = require('./email-marketing.routes').default;
const adminMailgunCredentialsRoutes = require('./admin/mailgun-credentials.routes').default;
const adminSendgridCredentialsRoutes = require('./admin/sendgrid-credentials.routes').default;
const adminNettEnviosCredentialsRoutes = require('./admin/nettsistemasenvios-credentials.routes').default;

// Import rotas de administração
const adminTenantsRoutes = require('./admin/tenants.routes');
const adminPlansRoutes = require('./admin/plans.routes');
const adminLogsRoutes = require('./admin/logs.routes');
const adminSystemLogsRoutes = require('./admin/system-logs.routes');
const adminFilesRoutes = require('./admin/files.routes');
const adminCredentialsRoutes = require('./admin/credentials.routes');
const adminEmailAccountsRoutes = require('./admin/email-accounts.routes');
const adminCommunicationsRoutes = require('./admin/communications.routes');
const adminPacotesConsultasRoutes = require('./admin/pacotes-consultas.routes').default;
const adminFaixasPrecoConsultasRoutes = require('./admin/faixas-preco-consultas.routes').default;
const adminProfileRoutes = require('./admin/profile.routes');
const adminSystemSettingsRoutes = require('./admin/system-settings.routes');
const adminTutorialsRoutes = require('./admin/tutorials.routes');
const adminRelatoriosFinanceirosRoutes = require('./admin/relatorios-financeiros.routes').default;
const adminEmailTemplatesRoutes = require('./admin/email-templates.routes');

// Import rotas de logs de atividade
const activityLogsRoutes = require('./logs/activity.routes');

// Import rotas de upload
const uploadRoutes = require('./upload.routes');

// Import rotas de diagnóstico de credenciais
const diagnosticCredentialsRoutes = require('./diagnostic-credentials');

// Import rotas de tutoriais (para usuários)
const tutorialsRoutes = require('./tutorials.routes');

const router = Router();

// ============================================
// ROTAS PÚBLICAS (SEM AUTENTICAÇÃO)
// ============================================

// Landing Page Pública
const landingRoutes = require('./public/landing.routes');
router.use('/public/landing', landingRoutes);

const institucionalPublicRoutes = require('./public/institucional-public.routes').default;
router.use('/public/institucional', institucionalPublicRoutes);
console.log('✅ Rota /public/institucional registrada (opt-in institucional)');
console.log('✅ Rotas de landing page pública registradas (sem autenticação)');

// API de integração (sistema de vendas) — chave nsk_ + gestão de chaves no painel
const integrationRoutes = require('./integration.routes').default;
router.use('/integration', integrationRoutes);
console.log('✅ Rota /integration registrada (API + iframe do sistema de vendas)');

// API Pública - Lista de Restrição (autenticação por email+senha no body)
const restrictionListPublicRoutes = require('./public/restriction-list-public.routes');
router.use('/public/restriction-list', restrictionListPublicRoutes);
console.log('✅ Rota /public/restriction-list registrada (token do tenant ou email+senha)');

// API Pública - Verificação de WhatsApp (1 número + foto)
const whatsappVerifyPublicRoutes = require('./public/whatsapp-verify-public.routes');
router.use('/public/whatsapp', whatsappVerifyPublicRoutes);
console.log('✅ Rota /public/whatsapp registrada (token do tenant ou email+senha)');

const novavidaPublicRoutes = require('./public/novavida-public.routes');
router.use('/public/novavida', novavidaPublicRoutes);
console.log('✅ Rota /public/novavida registrada (consulta CPF/CNPJ com token do tenant)');

// Screenshots públicos
const { getPublicScreenshots } = require('../controllers/admin/screenshots.controller');
router.get('/public/screenshots', getPublicScreenshots);
console.log('✅ Rota /public/screenshots registrada (sem autenticação)');

// Logo pública (sem autenticação)
const { getLogoOnly } = require('../controllers/admin/system-settings.controller');
router.get('/public/logo', getLogoOnly);
console.log('✅ Rota /public/logo registrada (sem autenticação)');

router.use('/system-settings', adminSystemSettingsRoutes);
console.log('✅ Rota /system-settings/public registrada (pública)');

// Rotas de pagamentos (inclui webhook público e rotas privadas)
router.use('/payments', paymentsRoutes);
console.log('✅ Rotas de pagamentos registradas (webhook público + rotas autenticadas)');

// Rotas de consultas avulsas (com autenticação)
router.use('/consultas-avulsas', consultasAvulsasRoutes);
console.log('✅ Rotas de consultas avulsas registradas (requer autenticação)');

// ============================================
// ROTAS DE AUTENTICAÇÃO (NOVAS - SEM MIDDLEWARE)
// ============================================
router.use('/auth', authRoutes);

// ============================================
// ROTAS DE UPLOAD (COM AUTENTICAÇÃO)
// ============================================
router.use('/upload', authenticate, uploadRoutes);
console.log('✅ Rota /upload registrada (requer autenticação)');

// ============================================
// ROTAS DE LOGS DE ATIVIDADE (AUTENTICAÇÃO OPCIONAL)
// ============================================
// Middleware que tenta autenticar mas não falha se não houver token
const optionalAuth = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    authenticate(req, res, next);
  } else {
    next();
  }
};
router.use('/logs', optionalAuth, activityLogsRoutes);
console.log('✅ Rota /logs registrada (autenticação opcional)');

// ============================================
// ROTAS DE PERFIL DO USUÁRIO (COM AUTENTICAÇÃO E TENANT CONTEXT)
// ============================================
router.use('/users/profile', authenticate, setTenantContext, profileRoutes);
console.log('✅ Rota /users/profile registrada (requer autenticação + tenant context)');

// ============================================
// ROTAS DE FUNCIONALIDADES/FEATURES (COM AUTENTICAÇÃO E TENANT CONTEXT)
// ============================================
router.use('/features', authenticate, setTenantContext, featuresRoutes);
console.log('✅ Rota /features registrada (requer autenticação + tenant context)');

router.use('/notifications', authenticate, setTenantContext, notificationsRoutes);
console.log('✅ Rota /notifications registrada (requer autenticação + tenant context)');

// ============================================
// ROTAS PRINCIPAIS (API OFICIAL - COM AUTENTICAÇÃO)
// ============================================
router.use('/whatsapp-accounts', authenticate, whatsappAccountsRoutes);
router.use('/campaigns', authenticate, campaignsRoutes);
router.use('/messages', authenticate, messagesRoutes);
router.use('/proxies', authenticate, proxiesRoutes);
router.use('/templates', authenticate, templatesRoutes);
router.use('/webhook', webhookRoutes); // PÚBLICO - autenticação aplicada internamente apenas nas rotas protegidas
router.use('/restriction-lists', authenticate, restrictionListsRoutes);
router.use('/dashboard', authenticate, dashboardRoutes);
router.use('/button-clicks', authenticate, buttonClicksRoutes);
router.use('/bulk-profile', authenticate, bulkProfileRoutes);

// Rotas de permissões
const permissionsRoutes = require('./permissions.routes');
router.use('/permissions', authenticate, permissionsRoutes);
console.log('✅ Rotas de permissões registradas');

// Rotas de gestão para admins do tenant
const gestaoRoutes = require('./gestao.routes');
router.use('/gestao', authenticate, gestaoRoutes);
console.log('✅ Rotas de gestão do tenant registradas');

// Rotas de conversas (chat)
router.use('/conversations', authenticate, setTenantContext, conversationsRoutes);
console.log('✅ Rotas de conversas (chat) registradas');

// Rotas de email marketing (por tenant)
router.use('/email-marketing', authenticate, setTenantContext, emailMarketingRoutes);
console.log('✅ Rotas de Email Marketing registradas (por tenant)');

console.log('✅ Rotas principais registradas (WhatsApp API Oficial)');

// ============================================
// ROTAS EXISTENTES (QR CONNECT E OUTRAS)
// ============================================

// UAZ API
router.use('/uaz', authenticate, uazRoutes);

// Nova Vida (com e sem hífen para compatibilidade)
router.use('/novavida', authenticate, novaVidaRoutes);
router.use('/nova-vida', authenticate, novaVidaRoutes);

// Lista de Restrição
router.use('/lista-restricao', authenticate, listaRestricaoRoutes);

// Base de Dados
router.use('/base-dados', authenticate, baseDadosRoutes);

// QR Code / WhatsApp Web
router.use('/qr-templates', authenticate, setTenantContext, qrTemplatesRoutes);
router.use('/qr-campaigns', authenticate, setTenantContext, qrCampaignsRoutes);
router.use('/qr-webhook', qrWebhookRoutes); // PÚBLICO - webhooks externos
console.log('✅ Rotas QR Connect e auxiliares registradas');

// Template Analyzer - Descobrir formato correto para templates com mídia
console.log('📍 Registrando rotas do Template Analyzer...');

// Health check
router.get('/template-analyzer/health', (req, res) => {
  console.log('✅ Health check do Template Analyzer');
  res.json({
    success: true,
    message: 'Template Analyzer funcionando!',
    timestamp: new Date().toISOString(),
  });
});

// Analisar templates existentes
router.get('/template-analyzer/:accountId/analyze', (req, res) => {
  console.log(`📥 Requisição recebida: GET /api/template-analyzer/${req.params.accountId}/analyze`);
  return templateAnalyzerController.analyzeExistingTemplates(req, res);
});

// Testar formatos
router.post('/template-analyzer/:accountId/test-formats', (req, res) => {
  console.log(`📥 Requisição recebida: POST /api/template-analyzer/${req.params.accountId}/test-formats`);
  return templateAnalyzerController.testFormats(req, res);
});

console.log('✅ Rotas do Template Analyzer registradas:');
console.log('   - GET  /api/template-analyzer/health');
console.log('   - GET  /api/template-analyzer/:accountId/analyze');
console.log('   - POST /api/template-analyzer/:accountId/test-formats');

// ============================================
// ROTAS DE ADMINISTRAÇÃO (SUPER ADMIN)
// ============================================
router.use('/admin/tenants', authenticate, requireSuperAdmin, adminTenantsRoutes);
console.log('✅ Rota /admin/tenants registrada (apenas super_admin)');

router.use('/admin/plans', authenticate, requireSuperAdmin, adminPlansRoutes);
console.log('✅ Rota /admin/plans registrada (apenas super_admin)');

router.use('/admin/logs', authenticate, requireSuperAdmin, adminLogsRoutes);
console.log('✅ Rota /admin/logs registrada (apenas super_admin)');

router.use('/admin/system-logs', authenticate, requireSuperAdmin, adminSystemLogsRoutes);
console.log('✅ Rota /admin/system-logs registrada (apenas super_admin)');

router.use('/admin/files', authenticate, requireSuperAdmin, adminFilesRoutes);
console.log('✅ Rota /admin/files registrada (apenas super_admin)');

router.use('/admin/communications', authenticate, requireSuperAdmin, adminCommunicationsRoutes);
console.log('✅ Rota /admin/communications registrada (apenas super_admin)');

router.use('/admin/credentials', authenticate, requireSuperAdmin, adminCredentialsRoutes);
console.log('✅ Rota /admin/credentials registrada (apenas super_admin)');

router.use('/admin/email-accounts', authenticate, requireSuperAdmin, adminEmailAccountsRoutes);
console.log('✅ Rota /admin/email-accounts registrada (apenas super_admin)');

router.use('/admin/profile', authenticate, requireSuperAdmin, adminProfileRoutes);
console.log('✅ Rota /admin/profile registrada (apenas super_admin)');

router.use('/admin/system-settings', authenticate, requireSuperAdmin, adminSystemSettingsRoutes);
console.log('✅ Rota /admin/system-settings registrada (apenas super_admin)');

router.use('/admin/tutorials', authenticate, requireSuperAdmin, adminTutorialsRoutes);
console.log('✅ Rota /admin/tutorials registrada (apenas super_admin)');

router.use('/admin/pacotes-consultas', adminPacotesConsultasRoutes);
console.log('✅ Rota /admin/pacotes-consultas registrada (apenas super_admin)');

router.use('/admin/faixas-preco-consultas', adminFaixasPrecoConsultasRoutes);
console.log('✅ Rota /admin/faixas-preco-consultas registrada (apenas super_admin)');

router.use('/admin/relatorios-financeiros', authenticate, requireSuperAdmin, adminRelatoriosFinanceirosRoutes);
console.log('✅ Rota /admin/relatorios-financeiros registrada (apenas super_admin)');

router.use('/admin/email-templates', authenticate, requireSuperAdmin, adminEmailTemplatesRoutes);
console.log('✅ Rota /admin/email-templates registrada (apenas super_admin)');

router.use('/admin/mailgun-credentials', authenticate, requireSuperAdmin, adminMailgunCredentialsRoutes);
console.log('✅ Rota /admin/mailgun-credentials registrada (apenas super_admin)');

router.use('/admin/sendgrid-credentials', authenticate, requireSuperAdmin, adminSendgridCredentialsRoutes);
console.log('✅ Rota /admin/sendgrid-credentials registrada (apenas super_admin)');

router.use('/admin/nettsistemasenvios-credentials', authenticate, requireSuperAdmin, adminNettEnviosCredentialsRoutes);
console.log('✅ Rota /admin/nettsistemasenvios-credentials registrada (apenas super_admin)');

// Webhooks públicos (sem autenticação - tracking events)
const {
  mailgunWebhook,
  sendgridWebhook,
  sendgridInboundParse,
  nettEnviosWebhook,
  nettEnviosInboundParse,
} = require('../controllers/email-marketing.controller');
const multerInbound = require('multer');
// E-mails com imagem/anexo: campos HTML e arquivos podem passar de 1MB (limite padrão do multer)
const inboundUpload = multerInbound({
  storage: multerInbound.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024,
    fieldSize: 25 * 1024 * 1024,
    files: 30,
    fields: 100,
  },
});
function inboundUploadMiddleware(req: any, res: any, next: any) {
  inboundUpload.any()(req, res, (err: any) => {
    if (err) {
      console.error('[inbound-multer]', err.code || err.message, err);
      // 200 para o SendGrid não ficar reenviando em loop; logamos o erro
      return res.status(200).json({
        success: false,
        matched: false,
        error: 'multer_' + String(err.code || 'error'),
        message: String(err.message || err),
      });
    }
    next();
  });
}
router.post('/webhook/mailgun', mailgunWebhook);
console.log('✅ Webhook público Mailgun registrado em /webhook/mailgun');
router.post('/webhook/sendgrid', sendgridWebhook);
console.log('✅ Webhook público SendGrid registrado em /webhook/sendgrid');
router.post('/webhook/sendgrid-inbound', inboundUploadMiddleware, sendgridInboundParse);
console.log('✅ Inbound Parse SendGrid registrado em /webhook/sendgrid-inbound');

router.post('/webhook/nettsistemasenvios', nettEnviosWebhook);
router.post('/webhook/nettsistemasenvios/:domainId/:token', nettEnviosWebhook);
console.log('✅ Webhook público nettsistemasenvios.com.br registrado');
router.post('/webhook/nettsistemasenvios-inbound', inboundUploadMiddleware, nettEnviosInboundParse);
router.post(
  '/webhook/nettsistemasenvios-inbound/:domainId/:token',
  inboundUploadMiddleware,
  nettEnviosInboundParse
);
console.log('✅ Inbound nettsistemasenvios.com.br registrado');

// Cancelamento de inscrição (público — link no rodapé de todos os e-mails)
const { publicEmailUnsubscribe } = require('../controllers/email-marketing.controller');
router.get('/public/email-unsubscribe', publicEmailUnsubscribe);
router.post('/public/email-unsubscribe', publicEmailUnsubscribe);
console.log('✅ Unsubscribe público registrado em /public/email-unsubscribe');

const adminLandingRoutes = require('./admin/landing.routes');
router.use('/admin/landing', authenticate, requireSuperAdmin, adminLandingRoutes);
console.log('✅ Rota /admin/landing registrada (apenas super_admin)');

const adminScreenshotsRoutes = require('./admin/screenshots.routes');
router.use('/admin/screenshots', authenticate, requireSuperAdmin, adminScreenshotsRoutes);
console.log('✅ Rota /admin/screenshots registrada (apenas super_admin)');

const adminMasterUsersRoutes = require('./admin/master-users.routes');
router.use('/admin/master-users', authenticate, adminMasterUsersRoutes);
console.log('✅ Rota /admin/master-users registrada (apenas super_admin)');

// ============================================
// ROTAS DE TUTORIAIS (PARA USUÁRIOS)
// ============================================
router.use('/tutorials', authenticate, tutorialsRoutes);
console.log('✅ Rota /tutorials registrada (requer autenticação)');

// ============================================
// ROTAS DE DIAGNÓSTICO (COM AUTENTICAÇÃO)
// ============================================
router.use('/diagnostic/credentials', authenticate, diagnosticCredentialsRoutes);
console.log('✅ Rota /diagnostic/credentials registrada (requer autenticação)');

// ============================================
// AVISO: Rotas antigas precisam ser migradas
// Essas rotas serão atualizadas na Fase 3 para
// incluir middleware tenantAuth
// ============================================

export default router;
