import {
  useState, useEffect, useCallback, useRef, useMemo, KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import Head from 'next/head';
import {
  FaInbox, FaArrowLeft, FaPaperPlane, FaSpinner, FaEnvelopeOpen, FaTrash, FaReply,
  FaPlus, FaFolder, FaStar, FaRegStar, FaArchive, FaBan, FaSearch, FaPaperclip,
  FaEllipsisH, FaPrint, FaDownload, FaUserPlus, FaExclamationTriangle, FaCog,
  FaCheck, FaTimes, FaBold, FaItalic, FaUnderline, FaLink, FaListUl, FaClock,
  FaReplyAll, FaShare, FaVolumeUp, FaVolumeMute, FaEye, FaEnvelope, FaFilter,
  FaChevronDown, FaChevronUp, FaComments, FaEdit, FaSync,
} from 'react-icons/fa';
import api from '@/services/api';
import { useNotification } from '@/hooks/useNotification';
import ProtectedRoute from '@/components/ProtectedRoute';
import { getSystemVariables, replaceVariables } from '@/utils/templateVariables';

const EmailBodyEditor = dynamic(() => import('@/components/EmailBodyEditor'), { ssr: false });

/* ───────────────── Types ───────────────── */

interface Mailbox {
  id: number;
  email: string;
  display_name: string | null;
  unread_count: number;
  signature_html?: string | null;
  signature_enabled?: boolean;
}

interface MailboxStats {
  inbox: number;
  sent: number;
  drafts: number;
  trash: number;
  archive: number;
  spam: number;
  starred: number;
  unread: number;
}

interface CustomFolder {
  id: number;
  name: string;
  color: string | null;
  mailbox_id: number | null;
}

interface Attachment {
  filename: string;
  contentType?: string;
  size?: number;
  url: string;
}

interface QuickReply {
  id: number;
  title: string;
  body_html: string;
  mailbox_id: number | null;
  attachments?: Attachment[] | null;
}

interface RecipientTrack {
  id?: number;
  email: string;
  name?: string | null;
  role?: string | null;
  tracking_status?: string | null;
  delivered_at?: string | null;
  opened_at?: string | null;
  clicked_at?: string | null;
  replied_at?: string | null;
  bounced_at?: string | null;
  error_message?: string | null;
}

interface MessageRow {
  id: number;
  mailbox_id: number;
  mailbox_email?: string;
  from_email: string;
  from_name: string | null;
  to_email: string;
  to_name?: string | null;
  subject: string;
  preview: string;
  is_read: boolean;
  is_starred: boolean;
  has_attachments: boolean;
  status: string;
  folder: string;
  direction: string;
  received_at: string | null;
  sent_at: string | null;
  created_at: string;
  scheduled_at?: string | null;
  cc?: string | null;
  bcc?: string | null;
  custom_folder_id?: number | null;
  thread_key?: string | null;
  thread_count?: number;
  tracking_status?: string | null;
  delivered_at?: string | null;
  opened_at?: string | null;
  clicked_at?: string | null;
  replied_at?: string | null;
  bounced_at?: string | null;
}

interface MessageFull extends MessageRow {
  body_html: string | null;
  body_text: string | null;
  attachments?: Attachment[] | null;
  phishing_hints?: string[] | null;
  recipients?: RecipientTrack[] | null;
}

interface ContactList {
  id: number;
  name: string;
}

type FolderKey =
  | 'inbox' | 'sent' | 'drafts' | 'archive' | 'spam' | 'trash' | 'starred'
  | `custom:${number}`;

interface ComposeState {
  to_email: string;
  to_name: string;
  cc: string;
  bcc: string;
  subject: string;
  body_html: string;
  quoted_html: string;
  quoted_label: string;
  compose_mode: 'new' | 'reply' | 'forward' | 'draft';
  reply_to_message_id: number | null;
  draft_id: number | null;
  scheduled_at: string;
  request_read_receipt: boolean;
  append_signature: boolean;
  files: File[];
}

const EMPTY_COMPOSE: ComposeState = {
  to_email: '', to_name: '', cc: '', bcc: '', subject: '', body_html: '',
  quoted_html: '', quoted_label: '', compose_mode: 'new',
  reply_to_message_id: null, draft_id: null, scheduled_at: '',
  request_read_receipt: false, append_signature: true, files: [],
};

const EMPTY_STATS: MailboxStats = {
  inbox: 0, sent: 0, drafts: 0, trash: 0, archive: 0, spam: 0, starred: 0, unread: 0,
};

/* ───────────────── Helpers ───────────────── */

function uploadsBaseUrl() {
  const raw = process.env.NEXT_PUBLIC_API_URL || '';
  const base = raw.replace(/\/api\/?$/, '') || (typeof window !== 'undefined' ? window.location.origin : '');
  if (typeof window !== 'undefined' && window.location.protocol === 'https:' && base.startsWith('http://')) {
    return base.replace(/^http:\/\//, 'https://');
  }
  return base;
}

function absoluteUploadUrl(url: string) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return `${uploadsBaseUrl()}${url.startsWith('/') ? '' : '/'}${url}`;
}

function rewriteMailboxHtml(html: string) {
  const base = uploadsBaseUrl();
  if (!html || !base) return html;
  return html.replace(/(src=["'])(\/uploads\/[^"']+)(["'])/gi, (_m, a, path, b) => `${a}${base}${path}${b}`);
}

function authToken() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('@WhatsAppDispatcher:token') || '';
}

function apiRoot() {
  const raw = process.env.NEXT_PUBLIC_API_URL || '';
  return raw.replace(/\/$/, '') || '/api';
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function formatFullDate(iso: string | null | undefined) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('pt-BR');
}

function normalizeSubjectClient(subject: string) {
  let s = String(subject || '').trim();
  let prev = '';
  while (s !== prev) {
    prev = s;
    s = s.replace(/^(re|fw|fwd|enc|res|resp)\s*:\s*/i, '').trim();
  }
  return s.replace(/\s+/g, ' ').toLowerCase();
}

function conversationTicketKey(msg: MessageRow) {
  const other = String(msg.direction === 'outbound' ? msg.to_email : msg.from_email || '')
    .split(/[,;]/)[0]
    .trim()
    .toLowerCase();
  return `${normalizeSubjectClient(msg.subject)}::${other}::${msg.mailbox_id || ''}`;
}

function groupConversationTickets(list: MessageRow[]): MessageRow[] {
  const map = new Map<string, MessageRow>();
  for (const msg of list) {
    const key = conversationTicketKey(msg);
    const prev = map.get(key);
    if (!prev) {
      map.set(key, { ...msg, thread_count: msg.thread_count || 1 });
      continue;
    }
    const tNew = new Date(msg.received_at || msg.sent_at || msg.created_at).getTime();
    const tOld = new Date(prev.received_at || prev.sent_at || prev.created_at).getTime();
    const newer = tNew >= tOld ? msg : prev;
    const older = tNew >= tOld ? prev : msg;
    map.set(key, {
      ...newer,
      is_read: !!(newer.is_read && older.is_read),
      is_starred: !!(newer.is_starred || older.is_starred),
      thread_count: (Number(prev.thread_count) || 1) + (Number(msg.thread_count) || 1),
      thread_key: newer.thread_key || older.thread_key,
    });
  }
  return Array.from(map.values()).sort((a, b) => {
    const ta = new Date(a.received_at || a.sent_at || a.created_at).getTime();
    const tb = new Date(b.received_at || b.sent_at || b.created_at).getTime();
    return tb - ta;
  });
}

function trackingLabel(status?: string | null) {
  const s = String(status || '').toLowerCase();
  const map: Record<string, string> = {
    sent: 'Enviado',
    delivered: 'Entregue',
    opened: 'Aberto',
    clicked: 'Clicou',
    replied: 'Respondeu',
    bounced: 'Bounce',
    failed: 'Falhou',
    complained: 'Spam',
  };
  return map[s] || '';
}

function trackingBadgeClass(status?: string | null) {
  const s = String(status || '').toLowerCase();
  if (s === 'replied') return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
  if (s === 'clicked') return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
  if (s === 'opened') return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
  if (s === 'delivered') return 'bg-sky-500/15 text-sky-300 border-sky-500/35';
  // Enviado ativo precisa parecer concluído (não “apagado” como o step pendente)
  if (s === 'sent') return 'bg-white/20 text-white border-white/45';
  if (s === 'bounced' || s === 'failed' || s === 'complained') return 'bg-red-500/20 text-red-300 border-red-500/40';
  return 'bg-white/10 text-white/50 border-white/15';
}

/** Inferência dos passos já atingidos (como no disparador WhatsApp/e-mail) */
function trackingStepsReached(msg: MessageRow | MessageFull) {
  const st = String(msg.tracking_status || msg.status || '').toLowerCase();
  // Se entregou/abriu/respondeu, "enviado" já aconteceu — inclusive sem sent_at
  const sent = !!(
    msg.sent_at ||
    msg.delivered_at ||
    msg.opened_at ||
    msg.clicked_at ||
    msg.replied_at ||
    st === 'sent' ||
    ['delivered', 'opened', 'clicked', 'replied'].includes(st)
  );
  const delivered = !!(
    msg.delivered_at ||
    msg.opened_at ||
    msg.clicked_at ||
    msg.replied_at ||
    ['delivered', 'opened', 'clicked', 'replied'].includes(st)
  );
  const opened = !!(msg.opened_at || msg.clicked_at || msg.replied_at || ['opened', 'clicked', 'replied'].includes(st));
  const clicked = !!(msg.clicked_at || st === 'clicked');
  const replied = !!(msg.replied_at || st === 'replied');
  return [
    { key: 'sent', label: 'Enviado', at: msg.sent_at, done: sent },
    { key: 'delivered', label: 'Entregue', at: msg.delivered_at, done: delivered },
    { key: 'opened', label: 'Abriu / Leu', at: msg.opened_at, done: opened },
    { key: 'clicked', label: 'Clicou', at: msg.clicked_at, done: clicked },
    { key: 'replied', label: 'Respondeu', at: msg.replied_at, done: replied },
  ];
}

/** Chips compactos na lista — mostra TODOS os status já passados */
function TrackingTrailBadges({ msg }: { msg: MessageRow | MessageFull }) {
  if (msg.direction !== 'outbound') return null;
  const steps = trackingStepsReached(msg).filter((s) => s.done);
  if (!steps.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1 justify-end max-w-[220px]">
      {steps.map((s) => (
        <span
          key={s.key}
          title={s.at ? `${s.label}: ${formatFullDate(s.at)}` : s.label}
          className={`text-[9px] leading-tight px-1.5 py-0.5 rounded border flex-shrink-0 ${trackingBadgeClass(s.key)}`}
        >
          {trackingLabel(s.key)}
        </span>
      ))}
    </div>
  );
}

function recipientAsMessage(base: MessageRow | MessageFull, rec: RecipientTrack): MessageRow {
  return {
    ...base,
    to_email: rec.email,
    to_name: rec.name || null,
    tracking_status: rec.tracking_status || base.tracking_status,
    delivered_at: rec.delivered_at || null,
    opened_at: rec.opened_at || null,
    clicked_at: rec.clicked_at || null,
    replied_at: rec.replied_at || null,
    bounced_at: rec.bounced_at || null,
  };
}

function inferRecipients(msg: MessageRow | MessageFull): RecipientTrack[] {
  const fromApi = Array.isArray((msg as MessageFull).recipients) ? (msg as MessageFull).recipients || [] : [];
  const byEmail = new Map<string, RecipientTrack>();
  const emails = String(msg.to_email || '').split(/[,;]+/).map((s) => s.trim().toLowerCase()).filter((s) => s.includes('@'));
  const cc = String(msg.cc || '').split(/[,;]+/).map((s) => s.trim().toLowerCase()).filter((s) => s.includes('@'));
  const bcc = String((msg as any).bcc || '').split(/[,;]+/).map((s) => s.trim().toLowerCase()).filter((s) => s.includes('@'));
  emails.forEach((email, i) => byEmail.set(email, {
    email, name: i === 0 ? msg.to_name : null, role: 'to',
    tracking_status: msg.tracking_status, delivered_at: msg.delivered_at,
    opened_at: msg.opened_at, clicked_at: msg.clicked_at, replied_at: msg.replied_at, bounced_at: msg.bounced_at,
  }));
  cc.forEach((email) => { if (!byEmail.has(email)) byEmail.set(email, { email, role: 'cc', tracking_status: msg.tracking_status }); });
  bcc.forEach((email) => { if (!byEmail.has(email)) byEmail.set(email, { email, role: 'bcc', tracking_status: msg.tracking_status }); });
  fromApi.forEach((r) => {
    const key = String(r.email || '').toLowerCase();
    if (!key) return;
    byEmail.set(key, { ...(byEmail.get(key) || {}), ...r, email: key });
  });
  return Array.from(byEmail.values());
}

/** Painel interno de webhook — um bloco por destinatário */
function InternalTrackingPanel({ msg }: { msg: MessageRow | MessageFull }) {
  if (msg.direction !== 'outbound') return null;
  const status = msg.tracking_status || (msg.status === 'sent' || msg.sent_at ? 'sent' : msg.status);
  if (!status && !msg.sent_at) return null;
  const recipients = inferRecipients(msg);
  const people = recipients.length ? recipients : [{
    email: msg.to_email, name: msg.to_name, role: 'to', tracking_status: status,
    delivered_at: msg.delivered_at, opened_at: msg.opened_at, clicked_at: msg.clicked_at,
    replied_at: msg.replied_at, bounced_at: msg.bounced_at,
  }];

  return (
    <div className="mx-6 mt-4 space-y-3">
      <p className="text-sm font-semibold text-white/70">Status por destinatário</p>
      {people.map((rec) => {
        const row = recipientAsMessage(msg, rec);
        const recStatus = rec.tracking_status || status;
        const steps = trackingStepsReached(row);
        const failed = !!(rec.bounced_at || ['bounced', 'failed', 'complained'].includes(String(recStatus)));
        const roleLabel = rec.role === 'cc' ? 'Cc' : rec.role === 'bcc' ? 'Cco' : 'Para';
        return (
          <div key={`${rec.role}-${rec.email}`} className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 text-sm">
            <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
              <div className="min-w-0">
                <p className="text-white font-semibold truncate text-[15px]">{rec.name || rec.email}</p>
                <p className="text-white/45 text-xs truncate">{roleLabel} · {rec.email}</p>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${trackingBadgeClass(recStatus)}`}>
                {trackingLabel(recStatus) || 'Enviado'}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {steps.map((s, i) => (
                <div key={s.key} className="flex items-center gap-1.5">
                  {i > 0 && <span className={`text-[10px] ${s.done ? 'text-indigo-300' : 'text-white/20'}`}>→</span>}
                  <span className={`text-[10px] px-2 py-1 rounded-lg border font-semibold ${
                    s.done ? trackingBadgeClass(s.key) : 'bg-black/20 text-white/25 border-white/10'
                  }`}>
                    {s.done ? '✓ ' : ''}{s.label}
                  </span>
                </div>
              ))}
            </div>
            {failed && (
              <p className="text-xs text-red-300 mt-1">Falha / bounce{rec.error_message ? `: ${rec.error_message}` : ''}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function stripHtml(html: string) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

const QUOTE_TEXT_MARKERS = [
  /\n\s*Em\s+\S.{8,80}escreveu:\s*/i,
  /\n\s*On\s+\S.{8,80}wrote:\s*/i,
  /\n----------\s*Mensagem encaminhada\s*----------/i,
  /\n----------\s*Forwarded message\s*----------/i,
  /\n-{2,}\s*Original Message\s*-{2,}/i,
  /\nDe:\s+[^\n]+@/i,
  /\nFrom:\s+[^\n]+@/i,
];

/** Corta o preview na citação (Gmail/Outlook) para a lista não ficar bagunçada */
function cleanEmailPreview(preview: string) {
  let s = String(preview || '').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  const cuts = [
    /\bEm\s+\w{2,5}\.?,?\s+\d{1,2}\s+de\s+\w+\.?\s+de\s+\d{4}/i,
    /\bOn\s+\w{3}.+\d{4}.+wrote:/i,
    /----------\s*Mensagem encaminhada\s*----------/i,
    /----------\s*Forwarded message\s*----------/i,
    /\bDe:\s+\S+@/i,
    /\bFrom:\s+\S+@/i,
  ];
  for (const re of cuts) {
    const m = s.match(re);
    if (m && m.index != null && m.index > 6) s = s.slice(0, m.index).trim();
  }
  if (s.length > 140) s = `${s.slice(0, 137).trim()}…`;
  return s;
}

function splitQuotedText(text: string): { latest: string; history: string } {
  const raw = String(text || '').replace(/\r\n/g, '\n');
  if (!raw.trim()) return { latest: '', history: '' };
  let idx = -1;
  for (const re of QUOTE_TEXT_MARKERS) {
    const m = raw.match(re);
    if (m && m.index != null && (idx < 0 || m.index < idx) && m.index > 2) idx = m.index;
  }
  if (idx > 2) {
    return { latest: raw.slice(0, idx).trim(), history: raw.slice(idx).trim() };
  }
  const lines = raw.split('\n');
  const firstQuote = lines.findIndex((l, i) => i > 0 && /^\s*>/.test(l));
  if (firstQuote > 0) {
    return {
      latest: lines.slice(0, firstQuote).join('\n').trim(),
      history: lines.slice(firstQuote).join('\n').trim(),
    };
  }
  return { latest: raw.trim(), history: '' };
}

function splitQuotedHtml(html: string): { latest: string; history: string } {
  const raw = String(html || '');
  if (!raw.trim()) return { latest: '', history: '' };
  const markers = [
    /<div[^>]*class=["'][^"']*gmail_quote[^"']*["'][^>]*>/i,
    /<blockquote\b[^>]*>/i,
    /<div[^>]*id=["']divRplyFwdMsg["'][^>]*>/i,
    /<hr[^>]*id=["'][^"']*reply[^"']*["'][^>]*>/i,
  ];
  let cut = -1;
  for (const re of markers) {
    const m = raw.match(re);
    if (m && m.index != null && (cut < 0 || m.index < cut) && m.index > 8) cut = m.index;
  }
  if (cut > 8) {
    return { latest: raw.slice(0, cut).trim(), history: raw.slice(cut).trim() };
  }
  const textSplit = splitQuotedText(stripHtml(raw));
  if (textSplit.history) {
    return { latest: `<p>${textSplit.latest.replace(/\n/g, '<br/>')}</p>`, history: raw };
  }
  return { latest: raw, history: '' };
}

function OrganizedEmailBody({
  html,
  text,
  direction,
}: {
  html?: string | null;
  text?: string | null;
  direction?: string;
}) {
  const [openHistory, setOpenHistory] = useState(false);
  const fromHtml = html ? splitQuotedHtml(html) : { latest: '', history: '' };
  const fromText = splitQuotedText(text || '');
  const latestHtml = fromHtml.latest;
  const historyHtml = fromHtml.history;
  const latestText = fromText.latest || (!html ? (text || '') : '');
  const historyText = fromText.history;
  const hasHistory = !!(historyHtml || historyText);
  const isOut = direction === 'outbound';

  return (
    <div className="space-y-5">
      <div className={`pl-4 border-l-2 ${isOut ? 'border-indigo-400/50' : 'border-white/15'}`}>
        <p className="text-xs font-medium text-white/50 mb-3">
          {isOut ? 'Mensagem enviada' : 'Mensagem recebida'}
        </p>
        <div className="rounded-xl bg-[#f7f8fa] text-slate-900 p-5 shadow-inner">
          {latestHtml ? (
            <div
              className="prose prose-slate max-w-none text-[16px] leading-relaxed text-slate-900 [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg [&_a]:text-indigo-700 [&_blockquote]:hidden [&_.gmail_quote]:hidden"
              dangerouslySetInnerHTML={{ __html: rewriteMailboxHtml(latestHtml) }}
            />
          ) : (
            <pre className="whitespace-pre-wrap text-slate-800 text-[16px] leading-relaxed font-sans">{latestText || '(sem conteúdo)'}</pre>
          )}
        </div>
      </div>
      {hasHistory && (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
          <button
            type="button"
            onClick={() => setOpenHistory((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-[13px] font-medium text-white/45 hover:text-white/80 hover:bg-white/[0.03]"
          >
            <span>Histórico da conversa</span>
            {openHistory ? <FaChevronUp className="text-xs" /> : <FaChevronDown className="text-xs" />}
          </button>
          {openHistory && (
            <div className="px-4 pb-4 border-t border-white/[0.08] pt-3">
              {historyHtml ? (
                <div
                  className="prose prose-invert max-w-none text-white/45 text-sm [&_img]:max-w-full [&_blockquote]:border-l-2 [&_blockquote]:border-white/15 [&_blockquote]:pl-3"
                  dangerouslySetInnerHTML={{ __html: rewriteMailboxHtml(historyHtml) }}
                />
              ) : (
                <pre className="whitespace-pre-wrap text-white/40 text-xs font-sans">{historyText}</pre>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function isTypingTarget(el: EventTarget | null) {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

let mailboxAudioCtx: AudioContext | null = null;

function getMailboxAudio() {
  const Ctx = window.AudioContext || (window as any).webkitAudioContext;
  if (!Ctx) return null;
  if (!mailboxAudioCtx) mailboxAudioCtx = new Ctx();
  if (mailboxAudioCtx.state === 'suspended') mailboxAudioCtx.resume().catch(() => undefined);
  return mailboxAudioCtx;
}

function playPing() {
  try {
    const ctx = getMailboxAudio();
    if (!ctx) return;
    const now = ctx.currentTime;
    const beep = (freq: number, start: number, dur: number, vol: number) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = freq;
      o.connect(g);
      g.connect(ctx.destination);
      g.gain.setValueAtTime(0.0001, now + start);
      g.gain.exponentialRampToValueAtTime(vol, now + start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
      o.start(now + start);
      o.stop(now + start + dur + 0.03);
    };
    beep(880, 0, 0.22, 0.62);
    beep(1175, 0.16, 0.32, 0.7);
  } catch { /* ignore */ }
}

/* ───────────────── Component ───────────────── */

export default function CaixaEntrada() {
  const router = useRouter();
  const notification = useNotification();

  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  /** null = Todas as caixas */
  const [mailboxId, setMailboxId] = useState<number | null>(null);
  const [allMode, setAllMode] = useState(false);
  const [folder, setFolder] = useState<FolderKey>('inbox');
  const [stats, setStats] = useState<MailboxStats>(EMPTY_STATS);
  const [customFolders, setCustomFolders] = useState<CustomFolder[]>([]);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [lists, setLists] = useState<ContactList[]>([]);

  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [selected, setSelected] = useState<MessageFull | null>(null);
  const [thread, setThread] = useState<MessageFull[]>([]);
  const [showThread, setShowThread] = useState(false);
  const [checked, setChecked] = useState<Set<number>>(new Set());

  const [q, setQ] = useState('');
  const [qDebounced, setQDebounced] = useState('');
  const [filterUnread, setFilterUnread] = useState(false);
  const [filterAttachments, setFilterAttachments] = useState(false);

  const [loading, setLoading] = useState(true);
  const [loadingMsg, setLoadingMsg] = useState(false);
  const [sending, setSending] = useState(false);

  const [composing, setComposing] = useState(false);
  const [compose, setCompose] = useState<ComposeState>(EMPTY_COMPOSE);
  const [showCc, setShowCc] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);

  const [showSettings, setShowSettings] = useState(false);
  const [sigHtml, setSigHtml] = useState('');
  const [sigEnabled, setSigEnabled] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState('#22d3ee');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);

  const [showNewQr, setShowNewQr] = useState(false);
  const [qrTitle, setQrTitle] = useState('');
  const [qrBody, setQrBody] = useState('');
  const [qrFiles, setQrFiles] = useState<File[]>([]);
  const [creatingQr, setCreatingQr] = useState(false);

  const [showAddList, setShowAddList] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [focusIdx, setFocusIdx] = useState(-1);
  const [alertMailboxIds, setAlertMailboxIds] = useState<number[]>([]);
  const [mailboxFilter, setMailboxFilter] = useState('');

  const editorRef = useRef<HTMLDivElement>(null);
  const unreadRef = useRef(0);
  const mailboxUnreadRef = useRef<Record<number, number>>({});
  const pollSkipRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const qrFileInputRef = useRef<HTMLInputElement>(null);

  const effectiveMailboxId = allMode ? null : mailboxId;
  const activeMailbox = mailboxes.find((m) => m.id === mailboxId) || null;
  const composeMailboxId = mailboxId || mailboxes[0]?.id || null;

  /* ── Som: ligado por padrão; só desliga se o usuário desligar ── */
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('mailbox-sound') : null;
    if (saved === 'off') setSoundOn(false);
    else setSoundOn(true);
  }, []);
  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem('mailbox-sound', soundOn ? 'on' : 'off');
  }, [soundOn]);
  useEffect(() => {
    const unlock = () => { getMailboxAudio(); };
    window.addEventListener('click', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('click', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  /* ── Debounce search ── */
  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  /* ── Load mailboxes ── */
  const loadMailboxes = useCallback(async () => {
    try {
      const r = await api.get('/email-marketing/mailboxes');
      const list: Mailbox[] = r.data.data || [];
      setMailboxes(list);
      const qMb = router.query.mailbox ? Number(router.query.mailbox) : null;
      if (qMb && list.some((m) => m.id === qMb)) {
        setMailboxId(qMb);
        setAllMode(false);
      } else if (!router.query.mailbox) {
        setMailboxId(null);
        setAllMode(false);
      }
      const prev = mailboxUnreadRef.current;
      const hasPrev = Object.keys(prev).length > 0;
      const newly = hasPrev
        ? list.filter((m) => m.unread_count > (prev[m.id] ?? 0)).map((m) => m.id)
        : [];
      mailboxUnreadRef.current = Object.fromEntries(list.map((m) => [m.id, m.unread_count]));
      if (newly.length) {
        setAlertMailboxIds((ids) => [...new Set([...ids, ...newly])]);
        if (soundOn) playPing();
        window.setTimeout(() => {
          setAlertMailboxIds((ids) => ids.filter((id) => !newly.includes(id)));
        }, 15000);
      }
    } catch (e: any) {
      notification.error('Erro', e.response?.data?.message || e.message);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.query.mailbox, soundOn]);

  const loadStats = useCallback(async () => {
    if (allMode || !mailboxId) {
      setStats(EMPTY_STATS);
      return;
    }
    try {
      const r = await api.get(`/email-marketing/mailboxes/${mailboxId}/stats`);
      setStats({ ...EMPTY_STATS, ...(r.data.data || {}) });
      unreadRef.current = r.data.data?.unread ?? unreadRef.current;
    } catch { /* silent */ }
  }, [allMode, mailboxId]);

  const loadFolders = useCallback(async () => {
    try {
      const params: any = {};
      if (!allMode && mailboxId) params.mailbox_id = mailboxId;
      const r = await api.get('/email-marketing/mailbox-folders', { params });
      setCustomFolders(r.data.data || []);
    } catch { setCustomFolders([]); }
  }, [allMode, mailboxId]);

  const loadQuickReplies = useCallback(async () => {
    try {
      const params: any = {};
      if (!allMode && mailboxId) params.mailbox_id = mailboxId;
      const r = await api.get('/email-marketing/mailbox-quick-replies', { params });
      setQuickReplies(r.data.data || []);
    } catch { setQuickReplies([]); }
  }, [allMode, mailboxId]);

  const loadLists = useCallback(async () => {
    try {
      const r = await api.get('/email-marketing/lists');
      setLists(r.data.data || []);
    } catch { setLists([]); }
  }, []);

  const folderParam = useMemo(() => {
    if (folder.startsWith('custom:')) return undefined;
    return folder === 'starred' ? 'starred' : folder;
  }, [folder]);

  const customFolderId = useMemo(() => {
    if (folder.startsWith('custom:')) return Number(folder.split(':')[1]);
    return undefined;
  }, [folder]);

  const loadMessages = useCallback(async (opts?: { silent?: boolean }) => {
    if (!allMode && !mailboxId) {
      setMessages([]);
      setLoading(false);
      return;
    }
    if (!opts?.silent) setLoading(true);
    try {
      const params: Record<string, any> = { limit: 100 };
      if (folderParam) params.folder = folderParam;
      if (customFolderId) params.custom_folder_id = customFolderId;
      if (qDebounced) params.q = qDebounced;
      if (filterUnread) params.unread = true;
      if (filterAttachments) params.has_attachments = true;

      const url = allMode
        ? '/email-marketing/mailboxes/all/messages'
        : `/email-marketing/mailboxes/${mailboxId}/messages`;
      const r = await api.get(url, { params });
      const list: MessageRow[] = groupConversationTickets(r.data.data || []);
      setMessages(list);
      setSelected((prev) => {
        if (!prev) return prev;
        const fresh = list.find((m) => m.id === prev.id);
        if (!fresh) return prev;
        return {
          ...prev,
          tracking_status: fresh.tracking_status,
          delivered_at: fresh.delivered_at,
          opened_at: fresh.opened_at,
          clicked_at: fresh.clicked_at,
          replied_at: fresh.replied_at,
          bounced_at: fresh.bounced_at,
          status: fresh.status,
        };
      });

      if (opts?.silent && soundOn) {
        const unreadNow = list.filter((m) => !m.is_read && m.folder === 'inbox').length;
        if (unreadNow > unreadRef.current) playPing();
        unreadRef.current = unreadNow;
      } else if (r.data.unread_count != null) {
        unreadRef.current = r.data.unread_count;
      }
    } catch (e: any) {
      if (!opts?.silent) notification.error('Erro', e.response?.data?.message || e.message);
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allMode, mailboxId, folderParam, customFolderId, qDebounced, filterUnread, filterAttachments, soundOn]);

  useEffect(() => {
    if (!router.isReady) return;
    loadMailboxes().finally(() => setLoading(false));
    loadLists();
  }, [router.isReady]);

  useEffect(() => {
    loadStats();
    loadFolders();
    loadQuickReplies();
  }, [loadStats, loadFolders, loadQuickReplies]);

  useEffect(() => {
    setSelected(null);
    setChecked(new Set());
    setShowThread(false);
    setThread([]);
    setFocusIdx(-1);
    loadMessages();
  }, [loadMessages]);

  /* Polling 8s — status de webhook (entregue/abriu/clicou) atualiza na lista */
  useEffect(() => {
    const id = setInterval(() => {
      if (pollSkipRef.current || composing) return;
      loadMessages({ silent: true });
      loadStats();
      loadMailboxes();
    }, 8000);
    return () => clearInterval(id);
  }, [loadMessages, loadStats, loadMailboxes, composing]);

  /* Sync settings panel fields when mailbox changes */
  useEffect(() => {
    if (activeMailbox) {
      setSigHtml(activeMailbox.signature_html || '');
      setSigEnabled(activeMailbox.signature_enabled !== false);
      setDisplayName(activeMailbox.display_name || '');
    }
  }, [activeMailbox?.id]);

  /* ── Open message ── */
  const resolveMailboxForMsg = (msg: MessageRow | MessageFull) =>
    msg.mailbox_id || mailboxId || composeMailboxId;

  const openMessage = async (id: number, mbId?: number, markRead = true) => {
    const mid = mbId || mailboxId;
    if (!mid && !allMode) return;
    const useId = mid || messages.find((m) => m.id === id)?.mailbox_id;
    if (!useId) return;
    setLoadingMsg(true);
    setComposing(false);
    setShowThread(false);
    try {
      const r = await api.get(`/email-marketing/mailboxes/${useId}/messages/${id}`, {
        params: markRead ? undefined : { mark_read: false },
      });
      const full: MessageFull = r.data.data;
      setSelected(full);
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, is_read: true } : m)));
      loadStats();
      loadMailboxes();
      try {
        const tr = await api.get(`/email-marketing/mailboxes/${useId}/messages/${id}/thread`);
        const items = tr.data.data || [];
        setThread(items);
        setShowThread(items.length > 1);
      } catch {
        setThread([]);
        setShowThread(false);
      }
    } catch (e: any) {
      notification.error('Erro', e.response?.data?.message || e.message);
    } finally {
      setLoadingMsg(false);
    }
  };

  const loadThread = async () => {
    if (!selected) return;
    const mid = resolveMailboxForMsg(selected);
    if (!mid) return;
    try {
      const r = await api.get(`/email-marketing/mailboxes/${mid}/messages/${selected.id}/thread`);
      setThread(r.data.data || []);
      setShowThread(true);
    } catch (e: any) {
      notification.error('Erro', e.response?.data?.message || e.message);
    }
  };

  /* ── Actions ── */
  const doAction = async (
    messageId: number,
    action: string,
    mbId?: number,
    extra?: Record<string, any>
  ) => {
    const mid = mbId || mailboxId || messages.find((m) => m.id === messageId)?.mailbox_id;
    if (!mid) return;
    try {
      await api.post(`/email-marketing/mailboxes/${mid}/messages/${messageId}/action`, {
        action,
        ...extra,
      });
      if (['trash', 'delete', 'archive', 'spam', 'inbox', 'move_folder'].includes(action)) {
        if (selected?.id === messageId) setSelected(null);
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
      } else if (action === 'star' || action === 'unstar') {
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, is_starred: action === 'star' } : m))
        );
        if (selected?.id === messageId) {
          setSelected((s) => (s ? { ...s, is_starred: action === 'star' } : s));
        }
      } else if (action === 'read' || action === 'unread') {
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, is_read: action === 'read' } : m))
        );
        if (selected?.id === messageId) {
          setSelected((s) => (s ? { ...s, is_read: action === 'read' } : s));
        }
      }
      loadStats();
    } catch (e: any) {
      notification.error('Erro', e.response?.data?.message || e.message);
    }
  };

  const doBulk = async (action: string, extra?: Record<string, any>) => {
    const ids = Array.from(checked);
    if (!ids.length) return;
    const byMb = new Map<number, number[]>();
    for (const id of ids) {
      const msg = messages.find((m) => m.id === id);
      const mid = msg?.mailbox_id || mailboxId;
      if (!mid) continue;
      if (!byMb.has(mid)) byMb.set(mid, []);
      byMb.get(mid)!.push(id);
    }
    try {
      await Promise.all(
        Array.from(byMb.entries()).map(([mid, list]) =>
          api.post(`/email-marketing/mailboxes/${mid}/messages/bulk-action`, {
            ids: list, action, ...extra,
          })
        )
      );
      setChecked(new Set());
      if (selected && ids.includes(selected.id)) setSelected(null);
      loadMessages();
      loadStats();
      notification.success('Pronto', `${ids.length} mensagem(ns) atualizada(s)`);
    } catch (e: any) {
      notification.error('Erro', e.response?.data?.message || e.message);
    }
  };

  /* ── Compose ── */
  const extractQuotedOriginal = (msg: MessageFull) => {
    const split = msg.body_html
      ? splitQuotedHtml(msg.body_html)
      : { latest: '', history: '' };
    const latest = split.latest || msg.body_html || '';
    if (latest) return latest;
    const textLatest = splitQuotedText(msg.body_text || '').latest || msg.body_text || '';
    return textLatest ? `<pre style="white-space:pre-wrap;font-family:inherit;margin:0">${textLatest}</pre>` : '';
  };

  const startCompose = (mode?: 'new' | 'reply' | 'reply-all' | 'forward', msg?: MessageFull) => {
    const base = { ...EMPTY_COMPOSE };
    if (msg && mode === 'reply') {
      base.to_email = msg.from_email || '';
      base.to_name = msg.from_name || '';
      base.subject = msg.subject?.toLowerCase().startsWith('re:') ? msg.subject : `Re: ${msg.subject || ''}`;
      base.reply_to_message_id = msg.id;
      base.compose_mode = 'reply';
      base.body_html = '';
      base.quoted_html = extractQuotedOriginal(msg);
      base.quoted_label = `Mensagem original · ${msg.from_name || msg.from_email || 'cliente'} · ${formatFullDate(msg.received_at || msg.sent_at || msg.created_at)}`;
    } else if (msg && mode === 'reply-all') {
      base.to_email = msg.from_email || '';
      base.to_name = msg.from_name || '';
      const ccParts = [msg.to_email, ...(String(msg.cc || '').split(/[,;]/).map((s) => s.trim()).filter(Boolean))]
        .filter((e) => e && e.toLowerCase() !== activeMailbox?.email?.toLowerCase() && e.toLowerCase() !== (msg.from_email || '').toLowerCase());
      base.cc = Array.from(new Set(ccParts)).join(', ');
      base.subject = msg.subject?.toLowerCase().startsWith('re:') ? msg.subject : `Re: ${msg.subject || ''}`;
      base.reply_to_message_id = msg.id;
      base.compose_mode = 'reply';
      base.body_html = '';
      base.quoted_html = extractQuotedOriginal(msg);
      base.quoted_label = `Mensagem original · ${msg.from_name || msg.from_email || 'cliente'} · ${formatFullDate(msg.received_at || msg.sent_at || msg.created_at)}`;
      setShowCc(true);
    } else if (msg && mode === 'forward') {
      base.subject = msg.subject?.toLowerCase().startsWith('fwd:') || msg.subject?.toLowerCase().startsWith('enc:')
        ? msg.subject
        : `Enc: ${msg.subject || ''}`;
      base.compose_mode = 'forward';
      base.body_html = '';
      base.quoted_html = extractQuotedOriginal(msg);
      base.quoted_label = `Encaminhada · De ${msg.from_name || msg.from_email || ''} · ${msg.subject || ''}`;
    } else if (msg && msg.folder === 'drafts') {
      base.to_email = msg.to_email || '';
      base.to_name = msg.to_name || '';
      base.cc = msg.cc || '';
      base.bcc = msg.bcc || '';
      base.subject = msg.subject || '';
      base.body_html = msg.body_html || msg.body_text || '';
      base.draft_id = msg.id;
      base.compose_mode = 'draft';
      if (msg.cc || msg.bcc) setShowCc(true);
    }
    setCompose(base);
    setComposing(true);
    setSelected(null);
    setConfirmSend(false);
    setShowPreview(false);
    setQuoteOpen(false);
    setTimeout(() => {
      if (editorRef.current) editorRef.current.innerHTML = base.body_html || '<p><br></p>';
    }, 50);
  };

  const execCmd = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
    editorRef.current?.focus();
  };

  const syncEditor = () => {
    if (editorRef.current) {
      setCompose((c) => ({ ...c, body_html: editorRef.current!.innerHTML }));
    }
  };

  /** Extrai e-mails válidos de qualquer texto (vírgula, ;, espaço, etc.) */
  const parseEmailList = (raw: string) => {
    const re =
      /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+/g;
    const matches = String(raw || '').match(re) || [];
    return [...new Set(matches.map((e) => e.trim().toLowerCase()))];
  };

  const pickValue = (domVal: string | undefined | null, stateVal: string) => {
    const d = String(domVal ?? '').trim();
    const s = String(stateVal ?? '').trim();
    // NÃO usar ?? — string vazia no DOM apagava o state do React
    if (parseEmailList(d).length >= parseEmailList(s).length && (d || !s)) {
      // preferir o que tiver mais e-mails; se empate, o mais longo
      if (parseEmailList(d).length > parseEmailList(s).length) return d;
      if (d.length >= s.length && d) return d;
    }
    return s || d;
  };

  const readComposeFields = () => {
    const toDom = (document.getElementById('mailbox-compose-to') as HTMLInputElement | null)?.value;
    const subjectDom = (document.getElementById('mailbox-compose-subject') as HTMLInputElement | null)?.value;
    const nameDom = (document.getElementById('mailbox-compose-name') as HTMLInputElement | null)?.value;
    const ccDom = (document.getElementById('mailbox-compose-cc') as HTMLInputElement | null)?.value;
    const bccDom = (document.getElementById('mailbox-compose-bcc') as HTMLInputElement | null)?.value;
    const to_email = pickValue(toDom, compose.to_email);
    const subject = (() => {
      const d = String(subjectDom ?? '').trim();
      const s = String(compose.subject ?? '').trim();
      return d || s;
    })();
    return {
      to_email,
      to_name: String(nameDom ?? compose.to_name ?? '').trim() || String(compose.to_name || '').trim(),
      subject,
      cc: pickValue(ccDom, compose.cc),
      bcc: pickValue(bccDom, compose.bcc),
    };
  };

  const fileToBase64 = (file: File) =>
    new Promise<{ filename: string; contentType: string; content: string }>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || '');
        const content = result.includes(',') ? result.split(',')[1] : result;
        resolve({
          filename: file.name,
          contentType: file.type || 'application/octet-stream',
          content,
        });
      };
      reader.onerror = () => reject(new Error(`Falha ao ler ${file.name}`));
      reader.readAsDataURL(file);
    });

  const handleSend = async (asDraft = false) => {
    if (!composeMailboxId) {
      notification.warning('Atenção', 'Selecione uma caixa de e-mail no topo da página');
      return;
    }
    const fields = readComposeFields();
    const tos = parseEmailList(fields.to_email);

    setCompose((c) => ({
      ...c,
      to_email: tos.join(', ') || fields.to_email,
      to_name: fields.to_name,
      subject: fields.subject,
      cc: parseEmailList(fields.cc).join(', ') || fields.cc,
      bcc: parseEmailList(fields.bcc).join(', ') || fields.bcc,
    }));

    if (!asDraft && !tos.length) {
      notification.warning(
        'Atenção',
        'Preencha o campo PARA com um e-mail válido (ex.: nome@gmail.com). Vários: separe com vírgula.'
      );
      document.getElementById('mailbox-compose-to')?.focus();
      return;
    }
    if (!asDraft && !fields.subject) {
      notification.warning('Atenção', 'Preencha o campo ASSUNTO');
      document.getElementById('mailbox-compose-subject')?.focus();
      return;
    }

    setSending(true);
    pollSkipRef.current = true;
    setConfirmSend(false);
    try {
      syncEditor();
      const written = replaceVariables(editorRef.current?.innerHTML || compose.body_html || '', getSystemVariables());
      const quoteBlock = compose.quoted_html
        ? `<div style="margin-top:24px;padding-top:16px;border-top:1px solid #334155">
            <p style="color:#94a3b8;font-size:12px;margin:0 0 8px">${compose.quoted_label || 'Mensagem original'}</p>
            <blockquote style="border-left:3px solid #6366f1;padding-left:12px;margin:0;color:#94a3b8">${compose.quoted_html}</blockquote>
          </div>`
        : '';
      const html = `${written}${quoteBlock}`;
      let attachments_base64: Array<{ filename: string; contentType: string; content: string }> = [];
      if (compose.files.length > 0) {
        attachments_base64 = await Promise.all(compose.files.map((f) => fileToBase64(f)));
      }

      await api.post(`/email-marketing/mailboxes/${composeMailboxId}/send`, {
        to_email: tos.join(', ') || fields.to_email,
        to_name: fields.to_name || undefined,
        subject: fields.subject,
        body_html: html,
        body_text: stripHtml(html),
        cc: parseEmailList(fields.cc).join(', ') || undefined,
        bcc: parseEmailList(fields.bcc).join(', ') || undefined,
        save_as_draft: asDraft || undefined,
        draft_id: compose.draft_id || undefined,
        scheduled_at: compose.scheduled_at ? new Date(compose.scheduled_at).toISOString() : undefined,
        request_read_receipt: compose.request_read_receipt || undefined,
        append_signature: compose.append_signature,
        reply_to_message_id: compose.reply_to_message_id || undefined,
        attachments_base64: attachments_base64.length ? attachments_base64 : undefined,
      });
      notification.success(
        asDraft ? 'Rascunho salvo' : compose.scheduled_at ? 'Agendado' : 'Enviado',
        asDraft ? 'Mensagem salva em Rascunhos' : `Para ${tos.join(', ') || fields.to_email}`
      );
      setComposing(false);
      setCompose(EMPTY_COMPOSE);
      setConfirmSend(false);
      if (asDraft) setFolder('drafts');
      else setFolder('sent');
      if (allMode) setAllMode(false);
      if (!mailboxId && composeMailboxId) setMailboxId(composeMailboxId);
      loadMessages();
      loadStats();
    } catch (e: any) {
      notification.error('Erro', e.response?.data?.message || e.message);
    } finally {
      setSending(false);
      pollSkipRef.current = false;
    }
  };

  const onComposeKeyDown = (e: ReactKeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSend(false);
    }
  };

  /* ── Downloads ── */
  const downloadBlob = async (path: string, filename: string) => {
    try {
      const url = `${apiRoot()}/email-marketing${path}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${authToken()}` },
      });
      if (!res.ok) throw new Error('Falha no download');
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e: any) {
      notification.error('Erro', e.message || 'Download falhou');
    }
  };

  const downloadEml = () => {
    if (!selected) return;
    const mid = resolveMailboxForMsg(selected);
    if (!mid) return;
    downloadBlob(`/mailboxes/${mid}/messages/${selected.id}/eml`, `${selected.subject || 'mensagem'}.eml`);
  };

  const downloadZip = () => {
    if (!selected) return;
    const mid = resolveMailboxForMsg(selected);
    if (!mid) return;
    downloadBlob(`/mailboxes/${mid}/messages/${selected.id}/attachments.zip`, `anexos-${selected.id}.zip`);
  };

  const printMessage = () => {
    if (!selected) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>${selected.subject || ''}</title>
      <style>body{font-family:system-ui,sans-serif;padding:24px;color:#111} img{max-width:100%}</style></head><body>
      <h2>${selected.subject || '(sem assunto)'}</h2>
      <p><b>De:</b> ${selected.from_name || ''} &lt;${selected.from_email}&gt;<br/>
      <b>Para:</b> ${selected.to_email}<br/>
      <b>Data:</b> ${formatFullDate(selected.received_at || selected.sent_at || selected.created_at)}</p>
      <hr/>${rewriteMailboxHtml(selected.body_html || `<pre>${selected.body_text || ''}</pre>`)}
      </body></html>`);
    w.document.close();
    w.focus();
    w.print();
  };

  /* ── Block / list ── */
  const blockSender = async () => {
    if (!selected?.from_email) return;
    try {
      await api.post('/email-marketing/restrictions', {
        email: selected.from_email,
        reason: 'blocked',
        source: 'mailbox',
      });
      notification.success('Bloqueado', selected.from_email);
      await doAction(selected.id, 'spam', resolveMailboxForMsg(selected) || undefined);
    } catch (e: any) {
      notification.error('Erro', e.response?.data?.message || e.message);
    }
  };

  const addToList = async (listId: number) => {
    if (!selected) return;
    try {
      await api.post(`/email-marketing/lists/${listId}/contacts`, {
        email: selected.from_email,
        name: selected.from_name || undefined,
      });
      notification.success('Contato adicionado', selected.from_email);
      setShowAddList(false);
    } catch (e: any) {
      notification.error('Erro', e.response?.data?.message || e.message);
    }
  };

  /* ── Settings ── */
  const saveSettings = async () => {
    if (!mailboxId) return;
    setSavingSettings(true);
    try {
      const r = await api.patch(`/email-marketing/mailboxes/${mailboxId}`, {
        signature_html: sigHtml,
        signature_enabled: sigEnabled,
        display_name: displayName || null,
      });
      setMailboxes((prev) => prev.map((m) => (m.id === mailboxId ? { ...m, ...r.data.data } : m)));
      notification.success('Salvo', 'Configurações da caixa atualizadas');
      setShowSettings(false);
    } catch (e: any) {
      notification.error('Erro', e.response?.data?.message || e.message);
    } finally {
      setSavingSettings(false);
    }
  };

  /* ── Custom folder / QR ── */
  const createFolder = async () => {
    if (!newFolderName.trim()) return;
    setCreatingFolder(true);
    try {
      await api.post('/email-marketing/mailbox-folders', {
        name: newFolderName.trim(),
        color: newFolderColor,
        mailbox_id: allMode ? undefined : mailboxId || undefined,
      });
      setNewFolderName('');
      setShowNewFolder(false);
      loadFolders();
      notification.success('Pasta criada', newFolderName.trim());
    } catch (e: any) {
      notification.error('Erro', e.response?.data?.message || e.message);
    } finally {
      setCreatingFolder(false);
    }
  };

  const deleteFolder = async (id: number) => {
    try {
      await api.delete(`/email-marketing/mailbox-folders/${id}`);
      if (folder === `custom:${id}`) setFolder('inbox');
      loadFolders();
    } catch (e: any) {
      notification.error('Erro', e.response?.data?.message || e.message);
    }
  };

  const createQuickReply = async () => {
    if (!qrTitle.trim() || !qrBody.trim()) return;
    setCreatingQr(true);
    try {
      const attachments_base64 = await Promise.all(qrFiles.map(async (f) => ({
        filename: f.name,
        contentType: f.type || 'application/octet-stream',
        content: await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(String(r.result || '').split(',')[1] || '');
          r.onerror = () => reject(new Error('Falha ao ler arquivo'));
          r.readAsDataURL(f);
        }),
      })));
      await api.post('/email-marketing/mailbox-quick-replies', {
        title: qrTitle.trim(),
        body_html: qrBody,
        mailbox_id: mailboxId || undefined,
        attachments_base64,
      });
      setQrTitle(''); setQrBody(''); setQrFiles([]); setShowNewQr(false);
      loadQuickReplies();
      notification.success('Resposta rápida', 'Criada com sucesso');
    } catch (e: any) {
      notification.error('Erro', e.response?.data?.message || e.message);
    } finally {
      setCreatingQr(false);
    }
  };

  const deleteQuickReply = async (id: number) => {
    try {
      await api.delete(`/email-marketing/mailbox-quick-replies/${id}`);
      loadQuickReplies();
    } catch (e: any) {
      notification.error('Erro', e.response?.data?.message || e.message);
    }
  };

  const insertQuickReply = (qr: QuickReply) => {
    const vars = getSystemVariables();
    const html = replaceVariables(qr.body_html || '', vars);
    const atts = Array.isArray(qr.attachments) ? qr.attachments : [];
    const imgHtml = atts
      .filter((a) => String(a.contentType || '').startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp)$/i.test(a.filename || ''))
      .map((a) => `<p><img src="${absoluteUploadUrl(a.url)}" alt="${a.filename}" style="max-width:100%;height:auto" /></p>`)
      .join('');
    const extra = html + imgHtml;
    if (editorRef.current) {
      editorRef.current.innerHTML = (editorRef.current.innerHTML || '') + extra;
      syncEditor();
    } else {
      setCompose((c) => ({ ...c, body_html: c.body_html + extra }));
    }
    if (atts.length) {
      Promise.all(atts.map(async (a) => {
        try {
          const res = await fetch(absoluteUploadUrl(a.url));
          const blob = await res.blob();
          return new File([blob], a.filename || 'arquivo', { type: a.contentType || blob.type });
        } catch {
          return null;
        }
      })).then((files) => {
        const ok = files.filter((f): f is File => !!f);
        if (ok.length) setCompose((c) => ({ ...c, files: [...c.files, ...ok] }));
      });
    }
  };

  /* ── Selection helpers ── */
  const toggleCheck = (id: number) => {
    setChecked((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const toggleCheckAll = () => {
    if (checked.size === messages.length) setChecked(new Set());
    else setChecked(new Set(messages.map((m) => m.id)));
  };

  const openMailboxCard = (id: number) => {
    setAllMode(false);
    setMailboxId(id);
    router.push(`/email-marketing/caixa-entrada?mailbox=${id}`, undefined, { shallow: true });
  };

  const backToMailboxCards = () => {
    setMailboxId(null);
    setAllMode(false);
    setSelected(null);
    setComposing(false);
    router.push('/email-marketing/caixa-entrada', undefined, { shallow: true });
  };

  /* ── Keyboard shortcuts ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || composing || showPreview || confirmSend) {
        if (composing && (e.ctrlKey || e.metaKey) && e.key === 'Enter') return;
        if (isTypingTarget(e.target)) return;
      }
      if (e.target instanceof HTMLElement && e.target.closest('[data-compose]')) return;

      const key = e.key.toLowerCase();
      if (key === 'c' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        startCompose('new');
        return;
      }
      if (!messages.length) return;

      if (key === 'j') {
        e.preventDefault();
        const next = Math.min(messages.length - 1, (focusIdx < 0 ? -1 : focusIdx) + 1);
        setFocusIdx(next);
        const m = messages[next];
        if (m) openMessage(m.id, m.mailbox_id);
      } else if (key === 'k') {
        e.preventDefault();
        const next = Math.max(0, (focusIdx < 0 ? messages.length : focusIdx) - 1);
        setFocusIdx(next);
        const m = messages[next];
        if (m) openMessage(m.id, m.mailbox_id);
      } else if (key === 'r' && selected) {
        e.preventDefault();
        startCompose('reply', selected);
      } else if (key === 'e' && selected) {
        e.preventDefault();
        doAction(selected.id, 'archive', resolveMailboxForMsg(selected) || undefined);
      } else if (key === '#' && selected) {
        e.preventDefault();
        doAction(selected.id, 'trash', resolveMailboxForMsg(selected) || undefined);
      } else if (key === 's' && selected) {
        e.preventDefault();
        doAction(
          selected.id,
          selected.is_starred ? 'unstar' : 'star',
          resolveMailboxForMsg(selected) || undefined
        );
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, focusIdx, selected, composing, showPreview, confirmSend]);

  /* ── Sidebar items ── */
  const sidebarItems: { key: FolderKey; label: string; icon: any; count?: number }[] = [
    { key: 'inbox', label: 'Entrada', icon: FaInbox, count: stats.unread || stats.inbox },
    { key: 'starred', label: 'Com estrela', icon: FaStar, count: stats.starred },
    { key: 'sent', label: 'Enviados', icon: FaPaperPlane, count: stats.sent },
    { key: 'drafts', label: 'Rascunhos', icon: FaEdit, count: stats.drafts },
    { key: 'archive', label: 'Arquivo', icon: FaArchive, count: stats.archive },
    { key: 'spam', label: 'Spam', icon: FaBan, count: stats.spam },
    { key: 'trash', label: 'Lixeira', icon: FaTrash, count: stats.trash },
  ];

  const folderLabel = (() => {
    if (folder.startsWith('custom:')) {
      const cf = customFolders.find((f) => f.id === Number(folder.split(':')[1]));
      return cf?.name || 'Pasta';
    }
    return sidebarItems.find((s) => s.key === folder)?.label || 'Entrada';
  })();

  const inputCls =
    'w-full px-3.5 py-2.5 bg-[#0b1220] border border-white/10 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:border-indigo-400/50 focus:ring-1 focus:ring-indigo-400/20';
  const btnGhost =
    'p-2 rounded-lg text-white/55 hover:text-white hover:bg-white/[0.08] transition-all';
  const btnAccent =
    'px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg text-sm flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-indigo-900/40';

  return (
    <>
      <Head><title>Caixa de e-mail | E-mail Marketing</title></Head>
      <ProtectedRoute requiredPermission="email_marketing" fallbackPath="/">
        <notification.NotificationContainer />
        <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 py-8 px-4">
          <div className="max-w-[1600px] mx-auto space-y-6">
            <div className="relative overflow-hidden bg-gradient-to-r from-indigo-600/30 via-cyan-500/20 to-indigo-600/30 backdrop-blur-xl border-2 border-indigo-500/40 rounded-3xl p-8 md:p-10 shadow-2xl shadow-indigo-500/20">
              <div className="absolute inset-0 bg-grid-white/[0.02]"></div>
              <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl"></div>
              <div className="relative flex items-center justify-between gap-6 flex-wrap">
                <div className="flex items-center gap-5 flex-wrap">
                  <button type="button" onClick={() => router.push('/email-marketing')} className="p-3 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all">
                    <FaArrowLeft className="text-xl" />
                  </button>
                  <div className="bg-gradient-to-br from-cyan-500 to-indigo-600 p-5 rounded-2xl shadow-lg shadow-cyan-500/40">
                    <FaInbox className="text-5xl md:text-6xl text-white" />
                  </div>
                  <div>
                    <h1 className="text-4xl md:text-6xl font-black text-white mb-2 tracking-tight">Caixa de e-mail</h1>
                    <p className="text-lg md:text-2xl text-white/80 font-medium">Leia, responda e organize os e-mails do cliente</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => { loadMailboxes(); if (mailboxId) { loadMessages(); loadStats(); } }}
                    className="p-3 bg-white/10 hover:bg-white/20 rounded-xl text-white"
                    title="Atualizar"
                  >
                    <FaSync className={loading ? 'animate-spin' : ''} />
                  </button>
                  <button
                    type="button"
                    onClick={() => { getMailboxAudio(); setSoundOn((s) => !s); }}
                    className={`p-3 rounded-xl border-2 transition-all ${soundOn ? 'bg-emerald-500/25 border-emerald-400/50 text-emerald-200' : 'bg-white/5 border-white/10 text-white/50'}`}
                    title={soundOn ? 'Som ligado — clique para desligar' : 'Som desligado — clique para ligar'}
                  >
                    {soundOn ? <FaVolumeUp /> : <FaVolumeMute />}
                  </button>
                  {mailboxId && (
                    <button type="button" onClick={() => setShowSettings(true)} className="p-3 bg-white/10 hover:bg-white/20 rounded-xl text-white" title="Assinatura da caixa">
                      <FaCog />
                    </button>
                  )}
                  {mailboxId && (
                    <button type="button" disabled={!composeMailboxId} onClick={() => startCompose('new')} className={btnAccent}>
                      <FaPlus /> Novo
                    </button>
                  )}
                </div>
              </div>
            </div>

            {mailboxes.length === 0 ? (
              <div className="bg-dark-800/60 border border-white/10 rounded-2xl p-12 text-center backdrop-blur-xl">
                <FaEnvelope className="text-5xl text-white/20 mx-auto mb-4" />
                <p className="text-white/60 mb-4">Crie um e-mail primeiro para usar a caixa de e-mail.</p>
                <button
                  type="button"
                  onClick={() => router.push('/email-marketing/criar-email')}
                  className={btnAccent + ' mx-auto'}
                >
                  Criar e-mail
                </button>
              </div>
            ) : (
              <>
              <div>
                {mailboxes.length > 8 && (
                  <div className="relative mb-2 max-w-sm">
                    <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35 text-xs" />
                    <input
                      value={mailboxFilter}
                      onChange={(e) => setMailboxFilter(e.target.value)}
                      placeholder="Filtrar caixas…"
                      className="w-full pl-8 pr-3 py-1.5 bg-[#0b1220] border border-white/10 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:border-indigo-400/40"
                    />
                  </div>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10 gap-2">
                {mailboxes
                  .filter((m) => {
                    const qf = mailboxFilter.trim().toLowerCase();
                    if (!qf) return true;
                    return `${m.display_name || ''} ${m.email}`.toLowerCase().includes(qf);
                  })
                  .map((m, i) => {
                  const palettes = [
                    { box: 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/40', icon: 'bg-cyan-500/20 text-cyan-300', badge: 'bg-cyan-500' },
                    { box: 'from-indigo-500/20 to-indigo-600/10 border-indigo-500/40', icon: 'bg-indigo-500/20 text-indigo-300', badge: 'bg-indigo-500' },
                    { box: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/40', icon: 'bg-emerald-500/20 text-emerald-300', badge: 'bg-emerald-500' },
                    { box: 'from-orange-500/20 to-orange-600/10 border-orange-500/40', icon: 'bg-orange-500/20 text-orange-300', badge: 'bg-orange-500' },
                    { box: 'from-purple-500/20 to-pink-600/10 border-purple-500/40', icon: 'bg-purple-500/20 text-purple-300', badge: 'bg-purple-500' },
                  ];
                  const p = palettes[i % palettes.length];
                  const active = mailboxId === m.id;
                  const alerting = alertMailboxIds.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => openMailboxCard(m.id)}
                      className={`relative text-left bg-gradient-to-br ${p.box} border rounded-xl px-2.5 py-2 transition-all hover:brightness-110 ${
                        active ? 'ring-2 ring-white/50' : ''
                      } ${alerting ? 'animate-pulse ring-2 ring-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.55)]' : ''}`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`${p.icon} p-1.5 rounded-lg flex-shrink-0`}>
                          <FaInbox className="text-sm" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1">
                            <p className="text-white text-[13px] font-bold truncate leading-tight">
                              {m.display_name || m.email.split('@')[0]}
                            </p>
                            {m.unread_count > 0 && (
                              <span className={`ml-auto flex-shrink-0 min-w-[18px] h-[18px] px-1 rounded-full ${p.badge} text-white text-[10px] font-black flex items-center justify-center`}>
                                {m.unread_count > 99 ? '99+' : m.unread_count}
                              </span>
                            )}
                          </div>
                          <p className="text-white/55 text-[10px] truncate leading-tight">{m.email}</p>
                          <p className={`text-[10px] font-semibold mt-0.5 ${alerting ? 'text-emerald-300' : active ? 'text-white/80' : 'text-white/40'}`}>
                            {alerting ? 'Novo e-mail' : active ? 'Aberta' : m.unread_count > 0 ? 'Não lidos' : 'Abrir'}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
                </div>
              </div>
              {mailboxId ? (
              <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(300px,1fr)_minmax(380px,1.4fr)] min-h-[74vh] bg-[#10161f]/90 border border-white/10 rounded-3xl overflow-hidden shadow-2xl divide-y lg:divide-y-0 lg:divide-x divide-white/10">
                {/* ── Sidebar ── */}
                <aside className="bg-[#0c1219] p-4 flex flex-col gap-0.5">
                  {sidebarItems.map(({ key, label, icon: Icon, count }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setFolder(key)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-[13px] transition-all ${
                        folder === key
                          ? 'bg-indigo-600/20 text-white font-semibold'
                          : 'text-white/60 hover:bg-white/5 hover:text-white/90 font-medium'
                      }`}
                    >
                      <Icon className="text-sm opacity-80 flex-shrink-0" />
                      <span className="flex-1 truncate">{label}</span>
                      {!allMode && count != null && count > 0 && (
                        <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-white/10 text-white/60">{count}</span>
                      )}
                    </button>
                  ))}

                  <div className="mt-2 pt-2 border-t border-white/10">
                    <div className="flex items-center justify-between px-2 mb-1">
                      <span className="text-[11px] uppercase tracking-wide text-white/40 font-bold">Pastas</span>
                      <button type="button" onClick={() => setShowNewFolder((v) => !v)} className="text-indigo-300 hover:text-indigo-200 text-xs p-1">
                        <FaPlus />
                      </button>
                    </div>
                    {showNewFolder && (
                      <div className="p-2 space-y-2 mb-2 bg-black/20 rounded-xl">
                        <input value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="Nome da pasta" className={inputCls} />
                        <div className="flex gap-2">
                          <input type="color" value={newFolderColor} onChange={(e) => setNewFolderColor(e.target.value)} className="h-9 w-10 rounded-lg bg-transparent border border-white/15 cursor-pointer" />
                          <button type="button" disabled={creatingFolder} onClick={createFolder} className="flex-1 py-2 bg-indigo-500/20 text-indigo-200 rounded-lg text-xs font-semibold">
                            {creatingFolder ? <FaSpinner className="animate-spin mx-auto" /> : 'Criar'}
                          </button>
                        </div>
                      </div>
                    )}
                    {customFolders.map((cf) => (
                      <div key={cf.id} className="group flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setFolder(`custom:${cf.id}`)}
                          className={`flex-1 flex items-center gap-3 px-3 py-2 rounded-xl text-left text-sm ${
                            folder === `custom:${cf.id}`
                              ? 'bg-indigo-600/20 text-white font-semibold'
                              : 'text-white/70 hover:bg-white/5'
                          }`}
                        >
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: cf.color || '#22d3ee' }} />
                          <span className="truncate">{cf.name}</span>
                        </button>
                        <button type="button" onClick={() => deleteFolder(cf.id)} className="opacity-0 group-hover:opacity-100 p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg">
                          <FaTimes className="text-xs" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="mt-auto pt-3 border-t border-white/10">
                    <div className="flex items-center justify-between px-2 mb-1">
                      <span className="text-[11px] uppercase tracking-wide text-white/40 font-bold">Respostas rápidas</span>
                      <button type="button" onClick={() => setShowNewQr((v) => !v)} className="text-indigo-300 hover:text-indigo-200 text-xs p-1">
                        <FaPlus />
                      </button>
                    </div>
                    {showNewQr && (
                      <div className="p-2 space-y-2 mb-2 bg-black/20 rounded-xl">
                        <input value={qrTitle} onChange={(e) => setQrTitle(e.target.value)} placeholder="Título" className={inputCls} />
                        <textarea value={qrBody} onChange={(e) => setQrBody(e.target.value)} placeholder="Texto da resposta. Use as variáveis abaixo." rows={3} className={inputCls + ' resize-y'} />
                        <div className="flex flex-wrap gap-1">
                          {[
                            { token: '{{saudacao}}', label: 'Saudação' },
                            { token: '{{hora}}', label: 'Hora' },
                            { token: '{{data}}', label: 'Data' },
                          ].map((v) => (
                            <button
                              key={v.token}
                              type="button"
                              onClick={() => setQrBody((b) => `${b}${v.token}`)}
                              className="px-2 py-1 rounded-md bg-indigo-500/20 text-indigo-200 text-[11px] font-semibold"
                              title="Bom dia / Boa tarde / Boa noite / Boa madrugada"
                            >
                              {v.label}
                            </button>
                          ))}
                        </div>
                        <input
                          ref={qrFileInputRef}
                          type="file"
                          multiple
                          accept="image/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.txt"
                          className="hidden"
                          onChange={(e) => {
                            const files = Array.from(e.target.files || []);
                            setQrFiles((prev) => [...prev, ...files]);
                            e.target.value = '';
                          }}
                        />
                        <button type="button" onClick={() => qrFileInputRef.current?.click()} className="w-full py-1.5 text-[12px] text-white/70 hover:text-white flex items-center justify-center gap-1.5">
                          <FaPaperclip /> Imagem, áudio ou arquivo
                        </button>
                        {qrFiles.map((f, i) => (
                          <span key={i} className="flex items-center justify-between text-[11px] text-indigo-200 bg-indigo-500/10 px-2 py-1 rounded">
                            {f.name}
                            <button type="button" onClick={() => setQrFiles((prev) => prev.filter((_, j) => j !== i))}><FaTimes /></button>
                          </span>
                        ))}
                        <button type="button" disabled={creatingQr} onClick={createQuickReply} className="w-full py-2 bg-emerald-500/20 text-emerald-300 rounded-xl text-xs font-bold">
                          {creatingQr ? <FaSpinner className="animate-spin mx-auto" /> : 'Salvar'}
                        </button>
                      </div>
                    )}
                    <div className="max-h-28 overflow-y-auto space-y-0.5">
                      {quickReplies.map((qr) => (
                        <div key={qr.id} className="group flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-white/5">
                          <span className="flex-1 truncate text-xs text-white/60">{qr.title}</span>
                          <button type="button" onClick={() => deleteQuickReply(qr.id)} className="opacity-0 group-hover:opacity-100 text-red-400 p-1">
                            <FaTimes className="text-[10px]" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </aside>

                {/* ── Message list ── */}
                <section className="bg-[#111820] overflow-hidden flex flex-col min-h-[50vh]">
                  <div className="px-4 py-3.5 border-b border-white/[0.08] space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-white font-semibold text-[15px] tracking-tight">{folderLabel}</h2>
                      {checked.size > 0 && (
                        <div className="flex items-center gap-1">
                          <button type="button" title="Marcar lido" onClick={() => doBulk('read')} className={btnGhost}><FaCheck /></button>
                          <button type="button" title="Estrela" onClick={() => doBulk('star')} className={btnGhost}><FaStar /></button>
                          <button type="button" title="Arquivar" onClick={() => doBulk('archive')} className={btnGhost}><FaArchive /></button>
                          <button type="button" title="Spam" onClick={() => doBulk('spam')} className={btnGhost}><FaBan /></button>
                          <button type="button" title="Lixeira" onClick={() => doBulk('trash')} className={btnGhost}><FaTrash /></button>
                        </div>
                      )}
                    </div>
                    <div className="relative">
                      <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-xs" />
                      <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Buscar…"
                        className="w-full pl-9 pr-3 py-2 bg-[#0b1220] border border-white/10 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:border-indigo-400/40"
                      />
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setFilterUnread((v) => !v)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                          filterUnread ? 'bg-indigo-500/20 border-indigo-400/40 text-indigo-200' : 'border-white/10 text-white/45 hover:text-white'
                        }`}
                      >
                        <FaFilter className="inline mr-1" /> Não lidos
                      </button>
                      <button
                        type="button"
                        onClick={() => setFilterAttachments((v) => !v)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                          filterAttachments ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' : 'border-white/10 text-white/50 hover:text-white'
                        }`}
                      >
                        <FaPaperclip className="inline mr-1" /> Com anexo
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 px-3 py-1.5 border-b border-white/5 text-xs text-white/40">
                    <input
                      type="checkbox"
                      checked={messages.length > 0 && checked.size === messages.length}
                      onChange={toggleCheckAll}
                      className="rounded accent-cyan-500"
                    />
                    <span>{messages.length} mensagem(ns)</span>
                  </div>

                  <div className="flex-1 overflow-y-auto max-h-[62vh]">
                    {loading ? (
                      <div className="p-12 text-center text-white/40"><FaSpinner className="animate-spin text-2xl mx-auto" /></div>
                    ) : messages.length === 0 ? (
                      <div className="p-12 text-center text-white/40 text-sm">Nenhuma mensagem nesta pasta</div>
                    ) : (
                      messages.map((msg, idx) => {
                        const active = selected?.id === msg.id || focusIdx === idx;
                        const unread = !msg.is_read;
                        const arrivedAt = new Date(msg.received_at || msg.created_at).getTime();
                        const isNewArrival = unread && msg.direction !== 'outbound' && Date.now() - arrivedAt < 30 * 60 * 1000;
                        return (
                          <div
                            key={`${msg.mailbox_id}-${msg.id}`}
                            className={`flex items-stretch border-b border-white/5 border-l-[3px] transition-colors ${
                              active
                                ? 'bg-indigo-500/20 border-l-indigo-300'
                                : isNewArrival
                                  ? 'border-l-emerald-400 bg-emerald-500/15 hover:bg-emerald-500/20'
                                  : unread
                                    ? 'border-l-amber-400 bg-amber-500/10 hover:bg-amber-500/15'
                                    : 'border-l-transparent hover:bg-white/[0.04]'
                            }`}
                          >
                            <div className="flex items-center px-2 gap-1.5">
                              <input
                                type="checkbox"
                                checked={checked.has(msg.id)}
                                onChange={() => toggleCheck(msg.id)}
                                className="rounded accent-cyan-500"
                                onClick={(e) => e.stopPropagation()}
                              />
                              <button
                                type="button"
                                className="p-1 text-amber-400/80 hover:text-amber-300"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  doAction(msg.id, msg.is_starred ? 'unstar' : 'star', msg.mailbox_id);
                                }}
                              >
                                {msg.is_starred ? <FaStar className="text-xs" /> : <FaRegStar className="text-xs opacity-40" />}
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setFocusIdx(idx);
                                if (msg.folder === 'drafts') {
                                  openMessage(msg.id, msg.mailbox_id, false).then(() => {
                                    /* open then compose from draft after load — handled below via selected */
                                  });
                                  api.get(`/email-marketing/mailboxes/${msg.mailbox_id}/messages/${msg.id}`, {
                                    params: { mark_read: false },
                                  }).then((r) => startCompose('new', r.data.data)).catch(() => openMessage(msg.id, msg.mailbox_id));
                                } else {
                                  openMessage(msg.id, msg.mailbox_id);
                                }
                              }}
                              className="flex-1 text-left px-2 py-3 min-w-0"
                            >
                              <div className="flex items-center gap-2">
                                {unread && <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isNewArrival ? 'bg-emerald-400' : 'bg-amber-400'}`} />}
                                <p className={`truncate text-[16px] ${unread ? 'text-white font-bold' : 'text-white/80'}`}>
                                  {folder === 'sent' || msg.direction === 'outbound'
                                    ? (msg.to_name || msg.to_email)
                                    : (msg.from_name || msg.from_email)}
                                </p>
                                {isNewArrival && (
                                  <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-emerald-500 text-white flex-shrink-0">Novo</span>
                                )}
                                {unread && !isNewArrival && (
                                  <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-amber-500 text-black flex-shrink-0">Não aberto</span>
                                )}
                                <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0 ${
                                  msg.direction === 'outbound' ? 'text-indigo-200 bg-indigo-500/20' : 'text-white bg-white/10'
                                }`}>
                                  {msg.direction === 'outbound' ? 'Enviado' : 'Recebido'}
                                </span>
                                {(msg.thread_count || 1) > 1 && (
                                  <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-white/15 text-white flex-shrink-0">
                                    {msg.thread_count} msgs
                                  </span>
                                )}
                                {msg.has_attachments && <FaPaperclip className="text-xs text-white/50 flex-shrink-0" />}
                                <span className="ml-auto text-[13px] text-white/70 flex-shrink-0 font-medium">
                                  {formatDate(msg.received_at || msg.sent_at || msg.created_at)}
                                </span>
                              </div>
                              <p className={`text-[15px] truncate mt-1 ${unread ? 'text-white font-bold' : 'text-white/85'}`}>
                                {msg.subject || '(sem assunto)'}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <p className={`text-[13px] truncate flex-1 ${unread ? 'text-white/75' : 'text-white/45'}`}>{cleanEmailPreview(msg.preview)}</p>
                                <TrackingTrailBadges msg={msg} />
                              </div>
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </section>

                {/* ── Reading / Compose pane ── */}
                <section className="bg-[#0e141c] overflow-hidden flex flex-col min-h-[50vh]">
                  {composing ? (
                    <div data-compose className="flex flex-col h-full max-h-[80vh]" onKeyDown={onComposeKeyDown}>
                      <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[11px] font-medium tracking-wide text-indigo-300/80 mb-0.5">
                            {compose.compose_mode === 'reply' ? 'Responder' : compose.compose_mode === 'forward' ? 'Encaminhar' : compose.compose_mode === 'draft' ? 'Rascunho' : 'Novo e-mail'}
                          </p>
                          <h3 className="text-white font-semibold text-base truncate">
                            {compose.subject || 'Sem assunto'}
                          </h3>
                        </div>
                        <button type="button" onClick={() => { setComposing(false); setConfirmSend(false); }} className={btnGhost}>
                          <FaTimes />
                        </button>
                      </div>
                      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                        <div className="space-y-2.5">
                          {allMode && (
                            <div className="flex items-center gap-3">
                              <label className="w-16 flex-shrink-0 text-[12px] text-white/40">De</label>
                              <select
                                value={composeMailboxId || ''}
                                onChange={(e) => { setAllMode(false); setMailboxId(Number(e.target.value)); }}
                                className={inputCls}
                              >
                                {mailboxes.map((m) => (
                                  <option key={m.id} value={m.id}>{m.email}</option>
                                ))}
                              </select>
                            </div>
                          )}
                          <div className="flex items-center gap-3">
                            <label htmlFor="mailbox-compose-to" className="w-16 flex-shrink-0 text-[12px] text-white/40">Para</label>
                            <input
                              id="mailbox-compose-to"
                              value={compose.to_email}
                              onChange={(e) => setCompose((c) => ({ ...c, to_email: e.target.value }))}
                              placeholder="cliente@email.com"
                              className={inputCls}
                              autoComplete="off"
                            />
                            <button type="button" onClick={() => setShowCc((v) => !v)} className="text-[12px] text-indigo-300 hover:text-indigo-200 whitespace-nowrap px-1">
                              {showCc ? 'Ocultar Cc' : 'Cc'}
                            </button>
                          </div>
                          <div className="flex items-center gap-3">
                            <label htmlFor="mailbox-compose-name" className="w-16 flex-shrink-0 text-[12px] text-white/40">Nome</label>
                            <input
                              id="mailbox-compose-name"
                              value={compose.to_name}
                              onChange={(e) => setCompose((c) => ({ ...c, to_name: e.target.value }))}
                              placeholder="Nome do destinatário"
                              className={inputCls}
                              autoComplete="off"
                            />
                          </div>
                          {showCc && (
                            <>
                              <div className="flex items-center gap-3">
                                <label htmlFor="mailbox-compose-cc" className="w-16 flex-shrink-0 text-[12px] text-white/40">Cc</label>
                                <input id="mailbox-compose-cc" value={compose.cc} onChange={(e) => setCompose((c) => ({ ...c, cc: e.target.value }))} className={inputCls} autoComplete="off" />
                              </div>
                              <div className="flex items-center gap-3">
                                <label htmlFor="mailbox-compose-bcc" className="w-16 flex-shrink-0 text-[12px] text-white/40">Cco</label>
                                <input id="mailbox-compose-bcc" value={compose.bcc} onChange={(e) => setCompose((c) => ({ ...c, bcc: e.target.value }))} className={inputCls} autoComplete="off" />
                              </div>
                            </>
                          )}
                          <div className="flex items-center gap-3">
                            <label htmlFor="mailbox-compose-subject" className="w-16 flex-shrink-0 text-[12px] text-white/40">Assunto</label>
                            <input
                              id="mailbox-compose-subject"
                              value={compose.subject}
                              onChange={(e) => setCompose((c) => ({ ...c, subject: e.target.value }))}
                              placeholder="Assunto"
                              className={inputCls}
                              autoComplete="off"
                            />
                          </div>
                        </div>

                        <div className="rounded-xl border border-white/10 bg-[#0b1220] overflow-hidden">
                          <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-white/[0.08] bg-white/[0.02]">
                            <button type="button" onClick={() => execCmd('bold')} className={btnGhost} title="Negrito"><FaBold /></button>
                            <button type="button" onClick={() => execCmd('italic')} className={btnGhost} title="Itálico"><FaItalic /></button>
                            <button type="button" onClick={() => execCmd('underline')} className={btnGhost} title="Sublinhado"><FaUnderline /></button>
                            <button type="button" onClick={() => { const u = prompt('URL do link'); if (u) execCmd('createLink', u); }} className={btnGhost} title="Link"><FaLink /></button>
                            <button type="button" onClick={() => execCmd('insertUnorderedList')} className={btnGhost} title="Lista"><FaListUl /></button>
                            {quickReplies.length > 0 && (
                              <>
                                <span className="w-px h-4 bg-white/10 mx-1.5" />
                                <select
                                  className="bg-transparent border-0 text-xs text-white/60 px-1 py-1 max-w-[150px] focus:outline-none"
                                  defaultValue=""
                                  onChange={(e) => {
                                    const qr = quickReplies.find((x) => x.id === Number(e.target.value));
                                    if (qr) insertQuickReply(qr);
                                    e.target.value = '';
                                  }}
                                >
                                  <option value="">Resposta rápida</option>
                                  {quickReplies.map((qr) => (
                                    <option key={qr.id} value={qr.id}>{qr.title}</option>
                                  ))}
                                </select>
                              </>
                            )}
                          </div>
                          <div
                            ref={editorRef}
                            contentEditable
                            suppressContentEditableWarning
                            onInput={syncEditor}
                            className="min-h-[200px] max-h-[280px] overflow-y-auto px-4 py-3.5 text-white text-[15px] leading-relaxed focus:outline-none prose prose-invert max-w-none empty:before:content-[attr(data-placeholder)] empty:before:text-white/25"
                            data-placeholder="Escreva a resposta…"
                          />
                        </div>

                        <div className="flex flex-wrap items-center gap-4 text-[12px] text-white/50">
                            <label className="flex items-center gap-2 cursor-pointer hover:text-white/70">
                              <input type="checkbox" checked={compose.append_signature} onChange={(e) => setCompose((c) => ({ ...c, append_signature: e.target.checked }))} className="accent-indigo-500" />
                              Assinatura
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer hover:text-white/70">
                              <input type="checkbox" checked={compose.request_read_receipt} onChange={(e) => setCompose((c) => ({ ...c, request_read_receipt: e.target.checked }))} className="accent-indigo-500" />
                              Confirmação de leitura
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer hover:text-white/70">
                              <FaClock className="text-white/30" />
                              <input
                                type="datetime-local"
                                value={compose.scheduled_at}
                                onChange={(e) => setCompose((c) => ({ ...c, scheduled_at: e.target.value }))}
                                className="bg-transparent border border-white/10 rounded-md px-2 py-1 text-white/70 text-[12px]"
                              />
                            </label>
                            <input
                              ref={fileInputRef}
                              type="file"
                              multiple
                              className="hidden"
                              onChange={(e) => {
                                const files = Array.from(e.target.files || []);
                                setCompose((c) => ({ ...c, files: [...c.files, ...files] }));
                                e.target.value = '';
                              }}
                            />
                            <button type="button" onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-1.5 text-[12px] text-white/55 hover:text-white">
                              <FaPaperclip /> Anexar
                            </button>
                            {compose.files.map((f, i) => (
                              <span key={i} className="px-2 py-0.5 bg-indigo-500/10 border border-indigo-400/20 rounded-md text-[11px] text-indigo-200 flex items-center gap-1.5">
                                {f.name}
                                <button type="button" onClick={() => setCompose((c) => ({ ...c, files: c.files.filter((_, j) => j !== i) }))}>
                                  <FaTimes className="text-[10px]" />
                                </button>
                              </span>
                            ))}
                          </div>

                        {!!compose.quoted_html && (
                          <div className="rounded-lg border border-white/[0.08] overflow-hidden">
                            <button
                              type="button"
                              onClick={() => setQuoteOpen((v) => !v)}
                              className="w-full flex items-center justify-between px-3.5 py-2.5 text-left hover:bg-white/[0.03]"
                            >
                              <span className="text-[12px] text-white/40">
                                {compose.compose_mode === 'forward' ? 'Mensagem a encaminhar' : 'Mensagem original'}
                                {compose.quoted_label ? ` · ${compose.quoted_label}` : ''}
                              </span>
                              {quoteOpen ? <FaChevronUp className="text-white/30 text-xs" /> : <FaChevronDown className="text-white/30 text-xs" />}
                            </button>
                            {quoteOpen && (
                              <div className="px-4 pb-4 border-t border-white/[0.08] pt-3 border-l-2 border-l-white/15 ml-3">
                                <div
                                  className="prose prose-invert max-w-none text-sm text-white/45 [&_img]:max-w-full"
                                  dangerouslySetInnerHTML={{ __html: rewriteMailboxHtml(compose.quoted_html) }}
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="px-6 py-3.5 border-t border-white/[0.08] flex flex-wrap items-center justify-end gap-2">
                        <button type="button" onClick={() => { syncEditor(); setShowPreview(true); }} className="px-3.5 py-2 text-white/55 hover:text-white text-sm font-medium flex items-center gap-2">
                          <FaEye /> Prévia
                        </button>
                        <button type="button" disabled={sending} onClick={() => handleSend(true)} className="px-3.5 py-2 border border-white/[0.12] hover:border-white/25 text-white/80 rounded-lg text-sm font-medium">
                          Salvar rascunho
                        </button>
                        <button type="button" disabled={sending} onClick={() => handleSend(false)} className={btnAccent}>
                          {sending ? <FaSpinner className="animate-spin" /> : <FaPaperPlane />}
                          Enviar
                          <span className="opacity-50 text-[10px] font-normal hidden sm:inline">Ctrl+Enter</span>
                        </button>
                      </div>
                    </div>
                  ) : loadingMsg ? (
                    <div className="py-24 text-center text-white/40"><FaSpinner className="animate-spin text-3xl mx-auto" /></div>
                  ) : selected ? (
                    <div className="flex flex-col h-full max-h-[75vh]">
                      <div className="px-6 py-5 border-b border-white/[0.08] space-y-3">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="min-w-0">
                            <p className="text-[11px] font-medium text-white/40 mb-1">
                              {selected.direction === 'outbound' ? 'Enviado' : 'Recebido'} · {formatFullDate(selected.received_at || selected.sent_at || selected.created_at)}
                            </p>
                            <h3 className="text-xl font-semibold text-white leading-snug tracking-tight">{selected.subject || '(sem assunto)'}</h3>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            <button type="button" onClick={() => startCompose('reply', selected)} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5">
                              <FaReply /> Responder
                            </button>
                            <button type="button" onClick={() => startCompose('reply-all', selected)} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.08] hover:bg-white/[0.12] text-white/80 flex items-center gap-1.5">
                              <FaReplyAll /> Todos
                            </button>
                            <button type="button" onClick={() => startCompose('forward', selected)} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.08] hover:bg-white/[0.12] text-white/80 flex items-center gap-1.5">
                              <FaShare /> Encaminhar
                            </button>
                            <button type="button" title="Arquivar" onClick={() => doAction(selected.id, 'archive', resolveMailboxForMsg(selected) || undefined)} className={btnGhost}><FaArchive /></button>
                            <button type="button" title="Spam" onClick={() => doAction(selected.id, 'spam', resolveMailboxForMsg(selected) || undefined)} className={btnGhost}><FaBan /></button>
                            <button type="button" title="Lixeira" onClick={() => doAction(selected.id, 'trash', resolveMailboxForMsg(selected) || undefined)} className={btnGhost}><FaTrash /></button>
                            <button
                              type="button"
                              title="Estrela"
                              onClick={() => doAction(selected.id, selected.is_starred ? 'unstar' : 'star', resolveMailboxForMsg(selected) || undefined)}
                              className={btnGhost}
                            >
                              {selected.is_starred ? <FaStar className="text-amber-400" /> : <FaRegStar />}
                            </button>
                            <button type="button" title="Marcar não lido" onClick={() => doAction(selected.id, 'unread', resolveMailboxForMsg(selected) || undefined)} className={btnGhost}><FaEnvelopeOpen /></button>
                            <div className="relative">
                              <button type="button" className={btnGhost} onClick={(e) => {
                                const menu = (e.currentTarget.nextSibling as HTMLElement);
                                if (menu) menu.classList.toggle('hidden');
                              }}><FaEllipsisH /></button>
                              <div className="hidden absolute right-0 top-full mt-1 z-20 w-52 bg-dark-800 border border-white/15 rounded-xl shadow-xl overflow-hidden">
                                <button type="button" onClick={printMessage} className="w-full text-left px-3 py-2.5 text-sm text-white/80 hover:bg-white/10 flex items-center gap-2"><FaPrint /> Imprimir</button>
                                <button type="button" onClick={downloadEml} className="w-full text-left px-3 py-2.5 text-sm text-white/80 hover:bg-white/10 flex items-center gap-2"><FaDownload /> Baixar .eml</button>
                                {selected.has_attachments && (
                                  <button type="button" onClick={downloadZip} className="w-full text-left px-3 py-2.5 text-sm text-white/80 hover:bg-white/10 flex items-center gap-2"><FaPaperclip /> ZIP anexos</button>
                                )}
                                <button type="button" onClick={blockSender} className="w-full text-left px-3 py-2.5 text-sm text-red-300 hover:bg-red-500/10 flex items-center gap-2"><FaBan /> Bloquear remetente</button>
                                <button type="button" onClick={() => setShowAddList(true)} className="w-full text-left px-3 py-2.5 text-sm text-white/80 hover:bg-white/10 flex items-center gap-2"><FaUserPlus /> Adicionar à lista</button>
                                <button type="button" onClick={() => { if (showThread) { setShowThread(false); } else loadThread(); }} className="w-full text-left px-3 py-2.5 text-sm text-white/80 hover:bg-white/10 flex items-center gap-2"><FaComments /> {showThread ? 'Ocultar thread' : 'Ver conversa'}</button>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-1 text-[13px]">
                          <p className="text-white/55 truncate">
                            <span className="text-white/35">De </span>
                            {selected.from_name ? `${selected.from_name} <${selected.from_email}>` : selected.from_email}
                          </p>
                          <p className="text-white/55 truncate">
                            <span className="text-white/35">Para </span>
                            {selected.to_email}
                          </p>
                          {selected.cc && (
                            <p className="text-white/55 truncate">
                              <span className="text-white/35">Cc </span>
                              {selected.cc}
                            </p>
                          )}
                        </div>
                      </div>

                      <InternalTrackingPanel msg={selected} />

                      {Array.isArray(selected.phishing_hints) && selected.phishing_hints.length > 0 && (
                        <div className="mx-4 mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/40 text-amber-200 text-sm flex gap-2">
                          <FaExclamationTriangle className="flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-bold">Possível phishing</p>
                            <ul className="list-disc ml-4 mt-1 text-xs space-y-0.5">
                              {selected.phishing_hints.map((h, i) => <li key={i}>{h}</li>)}
                            </ul>
                          </div>
                        </div>
                      )}

                      <div className="flex-1 overflow-y-auto px-6 py-6">
                        {showThread && thread.length > 0 ? (
                          <div className="space-y-4">
                            {thread.map((t) => (
                              <div key={t.id} className="space-y-2">
                                <div className="flex justify-between text-xs text-white/40 px-1">
                                  <span>{t.from_name || t.from_email}</span>
                                  <span>{formatFullDate(t.received_at || t.sent_at || t.created_at)}</span>
                                </div>
                                {t.direction === 'outbound' && <InternalTrackingPanel msg={t} />}
                                <OrganizedEmailBody html={t.body_html} text={t.body_text} direction={t.direction} />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <OrganizedEmailBody
                            html={selected.body_html}
                            text={selected.body_text}
                            direction={selected.direction}
                          />
                        )}

                        {Array.isArray(selected.attachments) && selected.attachments.length > 0 && (
                          <div className="mt-6 pt-4 border-t border-white/10">
                            <p className="text-xs font-bold text-white/45 uppercase mb-2">Anexos ({selected.attachments.length})</p>
                            <div className="flex flex-wrap gap-3">
                              {selected.attachments.map((att, idx) => {
                                const href = absoluteUploadUrl(att.url);
                                const isImg = String(att.contentType || '').startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp)$/i.test(att.filename || '');
                                return (
                                  <a
                                    key={idx}
                                    href={href}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="block rounded-xl border border-white/10 bg-black/30 overflow-hidden hover:border-cyan-500/40 max-w-[200px]"
                                  >
                                    {isImg ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img src={href} alt={att.filename} className="w-full h-auto max-h-40 object-contain bg-black/40" />
                                    ) : (
                                      <div className="px-3 py-3 text-sm text-cyan-300 flex items-center gap-2"><FaPaperclip /> {att.filename}</div>
                                    )}
                                    <div className="px-2 py-1 text-[11px] text-white/45 truncate">{att.filename}</div>
                                  </a>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="py-24 text-center text-white/40 flex flex-col items-center gap-3 px-6">
                      <FaEnvelopeOpen className="text-4xl opacity-30" />
                      <p>Selecione uma mensagem ou pressione <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-xs">c</kbd> para escrever</p>
                    </div>
                  )}
                </section>
              </div>
              ) : null}
              </>
            )}
          </div>
        </div>

        {/* Preview modal */}
        {showPreview && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowPreview(false)}>
            <div className="bg-dark-800 border border-white/15 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-white font-bold text-lg">Prévia</h3>
                <button type="button" onClick={() => setShowPreview(false)} className={btnGhost}><FaTimes /></button>
              </div>
              <p className="text-sm text-white/50 mb-1"><b>Para:</b> {compose.to_email}</p>
              {compose.cc && <p className="text-sm text-white/50 mb-1"><b>Cc:</b> {compose.cc}</p>}
              <p className="text-sm text-white/50 mb-4"><b>Assunto:</b> {compose.subject}</p>
              <div className="rounded-xl border border-white/10 bg-[#0b1220] p-4 mb-3">
                <p className="text-[11px] font-medium text-white/40 mb-2">Sua mensagem</p>
                <div
                  className="prose prose-invert max-w-none text-sm"
                  dangerouslySetInnerHTML={{ __html: rewriteMailboxHtml(compose.body_html || '<p>(vazio)</p>') }}
                />
              </div>
              {!!compose.quoted_html && (
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 border-l-2 border-l-white/20">
                  <p className="text-[11px] font-medium text-white/40 mb-2">{compose.quoted_label || 'Mensagem original'}</p>
                  <div
                    className="prose prose-invert max-w-none text-sm text-white/45"
                    dangerouslySetInnerHTML={{ __html: rewriteMailboxHtml(compose.quoted_html) }}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Settings panel */}
        {showSettings && activeMailbox && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto" onClick={() => setShowSettings(false)}>
            <div className="bg-dark-800 border border-white/15 rounded-2xl max-w-3xl w-full my-4 p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center gap-3">
                <h3 className="text-white font-bold text-lg flex items-center gap-2 min-w-0">
                  <FaCog className="flex-shrink-0" />
                  <span className="truncate">Configurações — {activeMailbox.email}</span>
                </h3>
                <button type="button" onClick={() => setShowSettings(false)} className={btnGhost}><FaTimes /></button>
              </div>
              <div>
                <label className="text-xs text-white/50 font-bold uppercase">Nome de exibição</label>
                <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={inputCls + ' mt-1'} />
              </div>
              <label className="flex items-center gap-2 text-sm text-white/70 cursor-pointer">
                <input type="checkbox" checked={sigEnabled} onChange={(e) => setSigEnabled(e.target.checked)} className="accent-cyan-500" />
                Usar assinatura
              </label>
              <div className={sigEnabled ? '' : 'opacity-50 pointer-events-none'}>
                <label className="text-xs text-white/50 font-bold uppercase mb-2 block">Assinatura</label>
                <p className="text-xs text-white/40 mb-2">
                  Mesmo editor do Envio Único: visual, HTML e prévia. Use negrito, link, WhatsApp, cores etc.
                </p>
                <EmailBodyEditor
                  value={sigHtml}
                  onChange={setSigHtml}
                  accent="purple"
                  minHeight={260}
                  placeholder="Crie sua assinatura aqui (nome, cargo, telefone, links...)"
                />
              </div>
              <button type="button" disabled={savingSettings} onClick={saveSettings} className={btnAccent + ' w-full justify-center'}>
                {savingSettings ? <FaSpinner className="animate-spin" /> : <FaCheck />} Salvar
              </button>
            </div>
          </div>
        )}

        {/* Add to list modal */}
        {showAddList && selected && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowAddList(false)}>
            <div className="bg-dark-800 border border-white/15 rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-white font-bold">Adicionar à lista</h3>
                <button type="button" onClick={() => setShowAddList(false)} className={btnGhost}><FaTimes /></button>
              </div>
              <p className="text-sm text-white/50 mb-3">{selected.from_email}</p>
              {lists.length === 0 ? (
                <p className="text-white/40 text-sm">Nenhuma lista encontrada.</p>
              ) : (
                <div className="space-y-1 max-h-60 overflow-y-auto">
                  {lists.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => addToList(l.id)}
                      className="w-full text-left px-3 py-2.5 rounded-xl text-sm text-white/80 hover:bg-cyan-500/15 hover:text-cyan-300 border border-transparent hover:border-cyan-500/30"
                    >
                      {l.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </ProtectedRoute>
    </>
  );
}
