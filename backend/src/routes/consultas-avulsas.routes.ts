/**
 * Rotas de Consultas Avulsas
 */

import { Router } from 'express';
import consultasAvulsasController from '../controllers/consultas-avulsas.controller';
const { authenticate } = require('../middleware/auth.middleware');

const router = Router();

// Aplicar autenticação em todas as rotas
router.use(authenticate);

/**
 * GET /api/consultas-avulsas/saldo
 * Retorna saldo atual de consultas avulsas
 */
router.get('/saldo', consultasAvulsasController.getSaldo);

/**
 * GET /api/consultas-avulsas/pacotes
 * Lista pacotes disponíveis para compra
 */
router.get('/pacotes', consultasAvulsasController.getPacotes);

/**
 * GET /api/consultas-avulsas/faixas-preco
 * Lista faixas de preço para quantidade personalizada
 */
router.get('/faixas-preco', consultasAvulsasController.getFaixasPreco);

/**
 * POST /api/consultas-avulsas/comprar
 * Cria cobrança PIX para compra de consultas
 * Body: { quantidade: number, valor: number }
 */
router.post('/comprar', consultasAvulsasController.comprar);

/**
 * GET /api/consultas-avulsas/historico
 * Retorna histórico de compras
 */
router.get('/historico', consultasAvulsasController.getHistorico);

export default router;

