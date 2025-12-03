const { query } = require('../database/connection');
const emailTemplateService = require('../services/email-template.service').default;

/**
 * Worker para gerenciar planos de teste (trial) e bloqueios por falta de pagamento
 * 
 * Regras:
 * 1. Trial de 3 dias: Após trial_ends_at, bloquear tenant (status = 'blocked')
 * 2. Após 20 dias bloqueado: Deletar tenant automaticamente
 * 3. Se pagamento confirmado: Sistema libera automaticamente (via webhook)
 */

class TrialCleanupWorker {
  async run() {
    console.log('\n🔍 ===== VERIFICANDO PLANOS DE TESTE =====');
    console.log(`⏰ ${new Date().toLocaleString('pt-BR')}\n`);

    try {
      await this.blockExpiredTrials();
      await this.sendDeletionWarnings(); // 🎯 NOVO: Avisar antes de deletar
      await this.deleteExpiredTenants();
      
      console.log('✅ Verificação de trials concluída\n');
      console.log('====================================================\n');
    } catch (error) {
      console.error('❌ Erro no worker de trials:', error);
    }
  }

  /**
   * Bloquear tenants cujo período de teste expirou (após 3 dias)
   */
  async blockExpiredTrials() {
    try {
      console.log('🔒 Verificando trials expirados para bloqueio...');

      // Buscar tenants com trial expirado que ainda não foram bloqueados
      const result = await query(`
        SELECT 
          t.id,
          t.nome,
          t.email,
          t.trial_ends_at,
          t.plano
        FROM tenants t
        WHERE t.trial_ends_at IS NOT NULL
          AND t.trial_ends_at <= NOW()
          AND t.status = 'trial'
          AND t.blocked_at IS NULL
      `);

      if (result.rows.length === 0) {
        console.log('✅ Nenhum trial expirado para bloquear');
        return;
      }

      console.log(`⚠️  Encontrados ${result.rows.length} tenants com trial expirado\n`);

      for (const tenant of result.rows) {
        try {
          // Calcular data de deleção (20 dias após bloqueio)
          const willBeDeletedAt = new Date();
          willBeDeletedAt.setDate(willBeDeletedAt.getDate() + 20);

          // Bloquear tenant
          await query(`
            UPDATE tenants 
            SET 
              status = 'blocked',
              blocked_at = NOW(),
              will_be_deleted_at = $1,
              updated_at = NOW()
            WHERE id = $2
          `, [willBeDeletedAt, tenant.id]);

          console.log(`🔒 BLOQUEADO: ${tenant.nome} (${tenant.email})`);
          console.log(`   Trial de 3 dias terminou em: ${new Date(tenant.trial_ends_at).toLocaleString('pt-BR')}`);
          console.log(`   Será deletado em: ${willBeDeletedAt.toLocaleString('pt-BR')} (20 dias)`);
          console.log(`   ⚠️  Cliente deve fazer upgrade para reativar\n`);

          // 🎯 ENVIAR EMAIL DE BLOQUEIO (TRIAL EXPIRADO)
          await emailTemplateService.sendBlockedEmail(tenant, willBeDeletedAt);
          
        } catch (error) {
          console.error(`❌ Erro ao bloquear tenant ${tenant.id}:`, error.message);
        }
      }

      console.log(`✅ ${result.rows.length} tenants bloqueados com sucesso\n`);
      
    } catch (error) {
      console.error('❌ Erro ao bloquear trials expirados:', error);
      throw error;
    }
  }

  /**
   * Enviar avisos de exclusão para tenants bloqueados
   * Avisa 7, 5, 3 e 1 dias antes da exclusão
   */
  async sendDeletionWarnings() {
    try {
      console.log('⚠️ Verificando tenants para envio de avisos de exclusão...');

      // Buscar tenants bloqueados com exclusão programada
      const result = await query(`
        SELECT 
          t.id,
          t.nome,
          t.email,
          t.will_be_deleted_at,
          EXTRACT(DAY FROM (t.will_be_deleted_at - NOW())) as days_remaining
        FROM tenants t
        WHERE t.status = 'blocked'
          AND t.will_be_deleted_at IS NOT NULL
          AND t.will_be_deleted_at > NOW()
          AND t.will_be_deleted_at <= NOW() + INTERVAL '7 days'
      `);

      if (result.rows.length === 0) {
        console.log('✅ Nenhum aviso de exclusão a enviar');
        return;
      }

      console.log(`📧 ${result.rows.length} tenants precisam de aviso de exclusão\n`);

      for (const tenant of result.rows) {
        const daysRemaining = Math.ceil(tenant.days_remaining);

        // Enviar aviso apenas em dias específicos: 7, 5, 3, 1
        if ([7, 5, 3, 1].includes(daysRemaining)) {
          // Verificar se já enviou aviso hoje
          const lastWarning = await query(`
            SELECT created_at 
            FROM payment_notifications 
            WHERE tenant_id = $1 
              AND notification_type = 'deletion_warning'
              AND days_before = $2
              AND created_at > NOW() - INTERVAL '12 hours'
            ORDER BY created_at DESC 
            LIMIT 1
          `, [tenant.id, daysRemaining]);

          if (lastWarning.rows.length > 0) {
            console.log(`   ⏭️  Aviso já enviado para ${tenant.nome}, pulando...`);
            continue;
          }

          console.log(`📧 Enviando aviso para ${tenant.nome} - ${daysRemaining} dias restantes`);

          // 🎯 ENVIAR EMAIL DE AVISO DE EXCLUSÃO
          const sent = await emailTemplateService.sendDeletionWarningEmail(tenant, daysRemaining);

          if (sent) {
            // Registrar aviso enviado
            await query(`
              INSERT INTO payment_notifications (
                tenant_id, notification_type, days_before, sent_at, created_at
              ) VALUES ($1, 'deletion_warning', $2, NOW(), NOW())
            `, [tenant.id, daysRemaining]);

            console.log(`   ✅ Aviso enviado com sucesso!\n`);
          } else {
            console.log(`   ⚠️ Aviso não enviado (template inativo ou serviço não configurado)\n`);
          }
        }
      }

      console.log();
    } catch (error) {
      console.error('❌ Erro ao enviar avisos de exclusão:', error);
    }
  }

  /**
   * Deletar tenants bloqueados há mais de 20 dias
   */
  async deleteExpiredTenants() {
    try {
      console.log('🗑️  Verificando tenants bloqueados para deleção...');

      // Buscar tenants que devem ser deletados
      // IMPORTANTE: Apenas deletar se NÃO tiver pagamento confirmado
      // Se pagou, não deleta mesmo que tenha passado o prazo!
      const result = await query(`
        SELECT 
          t.id,
          t.nome,
          t.email,
          t.plano,
          t.blocked_at,
          t.will_be_deleted_at,
          t.created_at
        FROM tenants t
        WHERE t.will_be_deleted_at IS NOT NULL
          AND t.will_be_deleted_at <= NOW()
          AND t.status = 'blocked'
          AND NOT EXISTS (
            SELECT 1 FROM payments p 
            WHERE p.tenant_id = t.id 
            AND p.status IN ('confirmed', 'received')
          )
      `);

      if (result.rows.length === 0) {
        console.log('✅ Nenhum tenant para deletar');
        return;
      }

      console.log(`⚠️  Encontrados ${result.rows.length} tenants para deletar\n`);

      for (const tenant of result.rows) {
        try {
          console.log(`🗑️  Deletando TUDO do tenant: ${tenant.nome} (ID: ${tenant.id})\n`);

          // DELETAR ABSOLUTAMENTE TUDO - SEM DEIXAR RASTROS

          // 1. Usuários do tenant
          const usersDeleted = await query('DELETE FROM tenant_users WHERE tenant_id = $1', [tenant.id]);
          console.log(`   ✓ Usuários deletados: ${usersDeleted.rowCount}`);

          // 2. Contas WhatsApp (API Oficial)
          const whatsappDeleted = await query('DELETE FROM whatsapp_accounts WHERE tenant_id = $1', [tenant.id]);
          console.log(`   ✓ Contas WhatsApp (API) deletadas: ${whatsappDeleted.rowCount}`);

          // 3. Instâncias UAZ (QR Connect)
          const uazDeleted = await query('DELETE FROM uaz_instances WHERE tenant_id = $1', [tenant.id]);
          console.log(`   ✓ Instâncias UAZ deletadas: ${uazDeleted.rowCount}`);

          // 4. Campanhas (API Oficial)
          const campaignsDeleted = await query('DELETE FROM campaigns WHERE tenant_id = $1', [tenant.id]);
          console.log(`   ✓ Campanhas (API) deletadas: ${campaignsDeleted.rowCount}`);

          // 5. Campanhas QR
          const qrCampaignsDeleted = await query('DELETE FROM qr_campaigns WHERE tenant_id = $1', [tenant.id]);
          console.log(`   ✓ Campanhas QR deletadas: ${qrCampaignsDeleted.rowCount}`);

          // 6. Templates (API Oficial)
          const templatesDeleted = await query('DELETE FROM templates WHERE tenant_id = $1', [tenant.id]);
          console.log(`   ✓ Templates (API) deletados: ${templatesDeleted.rowCount}`);

          // 7. Templates QR
          const qrTemplatesDeleted = await query('DELETE FROM qr_templates WHERE tenant_id = $1', [tenant.id]);
          console.log(`   ✓ Templates QR deletados: ${qrTemplatesDeleted.rowCount}`);

          // 8. Base de Dados (contatos)
          const baseDadosDeleted = await query('DELETE FROM base_dados WHERE tenant_id = $1', [tenant.id]);
          console.log(`   ✓ Base de dados deletada: ${baseDadosDeleted.rowCount}`);

          // 9. Listas de Restrição (por conta)
          await query(`
            DELETE FROM restriction_list_entries 
            WHERE account_id IN (
              SELECT id FROM whatsapp_accounts WHERE tenant_id = $1
              UNION
              SELECT id FROM uaz_instances WHERE tenant_id = $1
            )
          `, [tenant.id]);
          console.log(`   ✓ Listas de restrição deletadas`);

          // 10. Contact Lists
          try {
            const contactListsDeleted = await query('DELETE FROM contact_lists WHERE tenant_id = $1', [tenant.id]);
            console.log(`   ✓ Contact lists deletadas: ${contactListsDeleted.rowCount}`);
          } catch (e) {
            // Tabela pode não existir
            console.log(`   ⚠ Contact lists: tabela não existe`);
          }

          // 11. Tenant Usage (estatísticas de uso)
          const usageDeleted = await query('DELETE FROM tenant_usage WHERE tenant_id = $1', [tenant.id]);
          console.log(`   ✓ Estatísticas de uso deletadas: ${usageDeleted.rowCount}`);

          // 12. Subscriptions (assinaturas)
          try {
            const subsDeleted = await query('DELETE FROM subscriptions WHERE tenant_id = $1', [tenant.id]);
            console.log(`   ✓ Assinaturas deletadas: ${subsDeleted.rowCount}`);
          } catch (e) {
            console.log(`   ⚠ Subscriptions: tabela não existe`);
          }

          // 13. Audit Logs
          const logsDeleted = await query('DELETE FROM audit_logs WHERE tenant_id = $1', [tenant.id]);
          console.log(`   ✓ Audit logs deletados: ${logsDeleted.rowCount}`);

          // 14. Webhooks configurados
          try {
            await query('DELETE FROM webhooks WHERE tenant_id = $1', [tenant.id]);
            console.log(`   ✓ Webhooks deletados`);
          } catch (e) {
            console.log(`   ⚠ Webhooks: tabela não existe`);
          }

          // 15. Notificações
          try {
            await query('DELETE FROM notifications WHERE tenant_id = $1', [tenant.id]);
            console.log(`   ✓ Notificações deletadas`);
          } catch (e) {
            console.log(`   ⚠ Notifications: tabela não existe`);
          }

          // 16. FINALMENTE - Deletar o tenant
          const tenantDeleted = await query('DELETE FROM tenants WHERE id = $1 RETURNING *', [tenant.id]);
          
          const daysTotal = Math.floor((Date.now() - new Date(tenant.created_at).getTime()) / (1000 * 60 * 60 * 24));
          
          console.log(`\n   ✅ TENANT DELETADO PERMANENTEMENTE`);
          console.log(`   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          console.log(`   📋 Nome: ${tenant.nome}`);
          console.log(`   📧 Email: ${tenant.email}`);
          console.log(`   📅 Criado em: ${new Date(tenant.created_at).toLocaleString('pt-BR')}`);
          console.log(`   🔒 Bloqueado em: ${new Date(tenant.blocked_at).toLocaleString('pt-BR')}`);
          console.log(`   ⏱️  Total de dias: ${daysTotal}`);
          console.log(`   💾 TODOS OS DADOS FORAM PERMANENTEMENTE DELETADOS`);
          console.log(`   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

          // TODO: Enviar email informando que a conta foi deletada
          
        } catch (error) {
          console.error(`❌ Erro ao deletar tenant ${tenant.id}:`, error.message);
        }
      }

      console.log(`✅ ${result.rows.length} tenants deletados com sucesso\n`);
      
    } catch (error) {
      console.error('❌ Erro ao deletar tenants expirados:', error);
      throw error;
    }
  }
}

const trialCleanupWorker = new TrialCleanupWorker();

module.exports = { trialCleanupWorker };

