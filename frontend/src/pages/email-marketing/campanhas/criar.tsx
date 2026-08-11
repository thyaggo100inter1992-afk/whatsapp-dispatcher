import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import {
  FaBullhorn, FaArrowLeft, FaCheckCircle, FaSpinner, FaPlus, FaTrash,
  FaEnvelope, FaRandom, FaClock, FaPause, FaCalendarAlt, FaInfoCircle,
  FaClipboard, FaUpload, FaListUl, FaFileExcel,
} from 'react-icons/fa';
import api from '@/services/api';
import { useNotification } from '@/hooks/useNotification';

interface Domain { id: number; domain: string; status: string; }
interface EmailList { id: number; name: string; total_contacts: number; }
interface Template { id: number; name: string; subject: string; body_html: string; }
interface Sender { from_name: string; from_email: string; }

// Parseia texto de remetentes: aceita "nome,email" ou "email" por linha
function parseSendersText(text: string): Sender[] {
  return text.split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map(l => {
      const parts = l.split(',').map(p => p.trim());
      const email = parts.find(p => p.includes('@')) || '';
      const name = parts.find(p => !p.includes('@')) || '';
      return { from_name: name, from_email: email };
    })
    .filter(s => s.from_email.includes('@'));
}

// Parseia texto de assuntos: um por linha
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
  const [domains, setDomains] = useState<Domain[]>([]);
  const [lists, setLists] = useState<EmailList[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);

  // Campos básicos
  const [name, setName] = useState('');
  const [domainId, setDomainId] = useState('');
  const [listId, setListId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [replyTo, setReplyTo] = useState('');

  // Remetentes
  const [senderMode, setSenderMode] = useState<SenderMode>('manual');
  const [senders, setSenders] = useState<Sender[]>([{ from_name: '', from_email: '' }]);
  const [senderPasteText, setSenderPasteText] = useState('');

  // Assuntos
  const [subjectMode, setSubjectMode] = useState<SubjectMode>('manual');
  const [subjects, setSubjects] = useState<string[]>(['']);
  const [subjectPasteText, setSubjectPasteText] = useState('');

  // Delay
  const [delayMin, setDelayMin] = useState(2);
  const [delayMax, setDelayMax] = useState(5);

  // Agendamento
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');

  // Horário de trabalho
  const [workStart, setWorkStart] = useState('08:00');
  const [workEnd, setWorkEnd] = useState('20:00');

  // Pausa automática
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

  // Upload CSV de remetentes
  const handleSenderCsvUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = e => {
      const text = (e.target?.result as string) || '';
      // Remove header se existir
      const lines = text.split('\n').filter(Boolean);
      const dataLines = lines[0]?.toLowerCase().includes('from_name') || lines[0]?.toLowerCase().includes('nome')
        ? lines.slice(1) : lines;
      setSenderPasteText(dataLines.join('\n'));
      setSenderMode('paste');
    };
    reader.readAsText(file);
  };

  // Download modelo CSV remetentes
  const downloadSenderTemplate = () => {
    const bom = '\uFEFF';
    const content = ['nome,email', 'Empresa A,empresa-a@seudominio.com', 'Empresa B,empresa-b@seudominio.com', 'Suporte,suporte@seudominio.com'].join('\r\n');
    const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'modelo-remetentes.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  // Computed: remetentes válidos finais
  const finalSenders: Sender[] = senderMode === 'manual'
    ? senders.filter(s => s.from_email.includes('@'))
    : parseSendersText(senderPasteText);

  // Computed: assuntos válidos finais
  const finalSubjects: string[] = subjectMode === 'manual'
    ? subjects.filter(s => s.trim() !== '')
    : parseSubjectsText(subjectPasteText);

  // Handlers manuais remetentes
  const addSender = () => setSenders(s => [...s, { from_name: '', from_email: '' }]);
  const removeSender = (i: number) => setSenders(s => s.filter((_, idx) => idx !== i));
  const updateSender = (i: number, field: keyof Sender, val: string) =>
    setSenders(s => s.map((x, idx) => idx === i ? { ...x, [field]: val } : x));

  // Handlers manuais assuntos
  const addSubject = () => setSubjects(s => [...s, '']);
  const removeSubject = (i: number) => setSubjects(s => s.filter((_, idx) => idx !== i));
  const updateSubject = (i: number, val: string) =>
    setSubjects(s => s.map((x, idx) => idx === i ? val : x));

  const handleSave = async () => {
    if (!name.trim()) { notification.warning('Campo obrigatório', 'Informe o nome da campanha.'); return; }
    if (finalSenders.length === 0) { notification.warning('Remetente obrigatório', 'Adicione ao menos um e-mail de remetente válido.'); return; }
    if (finalSubjects.length === 0) { notification.warning('Assunto obrigatório', 'Adicione ao menos um assunto.'); return; }
    if (!listId) { notification.warning('Lista obrigatória', 'Selecione uma lista de contatos.'); return; }
    if (delayMin > delayMax) { notification.warning('Delay inválido', 'O delay mínimo não pode ser maior que o máximo.'); return; }

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
      notification.error('Erro ao criar campanha', error.response?.data?.message || error.message);
    } finally { setSaving(false); }
  };

  const inputCls = 'w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-orange-500 focus:outline-none';
  const labelCls = 'block text-sm font-bold text-gray-300 mb-2';
  const sectionCls = 'bg-white/5 border border-white/10 rounded-xl p-6 space-y-4';

  const modeTabCls = (active: boolean) =>
    `px-4 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer ${active ? 'bg-orange-500 text-white' : 'bg-white/10 text-gray-400 hover:bg-white/20 hover:text-white'}`;

  return (
    <>
      <Head><title>Criar Campanha | E-mail Marketing</title></Head>
      <notification.NotificationContainer />
      {/* Input oculto para CSV */}
      <input ref={senderFileRef} type="file" accept=".csv,.txt" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleSenderCsvUpload(f); e.target.value = ''; }} />

      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 py-12 px-4">
        <div className="max-w-3xl mx-auto space-y-6">

          {/* Header */}
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/email-marketing/campanhas')}
              className="p-3 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all">
              <FaArrowLeft />
            </button>
            <div>
              <h1 className="text-3xl font-black text-white flex items-center gap-3">
                <FaBullhorn className="text-orange-400" /> Nova Campanha
              </h1>
              <p className="text-gray-400">Configure e crie sua campanha de e-mail</p>
            </div>
          </div>

          {/* ── 1. IDENTIFICAÇÃO ── */}
          <div className={sectionCls}>
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <FaBullhorn className="text-orange-400" /> Identificação
            </h2>
            <div>
              <label className={labelCls}>Nome da Campanha *</label>
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder="Ex: Promoção Black Friday 2026" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Domínio de Envio</label>
              <select value={domainId} onChange={e => setDomainId(e.target.value)} className={inputCls}>
                <option value="">Selecione um domínio ativo</option>
                {domains.map(d => <option key={d.id} value={d.id}>{d.domain}</option>)}
              </select>
              {domains.length === 0 && (
                <p className="text-yellow-400 text-xs mt-1">⚠️ Nenhum domínio ativo.{' '}
                  <span className="underline cursor-pointer" onClick={() => router.push('/email-marketing/dominios')}>Configurar</span>
                </p>
              )}
            </div>
            <div>
              <label className={labelCls}>Lista de Contatos *</label>
              <select value={listId} onChange={e => setListId(e.target.value)} className={inputCls}>
                <option value="">Selecione uma lista</option>
                {lists.map(l => <option key={l.id} value={l.id}>{l.name} ({l.total_contacts} contatos)</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Responder Para (Reply-To)</label>
              <input type="email" value={replyTo} onChange={e => setReplyTo(e.target.value)}
                placeholder="respostas@seudominio.com" className={inputCls} />
            </div>
          </div>

          {/* ── 2. REMETENTES ── */}
          <div className={sectionCls}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <FaEnvelope className="text-blue-400" /> Remetentes
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">O sistema rotaciona automaticamente entre os remetentes</p>
              </div>
              {/* Abas de modo */}
              <div className="flex gap-2">
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
            </div>

            {/* Modo manual */}
            {senderMode === 'manual' && (
              <div className="space-y-3">
                {senders.map((s, i) => (
                  <div key={i} className="bg-black/20 rounded-xl p-4 border border-white/10">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-gray-400">Remetente {i + 1}</span>
                      {senders.length > 1 && (
                        <button onClick={() => removeSender(i)} className="text-red-400 hover:text-red-300 text-xs flex items-center gap-1">
                          <FaTrash /> Remover
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>Nome</label>
                        <input value={s.from_name} onChange={e => updateSender(i, 'from_name', e.target.value)}
                          placeholder="Minha Empresa" className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls}>E-mail *</label>
                        <input type="email" value={s.from_email} onChange={e => updateSender(i, 'from_email', e.target.value)}
                          placeholder="noreply@seudominio.com" className={inputCls} />
                      </div>
                    </div>
                  </div>
                ))}
                <button onClick={addSender}
                  className="w-full py-2.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-dashed border-blue-500/40 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all">
                  <FaPlus /> Adicionar remetente
                </button>
              </div>
            )}

            {/* Modo colar */}
            {senderMode === 'paste' && (
              <div className="space-y-3">
                <div className="bg-blue-500/10 border border-blue-400/30 rounded-lg p-3 text-xs text-blue-300 space-y-1">
                  <p><strong>Formato:</strong> Uma linha por remetente. Aceita dois formatos:</p>
                  <code className="block bg-black/30 rounded p-2 font-mono">
                    nome,email@dominio.com<br />
                    Empresa A,empresa-a@dominio.com<br />
                    Empresa B,empresa-b@dominio.com
                  </code>
                  <p className="text-gray-400">Ou apenas o e-mail (sem nome):</p>
                  <code className="block bg-black/30 rounded p-2 font-mono">
                    email1@dominio.com<br />
                    email2@dominio.com
                  </code>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className={labelCls}>Cole os remetentes aqui</label>
                    {senderPasteText && (
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${finalSenders.length > 0 ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                        {finalSenders.length} remetente{finalSenders.length !== 1 ? 's' : ''} válido{finalSenders.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <textarea
                    value={senderPasteText}
                    onChange={e => setSenderPasteText(e.target.value)}
                    placeholder={"Empresa A,empresa-a@dominio.com\nEmpresa B,empresa-b@dominio.com\nnoreply@dominio.com"}
                    rows={10}
                    className="w-full px-4 py-3 bg-black/40 border-2 border-white/20 rounded-lg text-white text-sm font-mono focus:border-blue-500 focus:outline-none resize-y"
                  />
                </div>
              </div>
            )}

            {/* Modo CSV */}
            {senderMode === 'csv' && (
              <div className="space-y-3">
                <div className="flex gap-3">
                  <button onClick={downloadSenderTemplate}
                    className="flex-1 py-3 bg-green-500/10 hover:bg-green-500/20 text-green-300 border border-green-500/30 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all">
                    <FaFileExcel /> Baixar modelo CSV
                  </button>
                  <button onClick={() => senderFileRef.current?.click()}
                    className="flex-1 py-3 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all">
                    <FaUpload /> Selecionar arquivo CSV
                  </button>
                </div>
                {finalSenders.length > 0 ? (
                  <div className="bg-green-500/10 border border-green-400/30 rounded-lg p-3">
                    <p className="text-green-300 font-bold text-sm">✅ {finalSenders.length} remetentes carregados do CSV</p>
                    <div className="mt-2 max-h-32 overflow-y-auto space-y-1">
                      {finalSenders.slice(0, 5).map((s, i) => (
                        <p key={i} className="text-xs text-gray-400 font-mono">{s.from_name ? `${s.from_name} <${s.from_email}>` : s.from_email}</p>
                      ))}
                      {finalSenders.length > 5 && <p className="text-xs text-gray-500">...e mais {finalSenders.length - 5}</p>}
                    </div>
                  </div>
                ) : (
                  <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-center text-gray-500 text-sm">
                    Nenhum arquivo carregado ainda
                  </div>
                )}
                <p className="text-xs text-gray-500">O arquivo CSV deve ter as colunas: <code className="bg-white/10 px-1 rounded">nome</code> e <code className="bg-white/10 px-1 rounded">email</code></p>
              </div>
            )}

            {/* Resumo remetentes */}
            {finalSenders.length > 0 && (
              <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-400/20 rounded-lg px-3 py-2 text-xs text-blue-300">
                <FaRandom /> {finalSenders.length} remetente{finalSenders.length > 1 ? 's' : ''} carregado{finalSenders.length > 1 ? 's' : ''} — rotação automática a cada envio
              </div>
            )}
          </div>

          {/* ── 3. ASSUNTOS ── */}
          <div className={sectionCls}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <FaRandom className="text-purple-400" /> Assuntos
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">O sistema varia o assunto a cada envio — reduz chance de spam</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setSubjectMode('manual')} className={modeTabCls(subjectMode === 'manual')}>
                  <FaListUl className="inline mr-1" /> Manual
                </button>
                <button onClick={() => setSubjectMode('paste')} className={modeTabCls(subjectMode === 'paste')}>
                  <FaClipboard className="inline mr-1" /> Colar em massa
                </button>
              </div>
            </div>

            {/* Manual */}
            {subjectMode === 'manual' && (
              <div className="space-y-3">
                {subjects.map((s, i) => (
                  <div key={i} className="flex items-end gap-2">
                    <div className="flex-1">
                      <label className={labelCls}>Assunto {i + 1}{i === 0 ? ' *' : ''}</label>
                      <input value={s} onChange={e => updateSubject(i, e.target.value)}
                        placeholder={`Assunto ${i + 1}`} className={inputCls} />
                    </div>
                    {subjects.length > 1 && (
                      <button onClick={() => removeSubject(i)}
                        className="mb-0.5 p-3 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 rounded-lg transition-all">
                        <FaTrash />
                      </button>
                    )}
                  </div>
                ))}
                <button onClick={addSubject}
                  className="w-full py-2.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-dashed border-purple-500/40 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all">
                  <FaPlus /> Adicionar assunto
                </button>
              </div>
            )}

            {/* Colar em massa */}
            {subjectMode === 'paste' && (
              <div className="space-y-3">
                <div className="bg-purple-500/10 border border-purple-400/30 rounded-lg p-3 text-xs text-purple-300">
                  <p><strong>Formato:</strong> Um assunto por linha. Cole quantos quiser.</p>
                  <code className="block bg-black/30 rounded p-2 font-mono mt-1">
                    Oferta imperdível para você!<br />
                    Não perca essa promoção exclusiva<br />
                    Só hoje: desconto especial para clientes VIP
                  </code>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className={labelCls}>Cole os assuntos aqui</label>
                    {subjectPasteText && (
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${finalSubjects.length > 0 ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                        {finalSubjects.length} assunto{finalSubjects.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <textarea
                    value={subjectPasteText}
                    onChange={e => setSubjectPasteText(e.target.value)}
                    placeholder={"Oferta imperdível para você!\nNão perca essa promoção exclusiva\nSó hoje: desconto especial"}
                    rows={8}
                    className="w-full px-4 py-3 bg-black/40 border-2 border-white/20 rounded-lg text-white text-sm font-mono focus:border-purple-500 focus:outline-none resize-y"
                  />
                </div>
              </div>
            )}

            {finalSubjects.length > 0 && (
              <div className="flex items-center gap-2 bg-purple-500/10 border border-purple-400/20 rounded-lg px-3 py-2 text-xs text-purple-300">
                <FaRandom /> {finalSubjects.length} assunto{finalSubjects.length > 1 ? 's' : ''} — rotação automática
              </div>
            )}
          </div>

          {/* ── 4. CONTEÚDO ── */}
          <div className={sectionCls}>
            <h2 className="text-lg font-black text-white flex items-center gap-2">📝 Conteúdo do E-mail</h2>
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
                rows={8}
                className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-orange-500 focus:outline-none font-mono text-sm resize-y" />
              <p className="text-xs text-gray-500 mt-1">
                Use <code className="bg-white/10 px-1 rounded">{'{{nome}}'}</code> e{' '}
                <code className="bg-white/10 px-1 rounded">{'{{email}}'}</code> para personalização por destinatário.
              </p>
            </div>
          </div>

          {/* ── 5. AGENDAMENTO ── */}
          <div className={sectionCls}>
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <FaCalendarAlt className="text-green-400" /> Agendamento
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Data de início</label>
                <input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Horário de início</label>
                <input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} className={inputCls} />
              </div>
            </div>
            {scheduleDate && scheduleTime ? (
              <div className="flex items-center gap-2 bg-green-500/10 border border-green-400/30 rounded-lg px-3 py-2 text-sm text-green-300">
                <FaCalendarAlt /> Campanha agendada para <strong>{scheduleDate} às {scheduleTime}</strong>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-gray-400">
                <FaInfoCircle /> Sem agendamento: ficará como rascunho para iniciar manualmente
              </div>
            )}
            <div>
              <label className={labelCls}>
                <FaClock className="inline mr-1" /> Horário de funcionamento
                <span className="text-gray-500 font-normal ml-2">(envios somente neste período)</span>
              </label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Início</label>
                  <input type="time" value={workStart} onChange={e => setWorkStart(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Fim</label>
                  <input type="time" value={workEnd} onChange={e => setWorkEnd(e.target.value)} className={inputCls} />
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1">Envios somente entre {workStart} e {workEnd}. Fora desse horário o worker aguarda.</p>
            </div>
          </div>

          {/* ── 6. DELAY E PAUSA ── */}
          <div className={sectionCls}>
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <FaPause className="text-yellow-400" /> Controle de Velocidade
            </h2>
            <div>
              <label className={labelCls}>Intervalo entre envios (segundos — valor aleatório entre mín e máx)</label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Mínimo</label>
                  <input type="number" min={1} max={300} value={delayMin}
                    onChange={e => setDelayMin(Math.max(1, parseInt(e.target.value) || 1))} className={inputCls} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Máximo</label>
                  <input type="number" min={1} max={300} value={delayMax}
                    onChange={e => setDelayMax(Math.max(delayMin, parseInt(e.target.value) || delayMin))} className={inputCls} />
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1">O sistema aguardará entre {delayMin}s e {delayMax}s aleatório. Recomendado: mín 2s / máx 5s.</p>
            </div>
            <div className="border-t border-white/10 pt-4">
              <label className={labelCls}>
                <FaPause className="inline mr-1" /> Pausa automática
                <span className="text-gray-500 font-normal ml-2">(0 = desabilitado)</span>
              </label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Pausar após X e-mails</label>
                  <input type="number" min={0} value={pauseAfter}
                    onChange={e => setPauseAfter(Math.max(0, parseInt(e.target.value) || 0))}
                    placeholder="0 = sem pausa" className={inputCls} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Duração da pausa (minutos)</label>
                  <input type="number" min={1} value={pauseDuration}
                    onChange={e => setPauseDuration(Math.max(1, parseInt(e.target.value) || 30))}
                    className={`${inputCls} ${pauseAfter === 0 ? 'opacity-40' : ''}`}
                    disabled={pauseAfter === 0} />
                </div>
              </div>
              {pauseAfter > 0 && (
                <p className="text-xs text-yellow-400 mt-1">⏸ Pausa automática a cada {pauseAfter} e-mails por {pauseDuration} minutos.</p>
              )}
            </div>
          </div>

          {/* ── RESUMO ── */}
          {(finalSenders.length > 0 || finalSubjects.length > 0) && (
            <div className="bg-orange-500/10 border border-orange-400/30 rounded-xl p-4 text-sm space-y-1">
              <p className="font-bold text-orange-300 mb-2">📋 Resumo da Campanha</p>
              <p className="text-gray-300"><span className="text-gray-500">Remetentes:</span>{' '}{finalSenders.length} cadastrado{finalSenders.length !== 1 ? 's' : ''}</p>
              <p className="text-gray-300"><span className="text-gray-500">Assuntos:</span>{' '}{finalSubjects.length} cadastrado{finalSubjects.length !== 1 ? 's' : ''}</p>
              <p className="text-gray-300"><span className="text-gray-500">Delay:</span> {delayMin}s – {delayMax}s aleatório</p>
              <p className="text-gray-300"><span className="text-gray-500">Horário:</span> {workStart} às {workEnd}</p>
              {pauseAfter > 0 && <p className="text-gray-300"><span className="text-gray-500">Pausa:</span> a cada {pauseAfter} e-mails por {pauseDuration}min</p>}
              {scheduleDate && scheduleTime && <p className="text-green-300 font-bold">🗓 Agendada para {scheduleDate} às {scheduleTime}</p>}
            </div>
          )}

          {/* Botão salvar */}
          <button onClick={handleSave} disabled={saving}
            className="w-full py-4 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl font-black text-lg transition-all flex items-center justify-center gap-3 disabled:opacity-50">
            {saving
              ? <><FaSpinner className="animate-spin" /> Criando...</>
              : scheduleDate && scheduleTime
                ? <><FaCalendarAlt /> Agendar Campanha</>
                : <><FaCheckCircle /> Criar Campanha</>}
          </button>

        </div>
      </div>
    </>
  );
}
