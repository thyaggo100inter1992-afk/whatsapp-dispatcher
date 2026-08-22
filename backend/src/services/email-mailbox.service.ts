/**
 * Caixas de e-mail (inbox) por tenant — criar endereço + receber/enviar.
 */
import * as dns from 'dns';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { pool } from '../database/connection';
import { getSendGridApiKey, sendMarketingEmail } from './email-marketing-provider.service';
import { extractEmailsFromHeader } from '../utils/email-reply-token';

const resolveMx = promisify(dns.resolveMx);

const INBOUND_WEBHOOK_URL =
  process.env.EMAIL_MARKETING_SENDGRID_INBOUND_URL ||
  'https://api.sistemasnettsistemas.com.br/api/webhook/sendgrid-inbound';

export function buildInboundDnsRecords(domain: string) {
  return [
    {
      record_type: 'MX',
      name: domain,
      value: 'mx.sendgrid.net',
      priority: 10,
      valid: 'unknown',
      _inbound: true,
    },
  ];
}

/**
 * Caixa de e-mail exige MX exclusivo do SendGrid.
 * Se houver Mailgun/outro MX junto, o envio cai aleatoriamente no servidor errado
 * e o remetente recebe bounce "550 Relaying denied".
 */
export async function checkInboundMxOnly(domain: string): Promise<{
  ok: boolean;
  hasSendgrid: boolean;
  conflicts: string[];
  hint?: string;
}> {
  try {
    const results = await resolveMx(String(domain || '').trim().toLowerCase());
    const exchanges = results.map((r) =>
      String(r.exchange || '').toLowerCase().replace(/\.$/, '')
    );
    const hasSendgrid = exchanges.some(
      (ex) => ex === 'mx.sendgrid.net' || ex.endsWith('.sendgrid.net')
    );
    const conflicts = exchanges.filter((ex) => !ex.includes('sendgrid.net'));

    if (!hasSendgrid) {
      return {
        ok: false,
        hasSendgrid: false,
        conflicts,
        hint: 'Adicione o MX mx.sendgrid.net no DNS do domínio.',
      };
    }
    if (conflicts.length > 0) {
      return {
        ok: false,
        hasSendgrid: true,
        conflicts,
        hint: `Remova os outros MX do DNS (deixe só mx.sendgrid.net). Conflito atual: ${conflicts.join(', ')}. Com MX misturados o e-mail pode cair no servidor errado e voltar com "Relaying denied".`,
      };
    }
    return { ok: true, hasSendgrid: true, conflicts: [] };
  } catch {
    return {
      ok: false,
      hasSendgrid: false,
      conflicts: [],
      hint: 'MX ainda não encontrado no DNS. Aguarde a propagação.',
    };
  }
}

/** Registra hostname no Inbound Parse do SendGrid (uma vez por domínio) */
export async function ensureSendGridInboundParse(hostname: string) {
  const apiKey = await getSendGridApiKey();
  const host = String(hostname || '').trim().toLowerCase();
  if (!host) throw new Error('Hostname inválido');

  const listRes = await fetch('https://api.sendgrid.com/v3/user/webhooks/parse/settings', {
    method: 'GET',
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const listData: any = await listRes.json().catch(() => ({}));
  const settings = Array.isArray(listData?.result) ? listData.result : (Array.isArray(listData) ? listData : []);
  const existing = settings.find(
    (s: any) => String(s.hostname || '').toLowerCase() === host
  );
  if (existing) {
    // Atualiza URL se necessário
    if (String(existing.url || '') !== INBOUND_WEBHOOK_URL) {
      await fetch(`https://api.sendgrid.com/v3/user/webhooks/parse/settings/${encodeURIComponent(host)}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: INBOUND_WEBHOOK_URL, spam_check: true, send_raw: false }),
      });
    }
    return existing;
  }

  const createRes = await fetch('https://api.sendgrid.com/v3/user/webhooks/parse/settings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      hostname: host,
      url: INBOUND_WEBHOOK_URL,
      spam_check: true,
      send_raw: false,
    }),
  });
  const created: any = await createRes.json().catch(() => ({}));
  if (!createRes.ok) {
    const msg = String(created?.errors?.[0]?.message || created?.error || `HTTP ${createRes.status}`);
    // Se já existe, trata como ok
    if (/already|exist/i.test(msg)) return { hostname: host, url: INBOUND_WEBHOOK_URL };
    throw new Error(`SendGrid Inbound Parse: ${msg}`);
  }
  return created;
}

export async function findMailboxByEmail(email: string) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized.includes('@')) return null;
  const r = await pool.query(
    `SELECT m.*, d.domain, d.status AS domain_status, d.inbound_status
     FROM email_mailboxes m
     JOIN email_marketing_domains d ON d.id = m.domain_id
     WHERE lower(m.email) = $1 AND m.is_active = TRUE
     LIMIT 1`,
    [normalized]
  );
  return r.rows[0] || null;
}

export function buildThreadKey(subject: string, participants: string[]) {
  const normSubj = String(subject || '')
    .replace(/^(re|fw|fwd|enc|res)\s*:\s*/gi, '')
    .replace(/^(re|fw|fwd|enc|res)\s*:\s*/gi, '')
    .trim()
    .toLowerCase();
  const parts = [...new Set(participants.map((p) => String(p || '').trim().toLowerCase()).filter(Boolean))].sort();
  return `${normSubj}::${parts.join('|')}`.slice(0, 240);
}

export function detectPhishingHints(html: string, text: string): string[] {
  const hints: string[] = [];
  const src = `${html || ''}\n${text || ''}`;
  const linkRe = /href=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  const links: string[] = [];
  while ((m = linkRe.exec(html || ''))) links.push(m[1]);
  for (const href of links) {
    try {
      const u = new URL(href, 'https://example.invalid');
      if (/^\d{1,3}(\.\d{1,3}){3}$/.test(u.hostname)) {
        hints.push(`Link aponta para IP: ${u.hostname}`);
      }
      if (/^(bit\.ly|tinyurl\.com|t\.co|goo\.gl)$/i.test(u.hostname)) {
        hints.push(`Link encurtado suspeito: ${u.hostname}`);
      }
    } catch { /* ignore */ }
  }
  if (/password|senha|verifique\s+sua\s+conta|urgent(e)?|bloquead/i.test(src) && links.length) {
    hints.push('Texto com urgência + links — possível phishing');
  }
  return [...new Set(hints)].slice(0, 5);
}

/** Rank de engajamento (não rebaixa status melhores) */
function mailboxTrackingRank(status: string): number {
  const map: Record<string, number> = {
    pending: 0,
    draft: 0,
    scheduled: 0,
    failed: 1,
    bounced: 1,
    complained: 1,
    sent: 2,
    delivered: 3,
    opened: 4,
    clicked: 5,
    replied: 6,
  };
  return map[String(status || '').toLowerCase()] ?? 0;
}

/**
 * Aplica evento de webhook (SendGrid/Mailgun) em mensagem da caixa.
 * Controlo interno — nunca vai no corpo do e-mail ao cliente.
 */
export async function applyMailboxTrackingEvent(opts: {
  eventType: string; // delivered|open|opened|click|clicked|bounce|bounced|dropped|failed|spamreport|complained|unsubscribe
  messageId?: string | null;
  baseMessageId?: string | null;
  recipientEmail?: string | null;
  mailboxMessageId?: number | null;
  errorMessage?: string | null;
  eventAt?: Date | null;
}): Promise<{ updated: boolean; id?: number; tracking_status?: string }> {
  const eventType = String(opts.eventType || '').toLowerCase();
  const statusMap: Record<string, string> = {
    delivered: 'delivered',
    open: 'opened',
    opened: 'opened',
    click: 'clicked',
    clicked: 'clicked',
    bounce: 'bounced',
    bounced: 'bounced',
    dropped: 'failed',
    failed: 'failed',
    spamreport: 'complained',
    complained: 'complained',
    unsubscribe: 'complained',
  };
  const mapped = statusMap[eventType];
  if (!mapped) return { updated: false };

  const messageId = String(opts.messageId || '').replace(/^<|>$/g, '').trim();
  const baseMessageId = String(opts.baseMessageId || messageId.split('.')[0] || messageId).trim();
  const recipient = String(opts.recipientEmail || '').trim().toLowerCase();
  const customId = opts.mailboxMessageId ? Number(opts.mailboxMessageId) : 0;

  let row: any = null;
  if (customId > 0) {
    const r = await pool.query(
      `SELECT id, mailbox_id, tenant_id, status, tracking_status, opened_at, clicked_at, replied_at, direction
       FROM email_mailbox_messages WHERE id=$1::int LIMIT 1`,
      [customId]
    );
    row = r.rows[0] || null;
  }
  if (!row && (messageId || baseMessageId)) {
    // Match SendGrid X-Message-Id (base) mesmo quando sg_message_id traz sufixo .recvd-...
    const r = await pool.query(
      `SELECT id, mailbox_id, tenant_id, status, tracking_status, opened_at, clicked_at, replied_at, direction
       FROM email_mailbox_messages
       WHERE direction='outbound'
         AND provider_message_id IS NOT NULL
         AND (
           provider_message_id = $1
           OR provider_message_id = $2
           OR $1 LIKE provider_message_id || '.%'
           OR $1 LIKE provider_message_id || '%'
         )
         AND (
           $3 = ''
           OR LOWER(to_email) = $3
           OR LOWER(to_email) LIKE '%' || $3 || '%'
         )
       ORDER BY id DESC
       LIMIT 1`,
      [messageId || baseMessageId, baseMessageId, recipient]
    );
    row = r.rows[0] || null;
  }
  if (!row) return { updated: false };

  const prev = String(row.tracking_status || row.status || 'sent').toLowerCase();
  let next = mapped;
  if (prev === 'replied' && !['failed', 'bounced', 'complained'].includes(mapped)) {
    next = 'replied';
  } else if (mapped === 'opened' && (row.clicked_at || prev === 'clicked')) {
    next = prev === 'replied' ? 'replied' : 'clicked';
  } else if (mailboxTrackingRank(mapped) < mailboxTrackingRank(prev) && !['failed', 'bounced', 'complained'].includes(mapped)) {
    // não rebaixa (ex.: delivered depois de opened)
    next = prev;
  }

  const setOpened = eventType === 'open' || eventType === 'opened' || eventType === 'click' || eventType === 'clicked';
  const setClicked = eventType === 'click' || eventType === 'clicked';
  // open/click implicam entrega na caixa do destinatário
  const setDelivered = eventType === 'delivered' || setOpened || setClicked;
  const setBounced = ['bounce', 'bounced', 'dropped', 'failed', 'spamreport'].includes(eventType);
  const eventAt =
    opts.eventAt instanceof Date && !Number.isNaN(opts.eventAt.getTime())
      ? opts.eventAt
      : new Date();
  const errMsg = opts.errorMessage ? String(opts.errorMessage).slice(0, 500) : null;

  // Casts explícitos evitam "inconsistent types deduced for parameter $N" no Postgres
  await pool.query(
    `UPDATE email_mailbox_messages SET
       tracking_status = $1::varchar(30),
       status = CASE
         WHEN $1::text IN ('bounced','failed','complained') THEN $1::varchar(30)
         WHEN status IN ('draft','scheduled','pending','failed') THEN 'sent'
         ELSE status
       END,
       delivered_at = CASE WHEN $2::boolean THEN COALESCE(delivered_at, $6::timestamptz) ELSE delivered_at END,
       opened_at    = CASE WHEN $3::boolean THEN COALESCE(opened_at, $6::timestamptz) ELSE opened_at END,
       clicked_at   = CASE WHEN $4::boolean THEN COALESCE(clicked_at, $6::timestamptz) ELSE clicked_at END,
       bounced_at   = CASE WHEN $5::boolean THEN COALESCE(bounced_at, $6::timestamptz) ELSE bounced_at END,
       error_message = COALESCE($7::text, error_message),
       updated_at = NOW()
     WHERE id = $8::int`,
    [
      next,
      setDelivered,
      setOpened,
      setClicked,
      setBounced,
      eventAt.toISOString(),
      errMsg,
      Number(row.id),
    ]
  );

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { io } = require('../server');
    if (io) {
      io.emit('mailbox:tracking', {
        tenantId: row.tenant_id,
        mailboxId: row.mailbox_id,
        messageId: row.id,
        tracking_status: next,
      });
    }
  } catch {
    /* socket opcional */
  }

  return { updated: true, id: row.id, tracking_status: next };
}

/** Marca outbound anterior da conversa como replied (quando chega resposta na caixa) */
export async function markMailboxThreadReplied(opts: {
  tenantId: number;
  mailboxId: number;
  fromEmail: string;
  subject?: string | null;
  inReplyTo?: string | null;
}) {
  const from = String(opts.fromEmail || '').trim().toLowerCase();
  if (!from.includes('@')) return;

  // 1) Por In-Reply-To / message_id
  if (opts.inReplyTo) {
    const mid = String(opts.inReplyTo).replace(/^<|>$/g, '').trim();
    if (mid) {
      const r = await pool.query(
        `UPDATE email_mailbox_messages SET
           tracking_status='replied',
           replied_at=COALESCE(replied_at, NOW()),
           opened_at=COALESCE(opened_at, NOW()),
           delivered_at=COALESCE(delivered_at, NOW()),
           updated_at=NOW()
         WHERE mailbox_id=$1 AND tenant_id=$2 AND direction='outbound'
           AND (message_id=$3 OR message_id LIKE $4 OR provider_message_id=$3)
         RETURNING id`,
        [opts.mailboxId, opts.tenantId, mid, `${mid}%`]
      );
      if (r.rowCount) return;
    }
  }

  // 2) Último outbound para esse e-mail (mesmo thread aproximado)
  const threadKey = buildThreadKey(opts.subject || '', [from]);
  await pool.query(
    `UPDATE email_mailbox_messages SET
       tracking_status='replied',
       replied_at=COALESCE(replied_at, NOW()),
       opened_at=COALESCE(opened_at, NOW()),
       delivered_at=COALESCE(delivered_at, NOW()),
       updated_at=NOW()
     WHERE id = (
       SELECT id FROM email_mailbox_messages
       WHERE mailbox_id=$1 AND tenant_id=$2 AND direction='outbound'
         AND LOWER(to_email)=$3
         AND (thread_key=$4 OR thread_key LIKE $5 OR $4 = '' OR thread_key IS NULL)
       ORDER BY COALESCE(sent_at, created_at) DESC
       LIMIT 1
     )`,
    [opts.mailboxId, opts.tenantId, from, threadKey, `${String(opts.subject || '').replace(/^(re|fw|fwd|enc|res)\s*:\s*/gi, '').trim().toLowerCase()}%`]
  );
}

export type InboundMulterFile = {
  fieldname: string;
  originalname?: string;
  mimetype?: string;
  buffer: Buffer;
  size?: number;
};

function safeFileName(name: string) {
  return String(name || 'arquivo')
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 120) || 'arquivo';
}

function parseJsonObject(raw: any): Record<string, any> {
  if (!raw) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(String(raw));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/** Salva anexos do Inbound Parse e troca cid: por URL pública /uploads */
async function persistInboundAttachments(opts: {
  tenantId: number;
  mailboxId: number;
  messageId: number;
  html: string;
  files?: InboundMulterFile[];
  attachmentInfoRaw?: any;
  contentIdsRaw?: any;
}): Promise<{ html: string; attachments: any[] }> {
  const files = Array.isArray(opts.files) ? opts.files : [];
  if (files.length === 0) {
    return { html: opts.html || '', attachments: [] };
  }

  const attachmentInfo = parseJsonObject(opts.attachmentInfoRaw);
  const contentIds = parseJsonObject(opts.contentIdsRaw); // cid -> attachmentN
  const uploadDir = path.join(
    __dirname,
    '../../uploads/email-inbox',
    String(opts.tenantId),
    String(opts.mailboxId)
  );
  fs.mkdirSync(uploadDir, { recursive: true });

  const attachments: any[] = [];
  const fieldToUrl: Record<string, string> = {};
  const cidToUrl: Record<string, string> = {};

  for (const file of files) {
    const field = String(file.fieldname || '');
    // SendGrid: attachment1, attachment2... — ignora outros campos de formulário
    if (!/^attachment\d+$/i.test(field)) continue;
    if (!file.buffer || !Buffer.isBuffer(file.buffer)) continue;

    const meta = attachmentInfo[field] || {};
    const filename = safeFileName(meta.filename || meta.name || file.originalname || `${field}.bin`);
    const stored = `${opts.messageId}-${Date.now()}-${filename}`;
    fs.writeFileSync(path.join(uploadDir, stored), file.buffer);
    const url = `/uploads/email-inbox/${opts.tenantId}/${opts.mailboxId}/${stored}`;
    fieldToUrl[field] = url;

    const contentId = String(meta['content-id'] || meta.content_id || '')
      .replace(/[<>]/g, '')
      .trim();
    if (contentId) cidToUrl[contentId] = url;

    attachments.push({
      filename,
      contentType: meta.type || file.mimetype || 'application/octet-stream',
      size: file.size || file.buffer.length,
      url,
      contentId: contentId || null,
      fieldname: field,
    });
  }

  for (const [cid, field] of Object.entries(contentIds)) {
    const cleanCid = String(cid).replace(/[<>]/g, '').trim();
    const url = fieldToUrl[String(field)];
    if (cleanCid && url) cidToUrl[cleanCid] = url;
  }

  let html = String(opts.html || '');
  if (Object.keys(cidToUrl).length > 0) {
    html = html.replace(/src=(["'])cid:([^"']+)\1/gi, (_m, quote, cid) => {
      const url = cidToUrl[String(cid).replace(/[<>]/g, '').trim()];
      return url ? `src=${quote}${url}${quote}` : `src=${quote}cid:${cid}${quote}`;
    });
  }

  // Se ainda há cid quebrado ou HTML sem as imagens, anexa <img> no final
  const imageAtts = attachments.filter((a) => String(a.contentType || '').startsWith('image/'));
  for (const a of imageAtts) {
    if (!html.includes(a.url)) {
      html += `<div style="margin-top:12px"><img src="${a.url}" alt="${a.filename}" style="max-width:100%;height:auto"/></div>`;
    }
  }

  return { html, attachments };
}

export async function ingestInboundToMailbox(opts: {
  toCandidates: string[];
  fromRaw: string;
  subject: string;
  text: string;
  html: string;
  messageId?: string | null;
  files?: InboundMulterFile[];
  attachmentInfoRaw?: any;
  contentIdsRaw?: any;
}): Promise<{ ok: boolean; mailboxId?: number; messageId?: number; reason?: string; attachments?: number }> {
  let mailbox: any = null;
  for (const to of opts.toCandidates) {
    mailbox = await findMailboxByEmail(to);
    if (mailbox) break;
  }
  if (!mailbox) {
    return { ok: false, reason: 'no_mailbox' };
  }

  const fromEmails = extractEmailsFromHeader(opts.fromRaw);
  const fromEmail = fromEmails[0] || String(opts.fromRaw || '').trim();
  let fromName: string | null = null;
  const nameMatch = String(opts.fromRaw || '').match(/^"?([^"<]+)"?\s*</);
  if (nameMatch) fromName = nameMatch[1].trim();

  const ins = await pool.query(
    `INSERT INTO email_mailbox_messages (
       tenant_id, mailbox_id, direction, folder,
       from_email, from_name, to_email, subject, body_html, body_text,
       message_id, is_read, status, received_at, attachments
     ) VALUES (
       $1,$2,'inbound','inbox',
       $3,$4,$5,$6,$7,$8,
       $9,FALSE,'received',NOW(),'[]'::jsonb
     ) RETURNING id`,
    [
      mailbox.tenant_id,
      mailbox.id,
      fromEmail || null,
      fromName,
      mailbox.email,
      opts.subject || '(sem assunto)',
      opts.html || null,
      opts.text || null,
      opts.messageId || null,
    ]
  );

  const messageId = Number(ins.rows[0].id);
  let html = opts.html || '';
  let attachments: any[] = [];
  try {
    const saved = await persistInboundAttachments({
      tenantId: mailbox.tenant_id,
      mailboxId: mailbox.id,
      messageId,
      html,
      files: opts.files,
      attachmentInfoRaw: opts.attachmentInfoRaw,
      contentIdsRaw: opts.contentIdsRaw,
    });
    html = saved.html;
    attachments = saved.attachments;
    const threadKey = buildThreadKey(opts.subject || '', [mailbox.email, fromEmail || '']);
    await pool.query(
      `UPDATE email_mailbox_messages
       SET body_html=$1, attachments=$2::jsonb, has_attachments=$3,
           thread_key=$4, updated_at=NOW()
       WHERE id=$5`,
      [html || null, JSON.stringify(attachments), attachments.length > 0, threadKey, messageId]
    );
  } catch (e: any) {
    console.warn('[inbound-mailbox] anexos:', e?.message || e);
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { io } = require('../server');
    if (io) {
      io.emit('mailbox:new-message', {
        tenantId: mailbox.tenant_id,
        mailboxId: mailbox.id,
        messageId,
        subject: opts.subject,
        fromEmail,
      });
    }
  } catch { /* socket opcional */ }

  try {
    await markMailboxThreadReplied({
      tenantId: mailbox.tenant_id,
      mailboxId: mailbox.id,
      fromEmail: fromEmail || '',
      subject: opts.subject,
      inReplyTo: opts.messageId || null,
    });
  } catch (e: any) {
    console.warn('[inbound-mailbox] mark replied:', e?.message || e);
  }

  return {
    ok: true,
    mailboxId: mailbox.id,
    messageId,
    attachments: attachments.length,
  };
}

export async function sendFromMailbox(opts: {
  tenantId: number;
  mailboxId: number;
  toEmail: string;
  toName?: string | null;
  subject: string;
  bodyHtml?: string | null;
  bodyText?: string | null;
  replyToMessageId?: number | null;
  cc?: string[] | string | null;
  bcc?: string[] | string | null;
  attachments?: Array<{ filename: string; contentType?: string; content: Buffer; }> | null;
  draftId?: number | null;
  scheduledAt?: Date | string | null;
  saveAsDraft?: boolean;
  requestReadReceipt?: boolean;
  appendSignature?: boolean;
}) {
  const mb = await pool.query(
    `SELECT m.*, d.domain, d.status AS domain_status
     FROM email_mailboxes m
     JOIN email_marketing_domains d ON d.id = m.domain_id
     WHERE m.id=$1 AND m.tenant_id=$2 AND m.is_active=TRUE`,
    [opts.mailboxId, opts.tenantId]
  );
  if (!mb.rows[0]) throw new Error('Caixa não encontrada');
  const mailbox = mb.rows[0];
  if (mailbox.domain_status !== 'active' && mailbox.domain_status !== 'active_partial') {
    throw new Error('Domínio ainda não está ativo para envio');
  }

  let inReplyTo: string | null = null;
  let references: string | null = null;
  if (opts.replyToMessageId) {
    const prev = await pool.query(
      `SELECT message_id, subject, from_email FROM email_mailbox_messages
       WHERE id=$1 AND mailbox_id=$2 AND tenant_id=$3`,
      [opts.replyToMessageId, opts.mailboxId, opts.tenantId]
    );
    if (prev.rows[0]?.message_id) {
      inReplyTo = prev.rows[0].message_id;
      references = prev.rows[0].message_id;
    }
  }

  const toList = String(opts.toEmail || '')
    .split(/[,;\n]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.includes('@'));
  if (!toList.length && !opts.saveAsDraft) throw new Error('Destinatário inválido — informe ao menos um e-mail');
  const toEmailStored = toList.join(', ') || String(opts.toEmail || '').trim().toLowerCase() || 'draft@local';
  const subject = String(opts.subject || '').trim() || '(sem assunto)';

  let html = opts.bodyHtml || '';
  let text = opts.bodyText || '';
  if (opts.appendSignature !== false && mailbox.signature_enabled && mailbox.signature_html) {
    html = `${html || ''}<br/><br/>--<br/>${mailbox.signature_html}`;
    text = `${text || ''}\n\n--\n${String(mailbox.signature_html).replace(/<[^>]+>/g, '')}`;
  }

  const ccList = Array.isArray(opts.cc)
    ? opts.cc.map((s) => String(s).trim().toLowerCase()).filter((s) => s.includes('@'))
    : String(opts.cc || '').split(/[,;]+/).map((s) => s.trim().toLowerCase()).filter((s) => s.includes('@'));
  const bccList = Array.isArray(opts.bcc)
    ? opts.bcc.map((s) => String(s).trim().toLowerCase()).filter((s) => s.includes('@'))
    : String(opts.bcc || '').split(/[,;]+/).map((s) => s.trim().toLowerCase()).filter((s) => s.includes('@'));

  const threadKey = buildThreadKey(subject, [mailbox.email, ...toList, ...ccList]);
  const hasAtt = Array.isArray(opts.attachments) && opts.attachments.length > 0;
  const scheduledAt = opts.scheduledAt ? new Date(opts.scheduledAt) : null;
  const isDraft = !!opts.saveAsDraft;
  const isScheduled = !!(scheduledAt && scheduledAt.getTime() > Date.now() && !isDraft);

  const folder = isDraft ? 'drafts' : (isScheduled ? 'drafts' : 'sent');
  const status = isDraft ? 'draft' : (isScheduled ? 'scheduled' : 'pending');

  let rowId = opts.draftId ? Number(opts.draftId) : 0;
  const attMeta = (opts.attachments || []).map((a) => ({
    filename: a.filename,
    contentType: a.contentType || 'application/octet-stream',
    size: a.content?.length || 0,
  }));

  if (rowId) {
    const upd = await pool.query(
      `UPDATE email_mailbox_messages SET
         to_email=$1, to_name=$2, subject=$3, body_html=$4, body_text=$5,
         cc=$6, bcc=$7, folder=$8, status=$9, scheduled_at=$10,
         has_attachments=$11, request_read_receipt=$12, thread_key=$13,
         in_reply_to=COALESCE($14, in_reply_to),
         attachments=$15::jsonb, updated_at=NOW()
       WHERE id=$16 AND mailbox_id=$17 AND tenant_id=$18
       RETURNING id`,
      [
        toEmailStored, opts.toName || null, subject, html || null, text || null,
        ccList.join(', ') || null, bccList.join(', ') || null,
        folder, status, isScheduled ? scheduledAt : null,
        hasAtt, !!opts.requestReadReceipt, threadKey,
        inReplyTo,
        JSON.stringify(attMeta),
        rowId, opts.mailboxId, opts.tenantId,
      ]
    );
    if (!upd.rows[0]) throw new Error('Rascunho não encontrado');
  } else {
    const draft = await pool.query(
      `INSERT INTO email_mailbox_messages (
         tenant_id, mailbox_id, direction, folder,
         from_email, from_name, to_email, to_name, subject, body_html, body_text,
         cc, bcc, in_reply_to, is_read, status, scheduled_at,
         has_attachments, request_read_receipt, thread_key, attachments
       ) VALUES (
         $1,$2,'outbound',$3,
         $4,$5,$6,$7,$8,$9,$10,
         $11,$12,$13,TRUE,$14,$15,
         $16,$17,$18,$19::jsonb
       ) RETURNING id`,
      [
        opts.tenantId, opts.mailboxId, folder,
        mailbox.email, mailbox.display_name || mailbox.local_part,
        toEmailStored, opts.toName || null, subject, html || null, text || null,
        ccList.join(', ') || null, bccList.join(', ') || null, inReplyTo,
        status, isScheduled ? scheduledAt : null,
        hasAtt, !!opts.requestReadReceipt, threadKey,
        JSON.stringify(attMeta),
      ]
    );
    rowId = Number(draft.rows[0].id);
  }

  // Persistir anexos em disco se houver
  if (hasAtt && opts.attachments) {
    const uploadDir = path.join(__dirname, '../../uploads/email-inbox', String(opts.tenantId), String(opts.mailboxId));
    fs.mkdirSync(uploadDir, { recursive: true });
    const savedAtts: any[] = [];
    for (const a of opts.attachments) {
      const filename = safeFileName(a.filename);
      const stored = `${rowId}-out-${Date.now()}-${filename}`;
      fs.writeFileSync(path.join(uploadDir, stored), a.content);
      savedAtts.push({
        filename,
        contentType: a.contentType || 'application/octet-stream',
        size: a.content.length,
        url: `/uploads/email-inbox/${opts.tenantId}/${opts.mailboxId}/${stored}`,
      });
    }
    await pool.query(
      `UPDATE email_mailbox_messages SET attachments=$1::jsonb WHERE id=$2`,
      [JSON.stringify(savedAtts), rowId]
    );
  }

  if (isDraft || isScheduled) {
    return {
      id: rowId,
      status,
      scheduled_at: isScheduled ? scheduledAt : null,
      message: isDraft ? 'Rascunho salvo' : 'Envio agendado',
    };
  }

  try {
    const sent = await sendMarketingEmail({
      domain: mailbox.domain,
      fromEmail: mailbox.email,
      fromName: mailbox.display_name || mailbox.local_part || mailbox.email,
      toEmail: toList,
      toName: toList.length === 1 ? opts.toName : null,
      replyTo: mailbox.email,
      subject,
      html,
      text,
      tenantId: opts.tenantId,
      skipUnsubscribeFooter: true,
      cc: ccList,
      bcc: bccList,
      attachments: opts.attachments || undefined,
      inReplyTo,
      references,
      requestReadReceipt: !!opts.requestReadReceipt,
      customArgs: {
        source: 'mailbox',
        mailbox_message_id: String(rowId),
        mailbox_id: String(opts.mailboxId),
        tenant_id: String(opts.tenantId),
      },
    });

    await pool.query(
      `UPDATE email_mailbox_messages SET
         folder='sent', provider_message_id=$1, status='sent',
         tracking_status='sent', sent_at=NOW(),
         scheduled_at=NULL, updated_at=NOW()
       WHERE id=$2`,
      [sent.messageId, rowId]
    );
    return { id: rowId, messageId: sent.messageId, provider: sent.provider, status: 'sent' };
  } catch (e: any) {
    await pool.query(
      `UPDATE email_mailbox_messages SET
         status='failed', error_message=$1, updated_at=NOW()
       WHERE id=$2`,
      [String(e.message || 'Erro ao enviar').slice(0, 500), rowId]
    );
    throw e;
  }
}

/** Processa e-mails agendados cujo horário já passou */
export async function processScheduledMailboxSends() {
  const due = await pool.query(
    `SELECT id, tenant_id, mailbox_id, to_email, to_name, subject, body_html, body_text,
            cc, bcc, attachments, request_read_receipt, in_reply_to
     FROM email_mailbox_messages
     WHERE status='scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= NOW()
     ORDER BY scheduled_at ASC
     LIMIT 20`
  );
  for (const row of due.rows) {
    try {
      const mb = await pool.query(
        `SELECT m.*, d.domain, d.status AS domain_status
         FROM email_mailboxes m
         JOIN email_marketing_domains d ON d.id = m.domain_id
         WHERE m.id=$1 AND m.tenant_id=$2`,
        [row.mailbox_id, row.tenant_id]
      );
      if (!mb.rows[0]) continue;
      const mailbox = mb.rows[0];
      const atts: any[] = [];
      const meta = Array.isArray(row.attachments) ? row.attachments : [];
      for (const a of meta) {
        if (!a?.url) continue;
        const rel = String(a.url).replace(/^\/uploads\//, '');
        const full = path.join(__dirname, '../../uploads', rel);
        if (fs.existsSync(full)) {
          atts.push({
            filename: a.filename || path.basename(full),
            contentType: a.contentType,
            content: fs.readFileSync(full),
          });
        }
      }
      const sent = await sendMarketingEmail({
        domain: mailbox.domain,
        fromEmail: mailbox.email,
        fromName: mailbox.display_name || mailbox.local_part || mailbox.email,
        toEmail: row.to_email,
        toName: row.to_name,
        replyTo: mailbox.email,
        subject: row.subject,
        html: row.body_html,
        text: row.body_text,
        tenantId: row.tenant_id,
        skipUnsubscribeFooter: true,
        cc: row.cc,
        bcc: row.bcc,
        attachments: atts.length ? atts : undefined,
        inReplyTo: row.in_reply_to,
        requestReadReceipt: !!row.request_read_receipt,
        customArgs: {
          source: 'mailbox',
          mailbox_message_id: String(row.id),
          mailbox_id: String(row.mailbox_id),
          tenant_id: String(row.tenant_id),
        },
      });
      await pool.query(
        `UPDATE email_mailbox_messages SET
           folder='sent', status='sent', tracking_status='sent',
           provider_message_id=$1, sent_at=NOW(),
           scheduled_at=NULL, updated_at=NOW()
         WHERE id=$2`,
        [sent.messageId, row.id]
      );
    } catch (e: any) {
      await pool.query(
        `UPDATE email_mailbox_messages SET status='failed', error_message=$1, updated_at=NOW() WHERE id=$2`,
        [String(e.message || 'Erro').slice(0, 500), row.id]
      );
    }
  }
  return due.rows.length;
}

let scheduledTimer: NodeJS.Timeout | null = null;
export function startMailboxScheduler() {
  if (scheduledTimer) return;
  scheduledTimer = setInterval(() => {
    processScheduledMailboxSends().catch((e) => console.warn('[mailbox-scheduler]', e.message));
  }, 30000);
  console.log('✅ Scheduler da caixa de e-mail iniciado (30s)');
}
