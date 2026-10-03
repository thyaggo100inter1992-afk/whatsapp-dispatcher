import crypto from 'crypto';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { pool } from '../database/connection';

const VIEWPORT = { width: 1280, height: 720 };
const IDLE_MS = 20 * 60 * 1000;

type GmailSession = {
  tenantId: number;
  accountId: number;
  profileDir: string;
  context: any;
  page: any;
  shotTimer: NodeJS.Timeout | null;
  image: string | null;
  version: number;
  width: number;
  height: number;
  url: string;
  email: string;
  lastInputAt: number;
  lastIdentityCheck: number;
};

const sessions = new Map<string, GmailSession>();

function sessionKey(tenantId: number, accountId: number) {
  return `${tenantId}:${accountId}`;
}

export function gmailProfileDir(tenantId: number, accountId: number) {
  return path.join(process.cwd(), 'data', 'gmail-profiles', String(tenantId), String(accountId));
}

export function friendlyBrowserError(error: any): string {
  const msg = String(error?.message || error || '');
  if (/Executable doesn't exist|Failed to launch|browserType\.launch|chromium/i.test(msg)) {
    return 'O navegador ainda não está instalado neste servidor. É preciso instalar o Chromium e tentar de novo.';
  }
  return 'Não consegui abrir o navegador desta conta. Tente novamente.';
}

function placeholderEmail() {
  return `pendente-${crypto.randomBytes(6).toString('hex')}@sessao.local`;
}

export async function createBrowserAccount(tenantId: number, displayName?: string | null) {
  const inserted = await pool.query(
    `INSERT INTO email_gmail_accounts (tenant_id, email, display_name, password_encrypted, profile_dir)
     VALUES ($1, $2, $3, NULL, NULL)
     RETURNING id, email, display_name, created_at`,
    [tenantId, placeholderEmail(), displayName || null]
  );
  const row = inserted.rows[0];
  const profileDir = gmailProfileDir(tenantId, row.id);
  await fs.promises.mkdir(profileDir, { recursive: true });
  await pool.query(
    `UPDATE email_gmail_accounts SET profile_dir = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3`,
    [profileDir, row.id, tenantId]
  );
  row.profile_dir = profileDir;
  return row;
}

async function ensureDisplay() {
  if (process.platform === 'win32') return;
  process.env.DISPLAY = process.env.DISPLAY || ':99';
  if (process.env.DISPLAY !== ':99') return;
  const sock = '/tmp/.X11-unix/X99';
  if (fs.existsSync(sock)) return;
  spawn('Xvfb', [':99', '-screen', '0', '1366x768x24', '-ac'], { stdio: 'ignore', detached: true }).unref();
  for (let i = 0; i < 30; i++) {
    if (fs.existsSync(sock)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

async function prepareProfile(profileDir: string) {
  const marker = `${profileDir}.chrome-v2`;
  if (!fs.existsSync(marker)) {
    await fs.promises.rm(profileDir, { recursive: true, force: true }).catch(() => undefined);
    await fs.promises.writeFile(marker, 'ok');
  }
  await fs.promises.mkdir(profileDir, { recursive: true });
}

async function launchContext(profileDir: string) {
  await ensureDisplay();
  await prepareProfile(profileDir);
  const { chromium } = await import('patchright');
  const options: any = {
    headless: false,
    viewport: VIEWPORT,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--lang=pt-BR',
      '--window-size=1280,720',
    ],
  };
  try {
    return await chromium.launchPersistentContext(profileDir, { ...options, channel: 'chrome' });
  } catch {
    return await chromium.launchPersistentContext(profileDir, options);
  }
}

async function rememberEmail(session: GmailSession, email: string) {
  session.email = email;
  try {
    await pool.query(
      `UPDATE email_gmail_accounts
       SET email = $1,
           display_name = COALESCE(NULLIF(display_name, ''), $1),
           updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3
         AND (email LIKE '%@sessao.local' OR lower(email) = lower($1))`,
      [email, session.accountId, session.tenantId]
    );
  } catch {
    session.email = email;
  }
}

async function checkIdentity(session: GmailSession) {
  const now = Date.now();
  if (now - session.lastIdentityCheck < 8000) return;
  session.lastIdentityCheck = now;
  try {
    const found = await session.page.evaluate(`(() => {
      const nodes = Array.from(document.querySelectorAll('[aria-label], [data-email]'));
      const blob = nodes.map((node) => (node.getAttribute('aria-label') || '') + ' ' + (node.getAttribute('data-email') || '')).join('\\n');
      const match = blob.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}/i);
      return match ? match[0] : '';
    })()`);
    if (found && found !== session.email && !found.endsWith('@sessao.local')) {
      await rememberEmail(session, found);
    }
  } catch { /* página ainda carregando */ }
}

async function closeSession(key: string) {
  const session = sessions.get(key);
  if (!session) return;
  sessions.delete(key);
  if (session.shotTimer) clearInterval(session.shotTimer);
  try { await session.context.close(); } catch { /* já fechou */ }
}

async function closeTenantSessions(tenantId: number, exceptAccountId?: number) {
  const keys = [...sessions.entries()]
    .filter(([, session]) => session.tenantId === tenantId && session.accountId !== exceptAccountId)
    .map(([key]) => key);
  for (const key of keys) await closeSession(key);
}

export async function openGmailBrowser(tenantId: number, accountId: number, profileDir: string) {
  const key = sessionKey(tenantId, accountId);
  const current = sessions.get(key);
  if (current?.page && !current.page.isClosed()) {
    current.lastInputAt = Date.now();
    return current;
  }
  await closeTenantSessions(tenantId, accountId);
  await closeSession(key);

  const context = await launchContext(profileDir);
  const page = context.pages()[0] || await context.newPage();
  const session: GmailSession = {
    tenantId,
    accountId,
    profileDir,
    context,
    page,
    shotTimer: null,
    image: null,
    version: 0,
    width: VIEWPORT.width,
    height: VIEWPORT.height,
    url: 'https://mail.google.com/mail/u/0/#inbox',
    email: '',
    lastInputAt: Date.now(),
    lastIdentityCheck: 0,
  };
  sessions.set(key, session);

  try {
  let shooting = false;
  session.shotTimer = setInterval(async () => {
    const live = sessions.get(key);
    if (!live || shooting) return;
    shooting = true;
    try {
      const shot = await live.page.screenshot({ type: 'jpeg', quality: 50 });
      live.image = Buffer.from(shot).toString('base64');
      live.version += 1;
      live.url = live.page.url();
      checkIdentity(live).catch(() => undefined);
    } catch { /* página fechando */ }
    shooting = false;
  }, 350);

  page.goto('https://mail.google.com/mail/u/0/#inbox', { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => undefined);
  return session;
  } catch (error) {
    await closeSession(key);
    throw error;
  }
}

export function getGmailBrowserFrame(tenantId: number, accountId: number, since = 0) {
  const session = sessions.get(sessionKey(tenantId, accountId));
  if (!session) return null;
  const same = since > 0 && since === session.version;
  return {
    version: session.version,
    unchanged: same,
    image: same ? null : session.image,
    width: session.width,
    height: session.height,
    url: session.url,
    email: session.email || null,
  };
}

function keyCombo(key: string, modifiers: number) {
  const parts: string[] = [];
  if (modifiers & 2) parts.push('Control');
  if (modifiers & 4) parts.push('Meta');
  if (modifiers & 1) parts.push('Alt');
  if (modifiers & 8) parts.push('Shift');
  parts.push(key);
  return parts.join('+');
}

export async function sendGmailBrowserInput(tenantId: number, accountId: number, input: any) {
  const session = sessions.get(sessionKey(tenantId, accountId));
  if (!session) throw new Error('Navegador fechado. Abra a conta de novo.');
  session.lastInputAt = Date.now();
  const page = session.page;

  if (input?.type === 'text' && typeof input.text === 'string' && input.text) {
    await page.keyboard.insertText(String(input.text).slice(0, 2000));
    return;
  }

  if (input?.type === 'key' && input.key) {
    await page.keyboard.press(keyCombo(String(input.key), Number(input.modifiers || 0)));
    return;
  }

  if (input?.type === 'mouse') {
    const x = Math.max(0, Math.round(Number(input.x) || 0));
    const y = Math.max(0, Math.round(Number(input.y) || 0));
    const button = input.button === 'right' ? 'right' : input.button === 'middle' ? 'middle' : 'left';
    const action = String(input.action || 'move');
    if (action === 'move') {
      await page.mouse.move(x, y);
      return;
    }
    if (action === 'wheel') {
      await page.mouse.move(x, y);
      await page.mouse.wheel(Number(input.deltaX) || 0, Number(input.deltaY) || 0);
      return;
    }
    if (action === 'down') await page.mouse.move(x, y).then(() => page.mouse.down({ button }));
    if (action === 'up') await page.mouse.up({ button });
  }
}

export async function closeGmailBrowser(tenantId: number, accountId: number) {
  await closeSession(sessionKey(tenantId, accountId));
}

export async function destroyGmailProfile(tenantId: number, accountId: number, profileDir?: string | null) {
  await closeGmailBrowser(tenantId, accountId);
  const dir = profileDir || gmailProfileDir(tenantId, accountId);
  const root = path.resolve(process.cwd(), 'data', 'gmail-profiles') + path.sep;
  if (!path.resolve(dir).startsWith(root)) return;
  await fs.promises.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  await fs.promises.rm(`${dir}.chrome-v2`, { force: true }).catch(() => undefined);
}

setInterval(() => {
  const now = Date.now();
  for (const [key, session] of sessions) {
    if (now - session.lastInputAt > IDLE_MS) closeSession(key).catch(() => undefined);
  }
}, 60 * 1000).unref?.();
