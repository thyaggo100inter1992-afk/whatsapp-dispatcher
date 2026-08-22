import { pool } from '../database/connection';
import { ensureEmailHtml, applyEmailVariables, generateProtocol, detectUsedEmailVars } from '../utils/email-html';
import { sendMarketingEmail } from '../services/email-marketing-provider.service';
import { buildInterceptReplyTo } from '../utils/email-reply-token';

let isRunning = false;

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

// Pega item de um array JSON rotacionando pelo índice
function pickRotating(arr: any[], index: number): any {
  if (!arr || arr.length === 0) return null;
  return arr[index % arr.length];
}

function extractLocalPart(rawFrom: string): string {
  const raw = String(rawFrom || '').trim();
  return (raw.includes('@') ? raw.split('@')[0] : raw)
    .replace(/[^a-zA-Z0-9._+-]/g, '')
    .toLowerCase();
}

/** Monta pool de rotação: usuários × todos os domain_ids (não confia só em from_senders) */
async function buildRotationPool(campaign: any): Promise<Array<{ from_name: string; from_email: string; domain: string }>> {
  let domainIds: number[] = [];
  try {
    const raw = campaign.domain_ids;
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (Array.isArray(parsed)) {
      domainIds = parsed.map((x: any) => Number(x)).filter((n: number) => Number.isFinite(n) && n > 0);
    }
  } catch { /* ignore */ }
  if (domainIds.length === 0 && campaign.domain_id) {
    domainIds = [Number(campaign.domain_id)];
  }

  const domainNames: string[] = [];
  if (domainIds.length > 0) {
    const dres = await pool.query(
      `SELECT id, domain FROM email_marketing_domains WHERE id = ANY($1::int[])`,
      [domainIds]
    );
    const byId = new Map(dres.rows.map((r: any) => [Number(r.id), String(r.domain || '').toLowerCase()]));
    for (const id of domainIds) {
      const name = byId.get(id);
      if (name && !domainNames.includes(name)) domainNames.push(name);
    }
  }

  let sendersRaw: any[] = [];
  try {
    const s = campaign.from_senders;
    sendersRaw = typeof s === 'string' ? JSON.parse(s) : (Array.isArray(s) ? s : []);
  } catch {
    sendersRaw = [];
  }

  const locals: Array<{ local: string; from_name: string }> = [];
  const seenLocal = new Set<string>();
  for (const s of sendersRaw) {
    const local = extractLocalPart(s?.from_email || '');
    if (!local || seenLocal.has(local)) continue;
    seenLocal.add(local);
    locals.push({ local, from_name: String(s?.from_name || '').trim() });
  }
  if (locals.length === 0 && campaign.from_email) {
    const local = extractLocalPart(campaign.from_email);
    if (local) locals.push({ local, from_name: String(campaign.from_name || '').trim() });
  }

  const poolOut: Array<{ from_name: string; from_email: string; domain: string }> = [];
  const seenFull = new Set<string>();

  if (domainNames.length > 0 && locals.length > 0) {
    for (const loc of locals) {
      for (const dom of domainNames) {
        const full = `${loc.local}@${dom}`;
        if (seenFull.has(full)) continue;
        seenFull.add(full);
        poolOut.push({ from_name: loc.from_name, from_email: full, domain: dom });
      }
    }
    return poolOut;
  }

  // Fallback: from_senders como está
  for (const s of sendersRaw) {
    const email = String(s?.from_email || '').trim().toLowerCase();
    if (!email.includes('@')) continue;
    if (seenFull.has(email)) continue;
    seenFull.add(email);
    poolOut.push({
      from_name: String(s?.from_name || '').trim(),
      from_email: email,
      domain: email.split('@')[1] || '',
    });
  }
  return poolOut;
}

async function processOneCampaignTick(campaign: any): Promise<void> {
  // Reverifica status
  const check = await pool.query(`SELECT status FROM email_marketing_campaigns WHERE id=$1`, [campaign.id]);
  if (check.rows[0]?.status !== 'sending') return;

  // Verifica horário de trabalho
  const workStart = campaign.work_start_time || '08:00';
  const workEnd   = campaign.work_end_time   || '20:00';
  if (!isWithinWorkHours(workStart, workEnd)) {
    console.log(`⏰ Campanha ${campaign.id} fora do horário de trabalho (${workStart}-${workEnd}), aguardando...`);
    return;
  }

  // Verifica pausa automática
  const pauseAfter = campaign.pause_after || 0;
  if (pauseAfter > 0) {
    const sentInSession = campaign.sent_in_session || 0;
    if (sentInSession >= pauseAfter) {
      const pauseStarted = campaign.pause_started_at ? new Date(campaign.pause_started_at) : null;
      const pauseDurMin  = campaign.pause_duration_minutes || 30;
      if (pauseStarted) {
        const pausedMs = Date.now() - pauseStarted.getTime();
        if (pausedMs < pauseDurMin * 60 * 1000) {
          const remaining = Math.ceil((pauseDurMin * 60 * 1000 - pausedMs) / 60000);
          console.log(`⏸ Campanha ${campaign.id} em pausa automática — ${remaining}min restantes`);
          return;
        }
        await pool.query(
          `UPDATE email_marketing_campaigns SET sent_in_session=0, pause_started_at=NULL, updated_at=NOW() WHERE id=$1`,
          [campaign.id]
        );
        campaign.sent_in_session = 0;
        campaign.pause_started_at = null;
        console.log(`▶️ Campanha ${campaign.id} retomada após pausa automática`);
      } else {
        await pool.query(
          `UPDATE email_marketing_campaigns SET pause_started_at=NOW(), updated_at=NOW() WHERE id=$1`,
          [campaign.id]
        );
        console.log(`⏸ Campanha ${campaign.id} entrando em pausa automática por ${pauseDurMin}min após ${sentInSession} envios`);
        return;
      }
    }
  }

  // Busca próximo recipient pendente (lock leve para evitar double-send entre ticks paralelos)
  const recipResult = await pool.query(
    `UPDATE email_marketing_recipients
     SET status='sending', updated_at=NOW()
     WHERE id = (
       SELECT id FROM email_marketing_recipients
       WHERE campaign_id=$1 AND status='pending'
       ORDER BY id ASC
       LIMIT 1
       FOR UPDATE SKIP LOCKED
     )
     RETURNING *`,
    [campaign.id]
  );

  if (recipResult.rows.length === 0) {
    const pending = await pool.query(
      `SELECT COUNT(*) FROM email_marketing_recipients WHERE campaign_id=$1 AND status IN ('pending','sending')`,
      [campaign.id]
    );
    if (parseInt(pending.rows[0].count) === 0) {
      await pool.query(
        `UPDATE email_marketing_campaigns SET status='completed', completed_at=NOW(), updated_at=NOW() WHERE id=$1`,
        [campaign.id]
      );
      console.log(`✅ Campanha ${campaign.id} finalizada`);
    }
    return;
  }

  const recipient = recipResult.rows[0];

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

  const recipName = (recipient.name && String(recipient.name).trim()) || recipient.email;
  const recipEmail = recipient.email;

  const subjectsPreview = campaign.subjects
    ? (typeof campaign.subjects === 'string' ? JSON.parse(campaign.subjects) : campaign.subjects)
    : [campaign.subject];
  const used = detectUsedEmailVars(
    html,
    text,
    campaign.subject,
    ...(Array.isArray(subjectsPreview) ? subjectsPreview : [])
  );

  let protocol: string | null = null;
  if (used.protocolo) {
    protocol = generateProtocol();
    await pool.query(
      `UPDATE email_marketing_recipients SET protocol=$1, updated_at=NOW() WHERE id=$2`,
      [protocol, recipient.id]
    );
  } else {
    await pool.query(
      `UPDATE email_marketing_recipients SET protocol=NULL, updated_at=NOW() WHERE id=$1`,
      [recipient.id]
    );
  }

  const prepared = ensureEmailHtml(html, text);
  const recipVars = {
    nome: recipName,
    email: recipEmail,
    cpf: recipient.cpf || '',
    telefone: recipient.phone || '',
    phone: recipient.phone || '',
    var1: recipient.var1 || '',
    var2: recipient.var2 || '',
    var3: recipient.var3 || '',
    var4: recipient.var4 || '',
    var5: recipient.var5 || '',
    protocolo: protocol || '',
  };
  html = applyEmailVariables(prepared.html, recipVars);
  text = applyEmailVariables(prepared.text, recipVars, { escapeValues: false });

  // === ROTAÇÃO DE REMETENTES × DOMÍNIOS (índice estável pelo destinatário) ===
  const rotRow = await pool.query(
    `SELECT COUNT(*)::int AS n
     FROM email_marketing_recipients
     WHERE campaign_id=$1 AND status <> 'pending' AND id <= $2`,
    [campaign.id, recipient.id]
  );
  const rotIndex = Math.max(0, Number(rotRow.rows[0]?.n || 1) - 1);

  const rotationPool = await buildRotationPool(campaign);
  let fromName  = campaign.from_name;
  let fromEmail = campaign.from_email;
  let domain = '';

  if (rotationPool.length > 0) {
    const picked = pickRotating(rotationPool, rotIndex);
    fromName  = picked.from_name || fromName;
    fromEmail = picked.from_email || fromEmail;
    domain    = picked.domain || '';
  } else {
    // legado
    const sendersArr = campaign.from_senders
      ? (typeof campaign.from_senders === 'string' ? JSON.parse(campaign.from_senders) : campaign.from_senders)
      : null;
    if (Array.isArray(sendersArr) && sendersArr.length > 0) {
      const sender = pickRotating(sendersArr, rotIndex);
      fromName  = sender.from_name  || fromName;
      fromEmail = sender.from_email || fromEmail;
    }
    domain = fromEmail.includes('@') ? String(fromEmail.split('@')[1] || '').toLowerCase() : '';
  }

  // === ROTAÇÃO DE ASSUNTOS ===
  let subject = campaign.subject;
  const subjectsArr = campaign.subjects
    ? (typeof campaign.subjects === 'string' ? JSON.parse(campaign.subjects) : campaign.subjects)
    : null;
  if (Array.isArray(subjectsArr) && subjectsArr.length > 0) {
    subject = pickRotating(subjectsArr, rotIndex) || subject;
  }
  subject = applyEmailVariables(subject, recipVars, { escapeValues: false });

  if (!domain && campaign.domain_id) {
    const domainRow = await pool.query(`SELECT domain FROM email_marketing_domains WHERE id=$1`, [campaign.domain_id]);
    if (domainRow.rows[0]) domain = domainRow.rows[0].domain;
  }

  if (!domain) {
    await pool.query(
      `UPDATE email_marketing_recipients
       SET status='failed', error_message=$1, sent_at=NOW(), updated_at=NOW()
       WHERE id=$2`,
      ['Campanha sem domínio de envio configurado. Selecione um domínio verificado.', recipient.id]
    );
    await pool.query(
      `UPDATE email_marketing_campaigns SET failed_count=failed_count+1, updated_at=NOW() WHERE id=$1`,
      [campaign.id]
    );
    return;
  }

  fromEmail = buildFromEmail(fromEmail, domain);

  try {
    const attendant = String(campaign.reply_to || '').trim();
    const intercept = attendant ? buildInterceptReplyTo('r', Number(recipient.id)) : null;
    const sent = await sendMarketingEmail({
      domain,
      fromEmail,
      fromName,
      toEmail: recipient.email,
      toName: recipient.name,
      replyTo: intercept || attendant || fromEmail,
      subject,
      html,
      text: text || 'Por favor, habilite HTML para visualizar este e-mail.',
    });

    const msgId = sent.messageId;
    try {
      await pool.query(
        `UPDATE email_marketing_recipients
         SET status='sent',
             mailgun_message_id=$1,
             provider_message_id=$1,
             sent_from_email=$2,
             sent_domain=$3,
             sent_at=NOW(),
             updated_at=NOW()
         WHERE id=$4`,
        [msgId, fromEmail, domain, recipient.id]
      );
    } catch {
      await pool.query(
        `UPDATE email_marketing_recipients
         SET status='sent',
             mailgun_message_id=$1,
             provider_message_id=$1,
             sent_at=NOW(),
             updated_at=NOW()
         WHERE id=$2`,
        [msgId, recipient.id]
      );
    }
    await pool.query(
      `UPDATE email_marketing_campaigns c SET
         sent_count = (SELECT COUNT(*)::int FROM email_marketing_recipients r WHERE r.campaign_id=c.id AND r.status IN ('sent','opened','clicked','replied')),
         failed_count = (SELECT COUNT(*)::int FROM email_marketing_recipients r WHERE r.campaign_id=c.id AND r.status='failed'),
         sent_in_session = COALESCE(sent_in_session,0)+1,
         updated_at = NOW()
       WHERE c.id=$1`,
      [campaign.id]
    );
  } catch (sendError: any) {
    const friendly = formatSendError(sendError, fromEmail, domain);
    console.error(`❌ Erro ao enviar para ${recipient.email}:`, friendly);
    try {
      await pool.query(
        `UPDATE email_marketing_recipients
         SET status='failed', error_message=$1, sent_from_email=$2, sent_domain=$3, sent_at=NOW(), updated_at=NOW()
         WHERE id=$4`,
        [friendly, fromEmail, domain, recipient.id]
      );
    } catch {
      await pool.query(
        `UPDATE email_marketing_recipients SET status='failed', error_message=$1, sent_at=NOW(), updated_at=NOW() WHERE id=$2`,
        [friendly, recipient.id]
      );
    }
    await pool.query(
      `UPDATE email_marketing_campaigns c SET
         sent_count = (SELECT COUNT(*)::int FROM email_marketing_recipients r WHERE r.campaign_id=c.id AND r.status IN ('sent','opened','clicked','replied')),
         failed_count = (SELECT COUNT(*)::int FROM email_marketing_recipients r WHERE r.campaign_id=c.id AND r.status='failed'),
         updated_at = NOW()
       WHERE c.id=$1`,
      [campaign.id]
    );
  }

  // Delay desta campanha (não bloqueia as outras — rodam em paralelo)
  const minSec = campaign.delay_seconds_min || campaign.delay_seconds || 1;
  const maxSec = campaign.delay_seconds_max || campaign.delay_seconds || 3;
  await randomDelay(minSec, maxSec);
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

    // Recupera recipients travados em 'sending' (crash / timeout)
    await pool.query(`
      UPDATE email_marketing_recipients
      SET status='pending', updated_at=NOW()
      WHERE status='sending'
        AND updated_at < NOW() - INTERVAL '5 minutes'
    `);

    // 2. Busca campanhas em envio — processa TODAS em paralelo (uma mensagem cada)
    const campaigns = await pool.query(
      `SELECT * FROM email_marketing_campaigns WHERE status='sending' ORDER BY started_at ASC`
    );

    if (campaigns.rows.length === 0) return;

    await Promise.all(
      campaigns.rows.map(async (campaign: any) => {
        try {
          await processOneCampaignTick(campaign);
        } catch (campaignError: any) {
          console.error(`❌ Erro ao processar campanha ${campaign.id}:`, campaignError.message);
        }
      })
    );
  } catch (error: any) {
    console.error('❌ Erro no worker de email marketing:', error.message);
  } finally {
    isRunning = false;
  }
}

export function startEmailMarketingWorker() {
  console.log('📧 Worker Email Marketing iniciado (paralelo + multi-domínio + rotação)');
  setInterval(processCampaigns, 3000);
}
