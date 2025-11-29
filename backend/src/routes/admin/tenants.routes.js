const express = require('express');
const router = express.Router();
const tenantsController = require('../../controllers/admin/tenants.controller');
const { checkUserLimit } = require('../../middlewares/tenant-limits.middleware');

/**
 * Rotas de Gerenciamento de Tenants (Super Admin)
 * Base: /api/admin/tenants
 * Todas as rotas requerem autenticação + super_admin
 */

// POST /api/admin/tenants - Criar novo tenant
router.post('/', tenantsController.createTenant);

// GET /api/admin/tenants - Listar todos os tenants
router.get('/', tenantsController.getAllTenants);

// ⚠️ IMPORTANTE: Rotas específicas ANTES das rotas com :id
// GET /api/admin/tenants/:id/stats - Obter estatísticas do tenant
router.get('/:id/stats', tenantsController.getTenantStats);

// === ROTAS DE USUÁRIOS DO TENANT ===
// GET /api/admin/tenants/:id/users - Listar usuários do tenant
router.get('/:id/users', tenantsController.getTenantUsers);

// POST /api/admin/tenants/:id/users - Criar novo usuário no tenant
router.post('/:id/users', checkUserLimit, tenantsController.createTenantUser);

// PUT /api/admin/tenants/:tenantId/users/:userId - Atualizar usuário
router.put('/:tenantId/users/:userId', tenantsController.updateTenantUser);

// DELETE /api/admin/tenants/:tenantId/users/:userId - Deletar usuário
router.delete('/:tenantId/users/:userId', tenantsController.deleteTenantUser);

// === ROTAS DE LOGS DO TENANT ===
// GET /api/admin/tenants/:id/logs - Listar logs de auditoria do tenant
router.get('/:id/logs', tenantsController.getTenantLogs);
// DELETE /api/admin/tenants/:id/logs - Excluir todos os logs do tenant
router.delete('/:id/logs', tenantsController.deleteAllTenantLogs);

// === ROTAS DE PAGAMENTOS DO TENANT ===
// GET /api/admin/tenants/:id/payments - Listar todos os pagamentos do tenant
router.get('/:id/payments', tenantsController.getTenantPayments);

// POST /api/admin/tenants/:id/sync-payments - Sincronizar pagamentos com Asaas
router.post('/:id/sync-payments', tenantsController.syncTenantPayments);

// POST /api/admin/tenants/:id/mark-payment-paid/:paymentId - Marcar pagamento como pago
router.post('/:id/mark-payment-paid/:paymentId', tenantsController.markPaymentAsPaid);

// POST /api/admin/tenants/:id/cancel-payment/:paymentId - Cancelar pagamento
router.post('/:id/cancel-payment/:paymentId', tenantsController.cancelPayment);

// POST /api/admin/tenants/:id/cancel-multiple-payments - Cancelar múltiplos pagamentos
router.post('/:id/cancel-multiple-payments', tenantsController.cancelMultiplePayments);

// === ROTAS DE CONSULTAS AVULSAS ===
// POST /api/admin/tenants/:id/add-consultas-avulsas - Adicionar consultas avulsas
router.post('/:id/add-consultas-avulsas', tenantsController.addConsultasAvulsas);

// POST /api/admin/tenants/:id/remove-consultas-avulsas - Remover consultas avulsas
router.post('/:id/remove-consultas-avulsas', tenantsController.removeConsultasAvulsas);

// GET /api/admin/tenants/:id/consultas-avulsas/history - Histórico de recargas
router.get('/:id/consultas-avulsas/history', tenantsController.getConsultasAvulsasHistory);

// GET /api/admin/tenants/:id/consultas-avulsas/usage - Consultas usadas com créditos avulsos
router.get('/:id/consultas-avulsas/usage', tenantsController.getConsultasAvulsasUsage);

// GET /api/admin/tenants/:id/consultas-avulsas/report - Gerar relatório CSV
router.get('/:id/consultas-avulsas/report', tenantsController.getConsultasAvulsasReport);

// === ROTAS DE CONEXÕES DO TENANT ===
// GET /api/admin/tenants/:id/connections - Listar todas as conexões (API + QR)
router.get('/:id/connections', tenantsController.getTenantConnections);

// POST /api/admin/tenants/:id/connections/sync-profile-pictures - Sincronizar fotos de perfil
router.post('/:id/connections/sync-profile-pictures', tenantsController.syncProfilePictures);

// POST /api/admin/tenants/:id/connections/api/:connId/ativar - Ativar conexão API
router.post('/:id/connections/api/:connId/ativar', tenantsController.activateApiConnection);

// POST /api/admin/tenants/:id/connections/api/:connId/desativar - Desativar conexão API
router.post('/:id/connections/api/:connId/desativar', tenantsController.deactivateApiConnection);

// DELETE /api/admin/tenants/:id/connections/api/:connId - Excluir conexão API
router.delete('/:id/connections/api/:connId', tenantsController.deleteApiConnection);

// POST /api/admin/tenants/:id/connections/qr/:connId/ativar - Ativar conexão QR
router.post('/:id/connections/qr/:connId/ativar', tenantsController.activateQrConnection);

// POST /api/admin/tenants/:id/connections/qr/:connId/desativar - Desativar conexão QR
router.post('/:id/connections/qr/:connId/desativar', tenantsController.deactivateQrConnection);

// DELETE /api/admin/tenants/:id/connections/qr/:connId - Excluir conexão QR
router.delete('/:id/connections/qr/:connId', tenantsController.deleteQrConnection);

// GET /api/admin/tenants/:id - Obter tenant por ID
router.get('/:id', tenantsController.getTenantById);

// PUT /api/admin/tenants/:id - Atualizar tenant
router.put('/:id', tenantsController.updateTenant);

// PATCH /api/admin/tenants/:id/status - Atualizar status do tenant
router.patch('/:id/status', tenantsController.updateTenantStatus);

// PATCH /api/admin/tenants/:id/expiration - Atualizar data de vencimento manualmente
router.patch('/:id/expiration', tenantsController.updateTenantExpiration);

// DELETE /api/admin/tenants/:id - Deletar tenant
router.delete('/:id', tenantsController.deleteTenant);

module.exports = router;
