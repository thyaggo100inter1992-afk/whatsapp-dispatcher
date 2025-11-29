const express = require('express');
const {
  getProfile,
  updateProfile,
  updateTenant,
  changePassword,
  uploadAvatar,
  removeAvatar
} = require('../../controllers/users/profile.controller');

const router = express.Router();

/**
 * Rotas de Perfil do Usuário
 * Base: /api/users/profile
 */

// GET /api/users/profile - Obter dados do perfil
router.get('/', getProfile);

// PUT /api/users/profile - Atualizar perfil (apenas nome e telefone - email e CPF não podem ser alterados)
router.put('/', updateProfile);

// PUT /api/users/profile/tenant - Atualizar dados do tenant
router.put('/tenant', updateTenant);

// POST /api/users/profile/change-password - Alterar senha
router.post('/change-password', changePassword);

// POST /api/users/profile/avatar - Upload de avatar
router.post('/avatar', uploadAvatar);

// DELETE /api/users/profile/avatar - Remover avatar
router.delete('/avatar', removeAvatar);

module.exports = router;
