import { useCallback, useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  FaBold, FaItalic, FaUnderline, FaListUl, FaListOl, FaLink, FaUnlink,
  FaAlignLeft, FaAlignCenter, FaAlignRight, FaWhatsapp, FaEye, FaCode,
  FaUndo, FaRedo, FaEraser, FaTimes, FaHighlighter,
} from 'react-icons/fa';

type Accent = 'blue' | 'orange' | 'purple';

interface EmailBodyEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  accent?: Accent;
}

const ACCENT: Record<Accent, { btn: string; active: string; ring: string; modal: string }> = {
  blue: {
    btn: 'hover:bg-blue-500/20 hover:text-blue-300',
    active: 'bg-blue-500/30 text-blue-200',
    ring: 'focus-within:border-blue-500/60',
    modal: 'border-blue-500/40',
  },
  orange: {
    btn: 'hover:bg-orange-500/20 hover:text-orange-300',
    active: 'bg-orange-500/30 text-orange-200',
    ring: 'focus-within:border-orange-500/60',
    modal: 'border-orange-500/40',
  },
  purple: {
    btn: 'hover:bg-purple-500/20 hover:text-purple-300',
    active: 'bg-purple-500/30 text-purple-200',
    ring: 'focus-within:border-purple-500/60',
    modal: 'border-purple-500/40',
  },
};

function plainToHtml(text: string): string {
  const t = String(text || '');
  if (!t.trim()) return '';
  if (/<\s*(p|div|br|table|ul|ol|li|h[1-6]|span|a|strong|em)\b/i.test(t)) return t;
  return t
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\r\n/g, '\n')
    .replace(/\n/g, '<br>');
}

/** Monta link WhatsApp; Mailgun rastreia o clique no <a href> */
export function buildWhatsAppLink(phoneRaw: string, message: string): string {
  let digits = String(phoneRaw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length <= 11 && !digits.startsWith('55')) digits = `55${digits}`;
  const text = encodeURIComponent(String(message || '').trim());
  return text ? `https://wa.me/${digits}?text=${text}` : `https://wa.me/${digits}`;
}

export default function EmailBodyEditor({
  value,
  onChange,
  placeholder = 'Digite ou cole o conteúdo do e-mail...',
  minHeight = 280,
  accent = 'blue',
}: EmailBodyEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastEmitted = useRef<string>('');
  const seeded = useRef(false);
  const [mode, setMode] = useState<'visual' | 'html' | 'preview'>('visual');
  const [htmlSource, setHtmlSource] = useState('');
  const [showLink, setShowLink] = useState(false);
  const [showWa, setShowWa] = useState(false);
  const [linkUrl, setLinkUrl] = useState('https://');
  const [linkText, setLinkText] = useState('');
  const [waPhone, setWaPhone] = useState('');
  const [waMessage, setWaMessage] = useState('');
  const [waLabel, setWaLabel] = useState('Falar no WhatsApp');
  const [textColor, setTextColor] = useState('#111111');
  const [highlightColor, setHighlightColor] = useState('#fff59d');
  /** Marcador ligado = o que digitar sai marcado; desligado = digita sem marca */
  const [highlightOn, setHighlightOn] = useState(false);
  const textColorRef = useRef(textColor);
  const highlightColorRef = useRef(highlightColor);
  const highlightOnRef = useRef(highlightOn);
  textColorRef.current = textColor;
  highlightColorRef.current = highlightColor;
  highlightOnRef.current = highlightOn;
  const colors = ACCENT[accent];

  const readEditorHtml = () => {
    const el = editorRef.current;
    if (!el) return '';
    const html = el.innerHTML;
    // contentEditable vazio às vezes fica só com <br>
    if (!html || html === '<br>' || html === '<div><br></div>' || html === '<p><br></p>') return '';
    return html;
  };

  const emit = useCallback((html?: string) => {
    const next = html !== undefined ? html : readEditorHtml();
    lastEmitted.current = next;
    onChange(next);
  }, [onChange]);

  // Semear conteúdo inicial / externo sem apagar o que o usuário digita
  useLayoutEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    const incoming = plainToHtml(value || '');

    // Primeira montagem
    if (!seeded.current) {
      el.innerHTML = incoming;
      lastEmitted.current = incoming;
      seeded.current = true;
      return;
    }

    // Atualização externa (ex.: carregar template) — só se o usuário NÃO estiver digitando
    if (document.activeElement === el) return;
    if (incoming === lastEmitted.current) return;
    if (incoming === el.innerHTML) {
      lastEmitted.current = incoming;
      return;
    }
    el.innerHTML = incoming;
    lastEmitted.current = incoming;
  }, [value]);

  const savedRange = useRef<Range | null>(null);
  const htmlTextareaRef = useRef<HTMLTextAreaElement>(null);

  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) {
      savedRange.current = sel.getRangeAt(0).cloneRange();
    }
  };

  const restoreSelection = () => {
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (!sel) return;
    if (savedRange.current) {
      try {
        sel.removeAllRanges();
        sel.addRange(savedRange.current);
        return;
      } catch { /* range inválido */ }
    }
    // Sem seleção salva: vai para o final
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  };

  const focusEditor = () => {
    restoreSelection();
  };

  const run = (cmd: string, val?: string) => {
    focusEditor();
    document.execCommand(cmd, false, val);
    emit();
    saveSelection();
  };

  const insertHtml = (html: string) => {
    focusEditor();
    document.execCommand('insertHTML', false, html);
    emit();
    saveSelection();
  };

  /** Remove cor ou fundo de um fragmento (e spans vazios), para poder trocar/tirar estilo */
  const stripPropFromTree = (root: Node, prop: 'color' | 'background-color') => {
    const toUnwrap: HTMLElement[] = [];
    const visit = (node: Node) => {
      if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
        Array.from(node.childNodes).forEach(visit);
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const el = node as HTMLElement;
      Array.from(el.childNodes).forEach(visit);

      if (prop === 'color') {
        el.style?.removeProperty('color');
        el.removeAttribute('color');
      } else {
        el.style?.removeProperty('background-color');
        el.style?.removeProperty('background');
      }

      const styleLeft = (el.getAttribute('style') || '').replace(/;+\s*$/, '').trim();
      if (!styleLeft) el.removeAttribute('style');
      const isWrapper =
        (el.tagName === 'SPAN' || el.tagName === 'FONT') &&
        !el.getAttribute('style') &&
        !el.getAttribute('class') &&
        !el.getAttribute('href') &&
        !el.getAttribute('color') &&
        !el.getAttribute('size') &&
        !el.getAttribute('face');
      if (isWrapper) toUnwrap.push(el);
    };
    visit(root);
    toUnwrap.reverse().forEach(el => {
      const parent = el.parentNode;
      if (!parent) return;
      while (el.firstChild) parent.insertBefore(el.firstChild, el);
      parent.removeChild(el);
    });
  };

  /**
   * Aplica ou remove cor/marca na seleção atual (trecho marcado).
   * value = null → remove o estilo.
   */
  const applyToSelection = (cssProp: 'color' | 'background-color', value: string | null) => {
    restoreSelection();
    const sel = window.getSelection();
    const editor = editorRef.current;
    if (!sel || sel.rangeCount === 0 || !editor) return false;
    let range = sel.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) {
      restoreSelection();
      if (!sel.rangeCount) return false;
      range = sel.getRangeAt(0);
    }
    if (range.collapsed) return false;

    const frag = range.extractContents();
    stripPropFromTree(frag, cssProp);

    if (value) {
      const span = document.createElement('span');
      if (cssProp === 'color') span.style.color = value;
      else span.style.backgroundColor = value;
      span.appendChild(frag);
      range.insertNode(span);
      try {
        const next = document.createRange();
        next.selectNodeContents(span);
        sel.removeAllRanges();
        sel.addRange(next);
      } catch { /* ignore */ }
    } else {
      const marker = document.createElement('span');
      marker.appendChild(frag);
      range.insertNode(marker);
      try {
        const next = document.createRange();
        next.selectNodeContents(marker);
        sel.removeAllRanges();
        sel.addRange(next);
      } catch { /* ignore */ }
      const parent = marker.parentNode;
      if (parent) {
        while (marker.firstChild) parent.insertBefore(marker.firstChild, marker);
        parent.removeChild(marker);
      }
    }

    editor.normalize();
    emit();
    saveSelection();
    return true;
  };

  /** Monta span com a cor/marca ATIVAS da barra (modo digitação) */
  const buildTypedSpan = (text: string) => {
    const span = document.createElement('span');
    span.style.color = textColorRef.current;
    if (highlightOnRef.current) {
      span.style.backgroundColor = highlightColorRef.current;
    }
    span.textContent = text;
    return span;
  };

  /**
   * Escolhe a cor ATIVA: o que digitar daqui pra frente sai nessa cor.
   * Se houver texto selecionado, pinta a seleção também.
   */
  const chooseTextColor = (color: string) => {
    setTextColor(color);
    textColorRef.current = color;
    restoreSelection();
    const sel = window.getSelection();
    const hasSelection = !!(sel && sel.rangeCount && !sel.getRangeAt(0).collapsed);
    if (hasSelection) applyToSelection('color', color);
    else saveSelection();
  };

  /** Volta a cor ativa para preto e, se houver seleção, remove cor customizada */
  const resetTextColor = () => {
    setTextColor('#111111');
    textColorRef.current = '#111111';
    restoreSelection();
    const sel = window.getSelection();
    if (sel && sel.rangeCount && !sel.getRangeAt(0).collapsed) {
      applyToSelection('color', '#111111');
    }
  };

  /**
   * Liga o marcador com essa cor: digitar marca; seleção marcada também.
   */
  const chooseHighlight = (color: string) => {
    setHighlightColor(color);
    setHighlightOn(true);
    highlightColorRef.current = color;
    highlightOnRef.current = true;
    restoreSelection();
    const sel = window.getSelection();
    if (sel && sel.rangeCount && !sel.getRangeAt(0).collapsed) {
      applyToSelection('background-color', color);
    }
  };

  /** Desliga o marcador: digitar sem marca; tira marca da seleção se houver */
  const turnOffHighlight = () => {
    setHighlightOn(false);
    highlightOnRef.current = false;
    restoreSelection();
    const sel = window.getSelection();
    if (sel && sel.rangeCount && !sel.getRangeAt(0).collapsed) {
      applyToSelection('background-color', null);
    }
  };

  /** Digitação: cada caractere respeita cor e marcador ativos da barra */
  const handleBeforeInput = (e: FormEvent<HTMLDivElement>) => {
    const ne = e.nativeEvent as InputEvent;
    if (ne.isComposing) return;
    if (ne.inputType !== 'insertText' || !ne.data) return;

    e.preventDefault();
    const sel = window.getSelection();
    const editor = editorRef.current;
    if (!sel || !sel.rangeCount || !editor) return;
    const range = sel.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return;

    if (!range.collapsed) range.deleteContents();

    const span = buildTypedSpan(ne.data);
    range.insertNode(span);
    range.setStartAfter(span);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
    emit();
    saveSelection();
  };

  const insertVariable = (token: string) => {
    if (mode === 'html') {
      const ta = htmlTextareaRef.current;
      if (!ta) {
        setHtmlSource(prev => `${prev}${token} `);
        return;
      }
      const start = ta.selectionStart ?? ta.value.length;
      const end = ta.selectionEnd ?? start;
      const next = `${ta.value.slice(0, start)}${token} ${ta.value.slice(end)}`;
      setHtmlSource(next);
      lastEmitted.current = next;
      onChange(next);
      requestAnimationFrame(() => {
        ta.focus();
        const pos = start + token.length + 1;
        ta.setSelectionRange(pos, pos);
      });
      return;
    }
    if (mode === 'preview') {
      setMode('visual');
    }
    restoreSelection();
    const sel = window.getSelection();
    const editor = editorRef.current;
    if (!sel || !editor) {
      insertHtml(`${token}&nbsp;`);
      return;
    }
    if (!sel.rangeCount) {
      const r = document.createRange();
      r.selectNodeContents(editor);
      r.collapse(false);
      sel.addRange(r);
    }
    const range = sel.getRangeAt(0);
    if (!range.collapsed) range.deleteContents();
    const span = buildTypedSpan(`${token} `);
    range.insertNode(span);
    range.setStartAfter(span);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
    emit();
    saveSelection();
  };

  const applyLink = () => {
    const url = linkUrl.trim();
    if (!url || url === 'https://') return;
    const label = (linkText.trim() || url).replace(/</g, '&lt;').replace(/>/g, '&gt;');
    insertHtml(`<a href="${url.replace(/"/g, '&quot;')}" target="_blank" rel="noopener noreferrer" style="color:#2563eb;text-decoration:underline">${label}</a>&nbsp;`);
    setShowLink(false);
    setLinkUrl('https://');
    setLinkText('');
  };

  const applyWhatsApp = () => {
    const url = buildWhatsAppLink(waPhone, waMessage);
    if (!url) return;
    const label = (waLabel.trim() || 'Falar no WhatsApp').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    insertHtml(
      `<a href="${url}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:#25D366;color:#ffffff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:bold">${label}</a>&nbsp;`
    );
    setShowWa(false);
    setWaPhone('');
    setWaMessage('');
    setWaLabel('Falar no WhatsApp');
  };

  const flushCurrent = (): string => {
    if (mode === 'visual') {
      const html = readEditorHtml();
      setHtmlSource(html);
      emit(html);
      return html;
    }
    if (mode === 'html') {
      emit(htmlSource);
      return htmlSource;
    }
    // preview: value já está atualizado
    return value || lastEmitted.current || '';
  };

  const switchMode = (next: 'visual' | 'html' | 'preview') => {
    if (next === mode) return;
    const html = flushCurrent();
    if (next === 'html') setHtmlSource(html);
    if (next === 'visual') {
      // Garante que o contentEditable (que permanece montado) reflita o HTML atual
      requestAnimationFrame(() => {
        const el = editorRef.current;
        if (!el) return;
        const incoming = plainToHtml(html || value || '');
        if (el.innerHTML !== incoming) el.innerHTML = incoming;
        lastEmitted.current = incoming;
      });
    }
    setMode(next);
  };

  const ToolBtn = ({
    title, onClick, active, children,
  }: { title: string; onClick: () => void; active?: boolean; children: ReactNode }) => (
    <button
      type="button"
      title={title}
      onMouseDown={e => e.preventDefault()}
      onClick={onClick}
      className={`p-2 rounded-lg text-sm transition-all ${active ? colors.active : `text-white/70 ${colors.btn}`}`}
    >
      {children}
    </button>
  );

  return (
    <div className={`rounded-xl border-2 border-white/20 bg-dark-700/80 overflow-hidden ${colors.ring}`}>
      <div className="flex flex-wrap items-center gap-0.5 p-2 border-b border-white/10 bg-dark-800/80">
        <ToolBtn title="Negrito" onClick={() => run('bold')}><FaBold /></ToolBtn>
        <ToolBtn title="Itálico" onClick={() => run('italic')}><FaItalic /></ToolBtn>
        <ToolBtn title="Sublinhado" onClick={() => run('underline')}><FaUnderline /></ToolBtn>
        <span className="w-px h-5 bg-white/15 mx-1" />
        <ToolBtn title="Alinhar esquerda" onClick={() => run('justifyLeft')}><FaAlignLeft /></ToolBtn>
        <ToolBtn title="Centralizar" onClick={() => run('justifyCenter')}><FaAlignCenter /></ToolBtn>
        <ToolBtn title="Alinhar direita" onClick={() => run('justifyRight')}><FaAlignRight /></ToolBtn>
        <span className="w-px h-5 bg-white/15 mx-1" />
        <ToolBtn title="Lista" onClick={() => run('insertUnorderedList')}><FaListUl /></ToolBtn>
        <ToolBtn title="Lista numerada" onClick={() => run('insertOrderedList')}><FaListOl /></ToolBtn>
        <span className="w-px h-5 bg-white/15 mx-1" />
        <select
          title="Tamanho do texto"
          aria-label="Tamanho do texto"
          className="bg-dark-700 text-white text-xs rounded-lg px-2.5 py-1.5 border border-white/20 cursor-pointer min-w-[110px] hover:border-white/40 focus:outline-none focus:border-orange-500/50"
          defaultValue="3"
          onFocus={saveSelection}
          onMouseDown={() => saveSelection()}
          onChange={e => {
            const size = e.target.value;
            restoreSelection();
            document.execCommand('fontSize', false, size);
            emit();
            saveSelection();
          }}
        >
          <option value="1">Muito pequeno</option>
          <option value="2">Pequeno</option>
          <option value="3">Normal</option>
          <option value="4">Grande</option>
          <option value="5">Maior</option>
          <option value="6">Enorme</option>
          <option value="7">Máximo</option>
        </select>
        <div className="flex items-center gap-0.5" onMouseDown={() => saveSelection()}>
          <label
            title="Cor ativa: o que você digitar sai nessa cor. Se marcar um trecho, pinta a seleção."
            className="relative w-8 h-8 rounded border border-white/20 cursor-pointer overflow-hidden flex items-center justify-center bg-white/10"
          >
            <span className="text-[10px] font-black text-white leading-none pointer-events-none" aria-hidden>A</span>
            <span
              className="absolute bottom-0 left-0 right-0 h-1.5 pointer-events-none"
              style={{ background: textColor }}
            />
            <input
              type="color"
              aria-label="Cor do texto"
              value={textColor}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              onFocus={saveSelection}
              onMouseDown={() => saveSelection()}
              onInput={e => setTextColor((e.target as HTMLInputElement).value)}
              onChange={e => chooseTextColor(e.target.value)}
            />
          </label>
          <button
            type="button"
            title="Cor ativa = preto"
            onMouseDown={e => e.preventDefault()}
            onClick={resetTextColor}
            className="px-1.5 h-8 rounded text-[10px] font-bold text-white/60 hover:text-white hover:bg-white/10 border border-white/10"
          >
            ×A
          </button>
        </div>
        <div className="flex items-center gap-0.5" onMouseDown={() => saveSelection()}>
          <label
            title={highlightOn
              ? 'Marcador LIGADO: o que digitar fica marcado. Clique ×▮ para desligar.'
              : 'Marcador DESLIGADO: escolha uma cor para ligar. Com trecho selecionado, marca a seleção.'}
            className={`relative w-8 h-8 rounded border cursor-pointer overflow-hidden flex items-center justify-center ${
              highlightOn ? 'border-yellow-400 bg-yellow-500/20' : 'border-white/20 bg-white/10'
            }`}
          >
            <FaHighlighter className={`text-sm pointer-events-none ${highlightOn ? 'text-yellow-200' : 'text-white/40'}`} />
            <span
              className="absolute bottom-0 left-0 right-0 h-1.5 pointer-events-none"
              style={{ background: highlightOn ? highlightColor : 'transparent' }}
            />
            <input
              type="color"
              aria-label="Marcar texto"
              value={highlightColor}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              onFocus={saveSelection}
              onMouseDown={() => saveSelection()}
              onInput={e => setHighlightColor((e.target as HTMLInputElement).value)}
              onChange={e => chooseHighlight(e.target.value)}
            />
          </label>
          <button
            type="button"
            title="Desligar marcador"
            onMouseDown={e => e.preventDefault()}
            onClick={turnOffHighlight}
            className={`px-1.5 h-8 rounded text-[10px] font-bold border ${
              highlightOn
                ? 'text-yellow-200 border-yellow-500/40 hover:bg-yellow-500/20'
                : 'text-white/40 border-white/10 hover:bg-white/10'
            }`}
          >
            ×▮
          </button>
        </div>
        <span className="w-px h-5 bg-white/15 mx-1" />
        <ToolBtn title="Inserir link" onClick={() => { setShowLink(true); setLinkText(''); }}><FaLink /></ToolBtn>
        <ToolBtn title="Remover link" onClick={() => run('unlink')}><FaUnlink /></ToolBtn>
        <ToolBtn title="Link WhatsApp" onClick={() => setShowWa(true)}>
          <FaWhatsapp className="text-green-400" />
        </ToolBtn>
        <span className="w-px h-5 bg-white/15 mx-1" />
        <ToolBtn title="Desfazer" onClick={() => run('undo')}><FaUndo /></ToolBtn>
        <ToolBtn title="Refazer" onClick={() => run('redo')}><FaRedo /></ToolBtn>
        <ToolBtn title="Limpar formatação da seleção" onClick={() => {
          applyToSelection('background-color', null);
          applyToSelection('color', null);
          run('removeFormat');
        }}><FaEraser /></ToolBtn>
        <div className="flex-1" />
        <ToolBtn title="Visual" active={mode === 'visual'} onClick={() => switchMode('visual')}><span className="text-xs font-bold">VISUAL</span></ToolBtn>
        <ToolBtn title="HTML" active={mode === 'html'} onClick={() => switchMode('html')}><FaCode /></ToolBtn>
        <ToolBtn title="Prévia" active={mode === 'preview'} onClick={() => switchMode('preview')}><FaEye /></ToolBtn>
      </div>

      {/* Mantém o editor montado (display) para não perder o texto ao mudar de modo */}
      <div style={{ display: mode === 'visual' ? 'block' : 'none' }}>
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onBeforeInput={handleBeforeInput}
          onInput={() => { emit(); saveSelection(); }}
          onKeyUp={saveSelection}
          onMouseUp={saveSelection}
          onBlur={() => { saveSelection(); emit(); }}
          data-placeholder={placeholder}
          className="email-body-editor px-4 py-3 text-[15px] leading-relaxed outline-none overflow-y-auto bg-white"
          style={{ minHeight, color: '#111111', caretColor: textColor }}
        />
      </div>

      {mode === 'html' && (
        <textarea
          ref={htmlTextareaRef}
          value={htmlSource}
          onChange={e => {
            setHtmlSource(e.target.value);
            lastEmitted.current = e.target.value;
            onChange(e.target.value);
          }}
          className="w-full px-4 py-3 bg-dark-900 text-green-300 font-mono text-sm outline-none resize-y"
          style={{ minHeight }}
          spellCheck={false}
        />
      )}

      {mode === 'preview' && (
        <div
          className="px-4 py-3 bg-white overflow-y-auto prose max-w-none"
          style={{ minHeight, color: '#111111' }}
          dangerouslySetInnerHTML={{ __html: value || lastEmitted.current || '<p style="color:#999">Sem conteúdo</p>' }}
        />
      )}

      {/* Variáveis — só embaixo, como botões */}
      <div className="px-4 py-3 border-t border-white/10 bg-dark-900/40 space-y-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-white/50 mb-2">Contato</p>
          <div className="flex flex-wrap gap-1.5">
            {[
              { token: '{{nome}}', tip: 'Nome completo do destinatário' },
              { token: '{{primeiro_nome}}', tip: 'Só o primeiro nome (mesmo com nome completo na lista)' },
              { token: '{{email}}', tip: 'E-mail do destinatário' },
              { token: '{{cpf}}', tip: 'CPF' },
              { token: '{{telefone}}', tip: 'Telefone' },
              { token: '{{var1}}', tip: 'Variável 1' },
              { token: '{{var2}}', tip: 'Variável 2' },
              { token: '{{var3}}', tip: 'Variável 3' },
              { token: '{{var4}}', tip: 'Variável 4' },
              { token: '{{var5}}', tip: 'Variável 5' },
            ].map(({ token, tip }) => (
              <button
                key={token}
                type="button"
                title={tip}
                onMouseDown={e => e.preventDefault()}
                onClick={() => insertVariable(token)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-mono border border-white/15 bg-white/5 text-white/85 transition-all ${colors.btn} hover:border-white/30`}
              >
                {token}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-white/50 mb-2">Sistema</p>
          <div className="flex flex-wrap gap-1.5">
            {[
              { token: '{{saudacao}}', tip: 'Bom dia / Boa tarde / Boa noite' },
              { token: '{{hora}}', tip: 'Hora:minuto:segundo' },
              { token: '{{data}}', tip: 'Dia/mês/ano' },
              { token: '{{protocolo}}', tip: 'Protocolo de 10 dígitos' },
            ].map(({ token, tip }) => (
              <button
                key={token}
                type="button"
                title={tip}
                onMouseDown={e => e.preventDefault()}
                onClick={() => insertVariable(token)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-mono border border-cyan-500/30 bg-cyan-500/10 text-cyan-200 transition-all hover:bg-cyan-500/20 hover:border-cyan-400/50`}
              >
                {token}
              </button>
            ))}
          </div>
        </div>
        <p className="text-[11px] text-white/40">Clique no botão para inserir no ponto do cursor.</p>
      </div>

      {showLink && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className={`bg-dark-800 rounded-2xl border-2 ${colors.modal} w-full max-w-md p-6 space-y-4 shadow-2xl`}>
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-black text-white flex items-center gap-2"><FaLink /> Inserir link</h3>
              <button type="button" onClick={() => setShowLink(false)} className="text-white/50 hover:text-white"><FaTimes /></button>
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-1">URL</label>
              <input value={linkUrl} onChange={e => setLinkUrl(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-dark-700 border border-white/15 text-white" placeholder="https://..." />
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-1">Texto do link</label>
              <input value={linkText} onChange={e => setLinkText(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-dark-700 border border-white/15 text-white" placeholder="Clique aqui" />
            </div>
            <button type="button" onClick={applyLink} className="w-full py-3 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold">Inserir</button>
          </div>
        </div>
      )}

      {showWa && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-dark-800 rounded-2xl border-2 border-green-500/40 w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-black text-white flex items-center gap-2"><FaWhatsapp className="text-green-400" /> Link WhatsApp</h3>
              <button type="button" onClick={() => setShowWa(false)} className="text-white/50 hover:text-white"><FaTimes /></button>
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-1">Telefone (com DDD)</label>
              <input value={waPhone} onChange={e => setWaPhone(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-dark-700 border border-white/15 text-white" placeholder="(11) 90000-0000" />
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-1">Mensagem pré-preenchida</label>
              <textarea value={waMessage} onChange={e => setWaMessage(e.target.value)} rows={3}
                className="w-full px-3 py-2.5 rounded-xl bg-dark-700 border border-white/15 text-white resize-y"
                placeholder="Olá! Quero fazer uma simulação." />
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-1">Texto do botão/link</label>
              <input value={waLabel} onChange={e => setWaLabel(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-dark-700 border border-white/15 text-white" />
            </div>
            {waPhone && (
              <p className="text-xs text-green-300/80 font-mono break-all">{buildWhatsAppLink(waPhone, waMessage)}</p>
            )}
            <button type="button" onClick={applyWhatsApp} disabled={!String(waPhone).replace(/\D/g, '')}
              className="w-full py-3 rounded-xl bg-green-500 hover:bg-green-600 text-white font-bold disabled:opacity-40">
              Inserir link WhatsApp
            </button>
          </div>
        </div>
      )}

      <style jsx global>{`
        .email-body-editor:empty:before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
        }
        /* NÃO forçar color:inherit nos filhos — isso anulava foreColor / destaque */
        .email-body-editor {
          color: #111111;
        }
        .email-body-editor a { color: #2563eb; text-decoration: underline; }
        .email-body-editor ul { list-style: disc; padding-left: 1.5rem; margin: 0.5rem 0; }
        .email-body-editor ol { list-style: decimal; padding-left: 1.5rem; margin: 0.5rem 0; }
        .email-body-editor p { margin: 0.5rem 0; }
      `}</style>
    </div>
  );
}
