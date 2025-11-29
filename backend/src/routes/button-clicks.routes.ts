import express from 'express';
import { ButtonClicksController } from '../controllers/button-clicks.controller';

const router = express.Router();
const controller = new ButtonClicksController();

/**
 * Rotas de Cliques em Botões
 */

// Listar todos os cliques com paginação e filtros
// GET /api/button-clicks?page=1&limit=20&button_text=&date_from=&date_to=
router.get('/', (req, res) => controller.listClicks(req, res));

// Ranking dos botões mais clicados
// GET /api/button-clicks/ranking?date_from=&date_to=&limit=5
router.get('/ranking', (req, res) => controller.getRanking(req, res));

// Estatísticas gerais de cliques
// GET /api/button-clicks/stats?date_from=&date_to=
router.get('/stats', (req, res) => controller.getStats(req, res));

export default router;




