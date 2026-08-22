/**
 * Monta e envia ao atendente o e-mail de resposta do cliente,
 * com ficha interna (CPF, nome, telefone, etc.) que NÃO deve voltar ao cliente.
 */
import { pool } from '../database/connection';
import { sendMarketingEmail } from '../services/email-marketing-provider.service';
import { ReplyTokenKind } from '../utils/email-reply-token';

export type ClientReplyContext = {
  kind: ReplyTokenKind;
  id: number;
  attendantEmail: string;
  clientEmail: string;
  clientName: string | null;
  cpf: string | null;
  phone: string | null;
  var1: string | null;
  var2: string | null;
  var3: string | null;
  var4: string | null;
  var5: string | null;
  protocol: string | null;
  domain: string;
  fromEmail: string;
  fromName: string;
  originalSubject: string | null;
};

function esc(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function row(label: string, value: string | null | undefined, opts?: { always?: boolean }): string {
  const v = String(value || '').trim();
  if (!v && !opts?.always) return '';
  const display = v || '—';
  return `<tr>
    <td style="padding:6px 10px;color:#64748b;font-size:12px;width:120px;vertical-align:top;">${esc(label)}</td>
    <td style="padding:6px 10px;color:#0f172a;font-size:13px;font-weight:600;">${esc(display)}</td>
  </tr>`;
}

function buildConversationEmail(opts: {
  ctx: ClientReplyContext;
  clientSubject: string;
  clientText: string;
  clientHtml: string;
}): { subject: string; html: string; text: string } {
  const { clientSubject, clientText, clientHtml, ctx } = opts;
  const subjectBase = clientSubject || ctx.originalSubject || '(sem assunto)';
  const subject = subjectBase.toLowerCase().startsWith('re:')
    ? subjectBase
    : `Re: ${subjectBase}`;

  // Somente a mensagem do cliente — sem banners/instruções do sistema.
  // Se o atendente responder no Gmail, a citação não vaza texto interno para o cliente.
  const clientBody = clientHtml && /<\s*(p|div|br|table|html|body)\b/i.test(clientHtml)
    ? clientHtml
    : `<div style="white-space:pre-wrap;font-family:Segoe UI,Arial,sans-serif;font-size:14px;color:#111;line-height:1.5;">${esc(clientText || '(sem conteúdo)')}</div>`;

  const html = `<!DOCTYPE html><html><body style="margin:0;padding:16px;font-family:Segoe UI,Arial,sans-serif;font-size:14px;color:#111;line-height:1.5;">
${clientBody}
</body></html>`;

  const text = String(clientText || '').trim() || '(sem conteúdo)';

  return { subject, html, text };
}

function stripHtmlToText(html: string): string {
  return String(html || '')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/\s*p\s*>/gi, '\n')
    .replace(/<\/\s*div\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function buildFichaEmail(
  ctx: ClientReplyContext,
  clientSubject: string,
  clientText: string,
  clientHtml: string
): { subject: string; html: string; text: string } {
  const who = ctx.clientName || ctx.clientEmail;
  const subjectBase = clientSubject || ctx.originalSubject || '';
  const subject = `[FICHA INTERNA] ${who}${subjectBase ? ` — ${subjectBase.replace(/^re:\s*/i, '')}` : ''}`;

  // Sempre do CADASTRO (banco) — não depende de {{cpf}} etc. no corpo do e-mail
  const ficheRows = [
    row('Nome', ctx.clientName, { always: true }),
    row('E-mail', ctx.clientEmail, { always: true }),
    row('CPF', ctx.cpf, { always: true }),
    row('Telefone', ctx.phone, { always: true }),
    row('Protocolo', ctx.protocol, { always: true }),
    row('Var1', ctx.var1, { always: true }),
    row('Var2', ctx.var2, { always: true }),
    row('Var3', ctx.var3, { always: true }),
    row('Var4', ctx.var4, { always: true }),
    row('Var5', ctx.var5, { always: true }),
  ].join('');

  const lastReplyPlain =
    String(clientText || '').trim() ||
    stripHtmlToText(clientHtml) ||
    '(sem conteúdo)';

  const lastReplyHtml = clientHtml && /<\s*(p|div|br|table|html|body)\b/i.test(clientHtml)
    ? clientHtml
    : `<pre style="white-space:pre-wrap;font-family:inherit;font-size:13px;color:#0f172a;margin:0;">${esc(lastReplyPlain)}</pre>`;

  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#fffbeb;font-family:Segoe UI,Arial,sans-serif;">
  <div style="max-width:640px;margin:0 auto;padding:20px;">
    <div style="background:#fff;border:2px solid #f59e0b;border-radius:12px;overflow:hidden;">
      <div style="background:#b45309;color:#fff;padding:12px 16px;font-size:13px;font-weight:700;">
        FICHA INTERNA (cadastro) — NÃO responda este e-mail ao cliente
      </div>
      <div style="padding:16px;">
        <p style="margin:0 0 12px;font-size:12px;color:#92400e;">
          Uso interno. <strong>NÃO clique em Responder neste e-mail</strong> — ele não vai para o cliente,
          mas a citação pode confundir. Responda só o outro e-mail (assunto <strong>sem</strong> [FICHA]).
        </p>
        <table style="width:100%;border-collapse:collapse;background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;">
          ${ficheRows}
        </table>
        <div style="margin-top:16px;">
          <div style="font-size:12px;font-weight:700;color:#92400e;margin-bottom:8px;">Resposta do cliente</div>
          <div style="border:1px solid #fcd34d;border-radius:8px;padding:14px;background:#fff7ed;">
            ${lastReplyHtml}
          </div>
          <p style="margin:8px 0 0;font-size:11px;color:#a16207;">
            Cópia só para você ver aqui. Responder o cliente é no outro e-mail da conversa.
          </p>
        </div>
      </div>
    </div>
  </div>
</body></html>`;

  const text = [
    'FICHA INTERNA — NÃO responda este e-mail (use o outro, sem [FICHA]).',
    '',
    `Nome: ${ctx.clientName || '—'}`,
    `E-mail: ${ctx.clientEmail || '—'}`,
    `CPF: ${ctx.cpf || '—'}`,
    `Telefone: ${ctx.phone || '—'}`,
    `Protocolo: ${ctx.protocol || '—'}`,
    `Var1: ${ctx.var1 || '—'}`,
    `Var2: ${ctx.var2 || '—'}`,
    `Var3: ${ctx.var3 || '—'}`,
    `Var4: ${ctx.var4 || '—'}`,
    `Var5: ${ctx.var5 || '—'}`,
    '',
    '--- Resposta do cliente ---',
    lastReplyPlain,
  ].join('\n');

  return { subject, html, text };
}

/** @deprecated mantido por compat — preferir os dois e-mails separados */
export function buildAttendantReplyHtml(opts: {
  ctx: ClientReplyContext;
  clientSubject: string;
  clientText: string;
  clientHtml: string;
}): { subject: string; html: string; text: string } {
  return buildConversationEmail(opts);
}

export async function loadReplyContext(kind: ReplyTokenKind, id: number): Promise<ClientReplyContext | null> {
  if (kind === 'r') {
    const r = await pool.query(
      `SELECT rec.id, rec.email, rec.name, rec.cpf, rec.phone, rec.var1, rec.var2, rec.var3, rec.var4, rec.var5, rec.protocol,
              c.reply_to, c.from_email, c.from_name, c.subject, c.domain_id, d.domain
       FROM email_marketing_recipients rec
       JOIN email_marketing_campaigns c ON c.id = rec.campaign_id
       LEFT JOIN email_marketing_domains d ON d.id = c.domain_id
       WHERE rec.id = $1
       LIMIT 1`,
      [id]
    );
    const row = r.rows[0];
    if (!row) return null;
    const domain = String(row.domain || (row.from_email || '').split('@')[1] || '').trim();
    const attendant = String(row.reply_to || row.from_email || '').trim();
    if (!attendant || !domain) return null;
    return {
      kind,
      id,
      attendantEmail: attendant,
      clientEmail: String(row.email || '').trim(),
      clientName: row.name || null,
      cpf: row.cpf || null,
      phone: row.phone || null,
      var1: row.var1 || null,
      var2: row.var2 || null,
      var3: row.var3 || null,
      var4: row.var4 || null,
      var5: row.var5 || null,
      protocol: row.protocol || null,
      domain,
      fromEmail: String(row.from_email || `noreply@${domain}`),
      fromName: String(row.from_name || 'Atendimento'),
      originalSubject: row.subject || null,
    };
  }

  let row: any = null;
  try {
    const s = await pool.query(
      `SELECT s.id, s.to_email, s.to_name, s.reply_to, s.from_email, s.from_name, s.subject, s.domain_id,
              s.cpf, s.phone, s.var1, s.var2, s.var3, s.var4, s.var5, s.protocol, d.domain
       FROM email_marketing_single_sends s
       LEFT JOIN email_marketing_domains d ON d.id = s.domain_id
       WHERE s.id = $1
       LIMIT 1`,
      [id]
    );
    row = s.rows[0];
  } catch {
    const s = await pool.query(
      `SELECT s.id, s.to_email, s.to_name, s.reply_to, s.from_email, s.from_name, s.subject, s.domain_id, d.domain
       FROM email_marketing_single_sends s
       LEFT JOIN email_marketing_domains d ON d.id = s.domain_id
       WHERE s.id = $1
       LIMIT 1`,
      [id]
    );
    row = s.rows[0];
  }
  if (!row) return null;
  const domain = String(row.domain || (row.from_email || '').split('@')[1] || '').trim();
  const attendant = String(row.reply_to || row.from_email || '').trim();
  if (!attendant || !domain) return null;
  return {
    kind,
    id,
    attendantEmail: attendant,
    clientEmail: String(row.to_email || '').trim(),
    clientName: row.to_name || null,
    cpf: row.cpf || null,
    phone: row.phone || null,
    var1: row.var1 || null,
    var2: row.var2 || null,
    var3: row.var3 || null,
    var4: row.var4 || null,
    var5: row.var5 || null,
    protocol: row.protocol || null,
    domain,
    fromEmail: String(row.from_email || `noreply@${domain}`),
    fromName: String(row.from_name || 'Atendimento'),
    originalSubject: row.subject || null,
  };
}

export async function forwardClientReplyToAttendant(opts: {
  kind: ReplyTokenKind;
  id: number;
  clientSubject: string;
  clientText: string;
  clientHtml: string;
  clientFromEmail: string;
}): Promise<{ ok: boolean; reason?: string }> {
  const ctx = await loadReplyContext(opts.kind, opts.id);
  if (!ctx) return { ok: false, reason: 'envio/destinatário não encontrado' };
  if (!ctx.attendantEmail) return { ok: false, reason: 'sem e-mail de retorno (Reply-To) na campanha' };

  const conversation = buildConversationEmail({
    ctx,
    clientSubject: opts.clientSubject,
    clientText: opts.clientText,
    clientHtml: opts.clientHtml,
  });
  const ficha = buildFichaEmail(ctx, opts.clientSubject, opts.clientText, opts.clientHtml);

  // 1) Conversa — só a mensagem do cliente (sem texto de sistema). Reply-To = cliente.
  await sendMarketingEmail({
    domain: ctx.domain,
    fromEmail: ctx.fromEmail,
    fromName: 'NETTSISTEMAS',
    toEmail: ctx.attendantEmail,
    toName: null,
    replyTo: ctx.clientEmail || opts.clientFromEmail,
    subject: conversation.subject,
    html: conversation.html,
    text: conversation.text,
  });

  // 2) Ficha — e-mail separado com cadastro + última resposta; NÃO usar para responder o cliente
  await sendMarketingEmail({
    domain: ctx.domain,
    fromEmail: ctx.fromEmail,
    fromName: 'NETTSISTEMAS',
    toEmail: ctx.attendantEmail,
    toName: null,
    replyTo: ctx.attendantEmail,
    subject: ficha.subject,
    html: ficha.html,
    text: ficha.text,
  });

  // Marca destinatário da campanha como "respondido" (cards / log / relatório)
  if (opts.kind === 'r') {
    try {
      const upd = await pool.query(
        `UPDATE email_marketing_recipients
         SET replied_at = COALESCE(replied_at, NOW()),
             status = 'replied',
             updated_at = NOW()
         WHERE id = $1
         RETURNING campaign_id`,
        [opts.id]
      );
      const campaignId = upd.rows[0]?.campaign_id;
      if (campaignId) {
        await pool.query(
          `UPDATE email_marketing_campaigns c SET
             replied_count = COALESCE((
               SELECT COUNT(*)::int FROM email_marketing_recipients r
               WHERE r.campaign_id = c.id AND (r.replied_at IS NOT NULL OR r.status = 'replied')
             ), 0),
             sent_count = COALESCE((
               SELECT COUNT(*)::int FROM email_marketing_recipients r
               WHERE r.campaign_id = c.id AND (
                 r.status IN ('sent','opened','clicked','replied')
                 OR r.opened_at IS NOT NULL OR r.clicked_at IS NOT NULL OR r.replied_at IS NOT NULL
               )
             ), 0),
             opened_count = COALESCE((
               SELECT COUNT(*)::int FROM email_marketing_recipients r
               WHERE r.campaign_id = c.id AND (
                 r.opened_at IS NOT NULL OR r.clicked_at IS NOT NULL OR r.replied_at IS NOT NULL
                 OR r.status IN ('opened','clicked','replied')
               )
             ), 0),
             updated_at = NOW()
           WHERE c.id = $1`,
          [campaignId]
        );
      }
    } catch (markErr: any) {
      console.warn('[inbound-reply] não foi possível marcar replied:', markErr?.message || markErr);
    }
  } else if (opts.kind === 's') {
    try {
      await pool.query(
        `UPDATE email_marketing_single_sends
         SET replied_at = COALESCE(replied_at, NOW()),
             status = 'replied',
             updated_at = NOW()
         WHERE id = $1`,
        [opts.id]
      );
    } catch {
      /* coluna replied_at pode ainda não existir no single send */
    }
  }

  console.log(
    `[inbound-reply] 2 e-mails ao atendente ${ctx.attendantEmail} | cliente=${ctx.clientEmail} | ${opts.kind}-${opts.id}`
  );
  return { ok: true };
}
