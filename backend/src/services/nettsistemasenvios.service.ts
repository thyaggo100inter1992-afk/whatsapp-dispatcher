/**
 * Cliente HTTP do SMTP externo nettsistemasenvios.com.br
 * O servidor SMTP fica FORA do disparador — aqui só conectamos.
 */
import crypto from 'crypto';
import { pool } from '../database/connection';

export const NETTSISTEMAS_ENVIOS_PROVIDER = 'nettsistemasenvios' as const;
export const NETTSISTEMAS_ENVIOS_LABEL = 'nettsistemasenvios.com.br';

const DEFAULT_API_BASE = 'https://nettsistemasenvios.com.br';
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
    let apiBase = String(row.api_base_url || DEFAULT_API_BASE).replace(/\/$/, '');
    if (/smtp1\.nettsistemasenvios\.com\.br/i.test(apiBase)) {
      apiBase = DEFAULT_API_BASE;
    }
    return {
      api_key: String(row.api_key),
      api_base_url: apiBase,
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
  let base = String(creds.api_base_url || DEFAULT_API_BASE).replace(/\/$/, '');
  // smtp1.* deixou de resolver (NXDOMAIN) — API ficou no domínio raiz
  if (/smtp1\.nettsistemasenvios\.com\.br/i.test(base)) {
    base = DEFAULT_API_BASE;
  }

  const tryOnce = async (apiBase: string) => {
    const url = `${apiBase}${path.startsWith('/') ? path : `/${path}`}`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: opts.method || 'GET',
        headers: {
          'X-Api-Key': creds.api_key,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: opts.body != null ? JSON.stringify(opts.body) : undefined,
      });
    } catch (netErr: any) {
      const cause = netErr?.cause?.code || netErr?.code || '';
      throw new Error(
        `nettsistemasenvios.com.br: sem conexão com ${apiBase} (${netErr?.message || 'fetch failed'}${cause ? ` / ${cause}` : ''})`
      );
    }
    const text = await res.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }
    if (!res.ok) {
      const msg = data?.message || data?.detail || data?.error || data?.raw || res.statusText || `HTTP ${res.status}`;
      throw new Error(`nettsistemasenvios.com.br: ${msg}`);
    }
    return data;
  };

  try {
    return await tryOnce(base);
  } catch (e: any) {
    if (base !== DEFAULT_API_BASE && /fetch failed|ENOTFOUND|ECONNREFUSED|sem conexão/i.test(String(e?.message || ''))) {
      console.warn(`[nett-smtp] fallback API ${base} → ${DEFAULT_API_BASE}`);
      return tryOnce(DEFAULT_API_BASE);
    }
    throw e;
  }
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

export function buildNettEnviosSmtpName(tenantId: number | string) {
  return `Tenant ${Number(tenantId)}`;
}

/**
 * Cria o domínio no SMTP próprio.
 * Envia tenant_id + smtp_name ("Tenant 123") para o painel não gerar nome aleatório.
 */
export async function createNettEnviosDomain(domain: string, tenantId: number | string) {
  const id = Number(tenantId);
  const smtpName = buildNettEnviosSmtpName(id);
  return apiFetch('/v1/domains', {
    method: 'POST',
    body: {
      domain: String(domain).trim().toLowerCase(),
      tenant_id: id,
      smtp_name: smtpName,
      name: smtpName,
    },
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

/**
 * Remove domínio no painel SMTP (NettMail).
 * Preferência: POST /v1/domains/delete — fallbacks DELETE by-name / by-id.
 * 404 = já não existe (ok).
 */
export async function deleteNettEnviosDomain(opts: {
  domain: string;
  externalId?: string | number | null;
}): Promise<{ ok: boolean; deleted?: boolean; missing?: boolean; raw?: any }> {
  const domain = String(opts.domain || '').trim().toLowerCase();
  if (!domain) return { ok: false };

  try {
    const raw = await apiFetch('/v1/domains/delete', {
      method: 'POST',
      body: { domain },
    });
    console.log('[nett-smtp] domínio apagado no SMTP:', domain, raw);
    return { ok: true, deleted: true, raw };
  } catch (e1: any) {
    const msg1 = String(e1?.message || '');
    if (/404|not found|não encontr/i.test(msg1)) {
      return { ok: true, missing: true };
    }
  }

  try {
    const raw = await apiFetch(`/v1/domains/by-name/${encodeURIComponent(domain)}`, {
      method: 'DELETE',
    });
    return { ok: true, deleted: true, raw };
  } catch (e2: any) {
    const msg2 = String(e2?.message || '');
    if (/404|not found|não encontr/i.test(msg2)) {
      return { ok: true, missing: true };
    }
  }

  if (opts.externalId) {
    try {
      const raw = await apiFetch(`/v1/domains/${encodeURIComponent(String(opts.externalId))}`, {
        method: 'DELETE',
      });
      return { ok: true, deleted: true, raw };
    } catch (e3: any) {
      const msg3 = String(e3?.message || '');
      if (/404|not found|não encontr/i.test(msg3)) {
        return { ok: true, missing: true };
      }
      console.warn('[nett-smtp] delete domain falhou:', msg3);
      throw e3;
    }
  }

  console.warn('[nett-smtp] delete domain falhou para', domain);
  return { ok: false };
}

/** Apaga domínio local no disparador (sem chamar SMTP de volta). */
export async function deleteLocalEmailDomain(opts: {
  domain: string;
  tenantId?: number | null;
}): Promise<{ deleted: boolean; id?: number }> {
  const domain = String(opts.domain || '').trim().toLowerCase();
  if (!domain) return { deleted: false };

  let q = `SELECT id, tenant_id FROM email_marketing_domains WHERE LOWER(domain)=$1`;
  const params: any[] = [domain];
  if (opts.tenantId) {
    q += ` AND tenant_id=$2`;
    params.push(Number(opts.tenantId));
  }
  q += ` LIMIT 1`;
  const found = await pool.query(q, params);
  const row = found.rows[0];
  if (!row) return { deleted: false };

  const id = Number(row.id);
  const tenantId = Number(row.tenant_id);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE email_marketing_campaigns SET domain_id=NULL WHERE domain_id=$1 AND tenant_id=$2`,
      [id, tenantId]
    );
    await client.query(
      `UPDATE email_marketing_single_sends SET domain_id=NULL WHERE domain_id=$1 AND tenant_id=$2`,
      [id, tenantId]
    );
    await client.query(`DELETE FROM email_marketing_domains WHERE id=$1 AND tenant_id=$2`, [id, tenantId]);
    await client.query('COMMIT');
    console.log(`[nett-smtp] domínio local apagado via webhook: ${domain} (id=${id}, tenant=${tenantId})`);
    return { deleted: true, id };
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    throw e;
  } finally {
    client.release();
  }
}

/** Ativa/desativa domínio local (painel SMTP). */
export async function setLocalEmailDomainActive(opts: {
  domain: string;
  tenantId?: number | null;
  active: boolean;
  canSend?: boolean;
}): Promise<{ updated: boolean }> {
  const domain = String(opts.domain || '').trim().toLowerCase();
  if (!domain) return { updated: false };

  let q = `SELECT id, tenant_id FROM email_marketing_domains WHERE LOWER(domain)=$1`;
  const params: any[] = [domain];
  if (opts.tenantId) {
    q += ` AND tenant_id=$2`;
    params.push(Number(opts.tenantId));
  }
  q += ` LIMIT 1`;
  const found = await pool.query(q, params);
  const row = found.rows[0];
  if (!row) return { updated: false };

  const active = !!opts.active;
  const status = active || opts.canSend === true ? 'active' : 'unverified';
  await pool.query(
    `UPDATE email_marketing_domains
     SET is_active=$1, status=$2, updated_at=NOW()
     WHERE id=$3`,
    [active, status, row.id]
  );
  console.log(
    `[nett-smtp] domínio ${domain} → ${active ? 'ativado' : 'desativado'} (status=${status})`
  );
  return { updated: true };
}

/**
 * Eventos administrativos do NettMail no webhook (não são tracking de e-mail).
 * domain_deleted | domain_status_changed | smtp_user_status_changed
 */
export async function handleNettAdminWebhookEvent(ev: any): Promise<boolean> {
  const eventType = String(ev?.event || '').toLowerCase();
  const source = String(ev?.source || '').toLowerCase();
  const isAdmin =
    source === 'nettmail_admin' ||
    ['domain_deleted', 'domain_status_changed', 'smtp_user_status_changed'].includes(eventType);
  if (!isAdmin) return false;

  const domain = String(ev?.domain || '').trim().toLowerCase();
  const tenantId = Number(ev?.tenant_id || ev?.tenant || 0) || null;
  const action = String(ev?.action || '').toLowerCase();

  if (eventType === 'domain_deleted') {
    if (!domain) {
      console.warn('[nett-smtp] domain_deleted sem domain:', ev);
      return true;
    }
    await deleteLocalEmailDomain({ domain, tenantId });
    return true;
  }

  if (eventType === 'domain_status_changed') {
    if (!domain) {
      console.warn('[nett-smtp] domain_status_changed sem domain:', ev);
      return true;
    }
    const active =
      action === 'activate' ||
      ev?.active === true ||
      ev?.can_send === true;
    const deactivate =
      action === 'deactivate' ||
      ev?.active === false ||
      ev?.can_send === false;
    await setLocalEmailDomainActive({
      domain,
      tenantId,
      active: deactivate ? false : active,
      canSend: ev?.can_send,
    });
    return true;
  }

  if (eventType === 'smtp_user_status_changed') {
    // Sem tabela dedicada de smtp users no disparador — log + se tiver domain no username, espelha status
    const username = String(ev?.username || '').trim().toLowerCase();
    console.log(
      `[nett-smtp] smtp_user_status_changed user=${username} action=${action} active=${ev?.active}`
    );
    const at = username.indexOf('@');
    if (at > 0) {
      const userDomain = username.slice(at + 1);
      if (userDomain) {
        const active = action === 'activate' || ev?.active === true;
        const deactivate = action === 'deactivate' || ev?.active === false;
        await setLocalEmailDomainActive({
          domain: userDomain,
          tenantId,
          active: deactivate ? false : active,
        });
      }
    }
    return true;
  }

  return false;
}

function isGooglePostmasterRecord(r: any): boolean {
  const label = String(r.label || '');
  const value = String(r.value || '');
  return (
    /google-site-verification/i.test(value) ||
    /postmaster/i.test(label) ||
    /google site verification/i.test(label)
  );
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
    const google = isGooglePostmasterRecord(r);
    const rawLabel = String(r.label || '').trim();
    return {
      record_type: type,
      type,
      name: r.host || r.name || '',
      host: r.host || r.name || '',
      value: r.value || '',
      priority: r.priority,
      label: google ? (rawLabel || 'Google Postmaster') : rawLabel,
      hint: google ? 'Recomendado — reputação Gmail' : (r.hint || ''),
      required: r.required === true ? true : r.required === false ? false : r.required !== false,
      status: r.status || '',
      valid,
      _is_google_postmaster: google,
      google_ok: apiDomain?.google_ok === true,
      google_connected: apiDomain?.google_connected === true,
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

export type NettSmtpLimits = { daily_limit: number; monthly_limit: number };

/** Resolve limites do tenant (coluna própria → padrão da credencial → 0). 0 = sem limite. */
export async function resolveTenantSmtpLimits(tenantId: number): Promise<NettSmtpLimits> {
  await pool.query(`
    ALTER TABLE tenants
      ADD COLUMN IF NOT EXISTS email_smtp_daily_limit INTEGER DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS email_smtp_monthly_limit INTEGER DEFAULT NULL
  `).catch(() => {});
  await pool.query(`
    ALTER TABLE nettsistemasenvios_credentials
      ADD COLUMN IF NOT EXISTS default_daily_limit INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS default_monthly_limit INTEGER DEFAULT 0
  `).catch(() => {});

  const t = await pool.query(
    `SELECT email_smtp_daily_limit, email_smtp_monthly_limit FROM tenants WHERE id=$1`,
    [tenantId]
  );
  const row = t.rows[0] || {};
  let daily =
    row.email_smtp_daily_limit != null && row.email_smtp_daily_limit !== ''
      ? Number(row.email_smtp_daily_limit)
      : null;
  let monthly =
    row.email_smtp_monthly_limit != null && row.email_smtp_monthly_limit !== ''
      ? Number(row.email_smtp_monthly_limit)
      : null;

  if (daily == null || monthly == null) {
    const c = await pool.query(
      `SELECT default_daily_limit, default_monthly_limit
       FROM nettsistemasenvios_credentials WHERE is_active=TRUE ORDER BY id DESC LIMIT 1`
    );
    const cred = c.rows[0] || {};
    if (daily == null) daily = Number(cred.default_daily_limit ?? 0);
    if (monthly == null) monthly = Number(cred.default_monthly_limit ?? 0);
  }

  return {
    daily_limit: Number.isFinite(daily as number) ? Math.max(0, Number(daily)) : 0,
    monthly_limit: Number.isFinite(monthly as number) ? Math.max(0, Number(monthly)) : 0,
  };
}

/**
 * Cria/atualiza o cliente SMTP no painel externo com daily_limit e monthly_limit.
 * POST /v1/users (fallback PUT /v1/users/:username).
 */
export async function upsertNettEnviosUser(opts: {
  tenantId: number;
  username?: string;
  daily_limit?: number;
  monthly_limit?: number;
  domain?: string;
}): Promise<any> {
  const limits =
    opts.daily_limit != null && opts.monthly_limit != null
      ? { daily_limit: opts.daily_limit, monthly_limit: opts.monthly_limit }
      : await resolveTenantSmtpLimits(opts.tenantId);

  const smtpName = buildNettEnviosSmtpName(opts.tenantId);
  const username =
    String(opts.username || '').trim() ||
    (opts.domain ? `tenant${opts.tenantId}@${String(opts.domain).trim().toLowerCase()}` : `tenant${opts.tenantId}`);

  const body = {
    username,
    tenant: String(opts.tenantId),
    tenant_id: Number(opts.tenantId),
    smtp_name: smtpName,
    name: smtpName,
    daily_limit: limits.daily_limit,
    monthly_limit: limits.monthly_limit,
  };

  console.log('[nett-smtp] upsert user limits:', body);

  try {
    return await apiFetch('/v1/users', { method: 'POST', body });
  } catch (e1: any) {
    try {
      return await apiFetch(`/v1/users/${encodeURIComponent(username)}`, { method: 'PUT', body });
    } catch (e2: any) {
      try {
        return await apiFetch(`/v1/users/${encodeURIComponent(username)}`, { method: 'PATCH', body });
      } catch (e3: any) {
        const msg = e3?.message || e2?.message || e1?.message || 'falha ao sincronizar usuário SMTP';
        console.warn('[nett-smtp] upsert user falhou:', msg);
        throw new Error(msg);
      }
    }
  }
}

/** Notifica o tenant (popup) e pausa campanhas de e-mail em envio ao bater limite SMTP. */
export async function handleSmtpLimitReached(ev: {
  tenant?: string | number;
  username?: string;
  limit_type?: string;
  limit?: number;
  sent?: number;
  reason?: string;
  email?: string;
  domainId?: number;
}): Promise<void> {
  let tenantId = Number(ev.tenant || 0) || 0;

  if (!tenantId && ev.domainId) {
    const d = await pool.query(`SELECT tenant_id FROM email_marketing_domains WHERE id=$1`, [ev.domainId]);
    tenantId = Number(d.rows[0]?.tenant_id || 0) || 0;
  }

  if (!tenantId && ev.username) {
    const m = String(ev.username).match(/tenant(\d+)/i);
    if (m) tenantId = Number(m[1]) || 0;
  }

  if (!tenantId) {
    console.warn('[nett-smtp] limit_reached sem tenant identificável:', ev);
    return;
  }

  const limitType = String(ev.limit_type || '').toLowerCase() === 'monthly' ? 'monthly' : 'daily';
  const label = limitType === 'monthly' ? 'mensal' : 'diário';
  const limit = Number(ev.limit || 0);
  const sent = Number(ev.sent || 0);
  const reason = String(ev.reason || '').trim();

  const title = `Limite ${label} de e-mail atingido`;
  const message =
    `Seu limite ${label} de envio de e-mail foi atingido` +
    (limit > 0 ? ` (${sent || limit}/${limit})` : '') +
    (reason ? `. Motivo: ${reason}` : '.') +
    ` As campanhas em andamento foram pausadas. Ajuste o limite com o suporte ou aguarde a renovação do período.`;

  // Evita spam: 1 alerta por tipo a cada 6h
  const dup = await pool.query(
    `SELECT id FROM admin_notifications
     WHERE is_active = TRUE AND deleted_at IS NULL
       AND title = $1
       AND recipient_type = 'specific'
       AND recipient_list->'tenant_ids' @> to_jsonb($2::int)
       AND created_at > NOW() - INTERVAL '6 hours'
     LIMIT 1`,
    [title, tenantId]
  );

  if (!dup.rows[0]) {
    await pool.query(
      `INSERT INTO admin_notifications (
         title, message, type, link_url, link_text,
         recipient_type, recipient_list, is_active
       ) VALUES ($1,$2,'warning',$3,'Ver campanhas','specific',$4,TRUE)`,
      [
        title,
        message,
        '/email-marketing/campanhas',
        JSON.stringify({ tenant_ids: [tenantId] }),
      ]
    );
    console.log(`[nett-smtp] notificação limite ${label} → tenant ${tenantId}`);
  } else {
    console.log(`[nett-smtp] limite ${label} tenant ${tenantId} — notificação já enviada recentemente`);
  }

  const paused = await pool.query(
    `UPDATE email_marketing_campaigns
     SET status='paused', updated_at=NOW()
     WHERE tenant_id=$1 AND status='sending'
     RETURNING id`,
    [tenantId]
  );
  if (paused.rows.length) {
    console.log(
      `[nett-smtp] pausadas ${paused.rows.length} campanha(s) do tenant ${tenantId}:`,
      paused.rows.map((r: any) => r.id).join(',')
    );
  }
}
