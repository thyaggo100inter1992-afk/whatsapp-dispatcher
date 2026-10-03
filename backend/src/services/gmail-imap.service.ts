import crypto from 'crypto';
import { simpleParser } from 'mailparser';
import { pool } from '../database/connection';

const GMAIL_HOST = 'imap.gmail.com';
const GMAIL_PORT = 993;

let tableReady = false;

function secretKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || 'default-key-32-chars-minimum!!';
  return crypto.createHash('sha256').update(String(raw)).digest();
}

export function encryptGmailPassword(plain: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', secretKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${enc.toString('hex')}`;
}

export function decryptGmailPassword(stored: string): string {
  const [ivHex, dataHex] = String(stored || '').split(':');
  if (!ivHex || !dataHex) throw new Error('Senha salva está inválida. Remova a conta e adicione de novo.');
  const decipher = crypto.createDecipheriv('aes-256-cbc', secretKey(), Buffer.from(ivHex, 'hex'));
  const dec = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
  return dec.toString('utf8');
}

export async function ensureGmailAccountsTable() {
  if (tableReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS email_gmail_accounts (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      email VARCHAR(255) NOT NULL,
      display_name VARCHAR(255),
      password_encrypted TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      CONSTRAINT uq_email_gmail_accounts_tenant_email UNIQUE (tenant_id, email)
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_email_gmail_accounts_tenant
      ON email_gmail_accounts (tenant_id)
  `);
  await pool.query(`ALTER TABLE email_gmail_accounts ALTER COLUMN password_encrypted DROP NOT NULL`).catch(() => {});
  await pool.query(`ALTER TABLE email_gmail_accounts ADD COLUMN IF NOT EXISTS profile_dir TEXT`).catch(() => {});
  await pool.query(`ALTER TABLE email_gmail_accounts ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0`).catch(() => {});
  tableReady = true;
}

export function friendlyImapError(error: any): string {
  const msg = String(error?.responseText || error?.message || error || '');
  if (/Senha salva está inválida/i.test(msg)) return msg;
  if (
    error?.authenticationFailed ||
    /auth|invalid credentials|application-specific password|username and password not accepted|web login required/i.test(msg)
  ) {
    return 'O Gmail recusou o usuário ou a senha. A senha normal da conta Google não entra por aqui. Em Conta Google → Segurança → Senhas de app, gere uma senha de app e use essa senha.';
  }
  if (/imap is disabled|imap access is disabled|not enabled/i.test(msg)) {
    return 'O IMAP está desligado nesta conta. No Gmail: Configurações → Ver todas as configurações → Encaminhamento e POP/IMAP → Ativar IMAP.';
  }
  if (/timed out|timeout|ENOTFOUND|ECONNREFUSED|socket/i.test(msg)) {
    return 'Não consegui falar com o servidor do Gmail agora. Tente de novo em instantes.';
  }
  return 'Não foi possível conectar no Gmail. Confira o e-mail, a senha de app e se o IMAP está ativo.';
}

function folderRank(specialUse: string, path: string): number {
  const s = (specialUse || '').toLowerCase();
  const p = path.toLowerCase();
  if (s.includes('inbox') || p === 'inbox') return 0;
  if (s.includes('junk') || p.includes('spam') || p.includes('lixo')) return 1;
  if (s.includes('sent') || p.includes('sent') || p.includes('enviad')) return 2;
  if (s.includes('draft') || p.includes('rascunho')) return 3;
  if (s.includes('trash') || p.includes('trash') || p.includes('lixeira')) return 4;
  if (s.includes('flag') || p.includes('estrela') || p.includes('starred')) return 5;
  if (s.includes('important') || p.includes('important')) return 6;
  if (s.includes('\\all') || s === '\\all' || p.includes('all mail') || p.includes('todos')) return 7;
  return 20;
}

export function folderLabel(specialUse: string, path: string, name: string): string {
  const rank = folderRank(specialUse, path);
  if (rank === 0) return 'Caixa de entrada';
  if (rank === 1) return 'Spam';
  if (rank === 2) return 'Enviados';
  if (rank === 3) return 'Rascunhos';
  if (rank === 4) return 'Lixeira';
  if (rank === 5) return 'Com estrela';
  if (rank === 6) return 'Importantes';
  if (rank === 7) return 'Todos os e-mails';
  const clean = String(name || path || '').replace(/^\[Gmail\]\//i, '').trim();
  return clean || path;
}

async function withGmailClient<T>(email: string, password: string, fn: (client: any) => Promise<T>): Promise<T> {
  const { ImapFlow } = await import('imapflow');
  const client = new ImapFlow({
    host: GMAIL_HOST,
    port: GMAIL_PORT,
    secure: true,
    auth: { user: email, pass: password },
    logger: false,
    connectionTimeout: 20000,
    greetingTimeout: 15000,
    socketTimeout: 45000,
  });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    try { await client.logout(); } catch { try { client.close(); } catch { /* ignore */ } }
  }
}

export async function testGmailLogin(email: string, password: string) {
  await withGmailClient(email, password, async () => true);
}

export async function listGmailFolders(email: string, password: string) {
  return withGmailClient(email, password, async (client) => {
    const listed = await client.list();
    const folders: Array<{
      path: string;
      name: string;
      label: string;
      special_use: string;
      messages: number;
      unseen: number;
    }> = [];

    for (const box of listed || []) {
      const flags: Set<string> = box.flags || new Set();
      if (flags.has('\\Noselect') || flags.has('\\NonExistent')) continue;
      const path = String(box.path || '');
      if (!path) continue;
      let messages = 0;
      let unseen = 0;
      try {
        const status = await client.status(path, { messages: true, unseen: true });
        messages = Number(status?.messages || 0);
        unseen = Number(status?.unseen || 0);
      } catch { /* pasta sem status */ }
      const special = String(box.specialUse || '');
      folders.push({
        path,
        name: String(box.name || path),
        label: folderLabel(special, path, box.name),
        special_use: special,
        messages,
        unseen,
      });
    }

    folders.sort((a, b) => {
      const d = folderRank(a.special_use, a.path) - folderRank(b.special_use, b.path);
      if (d !== 0) return d;
      return a.label.localeCompare(b.label, 'pt');
    });
    return folders;
  });
}

function addr(list: any[] | undefined) {
  const first = Array.isArray(list) ? list[0] : null;
  return {
    name: first?.name ? String(first.name) : '',
    email: first?.address ? String(first.address) : '',
  };
}

function formatAddrList(list: any[] | undefined) {
  if (!Array.isArray(list)) return '';
  return list
    .map((a) => (a?.name ? `${a.name} <${a.address || ''}>` : String(a?.address || '')))
    .filter(Boolean)
    .join(', ');
}

export async function listGmailMessages(email: string, password: string, folderPath: string, limit = 40) {
  const safeLimit = Math.min(Math.max(Number(limit) || 40, 1), 80);
  return withGmailClient(email, password, async (client) => {
    const lock = await client.getMailboxLock(folderPath);
    try {
      const total = Number(client.mailbox?.exists || 0);
      if (!total) return { total: 0, messages: [] as any[] };
      const start = Math.max(1, total - safeLimit + 1);
      const rows: any[] = [];
      for await (const msg of client.fetch(`${start}:*`, {
        uid: true,
        flags: true,
        envelope: true,
        bodyStructure: true,
      })) {
        const flags: Set<string> = msg.flags || new Set();
        const from = addr(msg.envelope?.from);
        const hasAttachments = JSON.stringify(msg.bodyStructure || {}).includes('"attachment"')
          || JSON.stringify(msg.bodyStructure || {}).toLowerCase().includes('filename');
        rows.push({
          uid: Number(msg.uid),
          subject: String(msg.envelope?.subject || '(sem assunto)'),
          from_name: from.name,
          from_email: from.email,
          to: formatAddrList(msg.envelope?.to),
          date: msg.envelope?.date ? new Date(msg.envelope.date).toISOString() : null,
          is_read: flags.has('\\Seen'),
          has_attachments: hasAttachments,
        });
      }
      rows.sort((a, b) => {
        const da = a.date ? new Date(a.date).getTime() : 0;
        const db = b.date ? new Date(b.date).getTime() : 0;
        return db - da;
      });
      return { total, messages: rows };
    } finally {
      lock.release();
    }
  });
}

function inlineCidImages(html: string, attachments: any[]) {
  let out = html || '';
  for (const file of attachments || []) {
    if (!file?.cid || !file?.content) continue;
    const type = String(file.contentType || '');
    if (!type.startsWith('image/')) continue;
    const size = Number(file.size || file.content?.length || 0);
    if (size > 800000) continue;
    const cid = String(file.cid).replace(/[<>]/g, '');
    const data = `data:${type};base64,${file.content.toString('base64')}`;
    out = out.split(`cid:${cid}`).join(data);
  }
  return out;
}

export async function getGmailMessage(email: string, password: string, folderPath: string, uid: number) {
  return withGmailClient(email, password, async (client) => {
    const lock = await client.getMailboxLock(folderPath);
    try {
      const downloaded = await client.fetchOne(String(uid), {
        uid: true,
        flags: true,
        envelope: true,
        source: true,
      }, { uid: true });
      if (!downloaded?.source) {
        throw new Error('Mensagem não encontrada nessa pasta.');
      }
      const parsed: any = await simpleParser(downloaded.source);
      try {
        await client.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true });
      } catch { /* leitura ainda segue */ }

      const from = parsed.from?.value?.[0] || {};
      const attachments = (parsed.attachments || []).map((file: any) => ({
        filename: file.filename || 'anexo',
        size: Number(file.size || file.content?.length || 0),
        content_type: file.contentType || 'application/octet-stream',
      }));

      return {
        uid,
        subject: String(parsed.subject || downloaded.envelope?.subject || '(sem assunto)'),
        from_name: String(from.name || ''),
        from_email: String(from.address || ''),
        to: formatAddrList(parsed.to?.value),
        cc: formatAddrList(parsed.cc?.value),
        date: parsed.date ? new Date(parsed.date).toISOString() : null,
        is_read: true,
        body_html: inlineCidImages(String(parsed.html || ''), parsed.attachments || []),
        body_text: String(parsed.text || ''),
        attachments,
      };
    } finally {
      lock.release();
    }
  });
}
