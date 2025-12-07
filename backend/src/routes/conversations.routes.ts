import express from 'express';
import { conversationController } from '../controllers/conversation.controller';
import { checkChatPermission } from '../middleware/checkChatPermission';

const router = express.Router();

/**
 * Rotas do Sistema de Chat
 * TODAS as rotas aqui requerem permissão de chat
 */

// Aplicar middleware de verificação de permissão para TODAS as rotas
router.use(checkChatPermission);

// GET /api/conversations/unread-count - Contador de não lidas (ANTES de /:id)
router.get('/unread-count', (req, res) => conversationController.getUnreadCount(req, res));

// GET /api/conversations/status-counts - Contador por status (ANTES de /:id)
router.get('/status-counts', (req, res) => conversationController.getStatusCounts(req, res));

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

// POST /api/conversations/:id/messages/media - Enviar mídia (imagem, documento, áudio)
router.post('/:id/messages/media', (req, res) => conversationController.sendMediaMessage(req, res));

// PUT /api/conversations/:id/read - Marcar como lida
router.put('/:id/read', (req, res) => conversationController.markAsRead(req, res));

// PUT /api/conversations/:id/archive - Arquivar/desarquivar
router.put('/:id/archive', (req, res) => conversationController.toggleArchive(req, res));

// PUT /api/conversations/:id/accept - Aceitar conversa pendente
router.put('/:id/accept', (req, res) => conversationController.acceptConversation(req, res));

// DELETE /api/conversations/:id - Apagar conversa permanentemente
router.delete('/:id', (req, res) => conversationController.deleteConversation(req, res));

export default router;


