const express = require('express');
const router = express.Router();

// Importar do arquivo TypeScript compilado
let DashboardController;
try {
  DashboardController = require('../controllers/dashboard.controller').DashboardController;
} catch (e) {
  // Fallback para versão compilada
  DashboardController = require('../../dist/controllers/dashboard.controller').DashboardController;
}

const controller = new DashboardController();

/**
 * Rotas de Dashboard
 */

// Obter estatísticas gerais
router.get('/stats', (req, res) => controller.getStats(req, res));

// Obter estatísticas de envio imediato
router.get('/immediate-stats', (req, res) => controller.getImmediateStats(req, res));

// Obter log de mensagens imediatas
router.get('/immediate-log', (req, res) => controller.getImmediateLog(req, res));

// Obter atividades recentes
router.get('/activity', (req, res) => controller.getRecentActivity(req, res));

module.exports = router;

