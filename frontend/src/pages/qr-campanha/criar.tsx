import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { FaRocket, FaClock, FaUpload, FaTrash, FaCheck, FaExclamationTriangle, FaArrowLeft } from 'react-icons/fa';
import api, { qrCampaignsAPI } from '@/services/api';
import ToastContainer from '@/components/ToastContainer';
import { useToast } from '@/hooks/useToast';
import * as XLSX from 'xlsx';
import { InstanceAvatar } from '@/components/InstanceAvatar';
import { detectVariables } from '@/utils/templateVariables';
import RestrictionCheckModal from '@/components/RestrictionCheckModal';

// ✅ URL base da API
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface QrTemplate {
  id: number;
  name: string;
  description: string;
  type: string;
  text_content?: string;
  variables_map?: any;
}

interface UazInstance {
  id: number;
  name: string;
  session_name: string;
  phone_number: string;
  profile_pic_url?: string | null;
  profile_name?: string | null;
  is_connected: boolean;
  is_active: boolean;
  status: string;
}

interface Contact {
  phone: string;
  variables: Record<string, string>; // Mudado de string[] para objeto nomeado
}

export default function CriarCampanhaQR() {
  const router = useRouter();
  const toast = useToast();
  
  // Dados básicos
  const [campaignName, setCampaignName] = useState('');
  const [instances, setInstances] = useState<UazInstance[]>([]);
  const [templates, setTemplates] = useState<QrTemplate[]>([]);
  
  // NOVA ESTRUTURA: Seleção independente
  const [selectedInstanceIds, setSelectedInstanceIds] = useState<number[]>([]);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<number[]>([]);
  
  // Filtros de templates
  const [searchTemplate, setSearchTemplate] = useState('');
  const [excludeTemplate, setExcludeTemplate] = useState('');
  const [onlyWithMedia, setOnlyWithMedia] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('Todas');
  const [variablesFilter, setVariablesFilter] = useState<'all' | 'with' | 'without'>('all'); // ✅ Filtro de variáveis
  
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsInput, setContactsInput] = useState('');
  const [contactsMethod, setContactsMethod] = useState<'none' | 'upload' | 'paste'>('none');
  
  // 🔤 SISTEMA DE MAPEAMENTO DE VARIÁVEIS
  const [csvColumns, setCsvColumns] = useState<string[]>([]); // Colunas do CSV
  const [templateVariables, setTemplateVariables] = useState<string[]>([]); // Variáveis dos templates
  const [variableMapping, setVariableMapping] = useState<Record<string, string>>({}); // Mapeamento: variável → coluna
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [rawCsvData, setRawCsvData] = useState<any[][]>([]); // Dados brutos do CSV para processar após mapeamento
  const [excelGenerated, setExcelGenerated] = useState(false); // Rastrear se Excel foi gerado
  const [showExcelWarning, setShowExcelWarning] = useState(false); // Mostrar aviso ao gerar Excel
  
  // Agendamento
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [workStartTime, setWorkStartTime] = useState('08:00');
  const [workEndTime, setWorkEndTime] = useState('20:00');
  const [intervalSeconds, setIntervalSeconds] = useState('5');
  
  // Pausas
  const [pauseAfter, setPauseAfter] = useState('100');
  const [pauseDuration, setPauseDuration] = useState('30');
  
  const [loading, setLoading] = useState(false);

  // Estados para verificação de restrições
  const [showRestrictionModal, setShowRestrictionModal] = useState(false);
  const [restrictionCheckResult, setRestrictionCheckResult] = useState<any>(null);
  const [isCheckingRestrictions, setIsCheckingRestrictions] = useState(false);

  useEffect(() => {
    loadInstances();
    loadTemplates();
  }, []);

  const loadInstances = async () => {
    try {
      const url = `/uaz/instances?_t=${Date.now()}`;
      console.log('🔵 CHAMANDO API:', url);
      console.log('🔵 Config da API:', api.defaults.baseURL);
      const response = await api.get(url);
      console.log('📱 Resposta da API de instâncias:', response.data);
      console.log('📱 URL da requisição:', response.config.url);
      console.log('📱 Total de instâncias:', response.data.data?.length);
      
      const allInstances = response.data.data || [];
      console.log('📱 Instâncias carregadas:', allInstances);
      
      // Filtrar apenas conectadas E ativas (não pausadas)
      const activeInstances = allInstances.filter((i: UazInstance) => 
        i.is_connected && i.is_active
      );
      console.log('📱 Instâncias CONECTADAS E ATIVAS:', activeInstances.length);
      
      setInstances(activeInstances); // Mostrando APENAS conectadas e ativas
      
      if (activeInstances.length === 0 && allInstances.length > 0) {
        const pausedCount = allInstances.filter((i: UazInstance) => !i.is_active).length;
        if (pausedCount > 0) {
          toast.warning(`⚠️ Há ${pausedCount} instância(s) pausada(s). Ative-as para usar em campanhas.`);
        } else {
          toast.warning('⚠️ Há instâncias cadastradas, mas nenhuma está conectada!');
        }
      } else if (activeInstances.length > 0) {
        console.log('✅ Instâncias disponíveis para campanha:', activeInstances);
      }
    } catch (error) {
      console.error('❌ Erro ao carregar instâncias:', error);
      toast.error('Erro ao carregar instâncias UAZ');
    }
  };

  const loadTemplates = async () => {
    try {
      console.log('\n📋 ===== CARREGANDO TEMPLATES QR =====');
      const response = await api.get('/qr-templates');
      console.log(`✅ API retornou ${response.data.data?.length || 0} templates`);
      console.log('📋 Templates recebidos:', response.data.data?.map((t: any) => ({ id: t.id, name: t.name, type: t.type })));
      setTemplates(response.data.data);
      console.log('=====================================\n');
      
      // 🔤 Detectar variáveis dos templates selecionados
      updateTemplateVariables();
    } catch (error) {
      console.error('Erro ao carregar templates:', error);
      toast.error('Erro ao carregar templates QR');
    }
  };

  // 🔤 Detectar todas as variáveis dos templates selecionados
  const updateTemplateVariables = () => {
    if (selectedTemplateIds.length === 0) {
      setTemplateVariables([]);
      return;
    }

    const allVariables = new Set<string>();
    
    selectedTemplateIds.forEach(templateId => {
      const template = templates.find(t => t.id === templateId);
      if (template && template.text_content) {
        const vars = detectVariables(template.text_content);
        vars.forEach(v => allVariables.add(v));
      }
    });

    setTemplateVariables(Array.from(allVariables));
    console.log('🔤 Variáveis detectadas dos templates:', Array.from(allVariables));
  };

  // Atualizar variáveis quando templates mudarem
  useEffect(() => {
    updateTemplateVariables();
  }, [selectedTemplateIds, templates]);

  // Toggle de seleção de instância
  const handleToggleInstance = (instanceId: number) => {
    if (selectedInstanceIds.includes(instanceId)) {
      setSelectedInstanceIds(selectedInstanceIds.filter(id => id !== instanceId));
    } else {
      setSelectedInstanceIds([...selectedInstanceIds, instanceId]);
    }
  };

  // Selecionar todas as instâncias
  const handleSelectAllInstances = () => {
    if (selectedInstanceIds.length === instances.length) {
      setSelectedInstanceIds([]);
    } else {
      setSelectedInstanceIds(instances.map(i => i.id));
    }
  };

  // Toggle de seleção de template
  const handleToggleTemplate = (templateId: number) => {
    // ⚠️ AVISO: Se Excel já foi gerado, avisar sobre mudança de variáveis
    if (excelGenerated) {
      const isAdding = !selectedTemplateIds.includes(templateId);
      if (isAdding) {
        toast.warning(
          '⚠️ ATENÇÃO: Você já gerou o Excel! ' +
          'Adicionar mais templates pode alterar as variáveis necessárias. ' +
          'Recomendamos gerar um novo Excel após finalizar a seleção de templates.'
        );
      }
    }

    if (selectedTemplateIds.includes(templateId)) {
      setSelectedTemplateIds(selectedTemplateIds.filter(id => id !== templateId));
    } else {
      setSelectedTemplateIds([...selectedTemplateIds, templateId]);
    }
    // Variáveis serão atualizadas pelo useEffect
  };

  // Selecionar todos os templates
  const handleSelectAllTemplates = () => {
    // ⚠️ AVISO: Se Excel já foi gerado, avisar sobre mudança de variáveis
    if (excelGenerated) {
      const filtered = getFilteredTemplates();
      const isAdding = selectedTemplateIds.length < filtered.length;
      if (isAdding) {
        toast.warning(
          '⚠️ ATENÇÃO: Você já gerou o Excel! ' +
          'Adicionar mais templates pode alterar as variáveis necessárias. ' +
          'Recomendamos gerar um novo Excel após finalizar a seleção de templates.'
        );
      }
    }

    const filtered = getFilteredTemplates();
    if (selectedTemplateIds.length === filtered.length) {
      setSelectedTemplateIds([]);
    } else {
      setSelectedTemplateIds(filtered.map(t => t.id));
    }
  };

  // ✅ Função para detectar variáveis no template
  const getTemplateVariables = (template: QrTemplate): { hasVariables: boolean; count: number; names: string[] } => {
    const variables = new Set<string>();
    
    // Verificar variables_map
    if (template.variables_map) {
      try {
        const varsMap = typeof template.variables_map === 'string' 
          ? JSON.parse(template.variables_map) 
          : template.variables_map;
        
        Object.keys(varsMap).forEach(key => variables.add(key));
      } catch (e) {
        // Ignorar erros de parse
      }
    }
    
    // Verificar no text_content usando regex
    if (template.text_content) {
      const variableRegex = /\{\{\s*(\w+)\s*\}\}/g;
      let match;
      while ((match = variableRegex.exec(template.text_content)) !== null) {
        variables.add(match[1].trim());
      }
    }
    
    return {
      hasVariables: variables.size > 0,
      count: variables.size,
      names: Array.from(variables)
    };
  };

  // Filtrar templates
  const getFilteredTemplates = () => {
    console.log('\n🔍 ===== FILTRANDO TEMPLATES =====');
    console.log(`   Templates totais: ${templates.length}`);
    console.log(`   Filtros ativos:`);
    console.log(`     - searchTemplate: "${searchTemplate}"`);
    console.log(`     - excludeTemplate: "${excludeTemplate}"`);
    console.log(`     - onlyWithMedia: ${onlyWithMedia}`);
    console.log(`     - categoryFilter: "${categoryFilter}"`);
    console.log(`     - variablesFilter: "${variablesFilter}"`);
    
    const filtered = templates.filter(template => {
      // Filtro de busca
      if (searchTemplate && !template.name.toLowerCase().includes(searchTemplate.toLowerCase())) {
        return false;
      }

      // Filtro de exclusão
      if (excludeTemplate && template.name.toLowerCase().includes(excludeTemplate.toLowerCase())) {
        return false;
      }

      // Filtro de apenas com mídia
      if (onlyWithMedia) {
        const typesWithMedia = ['image', 'video', 'audio', 'document'];
        if (!typesWithMedia.includes(template.type)) {
          return false;
        }
      }

      // Filtro de categoria
      if (categoryFilter !== 'Todas' && template.type !== categoryFilter) {
        return false;
      }

      // ✅ Filtro de variáveis
      if (variablesFilter !== 'all') {
        const varInfo = getTemplateVariables(template);
        if (variablesFilter === 'with' && !varInfo.hasVariables) {
          return false;
        }
        if (variablesFilter === 'without' && varInfo.hasVariables) {
          return false;
        }
      }

      return true;
    });
    
    console.log(`   ✅ Templates após filtros: ${filtered.length}`);
    console.log(`   Templates exibidos:`, filtered.map(t => ({ id: t.id, name: t.name })));
    console.log('==================================\n');
    
    return filtered;
  };

  // 🔤 Mapear automaticamente colunas CSV → variáveis (ignorando case)
  const autoMapColumnsToVariables = (columns: string[]): Record<string, string> => {
    const mapping: Record<string, string> = {};
    
    templateVariables.forEach(variable => {
      // Procurar coluna com nome igual (case insensitive)
      const foundColumn = columns.find(col => 
        col.toLowerCase().trim() === variable.toLowerCase().trim()
      );
      
      if (foundColumn) {
        mapping[variable] = foundColumn;
      }
    });
    
    return mapping;
  };

  // 🔤 Processar dados CSV com mapeamento de variáveis
  const processCsvDataWithMapping = (data: any[][], columns: string[], mapping: Record<string, string>): Contact[] => {
    const contacts: Contact[] = [];
    
    // Primeira linha são os cabeçalhos, começar da segunda
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0) continue;
      
      // Primeira coluna é sempre o telefone
      const phone = String(row[0] || '').replace(/\D/g, '');
      if (!phone) continue;
      
      // Criar objeto de variáveis mapeadas
      const variables: Record<string, string> = {};
      
      templateVariables.forEach(variable => {
        const mappedColumn = mapping[variable];
        if (mappedColumn) {
          const columnIndex = columns.indexOf(mappedColumn);
          if (columnIndex >= 0 && columnIndex < row.length) {
            variables[variable] = String(row[columnIndex] || '').trim();
          }
        }
      });
      
      contacts.push({
        phone,
        variables
      });
    }
    
    return contacts;
  };

  // ✅ Função auxiliar para converter notação científica de volta para número
  const fixScientificNotation = (value: string): string => {
    if (!value || !/\d/.test(value)) return value;
    
    // Detectar notação científica: 5.6298E+12, 5.6298BE+12
    const scientificRegex = /^(\d+\.?\d*)[BE]\+(\d+)$/i;
    const match = value.match(scientificRegex);
    
    if (match) {
      try {
        const num = parseFloat(value.replace(/B/gi, 'E'));
        const result = num.toFixed(0);
        console.log(`🔢 Convertido: ${value} -> ${result}`);
        return result;
      } catch (e) {
        console.warn(`⚠️ Falha ao converter: ${value}`);
        return value;
      }
    }
    
    return value.replace(/[^\d+]/g, '');
  };

  const parseContacts = (text: string): Contact[] => {
    const lines = text.trim().split('\n').filter(line => line.trim());
    if (lines.length === 0) return [];

    // Primeira linha são os cabeçalhos (se tiver vírgula, é CSV com cabeçalho)
    const headerLine = lines[0];
    const hasCommaInHeader = headerLine.includes(',');
    const columns = headerLine.split(',').map(c => c.trim());
    
    // Se não tem variáveis nos templates OU se é copiar/colar (sem cabeçalho CSV), usar apenas telefone
    if (templateVariables.length === 0 || !hasCommaInHeader) {
      const parsed: Contact[] = [];
      // Se primeira linha parece ser cabeçalho (tem vírgula mas não é número), pular
      const startIndex = (hasCommaInHeader && isNaN(parseInt(headerLine.replace(/\D/g, '')))) ? 1 : 0;
      
      for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i].trim();
        // Pegar apenas o telefone (primeira parte antes da vírgula, ou a linha inteira se não tiver vírgula)
        const phonePart = line.includes(',') ? line.split(',')[0] : line;
        const phone = phonePart.replace(/\D/g, '');
        
        if (phone && phone.length >= 10) {
          // Copiar/colar: apenas telefone, sem variáveis
          parsed.push({ phone, variables: {} });
        }
      }
      return parsed;
    }

    // 🔤 NOVO: Mapear automaticamente
    const mapping = autoMapColumnsToVariables(columns);
    
    // Verificar se todas as variáveis foram mapeadas
    const unmappedVars = templateVariables.filter(v => !mapping[v]);
    
    if (unmappedVars.length > 0) {
      // Salvar dados brutos para processar após mapeamento manual
      const rawData: any[][] = lines.map(line => line.split(',').map(p => p.trim()));
      setRawCsvData(rawData);
      setCsvColumns(columns);
      setVariableMapping(mapping);
      setShowMappingModal(true);
      return [];
    }

    // Processar dados com mapeamento
    const rawData: any[][] = lines.map(line => line.split(',').map(p => p.trim()));
    return processCsvDataWithMapping(rawData, columns, mapping);
  };

  const handleContactsChange = (text: string) => {
    setContactsInput(text);
    if (text.trim()) {
      const parsed = parseContacts(text);
      setContacts(parsed);
      setContactsMethod('paste');
    } else {
      setContacts([]);
      setContactsMethod('none');
    }
  };

  const handleUploadExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      console.log(`📁 Processando: ${file.name}`);
      
      const data = await file.arrayBuffer();
      // ✅ Usar opções para evitar conversão automática
      const workbook = XLSX.read(data, { 
        raw: true,
        cellText: true,
        cellDates: false
      });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
        header: 1,
        raw: true,
        defval: ''
      }) as any[][];

      if (jsonData.length === 0) {
        toast.error('❌ Arquivo Excel vazio!');
        return;
      }

      console.log('📊 Primeira linha:', jsonData[0]);
      console.log('📊 Segunda linha:', jsonData[1]);

      // Primeira linha são os cabeçalhos
      const columns = (jsonData[0] || []).map((c: any) => String(c || '').trim());
      
      // Se não tem variáveis nos templates, usar formato antigo
      if (templateVariables.length === 0) {
        const parsed: Contact[] = [];
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (row[0]) {
            // ✅ CORRIGIR: Aplicar fixScientificNotation no telefone
            const rawPhone = String(row[0]);
            const phone = fixScientificNotation(rawPhone).replace(/\D/g, '');
            
            console.log(`📞 Linha ${i}: ${rawPhone} -> ${phone}`);
            
            if (phone) {
              const variables: Record<string, string> = {};
              row.slice(1).forEach((val, idx) => {
                // ✅ CORRIGIR: Aplicar também nas variáveis
                const fixed = fixScientificNotation(String(val || ''));
                variables[`var${idx + 1}`] = fixed;
              });
              parsed.push({ phone, variables });
            }
          }
        }
        setContacts(parsed);
        setContactsInput('');
        setContactsMethod('upload');
        toast.success(`✅ ${parsed.length} contatos importados!`);
        return;
      }

      // 🔤 NOVO: Mapear automaticamente
      const mapping = autoMapColumnsToVariables(columns);
      const unmappedVars = templateVariables.filter(v => !mapping[v]);
      
      if (unmappedVars.length > 0) {
        // Salvar dados brutos para processar após mapeamento manual
        setRawCsvData(jsonData);
        setCsvColumns(columns);
        setVariableMapping(mapping);
        setShowMappingModal(true);
        return;
      }

      // Processar dados com mapeamento
      const parsed = processCsvDataWithMapping(jsonData, columns, mapping);
      setContacts(parsed);
      setContactsInput('');
      setContactsMethod('upload');
      toast.success(`✅ ${parsed.length} contatos importados com mapeamento automático!`);
    } catch (error) {
      console.error('Erro ao ler Excel:', error);
      toast.error('Erro ao ler arquivo Excel');
    }
  };

  // 🔤 Confirmar mapeamento manual e processar dados
  const handleConfirmMapping = () => {
    const unmappedVars = templateVariables.filter(v => !variableMapping[v]);
    
    if (unmappedVars.length > 0) {
      // Mostrar aviso mas permitir continuar (Opção A)
      toast.warning(
        `⚠️ ${unmappedVars.length} variável(is) não mapeada(s): ${unmappedVars.join(', ')}. ` +
        `Essas variáveis ficarão vazias nas mensagens.`
      );
    }

    // Processar dados com mapeamento
    const parsed = processCsvDataWithMapping(rawCsvData, csvColumns, variableMapping);
    setContacts(parsed);
    setContactsInput('');
    setContactsMethod('upload');
    setShowMappingModal(false);
    
    if (parsed.length > 0) {
      toast.success(`✅ ${parsed.length} contatos importados!`);
    }
  };

  // 📊 Gerar Excel de exemplo com todas as variáveis dos templates selecionados
  const generateExampleExcel = () => {
    if (selectedTemplateIds.length === 0) {
      toast.error('❌ Selecione pelo menos um template antes de gerar o Excel de exemplo!');
      return;
    }

    // Mostrar aviso antes de gerar
    setShowExcelWarning(true);
  };

  // Confirmar geração do Excel após aviso
  const confirmGenerateExcel = () => {
    setShowExcelWarning(false);
    
    if (selectedTemplateIds.length === 0) {
      toast.error('❌ Selecione pelo menos um template antes de gerar o Excel de exemplo!');
      return;
    }

    if (templateVariables.length === 0) {
      toast.warning('⚠️ Os templates selecionados não possuem variáveis. Gerando Excel básico com apenas Telefone.');
      
      // Gerar Excel básico sem variáveis (apenas cabeçalho)
      const workbook = XLSX.utils.book_new();
      const worksheetData = [
        ['Telefone'] // Apenas cabeçalho
      ];
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
      
      // Ajustar largura da coluna
      worksheet['!cols'] = [{ wch: 15 }];
      
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Contatos');
      XLSX.writeFile(workbook, 'modelo_contatos.xlsx');
      toast.success('✅ Excel de exemplo gerado!');
      return;
    }

    // Criar workbook
    const workbook = XLSX.utils.book_new();
    
    // Criar cabeçalhos: Telefone + todas as variáveis
    const headers = ['Telefone', ...templateVariables];
    
    // Criar dados apenas com cabeçalho (sem linhas de exemplo)
    const adjustedData = [
      headers, // Apenas cabeçalhos
    ];

    // Criar worksheet
    const worksheet = XLSX.utils.aoa_to_sheet(adjustedData);
    
    // Ajustar largura das colunas baseado apenas no cabeçalho
    const colWidths = headers.map((header) => {
      return { wch: Math.min(Math.max(header.length + 2, 12), 30) };
    });
    worksheet['!cols'] = colWidths;
    
    // Adicionar worksheet ao workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Contatos');
    
    // Gerar nome do arquivo com data
    const dateStr = new Date().toISOString().split('T')[0];
    const fileName = `modelo_contatos_${dateStr}.xlsx`;
    
    // Fazer download
    XLSX.writeFile(workbook, fileName);
    
    // Marcar que Excel foi gerado
    setExcelGenerated(true);
    
    toast.success(`✅ Excel de exemplo gerado com ${templateVariables.length} variável(is)!`);
    toast.warning('⚠️ IMPORTANTE: Não adicione ou remova templates agora! As variáveis podem mudar e o Excel ficará desatualizado.');
    console.log('📊 Variáveis incluídas no Excel:', templateVariables);
  };

  // 🚨 VERIFICAR LISTA DE RESTRIÇÃO
  const checkRestrictions = async () => {
    console.log('🔍 [QR CAMPANHA] Iniciando verificação de restrições...');
    
    try {
      setIsCheckingRestrictions(true);
      
      // Extrair apenas os números de telefone únicos
      const allPhoneNumbers = contacts.map(c => c.phone);
      const phoneNumbers = [...new Set(allPhoneNumbers)];
      
      console.log('📞 Total de contatos únicos:', phoneNumbers.length);
      console.log('📱 Instâncias selecionadas:', selectedInstanceIds);
      
      if (selectedInstanceIds.length === 0) {
        console.error('❌ Nenhuma instância selecionada');
        toast.error('⚠️ Selecione pelo menos uma instância antes de criar a campanha');
        setIsCheckingRestrictions(false);
        return;
      }
      
      // Verificar restrições em todas as instâncias selecionadas
      const response = await fetch(`${API_URL}/restriction-lists/check-bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('@WhatsAppDispatcher:token')}`,
        },
        body: JSON.stringify({
          phone_numbers: phoneNumbers,
          instance_ids: selectedInstanceIds, // QR Connect usa instance_ids
        }),
      });
      
      if (!response.ok) {
        throw new Error('Erro ao verificar restrições');
      }
      
      const result = await response.json();
      console.log('📊 Resultado da verificação:', result);
      
      setRestrictionCheckResult(result);
      
      // Se houver contatos restritos, mostrar modal
      if (result.restricted_count > 0) {
        console.log('🚫 Contatos restritos encontrados:', result.restricted_count);
        setShowRestrictionModal(true);
      } else {
        // Nenhum restrito, criar campanha diretamente
        console.log('✅ Nenhum contato restrito. Criando campanha...');
        toast.success('✅ Nenhum contato restrito encontrado!');
        await createCampaign(contacts);
      }
      
    } catch (error: any) {
      console.error('❌ Erro ao verificar restrições:', error);
      toast.error('Erro ao verificar lista de restrição. Criando campanha sem verificação...');
      // Em caso de erro, criar campanha normalmente
      await createCampaign(contacts);
    } finally {
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
    
    console.log(`🗑️ Excluindo ${restrictedPhones.length} contatos restritos`);
    console.log(`✅ Criando campanha com ${filteredContacts.length} contatos`);
    
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
    try {
      const scheduled_at = scheduleDate && scheduleTime 
        ? `${scheduleDate}T${scheduleTime}`
        : null;

      const data = {
        name: campaignName,
        instance_ids: selectedInstanceIds,
        template_ids: selectedTemplateIds,
        contacts: contactsToUse.map(c => ({
          phone: c.phone,
          name: c.variables['nome'] || c.variables['name'] || '',
          variables: c.variables
        })),
        scheduled_at,
        schedule_config: {
          work_start_time: workStartTime,
          work_end_time: workEndTime,
          interval_seconds: parseInt(intervalSeconds)
        },
        pause_config: {
          pause_after: parseInt(pauseAfter),
          pause_duration_minutes: parseInt(pauseDuration)
        },
        ignore_restrictions: ignoreRestrictions,
      };

      await qrCampaignsAPI.create(data);
      toast.success('✅ Campanha QR criada com sucesso!');
      
      setTimeout(() => {
        router.push('/qr-campanhas');
      }, 1500);
    } catch (error: any) {
      console.error('❌ ERRO AO CRIAR CAMPANHA:', error);
      console.error('❌ Response:', error.response);
      console.error('❌ Data:', error.response?.data);
      
      const errorMessage = error.response?.data?.error || error.message || 'Erro desconhecido';
      const errorDetails = error.response?.data?.details;
      
      toast.error(`❌ Erro ao criar campanha: ${errorMessage}`);
      
      if (errorDetails) {
        console.error('❌ Detalhes do erro:', errorDetails);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    console.log('🚀 handleSubmit chamado!');
    console.log('📋 Nome da campanha:', campaignName);
    console.log('📋 Instâncias selecionadas:', selectedInstanceIds);
    console.log('📋 Templates selecionados:', selectedTemplateIds);
    console.log('📋 Contatos:', contacts.length);
    
    // ============================================
    // 🔍 VALIDAÇÕES COMPLETAS
    // ============================================
    
    // 1️⃣ VALIDAR NOME DA CAMPANHA
    if (!campaignName.trim()) {
      console.log('❌ VALIDAÇÃO FALHOU: Nome vazio');
      toast.error('❌ Digite o nome da campanha!');
      return;
    }
    
    if (campaignName.trim().length < 3) {
      toast.error('❌ O nome da campanha deve ter pelo menos 3 caracteres!');
      return;
    }

    // 2️⃣ VALIDAR INSTÂNCIAS
    if (selectedInstanceIds.length === 0) {
      toast.error('❌ Selecione pelo menos uma instância QR Connect!');
      toast.warning('💡 Você precisa selecionar uma instância para enviar as mensagens.');
      return;
    }

    // 3️⃣ VALIDAR TEMPLATES
    if (selectedTemplateIds.length === 0) {
      toast.error('❌ Selecione pelo menos um template!');
      toast.warning('💡 Adicione templates para definir o conteúdo das mensagens.');
      return;
    }

    // 4️⃣ VALIDAR CONTATOS
    if (contacts.length === 0) {
      toast.error('❌ Adicione pelo menos um contato!');
      toast.warning('💡 Faça upload de uma planilha ou cole os números manualmente.');
      return;
    }

    // 5️⃣ VALIDAR HORÁRIO DE TRABALHO
    if (workStartTime && workEndTime) {
      const [startHour, startMin] = workStartTime.split(':').map(Number);
      const [endHour, endMin] = workEndTime.split(':').map(Number);
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;
      
      if (startMinutes >= endMinutes) {
        toast.error('❌ O horário de início deve ser ANTES do horário de término!');
        toast.warning(`💡 Atual: ${workStartTime} até ${workEndTime}`);
        return;
      }
      
      const workDuration = (endMinutes - startMinutes) / 60;
      if (workDuration < 1) {
        toast.error('❌ O período de trabalho deve ter pelo menos 1 hora!');
        return;
      }
    }

    // 6️⃣ VALIDAR INTERVALO ENTRE MENSAGENS
    const intervalValue = parseInt(intervalSeconds);
    if (isNaN(intervalValue) || intervalValue < 1) {
      toast.error('❌ O intervalo entre mensagens deve ser pelo menos 1 segundo!');
      toast.warning('💡 Recomendamos pelo menos 3-5 segundos para evitar bloqueios.');
      return;
    }
    
    if (intervalValue < 3) {
      toast.warning('⚠️ Intervalo muito curto pode causar bloqueios no WhatsApp!');
      toast.warning('💡 Recomendamos usar pelo menos 5 segundos.');
    }

    // 7️⃣ VALIDAR CONFIGURAÇÕES DE PAUSA
    const pauseAfterValue = parseInt(pauseAfter);
    const pauseDurationValue = parseInt(pauseDuration);
    
    if (pauseAfterValue > 0) {
      if (isNaN(pauseDurationValue) || pauseDurationValue < 1) {
        toast.error('❌ Se configurar pausa automática, defina o tempo de pausa (mínimo 1 minuto)!');
        return;
      }
      
      if (pauseAfterValue < 10) {
        toast.warning('⚠️ Pausar a cada poucas mensagens pode deixar a campanha muito lenta.');
      }
    }

    // 8️⃣ VALIDAR AGENDAMENTO (se configurado)
    if (scheduleDate && scheduleTime) {
      const scheduledDateTime = new Date(`${scheduleDate}T${scheduleTime}`);
      const now = new Date();
      
      if (scheduledDateTime <= now) {
        toast.error('❌ A data/hora agendada deve ser no FUTURO!');
        toast.warning('💡 Escolha uma data e hora posterior ao momento atual.');
        return;
      }
      
      // Verificar se não está agendando para muito longe
      const daysDifference = (scheduledDateTime.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      if (daysDifference > 90) {
        toast.warning('⚠️ Você está agendando para mais de 90 dias no futuro.');
      }
    }

    // 9️⃣ VALIDAR NÚMEROS DE TELEFONE
    const invalidContacts = contacts.filter(c => {
      const cleanPhone = c.phone.replace(/\D/g, '');
      return cleanPhone.length < 10 || cleanPhone.length > 15;
    });
    
    if (invalidContacts.length > 0) {
      toast.error(`❌ Há ${invalidContacts.length} número(s) de telefone inválido(s)!`);
      toast.warning('💡 Os números devem ter entre 10 e 15 dígitos.');
      return;
    }

    // ✅ TODAS AS VALIDAÇÕES PASSARAM!
    toast.success('✅ Validações concluídas! Verificando lista de restrição...');
    
    // Verificar lista de restrição antes de criar a campanha
    await checkRestrictions();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-primary-900 p-8">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

      <div className="max-w-6xl mx-auto">
        {/* HEADER */}
        <div className="mb-8 flex items-start gap-4">
          {/* Botão Voltar */}
          <button
            onClick={() => router.push('/dashboard-uaz')}
            className="bg-white/10 hover:bg-white/20 p-3 rounded-xl transition-all duration-200 border-2 border-white/20 hover:border-white/40"
            title="Voltar para o Dashboard QR Connect"
          >
            <FaArrowLeft className="text-2xl text-white" />
          </button>
          
          <div className="flex-1">
            <h1 className="text-4xl font-black text-white mb-2">🚀 Criar Campanha QR Connect</h1>
            <p className="text-white/60">Configure sua campanha de envio em massa com rotatividade inteligente</p>
          </div>
        </div>

        {/* NOME DA CAMPANHA */}
        <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-8 mb-6">
          <h2 className="text-2xl font-black text-white mb-4">📝 Nome da Campanha</h2>
          <input
            type="text"
            className="w-full px-6 py-4 bg-dark-700/80 border-2 border-white/20 rounded-xl text-white text-lg focus:border-primary-500 focus:outline-none"
            placeholder="Ex: Promoção de Natal 2024"
            value={campaignName}
            onChange={(e) => setCampaignName(e.target.value)}
          />
        </div>

        {/* INSTÂNCIAS QR */}
        <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-primary-500/30 rounded-2xl p-8 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-black text-white">🔷 1. Selecionar Instâncias QR Connect</h2>
            <button
              onClick={handleSelectAllInstances}
              className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white font-bold rounded-lg transition-all"
            >
              {selectedInstanceIds.length === instances.length ? 'Desmarcar Todas' : 'Selecionar Todas'}
            </button>
          </div>

          {instances.length === 0 ? (
            <div className="text-center py-12 text-white/50">
              <p className="text-lg">Nenhuma instância conectada</p>
              <p className="text-sm mt-2">Conecte instâncias QR primeiro</p>
            </div>
          ) : (
            <>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {instances.map(instance => (
                  <label 
                    key={instance.id}
                    className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all border-2 ${
                      selectedInstanceIds.includes(instance.id)
                        ? 'bg-primary-500/20 border-primary-500/60'
                        : 'bg-dark-700/50 border-white/10 hover:border-white/30'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedInstanceIds.includes(instance.id)}
                      onChange={() => handleToggleInstance(instance.id)}
                      className="w-5 h-5 accent-primary-500"
                    />
                    <div className="flex-1">
                      <InstanceAvatar
                        profilePicUrl={instance.profile_pic_url}
                        instanceName={instance.name}
                        profileName={instance.profile_name}
                        phoneNumber={instance.phone_number}
                        isConnected={instance.is_connected}
                        size="sm"
                        showStatus={true}
                        showNames={true}
                        showPhone={true}
                      />
                    </div>
                    {selectedInstanceIds.includes(instance.id) ? (
                      <div className="px-3 py-1 bg-green-500 text-white text-xs font-bold rounded-full">
                        ✓ SELECIONADA
                      </div>
                    ) : (
                      <div className="px-3 py-1 bg-green-500/20 text-green-400 text-xs font-bold rounded-full">
                        🟢 ONLINE
                      </div>
                    )}
                  </label>
                ))}
              </div>
              <div className="p-4 bg-primary-500/10 border-2 border-primary-500/30 rounded-xl">
                <p className="text-primary-300 font-bold">
                  ✓ {selectedInstanceIds.length} instância(s) selecionada(s)
                </p>
              </div>
            </>
          )}
        </div>

         {/* TEMPLATES QR */}
        <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-green-500/30 rounded-2xl p-8 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-black text-white">📄 2. Selecionar Templates</h2>
            <button
              onClick={handleSelectAllTemplates}
              className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-bold rounded-lg transition-all"
            >
              {selectedTemplateIds.length === getFilteredTemplates().length ? 'Desmarcar Todos' : 'Selecionar Todos'}
            </button>
          </div>

          {/* FILTROS */}
          <div className="bg-dark-700/50 rounded-xl p-4 mb-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Buscar template */}
              <div>
                <label className="block text-sm text-white/70 mb-2">🔍 Buscar template</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 bg-dark-600 border-2 border-white/10 rounded-lg text-white focus:border-green-500 focus:outline-none"
                  placeholder="Digite para buscar..."
                  value={searchTemplate}
                  onChange={(e) => setSearchTemplate(e.target.value)}
                />
              </div>

              {/* Excluir que contenham */}
              <div>
                <label className="block text-sm text-white/70 mb-2">❌ Excluir que contenham</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 bg-dark-600 border-2 border-white/10 rounded-lg text-white focus:border-red-500 focus:outline-none"
                  placeholder="Digite para excluir..."
                  value={excludeTemplate}
                  onChange={(e) => setExcludeTemplate(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Apenas com Mídia */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="onlyWithMedia"
                  checked={onlyWithMedia}
                  onChange={(e) => setOnlyWithMedia(e.target.checked)}
                  className="w-5 h-5 accent-green-500"
                />
                <label htmlFor="onlyWithMedia" className="text-white cursor-pointer">
                  📎 Apenas com Mídia
                </label>
              </div>

              {/* Categoria */}
              <div>
                <label className="block text-sm text-white/70 mb-2">📁 Categoria</label>
                <select
                  className="w-full px-4 py-2 bg-dark-600 border-2 border-white/10 rounded-lg text-white focus:border-green-500 focus:outline-none"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <option value="Todas">Todas</option>
                  <option value="text">Texto</option>
                  <option value="image">Imagem</option>
                  <option value="video">Vídeo</option>
                  <option value="audio">Áudio</option>
                  <option value="document">Documento</option>
                  <option value="list">Lista</option>
                  <option value="button">Botão</option>
                </select>
              </div>

              {/* ✅ Filtro por Variáveis */}
              <div>
                <label className="block text-sm text-white/70 mb-2">🔧 Variáveis</label>
                <select
                  className="w-full px-4 py-2 bg-dark-600 border-2 border-white/10 rounded-lg text-white focus:border-green-500 focus:outline-none"
                  value={variablesFilter}
                  onChange={(e) => setVariablesFilter(e.target.value as 'all' | 'with' | 'without')}
                >
                  <option value="all">Todos (com/sem variáveis)</option>
                  <option value="with">✅ Apenas COM variáveis</option>
                  <option value="without">❌ Apenas SEM variáveis</option>
                </select>
              </div>
            </div>

            {/* Contador de filtros */}
            {(searchTemplate || excludeTemplate || onlyWithMedia || categoryFilter !== 'Todas' || variablesFilter !== 'all') && (
              <div className="pt-3 border-t border-white/10">
                <p className="text-sm text-white/60">
                  Mostrando <strong className="text-green-400">{getFilteredTemplates().length}</strong> de <strong>{templates.length}</strong> templates
                </p>
              </div>
            )}
          </div>

          {templates.length === 0 ? (
            <div className="text-center py-12 text-white/50">
              <p className="text-lg">Nenhum template criado</p>
              <p className="text-sm mt-2">Crie templates QR primeiro</p>
            </div>
          ) : getFilteredTemplates().length === 0 ? (
            <div className="text-center py-12 text-white/50">
              <p className="text-lg">Nenhum template encontrado</p>
              <p className="text-sm mt-2">Ajuste os filtros para ver mais resultados</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 max-h-[500px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-green-500/50 scrollbar-track-dark-700/50">
                {getFilteredTemplates().map(template => {
                  const varInfo = getTemplateVariables(template);
                  return (
                    <label 
                      key={template.id}
                      className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all border-2 ${
                        selectedTemplateIds.includes(template.id)
                          ? 'bg-green-500/20 border-green-500/60'
                          : 'bg-dark-700/50 border-white/10 hover:border-white/30'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedTemplateIds.includes(template.id)}
                        onChange={() => handleToggleTemplate(template.id)}
                        className="w-5 h-5 accent-green-500"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{template.name}</span>
                          {/* ✅ Badge de Variáveis */}
                          {varInfo.hasVariables && (
                            <span 
                              className="px-2 py-0.5 bg-orange-500/20 border border-orange-500/50 text-orange-300 text-xs font-bold rounded-full"
                              title={`Variáveis: ${varInfo.names.join(', ')}`}
                            >
                              🔧 {varInfo.count} {varInfo.count === 1 ? 'variável' : 'variáveis'}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-white/60">{template.type}</div>
                        {template.description && (
                          <div className="text-xs text-white/40 mt-1">{template.description}</div>
                        )}
                        {/* ✅ Lista de nomes das variáveis */}
                        {varInfo.hasVariables && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {varInfo.names.slice(0, 5).map((name, idx) => (
                              <span 
                                key={idx}
                                className="px-2 py-0.5 bg-blue-500/20 text-blue-300 text-xs rounded"
                              >
                                {`{{${name}}}`}
                              </span>
                            ))}
                            {varInfo.names.length > 5 && (
                              <span className="px-2 py-0.5 text-white/40 text-xs">
                                +{varInfo.names.length - 5} mais
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      {selectedTemplateIds.includes(template.id) && (
                        <div className="px-3 py-1 bg-green-500 text-white text-xs font-bold rounded-full">
                          ✓ SELECIONADO
                        </div>
                      )}
                    </label>
                  );
                })}
              </div>
              <div className="p-4 bg-green-500/10 border-2 border-green-500/30 rounded-xl">
                <p className="text-green-300 font-bold">
                  ✓ {selectedTemplateIds.length} template(s) selecionado(s)
                </p>
              </div>
            </>
          )}
        </div>

        {/* COMBINAÇÕES */}
        {selectedInstanceIds.length > 0 && selectedTemplateIds.length > 0 && (
          <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-2 border-purple-500/30 rounded-2xl p-8 mb-6">
            <h3 className="text-2xl font-black text-white mb-4">🔄 Rotatividade Configurada</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-dark-800/50 rounded-xl p-4 text-center">
                <div className="text-4xl font-black text-primary-400">{selectedInstanceIds.length}</div>
                <div className="text-white/70 text-sm mt-2">Instâncias</div>
              </div>
              <div className="bg-dark-800/50 rounded-xl p-4 text-center">
                <div className="text-4xl font-black text-green-400">{selectedTemplateIds.length}</div>
                <div className="text-white/70 text-sm mt-2">Templates</div>
              </div>
              <div className="bg-dark-800/50 rounded-xl p-4 text-center">
                <div className="text-4xl font-black text-purple-400">{selectedInstanceIds.length * selectedTemplateIds.length}</div>
                <div className="text-white/70 text-sm mt-2">Combinações</div>
              </div>
            </div>
            <div className="mt-4 p-4 bg-purple-500/10 border-2 border-purple-500/30 rounded-lg">
              <p className="text-purple-300 text-sm">
                <strong>💡 Como funciona:</strong> As instâncias rodiziam sempre, e os templates não repetem até acabarem todos. 
                Ex: Inst.A+Temp.1 → Inst.B+Temp.2 → Inst.C+Temp.3 → Inst.A+Temp.4...
              </p>
            </div>
          </div>
        )}

        {/* LISTA DE CONTATOS */}
        <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-8 mb-6">
          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <div className="bg-green-500 text-white font-black text-xl rounded-lg w-12 h-12 flex items-center justify-center">
              3
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-black text-white">Lista de Contatos</h2>
              <p className="text-white/60 text-sm">Importe contatos via arquivo CSV/Excel ou cole diretamente</p>
            </div>
            {excelGenerated && (
              <div className="bg-yellow-500/20 border-2 border-yellow-500/50 rounded-xl px-4 py-2">
                <p className="text-yellow-300 text-sm font-bold flex items-center gap-2">
                  <FaExclamationTriangle /> Excel Gerado
                </p>
              </div>
            )}
          </div>

          {/* Aviso se Excel foi gerado */}
          {excelGenerated && (
            <div className="mb-6 p-4 bg-yellow-500/10 border-2 border-yellow-500/30 rounded-xl">
              <p className="text-yellow-300 text-sm font-bold mb-1">⚠️ Excel já foi gerado!</p>
              <p className="text-white/80 text-sm">
                Não adicione ou remova templates agora. Se precisar alterar, gere um novo Excel após finalizar a seleção.
              </p>
            </div>
          )}

          {/* Informações sobre variáveis */}
          {selectedTemplateIds.length > 0 && templateVariables.length > 0 ? (
            <div className="bg-blue-900/30 border-2 border-blue-500/30 rounded-xl p-4 mb-6">
              <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                📋 Variáveis detectadas dos templates selecionados:
              </h3>
              <div className="flex flex-wrap gap-2 mb-3">
                {templateVariables.map(variable => (
                  <span
                    key={variable}
                    className="px-3 py-1 bg-blue-500/20 border border-blue-500/50 rounded-lg text-blue-300 font-mono text-sm"
                  >
                    {`{{${variable}}}`}
                  </span>
                ))}
              </div>
              <div className="mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                <p className="text-green-300 text-sm font-bold mb-1">✅ Como usar variáveis:</p>
                <p className="text-white/80 text-sm">
                  <strong>1.</strong> Gere o Excel com as variáveis acima<br/>
                  <strong>2.</strong> Preencha o Excel com seus dados<br/>
                  <strong>3.</strong> Anexe o arquivo preenchido novamente
                </p>
              </div>
            </div>
          ) : selectedTemplateIds.length > 0 ? (
            <div className="bg-yellow-900/30 border-2 border-yellow-500/30 rounded-xl p-4 mb-6">
              <p className="text-yellow-300 text-sm">
                ⚠️ Os templates selecionados não possuem variáveis. O Excel será gerado apenas com a coluna de Telefone.
              </p>
            </div>
          ) : (
            <div className="bg-gray-900/30 border-2 border-gray-500/30 rounded-xl p-4 mb-6">
              <p className="text-gray-300 text-sm">
                ℹ️ Selecione os templates primeiro para gerar um Excel personalizado com as variáveis necessárias.
              </p>
            </div>
          )}

          {/* Botão Baixar Modelo Excel Personalizado */}
          <div className="flex justify-center mb-6">
            <button
              onClick={generateExampleExcel}
              disabled={selectedTemplateIds.length === 0}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 disabled:from-gray-500 disabled:to-gray-600 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all shadow-lg hover:shadow-xl"
            >
              <FaUpload className="rotate-180" />
              {selectedTemplateIds.length > 0 
                ? `📊 Gerar Excel com ${templateVariables.length} Variável(is)`
                : '📊 Gerar Excel de Exemplo'
              }
            </button>
          </div>

          {/* Upload e Copiar/Colar */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Upload CSV/Excel */}
            <div className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
              contactsMethod === 'paste'
                ? 'border-white/10 bg-white/5 opacity-50 cursor-not-allowed'
                : 'border-orange-500/50 hover:border-orange-500 cursor-pointer bg-dark-700/30'
            }`}>
              <label className={`block ${contactsMethod === 'paste' ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                <div className="flex flex-col items-center gap-3">
                  <div className={`p-4 rounded-full ${
                    contactsMethod === 'paste' ? 'bg-white/10' : 'bg-green-500/20'
                  }`}>
                    <FaUpload className={`text-4xl ${
                      contactsMethod === 'paste' ? 'text-white/30' : 'text-green-400'
                    }`} />
                  </div>
                  <h3 className={`font-bold text-lg ${
                    contactsMethod === 'paste' ? 'text-white/30' : 'text-white'
                  }`}>
                    📁 Upload CSV/Excel
                  </h3>
                  <p className="text-white/60 text-sm">
                    {contactsMethod === 'paste' ? 'Desabilitado (limpe para usar)' : 'Clique para selecionar arquivo'}
                  </p>
                  {contactsMethod === 'upload' && (
                    <span className="mt-2 text-sm bg-green-500/30 text-green-200 px-4 py-2 rounded-lg font-bold">
                      ✓ Ativo
                    </span>
                  )}
                </div>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleUploadExcel}
                  disabled={contactsMethod === 'paste'}
                  className="hidden"
                />
              </label>
            </div>

            {/* Copiar e Colar */}
            <div className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
              contactsMethod === 'upload'
                ? 'border-white/10 bg-white/5 opacity-50 cursor-not-allowed'
                : 'border-purple-500/50 bg-dark-700/30'
            }`}>
              <div className="flex flex-col items-center gap-3">
                <div className={`p-4 rounded-full ${
                  contactsMethod === 'upload' ? 'bg-white/10' : 'bg-purple-500/20'
                }`}>
                  <FaUpload className={`text-4xl rotate-180 ${
                    contactsMethod === 'upload' ? 'text-white/30' : 'text-purple-400'
                  }`} />
                </div>
                <h3 className={`font-bold text-lg ${
                  contactsMethod === 'upload' ? 'text-white/30' : 'text-white'
                }`}>
                  📋 Copiar e Colar
                </h3>
                <p className="text-white/60 text-sm">
                  {contactsMethod === 'upload' ? 'Desabilitado (limpe para usar)' : 'Use a área abaixo'}
                </p>
                {contactsMethod === 'paste' && (
                  <span className="mt-2 text-sm bg-purple-500/30 text-purple-200 px-4 py-2 rounded-lg font-bold">
                    ✓ Ativo
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Textarea para colar */}
          <div>
            <label className="block text-white/70 mb-2 text-sm">
              Cole aqui (um por linha):
            </label>
            
            {/* Aviso importante sobre copiar/colar */}
            {templateVariables.length > 0 && (
              <div className="mb-3 p-3 bg-yellow-500/10 border-2 border-yellow-500/30 rounded-lg">
                <p className="text-yellow-300 text-sm font-bold mb-1">⚠️ ATENÇÃO - Copiar/Colar:</p>
                <p className="text-white/80 text-sm">
                  Esta opção aceita <strong>APENAS TELEFONE</strong> (um por linha).<br/>
                  <strong>Variáveis não são aceitas aqui</strong> pois precisamos do nome das colunas para mapear corretamente.
                </p>
                <p className="text-white/80 text-sm mt-2">
                  <strong>💡 Para usar variáveis:</strong> Gere o Excel acima, preencha e anexe o arquivo.
                </p>
              </div>
            )}
            
            <textarea
              className={`w-full px-4 py-3 bg-dark-700/80 border-2 rounded-xl text-white h-48 font-mono text-sm focus:outline-none transition-all ${
                contactsMethod === 'upload'
                  ? 'border-white/10 opacity-50 cursor-not-allowed'
                  : 'border-white/20 focus:border-purple-500'
              }`}
              placeholder={
                contactsMethod === 'upload'
                  ? 'Desabilitado (arquivo enviado - limpe para usar)'
                  : templateVariables.length > 0
                    ? '551199887766\n552198877665\n5531777665544\n...\n\n⚠️ Apenas telefones (um por linha)'
                    : '551199887766\n552198877665\n5531777665544\n...'
              }
              value={contactsInput}
              onChange={(e) => handleContactsChange(e.target.value)}
              disabled={contactsMethod === 'upload'}
              readOnly={contactsMethod === 'upload'}
            />
            <p className="text-white/50 text-xs mt-2">
              {templateVariables.length > 0 
                ? '⚠️ Formato: Apenas números de telefone, um por linha (sem variáveis)'
                : 'Formato: Um telefone por linha'
              }
            </p>
          </div>

          {/* Contador de contatos */}
          {contacts.length > 0 && (
            <div className="mt-4 space-y-3">
              <div className="p-4 bg-green-500/10 border-2 border-green-500/30 rounded-xl">
                <p className="text-green-300 font-bold text-center">
                  ✅ {contacts.length} contato(s) prontos para envio
                </p>
              </div>
              
              {/* Botão Limpar Contatos */}
              <button
                onClick={() => {
                  setContacts([]);
                  setContactsInput('');
                  setContactsMethod('none');
                  toast.success('Contatos limpos!');
                }}
                className="w-full px-4 py-3 bg-red-500/20 hover:bg-red-500/30 border-2 border-red-500/50 text-red-300 font-bold rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <FaTrash />
                Limpar Contatos
              </button>
            </div>
          )}
        </div>

        {/* HORÁRIO DE FUNCIONAMENTO */}
        <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-8 mb-6">
          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <div className="bg-green-500 text-white font-black text-xl rounded-lg w-12 h-12 flex items-center justify-center">
              4
            </div>
            <div>
              <h2 className="text-2xl font-black text-white">Horário de Funcionamento</h2>
              <p className="text-white/60 text-sm">Configure quando o sistema deve enviar mensagens</p>
            </div>
          </div>

          {/* Como funciona */}
          <div className="bg-blue-900/30 border-2 border-blue-500/30 rounded-xl p-4 mb-6">
            <h3 className="text-white font-bold mb-3 flex items-center gap-2">
              💡 Como funciona:
            </h3>
            <ul className="space-y-2 text-white/80 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-white/60">•</span>
                <span>Sistema envia mensagens <strong>APENAS</strong> no horário configurado</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-white/60">•</span>
                <span>Passou do horário? → <strong className="text-yellow-400">PAUSA automática</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-white/60">•</span>
                <span>Chegou o horário novamente? → <strong className="text-green-400">RETOMA automática</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-white/60">•</span>
                <span>Continua nos próximos dias até enviar para <strong>TODOS</strong> os contatos</span>
              </li>
            </ul>
          </div>

          {/* Agendamento do Início */}
          <div className="bg-dark-700/50 border-2 border-purple-500/30 rounded-xl p-6 mb-6">
            <h3 className="text-white font-bold mb-4 flex items-center gap-2">
              📅 Agendamento do Início (Opcional)
            </h3>
            <p className="text-white/60 text-sm mb-4">
              Defina quando a campanha deve começar. Deixe em branco para iniciar imediatamente.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-white/70 mb-2 text-sm">Data de início</label>
                <input
                  type="date"
                  className="w-full px-4 py-3 bg-dark-600 border-2 border-white/20 rounded-xl text-white focus:border-purple-500 focus:outline-none"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-white/70 mb-2 text-sm">Hora de início</label>
                <input
                  type="time"
                  className="w-full px-4 py-3 bg-dark-600 border-2 border-white/20 rounded-xl text-white focus:border-purple-500 focus:outline-none"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                />
              </div>
            </div>

            {/* Aviso de agendamento */}
            {scheduleDate && scheduleTime ? (
              <div className="mt-4 p-3 bg-green-500/10 border-2 border-green-500/30 rounded-lg">
                <p className="text-green-300 text-sm font-bold">
                  ✅ Campanha agendada para {new Date(`${scheduleDate}T${scheduleTime}`).toLocaleString('pt-BR')}
                </p>
              </div>
            ) : (
              <div className="mt-4 p-3 bg-yellow-500/10 border-2 border-yellow-500/30 rounded-lg">
                <p className="text-yellow-300 text-sm font-bold">
                  ⚠️ Campanha iniciará IMEDIATAMENTE após criação
                </p>
              </div>
            )}
          </div>

          {/* Horário de Trabalho Diário */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-dark-700/50 border-2 border-green-500/30 rounded-xl p-6">
              <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                🟢 Horário de Trabalho Diário
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-white/70 mb-2 text-sm">Iniciar às</label>
                  <input
                    type="time"
                    className="w-full px-4 py-3 bg-dark-600 border-2 border-white/20 rounded-xl text-white focus:border-green-500 focus:outline-none"
                    value={workStartTime}
                    onChange={(e) => setWorkStartTime(e.target.value)}
                  />
                </div>
                
                <div>
                  <label className="block text-white/70 mb-2 text-sm">Pausar às</label>
                  <input
                    type="time"
                    className="w-full px-4 py-3 bg-dark-600 border-2 border-white/20 rounded-xl text-white focus:border-green-500 focus:outline-none"
                    value={workEndTime}
                    onChange={(e) => setWorkEndTime(e.target.value)}
                  />
                </div>
              </div>

              <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <p className="text-blue-300 text-xs">
                  📌 Exemplo: 08:00 às 20:00 = Envia das 8h às 20h todos os dias
                </p>
              </div>
            </div>

            {/* Controles */}
            <div className="bg-dark-700/50 border-2 border-orange-500/30 rounded-xl p-6">
              <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                ⚙️ Controles
              </h3>
              
              <div>
                <label className="block text-white/70 mb-2 text-sm">Intervalo entre envios (segundos)</label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  className="w-full px-4 py-3 bg-dark-600 border-2 border-white/20 rounded-xl text-white focus:border-orange-500 focus:outline-none text-center text-2xl font-bold"
                  value={intervalSeconds}
                  onChange={(e) => setIntervalSeconds(e.target.value)}
                />
                <p className="text-white/50 text-xs mt-2 text-center">
                  ⏱️ Aguardar 5s entre cada mensagem
                </p>
              </div>

              <div className="mt-6 space-y-3">
                <div>
                  <label className="block text-white/70 mb-2 text-sm">Pausar após (mensagens)</label>
                  <input
                    type="number"
                    min="0"
                    className="w-full px-4 py-3 bg-dark-600 border-2 border-white/20 rounded-xl text-white focus:border-orange-500 focus:outline-none"
                    value={pauseAfter}
                    onChange={(e) => setPauseAfter(e.target.value)}
                    placeholder="0 = desabilitado"
                  />
                </div>
                
                <div>
                  <label className="block text-white/70 mb-2 text-sm">Duração da pausa (minutos)</label>
                  <input
                    type="number"
                    min="1"
                    className="w-full px-4 py-3 bg-dark-600 border-2 border-white/20 rounded-xl text-white focus:border-orange-500 focus:outline-none"
                    value={pauseDuration}
                    onChange={(e) => setPauseDuration(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* BOTÕES DE AÇÃO */}
        <div className="flex gap-4">
          <button
            onClick={() => router.back()}
            className="flex-1 px-8 py-4 bg-dark-700 hover:bg-dark-600 text-white font-bold rounded-xl transition-all text-lg"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 px-8 py-4 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white font-bold rounded-xl transition-all text-lg flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>🔄 Criando...</>
            ) : (
              <>
                <FaRocket /> Criar Campanha
              </>
            )}
          </button>
        </div>
      </div>

      {/* ⚠️ MODAL DE AVISO AO GERAR EXCEL */}
      {showExcelWarning && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border-2 border-yellow-500/50 rounded-2xl p-8 max-w-2xl w-full">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-3xl font-black text-white flex items-center gap-3">
                <FaExclamationTriangle className="text-yellow-400" />
                ⚠️ Atenção ao Gerar Excel
              </h2>
              <button
                onClick={() => setShowExcelWarning(false)}
                className="text-white/60 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>

            <div className="mb-6 space-y-4">
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                <p className="text-yellow-300 font-bold mb-2">📋 IMPORTANTE:</p>
                <p className="text-white text-sm leading-relaxed">
                  O Excel será gerado com base nas variáveis dos templates <strong>atualmente selecionados</strong>.
                </p>
              </div>

              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                <p className="text-red-300 font-bold mb-2">🚫 NÃO FAÇA:</p>
                <ul className="text-white text-sm space-y-2 list-disc list-inside">
                  <li>Adicionar ou remover templates <strong>depois</strong> de gerar o Excel</li>
                  <li>Isso pode alterar as variáveis necessárias</li>
                  <li>O Excel gerado pode ficar desatualizado</li>
                </ul>
              </div>

              <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                <p className="text-green-300 font-bold mb-2">✅ FAÇA:</p>
                <ul className="text-white text-sm space-y-2 list-disc list-inside">
                  <li>Finalize a seleção de templates <strong>antes</strong> de gerar o Excel</li>
                  <li>Se precisar alterar templates, gere um novo Excel</li>
                  <li>Preencha o Excel com seus dados reais</li>
                </ul>
              </div>

              {templateVariables.length > 0 && (
                <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                  <p className="text-blue-300 font-bold mb-2">📊 Variáveis que serão incluídas:</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {templateVariables.map(variable => (
                      <span
                        key={variable}
                        className="px-3 py-1 bg-blue-500/20 border border-blue-500/50 rounded-lg text-blue-300 font-mono text-sm"
                      >
                        {`{{${variable}}}`}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setShowExcelWarning(false)}
                className="flex-1 px-6 py-3 bg-dark-700 hover:bg-dark-600 text-white font-bold rounded-xl transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={confirmGenerateExcel}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <FaCheck /> Entendi, Gerar Excel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🔤 MODAL DE MAPEAMENTO MANUAL DE VARIÁVEIS */}
      {showMappingModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border-2 border-primary-500/50 rounded-2xl p-8 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-3xl font-black text-white flex items-center gap-3">
                <FaExclamationTriangle className="text-yellow-400" />
                Mapear Variáveis do Template
              </h2>
              <button
                onClick={() => setShowMappingModal(false)}
                className="text-white/60 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>

            <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
              <p className="text-blue-300 text-sm">
                <strong>ℹ️ Instruções:</strong> Selecione qual coluna do CSV corresponde a cada variável do template.
                Se uma variável não tiver coluna correspondente, ela ficará vazia nas mensagens.
              </p>
            </div>

            <div className="space-y-4 mb-6">
              {templateVariables.map(variable => {
                const mappedColumn = variableMapping[variable];
                const isMapped = !!mappedColumn;
                
                return (
                  <div
                    key={variable}
                    className={`p-4 rounded-xl border-2 ${
                      isMapped
                        ? 'bg-green-500/10 border-green-500/50'
                        : 'bg-yellow-500/10 border-yellow-500/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-white font-bold text-lg">
                        {isMapped ? <FaCheck className="inline text-green-400 mr-2" /> : <FaExclamationTriangle className="inline text-yellow-400 mr-2" />}
                        {`{{${variable}}}`}
                      </label>
                      {isMapped && (
                        <span className="text-green-400 text-sm font-semibold">✓ Mapeada</span>
                      )}
                    </div>
                    <select
                      value={mappedColumn || ''}
                      onChange={(e) => {
                        setVariableMapping({
                          ...variableMapping,
                          [variable]: e.target.value || ''
                        });
                      }}
                      className="w-full px-4 py-3 bg-dark-700 border-2 border-white/20 rounded-xl text-white focus:border-primary-500 focus:outline-none"
                    >
                      <option value="">-- Selecione uma coluna --</option>
                      {csvColumns.map(col => (
                        <option key={col} value={col}>
                          {col}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setShowMappingModal(false)}
                className="flex-1 px-6 py-3 bg-dark-700 hover:bg-dark-600 text-white font-bold rounded-xl transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmMapping}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <FaCheck /> Confirmar Mapeamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Verificação de Restrições */}
      <RestrictionCheckModal
        isOpen={showRestrictionModal}
        onClose={() => setShowRestrictionModal(false)}
        result={restrictionCheckResult}
        totalTemplates={selectedTemplateIds.length}
        intervalSeconds={parseInt(intervalSeconds)}
        onExcludeRestricted={handleExcludeRestricted}
        onKeepAll={handleKeepAll}
      />
    </div>
  );
}

