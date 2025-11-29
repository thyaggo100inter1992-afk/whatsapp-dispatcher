const express = require('express');
const router = express.Router();
const landingController = require('../../controllers/public/landing.controller');

/**
 * Rotas Públicas da Landing Page
 * Base: /api/public/landing
 * Não requerem autenticação
 */

// GET /api/public/landing/plans - Listar planos visíveis
router.get('/plans', landingController.getPublicPlans);

// GET /api/public/landing/features - Listar funcionalidades
router.get('/features', landingController.getSystemFeatures);

// GET /api/public/landing/stats - Estatísticas públicas
router.get('/stats', landingController.getPublicStats);

// POST /api/public/landing/trial - Criar conta trial
router.post('/trial', landingController.createTrialUser);

// POST /api/public/landing/contact - Salvar lead/contato
router.post('/contact', landingController.saveContact);

module.exports = router;



