import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { 
  FaUser, FaCheck, FaTimes, FaSearch, FaInfoCircle, 
  FaClock, FaCheckCircle, FaExclamationTriangle, FaSpinner,
  FaEnvelope, FaMapMarkerAlt, FaGlobe, FaStore, FaPlay, FaSave, FaArrowLeft
} from 'react-icons/fa';
import api from '@/services/api';
import { useToast } from '@/hooks/useToast';
import ToastContainer from '@/components/ToastContainer';

interface Account {
  id: number;
  name: string;
  phone_number: string;
  is_active: boolean;
}

interface PreviewData {
  totalAccounts: number;
  activeAccounts: number;
  inactiveAccounts: number;
  dataToSend: any;
  fieldsToUpdate: string[];
  queueInterval: number;
  estimatedTime: number;
  estimatedTimeFormatted: string;
  accounts: Array<{ id: number; name: string; phone: string }>;
  inactiveAccountsList: Array<{ id: number; name: string; phone: string }>;
}

interface QueueItem {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  accountPhone: string;
  accountName: string;
  fieldsToUpdate: string[];
  error?: string;
  createdAt: string;
}

interface QueueStatus {
  total: number;
  processing: number;
  pending: number;
  isProcessing: boolean;
  interval: number;
  items: QueueItem[];
}

export default function EditarPerfilMassa() {
  const router = useRouter();
  const toast = useToast();
  
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<number[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [showQueue, setShowQueue] = useState(false);
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);

  const [profileData, setProfileData] = useState({
    about: '',
    description: '',
    email: '',
    address: '',
    vertical: '',
    website1: '',
    website2: '',
  });

  const [queueInterval, setQueueInterval] = useState(5);

  useEffect(() => {
    fetchAccounts();
  }, []);

  useEffect(() => {
    if (showQueue) {
      const interval = setInterval(fetchQueueStatus, 2000);
      return () => clearInterval(interval);
    }
  }, [showQueue]);

  const fetchAccounts = async () => {
    try {
      const response = await api.get('/whatsapp-accounts');
      if (response.data.success) {
        setAccounts(response.data.data);
      }
    } catch (error: any) {
      console.error('Erro ao carregar contas:', error);
      toast.error('Erro ao carregar contas: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchQueueStatus = async () => {
    try {
      const response = await api.get('/bulk-profile/queue/status');  // ✅ CORRIGIDO: bulk-profile (singular)
      if (response.data.success) {
        setQueueStatus(response.data.queue);
      }
    } catch (error: any) {
      console.error('Erro ao buscar status da fila:', error);
    }
  };

  const handleSelectAll = () => {
    const activeAccountIds = accounts
      .filter(acc => acc.is_active)
      .map(acc => acc.id);
    
    if (selectedAccounts.length === activeAccountIds.length) {
      setSelectedAccounts([]);
    } else {
      setSelectedAccounts(activeAccountIds);
    }
  };

  const handleToggleAccount = (accountId: number) => {
    setSelectedAccounts(prev => 
      prev.includes(accountId)
        ? prev.filter(id => id !== accountId)
        : [...prev, accountId]
    );
  };

  const handleSaveProfile = async () => {
    if (selectedAccounts.length === 0) {
      toast.warning('Selecione pelo menos uma conta!');
      return;
    }

    // Identificar campos preenchidos
    const fieldsToUpdate: string[] = [];
    const dataToSend: any = {};

    if (profileData.about.trim()) {
      fieldsToUpdate.push('about');
      dataToSend.about = profileData.about;
    }
    if (profileData.description.trim()) {
      fieldsToUpdate.push('description');
      dataToSend.description = profileData.description;
    }
    if (profileData.email.trim()) {
      fieldsToUpdate.push('email');
      dataToSend.email = profileData.email;
    }
    if (profileData.address.trim()) {
      fieldsToUpdate.push('address');
      dataToSend.address = profileData.address;
    }
    if (profileData.vertical) {
      fieldsToUpdate.push('vertical');
      dataToSend.vertical = profileData.vertical;
    }

    // Websites
    const websites: string[] = [];
    if (profileData.website1.trim()) {
      websites.push(profileData.website1);
    }
    if (profileData.website2.trim()) {
      websites.push(profileData.website2);
    }
    if (websites.length > 0) {
      fieldsToUpdate.push('websites');
      dataToSend.websites = websites;
    }

    if (fieldsToUpdate.length === 0) {
      toast.warning('Preencha pelo menos um campo para atualizar!');
      return;
    }

    try {
      setProcessing(true);

      // Gerar preview primeiro
      console.log('📋 Gerando preview de atualização em massa...');
      console.log('   Contas:', selectedAccounts);
      console.log('   Dados:', dataToSend);
      console.log('   Campos:', fieldsToUpdate);
      
      const previewResponse = await api.post('/bulk-profile/preview', {  // ✅ CORRIGIDO: bulk-profile (singular)
        account_ids: selectedAccounts,
        profile_data: dataToSend,
        fields_to_update: fieldsToUpdate,
      });

      if (previewResponse.data.success) {
        setPreviewData(previewResponse.data.preview);
        setShowPreview(true);
      }
    } catch (error: any) {
      console.error('Erro ao gerar preview:', error);
      toast.error('Erro ao gerar preview: ' + (error.response?.data?.error || error.message));
    } finally {
      setProcessing(false);
    }
  };

  const handleConfirmUpdate = async () => {
    if (!previewData) return;

    try {
      setProcessing(true);

      // Configurar intervalo
      console.log('⚙️ Configurando intervalo da fila:', queueInterval, 'segundos');
      await api.post('/bulk-profile/queue/interval', {  // ✅ CORRIGIDO: bulk-profile (singular)
        seconds: queueInterval,
      });

      // Preparar dados
      const dataToSend: any = {};
      if (profileData.about.trim()) dataToSend.about = profileData.about;
      if (profileData.description.trim()) dataToSend.description = profileData.description;
      if (profileData.email.trim()) dataToSend.email = profileData.email;
      if (profileData.address.trim()) dataToSend.address = profileData.address;
      if (profileData.vertical) dataToSend.vertical = profileData.vertical;

      const websites: string[] = [];
      if (profileData.website1.trim()) websites.push(profileData.website1);
      if (profileData.website2.trim()) websites.push(profileData.website2);
      if (websites.length > 0) dataToSend.websites = websites;

      // Enviar atualização
      console.log('💾 Enviando atualização em massa...');
      console.log('   Contas:', selectedAccounts);
      console.log('   Dados:', dataToSend);
      
      const response = await api.post('/bulk-profile/update', {  // ✅ CORRIGIDO: bulk-profile (singular)
        account_ids: selectedAccounts,
        profile_data: dataToSend,
        fields_to_update: previewData.fieldsToUpdate,
      });

      if (response.data.success) {
        toast.success(`${response.data.summary.queued} perfis adicionados à fila! ${response.data.queue.message}`);
        setShowPreview(false);
        setShowQueue(true);
        fetchQueueStatus();
      }
    } catch (error: any) {
      console.error('Erro ao atualizar perfis:', error);
      toast.error('Erro ao atualizar perfis: ' + (error.response?.data?.error || error.message));
    } finally {
      setProcessing(false);
    }
  };

  const filteredAccounts = accounts.filter(acc =>
    acc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    acc.phone_number.includes(searchTerm)
  );

  const activeAccounts = filteredAccounts.filter(acc => acc.is_active);
  const inactiveAccounts = filteredAccounts.filter(acc => !acc.is_active);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <FaSpinner className="animate-spin text-6xl text-purple-500" />
      </div>
    );
  }

  return (
    <>
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />
      
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6">
        <div className="relative overflow-hidden bg-gradient-to-r from-purple-600 via-purple-500 to-pink-500 rounded-3xl p-8 mb-8 border-2 border-purple-400/50 shadow-2xl">
        <div className="absolute inset-0 bg-grid-white opacity-10"></div>
        
        <div className="relative z-10 flex items-center gap-6">
          {/* Botão Voltar */}
          <button
            onClick={() => router.push('/dashboard-oficial')}
            className="bg-white/10 hover:bg-white/20 p-4 rounded-xl transition-all duration-200 border-2 border-white/20 hover:border-white/40"
            title="Voltar para o Dashboard API Oficial"
          >
            <FaArrowLeft className="text-3xl text-white" />
          </button>
          
          <div className="bg-white/20 p-6 rounded-2xl backdrop-blur-sm">
            <FaUser className="text-6xl text-white" />
          </div>
          
          <div className="flex-1">
            <h1 className="text-5xl font-black text-white mb-2">
              Edição em Massa de Perfis
            </h1>
            <p className="text-xl text-white/90">
              Atualize perfis de negócio de múltiplas contas simultaneamente
            </p>
          </div>

          {queueStatus && queueStatus.isProcessing && (
            <div className="bg-white/20 backdrop-blur-sm px-6 py-4 rounded-xl border-2 border-white/30">
              <div className="flex items-center gap-3">
                <FaSpinner className="animate-spin text-2xl text-white" />
                <div>
                  <div className="text-sm text-white/80">Processando</div>
                  <div className="text-2xl font-bold text-white">{queueStatus.pending} na fila</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showPreview && previewData && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-3xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto border-2 border-purple-500/50 shadow-2xl">
            
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-3xl font-bold text-white flex items-center gap-3">
                <FaInfoCircle className="text-purple-400" />
                Preview da Atualização
              </h2>
              <button
                onClick={() => setShowPreview(false)}
                className="text-white/60 hover:text-white text-3xl"
              >
                <FaTimes />
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-500/20 border-2 border-blue-500/40 rounded-xl p-4">
                <div className="text-sm text-blue-300 mb-1">Total</div>
                <div className="text-3xl font-bold text-white">{previewData.totalAccounts}</div>
              </div>
              <div className="bg-green-500/20 border-2 border-green-500/40 rounded-xl p-4">
                <div className="text-sm text-green-300 mb-1">Ativas</div>
                <div className="text-3xl font-bold text-white">{previewData.activeAccounts}</div>
              </div>
              <div className="bg-yellow-500/20 border-2 border-yellow-500/40 rounded-xl p-4">
                <div className="text-sm text-yellow-300 mb-1">Tempo Estimado</div>
                <div className="text-2xl font-bold text-white">{previewData.estimatedTimeFormatted}</div>
              </div>
              <div className="bg-purple-500/20 border-2 border-purple-500/40 rounded-xl p-4">
                <div className="text-sm text-purple-300 mb-1">Intervalo</div>
                <div className="text-3xl font-bold text-white">{previewData.queueInterval}s</div>
              </div>
            </div>

            <div className="bg-purple-500/10 border-2 border-purple-500/30 rounded-xl p-6 mb-6">
              <h3 className="text-xl font-bold text-white mb-4">Campos que serão atualizados:</h3>
              <div className="flex flex-wrap gap-2">
                {previewData.fieldsToUpdate.map(field => (
                  <span
                    key={field}
                    className="px-4 py-2 bg-purple-600/40 border border-purple-400/50 rounded-lg text-white text-sm font-semibold"
                  >
                    {field === 'about' && '📝 Sobre'}
                    {field === 'description' && '📄 Descrição'}
                    {field === 'email' && '📧 Email'}
                    {field === 'address' && '📍 Endereço'}
                    {field === 'vertical' && '🏢 Categoria'}
                    {field === 'websites' && '🌐 Websites'}
                  </span>
                ))}
              </div>
            </div>

            <div className="bg-gray-700/50 border-2 border-gray-600/50 rounded-xl p-6 mb-6">
              <h3 className="text-xl font-bold text-white mb-4">Dados que serão enviados:</h3>
              <pre className="text-sm text-green-300 bg-gray-900/50 p-4 rounded-lg overflow-x-auto">
                {JSON.stringify(previewData.dataToSend, null, 2)}
              </pre>
            </div>

            {previewData.inactiveAccounts > 0 && (
              <div className="bg-yellow-500/10 border-2 border-yellow-500/30 rounded-xl p-6 mb-6">
                <h3 className="text-xl font-bold text-yellow-300 mb-4 flex items-center gap-2">
                  <FaExclamationTriangle />
                  {previewData.inactiveAccounts} conta(s) inativa(s) serão ignorada(s):
                </h3>
                <div className="space-y-2">
                  {previewData.inactiveAccountsList.map(acc => (
                    <div key={acc.id} className="text-white/80">
                      • {acc.name} ({acc.phone})
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-4">
              <button
                onClick={() => setShowPreview(false)}
                className="flex-1 py-4 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-bold text-lg transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmUpdate}
                disabled={processing}
                className="flex-1 py-4 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-2 disabled:opacity-50 transition-all shadow-xl"
              >
                {processing ? (
                  <>
                    <FaSpinner className="animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <FaPlay />
                    Confirmar e Iniciar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showQueue && queueStatus && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-3xl p-8 max-w-6xl w-full max-h-[90vh] overflow-y-auto border-2 border-blue-500/50 shadow-2xl">
            
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-3xl font-bold text-white flex items-center gap-3">
                <FaClock className="text-blue-400" />
                Fila de Processamento
              </h2>
              <button
                onClick={() => setShowQueue(false)}
                className="text-white/60 hover:text-white text-3xl"
              >
                <FaTimes />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-500/20 border-2 border-blue-500/40 rounded-xl p-4">
                <div className="text-sm text-blue-300 mb-1">Total na Fila</div>
                <div className="text-3xl font-bold text-white">{queueStatus.total}</div>
              </div>
              <div className="bg-yellow-500/20 border-2 border-yellow-500/40 rounded-xl p-4">
                <div className="text-sm text-yellow-300 mb-1">Aguardando</div>
                <div className="text-3xl font-bold text-white">{queueStatus.pending}</div>
              </div>
              <div className="bg-purple-500/20 border-2 border-purple-500/40 rounded-xl p-4">
                <div className="text-sm text-purple-300 mb-1">Processando</div>
                <div className="text-3xl font-bold text-white">{queueStatus.processing}</div>
              </div>
              <div className="bg-green-500/20 border-2 border-green-500/40 rounded-xl p-4">
                <div className="text-sm text-green-300 mb-1">Intervalo</div>
                <div className="text-3xl font-bold text-white">{queueStatus.interval}s</div>
              </div>
            </div>

            <div className="space-y-3">
              {queueStatus.items.map((item, index) => (
                <div
                  key={item.id}
                  className={`p-4 rounded-xl border-2 ${
                    item.status === 'processing'
                      ? 'bg-yellow-500/20 border-yellow-500/40'
                      : item.status === 'completed'
                      ? 'bg-green-500/20 border-green-500/40'
                      : item.status === 'failed'
                      ? 'bg-red-500/20 border-red-500/40'
                      : 'bg-blue-500/20 border-blue-500/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="text-2xl font-bold text-white/60">#{index + 1}</div>
                      <div>
                        <div className="text-lg font-bold text-white">{item.accountName}</div>
                        <div className="text-sm text-white/60">{item.accountPhone}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-sm text-white/80">
                        {item.fieldsToUpdate.join(', ')}
                      </div>
                      
                      {item.status === 'processing' && (
                        <div className="flex items-center gap-2 text-yellow-300">
                          <FaSpinner className="animate-spin text-xl" />
                          <span className="font-bold">Processando...</span>
                        </div>
                      )}
                      {item.status === 'completed' && (
                        <div className="flex items-center gap-2 text-green-300">
                          <FaCheckCircle className="text-xl" />
                          <span className="font-bold">Concluído!</span>
                        </div>
                      )}
                      {item.status === 'failed' && (
                        <div className="flex items-center gap-2 text-red-300">
                          <FaExclamationTriangle className="text-xl" />
                          <span className="font-bold">Falhou</span>
                        </div>
                      )}
                      {item.status === 'pending' && (
                        <div className="flex items-center gap-2 text-blue-300">
                          <FaClock className="text-xl" />
                          <span className="font-bold">Aguardando</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {item.error && (
                    <div className="mt-2 text-sm text-red-300 bg-red-900/20 p-2 rounded">
                      ❌ {item.error}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {queueStatus.total === 0 && (
              <div className="text-center py-12 text-white/60">
                ✅ Fila vazia - todos os perfis foram processados!
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 border-2 border-purple-500/30 shadow-xl">
            
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-white">Contas</h2>
              <span className="px-3 py-1 bg-purple-600/40 border border-purple-400/50 rounded-lg text-white font-bold">
                {selectedAccounts.length} selecionadas
              </span>
            </div>

            <div className="relative mb-4">
              <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/40" />
              <input
                type="text"
                placeholder="Buscar conta..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-700/50 border-2 border-gray-600/50 focus:border-purple-500/50 rounded-xl text-white placeholder-white/40 transition-all"
              />
            </div>

            <button
              onClick={handleSelectAll}
              className="w-full py-3 bg-purple-600/40 hover:bg-purple-600/60 border-2 border-purple-500/50 rounded-xl text-white font-bold mb-4 transition-all"
            >
              {selectedAccounts.length === activeAccounts.length && activeAccounts.length > 0
                ? 'Desmarcar Todas'
                : 'Selecionar Todas Ativas'}
            </button>

            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
              {activeAccounts.map(account => (
                <div
                  key={account.id}
                  onClick={() => handleToggleAccount(account.id)}
                  className={`p-4 rounded-xl cursor-pointer transition-all border-2 ${
                    selectedAccounts.includes(account.id)
                      ? 'bg-purple-600/40 border-purple-500/60 shadow-lg scale-[1.02]'
                      : 'bg-gray-700/30 border-gray-600/30 hover:bg-gray-700/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center ${
                      selectedAccounts.includes(account.id)
                        ? 'bg-purple-500 border-purple-400'
                        : 'border-white/40'
                    }`}>
                      {selectedAccounts.includes(account.id) && (
                        <FaCheck className="text-white text-sm" />
                      )}
                    </div>
                    
                    <div className="flex-1">
                      <div className="font-bold text-white">{account.name}</div>
                      <div className="text-sm text-white/60">{account.phone_number}</div>
                    </div>

                    <div className="px-2 py-1 bg-green-500/30 border border-green-400/50 rounded text-xs text-green-300 font-bold">
                      ATIVA
                    </div>
                  </div>
                </div>
              ))}

              {inactiveAccounts.length > 0 && (
                <>
                  <div className="py-2 text-white/40 text-sm font-bold">Contas Inativas:</div>
                  {inactiveAccounts.map(account => (
                    <div
                      key={account.id}
                      className="p-4 rounded-xl bg-gray-700/20 border-2 border-gray-600/20 opacity-50"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-bold text-white">{account.name}</div>
                          <div className="text-sm text-white/60">{account.phone_number}</div>
                        </div>
                        <div className="px-2 py-1 bg-red-500/30 border border-red-400/50 rounded text-xs text-red-300 font-bold">
                          INATIVA
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 border-2 border-green-500/30 shadow-xl">
            <div className="flex items-center gap-4 pb-6 border-b-2 border-white/10 mb-6">
              <div className="bg-gradient-to-br from-pink-500 to-pink-600 p-4 rounded-xl shadow-lg">
                <FaUser className="text-4xl text-white" />
              </div>
              <div>
                <h2 className="text-4xl font-black text-white">
                  Perfil do Negócio
                </h2>
                <p className="text-lg text-white/60 mt-1">
                  Preencha apenas os campos que deseja atualizar
                </p>
              </div>
            </div>

            <div className="bg-blue-500/10 border-2 border-blue-500/30 rounded-xl p-6 mb-6">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <FaClock className="text-blue-400" />
                Configurações da Fila
              </h3>
              <div>
                <label className="block text-white mb-2 font-semibold">
                  Intervalo entre requisições: {queueInterval} segundos
                </label>
                <input
                  type="range"
                  min="1"
                  max="60"
                  value={queueInterval}
                  onChange={(e) => setQueueInterval(parseInt(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-sm text-white/60 mt-1">
                  <span>1s</span>
                  <span>30s</span>
                  <span>60s</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-white/80 font-medium mb-2">📝 Sobre (About)</label>
                <textarea
                  value={profileData.about}
                  onChange={(e) => setProfileData({ ...profileData, about: e.target.value })}
                  maxLength={139}
                  rows={3}
                  className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder-white/50"
                  placeholder="Breve descrição da empresa (deixe vazio para não alterar)"
                />
                <p className="text-white/50 text-sm mt-1">
                  {profileData.about.length}/139 caracteres
                </p>
              </div>

              <div>
                <label className="block text-white/80 font-medium mb-2">📄 Descrição Completa</label>
                <textarea
                  value={profileData.description}
                  onChange={(e) => setProfileData({ ...profileData, description: e.target.value })}
                  maxLength={512}
                  rows={5}
                  className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder-white/50"
                  placeholder="Descrição detalhada do negócio (deixe vazio para não alterar)"
                />
                <p className="text-white/50 text-sm mt-1">
                  {profileData.description.length}/512 caracteres
                </p>
              </div>

              <div>
                <label className="block text-white/80 font-medium mb-2">📧 Email de Contato</label>
                <input
                  type="email"
                  value={profileData.email}
                  onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder-white/50"
                  placeholder="contato@empresa.com (deixe vazio para não alterar)"
                />
              </div>

              <div>
                <label className="block text-white/80 font-medium mb-2">📍 Endereço</label>
                <input
                  type="text"
                  value={profileData.address}
                  onChange={(e) => setProfileData({ ...profileData, address: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder-white/50"
                  placeholder="Rua Exemplo, 123 - Cidade, Estado - CEP 00000-000 (deixe vazio para não alterar)"
                />
              </div>

              <div>
                <label className="block text-white/80 font-medium mb-2">🏢 Categoria do Negócio (Vertical)</label>
                <select
                  value={profileData.vertical}
                  onChange={(e) => setProfileData({ ...profileData, vertical: e.target.value })}
                  className="w-full px-4 py-3 bg-dark-700 border border-white/20 rounded-xl text-white appearance-none cursor-pointer hover:bg-dark-600 transition-colors"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='white'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 0.75rem center',
                    backgroundSize: '1.5em 1.5em',
                    paddingRight: '2.5rem'
                  }}
                >
                  <option value="">Não alterar categoria</option>
                  <option value="AUTOMOTIVE">🚗 Automotivo</option>
                  <option value="BEAUTY">💄 Beleza e Estética</option>
                  <option value="APPAREL">👕 Vestuário e Moda</option>
                  <option value="EDU">📚 Educação</option>
                  <option value="ENTERTAIN">🎬 Entretenimento</option>
                  <option value="EVENT_PLAN">🎉 Planejamento de Eventos</option>
                  <option value="FINANCE">💰 Financeiro</option>
                  <option value="GROCERY">🛒 Supermercado</option>
                  <option value="GOVT">🏛️ Governo</option>
                  <option value="HOTEL">🏨 Hotel e Hospedagem</option>
                  <option value="HEALTH">⚕️ Saúde</option>
                  <option value="NONPROFIT">❤️ Organização sem fins lucrativos</option>
                  <option value="PROF_SERVICES">💼 Serviços Profissionais</option>
                  <option value="RETAIL">🛍️ Varejo</option>
                  <option value="TRAVEL">✈️ Viagens e Turismo</option>
                  <option value="RESTAURANT">🍴 Restaurante</option>
                  <option value="OTHER">📦 Outro</option>
                </select>
              </div>

              <div className="space-y-4 p-6 bg-white/5 border border-white/10 rounded-xl">
                <h3 className="text-lg font-bold text-white mb-2">
                  🌐 Sites (Websites)
                </h3>
                <p className="text-white/60 text-sm mb-4">
                  Você pode adicionar até 2 sites (deixe vazio para não alterar)
                </p>
                
                <div>
                  <label className="block text-white/80 font-medium mb-2">Site Principal</label>
                  <input
                    type="url"
                    value={profileData.website1}
                    onChange={(e) => setProfileData({ ...profileData, website1: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder-white/50"
                    placeholder="https://www.seusite.com.br"
                  />
                </div>

                <div>
                  <label className="block text-white/80 font-medium mb-2">Site Secundário (opcional)</label>
                  <input
                    type="url"
                    value={profileData.website2}
                    onChange={(e) => setProfileData({ ...profileData, website2: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder-white/50"
                    placeholder="https://www.outrosite.com.br"
                  />
                </div>

                <p className="text-white/50 text-sm">
                  💡 URLs completas incluindo https://
                </p>
              </div>
            </div>

            <div className="flex gap-4 mt-8 pt-6 border-t-2 border-white/10">
              <button
                onClick={handleSaveProfile}
                disabled={processing || selectedAccounts.length === 0}
                className="flex-1 py-4 bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-500 hover:to-primary-400 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xl"
              >
                {processing ? (
                  <>
                    <FaSpinner className="animate-spin" />
                    Gerando Preview...
                  </>
                ) : (
                  <>
                    <FaSave />
                    Salvar Perfis
                  </>
                )}
              </button>

              <button
                onClick={() => setShowQueue(true)}
                className="px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white rounded-xl font-bold flex items-center gap-2 transition-all shadow-xl"
              >
                <FaClock />
                Ver Fila
              </button>
            </div>
          </div>
        </div>
      </div>
      </div>
    </>
  );
}
