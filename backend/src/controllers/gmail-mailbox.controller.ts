import { Request, Response } from 'express';
import { pool } from '../database/connection';
import {
  decryptGmailPassword,
  encryptGmailPassword,
  ensureGmailAccountsTable,
  friendlyImapError,
  getGmailMessage,
  listGmailFolders,
  listGmailMessages,
  testGmailLogin,
} from '../services/gmail-imap.service';
import {
  closeGmailBrowser,
  createBrowserAccount,
  destroyGmailProfile,
  friendlyBrowserError,
  getGmailBrowserFrame,
  gmailProfileDir,
  openGmailBrowser,
  sendGmailBrowserInput,
} from '../services/gmail-browser.service';

function requireTenant(req: Request, res: Response): number | null {
  const tenantId = (req as any).tenant?.id || (req as any).user?.tenant_id || (req as any).tenantId || null;
  if (!tenantId) {
    res.status(401).json({ success: false, message: 'Tenant não identificado' });
    return null;
  }
  return Number(tenantId);
}

function normalizeEmail(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

async function loadAccount(tenantId: number, id: number) {
  await ensureGmailAccountsTable();
  const result = await pool.query(
    `SELECT id, tenant_id, email, display_name, password_encrypted, profile_dir
     FROM email_gmail_accounts
     WHERE id = $1 AND tenant_id = $2`,
    [id, tenantId]
  );
  return result.rows[0] || null;
}

export const listGmailAccounts = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    await ensureGmailAccountsTable();
    const result = await pool.query(
      `SELECT id, email, display_name, sort_order, created_at, updated_at
       FROM email_gmail_accounts
       WHERE tenant_id = $1
       ORDER BY sort_order ASC, created_at DESC`,
      [tenantId]
    );
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createGmailAccount = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || '').replace(/\s+/g, '');
    const displayName = String(req.body?.display_name || '').trim() || null;

    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, message: 'Informe o e-mail da conta Gmail.' });
    }
    if (password.trim().length < 6) {
      return res.status(400).json({ success: false, message: 'Informe a senha de app do Gmail.' });
    }

    try {
      await testGmailLogin(email, password);
    } catch (error: any) {
      return res.status(400).json({ success: false, message: friendlyImapError(error) });
    }

    await ensureGmailAccountsTable();
    const encrypted = encryptGmailPassword(password);
    const saved = await pool.query(
      `INSERT INTO email_gmail_accounts (tenant_id, email, display_name, password_encrypted)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tenant_id, email)
       DO UPDATE SET
         display_name = EXCLUDED.display_name,
         password_encrypted = EXCLUDED.password_encrypted,
         updated_at = NOW()
       RETURNING id, email, display_name, created_at, updated_at`,
      [tenantId, email, displayName, encrypted]
    );

    res.json({
      success: true,
      data: saved.rows[0],
      message: 'Conta Gmail conectada. A senha ficou salva só neste sistema.',
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const reorderGmailAccounts = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const ids = Array.isArray(req.body?.ids)
      ? req.body.ids.map((value: unknown) => Number(value)).filter((value: number) => Number.isInteger(value) && value > 0)
      : [];
    if (!ids.length) {
      return res.status(400).json({ success: false, message: 'Informe a ordem dos cards.' });
    }
    await ensureGmailAccountsTable();
    await pool.query(
      `UPDATE email_gmail_accounts AS account
       SET sort_order = ordered.position, updated_at = NOW()
       FROM unnest($1::int[], $2::int[]) AS ordered(id, position)
       WHERE account.id = ordered.id AND account.tenant_id = $3`,
      [ids, ids.map((_: number, index: number) => index), tenantId]
    );
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteGmailAccount = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    await ensureGmailAccountsTable();
    const removed = await pool.query(
      `DELETE FROM email_gmail_accounts WHERE id = $1 AND tenant_id = $2 RETURNING id, email, profile_dir`,
      [req.params.id, tenantId]
    );
    if (!removed.rows[0]) {
      return res.status(404).json({ success: false, message: 'Conta não encontrada' });
    }
    await destroyGmailProfile(tenantId, Number(removed.rows[0].id), removed.rows[0].profile_dir);
    res.json({ success: true, message: 'Conta removida deste sistema. Nada foi apagado no Gmail.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

async function accountProfile(tenantId: number, id: number) {
  const account = await loadAccount(tenantId, id);
  if (!account) return null;
  return account;
}

export const saveGmailLink = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const email = normalizeEmail(req.body?.email);
    const displayName = String(req.body?.display_name || '').trim() || null;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, message: 'Informe o e-mail da conta Gmail.' });
    }
    await ensureGmailAccountsTable();
    const saved = await pool.query(
      `INSERT INTO email_gmail_accounts (tenant_id, email, display_name, password_encrypted)
       VALUES ($1, $2, $3, NULL)
       ON CONFLICT (tenant_id, email)
       DO UPDATE SET
         display_name = COALESCE(EXCLUDED.display_name, email_gmail_accounts.display_name),
         updated_at = NOW()
       RETURNING id, email, display_name, created_at`,
      [tenantId, email, displayName]
    );
    res.json({ success: true, data: saved.rows[0], message: 'Conta salva. A aba do Chrome vai abrir agora.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createGmailBrowser = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    await ensureGmailAccountsTable();
    const displayName = String(req.body?.display_name || '').trim() || null;
    const account = await createBrowserAccount(tenantId, displayName);
    try {
      await openGmailBrowser(tenantId, account.id, account.profile_dir);
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        data: { id: account.id, email: account.email, display_name: account.display_name },
        message: friendlyBrowserError(error),
      });
    }
    res.json({
      success: true,
      data: { id: account.id, email: account.email, display_name: account.display_name },
      message: 'Navegador aberto. Entre com o e-mail e a senha normal do Gmail.',
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const openGmailBrowserAccount = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const account = await accountProfile(tenantId, Number(req.params.id));
    if (!account) return res.status(404).json({ success: false, message: 'Conta não encontrada' });
    const profileDir = account.profile_dir || gmailProfileDir(tenantId, account.id);
    if (!account.profile_dir) {
      await pool.query(
        `UPDATE email_gmail_accounts SET profile_dir = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3`,
        [profileDir, account.id, tenantId]
      );
    }
    await openGmailBrowser(tenantId, account.id, profileDir);
    res.json({ success: true, message: 'Navegador aberto.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: friendlyBrowserError(error) });
  }
};

export const closeGmailBrowserAccount = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    await closeGmailBrowser(tenantId, Number(req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const gmailBrowserFrame = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const frame = getGmailBrowserFrame(tenantId, Number(req.params.id), Number(req.query.since || 0));
    if (!frame) return res.status(404).json({ success: false, message: 'Navegador fechado' });
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Frame-Version', String(frame.version));
    res.setHeader('X-Page-Url', encodeURIComponent(frame.url || ''));
    res.setHeader('X-Account-Email', encodeURIComponent(frame.email || ''));
    res.setHeader('X-Frame-Width', String(frame.width || 0));
    res.setHeader('X-Frame-Height', String(frame.height || 0));
    if (frame.unchanged || !frame.jpeg) return res.status(204).end();
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Length', String(frame.jpeg.length));
    return res.end(frame.jpeg);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const gmailBrowserInput = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    await sendGmailBrowserInput(tenantId, Number(req.params.id), req.body || {});
    res.json({ success: true });
  } catch (error: any) {
    const message = /Navegador fechado/i.test(String(error?.message || ''))
      ? error.message
      : 'Não consegui enviar o comando para o navegador.';
    res.status(400).json({ success: false, message });
  }
};

export const getGmailFolders = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const account = await loadAccount(tenantId, Number(req.params.id));
    if (!account) return res.status(404).json({ success: false, message: 'Conta não encontrada' });
    const password = decryptGmailPassword(account.password_encrypted);
    const folders = await listGmailFolders(account.email, password);
    res.json({ success: true, data: folders });
  } catch (error: any) {
    res.status(400).json({ success: false, message: friendlyImapError(error) });
  }
};

export const getGmailFolderMessages = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const folder = String(req.query.folder || 'INBOX');
    const account = await loadAccount(tenantId, Number(req.params.id));
    if (!account) return res.status(404).json({ success: false, message: 'Conta não encontrada' });
    const password = decryptGmailPassword(account.password_encrypted);
    const data = await listGmailMessages(account.email, password, folder, Number(req.query.limit || 40));
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(400).json({ success: false, message: friendlyImapError(error) });
  }
};

export const getGmailFolderMessage = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const folder = String(req.query.folder || 'INBOX');
    const uid = Number(req.params.uid);
    if (!uid) return res.status(400).json({ success: false, message: 'Mensagem inválida' });
    const account = await loadAccount(tenantId, Number(req.params.id));
    if (!account) return res.status(404).json({ success: false, message: 'Conta não encontrada' });
    const password = decryptGmailPassword(account.password_encrypted);
    const data = await getGmailMessage(account.email, password, folder, uid);
    res.json({ success: true, data });
  } catch (error: any) {
    const raw = String(error?.message || '');
    if (/não encontrada/i.test(raw)) {
      return res.status(404).json({ success: false, message: raw });
    }
    res.status(400).json({ success: false, message: friendlyImapError(error) });
  }
};
