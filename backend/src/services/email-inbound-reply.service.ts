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
  const { ctx, clientSubject, clientText, clientHtml } = opts;
  const subjectBase = clientSubject || ctx.originalSubject || '(sem assunto)';
  const subject = subjectBase.toLowerCase().startsWith('re:')
    ? subjectBase
    : `Re: ${subjectBase}`;

  const clientBody = clientHtml && /<\s*(p|div|br|table|html|body)\b/i.test(clientHtml)
    ? clientHtml
    : `<pre style="white-space:pre-wrap;font-family:inherit;font-size:14px;color:#1e293b;margin:0;">${esc(clientText || '(sem conteúdo)')}</pre>`;

  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f8fafc;font-family:Segoe UI,Arial,sans-serif;">
  <div style="max-width:640px;margin:0 auto;padding:20px;">
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
      <div style="background:#0f766e;color:#fff;padding:12px 16px;font-size:13px;font-weight:700;">
        Resposta do cliente — use este e-mail para responder
      </div>
      <div style="padding:16px;">
        <p style="margin:0 0 12px;font-size:12px;color:#64748b;">
          A ficha (CPF, telefone, etc.) chegou em um <strong>segundo e-mail separado</strong> com assunto começando em [FICHA].
          Responda <strong>somente este</strong> para o cliente não receber dados internos.
        </p>
        <div style="font-size:12px;color:#64748b;margin-bottom:8px;">Mensagem do cliente:</div>
        <div style="border:1px solid #e2e8f0;border-radius:8px;padding:14px;background:#fafafa;">
          ${clientBody}
        </div>
      </div>
    </div>
  </div>
</body></html>`;

  const text = [
    'Use ESTE e-mail para responder ao cliente.',
    'A ficha interna veio em outro e-mail com assunto [FICHA].',
    '',
    '--- Mensagem do cliente ---',
    clientText || '(sem conteúdo)',
  ].join('\n');

  return { subject, html, text };
}

function buildFichaEmail(ctx: ClientReplyContext, clientSubject: string): { subject: string; html: string; text: string } {
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

  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#fffbeb;font-family:Segoe UI,Arial,sans-serif;">
  <div style="max-width:640px;margin:0 auto;padding:20px;">
    <div style="background:#fff;border:2px solid #f59e0b;border-radius:12px;overflow:hidden;">
      <div style="background:#b45309;color:#fff;padding:12px 16px;font-size:13px;font-weight:700;">
        FICHA INTERNA (cadastro) — NÃO responda este e-mail ao cliente
      </div>
      <div style="padding:16px;">
        <p style="margin:0 0 12px;font-size:12px;color:#92400e;">
          Dados vindos do cadastro no disparador (não do texto do e-mail).
          Use o outro e-mail da conversa (sem [FICHA] no assunto) para responder o cliente.
        </p>
        <table style="width:100%;border-collapse:collapse;background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;">
          ${ficheRows}
        </table>
      </div>
    </div>
  </div>
</body></html>`;

  const text = [
    'FICHA INTERNA (cadastro) — NÃO responda este e-mail ao cliente.',
    'Responda pelo outro e-mail da conversa (sem [FICHA] no assunto).',
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
  const ficha = buildFichaEmail(ctx, opts.clientSubject);

  // 1) Conversa — Reply-To = cliente (atendente responde por AQUI)
  await sendMarketingEmail({
    domain: ctx.domain,
    fromEmail: ctx.fromEmail,
    fromName: `${ctx.fromName} (resposta)`,
    toEmail: ctx.attendantEmail,
    toName: null,
    replyTo: ctx.clientEmail || opts.clientFromEmail,
    subject: conversation.subject,
    html: conversation.html,
    text: conversation.text,
  });

  // 2) Ficha — e-mail separado; Reply-To = atendente (não o cliente)
  await sendMarketingEmail({
    domain: ctx.domain,
    fromEmail: ctx.fromEmail,
    fromName: `${ctx.fromName} (ficha)`,
    toEmail: ctx.attendantEmail,
    toName: null,
    replyTo: ctx.attendantEmail,
    subject: ficha.subject,
    html: ficha.html,
    text: ficha.text,
  });

  console.log(
    `[inbound-reply] 2 e-mails ao atendente ${ctx.attendantEmail} | cliente=${ctx.clientEmail} | ${opts.kind}-${opts.id}`
  );
  return { ok: true };
}
