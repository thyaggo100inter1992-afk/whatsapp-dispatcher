import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { 
  FaPaperPlane, FaTimes, FaSearch
} from 'react-icons/fa';
import api from '@/services/api';

// Configuração da URL base da API
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || '${API_BASE_URL}/api').replace(/\/api$/, '');
import TemplateVariablesModal from '@/components/TemplateVariablesModal';
import EmojiPickerButton from '@/components/EmojiPickerButton';
import { detectVariables } from '@/utils/templateVariables';
import { InstanceSelect } from '@/components/InstanceSelect';

interface UazInstance {
  id: number;
  name: string;
  session_name: string;
  phone_number?: string;
  profile_pic_url?: string | null;
  profile_name?: string | null;
  is_connected?: boolean;
  status: string;
  is_active?: boolean;
}

export default function EnviarTemplateUnico() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [instances, setInstances] = useState<UazInstance[]>([]);
  
  // Estado para templates
  const [templates, setTemplates] = useState<any[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<any[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  
  // Estado para template selecionado e variáveis
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({});
  const [showPreview, setShowPreview] = useState(false);
  
  // Estado para formulário de envio
  const [formData, setFormData] = useState({
    instance_id: '',
    number: ''
  });
  
  // Sistema de Notificações Toast
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null);
  
  // Sistema de rastreamento de templates enviados
  const [sentTemplates, setSentTemplates] = useState<Record<string, number>>({});
  const [hideSentTemplates, setHideSentTemplates] = useState(true);

  // Função auxiliar para normalizar URLs (evita duplicação)
  const normalizeMediaUrl = (url: string | undefined): string => {
    if (!url) return '';
    
    // Remove duplicações
    if (url.includes('${API_BASE_URL}${API_BASE_URL}')) {
      url = url.replace(/http:\/\/localhost:3001http:\/\/localhost:3001/g, '${API_BASE_URL}');
    }
    
    // Se já tem protocolo, retorna como está
    if (url.startsWith('http') || url.startsWith('data:') || url.startsWith('blob:')) {
      return url;
    }
    
    // Adiciona base URL
    return `${API_BASE_URL}${url}`;
  };

  // Carregar instâncias
  const loadInstances = async () => {
    try {
      const response = await api.get('/uaz/instances');
      if (response.data.success) {
        // Filtrar: Conectadas E Ativas (não pausadas/excluídas)
        const connectedInstances = response.data.data.filter(
          (inst: UazInstance) => 
            (inst.status === 'connected' || inst.status === 'open') && 
            inst.is_active === true
        );
        setInstances(connectedInstances);
        console.log('✅ Instâncias conectadas e ativas:', connectedInstances.length);
      }
    } catch (error) {
      console.error('Erro ao carregar instâncias:', error);
      showNotification('❌ Erro ao carregar instâncias', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Carregar templates
  const loadTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const response = await api.get('/qr-templates');
      if (response.data.success) {
        const loadedTemplates = response.data.data || [];
        setTemplates(loadedTemplates);
        setFilteredTemplates(loadedTemplates);
      }
    } catch (error) {
      console.error('Erro ao carregar templates:', error);
      showNotification('❌ Erro ao carregar templates', 'error');
      setTemplates([]);
      setFilteredTemplates([]);
    } finally {
      setLoadingTemplates(false);
    }
  };

  useEffect(() => {
    loadInstances();
    loadTemplates();
  }, []);

  // Filtrar templates
  useEffect(() => {
    let filtered = Array.isArray(templates) ? templates : [];

    // Filtro por tipo
    if (selectedType !== 'all') {
      filtered = filtered.filter(t => t.type === selectedType);
    }

    // Filtro por busca
    if (searchTerm) {
      filtered = filtered.filter(t =>
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.description && t.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (t.text_content && t.text_content.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Filtrar templates enviados (se checkbox marcado)
    if (hideSentTemplates) {
      filtered = filtered.filter(t => !isTemplateSent(t.name));
    }

    setFilteredTemplates(filtered);
  }, [searchTerm, selectedType, templates, hideSentTemplates, sentTemplates]);

  // Exibir notificação
  const showNotification = (message: string, type: 'success' | 'error' | 'warning' | 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3001);
  };

  // Marcar template como enviado
  const markTemplateAsSent = (templateName: string) => {
    setSentTemplates(prev => ({
      ...prev,
      [templateName]: (prev[templateName] || 0) + 1
    }));
  };

  // Verificar se template foi enviado
  const isTemplateSent = (templateName: string): boolean => {
    return sentTemplates[templateName] > 0;
  };

  // Obter contagem de envios
  const getSentCount = (templateName: string): number => {
    return sentTemplates[templateName] || 0;
  };

  // Limpar marcações
  const clearSentMarks = () => {
    setSentTemplates({});
  };

  // Substituir variáveis no texto (com ou sem espaços)
  const replaceVariables = (text: string, variables: Record<string, string>): string => {
    let result = text;
    Object.entries(variables).forEach(([varName, value]) => {
      // Aceitar espaços opcionais: {{nome}} ou {{ nome }} ou {{ nome}}
      const regex = new RegExp(`{{\\s*${varName}\\s*}}`, 'g');
      result = result.replace(regex, value || ''); // Usar string vazia se não houver valor
    });
    return result;
  };

  // Obter todas as variáveis preenchidas (automáticas + manuais) para a prévia
  const getAllFilledVariables = (): Record<string, string> => {
    const autoVars = getAutoFilledVariables();
    return { ...autoVars, ...templateVariables };
  };

  // Gerar valores automáticos para variáveis especiais
  const getAutoFilledVariables = (): Record<string, string> => {
    const now = new Date();
    
    // Saudação baseada no horário
    const hour = now.getHours();
    let saudacao = 'Olá';
    if (hour >= 6 && hour < 12) {
      saudacao = 'Bom dia';
    } else if (hour >= 12 && hour < 18) {
      saudacao = 'Boa tarde';
    } else {
      saudacao = 'Boa noite';
    }

    // Data formatada (DD/MM/YYYY)
    const data = now.toLocaleDateString('pt-BR');
    
    // Hora formatada (HH:MM)
    const hora = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    
    // Protocolo (timestamp + random)
    const protocolo = `${now.getTime()}${Math.floor(Math.random() * 1000)}`;

    return {
      'data': data,
      'hora': hora,
      'protocolo': protocolo,
      'saudacao': saudacao,
      'saudação': saudacao, // variação com acento
    };
  };

  // Verificar se uma variável deve ser preenchida automaticamente
  const isAutoFilledVariable = (varName: string): boolean => {
    const autoVars = ['data', 'hora', 'protocolo', 'saudacao', 'saudação'];
    return autoVars.includes(varName.toLowerCase());
  };

  // Obter o nome descritivo de uma variável (do mapeamento ou formatar o técnico)
  const getVariableDisplayName = (varName: string): string => {
    // Se existe mapeamento no template, usar ele
    if (selectedTemplate?.variables_map && selectedTemplate.variables_map[varName]) {
      return selectedTemplate.variables_map[varName];
    }
    
    // Caso contrário, formatar o nome técnico (ex: "nome_cliente" → "Nome Cliente")
    return varName
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Enviar template com variáveis preenchidas
  const handleSendTemplate = async () => {
    if (!formData.instance_id || !formData.number) {
      showNotification('⚠️ Selecione uma instância e informe o número', 'warning');
      return;
    }

    if (!selectedTemplate) {
      showNotification('⚠️ Selecione um template', 'warning');
      return;
    }

    // Verificar se todas as variáveis MANUAIS foram preenchidas (as automáticas já estão preenchidas)
    const variables = extractAllVariablesFromTemplate(selectedTemplate);
    const emptyVars = variables.filter(v => 
      !isAutoFilledVariable(v) && (!templateVariables[v] || templateVariables[v].trim() === '')
    );
    if (emptyVars.length > 0) {
      showNotification(`⚠️ Preencha as variáveis: ${emptyVars.join(', ')}`, 'warning');
      return;
    }

    // 🚨 VERIFICAR LISTA DE RESTRIÇÃO **ANTES** DE ENVIAR
    try {
      console.log('🔍 Verificando lista de restrição...');
      const restrictionCheck = await api.post('/restriction-lists/check-bulk', {
        phone_numbers: [formData.number],
        whatsapp_account_ids: [parseInt(formData.instance_id)]
      });

      if (restrictionCheck.data.restricted_count > 0) {
        const detail = restrictionCheck.data.restricted_details[0];
        const listNames = detail.list_names?.join(', ') || 'Lista de Restrição';
        
        console.log('🚫 Número bloqueado:', formData.number);
        console.log('   Listas:', listNames);
        
        showNotification(`🚫 Número bloqueado! Está na lista: ${listNames}`, 'error');
        return; // ❌ NÃO ENVIAR
      }
      
      console.log('✅ Número livre, prosseguindo com envio do template...');
    } catch (restrictionError: any) {
      console.error('❌ Erro ao verificar lista de restrição:', restrictionError);
      // Se der erro na verificação
      if (restrictionError.response?.status === 403) {
        const errorMsg = restrictionError.response?.data?.error || 'Número bloqueado na lista de restrição';
        showNotification(`🚫 ${errorMsg}`, 'error');
        return; // ❌ NÃO ENVIAR
      }
    }

    setSending(true);
    
    try {
      const instanceId = parseInt(formData.instance_id);
      
      // Substituir variáveis no texto
      const filledText = replaceVariables(selectedTemplate.text_content || '', templateVariables);
      
      // Determinar o tipo de envio baseado no template
      let endpoint = `/uaz/instances/${instanceId}/send-text`;
      let payload: any = {
        number: formData.number,
        text: filledText
      };

      // ✅ FIX: Verificar se é template de MÍDIA (image, video, audio, document)
      if (['image', 'video', 'audio', 'audio_recorded', 'document'].includes(selectedTemplate?.type)) {
        // Buscar o arquivo de mídia do template
        if (selectedTemplate.media_files && selectedTemplate.media_files.length > 0) {
          const media = selectedTemplate.media_files[0];
          
          // Construir URL completa da mídia
          let mediaUrl = media.url;
          if (!mediaUrl) {
            // Verificar se é de qr-templates ou media baseado no file_path
            if (media.file_path && media.file_path.includes('qr-templates')) {
              mediaUrl = `/uploads/qr-templates/${media.file_name}`;
            } else {
              mediaUrl = `/uploads/media/${media.file_name}`;
            }
          }
          
          if (!mediaUrl.startsWith('http')) {
            mediaUrl = `${API_BASE_URL}${mediaUrl}`;
          }
          
          console.log(`📎 [ENVIO] Enviando ${selectedTemplate.type} com mídia:`, mediaUrl);
          
          // Configurar endpoint e payload baseado no tipo
          switch (selectedTemplate.type) {
            case 'image':
              endpoint = `/uaz/instances/${instanceId}/send-image`;
              payload = {
                number: formData.number,
                image: mediaUrl,
                caption: filledText || ''
              };
              break;
            
            case 'video':
              endpoint = `/uaz/instances/${instanceId}/send-video`;
              payload = {
                number: formData.number,
                video: mediaUrl,
                caption: filledText || ''
              };
              break;
            
            case 'audio':
            case 'audio_recorded':
              endpoint = `/uaz/instances/${instanceId}/send-audio`;
              payload = {
                number: formData.number,
                audio: mediaUrl
              };
              break;
            
            case 'document':
              endpoint = `/uaz/instances/${instanceId}/send-document`;
              payload = {
                number: formData.number,
                document: mediaUrl,
                filename: media.original_name || media.file_name || 'documento.pdf',
                caption: filledText || ''
              };
              break;
          }
        } else {
          showNotification(`❌ Template de ${selectedTemplate.type} não possui arquivo de mídia!`, 'error');
          setSending(false);
          return;
        }
      }
      // Usar a mesma lógica de envio da função handleSendDirectFromTemplate
      else if (selectedTemplate?.type === 'buttons' && selectedTemplate?.buttons_config) {
        let config = selectedTemplate.buttons_config;
        if (typeof config === 'string') config = JSON.parse(config);
        
        if (config?.buttons && Array.isArray(config.buttons)) {
          endpoint = `/uaz/instances/${instanceId}/send-menu`;
          
          const formattedChoices = config.buttons.map((btn: any) => {
            let choice = btn.text;
            
            switch (btn.type) {
              case 'URL':
                choice += `|${btn.url || ''}`;
                break;
              case 'CALL':
                choice += `|call:${btn.phone_number || ''}`;
                break;
              case 'COPY':
                choice += `|copy:${btn.copy_code || ''}`;
                break;
              case 'REPLY':
              default:
                choice += `|${btn.id || btn.text}`;
                break;
            }
            
            return choice;
          });
          
          payload = {
            number: formData.number,
            type: 'button',
            text: filledText,
            choices: formattedChoices
          };
          
          if (config.footerText) {
            payload.footerText = config.footerText;
          }
        }
      }
      else if (selectedTemplate?.type === 'list' && selectedTemplate?.list_config) {
        let config = selectedTemplate.list_config;
        if (typeof config === 'string') config = JSON.parse(config);
        
        if (config?.sections && Array.isArray(config.sections)) {
          endpoint = `/uaz/instances/${instanceId}/send-menu`;
          
          const choices: string[] = [];
          config.sections.forEach((section: any) => {
            choices.push(`[${section.title}]`);
            section.rows?.forEach((row: any) => {
              choices.push(`${row.title}|${row.id}|${row.description || ''}`);
            });
          });
          
          payload = {
            number: formData.number,
            type: 'list',
            text: filledText,
            choices: choices,
            listButton: config.buttonText || 'Ver Opções'
          };
        }
      }
      else if (selectedTemplate?.type === 'poll' && selectedTemplate?.poll_config) {
        let config = selectedTemplate.poll_config;
        if (typeof config === 'string') config = JSON.parse(config);
        
        if (config?.options && Array.isArray(config.options)) {
          endpoint = `/uaz/instances/${instanceId}/send-menu`;
          payload = {
            number: formData.number,
            type: 'poll',
            text: filledText,
            choices: config.options,
            selectableCount: config.selectableCount || 1
          };
        }
      }
      else if (selectedTemplate?.type === 'combined' && selectedTemplate?.combined_blocks) {
        // Mensagem Combinada - ENVIAR DIRETAMENTE
        let blocks = selectedTemplate.combined_blocks;
        if (typeof blocks === 'string') blocks = JSON.parse(blocks);
        
        const blocksArray = blocks.blocks || [];
        
        console.log('📦 Enviando Mensagem Combinada com', blocksArray.length, 'blocos');
        
        let successCount = 0;
        let errorCount = 0;
        
        // Enviar cada bloco sequencialmente
        for (let i = 0; i < blocksArray.length; i++) {
          const block = blocksArray[i];
          
          try {
            // Aguardar 2 segundos entre blocos (exceto no primeiro)
            if (i > 0) {
              console.log(`⏳ Aguardando 2s antes de enviar bloco ${i + 1}...`);
              showNotification(`⏳ Aguardando 2s antes de enviar bloco ${i + 1}/${blocksArray.length}...`, 'info');
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
            
            console.log(`📤 Enviando bloco ${i + 1}/${blocksArray.length}:`, block.type);
            
            // Substituir variáveis no texto do bloco
            const blockText = replaceVariables(block.text || '', templateVariables);
            
            let blockEndpoint = '';
            let blockPayload: any = { 
              number: formData.number,
              variables: templateVariables
            };
            
            // Processar cada tipo de bloco
            switch (block.type) {
              case 'text':
                blockEndpoint = `/uaz/instances/${instanceId}/send-text`;
                blockPayload.text = blockText;
                break;
                
              case 'image':
              case 'video':
              case 'document':
                const mediaField = block.type === 'image' ? 'image' : block.type === 'video' ? 'video' : 'document';
                blockEndpoint = `/uaz/instances/${instanceId}/send-${block.type}`;
                blockPayload[mediaField] = normalizeMediaUrl(block.media?.url);
                blockPayload.caption = blockText;
                break;
                
              case 'audio':
                blockEndpoint = `/uaz/instances/${instanceId}/send-audio`;
                blockPayload.audio = normalizeMediaUrl(block.media?.url);
                break;
                
              case 'button':
                blockEndpoint = `/uaz/instances/${instanceId}/send-menu`;
                blockPayload.type = 'button';
                blockPayload.text = blockText;
                blockPayload.choices = (block.buttons || []).map((btn: any) => {
                  let choice = btn.text;
                  switch (btn.type) {
                    case 'URL': choice += `|${btn.url || ''}`; break;
                    case 'CALL': choice += `|call:${btn.phone_number || ''}`; break;
                    case 'COPY': choice += `|copy:${btn.copy_code || ''}`; break;
                    default: choice += `|${btn.id || btn.text}`; break;
                  }
                  return choice;
                });
                if (block.footerText) blockPayload.footerText = block.footerText;
                break;
                
              case 'list':
                blockEndpoint = `/uaz/instances/${instanceId}/send-menu`;
                blockPayload.type = 'list';
                blockPayload.text = blockText;
                const listChoices: string[] = [];
                (block.choices || []).forEach((section: any) => {
                  if (section.startsWith('[')) {
                    listChoices.push(section);
                  } else {
                    listChoices.push(section);
                  }
                });
                blockPayload.choices = listChoices;
                blockPayload.listButton = block.listButton || 'Ver Opções';
                break;
                
              case 'poll':
                blockEndpoint = `/uaz/instances/${instanceId}/send-menu`;
                blockPayload.type = 'poll';
                blockPayload.text = blockText;
                blockPayload.choices = block.choices || [];
                blockPayload.selectableCount = block.selectableCount || 1;
                break;
                
              case 'carousel':
                blockEndpoint = `/uaz/instances/${instanceId}/send-carousel`;
                blockPayload.text = blockText;
                blockPayload.cards = (block.cards || []).map((card: any) => ({
                  ...card,
                  text: replaceVariables(card.text || '', templateVariables),
                  image: normalizeMediaUrl(card.image),
                  buttons: card.buttons || []
                }));
                break;
                
              default:
                console.warn(`⚠️ Tipo de bloco desconhecido: ${block.type}`);
                continue;
            }
            
            // Enviar bloco
            const blockResponse = await api.post(blockEndpoint, blockPayload);
            
            if (blockResponse.data.success) {
              console.log(`✅ Bloco ${i + 1} enviado com sucesso`);
              successCount++;
            } else {
              console.error(`❌ Erro ao enviar bloco ${i + 1}:`, blockResponse.data.error);
              errorCount++;
            }
            
          } catch (blockError: any) {
            console.error(`❌ Erro ao enviar bloco ${i + 1}:`, blockError);
            errorCount++;
          }
        }
        
        // Resultado final
        if (successCount === blocksArray.length) {
          showNotification(`✅ Mensagem Combinada enviada com sucesso! (${successCount} blocos)`, 'success');
          
          // Registrar envio
          const templateId = selectedTemplate.id?.toString() || selectedTemplate.name;
          setSentTemplates(prev => ({ ...prev, [templateId]: (prev[templateId] || 0) + 1 }));
        } else if (successCount > 0) {
          showNotification(`⚠️ Mensagem enviada parcialmente (${successCount}/${blocksArray.length} blocos). ${errorCount} erro(s).`, 'warning');
        } else {
          showNotification(`❌ Erro ao enviar mensagem combinada. Todos os blocos falharam.`, 'error');
        }
        
        setSending(false);
        return;
      }
      else if (selectedTemplate?.type === 'carousel' && selectedTemplate?.carousel_config) {
        let config = selectedTemplate.carousel_config;
        if (typeof config === 'string') config = JSON.parse(config);
        
        if (config?.cards && Array.isArray(config.cards)) {
          endpoint = `/uaz/instances/${instanceId}/send-carousel`;
          
          const formattedCards = config.cards.map((card: any) => {
            let imageUrl = card.image;
            if (imageUrl && !imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
              imageUrl = `${API_BASE_URL}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
            }
            
            return {
              text: card.text || '',
              image: imageUrl || '',
              buttons: (card.buttons || []).map((btn: any) => {
                const button: any = {
                  text: btn.text || '',
                  type: btn.type || 'REPLY'
                };
                
                if (btn.type === 'URL') {
                  button.url = btn.url || '';
                } else if (btn.type === 'CALL') {
                  button.phone_number = btn.phone_number || '';
                } else if (btn.type === 'COPY') {
                  button.copy_code = btn.copy_code || '';
                } else {
                  button.id = btn.id || btn.text || '';
                }
                
                return button;
              })
            };
          });
          
          payload = {
            number: formData.number,
            text: filledText,
            cards: formattedCards
          };
        }
      }

      console.log('📤 Enviando:', { endpoint, payload });

      const response = await api.post(endpoint, payload);
      
      if (response.data.success) {
        showNotification('✅ Template enviado com sucesso!', 'success');
        
        // Marcar template como enviado
        markTemplateAsSent(selectedTemplate.name);
        
        // Limpar campos
        setFormData({ ...formData, number: '' });
        setSelectedTemplate(null);
        setTemplateVariables({});
      }
    } catch (error: any) {
      console.error('Erro ao enviar:', error);
      showNotification(
        `❌ Erro: ${error.response?.data?.error || error.message}`,
        'error'
      );
    } finally {
      setSending(false);
    }
  };

  // Extrair todas as variáveis de um template (incluindo COMBINED)
  const extractAllVariablesFromTemplate = (template: any): string[] => {
    let allVariables: string[] = [];
    
    // 1. Extrair do text_content principal
    if (template.text_content) {
      allVariables = [...allVariables, ...detectVariables(template.text_content)];
    }
    
    // 2. Se for COMBINED, extrair de todos os blocos
    if (template.type === 'combined' && template.combined_blocks) {
      let blocks = template.combined_blocks;
      
      // Se combined_blocks for string JSON, fazer parse
      if (typeof blocks === 'string') {
        try {
          blocks = JSON.parse(blocks);
        } catch (e) {
          console.error('❌ Erro ao fazer parse de combined_blocks:', e);
          blocks = { blocks: [] };
        }
      }
      
      // Extrair variáveis de cada bloco
      const blocksArray = blocks.blocks || [];
      blocksArray.forEach((block: any) => {
        if (block.text) {
          allVariables = [...allVariables, ...detectVariables(block.text)];
        }
      });
    }
    
    // 3. Se for CAROUSEL, extrair de todos os cards
    if (template.type === 'carousel' && template.carousel_config) {
      let config = template.carousel_config;
      if (typeof config === 'string') config = JSON.parse(config);
      
      config.cards?.forEach((card: any) => {
        if (card.text) {
          allVariables = [...allVariables, ...detectVariables(card.text)];
        }
      });
    }
    
    // Remover duplicatas
    return Array.from(new Set(allVariables));
  };

  // Carregar template selecionado
  const handleSelectTemplate = async (templateId: number) => {
    try {
      const response = await api.get(`/qr-templates/${templateId}`);
      console.log('📋 Resposta da API para template:', response.data);
      
      if (response.data.success && response.data.data) {
        const template = response.data.data;
        
        // Definir template selecionado
        setSelectedTemplate(template);
        
        // Extrair TODAS as variáveis do template (incluindo de blocos COMBINED)
        const variables = extractAllVariablesFromTemplate(template);
        console.log('🔍 Variáveis detectadas:', variables);
        
        // Obter variáveis que são auto-preenchidas
        const autoFilled = getAutoFilledVariables();
        
        // Inicializar valores das variáveis
        const initialVariables: Record<string, string> = {};
        variables.forEach(varName => {
          // Se é variável automática, preencher com valor gerado
          if (isAutoFilledVariable(varName)) {
            initialVariables[varName] = autoFilled[varName.toLowerCase()] || '';
          } else {
            // Variável manual, iniciar vazia
            initialVariables[varName] = '';
          }
        });
        setTemplateVariables(initialVariables);
        
        showNotification(`✅ Template "${template.name}" selecionado`, 'success');
      } else {
        showNotification('❌ Template não encontrado ou inválido', 'error');
      }
    } catch (error: any) {
      console.error('Erro ao carregar template:', error);
      showNotification(
        `❌ Erro ao carregar template: ${error.response?.data?.error || error.message}`,
        'error'
      );
    }
  };



  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-20 w-20 border-b-4 border-purple-500 mb-4"></div>
          <p className="text-2xl text-white/70">Carregando...</p>
        </div>
      </div>
    );
  }

  // Função para obter o nome do tipo de template
  const getTemplateTypeName = (type: string): string => {
    const typeNames: Record<string, string> = {
      'text': 'Texto',
      'image': 'Imagem',
      'video': 'Vídeo',
      'audio': 'Áudio',
      'audio_recorded': 'Áudio Gravado',
      'document': 'Documento',
      'buttons': 'Botões',
      'button': 'Botões',
      'list': 'Lista',
      'poll': 'Enquete',
      'carousel': 'Carrossel',
      'combined': 'Mensagem Combinada',
    };
    return typeNames[type] || type;
  };

  return (
    <div className="animate-fade-in max-w-[1600px] mx-auto px-4">
      {/* NOTIFICAÇÃO TOAST */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-xl shadow-2xl border-2 animate-slideInRight ${
          notification.type === 'success' ? 'bg-green-500/90 border-green-400' :
          notification.type === 'error' ? 'bg-red-500/90 border-red-400' :
          notification.type === 'warning' ? 'bg-yellow-500/90 border-yellow-400' :
          'bg-blue-500/90 border-blue-400'
        }`}>
          <p className="text-white font-bold">{notification.message}</p>
        </div>
      )}

      {/* CABEÇALHO */}
      <div className="card mb-6 bg-gradient-to-r from-blue-600/20 to-blue-700/20 border-blue-500/30">
        <div className="flex items-center gap-6 mb-4">
          <div className="bg-blue-500 p-5 rounded-2xl">
            <FaPaperPlane className="text-white text-5xl" />
          </div>
          <div>
            <h1 className="text-5xl font-black text-white">
              Envio Único com Template
            </h1>
          </div>
        </div>
        <p className="text-white/70 text-xl">
          Envie mensagens individuais instantaneamente usando seus templates
        </p>
      </div>

      {/* LAYOUT EM 2 COLUNAS */}
      <div className="grid grid-cols-1 lg:grid-cols-[500px_1fr] gap-8">
        
        {/* COLUNA ESQUERDA - Informações Básicas */}
        <div className="card">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-3 text-white">
            📱 Informações Básicas
          </h2>
          
          <div className="grid md:grid-cols-1 gap-6">
            {/* Número de Origem */}
            <div>
              <label className="block text-base font-semibold mb-3 text-white">
                Número de Origem *
              </label>
              <InstanceSelect
                instances={instances}
                value={formData.instance_id}
                onChange={(value) => setFormData({ ...formData, instance_id: value })}
                placeholder="Selecione..."
                required
              />
            </div>

            {/* Número do Destinatário */}
            <div>
              <label className="block text-base font-semibold mb-3 text-white">
                Número do Destinatário *
              </label>
              <input
                type="text"
                value={formData.number}
                onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                placeholder="Ex: 5562912345678"
                className="input text-base"
                required
              />
              <p className="text-sm text-white/50 mt-2">
                💡 Formato: Código do país + DDD + número (sem espaços ou símbolos)
              </p>
            </div>
          </div>

          {/* Variáveis do Template - Só aparece se template selecionado tiver variáveis MANUAIS */}
          {selectedTemplate && Object.keys(templateVariables).filter(v => !isAutoFilledVariable(v)).length > 0 && (
            <div className="mt-8 pt-8 border-t border-white/10">
              <h3 className="text-xl font-bold mb-4 text-white flex items-center gap-2">
                📝 Variáveis do Template
              </h3>
              <p className="text-sm text-white/70 mb-4">
                Template selecionado: <span className="text-blue-400 font-semibold">{selectedTemplate.name}</span>
              </p>
              <div className="space-y-4">
                {Object.keys(templateVariables)
                  .filter(varName => !isAutoFilledVariable(varName)) // Filtrar variáveis automáticas
                  .map(varName => (
                    <div key={varName}>
                      <label className="block text-base font-semibold mb-2 text-white">
                        {getVariableDisplayName(varName)} *
                      </label>
                      <input
                        type="text"
                        value={templateVariables[varName]}
                        onChange={(e) => setTemplateVariables({ ...templateVariables, [varName]: e.target.value })}
                        placeholder={`Digite ${getVariableDisplayName(varName).toLowerCase()}`}
                        className="input text-base w-full"
                        required
                      />
                    </div>
                  ))}
              </div>
              
              {/* Informação sobre variáveis automáticas */}
              {Object.keys(templateVariables).filter(v => isAutoFilledVariable(v)).length > 0 && (
                <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <p className="text-sm text-blue-300">
                    ℹ️ <strong>Preenchimento automático:</strong> {Object.keys(templateVariables).filter(v => isAutoFilledVariable(v)).join(', ')}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Botões de Ação */}
          <div className="mt-8 space-y-3">
            {/* Botão Ver Prévia */}
            {selectedTemplate && (
              <button
                type="button"
                onClick={() => setShowPreview(true)}
                className="btn w-full text-lg py-4 font-bold bg-white/10 hover:bg-white/20 border-white/20 text-white"
              >
                👁️ Ver Prévia
              </button>
            )}

            {/* Botão Enviar Agora */}
            <button
              type="button"
              onClick={handleSendTemplate}
              disabled={sending || !formData.instance_id || !formData.number || !selectedTemplate}
              className="btn btn-primary w-full text-lg py-4 font-bold"
            >
              {sending ? (
                <>🔄 Enviando...</>
              ) : (
                <>
                  🚀 Enviar Agora
                </>
              )}
            </button>
          </div>
        </div>

        {/* COLUNA DIREITA - Selecionar Template */}
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold flex items-center gap-3 text-white">
              📝 Selecionar Template
            </h2>
            
            {/* Botão Limpar marcações */}
            {Object.keys(sentTemplates).length > 0 && (
              <button
                onClick={clearSentMarks}
                className="btn btn-sm bg-blue-600 hover:bg-blue-700 border-blue-500 text-white"
              >
                🗑️ Limpar ({Object.keys(sentTemplates).length})
              </button>
            )}
          </div>

          {/* Checkbox Ocultar Enviados - Só aparece após enviar mensagem */}
          {Object.keys(sentTemplates).length > 0 && (
            <div className="mb-4">
              <label className="flex items-center gap-3 text-base text-white cursor-pointer hover:text-blue-400 transition-colors">
                <input
                  type="checkbox"
                  checked={hideSentTemplates}
                  onChange={(e) => setHideSentTemplates(e.target.checked)}
                  className="w-5 h-5 rounded border-2 border-white/20 bg-white/5 checked:bg-blue-600 checked:border-blue-500 cursor-pointer"
                />
                <span>⭕ Ocultar templates enviados ({Object.keys(sentTemplates).length})</span>
              </label>
            </div>
          )}

          {/* Filtros */}
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-base font-medium mb-3 text-white">
                <FaSearch className="inline mr-2" />
                Buscar template...
              </label>
              <input
                type="text"
                className="input text-base"
                placeholder="Digite para buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-base font-medium mb-3 text-white">
                <FaTimes className="inline mr-2" />
                Excluir que contenham...
              </label>
              <input
                type="text"
                className="input text-base"
                placeholder="Digite para excluir..."
              />
            </div>
          </div>

          {/* Lista de Templates */}
          {loadingTemplates ? (
            <div className="text-center py-12">
              <div className="animate-spin text-4xl mb-4">⏳</div>
              <p className="text-white/60">Carregando templates...</p>
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="text-center py-12 text-white/50">
              {templates.length === 0 
                ? 'Nenhum template disponível. Configure seus templates na plataforma.' 
                : 'Nenhum template encontrado com os filtros aplicados.'}
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4 max-h-[600px] overflow-y-auto pr-2">
              {filteredTemplates.map((template, index) => {
                const isSelected = selectedTemplate?.id === template.id;
                return (
                <div
                  key={index}
                  onClick={() => handleSelectTemplate(template.id)}
                  className={`p-5 rounded-xl border-2 cursor-pointer transition-all ${
                    isSelected 
                      ? 'border-green-500 bg-green-500/10 shadow-xl shadow-green-500/20' 
                      : 'border-white/10 bg-white/5 hover:border-primary-500/50 hover:shadow-xl'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`${
                      isSelected 
                        ? 'bg-green-500/20' 
                        : isTemplateSent(template.name) 
                          ? 'bg-green-500/20' 
                          : 'bg-primary-500/20'
                    } p-4 rounded-full flex-shrink-0 relative`}>
                      <FaPaperPlane className={`${
                        isSelected 
                          ? 'text-green-400' 
                          : isTemplateSent(template.name) 
                            ? 'text-green-400' 
                            : 'text-primary-400'
                      } text-2xl`} />
                      {(isSelected || isTemplateSent(template.name)) && (
                        <div className="absolute -top-1 -right-1 bg-green-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold">
                          ✓
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-bold text-lg text-white">{template.name}</h3>
                        {isTemplateSent(template.name) && getSentCount(template.name) > 0 && (
                          <span className="badge bg-green-600 border-green-500 text-white text-xs font-bold">
                            ✓ {getSentCount(template.name)}x
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2 mb-3 flex-wrap">
                        <span className="badge badge-info text-sm font-semibold">
                          {getTemplateTypeName(template.type)}
                        </span>
                        {isSelected && (
                          <span className="badge bg-green-600 border-green-500 text-white text-sm font-bold flex items-center gap-1">
                            ✓ Template selecionado
                          </span>
                        )}
                      </div>
                      
                      {template.text_content && (
                        <div className="p-3 bg-white/5 rounded-lg">
                          <p className="text-white/80 text-sm line-clamp-2">{template.text_content}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          )}

          {filteredTemplates.length > 0 && (
            <div className="mt-4 text-sm text-white/50 text-center">
              Mostrando {filteredTemplates.length} de {templates.length} templates
            </div>
          )}
        </div>
      </div>

      {/* MODAL DE PRÉVIA */}
      {showPreview && selectedTemplate && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowPreview(false)}>
          <div className="relative w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            {/* Botão Fechar */}
              <button
                onClick={() => setShowPreview(false)}
              className="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors z-10"
              >
              <div className="flex items-center gap-2 text-lg font-bold">
                <FaTimes className="text-2xl" />
                Fechar Preview
              </div>
              </button>

            {/* Simulação de Celular - Estilo iPhone */}
            <div className="relative bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 rounded-[3rem] p-3 shadow-2xl border-[14px] border-gray-900">
              {/* Notch (entalhe superior) */}
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 bg-black rounded-b-3xl h-7 w-48 z-10"></div>
              
              {/* Tela do WhatsApp */}
              <div className="bg-[#0b141a] rounded-[2.5rem] overflow-hidden flex flex-col" style={{ height: '700px' }}>
                {/* Header do WhatsApp */}
                <div className="bg-[#202c33] px-4 py-3 flex items-center gap-3 relative z-20">
                  <div className="w-10 h-10 bg-gray-500 rounded-full flex items-center justify-center text-white text-lg font-bold">
                    👤
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-semibold text-sm">Cliente</p>
                    <p className="text-gray-400 text-xs">online</p>
                  </div>
                  <div className="flex gap-4 text-gray-400">
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M15.5 1h-8A2.5 2.5 0 0 0 5 3.5v17A2.5 2.5 0 0 0 7.5 23h8a2.5 2.5 0 0 0 2.5-2.5v-17A2.5 2.5 0 0 0 15.5 1zm-4 21c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
                    </svg>
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                    </svg>
                  </div>
            </div>

                {/* Área de Mensagens com padrão do WhatsApp */}
                <div 
                  className="flex-1 p-3 overflow-y-auto"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                    backgroundColor: '#0b141a'
                  }}
                >
                  {/* MENSAGEM COMBINADA - Cada bloco como mensagem separada */}
                  {selectedTemplate.type === 'combined' && selectedTemplate.combined_blocks ? (() => {
                    let blocks = selectedTemplate.combined_blocks;
                    if (typeof blocks === 'string') {
                      try {
                        blocks = JSON.parse(blocks);
                      } catch (e) {
                        console.error('❌ Erro ao fazer parse de combined_blocks:', e);
                        blocks = { blocks: [] };
                      }
                    }
                    
                    const blocksArray = blocks.blocks || [];
                    
                    return (
                      <>
                        {blocksArray.map((block: any, blockIndex: number) => {
                          
                          // Parse de configurações se necessário
                          let buttonsConfig = block.buttons || [];
                          let choicesConfig = block.choices || [];
                          let cardsConfig = block.cards || [];
                          
                          return (
                            <div key={blockIndex} className="flex justify-end mb-3">
                              <div className="bg-[#005c4b] rounded-lg shadow-lg max-w-[85%] overflow-hidden">
                                
                                {/* BLOCO DE TEXTO SIMPLES */}
                                {block.type === 'text' && (
                                  <>
                                    <div className="p-3">
                                      <p className="text-white text-[15px] whitespace-pre-wrap break-words leading-relaxed">
                                        {replaceVariables(block.text || '', getAllFilledVariables())}
                                      </p>
                  </div>
                                    <div className="text-[11px] text-gray-300 px-3 pb-2 text-right flex items-center justify-end gap-1">
                                      <span>{new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                      <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 16 16">
                                        <path d="M12.354 4.354a.5.5 0 0 0-.708-.708L5 10.293 1.854 7.146a.5.5 0 1 0-.708.708l3.5 3.5a.5.5 0 0 0 .708 0l7-7zm-4.208 7-.896-.897.707-.707.543.543 6.646-6.647a.5.5 0 0 1 .708.708l-7 7a.5.5 0 0 1-.708 0z"/>
                                      </svg>
                  </div>
                                  </>
                                )}
                                
                                {/* BLOCO DE IMAGEM */}
                                {block.type === 'image' && (
                                  <>
                                    {block.media && block.media.url && (
                                      <img 
                                        src={normalizeMediaUrl(block.media.url)} 
                                        alt="Imagem" 
                                        className="w-full object-cover max-h-96"
                                      />
                                    )}
                                    {block.text && block.text.trim() !== '' && (
                                      <div className="p-3 bg-[#005c4b]">
                                        <p className="text-white text-[15px] whitespace-pre-wrap break-words leading-relaxed">
                                          {replaceVariables(block.text, getAllFilledVariables())}
                                        </p>
                </div>
                                    )}
                                    <div className="text-[11px] text-gray-300 px-3 pb-2 text-right flex items-center justify-end gap-1 bg-[#005c4b]">
                                      <span>{new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                      <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 16 16">
                                        <path d="M12.354 4.354a.5.5 0 0 0-.708-.708L5 10.293 1.854 7.146a.5.5 0 1 0-.708.708l3.5 3.5a.5.5 0 0 0 .708 0l7-7zm-4.208 7-.896-.897.707-.707.543.543 6.646-6.647a.5.5 0 0 1 .708.708l-7 7a.5.5 0 0 1-.708 0z"/>
                                      </svg>
                                    </div>
                                  </>
                                )}
                                
                                {/* BLOCO DE VÍDEO */}
                                {block.type === 'video' && (
                                  <>
                                    {block.media && block.media.url && (
                                      <video 
                                        src={normalizeMediaUrl(block.media.url)} 
                                        className="w-full max-h-96" 
                                        controls
                                      />
                                    )}
                                    {block.text && block.text.trim() !== '' && (
                                      <div className="p-3 bg-[#005c4b]">
                                        <p className="text-white text-[15px] whitespace-pre-wrap break-words leading-relaxed">
                                          {replaceVariables(block.text, getAllFilledVariables())}
                                        </p>
                                      </div>
                                    )}
                                    <div className="text-[11px] text-gray-300 px-3 pb-2 text-right flex items-center justify-end gap-1 bg-[#005c4b]">
                                      <span>{new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                      <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 16 16">
                                        <path d="M12.354 4.354a.5.5 0 0 0-.708-.708L5 10.293 1.854 7.146a.5.5 0 1 0-.708.708l3.5 3.5a.5.5 0 0 0 .708 0l7-7zm-4.208 7-.896-.897.707-.707.543.543 6.646-6.647a.5.5 0 0 1 .708.708l-7 7a.5.5 0 0 1-.708 0z"/>
                                      </svg>
                                    </div>
                                  </>
                                )}
                                
                                {/* BLOCO DE DOCUMENTO */}
                                {block.type === 'document' && (
                                  <>
                                    {block.media && block.media.url && (
                                      <div className="bg-[#005c4b]/80 p-4 flex items-center gap-3 border-b border-[#004d3f]">
                                        <div className="text-4xl">📄</div>
                                        <div className="flex-1">
                                          <div className="text-white text-sm font-medium">
                                            {block.media.filename || block.media.original_name || 'Documento.pdf'}
                                          </div>
                                          <div className="text-gray-300 text-xs">
                                            {block.media.size 
                                              ? `${(block.media.size / 1024).toFixed(0)} KB`
                                              : 'PDF'}
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                    {block.text && block.text.trim() !== '' && (
                                      <div className="p-3 bg-[#005c4b]">
                                        <p className="text-white text-[15px] whitespace-pre-wrap break-words leading-relaxed">
                                          {replaceVariables(block.text, getAllFilledVariables())}
                                        </p>
                                      </div>
                                    )}
                                    <div className="text-[11px] text-gray-300 px-3 pb-2 text-right flex items-center justify-end gap-1 bg-[#005c4b]">
                                      <span>{new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                      <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 16 16">
                                        <path d="M12.354 4.354a.5.5 0 0 0-.708-.708L5 10.293 1.854 7.146a.5.5 0 1 0-.708.708l3.5 3.5a.5.5 0 0 0 .708 0l7-7zm-4.208 7-.896-.897.707-.707.543.543 6.646-6.647a.5.5 0 0 1 .708.708l-7 7a.5.5 0 0 1-.708 0z"/>
                                      </svg>
                                    </div>
                                  </>
                                )}
                                
                                {/* BLOCO DE ÁUDIO */}
                                {(block.type === 'audio' || block.type === 'audio_recorded') && (
                                  <>
                                    {block.media && block.media.url && (
                                      <div className="bg-[#005c4b]/80 p-4 border-b border-[#004d3f]">
                                        <div className="flex items-center gap-3">
                                          <div className="text-3xl">🎵</div>
                                          <div className="flex-1">
                                            <div className="text-white text-xs font-medium mb-1">
                                              {block.media.filename || block.media.original_name || 'Áudio'}
                                            </div>
                                            <audio 
                                              src={normalizeMediaUrl(block.media.url)} 
                                              controls 
                                              controlsList="nodownload"
                                              className="w-full"
                                              style={{ height: '40px' }}
                                              onError={(e) => console.error('❌ Erro ao carregar áudio do bloco:', e.currentTarget.src)}
                                              onLoadedData={() => console.log('✅ Áudio do bloco carregado')}
                                            />
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                    {block.text && block.text.trim() !== '' && (
                                      <div className="p-3 bg-[#005c4b]">
                                        <p className="text-white text-[15px] whitespace-pre-wrap break-words leading-relaxed">
                                          {replaceVariables(block.text, getAllFilledVariables())}
                                        </p>
                                      </div>
                                    )}
                                    <div className="text-[11px] text-gray-300 px-3 pb-2 text-right flex items-center justify-end gap-1 bg-[#005c4b]">
                                      <span>{new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                      <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 16 16">
                                        <path d="M12.354 4.354a.5.5 0 0 0-.708-.708L5 10.293 1.854 7.146a.5.5 0 1 0-.708.708l3.5 3.5a.5.5 0 0 0 .708 0l7-7zm-4.208 7-.896-.897.707-.707.543.543 6.646-6.647a.5.5 0 0 1 .708.708l-7 7a.5.5 0 0 1-.708 0z"/>
                                      </svg>
                                    </div>
                                  </>
                                )}
                                
                                {/* BLOCO DE BOTÕES */}
                                {(block.type === 'buttons' || block.type === 'button') && (
                                  <>
                                    {block.text && (
                                      <div className="p-3">
                                        <p className="text-white text-[15px] whitespace-pre-wrap break-words leading-relaxed">
                                          {replaceVariables(block.text, getAllFilledVariables())}
                                        </p>
                                      </div>
                                    )}
                                    {buttonsConfig && buttonsConfig.length > 0 && (
                                      <div className="px-3 pb-2 space-y-1">
                                        {buttonsConfig.map((btn: any, btnIdx: number) => (
                                          <div key={btnIdx} className="bg-[#00a884]/20 border border-[#00a884]/40 text-[#00a884] text-center py-2 rounded text-[14px] font-medium">
                                            {btn.type === 'URL' && '🔗 '}
                                            {btn.type === 'CALL' && '📞 '}
                                            {btn.type === 'COPY' && '📋 '}
                                            {btn.text}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                    <div className="text-[11px] text-gray-300 px-3 pb-2 text-right flex items-center justify-end gap-1">
                                      <span>{new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                      <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 16 16">
                                        <path d="M12.354 4.354a.5.5 0 0 0-.708-.708L5 10.293 1.854 7.146a.5.5 0 1 0-.708.708l3.5 3.5a.5.5 0 0 0 .708 0l7-7zm-4.208 7-.896-.897.707-.707.543.543 6.646-6.647a.5.5 0 0 1 .708.708l-7 7a.5.5 0 0 1-.708 0z"/>
                                      </svg>
                                    </div>
                                  </>
                                )}
                                
                                {/* BLOCO DE LISTA */}
                                {block.type === 'list' && (
                                  <>
                                    {block.text && block.text.trim() !== '' && (
                                      <div className="p-3">
                                        <p className="text-white text-[15px] whitespace-pre-wrap break-words leading-relaxed">
                                          {replaceVariables(block.text, getAllFilledVariables())}
                                        </p>
                                      </div>
                                    )}
                                    <div className="px-3 pb-2">
                                      <div className="bg-[#00a884]/20 border border-[#00a884]/40 text-[#00a884] text-center py-2 rounded text-[14px] font-medium">
                                        📋 {block.listButton || 'Ver Opções'}
                                      </div>
                                    </div>
                                    <div className="text-[11px] text-gray-300 px-3 pb-2 text-right flex items-center justify-end gap-1">
                                      <span>{new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                      <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 16 16">
                                        <path d="M12.354 4.354a.5.5 0 0 0-.708-.708L5 10.293 1.854 7.146a.5.5 0 1 0-.708.708l3.5 3.5a.5.5 0 0 0 .708 0l7-7zm-4.208 7-.896-.897.707-.707.543.543 6.646-6.647a.5.5 0 0 1 .708.708l-7 7a.5.5 0 0 1-.708 0z"/>
                                      </svg>
                                    </div>
                                  </>
                                )}
                                
                                {/* BLOCO DE ENQUETE */}
                                {block.type === 'poll' && (
                                  <>
                                    <div className="p-3">
                                      <div className="flex items-center gap-2 mb-2">
                                        <div className="text-2xl">📊</div>
                                        <p className="text-white text-[15px] font-bold">Enquete</p>
                                      </div>
                                      {block.text && block.text.trim() !== '' && (
                                        <p className="text-white text-[15px] whitespace-pre-wrap break-words leading-relaxed">
                                          {replaceVariables(block.text, getAllFilledVariables())}
                                        </p>
                                      )}
                                    </div>
                                    {choicesConfig && choicesConfig.length > 0 && (
                                      <div className="px-3 pb-2 space-y-1">
                                        {choicesConfig.map((choice: string, choiceIdx: number) => (
                                          <div key={choiceIdx} className="bg-[#005c4b]/60 text-white px-3 py-2 rounded text-sm border border-[#004d3f] flex items-center gap-2">
                                            <div className="w-4 h-4 border-2 border-gray-300 rounded"></div>
                                            {choice}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                    <div className="text-[11px] text-gray-300 px-3 pb-2 text-right flex items-center justify-end gap-1">
                                      <span>{new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                      <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 16 16">
                                        <path d="M12.354 4.354a.5.5 0 0 0-.708-.708L5 10.293 1.854 7.146a.5.5 0 1 0-.708.708l3.5 3.5a.5.5 0 0 0 .708 0l7-7zm-4.208 7-.896-.897.707-.707.543.543 6.646-6.647a.5.5 0 0 1 .708.708l-7 7a.5.5 0 0 1-.708 0z"/>
                                      </svg>
                                    </div>
                                  </>
                                )}
                                
                                {/* BLOCO DE CARROSSEL */}
                                {block.type === 'carousel' && cardsConfig && cardsConfig.length > 0 && (
                                  <>
                                    {cardsConfig.map((card: any, cardIdx: number) => (
                                      <div key={cardIdx} className="border-b border-[#004d3f] last:border-0">
                                        {card.image && (
                                          <img src={card.image} alt={`Card ${cardIdx + 1}`} className="w-full object-cover max-h-96" />
                                        )}
                                        {card.text && (
                                          <div className="p-3 bg-[#005c4b]">
                                            <p className="text-white text-[15px] whitespace-pre-wrap">
                                              {replaceVariables(card.text, getAllFilledVariables())}
                                            </p>
                                          </div>
                                        )}
                                        {card.buttons && card.buttons.length > 0 && (
                                          <div className="px-3 pb-2 bg-[#005c4b] space-y-1">
                                            {card.buttons.map((btn: any, btnIdx: number) => (
                                              <div key={btnIdx} className="bg-[#00a884]/20 border border-[#00a884]/40 text-[#00a884] text-center py-2 rounded text-[14px] font-medium">
                                                {btn.type === 'URL' && '🔗 '}
                                                {btn.type === 'CALL' && '📞 '}
                                                {btn.text}
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                    <div className="text-[11px] text-gray-300 px-3 pb-2 text-right flex items-center justify-end gap-1 bg-[#005c4b]">
                                      <span>{new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                      <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 16 16">
                                        <path d="M12.354 4.354a.5.5 0 0 0-.708-.708L5 10.293 1.854 7.146a.5.5 0 1 0-.708.708l3.5 3.5a.5.5 0 0 0 .708 0l7-7zm-4.208 7-.896-.897.707-.707.543.543 6.646-6.647a.5.5 0 0 1 .708.708l-7 7a.5.5 0 0 1-.708 0z"/>
                                      </svg>
                                    </div>
                                  </>
                                )}
                                
                                {/* FALLBACK - Se nenhum tipo específico foi renderizado, mostrar pelo menos o texto */}
                                {!['text', 'image', 'video', 'audio', 'audio_recorded', 'document', 'buttons', 'button', 'list', 'poll', 'carousel'].includes(block.type) && block.text && (
                                  <>
                                    <div className="p-3 bg-[#005c4b] border-l-4 border-yellow-500">
                                      <p className="text-xs text-yellow-300 font-bold mb-2">⚠️ Tipo: {block.type}</p>
                                      <p className="text-white text-[15px] whitespace-pre-wrap break-words leading-relaxed">
                                        {replaceVariables(block.text, getAllFilledVariables())}
                                      </p>
                                    </div>
                                    <div className="text-[11px] text-gray-300 px-3 pb-2 text-right flex items-center justify-end gap-1 bg-[#005c4b]">
                                      <span>{new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                      <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 16 16">
                                        <path d="M12.354 4.354a.5.5 0 0 0-.708-.708L5 10.293 1.854 7.146a.5.5 0 1 0-.708.708l3.5 3.5a.5.5 0 0 0 .708 0l7-7zm-4.208 7-.896-.897.707-.707.543.543 6.646-6.647a.5.5 0 0 1 .708.708l-7 7a.5.5 0 0 1-.708 0z"/>
                                      </svg>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </>
                    );
                  })() : (
                  <div className="flex justify-end mb-4">
                    <div className="bg-[#005c4b] rounded-lg shadow-lg max-w-[85%] overflow-hidden">
                      
                      {/* IMAGEM (se houver) */}
                      {selectedTemplate.type === 'image' && (selectedTemplate.media_url || selectedTemplate.media_files?.[0]) && (
                        <div className="w-full">
                          <img 
                            src={normalizeMediaUrl(selectedTemplate.media_url || selectedTemplate.media_files?.[0]?.url)} 
                            alt="Preview" 
                            className="w-full object-cover max-h-96" 
                          />
                        </div>
                      )}
                      
                      {/* VÍDEO (se houver) */}
                      {selectedTemplate.type === 'video' && (selectedTemplate.media_url || selectedTemplate.media_files?.[0]) && (
                        <div className="w-full">
                          <video 
                            src={normalizeMediaUrl(selectedTemplate.media_url || selectedTemplate.media_files?.[0]?.url)} 
                            className="w-full max-h-96" 
                            controls 
                          />
                        </div>
                      )}
                      
                      {/* ÁUDIO (se houver) */}
                      {(selectedTemplate.type === 'audio' || selectedTemplate.type === 'audio_recorded') && (selectedTemplate.media_url || selectedTemplate.media_files?.[0]) && (
                        <div className="bg-[#005c4b]/80 p-4 border-b border-[#004d3f]">
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-3">
                              <div className="text-3xl">🎵</div>
                              <div className="flex-1">
                                <div className="text-white text-sm font-medium mb-1">
                                  {selectedTemplate.media_files?.[0]?.original_name || selectedTemplate.media_files?.[0]?.file_name || 'Áudio'}
                                </div>
                                <audio 
                                  src={normalizeMediaUrl(selectedTemplate.media_url || selectedTemplate.media_files?.[0]?.url)} 
                                  controls 
                                  controlsList="nodownload"
                                  className="w-full"
                                  style={{ height: '40px' }}
                                  onError={(e) => {
                                    console.error('❌ Erro ao carregar áudio:', e.currentTarget.src);
                                    console.log('📊 Dados do template:', {
                                      media_url: selectedTemplate.media_url,
                                      media_files: selectedTemplate.media_files
                                    });
                                  }}
                                  onLoadedData={() => console.log('✅ Áudio carregado com sucesso')}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* DOCUMENTO (se houver) */}
                      {selectedTemplate.type === 'document' && (selectedTemplate.media_url || selectedTemplate.media_files?.[0]) && (
                        <div className="bg-[#005c4b]/80 p-4 flex items-center gap-3 border-b border-[#004d3f]">
                          <div className="text-4xl">📄</div>
                          <div className="flex-1">
                            <div className="text-white text-sm font-medium">
                              {selectedTemplate.media_files?.[0]?.original_name || selectedTemplate.media_files?.[0]?.file_name || 'Documento.pdf'}
                            </div>
                            <div className="text-gray-300 text-xs">
                              {selectedTemplate.media_files?.[0]?.file_size 
                                ? `${(selectedTemplate.media_files[0].file_size / 1024).toFixed(0)} KB`
                                : 'PDF'}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* CARROSSEL (todos os cards) */}
                      {selectedTemplate.type === 'carousel' && selectedTemplate.carousel_config && (() => {
                        let config = selectedTemplate.carousel_config;
                        if (typeof config === 'string') config = JSON.parse(config);
                        return (
                          <>
                            {/* Texto principal do carrossel (se houver) */}
                            {selectedTemplate.text_content && (
                              <div className="p-3 bg-[#005c4b] border-b border-[#004d3f]">
                                <p className="text-white text-[15px] whitespace-pre-wrap break-words leading-relaxed">
                                  {replaceVariables(selectedTemplate.text_content || '', getAllFilledVariables())}
                                </p>
                              </div>
                            )}
                            {config.cards?.map((card: any, cardIndex: number) => (
                              <div key={cardIndex} className="border-b border-[#004d3f] last:border-0">
                                {card.image && (
                                  <img src={card.image} alt={`Card ${cardIndex + 1}`} className="w-full object-cover max-h-96" />
                                )}
                                {card.text && (
                                  <div className="p-3 bg-[#005c4b]">
                                    <p className="text-white text-[15px] whitespace-pre-wrap">{replaceVariables(card.text, getAllFilledVariables())}</p>
                                  </div>
                                )}
                                {card.buttons && card.buttons.length > 0 && (
                                  <div className="px-3 pb-2 bg-[#005c4b] space-y-1">
                                    {card.buttons.map((btn: any, btnIndex: number) => (
                                      <div key={btnIndex} className="bg-[#00a884]/20 border border-[#00a884]/40 text-[#00a884] text-center py-2 rounded text-[14px] font-medium">
                                        {btn.type === 'URL' && '🔗 '}
                                        {btn.type === 'CALL' && '📞 '}
                                        {btn.text}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </>
                        );
                      })()}

                      {/* TEXTO (para tipos simples: text, image, video, audio, document) */}
                      {selectedTemplate.text_content && !['carousel', 'buttons', 'list', 'combined'].includes(selectedTemplate.type) && (
                        <div className="p-3">
                          <p className="text-white text-[15px] whitespace-pre-wrap break-words leading-relaxed">
                            {replaceVariables(selectedTemplate.text_content || '', getAllFilledVariables())}
                          </p>
                        </div>
                      )}

                      {/* BOTÕES (se houver) - texto aparece acima dos botões */}
                      {selectedTemplate.type === 'buttons' && (
                        <>
                          {selectedTemplate.text_content && (
                            <div className="p-3">
                              <p className="text-white text-[15px] whitespace-pre-wrap break-words leading-relaxed">
                                {replaceVariables(selectedTemplate.text_content || '', getAllFilledVariables())}
                              </p>
                            </div>
                          )}
                          {selectedTemplate.buttons_config && (() => {
                            let config = selectedTemplate.buttons_config;
                            if (typeof config === 'string') config = JSON.parse(config);
                            return (
                              <div className="px-3 pb-2 space-y-1">
                                {config.buttons?.map((btn: any, btnIndex: number) => (
                                  <div key={btnIndex} className="bg-[#00a884]/20 border border-[#00a884]/40 text-[#00a884] text-center py-2 rounded text-[14px] font-medium">
                                    {btn.type === 'URL' && '🔗 '}
                                    {btn.type === 'CALL' && '📞 '}
                                    {btn.type === 'COPY' && '📋 '}
                                    {btn.text}
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                        </>
                      )}

                      {/* LISTA (se houver) - texto aparece acima do botão */}
                      {selectedTemplate.type === 'list' && (
                        <>
                          {selectedTemplate.text_content && (
                            <div className="p-3">
                              <p className="text-white text-[15px] whitespace-pre-wrap break-words leading-relaxed">
                                {replaceVariables(selectedTemplate.text_content || '', getAllFilledVariables())}
                              </p>
                            </div>
                          )}
                          {selectedTemplate.list_config && (() => {
                            let config = selectedTemplate.list_config;
                            if (typeof config === 'string') config = JSON.parse(config);
                            return (
                              <div className="px-3 pb-2">
                                <div className="bg-[#00a884]/20 border border-[#00a884]/40 text-[#00a884] text-center py-2 rounded text-[14px] font-medium">
                                  📋 {config.buttonText || 'Ver Opções'}
                                </div>
                              </div>
                            );
                          })()}
                        </>
                      )}

                      {/* Horário */}
                      <div className="text-[11px] text-gray-300 px-3 pb-2 text-right flex items-center justify-end gap-1">
                        <span>{new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                        <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 16 16">
                          <path d="M12.354 4.354a.5.5 0 0 0-.708-.708L5 10.293 1.854 7.146a.5.5 0 1 0-.708.708l3.5 3.5a.5.5 0 0 0 .708 0l7-7zm-4.208 7-.896-.897.707-.707.543.543 6.646-6.647a.5.5 0 0 1 .708.708l-7 7a.5.5 0 0 1-.708 0z"/>
                        </svg>
                      </div>
                    </div>
                  </div>
                  )}
                </div>
              </div>
            </div>

            {/* Botões de Ação - Fora do celular */}
            <div className="mt-6 space-y-3">
              {/* Botão Enviar Direto */}
              <button
                onClick={handleSendTemplate}
                disabled={!formData.instance_id || !formData.number}
                className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:from-gray-500 disabled:to-gray-600 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-3 text-lg"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                🚀 Enviar Direto
              </button>

              {/* Botão Editar e Enviar */}
              <button
                onClick={() => {
                  // Salvar dados do template no sessionStorage
                  let templateData: any = {
                    type: selectedTemplate.type,
                    text_content: selectedTemplate.text_content,
                    media_url: selectedTemplate.media_url,
                    media_files: selectedTemplate.media_files, // ✅ ADICIONADO: Incluir dados completos das mídias
                    buttons_config: selectedTemplate.buttons_config,
                    list_config: selectedTemplate.list_config,
                    carousel_config: selectedTemplate.carousel_config,
                    poll_config: selectedTemplate.poll_config,
                    variables: getAllFilledVariables(),
                    variables_map: selectedTemplate.variables_map || {}
                  };
                  
                  // Se for COMBINED, incluir os blocos ORIGINAIS (sem substituição de variáveis)
                  if (selectedTemplate.type === 'combined' && selectedTemplate.combined_blocks) {
                    let blocks = selectedTemplate.combined_blocks;
                    if (typeof blocks === 'string') blocks = JSON.parse(blocks);
                    
                    // NÃO substituir variáveis - salvar blocos originais para permitir edição
                    templateData.combined_blocks = blocks;  // ← Blocos ORIGINAIS (com {{variáveis}})
                  }
                  
                  console.log('💾 SALVANDO NO SESSIONSTORAGE:', templateData);
                  sessionStorage.setItem('templateToEdit', JSON.stringify(templateData));
                  
                  // Redirecionar para Envio Único
                  router.push('/uaz/enviar-mensagem-unificado');
                }}
                className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-3 text-lg"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                ✏️ Editar e Enviar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

