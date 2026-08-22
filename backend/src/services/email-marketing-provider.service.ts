/**
 * Camada de provedor do E-mail Marketing.
 * Mailgun continua funcionando; SendGrid entra como opção ativa.
 * Rodapé de cancelamento de inscrição é injetado automaticamente quando tenantId é informado.
 */
import FormData from 'form-data';
import Mailgun from 'mailgun.js';
import { pool } from '../database/connection';
import { appendUnsubscribeFooter } from '../utils/email-unsubscribe';

export type EmailMarketingProviderName = 'mailgun' | 'sendgrid';

export type MarketingSendInput = {
  domain: string;
  fromEmail: string;
  fromName: string;
  toEmail: string;
  toName?: string | null;
  replyTo?: string | null;
  subject: string;
  html?: string | null;
  text?: string | null;
  /** Tenant dono do envio — o link de opt-out grava só nesta lista (nunca mistura tenants) */
  tenantId?: number | null;
  campaignId?: number | null;
  singleSendId?: number | null;
  /** Encaminhamentos internos (reply ao atendente) — sem rodapé de cancelamento */
  skipUnsubscribeFooter?: boolean;
  cc?: string[] | string | null;
  bcc?: string[] | string | null;
  /** Anexos em memória (base64 ou buffer) */
  attachments?: Array<{
    filename: string;
    contentType?: string;
    content: Buffer | string;
    disposition?: 'attachment' | 'inline';
    contentId?: string;
  }> | null;
  headers?: Record<string, string> | null;
  inReplyTo?: string | null;
  references?: string | null;
  requestReadReceipt?: boolean;
};

function normalizeAddressList(value: string[] | string | null | undefined): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((v) => String(v || '').trim().toLowerCase()).filter((v) => v.includes('@'));
  }
  return String(value)
    .split(/[,;]+/)
    .map((v) => v.trim().toLowerCase())
    .filter((v) => v.includes('@'));
}

export type MarketingSendResult = {
  provider: EmailMarketingProviderName;
  messageId: string;
};

const WEBHOOK_SENDGRID_URL =
  process.env.EMAIL_MARKETING_SENDGRID_WEBHOOK_URL ||
  'https://api.sistemasnettsistemas.com.br/api/webhook/sendgrid';

export async function getActiveEmailMarketingProvider(): Promise<EmailMarketingProviderName> {
  try {
    const r = await pool.query(
      `SELECT active_provider FROM email_marketing_provider_settings WHERE id=1 LIMIT 1`
    );
    const p = String(r.rows[0]?.active_provider || 'mailgun').toLowerCase();
    return p === 'sendgrid' ? 'sendgrid' : 'mailgun';
  } catch {
    return 'mailgun';
  }
}

export async function setActiveEmailMarketingProvider(provider: EmailMarketingProviderName) {
  await pool.query(
    `INSERT INTO email_marketing_provider_settings (id, active_provider, updated_at)
     VALUES (1, $1, NOW())
     ON CONFLICT (id) DO UPDATE SET active_provider=$1, updated_at=NOW()`,
    [provider]
  );
}

export async function getMailgunApiClient() {
  const result = await pool.query(
    `SELECT api_key, region FROM mailgun_credentials WHERE is_active = TRUE LIMIT 1`
  );
  if (!result.rows[0]) throw new Error('Nenhuma credencial Mailgun configurada');
  const { api_key, region } = result.rows[0];
  const mailgun = new Mailgun(FormData);
  return mailgun.client({
    username: 'api',
    key: api_key,
    url: region === 'eu' ? 'https://api.eu.mailgun.net' : 'https://api.mailgun.net',
  });
}

export async function getSendGridApiKey(): Promise<string> {
  const result = await pool.query(
    `SELECT api_key FROM sendgrid_credentials WHERE is_active = TRUE LIMIT 1`
  );
  if (!result.rows[0]?.api_key) throw new Error('Nenhuma credencial SendGrid configurada');
  return String(result.rows[0].api_key);
}

async function sendViaMailgun(
  input: MarketingSendInput,
  unsubscribeUrl?: string | null
): Promise<MarketingSendResult> {
  const mg = await getMailgunApiClient();
  const cc = normalizeAddressList(input.cc);
  const bcc = normalizeAddressList(input.bcc);
  const payload: any = {
    from: `${input.fromName} <${input.fromEmail}>`,
    to: [input.toName ? `${input.toName} <${input.toEmail}>` : input.toEmail],
    'h:Reply-To': input.replyTo || input.fromEmail,
    subject: input.subject,
    html: input.html || undefined,
    text: input.text || 'Por favor, habilite HTML para visualizar este e-mail.',
    'o:tracking': 'yes',
    'o:tracking-clicks': 'yes',
    'o:tracking-opens': 'yes',
  };
  if (cc.length) payload.cc = cc;
  if (bcc.length) payload.bcc = bcc;
  if (input.inReplyTo) payload['h:In-Reply-To'] = input.inReplyTo.startsWith('<') ? input.inReplyTo : `<${input.inReplyTo}>`;
  if (input.references) payload['h:References'] = input.references;
  if (input.requestReadReceipt) {
    payload['h:Disposition-Notification-To'] = input.fromEmail;
    payload['h:Return-Receipt-To'] = input.fromEmail;
  }
  if (input.headers) {
    for (const [k, v] of Object.entries(input.headers)) {
      if (v) payload[`h:${k}`] = v;
    }
  }
  if (unsubscribeUrl) {
    payload['h:List-Unsubscribe'] = `<${unsubscribeUrl}>`;
    payload['h:List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
  }
  if (Array.isArray(input.attachments) && input.attachments.length) {
    payload.attachment = input.attachments.map((a) => ({
      filename: a.filename,
      data: Buffer.isBuffer(a.content) ? a.content : Buffer.from(String(a.content), 'base64'),
      contentType: a.contentType || 'application/octet-stream',
    }));
  }
  const result = await mg.messages.create(input.domain, payload);
  const messageId = String(result.id || '').replace(/^<|>$/g, '');
  return { provider: 'mailgun', messageId };
}

async function sendViaSendGrid(
  input: MarketingSendInput,
  unsubscribeUrl?: string | null
): Promise<MarketingSendResult> {
  const apiKey = await getSendGridApiKey();
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const sgMail = require('@sendgrid/mail');
  sgMail.setApiKey(apiKey);

  const cc = normalizeAddressList(input.cc);
  const bcc = normalizeAddressList(input.bcc);

  const msg: any = {
    to: input.toName ? { email: input.toEmail, name: input.toName } : input.toEmail,
    from: { email: input.fromEmail, name: input.fromName },
    replyTo: input.replyTo || input.fromEmail,
    subject: input.subject,
    html: input.html || undefined,
    text: input.text || 'Por favor, habilite HTML para visualizar este e-mail.',
    trackingSettings: {
      clickTracking: { enable: true, enableText: false },
      openTracking: { enable: true },
    },
  };
  if (cc.length) msg.cc = cc;
  if (bcc.length) msg.bcc = bcc;

  const headers: Record<string, string> = { ...(input.headers || {}) };
  if (input.inReplyTo) {
    headers['In-Reply-To'] = input.inReplyTo.startsWith('<') ? input.inReplyTo : `<${input.inReplyTo}>`;
  }
  if (input.references) headers['References'] = input.references;
  if (input.requestReadReceipt) {
    headers['Disposition-Notification-To'] = input.fromEmail;
    headers['Return-Receipt-To'] = input.fromEmail;
  }
  if (unsubscribeUrl) {
    headers['List-Unsubscribe'] = `<${unsubscribeUrl}>`;
    headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
  }
  if (Object.keys(headers).length) msg.headers = headers;

  if (Array.isArray(input.attachments) && input.attachments.length) {
    msg.attachments = input.attachments.map((a) => ({
      content: Buffer.isBuffer(a.content)
        ? a.content.toString('base64')
        : String(a.content),
      filename: a.filename,
      type: a.contentType || 'application/octet-stream',
      disposition: a.disposition || 'attachment',
      contentId: a.contentId,
    }));
  }

  const [response] = await sgMail.send(msg);

  const messageId = String(
    response?.headers?.['x-message-id'] ||
    response?.headers?.['X-Message-Id'] ||
    ''
  ).trim();

  if (!messageId) {
    throw new Error('SendGrid não retornou X-Message-Id');
  }

  return { provider: 'sendgrid', messageId };
}

/** Envia pelo provedor ativo (ou pelo informado) */
export async function sendMarketingEmail(
  input: MarketingSendInput,
  forceProvider?: EmailMarketingProviderName
): Promise<MarketingSendResult> {
  let prepared = { ...input };
  let unsubscribeUrl: string | null = null;

  // Rodapé automático em TODOS os e-mails de marketing (todos os tenants)
  if (
    prepared.tenantId &&
    !prepared.skipUnsubscribeFooter &&
    prepared.toEmail
  ) {
    const withFooter = appendUnsubscribeFooter({
      html: prepared.html,
      text: prepared.text,
      tenantId: Number(prepared.tenantId),
      toEmail: prepared.toEmail,
      campaignId: prepared.campaignId,
      singleSendId: prepared.singleSendId,
    });
    prepared = { ...prepared, html: withFooter.html, text: withFooter.text };
    unsubscribeUrl = withFooter.unsubscribeUrl;
  }

  const provider = forceProvider || (await getActiveEmailMarketingProvider());
  if (provider === 'sendgrid') return sendViaSendGrid(prepared, unsubscribeUrl);
  return sendViaMailgun(prepared, unsubscribeUrl);
}

/** Autentica domínio no SendGrid (whitelabel) e devolve DNS + id */
export async function createSendGridDomain(domain: string) {
  const apiKey = await getSendGridApiKey();
  const res = await fetch('https://api.sendgrid.com/v3/whitelabel/domains', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      domain,
      automatic_security: true,
      custom_spf: false,
      default: false,
    }),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Domínio já existe — tenta listar
    const msg = String(data?.errors?.[0]?.message || data?.error || res.statusText || '');
    if (res.status === 400 && /already|exist/i.test(msg)) {
      return findSendGridDomainByName(domain);
    }
    throw new Error(msg || `SendGrid domínio HTTP ${res.status}`);
  }
  return data;
}

export async function findSendGridDomainByName(domain: string) {
  const apiKey = await getSendGridApiKey();
  const res = await fetch('https://api.sendgrid.com/v3/whitelabel/domains', {
    method: 'GET',
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const list: any = await res.json().catch(() => []);
  if (!res.ok) throw new Error(`SendGrid list domains HTTP ${res.status}`);
  const arr = Array.isArray(list) ? list : [];
  const found = arr.find((d: any) => String(d.domain || '').toLowerCase() === domain.toLowerCase());
  if (!found) throw new Error('Domínio já existe no SendGrid, mas não foi encontrado na listagem');
  return found;
}

export async function validateSendGridDomain(sendgridDomainId: string | number) {
  const apiKey = await getSendGridApiKey();
  const res = await fetch(
    `https://api.sendgrid.com/v3/whitelabel/domains/${sendgridDomainId}/validate`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
    }
  );
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(String(data?.errors?.[0]?.message || `SendGrid validate HTTP ${res.status}`));
  }
  return data;
}

export async function getSendGridDomain(sendgridDomainId: string | number) {
  const apiKey = await getSendGridApiKey();
  const res = await fetch(
    `https://api.sendgrid.com/v3/whitelabel/domains/${sendgridDomainId}`,
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` },
    }
  );
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(String(data?.errors?.[0]?.message || `SendGrid get domain HTTP ${res.status}`));
  }
  return data;
}

/** Converte resposta SendGrid whitelabel → lista de DNS no formato do painel */
export function mapSendGridDnsRecords(sgDomain: any, domain: string): any[] {
  const dns = sgDomain?.dns || {};
  const records: any[] = [];
  const push = (key: string, rec: any) => {
    if (!rec) return;
    records.push({
      record_type: String(rec.type || 'CNAME').toUpperCase(),
      name: rec.host || rec.name || key,
      value: rec.data || rec.value || '',
      valid: rec.valid === true || rec.valid === 'true' ? 'valid' : 'unknown',
      _sendgrid_key: key,
    });
  };
  push('mail_cname', dns.mail_cname);
  push('dkim1', dns.dkim1);
  push('dkim2', dns.dkim2);
  push('spf', dns.spf);
  // DMARC sugerido (não vem do SendGrid)
  const hasDmarc = records.some((r) => String(r.name || '').toLowerCase().includes('_dmarc'));
  if (!hasDmarc) {
    records.push({
      record_type: 'TXT',
      name: `_dmarc.${domain}`,
      value: `v=DMARC1; p=none; rua=mailto:dmarc@${domain}`,
      valid: 'unknown',
      _is_dmarc: true,
    });
  }
  return records;
}

/** Garante Event Webhook do SendGrid apontando para nossa API */
export async function ensureSendGridEventWebhook() {
  const apiKey = await getSendGridApiKey();
  const desired = {
    enabled: true,
    url: WEBHOOK_SENDGRID_URL,
    group_resubscribe: false,
    delivered: true,
    open: true,
    click: true,
    bounce: true,
    dropped: true,
    spam_report: true,
    unsubscribe: true,
    group_unsubscribe: false,
    deferred: false,
    processed: false,
  };

  // Tenta atualizar settings existentes
  const getRes = await fetch('https://api.sendgrid.com/v3/user/webhooks/event/settings', {
    method: 'GET',
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (getRes.ok) {
    const current: any = await getRes.json().catch(() => ({}));
    const patchRes = await fetch('https://api.sendgrid.com/v3/user/webhooks/event/settings', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...desired }),
    });
    if (!patchRes.ok) {
      const err: any = await patchRes.json().catch(() => ({}));
      console.warn('[sendgrid-webhook] PATCH falhou:', err?.errors || patchRes.status);
    } else {
      console.log('[sendgrid-webhook] Event webhook atualizado:', WEBHOOK_SENDGRID_URL);
    }
    return current;
  }

  const createRes = await fetch('https://api.sendgrid.com/v3/user/webhooks/event/settings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(desired),
  });
  if (!createRes.ok) {
    const err: any = await createRes.json().catch(() => ({}));
    console.warn('[sendgrid-webhook] POST falhou:', err?.errors || createRes.status);
  } else {
    console.log('[sendgrid-webhook] Event webhook criado:', WEBHOOK_SENDGRID_URL);
  }
}
