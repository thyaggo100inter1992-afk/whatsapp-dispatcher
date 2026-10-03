import { useEffect, useState } from 'react';
import { FaGoogle, FaPlus, FaSpinner, FaTimes } from 'react-icons/fa';
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
  return 'Conta Gmail';
}

function gmailTabUrl(email: string) {
  const inbox = 'https://mail.google.com/mail/u/0/#inbox';
  if (!email || email.endsWith('@sessao.local')) return inbox;
  const params = new URLSearchParams({
    Email: email,
    continue: inbox,
  });
  return `https://accounts.google.com/AccountChooser?${params.toString()}`;
}

function openChromeTab(accountId: number, email: string, existing?: Window | null) {
  const url = gmailTabUrl(email);
  if (existing && !existing.closed) {
    existing.location.href = url;
    existing.focus();
    return existing;
  }
  const opened = window.open(url, `gmail-conta-${accountId}`);
  opened?.focus();
  return opened;
}

export default function GmailMailboxSection(_props: { onOpenChange?: (open: boolean) => void }) {
  const notification = useNotification();
  const { confirm, ConfirmDialog } = useConfirm();
  const [accounts, setAccounts] = useState<GmailAccount[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);

  const loadAccounts = async () => {
    try {
      const response = await api.get('/email-marketing/gmail-accounts');
      setAccounts(response.data.data || []);
    } catch (error: any) {
      notification.error('Gmail', error.response?.data?.message || error.message);
    }
  };

  useEffect(() => { loadAccounts(); }, []);

  const warnPopup = () => {
    notification.warning('Aba bloqueada', 'Permita pop-ups deste site no Chrome e clique na conta de novo.');
  };

  const handleSave = async () => {
    const address = email.trim().toLowerCase();
    if (!address.includes('@')) {
      notification.warning('Atenção', 'Informe o e-mail da conta Gmail.');
      return;
    }
    const popup = window.open('about:blank', `gmail-nova-${Date.now()}`);
    if (!popup) {
      warnPopup();
      return;
    }
    setSaving(true);
    try {
      const response = await api.post('/email-marketing/gmail-accounts/link', {
        email: address,
        display_name: displayName.trim() || null,
      });
      const created: GmailAccount = response.data.data;
      setAccounts((prev) => [created, ...prev.filter((account) => account.id !== created.id)]);
      setEmail('');
      setDisplayName('');
      setShowForm(false);
      const opened = openChromeTab(created.id, created.email, popup);
      if (!opened) warnPopup();
    } catch (error: any) {
      popup.close();
      notification.error('Gmail', error.response?.data?.message || error.message);
    } finally {
      setSaving(false);
    }
  };

  const removeAccount = async (account: GmailAccount) => {
    const ok = await confirm({
      title: 'Remover conta',
      message: `Tirar ${accountLabel(account)} desta lista? A conta continua no Gmail e no Chrome.`,
      confirmText: 'Remover',
      type: 'danger',
    });
    if (!ok) return;
    try {
      await api.delete(`/email-marketing/gmail-accounts/${account.id}`);
      setAccounts((prev) => prev.filter((item) => item.id !== account.id));
      notification.success('Removida', 'Atalho apagado desta lista.');
    } catch (error: any) {
      notification.error('Gmail', error.response?.data?.message || error.message);
    }
  };

  const inputCls = 'w-full px-3.5 py-2.5 bg-[#0b1220] border border-white/10 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:border-red-400/50';

  return (
    <div className="space-y-4">
      <notification.NotificationContainer />
      <ConfirmDialog />
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-white font-black text-lg flex items-center gap-2"><FaGoogle className="text-red-400" /> Contas Gmail</p>
          <p className="text-white/50 text-sm">Cada conta abre uma aba real do Chrome, na hora. Pode salvar várias. O login fica no seu Chrome, sem atraso.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-lg text-sm flex items-center gap-2"
        >
          <FaPlus /> Nova conta Gmail
        </button>
      </div>

      {accounts.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {accounts.map((account) => (
            <div key={account.id} className="relative">
              <button
                type="button"
                onClick={() => {
                  const opened = openChromeTab(account.id, account.email);
                  if (!opened) warnPopup();
                }}
                className="w-full text-left border rounded-xl px-2.5 py-2 bg-gradient-to-br from-red-500/15 to-rose-600/10 border-red-500/35 hover:brightness-110"
              >
                <div className="flex items-center gap-2 min-w-0 pr-6">
                  <div className="bg-white/15 text-white p-1.5 rounded-lg"><FaGoogle className="text-sm" /></div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-white truncate">{accountLabel(account)}</p>
                    <p className="text-[10px] text-white/70 break-all leading-tight">{account.email.endsWith('@sessao.local') ? 'Abrir Gmail' : account.email}</p>
                    <p className="text-[10px] font-bold mt-0.5 text-white/80">Abrir no Chrome</p>
                  </div>
                </div>
              </button>
              <button
                type="button"
                title="Remover desta lista"
                onClick={() => removeAccount(account)}
                className="absolute top-1.5 right-1.5 p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-black/20"
              >
                <FaTimes className="text-xs" />
              </button>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => !saving && setShowForm(false)}>
          <div className="bg-dark-800 border border-white/15 rounded-2xl max-w-lg w-full p-6 space-y-4" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-white font-bold text-lg flex items-center gap-2"><FaGoogle className="text-red-400" /> Nova conta Gmail</h3>
              <button type="button" onClick={() => setShowForm(false)} className="p-2 text-white/60 hover:text-white"><FaTimes /></button>
            </div>
            <p className="text-sm text-white/60 leading-relaxed">
              A conta abre numa aba normal do Chrome. Entre com o e-mail e a senha direto no Gmail. Não há foto nem atraso.
            </p>
            <div>
              <label className="block text-xs font-bold text-white/50 uppercase mb-1">E-mail</label>
              <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nome@gmail.com" className={inputCls} autoComplete="off" />
            </div>
            <div>
              <label className="block text-xs font-bold text-white/50 uppercase mb-1">Nome de exibição (opcional)</label>
              <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Atendimento" className={inputCls} />
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="w-full py-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-semibold rounded-xl flex items-center justify-center gap-2"
            >
              {saving ? <FaSpinner className="animate-spin" /> : <FaGoogle />} Salvar e abrir no Chrome
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
