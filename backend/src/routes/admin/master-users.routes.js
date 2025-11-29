const express = require('express');
const router = express.Router();
const masterUsersController = require('../../controllers/admin/master-users.controller');
const { requireSuperAdmin } = require('../../middleware/super-admin.middleware');

/**
 * Rotas para gerenciamento de usuários master
 * Todos os endpoints requerem autenticação de super admin
 */

// Listar todos os usuários master
router.get('/', requireSuperAdmin, masterUsersController.getAllMasterUsers);

// Obter configuração de senha padrão
router.get('/config', requireSuperAdmin, masterUsersController.getMasterConfig);

// Criar usuários master para tenants que não têm
router.post('/create-missing', requireSuperAdmin, masterUsersController.createMissingMasterUsers);

// Buscar usuário master de um tenant específico
router.get('/:tenantId', requireSuperAdmin, masterUsersController.getMasterUserByTenant);

// Alterar senha de um usuário master
router.put('/:id/change-password', requireSuperAdmin, masterUsersController.changeMasterPassword);

// Ativar/Desativar usuário master
router.put('/:id/toggle-active', requireSuperAdmin, masterUsersController.toggleMasterActive);

module.exports = router;


