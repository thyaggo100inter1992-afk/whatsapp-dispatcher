const express = require('express');
const router = express.Router();
const profileController = require('../../controllers/admin/profile.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { requireSuperAdmin } = require('../../middleware/super-admin.middleware');

// GET /api/admin/profile - Obter perfil do Super Admin
router.get('/', authenticate, requireSuperAdmin, profileController.getSuperAdminProfile);

// PUT /api/admin/profile - Atualizar perfil do Super Admin
router.put('/', authenticate, requireSuperAdmin, profileController.updateSuperAdminProfile);

// POST /api/admin/profile/avatar - Upload de avatar do Super Admin
router.post('/avatar', authenticate, requireSuperAdmin, profileController.uploadSuperAdminAvatar);

module.exports = router;

