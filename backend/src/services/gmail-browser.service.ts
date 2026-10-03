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
  cdp: any;
  shotTimer: NodeJS.Timeout | null;
  metaTimer: NodeJS.Timeout | null;
  jpeg: Buffer | null;
  pendingMove: { x: number; y: number } | null;
  moveQueued: boolean;
  version: number;
  width: number;
  height: number;
  url: string;
  email: string;
  duplicateEmail: string;
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
    `INSERT INTO email_gmail_accounts (tenant_id, email, display_name, password_encrypted, profile_dir, sort_order)
     VALUES (
       $1, $2, $3, NULL, NULL,
       COALESCE((SELECT MIN(sort_order) - 1 FROM email_gmail_accounts WHERE tenant_id = $1), 0)
     )
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
  let context;
  try {
    context = await chromium.launchPersistentContext(profileDir, { ...options, channel: 'chrome' });
  } catch {
    context = await chromium.launchPersistentContext(profileDir, options);
  }
  await context.addInitScript(`(() => {
    const readSelection = () => {
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
        const start = active.selectionStart || 0;
        const end = active.selectionEnd || 0;
        if (end > start) return String(active.value || '').slice(start, end);
      }
      const selected = window.getSelection && window.getSelection();
      return selected ? String(selected.toString() || '') : '';
    };
    window.__incomingPaste = '';
    document.addEventListener('copy', () => {
      window.__copiedText = readSelection();
      window.__copiedPending = true;
    }, true);
    document.addEventListener('cut', () => {
      window.__copiedText = readSelection();
      window.__copiedPending = true;
    }, true);
    document.addEventListener('paste', (event) => {
      const text = window.__incomingPaste;
      if (!text) return;
      window.__incomingPaste = '';
      event.preventDefault();
      event.stopImmediatePropagation();
      if (document.execCommand('insertText', false, text)) return;
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
        const start = active.selectionStart == null ? active.value.length : active.selectionStart;
        const end = active.selectionEnd == null ? start : active.selectionEnd;
        active.setRangeText(text, start, end, 'end');
        active.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, true);
  })();`);
  return context;
}

async function rememberEmail(session: GmailSession, email: string) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized || normalized.endsWith('@sessao.local')) return;
  const existing = await pool.query(
    `SELECT email FROM email_gmail_accounts
     WHERE tenant_id = $1 AND lower(email) = $2 AND id <> $3
     LIMIT 1`,
    [session.tenantId, normalized, session.accountId]
  );
  if (existing.rows[0]) {
    session.duplicateEmail = existing.rows[0].email;
    return;
  }
  session.email = normalized;
  session.duplicateEmail = '';
  try {
    await pool.query(
      `UPDATE email_gmail_accounts
       SET email = $1,
           display_name = COALESCE(NULLIF(display_name, ''), $1),
           updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3
         AND (email LIKE '%@sessao.local' OR lower(email) = lower($1))`,
      [normalized, session.accountId, session.tenantId]
    );
  } catch (error: any) {
    if (String(error?.code) === '23505') {
      session.duplicateEmail = normalized;
      session.email = '';
      return;
    }
  }
}

async function checkIdentity(session: GmailSession) {
  if (session.duplicateEmail) return;
  const now = Date.now();
  if (now - session.lastIdentityCheck < 8000) return;
  session.lastIdentityCheck = now;
  try {
    const found = await session.page.evaluate(`(() => {
      const direct = document.querySelector('[data-email]');
      const dataEmail = direct && direct.getAttribute('data-email');
      if (dataEmail && dataEmail.includes('@')) return dataEmail;
      const labels = Array.from(document.querySelectorAll('[aria-label]'));
      for (const node of labels) {
        const label = node.getAttribute('aria-label') || '';
        if (!/conta do google|google account|conta google/i.test(label)) continue;
        const match = label.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}/i);
        if (match) return match[0];
      }
      return '';
    })()`);
    if (found && found !== session.email && !String(found).endsWith('@sessao.local')) {
      await rememberEmail(session, String(found));
    }
  } catch { /* página ainda carregando */ }
}

async function closeSession(key: string) {
  const session = sessions.get(key);
  if (!session) return;
  sessions.delete(key);
  if (session.shotTimer) clearInterval(session.shotTimer);
  if (session.metaTimer) clearInterval(session.metaTimer);
  try { await session.cdp?.send('Page.stopScreencast'); } catch { /* ignore */ }
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
    cdp: null,
    shotTimer: null,
    metaTimer: null,
    jpeg: null,
    pendingMove: null,
    moveQueued: false,
    version: 0,
    width: VIEWPORT.width,
    height: VIEWPORT.height,
    url: 'https://mail.google.com/mail/u/0/#inbox',
    email: '',
    duplicateEmail: '',
    lastInputAt: Date.now(),
    lastIdentityCheck: 0,
  };
  sessions.set(key, session);

  try {
  let streaming = false;
  try {
    const cdp = await context.newCDPSession(page);
    session.cdp = cdp;
    cdp.on('Page.screencastFrame', async (frame: any) => {
      const live = sessions.get(key);
      if (!live) return;
      live.jpeg = Buffer.from(frame.data, 'base64');
      live.version += 1;
      if (frame.metadata?.deviceWidth) live.width = frame.metadata.deviceWidth;
      if (frame.metadata?.deviceHeight) live.height = frame.metadata.deviceHeight;
      try { await cdp.send('Page.screencastFrameAck', { sessionId: frame.sessionId }); } catch { /* ignore */ }
    });
    await cdp.send('Page.startScreencast', {
      format: 'jpeg',
      quality: 62,
      maxWidth: VIEWPORT.width,
      maxHeight: VIEWPORT.height,
      everyNthFrame: 1,
    });
    streaming = true;
  } catch { /* segue com foto da tela */ }

  if (!streaming) {
    let shooting = false;
    session.shotTimer = setInterval(async () => {
      const live = sessions.get(key);
      if (!live || shooting) return;
      shooting = true;
      try {
        const shot = await live.page.screenshot({ type: 'jpeg', quality: 45, timeout: 1000, caret: 'initial' });
        live.jpeg = Buffer.from(shot);
        live.version += 1;
      } catch { /* página fechando */ }
      shooting = false;
    }, 120);
  }

  session.metaTimer = setInterval(() => {
    const live = sessions.get(key);
    if (!live) return;
    try { live.url = live.page.url(); } catch { /* ignore */ }
    checkIdentity(live).catch(() => undefined);
  }, 4000);

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
    unchanged: same || !session.jpeg,
    jpeg: same ? null : session.jpeg,
    width: session.width,
    height: session.height,
    url: session.url,
    email: session.email || null,
    duplicateEmail: session.duplicateEmail || null,
  };
}

const READ_SELECTION = `(() => {
  const active = document.activeElement;
  if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
    const start = active.selectionStart || 0;
    const end = active.selectionEnd || 0;
    if (end > start) return String(active.value || '').slice(start, end);
  }
  const selected = window.getSelection && window.getSelection();
  return selected ? String(selected.toString() || '') : '';
})()`;

async function readPageSelection(page: any) {
  let found = '';
  for (const frame of page.frames()) {
    try {
      const text = String(await frame.evaluate(READ_SELECTION) || '');
      if (text.length > found.length) found = text;
    } catch { /* frame fechado */ }
  }
  return found.slice(0, 50000);
}

async function takeCopiedText(page: any) {
  let found = '';
  for (const frame of page.frames()) {
    try {
      const text = String(await frame.evaluate(`(() => {
        if (!window.__copiedPending) return '';
        window.__copiedPending = false;
        return String(window.__copiedText || '');
      })()`) || '');
      if (text.length > found.length) found = text;
    } catch { /* frame fechado */ }
  }
  return found.slice(0, 50000);
}

async function setIncomingPaste(page: any, text: string) {
  const payload = JSON.stringify(String(text || '').slice(0, 50000));
  for (const frame of page.frames()) {
    await frame.evaluate(`(() => { window.__incomingPaste = ${payload}; })()`).catch(() => undefined);
  }
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

  if (input?.type === 'clipboard' && input.action === 'selection') {
    return { text: await readPageSelection(page) };
  }

  if (input?.type === 'clipboard' && input.action === 'take') {
    return { text: await takeCopiedText(page) };
  }

  if (input?.type === 'clipboard' && input.action === 'write') {
    await setIncomingPaste(page, String(input.text || ''));
    return { text: '' };
  }

  if (input?.type === 'text' && typeof input.text === 'string' && input.text) {
    await page.keyboard.insertText(String(input.text).slice(0, 50000));
    return { text: '' };
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
      session.pendingMove = { x, y };
      if (!session.moveQueued) {
        session.moveQueued = true;
        setTimeout(() => {
          session.moveQueued = false;
          const point = session.pendingMove;
          session.pendingMove = null;
          if (point) page.mouse.move(point.x, point.y).catch(() => undefined);
        }, 30);
      }
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

export async function reloadGmailBrowser(tenantId: number, accountId: number) {
  const session = sessions.get(sessionKey(tenantId, accountId));
  if (!session) throw new Error('Navegador fechado. Abra a conta de novo.');
  session.lastInputAt = Date.now();
  try {
    await session.page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
  } catch (error: any) {
    const message = String(error?.message || '');
    if (/closed|disposed|Target closed/i.test(message)) {
      throw new Error('Navegador fechado. Abra a conta de novo.');
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
  await fs.promises.rm(`${dir}.chrome-v2`, { force: true }).catch(() => undefined);
}

setInterval(() => {
  const now = Date.now();
  for (const [key, session] of sessions) {
    if (now - session.lastInputAt > IDLE_MS) closeSession(key).catch(() => undefined);
  }
}, 60 * 1000).unref?.();
