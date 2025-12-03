import { Router } from 'express';
import { qrCampaignController } from '../controllers/qr-campaign.controller';
const { checkCampaignLimit } = require('../middlewares/tenant-limits.middleware');
const { checkCampaigns } = require('../middlewares/check-feature.middleware');

const router = Router();

// Aplicar verificação de funcionalidade em TODAS as rotas QR Connect
router.use(checkCampaigns);

// ============================================
// ROTAS DE CAMPANHAS QR CONNECT
// ============================================

/**
 * POST /api/qr-campaigns
 * Criar nova campanha QR
 */
router.post('/', checkCampaignLimit, qrCampaignController.create.bind(qrCampaignController));

/**
 * GET /api/qr-campaigns
 * Listar todas as campanhas QR
 */
router.get('/', qrCampaignController.findAll.bind(qrCampaignController));

/**
 * POST /api/qr-campaigns/:id/reorder-templates
 * 🔧 Reordenar templates de uma campanha (FIX)
 * Corrige a ordem de rotação das instâncias
 */
router.post('/:id/reorder-templates', qrCampaignController.reorderTemplates.bind(qrCampaignController));

/**
 * GET /api/qr-campaigns/:id
 * Buscar campanha QR por ID
 */
router.get('/:id', qrCampaignController.findById.bind(qrCampaignController));

/**
 * GET /api/qr-campaigns/:id/messages
 * Buscar mensagens da campanha QR
 */
router.get('/:id/messages', qrCampaignController.getMessages.bind(qrCampaignController));

/**
 * GET /api/qr-campaigns/:id/contacts
 * Buscar contatos da campanha QR
 */
router.get('/:id/contacts', qrCampaignController.getContacts.bind(qrCampaignController));

/**
 * GET /api/qr-campaigns/:id/stats
 * Buscar estatísticas da campanha QR
 */
router.get('/:id/stats', qrCampaignController.getStats.bind(qrCampaignController));

/**
 * PUT /api/qr-campaigns/:id/edit
 * Editar campanha QR
 */
router.put('/:id/edit', qrCampaignController.edit.bind(qrCampaignController));

/**
 * POST /api/qr-campaigns/:id/pause
 * Pausar campanha QR
 */
router.post('/:id/pause', qrCampaignController.pause.bind(qrCampaignController));

/**
 * POST /api/qr-campaigns/:id/resume
 * Retomar campanha QR
 */
router.post('/:id/resume', qrCampaignController.resume.bind(qrCampaignController));

/**
 * POST /api/qr-campaigns/:id/cancel
 * Cancelar campanha QR
 */
router.post('/:id/cancel', qrCampaignController.cancel.bind(qrCampaignController));

/**
 * DELETE /api/qr-campaigns/:id
 * Deletar campanha QR
 */
router.delete('/:id', qrCampaignController.delete.bind(qrCampaignController));

/**
 * DELETE /api/qr-campaigns/finished/delete-all
 * Deletar todas as campanhas QR finalizadas
 */
router.delete('/finished/delete-all', qrCampaignController.deleteFinished.bind(qrCampaignController));

/**
 * GET /api/qr-campaigns/:id/activity-log
 * Obter log de atividades da campanha QR
 */
router.get('/:id/activity-log', qrCampaignController.getActivityLog.bind(qrCampaignController));

/**
 * GET /api/qr-campaigns/:id/buttons-stats
 * Obter estatísticas de botões clicados
 */
router.get('/:id/buttons-stats', qrCampaignController.getButtonsStats.bind(qrCampaignController));

/**
 * GET /api/qr-campaigns/:id/accounts-status
 * Obter status das instâncias da campanha (legacy)
 */
router.get('/:id/accounts-status', qrCampaignController.getAccountsStatus.bind(qrCampaignController));

/**
 * GET /api/qr-campaigns/:id/instances-status
 * Obter status das instâncias da campanha (novo)
 */
router.get('/:id/instances-status', qrCampaignController.getAccountsStatus.bind(qrCampaignController));

/**
 * POST /api/qr-campaigns/:id/remove-account
 * Remover instância da campanha (legacy)
 */
router.post('/:id/remove-account', qrCampaignController.removeAccount.bind(qrCampaignController));

/**
 * POST /api/qr-campaigns/:id/remove-instance
 * Remover instância da campanha (novo)
 */
router.post('/:id/remove-instance', qrCampaignController.removeAccount.bind(qrCampaignController));

/**
 * POST /api/qr-campaigns/:id/add-account
 * Re-adicionar instância à campanha (legacy)
 */
router.post('/:id/add-account', qrCampaignController.addAccount.bind(qrCampaignController));

/**
 * POST /api/qr-campaigns/:id/add-instance
 * Re-adicionar instância à campanha (novo)
 */
router.post('/:id/add-instance', qrCampaignController.addAccount.bind(qrCampaignController));

/**
 * POST /api/qr-campaigns/:id/update-auto-remove-config
 * Atualizar configuração de remoção automática
 */
router.post('/:id/update-auto-remove-config', qrCampaignController.updateAutoRemoveConfig.bind(qrCampaignController));

/**
 * GET /api/qr-campaigns/:id/download-report
 * Baixar relatório Excel da campanha QR
 */
router.get('/:id/download-report', qrCampaignController.downloadReport.bind(qrCampaignController));

export default router;

