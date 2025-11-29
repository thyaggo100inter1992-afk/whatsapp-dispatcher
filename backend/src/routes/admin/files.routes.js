const express = require('express');
const router = express.Router();
const filesController = require('../../controllers/admin/files.controller');

/**
 * Rotas de Arquivos Públicos (Super Admin)
 * Base: /api/admin/files
 * Todas as rotas requerem autenticação + super_admin
 */

// POST /api/admin/files/upload - Upload de arquivo
router.post('/upload', filesController.uploadFile);

// GET /api/admin/files - Listar todos os arquivos
router.get('/', filesController.getAllFiles);

// PUT /api/admin/files/:id - Atualizar arquivo
router.put('/:id', filesController.updateFile);

// DELETE /api/admin/files/:id - Deletar arquivo
router.delete('/:id', filesController.deleteFile);

module.exports = router;



