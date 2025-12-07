import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { FaComments, FaSearch, FaPaperPlane, FaPaperclip, FaSmile, FaArrowLeft, FaCheck, FaCheckDouble, FaCircle, FaTimes, FaArchive, FaInbox, FaBullhorn, FaClock, FaHeadset, FaHandPaper, FaSync, FaCalendarAlt, FaLayerGroup, FaPlug, FaTags, FaReply, FaTrello, FaHome, FaMicrophone, FaStop, FaImage, FaFile, FaDownload, FaExpand, FaPlay, FaFileAlt, FaTrash, FaCheckSquare, FaSquare } from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

// Definição das abas do sistema de atendimento
const CHAT_TABS = [
  { id: 'chat', label: 'Chat', icon: FaComments, active: true },
  { id: 'agenda', label: 'Agenda', icon: FaCalendarAlt, active: false },
  { id: 'fila', label: 'Fila', icon: FaLayerGroup, active: false },
  { id: 'conexao', label: 'Conexão', icon: FaPlug, active: false },
  { id: 'etiquetas', label: 'Etiquetas', icon: FaTags, active: false },
  { id: 'resposta-rapida', label: 'Resposta Rápida', icon: FaReply, active: false },
  { id: 'kanban', label: 'Kanban', icon: FaTrello, active: false },
];

interface Conversation {
  id: number;
  phone_number: string;
  contact_name: string | null;
  last_message_at: string | null;
  last_message_text: string | null;
  last_message_direction: 'inbound' | 'outbound' | null;
  unread_count: number;
  is_archived: boolean;
  status: 'open' | 'pending' | 'archived' | 'broadcast';
  attended_by_user_id: number | null;
  attended_by_user_name: string | null;
  whatsapp_account_name: string | null;
  instance_name: string | null;
}

interface StatusCounts {
  open: number;
  pending: number;
  archived: number;
  broadcast: number;
}

interface Message {
  id: number;
  conversation_id: number;
  message_direction: 'inbound' | 'outbound';
  message_type: string;
  message_content: string | null;
  media_url: string | null;
  media_caption: string | null;
  media_type: string | null;
  button_text: string | null;
  button_payload: string | null;
  status: string | null;
  sent_at: string;
  delivered_at: string | null;
  read_at: string | null;
  sent_by_user_name: string | null;
  is_read_by_agent: boolean;
}

// Componente para renderizar mensagem baseado no tipo
const MessageContent = ({ msg, onImageClick }: { msg: Message; onImageClick?: (url: string) => void }) => {
  const messageType = msg.message_type?.toLowerCase() || 'text';
  
  // Clique em botão
  if (messageType === 'button' || messageType === 'button_reply' || messageType === 'interactive') {
    return (
      <div className="flex items-center gap-2">
        <div className="bg-white/20 p-2 rounded-lg">
          <span className="text-2xl">👆</span>
        </div>
        <div>
          <p className="text-xs opacity-70 mb-1">Clicou no botão:</p>
          <p className="text-base font-semibold bg-white/10 px-3 py-1 rounded-lg">
            {msg.button_text || msg.message_content || '[Botão]'}
          </p>
        </div>
      </div>
    );
  }
  
  // Lista selecionada
  if (messageType === 'list' || messageType === 'list_reply') {
    return (
      <div className="flex items-center gap-2">
        <div className="bg-white/20 p-2 rounded-lg">
          <span className="text-2xl">📋</span>
        </div>
        <div>
          <p className="text-xs opacity-70 mb-1">Selecionou da lista:</p>
          <p className="text-base font-semibold bg-white/10 px-3 py-1 rounded-lg">
            {msg.button_text || msg.message_content || '[Item da lista]'}
          </p>
        </div>
      </div>
    );
  }
  
  // Imagem
  if (messageType === 'image' || messageType === 'imagemessage') {
    // Construir URL completa da mídia
    let mediaUrl = msg.media_url;
    if (mediaUrl && !mediaUrl.startsWith('http')) {
      // Se não começar com http, é um caminho relativo - adicionar o domínio da API
      const apiDomain = 'https://api.sistemasnettsistemas.com.br';
      mediaUrl = `${apiDomain}${mediaUrl}`;
    }
    console.log('🖼️ URL da imagem construída:', mediaUrl);
    
    return (
      <div>
        {mediaUrl ? (
          <div className="space-y-2">
            <div className="relative group">
              <img 
                src={mediaUrl} 
                alt="Imagem" 
                className="max-w-full rounded-lg cursor-pointer"
                style={{ maxHeight: '400px', width: 'auto' }}
                onError={(e) => {
                  console.error('❌ Erro ao carregar imagem:', mediaUrl);
                  (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><text x="50%" y="50%" text-anchor="middle" fill="gray">Erro ao carregar</text></svg>';
                }}
              />
              {/* Botões sobre a imagem */}
              <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => {
                    if (onImageClick) {
                      onImageClick(mediaUrl!);
                    }
                  }}
                  className="bg-black/70 hover:bg-black/90 text-white p-2 rounded-lg transition-all"
                  title="Ampliar"
                >
                  <FaExpand />
                </button>
                <a
                  href={mediaUrl}
                  download
                  onClick={(e) => {
                    e.preventDefault();
                    fetch(mediaUrl!)
                      .then(res => res.blob())
                      .then(blob => {
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `imagem_${Date.now()}.jpg`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        window.URL.revokeObjectURL(url);
                      });
                  }}
                  className="bg-black/70 hover:bg-black/90 text-white p-2 rounded-lg transition-all"
                  title="Baixar"
                >
                  <FaDownload />
                </a>
              </div>
            </div>
            {(msg.media_caption || msg.message_content) && msg.message_content !== '📷 [Imagem]' && (
              <p className="text-base mt-2">{msg.media_caption || msg.message_content}</p>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-3xl">🖼️</span>
            <span className="text-base">{msg.message_content || '[Imagem]'}</span>
          </div>
        )}
      </div>
    );
  }
  
  // Vídeo
  if (messageType === 'video' || messageType === 'videomessage') {
    let mediaUrl = msg.media_url;
    if (mediaUrl && !mediaUrl.startsWith('http')) {
      const apiDomain = 'https://api.sistemasnettsistemas.com.br';
      mediaUrl = `${apiDomain}${mediaUrl}`;
    }
    console.log('🎥 URL do vídeo construída:', mediaUrl);
    
    return (
      <div>
        {mediaUrl ? (
          <div className="space-y-2">
            <div className="relative group">
              <video 
                src={mediaUrl} 
                controls
                className="max-w-full rounded-lg bg-black"
                style={{ maxHeight: '400px' }}
              />
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <a
                  href={mediaUrl}
                  download
                  onClick={(e) => {
                    e.preventDefault();
                    fetch(mediaUrl!)
                      .then(res => res.blob())
                      .then(blob => {
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `video_${Date.now()}.mp4`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        window.URL.revokeObjectURL(url);
                      });
                  }}
                  className="bg-black/70 hover:bg-black/90 text-white p-2 rounded-lg transition-all inline-block"
                  title="Baixar"
                >
                  <FaDownload />
                </a>
              </div>
            </div>
            {(msg.media_caption || msg.message_content) && msg.message_content !== '🎥 [Vídeo]' && (
              <p className="text-base mt-2">{msg.media_caption || msg.message_content}</p>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-3xl">🎥</span>
            <span className="text-base">{msg.message_content || '[Vídeo]'}</span>
          </div>
        )}
      </div>
    );
  }
  
  // Áudio
  if (messageType === 'audio' || messageType === 'audiomessage' || messageType === 'ptt' || messageType === 'voice') {
    let mediaUrl = msg.media_url;
    if (mediaUrl && !mediaUrl.startsWith('http')) {
      const apiDomain = 'https://api.sistemasnettsistemas.com.br';
      mediaUrl = `${apiDomain}${mediaUrl}`;
    }
    console.log('🎤 URL do áudio construída:', mediaUrl);
    
    return (
      <div className="flex items-center gap-3">
        {mediaUrl ? (
          <div className="flex items-center gap-2 bg-white/10 px-4 py-3 rounded-xl">
            <FaPlay className="text-emerald-400" />
            <audio src={mediaUrl} controls className="max-w-[300px]" />
            <button
              onClick={(e) => {
                e.preventDefault();
                fetch(mediaUrl!)
                  .then(res => res.blob())
                  .then(blob => {
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `audio_${Date.now()}.ogg`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                  });
              }}
              className="ml-2 bg-white/20 hover:bg-white/30 p-2 rounded-lg transition-all cursor-pointer"
              title="Baixar áudio"
            >
              <FaDownload />
            </button>
          </div>
        ) : (
          <>
            <div className="bg-white/20 p-3 rounded-full">
              <span className="text-2xl">🎵</span>
            </div>
            <span className="text-base">{msg.message_content || '[Áudio]'}</span>
          </>
        )}
      </div>
    );
  }
  
  // Documento
  if (messageType === 'document' || messageType === 'documentmessage') {
    let mediaUrl = msg.media_url;
    if (mediaUrl && !mediaUrl.startsWith('http')) {
      const apiDomain = 'https://api.sistemasnettsistemas.com.br';
      mediaUrl = `${apiDomain}${mediaUrl}`;
    }
    console.log('📄 URL do documento construída:', mediaUrl);
    const isPdf = msg.media_type?.includes('pdf') || msg.message_content?.toLowerCase().includes('.pdf');
    
    return (
      <div>
        {mediaUrl ? (
          <div className="bg-white/10 p-4 rounded-xl flex items-center gap-4">
            <div className="bg-blue-500/20 p-3 rounded-lg">
              <FaFileAlt className="text-3xl text-blue-400" />
            </div>
            <div className="flex-1">
              <p className="text-base font-semibold">{msg.message_content || 'Documento'}</p>
              <p className="text-sm opacity-70">{msg.media_type || 'Arquivo'}</p>
            </div>
            <div className="flex gap-2">
              {isPdf && (
                <button
                  onClick={() => window.open(mediaUrl, '_blank')}
                  className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 px-4 py-2 rounded-lg transition-all flex items-center gap-2"
                  title="Visualizar PDF"
                >
                  <FaExpand /> Ver
                </button>
              )}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  fetch(mediaUrl!)
                    .then(res => res.blob())
                    .then(blob => {
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = msg.message_content || `documento_${Date.now()}.pdf`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      window.URL.revokeObjectURL(url);
                    });
                }}
                className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 px-4 py-2 rounded-lg transition-all flex items-center gap-2 cursor-pointer"
                title="Baixar documento"
              >
                <FaDownload /> Baixar
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-3xl">📄</span>
            <span className="text-base">{msg.message_content || '[Documento]'}</span>
          </div>
        )}
      </div>
    );
  }
  
  // Sticker
  if (messageType === 'sticker' || messageType === 'stickermessage') {
    return (
      <div>
        {msg.media_url ? (
          <img 
            src={msg.media_url} 
            alt="Sticker" 
            className="max-w-[150px]"
          />
        ) : (
          <div className="text-5xl">🎭</div>
        )}
      </div>
    );
  }
  
  // Localização
  if (messageType === 'location' || messageType === 'locationmessage') {
    return (
      <div className="flex items-center gap-2">
        <span className="text-3xl">📍</span>
        <div>
          <p className="text-base font-medium">Localização compartilhada</p>
          <p className="text-sm opacity-70">{msg.message_content}</p>
        </div>
      </div>
    );
  }
  
  // Contato
  if (messageType === 'contact' || messageType === 'contactmessage' || messageType === 'vcard') {
    return (
      <div className="flex items-center gap-2">
        <span className="text-3xl">👤</span>
        <div>
          <p className="text-base font-medium">Contato compartilhado</p>
          <p className="text-sm opacity-70">{msg.message_content}</p>
        </div>
      </div>
    );
  }
  
  // Texto padrão
  return (
    <p className="text-base leading-relaxed whitespace-pre-wrap break-words">
      {msg.message_content || '[Mensagem]'}
    </p>
  );
};

export default function Chat() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  
  // Estados
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'open' | 'pending' | 'archived' | 'broadcast'>('open');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [statusCounts, setStatusCounts] = useState<StatusCounts>({ open: 0, pending: 0, archived: 0, broadcast: 0 });
  const [chatDisabled, setChatDisabled] = useState(false);
  const [chatDisabledMessage, setChatDisabledMessage] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState('chat');
  
  // Estados para funcionalidades extras
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [imageModalSrc, setImageModalSrc] = useState('');
  
  // Estados para seleção múltipla
  const [selectedConversationIds, setSelectedConversationIds] = useState<number[]>([]);
  const [selectMode, setSelectMode] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Redirecionar se não autenticado
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  // Função de atualização manual
  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        loadConversations(),
        loadUnreadCount(),
        loadStatusCounts()
      ]);
      if (selectedConversation) {
        await loadMessages(selectedConversation.id);
      }
      setLastUpdate(new Date());
    } finally {
      setRefreshing(false);
    }
  }, [selectedConversation]);

  // Carregar conversas
  useEffect(() => {
    loadConversations();
    loadUnreadCount();
    loadStatusCounts();
    setLastUpdate(new Date());
    
    // Atualizar a cada 5 segundos (se auto-refresh ativado)
    const interval = setInterval(() => {
      if (autoRefresh) {
        loadConversations();
        loadUnreadCount();
        loadStatusCounts();
        if (selectedConversation) {
          loadMessages(selectedConversation.id);
        }
        setLastUpdate(new Date());
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [filter, searchTerm, autoRefresh]);

  // Carregar mensagens quando selecionar conversa
  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation.id);
      markAsRead(selectedConversation.id);
    }
  }, [selectedConversation]);

  // Scroll automático para última mensagem
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConversations = async () => {
    try {
      const response = await api.get('/conversations', {
        params: { filter, search: searchTerm, limit: 100 }
      });
      setConversations(response.data.data || []);
      setLoading(false);
      setChatDisabled(false);
    } catch (error: any) {
      console.error('Erro ao carregar conversas:', error);
      
      // Verificar se é erro de permissão
      if (error.response?.status === 403) {
        setChatDisabled(true);
        const errorCode = error.response?.data?.code;
        
        if (errorCode === 'CHAT_DISABLED') {
          setChatDisabledMessage('O Chat de Atendimento não está habilitado para sua conta. Entre em contato com o suporte.');
        } else if (errorCode === 'CHAT_NOT_IN_PLAN') {
          setChatDisabledMessage('O Chat de Atendimento não está disponível no seu plano atual. Faça upgrade para desbloquear esta funcionalidade.');
        } else {
          setChatDisabledMessage(error.response?.data?.error || 'Você não tem permissão para acessar o Chat de Atendimento.');
        }
      }
      
      setLoading(false);
    }
  };

  const loadMessages = async (conversationId: number) => {
    try {
      const response = await api.get(`/conversations/${conversationId}/messages`, {
        params: { limit: 100 }
      });
      setMessages(response.data.data || []);
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
    }
  };

  const loadUnreadCount = async () => {
    try {
      const response = await api.get('/conversations/unread-count');
      setUnreadCount(response.data.unread_count || 0);
    } catch (error) {
      console.error('Erro ao carregar contador:', error);
    }
  };

  const loadStatusCounts = async () => {
    try {
      const response = await api.get('/conversations/status-counts');
      setStatusCounts(response.data.data || { open: 0, pending: 0, archived: 0, broadcast: 0 });
    } catch (error) {
      console.error('Erro ao carregar contadores de status:', error);
    }
  };

  const acceptConversation = async (conversationId: number) => {
    try {
      await api.put(`/conversations/${conversationId}/accept`);
      loadConversations();
      loadStatusCounts();
      // Se a conversa selecionada é a que foi aceita, atualizar
      if (selectedConversation?.id === conversationId) {
        setSelectedConversation({ ...selectedConversation, status: 'open' });
      }
    } catch (error: any) {
      console.error('Erro ao aceitar conversa:', error);
      alert(error.response?.data?.error || 'Erro ao aceitar conversa');
    }
  };

  const markAsRead = async (conversationId: number) => {
    try {
      await api.put(`/conversations/${conversationId}/read`);
      loadConversations();
      loadUnreadCount();
    } catch (error) {
      console.error('Erro ao marcar como lida:', error);
    }
  };

  const handleArchiveConversation = async (conversationId: number) => {
    if (!confirm('Tem certeza que deseja encerrar e arquivar este chat?')) {
      return;
    }
    
    try {
      await api.put(`/conversations/${conversationId}/archive`, { is_archived: true });
      setSelectedConversation(null);
      setMessages([]);
      await loadConversations();
      await loadUnreadCount();
      await loadStatusCounts();
      alert('Chat encerrado com sucesso!');
    } catch (error) {
      console.error('Erro ao arquivar conversa:', error);
      alert('Erro ao encerrar o chat. Tente novamente.');
    }
  };

  // Arquivar rapidamente (para botão na lista, sem confirmação modal)
  const quickArchiveConversation = async (conversationId: number) => {
    try {
      await api.put(`/conversations/${conversationId}/archive`, { is_archived: true });
      // Se a conversa selecionada é a que foi arquivada, limpar seleção
      if (selectedConversation?.id === conversationId) {
        setSelectedConversation(null);
        setMessages([]);
      }
      await loadConversations();
      await loadUnreadCount();
      await loadStatusCounts();
    } catch (error) {
      console.error('Erro ao arquivar conversa:', error);
      alert('Erro ao encerrar o chat. Tente novamente.');
    }
  };

  // Toggle seleção de conversa
  const toggleSelectConversation = (conversationId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedConversationIds(prev => 
      prev.includes(conversationId) 
        ? prev.filter(id => id !== conversationId)
        : [...prev, conversationId]
    );
  };

  // Selecionar todas as conversas visíveis
  const selectAllConversations = () => {
    setSelectedConversationIds(conversations.map(c => c.id));
  };

  // Desselecionar todas
  const deselectAllConversations = () => {
    setSelectedConversationIds([]);
    setSelectMode(false);
  };

  // Encerrar (arquivar) múltiplas conversas
  const archiveMultipleConversations = async () => {
    if (selectedConversationIds.length === 0) return;
    
    if (!confirm(`Deseja encerrar e arquivar ${selectedConversationIds.length} conversa(s)?`)) {
      return;
    }
    
    try {
      for (const id of selectedConversationIds) {
        await api.put(`/conversations/${id}/archive`, { is_archived: true });
      }
      
      // Se a conversa selecionada está na lista, limpar
      if (selectedConversation && selectedConversationIds.includes(selectedConversation.id)) {
        setSelectedConversation(null);
        setMessages([]);
      }
      
      setSelectedConversationIds([]);
      setSelectMode(false);
      await loadConversations();
      await loadUnreadCount();
      await loadStatusCounts();
      alert(`${selectedConversationIds.length} conversa(s) arquivada(s) com sucesso!`);
    } catch (error) {
      console.error('Erro ao arquivar conversas:', error);
      alert('Erro ao encerrar as conversas. Tente novamente.');
    }
  };

  // Apagar (excluir permanentemente) múltiplas conversas
  const deleteMultipleConversations = async () => {
    if (selectedConversationIds.length === 0) return;
    
    if (!confirm(`⚠️ ATENÇÃO: Deseja APAGAR PERMANENTEMENTE ${selectedConversationIds.length} conversa(s)? Esta ação NÃO pode ser desfeita!`)) {
      return;
    }
    
    try {
      for (const id of selectedConversationIds) {
        await api.delete(`/conversations/${id}`);
      }
      
      // Se a conversa selecionada está na lista, limpar
      if (selectedConversation && selectedConversationIds.includes(selectedConversation.id)) {
        setSelectedConversation(null);
        setMessages([]);
      }
      
      setSelectedConversationIds([]);
      setSelectMode(false);
      await loadConversations();
      await loadUnreadCount();
      await loadStatusCounts();
      alert(`${selectedConversationIds.length} conversa(s) apagada(s) permanentemente!`);
    } catch (error) {
      console.error('Erro ao apagar conversas:', error);
      alert('Erro ao apagar as conversas. Tente novamente.');
    }
  };

  const sendMessage = async () => {
    if (!messageInput.trim() || !selectedConversation || sending) return;

    setSending(true);
    try {
      await api.post(`/conversations/${selectedConversation.id}/messages`, {
        message_content: messageInput,
        message_type: 'text'
      });
      
      setMessageInput('');
      loadMessages(selectedConversation.id);
      loadConversations();
    } catch (error: any) {
      console.error('Erro ao enviar mensagem:', error);
      alert(error.response?.data?.error || 'Erro ao enviar mensagem');
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Lista de emojis comuns
  const commonEmojis = [
    '😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘',
    '😗', '😙', '😚', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐',
    '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢',
    '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '👋', '🤚', '🖐️',
    '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖',
    '✅', '❌', '⭐', '🌟', '💯', '🎉', '🎊', '🔥', '💪', '🙏', '📱', '💰', '💵', '📞', '✨', '🚀'
  ];

  // Adicionar emoji ao input
  const addEmoji = (emoji: string) => {
    setMessageInput(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  // Iniciar gravação de áudio
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await sendAudioMessage(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error('Erro ao iniciar gravação:', error);
      alert('Não foi possível acessar o microfone. Verifique as permissões.');
    }
  };

  // Parar gravação
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    }
  };

  // Enviar áudio
  const sendAudioMessage = async (audioBlob: Blob) => {
    if (!selectedConversation) return;

    setSending(true);
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'audio.webm');
      formData.append('message_type', 'audio');

      await api.post(`/conversations/${selectedConversation.id}/messages/media`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setMessageInput('');
      loadMessages(selectedConversation.id);
      loadConversations();
    } catch (error: any) {
      console.error('Erro ao enviar áudio:', error);
      alert('Erro ao enviar áudio. A funcionalidade de áudio ainda está em desenvolvimento.');
    } finally {
      setSending(false);
    }
  };

  // Formatar tempo de gravação
  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Enviar arquivo
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'document') => {
    const file = event.target.files?.[0];
    if (!file || !selectedConversation) return;

    setSending(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('message_type', type);

      await api.post(`/conversations/${selectedConversation.id}/messages/media`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      loadMessages(selectedConversation.id);
      loadConversations();
    } catch (error: any) {
      console.error('Erro ao enviar arquivo:', error);
      alert('Erro ao enviar arquivo. A funcionalidade de mídia ainda está em desenvolvimento.');
    } finally {
      setSending(false);
      setShowAttachMenu(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Agora';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays === 1) return 'Ontem';
    if (diffDays < 7) return `${diffDays}d`;
    
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  const formatMessageTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusIcon = (message: Message) => {
    if (message.message_direction === 'inbound') return null;
    
    if (message.read_at) {
      return <FaCheckDouble className="text-blue-400" />;
    } else if (message.delivered_at) {
      return <FaCheckDouble className="text-gray-400" />;
    } else if (message.status === 'sent') {
      return <FaCheck className="text-gray-400" />;
    } else if (message.status === 'failed') {
      return <FaTimes className="text-red-400" />;
    }
    return <FaCircle className="text-xs text-gray-400" />;
  };

  if (!isAuthenticated) return null;

  // Tela de bloqueio quando chat não está habilitado
  if (chatDisabled) {
    return (
      <>
        <Head>
          <title>Chat - Atendimento WhatsApp</title>
        </Head>

        <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 flex items-center justify-center p-8">
          <div className="max-w-2xl w-full">
            <div className="bg-dark-800 border-2 border-yellow-500/50 rounded-3xl p-12 text-center space-y-6">
              <div className="inline-block p-6 bg-yellow-500/20 rounded-full">
                <FaTimes className="text-6xl text-yellow-400" />
              </div>
              
              <h1 className="text-3xl font-black text-white">
                Chat de Atendimento Indisponível
              </h1>
              
              <p className="text-xl text-gray-300 leading-relaxed">
                {chatDisabledMessage}
              </p>
              
              <div className="pt-6 space-y-4">
                <button
                  onClick={() => router.push('/')}
                  className="w-full px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold rounded-xl transition-all transform hover:scale-105"
                >
                  Voltar para Dashboard
                </button>
                
                <button
                  onClick={() => router.push('/mudar-plano')}
                  className="w-full px-8 py-4 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-bold rounded-xl transition-all transform hover:scale-105"
                >
                  Ver Planos e Fazer Upgrade
                </button>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Chat - Atendimento WhatsApp</title>
      </Head>

      {/* MODAL DE IMAGEM */}
      {imageModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setImageModalOpen(false)}
        >
          <button
            onClick={() => setImageModalOpen(false)}
            className="absolute top-4 right-4 text-white hover:text-red-400 transition-colors p-3 bg-black/50 rounded-full"
          >
            <FaTimes className="text-3xl" />
          </button>
          <img 
            src={imageModalSrc} 
            alt="Imagem ampliada" 
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <div className="h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 flex flex-col overflow-hidden">
        
        {/* CABEÇALHO COM ABAS */}
        <header className="bg-dark-900 border-b border-gray-700 px-4 py-2 flex-shrink-0">
          <div className="flex items-center justify-between">
            {/* Botão Voltar + Logo */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/')}
                className="p-2 hover:bg-dark-700 rounded-lg transition-colors"
                title="Voltar ao Início"
              >
                <FaHome className="text-xl text-gray-400 hover:text-white" />
              </button>
              <div className="flex items-center gap-2">
                <FaComments className="text-2xl text-emerald-400" />
                <span className="text-xl font-bold text-white hidden md:block">Atendimento</span>
              </div>
            </div>

            {/* Abas de Navegação */}
            <nav className="flex items-center gap-1">
              {CHAT_TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                const isDisabled = !tab.active;
                
                return (
                  <button
                    key={tab.id}
                    onClick={() => tab.active && setActiveTab(tab.id)}
                    disabled={isDisabled}
                    className={`
                      flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                      ${isActive 
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' 
                        : isDisabled
                          ? 'text-gray-600 cursor-not-allowed'
                          : 'text-gray-400 hover:text-white hover:bg-dark-700'
                      }
                    `}
                    title={isDisabled ? 'Em breve' : tab.label}
                  >
                    <Icon className="text-lg" />
                    <span className="hidden lg:inline">{tab.label}</span>
                    {isDisabled && <span className="text-xs text-yellow-500 hidden xl:inline">(em breve)</span>}
                  </button>
                );
              })}
            </nav>

            {/* Contador de não lidas */}
            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <div className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold animate-pulse">
                  {unreadCount} nova{unreadCount > 1 ? 's' : ''}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* CONTEÚDO PRINCIPAL */}
        <div className="flex-1 flex overflow-hidden">
        
        {/* SIDEBAR - LISTA DE CONVERSAS */}
        <div className="w-full md:w-96 bg-dark-800 border-r border-gray-700 flex flex-col overflow-hidden">
          
          {/* Painel de Busca e Filtros */}
          <div className="bg-dark-900 p-4 border-b border-gray-700">
            {/* Busca */}
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar conversa..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-dark-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Barra de atualização */}
            <div className="flex items-center justify-between mt-3 mb-2">
              <button
                onClick={refreshAll}
                disabled={refreshing}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  refreshing ? 'bg-gray-600 text-gray-400' : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                }`}
              >
                <FaSync className={refreshing ? 'animate-spin' : ''} />
                {refreshing ? 'Atualizando...' : 'Atualizar'}
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  className={`px-2 py-1 rounded text-xs font-bold transition-colors ${
                    autoRefresh ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-700 text-gray-400'
                  }`}
                  title={autoRefresh ? 'Atualização automática LIGADA' : 'Atualização automática DESLIGADA'}
                >
                  {autoRefresh ? '🟢 Auto' : '⚪ Auto'}
                </button>
              </div>
            </div>

            {/* Filtros - 4 Filas */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setFilter('open')}
                className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1 ${
                  filter === 'open'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-dark-700 text-gray-400 hover:bg-dark-600'
                }`}
              >
                <FaHeadset /> Abertos ({statusCounts.open})
              </button>
              <button
                onClick={() => setFilter('pending')}
                className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1 ${
                  filter === 'pending'
                    ? 'bg-yellow-500 text-white'
                    : 'bg-dark-700 text-gray-400 hover:bg-dark-600'
                }`}
              >
                <FaClock /> Pendentes ({statusCounts.pending})
              </button>
              <button
                onClick={() => setFilter('archived')}
                className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1 ${
                  filter === 'archived'
                    ? 'bg-gray-500 text-white'
                    : 'bg-dark-700 text-gray-400 hover:bg-dark-600'
                }`}
              >
                <FaArchive /> Arquivadas ({statusCounts.archived})
              </button>
            </div>
          </div>

          {/* Barra de ações para seleção múltipla */}
          {selectMode && (
            <div className="bg-dark-900 p-3 border-b border-gray-700">
              {/* Linha 1: Contador e botão selecionar todos */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-white font-bold">
                  {selectedConversationIds.length} selecionado(s)
                </span>
                <button
                  onClick={selectAllConversations}
                  className="text-xs text-emerald-400 hover:text-emerald-300 underline"
                >
                  Selecionar Todos
                </button>
              </div>
              {/* Linha 2: Botões de ação */}
              <div className="flex items-center gap-2">
                <button
                  onClick={archiveMultipleConversations}
                  disabled={selectedConversationIds.length === 0}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg text-white text-xs font-bold disabled:opacity-50 disabled:bg-gray-600"
                  title="Arquivar selecionados"
                >
                  <FaArchive className="text-xs" /> Encerrar
                </button>
                <button
                  onClick={deleteMultipleConversations}
                  disabled={selectedConversationIds.length === 0}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white text-xs font-bold disabled:opacity-50 disabled:bg-gray-600"
                  title="Apagar permanentemente"
                >
                  <FaTrash className="text-xs" /> Apagar
                </button>
                <button
                  onClick={deselectAllConversations}
                  className="px-3 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg text-white text-xs font-bold"
                >
                  <FaTimes className="text-xs" />
                </button>
              </div>
            </div>
          )}

          {/* Botão para ativar modo de seleção */}
          {!selectMode && conversations.length > 0 && (
            <div className="bg-dark-900/50 px-4 py-2 border-b border-gray-700/50">
              <button
                onClick={() => setSelectMode(true)}
                className="text-xs text-gray-400 hover:text-white flex items-center gap-1"
              >
                <FaCheckSquare className="text-xs" /> Selecionar múltiplos
              </button>
            </div>
          )}

          {/* Lista de Conversas - com scroll estilizado */}
          <div className="flex-1 overflow-y-auto chat-sidebar-scroll">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
              </div>
            ) : conversations.length === 0 ? (
              <div className="text-center py-12 px-4">
                <FaComments className="text-6xl text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 text-xl font-medium">Nenhuma conversa</p>
                <p className="text-gray-500 text-base mt-2">
                  {filter === 'pending' ? 'Nenhuma conversa aguardando atendimento' : 
                   filter === 'open' ? 'Você não está atendendo nenhuma conversa' :
                   filter === 'broadcast' ? 'Nenhum disparo sem resposta' :
                   filter === 'archived' ? 'Nenhuma conversa arquivada' :
                   'Aguardando mensagens de clientes'}
                </p>
              </div>
            ) : (
              conversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => !selectMode && setSelectedConversation(conv)}
                  className={`p-4 border-b border-gray-700/50 cursor-pointer transition-all duration-200 ${
                    selectedConversation?.id === conv.id
                      ? 'bg-gradient-to-r from-emerald-900/40 to-dark-700 border-l-4 border-l-emerald-500'
                      : selectedConversationIds.includes(conv.id)
                        ? 'bg-gradient-to-r from-blue-900/40 to-dark-700 border-l-4 border-l-blue-500'
                        : 'hover:bg-dark-700/70 border-l-4 border-l-transparent'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Checkbox para seleção múltipla */}
                    {selectMode && (
                      <div 
                        onClick={(e) => toggleSelectConversation(conv.id, e)}
                        className="flex-shrink-0 pt-1"
                      >
                        {selectedConversationIds.includes(conv.id) ? (
                          <FaCheckSquare className="text-xl text-blue-400" />
                        ) : (
                          <FaSquare className="text-xl text-gray-500" />
                        )}
                      </div>
                    )}

                    {/* Avatar com indicador de status */}
                    <div className="relative flex-shrink-0">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg ${
                        conv.status === 'pending' ? 'bg-gradient-to-br from-yellow-400 to-yellow-600' :
                        conv.status === 'broadcast' ? 'bg-gradient-to-br from-blue-400 to-blue-600' :
                        conv.status === 'archived' ? 'bg-gradient-to-br from-gray-400 to-gray-600' :
                        'bg-gradient-to-br from-emerald-400 to-emerald-600'
                      }`}>
                        <span className="text-white font-bold text-lg">
                          {(conv.contact_name || conv.phone_number)?.[0]?.toUpperCase()}
                        </span>
                      </div>
                      {/* Indicador de status */}
                      <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-dark-800 ${
                        conv.status === 'pending' ? 'bg-yellow-500' :
                        conv.status === 'broadcast' ? 'bg-blue-500' :
                        conv.status === 'archived' ? 'bg-gray-500' :
                        'bg-emerald-500'
                      }`}></div>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      {/* Linha 1: Nome + Horário */}
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="text-white font-semibold text-base truncate">
                          {conv.contact_name || conv.phone_number}
                        </h3>
                        {conv.last_message_at && (
                          <span className="text-xs text-gray-400 ml-2 font-medium flex-shrink-0">
                            {formatTime(conv.last_message_at)}
                          </span>
                        )}
                      </div>
                      
                      {/* Linha 2: Última mensagem (com mais espaço) */}
                      <p className="text-sm text-gray-300 mb-2 line-clamp-2">
                        {conv.last_message_direction === 'outbound' && '✓ '}
                        {conv.last_message_text || 'Sem mensagens'}
                      </p>

                      {/* Linha 3: Contagem de mensagens + Conexão */}
                      <div className="flex items-center gap-2 mb-2">
                        {conv.unread_count > 0 && (
                          <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-lg shadow-emerald-500/30 animate-pulse">
                            {conv.unread_count}
                          </div>
                        )}
                        {/* Nome da conta WhatsApp */}
                        {(conv.whatsapp_account_name || conv.instance_name) && (
                          <span className="text-xs text-blue-400 truncate">
                            <FaPlug className="inline mr-1 text-[10px]" /> 
                            {conv.whatsapp_account_name || conv.instance_name}
                          </span>
                        )}
                        {/* Nome do atendente se estiver em atendimento */}
                        {conv.status === 'open' && conv.attended_by_user_name && (
                          <span className="text-xs text-emerald-400">
                            <FaHeadset className="inline mr-1" /> {conv.attended_by_user_name}
                          </span>
                        )}
                      </div>
                        
                      {/* Linha 4: Botões para conversas pendentes (LINHA SEPARADA) */}
                      {!selectMode && conv.status === 'pending' && (
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              acceptConversation(conv.id);
                            }}
                            className="flex-1 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white text-xs font-bold px-3 py-2 rounded-lg flex items-center justify-center gap-1 shadow-lg transition-all duration-200"
                            title="Aceitar e iniciar atendimento"
                          >
                            <FaCheck className="text-xs" /> Aceitar
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              quickArchiveConversation(conv.id);
                            }}
                            className="flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white text-xs font-bold px-3 py-2 rounded-lg flex items-center justify-center gap-1 shadow-lg transition-all duration-200"
                            title="Encerrar e arquivar"
                          >
                            <FaTimes className="text-xs" /> Encerrar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ÁREA DE CHAT */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedConversation ? (
            <>
              {/* Cabeçalho do Chat */}
              <div className="bg-dark-900 p-4 border-b border-gray-700 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    selectedConversation.status === 'pending' ? 'bg-gradient-to-br from-yellow-500 to-yellow-600' :
                    selectedConversation.status === 'broadcast' ? 'bg-gradient-to-br from-blue-500 to-blue-600' :
                    'bg-gradient-to-br from-emerald-500 to-emerald-600'
                  }`}>
                    <span className="text-white font-bold">
                      {(selectedConversation.contact_name || selectedConversation.phone_number)?.[0]?.toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h2 className="text-white font-medium">
                      {selectedConversation.contact_name || selectedConversation.phone_number}
                    </h2>
                    <p className="text-xs text-gray-400">
                      {selectedConversation.phone_number}
                      {selectedConversation.whatsapp_account_name && (
                        <span className="ml-2 text-emerald-400">• {selectedConversation.whatsapp_account_name}</span>
                      )}
                      {selectedConversation.instance_name && (
                        <span className="ml-2 text-purple-400">• {selectedConversation.instance_name}</span>
                      )}
                    </p>
                    {/* Badge de status */}
                    {selectedConversation.status === 'pending' && (
                      <span className="inline-block mt-1 px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs font-bold rounded-full">
                        ⏳ Aguardando atendimento
                      </span>
                    )}
                    {selectedConversation.status === 'broadcast' && (
                      <span className="inline-block mt-1 px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs font-bold rounded-full">
                        📢 Disparo sem resposta
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Botões de ação do cabeçalho */}
                <div className="flex items-center gap-2">
                  {/* Botão Aceitar (para pendentes e broadcasts) */}
                  {(selectedConversation.status === 'pending' || selectedConversation.status === 'broadcast') && (
                    <button
                      onClick={() => acceptConversation(selectedConversation.id)}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600/40 border border-emerald-500/50 rounded-lg text-emerald-400 hover:text-emerald-300 transition-all"
                      title="Aceitar e iniciar atendimento"
                    >
                      <FaCheck className="text-sm" />
                      <span className="text-sm font-medium">Aceitar</span>
                    </button>
                  )}
                  {/* Botão Encerrar Chat */}
                  <button
                    onClick={() => handleArchiveConversation(selectedConversation.id)}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/40 border border-red-500/50 rounded-lg text-red-400 hover:text-red-300 transition-all"
                    title="Encerrar e arquivar esta conversa"
                  >
                    <FaTimes className="text-sm" />
                    <span className="text-sm font-medium">Encerrar</span>
                  </button>
                </div>
              </div>

              {/* Área de Mensagens ou Bloqueio para Pendentes */}
              {(selectedConversation.status === 'pending' || selectedConversation.status === 'broadcast') ? (
                /* TELA DE BLOQUEIO - Conversa não aceita */
                <div className="flex-1 flex items-center justify-center p-6 bg-gradient-to-b from-dark-800 to-dark-900">
                  <div className="text-center max-w-md">
                    <div className={`w-24 h-24 mx-auto mb-6 rounded-full flex items-center justify-center ${
                      selectedConversation.status === 'pending' 
                        ? 'bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 border-2 border-yellow-500/50' 
                        : 'bg-gradient-to-br from-blue-500/20 to-blue-600/20 border-2 border-blue-500/50'
                    }`}>
                      {selectedConversation.status === 'pending' ? (
                        <FaClock className="text-5xl text-yellow-400" />
                      ) : (
                        <FaBullhorn className="text-5xl text-blue-400" />
                      )}
                    </div>
                    <h3 className={`text-2xl font-bold mb-3 ${
                      selectedConversation.status === 'pending' ? 'text-yellow-400' : 'text-blue-400'
                    }`}>
                      {selectedConversation.status === 'pending' 
                        ? 'Conversa Aguardando Atendimento' 
                        : 'Disparo Aguardando Resposta'}
                    </h3>
                    <p className="text-gray-400 text-base mb-6">
                      {selectedConversation.status === 'pending' 
                        ? 'Esta conversa ainda não foi aceita. Clique em "Aceitar" para iniciar o atendimento e visualizar as mensagens.'
                        : 'Este é um disparo que ainda não foi respondido. Aceite para iniciar o atendimento ou encerre se não houver interesse.'}
                    </p>
                    <div className="flex items-center justify-center gap-3">
                      <button
                        onClick={() => acceptConversation(selectedConversation.id)}
                        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 rounded-xl text-white font-bold text-base shadow-lg shadow-emerald-500/30 transition-all hover:scale-105"
                      >
                        <FaCheck /> Aceitar e Atender
                      </button>
                      <button
                        onClick={() => quickArchiveConversation(selectedConversation.id)}
                        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 rounded-xl text-white font-bold text-base shadow-lg shadow-red-500/30 transition-all hover:scale-105"
                      >
                        <FaTimes /> Encerrar
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* MENSAGENS - Conversa aceita/aberta */
                <div 
                  className="flex-1 overflow-y-auto p-6 bg-gradient-to-b from-dark-800 to-dark-900 scrollbar-thin scrollbar-thumb-emerald-600 scrollbar-track-dark-700" 
                  style={{ 
                    backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%2310b981\' fill-opacity=\'0.03\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
                    scrollbarWidth: 'thin',
                    scrollbarColor: '#10b981 #1f2937'
                  }}
                >
                  {messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <FaComments className="text-6xl text-gray-600 mx-auto mb-4" />
                        <p className="text-xl text-gray-400 font-medium">Nenhuma mensagem ainda</p>
                        <p className="text-gray-500 mt-2">As mensagens aparecerão aqui</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 max-w-4xl mx-auto">
                      {messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex ${msg.message_direction === 'outbound' ? 'justify-end' : 'justify-start'} mb-3`}
                        >
                          <div
                            className={`max-w-lg px-5 py-3 rounded-2xl shadow-lg ${
                              msg.message_direction === 'outbound'
                                ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white rounded-br-md'
                                : 'bg-gradient-to-br from-gray-700 to-gray-800 text-white rounded-bl-md'
                            }`}
                          >
                            {/* Renderiza o conteúdo baseado no tipo */}
                            <MessageContent 
                              msg={msg} 
                              onImageClick={(url) => {
                                setImageModalSrc(url);
                                setImageModalOpen(true);
                              }}
                            />
                            
                            {/* Horário e status */}
                            <div className={`flex items-center gap-2 mt-2 ${msg.message_direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                              <span className="text-sm opacity-80 font-medium">
                                {formatMessageTime(msg.sent_at)}
                              </span>
                              {msg.message_direction === 'outbound' && (
                                <span className="text-sm">{getStatusIcon(msg)}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </div>
              )}

              {/* Input de Mensagem - FIXO NO BOTTOM - Só mostra se conversa aceita */}
              {selectedConversation.status !== 'pending' && selectedConversation.status !== 'broadcast' && (
              <div className="bg-gradient-to-r from-dark-900 via-dark-800 to-dark-900 p-5 border-t-2 border-emerald-500/30 flex-shrink-0">
                {/* Inputs ocultos para arquivos */}
                <input
                  type="file"
                  ref={imageInputRef}
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFileSelect(e, 'image')}
                />
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                  className="hidden"
                  onChange={(e) => handleFileSelect(e, 'document')}
                />

                <div className="flex items-end gap-4 max-w-4xl mx-auto">
                  {/* Botões de ação */}
                  <div className="flex gap-2 relative">
                    {/* Botão Anexar */}
                    <div className="relative">
                      <button 
                        onClick={() => setShowAttachMenu(!showAttachMenu)}
                        className="p-3 bg-dark-700 hover:bg-dark-600 rounded-xl transition-all duration-200 hover:scale-105 border border-gray-600"
                      >
                        <FaPaperclip className="text-xl text-emerald-400" />
                      </button>
                      
                      {/* Menu de anexos */}
                      {showAttachMenu && (
                        <div className="absolute bottom-full left-0 mb-2 bg-dark-700 rounded-xl shadow-xl border border-gray-600 p-2 min-w-[150px]">
                          <button
                            onClick={() => imageInputRef.current?.click()}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-dark-600 rounded-lg text-white transition-colors"
                          >
                            <FaImage className="text-purple-400" />
                            <span>Imagem</span>
                          </button>
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-dark-600 rounded-lg text-white transition-colors"
                          >
                            <FaFile className="text-blue-400" />
                            <span>Documento</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Botão Emoji */}
                    <div className="relative">
                      <button 
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        className="p-3 bg-dark-700 hover:bg-dark-600 rounded-xl transition-all duration-200 hover:scale-105 border border-gray-600"
                      >
                        <FaSmile className="text-xl text-yellow-400" />
                      </button>
                      
                      {/* Emoji Picker */}
                      {showEmojiPicker && (
                        <div className="absolute bottom-full left-0 mb-2 bg-dark-700 rounded-xl shadow-xl border border-gray-600 p-3 w-80 max-h-64 overflow-y-auto">
                          <div className="grid grid-cols-8 gap-1">
                            {commonEmojis.map((emoji, index) => (
                              <button
                                key={index}
                                onClick={() => addEmoji(emoji)}
                                className="text-2xl p-2 hover:bg-dark-600 rounded-lg transition-colors"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Botão Gravar Áudio */}
                    <button 
                      onClick={isRecording ? stopRecording : startRecording}
                      className={`p-3 rounded-xl transition-all duration-200 hover:scale-105 border ${
                        isRecording 
                          ? 'bg-red-600 border-red-500 animate-pulse' 
                          : 'bg-dark-700 hover:bg-dark-600 border-gray-600'
                      }`}
                    >
                      {isRecording ? (
                        <FaStop className="text-xl text-white" />
                      ) : (
                        <FaMicrophone className="text-xl text-red-400" />
                      )}
                    </button>
                  </div>

                  {/* Indicador de gravação ou campo de texto */}
                  {isRecording ? (
                    <div className="flex-1 flex items-center justify-center bg-red-900/30 border-2 border-red-500 rounded-2xl px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                        <span className="text-white text-lg font-bold">
                          Gravando... {formatRecordingTime(recordingTime)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 relative">
                      <textarea
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Digite sua mensagem aqui..."
                        disabled={sending}
                        rows={2}
                        className="w-full px-5 py-4 bg-dark-700 border-2 border-gray-600 rounded-2xl text-white text-lg placeholder-gray-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 resize-none transition-all duration-200"
                        style={{ minHeight: '60px', maxHeight: '120px' }}
                      />
                    </div>
                  )}
                  
                  {/* Botão enviar */}
                  <button
                    onClick={sendMessage}
                    disabled={!messageInput.trim() || sending || isRecording}
                    className={`p-4 rounded-xl transition-all duration-200 ${
                      messageInput.trim() && !sending && !isRecording
                        ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg shadow-emerald-500/30 hover:scale-105'
                        : 'bg-dark-700 text-gray-500 cursor-not-allowed border border-gray-600'
                    }`}
                  >
                    <FaPaperPlane className="text-2xl" />
                  </button>
                </div>
              </div>
              )}
            </>
          ) : (
            // Nenhuma conversa selecionada
            <div className="flex-1 flex items-center justify-center bg-dark-800">
              <div className="text-center">
                <FaComments className="text-8xl text-gray-700 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-white mb-2">
                  Selecione uma conversa
                </h2>
                <p className="text-gray-400">
                  Escolha uma conversa na lista para começar a atender
                </p>
              </div>
            </div>
          )}
        </div>
        </div>
      </div>
    </>
  );
}

