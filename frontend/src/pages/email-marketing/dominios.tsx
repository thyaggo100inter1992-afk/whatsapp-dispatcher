import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { FaGlobe, FaArrowLeft, FaPlus, FaTrash, FaSync, FaCheckCircle, FaSpinner, FaCopy, FaTimes, FaClock, FaWifi, FaExclamationTriangle } from 'react-icons/fa';
import api from '@/services/api';
import { useNotification } from '@/hooks/useNotification';
import { useConfirm } from '@/hooks/useConfirm';

interface Domain { id: number; domain: string; status: string; dns_records: any; created_at: string; updated_at: string; verified_at: string | null; }

const STATUS = {
  active:         { label: '✅ Verificado',      color: 'text-green-300 bg-green-500/10 border-green-500/30' },
  active_partial: { label: '📤 Ativo (parcial)', color: 'text-blue-300 bg-blue-500/10 border-blue-500/30' },
  pending:        { label: '⏳ Pendente',         color: 'text-yellow-300 bg-yellow-500/10 border-yellow-500/30' },
  unverified:     { label: '⚠️ Não verificado',  color: 'text-orange-300 bg-orange-500/10 border-orange-500/30' },
  failed:         { label: '❌ Falhou',           color: 'text-red-300 bg-red-500/10 border-red-500/30' },
};

const POLL_INTERVAL = 30;

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

  const domainHasPendingRecords = (d: Domain) => {
    if (d.status !== 'active' && d.status !== 'active_partial') return true;
    if (!Array.isArray(d.dns_records) || d.dns_records.length === 0) return true;
    return d.dns_records.some((r: any) => r.valid !== 'valid');
  };

  useEffect(() => {
    const hasPending = domains.some(d => domainHasPendingRecords(d));
    if (hasPending) startBackgroundPolling();
    else stopBackgroundPolling();
  }, [domains]);

  const stopBackgroundPolling = () => {
    if (pollTimerRef.current) { clearTimeout(pollTimerRef.current); pollTimerRef.current = null; }
    if (countdownTimerRef.current) { clearInterval(countdownTimerRef.current); countdownTimerRef.current = null; }
    setBgChecking(false);
  };

  const startBackgroundPolling = () => {
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
    const pending = domainsRef.current.filter(d => domainHasPendingRecords(d));
    if (pending.length === 0) return;
    setBgChecking(true);
    for (const d of pending) {
      try {
        const r = await api.post(`/email-marketing/domains/${d.id}/verify`);
        if (r.data.data) setShowDns(prev => prev?.id === d.id ? r.data.data : prev);
        if (r.data.allVerified) notification.success('Domínio totalmente verificado!', `Todos os registros DNS de ${d.domain} foram verificados!`);
        else if (r.data.verified && !r.data.allVerified) notification.info('Domínio ativo para envio', `${d.domain} está ativo mas ainda há registros pendentes.`);
      } catch { /* silencioso */ }
    }
    setLastChecked(new Date());
    setCountdown(POLL_INTERVAL);
    setBgChecking(false);
    await loadDomains();
  };

  const loadDomains = async () => {
    try { const r = await api.get('/email-marketing/domains'); setDomains(r.data.data || []); }
    catch { } finally { setLoading(false); }
  };

  const handleAdd = async () => {
    if (!newDomain) { notification.warning('Campo obrigatório', 'Informe o domínio.'); return; }
    setAdding(true);
    try {
      const r = await api.post('/email-marketing/domains', { domain: newDomain });
      notification.success('Domínio adicionado!', 'Configure os DNS — o sistema verificará automaticamente em segundo plano.');
      setShowAdd(false); setNewDomain('');
      await loadDomains();
      if (r.data.data) setShowDns(r.data.data);
    } catch (e: any) { notification.error('Erro', e.response?.data?.message || e.message); }
    finally { setAdding(false); }
  };

  const handleVerify = async (id: number) => {
    setVerifying(id);
    try {
      const r = await api.post(`/email-marketing/domains/${id}/verify`);
      setLastChecked(new Date());
      if (r.data.data) setShowDns(prev => prev?.id === id ? r.data.data : prev);
      if (r.data.verified) {
        notification.success(
          r.data.allVerified ? 'Domínio totalmente verificado!' : 'Domínio pronto para envio!',
          r.data.message || (r.data.mailgunActive
            ? 'Mailgun confirmou o domínio. CNAME de tracking pode ficar pendente.'
            : 'SPF e DKIM OK.')
        );
        await loadDomains();
      } else {
        notification.warning('Ainda não verificado', r.data.message || 'O sistema continua verificando em segundo plano.');
        await loadDomains();
      }
    } catch (e: any) { notification.error('Erro', e.response?.data?.message || e.message); }
    finally { setVerifying(null); }
  };

  const handleRegisterWebhooks = async (id: number) => {
    setVerifying(id);
    try { await api.post(`/email-marketing/domains/${id}/register-webhooks`); notification.success('Webhooks registrados!', 'Rastreamento de aberturas e cliques ativado.'); }
    catch (e: any) { notification.error('Erro', e.response?.data?.message || e.message); }
    finally { setVerifying(null); }
  };

  const handleDelete = async (id: number, domain: string) => {
    const ok = await confirm({ title: 'Excluir Domínio', message: `Remover "${domain}"?`, confirmText: 'Sim, Excluir', type: 'danger' });
    if (!ok) return;
    try { await api.delete(`/email-marketing/domains/${id}`); notification.success('Domínio removido', ''); loadDomains(); }
    catch (e: any) { notification.error('Erro', e.response?.data?.message || e.message); }
  };

  const copyToClipboard = (text: string) => { navigator.clipboard.writeText(text); notification.success('Copiado!', ''); };

  const formatTime = (date: Date) => date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const formatDateTime = (isoStr: string) => {
    const d = new Date(isoStr);
    return d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const inputCls = 'w-full px-6 py-4 text-base bg-dark-700/80 backdrop-blur-md border-2 border-white/20 rounded-xl text-white placeholder-white/40 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/30 transition-all';

  return (
    <>
      <Head><title>Domínios | E-mail Marketing</title></Head>
      <notification.NotificationContainer />
      <ConfirmDialog />

      {/* Modal Adicionar */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border-2 border-teal-500/40 rounded-2xl p-8 max-w-md w-full space-y-5 shadow-2xl shadow-teal-500/20">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black text-white flex items-center gap-3">
                <span className="bg-gradient-to-br from-teal-500 to-teal-600 text-white font-black w-10 h-10 rounded-xl flex items-center justify-center shadow-lg">+</span>
                Adicionar Domínio
              </h2>
              <button onClick={() => setShowAdd(false)} className="p-2 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-all"><FaTimes className="text-xl" /></button>
            </div>
            <div>
              <label className="block text-base font-bold mb-3 text-white/90">Domínio de Envio *</label>
              <input type="text" value={newDomain} onChange={e => setNewDomain(e.target.value)}
                placeholder="Ex: envios.seudominio.com"
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                className={inputCls} />
              <p className="text-sm text-white/50 mt-2">
                Recomendado: use um subdomínio dedicado como <code className="bg-white/10 px-1 rounded">mail.seudominio.com</code>
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={handleAdd} disabled={adding}
                className="flex-1 py-4 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white rounded-xl font-black flex items-center justify-center gap-2 disabled:opacity-50 shadow-xl shadow-teal-500/30 transition-all">
                {adding ? <FaSpinner className="animate-spin" /> : <FaCheckCircle />} Adicionar
              </button>
              <button onClick={() => setShowAdd(false)} className="px-8 py-4 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition-all">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal DNS */}
      {showDns && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-dark-800 border-2 border-yellow-500/40 rounded-2xl p-8 max-w-3xl w-full my-4 shadow-2xl shadow-yellow-500/10">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-black text-white">🔧 Registros DNS — {showDns.domain}</h2>
              <button onClick={() => setShowDns(null)} className="p-2 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-all" title="Fechar — verificação continua em segundo plano"><FaTimes className="text-xl" /></button>
            </div>

            {/* Banner status */}
            {showDns.status === 'active' && showDns.dns_records && Array.isArray(showDns.dns_records) && showDns.dns_records.every((r: any) => r.valid === 'valid') ? (
              <div className="bg-green-500/20 border border-green-500/40 rounded-xl p-4 mb-5 flex items-center gap-3">
                <FaCheckCircle className="text-green-400 text-2xl flex-shrink-0" />
                <div>
                  <p className="text-green-300 font-bold text-lg">Todos os registros verificados!</p>
                  <p className="text-green-400/70 text-sm">{showDns.verified_at ? <>Verificado em <strong>{formatDateTime(showDns.verified_at)}</strong></> : 'Todos os registros DNS foram propagados com sucesso.'}</p>
                </div>
              </div>
            ) : showDns.status === 'active' ? (
              <div className="bg-blue-500/20 border border-blue-500/40 rounded-xl p-4 mb-5 flex items-center gap-3">
                <FaCheckCircle className="text-blue-400 text-2xl flex-shrink-0" />
                <div>
                  <p className="text-blue-300 font-bold text-lg">Domínio ativo para envio!</p>
                  <p className="text-blue-400/70 text-sm">Os registros essenciais (SPF e DKIM) estão verificados. Configure os demais para habilitar rastreamento completo.</p>
                </div>
              </div>
            ) : (
              <>
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-4 text-sm text-yellow-300">
                  Configure esses registros no painel DNS do seu domínio (Cloudflare, Registro.br, etc.). O sistema verifica automaticamente a cada <strong>{POLL_INTERVAL} segundos em segundo plano</strong> — você pode fechar este modal.
                </div>
                <div className="bg-black/40 border border-white/10 rounded-xl p-3 mb-4 flex items-center gap-3 flex-wrap">
                  {bgChecking ? <FaSpinner className="text-blue-400 animate-spin flex-shrink-0" /> : <FaWifi className={`flex-shrink-0 ${countdown <= 5 ? 'text-yellow-400 animate-pulse' : 'text-green-400'}`} />}
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-bold">{bgChecking ? 'Verificando em segundo plano...' : `Próxima verificação automática em ${countdown}s`}</p>
                    {lastChecked ? (
                      <p className="text-gray-400 text-xs flex items-center gap-1"><FaClock className="text-xs" /> Última consulta: <strong className="text-gray-300">{formatTime(lastChecked)}</strong></p>
                    ) : (
                      <p className="text-gray-500 text-xs">Aguardando primeira verificação automática...</p>
                    )}
                  </div>
                  <div className="w-full">
                    <div className="bg-white/10 rounded-full h-1 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-1000 bg-gradient-to-r from-blue-500 to-green-500" style={{ width: `${((POLL_INTERVAL - countdown) / POLL_INTERVAL) * 100}%` }} />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Registros DNS */}
            {showDns.dns_records && Array.isArray(showDns.dns_records) && showDns.dns_records.length > 0 ? (
              <div className="space-y-3">
                {showDns.dns_records.map((rec: any, i: number) => {
                  const type = (rec.record_type || rec.type || '').toUpperCase();
                  const isDmarc = !!(rec._is_dmarc || (rec.name || '').startsWith('_dmarc.'));
                  const recName = rec.name || (type === 'MX' ? showDns.domain : '');
                  return (
                    <div key={i} className={`rounded-xl p-4 border ${isDmarc ? 'bg-purple-900/20 border-purple-500/30' : 'bg-black/30 border-white/10'}`}>
                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold text-white uppercase ${isDmarc ? 'bg-purple-500/40' : 'bg-white/10'}`}>{type}</span>
                        {isDmarc && <span className="px-2 py-0.5 bg-purple-500/20 border border-purple-500/40 rounded text-xs font-bold text-purple-300">🛡️ DMARC — Recomendado contra spam</span>}
                        {rec.priority && <span className="px-2 py-0.5 bg-blue-500/20 border border-blue-500/30 rounded text-xs font-bold text-blue-300">Prioridade: {rec.priority}</span>}
                        <span className={`px-2 py-0.5 rounded text-xs font-bold border ${rec.valid === 'valid' ? 'bg-green-500/20 border-green-500/30 text-green-300' : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300'}`}>
                          {rec.valid === 'valid' ? '✅ Verificado' : '⏳ Aguardando'}
                        </span>
                      </div>
                      {isDmarc && rec.valid !== 'valid' && (
                        <div className="mb-3 p-2 bg-purple-500/10 border border-purple-500/20 rounded-lg text-xs text-purple-300">
                          ⚠️ <strong>Adicione este registro no DNS</strong> para melhorar drasticamente a entregabilidade e evitar que e-mails caiam no spam.
                        </div>
                      )}
                      <div className="grid gap-2 text-sm">
                        <div className="flex items-start gap-2">
                          <span className="text-gray-500 w-24 flex-shrink-0 pt-0.5">Host (nome):</span>
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <code className="text-green-300 break-all">{recName || '@ (raiz do domínio)'}</code>
                            {recName && <button onClick={() => copyToClipboard(recName)} className="flex-shrink-0 p-1 hover:bg-white/10 rounded text-gray-500 hover:text-gray-300" title="Copiar"><FaCopy /></button>}
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-gray-500 w-24 flex-shrink-0 pt-0.5">Valor:</span>
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <code className="text-blue-300 break-all text-xs">{rec.value}</code>
                            <button onClick={() => copyToClipboard(rec.value)} className="flex-shrink-0 p-1 hover:bg-white/10 rounded text-gray-500 hover:text-gray-300" title="Copiar"><FaCopy /></button>
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

            {/* Webhook URL */}
            {(() => {
              const apiBase = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/api\/?$/, '');
              const provider = showDns.provider || 'mailgun';
              const webhookPath = provider === 'sendgrid' ? '/api/webhook/sendgrid' : '/api/webhook/mailgun';
              const webhookUrl = `${apiBase}${webhookPath}`;
              return (
                <div className="mt-5 bg-indigo-900/20 border border-indigo-500/30 rounded-xl p-4">
                  <p className="text-indigo-300 font-bold text-sm mb-1 flex items-center gap-2">🔗 URL de Rastreamento (Webhook)</p>
                  <p className="text-gray-400 text-xs mb-3">
                    Provedor: <strong className="text-gray-300">{provider === 'sendgrid' ? 'SendGrid' : 'Mailgun'}</strong>.
                    Configure esta URL na seção <strong className="text-gray-300">Webhooks</strong> para rastrear aberturas, cliques e devoluções.
                  </p>
                  <div className="flex items-center gap-2 bg-black/40 rounded-lg px-3 py-2 border border-white/10">
                    <code className="text-indigo-300 text-xs flex-1 break-all">{webhookUrl}</code>
                    <button onClick={() => copyToClipboard(webhookUrl)} className="flex-shrink-0 px-3 py-1.5 bg-indigo-500/20 hover:bg-indigo-500/40 border border-indigo-500/40 rounded-lg text-indigo-300 text-xs font-bold flex items-center gap-1">
                      <FaCopy className="text-xs" /> Copiar
                    </button>
                  </div>
                  <p className="text-gray-500 text-xs mt-2">Eventos: entrega, abertura, clique, rejeição, spam, cancelamento.</p>
                </div>
              );
            })()}

            {/* Botão fechar ou verificar */}
            {(() => {
              const allOk = showDns.dns_records && Array.isArray(showDns.dns_records) && showDns.dns_records.every((r: any) => r.valid === 'valid');
              return allOk ? (
                <button onClick={() => setShowDns(null)} className="w-full mt-6 py-4 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl font-black text-lg flex items-center justify-center gap-2 transition-all shadow-xl shadow-green-500/30">
                  <FaCheckCircle /> Fechar
                </button>
              ) : (
                <button onClick={() => handleVerify(showDns.id)} disabled={verifying === showDns.id || bgChecking}
                  className="w-full mt-6 py-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 text-white rounded-xl font-black text-lg flex items-center justify-center gap-2 transition-all shadow-xl">
                  {verifying === showDns.id || bgChecking ? <><FaSpinner className="animate-spin" /> Verificando...</> : <><FaSync /> Verificar Agora</>}
                </button>
              );
            })()}
          </div>
        </div>
      )}

      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 py-8 px-4">
        <div className="max-w-7xl mx-auto space-y-8">

          {/* HEADER */}
          <div className="relative overflow-hidden bg-gradient-to-r from-teal-600/30 via-teal-500/20 to-teal-600/30 backdrop-blur-xl border-2 border-teal-500/40 rounded-3xl p-10 shadow-2xl shadow-teal-500/20">
            <div className="absolute inset-0 bg-grid-white/[0.02]"></div>
            <div className="relative">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-6">
                  <button onClick={() => router.push('/email-marketing')} className="p-3 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all">
                    <FaArrowLeft className="text-xl" />
                  </button>
                  <div className="bg-gradient-to-br from-teal-500 to-teal-600 p-6 rounded-2xl shadow-lg shadow-teal-500/50">
                    <FaGlobe className="text-5xl text-white" />
                  </div>
                  <div>
                    <h1 className="text-5xl font-black text-white mb-2 tracking-tight">Domínios de Envio</h1>
                    <p className="text-xl text-white/80 font-medium">{domains.length} domínio{domains.length !== 1 ? 's' : ''} cadastrado{domains.length !== 1 ? 's' : ''}</p>
                  </div>
                </div>
                <button onClick={() => setShowAdd(true)}
                  className="px-8 py-4 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white rounded-2xl font-black text-lg transition-all flex items-center gap-3 shadow-xl shadow-teal-500/30 hover:scale-105">
                  <FaPlus /> Adicionar Domínio
                </button>
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="bg-blue-500/10 border-2 border-blue-500/30 rounded-2xl p-5 text-sm text-blue-300 flex items-start gap-4">
            <FaExclamationTriangle className="text-blue-400 text-xl flex-shrink-0 mt-0.5" />
            <div>
              <strong>ℹ️ Como funciona:</strong> Ao adicionar um domínio, o sistema exibe os registros DNS para configurar. Após configurar no seu provedor, o sistema verifica automaticamente a cada {POLL_INTERVAL} segundos — mesmo com o modal fechado.
            </div>
          </div>

          {/* Polling background indicator */}
          {domains.some(d => domainHasPendingRecords(d)) && (
            <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-white/10 rounded-2xl px-6 py-4 flex items-center gap-4 flex-wrap">
              {bgChecking ? <FaSpinner className="text-blue-400 animate-spin flex-shrink-0 text-xl" /> : <FaWifi className={`flex-shrink-0 text-xl ${countdown <= 5 ? 'text-yellow-400 animate-pulse' : 'text-green-400'}`} />}
              <div className="flex-1">
                <p className="text-white font-semibold">{bgChecking ? 'Verificando DNS dos domínios pendentes...' : `Verificação automática em segundo plano — próxima em ${countdown}s`}</p>
                {lastChecked && <p className="text-gray-400 text-sm flex items-center gap-1 mt-0.5"><FaClock className="text-xs" /> Última verificação: <strong className="text-gray-300">{formatTime(lastChecked)}</strong></p>}
              </div>
              <div className="w-full">
                <div className="bg-white/10 rounded-full h-2 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-1000 bg-gradient-to-r from-blue-500 to-green-400" style={{ width: `${((POLL_INTERVAL - countdown) / POLL_INTERVAL) * 100}%` }} />
                </div>
              </div>
            </div>
          )}

          {/* Lista */}
          {loading ? (
            <div className="flex justify-center py-20"><FaSpinner className="text-5xl text-teal-400 animate-spin" /></div>
          ) : domains.length === 0 ? (
            <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-teal-500/20 rounded-2xl p-16 text-center">
              <div className="bg-teal-500/10 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
                <FaGlobe className="text-5xl text-teal-400" />
              </div>
              <h3 className="text-2xl font-black text-white mb-3">Nenhum domínio configurado</h3>
              <p className="text-gray-400 mb-6">Adicione um domínio para começar a enviar e-mails</p>
              <button onClick={() => setShowAdd(true)} className="px-8 py-4 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-2xl font-black text-lg inline-flex items-center gap-3 shadow-xl">
                <FaPlus /> Adicionar Primeiro Domínio
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {domains.map(d => {
                const allRecordsOk = Array.isArray(d.dns_records) && d.dns_records.length > 0 && d.dns_records.every((r: any) => r.valid === 'valid');
                const effectiveStatus = d.status === 'active' && !allRecordsOk ? 'active_partial' : d.status;
                const st = STATUS[effectiveStatus as keyof typeof STATUS] || STATUS.pending;
                return (
                  <div key={d.id} className="bg-dark-800/60 backdrop-blur-xl border-2 border-teal-500/20 hover:border-teal-500/40 rounded-2xl p-6 shadow-xl transition-all duration-300">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div className="flex items-center gap-4">
                        <div className="p-4 bg-teal-500/20 rounded-xl">
                          <FaGlobe className="text-2xl text-teal-400" />
                        </div>
                        <div>
                          <h3 className="text-2xl font-black text-white">{d.domain}</h3>
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold border mt-1 ${st.color}`}>{st.label}</span>
                          <p className="text-gray-500 text-xs mt-1.5 flex items-center gap-1">
                            <FaClock className="text-xs" /> Criado em: <strong className="text-gray-400">{formatDateTime(d.created_at)}</strong>
                          </p>
                          {allRecordsOk && d.verified_at && (
                            <p className="text-green-400 text-xs mt-0.5 flex items-center gap-1">
                              <FaCheckCircle className="text-xs" /> Todos verificados em: <strong>{formatDateTime(d.verified_at)}</strong>
                            </p>
                          )}
                          {!allRecordsOk && d.status === 'active' && (
                            <p className="text-blue-400 text-xs mt-0.5 flex items-center gap-1">
                              <FaSync className="text-xs" /> Ativo para envio — alguns registros pendentes
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2 flex-wrap">
                        {d.dns_records && (
                          <button onClick={() => setShowDns(d)} className="px-4 py-2.5 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border border-yellow-500/40 rounded-xl font-bold text-sm flex items-center gap-2 transition-all">
                            🔧 Ver DNS
                          </button>
                        )}
                        {domainHasPendingRecords(d) && (
                          <button onClick={() => handleVerify(d.id)} disabled={verifying === d.id}
                            className="px-4 py-2.5 bg-green-500/20 hover:bg-green-500/30 text-green-300 border border-green-500/40 rounded-xl font-bold text-sm flex items-center gap-2 disabled:opacity-50 transition-all">
                            {verifying === d.id ? <FaSpinner className="animate-spin" /> : <FaSync />} Verificar
                          </button>
                        )}
                        {(d.status === 'active' || d.status === 'active_partial') && (
                          <button onClick={() => handleRegisterWebhooks(d.id)} disabled={verifying === d.id}
                            title="Ativar rastreamento de aberturas e cliques"
                            className="px-4 py-2.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 rounded-xl font-bold text-sm flex items-center gap-2 disabled:opacity-50 transition-all">
                            {verifying === d.id ? <FaSpinner className="animate-spin" /> : '📡'} Rastreamento
                          </button>
                        )}
                        <button onClick={() => handleDelete(d.id, d.domain)} className="px-4 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 rounded-xl font-bold text-sm flex items-center gap-2 transition-all">
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
