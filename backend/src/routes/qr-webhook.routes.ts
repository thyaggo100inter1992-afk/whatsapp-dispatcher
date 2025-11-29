import { Router } from 'express';
import { QrWebhookController } from '../controllers/qr-webhook.controller';

const router = Router();
const qrWebhookController = new QrWebhookController();

/**
 * Rotas do Webhook QR Connect
 * Base: /api/qr-webhook
 */

// Health check
router.get('/health', qrWebhookController.health.bind(qrWebhookController));

// Processar atualização de status de mensagem
router.post('/message-status', qrWebhookController.processMessageStatus.bind(qrWebhookController));

// Processar clique em botão
router.post('/button-click', qrWebhookController.processButtonClick.bind(qrWebhookController));

// Receber eventos do UAZ API (webhook externo)
router.post('/uaz-event', qrWebhookController.receiveUazEvent.bind(qrWebhookController));

// Verificar mensagem específica (para testes e debug)
router.get('/check-message/:messageId', qrWebhookController.checkMessage.bind(qrWebhookController));

export default router;

