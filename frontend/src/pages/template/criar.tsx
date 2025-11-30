import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { 
  FaPlus, FaTrash, FaCheckCircle, FaExclamationTriangle,
  FaTimesCircle, FaRocket, FaInfoCircle, FaArrowLeft, FaMobileAlt
} from 'react-icons/fa';
import api, { whatsappAccountsAPI } from '@/services/api';
import ToastContainer from '@/components/ToastContainer';
import { useToast } from '@/hooks/useToast';
import TemplatePreview from '@/components/TemplatePreview';

interface WhatsAppAccount {
  id: number;
  name: string;
  phone_number: string;
  is_active: boolean;
}

interface TemplateVariable {
  id: string;
  placeholder: number;
  example: string;
}

interface QuickReplyButton {
  id: string;
  text: string;
}

interface CallButton {
  id: string;
  text: string;
  phoneNumber: string;
}

interface UrlButton {
  id: string;
  text: string;
  url: string;
  urlType: 'static' | 'dynamic';
}

interface CopyCodeButton {
  id: string;
  example: string;
}

interface UploadedMedia {
  file: File;
  preview?: string;
  type: 'image' | 'video' | 'audio' | 'document';
}

interface CreateResult {
  accountId: number;
  accountName?: string;
  phoneNumber: string;
  success: boolean;
  message?: string;
  error?: string;
  templateId?: string;
  status?: string;
  category?: string;
}

export default function CriarTemplate() {
  const router = useRouter();
  const toast = useToast();
  
  const [templateName, setTemplateName] = useState('');
  const [category, setCategory] = useState<'MARKETING' | 'UTILITY'>('MARKETING');
  const [language, setLanguage] = useState('pt_BR');
  
  const [hasHeader, setHasHeader] = useState(false);
  const [headerType, setHeaderType] = useState<'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'AUDIO'>('TEXT');
  const [headerText, setHeaderText] = useState('');
  
  const [bodyText, setBodyText] = useState('');
  const [bodyVariables, setBodyVariables] = useState<TemplateVariable[]>([]);
  
  const [hasFooter, setHasFooter] = useState(false);
  const [footerText, setFooterText] = useState('');
  
  const [quickReplyButtons, setQuickReplyButtons] = useState<QuickReplyButton[]>([]);
  const [callButtons, setCallButtons] = useState<CallButton[]>([]);
  const [urlButtons, setUrlButtons] = useState<UrlButton[]>([]);
  const [copyCodeButtons, setCopyCodeButtons] = useState<CopyCodeButton[]>([]);
  
  // Calcular total de botões (máximo 3)
  const totalButtons = quickReplyButtons.length + callButtons.length + urlButtons.length + copyCodeButtons.length;
  const canAddMoreButtons = totalButtons < 3;
  
  const [headerMediaFile, setHeaderMediaFile] = useState<File | null>(null);
  const [headerMediaPreview, setHeaderMediaPreview] = useState<string>('');
  const [headerMediaUrl, setHeaderMediaUrl] = useState<string>(''); // URL externa da imagem
  
  const [showPreview, setShowPreview] = useState(false);
  const [showMobilePreview, setShowMobilePreview] = useState(false);
  
  const [accounts, setAccounts] = useState<WhatsAppAccount[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<number[]>([]);
  
  // Debug: Log o state atual das contas sempre que mudar
  useEffect(() => {
    console.log('🔄 State de accounts atualizado:', accounts.length, 'contas');
    if (accounts.length === 0) {
      console.warn('⚠️ ATENÇÃO: State de accounts está vazio!');
    }
  }, [accounts]);
  
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [results, setResults] = useState<CreateResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  
  const [deleteOriginal, setDeleteOriginal] = useState(false);
  const [originalName, setOriginalName] = useState('');
  const [originalAccountId, setOriginalAccountId] = useState<number | null>(null);

  useEffect(() => {
    console.log('🚀 COMPONENTE MONTADO - Iniciando carregamento de contas...');
    
    // Tentar carregar do backup primeiro (rápido)
    try {
      const backup = localStorage.getItem('whatsapp_accounts_backup');
      if (backup) {
        const backedUpAccounts = JSON.parse(backup);
        if (Array.isArray(backedUpAccounts) && backedUpAccounts.length > 0) {
          console.log('⚡ Carregando', backedUpAccounts.length, 'contas do cache (rápido)');
          setAccounts(backedUpAccounts);
        }
      }
    } catch (e) {
      console.warn('Não foi possível carregar backup:', e);
    }
    
    // Depois carregar da API (atualizado)
    loadAccounts();
    
    const urlParams = new URLSearchParams(window.location.search);
    const editParam = urlParams.get('edit');
    if (editParam) {
      try {
        const templateData = JSON.parse(decodeURIComponent(editParam));
        loadTemplateForEdit(templateData);
      } catch (error) {
        console.error('Erro ao carregar dados do template:', error);
      }
    }
    
    // Cleanup para detectar quando o componente é desmontado
    return () => {
      console.log('🗑️ COMPONENTE DESMONTADO');
    };
  }, []);

  // Auto-refresh dos status a cada 10 segundos
  useEffect(() => {
    if (!showResults || !autoRefresh) return;

    const interval = setInterval(() => {
      refreshTemplateStatus();
    }, 10000); // 10 segundos

    return () => clearInterval(interval);
  }, [showResults, autoRefresh, results]);

  const loadTemplateForEdit = (templateData: any) => {
    console.log('📝 Carregando template para editar:', templateData);
    
    setTemplateName(templateData.name || '');
    setCategory(templateData.category || 'MARKETING');
    setLanguage(templateData.language || 'pt_BR');
    
    if (templateData.accountId) {
      setSelectedAccountIds([templateData.accountId]);
      setOriginalAccountId(templateData.accountId);
    }
    
    if (templateData.deleteOriginal && templateData.originalName) {
      setDeleteOriginal(true);
      setOriginalName(templateData.originalName);
      console.log('🗑️ Template original será deletado após criação:', templateData.originalName);
    }
    
    if (templateData.components && Array.isArray(templateData.components)) {
      templateData.components.forEach((comp: any) => {
        if (comp.type === 'HEADER') {
          setHasHeader(true);
          if (comp.format) {
            setHeaderType(comp.format);
          }
          if (comp.text) {
            setHeaderText(comp.text);
          }
        } else if (comp.type === 'BODY') {
          setBodyText(comp.text || '');
          
          if (comp.example && comp.example.body_text && comp.example.body_text[0]) {
            const examples = comp.example.body_text[0];
            const vars: TemplateVariable[] = examples.map((ex: string, i: number) => ({
              id: `var_${i}`,
              placeholder: i + 1,
              example: ex,
            }));
            setBodyVariables(vars);
          }
        } else if (comp.type === 'FOOTER') {
          setHasFooter(true);
          setFooterText(comp.text || '');
        } else if (comp.type === 'BUTTONS' && comp.buttons) {
          const buttons = comp.buttons;
          
          // Separar botões por tipo
          const quickReplies: any[] = [];
          const calls: any[] = [];
          const urls: any[] = [];
          const copyCodes: any[] = [];
          
          buttons.forEach((btn: any, i: number) => {
            if (btn.type === 'QUICK_REPLY') {
              quickReplies.push({
                id: `qr_${i}`,
                text: btn.text || ''
              });
            } else if (btn.type === 'PHONE_NUMBER') {
              calls.push({
                id: `call_${i}`,
                text: btn.text || '',
                phoneNumber: btn.phone_number || ''
              });
            } else if (btn.type === 'URL') {
              urls.push({
                id: `url_${i}`,
                text: btn.text || '',
                url: btn.url || '',
                urlType: 'static'
              });
            } else if (btn.type === 'COPY_CODE') {
              copyCodes.push({
                id: `copy_${i}`,
                example: btn.example || ''
              });
            }
          });
          
          setQuickReplyButtons(quickReplies);
          setCallButtons(calls);
          setUrlButtons(urls);
          setCopyCodeButtons(copyCodes);
        }
      });
    }
  };

  const loadAccounts = async () => {
    try {
      console.log('🔍 Carregando contas do WhatsApp...');
      const response = await whatsappAccountsAPI.getActive();
      console.log('📋 Resposta da API:', response.data);
      
      // A resposta pode vir em diferentes formatos
      const accountsData = response.data.data || response.data || [];
      console.log('✅ Contas carregadas:', accountsData);
      console.log('📊 Número de contas:', accountsData.length);
      console.log('🔍 É array?', Array.isArray(accountsData));
      
      const finalAccounts = Array.isArray(accountsData) ? accountsData : [];
      console.log('💾 Salvando no state:', finalAccounts.length, 'contas');
      
      setAccounts(finalAccounts);
      
      // Salvar no localStorage como backup de emergência
      if (finalAccounts.length > 0) {
        try {
          localStorage.setItem('whatsapp_accounts_backup', JSON.stringify(finalAccounts));
          console.log('💾 Backup das contas salvo no localStorage');
        } catch (e) {
          console.warn('Não foi possível salvar backup:', e);
        }
      }
      
      // Log após set (será visível no próximo render)
      console.log('✅ setAccounts chamado com', finalAccounts.length, 'contas');
    } catch (error) {
      console.error('❌ Erro ao carregar contas:', error);
      
      // Tentar restaurar do backup
      try {
        const backup = localStorage.getItem('whatsapp_accounts_backup');
        if (backup) {
          const backedUpAccounts = JSON.parse(backup);
          if (Array.isArray(backedUpAccounts) && backedUpAccounts.length > 0) {
            console.log('🔄 Restaurando', backedUpAccounts.length, 'contas do backup');
            setAccounts(backedUpAccounts);
            toast.warning('⚠️ Usando contas do cache local');
            return;
          }
        }
      } catch (e) {
        console.error('Erro ao restaurar backup:', e);
      }
      
      toast.error('Erro ao carregar contas do WhatsApp');
      console.log('⚠️ Mantendo contas existentes no state (não limpando)');
      // NÃO limpar as contas se já houver contas carregadas!
      // Isso previne o bug de "contas desaparecendo" quando há erros
      // setAccounts([]); // REMOVIDO - mantém as contas existentes mesmo se houver erro
    }
  };

  const handleAccountToggle = (accountId: number) => {
    setSelectedAccountIds(prev => 
      prev.includes(accountId)
        ? prev.filter(id => id !== accountId)
        : [...prev, accountId]
    );
  };

  const addVariable = () => {
    const matches = bodyText.match(/\{\{(\d+)\}\}/g) || [];
    const placeholderNumbers = matches
      .map((match) => parseInt(match.replace(/[{}]/g, ''), 10))
      .filter((num) => !Number.isNaN(num));
    const nextVarNumber =
      placeholderNumbers.length > 0 ? Math.max(...placeholderNumbers) + 1 : 1;

    const newVariable: TemplateVariable = {
      id: `var_${Date.now()}`,
      placeholder: nextVarNumber,
      example: '',
    };

    setBodyVariables([...bodyVariables, newVariable]);
    setBodyText((prev) => `${prev}{{${nextVarNumber}}}`);
  };

  const removeVariable = (id: string) => {
    setBodyVariables((prev) => {
      const variableToRemove = prev.find((v) => v.id === id);

      if (variableToRemove) {
        const placeholderRegex = new RegExp(`\\{\\{${variableToRemove.placeholder}\\}\\}`);
        setBodyText((current) => current.replace(placeholderRegex, ''));
      }

      return prev.filter((v) => v.id !== id);
    });
  };

  const updateVariableExample = (id: string, example: string) => {
    setBodyVariables(bodyVariables.map(v => 
      v.id === id ? { ...v, example } : v
    ));
  };

  // Monitorar mudanças no bodyText e manter exemplos sincronizados com as variáveis do texto
  useEffect(() => {
    const matches = bodyText.match(/\{\{(\d+)\}\}/g) || [];
    const placeholders = matches
      .map((match) => parseInt(match.replace(/[{}]/g, ''), 10))
      .filter((num) => !Number.isNaN(num));

    setBodyVariables((prev) => {
      if (placeholders.length === 0) {
        return prev.length === 0 ? prev : [];
      }

      const usedIndices = new Set<number>();
      const updatedVariables = placeholders.map((placeholder, index) => {
        const existingIndex = prev.findIndex(
          (variable, idx) =>
            !usedIndices.has(idx) && variable.placeholder === placeholder
        );

        if (existingIndex !== -1) {
          usedIndices.add(existingIndex);
          return prev[existingIndex];
        }

        return {
          id: `var_${placeholder}_${Date.now()}_${index}`,
          placeholder,
          example: '',
        };
      });

      const hasChanges =
        updatedVariables.length !== prev.length ||
        updatedVariables.some(
          (variable, index) =>
            variable.id !== prev[index]?.id ||
            variable.placeholder !== prev[index]?.placeholder
        );

      return hasChanges ? updatedVariables : prev;
    });
  }, [bodyText]);

  const addQuickReplyButton = () => {
    if (totalButtons >= 3) {
      toast.warning('⚠️ Máximo de 3 botões no total permitido pelo WhatsApp');
      return;
    }
    if (quickReplyButtons.length >= 3) {
      toast.warning('Máximo de 3 botões de resposta rápida');
      return;
    }
    setQuickReplyButtons([...quickReplyButtons, { id: `qr_${Date.now()}`, text: '' }]);
  };

  const removeQuickReplyButton = (id: string) => {
    setQuickReplyButtons(quickReplyButtons.filter(b => b.id !== id));
  };

  const updateQuickReplyButton = (id: string, text: string) => {
    setQuickReplyButtons(quickReplyButtons.map(b => b.id === id ? { ...b, text } : b));
  };

  const addCallButton = () => {
    if (totalButtons >= 3) {
      toast.warning('⚠️ Máximo de 3 botões no total permitido pelo WhatsApp');
      return;
    }
    if (callButtons.length >= 1) {
      toast.warning('Máximo de 1 botão de telefone');
      return;
    }
    setCallButtons([...callButtons, { id: `call_${Date.now()}`, text: '', phoneNumber: '' }]);
  };

  const removeCallButton = (id: string) => {
    setCallButtons(callButtons.filter(b => b.id !== id));
  };

  const updateCallButton = (id: string, field: 'text' | 'phoneNumber', value: string) => {
    setCallButtons(callButtons.map(b => b.id === id ? { ...b, [field]: value } : b));
  };

  const addUrlButton = () => {
    if (totalButtons >= 3) {
      toast.warning('⚠️ Máximo de 3 botões no total permitido pelo WhatsApp');
      return;
    }
    if (urlButtons.length >= 2) {
      toast.warning('Máximo de 2 botões de URL');
      return;
    }
    setUrlButtons([...urlButtons, { id: `url_${Date.now()}`, text: '', url: '', urlType: 'static' }]);
  };

  const removeUrlButton = (id: string) => {
    setUrlButtons(urlButtons.filter(b => b.id !== id));
  };

  const updateUrlButton = (id: string, field: 'text' | 'url' | 'urlType', value: string) => {
    setUrlButtons(urlButtons.map(b => b.id === id ? { ...b, [field]: value } : b));
  };

  const addCopyCodeButton = () => {
    if (totalButtons >= 3) {
      toast.warning('⚠️ Máximo de 3 botões no total permitido pelo WhatsApp');
      return;
    }
    if (copyCodeButtons.length >= 1) {
      toast.warning('Máximo de 1 botão de copiar código');
      return;
    }
    setCopyCodeButtons([{ id: `copy_${Date.now()}`, example: '' }]);
  };

  const removeCopyCodeButton = (id: string) => {
    setCopyCodeButtons(copyCodeButtons.filter(b => b.id !== id));
  };

  const updateCopyCodeButton = (id: string, value: string) => {
    setCopyCodeButtons(copyCodeButtons.map(b => b.id === id ? { ...b, example: value } : b));
  };

  const handleMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSizes: Record<string, number> = {
      image: 5 * 1024 * 1024,
      video: 16 * 1024 * 1024,
      audio: 16 * 1024 * 1024,
      document: 100 * 1024 * 1024
    };

    let fileType: 'image' | 'video' | 'audio' | 'document' = 'document';
    if (file.type.startsWith('image/')) fileType = 'image';
    else if (file.type.startsWith('video/')) fileType = 'video';
    else if (file.type.startsWith('audio/')) fileType = 'audio';

    if (file.size > maxSizes[fileType]) {
      toast.error(`Arquivo muito grande! Máximo: ${maxSizes[fileType] / 1024 / 1024}MB`);
      return;
    }

    setHeaderMediaFile(file);
    
    if (fileType === 'image' || fileType === 'video') {
      const reader = new FileReader();
      reader.onload = (e) => setHeaderMediaPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setHeaderMediaPreview('');
    }
  };

  const removeMedia = () => {
    setHeaderMediaFile(null);
    setHeaderMediaPreview('');
  };

  const validateForm = (): string[] => {
    const errors: string[] = [];

    if (!templateName.trim()) {
      errors.push('Nome do template é obrigatório');
    }

    if (!/^[a-z0-9_]+$/.test(templateName)) {
      errors.push('Nome do template deve conter apenas letras minúsculas, números e underscores');
    }

    if (selectedAccountIds.length === 0) {
      errors.push('Selecione pelo menos uma conta');
    }

    if (hasHeader && headerType !== 'TEXT' && !headerMediaFile && !headerMediaUrl.trim()) {
      const mediaTypeName = headerType === 'IMAGE' ? 'imagem' : headerType === 'VIDEO' ? 'vídeo' : 'documento';
      errors.push(`Faça upload da ${mediaTypeName} OU cole uma URL pública`);
    }

    if (!bodyText.trim()) {
      errors.push('Conteúdo do template é obrigatório');
    }

    // Validar regras de variáveis
    const variableMatches = bodyText.match(/\{\{(\d+)\}\}/g);
    
    // 1. Verificar comprimento mínimo TOTAL do texto (10 caracteres)
    if (bodyText.trim().length < 10) {
      errors.push(`❌ O texto deve ter no mínimo 10 caracteres no total (atual: ${bodyText.trim().length})`);
    }
    
    if (variableMatches && variableMatches.length > 0) {
      // 2. Verificar se variável está COLADA no início (sem nenhum caractere antes)
      const trimmedText = bodyText.trim();
      if (trimmedText.startsWith('{{')) {
        errors.push('❌ A variável não pode estar no início do texto (adicione pelo menos 1 caractere antes)');
      }

      // 3. Verificar se variável está COLADA no final (sem nenhum caractere depois)
      if (trimmedText.endsWith('}}')) {
        errors.push('❌ A variável não pode estar no final do texto (adicione pelo menos 1 caractere depois)');
      }
      
      // 4. VALIDAÇÃO CRÍTICA: Verificar se TODAS as variáveis do texto têm exemplos preenchidos
      const numVariables = variableMatches.length;
      if (bodyVariables.length !== numVariables) {
        errors.push(`❌ Você tem ${numVariables} variável(is) no texto, mas só preencheu ${bodyVariables.length} exemplo(s). Preencha TODOS os exemplos!`);
      } else if (bodyVariables.some(v => !v.example.trim())) {
        errors.push('❌ TODAS as variáveis devem ter um exemplo preenchido');
      }
    }

    if (quickReplyButtons.some(b => !b.text.trim())) {
      errors.push('Todos os botões de resposta rápida devem ter um texto');
    }

    if (callButtons.some(b => !b.text.trim() || !b.phoneNumber.trim())) {
      errors.push('Botões de telefone devem ter texto e número');
    }

    if (urlButtons.some(b => !b.text.trim() || !b.url.trim())) {
      errors.push('Botões de URL devem ter texto e link');
    }

    if (copyCodeButtons.some(b => !b.example.trim())) {
      errors.push('Botão de copiar código deve ter um exemplo de código');
    }

    // Validar limite de 3 botões
    const totalBtns = quickReplyButtons.length + callButtons.length + urlButtons.length + copyCodeButtons.length;
    if (totalBtns > 3) {
      errors.push(`❌ Máximo de 3 botões permitidos (você tem ${totalBtns} botões)`);
    }

    return errors;
  };

  const buildComponents = (mediaHandles?: { [accountId: number]: string }) => {
    const components: any[] = [];

    console.log('🔍 buildComponents - Recebeu mediaHandles:', mediaHandles);
    console.log('🔍 buildComponents - hasHeader:', hasHeader, 'headerType:', headerType);

    if (hasHeader) {
      if (headerType === 'TEXT') {
        components.push({
          type: 'HEADER',
          format: 'TEXT',
          text: headerText
        });
      } else {
        // ✅ CORRIGIDO: Adicionar example com a URL ou Media ID
        const headerComponent: any = {
          type: 'HEADER',
          format: headerType
        };
        
        // Se temos mediaHandles (URL ou Media ID), adicionar ao example
        if (mediaHandles && Object.keys(mediaHandles).length > 0) {
          const firstMediaHandle = Object.values(mediaHandles)[0];
          
          // Detectar se é URL ou Media ID
          if (firstMediaHandle.startsWith('http://') || firstMediaHandle.startsWith('https://')) {
            // É uma URL - usar header_handle com a URL
            headerComponent.example = {
              header_handle: [firstMediaHandle]
            };
            console.log(`✅ buildComponents - Example COM URL incluído`);
            console.log(`   header_handle: [${firstMediaHandle}]`);
          } else if (firstMediaHandle.startsWith('4::')) {
            // É um Media Handle no formato correto (4::xxx)
            headerComponent.example = {
              header_handle: [firstMediaHandle]
            };
            console.log(`✅ buildComponents - Example COM Media Handle incluído`);
            console.log(`   header_handle: [${firstMediaHandle}]`);
          } else {
            // É um Media ID numérico - usar header_handle
            headerComponent.example = {
              header_handle: [firstMediaHandle]
            };
            console.log(`✅ buildComponents - Example COM Media ID incluído`);
            console.log(`   header_handle: [${firstMediaHandle}]`);
          }
        } else {
          console.log(`⚠️  buildComponents - Nenhum mediaHandle disponível, criando sem example`);
        }
        
        components.push(headerComponent);
      }
    }

    const bodyComponent: any = {
      type: 'BODY',
      text: bodyText
    };

    if (bodyVariables.length > 0) {
      const sortedVariables = [...bodyVariables].sort(
        (a, b) => (a.placeholder || 0) - (b.placeholder || 0)
      );
      bodyComponent.example = {
        body_text: sortedVariables.map((v) => v.example),
      };
    }

    components.push(bodyComponent);

    if (hasFooter && footerText.trim()) {
      components.push({
        type: 'FOOTER',
        text: footerText
      });
    }

    // BOTÕES - Agora podemos ter múltiplos tipos ao mesmo tempo!
    const allButtons: any[] = [];
    
    // Adicionar botões de resposta rápida
    if (quickReplyButtons.length > 0) {
      quickReplyButtons.forEach(btn => {
        allButtons.push({
          type: 'QUICK_REPLY',
          text: btn.text
        });
      });
    }
    
    // Adicionar botões de ligar
    if (callButtons.length > 0) {
      callButtons.forEach(btn => {
        allButtons.push({
          type: 'PHONE_NUMBER',
          text: btn.text,
          phone_number: btn.phoneNumber
        });
      });
    }
    
    // Adicionar botões de URL
    if (urlButtons.length > 0) {
      urlButtons.forEach(btn => {
        allButtons.push({
          type: 'URL',
          text: btn.text,
          url: btn.url
        });
      });
    }
    
    // Adicionar botões de copiar código
    if (copyCodeButtons.length > 0) {
      copyCodeButtons.forEach(btn => {
        allButtons.push({
          type: 'COPY_CODE',
          example: btn.example
        });
      });
    }
    
    // Se tem botões, adicionar ao components
    if (allButtons.length > 0) {
      components.push({
        type: 'BUTTONS',
        buttons: allButtons
      });
    }

    return { components };
  };

  const handleSubmit = async () => {
    // VALIDAÇÃO RIGOROSA - BLOQUEIA SE HOUVER QUALQUER ERRO
    const validationErrors = validateForm();
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      toast.error(`❌ Não é possível criar o template! Corrija ${validationErrors.length} erro(s) primeiro.`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      
      // MOSTRAR TODOS OS ERROS EM UM TOAST
      validationErrors.forEach((error, index) => {
        setTimeout(() => {
          toast.error(`❌ Erro ${index + 1}: ${error}`);
        }, index * 500);
      });
      
      return; // BLOQUEAR CRIAÇÃO
    }

    setLoading(true);
    setErrors([]);
    setResults([]);

    try {
      let mediaHandles: { [accountId: number]: string } = {};
      
      // Se o usuário forneceu uma URL, usar ela para todas as contas
      if (hasHeader && headerType !== 'TEXT' && headerMediaUrl.trim()) {
        console.log(`🔗 Usando URL externa fornecida: ${headerMediaUrl}`);
        // Usar a mesma URL para todas as contas selecionadas
        for (const accountId of selectedAccountIds) {
          mediaHandles[accountId] = headerMediaUrl.trim();
        }
        toast.success(`✅ URL da ${headerType.toLowerCase()} configurada!`);
      }
      // Caso contrário, fazer upload da mídia e obter Handle para cada conta
      else if (hasHeader && headerType !== 'TEXT' && headerMediaFile) {
        const mediaTypeName = headerType === 'IMAGE' ? 'imagem' : headerType === 'VIDEO' ? 'vídeo' : 'documento';
        
        // Verificar se o arquivo é válido
        if (!headerMediaFile || !headerMediaFile.size) {
          toast.error(`❌ Arquivo de ${mediaTypeName} inválido ou vazio`);
          setLoading(false);
          return;
        }
        
        console.log(`📤 Iniciando upload de ${mediaTypeName}:`);
        console.log(`   Arquivo: ${headerMediaFile.name}`);
        console.log(`   Tamanho: ${headerMediaFile.size} bytes`);
        console.log(`   Tipo: ${headerMediaFile.type}`);
        
        toast.info(`📤 Fazendo upload da ${mediaTypeName} para ${selectedAccountIds.length} conta(s)...`);
        
        for (const accountId of selectedAccountIds) {
          try {
            console.log(`🔄 Upload para conta ${accountId}...`);
            
            const formData = new FormData();
            formData.append('media', headerMediaFile);
            formData.append('type', headerType.toLowerCase());
            
            console.log(`📦 FormData criado para conta ${accountId}`);
            console.log(`   Entries:`, Array.from(formData.entries()).map(([k, v]) => `${k}: ${v instanceof File ? `File(${v.name}, ${v.size} bytes)` : v}`));

            // ⚠️ IMPORTANTE: NÃO definir Content-Type manualmente!
            // O Axios define automaticamente com o boundary correto para FormData
            const uploadResponse = await api.post(`/whatsapp-accounts/${accountId}/upload-media`, formData);
            
            console.log(`✅ Resposta do upload para conta ${accountId}:`, uploadResponse.data);

            if (uploadResponse.data.success) {
              console.log(`✅ Upload de mídia concluído para conta ${accountId}`);
              console.log(`   publicUrl: ${uploadResponse.data.publicUrl}`);
              console.log(`   mediaId: ${uploadResponse.data.mediaId}`);
              console.log(`   mediaUrl: ${uploadResponse.data.mediaUrl}`);
              
              // ✅ SOLUÇÃO DEFINITIVA: Usar Media Handle no formato 4::xxx (conforme documentação)
              // A documentação exige: "Use a API de Upload Retomável para gerar um identificador"
              // Formato esperado: "4::aW..." ou similar
              if (uploadResponse.data.mediaHandle) {
                mediaHandles[accountId] = uploadResponse.data.mediaHandle;
                console.log(`   ✅ Usando Media Handle (formato 4::xxx): ${mediaHandles[accountId]}`);
                console.log(`   📊 Tipo: ${typeof mediaHandles[accountId]}`);
                console.log(`   📚 Conforme documentação oficial do WhatsApp`);
              } else if (uploadResponse.data.mediaId) {
                // Fallback para Media ID se handle não disponível
                mediaHandles[accountId] = String(uploadResponse.data.mediaId);
                console.log(`   ⚠️  Media Handle não disponível - usando Media ID: ${mediaHandles[accountId]}`);
                console.log(`   ⚠️  PODE NÃO FUNCIONAR (documentação exige formato 4::xxx)`);
              } else {
                throw new Error('Nem Media Handle nem Media ID disponíveis após upload');
              }
            } else {
              throw new Error('Upload falhou');
            }
          } catch (uploadError: any) {
            console.error(`❌ Erro no upload para conta ${accountId}:`, uploadError);
            toast.error(`Erro ao fazer upload da ${mediaTypeName} para conta ${accountId}`);
            setLoading(false);
            return;
          }
        }
        
        toast.success(`✅ Upload da ${mediaTypeName} concluído com sucesso!`);
      }

      console.log('🔍 DEBUG - mediaHandles antes de buildComponents:', mediaHandles);
      const { components } = buildComponents(mediaHandles);

      console.log('\n');
      console.log('='.repeat(80));
      console.log('📤 FRONTEND - PREPARANDO REQUISIÇÃO PARA CRIAR TEMPLATE');
      console.log('='.repeat(80));
      console.log('');
      console.log('📋 INFORMAÇÕES DO TEMPLATE:');
      console.log('   Nome:', templateName);
      console.log('   Categoria:', category);
      console.log('   Idioma:', language);
      console.log('   Contas Selecionadas:', selectedAccountIds.length, '-', selectedAccountIds);
      console.log('');
      console.log('🧩 COMPONENTS (' + components.length + '):');
      components.forEach((comp: any, idx: number) => {
        console.log(`   [${idx}] ${comp.type}${comp.format ? ` (${comp.format})` : ''}${comp.text ? `: "${comp.text.substring(0, 50)}..."` : ''}`);
        if (comp.example && comp.example.header_handle) {
          console.log(`        ✅ Example DENTRO do componente: header_handle = [${comp.example.header_handle[0]}]`);
        }
      });
      console.log('');
      console.log('🔗 MEDIA HANDLES (URLs/IDs por conta):');
      Object.entries(mediaHandles).forEach(([accountId, handle]) => {
        console.log(`   Conta ${accountId}: ${handle}`);
      });
      console.log('');

      // Construir templateData SEM example no nível raiz
      // O example está DENTRO do componente HEADER
      const templateData: any = {
        name: templateName,
        category: category,
        language: language,
        components: components,
      };

      console.log('📦 PAYLOAD FINAL (templateData):');
      console.log(JSON.stringify(templateData, null, 2));
      console.log('');
      console.log('📎 MEDIA HANDLES (serão enviados separadamente):');
      console.log(JSON.stringify(mediaHandles, null, 2));
      console.log('');
      console.log('🚀 Enviando para: POST /templates/create-multiple');
      console.log('='.repeat(80));
      console.log('');

      const response = await api.post('/templates/create-multiple', {
        accountIds: selectedAccountIds,
        templateData: templateData,
        mediaHandles: mediaHandles, // ✅ ENVIANDO mediaHandles para o backend
        useQueue: true,
      });

      const data = response.data;

      if (data.success) {
        if (data.queue) {
          toast.success(
            `${data.results.length} template(s) adicionado(s) à fila! ` +
            `(Total: ${data.queue.total}, Intervalo: ${data.queue.interval}s)`
          );
          toast.info('Acompanhe o processo em "Gerenciar Templates" → "Ver Fila"');
        }
        
        setResults(data.results);
        setShowResults(true);
        console.log('✅ Templates adicionados à fila!');
        console.log('   Total:', data.results.length);
        if (data.queue) {
          console.log('   Fila:', data.queue);
        }
        
        if (deleteOriginal && originalName && originalAccountId) {
          console.log('🗑️ Deletando template original:', originalName);
          try {
            const deleteResponse = await api.delete(
              `/templates/${originalAccountId}/${originalName}`,
              { data: { useQueue: true } }
            );
            if (deleteResponse.data.success) {
              console.log('✅ Template original deletado com sucesso!');
            } else {
              console.error('⚠️ Erro ao deletar original:', deleteResponse.data.error);
            }
          } catch (deleteError: any) {
            console.error('⚠️ Erro ao deletar original:', deleteError.message);
          }
        }
      } else {
        setErrors([data.error || 'Erro ao criar templates']);
      }
    } catch (error: any) {
      console.error('❌ Erro:', error);
      setErrors([error.message || 'Erro ao criar templates']);
    } finally {
      setLoading(false);
    }
  };

  const refreshTemplateStatus = async () => {
    setRefreshing(true);
    try {
      console.log('🔄 Atualizando status dos templates...');
      
      const updatedResults = await Promise.all(
        results.map(async (result) => {
          if (!result.success || !result.accountId) return result;
          
          try {
            // Buscar templates da conta
            const response = await api.get(`/templates/${result.accountId}`);
            
            if (response.data.success && response.data.templates) {
              // Encontrar o template pelo nome (campo template_name no banco)
              const template = response.data.templates.find(
                (t: any) => t.template_name === templateName
              );
              
              if (template) {
                console.log(`✅ Template ${templateName} encontrado na conta ${result.accountId}:`, template.status);
                return {
                  ...result,
                  status: template.status,
                  category: template.category,
                };
              } else {
                console.log(`⏳ Template ${templateName} ainda não foi criado na conta ${result.accountId}`);
              }
            }
          } catch (error) {
            console.error(`Erro ao atualizar conta ${result.accountId}:`, error);
          }
          
          return result;
        })
      );
      
      setResults(updatedResults);
      console.log('✅ Status atualizado!');
    } catch (error) {
      console.error('❌ Erro ao atualizar status:', error);
      toast.error('Erro ao atualizar status dos templates');
    } finally {
      setRefreshing(false);
    }
  };

  const handleCreateAnother = () => {
    setShowResults(false);
    setResults([]);
    setAutoRefresh(true);
    setTemplateName('');
    setBodyText('');
    setBodyVariables([]);
    setHeaderText('');
    setFooterText('');
    setQuickReplyButtons([]);
    setCallButtons([]);
    setUrlButtons([]);
    setCopyCodeButtons([]);
    setHasHeader(false);
    setHasFooter(false);
    setHeaderMediaFile(null);
    setHeaderMediaPreview('');
  };

  if (showResults) {
    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;

    return (
      <>
        <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 py-8 px-4">
          <div className="max-w-5xl mx-auto space-y-8">
            
            <div className="relative overflow-hidden bg-gradient-to-r from-green-600/30 via-green-500/20 to-green-600/30 backdrop-blur-xl border-2 border-green-500/40 rounded-3xl p-10 shadow-2xl shadow-green-500/20">
              <div className="absolute inset-0 bg-grid-white/[0.02]"></div>
              <div className="relative text-center">
                <div className="text-6xl mb-6">✅</div>
                <h1 className="text-5xl font-black text-white mb-4">
                  Resultado da Criação
                </h1>
                <p className="text-xl text-white/80">
                  Templates processados com sucesso!
                </p>
              </div>
            </div>

            <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-primary-500/30 rounded-2xl p-8 shadow-xl">
              <div className="grid grid-cols-3 gap-6 text-center mb-8">
                <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 border-2 border-green-500/30 rounded-2xl p-6">
                  <div className="text-6xl font-black text-green-400 mb-2">{successCount}</div>
                  <div className="text-lg text-white/70 font-bold">✅ Sucesso</div>
                </div>
                <div className="bg-gradient-to-br from-red-500/20 to-red-600/10 border-2 border-red-500/30 rounded-2xl p-6">
                  <div className="text-6xl font-black text-red-400 mb-2">{errorCount}</div>
                  <div className="text-lg text-white/70 font-bold">❌ Erro</div>
                </div>
                <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border-2 border-blue-500/30 rounded-2xl p-6">
                  <div className="text-6xl font-black text-blue-400 mb-2">{results.length}</div>
                  <div className="text-lg text-white/70 font-bold">📊 Total</div>
                </div>
              </div>

              <div className="space-y-4">
                {results.map((result, index) => (
                  <div 
                    key={index}
                    className={`p-6 rounded-2xl border-2 ${
                      result.success 
                        ? 'bg-green-500/10 border-green-500/30' 
                        : 'bg-red-500/10 border-red-500/30'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="mt-1">
                        {result.success ? (
                          <FaCheckCircle className="text-green-400 text-3xl" />
                        ) : (
                          <FaTimesCircle className="text-red-400 text-3xl" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-black text-2xl mb-2 text-white">
                          {result.accountName || result.phoneNumber}
                        </div>
                        <div className="text-white/60 text-sm mb-3">
                          📞 {result.phoneNumber}
                        </div>
                        {result.success ? (
                          <>
                            <div className="text-green-300 text-lg mb-3">{result.message}</div>
                            <div className="text-base text-white/70 space-y-2">
                              <div className="flex items-center gap-2">
                                <strong>Status:</strong> 
                                <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                                  result.status === 'APPROVED' ? 'bg-green-500/20 text-green-400' :
                                  result.status === 'REJECTED' ? 'bg-red-500/20 text-red-400' :
                                  result.status === 'PENDING' ? 'bg-yellow-500/20 text-yellow-400' :
                                  'bg-gray-500/20 text-gray-400'
                                }`}>
                                  {result.status || 'PENDING'}
                                </span>
                              </div>
                              <div><strong>Categoria:</strong> <span className="text-blue-400">{result.category || category}</span></div>
                              
                              {/* Alerta de aprovação */}
                              {result.status === 'APPROVED' && (
                                <div className="mt-3 p-4 bg-green-500/10 border-2 border-green-500/30 rounded-xl text-green-300 flex items-center gap-2">
                                  <FaCheckCircle className="text-2xl" />
                                  <span className="font-bold">✨ Template APROVADO e pronto para uso!</span>
                                </div>
                              )}
                              
                              {/* Alerta de rejeição */}
                              {result.status === 'REJECTED' && (
                                <div className="mt-3 p-4 bg-red-500/10 border-2 border-red-500/30 rounded-xl text-red-300 flex items-center gap-2">
                                  <FaTimesCircle className="text-2xl" />
                                  <span className="font-bold">❌ Template foi REJEITADO pelo WhatsApp</span>
                                </div>
                              )}
                              
                              {/* Alerta de mudança de categoria */}
                              {result.category && result.category !== category && (
                                <div className="mt-3 p-4 bg-yellow-500/10 border-2 border-yellow-500/30 rounded-xl text-yellow-300 flex items-center gap-2">
                                  <FaExclamationTriangle className="text-2xl" />
                                  <span>Categoria foi alterada automaticamente pelo WhatsApp</span>
                                </div>
                              )}
                            </div>
                          </>
                        ) : (
                          <div className="text-red-300 text-lg">{result.error}</div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Controles de Atualização */}
            <div className="bg-gradient-to-br from-gray-800/40 to-gray-900/40 rounded-2xl p-6 border-2 border-gray-700/30">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${autoRefresh ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></div>
                  <span className="text-white font-semibold">
                    {autoRefresh ? 'Atualização automática ativada' : 'Atualização automática desativada'}
                  </span>
                </div>
                <button
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                    autoRefresh 
                      ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' 
                      : 'bg-gray-500/20 text-gray-400 hover:bg-gray-500/30'
                  }`}
                >
                  {autoRefresh ? 'Desativar' : 'Ativar'}
                </button>
              </div>
              
              <button
                onClick={refreshTemplateStatus}
                disabled={refreshing}
                className={`w-full px-6 py-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white text-lg font-bold rounded-xl transition-all duration-200 shadow-lg shadow-blue-500/40 flex items-center justify-center gap-3 ${
                  refreshing ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <FaInfoCircle className={`text-2xl ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Atualizando...' : 'Atualizar Status Agora'}
              </button>
              
              <p className="text-white/60 text-sm mt-3 text-center">
                {autoRefresh ? '⏱️ Próxima atualização em 10 segundos' : '💡 Ative a atualização automática ou clique no botão acima'}
              </p>
            </div>

            <div className="flex gap-6">
              <button
                onClick={handleCreateAnother}
                className="flex-1 px-8 py-5 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white text-xl font-bold rounded-xl transition-all duration-200 shadow-lg shadow-primary-500/40 flex items-center justify-center gap-3"
              >
                <FaPlus className="text-2xl" />
                Criar Outro Template
              </button>
              <button
                onClick={() => router.push('/configuracoes')}
                className="flex-1 px-8 py-5 bg-dark-700 hover:bg-dark-600 text-white text-xl font-bold rounded-xl transition-all duration-200 border-2 border-white/20 flex items-center justify-center gap-3"
              >
                <FaArrowLeft className="text-2xl" />
                Voltar para Configurações
              </button>
            </div>
          </div>
        </div>

        <style jsx>{`
          .bg-grid-white {
            background-image: 
              linear-gradient(to right, rgba(255, 255, 255, 0.1) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(255, 255, 255, 0.1) 1px, transparent 1px);
            background-size: 20px 20px;
          }
        `}</style>
      </>
    );
  }

  return (
    <>
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />
      
      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 py-8 px-4">
        <div className="max-w-6xl mx-auto space-y-8">
          
          {/* CABEÇALHO */}
          <div className="relative overflow-hidden bg-gradient-to-r from-purple-600/30 via-purple-500/20 to-purple-600/30 backdrop-blur-xl border-2 border-purple-500/40 rounded-3xl p-10 shadow-2xl shadow-purple-500/20">
            <div className="absolute inset-0 bg-grid-white/[0.02]"></div>
            <div className="relative text-center">
              <div className="text-6xl mb-6">📝</div>
              <h1 className="text-5xl font-black text-white mb-4">
                Criar Template em Múltiplas Contas
              </h1>
              <p className="text-xl text-white/80">
                Configure seu template e envie para múltiplas contas
              </p>
              <div className="mt-6">
                <button
                  onClick={() => router.push('/template/historico')}
                  className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white text-lg font-bold rounded-xl transition-all duration-200 shadow-lg shadow-blue-500/40 flex items-center gap-2 mx-auto"
                >
                  📋 Ver Histórico de Templates
                </button>
              </div>
            </div>
          </div>

          {/* ERROS */}
          {errors.length > 0 && (
            <div className="bg-red-500/10 border-2 border-red-500/40 rounded-2xl p-6 shadow-xl">
              <h3 className="font-black text-2xl text-red-300 mb-4 flex items-center gap-3">
                <FaTimesCircle className="text-3xl" />
                Erros encontrados:
              </h3>
              <ul className="space-y-2">
                {errors.map((error, index) => (
                  <li key={index} className="text-red-200 text-lg flex items-center gap-2">
                    <span className="text-2xl">•</span>
                    {error}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* INFORMAÇÕES BÁSICAS */}
          <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-8 shadow-xl">
            <h2 className="text-3xl font-black mb-6 flex items-center gap-3 text-white">
              <div className="bg-blue-500/20 p-3 rounded-xl">
                <FaInfoCircle className="text-2xl text-blue-400" />
              </div>
              Informações Básicas
            </h2>

            <div className="space-y-6">
              <div>
                <label className="block text-xl font-black mb-3 text-white">Nome do Template *</label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => {
                    const formatted = e.target.value
                      .toLowerCase()
                      .replace(/\s+/g, '_')
                      .replace(/[^a-z0-9_]/g, '');
                    setTemplateName(formatted);
                  }}
                  placeholder="ex: boas_vindas_2024"
                  className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/30 transition-all"
                />
                <p className="text-sm text-white/60 mt-2 font-medium">
                  Digite normalmente - espaços serão convertidos em _ automaticamente
                </p>
              </div>

              <div>
                <label className="block text-xl font-black mb-3 text-white">Categoria *</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/30 transition-all font-bold"
                >
                  <option value="MARKETING">MARKETING - Promoções, ofertas</option>
                  <option value="UTILITY">UTILITY - Confirmações, atualizações</option>
                </select>
                <p className="text-base text-yellow-400 mt-2 flex items-center gap-2 font-medium">
                  <FaExclamationTriangle />
                  O WhatsApp pode alterar a categoria automaticamente
                </p>
              </div>

              <div>
                <label className="block text-xl font-black mb-3 text-white">Idioma *</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/30 transition-all font-bold"
                >
                  <option value="pt_BR">Português (Brasil)</option>
                  <option value="en_US">Inglês (EUA)</option>
                  <option value="es_ES">Espanhol (Espanha)</option>
                </select>
              </div>
            </div>
          </div>

          {/* SELECIONAR CONTAS */}
          <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-8 shadow-xl">
            <h2 className="text-3xl font-black mb-6 text-white">
              📱 Selecionar Contas * 
              <span className="ml-4 text-primary-400">({selectedAccountIds.length} selecionadas)</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {accounts.length === 0 && (
                <div className="col-span-full p-8 bg-yellow-500/10 border-2 border-yellow-500/30 rounded-xl text-center">
                  <p className="text-yellow-300 text-lg font-bold mb-2">⚠️ Nenhuma conta disponível!</p>
                  <p className="text-white/60 text-sm">Carregue a página novamente ou adicione contas no sistema.</p>
                  <button
                    onClick={() => loadAccounts()}
                    className="mt-4 px-6 py-3 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 rounded-lg font-bold transition-all"
                  >
                    🔄 Recarregar Contas
                  </button>
                </div>
              )}
              {accounts.map(account => (
                <div
                  key={account.id}
                  onClick={() => handleAccountToggle(account.id)}
                  className={`p-6 rounded-2xl border-2 cursor-pointer transition-all ${
                    selectedAccountIds.includes(account.id)
                      ? 'border-green-500/50 bg-green-500/10'
                      : 'border-white/20 bg-white/5 hover:border-primary-500/50'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <input
                      type="checkbox"
                      checked={selectedAccountIds.includes(account.id)}
                      onChange={() => {}}
                      className="w-6 h-6"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-black text-lg text-white truncate">{account.name || account.phone_number}</div>
                      <div className="text-base text-white/60 truncate">{account.phone_number}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* HEADER */}
          <div className={`bg-dark-800/60 backdrop-blur-xl border-2 rounded-2xl p-8 shadow-xl transition-all ${
            hasHeader ? 'border-green-500/50 shadow-green-500/20' : 'border-white/10'
          }`}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <input
                  type="checkbox"
                  checked={hasHeader}
                  onChange={(e) => setHasHeader(e.target.checked)}
                  className="w-7 h-7 rounded border-2 border-white/20 cursor-pointer"
                />
                <h2 className="text-3xl font-black text-white">📄 Header (Opcional)</h2>
              </div>
              
              {!hasHeader && (
                <div className="px-4 py-2 bg-blue-500/20 border border-blue-500/40 rounded-lg">
                  <span className="text-blue-300 text-sm font-bold">
                    💡 Marque esta opção para adicionar imagem, vídeo ou texto no cabeçalho
                  </span>
                </div>
              )}
              
              {hasHeader && (
                <div className="px-4 py-2 bg-green-500/20 border border-green-500/40 rounded-lg">
                  <span className="text-green-300 text-sm font-bold">
                    ✅ Header ativado
                  </span>
                </div>
              )}
            </div>

            {hasHeader && (
              <div className="ml-10 space-y-6">
                <div>
                  <label className="block text-xl font-black mb-3 text-white">Tipo de Header</label>
                  <select
                    value={headerType}
                    onChange={(e) => setHeaderType(e.target.value as any)}
                    className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/30 transition-all font-bold"
                  >
                    <option value="TEXT">Texto</option>
                    <option value="IMAGE">Imagem</option>
                    <option value="VIDEO">Vídeo</option>
                    <option value="DOCUMENT">Documento</option>
                  </select>
                </div>

                {headerType === 'TEXT' && (
                  <div>
                    <label className="block text-xl font-black mb-3 text-white">Texto do Header</label>
                    <input
                      type="text"
                      value={headerText}
                      onChange={(e) => setHeaderText(e.target.value)}
                      placeholder="Título do template"
                      maxLength={60}
                      className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/30 transition-all"
                    />
                    <p className="text-sm text-white/60 mt-2 font-medium">
                      {headerText.length}/60 caracteres
                    </p>
                  </div>
                )}

                {headerType !== 'TEXT' && (
                  <div className="space-y-4">
                    <div className="p-6 bg-blue-500/10 border-2 border-blue-500/30 rounded-2xl">
                      <FaInfoCircle className="inline mr-2 text-blue-400 text-2xl" />
                      <span className="text-blue-200 text-lg font-medium">
                        Você pode fazer upload de um arquivo OU colar uma URL pública da {headerType.toLowerCase()}
                      </span>
                    </div>

                    {/* Título principal */}
                    <div className="text-center mb-6">
                      <h3 className="text-2xl font-black text-white mb-2">
                        📤 Escolha como fornecer sua {headerType === 'IMAGE' ? 'Imagem' : headerType === 'VIDEO' ? 'Vídeo' : 'Documento'}
                      </h3>
                      <p className="text-white/60 text-lg">
                        Você pode fazer upload de um arquivo do seu computador OU colar uma URL pública
                      </p>
                    </div>

                    {/* OPÇÃO 1: Upload de Arquivo (Destaque) */}
                    <div className="p-8 bg-gradient-to-br from-primary-500/20 to-purple-500/20 border-3 border-primary-500/40 rounded-2xl shadow-xl hover:shadow-2xl transition-all">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="text-5xl">💻</div>
                        <div>
                          <h4 className="text-2xl font-black text-white">Opção 1: Upload do Computador</h4>
                          <p className="text-white/70 text-lg">
                            📁 Escolha um arquivo do seu dispositivo
                          </p>
                        </div>
                      </div>
                      
                      {/* Preview do arquivo carregado */}
                      {headerMediaPreview && headerMediaFile && (
                        <div className="mb-4 p-6 bg-green-500/10 border-2 border-green-500/30 rounded-xl">
                          <div className="flex items-center gap-3 mb-4">
                            <FaCheckCircle className="text-green-400 text-2xl" />
                            <div className="flex-1">
                              <div className="text-white font-bold text-lg">✅ Arquivo carregado com sucesso!</div>
                              <div className="text-white/60 text-sm mt-1">
                                📎 {headerMediaFile?.name} ({(headerMediaFile?.size! / (1024 * 1024)).toFixed(2)} MB)
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                setHeaderMediaFile(null);
                                setHeaderMediaPreview('');
                              }}
                              className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-all font-bold flex items-center gap-2"
                            >
                              <FaTrash />
                              Remover
                            </button>
                          </div>
                          
                          {/* Preview de Imagem */}
                          {headerType === 'IMAGE' && headerMediaPreview && (
                            <div className="mt-4">
                              <div className="text-white font-bold mb-2 text-lg">🖼️ Visualização:</div>
                              <img 
                                src={headerMediaPreview} 
                                alt="Preview da imagem" 
                                className="w-full max-w-2xl rounded-xl border-2 border-white/20 shadow-2xl"
                              />
                            </div>
                          )}
                          
                          {/* Preview de Vídeo */}
                          {headerType === 'VIDEO' && headerMediaPreview && (
                            <div className="mt-4">
                              <div className="text-white font-bold mb-2 text-lg">🎥 Visualização:</div>
                              <video 
                                src={headerMediaPreview} 
                                controls 
                                className="w-full max-w-2xl rounded-xl border-2 border-white/20 shadow-2xl"
                              >
                                Seu navegador não suporta a reprodução de vídeo.
                              </video>
                            </div>
                          )}
                          
                          {/* Preview de Documento */}
                          {headerType === 'DOCUMENT' && headerMediaPreview && (
                            <div className="mt-4 p-4 bg-blue-500/10 border-2 border-blue-500/30 rounded-xl">
                              <div className="flex items-center gap-3">
                                <div className="text-6xl">📄</div>
                                <div className="flex-1">
                                  <div className="text-white font-bold text-lg">Documento PDF</div>
                                  <div className="text-white/60 text-sm mt-1">{headerMediaFile?.name}</div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Input de Upload */}
                      <div className="relative">
                        <input
                          type="file"
                          id="file-upload"
                          accept={
                            headerType === 'IMAGE' ? 'image/jpeg,image/png,image/jpg' :
                            headerType === 'VIDEO' ? 'video/mp4,video/3gpp' :
                            'application/pdf'
                          }
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              // Se selecionar um arquivo, limpar a URL
                              setHeaderMediaUrl('');
                              
                              // Validar tamanho máximo
                              const maxSize = headerType === 'IMAGE' ? 5 * 1024 * 1024 : // 5 MB
                                            headerType === 'VIDEO' ? 16 * 1024 * 1024 : // 16 MB
                                            100 * 1024 * 1024; // 100 MB
                              
                              if (file.size > maxSize) {
                                const maxSizeMB = maxSize / (1024 * 1024);
                                toast.error(`❌ Arquivo muito grande! Tamanho máximo: ${maxSizeMB} MB`);
                                e.target.value = ''; // Limpar input
                                return;
                              }
                              
                              setHeaderMediaFile(file);
                              
                              // Preview para imagens
                              if (headerType === 'IMAGE') {
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                  setHeaderMediaPreview(reader.result as string);
                                };
                                reader.readAsDataURL(file);
                              } else if (headerType === 'VIDEO') {
                                // Preview de vídeo
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                  setHeaderMediaPreview(reader.result as string);
                                };
                                reader.readAsDataURL(file);
                              } else {
                                setHeaderMediaPreview(file.name);
                              }
                              
                              toast.success('✅ Arquivo selecionado com sucesso!');
                            }
                          }}
                          className="hidden"
                        />
                        <label
                          htmlFor="file-upload"
                          className="flex flex-col items-center justify-center w-full px-8 py-10 bg-dark-700/50 border-3 border-dashed border-primary-500/50 rounded-xl cursor-pointer hover:bg-dark-700/70 hover:border-primary-500 transition-all group"
                        >
                          <div className="text-6xl mb-4 group-hover:scale-110 transition-transform">
                            {headerType === 'IMAGE' ? '🖼️' : headerType === 'VIDEO' ? '🎥' : '📄'}
                          </div>
                          <div className="text-xl font-bold text-white mb-2">
                            Clique aqui para selecionar um arquivo
                          </div>
                          <div className="text-white/60 text-center">
                            <p className="mb-1">
                              Formatos aceitos: {
                                headerType === 'IMAGE' ? 'JPG, PNG' :
                                headerType === 'VIDEO' ? 'MP4, 3GPP' :
                                'PDF'
                              }
                            </p>
                            <p className="text-sm">
                              Tamanho máximo: {
                                headerType === 'IMAGE' ? '5 MB' :
                                headerType === 'VIDEO' ? '16 MB' :
                                '100 MB'
                              }
                            </p>
                          </div>
                        </label>
                      </div>
                    </div>

                    {/* Divisor "OU" */}
                    <div className="flex items-center gap-4 my-8">
                      <div className="flex-1 h-1 bg-gradient-to-r from-transparent via-white/30 to-transparent rounded-full"></div>
                      <span className="text-white/70 font-black text-2xl px-4">OU</span>
                      <div className="flex-1 h-1 bg-gradient-to-r from-transparent via-white/30 to-transparent rounded-full"></div>
                    </div>

                    {/* OPÇÃO 2: URL Pública */}
                    <div className="p-8 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border-3 border-blue-500/40 rounded-2xl shadow-xl hover:shadow-2xl transition-all">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="text-5xl">🔗</div>
                        <div>
                          <h4 className="text-2xl font-black text-white">Opção 2: URL Pública</h4>
                          <p className="text-white/70 text-lg">
                            🌐 Cole o link direto da sua {headerType.toLowerCase()}
                          </p>
                        </div>
                      </div>
                      
                      <input
                        type="url"
                        value={headerMediaUrl}
                        onChange={(e) => {
                          setHeaderMediaUrl(e.target.value);
                          // Se colar uma URL, limpar o arquivo
                          if (e.target.value.trim()) {
                            setHeaderMediaFile(null);
                            setHeaderMediaPreview('');
                          }
                        }}
                        placeholder={`https://exemplo.com/${headerType === 'IMAGE' ? 'imagem.jpg' : headerType === 'VIDEO' ? 'video.mp4' : 'documento.pdf'}`}
                        className="w-full px-6 py-4 bg-dark-700/50 border-2 border-white/10 rounded-xl text-white text-lg focus:border-blue-500 focus:outline-none transition-all placeholder:text-white/40"
                      />
                      <p className="text-white/60 text-sm mt-3">
                        💡 Cole a URL completa (exemplo: https://seusite.com/{headerType === 'IMAGE' ? 'imagem.jpg' : headerType === 'VIDEO' ? 'video.mp4' : 'documento.pdf'})
                      </p>
                      
                      {/* Preview da URL */}
                      {headerMediaUrl.trim() && headerType === 'IMAGE' && (
                        <div className="mt-4 p-6 bg-green-500/10 border-2 border-green-500/30 rounded-xl">
                          <div className="flex items-center gap-3 mb-4">
                            <FaCheckCircle className="text-green-400 text-2xl" />
                            <div className="flex-1">
                              <div className="text-white font-bold text-lg">✅ URL configurada!</div>
                              <div className="text-white/60 text-sm mt-1 break-all">
                                🔗 {headerMediaUrl}
                              </div>
                            </div>
                          </div>
                          <div className="mt-4">
                            <div className="text-white font-bold mb-2 text-lg">🖼️ Visualização:</div>
                            <img 
                              src={headerMediaUrl} 
                              alt="Preview da URL" 
                              className="w-full max-w-2xl rounded-xl border-2 border-white/20 shadow-2xl"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                                toast.error('❌ Não foi possível carregar a imagem da URL fornecida');
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Especificações do WhatsApp */}
                    <div className="mt-6 p-6 bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-2 border-blue-500/30 rounded-xl">
                      <div className="text-blue-300 font-bold text-xl mb-4 flex items-center gap-2">
                        <span className="text-3xl">📋</span>
                        Especificações do WhatsApp:
                      </div>
                      <div className="text-white/80 font-medium space-y-2">
                          {headerType === 'IMAGE' && (
                            <>
                              <div className="flex items-center gap-2">
                                <span className="text-green-400">✅</span>
                                <span>Formatos aceitos: <strong>JPG, PNG</strong></span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-blue-400">📏</span>
                                <span>Tamanho recomendado: <strong>800x418 pixels</strong></span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-purple-400">💾</span>
                                <span>Tamanho máximo: <strong className="text-yellow-400">5 MB</strong></span>
                              </div>
                            </>
                          )}
                          {headerType === 'VIDEO' && (
                            <>
                              <div className="flex items-center gap-2">
                                <span className="text-green-400">✅</span>
                                <span>Formatos aceitos: <strong>MP4, 3GPP</strong></span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-orange-400">⏱️</span>
                                <span>Duração máxima: <strong>60 segundos</strong></span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-purple-400">💾</span>
                                <span>Tamanho máximo: <strong className="text-yellow-400">16 MB</strong></span>
                              </div>
                            </>
                          )}
                          {headerType === 'DOCUMENT' && (
                            <>
                              <div className="flex items-center gap-2">
                                <span className="text-green-400">✅</span>
                                <span>Formato aceito: <strong>PDF</strong></span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-purple-400">💾</span>
                                <span>Tamanho máximo: <strong className="text-yellow-400">100 MB</strong></span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                )}
              </div>
            )}
          </div>

          {/* BODY */}
          <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-8 shadow-xl">
            <h2 className="text-3xl font-black mb-6 text-white">📝 Conteúdo *</h2>

            <div className="space-y-6">
              <div>
                <label className="block text-xl font-black mb-3 text-white">Texto do Conteúdo</label>
                <textarea
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  placeholder="Digite o conteúdo da mensagem..."
                  rows={6}
                  maxLength={1024}
                  className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/30 transition-all"
                />
                <p className="text-sm text-white/60 mt-2 font-medium">
                  {bodyText.length}/1024 caracteres
                </p>
                
                {/* AVISO SOBRE REGRAS DE VARIÁVEIS */}
                <div className="mt-4 p-4 bg-blue-500/10 border-2 border-blue-500/30 rounded-xl">
                  <h4 className="text-blue-400 font-bold text-base mb-2 flex items-center gap-2">
                    📋 Regras para Variáveis:
                  </h4>
                  <ul className="text-blue-300/90 text-sm space-y-2 ml-6 list-disc">
                    <li>📏 O texto <strong>TOTAL</strong> deve ter <strong>no mínimo 10 caracteres</strong> (incluindo tudo)</li>
                    <li>❌ Variável <strong>NÃO pode estar colada</strong> no <strong>INÍCIO</strong> (precisa de pelo menos 1 letra antes)</li>
                    <li>❌ Variável <strong>NÃO pode estar colada</strong> no <strong>FINAL</strong> (precisa de pelo menos 1 letra depois)</li>
                    <li>🔄 Se você remover uma variável do texto, o campo será <strong>excluído automaticamente</strong></li>
                  </ul>
                  <div className="mt-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <p className="text-green-300 text-xs font-semibold mb-1">✅ Exemplos CORRETOS:</p>
                    <p className="text-green-200 text-xs font-mono mb-1">"Olá {'{{1}}'}, tudo bem?" (tem texto antes e depois)</p>
                    <p className="text-green-200 text-xs font-mono">"A {'{{1}}'} B completo!" (mínimo 1 letra antes e depois, total &gt; 10)</p>
                  </div>
                  <div className="mt-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <p className="text-red-300 text-xs font-semibold mb-1">❌ Exemplos ERRADOS:</p>
                    <p className="text-red-200 text-xs font-mono mb-1">"{'{{1}}'} texto" (começa com variável)</p>
                    <p className="text-red-200 text-xs font-mono mb-1">"texto {'{{1}}'}" (termina com variável)</p>
                    <p className="text-red-200 text-xs font-mono">"A {'{{1}}'} B" (muito curto, menos de 10 caracteres)</p>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-4">
                  <label className="block text-xl font-black text-white">
                    Variáveis {bodyText.match(/\{\{(\d+)\}\}/g)?.length ? '(OBRIGATÓRIO PREENCHER EXEMPLOS!)' : '(Opcional)'}
                  </label>
                  <button
                    onClick={addVariable}
                    className="px-6 py-3 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white text-base font-bold rounded-xl transition-all duration-200 shadow-lg shadow-primary-500/40 flex items-center gap-2"
                  >
                    <FaPlus />
                    Adicionar Variável
                  </button>
                </div>
                
                {/* AVISO quando há variáveis no texto mas exemplos não preenchidos */}
                {(() => {
                  const varsInText = bodyText.match(/\{\{(\d+)\}\}/g)?.length || 0;
                  const varsWithExamples = bodyVariables.filter(v => v.example.trim()).length;
                  const hasMissingExamples = varsInText > 0 && varsWithExamples < varsInText;
                  
                  return hasMissingExamples && (
                    <div className="mb-4 p-4 bg-red-500/20 border-2 border-red-500/50 rounded-xl animate-pulse">
                      <div className="flex items-center gap-3">
                        <FaExclamationTriangle className="text-red-400 text-2xl" />
                        <div>
                          <p className="text-red-300 font-bold text-lg">⚠️ ATENÇÃO: Exemplos Obrigatórios!</p>
                          <p className="text-red-200 text-sm mt-1">
                            Você tem <strong>{varsInText} variável(is)</strong> no texto, mas só preencheu <strong>{varsWithExamples} exemplo(s)</strong>.
                            <br />
                            <strong>O WhatsApp vai REJEITAR o template se você não preencher TODOS os exemplos!</strong>
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {bodyVariables.length > 0 && (
                  <div className="space-y-4">
                    {bodyVariables.map((variable, index) => (
                      <div key={variable.id} className="flex items-center gap-4">
                        <div className="font-black text-blue-400 text-xl w-20">
                          {`{{${variable.placeholder || index + 1}}}`}
                        </div>
                        <input
                          type="text"
                          value={variable.example}
                          onChange={(e) => updateVariableExample(variable.id, e.target.value)}
                          placeholder="Exemplo: João"
                          className="flex-1 px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/30 transition-all"
                        />
                        <button
                          onClick={() => removeVariable(variable.id)}
                          className="px-4 py-4 bg-red-500/20 hover:bg-red-500/30 text-red-300 border-2 border-red-500/40 rounded-xl font-bold transition-all duration-200"
                        >
                          <FaTrash className="text-xl" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* FOOTER */}
          <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-8 shadow-xl">
            <div className="flex items-center gap-4 mb-6">
              <input
                type="checkbox"
                checked={hasFooter}
                onChange={(e) => setHasFooter(e.target.checked)}
                className="w-7 h-7 rounded border-2 border-white/20"
              />
              <h2 className="text-3xl font-black text-white">🔚 Footer (Opcional)</h2>
            </div>

            {hasFooter && (
              <div className="ml-10">
                <input
                  type="text"
                  value={footerText}
                  onChange={(e) => setFooterText(e.target.value)}
                  placeholder="ex: Responda PARAR para cancelar"
                  maxLength={60}
                  className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/30 transition-all"
                />
                <p className="text-sm text-white/60 mt-2 font-medium">
                  {footerText.length}/60 caracteres
                </p>
              </div>
            )}
          </div>

          {/* BOTÕES */}
          <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-8 shadow-xl">
            <div className="mb-6">
              <h2 className="text-3xl font-black text-white mb-2">🔘 Botões (Opcional)</h2>
              <p className="text-white/60 text-lg font-medium">
                ✨ Você pode adicionar múltiplos tipos de botões no mesmo template!
              </p>
              
              {/* Contador de botões */}
              <div className={`mt-4 px-6 py-4 rounded-xl border-2 font-bold text-xl flex items-center justify-between ${
                totalButtons >= 3 
                  ? 'bg-red-500/10 border-red-500/40 text-red-300'
                  : totalButtons > 0
                  ? 'bg-blue-500/10 border-blue-500/40 text-blue-300'
                  : 'bg-gray-500/10 border-gray-500/40 text-gray-400'
              }`}>
                <div>
                  <span className="text-3xl mr-3">{totalButtons}/3</span>
                  Botões Adicionados
                </div>
                {totalButtons >= 3 && (
                  <div className="text-red-400 text-sm font-semibold bg-red-500/20 px-4 py-2 rounded-lg">
                    ⚠️ LIMITE ATINGIDO
                  </div>
                )}
                {totalButtons > 0 && totalButtons < 3 && (
                  <div className="text-green-400 text-sm font-semibold bg-green-500/20 px-4 py-2 rounded-lg">
                    ✅ Pode adicionar mais {3 - totalButtons}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-8">
              {/* BOTÕES DE RESPOSTA RÁPIDA */}
              <div className="p-6 bg-green-500/5 border-2 border-green-500/20 rounded-2xl">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-2xl font-black text-white mb-1">💬 Resposta Rápida</h3>
                    <p className="text-white/60 text-sm font-medium">
                      Botões que aparecem abaixo da mensagem ({quickReplyButtons.length}/3)
                    </p>
                  </div>
                  <button
                    onClick={addQuickReplyButton}
                    disabled={!canAddMoreButtons || quickReplyButtons.length >= 3}
                    className="px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white text-base font-bold rounded-xl transition-all duration-200 shadow-lg shadow-green-500/40 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FaPlus />
                    Adicionar
                  </button>
                </div>
                
                {quickReplyButtons.length > 0 ? (
                  <div className="space-y-4">
                    {quickReplyButtons.map((btn, index) => (
                      <div key={btn.id} className="flex items-center gap-4">
                        <div className="font-black text-green-400 text-lg w-24">Botão {index + 1}</div>
                        <input
                          type="text"
                          value={btn.text}
                          onChange={(e) => updateQuickReplyButton(btn.id, e.target.value)}
                          placeholder="ex: Quero saber mais"
                          maxLength={20}
                          className="flex-1 px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/30 transition-all"
                        />
                        <div className="text-white/60 text-base font-medium w-20">{btn.text.length}/20</div>
                        <button 
                          onClick={() => removeQuickReplyButton(btn.id)} 
                          className="px-4 py-4 bg-red-500/20 hover:bg-red-500/30 text-red-300 border-2 border-red-500/40 rounded-xl font-bold transition-all duration-200"
                        >
                          <FaTrash className="text-xl" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-white/40 text-lg">
                    Nenhum botão de resposta rápida adicionado
                  </div>
                )}
              </div>

              {/* BOTÕES DE LIGAR */}
              <div className="p-6 bg-blue-500/5 border-2 border-blue-500/20 rounded-2xl">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-2xl font-black text-white mb-1">📞 Botão de Ligar</h3>
                    <p className="text-white/60 text-sm font-medium">
                      Abre o discador com um número ({callButtons.length}/1)
                    </p>
                  </div>
                  <button
                    onClick={addCallButton}
                    disabled={!canAddMoreButtons || callButtons.length >= 1}
                    className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white text-base font-bold rounded-xl transition-all duration-200 shadow-lg shadow-blue-500/40 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FaPlus />
                    Adicionar
                  </button>
                </div>
                
                {callButtons.length > 0 ? (
                  <div className="space-y-4">
                    {callButtons.map((btn) => (
                      <div key={btn.id} className="space-y-4 p-6 bg-white/5 rounded-xl border-2 border-white/10">
                        <div className="flex items-center gap-4">
                          <label className="text-white font-bold text-lg w-40">Texto do Botão:</label>
                          <input
                            type="text"
                            value={btn.text}
                            onChange={(e) => updateCallButton(btn.id, 'text', e.target.value)}
                            placeholder="ex: Ligar agora"
                            maxLength={20}
                            className="flex-1 px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/30 transition-all"
                          />
                        </div>
                        <div className="flex items-center gap-4">
                          <label className="text-white font-bold text-lg w-40">Telefone:</label>
                          <input
                            type="text"
                            value={btn.phoneNumber}
                            onChange={(e) => updateCallButton(btn.id, 'phoneNumber', e.target.value)}
                            placeholder="ex: +5562999999999"
                            className="flex-1 px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/30 transition-all"
                          />
                        </div>
                        <button 
                          onClick={() => removeCallButton(btn.id)} 
                          className="w-full px-6 py-4 bg-red-500/20 hover:bg-red-500/30 text-red-300 border-2 border-red-500/40 rounded-xl font-bold transition-all duration-200 flex items-center justify-center gap-2"
                        >
                          <FaTrash className="text-xl" />
                          Remover
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-white/40 text-lg">
                    Nenhum botão de ligar adicionado
                  </div>
                )}
              </div>

              {/* BOTÕES DE URL */}
              <div className="p-6 bg-purple-500/5 border-2 border-purple-500/20 rounded-2xl">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-2xl font-black text-white mb-1">🔗 Botão de Link</h3>
                    <p className="text-white/60 text-sm font-medium">
                      Abre uma URL no navegador ({urlButtons.length}/2)
                    </p>
                  </div>
                  <button
                    onClick={addUrlButton}
                    disabled={!canAddMoreButtons || urlButtons.length >= 2}
                    className="px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white text-base font-bold rounded-xl transition-all duration-200 shadow-lg shadow-purple-500/40 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FaPlus />
                    Adicionar
                  </button>
                </div>
                
                {urlButtons.length > 0 ? (
                  <div className="space-y-4">
                    {urlButtons.map((btn, index) => (
                      <div key={btn.id} className="space-y-4 p-6 bg-white/5 rounded-xl border-2 border-white/10">
                        <div className="font-black text-purple-400 text-xl">Botão {index + 1}</div>
                        <div className="flex items-center gap-4">
                          <label className="text-white font-bold text-lg w-40">Texto do Botão:</label>
                          <input
                            type="text"
                            value={btn.text}
                            onChange={(e) => updateUrlButton(btn.id, 'text', e.target.value)}
                            placeholder="ex: Ver site"
                            maxLength={20}
                            className="flex-1 px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/30 transition-all"
                          />
                        </div>
                        <div className="flex items-center gap-4">
                          <label className="text-white font-bold text-lg w-40">URL:</label>
                          <input
                            type="text"
                            value={btn.url}
                            onChange={(e) => updateUrlButton(btn.id, 'url', e.target.value)}
                            placeholder="https://exemplo.com"
                            className="flex-1 px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/30 transition-all"
                          />
                        </div>
                        <button 
                          onClick={() => removeUrlButton(btn.id)} 
                          className="w-full px-6 py-4 bg-red-500/20 hover:bg-red-500/30 text-red-300 border-2 border-red-500/40 rounded-xl font-bold transition-all duration-200 flex items-center justify-center gap-2"
                        >
                          <FaTrash className="text-xl" />
                          Remover
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-white/40 text-lg">
                    Nenhum botão de link adicionado
                  </div>
                )}
              </div>

              {/* BOTÕES DE COPIAR CÓDIGO */}
              <div className="p-6 bg-orange-500/5 border-2 border-orange-500/20 rounded-2xl">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-2xl font-black text-white mb-1">📋 Botão de Copiar Código</h3>
                    <p className="text-white/60 text-sm font-medium">
                      Copia um código/cupom automaticamente ({copyCodeButtons.length}/1)
                    </p>
                  </div>
                  <button
                    onClick={addCopyCodeButton}
                    disabled={!canAddMoreButtons || copyCodeButtons.length >= 1}
                    className="px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white text-base font-bold rounded-xl transition-all duration-200 shadow-lg shadow-orange-500/40 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FaPlus />
                    Adicionar
                  </button>
                </div>
                
                {copyCodeButtons.length > 0 ? (
                  <div className="space-y-4">
                    {copyCodeButtons.map((btn) => (
                      <div key={btn.id} className="space-y-4 p-6 bg-white/5 rounded-xl border-2 border-white/10">
                        <div>
                          <label className="text-white font-bold text-lg mb-2 block">Código de Exemplo:</label>
                          <input
                            type="text"
                            value={btn.example}
                            onChange={(e) => updateCopyCodeButton(btn.id, e.target.value)}
                            placeholder="ex: PROMO2024 ou CUPOM50OFF"
                            maxLength={15}
                            className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/30 transition-all font-mono"
                          />
                          <p className="text-white/60 text-sm mt-2">
                            {btn.example.length}/15 caracteres - Este código será copiado quando o usuário clicar no botão
                          </p>
                        </div>
                        <button 
                          onClick={() => removeCopyCodeButton(btn.id)} 
                          className="w-full px-6 py-4 bg-red-500/20 hover:bg-red-500/30 text-red-300 border-2 border-red-500/40 rounded-xl font-bold transition-all duration-200 flex items-center justify-center gap-2"
                        >
                          <FaTrash className="text-xl" />
                          Remover
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-white/40 text-lg">
                    Nenhum botão de copiar código adicionado
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* PREVIEW */}
          <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 backdrop-blur-xl border-2 border-green-500/30 rounded-2xl p-8 shadow-xl text-center">
            <h3 className="text-3xl font-black mb-6 text-white flex items-center justify-center gap-3">
              <FaCheckCircle className="text-green-400 text-4xl" />
              Preview do Template
            </h3>
            
            <button
              onClick={() => setShowMobilePreview(true)}
              className="px-12 py-6 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white text-2xl font-black rounded-2xl transition-all shadow-xl hover:shadow-purple-500/50 flex items-center gap-4 mx-auto"
            >
              <FaMobileAlt className="text-4xl" />
              📱 Visualizar no Celular
            </button>
            
            <p className="text-white/70 mt-4 text-lg">
              Clique para ver como ficará no WhatsApp do cliente
            </p>
          </div>

          {/* BOTÕES DE AÇÃO */}
          <div className="flex gap-6 pt-6">
            <button
              onClick={() => router.back()}
              className="flex-1 px-8 py-5 bg-dark-700 hover:bg-dark-600 text-white text-xl font-bold rounded-xl transition-all duration-200 border-2 border-white/20 flex items-center justify-center gap-3"
            >
              <FaArrowLeft className="text-2xl" />
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 px-8 py-5 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white text-xl font-bold rounded-xl transition-all duration-200 shadow-lg shadow-green-500/30 disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                  Criando...
                </>
              ) : (
                <>
                  <FaRocket className="text-2xl" />
                  Criar Template em {selectedAccountIds.length} conta(s)
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Preview do Template no Modal */}
      <TemplatePreview
        isOpen={showMobilePreview}
        onClose={() => setShowMobilePreview(false)}
        template={{
          name: templateName || 'Novo Template',
          category: category,
          header_type: hasHeader ? headerType : undefined,
          header_text: hasHeader && headerType === 'TEXT' ? headerText : undefined,
          body_text: bodyText,
          footer_text: hasFooter ? footerText : undefined,
          buttons: [
            ...quickReplyButtons.map(b => ({ type: 'QUICK_REPLY', text: b.text })),
            ...callButtons.map(b => ({ type: 'PHONE_NUMBER', text: b.text, phone_number: b.phoneNumber })),
            ...urlButtons.map(b => ({ type: 'URL', text: b.text, url: b.url })),
            ...copyCodeButtons.map(b => ({ type: 'COPY_CODE', example: b.example }))
          ],
        }}
      />

      <style jsx>{`
        .bg-grid-white {
          background-image: 
            linear-gradient(to right, rgba(255, 255, 255, 0.1) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.1) 1px, transparent 1px);
          background-size: 20px 20px;
        }
      `}</style>
    </>
  );
}
