import { pool } from '../database/connection';
import FormData from 'form-data';
import Mailgun from 'mailgun.js';

let isRunning = false;

async function getMailgunClient() {
  const result = await pool.query(`SELECT api_key, region FROM mailgun_credentials WHERE is_active=TRUE LIMIT 1`);
  if (!result.rows[0]) throw new Error('Nenhuma credencial Mailgun configurada');
  const { api_key, region } = result.rows[0];
  const mailgun = new Mailgun(FormData);
  return mailgun.client({
    username: 'api',
    key: api_key,
    url: region === 'eu' ? 'https://api.eu.mailgun.net' : 'https://api.mailgun.net',
  });
}

/** Monta e-mail remetente sempre no domínio de envio (local@dominio) */
function buildFromEmail(rawFrom: string, domain: string): string {
  const raw = String(rawFrom || '').trim();
  const local = (raw.includes('@') ? raw.split('@')[0] : raw)
    .replace(/[^a-zA-Z0-9._+-]/g, '')
    .toLowerCase();
  if (!local || !domain) return raw;
  return `${local}@${domain}`;
}

/** Mensagem de erro legível a partir da resposta do Mailgun */
function formatSendError(err: any, fromEmail: string, domain: string): string {
    const status = err?.status || err?.statusCode;
  const msg = String(err?.message || err?.details || 'Erro desconhecido');
  const details =
    typeof err?.details === 'string'
      ? err.details
      : err?.details?.message || err?.type || '';
  const fromDomain = (fromEmail.split('@')[1] || '').toLowerCase();
  const sendDomain = (domain || '').toLowerCase();

  if (status === 403 || /forbidden/i.test(msg)) {
    if (fromDomain && sendDomain && fromDomain !== sendDomain) {
      return `Remetente não autorizado: "${fromEmail}" não pertence ao domínio de envio "${domain}". Use um endereço @${domain}.`;
    }
    return `Envio bloqueado (Forbidden). Domínio de envio: ${domain || '—'}. Remetente: ${fromEmail}. Verifique se o domínio está ativo e o remetente é permitido.`;
  }
  if (status === 401 || /unauthorized/i.test(msg)) {
    return `Credencial de envio inválida ou sem permissão (401). Contate o administrador.`;
  }
  if (status === 400 || /bad request/i.test(msg)) {
    return `Requisição inválida ao servidor de e-mail: ${details || msg}`;
  }
  if (/rate|limit|too many/i.test(msg + details)) {
    return `Limite de envio atingido. Aguarde e tente novamente. Detalhe: ${msg}`;
  }
  const extra = details && details !== msg ? ` — ${details}` : '';
  return `${msg}${extra}`.slice(0, 500);
}

// Verifica se o horário atual (America/Sao_Paulo) está dentro da janela de trabalho
function isWithinWorkHours(startTime: string, endTime: string): boolean {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const hour = Number(parts.find(p => p.type === 'hour')?.value || 0);
  const minute = Number(parts.find(p => p.type === 'minute')?.value || 0);
  const [startH, startM] = (startTime || '08:00').split(':').map(Number);
  const [endH, endM] = (endTime || '20:00').split(':').map(Number);
  const currentMinutes = hour * 60 + minute;
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

// Delay aleatório entre min e max segundos
function randomDelay(minSec: number, maxSec: number): Promise<void> {
  const ms = (Math.floor(Math.random() * (maxSec - minSec + 1)) + minSec) * 1000;
  return new Promise(r => setTimeout(r, ms));
}

// Pega item de um array JSON rotacionando pelo índice (baseado no sent_count)
function pickRotating(arr: any[], index: number): any {
  if (!arr || arr.length === 0) return null;
  return arr[index % arr.length];
}

async function processCampaigns() {
  if (isRunning) return;
  isRunning = true;

  try {
    // 1. Ativar campanhas agendadas cujo horário chegou
    await pool.query(`
      UPDATE email_marketing_campaigns
      SET status='sending', started_at=NOW(), sent_in_session=0, updated_at=NOW()
      WHERE status='scheduled'
        AND scheduled_at IS NOT NULL
        AND scheduled_at <= NOW()
    `);

    // 2. Busca campanhas em envio
    const campaigns = await pool.query(
      `SELECT * FROM email_marketing_campaigns WHERE status='sending' ORDER BY started_at ASC`
    );

    for (const campaign of campaigns.rows) {
      try {
        // Reverifica status
        const check = await pool.query(`SELECT status FROM email_marketing_campaigns WHERE id=$1`, [campaign.id]);
        if (check.rows[0]?.status !== 'sending') continue;

        // Verifica horário de trabalho
        const workStart = campaign.work_start_time || '08:00';
        const workEnd   = campaign.work_end_time   || '20:00';
        if (!isWithinWorkHours(workStart, workEnd)) {
          console.log(`⏰ Campanha ${campaign.id} fora do horário de trabalho (${workStart}-${workEnd}), aguardando...`);
          continue;
        }

        // Verifica pausa automática
        const pauseAfter = campaign.pause_after || 0;
        if (pauseAfter > 0) {
          const sentInSession = campaign.sent_in_session || 0;
          if (sentInSession >= pauseAfter) {
            // Verificar se já expirou o tempo de pausa
            const pauseStarted = campaign.pause_started_at ? new Date(campaign.pause_started_at) : null;
            const pauseDurMin  = campaign.pause_duration_minutes || 30;
            if (pauseStarted) {
              const pausedMs = Date.now() - pauseStarted.getTime();
              if (pausedMs < pauseDurMin * 60 * 1000) {
                const remaining = Math.ceil((pauseDurMin * 60 * 1000 - pausedMs) / 60000);
                console.log(`⏸ Campanha ${campaign.id} em pausa automática — ${remaining}min restantes`);
                continue;
              } else {
                // Pausa expirou — resetar sessão e continuar
                await pool.query(
                  `UPDATE email_marketing_campaigns SET sent_in_session=0, pause_started_at=NULL, updated_at=NOW() WHERE id=$1`,
                  [campaign.id]
                );
                campaign.sent_in_session = 0;
                campaign.pause_started_at = null;
                console.log(`▶️ Campanha ${campaign.id} retomada após pausa automática`);
              }
            } else {
              // Iniciar pausa
              await pool.query(
                `UPDATE email_marketing_campaigns SET pause_started_at=NOW(), updated_at=NOW() WHERE id=$1`,
                [campaign.id]
              );
              console.log(`⏸ Campanha ${campaign.id} entrando em pausa automática por ${pauseDurMin}min após ${sentInSession} envios`);
              continue;
            }
          }
        }

        // Busca próximo recipient pendente
        const recipResult = await pool.query(
          `SELECT * FROM email_marketing_recipients WHERE campaign_id=$1 AND status='pending' LIMIT 1`,
          [campaign.id]
        );

        if (recipResult.rows.length === 0) {
          const pending = await pool.query(
            `SELECT COUNT(*) FROM email_marketing_recipients WHERE campaign_id=$1 AND status='pending'`,
            [campaign.id]
          );
          if (parseInt(pending.rows[0].count) === 0) {
            await pool.query(
              `UPDATE email_marketing_campaigns SET status='completed', completed_at=NOW(), updated_at=NOW() WHERE id=$1`,
              [campaign.id]
            );
            console.log(`✅ Campanha ${campaign.id} finalizada`);
          }
          continue;
        }

        const recipient = recipResult.rows[0];

        // Resolve HTML e texto (template ou direto)
        let html    = campaign.body_html;
        let text    = campaign.body_text;

        if (campaign.template_id && !html) {
          const tpl = await pool.query(
            `SELECT body_html, body_text FROM email_marketing_templates WHERE id=$1`,
            [campaign.template_id]
          );
          if (tpl.rows[0]) {
            html = html || tpl.rows[0].body_html;
            text = text || tpl.rows[0].body_text;
          }
        }

        // Substitui variáveis básicas
        const recipName = recipient.name || recipient.email;
        if (html) html = html.replace(/\{\{nome\}\}/gi, recipName).replace(/\{\{email\}\}/gi, recipient.email);
        if (text) text = text.replace(/\{\{nome\}\}/gi, recipName).replace(/\{\{email\}\}/gi, recipient.email);

        // === ROTAÇÃO DE REMETENTES ===
        const sentCount = campaign.sent_count || 0;
        let fromName  = campaign.from_name;
        let fromEmail = campaign.from_email;

        const sendersArr = campaign.from_senders
          ? (typeof campaign.from_senders === 'string' ? JSON.parse(campaign.from_senders) : campaign.from_senders)
          : null;
        if (Array.isArray(sendersArr) && sendersArr.length > 0) {
          const sender = pickRotating(sendersArr, sentCount);
          fromName  = sender.from_name  || fromName;
          fromEmail = sender.from_email || fromEmail;
        }

        // === ROTAÇÃO DE ASSUNTOS ===
        let subject = campaign.subject;
        const subjectsArr = campaign.subjects
          ? (typeof campaign.subjects === 'string' ? JSON.parse(campaign.subjects) : campaign.subjects)
          : null;
        if (Array.isArray(subjectsArr) && subjectsArr.length > 0) {
          subject = pickRotating(subjectsArr, sentCount) || subject;
        }

        // Resolve domínio de envio e força remetente no domínio correto
        let domain = fromEmail.includes('@') ? fromEmail.split('@')[1] : '';
        if (campaign.domain_id) {
          const domainRow = await pool.query(`SELECT domain FROM email_marketing_domains WHERE id=$1`, [campaign.domain_id]);
          if (domainRow.rows[0]) domain = domainRow.rows[0].domain;
        }

        if (!domain) {
          await pool.query(
            `UPDATE email_marketing_recipients SET status='failed', error_message=$1, sent_at=NOW(), updated_at=NOW() WHERE id=$2`,
            ['Campanha sem domínio de envio configurado. Selecione um domínio verificado.', recipient.id]
          );
          await pool.query(
            `UPDATE email_marketing_campaigns SET failed_count=failed_count+1, updated_at=NOW() WHERE id=$1`,
            [campaign.id]
          );
          continue;
        }

        fromEmail = buildFromEmail(fromEmail, domain);

        try {
          const mg = await getMailgunClient();
          const result = await mg.messages.create(domain, {
            from: `${fromName} <${fromEmail}>`,
            to: [recipient.name ? `${recipient.name} <${recipient.email}>` : recipient.email],
            'h:Reply-To': campaign.reply_to || fromEmail,
            subject,
            html: html || undefined,
            text: text || 'Por favor, habilite HTML para visualizar este e-mail.',
            'o:tracking': 'yes',
            'o:tracking-clicks': 'yes',
            'o:tracking-opens': 'yes',
          });

          const msgId = (result.id || '').replace(/^<|>$/g, '');
          await pool.query(
            `UPDATE email_marketing_recipients SET status='sent', mailgun_message_id=$1, sent_at=NOW(), updated_at=NOW() WHERE id=$2`,
            [msgId, recipient.id]
          );
          await pool.query(
            `UPDATE email_marketing_campaigns SET sent_count=sent_count+1, sent_in_session=COALESCE(sent_in_session,0)+1, updated_at=NOW() WHERE id=$1`,
            [campaign.id]
          );

        } catch (sendError: any) {
          const friendly = formatSendError(sendError, fromEmail, domain);
          console.error(`❌ Erro ao enviar para ${recipient.email}:`, friendly);
          await pool.query(
            `UPDATE email_marketing_recipients SET status='failed', error_message=$1, sent_at=NOW(), updated_at=NOW() WHERE id=$2`,
            [friendly, recipient.id]
          );
          await pool.query(
            `UPDATE email_marketing_campaigns SET failed_count=failed_count+1, updated_at=NOW() WHERE id=$1`,
            [campaign.id]
          );
        }

        // === DELAY ALEATÓRIO ===
        const minSec = campaign.delay_seconds_min || campaign.delay_seconds || 1;
        const maxSec = campaign.delay_seconds_max || campaign.delay_seconds || 3;
        await randomDelay(minSec, maxSec);

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
  console.log('📧 Worker Email Marketing iniciado (com agendamento, horário, pausa e rotação)');
  setInterval(processCampaigns, 3000);
}
