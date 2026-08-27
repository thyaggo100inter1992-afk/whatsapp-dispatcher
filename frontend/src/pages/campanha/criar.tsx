import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { 
  FaCalendarAlt, FaPlus, FaTrash, FaClock, FaPause, FaRocket,
  FaSearch, FaTimes, FaUpload, FaCheckCircle, FaExclamationTriangle,
  FaCheckDouble, FaTimesCircle, FaDownload, FaPhone, FaImage,
  FaVideo, FaFileAlt, FaMusic, FaBolt, FaChartLine, FaMobileAlt, FaEye
} from 'react-icons/fa';
import { whatsappAccountsAPI, campaignsAPI, uploadAPI } from '@/services/api';
import ToastContainer from '@/components/ToastContainer';
import { useToast } from '@/hooks/useToast';
import { useConfirm } from '@/hooks/useConfirm';
import TemplatePreview from '@/components/TemplatePreview';
import RestrictionCheckModal from '@/components/RestrictionCheckModal';
import * as XLSX from 'xlsx';

// Configuração da URL base da API
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace(/\/api$/, '');

interface WhatsAppAccount {
  id: number;
  name: string;
  phone_number: string;
  is_active: boolean;
}

interface Template {
  name: string;
  status: string;
  language: string;
  category: string;
  components: any[];
}

interface UploadedMedia {
  file: File;
  preview?: string;
  url?: string;
  type: 'image' | 'video' | 'audio' | 'document';
}

interface Contact {
  phone: string;
  cpf?: string;
  variables: string[];
}

export default function CriarCampanha() {
  const router = useRouter();
  const toast = useToast();
  const { confirm, ConfirmDialog } = useConfirm();
  
  // 1. Configurações Básicas
  const [campaignName, setCampaignName] = useState('');
  
  // 2. Números de Origem
  const [accounts, setAccounts] = useState<WhatsAppAccount[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<number[]>([]);
  
  // 3. Templates (organizados por conta)
  const [availableTemplates, setAvailableTemplates] = useState<Record<number, Template[]>>({});
  const [selectedTemplates, setSelectedTemplates] = useState<Record<number, Set<string>>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [excludeQuery, setExcludeQuery] = useState('');
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [loadingAccountIds, setLoadingAccountIds] = useState<Set<number>>(new Set());
  
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  
  // Novos filtros
  const [filterOnlyWithMedia, setFilterOnlyWithMedia] = useState(false);
  const [filterMediaType, setFilterMediaType] = useState<'all' | 'image' | 'video' | 'document' | 'audio'>('all');
  const [filterCategory, setFilterCategory] = useState<'all' | 'MARKETING' | 'UTILITY' | 'AUTHENTICATION'>('all');
  
  // 4. Upload de Mídias
  const [uploadedImages, setUploadedImages] = useState<UploadedMedia[]>([]);
  const [uploadedVideos, setUploadedVideos] = useState<UploadedMedia[]>([]);
  const [uploadedAudios, setUploadedAudios] = useState<UploadedMedia[]>([]);
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedMedia[]>([]);
  
  // 5. Lista de Contatos
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsInput, setContactsInput] = useState('');
  const [contactsMethod, setContactsMethod] = useState<'none' | 'upload' | 'paste'>('none');
  
  // 6. Agendamento
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [workStartTime, setWorkStartTime] = useState('08:00');
  const [workEndTime, setWorkEndTime] = useState('20:00');
  const [intervalSecondsMin, setIntervalSecondsMin] = useState('10');
  const [intervalSecondsMax, setIntervalSecondsMax] = useState('20');
  
  // 7. Configurações Avançadas
  const [pauseAfter, setPauseAfter] = useState('100');
  const [pauseDuration, setPauseDuration] = useState('30');
  
  // Estados auxiliares
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  
  // Estados para verificação de restrições
  const [showRestrictionModal, setShowRestrictionModal] = useState(false);
  const [restrictionCheckResult, setRestrictionCheckResult] = useState<any>(null);
  const [isCheckingRestrictions, setIsCheckingRestrictions] = useState(false);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      // 🔧 Carregar APENAS contas de API Oficial (não QR Connect)
      const response = await whatsappAccountsAPI.getActive('api');
      setAccounts(response.data.data);
    } catch (error) {
      console.error('Erro ao carregar contas:', error);
    }
  };

  const loadTemplatesForAccounts = async (accountIds: number[]) => {
    // Filtrar apenas contas que ainda não têm templates carregados
    const accountsToLoad = accountIds.filter(id => !availableTemplates[id]);
    if (accountsToLoad.length === 0) return;

    // Marcar todas as contas novas como "carregando"
    setLoadingAccountIds(prev => new Set([...prev, ...accountsToLoad]));
    setLoadingTemplates(true);

    // Carregar todas as contas em PARALELO (muito mais rápido que sequencial)
    await Promise.all(
      accountsToLoad.map(async (accountId) => {
        try {
          console.log(`\n📋 ===== CARREGANDO TEMPLATES (API OFICIAL) =====`);
          console.log(`   Conta ID: ${accountId}`);

          const response = await whatsappAccountsAPI.getTemplates(accountId);

          if (response.data.success) {
            const allTemplates = response.data.templates || [];
            const approvedTemplates = allTemplates.filter((t: Template) => t.status === 'APPROVED');

            console.log(`   ✅ Templates recebidos do backend: ${allTemplates.length}`);
            console.log(`   ✅ Templates APPROVED: ${approvedTemplates.length}`);
            console.log(`================================================\n`);

            setAvailableTemplates(prev => ({
              ...prev,
              [accountId]: approvedTemplates
            }));
          }
        } catch (error) {
          console.error(`Erro ao carregar templates da conta ${accountId}:`, error);
          // Marcar conta com array vazio para não tentar novamente em loop
          setAvailableTemplates(prev => ({ ...prev, [accountId]: [] }));
        } finally {
          // Remover esta conta do set de "carregando" ao terminar
          setLoadingAccountIds(prev => {
            const next = new Set(prev);
            next.delete(accountId);
            return next;
          });
        }
      })
    );

    setLoadingTemplates(false);
  };

  const handleAccountToggle = (accountId: number) => {
    const newSelected = selectedAccountIds.includes(accountId)
      ? selectedAccountIds.filter(id => id !== accountId)
      : [...selectedAccountIds, accountId];
    
    setSelectedAccountIds(newSelected);
    
    // Inicializar selectedTemplates para nova conta
    if (!selectedTemplates[accountId]) {
      setSelectedTemplates(prev => ({
        ...prev,
        [accountId]: new Set<string>()
      }));
    }
    
    if (newSelected.length > 0) {
      loadTemplatesForAccounts(newSelected);
    }
  };

  const handleTemplateToggle = (accountId: number, templateName: string) => {
    setSelectedTemplates(prev => {
      const accountTemplates = new Set(prev[accountId] || []);
      
      if (accountTemplates.has(templateName)) {
        accountTemplates.delete(templateName);
      } else {
        accountTemplates.add(templateName);
      }
      
      return {
        ...prev,
        [accountId]: accountTemplates
      };
    });
  };

  const handlePreviewTemplate = (template: Template, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent template selection
    setPreviewTemplate(template);
    setShowPreview(true);
  };

  const parseTemplateForPreview = (template: Template) => {
    const headerComp = template.components?.find((c: any) => c.type === 'HEADER');
    const bodyComp = template.components?.find((c: any) => c.type === 'BODY');
    const footerComp = template.components?.find((c: any) => c.type === 'FOOTER');
    const buttonsComp = template.components?.find((c: any) => c.type === 'BUTTONS');

    return {
      name: template.name,
      category: template.category,
      header_type: headerComp?.format,
      header_text: headerComp?.text,
      body_text: bodyComp?.text || '',
      footer_text: footerComp?.text,
      buttons: buttonsComp?.buttons?.map((btn: any) => ({
        type: btn.type,
        text: btn.text,
        url: btn.url,
        phone_number: btn.phone_number,
      })) || [],
    };
  };

  // Função auxiliar para detectar tipo de mídia no template
  const getTemplateMediaType = (template: Template): 'image' | 'video' | 'document' | 'audio' | null => {
    const headerComponent = template.components?.find((c: any) => c.type === 'HEADER');
    if (!headerComponent || headerComponent.format === 'TEXT') {
      return null;
    }
    
    const format = headerComponent.format?.toLowerCase();
    if (format === 'image') return 'image';
    if (format === 'video') return 'video';
    if (format === 'document') return 'document';
    if (format === 'audio') return 'audio';
    
    return null;
  };

  const getFilteredTemplatesForAccount = (accountId: number): Template[] => {
    let templates = availableTemplates[accountId] || [];
    
    // Filtro de busca
    if (searchQuery.trim()) {
      templates = templates.filter(t =>
        t.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    // Filtro de exclusão
    if (excludeQuery.trim()) {
      templates = templates.filter(t =>
        !t.name.toLowerCase().includes(excludeQuery.toLowerCase())
      );
    }
    
    // Filtro de categoria
    if (filterCategory !== 'all') {
      templates = templates.filter(t => t.category === filterCategory);
    }
    
    // Filtro "Apenas com Mídia"
    if (filterOnlyWithMedia) {
      templates = templates.filter(t => {
        const mediaType = getTemplateMediaType(t);
        
        // Se não tem mídia, excluir
        if (!mediaType) return false;
        
        // Se filterMediaType é 'all', aceitar qualquer mídia
        if (filterMediaType === 'all') return true;
        
        // Caso contrário, verificar se o tipo corresponde
        return mediaType === filterMediaType;
      });
    }
    
    return templates;
  };

  const selectAllVisibleForAccount = (accountId: number) => {
    const filtered = getFilteredTemplatesForAccount(accountId);
    setSelectedTemplates(prev => ({
      ...prev,
      [accountId]: new Set(filtered.map(t => t.name))
    }));
  };

  const deselectAllForAccount = (accountId: number) => {
    setSelectedTemplates(prev => ({
      ...prev,
      [accountId]: new Set<string>()
    }));
  };

  const selectAllVisible = () => {
    const newSelected: Record<number, Set<string>> = {};
    selectedAccountIds.forEach(accountId => {
      const filtered = getFilteredTemplatesForAccount(accountId);
      newSelected[accountId] = new Set(filtered.map(t => t.name));
    });
    setSelectedTemplates(newSelected);
  };

  const deselectAll = () => {
    const newSelected: Record<number, Set<string>> = {};
    selectedAccountIds.forEach(accountId => {
      newSelected[accountId] = new Set<string>();
    });
    setSelectedTemplates(newSelected);
  };

  const getTotalSelectedTemplates = (): number => {
    return Object.values(selectedTemplates).reduce((sum, set) => sum + set.size, 0);
  };

  const getAllSelectedTemplateObjects = (): { accountId: number; template: Template }[] => {
    const result: { accountId: number; template: Template }[] = [];
    
    Object.entries(selectedTemplates).forEach(([accountIdStr, templateNames]) => {
      const accountId = parseInt(accountIdStr);
      const templates = availableTemplates[accountId] || [];
      
      templateNames.forEach(name => {
        const template = templates.find(t => t.name === name);
        if (template) {
          result.push({ accountId, template });
        }
      });
    });
    
    return result;
  };

  const getMediaHeaderType = (template: Template): string | null => {
    const headerComponent = template.components.find((c: any) =>
      c.type === 'HEADER' &&
      (c.format === 'IMAGE' || c.format === 'VIDEO' || c.format === 'AUDIO' || c.format === 'DOCUMENT')
    );
    return headerComponent?.format || null;
  };

  const getVariableCount = (template: Template): number => {
    const bodyComponent = template.components.find((c: any) => c.type === 'BODY');
    if (!bodyComponent?.text) return 0;
    const matches = bodyComponent.text.match(/\{\{\d+\}\}/g);
    return matches ? matches.length : 0;
  };

  const getMediaRequirements = () => {
    const allSelected = getAllSelectedTemplateObjects();
    const requirements = {
      images: 0,
      videos: 0,
      audios: 0,
      documents: 0,
    };

    allSelected.forEach(({ template }) => {
      const mediaType = getMediaHeaderType(template);
      if (mediaType === 'IMAGE') requirements.images++;
      if (mediaType === 'VIDEO') requirements.videos++;
      if (mediaType === 'AUDIO') requirements.audios++;
      if (mediaType === 'DOCUMENT') requirements.documents++;
    });

    return requirements;
  };

  const getMaxVariables = (): number => {
    const allSelected = getAllSelectedTemplateObjects();
    return Math.max(0, ...allSelected.map(({ template }) => getVariableCount(template)));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    
    const files = Array.from(e.target.files);
    const newImages: UploadedMedia[] = [];
    
    for (const file of files) {
      if (file.type.startsWith('image/')) {
        const preview = URL.createObjectURL(file);
        newImages.push({
          file,
          preview,
          type: 'image'
        });
      }
    }
    
    setUploadedImages([...uploadedImages, ...newImages]);
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    
    const files = Array.from(e.target.files);
    const newVideos: UploadedMedia[] = [];
    
    for (const file of files) {
      if (file.type.startsWith('video/')) {
        newVideos.push({
          file,
          type: 'video'
        });
      }
    }
    
    setUploadedVideos([...uploadedVideos, ...newVideos]);
  };

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    
    const files = Array.from(e.target.files);
    const newAudios: UploadedMedia[] = [];
    
    for (const file of files) {
      if (file.type.startsWith('audio/')) {
        newAudios.push({
          file,
          type: 'audio'
        });
      }
    }
    
    setUploadedAudios([...uploadedAudios, ...newAudios]);
  };

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    
    const files = Array.from(e.target.files);
    const newDocs: UploadedMedia[] = [];
    
    for (const file of files) {
      if (file.type === 'application/pdf' || file.type.startsWith('application/')) {
        newDocs.push({
          file,
          type: 'document'
        });
      }
    }
    
    setUploadedDocuments([...uploadedDocuments, ...newDocs]);
  };

  const removeMedia = (type: 'image' | 'video' | 'audio' | 'document', index: number) => {
    if (type === 'image') {
      const newImages = [...uploadedImages];
      if (newImages[index].preview) URL.revokeObjectURL(newImages[index].preview!);
      newImages.splice(index, 1);
      setUploadedImages(newImages);
    } else if (type === 'video') {
      const newVideos = [...uploadedVideos];
      newVideos.splice(index, 1);
      setUploadedVideos(newVideos);
    } else if (type === 'audio') {
      const newAudios = [...uploadedAudios];
      newAudios.splice(index, 1);
      setUploadedAudios(newAudios);
    } else if (type === 'document') {
      const newDocs = [...uploadedDocuments];
      newDocs.splice(index, 1);
      setUploadedDocuments(newDocs);
    }
  };

  // ✅ Função auxiliar para converter notação científica de volta para número
  // ⚠️ IMPORTANTE: SÓ aplicar em números de telefone, NÃO em variáveis de texto!
  const fixScientificNotation = (value: string, isPhoneNumber: boolean = false): string => {
    // Se não tem números, retornar como está
    if (!/\d/.test(value)) return value;
    
    // Detectar notação científica: 5.6298E+12, 5.6298BE+12, etc
    const scientificRegex = /^(\d+\.?\d*)[BE]\+(\d+)$/i;
    const match = value.match(scientificRegex);
    
    if (match) {
      try {
        // Converter para número e depois para string sem decimais
        const num = parseFloat(value.replace(/B/gi, 'E')); // Normalizar B para E
        const result = num.toFixed(0); // Sem casas decimais
        console.log(`🔢 Convertido notação científica: ${value} -> ${result}`);
        return result;
      } catch (e) {
        console.warn(`⚠️ Falha ao converter notação científica: ${value}`);
        return value;
      }
    }
    
    // SÓ remover caracteres não numéricos se for NÚMERO DE TELEFONE
    if (isPhoneNumber) {
    let cleaned = value.replace(/[^\d+]/g, '');
    return cleaned;
    }
    
    // Para variáveis de texto, retornar como está (sem modificar!)
    return value;
  };

  const parseContacts = (input: string): Contact[] => {
    const lines = input.trim().split('\n');
    const parsedContacts: Contact[] = [];
    const seenPhones = new Set<string>(); // ✅ Para rastrear números já vistos
    
    console.log(`📊 Parseando ${lines.length} linhas de contatos...`);

    let phoneIdx = 0;
    let cpfIdx = -1;
    let variableIndexes: number[] = [];
    let headerParsed = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Detectar separador (vírgula ou ponto-e-vírgula)
      const separator = line.includes(';') ? ';' : ',';
      const parts = line.split(separator).map(p => p.trim());

      const isHeader =
        i === 0 &&
        (
          parts[0]?.toUpperCase().includes('NUMERO') ||
          parts[0]?.toUpperCase().includes('NUMBER') ||
          parts.some(p => p?.toUpperCase().includes('VARIAVEL')) ||
          parts.some(p => p?.toUpperCase().includes('VARIABLE')) ||
          parts.some(p => p?.toUpperCase() === 'CPF')
        );

      // Linha de cabeçalho: mapear colunas (NUMERO, CPF, VARIAVEL_*)
      if (isHeader) {
        headerParsed = true;
        phoneIdx = parts.findIndex(p => {
          const u = p.toUpperCase();
          return u.includes('NUMERO') || u.includes('NUMBER') || u === 'PHONE' || u === 'TELEFONE';
        });
        if (phoneIdx < 0) phoneIdx = 0;

        cpfIdx = parts.findIndex(p => {
          const u = p.toUpperCase().replace(/[^A-Z0-9]/g, '');
          return u === 'CPF' || u.includes('CPF');
        });

        variableIndexes = parts
          .map((p, idx) => ({ p: p.toUpperCase(), idx }))
          .filter(({ p, idx }) => {
            if (idx === phoneIdx || idx === cpfIdx) return false;
            return p.includes('VARIAVEL') || p.includes('VARIABLE') || p.startsWith('VAR');
          })
          .map(({ idx }) => idx);

        // Se não houver colunas VARIAVEL_* nomeadas, tudo que sobrar (exceto NUMERO/CPF) vira variável
        if (variableIndexes.length === 0) {
          variableIndexes = parts
            .map((_, idx) => idx)
            .filter(idx => idx !== phoneIdx && idx !== cpfIdx);
        }

        console.log('📋 Cabeçalho:', { phoneIdx, cpfIdx, variableIndexes, parts });
        continue;
      }
      
      // Adicionar contato se tiver número de telefone válido
      const phoneRaw = parts[phoneIdx] || parts[0];
      if (phoneRaw && /\d/.test(phoneRaw)) {
        // ✅ CORRIGIR: Converter notação científica do telefone (é número de telefone!)
        const phone = fixScientificNotation(phoneRaw, true);
        
        // ✅ REMOVER DUPLICATAS: Pular se o número já foi visto
        if (seenPhones.has(phone)) {
          console.warn(`⚠️ Linha ${i + 1} ignorada (número duplicado): ${phone}`);
          continue;
        }
        
        seenPhones.add(phone);

        let cpf = '';
        if (headerParsed && cpfIdx >= 0 && parts[cpfIdx]) {
          cpf = fixScientificNotation(parts[cpfIdx], true).replace(/\D/g, '');
        }

        let variables: string[];
        if (headerParsed && variableIndexes.length > 0) {
          variables = variableIndexes.map(idx =>
            fixScientificNotation(parts[idx] || '', false)
          );
        } else {
          // Sem cabeçalho: formato antigo NUMERO, VAR1, VAR2...
          variables = parts.slice(1).map(v => fixScientificNotation(v, false));
        }
        
        console.log(
          `📞 Linha ${i + 1}: ${phoneRaw} -> ${phone}`,
          cpf ? `CPF=${cpf}` : '',
          variables.length > 0 ? `(${variables.length} vars)` : ''
        );
        
        parsedContacts.push({
          phone,
          cpf: cpf || undefined,
          variables
        });
      } else if (phoneRaw) {
        console.warn(`⚠️ Linha ${i + 1} ignorada (sem número válido):`, phoneRaw);
      }
    }
    
    console.log(`✅ Total de contatos parseados: ${parsedContacts.length} (${seenPhones.size} únicos)`);
    return parsedContacts;
  };

  const handleContactsInputChange = (value: string) => {
    setContactsInput(value);
    if (value.trim()) {
      const parsed = parseContacts(value);
      setContacts(parsed);
      setContactsMethod('paste');
    } else {
      setContacts([]);
      setContactsMethod('none');
    }
  };

  const handleFileUpload = (file: File) => {
    console.log(`📁 Processando arquivo: ${file.name} (${file.size} bytes)`);
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = event.target?.result;
        
        // Se for arquivo Excel (.xlsx ou .xls)
        if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
          console.log('📊 Lendo arquivo Excel...');
          
          // ✅ CORRIGIR: Usar opções para manter números como strings
          const workbook = XLSX.read(data, { 
            type: 'binary',
            raw: true,  // ✅ Manter valores raw (evita conversão automática)
            cellText: true,  // ✅ Forçar texto em células
            cellDates: false  // ✅ Não converter datas
          });
          
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          
          console.log('📋 Primeira célula (A1):', worksheet['A1']);
          console.log('📋 Segunda célula (A2):', worksheet['A2']);
          
          // Converter para CSV mantendo valores raw
          const csv = XLSX.utils.sheet_to_csv(worksheet, {
            blankrows: false  // Ignorar linhas vazias
          });
          
          console.log('📄 CSV gerado (primeiras 200 chars):', csv.substring(0, 200));
          
          setContactsInput(csv);
          const parsed = parseContacts(csv);
          setContacts(parsed);
        } else {
          // Para arquivos CSV
          console.log('📄 Lendo arquivo CSV...');
          const text = data as string;
          console.log('📄 Conteúdo (primeiras 200 chars):', text.substring(0, 200));
          
          setContactsInput(text);
          const parsed = parseContacts(text);
          setContacts(parsed);
        }
        
        setContactsMethod('upload');
        console.log(`✅ Arquivo processado com sucesso! ${contacts.length} contatos carregados.`);
      } catch (error) {
        console.error('❌ Erro ao processar arquivo:', error);
        await confirm({
          title: '❌ Erro ao Processar Arquivo',
          message: 'Erro ao processar arquivo. Verifique se o arquivo está no formato correto.',
          type: 'danger',
          confirmText: 'OK',
          showCancel: false
        });
      }
    };
    
    // Ler como binary para Excel, como text para CSV
    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      reader.readAsBinaryString(file);
    } else {
      reader.readAsText(file);
    }
  };

  const clearContacts = () => {
    setContactsInput('');
    setContacts([]);
    setContactsMethod('none');
  };

  const validateCampaign = (): string[] => {
    const errors: string[] = [];
    
    if (!campaignName.trim()) {
      errors.push('Nome da campanha é obrigatório');
    }
    
    if (selectedAccountIds.length === 0) {
      errors.push('Selecione pelo menos uma conta WhatsApp');
    }
    
    if (getTotalSelectedTemplates() === 0) {
      errors.push('Selecione pelo menos um template');
    }
    
    // VALIDAÇÃO: Cada conta selecionada deve ter pelo menos 1 template
    selectedAccountIds.forEach(accountId => {
      const accountTemplates = selectedTemplates[accountId];
      if (!accountTemplates || accountTemplates.size === 0) {
        const account = accounts.find(a => a.id === accountId);
        errors.push(`⚠️ Conta "${account?.name || accountId}" foi selecionada mas NÃO tem nenhum template! Selecione pelo menos 1 template desta conta.`);
      }
    });
    
    if (contacts.length === 0) {
      errors.push('Adicione pelo menos um contato');
    }
    
    const requirements = getMediaRequirements();
    
    if (requirements.images > 0 && uploadedImages.length === 0) {
      errors.push(`${requirements.images} template(s) precisam de imagens. Faça upload de pelo menos 1 imagem.`);
    }
    
    if (requirements.videos > 0 && uploadedVideos.length === 0) {
      errors.push(`${requirements.videos} template(s) precisam de vídeos. Faça upload de pelo menos 1 vídeo.`);
    }
    
    if (requirements.audios > 0 && uploadedAudios.length === 0) {
      errors.push(`${requirements.audios} template(s) precisam de áudios. Faça upload de pelo menos 1 áudio.`);
    }
    
    if (requirements.documents > 0 && uploadedDocuments.length === 0) {
      errors.push(`${requirements.documents} template(s) precisam de documentos. Faça upload de pelo menos 1 documento.`);
    }
    
    const maxVars = getMaxVariables();
    if (maxVars > 0 && contacts.length > 0) {
      const hasInsufficientVars = contacts.some(c => c.variables.length < maxVars);
      if (hasInsufficientVars) {
        errors.push(`Alguns templates precisam de ${maxVars} variável(is). Certifique-se de que todos os contatos tenham variáveis suficientes.`);
      }
    }
    
    return errors;
  };

  const checkRestrictions = async () => {
    console.log('');
    console.log('▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓');
    console.log('▓▓▓  INICIANDO CHECKRESTRICTIONS()  ▓▓▓');
    console.log('▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓');
    console.log('');
    
    try {
      console.log('1️⃣ Setando isCheckingRestrictions = true');
      setIsCheckingRestrictions(true);
      
      // Extrair apenas os números de telefone
      const allPhoneNumbers = contacts.map(c => c.phone);
      
      // ✅ REMOVER DUPLICATAS para contagem correta
      const phoneNumbers = [...new Set(allPhoneNumbers)];
      
      console.log('2️⃣ Números extraídos (COM duplicatas):', allPhoneNumbers);
      console.log('2️⃣ Números ÚNICOS (SEM duplicatas):', phoneNumbers);
      console.log(`   📊 Total: ${allPhoneNumbers.length} → ${phoneNumbers.length} únicos`);
      console.log('3️⃣ Contas selecionadas:', selectedAccountIds);
      console.log('3️⃣ Contas selecionadas (length):', selectedAccountIds.length);
      console.log('3️⃣ Contas selecionadas (JSON):', JSON.stringify(selectedAccountIds));
      
      // 🚨 VALIDAÇÃO CRÍTICA
      if (selectedAccountIds.length === 0) {
        console.error('🚨🚨🚨 ERRO CRÍTICO: selectedAccountIds ESTÁ VAZIO! 🚨🚨🚨');
        console.error('❌ Não é possível verificar restrições sem contas selecionadas!');
        console.error('❌ Pulando verificação e criando campanha...');
        toast.error('⚠️ Nenhuma conta selecionada. Criando campanha sem verificação...');
        await createCampaign(contacts);
        return;
      }
      
      console.log('🔍 Iniciando verificação de restrições...', {
        totalContacts: phoneNumbers.length,
        selectedAccounts: selectedAccountIds.length
      });
      
      // Verificar em TODAS as contas selecionadas
      const allRestrictedDetails: any[] = [];
      const allCountsByType = {
        do_not_disturb: 0,
        blocked: 0,
        not_interested: 0
      };
      
      // ✅ Fazer UMA ÚNICA requisição com TODAS as contas
      console.log(`📡 Fazendo requisição HTTP para TODAS as contas: [${selectedAccountIds.join(', ')}]`);
      
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/restriction-lists/check-bulk`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('@WhatsAppDispatcher:token')}`, // ✅ ADICIONAR TOKEN
          },
          body: JSON.stringify({
            phone_numbers: phoneNumbers,
            whatsapp_account_ids: selectedAccountIds, // ✅ ARRAY de contas
          }),
        });
        
        console.log(`📡 Resposta HTTP:`, {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ Erro ao verificar contas:`, {
            status: response.status,
            statusText: response.statusText,
            body: errorText
          });
          throw new Error(`Erro ao verificar restrições: ${errorText}`);
        }
        
        const result = await response.json();
        console.log(`📊 Resultado da verificação:`, result);
        
        console.log(`✅ Verificação completa:`, {
          restricted: result.restricted_count,
          clean: result.clean_count
        });
        
        // O backend já retorna tudo consolidado
        allRestrictedDetails.push(...(result.restricted_details || []));
        allCountsByType.do_not_disturb = result.count_by_type?.do_not_disturb || 0;
        allCountsByType.blocked = result.count_by_type?.blocked || 0;
        allCountsByType.not_interested = result.count_by_type?.not_interested || 0;
        
      } catch (error: any) {
        console.error(`❌ ERRO DE REDE/EXCEPTION:`, {
          message: error.message,
          stack: error.stack,
          error: error
        });
        throw error;
      }
      
      // Consolidar resultado final (com contagem ÚNICA de contatos)
      const uniqueRestrictedPhones = [...new Set(allRestrictedDetails.map(d => d.phone_number))];
      
      const finalResult = {
        success: true,
        total_checked: phoneNumbers.length, // ✅ Já são únicos
        restricted_count: uniqueRestrictedPhones.length, // ✅ Únicos restritos
        clean_count: phoneNumbers.length - uniqueRestrictedPhones.length, // ✅ Únicos limpos
        count_by_type: allCountsByType,
        restricted_details: allRestrictedDetails
      };
      
      console.log('📊 Resultado FINAL da verificação:', finalResult);
      console.log(`   📊 Contatos únicos verificados: ${phoneNumbers.length}`);
      console.log(`   🚫 Contatos únicos restritos: ${uniqueRestrictedPhones.length}`);
      console.log(`   ✅ Contatos únicos livres: ${finalResult.clean_count}`);
      
      setRestrictionCheckResult(finalResult);
      
      // Se houver contatos restritos, mostrar modal
      if (finalResult.restricted_count > 0) {
        console.log('');
        console.log('🚨🚨🚨 ATENÇÃO! CONTATOS RESTRITOS ENCONTRADOS! 🚨🚨🚨');
        console.log('⚠️ Total de restritos:', finalResult.restricted_count);
        console.log('⚠️ Abrindo modal...');
        console.log('');
        setShowRestrictionModal(true);
      } else {
        // Nenhum restrito, criar campanha diretamente
        console.log('');
        console.log('✅✅✅ NENHUM CONTATO RESTRITO ENCONTRADO! ✅✅✅');
        console.log('✅ Criando campanha automaticamente...');
        console.log('');
        toast.success('✅ Nenhum contato restrito encontrado! Criando campanha...');
        await createCampaign(contacts);
      }
      
    } catch (error: any) {
      console.log('');
      console.log('🔥🔥🔥 ERRO CRÍTICO 🔥🔥🔥');
      console.error('❌ ERRO ao verificar restrições:', error);
      console.log('Stack trace:', error.stack);
      console.log('');
      toast.error('Erro ao verificar restrições. Criando campanha sem verificação...');
      await createCampaign(contacts);
    } finally {
      console.log('');
      console.log('🏁 FINALIZANDO checkRestrictions()');
      console.log('▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓');
      console.log('');
      setIsCheckingRestrictions(false);
    }
  };

  const handleExcludeRestricted = async () => {
    if (!restrictionCheckResult) return;
    
    // Normalizar número para comparação robusta (remove espaços e caracteres não numéricos exceto +)
    const normalizePhone = (phone: string) => String(phone || '').trim().replace(/\s+/g, '').replace(/[^\d+]/g, '');

    // Filtrar contatos removendo os restritos (comparação normalizada para evitar problemas de formato)
    const restrictedPhones = [...new Set(restrictionCheckResult.restricted_details.map(
      (d: any) => normalizePhone(d.phone_number)
    ))];
    
    const filteredContacts = contacts.filter(
      c => !restrictedPhones.includes(normalizePhone(c.phone))
    );
    
    // Contar únicos nos filtrados
    const uniqueFilteredPhones = [...new Set(filteredContacts.map(c => c.phone))];
    
    console.log(`🗑️ Excluindo ${restrictedPhones.length} contatos restritos (únicos)`);
    console.log(`📊 Registros após filtro: ${filteredContacts.length} (com duplicatas)`);
    console.log(`✅ Criando campanha com ${uniqueFilteredPhones.length} contatos ÚNICOS`);
    
    setShowRestrictionModal(false);
    await createCampaign(filteredContacts);
  };

  const handleKeepAll = async () => {
    console.log(`✅ Mantendo todos os ${contacts.length} contatos (incluindo restritos)`);
    setShowRestrictionModal(false);
    await createCampaign(contacts, true); // ignore_restrictions = true: usuário optou por manter todos
  };

  const createCampaign = async (contactsToUse: Contact[], ignoreRestrictions: boolean = false) => {
    setLoading(true);
    setErrors([]);
    
    try {
      // ========================================
      // PASSO 1: SALVAR ARQUIVOS NO SERVIDOR
      // ========================================
      console.log('📤 Salvando arquivos no servidor...');
      
      // Upload das imagens para o servidor (NÃO para WhatsApp ainda)
      const uploadedImageUrls: string[] = [];
      for (const media of uploadedImages) {
        try {
          // Validar tamanho (máximo 5MB para imagens)
          const maxSize = 5 * 1024 * 1024; // 5MB
          if (media.file.size > maxSize) {
            throw new Error(`Imagem muito grande (${(media.file.size / 1024 / 1024).toFixed(2)}MB). Máximo: 5MB`);
          }
          
          console.log(`📤 Salvando imagem: ${media.file.name} (${(media.file.size / 1024 / 1024).toFixed(2)}MB)`);
          
          const uploadResponse = await uploadAPI.uploadMedia(media.file);
          
          if (!uploadResponse.data) {
            throw new Error('Erro ao salvar a imagem no servidor');
          }
          
          // ✅ Converter URL relativa para URL completa
          const data = uploadResponse.data; // ✅ Corrigido: backend retorna dados diretamente em response.data
          
          // ⚠️ Verificar se data.url existe antes de usar startsWith
          if (!data || !data.url) {
            throw new Error('Resposta inválida do servidor: URL da imagem não foi retornada');
          }
          
          const fullUrl = data.url.startsWith('http') || data.url.startsWith('data:') || data.url.startsWith('blob:')
            ? data.url 
            : `${API_BASE_URL}${data.url}`;
          
          uploadedImageUrls.push(fullUrl);
          console.log(`✅ Imagem salva: ${media.file.name} → ${fullUrl}`);
        } catch (error: any) {
          console.error('❌ Erro ao salvar imagem:', error);
          setErrors([`Erro ao salvar imagem "${media.file.name}": ${error.message}`]);
          setLoading(false);
          return;
        }
      }
      
      // Upload dos vídeos para o servidor
      const uploadedVideoUrls: string[] = [];
      for (const media of uploadedVideos) {
        try {
          // Validar tamanho (máximo 16MB para vídeos)
          const maxSize = 16 * 1024 * 1024; // 16MB
          if (media.file.size > maxSize) {
            throw new Error(`Vídeo muito grande (${(media.file.size / 1024 / 1024).toFixed(2)}MB). Máximo: 16MB`);
          }
          
          // Validar formato
          if (!media.file.type.includes('mp4') && !media.file.type.includes('3gpp')) {
            console.warn(`⚠️ Vídeo "${media.file.name}" pode não ser compatível. Formato recomendado: MP4. Formato atual: ${media.file.type}`);
          }
          
          console.log(`📤 Salvando vídeo: ${media.file.name} (${(media.file.size / 1024 / 1024).toFixed(2)}MB, ${media.file.type})`);
          
          const uploadResponse = await uploadAPI.uploadMedia(media.file);
          
          if (!uploadResponse.data) {
            throw new Error('Erro ao salvar o vídeo no servidor');
          }
          
          // ✅ Converter URL relativa para URL completa
          const data = uploadResponse.data; // ✅ Corrigido: backend retorna dados diretamente em response.data
          
          // ⚠️ Verificar se data.url existe antes de usar startsWith
          if (!data || !data.url) {
            throw new Error('Resposta inválida do servidor: URL do vídeo não foi retornada');
          }
          
          const fullUrl = data.url.startsWith('http') || data.url.startsWith('data:') || data.url.startsWith('blob:')
            ? data.url 
            : `${API_BASE_URL}${data.url}`;
          
          uploadedVideoUrls.push(fullUrl);
          console.log(`✅ Vídeo salvo: ${media.file.name} → ${fullUrl}`);
        } catch (error: any) {
          console.error('❌ Erro ao salvar vídeo:', error);
          setErrors([`Erro ao salvar vídeo "${media.file.name}": ${error.message}`]);
          setLoading(false);
          return;
        }
      }
      
      // Upload dos áudios para o servidor
      const uploadedAudioUrls: string[] = [];
      for (const media of uploadedAudios) {
        try {
          // Validar tamanho (máximo 16MB para áudios)
          const maxSize = 16 * 1024 * 1024; // 16MB
          if (media.file.size > maxSize) {
            throw new Error(`Áudio muito grande (${(media.file.size / 1024 / 1024).toFixed(2)}MB). Máximo: 16MB`);
          }
          
          console.log(`📤 Salvando áudio: ${media.file.name} (${(media.file.size / 1024 / 1024).toFixed(2)}MB)`);
          
          const uploadResponse = await uploadAPI.uploadMedia(media.file);
          
          if (!uploadResponse.data) {
            throw new Error('Erro ao salvar o áudio no servidor');
          }
          
          // ✅ Converter URL relativa para URL completa
          const data = uploadResponse.data; // ✅ Corrigido: backend retorna dados diretamente em response.data
          
          // ⚠️ Verificar se data.url existe antes de usar startsWith
          if (!data || !data.url) {
            throw new Error('Resposta inválida do servidor: URL do áudio não foi retornada');
          }
          
          const fullUrl = data.url.startsWith('http') || data.url.startsWith('data:') || data.url.startsWith('blob:')
            ? data.url 
            : `${API_BASE_URL}${data.url}`;
          
          uploadedAudioUrls.push(fullUrl);
          console.log(`✅ Áudio salvo: ${media.file.name} → ${fullUrl}`);
        } catch (error: any) {
          console.error('❌ Erro ao salvar áudio:', error);
          setErrors([`Erro ao salvar áudio "${media.file.name}": ${error.message}`]);
          setLoading(false);
          return;
        }
      }
      
      // Upload dos documentos para o servidor
      const uploadedDocumentUrls: string[] = [];
      for (const media of uploadedDocuments) {
        try {
          // Validar tamanho (máximo 100MB para documentos)
          const maxSize = 100 * 1024 * 1024; // 100MB
          if (media.file.size > maxSize) {
            throw new Error(`Documento muito grande (${(media.file.size / 1024 / 1024).toFixed(2)}MB). Máximo: 100MB`);
          }
          
          console.log(`📤 Salvando documento: ${media.file.name} (${(media.file.size / 1024 / 1024).toFixed(2)}MB)`);
          
          const uploadResponse = await uploadAPI.uploadMedia(media.file);
          
          if (!uploadResponse.data) {
            throw new Error('Erro ao salvar o documento no servidor');
          }
          
          // ✅ Converter URL relativa para URL completa
          const data = uploadResponse.data; // ✅ Corrigido: backend retorna dados diretamente em response.data
          
          // ⚠️ Verificar se data.url existe antes de usar startsWith
          if (!data || !data.url) {
            throw new Error('Resposta inválida do servidor: URL do documento não foi retornada');
          }
          
          const fullUrl = data.url.startsWith('http') || data.url.startsWith('data:') || data.url.startsWith('blob:')
            ? data.url 
            : `${API_BASE_URL}${data.url}`;
          
          uploadedDocumentUrls.push(fullUrl);
          console.log(`✅ Documento salvo: ${media.file.name} → ${fullUrl}`);
        } catch (error: any) {
          console.error('❌ Erro ao salvar documento:', error);
          setErrors([`Erro ao salvar documento "${media.file.name}": ${error.message}`]);
          setLoading(false);
          return;
        }
      }
      
      console.log('✅ Todos os arquivos foram salvos no servidor!');
      console.log(`   Imagens: ${uploadedImageUrls.length}`);
      console.log(`   Vídeos: ${uploadedVideoUrls.length}`);
      console.log(`   Áudios: ${uploadedAudioUrls.length}`);
      console.log(`   Documentos: ${uploadedDocumentUrls.length}`);
      
      // ========================================
      // PASSO 2: PREPARAR TEMPLATES COM AS URLs LOCAIS
      // ========================================
      console.log('🔗 Associando templates aos arquivos...');
      
      // CONTADORES PARA ROTAÇÃO DE ARQUIVOS (independente da rotação de templates)
      let imageCounter = 0;
      let videoCounter = 0;
      let audioCounter = 0;
      let documentCounter = 0;
      
      // 🔍 LOG: Mostrar exatamente quais templates foram selecionados
      console.log('🔍 ===== TEMPLATES SELECIONADOS =====');
      console.log('   selectedAccountIds:', selectedAccountIds);
      const templatesList: Record<number, string[]> = {};
      Object.keys(selectedTemplates).forEach(key => {
        const accountId = parseInt(key);
        templatesList[accountId] = Array.from(selectedTemplates[accountId] || []);
      });
      console.log('   selectedTemplates:', JSON.stringify(templatesList, null, 2));
      console.log('====================================');

      const templates: any[] = [];
      selectedAccountIds.forEach(accountId => {
        const accountTemplates = availableTemplates[accountId] || [];
        const selectedNames = selectedTemplates[accountId] || new Set();
        
        console.log(`\n📋 Processando Conta ID: ${accountId}`);
        console.log(`   Templates disponíveis:`, accountTemplates.map((t: any) => t.name));
        console.log(`   Templates selecionados:`, Array.from(selectedNames));
        
        Array.from(selectedNames).forEach(templateName => {
          const template = accountTemplates.find(t => t.name === templateName);
          console.log(`   🔍 Buscando template "${templateName}":`, template ? '✅ Encontrado' : '❌ NÃO ENCONTRADO');
          if (template) {
            // Determinar se tem mídia e qual tipo
            const headerComponent = template.components.find((c: any) =>
              c.type === 'HEADER' &&
              (c.format === 'IMAGE' || c.format === 'VIDEO' || c.format === 'DOCUMENT' || c.format === 'AUDIO')
            );
            
            let mediaUrl = null;
            let mediaType = null;
            
            if (headerComponent) {
              const format = headerComponent.format;
              // ROTAÇÃO DE ARQUIVOS: usa contador e incrementa para próximo
              if (format === 'IMAGE' && uploadedImageUrls.length > 0) {
                const mediaIndex = imageCounter % uploadedImageUrls.length;
                mediaUrl = uploadedImageUrls[mediaIndex]; // Usar URL local
                mediaType = 'image'; // Backend detectará e fará upload automático
                console.log(`   📎 Template "${templateName}" (${format}) → Imagem #${mediaIndex + 1}`);
                imageCounter++; // Incrementa para próxima imagem
              } else if (format === 'VIDEO' && uploadedVideoUrls.length > 0) {
                const mediaIndex = videoCounter % uploadedVideoUrls.length;
                mediaUrl = uploadedVideoUrls[mediaIndex]; // Usar URL local
                mediaType = 'video'; // Backend detectará e fará upload automático
                console.log(`   📎 Template "${templateName}" (${format}) → Vídeo #${mediaIndex + 1}`);
                videoCounter++; // Incrementa para próximo vídeo
              } else if (format === 'AUDIO' && uploadedAudioUrls.length > 0) {
                const mediaIndex = audioCounter % uploadedAudioUrls.length;
                mediaUrl = uploadedAudioUrls[mediaIndex]; // Usar URL local
                mediaType = 'audio'; // Backend detectará e fará upload automático
                console.log(`   📎 Template "${templateName}" (${format}) → Áudio #${mediaIndex + 1}`);
                audioCounter++; // Incrementa para próximo áudio
              } else if (format === 'DOCUMENT' && uploadedDocumentUrls.length > 0) {
                const mediaIndex = documentCounter % uploadedDocumentUrls.length;
                mediaUrl = uploadedDocumentUrls[mediaIndex]; // Usar URL local
                mediaType = 'document'; // Backend detectará e fará upload automático
                console.log(`   📎 Template "${templateName}" (${format}) → Documento #${mediaIndex + 1}`);
                documentCounter++; // Incrementa para próximo documento
              }
            } else {
              console.log(`   📝 Template "${templateName}" (SEM ARQUIVO)`);
            }
            
            const templateObj = {
              whatsapp_account_id: accountId,
              template_name: templateName,
              template_id: null, // Será buscado pelo nome no backend
              media_url: mediaUrl,
              media_type: mediaType,
            };
            console.log(`   ✅ Adicionando:`, templateObj);
            templates.push(templateObj);
          }
        });
      });
      
      console.log('\n📤 ===== TEMPLATES FINAIS PARA ENVIAR =====');
      templates.forEach((t, i) => {
        console.log(`   ${i + 1}. Conta ${t.whatsapp_account_id} → Template "${t.template_name}" ${t.media_url ? `(com ${t.media_type})` : '(sem mídia)'}`);
      });
      console.log('==========================================\n');
      
      // Preparar contatos (usar contactsToUse que pode ser filtrado)
      const formattedContacts = contactsToUse.map(contact => ({
        phone_number: contact.phone,
        cpf: contact.cpf || null,
        variables: contact.variables,
      }));
      
      // Preparar scheduled_at (se houver)
      let scheduledAt = null;
      if (scheduleDate && scheduleTime) {
        scheduledAt = `${scheduleDate}T${scheduleTime}:00`;
      }
      
      // Preparar configurações
      let minSec = parseInt(intervalSecondsMin, 10);
      let maxSec = parseInt(intervalSecondsMax, 10);
      if (!Number.isFinite(minSec) || minSec < 0) minSec = 0;
      if (!Number.isFinite(maxSec) || maxSec < 0) maxSec = minSec;
      if (minSec > maxSec) {
        const tmp = minSec;
        minSec = maxSec;
        maxSec = tmp;
      }

      const scheduleConfig = {
        work_start_time: workStartTime,
        work_end_time: workEndTime,
        interval_seconds_min: minSec,
        interval_seconds_max: maxSec,
      };
      
      const pauseConfig = {
        pause_after: parseInt(pauseAfter),
        pause_duration_minutes: parseInt(pauseDuration),
      };
      
      // Enviar para o backend
      const response = await campaignsAPI.create({
        name: campaignName,
        templates,
        contacts: formattedContacts,
        scheduled_at: scheduledAt,
        schedule_config: scheduleConfig,
        pause_config: pauseConfig,
        ignore_restrictions: ignoreRestrictions,
      });
      
      if (response.data.success) {
        const totalMessages = templates.length * formattedContacts.length;
        toast.success(
          `🎉 Campanha "${campaignName}" criada! ` +
          `${formattedContacts.length} contatos × ${templates.length} templates = ${totalMessages} mensagens`
        );
        
        // Redirecionar após 2 segundos
        setTimeout(() => {
          router.push('/campanhas');
        }, 2000);
      }
    } catch (error: any) {
      console.error('Erro ao criar campanha:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Erro ao criar campanha';
      setErrors([errorMessage]);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    console.log('═══════════════════════════════════════════════════════');
    console.log('🚀 HANDLESUBMIT CHAMADO!');
    console.log('═══════════════════════════════════════════════════════');
    console.log('📊 Estado atual:');
    console.log('   - Contatos:', contacts.length);
    console.log('   - selectedAccountIds:', selectedAccountIds);
    console.log('   - selectedAccountIds.length:', selectedAccountIds.length);
    console.log('   - selectedTemplates:', selectedTemplates);
    console.log('═══════════════════════════════════════════════════════');

    const validationErrors = validateCampaign();
    
    console.log('📋 Validação:', validationErrors.length === 0 ? '✅ OK' : `❌ ${validationErrors.length} erros`);
    
    if (validationErrors.length > 0) {
      console.log('❌ ERROS DE VALIDAÇÃO:', validationErrors);
      setErrors(validationErrors);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    
    console.log('🔍 CHAMANDO checkRestrictions()...');
    
    // Verificar restrições primeiro
    await checkRestrictions();
    
    console.log('✅ checkRestrictions() CONCLUÍDO');
    console.log('═══════════════════════════════════════════════════════');
  };

  const getCategoryInfo = (category: string) => {
    const categories: Record<string, { label: string; color: string; emoji: string }> = {
      UTILITY: { label: 'UTILITÁRIO', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30', emoji: '🔧' },
      MARKETING: { label: 'MARKETING', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30', emoji: '📢' },
      AUTHENTICATION: { label: 'AUTENTICAÇÃO', color: 'bg-green-500/20 text-green-300 border-green-500/30', emoji: '🔐' },
    };
    return categories[category] || { label: category, color: 'bg-gray-500/20 text-gray-300 border-gray-500/30', emoji: '📝' };
  };

  const requirements = getMediaRequirements();
  const maxVars = getMaxVariables();
  const totalSelected = getTotalSelectedTemplates();

  return (
    <>
      <Head>
        <title>Criar Campanha | Disparador NettSistemas</title>
      </Head>
      
      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 py-8 px-4">
        <div className="max-w-7xl mx-auto space-y-8">
        
        {/* 🎨 CABEÇALHO PRINCIPAL - MUITO MAIS VISUAL */}
        <div className="relative overflow-hidden bg-gradient-to-r from-primary-600/30 via-primary-500/20 to-primary-600/30 backdrop-blur-xl border-2 border-primary-500/40 rounded-3xl p-10 shadow-2xl shadow-primary-500/20">
          <div className="absolute inset-0 bg-grid-white/[0.02]"></div>
          <div className="relative">
            <div className="flex items-center gap-6 mb-4">
              <div className="bg-gradient-to-br from-primary-500 to-primary-600 p-6 rounded-2xl shadow-lg shadow-primary-500/50">
                <FaRocket className="text-5xl text-white" />
              </div>
              <div>
                <h1 className="text-5xl font-black text-white mb-2 tracking-tight">
                  Criar Nova Campanha
                </h1>
                <p className="text-xl text-white/80 font-medium">
                  Configure sua campanha de envio em massa com templates e agendamento inteligente
                </p>
              </div>
            </div>
            
            {/* Estatísticas rápidas no cabeçalho */}
            {(totalSelected > 0 || contacts.length > 0) && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
                  <div className="flex items-center gap-3">
                    <FaPhone className="text-3xl text-primary-300" />
                    <div>
                      <div className="text-2xl font-bold text-white">{selectedAccountIds.length}</div>
                      <div className="text-sm text-white/70">Contas</div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
                  <div className="flex items-center gap-3">
                    <FaFileAlt className="text-3xl text-purple-300" />
                    <div>
                      <div className="text-2xl font-bold text-white">{totalSelected}</div>
                      <div className="text-sm text-white/70">Templates</div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
                  <div className="flex items-center gap-3">
                    <FaChartLine className="text-3xl text-green-300" />
                    <div>
                      <div className="text-2xl font-bold text-white">{contacts.length}</div>
                      <div className="text-sm text-white/70">Contatos</div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
                  <div className="flex items-center gap-3">
                    <FaBolt className="text-3xl text-yellow-300" />
                    <div>
                      <div className="text-2xl font-bold text-white">{contacts.length}</div>
                      <div className="text-sm text-white/70">Mensagens</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ERROS - MAIS VISUAL */}
        {errors.length > 0 && (
          <div className="bg-gradient-to-r from-red-500/20 to-red-600/20 backdrop-blur-xl border-2 border-red-500/50 rounded-2xl p-6 shadow-xl shadow-red-500/20">
            <div className="flex items-start gap-4">
              <div className="bg-red-500/20 p-4 rounded-xl">
                <FaExclamationTriangle className="text-3xl text-red-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-red-300 mb-3">Atenção! Corrija os erros:</h3>
                <ul className="space-y-2">
                  {errors.map((error, index) => (
                    <li key={index} className="flex items-start gap-2 text-base text-red-200">
                      <span className="text-red-400 mt-1">●</span>
                      <span>{error}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* 🔹 SEÇÃO 1: CONFIGURAÇÕES BÁSICAS */}
        <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-primary-500/30 rounded-2xl p-8 shadow-xl hover:border-primary-500/50 transition-all duration-300">
          <div className="flex items-center gap-4 mb-6">
            <div className="bg-gradient-to-br from-primary-500 to-primary-600 text-white text-2xl font-black w-14 h-14 rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/50">
              1
            </div>
            <h2 className="text-3xl font-black text-white">
              Configurações Básicas
            </h2>
          </div>
          
          <div>
            <label className="block text-lg font-bold mb-3 text-white/90">
              Nome da Campanha *
            </label>
            <input
              type="text"
              className="w-full px-6 py-4 text-lg bg-dark-700/80 backdrop-blur-md border-2 border-white/20 rounded-xl text-white placeholder-white/40 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/30 transition-all duration-200"
              placeholder="Ex: Promoção Black Friday 2024"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
            />
            <p className="text-sm text-white/60 mt-3 flex items-center gap-2">
              <span>💡</span>
              <span>Dê um nome descritivo para identificar facilmente esta campanha</span>
            </p>
          </div>
        </div>

        {/* 🔹 SEÇÃO 2: NÚMEROS DE ORIGEM */}
        <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-primary-500/30 rounded-2xl p-8 shadow-xl hover:border-primary-500/50 transition-all duration-300">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-br from-primary-500 to-primary-600 text-white text-2xl font-black w-14 h-14 rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/50">
                2
              </div>
              <div>
                <h2 className="text-3xl font-black text-white">
                  Números de Origem
                </h2>
                <p className="text-base text-white/70 mt-1">
                  Selecione as contas WhatsApp que serão usadas na rotação de envio
                </p>
              </div>
            </div>
            
            {/* Botão Selecionar Todos */}
            <button
              type="button"
              onClick={() => {
                if (selectedAccountIds.length === accounts.length) {
                  // Desselecionar todos
                  setSelectedAccountIds([]);
                } else {
                  // Selecionar todos
                  const allAccountIds = accounts.map(acc => acc.id);
                  setSelectedAccountIds(allAccountIds);
                  
                  // Inicializar selectedTemplates para todas as contas
                  const newSelectedTemplates = { ...selectedTemplates };
                  allAccountIds.forEach(accountId => {
                    if (!newSelectedTemplates[accountId]) {
                      newSelectedTemplates[accountId] = new Set<string>();
                    }
                  });
                  setSelectedTemplates(newSelectedTemplates);
                  
                  // Carregar templates de todas as contas
                  loadTemplatesForAccounts(allAccountIds);
                }
              }}
              className="px-6 py-3 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white font-bold rounded-xl shadow-lg hover:shadow-primary-500/50 transition-all duration-200 flex items-center gap-2"
            >
              {selectedAccountIds.length === accounts.length ? (
                <>
                  <FaTimesCircle className="text-xl" />
                  Desmarcar Todos
                </>
              ) : (
                <>
                  <FaCheckCircle className="text-xl" />
                  Selecionar Todos
                </>
              )}
            </button>
          </div>
          
          <div className="grid gap-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            {accounts.map(account => (
              <label
                key={account.id}
                className={`group flex items-center gap-4 p-5 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                  selectedAccountIds.includes(account.id)
                    ? 'border-primary-500 bg-gradient-to-r from-primary-500/20 to-primary-600/20 shadow-lg shadow-primary-500/20'
                    : 'border-white/10 bg-dark-700/50 hover:border-primary-500/50 hover:bg-dark-700/80'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedAccountIds.includes(account.id)}
                  onChange={() => handleAccountToggle(account.id)}
                  className="w-6 h-6 rounded-lg border-2 border-white/30 bg-dark-900 checked:bg-primary-500 checked:border-primary-500 cursor-pointer focus:ring-4 focus:ring-primary-500/30"
                />
                <div className="flex-1">
                  <p className="text-xl font-bold text-white">{account.name}</p>
                  <p className="text-base text-white/60 mt-1">{account.phone_number}</p>
                </div>
                {selectedAccountIds.includes(account.id) && (
                  <div className="bg-primary-500/20 p-3 rounded-lg">
                    <FaCheckCircle className="text-2xl text-primary-400" />
                  </div>
                )}
              </label>
            ))}
          </div>
            
          {selectedAccountIds.length === 0 && (
            <div className="mt-4 p-4 bg-yellow-500/10 border-2 border-yellow-500/30 rounded-xl">
              <p className="text-base text-yellow-300 font-medium flex items-center gap-2">
                <FaExclamationTriangle />
                Selecione pelo menos uma conta WhatsApp para continuar
              </p>
            </div>
          )}
          
          {selectedAccountIds.length > 0 && (
            <div className="mt-4 p-4 bg-primary-500/10 border-2 border-primary-500/30 rounded-xl">
              <p className="text-base text-primary-300 font-medium flex items-center gap-2">
                <FaCheckCircle />
                <strong>{selectedAccountIds.length}</strong> conta(s) selecionada(s) - Sistema rotacionará automaticamente entre elas
              </p>
            </div>
          )}
        </div>

        {/* 🔹 SEÇÃO 3: TEMPLATES */}
        {selectedAccountIds.length > 0 && (
          <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-primary-500/30 rounded-2xl p-8 shadow-xl hover:border-primary-500/50 transition-all duration-300">
            <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="bg-gradient-to-br from-primary-500 to-primary-600 text-white text-2xl font-black w-14 h-14 rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/50">
                  3
                </div>
                <div>
                  <h2 className="text-3xl font-black text-white">
                    Selecionar Templates
                  </h2>
                  <p className="text-base text-white/70 mt-1">
                    Escolha os templates por conta - Sistema rotacionará automaticamente
                  </p>
                </div>
              </div>
              
              {/* Botões Globais */}
              <div className="flex flex-col items-end gap-2">
                {loadingAccountIds.size > 0 && (
                  <div className="flex items-center gap-2 text-sm text-yellow-400 font-semibold bg-yellow-400/10 border border-yellow-400/30 rounded-lg px-3 py-1.5">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-400"></div>
                    Aguarde... carregando templates de {loadingAccountIds.size} conta(s)
                  </div>
                )}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={selectAllVisible}
                    disabled={loadingAccountIds.size > 0}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white font-bold rounded-xl transition-all duration-200 shadow-lg shadow-primary-500/30 hover:shadow-primary-500/50 transform hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none disabled:hover:from-primary-500 disabled:hover:to-primary-600"
                  >
                    <FaCheckDouble className="text-lg" />
                    Selecionar Todos
                  </button>
                  
                  <button
                    type="button"
                    onClick={deselectAll}
                    className="flex items-center gap-2 px-6 py-3 bg-dark-700 hover:bg-dark-600 text-white font-bold rounded-xl transition-all duration-200 border-2 border-white/10 hover:border-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={totalSelected === 0 || loadingAccountIds.size > 0}
                  >
                    <FaTimesCircle className="text-lg" />
                    Desmarcar Todos
                  </button>
                </div>
              </div>
            </div>
            
            {/* Filtros Globais */}
            <div className="p-6 bg-dark-700/50 backdrop-blur-md rounded-xl border border-white/10 space-y-4 mb-6">
              {/* Linha 1: Buscar e Excluir */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-base font-bold mb-2 text-white/90 flex items-center gap-2">
                    <FaSearch />
                    Buscar template
                  </label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 bg-dark-800/80 border-2 border-white/20 rounded-xl text-white placeholder-white/40 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30 transition-all"
                    placeholder="Digite para buscar..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                
                <div>
                  <label className="block text-base font-bold mb-2 text-white/90 flex items-center gap-2">
                    <FaTimes />
                    Excluir que contenham
                  </label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 bg-dark-800/80 border-2 border-white/20 rounded-xl text-white placeholder-white/40 focus:border-red-500 focus:ring-2 focus:ring-red-500/30 transition-all"
                    placeholder="Digite para excluir..."
                    value={excludeQuery}
                    onChange={(e) => setExcludeQuery(e.target.value)}
                  />
                </div>
              </div>

              {/* Linha 2: Filtros de Mídia e Categoria */}
              <div className="grid md:grid-cols-2 gap-4">
                {/* Filtro de Mídia */}
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filterOnlyWithMedia}
                        onChange={(e) => {
                          setFilterOnlyWithMedia(e.target.checked);
                          if (!e.target.checked) {
                            setFilterMediaType('all');
                          }
                        }}
                        className="w-5 h-5 rounded-lg border-2 border-primary-500 bg-dark-800 checked:bg-primary-500 checked:border-primary-500 focus:ring-2 focus:ring-primary-500 cursor-pointer"
                      />
                      <span className="text-base font-bold text-white/90">📎 Apenas com Mídia</span>
                    </label>
                  </div>
                  
                  {filterOnlyWithMedia && (
                    <select
                      value={filterMediaType}
                      onChange={(e) => setFilterMediaType(e.target.value as any)}
                      className="w-full px-4 py-3 bg-dark-800/80 border-2 border-white/20 rounded-xl text-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30 transition-all"
                    >
                      <option value="all">Todos os tipos</option>
                      <option value="image">🖼️ Imagem</option>
                      <option value="video">🎥 Vídeo</option>
                      <option value="document">📄 Documento</option>
                      <option value="audio">🎵 Áudio</option>
                    </select>
                  )}
                </div>

                {/* Filtro de Categoria */}
                <div>
                  <label className="block text-base font-bold mb-2 text-white/90">
                    📂 Categoria
                  </label>
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value as any)}
                    className="w-full px-4 py-3 bg-dark-800/80 border-2 border-white/20 rounded-xl text-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30 transition-all"
                  >
                    <option value="all">Todas</option>
                    <option value="MARKETING">MARKETING</option>
                    <option value="UTILITY">UTILITY (Utilitário)</option>
                    <option value="AUTHENTICATION">AUTHENTICATION</option>
                  </select>
                </div>
              </div>
            </div>
            
            <div className="space-y-6 max-h-[700px] overflow-y-auto pr-2 custom-scrollbar">
                {selectedAccountIds.map(accountId => {
                  const account = accounts.find(a => a.id === accountId);
                  const isAccountLoading = loadingAccountIds.has(accountId);
                  const filteredTemplates = getFilteredTemplatesForAccount(accountId);
                  const selectedCount = selectedTemplates[accountId]?.size || 0;
                  
                  if (!account) return null;
                  
                  return (
                    <div key={accountId} className={`border-2 rounded-2xl p-6 backdrop-blur-md transition-all duration-300 ${isAccountLoading ? 'border-yellow-500/40 bg-gradient-to-br from-yellow-500/5 to-yellow-600/5' : 'border-primary-500/40 bg-gradient-to-br from-primary-500/10 to-primary-600/5'}`}>
                      {/* Header da Conta */}
                      <div className="mb-6 pb-4 border-b-2 border-white/10">
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <div className="flex items-center gap-3">
                            <div className={`p-3 rounded-xl ${isAccountLoading ? 'bg-yellow-500/20' : 'bg-primary-500/20'}`}>
                              <FaPhone className={`text-2xl ${isAccountLoading ? 'text-yellow-400' : 'text-primary-400'}`} />
                            </div>
                            <div>
                              <h3 className="text-2xl font-black text-white">
                                {account.name}
                              </h3>
                              <p className="text-base text-white/60">{account.phone_number}</p>
                            </div>
                          </div>
                          {isAccountLoading && (
                            <div className="flex items-center gap-2 text-yellow-400 text-sm font-bold bg-yellow-400/10 border border-yellow-400/30 rounded-lg px-3 py-1.5">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-400"></div>
                              Carregando templates...
                            </div>
                          )}
                        </div>
                        {!isAccountLoading && (
                          <p className="text-base text-primary-300 font-bold mt-3 flex items-center gap-2">
                            <FaCheckCircle />
                            {selectedCount} de {filteredTemplates.length} template(s) selecionado(s)
                          </p>
                        )}
                      </div>
                      
                      {/* Lista de Templates */}
                      {isAccountLoading ? (
                        <div className="text-center py-10 text-white/50">
                          <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-yellow-400 mb-3"></div>
                          <p className="text-base">Buscando templates desta conta...</p>
                        </div>
                      ) : filteredTemplates.length === 0 ? (
                        <div className="text-center py-12 text-white/50">
                          <FaExclamationTriangle className="text-4xl mx-auto mb-3" />
                          <p className="text-lg">Nenhum template disponível para esta conta</p>
                        </div>
                      ) : (
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {filteredTemplates.map((template, index) => {
                            const isSelected = selectedTemplates[accountId]?.has(template.name) || false;
                            const categoryInfo = getCategoryInfo(template.category);
                            const mediaType = getMediaHeaderType(template);
                            const varCount = getVariableCount(template);
                            
                            return (
                              <div
                                key={index}
                                className={`group p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 relative ${
                                  isSelected
                                    ? 'border-primary-500 bg-gradient-to-br from-primary-500/30 to-primary-600/20 shadow-lg shadow-primary-500/30 scale-105'
                                    : 'border-white/10 bg-dark-700/50 hover:border-primary-500/50 hover:bg-dark-700/80 hover:scale-102'
                                }`}
                              >
                                <div onClick={() => handleTemplateToggle(accountId, template.name)}>
                                  <div className="flex items-start gap-3 mb-3">
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => {}}
                                      className="mt-1 w-5 h-5 rounded border-2 border-white/30 bg-dark-900 checked:bg-primary-500 checked:border-primary-500"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <h4 className="font-bold text-base text-white truncate">{template.name}</h4>
                                    </div>
                                    <button
                                      onClick={(e) => handlePreviewTemplate(template, e)}
                                      className="p-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border-2 border-purple-500/40 rounded-lg transition-all duration-200"
                                      title="Visualizar template"
                                    >
                                      <FaMobileAlt className="text-sm" />
                                    </button>
                                  </div>
                                </div>
                                
                                <div className="flex gap-2 flex-wrap" onClick={() => handleTemplateToggle(accountId, template.name)}>
                                  <span className={`px-3 py-1 rounded-lg text-xs font-bold border ${categoryInfo.color}`}>
                                    {categoryInfo.emoji} {categoryInfo.label}
                                  </span>
                                  
                                  {varCount > 0 && (
                                    <span className="px-3 py-1 rounded-lg text-xs font-bold border bg-indigo-500/20 text-indigo-300 border-indigo-500/30">
                                      🔤 {varCount} VAR
                                    </span>
                                  )}
                                  
                                  {mediaType && (
                                    <span className="px-3 py-1 rounded-lg text-xs font-bold border bg-cyan-500/20 text-cyan-300 border-cyan-500/30">
                                      {mediaType === 'IMAGE' && '🖼️ IMG'}
                                      {mediaType === 'VIDEO' && '🎥 VID'}
                                      {mediaType === 'AUDIO' && '🎵 AUD'}
                                      {mediaType === 'DOCUMENT' && '📄 DOC'}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
            
            {/* Resumo Global */}
            {totalSelected > 0 && (
              <div className="mt-6 p-6 bg-gradient-to-r from-green-500/20 to-green-600/10 border-2 border-green-500/40 rounded-xl shadow-lg shadow-green-500/20">
                <p className="font-black text-green-300 text-2xl mb-3 flex items-center gap-2">
                  <FaCheckCircle />
                  Total: {totalSelected} template(s) selecionado(s)
                </p>
                <div className="grid md:grid-cols-2 gap-4 text-base text-white/80">
                  <div>
                    {requirements.images > 0 && <p>• <strong>{requirements.images}</strong> com IMAGEM 🖼️</p>}
                    {requirements.videos > 0 && <p>• <strong>{requirements.videos}</strong> com VÍDEO 🎥</p>}
                  </div>
                  <div>
                    {requirements.audios > 0 && <p>• <strong>{requirements.audios}</strong> com ÁUDIO 🎵</p>}
                    {requirements.documents > 0 && <p>• <strong>{requirements.documents}</strong> com DOCUMENTO 📄</p>}
                    {maxVars > 0 && <p>• Máximo de <strong>{maxVars}</strong> variável(is) 🔤</p>}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 🔹 SEÇÃO 4: UPLOAD DE MÍDIAS */}
        {totalSelected > 0 && (requirements.images > 0 || requirements.videos > 0 || requirements.audios > 0 || requirements.documents > 0) && (
          <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-primary-500/30 rounded-2xl p-8 shadow-xl hover:border-primary-500/50 transition-all duration-300">
            <div className="flex items-center gap-4 mb-6">
              <div className="bg-gradient-to-br from-primary-500 to-primary-600 text-white text-2xl font-black w-14 h-14 rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/50">
                4
              </div>
              <div>
                <h2 className="text-3xl font-black text-white">
                  Upload de Mídias
                </h2>
                <p className="text-base text-white/70 mt-1">
                  Faça upload dos arquivos necessários - Sistema rotacionará automaticamente
                </p>
              </div>
            </div>
            
            {/* IMAGENS */}
            {requirements.images > 0 && (
              <div className="mb-8">
                <h3 className="text-2xl font-bold mb-4 text-cyan-300 flex items-center gap-2">
                  <FaImage />
                  IMAGENS ({requirements.images} template(s) precisam)
                </h3>
                
                <div className="border-2 border-dashed border-cyan-500/40 rounded-2xl p-8 bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 backdrop-blur-md hover:border-cyan-500/60 transition-all">
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    id="image-upload"
                  />
                  <label
                    htmlFor="image-upload"
                    className="cursor-pointer flex flex-col items-center justify-center py-8"
                  >
                    <div className="bg-cyan-500/20 p-6 rounded-2xl mb-4">
                      <FaUpload className="text-5xl text-cyan-400" />
                    </div>
                    <p className="text-2xl font-bold text-cyan-300 mb-2">
                      Clique para selecionar imagens
                    </p>
                    <p className="text-base text-white/60">
                      ou arraste múltiplas imagens aqui (máximo 5MB cada)
                    </p>
                  </label>
                </div>
                
                {uploadedImages.length > 0 && (
                  <div className="mt-4">
                    <p className="text-base font-bold mb-3 text-white">
                      Arquivos carregados ({uploadedImages.length}):
                    </p>
                    <div className="grid grid-cols-3 md:grid-cols-5 gap-4">
                      {uploadedImages.map((media, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={media.preview}
                            alt={`Image ${index + 1}`}
                            className="w-full h-32 object-cover rounded-xl border-2 border-white/10"
                          />
                          <button
                            type="button"
                            onClick={() => removeMedia('image', index)}
                            className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-lg"
                          >
                            <FaTrash />
                          </button>
                          <p className="text-xs text-white/60 mt-2 truncate">
                            {media.file.name}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {uploadedImages.length === 0 && (
                  <div className="mt-4 p-4 bg-yellow-500/10 border-2 border-yellow-500/30 rounded-xl">
                    <p className="text-base text-yellow-300 font-medium flex items-center gap-2">
                      <FaExclamationTriangle />
                      Faça upload de pelo menos 1 imagem
                    </p>
                  </div>
                )}
              </div>
            )}
            
            {/* VÍDEOS */}
            {requirements.videos > 0 && (
              <div className="mb-8">
                <h3 className="text-2xl font-bold mb-4 text-pink-300 flex items-center gap-2">
                  <FaVideo />
                  VÍDEOS ({requirements.videos} template(s) precisam)
                </h3>
                
                <div className="border-2 border-dashed border-pink-500/40 rounded-2xl p-8 bg-gradient-to-br from-pink-500/10 to-pink-600/5 backdrop-blur-md hover:border-pink-500/60 transition-all">
                  <input
                    type="file"
                    multiple
                    accept="video/*"
                    onChange={handleVideoUpload}
                    className="hidden"
                    id="video-upload"
                  />
                  <label
                    htmlFor="video-upload"
                    className="cursor-pointer flex flex-col items-center justify-center py-8"
                  >
                    <div className="bg-pink-500/20 p-6 rounded-2xl mb-4">
                      <FaUpload className="text-5xl text-pink-400" />
                    </div>
                    <p className="text-2xl font-bold text-pink-300 mb-2">
                      Clique para selecionar vídeos
                    </p>
                    <p className="text-base text-white/60">
                      ou arraste múltiplos vídeos aqui (máximo 16MB cada)
                    </p>
                  </label>
                </div>
                
                {uploadedVideos.length > 0 && (
                  <div className="mt-4">
                    <p className="text-base font-bold mb-3 text-white">
                      Arquivos carregados ({uploadedVideos.length}):
                    </p>
                    <div className="grid md:grid-cols-3 gap-4">
                      {uploadedVideos.map((media, index) => (
                        <div key={index} className="p-4 bg-dark-700/60 rounded-xl border-2 border-white/10 flex items-center gap-3">
                          <div className="bg-pink-500/20 p-4 rounded-lg">
                            <FaVideo className="text-2xl text-pink-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold truncate text-white">{media.file.name}</p>
                            <p className="text-xs text-white/50 mt-1">
                              {(media.file.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeMedia('video', index)}
                            className="text-red-400 hover:text-red-300 p-2 rounded-lg hover:bg-red-500/10 transition-all"
                          >
                            <FaTrash />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {uploadedVideos.length === 0 && (
                  <div className="mt-4 p-4 bg-yellow-500/10 border-2 border-yellow-500/30 rounded-xl">
                    <p className="text-base text-yellow-300 font-medium flex items-center gap-2">
                      <FaExclamationTriangle />
                      Faça upload de pelo menos 1 vídeo
                    </p>
                  </div>
                )}
              </div>
            )}
            
            {/* ÁUDIOS */}
            {requirements.audios > 0 && (
              <div className="mb-8">
                <h3 className="text-2xl font-bold mb-4 text-orange-300 flex items-center gap-2">
                  <FaMusic />
                  ÁUDIOS ({requirements.audios} template(s) precisam)
                </h3>
                
                <div className="border-2 border-dashed border-orange-500/40 rounded-2xl p-8 bg-gradient-to-br from-orange-500/10 to-orange-600/5 backdrop-blur-md hover:border-orange-500/60 transition-all">
                  <input
                    type="file"
                    multiple
                    accept="audio/*"
                    onChange={handleAudioUpload}
                    className="hidden"
                    id="audio-upload"
                  />
                  <label
                    htmlFor="audio-upload"
                    className="cursor-pointer flex flex-col items-center justify-center py-8"
                  >
                    <div className="bg-orange-500/20 p-6 rounded-2xl mb-4">
                      <FaUpload className="text-5xl text-orange-400" />
                    </div>
                    <p className="text-2xl font-bold text-orange-300 mb-2">
                      Clique para selecionar áudios
                    </p>
                    <p className="text-base text-white/60">
                      ou arraste múltiplos áudios aqui (máximo 16MB cada)
                    </p>
                  </label>
                </div>
                
                {uploadedAudios.length > 0 && (
                  <div className="mt-4">
                    <p className="text-base font-bold mb-3 text-white">
                      Arquivos carregados ({uploadedAudios.length}):
                    </p>
                    <div className="space-y-3">
                      {uploadedAudios.map((media, index) => (
                        <div key={index} className="p-4 bg-dark-700/60 rounded-xl border-2 border-white/10 flex items-center gap-3">
                          <div className="bg-orange-500/20 p-4 rounded-lg">
                            <FaMusic className="text-2xl text-orange-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold truncate text-white">{media.file.name}</p>
                            <p className="text-xs text-white/50 mt-1">
                              {(media.file.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeMedia('audio', index)}
                            className="text-red-400 hover:text-red-300 p-2 rounded-lg hover:bg-red-500/10 transition-all"
                          >
                            <FaTrash />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {uploadedAudios.length === 0 && (
                  <div className="mt-4 p-4 bg-yellow-500/10 border-2 border-yellow-500/30 rounded-xl">
                    <p className="text-base text-yellow-300 font-medium flex items-center gap-2">
                      <FaExclamationTriangle />
                      Faça upload de pelo menos 1 áudio
                    </p>
                  </div>
                )}
              </div>
            )}
            
            {/* DOCUMENTOS */}
            {requirements.documents > 0 && (
              <div className="mb-8">
                <h3 className="text-2xl font-bold mb-4 text-yellow-300 flex items-center gap-2">
                  <FaFileAlt />
                  DOCUMENTOS ({requirements.documents} template(s) precisam)
                </h3>
                
                <div className="border-2 border-dashed border-yellow-500/40 rounded-2xl p-8 bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 backdrop-blur-md hover:border-yellow-500/60 transition-all">
                  <input
                    type="file"
                    multiple
                    accept=".pdf,application/pdf,.doc,.docx,.xls,.xlsx"
                    onChange={handleDocumentUpload}
                    className="hidden"
                    id="document-upload"
                  />
                  <label
                    htmlFor="document-upload"
                    className="cursor-pointer flex flex-col items-center justify-center py-8"
                  >
                    <div className="bg-yellow-500/20 p-6 rounded-2xl mb-4">
                      <FaUpload className="text-5xl text-yellow-400" />
                    </div>
                    <p className="text-2xl font-bold text-yellow-300 mb-2">
                      Clique para selecionar documentos
                    </p>
                    <p className="text-base text-white/60">
                      ou arraste múltiplos documentos aqui (PDF, DOC, XLS - máximo 100MB cada)
                    </p>
                  </label>
                </div>
                
                {uploadedDocuments.length > 0 && (
                  <div className="mt-4">
                    <p className="text-base font-bold mb-3 text-white">
                      Arquivos carregados ({uploadedDocuments.length}):
                    </p>
                    <div className="space-y-3">
                      {uploadedDocuments.map((media, index) => (
                        <div key={index} className="p-4 bg-dark-700/60 rounded-xl border-2 border-white/10 flex items-center gap-3">
                          <div className="bg-yellow-500/20 p-4 rounded-lg">
                            <FaFileAlt className="text-2xl text-yellow-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold truncate text-white">{media.file.name}</p>
                            <p className="text-xs text-white/50 mt-1">
                              {(media.file.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeMedia('document', index)}
                            className="text-red-400 hover:text-red-300 p-2 rounded-lg hover:bg-red-500/10 transition-all"
                          >
                            <FaTrash />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {uploadedDocuments.length === 0 && (
                  <div className="mt-4 p-4 bg-yellow-500/10 border-2 border-yellow-500/30 rounded-xl">
                    <p className="text-base text-yellow-300 font-medium flex items-center gap-2">
                      <FaExclamationTriangle />
                      Faça upload de pelo menos 1 documento
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 🔹 SEÇÃO 5: LISTA DE CONTATOS */}
        {totalSelected > 0 && (
          <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-primary-500/30 rounded-2xl p-8 shadow-xl hover:border-primary-500/50 transition-all duration-300">
            <div className="flex items-center gap-4 mb-6">
              <div className="bg-gradient-to-br from-primary-500 to-primary-600 text-white text-2xl font-black w-14 h-14 rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/50">
                5
              </div>
              <div>
                <h2 className="text-3xl font-black text-white">
                  Lista de Contatos
                </h2>
                <p className="text-base text-white/70 mt-1">
                  Importe contatos via arquivo CSV/Excel ou cole diretamente
                </p>
              </div>
            </div>
            
            {maxVars > 0 && (
              <div className="p-6 bg-blue-500/10 border-2 border-blue-500/30 rounded-xl mb-6">
                <p className="text-lg text-blue-300 font-bold mb-3">
                  📋 Formato necessário para {maxVars} variável(is):
                </p>
                <code className="block text-base text-white/90 font-mono bg-dark-700/60 p-4 rounded-lg">
                  NUMERO,CPF{maxVars >= 1 && ',VARIAVEL_1'}{maxVars >= 2 && ',VARIAVEL_2'}{maxVars >= 3 && ',VARIAVEL_3'}
                </code>
                <p className="text-sm text-white/60 mt-3">
                  Exemplo: <code className="bg-dark-700/60 px-2 py-1 rounded">5511999887766,12345678901,João,São Paulo,1500</code>
                </p>
                <p className="text-sm text-white/50 mt-2">
                  CPF é opcional e aparece no log/relatório. Não entra como variável do template.
                </p>
              </div>
            )}

            {/* Botão Baixar Modelo */}
            <div className="mb-6 flex justify-center">
              <button
                type="button"
                onClick={async () => {
                  try {
                    const response = await campaignsAPI.getAll(); // Usando a API para verificar conexão
                    const downloadResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/campaigns/template/contacts`, {
                      headers: {
                        'Authorization': `Bearer ${localStorage.getItem('@WhatsAppDispatcher:token')}`,
                      },
                    });
                    
                    if (!downloadResponse.ok) {
                      throw new Error('Erro ao baixar modelo');
                    }
                    
                    const blob = await downloadResponse.blob();
                    const url = window.URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.setAttribute('download', 'Modelo_Contatos_Campanha.xlsx');
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                    window.URL.revokeObjectURL(url);
                    
                    toast.success('✅ Modelo Excel baixado com sucesso!');
                  } catch (error) {
                    console.error('Erro ao baixar modelo:', error);
                    toast.error('❌ Erro ao baixar modelo. Verifique se o backend está rodando.');
                  }
                }}
                className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white text-lg font-bold rounded-xl transition-all duration-200 shadow-lg shadow-green-500/30 hover:shadow-green-500/50 transform hover:scale-105"
              >
                <FaDownload className="text-2xl" />
                📥 Baixar Modelo Excel
              </button>
            </div>
            
            {/* Botões de Upload */}
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <div className={`border-2 border-dashed rounded-2xl p-6 transition-all ${
                contactsMethod === 'paste'
                  ? 'border-white/10 bg-white/5 opacity-50 cursor-not-allowed'
                  : 'border-primary-500/40 bg-primary-500/10 hover:border-primary-500/60'
              }`}>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleFileUpload(file);
                    }
                  }}
                  className="hidden"
                  id="csv-upload"
                  disabled={contactsMethod === 'paste'}
                />
                <label
                  htmlFor="csv-upload"
                  className={`flex flex-col items-center justify-center py-6 ${
                    contactsMethod === 'paste' ? 'cursor-not-allowed' : 'cursor-pointer'
                  }`}
                >
                  <div className={`p-5 rounded-xl mb-3 ${
                    contactsMethod === 'paste' ? 'bg-white/10' : 'bg-primary-500/20'
                  }`}>
                    <FaUpload className={`text-4xl ${
                      contactsMethod === 'paste' ? 'text-white/30' : 'text-primary-400'
                    }`} />
                  </div>
                  <p className={`text-lg font-bold ${
                    contactsMethod === 'paste' ? 'text-white/30' : 'text-primary-300'
                  }`}>
                    📁 Upload CSV/Excel
                  </p>
                  <p className="text-sm text-white/50 mt-2">
                    {contactsMethod === 'paste' ? 'Desabilitado (limpe para usar)' : 'Clique para selecionar arquivo'}
                  </p>
                  {contactsMethod === 'upload' && (
                    <span className="mt-3 text-sm bg-primary-500/30 text-primary-200 px-4 py-2 rounded-lg font-bold">
                      ✓ Ativo
                    </span>
                  )}
                </label>
              </div>
              
              <div className={`border-2 border-dashed rounded-2xl p-6 transition-all ${
                contactsMethod === 'upload'
                  ? 'border-white/10 bg-white/5 opacity-50'
                  : 'border-green-500/40 bg-green-500/10'
              }`}>
                <div className="flex flex-col items-center justify-center py-6">
                  <div className={`p-5 rounded-xl mb-3 ${
                    contactsMethod === 'upload' ? 'bg-white/10' : 'bg-green-500/20'
                  }`}>
                    <FaUpload className={`text-4xl ${
                      contactsMethod === 'upload' ? 'text-white/30' : 'text-green-400'
                    }`} />
                  </div>
                  <p className={`text-lg font-bold ${
                    contactsMethod === 'upload' ? 'text-white/30' : 'text-green-300'
                  }`}>
                    📋 Copiar e Colar
                  </p>
                  <p className="text-sm text-white/50 mt-2">
                    {contactsMethod === 'upload' ? 'Desabilitado (limpe para usar)' : 'Use a área abaixo'}
                  </p>
                  {contactsMethod === 'paste' && (
                    <span className="mt-3 text-sm bg-green-500/30 text-green-200 px-4 py-2 rounded-lg font-bold">
                      ✓ Ativo
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            <textarea
              className={`w-full min-h-[250px] px-6 py-4 text-base bg-dark-700/80 backdrop-blur-md border-2 border-white/20 rounded-xl text-white placeholder-white/40 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/30 transition-all duration-200 font-mono ${
                contactsMethod === 'upload' ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              placeholder={contactsMethod === 'upload' 
                ? 'Desabilitado - Arquivo CSV/Excel carregado. Clique em "Limpar" para trocar de método.'
                : `Cole aqui (um por linha):
5511999887766${maxVars >= 1 ? ',João' : ''}${maxVars >= 2 ? ',São Paulo' : ''}${maxVars >= 3 ? ',1500' : ''}
5521988776655${maxVars >= 1 ? ',Maria' : ''}${maxVars >= 2 ? ',Rio de Janeiro' : ''}${maxVars >= 3 ? ',2000' : ''}
...`}
              value={contactsInput}
              onChange={(e) => handleContactsInputChange(e.target.value)}
              disabled={contactsMethod === 'upload'}
              readOnly={contactsMethod === 'upload'}
            />
            
            {contacts.length > 0 && (
              <div className="mt-6 p-6 bg-green-500/10 border-2 border-green-500/30 rounded-xl">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-xl font-black text-green-300 mb-2 flex items-center gap-2">
                      <FaCheckCircle />
                      {contacts.length} contato(s) carregado(s)
                    </p>
                    <p className="text-base text-white/80">
                      • Primeira linha: {contacts[0]?.phone || 'N/A'}
                      {contacts[0]?.cpf ? ` | CPF: ${contacts[0].cpf}` : ''}
                      {contacts[0]?.variables.length > 0 && ` (${contacts[0].variables.length} variável(is))`}
                    </p>
                    <p className="text-sm text-white/60 mt-2">
                      Método: {contactsMethod === 'upload' ? '📁 Upload de arquivo' : '📋 Copiar/Colar'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={clearContacts}
                    className="flex items-center gap-2 px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl transition-all duration-200 shadow-lg shadow-red-500/30"
                  >
                    <FaTrash />
                    Limpar
                  </button>
                </div>
              </div>
            )}
            
            {contacts.length === 0 && contactsInput.trim() && (
              <div className="mt-4 p-4 bg-yellow-500/10 border-2 border-yellow-500/30 rounded-xl">
                <p className="text-base text-yellow-300 font-medium flex items-center gap-2">
                  <FaExclamationTriangle />
                  Nenhum contato válido encontrado
                </p>
              </div>
            )}
          </div>
        )}

        {/* 🔹 SEÇÃO 6: AGENDAMENTO */}
        {totalSelected > 0 && contacts.length > 0 && (
          <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-primary-500/30 rounded-2xl p-8 shadow-xl hover:border-primary-500/50 transition-all duration-300">
            <div className="flex items-center gap-4 mb-6">
              <div className="bg-gradient-to-br from-primary-500 to-primary-600 text-white text-2xl font-black w-14 h-14 rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/50">
                6
              </div>
              <div>
                <h2 className="text-3xl font-black text-white">
                  Horário de Funcionamento
                </h2>
                <p className="text-base text-white/70 mt-1">
                  Configure quando o sistema deve enviar mensagens
                </p>
              </div>
            </div>
            
            <div className="p-6 bg-blue-500/10 border-2 border-blue-500/30 rounded-xl mb-6">
              <p className="text-lg text-blue-300 font-bold mb-3">
                💡 Como funciona:
              </p>
              <ul className="text-base text-white/90 space-y-2 list-disc list-inside">
                <li>Sistema envia mensagens <strong>APENAS</strong> no horário configurado</li>
                <li>Passou do horário? → <span className="text-yellow-300 font-bold">PAUSA automática</span></li>
                <li>Chegou o horário novamente? → <span className="text-green-300 font-bold">RETOMA automática</span></li>
                <li>Continua nos próximos dias até enviar para <strong>TODOS</strong> os contatos</li>
              </ul>
            </div>
            
            {/* Agendamento do Início da Campanha */}
            <div className="mb-6 p-6 bg-purple-500/10 border-2 border-purple-500/30 rounded-xl">
              <h3 className="text-xl font-bold mb-4 text-purple-300">📅 Agendamento do Início (Opcional)</h3>
              <p className="text-sm text-white/70 mb-4">
                Defina quando a campanha deve começar. Deixe em branco para iniciar imediatamente.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-base font-bold mb-2 text-white/90">Data de Início</label>
                  <input
                    type="date"
                    className="w-full px-4 py-3 text-base bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30 transition-all"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-base font-bold mb-2 text-white/90">Hora de Início</label>
                  <input
                    type="time"
                    className="w-full px-4 py-3 text-base bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30 transition-all"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                  />
                </div>
              </div>
              {scheduleDate && scheduleTime && (
                <div className="mt-4 p-4 bg-green-500/10 border-2 border-green-500/30 rounded-xl">
                  <p className="text-base text-green-300 font-bold">
                    ✅ Campanha iniciará em: <span className="text-white">{scheduleDate} às {scheduleTime}</span>
                  </p>
                </div>
              )}
              {(!scheduleDate || !scheduleTime) && (
                <div className="mt-4 p-4 bg-yellow-500/10 border-2 border-yellow-500/30 rounded-xl">
                  <p className="text-base text-yellow-300 font-bold">
                    ⚡ Campanha iniciará <span className="text-white">IMEDIATAMENTE</span> após criação
                  </p>
                </div>
              )}
            </div>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-xl font-bold mb-4 text-primary-300">🕐 Horário de Trabalho Diário</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-base font-bold mb-2 text-white/90">Iniciar às</label>
                      <input
                        type="time"
                        className="w-full px-4 py-3 bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30 transition-all"
                        value={workStartTime}
                        onChange={(e) => setWorkStartTime(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-base font-bold mb-2 text-white/90">Pausar às</label>
                      <input
                        type="time"
                        className="w-full px-4 py-3 bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30 transition-all"
                        value={workEndTime}
                        onChange={(e) => setWorkEndTime(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="p-4 bg-white/5 rounded-xl">
                    <p className="text-sm text-white/70">
                      📌 Exemplo: 08:00 às 20:00 = Envia das 8h às 20h todos os dias
                    </p>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-xl font-bold mb-4 text-primary-300">⚙️ Controles</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-base font-bold mb-2 text-white/90">
                      Intervalo entre envios (segundos)
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-white/70 mb-1">Mínimo</label>
                    <input
                      type="number"
                      className="w-full px-4 py-3 bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30 transition-all"
                          min="0"
                          step="1"
                          value={intervalSecondsMin}
                          onChange={(e) => {
                            setIntervalSecondsMin(e.target.value);
                            // Garantir que máximo seja sempre >= mínimo
                            if (parseInt(e.target.value) > parseInt(intervalSecondsMax)) {
                              setIntervalSecondsMax(e.target.value);
                            }
                          }}
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-white/70 mb-1">Máximo</label>
                        <input
                          type="number"
                          className="w-full px-4 py-3 bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30 transition-all"
                          min={intervalSecondsMin}
                          value={intervalSecondsMax}
                          onChange={(e) => setIntervalSecondsMax(e.target.value)}
                    />
                      </div>
                    </div>
                    <p className="text-sm text-white/60 mt-2">
                      ⏱️ Aguardar entre {intervalSecondsMin}s e {intervalSecondsMax}s (aleatório) entre cada mensagem
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 🔹 SEÇÃO 7: CONFIGURAÇÕES AVANÇADAS */}
        {totalSelected > 0 && contacts.length > 0 && (
          <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-primary-500/30 rounded-2xl p-8 shadow-xl hover:border-primary-500/50 transition-all duration-300">
            <div className="flex items-center gap-4 mb-6">
              <div className="bg-gradient-to-br from-primary-500 to-primary-600 text-white text-2xl font-black w-14 h-14 rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/50">
                7
              </div>
              <div>
                <h2 className="text-3xl font-black text-white">
                  Configurações Avançadas
                </h2>
                <p className="text-base text-white/70 mt-1">
                  Controles de pausa e retomada automática
                </p>
              </div>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-lg font-bold mb-3 text-white/90 flex items-center gap-2">
                  <FaPause />
                  Pausar após (mensagens)
                </label>
                <input
                  type="number"
                  className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/30 transition-all"
                  min="1"
                  value={pauseAfter}
                  onChange={(e) => setPauseAfter(e.target.value)}
                />
                <p className="text-sm text-white/60 mt-3">
                  Sistema pausará automaticamente após enviar {pauseAfter} mensagens
                </p>
              </div>
              
              <div>
                <label className="block text-lg font-bold mb-3 text-white/90 flex items-center gap-2">
                  <FaClock />
                  Retomar após (minutos)
                </label>
                <input
                  type="number"
                  className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/30 transition-all"
                  min="1"
                  value={pauseDuration}
                  onChange={(e) => setPauseDuration(e.target.value)}
                />
                <p className="text-sm text-white/60 mt-3">
                  Aguardar {pauseDuration} minutos antes de retomar os envios
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 🎯 RESUMO FINAL E BOTÕES */}
        {totalSelected > 0 && contacts.length > 0 && (
          <div className="bg-gradient-to-r from-green-600/30 via-green-500/20 to-green-600/30 backdrop-blur-xl border-2 border-green-500/50 rounded-2xl p-8 shadow-2xl shadow-green-500/20">
            <h2 className="text-3xl font-black text-green-300 mb-6 flex items-center gap-3">
              <div className="bg-green-500/20 p-4 rounded-xl">
                <FaRocket className="text-3xl" />
              </div>
              Resumo da Campanha
            </h2>
            
            <div className="grid md:grid-cols-3 gap-6 text-base mb-8">
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-5 border border-white/20">
                <p className="text-white/70 mb-2">Nome:</p>
                <p className="font-bold text-xl text-white">{campaignName || '(sem nome)'}</p>
              </div>
              
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-5 border border-white/20">
                <p className="text-white/70 mb-2">Contas WhatsApp:</p>
                <p className="font-bold text-xl text-white">{selectedAccountIds.length}</p>
              </div>
              
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-5 border border-white/20">
                <p className="text-white/70 mb-2">Templates:</p>
                <p className="font-bold text-xl text-white">{totalSelected}</p>
              </div>
              
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-5 border border-white/20">
                <p className="text-white/70 mb-2">Contatos:</p>
                <p className="font-bold text-xl text-white">{contacts.length}</p>
              </div>
              
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-5 border border-white/20">
                <p className="text-white/70 mb-2">Total de envios:</p>
                <p className="font-bold text-xl text-green-400">
                  {contacts.length} mensagens
                </p>
              </div>
              
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-5 border border-white/20">
                <p className="text-white/70 mb-2">Tempo estimado:</p>
                <p className="font-bold text-xl text-white">
                  ~{Math.ceil(((contacts.length - 1) * ((parseInt(intervalSecondsMin) + parseInt(intervalSecondsMax)) / 2) + (contacts.length * 2)) / 60)} min
                </p>
              </div>
            </div>
            
            <div className="flex gap-4">
              <button
                onClick={handleSubmit}
                disabled={loading || isCheckingRestrictions}
                className="flex-1 flex items-center justify-center gap-3 px-8 py-6 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white text-2xl font-black rounded-2xl transition-all duration-200 shadow-xl shadow-green-500/40 hover:shadow-green-500/60 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                <FaRocket className="text-3xl" />
                {isCheckingRestrictions ? '🔍 Verificando Listas de Restrição...' : loading ? 'Criando Campanha...' : 'Criar e Iniciar Campanha'}
              </button>
              
              <button
                onClick={() => router.push('/campanhas')}
                className="px-8 py-6 bg-dark-700 hover:bg-dark-600 text-white text-xl font-bold rounded-2xl transition-all duration-200 border-2 border-white/20 hover:border-white/40"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* Preview do Template */}
      {previewTemplate && (
        <TemplatePreview
          isOpen={showPreview}
          onClose={() => {
            setShowPreview(false);
            setPreviewTemplate(null);
          }}
          template={parseTemplateForPreview(previewTemplate)}
        />
      )}
      
      {/* Modal de Verificação de Restrições */}
      <RestrictionCheckModal
        isOpen={showRestrictionModal}
        onClose={() => setShowRestrictionModal(false)}
        result={restrictionCheckResult}
        totalTemplates={totalSelected}
        intervalSeconds={Math.round((parseInt(intervalSecondsMin) + parseInt(intervalSecondsMax)) / 2)}
        onExcludeRestricted={handleExcludeRestricted}
        onKeepAll={handleKeepAll}
      />
      
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #10b981;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #059669;
        }
        .bg-grid-white {
          background-image: 
            linear-gradient(to right, rgba(255, 255, 255, 0.1) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.1) 1px, transparent 1px);
          background-size: 20px 20px;
        }
      `}</style>
      
      {/* Modal de Confirmação Elegante */}
      <ConfirmDialog />
      
      {/* Toast Notifications */}
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />
    </div>
    </>
  );
}
