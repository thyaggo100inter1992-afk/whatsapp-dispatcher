import { useState, useEffect, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { FaPaperPlane, FaArrowLeft, FaSpinner, FaExclamationTriangle } from 'react-icons/fa';
import api from '@/services/api';
import { useNotification } from '@/hooks/useNotification';

const EmailBodyEditor = dynamic(() => import('@/components/EmailBodyEditor'), { ssr: false });

interface Domain { id: number; domain: string; status: string; }

function extractLocalPart(value: string): string {
  const raw = String(value || '').trim();
  const local = (raw.includes('@') ? raw.split('@')[0] : raw)
    .replace(/[^a-zA-Z0-9._+-]/g, '')
    .toLowerCase();
  return local;
}

const EMAIL_VARS = [
  { token: '{{nome}}', tip: 'Nome do destinatário' },
  { token: '{{email}}', tip: 'E-mail do destinatário' },
  { token: '{{cpf}}', tip: 'CPF (cadastro)' },
  { token: '{{telefone}}', tip: 'Telefone (cadastro)' },
  { token: '{{var1}}', tip: 'Var1 (cadastro)' },
  { token: '{{var2}}', tip: 'Var2 (cadastro)' },
  { token: '{{var3}}', tip: 'Var3 (cadastro)' },
  { token: '{{var4}}', tip: 'Var4 (cadastro)' },
  { token: '{{var5}}', tip: 'Var5 (cadastro)' },
  { token: '{{saudacao}}', tip: 'Bom dia / Boa tarde / Boa noite' },
  { token: '{{hora}}', tip: 'Hora atual' },
  { token: '{{data}}', tip: 'Data atual' },
  { token: '{{protocolo}}', tip: 'Protocolo automático' },
] as const;

export default function EnvioUnico() {
  const router = useRouter();
  const notification = useNotification();
  const [sending, setSending] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const subjectInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    to_email: '', to_name: '', from_name: '', from_email: '',
    reply_to: '', subject: '', body_html: '', domain_id: '',
    cpf: '', telefone: '', var1: '', var2: '', var3: '', var4: '', var5: '',
  });

  const insertInSubject = (token: string) => {
    const el = subjectInputRef.current;
    const cur = form.subject || '';
    if (!el) {
      setForm(f => ({ ...f, subject: `${cur}${token}` }));
      return;
    }
    const start = el.selectionStart ?? cur.length;
    const end = el.selectionEnd ?? start;
    const next = `${cur.slice(0, start)}${token}${cur.slice(end)}`;
    setForm(f => ({ ...f, subject: next }));
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  };

  useEffect(() => {
    api.get('/email-marketing/domains').then(r => {
      // Aceita ativos (prontos para envio); mesma regra das campanhas
      setDomains((r.data.data || []).filter((d: Domain) => d.status === 'active'));
    }).catch(() => {});
  }, []);

  const selectedDomain = useMemo(
    () => domains.find(d => String(d.id) === String(form.domain_id))?.domain || '',
    [domains, form.domain_id]
  );

  const fromLocal = extractLocalPart(form.from_email);
  const fromFull = selectedDomain && fromLocal ? `${fromLocal}@${selectedDomain}` : '';

  const handleSend = async () => {
    const errs: string[] = [];
    if (!form.domain_id) errs.push('Selecione um domínio verificado.');
    if (!form.from_name.trim()) errs.push('Informe o nome do remetente.');
    if (!fromLocal) errs.push('Informe o usuário do remetente (parte antes do @).');
    if (!form.to_email) errs.push('Informe o e-mail do destinatário.');
    if (!form.subject) errs.push('Informe o assunto.');
    if (!form.body_html.trim()) errs.push('Informe o corpo do e-mail.');
    if (domains.length === 0) errs.push('Nenhum domínio ativo. Configure e verifique um domínio antes de enviar.');
    if (errs.length > 0) { setErrors(errs); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    setErrors([]);
    setSending(true);
    try {
      await api.post('/email-marketing/send-single', {
        to_email: form.to_email.trim(),
        to_name: form.to_name.trim() || undefined,
        from_name: form.from_name.trim(),
        from_email: fromLocal, // só a parte local — backend monta @domínio
        reply_to: form.reply_to.trim() || undefined,
        subject: form.subject.trim(),
        body_html: form.body_html,
        domain_id: Number(form.domain_id),
        // Cadastro interno (ficha) — NÃO vai no corpo do e-mail a menos que use {{cpf}} etc.
        cpf: form.cpf.trim() || undefined,
        telefone: form.telefone.trim() || undefined,
        var1: form.var1.trim() || undefined,
        var2: form.var2.trim() || undefined,
        var3: form.var3.trim() || undefined,
        var4: form.var4.trim() || undefined,
        var5: form.var5.trim() || undefined,
      });
      notification.success('E-mail enviado!', `Enviado com sucesso para ${form.to_email}`);
      setForm({
        to_email: '', to_name: '', from_name: '', from_email: '', reply_to: '', subject: '', body_html: '',
        domain_id: form.domain_id, cpf: '', telefone: '', var1: '', var2: '', var3: '', var4: '', var5: '',
      });
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

          <div className={sectionCls}>
            <div className="flex items-center gap-4 mb-6"><StepBadge n={1} /><h2 className="text-3xl font-black text-white">Domínio de Envio</h2></div>
            <label className={labelCls}>Domínio verificado *</label>
            <select value={form.domain_id} onChange={e => setForm({ ...form, domain_id: e.target.value })} className={inputCls}>
              <option value="">Selecione o domínio...</option>
              {domains.map(d => <option key={d.id} value={d.id}>{d.domain}</option>)}
            </select>
            {domains.length === 0 ? (
              <p className="text-yellow-400 text-sm mt-3">⚠️ Nenhum domínio ativo.{' '}
                <span className="underline cursor-pointer" onClick={() => router.push('/email-marketing/dominios')}>Configurar domínio</span>
              </p>
            ) : (
              <p className="text-sm text-white/50 mt-3">O remetente será obrigatoriamente <strong className="text-white/80">@domínio selecionado</strong> (igual às campanhas).</p>
            )}
          </div>

          <div className={sectionCls}>
            <div className="flex items-center gap-4 mb-6"><StepBadge n={2} /><h2 className="text-3xl font-black text-white">Remetente</h2></div>
            {!form.domain_id && (
              <div className="mb-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-yellow-200 text-sm flex items-center gap-2">
                <FaExclamationTriangle /> Selecione um domínio na seção 1 antes de informar o remetente.
              </div>
            )}
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className={labelCls}>Nome do Remetente *</label>
                <input type="text" value={form.from_name} onChange={e => setForm({ ...form, from_name: e.target.value })}
                  placeholder="Minha Empresa" className={inputCls} disabled={!form.domain_id} />
              </div>
              <div>
                <label className={labelCls}>Usuário do Remetente * (sem @)</label>
                <div className="flex items-stretch gap-2">
                  <input
                    type="text"
                    value={form.from_email}
                    onChange={e => setForm({ ...form, from_email: extractLocalPart(e.target.value) })}
                    placeholder="contato"
                    className={inputCls}
                    disabled={!form.domain_id}
                  />
                  {selectedDomain && (
                    <span className="px-4 flex items-center bg-dark-700/80 border-2 border-white/20 rounded-xl text-white/80 font-mono whitespace-nowrap">
                      @{selectedDomain}
                    </span>
                  )}
                </div>
                {fromFull && (
                  <p className="text-sm text-green-300 mt-2">✅ Ficará: <strong>{fromFull}</strong></p>
                )}
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>Responder Para (Reply-To)</label>
                <input type="email" value={form.reply_to} onChange={e => setForm({ ...form, reply_to: e.target.value })}
                  placeholder={fromFull || 'respostas@seudominio.com'} className={inputCls} disabled={!form.domain_id} />
              </div>
            </div>
          </div>

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

          <div className={sectionCls}>
            <div className="flex items-center gap-4 mb-2">
              <StepBadge n={4} />
              <div>
                <h2 className="text-3xl font-black text-white">Cadastro do cliente (ficha)</h2>
                <p className="text-white/60 text-sm mt-1">
                  Uso interno. Não vai no e-mail do cliente — só na ficha quando ele responder.
                  Se quiser mostrar algo no e-mail, use {'{{nome}}'}, {'{{cpf}}'} etc. no texto (opcional).
                </p>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-6 mt-6">
              <div>
                <label className={labelCls}>CPF (opcional)</label>
                <input type="text" value={form.cpf} onChange={e => setForm({ ...form, cpf: e.target.value })}
                  placeholder="000.000.000-00" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Telefone (opcional)</label>
                <input type="text" value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })}
                  placeholder="(00) 00000-0000" className={inputCls} />
              </div>
              {[1, 2, 3, 4, 5].map(n => (
                <div key={n}>
                  <label className={labelCls}>Var{n} (opcional)</label>
                  <input
                    type="text"
                    value={(form as any)[`var${n}`]}
                    onChange={e => setForm({ ...form, [`var${n}`]: e.target.value } as any)}
                    placeholder={`Ex.: segmento, cidade...`}
                    className={inputCls}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className={sectionCls}>
            <div className="flex items-center gap-4 mb-6"><StepBadge n={5} /><h2 className="text-3xl font-black text-white">Mensagem</h2></div>
            <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl text-sm text-blue-200 space-y-2">
              <p className="font-bold text-blue-100">Variáveis no e-mail</p>
              <p>
                Clique nos botões abaixo (assunto) ou nos botões do editor (corpo) para inserir.
                Os valores vêm do destinatário + cadastro da ficha. Sistema: {'{{saudacao}}'} {'{{hora}}'} {'{{data}}'} {'{{protocolo}}'}.
              </p>
              <p className="text-xs text-blue-200/70">
                Dica: CPF/telefone no cadastro (etapa 4) só entram no e-mail se você usar {'{{cpf}}'} / {'{{telefone}}'} aqui.
              </p>
            </div>
            <div className="space-y-6">
              <div>
                <label className={labelCls}>Assunto *</label>
                <input
                  ref={subjectInputRef}
                  type="text"
                  value={form.subject}
                  onChange={e => setForm({ ...form, subject: e.target.value })}
                  placeholder="Ex.: {{saudacao}}, {{nome}} — seu protocolo {{protocolo}}"
                  className={inputCls}
                />
                <div className="mt-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-white/50 mb-2">Inserir variável no assunto</p>
                  <div className="flex flex-wrap gap-1.5">
                    {EMAIL_VARS.map(({ token, tip }) => (
                      <button
                        key={`subj-${token}`}
                        type="button"
                        title={tip}
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => insertInSubject(token)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-mono border border-white/15 bg-white/5 text-white/85 hover:bg-blue-500/20 hover:text-blue-200 hover:border-blue-400/40 transition-all"
                      >
                        {token}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <label className={labelCls}>Corpo do E-mail *</label>
                <EmailBodyEditor
                  value={form.body_html}
                  onChange={html => setForm(f => ({ ...f, body_html: html }))}
                  accent="blue"
                  minHeight={320}
                  placeholder="Digite o e-mail. Use os botões de variáveis abaixo do editor ({{nome}}, {{cpf}}, {{protocolo}}…)."
                />
              </div>
            </div>
          </div>

          <button onClick={handleSend} disabled={sending || domains.length === 0}
            className="w-full py-6 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-2xl font-black text-2xl transition-all flex items-center justify-center gap-4 disabled:opacity-50 shadow-2xl shadow-blue-500/30 hover:shadow-blue-500/50 hover:scale-[1.01]">
            {sending
              ? <><FaSpinner className="animate-spin text-2xl" /> Enviando...</>
              : <><FaPaperPlane className="text-2xl" /> Enviar E-mail{fromFull ? ` como ${fromFull}` : ''}</>}
          </button>

        </div>
      </div>
    </>
  );
}
