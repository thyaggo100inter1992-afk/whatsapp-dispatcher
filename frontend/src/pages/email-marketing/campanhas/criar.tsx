import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import Head from 'next/head';
import {
  FaBullhorn, FaArrowLeft, FaCheckCircle, FaSpinner, FaPlus, FaTrash,
  FaEnvelope, FaRandom, FaClock, FaPause, FaCalendarAlt, FaInfoCircle,
  FaClipboard, FaUpload, FaListUl, FaFileExcel, FaRocket, FaUsers,
  FaExclamationTriangle, FaBolt, FaChartLine, FaSearch, FaTimes, FaEdit, FaChevronDown, FaChevronUp,
} from 'react-icons/fa';
import * as XLSX from 'xlsx';
import api from '@/services/api';
import { useNotification } from '@/hooks/useNotification';
import EmailRestrictionCheckModal, {
  EmailRestrictionCheckResult,
} from '@/components/EmailRestrictionCheckModal';

const EmailBodyEditor = dynamic(() => import('@/components/EmailBodyEditor'), { ssr: false });

interface Domain { id: number; domain: string; status: string; }
interface EmailList { id: number; name: string; total_contacts: number; }
interface Template { id: number; name: string; subject: string; subjects?: string[] | string | null; body_html: string; }
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
  const seen = new Set<string>();
  const out: Sender[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    // Pula cabeçalho: nome,usuario / from_name,from_email
    if (/^(nome|from_name|name)\b/i.test(line) && !line.includes('@')) continue;
    const parts = line.split(/[,;\t]/).map(p => p.trim()).filter(Boolean);
    if (!parts.length) continue;
    const emailPart = parts.find(p => p.includes('@')) || parts[parts.length - 1] || '';
    const name = parts.find(p => p !== emailPart && !p.includes('@')) || '';
    const local = extractLocalPart(emailPart);
    if (!local || seen.has(local)) continue;
    seen.add(local);
    out.push({ from_name: name, from_email: local });
  }
  return out;
}

function parseSubjectsText(text: string): string[] {
  return text.split('\n').map(l => l.trim()).filter(Boolean);
}

type SenderMode = 'manual' | 'paste' | 'csv';
type SubjectMode = 'manual' | 'paste';
type RecipientSource = 'list' | 'manual' | 'paste' | 'csv';

interface RecipientRow {
  email: string; name: string; cpf: string; phone: string;
  var1: string; var2: string; var3: string; var4: string; var5: string;
}

/** Formato: email,nome,cpf,telefone,var1,var2,var3,var4,var5 (extras opcionais). Aceita ; ou tab.
 * Remove e-mails duplicados automaticamente (mantém a 1ª ocorrência). */
function parseRecipientsText(text: string): { rows: RecipientRow[]; duplicatesRemoved: number; totalRaw: number } {
  const seen = new Set<string>();
  const out: RecipientRow[] = [];
  let duplicatesRemoved = 0;
  let totalRaw = 0;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (/^email\b/i.test(line) && !line.includes('@')) continue;
    const parts = line.split(/[,;\t]/).map(p => p.trim());
    const emailIdx = parts.findIndex(p => p.includes('@'));
    if (emailIdx < 0) continue;
    totalRaw += 1;
    const email = parts[emailIdx].toLowerCase();
    if (seen.has(email)) {
      duplicatesRemoved += 1;
      continue;
    }
    seen.add(email);
    const others = parts.filter((_, i) => i !== emailIdx);
    out.push({
      email,
      name: others[0] || '',
      cpf: others[1] || '',
      phone: others[2] || '',
      var1: others[3] || '',
      var2: others[4] || '',
      var3: others[5] || '',
      var4: others[6] || '',
      var5: others[7] || '',
    });
  }
  return { rows: out, duplicatesRemoved, totalRaw };
}

/** Serializa destinatários de volta para texto (após dedupe) */
function recipientsToText(rows: RecipientRow[]): string {
  return rows.map(r =>
    [r.email, r.name, r.cpf, r.phone, r.var1, r.var2, r.var3, r.var4, r.var5]
      .map(c => String(c || '').trim())
      .join(',')
  ).join('\n');
}

/** Deduplica lista manual — mantém a 1ª ocorrência de cada e-mail */
function dedupeManualRecipients(rows: RecipientRow[]): { rows: RecipientRow[]; duplicatesRemoved: number } {
  const seen = new Set<string>();
  const out: RecipientRow[] = [];
  let duplicatesRemoved = 0;
  for (const r of rows) {
    const email = String(r.email || '').trim().toLowerCase();
    if (!email.includes('@')) {
      out.push(r); // linhas vazias / incompletas mantidas
      continue;
    }
    if (seen.has(email)) {
      duplicatesRemoved += 1;
      continue;
    }
    seen.add(email);
    out.push({ ...r, email });
  }
  return { rows: out.length ? out : [{ email: '', name: '', cpf: '', phone: '', var1: '', var2: '', var3: '', var4: '', var5: '' }], duplicatesRemoved };
}

export default function CriarCampanha() {
  const router = useRouter();
  const notification = useNotification();
  const senderFileRef = useRef<HTMLInputElement>(null);
  const recipientFileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [lists, setLists] = useState<EmailList[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);

  const [name, setName] = useState('');
  const [domainId, setDomainId] = useState(''); // legado / primeiro selecionado
  const [domainIds, setDomainIds] = useState<number[]>([]);
  const [listId, setListId] = useState('');
  /** Templates salvos selecionados (rotação) — só o corpo, sem puxar assunto */
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<number[]>([]);
  /** Edição opcional do HTML de um template selecionado */
  const [templateOverrides, setTemplateOverrides] = useState<Record<number, string>>({});
  const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null);
  /** Textos escritos na hora (sem template) */
  const [customBodies, setCustomBodies] = useState<string[]>([]);
  const [editingCustomIndex, setEditingCustomIndex] = useState<number | null>(null);
  const [tplSearchQuery, setTplSearchQuery] = useState('');
  const [tplExcludeQuery, setTplExcludeQuery] = useState('');
  const [replyTo, setReplyTo] = useState('');

  const [recipientSource, setRecipientSource] = useState<RecipientSource>('list');
  const [manualRecipients, setManualRecipients] = useState<RecipientRow[]>([
    { email: '', name: '', cpf: '', phone: '', var1: '', var2: '', var3: '', var4: '', var5: '' },
  ]);
  const [recipientPasteText, setRecipientPasteText] = useState('');

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
  const [restrictionModalOpen, setRestrictionModalOpen] = useState(false);
  const [restrictionResult, setRestrictionResult] = useState<EmailRestrictionCheckResult | null>(null);
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

  const isBodyFilled = (html: string) => {
    const plain = String(html || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return !!plain;
  };

  const filteredTemplates = templates.filter((t) => {
    const name = String(t.name || '').toLowerCase();
    if (tplSearchQuery.trim() && !name.includes(tplSearchQuery.trim().toLowerCase())) return false;
    if (tplExcludeQuery.trim() && name.includes(tplExcludeQuery.trim().toLowerCase())) return false;
    return true;
  });

  const toggleTemplate = (id: number) => {
    setSelectedTemplateIds((prev) => {
      if (prev.includes(id)) {
        setTemplateOverrides((o) => {
          const next = { ...o };
          delete next[id];
          return next;
        });
        if (editingTemplateId === id) setEditingTemplateId(null);
        return prev.filter((x) => x !== id);
      }
      return [...prev, id];
    });
  };

  const selectAllFilteredTemplates = () => {
    setSelectedTemplateIds((prev) => {
      const set = new Set(prev);
      filteredTemplates.forEach((t) => set.add(t.id));
      return Array.from(set);
    });
  };

  const clearSelectedTemplates = () => {
    setSelectedTemplateIds([]);
    setTemplateOverrides({});
    setEditingTemplateId(null);
  };

  const resolveTemplateBody = (id: number): string => {
    if (templateOverrides[id] !== undefined) return templateOverrides[id];
    return templates.find((t) => t.id === id)?.body_html || '';
  };

  const finalBodies: string[] = [
    ...selectedTemplateIds.map(resolveTemplateBody).filter(isBodyFilled),
    ...customBodies.filter(isBodyFilled),
  ];

  const addCustomBody = () => {
    setCustomBodies((prev) => [...prev, '']);
    setEditingCustomIndex(customBodies.length);
  };

  const removeCustomBody = (i: number) => {
    setCustomBodies((prev) => prev.filter((_, idx) => idx !== i));
    setEditingCustomIndex(null);
  };

  const updateCustomBody = (i: number, html: string) =>
    setCustomBodies((prev) => prev.map((h, idx) => (idx === i ? html : h)));

  const handleSenderCsvUpload = async (file: File) => {
    try {
      const lower = file.name.toLowerCase();
      let text = '';
      if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
        text = rows.map(r =>
          [r[0], r[1]].map(c => String(c ?? '').trim()).join(',')
        ).join('\n');
      } else {
        text = await file.text();
      }
      const lines = text.split(/\r?\n/).filter(Boolean);
      const header = (lines[0] || '').toLowerCase();
      const dataLines =
        (header.includes('nome') || header.includes('from_name') || header.includes('usuario') || header.includes('from_email'))
        && !lines[0].includes('@')
          ? lines.slice(1)
          : lines;
      setSenderPasteText(dataLines.join('\n'));
      setSenderMode('csv');
      notification.success('Arquivo carregado', `${dataLines.length} linha(s) importada(s). Confira o preview.`);
    } catch (e: any) {
      notification.error('Erro ao ler arquivo', e.message || 'Não foi possível ler o arquivo');
    }
  };

  const downloadSenderTemplate = () => {
    const rows = [
      ['nome', 'usuario'],
      ['Nett Sistemas', 'contato'],
      ['Eli Promotora', 'eli'],
      ['Atendimento', 'atendimento'],
      ['Marketing', 'marketing'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 22 }, { wch: 18 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Remetentes');
    XLSX.writeFile(wb, 'modelo-remetentes.xlsx');
  };

  const handleRecipientCsvUpload = async (file: File) => {
    try {
      const lower = file.name.toLowerCase();
      let text = '';
      if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
        text = rows.map(r =>
          [r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8]].map(c => String(c ?? '').trim()).join(',')
        ).join('\n');
      } else {
        text = await file.text();
      }
      const lines = text.split(/\r?\n/).filter(Boolean);
      const dataLines = lines[0]?.toLowerCase().includes('email') && !lines[0].includes('@')
        ? lines.slice(1) : lines;
      const parsed = parseRecipientsText(dataLines.join('\n'));
      setRecipientPasteText(recipientsToText(parsed.rows));
      setRecipientSource('paste');
      if (parsed.duplicatesRemoved > 0) {
        notification.success(
          'Duplicados removidos',
          `${parsed.duplicatesRemoved} e-mail(s) repetido(s) excluído(s). Restaram ${parsed.rows.length} único(s).`
        );
      } else {
        notification.success('Arquivo carregado', `${parsed.rows.length} destinatário(s) válido(s).`);
      }
    } catch (e: any) {
      notification.error('Erro ao ler arquivo', e.message || 'Não foi possível ler o arquivo');
    }
  };

  const downloadRecipientTemplate = () => {
    const rows = [
      ['email', 'nome', 'cpf', 'telefone', 'var1', 'var2', 'var3', 'var4', 'var5'],
      ['joao.silva@email.com', 'João Silva', '123.456.789-00', '(11) 98888-7777', 'Segmento A', '', '', '', ''],
      ['maria.santos@email.com', 'Maria Santos', '', '', '', '', '', '', ''],
      ['pedro@empresa.com.br', 'Pedro Oliveira', '98765432100', '11999998888', 'VIP', 'SP', '', '', ''],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [
      { wch: 30 }, { wch: 20 }, { wch: 16 }, { wch: 16 },
      { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Destinatarios');
    XLSX.writeFile(wb, 'modelo-destinatarios.xlsx');
  };

  const selectedDomains = domains.filter(d => domainIds.includes(d.id));
  const selectedDomainNames = selectedDomains.map(d => d.domain);
  const selectedDomainName = selectedDomainNames[0] || '';

  const rawSenders: Sender[] = senderMode === 'manual'
    ? senders.map(s => ({ from_name: s.from_name, from_email: extractLocalPart(s.from_email) })).filter(s => s.from_email)
    : parseSendersText(senderPasteText);

  // Expande usuario × cada domínio selecionado (rotação multi-domínio)
  const finalSenders: Sender[] = (() => {
    if (selectedDomainNames.length === 0) return [];
    const out: Sender[] = [];
    const seen = new Set<string>();
    for (const s of rawSenders) {
      const local = extractLocalPart(s.from_email);
      if (!local) continue;
      for (const dom of selectedDomainNames) {
        const full = `${local}@${dom}`;
        if (seen.has(full)) continue;
        seen.add(full);
        out.push({ from_name: s.from_name, from_email: full });
      }
    }
    return out;
  })();

  const toggleDomain = (id: number) => {
    setDomainIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      setDomainId(next.length ? String(next[0]) : '');
      return next;
    });
  };

  const selectAllDomains = () => {
    const all = domains.map(d => d.id);
    setDomainIds(all);
    setDomainId(all.length ? String(all[0]) : '');
  };

  const clearDomains = () => {
    setDomainIds([]);
    setDomainId('');
  };

  const finalSubjects: string[] = subjectMode === 'manual'
    ? subjects.filter(s => s.trim() !== '')
    : parseSubjectsText(subjectPasteText);

  const selectedList = lists.find(l => l.id === parseInt(listId));

  const pastedParse = recipientSource === 'paste' || recipientSource === 'csv'
    ? parseRecipientsText(recipientPasteText)
    : { rows: [] as RecipientRow[], duplicatesRemoved: 0, totalRaw: 0 };

  const finalRecipients: RecipientRow[] = recipientSource === 'list'
    ? []
    : recipientSource === 'manual'
      ? dedupeManualRecipients(
          manualRecipients.filter(r => r.email.includes('@')).map(r => ({
            email: r.email.trim().toLowerCase(),
            name: r.name.trim(),
            cpf: r.cpf.trim(),
            phone: r.phone.trim(),
            var1: r.var1.trim(),
            var2: r.var2.trim(),
            var3: r.var3.trim(),
            var4: r.var4.trim(),
            var5: r.var5.trim(),
          }))
        ).rows.filter(r => r.email.includes('@'))
      : pastedParse.rows;

  const recipientCount = recipientSource === 'list'
    ? (selectedList?.total_contacts ?? 0)
    : finalRecipients.length;

  const addSender = () => setSenders(s => [...s, { from_name: '', from_email: '' }]);
  const removeSender = (i: number) => setSenders(s => s.filter((_, idx) => idx !== i));
  const updateSender = (i: number, field: keyof Sender, val: string) =>
    setSenders(s => s.map((x, idx) => idx === i ? { ...x, [field]: field === 'from_email' ? extractLocalPart(val) : val } : x));
  const addSubject = () => setSubjects(s => [...s, '']);
  const removeSubject = (i: number) => setSubjects(s => s.filter((_, idx) => idx !== i));
  const updateSubject = (i: number, val: string) =>
    setSubjects(s => s.map((x, idx) => idx === i ? val : x));

  const addRecipient = () => setManualRecipients(r => [...r, { email: '', name: '', cpf: '', phone: '', var1: '', var2: '', var3: '', var4: '', var5: '' }]);
  const removeRecipient = (i: number) => setManualRecipients(r => r.filter((_, idx) => idx !== i));
  const updateRecipient = (i: number, field: keyof RecipientRow, val: string) =>
    setManualRecipients(r => r.map((x, idx) => idx === i ? { ...x, [field]: val } : x));

  /** Ao sair do campo e-mail: remove clones automaticamente */
  const handleManualEmailBlur = (i: number) => {
    setManualRecipients(prev => {
      const email = String(prev[i]?.email || '').trim().toLowerCase();
      if (!email.includes('@')) return prev;

      const firstIdx = prev.findIndex(r => r.email.trim().toLowerCase() === email);
      // Se esta linha é clone de outra anterior → remove esta linha
      if (firstIdx >= 0 && firstIdx < i) {
        notification.success('E-mail duplicado removido', `${email} já estava na lista.`);
        const next = prev.filter((_, idx) => idx !== i);
        return next.length ? next : [{ email: '', name: '', cpf: '', phone: '', var1: '', var2: '', var3: '', var4: '', var5: '' }];
      }

      // Remove clones posteriores do mesmo e-mail
      let removed = 0;
      const next = prev.filter((r, idx) => {
        if (idx === firstIdx) return true;
        if (r.email.trim().toLowerCase() === email) {
          removed += 1;
          return false;
        }
        return true;
      }).map((r, idx) => (idx === firstIdx ? { ...r, email } : r));

      if (removed > 0) {
        notification.success(
          'Duplicados removidos',
          `${removed} contato(s) com o mesmo e-mail (${email}) foram excluídos.`
        );
      }
      return next.length ? next : [{ email: '', name: '', cpf: '', phone: '', var1: '', var2: '', var3: '', var4: '', var5: '' }];
    });
  };

  /** Ao colar/editar texto: limpa duplicados quando sai do campo */
  const handlePasteBlur = () => {
    const parsed = parseRecipientsText(recipientPasteText);
    if (parsed.duplicatesRemoved <= 0) return;
    setRecipientPasteText(recipientsToText(parsed.rows));
    notification.success(
      'Duplicados removidos',
      `${parsed.duplicatesRemoved} e-mail(s) repetido(s) excluído(s). Restaram ${parsed.rows.length} único(s).`
    );
  };

  const handleSave = async () => {
    const errs: string[] = [];
    if (!name.trim()) errs.push('Informe o nome da campanha.');
    if (domainIds.length === 0) errs.push('Selecione ao menos um domínio verificado.');
    if (finalSenders.length === 0) errs.push('Adicione ao menos um remetente (só a parte antes do @).');
    if (finalSubjects.length === 0) errs.push('Adicione ao menos um assunto.');
    if (recipientSource === 'list' && !listId) errs.push('Selecione uma lista de contatos.');
    if (recipientSource !== 'list' && finalRecipients.length === 0) {
      errs.push('Adicione ao menos um destinatário (e-mail válido).');
    }
    if (delayMin > delayMax) errs.push('O delay mínimo não pode ser maior que o máximo.');
    if (errs.length > 0) { setErrors(errs); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    setErrors([]);
    setSaving(true);

    try {
      let emailsToCheck: string[] = [];
      if (recipientSource === 'list') {
        const contactsRes = await api.get(`/email-marketing/lists/${listId}/contacts`, {
          params: { limit: 50000 },
        });
        emailsToCheck = (contactsRes.data.data || [])
          .map((c: any) => String(c.email || '').trim().toLowerCase())
          .filter((e: string) => e.includes('@'));
      } else {
        emailsToCheck = finalRecipients.map(r => r.email.trim().toLowerCase());
      }

      if (emailsToCheck.length > 0) {
        const check = await api.post('/email-marketing/restrictions/check-bulk', { emails: emailsToCheck });
        const result = check.data as EmailRestrictionCheckResult;
        if (result.restricted_count > 0) {
          setRestrictionResult(result);
          setRestrictionModalOpen(true);
          setSaving(false);
          return;
        }
      }

      await createCampaignPayload({ ignoreRestrictions: false, excludeEmails: [] });
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message;
      setErrors([msg]);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setSaving(false);
    }
  };

  const createCampaignPayload = async (opts: {
    ignoreRestrictions: boolean;
    excludeEmails: string[];
  }) => {
    const scheduledAt = scheduleDate && scheduleTime
      ? `${scheduleDate}T${scheduleTime}:00-03:00`
      : null;
    setSaving(true);
    try {
      const excludeSet = new Set(opts.excludeEmails.map(e => e.toLowerCase()));
      const recipientsPayload =
        recipientSource === 'list'
          ? undefined
          : finalRecipients
              .filter(r => !excludeSet.has(r.email.trim().toLowerCase()))
              .map(r => ({
                email: r.email,
                name: r.name || null,
                cpf: r.cpf || null,
                phone: r.phone || null,
                var1: r.var1 || null,
                var2: r.var2 || null,
                var3: r.var3 || null,
                var4: r.var4 || null,
                var5: r.var5 || null,
              }));

      if (recipientSource !== 'list' && (!recipientsPayload || recipientsPayload.length === 0)) {
        setErrors(['Todos os destinatários estão na lista de restrição. Não há ninguém para enviar.']);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setSaving(false);
        return;
      }

      await api.post('/email-marketing/campaigns', {
        name,
        from_senders: finalSenders,
        subjects: finalSubjects,
        from_name: finalSenders[0].from_name,
        from_email: finalSenders[0].from_email,
        subject: finalSubjects[0],
        reply_to: replyTo || null,
        domain_id: domainIds[0] || null,
        domain_ids: domainIds,
        list_id: recipientSource === 'list' ? listId : null,
        recipients: recipientsPayload,
        template_id: selectedTemplateIds[0] || null,
        body_html: finalBodies[0] || null,
        body_htmls: finalBodies.length ? finalBodies : undefined,
        delay_seconds_min: delayMin,
        delay_seconds_max: delayMax,
        scheduled_at: scheduledAt,
        work_start_time: workStart,
        work_end_time: workEnd,
        pause_after: pauseAfter,
        pause_duration_minutes: pauseDuration,
        ignore_email_restrictions: opts.ignoreRestrictions,
      });
      notification.success(
        scheduledAt ? 'Campanha agendada!' : 'Campanha iniciada!',
        scheduledAt
          ? `Envio automático em ${scheduleDate} às ${scheduleTime} (Brasília), dentro do horário de trabalho.`
          : 'Envio automático iniciado (respeitando o horário de trabalho da campanha).'
      );
      router.push('/email-marketing/campanhas');
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message;
      setErrors([msg]);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSaving(false);
      setRestrictionModalOpen(false);
    }
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
      <input ref={senderFileRef} type="file" accept=".csv,.xlsx,.xls,.txt" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleSenderCsvUpload(f); e.target.value = ''; }} />
      <input ref={recipientFileRef} type="file" accept=".csv,.xlsx,.xls,.txt" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleRecipientCsvUpload(f); e.target.value = ''; }} />

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
                        <div className="text-2xl font-bold text-white">{recipientCount.toLocaleString('pt-BR')}</div>
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
                <label className={labelCls}>Domínios de Envio *</label>
                <p className="text-sm text-white/50 mb-3">
                  Selecione um ou mais. Com vários, o sistema <strong className="text-white/70">rotaciona os domínios</strong> a cada e-mail.
                </p>
                {domains.length === 0 ? (
                  <p className="text-yellow-400 text-sm">⚠️ Nenhum domínio ativo.{' '}
                    <span className="underline cursor-pointer" onClick={() => router.push('/email-marketing/dominios')}>Configurar domínio</span>
                  </p>
                ) : (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={selectAllDomains}
                        className="px-3 py-1.5 text-xs font-bold rounded-lg bg-orange-500/20 text-orange-200 border border-orange-500/40 hover:bg-orange-500/30">
                        Selecionar todos ({domains.length})
                      </button>
                      {domainIds.length > 0 && (
                        <button type="button" onClick={clearDomains}
                          className="px-3 py-1.5 text-xs font-bold rounded-lg bg-white/10 text-white/70 border border-white/20 hover:bg-white/20">
                          Limpar
                        </button>
                      )}
                    </div>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {domains.map(d => {
                        const checked = domainIds.includes(d.id);
                        return (
                          <label
                            key={d.id}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all ${
                              checked
                                ? 'border-orange-500/60 bg-orange-500/15 text-white'
                                : 'border-white/15 bg-dark-700/60 text-white/70 hover:border-white/30'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleDomain(d.id)}
                              className="w-4 h-4 accent-orange-500"
                            />
                            <span className="font-mono text-sm font-bold">@{d.domain}</span>
                          </label>
                        );
                      })}
                    </div>
                    {domainIds.length > 1 && (
                      <p className="text-green-300 text-sm font-bold">
                        ✅ {domainIds.length} domínios — rotação automática na campanha
                      </p>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className={labelCls}>Responder Para (Reply-To)</label>
                <input type="email" value={replyTo} onChange={e => setReplyTo(e.target.value)}
                  placeholder="atendimento@seudominio.com" className={inputCls} />
                <p className="text-white/50 text-xs mt-2">
                  E-mail do atendente. Quando o cliente responder, o sistema encaminha a resposta para cá
                  com CPF, nome, telefone e variáveis (uso interno). Ao clicar em Responder, você fala com o cliente — sem reenviar a ficha.
                </p>
              </div>
            </div>
          </div>

          {/* ══ 2. REMETENTES ══ */}
          <div className={sectionCls}>
            <div className="flex items-center gap-4 mb-2">
              <StepBadge n={2} />
              <div>
                <h2 className="text-3xl font-black text-white">Remetentes</h2>
                <p className="text-white/60 text-sm mt-1">
                  Digite só a parte antes do @ — o sistema cria o remetente em <strong className="text-white/80">todos os domínios</strong> selecionados
                </p>
              </div>
            </div>

            {selectedDomainNames.length === 0 ? (
              <div className="mt-4 p-4 bg-yellow-500/10 border-2 border-yellow-500/30 rounded-xl text-yellow-300 text-sm font-bold flex items-center gap-2">
                <FaExclamationTriangle /> Selecione ao menos um domínio na seção 1 antes de cadastrar remetentes.
              </div>
            ) : (
              <div className="mt-4 p-4 bg-green-500/10 border-2 border-green-500/30 rounded-xl text-green-300 text-sm space-y-1">
                <p>
                  Domínio{selectedDomainNames.length > 1 ? 's' : ''} selecionado{selectedDomainNames.length > 1 ? 's' : ''}:{' '}
                  <strong className="text-white">{selectedDomainNames.map(d => `@${d}`).join(' · ')}</strong>
                </p>
                <p className="text-xs text-green-200/80">
                  Ex.: usuário <code className="bg-black/30 px-1 rounded">tiago</code> gera{' '}
                  {selectedDomainNames.map(d => (
                    <code key={d} className="bg-black/30 px-1 rounded mr-1">tiago@{d}</code>
                  ))}
                </p>
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
                            {selectedDomainNames.length > 1
                              ? `× ${selectedDomainNames.length} domínios`
                              : `@${selectedDomainName || 'dominio.com'}`}
                          </span>
                        </div>
                        {s.from_email && selectedDomainNames.length > 0 && (
                          <div className="text-xs text-green-400 mt-2 space-y-0.5">
                            {selectedDomainNames.map(dom => (
                              <p key={dom}>✅ <strong>{extractLocalPart(s.from_email)}@{dom}</strong></p>
                            ))}
                          </div>
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
                  <p className="text-sm text-white/70 mb-2">
                    Uma linha por remetente: <strong>nome,usuario</strong> (sem @ no usuário).
                    Se colar e-mail completo, o sistema usa só a parte antes do @ e aplica o domínio da seção 1.
                  </p>
                  <code className="block bg-black/30 rounded-lg p-3 font-mono text-sm text-green-300">
                    Nett Sistemas,contato<br />
                    Eli Promotora,eli<br />
                    Atendimento,atendimento<br />
                    Marketing,marketing
                  </code>
                  {selectedDomainNames.length > 0 && (
                    <p className="text-xs text-blue-200/80 mt-3">
                      Ex.: <code className="bg-black/30 px-1 rounded">contato</code> gera{' '}
                      {selectedDomainNames.map(d => (
                        <code key={d} className="bg-black/30 px-1 rounded mr-1">contato@{d}</code>
                      ))}
                    </p>
                  )}
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
                    placeholder={"Nett Sistemas,contato\nEli Promotora,eli\nAtendimento,atendimento"}
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
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 text-sm text-blue-300 space-y-2">
                  <p>
                    <strong>Modelo Excel:</strong> colunas <code className="bg-black/30 px-1 rounded">nome</code> |{' '}
                    <code className="bg-black/30 px-1 rounded">usuario</code> (sem @). Aceita <strong>.xlsx</strong> ou CSV.
                  </p>
                  <p className="text-xs text-blue-200/80">
                    O domínio selecionado na seção 1 é aplicado automaticamente (ex.: usuario → usuario@{selectedDomainName || 'seudominio.com'}).
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button type="button" onClick={downloadSenderTemplate}
                    className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold flex items-center gap-2">
                    <FaFileExcel /> Baixar modelo Excel
                  </button>
                  <button type="button" onClick={() => senderFileRef.current?.click()}
                    className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold flex items-center gap-2">
                    <FaUpload /> Selecionar Excel/CSV
                  </button>
                </div>
                {finalSenders.length > 0 && senderMode === 'csv' && (
                  <div className="bg-black/30 rounded-xl p-4">
                    <p className="text-green-300 font-bold text-base mb-3">✅ {finalSenders.length} remetentes prontos</p>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {finalSenders.slice(0, 15).map((s, i) => (
                        <p key={i} className="text-sm text-gray-400 font-mono">{s.from_name ? `${s.from_name} <${s.from_email}>` : s.from_email}</p>
                      ))}
                    </div>
                  </div>
                )}
                {senderPasteText && senderMode === 'csv' && finalSenders.length === 0 && (
                  <p className="text-yellow-300 text-sm">Arquivo lido, mas nenhum remetente válido. Confira as colunas nome | usuario.</p>
                )}
              </div>
            )}

            {finalSenders.length > 0 && (
              <div className="mt-4 p-4 bg-orange-500/10 border border-orange-500/30 rounded-xl text-orange-200 text-sm space-y-2">
                <p className="flex items-center gap-2 font-bold">
                  <FaRandom /> {finalSenders.length} remetente{finalSenders.length > 1 ? 's' : ''} final{finalSenders.length > 1 ? 'is' : ''}
                  {selectedDomainNames.length > 1 ? ` (${rawSenders.length} usuário${rawSenders.length > 1 ? 's' : ''} × ${selectedDomainNames.length} domínio${selectedDomainNames.length > 1 ? 's' : ''})` : ''}
                  {' '}— rotação automática
                </p>
                <div className="max-h-36 overflow-y-auto space-y-1 font-mono text-xs text-orange-100/90">
                  {finalSenders.slice(0, 30).map((s, i) => (
                    <p key={i}>{s.from_name ? `${s.from_name} <${s.from_email}>` : s.from_email}</p>
                  ))}
                  {finalSenders.length > 30 && <p className="text-orange-200/60">… e mais {finalSenders.length - 30}</p>}
                </div>
              </div>
            )}
          </div>

          {/* ══ 3. DESTINATÁRIOS ══ */}
          <div className={sectionCls}>
            <div className="flex items-center gap-4 mb-2">
              <StepBadge n={3} />
              <div>
                <h2 className="text-3xl font-black text-white">Destinatários</h2>
                <p className="text-white/60 text-sm mt-1">Lista pronta, digitação manual, colar em massa ou CSV — CPF e telefone opcionais</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-6 mt-4">
              <button type="button" onClick={() => setRecipientSource('list')} className={modeTabCls(recipientSource === 'list')}>
                <FaUsers className="inline mr-1" /> Lista pronta
              </button>
              <button type="button" onClick={() => setRecipientSource('manual')} className={modeTabCls(recipientSource === 'manual')}>
                <FaListUl className="inline mr-1" /> Manual
              </button>
              <button type="button" onClick={() => setRecipientSource('paste')} className={modeTabCls(recipientSource === 'paste')}>
                <FaClipboard className="inline mr-1" /> Colar em massa
              </button>
              <button type="button" onClick={() => setRecipientSource('csv')} className={modeTabCls(recipientSource === 'csv')}>
                <FaUpload className="inline mr-1" /> CSV
              </button>
            </div>

            {recipientSource === 'list' && (
              <div>
                <label className={labelCls}>Lista de Contatos *</label>
                <select value={listId} onChange={e => setListId(e.target.value)} className={inputCls}>
                  <option value="">Selecione uma lista</option>
                  {lists.map(l => <option key={l.id} value={l.id}>{l.name} ({l.total_contacts.toLocaleString('pt-BR')} contatos)</option>)}
                </select>
                {lists.length === 0 && (
                  <p className="text-yellow-400 text-sm mt-2">Nenhuma lista.{' '}
                    <span className="underline cursor-pointer" onClick={() => router.push('/email-marketing/listas')}>Criar lista</span>
                  </p>
                )}
                {selectedList && (
                  <p className="text-green-400 text-sm mt-2 font-bold">{selectedList.total_contacts.toLocaleString('pt-BR')} contatos nesta lista</p>
                )}
              </div>
            )}

            {recipientSource === 'manual' && (
              <div className="space-y-4">
                {manualRecipients.map((r, i) => (
                  <div key={i} className="bg-dark-700/60 border border-white/10 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm font-bold text-orange-300 bg-orange-500/10 px-3 py-1 rounded-full">Contato {i + 1}</span>
                      {manualRecipients.length > 1 && (
                        <button type="button" onClick={() => removeRecipient(i)} className="text-red-400 hover:text-red-300 text-sm flex items-center gap-1">
                          <FaTrash /> Remover
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className={labelCls}>E-mail *</label>
                        <input value={r.email}
                          onChange={e => updateRecipient(i, 'email', e.target.value)}
                          onBlur={() => handleManualEmailBlur(i)}
                          placeholder="cliente@email.com" className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls}>Nome</label>
                        <input value={r.name} onChange={e => updateRecipient(i, 'name', e.target.value)}
                          placeholder="Nome do cliente" className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls}>CPF <span className="text-white/40 font-normal">(opcional)</span></label>
                        <input value={r.cpf} onChange={e => updateRecipient(i, 'cpf', e.target.value)}
                          placeholder="000.000.000-00" className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls}>Telefone <span className="text-white/40 font-normal">(opcional)</span></label>
                        <input value={r.phone} onChange={e => updateRecipient(i, 'phone', e.target.value)}
                          placeholder="(11) 99999-0000" className={inputCls} />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mt-4">
                      {([1, 2, 3, 4, 5] as const).map(n => (
                        <div key={n}>
                          <label className={labelCls}>Var{n} <span className="text-white/40 font-normal">(opc.)</span></label>
                          <input
                            value={r[`var${n}` as keyof RecipientRow] as string}
                            onChange={e => updateRecipient(i, `var${n}` as keyof RecipientRow, e.target.value)}
                            placeholder={`variavel${n}`}
                            className={inputCls}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <button type="button" onClick={addRecipient}
                  className="w-full py-4 bg-orange-500/10 hover:bg-orange-500/20 text-orange-300 border-2 border-dashed border-orange-500/40 rounded-xl text-base font-bold flex items-center justify-center gap-2">
                  <FaPlus /> Adicionar contato
                </button>
                <p className="text-sm text-green-400 font-bold">{finalRecipients.length} destinatário(s) válido(s) — e-mails duplicados são excluídos automaticamente</p>
              </div>
            )}

            {(recipientSource === 'paste' || recipientSource === 'csv') && (
              <div className="space-y-4">
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 text-sm text-blue-300 space-y-2">
                  <p><strong>Modelo Excel:</strong> colunas email | nome | cpf | telefone | var1…var5 (todas opcionais exceto e-mail). Aceita <strong>.xlsx</strong> ou CSV.</p>
                  <p className="text-xs text-blue-200/80">No texto do e-mail use: {'{{nome}}'} {'{{primeiro_nome}}'} {'{{cpf}}'} {'{{telefone}}'} {'{{var1}}'}…{'{{var5}}'} · sistema: {'{{saudacao}}'} {'{{hora}}'} {'{{data}}'} {'{{protocolo}}'}</p>
                  <p className="text-xs text-green-300/90 font-bold">E-mails iguais (clonados) são removidos automaticamente — só entra 1 de cada.</p>
                </div>
                {recipientSource === 'csv' && (
                  <div className="flex flex-wrap gap-3">
                    <button type="button" onClick={() => recipientFileRef.current?.click()}
                      className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold flex items-center gap-2">
                      <FaUpload /> Selecionar Excel/CSV
                    </button>
                    <button type="button" onClick={downloadRecipientTemplate}
                      className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold flex items-center gap-2">
                      <FaFileExcel /> Baixar modelo Excel
                    </button>
                  </div>
                )}
                <textarea
                  value={recipientPasteText}
                  onChange={e => setRecipientPasteText(e.target.value)}
                  onBlur={handlePasteBlur}
                  placeholder="email,nome,cpf,telefone"
                  rows={10}
                  className="w-full px-5 py-4 text-sm bg-dark-700/80 border-2 border-white/20 rounded-xl text-white placeholder-white/40 focus:border-orange-500 font-mono resize-y"
                />
                <p className="text-sm text-green-400 font-bold">
                  {finalRecipients.length} destinatário(s) único(s)
                  {pastedParse.duplicatesRemoved > 0
                    ? ` · ${pastedParse.duplicatesRemoved} duplicado(s) ignorado(s)`
                    : ''}
                </p>
              </div>
            )}
          </div>

          {/* ══ 4. ASSUNTOS ══ */}
          <div className={sectionCls}>
            <div className="flex items-center gap-4 mb-2">
              <StepBadge n={4} />
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

          {/* ══ 5. MODELOS DE MENSAGEM ══ */}
          <div className={sectionCls}>
            <div className="flex items-center gap-4 mb-2">
              <StepBadge n={5} />
              <div>
                <h2 className="text-3xl font-black text-white">Modelos de mensagem</h2>
                <p className="text-white/60 text-sm mt-1">
                  Selecione vários templates salvos (filtros iguais à campanha WhatsApp). Assuntos ficam só na seção 4 — não vêm do template.
                </p>
              </div>
            </div>

            <div className="space-y-5 mt-4">
              {/* Filtros */}
              <div className="p-5 bg-dark-700/50 rounded-xl border border-white/10 space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold mb-2 text-white/90 flex items-center gap-2">
                      <FaSearch /> Buscar template
                    </label>
                    <input
                      type="text"
                      className={inputCls}
                      placeholder="Digite para buscar pelo nome..."
                      value={tplSearchQuery}
                      onChange={(e) => setTplSearchQuery(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-2 text-white/90 flex items-center gap-2">
                      <FaTimes /> Excluir que contenham
                    </label>
                    <input
                      type="text"
                      className={inputCls}
                      placeholder="Digite para excluir pelo nome..."
                      value={tplExcludeQuery}
                      onChange={(e) => setTplExcludeQuery(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button type="button" onClick={selectAllFilteredTemplates}
                    className="px-4 py-2 rounded-lg text-sm font-bold bg-orange-500/20 text-orange-200 border border-orange-500/40 hover:bg-orange-500/30">
                    Selecionar todos filtrados ({filteredTemplates.length})
                  </button>
                  <button type="button" onClick={clearSelectedTemplates}
                    className="px-4 py-2 rounded-lg text-sm font-bold bg-white/10 text-white/70 border border-white/15 hover:bg-white/15">
                    Limpar seleção
                  </button>
                  <span className="text-sm text-white/50 ml-auto">
                    {selectedTemplateIds.length} selecionado{selectedTemplateIds.length !== 1 ? 's' : ''}
                    {(tplSearchQuery || tplExcludeQuery) ? ` · ${filteredTemplates.length} na lista` : ''}
                  </span>
                </div>
              </div>

              {/* Lista com checkbox (só seleção — editor abre em painel completo abaixo) */}
              <div className="max-h-[420px] overflow-y-auto space-y-2 pr-1">
                {templates.length === 0 ? (
                  <p className="text-white/40 text-sm p-4 text-center">Nenhum template salvo. Crie em Templates ou adicione um modelo abaixo.</p>
                ) : filteredTemplates.length === 0 ? (
                  <p className="text-white/40 text-sm p-4 text-center">Nenhum template com esses filtros. Ajuste a busca ou a exclusão.</p>
                ) : (
                  filteredTemplates.map((t) => {
                    const selected = selectedTemplateIds.includes(t.id);
                    const editing = editingTemplateId === t.id;
                    return (
                      <div
                        key={t.id}
                        className={`rounded-xl border-2 transition-all ${
                          selected ? 'border-orange-500/50 bg-orange-500/10' : 'border-white/10 bg-black/20'
                        } ${editing ? 'ring-2 ring-orange-400/40' : ''}`}
                      >
                        <div className="flex items-center gap-3 p-3">
                          <label className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => toggleTemplate(t.id)}
                              className="w-5 h-5 accent-orange-500 flex-shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="text-white font-bold truncate">{t.name}</p>
                              <p className="text-[11px] text-white/40 truncate">
                                {isBodyFilled(resolveTemplateBody(t.id)) ? 'Com conteúdo' : 'Sem conteúdo'}
                                {templateOverrides[t.id] !== undefined ? ' · editado nesta campanha' : ''}
                                {editing ? ' · editando abaixo' : ''}
                              </p>
                            </div>
                          </label>
                          {selected && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCustomIndex(null);
                                setEditingTemplateId(editing ? null : t.id);
                              }}
                              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg bg-white/10 text-white/80 hover:bg-white/15 border border-white/15 flex-shrink-0"
                            >
                              <FaEdit /> {editing ? 'Fechar' : 'Editar'}
                              {editing ? <FaChevronUp /> : <FaChevronDown />}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Editor do template selecionado — painel completo (fora da lista com scroll) */}
              {editingTemplateId != null && selectedTemplateIds.includes(editingTemplateId) && (() => {
                const editingTpl = templates.find((t) => t.id === editingTemplateId);
                if (!editingTpl) return null;
                return (
                  <div className="rounded-xl border-2 border-orange-500/50 bg-orange-500/10 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-orange-200 truncate">{editingTpl.name}</p>
                        <p className="text-[11px] text-white/40">
                          Edição só nesta campanha. Não altera o template salvo e não muda os assuntos.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditingTemplateId(null)}
                        className="px-3 py-1.5 text-xs font-bold rounded-lg bg-white/10 text-white/70 border border-white/15 flex-shrink-0"
                      >
                        Fechar
                      </button>
                    </div>
                    <EmailBodyEditor
                      value={resolveTemplateBody(editingTemplateId)}
                      onChange={(html) => setTemplateOverrides((o) => ({ ...o, [editingTemplateId]: html }))}
                      accent="orange"
                      minHeight={520}
                      placeholder="Edite o conteúdo deste modelo..."
                    />
                  </div>
                );
              })()}

              {/* Modelos feitos na hora (sem template salvo) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-bold text-white/70">Modelos feitos na hora (opcional)</p>
                  <button type="button" onClick={() => { setEditingTemplateId(null); addCustomBody(); }}
                    className="px-3 py-2 text-xs font-bold rounded-lg bg-orange-500/15 text-orange-200 border border-orange-500/30 hover:bg-orange-500/25 flex items-center gap-1">
                    <FaPlus /> Novo modelo
                  </button>
                </div>
                {customBodies.map((html, i) => {
                  const open = editingCustomIndex === i;
                  return (
                    <div key={i} className="rounded-xl border-2 border-dashed border-orange-500/30 bg-black/15 p-3">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-sm font-bold text-orange-300">Modelo personalizado {i + 1}</span>
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => {
                            setEditingTemplateId(null);
                            setEditingCustomIndex(open ? null : i);
                          }}
                            className="px-3 py-1.5 text-xs font-bold rounded-lg bg-white/10 text-white/70 border border-white/15">
                            {open ? 'Fechar' : 'Editar'}
                          </button>
                          <button type="button" onClick={() => removeCustomBody(i)}
                            className="p-2 text-red-300 hover:bg-red-500/20 rounded-lg">
                            <FaTrash />
                          </button>
                        </div>
                      </div>
                      {open ? (
                        <EmailBodyEditor
                          value={html}
                          onChange={(v) => updateCustomBody(i, v)}
                          accent="orange"
                          minHeight={520}
                          placeholder="Escreva o conteúdo deste modelo..."
                        />
                      ) : (
                        <p className="text-xs text-white/40">
                          {isBodyFilled(html) ? 'Conteúdo preenchido — clique em Editar para ver/alterar' : 'Vazio — clique em Editar para escrever'}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {finalBodies.length > 0 && (
                <div className="p-4 bg-orange-500/10 border-2 border-orange-500/30 rounded-xl">
                  <p className="text-orange-300 font-bold text-sm flex items-center gap-2">
                    <FaRandom /> {finalBodies.length} modelo{finalBodies.length > 1 ? 's' : ''} na rotação
                    {selectedTemplateIds.length > 0 ? ` (${selectedTemplateIds.length} template${selectedTemplateIds.length > 1 ? 's' : ''}` : ''}
                    {customBodies.filter(isBodyFilled).length > 0
                      ? `${selectedTemplateIds.length > 0 ? ' + ' : ' ('}${customBodies.filter(isBodyFilled).length} modelo${customBodies.filter(isBodyFilled).length > 1 ? 's' : ''} na hora`
                      : ''}
                    {selectedTemplateIds.length > 0 || customBodies.filter(isBodyFilled).length > 0 ? ')' : ''}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ══ 6. AGENDAMENTO ══ */}
          <div className={sectionCls}>
            <div className="flex items-center gap-4 mb-6">
              <StepBadge n={6} />
              <h2 className="text-3xl font-black text-white">Agendamento</h2>
            </div>

            <div className="mb-6 p-6 bg-purple-500/10 border-2 border-purple-500/30 rounded-xl">
              <h3 className="text-xl font-bold mb-4 text-purple-300">📅 Data e Hora de Início (Opcional)</h3>
              <p className="text-sm text-white/70 mb-4">
                Horário de <span className="text-white font-bold">Brasília</span>. Deixe em branco para iniciar na hora
                (dentro do horário de trabalho desta campanha). Com data/hora, o envio começa automaticamente nesse momento —
                sem precisar clicar em Iniciar.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-base font-bold mb-2 text-white/90">Data de Início</label>
                  <input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)}
                    className="w-full px-4 py-3 bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30 transition-all" />
                </div>
                <div>
                  <label className="block text-base font-bold mb-2 text-white/90">Hora de Início (Brasília)</label>
                  <input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)}
                    className="w-full px-4 py-3 bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30 transition-all" />
                </div>
              </div>
              {scheduleDate && scheduleTime ? (
                <div className="mt-4 p-4 bg-green-500/10 border-2 border-green-500/30 rounded-xl">
                  <p className="text-base text-green-300 font-bold">
                    ✅ Agendada para <span className="text-white">{scheduleDate} às {scheduleTime}</span> (Brasília) — inicia sozinha
                  </p>
                </div>
              ) : (
                <div className="mt-4 p-4 bg-orange-500/10 border-2 border-orange-500/30 rounded-xl">
                  <p className="text-base text-orange-300 font-bold">
                    ⚡ Sem agendamento → inicia <span className="text-white">na hora</span>, dentro do horário de trabalho da campanha
                  </p>
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
                      <li>📌 Envia somente entre {workStart} e {workEnd} (horário de Brasília)</li>
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

          {/* ══ 7. PAUSA AUTOMÁTICA ══ */}
          <div className={sectionCls}>
            <div className="flex items-center gap-4 mb-6">
              <StepBadge n={7} />
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
          {(finalSenders.length > 0 && finalSubjects.length > 0 && recipientCount > 0) && (
            <div className="bg-gradient-to-r from-orange-500/20 to-orange-600/20 backdrop-blur-xl border-2 border-orange-500/40 rounded-2xl p-6 shadow-xl">
              <h3 className="text-xl font-bold text-orange-300 mb-4 flex items-center gap-2"><FaChartLine /> Resumo da Campanha</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div className="bg-white/5 rounded-xl p-3"><span className="text-gray-400">Domínios:</span><br /><span className="text-white font-bold">{domainIds.length} selecionado{domainIds.length > 1 ? 's' : ''}</span></div>
                <div className="bg-white/5 rounded-xl p-3"><span className="text-gray-400">Remetentes:</span><br /><span className="text-white font-bold">{finalSenders.length} (rotação)</span></div>
                <div className="bg-white/5 rounded-xl p-3"><span className="text-gray-400">Assuntos:</span><br /><span className="text-white font-bold">{finalSubjects.length} cadastrado{finalSubjects.length > 1 ? 's' : ''}</span></div>
                <div className="bg-white/5 rounded-xl p-3"><span className="text-gray-400">Modelos:</span><br /><span className="text-white font-bold">{Math.max(finalBodies.length, 1)} (rotação)</span></div>
                <div className="bg-white/5 rounded-xl p-3"><span className="text-gray-400">Contatos:</span><br /><span className="text-white font-bold">{recipientCount.toLocaleString('pt-BR')}</span></div>
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

      <EmailRestrictionCheckModal
        isOpen={restrictionModalOpen}
        result={restrictionResult}
        onClose={() => { setRestrictionModalOpen(false); setSaving(false); }}
        onExcludeRestricted={() =>
          createCampaignPayload({
            ignoreRestrictions: false,
            excludeEmails: restrictionResult?.restricted_emails || [],
          })
        }
        onKeepAll={() =>
          createCampaignPayload({
            ignoreRestrictions: true,
            excludeEmails: [],
          })
        }
        actionLabelExclude="Excluir restritos e criar campanha"
        actionLabelKeep="Manter todos e criar campanha"
      />
    </>
  );
}
