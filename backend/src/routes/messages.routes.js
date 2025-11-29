const express = require('express');
const router = express.Router();
const { checkMessageLimit } = require('../middlewares/tenant-limits.middleware');

// Importar do arquivo compilado TypeScript
let MessageController;
try {
  MessageController = require('../controllers/message.controller').MessageController;
} catch (e) {
  // Fallback para versão compilada
  MessageController = require('../../dist/controllers/message.controller').MessageController;
}

const controller = new MessageController();

/**
 * Rotas de Mensagens
 */

// Enviar mensagem imediata (deve vir ANTES das rotas com :id)
router.post('/send-immediate', checkMessageLimit, (req, res) => controller.sendImmediate(req, res));

// Listar todas as mensagens
router.get('/', (req, res) => controller.findAll(req, res));

// Buscar mensagem por ID
router.get('/:id', (req, res) => controller.findById(req, res));

// Criar nova mensagem
router.post('/', (req, res) => controller.create(req, res));

// Atualizar mensagem
router.put('/:id', (req, res) => controller.update(req, res));

// Deletar mensagem
router.delete('/:id', (req, res) => controller.delete(req, res));

module.exports = router;

