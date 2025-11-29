import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { FaArrowLeft, FaPaperPlane, FaPlus, FaTrash, FaImage, FaList, FaPoll, FaMousePointer, FaThList } from 'react-icons/fa';
import api from '@/services/api';

// Configuração da URL base da API
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || '${API_BASE_URL}/api').replace('/api', '');
import { uploadAPI } from '@/services/api';

interface UazInstance {
  id: number;
  name: string;
  session_name: string;
  status: string;
  is_active?: boolean;
}

type MenuType = 'button' | 'list' | 'poll' | 'carousel';

interface ButtonOption {
  id: string;
  text: string;
  type: 'REPLY' | 'URL' | 'CALL' | 'COPY';
  url?: string;
  phone_number?: string;
  copy_code?: string;
}

export default function EnviarMenu() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [instances, setInstances] = useState<UazInstance[]>([]);
  
  const [formData, setFormData] = useState({
    instance_id: '',
    number: '',
    type: 'button' as MenuType,
    text: '',
    footerText: '',
    listButton: 'Ver Opções',
    selectableCount: 1,
    imageButton: ''
  });

  const [choices, setChoices] = useState<string[]>(['']);
  const [buttons, setButtons] = useState<ButtonOption[]>([
    { id: Date.now().toString(), text: '', type: 'REPLY' }
  ]);
  const [uploadingImage, setUploadingImage] = useState(false);

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

  const handleTypeChange = (type: MenuType) => {
    setFormData({ ...formData, type });
    // Resetar choices quando mudar de tipo
    if (type === 'button') {
      setButtons([{ id: Date.now().toString(), text: '', type: 'REPLY' }]);
    } else if (type === 'poll') {
      setChoices(['', '', '']);
    } else if (type === 'list') {
      setChoices(['[Seção 1]', 'Item 1|id1|Descrição do item 1', '']);
    } else if (type === 'carousel') {
      setChoices(['[Título do Card]', '{URL_DA_IMAGEM}', 'Botão|copy:CODIGO', '']);
    }
  };

  // Funções para gerenciar botões (tipo button)
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

  const handleImageUpload = async (file: File) => {
    if (file.size > 16 * 1024 * 1024) {
      alert('❌ Arquivo muito grande! Máximo: 16MB');
      return;
    }

    setUploadingImage(true);
    try {
      const response = await uploadAPI.uploadMedia(file);
      const uploadedData = response.data.data;
      
      const imageUrl = uploadedData.url.startsWith('http') 
        ? uploadedData.url 
        : `${API_BASE_URL}${uploadedData.url}`;

      setFormData({ ...formData, imageButton: imageUrl });
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      alert('❌ Erro ao fazer upload da imagem');
    } finally {
      setUploadingImage(false);
    }
  };

  const getTypeIcon = (type: MenuType) => {
    switch (type) {
      case 'button': return <FaMousePointer className="text-2xl" />;
      case 'list': return <FaList className="text-2xl" />;
      case 'poll': return <FaPoll className="text-2xl" />;
      case 'carousel': return <FaThList className="text-2xl" />;
    }
  };

  const getTypeDescription = (type: MenuType) => {
    switch (type) {
      case 'button': return 'Botões de ação rápida (até 3 botões)';
      case 'list': return 'Menu organizado em seções';
      case 'poll': return 'Enquete com opções de votação';
      case 'carousel': return 'Cards com imagens e botões';
    }
  };

  const getPlaceholder = (type: MenuType, index: number) => {
    switch (type) {
      case 'button':
        return index === 0 
          ? 'Ex: Suporte|suporte ou Site|https://exemplo.com ou Ligar|call:+5511999999999'
          : 'Texto|id ou Texto|url:https:// ou Texto|call:+55... ou Texto|copy:CODIGO';
      case 'list':
        if (choices[index]?.startsWith('[')) return 'Ex: [Nome da Seção]';
        return 'Ex: Nome do Item|id|Descrição detalhada';
      case 'poll':
        return `Opção ${index + 1} da enquete`;
      case 'carousel':
        if (index === 0 || choices[index - 1]?.startsWith('{')) return 'Ex: [Título do Card\\nDescrição]';
        if (choices[index]?.startsWith('{')) return 'Ex: {https://exemplo.com/imagem.jpg}';
        return 'Ex: Botão|copy:CODIGO ou Botão|https://site.com ou Botão|call:+55...';
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

    if (formData.number.length < 12 || formData.number.length > 13) {
      alert('❌ Número inválido. Use o formato: 5562999999999 (com DDI + DDD)');
      return;
    }

    if (!formData.text) {
      alert('❌ Digite o texto principal');
      return;
    }

    // Preparar choices baseado no tipo
    let validChoices: string[] = [];

    if (formData.type === 'button') {
      // Validar e converter botões
      const validButtons = buttons.filter(btn => btn.text.trim() !== '');
      
      if (validButtons.length === 0) {
        alert('❌ Adicione pelo menos um botão');
        return;
      }

      if (validButtons.length > 3) {
        alert('❌ Máximo de 3 botões');
        return;
      }

      // Converter botões para formato de choices
      validChoices = validButtons.map(btn => {
        let choice = btn.text;
        
        switch (btn.type) {
          case 'URL':
            if (!btn.url) {
              alert(`❌ Botão "${btn.text}": URL é obrigatória`);
              throw new Error('URL missing');
            }
            choice += `|${btn.url}`;
            break;
          case 'CALL':
            if (!btn.phone_number) {
              alert(`❌ Botão "${btn.text}": Número de telefone é obrigatório`);
              throw new Error('Phone number missing');
            }
            choice += `|call:${btn.phone_number}`;
            break;
          case 'COPY':
            if (!btn.copy_code) {
              alert(`❌ Botão "${btn.text}": Código para copiar é obrigatório`);
              throw new Error('Copy code missing');
            }
            choice += `|copy:${btn.copy_code}`;
            break;
          case 'REPLY':
          default:
            choice += `|${btn.text}`;
            break;
        }
        
        return choice;
      });
    } else {
      // Para outros tipos, usar choices normais
      validChoices = choices.filter(c => c.trim() !== '');
      
      if (validChoices.length === 0) {
        alert('❌ Adicione pelo menos uma opção');
        return;
      }
    }

    if (formData.type === 'list' && !formData.listButton) {
      alert('❌ Digite o texto do botão da lista');
      return;
    }

    if (formData.type === 'poll' && validChoices.length < 2) {
      alert('❌ Enquetes precisam de pelo menos 2 opções');
      return;
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
      const payload: any = {
        number: formData.number,
        type: formData.type,
        text: formData.text,
        choices: validChoices
      };

      // Adicionar campos específicos por tipo
      if (formData.type === 'button') {
        if (formData.footerText) payload.footerText = formData.footerText;
        if (formData.imageButton) payload.imageButton = formData.imageButton;
      }

      if (formData.type === 'list') {
        payload.listButton = formData.listButton;
        if (formData.footerText) payload.footerText = formData.footerText;
      }

      if (formData.type === 'poll') {
        payload.selectableCount = formData.selectableCount;
      }

      console.log('📤 Enviando menu:', payload);

      const response = await api.post(
        `/uaz/instances/${formData.instance_id}/send-menu`,
        payload
      );

      if (response.data.success) {
        alert('✅ Menu enviado com sucesso!');
        
        // Limpar formulário
        setFormData({
          ...formData,
          number: '',
          text: '',
          footerText: '',
          imageButton: ''
        });
        setChoices(['']);
      } else {
        alert('❌ Erro ao enviar: ' + response.data.error);
      }
    } catch (error: any) {
      console.error('❌ Erro:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Erro desconhecido';
      alert(`❌ Erro ao enviar menu:\n\n${errorMessage}`);
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
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* CABEÇALHO */}
        <div className="bg-gradient-to-r from-blue-600/30 via-indigo-500/20 to-purple-600/30 backdrop-blur-xl border-2 border-blue-500/40 rounded-3xl p-10 shadow-2xl">
          <div className="flex items-center gap-6">
            <button
              onClick={() => router.push('/dashboard-uaz')}
              className="bg-white/10 hover:bg-white/20 p-4 rounded-xl transition-all duration-200 border-2 border-white/20 hover:border-white/40"
            >
              <FaArrowLeft className="text-3xl text-white" />
            </button>
            <div className="flex-1">
              <h1 className="text-4xl md:text-5xl font-black text-white mb-3">
                🎯 Enviar Menu Interativo
              </h1>
              <p className="text-xl text-white/80">
                Botões, Listas, Enquetes e Carousel
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
              Você precisa conectar uma instância antes de enviar menus.
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
                    className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-blue-500 transition-all"
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

            {/* TIPO DE MENU */}
            <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-2 border-blue-500/40 rounded-2xl p-8">
              <h2 className="text-2xl font-bold text-white mb-6">🎨 Tipo de Menu</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {(['button', 'list', 'poll', 'carousel'] as MenuType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleTypeChange(type)}
                    className={`p-6 rounded-xl border-2 transition-all ${
                      formData.type === type
                        ? 'bg-blue-500 border-blue-400 text-white'
                        : 'bg-white/5 border-white/20 text-white/70 hover:bg-white/10 hover:border-white/30'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-3">
                      {getTypeIcon(type)}
                      <p className="font-bold capitalize">{type}</p>
                      <p className="text-xs text-center">{getTypeDescription(type)}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* CONTEÚDO DO MENU */}
            <div className="bg-white/10 backdrop-blur-xl border-2 border-white/20 rounded-2xl p-8 space-y-6">
              <h2 className="text-2xl font-bold text-white mb-6">📝 Conteúdo do Menu</h2>

              {/* Texto Principal */}
              <div>
                <label className="block text-lg font-bold mb-3 text-white">
                  💬 Texto Principal
                </label>
                <textarea
                  required
                  rows={3}
                  className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-blue-500 transition-all resize-none"
                  placeholder="Digite o texto principal da mensagem..."
                  value={formData.text}
                  onChange={(e) => setFormData({ ...formData, text: e.target.value })}
                />
              </div>

              {/* Campos específicos por tipo */}
              {(formData.type === 'button' || formData.type === 'list') && (
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
              )}

              {formData.type === 'list' && (
                <div>
                  <label className="block text-lg font-bold mb-3 text-white">
                    🔘 Texto do Botão da Lista
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-blue-500 transition-all"
                    placeholder="Ex: Ver Opções, Ver Catálogo, Escolher..."
                    value={formData.listButton}
                    onChange={(e) => setFormData({ ...formData, listButton: e.target.value })}
                  />
                </div>
              )}

              {formData.type === 'poll' && (
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
              )}

              {formData.type === 'button' && (
                <div>
                  <label className="block text-lg font-bold mb-3 text-white flex items-center gap-2">
                    <FaImage /> Imagem dos Botões (Opcional)
                  </label>
                  
                  {!formData.imageButton ? (
                    <div className="relative">
                      <input
                        type="file"
                        id="button-image"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleImageUpload(file);
                        }}
                        disabled={uploadingImage}
                        className="hidden"
                      />
                      <label
                        htmlFor="button-image"
                        className={`block w-full px-6 py-6 bg-dark-700/80 border-2 border-dashed border-white/20 rounded-xl text-center cursor-pointer hover:border-blue-500 hover:bg-blue-500/5 transition-all ${
                          uploadingImage ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        {uploadingImage ? (
                          <div className="flex flex-col items-center gap-3">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-4 border-blue-500"></div>
                            <p className="text-white font-bold">Fazendo upload...</p>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-3">
                            <FaImage className="text-4xl text-blue-400" />
                            <p className="text-white font-bold">Clique para adicionar imagem</p>
                            <p className="text-white/60 text-sm">Opcional - Máx: 16MB</p>
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
                          onClick={() => setFormData({ ...formData, imageButton: '' })}
                          className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 rounded font-bold text-sm"
                        >
                          <FaTrash className="inline mr-1" /> Remover
                        </button>
                      </div>
                      <img
                        src={formData.imageButton}
                        alt="Preview"
                        className="max-w-full h-auto max-h-48 rounded-lg mx-auto object-contain"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* OPÇÕES/CHOICES */}
            <div className="bg-white/10 backdrop-blur-xl border-2 border-white/20 rounded-2xl p-8 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white">
                  📋 {formData.type === 'button' ? `Botões (${buttons.length}/3)` : `Opções (${choices.length})`}
                </h2>
                <button
                  type="button"
                  onClick={formData.type === 'button' ? addButton : addChoice}
                  disabled={formData.type === 'button' && buttons.length >= 3}
                  className={`px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl transition-all flex items-center gap-2 ${
                    formData.type === 'button' && buttons.length >= 3 ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  <FaPlus /> Adicionar {formData.type === 'button' ? 'Botão' : 'Opção'}
                </button>
              </div>

              {/* Dicas por tipo */}
              <div className="bg-blue-500/10 border-2 border-blue-500/40 rounded-xl p-4">
                <p className="text-blue-300 font-bold mb-2">💡 Dicas para {formData.type}:</p>
                {formData.type === 'button' && (
                  <ul className="text-white/80 text-sm space-y-1 list-disc list-inside">
                    <li>Máximo de 3 botões</li>
                    <li>Resposta: <code className="bg-black/30 px-2 py-1 rounded">Texto|id</code></li>
                    <li>URL: <code className="bg-black/30 px-2 py-1 rounded">Texto|https://site.com</code></li>
                    <li>Ligar: <code className="bg-black/30 px-2 py-1 rounded">Texto|call:+5511999999999</code></li>
                    <li>Copiar: <code className="bg-black/30 px-2 py-1 rounded">Texto|copy:CODIGO</code></li>
                  </ul>
                )}
                {formData.type === 'list' && (
                  <ul className="text-white/80 text-sm space-y-1 list-disc list-inside">
                    <li>Seção: <code className="bg-black/30 px-2 py-1 rounded">[Nome da Seção]</code></li>
                    <li>Item: <code className="bg-black/30 px-2 py-1 rounded">Texto|id|Descrição</code></li>
                  </ul>
                )}
                {formData.type === 'poll' && (
                  <ul className="text-white/80 text-sm space-y-1 list-disc list-inside">
                    <li>Digite cada opção da enquete</li>
                    <li>Mínimo 2 opções</li>
                  </ul>
                )}
                {formData.type === 'carousel' && (
                  <ul className="text-white/80 text-sm space-y-1 list-disc list-inside">
                    <li>Título: <code className="bg-black/30 px-2 py-1 rounded">[Título\nDescrição]</code></li>
                    <li>Imagem: <code className="bg-black/30 px-2 py-1 rounded">{'{'} URL ou base64{'}'}</code></li>
                    <li>Botões: <code className="bg-black/30 px-2 py-1 rounded">Texto|copy:CODE</code> ou URL ou CALL</li>
                  </ul>
                )}
              </div>

              {/* Lista de Botões (para type=button) */}
              {formData.type === 'button' ? (
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
                        {/* Tipo do Botão */}
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

                        {/* Texto do Botão */}
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

                      {/* Campos específicos por tipo */}
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
              ) : (
                /* Lista de Choices (para outros tipos) */
                <div className="space-y-3">
                  {choices.map((choice, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <div className="flex-1">
                        <input
                          type="text"
                          className="w-full px-4 py-3 bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-blue-500 transition-all"
                          placeholder={getPlaceholder(formData.type, index)}
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
              )}
            </div>

            {/* BOTÃO ENVIAR */}
            <button
              type="submit"
              disabled={sending}
              className={`w-full py-6 rounded-2xl font-bold text-2xl transition-all duration-300 flex items-center justify-center gap-4 ${
                sending
                  ? 'bg-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-2xl shadow-blue-500/50'
              }`}
            >
              {sending ? (
                <>
                  <div className="animate-spin rounded-full h-8 w-8 border-b-4 border-white"></div>
                  Enviando Menu...
                </>
              ) : (
                <>
                  <FaPaperPlane />
                  Enviar Menu Interativo
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

