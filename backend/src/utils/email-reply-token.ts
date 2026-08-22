import crypto from 'crypto';

const DEFAULT_DOMAIN =
  process.env.EMAIL_REPLY_INBOUND_DOMAIN ||
  'reply.sistemasnettsistemas.com.br';

function secret(): string {
  return (
    process.env.EMAIL_REPLY_TOKEN_SECRET ||
    process.env.JWT_SECRET ||
    process.env.SESSION_SECRET ||
    'nettcred-email-reply-secret'
  );
}

export type ReplyTokenKind = 'r' | 's'; // r = campaign recipient, s = single send

export function isReplyInboundConfigured(): boolean {
  // Só ativa o Reply-To interceptável quando o DNS/Inbound Parse estiver pronto
  if (process.env.EMAIL_REPLY_INBOUND_ENABLED !== '1') return false;
  const d = String(process.env.EMAIL_REPLY_INBOUND_DOMAIN || DEFAULT_DOMAIN).trim();
  return !!d;
}

export function getReplyInboundDomain(): string {
  return String(process.env.EMAIL_REPLY_INBOUND_DOMAIN || DEFAULT_DOMAIN).trim().toLowerCase();
}

function sign(kind: ReplyTokenKind, id: number): string {
  return crypto
    .createHmac('sha256', secret())
    .update(`${kind}:${id}`)
    .digest('hex')
    .slice(0, 10);
}

/** Monta endereço Reply-To interceptável: r-123-abc@reply.dominio */
export function buildInterceptReplyTo(kind: ReplyTokenKind, id: number): string | null {
  if (!isReplyInboundConfigured()) return null;
  const domain = getReplyInboundDomain();
  const sig = sign(kind, id);
  return `${kind}-${id}-${sig}@${domain}`;
}

export function parseInterceptReplyTo(address: string): { kind: ReplyTokenKind; id: number } | null {
  const raw = String(address || '').trim().toLowerCase();
  const emailMatch = raw.match(/([rs])-(\d+)-([a-f0-9]{6,16})@/i);
  if (!emailMatch) return null;
  const kind = emailMatch[1].toLowerCase() as ReplyTokenKind;
  const id = parseInt(emailMatch[2], 10);
  const sig = emailMatch[3].toLowerCase();
  if (!id || (kind !== 'r' && kind !== 's')) return null;
  if (sig !== sign(kind, id)) return null;
  return { kind, id };
}

/** Extrai todos os e-mails de um campo To/Cc/entregue do Inbound Parse */
export function extractEmailsFromHeader(value: string): string[] {
  const out: string[] = [];
  const re = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
  const m = String(value || '').match(re) || [];
  for (const e of m) out.push(e.toLowerCase());
  return out;
}
