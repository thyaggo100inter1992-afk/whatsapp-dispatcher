import { Request, Response } from 'express';
import { tenantQuery } from '../database/tenant-query';
import axios, { AxiosRequestConfig } from 'axios';
import { ProxyConfig, applyProxyToRequest, formatProxyInfo, getProxyConfigFromAccount } from '../helpers/proxy.helper';

export class AnalyticsController {

  /**
   * GET /api/whatsapp-accounts/:id/analytics
   * Buscar estatísticas da conta
   */
  async getAccountAnalytics(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { period, start_date, end_date } = req.query;

      // Buscar conta
      const accountResult = await tenantQuery(
        req,
        'SELECT * FROM whatsapp_accounts WHERE id = $1',
        [id]
      );

      if (accountResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Conta não encontrada' });
      }

      const account = accountResult.rows[0];

      // Determinar datas de filtro
      let startDate: Date;
      let endDate: Date = new Date(); // Agora

      if (start_date && end_date) {
        // Filtro personalizado: data início e fim
        startDate = new Date(start_date as string);
        endDate = new Date(end_date as string);
        endDate.setHours(23, 59, 59, 999); // Final do dia
      } else if (period) {
        // Filtro por período (dias)
        const periodDays = parseInt(period as string);
        startDate = new Date();
        startDate.setDate(startDate.getDate() - periodDays);
        startDate.setHours(0, 0, 0, 0); // Início do dia
      } else {
        // Default: últimos 30 dias
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        startDate.setHours(0, 0, 0, 0);
      }

      console.log(`📊 Analytics - Filtro: ${startDate.toISOString()} até ${endDate.toISOString()}`);

      // Verificar quais status realmente existem
      const statusCheckResult = await tenantQuery(req, `
        SELECT DISTINCT status, COUNT(*) as count
        FROM messages
        WHERE whatsapp_account_id = $1
          AND created_at >= $2
          AND created_at <= $3
        GROUP BY status
      `, [id, startDate, endDate]);

      console.log('🔍 STATUS ENCONTRADOS:', statusCheckResult.rows);

      // 1. Estatísticas gerais de mensagens (usando created_at para incluir mensagens falhadas)
      const messageStatsResult = await tenantQuery(req, `
        SELECT 
          COUNT(*) as total_messages,
          COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent,
          COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered,
          COUNT(CASE WHEN status = 'read' THEN 1 END) as read,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
          COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted,
          COUNT(CASE WHEN status = 'queued' THEN 1 END) as queued
        FROM messages
        WHERE whatsapp_account_id = $1
          AND created_at >= $2
          AND created_at <= $3
      `, [id, startDate, endDate]);

      const messageStats = messageStatsResult.rows[0];
      console.log('📊 ESTATÍSTICAS:', messageStats);

      // Calcular taxas
      const total = parseInt(messageStats.total_messages) || 0;
      const sentCount = parseInt(messageStats.sent) || 0;
      const deliveredCount = parseInt(messageStats.delivered) || 0;
      const readCount = parseInt(messageStats.read) || 0;
      const failedCount = parseInt(messageStats.failed) || 0;
      const acceptedCount = parseInt(messageStats.accepted) || 0;
      const queuedCount = parseInt(messageStats.queued) || 0;
      
      // Taxa de Entrega: considera 'sent', 'delivered', 'read' como entregues
      const totalDelivered = sentCount + deliveredCount + readCount;
      const deliveryRate = total > 0 ? (totalDelivered / total * 100).toFixed(1) : '0';
      
      // Taxa de Leitura: apenas mensagens lidas
      const readRate = total > 0 ? (readCount / total * 100).toFixed(1) : '0';
      
      // Taxa de Falha: apenas falhadas
      const failureRate = total > 0 ? (failedCount / total * 100).toFixed(1) : '0';
      
      console.log('📈 TAXAS CALCULADAS:', { deliveryRate, readRate, failureRate, totalDelivered, sentCount, deliveredCount, readCount, failedCount });

      // 2. Mensagens por dia (usando created_at)
      const messagesByDayResult = await tenantQuery(req, `
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as count,
          COUNT(CASE WHEN status IN ('sent', 'delivered', 'read') THEN 1 END) as delivered_count,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count
        FROM messages
        WHERE whatsapp_account_id = $1
          AND created_at >= $2
          AND created_at <= $3
        GROUP BY DATE(created_at)
        ORDER BY date DESC
        LIMIT 30
      `, [id, startDate, endDate]);

      // 3. Distribuição por horário (baseado no período filtrado, usando created_at)
      const messagesByHourResult = await tenantQuery(req, `
        SELECT 
          EXTRACT(HOUR FROM created_at) as hour,
          COUNT(*) as count
        FROM messages
        WHERE whatsapp_account_id = $1
          AND created_at >= $2
          AND created_at <= $3
        GROUP BY EXTRACT(HOUR FROM created_at)
        ORDER BY hour
      `, [id, startDate, endDate]);

      // 4. Buscar dados de custo da API do WhatsApp/Meta
      let costsData: {
        total: number;
        by_type: any[];
        conversations: {
          business_initiated: number;
          user_initiated: number;
          total: number;
        };
        currency: string;
      } = {
        total: 0,
        by_type: [],
        conversations: {
          business_initiated: 0,
          user_initiated: 0,
          total: 0
        },
        currency: 'BRL'
      };

      try {
        // Buscar Analytics da API do WhatsApp (com proxy se configurado)
        let analyticsConfig: AxiosRequestConfig = {
          params: {
            fields: 'analytics'
          },
          headers: {
            'Authorization': `Bearer ${account.access_token}`
          }
        };
        
        // Aplicar proxy se configurado
        const proxyConfig = await getProxyConfigFromAccount(id, account.tenant_id);
        if (proxyConfig) {
          console.log(`🌐 Analytics - Aplicando proxy: ${formatProxyInfo(proxyConfig)} - Conta: ${account.name}`);
          analyticsConfig = applyProxyToRequest(analyticsConfig, proxyConfig, account.name);
        }
        
        const analyticsResponse = await axios.get(
          `https://graph.facebook.com/v18.0/${account.phone_number_id}`,
          analyticsConfig
        );

        console.log('💰 DADOS DA API:', analyticsResponse.data);

        // Tentar buscar informações de conversas (com proxy se configurado)
        let conversationConfig: AxiosRequestConfig = {
          params: {
            fields: 'conversation_analytics'
          },
          headers: {
            'Authorization': `Bearer ${account.access_token}`
          }
        };
        
        if (proxyConfig) {
          conversationConfig = applyProxyToRequest(conversationConfig, proxyConfig, account.name);
        }
        
        const conversationInsights = await axios.get(
          `https://graph.facebook.com/v18.0/${account.phone_number_id}`,
          conversationConfig
        );

        console.log('📊 CONVERSATION INSIGHTS:', conversationInsights.data);

      } catch (apiError: any) {
        console.log('⚠️ Não foi possível buscar dados de custo da API:', apiError.response?.data || apiError.message);
      }

      // Tabela oficial de preços do WhatsApp Business API para Brasil (em USD)
      const priceTableUSD = {
        'marketing': 0.0625,      // $0.0625 USD por conversa de marketing
        'utility': 0.0068,        // $0.0068 USD por conversa utility
        'authentication': 0.0068, // $0.0068 USD por conversa authentication
        'service': 0.0000         // Currency Service não tem valor na tabela (n/a)
      };

      // Cotação USD para BRL (atualizar periodicamente)
      const USD_TO_BRL = 5.00; // Aproximadamente R$ 5,00 por dólar

      // Converter preços para BRL
      const priceTableBRL = {
        'marketing': priceTableUSD.marketing * USD_TO_BRL,
        'utility': priceTableUSD.utility * USD_TO_BRL,
        'authentication': priceTableUSD.authentication * USD_TO_BRL,
        'service': priceTableUSD.service * USD_TO_BRL
      };

      console.log('💵 TABELA DE PREÇOS (BRL):', priceTableBRL);

      // Buscar mensagens agrupadas por categoria de template
      const messagesByCategoryResult = await tenantQuery(req, `
        SELECT 
          COALESCE(UPPER(t.category), 'UTILITY') as category,
          COUNT(CASE WHEN m.status = 'sent' THEN 1 END) as sent_count,
          COUNT(m.id) as total_count
        FROM messages m
        LEFT JOIN templates t ON m.template_name = t.template_name 
          AND m.whatsapp_account_id = t.whatsapp_account_id
        WHERE m.whatsapp_account_id = $1
          AND m.created_at >= $2
          AND m.created_at <= $3
        GROUP BY COALESCE(UPPER(t.category), 'UTILITY')
      `, [id, startDate, endDate]);

      console.log('🏷️ MENSAGENS POR CATEGORIA:', messagesByCategoryResult.rows);

      // Mapear categorias para nome amigável
      const categoryMapping: any = {
        'UTILITY': 'Utility',
        'MARKETING': 'Marketing',
        'AUTHENTICATION': 'Authentication',
        'SERVICE': 'Service'
      };

      // Calcular custos por categoria
      let totalCost = 0;
      const costsByType: any[] = [];

      messagesByCategoryResult.rows.forEach((row: any) => {
        const category = row.category || 'UTILITY';
        const sentCount = parseInt(row.sent_count) || 0;
        const categoryKey = category.toLowerCase() as 'marketing' | 'utility' | 'authentication' | 'service';
        const pricePerMessage = priceTableBRL[categoryKey] || priceTableBRL.utility;
        const cost = sentCount * pricePerMessage;
        
        totalCost += cost;
        costsByType.push({
          message_type: categoryMapping[category] || 'Utility',
          count: sentCount,
          total_count: parseInt(row.total_count),
          total_cost: cost
        });
      });

      costsData.total = totalCost;
      costsData.by_type = costsByType;

      console.log('💰 CUSTOS CALCULADOS:', costsData);

      // 5. Top contatos (mais mensagens, usando created_at)
      const topContactsResult = await tenantQuery(req, `
        SELECT 
          phone_number,
          COUNT(*) as message_count
        FROM messages
        WHERE whatsapp_account_id = $1
          AND created_at >= $2
          AND created_at <= $3
        GROUP BY phone_number
        ORDER BY message_count DESC
        LIMIT 10
      `, [id, startDate, endDate]);

      // 6. Campanhas ativas
      const tenantId = (req as any).tenant?.id;
      if (!tenantId) {
        return res.status(401).json({ success: false, error: 'Tenant não identificado' });
      }
      
      const activeCampaignsResult = await tenantQuery(req, `
        SELECT 
          COUNT(*) as active_campaigns
        FROM campaigns
        WHERE tenant_id = $1 AND status IN ('pending', 'running', 'scheduled')
      `, [tenantId]);

      // Calcular dias do período filtrado
      const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

      res.json({
        success: true,
        data: {
          period: daysDiff,
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          summary: {
            total_messages: parseInt(messageStats.total_messages),
            sent: parseInt(messageStats.sent),
            delivered: parseInt(messageStats.delivered),
            read: parseInt(messageStats.read),
            failed: parseInt(messageStats.failed),
            pending: parseInt(messageStats.pending),
            delivery_rate: parseFloat(deliveryRate),
            read_rate: parseFloat(readRate),
            failure_rate: parseFloat(failureRate)
          },
          charts: {
            messages_by_day: messagesByDayResult.rows,
            messages_by_hour: messagesByHourResult.rows
          },
          costs: {
            total: costsData.total.toFixed(2),
            by_type: costsData.by_type,
            daily_average: (costsData.total / daysDiff).toFixed(2),
            monthly_projection: (costsData.total / daysDiff * 30).toFixed(2),
            currency: costsData.currency,
            conversations: costsData.conversations
          },
          top_contacts: topContactsResult.rows,
          active_campaigns: parseInt(activeCampaignsResult.rows[0]?.active_campaigns || 0),
          account_info: {
            name: account.name,
            phone_number: account.phone_number
          }
        }
      });
    } catch (error: any) {
      console.error('Erro ao buscar analytics:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  }

  /**
   * GET /api/whatsapp-accounts/:id/analytics/quality
   * Buscar histórico de quality rating
   */
  async getQualityHistory(req: Request, res: Response) {
    try {
      const { id } = req.params;

      // Nota: Como a API não salva histórico, vamos criar uma tabela futuramente
      // Por enquanto, retornar dados mockados
      res.json({
        success: true,
        data: {
          current: 'GREEN',
          history: [
            { date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), rating: 'GREEN' },
            { date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(), rating: 'GREEN' },
            { date: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(), rating: 'GREEN' }
          ],
          recommendations: [
            'Mantenha a taxa de resposta acima de 80%',
            'Evite enviar mensagens não solicitadas',
            'Responda mensagens dos usuários em até 24h'
          ]
        }
      });
    } catch (error: any) {
      console.error('Erro ao buscar quality history:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  }
}

export const analyticsController = new AnalyticsController();

