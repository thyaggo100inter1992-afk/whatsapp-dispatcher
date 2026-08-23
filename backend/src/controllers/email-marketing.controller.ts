import { Request, Response } from 'express';
import { pool } from '../database/connection';
import multer from 'multer';
import csv from 'csv-parser';
import { Readable } from 'stream';
import * as dns from 'dns';
import { promisify } from 'util';
import { ensureEmailHtml, applyEmailVariables, generateProtocol, detectUsedEmailVars } from '../utils/email-html';
import {
  getActiveEmailMarketingProvider,
  setActiveEmailMarketingProvider,
  getMailgunApiClient,
  sendMarketingEmail,
  createSendGridDomain,
  validateSendGridDomain,
  getSendGridDomain,
  mapSendGridDnsRecords,
  ensureSendGridEventWebhook,
  EmailMarketingProviderName,
} from '../services/email-marketing-provider.service';

const resolveTxt  = promisify(dns.resolveTxt);
const resolveMx   = promisify(dns.resolveMx);
const resolveCname = promisify(dns.resolveCname);

/** Normaliza hostname do registro DNS (Mailgun às vezes manda só o prefixo) */
function dnsHost(name: string | undefined, domain: string): string {
  const n = String(name || domain || '').trim().replace(/\.$/, '');
  if (!n || n === '@') return domain;
  if (n.toLowerCase().endsWith(`.${domain.toLowerCase()}`) || n.toLowerCase() === domain.toLowerCase()) return n;
  if (n.includes('.')) return n;
  return `${n}.${domain}`;
}

/** Compara valores TXT de forma flexível (SPF ~all/-all, DMARC parcial, DKIM) */
function txtMatches(actual: string, expected: string, recName: string): boolean {
  const a = actual.toLowerCase().replace(/\s+/g, ' ').trim();
  const e = expected.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!a) return false;
  if (a === e) return true;
  if (e && a.includes(e.substring(0, Math.min(40, e.length)))) return true;

  // SPF: aceita Mailgun OU SendGrid
  if (e.includes('v=spf1') || a.includes('v=spf1')) {
    return a.includes('v=spf1') && (
      a.includes('include:mailgun.org') ||
      a.includes('include:sendgrid.net') ||
      a.includes('_spf.google.com') // tolerante
    );
  }
  // DKIM
  if ((recName || '').toLowerCase().includes('_domainkey')) {
    return a.includes('k=rsa') || a.includes('p=');
  }
  // DMARC: qualquer política DMARC válida no host
  if ((recName || '').toLowerCase().includes('_dmarc') || e.includes('v=dmarc1')) {
    return a.startsWith('v=dmarc1');
  }
  return false;
}

// Verifica o status real de cada registro DNS diretamente
async function checkDnsRecord(rec: any, domain: string): Promise<'valid' | 'unknown'> {
  try {
    const type = (rec.record_type || rec.type || '').toUpperCase();
    const name = dnsHost(rec.name, domain);
    const expectedValue = String(rec.value || '').trim();

    if (type === 'TXT') {
      const results = await resolveTxt(name);
      const flat = results.map((r: string[]) => r.join('').trim());
      return flat.some((v: string) => txtMatches(v, expectedValue, name)) ? 'valid' : 'unknown';
    }

    if (type === 'MX') {
      const results = await resolveMx(domain);
      const expected = expectedValue.toLowerCase().replace(/\.$/, '');
      const found = results.some((r: any) => {
        const ex = (r.exchange || '').toLowerCase().replace(/\.$/, '');
        return ex === expected ||
          (expected.includes('mailgun') && ex.includes('mailgun.org')) ||
          ex.includes('sendgrid.net');
      });
      return found ? 'valid' : 'unknown';
    }

    if (type === 'CNAME') {
      try {
        const result = await resolveCname(name);
        const resolved = (result[0] || result || '').toString().toLowerCase().replace(/\.$/, '');
        const expected = expectedValue.toLowerCase().replace(/\.$/, '');
        if (resolved === expected || resolved.endsWith('mailgun.org') || resolved.endsWith('sendgrid.net')) return 'valid';
      } catch {
        // Alguns provedores publicam CNAME como A/ALIAS — tenta TXT/resolve genérico
      }
      return 'unknown';
    }

    return 'unknown';
  } catch {
    return 'unknown';
  }
}

// Helper — Mailgun (mantido; usado quando provedor ativo = mailgun)
async function getMailgunClient() {
  return getMailgunApiClient();
}

function getTenantId(req: Request): number {
  return (req as any).tenant?.id || (req as any).user?.tenant_id || (req as any).tenantId;
}

function requireTenant(req: Request, res: Response): number | null {
  const tenantId = getTenantId(req);
  if (!tenantId) {
    res.status(400).json({ success: false, message: 'Tenant não identificado. Faça login novamente.' });
    return null;
  }
  return tenantId;
}

// Registra (ou atualiza) webhooks no Mailgun para um domínio
async function registerMailgunWebhooks(domain: string): Promise<void> {
  try {
    const mg = await getMailgunClient();
    const webhookUrl = 'https://api.sistemasnettsistemas.com.br/api/webhook/mailgun';

    const events = ['opened', 'clicked', 'delivered', 'bounced', 'complained', 'failed', 'unsubscribed'];

    // Tenta listar webhooks existentes
    let existing: any = {};
    try {
      const list = await (mg.webhooks as any).list(domain);
      existing = list?.webhooks || list || {};
    } catch { /* domínio pode não ter nenhum webhook ainda */ }

    for (const event of events) {
      const hasWebhook = existing[event]?.urls?.includes(webhookUrl) || existing[event]?.url === webhookUrl;
      if (hasWebhook) continue;

      try {
        // Se já existe webhook para o evento mas com URL errada, deleta primeiro
        if (existing[event]) {
          await (mg.webhooks as any).delete(domain, event).catch(() => {});
        }
        await (mg.webhooks as any).create(domain, event, webhookUrl);
        console.log(`[webhooks] Registrado ${event} para ${domain}`);
      } catch (e: any) {
        console.warn(`[webhooks] Falha ao registrar ${event} para ${domain}:`, e.message);
      }
    }
  } catch (e: any) {
    console.error('[webhooks] Erro ao registrar webhooks:', e.message);
  }
}

// =============================================
// DOMÍNIOS
// =============================================

export const getDomains = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const result = await pool.query(
      `SELECT id, domain, status, dns_records, is_active, created_at, updated_at, verified_at,
              provider, sendgrid_domain_id, inbound_enabled, inbound_status, inbound_dns_records
       FROM email_marketing_domains WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId]
    );
    const { buildInboundDnsRecords, checkInboundMxOnly } = require('../services/email-mailbox.service');
    // Garantir que DMARC + MX de recebimento sempre aparecem
    const rows = await Promise.all(result.rows.map(async (row: any) => {
      const dns: any[] = Array.isArray(row.dns_records) ? [...row.dns_records] : [];
      const hasDmarc = dns.some((r: any) => (r.name || '').startsWith('_dmarc.') || r._is_dmarc);
      if (!hasDmarc) {
        dns.push({
          record_type: 'TXT',
          name: `_dmarc.${row.domain}`,
          value: `v=DMARC1; p=none; rua=mailto:dmarc@${row.domain}`,
          valid: 'unknown',
          _is_dmarc: true
        });
      }
      let inboundDns: any[] = Array.isArray(row.inbound_dns_records) ? [...row.inbound_dns_records] : [];
      if (inboundDns.length === 0) {
        inboundDns = buildInboundDnsRecords(row.domain);
      }
      try {
        const mxCheck = await checkInboundMxOnly(row.domain);
        inboundDns = inboundDns.map((r: any) => ({
          ...r,
          _inbound: true,
          valid: mxCheck.ok ? 'valid' : 'unknown',
          mx_conflicts: mxCheck.conflicts,
          hint: mxCheck.hint,
        }));
      } catch {
        inboundDns = inboundDns.map((r: any) => ({ ...r, _inbound: true }));
      }
      // Exibe MX de recebimento junto com os demais (obrigatório)
      const withoutOldInbound = dns.filter((r: any) => !r._inbound);
      const mergedDns = [...inboundDns.map((r: any) => ({ ...r, _inbound: true })), ...withoutOldInbound];
      return {
        ...row,
        dns_records: mergedDns,
        inbound_dns_records: inboundDns,
        inbound_enabled: row.inbound_enabled !== false,
        inbound_status: inboundDns.every((r: any) => r.valid === 'valid') ? 'active' : (row.inbound_status || 'pending'),
      };
    }));
    res.json({ success: true, data: rows });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const addDomain = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const { domain } = req.body;
    if (!domain) return res.status(400).json({ success: false, message: 'Domínio obrigatório' });

    const requested = String(req.body?.provider || '').toLowerCase().trim();
    let provider: EmailMarketingProviderName;
    if (requested === 'nettsistemasenvios' || requested === 'nettsistemasenvios.com.br') {
      provider = 'nettsistemasenvios';
    } else if (requested === 'sendgrid' || requested === 'mailgun') {
      provider = requested as EmailMarketingProviderName;
    } else {
      provider = await getActiveEmailMarketingProvider();
    }

    // ========== nettsistemasenvios.com.br (SMTP externo) ==========
    if (provider === 'nettsistemasenvios') {
      const {
        createNettEnviosDomain,
        mapNettEnviosDnsRecords,
        nettEnviosCanSend,
        newWebhookToken,
        registerNettEnviosDomainWebhooks,
        ensureNettEnviosSmtpCredential,
        NETTSISTEMAS_ENVIOS_LABEL,
      } = require('../services/nettsistemasenvios.service');

      try {
        await ensureNettEnviosSmtpCredential('disparador');
      } catch (e: any) {
        console.warn('[addDomain] ensure smtp cred:', e?.message || e);
      }

      const apiDomain = await createNettEnviosDomain(domain);
      const dnsRecords = mapNettEnviosDnsRecords(apiDomain);
      const externalId = String(apiDomain?.id || apiDomain?.domain_id || '');
      const token = newWebhookToken();
      const canSend = nettEnviosCanSend(apiDomain);
      const status = canSend ? 'active' : 'pending';

      const result = await pool.query(
        `INSERT INTO email_marketing_domains
           (tenant_id, domain, mailgun_domain_id, sendgrid_domain_id, external_domain_id, smtp_login, smtp_password,
            status, dns_records, provider, webhook_token, inbound_enabled, inbound_status)
         VALUES ($1, $2, NULL, NULL, $3, $4, '', $5, $6, 'nettsistemasenvios', $7, TRUE, $8)
         ON CONFLICT (tenant_id, domain) DO UPDATE SET
           status=$5,
           dns_records=$6,
           external_domain_id=$3,
           provider='nettsistemasenvios',
           webhook_token=COALESCE(email_marketing_domains.webhook_token, $7),
           inbound_enabled=TRUE,
           inbound_status=$8,
           updated_at=NOW()
         RETURNING *`,
        [
          tenantId,
          String(domain).trim().toLowerCase(),
          externalId || null,
          `postmaster@${domain}`,
          status,
          JSON.stringify(dnsRecords),
          token,
          canSend ? 'active' : 'pending',
        ]
      );
      const row = result.rows[0];
      const whToken = row.webhook_token || token;
      try {
        await registerNettEnviosDomainWebhooks(Number(row.id), whToken);
      } catch (e: any) {
        console.warn('[addDomain] webhook por domínio:', e?.message || e);
      }
      return res.json({
        success: true,
        data: row,
        dns_records: dnsRecords,
        provider: 'nettsistemasenvios',
        provider_label: NETTSISTEMAS_ENVIOS_LABEL,
      });
    }

    // ========== SENDGRID ==========
    if (provider === 'sendgrid') {
      const sgDomain = await createSendGridDomain(domain);
      const dnsRecords = mapSendGridDnsRecords(sgDomain, domain);
      const sgId = String(sgDomain.id || '');
      const { buildInboundDnsRecords, ensureSendGridInboundParse } = require('../services/email-mailbox.service');
      const inboundDns = buildInboundDnsRecords(domain);
      try {
        await ensureSendGridInboundParse(domain);
      } catch (e: any) {
        console.warn('[addDomain] inbound parse:', e.message);
      }
      const result = await pool.query(
        `INSERT INTO email_marketing_domains
           (tenant_id, domain, mailgun_domain_id, sendgrid_domain_id, smtp_login, smtp_password, status, dns_records, provider,
            inbound_enabled, inbound_status, inbound_dns_records)
         VALUES ($1, $2, NULL, $3, $4, '', 'pending', $5, 'sendgrid', TRUE, 'pending', $6)
         ON CONFLICT (tenant_id, domain) DO UPDATE SET
           status='pending',
           dns_records=$5,
           sendgrid_domain_id=$3,
           provider='sendgrid',
           inbound_enabled=TRUE,
           inbound_dns_records=COALESCE(email_marketing_domains.inbound_dns_records, $6),
           updated_at=NOW()
         RETURNING *`,
        [tenantId, domain, sgId, `postmaster@${domain}`, JSON.stringify(dnsRecords), JSON.stringify(inboundDns)]
      );
      ensureSendGridEventWebhook().catch(() => {});
      const row = result.rows[0];
      // Resposta já com MX de recebimento misturado na lista
      const merged = {
        ...row,
        dns_records: [...inboundDns, ...(Array.isArray(row.dns_records) ? row.dns_records : [])],
      };
      return res.json({ success: true, data: merged, dns_records: merged.dns_records, provider: 'sendgrid' });
    }

    // ========== MAILGUN (legado) ==========
    const mg = await getMailgunClient();
    let mgDomain: any;

    try {
      mgDomain = await mg.domains.create({ name: domain }) as any;
    } catch (createError: any) {
      const details = (createError.details || '').toLowerCase();
      const msg = (createError.message || '').toLowerCase();
      const alreadyExists = createError.status === 400 &&
        (details.includes('already exists') || details.includes('already been registered') ||
         msg.includes('already exists') || msg.includes('already been registered'));
      if (!alreadyExists) throw createError;
      mgDomain = await mg.domains.get(domain) as any;
    }

    const dnsRecords = (mgDomain.receiving_dns_records || []).concat(mgDomain.sending_dns_records || []);
    const dmarcRecord = {
      record_type: 'TXT',
      name: `_dmarc.${domain}`,
      value: `v=DMARC1; p=none; rua=mailto:dmarc@${domain}`,
      valid: 'unknown',
      _is_dmarc: true
    };
    const hasDmarc = dnsRecords.some((r: any) => (r.name || '').startsWith('_dmarc.'));
    if (!hasDmarc) dnsRecords.push(dmarcRecord);

    const result = await pool.query(
      `INSERT INTO email_marketing_domains
         (tenant_id, domain, mailgun_domain_id, smtp_login, smtp_password, status, dns_records, provider)
       VALUES ($1, $2, $3, $4, $5, 'pending', $6, 'mailgun')
       ON CONFLICT (tenant_id, domain) DO UPDATE SET status='pending', dns_records=$6, provider='mailgun', updated_at=NOW()
       RETURNING *`,
      [tenantId, domain, mgDomain.id || mgDomain.domain || domain, mgDomain.smtp_login || `postmaster@${domain}`, mgDomain.smtp_password || '', JSON.stringify(dnsRecords)]
    );

    registerMailgunWebhooks(domain).catch(() => {});

    res.json({ success: true, data: result.rows[0], dns_records: dnsRecords, provider: 'mailgun' });
  } catch (error: any) {
    console.error('[email-marketing] addDomain error:', error.message, error.status);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const verifyDomain = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const { id } = req.params;

    const domainRow = await pool.query(
      `SELECT * FROM email_marketing_domains WHERE id=$1 AND tenant_id=$2`,
      [id, tenantId]
    );
    if (!domainRow.rows[0]) return res.status(404).json({ success: false, message: 'Domínio não encontrado' });

    const domainName = domainRow.rows[0].domain;
    const domainProvider = String(domainRow.rows[0].provider || 'mailgun').toLowerCase();

    // ========== nettsistemasenvios.com.br ==========
    if (domainProvider === 'nettsistemasenvios' || domainProvider === 'nettsistemasenvios.com.br') {
      const {
        verifyNettEnviosDomain,
        getNettEnviosDomain,
        getNettEnviosDomainByName,
        mapNettEnviosDnsRecords,
        nettEnviosCanSend,
        registerNettEnviosDomainWebhooks,
        newWebhookToken,
      } = require('../services/nettsistemasenvios.service');

      let externalId = domainRow.rows[0].external_domain_id;
      let apiDomain: any = null;
      try {
        if (externalId) {
          try {
            apiDomain = await verifyNettEnviosDomain(externalId);
          } catch {
            apiDomain = await getNettEnviosDomain(externalId);
          }
        } else {
          apiDomain = await getNettEnviosDomainByName(domainName);
          externalId = String(apiDomain?.id || '');
        }
      } catch (e: any) {
        console.warn('[verify-domain] nettsistemasenvios:', e?.message || e);
      }

      let dnsRecords = mapNettEnviosDnsRecords(apiDomain || {});
      if (!dnsRecords.length && Array.isArray(domainRow.rows[0].dns_records)) {
        dnsRecords = domainRow.rows[0].dns_records;
      }
      const canSend = nettEnviosCanSend(apiDomain) || dnsRecords.some((r: any) => r.valid === 'valid');
      // Checagem DNS local complementar
      const checkedDns = await Promise.all(
        dnsRecords.map(async (rec: any) => ({
          ...rec,
          valid: rec.valid === 'valid' ? 'valid' : await checkDnsRecord(rec, domainName),
        }))
      );
      const allVerified = checkedDns.every((r: any) => r.valid === 'valid');
      const spfOk = checkedDns.some(
        (r: any) =>
          (r.record_type || r.type || '').toUpperCase() === 'TXT' &&
          String(r.value || '').toLowerCase().includes('v=spf1') &&
          r.valid === 'valid'
      );
      const dkimOk = checkedDns.some(
        (r: any) =>
          (r.record_type || r.type || '').toUpperCase() === 'TXT' &&
          String(r.name || r.host || '').toLowerCase().includes('_domainkey') &&
          r.valid === 'valid'
      );
      const ready = canSend || (spfOk && dkimOk);
      const newStatus = ready ? 'active' : 'unverified';
      let token = domainRow.rows[0].webhook_token;
      if (!token) {
        token = newWebhookToken();
      }
      await pool.query(
        `UPDATE email_marketing_domains SET
           status=$1, dns_records=$2, external_domain_id=COALESCE(NULLIF($3,''), external_domain_id),
           webhook_token=$4,
           inbound_status=$5,
           verified_at=${ready ? 'NOW()' : 'NULL'},
           updated_at=NOW()
         WHERE id=$6`,
        [newStatus, JSON.stringify(checkedDns), externalId || '', token, ready ? 'active' : 'pending', id]
      );
      if (ready) {
        try {
          await registerNettEnviosDomainWebhooks(Number(id), token);
        } catch (e: any) {
          console.warn('[verify-domain] webhook domínio:', e?.message || e);
        }
      }
      const updated = await pool.query(`SELECT * FROM email_marketing_domains WHERE id=$1`, [id]);
      return res.json({
        success: true,
        verified: ready,
        allVerified,
        status: newStatus,
        data: updated.rows[0],
        dns_records: checkedDns,
        provider: 'nettsistemasenvios',
      });
    }

    // ========== SENDGRID ==========
    if (domainProvider === 'sendgrid') {
      let sendgridActive = false;
      let storedDns: any[] = Array.isArray(domainRow.rows[0].dns_records)
        ? [...domainRow.rows[0].dns_records]
        : [];
      const sgId = domainRow.rows[0].sendgrid_domain_id;
      try {
        if (sgId) {
          const validation = await validateSendGridDomain(sgId);
          sendgridActive = !!(validation?.valid === true || validation?.validation_results);
          // validation_results tem mail_cname, dkim1, dkim2 etc.
          const results = validation?.validation_results || {};
          storedDns = storedDns.map((rec: any) => {
            const key = rec._sendgrid_key;
            if (key && results[key]) {
              const ok = results[key].valid === true;
              return { ...rec, valid: ok ? 'valid' : 'unknown' };
            }
            return rec;
          });
          const fresh = await getSendGridDomain(sgId);
          if (fresh?.dns) {
            storedDns = mapSendGridDnsRecords(fresh, domainName).map((rec: any) => {
              const prev = storedDns.find((p: any) => p._sendgrid_key === rec._sendgrid_key);
              return { ...rec, valid: prev?.valid || rec.valid };
            });
          }
          // Se API diz valid no domínio
          if (fresh?.valid === true) sendgridActive = true;
          if (validation?.valid === true) sendgridActive = true;
        }
      } catch (e: any) {
        console.warn(`[verify-domain] SendGrid validate falhou:`, e?.message || e);
      }

      let checkedDns = await Promise.all(
        storedDns.map(async (rec: any) => ({
          ...rec,
          valid: rec.valid === 'valid' ? 'valid' : await checkDnsRecord(rec, domainName),
        }))
      );

      const essentialOk = checkedDns
        .filter((r: any) => !r._is_dmarc && !r._inbound)
        .every((r: any) => r.valid === 'valid') || sendgridActive;
      const canSend = sendgridActive || essentialOk;
      const newStatus = canSend ? 'active' : 'unverified';

      // MX de recebimento (caixa) — obrigatório e exclusivo (sem Mailgun/outro MX)
      const {
        buildInboundDnsRecords,
        ensureSendGridInboundParse,
        checkInboundMxOnly,
      } = require('../services/email-mailbox.service');
      try { await ensureSendGridInboundParse(domainName); } catch (e: any) {
        console.warn('[verify-domain] inbound parse:', e?.message || e);
      }
      let inboundDns: any[] = Array.isArray(domainRow.rows[0].inbound_dns_records) && domainRow.rows[0].inbound_dns_records.length
        ? [...domainRow.rows[0].inbound_dns_records]
        : buildInboundDnsRecords(domainName);
      const inboundMx = await checkInboundMxOnly(domainName);
      inboundDns = inboundDns.map((rec: any) => ({
        ...rec,
        _inbound: true,
        valid: inboundMx.ok ? 'valid' : 'unknown',
        mx_conflicts: inboundMx.conflicts,
        hint: inboundMx.hint,
      }));
      const inboundOk = inboundMx.ok;
      const inboundStatus = inboundOk ? 'active' : 'pending';

      await pool.query(
        `UPDATE email_marketing_domains SET
           status=$1, dns_records=$3,
           verified_at=${canSend ? 'NOW()' : 'NULL'},
           inbound_enabled=TRUE,
           inbound_status=$4,
           inbound_dns_records=$5,
           updated_at=NOW()
         WHERE id=$2`,
        [newStatus, id, JSON.stringify(checkedDns), inboundStatus, JSON.stringify(inboundDns)]
      );
      if (canSend) ensureSendGridEventWebhook().catch(() => {});
      const updated = await pool.query(`SELECT * FROM email_marketing_domains WHERE id=$1`, [id]);
      const data = {
        ...updated.rows[0],
        dns_records: [...inboundDns, ...checkedDns.filter((r: any) => !r._inbound)],
      };
      const allVerified = checkedDns.every((r: any) => r.valid === 'valid') && inboundOk;
      const inboundMsg = inboundMx.conflicts?.length
        ? ` Remova os MX conflitantes: ${inboundMx.conflicts.join(', ')}.`
        : '';
      return res.json({
        success: true,
        verified: canSend,
        allVerified,
        inboundOk,
        sendgridActive,
        provider: 'sendgrid',
        status: newStatus,
        message: canSend
          ? (allVerified
            ? 'Domínio pronto para envio e recebimento.'
            : inboundOk
              ? 'Domínio pronto para envio. Alguns registros ainda pendentes.'
              : `Domínio pronto para envio. Configure o MX de recebimento (só mx.sendgrid.net).${inboundMsg}`)
          : 'Ainda não foi possível confirmar DNS do SendGrid. Verifique CNAME/DKIM e tente de novo.',
        data,
      });
    }

    // ========== MAILGUN (legado) ==========
    // 1) Pergunta ao Mailgun (fonte da verdade para envio)
    let mailgunActive = false;
    let mgDns: any[] = [];
    try {
      const mg = await getMailgunClient();
      try { await mg.domains.verify(domainName); } catch { /* ok */ }
      const mgDomain: any = await mg.domains.get(domainName);
      const state = String(mgDomain?.domain?.state || mgDomain?.state || '').toLowerCase();
      mailgunActive = state === 'active';
      mgDns = []
        .concat(mgDomain?.receiving_dns_records || mgDomain?.domain?.receiving_dns_records || [])
        .concat(mgDomain?.sending_dns_records || mgDomain?.domain?.sending_dns_records || []);
      console.log(`[verify-domain] ${domainName} mailgun state=${state} active=${mailgunActive}`);
    } catch (e: any) {
      console.warn(`[verify-domain] Mailgun get/verify falhou:`, e?.message || e);
    }

    // 2) Monta lista de registros (prioriza os do Mailgun se vierem atualizados)
    let storedDns: any[] = Array.isArray(domainRow.rows[0].dns_records) ? [...domainRow.rows[0].dns_records] : [];
    if (mgDns.length > 0) {
      // Mantém flags valid locais quando possível; atualiza value/name do provedor
      const byKey = (r: any) =>
        `${(r.record_type || r.type || '').toUpperCase()}|${(r.name || '').toLowerCase()}|${String(r.value || '').slice(0, 30).toLowerCase()}`;
      const map = new Map(storedDns.map((r: any) => [byKey(r), r]));
      storedDns = mgDns.map((r: any) => {
        const prev = map.get(byKey(r));
        return { ...r, valid: prev?.valid || r.valid || 'unknown' };
      });
    }

    const hasDmarc = storedDns.some((r: any) => (r.name || '').toLowerCase().includes('_dmarc'));
    if (!hasDmarc) {
      storedDns.push({
        record_type: 'TXT',
        name: `_dmarc.${domainName}`,
        value: `v=DMARC1; p=none; rua=mailto:dmarc@${domainName}`,
        valid: 'unknown',
        _is_dmarc: true
      });
    }

    // 3) Checagem DNS local (flexível)
    let checkedDns = await Promise.all(
      storedDns.map(async (rec: any) => ({
        ...rec,
        valid: await checkDnsRecord(rec, domainName)
      }))
    );

    // Se Mailgun já marcou o registro como valid no payload, respeita
    checkedDns = checkedDns.map((rec: any) => {
      const fromMg = mgDns.find((m: any) =>
        String(m.name || '').toLowerCase() === String(rec.name || '').toLowerCase() &&
        String(m.record_type || m.type || '').toUpperCase() === String(rec.record_type || rec.type || '').toUpperCase()
      );
      if (fromMg && String(fromMg.valid || '').toLowerCase() === 'valid') {
        return { ...rec, valid: 'valid' };
      }
      return rec;
    });

    // Se o Mailgun confirma domínio ativo, marca SPF/DKIM essenciais como válidos
    if (mailgunActive) {
      checkedDns = checkedDns.map((r: any) => {
        const type = (r.record_type || r.type || '').toUpperCase();
        const n = (r.name || '').toLowerCase();
        const v = String(r.value || '').toLowerCase();
        const isSpf = type === 'TXT' && v.includes('v=spf1');
        const isDkim = type === 'TXT' && (n.includes('_domainkey') || v.includes('k=rsa'));
        const isMx = type === 'MX';
        if (isSpf || isDkim || isMx) return { ...r, valid: 'valid' };
        return r;
      });
    }

    const spfOk = checkedDns.some((r: any) =>
      (r.record_type || r.type || '').toUpperCase() === 'TXT' &&
      String(r.value || '').toLowerCase().includes('v=spf1') &&
      r.valid === 'valid'
    ) || checkedDns.some((r: any) =>
      (r.record_type || r.type || '').toUpperCase() === 'TXT' &&
      !(r.name || '').toLowerCase().includes('_domainkey') &&
      !(r.name || '').toLowerCase().includes('_dmarc') &&
      r.valid === 'valid'
    );
    const dkimOk = checkedDns.some((r: any) =>
      (r.record_type || r.type || '').toUpperCase() === 'TXT' &&
      (r.name || '').toLowerCase().includes('_domainkey') &&
      r.valid === 'valid'
    );
    const allVerified = checkedDns.every((r: any) => r.valid === 'valid');
    const canSend = mailgunActive || (spfOk && dkimOk);
    const newStatus = canSend ? (allVerified ? 'active' : 'active') : 'unverified';

    const dnsToSave = JSON.stringify(checkedDns);
    await pool.query(
      `UPDATE email_marketing_domains SET status=$1, dns_records=$3, verified_at=${canSend ? 'NOW()' : 'NULL'}, updated_at=NOW() WHERE id=$2`,
      [newStatus, id, dnsToSave]
    );

    if (canSend) {
      registerMailgunWebhooks(domainName).catch(() => {});
    }

    const updated = await pool.query(`SELECT * FROM email_marketing_domains WHERE id=$1`, [id]);
    res.json({
      success: true,
      verified: canSend,
      allVerified,
      mailgunActive,
      status: newStatus,
      message: canSend
        ? (allVerified
          ? 'Domínio verificado (todos os registros OK).'
          : 'Domínio pronto para envio (Mailgun/SPF+DKIM OK). CNAME/DMARC podem ficar pendentes.')
        : 'Ainda não foi possível confirmar SPF/DKIM. Clique em Verificar novamente em alguns minutos.',
      data: updated.rows[0]
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const registerDomainWebhooks = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const { id } = req.params;
    const row = await pool.query(
      `SELECT domain, provider FROM email_marketing_domains WHERE id=$1 AND tenant_id=$2`,
      [id, tenantId]
    );
    if (!row.rows[0]) return res.status(404).json({ success: false, message: 'Domínio não encontrado' });

    if (String(row.rows[0].provider || '') === 'sendgrid') {
      await ensureSendGridEventWebhook();
      return res.json({ success: true, message: 'Webhook SendGrid registrado/atualizado', provider: 'sendgrid' });
    }

    await registerMailgunWebhooks(row.rows[0].domain);
    res.json({ success: true, message: 'Webhooks Mailgun registrados com sucesso', provider: 'mailgun' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteDomain = async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const { id } = req.params;

    const domainRow = await client.query(
      `SELECT id, domain FROM email_marketing_domains WHERE id=$1 AND tenant_id=$2`,
      [id, tenantId]
    );
    if (!domainRow.rows[0]) {
      return res.status(404).json({ success: false, message: 'Domínio não encontrado' });
    }

    await client.query('BEGIN');
    // Campanhas e envios únicos podem referenciar o domínio — desvincula antes de excluir
    await client.query(
      `UPDATE email_marketing_campaigns SET domain_id=NULL WHERE domain_id=$1 AND tenant_id=$2`,
      [id, tenantId]
    );
    await client.query(
      `UPDATE email_marketing_single_sends SET domain_id=NULL WHERE domain_id=$1 AND tenant_id=$2`,
      [id, tenantId]
    );
    const deleted = await client.query(
      `DELETE FROM email_marketing_domains WHERE id=$1 AND tenant_id=$2 RETURNING id`,
      [id, tenantId]
    );
    await client.query('COMMIT');

    if (!deleted.rows[0]) {
      return res.status(404).json({ success: false, message: 'Domínio não encontrado' });
    }
    res.json({ success: true, message: `Domínio ${domainRow.rows[0].domain} removido.` });
  } catch (error: any) {
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    const msg = String(error?.message || '');
    if (msg.includes('foreign key') || error?.code === '23503') {
      return res.status(409).json({
        success: false,
        message: 'Não foi possível excluir: ainda há vínculos com este domínio. Tente novamente.',
      });
    }
    res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
};

// =============================================
// LISTAS DE CONTATOS
// =============================================

export const getLists = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const result = await pool.query(
      `SELECT * FROM email_marketing_lists WHERE tenant_id=$1 ORDER BY created_at DESC`,
      [tenantId]
    );
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createList = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Nome obrigatório' });
    const result = await pool.query(
      `INSERT INTO email_marketing_lists (tenant_id, name, description) VALUES ($1,$2,$3) RETURNING *`,
      [tenantId, name, description || null]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteList = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const { id } = req.params;
    await pool.query(`DELETE FROM email_marketing_lists WHERE id=$1 AND tenant_id=$2`, [id, tenantId]);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const importContacts = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const { list_id } = req.params;

    const listCheck = await pool.query(`SELECT id FROM email_marketing_lists WHERE id=$1 AND tenant_id=$2`, [list_id, tenantId]);
    if (!listCheck.rows[0]) return res.status(404).json({ success: false, message: 'Lista não encontrada' });

    const file = (req as any).file;
    if (!file) return res.status(400).json({ success: false, message: 'Arquivo CSV obrigatório' });

    const contacts: { email: string; name?: string; cpf?: string; phone?: string; var1?: string; var2?: string; var3?: string; var4?: string; var5?: string }[] = [];
    const rawText = file.buffer.toString('utf8').replace(/^\uFEFF/, '');
    const firstLine = (rawText.split(/\r?\n/).find((l: string) => l.trim()) || '');
    const semicolonCount = (firstLine.match(/;/g) || []).length;
    const commaCount = (firstLine.match(/,/g) || []).length;
    const separator = semicolonCount > commaCount ? ';' : ',';
    const stream = Readable.from(Buffer.from(rawText, 'utf8'));

    const pick = (row: any, keys: string[]) => {
      for (const k of keys) {
        const v = row[k] ?? row[k.toLowerCase()] ?? row[k.toUpperCase()];
        if (v != null && String(v).trim() !== '') return String(v).trim();
      }
      const map: Record<string, string> = {};
      for (const [key, val] of Object.entries(row || {})) {
        map[String(key).toLowerCase().trim()] = String(val ?? '').trim();
      }
      for (const k of keys) {
        const v = map[k.toLowerCase()];
        if (v) return v;
      }
      return '';
    };

    await new Promise<void>((resolve, reject) => {
      stream.pipe(csv({ separator }))
        .on('data', (row) => {
          const email = pick(row, ['email', 'e-mail', 'mail']);
          if (email && email.includes('@')) {
            contacts.push({
              email: email.toLowerCase(),
              name: pick(row, ['name', 'nome', 'nome_completo', 'cliente']) || undefined,
              cpf: pick(row, ['cpf', 'documento', 'doc']) || undefined,
              phone: pick(row, ['phone', 'telefone', 'celular', 'whatsapp', 'tel']) || undefined,
              var1: pick(row, ['var1', 'variavel1', 'variável1', 'variavel_1', 'campo1']) || undefined,
              var2: pick(row, ['var2', 'variavel2', 'variável2', 'variavel_2', 'campo2']) || undefined,
              var3: pick(row, ['var3', 'variavel3', 'variável3', 'variavel_3', 'campo3']) || undefined,
              var4: pick(row, ['var4', 'variavel4', 'variável4', 'variavel_4', 'campo4']) || undefined,
              var5: pick(row, ['var5', 'variavel5', 'variável5', 'variavel_5', 'campo5']) || undefined,
            });
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });

    // Remove e-mails clonados no próprio arquivo (mantém 1ª ocorrência)
    const uniqueContacts: typeof contacts = [];
    const seenEmail = new Set<string>();
    let duplicatesRemoved = 0;
    for (const c of contacts) {
      const email = String(c.email || '').toLowerCase();
      if (!email.includes('@')) continue;
      if (seenEmail.has(email)) {
        duplicatesRemoved += 1;
        continue;
      }
      seenEmail.add(email);
      uniqueContacts.push({ ...c, email });
    }

    let inserted = 0;
    for (const c of uniqueContacts) {
      try {
        const r = await pool.query(
          `INSERT INTO email_marketing_contacts (tenant_id, list_id, email, name, cpf, phone, var1, var2, var3, var4, var5)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           ON CONFLICT (list_id, email) DO UPDATE SET
             name = COALESCE(NULLIF(EXCLUDED.name, ''), email_marketing_contacts.name),
             cpf = COALESCE(NULLIF(EXCLUDED.cpf, ''), email_marketing_contacts.cpf),
             phone = COALESCE(NULLIF(EXCLUDED.phone, ''), email_marketing_contacts.phone),
             var1 = COALESCE(NULLIF(EXCLUDED.var1, ''), email_marketing_contacts.var1),
             var2 = COALESCE(NULLIF(EXCLUDED.var2, ''), email_marketing_contacts.var2),
             var3 = COALESCE(NULLIF(EXCLUDED.var3, ''), email_marketing_contacts.var3),
             var4 = COALESCE(NULLIF(EXCLUDED.var4, ''), email_marketing_contacts.var4),
             var5 = COALESCE(NULLIF(EXCLUDED.var5, ''), email_marketing_contacts.var5),
             updated_at = NOW()
           RETURNING id`,
          [
            tenantId, list_id, c.email, c.name || null, c.cpf || null, c.phone || null,
            c.var1 || null, c.var2 || null, c.var3 || null, c.var4 || null, c.var5 || null,
          ]
        );
        if (r.rowCount) inserted++;
      } catch (_) {}
    }

    await pool.query(`UPDATE email_marketing_lists SET total_contacts=(SELECT COUNT(*) FROM email_marketing_contacts WHERE list_id=$1), updated_at=NOW() WHERE id=$1`, [list_id]);

    res.json({
      success: true,
      imported: inserted,
      total: uniqueContacts.length,
      duplicates_removed: duplicatesRemoved,
      raw_total: contacts.length,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getContacts = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const { list_id } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    const total = await pool.query(`SELECT COUNT(*) FROM email_marketing_contacts WHERE list_id=$1 AND tenant_id=$2`, [list_id, tenantId]);
    const result = await pool.query(
      `SELECT id, email, name, cpf, phone, var1, var2, var3, var4, var5, status, created_at FROM email_marketing_contacts WHERE list_id=$1 AND tenant_id=$2 ORDER BY created_at DESC LIMIT $3 OFFSET $4`,
      [list_id, tenantId, limit, offset]
    );

    res.json({ success: true, data: result.rows, total: parseInt(total.rows[0].count), page, limit });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/** Adiciona um contato avulso à lista */
export const addListContact = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const { list_id } = req.params;
    const email = String(req.body.email || '').trim().toLowerCase();
    const name = req.body.name != null ? String(req.body.name).trim() : null;
    const cpf = req.body.cpf != null ? String(req.body.cpf).trim() : null;
    const phone = req.body.phone != null ? String(req.body.phone).trim() : null;
    const var1 = req.body.var1 != null ? String(req.body.var1).trim() : null;
    const var2 = req.body.var2 != null ? String(req.body.var2).trim() : null;
    const var3 = req.body.var3 != null ? String(req.body.var3).trim() : null;
    const var4 = req.body.var4 != null ? String(req.body.var4).trim() : null;
    const var5 = req.body.var5 != null ? String(req.body.var5).trim() : null;

    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, message: 'E-mail inválido' });
    }

    const listCheck = await pool.query(
      `SELECT id FROM email_marketing_lists WHERE id=$1 AND tenant_id=$2`,
      [list_id, tenantId]
    );
    if (!listCheck.rows[0]) {
      return res.status(404).json({ success: false, message: 'Lista não encontrada' });
    }

    const result = await pool.query(
      `INSERT INTO email_marketing_contacts (tenant_id, list_id, email, name, cpf, phone, var1, var2, var3, var4, var5)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (list_id, email) DO UPDATE SET
         name = COALESCE(NULLIF(EXCLUDED.name, ''), email_marketing_contacts.name),
         cpf = COALESCE(NULLIF(EXCLUDED.cpf, ''), email_marketing_contacts.cpf),
         phone = COALESCE(NULLIF(EXCLUDED.phone, ''), email_marketing_contacts.phone),
         var1 = COALESCE(NULLIF(EXCLUDED.var1, ''), email_marketing_contacts.var1),
         var2 = COALESCE(NULLIF(EXCLUDED.var2, ''), email_marketing_contacts.var2),
         var3 = COALESCE(NULLIF(EXCLUDED.var3, ''), email_marketing_contacts.var3),
         var4 = COALESCE(NULLIF(EXCLUDED.var4, ''), email_marketing_contacts.var4),
         var5 = COALESCE(NULLIF(EXCLUDED.var5, ''), email_marketing_contacts.var5),
         updated_at = NOW()
       RETURNING id, email, name, cpf, phone, var1, var2, var3, var4, var5, status, created_at`,
      [tenantId, list_id, email, name || null, cpf || null, phone || null, var1, var2, var3, var4, var5]
    );

    await pool.query(
      `UPDATE email_marketing_lists SET total_contacts=(SELECT COUNT(*) FROM email_marketing_contacts WHERE list_id=$1), updated_at=NOW() WHERE id=$1`,
      [list_id]
    );

    res.json({ success: true, data: result.rows[0], message: 'Contato adicionado' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// =============================================
// TEMPLATES
// =============================================

export const getTemplates = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const result = await pool.query(`SELECT * FROM email_marketing_templates WHERE tenant_id=$1 ORDER BY created_at DESC`, [tenantId]);
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createTemplate = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const { name, subject, subjects, body_html, body_text } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, message: 'Nome do template obrigatório' });
    }
    const subjectsArr: string[] = Array.isArray(subjects)
      ? subjects.map((s: string) => String(s || '').trim()).filter(Boolean)
      : (subject && String(subject).trim() ? [String(subject).trim()] : []);
    const subjectVal = subjectsArr[0] || '';

    let result;
    try {
      result = await pool.query(
        `INSERT INTO email_marketing_templates (tenant_id, name, subject, subjects, body_html, body_text)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [tenantId, String(name).trim(), subjectVal, JSON.stringify(subjectsArr), body_html || null, body_text || null]
      );
    } catch {
      result = await pool.query(
        `INSERT INTO email_marketing_templates (tenant_id, name, subject, body_html, body_text)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [tenantId, String(name).trim(), subjectVal, body_html || null, body_text || null]
      );
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateTemplate = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const { id } = req.params;
    const { name, subject, subjects, body_html, body_text } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, message: 'Nome do template obrigatório' });
    }
    const subjectsArr: string[] = Array.isArray(subjects)
      ? subjects.map((s: string) => String(s || '').trim()).filter(Boolean)
      : (subject && String(subject).trim() ? [String(subject).trim()] : []);
    const subjectVal = subjectsArr[0] || '';

    let result;
    try {
      result = await pool.query(
        `UPDATE email_marketing_templates
         SET name=$1, subject=$2, subjects=$3, body_html=$4, body_text=$5, updated_at=NOW()
         WHERE id=$6 AND tenant_id=$7 RETURNING *`,
        [String(name).trim(), subjectVal, JSON.stringify(subjectsArr), body_html || null, body_text || null, id, tenantId]
      );
    } catch {
      result = await pool.query(
        `UPDATE email_marketing_templates
         SET name=$1, subject=$2, body_html=$3, body_text=$4, updated_at=NOW()
         WHERE id=$5 AND tenant_id=$6 RETURNING *`,
        [String(name).trim(), subjectVal, body_html || null, body_text || null, id, tenantId]
      );
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteTemplate = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const { id } = req.params;
    await pool.query(`DELETE FROM email_marketing_templates WHERE id=$1 AND tenant_id=$2`, [id, tenantId]);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// =============================================
// CAMPANHAS
// =============================================

export const getCampaigns = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const result = await pool.query(
      `SELECT c.*, d.domain as domain_name, l.name as list_name, t.name as template_name
       FROM email_marketing_campaigns c
       LEFT JOIN email_marketing_domains d ON c.domain_id = d.id
       LEFT JOIN email_marketing_lists l ON c.list_id = l.id
       LEFT JOIN email_marketing_templates t ON c.template_id = t.id
       WHERE c.tenant_id=$1 ORDER BY c.created_at DESC`,
      [tenantId]
    );
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getCampaignById = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const { id } = req.params;
    const result = await pool.query(
      `SELECT c.*, d.domain as domain_name, l.name as list_name, t.name as template_name
       FROM email_marketing_campaigns c
       LEFT JOIN email_marketing_domains d ON c.domain_id = d.id
       LEFT JOIN email_marketing_lists l ON c.list_id = l.id
       LEFT JOIN email_marketing_templates t ON c.template_id = t.id
       WHERE c.id=$1 AND c.tenant_id=$2`,
      [id, tenantId]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Campanha não encontrada' });
    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createCampaign = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const {
      name, reply_to, domain_id, domain_ids, list_id, template_id, body_html, body_text,
      // Legado (compat)
      subject, from_name, from_email,
      // Novos campos avançados
      from_senders,    // [{ from_name, from_email }] — pode vir já expandido (usuario@dominio)
      subjects,        // ["Assunto A", "Assunto B"]
      recipients,      // [{ email, name?, cpf?, phone? }] — destinatários manuais/colar/CSV
      delay_seconds_min, delay_seconds_max,
      scheduled_at,
      work_start_time, work_end_time,
      pause_after, pause_duration_minutes,
      ignore_email_restrictions,
    } = req.body;

    const requestedDomainIds: number[] = Array.isArray(domain_ids) && domain_ids.length > 0
      ? domain_ids.map((id: any) => Number(id)).filter((id: number) => Number.isFinite(id) && id > 0)
      : (domain_id ? [Number(domain_id)] : []);

    if (requestedDomainIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Selecione ao menos um domínio verificado para envio' });
    }

    const domainsResult = await pool.query(
      `SELECT id, domain, status FROM email_marketing_domains
       WHERE tenant_id=$1 AND id = ANY($2::int[])`,
      [tenantId, requestedDomainIds]
    );
    if (domainsResult.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Nenhum domínio válido encontrado' });
    }
    const inactive = domainsResult.rows.filter((d: any) => d.status !== 'active');
    if (inactive.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Domínio(s) ainda não ativo(s): ${inactive.map((d: any) => d.domain).join(', ')}`,
      });
    }
    // Mantém a ordem pedida pelo front
    const domainById = new Map(domainsResult.rows.map((d: any) => [Number(d.id), String(d.domain)]));
    const orderedDomains = requestedDomainIds
      .map(id => ({ id, domain: domainById.get(id) }))
      .filter((d): d is { id: number; domain: string } => !!d.domain);
    if (orderedDomains.length === 0) {
      return res.status(400).json({ success: false, message: 'Nenhum domínio válido encontrado' });
    }
    const primaryDomainId = orderedDomains[0].id;
    const domainNames = orderedDomains.map(d => d.domain);

    // Normaliza remetentes: aceita array novo OU campos legados
    const rawSenders: { from_name: string; from_email: string }[] =
      Array.isArray(from_senders) && from_senders.length > 0
        ? from_senders
        : [{ from_name: from_name || '', from_email: from_email || '' }];

    // Sempre expande usuario × TODOS os domínios selecionados (rotação multi-domínio).
    // Se o front já mandar e-mail completo, usa só a parte local e reexpande.
    const sendersArr: { from_name: string; from_email: string }[] = [];
    const seenSender = new Set<string>();
    for (const s of rawSenders) {
      const raw = String(s.from_email || '').trim();
      const local = (raw.includes('@') ? raw.split('@')[0] : raw)
        .replace(/[^a-zA-Z0-9._+-]/g, '')
        .toLowerCase();
      if (!local) continue;
      const name = (s.from_name || '').trim();
      for (const dom of domainNames) {
        const full = `${local}@${dom}`;
        if (seenSender.has(full)) continue;
        seenSender.add(full);
        sendersArr.push({ from_name: name, from_email: full });
      }
    }

    // Normaliza assuntos: aceita array novo OU campo legado
    const subjectsArr: string[] =
      Array.isArray(subjects) && subjects.length > 0
        ? subjects
        : [subject || ''];

    if (!name || sendersArr.length === 0 || !sendersArr[0].from_email || subjectsArr.length === 0 || !subjectsArr[0]) {
      return res.status(400).json({ success: false, message: 'Nome, ao menos um remetente (parte antes do @) e ao menos um assunto são obrigatórios' });
    }

    const inlineRecipients: {
      email: string; name?: string | null; cpf?: string | null; phone?: string | null;
      var1?: string | null; var2?: string | null; var3?: string | null; var4?: string | null; var5?: string | null;
    }[] =
      Array.isArray(recipients)
        ? recipients
            .map((r: any) => ({
              email: String(r?.email || '').trim().toLowerCase(),
              name: r?.name ? String(r.name).trim() : (r?.nome ? String(r.nome).trim() : null),
              cpf: r?.cpf ? String(r.cpf).trim() : null,
              phone: r?.phone || r?.telefone
                ? String(r.phone || r.telefone).trim()
                : null,
              var1: r?.var1 || r?.variavel1 ? String(r.var1 || r.variavel1).trim() : null,
              var2: r?.var2 || r?.variavel2 ? String(r.var2 || r.variavel2).trim() : null,
              var3: r?.var3 || r?.variavel3 ? String(r.var3 || r.variavel3).trim() : null,
              var4: r?.var4 || r?.variavel4 ? String(r.var4 || r.variavel4).trim() : null,
              var5: r?.var5 || r?.variavel5 ? String(r.var5 || r.variavel5).trim() : null,
            }))
            .filter((r) => r.email.includes('@'))
        : [];

    // Dedup por e-mail
    const seen = new Set<string>();
    const uniqueInline = inlineRecipients.filter((r) => {
      if (seen.has(r.email)) return false;
      seen.add(r.email);
      return true;
    });

    const hasList = !!list_id;
    if (!hasList && uniqueInline.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Selecione uma lista de contatos ou adicione destinatários (manual / colar / CSV)',
      });
    }

    // Define status inicial: se agendado para o futuro -> 'scheduled', senão -> 'draft'
    const initStatus = scheduled_at && new Date(scheduled_at) > new Date() ? 'scheduled' : 'draft';
    const ignoreRestrictions = !!ignore_email_restrictions;

    let result;
    try {
      result = await pool.query(
      `INSERT INTO email_marketing_campaigns (
         tenant_id, name,
         subject, from_name, from_email,
         from_senders, subjects,
         reply_to, domain_id, domain_ids, list_id, template_id,
         body_html, body_text,
         delay_seconds, delay_seconds_min, delay_seconds_max,
         scheduled_at, work_start_time, work_end_time,
         pause_after, pause_duration_minutes,
         status, total_contacts, ignore_email_restrictions
       ) VALUES (
         $1,$2,
         $3,$4,$5,
         $6,$7,
         $8,$9,$10,$11,$12,
         $13,$14,
         $15,$16,$17,
         $18,$19,$20,
         $21,$22,
         $23,$24,$25
       ) RETURNING *`,
      [
        tenantId, name,
        subjectsArr[0], sendersArr[0].from_name, sendersArr[0].from_email,
        JSON.stringify(sendersArr), JSON.stringify(subjectsArr),
        reply_to || null, primaryDomainId, JSON.stringify(orderedDomains.map(d => d.id)),
        hasList ? list_id : null, template_id || null,
        body_html || null, body_text || null,
        delay_seconds_min || 1, delay_seconds_min || 1, delay_seconds_max || 3,
        scheduled_at || null, work_start_time || '08:00', work_end_time || '20:00',
        pause_after || 0, pause_duration_minutes || 30,
        initStatus,
        uniqueInline.length,
        ignoreRestrictions,
      ]
      );
    } catch (insertErr: any) {
      const msg = String(insertErr?.message || '');
      if (/ignore_email_restrictions/i.test(msg)) {
        // Coluna ainda não migrada — cria sem o flag
        result = await pool.query(
          `INSERT INTO email_marketing_campaigns (
             tenant_id, name,
             subject, from_name, from_email,
             from_senders, subjects,
             reply_to, domain_id, domain_ids, list_id, template_id,
             body_html, body_text,
             delay_seconds, delay_seconds_min, delay_seconds_max,
             scheduled_at, work_start_time, work_end_time,
             pause_after, pause_duration_minutes,
             status, total_contacts
           ) VALUES (
             $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24
           ) RETURNING *`,
          [
            tenantId, name,
            subjectsArr[0], sendersArr[0].from_name, sendersArr[0].from_email,
            JSON.stringify(sendersArr), JSON.stringify(subjectsArr),
            reply_to || null, primaryDomainId, JSON.stringify(orderedDomains.map(d => d.id)),
            hasList ? list_id : null, template_id || null,
            body_html || null, body_text || null,
            delay_seconds_min || 1, delay_seconds_min || 1, delay_seconds_max || 3,
            scheduled_at || null, work_start_time || '08:00', work_end_time || '20:00',
            pause_after || 0, pause_duration_minutes || 30,
            initStatus,
            uniqueInline.length,
          ]
        );
      } else if (!/domain_ids/i.test(msg)) {
        throw insertErr;
      } else {
      result = await pool.query(
        `INSERT INTO email_marketing_campaigns (
           tenant_id, name,
           subject, from_name, from_email,
           from_senders, subjects,
           reply_to, domain_id, list_id, template_id,
           body_html, body_text,
           delay_seconds, delay_seconds_min, delay_seconds_max,
           scheduled_at, work_start_time, work_end_time,
           pause_after, pause_duration_minutes,
           status, total_contacts
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23
         ) RETURNING *`,
        [
          tenantId, name,
          subjectsArr[0], sendersArr[0].from_name, sendersArr[0].from_email,
          JSON.stringify(sendersArr), JSON.stringify(subjectsArr),
          reply_to || null, primaryDomainId, hasList ? list_id : null, template_id || null,
          body_html || null, body_text || null,
          delay_seconds_min || 1, delay_seconds_min || 1, delay_seconds_max || 3,
          scheduled_at || null, work_start_time || '08:00', work_end_time || '20:00',
          pause_after || 0, pause_duration_minutes || 30,
          initStatus,
          uniqueInline.length,
        ]
      );
      }
    }

    const campaignId = result.rows[0].id;

    // Destinatários manuais/colar/CSV — já entram na fila da campanha
    for (const r of uniqueInline) {
      await pool.query(
        `INSERT INTO email_marketing_recipients (tenant_id, campaign_id, email, name, cpf, phone, var1, var2, var3, var4, var5)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (campaign_id, email) DO UPDATE SET
           name = COALESCE(NULLIF(EXCLUDED.name, ''), email_marketing_recipients.name),
           cpf = COALESCE(NULLIF(EXCLUDED.cpf, ''), email_marketing_recipients.cpf),
           phone = COALESCE(NULLIF(EXCLUDED.phone, ''), email_marketing_recipients.phone),
           var1 = COALESCE(NULLIF(EXCLUDED.var1, ''), email_marketing_recipients.var1),
           var2 = COALESCE(NULLIF(EXCLUDED.var2, ''), email_marketing_recipients.var2),
           var3 = COALESCE(NULLIF(EXCLUDED.var3, ''), email_marketing_recipients.var3),
           var4 = COALESCE(NULLIF(EXCLUDED.var4, ''), email_marketing_recipients.var4),
           var5 = COALESCE(NULLIF(EXCLUDED.var5, ''), email_marketing_recipients.var5),
           updated_at = NOW()`,
        [
          tenantId, campaignId, r.email, r.name || null, r.cpf || null, r.phone || null,
          r.var1 || null, r.var2 || null, r.var3 || null, r.var4 || null, r.var5 || null,
        ]
      );
    }

    if (uniqueInline.length > 0) {
      const total = await pool.query(
        `SELECT COUNT(*)::int as total FROM email_marketing_recipients WHERE campaign_id=$1`,
        [campaignId]
      );
      await pool.query(`UPDATE email_marketing_campaigns SET total_contacts=$1 WHERE id=$2`, [total.rows[0].total, campaignId]);
      result.rows[0].total_contacts = total.rows[0].total;
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const startCampaign = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const { id } = req.params;

    const campaign = await pool.query(`SELECT * FROM email_marketing_campaigns WHERE id=$1 AND tenant_id=$2`, [id, tenantId]);
    if (!campaign.rows[0]) return res.status(404).json({ success: false, message: 'Campanha não encontrada' });
    if (!['draft', 'paused', 'scheduled'].includes(campaign.rows[0].status)) {
      return res.status(400).json({ success: false, message: 'Campanha não pode ser iniciada no status atual' });
    }

    // Carrega contatos da lista (sem duplicar — unique em campaign_id+email)
    if (campaign.rows[0].list_id) {
      const contacts = await pool.query(
        `SELECT email, name, cpf, phone, var1, var2, var3, var4, var5 FROM email_marketing_contacts WHERE list_id=$1 AND tenant_id=$2 AND status='active'`,
        [campaign.rows[0].list_id, tenantId]
      );
      for (const c of contacts.rows) {
        await pool.query(
          `INSERT INTO email_marketing_recipients (tenant_id, campaign_id, email, name, cpf, phone, var1, var2, var3, var4, var5)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           ON CONFLICT (campaign_id, email) DO UPDATE SET
             name = COALESCE(NULLIF(EXCLUDED.name, ''), email_marketing_recipients.name),
             cpf = COALESCE(NULLIF(EXCLUDED.cpf, ''), email_marketing_recipients.cpf),
             phone = COALESCE(NULLIF(EXCLUDED.phone, ''), email_marketing_recipients.phone),
             var1 = COALESCE(NULLIF(EXCLUDED.var1, ''), email_marketing_recipients.var1),
             var2 = COALESCE(NULLIF(EXCLUDED.var2, ''), email_marketing_recipients.var2),
             var3 = COALESCE(NULLIF(EXCLUDED.var3, ''), email_marketing_recipients.var3),
             var4 = COALESCE(NULLIF(EXCLUDED.var4, ''), email_marketing_recipients.var4),
             var5 = COALESCE(NULLIF(EXCLUDED.var5, ''), email_marketing_recipients.var5),
             updated_at = NOW()`,
          [
            tenantId, id, c.email, c.name, c.cpf || null, c.phone || null,
            c.var1 || null, c.var2 || null, c.var3 || null, c.var4 || null, c.var5 || null,
          ]
        );
      }
    }

    const total = await pool.query(
      `SELECT COUNT(*)::int as total FROM email_marketing_recipients WHERE campaign_id=$1`,
      [id]
    );
    if (!total.rows[0].total) {
      return res.status(400).json({ success: false, message: 'Campanha sem destinatários. Adicione uma lista ou contatos manuais.' });
    }
    await pool.query(`UPDATE email_marketing_campaigns SET total_contacts=$1 WHERE id=$2`, [total.rows[0].total, id]);

    await pool.query(
      `UPDATE email_marketing_campaigns SET status='sending', started_at=NOW(), sent_in_session=0, pause_started_at=NULL, updated_at=NOW() WHERE id=$1`,
      [id]
    );

    res.json({ success: true, message: 'Campanha iniciada' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const pauseCampaign = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const { id } = req.params;
    await pool.query(`UPDATE email_marketing_campaigns SET status='paused', updated_at=NOW() WHERE id=$1 AND tenant_id=$2`, [id, tenantId]);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const cancelCampaign = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const { id } = req.params;
    await pool.query(`UPDATE email_marketing_campaigns SET status='cancelled', updated_at=NOW() WHERE id=$1 AND tenant_id=$2`, [id, tenantId]);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateCampaign = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const { id } = req.params;
    const {
      name, work_start_time, work_end_time,
      delay_seconds_min, delay_seconds_max,
      pause_after, pause_duration_minutes,
      scheduled_at,
      domain_id, from_senders, from_name, from_email,
      subjects, subject, reply_to,
      body_html, body_text,
    } = req.body;

    const sets: string[] = [];
    const vals: any[] = [];
    const push = (col: string, val: any) => { vals.push(val); sets.push(`${col}=$${vals.length}`); };

    if (name !== undefined) push('name', name);
    if (work_start_time !== undefined) push('work_start_time', work_start_time);
    if (work_end_time !== undefined) push('work_end_time', work_end_time);
    if (delay_seconds_min !== undefined) push('delay_seconds_min', Number(delay_seconds_min));
    if (delay_seconds_max !== undefined) push('delay_seconds_max', Number(delay_seconds_max));
    if (pause_after !== undefined) push('pause_after', Number(pause_after));
    if (pause_duration_minutes !== undefined) push('pause_duration_minutes', Number(pause_duration_minutes));
    if (scheduled_at !== undefined) push('scheduled_at', scheduled_at || null);
    if (reply_to !== undefined) push('reply_to', reply_to || null);
    if (body_html !== undefined) push('body_html', body_html || null);
    if (body_text !== undefined) push('body_text', body_text || null);

    // Domínio(s) + remetentes (sempre expande usuario × todos os domínios)
    let domainNames: string[] = [];

    const requestedDomainIds: number[] | null = Array.isArray((req.body as any).domain_ids)
      ? (req.body as any).domain_ids.map((x: any) => Number(x)).filter((n: number) => Number.isFinite(n) && n > 0)
      : null;

    if (requestedDomainIds && requestedDomainIds.length > 0) {
      const domainsResult = await pool.query(
        `SELECT id, domain, status FROM email_marketing_domains WHERE id = ANY($1::int[]) AND tenant_id=$2`,
        [requestedDomainIds, tenantId]
      );
      if (domainsResult.rows.length === 0) {
        return res.status(400).json({ success: false, message: 'Nenhum domínio válido encontrado' });
      }
      const inactive = domainsResult.rows.filter((d: any) => d.status !== 'active');
      if (inactive.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Domínio(s) ainda não ativo(s): ${inactive.map((d: any) => d.domain).join(', ')}`,
        });
      }
      const byId = new Map(domainsResult.rows.map((d: any) => [Number(d.id), String(d.domain)]));
      const ordered = requestedDomainIds
        .map(id => ({ id, domain: byId.get(id) }))
        .filter((d): d is { id: number; domain: string } => !!d.domain);
      domainNames = ordered.map(d => d.domain);
      push('domain_id', ordered[0].id);
      try {
        push('domain_ids', JSON.stringify(ordered.map(d => d.id)));
      } catch { /* coluna pode não existir em instâncias antigas */ }
    } else if (domain_id !== undefined) {
      if (!domain_id) {
        return res.status(400).json({ success: false, message: 'Selecione um domínio verificado' });
      }
      const domainRow = await pool.query(
        `SELECT domain FROM email_marketing_domains WHERE id=$1 AND tenant_id=$2`,
        [domain_id, tenantId]
      );
      if (!domainRow.rows[0]) {
        return res.status(400).json({ success: false, message: 'Domínio não encontrado' });
      }
      domainNames = [domainRow.rows[0].domain];
      push('domain_id', domain_id);
      try {
        push('domain_ids', JSON.stringify([Number(domain_id)]));
      } catch { /* ignore */ }
    } else if (from_senders !== undefined || from_email !== undefined) {
      // Usa domínios atuais da campanha
      const cur = await pool.query(
        `SELECT c.domain_id, c.domain_ids, d.domain
         FROM email_marketing_campaigns c
         LEFT JOIN email_marketing_domains d ON d.id = c.domain_id
         WHERE c.id=$1 AND c.tenant_id=$2`,
        [id, tenantId]
      );
      const row = cur.rows[0];
      let ids: number[] = [];
      try {
        const parsed = typeof row?.domain_ids === 'string' ? JSON.parse(row.domain_ids) : row?.domain_ids;
        if (Array.isArray(parsed)) ids = parsed.map((x: any) => Number(x)).filter((n: number) => n > 0);
      } catch { /* ignore */ }
      if (ids.length === 0 && row?.domain_id) ids = [Number(row.domain_id)];
      if (ids.length > 0) {
        const dres = await pool.query(
          `SELECT id, domain FROM email_marketing_domains WHERE id = ANY($1::int[])`,
          [ids]
        );
        const byId = new Map(dres.rows.map((d: any) => [Number(d.id), String(d.domain)]));
        domainNames = ids.map(i => byId.get(i)).filter(Boolean) as string[];
      } else if (row?.domain) {
        domainNames = [row.domain];
      }
    }

    if (from_senders !== undefined || from_email !== undefined) {
      if (domainNames.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Campanha sem domínio. Selecione ao menos um domínio verificado antes de alterar remetentes.',
        });
      }

      const rawSenders: { from_name: string; from_email: string }[] =
        Array.isArray(from_senders) && from_senders.length > 0
          ? from_senders
          : [{ from_name: from_name || '', from_email: from_email || '' }];

      const sendersArr: { from_name: string; from_email: string }[] = [];
      const seenSender = new Set<string>();
      for (const s of rawSenders) {
        const raw = String(s.from_email || '').trim();
        const local = (raw.includes('@') ? raw.split('@')[0] : raw)
          .replace(/[^a-zA-Z0-9._+-]/g, '')
          .toLowerCase();
        if (!local) continue;
        const name = (s.from_name || '').trim();
        for (const dom of domainNames) {
          const full = `${local}@${dom}`;
          if (seenSender.has(full)) continue;
          seenSender.add(full);
          sendersArr.push({ from_name: name, from_email: full });
        }
      }

      if (sendersArr.length === 0) {
        return res.status(400).json({ success: false, message: 'Informe ao menos um remetente válido (parte antes do @)' });
      }

      push('from_senders', JSON.stringify(sendersArr));
      push('from_name', sendersArr[0].from_name);
      push('from_email', sendersArr[0].from_email);
    }

    if (subjects !== undefined || subject !== undefined) {
      const subjectsArr: string[] =
        Array.isArray(subjects) && subjects.length > 0
          ? subjects.map((s: string) => String(s || '').trim()).filter(Boolean)
          : [String(subject || '').trim()].filter(Boolean);
      if (subjectsArr.length === 0) {
        return res.status(400).json({ success: false, message: 'Informe ao menos um assunto' });
      }
      push('subjects', JSON.stringify(subjectsArr));
      push('subject', subjectsArr[0]);
    }

    if (sets.length === 0) return res.status(400).json({ success: false, message: 'Nenhum campo para atualizar' });

    sets.push(`updated_at=NOW()`);
    vals.push(id, tenantId);
    await pool.query(
      `UPDATE email_marketing_campaigns SET ${sets.join(', ')} WHERE id=$${vals.length - 1} AND tenant_id=$${vals.length}`,
      vals
    );
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteCampaign = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const { id } = req.params;
    await pool.query(`DELETE FROM email_marketing_campaigns WHERE id=$1 AND tenant_id=$2 AND status IN ('draft','cancelled','completed')`, [id, tenantId]);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getCampaignStats = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const { id } = req.params;
    try {
      const result = await pool.query(
        `SELECT total_contacts, sent_count, failed_count, opened_count, clicked_count, bounced_count, complained_count, replied_count, status, started_at, completed_at
         FROM email_marketing_campaigns WHERE id=$1 AND tenant_id=$2`,
        [id, tenantId]
      );
      return res.json({ success: true, data: result.rows[0] });
    } catch (colErr: any) {
      if (!/replied_count/i.test(String(colErr?.message || ''))) throw colErr;
      const result = await pool.query(
        `SELECT total_contacts, sent_count, failed_count, opened_count, clicked_count, bounced_count, complained_count, status, started_at, completed_at
         FROM email_marketing_campaigns WHERE id=$1 AND tenant_id=$2`,
        [id, tenantId]
      );
      return res.json({ success: true, data: { ...result.rows[0], replied_count: 0 } });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getCampaignRecipients = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const { id } = req.params;
    const { status, limit = '500' } = req.query as { status?: string; limit?: string };

    const params: any[] = [id, tenantId];
    let whereExtra = '';
    if (status && status !== 'all') {
      params.push(status);
      whereExtra = ` AND r.status=$${params.length}`;
    }
    params.push(parseInt(limit, 10) || 500);

    try {
      const result = await pool.query(
        `SELECT id, email, name, cpf, phone, var1, var2, var3, var4, var5, protocol, status, error_message,
                sent_from_email, sent_domain, sent_at, opened_at, clicked_at, replied_at, updated_at
         FROM email_marketing_recipients r
         WHERE campaign_id=$1 AND tenant_id=$2${whereExtra}
         ORDER BY COALESCE(sent_at, updated_at, created_at) DESC NULLS LAST, id DESC
         LIMIT $${params.length}`,
        params
      );
      return res.json({ success: true, data: result.rows, total: result.rowCount });
    } catch (colErr: any) {
      const msg = String(colErr?.message || '');
      if (!/sent_domain|sent_from_email|replied_at/i.test(msg)) throw colErr;
      const result = await pool.query(
        `SELECT id, email, name, cpf, phone, var1, var2, var3, var4, var5, protocol, status, error_message,
                sent_from_email, sent_domain, sent_at, opened_at, clicked_at, updated_at
         FROM email_marketing_recipients r
         WHERE campaign_id=$1 AND tenant_id=$2${whereExtra}
         ORDER BY COALESCE(sent_at, updated_at, created_at) DESC NULLS LAST, id DESC
         LIMIT $${params.length}`,
        params
      ).catch(() => pool.query(
        `SELECT id, email, name, cpf, phone, var1, var2, var3, var4, var5, protocol, status, error_message, sent_at, opened_at, clicked_at, updated_at
         FROM email_marketing_recipients r
         WHERE campaign_id=$1 AND tenant_id=$2${whereExtra}
         ORDER BY COALESCE(sent_at, updated_at, created_at) DESC NULLS LAST, id DESC
         LIMIT $${params.length}`,
        params
      ));
      return res.json({ success: true, data: result.rows, total: result.rowCount });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/** Reenvia destinatários com status failed (volta para pending e retoma a campanha) */
export const resendFailed = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const { id } = req.params;

    const camp = await pool.query(
      `SELECT id, status, failed_count FROM email_marketing_campaigns WHERE id=$1 AND tenant_id=$2`,
      [id, tenantId]
    );
    if (!camp.rows[0]) {
      return res.status(404).json({ success: false, message: 'Campanha não encontrada' });
    }

    const reset = await pool.query(
      `UPDATE email_marketing_recipients
       SET status='pending', error_message=NULL, mailgun_message_id=NULL, sent_at=NULL, updated_at=NOW()
       WHERE campaign_id=$1 AND tenant_id=$2 AND status='failed'
       RETURNING id`,
      [id, tenantId]
    );

    const qtd = reset.rowCount || 0;
    if (qtd === 0) {
      return res.status(400).json({ success: false, message: 'Nenhum destinatário com falha para reenviar' });
    }

    await pool.query(
      `UPDATE email_marketing_campaigns
       SET status=CASE WHEN status IN ('completed','paused','failed','cancelled') THEN 'sending' ELSE status END,
           completed_at=NULL,
           pause_started_at=NULL,
           sent_in_session=0,
           updated_at=NOW()
       WHERE id=$1 AND tenant_id=$2`,
      [id, tenantId]
    );
    await recalculateCampaignCounters(Number(id));

    res.json({
      success: true,
      message: `${qtd} destinatário(s) com falha recolocados na fila para reenvio`,
      data: { requeued: qtd },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// =============================================
// ENVIO ÚNICO
// =============================================

export const sendSingle = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const { to_email, to_name, from_name, from_email, reply_to, subject, body_html, body_text, domain_id, ignore_email_restrictions } = req.body;
    if (!to_email || !from_email || !subject) {
      return res.status(400).json({ success: false, message: 'Destinatário, remetente e assunto obrigatórios' });
    }
    if (!domain_id) {
      return res.status(400).json({ success: false, message: 'Selecione um domínio verificado para envio' });
    }
    if (!from_name || !String(from_name).trim()) {
      return res.status(400).json({ success: false, message: 'Nome do remetente obrigatório' });
    }

    const toNorm = String(to_email).trim().toLowerCase();
    if (!ignore_email_restrictions) {
      try {
        const rest = await pool.query(
          `SELECT id, reason, source, created_at FROM email_marketing_restrictions
           WHERE tenant_id=$1 AND lower(email)=lower($2) LIMIT 1`,
          [tenantId, toNorm]
        );
        if (rest.rows[0]) {
          return res.status(409).json({
            success: false,
            code: 'EMAIL_RESTRICTED',
            message: 'Este e-mail está na lista de restrição (cancelou inscrição). Confirme se deseja enviar mesmo assim.',
            restriction: rest.rows[0],
          });
        }
      } catch (e: any) {
        if (!/email_marketing_restrictions|does not exist/i.test(String(e?.message || ''))) {
          console.warn('[send-single] checagem restrição:', e.message);
        }
      }
    }

    const domainRow = await pool.query(
      `SELECT id, domain, status FROM email_marketing_domains WHERE id=$1 AND tenant_id=$2`,
      [domain_id, tenantId]
    );
    if (!domainRow.rows[0]) {
      return res.status(400).json({ success: false, message: 'Domínio não encontrado neste tenant' });
    }
    if (domainRow.rows[0].status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Domínio ainda não está ativo/verificado. Verifique o DNS em Domínios antes de enviar.',
      });
    }

    const domain = domainRow.rows[0].domain as string;
    const local = String(from_email || '')
      .trim()
      .split('@')[0]
      .replace(/[^a-zA-Z0-9._+-]/g, '')
      .toLowerCase();
    if (!local) {
      return res.status(400).json({ success: false, message: 'Usuário do remetente inválido (use só a parte antes do @)' });
    }
    const finalFromEmail = `${local}@${domain}`;

    let html = body_html || null;
    let text = body_text || null;
    const recipName = (to_name && String(to_name).trim()) || to_email;

    const prepared = ensureEmailHtml(html, text);
    const used = detectUsedEmailVars(prepared.html, prepared.text, subject);
    const protocol = used.protocolo ? generateProtocol() : null;
    const recipVars = {
      nome: recipName,
      email: to_email,
      cpf: req.body.cpf || '',
      telefone: req.body.telefone || req.body.phone || '',
      phone: req.body.phone || req.body.telefone || '',
      var1: req.body.var1 || '',
      var2: req.body.var2 || '',
      var3: req.body.var3 || '',
      var4: req.body.var4 || '',
      var5: req.body.var5 || '',
      protocolo: protocol || '',
    };
    const finalHtml = applyEmailVariables(prepared.html, recipVars);
    const finalText = applyEmailVariables(prepared.text, recipVars, { escapeValues: false });
    const finalSubject = applyEmailVariables(subject, recipVars, { escapeValues: false });

    const userId = (req as any).user?.id || (req as any).tenant?.userId || null;
    const userName = (req as any).user?.name || (req as any).user?.username || null;
    const attendant = String(reply_to || '').trim() || null;
    const cpfVal = req.body.cpf || null;
    const phoneVal = req.body.telefone || req.body.phone || null;

    let singleId: number | null = null;
    try {
      const ins = await pool.query(
        `INSERT INTO email_marketing_single_sends
         (tenant_id, user_id, user_name, to_email, to_name, from_email, from_name, subject, domain_id,
          status, body_html, body_text, reply_to, cpf, phone, var1, var2, var3, var4, var5, protocol)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending',$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
         RETURNING id`,
        [
          tenantId, userId, userName, to_email, to_name || null, finalFromEmail, from_name || null, finalSubject, domain_id,
          body_html || null, finalText || null, attendant,
          cpfVal, phoneVal,
          req.body.var1 || null, req.body.var2 || null, req.body.var3 || null, req.body.var4 || null, req.body.var5 || null,
          protocol,
        ]
      );
      singleId = Number(ins.rows[0]?.id) || null;
    } catch {
      const ins = await pool.query(
        `INSERT INTO email_marketing_single_sends
         (tenant_id, user_id, user_name, to_email, to_name, from_email, from_name, subject, domain_id,
          status, body_html, body_text, reply_to)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending',$10,$11,$12)
         RETURNING id`,
        [
          tenantId, userId, userName, to_email, to_name || null, finalFromEmail, from_name || null, finalSubject, domain_id,
          body_html || null, finalText || null, attendant,
        ]
      );
      singleId = Number(ins.rows[0]?.id) || null;
    }

    try {
      const { buildInterceptReplyTo } = require('../utils/email-reply-token');
      const intercept = (attendant && singleId) ? buildInterceptReplyTo('s', singleId) : null;
      const sent = await sendMarketingEmail({
        domain,
        fromEmail: finalFromEmail,
        fromName: String(from_name).trim(),
        toEmail: to_email,
        toName: to_name,
        replyTo: intercept || attendant || finalFromEmail,
        subject: finalSubject,
        html: finalHtml,
        text: finalText,
        tenantId,
        singleSendId: singleId,
      });

      const msgId = sent.messageId || null;
      if (singleId) {
        try {
          await pool.query(
            `UPDATE email_marketing_single_sends
             SET mailgun_message_id=$1, provider_message_id=$1, status='sent', error_message=NULL, updated_at=NOW()
             WHERE id=$2`,
            [msgId, singleId]
          );
        } catch {
          await pool.query(
            `UPDATE email_marketing_single_sends
             SET mailgun_message_id=$1, status='sent', error_message=NULL, updated_at=NOW()
             WHERE id=$2`,
            [msgId, singleId]
          );
        }
      }

      res.json({ success: true, message_id: msgId, message: 'E-mail enviado com sucesso', from: finalFromEmail, provider: sent.provider });
    } catch (sendError: any) {
      const status = sendError?.status || sendError?.statusCode || sendError?.code;
      const msg = String(sendError?.message || 'Erro ao enviar');
      const friendly = (status === 403 || /forbidden/i.test(msg))
        ? `Envio bloqueado (Forbidden). Domínio: ${domain}. Remetente: ${finalFromEmail}. Verifique se o domínio está ativo no provedor.`
        : msg;
      if (singleId) {
        await pool.query(
          `UPDATE email_marketing_single_sends SET status='failed', error_message=$1, updated_at=NOW() WHERE id=$2`,
          [friendly.slice(0, 500), singleId]
        );
      }
      return res.status(status === 403 ? 400 : 500).json({ success: false, message: friendly });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/** Detalhe de um envio único (para editar/reenviar) */
export const getSingleSend = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const { id } = req.params;
    const result = await pool.query(
      `SELECT id, to_email, to_name, from_email, from_name, subject, domain_id, reply_to,
              body_html, body_text, status, error_message, mailgun_message_id, created_at, updated_at
       FROM email_marketing_single_sends
       WHERE id=$1 AND tenant_id=$2`,
      [id, tenantId]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Envio não encontrado' });
    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/** Reenvia (com edição opcional) um envio único que falhou */
export const resendSingleSend = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const { id } = req.params;

    const existing = await pool.query(
      `SELECT * FROM email_marketing_single_sends WHERE id=$1 AND tenant_id=$2`,
      [id, tenantId]
    );
    if (!existing.rows[0]) return res.status(404).json({ success: false, message: 'Envio não encontrado' });
    const row = existing.rows[0];

    const to_email = req.body.to_email ?? row.to_email;
    const to_name = req.body.to_name !== undefined ? req.body.to_name : row.to_name;
    const from_name = req.body.from_name ?? row.from_name;
    let from_email = req.body.from_email ?? row.from_email;
    const reply_to = req.body.reply_to !== undefined ? req.body.reply_to : row.reply_to;
    const subject = req.body.subject ?? row.subject;
    const body_html = req.body.body_html !== undefined ? req.body.body_html : row.body_html;
    const body_text = req.body.body_text !== undefined ? req.body.body_text : row.body_text;
    const domain_id = req.body.domain_id ?? row.domain_id;

    if (!to_email || !from_email || !subject) {
      return res.status(400).json({ success: false, message: 'Destinatário, remetente e assunto obrigatórios' });
    }
    if (!domain_id) {
      return res.status(400).json({ success: false, message: 'Domínio obrigatório para reenvio' });
    }
    if (!body_html && !body_text) {
      return res.status(400).json({
        success: false,
        message: 'Este envio não tem o corpo salvo (foi enviado antes da atualização). Cole o HTML novamente para reenviar.',
      });
    }

    const domainRow = await pool.query(
      `SELECT id, domain, status FROM email_marketing_domains WHERE id=$1 AND tenant_id=$2`,
      [domain_id, tenantId]
    );
    if (!domainRow.rows[0]) {
      return res.status(400).json({ success: false, message: 'Domínio não encontrado neste tenant' });
    }
    if (domainRow.rows[0].status !== 'active') {
      return res.status(400).json({ success: false, message: 'Domínio ainda não está ativo/verificado.' });
    }

    const domain = domainRow.rows[0].domain as string;
    const local = String(from_email || '')
      .trim()
      .split('@')[0]
      .replace(/[^a-zA-Z0-9._+-]/g, '')
      .toLowerCase();
    if (!local) {
      return res.status(400).json({ success: false, message: 'Usuário do remetente inválido' });
    }
    const finalFromEmail = `${local}@${domain}`;
    const recipName = (to_name && String(to_name).trim()) || to_email;

    const prepared = ensureEmailHtml(body_html, body_text);
    const used = detectUsedEmailVars(prepared.html, prepared.text, subject);
    const protocol = used.protocolo ? generateProtocol() : null;
    const recipVars = {
      nome: recipName,
      email: to_email,
      cpf: req.body.cpf || '',
      telefone: req.body.telefone || req.body.phone || '',
      phone: req.body.phone || req.body.telefone || '',
      var1: req.body.var1 || '',
      var2: req.body.var2 || '',
      var3: req.body.var3 || '',
      var4: req.body.var4 || '',
      var5: req.body.var5 || '',
      protocolo: protocol || '',
    };
    const finalHtml = applyEmailVariables(prepared.html, recipVars);
    const finalText = applyEmailVariables(prepared.text, recipVars, { escapeValues: false });
    const finalSubject = applyEmailVariables(subject, recipVars, { escapeValues: false });

    try {
      const sent = await sendMarketingEmail({
        domain,
        fromEmail: finalFromEmail,
        fromName: String(from_name || '').trim(),
        toEmail: to_email,
        toName: to_name,
        replyTo: reply_to || finalFromEmail,
        subject: finalSubject,
        html: finalHtml,
        text: finalText,
        tenantId,
        singleSendId: Number(id) || null,
      });

      const msgId = sent.messageId || null;

      try {
        await pool.query(
          `UPDATE email_marketing_single_sends SET
             to_email=$1, to_name=$2, from_email=$3, from_name=$4, subject=$5,
             domain_id=$6, reply_to=$7, body_html=$8, body_text=$9,
             mailgun_message_id=$10, provider_message_id=$10, status='sent', error_message=NULL,
             opened_at=NULL, clicked_at=NULL, updated_at=NOW()
           WHERE id=$11 AND tenant_id=$12`,
          [
            to_email, to_name || null, finalFromEmail, from_name || null, finalSubject,
            domain_id, reply_to || null, body_html || null, finalText || null,
            msgId, id, tenantId,
          ]
        );
      } catch {
        await pool.query(
          `UPDATE email_marketing_single_sends SET
             to_email=$1, to_name=$2, from_email=$3, from_name=$4, subject=$5,
             domain_id=$6, reply_to=$7, body_html=$8, body_text=$9,
             mailgun_message_id=$10, status='sent', error_message=NULL,
             opened_at=NULL, clicked_at=NULL, updated_at=NOW()
           WHERE id=$11 AND tenant_id=$12`,
          [
            to_email, to_name || null, finalFromEmail, from_name || null, finalSubject,
            domain_id, reply_to || null, body_html || null, finalText || null,
            msgId, id, tenantId,
          ]
        );
      }

      res.json({ success: true, message_id: msgId, message: 'E-mail reenviado com sucesso', from: finalFromEmail, provider: sent.provider });
    } catch (sendError: any) {
      const status = sendError?.status || sendError?.statusCode || sendError?.code;
      const msg = String(sendError?.message || 'Erro ao reenviar');
      const friendly = (status === 403 || /forbidden/i.test(msg))
        ? `Envio bloqueado (Forbidden). Domínio: ${domain}. Remetente: ${finalFromEmail}.`
        : msg;
      await pool.query(
        `UPDATE email_marketing_single_sends SET status='failed', error_message=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3`,
        [friendly.slice(0, 500), id, tenantId]
      );
      return res.status(400).json({ success: false, message: friendly });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// =============================================
// HISTÓRICO UNIFICADO DE ENVIOS
// =============================================
export const getSends = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const limit = parseInt((req.query.limit as string) || '50');
    const offset = parseInt((req.query.offset as string) || '0');

    // Campanhas em massa
    const campaigns = await pool.query(
      `SELECT
        c.id, 'campaign' as type, c.name as title, c.subject,
        c.from_email, c.from_name,
        c.user_id, c.user_name,
        c.status, c.total_contacts, c.sent_count, c.failed_count,
        c.opened_count, c.clicked_count, c.bounced_count, c.complained_count,
        c.started_at as sent_at, c.created_at,
        NULL::varchar as to_email, NULL::varchar as to_name,
        NULL::varchar as mailgun_message_id
       FROM email_marketing_campaigns c
       WHERE c.tenant_id = $1 AND c.status NOT IN ('draft')
       ORDER BY c.created_at DESC`,
      [tenantId]
    );

    // Envios únicos
    const singles = await pool.query(
      `SELECT
        s.id, 'single' as type, s.subject as title, s.subject,
        s.from_email, s.from_name,
        s.user_id, s.user_name,
        s.status, 1 as total_contacts,
        CASE WHEN s.status IN ('failed','bounced') THEN 0 ELSE 1 END as sent_count,
        CASE WHEN s.status = 'failed' THEN 1 ELSE 0 END as failed_count,
        CASE WHEN s.opened_at IS NOT NULL OR s.status IN ('opened','clicked') THEN 1 ELSE 0 END as opened_count,
        CASE WHEN s.clicked_at IS NOT NULL OR s.status = 'clicked' THEN 1 ELSE 0 END as clicked_count,
        CASE WHEN s.status = 'bounced' THEN 1 ELSE 0 END as bounced_count,
        CASE WHEN s.status = 'complained' THEN 1 ELSE 0 END as complained_count,
        s.created_at as sent_at, s.created_at,
        s.to_email, s.to_name,
        s.mailgun_message_id,
        s.error_message,
        s.domain_id,
        s.reply_to,
        s.body_html
       FROM email_marketing_single_sends s
       WHERE s.tenant_id = $1
       ORDER BY s.created_at DESC`,
      [tenantId]
    );

    // Unir e ordenar por data desc
    const all = [...campaigns.rows, ...singles.rows]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(offset, offset + limit);

    const total = campaigns.rows.length + singles.rows.length;
    res.json({ success: true, data: all, total });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// =============================================
// WEBHOOK DO MAILGUN (eventos de tracking)
// =============================================

/** Traduz e limpa mensagens técnicas de entrega (Mailgun/SMTP) para português */
function translateDeliveryDetail(raw: string): string {
  let text = String(raw || '').trim();
  if (!text) return '';

  // Remove códigos SMTP repetidos no meio do texto e IDs técnicos do Gmail
  text = text
    .replace(/\b5\.\d\.\d\b/g, ' ')
    .replace(/\[[^\]]*\]\s*-?\s*gsmtp/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const lower = text.toLowerCase();

  // Casos mais comuns — mensagens curtas e claras em PT
  if (/does not exist|no such user|user unknown|recipient address rejected|mailbox unavailable|mailbox not found|unknown user|endereço.*n[aã]o exist/i.test(lower)) {
    return 'A conta de e-mail do destinatário não existe ou foi rejeitada (usuário desconhecido). Verifique se o endereço está correto.';
  }
  if (/mailbox full|over quota|quota exceeded|insufficient storage/i.test(lower)) {
    return 'A caixa de e-mail do destinatário está cheia (sem espaço).';
  }
  if (/blocked|blacklist|listed|spamhaus|barracuda/i.test(lower) && /spam|block|list/i.test(lower)) {
    return 'Mensagem bloqueada por filtro antispam ou lista negra do provedor.';
  }
  if (/relay access denied|relaying denied|not allowed to relay/i.test(lower)) {
    return 'Envio rejeitado: acesso de relay negado pelo servidor do destinatário.';
  }
  if (/invalid domain|domain not found|nxdomain|no mx/i.test(lower)) {
    return 'Domínio do e-mail inválido ou sem servidor de recebimento (MX).';
  }
  if (/timeout|timed out|connection timed out|temporarily unavailable|try again later|greylist/i.test(lower)) {
    return 'Falha temporária de entrega. O provedor pediu para tentar novamente mais tarde.';
  }
  if (/message too large|size limit|exceeded.*size/i.test(lower)) {
    return 'Mensagem rejeitada por exceder o tamanho máximo permitido.';
  }
  if (/policy rejection|content rejected|spam message rejected|rejected as spam/i.test(lower)) {
    return 'Mensagem rejeitada pela política antispam do destinatário.';
  }
  if (/authentication required|spf|dkim|dmarc/i.test(lower)) {
    return 'Falha de autenticação de e-mail (SPF/DKIM/DMARC). Verifique o DNS do domínio.';
  }
  if (/inactive|disabled|account disabled|account closed/i.test(lower)) {
    return 'A conta de e-mail do destinatário está inativa ou desativada.';
  }

  // Traduções pontuais de trechos frequentes (quando não casou regra acima)
  const replacements: Array<[RegExp, string]> = [
    [/The email account that you tried to reach does not exist\.?/gi, 'A conta de e-mail que você tentou alcançar não existe.'],
    [/Please try\s+double-checking the recipient'?s? email address for typos or\s+unnecessary spaces\.?/gi, 'Verifique se o endereço do destinatário não tem erros de digitação ou espaços.'],
    [/For more information,? go to\s+https?:\/\/\S+/gi, ''],
    [/Recipient address rejected:?\s*/gi, 'Endereço do destinatário rejeitado: '],
    [/User unknown in virtual mailbox table\.?/gi, 'usuário desconhecido na caixa de e-mail.'],
    [/Mailbox unavailable\.?/gi, 'Caixa de e-mail indisponível.'],
    [/Permanent failure\.?/gi, 'Falha permanente.'],
    [/Temporary failure\.?/gi, 'Falha temporária.'],
    [/Message rejected\.?/gi, 'Mensagem rejeitada.'],
    [/Delivery failed\.?/gi, 'Falha na entrega.'],
  ];
  for (const [re, pt] of replacements) text = text.replace(re, pt);
  text = text.replace(/\s{2,}/g, ' ').replace(/\s+([.,;:])/g, '$1').trim();

  // Se ainda restou muito inglês genérico, resume
  if (/^[A-Za-z0-9<>@._\-\s:()\/]+$/.test(text) && /\b(the|recipient|address|rejected|failed|please|try)\b/i.test(text)) {
    return 'Falha na entrega reportada pelo provedor do destinatário. Detalhe técnico: ' + text.slice(0, 280);
  }
  return text.slice(0, 400);
}

/** Extrai motivo legível de eventos failed/bounced do Mailgun */
function formatMailgunDeliveryError(event: any): string | null {
  if (!event || typeof event !== 'object') return null;
  const delivery = event['delivery-status'] || event.delivery_status || {};
  const reason = String(event.reason || '').trim();
  const severity = String(event.severity || '').trim();
  const code = delivery.code ?? delivery['code'];
  const descRaw = String(
    delivery.description ||
    delivery.message ||
    delivery['enhanced-code'] ||
    ''
  ).trim();
  const desc = translateDeliveryDetail(descRaw);
  const parts: string[] = [];
  if (reason) {
    const reasonMap: Record<string, string> = {
      bounce: 'Rejeitado pelo servidor do destinatário (bounce)',
      'suppress-bounce': 'Suprimido (histórico de bounce)',
      'suppress-complaint': 'Suprimido (marcado como spam)',
      'suppress-unsubscribe': 'Suprimido (descadastrado)',
      espblock: 'Bloqueado pelo provedor de e-mail',
      blacklist: 'Bloqueado (lista negra)',
      old: 'Endereço antigo/inativo',
      softfail: 'Falha temporária',
      generic: 'Falha genérica de entrega',
    };
    parts.push(reasonMap[reason] || `Motivo: ${reason}`);
  }
  if (severity) parts.push(severity === 'permanent' ? 'Permanente' : severity === 'temporary' ? 'Temporária' : severity);
  if (code) parts.push(`Código ${code}`);
  if (desc) parts.push(desc);
  const msg = parts.join(' — ').slice(0, 500);
  return msg || null;
}

/** Recalcula contadores da campanha só com destinatários DESTA campanha (evita duplicar webhook) */
async function recalculateCampaignCounters(campaignId: number): Promise<void> {
  // opened/clicked/replied usam timestamps para não “perder” engajamento se um webhook
  // posterior (ex.: opened) reescrever o status textual do destinatário
  try {
    await pool.query(
      `UPDATE email_marketing_campaigns c SET
         total_contacts = COALESCE((SELECT COUNT(*)::int FROM email_marketing_recipients r WHERE r.campaign_id = c.id), 0),
         sent_count = COALESCE((SELECT COUNT(*)::int FROM email_marketing_recipients r WHERE r.campaign_id = c.id AND (
           r.status IN ('sent','opened','clicked','replied')
           OR r.opened_at IS NOT NULL OR r.clicked_at IS NOT NULL OR r.replied_at IS NOT NULL
         )), 0),
         failed_count = COALESCE((SELECT COUNT(*)::int FROM email_marketing_recipients r WHERE r.campaign_id = c.id AND r.status = 'failed'), 0),
         opened_count = COALESCE((SELECT COUNT(*)::int FROM email_marketing_recipients r WHERE r.campaign_id = c.id AND (
           r.opened_at IS NOT NULL OR r.clicked_at IS NOT NULL OR r.replied_at IS NOT NULL
           OR r.status IN ('opened','clicked','replied')
         )), 0),
         clicked_count = COALESCE((SELECT COUNT(*)::int FROM email_marketing_recipients r WHERE r.campaign_id = c.id AND (
           r.clicked_at IS NOT NULL OR r.status = 'clicked'
         )), 0),
         bounced_count = COALESCE((SELECT COUNT(*)::int FROM email_marketing_recipients r WHERE r.campaign_id = c.id AND r.status = 'bounced'), 0),
         complained_count = COALESCE((SELECT COUNT(*)::int FROM email_marketing_recipients r WHERE r.campaign_id = c.id AND r.status = 'complained'), 0),
         replied_count = COALESCE((SELECT COUNT(*)::int FROM email_marketing_recipients r WHERE r.campaign_id = c.id AND (
           r.replied_at IS NOT NULL OR r.status = 'replied'
         )), 0),
         updated_at = NOW()
       WHERE c.id = $1`,
      [campaignId]
    );
  } catch (err: any) {
    if (!/replied/i.test(String(err?.message || ''))) throw err;
    await pool.query(
      `UPDATE email_marketing_campaigns c SET
         total_contacts = COALESCE((SELECT COUNT(*)::int FROM email_marketing_recipients r WHERE r.campaign_id = c.id), 0),
         sent_count = COALESCE((SELECT COUNT(*)::int FROM email_marketing_recipients r WHERE r.campaign_id = c.id AND (
           r.status IN ('sent','opened','clicked') OR r.opened_at IS NOT NULL OR r.clicked_at IS NOT NULL
         )), 0),
         failed_count = COALESCE((SELECT COUNT(*)::int FROM email_marketing_recipients r WHERE r.campaign_id = c.id AND r.status = 'failed'), 0),
         opened_count = COALESCE((SELECT COUNT(*)::int FROM email_marketing_recipients r WHERE r.campaign_id = c.id AND (
           r.opened_at IS NOT NULL OR r.clicked_at IS NOT NULL OR r.status IN ('opened','clicked')
         )), 0),
         clicked_count = COALESCE((SELECT COUNT(*)::int FROM email_marketing_recipients r WHERE r.campaign_id = c.id AND (
           r.clicked_at IS NOT NULL OR r.status = 'clicked'
         )), 0),
         bounced_count = COALESCE((SELECT COUNT(*)::int FROM email_marketing_recipients r WHERE r.campaign_id = c.id AND r.status = 'bounced'), 0),
         complained_count = COALESCE((SELECT COUNT(*)::int FROM email_marketing_recipients r WHERE r.campaign_id = c.id AND r.status = 'complained'), 0),
         updated_at = NOW()
       WHERE c.id = $1`,
      [campaignId]
    );
  }
}

/** Ordem de prioridade do status do destinatário (não rebaixa engajamento) */
function recipientStatusRank(status: string): number {
  switch (status) {
    case 'replied': return 60;
    case 'clicked': return 50;
    case 'opened': return 40;
    case 'complained': return 35;
    case 'bounced': return 30;
    case 'failed': return 30;
    case 'sent': return 20;
    case 'pending': return 10;
    default: return 0;
  }
}

export const mailgunWebhook = async (req: Request, res: Response) => {
  try {
    // Suporta body como objeto (json), Buffer (raw) ou string
    let rawBody = req.body;
    if (Buffer.isBuffer(rawBody)) {
      try { rawBody = JSON.parse(rawBody.toString('utf8')); } catch { rawBody = {}; }
    } else if (typeof rawBody === 'string') {
      try { rawBody = JSON.parse(rawBody); } catch { rawBody = {}; }
    }
    const body = rawBody || {};

    const event = body['event-data'] || body;
    const eventType = event?.event;
    // Mailgun pode enviar o message-id com ou sem < >
    const rawMsgId = event?.message?.headers?.['message-id'] || event?.['message-id'] || '';
    const messageId = rawMsgId.replace(/^<|>$/g, '').trim();
    const recipient = event?.recipient;

    console.log(`[webhook-mailgun] PAYLOAD:`, JSON.stringify(body).substring(0, 400));
    console.log(`[webhook-mailgun] evento: ${eventType} | msgId: ${messageId} | recipient: ${recipient}`);
    if (!eventType || !messageId) return res.json({ success: true });

    const statusMap: Record<string, string> = {
      delivered: 'sent',
      opened:    'opened',
      clicked:   'clicked',
      bounced:   'bounced',
      complained:'complained',
      failed:    'failed',
    };
    const newStatus = statusMap[eventType];
    if (!newStatus) return res.json({ success: true });

    const deliveryError =
      eventType === 'failed' || eventType === 'bounced'
        ? formatMailgunDeliveryError(event)
        : null;
    if (deliveryError) {
      console.log(`[webhook-mailgun] motivo: ${deliveryError}`);
    }

    // Destinatário atual da campanha (para não rebaixar status e recalcular só esta campanha)
    const current = await pool.query(
      `SELECT id, campaign_id, status, opened_at, clicked_at
       FROM email_marketing_recipients
       WHERE email=$2 AND (mailgun_message_id=$1 OR provider_message_id=$1)
       LIMIT 1`,
      [messageId, recipient]
    );

    if (current.rows[0]) {
      const row = current.rows[0];
      const prev = String(row.status || 'pending');
      const alreadyClicked = !!row.clicked_at || prev === 'clicked' || prev === 'replied';
      const alreadyReplied = prev === 'replied' || !!(row as any).replied_at;

      // Nunca rebaixar clique → aberto (nem por race de webhooks)
      let effectiveStatus = newStatus;
      if (eventType === 'opened' && alreadyClicked) {
        effectiveStatus = alreadyReplied ? 'replied' : 'clicked';
      }
      if (eventType === 'clicked') {
        effectiveStatus = alreadyReplied ? 'replied' : 'clicked';
      }
      if (alreadyReplied && !['failed', 'bounced', 'complained'].includes(newStatus)) {
        effectiveStatus = 'replied';
      }

      const shouldUpdateStatus = recipientStatusRank(effectiveStatus) >= recipientStatusRank(prev)
        // falha/bounce depois de enviado pode “rebaixar” engajamento de sent→failed
        || (['failed', 'bounced', 'complained'].includes(newStatus) && ['pending', 'sent'].includes(prev));

      // delivered não deve sobrescrever opened/clicked/replied
      const skipDeliveredDowngrade = eventType === 'delivered' && (
        ['opened', 'clicked', 'replied', 'failed', 'bounced', 'complained'].includes(prev) || alreadyClicked
      );

      if (shouldUpdateStatus && !skipDeliveredDowngrade) {
        if (deliveryError) {
          await pool.query(
            `UPDATE email_marketing_recipients
             SET status=$1,
                 error_message=$2,
                 opened_at=CASE WHEN $3::boolean THEN COALESCE(opened_at, NOW()) ELSE opened_at END,
                 clicked_at=CASE WHEN $4::boolean THEN COALESCE(clicked_at, NOW()) ELSE clicked_at END,
                 updated_at=NOW()
             WHERE id=$5`,
            [
              effectiveStatus,
              deliveryError,
              eventType === 'opened' || eventType === 'clicked',
              eventType === 'clicked',
              row.id,
            ]
          );
        } else {
          await pool.query(
            `UPDATE email_marketing_recipients
             SET status=$1,
                 opened_at=CASE WHEN $2::boolean THEN COALESCE(opened_at, NOW()) ELSE opened_at END,
                 clicked_at=CASE WHEN $3::boolean THEN COALESCE(clicked_at, NOW()) ELSE clicked_at END,
                 updated_at=NOW()
             WHERE id=$4`,
            [
              effectiveStatus,
              eventType === 'opened' || eventType === 'clicked',
              eventType === 'clicked',
              row.id,
            ]
          );
        }
      } else if (eventType === 'opened' && !row.opened_at) {
        await pool.query(
          `UPDATE email_marketing_recipients
           SET opened_at=NOW(),
               status=CASE
                 WHEN replied_at IS NOT NULL OR status='replied' THEN 'replied'
                 WHEN clicked_at IS NOT NULL OR status='clicked' THEN 'clicked'
                 ELSE status
               END,
               updated_at=NOW()
           WHERE id=$1`,
          [row.id]
        );
      } else if (eventType === 'clicked') {
        // Clique sempre grava timestamp + status, sem rebaixar resposta do cliente
        await pool.query(
          `UPDATE email_marketing_recipients
           SET clicked_at=COALESCE(clicked_at,NOW()),
               opened_at=COALESCE(opened_at,NOW()),
               status=CASE WHEN replied_at IS NOT NULL OR status='replied' THEN 'replied' ELSE 'clicked' END,
               updated_at=NOW()
           WHERE id=$1`,
          [row.id]
        );
      }

      // Contadores SEMPRE recalculados só desta campanha (nunca +1 cego / nunca mistura outras)
      await recalculateCampaignCounters(row.campaign_id);
    }

    // Envios únicos — nunca rebaixa clicked→opened; timestamps são sticky
    const msgIdWithBrackets = `<${messageId}>`;
    if (deliveryError) {
      await pool.query(
        `UPDATE email_marketing_single_sends
         SET
           status = CASE
             WHEN $1 = 'opened' AND (clicked_at IS NOT NULL OR status = 'clicked') THEN 'clicked'
             WHEN $1 = 'clicked' THEN 'clicked'
             WHEN status = 'clicked' AND $1 IN ('sent','opened','delivered') THEN 'clicked'
             ELSE $1
           END,
           error_message = $2,
           opened_at = CASE WHEN $3 = 'opened' OR $3 = 'clicked' THEN COALESCE(opened_at, NOW()) ELSE opened_at END,
           clicked_at = CASE WHEN $3 = 'clicked' THEN COALESCE(clicked_at, NOW()) ELSE clicked_at END,
           updated_at = NOW()
         WHERE mailgun_message_id = $4 OR mailgun_message_id = $5
            OR provider_message_id = $4 OR provider_message_id = $5`,
        [newStatus, deliveryError, eventType, messageId, msgIdWithBrackets]
      );
    } else {
      await pool.query(
        `UPDATE email_marketing_single_sends
         SET
           status = CASE
             WHEN $1 = 'opened' AND (clicked_at IS NOT NULL OR status = 'clicked') THEN 'clicked'
             WHEN $1 = 'clicked' THEN 'clicked'
             WHEN status = 'clicked' AND $1 IN ('sent','opened','delivered') THEN 'clicked'
             ELSE $1
           END,
           opened_at = CASE WHEN $2 = 'opened' OR $2 = 'clicked' THEN COALESCE(opened_at, NOW()) ELSE opened_at END,
           clicked_at = CASE WHEN $2 = 'clicked' THEN COALESCE(clicked_at, NOW()) ELSE clicked_at END,
           updated_at = NOW()
         WHERE mailgun_message_id = $3 OR mailgun_message_id = $4
            OR provider_message_id = $3 OR provider_message_id = $4`,
        [newStatus, eventType, messageId, msgIdWithBrackets]
      );
    }

    // Caixa de e-mail — tracking interno
    try {
      const { applyMailboxTrackingEvent } = require('../services/email-mailbox.service');
      const mb = await applyMailboxTrackingEvent({
        eventType,
        messageId,
        baseMessageId: messageId,
        recipientEmail: recipient,
        errorMessage: deliveryError,
      });
      if (mb.updated) {
        console.log(`[webhook-mailgun] mailbox msg=${mb.id} -> ${mb.tracking_status}`);
      }
    } catch (e: any) {
      console.warn('[webhook-mailgun] mailbox tracking:', e?.message || e);
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('[webhook] erro:', error.message);
    res.status(500).json({ success: false });
  }
};

// =============================================
// ADMIN: CREDENCIAL MAILGUN
// =============================================

export const getMailgunCredential = async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`SELECT id, region, is_active, created_at, updated_at FROM mailgun_credentials WHERE is_active=TRUE LIMIT 1`);
    res.json({ success: true, data: result.rows[0] || null, configured: result.rows.length > 0 });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const saveMailgunCredential = async (req: Request, res: Response) => {
  try {
    const { api_key, region } = req.body;
    if (!api_key) return res.status(400).json({ success: false, message: 'Chave API obrigatória' });
    await pool.query(`UPDATE mailgun_credentials SET is_active=FALSE`);
    await pool.query(
      `INSERT INTO mailgun_credentials (api_key, region, is_active) VALUES ($1,$2,TRUE)`,
      [api_key, region || 'us']
    );
    res.json({ success: true, message: 'Credencial Mailgun salva com sucesso' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteMailgunCredential = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await pool.query(`DELETE FROM mailgun_credentials WHERE id=$1`, [id]);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// =============================================
// ADMIN: CREDENCIAL SENDGRID + PROVEDOR ATIVO
// =============================================

export const getEmailMarketingProviderSettings = async (_req: Request, res: Response) => {
  try {
    const active = await getActiveEmailMarketingProvider();
    const mg = await pool.query(`SELECT id, region, is_active, created_at FROM mailgun_credentials WHERE is_active=TRUE LIMIT 1`);
    const sg = await pool.query(`SELECT id, is_active, created_at FROM sendgrid_credentials WHERE is_active=TRUE LIMIT 1`);
    let nettConfigured = false;
    try {
      const ne = await pool.query(
        `SELECT id FROM nettsistemasenvios_credentials WHERE is_active=TRUE LIMIT 1`
      );
      nettConfigured = ne.rows.length > 0;
    } catch {
      nettConfigured = !!process.env.NETTSISTEMAS_ENVIOS_API_KEY;
    }
    res.json({
      success: true,
      data: {
        active_provider: active,
        mailgun_configured: mg.rows.length > 0,
        sendgrid_configured: sg.rows.length > 0,
        nettsistemasenvios_configured: nettConfigured,
        mailgun: mg.rows[0] || null,
        sendgrid: sg.rows[0] || null,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const saveEmailMarketingProviderSettings = async (req: Request, res: Response) => {
  try {
    const raw = String(req.body?.active_provider || '').toLowerCase();
    const provider = (
      raw === 'nettsistemasenvios.com.br' ? 'nettsistemasenvios' : raw
    ) as EmailMarketingProviderName;
    if (provider !== 'mailgun' && provider !== 'sendgrid' && provider !== 'nettsistemasenvios') {
      return res.status(400).json({
        success: false,
        message: 'Provedor inválido (mailgun|sendgrid|nettsistemasenvios)',
      });
    }
    if (provider === 'sendgrid') {
      const sg = await pool.query(`SELECT id FROM sendgrid_credentials WHERE is_active=TRUE LIMIT 1`);
      if (!sg.rows[0]) {
        return res.status(400).json({ success: false, message: 'Salve a chave SendGrid antes de ativar o provedor' });
      }
    }
    if (provider === 'mailgun') {
      const mg = await pool.query(`SELECT id FROM mailgun_credentials WHERE is_active=TRUE LIMIT 1`);
      if (!mg.rows[0]) {
        return res.status(400).json({ success: false, message: 'Salve a chave Mailgun antes de ativar o provedor' });
      }
    }
    if (provider === 'nettsistemasenvios') {
      const ne = await pool.query(`SELECT id FROM nettsistemasenvios_credentials WHERE is_active=TRUE LIMIT 1`);
      if (!ne.rows[0] && !process.env.NETTSISTEMAS_ENVIOS_API_KEY) {
        return res.status(400).json({
          success: false,
          message: 'Salve a API Key de nettsistemasenvios.com.br antes de ativar',
        });
      }
    }
    await setActiveEmailMarketingProvider(provider);
    if (provider === 'sendgrid') {
      ensureSendGridEventWebhook().catch(() => {});
    }
    res.json({ success: true, message: `Provedor ativo: ${provider}`, active_provider: provider });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getSendGridCredential = async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT id, is_active, created_at, updated_at FROM sendgrid_credentials WHERE is_active=TRUE LIMIT 1`
    );
    res.json({ success: true, data: result.rows[0] || null, configured: result.rows.length > 0 });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const saveSendGridCredential = async (req: Request, res: Response) => {
  try {
    const { api_key, activate } = req.body;
    if (!api_key) return res.status(400).json({ success: false, message: 'Chave API obrigatória' });
    await pool.query(`UPDATE sendgrid_credentials SET is_active=FALSE`);
    await pool.query(
      `INSERT INTO sendgrid_credentials (api_key, is_active) VALUES ($1, TRUE)`,
      [api_key]
    );
    if (activate !== false) {
      await setActiveEmailMarketingProvider('sendgrid');
      ensureSendGridEventWebhook().catch(() => {});
    }
    res.json({
      success: true,
      message: 'Credencial SendGrid salva com sucesso',
      active_provider: activate === false ? await getActiveEmailMarketingProvider() : 'sendgrid',
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteSendGridCredential = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await pool.query(`DELETE FROM sendgrid_credentials WHERE id=$1`, [id]);
    const active = await getActiveEmailMarketingProvider();
    if (active === 'sendgrid') {
      await setActiveEmailMarketingProvider('mailgun');
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// =============================================
// ADMIN: nettsistemasenvios.com.br (SMTP externo)
// =============================================

export const getNettEnviosCredential = async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT id, api_base_url, smtp_host, smtp_port, smtp_user, smtp_tls, is_active, created_at, updated_at,
              (smtp_password IS NOT NULL AND smtp_password <> '') AS has_smtp_password
       FROM nettsistemasenvios_credentials WHERE is_active=TRUE ORDER BY id DESC LIMIT 1`
    );
    res.json({
      success: true,
      data: result.rows[0] || null,
      configured: result.rows.length > 0 || !!process.env.NETTSISTEMAS_ENVIOS_API_KEY,
      provider_label: 'nettsistemasenvios.com.br',
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const saveNettEnviosCredential = async (req: Request, res: Response) => {
  try {
    const api_key = String(req.body?.api_key || '').trim();
    const api_base_url = String(
      req.body?.api_base_url || 'https://smtp1.nettsistemasenvios.com.br'
    ).replace(/\/$/, '');
    if (!api_key) return res.status(400).json({ success: false, message: 'API Key obrigatória' });

    await pool.query(`UPDATE nettsistemasenvios_credentials SET is_active=FALSE WHERE is_active=TRUE`);
    await pool.query(
      `INSERT INTO nettsistemasenvios_credentials (api_key, api_base_url, is_active)
       VALUES ($1, $2, TRUE)`,
      [api_key, api_base_url]
    );

    const { ensureNettEnviosSmtpCredential } = require('../services/nettsistemasenvios.service');
    let smtpOk = false;
    let smtpError: string | null = null;
    try {
      await ensureNettEnviosSmtpCredential('disparador');
      smtpOk = true;
    } catch (e: any) {
      smtpError = e?.message || String(e);
      console.warn('[nett-envios] ensure credentials:', smtpError);
    }

    if (req.body?.activate !== false) {
      await setActiveEmailMarketingProvider('nettsistemasenvios');
    }

    res.json({
      success: true,
      message: 'Credencial nettsistemasenvios.com.br salva',
      smtp_registered: smtpOk,
      smtp_error: smtpError,
      active_provider: await getActiveEmailMarketingProvider(),
      provider_label: 'nettsistemasenvios.com.br',
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Webhook de eventos — nettsistemasenvios.com.br
 * Formato igual ao array de eventos já suportado (delivered/open/click/...).
 * Rotas por domínio: /api/webhook/nettsistemasenvios/:domainId/:token
 */
export const nettEnviosWebhook = async (req: Request, res: Response) => {
  try {
    const domainId = Number(req.params.domainId || 0);
    const token = String(req.params.token || '');
    if (domainId > 0) {
      const r = await pool.query(
        `SELECT id, webhook_token, provider FROM email_marketing_domains WHERE id=$1`,
        [domainId]
      );
      const row = r.rows[0];
      if (!row || !String(row.provider || '').includes('nettsistemas')) {
        return res.status(404).json({ success: false, message: 'Domínio não encontrado' });
      }
      if (row.webhook_token && token && row.webhook_token !== token) {
        return res.status(403).json({ success: false, message: 'Token inválido' });
      }
      console.log(`[webhook-nettsistemasenvios] domínio=${domainId}`);
    } else {
      console.log('[webhook-nettsistemasenvios] fallback global');
    }
    return sendgridWebhook(req, res);
  } catch (error: any) {
    console.error('[webhook-nettsistemasenvios]', error.message);
    res.status(500).json({ success: false });
  }
};

export const nettEnviosInboundParse = async (req: Request, res: Response) => {
  try {
    const domainId = Number(req.params.domainId || 0);
    const token = String(req.params.token || '');
    if (domainId > 0) {
      const r = await pool.query(
        `SELECT id, webhook_token, provider FROM email_marketing_domains WHERE id=$1`,
        [domainId]
      );
      const row = r.rows[0];
      if (!row || !String(row.provider || '').includes('nettsistemas')) {
        return res.status(404).json({ success: false, message: 'Domínio não encontrado' });
      }
      if (row.webhook_token && token && row.webhook_token !== token) {
        return res.status(403).json({ success: false, message: 'Token inválido' });
      }
    }
    return sendgridInboundParse(req, res);
  } catch (error: any) {
    console.error('[webhook-nettsistemasenvios-inbound]', error.message);
    res.status(500).json({ success: false });
  }
};

/**
 * Webhook de eventos SendGrid (array de eventos).
 * URL: POST /api/webhook/sendgrid
 */
export const sendgridWebhook = async (req: Request, res: Response) => {
  try {
    let rawBody = req.body;
    if (Buffer.isBuffer(rawBody)) {
      try { rawBody = JSON.parse(rawBody.toString('utf8')); } catch { rawBody = []; }
    } else if (typeof rawBody === 'string') {
      try { rawBody = JSON.parse(rawBody); } catch { rawBody = []; }
    }

    const events = Array.isArray(rawBody) ? rawBody : (rawBody ? [rawBody] : []);
    console.log(`[webhook-sendgrid] ${events.length} evento(s)`);

    const statusMap: Record<string, string> = {
      delivered: 'sent',
      open: 'opened',
      click: 'clicked',
      bounce: 'bounced',
      dropped: 'failed',
      spamreport: 'complained',
      unsubscribe: 'complained',
    };

    for (const ev of events) {
      const eventType = String(ev?.event || '').toLowerCase();
      const newStatus = statusMap[eventType];
      if (!newStatus) continue;

      // SendGrid: X-Message-Id no envio = "abc123"
      // no webhook sg_message_id = "abc123.filter0001.xxx.yyy" — precisa casar pelo prefixo
      const rawMessageId = String(ev?.sg_message_id || ev?.['smtp-id'] || '').replace(/^<|>$/g, '').trim();
      const messageId = rawMessageId;
      const baseMessageId = rawMessageId.split('.')[0] || rawMessageId;
      const recipient = String(ev?.email || '').trim().toLowerCase();
      if (!messageId || !recipient) continue;

      console.log(`[webhook-sendgrid] event=${eventType} email=${recipient} msg=${messageId} base=${baseMessageId}`);

      const deliveryError =
        eventType === 'bounce' || eventType === 'dropped'
          ? String(ev?.reason || ev?.response || ev?.type || 'Falha no envio').slice(0, 500)
          : null;

      // Reusa a mesma lógica do Mailgun: busca recipient e atualiza
      const current = await pool.query(
        `SELECT id, campaign_id, status, opened_at, clicked_at
         FROM email_marketing_recipients
         WHERE LOWER(email)=$2
           AND (
             provider_message_id=$1 OR mailgun_message_id=$1
             OR provider_message_id=$3 OR mailgun_message_id=$3
             OR provider_message_id LIKE $4 OR mailgun_message_id LIKE $4
             OR $1 LIKE provider_message_id || '%' OR $1 LIKE mailgun_message_id || '%'
           )
         LIMIT 1`,
        [messageId, recipient, baseMessageId, `${baseMessageId}%`]
      );

      if (current.rows[0]) {
        const row = current.rows[0];

        // Opt-out via botão do provedor → entra na lista de restrição do tenant
        if (eventType === 'unsubscribe') {
          try {
            const camp = await pool.query(
              `SELECT tenant_id FROM email_marketing_campaigns WHERE id=$1`,
              [row.campaign_id]
            );
            const tid = Number(camp.rows[0]?.tenant_id);
            if (tid) {
              await upsertEmailRestriction({
                tenantId: tid,
                email: recipient,
                reason: 'opt_out',
                source: 'sendgrid_webhook',
                notes: 'Cancelamento via evento unsubscribe do SendGrid',
              });
            }
          } catch (e: any) {
            console.warn('[webhook-sendgrid] unsubscribe→restriction:', e.message);
          }
        }

        const prev = String(row.status || 'pending');
        const alreadyClicked = !!row.clicked_at || prev === 'clicked' || prev === 'replied';
        const alreadyReplied = prev === 'replied';
        let effectiveStatus = newStatus;
        if (eventType === 'open' && alreadyClicked) effectiveStatus = alreadyReplied ? 'replied' : 'clicked';
        if (eventType === 'click') effectiveStatus = alreadyReplied ? 'replied' : 'clicked';
        if (alreadyReplied && !['failed', 'bounced', 'complained'].includes(newStatus)) {
          effectiveStatus = 'replied';
        }

        const shouldUpdateStatus =
          recipientStatusRank(effectiveStatus) >= recipientStatusRank(prev) ||
          (['failed', 'bounced', 'complained'].includes(newStatus) && ['pending', 'sent'].includes(prev));
        const skipDeliveredDowngrade =
          eventType === 'delivered' &&
          (['opened', 'clicked', 'replied', 'failed', 'bounced', 'complained'].includes(prev) || alreadyClicked);

        if (shouldUpdateStatus && !skipDeliveredDowngrade) {
          await pool.query(
            `UPDATE email_marketing_recipients
             SET status=$1,
                 error_message=COALESCE($2, error_message),
                 opened_at=CASE WHEN $3::boolean THEN COALESCE(opened_at, NOW()) ELSE opened_at END,
                 clicked_at=CASE WHEN $4::boolean THEN COALESCE(clicked_at, NOW()) ELSE clicked_at END,
                 updated_at=NOW()
             WHERE id=$5`,
            [
              effectiveStatus,
              deliveryError,
              eventType === 'open' || eventType === 'click',
              eventType === 'click',
              row.id,
            ]
          );
        } else if (eventType === 'open' && !row.opened_at) {
          await pool.query(
            `UPDATE email_marketing_recipients SET opened_at=COALESCE(opened_at, NOW()), updated_at=NOW() WHERE id=$1`,
            [row.id]
          );
        } else if (eventType === 'click') {
          await pool.query(
            `UPDATE email_marketing_recipients
             SET clicked_at=COALESCE(clicked_at,NOW()),
                 opened_at=COALESCE(opened_at,NOW()),
                 status=CASE WHEN status='replied' OR replied_at IS NOT NULL THEN 'replied' ELSE 'clicked' END,
                 updated_at=NOW()
             WHERE id=$1`,
            [row.id]
          );
        }
        await recalculateCampaignCounters(row.campaign_id);
      }

      // single sends
      if (deliveryError) {
        await pool.query(
          `UPDATE email_marketing_single_sends
           SET status=$1, error_message=$2,
               opened_at=CASE WHEN $3 IN ('open','click') THEN COALESCE(opened_at, NOW()) ELSE opened_at END,
               clicked_at=CASE WHEN $3='click' THEN COALESCE(clicked_at, NOW()) ELSE clicked_at END,
               updated_at=NOW()
           WHERE mailgun_message_id=$4 OR provider_message_id=$4
              OR mailgun_message_id=$5 OR provider_message_id=$5
              OR mailgun_message_id LIKE $6 OR provider_message_id LIKE $6
              OR $4 LIKE mailgun_message_id || '%' OR $4 LIKE provider_message_id || '%'`,
          [newStatus, deliveryError, eventType, messageId, baseMessageId, `${baseMessageId}%`]
        );
      } else {
        const upd = await pool.query(
          `UPDATE email_marketing_single_sends
           SET status=CASE
                 WHEN $1='opened' AND (clicked_at IS NOT NULL OR status='clicked') THEN 'clicked'
                 WHEN $1='clicked' THEN 'clicked'
                 WHEN status='clicked' AND $1 IN ('sent','opened') THEN 'clicked'
                 ELSE $1
               END,
               opened_at=CASE WHEN $2 IN ('open','click') THEN COALESCE(opened_at, NOW()) ELSE opened_at END,
               clicked_at=CASE WHEN $2='click' THEN COALESCE(clicked_at, NOW()) ELSE clicked_at END,
               updated_at=NOW()
           WHERE mailgun_message_id=$3 OR provider_message_id=$3
              OR mailgun_message_id=$4 OR provider_message_id=$4
              OR mailgun_message_id LIKE $5 OR provider_message_id LIKE $5
              OR $3 LIKE mailgun_message_id || '%' OR $3 LIKE provider_message_id || '%'
           RETURNING id, status`,
          [newStatus, eventType, messageId, baseMessageId, `${baseMessageId}%`]
        );
        if (!upd.rowCount && !current.rows[0]) {
          console.warn(`[webhook-sendgrid] sem match para msg=${messageId} email=${recipient}`);
        } else if (upd.rowCount) {
          console.log(`[webhook-sendgrid] single_send atualizado id=${upd.rows[0].id} -> ${upd.rows[0].status}`);
        }
      }

      // Caixa de e-mail (conversa) — tracking interno
      try {
        const { applyMailboxTrackingEvent } = require('../services/email-mailbox.service');
        // SendGrid devolve customArgs no topo do evento (e às vezes aninhado)
        const mailboxMsgId = Number(
          ev?.mailbox_message_id ||
          ev?.unique_args?.mailbox_message_id ||
          ev?.custom_args?.mailbox_message_id ||
          ev?.unique_args?.['mailbox_message_id'] ||
          0
        ) || null;
        const mb = await applyMailboxTrackingEvent({
          eventType,
          messageId,
          baseMessageId,
          recipientEmail: recipient,
          mailboxMessageId: mailboxMsgId,
          errorMessage: deliveryError,
          eventAt: ev?.timestamp ? new Date(Number(ev.timestamp) * 1000) : null,
        });
        if (mb.updated) {
          console.log(`[webhook-sendgrid] mailbox msg=${mb.id} -> ${mb.tracking_status}`);
        }
      } catch (e: any) {
        console.warn('[webhook-sendgrid] mailbox tracking:', e?.message || e);
      }
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('[webhook-sendgrid] erro:', error.message);
    res.status(500).json({ success: false });
  }
};

/**
 * SendGrid Inbound Parse — quando o cliente responde o e-mail.
 * URL: POST /api/webhook/sendgrid-inbound
 * Encaminha ao Reply-To (atendente) com ficha do cliente (uso interno).
 */
export const sendgridInboundParse = async (req: Request, res: Response) => {
  try {
    const { parseInterceptReplyTo, extractEmailsFromHeader } = require('../utils/email-reply-token');
    const { forwardClientReplyToAttendant } = require('../services/email-inbound-reply.service');

    const body: any = req.body || {};
    const toField = String(body.to || body.envelope || '');
    let envelopeTo = '';
    try {
      const env = typeof body.envelope === 'string' ? JSON.parse(body.envelope) : body.envelope;
      if (env?.to) envelopeTo = Array.isArray(env.to) ? env.to.join(' ') : String(env.to);
    } catch { /* ignore */ }

    const candidates = [
      ...extractEmailsFromHeader(toField),
      ...extractEmailsFromHeader(envelopeTo),
      ...extractEmailsFromHeader(String(body.headers || '')),
    ];

    let parsed: { kind: 'r' | 's'; id: number } | null = null;
    for (const addr of candidates) {
      parsed = parseInterceptReplyTo(addr);
      if (parsed) break;
    }
    // Fallback: varrer todos os valores do body
    if (!parsed) {
      for (const v of Object.values(body)) {
        if (typeof v === 'string' && v.includes('@')) {
          for (const addr of extractEmailsFromHeader(v)) {
            parsed = parseInterceptReplyTo(addr);
            if (parsed) break;
          }
        }
        if (parsed) break;
      }
    }

    if (!parsed) {
      // Sem token de campanha → tenta gravar na caixa de e-mail do tenant
      try {
        const { ingestInboundToMailbox } = require('../services/email-mailbox.service');
        const fromRaw = String(body.from || '');
        const ingested = await ingestInboundToMailbox({
          toCandidates: candidates.length
            ? candidates
            : extractEmailsFromHeader(toField + ' ' + envelopeTo),
          fromRaw,
          subject: String(body.subject || ''),
          text: String(body.text || ''),
          html: String(body.html || ''),
          messageId: String(body.headers || '').match(/Message-Id:\s*<([^>]+)>/i)?.[1]
            || String(body['message-id'] || '') || null,
          files: Array.isArray((req as any).files) ? (req as any).files : [],
          attachmentInfoRaw: body['attachment-info'] || body.attachment_info,
          contentIdsRaw: body['content-ids'] || body.content_ids,
        });
        if (ingested.ok) {
          console.log(
            `[inbound-mailbox] mailbox=${ingested.mailboxId} msg=${ingested.messageId} anexos=${ingested.attachments || 0}`
          );
          return res.status(200).json({ success: true, matched: true, mailbox: true, id: ingested.messageId });
        }
      } catch (e: any) {
        console.warn('[inbound-mailbox]', e.message);
      }
      console.warn('[inbound-reply] token/caixa não encontrados no To:', toField || envelopeTo);
      return res.status(200).json({ success: true, matched: false });
    }

    const fromRaw = String(body.from || '');
    const fromEmails = extractEmailsFromHeader(fromRaw);
    const clientFrom = fromEmails[0] || '';

    const result = await forwardClientReplyToAttendant({
      kind: parsed.kind,
      id: parsed.id,
      clientSubject: String(body.subject || ''),
      clientText: String(body.text || ''),
      clientHtml: String(body.html || ''),
      clientFromEmail: clientFrom,
    });

    console.log(`[inbound-reply] ${parsed.kind}-${parsed.id} ->`, result);
    return res.status(200).json({ success: true, matched: true, forwarded: result.ok, reason: result.reason });
  } catch (error: any) {
    console.error('[inbound-reply] erro:', error.message);
    // Sempre 200 para o SendGrid não reenviar em loop infinito por bug nosso
    return res.status(200).json({ success: false, message: error.message });
  }
};

// =============================================
// LISTA DE RESTRIÇÃO (opt-out / cancelamento)
// =============================================

async function upsertEmailRestriction(opts: {
  tenantId: number;
  email: string;
  reason?: string;
  source?: string;
  notes?: string | null;
}) {
  const email = String(opts.email || '').trim().toLowerCase();
  if (!email.includes('@')) return null;
  const r = await pool.query(
    `INSERT INTO email_marketing_restrictions (tenant_id, email, reason, source, notes, updated_at)
     VALUES ($1,$2,$3,$4,$5,NOW())
     ON CONFLICT (tenant_id, email) DO UPDATE SET
       reason = COALESCE(EXCLUDED.reason, email_marketing_restrictions.reason),
       source = COALESCE(EXCLUDED.source, email_marketing_restrictions.source),
       notes = COALESCE(EXCLUDED.notes, email_marketing_restrictions.notes),
       updated_at = NOW()
     RETURNING *`,
    [
      opts.tenantId,
      email,
      opts.reason || 'opt_out',
      opts.source || 'manual',
      opts.notes || null,
    ]
  );
  return r.rows[0];
}

export const getEmailRestrictions = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const q = String(req.query.q || '').trim().toLowerCase();
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 100));
    const offset = Math.max(0, Number(req.query.offset) || 0);

    const params: any[] = [tenantId];
    let where = 'tenant_id=$1';
    if (q) {
      params.push(`%${q}%`);
      where += ` AND lower(email) LIKE $${params.length}`;
    }
    const countParams = [...params];
    params.push(limit, offset);

    const result = await pool.query(
      `SELECT id, email, reason, source, notes, created_at, updated_at
       FROM email_marketing_restrictions
       WHERE ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    const count = await pool.query(
      `SELECT COUNT(*)::int AS total FROM email_marketing_restrictions WHERE ${where}`,
      countParams
    );
    res.json({ success: true, data: result.rows, total: count.rows[0]?.total || 0 });
  } catch (error: any) {
    if (/email_marketing_restrictions|does not exist/i.test(String(error.message || ''))) {
      return res.json({ success: true, data: [], total: 0, migration_pending: true });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

export const addEmailRestriction = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!email.includes('@')) {
      return res.status(400).json({ success: false, message: 'Informe um e-mail válido' });
    }
    const row = await upsertEmailRestriction({
      tenantId,
      email,
      reason: req.body.reason || 'opt_out',
      source: req.body.source || 'manual',
      notes: req.body.notes || null,
    });
    res.json({ success: true, data: row });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const removeEmailRestriction = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const { id } = req.params;
    const r = await pool.query(
      `DELETE FROM email_marketing_restrictions WHERE id=$1 AND tenant_id=$2 RETURNING id`,
      [id, tenantId]
    );
    if (!r.rows[0]) return res.status(404).json({ success: false, message: 'Registro não encontrado' });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/** Checagem em lote — campanha / envio único (igual WhatsApp check-bulk) */
export const checkEmailRestrictionsBulk = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const emailsRaw: string[] = Array.isArray(req.body.emails) ? req.body.emails : [];
    const emails = [...new Set(
      emailsRaw.map((e) => String(e || '').trim().toLowerCase()).filter((e) => e.includes('@'))
    )];

    if (emails.length === 0) {
      return res.json({
        success: true,
        total_checked: 0,
        restricted_count: 0,
        clean_count: 0,
        restricted_emails: [],
        restricted_details: [],
      });
    }

    let restricted: any[] = [];
    try {
      const r = await pool.query(
        `SELECT id, email, reason, source, notes, created_at
         FROM email_marketing_restrictions
         WHERE tenant_id=$1 AND lower(email) = ANY($2::text[])`,
        [tenantId, emails]
      );
      restricted = r.rows;
    } catch (e: any) {
      if (!/email_marketing_restrictions|does not exist/i.test(String(e?.message || ''))) throw e;
    }

    const restrictedSet = new Set(restricted.map((x) => String(x.email).toLowerCase()));
    const restrictedDetails = restricted.map((x) => ({
      email: x.email,
      reason: x.reason,
      source: x.source,
      notes: x.notes,
      added_at: x.created_at,
    }));

    res.json({
      success: true,
      total_checked: emails.length,
      restricted_count: restrictedSet.size,
      clean_count: emails.length - restrictedSet.size,
      restricted_emails: [...restrictedSet],
      restricted_details: restrictedDetails,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Página / endpoint público de cancelamento de inscrição (link do rodapé automático).
 * O token carrega o tenant_id da campanha/envio — grava SOMENTE na lista daquele tenant.
 * GET ou POST /api/public/email-unsubscribe?t=TOKEN
 */
export const publicEmailUnsubscribe = async (req: Request, res: Response) => {
  try {
    const { parseUnsubscribeToken } = require('../utils/email-unsubscribe');
    const token = String(req.query.t || req.body?.t || '').trim();
    const parsed = parseUnsubscribeToken(token);
    if (!parsed) {
      return res.status(400).send(unsubscribeHtmlPage({
        ok: false,
        title: 'Link inválido',
        message: 'Este link de cancelamento é inválido ou expirou. Se o problema continuar, responda o e-mail pedindo para sair da lista.',
      }));
    }

    // Só grava no tenant embutido no link (nunca em lista global / outro tenant)
    const tenantOk = await pool.query(
      `SELECT id FROM tenants WHERE id=$1 LIMIT 1`,
      [parsed.tenantId]
    );
    if (!tenantOk.rows[0]) {
      return res.status(400).send(unsubscribeHtmlPage({
        ok: false,
        title: 'Link inválido',
        message: 'Este link não pertence a um remetente válido.',
      }));
    }

    // Confirma que a campanha (se houver) realmente é desse tenant — evita token adulterado
    if (parsed.campaignId) {
      const camp = await pool.query(
        `SELECT id FROM email_marketing_campaigns WHERE id=$1 AND tenant_id=$2 LIMIT 1`,
        [parsed.campaignId, parsed.tenantId]
      );
      if (!camp.rows[0]) {
        return res.status(400).send(unsubscribeHtmlPage({
          ok: false,
          title: 'Link inválido',
          message: 'Este link não corresponde à campanha do remetente.',
        }));
      }
    }
    if (parsed.singleSendId) {
      const single = await pool.query(
        `SELECT id FROM email_marketing_single_sends WHERE id=$1 AND tenant_id=$2 LIMIT 1`,
        [parsed.singleSendId, parsed.tenantId]
      );
      if (!single.rows[0]) {
        return res.status(400).send(unsubscribeHtmlPage({
          ok: false,
          title: 'Link inválido',
          message: 'Este link não corresponde ao envio do remetente.',
        }));
      }
    }

    const noteParts = ['Cancelamento via link do rodapé'];
    if (parsed.campaignId) noteParts.push(`campanha #${parsed.campaignId}`);
    if (parsed.singleSendId) noteParts.push(`envio único #${parsed.singleSendId}`);
    noteParts.push(`tenant #${parsed.tenantId}`);

    try {
      await upsertEmailRestriction({
        tenantId: parsed.tenantId,
        email: parsed.email,
        reason: 'opt_out',
        source: 'unsubscribe_link',
        notes: noteParts.join(' · '),
      });
    } catch (e: any) {
      console.error('[unsubscribe] erro ao gravar:', e.message);
      return res.status(500).send(unsubscribeHtmlPage({
        ok: false,
        title: 'Erro temporário',
        message: 'Não foi possível processar o cancelamento agora. Tente novamente em alguns minutos.',
      }));
    }

    console.log(
      `[unsubscribe] tenant=${parsed.tenantId} email=${parsed.email}` +
      (parsed.campaignId ? ` campaign=${parsed.campaignId}` : '') +
      (parsed.singleSendId ? ` single=${parsed.singleSendId}` : '')
    );

    return res.status(200).send(unsubscribeHtmlPage({
      ok: true,
      title: 'Inscrição cancelada',
      message: `O e-mail <strong>${escapeHtml(parsed.email)}</strong> foi removido da lista de marketing deste remetente. Outros remetentes (outras empresas) não são afetados.`,
    }));
  } catch (error: any) {
    return res.status(500).send(unsubscribeHtmlPage({
      ok: false,
      title: 'Erro',
      message: 'Não foi possível processar o cancelamento.',
    }));
  }
};

function escapeHtml(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function unsubscribeHtmlPage(opts: { ok: boolean; title: string; message: string }): string {
  const color = opts.ok ? '#16a34a' : '#dc2626';
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${opts.title} | NettSistemas</title>
  <style>
    body{margin:0;font-family:Segoe UI,Arial,sans-serif;background:#0f172a;color:#e2e8f0;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px;}
    .card{max-width:480px;width:100%;background:#1e293b;border:1px solid #334155;border-radius:16px;padding:32px;text-align:center;box-shadow:0 20px 50px rgba(0,0,0,.35);}
    h1{margin:0 0 12px;font-size:1.5rem;color:${color};}
    p{margin:0;line-height:1.6;color:#cbd5e1;font-size:1rem;}
    .brand{margin-top:24px;font-size:.85rem;color:#64748b;}
  </style>
</head>
<body>
  <div class="card">
    <h1>${opts.title}</h1>
    <p>${opts.message}</p>
    <div class="brand">NettSistemas · E-mail Marketing</div>
  </div>
</body>
</html>`;
}
