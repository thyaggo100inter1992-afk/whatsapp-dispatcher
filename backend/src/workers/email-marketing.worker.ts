import { pool } from '../database/connection';
import FormData from 'form-data';
import Mailgun from 'mailgun.js';

let isRunning = false;

async function getMailgunClient() {
  const result = await pool.query(`SELECT api_key, region FROM mailgun_credentials WHERE is_active=TRUE LIMIT 1`);
  if (!result.rows[0]) throw new Error('Nenhuma credencial Mailgun configurada');
  const { api_key, region } = result.rows[0];
  const mailgun = new Mailgun(FormData);
  return mailgun.client({ username: 'api', key: api_key, url: region === 'eu' ? 'https://api.eu.mailgun.net' : 'https://api.mailgun.net' });
}

async function processCampaigns() {
  if (isRunning) return;
  isRunning = true;

  try {
    // Busca campanhas ativas em envio
    const campaigns = await pool.query(
      `SELECT * FROM email_marketing_campaigns WHERE status='sending' ORDER BY started_at ASC`
    );

    for (const campaign of campaigns.rows) {
      try {
        // Verifica se ainda está em sending
        const check = await pool.query(`SELECT status FROM email_marketing_campaigns WHERE id=$1`, [campaign.id]);
        if (check.rows[0]?.status !== 'sending') continue;

        // Busca próximo recipient pendente
        const recipResult = await pool.query(
          `SELECT * FROM email_marketing_recipients WHERE campaign_id=$1 AND status='pending' LIMIT 1`,
          [campaign.id]
        );

        if (recipResult.rows.length === 0) {
          // Sem mais pendentes - verifica se tem failed também
          const pending = await pool.query(`SELECT COUNT(*) FROM email_marketing_recipients WHERE campaign_id=$1 AND status='pending'`, [campaign.id]);
          if (parseInt(pending.rows[0].count) === 0) {
            await pool.query(`UPDATE email_marketing_campaigns SET status='completed', completed_at=NOW(), updated_at=NOW() WHERE id=$1`, [campaign.id]);
            console.log(`✅ Campanha ${campaign.id} finalizada`);
          }
          continue;
        }

        const recipient = recipResult.rows[0];

        // Resolve o HTML e assunto (template ou direto)
        let html = campaign.body_html;
        let text = campaign.body_text;
        let subject = campaign.subject;

        if (campaign.template_id && (!html)) {
          const tpl = await pool.query(`SELECT body_html, body_text, subject FROM email_marketing_templates WHERE id=$1`, [campaign.template_id]);
          if (tpl.rows[0]) {
            html = html || tpl.rows[0].body_html;
            text = text || tpl.rows[0].body_text;
          }
        }

        // Substitui variáveis básicas
        const recipName = recipient.name || recipient.email;
        if (html) html = html.replace(/\{\{nome\}\}/gi, recipName).replace(/\{\{email\}\}/gi, recipient.email);
        if (text) text = text.replace(/\{\{nome\}\}/gi, recipName).replace(/\{\{email\}\}/gi, recipient.email);

        // Busca domínio
        let domain = campaign.from_email.split('@')[1];
        if (campaign.domain_id) {
          const domainRow = await pool.query(`SELECT domain FROM email_marketing_domains WHERE id=$1`, [campaign.domain_id]);
          if (domainRow.rows[0]) domain = domainRow.rows[0].domain;
        }

        try {
          const mg = await getMailgunClient();
          const result = await mg.messages.create(domain, {
            from: `${campaign.from_name} <${campaign.from_email}>`,
            to: [recipient.name ? `${recipient.name} <${recipient.email}>` : recipient.email],
            'h:Reply-To': campaign.reply_to || campaign.from_email,
            subject,
            html: html || undefined,
            text: text || 'Por favor, habilite HTML para visualizar este e-mail.',
            'o:tracking': 'yes',
            'o:tracking-clicks': 'yes',
            'o:tracking-opens': 'yes',
          });

          await pool.query(
            `UPDATE email_marketing_recipients SET status='sent', mailgun_message_id=$1, sent_at=NOW(), updated_at=NOW() WHERE id=$2`,
            [result.id, recipient.id]
          );

          await pool.query(`UPDATE email_marketing_campaigns SET sent_count=sent_count+1, updated_at=NOW() WHERE id=$1`, [campaign.id]);

        } catch (sendError: any) {
          console.error(`❌ Erro ao enviar para ${recipient.email}:`, sendError.message);
          await pool.query(
            `UPDATE email_marketing_recipients SET status='failed', error_message=$1, updated_at=NOW() WHERE id=$2`,
            [sendError.message, recipient.id]
          );
          await pool.query(`UPDATE email_marketing_campaigns SET failed_count=failed_count+1, updated_at=NOW() WHERE id=$1`, [campaign.id]);
        }

        // Delay entre envios
        const delayMs = (campaign.delay_seconds || 1) * 1000;
        await new Promise(r => setTimeout(r, delayMs));

      } catch (campaignError: any) {
        console.error(`❌ Erro ao processar campanha ${campaign.id}:`, campaignError.message);
      }
    }

  } catch (error: any) {
    console.error('❌ Erro no worker de email marketing:', error.message);
  } finally {
    isRunning = false;
  }
}

export function startEmailMarketingWorker() {
  console.log('📧 Worker Email Marketing iniciado');
  setInterval(processCampaigns, 3000);
}
