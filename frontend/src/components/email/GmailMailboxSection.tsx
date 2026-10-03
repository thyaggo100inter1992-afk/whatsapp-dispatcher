import { ReactNode, useEffect, useRef, useState } from 'react';
import { FaChevronDown, FaChevronUp, FaCopy, FaGoogle, FaGripVertical, FaPlus, FaSpinner, FaSync, FaTimes } from 'react-icons/fa';
import api from '@/services/api';
import { useNotification } from '@/hooks/useNotification';
import { useConfirm } from '@/hooks/useConfirm';

interface GmailAccount {
  id: number;
  email: string;
  display_name: string | null;
}

function accountLabel(account: GmailAccount) {
  if (account.display_name && !account.display_name.endsWith('@sessao.local')) return account.display_name;
  if (account.email && !account.email.endsWith('@sessao.local')) return account.email;
  return 'Login pendente';
}

function copyableEmail(account: GmailAccount, detected?: string | null, active?: boolean) {
  if (active && detected && !detected.endsWith('@sessao.local')) return detected;
  if (account.email && !account.email.endsWith('@sessao.local')) return account.email;
  if (account.display_name && account.display_name.includes('@') && !account.display_name.endsWith('@sessao.local')) return account.display_name;
  return '';
}

function accountEmail(account: GmailAccount, detected?: string | null) {
  if (detected && !detected.endsWith('@sessao.local')) return detected;
  if (account.email && !account.email.endsWith('@sessao.local')) return account.email;
  return 'Entre com o e-mail e a senha do Gmail';
}

type MailChannel = 'gmail' | 'smtp';

export default function GmailMailboxSection({
  channel,
  onChannelChange,
  smtpList,
  onCreateSmtp,
  children,
}: {
  channel: MailChannel;
  onChannelChange: (channel: MailChannel) => void;
  smtpList?: ReactNode;
  onCreateSmtp?: () => void;
  children?: ReactNode;
}) {
  const notification = useNotification();
  const { confirm, ConfirmDialog } = useConfirm();
  const [accounts, setAccounts] = useState<GmailAccount[]>([]);
  const [organizing, setOrganizing] = useState(false);
  const [dragId, setDragId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [starting, setStarting] = useState(false);
  const [reloadingId, setReloadingId] = useState<number | null>(null);
  const [frameReady, setFrameReady] = useState(false);
  const [viewport, setViewport] = useState({ width: 1280, height: 720 });
  const [pageUrl, setPageUrl] = useState('https://mail.google.com');
  const [detectedEmail, setDetectedEmail] = useState<string | null>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef({ width: 1280, height: 720 });
  const imgRef = useRef<HTMLImageElement>(null);
  const [panelHeight, setPanelHeight] = useState(0);
  const versionRef = useRef(0);
  const urlRef = useRef('');
  const emailRef = useRef('');
  const duplicateRef = useRef('');
  const moveTimer = useRef<number | null>(null);

  const active = channel === 'gmail' ? accounts.find((account) => account.id === activeId) || null : null;
  viewportRef.current = viewport;
  const frameMax = Math.min(1500, Math.round(viewport.width * 1.15));
  const imageHeight = Math.round((viewport.height * frameMax) / viewport.width);
  const viewerHeight = imageHeight + 88;

  const loadAccounts = async () => {
    try {
      const response = await api.get('/email-marketing/gmail-accounts');
      setAccounts(response.data.data || []);
    } catch (error: any) {
      notification.error('Gmail', error.response?.data?.message || error.message);
    }
  };

  useEffect(() => { loadAccounts(); }, []);

  useEffect(() => {
    const el = rightRef.current;
    if (!el) return undefined;
    const apply = () => setPanelHeight(Math.round(el.getBoundingClientRect().height));
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    return () => observer.disconnect();
  }, [channel, activeId, frameReady]);

  useEffect(() => {
    const el = screenRef.current;
    if (!el) return undefined;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = el.getBoundingClientRect();
      const size = viewportRef.current;
      const x = Math.max(0, Math.round(((event.clientX - rect.left) / rect.width) * size.width));
      const y = Math.max(0, Math.round(((event.clientY - rect.top) / rect.height) * size.height));
      api.post(`/email-marketing/gmail-accounts/${activeId}/browser/input`, {
        type: 'mouse',
        action: 'wheel',
        x,
        y,
        deltaX: event.deltaX,
        deltaY: event.deltaY,
      }).catch(() => undefined);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [activeId]);

  useEffect(() => {
    if (!activeId || channel !== 'gmail') return undefined;
    let stopped = false;
    versionRef.current = 0;
    urlRef.current = '';
    emailRef.current = '';
    duplicateRef.current = '';
    setFrameReady(false);

    const tick = async () => {
      if (stopped) return;
      let wait = 80;
      try {
        const response = await api.get(`/email-marketing/gmail-accounts/${activeId}/browser/frame`, {
          params: { since: versionRef.current },
          responseType: 'blob',
          validateStatus: (status) => status === 200 || status === 204,
        });
        const headers = response.headers || {};
        const version = Number(headers['x-frame-version'] || 0);
        if (version) versionRef.current = version;
        const nextUrl = decodeURIComponent(headers['x-page-url'] || '');
        const frameWidth = Number(headers['x-frame-width'] || 0);
        const frameHeight = Number(headers['x-frame-height'] || 0);
        if (frameWidth > 0 && frameHeight > 0) {
          setViewport((prev) => (prev.width === frameWidth && prev.height === frameHeight ? prev : { width: frameWidth, height: frameHeight }));
        }
        if (nextUrl && nextUrl !== urlRef.current) {
          urlRef.current = nextUrl;
          setPageUrl(nextUrl);
        }
        const duplicateEmail = decodeURIComponent(headers['x-duplicate-email'] || '');
        if (duplicateEmail && !duplicateEmail.endsWith('@sessao.local') && duplicateRef.current !== duplicateEmail) {
          duplicateRef.current = duplicateEmail;
          stopped = true;
          const createdId = activeId;
          setActiveId(null);
          setFrameReady(false);
          setAccounts((prev) => prev.filter((account) => account.id !== createdId));
          notification.warning(
            'Conta já existe',
            `A conta ${duplicateEmail} já está no sistema. A nova conta não foi adicionada.`,
            8000
          );
          api.delete(`/email-marketing/gmail-accounts/${createdId}`).catch(() => undefined);
          return;
        }
        const nextEmail = decodeURIComponent(headers['x-account-email'] || '');
        if (nextEmail && nextEmail !== emailRef.current && !nextEmail.endsWith('@sessao.local')) {
          emailRef.current = nextEmail;
          setDetectedEmail(nextEmail);
          setAccounts((prev) => prev.map((account) => (
            account.id === activeId ? { ...account, email: nextEmail, display_name: account.display_name || nextEmail } : account
          )));
        }
        if (response.status === 200 && response.data instanceof Blob && response.data.size > 0 && imgRef.current) {
          const blobUrl = URL.createObjectURL(response.data);
          const previous = imgRef.current.src;
          imgRef.current.src = blobUrl;
          if (previous.startsWith('blob:')) URL.revokeObjectURL(previous);
          setFrameReady(true);
          wait = 20;
        }
      } catch (error: any) {
        if (error.response?.status === 404) {
          stopped = true;
          setActiveId(null);
          notification.warning('Navegador', 'A janela desta conta foi fechada.');
          return;
        }
      }
      if (!stopped) window.setTimeout(tick, wait);
    };

    tick();
    return () => { stopped = true; };
  }, [activeId, channel]);

  const sendInput = (body: Record<string, unknown>) => {
    if (!activeId) return;
    api.post(`/email-marketing/gmail-accounts/${activeId}/browser/input`, body).catch(() => undefined);
  };

  const pointFromEvent = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * viewport.width;
    const y = ((event.clientY - rect.top) / rect.height) * viewport.height;
    return {
      x: Math.max(0, Math.round(x)),
      y: Math.max(0, Math.round(y)),
    };
  };

  const openExisting = async (id: number) => {
    if (starting) return;
    if (activeId === id) {
      await api.post(`/email-marketing/gmail-accounts/${id}/browser/close`).catch(() => undefined);
      setActiveId(null);
      setFrameReady(false);
      return;
    }
    setStarting(true);
    setDetectedEmail(null);
    try {
      if (activeId) await api.post(`/email-marketing/gmail-accounts/${activeId}/browser/close`).catch(() => undefined);
      await api.post(`/email-marketing/gmail-accounts/${id}/browser/open`, {}, { timeout: 120000 });
      setActiveId(id);
      window.setTimeout(() => screenRef.current?.focus(), 50);
    } catch (error: any) {
      notification.error('Gmail', error.response?.data?.message || error.message);
    } finally {
      setStarting(false);
    }
  };

  const createAccount = async () => {
    if (starting) return;
    setStarting(true);
    setDetectedEmail(null);
    try {
      if (activeId) await api.post(`/email-marketing/gmail-accounts/${activeId}/browser/close`).catch(() => undefined);
      const response = await api.post('/email-marketing/gmail-accounts/browser', {}, { timeout: 120000 });
      const created = response.data.data;
      setAccounts((prev) => [created, ...prev.filter((account) => account.id !== created.id)]);
      setActiveId(created.id);
      window.setTimeout(() => screenRef.current?.focus(), 50);
    } catch (error: any) {
      notification.error('Gmail', error.response?.data?.message || error.message);
      loadAccounts();
    } finally {
      setStarting(false);
    }
  };

  const saveOrder = async (next: GmailAccount[]) => {
    const previous = accounts;
    setAccounts(next);
    try {
      await api.put('/email-marketing/gmail-accounts/order', { ids: next.map((account) => account.id) });
    } catch (error: any) {
      setAccounts(previous);
      notification.error('Gmail', error.response?.data?.message || 'Não foi possível salvar a ordem dos cards.');
    }
  };

  const moveAccount = (id: number, direction: -1 | 1) => {
    const index = accounts.findIndex((account) => account.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= accounts.length) return;
    const next = [...accounts];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    saveOrder(next);
  };

  const dropAccount = (targetId: number) => {
    if (dragId == null || dragId === targetId) return;
    const from = accounts.findIndex((account) => account.id === dragId);
    const to = accounts.findIndex((account) => account.id === targetId);
    if (from < 0 || to < 0) return;
    const next = [...accounts];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    saveOrder(next);
  };

  const copyEmail = async (account: GmailAccount) => {
    const email = copyableEmail(account, detectedEmail, activeId === account.id);
    if (!email) {
      notification.warning('Gmail', 'Esta conta ainda não tem um e-mail para copiar. Entre nela primeiro.');
      return;
    }
    try {
      await navigator.clipboard.writeText(email);
      notification.success('Copiado', email);
    } catch {
      notification.error('Gmail', 'Não foi possível copiar o e-mail.');
    }
  };

  const reloadAccount = async (account: GmailAccount) => {
    if (starting || reloadingId) return;
    if (activeId !== account.id) {
      await openExisting(account.id);
      return;
    }
    setReloadingId(account.id);
    try {
      await api.post(`/email-marketing/gmail-accounts/${account.id}/browser/reload`, {}, { timeout: 60000 });
    } catch (error: any) {
      notification.error('Gmail', error.response?.data?.message || 'Não foi possível atualizar este e-mail.');
    } finally {
      setReloadingId(null);
    }
  };

  const removeAccount = async (account: GmailAccount) => {
    const ok = await confirm({
      title: 'Remover navegador',
      message: `Remover ${accountLabel(account)} deste sistema? O login salvo desta conta também sai daqui. Nada é apagado no Gmail.`,
      confirmText: 'Remover',
      type: 'danger',
    });
    if (!ok) return;
    try {
      await api.delete(`/email-marketing/gmail-accounts/${account.id}`);
      if (activeId === account.id) {
        setActiveId(null);
        setFrameReady(false);
      }
      setAccounts((prev) => prev.filter((item) => item.id !== account.id));
      notification.success('Removida', 'O navegador desta conta foi apagado do sistema.');
    } catch (error: any) {
      notification.error('Gmail', error.response?.data?.message || error.message);
    }
  };

  const buttonFromEvent = (event: React.MouseEvent) => (
    event.button === 2 ? 'right' : event.button === 1 ? 'middle' : 'left'
  );

  return (
    <div className="flex items-start gap-4">
      <notification.NotificationContainer />
      <ConfirmDialog />
      <aside
        className="w-[340px] shrink-0 sticky top-4 flex flex-col gap-3 overflow-hidden"
        style={{ height: Math.max(panelHeight, viewerHeight) }}
      >
        <div className="shrink-0">
          <p className="text-white font-black text-lg flex items-center gap-2"><FaGoogle className="text-red-400" /> Contas</p>
          <p className="text-white/50 text-sm">Escolha Gmail ou SMTP. A lista rola nesta coluna.</p>
        </div>
        <div className="shrink-0 grid grid-cols-2 gap-1 p-1 rounded-xl bg-black/30">
          <button
            type="button"
            onClick={() => onChannelChange('gmail')}
            className={`py-2 rounded-lg text-sm font-bold ${channel === 'gmail' ? 'bg-red-600 text-white' : 'text-white/60 hover:text-white'}`}
          >
            Gmail
          </button>
          <button
            type="button"
            onClick={() => onChannelChange('smtp')}
            className={`py-2 rounded-lg text-sm font-bold ${channel === 'smtp' ? 'bg-indigo-600 text-white' : 'text-white/60 hover:text-white'}`}
          >
            SMTP
          </button>
        </div>
        <div className="shrink-0 flex flex-col gap-2">
          {channel === 'gmail' && accounts.length > 1 && (
            <button
              type="button"
              onClick={() => setOrganizing((value) => !value)}
              className={`px-4 py-2.5 border font-semibold rounded-lg text-sm flex items-center justify-center gap-2 ${
                organizing
                  ? 'bg-white text-red-700 border-white'
                  : 'bg-white/10 hover:bg-white/20 text-white border-white/15'
              }`}
            >
              <FaGripVertical /> {organizing ? 'Concluir' : 'Organizar'}
            </button>
          )}
          {channel === 'gmail' ? (
            <button
              type="button"
              disabled={starting}
              onClick={createAccount}
              className="px-4 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-semibold rounded-lg text-sm flex items-center justify-center gap-2"
            >
              {starting ? <FaSpinner className="animate-spin" /> : <FaPlus />} Nova conta Gmail
            </button>
          ) : (
            <button
              type="button"
              onClick={onCreateSmtp}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg text-sm flex items-center justify-center gap-2"
            >
              <FaPlus /> Nova conta SMTP
            </button>
          )}
        </div>

        {channel === 'gmail' && organizing && accounts.length > 1 && (
          <p className="shrink-0 text-white/70 text-sm">Arraste para cima ou para baixo. A ordem fica salva.</p>
        )}

        <div className="flex-1 min-h-0 overflow-y-scroll overscroll-contain pr-1 flex flex-col gap-2">
          {channel === 'smtp' ? smtpList : accounts.map((account, index) => {
            const selectedCard = activeId === account.id;
            return (
              <div
                key={account.id}
                draggable={organizing}
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData('text/plain', String(account.id));
                  setDragId(account.id);
                }}
                onDragOver={(event) => {
                  if (!organizing) return;
                  event.preventDefault();
                  setDragOverId(account.id);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  dropAccount(account.id);
                  setDragId(null);
                  setDragOverId(null);
                }}
                onDragEnd={() => {
                  setDragId(null);
                  setDragOverId(null);
                }}
                className={`${organizing ? 'cursor-grab active:cursor-grabbing' : ''} ${
                  dragId === account.id ? 'opacity-50' : ''
                } ${dragOverId === account.id && dragId !== account.id ? 'ring-2 ring-white rounded-xl' : ''}`}
              >
                <div className="flex items-stretch gap-1">
                  <button
                    type="button"
                    draggable={false}
                    title={accountLabel(account)}
                    onClick={() => {
                      if (organizing) return;
                      openExisting(account.id);
                    }}
                    className={`flex-1 min-w-0 text-left border rounded-xl px-2.5 py-2 transition-all ${organizing ? 'pointer-events-none' : ''} ${
                      selectedCard
                        ? 'bg-gradient-to-br from-red-600 to-rose-700 border-red-300 shadow-lg'
                        : 'bg-gradient-to-br from-red-500/15 to-rose-600/10 border-red-500/35 hover:brightness-110'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {organizing ? (
                        <FaGripVertical className="text-white/70 flex-shrink-0" />
                      ) : (
                        <div className="bg-white/15 text-white p-1.5 rounded-lg"><FaGoogle className="text-sm" /></div>
                      )}
                      <div className="min-w-0">
                        <p className="text-[13px] font-bold text-white truncate">{accountLabel(account)}</p>
                        <p className="text-[10px] text-white/70 leading-tight">
                          {organizing ? 'Arraste para mover' : selectedCard ? 'Navegador aberto' : 'Abrir'}
                        </p>
                      </div>
                    </div>
                  </button>
                  {organizing ? (
                    <div className="flex flex-col justify-center gap-1">
                      <button
                        type="button"
                        title="Mover para cima"
                        disabled={index === 0}
                        onClick={() => moveAccount(account.id, -1)}
                        className="p-1.5 rounded-lg bg-white/10 text-white disabled:opacity-30 hover:bg-white/20"
                      >
                        <FaChevronUp className="text-xs" />
                      </button>
                      <button
                        type="button"
                        title="Mover para baixo"
                        disabled={index === accounts.length - 1}
                        onClick={() => moveAccount(account.id, 1)}
                        className="p-1.5 rounded-lg bg-white/10 text-white disabled:opacity-30 hover:bg-white/20"
                      >
                        <FaChevronDown className="text-xs" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col justify-center">
                      <button
                        type="button"
                        title="Copiar e-mail"
                        onClick={() => copyEmail(account)}
                        className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10"
                      >
                        <FaCopy className="text-xs" />
                      </button>
                      <button
                        type="button"
                        title="Atualizar e-mail"
                        disabled={reloadingId === account.id}
                        onClick={() => reloadAccount(account)}
                        className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 disabled:opacity-60"
                      >
                        <FaSync className={`text-xs ${reloadingId === account.id ? 'animate-spin' : ''}`} />
                      </button>
                      <button
                        type="button"
                        title="Remover este navegador"
                        onClick={() => removeAccount(account)}
                        className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10"
                      >
                        <FaTimes className="text-xs" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      <div
        ref={rightRef}
        className="sticky top-4 w-full min-w-0 self-start"
        style={{ maxWidth: channel === 'gmail' ? frameMax : undefined }}
      >
      {active ? (
        <div className="overflow-hidden rounded-2xl border border-white/15 bg-[#202124] shadow-2xl">
          <div className="flex items-center gap-2 px-3 py-2 bg-[#35363a] border-b border-black/30">
            <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
            <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
            <span className="w-3 h-3 rounded-full bg-[#28c840]" />
            <div className="flex-1 min-w-0 mx-2 px-3 py-1.5 rounded-full bg-[#202124] text-[12px] text-white/70 truncate">
              {pageUrl}
            </div>
            <button
              type="button"
              title="Copiar e-mail"
              onClick={() => copyEmail(active)}
              className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10"
            >
              <FaCopy className="text-xs" />
            </button>
            <button
              type="button"
              title="Atualizar e-mail"
              disabled={reloadingId === active.id}
              onClick={() => reloadAccount(active)}
              className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-60"
            >
              <FaSync className={`text-xs ${reloadingId === active.id ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => openExisting(active.id)}
              className="text-[11px] text-white/70 hover:text-white px-2"
            >
              Fechar
            </button>
          </div>
          <p className="px-4 py-2 text-[12px] text-white/55 bg-[#292a2d]">
            Navegador só desta conta: {accountEmail(active, detectedEmail)}. Caixa de entrada, spam e o resto aparecem como no Gmail.
          </p>
          <div
            ref={screenRef}
            tabIndex={0}
            className="relative bg-white outline-none cursor-default overscroll-none select-none"
            onMouseDown={(event) => {
              event.preventDefault();
              screenRef.current?.focus();
              const point = pointFromEvent(event);
              sendInput({ type: 'mouse', action: 'down', ...point, button: buttonFromEvent(event), clickCount: event.detail || 1 });
            }}
            onMouseUp={(event) => {
              const point = pointFromEvent(event);
              sendInput({ type: 'mouse', action: 'up', ...point, button: buttonFromEvent(event), clickCount: event.detail || 1 });
            }}
            onMouseMove={(event) => {
              if (moveTimer.current) return;
              const point = pointFromEvent(event);
              moveTimer.current = window.setTimeout(() => { moveTimer.current = null; }, 70);
              sendInput({ type: 'mouse', action: 'move', ...point });
            }}
            onContextMenu={(event) => event.preventDefault()}
            onPaste={(event) => {
              const text = event.clipboardData.getData('text');
              if (text) sendInput({ type: 'text', text });
            }}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing || event.key === 'Process' || event.key === 'Dead') return;
              event.preventDefault();
              const modifiers = (event.altKey ? 1 : 0) | (event.ctrlKey ? 2 : 0) | (event.metaKey ? 4 : 0) | (event.shiftKey ? 8 : 0);
              if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
                sendInput({ type: 'text', text: event.key });
                return;
              }
              sendInput({ type: 'key', key: event.key, code: event.code, modifiers });
            }}
          >
            <img
              ref={imgRef}
              alt="Gmail"
              draggable={false}
              className={`block w-full h-auto max-w-full select-none pointer-events-none ${frameReady ? '' : 'hidden'}`}
            />
            {!frameReady && (
              <div className="flex flex-col items-center justify-center gap-3 text-slate-500" style={{ minHeight: imageHeight }}>
                <FaSpinner className="animate-spin text-3xl" />
                <p>Abrindo o navegador do Gmail...</p>
              </div>
            )}
          </div>
        </div>
      ) : channel === 'smtp' ? (
        <div className="max-h-[calc(100vh-1.5rem)] overflow-auto overscroll-contain">
          {children}
        </div>
      ) : (
        <div
          className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] flex items-center justify-center text-white/45 text-sm px-6 text-center"
          style={{ height: viewerHeight }}
        >
          Escolha uma conta Gmail à esquerda para abrir aqui.
        </div>
      )}
      </div>
    </div>
  );
}
