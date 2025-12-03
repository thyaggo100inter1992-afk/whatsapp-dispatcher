/**
 * Rotas para gerenciamento de contas de email
 */

const express = require('express');
const router = express.Router();
const emailAccountsController = require('../../controllers/admin/email-accounts.controller');

/**
 * GET /api/admin/email-accounts
 * Lista todas as contas de email
 */
router.get('/', emailAccountsController.getAllAccounts);

/**
 * GET /api/admin/email-accounts/:id
 * Busca uma conta específica
 */
router.get('/:id', emailAccountsController.getAccountById);

/**
 * POST /api/admin/email-accounts
 * Cria uma nova conta de email
 */
router.post('/', emailAccountsController.createAccount);

/**
 * PUT /api/admin/email-accounts/:id
 * Atualiza uma conta de email
 */
router.put('/:id', emailAccountsController.updateAccount);

/**
 * DELETE /api/admin/email-accounts/:id
 * Deleta uma conta de email
 */
router.delete('/:id', emailAccountsController.deleteAccount);

/**
 * PATCH /api/admin/email-accounts/:id/set-default
 * Define uma conta como padrão
 */
router.patch('/:id/set-default', emailAccountsController.setAsDefault);

/**
 * POST /api/admin/email-accounts/:id/test
 * Testa uma conta de email
 */
router.post('/:id/test', emailAccountsController.testAccount);

module.exports = router;

