import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { FaGlobe, FaArrowLeft, FaPlus, FaTrash, FaSync, FaCheckCircle, FaSpinner, FaCopy, FaTimes, FaClock, FaWifi } from 'react-icons/fa';
import api from '@/services/api';
import { useNotification } from '@/hooks/useNotification';
import { useConfirm } from '@/hooks/useConfirm';

interface Domain { id: number; domain: string; status: string; dns_records: any; created_at: string; updated_at: string; verified_at: string | null; }

const STATUS = {
  active: { label: '✅ Verificado', color: 'text-green-300 bg-green-500/10 border-green-500/30' },
  pending: { label: '⏳ Pendente', color: 'text-yellow-300 bg-yellow-500/10 border-yellow-500/30' },
  unverified: { label: '⚠️ Não verificado', color: 'text-orange-300 bg-orange-500/10 border-orange-500/30' },
  failed: { label: '❌ Falhou', color: 'text-red-300 bg-red-500/10 border-red-500/30' },
};

const POLL_INTERVAL = 30; // segundos entre cada rodada de verificação automática

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

  // Estado do polling de fundo (independente do modal)
  const [bgChecking, setBgChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(POLL_INTERVAL);

  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const domainsRef = useRef<Domain[]>([]);
  domainsRef.current = domains;

  useEffect(() => {
    loadDomains();
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, []);

  // Sempre que a lista de domínios mudar, reinicia o polling se houver domínios pendentes
  useEffect(() => {
    const hasPending = domains.some(d => d.status !== 'active');
    if (hasPending) {
      startBackgroundPolling();
    } else {
      stopBackgroundPolling();
    }
  }, [domains]);

  const stopBackgroundPolling = () => {
    if (pollTimerRef.current) { clearTimeout(pollTimerRef.current); pollTimerRef.current = null; }
    if (countdownTimerRef.current) { clearInterval(countdownTimerRef.current); countdownTimerRef.current = null; }
    setBgChecking(false);
  };

  const startBackgroundPolling = () => {
    // Não duplica se já há timer rodando
    if (pollTimerRef.current) return;
    setCountdown(POLL_INTERVAL);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    countdownTimerRef.current = setInterval(() => {
      setCountdown(prev => (prev <= 1 ? POLL_INTERVAL : prev - 1));
    }, 1000);
    pollTimerRef.current = setTimeout(() => {
      pollTimerRef.current = null;
      runBackgroundCheck();
    }, POLL_INTERVAL * 1000);
  };

  const runBackgroundCheck = async () => {
    const pending = domainsRef.current.filter(d => d.status !== 'active');
    if (pending.length === 0) return;
    setBgChecking(true);
    let anyVerified = false;
    for (const d of pending) {
      try {
        const r = await api.post(`/email-marketing/domains/${d.id}/verify`);
        if (r.data.verified) {
          anyVerified = true;
          notification.success('Domínio verificado!', `${d.domain} foi verificado com sucesso!`);
          // Atualiza também o modal se estiver aberto para esse domínio
          setShowDns(prev => prev?.id === d.id ? { ...prev, status: 'active' } : prev);
        }
      } catch { /* silencioso */ }
    }
    setLastChecked(new Date());
    setCountdown(POLL_INTERVAL);
    setBgChecking(false);
    if (anyVerified) {
      await loadDomains();
    } else {
      // Agenda próxima rodada
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = setInterval(() => {
        setCountdown(prev => (prev <= 1 ? POLL_INTERVAL : prev - 1));
      }, 1000);
      pollTimerRef.current = setTimeout(() => {
        pollTimerRef.current = null;
        runBackgroundCheck();
      }, POLL_INTERVAL * 1000);
    }
  };

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
      notification.success('Domínio adicionado!', 'Configure os DNS — o sistema verificará automaticamente em segundo plano.');
      setShowAdd(false);
      setNewDomain('');
      await loadDomains();
      if (r.data.data) setShowDns(r.data.data);
    } catch (error: any) {
      notification.error('Erro', error.response?.data?.message || error.message);
    } finally { setAdding(false); }
  };

  const handleVerify = async (id: number) => {
    setVerifying(id);
    try {
      const r = await api.post(`/email-marketing/domains/${id}/verify`);
      setLastChecked(new Date());
      if (r.data.verified) {
        notification.success('Domínio verificado!', 'Verificação concluída com sucesso!');
        setShowDns(prev => prev?.id === id ? { ...prev, status: 'active' } : prev);
        await loadDomains();
      } else {
        notification.warning('DNS não propagado ainda', 'Os registros ainda não propagaram. O sistema continua verificando em segundo plano.');
      }
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

  const formatTime = (date: Date) =>
    date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const formatDateTime = (isoStr: string) => {
    const d = new Date(isoStr);
    return d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
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
              <p className="text-xs text-gray-500 mt-2">Recomendado: use um subdomínio dedicado, como <code className="bg-white/10 px-1 rounded">mail.seudominio.com</code></p>
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

            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-black text-white">🔧 Registros DNS para {showDns.domain}</h2>
              <button onClick={() => setShowDns(null)} className="p-2 hover:bg-white/10 rounded-lg text-gray-400" title="Fechar — a verificação continua em segundo plano"><FaTimes /></button>
            </div>

            {/* Banner de verificado */}
            {showDns.status === 'active' ? (
              <div className="bg-green-500/20 border border-green-500/40 rounded-xl p-4 mb-4 flex items-center gap-3">
                <FaCheckCircle className="text-green-400 text-2xl flex-shrink-0" />
                <div>
                  <p className="text-green-300 font-bold text-lg">Domínio verificado com sucesso!</p>
                  <p className="text-green-400/70 text-sm">
                    {showDns.verified_at
                      ? <>Verificado em <strong>{formatDateTime(showDns.verified_at)}</strong></>
                      : 'Todos os registros DNS foram propagados e validados pelo Mailgun.'}
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-4 text-sm text-yellow-300">
                  Configure esses registros no painel DNS do seu domínio (Cloudflare, Registro.br, etc.). O sistema verifica automaticamente a cada <strong>{POLL_INTERVAL} segundos em segundo plano</strong> — você pode fechar este modal.
                </div>

                {/* Barra de status em segundo plano */}
                <div className="bg-black/40 border border-white/10 rounded-xl p-3 mb-4 flex items-center gap-3 flex-wrap">
                  {bgChecking ? (
                    <FaSpinner className="text-blue-400 animate-spin flex-shrink-0" />
                  ) : (
                    <FaWifi className={`flex-shrink-0 ${countdown <= 5 ? 'text-yellow-400 animate-pulse' : 'text-green-400'}`} />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-bold">
                      {bgChecking ? 'Verificando em segundo plano...' : `Próxima verificação automática em ${countdown}s`}
                    </p>
                    {lastChecked ? (
                      <p className="text-gray-400 text-xs flex items-center gap-1">
                        <FaClock className="text-xs" /> Última consulta: <strong className="text-gray-300">{formatTime(lastChecked)}</strong>
                      </p>
                    ) : (
                      <p className="text-gray-500 text-xs">Aguardando primeira verificação automática...</p>
                    )}
                  </div>
                  <div className="w-full">
                    <div className="bg-white/10 rounded-full h-1 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-1000 bg-gradient-to-r from-blue-500 to-green-500"
                        style={{ width: `${((POLL_INTERVAL - countdown) / POLL_INTERVAL) * 100}%` }} />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Lista de registros DNS */}
            {showDns.dns_records && Array.isArray(showDns.dns_records) && showDns.dns_records.length > 0 ? (
              <div className="space-y-3">
                {showDns.dns_records.map((rec: any, i: number) => {
                  const type = (rec.record_type || rec.type || '').toUpperCase();
                  // MX não tem "name" na API do Mailgun — o host é o próprio domínio
                  const recName = rec.name || (type === 'MX' ? showDns.domain : '');
                  return (
                    <div key={i} className="bg-black/30 rounded-lg p-4 border border-white/10">
                      {/* Cabeçalho: tipo + prioridade + status */}
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <span className="px-2 py-0.5 bg-white/10 rounded text-xs font-bold text-white uppercase">{type}</span>
                        {rec.priority && (
                          <span className="px-2 py-0.5 bg-blue-500/20 border border-blue-500/30 rounded text-xs font-bold text-blue-300">
                            Prioridade: {rec.priority}
                          </span>
                        )}
                        {/* Status real de cada registro vindo do Mailgun */}
                        <span className={`px-2 py-0.5 rounded text-xs font-bold border ${rec.valid === 'valid' ? 'bg-green-500/20 border-green-500/30 text-green-300' : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300'}`}>
                          {rec.valid === 'valid' ? '✅ Verificado' : '⏳ Aguardando propagação'}
                        </span>
                      </div>

                      <div className="grid gap-2 text-sm">
                        {/* Nome/Host — sempre exibe, usa domínio como fallback para MX */}
                        <div className="flex items-start gap-2">
                          <span className="text-gray-500 w-20 flex-shrink-0 pt-0.5">Host (nome):</span>
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <code className="text-green-300 break-all">{recName || '@ (raiz do domínio)'}</code>
                            {recName && (
                              <button onClick={() => copyToClipboard(recName)} className="flex-shrink-0 p-1 hover:bg-white/10 rounded text-gray-500" title="Copiar"><FaCopy /></button>
                            )}
                          </div>
                        </div>
                        {/* Valor */}
                        <div className="flex items-start gap-2">
                          <span className="text-gray-500 w-20 flex-shrink-0 pt-0.5">Valor:</span>
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <code className="text-blue-300 break-all text-xs">{rec.value}</code>
                            <button onClick={() => copyToClipboard(rec.value)} className="flex-shrink-0 p-1 hover:bg-white/10 rounded text-gray-500" title="Copiar"><FaCopy /></button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-gray-400 text-center py-4">Nenhum registro DNS disponível.</p>
            )}

            {/* Botão Verificar Agora */}
            {showDns.status !== 'active' && (
              <button
                onClick={() => handleVerify(showDns.id)}
                disabled={verifying === showDns.id || bgChecking}
                className="w-full mt-6 py-3 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all"
              >
                {verifying === showDns.id || bgChecking
                  ? <><FaSpinner className="animate-spin" /> Verificando...</>
                  : <><FaSync /> Verificar Agora</>
                }
              </button>
            )}

            {showDns.status === 'active' && (
              <button onClick={() => setShowDns(null)} className="w-full mt-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold flex items-center justify-center gap-2">
                <FaCheckCircle /> Fechar
              </button>
            )}
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

          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mb-4 text-sm text-blue-300">
            <strong>ℹ️ Como funciona:</strong> Ao adicionar um domínio, o sistema cria ele no Mailgun e exibe os registros DNS para configurar. Após configurar no seu provedor, o sistema verifica automaticamente a cada {POLL_INTERVAL} segundos — mesmo com o modal fechado.
          </div>

          {/* Indicador de verificação em segundo plano */}
          {domains.some(d => d.status !== 'active') && (
            <div className="bg-black/30 border border-white/10 rounded-xl px-4 py-3 mb-6 flex items-center gap-3 flex-wrap">
              {bgChecking ? (
                <FaSpinner className="text-blue-400 animate-spin flex-shrink-0" />
              ) : (
                <FaWifi className={`flex-shrink-0 ${countdown <= 5 ? 'text-yellow-400 animate-pulse' : 'text-green-400'}`} />
              )}
              <div className="flex-1">
                <p className="text-white text-sm font-semibold">
                  {bgChecking ? 'Verificando DNS dos domínios pendentes...' : `Verificação automática em segundo plano — próxima em ${countdown}s`}
                </p>
                {lastChecked && (
                  <p className="text-gray-400 text-xs flex items-center gap-1 mt-0.5">
                    <FaClock className="text-xs" /> Última verificação: <strong className="text-gray-300">{formatTime(lastChecked)}</strong>
                  </p>
                )}
              </div>
              <div className="w-full">
                <div className="bg-white/10 rounded-full h-1 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-1000 bg-gradient-to-r from-blue-500 to-green-400"
                    style={{ width: `${((POLL_INTERVAL - countdown) / POLL_INTERVAL) * 100}%` }} />
                </div>
              </div>
            </div>
          )}

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
                          <p className="text-gray-500 text-xs mt-1 flex items-center gap-1">
                            <FaClock className="text-xs" /> Criado em: <strong className="text-gray-400">{formatDateTime(d.created_at)}</strong>
                          </p>
                          {d.status === 'active' && d.verified_at && (
                            <p className="text-green-500 text-xs mt-0.5 flex items-center gap-1">
                              <FaCheckCircle className="text-xs" /> Verificado em: <strong className="text-green-400">{formatDateTime(d.verified_at)}</strong>
                            </p>
                          )}
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
