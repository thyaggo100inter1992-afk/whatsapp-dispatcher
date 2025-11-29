const express = require('express');
const { getFeatures, checkFeature } = require('../controllers/features.controller');

const router = express.Router();

/**
 * Rotas de Funcionalidades/Features
 * Base: /api/features
 * Todas as rotas requerem autenticação e tenant context
 */

// GET /api/features - Obter todas as funcionalidades do tenant
router.get('/', getFeatures);

// GET /api/features/check/:feature - Verificar acesso a uma funcionalidade específica
router.get('/check/:feature', checkFeature);

module.exports = router;


