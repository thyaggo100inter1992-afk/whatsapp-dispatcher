import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import {
  FaBullhorn, FaArrowLeft, FaCheckCircle, FaSpinner, FaPlus, FaTrash,
  FaEnvelope, FaRandom, FaClock, FaPause, FaCalendarAlt, FaInfoCircle,
  FaClipboard, FaUpload, FaListUl, FaFileExcel, FaRocket, FaUsers,
  FaExclamationTriangle, FaBolt, FaChartLine,
} from 'react-icons/fa';
import api from '@/services/api';
import { useNotification } from '@/hooks/useNotification';

interface Domain { id: number; domain: string; status: string; }
interface EmailList { id: number; name: string; total_contacts: number; }
interface Template { id: number; name: string; subject: string; body_html: string; }
interface Sender { from_name: string; from_email: string; } // from_email = parte local (antes do @)

/** Extrai só a parte antes do @ (remove domínio se o usuário colar e-mail completo) */
function extractLocalPart(value: string): string {
  const raw = String(value || '').trim();
  const local = (raw.includes('@') ? raw.split('@')[0] : raw)
    .replace(/[^a-zA-Z0-9._+-]/g, '')
    .toLowerCase();
  return local;
}

function parseSendersText(text: string): Sender[] {
  return text.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
    const parts = l.split(',').map(p => p.trim()).filter(Boolean);
    // Se tiver @ em alguma parte, essa é o "email"; senão a última parte é o local
    const emailPart = parts.find(p => p.includes('@')) || parts[parts.length - 1] || '';
    const name = parts.find(p => p !== emailPart && !p.includes('@')) || '';
    return { from_name: name, from_email: extractLocalPart(emailPart) };
  }).filter(s => s.from_email.length > 0);
}

function parseSubjectsText(text: string): string[] {
  return text.split('\n').map(l => l.trim()).filter(Boolean);
}

type SenderMode = 'manual' | 'paste' | 'csv';
type SubjectMode = 'manual' | 'paste';

export default function CriarCampanha() {
  const router = useRouter();
  const notification = useNotification();
  const senderFileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [lists, setLists] = useState<EmailList[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);

  const [name, setName] = useState('');
  const [domainId, setDomainId] = useState('');
  const [listId, setListId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [replyTo, setReplyTo] = useState('');

  const [senderMode, setSenderMode] = useState<SenderMode>('manual');
  const [senders, setSenders] = useState<Sender[]>([{ from_name: '', from_email: '' }]);
  const [senderPasteText, setSenderPasteText] = useState('');

  const [subjectMode, setSubjectMode] = useState<SubjectMode>('manual');
  const [subjects, setSubjects] = useState<string[]>(['']);
  const [subjectPasteText, setSubjectPasteText] = useState('');

  const [delayMin, setDelayMin] = useState(2);
  const [delayMax, setDelayMax] = useState(5);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [workStart, setWorkStart] = useState('08:00');
  const [workEnd, setWorkEnd] = useState('20:00');
  const [pauseAfter, setPauseAfter] = useState(0);
  const [pauseDuration, setPauseDuration] = useState(30);

  useEffect(() => {
    Promise.all([
      api.get('/email-marketing/domains'),
      api.get('/email-marketing/lists'),
      api.get('/email-marketing/templates'),
    ]).then(([d, l, t]) => {
      setDomains((d.data.data || []).filter((x: Domain) => x.status === 'active'));
      setLists(l.data.data || []);
      setTemplates(t.data.data || []);
    }).catch(() => {});
  }, []);

  const handleTemplateSelect = (id: string) => {
    setTemplateId(id);
    if (id) {
      const tpl = templates.find(t => t.id === parseInt(id));
      if (tpl) {
        if (tpl.subject && subjects[0] === '') setSubjects([tpl.subject]);
        if (tpl.body_html) setBodyHtml(tpl.body_html);
      }
    }
  };

  const handleSenderCsvUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = e => {
      const text = (e.target?.result as string) || '';
      const lines = text.split('\n').filter(Boolean);
      const dataLines = lines[0]?.toLowerCase().includes('from_name') || lines[0]?.toLowerCase().includes('nome')
        ? lines.slice(1) : lines;
      setSenderPasteText(dataLines.join('\n'));
      setSenderMode('paste');
    };
    reader.readAsText(file);
  };

  const downloadSenderTemplate = () => {
    const bom = '\uFEFF';
    const content = ['nome,usuario', 'Empresa A,empresa-a', 'Empresa B,empresa-b', 'Suporte,suporte'].join('\r\n');
    const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'modelo-remetentes.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const selectedDomainName = domains.find(d => d.id === parseInt(domainId))?.domain || '';

  const rawSenders: Sender[] = senderMode === 'manual'
    ? senders.map(s => ({ from_name: s.from_name, from_email: extractLocalPart(s.from_email) })).filter(s => s.from_email)
    : parseSendersText(senderPasteText);

  // E-mail final sempre: usuario@dominio_selecionado
  const finalSenders: Sender[] = selectedDomainName
    ? rawSenders.map(s => ({ from_name: s.from_name, from_email: `${s.from_email}@${selectedDomainName}` }))
    : [];

  const finalSubjects: string[] = subjectMode === 'manual'
    ? subjects.filter(s => s.trim() !== '')
    : parseSubjectsText(subjectPasteText);

  const selectedList = lists.find(l => l.id === parseInt(listId));

  const addSender = () => setSenders(s => [...s, { from_name: '', from_email: '' }]);
  const removeSender = (i: number) => setSenders(s => s.filter((_, idx) => idx !== i));
  const updateSender = (i: number, field: keyof Sender, val: string) =>
    setSenders(s => s.map((x, idx) => idx === i ? { ...x, [field]: field === 'from_email' ? extractLocalPart(val) : val } : x));
  const addSubject = () => setSubjects(s => [...s, '']);
  const removeSubject = (i: number) => setSubjects(s => s.filter((_, idx) => idx !== i));
  const updateSubject = (i: number, val: string) =>
    setSubjects(s => s.map((x, idx) => idx === i ? val : x));

  const handleSave = async () => {
    const errs: string[] = [];
    if (!name.trim()) errs.push('Informe o nome da campanha.');
    if (!domainId) errs.push('Selecione um domínio verificado.');
    if (finalSenders.length === 0) errs.push('Adicione ao menos um remetente (só a parte antes do @).');
    if (finalSubjects.length === 0) errs.push('Adicione ao menos um assunto.');
    if (!listId) errs.push('Selecione uma lista de contatos.');
    if (delayMin > delayMax) errs.push('O delay mínimo não pode ser maior que o máximo.');
    if (errs.length > 0) { setErrors(errs); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    setErrors([]);

    const scheduledAt = scheduleDate && scheduleTime ? `${scheduleDate}T${scheduleTime}:00` : null;
    setSaving(true);
    try {
      await api.post('/email-marketing/campaigns', {
        name,
        from_senders: finalSenders,
        subjects: finalSubjects,
        from_name: finalSenders[0].from_name,
        from_email: finalSenders[0].from_email,
        subject: finalSubjects[0],
        reply_to: replyTo || null,
        domain_id: domainId || null,
        list_id: listId,
        template_id: templateId || null,
        body_html: bodyHtml || null,
        delay_seconds_min: delayMin,
        delay_seconds_max: delayMax,
        scheduled_at: scheduledAt,
        work_start_time: workStart,
        work_end_time: workEnd,
        pause_after: pauseAfter,
        pause_duration_minutes: pauseDuration,
      });
      notification.success(
        scheduledAt ? 'Campanha agendada!' : 'Campanha criada!',
        scheduledAt ? `Será enviada em ${scheduleDate} às ${scheduleTime}.` : 'Acesse a lista para iniciar o envio.'
      );
      router.push('/email-marketing/campanhas');
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message;
      setErrors([msg]);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally { setSaving(false); }
  };

  const inputCls = 'w-full px-6 py-4 text-base bg-dark-700/80 backdrop-blur-md border-2 border-white/20 rounded-xl text-white placeholder-white/40 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/30 transition-all duration-200';
  const labelCls = 'block text-base font-bold mb-3 text-white/90';

  const modeTabCls = (active: boolean) =>
    `px-4 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer ${active ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30' : 'bg-white/10 text-gray-400 hover:bg-white/20 hover:text-white'}`;

  const sectionCls = 'bg-dark-800/60 backdrop-blur-xl border-2 border-orange-500/30 rounded-2xl p-8 shadow-xl hover:border-orange-500/50 transition-all duration-300';

  const StepBadge = ({ n }: { n: number }) => (
    <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white text-2xl font-black w-14 h-14 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/50 flex-shrink-0">
      {n}
    </div>
  );

  return (
    <>
      <Head><title>Criar Campanha | E-mail Marketing</title></Head>
      <notification.NotificationContainer />
      <input ref={senderFileRef} type="file" accept=".csv,.txt" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleSenderCsvUpload(f); e.target.value = ''; }} />

      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 py-8 px-4">
        <div className="max-w-7xl mx-auto space-y-8">

          {/* ══ HEADER ══ */}
          <div className="relative overflow-hidden bg-gradient-to-r from-orange-600/30 via-orange-500/20 to-orange-600/30 backdrop-blur-xl border-2 border-orange-500/40 rounded-3xl p-10 shadow-2xl shadow-orange-500/20">
            <div className="absolute inset-0 bg-grid-white/[0.02]"></div>
            <div className="relative">
              <div className="flex items-center gap-6 mb-4">
                <button onClick={() => router.push('/email-marketing/campanhas')}
                  className="p-3 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all">
                  <FaArrowLeft className="text-xl" />
                </button>
                <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-6 rounded-2xl shadow-lg shadow-orange-500/50">
                  <FaRocket className="text-5xl text-white" />
                </div>
                <div>
                  <h1 className="text-5xl font-black text-white mb-2 tracking-tight">Nova Campanha de E-mail</h1>
                  <p className="text-xl text-white/80 font-medium">Configure remetentes, assuntos, agendamento e controles de envio</p>
                </div>
              </div>

              {/* Stats rápidas */}
              {(finalSenders.length > 0 || finalSubjects.length > 0 || selectedList) && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                  <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
                    <div className="flex items-center gap-3">
                      <FaEnvelope className="text-3xl text-orange-300" />
                      <div>
                        <div className="text-2xl font-bold text-white">{finalSenders.length}</div>
                        <div className="text-sm text-white/70">Remetentes</div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
                    <div className="flex items-center gap-3">
                      <FaRandom className="text-3xl text-purple-300" />
                      <div>
                        <div className="text-2xl font-bold text-white">{finalSubjects.length}</div>
                        <div className="text-sm text-white/70">Assuntos</div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
                    <div className="flex items-center gap-3">
                      <FaUsers className="text-3xl text-green-300" />
                      <div>
                        <div className="text-2xl font-bold text-white">{selectedList?.total_contacts ?? 0}</div>
                        <div className="text-sm text-white/70">Contatos</div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
                    <div className="flex items-center gap-3">
                      <FaBolt className="text-3xl text-yellow-300" />
                      <div>
                        <div className="text-2xl font-bold text-white">{delayMin}–{delayMax}s</div>
                        <div className="text-sm text-white/70">Delay</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ══ ERROS ══ */}
          {errors.length > 0 && (
            <div className="bg-gradient-to-r from-red-500/20 to-red-600/20 backdrop-blur-xl border-2 border-red-500/50 rounded-2xl p-6 shadow-xl shadow-red-500/20">
              <div className="flex items-start gap-4">
                <div className="bg-red-500/20 p-4 rounded-xl">
                  <FaExclamationTriangle className="text-3xl text-red-400" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-red-300 mb-3">Corrija os erros antes de continuar:</h3>
                  <ul className="space-y-2">
                    {errors.map((e, i) => (
                      <li key={i} className="flex items-start gap-2 text-base text-red-200">
                        <span className="text-red-400 mt-1">●</span><span>{e}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* ══ 1. IDENTIFICAÇÃO ══ */}
          <div className={sectionCls}>
            <div className="flex items-center gap-4 mb-6">
              <StepBadge n={1} />
              <h2 className="text-3xl font-black text-white">Identificação da Campanha</h2>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className={labelCls}>Nome da Campanha *</label>
                <input value={name} onChange={e => setName(e.target.value)}
                  placeholder="Ex: Promoção Black Friday 2026" className={inputCls} />
                <p className="text-sm text-white/50 mt-2 flex items-center gap-1"><span>💡</span> Dê um nome descritivo para identificar facilmente esta campanha</p>
              </div>
              <div>
                <label className={labelCls}>Domínio de Envio</label>
                <select value={domainId} onChange={e => setDomainId(e.target.value)} className={inputCls}>
                  <option value="">Selecione um domínio ativo</option>
                  {domains.map(d => <option key={d.id} value={d.id}>{d.domain}</option>)}
                </select>
                {domains.length === 0 && (
                  <p className="text-yellow-400 text-sm mt-2">⚠️ Nenhum domínio ativo.{' '}
                    <span className="underline cursor-pointer" onClick={() => router.push('/email-marketing/dominios')}>Configurar domínio</span>
                  </p>
                )}
              </div>
              <div>
                <label className={labelCls}>Lista de Contatos *</label>
                <select value={listId} onChange={e => setListId(e.target.value)} className={inputCls}>
                  <option value="">Selecione uma lista</option>
                  {lists.map(l => <option key={l.id} value={l.id}>{l.name} ({l.total_contacts.toLocaleString('pt-BR')} contatos)</option>)}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>Responder Para (Reply-To)</label>
                <input type="email" value={replyTo} onChange={e => setReplyTo(e.target.value)}
                  placeholder="respostas@seudominio.com" className={inputCls} />
              </div>
            </div>
          </div>

          {/* ══ 2. REMETENTES ══ */}
          <div className={sectionCls}>
            <div className="flex items-center gap-4 mb-2">
              <StepBadge n={2} />
              <div>
                <h2 className="text-3xl font-black text-white">Remetentes</h2>
                <p className="text-white/60 text-sm mt-1">Digite só a parte antes do @ — o domínio selecionado é aplicado automaticamente</p>
              </div>
            </div>

            {!selectedDomainName ? (
              <div className="mt-4 p-4 bg-yellow-500/10 border-2 border-yellow-500/30 rounded-xl text-yellow-300 text-sm font-bold flex items-center gap-2">
                <FaExclamationTriangle /> Selecione um domínio na seção 1 antes de cadastrar remetentes.
              </div>
            ) : (
              <div className="mt-4 p-4 bg-green-500/10 border-2 border-green-500/30 rounded-xl text-green-300 text-sm">
                Domínio de envio: <strong className="text-white">@{selectedDomainName}</strong> — o e-mail final será <code className="bg-black/30 px-2 py-0.5 rounded">usuario@{selectedDomainName}</code>
              </div>
            )}

            {/* Abas modo */}
            <div className="flex gap-2 mb-6 mt-4">
              <button onClick={() => setSenderMode('manual')} className={modeTabCls(senderMode === 'manual')}>
                <FaListUl className="inline mr-1" /> Manual
              </button>
              <button onClick={() => setSenderMode('paste')} className={modeTabCls(senderMode === 'paste')}>
                <FaClipboard className="inline mr-1" /> Colar em massa
              </button>
              <button onClick={() => setSenderMode('csv')} className={modeTabCls(senderMode === 'csv')}>
                <FaUpload className="inline mr-1" /> CSV
              </button>
            </div>

            {senderMode === 'manual' && (
              <div className="space-y-4">
                {senders.map((s, i) => (
                  <div key={i} className="bg-dark-700/60 border border-white/10 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm font-bold text-orange-300 bg-orange-500/10 px-3 py-1 rounded-full">Remetente {i + 1}</span>
                      {senders.length > 1 && (
                        <button onClick={() => removeSender(i)} className="text-red-400 hover:text-red-300 text-sm flex items-center gap-1 transition-all">
                          <FaTrash /> Remover
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className={labelCls}>Nome de exibição</label>
                        <input value={s.from_name} onChange={e => updateSender(i, 'from_name', e.target.value)}
                          placeholder="Minha Empresa" className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls}>Usuário do e-mail * (sem @)</label>
                        <div className="flex items-stretch gap-0">
                          <input
                            value={s.from_email}
                            onChange={e => updateSender(i, 'from_email', e.target.value)}
                            placeholder="contato"
                            className={`${inputCls} rounded-r-none border-r-0`}
                          />
                          <span className="flex items-center px-4 bg-dark-600 border-2 border-white/20 border-l-0 rounded-r-xl text-orange-300 font-mono text-sm whitespace-nowrap">
                            @{selectedDomainName || 'dominio.com'}
                          </span>
                        </div>
                        {s.from_email && selectedDomainName && (
                          <p className="text-xs text-green-400 mt-2">
                            ✅ Ficará: <strong>{extractLocalPart(s.from_email)}@{selectedDomainName}</strong>
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <button onClick={addSender}
                  className="w-full py-4 bg-orange-500/10 hover:bg-orange-500/20 text-orange-300 border-2 border-dashed border-orange-500/40 rounded-xl text-base font-bold flex items-center justify-center gap-2 transition-all">
                  <FaPlus /> Adicionar remetente
                </button>
              </div>
            )}

            {senderMode === 'paste' && (
              <div className="space-y-4">
                <div className="p-5 bg-blue-500/10 border-2 border-blue-500/30 rounded-xl">
                  <h3 className="text-base font-bold text-blue-300 mb-2">📋 Como colar:</h3>
                  <p className="text-sm text-white/70 mb-2">Uma linha por remetente: <strong>nome,usuario</strong> (sem @). Se colar e-mail completo, o sistema ignora o domínio e usa o selecionado.</p>
                  <code className="block bg-black/30 rounded-lg p-3 font-mono text-sm text-green-300">
                    Empresa A,empresa-a<br />
                    Empresa B,empresa-b<br />
                    noreply
                  </code>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className={labelCls}>Cole os remetentes aqui</label>
                    {senderPasteText && (
                      <span className={`text-sm font-bold px-3 py-1 rounded-full ${finalSenders.length > 0 ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                        {finalSenders.length} remetente{finalSenders.length !== 1 ? 's' : ''} válido{finalSenders.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <textarea value={senderPasteText} onChange={e => setSenderPasteText(e.target.value)}
                    placeholder={"Empresa A,empresa-a\nEmpresa B,empresa-b\nnoreply"}
                    rows={12}
                    className="w-full px-5 py-4 bg-dark-700/80 border-2 border-white/20 rounded-xl text-white text-sm font-mono focus:border-orange-500 focus:ring-4 focus:ring-orange-500/20 outline-none resize-y transition-all" />
                </div>
                {finalSenders.length > 0 && (
                  <div className="bg-black/30 rounded-xl p-4 max-h-40 overflow-y-auto">
                    <p className="text-xs text-gray-400 mb-2 font-bold">Preview dos e-mails finais:</p>
                    {finalSenders.slice(0, 20).map((s, i) => (
                      <p key={i} className="text-sm text-green-300 font-mono">{s.from_name ? `${s.from_name} <${s.from_email}>` : s.from_email}</p>
                    ))}
                    {finalSenders.length > 20 && <p className="text-xs text-gray-500 mt-1">… e mais {finalSenders.length - 20}</p>}
                  </div>
                )}
              </div>
            )}

            {senderMode === 'csv' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={downloadSenderTemplate}
                    className="py-4 bg-green-500/10 hover:bg-green-500/20 text-green-300 border-2 border-green-500/30 rounded-xl text-base font-bold flex items-center justify-center gap-2 transition-all">
                    <FaFileExcel /> Baixar modelo CSV
                  </button>
                  <button onClick={() => senderFileRef.current?.click()}
                    className="py-4 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border-2 border-blue-500/30 rounded-xl text-base font-bold flex items-center justify-center gap-2 transition-all">
                    <FaUpload /> Selecionar arquivo CSV
                  </button>
                </div>
                <input ref={senderFileRef} type="file" accept=".csv,.txt" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleSenderCsvUpload(f); }} />
                <p className="text-sm text-white/50">Colunas: <code>nome,usuario</code> — sem @ no usuário. O domínio selecionado será aplicado.</p>
                {finalSenders.length > 0 && (
                  <div className="bg-black/30 rounded-xl p-4">
                    <p className="text-green-300 font-bold text-base mb-3">✅ {finalSenders.length} remetentes prontos</p>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {finalSenders.slice(0, 15).map((s, i) => (
                        <p key={i} className="text-sm text-gray-400 font-mono">{s.from_name ? `${s.from_name} <${s.from_email}>` : s.from_email}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {finalSenders.length > 0 && (
              <div className="mt-4 p-4 bg-orange-500/10 border border-orange-500/30 rounded-xl text-orange-200 text-sm flex items-center gap-2">
                <FaRandom /> {finalSenders.length} remetente{finalSenders.length > 1 ? 's' : ''} — rotação automática a cada e-mail enviado
              </div>
            )}
          </div>

          {/* ══ 3. ASSUNTOS ══ */}
          <div className={sectionCls}>
            <div className="flex items-center gap-4 mb-2">
              <StepBadge n={3} />
              <div>
                <h2 className="text-3xl font-black text-white">Assuntos</h2>
                <p className="text-white/60 text-sm mt-1">O sistema varia o assunto a cada envio — reduz chance de cair em spam</p>
              </div>
            </div>

            <div className="flex gap-2 mb-6 mt-4">
              <button onClick={() => setSubjectMode('manual')} className={modeTabCls(subjectMode === 'manual')}>
                <FaListUl className="inline mr-1" /> Manual
              </button>
              <button onClick={() => setSubjectMode('paste')} className={modeTabCls(subjectMode === 'paste')}>
                <FaClipboard className="inline mr-1" /> Colar em massa
              </button>
            </div>

            {subjectMode === 'manual' && (
              <div className="space-y-4">
                {subjects.map((s, i) => (
                  <div key={i} className="flex items-end gap-3">
                    <div className="flex-1">
                      <label className={labelCls}>Assunto {i + 1}{i === 0 ? ' *' : ''}</label>
                      <input value={s} onChange={e => updateSubject(i, e.target.value)}
                        placeholder={`Assunto ${i + 1}`} className={inputCls} />
                    </div>
                    {subjects.length > 1 && (
                      <button onClick={() => removeSubject(i)}
                        className="mb-1 p-4 bg-red-500/20 hover:bg-red-500/30 text-red-300 border-2 border-red-500/30 rounded-xl transition-all">
                        <FaTrash />
                      </button>
                    )}
                  </div>
                ))}
                <button onClick={addSubject}
                  className="w-full py-4 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border-2 border-dashed border-purple-500/40 rounded-xl text-base font-bold flex items-center justify-center gap-2 transition-all">
                  <FaPlus /> Adicionar assunto
                </button>
              </div>
            )}

            {subjectMode === 'paste' && (
              <div className="space-y-4">
                <div className="p-5 bg-purple-500/10 border-2 border-purple-500/30 rounded-xl">
                  <h3 className="text-base font-bold text-purple-300 mb-2">📋 Como colar:</h3>
                  <p className="text-sm text-white/70 mb-2">Um assunto por linha. Cole quantos quiser:</p>
                  <code className="block bg-black/30 rounded-lg p-3 font-mono text-sm text-green-300">
                    Oferta imperdível para você!<br />
                    Não perca essa promoção exclusiva<br />
                    Só hoje: desconto especial para clientes VIP
                  </code>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className={labelCls}>Cole os assuntos aqui</label>
                    {subjectPasteText && (
                      <span className={`text-sm font-bold px-3 py-1 rounded-full ${finalSubjects.length > 0 ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                        {finalSubjects.length} assunto{finalSubjects.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <textarea value={subjectPasteText} onChange={e => setSubjectPasteText(e.target.value)}
                    placeholder={"Oferta imperdível para você!\nNão perca essa promoção exclusiva\nSó hoje: desconto especial"}
                    rows={10}
                    className="w-full px-5 py-4 bg-dark-700/80 border-2 border-white/20 rounded-xl text-white text-sm font-mono focus:border-orange-500 focus:ring-4 focus:ring-orange-500/20 outline-none resize-y transition-all" />
                </div>
              </div>
            )}

            {finalSubjects.length > 0 && (
              <div className="mt-4 p-4 bg-purple-500/10 border-2 border-purple-500/30 rounded-xl">
                <p className="text-purple-300 font-bold text-sm flex items-center gap-2">
                  <FaRandom /> {finalSubjects.length} assunto{finalSubjects.length > 1 ? 's' : ''} cadastrado{finalSubjects.length > 1 ? 's' : ''} — rotação automática
                </p>
              </div>
            )}
          </div>

          {/* ══ 4. CONTEÚDO ══ */}
          <div className={sectionCls}>
            <div className="flex items-center gap-4 mb-6">
              <StepBadge n={4} />
              <h2 className="text-3xl font-black text-white">Conteúdo do E-mail</h2>
            </div>
            <div className="space-y-6">
              <div>
                <label className={labelCls}>Template (opcional)</label>
                <select value={templateId} onChange={e => handleTemplateSelect(e.target.value)} className={inputCls}>
                  <option value="">Usar HTML personalizado abaixo</option>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Corpo do E-mail (HTML)</label>
                <textarea value={bodyHtml} onChange={e => setBodyHtml(e.target.value)}
                  placeholder="<p>Olá {{nome}},</p><p>Conteúdo da sua campanha...</p>"
                  rows={10}
                  className="w-full px-5 py-4 text-base bg-dark-700/80 backdrop-blur-md border-2 border-white/20 rounded-xl text-white placeholder-white/40 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/30 transition-all font-mono resize-y" />
                <p className="text-sm text-white/50 mt-2">
                  Use <code className="bg-white/10 px-1 rounded">{'{{nome}}'}</code> e{' '}
                  <code className="bg-white/10 px-1 rounded">{'{{email}}'}</code> para personalização por destinatário.
                </p>
              </div>
            </div>
          </div>

          {/* ══ 5. AGENDAMENTO ══ */}
          <div className={sectionCls}>
            <div className="flex items-center gap-4 mb-6">
              <StepBadge n={5} />
              <h2 className="text-3xl font-black text-white">Agendamento</h2>
            </div>

            <div className="mb-6 p-6 bg-purple-500/10 border-2 border-purple-500/30 rounded-xl">
              <h3 className="text-xl font-bold mb-4 text-purple-300">📅 Data e Hora de Início (Opcional)</h3>
              <p className="text-sm text-white/70 mb-4">Defina quando a campanha deve começar. Deixe em branco para iniciar manualmente.</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-base font-bold mb-2 text-white/90">Data de Início</label>
                  <input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)}
                    className="w-full px-4 py-3 bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30 transition-all" />
                </div>
                <div>
                  <label className="block text-base font-bold mb-2 text-white/90">Hora de Início</label>
                  <input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)}
                    className="w-full px-4 py-3 bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30 transition-all" />
                </div>
              </div>
              {scheduleDate && scheduleTime ? (
                <div className="mt-4 p-4 bg-green-500/10 border-2 border-green-500/30 rounded-xl">
                  <p className="text-base text-green-300 font-bold">✅ Campanha iniciará em: <span className="text-white">{scheduleDate} às {scheduleTime}</span></p>
                </div>
              ) : (
                <div className="mt-4 p-4 bg-yellow-500/10 border-2 border-yellow-500/30 rounded-xl">
                  <p className="text-base text-yellow-300 font-bold">⚡ Campanha ficará como <span className="text-white">RASCUNHO</span> para iniciar manualmente</p>
                </div>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-xl font-bold mb-4 text-orange-300">🕐 Horário de Trabalho Diário</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-base font-bold mb-2 text-white/90">Iniciar às</label>
                      <input type="time" value={workStart} onChange={e => setWorkStart(e.target.value)}
                        className="w-full px-4 py-3 bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/30 transition-all" />
                    </div>
                    <div>
                      <label className="block text-base font-bold mb-2 text-white/90">Pausar às</label>
                      <input type="time" value={workEnd} onChange={e => setWorkEnd(e.target.value)}
                        className="w-full px-4 py-3 bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/30 transition-all" />
                    </div>
                  </div>
                  <div className="p-4 bg-white/5 rounded-xl">
                    <ul className="text-sm text-white/70 space-y-1">
                      <li>📌 Envia somente entre {workStart} e {workEnd} todos os dias</li>
                      <li>⏸ Passou do horário → <span className="text-yellow-300 font-bold">PAUSA automática</span></li>
                      <li>▶️ Chegou o horário → <span className="text-green-300 font-bold">RETOMA automática</span></li>
                    </ul>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-bold mb-4 text-orange-300">⚙️ Controle de Velocidade</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-base font-bold mb-2 text-white/90">Intervalo entre envios (segundos)</label>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-white/70 mb-1">Mínimo</label>
                        <input type="number" min={1} max={300} value={delayMin}
                          onChange={e => setDelayMin(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-full px-4 py-3 bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/30 transition-all" />
                      </div>
                      <div>
                        <label className="block text-sm text-white/70 mb-1">Máximo</label>
                        <input type="number" min={1} max={300} value={delayMax}
                          onChange={e => setDelayMax(Math.max(delayMin, parseInt(e.target.value) || delayMin))}
                          className="w-full px-4 py-3 bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/30 transition-all" />
                      </div>
                    </div>
                    <p className="text-sm text-white/50 mt-2">⏱️ Aguardar entre {delayMin}s e {delayMax}s (aleatório) entre cada e-mail</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ══ 6. PAUSA AUTOMÁTICA ══ */}
          <div className={sectionCls}>
            <div className="flex items-center gap-4 mb-6">
              <StepBadge n={6} />
              <h2 className="text-3xl font-black text-white">Pausa Automática</h2>
            </div>
            <div className="p-6 bg-yellow-500/10 border-2 border-yellow-500/30 rounded-xl mb-6">
              <h3 className="text-xl font-bold mb-3 text-yellow-300">⏸ Como funciona a pausa automática:</h3>
              <ul className="text-base text-white/90 space-y-2 list-disc list-inside">
                <li>O sistema envia X e-mails → pausa automaticamente por Y minutos</li>
                <li>Após a pausa → <span className="text-green-300 font-bold">RETOMA automaticamente</span></li>
                <li>Útil para evitar bloqueios por excesso de envio em curto período</li>
                <li>Coloque <strong>0</strong> para desabilitar a pausa automática</li>
              </ul>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className={labelCls}>Pausar após X e-mails <span className="text-white/40 font-normal">(0 = desabilitado)</span></label>
                <input type="number" min={0} value={pauseAfter}
                  onChange={e => setPauseAfter(Math.max(0, parseInt(e.target.value) || 0))}
                  placeholder="0" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Duração da pausa (minutos)</label>
                <input type="number" min={1} value={pauseDuration}
                  onChange={e => setPauseDuration(Math.max(1, parseInt(e.target.value) || 30))}
                  className={`${inputCls} ${pauseAfter === 0 ? 'opacity-40 cursor-not-allowed' : ''}`}
                  disabled={pauseAfter === 0} />
              </div>
            </div>
            {pauseAfter > 0 && (
              <div className="mt-4 p-4 bg-yellow-500/10 border-2 border-yellow-500/30 rounded-xl">
                <p className="text-yellow-300 font-bold text-base">
                  ⏸ Sistema pausará automaticamente a cada <span className="text-white">{pauseAfter} e-mails</span> por <span className="text-white">{pauseDuration} minutos</span>
                </p>
              </div>
            )}
          </div>

          {/* ══ RESUMO FINAL ══ */}
          {(finalSenders.length > 0 && finalSubjects.length > 0 && listId) && (
            <div className="bg-gradient-to-r from-orange-500/20 to-orange-600/20 backdrop-blur-xl border-2 border-orange-500/40 rounded-2xl p-6 shadow-xl">
              <h3 className="text-xl font-bold text-orange-300 mb-4 flex items-center gap-2"><FaChartLine /> Resumo da Campanha</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div className="bg-white/5 rounded-xl p-3"><span className="text-gray-400">Remetentes:</span><br /><span className="text-white font-bold">{finalSenders.length} cadastrado{finalSenders.length > 1 ? 's' : ''}</span></div>
                <div className="bg-white/5 rounded-xl p-3"><span className="text-gray-400">Assuntos:</span><br /><span className="text-white font-bold">{finalSubjects.length} cadastrado{finalSubjects.length > 1 ? 's' : ''}</span></div>
                <div className="bg-white/5 rounded-xl p-3"><span className="text-gray-400">Contatos:</span><br /><span className="text-white font-bold">{selectedList?.total_contacts.toLocaleString('pt-BR') ?? 0}</span></div>
                <div className="bg-white/5 rounded-xl p-3"><span className="text-gray-400">Delay:</span><br /><span className="text-white font-bold">{delayMin}s – {delayMax}s aleatório</span></div>
                <div className="bg-white/5 rounded-xl p-3"><span className="text-gray-400">Horário:</span><br /><span className="text-white font-bold">{workStart} às {workEnd}</span></div>
                <div className="bg-white/5 rounded-xl p-3"><span className="text-gray-400">Pausa:</span><br /><span className="text-white font-bold">{pauseAfter > 0 ? `A cada ${pauseAfter} por ${pauseDuration}min` : 'Desabilitada'}</span></div>
              </div>
              {scheduleDate && scheduleTime && (
                <div className="mt-3 p-3 bg-green-500/10 border border-green-500/30 rounded-xl">
                  <p className="text-green-300 font-bold">🗓 Agendada para {scheduleDate} às {scheduleTime}</p>
                </div>
              )}
            </div>
          )}

          {/* ══ BOTÃO CRIAR ══ */}
          <button onClick={handleSave} disabled={saving}
            className="w-full py-6 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-2xl font-black text-2xl transition-all flex items-center justify-center gap-4 disabled:opacity-50 shadow-2xl shadow-orange-500/30 hover:shadow-orange-500/50 hover:scale-[1.01]">
            {saving
              ? <><FaSpinner className="animate-spin text-2xl" /> Criando campanha...</>
              : scheduleDate && scheduleTime
                ? <><FaCalendarAlt className="text-2xl" /> Agendar Campanha</>
                : <><FaRocket className="text-2xl" /> Criar Campanha</>}
          </button>

        </div>
      </div>
    </>
  );
}
