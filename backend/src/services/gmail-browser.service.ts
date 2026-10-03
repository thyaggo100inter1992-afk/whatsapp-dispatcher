import crypto from 'crypto';
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
  cdp: any;
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

async function launchContext(profileDir: string) {
  const { chromium } = await import('playwright');
  await fs.promises.mkdir(profileDir, { recursive: true });
  const options: any = {
    headless: true,
    viewport: VIEWPORT,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    ignoreDefaultArgs: ['--enable-automation'],
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--lang=pt-BR',
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
  await context.addInitScript(`(() => { try { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); } catch (e) {} })()`);
  const page = context.pages()[0] || await context.newPage();
  const cdp = await context.newCDPSession(page);
  const session: GmailSession = {
    tenantId,
    accountId,
    profileDir,
    context,
    page,
    cdp,
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
  cdp.on('Page.screencastFrame', async (frame: any) => {
    const live = sessions.get(key);
    if (!live) return;
    live.image = frame.data;
    live.version += 1;
    if (frame.metadata?.deviceWidth) live.width = frame.metadata.deviceWidth;
    if (frame.metadata?.deviceHeight) live.height = frame.metadata.deviceHeight;
    try {
      await cdp.send('Page.screencastFrameAck', { sessionId: frame.sessionId });
    } catch { /* sessão encerrada */ }
    checkIdentity(live).catch(() => undefined);
  });

  page.on('framenavigated', (frame: any) => {
    if (frame === page.mainFrame()) session.url = frame.url();
  });

  await cdp.send('Page.startScreencast', {
    format: 'jpeg',
    quality: 55,
    maxWidth: VIEWPORT.width,
    maxHeight: VIEWPORT.height,
    everyNthFrame: 1,
  });

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

const SPECIAL_KEYS: Record<string, { key: string; code: string; windowsVirtualKeyCode: number; text?: string }> = {
  Enter: { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' },
  Backspace: { key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 },
  Tab: { key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 },
  Escape: { key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 },
  ArrowLeft: { key: 'ArrowLeft', code: 'ArrowLeft', windowsVirtualKeyCode: 37 },
  ArrowUp: { key: 'ArrowUp', code: 'ArrowUp', windowsVirtualKeyCode: 38 },
  ArrowRight: { key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 },
  ArrowDown: { key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40 },
  Delete: { key: 'Delete', code: 'Delete', windowsVirtualKeyCode: 46 },
  Home: { key: 'Home', code: 'Home', windowsVirtualKeyCode: 36 },
  End: { key: 'End', code: 'End', windowsVirtualKeyCode: 35 },
};

export async function sendGmailBrowserInput(tenantId: number, accountId: number, input: any) {
  const session = sessions.get(sessionKey(tenantId, accountId));
  if (!session) throw new Error('Navegador fechado. Abra a conta de novo.');
  session.lastInputAt = Date.now();
  const cdp = session.cdp;

  if (input?.type === 'text' && typeof input.text === 'string' && input.text) {
    await cdp.send('Input.insertText', { text: String(input.text).slice(0, 2000) });
    return;
  }

  if (input?.type === 'key') {
    const spec = SPECIAL_KEYS[String(input.key || '')] || {
      key: String(input.key || ''),
      code: String(input.code || input.key || ''),
      windowsVirtualKeyCode: 0,
    };
    const modifiers = Number(input.modifiers || 0);
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', modifiers, ...spec });
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', modifiers, key: spec.key, code: spec.code, windowsVirtualKeyCode: spec.windowsVirtualKeyCode });
    return;
  }

  if (input?.type === 'mouse') {
    const x = Math.max(0, Math.round(Number(input.x) || 0));
    const y = Math.max(0, Math.round(Number(input.y) || 0));
    const buttonName = input.button === 'right' ? 'right' : input.button === 'middle' ? 'middle' : 'left';
    const action = String(input.action || 'move');
    if (action === 'move') {
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none' });
      return;
    }
    if (action === 'wheel') {
      await cdp.send('Input.dispatchMouseEvent', {
        type: 'mouseWheel',
        x,
        y,
        deltaX: Number(input.deltaX) || 0,
        deltaY: Number(input.deltaY) || 0,
      });
      return;
    }
    if (action === 'down' || action === 'up') {
      await cdp.send('Input.dispatchMouseEvent', {
        type: action === 'down' ? 'mousePressed' : 'mouseReleased',
        x,
        y,
        button: buttonName,
        clickCount: Number(input.clickCount) || 1,
      });
    }
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
}

setInterval(() => {
  const now = Date.now();
  for (const [key, session] of sessions) {
    if (now - session.lastInputAt > IDLE_MS) closeSession(key).catch(() => undefined);
  }
}, 60 * 1000).unref?.();
