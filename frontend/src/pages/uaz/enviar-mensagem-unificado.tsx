import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { 
  FaArrowLeft, FaPaperPlane, FaImage, FaVideo, FaMicrophone, FaFile,
  FaMousePointer, FaList, FaPoll, FaThList, FaPlus, FaTrash,
  FaLink, FaPhone, FaCopy, FaReply, FaPlay, FaPause, FaMusic,
  FaShieldAlt, FaCog, FaUpload, FaTimes, FaSave
} from 'react-icons/fa';
import api from '@/services/api';
import { uploadAPI } from '@/services/api';
import AudioRecorder from '@/components/AudioRecorder';
import MultiAudioRecorder from '@/components/MultiAudioRecorder';
import MultiMediaUploader from '@/components/MultiMediaUploader';
import EmojiPickerButton from '@/components/EmojiPickerButton';
import { InstanceSelect } from '@/components/InstanceSelect';
import { useNotifications } from '@/contexts/NotificationContext';
import styles from '@/styles/AudioRecorder.module.css';

// Configuração da URL base da API
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace(/\/api$/, '');

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

type MessageType = 'text' | 'image' | 'video' | 'audio' | 'document' | 'button' | 'list' | 'poll' | 'carousel' | 'combined';

interface ButtonOption {
  id: string;
  text: string;
  type: 'REPLY' | 'URL' | 'CALL' | 'COPY';
  url?: string;
  phone_number?: string;
  copy_code?: string;
}

interface Card {
  id: string;
  text: string;
  image: string;
  buttons: ButtonOption[];
  uploadedImage?: any;
  uploadingImage: boolean;
}

interface MessageBlock {
  id: string;
  type: Exclude<MessageType, 'combined'>;
  order: number;
  text?: string;
  originalText?: string;
  media?: any;
  buttons?: ButtonOption[];
  choices?: string[];
  cards?: Card[];
  footerText?: string;
  listButton?: string;
  selectableCount?: number;
}

// Sistema de Fila de Envios
interface SendingJob {
  id: string;
  type: 'simple' | 'combined';
  status: 'sending' | 'paused' | 'completed' | 'error' | 'cancelled';
  progress: number;
  totalBlocks: number;
  currentBlock: number;
  targetNumber: string;
  instanceId: string;
  startedAt: Date;
  messageType?: MessageType;
  blocks?: MessageBlock[];
  error?: string;
  cancelRequested?: boolean;
  pauseRequested?: boolean;
}

export default function EnviarMensagemUnificado() {
  const router = useRouter();
  const notify = useNotifications();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [instances, setInstances] = useState<UazInstance[]>([]);
  
  
  // Sistema de Fila de Envios
  const [sendingJobs, setSendingJobs] = useState<SendingJob[]>([]);
  
  // Sistema de Notificações Toast
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null);
  
  const [messageType, setMessageType] = useState<MessageType | ''>(''); // Começa sem tipo selecionado
  
  const [formData, setFormData] = useState({
    instance_id: '',
    number: '',
    text: '',
    footerText: '',
    listButton: 'Ver Opções',
    selectableCount: 1
  });

  // Estados para mídia
  const [uploadedMedia, setUploadedMedia] = useState<any>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [mediaMode, setMediaMode] = useState<'upload' | 'record'>('upload');
  
  // Estados para áudio gravado
  const [recordedAudioBlob, setRecordedAudioBlob] = useState<Blob | null>(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string>('');
  const [recordedAudioDuration, setRecordedAudioDuration] = useState<number>(0);
  
  // Estados para múltiplos áudios
  const [recordedAudios, setRecordedAudios] = useState<any[]>([]);
  const [uploadedAudios, setUploadedAudios] = useState<any[]>([]);
  
  // Estados para múltiplos arquivos
  const [selectedFiles, setSelectedFiles] = useState<any[]>([]);
  const [useMultipleFiles, setUseMultipleFiles] = useState(false);
  
  // Estados para delays personalizados
  const [delayBeforeSending, setDelayBeforeSending] = useState(2);
  const [delayBetweenMessages, setDelayBetweenMessages] = useState(1.5);
  
  // Estados para player de mídia
  const [mediaPlaybackState, setMediaPlaybackState] = useState({
    isPlaying: false,
    currentTime: 0,
    duration: 0
  });
  const mediaRef = useRef<HTMLMediaElement | null>(null);

  // Estados para botões/opções
  const [buttons, setButtons] = useState<ButtonOption[]>([
    { id: Date.now().toString(), text: '', type: 'REPLY' }
  ]);
  const [choices, setChoices] = useState<string[]>(['']);

  // Estados para carrossel
  const [cards, setCards] = useState<Card[]>([
    {
      id: Date.now().toString(),
      text: '',
      image: '',
      buttons: [],
      uploadingImage: false
    }
  ]);

  // Estados para mensagem combinada
  const [messageBlocks, setMessageBlocks] = useState<MessageBlock[]>([]);
  const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null);
  const [showAddBlockMenu, setShowAddBlockMenu] = useState(false);
  const [showQueuePanel, setShowQueuePanel] = useState(true);
  
  // Estados para Templates Prontos
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templateSearchTerm, setTemplateSearchTerm] = useState('');
  
  // Estados para variáveis do template
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({});
  const [templateVariablesMap, setTemplateVariablesMap] = useState<Record<string, string>>({});
  const [templateOriginalText, setTemplateOriginalText] = useState('');

  useEffect(() => {
    loadInstances();
    loadDelayConfig();
    loadTemplateData(); // Carregar dados do template se houver
  }, []);

  // Carregar dados do template do sessionStorage
  const loadTemplateData = () => {
    try {
      const templateDataStr = sessionStorage.getItem('templateToEdit');
      if (templateDataStr) {
        const templateData = JSON.parse(templateDataStr);
        
        console.log('📥 CARREGANDO DO SESSIONSTORAGE:', templateData);
        console.log('📝 TEXT_CONTENT:', templateData.text_content);
        console.log('📝 TYPE:', templateData.type);
        
        // Função auxiliar para detectar variáveis
        const detectVariables = (text: string): string[] => {
          const regex = /\{\{\s*(\w+)\s*\}\}/g;
          const variables: string[] = [];
          let match;
          while ((match = regex.exec(text)) !== null) {
            if (!variables.includes(match[1])) {
              variables.push(match[1]);
            }
          }
          return variables;
        };
        
        const isAutoFilledVariable = (varName: string) => {
          return ['data', 'hora', 'protocolo', 'saudacao'].includes(varName.toLowerCase());
        };
        
        // Detectar variáveis no texto ORIGINAL
        let originalText = templateData.text_content || '';
        
        // Para mensagens combinadas, extrair texto de todos os blocos
        if (templateData.type === 'combined' && templateData.combined_blocks?.blocks) {
          console.log('🔍 Detectando variáveis em mensagem COMBINADA...');
          let allText = '';
          
          templateData.combined_blocks.blocks.forEach((block: any) => {
            if (block.type === 'text' && block.text) {
              allText += block.text + ' ';
            } else if (['image', 'video', 'audio', 'document'].includes(block.type) && block.caption) {
              allText += block.caption + ' ';
            } else if (block.type === 'list') {
              if (block.text) allText += block.text + ' ';
              if (block.title) allText += block.title + ' ';
              if (block.footerText) allText += block.footerText + ' ';
              block.sections?.forEach((section: any) => {
                if (section.title) allText += section.title + ' ';
                section.rows?.forEach((row: any) => {
                  if (row.title) allText += row.title + ' ';
                  if (row.description) allText += row.description + ' ';
                });
              });
            } else if (block.type === 'buttons') {
              if (block.text) allText += block.text + ' ';
              if (block.footerText) allText += block.footerText + ' ';
              block.buttons?.forEach((btn: any) => {
                if (btn.text) allText += btn.text + ' ';
              });
            } else if (block.type === 'carousel') {
              block.cards?.forEach((card: any) => {
                if (card.text) allText += card.text + ' ';
                card.buttons?.forEach((btn: any) => {
                  if (btn.text) allText += btn.text + ' ';
                });
              });
            }
          });
          
          originalText = allText;
          console.log('📝 Texto agregado dos blocos combinados:', originalText);
        }
        
        const detectedVars = detectVariables(originalText);
        console.log('🔍 Variáveis detectadas:', detectedVars);
        
        // Separar variáveis automáticas de manuais
        const manualVars: Record<string, string> = {};
        detectedVars.forEach(varName => {
          if (!isAutoFilledVariable(varName)) {
            // É uma variável manual - pegar o valor se existir
            manualVars[varName] = (templateData.variables && templateData.variables[varName]) || '';
          }
        });
        
        console.log('📝 Variáveis manuais detectadas:', Object.keys(manualVars));
        console.log('📝 Valores iniciais:', manualVars);
        
        // Configurar estados de variáveis (SEMPRE, mesmo se estiverem vazias)
        if (Object.keys(manualVars).length > 0) {
          setTemplateVariables(manualVars);
          setTemplateVariablesMap(templateData.variables_map || {});
          setTemplateOriginalText(originalText);
        }
        
        // Definir o tipo de mensagem
        if (templateData.type) {
          setMessageType(templateData.type);
          console.log('✅ Tipo de mensagem definido:', templateData.type);
        }
        
        // Preencher texto (substituir variáveis)
        // Usamos setTimeout para garantir que o texto seja definido DEPOIS que o tipo de mensagem for renderizado
        if (templateData.text_content) {
          let text = templateData.text_content;
          console.log('📝 Texto ANTES da substituição:', text);
          
          // Substituir variáveis se existirem
          if (templateData.variables) {
            console.log('🔧 Variáveis para substituir:', templateData.variables);
            Object.entries(templateData.variables).forEach(([key, value]: [string, any]) => {
              const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
              text = text.replace(regex, value || '');
            });
          }
          
          console.log('📝 Texto DEPOIS da substituição:', text);
          
          // Aguardar a renderização do tipo de mensagem antes de preencher o texto
          setTimeout(() => {
            setFormData(prev => {
              console.log('✅ Atualizando formData com texto (após render):', text);
              return { ...prev, text };
            });
          }, 100);
        }
        
        // Carregar outras configurações após a renderização do tipo de mensagem
        setTimeout(() => {
          // Carregar mídia - ✅ CORRIGIDO: Usar media_files se disponível
          if (templateData.media_files && templateData.media_files.length > 0) {
            const mediaFile = templateData.media_files[0];
            // Construir URL completa se necessário
            let mediaUrl = mediaFile.url;
            if (mediaUrl && !mediaUrl.startsWith('http') && !mediaUrl.startsWith('data:') && !mediaUrl.startsWith('blob:')) {
              const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace(/\/api$/, '');
              mediaUrl = `${API_BASE_URL}${mediaUrl}`;
            }
            setUploadedMedia({
              url: mediaUrl,
              path: mediaFile.path || mediaFile.url,
              filename: mediaFile.file_name || mediaFile.filename || mediaFile.original_name,
              originalname: mediaFile.original_name || mediaFile.file_name,
              mimetype: mediaFile.mimetype || mediaFile.mime_type,
              mime_type: mediaFile.mime_type || mediaFile.mimetype,
              size: mediaFile.file_size || mediaFile.size
            });
            console.log('✅ Mídia carregada de media_files:', mediaUrl);
          } else if (templateData.media_url) {
            // Fallback para media_url se media_files não existir
            let mediaUrl = templateData.media_url;
            if (mediaUrl && !mediaUrl.startsWith('http') && !mediaUrl.startsWith('data:') && !mediaUrl.startsWith('blob:')) {
              const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace(/\/api$/, '');
              mediaUrl = `${API_BASE_URL}${mediaUrl}`;
            }
            setUploadedMedia({ url: mediaUrl });
            console.log('✅ Mídia carregada de media_url:', mediaUrl);
          }
          
          // Carregar configurações específicas
          if (templateData.buttons_config) {
            let config = templateData.buttons_config;
            if (typeof config === 'string') config = JSON.parse(config);
            if (config.buttons) {
              setButtons(config.buttons.map((btn: any, idx: number) => ({
                ...btn,
                id: btn.id || `btn-${Date.now()}-${idx}`
              })));
              console.log('✅ Botões carregados:', config.buttons.length);
            }
          }
          
          if (templateData.list_config) {
            let config = templateData.list_config;
            if (typeof config === 'string') config = JSON.parse(config);
            setFormData(prev => ({ 
              ...prev, 
              listButton: config.buttonText || 'Ver Opções'
            }));
            console.log('✅ Lista carregada');
          }
          
          if (templateData.carousel_config) {
            let config = templateData.carousel_config;
            if (typeof config === 'string') config = JSON.parse(config);
            if (config.cards) {
              setCards(config.cards.map((card: any, idx: number) => ({
                ...card,
                id: card.id || `card-${Date.now()}-${idx}`,
                buttons: (card.buttons || []).map((btn: any, btnIdx: number) => ({
                  ...btn,
                  id: btn.id || `btn-${Date.now()}-${idx}-${btnIdx}`
                })),
                uploadingImage: false
              })));
              console.log('✅ Carrossel carregado com', config.cards.length, 'cards');
            }
          }
          
          if (templateData.poll_config) {
            let config = templateData.poll_config;
            if (typeof config === 'string') config = JSON.parse(config);
            if (config.options) {
              setChoices(config.options);
            }
            if (config.selectableCount) {
              setFormData(prev => ({ ...prev, selectableCount: config.selectableCount }));
            }
            console.log('✅ Enquete carregada');
          }
          
          // Carregar MENSAGEM COMBINADA
          if (templateData.combined_blocks) {
            let blocks = templateData.combined_blocks;
            if (typeof blocks === 'string') blocks = JSON.parse(blocks);
            
            const blocksArray = blocks.blocks || [];
            
            // Função auxiliar para normalizar URLs
            const normalizeMediaUrl = (url: string | undefined): string => {
              if (!url) return '';
              if (url.includes('${API_BASE_URL}${API_BASE_URL}')) {
                url = url.replace(/http:\/\/localhost:3001http:\/\/localhost:3001/g, '${API_BASE_URL}');
              }
              if (url.startsWith('http') || url.startsWith('data:') || url.startsWith('blob:')) {
                return url;
              }
              return `${API_BASE_URL}${url}`;
            };
            
            // Converter para o formato correto de MessageBlock[]
            const loadedBlocks = blocksArray.map((block: any, index: number) => {
              // Processar cards de carrossel se existirem
              let processedCards = block.cards || [];
              if (block.type === 'carousel' && block.cards && block.cards.length > 0) {
                console.log('🎴 Processando cards do carrossel:', block.cards);
                
                processedCards = block.cards.map((card: any, idx: number) => {
                  console.log(`📦 Card #${idx + 1} ANTES:`, {
                    image: card.image,
                    uploadedImage: card.uploadedImage
                  });
                  
                  // Normalizar URL da imagem do card
                  let cardImage = card.image || '';
                  
                  // Se uploadedImage existe, tentar extrair a URL correta
                  if (card.uploadedImage) {
                    if (card.uploadedImage.url) {
                      cardImage = card.uploadedImage.url;
                    } else if (card.uploadedImage.path) {
                      // Extrair apenas o nome do arquivo do path do Windows
                      const pathParts = card.uploadedImage.path.split(/[\\\/]/);
                      const filename = pathParts[pathParts.length - 1];
                      cardImage = `/uploads/media/${filename}`;
                      console.log(`🔧 Extraído filename do path:`, {
                        path: card.uploadedImage.path,
                        filename: filename,
                        cardImage: cardImage
                      });
                    } else if (card.uploadedImage.filename) {
                      cardImage = `/uploads/media/${card.uploadedImage.filename}`;
                    }
                  }
                  
                  if (cardImage) {
                    cardImage = normalizeMediaUrl(cardImage);
                  }
                  
                  const processedCard = {
                    ...card,
                    image: cardImage,
                    uploadedImage: card.uploadedImage ? {
                      ...card.uploadedImage,
                      url: cardImage
                    } : null
                  };
                  
                  console.log(`✅ Card #${idx + 1} DEPOIS:`, {
                    image: processedCard.image,
                    uploadedImage: processedCard.uploadedImage
                  });
                  
                  return processedCard;
                });
              }
              
              // Processar mídia do bloco se existir
              let processedMedia = block.media || null;
              if (block.media && block.media.url) {
                processedMedia = {
                  ...block.media,
                  url: normalizeMediaUrl(block.media.url)
                };
              }
              
              return {
                id: block.id || `block-${Date.now()}-${index}`,
                type: block.type,
                order: block.order !== undefined ? block.order : index,
                text: block.text || '',
                originalText: block.text || '', // ← Salvar texto original com variáveis
                media: processedMedia,
                buttons: block.buttons || [],
                choices: block.choices || [],
                cards: processedCards,
                footerText: block.footerText || '',
                listButton: block.listButton || 'Ver Opções',
                selectableCount: block.selectableCount || 1
              };
            });
            
            setMessageBlocks(loadedBlocks);
            console.log('✅ Mensagem Combinada carregada com', loadedBlocks.length, 'blocos');
            console.log('📦 Blocos processados:', loadedBlocks);
          }
        }, 150);
        
        // Limpar sessionStorage após carregar
        sessionStorage.removeItem('templateToEdit');
        
        console.log('✅ Template COMPLETAMENTE carregado para edição!');
      } else {
        console.log('⚠️ Nenhum template encontrado no sessionStorage');
      }
    } catch (error) {
      console.error('❌ Erro ao carregar template:', error);
    }
  };

  const loadInstances = async () => {
    try {
      const response = await api.get('/uaz/instances');
      // Filtrar: Conectadas E Ativas (não pausadas)
      const connectedInstances = response.data.data.filter(
        (inst: UazInstance) => 
          (inst.status === 'connected' || inst.status === 'open') && 
          inst.is_active === true
      );
      setInstances(connectedInstances);
      
      if (connectedInstances.length > 0) {
        setFormData({ ...formData, instance_id: connectedInstances[0].id.toString() });
      }
    } catch (error) {
      console.error('Erro ao carregar instâncias:', error);
    } finally {
      setLoading(false);
    }
  };

  // Carregar templates da API
  const loadTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const response = await api.get('/qr-templates');
      if (response.data.success) {
        setTemplates(response.data.data);
        console.log('📋 Templates carregados:', response.data.data.length);
      }
    } catch (error) {
      console.error('❌ Erro ao carregar templates:', error);
      showNotification('Erro ao carregar templates', 'error');
    } finally {
      setLoadingTemplates(false);
    }
  };

  // Selecionar e preencher template
  const handleSelectTemplateFromModal = async (template: any) => {
    try {
      console.log('📋 Template selecionado:', template);
      
      // Fechar modal
      setShowTemplatesModal(false);
      
      // Buscar detalhes completos do template
      const response = await api.get(`/qr-templates/${template.id}`);
      const templateData = response.data.data;
      
      console.log('📥 Dados completos do template:', templateData);
      
      // Detectar e preencher variáveis automaticamente
      const detectVariables = (text: string): string[] => {
        const regex = /\{\{\s*(\w+)\s*\}\}/g;
        const variables: string[] = [];
        let match;
        while ((match = regex.exec(text)) !== null) {
          if (!variables.includes(match[1])) {
            variables.push(match[1]);
          }
        }
        return variables;
      };
      
      const getAutoFilledVariables = () => {
        const now = new Date();
        const data = now.toLocaleDateString('pt-BR');
        const hora = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const protocolo = Date.now().toString();
        const currentHour = now.getHours();
        let saudacao = 'Bom dia';
        if (currentHour >= 12 && currentHour < 18) saudacao = 'Boa tarde';
        else if (currentHour >= 18) saudacao = 'Boa noite';
        
        return { data, hora, protocolo, saudacao };
      };
      
      const isAutoFilledVariable = (varName: string) => {
        return ['data', 'hora', 'protocolo', 'saudacao'].includes(varName.toLowerCase());
      };
      
      // Detectar variáveis e separar automáticas de manuais
      const autoVars = getAutoFilledVariables();
      const manualVars: Record<string, string> = {};
      
      if (templateData.text_content) {
        const detectedVars = detectVariables(templateData.text_content);
        detectedVars.forEach(v => {
          if (!isAutoFilledVariable(v)) {
            manualVars[v] = ''; // Variáveis manuais iniciam vazias
          }
        });
      }
      
      // Armazenar variáveis manuais e o mapa de nomes descritivos
      setTemplateVariables(manualVars);
      setTemplateVariablesMap(templateData.variables_map || {});
      
      // Definir o tipo de mensagem
      if (templateData.type) {
        setMessageType(templateData.type);
        console.log('✅ Tipo de mensagem definido:', templateData.type);
      }
      
      // Preencher texto (substituir APENAS variáveis automáticas)
      setTimeout(() => {
        if (templateData.text_content) {
          let text = templateData.text_content;
          
          // Armazenar o texto original para uso posterior
          setTemplateOriginalText(text);
          
          // Substituir apenas variáveis automáticas
          Object.entries(autoVars).forEach(([key, value]: [string, any]) => {
            if (value) {
              const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
              text = text.replace(regex, value);
            }
          });
          
          console.log('📝 Texto carregado (automáticas preenchidas):', text);
          console.log('📝 Variáveis manuais detectadas:', Object.keys(manualVars));
          setFormData(prev => ({ ...prev, text }));
        }
        
        // Carregar mídia
        if (templateData.media_url) {
          setUploadedMedia({ url: templateData.media_url });
          console.log('✅ Mídia carregada:', templateData.media_url);
        }
      }, 100);
      
      // Carregar outras configurações
      setTimeout(() => {
        if (templateData.buttons_config) {
          let config = templateData.buttons_config;
          if (typeof config === 'string') config = JSON.parse(config);
          if (config.buttons) {
            setButtons(config.buttons.map((btn: any, idx: number) => ({
              ...btn,
              id: btn.id || `btn-${Date.now()}-${idx}`
            })));
            console.log('✅ Botões carregados:', config.buttons.length);
          }
        }
        
        if (templateData.list_config) {
          let config = templateData.list_config;
          if (typeof config === 'string') config = JSON.parse(config);
          setFormData(prev => ({ 
            ...prev, 
            listButton: config.buttonText || 'Ver Opções'
          }));
          console.log('✅ Lista carregada');
        }
        
        if (templateData.carousel_config) {
          let config = templateData.carousel_config;
          if (typeof config === 'string') config = JSON.parse(config);
          if (config.cards) {
            setCards(config.cards.map((card: any, idx: number) => ({
              ...card,
              id: card.id || `card-${Date.now()}-${idx}`,
              buttons: (card.buttons || []).map((btn: any, btnIdx: number) => ({
                ...btn,
                id: btn.id || `btn-${Date.now()}-${idx}-${btnIdx}`
              })),
              uploadingImage: false
            })));
            console.log('✅ Carrossel carregado com', config.cards.length, 'cards');
          }
        }
        
        if (templateData.poll_config) {
          let config = templateData.poll_config;
          if (typeof config === 'string') config = JSON.parse(config);
          if (config.options) {
            setChoices(config.options);
          }
          if (config.selectableCount) {
            setFormData(prev => ({ ...prev, selectableCount: config.selectableCount }));
          }
          console.log('✅ Enquete carregada');
        }
        
        // Carregar MENSAGEM COMBINADA
        if (templateData.combined_blocks) {
          let blocks = templateData.combined_blocks;
          if (typeof blocks === 'string') blocks = JSON.parse(blocks);
          
          const blocksArray = blocks.blocks || [];
          
          // Função auxiliar para normalizar URLs
          const normalizeMediaUrl = (url: string | undefined): string => {
            if (!url) return '';
            if (url.includes('${API_BASE_URL}${API_BASE_URL}')) {
              url = url.replace(/http:\/\/localhost:3001http:\/\/localhost:3001/g, API_BASE_URL);
            }
            if (url.startsWith('http') || url.startsWith('data:') || url.startsWith('blob:')) {
              return url;
            }
            return `${API_BASE_URL}${url}`;
          };
          
          // Converter para o formato correto de MessageBlock[]
          const loadedBlocks = blocksArray.map((block: any, index: number) => {
            // Processar cards de carrossel se existirem
            let processedCards = block.cards || [];
            if (block.type === 'carousel' && block.cards && block.cards.length > 0) {
              processedCards = block.cards.map((card: any, idx: number) => {
                let cardImage = card.image || '';
                
                // Se uploadedImage existe, tentar extrair a URL correta
                if (card.uploadedImage) {
                  if (card.uploadedImage.url) {
                    cardImage = card.uploadedImage.url;
                  } else if (card.uploadedImage.path) {
                    const pathParts = card.uploadedImage.path.split(/[\\\/]/);
                    const filename = pathParts[pathParts.length - 1];
                    cardImage = `/uploads/media/${filename}`;
                  }
                }
                
                // Normalizar URL da imagem
                cardImage = normalizeMediaUrl(cardImage);
                
                return {
                  ...card,
                  id: card.id || `card-${Date.now()}-${idx}`,
                  image: cardImage,
                  uploadedImage: cardImage ? { url: cardImage } : null,
                  uploadingImage: false,
                  buttons: (card.buttons || []).map((btn: any, btnIdx: number) => ({
                    ...btn,
                    id: btn.id || `btn-${Date.now()}-${idx}-${btnIdx}`
                  }))
                };
              });
            }
            
            // Processar mídia do bloco
            let processedMedia = block.media;
            if (processedMedia && processedMedia.url) {
              processedMedia = {
                ...processedMedia,
                url: normalizeMediaUrl(processedMedia.url)
              };
            }
            
            return {
              id: block.id || `block-${Date.now()}-${index}`,
              type: block.type,
              order: block.order !== undefined ? block.order : index,
              text: block.text || '',
              media: processedMedia,
              buttons: (block.buttons || []).map((btn: any, btnIdx: number) => ({
                ...btn,
                id: btn.id || `btn-${Date.now()}-${index}-${btnIdx}`
              })),
              choices: block.choices || [],
              cards: processedCards,
              footerText: block.footerText || '',
              listButton: block.listButton || 'Ver Opções',
              selectableCount: block.selectableCount || 1,
              listSections: block.listSections || []
            };
          });
          
          setMessageBlocks(loadedBlocks);
          console.log('✅ Mensagem Combinada carregada com', loadedBlocks.length, 'blocos');
        }
      }, 150);
      
      showNotification(`Template "${template.name}" carregado!`, 'success');
      
    } catch (error) {
      console.error('❌ Erro ao carregar template:', error);
      showNotification('Erro ao carregar template', 'error');
    }
  };

  // Função para atualizar variáveis e texto em tempo real
  const handleTemplateVariableChange = (varName: string, value: string) => {
    // Atualizar o estado das variáveis
    const updatedVars = { ...templateVariables, [varName]: value };
    setTemplateVariables(updatedVars);
    
    // Reconstruir o texto com as variáveis substituídas
    if (templateOriginalText) {
      let newText = templateOriginalText;
      
      // Substituir variáveis automáticas (já preenchidas)
      const now = new Date();
      const autoVars = {
        data: now.toLocaleDateString('pt-BR'),
        hora: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        protocolo: Date.now().toString(),
        saudacao: (() => {
          const hour = now.getHours();
          if (hour >= 12 && hour < 18) return 'Boa tarde';
          if (hour >= 18) return 'Boa noite';
          return 'Bom dia';
        })()
      };
      
      Object.entries(autoVars).forEach(([key, val]) => {
        const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
        newText = newText.replace(regex, val);
      });
      
      // Substituir variáveis manuais
      Object.entries(updatedVars).forEach(([key, val]) => {
        const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
        newText = newText.replace(regex, val);
      });
      
      setFormData(prev => ({ ...prev, text: newText }));
    }
    
    // ATUALIZAR BLOCOS DE MENSAGEM COMBINADA
    setMessageBlocks(prevBlocks => 
      prevBlocks.map(block => {
        // ✨ CORRIGIDO: Verificar originalText ao invés de block.text
        const originalText = (block as any).originalText || block.text;
        
        // Se o bloco tem texto original com variáveis, substituir
        if (originalText && originalText.includes('{{')) {
          let newBlockText = originalText;
          
          // Substituir variáveis automáticas
          const now = new Date();
          const autoVars = {
            data: now.toLocaleDateString('pt-BR'),
            hora: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            protocolo: Date.now().toString(),
            saudacao: (() => {
              const hour = now.getHours();
              if (hour >= 12 && hour < 18) return 'Boa tarde';
              if (hour >= 18) return 'Boa noite';
              return 'Bom dia';
            })()
          };
          
          Object.entries(autoVars).forEach(([key, val]) => {
            const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'gi');
            newBlockText = newBlockText.replace(regex, val);
          });
          
          // Substituir variáveis manuais
          Object.entries(updatedVars).forEach(([key, val]) => {
            const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'gi');
            newBlockText = newBlockText.replace(regex, val);
          });
          
          return {
            ...block,
            text: newBlockText,
            originalText: originalText
          };
        }
        return block;
      })
    );
  };

  // Função para obter nome descritivo da variável
  const getVariableDisplayName = (varName: string): string => {
    if (templateVariablesMap[varName]) {
      return templateVariablesMap[varName];
    }
    // Formatar nome técnico (ex: "nome_cliente" -> "Nome Cliente")
    return varName
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const loadDelayConfig = () => {
    try {
      const savedConfig = localStorage.getItem('uaz_delay_config');
      if (savedConfig) {
        const config = JSON.parse(savedConfig);
        setDelayBeforeSending(config.delayBeforeSending || 2);
        setDelayBetweenMessages(config.delayBetweenMessages || 1.5);
        console.log('✅ Configuração de delays carregada:', config);
      }
    } catch (error) {
      console.error('Erro ao carregar configuração de delays:', error);
    }
  };

  const handleSaveAsTemplate = async () => {
    // FIXME: templateData não está definido - função desabilitada temporariamente
    console.warn('handleSaveAsTemplate está desabilitada - templateData não definido');
    return;
    
    /* eslint-disable no-unreachable */
    try {
      // Código comentado abaixo nunca será executado
      if (messageType === 'text' && !formData.text.trim()) {
        notify.error('Campo Obrigatório', 'Por favor, preencha o conteúdo do texto');
        return;
      }

      if (['image', 'video', 'audio', 'document'].includes(messageType) && !uploadedMedia) {
        notify.error('Arquivo Necessário', 'Por favor, faça upload do arquivo');
        return;
      }

      setSending(true);

      // Preparar dados para envio
      const formDataToSend = new FormData();
      // formDataToSend.append('name', templateData.name);
      // formDataToSend.append('description', templateData.description);
      formDataToSend.append('type', messageType);

      if (formData.text) {
        formDataToSend.append('text_content', formData.text);
      }

      // Configurações específicas por tipo
      if (messageType === 'list') {
        // Parse das choices para formato de lista
        const sections: any[] = [];
        let currentSection: any = null;

        choices.forEach(choice => {
          if (choice.startsWith('[') && choice.endsWith(']')) {
            if (currentSection) sections.push(currentSection);
            currentSection = {
              title: choice.slice(1, -1),
              rows: []
            };
          } else if (currentSection && choice.trim()) {
            const parts = choice.split('|');
            if (parts.length >= 2) {
              currentSection.rows.push({
                id: parts[1] || `opt${Date.now()}`,
                title: parts[0],
                description: parts[2] || ''
              });
            }
          }
        });
        if (currentSection) sections.push(currentSection);

        formDataToSend.append('list_config', JSON.stringify({
          buttonText: formData.listButton,
          title: formData.text,
          sections
        }));
      } else if (messageType === 'button') {
        formDataToSend.append('buttons_config', JSON.stringify({
          text: formData.text,
          buttons: buttons.map(btn => ({
            id: btn.id,
            text: btn.text
          }))
        }));
      } else if (messageType === 'carousel') {
        formDataToSend.append('carousel_config', JSON.stringify({
          cards: cards.map(card => ({
            text: card.text,
            image: card.image,
            buttons: card.buttons.map(btn => ({
              id: btn.id,
              text: btn.text
            }))
          }))
        }));
      }

      // Adicionar arquivo de mídia se existir
      if (uploadedMedia && uploadedMedia.path) {
        formDataToSend.append('media_url', uploadedMedia.url);
        formDataToSend.append('media_path', uploadedMedia.path);
        formDataToSend.append('media_type', messageType);
      }

      const response = await api.post('/qr-templates', formDataToSend, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.success) {
        alert('✅ Template salvo com sucesso!');
        
        // Limpar campos do template
        // setTemplateData({ name: '', description: '' });
        
        // Perguntar se quer criar outro ou voltar
        const continuar = confirm('Deseja criar outro template?');
        if (!continuar) {
          // Voltar para modo envio
          // setTemplateMode(false);
        } else {
          // Limpar campos para criar novo
          setFormData({ ...formData, text: '', footerText: '' });
          setUploadedMedia(null);
          setButtons([{ id: Date.now().toString(), text: '', type: 'REPLY' }]);
          setChoices(['']);
          setCards([{
            id: Date.now().toString(),
            text: '',
            image: '',
            buttons: [],
            uploadingImage: false
          }]);
        }
      }
    } catch (error: any) {
      console.error('Erro ao salvar template:', error);
      notify.error('Erro ao Salvar', error.response?.data?.details || error.message);
    } finally {
      setSending(false);
    }
  };

  const handleTypeChange = (type: MessageType) => {
    setMessageType(type);
    // Resetar estados
    setUploadedMedia(null);
    // Limpar variáveis do template quando mudar de tipo manualmente
    setTemplateVariables({});
    setTemplateVariablesMap({});
    setTemplateOriginalText('');
    
    if (type === 'button') {
      setButtons([{ id: Date.now().toString(), text: '', type: 'REPLY' }]);
    } else if (type === 'poll') {
      setChoices(['', '', '']);
    } else if (type === 'list') {
      setChoices(['[Seção 1]', 'Item 1|id1|Descrição do item 1', '']);
    } else {
      setChoices(['']);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('📁 handleFileUpload chamado');
    const file = e.target.files?.[0];
    if (!file) {
      console.log('❌ Nenhum arquivo selecionado');
      return;
    }

    console.log('📁 Arquivo selecionado:', file.name, file.size, 'bytes');

    if (file.size > 16 * 1024 * 1024) {
      alert('❌ Arquivo muito grande! Máximo: 16MB');
      return;
    }

    console.log('📤 Iniciando upload...');
    setUploadingMedia(true);
    try {
      const response = await uploadAPI.uploadMedia(file);
      console.log('🔍 DEBUG - response completo:', response);
      console.log('🔍 DEBUG - response.data:', response.data);
      
      // ✅ Backend pode retornar de 2 formas:
      // 1. { success: true, data: { url, filename, ... } } - novo formato
      // 2. { url, filename, ... } - formato antigo
      const data = response.data.data || response.data;
      
      console.log('✅ Upload concluído - data extraído:', data);
      
      // Verificar se data.url existe
      if (!data.url) {
        throw new Error('URL do arquivo não foi retornada pelo servidor');
      }
      
      // ✅ Converter URL relativa para URL completa
      const fullUrl = data.url.startsWith('http') || data.url.startsWith('data:') || data.url.startsWith('blob:')
        ? data.url 
        : `${API_BASE_URL}${data.url}`;
      
      console.log('📎 URL do arquivo:', fullUrl);
      
      setUploadedMedia({
        ...data,
        url: fullUrl
      });
      
      console.log('✅ Upload completo e estado atualizado');
    } catch (err: any) {
      console.error('❌ Erro no upload:', err);
      notify.error('Erro no Upload', err.response?.data?.error || 'Erro ao fazer upload');
    } finally {
      console.log('🏁 Finalizando upload, resetando uploadingMedia');
      setUploadingMedia(false);
    }
  };

  const handleRemoveMedia = () => {
    setUploadedMedia(null);
    setRecordedAudioBlob(null);
    setRecordedAudioUrl('');
    setRecordedAudioDuration(0);
    setMediaPlaybackState({
      isPlaying: false,
      currentTime: 0,
      duration: 0
    });
    if (mediaRef.current) {
      mediaRef.current.pause();
      mediaRef.current = null;
    }
  };

  const handleAudioRecorded = async (audioBlob: Blob, audioUrl: string) => {
    setRecordedAudioBlob(audioBlob);
    setRecordedAudioUrl(audioUrl);
    
    const audio = new Audio(audioUrl);
    audio.addEventListener('loadedmetadata', () => {
      setRecordedAudioDuration(Math.floor(audio.duration));
    });
    
    setUploadingMedia(true);
    try {
      const audioFile = new File([audioBlob], 'audio-gravado.ogg', { type: 'audio/ogg; codecs=opus' });
      const response = await uploadAPI.uploadMedia(audioFile);
      const data = response.data.data || response.data;
      
      if (!data.url) {
        throw new Error('URL do arquivo não foi retornada pelo servidor');
      }
      
      // ✅ Converter URL relativa para URL completa
      const fullUrl = data.url.startsWith('http') || data.url.startsWith('data:') || data.url.startsWith('blob:')
        ? data.url 
        : `${API_BASE_URL}${data.url}`;
      
      setUploadedMedia({
        ...data,
        url: fullUrl,
        localAudioUrl: audioUrl
      });
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao fazer upload do áudio');
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleRemoveAudio = () => {
    setRecordedAudioBlob(null);
    setRecordedAudioUrl('');
    setRecordedAudioDuration(0);
    setUploadedMedia(null);
    setMediaMode('upload');
  };

  const handleMultipleAudiosChange = (audios: any[]) => {
    setRecordedAudios(audios);
  };

  const handleMultipleAudiosUpload = async (audios: any[]) => {
    const uploaded = [];
    
    for (const audio of audios) {
      try {
        const audioFile = new File([audio.blob], `audio-${audio.id}.ogg`, { type: 'audio/ogg; codecs=opus' });
        const response = await uploadAPI.uploadMedia(audioFile);
        const data = response.data.data || response.data;
        
        if (data.url) {
          // ✅ Converter URL relativa para URL completa
          const fullUrl = data.url.startsWith('http') || data.url.startsWith('data:') || data.url.startsWith('blob:')
            ? data.url 
            : `${API_BASE_URL}${data.url}`;
          
          uploaded.push({
            ...audio,
            uploadedData: {
              ...data,
              url: fullUrl
            }
          });
        }
      } catch (err) {
        console.error('Erro ao fazer upload do áudio:', err);
      }
    }
    
    setUploadedAudios(uploaded);
  };

  const handleMultipleFilesChange = (files: any[]) => {
    setSelectedFiles(files);
  };

  const toggleMediaPlayPause = () => {
    if (mediaRef.current) {
      if (mediaPlaybackState.isPlaying) {
        mediaRef.current.pause();
        setMediaPlaybackState({ ...mediaPlaybackState, isPlaying: false });
      } else {
        mediaRef.current.play();
        setMediaPlaybackState({ ...mediaPlaybackState, isPlaying: true });
      }
    }
  };

  const handleMediaTimeUpdate = () => {
    if (mediaRef.current) {
      setMediaPlaybackState({
        ...mediaPlaybackState,
        currentTime: mediaRef.current.currentTime,
        duration: mediaRef.current.duration
      });
    }
  };

  const handleMediaSeek = (time: number) => {
    if (mediaRef.current) {
      mediaRef.current.currentTime = time;
      setMediaPlaybackState({ ...mediaPlaybackState, currentTime: time });
    }
  };

  const formatMediaTime = (seconds: number) => {
    if (isNaN(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Funções para gerenciar botões
  const addButton = () => {
    if (buttons.length < 3) {
      setButtons([...buttons, {
        id: Date.now().toString(),
        text: '',
        type: 'REPLY'
      }]);
    }
  };

  const removeButton = (id: string) => {
    if (buttons.length > 1) {
      setButtons(buttons.filter(btn => btn.id !== id));
    }
  };

  const updateButton = (id: string, field: keyof ButtonOption, value: any) => {
    setButtons(buttons.map(btn =>
      btn.id === id ? { ...btn, [field]: value } : btn
    ));
  };

  // Funções para gerenciar choices (lista/poll)
  const addChoice = () => {
    setChoices([...choices, '']);
  };

  const removeChoice = (index: number) => {
    if (choices.length > 1) {
      setChoices(choices.filter((_, i) => i !== index));
    }
  };

  const updateChoice = (index: number, value: string) => {
    const newChoices = [...choices];
    newChoices[index] = value;
    setChoices(newChoices);
  };

  // Funções para gerenciar carrossel
  const addCard = () => {
    const newCard: Card = {
      id: Date.now().toString(),
      text: '',
      image: '',
      buttons: [],
      uploadingImage: false
    };
    setCards([...cards, newCard]);
  };

  const removeCard = (cardId: string) => {
    if (cards.length > 1) {
      setCards(cards.filter(card => card.id !== cardId));
    } else {
      notify.error('Card Obrigatório', 'Você precisa ter pelo menos 1 card no carrossel');
    }
  };

  const updateCard = (cardId: string, field: string, value: any) => {
    setCards(prevCards => prevCards.map(card => 
      card.id === cardId ? { ...card, [field]: value } : card
    ));
  };

  const handleCardImageUpload = async (cardId: string, file: File) => {
    if (file.size > 16 * 1024 * 1024) {
      alert('❌ Arquivo muito grande! Máximo: 16MB');
      return;
    }

    setCards(cards.map(card => 
      card.id === cardId ? { ...card, uploadingImage: true } : card
    ));

    try {
      const response = await uploadAPI.uploadMedia(file);
      const uploadedData = response.data.data || response.data;
      
      if (!uploadedData.url) {
        throw new Error('URL da imagem não foi retornada pelo servidor');
      }
      
      const imageUrl = uploadedData.url.startsWith('http') 
        ? uploadedData.url 
        : `${API_BASE_URL}${uploadedData.url}`;

      setCards(cards.map(card => 
        card.id === cardId ? { 
          ...card, 
          image: imageUrl,
          uploadedImage: uploadedData,
          uploadingImage: false
        } : card
      ));
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      notify.error('Erro no Upload', 'Erro ao fazer upload da imagem');
      setCards(cards.map(card => 
        card.id === cardId ? { ...card, uploadingImage: false } : card
      ));
    }
  };

  const addButtonToCard = (cardId: string) => {
    const card = cards.find(c => c.id === cardId);
    if (card && card.buttons.length >= 3) {
      notify.warning('Limite de Botões', 'Máximo de 3 botões por card');
      return;
    }

    const newButton: ButtonOption = {
      id: Date.now().toString(),
      text: '',
      type: 'REPLY'
    };

    setCards(cards.map(card => 
      card.id === cardId 
        ? { ...card, buttons: [...card.buttons, newButton] }
        : card
    ));
  };

  const removeButtonFromCard = (cardId: string, buttonId: string) => {
    setCards(cards.map(card => 
      card.id === cardId 
        ? { ...card, buttons: card.buttons.filter(btn => btn.id !== buttonId) }
        : card
    ));
  };

  const updateCardButton = (cardId: string, buttonId: string, field: string, value: any) => {
    setCards(prevCards => prevCards.map(card => 
      card.id === cardId 
        ? {
            ...card,
            buttons: card.buttons.map(btn =>
              btn.id === buttonId ? { ...btn, [field]: value } : btn
            )
          }
        : card
    ));
  };

  const getMessageTypeIcon = (type: MessageType | '') => {
    switch (type) {
      case 'text': return '✉️';
      case 'image': return '🖼️';
      case 'video': return '🎥';
      case 'audio': return '🎵';
      case 'document': return '📄';
      case 'button': return '🔘';
      case 'list': return '📋';
      case 'poll': return '📊';
      case 'carousel': return '🎠';
      case 'combined': return '🔥';
    }
  };

  const getMessageTypeLabel = (type: MessageType | '') => {
    switch (type) {
      case 'text': return 'Texto';
      case 'image': return 'Imagem';
      case 'video': return 'Vídeo';
      case 'audio': return 'Áudio';
      case 'document': return 'Documento';
      case 'button': return 'Botões';
      case 'list': return 'Lista';
      case 'poll': return 'Enquete';
      case 'carousel': return 'Carrossel';
      case 'combined': return 'Mensagem Combinada';
      default: return 'Mensagem';
    }
  };

  // Funções para gerenciar blocos da mensagem combinada
  const addMessageBlock = (type: Exclude<MessageType, 'combined'>) => {
    const newBlock: MessageBlock = {
      id: Date.now().toString(),
      type,
      order: messageBlocks.length,
      text: '',
      buttons: type === 'button' ? [{ id: Date.now().toString(), text: '', type: 'REPLY' }] : undefined,
      choices: (type === 'list' || type === 'poll') ? [''] : undefined,
      cards: type === 'carousel' ? [{
        id: Date.now().toString(),
        text: '',
        image: '',
        buttons: [],
        uploadingImage: false
      }] : undefined,
      listButton: type === 'list' ? 'Ver Opções' : undefined,
      selectableCount: type === 'poll' ? 1 : undefined,
    };
    setMessageBlocks([...messageBlocks, newBlock]);
    setShowAddBlockMenu(false);
  };

  const removeMessageBlock = (blockId: string) => {
    setMessageBlocks(messageBlocks.filter(b => b.id !== blockId));
  };

  const updateMessageBlock = (blockId: string, updates: Partial<MessageBlock>) => {
    setMessageBlocks(prevBlocks => prevBlocks.map(block =>
      block.id === blockId ? { ...block, ...updates } : block
    ));
  };

  const moveBlockUp = (blockId: string) => {
    const index = messageBlocks.findIndex(b => b.id === blockId);
    if (index > 0) {
      const newBlocks = [...messageBlocks];
      [newBlocks[index - 1], newBlocks[index]] = [newBlocks[index], newBlocks[index - 1]];
      setMessageBlocks(newBlocks.map((block, idx) => ({ ...block, order: idx })));
    }
  };

  const moveBlockDown = (blockId: string) => {
    const index = messageBlocks.findIndex(b => b.id === blockId);
    if (index < messageBlocks.length - 1) {
      const newBlocks = [...messageBlocks];
      [newBlocks[index], newBlocks[index + 1]] = [newBlocks[index + 1], newBlocks[index]];
      setMessageBlocks(newBlocks.map((block, idx) => ({ ...block, order: idx })));
    }
  };

  const handleDragStart = (blockId: string) => {
    setDraggedBlockId(blockId);
  };

  const handleDragOver = (e: React.DragEvent, blockId: string) => {
    e.preventDefault();
    if (!draggedBlockId || draggedBlockId === blockId) return;
    
    const draggedIndex = messageBlocks.findIndex(b => b.id === draggedBlockId);
    const targetIndex = messageBlocks.findIndex(b => b.id === blockId);
    
    const newBlocks = [...messageBlocks];
    const [draggedBlock] = newBlocks.splice(draggedIndex, 1);
    newBlocks.splice(targetIndex, 0, draggedBlock);
    
    setMessageBlocks(newBlocks.map((block, idx) => ({ ...block, order: idx })));
  };

  const handleDragEnd = () => {
    setDraggedBlockId(null);
  };

  // ==================== SISTEMA DE FILA DE ENVIOS ====================
  
  // Sincronizar com localStorage
  useEffect(() => {
    if (sendingJobs.length > 0) {
      localStorage.setItem('sendingJobs', JSON.stringify(sendingJobs));
    }
  }, [sendingJobs]);

  // Listener para eventos de atualização de outras páginas
  useEffect(() => {
    const loadJobs = () => {
      const storedJobs = localStorage.getItem('sendingJobs');
      if (storedJobs) {
        const jobs = JSON.parse(storedJobs);
        setSendingJobs(jobs);
      }
    };
    
    // Listener para eventos customizados de atualização de jobs
    const handleJobUpdate = (event: any) => {
      console.log('📢 Evento "sendingJobUpdated" recebido na página de envio:', event.detail);
      loadJobs(); // Recarregar imediatamente
    };
    
    // Listener para mudanças no localStorage (outras abas/janelas)
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'sendingJobs') {
        console.log('📢 localStorage alterado em outra aba');
        loadJobs();
      }
    };
    
    window.addEventListener('sendingJobUpdated', handleJobUpdate);
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('sendingJobUpdated', handleJobUpdate);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Adicionar job à fila
  const addSendingJob = (job: SendingJob) => {
    setSendingJobs(prev => {
      const newJobs = [...prev, job];
      localStorage.setItem('sendingJobs', JSON.stringify(newJobs));
      return newJobs;
    });
  };

  // Atualizar progresso do job
  const updateJobProgress = (jobId: string, updates: Partial<SendingJob>) => {
    console.log('🔄 updateJobProgress chamada:', { jobId, updates });
    
    setSendingJobs(prev => {
      const jobToUpdate = prev.find(j => j.id === jobId);
      console.log('   ├─ Job encontrado:', jobToUpdate ? 'SIM' : 'NÃO');
      
      const newJobs = prev.map(job => 
        job.id === jobId ? { ...job, ...updates } : job
      );
      
      const updatedJob = newJobs.find(j => j.id === jobId);
      console.log('   ├─ Novo status:', updatedJob?.status);
      console.log('   └─ Salvando no localStorage...');
      
      localStorage.setItem('sendingJobs', JSON.stringify(newJobs));
      return newJobs;
    });
  };

  // Pausar job
  const pauseJob = (jobId: string) => {
    setSendingJobs(prev => {
      const newJobs = prev.map(job =>
        job.id === jobId ? { ...job, status: 'paused' as const, pauseRequested: true } : job
      );
      localStorage.setItem('sendingJobs', JSON.stringify(newJobs));
      return newJobs;
    });
  };

  // Retomar job
  const resumeJob = (jobId: string) => {
    setSendingJobs(prev => {
      const newJobs = prev.map(job =>
        job.id === jobId ? { ...job, status: 'sending' as const, pauseRequested: false } : job
      );
      localStorage.setItem('sendingJobs', JSON.stringify(newJobs));
      return newJobs;
    });
  };

  // Cancelar job
  const cancelJob = (jobId: string) => {
    setSendingJobs(prev => {
      const newJobs = prev.map(job =>
        job.id === jobId ? { ...job, status: 'cancelled' as const, cancelRequested: true } : job
      );
      localStorage.setItem('sendingJobs', JSON.stringify(newJobs));
      return newJobs;
    });
  };

  // Remover job da fila
  const removeJob = (jobId: string) => {
    setSendingJobs(prev => {
      const newJobs = prev.filter(job => job.id !== jobId);
      localStorage.setItem('sendingJobs', JSON.stringify(newJobs));
      return newJobs;
    });
  };

  // Limpar jobs completados
  const clearCompletedJobs = () => {
    setSendingJobs(prev => prev.filter(job => 
      job.status !== 'completed' && job.status !== 'error' && job.status !== 'cancelled'
    ));
  };

  // Mostrar notificação toast
  const showNotification = (
    message: string,
    type: 'success' | 'error' | 'warning' | 'info' = 'info',
    duration = 3001
  ) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), duration);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 🚫 Bloquear múltiplos cliques - prevenir envios duplicados
    if (sending) {
      console.log('⚠️ Envio já em andamento, aguarde...');
      return;
    }

    if (!formData.instance_id) {
      notify.warning('Instância Necessária', 'Por favor, selecione uma instância');
      return;
    }

    if (!formData.number) {
      notify.warning('Número Necessário', 'Por favor, digite o número de destino');
      return;
    }

    if (formData.number.length < 12 || formData.number.length > 13) {
      notify.error('Número Inválido', 'Use o formato: 5562999999999 (com DDI + DDD)');
      return;
    }

    // ✅ VERIFICAR STATUS DA INSTÂNCIA EM TEMPO REAL ANTES DE ENVIAR
    console.log('🔍 Verificando status da instância em tempo real antes de enviar...');
    try {
      const statusResponse = await api.get(`/uaz/instances/${formData.instance_id}/status`);
      console.log('📊 Status recebido:', statusResponse.data);
      
      // Verificar se houve erro na resposta (ex: Invalid token)
      if (statusResponse.data.success === false) {
        const errorMsg = statusResponse.data.error || 'Erro desconhecido';
        
        if (errorMsg.toLowerCase().includes('invalid token')) {
          showNotification(
            '❌ Token da instância inválido! A conexão precisa ser recriada. Vá em "Gerenciar Conexões" e delete esta instância, depois crie uma nova.',
            'error',
            10000
          );
          console.log('❌ Token inválido detectado. Instância precisa ser recriada.');
        } else {
          showNotification(`Erro ao verificar conexão: ${errorMsg}`, 'error');
          console.log('❌ Erro na verificação:', errorMsg);
        }
        return;
      }
      
      // Verificar se está conectada
      if (!statusResponse.data.connected) {
        showNotification('WhatsApp desconectado! Reconecte em "Gerenciar Conexões" e leia o QR Code novamente.', 'error');
        console.log('❌ Instância desconectada, envio cancelado');
        return;
      }
      
      console.log('✅ Instância conectada, prosseguindo com o envio...');
    } catch (error: any) {
      console.error('❌ Erro ao verificar status:', error);
      showNotification('Erro ao verificar conexão! Verifique se o servidor está rodando e tente novamente.', 'error');
      return;
    }

    // 🚨 VERIFICAR LISTA DE RESTRIÇÃO **ANTES** DE CRIAR O JOB
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
        
        notify.error(
          'Número Bloqueado!',
          `O número ${formData.number} está na lista: ${listNames}`
        );
        
        showNotification(`🚫 Número bloqueado! Está na lista: ${listNames}`, 'error');
        return; // ❌ NÃO CRIAR O JOB
      }
      
      console.log('✅ Número livre, prosseguindo...');
    } catch (restrictionError: any) {
      console.error('❌ Erro ao verificar lista de restrição:', restrictionError);
      // Se der erro na verificação, permitir envio (fail-open)
      // Mas avisar o usuário
      if (restrictionError.response?.status === 403) {
        const errorMsg = restrictionError.response?.data?.error || 'Número bloqueado na lista de restrição';
        notify.error('Número Bloqueado!', errorMsg);
        showNotification(`🚫 ${errorMsg}`, 'error');
        return; // ❌ NÃO CRIAR O JOB
      }
    }

    // 🔒 Desabilitar botão de envio para prevenir cliques duplicados
    setSending(true);

    // Criar job para mensagens simples ou combinadas
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const job: SendingJob = {
      id: jobId,
      type: messageType === 'combined' ? 'combined' : 'simple',
      status: 'sending',
      progress: 0,
      totalBlocks: messageType === 'combined' ? messageBlocks.length : 1,
      currentBlock: 0,
      targetNumber: formData.number,
      instanceId: formData.instance_id,
      startedAt: new Date(),
      messageType: messageType || undefined,
      blocks: messageType === 'combined' ? messageBlocks : undefined
    };

    addSendingJob(job);

    // Mostrar notificação de que está processando
    showNotification('📤 Enviando mensagem... Acompanhe em "Envios em Andamento"', 'info');

    // NÃO bloquear o botão - permitir múltiplos envios simultâneos
    // setSending(true); // REMOVIDO - botão fica sempre disponível

    try {
      // ⏱️ APLICAR DELAY ANTES DE ENVIAR COM VERIFICAÇÃO EM TEMPO REAL
      console.log(`⏱️ Aguardando ${delayBeforeSending}s antes de enviar (configurado em Delays)...`);
      
      const delayMs = delayBeforeSending * 1000;
      const startTime = Date.now();
      
      while (Date.now() - startTime < delayMs) {
        // ✅ Verificar cancelamento do localStorage (tempo real)
        const stored = localStorage.getItem('sendingJobs');
        const jobs = stored ? JSON.parse(stored) : [];
        const currentJob = jobs.find((j: any) => j.id === jobId);
        
        if (currentJob?.cancelRequested || currentJob?.status === 'cancelled') {
          console.log('🛑 Envio cancelado durante o delay inicial');
          updateJobProgress(jobId, { status: 'cancelled', progress: 100, error: 'Cancelado pelo usuário' });
          return;
        }
        
        // Aguardar se pausado
        while (currentJob?.pauseRequested || currentJob?.status === 'paused') {
          console.log('⏸️ Delay inicial pausado, aguardando...');
          await new Promise(resolve => setTimeout(resolve, 500));
          
          const recheckStored = localStorage.getItem('sendingJobs');
          const recheckJobs = recheckStored ? JSON.parse(recheckStored) : [];
          const recheckJob = recheckJobs.find((j: any) => j.id === jobId);
          
          if (recheckJob?.cancelRequested || recheckJob?.status === 'cancelled') {
            console.log('🛑 Envio cancelado durante pausa no delay inicial');
            updateJobProgress(jobId, { status: 'cancelled', progress: 100, error: 'Cancelado pelo usuário' });
            return;
          }
          
          if (!recheckJob?.pauseRequested && recheckJob?.status !== 'paused') break;
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      let response;

      switch (messageType) {
        case 'text':
          if (!formData.text) {
            notify.error('Mensagem Necessária', 'Por favor, digite uma mensagem');
            return;
          }
          
          // 🔤 PROCESSAR VARIÁVEIS AUTOMÁTICAS
          let processedText = formData.text;
          const now = new Date();
          const autoVars = {
            data: now.toLocaleDateString('pt-BR'),
            hora: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            protocolo: `${now.getTime()}${Math.floor(Math.random() * 1000)}`,
            saudacao: (() => {
              const hour = now.getHours();
              if (hour >= 6 && hour < 12) return 'Bom dia';
              if (hour >= 12 && hour < 18) return 'Boa tarde';
              return 'Boa noite';
            })(),
            saudação: (() => {
              const hour = now.getHours();
              if (hour >= 6 && hour < 12) return 'Bom dia';
              if (hour >= 12 && hour < 18) return 'Boa tarde';
              return 'Boa noite';
            })()
          };
          
          // Substituir variáveis
          Object.entries(autoVars).forEach(([key, value]) => {
            const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'gi');
            processedText = processedText.replace(regex, value);
          });
          
          console.log('🔤 Texto original:', formData.text);
          console.log('🔤 Texto processado:', processedText);
          
          response = await api.post(`/uaz/instances/${formData.instance_id}/send-text`, {
            number: formData.number,
            text: processedText,
            variables: templateVariables
          });
          break;

        case 'image':
        case 'video':
        case 'audio':
        case 'document':
          // ✅ TRATAMENTO ESPECIAL PARA ÁUDIOS GRAVADOS (MÚLTIPLOS)
          if (messageType === 'audio' && recordedAudios.length > 0 && !uploadedMedia) {
            console.log(`🎤 Detectado ${recordedAudios.length} áudio(s) gravado(s). Fazendo upload e enviando...`);
            showNotification('📤 Enviando áudio gravado...', 'info');
            
            try {
              // Se houver áudios já uploadados, usar o primeiro
              if (uploadedAudios.length > 0 && uploadedAudios[0].uploadedData) {
                console.log('✅ Usando áudio já uploadado:', uploadedAudios[0].uploadedData.url);
                response = await api.post(`/uaz/instances/${formData.instance_id}/send-audio`, {
                  number: formData.number,
                  audio: uploadedAudios[0].uploadedData.url,
                  variables: templateVariables
                });
              } else {
                // Fazer upload do primeiro áudio gravado
                const firstAudio = recordedAudios[0];
                console.log('📤 Fazendo upload do primeiro áudio gravado...');
                
                const audioFile = new File([firstAudio.blob], `audio-${firstAudio.id}.ogg`, { type: 'audio/ogg; codecs=opus' });
                const uploadResponse = await uploadAPI.uploadMedia(audioFile);
                const uploadData = uploadResponse.data.data || uploadResponse.data;
                
                if (!uploadData.url) {
                  throw new Error('URL do áudio não foi retornada pelo servidor');
                }
                
                const fullUrl = uploadData.url.startsWith('http')
                  ? uploadData.url 
                  : `${API_BASE_URL}${uploadData.url}`;
                
                console.log('✅ Upload concluído. URL:', fullUrl);
                
                // Enviar o áudio
                response = await api.post(`/uaz/instances/${formData.instance_id}/send-audio`, {
                  number: formData.number,
                  audio: fullUrl,
                  variables: templateVariables
                });
              }
              
              console.log('✅ Áudio gravado enviado com sucesso!');
              break;
            } catch (uploadError: any) {
              console.error('❌ Erro ao enviar áudio gravado:', uploadError);
              throw uploadError;
            }
          }
          
          // ✅ TRATAMENTO ESPECIAL PARA ÁUDIO GRAVADO (SINGULAR)
          if (messageType === 'audio' && recordedAudioBlob && !uploadedMedia) {
            console.log('🎤 Detectado áudio gravado único. Fazendo upload...');
            showNotification('📤 Enviando áudio gravado...', 'info');
            
            try {
              const audioFile = new File([recordedAudioBlob], 'audio-gravado.ogg', { type: 'audio/ogg; codecs=opus' });
              const uploadResponse = await uploadAPI.uploadMedia(audioFile);
              const uploadData = uploadResponse.data.data || uploadResponse.data;
              
              if (!uploadData.url) {
                throw new Error('URL do áudio não foi retornada pelo servidor');
              }
              
              const fullUrl = uploadData.url.startsWith('http')
                ? uploadData.url 
                : `${API_BASE_URL}${uploadData.url}`;
              
              // Enviar o áudio
              response = await api.post(`/uaz/instances/${formData.instance_id}/send-audio`, {
                number: formData.number,
                audio: fullUrl,
                variables: templateVariables
              });
              
              console.log('✅ Áudio gravado enviado com sucesso!');
              break;
            } catch (uploadError: any) {
              console.error('❌ Erro ao enviar áudio gravado:', uploadError);
              throw uploadError;
            }
          }
          
          if (!uploadedMedia) {
            notify.error('Arquivo Necessário', 'Por favor, faça upload do arquivo');
            return;
          }
          const mediaUrl = uploadedMedia.url.startsWith('http') 
            ? uploadedMedia.url 
            : `${API_BASE_URL}${uploadedMedia.url}`;

          const endpoints = {
            image: 'send-image',
            video: 'send-video',
            audio: 'send-audio',
            document: 'send-document'
          };

          // 🔤 PROCESSAR VARIÁVEIS AUTOMÁTICAS NO CAPTION
          let processedCaption = formData.text || '';
          if (processedCaption) {
            const nowCaption = new Date();
            const autoVarsCaption = {
              data: nowCaption.toLocaleDateString('pt-BR'),
              hora: nowCaption.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
              protocolo: `${nowCaption.getTime()}${Math.floor(Math.random() * 1000)}`,
              saudacao: (() => {
                const hour = nowCaption.getHours();
                if (hour >= 6 && hour < 12) return 'Bom dia';
                if (hour >= 12 && hour < 18) return 'Boa tarde';
                return 'Boa noite';
              })(),
              saudação: (() => {
                const hour = nowCaption.getHours();
                if (hour >= 6 && hour < 12) return 'Bom dia';
                if (hour >= 12 && hour < 18) return 'Boa tarde';
                return 'Boa noite';
              })()
            };
            
            Object.entries(autoVarsCaption).forEach(([key, value]) => {
              const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'gi');
              processedCaption = processedCaption.replace(regex, value);
            });
          }

          const payload: any = { 
            number: formData.number,
            variables: templateVariables
          };
          
          if (messageType === 'image') {
            payload.image = mediaUrl;
            payload.caption = processedCaption;
          } else if (messageType === 'video') {
            payload.video = mediaUrl;
            payload.caption = processedCaption;
          } else if (messageType === 'audio') {
            payload.audio = mediaUrl;
          } else if (messageType === 'document') {
            payload.document = mediaUrl;
            payload.filename = uploadedMedia.originalname || 'documento.pdf';
            payload.caption = processedCaption;
          }

          response = await api.post(
            `/uaz/instances/${formData.instance_id}/${endpoints[messageType]}`,
            payload
          );
          break;

        case 'button':
          const validButtons = buttons.filter(btn => btn.text.trim() !== '');
          
          if (validButtons.length === 0) {
            notify.error('Botões Necessários', 'Adicione pelo menos um botão');
            return;
          }

          const buttonChoices = validButtons.map(btn => {
            let choice = btn.text;
            switch (btn.type) {
              case 'URL':
                if (!btn.url) { notify.error('URL Obrigatória', `Botão "${btn.text}": URL é obrigatória`); throw new Error('URL missing'); }
                choice += `|${btn.url}`;
                break;
              case 'CALL':
                if (!btn.phone_number) { notify.error('Telefone Obrigatório', `Botão "${btn.text}": Número de telefone é obrigatório`); throw new Error('Phone missing'); }
                choice += `|call:${btn.phone_number}`;
                break;
              case 'COPY':
                if (!btn.copy_code) { notify.error('Código Obrigatório', `Botão "${btn.text}": Código para copiar é obrigatório`); throw new Error('Code missing'); }
                choice += `|copy:${btn.copy_code}`;
                break;
              case 'REPLY':
              default:
                choice += `|${btn.text}`;
                break;
            }
            return choice;
          });

          const buttonPayload: any = {
            number: formData.number,
            type: 'button',
            text: formData.text,
            choices: buttonChoices,
            variables: templateVariables
          };

          if (formData.footerText) buttonPayload.footerText = formData.footerText;
          if (uploadedMedia) {
            const imageUrl = uploadedMedia.url.startsWith('http') 
              ? uploadedMedia.url 
              : `${API_BASE_URL}${uploadedMedia.url}`;
            buttonPayload.imageButton = imageUrl;
          }

          response = await api.post(
            `/uaz/instances/${formData.instance_id}/send-menu`,
            buttonPayload
          );
          break;

        case 'list':
          const validListChoices = choices.filter(c => c.trim() !== '');
          
          if (validListChoices.length === 0) {
            notify.error('Opções Necessárias', 'Adicione pelo menos uma opção');
            return;
          }

          response = await api.post(`/uaz/instances/${formData.instance_id}/send-menu`, {
            number: formData.number,
            type: 'list',
            text: formData.text,
            choices: validListChoices,
            listButton: formData.listButton,
            footerText: formData.footerText || undefined,
            variables: templateVariables
          });
          break;

        case 'poll':
          const validPollChoices = choices.filter(c => c.trim() !== '');
          
          if (validPollChoices.length < 2) {
            notify.error('Opções Insuficientes', 'Enquetes precisam de pelo menos 2 opções');
            return;
          }

          response = await api.post(`/uaz/instances/${formData.instance_id}/send-menu`, {
            number: formData.number,
            type: 'poll',
            text: formData.text,
            choices: validPollChoices,
            selectableCount: formData.selectableCount,
            variables: templateVariables
          });
          break;

        case 'carousel':
          // Validar cards
          if (cards.length === 0) {
            alert('❌ Adicione pelo menos 1 card ao carrossel');
            return;
          }

          for (const card of cards) {
            if (!card.text) {
              alert('❌ Todos os cards precisam ter texto');
              return;
            }
            if (!card.image) {
              alert('❌ Todos os cards precisam ter imagem');
              return;
            }
            if (card.buttons.length === 0) {
              alert('❌ Cada card precisa ter pelo menos 1 botão');
              return;
            }
            for (const button of card.buttons) {
              if (!button.text) {
                alert('❌ Todos os botões precisam ter texto');
                return;
              }
              if (button.type === 'URL' && !button.url) {
                alert('❌ Botões do tipo URL precisam ter uma URL');
                return;
              }
              if (button.type === 'CALL' && !button.phone_number) {
                alert('❌ Botões do tipo CALL precisam ter um número de telefone');
                return;
              }
              if (button.type === 'COPY' && !button.copy_code) {
                alert('❌ Botões do tipo COPY precisam ter um código para copiar');
                return;
              }
            }
          }

          const carouselData = {
            number: formData.number,
            text: formData.text,
            cards: cards.map(card => ({
              text: card.text,
              image: card.image,
              buttons: card.buttons.map(btn => {
                const buttonData: any = {
                  text: btn.text,
                  type: btn.type
                };

                if (btn.type === 'URL' && btn.url) {
                  buttonData.url = btn.url;
                }
                if (btn.type === 'CALL' && btn.phone_number) {
                  buttonData.phone_number = btn.phone_number;
                }
                if (btn.type === 'COPY' && btn.copy_code) {
                  buttonData.copy_code = btn.copy_code;
                }

                return buttonData;
              })
            })),
            variables: templateVariables
          };

          response = await api.post(
            `/uaz/instances/${formData.instance_id}/send-carousel`,
            carouselData
          );
          break;

        case 'combined':
          // Validar blocos
          if (messageBlocks.length === 0) {
            alert('❌ Adicione pelo menos um bloco de mensagem');
            updateJobProgress(jobId, { status: 'error', progress: 100, error: 'Nenhum bloco adicionado' });
            return;
          }

          console.log('🔥 Enviando mensagem combinada com', messageBlocks.length, 'blocos');
          console.log('⏱️ DELAYS CONFIGURADOS:');
          console.log(`   └─ Delay antes de enviar: ${delayBeforeSending}s (JÁ APLICADO)`);
          console.log(`   └─ Delay entre blocos: ${delayBetweenMessages}s (será aplicado entre cada bloco)`);

          // Enviar cada bloco em sequência
          for (let i = 0; i < messageBlocks.length; i++) {
            // ✅ VERIFICAÇÃO EM TEMPO REAL: Buscar do localStorage (não do estado)
            const storedJobs = localStorage.getItem('sendingJobs');
            const currentJobs = storedJobs ? JSON.parse(storedJobs) : [];
            const currentJob = currentJobs.find((j: any) => j.id === jobId);
            
            // ✅ VERIFICAR CANCELAMENTO
            if (currentJob?.cancelRequested || currentJob?.status === 'cancelled') {
              console.log('🛑 Envio cancelado pelo usuário');
              updateJobProgress(jobId, { status: 'cancelled', progress: 100, error: 'Cancelado pelo usuário' });
              return;
            }
            
            // ✅ AGUARDAR ENQUANTO PAUSADO
            while (currentJob?.pauseRequested || currentJob?.status === 'paused') {
              console.log('⏸️ Envio pausado, aguardando retomada...');
              await new Promise(resolve => setTimeout(resolve, 500));
              
              // Re-verificar status
              const recheck = localStorage.getItem('sendingJobs');
              const recheckJobs = recheck ? JSON.parse(recheck) : [];
              const recheckJob = recheckJobs.find((j: any) => j.id === jobId);
              
              if (recheckJob?.cancelRequested || recheckJob?.status === 'cancelled') {
                console.log('🛑 Envio cancelado durante pausa');
                updateJobProgress(jobId, { status: 'cancelled', progress: 100, error: 'Cancelado pelo usuário' });
                return;
              }
              
              if (!recheckJob?.pauseRequested && recheckJob?.status !== 'paused') break;
            }

            const block = messageBlocks[i];
            console.log(`\n📤 Enviando bloco ${i + 1}/${messageBlocks.length} (tipo: ${block.type})`);
            
            // Atualizar progresso
            updateJobProgress(jobId, { 
              currentBlock: i + 1, 
              progress: Math.floor(((i + 1) / messageBlocks.length) * 100) 
            });

            try {
              let blockResponse;

              switch (block.type) {
                case 'text':
                  if (!block.text) {
                    alert(`❌ Bloco ${i + 1} (Texto): Texto é obrigatório`);
                    throw new Error('Text missing');
                  }
                  blockResponse = await api.post(`/uaz/instances/${formData.instance_id}/send-text`, {
                    number: formData.number,
                    text: block.text,
                    variables: templateVariables
                  });
                  break;

                case 'image':
                case 'video':
                case 'audio':
                case 'document':
                  if (!block.media) {
                    alert(`❌ Bloco ${i + 1} (${getMessageTypeLabel(block.type)}): Arquivo é obrigatório`);
                    throw new Error('Media missing');
                  }
                  
                  const mediaUrl = block.media.url.startsWith('http') 
                    ? block.media.url 
                    : `${API_BASE_URL}${block.media.url}`;

                  const endpoints = {
                    image: 'send-image',
                    video: 'send-video',
                    audio: 'send-audio',
                    document: 'send-document'
                  };

                  const payload: any = { 
                    number: formData.number,
                    variables: templateVariables
                  };
                  
                  if (block.type === 'image') {
                    payload.image = mediaUrl;
                    payload.caption = block.text || '';
                  } else if (block.type === 'video') {
                    payload.video = mediaUrl;
                    payload.caption = block.text || '';
                  } else if (block.type === 'audio') {
                    payload.audio = mediaUrl;
                  } else if (block.type === 'document') {
                    payload.document = mediaUrl;
                    payload.filename = block.media.originalname || 'documento.pdf';
                    payload.caption = block.text || '';
                  }

                  blockResponse = await api.post(
                    `/uaz/instances/${formData.instance_id}/${endpoints[block.type]}`,
                    payload
                  );
                  break;

                case 'button':
                  if (!block.buttons || block.buttons.length === 0) {
                    alert(`❌ Bloco ${i + 1} (Botões): Adicione pelo menos um botão`);
                    throw new Error('Buttons missing');
                  }

                  const validButtons = block.buttons.filter(btn => btn.text && btn.text.trim() !== '');
                  if (validButtons.length === 0) {
                    alert(`❌ Bloco ${i + 1} (Botões): Adicione textos válidos aos botões`);
                    throw new Error('No valid buttons');
                  }

                  // Formatar botões no formato esperado pela API UAZ (strings com pipe |)
                  const formattedButtons = validButtons.map(btn => {
                    console.log('🔍 Processando botão:', btn);
                    
                    let choice = btn.text;
                    
                    switch (btn.type) {
                      case 'URL':
                        if (!btn.url) {
                          alert(`❌ Botão "${btn.text}": URL é obrigatória`);
                          throw new Error('URL missing');
                        }
                        choice += `|${btn.url}`;
                        console.log(`  ✅ Botão URL: ${choice}`);
                        break;
                        
                      case 'CALL':
                        if (!btn.phone_number) {
                          alert(`❌ Botão "${btn.text}": Número de telefone é obrigatório`);
                          throw new Error('Phone missing');
                        }
                        choice += `|call:${btn.phone_number}`;
                        console.log(`  ✅ Botão CALL: ${choice}`);
                        break;
                        
                      case 'COPY':
                        if (!btn.copy_code) {
                          alert(`❌ Botão "${btn.text}": Código para copiar é obrigatório`);
                          throw new Error('Code missing');
                        }
                        choice += `|copy:${btn.copy_code}`;
                        console.log(`  ✅ Botão COPY: ${choice}`);
                        break;
                        
                      case 'REPLY':
                      default:
                        choice += `|${btn.text}`;
                        console.log(`  ✅ Botão REPLY: ${choice}`);
                        break;
                    }
                    
                    return choice;
                  });

                  console.log('📤 Enviando botões formatados:', formattedButtons);

                  const buttonPayload: any = {
                    number: formData.number,
                    type: 'button',
                    text: block.text || '',
                    choices: formattedButtons,
                    footerText: block.footerText || '',
                  };

                  // Adicionar imagem do botão se houver
                  if (block.media?.url) {
                    const imageUrl = block.media.url.startsWith('http') 
                      ? block.media.url 
                      : `${API_BASE_URL}${block.media.url}`;
                    buttonPayload.imageButton = imageUrl;
                    console.log('🖼️ Adicionando imagem ao botão:', imageUrl);
                  }

                  blockResponse = await api.post(`/uaz/instances/${formData.instance_id}/send-menu`, buttonPayload);
                  break;

                case 'list':
                case 'poll':
                  if (!block.choices || block.choices.length === 0) {
                    alert(`❌ Bloco ${i + 1} (${getMessageTypeLabel(block.type)}): Adicione pelo menos uma opção`);
                    throw new Error('Choices missing');
                  }

                  const validChoices = block.choices.filter(c => c.trim() !== '');
                  if (validChoices.length === 0) {
                    alert(`❌ Bloco ${i + 1} (${getMessageTypeLabel(block.type)}): Adicione opções válidas`);
                    throw new Error('No valid choices');
                  }

                  blockResponse = await api.post(`/uaz/instances/${formData.instance_id}/send-menu`, {
                    number: formData.number,
                    type: block.type,
                    text: block.text || '',
                    choices: validChoices,
                    footerText: block.footerText || '',
                    listButton: block.listButton || 'Ver Opções',
                    selectableCount: block.selectableCount || 1,
                    variables: templateVariables
                  });
                  break;

                case 'carousel':
                  if (!block.cards || block.cards.length === 0) {
                    alert(`❌ Bloco ${i + 1} (Carrossel): Adicione pelo menos um card`);
                    throw new Error('Cards missing');
                  }

                  blockResponse = await api.post(`/uaz/instances/${formData.instance_id}/send-carousel`, {
                    number: formData.number,
                    text: block.text || '',
                    cards: block.cards.map(card => ({
                      text: card.text,
                      image: card.image,
                      buttons: card.buttons.map(btn => {
                        const buttonData: any = {
                          text: btn.text,
                          type: btn.type
                        };

                        if (btn.type === 'URL' && btn.url) buttonData.url = btn.url;
                        if (btn.type === 'CALL' && btn.phone_number) buttonData.phone_number = btn.phone_number;
                        if (btn.type === 'COPY' && btn.copy_code) buttonData.copy_code = btn.copy_code;

                        return buttonData;
                      })
                    })),
                    variables: templateVariables
                  });
                  break;
              }

              if (blockResponse?.data.success) {
                console.log(`✅ Bloco ${i + 1} enviado com sucesso`);
              } else {
                console.error(`❌ Erro no bloco ${i + 1}:`, blockResponse?.data.error);
                alert(`❌ Erro ao enviar bloco ${i + 1}: ${blockResponse?.data.error}`);
                throw new Error(`Block ${i + 1} failed`);
              }

              // Aguardar delay antes do próximo bloco (exceto no último)
              if (i < messageBlocks.length - 1) {
                console.log(`⏱️ Aguardando ${delayBetweenMessages}s antes do próximo bloco (configurado em Delays)...`);
                
                // ✅ Aplicar delay com verificação em TEMPO REAL
                const delayMs = delayBetweenMessages * 1000;
                const startDelay = Date.now();
                
                while (Date.now() - startDelay < delayMs) {
                  // ✅ Buscar status do localStorage (não do estado)
                  const stored = localStorage.getItem('sendingJobs');
                  const jobs = stored ? JSON.parse(stored) : [];
                  const jobStatus = jobs.find((j: any) => j.id === jobId);
                  
                  // ✅ Se cancelado, interromper IMEDIATAMENTE
                  if (jobStatus?.cancelRequested || jobStatus?.status === 'cancelled') {
                    console.log('🛑 Envio cancelado durante o delay entre blocos');
                    updateJobProgress(jobId, { status: 'cancelled', progress: 100, error: 'Cancelado pelo usuário' });
                    return;
                  }
                  
                  // ✅ Se pausado, aguardar
                  while (jobStatus?.pauseRequested || jobStatus?.status === 'paused') {
                    console.log('⏸️ Delay pausado, aguardando retomada...');
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                    // Re-verificar
                    const recheckStored = localStorage.getItem('sendingJobs');
                    const recheckJobs = recheckStored ? JSON.parse(recheckStored) : [];
                    const updatedJob = recheckJobs.find((j: any) => j.id === jobId);
                    
                    if (updatedJob?.cancelRequested || updatedJob?.status === 'cancelled') {
                      console.log('🛑 Envio cancelado durante pausa no delay');
                      updateJobProgress(jobId, { status: 'cancelled', progress: 100, error: 'Cancelado pelo usuário' });
                      return;
                    }
                    
                    if (!updatedJob?.pauseRequested && updatedJob?.status !== 'paused') break;
                  }
                  
                  await new Promise(resolve => setTimeout(resolve, 100));
                }
              }

            } catch (error: any) {
              console.error(`❌ Erro no bloco ${i + 1}:`, error);
              throw error;
            }
          }

          console.log('\n🎉 Mensagem combinada enviada completamente!');
          response = { data: { success: true } };
          break;
      }

      if (response?.data.success) {
        // ✅ ATUALIZAÇÃO IMEDIATA E GARANTIDA DO STATUS
        console.log('✅ Mensagem enviada com sucesso! Atualizando status para COMPLETED...');
        console.log('   ├─ Job ID:', jobId);
        console.log('   ├─ Tipo:', messageType);
        console.log('   └─ Progress: 100%');
        
        // Atualizar diretamente no localStorage PRIMEIRO (prioridade máxima)
        const savedJobs = localStorage.getItem('sendingJobs');
        if (savedJobs) {
          const jobs = JSON.parse(savedJobs);
          const updatedJobs = jobs.map((j: any) => 
            j.id === jobId 
              ? { 
                  ...j, 
                  status: 'completed', 
                  progress: 100, 
                  currentBlock: messageType === 'combined' ? messageBlocks.length : 1,
                  error: undefined // Limpar qualquer erro anterior
                }
              : j
          );
          localStorage.setItem('sendingJobs', JSON.stringify(updatedJobs));
          console.log('✅ Status atualizado DIRETAMENTE no localStorage!');
          
          // Disparar evento customizado para notificar outras páginas
          window.dispatchEvent(new CustomEvent('sendingJobUpdated', { 
            detail: { jobId, status: 'completed', progress: 100 } 
          }));
          console.log('📢 Evento "sendingJobUpdated" disparado para outras páginas');
        }
        
        // Atualizar o estado React também (para esta página)
        updateJobProgress(jobId, { 
          status: 'completed', 
          progress: 100,
          currentBlock: messageType === 'combined' ? messageBlocks.length : 1,
          error: undefined
        });

        // 💾 SALVAR MENSAGEM NO BANCO DE DADOS (HISTÓRICO PERMANENTE)
        try {
          console.log('💾 Salvando mensagem no histórico do banco de dados...');
          await api.post('/uaz/messages/save', {
            instanceId: formData.instance_id,
            phoneNumber: formData.number,
            messageType: messageType,
            messageContent: messageType === 'combined' ? messageBlocks : formData,
            status: 'completed',
            jobId: jobId
          });
          console.log('✅ Mensagem salva no banco com sucesso!');
        } catch (dbError) {
          console.error('⚠️ Erro ao salvar no banco (não afeta o envio):', dbError);
          // Não bloquear o fluxo se falhar ao salvar no banco
        }

        // NÃO mostrar notificação de sucesso aqui - o usuário verá em "Envios em Andamento"
        // A mensagem já foi adicionada à fila e está sendo processada
        
        // Limpar formulário para novo envio
        setFormData({
          ...formData,
          number: '',
          text: '',
          footerText: ''
        });
        setUploadedMedia(null);
        setButtons([{ id: Date.now().toString(), text: '', type: 'REPLY' }]);
        setChoices(['']);
        setCards([{
          id: Date.now().toString(),
          text: '',
          image: '',
          buttons: [],
          uploadingImage: false
        }]);
        setMessageBlocks([]);
        
        // 🔓 Reabilitar botão de envio após sucesso
        setSending(false);
      } else {
        // ❌ ATUALIZAÇÃO IMEDIATA DO STATUS DE ERRO
        const errorMsg = response?.data.error || 'Erro desconhecido';
        console.log('❌ Erro ao enviar! Atualizando status para ERROR...');
        console.log('   └─ Erro:', errorMsg);
        
        // Atualizar diretamente no localStorage PRIMEIRO
        const savedJobs = localStorage.getItem('sendingJobs');
        if (savedJobs) {
          const jobs = JSON.parse(savedJobs);
          const updatedJobs = jobs.map((j: any) => 
            j.id === jobId 
              ? { ...j, status: 'error', progress: 100, error: errorMsg }
              : j
          );
          localStorage.setItem('sendingJobs', JSON.stringify(updatedJobs));
          
          // Disparar evento customizado
          window.dispatchEvent(new CustomEvent('sendingJobUpdated', { 
            detail: { jobId, status: 'error', progress: 100, error: errorMsg } 
          }));
        }
        
        // Atualizar o estado React também
        updateJobProgress(jobId, { 
          status: 'error', 
          progress: 100,
          error: errorMsg
        });

        // 💾 SALVAR ERRO NO BANCO DE DADOS (HISTÓRICO PERMANENTE)
        try {
          console.log('💾 Salvando erro no histórico do banco de dados...');
          await api.post('/uaz/messages/save', {
            instanceId: formData.instance_id,
            phoneNumber: formData.number,
            messageType: messageType,
            messageContent: messageType === 'combined' ? messageBlocks : formData,
            status: 'error',
            error: errorMsg,
            jobId: jobId
          });
          console.log('✅ Erro salvo no banco!');
        } catch (dbError) {
          console.error('⚠️ Erro ao salvar no banco:', dbError);
        }
        
        // NÃO mostrar notificação de erro aqui - o erro já foi registrado no job
        // O usuário verá em "Envios em Andamento"
        
        // 🔓 Reabilitar botão de envio após erro
        setSending(false);
      }
    } catch (error: any) {
      console.error('❌ Erro:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Erro desconhecido';
      
      // ❌ ATUALIZAÇÃO IMEDIATA DO STATUS DE ERRO (catch)
      console.log('❌ Exceção capturada! Atualizando status para ERROR...');
      console.log('   └─ Erro:', errorMessage);
      
      // Atualizar diretamente no localStorage PRIMEIRO
      const savedJobs = localStorage.getItem('sendingJobs');
      if (savedJobs) {
        const jobs = JSON.parse(savedJobs);
        const updatedJobs = jobs.map((j: any) => 
          j.id === jobId 
            ? { ...j, status: 'error', progress: 100, error: errorMessage }
            : j
        );
        localStorage.setItem('sendingJobs', JSON.stringify(updatedJobs));
        
        // Disparar evento customizado
        window.dispatchEvent(new CustomEvent('sendingJobUpdated', { 
          detail: { jobId, status: 'error', progress: 100, error: errorMessage } 
        }));
      }
      
      // Atualizar o estado React também
      updateJobProgress(jobId, { 
        status: 'error', 
        progress: 100,
        error: errorMessage
      });

      // 💾 SALVAR ERRO NO BANCO DE DADOS (HISTÓRICO PERMANENTE)
      try {
        console.log('💾 Salvando erro no histórico do banco de dados...');
        await api.post('/uaz/messages/save', {
          instanceId: formData.instance_id,
          phoneNumber: formData.number,
          messageType: messageType,
          messageContent: messageType === 'combined' ? messageBlocks : formData,
          status: 'error',
          error: errorMessage,
          jobId: jobId
        });
        console.log('✅ Erro salvo no banco!');
      } catch (dbError) {
        console.error('⚠️ Erro ao salvar no banco:', dbError);
      }
      
      // NÃO mostrar notificação de erro aqui - o erro já foi registrado no job
      // O usuário verá em "Envios em Andamento"
      
      // 🔓 Reabilitar botão de envio após exceção
      setSending(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-20 w-20 border-b-4 border-blue-500 mb-4" />
          <p className="text-2xl text-white/70">Carregando...</p>
        </div>
      </div>
    );
  }

  // Main render
  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 py-8 px-4">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {notification && (
        <div 
          className={`fixed top-8 left-1/2 transform -translate-x-1/2 z-50 ${
            notification.type === 'success' ? 'bg-gradient-to-r from-green-500 to-emerald-500' :
            notification.type === 'error' ? 'bg-gradient-to-r from-red-500 to-pink-500' :
            notification.type === 'warning' ? 'bg-gradient-to-r from-yellow-500 to-orange-500' :
            'bg-gradient-to-r from-blue-500 to-cyan-500'
          } text-white px-8 py-5 rounded-2xl shadow-2xl border-2 ${
            notification.type === 'success' ? 'border-green-400' :
            notification.type === 'error' ? 'border-red-400' :
            notification.type === 'warning' ? 'border-yellow-400' :
            'border-blue-400'
          } flex items-center gap-4 min-w-[400px] max-w-[600px] transition-all duration-500 ease-out animate-slideDown`}
        >
          <div className={`text-3xl ${notification.type === 'success' ? 'animate-bounce' : ''}`}>
            {notification.type === 'success' ? '✅' :
             notification.type === 'error' ? '❌' :
             notification.type === 'warning' ? '⚠️' : 'ℹ️'}
          </div>
          <div className="flex-1">
            <p className="font-black text-xl mb-1">
              {notification.type === 'success' ? 'Sucesso!' :
               notification.type === 'error' ? 'Erro!' :
               notification.type === 'warning' ? 'Atenção!' : 'Informação'}
            </p>
            <p className="text-white/90 text-sm">{notification.message}</p>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-white/80 hover:text-white p-2 hover:bg-white/10 rounded-lg transition-all"
            title="Fechar"
          >
            <FaTimes className="text-xl" />
          </button>
        </div>
      )}
      
        {/* Background Pattern */}
        <div className="fixed inset-0 opacity-5 pointer-events-none -z-10">
          <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
            backgroundSize: '40px 40px'
          }}></div>
        </div>
        
        {/* 🎨 CABEÇALHO PRINCIPAL - PADRÃO API OFICIAL */}
        <div className="relative overflow-hidden bg-gradient-to-r from-primary-600/30 via-primary-500/20 to-primary-600/30 backdrop-blur-xl border-2 border-primary-500/40 rounded-3xl p-10 shadow-2xl shadow-primary-500/20">
          <div className="absolute inset-0 bg-grid-white/[0.02]"></div>
          <div className="relative">
            <div className="flex items-center gap-6 mb-4">
              <button
                onClick={() => router.push('/dashboard-uaz')}
                className="bg-white/10 hover:bg-white/20 p-4 rounded-xl transition-all duration-200 border-2 border-white/20 hover:border-white/40"
              >
                <FaArrowLeft className="text-3xl text-white" />
              </button>
              
              <div className="bg-gradient-to-br from-primary-500 to-primary-600 p-6 rounded-2xl shadow-lg shadow-primary-500/50">
                <FaPaperPlane className="text-5xl text-white" />
              </div>
              
              <div className="flex-1">
                <h1 className="text-5xl font-black text-white mb-2 tracking-tight">
                  Envio Único - QR Connect
                </h1>
                <p className="text-xl text-white/80 font-medium">
                  Todos os tipos de mensagem em um único lugar
                </p>
              </div>

              {/* BOTÃO PARA VER ENVIOS EM ANDAMENTO */}
              <button
                onClick={() => router.push('/uaz/envios-em-andamento')}
                className="relative px-6 py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-xl border-2 border-purple-500/40"
              >
                <div className="flex items-center gap-3">
                  <FaPaperPlane className="text-xl" />
                  <div className="text-left">
                    <div className="text-sm opacity-80">Ver</div>
                    <div>Envios em Andamento</div>
                  </div>
                  {sendingJobs.length > 0 && (
                    <div className="absolute -top-2 -right-2 bg-green-500 text-white text-xs font-black rounded-full w-7 h-7 flex items-center justify-center animate-pulse shadow-lg">
                      {sendingJobs.filter(j => j.status === 'sending' || j.status === 'paused').length}
                    </div>
                  )}
                </div>
              </button>
            </div>
          </div>
        </div>

        {instances.length === 0 ? (
          <div className="bg-red-500/10 border-2 border-red-500/40 rounded-2xl p-8 text-center">
            <p className="text-2xl font-bold text-red-300 mb-4">
              ⚠️ Nenhuma Instância Conectada
            </p>
            <p className="text-white/70 mb-6">
              Você precisa conectar uma instância antes de enviar mensagens.
            </p>
            <button
              onClick={() => router.push('/configuracoes-uaz')}
              className="px-8 py-4 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl transition-all"
            >
              Ir para Configurações
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-8">
            
            {/* BANNER DE DELAYS SEGUROS ATIVOS */}
            <div className="bg-gradient-to-r from-green-500/20 via-emerald-500/20 to-green-500/20 backdrop-blur-sm border-2 border-green-500/40 rounded-2xl p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="bg-green-500/20 p-4 rounded-xl">
                    <FaShieldAlt className="text-3xl text-green-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white mb-1">
                      🛡️ Delays Obrigatórios Ativos
                    </h3>
                    <p className="text-white/70 text-sm">
                      ⏱️ TODOS os envios seguem: {delayBeforeSending}s antes de iniciar + {delayBetweenMessages}s entre blocos (combinadas)
                    </p>
                    <p className="text-white/50 text-xs mt-1">
                      ℹ️ Estes delays são aplicados automaticamente para proteger sua conta do WhatsApp
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => router.push('/uaz/configuracao-delays')}
                  className="px-6 py-3 bg-green-500/20 hover:bg-green-500/30 text-green-300 border-2 border-green-500/40 rounded-xl font-bold transition-all flex items-center gap-2"
                >
                  <FaCog /> Configurar Delays
                </button>
              </div>
            </div>
            
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Instância */}
                <div>
                  <label className="block text-lg font-bold mb-3 text-white">
                    📱 Instância WhatsApp
                  </label>
                  <InstanceSelect
                    instances={instances}
                    value={formData.instance_id}
                    onChange={(value) => setFormData({ ...formData, instance_id: value })}
                    placeholder="Selecione uma instância..."
                    required
                  />
                </div>

                {/* Número */}
                <div>
                  <label className="block text-lg font-bold mb-3 text-white">
                    📞 Número de Destino
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="5562999999999"
                    className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-blue-500 transition-all"
                    value={formData.number}
                    onChange={(e) => setFormData({ ...formData, number: e.target.value.replace(/\D/g, '') })}
                  />
                  <p className="text-sm text-white/50 mt-2">
                    Use DDI + DDD + Número (Ex: 5562999999999)
                  </p>
                </div>
              </div>
            </div>

            {/* 🔹 SEÇÃO 2: TIPO DE MENSAGEM */}
            <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-purple-500/30 rounded-2xl p-8 shadow-xl hover:border-purple-500/50 transition-all duration-300">
              <div className="flex items-center gap-4 mb-6">
                <div className="bg-gradient-to-br from-purple-500 to-pink-600 text-white text-2xl font-black w-14 h-14 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/50">
                  2
                </div>
                <h2 className="text-3xl font-black text-white">
                  Tipo de Mensagem
                </h2>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {(['text', 'image', 'video', 'audio', 'document', 'button', 'list', 'poll', 'carousel'] as MessageType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleTypeChange(type)}
                    className={`relative p-6 rounded-xl border-2 transition-all ${
                      messageType === type
                        ? 'bg-blue-500 border-blue-400 text-white scale-105'
                        : 'bg-white/5 border-white/20 text-white/70 hover:bg-white/10 hover:border-white/30'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-3">
                      <span className="text-3xl">{getMessageTypeIcon(type)}</span>
                      <p className="font-bold text-sm">{getMessageTypeLabel(type)}</p>
                    </div>
                  </button>
                ))}
                
                {/* BOTÃO TEMPLATES PRONTOS */}
                <button
                  type="button"
                  onClick={() => {
                    setShowTemplatesModal(true);
                    loadTemplates();
                  }}
                  className="relative p-6 rounded-xl border-2 bg-gradient-to-r from-purple-500/20 to-pink-500/20 border-purple-500/40 text-white hover:from-purple-500/30 hover:to-pink-500/30 transition-all"
                >
                  <div className="flex flex-col items-center gap-3">
                    <span className="text-3xl">📋</span>
                    <p className="font-bold text-sm">Templates Prontos</p>
                  </div>
                </button>
              </div>

              {/* MENSAGEM COMBINADA - BOTÃO ESPECIAL */}
              <div className="mt-6">
                <button
                  type="button"
                  onClick={() => handleTypeChange('combined')}
                  className={`relative w-full p-6 rounded-xl border-2 transition-all ${
                    messageType === 'combined'
                      ? 'bg-gradient-to-r from-orange-500 to-red-500 border-orange-400 text-white scale-105 shadow-lg shadow-orange-500/50'
                      : 'bg-gradient-to-r from-orange-500/20 to-red-500/20 border-orange-500/40 text-white hover:from-orange-500/30 hover:to-red-500/30'
                  }`}
                >
                  <div className="flex items-center justify-center gap-4">
                    <span className="text-4xl">🔥</span>
                    <div className="text-left">
                      <p className="font-black text-xl">Mensagem Combinada</p>
                      <p className="text-sm opacity-90">Envie múltiplos tipos de mensagem em sequência</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* 🔹 SEÇÃO 3: CONTEÚDO DA MENSAGEM */}
            {messageType && (
              <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-green-500/30 rounded-2xl p-8 shadow-xl hover:border-green-500/50 transition-all duration-300">
                <div className="flex items-center gap-4 mb-6">
                  <div className="bg-gradient-to-br from-green-500 to-green-600 text-white text-2xl font-black w-14 h-14 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/50">
                    3
                  </div>
                  <h2 className="text-3xl font-black text-white">
                    Conteúdo - {getMessageTypeLabel(messageType)}
                  </h2>
                </div>

              {/* MENSAGEM COMBINADA - INTERFACE ESPECIAL */}
              {messageType === 'combined' && (
                <div className="space-y-6">
                  {/* Info sobre delay */}
                  <div className="bg-blue-500/10 border-2 border-blue-500/40 rounded-xl p-4">
                    <p className="text-blue-300 text-sm flex items-center gap-2">
                      ℹ️ <span>OBRIGATÓRIO: Aguarda {delayBeforeSending}s antes de iniciar + {delayBetweenMessages}s entre cada bloco (configurado em <strong>"Configurar Delays"</strong>)</span>
                    </p>
                  </div>

                  {/* Lista de Blocos */}
                  <div className="space-y-4">
                    <h3 className="text-xl font-bold text-white">📦 Blocos da Mensagem ({messageBlocks.length})</h3>

                    {/* Blocos adicionados */}
                    {messageBlocks.length === 0 ? (
                      <div className="bg-dark-700/40 border-2 border-dashed border-white/20 rounded-xl p-12 text-center">
                        <p className="text-2xl text-white/50 mb-2">📦</p>
                        <p className="text-white/50 font-bold">Nenhum bloco adicionado</p>
                        <p className="text-white/30 text-sm">Clique em "Adicionar Bloco" abaixo para começar</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {messageBlocks
                          .sort((a, b) => a.order - b.order)
                          .map((block, index) => (
                            <div
                              key={block.id}
                              draggable
                              onDragStart={() => handleDragStart(block.id)}
                              onDragOver={(e) => handleDragOver(e, block.id)}
                              onDragEnd={handleDragEnd}
                              className={`bg-dark-700/80 border-2 ${
                                draggedBlockId === block.id ? 'border-yellow-500' : 'border-white/20'
                              } rounded-xl p-6 cursor-move transition-all hover:border-white/40`}
                            >
                              {/* Cabeçalho do Bloco */}
                              <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                  <span className="text-3xl">{getMessageTypeIcon(block.type)}</span>
                                  <div>
                                    <p className="text-white font-bold">Bloco {index + 1} - {getMessageTypeLabel(block.type)}</p>
                                    <p className="text-white/50 text-sm">Arraste para reordenar</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => moveBlockUp(block.id)}
                                    disabled={index === 0}
                                    className="p-2 bg-white/10 hover:bg-white/20 disabled:opacity-30 rounded-lg transition-all"
                                  >
                                    ⬆️
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => moveBlockDown(block.id)}
                                    disabled={index === messageBlocks.length - 1}
                                    className="p-2 bg-white/10 hover:bg-white/20 disabled:opacity-30 rounded-lg transition-all"
                                  >
                                    ⬇️
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removeMessageBlock(block.id)}
                                    className="p-2 bg-red-500/20 hover:bg-red-500/40 text-red-300 rounded-lg transition-all"
                                  >
                                    <FaTrash />
                                  </button>
                                </div>
                              </div>

                              {/* Conteúdo específico do bloco */}
                              <div className="space-y-4">
                                {/* Texto (para todos exceto áudio) */}
                                {block.type !== 'audio' && (
                                  <div>
                                    <div className="flex items-center justify-between mb-2">
                                      <label className="block text-sm font-bold text-white/80">
                                        {block.type === 'image' || block.type === 'video' || block.type === 'document' ? 'Legenda' : 'Texto'}
                                      </label>
                                      <EmojiPickerButton 
                                        onEmojiSelect={(emoji) => updateMessageBlock(block.id, { text: (block.text || '') + emoji })}
                                        buttonClassName="px-3 py-1.5 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white rounded-lg transition-all flex items-center gap-1.5 text-sm font-bold"
                                      />
                                    </div>
                                    <textarea
                                      rows={3}
                                      className="w-full px-4 py-3 bg-dark-800/80 border-2 border-white/10 rounded-lg text-white focus:border-blue-500 transition-all resize-none"
                                      placeholder="Digite o texto..."
                                      value={block.text || ''}
                                      onChange={(e) => updateMessageBlock(block.id, { text: e.target.value, originalText: (block as any).originalText || block.text })}
                                    />
                                    
                                    {/* Botões de Variáveis Automáticas */}
                                    <div className="mt-3 p-4 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-lg">
                                      <p className="text-xs font-bold text-white/90 mb-2">✨ Variáveis Automáticas:</p>
                                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                        <button
                                          type="button"
                                          onClick={() => updateMessageBlock(block.id, { text: (block.text || '') + '{{data}}' })}
                                          className="px-3 py-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white text-xs font-bold rounded-lg transition-all"
                                        >
                                          📅 Data
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => updateMessageBlock(block.id, { text: (block.text || '') + '{{hora}}' })}
                                          className="px-3 py-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white text-xs font-bold rounded-lg transition-all"
                                        >
                                          ⏰ Hora
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => updateMessageBlock(block.id, { text: (block.text || '') + '{{protocolo}}' })}
                                          className="px-3 py-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white text-xs font-bold rounded-lg transition-all"
                                        >
                                          🔢 Protocolo
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => updateMessageBlock(block.id, { text: (block.text || '') + '{{saudacao}}' })}
                                          className="px-3 py-2 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white text-xs font-bold rounded-lg transition-all"
                                        >
                                          👋 Saudação
                                        </button>
                                      </div>
                                    </div>

                                    {/* Variáveis do Template - detectar e mostrar campos para este bloco */}
                                    {(() => {
                                      // ✨ CORRIGIDO: Detectar variáveis no ORIGINAL TEXT, não no texto substituído
                                      const blockText = (block as any).originalText || block.text || '';
                                      const regex = /\{\{\s*(\w+)\s*\}\}/g;
                                      const blockVars: string[] = [];
                                      let match;
                                      while ((match = regex.exec(blockText)) !== null) {
                                        const varName = match[1];
                                        if (!['data', 'hora', 'protocolo', 'saudacao'].includes(varName.toLowerCase()) && !blockVars.includes(varName)) {
                                          blockVars.push(varName);
                                        }
                                      }
                                      
                                      if (blockVars.length > 0) {
                                        return (
                                          <div className="mt-3 p-4 bg-purple-500/10 border-2 border-purple-500/40 rounded-lg">
                                            <p className="text-xs font-bold text-white/90 mb-3 flex items-center gap-2">
                                              📝 Preencher Variáveis do Template
                                            </p>
                                            <div className="grid md:grid-cols-2 gap-3">
                                              {blockVars.map((varName) => (
                                                <div key={varName}>
                                                  <label className="block text-xs font-semibold mb-1.5 text-white">
                                                    {getVariableDisplayName(varName)}
                                                  </label>
                                                  <input
                                                    type="text"
                                                    value={templateVariables[varName] || ''}
                                                    onChange={(e) => handleTemplateVariableChange(varName, e.target.value)}
                                                    placeholder={`Digite ${getVariableDisplayName(varName).toLowerCase()}`}
                                                    className="w-full px-3 py-2 text-sm bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:border-purple-500/50 focus:outline-none"
                                                  />
                                                </div>
                                              ))}
                                            </div>
                                            <p className="text-xs text-blue-300 mt-2">
                                              ℹ️ As variáveis serão preenchidas ao enviar a mensagem.
                                            </p>
                                          </div>
                                        );
                                      }
                                      return null;
                                    })()}
                                  </div>
                                )}

                                {/* Upload de mídia */}
                                {(block.type === 'image' || block.type === 'video' || block.type === 'audio' || block.type === 'document') && (
                                  <div>
                                    <label className="block text-sm font-bold mb-2 text-white/80 flex items-center gap-2">
                                      <FaImage className="text-blue-400" />
                                      Arquivo {block.type === 'audio' ? '(ou grave um áudio)' : ''}
                                    </label>

                                    {/* Tabs para Upload ou Gravar (apenas para áudio) */}
                                    {block.type === 'audio' && !block.media && (
                                      <div className="flex gap-2 mb-4">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const mediaMode = (block as any).mediaMode || 'upload';
                                            updateMessageBlock(block.id, { ...block, mediaMode: 'upload' } as any);
                                          }}
                                          className={`flex-1 px-4 py-2 rounded-lg font-bold transition-all flex items-center justify-center gap-2 text-sm ${
                                            ((block as any).mediaMode || 'upload') === 'upload'
                                              ? 'bg-blue-500 text-white'
                                              : 'bg-white/5 text-white/60 hover:bg-white/10'
                                          }`}
                                        >
                                          <FaImage /> Upload
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            updateMessageBlock(block.id, { ...block, mediaMode: 'record' } as any);
                                          }}
                                          className={`flex-1 px-4 py-2 rounded-lg font-bold transition-all flex items-center justify-center gap-2 text-sm ${
                                            ((block as any).mediaMode) === 'record'
                                              ? 'bg-red-500 text-white'
                                              : 'bg-white/5 text-white/60 hover:bg-white/10'
                                          }`}
                                        >
                                          <FaMicrophone /> Gravar
                                        </button>
                                      </div>
                                    )}

                                    {!block.media ? (
                                      <>
                                        {/* Modo Upload */}
                                        {(block.type !== 'audio' || ((block as any).mediaMode || 'upload') === 'upload') && (
                                          <div className="border-2 border-dashed border-white/20 rounded-xl p-6 hover:border-blue-500/50 transition-all text-center">
                                            <input
                                              type="file"
                                              id={`file-${block.id}`}
                                              accept={
                                                block.type === 'image' ? 'image/*' :
                                                block.type === 'video' ? 'video/*' :
                                                block.type === 'audio' ? 'audio/*' :
                                                '*/*'
                                              }
                                              onChange={async (e) => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                  if (file.size > 16 * 1024 * 1024) {
                                                    alert('❌ Arquivo muito grande! Máximo: 16MB');
                                                    return;
                                                  }
                                                  try {
                                                    const response = await uploadAPI.uploadMedia(file);
                                                    const uploadedData = response.data.data || response.data;
                                                    
                                                    if (!uploadedData.url) {
                                                      throw new Error('URL do arquivo não foi retornada pelo servidor');
                                                    }
                                                    
                                                    // ✅ Converter URL relativa para URL completa
                                                    const fullUrl = uploadedData.url.startsWith('http') || uploadedData.url.startsWith('data:') || uploadedData.url.startsWith('blob:')
                                                      ? uploadedData.url 
                                                      : `${API_BASE_URL}${uploadedData.url}`;
                                                    
                                                    updateMessageBlock(block.id, { 
                                                      media: {
                                                        ...uploadedData,
                                                        url: fullUrl
                                                      }
                                                    });
                                                  } catch (err) {
                                                    alert('Erro ao fazer upload');
                                                  }
                                                }
                                              }}
                                              className="hidden"
                                            />
                                            <label htmlFor={`file-${block.id}`} className="cursor-pointer">
                                              <FaUpload className="text-4xl text-blue-400 mx-auto mb-3" />
                                              <p className="text-white font-bold mb-1">Clique para fazer upload</p>
                                              <p className="text-white/50 text-sm">Máximo: 16MB</p>
                                            </label>
                                          </div>
                                        )}

                                        {/* Modo Gravar Áudio */}
                                        {block.type === 'audio' && ((block as any).mediaMode) === 'record' && (
                                          <div className="bg-red-500/10 border-2 border-red-500/40 rounded-xl p-6">
                                            <AudioRecorder
                                              onAudioReady={async (audioBlob: Blob, audioUrl: string) => {
                                                try {
                                                  const audioFile = new File([audioBlob], 'audio-gravado.ogg', { type: 'audio/ogg; codecs=opus' });
                                                  const response = await uploadAPI.uploadMedia(audioFile);
                                                  const data = response.data;
                                                  
                                                  // Construir URL absoluta
                                                  let mediaUrl = data.url;
                                                  if (!mediaUrl) {
                                                    mediaUrl = `/uploads/media/${data.filename}`;
                                                  }
                                                  if (!mediaUrl.startsWith('http') && !mediaUrl.startsWith('data:') && !mediaUrl.startsWith('blob:')) {
                                                    mediaUrl = `${API_BASE_URL}${mediaUrl}`;
                                                  }
                                                  
                                                  updateMessageBlock(block.id, { 
                                                    media: { 
                                                      ...data, 
                                                      url: mediaUrl,
                                                      mimetype: data.mimetype || data.mime_type || 'audio/ogg',
                                                      mime_type: data.mime_type || data.mimetype || 'audio/ogg',
                                                      localAudioUrl: audioUrl 
                                                    } 
                                                  });
                                                } catch (err: any) {
                                                  alert(err.response?.data?.error || 'Erro ao fazer upload do áudio');
                                                }
                                              }}
                                              onRemove={() => {
                                                updateMessageBlock(block.id, { media: undefined, mediaMode: 'upload' } as any);
                                              }}
                                            />
                                          </div>
                                        )}
                                      </>
                                    ) : (
                                      <div className="space-y-3">
                                        {/* Preview de Imagem */}
                                        {block.type === 'image' && (
                                          <div className="relative rounded-xl overflow-hidden border-2 border-green-500/40">
                                            <img 
                                              src={block.media.url.startsWith('http') ? block.media.url : `${API_BASE_URL}${block.media.url}`}
                                              alt="Preview"
                                              className="w-full max-h-64 object-contain bg-black"
                                            />
                                          </div>
                                        )}

                                        {/* Preview de Vídeo */}
                                        {block.type === 'video' && (
                                          <div className="relative rounded-xl overflow-hidden border-2 border-green-500/40">
                                            <video 
                                              src={block.media.url.startsWith('http') ? block.media.url : `${API_BASE_URL}${block.media.url}`}
                                              controls
                                              className="w-full max-h-64 bg-black"
                                            />
                                          </div>
                                        )}

                                        {/* Player de Áudio */}
                                        {block.type === 'audio' && (
                                          <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-2 border-purple-500/40 rounded-xl p-4">
                                            <div className="flex items-center gap-3">
                                              <FaMusic className="text-2xl text-purple-400" />
                                              <div className="flex-1">
                                                <p className="text-white font-bold text-sm mb-1">Áudio Gravado</p>
                                                <audio 
                                                  src={(block.media as any).localAudioUrl || (block.media.url.startsWith('http') ? block.media.url : `${API_BASE_URL}${block.media.url}`)}
                                                  controls
                                                  className="w-full"
                                                  style={{ height: '32px' }}
                                                />
                                              </div>
                                            </div>
                                          </div>
                                        )}

                                        {/* Info do arquivo + Botão remover */}
                                        <div className="flex items-center justify-between bg-green-500/10 border-2 border-green-500/40 rounded-lg p-4">
                                          <div className="flex items-center gap-3">
                                            <span className="text-3xl">
                                              {block.type === 'image' && '🖼️'}
                                              {block.type === 'video' && '🎥'}
                                              {block.type === 'audio' && '🎵'}
                                              {block.type === 'document' && '📄'}
                                            </span>
                                            <div>
                                              <p className="text-white text-sm font-bold">✅ {block.media.originalname}</p>
                                              <p className="text-white/50 text-xs">
                                                {block.media.size ? `${(block.media.size / 1024).toFixed(2)} KB` : ''}
                                              </p>
                                            </div>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => updateMessageBlock(block.id, { media: undefined, mediaMode: 'upload' } as any)}
                                            className="p-2 bg-red-500/20 hover:bg-red-500/40 text-red-300 rounded-lg transition-all"
                                          >
                                            <FaTrash />
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Botões - Interface IDÊNTICA ao modo único */}
                                {block.type === 'button' && (
                                  <div className="space-y-4">
                                    {/* Texto do Rodapé */}
                                    <div>
                                      <label className="block text-sm font-bold mb-2 text-white/80">
                                        👣 Texto do Rodapé (Opcional)
                                      </label>
                                      <input
                                        type="text"
                                        className="w-full px-4 py-3 bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-blue-500 transition-all"
                                        placeholder="Ex: Escolha uma das opções abaixo"
                                        value={block.footerText || ''}
                                        onChange={(e) => updateMessageBlock(block.id, { footerText: e.target.value })}
                                      />
                                    </div>

                                    {/* Botões */}
                                    <div>
                                      <label className="block text-sm font-bold mb-2 text-white/80">
                                        🔘 Botões ({(block.buttons || []).length}/3)
                                      </label>

                                      <div className="space-y-3">
                                        {(block.buttons || []).map((btn: any, btnIndex: number) => (
                                          <div key={btn.id || btnIndex} className="bg-dark-700/50 border-2 border-white/10 rounded-xl p-4 space-y-3">
                                            <div className="flex items-center justify-between">
                                              <h3 className="text-sm font-bold text-white">Botão #{btnIndex + 1}</h3>
                                              {(block.buttons || []).length > 1 && (
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    const newButtons = (block.buttons || []).filter((_: any, i: number) => i !== btnIndex);
                                                    updateMessageBlock(block.id, { buttons: newButtons });
                                                  }}
                                                  className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 rounded font-bold text-xs"
                                                >
                                                  <FaTrash className="inline mr-1" /> Remover
                                                </button>
                                              )}
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                              <div>
                                                <label className="block text-xs font-bold mb-1 text-white">Tipo</label>
                                                <select
                                                  className="w-full px-3 py-2 bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-blue-500 transition-all"
                                                  value={btn.type || 'REPLY'}
                                                  onChange={(e) => {
                                                    const newButtons = [...(block.buttons || [])];
                                                    newButtons[btnIndex] = { ...btn, type: e.target.value };
                                                    updateMessageBlock(block.id, { buttons: newButtons });
                                                  }}
                                                >
                                                  <option value="REPLY">Resposta Rápida</option>
                                                  <option value="URL">Link (URL)</option>
                                                  <option value="CALL">Ligar</option>
                                                  <option value="COPY">Copiar Texto</option>
                                                </select>
                                              </div>

                                              <div>
                                                <label className="block text-xs font-bold mb-1 text-white">Texto do Botão</label>
                                                <input
                                                  type="text"
                                                  className="w-full px-3 py-2 bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-blue-500 transition-all"
                                                  placeholder="Ex: Confirmar"
                                                  value={btn.text || ''}
                                                  onChange={(e) => {
                                                    const newButtons = [...(block.buttons || [])];
                                                    newButtons[btnIndex] = { ...btn, text: e.target.value };
                                                    updateMessageBlock(block.id, { buttons: newButtons });
                                                  }}
                                                />
                                              </div>
                                            </div>

                                            {btn.type === 'URL' && (
                                              <div>
                                                <label className="block text-xs font-bold mb-1 text-white">🔗 URL do Link</label>
                                                <input
                                                  type="url"
                                                  className="w-full px-3 py-2 bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-blue-500 transition-all"
                                                  placeholder="https://exemplo.com"
                                                  value={btn.url || ''}
                                                  onChange={(e) => {
                                                    const newButtons = [...(block.buttons || [])];
                                                    newButtons[btnIndex] = { ...btn, url: e.target.value };
                                                    updateMessageBlock(block.id, { buttons: newButtons });
                                                  }}
                                                />
                                              </div>
                                            )}

                                            {btn.type === 'CALL' && (
                                              <div>
                                                <label className="block text-xs font-bold mb-1 text-white">📞 Número de Telefone</label>
                                                <input
                                                  type="text"
                                                  className="w-full px-3 py-2 bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-blue-500 transition-all"
                                                  placeholder="+5511999999999"
                                                  value={btn.phone_number || ''}
                                                  onChange={(e) => {
                                                    const newButtons = [...(block.buttons || [])];
                                                    newButtons[btnIndex] = { ...btn, phone_number: e.target.value };
                                                    updateMessageBlock(block.id, { buttons: newButtons });
                                                  }}
                                                />
                                              </div>
                                            )}

                                            {btn.type === 'COPY' && (
                                              <div>
                                                <label className="block text-xs font-bold mb-1 text-white">📋 Texto para Copiar</label>
                                                <input
                                                  type="text"
                                                  className="w-full px-3 py-2 bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-blue-500 transition-all"
                                                  placeholder="CUPOM20 ou código..."
                                                  value={btn.copy_code || ''}
                                                  onChange={(e) => {
                                                    const newButtons = [...(block.buttons || [])];
                                                    newButtons[btnIndex] = { ...btn, copy_code: e.target.value };
                                                    updateMessageBlock(block.id, { buttons: newButtons });
                                                  }}
                                                />
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </div>

                                      {(block.buttons || []).length < 3 && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const currentButtons = block.buttons || [];
                                            updateMessageBlock(block.id, {
                                              buttons: [...currentButtons, { id: Date.now().toString(), text: '', type: 'REPLY' }]
                                            });
                                          }}
                                          className="w-full mt-3 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl transition-all"
                                        >
                                          <FaPlus className="inline mr-2" /> Adicionar Botão
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Lista - Interface IDÊNTICA ao modo único */}
                                {block.type === 'list' && (
                                  <div className="space-y-4">
                                    {/* Texto do Rodapé */}
                                    <div>
                                      <label className="block text-sm font-bold mb-2 text-white/80">
                                        👣 Texto do Rodapé (Opcional)
                                      </label>
                                      <input
                                        type="text"
                                        className="w-full px-4 py-3 bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-blue-500 transition-all"
                                        placeholder="Ex: Escolha uma opção"
                                        value={block.footerText || ''}
                                        onChange={(e) => updateMessageBlock(block.id, { footerText: e.target.value })}
                                      />
                                    </div>

                                    {/* Texto do Botão da Lista */}
                                    <div>
                                      <label className="block text-sm font-bold mb-2 text-white/80">
                                        🔘 Texto do Botão da Lista
                                      </label>
                                      <input
                                        type="text"
                                        className="w-full px-4 py-3 bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-blue-500 transition-all"
                                        placeholder="Ex: Ver Opções, Ver Catálogo..."
                                        value={block.listButton || 'Ver Opções'}
                                        onChange={(e) => updateMessageBlock(block.id, { listButton: e.target.value })}
                                      />
                                    </div>

                                    {/* Opções */}
                                    <div>
                                      <label className="block text-sm font-bold mb-2 text-white/80">
                                        📋 Opções ({(block.choices || []).length})
                                      </label>

                                      <div className="space-y-2">
                                        {(block.choices || []).map((choice: string, index: number) => (
                                          <div key={index} className="flex items-center gap-2">
                                            <input
                                              type="text"
                                              className="flex-1 px-4 py-3 bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-blue-500 transition-all"
                                              placeholder="[Seção] ou Item|id|Descrição"
                                              value={choice}
                                              onChange={(e) => {
                                                const newChoices = [...(block.choices || [])];
                                                newChoices[index] = e.target.value;
                                                updateMessageBlock(block.id, { choices: newChoices });
                                              }}
                                            />
                                            {(block.choices || []).length > 1 && (
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const newChoices = (block.choices || []).filter((_: string, i: number) => i !== index);
                                                  updateMessageBlock(block.id, { choices: newChoices });
                                                }}
                                                className="px-4 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-300 border-2 border-red-500/40 rounded-xl font-bold transition-all"
                                              >
                                                <FaTrash />
                                              </button>
                                            )}
                                          </div>
                                        ))}
                                      </div>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          const currentChoices = block.choices || [];
                                          updateMessageBlock(block.id, { choices: [...currentChoices, ''] });
                                        }}
                                        className="w-full mt-3 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl transition-all"
                                      >
                                        <FaPlus className="inline mr-2" /> Adicionar Opção
                                      </button>
                                    </div>
                                  </div>
                                )}

                                {/* Enquete - Interface IDÊNTICA ao modo único */}
                                {block.type === 'poll' && (
                                  <div className="space-y-4">
                                    {/* Número de Opções Selecionáveis */}
                                    <div>
                                      <label className="block text-sm font-bold mb-2 text-white/80">
                                        🔢 Número de Opções Selecionáveis
                                      </label>
                                      <input
                                        type="number"
                                        min="1"
                                        max="10"
                                        className="w-full px-4 py-3 bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-blue-500 transition-all"
                                        value={block.selectableCount || 1}
                                        onChange={(e) => updateMessageBlock(block.id, { selectableCount: parseInt(e.target.value) || 1 })}
                                      />
                                    </div>

                                    {/* Opções da Enquete */}
                                    <div>
                                      <label className="block text-sm font-bold mb-2 text-white/80">
                                        📊 Opções da Enquete ({(block.choices || []).length})
                                      </label>

                                      <div className="space-y-2">
                                        {(block.choices || []).map((choice: string, index: number) => (
                                          <div key={index} className="flex items-center gap-2">
                                            <input
                                              type="text"
                                              className="flex-1 px-4 py-3 bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-blue-500 transition-all"
                                              placeholder={`Opção ${index + 1}`}
                                              value={choice}
                                              onChange={(e) => {
                                                const newChoices = [...(block.choices || [])];
                                                newChoices[index] = e.target.value;
                                                updateMessageBlock(block.id, { choices: newChoices });
                                              }}
                                            />
                                            {(block.choices || []).length > 1 && (
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const newChoices = (block.choices || []).filter((_: string, i: number) => i !== index);
                                                  updateMessageBlock(block.id, { choices: newChoices });
                                                }}
                                                className="px-4 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-300 border-2 border-red-500/40 rounded-xl font-bold transition-all"
                                              >
                                                <FaTrash />
                                              </button>
                                            )}
                                          </div>
                                        ))}
                                      </div>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          const currentChoices = block.choices || [];
                                          updateMessageBlock(block.id, { choices: [...currentChoices, ''] });
                                        }}
                                        className="w-full mt-3 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl transition-all"
                                      >
                                        <FaPlus className="inline mr-2" /> Adicionar Opção
                                      </button>
                                    </div>
                                  </div>
                                )}

                                {/* Carrossel - Interface IDÊNTICA ao modo único */}
                                {block.type === 'carousel' && (
                                  <div className="space-y-4">
                                    <label className="block text-sm font-bold text-white/80">
                                      🎴 Cards do Carrossel ({(block.cards || []).length})
                                    </label>

                                    {(block.cards || []).map((card: any, cardIndex: number) => (
                                      <div key={card.id || cardIndex} className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-2 border-purple-500/40 rounded-2xl p-6 space-y-4">
                                        <div className="flex items-center justify-between">
                                          <h4 className="text-base font-bold text-white">Card #{cardIndex + 1}</h4>
                                          {(block.cards || []).length > 1 && (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const newCards = (block.cards || []).filter((_: any, i: number) => i !== cardIndex);
                                                updateMessageBlock(block.id, { cards: newCards });
                                              }}
                                              className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 border-2 border-red-500/40 rounded-lg font-bold transition-all flex items-center gap-2"
                                            >
                                              <FaTrash /> Remover Card
                                            </button>
                                          )}
                                        </div>

                                        {/* Texto do Card */}
                                        <div>
                                          <label className="block text-xs font-bold mb-2 text-white">
                                            💬 Texto do Card
                                          </label>
                                          <textarea
                                            rows={3}
                                            className="w-full px-4 py-3 bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-purple-500 transition-all resize-none"
                                            placeholder="Digite o texto deste card..."
                                            value={card.text || ''}
                                            onChange={(e) => {
                                              const newCards = [...(block.cards || [])];
                                              newCards[cardIndex] = { ...card, text: e.target.value };
                                              updateMessageBlock(block.id, { cards: newCards });
                                            }}
                                          />
                                        </div>

                                        {/* Imagem do Card */}
                                        <div>
                                          <label className="block text-xs font-bold mb-2 text-white">
                                            🖼️ Imagem do Card
                                          </label>
                                          
                                          {!card.image && !card.uploadedImage ? (
                                            <div className="relative">
                                              <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                id={`carousel-card-${block.id}-${cardIndex}`}
                                                onChange={async (e) => {
                                                  const file = e.target.files?.[0];
                                                  if (!file) return;
                                                  try {
                                                    const reader = new FileReader();
                                                    reader.onload = () => {
                                                      const newCards = [...(block.cards || [])];
                                                      newCards[cardIndex] = { ...card, image: reader.result as string };
                                                      updateMessageBlock(block.id, { cards: newCards });
                                                    };
                                                    reader.readAsDataURL(file);
                                                  } catch (err) {
                                                    alert('Erro ao carregar imagem');
                                                  }
                                                }}
                                              />
                                              <label
                                                htmlFor={`carousel-card-${block.id}-${cardIndex}`}
                                                className="flex flex-col items-center justify-center w-full h-40 px-4 bg-dark-700/60 border-2 border-dashed border-blue-500/40 rounded-xl cursor-pointer hover:bg-blue-500/10 hover:border-blue-500 transition-all"
                                              >
                                                <FaImage className="text-4xl text-blue-400 mb-3" />
                                                <p className="text-white font-bold text-sm">Clique para selecionar imagem</p>
                                                <p className="text-white/50 text-xs mt-1">PNG, JPG, GIF até 16MB</p>
                                              </label>
                                            </div>
                                          ) : (
                                            <div className="relative border-2 border-green-500/40 rounded-xl overflow-hidden">
                                              <div className="flex items-center justify-between bg-dark-800/60 p-2">
                                                <p className="text-white text-sm font-bold flex items-center gap-2">
                                                  <FaImage className="text-green-400" /> Imagem do card
                                                </p>
                                                <button
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    console.log('🗑️ CLIQUE NO REMOVER - Card', cardIndex + 1);
                                                    console.log('🗑️ Estado ANTES:', JSON.stringify({ 
                                                      image: card.image?.substring(0, 100), 
                                                      uploadedImage: card.uploadedImage 
                                                    }, null, 2));
                                                    
                                                    // Usar setMessageBlocks diretamente com callback para garantir estado atualizado
                                                    setMessageBlocks(prevBlocks => {
                                                      return prevBlocks.map(b => {
                                                        if (b.id !== block.id) return b;
                                                        
                                                        // Criar novo array de cards
                                                        const newCards = (b.cards || []).map((c: any, idx: number) => {
                                                          if (idx === cardIndex) {
                                                            console.log('🗑️ Removendo imagem do card', idx + 1);
                                                            // Retornar card LIMPO
                                                            return {
                                                              text: c.text || '',
                                                              buttons: c.buttons || [],
                                                              image: undefined, // ← UNDEFINED para forçar re-render
                                                              uploadedImage: undefined // ← UNDEFINED
                                                            };
                                                          }
                                                          return c;
                                                        });
                                                        
                                                        console.log('🗑️ Novo card:', JSON.stringify(newCards[cardIndex], null, 2));
                                                        return { ...b, cards: newCards };
                                                      });
                                                    });
                                                    
                                                    console.log('✅ Imagem removida do card', cardIndex + 1);
                                                  }}
                                                  className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 rounded font-bold text-sm transition-all"
                                                >
                                                  <FaTrash className="inline mr-1" /> Remover
                                                </button>
                                              </div>
                                              <img
                                                src={(() => {
                                                  // ✨ Tentar múltiplas fontes de URL
                                                  let url = card.image || (card.uploadedImage && card.uploadedImage.url) || '';
                                                  
                                                  console.log('🖼️ Carregando imagem do card:', {
                                                    'card.image': card.image,
                                                    'card.uploadedImage?.url': card.uploadedImage?.url,
                                                    'URL final': url
                                                  });
                                                  
                                                  if (!url) return '';
                                                  if (url.startsWith('http') || url.startsWith('data:') || url.startsWith('blob:')) {
                                                    return url;
                                                  }
                                                  return `${API_BASE_URL}${url}`;
                                                })()}
                                                alt="Preview"
                                                className="max-w-full h-auto max-h-64 rounded-lg mx-auto object-contain"
                                                onError={(e) => {
                                                  console.error('❌ Erro ao carregar imagem do card:', card.image);
                                                  console.log('📦 Card completo:', card);
                                                  console.log('🔍 uploadedImage:', card.uploadedImage);
                                                }}
                                              />
                                            </div>
                                          )}
                                        </div>

                                        {/* Botões do Card */}
                                        <div>
                                          <label className="block text-xs font-bold mb-2 text-white">
                                            🔘 Botões do Card ({(card.buttons || []).length}/3)
                                          </label>

                                          {(card.buttons || []).length === 0 ? (
                                            <div className="bg-yellow-500/10 border-2 border-yellow-500/40 rounded-xl p-4 text-center">
                                              <p className="text-yellow-300 font-bold">
                                                ⚠️ Este card precisa ter pelo menos 1 botão
                                              </p>
                                            </div>
                                          ) : (
                                            <div className="space-y-3">
                                              {(card.buttons || []).map((btn: any, btnIdx: number) => (
                                                <div key={btn.id || btnIdx} className="bg-dark-700/50 border border-white/20 rounded-xl p-4 space-y-3">
                                                  <div className="flex items-center justify-between">
                                                    <p className="text-white font-bold">Botão #{btnIdx + 1}</p>
                                                    <button
                                                      type="button"
                                                      onClick={() => {
                                                        const newCards = [...(block.cards || [])];
                                                        newCards[cardIndex] = {
                                                          ...card,
                                                          buttons: (card.buttons || []).filter((_: any, i: number) => i !== btnIdx)
                                                        };
                                                        updateMessageBlock(block.id, { cards: newCards });
                                                      }}
                                                      className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 rounded font-bold text-sm"
                                                    >
                                                      <FaTrash />
                                                    </button>
                                                  </div>

                                                  <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                      <label className="block text-xs font-bold mb-1 text-white/80">Tipo</label>
                                                      <select
                                                        className="w-full px-3 py-2 bg-dark-700 border border-white/20 rounded-lg text-white text-sm focus:border-purple-500"
                                                        value={btn.type || 'REPLY'}
                                                        onChange={(e) => {
                                                          const newCards = [...(block.cards || [])];
                                                          const newButtons = [...(card.buttons || [])];
                                                          newButtons[btnIdx] = { ...btn, type: e.target.value };
                                                          newCards[cardIndex] = { ...card, buttons: newButtons };
                                                          updateMessageBlock(block.id, { cards: newCards });
                                                        }}
                                                      >
                                                        <option value="REPLY">Resposta Rápida</option>
                                                        <option value="URL">Link (URL)</option>
                                                        <option value="CALL">Ligar</option>
                                                        <option value="COPY">Copiar Código</option>
                                                      </select>
                                                    </div>

                                                    <div>
                                                      <label className="block text-xs font-bold mb-1 text-white/80">Texto do Botão</label>
                                                      <input
                                                        type="text"
                                                        className="w-full px-3 py-2 bg-dark-700 border border-white/20 rounded-lg text-white text-sm focus:border-purple-500"
                                                        placeholder="Ex: Acessar"
                                                        value={btn.text || ''}
                                                        onChange={(e) => {
                                                          const newCards = [...(block.cards || [])];
                                                          const newButtons = [...(card.buttons || [])];
                                                          newButtons[btnIdx] = { ...btn, text: e.target.value };
                                                          newCards[cardIndex] = { ...card, buttons: newButtons };
                                                          updateMessageBlock(block.id, { cards: newCards });
                                                        }}
                                                      />
                                                    </div>
                                                  </div>

                                                  {btn.type === 'URL' && (
                                                    <div>
                                                      <label className="block text-xs font-bold mb-1 text-white/80">🔗 URL do Link</label>
                                                      <input
                                                        type="url"
                                                        className="w-full px-3 py-2 bg-dark-700 border border-white/20 rounded-lg text-white text-sm focus:border-purple-500"
                                                        placeholder="https://exemplo.com"
                                                        value={btn.url || ''}
                                                        onChange={(e) => {
                                                          const newCards = [...(block.cards || [])];
                                                          const newButtons = [...(card.buttons || [])];
                                                          newButtons[btnIdx] = { ...btn, url: e.target.value };
                                                          newCards[cardIndex] = { ...card, buttons: newButtons };
                                                          updateMessageBlock(block.id, { cards: newCards });
                                                        }}
                                                      />
                                                    </div>
                                                  )}

                                                  {btn.type === 'CALL' && (
                                                    <div>
                                                      <label className="block text-xs font-bold mb-1 text-white/80">📞 Número de Telefone</label>
                                                      <input
                                                        type="text"
                                                        className="w-full px-3 py-2 bg-dark-700 border border-white/20 rounded-lg text-white text-sm focus:border-purple-500"
                                                        placeholder="5562999999999"
                                                        value={btn.phone_number || ''}
                                                        onChange={(e) => {
                                                          const newCards = [...(block.cards || [])];
                                                          const newButtons = [...(card.buttons || [])];
                                                          newButtons[btnIdx] = { ...btn, phone_number: e.target.value.replace(/\D/g, '') };
                                                          newCards[cardIndex] = { ...card, buttons: newButtons };
                                                          updateMessageBlock(block.id, { cards: newCards });
                                                        }}
                                                      />
                                                    </div>
                                                  )}

                                                  {btn.type === 'COPY' && (
                                                    <div>
                                                      <label className="block text-xs font-bold mb-1 text-white/80">📋 Código para Copiar</label>
                                                      <input
                                                        type="text"
                                                        className="w-full px-3 py-2 bg-dark-700 border border-white/20 rounded-lg text-white text-sm focus:border-purple-500"
                                                        placeholder="CUPOM10"
                                                        value={btn.copy_code || ''}
                                                        onChange={(e) => {
                                                          const newCards = [...(block.cards || [])];
                                                          const newButtons = [...(card.buttons || [])];
                                                          newButtons[btnIdx] = { ...btn, copy_code: e.target.value };
                                                          newCards[cardIndex] = { ...card, buttons: newButtons };
                                                          updateMessageBlock(block.id, { cards: newCards });
                                                        }}
                                                      />
                                                    </div>
                                                  )}
                                                </div>
                                              ))}
                                            </div>
                                          )}

                                          {(card.buttons || []).length < 3 && (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const newCards = [...(block.cards || [])];
                                                const currentButtons = card.buttons || [];
                                                newCards[cardIndex] = {
                                                  ...card,
                                                  buttons: [...currentButtons, { id: Date.now().toString(), text: '', type: 'REPLY' }]
                                                };
                                                updateMessageBlock(block.id, { cards: newCards });
                                              }}
                                              className="w-full mt-3 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl transition-all"
                                            >
                                              <FaPlus className="inline mr-2" /> Adicionar Botão
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    ))}

                                    {/* Botão Adicionar Card */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const currentCards = block.cards || [];
                                        updateMessageBlock(block.id, { 
                                          cards: [...currentCards, { id: Date.now().toString(), text: '', image: '', buttons: [], uploadingImage: false }]
                                        });
                                      }}
                                      className="w-full px-6 py-4 bg-purple-500 hover:bg-purple-600 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                                    >
                                      <FaPlus /> Adicionar Card
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                      </div>
                    )}

                    {/* Botão Adicionar Bloco - SEMPRE EMBAIXO */}
                    <div className="space-y-4">
                      <button
                        type="button"
                        onClick={() => setShowAddBlockMenu(!showAddBlockMenu)}
                        className="w-full px-6 py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold rounded-xl hover:from-green-600 hover:to-emerald-600 transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-500/30"
                      >
                        <FaPlus /> Adicionar Bloco
                      </button>

                      {/* Menu para adicionar bloco */}
                      {showAddBlockMenu && (
                        <div className="bg-dark-700/60 border-2 border-green-500/40 rounded-xl p-6 animate-fadeIn">
                          <p className="text-white font-bold mb-4">Selecione o tipo de bloco:</p>
                          <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                            {(['text', 'image', 'video', 'audio', 'document', 'button', 'list', 'poll', 'carousel'] as Exclude<MessageType, 'combined'>[]).map((type) => (
                              <button
                                key={type}
                                type="button"
                                onClick={() => addMessageBlock(type)}
                                className="p-4 bg-white/5 hover:bg-white/10 border-2 border-white/20 hover:border-green-500 rounded-xl transition-all"
                              >
                                <span className="text-3xl block mb-2">{getMessageTypeIcon(type)}</span>
                                <span className="text-xs text-white font-bold">{getMessageTypeLabel(type)}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TEXTO (Para todos os tipos exceto audio e combined) */}
              {messageType !== 'audio' && messageType !== 'combined' && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-lg font-bold text-white">
                      💬 {messageType === 'image' || messageType === 'video' || messageType === 'document' ? 'Legenda (Opcional)' : 'Texto Principal'}
                    </label>
                    <EmojiPickerButton 
                      onEmojiSelect={(emoji) => setFormData({ ...formData, text: formData.text + emoji })}
                      buttonClassName="px-4 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white rounded-lg transition-all flex items-center gap-2 font-bold shadow-lg"
                    />
                  </div>
                  <textarea
                    required={messageType === 'text' || messageType === 'button' || messageType === 'list' || messageType === 'poll' || messageType === 'carousel'}
                    rows={4}
                    className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-blue-500 transition-all resize-none"
                    placeholder="Digite o texto da mensagem..."
                    value={formData.text}
                    onChange={(e) => setFormData({ ...formData, text: e.target.value })}
                  />
                  
                  {/* BOTÕES DE VARIÁVEIS AUTOMÁTICAS */}
                  <div className="mt-4 p-5 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-2 border-purple-500/30 rounded-xl">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-2xl">✨</span>
                      <h3 className="text-base font-bold text-white">Variáveis Automáticas do Sistema</h3>
                    </div>
                    <p className="text-sm text-white/70 mb-4">
                      Clique nos botões para inserir variáveis que são preenchidas automaticamente:
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, text: formData.text + '{{data}}' })}
                        className="px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold rounded-lg transition-all shadow-lg hover:shadow-blue-500/50 flex items-center justify-center gap-2"
                      >
                        📅 Data
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, text: formData.text + '{{hora}}' })}
                        className="px-4 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold rounded-lg transition-all shadow-lg hover:shadow-green-500/50 flex items-center justify-center gap-2"
                      >
                        ⏰ Hora
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, text: formData.text + '{{protocolo}}' })}
                        className="px-4 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold rounded-lg transition-all shadow-lg hover:shadow-orange-500/50 flex items-center justify-center gap-2"
                      >
                        🔢 Protocolo
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, text: formData.text + '{{saudacao}}' })}
                        className="px-4 py-3 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-bold rounded-lg transition-all shadow-lg hover:shadow-purple-500/50 flex items-center justify-center gap-2"
                      >
                        👋 Saudação
                      </button>
                    </div>
                    <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                      <p className="text-xs text-blue-300 flex items-center gap-2">
                        <span>ℹ️</span>
                        <span><strong>Info:</strong> Essas variáveis são preenchidas automaticamente no momento do envio (data atual, hora atual, protocolo único e saudação contextual).</span>
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* CAMPOS DE VARIÁVEIS DO TEMPLATE (Apenas para tipos NÃO combined) */}
              {messageType !== 'combined' && Object.keys(templateVariables).length > 0 && (
                <div className="mt-6 space-y-4 p-6 bg-purple-500/10 border-2 border-purple-500/40 rounded-xl">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-2xl">📝</span>
                    <h3 className="text-xl font-bold text-white">Preencher Variáveis do Template</h3>
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    {Object.keys(templateVariables).map((varName) => (
                      <div key={varName}>
                        <label className="block text-sm font-semibold mb-2 text-white">
                          {getVariableDisplayName(varName)}
                        </label>
                        <input
                          type="text"
                          value={templateVariables[varName]}
                          onChange={(e) => handleTemplateVariableChange(varName, e.target.value)}
                          placeholder={`Digite ${getVariableDisplayName(varName).toLowerCase()}`}
                          className="w-full px-4 py-3 bg-white/10 border-2 border-white/20 rounded-xl text-white placeholder-white/50 focus:border-purple-500/50 focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>
                  
                  <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                    <p className="text-sm text-blue-300">
                      ℹ️ <strong>Dica:</strong> As variáveis serão preenchidas automaticamente ao enviar a mensagem.
                    </p>
                  </div>
                </div>
              )}

              {/* UPLOAD DE MÍDIA (Para imagem, vídeo, áudio, documento, botões com imagem) */}
              {(messageType === 'image' || messageType === 'video' || messageType === 'audio' || messageType === 'document' || messageType === 'button') && (
                <div>
                  <label className="block text-lg font-bold mb-3 text-white flex items-center gap-2">
                    <FaImage className="text-blue-400" />
                    📎 {messageType === 'button' ? 'Imagem dos Botões (Opcional)' : 'Arquivo'}
                  </label>

                  {!uploadedMedia ? (
                    <>
                      {/* Tabs para escolher entre Upload e Gravar (apenas para áudio) */}
                      {messageType === 'audio' && (
                        <div className="space-y-2 mb-4">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                console.log('🔄 Mudando para modo upload');
                                setMediaMode('upload');
                                setUploadingMedia(false); // ← RESETAR ESTADO DE UPLOAD
                              }}
                              className={`flex-1 px-4 py-3 rounded-lg font-bold transition-all flex items-center justify-center gap-2 ${
                                mediaMode === 'upload'
                                  ? 'bg-blue-500 text-white'
                                  : 'bg-white/5 text-white/60 hover:bg-white/10'
                              }`}
                            >
                              <FaImage /> Upload de Arquivo
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                console.log('🔄 Mudando para modo gravar');
                                setMediaMode('record');
                                setUploadingMedia(false); // ← RESETAR ESTADO DE UPLOAD
                              }}
                              className={`flex-1 px-4 py-3 rounded-lg font-bold transition-all flex items-center justify-center gap-2 ${
                                mediaMode === 'record'
                                  ? 'bg-red-500 text-white'
                                  : 'bg-white/5 text-white/60 hover:bg-white/10'
                              }`}
                            >
                              <FaMicrophone /> Gravar Áudio
                            </button>
                          </div>
                          
                          {/* Botão de Reset em caso de travamento */}
                          {uploadingMedia && (
                            <button
                              type="button"
                              onClick={() => {
                                console.log('🔄 RESETANDO estado de upload');
                                setUploadingMedia(false);
                                setUploadedMedia(null);
                                setRecordedAudios([]);
                                setUploadedAudios([]);
                              }}
                              className="w-full px-3 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border-2 border-yellow-500/40 rounded-lg font-bold transition-all"
                            >
                              ⚠️ Resetar Upload (Travado)
                            </button>
                          )}
                        </div>
                      )}

                      {/* Modo Upload */}
                      {(messageType !== 'audio' || mediaMode === 'upload') && (
                        <>
                          {/* Toggle para múltiplos arquivos (não para botões com imagem) */}
                          {messageType !== 'button' && (messageType === 'image' || messageType === 'video' || messageType === 'audio' || messageType === 'document') && (
                            <div className="bg-blue-500/10 border-2 border-blue-500/40 rounded-xl p-4 mb-4">
                              <label className="flex items-center justify-between cursor-pointer">
                                <div className="flex items-center gap-3">
                                  <FaImage className="text-2xl text-blue-400" />
                                  <div>
                                    <p className="text-white font-bold">Modo Múltiplos Arquivos</p>
                                    <p className="text-white/60 text-sm">
                                      Envie várias imagens, vídeos, áudios e PDFs juntos
                                    </p>
                                  </div>
                                </div>
                                <input
                                  type="checkbox"
                                  checked={useMultipleFiles}
                                  onChange={(e) => setUseMultipleFiles(e.target.checked)}
                                  className="w-6 h-6 text-blue-500 rounded focus:ring-2 focus:ring-blue-500"
                                />
                              </label>
                            </div>
                          )}

                          {/* Modo Múltiplos Arquivos */}
                          {useMultipleFiles && messageType !== 'button' ? (
                            <MultiMediaUploader 
                              onFilesChange={handleMultipleFilesChange}
                              maxFiles={10}
                              maxSizeMB={16}
                            />
                          ) : (
                            /* Modo Upload Único */
                            <div className="relative">
                              <input
                                type="file"
                                id="media-upload"
                                accept={
                                  messageType === 'image' ? 'image/*' :
                                  messageType === 'video' ? 'video/*' :
                                  messageType === 'audio' ? 'audio/*' :
                                  messageType === 'document' ? 'application/pdf,.pdf,.doc,.docx' :
                                  'image/*'
                                }
                                onChange={handleFileUpload}
                                onClick={() => {
                                  console.log('🖱️ Input file clicado');
                                  console.log('📊 Estado atual - uploadingMedia:', uploadingMedia);
                                }}
                                disabled={uploadingMedia}
                                className="hidden"
                              />
                              <label
                                htmlFor="media-upload"
                                onClick={() => {
                                  console.log('🖱️ Label clicado');
                                  console.log('📊 Estado atual - uploadingMedia:', uploadingMedia);
                                  console.log('📊 Estado atual - uploadedMedia:', uploadedMedia);
                                }}
                                className={`block w-full px-6 py-8 bg-dark-700/80 border-2 border-dashed border-white/20 rounded-xl text-center cursor-pointer hover:border-blue-500 hover:bg-blue-500/5 transition-all ${
                                  uploadingMedia ? 'opacity-50 cursor-not-allowed' : ''
                                }`}
                              >
                                {uploadingMedia ? (
                                  <div className="flex flex-col items-center gap-3">
                                    <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-500"></div>
                                    <p className="text-white text-lg font-bold">Fazendo upload...</p>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        console.log('🔄 CANCELANDO upload travado');
                                        setUploadingMedia(false);
                                      }}
                                      className="mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 border-2 border-red-500/40 rounded-lg font-bold transition-all"
                                    >
                                      ❌ Cancelar Upload
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex flex-col items-center gap-3">
                                    <FaImage className="text-5xl text-blue-400" />
                                    <p className="text-white text-lg font-bold">
                                      Clique para selecionar arquivo
                                    </p>
                                    <p className="text-white/60 text-sm">
                                      📷 Imagem · 🎥 Vídeo · 🎵 Áudio · 📄 PDF (Máx: 16MB)
                                    </p>
                                  </div>
                                )}
                              </label>
                            </div>
                          )}
                        </>
                      )}

                      {/* Modo Gravar Áudio */}
                      {messageType === 'audio' && mediaMode === 'record' && (
                        <MultiAudioRecorder 
                          onAudiosChange={handleMultipleAudiosChange}
                          onAudiosUpload={handleMultipleAudiosUpload}
                        />
                      )}
                    </>
                  ) : uploadedMedia.localAudioUrl ? (
                    // Se for áudio gravado, mostra o AudioRecorder com player
                    <AudioRecorder 
                      onAudioReady={handleAudioRecorded}
                      onRemove={handleRemoveAudio}
                      initialAudioUrl={recordedAudioUrl}
                      initialRecordingTime={recordedAudioDuration}
                    />
                  ) : (
                    <div className="bg-dark-700/80 border-2 border-green-500/40 rounded-xl p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          {uploadedMedia.mimetype?.startsWith('image/') && <FaImage className="text-3xl text-blue-400" />}
                          {uploadedMedia.mimetype?.startsWith('video/') && <FaVideo className="text-3xl text-purple-400" />}
                          {uploadedMedia.mimetype?.startsWith('audio/') && <FaMusic className="text-3xl text-green-400" />}
                          {!uploadedMedia.mimetype?.startsWith('image/') && !uploadedMedia.mimetype?.startsWith('video/') && !uploadedMedia.mimetype?.startsWith('audio/') && <FaImage className="text-3xl text-gray-400" />}
                          <div>
                            <p className="font-bold text-white">{uploadedMedia.originalname}</p>
                            <p className="text-sm text-white/60">
                              {(uploadedMedia.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleRemoveMedia}
                          className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 border-2 border-red-500/40 rounded-lg font-bold transition-all flex items-center gap-2"
                        >
                          <FaTrash /> Remover
                        </button>
                      </div>
                      
                      {/* PREVIEW DE IMAGEM */}
                      {uploadedMedia.mimetype?.startsWith('image/') && (
                        <div className="mt-4 bg-dark-700/50 rounded-xl p-4">
                          <img
                            src={uploadedMedia.url.startsWith('http') ? uploadedMedia.url : `${API_BASE_URL}${uploadedMedia.url}`}
                            alt="Preview"
                            className="max-w-full h-auto max-h-96 rounded-lg mx-auto object-contain"
                          />
                        </div>
                      )}

                      {/* PLAYER DE VÍDEO */}
                      {uploadedMedia.mimetype?.startsWith('video/') && (
                        <div className="mt-4 bg-dark-700/50 rounded-xl p-4 space-y-3">
                          <p className="text-center text-purple-300 font-bold mb-2">🎥 Preview do Vídeo</p>
                          <video
                            ref={(el) => { mediaRef.current = el; }}
                            src={uploadedMedia.url.startsWith('http') ? uploadedMedia.url : `${API_BASE_URL}${uploadedMedia.url}`}
                            onTimeUpdate={handleMediaTimeUpdate}
                            onLoadedMetadata={() => {
                              if (mediaRef.current) {
                                setMediaPlaybackState({
                                  isPlaying: false,
                                  currentTime: 0,
                                  duration: mediaRef.current.duration
                                });
                              }
                            }}
                            onEnded={() => setMediaPlaybackState({ ...mediaPlaybackState, isPlaying: false })}
                            className="w-full max-h-80 rounded-lg bg-black"
                            controls
                          />
                          <div className="text-center text-sm text-white/60">
                            Duração: {formatMediaTime(mediaPlaybackState.duration)}
                          </div>
                        </div>
                      )}

                      {/* PLAYER DE ÁUDIO */}
                      {uploadedMedia.mimetype?.startsWith('audio/') && (
                        <div className="mt-4 bg-dark-700/50 rounded-xl p-5 space-y-4">
                          <p className="text-center text-green-300 font-bold mb-3">🎵 Ouça o áudio antes de enviar</p>
                          
                          {/* Botão Play/Pause */}
                          <div className="flex justify-center">
                            <button
                              type="button"
                              onClick={toggleMediaPlayPause}
                              className={`w-20 h-20 bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-full flex items-center justify-center shadow-xl shadow-green-500/50 transition-all transform hover:scale-105 ${styles.playButton}`}
                            >
                              {mediaPlaybackState.isPlaying ? <FaPause className="text-3xl ml-0" /> : <FaPlay className="text-3xl ml-1" />}
                            </button>
                          </div>

                          {/* Barra de Progresso */}
                          <div className="space-y-2">
                            <input
                              type="range"
                              min="0"
                              max={mediaPlaybackState.duration || 0}
                              value={mediaPlaybackState.currentTime || 0}
                              onChange={(e) => handleMediaSeek(parseFloat(e.target.value))}
                              className={`${styles.audioSlider} w-full`}
                              style={{
                                background: `linear-gradient(to right, #10b981 0%, #10b981 ${((mediaPlaybackState.currentTime || 0) / (mediaPlaybackState.duration || 1)) * 100}%, rgba(255,255,255,0.2) ${((mediaPlaybackState.currentTime || 0) / (mediaPlaybackState.duration || 1)) * 100}%, rgba(255,255,255,0.2) 100%)`
                              }}
                            />
                            <div className="flex justify-between text-sm text-white/60 font-mono">
                              <span>{formatMediaTime(mediaPlaybackState.currentTime || 0)}</span>
                              <span>{formatMediaTime(mediaPlaybackState.duration || 0)}</span>
                            </div>
                          </div>

                          {/* Status */}
                          <div className="text-center text-sm">
                            {mediaPlaybackState.isPlaying ? (
                              <p className="text-green-300 font-bold animate-pulse">▶️ Reproduzindo...</p>
                            ) : mediaPlaybackState.currentTime > 0 && mediaPlaybackState.currentTime < mediaPlaybackState.duration ? (
                              <p className="text-yellow-300 font-bold">⏸️ Pausado</p>
                            ) : mediaPlaybackState.currentTime >= mediaPlaybackState.duration && mediaPlaybackState.duration > 0 ? (
                              <p className="text-green-300 font-bold">✅ Reprodução concluída</p>
                            ) : (
                              <p className="text-white/60">Clique para reproduzir</p>
                            )}
                          </div>

                          <audio
                            ref={(el) => { mediaRef.current = el; }}
                            src={uploadedMedia.url.startsWith('http') ? uploadedMedia.url : `${API_BASE_URL}${uploadedMedia.url}`}
                            onTimeUpdate={handleMediaTimeUpdate}
                            onLoadedMetadata={() => {
                              if (mediaRef.current) {
                                setMediaPlaybackState({
                                  isPlaying: false,
                                  currentTime: 0,
                                  duration: mediaRef.current.duration
                                });
                              }
                            }}
                            onEnded={() => setMediaPlaybackState({ ...mediaPlaybackState, isPlaying: false })}
                            className="hidden"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* CAMPOS ESPECÍFICOS PARA BOTÕES */}
              {messageType === 'button' && (
                <>
                  <div>
                    <label className="block text-lg font-bold mb-3 text-white">
                      👣 Texto do Rodapé (Opcional)
                    </label>
                    <input
                      type="text"
                      className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-blue-500 transition-all"
                      placeholder="Ex: Escolha uma das opções abaixo"
                      value={formData.footerText}
                      onChange={(e) => setFormData({ ...formData, footerText: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-lg font-bold mb-3 text-white">
                      🔘 Botões ({buttons.length}/3)
                    </label>

                    <div className="space-y-4">
                      {buttons.map((button, index) => (
                        <div key={button.id} className="bg-dark-700/50 border-2 border-white/10 rounded-xl p-6 space-y-4">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-white">Botão #{index + 1}</h3>
                            {buttons.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeButton(button.id)}
                                className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 rounded font-bold text-sm flex items-center gap-2"
                              >
                                <FaTrash /> Remover
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-bold mb-2 text-white">Tipo</label>
                              <select
                                className="w-full px-4 py-3 bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-blue-500 transition-all"
                                value={button.type}
                                onChange={(e) => updateButton(button.id, 'type', e.target.value as any)}
                              >
                                <option value="REPLY">Resposta Rápida</option>
                                <option value="URL">Link (URL)</option>
                                <option value="CALL">Ligar</option>
                                <option value="COPY">Copiar Texto</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-sm font-bold mb-2 text-white">Texto do Botão</label>
                              <input
                                type="text"
                                className="w-full px-4 py-3 bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-blue-500 transition-all"
                                placeholder="Ex: Confirmar"
                                value={button.text}
                                onChange={(e) => updateButton(button.id, 'text', e.target.value)}
                              />
                            </div>
                          </div>

                          {button.type === 'URL' && (
                            <div>
                              <label className="block text-sm font-bold mb-2 text-white">🔗 URL</label>
                              <input
                                type="url"
                                className="w-full px-4 py-3 bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-blue-500 transition-all"
                                placeholder="https://exemplo.com"
                                value={button.url || ''}
                                onChange={(e) => updateButton(button.id, 'url', e.target.value)}
                              />
                            </div>
                          )}

                          {button.type === 'CALL' && (
                            <div>
                              <label className="block text-sm font-bold mb-2 text-white">📞 Número de Telefone</label>
                              <input
                                type="tel"
                                className="w-full px-4 py-3 bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-blue-500 transition-all"
                                placeholder="+5511999999999"
                                value={button.phone_number || ''}
                                onChange={(e) => updateButton(button.id, 'phone_number', e.target.value)}
                              />
                            </div>
                          )}

                          {button.type === 'COPY' && (
                            <div>
                              <label className="block text-sm font-bold mb-2 text-white">📋 Texto para Copiar</label>
                              <input
                                type="text"
                                className="w-full px-4 py-3 bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-blue-500 transition-all"
                                placeholder="CUPOM20 ou código..."
                                value={button.copy_code || ''}
                                onChange={(e) => updateButton(button.id, 'copy_code', e.target.value)}
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Botão Adicionar - SEMPRE EMBAIXO */}
                    {buttons.length < 3 && (
                      <button
                        type="button"
                        onClick={addButton}
                        className="w-full px-6 py-4 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border-2 border-blue-500/40 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                      >
                        <FaPlus /> Adicionar Botão
                      </button>
                    )}
                  </div>
                </>
              )}

              {/* CAMPOS ESPECÍFICOS PARA LISTA */}
              {messageType === 'list' && (
                <>
                  <div>
                    <label className="block text-lg font-bold mb-3 text-white">
                      👣 Texto do Rodapé (Opcional)
                    </label>
                    <input
                      type="text"
                      className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-blue-500 transition-all"
                      placeholder="Ex: Escolha uma opção"
                      value={formData.footerText}
                      onChange={(e) => setFormData({ ...formData, footerText: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-lg font-bold mb-3 text-white">
                      🔘 Texto do Botão da Lista
                    </label>
                    <input
                      type="text"
                      required
                      className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-blue-500 transition-all"
                      placeholder="Ex: Ver Opções, Ver Catálogo..."
                      value={formData.listButton}
                      onChange={(e) => setFormData({ ...formData, listButton: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-lg font-bold mb-3 text-white">
                      📋 Opções ({choices.length})
                    </label>

                    <div className="space-y-3">
                      {choices.map((choice, index) => (
                        <div key={index} className="flex items-center gap-3">
                          <div className="flex-1">
                            <input
                              type="text"
                              className="w-full px-4 py-3 bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-blue-500 transition-all"
                              placeholder="[Seção] ou Item|id|Descrição"
                              value={choice}
                              onChange={(e) => updateChoice(index, e.target.value)}
                            />
                          </div>
                          {choices.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeChoice(index)}
                              className="px-4 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-300 border-2 border-red-500/40 rounded-xl font-bold transition-all"
                            >
                              <FaTrash />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Botão Adicionar - SEMPRE EMBAIXO */}
                    <button
                      type="button"
                      onClick={addChoice}
                      className="w-full px-6 py-4 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 mt-4"
                    >
                      <FaPlus /> Adicionar Opção
                    </button>
                  </div>
                </>
              )}

              {/* CAMPOS ESPECÍFICOS PARA POLL */}
              {messageType === 'poll' && (
                <>
                  <div>
                    <label className="block text-lg font-bold mb-3 text-white">
                      🔢 Número de Opções Selecionáveis
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-blue-500 transition-all"
                      value={formData.selectableCount}
                      onChange={(e) => setFormData({ ...formData, selectableCount: parseInt(e.target.value) || 1 })}
                    />
                  </div>

                  <div>
                    <label className="block text-lg font-bold mb-3 text-white">
                      📊 Opções da Enquete ({choices.length})
                    </label>

                    <div className="space-y-3">
                      {choices.map((choice, index) => (
                        <div key={index} className="flex items-center gap-3">
                          <div className="flex-1">
                            <input
                              type="text"
                              className="w-full px-4 py-3 bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-blue-500 transition-all"
                              placeholder={`Opção ${index + 1}`}
                              value={choice}
                              onChange={(e) => updateChoice(index, e.target.value)}
                            />
                          </div>
                          {choices.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeChoice(index)}
                              className="px-4 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-300 border-2 border-red-500/40 rounded-xl font-bold transition-all"
                            >
                              <FaTrash />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Botão Adicionar - SEMPRE EMBAIXO */}
                    <button
                      type="button"
                      onClick={addChoice}
                      className="w-full px-6 py-4 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 mt-4"
                    >
                      <FaPlus /> Adicionar Opção
                    </button>
                  </div>
                </>
              )}

              {/* CAMPOS ESPECÍFICOS PARA CARROSSEL */}
              {messageType === 'carousel' && (
                <div className="space-y-6">
                  <h3 className="text-xl font-bold text-white">🎴 Cards do Carrossel ({cards.length})</h3>

                  {cards.map((card, cardIndex) => (
                    <div key={card.id} className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-2 border-purple-500/40 rounded-2xl p-6 space-y-6">
                      <div className="flex items-center justify-between">
                        <h4 className="text-lg font-bold text-white">Card #{cardIndex + 1}</h4>
                        {cards.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeCard(card.id)}
                            className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 border-2 border-red-500/40 rounded-lg font-bold transition-all flex items-center gap-2"
                          >
                            <FaTrash /> Remover Card
                          </button>
                        )}
                      </div>

                      <div>
                        <label className="block text-base font-bold mb-2 text-white">
                          💬 Texto do Card
                        </label>
                        <textarea
                          required
                          rows={3}
                          className="w-full px-4 py-3 bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-purple-500 transition-all resize-none"
                          placeholder="Digite o texto deste card..."
                          value={card.text}
                          onChange={(e) => updateCard(card.id, 'text', e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="block text-base font-bold mb-2 text-white">
                          🖼️ Imagem do Card
                        </label>
                        
                        {!card.image ? (
                          <div className="relative">
                            <input
                              type="file"
                              id={`image-${card.id}`}
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleCardImageUpload(card.id, file);
                              }}
                              disabled={card.uploadingImage}
                              className="hidden"
                            />
                            <label
                              htmlFor={`image-${card.id}`}
                              className={`block w-full px-6 py-8 bg-dark-700/80 border-2 border-dashed border-white/20 rounded-xl text-center cursor-pointer hover:border-purple-500 hover:bg-purple-500/5 transition-all ${
                                card.uploadingImage ? 'opacity-50 cursor-not-allowed' : ''
                              }`}
                            >
                              {card.uploadingImage ? (
                                <div className="flex flex-col items-center gap-3">
                                  <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-purple-500"></div>
                                  <p className="text-white text-base font-bold">Fazendo upload...</p>
                                </div>
                              ) : (
                                <div className="flex flex-col items-center gap-3">
                                  <FaImage className="text-4xl text-purple-400" />
                                  <p className="text-white text-base font-bold">
                                    Clique para selecionar imagem
                                  </p>
                                </div>
                              )}
                            </label>
                          </div>
                        ) : (
                          <div className="bg-dark-700/50 rounded-xl p-4">
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-white font-bold">✅ Imagem carregada</p>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  console.log('🗑️ REMOVER IMAGEM - Card direto');
                                  // Atualizar tudo de uma vez para evitar race condition
                                  setCards(prevCards => prevCards.map(c => 
                                    c.id === card.id 
                                      ? { ...c, image: '', uploadedImage: null as any }
                                      : c
                                  ));
                                  console.log('✅ Imagem removida do card');
                                }}
                                className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 rounded font-bold text-sm"
                              >
                                <FaTrash className="inline mr-1" /> Remover
                              </button>
                            </div>
                            <img
                              src={card.image}
                              alt="Preview"
                              className="max-w-full h-auto max-h-64 rounded-lg mx-auto object-contain"
                            />
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-base font-bold mb-3 text-white">
                          🔘 Botões do Card ({card.buttons.length}/3)
                        </label>

                        {card.buttons.length === 0 ? (
                          <div className="bg-yellow-500/10 border-2 border-yellow-500/40 rounded-xl p-4 text-center">
                            <p className="text-yellow-300 font-bold">
                              ⚠️ Este card precisa ter pelo menos 1 botão
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {card.buttons.map((button, buttonIndex) => (
                              <div key={button.id} className="bg-dark-700/50 border border-white/20 rounded-xl p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                  <p className="text-white font-bold">Botão #{buttonIndex + 1}</p>
                                  <button
                                    type="button"
                                    onClick={() => removeButtonFromCard(card.id, button.id)}
                                    className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 rounded font-bold text-sm"
                                  >
                                    <FaTrash />
                                  </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  <div>
                                    <label className="block text-sm font-bold mb-1 text-white/80">
                                      Tipo
                                    </label>
                                    <select
                                      required
                                      className="w-full px-3 py-2 bg-dark-700 border border-white/20 rounded-lg text-white text-sm focus:border-purple-500"
                                      value={button.type}
                                      onChange={(e) => updateCardButton(card.id, button.id, 'type', e.target.value)}
                                    >
                                      <option value="REPLY">↩️ Resposta Rápida</option>
                                      <option value="URL">🔗 Link (URL)</option>
                                      <option value="CALL">📞 Ligar</option>
                                      <option value="COPY">📋 Copiar Código</option>
                                    </select>
                                  </div>

                                  <div>
                                    <label className="block text-sm font-bold mb-1 text-white/80">
                                      Texto do Botão
                                    </label>
                                    <input
                                      type="text"
                                      required
                                      placeholder="Ex: Ver mais"
                                      className="w-full px-3 py-2 bg-dark-700 border border-white/20 rounded-lg text-white text-sm focus:border-purple-500"
                                      value={button.text}
                                      onChange={(e) => updateCardButton(card.id, button.id, 'text', e.target.value)}
                                    />
                                  </div>
                                </div>

                                {button.type === 'URL' && (
                                  <div>
                                    <label className="block text-sm font-bold mb-1 text-white/80">
                                      🔗 URL do Link
                                    </label>
                                    <input
                                      type="url"
                                      required
                                      placeholder="https://exemplo.com"
                                      className="w-full px-3 py-2 bg-dark-700 border border-white/20 rounded-lg text-white text-sm focus:border-purple-500"
                                      value={button.url || ''}
                                      onChange={(e) => updateCardButton(card.id, button.id, 'url', e.target.value)}
                                    />
                                  </div>
                                )}

                                {button.type === 'CALL' && (
                                  <div>
                                    <label className="block text-sm font-bold mb-1 text-white/80">
                                      📞 Número de Telefone
                                    </label>
                                    <input
                                      type="text"
                                      required
                                      placeholder="5562999999999"
                                      className="w-full px-3 py-2 bg-dark-700 border border-white/20 rounded-lg text-white text-sm focus:border-purple-500"
                                      value={button.phone_number || ''}
                                      onChange={(e) => updateCardButton(card.id, button.id, 'phone_number', e.target.value.replace(/\D/g, ''))}
                                    />
                                  </div>
                                )}

                                {button.type === 'COPY' && (
                                  <div>
                                    <label className="block text-sm font-bold mb-1 text-white/80">
                                      📋 Código para Copiar
                                    </label>
                                    <input
                                      type="text"
                                      required
                                      placeholder="CUPOM10"
                                      className="w-full px-3 py-2 bg-dark-700 border border-white/20 rounded-lg text-white text-sm focus:border-purple-500"
                                      value={button.copy_code || ''}
                                      onChange={(e) => updateCardButton(card.id, button.id, 'copy_code', e.target.value)}
                                    />
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Botão Adicionar Botão - SEMPRE EMBAIXO */}
                        {card.buttons.length < 3 && (
                          <button
                            type="button"
                            onClick={() => addButtonToCard(card.id)}
                            className="w-full px-4 py-3 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border-2 border-blue-500/40 rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-sm mt-3"
                          >
                            <FaPlus /> Adicionar Botão
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Botão Adicionar Card - SEMPRE EMBAIXO */}
                  <button
                    type="button"
                    onClick={addCard}
                    className="w-full px-6 py-4 bg-purple-500 hover:bg-purple-600 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-500/30"
                  >
                    <FaPlus /> Adicionar Card
                  </button>
                </div>
              )}
            </div>
            )}

            {/* BOTÃO ENVIAR */}
            <button
              type="button"
              disabled={sending}
              onClick={handleSubmit}
              className="w-full py-6 rounded-2xl font-bold text-2xl transition-all duration-300 flex items-center justify-center gap-4 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 shadow-2xl shadow-blue-500/50 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? (
                <>
                  <div className="animate-spin rounded-full h-6 w-6 border-4 border-white border-t-transparent"></div>
                  Enviando...
                </>
              ) : (
                <>
                  <FaPaperPlane />
                  Enviar {getMessageTypeLabel(messageType)}
                </>
              )}
            </button>
          </form>
        )}
      </div>

      {/* PAINEL DE ENVIOS REMOVIDO - Agora está em página separada: /uaz/envios-em-andamento */}
      {false && (
        <div className="fixed bottom-28 right-8 w-[500px] max-h-[600px] bg-dark-800/95 backdrop-blur-xl border-2 border-purple-500/40 rounded-3xl shadow-2xl shadow-purple-500/30 z-50 overflow-hidden">
          {/* Cabeçalho do Painel */}
          <div className="bg-gradient-to-r from-purple-600/30 to-blue-600/30 p-6 flex items-center justify-between border-b border-purple-500/30">
            <div className="flex items-center gap-3">
              <FaPaperPlane className="text-2xl text-white" />
              <div>
                <h3 className="text-xl font-bold text-white">Envios em Andamento</h3>
                <p className="text-sm text-white/70">
                  {sendingJobs.filter(j => j.status === 'sending' || j.status === 'paused').length} ativos • {sendingJobs.filter(j => j.status === 'completed').length} completos
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {sendingJobs.filter(j => j.status === 'completed' || j.status === 'error' || j.status === 'cancelled').length > 0 && (
                <button
                  onClick={clearCompletedJobs}
                  className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg text-sm font-bold transition-all"
                  title="Limpar finalizados"
                >
                  🗑️
                </button>
              )}
              <button
                onClick={() => setShowQueuePanel(false)}
                className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-bold transition-all"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Lista de Jobs */}
          <div className="overflow-y-auto max-h-[480px] p-4 space-y-3">
            {sendingJobs.length === 0 ? (
              <div className="text-center py-12 text-white/50">
                <FaPaperPlane className="text-5xl mx-auto mb-4 opacity-30" />
                <p className="text-lg">Nenhum envio ativo</p>
              </div>
            ) : (
              sendingJobs.map(job => (
                <div
                  key={job.id}
                  className={`p-4 rounded-2xl border-2 transition-all ${
                    job.status === 'sending' ? 'bg-blue-500/10 border-blue-500/40' :
                    job.status === 'paused' ? 'bg-yellow-500/10 border-yellow-500/40' :
                    job.status === 'completed' ? 'bg-green-500/10 border-green-500/40' :
                    job.status === 'error' ? 'bg-red-500/10 border-red-500/40' :
                    'bg-gray-500/10 border-gray-500/40'
                  }`}
                >
                  {/* Cabeçalho do Job */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-bold text-white/90">
                          {job.type === 'combined' ? '📦 Mensagem Combinada' : '📄 Mensagem Simples'}
                        </span>
                        {job.status === 'sending' && (
                          <div className="animate-spin rounded-full h-3 w-3 border-2 border-blue-400 border-t-transparent"></div>
                        )}
                        {job.status === 'paused' && <span className="text-yellow-400">⏸️</span>}
                        {job.status === 'completed' && <span className="text-green-400">✅</span>}
                        {job.status === 'error' && <span className="text-red-400">❌</span>}
                        {job.status === 'cancelled' && <span className="text-gray-400">🚫</span>}
                      </div>
                      <p className="text-xs text-white/60">
                        Para: {job.targetNumber}
                      </p>
                      <p className="text-xs text-white/50">
                        {job.type === 'combined' ? `${job.currentBlock}/${job.totalBlocks} blocos` : job.messageType}
                      </p>
                    </div>
                    
                    {/* Controles */}
                    <div className="flex items-center gap-1">
                      {job.status === 'sending' && (
                        <>
                          <button
                            onClick={() => pauseJob(job.id)}
                            className="p-2 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 rounded-lg transition-all"
                            title="Pausar"
                          >
                            ⏸️
                          </button>
                          <button
                            onClick={() => cancelJob(job.id)}
                            className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-all"
                            title="Cancelar"
                          >
                            🛑
                          </button>
                        </>
                      )}
                      {job.status === 'paused' && (
                        <>
                          <button
                            onClick={() => resumeJob(job.id)}
                            className="p-2 bg-green-500/20 hover:bg-green-500/30 text-green-300 rounded-lg transition-all"
                            title="Retomar"
                          >
                            ▶️
                          </button>
                          <button
                            onClick={() => cancelJob(job.id)}
                            className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-all"
                            title="Cancelar"
                          >
                            🛑
                          </button>
                        </>
                      )}
                      {(job.status === 'completed' || job.status === 'error' || job.status === 'cancelled') && (
                        <button
                          onClick={() => removeJob(job.id)}
                          className="p-2 bg-gray-500/20 hover:bg-gray-500/30 text-gray-300 rounded-lg transition-all"
                          title="Remover"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Barra de Progresso */}
                  <div className="mb-2">
                    <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          job.status === 'sending' ? 'bg-blue-500' :
                          job.status === 'paused' ? 'bg-yellow-500' :
                          job.status === 'completed' ? 'bg-green-500' :
                          job.status === 'error' ? 'bg-red-500' :
                          'bg-gray-500'
                        }`}
                        style={{ width: `${job.progress}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-xs text-white/50 mt-1">
                      <span>{job.progress}%</span>
                      <span>
                        {job.status === 'sending' && 'Enviando...'}
                        {job.status === 'paused' && 'Pausado'}
                        {job.status === 'completed' && 'Completo'}
                        {job.status === 'error' && 'Erro'}
                        {job.status === 'cancelled' && 'Cancelado'}
                      </span>
                    </div>
                  </div>

                  {/* Mensagem de Erro */}
                  {job.error && (
                    <div className="mt-2 p-2 bg-red-500/20 border border-red-500/30 rounded-lg">
                      <p className="text-xs text-red-300">{job.error}</p>
                    </div>
                  )}

                  {/* Timestamp */}
                  <p className="text-xs text-white/40 mt-2">
                    Iniciado: {new Date(job.startedAt).toLocaleTimeString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* MODAL DE TEMPLATES PRONTOS */}
      {showTemplatesModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 border-2 border-purple-500/50 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl shadow-purple-500/30">
            
            {/* Header */}
            <div className="p-6 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-purple-500/20 to-pink-500/20">
              <h2 className="text-3xl font-bold text-white flex items-center gap-3">
                📋 Templates Prontos
              </h2>
              <button
                onClick={() => setShowTemplatesModal(false)}
                className="text-3xl w-12 h-12 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all"
              >
                ×
              </button>
            </div>

            {/* Search */}
            <div className="p-6 border-b border-white/10">
              <input
                type="text"
                placeholder="🔍 Buscar template..."
                value={templateSearchTerm}
                onChange={(e) => setTemplateSearchTerm(e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border-2 border-white/20 rounded-xl text-white placeholder-white/50 focus:border-purple-500/50 focus:outline-none text-base"
              />
            </div>

            {/* Templates List */}
            <div className="flex-1 overflow-y-auto p-6">
              {loadingTemplates ? (
                <div className="flex items-center justify-center py-20">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {templates
                    .filter(t => 
                      !templateSearchTerm || 
                      t.name.toLowerCase().includes(templateSearchTerm.toLowerCase()) ||
                      (t.text_content && t.text_content.toLowerCase().includes(templateSearchTerm.toLowerCase()))
                    )
                    .map((template) => {
                      const getTemplateTypeName = (type: string) => {
                        const types: Record<string, string> = {
                          'text': 'Template de Texto',
                          'image': 'Template de Imagem',
                          'video': 'Template de Vídeo',
                          'audio': 'Template de Áudio',
                          'document': 'Template de Documento',
                          'button': 'Template com Botões',
                          'list': 'Template de Lista',
                          'poll': 'Template de Enquete',
                          'carousel': 'Template de Carrossel'
                        };
                        return types[type] || type;
                      };

                      const getTemplateIcon = (type: string) => {
                        const icons: Record<string, string> = {
                          'text': '📝',
                          'image': '🖼️',
                          'video': '🎥',
                          'audio': '🎵',
                          'document': '📄',
                          'button': '🔘',
                          'list': '📋',
                          'poll': '📊',
                          'carousel': '🎠'
                        };
                        return icons[type] || '📄';
                      };

                      return (
                        <button
                          key={template.id}
                          onClick={() => handleSelectTemplateFromModal(template)}
                          className="p-5 rounded-xl bg-white/5 hover:bg-white/10 border-2 border-white/20 hover:border-purple-500/50 transition-all text-left"
                        >
                          <div className="flex items-start gap-4">
                            <span className="text-2xl flex-shrink-0">{getTemplateIcon(template.type)}</span>
                            <div className="flex-1 min-w-0">
                              <h3 className="text-base font-bold text-white mb-1 truncate">
                                {template.name}
                              </h3>
                              <span className="inline-block px-2 py-1 bg-blue-500/20 text-blue-300 text-xs font-semibold rounded-lg mb-2">
                                {getTemplateTypeName(template.type).toUpperCase()}
                              </span>
                              {template.text_content && (
                                <p className="text-sm text-white/60 line-clamp-2 mt-2">
                                  {template.text_content}
                                </p>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                </div>
              )}

              {!loadingTemplates && templates.filter(t => 
                !templateSearchTerm || 
                t.name.toLowerCase().includes(templateSearchTerm.toLowerCase()) ||
                (t.text_content && t.text_content.toLowerCase().includes(templateSearchTerm.toLowerCase()))
              ).length === 0 && (
                <div className="text-center py-20">
                  <p className="text-2xl text-white/40">
                    {templateSearchTerm ? '🔍 Nenhum template encontrado' : '📋 Nenhum template cadastrado'}
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-white/10 bg-white/5">
              <button
                onClick={() => setShowTemplatesModal(false)}
                className="w-full py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition-all"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

