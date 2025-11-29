import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { 
  FaPlus, FaEdit, FaTrash, FaQrcode, FaCheckCircle, FaTimesCircle,
  FaSpinner, FaArrowLeft, FaSync, FaCog, FaWhatsapp, FaExclamationTriangle,
  FaTrashAlt, FaInfoCircle
} from 'react-icons/fa';
import api from '@/services/api';

interface UazInstance {
  id: number;
  name: string;
  session_name: string;
  instance_token?: string;
  phone_number?: string;
  profile_name?: string;
  is_connected: boolean;
  status: string;
  webhook_url?: string;
  proxy_id?: number;
  proxy_name?: string;
  is_active: boolean;
  created_at: string;
}

interface Proxy {
  id: number;
  name: string;
  host: string;
  port: number;
  type: string;
}

export default function ConfiguracoesUaz() {
  const router = useRouter();
  const [instances, setInstances] = useState<UazInstance[]>([]);
  const [proxies, setProxies] = useState<Proxy[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingInstance, setEditingInstance] = useState<UazInstance | null>(null);
  const [checkingStatus, setCheckingStatus] = useState<number | null>(null);
  const [syncingProfile, setSyncingProfile] = useState(false);
  const [activeTab, setActiveTab] = useState<'instance' | 'profile'>('instance');
  const [profileImage, setProfileImage] = useState<string>('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [currentProfilePicUrl, setCurrentProfilePicUrl] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewImage, setPreviewImage] = useState<string>('');

  const [formData, setFormData] = useState({
    name: '',
    session_name: '',
    instance_token: '',
    webhook_url: '',
    proxy_id: null as number | null,
    is_active: true,
    profile_name: ''
  });

  useEffect(() => {
    loadInstances();
    loadProxies();
  }, []);

  const loadInstances = async () => {
    try {
      const response = await api.get('/uaz/instances');
      if (response.data.success) {
        setInstances(response.data.data);
      }
    } catch (error) {
      console.error('Erro ao carregar instâncias:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProxies = async () => {
    try {
      const response = await api.get('/proxies/active');
      if (response.data.success) {
        setProxies(response.data.data);
      }
    } catch (error) {
      console.error('Erro ao carregar proxies:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingInstance) {
        // Verifica se está alterando o profile_name
        const isChangingProfileName = formData.profile_name && 
                                      formData.profile_name.trim() !== '' && 
                                      formData.profile_name !== editingInstance.profile_name;
        
        if (isChangingProfileName) {
          console.log('⏳ Aguardando sincronização do nome do perfil...');
        }
        
        const response = await api.put(`/uaz/instances/${editingInstance.id}`, formData);
        
        // Mostra mensagem específica se atualizou o profile_name
        if (response.data.message) {
          alert(`✅ ${response.data.message}`);
        } else {
          alert('✅ Instância atualizada com sucesso!');
        }
      } else {
        await api.post('/uaz/instances', formData);
        alert('✅ Instância criada com sucesso!');
      }
      
      await loadInstances();
      resetForm();
    } catch (error: any) {
      alert('❌ Erro: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleEdit = async (instance: UazInstance) => {
    setEditingInstance(instance);
    setActiveTab('instance'); // Sempre começa na aba "Instância"
    
    // Carrega dados básicos primeiro
    setFormData({
      name: instance.name,
      session_name: instance.session_name,
      instance_token: instance.instance_token || '',
      webhook_url: instance.webhook_url || '',
      proxy_id: instance.proxy_id || null,
      is_active: instance.is_active,
      profile_name: instance.profile_name || ''
    });
    
    console.log('📋 Dados iniciais da instância:', {
      id: instance.id,
      name: instance.name,
      profile_name: instance.profile_name,
      is_connected: instance.is_connected
    });
    
    setShowForm(true);
    
    // Limpa estados de imagem
    setProfileImage('');
    setSelectedFile(null);
    setPreviewImage('');
    setCurrentProfilePicUrl('');
    
    // Busca nome do perfil e foto atual do WhatsApp (se estiver conectado)
    if (instance.is_connected && instance.instance_token) {
      try {
        console.log('🔍 Buscando dados do perfil atual do WhatsApp...');
        const statusResponse = await api.get(`/uaz/instances/${instance.id}/status`);
        
        console.log('📦 Resposta completa do status:', statusResponse.data);
        
        if (statusResponse.data.success) {
          // Busca profileName de acordo com a documentação UAZ API
          // Backend retorna em: response.data.profile_name (adicionado pelo backend)
          // Ou em: response.data.data.instance.profileName (resposta original da API)
                const profileName = statusResponse.data.profile_name ||
                                   statusResponse.data.data?.instance?.profileName ||
                                   null;
                
                // Busca URL da foto do perfil (profilePicUrl)
                const profilePicUrl = statusResponse.data.data?.instance?.profilePicUrl || 
                                     statusResponse.data.data?.instance?.profile_pic_url ||
                                     null;
                
                console.log('🔍 Estrutura da resposta de status:');
                console.log('   ├─ profile_name (backend):', statusResponse.data.profile_name);
                console.log('   ├─ data.instance.profileName (API):', statusResponse.data.data?.instance?.profileName);
                console.log('   ├─ data.instance.profilePicUrl (API):', profilePicUrl);
                console.log('   └─ 🎯 Profile name final:', profileName);
                
                if (profileName) {
                  console.log('✅ Nome do perfil atual:', profileName);
                  
                  // Atualiza o formData com o nome do perfil atual
                  setFormData(prev => ({
                    ...prev,
                    profile_name: profileName
                  }));
                } else {
                  console.log('ℹ️ Nome do perfil não disponível na resposta');
                  console.log('📋 Estrutura da resposta:', JSON.stringify(statusResponse.data, null, 2));
                }
                
                if (profilePicUrl) {
                  console.log('✅ URL da foto do perfil:', profilePicUrl);
                  setCurrentProfilePicUrl(profilePicUrl);
                  setPreviewImage(profilePicUrl);
                } else {
                  console.log('ℹ️ Foto do perfil não disponível');
                }
        }
      } catch (error: any) {
        console.warn('⚠️ Não foi possível buscar nome do perfil:', error.message);
        console.warn('   Usando o nome salvo no banco:', instance.profile_name || 'nenhum');
        // Não mostra erro para o usuário, apenas usa o que está no banco
      }
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir esta instância?')) return;
    
    try {
      await api.delete(`/uaz/instances/${id}`);
      alert('✅ Instância excluída com sucesso!');
      await loadInstances();
    } catch (error: any) {
      alert('❌ Erro ao excluir: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleCheckStatus = async (id: number) => {
    setCheckingStatus(id);
    try {
      const response = await api.get(`/uaz/instances/${id}/status`);
      if (response.data.success) {
        alert('✅ Status atualizado!');
        await loadInstances();
      } else {
        alert('⚠️ ' + response.data.error);
      }
    } catch (error: any) {
      alert('❌ Erro: ' + (error.response?.data?.error || error.message));
    } finally {
      setCheckingStatus(null);
    }
  };

  const handleDisconnect = async (id: number) => {
    if (!confirm('Deseja desconectar esta instância?')) return;
    
    try {
      await api.post(`/uaz/instances/${id}/disconnect`);
      alert('✅ Instância desconectada!');
      await loadInstances();
    } catch (error: any) {
      alert('❌ Erro: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Valida tipo de arquivo
    if (!file.type.startsWith('image/')) {
      alert('⚠️ Por favor, selecione uma imagem válida');
      return;
    }

    // Valida tamanho (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('⚠️ A imagem deve ter no máximo 5MB');
      return;
    }

    setSelectedFile(file);

    // Cria preview da imagem
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setPreviewImage(base64String);
      setProfileImage(base64String); // Define no campo de URL também
    };
    reader.readAsDataURL(file);
  };

  const handleSyncProfile = async () => {
    if (!editingInstance) return;
    
    setSyncingProfile(true);
    try {
      console.log('🔄 Sincronizando nome do perfil...');
      const response = await api.put(`/uaz/instances/${editingInstance.id}/sync-profile`);
      
      console.log('📦 Resposta da sincronização:', response.data);
      
      if (response.data.success) {
        const newProfileName = response.data.profile_name;
        console.log('✅ Nome sincronizado:', newProfileName);
        
        // Atualiza o formData com o nome sincronizado
        setFormData(prev => ({
          ...prev,
          profile_name: newProfileName
        }));
        
        alert(`✅ Nome sincronizado: ${newProfileName}`);
        await loadInstances();
      } else {
        alert('⚠️ ' + response.data.error);
      }
    } catch (error: any) {
      console.error('❌ Erro completo:', error);
      alert('❌ Erro ao sincronizar: ' + (error.response?.data?.error || error.message));
    } finally {
      setSyncingProfile(false);
    }
  };

  const handleDeleteAll = async () => {
    if (instances.length === 0) {
      alert('⚠️ Não há instâncias para excluir');
      return;
    }

    const confirmMessage = `⚠️ ATENÇÃO: Você está prestes a excluir TODAS as ${instances.length} conexões!\n\n` +
      `Isso irá:\n` +
      `✗ Deletar permanentemente da API UAZ (WhatsApp)\n` +
      `✗ Remover do banco de dados local\n` +
      `✗ Requerer novo QR code para reconectar\n\n` +
      `Esta ação NÃO pode ser desfeita!\n\n` +
      `Digite "EXCLUIR TUDO" para confirmar:`;

    const confirmation = prompt(confirmMessage);
    
    if (confirmation !== 'EXCLUIR TUDO') {
      alert('❌ Operação cancelada. Digite exatamente "EXCLUIR TUDO" para confirmar.');
      return;
    }

    try {
      const response = await api.delete('/uaz/instances/delete-all');
      alert(`✅ ${response.data.deleted} conexão(ões) excluída(s) com sucesso!`);
      await loadInstances();
    } catch (error: any) {
      alert('❌ Erro ao excluir: ' + (error.response?.data?.error || error.message));
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      session_name: '',
      instance_token: '',
      webhook_url: '',
      proxy_id: null,
      is_active: true,
      profile_name: ''
    });
    setEditingInstance(null);
    setShowForm(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-20 w-20 border-b-4 border-blue-500 mb-4"></div>
          <p className="text-2xl text-white/70">Carregando configurações...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 py-8 px-4">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* CABEÇALHO */}
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-600/30 via-indigo-500/20 to-blue-600/30 backdrop-blur-xl border-2 border-blue-500/40 rounded-3xl p-10 shadow-2xl shadow-blue-500/20">
          <div className="relative flex items-center justify-between flex-wrap gap-6">
            <div className="flex items-center gap-6">
              <button
                onClick={() => router.push('/dashboard-uaz')}
                className="bg-white/10 hover:bg-white/20 p-4 rounded-xl transition-all duration-200 border-2 border-white/20 hover:border-white/40"
              >
                <FaArrowLeft className="text-3xl text-white" />
              </button>
              
              <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-6 rounded-2xl shadow-lg shadow-blue-500/50">
                <FaCog className="text-5xl text-white" />
              </div>
              <div>
                <h1 className="text-5xl font-black text-white tracking-tight mb-2">
                  Gerenciar Conexões
                </h1>
                <p className="text-xl text-white/80 font-medium">
                  WhatsApp QR Connect - Configure suas instâncias
                </p>
              </div>
            </div>
            
            <div className="flex gap-4">
              <button
                onClick={() => setShowForm(!showForm)}
                className={`flex items-center gap-3 px-8 py-4 rounded-xl font-bold transition-all duration-200 shadow-lg ${
                  showForm 
                    ? 'bg-red-500/20 hover:bg-red-500/30 text-red-300 border-2 border-red-500/40' 
                    : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-blue-500/30 transform hover:scale-105'
                }`}
              >
                {showForm ? <FaTimesCircle className="text-xl" /> : <FaPlus className="text-xl" />}
                {showForm ? 'Cancelar' : 'Nova Instância'}
              </button>

              {instances.length > 0 && (
                <button
                  onClick={handleDeleteAll}
                  className="flex items-center gap-3 px-8 py-4 rounded-xl font-bold transition-all duration-200 shadow-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 border-2 border-red-500/40 transform hover:scale-105"
                  title="Excluir todas as conexões"
                >
                  <FaTrashAlt className="text-xl" />
                  Excluir Todas
                </button>
              )}
            </div>
          </div>
        </div>

        {/* BANNER DE AVISO - 90 DIAS */}
        <div className="relative overflow-hidden bg-gradient-to-r from-yellow-600/30 via-orange-500/20 to-yellow-600/30 backdrop-blur-xl border-2 border-yellow-500/50 rounded-2xl p-6 shadow-xl">
          <div className="flex items-start gap-4">
            <div className="bg-yellow-500/30 p-4 rounded-xl">
              <FaInfoCircle className="text-3xl text-yellow-300" />
            </div>
            <div className="flex-1">
              <h3 className="text-2xl font-black text-white mb-2 flex items-center gap-2">
                <FaExclamationTriangle className="text-yellow-300" />
                Política de Retenção de Conexões
              </h3>
              <p className="text-lg text-white/90 leading-relaxed mb-2">
                ⏰ <strong>Conexões desconectadas há mais de 90 dias serão excluídas da plataforma.</strong>
              </p>
              <p className="text-white/80">
                Para manter suas conexões ativas, certifique-se de usá-las regularmente. Conexões desconectadas por 90 dias ou mais devem ser removidas da plataforma.
              </p>
              <div className="mt-4 flex items-center gap-4 text-sm">
                <span className="bg-yellow-500/20 px-4 py-2 rounded-lg border border-yellow-500/40 text-yellow-200 font-bold">
                  📅 Período: 90 dias desconectada
                </span>
                <span className="bg-red-500/20 px-4 py-2 rounded-lg border border-red-500/40 text-red-200 font-bold">
                  🗑️ Exclusão Permanente
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* FORMULÁRIO */}
        {showForm && (
          <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-blue-500/40 rounded-2xl p-8 shadow-2xl">
            <h2 className="text-3xl font-black mb-8 flex items-center gap-3">
              <div className="bg-blue-500/20 p-3 rounded-xl">
                {editingInstance ? <FaEdit className="text-2xl text-blue-400" /> : <FaPlus className="text-2xl text-blue-400" />}
              </div>
              {editingInstance ? 'Editar Conexão' : 'Nova Instância'}
            </h2>

            {/* TABS - Apenas ao editar */}
            {editingInstance && (
              <div className="flex gap-2 mb-6 border-b-2 border-white/10">
                <button
                  type="button"
                  onClick={() => setActiveTab('instance')}
                  className={`px-6 py-3 font-bold transition-all rounded-t-xl ${
                    activeTab === 'instance'
                      ? 'bg-blue-500/30 text-blue-300 border-b-4 border-blue-500'
                      : 'bg-dark-700/40 text-white/60 hover:bg-dark-700/60 hover:text-white'
                  }`}
                >
                  ⚙️ Configurações da Instância
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('profile')}
                  disabled={!editingInstance?.is_connected}
                  className={`px-6 py-3 font-bold transition-all rounded-t-xl ${
                    activeTab === 'profile'
                      ? 'bg-purple-500/30 text-purple-300 border-b-4 border-purple-500'
                      : 'bg-dark-700/40 text-white/60 hover:bg-dark-700/60 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed'
                  }`}
                  title={!editingInstance?.is_connected ? 'Conecte a instância primeiro para editar o perfil' : ''}
                >
                  👤 Perfil do WhatsApp (API)
                </button>
              </div>
            )}
            
            <form onSubmit={handleSubmit}>
              {/* ABA: CONFIGURAÇÕES DA INSTÂNCIA */}
              {(!editingInstance || activeTab === 'instance') && (
                <div className="grid md:grid-cols-2 gap-6">
                  <div className={editingInstance ? "md:col-span-2" : ""}>
                    <label className="block text-lg font-bold mb-3 text-white">
                      {editingInstance ? '✏️ Nome da Conexão *' : 'Nome da Conexão *'}
                    </label>
                    <input
                      type="text"
                      required
                      className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/30 transition-all"
                      placeholder="Ex: Marketing Principal"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                    {editingInstance && (
                      <p className="text-sm text-green-400 mt-2 flex items-center gap-2">
                        <span>✅</span>
                        <span>
                          Ao alterar o nome, será atualizado automaticamente no WhatsApp (API UAZ)
                        </span>
                      </p>
                    )}
                  </div>

                {!editingInstance && (
                  <div>
                    <label className="block text-lg font-bold mb-3 text-white">
                      Nome da Sessão (único) *
                    </label>
                    <input
                      type="text"
                      required
                      className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/30 transition-all"
                      placeholder="Ex: marketing01"
                      value={formData.session_name}
                      onChange={(e) => setFormData({ ...formData, session_name: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '') })}
                    />
                    <p className="text-sm text-blue-300 mt-2 flex items-start gap-2">
                      <span>💡</span>
                      <span>
                        ID único para esta conexão. Não poderá ser alterado depois.
                      </span>
                    </p>
                  </div>
                )}

                <div className="md:col-span-2">
                  <label className="block text-lg font-bold mb-3 text-white">
                    🔑 Token da Instância (Opcional)
                  </label>
                  <input
                    type="text"
                    className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/30 transition-all font-mono"
                    placeholder="Ex: 56f72520-17f3-4050-82b9-be92538c9156"
                    value={formData.instance_token}
                    onChange={(e) => setFormData({ ...formData, instance_token: e.target.value.trim() })}
                  />
                  <p className="text-sm text-blue-300 mt-2 flex items-start gap-2">
                    <span>💡</span>
                    <span>
                      Deixe em branco para criar automaticamente. Ou cole um token existente do <a href="https://nettsistemas.uazapi.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-400">UAZ GO</a>.
                    </span>
                  </p>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-lg font-bold mb-3 text-white">
                    Webhook URL (opcional)
                  </label>
                  <input
                    type="url"
                    className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/30 transition-all"
                    placeholder="https://seu-servidor.com/webhook"
                    value={formData.webhook_url}
                    onChange={(e) => setFormData({ ...formData, webhook_url: e.target.value })}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-lg font-bold mb-3 text-white flex items-center gap-2">
                    🌐 Proxy (opcional)
                  </label>
                  <select
                    className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/30 transition-all"
                    value={formData.proxy_id || ''}
                    onChange={(e) => setFormData({ ...formData, proxy_id: e.target.value ? parseInt(e.target.value) : null })}
                  >
                    <option value="">Sem Proxy</option>
                    {proxies.map(proxy => (
                      <option key={proxy.id} value={proxy.id}>
                        {proxy.name} ({proxy.host}:{proxy.port}) - {proxy.type === 'rotating' ? '🔄 Rotativo' : '📍 Fixo'}
                      </option>
                    ))}
                  </select>
                </div>

                  <div className="md:col-span-2">
                    <label className="flex items-center gap-3 cursor-pointer p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-all">
                      <input
                        type="checkbox"
                        checked={formData.is_active}
                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                        className="w-6 h-6 rounded border-2 border-white/20"
                      />
                      <span className="text-lg font-bold">✅ Ativar esta instância</span>
                    </label>
                  </div>
                </div>
              )}

              {/* ABA: PERFIL DO WHATSAPP (SOMENTE EDITÁVEIS VIA API) */}
              {editingInstance && activeTab === 'profile' && (
                <div className="grid md:grid-cols-1 gap-6">
                  <div className="bg-purple-500/10 border-2 border-purple-500/30 rounded-xl p-6">
                    <h3 className="text-2xl font-bold text-purple-300 mb-4 flex items-center gap-2">
                      <span>👤</span>
                      <span>Perfil do WhatsApp - Editável via API</span>
                    </h3>
                    <p className="text-white/70 mb-6">
                      Estas configurações são alteradas diretamente no WhatsApp através da API UAZ.
                      <strong className="text-yellow-300"> A instância deve estar conectada.</strong>
                    </p>
                  </div>

                  {/* Nome do Perfil */}
                  <div>
                    <label className="block text-lg font-bold mb-3 text-white">
                      ✏️ Nome do Perfil do WhatsApp
                    </label>
                    <div className="flex gap-3">
                      <input
                        type="text"
                        className="flex-1 px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-purple-500 focus:ring-4 focus:ring-purple-500/30 transition-all"
                        placeholder="Ex: Minha Empresa - Atendimento"
                        value={formData.profile_name}
                        onChange={(e) => setFormData({ ...formData, profile_name: e.target.value })}
                        maxLength={25}
                      />
                      <button
                        type="button"
                        onClick={handleSyncProfile}
                        disabled={syncingProfile || !editingInstance?.is_connected}
                        className="px-6 py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
                        title={!editingInstance?.is_connected ? "Conecte a instância primeiro" : "Sincronizar nome do perfil do WhatsApp"}
                      >
                        {syncingProfile ? (
                          <>
                            <FaSpinner className="animate-spin" />
                            Sincronizando...
                          </>
                        ) : (
                          <>
                            <FaSync />
                            Sincronizar
                          </>
                        )}
                      </button>
                    </div>
                    <p className="text-sm text-purple-300 mt-2 flex items-center gap-2">
                      <span>💬</span>
                      <span>
                        Este é o nome que aparece no WhatsApp para seus contatos (máximo 25 caracteres).
                        Use o botão "Sincronizar" para buscar o nome atual do WhatsApp.
                      </span>
                    </p>
                    <p className="text-xs text-yellow-300 mt-1 flex items-center gap-2">
                      <span>⏳</span>
                      <span>
                        Ao salvar, o sistema aguarda 3 segundos para sincronizar o nome atualizado.
                      </span>
                    </p>
                  </div>

                  {/* Foto do Perfil */}
                  <div>
                    <label className="block text-lg font-bold mb-3 text-white">
                      📸 Foto do Perfil do WhatsApp
                    </label>
                    
                    {/* Preview da Foto Atual/Selecionada */}
                    {previewImage && (
                      <div className="mb-4 flex justify-center">
                        <div className="relative">
                          <img 
                            src={previewImage} 
                            alt="Preview do perfil"
                            className="w-32 h-32 rounded-full object-cover border-4 border-purple-500 shadow-lg"
                            onError={(e) => {
                              console.error('Erro ao carregar imagem:', previewImage);
                              e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="128" height="128"%3E%3Crect fill="%23333" width="128" height="128"/%3E%3Ctext fill="%23fff" font-size="48" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3E?%3C/text%3E%3C/svg%3E';
                            }}
                          />
                          <div className="absolute -bottom-2 -right-2 bg-purple-600 rounded-full p-2">
                            <span className="text-xl">📸</span>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div className="space-y-4">
                      {/* Upload de Arquivo */}
                      <div>
                        <label className="block text-sm font-bold mb-2 text-purple-300">
                          📁 Selecionar do Computador:
                        </label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileSelect}
                          className="w-full px-4 py-3 text-base bg-dark-700/80 border-2 border-purple-500/40 rounded-xl text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-700 file:cursor-pointer cursor-pointer"
                        />
                        <p className="text-xs text-white/60 mt-1">
                          📌 Formatos aceitos: JPG, PNG, GIF (máx 5MB)
                        </p>
                      </div>
                      
                      {/* OU separador */}
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-px bg-white/20"></div>
                        <span className="text-white/60 font-bold">OU</span>
                        <div className="flex-1 h-px bg-white/20"></div>
                      </div>
                      
                      {/* URL da Imagem */}
                      <div>
                        <label className="block text-sm font-bold mb-2 text-purple-300">
                          🔗 Cole a URL da imagem:
                        </label>
                        <input
                          type="url"
                          className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-purple-500 focus:ring-4 focus:ring-purple-500/30 transition-all"
                          placeholder="https://example.com/foto.jpg"
                          value={profileImage.startsWith('data:') ? '' : profileImage}
                          onChange={(e) => {
                            setProfileImage(e.target.value);
                            if (e.target.value) {
                              setPreviewImage(e.target.value);
                              setSelectedFile(null);
                            }
                          }}
                        />
                      </div>
                      
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={async () => {
                            if (!profileImage.trim()) {
                              alert('⚠️ Selecione uma imagem ou cole uma URL primeiro');
                              return;
                            }
                            if (!editingInstance?.instance_token) return;
                            
                            setUploadingImage(true);
                            try {
                              await api.post(`/uaz/instances/${editingInstance.id}/profile-image`, {
                                image: profileImage
                              });
                              alert('✅ Foto do perfil atualizada com sucesso!');
                              
                              // Mantém o preview da imagem enviada
                              setCurrentProfilePicUrl(profileImage);
                              
                              // Limpa seleção de arquivo
                              setSelectedFile(null);
                              
                              // Busca status atualizado para confirmar
                              setTimeout(async () => {
                                try {
                                  const statusResponse = await api.get(`/uaz/instances/${editingInstance.id}/status`);
                                  const newPicUrl = statusResponse.data.data?.instance?.profilePicUrl;
                                  if (newPicUrl) {
                                    setCurrentProfilePicUrl(newPicUrl);
                                    setPreviewImage(newPicUrl);
                                  }
                                } catch (err) {
                                  console.warn('Não foi possível buscar foto atualizada:', err);
                                }
                              }, 2000);
                            } catch (error: any) {
                              alert('❌ Erro: ' + (error.response?.data?.error || error.message));
                            } finally {
                              setUploadingImage(false);
                            }
                          }}
                          disabled={uploadingImage || !editingInstance?.is_connected || !profileImage}
                          className="flex-1 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          {uploadingImage ? (
                            <>
                              <FaSpinner className="animate-spin" />
                              Enviando...
                            </>
                          ) : (
                            <>
                              📤 Atualizar Foto
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!confirm('Tem certeza que deseja remover a foto do perfil?')) return;
                            if (!editingInstance?.instance_token) return;
                            
                            setUploadingImage(true);
                            try {
                              await api.post(`/uaz/instances/${editingInstance.id}/profile-image`, {
                                image: 'remove'
                              });
                              alert('✅ Foto do perfil removida com sucesso!');
                              
                              // Limpa todos os estados de imagem
                              setProfileImage('');
                              setSelectedFile(null);
                              setPreviewImage('');
                              setCurrentProfilePicUrl('');
                            } catch (error: any) {
                              alert('❌ Erro: ' + (error.response?.data?.error || error.message));
                            } finally {
                              setUploadingImage(false);
                            }
                          }}
                          disabled={uploadingImage || !editingInstance?.is_connected}
                          className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          {uploadingImage ? (
                            <>
                              <FaSpinner className="animate-spin" />
                              Removendo...
                            </>
                          ) : (
                            <>
                              🗑️ Remover Foto
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-purple-300 mt-2 flex items-start gap-2">
                      <span>💡</span>
                      <span>
                        <strong>Como usar:</strong><br/>
                        • Selecione uma imagem do seu computador (máx 5MB)<br/>
                        • OU cole uma URL de imagem da internet<br/>
                        • Clique em "Atualizar Foto" para enviar<br/>
                        • A foto será convertida automaticamente para JPEG 640x640px
                      </span>
                    </p>
                  </div>

                  <div className="bg-blue-500/10 border-2 border-blue-500/30 rounded-xl p-6">
                    <h4 className="text-lg font-bold text-blue-300 mb-2 flex items-center gap-2">
                      <span>ℹ️</span>
                      <span>Informações Importantes</span>
                    </h4>
                    <ul className="text-white/70 space-y-2 ml-6 list-disc">
                      <li>Apenas <strong className="text-white">nome</strong> e <strong className="text-white">foto</strong> do perfil podem ser alterados via API</li>
                      <li>Outras configurações (categoria, descrição, endereço, etc.) devem ser feitas <strong className="text-yellow-300">no app WhatsApp Business</strong></li>
                      <li>A instância deve estar <strong className="text-green-300">conectada</strong> para fazer alterações</li>
                      <li>Alterações são feitas diretamente no WhatsApp e visíveis para todos os contatos</li>
                    </ul>
                  </div>
                </div>
              )}

              <div className="flex gap-4 mt-8">
                <button 
                  type="submit" 
                  className="flex-1 px-6 py-4 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white text-lg font-bold rounded-xl transition-all duration-200 shadow-lg shadow-blue-500/40 flex items-center justify-center gap-2"
                >
                  <FaCheckCircle />
                  {editingInstance ? 'Atualizar Instância' : 'Criar Instância'}
                </button>
                <button 
                  type="button" 
                  onClick={resetForm} 
                  className="flex-1 px-6 py-4 bg-dark-700 hover:bg-dark-600 text-white text-lg font-bold rounded-xl transition-all duration-200 border-2 border-white/20 hover:border-white/40 flex items-center justify-center gap-2"
                >
                  <FaTimesCircle />
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {/* LISTA DE INSTÂNCIAS */}
        {instances.length === 0 ? (
          <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-20 text-center shadow-xl">
            <div className="text-6xl mb-6">📱</div>
            <p className="text-2xl text-white/70 font-medium mb-4">
              Nenhuma instância configurada ainda
            </p>
            <p className="text-lg text-white/50 mb-8">
              Clique em "Nova Instância" para começar
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white text-lg font-bold rounded-xl transition-all duration-200 shadow-lg shadow-blue-500/40 transform hover:scale-105"
            >
              <FaPlus className="text-xl" />
              Criar Primeira Instância
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {instances.map((instance) => (
              <div key={instance.id} className="bg-dark-800/60 backdrop-blur-xl border-2 border-blue-500/30 rounded-2xl p-8 shadow-xl hover:border-blue-500/50 transition-all duration-300">
                <div className="flex items-start justify-between gap-8">
                  {/* INFO */}
                  <div className="flex-1">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="bg-blue-500/20 p-4 rounded-xl">
                        <FaWhatsapp className="text-4xl text-blue-300" />
                      </div>
                      <div>
                        <h3 className="text-3xl font-black text-white">{instance.name}</h3>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white/5 rounded-xl p-4">
                        <div className="text-white/60 text-sm mb-1">Status</div>
                        {instance.is_connected ? (
                          <span className="inline-flex items-center gap-2 text-green-300 font-bold">
                            <FaCheckCircle /> Conectado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-2 text-red-300 font-bold">
                            <FaTimesCircle /> Desconectado
                          </span>
                        )}
                      </div>

                      {instance.phone_number && (
                        <div className="bg-white/5 rounded-xl p-4">
                          <div className="text-white/60 text-sm mb-1">Número</div>
                          <div className="text-white font-bold">{instance.phone_number}</div>
                        </div>
                      )}

                      {instance.proxy_name && (
                        <div className="bg-white/5 rounded-xl p-4">
                          <div className="text-white/60 text-sm mb-1">Proxy</div>
                          <div className="text-white font-bold">{instance.proxy_name}</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* AÇÕES */}
                  <div className="flex flex-col gap-3">
                    <button
                      onClick={() => router.push(`/uaz/qr-code?instance=${instance.id}`)}
                      className="px-6 py-3 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border-2 border-blue-500/40 rounded-xl font-bold transition-all flex items-center gap-2"
                    >
                      <FaQrcode /> QR Code
                    </button>

                    <button
                      onClick={() => handleCheckStatus(instance.id)}
                      disabled={checkingStatus === instance.id}
                      className="px-6 py-3 bg-green-500/20 hover:bg-green-500/30 text-green-300 border-2 border-green-500/40 rounded-xl font-bold transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                      {checkingStatus === instance.id ? (
                        <><FaSpinner className="animate-spin" /> Verificando...</>
                      ) : (
                        <><FaSync /> Status</>
                      )}
                    </button>

                    {instance.is_connected && (
                      <button
                        onClick={() => handleDisconnect(instance.id)}
                        className="px-6 py-3 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border-2 border-yellow-500/40 rounded-xl font-bold transition-all flex items-center gap-2"
                      >
                        <FaTimesCircle /> Desconectar
                      </button>
                    )}

                    <button
                      onClick={() => handleEdit(instance)}
                      className="px-6 py-3 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border-2 border-purple-500/40 rounded-xl font-bold transition-all flex items-center gap-2"
                    >
                      <FaEdit /> Editar
                    </button>

                    <button
                      onClick={() => handleDelete(instance.id)}
                      className="px-6 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-300 border-2 border-red-500/40 rounded-xl font-bold transition-all flex items-center gap-2"
                    >
                      <FaTrash /> Excluir
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

