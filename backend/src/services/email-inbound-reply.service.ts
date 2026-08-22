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

function row(label: string, value: string | null | undefined): string {
  const v = String(value || '').trim();
  if (!v) return '';
  return `<tr>
    <td style="padding:6px 10px;color:#64748b;font-size:12px;width:120px;vertical-align:top;">${esc(label)}</td>
    <td style="padding:6px 10px;color:#0f172a;font-size:13px;font-weight:600;">${esc(v)}</td>
  </tr>`;
}

export function buildAttendantReplyHtml(opts: {
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

  const ficheRows = [
    row('Nome', ctx.clientName),
    row('E-mail', ctx.clientEmail),
    row('CPF', ctx.cpf),
    row('Telefone', ctx.phone),
    row('Protocolo', ctx.protocol),
    row('Var1', ctx.var1),
    row('Var2', ctx.var2),
    row('Var3', ctx.var3),
    row('Var4', ctx.var4),
    row('Var5', ctx.var5),
  ].filter(Boolean).join('');

  const clientBody = clientHtml && /<\s*(p|div|br|table|html|body)\b/i.test(clientHtml)
    ? clientHtml
    : `<pre style="white-space:pre-wrap;font-family:inherit;font-size:14px;color:#1e293b;margin:0;">${esc(clientText || '(sem conteúdo)')}</pre>`;

  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f8fafc;font-family:Segoe UI,Arial,sans-serif;">
  <div style="max-width:640px;margin:0 auto;padding:20px;">
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
      <div style="background:#0f766e;color:#fff;padding:12px 16px;font-size:13px;font-weight:700;">
        Resposta do cliente — use &quot;Responder&quot; para falar com o cliente
      </div>
      <div style="padding:16px;">
        <div style="font-size:12px;color:#64748b;margin-bottom:8px;">Mensagem do cliente:</div>
        <div style="border:1px solid #e2e8f0;border-radius:8px;padding:14px;background:#fafafa;">
          ${clientBody}
        </div>
      </div>
      <div style="border-top:2px dashed #cbd5e1;margin:0 16px;"></div>
      <div style="padding:16px;">
        <div style="font-size:11px;color:#b45309;font-weight:700;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.04em;">
          Dados do cliente (uso interno — não enviar ao cliente)
        </div>
        <table style="width:100%;border-collapse:collapse;background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;">
          ${ficheRows || '<tr><td style="padding:10px;color:#78716c;font-size:12px;">Sem dados extras cadastrados.</td></tr>'}
        </table>
        <p style="margin:12px 0 0;font-size:11px;color:#94a3b8;">
          Ao clicar em Responder, a mensagem vai para <strong>${esc(ctx.clientEmail)}</strong>.
          Apague o bloco amarelo acima se o seu cliente de e-mail incluir a citação.
        </p>
      </div>
    </div>
  </div>
</body></html>`;

  const textLines = [
    '--- Mensagem do cliente ---',
    clientText || '(sem conteúdo)',
    '',
    '========== DADOS DO CLIENTE (USO INTERNO — NÃO ENVIAR AO CLIENTE) ==========',
    ctx.clientName ? `Nome: ${ctx.clientName}` : '',
    `E-mail: ${ctx.clientEmail}`,
    ctx.cpf ? `CPF: ${ctx.cpf}` : '',
    ctx.phone ? `Telefone: ${ctx.phone}` : '',
    ctx.protocol ? `Protocolo: ${ctx.protocol}` : '',
    ctx.var1 ? `Var1: ${ctx.var1}` : '',
    ctx.var2 ? `Var2: ${ctx.var2}` : '',
    ctx.var3 ? `Var3: ${ctx.var3}` : '',
    ctx.var4 ? `Var4: ${ctx.var4}` : '',
    ctx.var5 ? `Var5: ${ctx.var5}` : '',
    '=======================================================================',
    `Responder vai para: ${ctx.clientEmail}`,
  ].filter(l => l !== '');

  return { subject, html, text: textLines.join('\n') };
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

  // Se o cliente respondeu de outro endereço, ainda priorizamos o e-mail cadastrado para Reply-To do atendente
  const built = buildAttendantReplyHtml({
    ctx,
    clientSubject: opts.clientSubject,
    clientText: opts.clientText,
    clientHtml: opts.clientHtml,
  });

  await sendMarketingEmail({
    domain: ctx.domain,
    fromEmail: ctx.fromEmail,
    fromName: `${ctx.fromName} (resposta)`,
    toEmail: ctx.attendantEmail,
    toName: null,
    // Crítico: ao responder, o atendente fala com o CLIENTE — não com o parse
    replyTo: ctx.clientEmail || opts.clientFromEmail,
    subject: built.subject,
    html: built.html,
    text: built.text,
  });

  console.log(
    `[inbound-reply] encaminhado ao atendente ${ctx.attendantEmail} | cliente=${ctx.clientEmail} | ${opts.kind}-${opts.id}`
  );
  return { ok: true };
}
