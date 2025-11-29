const express = require('express');
const multer = require('multer');
const router = express.Router();

// Configurar multer para upload de arquivos
const upload = multer({
  storage: multer.memoryStorage(), // Armazenar em memória para processar direto
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 1 // Apenas 1 arquivo por vez
  },
  fileFilter: (req, file, cb) => {
    console.log('🔍 Multer fileFilter:', { 
      originalname: file.originalname, 
      mimetype: file.mimetype,
      fieldname: file.fieldname 
    });
    
    // Aceitar apenas Excel e CSV
    const allowedTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
      'application/csv', // Adicionar tipo alternativo para CSV
      'text/plain' // Alguns browsers enviam CSV como text/plain
    ];
    
    // Também aceitar por extensão
    const allowedExtensions = ['.xlsx', '.xls', '.csv'];
    const hasValidExtension = allowedExtensions.some(ext => 
      file.originalname.toLowerCase().endsWith(ext)
    );
    
    if (allowedTypes.includes(file.mimetype) || hasValidExtension) {
      console.log('✅ Arquivo aceito:', file.originalname);
      cb(null, true);
    } else {
      console.error('❌ Tipo de arquivo não permitido:', file.mimetype);
      cb(new Error(`Tipo de arquivo não permitido (${file.mimetype}). Use .xlsx, .xls ou .csv`));
    }
  }
});

// Importar do arquivo compilado TypeScript
let RestrictionListController;
try {
  RestrictionListController = require('../controllers/restriction-list.controller').RestrictionListController;
} catch (e) {
  // Fallback para versão compilada
  RestrictionListController = require('../../dist/controllers/restriction-list.controller').RestrictionListController;
}

const controller = new RestrictionListController();

/**
 * Rotas de Listas de Restrição
 * Sistema multi-tenant para gerenciar bloqueios e restrições de contatos
 */

// ============================================
// ESTATÍSTICAS E VISÃO GERAL
// ============================================

// GET /api/restriction-lists/stats/overview
router.get('/stats/overview', (req, res) => controller.getOverview(req, res));

// GET /api/restriction-lists/stats/dashboard
router.get('/stats/dashboard', (req, res) => controller.getDashboardStats(req, res));

// ============================================
// CRUD DE ENTRADAS
// ============================================

// GET /api/restriction-lists - Listar entradas com filtros e paginação
router.get('/', (req, res) => controller.list(req, res));

// POST /api/restriction-lists - Criar nova entrada
router.post('/', (req, res) => controller.create(req, res));

// DELETE /api/restriction-lists/bulk - Deletar múltiplas entradas (ANTES de /:id)
router.delete('/bulk', (req, res) => controller.bulkDelete(req, res));

// DELETE /api/restriction-lists/delete-all/:list_type - Deletar todos de uma lista (ANTES de /:id)
router.delete('/delete-all/:list_type', (req, res) => controller.deleteAll(req, res));

// DELETE /api/restriction-lists/:id - Deletar entrada (DEVE FICAR POR ÚLTIMO)
router.delete('/:id', (req, res) => controller.delete(req, res));

// ============================================
// IMPORTAÇÃO EM MASSA
// ============================================

// POST /api/restriction-lists/bulk-import
router.post('/bulk-import', (req, res, next) => {
  console.log('📥 Rota /bulk-import chamada');
  upload.single('file')(req, res, (err) => {
    if (err) {
      console.error('❌ Erro no Multer (bulk-import):', err.message);
      return res.status(400).json({ error: err.message });
    }
    controller.import(req, res);
  });
});

// POST /api/restriction-lists/import (alias)
router.post('/import', (req, res, next) => {
  console.log('📥 Rota /import chamada');
  console.log('   Content-Type:', req.headers['content-type']);
  console.log('   Content-Length:', req.headers['content-length']);
  
  upload.single('file')(req, res, (err) => {
    if (err) {
      console.error('❌ Erro no Multer (import):', err.message);
      return res.status(400).json({ error: err.message, details: err.toString() });
    }
    controller.import(req, res);
  });
});

// ============================================
// VERIFICAÇÃO DE CONTATOS
// ============================================

// POST /api/restriction-lists/check
router.post('/check', (req, res) => controller.checkContact(req, res));

// POST /api/restriction-lists/check-bulk
router.post('/check-bulk', (req, res) => controller.checkBulk(req, res));

// ============================================
// KEYWORDS (PALAVRAS-CHAVE AUTOMÁTICAS)
// ============================================

// GET /api/restriction-lists/keywords
router.get('/keywords', (req, res) => controller.listKeywords(req, res));

// POST /api/restriction-lists/keywords
router.post('/keywords', (req, res) => controller.createKeyword(req, res));

// PATCH /api/restriction-lists/keywords/:id/toggle - Ativar/desativar keyword
router.patch('/keywords/:id/toggle', (req, res) => controller.toggleKeyword(req, res));

// DELETE /api/restriction-lists/keywords/:id
router.delete('/keywords/:id', (req, res) => controller.deleteKeyword(req, res));

// ============================================
// TIPOS DE LISTA (CONFIGURAÇÕES)
// ============================================

// GET /api/restriction-lists/list-types
router.get('/list-types', (req, res) => controller.getListTypes(req, res));

// PATCH /api/restriction-lists/list-types/:id - Atualizar dias de retenção
router.patch('/list-types/:id', (req, res) => controller.updateListType(req, res));

// ============================================
// EXPORTAÇÃO
// ============================================

// GET /api/restriction-lists/export/excel
router.get('/export/excel', (req, res) => controller.export(req, res));

module.exports = router;


