/**
 * Controller Admin - Gerenciamento de Faixas de Preço
 * Para quantidade personalizada de consultas avulsas
 */

import { Request, Response } from 'express';
import { pool } from '../../database/connection';

class FaixasPrecoConsultasAdminController {
  /**
   * GET /api/admin/faixas-preco-consultas
   * Listar todas as faixas de preço
   */
  async listarTodas(req: Request, res: Response) {
    try {
      console.log('📊 Listando todas as faixas de preço...');

      const result = await pool.query(`
        SELECT 
          id,
          quantidade_min,
          quantidade_max,
          preco_unitario,
          ativo,
          ordem,
          created_at,
          updated_at
        FROM consultas_faixas_preco
        ORDER BY ordem ASC, quantidade_min ASC
      `);

      const faixas = result.rows.map(row => ({
        id: row.id,
        quantidade_min: parseInt(row.quantidade_min),
        quantidade_max: row.quantidade_max ? parseInt(row.quantidade_max) : null,
        preco_unitario: parseFloat(row.preco_unitario),
        ativo: row.ativo || false,
        ordem: row.ordem || 0,
        created_at: row.created_at,
        updated_at: row.updated_at
      }));

      console.log(`✅ ${faixas.length} faixas encontradas`);

      return res.json({
        success: true,
        faixas
      });
    } catch (error: any) {
      console.error('❌ Erro ao listar faixas:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao listar faixas',
        error: error.message
      });
    }
  }

  /**
   * POST /api/admin/faixas-preco-consultas
   * Criar nova faixa
   */
  async criar(req: Request, res: Response) {
    try {
      const { quantidade_min, quantidade_max, preco_unitario, ativo, ordem } = req.body;

      // Validações
      if (quantidade_min === undefined || preco_unitario === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Quantidade mínima e preço unitário são obrigatórios'
        });
      }

      if (quantidade_min < 0 || preco_unitario <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Valores inválidos'
        });
      }

      if (quantidade_max !== null && quantidade_max !== undefined && quantidade_max <= quantidade_min) {
        return res.status(400).json({
          success: false,
          message: 'Quantidade máxima deve ser maior que a mínima'
        });
      }

      console.log(`📊 Criando nova faixa de preço: ${quantidade_min}-${quantidade_max || '∞'}`);

      const result = await pool.query(`
        INSERT INTO consultas_faixas_preco
          (quantidade_min, quantidade_max, preco_unitario, ativo, ordem)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [
        parseInt(quantidade_min),
        quantidade_max ? parseInt(quantidade_max) : null,
        parseFloat(preco_unitario),
        ativo !== false,
        parseInt(ordem || 0)
      ]);

      console.log(`✅ Faixa criada com ID: ${result.rows[0].id}`);

      return res.status(201).json({
        success: true,
        message: 'Faixa criada com sucesso',
        faixa: result.rows[0]
      });
    } catch (error: any) {
      console.error('❌ Erro ao criar faixa:', error);
      
      if (error.code === '23505') {
        return res.status(400).json({
          success: false,
          message: 'Já existe uma faixa com essas quantidades'
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Erro ao criar faixa',
        error: error.message
      });
    }
  }

  /**
   * PUT /api/admin/faixas-preco-consultas/:id
   * Atualizar faixa existente
   */
  async atualizar(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { quantidade_min, quantidade_max, preco_unitario, ativo, ordem } = req.body;

      // Verificar se a faixa existe e buscar dados atuais
      const checkResult = await pool.query(
        'SELECT * FROM consultas_faixas_preco WHERE id = $1',
        [id]
      );

      if (checkResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Faixa não encontrada'
        });
      }

      // Validações
      if (quantidade_min !== undefined && quantidade_min < 0) {
        return res.status(400).json({
          success: false,
          message: 'Quantidade mínima inválida'
        });
      }

      if (preco_unitario !== undefined && preco_unitario <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Preço unitário deve ser maior que zero'
        });
      }

      console.log(`📊 Atualizando faixa ID ${id}...`);

      // Buscar faixa atual
      const currentFaixa = checkResult.rows[0];

      // Preparar valores finais
      const finalQuantidadeMin = quantidade_min !== undefined ? parseInt(quantidade_min) : currentFaixa.quantidade_min;
      const finalQuantidadeMax = quantidade_max !== undefined ? (quantidade_max === '' || quantidade_max === null ? null : parseInt(quantidade_max)) : currentFaixa.quantidade_max;
      const finalPrecoUnitario = preco_unitario !== undefined ? parseFloat(preco_unitario) : currentFaixa.preco_unitario;
      const finalAtivo = ativo !== undefined ? ativo : currentFaixa.ativo;
      const finalOrdem = ordem !== undefined ? parseInt(ordem) : currentFaixa.ordem;

      const result = await pool.query(`
        UPDATE consultas_faixas_preco
        SET
          quantidade_min = $1,
          quantidade_max = $2,
          preco_unitario = $3,
          ativo = $4,
          ordem = $5,
          updated_at = NOW()
        WHERE id = $6
        RETURNING *
      `, [
        finalQuantidadeMin,
        finalQuantidadeMax,
        finalPrecoUnitario,
        finalAtivo,
        finalOrdem,
        id
      ]);

      console.log(`✅ Faixa atualizada com sucesso`);

      return res.json({
        success: true,
        message: 'Faixa atualizada com sucesso',
        faixa: result.rows[0]
      });
    } catch (error: any) {
      console.error('❌ Erro ao atualizar faixa:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao atualizar faixa',
        error: error.message
      });
    }
  }

  /**
   * DELETE /api/admin/faixas-preco-consultas/:id
   * Deletar faixa
   */
  async deletar(req: Request, res: Response) {
    try {
      const { id } = req.params;

      console.log(`📊 Deletando faixa ID ${id}...`);

      const result = await pool.query(`
        DELETE FROM consultas_faixas_preco
        WHERE id = $1
        RETURNING *
      `, [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Faixa não encontrada'
        });
      }

      console.log(`✅ Faixa deletada`);

      return res.json({
        success: true,
        message: 'Faixa deletada com sucesso'
      });
    } catch (error: any) {
      console.error('❌ Erro ao deletar faixa:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao deletar faixa',
        error: error.message
      });
    }
  }
}

export const faixasPrecoConsultasAdminController = new FaixasPrecoConsultasAdminController();

