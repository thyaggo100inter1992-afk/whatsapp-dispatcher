/**
 * Rotas Admin - Relatórios Financeiros
 * SUPER ADMIN - Dashboard consolidado de todos os tenantes
 */

import { Router } from 'express';
import { relatoriosFinanceirosController } from '../../controllers/admin/relatorios-financeiros.controller';

const router = Router();

/**
 * GET /api/admin/relatorios-financeiros/dashboard
 * Retorna dashboard completo com todas as métricas financeiras
 */
router.get(
  '/dashboard',
  relatoriosFinanceirosController.getDashboard.bind(relatoriosFinanceirosController)
);

/**
 * GET /api/admin/relatorios-financeiros/exportar
 * Exporta relatório completo em CSV
 */
router.get(
  '/exportar',
  relatoriosFinanceirosController.exportarCSV.bind(relatoriosFinanceirosController)
);

export default router;



