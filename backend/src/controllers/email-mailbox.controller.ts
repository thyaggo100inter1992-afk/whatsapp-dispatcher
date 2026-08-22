import { Request, Response } from 'express';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { pool } from '../database/connection';
import {
  buildInboundDnsRecords,
  checkInboundMxOnly,
  ensureSendGridInboundParse,
  sendFromMailbox,
  detectPhishingHints,
  buildThreadKey,
} from '../services/email-mailbox.service';

const execFileAsync = promisify(execFile);

function getTenantId(req: Request): number | null {
  return (req as any).tenant?.id || (req as any).user?.tenant_id || (req as any).tenantId || null;
}

function requireTenant(req: Request, res: Response): number | null {
  const tenantId = getTenantId(req);
  if (!tenantId) {
    res.status(401).json({ success: false, message: 'Tenant não identificado' });
    return null;
  }
  return tenantId;
}

function parseBool(v: any): boolean | null {
  if (v === undefined || v === null || v === '') return null;
  if (v === true || v === 'true' || v === '1' || v === 1) return true;
  if (v === false || v === 'false' || v === '0' || v === 0) return false;
  return null;
}

async function assertMailbox(tenantId: number, mailboxId: number | string) {
  const mb = await pool.query(
    `SELECT * FROM email_mailboxes WHERE id=$1 AND tenant_id=$2`,
    [mailboxId, tenantId]
  );
  return mb.rows[0] || null;
}

/** Ativa recebimento no domínio: Inbound Parse + DNS MX */
export const enableDomainInbound = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const { id } = req.params;

    const domainRow = await pool.query(
      `SELECT * FROM email_marketing_domains WHERE id=$1 AND tenant_id=$2`,
      [id, tenantId]
    );
    if (!domainRow.rows[0]) {
      return res.status(404).json({ success: false, message: 'Domínio não encontrado' });
    }
    const domain = String(domainRow.rows[0].domain);

    try {
      await ensureSendGridInboundParse(domain);
    } catch (e: any) {
      console.warn('[inbound] ensure parse:', e.message);
    }

    const inboundDns: any[] = buildInboundDnsRecords(domain);
    const mxCheck = await checkInboundMxOnly(domain);
    inboundDns[0].valid = mxCheck.ok ? 'valid' : 'unknown';
    inboundDns[0].mx_conflicts = mxCheck.conflicts;
    inboundDns[0].hint = mxCheck.hint;

    const inboundStatus = mxCheck.ok ? 'active' : 'pending';
    const result = await pool.query(
      `UPDATE email_marketing_domains SET
         inbound_enabled=TRUE,
         inbound_status=$1,
         inbound_dns_records=$2,
         updated_at=NOW()
       WHERE id=$3 AND tenant_id=$4
       RETURNING *`,
      [inboundStatus, JSON.stringify(inboundDns), id, tenantId]
    );

    res.json({
      success: true,
      data: result.rows[0],
      message: mxCheck.ok
        ? 'Recebimento ativo — você já pode criar caixas de e-mail.'
        : (mxCheck.hint || 'Adicione o registro MX no DNS do domínio. Depois clique em Verificar recebimento.'),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const verifyDomainInbound = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const { id } = req.params;

    const domainRow = await pool.query(
      `SELECT * FROM email_marketing_domains WHERE id=$1 AND tenant_id=$2`,
      [id, tenantId]
    );
    if (!domainRow.rows[0]) {
      return res.status(404).json({ success: false, message: 'Domínio não encontrado' });
    }
    const domain = String(domainRow.rows[0].domain);
    let inboundDns = Array.isArray(domainRow.rows[0].inbound_dns_records)
      ? [...domainRow.rows[0].inbound_dns_records]
      : buildInboundDnsRecords(domain);

    if (!domainRow.rows[0].inbound_enabled) {
      return res.status(400).json({
        success: false,
        message: 'Ative o recebimento neste domínio antes de verificar.',
      });
    }

    try {
      await ensureSendGridInboundParse(domain);
    } catch (e: any) {
      console.warn('[inbound] ensure parse verify:', e.message);
    }

    const mxCheck = await checkInboundMxOnly(domain);
    const ok = mxCheck.ok;

    inboundDns = inboundDns.map((r: any) =>
      r._inbound || String(r.record_type || '').toUpperCase() === 'MX'
        ? { ...r, valid: ok ? 'valid' : 'unknown', mx_conflicts: mxCheck.conflicts, hint: mxCheck.hint }
        : r
    );

    const inboundStatus = ok ? 'active' : 'pending';
    const result = await pool.query(
      `UPDATE email_marketing_domains SET
         inbound_status=$1,
         inbound_dns_records=$2,
         updated_at=NOW()
       WHERE id=$3 AND tenant_id=$4
       RETURNING *`,
      [inboundStatus, JSON.stringify(inboundDns), id, tenantId]
    );

    res.json({
      success: true,
      data: result.rows[0],
      verified: ok,
      message: ok
        ? 'Recebimento verificado — MX ok.'
        : (mxCheck.hint || 'MX ainda não aponta exclusivamente para mx.sendgrid.net.'),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const listMailboxes = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const result = await pool.query(
      `SELECT m.*, d.domain, d.status AS domain_status, d.inbound_status,
              (SELECT COUNT(*)::int FROM email_mailbox_messages msg
               WHERE msg.mailbox_id=m.id AND msg.folder='inbox' AND msg.is_read=FALSE) AS unread_count
       FROM email_mailboxes m
       JOIN email_marketing_domains d ON d.id = m.domain_id
       WHERE m.tenant_id=$1
       ORDER BY m.created_at DESC`,
      [tenantId]
    );
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    if (/email_mailboxes|does not exist/i.test(String(error.message || ''))) {
      return res.json({ success: true, data: [], migration_pending: true });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createMailbox = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const { local_part, display_name, domain_id, domain_ids } = req.body;

    const local = String(local_part || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._+-]/g, '');
    if (!local) {
      return res.status(400).json({ success: false, message: 'Informe a parte antes do @ (ex.: contato)' });
    }

    const ids: number[] = Array.isArray(domain_ids) && domain_ids.length
      ? domain_ids.map((x: any) => Number(x)).filter((n: number) => n > 0)
      : (domain_id ? [Number(domain_id)] : []);

    if (ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Selecione ao menos um domínio' });
    }

    const domains = await pool.query(
      `SELECT id, domain, status, inbound_status, inbound_enabled
       FROM email_marketing_domains
       WHERE tenant_id=$1 AND id = ANY($2::int[])`,
      [tenantId, ids]
    );
    if (domains.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Nenhum domínio válido' });
    }

    const created: any[] = [];
    const errors: string[] = [];

    for (const d of domains.rows) {
      if (d.status !== 'active' && d.status !== 'active_partial') {
        errors.push(`${d.domain}: domínio ainda não verificado para envio`);
        continue;
      }
      const email = `${local}@${d.domain}`.toLowerCase();
      try {
        const ins = await pool.query(
          `INSERT INTO email_mailboxes (tenant_id, domain_id, local_part, email, display_name)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (tenant_id, email) DO UPDATE SET
             display_name = COALESCE(EXCLUDED.display_name, email_mailboxes.display_name),
             is_active = TRUE,
             updated_at = NOW()
           RETURNING *`,
          [tenantId, d.id, local, email, display_name || null]
        );
        created.push({ ...ins.rows[0], domain: d.domain, inbound_status: d.inbound_status });
        if (!d.inbound_enabled || d.inbound_status !== 'active') {
          errors.push(`${email}: criado, mas o recebimento do domínio ainda não está ativo (configure MX em Domínios)`);
        }
      } catch (e: any) {
        errors.push(`${email}: ${e.message}`);
      }
    }

    if (created.length === 0) {
      return res.status(400).json({ success: false, message: errors.join('; ') || 'Não foi possível criar' });
    }

    res.json({
      success: true,
      data: created,
      warnings: errors.length ? errors : undefined,
      message: created.length === 1
        ? `Caixa ${created[0].email} criada`
        : `${created.length} caixas criadas`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateMailbox = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const { id } = req.params;
    const { signature_html, signature_enabled, display_name } = req.body;

    const sets: string[] = [];
    const vals: any[] = [];
    let i = 1;

    if (display_name !== undefined) {
      sets.push(`display_name=$${i++}`);
      vals.push(display_name === null || display_name === '' ? null : String(display_name));
    }
    if (signature_html !== undefined) {
      sets.push(`signature_html=$${i++}`);
      vals.push(signature_html === null ? null : String(signature_html));
    }
    if (signature_enabled !== undefined) {
      sets.push(`signature_enabled=$${i++}`);
      vals.push(!!signature_enabled);
    }

    if (sets.length === 0) {
      return res.status(400).json({ success: false, message: 'Nenhum campo para atualizar' });
    }

    sets.push('updated_at=NOW()');
    vals.push(id, tenantId);

    try {
      const result = await pool.query(
        `UPDATE email_mailboxes SET ${sets.join(', ')}
         WHERE id=$${i++} AND tenant_id=$${i}
         RETURNING *`,
        vals
      );
      if (!result.rows[0]) {
        return res.status(404).json({ success: false, message: 'Caixa não encontrada' });
      }
      res.json({ success: true, data: result.rows[0], message: 'Caixa atualizada' });
    } catch (e: any) {
      if (/signature_html|signature_enabled|column .* does not exist/i.test(String(e.message || ''))) {
        // Fallback sem colunas novas
        if (display_name === undefined) {
          return res.status(400).json({
            success: false,
            message: 'Colunas de assinatura ainda não migradas. Execute a migration da caixa de e-mail.',
          });
        }
        const result = await pool.query(
          `UPDATE email_mailboxes SET display_name=$1, updated_at=NOW()
           WHERE id=$2 AND tenant_id=$3 RETURNING *`,
          [display_name || null, id, tenantId]
        );
        if (!result.rows[0]) {
          return res.status(404).json({ success: false, message: 'Caixa não encontrada' });
        }
        return res.json({
          success: true,
          data: result.rows[0],
          message: 'Nome atualizado (assinatura pendente de migration)',
          migration_pending: true,
        });
      }
      throw e;
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteMailbox = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const { id } = req.params;
    const r = await pool.query(
      `DELETE FROM email_mailboxes WHERE id=$1 AND tenant_id=$2 RETURNING id`,
      [id, tenantId]
    );
    if (!r.rows[0]) return res.status(404).json({ success: false, message: 'Caixa não encontrada' });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMailboxStats = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const { id } = req.params;

    const mb = await assertMailbox(tenantId, id);
    if (!mb) return res.status(404).json({ success: false, message: 'Caixa não encontrada' });

    try {
      const result = await pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE folder='inbox')::int AS inbox,
           COUNT(*) FILTER (WHERE folder='sent')::int AS sent,
           COUNT(*) FILTER (WHERE folder='drafts')::int AS drafts,
           COUNT(*) FILTER (WHERE folder='trash')::int AS trash,
           COUNT(*) FILTER (WHERE folder='archive')::int AS archive,
           COUNT(*) FILTER (WHERE folder='spam')::int AS spam,
           COUNT(*) FILTER (WHERE COALESCE(is_starred, FALSE)=TRUE)::int AS starred,
           COUNT(*) FILTER (WHERE folder='inbox' AND is_read=FALSE)::int AS unread
         FROM email_mailbox_messages
         WHERE mailbox_id=$1 AND tenant_id=$2`,
        [id, tenantId]
      );
      res.json({ success: true, data: result.rows[0] });
    } catch (e: any) {
      if (/is_starred|archive|spam|column .* does not exist/i.test(String(e.message || ''))) {
        const result = await pool.query(
          `SELECT
             COUNT(*) FILTER (WHERE folder='inbox')::int AS inbox,
             COUNT(*) FILTER (WHERE folder='sent')::int AS sent,
             COUNT(*) FILTER (WHERE folder='drafts')::int AS drafts,
             COUNT(*) FILTER (WHERE folder='trash')::int AS trash,
             0::int AS archive,
             0::int AS spam,
             0::int AS starred,
             COUNT(*) FILTER (WHERE folder='inbox' AND is_read=FALSE)::int AS unread
           FROM email_mailbox_messages
           WHERE mailbox_id=$1 AND tenant_id=$2`,
          [id, tenantId]
        );
        return res.json({ success: true, data: result.rows[0], migration_pending: true });
      }
      throw e;
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

async function queryMailboxMessages(opts: {
  tenantId: number;
  mailboxId?: number | null;
  folder?: string | null;
  q?: string | null;
  unread?: boolean | null;
  starred?: boolean | null;
  hasAttachments?: boolean | null;
  customFolderId?: number | null;
  threadKey?: string | null;
  limit: number;
}) {
  const where: string[] = ['m.tenant_id=$1'];
  const params: any[] = [opts.tenantId];
  let i = 2;

  if (opts.mailboxId) {
    where.push(`m.mailbox_id=$${i++}`);
    params.push(opts.mailboxId);
  }

  if (opts.customFolderId) {
    where.push(`m.custom_folder_id=$${i++}`);
    params.push(opts.customFolderId);
  } else if (opts.folder && opts.folder !== 'all' && opts.folder !== 'starred') {
    where.push(`m.folder=$${i++}`);
    params.push(opts.folder);
  } else if (opts.folder === 'starred') {
    where.push(`COALESCE(m.is_starred, FALSE)=TRUE`);
  }

  if (opts.unread === true) {
    where.push(`m.is_read=FALSE`);
  } else if (opts.unread === false) {
    where.push(`m.is_read=TRUE`);
  }

  if (opts.starred === true) {
    where.push(`COALESCE(m.is_starred, FALSE)=TRUE`);
  } else if (opts.starred === false) {
    where.push(`COALESCE(m.is_starred, FALSE)=FALSE`);
  }

  if (opts.hasAttachments === true) {
    where.push(`COALESCE(m.has_attachments, FALSE)=TRUE`);
  } else if (opts.hasAttachments === false) {
    where.push(`COALESCE(m.has_attachments, FALSE)=FALSE`);
  }

  if (opts.threadKey) {
    where.push(`m.thread_key=$${i++}`);
    params.push(opts.threadKey);
  }

  if (opts.q) {
    where.push(
      `(m.subject ILIKE $${i} OR m.from_email ILIKE $${i} OR m.to_email ILIKE $${i} OR COALESCE(m.body_text,'') ILIKE $${i})`
    );
    params.push(`%${opts.q}%`);
    i++;
  }

  params.push(opts.limit);

  const sql = `
    SELECT m.id, m.mailbox_id, m.direction, m.folder, m.from_email, m.from_name,
           m.to_email, m.to_name, m.subject, m.is_read, m.status,
           m.received_at, m.sent_at, m.created_at, m.scheduled_at,
           m.cc, m.custom_folder_id, m.thread_key,
           m.tracking_status, m.delivered_at, m.opened_at, m.clicked_at, m.replied_at, m.bounced_at,
           COALESCE(m.is_starred, FALSE) AS is_starred,
           COALESCE(m.has_attachments, FALSE) AS has_attachments,
           LEFT(COALESCE(m.body_text, ''), 160) AS preview,
           mb.email AS mailbox_email
    FROM email_mailbox_messages m
    JOIN email_mailboxes mb ON mb.id = m.mailbox_id
    WHERE ${where.join(' AND ')}
    ORDER BY COALESCE(m.received_at, m.sent_at, m.created_at) DESC
    LIMIT $${i}`;

  return pool.query(sql, params);
}

export const listMailboxMessages = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const { id } = req.params;
    const folder = req.query.folder ? String(req.query.folder) : 'inbox';
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const q = req.query.q ? String(req.query.q).trim() : null;
    const unread = parseBool(req.query.unread);
    const starred = parseBool(req.query.starred);
    const hasAttachments = parseBool(req.query.has_attachments);
    const customFolderId = req.query.custom_folder_id ? Number(req.query.custom_folder_id) : null;
    const threadKey = req.query.thread_key ? String(req.query.thread_key) : null;

    const mb = await assertMailbox(tenantId, id);
    if (!mb) return res.status(404).json({ success: false, message: 'Caixa não encontrada' });

    try {
      const result = await queryMailboxMessages({
        tenantId,
        mailboxId: Number(id),
        folder,
        q,
        unread,
        starred,
        hasAttachments,
        customFolderId: customFolderId && customFolderId > 0 ? customFolderId : null,
        threadKey,
        limit,
      });

      const unreadQ = await pool.query(
        `SELECT COUNT(*)::int AS n FROM email_mailbox_messages
         WHERE mailbox_id=$1 AND tenant_id=$2 AND folder='inbox' AND is_read=FALSE`,
        [id, tenantId]
      );

      res.json({
        success: true,
        data: result.rows,
        unread_count: unreadQ.rows[0]?.n || 0,
        folder,
      });
    } catch (e: any) {
      if (/is_starred|has_attachments|custom_folder|thread_key|cc|column .* does not exist/i.test(String(e.message || ''))) {
        const result = await pool.query(
          `SELECT id, mailbox_id, direction, folder, from_email, from_name, to_email, to_name, subject,
                  is_read, status, received_at, sent_at, created_at,
                  FALSE AS is_starred, FALSE AS has_attachments, NULL AS cc, NULL AS scheduled_at, NULL AS custom_folder_id,
                  LEFT(COALESCE(body_text, ''), 160) AS preview
           FROM email_mailbox_messages
           WHERE mailbox_id=$1 AND tenant_id=$2 AND folder=$3
           ORDER BY COALESCE(received_at, sent_at, created_at) DESC
           LIMIT $4`,
          [id, tenantId, folder === 'starred' || folder === 'all' ? 'inbox' : folder, limit]
        );
        return res.json({
          success: true,
          data: result.rows,
          folder,
          migration_pending: true,
        });
      }
      throw e;
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/** Lista mensagens de todas as caixas do tenant */
export const listAllMailboxMessages = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const folder = req.query.folder ? String(req.query.folder) : 'inbox';
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const q = req.query.q ? String(req.query.q).trim() : null;
    const unread = parseBool(req.query.unread);
    const starred = parseBool(req.query.starred);
    const hasAttachments = parseBool(req.query.has_attachments);
    const customFolderId = req.query.custom_folder_id ? Number(req.query.custom_folder_id) : null;
    const threadKey = req.query.thread_key ? String(req.query.thread_key) : null;

    try {
      const result = await queryMailboxMessages({
        tenantId,
        mailboxId: null,
        folder,
        q,
        unread,
        starred,
        hasAttachments,
        customFolderId: customFolderId && customFolderId > 0 ? customFolderId : null,
        threadKey,
        limit,
      });
      res.json({ success: true, data: result.rows, folder });
    } catch (e: any) {
      if (/does not exist/i.test(String(e.message || ''))) {
        return res.json({ success: true, data: [], migration_pending: true });
      }
      throw e;
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMailboxMessage = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const { id, messageId } = req.params;
    const markRead = parseBool(req.query.mark_read);
    const shouldMarkRead = markRead !== false;

    const result = await pool.query(
      `SELECT * FROM email_mailbox_messages
       WHERE id=$1 AND mailbox_id=$2 AND tenant_id=$3`,
      [messageId, id, tenantId]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Mensagem não encontrada' });

    const msg = result.rows[0];

    if (shouldMarkRead && !msg.is_read && msg.folder === 'inbox') {
      await pool.query(
        `UPDATE email_mailbox_messages SET is_read=TRUE, updated_at=NOW() WHERE id=$1`,
        [messageId]
      );
      msg.is_read = true;
    }

    const phishing_hints = detectPhishingHints(msg.body_html || '', msg.body_text || '');

    res.json({
      success: true,
      data: {
        ...msg,
        is_starred: !!msg.is_starred,
        has_attachments: !!msg.has_attachments,
        phishing_hints,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const sendMailboxMessage = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const { id } = req.params;
    const {
      to_email,
      to_name,
      subject,
      body_html,
      body_text,
      reply_to_message_id,
      cc,
      bcc,
      save_as_draft,
      draft_id,
      scheduled_at,
      request_read_receipt,
      append_signature,
      attachments_base64,
    } = req.body;

    const saveAsDraft = parseBool(save_as_draft) === true;
    if (!saveAsDraft && (!to_email || !subject)) {
      return res.status(400).json({ success: false, message: 'Destinatário e assunto obrigatórios' });
    }
    if (saveAsDraft && !to_email && !subject && !body_html && !body_text) {
      return res.status(400).json({ success: false, message: 'Rascunho vazio' });
    }

    // Anexos via JSON base64 (evita conflito multer/express-fileupload)
    const attachments: Array<{ filename: string; contentType?: string; content: Buffer }> = [];
    const rawAtts = Array.isArray(attachments_base64) ? attachments_base64 : [];
    for (const a of rawAtts) {
      if (!a || !a.content) continue;
      try {
        const content = Buffer.from(String(a.content), 'base64');
        if (!content.length) continue;
        if (content.length > 15 * 1024 * 1024) {
          return res.status(400).json({
            success: false,
            message: `Anexo "${a.filename || 'arquivo'}" muito grande (máx. 15MB)`,
          });
        }
        attachments.push({
          filename: String(a.filename || 'anexo').slice(0, 180),
          contentType: String(a.contentType || 'application/octet-stream'),
          content,
        });
      } catch {
        /* ignora anexo inválido */
      }
    }

    // Compat: multer files se ainda vierem
    const files: any[] = Array.isArray((req as any).files) ? (req as any).files : [];
    for (const f of files) {
      if (f?.buffer) {
        attachments.push({
          filename: f.originalname || f.filename || 'anexo',
          contentType: f.mimetype || 'application/octet-stream',
          content: f.buffer as Buffer,
        });
      }
    }

    const result = await sendFromMailbox({
      tenantId,
      mailboxId: Number(id),
      toEmail: to_email || 'draft@local',
      toName: to_name,
      subject: subject || '(sem assunto)',
      bodyHtml: body_html,
      bodyText: body_text,
      replyToMessageId: reply_to_message_id ? Number(reply_to_message_id) : null,
      cc,
      bcc,
      attachments: attachments.length ? attachments : null,
      draftId: draft_id ? Number(draft_id) : null,
      scheduledAt: scheduled_at || null,
      saveAsDraft,
      requestReadReceipt: parseBool(request_read_receipt) === true,
      appendSignature: parseBool(append_signature) !== false,
    });

    const msg =
      result.status === 'draft'
        ? 'Rascunho salvo'
        : result.status === 'scheduled'
          ? 'Envio agendado'
          : 'E-mail enviado';

    res.json({ success: true, data: result, message: msg });
  } catch (error: any) {
    console.error('[mailbox-send]', error?.message || error);
    res.status(400).json({ success: false, message: error.message });
  }
};

async function applyMessageAction(opts: {
  tenantId: number;
  mailboxId: number;
  messageId: number;
  action: string;
  customFolderId?: number | null;
}) {
  const { tenantId, mailboxId, messageId, action } = opts;
  const msg = await pool.query(
    `SELECT id, folder FROM email_mailbox_messages
     WHERE id=$1 AND mailbox_id=$2 AND tenant_id=$3`,
    [messageId, mailboxId, tenantId]
  );
  if (!msg.rows[0]) return null;

  switch (action) {
    case 'read':
      await pool.query(
        `UPDATE email_mailbox_messages SET is_read=TRUE, updated_at=NOW() WHERE id=$1`,
        [messageId]
      );
      break;
    case 'unread':
      await pool.query(
        `UPDATE email_mailbox_messages SET is_read=FALSE, updated_at=NOW() WHERE id=$1`,
        [messageId]
      );
      break;
    case 'star':
      try {
        await pool.query(
          `UPDATE email_mailbox_messages SET is_starred=TRUE, updated_at=NOW() WHERE id=$1`,
          [messageId]
        );
      } catch (e: any) {
        if (!/is_starred|does not exist/i.test(String(e.message || ''))) throw e;
      }
      break;
    case 'unstar':
      try {
        await pool.query(
          `UPDATE email_mailbox_messages SET is_starred=FALSE, updated_at=NOW() WHERE id=$1`,
          [messageId]
        );
      } catch (e: any) {
        if (!/is_starred|does not exist/i.test(String(e.message || ''))) throw e;
      }
      break;
    case 'archive':
      await pool.query(
        `UPDATE email_mailbox_messages SET folder='archive', custom_folder_id=NULL, updated_at=NOW() WHERE id=$1`,
        [messageId]
      ).catch(async () => {
        await pool.query(
          `UPDATE email_mailbox_messages SET folder='archive', updated_at=NOW() WHERE id=$1`,
          [messageId]
        );
      });
      break;
    case 'spam':
      await pool.query(
        `UPDATE email_mailbox_messages SET folder='spam', custom_folder_id=NULL, updated_at=NOW() WHERE id=$1`,
        [messageId]
      ).catch(async () => {
        await pool.query(
          `UPDATE email_mailbox_messages SET folder='spam', updated_at=NOW() WHERE id=$1`,
          [messageId]
        );
      });
      break;
    case 'inbox':
      await pool.query(
        `UPDATE email_mailbox_messages SET folder='inbox', custom_folder_id=NULL, updated_at=NOW() WHERE id=$1`,
        [messageId]
      ).catch(async () => {
        await pool.query(
          `UPDATE email_mailbox_messages SET folder='inbox', updated_at=NOW() WHERE id=$1`,
          [messageId]
        );
      });
      break;
    case 'trash':
      await pool.query(
        `UPDATE email_mailbox_messages SET folder='trash', custom_folder_id=NULL, updated_at=NOW() WHERE id=$1`,
        [messageId]
      ).catch(async () => {
        await pool.query(
          `UPDATE email_mailbox_messages SET folder='trash', updated_at=NOW() WHERE id=$1`,
          [messageId]
        );
      });
      break;
    case 'delete':
      if (msg.rows[0].folder === 'trash') {
        await pool.query(
          `DELETE FROM email_mailbox_messages WHERE id=$1 AND mailbox_id=$2 AND tenant_id=$3`,
          [messageId, mailboxId, tenantId]
        );
      } else {
        await pool.query(
          `UPDATE email_mailbox_messages SET folder='trash', updated_at=NOW() WHERE id=$1`,
          [messageId]
        );
      }
      break;
    case 'move_folder': {
      const folderId = opts.customFolderId ? Number(opts.customFolderId) : null;
      if (!folderId) throw new Error('custom_folder_id obrigatório para move_folder');
      const folder = await pool.query(
        `SELECT id FROM email_mailbox_folders
         WHERE id=$1 AND tenant_id=$2 AND (mailbox_id IS NULL OR mailbox_id=$3)`,
        [folderId, tenantId, mailboxId]
      );
      if (!folder.rows[0]) throw new Error('Pasta não encontrada');
      await pool.query(
        `UPDATE email_mailbox_messages SET custom_folder_id=$1, folder='inbox', updated_at=NOW() WHERE id=$2`,
        [folderId, messageId]
      );
      break;
    }
    default:
      throw new Error('Ação inválida');
  }

  return { id: messageId, action };
}

export const messageAction = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const { id, messageId } = req.params;
    const action = String(req.body.action || '').trim().toLowerCase();
    const customFolderId = req.body.custom_folder_id != null ? Number(req.body.custom_folder_id) : null;

    if (!action) {
      return res.status(400).json({ success: false, message: 'Ação obrigatória' });
    }

    const mb = await assertMailbox(tenantId, id);
    if (!mb) return res.status(404).json({ success: false, message: 'Caixa não encontrada' });

    const result = await applyMessageAction({
      tenantId,
      mailboxId: Number(id),
      messageId: Number(messageId),
      action,
      customFolderId,
    });
    if (!result) return res.status(404).json({ success: false, message: 'Mensagem não encontrada' });

    res.json({ success: true, data: result, message: 'Ação aplicada' });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const bulkMessageAction = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const { id } = req.params;
    const ids: number[] = Array.isArray(req.body.ids)
      ? req.body.ids.map((x: any) => Number(x)).filter((n: number) => n > 0)
      : [];
    const action = String(req.body.action || '').trim().toLowerCase();
    const customFolderId = req.body.custom_folder_id != null
      ? Number(req.body.custom_folder_id)
      : (req.body.folder != null && !Number.isNaN(Number(req.body.folder)) ? Number(req.body.folder) : null);

    if (!ids.length) {
      return res.status(400).json({ success: false, message: 'Informe ids das mensagens' });
    }
    if (!action) {
      return res.status(400).json({ success: false, message: 'Ação obrigatória' });
    }

    const mb = await assertMailbox(tenantId, id);
    if (!mb) return res.status(404).json({ success: false, message: 'Caixa não encontrada' });

    const done: any[] = [];
    const errors: string[] = [];
    for (const messageId of ids) {
      try {
        const r = await applyMessageAction({
          tenantId,
          mailboxId: Number(id),
          messageId,
          action,
          customFolderId,
        });
        if (r) done.push(r);
        else errors.push(`${messageId}: não encontrada`);
      } catch (e: any) {
        errors.push(`${messageId}: ${e.message}`);
      }
    }

    res.json({
      success: true,
      data: done,
      errors: errors.length ? errors : undefined,
      message: `${done.length} mensagem(ns) atualizada(s)`,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/** Compat: move para pasta do sistema */
export const moveMailboxMessage = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const { id, messageId } = req.params;
    const folder = String(req.body.folder || 'trash');
    const allowed = ['inbox', 'sent', 'drafts', 'trash', 'archive', 'spam'];
    if (!allowed.includes(folder)) {
      return res.status(400).json({ success: false, message: 'Pasta inválida' });
    }
    const r = await pool.query(
      `UPDATE email_mailbox_messages SET folder=$1, updated_at=NOW()
       WHERE id=$2 AND mailbox_id=$3 AND tenant_id=$4
       RETURNING id, folder`,
      [folder, messageId, id, tenantId]
    );
    if (!r.rows[0]) return res.status(404).json({ success: false, message: 'Mensagem não encontrada' });
    res.json({ success: true, data: r.rows[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// =============================================
// PASTAS PERSONALIZADAS
// =============================================

export const listFolders = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const mailboxId = req.query.mailbox_id ? Number(req.query.mailbox_id) : null;

    try {
      let result;
      if (mailboxId) {
        result = await pool.query(
          `SELECT * FROM email_mailbox_folders
           WHERE tenant_id=$1 AND (mailbox_id IS NULL OR mailbox_id=$2)
           ORDER BY name ASC`,
          [tenantId, mailboxId]
        );
      } else {
        result = await pool.query(
          `SELECT * FROM email_mailbox_folders WHERE tenant_id=$1 ORDER BY name ASC`,
          [tenantId]
        );
      }
      res.json({ success: true, data: result.rows });
    } catch (e: any) {
      if (/does not exist/i.test(String(e.message || ''))) {
        return res.json({ success: true, data: [], migration_pending: true });
      }
      throw e;
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createFolder = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const name = String(req.body.name || '').trim();
    const color = String(req.body.color || '#22d3ee').trim();
    const mailboxId = req.body.mailbox_id != null ? Number(req.body.mailbox_id) : null;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Nome da pasta obrigatório' });
    }
    if (mailboxId) {
      const mb = await assertMailbox(tenantId, mailboxId);
      if (!mb) return res.status(404).json({ success: false, message: 'Caixa não encontrada' });
    }

    const result = await pool.query(
      `INSERT INTO email_mailbox_folders (tenant_id, mailbox_id, name, color)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [tenantId, mailboxId, name.slice(0, 100), color.slice(0, 20)]
    );
    res.json({ success: true, data: result.rows[0], message: 'Pasta criada' });
  } catch (error: any) {
    if (/does not exist/i.test(String(error.message || ''))) {
      return res.status(400).json({ success: false, message: 'Migration de pastas pendente' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateFolder = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const { id } = req.params;
    const sets: string[] = [];
    const vals: any[] = [];
    let i = 1;

    if (req.body.name !== undefined) {
      sets.push(`name=$${i++}`);
      vals.push(String(req.body.name).trim().slice(0, 100));
    }
    if (req.body.color !== undefined) {
      sets.push(`color=$${i++}`);
      vals.push(String(req.body.color).trim().slice(0, 20));
    }
    if (sets.length === 0) {
      return res.status(400).json({ success: false, message: 'Nenhum campo para atualizar' });
    }
    sets.push('updated_at=NOW()');
    vals.push(id, tenantId);

    const result = await pool.query(
      `UPDATE email_mailbox_folders SET ${sets.join(', ')}
       WHERE id=$${i++} AND tenant_id=$${i}
       RETURNING *`,
      vals
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Pasta não encontrada' });
    res.json({ success: true, data: result.rows[0], message: 'Pasta atualizada' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteFolder = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const { id } = req.params;

    try {
      await pool.query(
        `UPDATE email_mailbox_messages SET custom_folder_id=NULL
         WHERE custom_folder_id=$1 AND tenant_id=$2`,
        [id, tenantId]
      );
    } catch { /* coluna pode não existir */ }

    const r = await pool.query(
      `DELETE FROM email_mailbox_folders WHERE id=$1 AND tenant_id=$2 RETURNING id`,
      [id, tenantId]
    );
    if (!r.rows[0]) return res.status(404).json({ success: false, message: 'Pasta não encontrada' });
    res.json({ success: true, message: 'Pasta removida' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// =============================================
// RESPOSTAS RÁPIDAS
// =============================================

export const listQuickReplies = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const mailboxId = req.query.mailbox_id ? Number(req.query.mailbox_id) : null;

    try {
      let result;
      if (mailboxId) {
        result = await pool.query(
          `SELECT * FROM email_mailbox_quick_replies
           WHERE tenant_id=$1 AND (mailbox_id IS NULL OR mailbox_id=$2)
           ORDER BY title ASC`,
          [tenantId, mailboxId]
        );
      } else {
        result = await pool.query(
          `SELECT * FROM email_mailbox_quick_replies WHERE tenant_id=$1 ORDER BY title ASC`,
          [tenantId]
        );
      }
      res.json({ success: true, data: result.rows });
    } catch (e: any) {
      if (/does not exist/i.test(String(e.message || ''))) {
        return res.json({ success: true, data: [], migration_pending: true });
      }
      throw e;
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createQuickReply = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const title = String(req.body.title || '').trim();
    const bodyHtml = String(req.body.body_html || '').trim();
    const mailboxId = req.body.mailbox_id != null ? Number(req.body.mailbox_id) : null;

    if (!title || !bodyHtml) {
      return res.status(400).json({ success: false, message: 'Título e corpo obrigatórios' });
    }
    if (mailboxId) {
      const mb = await assertMailbox(tenantId, mailboxId);
      if (!mb) return res.status(404).json({ success: false, message: 'Caixa não encontrada' });
    }

    const result = await pool.query(
      `INSERT INTO email_mailbox_quick_replies (tenant_id, mailbox_id, title, body_html)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [tenantId, mailboxId, title.slice(0, 150), bodyHtml]
    );
    res.json({ success: true, data: result.rows[0], message: 'Resposta rápida criada' });
  } catch (error: any) {
    if (/does not exist/i.test(String(error.message || ''))) {
      return res.status(400).json({ success: false, message: 'Migration de respostas rápidas pendente' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateQuickReply = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const { id } = req.params;
    const sets: string[] = [];
    const vals: any[] = [];
    let i = 1;

    if (req.body.title !== undefined) {
      sets.push(`title=$${i++}`);
      vals.push(String(req.body.title).trim().slice(0, 150));
    }
    if (req.body.body_html !== undefined) {
      sets.push(`body_html=$${i++}`);
      vals.push(String(req.body.body_html));
    }
    if (sets.length === 0) {
      return res.status(400).json({ success: false, message: 'Nenhum campo para atualizar' });
    }
    sets.push('updated_at=NOW()');
    vals.push(id, tenantId);

    const result = await pool.query(
      `UPDATE email_mailbox_quick_replies SET ${sets.join(', ')}
       WHERE id=$${i++} AND tenant_id=$${i}
       RETURNING *`,
      vals
    );
    if (!result.rows[0]) {
      return res.status(404).json({ success: false, message: 'Resposta rápida não encontrada' });
    }
    res.json({ success: true, data: result.rows[0], message: 'Resposta rápida atualizada' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteQuickReply = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const { id } = req.params;
    const r = await pool.query(
      `DELETE FROM email_mailbox_quick_replies WHERE id=$1 AND tenant_id=$2 RETURNING id`,
      [id, tenantId]
    );
    if (!r.rows[0]) {
      return res.status(404).json({ success: false, message: 'Resposta rápida não encontrada' });
    }
    res.json({ success: true, message: 'Resposta rápida removida' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getThread = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const { id, messageId } = req.params;

    const base = await pool.query(
      `SELECT id, thread_key, subject, from_email, to_email, cc
       FROM email_mailbox_messages
       WHERE id=$1 AND mailbox_id=$2 AND tenant_id=$3`,
      [messageId, id, tenantId]
    );
    if (!base.rows[0]) return res.status(404).json({ success: false, message: 'Mensagem não encontrada' });

    let threadKey = base.rows[0].thread_key;
    if (!threadKey) {
      threadKey = buildThreadKey(base.rows[0].subject, [
        base.rows[0].from_email,
        base.rows[0].to_email,
        ...(String(base.rows[0].cc || '').split(/[,;]+/).map((s: string) => s.trim()).filter(Boolean)),
      ]);
    }

    try {
      const result = await pool.query(
        `SELECT id, direction, folder, from_email, from_name, to_email, to_name, subject,
                body_html, body_text, is_read, status, received_at, sent_at, created_at,
                cc, thread_key,
                COALESCE(is_starred, FALSE) AS is_starred,
                COALESCE(has_attachments, FALSE) AS has_attachments, attachments
         FROM email_mailbox_messages
         WHERE mailbox_id=$1 AND tenant_id=$2 AND thread_key=$3
         ORDER BY COALESCE(received_at, sent_at, created_at) ASC`,
        [id, tenantId, threadKey]
      );
      res.json({ success: true, data: result.rows, thread_key: threadKey });
    } catch (e: any) {
      if (/thread_key|does not exist/i.test(String(e.message || ''))) {
        return res.json({
          success: true,
          data: [base.rows[0]],
          thread_key: null,
          migration_pending: true,
        });
      }
      throw e;
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

function buildSimpleEml(msg: any): string {
  const lines: string[] = [];
  lines.push(`From: ${msg.from_name ? `"${msg.from_name}" <${msg.from_email}>` : msg.from_email || ''}`);
  lines.push(`To: ${msg.to_name ? `"${msg.to_name}" <${msg.to_email}>` : msg.to_email || ''}`);
  if (msg.cc) lines.push(`Cc: ${msg.cc}`);
  lines.push(`Subject: ${msg.subject || ''}`);
  lines.push(`Date: ${new Date(msg.received_at || msg.sent_at || msg.created_at || Date.now()).toUTCString()}`);
  if (msg.message_id) lines.push(`Message-ID: ${msg.message_id}`);
  lines.push('MIME-Version: 1.0');
  if (msg.body_html) {
    lines.push('Content-Type: text/html; charset=utf-8');
    lines.push('');
    lines.push(String(msg.body_html));
  } else {
    lines.push('Content-Type: text/plain; charset=utf-8');
    lines.push('');
    lines.push(String(msg.body_text || ''));
  }
  return lines.join('\r\n');
}

export const downloadMessageEml = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const { id, messageId } = req.params;

    const result = await pool.query(
      `SELECT * FROM email_mailbox_messages
       WHERE id=$1 AND mailbox_id=$2 AND tenant_id=$3`,
      [messageId, id, tenantId]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Mensagem não encontrada' });

    const eml = buildSimpleEml(result.rows[0]);
    const safeSubj = String(result.rows[0].subject || 'mensagem')
      .replace(/[\\/:*?"<>|]/g, '_')
      .slice(0, 80);
    res.setHeader('Content-Type', 'message/rfc822');
    res.setHeader('Content-Disposition', `attachment; filename="${safeSubj || 'mensagem'}.eml"`);
    res.send(eml);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const downloadAttachmentsZip = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const { id, messageId } = req.params;

    const result = await pool.query(
      `SELECT id, attachments FROM email_mailbox_messages
       WHERE id=$1 AND mailbox_id=$2 AND tenant_id=$3`,
      [messageId, id, tenantId]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Mensagem não encontrada' });

    const atts: any[] = Array.isArray(result.rows[0].attachments) ? result.rows[0].attachments : [];
    if (!atts.length) {
      return res.status(404).json({ success: false, message: 'Nenhum anexo nesta mensagem' });
    }

    const urls = atts
      .filter((a) => a?.url)
      .map((a) => ({ filename: a.filename || 'anexo', url: a.url, contentType: a.contentType }));

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mailbox-atts-'));
    const filesToZip: string[] = [];

    try {
      for (const a of atts) {
        if (!a?.url) continue;
        const rel = String(a.url).replace(/^\/uploads\//, '');
        const full = path.join(__dirname, '../../uploads', rel);
        if (!fs.existsSync(full)) continue;
        const destName = String(a.filename || path.basename(full)).replace(/[\\/:*?"<>|]/g, '_');
        const dest = path.join(tempDir, destName);
        fs.copyFileSync(full, dest);
        filesToZip.push(dest);
      }

      if (!filesToZip.length) {
        return res.json({
          success: true,
          zip_unavailable: true,
          message: 'Arquivos locais não encontrados; retornando URLs',
          data: urls,
        });
      }

      const zipPath = path.join(tempDir, `anexos-${messageId}.zip`);
      try {
        await execFileAsync('zip', ['-j', zipPath, ...filesToZip], { timeout: 30000 });
        const zipBuf = fs.readFileSync(zipPath);
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="anexos-${messageId}.zip"`);
        res.send(zipBuf);
      } catch {
        return res.json({
          success: true,
          zip_unavailable: true,
          message: 'CLI zip indisponível; retornando URLs dos anexos',
          data: urls,
        });
      }
    } finally {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch { /* ignore */ }
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
