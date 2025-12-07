import express from 'express';
import { conversationController } from '../controllers/conversation.controller';

const router = express.Router();

/**
 * Rotas do Sistema de Chat
 */

// GET /api/conversations/unread-count - Contador de não lidas (ANTES de /:id)
router.get('/unread-count', (req, res) => conversationController.getUnreadCount(req, res));

// POST /api/conversations/create - Criar nova conversa
router.post('/create', (req, res) => conversationController.create(req, res));

// GET /api/conversations - Listar conversas
router.get('/', (req, res) => conversationController.list(req, res));

// GET /api/conversations/:id - Buscar conversa específica
router.get('/:id', (req, res) => conversationController.getById(req, res));

// GET /api/conversations/:id/messages - Buscar mensagens da conversa
router.get('/:id/messages', (req, res) => conversationController.getMessages(req, res));

// POST /api/conversations/:id/messages - Enviar mensagem
router.post('/:id/messages', (req, res) => conversationController.sendMessage(req, res));

// PUT /api/conversations/:id/read - Marcar como lida
router.put('/:id/read', (req, res) => conversationController.markAsRead(req, res));

// PUT /api/conversations/:id/archive - Arquivar/desarquivar
router.put('/:id/archive', (req, res) => conversationController.toggleArchive(req, res));

export default router;

