import {
  useState, useEffect, useCallback, useRef, useMemo, KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import {
  FaInbox, FaArrowLeft, FaPaperPlane, FaSpinner, FaEnvelopeOpen, FaTrash, FaReply,
  FaPlus, FaFolder, FaStar, FaRegStar, FaArchive, FaBan, FaSearch, FaPaperclip,
  FaEllipsisH, FaPrint, FaDownload, FaUserPlus, FaExclamationTriangle, FaCog,
  FaCheck, FaTimes, FaBold, FaItalic, FaUnderline, FaLink, FaListUl, FaClock,
  FaReplyAll, FaShare, FaVolumeUp, FaVolumeMute, FaEye, FaEnvelope, FaFilter,
  FaChevronDown, FaComments, FaEdit,
} from 'react-icons/fa';
import api from '@/services/api';
import { useNotification } from '@/hooks/useNotification';
import ProtectedRoute from '@/components/ProtectedRoute';

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

interface QuickReply {
  id: number;
  title: string;
  body_html: string;
  mailbox_id: number | null;
}

interface Attachment {
  filename: string;
  contentType?: string;
  size?: number;
  url: string;
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
  reply_to_message_id: number | null;
  draft_id: number | null;
  scheduled_at: string;
  request_read_receipt: boolean;
  append_signature: boolean;
  files: File[];
}

const EMPTY_COMPOSE: ComposeState = {
  to_email: '', to_name: '', cc: '', bcc: '', subject: '', body_html: '',
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
  if (s === 'delivered' || s === 'sent') return 'bg-white/10 text-white/60 border-white/20';
  if (s === 'bounced' || s === 'failed' || s === 'complained') return 'bg-red-500/20 text-red-300 border-red-500/40';
  return 'bg-white/10 text-white/50 border-white/15';
}

/** Painel interno de webhook — só para o atendente */
function InternalTrackingPanel({ msg }: { msg: MessageRow | MessageFull }) {
  if (msg.direction !== 'outbound') return null;
  const status = msg.tracking_status || (msg.status === 'sent' || msg.sent_at ? 'sent' : msg.status);
  if (!status && !msg.sent_at) return null;
  const steps = [
    { key: 'sent', label: 'Enviado', at: msg.sent_at },
    { key: 'delivered', label: 'Entregue', at: msg.delivered_at },
    { key: 'opened', label: 'Abriu / Leu', at: msg.opened_at },
    { key: 'clicked', label: 'Clicou', at: msg.clicked_at },
    { key: 'replied', label: 'Respondeu', at: msg.replied_at },
  ];
  const failed = !!(msg.bounced_at || ['bounced', 'failed', 'complained'].includes(String(status)));
  return (
    <div className="mx-4 mt-3 p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-sm">
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <p className="text-[11px] font-bold uppercase text-indigo-300 tracking-wide">
          Controle interno (webhook) — não visível ao cliente
        </p>
        {trackingLabel(status) && (
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${trackingBadgeClass(status)}`}>
            {trackingLabel(status)}
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
        {steps.map((s) => (
          <div key={s.key} className={`flex justify-between gap-2 px-2 py-1.5 rounded-lg ${s.at ? 'bg-emerald-500/10 text-emerald-200' : 'bg-black/20 text-white/35'}`}>
            <span>{s.label}</span>
            <span className="font-mono text-right">{s.at ? formatFullDate(s.at) : '—'}</span>
          </div>
        ))}
        {failed && (
          <div className="sm:col-span-2 flex justify-between gap-2 px-2 py-1.5 rounded-lg bg-red-500/10 text-red-200">
            <span>Falha / Bounce</span>
            <span className="font-mono">{msg.bounced_at ? formatFullDate(msg.bounced_at) : trackingLabel(status)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function stripHtml(html: string) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function isTypingTarget(el: EventTarget | null) {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

function playPing() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = 880;
    g.gain.value = 0.08;
    o.start();
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    o.stop(ctx.currentTime + 0.35);
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
  const [creatingQr, setCreatingQr] = useState(false);

  const [showAddList, setShowAddList] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [focusIdx, setFocusIdx] = useState(-1);

  const editorRef = useRef<HTMLDivElement>(null);
  const unreadRef = useRef(0);
  const pollSkipRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const effectiveMailboxId = allMode ? null : mailboxId;
  const activeMailbox = mailboxes.find((m) => m.id === mailboxId) || null;
  const composeMailboxId = mailboxId || mailboxes[0]?.id || null;

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
      } else if (!allMode && mailboxId == null && list.length) {
        setMailboxId(list[0].id);
      }
    } catch (e: any) {
      notification.error('Erro', e.response?.data?.message || e.message);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.query.mailbox]);

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
      const list: MessageRow[] = r.data.data || [];
      setMessages(list);

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

  /* Polling 15s */
  useEffect(() => {
    const id = setInterval(() => {
      if (pollSkipRef.current || composing) return;
      loadMessages({ silent: true });
      loadStats();
      loadMailboxes();
    }, 15000);
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
  const startCompose = (mode?: 'new' | 'reply' | 'reply-all' | 'forward', msg?: MessageFull) => {
    const base = { ...EMPTY_COMPOSE };
    if (msg && mode === 'reply') {
      base.to_email = msg.from_email || '';
      base.to_name = msg.from_name || '';
      base.subject = msg.subject?.toLowerCase().startsWith('re:') ? msg.subject : `Re: ${msg.subject || ''}`;
      base.reply_to_message_id = msg.id;
      base.body_html = `<br/><br/><blockquote style="border-left:3px solid #334155;padding-left:12px;color:#94a3b8">${msg.body_html || msg.body_text || ''}</blockquote>`;
    } else if (msg && mode === 'reply-all') {
      base.to_email = msg.from_email || '';
      base.to_name = msg.from_name || '';
      const ccParts = [msg.to_email, ...(String(msg.cc || '').split(/[,;]/).map((s) => s.trim()).filter(Boolean))]
        .filter((e) => e && e.toLowerCase() !== activeMailbox?.email?.toLowerCase() && e.toLowerCase() !== (msg.from_email || '').toLowerCase());
      base.cc = Array.from(new Set(ccParts)).join(', ');
      base.subject = msg.subject?.toLowerCase().startsWith('re:') ? msg.subject : `Re: ${msg.subject || ''}`;
      base.reply_to_message_id = msg.id;
      base.body_html = `<br/><br/><blockquote style="border-left:3px solid #334155;padding-left:12px;color:#94a3b8">${msg.body_html || msg.body_text || ''}</blockquote>`;
      setShowCc(true);
    } else if (msg && mode === 'forward') {
      base.subject = msg.subject?.toLowerCase().startsWith('fwd:') || msg.subject?.toLowerCase().startsWith('enc:')
        ? msg.subject
        : `Enc: ${msg.subject || ''}`;
      base.body_html = `<br/><br/><p style="color:#94a3b8">---------- Mensagem encaminhada ----------</p>${msg.body_html || `<pre>${msg.body_text || ''}</pre>`}`;
    } else if (msg && msg.folder === 'drafts') {
      base.to_email = msg.to_email || '';
      base.to_name = msg.to_name || '';
      base.cc = msg.cc || '';
      base.bcc = msg.bcc || '';
      base.subject = msg.subject || '';
      base.body_html = msg.body_html || msg.body_text || '';
      base.draft_id = msg.id;
      if (msg.cc || msg.bcc) setShowCc(true);
    }
    setCompose(base);
    setComposing(true);
    setSelected(null);
    setConfirmSend(false);
    setShowPreview(false);
    setTimeout(() => {
      if (editorRef.current) editorRef.current.innerHTML = base.body_html || '';
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

  const buildFormData = (asDraft: boolean) => {
    const fd = new FormData();
    fd.append('to_email', compose.to_email.trim());
    if (compose.to_name.trim()) fd.append('to_name', compose.to_name.trim());
    fd.append('subject', compose.subject.trim());
    const html = editorRef.current?.innerHTML || compose.body_html;
    fd.append('body_html', html);
    fd.append('body_text', stripHtml(html));
    if (compose.cc.trim()) fd.append('cc', compose.cc.trim());
    if (compose.bcc.trim()) fd.append('bcc', compose.bcc.trim());
    if (asDraft) fd.append('save_as_draft', 'true');
    if (compose.draft_id) fd.append('draft_id', String(compose.draft_id));
    if (compose.scheduled_at) fd.append('scheduled_at', new Date(compose.scheduled_at).toISOString());
    if (compose.request_read_receipt) fd.append('request_read_receipt', 'true');
    fd.append('append_signature', compose.append_signature ? 'true' : 'false');
    if (compose.reply_to_message_id) fd.append('reply_to_message_id', String(compose.reply_to_message_id));
    compose.files.forEach((f) => fd.append('attachments', f));
    return fd;
  };

  const handleSend = async (asDraft = false) => {
    if (!composeMailboxId) {
      notification.warning('Atenção', 'Selecione uma caixa de e-mail');
      return;
    }
    if (!asDraft && (!compose.to_email.includes('@') || !compose.subject.trim())) {
      notification.warning('Atenção', 'Informe destinatário e assunto');
      return;
    }
    if (!asDraft && !confirmSend) {
      setConfirmSend(true);
      return;
    }
    setSending(true);
    pollSkipRef.current = true;
    try {
      syncEditor();
      await api.post(
        `/email-marketing/mailboxes/${composeMailboxId}/send`,
        buildFormData(asDraft),
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      notification.success(
        asDraft ? 'Rascunho salvo' : compose.scheduled_at ? 'Agendado' : 'Enviado',
        asDraft ? 'Mensagem salva em Rascunhos' : `Para ${compose.to_email}`
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
      setConfirmSend(false);
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
      await api.post('/email-marketing/mailbox-quick-replies', {
        title: qrTitle.trim(),
        body_html: qrBody,
        mailbox_id: allMode ? undefined : mailboxId || undefined,
      });
      setQrTitle(''); setQrBody(''); setShowNewQr(false);
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
    if (editorRef.current) {
      editorRef.current.innerHTML = (editorRef.current.innerHTML || '') + qr.body_html;
      syncEditor();
    } else {
      setCompose((c) => ({ ...c, body_html: c.body_html + qr.body_html }));
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

  const selectMailbox = (val: string) => {
    if (val === 'all') {
      setAllMode(true);
      setMailboxId(null);
    } else {
      setAllMode(false);
      setMailboxId(Number(val));
    }
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
    'w-full px-3 py-2.5 bg-dark-700/80 border border-white/15 rounded-xl text-white text-sm placeholder-white/40 focus:outline-none focus:border-cyan-500/50';
  const btnGhost =
    'p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-all';
  const btnAccent =
    'px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-white font-bold rounded-xl text-sm flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-cyan-500/20';

  return (
    <>
      <Head><title>Caixa de Entrada | E-mail Marketing</title></Head>
      <ProtectedRoute requiredPermission="email_marketing" fallbackPath="/">
        <notification.NotificationContainer />
        <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 py-4 px-3 md:px-4">
          <div className="max-w-[1600px] mx-auto space-y-4">
            {/* Header */}
            <div className="flex items-center gap-3 flex-wrap">
              <button type="button" onClick={() => router.push('/email-marketing')} className="p-3 bg-white/10 hover:bg-white/20 rounded-xl text-white">
                <FaArrowLeft />
              </button>
              <div className="bg-gradient-to-br from-cyan-500 to-indigo-600 p-3.5 rounded-2xl shadow-lg shadow-cyan-500/30">
                <FaInbox className="text-2xl text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl md:text-2xl font-black text-white">Caixa de Entrada</h1>
                <p className="text-white/50 text-xs md:text-sm">Leia, responda e organize seus e-mails</p>
              </div>

              <select
                value={allMode ? 'all' : String(mailboxId || '')}
                onChange={(e) => selectMailbox(e.target.value)}
                className="px-3 py-2.5 bg-dark-700/80 border border-white/15 rounded-xl text-white text-sm min-w-[200px]"
              >
                <option value="all">Todas as caixas</option>
                {mailboxes.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.display_name ? `${m.display_name} — ` : ''}{m.email}
                    {m.unread_count ? ` (${m.unread_count})` : ''}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setSoundOn((s) => !s)}
                className={`p-3 rounded-xl border transition-all ${soundOn ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' : 'bg-white/5 border-white/10 text-white/50'}`}
                title={soundOn ? 'Som ligado' : 'Som desligado'}
              >
                {soundOn ? <FaVolumeUp /> : <FaVolumeMute />}
              </button>

              {!allMode && mailboxId && (
                <button type="button" onClick={() => setShowSettings(true)} className="p-3 bg-white/10 hover:bg-white/20 rounded-xl text-white" title="Configurações">
                  <FaCog />
                </button>
              )}

              <button
                type="button"
                disabled={!composeMailboxId}
                onClick={() => startCompose('new')}
                className={btnAccent}
              >
                <FaPlus /> Novo
              </button>
            </div>

            {mailboxes.length === 0 ? (
              <div className="bg-dark-800/60 border border-white/10 rounded-2xl p-12 text-center backdrop-blur-xl">
                <FaEnvelope className="text-5xl text-white/20 mx-auto mb-4" />
                <p className="text-white/60 mb-4">Crie um e-mail primeiro para usar a caixa de entrada.</p>
                <button
                  type="button"
                  onClick={() => router.push('/email-marketing/criar-email')}
                  className={btnAccent + ' mx-auto'}
                >
                  Criar e-mail
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(280px,1fr)_minmax(320px,1.3fr)] gap-3 min-h-[72vh]">
                {/* ── Sidebar ── */}
                <aside className="bg-dark-800/60 border border-white/10 rounded-2xl p-3 flex flex-col gap-1 backdrop-blur-xl">
                  {sidebarItems.map(({ key, label, icon: Icon, count }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setFolder(key)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm font-medium transition-all ${
                        folder === key
                          ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                          : 'text-white/70 hover:bg-white/5 border border-transparent'
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
                      <button type="button" onClick={() => setShowNewFolder((v) => !v)} className="text-cyan-400 hover:text-cyan-300 text-xs p-1">
                        <FaPlus />
                      </button>
                    </div>
                    {showNewFolder && (
                      <div className="p-2 space-y-2 mb-2 bg-black/20 rounded-xl">
                        <input value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="Nome da pasta" className={inputCls} />
                        <div className="flex gap-2">
                          <input type="color" value={newFolderColor} onChange={(e) => setNewFolderColor(e.target.value)} className="h-9 w-10 rounded-lg bg-transparent border border-white/15 cursor-pointer" />
                          <button type="button" disabled={creatingFolder} onClick={createFolder} className="flex-1 py-2 bg-cyan-500/20 text-cyan-300 rounded-xl text-xs font-bold">
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
                              ? 'bg-cyan-500/15 text-cyan-300'
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
                      <button type="button" onClick={() => setShowNewQr((v) => !v)} className="text-cyan-400 hover:text-cyan-300 text-xs p-1">
                        <FaPlus />
                      </button>
                    </div>
                    {showNewQr && (
                      <div className="p-2 space-y-2 mb-2 bg-black/20 rounded-xl">
                        <input value={qrTitle} onChange={(e) => setQrTitle(e.target.value)} placeholder="Título" className={inputCls} />
                        <textarea value={qrBody} onChange={(e) => setQrBody(e.target.value)} placeholder="HTML / texto" rows={3} className={inputCls + ' resize-y'} />
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
                <section className="bg-dark-800/60 border border-white/10 rounded-2xl overflow-hidden flex flex-col backdrop-blur-xl min-h-[50vh]">
                  <div className="px-3 py-2.5 border-b border-white/10 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-white font-bold text-sm">{folderLabel}</h2>
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
                        className="w-full pl-9 pr-3 py-2 bg-dark-700/60 border border-white/10 rounded-xl text-white text-sm placeholder-white/30 focus:outline-none focus:border-cyan-500/40"
                      />
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setFilterUnread((v) => !v)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                          filterUnread ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300' : 'border-white/10 text-white/50 hover:text-white'
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
                        return (
                          <div
                            key={`${msg.mailbox_id}-${msg.id}`}
                            className={`flex items-stretch border-b border-white/5 hover:bg-white/[0.04] ${
                              active ? 'bg-cyan-500/10' : ''
                            } ${!msg.is_read ? 'bg-white/[0.02]' : ''}`}
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
                              className="flex-1 text-left px-2 py-2.5 min-w-0"
                            >
                              <div className="flex items-center gap-2">
                                {!msg.is_read && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 flex-shrink-0" />}
                                <p className={`truncate text-sm ${!msg.is_read ? 'text-white font-bold' : 'text-white/75'}`}>
                                  {folder === 'sent' || msg.direction === 'outbound'
                                    ? (msg.to_name || msg.to_email)
                                    : (msg.from_name || msg.from_email)}
                                </p>
                                {msg.has_attachments && <FaPaperclip className="text-[10px] text-white/40 flex-shrink-0" />}
                                {allMode && msg.mailbox_email && (
                                  <span className="text-[10px] text-white/30 truncate max-w-[90px]">{msg.mailbox_email}</span>
                                )}
                                <span className="ml-auto text-[11px] text-white/35 flex-shrink-0">
                                  {formatDate(msg.received_at || msg.sent_at || msg.created_at)}
                                </span>
                              </div>
                              <p className={`text-sm truncate mt-0.5 ${!msg.is_read ? 'text-white font-semibold' : 'text-white/80'}`}>
                                {msg.subject || '(sem assunto)'}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <p className="text-xs text-white/35 truncate flex-1">{msg.preview}</p>
                                {msg.direction === 'outbound' && trackingLabel(msg.tracking_status || (msg.sent_at ? 'sent' : null)) && (
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded border flex-shrink-0 ${trackingBadgeClass(msg.tracking_status || 'sent')}`}>
                                    {trackingLabel(msg.tracking_status || 'sent')}
                                  </span>
                                )}
                              </div>
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </section>

                {/* ── Reading / Compose pane ── */}
                <section className="bg-dark-800/60 border border-white/10 rounded-2xl overflow-hidden flex flex-col backdrop-blur-xl min-h-[50vh]">
                  {composing ? (
                    <div data-compose className="flex flex-col h-full max-h-[75vh]" onKeyDown={onComposeKeyDown}>
                      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between gap-2">
                        <h3 className="text-white font-bold flex items-center gap-2">
                          <FaPaperPlane className="text-cyan-400" />
                          {compose.reply_to_message_id ? 'Responder' : compose.draft_id ? 'Editar rascunho' : 'Novo e-mail'}
                        </h3>
                        <button type="button" onClick={() => { setComposing(false); setConfirmSend(false); }} className={btnGhost}>
                          <FaTimes />
                        </button>
                      </div>
                      <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {allMode && (
                          <select
                            value={composeMailboxId || ''}
                            onChange={(e) => { setAllMode(false); setMailboxId(Number(e.target.value)); }}
                            className={inputCls}
                          >
                            {mailboxes.map((m) => (
                              <option key={m.id} value={m.id}>Enviar de: {m.email}</option>
                            ))}
                          </select>
                        )}
                        <div className="flex gap-2 items-center">
                          <input
                            value={compose.to_email}
                            onChange={(e) => setCompose((c) => ({ ...c, to_email: e.target.value }))}
                            placeholder="Para (e-mail)"
                            className={inputCls + ' flex-1'}
                          />
                          <input
                            value={compose.to_name}
                            onChange={(e) => setCompose((c) => ({ ...c, to_name: e.target.value }))}
                            placeholder="Nome"
                            className={inputCls + ' w-36'}
                          />
                          <button type="button" onClick={() => setShowCc((v) => !v)} className="text-xs text-cyan-400 font-bold whitespace-nowrap px-2">
                            Cc/Cco <FaChevronDown className="inline" />
                          </button>
                        </div>
                        {showCc && (
                          <>
                            <input value={compose.cc} onChange={(e) => setCompose((c) => ({ ...c, cc: e.target.value }))} placeholder="Cc" className={inputCls} />
                            <input value={compose.bcc} onChange={(e) => setCompose((c) => ({ ...c, bcc: e.target.value }))} placeholder="Cco" className={inputCls} />
                          </>
                        )}
                        <input
                          value={compose.subject}
                          onChange={(e) => setCompose((c) => ({ ...c, subject: e.target.value }))}
                          placeholder="Assunto"
                          className={inputCls}
                        />

                        {/* Rich toolbar */}
                        <div className="flex flex-wrap items-center gap-1 p-1.5 bg-black/30 border border-white/10 rounded-xl">
                          <button type="button" onClick={() => execCmd('bold')} className={btnGhost} title="Negrito"><FaBold /></button>
                          <button type="button" onClick={() => execCmd('italic')} className={btnGhost} title="Itálico"><FaItalic /></button>
                          <button type="button" onClick={() => execCmd('underline')} className={btnGhost} title="Sublinhado"><FaUnderline /></button>
                          <button type="button" onClick={() => { const u = prompt('URL do link'); if (u) execCmd('createLink', u); }} className={btnGhost} title="Link"><FaLink /></button>
                          <button type="button" onClick={() => execCmd('insertUnorderedList')} className={btnGhost} title="Lista"><FaListUl /></button>
                          <span className="w-px h-5 bg-white/10 mx-1" />
                          {quickReplies.length > 0 && (
                            <select
                              className="bg-dark-700 border border-white/10 rounded-lg text-xs text-white/80 px-2 py-1.5 max-w-[160px]"
                              defaultValue=""
                              onChange={(e) => {
                                const qr = quickReplies.find((x) => x.id === Number(e.target.value));
                                if (qr) insertQuickReply(qr);
                                e.target.value = '';
                              }}
                            >
                              <option value="">Resposta rápida…</option>
                              {quickReplies.map((qr) => (
                                <option key={qr.id} value={qr.id}>{qr.title}</option>
                              ))}
                            </select>
                          )}
                        </div>

                        <div
                          ref={editorRef}
                          contentEditable
                          suppressContentEditableWarning
                          onInput={syncEditor}
                          className="min-h-[180px] max-h-[280px] overflow-y-auto px-3 py-2.5 bg-dark-700/80 border border-white/15 rounded-xl text-white text-sm focus:outline-none focus:border-cyan-500/50 prose prose-invert max-w-none"
                        />

                        <div className="flex flex-wrap items-center gap-3 text-xs text-white/60">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={compose.append_signature} onChange={(e) => setCompose((c) => ({ ...c, append_signature: e.target.checked }))} className="accent-cyan-500" />
                            Assinatura
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={compose.request_read_receipt} onChange={(e) => setCompose((c) => ({ ...c, request_read_receipt: e.target.checked }))} className="accent-cyan-500" />
                            Confirmação de leitura
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <FaClock className="text-white/40" />
                            <input
                              type="datetime-local"
                              value={compose.scheduled_at}
                              onChange={(e) => setCompose((c) => ({ ...c, scheduled_at: e.target.value }))}
                              className="bg-dark-700 border border-white/15 rounded-lg px-2 py-1 text-white text-xs"
                            />
                          </label>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
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
                          <button type="button" onClick={() => fileInputRef.current?.click()} className="px-3 py-2 bg-white/10 hover:bg-white/15 rounded-xl text-sm text-white flex items-center gap-2">
                            <FaPaperclip /> Anexar
                          </button>
                          {compose.files.map((f, i) => (
                            <span key={i} className="px-2 py-1 bg-cyan-500/10 border border-cyan-500/30 rounded-lg text-xs text-cyan-300 flex items-center gap-1">
                              {f.name}
                              <button type="button" onClick={() => setCompose((c) => ({ ...c, files: c.files.filter((_, j) => j !== i) }))}>
                                <FaTimes className="text-[10px]" />
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="px-4 py-3 border-t border-white/10 flex flex-wrap gap-2">
                        <button type="button" disabled={sending} onClick={() => handleSend(false)} className={btnAccent}>
                          {sending ? <FaSpinner className="animate-spin" /> : <FaPaperPlane />}
                          {confirmSend ? 'Confirmar envio' : 'Enviar'}
                          <span className="opacity-50 text-[10px] font-normal hidden sm:inline">Ctrl+Enter</span>
                        </button>
                        {confirmSend && (
                          <button type="button" onClick={() => setConfirmSend(false)} className="px-4 py-2.5 bg-white/10 text-white rounded-xl text-sm font-bold">
                            Cancelar confirmação
                          </button>
                        )}
                        <button type="button" disabled={sending} onClick={() => handleSend(true)} className="px-4 py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-xl text-sm font-bold flex items-center gap-2">
                          Salvar rascunho
                        </button>
                        <button type="button" onClick={() => { syncEditor(); setShowPreview(true); }} className="px-4 py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-xl text-sm font-bold flex items-center gap-2">
                          <FaEye /> Prévia
                        </button>
                      </div>
                    </div>
                  ) : loadingMsg ? (
                    <div className="py-24 text-center text-white/40"><FaSpinner className="animate-spin text-3xl mx-auto" /></div>
                  ) : selected ? (
                    <div className="flex flex-col h-full max-h-[75vh]">
                      <div className="px-4 py-3 border-b border-white/10 space-y-2">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <h3 className="text-lg font-bold text-white leading-snug">{selected.subject || '(sem assunto)'}</h3>
                          <div className="flex flex-wrap gap-1">
                            <button type="button" title="Responder" onClick={() => startCompose('reply', selected)} className={btnGhost}><FaReply /></button>
                            <button type="button" title="Responder a todos" onClick={() => startCompose('reply-all', selected)} className={btnGhost}><FaReplyAll /></button>
                            <button type="button" title="Encaminhar" onClick={() => startCompose('forward', selected)} className={btnGhost}><FaShare /></button>
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
                        <div className="text-sm text-white/55 space-y-0.5">
                          <p><span className="text-white/35">De:</span> {selected.from_name ? `${selected.from_name} <${selected.from_email}>` : selected.from_email}</p>
                          <p><span className="text-white/35">Para:</span> {selected.to_email}</p>
                          {selected.cc && <p><span className="text-white/35">Cc:</span> {selected.cc}</p>}
                          <p className="text-xs text-white/35">{formatFullDate(selected.received_at || selected.sent_at || selected.created_at)}</p>
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

                      <div className="flex-1 overflow-y-auto px-4 py-4">
                        {showThread && thread.length > 0 ? (
                          <div className="space-y-4">
                            {thread.map((t) => (
                              <div key={t.id} className="border border-white/10 rounded-xl p-3 bg-black/20">
                                <div className="flex justify-between text-xs text-white/40 mb-2">
                                  <span>{t.from_name || t.from_email}</span>
                                  <span>{formatFullDate(t.received_at || t.sent_at || t.created_at)}</span>
                                </div>
                                {t.direction === 'outbound' && (
                                  <div className="mb-2">
                                    <InternalTrackingPanel msg={t} />
                                  </div>
                                )}
                                <p className="text-sm font-semibold text-white mb-2">{t.subject}</p>
                                {t.body_html ? (
                                  <div className="prose prose-invert max-w-none text-sm [&_img]:max-w-full" dangerouslySetInnerHTML={{ __html: rewriteMailboxHtml(t.body_html) }} />
                                ) : (
                                  <pre className="whitespace-pre-wrap text-sm text-white/80 font-sans">{t.body_text}</pre>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : selected.body_html ? (
                          <div
                            className="prose prose-invert max-w-none text-white/90 text-sm [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg"
                            dangerouslySetInnerHTML={{ __html: rewriteMailboxHtml(selected.body_html) }}
                          />
                        ) : (
                          <pre className="whitespace-pre-wrap text-white/80 text-sm font-sans">{selected.body_text || '(sem conteúdo)'}</pre>
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
              <div
                className="prose prose-invert max-w-none text-sm border-t border-white/10 pt-4"
                dangerouslySetInnerHTML={{ __html: rewriteMailboxHtml(compose.body_html) }}
              />
            </div>
          </div>
        )}

        {/* Settings panel */}
        {showSettings && activeMailbox && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowSettings(false)}>
            <div className="bg-dark-800 border border-white/15 rounded-2xl max-w-lg w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center">
                <h3 className="text-white font-bold text-lg flex items-center gap-2"><FaCog /> Configurações — {activeMailbox.email}</h3>
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
              <div>
                <label className="text-xs text-white/50 font-bold uppercase">Assinatura (HTML)</label>
                <textarea value={sigHtml} onChange={(e) => setSigHtml(e.target.value)} rows={6} className={inputCls + ' mt-1 resize-y font-mono text-xs'} />
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
