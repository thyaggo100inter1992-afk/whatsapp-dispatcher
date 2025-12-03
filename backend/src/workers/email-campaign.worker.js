const { query } = require('../database/connection');
const emailAccountService = require('../services/email-account.service').default;

class EmailCampaignWorker {
  constructor() {
    this.isRunning = false;
    this.currentCampaignId = null;
  }

  /**
   * Inicia o envio de uma campanha de email
   */
  async startCampaign(campaignId) {
    if (this.isRunning) {
      console.log(`⚠️ Worker já está processando campanha ${this.currentCampaignId}`);
      return { success: false, message: 'Worker já está processando outra campanha' };
    }

    try {
      this.isRunning = true;
      this.currentCampaignId = campaignId;

      console.log(`\n🚀 ========================================`);
      console.log(`📧 Iniciando Campanha de Email #${campaignId}`);
      console.log(`========================================\n`);

      // Buscar dados da campanha
      const campaignResult = await query(
        'SELECT * FROM admin_email_campaigns WHERE id = $1',
        [campaignId]
      );

      if (campaignResult.rows.length === 0) {
        throw new Error('Campanha não encontrada');
      }

      const campaign = campaignResult.rows[0];

      // Atualizar status para 'sending'
      await query(
        `UPDATE admin_email_campaigns 
         SET status = 'sending', started_at = NOW(), updated_at = NOW() 
         WHERE id = $1`,
        [campaignId]
      );

      // Buscar destinatários
      const recipients = await this.getRecipients(campaign);

      if (recipients.length === 0) {
        await query(
          `UPDATE admin_email_campaigns 
           SET status = 'failed', finished_at = NOW(), updated_at = NOW() 
           WHERE id = $1`,
          [campaignId]
        );
        throw new Error('Nenhum destinatário encontrado');
      }

      console.log(`📋 Total de destinatários: ${recipients.length}`);

      // Inserir destinatários na tabela
      for (const recipient of recipients) {
        await query(
          `INSERT INTO admin_email_campaign_recipients (campaign_id, tenant_id, email, status)
           VALUES ($1, $2, $3, 'pending')`,
          [campaignId, recipient.tenant_id || null, recipient.email]
        );
      }

      // Atualizar total de destinatários
      await query(
        `UPDATE admin_email_campaigns SET total_recipients = $1, updated_at = NOW() WHERE id = $2`,
        [recipients.length, campaignId]
      );

      // Buscar contas de email para rotação
      const emailAccounts = await this.getEmailAccounts(campaign.email_account_ids);

      if (emailAccounts.length === 0) {
        console.log('⚠️ Nenhuma conta de email configurada, usando conta padrão');
      } else {
        console.log(`📨 Usando ${emailAccounts.length} conta(s) de email para rotação`);
      }

      // Enviar emails
      await this.sendEmails(campaign, recipients, emailAccounts);

      // Atualizar status final
      const finalStats = await query(
        `SELECT 
          COUNT(*) FILTER (WHERE status = 'sent') as sent,
          COUNT(*) FILTER (WHERE status = 'failed') as failed
         FROM admin_email_campaign_recipients 
         WHERE campaign_id = $1`,
        [campaignId]
      );

      const stats = finalStats.rows[0];
      const finalStatus = stats.failed > 0 && stats.sent === 0 ? 'failed' : 'completed';

      await query(
        `UPDATE admin_email_campaigns 
         SET status = $1, sent_count = $2, failed_count = $3, finished_at = NOW(), updated_at = NOW() 
         WHERE id = $4`,
        [finalStatus, stats.sent, stats.failed, campaignId]
      );

      console.log(`\n✅ ========================================`);
      console.log(`📧 Campanha #${campaignId} Concluída!`);
      console.log(`   ✅ Enviados: ${stats.sent}`);
      console.log(`   ❌ Falhas: ${stats.failed}`);
      console.log(`========================================\n`);

      return { success: true, stats };
    } catch (error) {
      console.error(`❌ Erro ao processar campanha ${campaignId}:`, error);

      await query(
        `UPDATE admin_email_campaigns 
         SET status = 'failed', finished_at = NOW(), updated_at = NOW() 
         WHERE id = $1`,
        [campaignId]
      );

      return { success: false, message: error.message };
    } finally {
      this.isRunning = false;
      this.currentCampaignId = null;
    }
  }

  /**
   * Busca destinatários com base no tipo de campanha
   */
  async getRecipients(campaign) {
    const recipients = [];

    try {
      switch (campaign.recipient_type) {
        case 'all':
          const allResult = await query(
            `SELECT id as tenant_id, email FROM tenants WHERE email IS NOT NULL AND email != ''`
          );
          recipients.push(...allResult.rows);
          break;

        case 'active':
          const activeResult = await query(
            `SELECT id as tenant_id, email FROM tenants WHERE status = 'active' AND email IS NOT NULL AND email != ''`
          );
          recipients.push(...activeResult.rows);
          break;

        case 'blocked':
          const blockedResult = await query(
            `SELECT id as tenant_id, email FROM tenants WHERE status = 'blocked' AND email IS NOT NULL AND email != ''`
          );
          recipients.push(...blockedResult.rows);
          break;

        case 'trial':
          const trialResult = await query(
            `SELECT id as tenant_id, email FROM tenants WHERE status = 'trial' AND email IS NOT NULL AND email != ''`
          );
          recipients.push(...trialResult.rows);
          break;

        case 'specific':
          if (campaign.specific_tenants && Array.isArray(campaign.specific_tenants)) {
            const specificResult = await query(
              `SELECT id as tenant_id, email FROM tenants WHERE id = ANY($1) AND email IS NOT NULL AND email != ''`,
              [campaign.specific_tenants]
            );
            recipients.push(...specificResult.rows);
          }
          break;

        case 'manual':
          if (campaign.manual_recipients) {
            const emails = campaign.manual_recipients
              .split(/[\n,;]/)
              .map(e => e.trim())
              .filter(e => e && e.includes('@'));
            
            recipients.push(...emails.map(email => ({ tenant_id: null, email })));
          }
          break;

        case 'upload':
          // TODO: Implementar leitura de arquivo CSV/TXT
          console.log('⚠️ Upload de arquivo ainda não implementado');
          break;

        default:
          console.warn(`⚠️ Tipo de destinatário desconhecido: ${campaign.recipient_type}`);
      }

      // Adicionar emails dos admins dos tenants
      if (['all', 'active', 'blocked', 'trial', 'specific'].includes(campaign.recipient_type)) {
        const tenantIds = recipients.map(r => r.tenant_id).filter(id => id);
        
        if (tenantIds.length > 0) {
          const adminEmailsResult = await query(
            `SELECT tenant_id, email FROM tenant_users 
             WHERE tenant_id = ANY($1) AND role = 'admin' AND email IS NOT NULL AND email != ''
             ORDER BY id ASC`,
            [tenantIds]
          );

          // Adicionar emails dos admins (evitando duplicatas)
          const existingEmails = new Set(recipients.map(r => r.email.toLowerCase()));
          
          for (const admin of adminEmailsResult.rows) {
            if (!existingEmails.has(admin.email.toLowerCase())) {
              recipients.push({ tenant_id: admin.tenant_id, email: admin.email });
              existingEmails.add(admin.email.toLowerCase());
            }
          }
        }
      }

      return recipients;
    } catch (error) {
      console.error('❌ Erro ao buscar destinatários:', error);
      return [];
    }
  }

  /**
   * Busca contas de email para rotação
   */
  async getEmailAccounts(accountIds) {
    if (!accountIds || accountIds.length === 0) {
      return [];
    }

    try {
      const result = await query(
        `SELECT * FROM email_accounts WHERE id = ANY($1) AND is_active = TRUE`,
        [accountIds]
      );
      return result.rows;
    } catch (error) {
      console.error('❌ Erro ao buscar contas de email:', error);
      return [];
    }
  }

  /**
   * Envia emails para todos os destinatários
   */
  async sendEmails(campaign, recipients, emailAccounts) {
    let accountIndex = 0;
    let sentCount = 0;
    let failedCount = 0;

    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];
      const progress = Math.round(((i + 1) / recipients.length) * 100);

      try {
        console.log(`📧 [${i + 1}/${recipients.length}] Enviando para: ${recipient.email} (${progress}%)`);

        // Selecionar conta de email (rotação)
        const accountId = emailAccounts.length > 0 
          ? emailAccounts[accountIndex % emailAccounts.length].id 
          : null;

        if (accountId) {
          console.log(`   🔄 Usando conta: ${emailAccounts[accountIndex % emailAccounts.length].name}`);
        }

        // Enviar email
        const sent = await emailAccountService.sendEmail(
          recipient.email,
          campaign.subject,
          campaign.html_content,
          accountId
        );

        if (sent) {
          await query(
            `UPDATE admin_email_campaign_recipients 
             SET status = 'sent', sent_at = NOW() 
             WHERE campaign_id = $1 AND email = $2`,
            [campaign.id, recipient.email]
          );
          sentCount++;
          console.log(`   ✅ Enviado com sucesso!`);
        } else {
          throw new Error('Falha no envio');
        }

        // Rotacionar conta
        if (emailAccounts.length > 0) {
          accountIndex++;
        }

        // Delay entre envios
        if (i < recipients.length - 1 && campaign.delay_seconds > 0) {
          console.log(`   ⏱️  Aguardando ${campaign.delay_seconds}s...`);
          await this.sleep(campaign.delay_seconds * 1000);
        }
      } catch (error) {
        console.error(`   ❌ Erro ao enviar para ${recipient.email}:`, error.message);
        
        await query(
          `UPDATE admin_email_campaign_recipients 
           SET status = 'failed', error_message = $1 
           WHERE campaign_id = $2 AND email = $3`,
          [error.message, campaign.id, recipient.email]
        );
        failedCount++;
      }

      // Atualizar progresso na campanha
      await query(
        `UPDATE admin_email_campaigns 
         SET sent_count = $1, failed_count = $2, updated_at = NOW() 
         WHERE id = $3`,
        [sentCount, failedCount, campaign.id]
      );
    }
  }

  /**
   * Helper para delay
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new EmailCampaignWorker();

