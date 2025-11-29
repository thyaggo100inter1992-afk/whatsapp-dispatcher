import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { FaArrowLeft, FaImage, FaVideo, FaFile, FaMicrophone, FaPaperPlane, FaSpinner } from 'react-icons/fa';
import api from '@/services/api';

interface UazInstance {
  id: number;
  name: string;
  is_connected: boolean;
  is_active?: boolean;
}

export default function EnviarMidiaUaz() {
  const router = useRouter();
  const [instances, setInstances] = useState<UazInstance[]>([]);
  const [loading, setLoading] = useState(false);
  const [mediaType, setMediaType] = useState<'image' | 'video' | 'document' | 'audio'>('image');
  
  const [formData, setFormData] = useState({
    instance_id: '',
    phone: '',
    mediaUrl: '',
    caption: '',
    filename: ''
  });

  useEffect(() => {
    loadInstances();
  }, []);

  const loadInstances = async () => {
    try {
      const response = await api.get('/uaz/instances');
      if (response.data.success) {
        // Filtrar: Conectadas E Ativas (não pausadas)
        const connected = response.data.data.filter(
          (i: UazInstance) => i.is_connected && i.is_active === true
        );
        setInstances(connected);
      }
    } catch (error) {
      console.error('Erro ao carregar instâncias:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.instance_id || !formData.phone || !formData.mediaUrl) {
      alert('❌ Preencha todos os campos obrigatórios');
      return;
    }

    setLoading(true);
    try {
      let endpoint = '';
      let payload: any = {
        number: formData.phone
      };

      switch (mediaType) {
        case 'image':
          endpoint = `/uaz/instances/${formData.instance_id}/send-image`;
          payload.image = formData.mediaUrl;
          payload.caption = formData.caption;
          break;
        case 'video':
          endpoint = `/uaz/instances/${formData.instance_id}/send-video`;
          payload.video = formData.mediaUrl;
          payload.caption = formData.caption;
          break;
        case 'document':
          endpoint = `/uaz/instances/${formData.instance_id}/send-document`;
          payload.document = formData.mediaUrl;
          payload.filename = formData.filename || 'documento.pdf';
          payload.caption = formData.caption;
          break;
        case 'audio':
          endpoint = `/uaz/instances/${formData.instance_id}/send-audio`;
          payload.audio = formData.mediaUrl;
          break;
      }

      const response = await api.post(endpoint, payload);
      
      if (response.data.success) {
        alert('✅ Mídia enviada com sucesso!');
        setFormData({ ...formData, phone: '', mediaUrl: '', caption: '', filename: '' });
      } else {
        alert('❌ Erro: ' + response.data.error);
      }
    } catch (error: any) {
      alert('❌ Erro: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const getMediaIcon = () => {
    switch (mediaType) {
      case 'image': return <FaImage className="text-4xl" />;
      case 'video': return <FaVideo className="text-4xl" />;
      case 'document': return <FaFile className="text-4xl" />;
      case 'audio': return <FaMicrophone className="text-4xl" />;
    }
  };

  const getMediaLabel = () => {
    switch (mediaType) {
      case 'image': return 'Imagem';
      case 'video': return 'Vídeo';
      case 'document': return 'Documento';
      case 'audio': return 'Áudio';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 py-8 px-4">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* CABEÇALHO */}
        <div className="bg-gradient-to-r from-purple-600/30 via-indigo-500/20 to-purple-600/30 backdrop-blur-xl border-2 border-purple-500/40 rounded-3xl p-10 shadow-2xl">
          <div className="flex items-center gap-6">
            <button
              onClick={() => router.push('/dashboard-uaz')}
              className="bg-white/10 hover:bg-white/20 p-4 rounded-xl transition-all duration-200 border-2 border-white/20 hover:border-white/40"
            >
              <FaArrowLeft className="text-3xl text-white" />
            </button>
            
            <div>
              <h1 className="text-5xl font-black text-white tracking-tight mb-2">
                📤 Enviar Mídia
              </h1>
              <p className="text-xl text-white/80 font-medium">
                Envie imagens, vídeos, documentos e áudios via WhatsApp
              </p>
            </div>
          </div>
        </div>

        {/* SELEÇÃO DE TIPO DE MÍDIA */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button
            onClick={() => setMediaType('image')}
            className={`p-8 rounded-2xl border-2 transition-all ${
              mediaType === 'image'
                ? 'bg-blue-500/20 border-blue-500 text-blue-300'
                : 'bg-dark-800/60 border-white/20 text-white/60 hover:border-white/40'
            }`}
          >
            <FaImage className="text-5xl mb-3 mx-auto" />
            <p className="font-bold text-lg">Imagem</p>
          </button>

          <button
            onClick={() => setMediaType('video')}
            className={`p-8 rounded-2xl border-2 transition-all ${
              mediaType === 'video'
                ? 'bg-red-500/20 border-red-500 text-red-300'
                : 'bg-dark-800/60 border-white/20 text-white/60 hover:border-white/40'
            }`}
          >
            <FaVideo className="text-5xl mb-3 mx-auto" />
            <p className="font-bold text-lg">Vídeo</p>
          </button>

          <button
            onClick={() => setMediaType('document')}
            className={`p-8 rounded-2xl border-2 transition-all ${
              mediaType === 'document'
                ? 'bg-green-500/20 border-green-500 text-green-300'
                : 'bg-dark-800/60 border-white/20 text-white/60 hover:border-white/40'
            }`}
          >
            <FaFile className="text-5xl mb-3 mx-auto" />
            <p className="font-bold text-lg">Documento</p>
          </button>

          <button
            onClick={() => setMediaType('audio')}
            className={`p-8 rounded-2xl border-2 transition-all ${
              mediaType === 'audio'
                ? 'bg-yellow-500/20 border-yellow-500 text-yellow-300'
                : 'bg-dark-800/60 border-white/20 text-white/60 hover:border-white/40'
            }`}
          >
            <FaMicrophone className="text-5xl mb-3 mx-auto" />
            <p className="font-bold text-lg">Áudio</p>
          </button>
        </div>

        {/* FORMULÁRIO */}
        <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-purple-500/40 rounded-2xl p-10">
          <div className="flex items-center gap-4 mb-8">
            <div className={`p-4 rounded-xl ${
              mediaType === 'image' ? 'bg-blue-500/20 text-blue-300' :
              mediaType === 'video' ? 'bg-red-500/20 text-red-300' :
              mediaType === 'document' ? 'bg-green-500/20 text-green-300' :
              'bg-yellow-500/20 text-yellow-300'
            }`}>
              {getMediaIcon()}
            </div>
            <h2 className="text-3xl font-black text-white">
              Enviar {getMediaLabel()}
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* INSTÂNCIA */}
            <div>
              <label className="block text-lg font-bold mb-3 text-white">
                📱 Instância WhatsApp
              </label>
              <select
                className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-purple-500 focus:ring-4 focus:ring-purple-500/30 transition-all"
                value={formData.instance_id}
                onChange={(e) => setFormData({ ...formData, instance_id: e.target.value })}
                required
              >
                <option value="">Selecione uma instância</option>
                {instances.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.name}
                  </option>
                ))}
              </select>
            </div>

            {/* NÚMERO */}
            <div>
              <label className="block text-lg font-bold mb-3 text-white">
                📞 Número do Destinatário
              </label>
              <input
                type="text"
                className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-purple-500 focus:ring-4 focus:ring-purple-500/30 transition-all"
                placeholder="Ex: 5562912345678"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                required
              />
            </div>

            {/* URL DA MÍDIA */}
            <div>
              <label className="block text-lg font-bold mb-3 text-white">
                🔗 URL da Mídia
              </label>
              <input
                type="url"
                className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-purple-500 focus:ring-4 focus:ring-purple-500/30 transition-all font-mono"
                placeholder="https://exemplo.com/arquivo.jpg"
                value={formData.mediaUrl}
                onChange={(e) => setFormData({ ...formData, mediaUrl: e.target.value })}
                required
              />
            </div>

            {/* NOME DO ARQUIVO (Apenas para documentos) */}
            {mediaType === 'document' && (
              <div>
                <label className="block text-lg font-bold mb-3 text-white">
                  📄 Nome do Arquivo
                </label>
                <input
                  type="text"
                  className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-purple-500 focus:ring-4 focus:ring-purple-500/30 transition-all"
                  placeholder="Ex: relatorio.pdf"
                  value={formData.filename}
                  onChange={(e) => setFormData({ ...formData, filename: e.target.value })}
                />
              </div>
            )}

            {/* LEGENDA (Não para áudio) */}
            {mediaType !== 'audio' && (
              <div>
                <label className="block text-lg font-bold mb-3 text-white">
                  💬 Legenda (Opcional)
                </label>
                <textarea
                  className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-purple-500 focus:ring-4 focus:ring-purple-500/30 transition-all"
                  rows={4}
                  placeholder="Digite a legenda da mensagem..."
                  value={formData.caption}
                  onChange={(e) => setFormData({ ...formData, caption: e.target.value })}
                />
              </div>
            )}

            {/* BOTÃO ENVIAR */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-6 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white text-xl font-black rounded-xl shadow-2xl transition-all duration-200 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <FaSpinner className="animate-spin text-2xl" />
                  Enviando...
                </>
              ) : (
                <>
                  <FaPaperPlane className="text-2xl" />
                  Enviar {getMediaLabel()}
                </>
              )}
            </button>
          </form>
        </div>

        {/* INSTRUÇÕES */}
        <div className="bg-blue-500/10 border-2 border-blue-500/30 rounded-xl p-6">
          <h3 className="text-xl font-bold text-white mb-4">💡 Dicas Importantes:</h3>
          <ul className="space-y-2 text-white/80">
            <li>• A URL da mídia deve ser <strong>pública e acessível</strong></li>
            <li>• Tamanho máximo: <strong>Imagem 5MB, Vídeo 16MB, Documento 100MB</strong></li>
            <li>• Formatos aceitos: <strong>JPG, PNG, GIF (imagem) | MP4 (vídeo) | PDF, DOCX (documento) | MP3, OGG (áudio)</strong></li>
            <li>• O número deve incluir <strong>código do país + DDD + número</strong> (sem espaços ou caracteres especiais)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

