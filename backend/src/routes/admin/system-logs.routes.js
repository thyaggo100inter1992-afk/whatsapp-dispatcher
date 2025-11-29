const express = require('express');
const router = express.Router();
const systemLogsController = require('../../controllers/admin/system-logs.controller');

/**
 * Rotas de Logs do Sistema (Super Admin)
 * Base: /api/admin/system-logs
 * Todas as rotas requerem autenticação + super_admin
 */

// GET /api/admin/system-logs/backend - Obter logs do backend
router.get('/backend', systemLogsController.getBackendLogs);

// DELETE /api/admin/system-logs/backend - Limpar logs do backend
router.delete('/backend', systemLogsController.clearBackendLogs);

module.exports = router;



