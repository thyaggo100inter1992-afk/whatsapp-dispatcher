const express = require('express');
const router = express.Router();
const { logActivity } = require('../../controllers/logs/activity.controller');

/**
 * Rotas de Logs de Atividade
 * Base: /api/logs
 * 
 * Essas rotas recebem logs do frontend
 */

// POST /api/logs/activity - Registrar atividade do usuário
router.post('/activity', logActivity);

module.exports = router;



