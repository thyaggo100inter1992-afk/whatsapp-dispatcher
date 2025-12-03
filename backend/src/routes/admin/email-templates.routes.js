/**
 * Rotas para gerenciamento de templates de email
 * Permite criar, editar, ativar/desativar templates personalizados
 */

const express = require('express');
const router = express.Router();
const emailTemplatesController = require('../../controllers/admin/email-templates.controller');

/**
 * GET /api/admin/email-templates
 * Lista todos os templates de email
 */
router.get('/', emailTemplatesController.getAllTemplates);

/**
 * GET /api/admin/email-templates/:id
 * Busca um template específico
 */
router.get('/:id', emailTemplatesController.getTemplateById);

/**
 * PUT /api/admin/email-templates/:id
 * Atualiza um template
 */
router.put('/:id', emailTemplatesController.updateTemplate);

/**
 * PATCH /api/admin/email-templates/:id/toggle
 * Ativa/desativa um template
 */
router.patch('/:id/toggle', emailTemplatesController.toggleTemplate);

/**
 * POST /api/admin/email-templates/:id/restore
 * Restaura um template para o modelo padrão original
 */
router.post('/:id/restore', emailTemplatesController.restoreTemplate);

/**
 * POST /api/admin/email-templates/preview
 * Gera preview de um template com variáveis de exemplo
 */
router.post('/preview', emailTemplatesController.previewTemplate);

/**
 * POST /api/admin/email-templates/test
 * Envia um email de teste
 */
router.post('/test', emailTemplatesController.sendTestEmail);

module.exports = router;

