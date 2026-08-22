import { Request, Response } from 'express';
import { pool } from '../database/connection';
import {
  buildInboundDnsRecords,
  checkInboundMxOnly,
  ensureSendGridInboundParse,
  sendFromMailbox,
} from '../services/email-mailbox.service';

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
      // Continua — usuário ainda precisa do MX; parse pode ser configurado depois
    }

    const inboundDns = buildInboundDnsRecords(domain);
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

export const listMailboxMessages = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const { id } = req.params;
    const folder = String(req.query.folder || 'inbox');
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));

    const mb = await pool.query(
      `SELECT id FROM email_mailboxes WHERE id=$1 AND tenant_id=$2`,
      [id, tenantId]
    );
    if (!mb.rows[0]) return res.status(404).json({ success: false, message: 'Caixa não encontrada' });

    const result = await pool.query(
      `SELECT id, direction, folder, from_email, from_name, to_email, to_name, subject,
              is_read, status, received_at, sent_at, created_at,
              LEFT(COALESCE(body_text, ''), 160) AS preview
       FROM email_mailbox_messages
       WHERE mailbox_id=$1 AND tenant_id=$2 AND folder=$3
       ORDER BY COALESCE(received_at, sent_at, created_at) DESC
       LIMIT $4`,
      [id, tenantId, folder, limit]
    );

    const unread = await pool.query(
      `SELECT COUNT(*)::int AS n FROM email_mailbox_messages
       WHERE mailbox_id=$1 AND tenant_id=$2 AND folder='inbox' AND is_read=FALSE`,
      [id, tenantId]
    );

    res.json({
      success: true,
      data: result.rows,
      unread_count: unread.rows[0]?.n || 0,
      folder,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMailboxMessage = async (req: Request, res: Response) => {
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

    if (!result.rows[0].is_read && result.rows[0].folder === 'inbox') {
      await pool.query(
        `UPDATE email_mailbox_messages SET is_read=TRUE, updated_at=NOW() WHERE id=$1`,
        [messageId]
      );
      result.rows[0].is_read = true;
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const sendMailboxMessage = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const { id } = req.params;
    const { to_email, to_name, subject, body_html, body_text, reply_to_message_id } = req.body;

    if (!to_email || !subject) {
      return res.status(400).json({ success: false, message: 'Destinatário e assunto obrigatórios' });
    }

    const result = await sendFromMailbox({
      tenantId,
      mailboxId: Number(id),
      toEmail: to_email,
      toName: to_name,
      subject,
      bodyHtml: body_html,
      bodyText: body_text,
      replyToMessageId: reply_to_message_id ? Number(reply_to_message_id) : null,
    });

    res.json({ success: true, data: result, message: 'E-mail enviado' });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const moveMailboxMessage = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const { id, messageId } = req.params;
    const folder = String(req.body.folder || 'trash');
    if (!['inbox', 'sent', 'drafts', 'trash'].includes(folder)) {
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
