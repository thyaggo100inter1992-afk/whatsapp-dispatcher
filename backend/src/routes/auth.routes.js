/**
 * Rotas de Autenticação Multi-Tenant
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth.middleware');

/**
 * @route POST /api/auth/login
 * @desc Login de usuário
 * @access Public
 */
router.post('/login', authController.login);

/**
 * @route POST /api/auth/register
 * @desc Registro de novo tenant (empresa) com usuário admin
 * @access Public
 */
router.post('/register', authController.register);

/**
 * @route POST /api/auth/refresh
 * @desc Renovar access token
 * @access Public
 */
router.post('/refresh', authController.refresh);

/**
 * @route GET /api/auth/me
 * @desc Dados do usuário autenticado
 * @access Private
 */
router.get('/me', authenticate, authController.me);

/**
 * @route POST /api/auth/logout
 * @desc Logout do usuário
 * @access Private
 */
router.post('/logout', authenticate, authController.logout);

module.exports = router;





