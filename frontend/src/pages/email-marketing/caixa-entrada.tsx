import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import {
  FaInbox, FaArrowLeft, FaPaperPlane, FaSpinner, FaEnvelopeOpen,
  FaTrash, FaReply, FaPlus, FaFolder,
} from 'react-icons/fa';
import api from '@/services/api';
import { useNotification } from '@/hooks/useNotification';
import ProtectedRoute from '@/components/ProtectedRoute';

interface Mailbox {
  id: number;
  email: string;
  display_name: string | null;
  unread_count: number;
}

interface MessageRow {
  id: number;
  from_email: string;
  from_name: string | null;
  to_email: string;
  subject: string;
  preview: string;
  is_read: boolean;
  status: string;
  received_at: string | null;
  sent_at: string | null;
  created_at: string;
  direction: string;
}

interface MessageFull extends MessageRow {
  body_html: string | null;
  body_text: string | null;
  attachments?: Array<{
    filename: string;
    contentType?: string;
    size?: number;
    url: string;
  }> | null;
}

type Folder = 'inbox' | 'sent' | 'trash';

function uploadsBaseUrl() {
  const raw = process.env.NEXT_PUBLIC_API_URL || '';
  // NEXT_PUBLIC_API_URL normalmente termina com /api
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

/** Troca caminhos /uploads relativos pelo host da API (imagens cid resolvidas) */
function rewriteMailboxHtml(html: string) {
  const base = uploadsBaseUrl();
  if (!html || !base) return html;
  return html.replace(/(src=["'])(\/uploads\/[^"']+)(["'])/gi, (_m, a, path, b) => `${a}${base}${path}${b}`);
}

export default function CaixaEntrada() {
  const router = useRouter();
  const notification = useNotification();
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [mailboxId, setMailboxId] = useState<number | null>(null);
  const [folder, setFolder] = useState<Folder>('inbox');
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [selected, setSelected] = useState<MessageFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMsg, setLoadingMsg] = useState(false);
  const [composing, setComposing] = useState(false);
  const [sending, setSending] = useState(false);
  const [compose, setCompose] = useState({
    to_email: '', to_name: '', subject: '', body_html: '', reply_to_message_id: null as number | null,
  });

  const loadMailboxes = async () => {
    const r = await api.get('/email-marketing/mailboxes');
    const list = r.data.data || [];
    setMailboxes(list);
    const q = router.query.mailbox ? Number(router.query.mailbox) : null;
    if (q && list.some((m: Mailbox) => m.id === q)) setMailboxId(q);
    else if (list.length && !mailboxId) setMailboxId(list[0].id);
  };

  const loadMessages = useCallback(async () => {
    if (!mailboxId) { setMessages([]); setLoading(false); return; }
    setLoading(true);
    try {
      const r = await api.get(`/email-marketing/mailboxes/${mailboxId}/messages`, {
        params: { folder, limit: 80 },
      });
      setMessages(r.data.data || []);
    } catch (e: any) {
      notification.error('Erro', e.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  }, [mailboxId, folder]);

  useEffect(() => {
    if (!router.isReady) return;
    loadMailboxes().catch(() => {}).finally(() => setLoading(false));
  }, [router.isReady]);

  useEffect(() => {
    loadMessages();
    setSelected(null);
  }, [loadMessages]);

  const openMessage = async (id: number) => {
    if (!mailboxId) return;
    setLoadingMsg(true);
    setComposing(false);
    try {
      const r = await api.get(`/email-marketing/mailboxes/${mailboxId}/messages/${id}`);
      setSelected(r.data.data);
      loadMessages();
      loadMailboxes();
    } catch (e: any) {
      notification.error('Erro', e.response?.data?.message || e.message);
    } finally {
      setLoadingMsg(false);
    }
  };

  const startCompose = (reply?: MessageFull) => {
    if (reply) {
      setCompose({
        to_email: reply.from_email || '',
        to_name: reply.from_name || '',
        subject: reply.subject?.toLowerCase().startsWith('re:') ? reply.subject : `Re: ${reply.subject || ''}`,
        body_html: '',
        reply_to_message_id: reply.id,
      });
    } else {
      setCompose({ to_email: '', to_name: '', subject: '', body_html: '', reply_to_message_id: null });
    }
    setComposing(true);
    setSelected(null);
  };

  const handleSend = async () => {
    if (!mailboxId) return;
    if (!compose.to_email.includes('@') || !compose.subject.trim()) {
      notification.warning('Atenção', 'Informe destinatário e assunto');
      return;
    }
    setSending(true);
    try {
      await api.post(`/email-marketing/mailboxes/${mailboxId}/send`, {
        to_email: compose.to_email.trim(),
        to_name: compose.to_name.trim() || undefined,
        subject: compose.subject.trim(),
        body_html: compose.body_html || `<div>${(compose.body_html || '').replace(/\n/g, '<br/>')}</div>`,
        body_text: compose.body_html,
        reply_to_message_id: compose.reply_to_message_id,
      });
      notification.success('Enviado', `Para ${compose.to_email}`);
      setComposing(false);
      setFolder('sent');
    } catch (e: any) {
      notification.error('Erro', e.response?.data?.message || e.message);
    } finally {
      setSending(false);
    }
  };

  const moveToTrash = async (messageId: number) => {
    if (!mailboxId) return;
    try {
      await api.patch(`/email-marketing/mailboxes/${mailboxId}/messages/${messageId}`, { folder: 'trash' });
      setSelected(null);
      loadMessages();
    } catch (e: any) {
      notification.error('Erro', e.response?.data?.message || e.message);
    }
  };

  const currentMb = mailboxes.find((m) => m.id === mailboxId);

  return (
    <>
      <Head><title>Caixa de Entrada | E-mail Marketing</title></Head>
      <ProtectedRoute requiredPermission="email_marketing" fallbackPath="/">
        <notification.NotificationContainer />
        <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 py-6 px-4">
          <div className="max-w-7xl mx-auto space-y-4">
            <div className="flex items-center gap-4 flex-wrap">
              <button type="button" onClick={() => router.push('/email-marketing')} className="p-3 bg-white/10 hover:bg-white/20 rounded-xl text-white">
                <FaArrowLeft />
              </button>
              <div className="bg-gradient-to-br from-indigo-500 to-violet-600 p-4 rounded-2xl">
                <FaInbox className="text-3xl text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl md:text-3xl font-black text-white">Caixa de Entrada</h1>
                <p className="text-white/60 text-sm">Receba e responda pelos e-mails criados no seu domínio</p>
              </div>
              <select
                value={mailboxId || ''}
                onChange={(e) => setMailboxId(Number(e.target.value) || null)}
                className="px-4 py-3 bg-dark-700 border border-white/20 rounded-xl text-white min-w-[220px]"
              >
                {mailboxes.length === 0 && <option value="">Nenhuma caixa</option>}
                {mailboxes.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.email}{m.unread_count ? ` (${m.unread_count})` : ''}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!mailboxId}
                onClick={() => startCompose()}
                className="px-5 py-3 bg-indigo-500 hover:bg-indigo-600 text-white font-bold rounded-xl flex items-center gap-2 disabled:opacity-50"
              >
                <FaPlus /> Novo
              </button>
            </div>

            {mailboxes.length === 0 ? (
              <div className="bg-dark-800/60 border border-white/10 rounded-2xl p-12 text-center">
                <p className="text-white/60 mb-4">Crie um e-mail primeiro para usar a caixa.</p>
                <button
                  type="button"
                  onClick={() => router.push('/email-marketing/criar-email')}
                  className="px-6 py-3 bg-cyan-500 text-white font-bold rounded-xl"
                >
                  Criar e-mail
                </button>
              </div>
            ) : (
              <div className="grid lg:grid-cols-[200px_1fr_1.2fr] gap-4 min-h-[70vh]">
                <div className="bg-dark-800/60 border border-white/10 rounded-2xl p-3 space-y-1">
                  {([
                    ['inbox', 'Entrada', FaInbox],
                    ['sent', 'Enviados', FaPaperPlane],
                    ['trash', 'Lixeira', FaTrash],
                  ] as const).map(([key, label, Icon]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setFolder(key)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left font-medium ${
                        folder === key ? 'bg-indigo-500/20 text-indigo-300' : 'text-white/70 hover:bg-white/5'
                      }`}
                    >
                      <Icon /> {label}
                    </button>
                  ))}
                  {currentMb && (
                    <p className="text-xs text-white/40 px-4 pt-4 flex items-center gap-2">
                      <FaFolder /> {currentMb.email}
                    </p>
                  )}
                </div>

                <div className="bg-dark-800/60 border border-white/10 rounded-2xl overflow-hidden flex flex-col">
                  <div className="px-4 py-3 border-b border-white/10 text-white font-bold capitalize">{folder === 'inbox' ? 'Entrada' : folder === 'sent' ? 'Enviados' : 'Lixeira'}</div>
                  <div className="flex-1 overflow-y-auto max-h-[65vh]">
                    {loading ? (
                      <div className="p-10 text-center text-white/40"><FaSpinner className="animate-spin text-2xl mx-auto" /></div>
                    ) : messages.length === 0 ? (
                      <div className="p-10 text-center text-white/40">Nenhuma mensagem</div>
                    ) : (
                      messages.map((msg) => (
                        <button
                          key={msg.id}
                          type="button"
                          onClick={() => openMessage(msg.id)}
                          className={`w-full text-left px-4 py-3 border-b border-white/5 hover:bg-white/5 ${
                            selected?.id === msg.id ? 'bg-indigo-500/10' : ''
                          } ${!msg.is_read && folder === 'inbox' ? 'bg-white/[0.03]' : ''}`}
                        >
                          <div className="flex items-center gap-2">
                            {!msg.is_read && folder === 'inbox' && <span className="w-2 h-2 rounded-full bg-indigo-400" />}
                            <p className={`truncate text-sm ${!msg.is_read ? 'text-white font-bold' : 'text-white/80'}`}>
                              {folder === 'sent' ? msg.to_email : (msg.from_name || msg.from_email)}
                            </p>
                          </div>
                          <p className="text-sm text-white/90 truncate mt-0.5">{msg.subject || '(sem assunto)'}</p>
                          <p className="text-xs text-white/40 truncate">{msg.preview}</p>
                        </button>
                      ))
                    )}
                  </div>
                </div>

                <div className="bg-dark-800/60 border border-white/10 rounded-2xl p-5 overflow-y-auto max-h-[70vh]">
                  {composing ? (
                    <div className="space-y-4">
                      <h3 className="text-white font-bold text-lg flex items-center gap-2">
                        <FaPaperPlane /> {compose.reply_to_message_id ? 'Responder' : 'Novo e-mail'}
                      </h3>
                      <input
                        value={compose.to_email}
                        onChange={(e) => setCompose((c) => ({ ...c, to_email: e.target.value }))}
                        placeholder="Para"
                        className="w-full px-4 py-3 bg-dark-700 border border-white/20 rounded-xl text-white"
                      />
                      <input
                        value={compose.subject}
                        onChange={(e) => setCompose((c) => ({ ...c, subject: e.target.value }))}
                        placeholder="Assunto"
                        className="w-full px-4 py-3 bg-dark-700 border border-white/20 rounded-xl text-white"
                      />
                      <textarea
                        value={compose.body_html}
                        onChange={(e) => setCompose((c) => ({ ...c, body_html: e.target.value }))}
                        placeholder="Mensagem"
                        rows={12}
                        className="w-full px-4 py-3 bg-dark-700 border border-white/20 rounded-xl text-white resize-y"
                      />
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={handleSend}
                          disabled={sending}
                          className="flex-1 py-3 bg-indigo-500 hover:bg-indigo-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {sending ? <FaSpinner className="animate-spin" /> : <FaPaperPlane />}
                          Enviar
                        </button>
                        <button
                          type="button"
                          onClick={() => setComposing(false)}
                          className="px-5 py-3 bg-white/10 text-white rounded-xl"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : loadingMsg ? (
                    <div className="py-20 text-center text-white/40"><FaSpinner className="animate-spin text-3xl mx-auto" /></div>
                  ) : selected ? (
                    <div className="space-y-4">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <h3 className="text-xl font-bold text-white">{selected.subject || '(sem assunto)'}</h3>
                        <div className="flex gap-2">
                          {folder === 'inbox' && (
                            <button type="button" onClick={() => startCompose(selected)} className="px-3 py-2 bg-indigo-500/20 text-indigo-300 rounded-lg text-sm font-bold flex items-center gap-2">
                              <FaReply /> Responder
                            </button>
                          )}
                          {folder !== 'trash' && (
                            <button type="button" onClick={() => moveToTrash(selected.id)} className="px-3 py-2 bg-red-500/20 text-red-300 rounded-lg text-sm">
                              <FaTrash />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="text-sm text-white/60 space-y-1">
                        <p><span className="text-white/40">De:</span> {selected.from_name ? `${selected.from_name} <${selected.from_email}>` : selected.from_email}</p>
                        <p><span className="text-white/40">Para:</span> {selected.to_email}</p>
                        <p className="text-xs text-white/40">
                          {selected.received_at || selected.sent_at
                            ? new Date(selected.received_at || selected.sent_at || '').toLocaleString('pt-BR')
                            : ''}
                        </p>
                      </div>
                      <div className="border-t border-white/10 pt-4">
                        {selected.body_html ? (
                          <div
                            className="prose prose-invert max-w-none text-white/90 text-sm [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg"
                            dangerouslySetInnerHTML={{
                              __html: rewriteMailboxHtml(selected.body_html),
                            }}
                          />
                        ) : (
                          <pre className="whitespace-pre-wrap text-white/80 text-sm font-sans">{selected.body_text || '(sem conteúdo)'}</pre>
                        )}
                        {Array.isArray(selected.attachments) && selected.attachments.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-white/10">
                            <p className="text-xs font-bold text-white/50 uppercase mb-2">Anexos</p>
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
                                    className="block rounded-lg border border-white/10 bg-black/30 overflow-hidden hover:border-cyan-500/40 max-w-[220px]"
                                  >
                                    {isImg ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img src={href} alt={att.filename} className="w-full h-auto max-h-48 object-contain bg-black/40" />
                                    ) : (
                                      <div className="px-3 py-2 text-sm text-cyan-300">{att.filename}</div>
                                    )}
                                    <div className="px-2 py-1 text-[11px] text-white/50 truncate">{att.filename}</div>
                                  </a>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="py-20 text-center text-white/40 flex flex-col items-center gap-3">
                      <FaEnvelopeOpen className="text-4xl opacity-40" />
                      Selecione uma mensagem ou escreva um novo e-mail
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </ProtectedRoute>
    </>
  );
}
