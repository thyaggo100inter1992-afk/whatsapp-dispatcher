/**
 * Cliente HTTP do SMTP externo nettsistemasenvios.com.br
 * O servidor SMTP fica FORA do disparador — aqui só conectamos.
 */
import crypto from 'crypto';
import { pool } from '../database/connection';

export const NETTSISTEMAS_ENVIOS_PROVIDER = 'nettsistemasenvios' as const;
export const NETTSISTEMAS_ENVIOS_LABEL = 'nettsistemasenvios.com.br';

const DEFAULT_API_BASE = 'https://smtp1.nettsistemasenvios.com.br';
const PUBLIC_API =
  process.env.API_PUBLIC_URL ||
  process.env.BACKEND_PUBLIC_URL ||
  'https://api.sistemasnettsistemas.com.br';

export type NettEnviosCreds = {
  api_key: string;
  api_base_url: string;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_port_ssl: number | null;
  smtp_user: string | null;
  smtp_password: string | null;
  smtp_tls: boolean;
};

export function buildDomainWebhookUrls(domainId: number, token: string) {
  const base = String(PUBLIC_API).replace(/\/$/, '');
  return {
    webhook_events: `${base}/api/webhook/nettsistemasenvios/${domainId}/${token}`,
    webhook_inbound: `${base}/api/webhook/nettsistemasenvios-inbound/${domainId}/${token}`,
  };
}

export function newWebhookToken() {
  return crypto.randomBytes(16).toString('hex');
}

export async function getNettEnviosCredentials(): Promise<NettEnviosCreds> {
  const r = await pool.query(
    `SELECT api_key, api_base_url, smtp_host, smtp_port, smtp_port_ssl, smtp_user, smtp_password, smtp_tls
     FROM nettsistemasenvios_credentials
     WHERE is_active = TRUE
     ORDER BY id DESC
     LIMIT 1`
  );
  if (r.rows[0]?.api_key) {
    const row = r.rows[0];
    return {
      api_key: String(row.api_key),
      api_base_url: String(row.api_base_url || DEFAULT_API_BASE).replace(/\/$/, ''),
      smtp_host: row.smtp_host || null,
      smtp_port: row.smtp_port != null ? Number(row.smtp_port) : 587,
      smtp_port_ssl: row.smtp_port_ssl != null ? Number(row.smtp_port_ssl) : 465,
      smtp_user: row.smtp_user || null,
      smtp_password: row.smtp_password || null,
      smtp_tls: row.smtp_tls !== false,
    };
  }
  const envKey = process.env.NETTSISTEMAS_ENVIOS_API_KEY || '';
  if (!envKey) throw new Error('Credencial nettsistemasenvios.com.br não configurada');
  return {
    api_key: envKey,
    api_base_url: String(process.env.NETTSISTEMAS_ENVIOS_API_BASE || DEFAULT_API_BASE).replace(/\/$/, ''),
    smtp_host: process.env.NETTSISTEMAS_ENVIOS_SMTP_HOST || 'smtp1.nettsistemasenvios.com.br',
    smtp_port: Number(process.env.NETTSISTEMAS_ENVIOS_SMTP_PORT || 587),
    smtp_port_ssl: Number(process.env.NETTSISTEMAS_ENVIOS_SMTP_PORT_SSL || 465),
    smtp_user: process.env.NETTSISTEMAS_ENVIOS_SMTP_USER || null,
    smtp_password: process.env.NETTSISTEMAS_ENVIOS_SMTP_PASSWORD || null,
    smtp_tls: true,
  };
}

async function apiFetch(path: string, opts: { method?: string; body?: any } = {}) {
  const creds = await getNettEnviosCredentials();
  const url = `${creds.api_base_url}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url, {
    method: opts.method || 'GET',
    headers: {
      'X-Api-Key': creds.api_key,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: opts.body != null ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const msg = data?.message || data?.error || data?.raw || res.statusText || `HTTP ${res.status}`;
    throw new Error(`nettsistemasenvios.com.br: ${msg}`);
  }
  return data;
}

export async function ensureNettEnviosSmtpCredential(username = 'disparador') {
  const creds = await getNettEnviosCredentials();
  const placeholderUrls = {
    webhook_events: `${String(PUBLIC_API).replace(/\/$/, '')}/api/webhook/nettsistemasenvios`,
    webhook_inbound: `${String(PUBLIC_API).replace(/\/$/, '')}/api/webhook/nettsistemasenvios-inbound`,
  };

  let data: any;
  try {
    data = await apiFetch('/v1/credentials', {
      method: 'POST',
      body: {
        username,
        webhook_events: placeholderUrls.webhook_events,
        webhook_inbound: placeholderUrls.webhook_inbound,
      },
    });
  } catch {
    data = await apiFetch('/v1/webhooks', {
      method: 'POST',
      body: {
        username,
        webhook_events: placeholderUrls.webhook_events,
        webhook_inbound: placeholderUrls.webhook_inbound,
      },
    });
    if (!data?.password && creds.smtp_password) {
      data = {
        ...data,
        host: data?.host || creds.smtp_host,
        port: data?.port || creds.smtp_port,
        port_ssl: data?.port_ssl || creds.smtp_port_ssl,
        username: data?.username || creds.smtp_user || username,
        password: creds.smtp_password,
        tls: data?.tls != null ? data.tls : creds.smtp_tls,
      };
    }
  }

  await pool.query(`UPDATE nettsistemasenvios_credentials SET is_active=FALSE WHERE is_active=TRUE`);
  await pool.query(
    `INSERT INTO nettsistemasenvios_credentials
       (api_key, api_base_url, smtp_host, smtp_port, smtp_port_ssl, smtp_user, smtp_password, smtp_tls,
        webhook_events, webhook_inbound, is_active, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,TRUE,NOW())`,
    [
      creds.api_key,
      creds.api_base_url,
      data?.host || 'smtp1.nettsistemasenvios.com.br',
      Number(data?.port || 587),
      Number(data?.port_ssl || 465),
      String(data?.username || username),
      data?.password || creds.smtp_password || null,
      data?.tls !== false,
      data?.webhook_events || placeholderUrls.webhook_events,
      data?.webhook_inbound || placeholderUrls.webhook_inbound,
    ]
  );

  return data;
}

/** Atualiza webhook no SMTP para as URLs deste domínio (1 domínio = 1 webhook) */
export async function registerNettEnviosDomainWebhooks(domainId: number, token: string, username?: string) {
  const urls = buildDomainWebhookUrls(domainId, token);
  const creds = await getNettEnviosCredentials();
  const user = username || creds.smtp_user || 'disparador';
  await apiFetch('/v1/webhooks', {
    method: 'POST',
    body: {
      username: user,
      webhook_events: urls.webhook_events,
      webhook_inbound: urls.webhook_inbound,
    },
  });
  await pool.query(
    `UPDATE nettsistemasenvios_credentials
     SET webhook_events=$1, webhook_inbound=$2, updated_at=NOW()
     WHERE is_active=TRUE`,
    [urls.webhook_events, urls.webhook_inbound]
  );
  return urls;
}

export async function createNettEnviosDomain(domain: string) {
  return apiFetch('/v1/domains', {
    method: 'POST',
    body: { domain: String(domain).trim().toLowerCase() },
  });
}

export async function verifyNettEnviosDomain(externalId: string | number) {
  return apiFetch(`/v1/domains/${externalId}/verify`, { method: 'POST' });
}

export async function getNettEnviosDomain(externalId: string | number) {
  return apiFetch(`/v1/domains/${externalId}`);
}

export async function getNettEnviosDomainByName(domain: string) {
  return apiFetch(`/v1/domains/by-name/${encodeURIComponent(domain)}`);
}

/** Normaliza dns[] da API para o formato da tela do disparador */
export function mapNettEnviosDnsRecords(apiDomain: any): any[] {
  const list = Array.isArray(apiDomain?.dns) ? apiDomain.dns : [];
  return list.map((r: any) => {
    const type = String(r.type || r.record_type || 'TXT').toUpperCase();
    const status = String(r.status || '').toLowerCase();
    const valid =
      status.includes('verific') || status === 'valid' || status === 'verified'
        ? 'valid'
        : status.includes('aguard') || status === 'pending'
          ? 'unknown'
          : r.valid || 'unknown';
    return {
      record_type: type,
      type,
      name: r.host || r.name || '',
      host: r.host || r.name || '',
      value: r.value || '',
      priority: r.priority,
      label: r.label || '',
      required: r.required !== false,
      status: r.status || '',
      valid,
    };
  });
}

export function nettEnviosCanSend(apiDomain: any): boolean {
  if (apiDomain?.can_send === true) return true;
  if (String(apiDomain?.banner || '').toLowerCase().includes('pronto')) return true;
  const dns = Array.isArray(apiDomain?.dns) ? apiDomain.dns : [];
  if (!dns.length) return false;
  const required = dns.filter((d: any) => d.required !== false);
  const check = required.length ? required : dns;
  return check.every((d: any) => {
    const s = String(d.status || d.valid || '').toLowerCase();
    return s.includes('verific') || s === 'valid' || s === 'verified';
  });
}
