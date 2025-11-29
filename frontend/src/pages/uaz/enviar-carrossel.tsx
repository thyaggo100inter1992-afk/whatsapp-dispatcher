import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { FaArrowLeft, FaPaperPlane, FaPlus, FaTrash, FaImage, FaLink, FaPhone, FaCopy, FaReply, FaList } from 'react-icons/fa';
import api from '@/services/api';
import { uploadAPI } from '@/services/api';

// Configuração da URL base da API
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || '${API_BASE_URL}/api').replace(/\/api$/, '');

interface UazInstance {
  id: number;
  name: string;
  session_name: string;
  status: string;
  is_active?: boolean;
}

interface Button {
  id: string;
  text: string;
  type: 'REPLY' | 'URL' | 'CALL' | 'COPY' | 'LIST';
  url?: string;
  phone_number?: string;
  copy_code?: string;
}

interface Card {
  id: string;
  text: string;
  image: string;
  buttons: Button[];
  uploadedImage?: any;
  uploadingImage: boolean;
}

export default function EnviarCarrossel() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [instances, setInstances] = useState<UazInstance[]>([]);
  
  const [formData, setFormData] = useState({
    instance_id: '',
    number: '',
    text: ''
  });

  const [cards, setCards] = useState<Card[]>([
    {
      id: Date.now().toString(),
      text: '',
      image: '',
      buttons: [],
      uploadingImage: false
    }
  ]);

  useEffect(() => {
    loadInstances();
  }, []);

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
    // Validar tamanho
    if (file.size > 16 * 1024 * 1024) {
      alert('❌ Arquivo muito grande! Máximo: 16MB');
      return;
    }

    // Atualizar estado de upload
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

  const addButton = (cardId: string) => {
    const card = cards.find(c => c.id === cardId);
    if (card && card.buttons.length >= 3) {
      alert('❌ Máximo de 3 botões por card');
      return;
    }

    const newButton: Button = {
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

  const removeButton = (cardId: string, buttonId: string) => {
    setCards(cards.map(card => 
      card.id === cardId 
        ? { ...card, buttons: card.buttons.filter(btn => btn.id !== buttonId) }
        : card
    ));
  };

  const updateButton = (cardId: string, buttonId: string, field: string, value: any) => {
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

  const getButtonIcon = (type: string) => {
    switch (type) {
      case 'REPLY': return <FaReply />;
      case 'URL': return <FaLink />;
      case 'CALL': return <FaPhone />;
      case 'COPY': return <FaCopy />;
      case 'LIST': return <FaList />;
      default: return <FaReply />;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.instance_id) {
      alert('❌ Selecione uma instância');
      return;
    }

    if (!formData.number) {
      alert('❌ Digite o número de destino');
      return;
    }

    // Validar formato do número
    if (formData.number.length < 12 || formData.number.length > 13) {
      alert('❌ Número inválido. Use o formato: 5562999999999 (com DDI + DDD)');
      return;
    }

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

    // ✅ VERIFICAR STATUS DA INSTÂNCIA EM TEMPO REAL ANTES DE ENVIAR
    console.log('🔍 Verificando status da instância em tempo real antes de enviar...');
    setSending(true);
    
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
      // Preparar payload
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
        }))
      };

      console.log('📤 Enviando carrossel:', carouselData);

      const response = await api.post(
        `/uaz/instances/${formData.instance_id}/send-carousel`,
        carouselData
      );

      if (response.data.success) {
        alert('✅ Carrossel enviado com sucesso!');
        
        // Limpar formulário
        setFormData({
          ...formData,
          number: '',
          text: ''
        });
        
        // Resetar cards
        setCards([{
          id: Date.now().toString(),
          text: '',
          image: '',
          buttons: [],
          uploadingImage: false
        }]);
      } else {
        alert('❌ Erro ao enviar: ' + response.data.error);
      }
    } catch (error: any) {
      console.error('❌ Erro:', error);
      console.error('❌ Response:', error.response);
      
      let errorMessage = 'Erro desconhecido';
      
      if (error.response?.data) {
        errorMessage = error.response.data.error || error.response.data.message || 'Erro no servidor';
        
        // Se houver detalhes adicionais, mostrar também
        if (error.response.data.details) {
          console.error('❌ Detalhes do erro:', error.response.data.details);
          errorMessage += '\n\nDetalhes: ' + JSON.stringify(error.response.data.details, null, 2);
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      alert(`❌ Erro ao enviar carrossel:\n\n${errorMessage}`);
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
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* CABEÇALHO */}
        <div className="bg-gradient-to-r from-purple-600/30 via-pink-500/20 to-purple-600/30 backdrop-blur-xl border-2 border-purple-500/40 rounded-3xl p-10 shadow-2xl">
          <div className="flex items-center gap-6">
            <button
              onClick={() => router.push('/dashboard-uaz')}
              className="bg-white/10 hover:bg-white/20 p-4 rounded-xl transition-all duration-200 border-2 border-white/20 hover:border-white/40"
            >
              <FaArrowLeft className="text-3xl text-white" />
            </button>
            <div className="flex-1">
              <h1 className="text-4xl md:text-5xl font-black text-white mb-3">
                🎠 Enviar Carrossel
              </h1>
              <p className="text-xl text-white/80">
                Envie carrosseis interativos com imagens e botões
              </p>
            </div>
          </div>
        </div>

        {instances.length === 0 ? (
          <div className="bg-red-500/10 border-2 border-red-500/40 rounded-2xl p-8 text-center">
            <p className="text-2xl font-bold text-red-300 mb-4">
              ⚠️ Nenhuma Instância Conectada
            </p>
            <p className="text-white/70 mb-6">
              Você precisa conectar uma instância do WhatsApp QR Connect antes de enviar carrosseis.
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
            
            {/* CONFIGURAÇÕES BÁSICAS */}
            <div className="bg-white/10 backdrop-blur-xl border-2 border-white/20 rounded-2xl p-8 space-y-6">
              <h2 className="text-2xl font-bold text-white mb-6">⚙️ Configurações Básicas</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Instância */}
                <div>
                  <label className="block text-lg font-bold mb-3 text-white">
                    📱 Instância WhatsApp
                  </label>
                  <select
                    required
                    className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-purple-500 transition-all"
                    value={formData.instance_id}
                    onChange={(e) => setFormData({ ...formData, instance_id: e.target.value })}
                  >
                    {instances.map((inst) => (
                      <option key={inst.id} value={inst.id}>
                        {inst.name} ({inst.session_name})
                      </option>
                    ))}
                  </select>
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
                    className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-purple-500 transition-all"
                    value={formData.number}
                    onChange={(e) => setFormData({ ...formData, number: e.target.value.replace(/\D/g, '') })}
                  />
                  <p className="text-sm text-white/50 mt-2">
                    Use DDI + DDD + Número (Ex: 5562999999999)
                  </p>
                </div>
              </div>

              {/* Texto Principal */}
              <div>
                <label className="block text-lg font-bold mb-3 text-white">
                  💬 Texto Principal (Opcional)
                </label>
                <textarea
                  rows={3}
                  className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-purple-500 transition-all resize-none"
                  placeholder="Texto que aparece antes do carrossel..."
                  value={formData.text}
                  onChange={(e) => setFormData({ ...formData, text: e.target.value })}
                />
              </div>
            </div>

            {/* CARDS DO CARROSSEL */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white">🎴 Cards do Carrossel ({cards.length})</h2>
                <button
                  type="button"
                  onClick={addCard}
                  className="px-6 py-3 bg-purple-500 hover:bg-purple-600 text-white font-bold rounded-xl transition-all flex items-center gap-2"
                >
                  <FaPlus /> Adicionar Card
                </button>
              </div>

              {cards.map((card, cardIndex) => (
                <div key={card.id} className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-2 border-purple-500/40 rounded-2xl p-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-white">Card #{cardIndex + 1}</h3>
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

                  {/* Texto do Card */}
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

                  {/* Imagem do Card */}
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
                              <p className="text-white/60 text-sm">
                                📷 Imagem (Máx: 16MB)
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
                              updateCard(card.id, 'image', '');
                              updateCard(card.id, 'uploadedImage', null);
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
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-base font-bold text-white">
                        🔘 Botões do Card ({card.buttons.length}/3)
                      </label>
                      {card.buttons.length < 3 && (
                        <button
                          type="button"
                          onClick={() => addButton(card.id)}
                          className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border-2 border-blue-500/40 rounded-lg font-bold transition-all flex items-center gap-2 text-sm"
                        >
                          <FaPlus /> Adicionar Botão
                        </button>
                      )}
                    </div>

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
                                onClick={() => removeButton(card.id, button.id)}
                                className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 rounded font-bold text-sm"
                              >
                                <FaTrash />
                              </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {/* Tipo do Botão */}
                              <div>
                                <label className="block text-sm font-bold mb-1 text-white/80">
                                  Tipo
                                </label>
                                <select
                                  required
                                  className="w-full px-3 py-2 bg-dark-700 border border-white/20 rounded-lg text-white text-sm focus:border-purple-500"
                                  value={button.type}
                                  onChange={(e) => updateButton(card.id, button.id, 'type', e.target.value)}
                                >
                                  <option value="REPLY">↩️ Resposta Rápida</option>
                                  <option value="URL">🔗 Link (URL)</option>
                                  <option value="CALL">📞 Ligar</option>
                                  <option value="COPY">📋 Copiar Código</option>
                                </select>
                              </div>

                              {/* Texto do Botão */}
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
                                  onChange={(e) => updateButton(card.id, button.id, 'text', e.target.value)}
                                />
                              </div>
                            </div>

                            {/* Campos específicos por tipo */}
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
                                  onChange={(e) => updateButton(card.id, button.id, 'url', e.target.value)}
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
                                  onChange={(e) => updateButton(card.id, button.id, 'phone_number', e.target.value.replace(/\D/g, ''))}
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
                                  onChange={(e) => updateButton(card.id, button.id, 'copy_code', e.target.value)}
                                />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* BOTÃO ENVIAR */}
            <button
              type="submit"
              disabled={sending}
              className={`w-full py-6 rounded-2xl font-bold text-2xl transition-all duration-300 flex items-center justify-center gap-4 ${
                sending
                  ? 'bg-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-2xl shadow-purple-500/50'
              }`}
            >
              {sending ? (
                <>
                  <div className="animate-spin rounded-full h-8 w-8 border-b-4 border-white"></div>
                  Enviando Carrossel...
                </>
              ) : (
                <>
                  <FaPaperPlane />
                  Enviar Carrossel
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

