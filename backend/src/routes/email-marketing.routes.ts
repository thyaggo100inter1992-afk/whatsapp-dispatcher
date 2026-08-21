import { Router } from 'express';
import multer from 'multer';
import * as ctrl from '../controllers/email-marketing.controller';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// =============================================
// DOMÍNIOS
// =============================================
router.get('/domains', ctrl.getDomains);
router.post('/domains', ctrl.addDomain);
router.post('/domains/:id/verify', ctrl.verifyDomain);
router.post('/domains/:id/register-webhooks', ctrl.registerDomainWebhooks);
router.delete('/domains/:id', ctrl.deleteDomain);

// =============================================
// LISTAS DE CONTATOS
// =============================================
router.get('/lists', ctrl.getLists);
router.post('/lists', ctrl.createList);
router.delete('/lists/:id', ctrl.deleteList);
router.post('/lists/:list_id/import', upload.single('file'), ctrl.importContacts);
router.get('/lists/:list_id/contacts', ctrl.getContacts);

// =============================================
// TEMPLATES
// =============================================
router.get('/templates', ctrl.getTemplates);
router.post('/templates', ctrl.createTemplate);
router.put('/templates/:id', ctrl.updateTemplate);
router.delete('/templates/:id', ctrl.deleteTemplate);

// =============================================
// CAMPANHAS
// =============================================
router.get('/campaigns', ctrl.getCampaigns);
router.post('/campaigns', ctrl.createCampaign);
router.get('/campaigns/:id', ctrl.getCampaignById);
router.get('/campaigns/:id/stats', ctrl.getCampaignStats);
router.get('/campaigns/:id/recipients', ctrl.getCampaignRecipients);
router.post('/campaigns/:id/resend-failed', ctrl.resendFailed);
router.patch('/campaigns/:id', ctrl.updateCampaign);
router.post('/campaigns/:id/start', ctrl.startCampaign);
router.post('/campaigns/:id/pause', ctrl.pauseCampaign);
router.post('/campaigns/:id/cancel', ctrl.cancelCampaign);
router.delete('/campaigns/:id', ctrl.deleteCampaign);

// =============================================
// ENVIO ÚNICO
// =============================================
router.post('/send-single', ctrl.sendSingle);
router.get('/send-single/:id', ctrl.getSingleSend);
router.post('/send-single/:id/resend', ctrl.resendSingleSend);

// =============================================
// HISTÓRICO DE ENVIOS (campanhas + envio único)
// =============================================
router.get('/sends', ctrl.getSends);

export default router;
