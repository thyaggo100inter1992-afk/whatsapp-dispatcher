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

/**
 * Substitui {{nome}} / {{email}} de forma robusta (espaços, tags no meio, case).
 * Deve ser chamado no HTML final antes do envio.
 */
export function applyEmailVariables(
  content: string | null | undefined,
  vars: { nome?: string | null; email?: string | null; cpf?: string | null; telefone?: string | null; phone?: string | null },
  opts?: { escapeValues?: boolean }
): string {
  if (content == null || content === '') return '';
  let s = stripInvisible(String(content));

  const nomeRaw = String(vars.nome || vars.email || '').trim();
  const emailRaw = String(vars.email || '').trim();
  const cpfRaw = String(vars.cpf || '').trim();
  const phoneRaw = String(vars.telefone || vars.phone || '').trim();
  const nome = opts?.escapeValues === false ? nomeRaw : escapeHtml(nomeRaw);
  const email = opts?.escapeValues === false ? emailRaw : escapeHtml(emailRaw);
  const cpf = opts?.escapeValues === false ? cpfRaw : escapeHtml(cpfRaw);
  const telefone = opts?.escapeValues === false ? phoneRaw : escapeHtml(phoneRaw);

  // {{nome}} / {{ nome }} / {{<span>nome</span>}} / com zero-width
  const nomeRe = /\{\{(?:\s|<[^>]*>)*nome(?:\s|<[^>]*>)*\}\}/gi;
  const nameRe = /\{\{(?:\s|<[^>]*>)*name(?:\s|<[^>]*>)*\}\}/gi;
  const emailRe = /\{\{(?:\s|<[^>]*>)*e-?mail(?:\s|<[^>]*>)*\}\}/gi;
  const cpfRe = /\{\{(?:\s|<[^>]*>)*cpf(?:\s|<[^>]*>)*\}\}/gi;
  const telRe = /\{\{(?:\s|<[^>]*>)*(?:telefone|phone|celular)(?:\s|<[^>]*>)*\}\}/gi;

  s = s.replace(nomeRe, nome);
  s = s.replace(nameRe, nome);
  s = s.replace(emailRe, email);
  s = s.replace(cpfRe, cpf);
  s = s.replace(telRe, telefone);

  // Fallback: se ainda restar {{nome}} “quebrado” por spans em volta das chaves
  s = s.replace(/\{\{[\s\u200B]*n[\s\u200B]*o[\s\u200B]*m[\s\u200B]*e[\s\u200B]*\}\}/gi, nome);
  s = s.replace(/\{\{[\s\u200B]*e[\s\u200B]*m[\s\u200B]*a[\s\u200B]*i[\s\u200B]*l[\s\u200B]*\}\}/gi, email);

  return s;
}

/**
 * Garante corpo HTML com quebras de linha preservadas.
 * Texto colado sem tags vira HTML com <br>; HTML real permanece.
 */
export function ensureEmailHtml(html?: string | null, text?: string | null): { html?: string; text: string } {
  const rawHtml = String(html || '').trim();
  const rawText = String(text || '').trim();

  if (!rawHtml && !rawText) {
    return { html: undefined, text: 'Por favor, habilite HTML para visualizar este e-mail.' };
  }

  // Só texto plano → HTML formatado
  if (!rawHtml && rawText) {
    const body = escapeHtml(rawText).replace(/\r\n/g, '\n').replace(/\n/g, '<br>\n');
    return {
      html: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#222222">${body}</div>`,
      text: rawText,
    };
  }

  // Campo HTML na verdade é texto simples (sem tags de estrutura)
  if (rawHtml && !looksLikeHtml(rawHtml)) {
    const plain = rawHtml.replace(/\r\n/g, '\n');
    const body = escapeHtml(plain).replace(/\n/g, '<br>\n');
    return {
      html: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#222222">${body}</div>`,
      text: rawText || plain,
    };
  }

  // HTML com quebras literais mas sem <br>/<p> — preserva Enter
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
