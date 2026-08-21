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
