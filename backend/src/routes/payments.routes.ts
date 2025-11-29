/**
 * Rotas de Pagamentos
 */

import { Router } from 'express';
import paymentController from '../controllers/payment.controller';
const { authenticate } = require('../middleware/auth.middleware');
const { setTenantContext } = require('../middleware/tenant.middleware');

const router = Router();

/**
 * Rotas públicas
 */

// Webhook do Asaas (PÚBLICO - sem autenticação)
router.post('/webhook', paymentController.handleWebhook);

/**
 * Rotas protegidas (requerem autenticação + tenant context)
 */

// Listar planos disponíveis
router.get('/plans', authenticate, setTenantContext, paymentController.listPlans);

// Obter status de pagamento do tenant (DEVE VIR ANTES DE /:id)
router.get('/status', authenticate, setTenantContext, paymentController.getPaymentStatus);

// Obter informações financeiras completas (DEVE VIR ANTES DE /:id)
router.get('/financial-info', authenticate, setTenantContext, paymentController.getFinancialInfo);

// Calcular valor de upgrade (DEVE VIR ANTES DE /:id)
router.get('/calculate-upgrade', authenticate, setTenantContext, paymentController.calculateUpgrade);

// Verificar status de um pagamento específico
router.get('/:id/status', authenticate, setTenantContext, paymentController.checkPaymentStatus);

// Buscar dados completos de um pagamento
router.get('/:id', authenticate, setTenantContext, paymentController.getPayment);

// Criar nova cobrança
router.post('/create', authenticate, setTenantContext, paymentController.createPayment);

// Processar upgrade de plano
router.post('/upgrade', authenticate, setTenantContext, paymentController.processUpgrade);

// Agendar downgrade de plano
router.post('/downgrade', authenticate, setTenantContext, paymentController.scheduleDowngrade);

// Renovar plano atual
router.post('/renew', authenticate, setTenantContext, paymentController.renewPlan);

// Atualizar dados do PIX manualmente
router.post('/update-pix-data/:paymentId', authenticate, setTenantContext, paymentController.updatePixData);

// Sincronizar pagamentos com Asaas
router.post('/sync', authenticate, setTenantContext, paymentController.syncPayments);

// Marcar pagamento como pago manualmente
router.post('/:id/mark-as-paid', authenticate, setTenantContext, paymentController.markAsPaid);

export default router;

