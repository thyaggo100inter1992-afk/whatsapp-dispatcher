/** Detecta se o conteúdo já parece HTML estruturado */
export function looksLikeHtml(content: string): boolean {
  return /<\s*(p|div|br|table|tr|td|ul|ol|li|h[1-6]|span|strong|em|a|img|html|body)\b/i.test(content);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Remove caracteres invisíveis que o editor rico às vezes coloca */
function stripInvisible(s: string): string {
  return s.replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '');
}

/** Extrai só o primeiro nome de um nome completo (ex.: "João Silva Santos" → "João") */
export function extractFirstName(fullName: string | null | undefined): string {
  const raw = String(fullName || '').trim().replace(/\s+/g, ' ');
  if (!raw) return '';
  // Se parece e-mail (fallback quando nome = email), usa a parte antes do @
  if (raw.includes('@')) {
    const local = raw.split('@')[0] || '';
    const token = local.split(/[._+-]/)[0] || local;
    return token ? token.charAt(0).toUpperCase() + token.slice(1).toLowerCase() : '';
  }
  return raw.split(' ')[0] || '';
}

export type EmailMergeVars = {
  nome?: string | null;
  email?: string | null;
  cpf?: string | null;
  telefone?: string | null;
  phone?: string | null;
  var1?: string | null;
  var2?: string | null;
  var3?: string | null;
  var4?: string | null;
  var5?: string | null;
  /** Variáveis de sistema (opcionais — se omitidas, são geradas) */
  hora?: string | null;
  data?: string | null;
  protocolo?: string | null;
  saudacao?: string | null;
};

/** Gera 10 dígitos aleatórios para protocolo */
export function generateProtocol(): string {
  let s = '';
  for (let i = 0; i < 10; i++) s += Math.floor(Math.random() * 10).toString();
  return s;
}

/** Detecta se o conteúdo referencia uma variável {{nome}} (tolerante a espaços/tags) */
export function contentUsesEmailVar(content: string | null | undefined, varKey: string): boolean {
  if (!content) return false;
  const key = String(varKey || '').trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!key) return false;
  const re = new RegExp(`\\{\\{(?:\\s|<[^>]*>)*${key}(?:\\s|<[^>]*>)*\\}\\}`, 'i');
  return re.test(String(content));
}

/** Quais chaves de variável aparecem no texto (html/assunto/etc.) */
export function detectUsedEmailVars(...parts: Array<string | null | undefined>): {
  protocolo: boolean;
  var1: boolean;
  var2: boolean;
  var3: boolean;
  var4: boolean;
  var5: boolean;
  cpf: boolean;
  telefone: boolean;
  nome: boolean;
  primeiro_nome: boolean;
  email: boolean;
  saudacao: boolean;
  hora: boolean;
  data: boolean;
} {
  const blob = parts.map(p => String(p || '')).join('\n');
  const has = (k: string) => contentUsesEmailVar(blob, k);
  return {
    protocolo: has('protocolo'),
    var1: has('var1') || has('variavel1'),
    var2: has('var2') || has('variavel2'),
    var3: has('var3') || has('variavel3'),
    var4: has('var4') || has('variavel4'),
    var5: has('var5') || has('variavel5'),
    cpf: has('cpf'),
    telefone: has('telefone') || has('phone') || has('celular'),
    nome: has('nome') || has('name'),
    primeiro_nome: has('primeiro_nome') || has('primeironome') || has('first_name') || has('firstname'),
    email: has('email') || has('e-mail'),
    saudacao: has('saudacao') || has('dia'),
    hora: has('hora'),
    data: has('data'),
  };
}

/** Data/hora/saudação no fuso de Brasília */
export function buildSystemEmailVars(now = new Date(), protocol?: string | null): {
  hora: string;
  data: string;
  protocolo: string;
  saudacao: string;
} {
  const fmt = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const get = (t: string) => parts.find(p => p.type === t)?.value || '00';
  const hour = parseInt(get('hour'), 10);
  const hora = `${get('hour')}:${get('minute')}:${get('second')}`;

  const dataFmt = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const data = dataFmt.format(now);

  let saudacao = 'Boa noite';
  if (hour >= 5 && hour < 12) saudacao = 'Bom dia';
  else if (hour >= 12 && hour < 18) saudacao = 'Boa tarde';
  else if (hour >= 18 && hour < 24) saudacao = 'Boa noite';
  else saudacao = 'Boa madrugada'; // 0–4

  return {
    hora,
    data,
    protocolo: protocol && String(protocol).trim() ? String(protocol).trim() : generateProtocol(),
    saudacao,
  };
}

/**
 * Substitui {{nome}}, {{primeiro_nome}}, {{email}}, {{cpf}}, {{telefone}}, {{var1}}…{{var5}},
 * {{hora}}, {{data}}, {{protocolo}}, {{saudacao}} de forma robusta.
 */
export function applyEmailVariables(
  content: string | null | undefined,
  vars: EmailMergeVars,
  opts?: { escapeValues?: boolean }
): string {
  if (content == null || content === '') return '';
  let s = stripInvisible(String(content));

  const sys = buildSystemEmailVars(new Date(), vars.protocolo);
  const nomeCompleto = String(vars.nome || vars.email || '').trim();
  const primeiroNome = extractFirstName(vars.nome || vars.email || '');

  const rawMap: Record<string, string> = {
    nome: nomeCompleto,
    name: nomeCompleto,
    primeiro_nome: primeiroNome,
    primeironome: primeiroNome,
    first_name: primeiroNome,
    firstname: primeiroNome,
    email: String(vars.email || '').trim(),
    cpf: String(vars.cpf || '').trim(),
    telefone: String(vars.telefone || vars.phone || '').trim(),
    phone: String(vars.telefone || vars.phone || '').trim(),
    celular: String(vars.telefone || vars.phone || '').trim(),
    var1: String(vars.var1 || '').trim(),
    var2: String(vars.var2 || '').trim(),
    var3: String(vars.var3 || '').trim(),
    var4: String(vars.var4 || '').trim(),
    var5: String(vars.var5 || '').trim(),
    variavel1: String(vars.var1 || '').trim(),
    variavel2: String(vars.var2 || '').trim(),
    variavel3: String(vars.var3 || '').trim(),
    variavel4: String(vars.var4 || '').trim(),
    variavel5: String(vars.var5 || '').trim(),
    hora: String(vars.hora || sys.hora).trim(),
    data: String(vars.data || sys.data).trim(),
    protocolo: String(vars.protocolo || sys.protocolo).trim(),
    saudacao: String(vars.saudacao || sys.saudacao).trim(),
    dia: String(vars.saudacao || sys.saudacao).trim(),
  };

  const esc = opts?.escapeValues === false
    ? (v: string) => v
    : (v: string) => escapeHtml(v);

  for (const [key, value] of Object.entries(rawMap)) {
    const re = new RegExp(`\\{\\{(?:\\s|<[^>]*>)*${key}(?:\\s|<[^>]*>)*\\}\\}`, 'gi');
    s = s.replace(re, esc(value));
  }

  // Fallbacks quebrados por zero-width
  s = s.replace(/\{\{[\s\u200B]*n[\s\u200B]*o[\s\u200B]*m[\s\u200B]*e[\s\u200B]*\}\}/gi, esc(rawMap.nome));
  s = s.replace(/\{\{[\s\u200B]*e[\s\u200B]*m[\s\u200B]*a[\s\u200B]*i[\s\u200B]*l[\s\u200B]*\}\}/gi, esc(rawMap.email));

  return s;
}

/**
 * Garante corpo HTML com quebras de linha preservadas.
 * Texto plano vira HTML com <br>; HTML real permanece.
 */
export function ensureEmailHtml(html?: string | null, text?: string | null): { html?: string; text: string } {
  const rawHtml = String(html || '').trim();
  const rawText = String(text || '').trim();

  if (!rawHtml && !rawText) {
    return { html: undefined, text: 'Por favor, habilite HTML para visualizar este e-mail.' };
  }

  if (!rawHtml && rawText) {
    const body = escapeHtml(rawText).replace(/\r\n/g, '\n').replace(/\n/g, '<br>\n');
    return {
      html: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#222222">${body}</div>`,
      text: rawText,
    };
  }

  if (rawHtml && !looksLikeHtml(rawHtml)) {
    const plain = rawHtml.replace(/\r\n/g, '\n');
    const body = escapeHtml(plain).replace(/\n/g, '<br>\n');
    return {
      html: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#222222">${body}</div>`,
      text: rawText || plain,
    };
  }

  if (rawHtml && !/<\s*br\s*\/?>/i.test(rawHtml) && !/<\s*p[\s>]/i.test(rawHtml) && /\n/.test(rawHtml)) {
    const withBreaks = rawHtml.replace(/\r\n/g, '\n').replace(/\n/g, '<br>\n');
    return {
      html: withBreaks,
      text: rawText || rawHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || 'Por favor, habilite HTML para visualizar este e-mail.',
    };
  }

  return {
    html: rawHtml,
    text: rawText || rawHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || 'Por favor, habilite HTML para visualizar este e-mail.',
  };
}
