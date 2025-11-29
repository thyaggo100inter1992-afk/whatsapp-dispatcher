const express = require('express');
const router = express.Router();
const logsController = require('../../controllers/admin/logs.controller');

/**
 * Rotas de Logs e Auditoria (Super Admin)
 * Base: /api/admin/logs
 * Todas as rotas requerem autenticação + super_admin
 */

// GET /api/admin/logs/stats - Estatísticas de logs
router.get('/stats', logsController.getLogsStats);

// GET /api/admin/logs - Listar logs
router.get('/', logsController.getAllLogs);

// DELETE /api/admin/logs/bulk - Deletar logs por período
router.delete('/bulk', logsController.deleteLogs);

module.exports = router;

