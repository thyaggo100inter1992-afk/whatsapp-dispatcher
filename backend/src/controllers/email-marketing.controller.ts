import { Request, Response } from 'express';
import { pool } from '../database/connection';
import FormData from 'form-data';
import Mailgun from 'mailgun.js';
import multer from 'multer';
import csv from 'csv-parser';
import { Readable } from 'stream';
import * as dns from 'dns';
import { promisify } from 'util';
import { ensureEmailHtml } from '../utils/email-html';

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

  // SPF: aceita qualquer SPF que inclua mailgun.org (~all ou -all)
  if (e.includes('v=spf1') || a.includes('v=spf1')) {
    return a.includes('v=spf1') && a.includes('include:mailgun.org');
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
        return ex === expected || (expected.includes('mailgun') && ex.includes('mailgun.org'));
      });
      return found ? 'valid' : 'unknown';
    }

    if (type === 'CNAME') {
      try {
        const result = await resolveCname(name);
        const resolved = (result[0] || result || '').toString().toLowerCase().replace(/\.$/, '');
        const expected = expectedValue.toLowerCase().replace(/\.$/, '');
        if (resolved === expected || resolved.endsWith('mailgun.org')) return 'valid';
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

// Helper para pegar credencial Mailgun ativa
async function getMailgunClient() {
  const result = await pool.query(
    `SELECT api_key, region FROM mailgun_credentials WHERE is_active = TRUE LIMIT 1`
  );
  if (!result.rows[0]) throw new Error('Nenhuma credencial Mailgun configurada');
  const { api_key, region } = result.rows[0];
  const mailgun = new Mailgun(FormData);
  const mg = mailgun.client({ username: 'api', key: api_key, url: region === 'eu' ? 'https://api.eu.mailgun.net' : 'https://api.mailgun.net' });
  return mg;
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
      `SELECT id, domain, status, dns_records, is_active, created_at, updated_at, verified_at FROM email_marketing_domains WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId]
    );
    // Garantir que DMARC sempre aparece em cada domínio
    const rows = result.rows.map((row: any) => {
      const dns: any[] = Array.isArray(row.dns_records) ? row.dns_records : [];
      const hasDmarc = dns.some((r: any) => (r.name || '').startsWith('_dmarc.'));
      if (!hasDmarc) {
        dns.push({
          record_type: 'TXT',
          name: `_dmarc.${row.domain}`,
          value: `v=DMARC1; p=none; rua=mailto:dmarc@${row.domain}`,
          valid: 'unknown',
          _is_dmarc: true
        });
      }
      return { ...row, dns_records: dns };
    });
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

    const mg = await getMailgunClient();
    let mgDomain: any;

    try {
      mgDomain = await mg.domains.create({ name: domain }) as any;
    } catch (createError: any) {
      // O Mailgun coloca "domain already exists" em e.details, não em e.message
      const details = (createError.details || '').toLowerCase();
      const msg = (createError.message || '').toLowerCase();
      const alreadyExists = createError.status === 400 &&
        (details.includes('already exists') || details.includes('already been registered') ||
         msg.includes('already exists') || msg.includes('already been registered'));
      if (!alreadyExists) throw createError;
      // Domínio já existe no Mailgun — buscar os dados existentes
      mgDomain = await mg.domains.get(domain) as any;
    }

    const dnsRecords = (mgDomain.receiving_dns_records || []).concat(mgDomain.sending_dns_records || []);

    // Adicionar registro DMARC (não vem do Mailgun — o tenant deve configurar no DNS)
    const dmarcRecord = {
      record_type: 'TXT',
      name: `_dmarc.${domain}`,
      value: `v=DMARC1; p=none; rua=mailto:dmarc@${domain}`,
      valid: 'unknown',
      _is_dmarc: true
    };
    // Só adiciona se ainda não existir
    const hasDmarc = dnsRecords.some((r: any) => (r.name || '').startsWith('_dmarc.'));
    if (!hasDmarc) dnsRecords.push(dmarcRecord);

    const result = await pool.query(
      `INSERT INTO email_marketing_domains (tenant_id, domain, mailgun_domain_id, smtp_login, smtp_password, status, dns_records)
       VALUES ($1, $2, $3, $4, $5, 'pending', $6)
       ON CONFLICT (tenant_id, domain) DO UPDATE SET status='pending', dns_records=$6, updated_at=NOW()
       RETURNING *`,
      [tenantId, domain, mgDomain.id || mgDomain.domain || domain, mgDomain.smtp_login || `postmaster@${domain}`, mgDomain.smtp_password || '', JSON.stringify(dnsRecords)]
    );

    // Registrar webhooks no Mailgun em background (não bloqueia a resposta)
    registerMailgunWebhooks(domain).catch(() => {});

    res.json({ success: true, data: result.rows[0], dns_records: dnsRecords });
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
    const row = await pool.query(`SELECT domain FROM email_marketing_domains WHERE id=$1 AND tenant_id=$2`, [id, tenantId]);
    if (!row.rows[0]) return res.status(404).json({ success: false, message: 'Domínio não encontrado' });

    await registerMailgunWebhooks(row.rows[0].domain);
    res.json({ success: true, message: 'Webhooks registrados com sucesso' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteDomain = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const { id } = req.params;
    await pool.query(`DELETE FROM email_marketing_domains WHERE id=$1 AND tenant_id=$2`, [id, tenantId]);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
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

    const contacts: { email: string; name?: string }[] = [];
    const stream = Readable.from(file.buffer);

    await new Promise<void>((resolve, reject) => {
      stream.pipe(csv())
        .on('data', (row) => {
          const email = row.email || row.Email || row.EMAIL;
          if (email && email.includes('@')) {
            contacts.push({ email: email.trim().toLowerCase(), name: row.name || row.Name || row.nome || '' });
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });

    let inserted = 0;
    for (const c of contacts) {
      try {
        await pool.query(
          `INSERT INTO email_marketing_contacts (tenant_id, list_id, email, name) VALUES ($1,$2,$3,$4) ON CONFLICT (list_id, email) DO NOTHING`,
          [tenantId, list_id, c.email, c.name || null]
        );
        inserted++;
      } catch (_) {}
    }

    await pool.query(`UPDATE email_marketing_lists SET total_contacts=(SELECT COUNT(*) FROM email_marketing_contacts WHERE list_id=$1), updated_at=NOW() WHERE id=$1`, [list_id]);

    res.json({ success: true, imported: inserted, total: contacts.length });
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
      `SELECT id, email, name, status, created_at FROM email_marketing_contacts WHERE list_id=$1 AND tenant_id=$2 ORDER BY created_at DESC LIMIT $3 OFFSET $4`,
      [list_id, tenantId, limit, offset]
    );

    res.json({ success: true, data: result.rows, total: parseInt(total.rows[0].count), page, limit });
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
    const { name, subject, body_html, body_text } = req.body;
    if (!name || !subject) return res.status(400).json({ success: false, message: 'Nome e assunto obrigatórios' });
    const result = await pool.query(
      `INSERT INTO email_marketing_templates (tenant_id, name, subject, body_html, body_text) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [tenantId, name, subject, body_html || null, body_text || null]
    );
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
    const { name, subject, body_html, body_text } = req.body;
    const result = await pool.query(
      `UPDATE email_marketing_templates SET name=$1, subject=$2, body_html=$3, body_text=$4, updated_at=NOW() WHERE id=$5 AND tenant_id=$6 RETURNING *`,
      [name, subject, body_html || null, body_text || null, id, tenantId]
    );
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
      name, reply_to, domain_id, list_id, template_id, body_html, body_text,
      // Legado (compat)
      subject, from_name, from_email,
      // Novos campos avançados
      from_senders,    // [{ from_name, from_email }]
      subjects,        // ["Assunto A", "Assunto B"]
      delay_seconds_min, delay_seconds_max,
      scheduled_at,
      work_start_time, work_end_time,
      pause_after, pause_duration_minutes,
    } = req.body;

    if (!domain_id) {
      return res.status(400).json({ success: false, message: 'Selecione um domínio verificado para envio' });
    }

    const domainRow = await pool.query(
      `SELECT domain, status FROM email_marketing_domains WHERE id=$1 AND tenant_id=$2`,
      [domain_id, tenantId]
    );
    if (!domainRow.rows[0]) {
      return res.status(400).json({ success: false, message: 'Domínio não encontrado' });
    }
    const domainName = domainRow.rows[0].domain;

    // Normaliza remetentes: aceita array novo OU campos legados
    const rawSenders: { from_name: string; from_email: string }[] =
      Array.isArray(from_senders) && from_senders.length > 0
        ? from_senders
        : [{ from_name: from_name || '', from_email: from_email || '' }];

    // Força local@dominio_selecionado (ignora @ de outro domínio digitado)
    const sendersArr = rawSenders.map((s) => {
      const raw = String(s.from_email || '').trim();
      const local = (raw.includes('@') ? raw.split('@')[0] : raw)
        .replace(/[^a-zA-Z0-9._+-]/g, '')
        .toLowerCase();
      return {
        from_name: (s.from_name || '').trim(),
        from_email: local ? `${local}@${domainName}` : '',
      };
    }).filter((s) => s.from_email.includes('@'));

    // Normaliza assuntos: aceita array novo OU campo legado
    const subjectsArr: string[] =
      Array.isArray(subjects) && subjects.length > 0
        ? subjects
        : [subject || ''];

    if (!name || sendersArr.length === 0 || !sendersArr[0].from_email || subjectsArr.length === 0 || !subjectsArr[0]) {
      return res.status(400).json({ success: false, message: 'Nome, ao menos um remetente (parte antes do @) e ao menos um assunto são obrigatórios' });
    }

    // Define status inicial: se agendado para o futuro -> 'scheduled', senão -> 'draft'
    const initStatus = scheduled_at && new Date(scheduled_at) > new Date() ? 'scheduled' : 'draft';

    const result = await pool.query(
      `INSERT INTO email_marketing_campaigns (
         tenant_id, name,
         subject, from_name, from_email,
         from_senders, subjects,
         reply_to, domain_id, list_id, template_id,
         body_html, body_text,
         delay_seconds, delay_seconds_min, delay_seconds_max,
         scheduled_at, work_start_time, work_end_time,
         pause_after, pause_duration_minutes,
         status
       ) VALUES (
         $1,$2,
         $3,$4,$5,
         $6,$7,
         $8,$9,$10,$11,
         $12,$13,
         $14,$15,$16,
         $17,$18,$19,
         $20,$21,
         $22
       ) RETURNING *`,
      [
        tenantId, name,
        subjectsArr[0], sendersArr[0].from_name, sendersArr[0].from_email,
        JSON.stringify(sendersArr), JSON.stringify(subjectsArr),
        reply_to || null, domain_id || null, list_id || null, template_id || null,
        body_html || null, body_text || null,
        delay_seconds_min || 1, delay_seconds_min || 1, delay_seconds_max || 3,
        scheduled_at || null, work_start_time || '08:00', work_end_time || '20:00',
        pause_after || 0, pause_duration_minutes || 30,
        initStatus,
      ]
    );
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
        `SELECT email, name FROM email_marketing_contacts WHERE list_id=$1 AND tenant_id=$2 AND status='active'`,
        [campaign.rows[0].list_id, tenantId]
      );
      for (const c of contacts.rows) {
        await pool.query(
          `INSERT INTO email_marketing_recipients (tenant_id, campaign_id, email, name)
           VALUES ($1,$2,$3,$4)
           ON CONFLICT (campaign_id, email) DO NOTHING`,
          [tenantId, id, c.email, c.name]
        );
      }
      const total = await pool.query(
        `SELECT COUNT(*)::int as total FROM email_marketing_recipients WHERE campaign_id=$1`,
        [id]
      );
      await pool.query(`UPDATE email_marketing_campaigns SET total_contacts=$1 WHERE id=$2`, [total.rows[0].total, id]);
    }

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

    // Domínio + remetentes (sempre força local@dominio)
    let domainName: string | null = null;

    if (domain_id !== undefined) {
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
      domainName = domainRow.rows[0].domain;
      push('domain_id', domain_id);
    } else if (from_senders !== undefined || from_email !== undefined) {
      // Precisa do domínio atual da campanha para normalizar remetentes
      const cur = await pool.query(
        `SELECT c.domain_id, d.domain
         FROM email_marketing_campaigns c
         LEFT JOIN email_marketing_domains d ON d.id = c.domain_id
         WHERE c.id=$1 AND c.tenant_id=$2`,
        [id, tenantId]
      );
      domainName = cur.rows[0]?.domain || null;
    }

    if (from_senders !== undefined || from_email !== undefined) {
      if (!domainName) {
        return res.status(400).json({
          success: false,
          message: 'Campanha sem domínio. Selecione um domínio verificado antes de alterar remetentes.',
        });
      }

      const rawSenders: { from_name: string; from_email: string }[] =
        Array.isArray(from_senders) && from_senders.length > 0
          ? from_senders
          : [{ from_name: from_name || '', from_email: from_email || '' }];

      const sendersArr = rawSenders.map((s) => {
        const raw = String(s.from_email || '').trim();
        const local = (raw.includes('@') ? raw.split('@')[0] : raw)
          .replace(/[^a-zA-Z0-9._+-]/g, '')
          .toLowerCase();
        return {
          from_name: (s.from_name || '').trim(),
          from_email: local ? `${local}@${domainName}` : '',
        };
      }).filter((s) => s.from_email.includes('@'));

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
    const result = await pool.query(
      `SELECT total_contacts, sent_count, failed_count, opened_count, clicked_count, bounced_count, complained_count, status, started_at, completed_at
       FROM email_marketing_campaigns WHERE id=$1 AND tenant_id=$2`,
      [id, tenantId]
    );
    res.json({ success: true, data: result.rows[0] });
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

    const result = await pool.query(
      `SELECT id, email, name, status, error_message, sent_at, opened_at, clicked_at, updated_at
       FROM email_marketing_recipients r
       WHERE campaign_id=$1 AND tenant_id=$2${whereExtra}
       ORDER BY COALESCE(sent_at, updated_at, created_at) DESC NULLS LAST, id DESC
       LIMIT $${params.length}`,
      params
    );
    res.json({ success: true, data: result.rows, total: result.rowCount });
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
       SET failed_count=0,
           status=CASE WHEN status IN ('completed','paused','failed','cancelled') THEN 'sending' ELSE status END,
           completed_at=NULL,
           pause_started_at=NULL,
           sent_in_session=0,
           updated_at=NOW()
       WHERE id=$1 AND tenant_id=$2`,
      [id, tenantId]
    );

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
    const { to_email, to_name, from_name, from_email, reply_to, subject, body_html, body_text, domain_id } = req.body;
    if (!to_email || !from_email || !subject) {
      return res.status(400).json({ success: false, message: 'Destinatário, remetente e assunto obrigatórios' });
    }

    // Busca domínio do tenant
    let domain = from_email.split('@')[1];
    if (domain_id) {
      const domainRow = await pool.query(`SELECT domain FROM email_marketing_domains WHERE id=$1 AND tenant_id=$2`, [domain_id, tenantId]);
      if (domainRow.rows[0]) domain = domainRow.rows[0].domain;
    }

    const mg = await getMailgunClient();
    const prepared = ensureEmailHtml(body_html, body_text);
    const result = await mg.messages.create(domain, {
      from: `${from_name} <${from_email}>`,
      to: [to_name ? `${to_name} <${to_email}>` : to_email],
      'h:Reply-To': reply_to || from_email,
      subject,
      html: prepared.html,
      text: prepared.text,
      'o:tracking': 'yes',
      'o:tracking-clicks': 'yes',
      'o:tracking-opens': 'yes',
    } as any);

    // Salvar no histórico de envios
    const userId = (req as any).user?.id || (req as any).tenant?.userId || null;
    const userName = (req as any).user?.name || (req as any).user?.username || null;
    // Normalizar message ID removendo < > para consistência com o webhook
    const rawMsgId = (result as any).id || (result as any).message_id || '';
    const msgId = rawMsgId.replace(/^<|>$/g, '').trim() || null;
    await pool.query(
      `INSERT INTO email_marketing_single_sends
       (tenant_id, user_id, user_name, to_email, to_name, from_email, from_name, subject, domain_id, mailgun_message_id, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'sent')`,
      [tenantId, userId, userName, to_email, to_name || null, from_email, from_name || null, subject, domain_id || null, msgId]
    );

    res.json({ success: true, message_id: msgId, message: 'E-mail enviado com sucesso' });
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
        s.status, 1 as total_contacts, 1 as sent_count, 0 as failed_count,
        CASE WHEN s.opened_at IS NOT NULL THEN 1 ELSE 0 END as opened_count,
        CASE WHEN s.clicked_at IS NOT NULL THEN 1 ELSE 0 END as clicked_count,
        0 as bounced_count, 0 as complained_count,
        s.created_at as sent_at, s.created_at,
        s.to_email, s.to_name,
        s.mailgun_message_id
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

    const openedAt  = eventType === 'opened'  ? 'NOW()' : 'opened_at';
    const clickedAt = eventType === 'clicked' ? 'NOW()' : 'clicked_at';
    const deliveryError =
      eventType === 'failed' || eventType === 'bounced'
        ? formatMailgunDeliveryError(event)
        : null;
    if (deliveryError) {
      console.log(`[webhook-mailgun] motivo: ${deliveryError}`);
    }

    // 1. Atualizar destinatários de campanhas (grava motivo da falha quando vier do Mailgun)
    if (deliveryError) {
      await pool.query(
        `UPDATE email_marketing_recipients
         SET status=$1, error_message=$2, opened_at=${openedAt}, clicked_at=${clickedAt}, updated_at=NOW()
         WHERE mailgun_message_id=$3 AND email=$4`,
        [newStatus, deliveryError, messageId, recipient]
      );
    } else {
      await pool.query(
        `UPDATE email_marketing_recipients
         SET status=$1, opened_at=${openedAt}, clicked_at=${clickedAt}, updated_at=NOW()
         WHERE mailgun_message_id=$2 AND email=$3`,
        [newStatus, messageId, recipient]
      );
    }

    // 2. Atualizar envios únicos — busca com e sem <> para compatibilidade
    const msgIdWithBrackets = `<${messageId}>`;
    await pool.query(
      `UPDATE email_marketing_single_sends
       SET status=$1, opened_at=${openedAt}, clicked_at=${clickedAt}, updated_at=NOW()
       WHERE mailgun_message_id = $2 OR mailgun_message_id = $3`,
      [newStatus, messageId, msgIdWithBrackets]
    );

    // 3. Atualizar contadores da campanha
    const counterField: Record<string, string> = {
      sent: 'sent_count', opened: 'opened_count', clicked: 'clicked_count',
      bounced: 'bounced_count', complained: 'complained_count', failed: 'failed_count',
    };
    if (counterField[newStatus]) {
      const recip = await pool.query(
        `SELECT campaign_id FROM email_marketing_recipients WHERE mailgun_message_id=$1 AND email=$2 LIMIT 1`,
        [messageId, recipient]
      );
      if (recip.rows[0]) {
        await pool.query(
          `UPDATE email_marketing_campaigns SET ${counterField[newStatus]}=${counterField[newStatus]}+1, updated_at=NOW() WHERE id=$1`,
          [recip.rows[0].campaign_id]
        );
      }
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
