const express = require('express');
const router = express.Router();
const tutorialsController = require('../controllers/tutorials.controller');
const { authenticate } = require('../middleware/auth.middleware');

// Todas as rotas requerem autenticação
router.use(authenticate);

// Listar tutoriais ativos
router.get('/', tutorialsController.getActiveTutorials);

// Stream de vídeo
router.get('/stream/:id', tutorialsController.streamVideo);

module.exports = router;

