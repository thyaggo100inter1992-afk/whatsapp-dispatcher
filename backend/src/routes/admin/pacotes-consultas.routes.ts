/**
 * Rotas Admin - Gerenciamento de Pacotes de Consultas Avulsas
 * Apenas Super Admins podem acessar
 */

import { Router } from 'express';
import { pacotesConsultasAdminController } from '../../controllers/admin/pacotes-consultas.controller';

const router = Router();

// Nota: authenticate e requireSuperAdmin são aplicados no index.ts
// Não precisa aplicar aqui novamente

// GET /api/admin/pacotes-consultas - Listar todos os pacotes
router.get('/', pacotesConsultasAdminController.listarTodos);

// GET /api/admin/pacotes-consultas/:id - Buscar pacote específico
router.get('/:id', pacotesConsultasAdminController.buscarPorId);

// POST /api/admin/pacotes-consultas - Criar novo pacote
router.post('/', pacotesConsultasAdminController.criar);

// PUT /api/admin/pacotes-consultas/:id - Atualizar pacote
router.put('/:id', pacotesConsultasAdminController.atualizar);

// DELETE /api/admin/pacotes-consultas/:id - Deletar pacote (soft delete)
router.delete('/:id', pacotesConsultasAdminController.deletar);

// PATCH /api/admin/pacotes-consultas/:id/toggle-popular - Marcar como popular
router.patch('/:id/toggle-popular', pacotesConsultasAdminController.togglePopular);

export default router;

