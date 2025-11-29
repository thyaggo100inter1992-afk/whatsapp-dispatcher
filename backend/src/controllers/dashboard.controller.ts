import { Request, Response } from 'express';
import { pool } from '../database/connection';

export class DashboardController {
  async getStats(req: Request, res: Response) {
    try {
      const { startDate, endDate } = req.query;
      const tenantId = (req as any).tenant?.id;

      console.log('📊 Buscando estatísticas do dashboard...', { startDate, endDate, tenantId });

      // Query para estatísticas de campanhas
      const campaignStatsQuery = `
        SELECT 
          COUNT(*) as total_campaigns,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_campaigns,
          COUNT(CASE WHEN status = 'running' THEN 1 END) as running_campaigns,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_campaigns,
          COUNT(CASE WHEN status = 'paused' THEN 1 END) as paused_campaigns,
          COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_campaigns
        FROM campaigns
        WHERE tenant_id = $1
          ${startDate ? 'AND created_at >= $2' : ''}
          ${endDate ? `AND created_at <= $${startDate ? '3' : '2'}` : ''}
      `;

      const campaignParams = [tenantId];
      if (startDate) campaignParams.push(startDate as string);
      if (endDate) campaignParams.push(endDate as string);

      const campaignStats = await pool.query(campaignStatsQuery, campaignParams);

      // Query para estatísticas de mensagens
      const messageStatsQuery = `
        SELECT 
          COUNT(*) as total_messages,
          COUNT(CASE WHEN sent_at IS NOT NULL THEN 1 END) as sent_messages,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_messages,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_messages,
          COUNT(CASE WHEN delivered_at IS NOT NULL THEN 1 END) as delivered_messages,
          COUNT(CASE WHEN read_at IS NOT NULL THEN 1 END) as read_messages
        FROM messages
        WHERE campaign_id IS NOT NULL
          AND tenant_id = $1
        ${startDate ? 'AND sent_at >= $2' : ''}
        ${endDate ? `AND sent_at <= $${startDate ? '3' : '2'}` : ''}
      `;

      const messageParams = [tenantId];
      if (startDate) messageParams.push(startDate as string);
      if (endDate) messageParams.push(endDate as string);

      const messageStats = await pool.query(messageStatsQuery, messageParams);
      
      // Query para cliques de botões em campanhas
      const buttonClicksQuery = `
        SELECT 
          COUNT(*) as total_button_clicks,
          COUNT(DISTINCT bc.button_text) as unique_buttons,
          COUNT(DISTINCT bc.phone_number) as unique_contacts_clicked
        FROM button_clicks bc
        INNER JOIN messages m ON bc.message_id = m.id
        WHERE m.campaign_id IS NOT NULL
          AND m.tenant_id = $1
          ${startDate ? 'AND bc.clicked_at >= $2' : ''}
          ${endDate ? `AND bc.clicked_at <= $${startDate ? '3' : '2'}` : ''}
      `;
      
      const buttonClickParams = [tenantId];
      if (startDate) buttonClickParams.push(startDate as string);
      if (endDate) buttonClickParams.push(endDate as string);
      
      const buttonClickStats = await pool.query(buttonClicksQuery, buttonClickParams);

      // Query para contas WhatsApp ativas
      const accountsQuery = `
        SELECT 
          COUNT(*) as total_accounts,
          COUNT(CASE WHEN is_active = true THEN 1 END) as active_accounts
        FROM whatsapp_accounts
        WHERE tenant_id = $1
      `;

      const accountStats = await pool.query(accountsQuery, [tenantId]);

      // Query para campanhas QR
      const qrCampaignStatsQuery = `
        SELECT 
          COUNT(*) as total_qr_campaigns,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_qr_campaigns,
          COUNT(CASE WHEN status = 'running' THEN 1 END) as running_qr_campaigns
        FROM qr_campaigns
        WHERE tenant_id = $1
          ${startDate ? 'AND created_at >= $2' : ''}
          ${endDate ? `AND created_at <= $${startDate ? '3' : '2'}` : ''}
      `;

      const qrParams = [tenantId];
      if (startDate) qrParams.push(startDate as string);
      if (endDate) qrParams.push(endDate as string);

      const qrCampaignStats = await pool.query(qrCampaignStatsQuery, qrParams);

      // Calcular taxas (rates)
      const totalMessages = parseInt(messageStats.rows[0].total_messages) || 0;
      const deliveredMessages = parseInt(messageStats.rows[0].delivered_messages) || 0;
      const readMessages = parseInt(messageStats.rows[0].read_messages) || 0;
      const sentMessages = parseInt(messageStats.rows[0].sent_messages) || 0;
      const failedMessages = parseInt(messageStats.rows[0].failed_messages) || 0;

      const deliveryRate = totalMessages > 0 ? (deliveredMessages / totalMessages) * 100 : 0;
      const readRate = totalMessages > 0 ? (readMessages / totalMessages) * 100 : 0;
      const failureRate = totalMessages > 0 ? (failedMessages / totalMessages) * 100 : 0;

      // Buscar campanhas recentes
      const recentCampaignsQuery = `
        SELECT 
          id, name, status, total_contacts, sent_count, 
          delivered_count, read_count, failed_count, created_at
        FROM campaigns
        WHERE tenant_id = $1
        ORDER BY created_at DESC
        LIMIT 5
      `;
      const recentCampaigns = await pool.query(recentCampaignsQuery, [tenantId]);

      // Mapear para o formato que o frontend espera
      const campaignData = campaignStats.rows[0];
      const messageData = messageStats.rows[0];
      const buttonData = buttonClickStats.rows[0];
      
      const stats = {
        campaigns: {
          total: parseInt(campaignData.total_campaigns) || 0,
          active: parseInt(campaignData.running_campaigns) || 0,
          completed: parseInt(campaignData.completed_campaigns) || 0,
          paused: parseInt(campaignData.paused_campaigns) || 0,
          cancelled: parseInt(campaignData.cancelled_campaigns) || 0,
        },
        messages: {
          total_sent: parseInt(messageData.sent_messages) || 0,
          total_delivered: parseInt(messageData.delivered_messages) || 0,
          total_read: parseInt(messageData.read_messages) || 0,
          total_failed: parseInt(messageData.failed_messages) || 0,
          total_no_whatsapp: 0, // TODO: calcular corretamente
          total_button_clicks: parseInt(buttonData.total_button_clicks) || 0,
          total_contacts: 0, // TODO: calcular se necessário
          unique_buttons: parseInt(buttonData.unique_buttons) || 0,
          unique_click_contacts: parseInt(buttonData.unique_contacts_clicked) || 0,
        },
        accounts: {
          total: parseInt(accountStats.rows[0].total_accounts) || 0,
          active: parseInt(accountStats.rows[0].active_accounts) || 0,
          inactive: parseInt(accountStats.rows[0].total_accounts) - parseInt(accountStats.rows[0].active_accounts) || 0,
        },
        rates: {
          delivery: deliveryRate,
          read: readRate,
          failure: failureRate,
        },
        recent_campaigns: recentCampaigns.rows,
      };

      console.log('✅ Estatísticas carregadas (formato frontend):', stats);

      return res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error('❌ Erro ao buscar estatísticas:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch dashboard stats',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getRecentActivity(req: Request, res: Response) {
    try {
      const tenantId = (req as any).tenant?.id;
      const limit = parseInt(req.query.limit as string) || 10;

      // Buscar atividades recentes (últimas mensagens, campanhas criadas, etc.)
      const activityQuery = `
        SELECT 
          'message' as type,
          m.id,
          m.status,
          m.created_at,
          c.name as campaign_name,
          m.phone_number
        FROM messages m
        LEFT JOIN campaigns c ON c.id = m.campaign_id
        WHERE c.tenant_id = $1
        ORDER BY m.created_at DESC
        LIMIT $2
      `;

      const activities = await pool.query(activityQuery, [tenantId, limit]);

      return res.json({
        success: true,
        data: activities.rows,
      });
    } catch (error) {
      console.error('❌ Erro ao buscar atividades:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch recent activity',
      });
    }
  }

  async getImmediateStats(req: Request, res: Response) {
    try {
      const { startDate, endDate } = req.query;
      const tenantId = (req as any).tenant?.id;

      console.log('📊 Buscando estatísticas de envio imediato...', { startDate, endDate, tenantId });

      // Estatísticas de mensagens enviadas imediatamente (sem campanha)
      const immediateStatsQuery = `
        SELECT 
          COUNT(*) as total_sent,
          COUNT(CASE WHEN delivered_at IS NOT NULL THEN 1 END) as total_delivered,
          COUNT(CASE WHEN read_at IS NOT NULL THEN 1 END) as total_read,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as total_failed,
          COUNT(DISTINCT phone_number) as unique_contacts
        FROM messages
        WHERE campaign_id IS NULL
          AND tenant_id = $1
          ${startDate ? 'AND sent_at >= $2' : ''}
          ${endDate ? `AND sent_at <= $${startDate ? '3' : '2'}` : ''}
      `;

      const params = [tenantId];
      if (startDate) params.push(startDate as string);
      if (endDate) params.push(endDate as string);

      const stats = await pool.query(immediateStatsQuery, params);

      // Buscar cliques em botões de mensagens imediatas
      const buttonClicksQuery = `
        SELECT 
          COUNT(*) as total_clicks,
          COUNT(DISTINCT bc.button_text) as unique_buttons,
          COUNT(DISTINCT bc.phone_number) as unique_contacts
        FROM button_clicks bc
        INNER JOIN messages m ON bc.message_id = m.id
        WHERE m.campaign_id IS NULL
          AND m.tenant_id = $1
          ${startDate ? 'AND bc.clicked_at >= $2' : ''}
          ${endDate ? `AND bc.clicked_at <= $${startDate ? '3' : '2'}` : ''}
      `;

      const buttonParams = [tenantId];
      if (startDate) buttonParams.push(startDate as string);
      if (endDate) buttonParams.push(endDate as string);

      const buttonClicks = await pool.query(buttonClicksQuery, buttonParams);

      // Calcular taxas para mensagens imediatas
      const totalSent = parseInt(stats.rows[0].total_sent) || 0;
      const totalDelivered = parseInt(stats.rows[0].total_delivered) || 0;
      const totalRead = parseInt(stats.rows[0].total_read) || 0;
      const totalFailed = parseInt(stats.rows[0].total_failed) || 0;

      const deliveryRate = totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0;
      const readRate = totalSent > 0 ? (totalRead / totalSent) * 100 : 0;
      const failureRate = totalSent > 0 ? (totalFailed / totalSent) * 100 : 0;

      // Garantir que retorna números ao invés de strings
      const result = {
        total_sent: totalSent,
        total_delivered: totalDelivered,
        total_read: totalRead,
        total_failed: totalFailed,
        unique_contacts: parseInt(stats.rows[0].unique_contacts) || 0,
        button_clicks: {
          total_clicks: parseInt(buttonClicks.rows[0].total_clicks) || 0,
          unique_buttons: parseInt(buttonClicks.rows[0].unique_buttons) || 0,
          unique_contacts: parseInt(buttonClicks.rows[0].unique_contacts) || 0,
        },
        rates: {
          delivery: deliveryRate,
          read: readRate,
          failure: failureRate,
        },
      };

      console.log('✅ Estatísticas de envio imediato carregadas:', result);

      return res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('❌ Erro ao buscar estatísticas imediatas:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch immediate stats',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getImmediateLog(req: Request, res: Response) {
    try {
      const { startDate, endDate } = req.query;
      const tenantId = (req as any).tenant?.id;
      const limit = parseInt(req.query.limit as string) || 50;

      console.log('📜 Buscando log de mensagens imediatas...', { startDate, endDate, tenantId, limit });

      // Log de mensagens enviadas imediatamente
      const logQuery = `
        SELECT 
          m.id,
          m.phone_number,
          m.template_name,
          m.status,
          m.created_at,
          m.sent_at,
          m.error_message,
          wa.phone_number as whatsapp_account_number
        FROM messages m
        LEFT JOIN whatsapp_accounts wa ON wa.id = m.whatsapp_account_id
        WHERE m.campaign_id IS NULL
          AND m.tenant_id = $1
          ${startDate ? 'AND m.sent_at >= $2' : ''}
          ${endDate ? `AND m.sent_at <= $${startDate ? '3' : '2'}` : ''}
        ORDER BY m.sent_at DESC
        LIMIT $${startDate && endDate ? '4' : startDate || endDate ? '3' : '2'}
      `;

      const params = [tenantId];
      if (startDate) params.push(startDate as string);
      if (endDate) params.push(endDate as string);
      params.push(limit.toString());

      const messages = await pool.query(logQuery, params);

      console.log(`✅ Log carregado: ${messages.rows.length} mensagens`);

      return res.json({
        success: true,
        data: {
          messages: messages.rows,
          total: messages.rows.length,
        },
      });
    } catch (error) {
      console.error('❌ Erro ao buscar log imediato:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch immediate log',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

