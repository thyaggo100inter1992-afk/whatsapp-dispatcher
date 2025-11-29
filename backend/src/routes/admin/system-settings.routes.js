/**
 * ============================================
 * ROTAS: Configurações do Sistema
 * ============================================
 * Rotas para gerenciar configurações globais
 * Apenas super_admin tem acesso
 * ============================================
 */

const express = require('express');
const router = express.Router();
const controller = require('../../controllers/admin/system-settings.controller');

// ============================================
// ROTAS PÚBLICAS (sem autenticação)
// ============================================
router.get('/public', controller.getPublicSettings);

// ============================================
// ROTAS PROTEGIDAS (Super Admin)
// ============================================

// Buscar todas as configurações
router.get('/', controller.getAllSettings);

// Atualizar uma configuração (ou criar se não existir)
router.put('/', controller.updateSetting);

// Criar nova configuração
router.post('/create', controller.createSetting);

// Upload de logo
router.post('/logo', controller.upload.single('logo'), controller.uploadLogo);

// Remover logo
router.delete('/logo', controller.removeLogo);

module.exports = router;



