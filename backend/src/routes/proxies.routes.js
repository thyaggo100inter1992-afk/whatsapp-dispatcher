const express = require('express');
const router = express.Router();

// Importar do arquivo compilado TypeScript
let ProxyManagerController;
try {
  ProxyManagerController = require('../controllers/proxy-manager.controller').ProxyManagerController;
} catch (e) {
  // Fallback para versão compilada
  ProxyManagerController = require('../../dist/controllers/proxy-manager.controller').ProxyManagerController;
}

const proxyController = new ProxyManagerController();

/**
 * Rotas de Proxy Manager
 */

// Listar todos os proxies
router.get('/', (req, res) => proxyController.listAll(req, res));

// Listar proxies ativos
router.get('/active', (req, res) => proxyController.listActive(req, res));

// Buscar proxy por ID
router.get('/:id', (req, res) => proxyController.findById(req, res));

// Criar novo proxy
router.post('/', (req, res) => proxyController.create(req, res));

// Atualizar proxy
router.put('/:id', (req, res) => proxyController.update(req, res));

// Deletar proxy
router.delete('/:id', (req, res) => proxyController.delete(req, res));

// Testar proxy
router.post('/:id/test', (req, res) => proxyController.test(req, res));

// Testar todos os proxies
router.post('/test-all', (req, res) => proxyController.testAll(req, res));

module.exports = router;

