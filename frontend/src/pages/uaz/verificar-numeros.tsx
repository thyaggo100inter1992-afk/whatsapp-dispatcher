import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { FaArrowLeft, FaCheckCircle, FaTimesCircle, FaSpinner, FaDownload, FaInfoCircle, FaSearchPlus } from 'react-icons/fa';
import api from '@/services/api';
import SystemLogo from '@/components/SystemLogo';

interface UazInstance {
  id: number;
  name: string;
  is_connected: boolean;
  is_active?: boolean;
}

interface VerificationResult {
  phone: string;
  exists: boolean;
  valid: boolean;
  verifiedName?: string;
  jid?: string;
  error?: string;
  instanceName?: string;
  instanceId?: number;
  profilePicUrl?: string | null;
}

interface VerificationHistory {
  id: number;
  phone_number: string;
  is_in_whatsapp: boolean;
  verified_name?: string;
  instance_name: string;
  verified_at: string;
}

export default function VerificarNumerosUaz() {
  const router = useRouter();
  
  // URL da API (produção ou desenvolvimento)
  // Remove apenas o /api do FINAL da URL, não do meio (ex: https://api.sistemasnettsistemas.com.br/api -> https://api.sistemasnettsistemas.com.br)
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/api$/, '') || 'http://localhost:3001';
  
  console.log('🌐 API_BASE_URL configurado:', API_BASE_URL);
  console.log('🌐 NEXT_PUBLIC_API_URL:', process.env.NEXT_PUBLIC_API_URL);
  
  const [instances, setInstances] = useState<UazInstance[]>([]);
  const [loading, setLoading] = useState(false);
  const [instanceId, setInstanceId] = useState('');
  const [selectedInstanceIds, setSelectedInstanceIds] = useState<number[]>([]);
  const [numbersText, setNumbersText] = useState('');
  const [results, setResults] = useState<VerificationResult[]>([]);
  const [history, setHistory] = useState<VerificationHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [delaySeconds, setDelaySeconds] = useState(2);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [activeTab, setActiveTab] = useState<'single' | 'bulk'>('single');
  const [singleNumber, setSingleNumber] = useState('');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);
  const [tempDelay, setTempDelay] = useState(2);
  const [currentJobId, setCurrentJobId] = useState<number | null>(null);
  const [jobStatus, setJobStatus] = useState<string>('');
  const [recentJobs, setRecentJobs] = useState<any[]>([]);
  const [activeJobs, setActiveJobs] = useState<Map<number, any>>(new Map());
  
  // Estado para modal de foto
  const [photoModal, setPhotoModal] = useState<{ show: boolean; url: string; name: string }>({
    show: false,
    url: '',
    name: ''
  });
  
  // Refs para controle em tempo real
  const isPausedRef = useRef(false);
  const isCancelledRef = useRef(false);
  const currentDelayRef = useRef(2);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const activeJobsPolling = useRef<Map<number, NodeJS.Timeout>>(new Map());

  useEffect(() => {
    loadInstances();
    loadHistory();
    loadJobs();
    
    // Cleanup polling ao desmontar
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      // Limpar todos os pollings ativos
      activeJobsPolling.current.forEach((interval) => clearInterval(interval));
      activeJobsPolling.current.clear();
    };
  }, []);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Fechar modal de foto com ESC
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && photoModal.show) {
        setPhotoModal({ show: false, url: '', name: '' });
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [photoModal.show]);

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
  };

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

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const response = await api.get('/uaz/verification-history', {
        params: { limit: 50 }
      });
      if (response.data.success) {
        setHistory(response.data.data);
      }
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const loadJobs = async () => {
    try {
      console.log('🔍 Carregando jobs...');
      const response = await api.get('/uaz/verification-jobs');
      
      if (response.data.success && response.data.data.length > 0) {
        console.log('📋 Jobs encontrados:', response.data.data.length);
        
        // Salvar lista de jobs recentes
        setRecentJobs(response.data.data.slice(0, 10)); // Últimos 10 jobs
        
        // Encontrar TODOS os jobs ativos (running ou paused)
        const runningJobs = response.data.data.filter((job: any) => 
          job.status === 'running' || job.status === 'paused'
        );
        
        if (runningJobs.length > 0) {
          console.log(`🔄 ${runningJobs.length} job(s) em andamento encontrado(s)!`);
          
          // Iniciar polling para cada job ativo
          runningJobs.forEach((job: any) => {
            startMultiJobPolling(job.id);
          });
          
          showNotification(`🔄 Retomando ${runningJobs.length} verificação(ões) em andamento...`, 'info');
        }
        
        // NÃO carregar automaticamente resultados de jobs completos
        // Resultados só serão exibidos quando usuário clicar em "Carregar Resultados"
      } else {
        console.log('📭 Nenhum job encontrado');
        setRecentJobs([]);
      }
    } catch (error) {
      console.error('❌ Erro ao carregar jobs:', error);
    }
  };

  const startMultiJobPolling = (jobId: number) => {
    // Se já existe polling para este job, não criar outro
    if (activeJobsPolling.current.has(jobId)) {
      return;
    }

    // Fazer primeira verificação imediatamente
    pollMultiJobStatus(jobId);

    // Configurar polling a cada 2 segundos
    const interval = setInterval(() => {
      pollMultiJobStatus(jobId);
    }, 2000);

    activeJobsPolling.current.set(jobId, interval);
    console.log(`▶️ Polling iniciado para Job #${jobId}`);
  };

  const stopMultiJobPolling = (jobId: number) => {
    const interval = activeJobsPolling.current.get(jobId);
    if (interval) {
      clearInterval(interval);
      activeJobsPolling.current.delete(jobId);
      console.log(`⏹️ Polling parado para Job #${jobId}`);
    }
  };

  const pollMultiJobStatus = async (jobId: number) => {
    try {
      const response = await api.get(`/uaz/verification-jobs/${jobId}`);
      
      if (response.data.success) {
        const job = response.data.data;
        
        // Atualizar estado do job
        setActiveJobs(prev => {
          const newMap = new Map(prev);
          newMap.set(jobId, job);
          return newMap;
        });

        // Se job finalizou, parar polling
        if (job.status === 'completed' || job.status === 'cancelled' || job.status === 'error') {
          stopMultiJobPolling(jobId);
          
          // Remover dos jobs ativos após 5 segundos
          setTimeout(() => {
            setActiveJobs(prev => {
              const newMap = new Map(prev);
              newMap.delete(jobId);
              return newMap;
            });
          }, 3001);
          
          if (job.status === 'completed') {
            showNotification(`✅ Job #${jobId} concluído!`, 'success');
          } else if (job.status === 'cancelled') {
            showNotification(`⛔ Job #${jobId} cancelado`, 'info');
          } else if (job.status === 'error') {
            showNotification(`❌ Job #${jobId} com erro`, 'error');
          }
          
          loadHistory();
          loadJobs(); // Recarregar lista de jobs
        }
      }
    } catch (error) {
      console.error(`❌ Erro ao consultar status do Job #${jobId}:`, error);
    }
  };

  const startPolling = (jobId: number) => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    pollJobStatus(jobId);
    pollingIntervalRef.current = setInterval(() => {
      pollJobStatus(jobId);
    }, 2000);
  };

  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  const pollJobStatus = async (jobId: number) => {
    try {
      const response = await api.get(`/uaz/verification-jobs/${jobId}`);
      
      if (response.data.success) {
        const job = response.data.data;
        
        setJobStatus(job.status);
        setProgress({
          current: job.progress.current,
          total: job.progress.total
        });
        setResults(job.results || []);
        setIsPaused(job.status === 'paused');
        setIsVerifying(job.status === 'running' || job.status === 'paused');

        if (job.status === 'completed' || job.status === 'cancelled' || job.status === 'error') {
          stopPolling();
          setLoading(false);
          setIsVerifying(false);
          
          if (job.status === 'completed') {
            const validCount = job.results.filter((r: any) => r.exists).length;
            const invalidCount = job.results.length - validCount;
            showNotification(`✅ Verificação concluída! Com WhatsApp: ${validCount} | Sem WhatsApp: ${invalidCount}`, 'success');
          } else if (job.status === 'cancelled') {
            showNotification('⛔ Verificação cancelada', 'info');
          } else if (job.status === 'error') {
            showNotification('❌ Erro na verificação: ' + job.error, 'error');
          }
          
          loadHistory();
          setCurrentJobId(null);
        }
      }
    } catch (error) {
      console.error('Erro ao consultar status do job:', error);
    }
  };

  const handleVerifySingle = async () => {
    if (!instanceId) {
      showNotification('Selecione uma instância', 'error');
      return;
    }

    if (!singleNumber.trim()) {
      showNotification('Digite o número para verificar', 'error');
      return;
    }

    setLoading(true);
    setResults([]);

    try {
      const response = await api.post(`/uaz/instances/${instanceId}/check-numbers`, {
        numbers: [singleNumber.trim()],
        delaySeconds: 0
      });

      if (response.data.success) {
        // Adicionar nome da instância ao resultado
        const currentInstance = instances.find(inst => inst.id === parseInt(instanceId));
        const resultsWithInstance = response.data.data.map((r: VerificationResult) => ({
          ...r,
          instanceName: currentInstance?.name || 'Desconhecida',
          instanceId: parseInt(instanceId)
        }));
        
        // 📸 Buscar foto de perfil para números com WhatsApp
        const resultsWithPhotos = await Promise.all(
          resultsWithInstance.map(async (r: VerificationResult) => {
            if (r.exists) {
              try {
                console.log('📸 Buscando foto para:', r.phone);
                const photoResponse = await api.post('/uaz/contact/details', {
                  instance_id: parseInt(instanceId),
                  phone_number: r.phone,
                  preview: false // false = foto FULL HD de alta qualidade
                });
                
                console.log('📸 Resposta da API:', photoResponse.data);
                
                if (photoResponse.data.success && photoResponse.data.contact) {
                  let photoUrl = photoResponse.data.contact.profilePicUrl;
                  console.log('✅ Foto encontrada:', photoUrl);
                  
                  // Se a foto for uma URL relativa (já salva localmente), adicionar o base URL
                  if (photoUrl && photoUrl.startsWith('/uploads/')) {
                    photoUrl = `${API_BASE_URL}${photoUrl}`;
                    console.log('🖼️ Usando foto local:', photoUrl);
                  }
                  
                  return {
                    ...r,
                    profilePicUrl: photoUrl
                  };
                } else {
                  console.warn('⚠️ Nenhuma foto retornada para:', r.phone);
                }
              } catch (error: any) {
                console.error('❌ Erro ao buscar foto:', error);
                console.error('   Detalhes:', error.response?.data);
              }
            }
            return r;
          })
        );
        
        console.log('📊 Resultados finais com fotos:', resultsWithPhotos);
        setResults(resultsWithPhotos);
        
        const result = resultsWithPhotos[0];
        if (result.exists) {
          const message = result.verifiedName 
            ? `✅ Com WhatsApp! - ${result.verifiedName}`
            : `✅ Com WhatsApp!`;
          showNotification(message, 'success');
        } else {
          showNotification(`❌ Sem WhatsApp`, 'error');
        }
        
        loadHistory();
      } else {
        showNotification('Erro: ' + response.data.error, 'error');
      }
    } catch (error: any) {
      showNotification('Erro: ' + (error.response?.data?.error || error.message), 'error');
    } finally {
      setLoading(false);
    }
  };

  const toggleInstanceSelection = (instId: number) => {
    setSelectedInstanceIds(prev => {
      if (prev.includes(instId)) {
        return prev.filter(id => id !== instId);
      } else {
        return [...prev, instId];
      }
    });
  };

  const selectAllInstances = () => {
    if (selectedInstanceIds.length === instances.length) {
      setSelectedInstanceIds([]);
    } else {
      setSelectedInstanceIds(instances.map(inst => inst.id));
    }
  };

  const handleVerifyBulk = async () => {
    if (selectedInstanceIds.length === 0) {
      showNotification('Selecione pelo menos uma instância', 'error');
      return;
    }

    if (!numbersText.trim()) {
      showNotification('Digite pelo menos um número', 'error');
      return;
    }

    const numbers = numbersText
      .split('\n')
      .map(n => n.trim())
      .filter(n => n.length > 0);

    if (numbers.length === 0) {
      showNotification('Nenhum número válido encontrado', 'error');
      return;
    }
    
    try {
      console.log('🚀 Criando job de verificação em background...');
      
      // Criar job no backend
      const response = await api.post('/uaz/verification-jobs', {
        instanceIds: selectedInstanceIds,
        numbers,
        delaySeconds,
        userIdentifier: 'default'
      });

      if (response.data.success) {
        const jobId = response.data.data.jobId;
        
        showNotification(`✅ Verificação #${jobId} iniciada! Você pode iniciar outras verificações ou sair e voltar depois.`, 'success');
        
        // Limpar o campo de números para permitir nova verificação
        setNumbersText('');
        
        // Iniciar polling para este job
        startMultiJobPolling(jobId);
        
        // Recarregar lista de jobs
        setTimeout(() => loadJobs(), 500);
      } else {
        showNotification('Erro: ' + response.data.error, 'error');
      }
    } catch (error: any) {
      showNotification('Erro: ' + (error.response?.data?.error || error.message), 'error');
    }
  };

  const handlePauseResume = async (jobId: number, isPaused: boolean) => {
    try {
      if (isPaused) {
        await api.post(`/uaz/verification-jobs/${jobId}/resume`);
        showNotification(`▶️ Job #${jobId} retomado`, 'success');
      } else {
        await api.post(`/uaz/verification-jobs/${jobId}/pause`);
        showNotification(`⏸️ Job #${jobId} pausado`, 'success');
      }
    } catch (error: any) {
      showNotification('Erro: ' + (error.response?.data?.error || error.message), 'error');
    }
  };

  const handleCancel = async (jobId: number) => {
    try {
      await api.post(`/uaz/verification-jobs/${jobId}/cancel`);
      showNotification(`⛔ Job #${jobId} cancelado`, 'info');
      stopMultiJobPolling(jobId);
    } catch (error: any) {
      showNotification('Erro: ' + (error.response?.data?.error || error.message), 'error');
    }
  };

  const handleUpdateDelay = () => {
    setDelaySeconds(tempDelay);
    currentDelayRef.current = tempDelay;
    showNotification(`⏱️ Delay atualizado para ${tempDelay}s (será aplicado em novos jobs)`, 'success');
  };

  const loadJobResults = async (jobId: number) => {
    try {
      showNotification('📥 Carregando resultados...', 'info');
      const response = await api.get(`/uaz/verification-jobs/${jobId}`);
      
      if (response.data.success) {
        setResults(response.data.data.results || []);
        setProgress({
          current: response.data.data.progress.total,
          total: response.data.data.progress.total
        });
        showNotification('✅ Resultados carregados!', 'success');
      }
    } catch (error: any) {
      showNotification('Erro ao carregar resultados: ' + (error.response?.data?.error || error.message), 'error');
    }
  };

  const exportValid = () => {
    const validNumbers = results
      .filter(r => r.exists)
      .map(r => r.phone)
      .join('\n');

    const blob = new Blob([validNumbers], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `numeros-validos-${new Date().getTime()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportToCSV = () => {
    const headers = 'Número;Status;Nome Verificado;Instância\n';
    const rows = results.map(r =>
      `${r.phone};${r.exists ? 'Com WhatsApp' : 'Sem WhatsApp'};${r.verifiedName || '-'};${r.instanceName || '-'}`
    ).join('\n');

    const csv = headers + rows;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `verificacao-whatsapp-${new Date().getTime()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportToExcel = () => {
    const headers = 'Número\tStatus\tNome Verificado\tInstância\n';
    const rows = results.map(r =>
      `="${r.phone}"\t${r.exists ? 'Com WhatsApp' : 'Sem WhatsApp'}\t${r.verifiedName || '-'}\t="${r.instanceName || '-'}"`
    ).join('\n');

    const excel = headers + rows;
    const blob = new Blob([excel], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `verificacao-whatsapp-${new Date().getTime()}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const validCount = results.filter(r => r.exists).length;
  const invalidCount = results.length - validCount;

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 py-8 px-4">
      
      <style jsx>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translate(-50%, -20px);
          }
          to {
            opacity: 1;
            transform: translate(-50%, 0);
          }
        }
        .slide-down {
          animation: slideDown 0.3s ease-out;
        }
      `}</style>

      {/* NOTIFICAÇÃO TOAST */}
      {notification && (
        <div className="fixed top-8 left-1/2 z-50 slide-down" style={{ transform: 'translateX(-50%)' }}>
          <div className={`
            px-8 py-4 rounded-2xl shadow-2xl border-2 backdrop-blur-xl flex items-center gap-4 min-w-[400px]
            ${notification.type === 'success' ? 'bg-green-500/90 border-green-400 text-white' : ''}
            ${notification.type === 'error' ? 'bg-red-500/90 border-red-400 text-white' : ''}
            ${notification.type === 'info' ? 'bg-blue-500/90 border-blue-400 text-white' : ''}
          `}>
            {notification.type === 'success' && <FaCheckCircle className="text-3xl" />}
            {notification.type === 'error' && <FaTimesCircle className="text-3xl" />}
            {notification.type === 'info' && <FaInfoCircle className="text-3xl" />}
            <span className="font-bold text-lg">{notification.message}</span>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* CABEÇALHO */}
        <div className="bg-gradient-to-r from-green-600/30 via-emerald-500/20 to-green-600/30 backdrop-blur-xl border-2 border-green-500/40 rounded-3xl p-10 shadow-2xl">
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <button
                onClick={() => router.push('/dashboard-uaz')}
                className="bg-white/10 hover:bg-white/20 p-4 rounded-xl transition-all duration-200 border-2 border-white/20 hover:border-white/40"
              >
                <FaArrowLeft className="text-3xl text-white" />
              </button>
              
              <div>
                <h1 className="text-5xl font-black text-white tracking-tight mb-2">
                  ✓ Verificar Números
                </h1>
                <p className="text-xl text-white/80 font-medium">
                  Valide quais números existem no WhatsApp
                </p>
              </div>
            </div>
            
            {/* Logo do Sistema */}
            <div className="flex-shrink-0">
              <SystemLogo className="h-20 w-auto" />
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          
          {/* FORMULÁRIO COM ABAS */}
          <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-green-500/40 rounded-2xl overflow-hidden">
            
            {/* TABS */}
            <div className="flex border-b-2 border-white/10">
              <button
                onClick={() => setActiveTab('single')}
                className={`flex-1 py-4 px-6 font-bold text-lg transition-all ${
                  activeTab === 'single'
                    ? 'bg-green-500/20 text-white border-b-4 border-green-500'
                    : 'bg-white/5 text-white/60 hover:bg-white/10'
                }`}
              >
                📱 Consulta Única
              </button>
              <button
                onClick={() => setActiveTab('bulk')}
                className={`flex-1 py-4 px-6 font-bold text-lg transition-all ${
                  activeTab === 'bulk'
                    ? 'bg-green-500/20 text-white border-b-4 border-green-500'
                    : 'bg-white/5 text-white/60 hover:bg-white/10'
                }`}
              >
                📋 Consulta em Massa
              </button>
            </div>

            {/* JOBS ATIVOS EM TEMPO REAL */}
            {activeJobs.size > 0 && (
              <div className="p-6 bg-gradient-to-r from-blue-500/20 to-purple-500/20 border-b-2 border-blue-500/40 space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                    🔄 {activeJobs.size} Verificação(ões) em Andamento
                  </h3>
                  <p className="text-white/60">Você pode sair e voltar. Tudo roda no servidor!</p>
                </div>

                {/* CARDS DOS JOBS ATIVOS */}
                <div className="grid gap-4">
                  {Array.from(activeJobs.entries()).map(([jobId, job]) => (
                    <div key={jobId} className="bg-dark-800/80 border-2 border-blue-500/40 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-4">
                          <div className={`p-2 rounded-lg ${job.status === 'paused' ? 'bg-yellow-500/20' : 'bg-blue-500/20'}`}>
                            {job.status === 'paused' ? (
                              <span className="text-2xl">⏸️</span>
                            ) : (
                              <FaSpinner className="text-blue-400 text-xl animate-spin" />
                            )}
                          </div>
                          <div>
                            <h4 className="text-xl font-black text-white">Job #{jobId}</h4>
                            <p className="text-sm text-white/60">
                              {job.progress.current}/{job.progress.total} números • {job.progress.percentage}% completo
                            </p>
                          </div>
                        </div>

                        {/* CONTROLES */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              handlePauseResume(jobId, job.status === 'paused');
                            }}
                            className={`px-4 py-2 rounded-lg font-bold transition-all ${
                              job.status === 'paused'
                                ? 'bg-green-500 hover:bg-green-600 text-white'
                                : 'bg-yellow-500 hover:bg-yellow-600 text-white'
                            }`}
                          >
                            {job.status === 'paused' ? '▶️ Continuar' : '⏸️ Pausar'}
                          </button>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              handleCancel(jobId);
                            }}
                            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-bold transition-all"
                          >
                            ⛔ Cancelar
                          </button>
                        </div>
                      </div>

                      {/* BARRA DE PROGRESSO */}
                      <div className="w-full bg-white/20 rounded-full h-2 overflow-hidden">
                        <div 
                          className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 transition-all duration-300"
                          style={{ width: `${job.progress.percentage}%` }}
                        />
                      </div>

                      {/* ESTATÍSTICAS */}
                      <div className="grid grid-cols-3 gap-2 mt-3">
                        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-2 text-center">
                          <p className="text-xl font-black text-green-300">{job.results.filter((r: any) => r.exists).length}</p>
                          <p className="text-xs text-white/60">Com WhatsApp</p>
                        </div>
                        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2 text-center">
                          <p className="text-xl font-black text-red-300">{job.results.filter((r: any) => !r.exists).length}</p>
                          <p className="text-xs text-white/60">Sem WhatsApp</p>
                        </div>
                        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-2 text-center">
                          <p className="text-xl font-black text-yellow-300">{job.progress.total - job.progress.current}</p>
                          <p className="text-xs text-white/60">Faltam</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="p-8">
              {/* ABA: CONSULTA ÚNICA */}
              {activeTab === 'single' && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-black text-white mb-4">
                    📱 Verificar Número Único
                  </h2>

                  {/* INSTÂNCIA */}
                  <div>
                    <label className="block text-lg font-bold mb-3 text-white">
                      📱 Instância WhatsApp
                    </label>
                    <select
                      className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white"
                      value={instanceId}
                      onChange={(e) => setInstanceId(e.target.value)}
                    >
                      <option value="">Selecione uma instância</option>
                      {instances.map((inst) => (
                        <option key={inst.id} value={inst.id}>
                          {inst.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* NÚMERO ÚNICO */}
                  <div>
                    <label className="block text-lg font-bold mb-3 text-white">
                      📞 Número do WhatsApp
                    </label>
                    <input
                      type="text"
                      className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-green-500 focus:ring-4 focus:ring-green-500/30 transition-all font-mono"
                      placeholder="5562912345678"
                      value={singleNumber}
                      onChange={(e) => setSingleNumber(e.target.value)}
                    />
                    <p className="text-sm text-white/60 mt-2">
                      Formato: código país + DDD + número (sem espaços)
                    </p>
                  </div>

                  {/* BOTÃO VERIFICAR */}
                  <button
                    onClick={handleVerifySingle}
                    disabled={loading}
                    className="w-full py-6 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white text-xl font-black rounded-xl shadow-2xl transition-all duration-200 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>
                        <FaSpinner className="animate-spin text-2xl" />
                        Verificando...
                      </>
                    ) : (
                      <>
                        <FaCheckCircle className="text-2xl" />
                        Verificar Número
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* ABA: CONSULTA EM MASSA */}
              {activeTab === 'bulk' && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-black text-white mb-4">
                    📋 Verificação em Massa
                  </h2>

                  {/* SELEÇÃO MÚLTIPLA DE INSTÂNCIAS */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-lg font-bold text-white">
                        📱 Instâncias WhatsApp (Selecione múltiplas)
                      </label>
                      <button
                        onClick={selectAllInstances}
                        disabled={isVerifying}
                        className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 text-blue-300 rounded-lg font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {selectedInstanceIds.length === instances.length ? '❌ Desmarcar Todas' : '✅ Selecionar Todas'}
                      </button>
                    </div>
                    <div className="bg-dark-700/80 border-2 border-white/20 rounded-xl p-4 max-h-60 overflow-y-auto space-y-2">
                      {instances.length === 0 ? (
                        <p className="text-white/50 text-center py-4">Nenhuma instância conectada</p>
                      ) : (
                        instances.map((inst) => (
                          <label
                            key={inst.id}
                            className={`flex items-center gap-4 p-4 rounded-lg cursor-pointer transition-all ${
                              selectedInstanceIds.includes(inst.id)
                                ? 'bg-green-500/20 border-2 border-green-500/40'
                                : 'bg-white/5 border-2 border-white/10 hover:bg-white/10'
                            } ${isVerifying ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedInstanceIds.includes(inst.id)}
                              onChange={() => toggleInstanceSelection(inst.id)}
                              disabled={isVerifying}
                              className="w-5 h-5 accent-green-500"
                            />
                            <div className="flex-1">
                              <p className="text-white font-bold text-lg">{inst.name}</p>
                              <p className="text-white/60 text-sm">ID: {inst.id}</p>
                            </div>
                            {selectedInstanceIds.includes(inst.id) && (
                              <FaCheckCircle className="text-green-400 text-xl" />
                            )}
                          </label>
                        ))
                      )}
                    </div>
                    <p className="text-sm text-white/60 mt-2">
                      {selectedInstanceIds.length > 0 
                        ? `✅ ${selectedInstanceIds.length} instância(s) selecionada(s) - As consultas serão distribuídas entre elas`
                        : '⚠️ Selecione pelo menos uma instância'}
                    </p>
                  </div>

                  {/* NÚMEROS */}
                  <div>
                    <label className="block text-lg font-bold mb-3 text-white">
                      📞 Números (um por linha)
                    </label>
                    <textarea
                      className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-green-500 focus:ring-4 focus:ring-green-500/30 transition-all font-mono disabled:opacity-50 disabled:cursor-not-allowed"
                      rows={8}
                      placeholder={"5562991234567\n5511987654321\n5521976543210\n5585965432109\n5511912345678"}
                      value={numbersText}
                      onChange={(e) => setNumbersText(e.target.value)}
                      disabled={isVerifying}
                    />
                    <p className="text-sm text-white/60 mt-2">
                      Digite um número por linha. Formato: código país + DDD + número
                    </p>
                  </div>

                  {/* DELAY ENTRE VERIFICAÇÕES */}
                  <div>
                    <label className="block text-lg font-bold mb-3 text-white">
                      ⏱️ Delay entre Verificações (segundos)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="60"
                      step="0.5"
                      value={delaySeconds}
                      onChange={(e) => setDelaySeconds(parseFloat(e.target.value) || 0)}
                      className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-green-500 focus:ring-4 focus:ring-green-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={isVerifying}
                    />
                    <p className="text-sm text-white/60 mt-2">
                      Aguardar {delaySeconds}s entre cada verificação para evitar bloqueios
                    </p>
                  </div>


                  {/* BOTÃO INICIAR VERIFICAÇÃO - SEMPRE DISPONÍVEL */}
                  <button
                    onClick={handleVerifyBulk}
                    className="w-full py-6 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white text-xl font-black rounded-xl shadow-2xl transition-all duration-200 flex items-center justify-center gap-3"
                  >
                    <FaCheckCircle className="text-2xl" />
                    🚀 Iniciar Nova Verificação em Massa
                  </button>
                  
                  {activeJobs.size > 0 && (
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 text-center">
                      <p className="text-white/80">
                        💡 <strong>{activeJobs.size} verificação(ões)</strong> em andamento. Você pode iniciar outra simultaneamente!
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* RESULTADOS */}
          <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-white/10 rounded-2xl overflow-hidden">
            <div className="p-6 border-b-2 border-white/10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-white">
                  📊 Resultados
                </h2>
                {results.length > 0 && (
                  <button
                    onClick={() => {
                      setResults([]);
                      setProgress({ current: 0, total: 0 });
                      showNotification('🗑️ Resultados limpos', 'info');
                    }}
                    className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-xl font-bold transition-all border border-red-500/40"
                  >
                    🗑️ Limpar Resultados
                  </button>
                )}
              </div>
              
              {results.length > 0 && (
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={exportValid}
                    className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold transition-all flex items-center gap-2"
                  >
                    <FaDownload />
                    TXT (Com WhatsApp)
                  </button>
                  <button
                    onClick={exportToCSV}
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold transition-all flex items-center gap-2"
                  >
                    <FaDownload />
                    CSV (Todos)
                  </button>
                  <button
                    onClick={exportToExcel}
                    className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-xl font-bold transition-all flex items-center gap-2"
                  >
                    <FaDownload />
                    Excel (Todos)
                  </button>
                </div>
              )}
            </div>

            {results.length === 0 ? (
              <div className="p-20 text-center">
                <p className="text-white/50 text-xl mb-4">
                  {loading ? 'Verificando números...' : 'Nenhum resultado carregado'}
                </p>
                {!loading && recentJobs.some(job => job.status === 'completed') && (
                  <p className="text-blue-400 text-sm">
                    💡 Clique em "Carregar Resultados" na seção de Jobs Recentes abaixo para visualizar
                  </p>
                )}
              </div>
            ) : (
              <>
                {/* ESTATÍSTICAS */}
                <div className="p-6 grid grid-cols-2 gap-4 border-b-2 border-white/10">
                  <div className="bg-green-500/20 border-2 border-green-500/40 rounded-xl p-4 text-center">
                    <p className="text-4xl font-black text-green-300 mb-2">{validCount}</p>
                    <p className="text-white/80 font-bold">Com WhatsApp</p>
                  </div>
                  <div className="bg-red-500/20 border-2 border-red-500/40 rounded-xl p-4 text-center">
                    <p className="text-4xl font-black text-red-300 mb-2">{invalidCount}</p>
                    <p className="text-white/80 font-bold">Sem WhatsApp</p>
                  </div>
                </div>

                {/* LISTA */}
                <div className="max-h-96 overflow-y-auto divide-y divide-white/10">
                  {results.map((result, index) => {
                    if (result.exists) {
                      console.log(`🎨 Renderizando ${result.phone}: profilePicUrl =`, result.profilePicUrl);
                    }
                    return (
                    <div key={index} className="p-4 hover:bg-white/5 transition-all">
                      <div className="flex items-center gap-4">
                        {/* 📸 FOTO DE PERFIL */}
                        {result.exists && (
                          <div className="flex-shrink-0 relative group">
                            {result.profilePicUrl && result.profilePicUrl !== 'null' ? (
                              <div className="relative">
                                <img
                                  src={result.profilePicUrl}
                                  alt={result.verifiedName || result.phone}
                                  className="w-16 h-16 rounded-full object-cover border-2 border-green-500/50 shadow-lg cursor-pointer hover:scale-110 hover:border-green-400 transition-all duration-200"
                                  onClick={() => setPhotoModal({ 
                                    show: true, 
                                    url: result.profilePicUrl!, 
                                    name: result.verifiedName || result.phone 
                                  })}
                                  title="Clique para ampliar a foto"
                                  onLoad={() => {
                                    console.log('✅ Imagem carregada com sucesso:', result.phone);
                                  }}
                                  onError={(e) => {
                                    // Fallback se a imagem não carregar
                                    console.error('❌ Erro ao carregar imagem:', result.phone, result.profilePicUrl);
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                    target.nextElementSibling?.classList.remove('hidden');
                                  }}
                                />
                                {/* Ícone de Lupa */}
                                <button
                                  onClick={() => setPhotoModal({ 
                                    show: true, 
                                    url: result.profilePicUrl!, 
                                    name: result.verifiedName || result.phone 
                                  })}
                                  className="absolute -bottom-1 -right-1 w-7 h-7 bg-green-500 hover:bg-green-600 text-white rounded-full flex items-center justify-center shadow-lg transition-all duration-200 group-hover:scale-110 border-2 border-dark-800"
                                  title="Ampliar foto"
                                >
                                  <FaSearchPlus className="text-xs" />
                                </button>
                              </div>
                            ) : null}
                            {/* Fallback: Inicial se não tiver foto */}
                            <div className={`w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-2xl border-2 border-blue-500/50 shadow-lg ${result.profilePicUrl ? 'hidden' : ''}`}>
                              {result.verifiedName ? result.verifiedName.charAt(0).toUpperCase() : '👤'}
                            </div>
                          </div>
                        )}
                        
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex-1">
                              <span className="text-white/90 font-mono text-lg block">{result.phone}</span>
                              {result.instanceName && (
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded-md font-bold border border-blue-500/40">
                                    📱 {result.instanceName}
                                  </span>
                                </div>
                              )}
                            </div>
                            {result.exists ? (
                              <div className="flex items-center gap-2">
                                <FaCheckCircle className="text-2xl text-green-400" />
                                <span className="text-green-400 font-bold">Com WhatsApp</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <FaTimesCircle className="text-2xl text-red-400" />
                                <span className="text-red-400 font-bold">Sem WhatsApp</span>
                              </div>
                            )}
                          </div>
                          {result.exists && result.verifiedName && (
                            <div className="flex items-center gap-2 text-sm text-white/70 mt-2">
                              <span className="font-bold">👤 Nome:</span>
                              <span>{result.verifiedName}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        {/* JOBS RECENTES */}
        {recentJobs.length > 0 && (
          <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-blue-500/40 rounded-2xl overflow-hidden">
            <div className="p-6 border-b-2 border-white/10 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                  📦 Verificações em Massa Recentes
                </h2>
                <p className="text-white/60 mt-2">Clique em "Carregar Resultados" para baixar</p>
              </div>
              <button
                onClick={loadJobs}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold transition-all"
              >
                🔄 Atualizar
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto divide-y divide-white/10">
              {recentJobs.map((job) => (
                <div key={job.id} className="p-4 hover:bg-white/5 transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-4 mb-2">
                        <span className="text-xl font-black text-white">Job #{job.id}</span>
                        {job.status === 'running' && (
                          <span className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-sm font-bold border border-blue-500/40">
                            🔄 Em Andamento
                          </span>
                        )}
                        {job.status === 'paused' && (
                          <span className="px-3 py-1 bg-yellow-500/20 text-yellow-300 rounded-full text-sm font-bold border border-yellow-500/40">
                            ⏸️ Pausado
                          </span>
                        )}
                        {job.status === 'completed' && (
                          <span className="px-3 py-1 bg-green-500/20 text-green-300 rounded-full text-sm font-bold border border-green-500/40">
                            ✅ Completo
                          </span>
                        )}
                        {job.status === 'cancelled' && (
                          <span className="px-3 py-1 bg-red-500/20 text-red-300 rounded-full text-sm font-bold border border-red-500/40">
                            ⛔ Cancelado
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-white/70">
                        <span>📊 {job.progress.current}/{job.progress.total} números</span>
                        <span>📈 {job.progress.percentage}% concluído</span>
                        <span>🕒 {new Date(job.createdAt).toLocaleString('pt-BR')}</span>
                      </div>
                    </div>
                    
                    {job.status === 'completed' && (
                      <button
                        onClick={() => loadJobResults(job.id)}
                        className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold transition-all flex items-center gap-2"
                      >
                        <FaDownload />
                        Carregar Resultados
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* HISTÓRICO DE VERIFICAÇÕES */}
        <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-purple-500/40 rounded-2xl overflow-hidden">
          <div className="p-6 border-b-2 border-white/10 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              📜 Histórico de Verificações (Individual)
              {loadingHistory && <FaSpinner className="animate-spin text-lg" />}
            </h2>
            <button
              onClick={loadHistory}
              className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-xl font-bold transition-all"
            >
              🔄 Atualizar
            </button>
          </div>

          {history.length === 0 ? (
            <div className="p-20 text-center">
              <p className="text-white/50 text-xl">
                {loadingHistory ? 'Carregando histórico...' : 'Nenhuma verificação no histórico ainda'}
              </p>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto divide-y divide-white/10">
              {history.map((item) => (
                <div key={item.id} className="p-4 hover:bg-white/5 transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white/90 font-mono text-lg">{item.phone_number}</span>
                    {item.is_in_whatsapp ? (
                      <div className="flex items-center gap-2">
                        <FaCheckCircle className="text-xl text-green-400" />
                        <span className="text-green-400 font-bold">Com WhatsApp</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <FaTimesCircle className="text-xl text-red-400" />
                        <span className="text-red-400 font-bold">Sem WhatsApp</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-white/60">
                    <span>📱 {item.instance_name}</span>
                    {item.verified_name && <span>👤 {item.verified_name}</span>}
                    <span>🕒 {new Date(item.verified_at).toLocaleString('pt-BR')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* INSTRUÇÕES */}
        <div className="bg-blue-500/10 border-2 border-blue-500/30 rounded-xl p-6">
          <h3 className="text-xl font-bold text-white mb-4">💡 Dicas e Recursos:</h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-bold text-white mb-2">📱 Consulta Única:</h4>
              <ul className="space-y-2 text-white/80 text-sm">
                <li>• Verifica <strong>1 número</strong> por vez</li>
                <li>• Resultado <strong>instantâneo</strong></li>
                <li>• Ideal para verificações rápidas</li>
                <li>• Mostra nome verificado do WhatsApp</li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-white mb-2">📋 Consulta em Massa:</h4>
              <ul className="space-y-2 text-white/80 text-sm">
                <li>• Verifica <strong>centenas</strong> de números</li>
                <li>• <strong>Múltiplas instâncias</strong> simultâneas (distribuição automática)</li>
                <li>• <strong>Delay configurável</strong> + altera durante execução</li>
                <li>• <strong>Pausa/Continua/Cancela</strong> a qualquer momento</li>
                <li>• Exporta em <strong>TXT, CSV ou Excel</strong> (com instância)</li>
                <li>• Progresso em <strong>tempo real</strong></li>
              </ul>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-white/10">
            <p className="text-white/80 text-sm">
              <strong>Formato:</strong> código do país + DDD + número (ex: 5562912345678) • 
              <strong> Histórico:</strong> Todas as verificações são salvas automaticamente
            </p>
          </div>
        </div>
      </div>

      {/* 🖼️ MODAL DE FOTO AMPLIADA */}
      {photoModal.show && (
        <div 
          className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-8 backdrop-blur-md"
          onClick={() => setPhotoModal({ show: false, url: '', name: '' })}
        >
          <div className="relative w-full h-full flex flex-col items-center justify-center animate-fadeIn">
            {/* Botão Fechar */}
            <button
              onClick={() => setPhotoModal({ show: false, url: '', name: '' })}
              className="absolute top-4 right-4 text-white hover:text-red-400 transition-colors duration-200 text-5xl font-bold z-10 bg-black/50 rounded-full w-16 h-16 flex items-center justify-center hover:bg-red-500/20"
              title="Fechar (ESC)"
            >
              ✕
            </button>
            
            {/* Nome do Contato */}
            <div className="absolute top-4 left-4 text-white text-2xl font-bold bg-black/50 px-6 py-3 rounded-xl backdrop-blur-sm">
              📸 {photoModal.name}
            </div>

            {/* Foto Ampliada - MUITO MAIOR */}
            <img
              src={photoModal.url}
              alt={photoModal.name}
              className="max-w-[90vw] max-h-[90vh] min-w-[500px] rounded-2xl shadow-2xl border-4 border-green-400/50 object-contain"
              style={{ width: 'auto', height: 'auto' }}
              onClick={(e) => e.stopPropagation()}
            />
            
            {/* Dica */}
            <div className="absolute bottom-4 left-0 right-0 text-center text-white/80 text-lg bg-black/50 py-2 backdrop-blur-sm">
              Clique fora da imagem ou pressione ESC para fechar
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

