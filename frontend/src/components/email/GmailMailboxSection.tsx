import { useEffect, useRef, useState } from 'react';
import { FaChevronLeft, FaChevronRight, FaGoogle, FaGripVertical, FaPlus, FaSpinner, FaTimes } from 'react-icons/fa';
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

function accountEmail(account: GmailAccount, detected?: string | null) {
  if (detected && !detected.endsWith('@sessao.local')) return detected;
  if (account.email && !account.email.endsWith('@sessao.local')) return account.email;
  return 'Entre com o e-mail e a senha do Gmail';
}

export default function GmailMailboxSection({ onOpenChange }: { onOpenChange?: (open: boolean) => void }) {
  const notification = useNotification();
  const { confirm, ConfirmDialog } = useConfirm();
  const [accounts, setAccounts] = useState<GmailAccount[]>([]);
  const [organizing, setOrganizing] = useState(false);
  const [dragId, setDragId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [starting, setStarting] = useState(false);
  const [frameReady, setFrameReady] = useState(false);
  const [viewport, setViewport] = useState({ width: 1280, height: 720 });
  const [pageUrl, setPageUrl] = useState('https://mail.google.com');
  const [detectedEmail, setDetectedEmail] = useState<string | null>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const versionRef = useRef(0);
  const urlRef = useRef('');
  const emailRef = useRef('');
  const moveTimer = useRef<number | null>(null);

  const active = accounts.find((account) => account.id === activeId) || null;

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
    onOpenChange?.(activeId != null);
  }, [activeId, onOpenChange]);

  useEffect(() => {
    if (!activeId) return undefined;
    let stopped = false;
    versionRef.current = 0;
    urlRef.current = '';
    emailRef.current = '';
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
  }, [activeId]);

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
    <div className="space-y-4">
      <notification.NotificationContainer />
      <ConfirmDialog />
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-white font-black text-lg flex items-center gap-2"><FaGoogle className="text-red-400" /> Contas Gmail</p>
          <p className="text-white/50 text-sm">O Gmail abre aqui dentro desta tela. Não abre janela nem aba fora do sistema. Pode cadastrar várias contas; uma fica aberta por vez e o login das outras continua salvo.</p>
        </div>
        <div className="flex items-center gap-2">
          {accounts.length > 1 && (
            <button
              type="button"
              onClick={() => setOrganizing((value) => !value)}
              className={`px-4 py-2.5 border font-semibold rounded-lg text-sm flex items-center gap-2 ${
                organizing
                  ? 'bg-white text-red-700 border-white'
                  : 'bg-white/10 hover:bg-white/20 text-white border-white/15'
              }`}
            >
              <FaGripVertical /> {organizing ? 'Concluir' : 'Organizar'}
            </button>
          )}
          <button
            type="button"
            disabled={starting}
            onClick={createAccount}
            className="px-4 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-semibold rounded-lg text-sm flex items-center gap-2"
          >
            {starting ? <FaSpinner className="animate-spin" /> : <FaPlus />} Nova conta Gmail
          </button>
        </div>
      </div>

      {organizing && accounts.length > 1 && (
        <p className="text-white/70 text-sm">Arraste o card para a posição que quiser, ou use as setas. A ordem fica salva.</p>
      )}

      {accounts.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {accounts.map((account, index) => {
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
                className={`relative ${organizing ? 'cursor-grab active:cursor-grabbing' : ''} ${
                  dragId === account.id ? 'opacity-50' : ''
                } ${dragOverId === account.id && dragId !== account.id ? 'ring-2 ring-white rounded-xl' : ''}`}
              >
                <button
                  type="button"
                  draggable={false}
                  onClick={() => {
                    if (organizing) return;
                    openExisting(account.id);
                  }}
                  className={`w-full text-left border rounded-xl px-2.5 py-2 transition-all ${organizing ? 'pointer-events-none' : ''} ${
                    selectedCard
                      ? 'bg-gradient-to-br from-red-600 to-rose-700 border-red-300 shadow-lg'
                      : 'bg-gradient-to-br from-red-500/15 to-rose-600/10 border-red-500/35 hover:brightness-110'
                  }`}
                >
                  <div className={`flex items-center gap-2 min-w-0 ${organizing ? 'pr-1' : 'pr-6'}`}>
                    {organizing ? (
                      <FaGripVertical className="text-white/70 flex-shrink-0" />
                    ) : (
                      <div className="bg-white/15 text-white p-1.5 rounded-lg"><FaGoogle className="text-sm" /></div>
                    )}
                    <div className="min-w-0">
                      <p className="text-[13px] font-bold text-white truncate">{accountLabel(account)}</p>
                      <p className="text-[10px] text-white/70 leading-tight">
                        {organizing ? 'Arraste para mover' : selectedCard ? 'Navegador aberto' : 'Abrir navegador'}
                      </p>
                    </div>
                  </div>
                </button>
                {organizing ? (
                  <div className="mt-1 flex justify-end gap-1">
                    <button
                      type="button"
                      title="Mover para a esquerda"
                      disabled={index === 0}
                      onClick={() => moveAccount(account.id, -1)}
                      className="p-1.5 rounded-lg bg-white/10 text-white disabled:opacity-30 hover:bg-white/20"
                    >
                      <FaChevronLeft className="text-xs" />
                    </button>
                    <button
                      type="button"
                      title="Mover para a direita"
                      disabled={index === accounts.length - 1}
                      onClick={() => moveAccount(account.id, 1)}
                      className="p-1.5 rounded-lg bg-white/10 text-white disabled:opacity-30 hover:bg-white/20"
                    >
                      <FaChevronRight className="text-xs" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    title="Remover este navegador"
                    onClick={() => removeAccount(account)}
                    className="absolute top-1.5 right-1.5 p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-black/20"
                  >
                    <FaTimes className="text-xs" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {active && (
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
            className="relative bg-white outline-none cursor-default"
            onMouseDown={(event) => {
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
            onWheel={(event) => {
              event.preventDefault();
              const point = pointFromEvent(event);
              sendInput({ type: 'mouse', action: 'wheel', ...point, deltaX: event.deltaX, deltaY: event.deltaY });
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
              className={`w-full h-auto select-none pointer-events-none ${frameReady ? '' : 'hidden'}`}
            />
            {!frameReady && (
              <div className="h-[520px] flex flex-col items-center justify-center gap-3 text-slate-500">
                <FaSpinner className="animate-spin text-3xl" />
                <p>Abrindo o navegador do Gmail...</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
