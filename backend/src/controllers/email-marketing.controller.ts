import { Request, Response } from 'express';
import { pool } from '../database/connection';
import FormData from 'form-data';
import Mailgun from 'mailgun.js';
import multer from 'multer';
import csv from 'csv-parser';
import { Readable } from 'stream';
import * as dns from 'dns';
import { promisify } from 'util';

const resolveTxt  = promisify(dns.resolveTxt);
const resolveMx   = promisify(dns.resolveMx);
const resolveCname = promisify(dns.resolveCname);

// Verifica o status real de cada registro DNS diretamente (independente da API do provedor)
async function checkDnsRecord(rec: any, domain: string): Promise<'valid' | 'unknown'> {
  try {
    const type = (rec.record_type || rec.type || '').toUpperCase();
    const name = rec.name || domain;
    const expectedValue = (rec.value || '').toLowerCase().trim();

    if (type === 'TXT') {
      const results = await resolveTxt(name);
      const flat = results.map((r: string[]) => r.join('').toLowerCase().trim());
      return flat.some((v: string) => v === expectedValue || v.includes(expectedValue.substring(0, 20))) ? 'valid' : 'unknown';
    }

    if (type === 'MX') {
      const results = await resolveMx(domain);
      const found = results.some((r: any) => (r.exchange || '').toLowerCase().replace(/\.$/, '') === expectedValue.replace(/\.$/, ''));
      return found ? 'valid' : 'unknown';
    }

    if (type === 'CNAME') {
      const result = await resolveCname(name);
      const resolved = (result[0] || result || '').toString().toLowerCase().replace(/\.$/, '');
      const expected = expectedValue.replace(/\.$/, '');
      return resolved === expected ? 'valid' : 'unknown';
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

    // Buscar registros DNS atuais do banco
    let storedDns: any[] = domainRow.rows[0].dns_records || [];

    // Garantir que o registro DMARC sempre está na lista
    const hasDmarc = storedDns.some((r: any) => (r.name || '').startsWith('_dmarc.'));
    if (!hasDmarc) {
      storedDns.push({
        record_type: 'TXT',
        name: `_dmarc.${domainName}`,
        value: `v=DMARC1; p=none; rua=mailto:dmarc@${domainName}`,
        valid: 'unknown',
        _is_dmarc: true
      });
    }

    // Verificar cada registro DNS diretamente (sem depender da API do provedor)
    const checkedDns = await Promise.all(
      storedDns.map(async (rec: any) => ({
        ...rec,
        valid: await checkDnsRecord(rec, domainName)
      }))
    );

    // Domínio está ativo quando os registros ESSENCIAIS de envio estão válidos:
    // SPF (TXT com v=spf1) + DKIM (TXT com smtp._domainkey)
    const spfOk = checkedDns.some((r: any) =>
      (r.record_type || r.type || '').toUpperCase() === 'TXT' &&
      !(r.name || '').includes('_domainkey') &&
      r.valid === 'valid'
    );
    const dkimOk = checkedDns.some((r: any) =>
      (r.record_type || r.type || '').toUpperCase() === 'TXT' &&
      (r.name || '').includes('_domainkey') &&
      r.valid === 'valid'
    );
    const allVerified = checkedDns.every((r: any) => r.valid === 'valid');
    const canSend = spfOk && dkimOk;
    const newStatus = allVerified ? 'active' : (canSend ? 'active' : 'unverified');

    // Também notificar o provedor da verificação (best-effort, erros ignorados)
    try {
      const mg = await getMailgunClient();
      await mg.domains.verify(domainName);
    } catch { /* ignorar erros do provedor */ }

    const dnsToSave = JSON.stringify(checkedDns);
    await pool.query(
      `UPDATE email_marketing_domains SET status=$1, dns_records=$3, verified_at=${canSend ? 'NOW()' : 'NULL'}, updated_at=NOW() WHERE id=$2`,
      [newStatus, id, dnsToSave]
    );

    // Quando o domínio está ativo, garantir que webhooks estejam registrados
    if (canSend) {
      registerMailgunWebhooks(domainName).catch(() => {});
    }

    const updated = await pool.query(`SELECT * FROM email_marketing_domains WHERE id=$1`, [id]);
    res.json({ success: true, verified: canSend, allVerified, status: newStatus, data: updated.rows[0] });
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
    const { name, subject, from_name, from_email, reply_to, domain_id, list_id, template_id, body_html, body_text, delay_seconds } = req.body;
    if (!name || !subject || !from_name || !from_email) {
      return res.status(400).json({ success: false, message: 'Nome, assunto, remetente e email obrigatórios' });
    }
    const result = await pool.query(
      `INSERT INTO email_marketing_campaigns (tenant_id, name, subject, from_name, from_email, reply_to, domain_id, list_id, template_id, body_html, body_text, delay_seconds)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [tenantId, name, subject, from_name, from_email, reply_to || null, domain_id || null, list_id || null, template_id || null, body_html || null, body_text || null, delay_seconds || 1]
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
    if (!['draft', 'paused'].includes(campaign.rows[0].status)) {
      return res.status(400).json({ success: false, message: 'Campanha não pode ser iniciada no status atual' });
    }

    // Carrega contatos da lista
    if (campaign.rows[0].list_id) {
      const contacts = await pool.query(
        `SELECT email, name FROM email_marketing_contacts WHERE list_id=$1 AND tenant_id=$2 AND status='active'`,
        [campaign.rows[0].list_id, tenantId]
      );
      // Insere recipients se não existirem
      for (const c of contacts.rows) {
        await pool.query(
          `INSERT INTO email_marketing_recipients (tenant_id, campaign_id, email, name) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
          [tenantId, id, c.email, c.name]
        );
      }
      await pool.query(`UPDATE email_marketing_campaigns SET total_contacts=$1 WHERE id=$2`, [contacts.rows.length, id]);
    }

    await pool.query(
      `UPDATE email_marketing_campaigns SET status='sending', started_at=NOW(), updated_at=NOW() WHERE id=$1`,
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
    const htmlBody = body_html || (body_text ? `<div style="font-family:Arial,sans-serif">${body_text.replace(/\n/g,'<br>')}</div>` : undefined);
    const result = await mg.messages.create(domain, {
      from: `${from_name} <${from_email}>`,
      to: [to_name ? `${to_name} <${to_email}>` : to_email],
      'h:Reply-To': reply_to || from_email,
      subject,
      html: htmlBody,
      text: body_text || 'Por favor, habilite HTML para visualizar este e-mail.',
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

export const mailgunWebhook = async (req: Request, res: Response) => {
  try {
    console.log(`[webhook-mailgun] CHAMADO! content-type=${req.headers['content-type']} content-length=${req.headers['content-length']} body-type=${typeof req.body} isBuffer=${Buffer.isBuffer(req.body)} body=${JSON.stringify(req.body).substring(0,200)}`);
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

    // 1. Atualizar destinatários de campanhas
    await pool.query(
      `UPDATE email_marketing_recipients
       SET status=$1, opened_at=${openedAt}, clicked_at=${clickedAt}, updated_at=NOW()
       WHERE mailgun_message_id=$2 AND email=$3`,
      [newStatus, messageId, recipient]
    );

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
