const express = require('express');
const router = express.Router();
const plansController = require('../../controllers/admin/plans.controller');

/**
 * Rotas de Gerenciamento de Planos (Super Admin)
 * Base: /api/admin/plans
 * Todas as rotas requerem autenticação + super_admin
 */

// GET /api/admin/plans/stats - Estatísticas do sistema
router.get('/stats', plansController.getSystemStats);

// GET /api/admin/plans - Listar todos os planos
router.get('/', plansController.getAllPlans);

// GET /api/admin/plans/:id - Obter plano por ID
router.get('/:id', plansController.getPlanById);

// POST /api/admin/plans - Criar novo plano
router.post('/', plansController.createPlan);

// PUT /api/admin/plans/:id - Atualizar plano
router.put('/:id', plansController.updatePlan);

// DELETE /api/admin/plans/:id - Deletar plano
router.delete('/:id', plansController.deletePlan);

module.exports = router;
