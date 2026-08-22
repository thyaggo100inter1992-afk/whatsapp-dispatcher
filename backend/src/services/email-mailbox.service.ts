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
    if (attachments.length > 0 || html !== (opts.html || '')) {
      await pool.query(
        `UPDATE email_mailbox_messages
         SET body_html=$1, attachments=$2::jsonb, updated_at=NOW()
         WHERE id=$3`,
        [html || null, JSON.stringify(attachments), messageId]
      );
    }
  } catch (e: any) {
    console.warn('[inbound-mailbox] anexos:', e?.message || e);
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
  if (opts.replyToMessageId) {
    const prev = await pool.query(
      `SELECT message_id, subject FROM email_mailbox_messages
       WHERE id=$1 AND mailbox_id=$2 AND tenant_id=$3`,
      [opts.replyToMessageId, opts.mailboxId, opts.tenantId]
    );
    if (prev.rows[0]?.message_id) inReplyTo = prev.rows[0].message_id;
  }

  const toEmail = String(opts.toEmail || '').trim().toLowerCase();
  if (!toEmail.includes('@')) throw new Error('Destinatário inválido');
  const subject = String(opts.subject || '').trim() || '(sem assunto)';

  const draft = await pool.query(
    `INSERT INTO email_mailbox_messages (
       tenant_id, mailbox_id, direction, folder,
       from_email, from_name, to_email, to_name, subject, body_html, body_text,
       in_reply_to, is_read, status
     ) VALUES (
       $1,$2,'outbound','sent',
       $3,$4,$5,$6,$7,$8,$9,
       $10,TRUE,'pending'
     ) RETURNING id`,
    [
      opts.tenantId,
      opts.mailboxId,
      mailbox.email,
      mailbox.display_name || mailbox.local_part,
      toEmail,
      opts.toName || null,
      subject,
      opts.bodyHtml || null,
      opts.bodyText || null,
      inReplyTo,
    ]
  );
  const rowId = Number(draft.rows[0].id);

  try {
    const sent = await sendMarketingEmail({
      domain: mailbox.domain,
      fromEmail: mailbox.email,
      fromName: mailbox.display_name || mailbox.local_part || mailbox.email,
      toEmail,
      toName: opts.toName,
      replyTo: mailbox.email,
      subject,
      html: opts.bodyHtml,
      text: opts.bodyText,
      tenantId: opts.tenantId,
      skipUnsubscribeFooter: true, // caixa pessoal — sem rodapé de marketing
    });

    await pool.query(
      `UPDATE email_mailbox_messages SET
         provider_message_id=$1, status='sent', sent_at=NOW(), updated_at=NOW()
       WHERE id=$2`,
      [sent.messageId, rowId]
    );
    return { id: rowId, messageId: sent.messageId, provider: sent.provider };
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
