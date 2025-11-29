/**
 * Rotas Admin - Gerenciamento de Faixas de Preço
 * Apenas Super Admins podem acessar
 */

import { Router } from 'express';
import { faixasPrecoConsultasAdminController } from '../../controllers/admin/faixas-preco-consultas.controller';

const router = Router();

// GET /api/admin/faixas-preco-consultas - Listar todas as faixas
router.get('/', faixasPrecoConsultasAdminController.listarTodas);

// POST /api/admin/faixas-preco-consultas - Criar nova faixa
router.post('/', faixasPrecoConsultasAdminController.criar);

// PUT /api/admin/faixas-preco-consultas/:id - Atualizar faixa
router.put('/:id', faixasPrecoConsultasAdminController.atualizar);

// DELETE /api/admin/faixas-preco-consultas/:id - Deletar faixa
router.delete('/:id', faixasPrecoConsultasAdminController.deletar);

export default router;




