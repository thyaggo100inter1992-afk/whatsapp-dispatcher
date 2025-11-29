const express = require('express');
const router = express.Router();
const landingController = require('../../controllers/admin/landing.controller');

/**
 * Rotas de Administração da Landing Page (Super Admin)
 * Base: /api/admin/landing
 * Todas as rotas requerem autenticação + super_admin
 */

// GET /api/admin/landing/leads - Listar leads e estatísticas
router.get('/leads', landingController.getLeadsAndStats);

// GET /api/admin/landing/stats - Estatísticas detalhadas
router.get('/stats', landingController.getDetailedStats);

// GET /api/admin/landing/export - Exportar leads em CSV
router.get('/export', landingController.exportLeads);

// DELETE /api/admin/landing/leads/:id - Deletar lead
router.delete('/leads/:id', landingController.deleteLead);

module.exports = router;



