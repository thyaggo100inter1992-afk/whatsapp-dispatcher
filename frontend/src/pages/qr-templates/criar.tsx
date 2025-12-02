import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { 
  FaArrowLeft, FaPaperPlane, FaImage, FaVideo, FaMicrophone, FaFile,
  FaMousePointer, FaList, FaPoll, FaThList, FaPlus, FaTrash,
  FaLink, FaPhone, FaCopy, FaReply, FaPlay, FaPause, FaMusic,
  FaCog, FaUpload, FaTimes, FaSave, FaQuestionCircle
} from 'react-icons/fa';
import api from '@/services/api';
import { uploadAPI } from '@/services/api';
import AudioRecorder from '@/components/AudioRecorder';
import MultiMediaUploader from '@/components/MultiMediaUploader';
import VariablesHelpModal from '@/components/VariablesHelpModal';
import EmojiPickerButton from '@/components/EmojiPickerButton';
import styles from '@/styles/AudioRecorder.module.css';
import { detectVariables, categorizeVariables, getSystemVariables } from '@/utils/templateVariables';

// Configuração da URL base da API
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace(/\/api$/, '');

interface UazInstance {
  id: number;
  name: string;
  session_name: string;
  status: string;
}

type MessageType = 'text' | 'image' | 'video' | 'audio' | 'audio_recorded' | 'document' | 'button' | 'list' | 'poll' | 'carousel' | 'combined';

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
  title?: string;
  caption?: string;
  media?: any;
  buttons?: ButtonOption[];
  choices?: string[];
  cards?: Card[];
  footerText?: string;
  listButton?: string;
  selectableCount?: number;
  // Para lista com interface visual
  listSections?: Array<{
    title: string;
    rows: Array<{ id: string; title: string; description: string }>;
  }>;
  sections?: Array<{
    title: string;
    rows: Array<{ id: string; title: string; description: string }>;
  }>;
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

export default function CriarTemplate() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Estados para Template
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [detectedVariables, setDetectedVariables] = useState<string[]>([]);
  const [showHelpModal, setShowHelpModal] = useState(false);
  
  // Estados para adicionar variável personalizada
  const [showAddVariableModal, setShowAddVariableModal] = useState(false);
  const [newVariableName, setNewVariableName] = useState('');
  const [variablesMap, setVariablesMap] = useState<Record<string, string>>({});
  
  // Sistema de Notificações Toast
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null);
  
  const [messageType, setMessageType] = useState<MessageType>('text');
  
const [formData, setFormData] = useState({
  type: 'text' as MessageType,
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

  // Estados para Menu Lista (interface visual estruturada)
  const [listConfig, setListConfig] = useState({
    buttonText: 'Ver Opções',
    title: '',
    footerText: '',
    sections: [
      {
        title: 'Seção 1',
        rows: [
          { id: 'opt1', title: '', description: '' }
        ]
      }
    ]
  });

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
  const [currentEditingBlockId, setCurrentEditingBlockId] = useState<string | null>(null);
  const [showAddBlockMenu, setShowAddBlockMenu] = useState(false);

  useEffect(() => {
    loadDelayConfig();
    loadClonedTemplate();
  }, []);

  // Carregar dados de template clonado (se houver)
  const loadClonedTemplate = () => {
    try {
      const templateToCloneStr = sessionStorage.getItem('templateToClone');
      if (templateToCloneStr) {
        const templateData = JSON.parse(templateToCloneStr);
        console.log('📋 Carregando template para clonar:', templateData);
        
        // Definir tipo de mensagem (converter 'buttons' para 'button' se necessário)
        if (templateData.type) {
          const frontendType = templateData.type === 'buttons' ? 'button' : templateData.type;
          console.log(`📝 [Clone] Tipo original: ${templateData.type}, tipo frontend: ${frontendType}`);
          setMessageType(frontendType);
        }
        
        // Definir nome e descrição
        setTemplateName(templateData.name || '');
        setTemplateDescription(templateData.description || '');
        
        // Preencher texto
        if (templateData.text_content) {
          setFormData(prev => ({ ...prev, text: templateData.text_content }));
        }
        
        // Carregar mídia(s) - apenas para tipos simples (image, video, audio, document)
        // Carousel e outros tipos complexos são carregados via seus configs específicos
        if (templateData.media_files && templateData.media_files.length > 0) {
          if (['image', 'video', 'audio', 'audio_recorded', 'document'].includes(templateData.type)) {
            const media = templateData.media_files[0];
            setUploadedMedia({
              url: media.url,
              mime_type: media.mime_type,
              original_name: media.original_name,
              size: media.file_size,
              caption: media.caption
            });
            if (media.caption) {
              setFormData(prev => ({ ...prev, caption: media.caption }));
            }
          }
        }
        
        // Carregar configurações específicas
        setTimeout(() => {
          if (templateData.buttons_config) {
            let config = templateData.buttons_config;
            if (typeof config === 'string') config = JSON.parse(config);
            console.log('🔘 [Clone] buttons_config encontrado:', config);
            
            // Carregar botões
            if (config.buttons) {
              const loadedButtons = config.buttons.map((btn: any, idx: number) => ({
                ...btn,
                id: btn.id || `btn-clone-${Date.now()}-${idx}`
              }));
              console.log('🔘 [Clone] Carregando botões:', loadedButtons);
              setButtons(loadedButtons);
            }
            
            // Carregar footerText se existir
            if (config.footerText) {
              setFormData(prev => ({ ...prev, footerText: config.footerText }));
            }
          } else {
            console.log('⚠️ [Clone] buttons_config NÃO encontrado no templateData');
          }
          
          if (templateData.list_config) {
            let config = templateData.list_config;
            if (typeof config === 'string') config = JSON.parse(config);
            console.log('📋 [Clone] list_config encontrado:', config);
            
            // Carregar direto no listConfig (sem conversão!)
            setListConfig({
              buttonText: config.buttonText || 'Ver Opções',
              title: config.title || '',
              footerText: config.footerText || '',
              sections: config.sections || [{
                title: 'Seção 1',
                rows: [{ id: 'opt1', title: '', description: '' }]
              }]
            });
            
            console.log('✅ [Clone] listConfig carregado completo!');
          }
          
          if (templateData.carousel_config) {
            let config = templateData.carousel_config;
            if (typeof config === 'string') config = JSON.parse(config);
            if (config.cards) {
              // Combinar dados do carousel_config com as mídias de media_files
              const mediaFiles = templateData.media_files || [];
              
              setCards(config.cards.map((card: any, idx: number) => {
                // Buscar mídia correspondente pelo carousel_card_index
                const cardMedia = mediaFiles.find((m: any) => m.carousel_card_index === idx);
                
                return {
                  ...card,
                  id: card.id || `card-clone-${Date.now()}-${idx}`,
                  image: cardMedia?.url || card.image, // Usar URL da mídia se existir
                  buttons: (card.buttons || []).map((btn: any, btnIdx: number) => ({
                    ...btn,
                    id: btn.id || `btn-clone-${Date.now()}-${idx}-${btnIdx}`
                  })),
                  uploadingImage: false
                };
              }));
            }
          }
          
          if (templateData.poll_config) {
            let config = templateData.poll_config;
            if (typeof config === 'string') config = JSON.parse(config);
            console.log('📊 [Clone] poll_config encontrado:', config);
            if (config.options && config.options.length > 0) {
              console.log('📊 [Clone] Carregando options:', config.options);
              setChoices(config.options);
            } else {
              console.log('⚠️ [Clone] poll_config SEM options ou array vazio');
            }
            if (config.selectableCount) {
              console.log('📊 [Clone] Carregando selectableCount:', config.selectableCount);
              setFormData(prev => ({ ...prev, selectableCount: config.selectableCount }));
            }
          }
          
          // Carregar MENSAGEM COMBINADA
          if (templateData.combined_blocks) {
            let blocks = templateData.combined_blocks;
            if (typeof blocks === 'string') blocks = JSON.parse(blocks);
            
            const blocksArray = blocks.blocks || [];
            
            // Buscar media_files para associar aos blocos
            const mediaFiles = templateData.media_files || [];
            
            // Converter para o formato correto de MessageBlock[]
            const clonedBlocks = blocksArray.map((block: any, index: number) => {
              // Tentar encontrar a mídia deste bloco nos media_files
              let blockMedia = block.media;
              
              // Se o bloco tem mídia, garantir que tem a URL correta
              if (blockMedia && mediaFiles.length > 0) {
                const mediaFile = mediaFiles.find((m: any) => 
                  m.file_path === blockMedia.file_path || 
                  m.file_name === blockMedia.file_name
                );
                if (mediaFile) {
                  blockMedia = {
                    ...blockMedia,
                    // ✅ FIX: Verificar se é de qr-templates ou media baseado no file_path
                    url: mediaFile.file_path && mediaFile.file_path.includes('qr-templates')
                      ? `${API_BASE_URL}/uploads/qr-templates/${mediaFile.file_name}`
                      : `${API_BASE_URL}/uploads/media/${mediaFile.file_name}`,
                    file_path: mediaFile.file_path,
                    filename: mediaFile.file_name,
                    mime_type: mediaFile.mime_type,
                    size: mediaFile.file_size
                  };
                }
              } else if (blockMedia && blockMedia.url && !blockMedia.url.startsWith('http')) {
                // Se tem mídia mas não achou nos files, converter URL relativa para absoluta
                blockMedia = {
                  ...blockMedia,
                  url: `${API_BASE_URL}${blockMedia.url}`
                };
              }
              
              // 🎠 CARREGAR IMAGENS DOS CARDS DO CARROSSEL
              const processedCards = (block.cards || []).map((card: any, cardIdx: number) => {
                // Buscar a imagem deste card nos media_files
                const cardImage = mediaFiles.find((m: any) => 
                  m.block_id === block.id && 
                  m.carousel_card_index === cardIdx
                );
                
                let cardImageUrl = card.image;
                let uploadedImageData = card.uploadedImage;
                
                if (cardImage) {
                  // Reconstruir URL completa da imagem
                  // ✅ FIX: Verificar se é de qr-templates ou media baseado no file_path
                  const imagePath = cardImage.file_path && cardImage.file_path.includes('qr-templates')
                    ? `/uploads/qr-templates/${cardImage.file_name}`
                    : `/uploads/media/${cardImage.file_name}`;
                  
                  cardImageUrl = cardImage.url && cardImage.url.startsWith('http') 
                    ? cardImage.url 
                    : `${API_BASE_URL}${cardImage.url || imagePath}`;
                  
                  // Reconstruir objeto uploadedImage
                  uploadedImageData = {
                    url: cardImage.url || imagePath,
                    path: cardImage.file_path,
                    filename: cardImage.file_name,
                    mime_type: cardImage.mime_type,
                    size: cardImage.file_size
                  };
                  
                  console.log(`   🖼️ Card ${cardIdx} do bloco ${block.id}: Imagem carregada ao clonar`);
                } else if (cardImageUrl && !cardImageUrl.startsWith('data:') && !cardImageUrl.startsWith('blob:') && !cardImageUrl.startsWith('http')) {
                  // Fallback: converter URL relativa para absoluta
                  cardImageUrl = `${API_BASE_URL}${cardImageUrl}`;
                }
                
                return {
                  ...card,
                  id: card.id || `card-clone-${Date.now()}-${index}-${cardIdx}`,
                  image: cardImageUrl,
                  uploadedImage: uploadedImageData,
                  buttons: (card.buttons || []).map((btn: any, btnIdx: number) => ({
                    ...btn,
                    id: btn.id || `btn-clone-${Date.now()}-${index}-${cardIdx}-${btnIdx}`
                  }))
                };
              });
              
              return {
                id: `block-clone-${Date.now()}-${index}`,
                type: block.type,
                order: block.order !== undefined ? block.order : index,
                text: block.text || '',
                media: blockMedia,
                buttons: (block.buttons || []).map((btn: any, btnIdx: number) => ({
                  ...btn,
                  id: btn.id || `btn-clone-${Date.now()}-${index}-${btnIdx}`
                })),
                choices: block.choices || [],
                cards: processedCards,
                footerText: block.footerText || '',
                listButton: block.listButton || 'Ver Opções',
                selectableCount: block.selectableCount || 1,
                // Carregar listSections para tipo 'list'
                listSections: block.type === 'list' && block.listSections ? block.listSections : undefined
              };
            });
            
            setMessageBlocks(clonedBlocks);
            console.log('✅ Mensagem Combinada clonada com', clonedBlocks.length, 'blocos');
            console.log('📸 Mídias dos blocos:', clonedBlocks.filter((b: any) => b.media).length);
            console.log('🎠 Cards com imagens:', clonedBlocks.flatMap((b: any) => b.cards || []).filter((c: any) => c.image).length);
          }
          
          // Carregar variables_map
          if (templateData.variables_map) {
            setVariablesMap(templateData.variables_map);
          }
        }, 100);
        
        // Limpar sessionStorage
        sessionStorage.removeItem('templateToClone');
        
        console.log('✅ Template clonado carregado com sucesso!');
      }
    } catch (error) {
      console.error('❌ Erro ao carregar template clonado:', error);
    }
  };

  // Detectar variáveis no texto sempre que mudar
  useEffect(() => {
    let allText = '';
    
    // Para mensagens combinadas, extrair texto de todos os blocos
    if (messageType === 'combined') {
      messageBlocks.forEach(block => {
        if (block.type === 'text' && block.text) {
          allText += block.text + ' ';
        } else if (block.type === 'image' && block.caption) {
          allText += block.caption + ' ';
        } else if (block.type === 'video' && block.caption) {
          allText += block.caption + ' ';
        } else if (block.type === 'audio' && block.caption) {
          allText += block.caption + ' ';
        } else if (block.type === 'document' && block.caption) {
          allText += block.caption + ' ';
        } else if (block.type === 'list') {
          if (block.text) allText += block.text + ' ';
          if (block.title) allText += block.title + ' ';
          if (block.footerText) allText += block.footerText + ' ';
          // Extrair texto das seções e opções
          block.sections?.forEach((section: any) => {
            if (section.title) allText += section.title + ' ';
            section.rows?.forEach((row: any) => {
              if (row.title) allText += row.title + ' ';
              if (row.description) allText += row.description + ' ';
            });
          });
        } else if (block.type === 'button') {
          if (block.text) allText += block.text + ' ';
          if (block.footerText) allText += block.footerText + ' ';
          // Extrair texto dos botões
          block.buttons?.forEach((btn: any) => {
            if (btn.text) allText += btn.text + ' ';
          });
        } else if (block.type === 'carousel') {
          block.cards?.forEach((card: any) => {
            if (card.text) allText += card.text + ' ';
            // Extrair texto dos botões do card
            card.buttons?.forEach((btn: any) => {
              if (btn.text) allText += btn.text + ' ';
            });
          });
        }
      });
    } else if (messageType === 'list') {
      // Para lista simples
      allText = formData.text || '';
      if (listConfig.title) allText += ' ' + listConfig.title;
      if (listConfig.footerText) allText += ' ' + listConfig.footerText;
      listConfig.sections?.forEach(section => {
        if (section.title) allText += ' ' + section.title;
        section.rows?.forEach(row => {
          if (row.title) allText += ' ' + row.title;
          if (row.description) allText += ' ' + row.description;
        });
      });
    } else if (messageType === 'button') {
      // Para botões simples
      allText = formData.text || '';
      // Extrair texto dos botões
      buttons?.forEach(btn => {
        if (btn.text) allText += ' ' + btn.text;
      });
    } else if (messageType === 'carousel') {
      // Para carrossel simples
      allText = formData.text || '';
      cards?.forEach(card => {
        if (card.text) allText += ' ' + card.text;
        card.buttons?.forEach(btn => {
          if (btn.text) allText += ' ' + btn.text;
        });
      });
    } else {
      // Para outros tipos, usar text normal
      allText = formData.text || '';
    }
    
    const variables = detectVariables(allText);
    setDetectedVariables(variables);
  }, [formData.text, messageType, messageBlocks, listConfig, buttons, cards]);


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
    try {
      // Validações
      if (!templateName.trim()) {
        alert('❌ Por favor, preencha o nome do template');
        return;
      }

      if (messageType === 'text' && !formData.text.trim()) {
        alert('❌ Por favor, preencha o conteúdo do texto');
        return;
      }

      // Validação específica para cada tipo de mídia
      if (['image', 'video', 'document'].includes(messageType) && !uploadedMedia) {
        alert('❌ Por favor, faça upload do arquivo');
        return;
      }
      
      // Para áudio, verificar se tem upload ou gravação
      if (['audio', 'audio_recorded'].includes(messageType) && !uploadedMedia) {
        alert('❌ Por favor, faça upload ou grave um áudio');
        return;
      }

      setSaving(true);

      // Preparar dados para envio
      const formDataToSend = new FormData();
      formDataToSend.append('name', templateName);
      formDataToSend.append('description', templateDescription);
      
      // Converter tipo 'button' para 'buttons' para compatibilidade com backend
      const backendType = messageType === 'button' ? 'buttons' : messageType;
      formDataToSend.append('type', backendType);

      if (formData.text) {
        formDataToSend.append('text_content', formData.text);
      }

      // Adicionar mapeamento de variáveis
      if (Object.keys(variablesMap).length > 0) {
        formDataToSend.append('variables_map', JSON.stringify(variablesMap));
      }

      // Configurações específicas por tipo
      if (messageType === 'list') {
        // Usar listConfig diretamente (já está estruturado!)
        formDataToSend.append('list_config', JSON.stringify({
          buttonText: listConfig.buttonText,
          title: formData.text,
          footerText: listConfig.footerText || undefined,
          sections: listConfig.sections
        }));
      } else if (messageType === 'button') {
        formDataToSend.append('buttons_config', JSON.stringify({
          text: formData.text,
          footerText: formData.footerText || undefined,
          buttons: buttons.map(btn => ({
            id: btn.id,
            text: btn.text,
            type: btn.type || 'REPLY', // ADICIONAR tipo
            url: btn.url || undefined, // ADICIONAR url
            phone_number: btn.phone_number || undefined, // ADICIONAR telefone
            copy_code: btn.copy_code || undefined // ADICIONAR código
          }))
        }));
      } else if (messageType === 'poll') {
        // ⚠️ SALVAR POLL_CONFIG (estava faltando!)
        formDataToSend.append('poll_config', JSON.stringify({
          selectableCount: formData.selectableCount || 1,
          options: choices.filter(c => c.trim() !== '') // Remover opções vazias
        }));
      } else if (messageType === 'carousel') {
        formDataToSend.append('carousel_config', JSON.stringify({
          cards: cards.map(card => ({
            text: card.text,
            image: card.image,
            buttons: card.buttons.map(btn => ({
              id: btn.id,
              text: btn.text,
              type: btn.type || 'REPLY', // ADICIONAR tipo
              url: btn.url || undefined, // ADICIONAR url
              phone_number: btn.phone_number || undefined, // ADICIONAR telefone
              copy_code: btn.copy_code || undefined // ADICIONAR código
            }))
          }))
        }));
      } else if (messageType === 'combined') {
        // Salvar blocos de mensagens combinadas
        formDataToSend.append('combined_blocks', JSON.stringify({
          blocks: messageBlocks.map(block => ({
            id: block.id,
            type: block.type,
            order: block.order,
            text: block.text || '',
            media: block.media || null,
            buttons: block.buttons || [],
            choices: block.choices || [],
            cards: block.cards || [],
            footerText: block.footerText || '',
            listButton: block.listButton || 'Ver Opções',
            selectableCount: block.selectableCount || 1,
            // Adicionar listSections para tipo 'list'
            listSections: block.type === 'list' ? block.listSections : undefined
          }))
        }));
        
        // Coletar e enviar imagens de carrosséis dos blocos
        console.log('📦 COLETANDO IMAGENS DE CARROSSEL DOS BLOCOS...');
        let carouselImagesCount = 0;
        messageBlocks.forEach((block, blockIndex) => {
          if (block.type === 'carousel' && block.cards) {
            block.cards.forEach((card: Card, cardIndex: number) => {
              if (card.uploadedImage && card.uploadedImage.path) {
                console.log(`   ✅ Card ${cardIndex} do Bloco ${blockIndex}: ${card.uploadedImage.path}`);
                formDataToSend.append(`carousel_images[]`, JSON.stringify({
                  blockId: block.id,
                  blockOrder: block.order,
                  cardIndex: cardIndex,
                  url: card.uploadedImage.url,
                  path: card.uploadedImage.path
                }));
                carouselImagesCount++;
              }
            });
          }
        });
        console.log(`📦 Total de ${carouselImagesCount} imagem(ns) de carrossel coletadas`);
      }

      // ✅ SEMPRE USAR JSON (arquivo já foi uploadado via /api/upload/media)
      console.log('📝 [CRIAR] Usando JSON (arquivo já foi uploadado anteriormente)');
      
      // Preparar payload JSON
      const payload: any = {
        name: templateName,
        description: templateDescription,
        type: backendType,
        text_content: formData.text || ''
      };

      if (Object.keys(variablesMap).length > 0) {
        payload.variables_map = variablesMap;
      }

      // Adicionar mídia se existir
      if (uploadedMedia && uploadedMedia.path) {
        payload.media_url = uploadedMedia.url;
        payload.media_path = uploadedMedia.path;
        payload.media_type = messageType;
      }

      // Configurações específicas por tipo
      if (messageType === 'list') {
        payload.list_config = {
          buttonText: listConfig.buttonText,
          title: formData.text,
          footerText: listConfig.footerText || undefined,
          sections: listConfig.sections
        };
      } else if (messageType === 'button') {
        payload.buttons_config = {
          text: formData.text,
          footerText: formData.footerText || undefined,
          buttons: buttons.map(btn => ({
            id: btn.id,
            text: btn.text,
            type: btn.type || 'REPLY',
            url: btn.url || undefined,
            phone_number: btn.phone_number || undefined,
            copy_code: btn.copy_code || undefined
          }))
        };
      } else if (messageType === 'poll') {
        payload.poll_config = {
          selectableCount: formData.selectableCount || 1,
          options: choices.filter(c => c.trim() !== '')
        };
      } else if (messageType === 'carousel') {
        payload.carousel_config = {
          cards: cards.map(card => ({
            text: card.text,
            image: card.image,
            buttons: card.buttons.map(btn => ({
              id: btn.id,
              text: btn.text,
              type: btn.type || 'REPLY',
              url: btn.url || undefined,
              phone_number: btn.phone_number || undefined,
              copy_code: btn.copy_code || undefined
            }))
          }))
        };
      } else if (messageType === 'combined') {
        payload.combined_blocks = {
          blocks: messageBlocks.map(block => ({
            id: block.id,
            type: block.type,
            order: block.order,
            text: block.text || '',
            media: block.media || null,
            buttons: block.buttons || [],
            choices: block.choices || [],
            cards: block.cards || [],
            footerText: block.footerText || '',
            listButton: block.listButton || 'Ver Opções',
            selectableCount: block.selectableCount || 1,
            listSections: block.type === 'list' ? block.listSections : undefined
          }))
        };
      }

      console.log('📤 [CRIAR] Payload JSON:', payload);
      
      const response = await api.post('/qr-templates', payload);

      if (response.data.success) {
        alert('✅ Template salvo com sucesso!');
        
        // Perguntar se quer criar outro ou voltar para lista
        const continuar = confirm('Deseja criar outro template?');
        if (!continuar) {
          // Voltar para lista de templates
          router.push('/qr-templates');
        } else {
          // Limpar campos para criar novo
          setTemplateName('');
          setTemplateDescription('');
          setFormData({ type: messageType, text: '', footerText: '', listButton: 'Ver Opções', selectableCount: 1 });
          setUploadedMedia(null);
          setButtons([{ id: Date.now().toString(), text: '', type: 'REPLY' }]);
          setChoices(['']);
          setListConfig({
            buttonText: 'Ver Opções',
            title: '',
            footerText: '',
            sections: [{
              title: 'Seção 1',
              rows: [{ id: `opt${Date.now()}`, title: '', description: '' }]
            }]
          });
          setCards([{
            id: Date.now().toString(),
            text: '',
            image: '',
            buttons: [],
            uploadingImage: false
          }]);
          setMessageType('text');
        }
      }
    } catch (error: any) {
      console.error('Erro ao salvar template:', error);
      alert(`❌ Erro ao salvar template: ${error.response?.data?.details || error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleTypeChange = (type: MessageType) => {
    setMessageType(type);
    // Resetar estados
    setUploadedMedia(null);
    if (type === 'button') {
      setButtons([{ id: Date.now().toString(), text: '', type: 'REPLY' }]);
    } else if (type === 'poll') {
      setChoices(['', '', '']);
    } else if (type === 'list') {
      // Resetar listConfig para interface visual
      setListConfig({
        buttonText: 'Ver Opções',
        title: '',
        footerText: '',
        sections: [
          {
            title: 'Seção 1',
            rows: [
              { id: `opt${Date.now()}`, title: '', description: '' }
            ]
          }
        ]
      });
    } else {
      setChoices(['']);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 16 * 1024 * 1024) {
      alert('❌ Arquivo muito grande! Máximo: 16MB');
      return;
    }

    setUploadingMedia(true);
    try {
      const response = await uploadAPI.uploadMedia(file);
      // ✅ Backend pode retornar de 2 formas:
      // 1. { success: true, data: { url, filename, ... } } - novo formato
      // 2. { url, filename, ... } - formato antigo
      const data = response.data.data || response.data;
      
      console.log('📤 [CRIAR TEMPLATE] Upload completo:', {
        data,
        mime_type: data?.mime_type,
        mimetype: data?.mimetype,
        url: data?.url
      });
      
      // Verificar se data.url existe
      if (!data.url) {
        throw new Error('URL do arquivo não foi retornada pelo servidor');
      }
      
      // ✅ Converter URL relativa para URL completa
      const fullUrl = data.url.startsWith('http') || data.url.startsWith('data:') || data.url.startsWith('blob:')
        ? data.url 
        : `${API_BASE_URL}${data.url}`;
      
      console.log('📎 [CRIAR TEMPLATE] URL do arquivo:', fullUrl);
      
      setUploadedMedia({
        ...data,
        url: fullUrl
      });
      
      console.log('✅ [CRIAR TEMPLATE] uploadedMedia configurado');
    } catch (err: any) {
      console.error('❌ [CRIAR TEMPLATE] Erro no upload:', err);
      alert(err.response?.data?.error || 'Erro ao fazer upload');
    } finally {
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
      const data = response.data.data;
      data.localAudioUrl = audioUrl;
      setUploadedMedia(data);
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
      alert('❌ Você precisa ter pelo menos 1 card no carrossel');
    }
  };

  const updateCard = (cardId: string, field: string, value: any) => {
    setCards(cards.map(card => 
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
      const uploadedData = response.data.data;
      
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
      alert('❌ Erro ao fazer upload da imagem');
      setCards(cards.map(card => 
        card.id === cardId ? { ...card, uploadingImage: false } : card
      ));
    }
  };

  const addButtonToCard = (cardId: string) => {
    const card = cards.find(c => c.id === cardId);
    if (card && card.buttons.length >= 3) {
      alert('❌ Máximo de 3 botões por card');
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
    setCards(cards.map(card => 
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

  const getMessageTypeIcon = (type: MessageType) => {
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

  const getMessageTypeLabel = (type: MessageType) => {
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
      choices: type === 'poll' ? [''] : undefined,
      cards: type === 'carousel' ? [{
        id: Date.now().toString(),
        text: '',
        image: '',
        buttons: [],
        uploadingImage: false
      }] : undefined,
      listButton: type === 'list' ? 'Ver Opções' : undefined,
      selectableCount: type === 'poll' ? 1 : undefined,
      // Inicializar listSections para tipo 'list'
      listSections: type === 'list' ? [{
        title: 'Seção 1',
        rows: [{ id: `opt${Date.now()}`, title: '', description: '' }]
      }] : undefined,
    };
    setMessageBlocks([...messageBlocks, newBlock]);
    setShowAddBlockMenu(false);
  };

  const removeMessageBlock = (blockId: string) => {
    setMessageBlocks(messageBlocks.filter(b => b.id !== blockId));
  };

  const updateMessageBlock = (blockId: string, updates: Partial<MessageBlock>) => {
    setMessageBlocks(messageBlocks.map(block =>
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

  // Mostrar notificação toast
  const showNotification = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3001); // Auto-fechar após 5 segundos
  };

  // Adicionar variável personalizada
  const handleAddVariable = () => {
    if (!newVariableName.trim()) {
      showNotification('⚠️ Digite um nome para a variável', 'warning');
      return;
    }

    // Converter nome descritivo para chave (ex: "Nome do Cliente" → "nome_do_cliente")
    const variableKey = newVariableName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/[^a-z0-9\s]/g, '') // Remove caracteres especiais
      .trim()
      .replace(/\s+/g, '_'); // Substitui espaços por _

    // Verificar se já existe
    if (variablesMap[variableKey]) {
      showNotification('⚠️ Essa variável já existe', 'warning');
      return;
    }

    // Inserir no texto
    const variableTag = `{{${variableKey}}}`;
    
    // Se está em modo combinado E temos um bloco sendo editado
    if (messageType === 'combined' && currentEditingBlockId) {
      setMessageBlocks(messageBlocks.map(block => 
        block.id === currentEditingBlockId 
          ? { ...block, text: (block.text || '') + variableTag }
          : block
      ));
    } else {
      // Modo normal - insere em formData.text
      setFormData({ ...formData, text: formData.text + variableTag });
    }

    // Salvar no mapeamento
    setVariablesMap({ ...variablesMap, [variableKey]: newVariableName.trim() });

    // Limpar e fechar
    setNewVariableName('');
    setShowAddVariableModal(false);
    showNotification(`✅ Variável "${newVariableName}" adicionada!`, 'success');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 py-8 px-4">
      {/* NOTIFICAÇÃO TOAST */}
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
          } flex items-center gap-4 min-w-[400px] max-w-[600px] transition-all duration-500 ease-out`}
          style={{ animation: 'slideDown 0.5s ease-out' }}
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
      
      {/* Adicionar estilo de animação */}
      <style jsx>{`
        @keyframes slideDown {
          from {
            transform: translate(-50%, -100%);
            opacity: 0;
          }
          to {
            transform: translate(-50%, 0);
            opacity: 1;
          }
        }
      `}</style>

      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* CABEÇALHO */}
        <div className="bg-gradient-to-r from-green-600/30 via-emerald-500/20 to-teal-600/30 backdrop-blur-xl border-2 border-green-500/40 rounded-3xl p-10 shadow-2xl">
          <div className="flex items-center gap-6">
            <button
              onClick={() => router.push('/qr-templates')}
              className="bg-white/10 hover:bg-white/20 p-4 rounded-xl transition-all duration-200 border-2 border-white/20 hover:border-white/40"
            >
              <FaArrowLeft className="text-3xl text-white" />
            </button>
            <div className="flex-1">
              <h1 className="text-4xl md:text-5xl font-black text-white mb-3">
                💾 Criar Template QR Connect
              </h1>
              <p className="text-xl text-white/80">
                Crie templates reutilizáveis com todas as funcionalidades do sistema
              </p>
            </div>
            
            {/* BOTÃO AJUDA SOBRE VARIÁVEIS */}
            <button
              onClick={() => setShowHelpModal(true)}
              className="px-6 py-4 bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-xl border-2 border-yellow-500/40 flex flex-col items-center gap-1"
            >
              <FaQuestionCircle className="text-3xl" />
              <span className="text-sm">Como usar<br/>Variáveis?</span>
            </button>
          </div>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); handleSaveAsTemplate(); }} className="space-y-8">
            
            {/* CONFIGURAÇÕES BÁSICAS */}
            <div className="bg-white/10 backdrop-blur-xl border-2 border-white/20 rounded-2xl p-8 space-y-6">
              <h2 className="text-2xl font-bold text-white mb-6">
                📋 Informações do Template
              </h2>

              <div className="space-y-6">
                <div>
                  <label className="block text-lg font-bold mb-3 text-white">
                    ✏️ Nome do Template *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Promoção Black Friday"
                    className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-green-500 transition-all"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                  />
                  <p className="text-sm text-white/50 mt-2">
                    Escolha um nome descritivo para identificar o template depois
                  </p>
                </div>

                <div>
                  <label className="block text-lg font-bold mb-3 text-white">
                    📝 Descrição (opcional)
                  </label>
                  <textarea
                    placeholder="Descreva o que este template faz..."
                    rows={3}
                    className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-green-500 transition-all resize-none"
                    value={templateDescription}
                    onChange={(e) => setTemplateDescription(e.target.value)}
                  />
                </div>

                <div className="bg-green-500/10 border-2 border-green-500/30 rounded-xl p-4">
                  <p className="text-green-300 text-sm">
                    💡 <strong>Dica:</strong> Configure a mensagem abaixo exatamente como deseja salvar.
                    Todas as configurações serão preservadas no template!
                  </p>
                </div>
              </div>
            </div>

            {/* TIPO DE MENSAGEM */}
            <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-2 border-purple-500/40 rounded-2xl p-8">
              <h2 className="text-2xl font-bold text-white mb-6">🎨 Tipo de Mensagem</h2>
              
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {(['text', 'image', 'video', 'audio', 'document', 'button', 'list', 'poll', 'carousel'] as MessageType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleTypeChange(type)}
                    className={`p-6 rounded-xl border-2 transition-all ${
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
              </div>

              {/* MENSAGEM COMBINADA - BOTÃO ESPECIAL */}
              <div className="mt-6">
                <button
                  type="button"
                  onClick={() => handleTypeChange('combined')}
                  className={`w-full p-6 rounded-xl border-2 transition-all ${
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

            {/* CONTEÚDO DINÂMICO BASEADO NO TIPO */}
            <div className="bg-white/10 backdrop-blur-xl border-2 border-white/20 rounded-2xl p-8 space-y-6">
              <h2 className="text-2xl font-bold text-white mb-6">
                📝 Conteúdo da Mensagem - {getMessageTypeLabel(messageType)}
              </h2>

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
                                      placeholder="Digite o texto... Use {{variavel}} para campos dinâmicos"
                                      value={block.text || ''}
                                      onChange={(e) => updateMessageBlock(block.id, { text: e.target.value })}
                                    />
                                    
                                    {/* Botão Adicionar Variável */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setCurrentEditingBlockId(block.id);
                                        setShowAddVariableModal(true);
                                      }}
                                      className="mt-2 px-3 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold rounded-lg transition-all flex items-center gap-2 text-sm"
                                    >
                                      ➕ Adicionar Variável
                                    </button>
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
                                                    const data = response.data.data || response.data;
                                                    
                                                    // ✅ Converter URL relativa para URL completa
                                                    const fullUrl = data.url && (data.url.startsWith('http') || data.url.startsWith('data:') || data.url.startsWith('blob:'))
                                                      ? data.url 
                                                      : `${API_BASE_URL}${data.url}`;
                                                    
                                                    updateMessageBlock(block.id, { 
                                                      media: {
                                                        ...data,
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
                                                console.log('🎤 [AUDIO] Áudio recebido, iniciando upload...');
                                                console.log('🎤 [AUDIO] Tamanho do blob:', audioBlob.size, 'bytes');
                                                try {
                                                  const audioFile = new File([audioBlob], 'audio-gravado.ogg', { type: 'audio/ogg; codecs=opus' });
                                                  console.log('🎤 [AUDIO] File criado:', audioFile.name, audioFile.size, 'bytes');
                                                  
                                                  console.log('🎤 [AUDIO] Enviando para uploadAPI.uploadMedia...');
                                                  const response = await uploadAPI.uploadMedia(audioFile);
                                                  console.log('🎤 [AUDIO] Response recebido:', response);
                                                  console.log('🎤 [AUDIO] response.data:', response.data);
                                                  
                                                  const data = response.data;
                                                  console.log('🎤 [AUDIO] data extraído:', data);
                                                  
                                                  // Construir URL absoluta
                                                  let mediaUrl = data.url;
                                                  if (!mediaUrl) {
                                                    mediaUrl = `/uploads/media/${data.filename}`;
                                                  }
                                                  if (!mediaUrl.startsWith('http') && !mediaUrl.startsWith('data:') && !mediaUrl.startsWith('blob:')) {
                                                    mediaUrl = `${API_BASE_URL}${mediaUrl}`;
                                                  }
                                                  console.log('🎤 [AUDIO] URL final do áudio:', mediaUrl);
                                                  
                                                  updateMessageBlock(block.id, { 
                                                    media: { 
                                                      ...data, 
                                                      url: mediaUrl,
                                                      mimetype: data.mimetype || data.mime_type || 'audio/ogg',
                                                      mime_type: data.mime_type || data.mimetype || 'audio/ogg',
                                                      localAudioUrl: audioUrl 
                                                    } 
                                                  });
                                                  console.log('✅ [AUDIO] Upload e update concluídos com sucesso!');
                                                } catch (err: any) {
                                                  console.error('❌ [AUDIO] Erro COMPLETO:', err);
                                                  console.error('❌ [AUDIO] err.response:', err.response);
                                                  console.error('❌ [AUDIO] err.response?.data:', err.response?.data);
                                                  console.error('❌ [AUDIO] err.message:', err.message);
                                                  alert(err.response?.data?.error || err.message || 'Erro ao fazer upload do áudio');
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
                                              <p className="text-white text-sm font-bold">✅ {block.media.original_name}</p>
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

                                {/* Lista - Interface VISUAL com Seções Expansíveis */}
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

                                    {/* Seções (Interface Visual) */}
                                    <div>
                                      <label className="block text-sm font-bold mb-3 text-white/80">
                                        📑 Seções ({(block.listSections || []).length})
                                      </label>
                                      
                                      {(block.listSections || []).map((section: any, secIdx: number) => (
                                        <div key={`section-${secIdx}`} className="bg-dark-700/50 border-2 border-white/10 rounded-xl p-4 mb-3">
                                          <div className="flex justify-between items-center mb-3">
                                            <input
                                              type="text"
                                              value={section.title}
                                              onChange={(e) => {
                                                const newSections = [...(block.listSections || [])];
                                                newSections[secIdx].title = e.target.value;
                                                updateMessageBlock(block.id, { listSections: newSections });
                                              }}
                                              placeholder="Nome da Seção"
                                              className="flex-1 bg-dark-800 border-2 border-white/10 rounded-lg px-3 py-2 text-white placeholder-white/50 focus:outline-none focus:border-blue-500 font-bold text-sm"
                                            />
                                            {(block.listSections || []).length > 1 && (
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const newSections = (block.listSections || []).filter((_: any, i: number) => i !== secIdx);
                                                  updateMessageBlock(block.id, { listSections: newSections });
                                                }}
                                                className="ml-2 bg-red-500 hover:bg-red-600 px-3 py-1 rounded-lg text-white text-xs font-bold"
                                              >
                                                <FaTrash />
                                              </button>
                                            )}
                                          </div>

                                          {/* Itens da Seção */}
                                          {section.rows.map((row: any, rowIdx: number) => (
                                            <div key={`row-${rowIdx}`} className="bg-dark-800 border border-white/10 rounded-lg p-3 mb-2">
                                              <div className="space-y-2">
                                                <input
                                                  type="text"
                                                  value={row.title}
                                                  onChange={(e) => {
                                                    const newSections = [...(block.listSections || [])];
                                                    newSections[secIdx].rows[rowIdx].title = e.target.value;
                                                    updateMessageBlock(block.id, { listSections: newSections });
                                                  }}
                                                  placeholder="Título do item"
                                                  className="w-full bg-dark-700 border border-white/10 rounded px-2 py-2 text-white placeholder-white/50 focus:outline-none focus:border-blue-500 text-sm"
                                                />
                                                <input
                                                  type="text"
                                                  value={row.description}
                                                  onChange={(e) => {
                                                    const newSections = [...(block.listSections || [])];
                                                    newSections[secIdx].rows[rowIdx].description = e.target.value;
                                                    updateMessageBlock(block.id, { listSections: newSections });
                                                  }}
                                                  placeholder="Descrição"
                                                  className="w-full bg-dark-700 border border-white/10 rounded px-2 py-2 text-white placeholder-white/50 focus:outline-none focus:border-blue-500 text-xs"
                                                />
                                                <div className="flex justify-end">
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      const newSections = [...(block.listSections || [])];
                                                      newSections[secIdx].rows = newSections[secIdx].rows.filter((_: any, i: number) => i !== rowIdx);
                                                      updateMessageBlock(block.id, { listSections: newSections });
                                                    }}
                                                    className="bg-red-500 hover:bg-red-600 px-2 py-1 rounded text-white text-xs font-bold"
                                                  >
                                                    <FaTrash />
                                                  </button>
                                                </div>
                                              </div>
                                            </div>
                                          ))}

                                          <button
                                            type="button"
                                            onClick={() => {
                                              const newSections = [...(block.listSections || [])];
                                              newSections[secIdx].rows.push({ id: `row${Date.now()}`, title: '', description: '' });
                                              updateMessageBlock(block.id, { listSections: newSections });
                                            }}
                                            className="w-full bg-blue-500 hover:bg-blue-600 px-3 py-2 rounded text-white text-xs font-bold"
                                          >
                                            <FaPlus className="inline mr-1" /> Adicionar Item
                                          </button>
                                        </div>
                                      ))}

                                      <button
                                        type="button"
                                        onClick={() => {
                                          const currentSections = block.listSections || [];
                                          updateMessageBlock(block.id, { 
                                            listSections: [...currentSections, { 
                                              title: 'Nova Seção', 
                                              rows: [{ id: `row${Date.now()}`, title: '', description: '' }] 
                                            }] 
                                          });
                                        }}
                                        className="w-full bg-green-600 hover:bg-green-700 px-4 py-3 rounded-xl text-white font-bold"
                                      >
                                        <FaPlus className="inline mr-2" /> Adicionar Seção
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
                                          
                                          {!card.image ? (
                                            <div className="relative">
                                              <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                id={`carousel-card-${block.id}-${cardIndex}`}
                                                onChange={async (e) => {
                                                  const file = e.target.files?.[0];
                                                  if (!file) return;
                                                  
                                                  if (file.size > 16 * 1024 * 1024) {
                                                    alert('❌ Arquivo muito grande! Máximo: 16MB');
                                                    return;
                                                  }
                                                  
                                                  try {
                                                    // Upload da imagem para o servidor
                                                    const response = await uploadAPI.uploadMedia(file);
                                                    const uploadedData = response.data.data;
                                                    
                                                    // Converter URL relativa para URL completa
                                                    const imageUrl = uploadedData.url.startsWith('http') 
                                                      ? uploadedData.url 
                                                      : `${API_BASE_URL}${uploadedData.url}`;
                                                    
                                                    const newCards = [...(block.cards || [])];
                                                    newCards[cardIndex] = { 
                                                      ...card, 
                                                      image: imageUrl,
                                                      uploadedImage: uploadedData // Armazenar dados do upload
                                                    };
                                                    updateMessageBlock(block.id, { cards: newCards });
                                                    
                                                    showNotification('✅ Imagem do card enviada!', 'success');
                                                  } catch (err) {
                                                    console.error('Erro ao fazer upload:', err);
                                                    alert('❌ Erro ao fazer upload da imagem');
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
                                                  onClick={() => {
                                                    const newCards = [...(block.cards || [])];
                                                    newCards[cardIndex] = { ...card, image: '', uploadedImage: null };
                                                    updateMessageBlock(block.id, { cards: newCards });
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

              {/* TEXTO (Para todos os tipos) */}
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
                    placeholder="Digite o texto da mensagem... Use {{variavel}} para campos dinâmicos"
                    value={formData.text}
                    onChange={(e) => setFormData({ ...formData, text: e.target.value })}
                  />
                  
                  {/* Botão Adicionar Variável */}
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentEditingBlockId(null); // Limpar ID do bloco
                      setShowAddVariableModal(true);
                    }}
                    className="mt-3 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold rounded-lg transition-all flex items-center gap-2"
                  >
                    <FaPlus /> Adicionar Variável
                  </button>
                  
                  {/* Variáveis Detectadas */}
                  {detectedVariables.length > 0 && (
                    <div className="mt-3 bg-purple-500/10 border-2 border-purple-500/30 rounded-xl p-4">
                      <p className="text-sm font-semibold text-purple-300 mb-2">
                        🔧 Variáveis detectadas:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {detectedVariables.map(variable => {
                          const { system, custom } = categorizeVariables([variable]);
                          const isSystem = system.length > 0;
                          
                          return (
                            <span
                              key={variable}
                              className={`px-3 py-1 rounded-lg text-sm font-mono font-semibold ${
                                isSystem
                                  ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                                  : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                              }`}
                              title={isSystem ? 'Variável automática (sistema)' : 'Variável personalizada (você preenche)'}
                            >
                              {`{{${variable}}}`}
                              {isSystem && ' ✨'}
                            </span>
                          );
                        })}
                      </div>
                      <p className="text-xs text-white/50 mt-2">
                        💡 <strong>Dica:</strong> Variáveis com ✨ são preenchidas automaticamente
                      </p>
                    </div>
                  )}
                  
                  {/* Ajuda sobre variáveis */}
                  <div className="mt-2 bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                    <p className="text-xs text-blue-300">
                      💡 <strong>Variáveis disponíveis:</strong> {'{{'} nome {'}}'}, {'{{'} valor {'}}'}, {'{{'} data {'}}'}  ✨, {'{{'} hora {'}}'}  ✨, {'{{'} protocolo {'}}'}  ✨, {'{{'} saudacao {'}}'}  ✨
                    </p>
                  </div>
                </div>
              )}

              {/* UPLOAD DE MÍDIA (Para imagem, vídeo, áudio, documento) */}
              {(messageType === 'image' || messageType === 'video' || messageType === 'audio' || messageType === 'document') && (
                <div>
                  <label className="block text-lg font-bold mb-3 text-white flex items-center gap-2">
                    <FaImage className="text-blue-400" />
                    📎 Arquivo
                  </label>

                  {!uploadedMedia ? (
                    <>
                      {/* Tabs para escolher entre Upload e Gravar (apenas para áudio) */}
                      {messageType === 'audio' && (
                        <div className="flex gap-2 mb-4">
                          <button
                            type="button"
                            onClick={() => setMediaMode('upload')}
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
                            onClick={() => setMediaMode('record')}
                            className={`flex-1 px-4 py-3 rounded-lg font-bold transition-all flex items-center justify-center gap-2 ${
                              mediaMode === 'record'
                                ? 'bg-red-500 text-white'
                                : 'bg-white/5 text-white/60 hover:bg-white/10'
                            }`}
                          >
                            <FaMicrophone /> Gravar Áudio
                          </button>
                        </div>
                      )}

                      {/* Modo Upload */}
                      {(messageType !== 'audio' || mediaMode === 'upload') && (
                        <>
                          {/* Toggle para múltiplos arquivos */}
                          {(messageType === 'image' || messageType === 'video' || messageType === 'audio' || messageType === 'document') && (
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
                           {useMultipleFiles && messageType !== ('button' as MessageType) ? (
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
                                disabled={uploadingMedia}
                                className="hidden"
                              />
                              <label
                                htmlFor="media-upload"
                                className={`block w-full px-6 py-8 bg-dark-700/80 border-2 border-dashed border-white/20 rounded-xl text-center cursor-pointer hover:border-blue-500 hover:bg-blue-500/5 transition-all ${
                                  uploadingMedia ? 'opacity-50 cursor-not-allowed' : ''
                                }`}
                              >
                                {uploadingMedia ? (
                                  <div className="flex flex-col items-center gap-3">
                                    <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-500"></div>
                                    <p className="text-white text-lg font-bold">Fazendo upload...</p>
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
                        <div className="bg-red-500/10 border-2 border-red-500/40 rounded-xl p-6">
                          <AudioRecorder 
                            onAudioReady={handleAudioRecorded}
                            onRemove={handleRemoveMedia}
                          />
                        </div>
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
                          {(() => {
                            // ✅ FIX: Detectar tipo de arquivo por MIME type OU extensão
                            const filename = uploadedMedia.filename || uploadedMedia.originalname || uploadedMedia.url || '';
                            const isImage = uploadedMedia.mime_type?.startsWith('image/') || 
                                           /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(filename) ||
                                           messageType === 'image';
                            const isVideo = uploadedMedia.mime_type?.startsWith('video/') || 
                                           /\.(mp4|avi|mov|wmv|flv|webm)$/i.test(filename) ||
                                           messageType === 'video';
                            const isAudio = uploadedMedia.mime_type?.startsWith('audio/') || 
                                           /\.(mp3|wav|ogg|m4a|aac)$/i.test(filename) ||
                                           (['audio', 'audio_recorded'] as MessageType[]).includes(messageType);
                            
                            if (isImage) return <FaImage className="text-3xl text-blue-400" />;
                            if (isVideo) return <FaVideo className="text-3xl text-purple-400" />;
                            if (isAudio) return <FaMusic className="text-3xl text-green-400" />;
                            return <FaImage className="text-3xl text-gray-400" />;
                          })()}
                          <div>
                            <p className="font-bold text-white">{uploadedMedia.original_name || 'Arquivo'}</p>
                            <p className="text-sm text-white/60">
                              {uploadedMedia.size ? (uploadedMedia.size / 1024 / 1024).toFixed(2) + ' MB' : 'Tamanho desconhecido'}
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
                      {(() => {
                        // ✅ FIX: Detectar imagem por MIME type OU por extensão do arquivo
                        const isImageByMime = uploadedMedia.mime_type?.startsWith('image/');
                        const filename = uploadedMedia.filename || uploadedMedia.originalname || uploadedMedia.url || '';
                        const isImageByExtension = /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(filename);
                        const isImageType = formData.type === 'image';
                        const isImage = isImageByMime || isImageByExtension || isImageType;
                        
                        return isImage ? (
                          <div className="mt-4 bg-dark-700/50 rounded-xl p-4">
                            <img
                              src={uploadedMedia.url.startsWith('http') ? uploadedMedia.url : `${API_BASE_URL}${uploadedMedia.url}`}
                              alt="Preview"
                              className="max-w-full h-auto max-h-96 rounded-lg mx-auto object-contain"
                            />
                          </div>
                        ) : null;
                      })()}

                      {/* PLAYER DE VÍDEO */}
                      {(() => {
                        // ✅ FIX: Detectar vídeo por MIME type OU por extensão do arquivo
                        const filename = uploadedMedia.filename || uploadedMedia.originalname || uploadedMedia.url || '';
                        const isVideo = uploadedMedia.mime_type?.startsWith('video/') || 
                                      /\.(mp4|avi|mov|wmv|flv|webm|mkv|m4v)$/i.test(filename) ||
                                      formData.type === 'video';
                        return isVideo ? (
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
                        ) : null;
                      })()}

                      {/* PLAYER DE ÁUDIO */}
                      {(() => {
                        // ✅ FIX: Detectar áudio por MIME type OU por extensão do arquivo
                        const filename = uploadedMedia.filename || uploadedMedia.originalname || uploadedMedia.url || '';
                        const isAudio = uploadedMedia.mime_type?.startsWith('audio/') || 
                                      /\.(mp3|wav|ogg|m4a|aac|opus|flac)$/i.test(filename) ||
                                      formData.type === 'audio' || formData.type === 'audio_recorded';
                        return isAudio ? (
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
                        ) : null;
                      })()}
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
                  {/* Rodapé (Opcional) */}
                  <div>
                    <label className="block text-lg font-bold mb-3 text-white">
                      👣 Texto do Rodapé (Opcional)
                    </label>
                    <input
                      type="text"
                      className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-blue-500 transition-all"
                      placeholder="Ex: Escolha uma opção"
                      value={listConfig.footerText}
                      onChange={(e) => setListConfig({...listConfig, footerText: e.target.value})}
                    />
                  </div>

                  {/* Texto do Botão */}
                  <div>
                    <label className="block text-lg font-bold mb-3 text-white">
                      🔘 Texto do Botão da Lista
                    </label>
                    <input
                      type="text"
                      required
                      className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-blue-500 transition-all"
                      placeholder="Ex: Ver Opções, Ver Catálogo..."
                      value={listConfig.buttonText}
                      onChange={(e) => setListConfig({...listConfig, buttonText: e.target.value})}
                    />
                  </div>

                  {/* Seções */}
                  <div>
                    <label className="block text-white font-bold mb-4">📑 Seções ({listConfig.sections.length})</label>
                    {listConfig.sections.map((section, secIdx) => (
                      <div key={`section-${secIdx}-${section.title}`} className="bg-dark-700/50 border-2 border-white/10 rounded-xl p-6 mb-4">
                        <div className="flex justify-between items-center mb-4">
                          <input
                            type="text"
                            value={section.title}
                            onChange={(e) => {
                              const newSections = [...listConfig.sections];
                              newSections[secIdx].title = e.target.value;
                              setListConfig({...listConfig, sections: newSections});
                            }}
                            placeholder="Nome da Seção"
                            className="flex-1 bg-dark-800 border-2 border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/50 focus:outline-none focus:border-blue-500 font-bold"
                          />
                          {listConfig.sections.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const newSections = listConfig.sections.filter((_, i) => i !== secIdx);
                                setListConfig({...listConfig, sections: newSections});
                              }}
                              className="ml-3 bg-red-500 hover:bg-red-600 px-4 py-2 rounded-xl text-white font-bold"
                            >
                              <FaTrash />
                            </button>
                          )}
                        </div>

                        {/* Itens da Seção */}
                        {section.rows.map((row, rowIdx) => (
                          <div key={`section-${secIdx}-row-${rowIdx}-${row.id}`} className="bg-dark-800 border border-white/10 rounded-lg p-4 mb-3">
                            <div className="space-y-3">
                              <input
                                type="text"
                                value={row.title}
                                onChange={(e) => {
                                  const newSections = [...listConfig.sections];
                                  newSections[secIdx].rows[rowIdx].title = e.target.value;
                                  setListConfig({...listConfig, sections: newSections});
                                }}
                                placeholder="Título do item"
                                className="w-full bg-dark-700 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-white/50 focus:outline-none focus:border-blue-500"
                              />
                              <input
                                type="text"
                                value={row.description}
                                onChange={(e) => {
                                  const newSections = [...listConfig.sections];
                                  newSections[secIdx].rows[rowIdx].description = e.target.value;
                                  setListConfig({...listConfig, sections: newSections});
                                }}
                                placeholder="Descrição"
                                className="w-full bg-dark-700 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-white/50 focus:outline-none focus:border-blue-500 text-sm"
                              />
                              <div className="flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newSections = [...listConfig.sections];
                                    newSections[secIdx].rows = newSections[secIdx].rows.filter((_, i) => i !== rowIdx);
                                    setListConfig({...listConfig, sections: newSections});
                                  }}
                                  className="bg-red-500 hover:bg-red-600 px-3 py-1 rounded-lg text-white text-sm font-bold"
                                >
                                  <FaTrash />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}

                        <button
                          type="button"
                          onClick={() => {
                            const newSections = [...listConfig.sections];
                            newSections[secIdx].rows.push({ id: `row${Date.now()}`, title: '', description: '' });
                            setListConfig({...listConfig, sections: newSections});
                          }}
                          className="w-full bg-blue-500 hover:bg-blue-600 px-4 py-2 rounded-lg text-white font-bold"
                        >
                          <FaPlus className="inline mr-2" /> Adicionar Item
                        </button>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() => {
                        setListConfig({
                          ...listConfig,
                          sections: [...listConfig.sections, { title: 'Nova Seção', rows: [{ id: `row${Date.now()}`, title: '', description: '' }] }]
                        });
                      }}
                      className="w-full bg-green-600 hover:bg-green-700 px-6 py-3 rounded-xl text-white font-bold"
                    >
                      <FaPlus className="inline mr-2" /> Adicionar Seção
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
                        <div key={`poll-choice-${index}-${choice.substring(0, 20)}`} className="flex items-center gap-3">
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
                                onClick={() => {
                                  // Atualizar ambos os campos de uma vez só!
                                  setCards(cards.map(c => 
                                    c.id === card.id ? { ...c, image: '', uploadedImage: null } : c
                                  ));
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

            {/* BOTÃO SALVAR TEMPLATE */}
            <button
              type="submit"
              disabled={saving}
              className="w-full py-6 rounded-2xl font-bold text-2xl transition-all duration-300 flex items-center justify-center gap-4 bg-gradient-to-r from-green-500 via-emerald-600 to-green-600 hover:from-green-600 hover:via-emerald-700 hover:to-green-700 shadow-2xl shadow-green-500/50 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-6 w-6 border-4 border-white border-t-transparent"></div>
                  Salvando Template...
                </>
              ) : (
                <>
                  <FaSave className="text-3xl" />
                  💾 Salvar Template
                </>
              )}
            </button>
          </form>
      </div>

      {/* MODAL DE AJUDA SOBRE VARIÁVEIS */}
      {showHelpModal && (
        <VariablesHelpModal onClose={() => setShowHelpModal(false)} />
      )}

      {/* MODAL PARA ADICIONAR VARIÁVEL */}
      {showAddVariableModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setShowAddVariableModal(false)}>
          <div className="bg-dark-800 rounded-2xl border-2 border-purple-500/30 max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                ➕ Adicionar Variável
              </h3>
              <button
                onClick={() => setShowAddVariableModal(false)}
                className="text-white/70 hover:text-white text-2xl"
              >
                <FaTimes />
              </button>
            </div>

            {/* Explicação */}
            <p className="text-white/70 mb-4">
              Digite um nome <strong>descritivo</strong> para sua variável. Esse nome aparecerá quando você for preencher o template.
            </p>

            {/* Exemplos */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-4">
              <p className="text-sm text-blue-300 font-semibold mb-2">💡 Exemplos:</p>
              <ul className="text-xs text-white/70 space-y-1">
                <li>• Nome do Cliente</li>
                <li>• Valor a Pagar</li>
                <li>• CPF do Cliente</li>
                <li>• Endereço de Entrega</li>
              </ul>
            </div>

            {/* Campo de input */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-white mb-2">
                Nome da Variável *
              </label>
              <input
                type="text"
                value={newVariableName}
                onChange={(e) => setNewVariableName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddVariable()}
                placeholder="Ex: Nome do Cliente"
                className="w-full px-4 py-3 bg-dark-700 border-2 border-white/20 rounded-lg text-white focus:border-purple-500 transition-all"
                autoFocus
              />
            </div>

            {/* Preview */}
            {newVariableName && (
              <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3 mb-4">
                <p className="text-xs text-purple-300 font-semibold mb-1">Será inserido como:</p>
                <code className="text-sm text-white font-mono">
                  {`{{${newVariableName
                    .toLowerCase()
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .replace(/[^a-z0-9\s]/g, '')
                    .trim()
                    .replace(/\s+/g, '_')}}}`}
                </code>
              </div>
            )}

            {/* Botões */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowAddVariableModal(false)}
                className="flex-1 px-4 py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-lg transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAddVariable}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold rounded-lg transition-all"
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

