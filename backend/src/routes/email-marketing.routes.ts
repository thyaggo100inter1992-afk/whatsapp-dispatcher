import { Router } from 'express';
import multer from 'multer';
import * as ctrl from '../controllers/email-marketing.controller';
import * as mailboxCtrl from '../controllers/email-mailbox.controller';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// =============================================
// DOMÍNIOS
// =============================================
router.get('/domains', ctrl.getDomains);
router.post('/domains', ctrl.addDomain);
router.post('/domains/:id/verify', ctrl.verifyDomain);
router.post('/domains/:id/register-webhooks', ctrl.registerDomainWebhooks);
router.post('/domains/:id/enable-inbound', mailboxCtrl.enableDomainInbound);
router.post('/domains/:id/verify-inbound', mailboxCtrl.verifyDomainInbound);
router.delete('/domains/:id', ctrl.deleteDomain);

// =============================================
// LISTAS DE CONTATOS
// =============================================
router.get('/lists', ctrl.getLists);
router.post('/lists', ctrl.createList);
router.delete('/lists/:id', ctrl.deleteList);
router.post('/lists/:list_id/import', upload.single('file'), ctrl.importContacts);
router.post('/lists/:list_id/contacts', ctrl.addListContact);
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

// =============================================
// LISTA DE RESTRIÇÃO (opt-out)
// =============================================
router.get('/restrictions', ctrl.getEmailRestrictions);
router.post('/restrictions', ctrl.addEmailRestriction);
router.delete('/restrictions/:id', ctrl.removeEmailRestriction);
router.post('/restrictions/check-bulk', ctrl.checkEmailRestrictionsBulk);

// =============================================
// CAIXAS DE E-MAIL (inbox) — rotas estáticas ANTES de :id
// =============================================
router.get('/mailboxes/all/messages', mailboxCtrl.listAllMailboxMessages);

router.get('/mailbox-folders', mailboxCtrl.listFolders);
router.post('/mailbox-folders', mailboxCtrl.createFolder);
router.patch('/mailbox-folders/:id', mailboxCtrl.updateFolder);
router.delete('/mailbox-folders/:id', mailboxCtrl.deleteFolder);

router.get('/mailbox-quick-replies', mailboxCtrl.listQuickReplies);
router.post('/mailbox-quick-replies', mailboxCtrl.createQuickReply);
router.patch('/mailbox-quick-replies/:id', mailboxCtrl.updateQuickReply);
router.delete('/mailbox-quick-replies/:id', mailboxCtrl.deleteQuickReply);

router.get('/mailboxes', mailboxCtrl.listMailboxes);
router.post('/mailboxes', mailboxCtrl.createMailbox);
router.patch('/mailboxes/:id', mailboxCtrl.updateMailbox);
router.delete('/mailboxes/:id', mailboxCtrl.deleteMailbox);
router.get('/mailboxes/:id/stats', mailboxCtrl.getMailboxStats);
router.get('/mailboxes/:id/messages', mailboxCtrl.listMailboxMessages);
router.post('/mailboxes/:id/messages/bulk-action', mailboxCtrl.bulkMessageAction);
router.get('/mailboxes/:id/messages/:messageId', mailboxCtrl.getMailboxMessage);
router.post('/mailboxes/:id/messages/:messageId/action', mailboxCtrl.messageAction);
router.get('/mailboxes/:id/messages/:messageId/thread', mailboxCtrl.getThread);
router.get('/mailboxes/:id/messages/:messageId/eml', mailboxCtrl.downloadMessageEml);
router.get('/mailboxes/:id/messages/:messageId/attachments.zip', mailboxCtrl.downloadAttachmentsZip);
router.post('/mailboxes/:id/send', (req, res, next) => {
  upload.array('attachments', 20)(req, res, (err: any) => {
    if (err) {
      console.error('[mailbox-send] multer:', err.message || err);
      return res.status(400).json({
        success: false,
        message: 'Falha ao processar anexos. Tente de novo sem arquivo ou com arquivo menor.',
      });
    }
    next();
  });
}, mailboxCtrl.sendMailboxMessage);
router.patch('/mailboxes/:id/messages/:messageId', mailboxCtrl.moveMailboxMessage);

export default router;
