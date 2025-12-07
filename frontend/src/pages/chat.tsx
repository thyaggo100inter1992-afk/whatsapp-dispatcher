import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { FaComments, FaSearch, FaPaperPlane, FaPaperclip, FaSmile, FaArrowLeft, FaCheck, FaCheckDouble, FaCircle, FaTimes, FaArchive, FaInbox } from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

interface Conversation {
  id: number;
  phone_number: string;
  contact_name: string | null;
  last_message_at: string | null;
  last_message_text: string | null;
  last_message_direction: 'inbound' | 'outbound' | null;
  unread_count: number;
  is_archived: boolean;
  whatsapp_account_name: string | null;
  instance_name: string | null;
}

interface Message {
  id: number;
  conversation_id: number;
  message_direction: 'inbound' | 'outbound';
  message_type: string;
  message_content: string | null;
  media_url: string | null;
  status: string | null;
  sent_at: string;
  delivered_at: string | null;
  read_at: string | null;
  sent_by_user_name: string | null;
  is_read_by_agent: boolean;
}

export default function Chat() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  
  // Estados
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread' | 'archived'>('all');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [chatDisabled, setChatDisabled] = useState(false);
  const [chatDisabledMessage, setChatDisabledMessage] = useState('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Redirecionar se não autenticado
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  // Carregar conversas
  useEffect(() => {
    loadConversations();
    loadUnreadCount();
    
    // Atualizar a cada 10 segundos
    const interval = setInterval(() => {
      loadConversations();
      loadUnreadCount();
      if (selectedConversation) {
        loadMessages(selectedConversation.id);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [filter, searchTerm]);

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
      await api.put(`/conversations/${conversationId}/archive`);
      setSelectedConversation(null);
      setMessages([]);
      loadConversations();
      loadUnreadCount();
    } catch (error) {
      console.error('Erro ao arquivar conversa:', error);
      alert('Erro ao encerrar o chat. Tente novamente.');
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

      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 flex">
        
        {/* SIDEBAR - LISTA DE CONVERSAS */}
        <div className="w-full md:w-96 bg-dark-800 border-r border-gray-700 flex flex-col">
          
          {/* Cabeçalho */}
          <div className="bg-dark-900 p-4 border-b border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => router.push('/')}
                  className="p-2 hover:bg-dark-700 rounded-lg transition-colors"
                >
                  <FaArrowLeft className="text-xl text-gray-400" />
                </button>
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                  <FaComments className="text-emerald-400" />
                  Chat
                </h1>
              </div>
              {unreadCount > 0 && (
                <div className="bg-emerald-500 text-white px-3 py-1 rounded-full text-sm font-bold">
                  {unreadCount}
                </div>
              )}
            </div>

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

            {/* Filtros */}
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => setFilter('all')}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === 'all'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-dark-700 text-gray-400 hover:bg-dark-600'
                }`}
              >
                <FaInbox className="inline mr-1" /> Todas
              </button>
              <button
                onClick={() => setFilter('unread')}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === 'unread'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-dark-700 text-gray-400 hover:bg-dark-600'
                }`}
              >
                Não lidas ({unreadCount})
              </button>
              <button
                onClick={() => setFilter('archived')}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === 'archived'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-dark-700 text-gray-400 hover:bg-dark-600'
                }`}
              >
                <FaArchive className="inline mr-1" /> Arquivadas
              </button>
            </div>
          </div>

          {/* Lista de Conversas */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
              </div>
            ) : conversations.length === 0 ? (
              <div className="text-center py-12 px-4">
                <FaComments className="text-6xl text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 text-lg">Nenhuma conversa encontrada</p>
                <p className="text-gray-500 text-sm mt-2">
                  {filter === 'unread' ? 'Todas as conversas foram lidas' : 'Aguardando mensagens de clientes'}
                </p>
              </div>
            ) : (
              conversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => setSelectedConversation(conv)}
                  className={`p-4 border-b border-gray-700 cursor-pointer transition-colors ${
                    selectedConversation?.id === conv.id
                      ? 'bg-dark-700'
                      : 'hover:bg-dark-700/50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold text-lg">
                        {(conv.contact_name || conv.phone_number)?.[0]?.toUpperCase()}
                      </span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="text-white font-medium truncate">
                          {conv.contact_name || conv.phone_number}
                        </h3>
                        {conv.last_message_at && (
                          <span className="text-xs text-gray-400 ml-2">
                            {formatTime(conv.last_message_at)}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-gray-400 truncate">
                          {conv.last_message_direction === 'outbound' && '✓ '}
                          {conv.last_message_text || 'Sem mensagens'}
                        </p>
                        {conv.unread_count > 0 && (
                          <div className="bg-emerald-500 text-white text-xs font-bold px-2 py-1 rounded-full ml-2">
                            {conv.unread_count}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ÁREA DE CHAT */}
        <div className="flex-1 flex flex-col">
          {selectedConversation ? (
            <>
              {/* Cabeçalho do Chat */}
              <div className="bg-dark-900 p-4 border-b border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
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
                  </div>
                </div>
                
                {/* Botão Encerrar Chat */}
                <button
                  onClick={() => handleArchiveConversation(selectedConversation.id)}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/40 border border-red-500/50 rounded-lg text-red-400 hover:text-red-300 transition-all"
                  title="Encerrar e arquivar esta conversa"
                >
                  <FaTimes className="text-sm" />
                  <span className="text-sm font-medium">Encerrar Chat</span>
                </button>
              </div>

              {/* Mensagens */}
              <div className="flex-1 overflow-y-auto p-4 bg-dark-800" style={{ 
                backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.02\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
              }}>
                {messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-gray-500">Nenhuma mensagem ainda</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.message_direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-md px-4 py-2 rounded-lg ${
                            msg.message_direction === 'outbound'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-dark-700 text-white'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap break-words">
                            {msg.message_content || '[Mídia]'}
                          </p>
                          <div className="flex items-center justify-end gap-1 mt-1">
                            <span className="text-xs opacity-70">
                              {formatMessageTime(msg.sent_at)}
                            </span>
                            {msg.message_direction === 'outbound' && (
                              <span className="text-xs">{getStatusIcon(msg)}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Input de Mensagem */}
              <div className="bg-dark-900 p-4 border-t border-gray-700">
                <div className="flex items-end gap-2">
                  <button className="p-3 hover:bg-dark-700 rounded-lg transition-colors">
                    <FaPaperclip className="text-xl text-gray-400" />
                  </button>
                  <button className="p-3 hover:bg-dark-700 rounded-lg transition-colors">
                    <FaSmile className="text-xl text-gray-400" />
                  </button>
                  <textarea
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Digite uma mensagem..."
                    disabled={sending}
                    rows={1}
                    className="flex-1 px-4 py-3 bg-dark-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500 resize-none"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!messageInput.trim() || sending}
                    className={`p-3 rounded-lg transition-colors ${
                      messageInput.trim() && !sending
                        ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                        : 'bg-dark-700 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    <FaPaperPlane className="text-xl" />
                  </button>
                </div>
              </div>
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
    </>
  );
}

