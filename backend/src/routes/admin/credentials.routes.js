const express = require('express');
const router = express.Router();
const credentialsController = require('../../controllers/admin/credentials.controller');
const { requireSuperAdmin } = require('../../middleware/super-admin.middleware');

/**
 * ================================
 * ROTAS: Gerenciamento de Credenciais (Super Admin Only)
 * ================================
 */

// Aplicar middleware de super admin em todas as rotas
router.use(requireSuperAdmin);

// ========================================
// ROTAS: UAZAP CREDENTIALS
// ========================================

/**
 * GET /api/admin/credentials/uazap
 * Lista todas as credenciais UAZAP
 */
router.get('/uazap', credentialsController.getAllUazapCredentials);

/**
 * GET /api/admin/credentials/uazap/:id
 * Busca uma credencial UAZAP específica
 */
router.get('/uazap/:id', credentialsController.getUazapCredentialById);

/**
 * POST /api/admin/credentials/uazap
 * Cria nova credencial UAZAP
 */
router.post('/uazap', credentialsController.createUazapCredential);

/**
 * PUT /api/admin/credentials/uazap/:id
 * Atualiza uma credencial UAZAP
 */
router.put('/uazap/:id', credentialsController.updateUazapCredential);

/**
 * DELETE /api/admin/credentials/uazap/:id
 * Deleta uma credencial UAZAP
 */
router.delete('/uazap/:id', credentialsController.deleteUazapCredential);

/**
 * PATCH /api/admin/credentials/uazap/:id/set-default
 * Define uma credencial UAZAP como padrão
 */
router.patch('/uazap/:id/set-default', credentialsController.setUazapCredentialAsDefault);

// ========================================
// ROTAS: NOVA VIDA CREDENTIALS
// ========================================

/**
 * GET /api/admin/credentials/novavida
 * Lista todas as credenciais Nova Vida
 */
router.get('/novavida', credentialsController.getAllNovaVidaCredentials);

/**
 * GET /api/admin/credentials/novavida/:id
 * Busca uma credencial Nova Vida específica
 */
router.get('/novavida/:id', credentialsController.getNovaVidaCredentialById);

/**
 * POST /api/admin/credentials/novavida
 * Cria nova credencial Nova Vida
 */
router.post('/novavida', credentialsController.createNovaVidaCredential);

/**
 * PUT /api/admin/credentials/novavida/:id
 * Atualiza uma credencial Nova Vida
 */
router.put('/novavida/:id', credentialsController.updateNovaVidaCredential);

/**
 * DELETE /api/admin/credentials/novavida/:id
 * Deleta uma credencial Nova Vida
 */
router.delete('/novavida/:id', credentialsController.deleteNovaVidaCredential);

/**
 * PATCH /api/admin/credentials/novavida/:id/set-default
 * Define uma credencial Nova Vida como padrão
 */
router.patch('/novavida/:id/set-default', credentialsController.setNovaVidaCredentialAsDefault);

// ========================================
// ROTAS: ASAAS CREDENTIALS
// ========================================

/**
 * GET /api/admin/credentials/asaas
 * Lista todas as credenciais Asaas
 */
router.get('/asaas', credentialsController.getAllAsaasCredentials);

/**
 * GET /api/admin/credentials/asaas/:id
 * Busca uma credencial Asaas específica
 */
router.get('/asaas/:id', credentialsController.getAsaasCredentialById);

/**
 * POST /api/admin/credentials/asaas
 * Cria nova credencial Asaas
 */
router.post('/asaas', credentialsController.createAsaasCredential);

/**
 * PUT /api/admin/credentials/asaas/:id
 * Atualiza uma credencial Asaas
 */
router.put('/asaas/:id', credentialsController.updateAsaasCredential);

/**
 * DELETE /api/admin/credentials/asaas/:id
 * Deleta uma credencial Asaas
 */
router.delete('/asaas/:id', credentialsController.deleteAsaasCredential);

/**
 * PATCH /api/admin/credentials/asaas/:id/set-default
 * Define uma credencial Asaas como padrão
 */
router.patch('/asaas/:id/set-default', credentialsController.setAsaasCredentialAsDefault);

module.exports = router;

