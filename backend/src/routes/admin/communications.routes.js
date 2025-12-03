/**
 * Rotas para Sistema de Comunicação
 * Emails em massa e notificações pop-up
 */

const express = require('express');
const router = express.Router();
const communicationsController = require('../../controllers/admin/communications.controller');

// ============================================
// ROTAS DE CAMPANHAS DE EMAIL
// ============================================

// Listar todas as campanhas
router.get('/campaigns', communicationsController.getAllCampaigns);

// Buscar campanha por ID
router.get('/campaigns/:id', communicationsController.getCampaignById);

// Criar nova campanha
router.post('/campaigns', communicationsController.createCampaign);

// Preview de destinatários
router.post('/campaigns/preview-recipients', communicationsController.previewRecipients);

// Iniciar envio de campanha
router.post('/campaigns/:id/start', communicationsController.startCampaign);

// Pausar campanha
router.post('/campaigns/:id/pause', communicationsController.pauseCampaign);

// Retomar campanha
router.post('/campaigns/:id/resume', communicationsController.resumeCampaign);

// Cancelar campanha
router.post('/campaigns/:id/cancel', communicationsController.cancelCampaign);

// Deletar campanha
router.delete('/campaigns/:id', communicationsController.deleteCampaign);

// ============================================
// ROTAS DE NOTIFICAÇÕES POP-UP
// ============================================

// Listar todas as notificações
router.get('/notifications', communicationsController.getAllNotifications);

// Buscar notificação por ID
router.get('/notifications/:id', communicationsController.getNotificationById);

// Criar nova notificação
router.post('/notifications', communicationsController.createNotification);

// Atualizar notificação
router.put('/notifications/:id', communicationsController.updateNotification);

// Deletar notificação
router.delete('/notifications/:id', communicationsController.deleteNotification);

// Ativar/Desativar notificação
router.patch('/notifications/:id/toggle', communicationsController.toggleNotification);

module.exports = router;

