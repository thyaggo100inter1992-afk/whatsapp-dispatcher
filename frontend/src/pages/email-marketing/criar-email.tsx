import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import {
  FaEnvelope, FaArrowLeft, FaPlus, FaTrash, FaSpinner, FaInbox, FaCheckCircle,
} from 'react-icons/fa';
import api from '@/services/api';
import { useNotification } from '@/hooks/useNotification';
import { useConfirm } from '@/hooks/useConfirm';
import ProtectedRoute from '@/components/ProtectedRoute';

interface Domain {
  id: number;
  domain: string;
  status: string;
  inbound_enabled?: boolean;
  inbound_status?: string;
}

interface Mailbox {
  id: number;
  email: string;
  local_part: string;
  display_name: string | null;
  domain: string;
  domain_status: string;
  inbound_status: string;
  unread_count: number;
  created_at: string;
}

export default function CriarEmail() {
  const router = useRouter();
  const notification = useNotification();
  const { confirm, ConfirmDialog } = useConfirm();
  const [domains, setDomains] = useState<Domain[]>([]);
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [localPart, setLocalPart] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [selectedDomainIds, setSelectedDomainIds] = useState<number[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const [d, m] = await Promise.all([
        api.get('/email-marketing/domains'),
        api.get('/email-marketing/mailboxes'),
      ]);
      const active = (d.data.data || []).filter(
        (x: Domain) => x.status === 'active' || x.status === 'active_partial'
      );
      setDomains(active);
      setMailboxes(m.data.data || []);
    } catch (e: any) {
      notification.error('Erro', e.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggleDomain = (id: number) => {
    setSelectedDomainIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleCreate = async () => {
    const local = localPart.trim().toLowerCase().replace(/[^a-z0-9._+-]/g, '');
    if (!local) {
      notification.warning('Atenção', 'Informe a parte antes do @ (ex.: contato)');
      return;
    }
    if (selectedDomainIds.length === 0) {
      notification.warning('Atenção', 'Selecione ao menos um domínio');
      return;
    }
    setCreating(true);
    try {
      const r = await api.post('/email-marketing/mailboxes', {
        local_part: local,
        display_name: displayName.trim() || null,
        domain_ids: selectedDomainIds,
      });
      notification.success('Caixa criada', r.data.message || 'E-mail criado com sucesso');
      if (r.data.warnings?.length) {
        notification.warning('Aviso', r.data.warnings.join(' · '));
      }
      setLocalPart('');
      setDisplayName('');
      load();
    } catch (e: any) {
      notification.error('Erro', e.response?.data?.message || e.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (mb: Mailbox) => {
    const ok = await confirm({
      title: 'Excluir caixa',
      message: `Excluir ${mb.email} e todas as mensagens?`,
      confirmText: 'Sim, excluir',
      type: 'danger',
    });
    if (!ok) return;
    try {
      await api.delete(`/email-marketing/mailboxes/${mb.id}`);
      notification.success('Excluída', mb.email);
      load();
    } catch (e: any) {
      notification.error('Erro', e.response?.data?.message || e.message);
    }
  };

  return (
    <>
      <Head><title>Criar E-mail | E-mail Marketing</title></Head>
      <ProtectedRoute requiredPermission="email_marketing" fallbackPath="/">
        <notification.NotificationContainer />
        <ConfirmDialog />
        <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 py-8 px-4">
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="relative overflow-hidden bg-gradient-to-r from-cyan-600/30 via-teal-500/20 to-cyan-600/30 border-2 border-cyan-500/40 rounded-3xl p-8">
              <div className="flex items-center gap-6 flex-wrap">
                <button type="button" onClick={() => router.push('/email-marketing')} className="p-3 bg-white/10 hover:bg-white/20 rounded-xl text-white">
                  <FaArrowLeft />
                </button>
                <div className="bg-gradient-to-br from-cyan-500 to-teal-600 p-5 rounded-2xl">
                  <FaEnvelope className="text-4xl text-white" />
                </div>
                <div>
                  <h1 className="text-3xl md:text-4xl font-black text-white">Criar E-mail</h1>
                  <p className="text-white/70 mt-1">
                    Escolha o domínio e a parte antes do @. Ex.: contato → contato@seudominio.com
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-dark-800/60 border-2 border-white/10 rounded-2xl p-6 space-y-5">
              <div>
                <label className="block text-sm font-bold text-white/80 mb-2">Parte local (antes do @) *</label>
                <input
                  value={localPart}
                  onChange={(e) => setLocalPart(e.target.value)}
                  placeholder="contato"
                  className="w-full px-4 py-3 bg-dark-700 border-2 border-white/20 rounded-xl text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-white/80 mb-2">Nome de exibição (opcional)</label>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Atendimento NettCred"
                  className="w-full px-4 py-3 bg-dark-700 border-2 border-white/20 rounded-xl text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-white/80 mb-3">Domínio(s) *</label>
                {domains.length === 0 ? (
                  <p className="text-yellow-300 text-sm">
                    Nenhum domínio ativo. Configure em{' '}
                    <button type="button" className="underline" onClick={() => router.push('/email-marketing/dominios')}>
                      Domínios
                    </button>
                    .
                  </p>
                ) : (
                  <div className="space-y-2">
                    {domains.map((d) => (
                      <label
                        key={d.id}
                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer ${
                          selectedDomainIds.includes(d.id)
                            ? 'border-cyan-500/50 bg-cyan-500/10'
                            : 'border-white/10 bg-dark-700/50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedDomainIds.includes(d.id)}
                          onChange={() => toggleDomain(d.id)}
                          className="w-4 h-4"
                        />
                        <span className="text-white font-medium">{d.domain}</span>
                        {d.inbound_status === 'active' ? (
                          <span className="text-xs text-green-400 ml-auto">Recebimento OK</span>
                        ) : (
                          <span className="text-xs text-yellow-400 ml-auto">Ative recebimento em Domínios</span>
                        )}
                      </label>
                    ))}
                  </div>
                )}
              </div>
              {localPart && selectedDomainIds.length > 0 && (
                <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-sm text-cyan-200">
                  Será criado:{' '}
                  {domains
                    .filter((d) => selectedDomainIds.includes(d.id))
                    .map((d) => `${localPart.trim().toLowerCase()}@${d.domain}`)
                    .join(', ')}
                </div>
              )}
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating || domains.length === 0}
                className="w-full py-4 bg-gradient-to-r from-cyan-500 to-teal-600 hover:from-cyan-600 hover:to-teal-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {creating ? <FaSpinner className="animate-spin" /> : <FaPlus />}
                Criar e-mail
              </button>
            </div>

            <div className="bg-dark-800/60 border-2 border-white/10 rounded-2xl p-6">
              <h2 className="text-xl font-bold text-white mb-4">Caixas criadas</h2>
              {loading ? (
                <div className="py-10 text-center text-white/50"><FaSpinner className="animate-spin text-2xl mx-auto" /></div>
              ) : mailboxes.length === 0 ? (
                <p className="text-white/50 text-center py-8">Nenhuma caixa ainda.</p>
              ) : (
                <div className="space-y-3">
                  {mailboxes.map((mb) => (
                    <div key={mb.id} className="flex items-center gap-4 p-4 bg-dark-700/60 border border-white/10 rounded-xl flex-wrap">
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-bold truncate">{mb.email}</p>
                        <p className="text-xs text-white/50">
                          {mb.display_name || mb.local_part}
                          {mb.unread_count > 0 ? ` · ${mb.unread_count} não lido(s)` : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => router.push(`/email-marketing/caixa-entrada?mailbox=${mb.id}`)}
                        className="px-4 py-2 bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 rounded-lg text-sm font-bold flex items-center gap-2"
                      >
                        <FaInbox /> Abrir caixa
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(mb)}
                        className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg"
                      >
                        <FaTrash />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </ProtectedRoute>
    </>
  );
}
