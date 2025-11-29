import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { FaArrowLeft, FaPaperPlane, FaWhatsapp, FaCheckCircle, FaTrash, FaImage, FaMicrophone, FaPlay, FaPause, FaVideo, FaMusic } from 'react-icons/fa';
import api from '@/services/api';
import { uploadAPI } from '@/services/api';

// Configuração da URL base da API
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace(/\/api$/, '');
import AudioRecorder from '@/components/AudioRecorder';
import MultiAudioRecorder from '@/components/MultiAudioRecorder';
import MultiMediaUploader from '@/components/MultiMediaUploader';
import { InstanceSelect } from '@/components/InstanceSelect';
import styles from '@/styles/AudioRecorder.module.css';

interface UazInstance {
  id: number;
  name: string;
  session_name: string;
  is_connected: boolean;
  phone_number?: string;
  profile_pic_url?: string | null;
  profile_name?: string | null;
  is_active?: boolean;
}

export default function EnviarMensagemUaz() {
  const router = useRouter();
  const [instances, setInstances] = useState<UazInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const [formData, setFormData] = useState({
    instance_id: '',
    number: '',
    text: '',
    delay: 0,
    readchat: true,
    linkpreview: true
  });

  // Estados para mídia
  const [uploadedMedia, setUploadedMedia] = useState<any>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [recordedAudioBlob, setRecordedAudioBlob] = useState<Blob | null>(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string>('');
  const [recordedAudioDuration, setRecordedAudioDuration] = useState<number>(0);
  const [mediaMode, setMediaMode] = useState<'upload' | 'record'>('upload');
  
  // Estados para múltiplos áudios
  const [recordedAudios, setRecordedAudios] = useState<any[]>([]);
  const [uploadedAudios, setUploadedAudios] = useState<any[]>([]);
  
  // Estados para múltiplos arquivos
  const [selectedFiles, setSelectedFiles] = useState<any[]>([]);
  const [useMultipleFiles, setUseMultipleFiles] = useState(false);
  
  // Estados para delays personalizados
  const [delayBeforeSending, setDelayBeforeSending] = useState(2); // segundos antes de iniciar
  const [delayBetweenMessages, setDelayBetweenMessages] = useState(1.5); // segundos entre cada mensagem
  
  // Estados para player de mídia individual
  const [mediaPlaybackState, setMediaPlaybackState] = useState({
    isPlaying: false,
    currentTime: 0,
    duration: 0
  });
  const mediaRef = useRef<HTMLMediaElement | null>(null);

  useEffect(() => {
    loadInstances();
  }, []);

  const loadInstances = async () => {
    try {
      const response = await api.get('/uaz/instances');
      if (response.data.success) {
        // Filtrar: Conectadas E Ativas (não pausadas)
        const connected = response.data.data.filter(
          (inst: UazInstance) => inst.is_connected && inst.is_active === true
        );
        setInstances(connected);
      }
    } catch (error) {
      console.error('Erro ao carregar instâncias:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatPhoneNumber = (value: string) => {
    // Remove tudo que não é número
    const numbers = value.replace(/\D/g, '');
    
    // Limita a 13 dígitos (55 + 11 dígitos)
    return numbers.slice(0, 13);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setFormData({ ...formData, number: formatted });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tamanho (16MB máximo)
    if (file.size > 16 * 1024 * 1024) {
      setUploadError('Arquivo muito grande! Máximo: 16MB');
      return;
    }

    setUploadingMedia(true);
    setUploadError('');

    try {
      const response = await uploadAPI.uploadMedia(file);
      const data = response.data.data;
      
      // ✅ Converter URL relativa para URL completa
      const fullUrl = data.url.startsWith('http') || data.url.startsWith('data:') || data.url.startsWith('blob:')
        ? data.url 
        : `${API_BASE_URL}${data.url}`;
      
      setUploadedMedia({
        ...data,
        url: fullUrl
      });
    } catch (err: any) {
      setUploadError(err.response?.data?.error || 'Erro ao fazer upload');
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleRemoveMedia = () => {
    setUploadedMedia(null);
    setUploadError('');
    setRecordedAudioBlob(null);
    setRecordedAudioUrl('');
    setRecordedAudioDuration(0);
    // Reset player state
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
    
    // Calcular duração do áudio
    const audio = new Audio(audioUrl);
    audio.addEventListener('loadedmetadata', () => {
      setRecordedAudioDuration(Math.floor(audio.duration));
    });
    
    // Upload do áudio gravado
    setUploadingMedia(true);
    try {
      // Criar um File a partir do Blob
      const audioFile = new File([audioBlob], 'audio-gravado.ogg', { type: 'audio/ogg; codecs=opus' });
      const response = await uploadAPI.uploadMedia(audioFile);
      const data = response.data.data;
      
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
      setUploadError(err.response?.data?.error || 'Erro ao fazer upload do áudio');
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleRemoveAudio = () => {
    setRecordedAudioBlob(null);
    setRecordedAudioUrl('');
    setRecordedAudioDuration(0);
    setUploadedMedia(null);
    setMediaMode('upload'); // Volta para modo upload
  };

  // Handlers para múltiplos áudios
  const handleMultipleAudiosChange = (audios: any[]) => {
    setRecordedAudios(audios);
  };

  const handleMultipleAudiosUpload = async (audios: any[]) => {
    const uploaded = [];
    
    for (const audio of audios) {
      try {
        const audioFile = new File([audio.blob], `audio-${audio.id}.ogg`, { type: 'audio/ogg; codecs=opus' });
        const response = await uploadAPI.uploadMedia(audioFile);
        const data = response.data.data;
        
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
      } catch (err) {
        console.error('Erro ao fazer upload do áudio:', err);
      }
    }
    
    setUploadedAudios(uploaded);
  };

  // Handlers para múltiplos arquivos
  const handleMultipleFilesChange = (files: any[]) => {
    setSelectedFiles(files);
  };

  // Handlers para player de mídia individual
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

  const getMediaType = (mimeType: string): string => {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.includes('pdf') || mimeType.includes('document')) return 'document';
    return 'document';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.instance_id) {
      alert('❌ Selecione uma instância conectada');
      return;
    }

    if (!formData.number) {
      alert('❌ Digite o número de destino');
      return;
    }

    // Validar se tem texto OU mídia OU múltiplos áudios OU múltiplos arquivos
    if (!formData.text && !uploadedMedia && recordedAudios.length === 0 && selectedFiles.length === 0) {
      alert('❌ Digite uma mensagem, anexe uma mídia, grave um áudio ou selecione arquivos');
      return;
    }

    // Validar formato do número
    if (formData.number.length < 12 || formData.number.length > 13) {
      alert('❌ Número inválido. Use o formato: 5562999999999 (com DDI + DDD)');
      return;
    }

    // ✅ VERIFICAR STATUS DA INSTÂNCIA EM TEMPO REAL ANTES DE ENVIAR
    console.log('🔍 Verificando status da instância em tempo real antes de enviar...');
    setSending(true); // Mostrar indicador de carregamento durante verificação
    
    try {
      const statusResponse = await api.get(`/uaz/instances/${formData.instance_id}/status`);
      console.log('📊 Status recebido:', statusResponse.data);
      
      // Verificar se houve erro na resposta (ex: Invalid token)
      if (statusResponse.data.success === false) {
        setSending(false);
        const errorMsg = statusResponse.data.error || 'Erro desconhecido';
        
        if (errorMsg.toLowerCase().includes('invalid token')) {
          alert('❌ Token da instância inválido!\n\nA conexão precisa ser recriada:\n1. Vá em "Gerenciar Conexões"\n2. Delete esta instância\n3. Crie uma nova conexão');
          console.log('❌ Token inválido detectado. Instância precisa ser recriada.');
        } else {
          alert(`❌ Erro ao verificar conexão: ${errorMsg}`);
          console.log('❌ Erro na verificação:', errorMsg);
        }
        return;
      }
      
      if (!statusResponse.data.connected) {
        setSending(false);
        alert('❌ WhatsApp desconectado!\n\nA instância foi desconectada. Por favor:\n1. Vá em "Gerenciar Conexões"\n2. Clique em "QR Code" ou "Verificando..."\n3. Leia o QR Code novamente\n4. Tente enviar novamente');
        console.log('❌ Instância desconectada, envio cancelado');
        return;
      }
      
      console.log('✅ Instância conectada, prosseguindo com o envio...');
    } catch (error: any) {
      setSending(false);
      console.error('❌ Erro ao verificar status:', error);
      alert('❌ Erro ao verificar conexão!\n\nNão foi possível verificar se a instância está conectada.\n\nTente:\n1. Verificar sua conexão com a internet\n2. Verificar se o servidor está rodando\n3. Tentar novamente');
      return;
    }
    
    try {
      let response;

      console.log('📤 Enviando mensagem...', {
        instance_id: formData.instance_id,
        number: formData.number,
        has_media: !!uploadedMedia,
        multiple_audios: recordedAudios.length
      });

      // Se tem múltiplos áudios gravados, envia todos
      if (recordedAudios.length > 0) {
        // Primeiro fazer upload de todos os áudios
        await handleMultipleAudiosUpload(recordedAudios);
        
        // Enviar texto (se houver)
        if (formData.text) {
          await api.post(`/uaz/instances/${formData.instance_id}/send-text`, {
            number: formData.number,
            text: formData.text,
            delay: formData.delay,
            readchat: formData.readchat,
            linkpreview: formData.linkpreview
          });
          
          // Aguardar delay configurado antes de enviar os áudios
          await new Promise(resolve => setTimeout(resolve, delayBeforeSending * 1000));
        }
        
        // Enviar cada áudio
        for (const [index, audio] of recordedAudios.entries()) {
          const audioFile = new File([audio.blob], `audio-${audio.id}.ogg`, { type: 'audio/ogg; codecs=opus' });
          const uploadResponse = await uploadAPI.uploadMedia(audioFile);
          const uploadedData = uploadResponse.data; // ✅ Corrigido: backend retorna dados diretamente em response.data
          
          const audioUrl = uploadedData.url.startsWith('http') 
            ? uploadedData.url 
            : `${API_BASE_URL}${uploadedData.url}`;
          
          await api.post(`/uaz/instances/${formData.instance_id}/send-audio`, {
            number: formData.number,
            audio: audioUrl
          });
          
          console.log(`✅ Áudio ${index + 1}/${recordedAudios.length} enviado`);
          
          // Aguardar delay configurado entre cada áudio (exceto o último)
          if (index < recordedAudios.length - 1) {
            await new Promise(resolve => setTimeout(resolve, delayBetweenMessages * 1000));
          }
        }
        
        alert(`✅ ${recordedAudios.length} áudio(s) ${formData.text ? '+ mensagem de texto' : ''} enviado(s) com sucesso!`);
        
        // Limpar campos
        setFormData({
          ...formData,
          number: '',
          text: ''
        });
        setRecordedAudios([]);
        setUploadedAudios([]);
        
        return; // Sair da função
      }

      // Se tem múltiplos arquivos selecionados, envia todos
      if (selectedFiles.length > 0) {
        // Enviar texto (se houver)
        if (formData.text) {
          await api.post(`/uaz/instances/${formData.instance_id}/send-text`, {
            number: formData.number,
            text: formData.text,
            delay: formData.delay,
            readchat: formData.readchat,
            linkpreview: formData.linkpreview
          });
          
          // Aguardar delay configurado antes de enviar os arquivos
          await new Promise(resolve => setTimeout(resolve, delayBeforeSending * 1000));
        }
        
        // Enviar cada arquivo
        for (const [index, fileData] of selectedFiles.entries()) {
          const uploadResponse = await uploadAPI.uploadMedia(fileData.file);
          const uploadedData = uploadResponse.data; // ✅ Corrigido: backend retorna dados diretamente em response.data
          
          const fileUrl = uploadedData.url.startsWith('http') 
            ? uploadedData.url 
            : `${API_BASE_URL}${uploadedData.url}`;
          
          // Determinar o endpoint baseado no tipo de arquivo
          switch (fileData.type) {
            case 'image':
              await api.post(`/uaz/instances/${formData.instance_id}/send-image`, {
                number: formData.number,
                image: fileUrl,
                caption: ''
              });
              break;
            case 'video':
              await api.post(`/uaz/instances/${formData.instance_id}/send-video`, {
                number: formData.number,
                video: fileUrl,
                caption: ''
              });
              break;
            case 'audio':
              await api.post(`/uaz/instances/${formData.instance_id}/send-audio`, {
                number: formData.number,
                audio: fileUrl
              });
              break;
            case 'document':
              await api.post(`/uaz/instances/${formData.instance_id}/send-document`, {
                number: formData.number,
                document: fileUrl,
                filename: fileData.name,
                caption: ''
              });
              break;
          }
          
          console.log(`✅ Arquivo ${index + 1}/${selectedFiles.length} enviado (${fileData.type})`);
          
          // Aguardar delay configurado entre cada arquivo (exceto o último)
          if (index < selectedFiles.length - 1) {
            await new Promise(resolve => setTimeout(resolve, delayBetweenMessages * 1000));
          }
        }
        
        alert(`✅ ${selectedFiles.length} arquivo(s) ${formData.text ? '+ mensagem de texto' : ''} enviado(s) com sucesso!`);
        
        // Limpar campos
        setFormData({
          ...formData,
          number: '',
          text: ''
        });
        setSelectedFiles([]);
        
        return; // Sair da função
      }
      
      // Se tem mídia anexada, usa o endpoint apropriado
      if (uploadedMedia) {
        const mediaType = getMediaType(uploadedMedia.mime_type);
        const mediaUrl = uploadedMedia.url.startsWith('http') 
          ? uploadedMedia.url 
          : `${API_BASE_URL}${uploadedMedia.url}`;

        switch (mediaType) {
          case 'image':
            response = await api.post(`/uaz/instances/${formData.instance_id}/send-image`, {
              number: formData.number,
              image: mediaUrl,
              caption: formData.text || ''
            });
            break;
          case 'video':
            response = await api.post(`/uaz/instances/${formData.instance_id}/send-video`, {
              number: formData.number,
              video: mediaUrl,
              caption: formData.text || ''
            });
            break;
          case 'audio':
            response = await api.post(`/uaz/instances/${formData.instance_id}/send-audio`, {
              number: formData.number,
              audio: mediaUrl
            });
            break;
          case 'document':
            response = await api.post(`/uaz/instances/${formData.instance_id}/send-document`, {
              number: formData.number,
              document: mediaUrl,
              filename: uploadedMedia.original_name || 'documento.pdf',
              caption: formData.text || ''
            });
            break;
          default:
            throw new Error('Tipo de mídia não suportado');
        }
      } else {
        // Envia apenas texto
        response = await api.post(`/uaz/instances/${formData.instance_id}/send-text`, {
          number: formData.number,
          text: formData.text,
          delay: formData.delay,
          readchat: formData.readchat,
          linkpreview: formData.linkpreview
        });
      }

      if (response.data.success) {
        alert('✅ Mensagem enviada com sucesso!');
        // Limpar campos
        setFormData({
          ...formData,
          number: '',
          text: ''
        });
        setUploadedMedia(null);
      } else {
        alert('❌ Erro ao enviar: ' + response.data.error);
      }
    } catch (error: any) {
      console.error('❌ Erro completo:', error);
      console.error('❌ Response error:', error.response);
      
      const errorMessage = error.response?.data?.error || error.message || 'Erro desconhecido';
      alert(`❌ Erro ao enviar mensagem:\n\n${errorMessage}\n\nStatus HTTP: ${error.response?.status || 'N/A'}`);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-20 w-20 border-b-4 border-blue-500 mb-4"></div>
          <p className="text-2xl text-white/70">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* CABEÇALHO */}
        <div className="bg-gradient-to-r from-blue-600/30 via-indigo-500/20 to-blue-600/30 backdrop-blur-xl border-2 border-blue-500/40 rounded-3xl p-10 shadow-2xl">
          <div className="flex items-center gap-6">
            <button
              onClick={() => router.push('/dashboard-uaz')}
              className="bg-white/10 hover:bg-white/20 p-4 rounded-xl transition-all duration-200 border-2 border-white/20 hover:border-white/40"
            >
              <FaArrowLeft className="text-3xl text-white" />
            </button>
            
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-6 rounded-2xl shadow-lg">
              <FaPaperPlane className="text-5xl text-white" />
            </div>
            
            <div>
              <h1 className="text-5xl font-black text-white tracking-tight mb-2">
                Enviar Mensagem
              </h1>
              <p className="text-xl text-white/80 font-medium">
                WhatsApp QR Connect - Envio individual instantâneo
              </p>
            </div>
          </div>
        </div>

        {/* VERIFICAR SE TEM INSTÂNCIAS CONECTADAS */}
        {instances.length === 0 ? (
          <div className="bg-yellow-500/20 border-2 border-yellow-500/40 rounded-2xl p-10 text-center">
            <div className="text-6xl mb-6">⚠️</div>
            <h2 className="text-3xl font-black text-white mb-4">Nenhuma Instância Conectada</h2>
            <p className="text-white/80 text-lg mb-8">
              Você precisa conectar pelo menos uma instância do WhatsApp QR Connect para enviar mensagens
            </p>
            <div className="space-y-4">
              <div className="bg-blue-500/20 border-2 border-blue-500/40 rounded-xl p-6">
                <h3 className="text-xl font-bold text-white mb-3">📋 Como conectar:</h3>
                <ol className="list-decimal list-inside space-y-2 text-white/80">
                  <li>Vá em <strong>"Ir para Configurações"</strong></li>
                  <li>Clique em <strong>"Nova Instância"</strong></li>
                  <li>Preencha nome e clique em <strong>"Criar Instância"</strong></li>
                  <li>Clique no botão <strong>"QR Code"</strong> da instância criada</li>
                  <li>Escaneie o QR Code com seu WhatsApp</li>
                </ol>
              </div>
              
              <div className="flex gap-4 justify-center">
                <button
                  onClick={() => router.push('/configuracoes-uaz')}
                  className="px-8 py-4 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white text-lg font-bold rounded-xl shadow-lg"
                >
                  🔧 Ir para Configurações
                </button>
                <button
                  onClick={() => router.push('/dashboard-uaz')}
                  className="px-8 py-4 bg-white/10 hover:bg-white/20 text-white text-lg font-bold rounded-xl border-2 border-white/20"
                >
                  ⬅️ Voltar ao Dashboard
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-blue-500/40 rounded-2xl p-8 shadow-2xl">
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* SELECIONAR INSTÂNCIA */}
              <div>
                <label className="block text-lg font-bold mb-3 text-white flex items-center gap-2">
                  <FaWhatsapp className="text-green-400" />
                  Instância Conectada *
                </label>
                <InstanceSelect
                  instances={instances}
                  value={formData.instance_id}
                  onChange={(value) => setFormData({ ...formData, instance_id: value })}
                  placeholder="Selecione uma instância"
                  required
                />
              </div>

              {/* NÚMERO DE DESTINO */}
              <div>
                <label className="block text-lg font-bold mb-3 text-white">
                  📱 Número de Destino *
                </label>
                <input
                  type="tel"
                  required
                  className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/30 transition-all"
                  placeholder="5562999999999"
                  value={formData.number}
                  onChange={handlePhoneChange}
                  maxLength={13}
                />
                <p className="text-sm text-white/60 mt-2">
                  Formato: DDI + DDD + Número (ex: 5562999999999)
                </p>
              </div>

              {/* MENSAGEM */}
              <div>
                <label className="block text-lg font-bold mb-3 text-white">
                  💬 Mensagem {uploadedMedia ? '(Legenda - Opcional)' : '(Opcional)'}
                </label>
                <textarea
                  required={false}
                  rows={6}
                  className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/30 transition-all resize-none"
                  placeholder={uploadedMedia ? "Digite uma legenda (opcional)..." : "Digite sua mensagem (opcional)..."}
                  value={formData.text}
                  onChange={(e) => setFormData({ ...formData, text: e.target.value })}
                />
                <div className="flex justify-between mt-2">
                  <p className="text-sm text-white/60">
                    ✨ Use *negrito*, _itálico_, ~riscado~
                  </p>
                  <p className="text-sm text-white/60">
                    {formData.text.length} caracteres
                  </p>
                </div>
              </div>

              {/* UPLOAD DE MÍDIA */}
              <div>
                <label className="block text-lg font-bold mb-3 text-white flex items-center gap-2">
                  <FaImage className="text-blue-400" />
                  📎 Anexar Mídia (Opcional)
                </label>

                {!uploadedMedia ? (
                  <>
                    {/* Tabs para escolher entre Upload e Gravar */}
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

                    {/* Modo Upload */}
                    {mediaMode === 'upload' && (
                      <>
                        {/* Toggle para múltiplos arquivos */}
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

                        {/* Modo Múltiplos Arquivos */}
                        {useMultipleFiles ? (
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
                              accept="image/*,video/*,audio/*,application/pdf"
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
                    {mediaMode === 'record' && (
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
                        {uploadedMedia.mime_type.startsWith('image/') && <FaImage className="text-3xl text-blue-400" />}
                        {uploadedMedia.mime_type.startsWith('video/') && <FaVideo className="text-3xl text-purple-400" />}
                        {uploadedMedia.mime_type.startsWith('audio/') && <FaMusic className="text-3xl text-green-400" />}
                        {!uploadedMedia.mime_type.startsWith('image/') && !uploadedMedia.mime_type.startsWith('video/') && !uploadedMedia.mime_type.startsWith('audio/') && <FaImage className="text-3xl text-gray-400" />}
                        <div>
                          <p className="font-bold text-white">{uploadedMedia.original_name}</p>
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
                    {uploadedMedia.mime_type.startsWith('image/') && (
                      <div className="mt-4 bg-dark-700/50 rounded-xl p-4">
                        <img
                          src={uploadedMedia.url.startsWith('http') ? uploadedMedia.url : `${API_BASE_URL}${uploadedMedia.url}`}
                          alt="Preview"
                          className="max-w-full h-auto max-h-96 rounded-lg mx-auto object-contain"
                        />
                      </div>
                    )}

                    {/* PLAYER DE VÍDEO */}
                    {uploadedMedia.mime_type.startsWith('video/') && (
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
                    {uploadedMedia.mime_type.startsWith('audio/') && (
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

                {uploadError && (
                  <div className="mt-3 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
                    ❌ {uploadError}
                  </div>
                )}
              </div>

              {/* OPÇÕES AVANÇADAS */}
              <div className="bg-white/5 rounded-xl p-6 space-y-4">
                <h3 className="text-lg font-bold text-white mb-4">⚙️ Opções Avançadas</h3>
                
                <div>
                  <label className="block text-base font-bold mb-2 text-white">
                    ⏱️ Atraso antes de enviar (segundos)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="60"
                    className="w-full px-4 py-3 bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-blue-500 transition-all"
                    value={formData.delay}
                    onChange={(e) => setFormData({ ...formData, delay: parseInt(e.target.value) || 0 })}
                  />
                </div>

                {/* DELAYS PERSONALIZADOS PARA MÚLTIPLOS ENVIOS */}
                {(selectedFiles.length > 0 || recordedAudios.length > 0) && (
                  <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 border-2 border-purple-500/40 rounded-xl p-5 space-y-4">
                    <h4 className="text-base font-bold text-white flex items-center gap-2">
                      ⏳ Controle de Delays - Múltiplos Envios
                    </h4>
                    
                    {/* Presets Rápidos */}
                    <div>
                      <p className="text-sm text-white/60 mb-2">Presets Rápidos:</p>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setDelayBeforeSending(0.5);
                            setDelayBetweenMessages(0.5);
                          }}
                          className="px-3 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-300 border-2 border-green-500/40 rounded-lg font-bold transition-all text-sm"
                        >
                          ⚡ Rápido
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDelayBeforeSending(2);
                            setDelayBetweenMessages(1.5);
                          }}
                          className="px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border-2 border-blue-500/40 rounded-lg font-bold transition-all text-sm"
                        >
                          🔵 Normal
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDelayBeforeSending(5);
                            setDelayBetweenMessages(3);
                          }}
                          className="px-3 py-2 bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 border-2 border-orange-500/40 rounded-lg font-bold transition-all text-sm"
                        >
                          🐢 Lento
                        </button>
                      </div>
                    </div>

                    {/* Delay Antes de Iniciar */}
                    <div>
                      <label className="block text-sm font-bold mb-2 text-white flex items-center justify-between">
                        <span>🕐 Delay Antes de Iniciar</span>
                        <span className="text-purple-300">{delayBeforeSending}s</span>
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min="0"
                          max="10"
                          step="0.5"
                          value={delayBeforeSending}
                          onChange={(e) => setDelayBeforeSending(parseFloat(e.target.value))}
                          className="flex-1 h-2 bg-white/20 rounded-lg appearance-none cursor-pointer"
                          style={{
                            background: `linear-gradient(to right, #a855f7 0%, #a855f7 ${(delayBeforeSending / 10) * 100}%, rgba(255,255,255,0.2) ${(delayBeforeSending / 10) * 100}%, rgba(255,255,255,0.2) 100%)`
                          }}
                        />
                        <input
                          type="number"
                          min="0"
                          max="10"
                          step="0.5"
                          value={delayBeforeSending}
                          onChange={(e) => setDelayBeforeSending(parseFloat(e.target.value) || 0)}
                          className="w-20 px-3 py-2 bg-dark-700/80 border-2 border-purple-500/40 rounded-lg text-white text-center focus:border-purple-500 transition-all"
                        />
                      </div>
                      <p className="text-xs text-white/50 mt-1">
                        Tempo de espera entre o texto e o primeiro arquivo
                      </p>
                    </div>

                    {/* Delay Entre Mensagens */}
                    <div>
                      <label className="block text-sm font-bold mb-2 text-white flex items-center justify-between">
                        <span>⏱️ Delay Entre Cada Arquivo</span>
                        <span className="text-blue-300">{delayBetweenMessages}s</span>
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min="0"
                          max="10"
                          step="0.5"
                          value={delayBetweenMessages}
                          onChange={(e) => setDelayBetweenMessages(parseFloat(e.target.value))}
                          className="flex-1 h-2 bg-white/20 rounded-lg appearance-none cursor-pointer"
                          style={{
                            background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(delayBetweenMessages / 10) * 100}%, rgba(255,255,255,0.2) ${(delayBetweenMessages / 10) * 100}%, rgba(255,255,255,0.2) 100%)`
                          }}
                        />
                        <input
                          type="number"
                          min="0"
                          max="10"
                          step="0.5"
                          value={delayBetweenMessages}
                          onChange={(e) => setDelayBetweenMessages(parseFloat(e.target.value) || 0)}
                          className="w-20 px-3 py-2 bg-dark-700/80 border-2 border-blue-500/40 rounded-lg text-white text-center focus:border-blue-500 transition-all"
                        />
                      </div>
                      <p className="text-xs text-white/50 mt-1">
                        Intervalo entre cada arquivo enviado
                      </p>
                    </div>

                    {/* Estimativa de Tempo Total */}
                    <div className="bg-dark-700/50 rounded-lg p-3 border border-white/10">
                      <p className="text-sm text-white/80">
                        <span className="font-bold text-yellow-300">⏳ Tempo Estimado Total:</span>{' '}
                        {(() => {
                          const totalFiles = selectedFiles.length + recordedAudios.length;
                          if (totalFiles === 0) return '0s';
                          const totalTime = delayBeforeSending + (delayBetweenMessages * (totalFiles - 1));
                          return `${totalTime.toFixed(1)}s para ${totalFiles} arquivo(s)`;
                        })()}
                      </p>
                    </div>
                  </div>
                )}

                <label className="flex items-center gap-3 cursor-pointer p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-all">
                  <input
                    type="checkbox"
                    checked={formData.readchat}
                    onChange={(e) => setFormData({ ...formData, readchat: e.target.checked })}
                    className="w-5 h-5 rounded"
                  />
                  <span className="text-base font-bold text-white">✅ Marcar chat como lido após envio</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-all">
                  <input
                    type="checkbox"
                    checked={formData.linkpreview}
                    onChange={(e) => setFormData({ ...formData, linkpreview: e.target.checked })}
                    className="w-5 h-5 rounded"
                  />
                  <span className="text-base font-bold text-white">🔗 Mostrar preview de links</span>
                </label>
              </div>

              {/* BOTÃO ENVIAR */}
              <button
                type="submit"
                disabled={sending || !formData.instance_id}
                className="w-full px-8 py-6 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white text-xl font-black rounded-xl shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105 flex items-center justify-center gap-4"
              >
                {sending ? (
                  <>
                    <FaPaperPlane className="animate-pulse" />
                    Enviando mensagem...
                  </>
                ) : (
                  <>
                    <FaPaperPlane />
                    Enviar Mensagem Agora
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* AVISOS */}
        <div className="space-y-4">
          <div className="bg-blue-500/10 border-2 border-blue-500/30 rounded-xl p-6">
            <p className="text-blue-300 text-center">
              <strong>💡 Dica:</strong> As mensagens são enviadas instantaneamente. Certifique-se de que o número está correto antes de enviar.
            </p>
          </div>
          <div className="bg-green-500/10 border-2 border-green-500/30 rounded-xl p-6">
            <p className="text-green-300 text-center">
              <strong>✅ Novo:</strong> Agora você pode anexar imagens, vídeos, áudios e documentos diretamente do seu computador!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

