import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { FaPaperPlane, FaArrowLeft, FaCheckCircle, FaSpinner, FaEnvelope, FaUser, FaExclamationTriangle } from 'react-icons/fa';
import api from '@/services/api';
import { useNotification } from '@/hooks/useNotification';

interface Domain { id: number; domain: string; status: string; }

export default function EnvioUnico() {
  const router = useRouter();
  const notification = useNotification();
  const [sending, setSending] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [form, setForm] = useState({
    to_email: '', to_name: '', from_name: '', from_email: '',
    reply_to: '', subject: '', body_html: '', domain_id: '',
  });

  useEffect(() => {
    api.get('/email-marketing/domains').then(r => {
      setDomains((r.data.data || []).filter((d: Domain) => d.status === 'active'));
    }).catch(() => {});
  }, []);

  const handleSend = async () => {
    const errs: string[] = [];
    if (!form.to_email) errs.push('Informe o e-mail do destinatário.');
    if (!form.from_email) errs.push('Informe o e-mail do remetente.');
    if (!form.subject) errs.push('Informe o assunto.');
    if (!form.body_html) errs.push('Informe o corpo do e-mail (HTML).');
    if (errs.length > 0) { setErrors(errs); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    setErrors([]);
    setSending(true);
    try {
      await api.post('/email-marketing/send-single', { ...form, domain_id: form.domain_id || undefined });
      notification.success('E-mail enviado!', `Enviado com sucesso para ${form.to_email}`);
      setForm({ to_email: '', to_name: '', from_name: '', from_email: '', reply_to: '', subject: '', body_html: '', domain_id: '' });
    } catch (error: any) {
      setErrors([error.response?.data?.message || error.message]);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally { setSending(false); }
  };

  const inputCls = 'w-full px-6 py-4 text-base bg-dark-700/80 backdrop-blur-md border-2 border-white/20 rounded-xl text-white placeholder-white/40 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/30 transition-all duration-200';
  const labelCls = 'block text-base font-bold mb-3 text-white/90';
  const sectionCls = 'bg-dark-800/60 backdrop-blur-xl border-2 border-blue-500/30 rounded-2xl p-8 shadow-xl hover:border-blue-500/50 transition-all duration-300';

  const StepBadge = ({ n }: { n: number }) => (
    <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white text-2xl font-black w-14 h-14 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/50 flex-shrink-0">{n}</div>
  );

  return (
    <>
      <Head><title>Envio Único | E-mail Marketing</title></Head>
      <notification.NotificationContainer />
      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 py-8 px-4">
        <div className="max-w-5xl mx-auto space-y-8">

          {/* HEADER */}
          <div className="relative overflow-hidden bg-gradient-to-r from-blue-600/30 via-blue-500/20 to-blue-600/30 backdrop-blur-xl border-2 border-blue-500/40 rounded-3xl p-10 shadow-2xl shadow-blue-500/20">
            <div className="absolute inset-0 bg-grid-white/[0.02]"></div>
            <div className="relative flex items-center gap-6">
              <button onClick={() => router.push('/email-marketing')} className="p-3 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all">
                <FaArrowLeft className="text-xl" />
              </button>
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-2xl shadow-lg shadow-blue-500/50">
                <FaPaperPlane className="text-5xl text-white" />
              </div>
              <div>
                <h1 className="text-5xl font-black text-white mb-2 tracking-tight">Envio Único</h1>
                <p className="text-xl text-white/80 font-medium">Envie um e-mail avulso para um destinatário específico</p>
              </div>
            </div>
          </div>

          {/* ERROS */}
          {errors.length > 0 && (
            <div className="bg-gradient-to-r from-red-500/20 to-red-600/20 backdrop-blur-xl border-2 border-red-500/50 rounded-2xl p-6 shadow-xl">
              <div className="flex items-start gap-4">
                <div className="bg-red-500/20 p-4 rounded-xl"><FaExclamationTriangle className="text-3xl text-red-400" /></div>
                <div>
                  <h3 className="text-xl font-bold text-red-300 mb-2">Corrija os erros:</h3>
                  <ul className="space-y-1">{errors.map((e, i) => <li key={i} className="flex gap-2 text-red-200"><span className="text-red-400">●</span>{e}</li>)}</ul>
                </div>
              </div>
            </div>
          )}

          {/* 1. DOMÍNIO */}
          <div className={sectionCls}>
            <div className="flex items-center gap-4 mb-6"><StepBadge n={1} /><h2 className="text-3xl font-black text-white">Domínio de Envio</h2></div>
            <label className={labelCls}>Selecione o domínio</label>
            <select value={form.domain_id} onChange={e => setForm({ ...form, domain_id: e.target.value })} className={inputCls}>
              <option value="">Automático (usa o domínio do remetente)</option>
              {domains.map(d => <option key={d.id} value={d.id}>{d.domain}</option>)}
            </select>
            {domains.length === 0 && (
              <p className="text-yellow-400 text-sm mt-3">⚠️ Nenhum domínio ativo.{' '}
                <span className="underline cursor-pointer" onClick={() => router.push('/email-marketing/dominios')}>Configurar domínio</span>
              </p>
            )}
          </div>

          {/* 2. REMETENTE */}
          <div className={sectionCls}>
            <div className="flex items-center gap-4 mb-6"><StepBadge n={2} /><h2 className="text-3xl font-black text-white">Remetente</h2></div>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className={labelCls}>Nome do Remetente *</label>
                <input type="text" value={form.from_name} onChange={e => setForm({ ...form, from_name: e.target.value })}
                  placeholder="Minha Empresa" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>E-mail Remetente *</label>
                <input type="email" value={form.from_email} onChange={e => setForm({ ...form, from_email: e.target.value })}
                  placeholder="contato@seudominio.com" className={inputCls} />
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>Responder Para (Reply-To)</label>
                <input type="email" value={form.reply_to} onChange={e => setForm({ ...form, reply_to: e.target.value })}
                  placeholder="respostas@seudominio.com" className={inputCls} />
              </div>
            </div>
          </div>

          {/* 3. DESTINATÁRIO */}
          <div className={sectionCls}>
            <div className="flex items-center gap-4 mb-6"><StepBadge n={3} /><h2 className="text-3xl font-black text-white">Destinatário</h2></div>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className={labelCls}>Nome do Destinatário</label>
                <input type="text" value={form.to_name} onChange={e => setForm({ ...form, to_name: e.target.value })}
                  placeholder="João Silva" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>E-mail Destinatário *</label>
                <input type="email" value={form.to_email} onChange={e => setForm({ ...form, to_email: e.target.value })}
                  placeholder="cliente@email.com" className={inputCls} />
              </div>
            </div>
          </div>

          {/* 4. MENSAGEM */}
          <div className={sectionCls}>
            <div className="flex items-center gap-4 mb-6"><StepBadge n={4} /><h2 className="text-3xl font-black text-white">Mensagem</h2></div>
            <div className="space-y-6">
              <div>
                <label className={labelCls}>Assunto *</label>
                <input type="text" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })}
                  placeholder="Assunto do e-mail" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Corpo do E-mail (HTML) *</label>
                <textarea value={form.body_html} onChange={e => setForm({ ...form, body_html: e.target.value })}
                  placeholder="<p>Olá {{nome}},</p><p>Seu conteúdo aqui...</p>"
                  rows={12}
                  className="w-full px-6 py-4 text-base bg-dark-700/80 backdrop-blur-md border-2 border-white/20 rounded-xl text-white placeholder-white/40 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/30 transition-all font-mono resize-y" />
                <p className="text-sm text-white/50 mt-2">
                  Use <code className="bg-white/10 px-1 rounded">{'{{nome}}'}</code> e{' '}
                  <code className="bg-white/10 px-1 rounded">{'{{email}}'}</code> para personalização.
                </p>
              </div>
            </div>
          </div>

          {/* BOTÃO */}
          <button onClick={handleSend} disabled={sending}
            className="w-full py-6 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-2xl font-black text-2xl transition-all flex items-center justify-center gap-4 disabled:opacity-50 shadow-2xl shadow-blue-500/30 hover:shadow-blue-500/50 hover:scale-[1.01]">
            {sending
              ? <><FaSpinner className="animate-spin text-2xl" /> Enviando...</>
              : <><FaPaperPlane className="text-2xl" /> Enviar E-mail</>}
          </button>

        </div>
      </div>
    </>
  );
}
