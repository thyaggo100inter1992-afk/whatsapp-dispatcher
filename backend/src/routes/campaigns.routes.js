const express = require('express');
const router = express.Router();
const { checkCampaignLimit } = require('../middlewares/tenant-limits.middleware');
const { checkCampaigns } = require('../middlewares/check-feature.middleware');

// Importar do arquivo compilado TypeScript
let CampaignController;
try {
  CampaignController = require('../controllers/campaign.controller').CampaignController;
} catch (e) {
  // Fallback para versão compilada
  CampaignController = require('../../dist/controllers/campaign.controller').CampaignController;
}

const controller = new CampaignController();

/**
 * Rotas de Campanhas
 */

// DEBUG: Check campaign data (SEM AUTENTICAÇÃO para debug)
router.get('/debug/:id', async (req, res) => {
  try {
    const { query } = require('../database/connection');
    const campaignId = req.params.id;
    
    const campaign = await query('SELECT * FROM campaigns WHERE id = $1', [campaignId]);
    const contacts = await query('SELECT COUNT(*) as total FROM campaign_contacts WHERE campaign_id = $1', [campaignId]);
    const templates = await query('SELECT COUNT(*) as total FROM campaign_templates WHERE campaign_id = $1', [campaignId]);
    
    res.json({
      campaign: campaign.rows[0] || null,
      contactsAssociated: parseInt(contacts.rows[0]?.total || 0),
      templatesAssociated: parseInt(templates.rows[0]?.total || 0)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Baixar template de contatos (Excel) - Público
router.get('/template/contacts', (req, res) => controller.downloadContactsTemplate(req, res));

// Aplicar verificação de funcionalidade em TODAS as rotas abaixo
router.use(checkCampaigns);

// Deletar todas as campanhas finalizadas (DEVE vir ANTES de /:id)
router.delete('/finished/all', (req, res) => controller.deleteFinished(req, res));

// DEBUG: Check campaign data
router.get('/debug/:id', async (req, res) => {
  try {
    const { query } = require('../database/connection');
    const campaignId = req.params.id;
    
    const campaign = await query('SELECT * FROM campaigns WHERE id = $1', [campaignId]);
    const contacts = await query('SELECT COUNT(*) as total FROM campaign_contacts WHERE campaign_id = $1', [campaignId]);
    const templates = await query('SELECT COUNT(*) as total FROM campaign_templates WHERE campaign_id = $1', [campaignId]);
    
    res.json({
      campaign: campaign.rows[0] || null,
      contactsAssociated: parseInt(contacts.rows[0]?.total || 0),
      templatesAssociated: parseInt(templates.rows[0]?.total || 0)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Listar todas as campanhas
router.get('/', (req, res) => controller.findAll(req, res));

// Buscar campanha por ID
router.get('/:id', (req, res) => controller.findById(req, res));

// Criar nova campanha
router.post('/', checkCampaignLimit, (req, res) => controller.create(req, res));

// Atualizar campanha
router.put('/:id', (req, res) => controller.edit(req, res));

// Deletar campanha
router.delete('/:id', (req, res) => controller.delete(req, res));

// Iniciar campanha
router.post('/:id/start', (req, res) => controller.start(req, res));

// Pausar campanha
router.post('/:id/pause', (req, res) => controller.pause(req, res));

// Retomar campanha
router.post('/:id/resume', (req, res) => controller.resume(req, res));

// Cancelar campanha
router.post('/:id/cancel', (req, res) => controller.cancel(req, res));

// Obter mensagens da campanha
router.get('/:id/messages', (req, res) => controller.getMessages(req, res));

// Obter contatos da campanha
router.get('/:id/contacts', (req, res) => controller.getContacts(req, res));

// Obter log de atividades da campanha
router.get('/:id/activity-log', (req, res) => controller.getActivityLog(req, res));

// Obter estatísticas de botões da campanha
router.get('/:id/buttons-stats', (req, res) => controller.getButtonsStats(req, res));

// Adicionar/reativar conta WhatsApp na campanha
router.post('/:id/add-account', (req, res) => controller.addAccount(req, res));

// Remover conta WhatsApp da campanha
router.post('/:id/remove-account', (req, res) => controller.removeAccount(req, res));

// Obter status das contas da campanha
router.get('/:id/accounts-status', (req, res) => controller.getAccountsStatus(req, res));

// Configurar remoção automática de contas
router.put('/:id/auto-remove-config', (req, res) => controller.updateAutoRemoveConfig(req, res));

// Download do relatório da campanha (Excel)
router.get('/:id/report', (req, res) => controller.downloadReport(req, res));

module.exports = router;



