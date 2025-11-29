/**
 * Controller Admin - Gerenciamento de Pacotes de Consultas Avulsas
 * Super Admin pode criar, editar, deletar pacotes
 */

import { Request, Response } from 'express';
import { pool } from '../../database/connection';

class PacotesConsultasAdminController {
  /**
   * GET /api/admin/pacotes-consultas
   * Listar todos os pacotes (incluindo inativos)
   */
  async listarTodos(req: Request, res: Response) {
    try {
      console.log('📦 Listando todos os pacotes de consultas...');

      const result = await pool.query(`
        SELECT 
          id,
          nome,
          quantidade,
          preco,
          preco_unitario,
          desconto,
          popular,
          ativo,
          ordem,
          created_at,
          updated_at
        FROM consultas_avulsas_pacotes
        ORDER BY ordem ASC, id ASC
      `);

      const pacotes = result.rows.map(row => ({
        id: row.id,
        nome: row.nome,
        quantidade: parseInt(row.quantidade),
        preco: parseFloat(row.preco),
        preco_unitario: parseFloat(row.preco_unitario),
        desconto: parseInt(row.desconto || 0),
        popular: row.popular || false,
        ativo: row.ativo || false,
        ordem: row.ordem || 0,
        created_at: row.created_at,
        updated_at: row.updated_at
      }));

      console.log(`✅ ${pacotes.length} pacotes encontrados`);

      return res.json({
        success: true,
        pacotes
      });
    } catch (error: any) {
      console.error('❌ Erro ao listar pacotes:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao listar pacotes',
        error: error.message
      });
    }
  }

  /**
   * GET /api/admin/pacotes-consultas/:id
   * Buscar um pacote específico
   */
  async buscarPorId(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const result = await pool.query(`
        SELECT * FROM consultas_avulsas_pacotes WHERE id = $1
      `, [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Pacote não encontrado'
        });
      }

      return res.json({
        success: true,
        pacote: result.rows[0]
      });
    } catch (error: any) {
      console.error('❌ Erro ao buscar pacote:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao buscar pacote',
        error: error.message
      });
    }
  }

  /**
   * POST /api/admin/pacotes-consultas
   * Criar novo pacote
   */
  async criar(req: Request, res: Response) {
    try {
      const { nome, quantidade, preco, desconto, popular, ativo, ordem } = req.body;

      // Validações
      if (!nome || !quantidade || !preco) {
        return res.status(400).json({
          success: false,
          message: 'Nome, quantidade e preço são obrigatórios'
        });
      }

      if (quantidade <= 0 || preco <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Quantidade e preço devem ser maiores que zero'
        });
      }

      console.log(`📦 Criando novo pacote: ${nome}`);

      const result = await pool.query(`
        INSERT INTO consultas_avulsas_pacotes
          (nome, quantidade, preco, desconto, popular, ativo, ordem)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [
        nome,
        parseInt(quantidade),
        parseFloat(preco),
        parseInt(desconto || 0),
        popular || false,
        ativo !== false,
        parseInt(ordem || 0)
      ]);

      console.log(`✅ Pacote criado com ID: ${result.rows[0].id}`);

      return res.status(201).json({
        success: true,
        message: 'Pacote criado com sucesso',
        pacote: result.rows[0]
      });
    } catch (error: any) {
      console.error('❌ Erro ao criar pacote:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao criar pacote',
        error: error.message
      });
    }
  }

  /**
   * PUT /api/admin/pacotes-consultas/:id
   * Atualizar pacote existente
   */
  async atualizar(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { nome, quantidade, preco, desconto, popular, ativo, ordem } = req.body;

      // Verificar se o pacote existe
      const checkResult = await pool.query(
        'SELECT id FROM consultas_avulsas_pacotes WHERE id = $1',
        [id]
      );

      if (checkResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Pacote não encontrado'
        });
      }

      // Validações
      if (quantidade !== undefined && quantidade <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Quantidade deve ser maior que zero'
        });
      }

      if (preco !== undefined && preco <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Preço deve ser maior que zero'
        });
      }

      console.log(`📦 Atualizando pacote ID ${id}...`);

      const result = await pool.query(`
        UPDATE consultas_avulsas_pacotes
        SET
          nome = COALESCE($1, nome),
          quantidade = COALESCE($2, quantidade),
          preco = COALESCE($3, preco),
          desconto = COALESCE($4, desconto),
          popular = COALESCE($5, popular),
          ativo = COALESCE($6, ativo),
          ordem = COALESCE($7, ordem),
          updated_at = NOW()
        WHERE id = $8
        RETURNING *
      `, [
        nome,
        quantidade ? parseInt(quantidade) : null,
        preco ? parseFloat(preco) : null,
        desconto !== undefined ? parseInt(desconto) : null,
        popular !== undefined ? popular : null,
        ativo !== undefined ? ativo : null,
        ordem !== undefined ? parseInt(ordem) : null,
        id
      ]);

      console.log(`✅ Pacote atualizado com sucesso`);

      return res.json({
        success: true,
        message: 'Pacote atualizado com sucesso',
        pacote: result.rows[0]
      });
    } catch (error: any) {
      console.error('❌ Erro ao atualizar pacote:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao atualizar pacote',
        error: error.message
      });
    }
  }

  /**
   * DELETE /api/admin/pacotes-consultas/:id
   * Deletar pacote (soft delete - marca como inativo)
   */
  async deletar(req: Request, res: Response) {
    try {
      const { id } = req.params;

      console.log(`📦 Deletando pacote ID ${id}...`);

      // Soft delete - apenas marca como inativo
      const result = await pool.query(`
        UPDATE consultas_avulsas_pacotes
        SET ativo = false, updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `, [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Pacote não encontrado'
        });
      }

      console.log(`✅ Pacote marcado como inativo`);

      return res.json({
        success: true,
        message: 'Pacote deletado com sucesso'
      });
    } catch (error: any) {
      console.error('❌ Erro ao deletar pacote:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao deletar pacote',
        error: error.message
      });
    }
  }

  /**
   * PATCH /api/admin/pacotes-consultas/:id/toggle-popular
   * Alternar status de "popular" do pacote
   */
  async togglePopular(req: Request, res: Response) {
    try {
      const { id } = req.params;

      console.log(`⭐ Alternando status popular do pacote ID ${id}...`);

      // Primeiro, remove popular de todos
      await pool.query('UPDATE consultas_avulsas_pacotes SET popular = false');

      // Depois marca o selecionado como popular
      const result = await pool.query(`
        UPDATE consultas_avulsas_pacotes
        SET popular = true, updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `, [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Pacote não encontrado'
        });
      }

      console.log(`✅ Pacote marcado como popular`);

      return res.json({
        success: true,
        message: 'Pacote marcado como popular',
        pacote: result.rows[0]
      });
    } catch (error: any) {
      console.error('❌ Erro ao alternar popular:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao alternar status popular',
        error: error.message
      });
    }
  }
}

export const pacotesConsultasAdminController = new PacotesConsultasAdminController();




