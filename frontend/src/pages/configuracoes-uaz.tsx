import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { 
  FaPlus, FaEdit, FaTrash, FaQrcode, FaCheckCircle, FaTimesCircle,
  FaSpinner, FaArrowLeft, FaSync, FaCog, FaWhatsapp, FaExclamationTriangle,
  FaTrashAlt, FaInfoCircle, FaTimes, FaUser, FaImage, FaPause, FaPlay,
  FaSquare, FaCheckSquare, FaBan, FaCheck
} from 'react-icons/fa';
import api from '@/services/api';
import { InstanceAvatar } from '@/components/InstanceAvatar';
import { useToast } from '@/hooks/useToast';
import ToastContainer from '@/components/ToastContainer';
import { useNotifications } from '@/contexts/NotificationContext';

interface UazInstance {
  id: number;
  name: string;
  session_name: string;
  instance_token?: string;
  phone_number?: string;
  profile_name?: string;
  profile_pic_url?: string;
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

type TabType = 'instance' | 'profile';

export default function ConfiguracoesUaz() {
  const router = useRouter();
  const { toasts, addToast, removeToast, success, error, warning, info } = useToast();
  const notify = useNotifications();
  
  const [instances, setInstances] = useState<UazInstance[]>([]);
  const [proxies, setProxies] = useState<Proxy[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingInstanceId, setEditingInstanceId] = useState<number | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState<number | null>(null);
  const [syncingProfile, setSyncingProfile] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('instance');
  const [profileImage, setProfileImage] = useState<string>('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [currentProfilePicUrl, setCurrentProfilePicUrl] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewImage, setPreviewImage] = useState<string>('');
  const [togglingActive, setTogglingActive] = useState<number | null>(null);
  const [pausingAll, setPausingAll] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [showImportModal, setShowImportModal] = useState(false);
  const [availableInstances, setAvailableInstances] = useState<any[]>([]);
  const [selectedInstances, setSelectedInstances] = useState<Set<string>>(new Set());
  const [loadingInstances, setLoadingInstances] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selectedForDeactivation, setSelectedForDeactivation] = useState<Set<number>>(new Set());
  const [deactivating, setDeactivating] = useState(false);

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
    loadInstances(); // Carregamento inicial sem verificar status
    loadProxies();
    
    // Auto-refresh a cada 5 segundos
    const interval = setInterval(() => {
      if (autoRefresh && !creatingNew && editingInstanceId === null) {
        loadInstances(true); // Auto-refresh COM verificação de status
        setLastUpdate(new Date());
      }
    }, 3001);
    
    return () => clearInterval(interval);
  }, [autoRefresh, creatingNew, editingInstanceId]);

  const loadInstances = async (checkStatus = false) => {
    try {
      // Se checkStatus=true, passa refresh=true para o backend verificar status real
      const url = checkStatus ? '/uaz/instances?refresh=true' : '/uaz/instances';
      const response = await api.get(url);
      
      // Verifica se a resposta é um array ou um objeto com data
      const instancesData = Array.isArray(response.data) 
        ? response.data 
        : (response.data?.data || []);
      setInstances(instancesData);
      setLastUpdate(new Date());
    } catch (error) {
      // Só mostra erro no console se não for refresh automático
      if (!checkStatus) {
        console.error('Erro ao carregar instâncias:', error);
      }
      setInstances([]); // Define array vazio em caso de erro
    } finally {
      setLoading(false);
    }
  };

  const loadProxies = async () => {
    try {
      const response = await api.get('/proxies');
      // Verifica se a resposta é um array ou um objeto com data
      const proxiesData = Array.isArray(response.data) 
        ? response.data 
        : (response.data?.data || []);
      setProxies(proxiesData);
    } catch (error) {
      console.error('Erro ao carregar proxies:', error);
      setProxies([]); // Define array vazio em caso de erro
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
    setEditingInstanceId(null);
    setCreatingNew(false);
    setActiveTab('instance');
    setProfileImage('');
    setSelectedFile(null);
    setPreviewImage('');
    setCurrentProfilePicUrl('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingInstanceId) {
        // Atualizar instância existente
        await api.put(`/uaz/instances/${editingInstanceId}`, formData);
        success('✅ Instância atualizada com sucesso!');
      } else {
        // Criar nova instância
        await api.post('/uaz/instances', formData);
        success('✅ Instância criada com sucesso!');
      }
      
      resetForm();
      loadInstances();
    } catch (err: any) {
      error('❌ Erro: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleEdit = async (instance: UazInstance) => {
    setEditingInstanceId(instance.id);
    setActiveTab('instance');
    
    setFormData({
      name: instance.name,
      session_name: instance.session_name,
      instance_token: instance.instance_token || '',
      webhook_url: instance.webhook_url || '',
      proxy_id: instance.proxy_id || null,
      is_active: instance.is_active,
      profile_name: instance.profile_name || ''
    });
    
    // Limpa estados de imagem
    setProfileImage('');
    setSelectedFile(null);
    setPreviewImage('');
    setCurrentProfilePicUrl('');
    
    // Busca dados do perfil se conectado
    if (instance.is_connected && instance.instance_token) {
      try {
        const statusResponse = await api.get(`/uaz/instances/${instance.id}/status`);
        
        if (statusResponse.data.success) {
          const profileName = statusResponse.data.profile_name ||
                             statusResponse.data.data?.instance?.profileName ||
                             null;
          
          const profilePicUrl = statusResponse.data.data?.instance?.profilePicUrl || 
                               statusResponse.data.data?.instance?.profile_pic_url ||
                               null;
          
          if (profileName) {
            setFormData(prev => ({
              ...prev,
              profile_name: profileName
            }));
          }
          
          if (profilePicUrl) {
            setCurrentProfilePicUrl(profilePicUrl);
            setPreviewImage(profilePicUrl);
          }
        }
      } catch (error: any) {
        console.warn('⚠️ Não foi possível buscar dados do perfil:', error.message);
      }
    }
  };

  const handleDelete = async (id: number) => {
    const confirmed = await notify.confirm({
      title: '🗑️ Excluir Instância',
      message: 'Tem certeza que deseja excluir esta instância?\n\nEsta ação também excluirá a instância do WhatsApp QR Connect permanentemente e não pode ser desfeita.',
      type: 'danger',
      confirmText: 'Sim, Excluir',
      cancelText: 'Cancelar'
    });

    if (!confirmed) return;

    try {
      await api.delete(`/uaz/instances/${id}`);
      notify.success('Instância Excluída', 'Instância excluída com sucesso!');
      loadInstances();
      if (editingInstanceId === id) {
        resetForm();
      }
    } catch (err: any) {
      error('❌ Erro: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleDeleteAll = async () => {
    const confirmText = 'EXCLUIR TUDO';
    const userInput = prompt(
      `⚠️ ATENÇÃO! Esta ação irá EXCLUIR TODAS as conexões do sistema e do WhatsApp QR Connect permanentemente.\n\n` +
      `Digite "${confirmText}" para confirmar:`
    );

    if (userInput !== confirmText) {
      warning('❌ Ação cancelada. Texto de confirmação incorreto.');
      return;
    }

    try {
      await api.delete('/uaz/instances/delete-all');
      success('✅ Todas as instâncias foram excluídas com sucesso!');
      loadInstances();
      resetForm();
    } catch (err: any) {
      error('❌ Erro: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleCheckStatus = async (id: number) => {
    setCheckingStatus(id);
    try {
      const response = await api.get(`/uaz/instances/${id}/status`);
      
      // 🔍 Verifica se houve detecção de duplicação
      if (response.data.duplicateDetected) {
        console.log('⚠️ Duplicação detectada!', response.data);
        
        const action = response.data.action;
        
        if (action === 'kept_old_connected') {
          // CASO 1: Antiga estava conectada, nova foi deletada
          if (response.data.importedInstance) {
            success(
              `✅ DUPLICAÇÃO RESOLVIDA! Número: ${response.data.importedInstance.phone_number}. ` +
              `Instância mantida: ${response.data.importedInstance.name}. ` +
              `A instância original já estava conectada e foi mantida.`
            );
          } else if (response.data.existingInstance) {
            success(
              `✅ DUPLICAÇÃO RESOLVIDA! A instância original estava conectada e foi mantida.`
            );
          }
        } else if (action === 'kept_new_deleted_old') {
          // CASO 2: Antiga estava desconectada, nova foi mantida
          if (response.data.keptInstance) {
            success(
              `✅ DUPLICAÇÃO RESOLVIDA! Número: ${response.data.keptInstance.phone_number}. ` +
              `Instância mantida: ${response.data.keptInstance.name}. ` +
              `A instância antiga estava desconectada e foi removida.`
            );
          }
        }
      }
      
      await loadInstances();
    } catch (err: any) {
      error('❌ Erro: ' + (err.response?.data?.error || err.message));
    } finally {
      setCheckingStatus(null);
    }
  };

  const handleToggleActive = async (id: number, currentState: boolean) => {
    setTogglingActive(id);
    try {
      const response = await api.post(`/uaz/instances/${id}/toggle-active`);
      success(response.data.message);
      await loadInstances();
    } catch (err: any) {
      error('❌ Erro: ' + (err.response?.data?.error || err.message));
    } finally {
      setTogglingActive(null);
    }
  };

  // Funções de seleção de instâncias para desativação
  const handleToggleSelectInstance = (instanceId: number) => {
    const newSelected = new Set(selectedForDeactivation);
    if (newSelected.has(instanceId)) {
      newSelected.delete(instanceId);
    } else {
      newSelected.add(instanceId);
    }
    setSelectedForDeactivation(newSelected);
  };

  const handleSelectAllInstances = () => {
    if (selectedForDeactivation.size === instances.length) {
      setSelectedForDeactivation(new Set());
    } else {
      setSelectedForDeactivation(new Set(instances.map(i => i.id)));
    }
  };

  // Desativar instâncias selecionadas
  const handleDeactivateSelected = async () => {
    if (selectedForDeactivation.size === 0) {
      warning('⚠️ Nenhuma instância selecionada!');
      return;
    }

    const confirmed = await notify.confirm({
      title: '🚫 Desativar Instâncias Selecionadas',
      message: `Deseja desativar ${selectedForDeactivation.size} instância(s)?\n\nVocê poderá reativá-las depois.`,
      type: 'warning',
      confirmText: 'Sim, Desativar',
      cancelText: 'Cancelar'
    });

    if (!confirmed) return;

    setDeactivating(true);
    try {
      await api.post('/uaz/instances/deactivate-multiple', {
        instance_ids: Array.from(selectedForDeactivation)
      });
      notify.success('Instâncias Desativadas', `${selectedForDeactivation.size} instância(s) desativada(s) com sucesso!`);
      setSelectedForDeactivation(new Set());
      await loadInstances();
    } catch (err: any) {
      notify.error('Erro ao Desativar', err.response?.data?.error || err.message);
    } finally {
      setDeactivating(false);
    }
  };

  // Desativar todas as instâncias
  const handleDeactivateAll = async () => {
    if (instances.length === 0) {
      warning('⚠️ Nenhuma instância cadastrada!');
      return;
    }

    const confirmed = await notify.confirm({
      title: '🚨 Desativar TODAS as Instâncias',
      message: `Você está prestes a desativar TODAS as ${instances.length} instâncias!\n\nEsta ação pode ser revertida posteriormente.`,
      type: 'danger',
      confirmText: 'Sim, Desativar Todas',
      cancelText: 'Cancelar'
    });

    if (!confirmed) return;

    setDeactivating(true);
    try {
      await api.post('/uaz/instances/deactivate-all');
      notify.success('Instâncias Desativadas', `Todas as ${instances.length} instâncias foram desativadas com sucesso!`);
      setSelectedForDeactivation(new Set());
      await loadInstances();
    } catch (err: any) {
      notify.error('Erro ao Desativar', err.response?.data?.error || err.message);
    } finally {
      setDeactivating(false);
    }
  };

  // Ativar instâncias selecionadas
  const handleActivateSelected = async () => {
    if (selectedForDeactivation.size === 0) {
      warning('⚠️ Nenhuma instância selecionada!');
      return;
    }

    // Não precisa de confirmação para ativar - apenas mostra toast de sucesso
    setDeactivating(true);
    try {
      await api.post('/uaz/instances/activate-multiple', {
        instance_ids: Array.from(selectedForDeactivation)
      });
      notify.success('Instâncias Ativadas', `${selectedForDeactivation.size} instância(s) ativada(s) com sucesso!`);
      setSelectedForDeactivation(new Set());
      await loadInstances();
    } catch (err: any) {
      notify.error('Erro ao Ativar', err.response?.data?.error || err.message);
    } finally {
      setDeactivating(false);
    }
  };

  // Ativar todas as instâncias desativadas
  const handleActivateAllDeactivated = async () => {
    if (instances.length === 0) {
      warning('⚠️ Nenhuma instância cadastrada!');
      return;
    }

    // Não precisa de confirmação para ativar - apenas mostra toast de sucesso
    setDeactivating(true);
    try {
      await api.post('/uaz/instances/activate-all');
      notify.success('Instâncias Ativadas', `Todas as ${instances.length} instâncias foram ativadas com sucesso!`);
      setSelectedForDeactivation(new Set());
      await loadInstances();
    } catch (err: any) {
      notify.error('Erro ao Ativar', err.response?.data?.error || err.message);
    } finally {
      setDeactivating(false);
    }
  };

  const handlePauseAll = async () => {
    const confirmed = await notify.confirm({
      title: '⏸️ Pausar TODAS as Conexões',
      message: `Deseja pausar todas as ${instances.length} conexões?\n\nVocê poderá retomá-las depois.`,
      type: 'warning',
      confirmText: 'Sim, Pausar Todas',
      cancelText: 'Cancelar'
    });

    if (!confirmed) return;

    setPausingAll(true);
    try {
      const response = await api.post('/uaz/instances/pause-all');
      notify.success('Conexões Pausadas', response.data.message);
      await loadInstances();
    } catch (err: any) {
      notify.error('Erro ao Pausar', err.response?.data?.error || err.message);
    } finally {
      setPausingAll(false);
    }
  };

  const handleActivateAll = async () => {
    // Não precisa de confirmação para ativar - apenas mostra toast de sucesso
    setPausingAll(true);
    try {
      const response = await api.post('/uaz/instances/activate-all');
      notify.success('Conexões Ativadas', response.data.message);
      await loadInstances();
    } catch (err: any) {
      notify.error('Erro ao Ativar', err.response?.data?.error || err.message);
    } finally {
      setPausingAll(false);
    }
  };

  const handleFetchInstances = async () => {
    setLoadingInstances(true);
    try {
      const response = await api.get('/uaz/fetch-instances');
      
      if (response.data.success) {
        setAvailableInstances(response.data.instances);
        setSelectedInstances(new Set());
        setShowImportModal(true);
        
        if (response.data.available === 0) {
          info(`ℹ️ Nenhuma instância nova disponível. Total: ${response.data.total}, Já importadas: ${response.data.alreadyImported}`);
        }
      } else {
        error('❌ Erro: ' + response.data.error);
      }
    } catch (err: any) {
      error('❌ Erro ao buscar instâncias: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoadingInstances(false);
    }
  };

  const handleImportInstances = async () => {
    if (selectedInstances.size === 0) {
      warning('⚠️ Selecione pelo menos uma instância para importar');
      return;
    }

    const instancesToImport = availableInstances.filter(inst => selectedInstances.has(inst.token));

    setImporting(true);
    try {
      const response = await api.post('/uaz/import-instances', {
        instances: instancesToImport
      });

      if (response.data.success) {
        success(`✅ Importação concluída! Importadas: ${response.data.imported}, Erros: ${response.data.errors}`);
        
        setShowImportModal(false);
        setSelectedInstances(new Set());
        await loadInstances();
      } else {
        error('❌ Erro: ' + response.data.error);
      }
    } catch (err: any) {
      error('❌ Erro ao importar: ' + (err.response?.data?.error || err.message));
    } finally {
      setImporting(false);
    }
  };

  const toggleInstanceSelection = (token: string) => {
    const newSelection = new Set(selectedInstances);
    if (newSelection.has(token)) {
      newSelection.delete(token);
    } else {
      newSelection.add(token);
    }
    setSelectedInstances(newSelection);
  };

  const selectAllInstances = () => {
    if (selectedInstances.size === availableInstances.length) {
      setSelectedInstances(new Set());
    } else {
      setSelectedInstances(new Set(availableInstances.map(inst => inst.token)));
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      warning('⚠️ Por favor, selecione uma imagem válida');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      warning('⚠️ A imagem deve ter no máximo 5MB');
      return;
    }

    setSelectedFile(file);

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setPreviewImage(base64String);
      setProfileImage(base64String);
    };
    reader.readAsDataURL(file);
  };

  const handleSyncProfile = async () => {
    if (!editingInstanceId) return;
    
    setSyncingProfile(true);
    try {
      const response = await api.put(`/uaz/instances/${editingInstanceId}/sync-profile`);
      
      if (response.data.success && response.data.profile_name) {
        setFormData(prev => ({
          ...prev,
          profile_name: response.data.profile_name
        }));
        success('✅ Nome sincronizado: ' + response.data.profile_name);
      }
    } catch (err: any) {
      error('❌ Erro: ' + (err.response?.data?.error || err.message));
    } finally {
      setSyncingProfile(false);
    }
  };

  const tabs = [
    { id: 'instance' as TabType, label: 'Configurações da Instância', icon: <FaCog /> },
    { id: 'profile' as TabType, label: 'Perfil do WhatsApp (API)', icon: <FaUser /> },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 flex items-center justify-center">
        <div className="text-white text-xl flex items-center gap-3">
          <FaSpinner className="animate-spin" />
          Carregando...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 py-8 px-4">
      {/* Toast Container */}
      <ToastContainer toasts={toasts} onClose={removeToast} />
      
      <div className="max-w-7xl mx-auto space-y-8">
        {/* CABEÇALHO */}
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-600/30 via-cyan-500/20 to-blue-600/30 backdrop-blur-xl border-2 border-blue-500/40 rounded-3xl p-10 shadow-2xl shadow-blue-500/20">
          <div className="absolute inset-0 bg-grid-white/[0.02]"></div>
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl"></div>
          
          <div className="relative">
            <div className="flex items-center justify-between flex-wrap gap-6">
              <div className="flex items-center gap-6">
                <button
                  onClick={() => router.back()}
                  className="bg-white/10 hover:bg-white/20 backdrop-blur-sm border-2 border-white/30 rounded-xl px-6 py-4 transition-all duration-200 flex items-center gap-3 text-white font-bold shadow-lg hover:shadow-white/20 transform hover:scale-105"
                >
                  <FaArrowLeft className="text-xl" /> Voltar
                </button>
                <div className="bg-gradient-to-br from-blue-500 to-cyan-600 p-6 rounded-2xl shadow-lg shadow-blue-500/50">
                  <FaWhatsapp className="text-5xl text-white" />
                </div>
                <div>
                  <h1 className="text-5xl font-black text-white mb-2">
                    Gerenciar Conexões
                  </h1>
                  <p className="text-white/80 text-lg font-medium">
                    Gerencie suas instâncias WhatsApp QR Connect
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* AVISO 90 DIAS */}
        <div className="bg-yellow-500/10 border-2 border-yellow-500/30 rounded-2xl p-6 shadow-xl flex items-start gap-4">
          <FaInfoCircle className="text-3xl text-yellow-400 flex-shrink-0 mt-1" />
          <div>
            <h3 className="text-xl font-bold text-yellow-300 mb-2">
              📋 Período de Retenção
            </h3>
            <p className="text-white/80 text-base leading-relaxed">
              Para manter suas conexões ativas, configure-as de até 90 dias dos regulamentos. 
              Conexões <strong className="text-yellow-300">desconectadas</strong> há mais de 90 dias serão excluídas da plataforma.
            </p>
          </div>
        </div>

        {/* BOTÕES DE AÇÃO - Organizados em Grid */}
        <div className="space-y-4 mb-8">
          {/* Linha 1: Ações Principais */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <button
            onClick={() => {
              resetForm();
              setCreatingNew(true);
            }}
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold transition-all duration-200 shadow-lg bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white border-2 border-blue-400/50 transform hover:scale-105"
          >
              <FaPlus className="text-lg" />
            Nova Instância
          </button>

          <button
            onClick={handleFetchInstances}
            disabled={loadingInstances}
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold transition-all duration-200 shadow-lg bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white border-2 border-purple-400/50 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Importar instâncias já conectadas do QR Connect"
          >
            {loadingInstances ? (
                <FaSpinner className="text-lg animate-spin" />
            ) : (
                <FaPlus className="text-lg" />
            )}
            Importar Instâncias
          </button>

          {instances.length > 0 && (
              <button
                onClick={handleDeleteAll}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold transition-all duration-200 shadow-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 border-2 border-red-500/40 transform hover:scale-105"
                title="Excluir todas as conexões"
              >
                <FaTrashAlt className="text-lg" />
                Excluir Todas
              </button>
            )}
          </div>

          {/* Linha 2: Ações de Ativar/Desativar */}
          {instances.length > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <button
                onClick={handleActivateSelected}
                disabled={deactivating || selectedForDeactivation.size === 0}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold transition-all duration-200 shadow-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border-2 border-emerald-500/40 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Ativar instâncias selecionadas"
              >
                {deactivating ? (
                  <FaSpinner className="text-base animate-spin" />
                ) : (
                  <FaCheck className="text-base" />
                )}
                <span className="hidden sm:inline">Ativar Selecionadas</span>
                <span className="sm:hidden">Ativar Sel.</span>
              </button>

              <button
                onClick={handleDeactivateSelected}
                disabled={deactivating || selectedForDeactivation.size === 0}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold transition-all duration-200 shadow-lg bg-orange-600/20 hover:bg-orange-600/30 text-orange-400 border-2 border-orange-600/40 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Desativar instâncias selecionadas"
              >
                {deactivating ? (
                  <FaSpinner className="text-base animate-spin" />
                ) : (
                  <FaBan className="text-base" />
                )}
                <span className="hidden sm:inline">Desativar Selecionadas</span>
                <span className="sm:hidden">Desativar Sel.</span>
              </button>

              <button
                onClick={handleActivateAllDeactivated}
                disabled={deactivating}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold transition-all duration-200 shadow-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-500 border-2 border-emerald-600/40 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Ativar TODAS as instâncias"
              >
                {deactivating ? (
                  <FaSpinner className="text-base animate-spin" />
                ) : (
                  <FaCheck className="text-base" />
                )}
                Ativar TODAS
              </button>

              <button
                onClick={handleDeactivateAll}
                disabled={deactivating}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold transition-all duration-200 shadow-lg bg-red-600/20 hover:bg-red-600/30 text-red-400 border-2 border-red-600/40 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Desativar TODAS as instâncias"
              >
                {deactivating ? (
                  <FaSpinner className="text-base animate-spin" />
                ) : (
                  <FaBan className="text-base" />
                )}
                Desativar TODAS
              </button>
            </div>
          )}
          
          {/* Auto-refresh indicator */}
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => {
                loadInstances(true);
                setLastUpdate(new Date());
              }}
              className="flex items-center gap-3 px-8 py-4 rounded-xl font-bold transition-all duration-200 shadow-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border-2 border-blue-500/40 transform hover:scale-105"
              title="Atualizar agora"
            >
              <FaSync className="text-xl" />
              Atualizar
            </button>

            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center gap-3 px-8 py-4 rounded-xl font-bold transition-all duration-200 shadow-lg border-2 transform hover:scale-105 ${
                autoRefresh 
                  ? 'bg-green-500/20 hover:bg-green-500/30 text-green-300 border-green-500/40' 
                  : 'bg-gray-500/20 hover:bg-gray-500/30 text-gray-300 border-gray-500/40'
              }`}
              title={autoRefresh ? 'Atualização automática ativa (a cada 5s) - Clique para pausar' : 'Atualização automática pausada - Clique para ativar'}
            >
              {autoRefresh ? (
                <>
                  <FaSync className="text-xl animate-spin" />
                  <span className="text-sm">
                    Auto
                    <br />
                    <span className="text-xs opacity-70">
                      {lastUpdate.toLocaleTimeString()}
                    </span>
                  </span>
                </>
              ) : (
                <>
                  <FaPause className="text-xl" />
                  <span className="text-sm">Pausado</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* FORMULÁRIO DE CRIAÇÃO INLINE */}
        {creatingNew && (
          <div className="bg-dark-800/80 backdrop-blur-xl border-2 border-green-500/40 rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-green-500/20 to-green-600/20 p-6 border-b-2 border-green-500/30 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="bg-gradient-to-br from-green-500 to-green-600 p-4 rounded-xl shadow-lg">
                  <FaPlus className="text-3xl text-white" />
                </div>
                <div>
                  <h2 className="text-3xl font-black text-white">Nova Instância</h2>
                  <p className="text-white/70 text-base">Preencha os dados para criar uma nova conexão</p>
                </div>
              </div>
              <button
                onClick={resetForm}
                className="bg-white/10 hover:bg-white/20 p-3 rounded-xl transition-all"
                title="Fechar"
              >
                <FaTimes className="text-2xl text-white" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-lg font-bold mb-3 text-white">
                    Nome da Conexão
                  </label>
                  <input
                    type="text"
                    className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-green-500 focus:ring-4 focus:ring-green-500/30 transition-all"
                    placeholder="Ex: Marketing Principal (opcional)"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-lg font-bold mb-3 text-white">
                    🌐 Proxy (opcional)
                  </label>
                  <select
                    className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-green-500 focus:ring-4 focus:ring-green-500/30 transition-all"
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

              <div className="flex gap-4 mt-8 pt-6 border-t-2 border-white/10">
                <button 
                  type="submit" 
                  className="flex-1 px-6 py-4 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white text-lg font-bold rounded-xl transition-all duration-200 shadow-lg shadow-green-500/40 flex items-center justify-center gap-2"
                >
                  <FaCheckCircle />
                  Criar Instância
                </button>
                <button 
                  type="button" 
                  onClick={resetForm} 
                  className="flex-1 px-6 py-4 bg-dark-700 hover:bg-dark-600 text-white text-lg font-bold rounded-xl transition-all duration-200 border-2 border-white/20 hover:border-white/40 flex items-center justify-center gap-2"
                >
                  <FaTimes />
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {/* LISTA DE INSTÂNCIAS */}
        {instances.length === 0 ? (
          <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-16 text-center">
            <FaWhatsapp className="text-8xl text-white/20 mx-auto mb-6" />
            <h3 className="text-3xl font-bold text-white mb-4">
              Nenhuma instância criada
            </h3>
            <p className="text-white/60 text-xl mb-8">
              Clique em "Nova Instância" para começar
            </p>
            <button
              onClick={() => {
                resetForm();
                setCreatingNew(true);
              }}
              className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white text-lg font-bold rounded-xl transition-all duration-200 shadow-lg shadow-blue-500/40 transform hover:scale-105"
            >
              <FaPlus className="text-xl" />
              Criar Primeira Instância
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Barra de Seleção em Massa */}
            <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-purple-500/30 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                {/* Checkbox Selecionar Todos */}
                <button
                  onClick={handleSelectAllInstances}
                  className="flex items-center gap-3 px-6 py-3 bg-purple-500/20 hover:bg-purple-500/30 text-white rounded-xl transition-all border-2 border-purple-500/40 hover:border-purple-500/60"
                >
                  {selectedForDeactivation.size === instances.length ? (
                    <FaCheckSquare className="text-2xl text-purple-400" />
                  ) : (
                    <FaSquare className="text-2xl text-gray-400" />
                  )}
                  <span className="font-bold">
                    {selectedForDeactivation.size === instances.length ? 'Desselecionar Todas' : 'Selecionar Todas'}
                  </span>
                </button>

                {/* Contador de Selecionadas */}
                {selectedForDeactivation.size > 0 && (
                  <div className="px-4 py-2 bg-purple-500/20 border-2 border-purple-500/40 rounded-xl">
                    <span className="text-white font-bold">
                      {selectedForDeactivation.size} de {instances.length} selecionada(s)
                    </span>
                  </div>
                )}
              </div>
            </div>

            {instances.map((instance) => (
              <div key={instance.id} className="bg-dark-800/60 backdrop-blur-xl border-2 border-white/10 rounded-2xl shadow-xl overflow-hidden">
                {/* CARD DA INSTÂNCIA */}
                <div className="p-6 relative">
                  {/* Tags de Status no Canto Direito Superior */}
                  <div className="absolute top-4 right-4 flex items-center gap-3 z-10">
                    {/* Status Ativo/Pausado */}
                    {instance.is_active ? (
                      <span className="px-4 py-2 rounded-xl text-base font-bold bg-green-500/20 text-green-300 border-2 border-green-500/40 inline-flex items-center gap-2 shadow-xl">
                        <FaPlay className="text-sm" />
                        Ativa
                      </span>
                    ) : (
                      <span className="px-4 py-2 rounded-xl text-base font-bold bg-orange-500/20 text-orange-300 border-2 border-orange-500/40 inline-flex items-center gap-2 shadow-xl">
                        <FaPause className="text-sm" />
                        Pausada
                      </span>
                    )}

                    {/* Status de Conexão */}
                    {instance.is_connected ? (
                      <span className="px-4 py-2 rounded-xl text-base font-bold bg-green-500/20 text-green-300 border-2 border-green-500/40 inline-flex items-center gap-2 shadow-xl shadow-green-500/20">
                        <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                        Conectado
                      </span>
                    ) : (
                      <span className="px-4 py-2 rounded-xl text-base font-bold bg-red-500/20 text-red-300 border-2 border-red-500/40 inline-flex items-center gap-2 shadow-xl">
                        <span className="w-2 h-2 bg-red-400 rounded-full"></span>
                        Desconectado
                      </span>
                    )}
                  </div>

                  {/* Informações da Instância */}
                  <div className="flex items-center gap-6 mb-6">
                      {/* Checkbox de Seleção */}
                      <button
                        onClick={() => handleToggleSelectInstance(instance.id)}
                        className="flex-shrink-0"
                      >
                        {selectedForDeactivation.has(instance.id) ? (
                          <FaCheckSquare className="text-4xl text-purple-400 hover:text-purple-300 transition-colors" />
                        ) : (
                          <FaSquare className="text-4xl text-gray-600 hover:text-gray-500 transition-colors" />
                        )}
                      </button>

                      {/* Foto do Perfil do WhatsApp - MAIOR */}
                      <div className="relative flex-shrink-0">
                        {/* Overlay de Pausado */}
                        {!instance.is_active && (
                          <div className="absolute inset-0 w-40 h-40 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center z-10">
                            <div className="text-center">
                              <FaPause className="text-4xl text-orange-400 mx-auto mb-2" />
                              <span className="text-white text-xs font-bold">PAUSADA</span>
                            </div>
                          </div>
                        )}
                        
                        {instance.profile_pic_url ? (
                          <img 
                            src={instance.profile_pic_url} 
                            alt="Perfil do WhatsApp"
                            className={`w-40 h-40 rounded-full object-cover border-4 ${
                              !instance.is_active 
                                ? 'border-orange-500' 
                                : instance.is_connected 
                                  ? 'border-green-500' 
                                  : 'border-red-500'
                            } shadow-2xl ${!instance.is_active ? 'opacity-50' : ''}`}
                            onError={(e) => {
                              // Se a imagem falhar ao carregar, mostra o ícone padrão
                              e.currentTarget.style.display = 'none';
                              if (e.currentTarget.nextSibling) {
                                (e.currentTarget.nextSibling as HTMLElement).style.display = 'flex';
                              }
                            }}
                          />
                        ) : null}
                        <div 
                          className={`w-40 h-40 rounded-full ${
                            !instance.is_active 
                              ? 'bg-orange-500/20' 
                              : instance.is_connected 
                                ? 'bg-green-500/20' 
                                : 'bg-red-500/20'
                          } flex items-center justify-center ${instance.profile_pic_url ? 'hidden' : 'flex'} ${!instance.is_active ? 'opacity-50' : ''}`}
                          style={instance.profile_pic_url ? { display: 'none' } : {}}
                        >
                          <FaWhatsapp className={`text-8xl ${
                            !instance.is_active 
                              ? 'text-orange-400' 
                              : instance.is_connected 
                                ? 'text-green-400' 
                                : 'text-red-400'
                          }`} />
                        </div>
                        {/* Indicador de status sobreposto */}
                        <div className={`absolute -bottom-2 -right-2 w-10 h-10 rounded-full border-4 border-dark-800 ${
                          !instance.is_active 
                            ? 'bg-orange-500' 
                            : instance.is_connected 
                              ? 'bg-green-500 animate-pulse' 
                              : 'bg-red-500'
                        } flex items-center justify-center`}>
                          {!instance.is_active ? (
                            <FaPause className="text-white text-xs" />
                          ) : instance.is_connected ? (
                            <span className="text-white text-xs font-bold">✓</span>
                          ) : (
                            <span className="text-white text-xs font-bold">✗</span>
                          )}
                        </div>
                      </div>
                      
                    <div className="space-y-3 flex-1 pr-64">
                        {/* Nome da Conexão */}
                        <div>
                          <p className="text-white/60 text-sm font-semibold uppercase tracking-wide mb-1">Nome da Conexão</p>
                          <h3 className="text-3xl font-black text-white">
                            {instance.name}
                          </h3>
                        </div>

                        {/* Nome do Perfil do WhatsApp */}
                        {instance.profile_name && (
                          <div>
                            <p className="text-white/60 text-sm font-semibold uppercase tracking-wide mb-1">Nome do Perfil</p>
                            <p className="text-white text-xl font-bold flex items-center gap-2">
                              <span className="text-2xl">👤</span>
                              <span>{instance.profile_name}</span>
                            </p>
                          </div>
                        )}

                        {/* Telefone do WhatsApp */}
                        {instance.phone_number && (
                          <div>
                            <p className="text-white/60 text-sm font-semibold uppercase tracking-wide mb-1">Telefone do WhatsApp</p>
                            <p className="text-green-400 text-xl font-black flex items-center gap-2">
                              <span className="text-2xl">📞</span>
                              <span>{instance.phone_number}</span>
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                    
                  {/* Botões de Ação - Grid Responsivo Alinhado até o Final */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {/* Botão Pausar/Ativar */}
                      <button
                        onClick={() => handleToggleActive(instance.id, instance.is_active)}
                        disabled={togglingActive === instance.id}
                      className={`px-5 py-4 rounded-xl font-bold text-base transition-all border-2 flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg ${
                          instance.is_active 
                          ? 'bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 border-orange-500/30 hover:border-orange-500/50' 
                          : 'bg-green-500/20 hover:bg-green-500/30 text-green-300 border-green-500/30 hover:border-green-500/50'
                        }`}
                        title={instance.is_active ? 'Pausar conexão' : 'Ativar conexão'}
                      >
                        {togglingActive === instance.id ? (
                        <FaSpinner className="animate-spin text-xl" />
                        ) : instance.is_active ? (
                          <FaPause className="text-xl" />
                        ) : (
                          <FaPlay className="text-xl" />
                        )}
                      <span className="hidden xl:inline">{instance.is_active ? 'Pausar' : 'Ativar'}</span>
                      </button>
                      
                    {/* Botão Reconectar - Sempre no mesmo lugar */}
                        <button
                          onClick={async () => {
                        if (!instance.is_connected) {
                            const confirmed = await notify.confirm({
                              title: '🔄 Reconectar Instância',
                              message: 'Deseja reconectar esta instância?\n\nIsso irá resetar a conexão atual e gerar um novo QR Code.',
                              type: 'info',
                              confirmText: 'Sim, Reconectar',
                              cancelText: 'Cancelar'
                            });

                            if (confirmed) {
                              try {
                                await api.post(`/uaz/instances/${instance.id}/logout`);
                                router.push(`/uaz/qr-code?instance=${instance.id}`);
                              } catch (error) {
                                console.error('Erro ao reconectar:', error);
                                router.push(`/uaz/qr-code?instance=${instance.id}`);
                              }
                            }
                        }
                      }}
                      disabled={instance.is_connected}
                      className={`px-5 py-4 rounded-xl font-bold text-base transition-all border-2 flex items-center justify-center gap-2 shadow-lg ${
                        instance.is_connected
                          ? 'bg-gray-500/10 text-gray-500 border-gray-500/20 cursor-not-allowed opacity-50'
                          : 'bg-gradient-to-r from-green-500/20 to-blue-500/20 hover:from-green-500/30 hover:to-blue-500/30 text-green-300 border-green-500/30 hover:border-green-500/50'
                      }`}
                      title={instance.is_connected ? 'Instância já conectada' : 'Reconectar (Reset + QR Code)'}
                        >
                          <FaSync className="text-xl" />
                      <span className="hidden xl:inline">Reconectar</span>
                        </button>
                      
                    {/* Botão QR Code */}
                      <button
                        onClick={() => router.push(`/uaz/qr-code?instance=${instance.id}`)}
                      className="px-5 py-4 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-xl font-bold text-base transition-all border-2 border-blue-500/30 hover:border-blue-500/50 flex items-center justify-center gap-2 shadow-lg"
                        title="QR Code"
                      >
                        <FaQrcode className="text-xl" />
                      <span className="hidden xl:inline">QR Code</span>
                      </button>
                    
                    {/* Botão Status */}
                      <button
                        onClick={() => handleCheckStatus(instance.id)}
                        disabled={checkingStatus === instance.id}
                      className="px-5 py-4 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-xl font-bold text-base transition-all border-2 border-purple-500/30 hover:border-purple-500/50 flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg"
                        title="Status"
                      >
                        {checkingStatus === instance.id ? (
                        <FaSpinner className="animate-spin text-xl" />
                        ) : (
                        <FaSync className="text-xl" />
                        )}
                      <span className="hidden xl:inline">Status</span>
                      </button>
                    
                    {/* Botão Editar */}
                      <button
                        onClick={() => handleEdit(instance)}
                      className="px-5 py-4 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 rounded-xl font-bold text-base transition-all border-2 border-yellow-500/30 hover:border-yellow-500/50 flex items-center justify-center gap-2 shadow-lg"
                        title="Editar"
                      >
                        <FaEdit className="text-xl" />
                      <span className="hidden xl:inline">Editar</span>
                      </button>
                    
                    {/* Botão Excluir */}
                      <button
                        onClick={() => handleDelete(instance.id)}
                      className="px-5 py-4 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-xl font-bold text-base transition-all border-2 border-red-500/30 hover:border-red-500/50 flex items-center justify-center gap-2 shadow-lg"
                        title="Excluir"
                      >
                        <FaTrash className="text-xl" />
                      <span className="hidden xl:inline">Excluir</span>
                      </button>
                  </div>
                </div>

                {/* PAINEL DE EDIÇÃO INLINE */}
                {editingInstanceId === instance.id && (
                  <div className="border-t-2 border-white/10 bg-dark-900/40">
                    {/* TABS */}
                    <div className="bg-dark-800/60 border-b-2 border-white/10 p-4">
                      <div className="flex gap-2 flex-wrap">
                        {tabs.map((tab) => (
                          <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            disabled={tab.id === 'profile' && !instance.is_connected}
                            className={`
                              px-6 py-3 rounded-xl font-bold text-base transition-all duration-200 flex items-center gap-2 whitespace-nowrap
                              ${activeTab === tab.id
                                ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/40 border-2 border-blue-400/50'
                                : 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border-2 border-white/10 hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed'
                              }
                            `}
                            title={tab.id === 'profile' && !instance.is_connected ? 'Conecte a instância primeiro' : ''}
                          >
                            <span className="text-xl">{tab.icon}</span>
                            {tab.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* CONTEÚDO DAS TABS */}
                    <form onSubmit={handleSubmit} className="p-8">
                      {activeTab === 'instance' && (
                        <div className="space-y-6">
                          <div className="flex items-center gap-4 pb-4 border-b-2 border-white/10">
                            <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-3 rounded-xl shadow-lg">
                              <FaCog className="text-3xl text-white" />
                            </div>
                            <div>
                              <h3 className="text-2xl font-black text-white">Configurações da Instância</h3>
                              <p className="text-white/60">Edite as configurações básicas da conexão</p>
                            </div>
                          </div>

                          <div className="grid md:grid-cols-2 gap-6">
                            <div className="md:col-span-2">
                              <label className="block text-lg font-bold mb-3 text-white">
                                ✏️ Nome da Conexão *
                              </label>
                              <input
                                type="text"
                                required
                                className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/30 transition-all"
                                placeholder="Ex: Marketing Principal"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                              />
                              <p className="text-sm text-green-400 mt-2">
                                ✅ Ao alterar o nome, será atualizado automaticamente no WhatsApp QR Connect
                              </p>
                            </div>

                            <div className="md:col-span-2">
                              <label className="block text-lg font-bold mb-3 text-white">
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
                        </div>
                      )}

                      {activeTab === 'profile' && (
                        <div className="space-y-6">
                          <div className="flex items-center gap-4 pb-4 border-b-2 border-white/10">
                            <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-3 rounded-xl shadow-lg">
                              <FaUser className="text-3xl text-white" />
                            </div>
                            <div>
                              <h3 className="text-2xl font-black text-white">Perfil do WhatsApp (API)</h3>
                              <p className="text-white/60">Editáveis via WhatsApp QR Connect - A instância deve estar conectada</p>
                            </div>
                          </div>

                          <div className="bg-purple-500/10 border-2 border-purple-500/30 rounded-xl p-6">
                            <p className="text-white/80 text-base">
                              <strong className="text-yellow-300">⚠️ Importante:</strong> Apenas nome e foto do perfil podem ser alterados via API.
                              Outras configurações (categoria, descrição, endereço, etc.) devem ser feitas no app WhatsApp Business.
                            </p>
                          </div>

                          {/* Foto do Perfil */}
                          <div>
                            <label className="block text-lg font-bold mb-3 text-white">
                              📸 Foto do Perfil do WhatsApp
                            </label>
                            
                            {/* Preview */}
                            {previewImage && (
                              <div className="mb-4 flex justify-center">
                                <div className="relative">
                                  <img 
                                    src={previewImage} 
                                    alt="Preview do perfil"
                                    className="w-32 h-32 rounded-full object-cover border-4 border-purple-500 shadow-lg"
                                    onError={(e) => {
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
                              
                              <div className="flex gap-3">
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (!profileImage.trim()) {
                                      warning('⚠️ Selecione uma imagem do seu computador primeiro');
                                      return;
                                    }
                                    
                                    setUploadingImage(true);
                                    try {
                                      await api.post(`/uaz/instances/${editingInstanceId}/profile-image`, {
                                        image: profileImage
                                      });
                                      success('✅ Foto do perfil atualizada com sucesso!');
                                      setCurrentProfilePicUrl(profileImage);
                                      setSelectedFile(null);
                                      
                                      setTimeout(async () => {
                                        try {
                                          const statusResponse = await api.get(`/uaz/instances/${editingInstanceId}/status`);
                                          const newPicUrl = statusResponse.data.data?.instance?.profilePicUrl;
                                          if (newPicUrl) {
                                            setCurrentProfilePicUrl(newPicUrl);
                                            setPreviewImage(newPicUrl);
                                          }
                                        } catch (err) {
                                          console.warn('Não foi possível buscar foto atualizada:', err);
                                        }
                                      }, 2000);
                                    } catch (err: any) {
                                      error('❌ Erro: ' + (err.response?.data?.error || err.message));
                                    } finally {
                                      setUploadingImage(false);
                                    }
                                  }}
                                  disabled={uploadingImage || !instance.is_connected || !profileImage}
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
                                    const confirmed = await notify.confirm({
                                      title: '🗑️ Remover Foto do Perfil',
                                      message: 'Tem certeza que deseja remover a foto do perfil?\n\nEsta ação não pode ser desfeita.',
                                      type: 'danger',
                                      confirmText: 'Sim, Remover',
                                      cancelText: 'Cancelar'
                                    });
                                    if (!confirmed) return;
                                    
                                    setUploadingImage(true);
                                    try {
                                      await api.post(`/uaz/instances/${editingInstanceId}/profile-image`, {
                                        image: 'remove'
                                      });
                                      success('✅ Foto do perfil removida com sucesso!');
                                      setProfileImage('');
                                      setSelectedFile(null);
                                      setPreviewImage('');
                                      setCurrentProfilePicUrl('');
                                    } catch (err: any) {
                                      error('❌ Erro: ' + (err.response?.data?.error || err.message));
                                    } finally {
                                      setUploadingImage(false);
                                    }
                                  }}
                                  disabled={uploadingImage || !instance.is_connected}
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
                            <p className="text-sm text-purple-300 mt-2">
                              💡 <strong>Como usar:</strong> Selecione uma imagem do seu computador (máx 5MB) e clique em "Atualizar Foto" para enviar.
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
                                disabled={syncingProfile || !instance.is_connected}
                                className="px-6 py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
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
                            <p className="text-sm text-purple-300 mt-2">
                              💬 Este é o nome que aparece no WhatsApp para seus contatos (máximo 25 caracteres).
                            </p>
                          </div>
                        </div>
                      )}

                      {/* BOTÕES DE AÇÃO */}
                      <div className="flex gap-4 mt-8 pt-6 border-t-2 border-white/10">
                        <button 
                          type="submit" 
                          className="flex-1 px-6 py-4 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white text-lg font-bold rounded-xl transition-all duration-200 shadow-lg shadow-blue-500/40 flex items-center justify-center gap-2"
                        >
                          <FaCheckCircle />
                          Atualizar Instância
                        </button>
                        <button 
                          type="button" 
                          onClick={resetForm} 
                          className="flex-1 px-6 py-4 bg-dark-700 hover:bg-dark-600 text-white text-lg font-bold rounded-xl transition-all duration-200 border-2 border-white/20 hover:border-white/40 flex items-center justify-center gap-2"
                        >
                          <FaTimes />
                          Fechar
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL DE IMPORTAÇÃO DE INSTÂNCIAS */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gradient-to-br from-dark-800 to-dark-900 rounded-2xl border-2 border-purple-500/30 shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FaPlus className="text-3xl text-white" />
                <div>
                  <h2 className="text-2xl font-bold text-white">Importar Instâncias</h2>
                  <p className="text-purple-100 text-sm">Selecione as instâncias do WhatsApp QR Connect para importar</p>
                </div>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-white hover:bg-white/20 rounded-lg p-2 transition-all"
              >
                <FaTimes className="text-2xl" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {availableInstances.length === 0 ? (
                <div className="text-center py-12">
                  <FaInfoCircle className="text-6xl text-gray-400 mx-auto mb-4" />
                  <p className="text-xl text-white/60">Nenhuma instância disponível para importar</p>
                  <p className="text-white/40 mt-2">Todas as instâncias do WhatsApp QR Connect já estão cadastradas no sistema</p>
                </div>
              ) : (
                <>
                  {/* Header da lista */}
                  <div className="bg-dark-700/50 rounded-xl p-4 mb-4 flex items-center justify-between">
                    <button
                      onClick={selectAllInstances}
                      className="flex items-center gap-2 text-purple-300 hover:text-purple-200 font-bold transition-all"
                    >
                      <input
                        type="checkbox"
                        checked={selectedInstances.size === availableInstances.length && availableInstances.length > 0}
                        onChange={() => {}}
                        className="w-5 h-5 cursor-pointer"
                      />
                      {selectedInstances.size === availableInstances.length && availableInstances.length > 0 
                        ? 'Desselecionar Todas' 
                        : 'Selecionar Todas'}
                    </button>
                    <span className="text-white/60">
                      {selectedInstances.size} de {availableInstances.length} selecionada(s)
                    </span>
                  </div>

                  {/* Lista de instâncias */}
                  <div className="space-y-3">
                    {availableInstances.map((inst) => (
                      <div
                        key={inst.token}
                        onClick={() => toggleInstanceSelection(inst.token)}
                        className={`bg-dark-700/50 rounded-xl p-4 border-2 cursor-pointer transition-all hover:scale-[1.02] ${
                          selectedInstances.has(inst.token)
                            ? 'border-purple-500 bg-purple-500/10'
                            : 'border-white/10 hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          <input
                            type="checkbox"
                            checked={selectedInstances.has(inst.token)}
                            onChange={() => {}}
                            className="mt-1 w-5 h-5 cursor-pointer"
                          />
                          
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-xl font-bold text-white">{inst.name || inst.owner || 'Sem nome'}</h3>
                              {inst.isConnected ? (
                                <span className="px-3 py-1 bg-green-500/20 text-green-300 rounded-full text-sm font-bold border border-green-500/30">
                                  ✅ Conectada
                                </span>
                              ) : (
                                <span className="px-3 py-1 bg-gray-500/20 text-gray-300 rounded-full text-sm font-bold border border-gray-500/30">
                                  ⭕ Desconectada
                                </span>
                              )}
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-sm">
                              {inst.owner && (
                                <div className="text-white/60">
                                  📱 <span className="text-white/80">{inst.owner}</span>
                                </div>
                              )}
                              {inst.profileName && (
                                <div className="text-white/60">
                                  👤 <span className="text-white/80">{inst.profileName}</span>
                                </div>
                              )}
                              <div className="text-white/60">
                                🔑 <span className="text-white/40 font-mono text-xs">{inst.token.substring(0, 20)}...</span>
                              </div>
                              {inst.created && (
                                <div className="text-white/60">
                                  📅 <span className="text-white/80">{new Date(inst.created).toLocaleDateString()}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            {availableInstances.length > 0 && (
              <div className="bg-dark-700/50 p-6 border-t-2 border-white/10 flex gap-4">
                <button
                  onClick={() => setShowImportModal(false)}
                  className="flex-1 px-6 py-4 bg-dark-700 hover:bg-dark-600 text-white text-lg font-bold rounded-xl transition-all border-2 border-white/20 hover:border-white/40"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleImportInstances}
                  disabled={selectedInstances.size === 0 || importing}
                  className="flex-1 px-6 py-4 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white text-lg font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {importing ? (
                    <>
                      <FaSpinner className="animate-spin" />
                      Importando...
                    </>
                  ) : (
                    <>
                      <FaCheckCircle />
                      Importar ({selectedInstances.size})
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

