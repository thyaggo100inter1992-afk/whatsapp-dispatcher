import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import {
  FaBan, FaArrowLeft, FaPlus, FaTrash, FaSpinner, FaSearch, FaEnvelope,
} from 'react-icons/fa';
import api from '@/services/api';
import { useNotification } from '@/hooks/useNotification';
import { useConfirm } from '@/hooks/useConfirm';
import ProtectedRoute from '@/components/ProtectedRoute';

interface RestrictionRow {
  id: number;
  email: string;
  reason: string;
  source: string;
  notes: string | null;
  created_at: string;
}

export default function EmailListasRestricao() {
  const router = useRouter();
  const notification = useNotification();
  const { confirm, ConfirmDialog } = useConfirm();
  const [rows, setRows] = useState<RestrictionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [adding, setAdding] = useState(false);

  const load = async (search = q) => {
    setLoading(true);
    try {
      const r = await api.get('/email-marketing/restrictions', {
        params: { q: search || undefined, limit: 200 },
      });
      setRows(r.data.data || []);
      setTotal(r.data.total || 0);
    } catch (e: any) {
      notification.error('Erro', e.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    const email = newEmail.trim().toLowerCase();
    if (!email.includes('@')) {
      notification.warning('Atenção', 'Informe um e-mail válido.');
      return;
    }
    setAdding(true);
    try {
      await api.post('/email-marketing/restrictions', {
        email,
        reason: 'opt_out',
        source: 'manual',
        notes: 'Adicionado manualmente na lista de restrição',
      });
      notification.success('Adicionado', `${email} não receberá mais e-mails de marketing.`);
      setNewEmail('');
      load();
    } catch (e: any) {
      notification.error('Erro', e.response?.data?.message || e.message);
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (row: RestrictionRow) => {
    const ok = await confirm({
      title: 'Remover da restrição',
      message: `Permitir envios novamente para ${row.email}?`,
      confirmText: 'Sim, remover',
      type: 'danger',
    });
    if (!ok) return;
    try {
      await api.delete(`/email-marketing/restrictions/${row.id}`);
      notification.success('Removido', `${row.email} saiu da lista de restrição.`);
      load();
    } catch (e: any) {
      notification.error('Erro', e.response?.data?.message || e.message);
    }
  };

  const sourceLabel = (s: string) => {
    if (s === 'unsubscribe_link') return 'Link do e-mail';
    if (s === 'manual') return 'Manual';
    if (s === 'sendgrid_webhook') return 'SendGrid';
    return s || '—';
  };

  return (
    <>
      <Head>
        <title>Lista de Restrição | E-mail Marketing</title>
      </Head>
      <ProtectedRoute requiredPermission="email_marketing" fallbackPath="/">
        <notification.NotificationContainer />
        <ConfirmDialog />
        <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 py-8 px-4">
          <div className="max-w-5xl mx-auto space-y-8">
            <div className="relative overflow-hidden bg-gradient-to-r from-red-600/30 via-orange-500/20 to-red-600/30 backdrop-blur-xl border-2 border-red-500/40 rounded-3xl p-8 shadow-2xl">
              <div className="relative flex items-center gap-6 flex-wrap">
                <button
                  type="button"
                  onClick={() => router.push('/email-marketing')}
                  className="p-3 bg-white/10 hover:bg-white/20 rounded-xl text-white"
                >
                  <FaArrowLeft />
                </button>
                <div className="bg-gradient-to-br from-red-500 to-orange-600 p-5 rounded-2xl">
                  <FaBan className="text-4xl text-white" />
                </div>
                <div>
                  <h1 className="text-3xl md:text-4xl font-black text-white">Lista de Restrição</h1>
                  <p className="text-white/70 mt-1">
                    Lista exclusiva do seu tenant — quem cancelou inscrição nos seus e-mails. Não mistura com outros tenants.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-dark-800/60 border-2 border-white/10 rounded-2xl p-6 space-y-4">
              <p className="text-sm text-white/60">
                Quando alguém clica em <strong className="text-white/80">Cancelar inscrição</strong> no rodapé do seu e-mail,
                o endereço sobe <strong className="text-white/80">somente na lista deste tenant</strong> (o que criou a campanha/envio).
                Outros tenants continuam com as listas deles, separadas.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                  placeholder="email@exemplo.com"
                  className="flex-1 px-4 py-3 bg-dark-700 border-2 border-white/20 rounded-xl text-white placeholder-white/40"
                />
                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={adding}
                  className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {adding ? <FaSpinner className="animate-spin" /> : <FaPlus />}
                  Adicionar
                </button>
              </div>
            </div>

            <div className="bg-dark-800/60 border-2 border-white/10 rounded-2xl p-6">
              <div className="flex flex-col sm:flex-row gap-3 mb-4 items-stretch sm:items-center justify-between">
                <h2 className="text-xl font-bold text-white">
                  {total.toLocaleString('pt-BR')} e-mail(s) restrito(s)
                </h2>
                <div className="flex gap-2">
                  <div className="relative flex-1 sm:w-64">
                    <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                    <input
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && load()}
                      placeholder="Buscar e-mail…"
                      className="w-full pl-10 pr-4 py-2.5 bg-dark-700 border border-white/20 rounded-xl text-white text-sm"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => load()}
                    className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-bold"
                  >
                    Buscar
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="py-16 text-center text-white/50">
                  <FaSpinner className="animate-spin text-3xl mx-auto mb-3" />
                  Carregando…
                </div>
              ) : rows.length === 0 ? (
                <div className="py-16 text-center text-white/50">
                  <FaEnvelope className="text-4xl mx-auto mb-3 opacity-40" />
                  Nenhum e-mail na lista de restrição.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-white/10 text-white/50 text-sm">
                        <th className="py-3 pr-4">E-mail</th>
                        <th className="py-3 pr-4">Origem</th>
                        <th className="py-3 pr-4">Data</th>
                        <th className="py-3 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.id} className="border-b border-white/5 hover:bg-white/5">
                          <td className="py-3 pr-4 text-white font-medium">{row.email}</td>
                          <td className="py-3 pr-4 text-white/60 text-sm">{sourceLabel(row.source)}</td>
                          <td className="py-3 pr-4 text-white/50 text-sm">
                            {row.created_at ? new Date(row.created_at).toLocaleString('pt-BR') : '—'}
                          </td>
                          <td className="py-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleDelete(row)}
                              className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg"
                              title="Remover"
                            >
                              <FaTrash />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </ProtectedRoute>
    </>
  );
}
