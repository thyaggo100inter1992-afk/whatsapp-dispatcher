import { Request, Response } from 'express';
import { queryNoTenant } from '../database/tenant-query';

export class ButtonClicksController {
  /**
   * Listar todos os cliques de botões com paginação e filtros
   */
  async listClicks(req: Request, res: Response) {
    try {
      const { page = 1, limit = 20, button_text, date_from, date_to } = req.query;
      const tenantId = (req as any).tenant?.id;
      
      const offset = (Number(page) - 1) * Number(limit);
      
      // Construir filtros
      const filters: string[] = ['m.tenant_id = $1'];
      const params: any[] = [tenantId];
      let paramIndex = 2;
      
      if (button_text) {
        filters.push(`bc.button_text ILIKE $${paramIndex}`);
        params.push(`%${button_text}%`);
        paramIndex++;
      }
      
      if (date_from) {
        filters.push(`bc.clicked_at >= $${paramIndex}::date`);
        params.push(date_from);
        paramIndex++;
      }
      
      if (date_to) {
        // Adiciona 1 dia e compara com < (ao invés de <=) para incluir todo o dia final
        filters.push(`bc.clicked_at < ($${paramIndex}::date + interval '1 day')`);
        params.push(date_to);
        paramIndex++;
      }
      
      const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';
      
      // Contar total
      const countQuery = `
        SELECT COUNT(*) as total
        FROM button_clicks bc
        INNER JOIN messages m ON bc.message_id = m.id
        ${whereClause}
      `;
      
      const countResult = await queryNoTenant(countQuery, params);
      const total = parseInt(countResult.rows[0].total) || 0;
      
      // Buscar dados
      const dataQuery = `
        SELECT 
          bc.id,
          bc.button_text,
          bc.button_payload,
          bc.phone_number,
          bc.contact_name,
          bc.clicked_at,
          bc.campaign_id,
          bc.campaign_type,
          c.name as campaign_name,
          m.template_name,
          wa.name as account_name,
          wa.phone_number as account_phone
        FROM button_clicks bc
        INNER JOIN messages m ON bc.message_id = m.id
        LEFT JOIN campaigns c ON bc.campaign_id = c.id
        LEFT JOIN whatsapp_accounts wa ON m.whatsapp_account_id = wa.id
        ${whereClause}
        ORDER BY bc.clicked_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      
      params.push(Number(limit), offset);
      
      const dataResult = await queryNoTenant(dataQuery, params);
      
      return res.json({
        success: true,
        data: {
          clicks: dataResult.rows,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            totalPages: Math.ceil(total / Number(limit)),
          },
        },
      });
    } catch (error) {
      console.error('❌ Erro ao listar cliques:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to list button clicks',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Ranking dos botões mais clicados
   */
  async getRanking(req: Request, res: Response) {
    try {
      const { date_from, date_to, limit = 5 } = req.query;
      const tenantId = (req as any).tenant?.id;
      
      // Construir filtros de data
      const filters: string[] = ['m.tenant_id = $1'];
      const params: any[] = [tenantId];
      let paramIndex = 2;
      
      if (date_from) {
        filters.push(`bc.clicked_at >= $${paramIndex}::date`);
        params.push(date_from);
        paramIndex++;
      }
      
      if (date_to) {
        // Adiciona 1 dia e compara com < (ao invés de <=) para incluir todo o dia final
        filters.push(`bc.clicked_at < ($${paramIndex}::date + interval '1 day')`);
        params.push(date_to);
        paramIndex++;
      }
      
      const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';
      
      const rankingQuery = `
        SELECT 
          bc.button_text,
          bc.button_payload,
          COUNT(*) as click_count,
          COUNT(DISTINCT bc.phone_number) as unique_contacts,
          MIN(bc.clicked_at) as first_click,
          MAX(bc.clicked_at) as last_click,
          COUNT(DISTINCT bc.campaign_id) as campaigns_count
        FROM button_clicks bc
        INNER JOIN messages m ON bc.message_id = m.id
        ${whereClause}
        GROUP BY bc.button_text, bc.button_payload
        ORDER BY click_count DESC
        LIMIT $${paramIndex}
      `;
      
      params.push(Number(limit));
      
      const result = await queryNoTenant(rankingQuery, params);
      
      return res.json({
        success: true,
        data: {
          ranking: result.rows.map((row, index) => ({
            rank: index + 1,
            button_text: row.button_text,
            button_payload: row.button_payload,
            click_count: parseInt(row.click_count),
            unique_contacts: parseInt(row.unique_contacts),
            campaigns_count: parseInt(row.campaigns_count),
            first_click: row.first_click,
            last_click: row.last_click,
          })),
        },
      });
    } catch (error) {
      console.error('❌ Erro ao buscar ranking:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch button clicks ranking',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Estatísticas gerais de cliques
   */
  async getStats(req: Request, res: Response) {
    try {
      const { date_from, date_to } = req.query;
      const tenantId = (req as any).tenant?.id;
      
      // Construir filtros de data
      const filters: string[] = ['m.tenant_id = $1'];
      const params: any[] = [tenantId];
      let paramIndex = 2;
      
      if (date_from) {
        filters.push(`bc.clicked_at >= $${paramIndex}::date`);
        params.push(date_from);
        paramIndex++;
      }
      
      if (date_to) {
        // Adiciona 1 dia e compara com < (ao invés de <=) para incluir todo o dia final
        filters.push(`bc.clicked_at < ($${paramIndex}::date + interval '1 day')`);
        params.push(date_to);
        paramIndex++;
      }
      
      const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';
      
      const statsQuery = `
        SELECT 
          COUNT(*) as total_clicks,
          COUNT(DISTINCT bc.button_text) as unique_buttons,
          COUNT(DISTINCT bc.phone_number) as unique_contacts,
          COUNT(DISTINCT bc.campaign_id) as campaigns_with_clicks,
          COUNT(DISTINCT DATE(bc.clicked_at)) as days_with_clicks
        FROM button_clicks bc
        INNER JOIN messages m ON bc.message_id = m.id
        ${whereClause}
      `;
      
      const result = await queryNoTenant(statsQuery, params);
      const stats = result.rows[0];
      
      return res.json({
        success: true,
        data: {
          total_clicks: parseInt(stats.total_clicks) || 0,
          unique_buttons: parseInt(stats.unique_buttons) || 0,
          unique_contacts: parseInt(stats.unique_contacts) || 0,
          campaigns_with_clicks: parseInt(stats.campaigns_with_clicks) || 0,
          days_with_clicks: parseInt(stats.days_with_clicks) || 0,
        },
      });
    } catch (error) {
      console.error('❌ Erro ao buscar estatísticas:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch button clicks stats',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

