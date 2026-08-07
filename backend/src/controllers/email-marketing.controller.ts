import { Request, Response } from 'express';
import { pool } from '../database/connection';
import FormData from 'form-data';
import Mailgun from 'mailgun.js';
import multer from 'multer';
import csv from 'csv-parser';
import { Readable } from 'stream';

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

// =============================================
// DOMÍNIOS
// =============================================

export const getDomains = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const result = await pool.query(
      `SELECT id, domain, status, dns_records, is_active, created_at FROM email_marketing_domains WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId]
    );
    res.json({ success: true, data: result.rows });
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

    const result = await pool.query(
      `INSERT INTO email_marketing_domains (tenant_id, domain, mailgun_domain_id, smtp_login, smtp_password, status, dns_records)
       VALUES ($1, $2, $3, $4, $5, 'pending', $6)
       ON CONFLICT (tenant_id, domain) DO UPDATE SET status='pending', dns_records=$6, updated_at=NOW()
       RETURNING *`,
      [tenantId, domain, mgDomain.id || mgDomain.domain || domain, mgDomain.smtp_login || `postmaster@${domain}`, mgDomain.smtp_password || '', JSON.stringify(dnsRecords)]
    );

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

    const mg = await getMailgunClient();
    const verification = await mg.domains.verify(domainRow.rows[0].domain) as any;
    const isActive = (verification.domain?.state || verification.state) === 'active';

    await pool.query(
      `UPDATE email_marketing_domains SET status=$1, updated_at=NOW() WHERE id=$2`,
      [isActive ? 'active' : 'unverified', id]
    );

    res.json({ success: true, verified: isActive, status: isActive ? 'active' : 'unverified' });
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
    const result = await mg.messages.create(domain, {
      from: `${from_name} <${from_email}>`,
      to: [to_name ? `${to_name} <${to_email}>` : to_email],
      'h:Reply-To': reply_to || from_email,
      subject,
      html: body_html || undefined,
      text: body_text || 'Por favor, habilite HTML para visualizar este e-mail.',
    });

    res.json({ success: true, message_id: result.id, message: 'E-mail enviado com sucesso' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// =============================================
// WEBHOOK DO MAILGUN (eventos de tracking)
// =============================================

export const mailgunWebhook = async (req: Request, res: Response) => {
  try {
    const event = req.body['event-data'] || req.body;
    const eventType = event?.event;
    const messageId = event?.message?.headers?.['message-id'] || event?.['message-id'];
    const recipient = event?.recipient;

    if (!eventType || !messageId) return res.json({ success: true });

    const statusMap: Record<string, string> = {
      delivered: 'sent',
      opened: 'opened',
      clicked: 'clicked',
      bounced: 'bounced',
      complained: 'complained',
      failed: 'failed',
    };
    const newStatus = statusMap[eventType];
    if (!newStatus) return res.json({ success: true });

    const timestampField = eventType === 'opened' ? 'opened_at' : eventType === 'clicked' ? 'clicked_at' : 'sent_at';

    await pool.query(
      `UPDATE email_marketing_recipients SET status=$1, ${timestampField}=NOW(), updated_at=NOW()
       WHERE mailgun_message_id=$2 AND email=$3`,
      [newStatus, messageId, recipient]
    );

    // Atualiza contadores da campanha
    const counterField: Record<string, string> = {
      sent: 'sent_count',
      opened: 'opened_count',
      clicked: 'clicked_count',
      bounced: 'bounced_count',
      complained: 'complained_count',
      failed: 'failed_count',
    };
    if (counterField[newStatus]) {
      const recip = await pool.query(`SELECT campaign_id FROM email_marketing_recipients WHERE mailgun_message_id=$1 AND email=$2`, [messageId, recipient]);
      if (recip.rows[0]) {
        await pool.query(`UPDATE email_marketing_campaigns SET ${counterField[newStatus]}=${counterField[newStatus]}+1, updated_at=NOW() WHERE id=$1`, [recip.rows[0].campaign_id]);
      }
    }

    res.json({ success: true });
  } catch (error: any) {
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
