import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { FaGlobe, FaArrowLeft, FaPlus, FaTrash, FaSync, FaCheckCircle, FaExclamationTriangle, FaSpinner, FaCopy, FaTimes } from 'react-icons/fa';
import api from '@/services/api';
import { useNotification } from '@/hooks/useNotification';
import { useConfirm } from '@/hooks/useConfirm';

interface Domain { id: number; domain: string; status: string; dns_records: any; created_at: string; }

const STATUS = {
  active: { label: '✅ Verificado', color: 'text-green-300 bg-green-500/10 border-green-500/30' },
  pending: { label: '⏳ Pendente', color: 'text-yellow-300 bg-yellow-500/10 border-yellow-500/30' },
  unverified: { label: '⚠️ Não verificado', color: 'text-orange-300 bg-orange-500/10 border-orange-500/30' },
  failed: { label: '❌ Falhou', color: 'text-red-300 bg-red-500/10 border-red-500/30' },
};

export default function Dominios() {
  const router = useRouter();
  const notification = useNotification();
  const { confirm, ConfirmDialog } = useConfirm();
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [verifying, setVerifying] = useState<number | null>(null);
  const [newDomain, setNewDomain] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [showDns, setShowDns] = useState<Domain | null>(null);

  useEffect(() => { loadDomains(); }, []);

  const loadDomains = async () => {
    try {
      const r = await api.get('/email-marketing/domains');
      setDomains(r.data.data || []);
    } catch { } finally { setLoading(false); }
  };

  const handleAdd = async () => {
    if (!newDomain) { notification.warning('Campo obrigatório', 'Informe o domínio.'); return; }
    setAdding(true);
    try {
      const r = await api.post('/email-marketing/domains', { domain: newDomain });
      notification.success('Domínio adicionado!', 'Configure os registros DNS e clique em Verificar.');
      setShowAdd(false);
      setNewDomain('');
      loadDomains();
      if (r.data.data) setShowDns(r.data.data);
    } catch (error: any) {
      notification.error('Erro', error.response?.data?.message || error.message);
    } finally { setAdding(false); }
  };

  const handleVerify = async (id: number) => {
    setVerifying(id);
    try {
      const r = await api.post(`/email-marketing/domains/${id}/verify`);
      if (r.data.verified) {
        notification.success('Domínio verificado!', 'O domínio foi verificado com sucesso.');
      } else {
        notification.warning('DNS não propagado', 'Os registros DNS ainda não foram propagados. Aguarde e tente novamente.');
      }
      loadDomains();
    } catch (error: any) {
      notification.error('Erro', error.response?.data?.message || error.message);
    } finally { setVerifying(null); }
  };

  const handleDelete = async (id: number, domain: string) => {
    const ok = await confirm({ title: 'Excluir Domínio', message: `Deseja remover o domínio "${domain}"?`, confirmText: 'Sim, Excluir', type: 'danger' });
    if (!ok) return;
    try {
      await api.delete(`/email-marketing/domains/${id}`);
      notification.success('Domínio removido', '');
      loadDomains();
    } catch (error: any) {
      notification.error('Erro', error.response?.data?.message || error.message);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    notification.success('Copiado!', '');
  };

  return (
    <>
      <Head><title>Domínios | E-mail Marketing</title></Head>
      <notification.NotificationContainer />
      <ConfirmDialog />

      {/* Modal Adicionar */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border-2 border-red-500/40 rounded-2xl p-8 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-white">Adicionar Domínio</h2>
              <button onClick={() => setShowAdd(false)} className="p-2 hover:bg-white/10 rounded-lg text-gray-400"><FaTimes /></button>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-300 mb-2">Domínio de Envio *</label>
              <input type="text" value={newDomain} onChange={e => setNewDomain(e.target.value)}
                placeholder="Ex: envios.seudominio.com"
                className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-red-500 focus:outline-none" />
              <p className="text-xs text-gray-500 mt-2">Recomendado: use um subdomínio dedicado para envios, como <code className="bg-white/10 px-1 rounded">mail.seudominio.com</code></p>
            </div>
            <div className="flex gap-3">
              <button onClick={handleAdd} disabled={adding}
                className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50">
                {adding ? <FaSpinner className="animate-spin" /> : <FaCheckCircle />} Adicionar
              </button>
              <button onClick={() => setShowAdd(false)} className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-bold">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal DNS */}
      {showDns && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-gray-900 border-2 border-yellow-500/40 rounded-2xl p-8 max-w-3xl w-full my-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-black text-white">🔧 Registros DNS para {showDns.domain}</h2>
              <button onClick={() => setShowDns(null)} className="p-2 hover:bg-white/10 rounded-lg text-gray-400"><FaTimes /></button>
            </div>
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-4 text-sm text-yellow-300">
              Configure esses registros no painel DNS do seu domínio (Cloudflare, Registro.br, etc.) e depois clique em <strong>Verificar</strong>.
            </div>
            {showDns.dns_records && Array.isArray(showDns.dns_records) && showDns.dns_records.length > 0 ? (
              <div className="space-y-3">
                {showDns.dns_records.map((rec: any, i: number) => (
                  <div key={i} className="bg-black/30 rounded-lg p-4 border border-white/10">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-gray-400 uppercase">{rec.record_type || rec.type} • {rec.valid === 'valid' ? '✅' : '⏳'}</span>
                    </div>
                    <div className="grid gap-1 text-sm">
                      <div className="flex items-start gap-2">
                        <span className="text-gray-500 w-16 flex-shrink-0">Nome:</span>
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <code className="text-green-300 break-all">{rec.name}</code>
                          <button onClick={() => copyToClipboard(rec.name)} className="flex-shrink-0 p-1 hover:bg-white/10 rounded text-gray-500"><FaCopy /></button>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-gray-500 w-16 flex-shrink-0">Valor:</span>
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <code className="text-blue-300 break-all text-xs">{rec.value}</code>
                          <button onClick={() => copyToClipboard(rec.value)} className="flex-shrink-0 p-1 hover:bg-white/10 rounded text-gray-500"><FaCopy /></button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-center py-4">Nenhum registro DNS disponível. Verifique o domínio para carregar.</p>
            )}
            <button onClick={() => { handleVerify(showDns.id); setShowDns(null); }}
              className="w-full mt-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold flex items-center justify-center gap-2">
              <FaSync /> Verificar Agora
            </button>
          </div>
        </div>
      )}

      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 py-12 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <button onClick={() => router.push('/email-marketing')} className="p-3 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all">
                <FaArrowLeft />
              </button>
              <div>
                <h1 className="text-3xl font-black text-white flex items-center gap-3"><FaGlobe className="text-red-400" /> Domínios de Envio</h1>
                <p className="text-gray-400">{domains.length} domínio(s) cadastrado(s)</p>
              </div>
            </div>
            <button onClick={() => setShowAdd(true)} className="px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl font-bold transition-all flex items-center gap-2">
              <FaPlus /> Adicionar Domínio
            </button>
          </div>

          {/* Info */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mb-6 text-sm text-blue-300">
            <strong>ℹ️ Como funciona:</strong> Ao adicionar um domínio, o sistema cria ele automaticamente no Mailgun e exibe os registros DNS que você precisa configurar no seu provedor de domínio. Após configurar, clique em Verificar.
          </div>

          {loading ? (
            <div className="flex justify-center py-20"><FaSpinner className="text-4xl text-red-400 animate-spin" /></div>
          ) : domains.length === 0 ? (
            <div className="bg-white/5 rounded-2xl p-12 text-center border border-white/10">
              <FaGlobe className="text-6xl text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 text-lg mb-4">Nenhum domínio configurado</p>
              <button onClick={() => setShowAdd(true)} className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold">Adicionar Primeiro Domínio</button>
            </div>
          ) : (
            <div className="space-y-4">
              {domains.map(d => {
                const st = STATUS[d.status as keyof typeof STATUS] || STATUS.pending;
                return (
                  <div key={d.id} className="bg-gradient-to-br from-white/10 to-white/5 rounded-2xl p-6 border border-white/10">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-red-500/20 rounded-xl">
                          <FaGlobe className="text-2xl text-red-400" />
                        </div>
                        <div>
                          <h3 className="text-xl font-black text-white">{d.domain}</h3>
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold border mt-1 ${st.color}`}>{st.label}</span>
                          <p className="text-gray-600 text-xs mt-1">Adicionado em {new Date(d.created_at).toLocaleDateString('pt-BR')}</p>
                        </div>
                      </div>

                      <div className="flex gap-2 flex-wrap">
                        {d.dns_records && (
                          <button onClick={() => setShowDns(d)} className="px-4 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border border-yellow-500/40 rounded-lg font-bold text-sm flex items-center gap-2">
                            🔧 Ver DNS
                          </button>
                        )}
                        {d.status !== 'active' && (
                          <button onClick={() => handleVerify(d.id)} disabled={verifying === d.id}
                            className="px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-300 border border-green-500/40 rounded-lg font-bold text-sm flex items-center gap-2 disabled:opacity-50">
                            {verifying === d.id ? <FaSpinner className="animate-spin" /> : <FaSync />} Verificar
                          </button>
                        )}
                        <button onClick={() => handleDelete(d.id, d.domain)} className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 rounded-lg font-bold text-sm flex items-center gap-2">
                          <FaTrash /> Excluir
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
