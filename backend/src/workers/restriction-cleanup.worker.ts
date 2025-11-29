/**
 * Restriction Cleanup Worker
 * Worker para limpeza automática de entradas expiradas das listas de restrição
 * 
 * Executa a cada hora e remove:
 * - Entradas da lista "blocked" com mais de 365 dias
 * - Entradas da lista "not_interested" com mais de 7 dias
 */

import * as cron from 'node-cron';
import { query } from '../database/connection';

export class RestrictionCleanupWorker {
  private static instance: RestrictionCleanupWorker;
  private cronJob: cron.ScheduledTask | null = null;
  private isRunning = false;

  private constructor() {}

  static getInstance(): RestrictionCleanupWorker {
    if (!RestrictionCleanupWorker.instance) {
      RestrictionCleanupWorker.instance = new RestrictionCleanupWorker();
    }
    return RestrictionCleanupWorker.instance;
  }

  /**
   * Iniciar worker (executa a cada hora)
   */
  start() {
    if (this.cronJob) {
      console.log('⚠️ Worker de limpeza de restrições já está rodando');
      return;
    }

    // Executar a cada hora
    this.cronJob = cron.schedule('0 * * * *', async () => {
      await this.cleanupExpiredEntries();
    });

    console.log('✅ Worker de limpeza de restrições iniciado (executa a cada hora)');

    // Executar imediatamente na inicialização
    this.cleanupExpiredEntries();
  }

  /**
   * Parar worker
   */
  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      console.log('🛑 Worker de limpeza de restrições parado');
    }
  }

  /**
   * Executar limpeza manualmente
   */
  async cleanupNow(): Promise<{
    removed: number;
    details: {
      blocked: number;
      not_interested: number;
    };
  }> {
    return await this.cleanupExpiredEntries();
  }

  /**
   * Limpar entradas expiradas
   */
  private async cleanupExpiredEntries(): Promise<{
    removed: number;
    details: {
      blocked: number;
      not_interested: number;
    };
  }> {
    if (this.isRunning) {
      console.log('⚠️ Limpeza já está em execução, pulando...');
      return { removed: 0, details: { blocked: 0, not_interested: 0 } };
    }

    this.isRunning = true;

    try {
      console.log('\n🧹 ===== INICIANDO LIMPEZA DE LISTAS DE RESTRIÇÃO =====');
      console.log(`⏰ ${new Date().toLocaleString('pt-BR')}`);

      // Buscar entradas expiradas
      const expiredResult = await query(
        `SELECT * FROM restriction_list_entries 
         WHERE expires_at IS NOT NULL 
         AND expires_at <= NOW()`,
        []
      );

      const expiredEntries = expiredResult.rows;
      console.log(`📊 Total de entradas expiradas: ${expiredEntries.length}`);

      if (expiredEntries.length === 0) {
        console.log('✅ Nenhuma entrada expirada encontrada');
        console.log('====================================================\n');
        return { removed: 0, details: { blocked: 0, not_interested: 0 } };
      }

      // Contar por tipo de lista
      const details = {
        blocked: 0,
        not_interested: 0,
      };

      expiredEntries.forEach((entry) => {
        if (entry.list_type === 'blocked') {
          details.blocked++;
        } else if (entry.list_type === 'not_interested') {
          details.not_interested++;
        }
      });

      console.log('\n📋 Detalhes:');
      console.log(`   - Bloqueados (365 dias): ${details.blocked}`);
      console.log(`   - Sem interesse (7 dias): ${details.not_interested}`);

      // Registrar logs antes de deletar
      for (const entry of expiredEntries) {
        await query(
          `INSERT INTO restriction_list_logs 
           (entry_id, list_type, action, phone_number, contact_name, details)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            entry.id,
            entry.list_type,
            'expired',
            entry.phone_number,
            entry.contact_name,
            JSON.stringify({
              expires_at: entry.expires_at,
              added_at: entry.added_at,
              days_in_list: Math.floor(
                (new Date().getTime() - new Date(entry.added_at).getTime()) / (1000 * 60 * 60 * 24)
              ),
            }),
          ]
        );
      }

      console.log('✅ Logs registrados para todas as entradas expiradas');

      // Deletar entradas expiradas
      const deleteResult = await query(
        `DELETE FROM restriction_list_entries 
         WHERE expires_at IS NOT NULL 
         AND expires_at <= NOW()
         RETURNING *`,
        []
      );

      console.log(`\n🗑️ ${deleteResult.rows.length} entradas removidas com sucesso!`);

      // Atualizar estatísticas
      await this.updateStatsAfterCleanup(deleteResult.rows);

      console.log('✅ Estatísticas atualizadas');
      console.log('====================================================\n');

      return {
        removed: deleteResult.rows.length,
        details,
      };
    } catch (error: any) {
      console.error('❌ Erro ao limpar entradas expiradas:', error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Atualizar estatísticas após limpeza
   */
  private async updateStatsAfterCleanup(deletedEntries: any[]) {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Agrupar por lista e conta
      const statsMap = new Map<string, { list_type: string; account_id: number; count: number }>();

      deletedEntries.forEach((entry) => {
        const key = `${entry.list_type}_${entry.whatsapp_account_id}`;
        if (!statsMap.has(key)) {
          statsMap.set(key, {
            list_type: entry.list_type,
            account_id: entry.whatsapp_account_id,
            count: 0,
          });
        }
        statsMap.get(key)!.count++;
      });

      // Atualizar estatísticas
      for (const [key, stat] of statsMap) {
        await query(
          `INSERT INTO restriction_list_stats 
           (list_type, whatsapp_account_id, date, expired_today)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (list_type, whatsapp_account_id, date)
           DO UPDATE SET expired_today = restriction_list_stats.expired_today + $4`,
          [stat.list_type, stat.account_id, today, stat.count]
        );

        // Atualizar total atual
        const totalResult = await query(
          `SELECT COUNT(*) as total 
           FROM restriction_list_entries 
           WHERE list_type = $1 
           AND whatsapp_account_id = $2
           AND (expires_at IS NULL OR expires_at > NOW())`,
          [stat.list_type, stat.account_id]
        );

        await query(
          `UPDATE restriction_list_stats 
           SET total_entries = $4
           WHERE list_type = $1 AND whatsapp_account_id = $2 AND date = $3`,
          [stat.list_type, stat.account_id, today, parseInt(totalResult.rows[0].total)]
        );
      }
    } catch (error) {
      console.error('❌ Erro ao atualizar estatísticas:', error);
    }
  }

  /**
   * Obter próximas entradas a expirar
   */
  async getExpiringEntries(days: number = 7): Promise<any[]> {
    try {
      const result = await query(
        `SELECT 
          e.*,
          t.name as list_name,
          wa.name as account_name,
          EXTRACT(DAY FROM (e.expires_at - NOW()))::INTEGER as days_until_expiry
         FROM restriction_list_entries e
         JOIN restriction_list_types t ON e.list_type = t.id
         JOIN whatsapp_accounts wa ON e.whatsapp_account_id = wa.id
         WHERE e.expires_at IS NOT NULL 
         AND e.expires_at > NOW()
         AND e.expires_at <= NOW() + INTERVAL '${days} days'
         ORDER BY e.expires_at ASC`,
        []
      );

      return result.rows;
    } catch (error) {
      console.error('❌ Erro ao buscar entradas expirando:', error);
      return [];
    }
  }

  /**
   * Estatísticas de limpeza
   */
  async getCleanupStats(): Promise<{
    total_cleaned_today: number;
    total_cleaned_7days: number;
    total_cleaned_30days: number;
    next_expiring: any[];
  }> {
    try {
      // Total limpo hoje
      const todayResult = await query(
        `SELECT COUNT(*) as total 
         FROM restriction_list_logs 
         WHERE action = 'expired' 
         AND DATE(performed_at) = CURRENT_DATE`,
        []
      );

      // Total limpo últimos 7 dias
      const last7daysResult = await query(
        `SELECT COUNT(*) as total 
         FROM restriction_list_logs 
         WHERE action = 'expired' 
         AND performed_at >= NOW() - INTERVAL '7 days'`,
        []
      );

      // Total limpo últimos 30 dias
      const last30daysResult = await query(
        `SELECT COUNT(*) as total 
         FROM restriction_list_logs 
         WHERE action = 'expired' 
         AND performed_at >= NOW() - INTERVAL '30 days'`,
        []
      );

      // Próximas a expirar (próximos 7 dias)
      const nextExpiring = await this.getExpiringEntries(7);

      return {
        total_cleaned_today: parseInt(todayResult.rows[0].total),
        total_cleaned_7days: parseInt(last7daysResult.rows[0].total),
        total_cleaned_30days: parseInt(last30daysResult.rows[0].total),
        next_expiring: nextExpiring,
      };
    } catch (error) {
      console.error('❌ Erro ao buscar estatísticas de limpeza:', error);
      return {
        total_cleaned_today: 0,
        total_cleaned_7days: 0,
        total_cleaned_30days: 0,
        next_expiring: [],
      };
    }
  }
}

// Singleton instance
export const restrictionCleanupWorker = RestrictionCleanupWorker.getInstance();

