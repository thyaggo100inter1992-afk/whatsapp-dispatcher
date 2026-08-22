/**
 * Opt-out / cancelamento de inscrição — e-mail marketing (todos os tenants).
 * Token assinado: não depende de sessão; funciona no link do rodapé automático.
 */
import crypto from 'crypto';

function secret(): string {
  return (
    process.env.EMAIL_UNSUBSCRIBE_SECRET ||
    process.env.EMAIL_REPLY_TOKEN_SECRET ||
    process.env.JWT_SECRET ||
    process.env.SESSION_SECRET ||
    'nettcred-email-unsubscribe-secret'
  );
}

export function getPublicApiBaseUrl(): string {
  return String(
    process.env.API_PUBLIC_URL ||
    process.env.BACKEND_PUBLIC_URL ||
    'https://api.sistemasnettsistemas.com.br'
  ).replace(/\/$/, '');
}

export function buildUnsubscribeToken(tenantId: number, email: string): string {
  const payload = Buffer.from(
    JSON.stringify({ t: Number(tenantId), e: String(email || '').trim().toLowerCase() }),
    'utf8'
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', secret()).update(payload).digest('hex').slice(0, 16);
  return `${payload}.${sig}`;
}

export function parseUnsubscribeToken(token: string): { tenantId: number; email: string } | null {
  const raw = String(token || '').trim();
  const [payload, sig] = raw.split('.');
  if (!payload || !sig) return null;
  const expect = crypto.createHmac('sha256', secret()).update(payload).digest('hex').slice(0, 16);
  if (sig !== expect) return null;
  try {
    const json = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    const tenantId = Number(json.t);
    const email = String(json.e || '').trim().toLowerCase();
    if (!tenantId || !email.includes('@')) return null;
    return { tenantId, email };
  } catch {
    return null;
  }
}

export function buildUnsubscribeUrl(tenantId: number, email: string): string {
  const token = buildUnsubscribeToken(tenantId, email);
  return `${getPublicApiBaseUrl()}/api/public/email-unsubscribe?t=${encodeURIComponent(token)}`;
}

/** Texto padrão do rodapé (todos os e-mails / todos os tenants) */
export const UNSUBSCRIBE_FOOTER_TEXT =
  'Se você não deseja mais receber estes e-mails, cancele sua inscrição pelo link abaixo.';

export function appendUnsubscribeFooter(opts: {
  html?: string | null;
  text?: string | null;
  tenantId: number;
  toEmail: string;
}): { html: string; text: string; unsubscribeUrl: string } {
  const url = buildUnsubscribeUrl(opts.tenantId, opts.toEmail);
  const htmlFooter = `
<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;font-family:Segoe UI,Arial,sans-serif;font-size:12px;line-height:1.5;color:#64748b;text-align:center;">
  <p style="margin:0 0 8px;">${UNSUBSCRIBE_FOOTER_TEXT}</p>
  <p style="margin:0;">
    <a href="${url}" style="color:#dc2626;text-decoration:underline;font-weight:600;">Cancelar inscrição</a>
  </p>
</div>`.trim();

  const textFooter = `\n\n---\n${UNSUBSCRIBE_FOOTER_TEXT}\nCancelar inscrição: ${url}\n`;

  let html = String(opts.html || '').trim();
  if (!html) {
    html = `<div style="font-family:Segoe UI,Arial,sans-serif;font-size:14px;color:#111;">${String(opts.text || '').replace(/</g, '&lt;')}</div>`;
  }

  // Evita duplicar se já injetado
  if (!/Cancelar inscrição|email-unsubscribe/i.test(html)) {
    if (/<\/body>/i.test(html)) {
      html = html.replace(/<\/body>/i, `${htmlFooter}</body>`);
    } else {
      html = `${html}${htmlFooter}`;
    }
  }

  let text = String(opts.text || '').trim();
  if (!/Cancelar inscrição|email-unsubscribe/i.test(text)) {
    text = `${text}${textFooter}`;
  }

  return { html, text, unsubscribeUrl: url };
}
