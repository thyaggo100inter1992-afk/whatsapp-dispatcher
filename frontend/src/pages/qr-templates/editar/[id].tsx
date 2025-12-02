import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import {
  FaArrowLeft, FaSave, FaImage, FaVideo, FaMusic, FaMicrophone, FaFile,
  FaList, FaThList, FaPlus, FaTrash, FaTimes, FaUpload, FaPlay, FaPause
} from 'react-icons/fa';
import api from '@/services/api';
import { uploadAPI } from '@/services/api';
import { detectVariables, categorizeVariables } from '@/utils/templateVariables';
import AudioRecorder from '@/components/AudioRecorder';
import EmojiPickerButton from '@/components/EmojiPickerButton';

// Configuração da URL base da API
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || '${API_BASE_URL}/api').replace(/\/api$/, '');

type TemplateType = 'text' | 'image' | 'video' | 'audio' | 'audio_recorded' | 'document' | 'list' | 'buttons' | 'carousel' | 'poll' | 'combined';

interface ButtonOption {
  id: string;
  text: string;
  type?: string;
  url?: string;
  phone_number?: string;
  copy_code?: string;
}

interface ListSection {
  title: string;
  rows: Array<{
    id: string;
    title: string;
    description: string;
  }>;
}

interface CarouselCard {
  id: string;
  text: string;
  image: string | null;
  buttons: ButtonOption[];
  uploadedImage?: any;
  uploadingImage?: boolean;
}

export default function EditarTemplate() {
  const router = useRouter();
  const { id } = router.query;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'text' as TemplateType,
    text_content: ''
  });

  // Estados para mídia
  const [uploadedMedia, setUploadedMedia] = useState<any>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [existingMediaFiles, setExistingMediaFiles] = useState<any[]>([]);

  // Estados para Menu Lista
  const [listConfig, setListConfig] = useState({
    buttonText: 'Ver Opções',
    title: '',
    footerText: '',
    sections: [
      {
        title: 'Seção 1',
        rows: [
          { id: 'opt1', title: 'Opção 1', description: 'Descrição da opção 1' }
        ]
      }
    ] as ListSection[]
  });

  // Estados para Menu Botões
  const [buttonsConfig, setButtonsConfig] = useState({
    text: '',
    footerText: '',
    buttons: [
      { id: 'btn1', text: 'Botão 1' }
    ] as ButtonOption[]
  });

  // Estados para Carrossel
  const [carouselCards, setCarouselCards] = useState<CarouselCard[]>([
    {
      id: 'card1',
      text: '',
      image: null,
      buttons: [{ id: 'btn1', text: 'Botão 1' }]
    }
  ]);

  // Estados para Enquete (Poll)
  const [pollConfig, setPollConfig] = useState({
    options: ['Opção 1', 'Opção 2', 'Opção 3'],
    selectableCount: 1
  });

  // Estados para Mensagens Combinadas
  const [messageBlocks, setMessageBlocks] = useState<any[]>([]);
  const [showAddBlockMenu, setShowAddBlockMenu] = useState(false);
  const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null);
  const [currentEditingBlockId, setCurrentEditingBlockId] = useState<string | null>(null);

  // Estados para detecção de variáveis
  const [detectedVariables, setDetectedVariables] = useState<string[]>([]);
  
  // Estados para adicionar variável personalizada
  const [showAddVariableModal, setShowAddVariableModal] = useState(false);
  const [newVariableName, setNewVariableName] = useState('');
  const [variablesMap, setVariablesMap] = useState<Record<string, string>>({});

  // Estados para player de mídia (vídeo/áudio)
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const [mediaPlaybackState, setMediaPlaybackState] = useState({
    isPlaying: false,
    currentTime: 0,
    duration: 0
  });

  // Detectar variáveis quando o texto muda
  useEffect(() => {
    let allText = '';
    
    // Para mensagens combinadas, extrair texto de todos os blocos
    if (formData.type === 'combined') {
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
        } else if (block.type === 'buttons') {
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
    } else if (formData.type === 'list') {
      // Para lista simples
      allText = formData.text_content || '';
      if (listConfig.title) allText += ' ' + listConfig.title;
      if (listConfig.footerText) allText += ' ' + listConfig.footerText;
      listConfig.sections?.forEach(section => {
        if (section.title) allText += ' ' + section.title;
        section.rows?.forEach(row => {
          if (row.title) allText += ' ' + row.title;
          if (row.description) allText += ' ' + row.description;
        });
      });
    } else if (formData.type === 'buttons') {
      // Para botões simples
      allText = buttonsConfig.text || '';
      if (buttonsConfig.footerText) allText += ' ' + buttonsConfig.footerText;
      buttonsConfig.buttons?.forEach(btn => {
        if (btn.text) allText += ' ' + btn.text;
      });
    } else if (formData.type === 'carousel') {
      // Para carrossel simples
      allText = formData.text_content || '';
      carouselCards?.forEach(card => {
        if (card.text) allText += ' ' + card.text;
        card.buttons?.forEach(btn => {
          if (btn.text) allText += ' ' + btn.text;
        });
      });
    } else {
      // Para outros tipos, usar text_content normal
      allText = formData.text_content || '';
    }
    
    const variables = detectVariables(allText);
    setDetectedVariables(variables);
  }, [formData.text_content, formData.type, messageBlocks, listConfig, buttonsConfig, carouselCards]);

  useEffect(() => {
    if (id) {
      loadTemplate();
    }
  }, [id]);

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

  const loadTemplate = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/qr-templates/${id}`);
      
      if (response.data.success) {
        const template = response.data.data;
        
        console.log('✅ [EDITAR] Template completo recebido:', template);
        console.log('   - Tipo:', template.type);
        console.log('   - list_config:', template.list_config);
        console.log('   - buttons_config:', template.buttons_config);
        
        // Converter tipo 'buttons' para 'buttons' (backend usa 'buttons')
        const templateType = template.type;
        
        setFormData({
          name: template.name,
          description: template.description || '',
          type: templateType,
          text_content: template.text_content || ''
        });

        // Carregar configurações específicas
        if (template.list_config) {
          // Parse se for string
          let listConfig = template.list_config;
          if (typeof listConfig === 'string') {
            try {
              listConfig = JSON.parse(listConfig);
            } catch (e) {
              console.error('Erro ao fazer parse de list_config:', e);
            }
          }
          console.log('📋 [EDITAR] list_config carregado:', listConfig);
          setListConfig(listConfig);
        }
        
        if (template.buttons_config) {
          // Parse se for string
          let buttonsConfig = template.buttons_config;
          if (typeof buttonsConfig === 'string') {
            try {
              buttonsConfig = JSON.parse(buttonsConfig);
            } catch (e) {
              console.error('Erro ao fazer parse de buttons_config:', e);
            }
          }
          console.log('🔘 [EDITAR] buttons_config carregado:', buttonsConfig);
          // Garantir que todos os botões tenham IDs únicos
          if (buttonsConfig && buttonsConfig.buttons) {
            buttonsConfig.buttons = buttonsConfig.buttons.map((btn: any, idx: number) => ({
              ...btn,
              id: btn.id || `btn-${Date.now()}-${idx}`
            }));
          }
          console.log('🔘 [EDITAR] buttonsConfig final:', buttonsConfig);
          setButtonsConfig(buttonsConfig);
        }
        
        if (template.carousel_config) {
          // Parse se for string
          let carouselConfig = template.carousel_config;
          if (typeof carouselConfig === 'string') {
            try {
              carouselConfig = JSON.parse(carouselConfig);
            } catch (e) {
              console.error('Erro ao fazer parse de carousel_config:', e);
            }
          }
          // Garantir que todos os cards e botões tenham IDs únicos
          const cardsWithIds = (carouselConfig?.cards || []).map((card: any, idx: number) => ({
            ...card,
            id: card.id || `card-${Date.now()}-${idx}`,
            buttons: (card.buttons || []).map((btn: any, btnIdx: number) => ({
              ...btn,
              id: btn.id || `btn-${Date.now()}-${btnIdx}`
            }))
          }));
          setCarouselCards(cardsWithIds);
        }
        
        if (template.poll_config) {
          // Parse se for string
          let pollConfigData = template.poll_config;
          if (typeof pollConfigData === 'string') {
            try {
              pollConfigData = JSON.parse(pollConfigData);
            } catch (e) {
              console.error('Erro ao fazer parse de poll_config:', e);
            }
          }
          setPollConfig(pollConfigData);
        }

        // Carregar blocos de mensagens combinadas
        if (template.combined_blocks) {
          let combinedBlocksData = template.combined_blocks;
          if (typeof combinedBlocksData === 'string') {
            try {
              combinedBlocksData = JSON.parse(combinedBlocksData);
            } catch (e) {
              console.error('Erro ao fazer parse de combined_blocks:', e);
            }
          }
          // Carregar blocos com IDs únicos garantidos
          if (combinedBlocksData && combinedBlocksData.blocks) {
            const mediaFiles = template.media_files || [];
            console.log('📦 Media files disponíveis:', mediaFiles.length);
            
            const blocksWithIds = combinedBlocksData.blocks.map((block: any, idx: number) => {
              // 🔧 CORRIGIR URLs de mídia do bloco (se houver)
              let blockMedia = block.media;
              if (blockMedia && blockMedia.url) {
                // Só adiciona base URL se não tiver protocolo
                if (!blockMedia.url.startsWith('data:') && !blockMedia.url.startsWith('blob:') && !blockMedia.url.startsWith('http')) {
                  blockMedia = {
                    ...blockMedia,
                    url: `${API_BASE_URL}${blockMedia.url}`
                  };
                } else if (blockMedia.url.includes('${API_BASE_URL}${API_BASE_URL}')) {
                  // Corrige URL duplicada (bug antigo)
                  blockMedia = {
                    ...blockMedia,
                    url: blockMedia.url.replace('${API_BASE_URL}${API_BASE_URL}', '${API_BASE_URL}')
                  };
                }
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
                  // ✅ FIX: Usar URL do banco se existir, senão construir baseado no file_path
                  let imageUrl = cardImage.url;
                  if (!imageUrl) {
                    // Verificar se é de qr-templates ou media baseado no file_path
                    if (cardImage.file_path && cardImage.file_path.includes('qr-templates')) {
                      imageUrl = `/uploads/qr-templates/${cardImage.file_name}`;
                    } else {
                      imageUrl = `/uploads/media/${cardImage.file_name}`;
                    }
                  }
                  
                  // Corrigir URL duplicada se existir
                  if (imageUrl.includes('${API_BASE_URL}${API_BASE_URL}')) {
                    imageUrl = imageUrl.replace('${API_BASE_URL}${API_BASE_URL}', '${API_BASE_URL}');
                  }
                  
                  cardImageUrl = imageUrl.startsWith('http') 
                    ? imageUrl 
                    : `${API_BASE_URL}${imageUrl}`;
                  
                  // Reconstruir objeto uploadedImage (com URL relativa, sem duplicação)
                  uploadedImageData = {
                    url: cardImage.url && !cardImage.url.startsWith('http') 
                      ? cardImage.url 
                      : cardImage.url?.replace('${API_BASE_URL}', '') || (
                        cardImage.file_path && cardImage.file_path.includes('qr-templates')
                          ? `/uploads/qr-templates/${cardImage.file_name}`
                          : `/uploads/media/${cardImage.file_name}`
                      ),
                    path: cardImage.file_path,
                    filename: cardImage.file_name,
                    mime_type: cardImage.mime_type,
                    size: cardImage.file_size
                  };
                  
                  console.log(`   🖼️ Card ${cardIdx} do bloco ${block.id}: Imagem carregada`);
                } else {
                  // ✨ Se não encontrou no banco, tentar extrair do uploadedImage
                  if (card.uploadedImage) {
                    if (card.uploadedImage.url && !card.uploadedImage.url.startsWith('blob:')) {
                      cardImageUrl = card.uploadedImage.url;
                    } else if (card.uploadedImage.path) {
                      // Extrair filename do path do Windows
                      const pathParts = card.uploadedImage.path.split(/[\\\/]/);
                      const filename = pathParts[pathParts.length - 1];
                      // ✅ FIX: Verificar se é de qr-templates ou media baseado no path
                      if (card.uploadedImage.path.includes('qr-templates')) {
                        cardImageUrl = `/uploads/qr-templates/${filename}`;
                      } else {
                        cardImageUrl = `/uploads/media/${filename}`;
                      }
                      console.log(`   🔧 Extraído filename do path para card ${cardIdx}:`, filename);
                    } else if (card.uploadedImage.filename) {
                      // ✅ FIX: Verificar baseado no path se disponível
                      if (card.uploadedImage.path && card.uploadedImage.path.includes('qr-templates')) {
                        cardImageUrl = `/uploads/qr-templates/${card.uploadedImage.filename}`;
                      } else {
                        cardImageUrl = `/uploads/media/${card.uploadedImage.filename}`;
                      }
                    }
                  }
                  
                  // Normalizar URL se não for blob
                  if (cardImageUrl && !cardImageUrl.startsWith('blob:')) {
                    if (!cardImageUrl.startsWith('data:') && !cardImageUrl.startsWith('http')) {
                      cardImageUrl = `${API_BASE_URL}${cardImageUrl}`;
                    }
                  }
                }
                
                return {
                  ...card,
                  id: card.id || `card-${Date.now()}-${idx}-${cardIdx}`,
                  image: cardImageUrl,
                  uploadedImage: uploadedImageData,
                  buttons: (card.buttons || []).map((btn: any, btnIdx: number) => ({
                    ...btn,
                    id: btn.id || `btn-${Date.now()}-${idx}-${cardIdx}-${btnIdx}`
                  }))
                };
              });
              
              return {
                ...block,
                id: block.id || `block-${Date.now()}-${idx}`,
                media: blockMedia,
                buttons: (block.buttons || []).map((btn: any, btnIdx: number) => ({
                  ...btn,
                  id: btn.id || `btn-${Date.now()}-${idx}-${btnIdx}`
                })),
                cards: processedCards
              };
            });
            setMessageBlocks(blocksWithIds);
            console.log('✅ Blocos de mensagem combinada carregados:', blocksWithIds.length);
            console.log('🎠 Cards com imagens:', blocksWithIds.flatMap((b: any) => b.cards || []).filter((c: any) => c.image).length);
          }
        }

        // Carregar mapeamento de variáveis
        if (template.variables_map) {
          let variablesMapData = template.variables_map;
          if (typeof variablesMapData === 'string') {
            try {
              variablesMapData = JSON.parse(variablesMapData);
            } catch (e) {
              console.error('Erro ao fazer parse de variables_map:', e);
            }
          }
          setVariablesMap(variablesMapData || {});
        }

        // Carregar arquivos de mídia existentes
        if (template.media_files && template.media_files.length > 0) {
          setExistingMediaFiles(template.media_files);
          
          // Se o template for de mídia (image, video, audio, document) e tiver arquivo, carregar no uploadedMedia
          if (['image', 'video', 'audio', 'document'].includes(templateType) && template.media_files[0]) {
            const existingMedia = template.media_files[0];
            
            // Construir URL completa
            // ✅ FIX: Usar a URL do banco se existir, senão tentar construir
            // Upload via /api/upload/media salva em /uploads/media/
            // Upload direto do backend pode salvar em /uploads/qr-templates/
            let mediaUrl = existingMedia.url;
            if (!mediaUrl) {
              // Tentar extrair do file_path se não tiver URL
              if (existingMedia.file_path) {
                // Se o file_path contém 'qr-templates', usar esse diretório
                if (existingMedia.file_path.includes('qr-templates')) {
                  mediaUrl = `/uploads/qr-templates/${existingMedia.file_name}`;
                } else {
                  // Caso contrário, usar /uploads/media/ (padrão)
                  mediaUrl = `/uploads/media/${existingMedia.file_name}`;
                }
              } else {
                // Fallback: tentar /uploads/media/ primeiro (mais comum)
                mediaUrl = `/uploads/media/${existingMedia.file_name}`;
              }
            }
            
            if (!mediaUrl.startsWith('http')) {
              mediaUrl = `${API_BASE_URL}${mediaUrl}`;
            }
            
            console.log('📎 [EDITAR] Carregando mídia existente:', {
              url: mediaUrl,
              path: existingMedia.file_path || existingMedia.url,
              filename: existingMedia.file_name
            });
            
            const uploadedMediaData = {
              id: existingMedia.id,
              url: mediaUrl,
              path: existingMedia.file_path || existingMedia.url,
              filename: existingMedia.file_name,
              originalname: existingMedia.original_name || existingMedia.file_name,
              original_name: existingMedia.original_name || existingMedia.file_name,
              mimetype: existingMedia.mime_type,
              mime_type: existingMedia.mime_type,
              size: existingMedia.file_size,
              isExisting: true
            };
            
            console.log('📸 [EDITAR] uploadedMedia configurado:', uploadedMediaData);
            console.log('   - mime_type:', uploadedMediaData.mime_type);
            console.log('   - mimetype:', uploadedMediaData.mimetype);
            console.log('   - url:', uploadedMediaData.url);
            console.log('   - size:', uploadedMediaData.size);
            console.log('   - Vai mostrar prévia?', uploadedMediaData.mime_type?.startsWith('image/'));
            
            setUploadedMedia(uploadedMediaData);
          }
        }
      }
    } catch (error) {
      console.error('Erro ao carregar template:', error);
      alert('Erro ao carregar template');
      router.push('/qr-templates');
    } finally {
      setLoading(false);
    }
  };

  const handleTypeChange = (type: TemplateType) => {
    setFormData({ ...formData, type });
    setUploadedMedia(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 100 * 1024 * 1024) {
      alert('❌ Arquivo muito grande! Máximo: 100MB');
      return;
    }

    setUploadingMedia(true);
    try {
      const response = await uploadAPI.uploadMedia(file);
      console.log('📤 [EDITAR] Response completo:', response);
      console.log('📤 [EDITAR] response.data:', response.data);
      
      // ✅ O backend retorna response.data = { success, url, filename, ... }
      const data = response.data;
      console.log('📤 [EDITAR] data extraído:', data);
      console.log('📤 [EDITAR] data.url:', data.url);
      console.log('📤 [EDITAR] data.filename:', data.filename);
      
      // ✅ CORRIGIR: Garantir que a URL seja absoluta
      // O backend pode retornar 'url' ou precisar construir baseado em outras props
      let mediaUrl = data.url;
      if (!mediaUrl) {
        // Se não tem URL, construir baseado no filename
        mediaUrl = `/uploads/media/${data.filename}`;
      }
      
      console.log('📤 [EDITAR] mediaUrl ANTES de converter para absoluta:', mediaUrl);
      
      // Converter para URL absoluta se necessário
      if (!mediaUrl.startsWith('http') && !mediaUrl.startsWith('data:') && !mediaUrl.startsWith('blob:')) {
        mediaUrl = `${API_BASE_URL}${mediaUrl}`;
      }
      
      console.log('📤 [EDITAR] mediaUrl DEPOIS de converter para absoluta:', mediaUrl);

      const uploadedMediaData = {
        ...data,
        url: mediaUrl,
        mimetype: data.mimetype || data.mime_type || file.type,
        mime_type: data.mime_type || data.mimetype || file.type,
        originalname: data.originalname || data.original_name || file.name,
        original_name: data.original_name || data.originalname || file.name,
        size: data.size || file.size
      };
      
      console.log('✅ [EDITAR] uploadedMedia configurado (novo arquivo):', uploadedMediaData);
      console.log('   - url:', uploadedMediaData.url);
      console.log('   - mime_type:', uploadedMediaData.mime_type);
      console.log('   - size:', uploadedMediaData.size);
      
      setUploadedMedia(uploadedMediaData);
      alert('✅ Arquivo enviado com sucesso!');
    } catch (err: any) {
      console.error('❌ [EDITAR] Erro no upload:', err);
      alert(err.response?.data?.error || 'Erro ao fazer upload');
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleRemoveMedia = () => {
    console.log('🗑️ Removendo mídia do state uploadedMedia');
    setUploadedMedia(null);
  };

  const handleDeleteExistingMedia = async (mediaId: number) => {
    if (!confirm('Tem certeza que deseja deletar este arquivo?')) return;

    try {
      console.log('🗑️ Deletando mídia existente ID:', mediaId);
      await api.delete(`/qr-templates/${id}/media/${mediaId}`);
      setExistingMediaFiles(existingMediaFiles.filter(m => m.id !== mediaId));
      console.log('✅ Mídia deletada do servidor e removida da lista');
      alert('✅ Arquivo deletado!');
    } catch (error) {
      console.error('❌ Erro ao deletar mídia:', error);
      alert('Erro ao deletar arquivo');
    }
  };

  // ==========================================
  // FUNÇÕES PARA MENSAGENS COMBINADAS
  // ==========================================
  type MessageType = 'text' | 'image' | 'video' | 'audio' | 'document' | 'button' | 'list' | 'poll' | 'carousel';

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
    }
  };

  const removeMessageBlock = (blockId: string) => {
    setMessageBlocks(messageBlocks.filter(b => b.id !== blockId));
  };

  const updateMessageBlock = (blockId: string, updates: Partial<any>) => {
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

  const addMessageBlock = (type: MessageType) => {
    const newBlock: any = {
      id: Date.now().toString(),
      type,
      order: messageBlocks.length,
      text: '',
      media: undefined,
      buttons: type === 'button' ? [{ id: Date.now().toString(), text: '', type: 'REPLY' }] : undefined,
      choices: type === 'list' || type === 'poll' ? [''] : undefined,
      listButton: type === 'list' ? 'Ver Opções' : undefined,
      selectableCount: type === 'poll' ? 1 : undefined,
      cards: type === 'carousel' ? [{
        id: Date.now().toString(),
        text: '',
        image: '',
        buttons: [],
        uploadingImage: false
      }] : undefined
    };
    setMessageBlocks([...messageBlocks, newBlock]);
    setShowAddBlockMenu(false);
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
  // ==========================================

  // Mesmas funções da página de criar (Menu Lista)
  const addListSection = () => {
    setListConfig({
      ...listConfig,
      sections: [
        ...listConfig.sections,
        {
          title: `Seção ${listConfig.sections.length + 1}`,
          rows: [{ id: `opt${Date.now()}`, title: '', description: '' }]
        }
      ]
    });
  };

  const removeListSection = (index: number) => {
    const newSections = listConfig.sections.filter((_, i) => i !== index);
    setListConfig({ ...listConfig, sections: newSections });
  };

  const addListRow = (sectionIndex: number) => {
    const newSections = [...listConfig.sections];
    newSections[sectionIndex].rows.push({
      id: `opt${Date.now()}`,
      title: '',
      description: ''
    });
    setListConfig({ ...listConfig, sections: newSections });
  };

  const removeListRow = (sectionIndex: number, rowIndex: number) => {
    const newSections = [...listConfig.sections];
    newSections[sectionIndex].rows = newSections[sectionIndex].rows.filter((_, i) => i !== rowIndex);
    setListConfig({ ...listConfig, sections: newSections });
  };

  const updateListSection = (sectionIndex: number, field: string, value: string) => {
    const newSections = [...listConfig.sections];
    (newSections[sectionIndex] as any)[field] = value;
    setListConfig({ ...listConfig, sections: newSections });
  };

  const updateListRow = (sectionIndex: number, rowIndex: number, field: string, value: string) => {
    const newSections = [...listConfig.sections];
    (newSections[sectionIndex].rows[rowIndex] as any)[field] = value;
    setListConfig({ ...listConfig, sections: newSections });
  };

  // Mesmas funções da página de criar (Menu Botões)
  const addButton = () => {
    setButtonsConfig({
      ...buttonsConfig,
      buttons: [
        ...buttonsConfig.buttons,
        { id: `btn${Date.now()}`, text: '' }
      ]
    });
  };

  const removeButton = (index: number) => {
    const newButtons = buttonsConfig.buttons.filter((_, i) => i !== index);
    setButtonsConfig({ ...buttonsConfig, buttons: newButtons });
  };

  const updateButton = (index: number, text: string) => {
    const newButtons = [...buttonsConfig.buttons];
    newButtons[index].text = text;
    setButtonsConfig({ ...buttonsConfig, buttons: newButtons });
  };

  // Mesmas funções da página de criar (Carrossel)
  const addCarouselCard = () => {
    setCarouselCards([
      ...carouselCards,
      {
        id: `card${Date.now()}`,
        text: '',
        image: null,
        buttons: [{ id: `btn${Date.now()}`, text: 'Botão 1' }]
      }
    ]);
  };

  const removeCarouselCard = (index: number) => {
    setCarouselCards(carouselCards.filter((_, i) => i !== index));
  };

  const updateCarouselCard = (index: number, field: string, value: any) => {
    const newCards = [...carouselCards];
    (newCards[index] as any)[field] = value;
    setCarouselCards(newCards);
  };

  const addCarouselButton = (cardIndex: number) => {
    const newCards = [...carouselCards];
    newCards[cardIndex].buttons.push({ id: `btn${Date.now()}`, text: '' });
    setCarouselCards(newCards);
  };

  const removeCarouselButton = (cardIndex: number, buttonIndex: number) => {
    const newCards = [...carouselCards];
    newCards[cardIndex].buttons = newCards[cardIndex].buttons.filter((_, i) => i !== buttonIndex);
    setCarouselCards(newCards);
  };

  const updateCarouselButton = (cardIndex: number, buttonIndex: number, text: string) => {
    const newCards = [...carouselCards];
    newCards[cardIndex].buttons[buttonIndex].text = text;
    setCarouselCards(newCards);
  };

  const handleCarouselImageUpload = async (cardIndex: number, file: File) => {
    const newCards = [...carouselCards];
    try {
      const response = await uploadAPI.uploadMedia(file);
      const uploadedData = response.data;
      
      // Construir URL absoluta
      let mediaUrl = uploadedData.url;
      if (!mediaUrl) {
        mediaUrl = `/uploads/media/${uploadedData.filename}`;
      }
      if (!mediaUrl.startsWith('http') && !mediaUrl.startsWith('data:') && !mediaUrl.startsWith('blob:')) {
        mediaUrl = `${API_BASE_URL}${mediaUrl}`;
      }
      
      newCards[cardIndex].uploadedImage = {
        ...uploadedData,
        url: mediaUrl,
        mimetype: uploadedData.mimetype || uploadedData.mime_type || file.type,
        mime_type: uploadedData.mime_type || uploadedData.mimetype || file.type
      };
      newCards[cardIndex].image = mediaUrl;
      setCarouselCards(newCards);
      alert('✅ Imagem do card enviada!');
    } catch (err) {
      alert('Erro ao enviar imagem do card');
    }
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingMedia(true);
      const response = await uploadAPI.uploadMedia(file);
      
      console.log('📤 [EDITAR] Upload completo:', response.data);
      
      // ✅ CORRIGIR: response.data JÁ é o objeto com url, filename, etc
      const data = response.data;
      
      // Construir URL absoluta
      let mediaUrl = data.url;
      if (!mediaUrl) {
        mediaUrl = `/uploads/media/${data.filename}`;
      }
      if (!mediaUrl.startsWith('http') && !mediaUrl.startsWith('data:') && !mediaUrl.startsWith('blob:')) {
        mediaUrl = `${API_BASE_URL}${mediaUrl}`;
      }
      
      setUploadedMedia({
        ...data,
        url: mediaUrl,
        mimetype: data.mimetype || data.mime_type || file.type,
        mime_type: data.mime_type || data.mimetype || file.type,
        originalName: file.name,
        isExisting: false // ← Marcar como NOVO arquivo (não existente no template)
      });
      
      console.log('✅ [EDITAR] uploadedMedia configurado (novo arquivo)');
      alert('✅ Arquivo enviado com sucesso!');
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      alert('❌ Erro ao fazer upload do arquivo');
    } finally {
      setUploadingMedia(false);
    }
  };

  // Funções do player de mídia
  const formatMediaTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleMediaPlayPause = () => {
    if (!mediaRef.current) return;
    
    if (mediaPlaybackState.isPlaying) {
      mediaRef.current.pause();
    } else {
      mediaRef.current.play();
    }
    setMediaPlaybackState({ ...mediaPlaybackState, isPlaying: !mediaPlaybackState.isPlaying });
  };

  const handleMediaTimeUpdate = () => {
    if (!mediaRef.current) return;
    setMediaPlaybackState({
      ...mediaPlaybackState,
      currentTime: mediaRef.current.currentTime
    });
  };

  const handleMediaSeek = (time: number) => {
    if (!mediaRef.current) return;
    mediaRef.current.currentTime = time;
    setMediaPlaybackState({ ...mediaPlaybackState, currentTime: time });
  };

  // Adicionar variável personalizada
  const handleAddVariable = () => {
    if (!newVariableName.trim()) {
      alert('⚠️ Digite um nome para a variável');
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
      alert('⚠️ Essa variável já existe');
      return;
    }

    // Inserir no texto
    const variableTag = `{{${variableKey}}}`;
    
    // Se está em modo combinado E temos um bloco sendo editado
    if (formData.type === 'combined' && currentEditingBlockId) {
      setMessageBlocks(messageBlocks.map(block => 
        block.id === currentEditingBlockId 
          ? { ...block, text: (block.text || '') + variableTag }
          : block
      ));
    } else {
      // Modo normal - insere em formData.text_content
      setFormData({ ...formData, text_content: formData.text_content + variableTag });
    }

    // Salvar no mapeamento
    setVariablesMap({ ...variablesMap, [variableKey]: newVariableName.trim() });

    // Limpar e fechar
    setNewVariableName('');
    setShowAddVariableModal(false);
    alert(`✅ Variável "${newVariableName}" adicionada!`);
  };

  const handleUpdate = async () => {
    try {
      // Validações
      if (!formData.name.trim()) {
        alert('❌ Por favor, preencha o nome do template');
        return;
      }

      setSaving(true);

      // ✅ SEMPRE USAR JSON (arquivo já foi uploadado via /api/upload/media)
      console.log('📝 [UPDATE] Usando JSON (arquivo já foi uploadado anteriormente)');
      
      const payload: any = {
        name: formData.name,
        description: formData.description,
        type: formData.type,
        text_content: formData.text_content || ''
      };

      if (Object.keys(variablesMap).length > 0) {
        payload.variables_map = variablesMap;
      }

      // Adicionar mídia se existir (nova ou existente)
      if (uploadedMedia && uploadedMedia.path) {
        payload.media_url = uploadedMedia.url;
        payload.media_path = uploadedMedia.path;
        payload.media_type = formData.type;
        console.log('📎 [UPDATE] Incluindo mídia no payload:', {
          url: uploadedMedia.url,
          path: uploadedMedia.path,
          type: formData.type,
          isExisting: uploadedMedia.isExisting
        });
      }

      // Configurações específicas por tipo
      if (formData.type === 'list') {
        payload.list_config = listConfig;
      } else if (formData.type === 'buttons') {
        payload.buttons_config = buttonsConfig;
      } else if (formData.type === 'carousel') {
        payload.carousel_config = {
          cards: carouselCards.map(card => ({
            text: card.text,
            image: card.image,
            buttons: card.buttons.map((btn: any) => ({
              id: btn.id,
              text: btn.text,
              type: btn.type || 'REPLY',
              url: btn.url || undefined,
              phone_number: btn.phone_number || undefined,
              copy_code: btn.copy_code || undefined
            }))
          }))
        };
      } else if (formData.type === 'poll') {
        payload.poll_config = pollConfig;
      } else if (formData.type === 'combined') {
        payload.combined_blocks = {
          blocks: messageBlocks
        };
      }

      console.log('📤 [UPDATE] Payload JSON:', payload);
      
      const response = await api.put(`/qr-templates/${id}`, payload);

      if (response.data.success) {
        alert('✅ Template atualizado com sucesso!');
        router.push('/qr-templates');
      }
    } catch (error: any) {
      console.error('Erro ao atualizar template:', error);
      alert(`❌ Erro ao atualizar template: ${error.response?.data?.details || error.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-20 w-20 border-b-4 border-blue-500 mb-4"></div>
          <p className="text-2xl text-white/70">Carregando template...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 py-8 px-4">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* HEADER */}
        <div className="bg-gradient-to-r from-blue-600/30 via-indigo-500/20 to-blue-600/30 backdrop-blur-xl border-2 border-blue-500/40 rounded-3xl p-8 shadow-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/qr-templates')}
                className="bg-white/10 hover:bg-white/20 p-4 rounded-xl transition-all duration-200"
              >
                <FaArrowLeft className="text-2xl text-white" />
              </button>
              
              <div>
                <h1 className="text-5xl font-black text-white mb-2">
                  ✏️ Editar Template
                </h1>
                <p className="text-xl text-white/80">
                  Atualize as informações do template
                </p>
              </div>
            </div>

            <button
              onClick={handleUpdate}
              disabled={saving}
              className="flex items-center gap-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 disabled:from-gray-500 disabled:to-gray-600 px-8 py-4 rounded-xl text-white text-lg font-bold transition-all duration-200 shadow-lg"
            >
              <FaSave className="text-xl" />
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </div>

        {/* O RESTO DO CONTEÚDO É IGUAL À PÁGINA DE CRIAR - REUTILIZADO */}
        {/* Para brevidade, vou colocar apenas os principais componentes */}

        {/* INFORMAÇÕES BÁSICAS */}
        <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-8">
          <h2 className="text-3xl font-bold text-white mb-6">📋 Informações Básicas</h2>
          
          <div className="space-y-4">
            {/* Nome */}
            <div>
              <label className="block text-white font-bold mb-2">Nome do Template *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Promoção Black Friday"
                className="w-full bg-dark-700 border-2 border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/50 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Descrição */}
            <div>
              <label className="block text-white font-bold mb-2">Descrição (opcional)</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descreva o que este template faz..."
                rows={3}
                className="w-full bg-dark-700 border-2 border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/50 focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>
          </div>
        </div>

        {/* Tipo de mensagem é somente leitura ao editar */}
        <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-8">
          <h2 className="text-3xl font-bold text-white mb-4">📝 Tipo de Mensagem</h2>
          <div className="bg-yellow-500/10 border-2 border-yellow-500/30 rounded-xl p-4 mb-4">
            <p className="text-yellow-300 font-bold">
              ⚠️ O tipo de mensagem não pode ser alterado após a criação
            </p>
          </div>
          <p className="text-2xl text-white font-bold">
            Tipo atual: <span className="text-blue-400">{formData.type}</span>
          </p>
        </div>

        {/* Arquivos existentes - Não mostrar para tipos de mídia simples e mensagens combinadas */}
        {existingMediaFiles.length > 0 && 
         formData.type !== 'combined' && 
         !['image', 'video', 'audio', 'document'].includes(formData.type) && (
          <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-8">
            <h2 className="text-3xl font-bold text-white mb-6">📎 Arquivos Salvos</h2>
            <div className="space-y-4">
              {existingMediaFiles.map((media) => (
                <div key={media.id} className="bg-dark-700 rounded-lg p-4">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex-1">
                      <p className="text-white font-bold">{media.original_name || media.file_name}</p>
                      <p className="text-white/50 text-sm">
                        {media.media_type} - {(media.file_size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteExistingMedia(media.id)}
                      className="bg-red-500 hover:bg-red-600 px-4 py-2 rounded-lg text-white font-bold"
                    >
                      <FaTrash />
                    </button>
                  </div>
                  
                  {/* Preview da mídia */}
                  <div className="bg-dark-800 rounded-lg overflow-hidden">
                    {media.media_type === 'image' && media.url && (
                      <img 
                        src={normalizeMediaUrl(media.url)}
                        alt={media.original_name || media.file_name}
                        className="w-full max-h-64 object-contain"
                      />
                    )}
                    
                    {media.media_type === 'video' && media.url && (
                      <video 
                        src={normalizeMediaUrl(media.url)}
                        controls
                        className="w-full max-h-64"
                      />
                    )}
                    
                    {media.media_type === 'audio' && media.url && (
                      <div className="p-4">
                        <audio 
                          src={normalizeMediaUrl(media.url)}
                          controls
                          className="w-full"
                        />
                      </div>
                    )}
                    
                    {media.media_type === 'document' && (
                      <div className="p-4 flex items-center gap-3">
                        <FaFile className="text-4xl text-blue-400" />
                        <div className="flex-1">
                          <p className="text-white font-bold">{media.original_name || media.file_name}</p>
                          <p className="text-white/50 text-sm">{media.mime_type}</p>
                        </div>
                        {media.url && (
                          <a
                            href={normalizeMediaUrl(media.url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-blue-500 hover:bg-blue-600 px-4 py-2 rounded-lg text-white font-bold"
                          >
                            Abrir
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MENSAGENS COMBINADAS - INTERFACE COMPLETA */}
        {formData.type === 'combined' && (
          <div className="bg-white/10 backdrop-blur-xl border-2 border-white/20 rounded-2xl p-8 space-y-6">
            <h2 className="text-2xl font-bold text-white mb-6">
              📝 Conteúdo da Mensagem - Mensagem Combinada
            </h2>

            <div className="space-y-6">
              {/* Info sobre delay */}
              <div className="bg-blue-500/10 border-2 border-blue-500/40 rounded-xl p-4">
                <p className="text-blue-300 text-sm flex items-center gap-2">
                  ℹ️ <span>Edite os blocos da mensagem combinada. Cada bloco será enviado em sequência com os delays configurados.</span>
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
                                                    mimetype: data.mimetype || data.mime_type || file.type,
                                                    mime_type: data.mime_type || data.mimetype || file.type
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
                                          src={normalizeMediaUrl(block.media.url)}
                                          alt="Preview"
                                          className="w-full max-h-64 object-contain bg-black"
                                        />
                                      </div>
                                    )}

                                    {/* Preview de Vídeo */}
                                    {block.type === 'video' && (
                                      <div className="relative rounded-xl overflow-hidden border-2 border-green-500/40">
                                        <video 
                                          src={normalizeMediaUrl(block.media.url)}
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
                                              src={(block.media as any).localAudioUrl || normalizeMediaUrl(block.media.url)}
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

                            {/* Carrossel - Interface COMPLETA */}
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
                                            const newBlocks = messageBlocks.map(b => {
                                              if (b.id === block.id) {
                                                return { ...b, cards: (b.cards || []).filter((_: any, i: number) => i !== cardIndex) };
                                              }
                                              return b;
                                            });
                                            setMessageBlocks(newBlocks);
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
                                          const newBlocks = messageBlocks.map(b => {
                                            if (b.id === block.id) {
                                              const newCards = [...(b.cards || [])];
                                              newCards[cardIndex] = { ...card, text: e.target.value };
                                              return { ...b, cards: newCards };
                                            }
                                            return b;
                                          });
                                          setMessageBlocks(newBlocks);
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
                                                const uploadedData = response.data;
                                                
                                                // Construir URL absoluta
                                                let mediaUrl = uploadedData.url;
                                                if (!mediaUrl) {
                                                  mediaUrl = `/uploads/media/${uploadedData.filename}`;
                                                }
                                                if (!mediaUrl.startsWith('http') && !mediaUrl.startsWith('data:') && !mediaUrl.startsWith('blob:')) {
                                                  mediaUrl = `${API_BASE_URL}${mediaUrl}`;
                                                }
                                                
                                                const newBlocks = messageBlocks.map(b => {
                                                  if (b.id === block.id) {
                                                    const newCards = [...(b.cards || [])];
                                                    newCards[cardIndex] = { 
                                                      ...card, 
                                                      image: mediaUrl,
                                                      uploadedImage: {
                                                        ...uploadedData,
                                                        url: mediaUrl,
                                                        mimetype: uploadedData.mimetype || uploadedData.mime_type || file.type,
                                                        mime_type: uploadedData.mime_type || uploadedData.mimetype || file.type
                                                      }
                                                    };
                                                    return { ...b, cards: newCards };
                                                  }
                                                  return b;
                                                });
                                                setMessageBlocks(newBlocks);
                                                
                                                alert('✅ Imagem do card enviada!');
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
                                                const newBlocks = messageBlocks.map(b => {
                                                  if (b.id === block.id) {
                                                    const newCards = [...(b.cards || [])];
                                                    newCards[cardIndex] = { ...card, image: '', uploadedImage: null };
                                                    return { ...b, cards: newCards };
                                                  }
                                                  return b;
                                                });
                                                setMessageBlocks(newBlocks);
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
                                          <p className="text-yellow-300 font-bold text-sm">
                                            ⚠️ Este card precisa ter pelo menos 1 botão
                                          </p>
                                        </div>
                                      ) : (
                                        <div className="space-y-3">
                                          {(card.buttons || []).map((btn: any, btnIdx: number) => (
                                            <div key={btn.id || btnIdx} className="bg-dark-700/50 border border-white/20 rounded-xl p-4 space-y-3">
                                              <div className="flex items-center justify-between">
                                                <p className="text-white font-bold text-sm">Botão #{btnIdx + 1}</p>
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    const newBlocks = messageBlocks.map(b => {
                                                      if (b.id === block.id) {
                                                        const newCards = [...(b.cards || [])];
                                                        newCards[cardIndex] = {
                                                          ...card,
                                                          buttons: (card.buttons || []).filter((_: any, i: number) => i !== btnIdx)
                                                        };
                                                        return { ...b, cards: newCards };
                                                      }
                                                      return b;
                                                    });
                                                    setMessageBlocks(newBlocks);
                                                  }}
                                                  className="text-red-400 hover:text-red-300 text-xs"
                                                >
                                                  <FaTrash className="inline" />
                                                </button>
                                              </div>

                                              <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                  <label className="block text-xs text-white/60 mb-1">Tipo</label>
                                                  <select
                                                    value={btn.type || 'REPLY'}
                                                    onChange={(e) => {
                                                      const newBlocks = messageBlocks.map(b => {
                                                        if (b.id === block.id) {
                                                          const newCards = [...(b.cards || [])];
                                                          const newButtons = [...(card.buttons || [])];
                                                          newButtons[btnIdx] = { ...btn, type: e.target.value };
                                                          newCards[cardIndex] = { ...card, buttons: newButtons };
                                                          return { ...b, cards: newCards };
                                                        }
                                                        return b;
                                                      });
                                                      setMessageBlocks(newBlocks);
                                                    }}
                                                    className="w-full px-3 py-2 bg-dark-700/80 border border-white/20 rounded-lg text-white text-sm"
                                                  >
                                                    <option value="REPLY">Resposta Rápida</option>
                                                    <option value="URL">Link (URL)</option>
                                                    <option value="CALL">Ligar</option>
                                                    <option value="COPY">Copiar Código</option>
                                                  </select>
                                                </div>

                                                <div>
                                                  <label className="block text-xs text-white/60 mb-1">Texto do Botão</label>
                                                  <input
                                                    type="text"
                                                    value={btn.text || ''}
                                                    onChange={(e) => {
                                                      const newBlocks = messageBlocks.map(b => {
                                                        if (b.id === block.id) {
                                                          const newCards = [...(b.cards || [])];
                                                          const newButtons = [...(card.buttons || [])];
                                                          newButtons[btnIdx] = { ...btn, text: e.target.value };
                                                          newCards[cardIndex] = { ...card, buttons: newButtons };
                                                          return { ...b, cards: newCards };
                                                        }
                                                        return b;
                                                      });
                                                      setMessageBlocks(newBlocks);
                                                    }}
                                                    placeholder="Digite o texto..."
                                                    className="w-full px-3 py-2 bg-dark-700/80 border border-white/20 rounded-lg text-white text-sm"
                                                  />
                                                </div>
                                              </div>

                                              {/* Campo condicional: URL */}
                                              {btn.type === 'URL' && (
                                                <div>
                                                  <label className="block text-xs font-bold mb-1 text-white/80">🔗 URL do Link</label>
                                                  <input
                                                    type="url"
                                                    className="w-full px-3 py-2 bg-dark-700 border border-white/20 rounded-lg text-white text-sm focus:border-purple-500"
                                                    placeholder="https://exemplo.com"
                                                    value={btn.url || ''}
                                                    onChange={(e) => {
                                                      const newBlocks = messageBlocks.map(b => {
                                                        if (b.id === block.id) {
                                                          const newCards = [...(b.cards || [])];
                                                          const newButtons = [...(card.buttons || [])];
                                                          newButtons[btnIdx] = { ...btn, url: e.target.value };
                                                          newCards[cardIndex] = { ...card, buttons: newButtons };
                                                          return { ...b, cards: newCards };
                                                        }
                                                        return b;
                                                      });
                                                      setMessageBlocks(newBlocks);
                                                    }}
                                                  />
                                                </div>
                                              )}

                                              {/* Campo condicional: Telefone */}
                                              {btn.type === 'CALL' && (
                                                <div>
                                                  <label className="block text-xs font-bold mb-1 text-white/80">📞 Número de Telefone</label>
                                                  <input
                                                    type="text"
                                                    className="w-full px-3 py-2 bg-dark-700 border border-white/20 rounded-lg text-white text-sm focus:border-purple-500"
                                                    placeholder="5562999999999"
                                                    value={btn.phone_number || ''}
                                                    onChange={(e) => {
                                                      const newBlocks = messageBlocks.map(b => {
                                                        if (b.id === block.id) {
                                                          const newCards = [...(b.cards || [])];
                                                          const newButtons = [...(card.buttons || [])];
                                                          newButtons[btnIdx] = { ...btn, phone_number: e.target.value.replace(/\D/g, '') };
                                                          newCards[cardIndex] = { ...card, buttons: newButtons };
                                                          return { ...b, cards: newCards };
                                                        }
                                                        return b;
                                                      });
                                                      setMessageBlocks(newBlocks);
                                                    }}
                                                  />
                                                </div>
                                              )}

                                              {/* Campo condicional: Código para copiar */}
                                              {btn.type === 'COPY' && (
                                                <div>
                                                  <label className="block text-xs font-bold mb-1 text-white/80">📋 Código para Copiar</label>
                                                  <input
                                                    type="text"
                                                    className="w-full px-3 py-2 bg-dark-700 border border-white/20 rounded-lg text-white text-sm focus:border-purple-500"
                                                    placeholder="CUPOM10"
                                                    value={btn.copy_code || ''}
                                                    onChange={(e) => {
                                                      const newBlocks = messageBlocks.map(b => {
                                                        if (b.id === block.id) {
                                                          const newCards = [...(b.cards || [])];
                                                          const newButtons = [...(card.buttons || [])];
                                                          newButtons[btnIdx] = { ...btn, copy_code: e.target.value };
                                                          newCards[cardIndex] = { ...card, buttons: newButtons };
                                                          return { ...b, cards: newCards };
                                                        }
                                                        return b;
                                                      });
                                                      setMessageBlocks(newBlocks);
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
                                            const newBlocks = messageBlocks.map(b => {
                                              if (b.id === block.id) {
                                                const newCards = [...(b.cards || [])];
                                                newCards[cardIndex] = {
                                                  ...card,
                                                  buttons: [...(card.buttons || []), { id: Date.now().toString(), text: '', type: 'REPLY' }]
                                                };
                                                return { ...b, cards: newCards };
                                              }
                                              return b;
                                            });
                                            setMessageBlocks(newBlocks);
                                          }}
                                          className="w-full mt-3 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border-2 border-blue-500/40 rounded-lg font-bold transition-all flex items-center justify-center gap-2"
                                        >
                                          <FaPlus /> Adicionar Botão
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ))}

                                {/* Botão Adicionar Card */}
                                {(block.cards || []).length < 10 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const newBlocks = messageBlocks.map(b => {
                                        if (b.id === block.id) {
                                          return {
                                            ...b,
                                            cards: [...(b.cards || []), {
                                              id: Date.now().toString(),
                                              text: '',
                                              image: '',
                                              buttons: [{ id: Date.now().toString(), text: '', type: 'REPLY' }]
                                            }]
                                          };
                                        }
                                        return b;
                                      });
                                      setMessageBlocks(newBlocks);
                                    }}
                                    className="w-full px-6 py-4 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border-2 border-purple-500/40 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                                  >
                                    <FaPlus /> Adicionar Card
                                  </button>
                                )}
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
                        {(['text', 'image', 'video', 'audio', 'document', 'button', 'list', 'poll', 'carousel'] as const).map((type) => (
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
          </div>
        )}
        
        {/* Texto simples */}
        {formData.type === 'text' && (
          <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-8">
            <h2 className="text-3xl font-bold text-white mb-6">✉️ Conteúdo da Mensagem - Texto</h2>
            
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-lg font-bold text-white">💬 Texto Principal</label>
                <EmojiPickerButton 
                  onEmojiSelect={(emoji) => setFormData({ ...formData, text_content: formData.text_content + emoji })}
                  buttonClassName="px-4 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white rounded-lg transition-all flex items-center gap-2 font-bold shadow-lg"
                />
              </div>
              <textarea
                value={formData.text_content}
                onChange={(e) => setFormData({ ...formData, text_content: e.target.value })}
                placeholder="Digite o texto da mensagem... Use {{variavel}} para campos dinâmicos"
                rows={4}
                className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-blue-500 transition-all resize-none"
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
                    {detectedVariables.map((variable, idx) => {
                      const { system, custom } = categorizeVariables([variable]);
                      const isSystem = system.length > 0;
                      
                      return (
                        <span
                          key={`var-text-${variable}-${idx}`}
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
          </div>
        )}

        {/* LISTA */}
        {formData.type === 'list' && (
          <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-8">
            <h2 className="text-3xl font-bold text-white mb-6">📋 Conteúdo da Mensagem - Lista</h2>
            
            {/* Texto Principal */}
            <div className="mb-6">
              <label className="block text-lg font-bold mb-3 text-white">💬 Texto Principal</label>
              <textarea
                value={formData.text_content}
                onChange={(e) => setFormData({ ...formData, text_content: e.target.value })}
                placeholder="Digite o texto da mensagem... Use {{variavel}} para campos dinâmicos"
                rows={4}
                className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-blue-500 transition-all resize-none"
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
                    {detectedVariables.map((variable, idx) => {
                      const { system, custom } = categorizeVariables([variable]);
                      const isSystem = system.length > 0;
                      
                      return (
                        <span
                          key={`var-list-${variable}-${idx}`}
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

            {/* Imagem de Header (Opcional) */}
            <div className="mb-6">
              <label className="block text-white font-bold mb-2">🖼️ Imagem de Cabeçalho (Opcional)</label>
              {uploadedMedia ? (
                <div className="bg-dark-700 border-2 border-green-500/30 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-green-300 text-sm">✅ Imagem configurada</span>
                    <button
                      onClick={() => setUploadedMedia(null)}
                      className="bg-red-500 hover:bg-red-600 px-3 py-1 rounded-lg text-white text-sm font-bold"
                    >
                      Remover
                    </button>
                  </div>
                  {uploadedMedia.url && (
                    <img src={uploadedMedia.url} alt="Preview" className="w-full max-h-40 object-contain rounded-lg" />
                  )}
                </div>
              ) : (
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleMediaUpload}
                    className="hidden"
                    id="list-header-image"
                  />
                  <label
                    htmlFor="list-header-image"
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-xl text-white font-bold cursor-pointer transition-all"
                  >
                    <FaUpload /> Fazer Upload de Imagem
                  </label>
                </div>
              )}
            </div>

            {/* Rodapé (Opcional) */}
            <div className="mb-6">
              <label className="block text-lg font-bold mb-3 text-white">
                👣 Texto do Rodapé (Opcional)
              </label>
              <input
                type="text"
                value={listConfig.footerText || ''}
                onChange={(e) => setListConfig({...listConfig, footerText: e.target.value})}
                placeholder="Ex: Escolha uma opção"
                className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-blue-500 transition-all"
              />
            </div>

            {/* Texto do Botão */}
            <div className="mb-6">
              <label className="block text-lg font-bold mb-3 text-white">
                🔘 Texto do Botão da Lista
              </label>
              <input
                type="text"
                value={listConfig.buttonText}
                onChange={(e) => setListConfig({...listConfig, buttonText: e.target.value})}
                placeholder="Ex: Ver Opções, Ver Catálogo..."
                className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-blue-500 transition-all"
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
          </div>
        )}

        {/* BOTÕES */}
        {formData.type === 'buttons' && (
          <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-8">
            <h2 className="text-3xl font-bold text-white mb-6">🔘 Conteúdo da Mensagem - Botões</h2>
            
            {/* Texto Principal */}
            <div className="mb-6">
              <label className="block text-lg font-bold mb-3 text-white">💬 Texto Principal</label>
              <textarea
                value={formData.text_content}
                onChange={(e) => setFormData({ ...formData, text_content: e.target.value })}
                placeholder="Digite o texto da mensagem... Use {{variavel}} para campos dinâmicos"
                rows={4}
                className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-blue-500 transition-all resize-none"
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
                    {detectedVariables.map((variable, idx) => {
                      const { system, custom } = categorizeVariables([variable]);
                      const isSystem = system.length > 0;
                      
                      return (
                        <span
                          key={`var-buttons-${variable}-${idx}`}
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

            {/* Rodapé (Opcional) */}
            <div className="mb-6">
              <label className="block text-lg font-bold mb-3 text-white">
                👣 Texto do Rodapé (Opcional)
              </label>
              <input
                type="text"
                value={buttonsConfig.footerText || ''}
                onChange={(e) => setButtonsConfig({...buttonsConfig, footerText: e.target.value})}
                placeholder="Ex: Escolha uma das opções abaixo"
                className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-blue-500 transition-all"
              />
            </div>

            {/* Botões */}
            <div>
              <label className="block text-lg font-bold mb-3 text-white">
                🔘 Botões ({buttonsConfig.buttons.length}/3)
              </label>

              <div className="space-y-4">
                {buttonsConfig.buttons.map((button, index) => (
                  <div key={button.id} className="bg-dark-700/50 border-2 border-white/10 rounded-xl p-6 space-y-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-white">Botão #{index + 1}</h3>
                      {buttonsConfig.buttons.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const newButtons = buttonsConfig.buttons.filter((_, i) => i !== index);
                            setButtonsConfig({...buttonsConfig, buttons: newButtons});
                          }}
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
                          value={button.type || 'REPLY'}
                          onChange={(e) => {
                            const newButtons = [...buttonsConfig.buttons];
                            newButtons[index] = { ...button, type: e.target.value };
                            setButtonsConfig({...buttonsConfig, buttons: newButtons});
                          }}
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
                          onChange={(e) => {
                            const newButtons = [...buttonsConfig.buttons];
                            newButtons[index] = { ...button, text: e.target.value };
                            setButtonsConfig({...buttonsConfig, buttons: newButtons});
                          }}
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
                          onChange={(e) => {
                            const newButtons = [...buttonsConfig.buttons];
                            newButtons[index] = { ...button, url: e.target.value };
                            setButtonsConfig({...buttonsConfig, buttons: newButtons});
                          }}
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
                          onChange={(e) => {
                            const newButtons = [...buttonsConfig.buttons];
                            newButtons[index] = { ...button, phone_number: e.target.value };
                            setButtonsConfig({...buttonsConfig, buttons: newButtons});
                          }}
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
                          onChange={(e) => {
                            const newButtons = [...buttonsConfig.buttons];
                            newButtons[index] = { ...button, copy_code: e.target.value };
                            setButtonsConfig({...buttonsConfig, buttons: newButtons});
                          }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Botão Adicionar - SEMPRE EMBAIXO */}
              {buttonsConfig.buttons.length < 3 && (
                <button
                  type="button"
                  onClick={() => {
                    setButtonsConfig({
                      ...buttonsConfig,
                      buttons: [...buttonsConfig.buttons, { id: `btn${Date.now()}`, text: '', type: 'REPLY' }]
                    });
                  }}
                  className="w-full px-6 py-4 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border-2 border-blue-500/40 rounded-xl font-bold transition-all flex items-center justify-center gap-2 mt-4"
                >
                  <FaPlus /> Adicionar Botão
                </button>
              )}
            </div>
          </div>
        )}

        {/* CARROSSEL */}
        {formData.type === 'carousel' && (
          <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-8">
            <h2 className="text-3xl font-bold text-white mb-6">🎠 Conteúdo da Mensagem - Carrossel</h2>
            
            {/* Texto Principal */}
            <div className="mb-6">
              <label className="block text-lg font-bold mb-3 text-white">💬 Texto Principal</label>
              <textarea
                value={formData.text_content}
                onChange={(e) => setFormData({ ...formData, text_content: e.target.value })}
                placeholder="Digite o texto da mensagem... Use {{variavel}} para campos dinâmicos"
                rows={4}
                className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-blue-500 transition-all resize-none"
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
                    {detectedVariables.map((variable, idx) => {
                      const { system, custom } = categorizeVariables([variable]);
                      const isSystem = system.length > 0;
                      
                      return (
                        <span
                          key={`var-carousel-${variable}-${idx}`}
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

            {/* Cards do Carrossel */}
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-white">🎴 Cards do Carrossel ({carouselCards.length})</h3>

              {carouselCards.map((card, cardIndex) => (
                <div key={card.id} className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-2 border-purple-500/40 rounded-2xl p-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <h4 className="text-lg font-bold text-white">Card #{cardIndex + 1}</h4>
                    {carouselCards.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setCarouselCards(carouselCards.filter((_, i) => i !== cardIndex))}
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
                      rows={3}
                      className="w-full px-4 py-3 bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-purple-500 transition-all resize-none"
                      placeholder="Digite o texto deste card..."
                      value={card.text}
                      onChange={(e) => {
                        const newCards = [...carouselCards];
                        newCards[cardIndex].text = e.target.value;
                        setCarouselCards(newCards);
                      }}
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
                            if (file) handleCarouselImageUpload(cardIndex, file);
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
                              const newCards = [...carouselCards];
                              newCards[cardIndex].image = null;
                              newCards[cardIndex].uploadedImage = null;
                              setCarouselCards(newCards);
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
                                onClick={() => {
                                  const newCards = [...carouselCards];
                                  newCards[cardIndex].buttons = newCards[cardIndex].buttons.filter((_, i) => i !== buttonIndex);
                                  setCarouselCards(newCards);
                                }}
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
                                  className="w-full px-3 py-2 bg-dark-700 border border-white/20 rounded-lg text-white text-sm focus:border-purple-500"
                                  value={button.type || 'REPLY'}
                                  onChange={(e) => {
                                    const newCards = [...carouselCards];
                                    newCards[cardIndex].buttons[buttonIndex] = { ...button, type: e.target.value };
                                    setCarouselCards(newCards);
                                  }}
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
                                  placeholder="Ex: Ver mais"
                                  className="w-full px-3 py-2 bg-dark-700 border border-white/20 rounded-lg text-white text-sm focus:border-purple-500"
                                  value={button.text}
                                  onChange={(e) => {
                                    const newCards = [...carouselCards];
                                    newCards[cardIndex].buttons[buttonIndex] = { ...button, text: e.target.value };
                                    setCarouselCards(newCards);
                                  }}
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
                                  placeholder="https://exemplo.com"
                                  className="w-full px-3 py-2 bg-dark-700 border border-white/20 rounded-lg text-white text-sm focus:border-purple-500"
                                  value={button.url || ''}
                                  onChange={(e) => {
                                    const newCards = [...carouselCards];
                                    newCards[cardIndex].buttons[buttonIndex] = { ...button, url: e.target.value };
                                    setCarouselCards(newCards);
                                  }}
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
                                  placeholder="5562999999999"
                                  className="w-full px-3 py-2 bg-dark-700 border border-white/20 rounded-lg text-white text-sm focus:border-purple-500"
                                  value={button.phone_number || ''}
                                  onChange={(e) => {
                                    const newCards = [...carouselCards];
                                    newCards[cardIndex].buttons[buttonIndex] = { ...button, phone_number: e.target.value.replace(/\D/g, '') };
                                    setCarouselCards(newCards);
                                  }}
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
                                  placeholder="CUPOM10"
                                  className="w-full px-3 py-2 bg-dark-700 border border-white/20 rounded-lg text-white text-sm focus:border-purple-500"
                                  value={button.copy_code || ''}
                                  onChange={(e) => {
                                    const newCards = [...carouselCards];
                                    newCards[cardIndex].buttons[buttonIndex] = { ...button, copy_code: e.target.value };
                                    setCarouselCards(newCards);
                                  }}
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
                        onClick={() => {
                          const newCards = [...carouselCards];
                          newCards[cardIndex].buttons.push({ id: `btn${Date.now()}`, text: '', type: 'REPLY' });
                          setCarouselCards(newCards);
                        }}
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
                onClick={() => {
                  setCarouselCards([...carouselCards, { id: `card${Date.now()}`, text: '', image: null, buttons: [], uploadingImage: false }]);
                }}
                className="w-full px-6 py-4 bg-purple-500 hover:bg-purple-600 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-500/30"
              >
                <FaPlus /> Adicionar Card
              </button>
            </div>
          </div>
        )}

        {/* ENQUETE (POLL) */}
        {formData.type === 'poll' && (
          <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-8">
            <h2 className="text-3xl font-bold text-white mb-6">📊 Conteúdo da Mensagem - Enquete</h2>
            
            {/* Texto Principal */}
            <div className="mb-6">
              <label className="block text-lg font-bold mb-3 text-white">💬 Texto Principal</label>
              <textarea
                value={formData.text_content}
                onChange={(e) => setFormData({ ...formData, text_content: e.target.value })}
                placeholder="Digite o texto da mensagem... Use {{variavel}} para campos dinâmicos"
                rows={4}
                className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-blue-500 transition-all resize-none"
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
                    {detectedVariables.map((variable, idx) => {
                      const { system, custom } = categorizeVariables([variable]);
                      const isSystem = system.length > 0;
                      
                      return (
                        <span
                          key={`var-poll-${variable}-${idx}`}
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

            {/* Número de Opções Selecionáveis */}
            <div className="mb-6">
              <label className="block text-lg font-bold mb-3 text-white">
                🔢 Número de Opções Selecionáveis
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={pollConfig.selectableCount}
                onChange={(e) => setPollConfig({...pollConfig, selectableCount: parseInt(e.target.value) || 1})}
                className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-blue-500 transition-all"
              />
            </div>

            {/* Opções da Enquete */}
            <div>
              <label className="block text-lg font-bold mb-3 text-white">
                📊 Opções da Enquete ({pollConfig.options.length})
              </label>
              
              <div className="space-y-3">
                {pollConfig.options.map((option, index) => (
                  <div key={`poll-option-${index}-${option}`} className="flex items-center gap-3">
                    <div className="flex-1">
                      <input
                        type="text"
                        value={option}
                        onChange={(e) => {
                          const newOptions = [...pollConfig.options];
                          newOptions[index] = e.target.value;
                          setPollConfig({...pollConfig, options: newOptions});
                        }}
                        placeholder={`Opção ${index + 1}`}
                        className="w-full px-4 py-3 bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-blue-500 transition-all"
                      />
                    </div>
                    {pollConfig.options.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const newOptions = pollConfig.options.filter((_, i) => i !== index);
                          setPollConfig({...pollConfig, options: newOptions});
                        }}
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
                onClick={() => setPollConfig({
                  ...pollConfig,
                  options: [...pollConfig.options, `Opção ${pollConfig.options.length + 1}`]
                })}
                className="w-full px-6 py-4 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 mt-4"
              >
                <FaPlus /> Adicionar Opção
              </button>
            </div>
          </div>
        )}

        {/* MÍDIAS (IMAGE, VIDEO, AUDIO, DOCUMENT) */}
        {['image', 'video', 'audio', 'audio_recorded', 'document'].includes(formData.type) && (
          <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-8">
            <h2 className="text-3xl font-bold text-white mb-6">
              {formData.type === 'image' && '🖼️ Conteúdo da Mensagem - Imagem'}
              {formData.type === 'video' && '🎥 Conteúdo da Mensagem - Vídeo'}
              {formData.type === 'audio' && '🎵 Conteúdo da Mensagem - Áudio'}
              {formData.type === 'audio_recorded' && '🎤 Conteúdo da Mensagem - Áudio Gravado'}
              {formData.type === 'document' && '📄 Conteúdo da Mensagem - Documento'}
            </h2>

            {/* Legenda/Texto */}
            <div className="mb-6">
              <label className="block text-lg font-bold mb-3 text-white">
                💬 Legenda (Opcional)
              </label>
              <textarea
                value={formData.text_content}
                onChange={(e) => setFormData({ ...formData, text_content: e.target.value })}
                placeholder="Digite uma legenda ou descrição..."
                rows={4}
                className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-blue-500 transition-all resize-none"
              />
            </div>

            {/* Upload de novo arquivo */}
            <div className="mb-6">
              <label className="block text-white font-bold mb-2">📎 Arquivo de Mídia</label>
              
              {!uploadedMedia ? (
                <div>
                  <input
                    type="file"
                    accept={
                      formData.type === 'image' ? 'image/*' :
                      formData.type === 'video' ? 'video/*' :
                      formData.type === 'audio' || formData.type === 'audio_recorded' ? 'audio/*' :
                      formData.type === 'document' ? '.pdf,.doc,.docx,.xls,.xlsx,.txt' : '*'
                    }
                    onChange={handleMediaUpload}
                    className="hidden"
                    id="media-upload-edit"
                    disabled={uploadingMedia}
                  />
                  <label
                    htmlFor="media-upload-edit"
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
                        <FaUpload className="text-5xl text-blue-400" />
                        <p className="text-white text-lg font-bold">
                          Clique para selecionar novo arquivo
                        </p>
                        <p className="text-white/60 text-sm">
                          📷 Imagem · 🎥 Vídeo · 🎵 Áudio · 📄 PDF (Máx: 16MB)
                        </p>
                      </div>
                    )}
                  </label>
                  {existingMediaFiles.length > 0 && (
                    <p className="text-white/50 text-sm mt-2">
                      💡 Ao fazer upload de um novo arquivo, o arquivo anterior será substituído ao salvar.
                    </p>
                  )}
                </div>
              ) : (
                <div className="bg-dark-700/80 border-2 border-green-500/40 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {(() => {
                        // ✅ FIX: Detectar tipo de arquivo por MIME type OU extensão
                        const filename = uploadedMedia.filename || uploadedMedia.originalname || uploadedMedia.original_name || uploadedMedia.url || '';
                        const isImage = uploadedMedia.mime_type?.startsWith('image/') || 
                                      /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(filename) ||
                                      formData.type === 'image';
                        const isVideo = uploadedMedia.mime_type?.startsWith('video/') || 
                                      /\.(mp4|avi|mov|wmv|flv|webm)$/i.test(filename) ||
                                      formData.type === 'video';
                        const isAudio = uploadedMedia.mime_type?.startsWith('audio/') || 
                                      /\.(mp3|wav|ogg|m4a|aac)$/i.test(filename) ||
                                      formData.type === 'audio' || formData.type === 'audio_recorded';
                        
                        if (isImage) return <FaImage className="text-3xl text-blue-400" />;
                        if (isVideo) return <FaVideo className="text-3xl text-purple-400" />;
                        if (isAudio) return <FaMusic className="text-3xl text-green-400" />;
                        return <FaFile className="text-3xl text-gray-400" />;
                      })()}
                      <div>
                        <p className="font-bold text-white">{uploadedMedia.original_name || uploadedMedia.originalName}</p>
                        <p className="text-sm text-white/60">
                          {uploadedMedia.size ? (uploadedMedia.size / 1024 / 1024).toFixed(2) : '?'} MB
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setUploadedMedia(null)}
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
                    
                    // Considerar imagem se: 1) MIME type é image/* OU 2) Extensão é de imagem OU 3) Tipo do template é image
                    const isImage = isImageByMime || isImageByExtension || isImageType;
                    const hasUrl = !!uploadedMedia.url;
                    
                    console.log('🖼️ [PREVIEW] Verificando se mostra prévia:', {
                      isImageByMime,
                      isImageByExtension,
                      isImageType,
                      isImage,
                      hasUrl,
                      mime_type: uploadedMedia.mime_type,
                      filename,
                      url: uploadedMedia.url
                    });
                    
                    return isImage && hasUrl ? (
                      <div className="mt-4 bg-dark-700/50 rounded-xl p-4">
                        <p className="text-center text-blue-300 font-bold mb-2">🖼️ Preview da Imagem</p>
                        <img
                          src={uploadedMedia.url.startsWith('http') ? uploadedMedia.url : `${API_BASE_URL}${uploadedMedia.url}`}
                          alt="Preview"
                          className="max-w-full h-auto max-h-96 rounded-lg mx-auto object-contain"
                          onError={(e) => {
                            console.error('❌ Erro ao carregar imagem:', uploadedMedia.url);
                            console.log('   Tentando URL completa:', uploadedMedia.url.startsWith('http') ? uploadedMedia.url : `${API_BASE_URL}${uploadedMedia.url}`);
                          }}
                          onLoad={() => {
                            console.log('✅ Imagem carregada com sucesso!');
                          }}
                        />
                      </div>
                    ) : null;
                  })()}

                  {/* PLAYER DE VÍDEO */}
                  {(() => {
                    // ✅ FIX: Detectar vídeo por MIME type OU por extensão do arquivo
                    const filename = uploadedMedia.filename || uploadedMedia.originalname || uploadedMedia.original_name || uploadedMedia.url || '';
                    const isVideoByMime = uploadedMedia.mime_type?.startsWith('video/');
                    const isVideoByExtension = /\.(mp4|avi|mov|wmv|flv|webm|mkv|m4v)$/i.test(filename);
                    const isVideoType = formData.type === 'video';
                    const isVideo = isVideoByMime || isVideoByExtension || isVideoType;
                    const hasUrl = !!uploadedMedia.url;
                    
                    console.log('🎥 [PREVIEW] Verificando se mostra preview de vídeo:', {
                      isVideoByMime,
                      isVideoByExtension,
                      isVideoType,
                      isVideo,
                      hasUrl,
                      mime_type: uploadedMedia.mime_type,
                      filename,
                      url: uploadedMedia.url
                    });
                    
                    return isVideo && hasUrl ? (
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
                    const filename = uploadedMedia.filename || uploadedMedia.originalname || uploadedMedia.original_name || uploadedMedia.url || '';
                    const isAudioByMime = uploadedMedia.mime_type?.startsWith('audio/');
                    const isAudioByExtension = /\.(mp3|wav|ogg|m4a|aac|opus|flac)$/i.test(filename);
                    const isAudioType = formData.type === 'audio' || formData.type === 'audio_recorded';
                    const isAudio = isAudioByMime || isAudioByExtension || isAudioType;
                    const hasUrl = !!uploadedMedia.url;
                    
                    console.log('🎵 [PREVIEW] Verificando se mostra preview de áudio:', {
                      isAudioByMime,
                      isAudioByExtension,
                      isAudioType,
                      isAudio,
                      hasUrl,
                      mime_type: uploadedMedia.mime_type,
                      filename,
                      url: uploadedMedia.url
                    });
                    
                    return isAudio && hasUrl ? (
                      <div className="mt-4 bg-dark-700/50 rounded-xl p-5 space-y-4">
                        <p className="text-center text-green-300 font-bold mb-3">🎵 Ouça o áudio antes de salvar</p>
                        
                        {/* Botão Play/Pause */}
                        <div className="flex justify-center">
                          <button
                            type="button"
                            onClick={toggleMediaPlayPause}
                            className="w-20 h-20 bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-full flex items-center justify-center shadow-xl shadow-green-500/50 transition-all transform hover:scale-105"
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
                          className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer"
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
          </div>
        )}

        {/* BOTÃO SALVAR (no final) */}
        <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-blue-500/40 rounded-2xl p-8 text-center">
          <button
            onClick={handleUpdate}
            disabled={saving}
            className="flex items-center justify-center gap-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 disabled:from-gray-500 disabled:to-gray-600 px-12 py-5 rounded-xl text-white text-2xl font-bold transition-all duration-200 shadow-lg mx-auto"
          >
            <FaSave className="text-3xl" />
            {saving ? 'Salvando Alterações...' : 'Salvar Alterações'}
          </button>
        </div>
      </div>

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


