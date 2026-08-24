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

const SENDGRID_MX = 'mx.sendgrid.net';
const NETT_MX = 'smtp1.nettsistemasenvios.com.br';

export function isNettMailProvider(provider?: string | null) {
  return String(provider || '').toLowerCase().includes('nettsistemasenvios');
}

export function inboundMxHostForProvider(provider?: string | null) {
  return isNettMailProvider(provider) ? NETT_MX : SENDGRID_MX;
}

export function isSendGridMxValue(value?: string | null) {
  return /sendgrid\.net/i.test(String(value || ''));
}

function mxMatchesExpected(exchange: string, expected: string) {
  const ex = String(exchange || '').toLowerCase().replace(/\.$/, '');
  const want = String(expected || '').toLowerCase().replace(/\.$/, '');
  if (!ex || !want) return false;
  if (ex === want || ex.endsWith(`.${want}`)) return true;
  if (want.includes('sendgrid.net')) return ex === SENDGRID_MX || ex.endsWith('.sendgrid.net');
  if (want.includes('nettsistemasenvios')) return ex.includes('nettsistemasenvios');
  return false;
}

export function buildInboundDnsRecords(domain: string, provider?: string | null) {
  return [
    {
      record_type: 'MX',
      name: domain,
      value: inboundMxHostForProvider(provider),
      priority: 10,
      valid: 'unknown',
      _inbound: true,
    },
  ];
}

/**
 * Caixa de e-mail exige MX exclusivo do provedor do domínio.
 * SendGrid: mx.sendgrid.net
 * SMTP próprio: smtp1.nettsistemasenvios.com.br
 */
export async function checkInboundMxOnly(
  domain: string,
  expectedMx?: string | null
): Promise<{
  ok: boolean;
  hasExpected: boolean;
  hasSendgrid: boolean;
  conflicts: string[];
  hint?: string;
}> {
  const expected = String(expectedMx || SENDGRID_MX).toLowerCase().replace(/\.$/, '');
  try {
    const results = await resolveMx(String(domain || '').trim().toLowerCase());
    const exchanges = results.map((r) =>
      String(r.exchange || '').toLowerCase().replace(/\.$/, '')
    );
    const hasExpected = exchanges.some((ex) => mxMatchesExpected(ex, expected));
    const conflicts = exchanges.filter((ex) => !mxMatchesExpected(ex, expected));
    const hasSendgrid = exchanges.some((ex) => mxMatchesExpected(ex, SENDGRID_MX));

    if (!hasExpected) {
      return {
        ok: false,
        hasExpected: false,
        hasSendgrid,
        conflicts,
        hint: `Adicione o MX ${expected} no DNS do domínio.`,
      };
    }
    if (conflicts.length > 0) {
      return {
        ok: false,
        hasExpected: true,
        hasSendgrid,
        conflicts,
        hint: `Remova os outros MX do DNS (deixe só ${expected}). Conflito atual: ${conflicts.join(', ')}. Com MX misturados o e-mail pode cair no servidor errado e voltar com "Relaying denied".`,
      };
    }
    return { ok: true, hasExpected: true, hasSendgrid, conflicts: [] };
  } catch {
    return {
      ok: false,
      hasExpected: false,
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

export function normalizeSubject(subject: string) {
  let s = String(subject || '').trim();
  let prev = '';
  while (s !== prev) {
    prev = s;
    s = s.replace(/^(re|fw|fwd|enc|res|resp)\s*:\s*/i, '').trim();
  }
  return s.replace(/\s+/g, ' ').toLowerCase();
}

export function buildThreadKey(subject: string, participants: string[]) {
  const normSubj = normalizeSubject(subject);
  const parts = [...new Set(
    participants.map((p) => String(p || '').trim().toLowerCase()).filter((p) => p.includes('@'))
  )].sort();
  return `${normSubj}::${parts.join('|')}`.slice(0, 240);
}

async function resolveConversationThreadKey(opts: {
  tenantId: number;
  mailboxId: number;
  mailboxEmail: string;
  subject: string;
  otherEmail: string;
  inReplyTo?: string | null;
}) {
  const other = String(opts.otherEmail || '').trim().toLowerCase();
  const computed = buildThreadKey(opts.subject, [opts.mailboxEmail, other]);
  const inReply = String(opts.inReplyTo || '').replace(/^<|>$/g, '').trim();

  if (inReply) {
    const byRef = await pool.query(
      `SELECT thread_key FROM email_mailbox_messages
       WHERE mailbox_id=$1 AND tenant_id=$2
         AND (message_id=$3 OR message_id LIKE $4 OR in_reply_to=$3)
         AND thread_key IS NOT NULL AND TRIM(thread_key) <> ''
       ORDER BY id DESC LIMIT 1`,
      [opts.mailboxId, opts.tenantId, inReply, `${inReply}%`]
    );
    if (byRef.rows[0]?.thread_key) return String(byRef.rows[0].thread_key);
  }

  const recent = await pool.query(
    `SELECT id, thread_key, subject, from_email, to_email
     FROM email_mailbox_messages
     WHERE mailbox_id=$1 AND tenant_id=$2
       AND (
         LOWER(from_email)=$3 OR LOWER(to_email)=$3
         OR LOWER(from_email)=$4 OR LOWER(to_email)=$4
         OR thread_key=$5
       )
     ORDER BY id DESC
     LIMIT 60`,
    [opts.mailboxId, opts.tenantId, other, String(opts.mailboxEmail || '').toLowerCase(), computed]
  );
  const want = normalizeSubject(opts.subject);
  const hit = recent.rows.find((r: any) => {
    if (r.thread_key && String(r.thread_key) === computed) return true;
    return normalizeSubject(r.subject) === want;
  });
  if (hit?.thread_key) return String(hit.thread_key);
  return computed;
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

let recipientsTableReady = false;
async function ensureMailboxRecipientsTable() {
  if (recipientsTableReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS email_mailbox_message_recipients (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL,
      mailbox_id INTEGER NOT NULL,
      message_id INTEGER NOT NULL REFERENCES email_mailbox_messages(id) ON DELETE CASCADE,
      email VARCHAR(255) NOT NULL,
      name VARCHAR(255),
      role VARCHAR(10) DEFAULT 'to',
      tracking_status VARCHAR(30) DEFAULT 'pending',
      delivered_at TIMESTAMPTZ,
      opened_at TIMESTAMPTZ,
      clicked_at TIMESTAMPTZ,
      replied_at TIMESTAMPTZ,
      bounced_at TIMESTAMPTZ,
      error_message TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE (message_id, email)
    )
  `);
  recipientsTableReady = true;
}

let signatureColsReady = false;
/** Garante colunas de assinatura na tabela email_mailboxes */
export async function ensureMailboxSignatureColumns() {
  if (signatureColsReady) return;
  await pool.query(`
    ALTER TABLE email_mailboxes
      ADD COLUMN IF NOT EXISTS signature_html TEXT,
      ADD COLUMN IF NOT EXISTS signature_enabled BOOLEAN DEFAULT TRUE
  `);
  signatureColsReady = true;
}

/** HTML de assinatura “vazio” (editor rico às vezes deixa &lt;p&gt;&lt;br&gt;&lt;/p&gt;) */
export function normalizeSignatureHtml(html: string | null | undefined): string {
  const raw = String(html || '').trim();
  if (!raw) return '';
  const plain = raw
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return plain ? raw : '';
}

function parseEmailParts(raw: string | string[] | null | undefined): string[] {
  const text = Array.isArray(raw) ? raw.join(',') : String(raw || '');
  return text.split(/[,;\n]+/).map((s) => s.trim().toLowerCase()).filter((s) => s.includes('@'));
}

export async function upsertMailboxRecipients(opts: {
  tenantId: number;
  mailboxId: number;
  messageId: number;
  toEmail: string | string[];
  toName?: string | null;
  cc?: string | string[] | null;
  bcc?: string | string[] | null;
  trackingStatus?: string;
}) {
  await ensureMailboxRecipientsTable();
  const toList = parseEmailParts(opts.toEmail);
  const ccList = parseEmailParts(opts.cc);
  const bccList = parseEmailParts(opts.bcc);
  const rows: Array<{ email: string; name: string | null; role: string }> = [];
  const seen = new Set<string>();
  const push = (email: string, role: string, name?: string | null) => {
    if (!email || seen.has(email)) return;
    seen.add(email);
    rows.push({ email, role, name: name || null });
  };
  toList.forEach((e, i) => push(e, 'to', i === 0 ? opts.toName : null));
  ccList.forEach((e) => push(e, 'cc'));
  bccList.forEach((e) => push(e, 'bcc'));
  const status = opts.trackingStatus || 'pending';
  for (const r of rows) {
    await pool.query(
      `INSERT INTO email_mailbox_message_recipients
         (tenant_id, mailbox_id, message_id, email, name, role, tracking_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (message_id, email) DO UPDATE SET
         name = COALESCE(EXCLUDED.name, email_mailbox_message_recipients.name),
         role = EXCLUDED.role,
         tracking_status = CASE
           WHEN email_mailbox_message_recipients.tracking_status IN ('pending','draft') THEN EXCLUDED.tracking_status
           ELSE email_mailbox_message_recipients.tracking_status
         END,
         updated_at = NOW()`,
      [opts.tenantId, opts.mailboxId, opts.messageId, r.email, r.name, r.role, status]
    );
  }
  return rows.length;
}

export async function listMailboxMessageRecipients(messageId: number) {
  try {
    await ensureMailboxRecipientsTable();
    const r = await pool.query(
      `SELECT id, email, name, role, tracking_status,
              delivered_at, opened_at, clicked_at, replied_at, bounced_at, error_message
       FROM email_mailbox_message_recipients
       WHERE message_id=$1
       ORDER BY CASE role WHEN 'to' THEN 0 WHEN 'cc' THEN 1 ELSE 2 END, id ASC`,
      [messageId]
    );
    return r.rows;
  } catch {
    return [];
  }
}

async function applyRecipientTracking(opts: {
  messageId: number;
  recipientEmail?: string | null;
  mapped: string;
  setDelivered: boolean;
  setOpened: boolean;
  setClicked: boolean;
  setBounced: boolean;
  eventAt: Date;
  errMsg?: string | null;
}) {
  await ensureMailboxRecipientsTable();
  const email = String(opts.recipientEmail || '').trim().toLowerCase();
  if (!email.includes('@')) return;

  const existing = await pool.query(
    `SELECT tracking_status FROM email_mailbox_message_recipients
     WHERE message_id=$1 AND LOWER(email)=$2 LIMIT 1`,
    [opts.messageId, email]
  );
  const prev = String(existing.rows[0]?.tracking_status || 'sent').toLowerCase();
  let next = opts.mapped;
  if (prev === 'replied' && !['failed', 'bounced', 'complained'].includes(opts.mapped)) {
    next = 'replied';
  } else if (opts.mapped === 'opened' && prev === 'clicked') {
    next = 'clicked';
  } else if (
    mailboxTrackingRank(opts.mapped) < mailboxTrackingRank(prev) &&
    !['failed', 'bounced', 'complained'].includes(opts.mapped)
  ) {
    next = prev;
  }

  await pool.query(
    `INSERT INTO email_mailbox_message_recipients
       (tenant_id, mailbox_id, message_id, email, role, tracking_status,
        delivered_at, opened_at, clicked_at, bounced_at, error_message)
     SELECT tenant_id, mailbox_id, id, $2, 'to', $3,
            CASE WHEN $4 THEN $7::timestamptz ELSE NULL END,
            CASE WHEN $5 THEN $7::timestamptz ELSE NULL END,
            CASE WHEN $6 THEN $7::timestamptz ELSE NULL END,
            CASE WHEN $8 THEN $7::timestamptz ELSE NULL END,
            $9
     FROM email_mailbox_messages WHERE id=$1
     ON CONFLICT (message_id, email) DO UPDATE SET
       tracking_status = $3,
       delivered_at = CASE WHEN $4 THEN COALESCE(email_mailbox_message_recipients.delivered_at, $7::timestamptz) ELSE email_mailbox_message_recipients.delivered_at END,
       opened_at    = CASE WHEN $5 THEN COALESCE(email_mailbox_message_recipients.opened_at, $7::timestamptz) ELSE email_mailbox_message_recipients.opened_at END,
       clicked_at   = CASE WHEN $6 THEN COALESCE(email_mailbox_message_recipients.clicked_at, $7::timestamptz) ELSE email_mailbox_message_recipients.clicked_at END,
       bounced_at   = CASE WHEN $8 THEN COALESCE(email_mailbox_message_recipients.bounced_at, $7::timestamptz) ELSE email_mailbox_message_recipients.bounced_at END,
       error_message = COALESCE($9, email_mailbox_message_recipients.error_message),
       updated_at = NOW()`,
    [
      opts.messageId,
      email,
      next,
      opts.setDelivered,
      opts.setOpened,
      opts.setClicked,
      opts.eventAt.toISOString(),
      opts.setBounced,
      opts.errMsg || null,
    ]
  );
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
    await applyRecipientTracking({
      messageId: Number(row.id),
      recipientEmail: recipient,
      mapped,
      setDelivered,
      setOpened,
      setClicked,
      setBounced,
      eventAt,
      errMsg,
    });
  } catch (e) {
    console.warn('[mailbox-tracking] recipient:', (e as any)?.message || e);
  }

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

  // Campos de formulário do inbound (não são arquivo)
  const skipFields = new Set([
    'to', 'from', 'subject', 'text', 'html', 'headers', 'envelope',
    'charsets', 'spf', 'dkim', 'sender_ip', 'spam_score', 'spam_report',
    'attachment-info', 'attachment_info', 'content-ids', 'content_ids',
    'message-id', 'message_id', 'email', 'raw', 'mime',
  ]);

  let attIndex = 0;
  for (const file of files) {
    const field = String(file.fieldname || '');
    const fieldLower = field.toLowerCase();
    if (skipFields.has(fieldLower)) continue;
    if (!file.buffer || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0) continue;

    // SendGrid: attachment1, attachment2...
    // NettMail / outros: file, files, attachment, upload, ou qualquer binário
    const isSgAttachment = /^attachment\d+$/i.test(field);
    const isGenericFile =
      /^(file|files|attachment|attachments|upload|uploads|part)\d*$/i.test(field) ||
      (!!file.mimetype && !/^text\//i.test(file.mimetype) && fieldLower !== 'html' && fieldLower !== 'text');
    if (!isSgAttachment && !isGenericFile) {
      // ainda aceita se tiver originalname de arquivo real
      if (!file.originalname || file.originalname === field) continue;
    }

    attIndex += 1;
    const meta = attachmentInfo[field] || attachmentInfo[`attachment${attIndex}`] || {};
    const filename = safeFileName(
      meta.filename || meta.name || file.originalname || `${field || 'file'}-${attIndex}.bin`
    );
    const stored = `${opts.messageId}-${Date.now()}-${filename}`;
    fs.writeFileSync(path.join(uploadDir, stored), file.buffer);
    const url = `/uploads/email-inbox/${opts.tenantId}/${opts.mailboxId}/${stored}`;
    fieldToUrl[field] = url;
    fieldToUrl[`attachment${attIndex}`] = url;

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
  inReplyTo?: string | null;
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

  const threadKey = await resolveConversationThreadKey({
    tenantId: mailbox.tenant_id,
    mailboxId: mailbox.id,
    mailboxEmail: mailbox.email,
    subject: opts.subject || '',
    otherEmail: fromEmail || '',
    inReplyTo: opts.inReplyTo || null,
  });

  let ins;
  try {
    ins = await pool.query(
      `INSERT INTO email_mailbox_messages (
         tenant_id, mailbox_id, direction, folder,
         from_email, from_name, to_email, subject, body_html, body_text,
         message_id, in_reply_to, is_read, status, received_at, attachments, thread_key
       ) VALUES (
         $1,$2,'inbound','inbox',
         $3,$4,$5,$6,$7,$8,
         $9,$10,FALSE,'received',NOW(),'[]'::jsonb,$11
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
        opts.inReplyTo || null,
        threadKey,
      ]
    );
  } catch (e: any) {
    if (!/in_reply_to|thread_key|column .* does not exist/i.test(String(e.message || ''))) throw e;
    ins = await pool.query(
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
        mailbox.tenant_id, mailbox.id, fromEmail || null, fromName, mailbox.email,
        opts.subject || '(sem assunto)', opts.html || null, opts.text || null, opts.messageId || null,
      ]
    );
  }

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
  appendSignature?: boolean | null;
}) {
  await ensureMailboxSignatureColumns();

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
  const sigHtml = normalizeSignatureHtml(mailbox.signature_html);
  const wantSignature = opts.appendSignature !== false;
  const settingsAllowSig = mailbox.signature_enabled !== false;
  // Checkbox do compose = true: anexa se houver conteúdo (mesmo com "Usar assinatura" desligado nas configs)
  // Default: anexa só se configs permitem + há conteúdo
  if (wantSignature && sigHtml && (settingsAllowSig || opts.appendSignature === true)) {
    html = `${html || ''}<div style="margin-top:16px;padding-top:12px;border-top:1px solid #e5e7eb">${sigHtml}</div>`;
    const sigText = String(sigHtml)
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    text = `${text || ''}\n\n--\n${sigText}`;
  } else if (opts.appendSignature === true && !opts.saveAsDraft && !sigHtml) {
    throw new Error(
      'Assinatura marcada, mas esta caixa não tem assinatura salva. Abra a engrenagem da caixa, crie a assinatura e clique em Salvar.'
    );
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
    try {
      await upsertMailboxRecipients({
        tenantId: opts.tenantId,
        mailboxId: opts.mailboxId,
        messageId: rowId,
        toEmail: toList,
        toName: opts.toName,
        cc: ccList,
        bcc: bccList,
        trackingStatus: 'sent',
      });
    } catch (e) {
      console.warn('[mailbox-send] recipients:', (e as any)?.message || e);
    }
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
      try {
        await upsertMailboxRecipients({
          tenantId: row.tenant_id,
          mailboxId: row.mailbox_id,
          messageId: row.id,
          toEmail: row.to_email,
          toName: row.to_name,
          cc: row.cc,
          bcc: row.bcc,
          trackingStatus: 'sent',
        });
      } catch { /* tabela pode ainda não existir na 1ª vez */ }
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
