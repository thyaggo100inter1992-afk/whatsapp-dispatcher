import { Router } from 'express';
const authController = require('../controllers/auth.controller');
import { tenantAuth } from '../middlewares/tenant-auth.middleware';

const router = Router();

/**
 * Rotas públicas (sem autenticação)
 */

// Login
router.post('/login', authController.login);

// Registro de novo tenant
router.post('/register', authController.register);

/**
 * Rotas protegidas (requerem autenticação)
 */

// Verificar token / Obter dados do usuário logado
router.get('/me', tenantAuth, authController.me);

// Logout
router.post('/logout', tenantAuth, authController.logout);

// Alterar senha - TODO: implementar no controller
// router.post('/change-password', tenantAuth, authController.changePassword);

// Refresh token
router.post('/refresh', authController.refresh);

export default router;



