import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { 
  FaSearch, FaArrowLeft, FaDownload, FaUpload, FaFileExcel, 
  FaFileCsv, FaUser, FaBuilding, FaPhone, FaEnvelope, 
  FaMapMarkerAlt, FaChartLine, FaUsers, FaPause, FaPlay,
  FaTimes, FaClock, FaCheckCircle, FaTimesCircle, FaSpinner, FaWhatsapp,
  FaDatabase, FaPlus, FaFilter, FaTrash, FaEdit, FaBan, FaShoppingCart, FaCopy,
  FaGift, FaFire, FaStar, FaBolt, FaInfoCircle
} from 'react-icons/fa';
import api from '@/services/api';
import * as XLSX from 'xlsx';
import BaseDados from '@/components/BaseDados';

interface ConsultaResult {
  success: boolean;
  tipo: 'CPF' | 'CNPJ';
  documento: string;
  dados?: any;
  erro?: string;
}

interface Job {
  id: number;
  status: string;
  progress_current: number;
  progress_total: number;
  results: ConsultaResult[];
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

export default function ConsultarDados() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'single' | 'bulk' | 'database' | 'verification' | 'lista-restricao' | 'comprar-consultas'>('single');
  
  // Consulta única
  const [singleDoc, setSingleDoc] = useState('');
  const [loadingSingle, setLoadingSingle] = useState(false);
  const [singleResult, setSingleResult] = useState<ConsultaResult | null>(null);
  
  // Consulta em massa
  const [bulkDocs, setBulkDocs] = useState('');
  const [delaySeconds, setDelaySeconds] = useState(0);
  const [verifyWhatsapp, setVerifyWhatsapp] = useState(true); // Ativo por padrão
  const [whatsappDelay, setWhatsappDelay] = useState(3); // 3 segundos por padrão (proteção contra banimento)
  const [loadingBulk, setLoadingBulk] = useState(false);
  
  // Jobs
  const [activeJobs, setActiveJobs] = useState<Map<number, Job>>(new Map());
  const activeJobsPolling = useRef<Map<number, NodeJS.Timeout>>(new Map());
  
  // Resultados carregados
  const [loadedResults, setLoadedResults] = useState<ConsultaResult[]>([]);
  
  // Histórico
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [historicoConsultas, setHistoricoConsultas] = useState<any[]>([]);
  
  // Modal de detalhes
  const [modalDetalhes, setModalDetalhes] = useState<ConsultaResult | null>(null);
  
  // Notificação
  const [notification, setNotification] = useState<{
    show: boolean;
    message: string;
    type: 'success' | 'error';
  }>({ show: false, message: '', type: 'success' });

  // Verificação e Higienização
  const [verificationCpfs, setVerificationCpfs] = useState('');
  const [verificationFile, setVerificationFile] = useState<File | null>(null);
  const [verificationResults, setVerificationResults] = useState<{
    found: any[];
    notFound: string[];
  } | null>(null);
  const [verifyingCpfs, setVerifyingCpfs] = useState(false);
  const [hygienizing, setHygienizing] = useState(false);
  const [hygienizationProgress, setHygienizationProgress] = useState({
    total: 0,
    current: 0,
    remaining: 0
  });
  const [verifyWhatsappCheck, setVerifyWhatsappCheck] = useState(false);
  const [whatsappColumnChoice, setWhatsappColumnChoice] = useState<'first' | 'second' | 'third' | 'all'>('first');
  const [hygienizationDelay, setHygienizationDelay] = useState(2);
  const [showWhatsappOptions, setShowWhatsappOptions] = useState(false);
  const [allHygienizedData, setAllHygienizedData] = useState<any[]>([]);

  // Lista de Restrição
  const [listaRestricaoCpfs, setListaRestricaoCpfs] = useState<any[]>([]);
  const [loadingListaRestricao, setLoadingListaRestricao] = useState(false);
  const [novoCpfRestricao, setNovoCpfRestricao] = useState('');

  // Comprar Consultas Avulsas
  const [pacotes, setPacotes] = useState<any[]>([]);
  const [saldoAvulso, setSaldoAvulso] = useState(0);
  const [loadingPacotes, setLoadingPacotes] = useState(false);
  const [quantidadeCustomizada, setQuantidadeCustomizada] = useState('');
  const [processingCompra, setProcessingCompra] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentData, setPaymentData] = useState<any>(null);

  // Limite de consultas
  const [limiteInfo, setLimiteInfo] = useState<{
    limite_dia: number;
    consultas_hoje: number;
    limite_mes: number;
    consultas_mes: number;
    consultas_avulsas_saldo: number;
    consultas_avulsas_usadas: number;
    limite_dia_atingido: boolean;
    limite_mes_atingido: boolean;
  } | null>(null);

  // WhatsApp Profile Photos
  const [phonePhotos, setPhonePhotos] = useState<Map<string, { url: string | null; name: string; hasWhatsApp?: boolean }>>(new Map());
  const [loadingPhones, setLoadingPhones] = useState<Set<string>>(new Set());
  const [selectedPhotoModal, setSelectedPhotoModal] = useState<{ url: string; name: string; phone: string } | null>(null);

  // Carregar jobs, histórico e limite ao montar
  useEffect(() => {
    loadJobs();
    loadHistorico();
    loadLimite();
    return () => {
      // Limpar polling ao desmontar
      activeJobsPolling.current.forEach(interval => clearInterval(interval));
    };
  }, []);

  // Carregar informações de limite
  const loadLimite = async () => {
    try {
      console.log('🔍 Carregando limites do plano...');
      const response = await api.get('/novavida/limite');
      console.log('📊 Resposta da API /novavida/limite:', response.data);
      if (response.data.success) {
        setLimiteInfo(response.data);
        console.log('✅ limiteInfo atualizado:', response.data);
      } else {
        console.warn('⚠️ API retornou success: false');
      }
    } catch (error) {
      console.error('❌ Erro ao carregar limite:', error);
    }
  };

  // Função para mostrar notificação
  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => {
      setNotification({ show: false, message: '', type: 'success' });
    }, 3001);
  };

  // Carregar jobs existentes
  const loadJobs = async () => {
    try {
      const response = await api.get('/novavida/jobs');
      const allJobs = response.data.jobs || [];
      
      // Separar jobs ativos e recentes
      const active = allJobs.filter((j: Job) => 
        j.status === 'running' || j.status === 'paused'
      );
      const completed = allJobs.filter((j: Job) => 
        j.status === 'completed' || j.status === 'cancelled' || j.status === 'error'
      ).slice(0, 5);
      
      // Adicionar jobs ativos ao Map
      const newActiveJobs = new Map<number, Job>();
      active.forEach((job: Job) => {
        newActiveJobs.set(job.id, job);
        if (job.status === 'running') {
          startMultiJobPolling(job.id);
        }
      });
      
      setActiveJobs(newActiveJobs);
      setRecentJobs(completed);
    } catch (error) {
      console.error('Erro ao carregar jobs:', error);
    }
  };

  // Carregar histórico de consultas únicas
  const loadHistorico = async () => {
    try {
      const response = await api.get('/novavida/historico', {
        params: { limit: 10 }
      });
      console.log('📚 Histórico carregado:', response.data);
      const consultas = response.data.consultas || [];
      console.log('📊 Total de consultas:', consultas.length);
      setHistoricoConsultas(consultas);
    } catch (error) {
      console.error('❌ Erro ao carregar histórico:', error);
    }
  };

  // Carregar TODAS as consultas (únicas + massa)
  const [todasConsultas, setTodasConsultas] = useState<any[]>([]);
  const [consultasFiltradas, setConsultasFiltradas] = useState<any[]>([]);
  const [mostrarTodasConsultas, setMostrarTodasConsultas] = useState(false);
  
  // Filtros
  const [filtroTipo, setFiltroTipo] = useState<'todas' | 'unica' | 'massa'>('todas');
  const [filtroDataInicio, setFiltroDataInicio] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');
  
  const loadTodasConsultas = async () => {
    try {
      setMostrarTodasConsultas(true);
      
      // Buscar consultas únicas (todas)
      const responseUnicas = await api.get('/novavida/historico', {
        params: { limit: 1000 } // Buscar muitas consultas
      });
      const consultasUnicas = (responseUnicas.data.consultas || []).map((c: any) => ({
        ...c,
        tipo_consulta: 'unica',
        data: c.created_at
      }));

      // Buscar jobs (consultas em massa) - todos
      const responseJobs = await api.get('/novavida/jobs');
      const jobs = (responseJobs.data.jobs || []).map((j: any) => ({
        ...j,
        tipo_consulta: 'massa',
        data: j.created_at
      }));

      // Combinar e ordenar por data (mais recentes primeiro)
      const todas = [...consultasUnicas, ...jobs].sort((a, b) => 
        new Date(b.data).getTime() - new Date(a.data).getTime()
      );

      setTodasConsultas(todas);
      setConsultasFiltradas(todas);
      showNotification(`${todas.length} consultas encontradas!`, 'success');
    } catch (error) {
      console.error('Erro ao carregar todas as consultas:', error);
      showNotification('Erro ao carregar consultas', 'error');
    }
  };

  // Aplicar filtros
  useEffect(() => {
    let filtradas = [...todasConsultas];

    console.log('🔍 Aplicando filtros:', { 
      total: todasConsultas.length, 
      filtroTipo, 
      filtroDataInicio, 
      filtroDataFim 
    });

    // Filtro por tipo
    if (filtroTipo !== 'todas') {
      filtradas = filtradas.filter(c => c.tipo_consulta === filtroTipo);
      console.log('Após filtro tipo:', filtradas.length);
    }

    // Filtro por data
    if (filtroDataInicio) {
      // Criar data de início no timezone local
      const [ano, mes, dia] = filtroDataInicio.split('-').map(Number);
      const dataInicio = new Date(ano, mes - 1, dia, 0, 0, 0, 0);
      
      filtradas = filtradas.filter(c => {
        const dataConsulta = new Date(c.data);
        return dataConsulta >= dataInicio;
      });
      console.log('Após filtro data início:', filtradas.length, 'Data início:', dataInicio);
    }

    if (filtroDataFim) {
      // Criar data de fim no timezone local
      const [ano, mes, dia] = filtroDataFim.split('-').map(Number);
      const dataFim = new Date(ano, mes - 1, dia, 23, 59, 59, 999);
      
      filtradas = filtradas.filter(c => {
        const dataConsulta = new Date(c.data);
        return dataConsulta <= dataFim;
      });
      console.log('Após filtro data fim:', filtradas.length, 'Data fim:', dataFim);
    }

    console.log('✅ Resultado final:', filtradas.length, 'consultas');
    setConsultasFiltradas(filtradas);
  }, [filtroTipo, filtroDataInicio, filtroDataFim, todasConsultas]);

  // Iniciar polling para um job específico
  const startMultiJobPolling = (jobId: number) => {
    if (activeJobsPolling.current.has(jobId)) return;
    
    const interval = setInterval(async () => {
      try {
        const response = await api.get(`/novavida/jobs/${jobId}`);
        const job: Job = response.data;
        
        setActiveJobs(prev => {
          const newMap = new Map(prev);
          newMap.set(jobId, job);
          return newMap;
        });
        
        // Se completou, parar polling
        if (job.status === 'completed' || job.status === 'cancelled' || job.status === 'error') {
          stopMultiJobPolling(jobId);
          loadJobs(); // Recarregar lista
        }
      } catch (error) {
        console.error(`Erro ao buscar status do job ${jobId}:`, error);
      }
    }, 3000);
    
    activeJobsPolling.current.set(jobId, interval);
  };

  // Parar polling de um job
  const stopMultiJobPolling = (jobId: number) => {
    const interval = activeJobsPolling.current.get(jobId);
    if (interval) {
      clearInterval(interval);
      activeJobsPolling.current.delete(jobId);
    }
  };

  // Consulta única
  const handleSingleConsult = async () => {
    if (!singleDoc.trim()) {
      showNotification('Digite um CPF ou CNPJ', 'error');
      return;
    }
    
    setLoadingSingle(true);
    setSingleResult(null);
    
    try {
      const response = await api.post('/novavida/consultar', {
        documento: singleDoc.trim()
      });
      
      setSingleResult(response.data);
      
      if (response.data.success) {
        showNotification('Consulta realizada com sucesso!', 'success');
        // Recarregar histórico e limite
        loadHistorico();
        loadLimite();
        
        // 📸 Buscar fotos de perfil automaticamente para telefones com WhatsApp
        const telefones = response.data.dados?.TELEFONES || [];
        const telefonesComWhatsApp = telefones.filter((t: any) => t.HAS_WHATSAPP === true);
        
        if (telefonesComWhatsApp.length > 0) {
          console.log(`📸 Buscando fotos de perfil para ${telefonesComWhatsApp.length} telefone(s) com WhatsApp...`);
          // Buscar fotos em background (não bloquear a UI)
          setTimeout(() => {
            consultarWhatsappProfile(telefonesComWhatsApp);
          }, 500);
        }
      } else {
        showNotification(`Erro: ${response.data.erro}`, 'error');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.response?.data?.error || 'Erro ao realizar consulta';
      showNotification(errorMessage, 'error');
    } finally {
      setLoadingSingle(false);
    }
  };

  // Consulta em massa
  const handleBulkConsult = async () => {
    console.log('📂 CONSULTA EM MASSA - Iniciando consulta');
    console.log('📋 Texto original:', bulkDocs);
    
    const docs = bulkDocs
      .split('\n')
      .map((line, index) => {
        const original = line.trim();
        let doc = original.replace(/\D/g, '');
        
        // Corrigir CPFs/CNPJs que perderam zero à esquerda
        if (doc.length === 10) {
          // CPF com 10 dígitos = falta 1 zero à esquerda
          doc = '0' + doc;
          console.log(`🔧 [${index + 1}] CPF corrigido ao colar: ${original} → ${doc}`);
        } else if (doc.length === 13) {
          // CNPJ com 13 dígitos = falta 1 zero à esquerda
          doc = '0' + doc;
          console.log(`🔧 [${index + 1}] CNPJ corrigido ao colar: ${original} → ${doc}`);
        }
        
        return doc;
      })
      .filter(Boolean);
    
    console.log(`✅ Total de documentos válidos: ${docs.length}`);
    console.log('📤 Documentos que serão consultados:', docs);
    
    if (docs.length === 0) {
      showNotification('Digite pelo menos um documento', 'error');
      return;
    }
    
    setLoadingBulk(true);
    
    try {
      const response = await api.post('/novavida/jobs', {
        documentos: docs,
        delaySeconds,
        verifyWhatsapp, // Nova opção
        whatsappDelay   // Nova opção
      });
      
      const jobId = response.data.jobId;
      
      // Verificar se houve CPFs bloqueados
      if (response.data.totalBloqueados > 0) {
        showNotification(
          `⚠️ ${response.data.totalBloqueados} CPF(s) bloqueado(s) removido(s) (Lista de Restrição). Consultando ${response.data.totalPermitidos} CPF(s). (Job #${jobId})`,
          'success'
        );
      } else {
        showNotification(`Consulta em massa iniciada! (Job #${jobId})`, 'success');
      }
      
      // Recarregar jobs
      await loadJobs();
      startMultiJobPolling(jobId);
    } catch (error: any) {
      const errorData = error.response?.data;
      
      // Se for erro de créditos insuficientes, mostrar mensagem detalhada
      if (errorData?.error === 'Créditos avulsos insuficientes') {
        showNotification(
          `${errorData.message}\n\n💡 Você pode:\n• Adicionar mais consultas avulsas no admin\n• Reduzir a quantidade de CPFs para ${errorData.saldo_disponivel}`,
          'error'
        );
      } else {
        showNotification(errorData?.message || errorData?.error || 'Erro ao iniciar consulta em massa', 'error');
      }
    } finally {
      setLoadingBulk(false);
    }
  };

  // Pausar/Retomar job
  const handlePauseResume = async (jobId: number, currentStatus: string) => {
    try {
      if (currentStatus === 'running') {
        await api.post(`/novavida/jobs/${jobId}/pause`);
        showNotification('Job pausado', 'success');
      } else if (currentStatus === 'paused') {
        await api.post(`/novavida/jobs/${jobId}/resume`);
        showNotification('Job retomado', 'success');
        startMultiJobPolling(jobId);
      }
      
      loadJobs();
    } catch (error: any) {
      showNotification(error.response?.data?.error || 'Erro ao pausar/retomar', 'error');
    }
  };

  // Cancelar job
  const handleCancel = async (jobId: number) => {
    try {
      await api.post(`/novavida/jobs/${jobId}/cancel`);
      showNotification('Job cancelado', 'success');
      stopMultiJobPolling(jobId);
      loadJobs();
    } catch (error: any) {
      showNotification(error.response?.data?.error || 'Erro ao cancelar', 'error');
    }
  };

  // Carregar resultados de um job
  const handleLoadJobResults = async (jobId: number) => {
    try {
      const response = await api.get(`/novavida/jobs/${jobId}`);
      const job: Job = response.data;
      setLoadedResults(job.results || []);
      showNotification('Resultados carregados!', 'success');
      
      // Scroll para resultados
      setTimeout(() => {
        document.getElementById('resultados-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (error: any) {
      showNotification(error.response?.data?.error || 'Erro ao carregar resultados', 'error');
    }
  };

  // Upload de Excel/CSV
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
        
        console.log('📂 CONSULTA EM MASSA - Upload de arquivo');
        console.log('📋 Total de linhas no arquivo:', jsonData.length - 1);
        
        // Extrair documentos (assumindo que estão na primeira coluna)
        const docs = jsonData
          .slice(1) // Pular cabeçalho
          .map((row: any, index) => {
            const original = String(row[0] || '').trim();
            let doc = original.replace(/\D/g, '');
            
            // Corrigir CPFs/CNPJs que perderam zero à esquerda no Excel
            if (doc.length === 10) {
              // CPF com 10 dígitos = falta 1 zero à esquerda
              doc = '0' + doc;
              console.log(`🔧 [${index + 1}] CPF corrigido: ${original} → ${doc}`);
            } else if (doc.length === 13) {
              // CNPJ com 13 dígitos = falta 1 zero à esquerda
              doc = '0' + doc;
              console.log(`🔧 [${index + 1}] CNPJ corrigido: ${original} → ${doc}`);
            }
            
            return doc;
          })
          .filter(Boolean);
        
        console.log(`✅ Total de documentos válidos: ${docs.length}`);
        
        setBulkDocs(docs.join('\n'));
        showNotification(`${docs.length} documentos carregados do arquivo`, 'success');
      } catch (error) {
        console.error('❌ Erro ao processar arquivo:', error);
        showNotification('Erro ao ler arquivo. Use Excel ou CSV válido.', 'error');
      }
    };
    
    reader.readAsBinaryString(file);
  };

  // Export para Excel - FORMATO ESPECÍFICO NOVA VIDA
  const handleExportExcel = () => {
    if (loadedResults.length === 0) {
      showNotification('Nenhum resultado para exportar', 'error');
      return;
    }
    
    const dataToExport = loadedResults.map(r => {
      // ✅ Estrutura EXATA solicitada pelo cliente
      const row: any = {};
      
      if (r.tipo === 'CPF' && r.success && r.dados) {
        const cad = r.dados.CADASTRAIS || {};
        const telefones = r.dados.TELEFONES || [];
        const emails = r.dados.EMAILS || [];
        const enderecos = r.dados.ENDERECOS || [];
        const endereco = enderecos[0] || {};
        
        // 🔍 DEBUG: Ver o que vem da API
        console.log('🔍 Campos CADASTRAIS da API:', {
          MAE: cad.MAE,
          NOME_MAE: cad.NOME_MAE,
          FLAG_DE_OBITO: cad.FLAG_DE_OBITO,
          OBITO: cad.OBITO,
          SCORE_DIGITAL: cad.SCORE_DIGITAL,
          FLAG_FGTS: cad.FLAG_FGTS
        });
        
        // CAMPOS CADASTRAIS
        row['CPF'] = r.documento;
        row['NOME'] = cad.NOME || '';
        row['NOME_MAE'] = cad.MAE || cad.NOME_MAE || cad.NOMEMAE || ''; // Múltiplas variações
        row['SEXO'] = cad.SEXO || '';
        row['NASC'] = cad.NASC || '';
        row['RENDA'] = cad.RENDA || '';
        row['TIPO'] = cad.TIPO || '';
        row['TITULO'] = cad.TITULO || '';
        
        // ENDEREÇO
        row['LOGRADOURO'] = endereco.LOGRADOURO || '';
        row['NUMERO'] = endereco.NUMERO || '';
        row['COMPLEMENTO'] = endereco.COMPLEMENTO || '';
        row['BAIRRO'] = endereco.BAIRRO || '';
        row['CIDADE'] = endereco.CIDADE || '';
        row['UF'] = endereco.UF || '';
        row['CEP'] = endereco.CEP || '';
        row['AREARISCO'] = endereco.AREARISCO || '';
        
        // CELULAR 1
        const cel1 = telefones[0];
        if (cel1) {
          row['CEL1'] = `55${cel1.DDD}${cel1.TELEFONE}`;
          row['FLGWHATSCEL1'] = ''; // Flag da API Nova Vida (se houver)
          row['CONSULTADO_SISTEMA_CEL1'] = cel1.WHATSAPP_VERIFIED ? (cel1.HAS_WHATSAPP ? 'Com WhatsApp' : 'Sem WhatsApp') : '';
          row['PROCONCEL1'] = cel1.PROCON || '';
        } else {
          row['CEL1'] = '';
          row['FLGWHATSCEL1'] = '';
          row['CONSULTADO_SISTEMA_CEL1'] = '';
          row['PROCONCEL1'] = '';
        }
        
        // CELULAR 2
        const cel2 = telefones[1];
        if (cel2) {
          row['CEL2'] = `55${cel2.DDD}${cel2.TELEFONE}`;
          row['FLGWHATSCEL2'] = ''; // Flag da API Nova Vida (se houver)
          row['CONSULTADO_SISTEMA_CEL2'] = cel2.WHATSAPP_VERIFIED ? (cel2.HAS_WHATSAPP ? 'Com WhatsApp' : 'Sem WhatsApp') : '';
          row['PROCONCEL2'] = cel2.PROCON || '';
        } else {
          row['CEL2'] = '';
          row['FLGWHATSCEL2'] = '';
          row['CONSULTADO_SISTEMA_CEL2'] = '';
          row['PROCONCEL2'] = '';
        }
        
        // EMAILS
        row['EMAIL1'] = emails[0]?.EMAIL || '';
        row['EMAIL2'] = emails[1]?.EMAIL || '';
        row['EMAIL3'] = emails[2]?.EMAIL || '';
        
        // FLAGS E SCORES
        row['FLAG_DE_OBITO'] = cad.FLAG_DE_OBITO || cad.OBITO || cad.FLAGOBITO || cad.FLG_OBITO || '';
        row['SCORE_CREDITO'] = cad.SCORE || cad.SCORE_CREDITO || '';
        row['SCORE_DIGITAL'] = cad.SCORE_DIGITAL || cad.SCOREDIGITAL || '';
        row['FLAG_FGTS'] = cad.FLAG_FGTS || cad.FLAGFGTS || cad.FLG_FGTS || cad.FGTS || '';
        
      } else if (r.tipo === 'CNPJ' && r.success && r.dados) {
        // Para CNPJ, preencher apenas campos compatíveis
        const cad = r.dados.CADASTRAIS || {};
        const telefones = r.dados.TELEFONES || [];
        const emails = r.dados.EMAILS || [];
        const enderecos = r.dados.ENDERECOS || [];
        const endereco = enderecos[0] || {};
        
        row['CPF'] = r.documento; // Mantém coluna CPF para CNPJ
        row['NOME'] = cad.RAZAO || cad.NOME_FANTASIA || '';
        row['NOME_MAE'] = '';
        row['SEXO'] = '';
        row['NASC'] = cad.DATA_ABERTURA || '';
        row['RENDA'] = '';
        row['TIPO'] = 'CNPJ';
        row['TITULO'] = '';
        
        // Endereço
        row['LOGRADOURO'] = endereco.LOGRADOURO || '';
        row['NUMERO'] = endereco.NUMERO || '';
        row['COMPLEMENTO'] = endereco.COMPLEMENTO || '';
        row['BAIRRO'] = endereco.BAIRRO || '';
        row['CIDADE'] = endereco.CIDADE || '';
        row['UF'] = endereco.UF || '';
        row['CEP'] = endereco.CEP || '';
        row['AREARISCO'] = '';
        
        // Telefones
        const cel1 = telefones[0];
        if (cel1) {
          row['CEL1'] = `55${cel1.DDD}${cel1.TELEFONE}`;
          row['FLGWHATSCEL1'] = ''; // Flag da API Nova Vida
          row['CONSULTADO_SISTEMA_CEL1'] = cel1.WHATSAPP_VERIFIED ? (cel1.HAS_WHATSAPP ? 'Com WhatsApp' : 'Sem WhatsApp') : '';
          row['PROCONCEL1'] = '';
        } else {
          row['CEL1'] = '';
          row['FLGWHATSCEL1'] = '';
          row['CONSULTADO_SISTEMA_CEL1'] = '';
          row['PROCONCEL1'] = '';
        }
        
        const cel2 = telefones[1];
        if (cel2) {
          row['CEL2'] = `55${cel2.DDD}${cel2.TELEFONE}`;
          row['FLGWHATSCEL2'] = ''; // Flag da API Nova Vida
          row['CONSULTADO_SISTEMA_CEL2'] = cel2.WHATSAPP_VERIFIED ? (cel2.HAS_WHATSAPP ? 'Com WhatsApp' : 'Sem WhatsApp') : '';
          row['PROCONCEL2'] = '';
        } else {
          row['CEL2'] = '';
          row['FLGWHATSCEL2'] = '';
          row['CONSULTADO_SISTEMA_CEL2'] = '';
          row['PROCONCEL2'] = '';
        }
        
        // Emails
        row['EMAIL1'] = emails[0]?.EMAIL || '';
        row['EMAIL2'] = emails[1]?.EMAIL || '';
        row['EMAIL3'] = emails[2]?.EMAIL || '';
        
        // Flags
        row['FLAG_DE_OBITO'] = '';
        row['SCORE_CREDITO'] = cad.SCORE || '';
        row['SCORE_DIGITAL'] = '';
        row['FLAG_FGTS'] = '';
      } else {
        // Erro na consulta - preencher campos básicos
        row['CPF'] = r.documento;
        row['NOME'] = 'ERRO: ' + (r.erro || 'Consulta falhou');
        // Preencher demais campos vazios
        ['NOME_MAE', 'SEXO', 'NASC', 'RENDA', 'TIPO', 'TITULO', 'LOGRADOURO', 'NUMERO', 
         'COMPLEMENTO', 'BAIRRO', 'CIDADE', 'UF', 'CEP', 'AREARISCO', 'CEL1', 'FLGWHATSCEL1',
         'CONSULTADO_SISTEMA_CEL1', 'PROCONCEL1', 'CEL2', 'FLGWHATSCEL2', 'CONSULTADO_SISTEMA_CEL2',
         'PROCONCEL2', 'EMAIL1', 'EMAIL2', 'EMAIL3', 'FLAG_DE_OBITO', 'SCORE_CREDITO', 
         'SCORE_DIGITAL', 'FLAG_FGTS'].forEach(field => {
          if (!row[field]) row[field] = '';
        });
      }
      
      return row;
    });
    
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Consultas');
    XLSX.writeFile(wb, `Consulta-NETTSistemas-${Date.now()}.xlsx`);
    
    showNotification('Excel exportado com sucesso!', 'success');
  };

  // Export para CSV - FORMATO ESPECÍFICO NOVA VIDA
  const handleExportCSV = () => {
    if (loadedResults.length === 0) {
      showNotification('Nenhum resultado para exportar', 'error');
      return;
    }
    
    // Headers EXATOS conforme solicitado + CONSULTADO PELO SISTEMA
    const headers = [
      'CPF', 'NOME', 'NOME_MAE', 'SEXO', 'NASC', 'RENDA', 'TIPO', 'TITULO',
      'LOGRADOURO', 'NUMERO', 'COMPLEMENTO', 'BAIRRO', 'CIDADE', 'UF', 'CEP', 'AREARISCO',
      'CEL1', 'FLGWHATSCEL1', 'CONSULTADO_SISTEMA_CEL1', 'PROCONCEL1', 
      'CEL2', 'FLGWHATSCEL2', 'CONSULTADO_SISTEMA_CEL2', 'PROCONCEL2',
      'EMAIL1', 'EMAIL2', 'EMAIL3',
      'FLAG_DE_OBITO', 'SCORE_CREDITO', 'SCORE_DIGITAL', 'FLAG_FGTS'
    ];
    
    const rows = loadedResults.map(r => {
      const rowData = [];
      
      if (r.tipo === 'CPF' && r.success && r.dados) {
        const cad = r.dados.CADASTRAIS || {};
        const telefones = r.dados.TELEFONES || [];
        const emails = r.dados.EMAILS || [];
        const enderecos = r.dados.ENDERECOS || [];
        const endereco = enderecos[0] || {};
        
        rowData.push(r.documento);
        rowData.push(cad.NOME || '');
        rowData.push(cad.MAE || cad.NOME_MAE || cad.NOMEMAE || cad.MÃE || '');
        rowData.push(cad.SEXO || '');
        rowData.push(cad.NASC || '');
        rowData.push(cad.RENDA || '');
        rowData.push(cad.TIPO || '');
        rowData.push(cad.TITULO || '');
        rowData.push(endereco.LOGRADOURO || '');
        rowData.push(endereco.NUMERO || '');
        rowData.push(endereco.COMPLEMENTO || '');
        rowData.push(endereco.BAIRRO || '');
        rowData.push(endereco.CIDADE || '');
        rowData.push(endereco.UF || '');
        rowData.push(endereco.CEP || '');
        rowData.push(endereco.AREARISCO || '');
        
        const cel1 = telefones[0];
        rowData.push(cel1 ? `55${cel1.DDD}${cel1.TELEFONE}` : '');
        rowData.push(''); // FLGWHATSCEL1 (da API Nova Vida)
        rowData.push(cel1 && cel1.WHATSAPP_VERIFIED ? (cel1.HAS_WHATSAPP ? 'Com WhatsApp' : 'Sem WhatsApp') : ''); // CONSULTADO_SISTEMA_CEL1
        rowData.push(cel1?.PROCON || '');
        
        const cel2 = telefones[1];
        rowData.push(cel2 ? `55${cel2.DDD}${cel2.TELEFONE}` : '');
        rowData.push(''); // FLGWHATSCEL2 (da API Nova Vida)
        rowData.push(cel2 && cel2.WHATSAPP_VERIFIED ? (cel2.HAS_WHATSAPP ? 'Com WhatsApp' : 'Sem WhatsApp') : ''); // CONSULTADO_SISTEMA_CEL2
        rowData.push(cel2?.PROCON || '');
        
        rowData.push(emails[0]?.EMAIL || '');
        rowData.push(emails[1]?.EMAIL || '');
        rowData.push(emails[2]?.EMAIL || '');
        
        rowData.push(cad.FLAG_DE_OBITO || cad.OBITO || cad.FLAGOBITO || cad.FLG_OBITO || '');
        rowData.push(cad.SCORE || cad.SCORE_CREDITO || '');
        rowData.push(cad.SCORE_DIGITAL || cad.SCOREDIGITAL || '');
        rowData.push(cad.FLAG_FGTS || cad.FLAGFGTS || cad.FLG_FGTS || cad.FGTS || '');
        
      } else {
        // Preencher com valores vazios ou de CNPJ
        const cad = r.dados?.CADASTRAIS || {};
        const telefones = r.dados?.TELEFONES || [];
        const emails = r.dados?.EMAILS || [];
        const enderecos = r.dados?.ENDERECOS || [];
        const endereco = enderecos[0] || {};
        
        rowData.push(r.documento);
        rowData.push(r.tipo === 'CNPJ' ? (cad.RAZAO || cad.NOME_FANTASIA || '') : (r.erro ? 'ERRO: ' + r.erro : ''));
        rowData.push(''); // NOME_MAE
        rowData.push(''); // SEXO
        rowData.push(r.tipo === 'CNPJ' ? (cad.DATA_ABERTURA || '') : ''); // NASC
        rowData.push(''); // RENDA
        rowData.push(r.tipo || '');
        rowData.push(''); // TITULO
        rowData.push(endereco.LOGRADOURO || '');
        rowData.push(endereco.NUMERO || '');
        rowData.push(endereco.COMPLEMENTO || '');
        rowData.push(endereco.BAIRRO || '');
        rowData.push(endereco.CIDADE || '');
        rowData.push(endereco.UF || '');
        rowData.push(endereco.CEP || '');
        rowData.push(''); // AREARISCO
        
        const cel1 = telefones[0];
        rowData.push(cel1 ? `55${cel1.DDD}${cel1.TELEFONE}` : '');
        rowData.push(''); // FLGWHATSCEL1 (da API Nova Vida)
        rowData.push(cel1 && cel1.WHATSAPP_VERIFIED ? (cel1.HAS_WHATSAPP ? 'Com WhatsApp' : 'Sem WhatsApp') : ''); // CONSULTADO_SISTEMA_CEL1
        rowData.push(''); // PROCONCEL1
        
        const cel2 = telefones[1];
        rowData.push(cel2 ? `55${cel2.DDD}${cel2.TELEFONE}` : '');
        rowData.push(''); // FLGWHATSCEL2 (da API Nova Vida)
        rowData.push(cel2 && cel2.WHATSAPP_VERIFIED ? (cel2.HAS_WHATSAPP ? 'Com WhatsApp' : 'Sem WhatsApp') : ''); // CONSULTADO_SISTEMA_CEL2
        rowData.push(''); // PROCONCEL2
        
        rowData.push(emails[0]?.EMAIL || '');
        rowData.push(emails[1]?.EMAIL || '');
        rowData.push(emails[2]?.EMAIL || '');
        
        rowData.push(''); // FLAG_DE_OBITO
        rowData.push(cad.SCORE || '');
        rowData.push(''); // SCORE_DIGITAL
        rowData.push(''); // FLAG_FGTS
      }
      
      return rowData.map(v => `"${v}"`).join(',');
    });
    
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Consulta-NETTSistemas-${Date.now()}.csv`;
    link.click();
    
    showNotification('CSV exportado com sucesso!', 'success');
  };

  // VERIFICAÇÃO E HIGIENIZAÇÃO - Funções

  // Processar arquivo de CPFs
  const handleVerificationFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setVerificationFile(file);
    
    // Limpar resultados anteriores
    setVerificationResults(null);
    setAllHygienizedData([]);
    
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      // Extrair CPFs da primeira coluna
      const cpfs = jsonData
        .slice(1) // Pular header
        .map((row: any) => {
          let cpf = String(row[0] || '').replace(/\D/g, '');
          
          // Corrigir CPFs/CNPJs que perderam zero à esquerda no Excel
          if (cpf.length === 10) {
            // CPF com 10 dígitos = falta 1 zero à esquerda
            cpf = '0' + cpf;
            console.log(`🔧 CPF corrigido: ${row[0]} → ${cpf}`);
          } else if (cpf.length === 13) {
            // CNPJ com 13 dígitos = falta 1 zero à esquerda
            cpf = '0' + cpf;
            console.log(`🔧 CNPJ corrigido: ${row[0]} → ${cpf}`);
          }
          
          return cpf;
        })
        .filter(cpf => cpf.length === 11 || cpf.length === 14);
      
      setVerificationCpfs(cpfs.join('\n'));
      showNotification(`✅ ${cpfs.length} CPFs carregados do arquivo!`, 'success');
    } catch (error) {
      console.error('Erro ao processar arquivo:', error);
      showNotification('❌ Erro ao processar arquivo', 'error');
    }
  };

  // Verificar CPFs na base
  const handleVerifyCpfs = async () => {
    console.log('🔍 INICIANDO VERIFICAÇÃO DE CPFs');
    console.log('📋 Texto original:', verificationCpfs);
    
    const cpfs = verificationCpfs
      .split('\n')
      .map((line, index) => {
        const original = line.trim();
        let cpf = original.replace(/\D/g, '');
        
        console.log(`  [${index + 1}] Original: "${original}" → Números: "${cpf}" (${cpf.length} dígitos)`);
        
        // Corrigir CPFs/CNPJs que perderam zero à esquerda
        if (cpf.length === 10) {
          // CPF com 10 dígitos = falta 1 zero à esquerda
          cpf = '0' + cpf;
          console.log(`     🔧 CPF corrigido: ${original} → ${cpf}`);
        } else if (cpf.length === 13) {
          // CNPJ com 13 dígitos = falta 1 zero à esquerda
          cpf = '0' + cpf;
          console.log(`     🔧 CNPJ corrigido: ${original} → ${cpf}`);
        }
        
        return cpf;
      })
      .filter((cpf, index) => {
        const valido = cpf.length === 11 || cpf.length === 14;
        if (!valido && cpf.length > 0) {
          console.log(`  ❌ [${index + 1}] CPF INVÁLIDO descartado: "${cpf}" (${cpf.length} dígitos)`);
        }
        return valido;
      });
    
    console.log(`✅ Total de CPFs válidos: ${cpfs.length}`);
    console.log('📤 CPFs que serão enviados para verificação:', cpfs);
    
    if (cpfs.length === 0) {
      showNotification('❌ Nenhum CPF válido encontrado', 'error');
      return;
    }
    
    setVerifyingCpfs(true);
    
    // Limpar dados de higienização anterior
    setAllHygienizedData([]);
    
    try {
      // PASSO 1: Verificar Lista de Restrição
      console.log('🚫 Verificando Lista de Restrição...');
      const restricaoResponse = await api.post('/lista-restricao/verificar-lista', { cpfs });
      
      const cpfsBloqueados = restricaoResponse.data.bloqueados || [];
      const cpfsPermitidos = restricaoResponse.data.permitidos || [];
      
      console.log(`🚫 ${cpfsBloqueados.length} CPFs bloqueados pela Lista de Restrição`);
      console.log(`✅ ${cpfsPermitidos.length} CPFs permitidos`);
      
      // Se todos os CPFs estão bloqueados
      if (cpfsPermitidos.length === 0) {
        showNotification(
          `🚫 Todos os ${cpfsBloqueados.length} CPF(s) estão na Lista de Restrição. Nenhum CPF foi consultado.`,
          'error'
        );
        setVerifyingCpfs(false);
        return;
      }
      
      // Se alguns CPFs estão bloqueados, notificar
      if (cpfsBloqueados.length > 0) {
        showNotification(
          `⚠️ ${cpfsBloqueados.length} CPF(s) removido(s) (Lista de Restrição). Verificando ${cpfsPermitidos.length} CPF(s)...`,
          'success'
        );
      }
      
      // PASSO 2: Verificar CPFs permitidos na base de dados
      console.log('🌐 Enviando CPFs permitidos para verificação:', { cpfs: cpfsPermitidos });
      const response = await api.post('/novavida/verificar-lista', { cpfs: cpfsPermitidos });
      
      setVerificationResults({
        found: response.data.encontrados || [],
        notFound: response.data.naoEncontrados || []
      });
      
      const mensagem = cpfsBloqueados.length > 0
        ? `✅ Verificação concluída! ${response.data.encontrados?.length || 0} cadastrados, ${response.data.naoEncontrados?.length || 0} não cadastrados (${cpfsBloqueados.length} bloqueados pela Lista de Restrição)`
        : `✅ Verificação concluída! ${response.data.encontrados?.length || 0} cadastrados, ${response.data.naoEncontrados?.length || 0} não cadastrados`;
      
      showNotification(mensagem, 'success');
    } catch (error: any) {
      console.error('Erro ao verificar CPFs:', error);
      showNotification('❌ Erro ao verificar CPFs: ' + (error.response?.data?.error || error.message), 'error');
    } finally {
      setVerifyingCpfs(false);
    }
  };

  // Higienizar CPFs não encontrados
  const handleHygienize = async () => {
    if (!verificationResults?.notFound || verificationResults.notFound.length === 0) {
      showNotification('❌ Nenhum CPF para higienizar', 'error');
      return;
    }
    
    setHygienizing(true);
    const cpfsToHygienize = verificationResults.notFound;
    
    setHygienizationProgress({
      total: cpfsToHygienize.length,
      current: 0,
      remaining: cpfsToHygienize.length
    });
    
    const hygienizedData: any[] = [];
    let cpfsBloqueados = 0;
    let cpfsSemCredito = 0;
    let limiteAtingido = false;
    
    try {
      for (let i = 0; i < cpfsToHygienize.length; i++) {
        const cpf = cpfsToHygienize[i];
        
        try {
          // Consultar na API
          const response = await api.post('/novavida/consultar', {
            documento: cpf,
            verificarWhatsapp: verifyWhatsappCheck,
            whatsappColumn: verifyWhatsappCheck ? whatsappColumnChoice : undefined
          });
          
          if (response.data.success && response.data.dados) {
            hygienizedData.push(response.data.dados);
          }
          
          setHygienizationProgress({
            total: cpfsToHygienize.length,
            current: i + 1,
            remaining: cpfsToHygienize.length - (i + 1)
          });
          
          // Delay entre consultas
          if (i < cpfsToHygienize.length - 1) {
            await new Promise(resolve => setTimeout(resolve, hygienizationDelay * 1000));
          }
        } catch (error: any) {
          // Verificar se é bloqueio por lista de restrição
          if (error.response?.status === 403 && error.response?.data?.bloqueado) {
            console.log(`🚫 CPF ${cpf} está na Lista de Restrição`);
            cpfsBloqueados++;
          } 
          // Verificar se é falta de crédito (limite atingido)
          else if (
            error.response?.status === 403 && 
            (error.response?.data?.message?.includes('Limite') || 
             error.response?.data?.message?.includes('crédito') ||
             error.response?.data?.message?.includes('consultas'))
          ) {
            console.log(`❌ CPF ${cpf} não consultado: ${error.response?.data?.message}`);
            cpfsSemCredito++;
            limiteAtingido = true;
            
            // Contar os CPFs restantes como não consultados
            cpfsSemCredito += (cpfsToHygienize.length - 1 - i);
            
            // Parar o loop, não há mais crédito
            break;
          } else {
            console.error(`Erro ao higienizar CPF ${cpf}:`, error);
          }
        }
      }
      
      setAllHygienizedData(hygienizedData);
      
      // Mensagem detalhada considerando todos os cenários
      let mensagem = `✅ Higienização concluída!\n\n`;
      mensagem += `✅ ${hygienizedData.length} CPF(s) consultado(s) com sucesso\n`;
      
      if (cpfsBloqueados > 0) {
        mensagem += `🚫 ${cpfsBloqueados} CPF(s) bloqueado(s) (Lista de Restrição)\n`;
      }
      
      if (cpfsSemCredito > 0) {
        mensagem += `❌ ${cpfsSemCredito} CPF(s) NÃO consultado(s) por falta de crédito\n\n`;
        mensagem += `⚠️ Seu limite de consultas foi atingido. Para consultar os ${cpfsSemCredito} CPF(s) restantes, entre em contato com o administrador para adicionar consultas avulsas.`;
      }
      
      showNotification(mensagem, limiteAtingido ? 'error' : 'success');
      
      // Recarregar verificação para atualizar a lista e limite
      await handleVerifyCpfs();
      await loadLimite();
    } catch (error: any) {
      console.error('Erro na higienização:', error);
      showNotification('❌ Erro na higienização', 'error');
    } finally {
      setHygienizing(false);
      setHygienizationProgress({ total: 0, current: 0, remaining: 0 });
    }
  };

  // Formatar data para exibição (remover hora/timezone)
  const formatarData = (dataISO: string | null | undefined): string => {
    if (!dataISO) return '';
    
    try {
      // Remover a parte de hora e timezone
      // De: "1967-10-08T03:00:00.000Z"
      // Para: "08/10/1967"
      const data = new Date(dataISO);
      const dia = String(data.getDate()).padStart(2, '0');
      const mes = String(data.getMonth() + 1).padStart(2, '0');
      const ano = data.getFullYear();
      return `${dia}/${mes}/${ano}`;
    } catch (error) {
      // Se não conseguir converter, retorna apenas a parte da data (YYYY-MM-DD)
      return dataISO.split('T')[0];
    }
  };

  // Download somente cadastrados
  const handleDownloadFoundOnly = () => {
    if (!verificationResults?.found || verificationResults.found.length === 0) {
      showNotification('❌ Nenhum registro encontrado para download', 'error');
      return;
    }
    
    const workbook = XLSX.utils.book_new();
    const worksheetData: any[] = [];
    
    // Header
    worksheetData.push([
      'CPF/CNPJ', 'Nome', 'Nome Mãe', 'Sexo', 'Data Nascimento',
      'Telefone 1', 'WhatsApp 1', 'Telefone 2', 'WhatsApp 2', 'Telefone 3', 'WhatsApp 3',
      'Email 1', 'Email 2', 'Email 3',
      'CEP', 'Logradouro', 'Número', 'Complemento', 'Bairro', 'Cidade', 'UF',
      'Status'
    ]);
    
    // Dados
    verificationResults.found.forEach(reg => {
      const telefones = Array.isArray(reg.telefones) ? reg.telefones : [];
      const emails = Array.isArray(reg.emails) ? reg.emails : [];
      const enderecos = Array.isArray(reg.enderecos) ? reg.enderecos : [];
      const endereco = enderecos[0] || {};
      
      worksheetData.push([
        reg.documento || '',
        reg.nome || '',
        reg.nome_mae || '',
        reg.sexo || '',
        formatarData(reg.data_nascimento),
        telefones[0] ? `${telefones[0].ddd || ''}${telefones[0].telefone || ''}` : '',
        telefones[0]?.has_whatsapp ? 'Sim' : 'Não',
        telefones[1] ? `${telefones[1].ddd || ''}${telefones[1].telefone || ''}` : '',
        telefones[1]?.has_whatsapp ? 'Sim' : 'Não',
        telefones[2] ? `${telefones[2].ddd || ''}${telefones[2].telefone || ''}` : '',
        telefones[2]?.has_whatsapp ? 'Sim' : 'Não',
        emails[0]?.email || '',
        emails[1]?.email || '',
        emails[2]?.email || '',
        endereco.cep || '',
        endereco.logradouro || '',
        endereco.numero || '',
        endereco.complemento || '',
        endereco.bairro || '',
        endereco.cidade || '',
        endereco.uf || '',
        '✅ Cadastrado'
      ]);
    });
    
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Cadastrados');
    XLSX.writeFile(workbook, `CPFs-Cadastrados-${Date.now()}.xlsx`);
    
    showNotification('✅ Download concluído!', 'success');
  };

  // Download completo (cadastrados + higienizados)
  const handleDownloadComplete = () => {
    if (!verificationResults) {
      showNotification('❌ Nenhum dado para download', 'error');
      return;
    }
    
    const workbook = XLSX.utils.book_new();
    const worksheetData: any[] = [];
    
    // Header
    worksheetData.push([
      'CPF/CNPJ', 'Nome', 'Nome Mãe', 'Sexo', 'Data Nascimento',
      'Telefone 1', 'WhatsApp 1', 'Telefone 2', 'WhatsApp 2', 'Telefone 3', 'WhatsApp 3',
      'Email 1', 'Email 2', 'Email 3',
      'CEP', 'Logradouro', 'Número', 'Complemento', 'Bairro', 'Cidade', 'UF',
      'Status'
    ]);
    
    // Cadastrados
    verificationResults.found.forEach(reg => {
      const telefones = Array.isArray(reg.telefones) ? reg.telefones : [];
      const emails = Array.isArray(reg.emails) ? reg.emails : [];
      const enderecos = Array.isArray(reg.enderecos) ? reg.enderecos : [];
      const endereco = enderecos[0] || {};
      
      worksheetData.push([
        reg.documento || '',
        reg.nome || '',
        reg.nome_mae || '',
        reg.sexo || '',
        formatarData(reg.data_nascimento),
        telefones[0] ? `${telefones[0].ddd || ''}${telefones[0].telefone || ''}` : '',
        telefones[0]?.has_whatsapp ? 'Sim' : 'Não',
        telefones[1] ? `${telefones[1].ddd || ''}${telefones[1].telefone || ''}` : '',
        telefones[1]?.has_whatsapp ? 'Sim' : 'Não',
        telefones[2] ? `${telefones[2].ddd || ''}${telefones[2].telefone || ''}` : '',
        telefones[2]?.has_whatsapp ? 'Sim' : 'Não',
        emails[0]?.email || '',
        emails[1]?.email || '',
        emails[2]?.email || '',
        endereco.cep || '',
        endereco.logradouro || '',
        endereco.numero || '',
        endereco.complemento || '',
        endereco.bairro || '',
        endereco.cidade || '',
        endereco.uf || '',
        '✅ Cadastrado'
      ]);
    });
    
    // Higienizados
    allHygienizedData.forEach(dados => {
      const cad = dados.CADASTRAIS || {};
      const telefones = dados.TELEFONES || [];
      const emails = dados.EMAILS || [];
      const enderecos = dados.ENDERECOS || [];
      const endereco = enderecos[0] || {};
      
      const temTelefone = telefones.length > 0;
      const status = temTelefone ? '🌐 Higienizado' : '⚠️ SEM TELEFONE';
      
      worksheetData.push([
        dados.documento || cad.CPF || '',
        cad.NOME || '',
        cad.MAE || cad.NOME_MAE || '',
        cad.SEXO || '',
        formatarData(cad.NASC),
        telefones[0] ? `${telefones[0].DDD || ''}${telefones[0].TELEFONE || ''}` : '',
        telefones[0]?.HAS_WHATSAPP ? 'Sim' : 'Não',
        telefones[1] ? `${telefones[1].DDD || ''}${telefones[1].TELEFONE || ''}` : '',
        telefones[1]?.HAS_WHATSAPP ? 'Sim' : 'Não',
        telefones[2] ? `${telefones[2].DDD || ''}${telefones[2].TELEFONE || ''}` : '',
        telefones[2]?.HAS_WHATSAPP ? 'Sim' : 'Não',
        emails[0]?.EMAIL || '',
        emails[1]?.EMAIL || '',
        emails[2]?.EMAIL || '',
        endereco.CEP || '',
        endereco.LOGRADOURO || '',
        endereco.NUMERO || '',
        endereco.COMPLEMENTO || '',
        endereco.BAIRRO || '',
        endereco.CIDADE || '',
        endereco.UF || '',
        status
      ]);
    });
    
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Base Completa');
    XLSX.writeFile(workbook, `Base-Completa-${Date.now()}.xlsx`);
    
    showNotification('✅ Download da base completa concluído!', 'success');
  };

  // ============================================
  // FUNÇÕES DA LISTA DE RESTRIÇÃO
  // ============================================

  const carregarListaRestricao = async () => {
    try {
      setLoadingListaRestricao(true);
      const response = await api.get('/lista-restricao');
      setListaRestricaoCpfs(response.data.cpfs || []);
      console.log(`✅ ${response.data.total || 0} CPFs bloqueados carregados`);
    } catch (error: any) {
      console.error('❌ Erro ao carregar lista:', error);
      showNotification(error.response?.data?.error || 'Erro ao carregar lista', 'error');
    } finally {
      setLoadingListaRestricao(false);
    }
  };

  const adicionarCpfRestricao = async () => {
    if (!novoCpfRestricao.trim()) {
      showNotification('Digite um CPF', 'error');
      return;
    }

    try {
      setLoadingListaRestricao(true);
      await api.post('/lista-restricao', { cpf: novoCpfRestricao });
      showNotification('✅ CPF adicionado à lista de restrição', 'success');
      setNovoCpfRestricao('');
      await carregarListaRestricao();
    } catch (error: any) {
      console.error('❌ Erro ao adicionar CPF:', error);
      const errorMsg = error.response?.data?.error || error.response?.data?.message || 'Erro ao adicionar CPF';
      showNotification(`❌ ${errorMsg}`, 'error');
    } finally {
      setLoadingListaRestricao(false);
    }
  };

  const removerCpfRestricao = async (cpf: string) => {
    if (!confirm(`Deseja remover o CPF ${cpf} da lista de restrição?`)) {
      return;
    }

    try {
      setLoadingListaRestricao(true);
      await api.delete(`/lista-restricao/${cpf}`);
      showNotification('✅ CPF removido da lista', 'success');
      await carregarListaRestricao();
    } catch (error: any) {
      console.error('❌ Erro ao remover CPF:', error);
      showNotification(error.response?.data?.error || 'Erro ao remover CPF', 'error');
    } finally {
      setLoadingListaRestricao(false);
    }
  };

  const excluirTodosCpfsRestricao = async () => {
    const total = listaRestricaoCpfs.length;

    if (total === 0) {
      showNotification('⚠️ Não há CPFs para excluir', 'error');
      return;
    }

    if (!confirm(`⚠️ ATENÇÃO!\n\nEsta ação irá EXCLUIR TODOS os ${total} CPF(s) da lista de restrição.\n\nEsta ação NÃO PODE SER DESFEITA!\n\nDeseja realmente continuar?`)) {
      return;
    }

    // Segunda confirmação para segurança
    if (!confirm(`Tem certeza absoluta?\n\n${total} CPF(s) serão permanentemente excluídos!`)) {
      return;
    }

    try {
      setLoadingListaRestricao(true);
      await api.delete('/lista-restricao');
      showNotification(`✅ Todos os ${total} CPF(s) foram excluídos!`, 'success');
      await carregarListaRestricao();
    } catch (error: any) {
      console.error('❌ Erro ao excluir todos os CPFs:', error);
      showNotification(error.response?.data?.error || 'Erro ao excluir todos os CPFs', 'error');
    } finally {
      setLoadingListaRestricao(false);
    }
  };

  // Consultar TODOS os telefones de uma vez
  const consultarWhatsappProfile = async (telefones: any[]) => {
    if (!telefones || telefones.length === 0) {
      showNotification('❌ Nenhum telefone para consultar', 'error');
      return;
    }

    try {
      console.log('🔍 Iniciando consulta de WhatsApp para todos os telefones...');
      
      // Buscar instância ativa
      const instancesResponse = await api.get('/uaz/instances');
      console.log('📡 Resposta COMPLETA da API:', instancesResponse);
      console.log('📡 Dados das instâncias:', instancesResponse.data);
      console.log('📡 Tipo de data:', typeof instancesResponse.data);
      console.log('📡 É array?', Array.isArray(instancesResponse.data));
      
      // Detectar se a resposta é array direto ou objeto com propriedade data/instances
      let instances = [];
      if (Array.isArray(instancesResponse.data)) {
        instances = instancesResponse.data;
        console.log('✅ Resposta é array direto');
      } else if (instancesResponse.data.data && Array.isArray(instancesResponse.data.data)) {
        instances = instancesResponse.data.data;
        console.log('✅ Resposta tem propriedade data (formato: {success, data})');
      } else if (instancesResponse.data.instances && Array.isArray(instancesResponse.data.instances)) {
        instances = instancesResponse.data.instances;
        console.log('✅ Resposta tem propriedade instances');
      } else {
        console.error('❌ Formato de resposta desconhecido:', instancesResponse.data);
      }
      
      console.log(`📊 Total de instâncias encontradas: ${instances.length}`);
      console.log('📋 Lista de instâncias:', instances);
      
      // Listar todas as instâncias com seus status
      instances.forEach((inst: any, index: number) => {
        console.log(`  ${index + 1}. Nome: ${inst.name || inst.session_name || 'Sem nome'}`);
        console.log(`     - ID: ${inst.id}`);
        console.log(`     - is_active: ${inst.is_active}`);
        console.log(`     - status: ${inst.status}`);
        console.log(`     - Conectado? ${inst.is_active && inst.status === 'connected' ? '✅ SIM' : '❌ NÃO'}`);
      });
      
      const activeInstance = instances.find((inst: any) => 
        inst.is_active && inst.status === 'connected'
      );

      if (!activeInstance) {
        console.error('❌ NENHUMA instância ativa E conectada encontrada');
        console.error('📋 Verifique em Configurações QR Connect se há uma instância com:');
        console.error('   - is_active = true (ativa)');
        console.error('   - status = connected (conectada)');
        showNotification('❌ Nenhuma instância ativa encontrada. Conecte uma instância em Configurações QR Connect.', 'error');
        return;
      }

      console.log('✅ Instância ativa encontrada:', activeInstance.name);
      showNotification(`🔄 Consultando ${telefones.length} telefone(s)...`, 'success');

      let fotosEncontradas = 0;
      let fotosNaoEncontradas = 0;

      // Consultar cada telefone (com delay para evitar bloqueio)
      for (let i = 0; i < telefones.length; i++) {
        const tel = telefones[i];
        const numeroLimpo = `55${tel.DDD}${tel.TELEFONE}`;
        const numeroFormatado = `(${tel.DDD}) ${tel.TELEFONE}`;

        try {
          // Marca como carregando
          setLoadingPhones(prev => new Set(prev).add(numeroLimpo));

          console.log(`📞 Consultando ${i + 1}/${telefones.length}: ${numeroFormatado}`);

          // Consultar detalhes do contato
          const response = await api.post('/uaz/contact/details', {
            instance_id: activeInstance.id,
            phone_number: numeroLimpo,
            preview: false
          });

          console.log(`📡 Resposta para ${numeroFormatado}:`, response.data);
          console.log(`📡 Campo hasWhatsApp (direto):`, response.data.hasWhatsApp);
          console.log(`📡 Campo hasWhatsApp (contact):`, response.data.contact?.hasWhatsApp);
          console.log(`📡 Tipo de hasWhatsApp:`, typeof response.data.contact?.hasWhatsApp);
          
          // Tentar múltiplos campos para a foto
          let photoUrl = response.data.contact?.image || 
                          response.data.contact?.profilePicUrl || 
                          response.data.profilePicUrl ||
                          response.data.contact?.imageUrl;

          // Se a foto for uma URL relativa (já salva localmente), adicionar o base URL do backend
          if (photoUrl && photoUrl.startsWith('/uploads/')) {
            const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'https://api.sistemasnettsistemas.com.br';
            photoUrl = `${API_BASE}${photoUrl}`;
            console.log('🖼️ Usando foto local do backend:', photoUrl);
          }

          // ✅ CORRETO: Buscar hasWhatsApp dentro de contact (igual à foto)
          const hasWhatsApp = response.data.contact?.hasWhatsApp ?? false;
          
          console.log(`📱 WhatsApp FINAL: ${hasWhatsApp ? '✅ TEM' : '❌ SEM'}`);

          if (response.data.success) {
            // Armazenar foto E status de WhatsApp
            setPhonePhotos(prev => {
              const newMap = new Map(prev);
              newMap.set(numeroLimpo, {
                url: photoUrl || null,
                name: response.data.contact?.name || response.data.contactName || numeroFormatado,
                hasWhatsApp: hasWhatsApp
              });
              return newMap;
            });
            
            if (photoUrl) {
              fotosEncontradas++;
              console.log(`✅ Foto encontrada para ${numeroFormatado}!`);
              console.log(`   └─ URL: ${photoUrl.substring(0, 80)}...`);
            } else {
              fotosNaoEncontradas++;
              console.log(`⚠️ Foto não encontrada para ${numeroFormatado}`);
            }
          } else {
            fotosNaoEncontradas++;
            console.log(`❌ Erro ao consultar ${numeroFormatado}`);
          }

          // Remove do loading
          setLoadingPhones(prev => {
            const newSet = new Set(prev);
            newSet.delete(numeroLimpo);
            return newSet;
          });

          // Delay de 2 segundos entre consultas (evitar bloqueio)
          if (i < telefones.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }

        } catch (error: any) {
          console.error(`❌ Erro ao consultar ${numeroFormatado}:`, error);
          fotosNaoEncontradas++;
          
          // Remove do loading mesmo com erro
          setLoadingPhones(prev => {
            const newSet = new Set(prev);
            newSet.delete(numeroLimpo);
            return newSet;
          });
        }
      }

      // Notificação final
      if (fotosEncontradas > 0) {
        showNotification(`✅ ${fotosEncontradas} foto(s) encontrada(s)! ${fotosNaoEncontradas > 0 ? `(${fotosNaoEncontradas} sem foto)` : ''}`, 'success');
      } else {
        showNotification(`⚠️ Nenhuma foto de perfil encontrada`, 'error');
      }

    } catch (error: any) {
      console.error('❌ Erro geral ao consultar WhatsApp:', error);
      showNotification(`❌ Erro ao consultar WhatsApp: ${error.message}`, 'error');
    }
  };

  const handleUploadListaRestricao = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setLoadingListaRestricao(true);
      showNotification('Processando arquivo...', 'success');

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const data = event.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

          const cpfs = jsonData
            .slice(1)
            .map((row: any) => {
              let cpf = String(row[0] || '').trim().replace(/\D/g, '');
              if (cpf.length === 10) cpf = '0' + cpf;
              if (cpf.length === 13) cpf = '0' + cpf;
              return cpf;
            })
            .filter(cpf => cpf.length === 11 || cpf.length === 14);

          const response = await api.post('/lista-restricao/adicionar-lista', { cpfs });

          showNotification(
            `✅ ${response.data.adicionados} CPFs adicionados | ⚠️ ${response.data.jaExistentes} já existentes`,
            'success'
          );

          await carregarListaRestricao();
        } catch (error: any) {
          console.error('❌ Erro ao processar arquivo:', error);
          showNotification('Erro ao processar arquivo', 'error');
        }
      };

      reader.readAsBinaryString(file);
    } catch (error: any) {
      console.error('❌ Erro ao fazer upload:', error);
      showNotification('Erro ao fazer upload', 'error');
    } finally {
      setLoadingListaRestricao(false);
      e.target.value = '';
    }
  };

  const formatarCpfRestricao = (cpf: string) => {
    if (cpf.length === 11) {
      return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    } else if (cpf.length === 14) {
      return cpf.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
    return cpf;
  };

  // Carregar lista quando mudar para a aba
  useEffect(() => {
    if (activeTab === 'lista-restricao') {
      carregarListaRestricao();
    }
    if (activeTab === 'comprar-consultas') {
      carregarPacotesESaldo();
    }
  }, [activeTab]);

  // 🔄 Polling para verificar se o pagamento foi confirmado
  useEffect(() => {
    if (!paymentData || !paymentData.id) return;

    const checkPaymentStatus = async () => {
      try {
        const response = await api.get(`/payments/${paymentData.id}/status`);
        const status = response.data.status;

        console.log('🔍 Verificando status do pagamento:', status);

        if (status === 'confirmed' || status === 'CONFIRMED' || status === 'RECEIVED') {
          // Pagamento confirmado!
          showNotification('🎉 Pagamento confirmado! Créditos adicionados à sua conta!', 'success');
          
          // Fechar modal
          setShowPaymentModal(false);
          setPaymentData(null);
          
          // Recarregar saldo
          await carregarPacotesESaldo();
          await loadLimite();
        }
      } catch (error) {
        console.error('Erro ao verificar status do pagamento:', error);
      }
    };

    // Verificar imediatamente e depois a cada 3 segundos
    checkPaymentStatus();
    const interval = setInterval(checkPaymentStatus, 3000);

    // Limpar intervalo ao desmontar ou quando paymentData mudar
    return () => clearInterval(interval);
  }, [paymentData]);

  // Carregar pacotes e saldo de consultas avulsas
  const carregarPacotesESaldo = async () => {
    try {
      setLoadingPacotes(true);
      const [pacotesRes, saldoRes] = await Promise.all([
        api.get('/consultas-avulsas/pacotes'),
        api.get('/consultas-avulsas/saldo')
      ]);
      setPacotes(pacotesRes.data.pacotes);
      setSaldoAvulso(saldoRes.data.saldo);
    } catch (error) {
      console.error('Erro ao carregar pacotes:', error);
    } finally {
      setLoadingPacotes(false);
    }
  };

  // Comprar consultas
  const handleComprarConsultas = async (quantidade: number, valor: number) => {
    // ⚠️ VALIDAÇÃO: Asaas exige valor mínimo de R$ 5,00
    const MIN_VALUE = 5.00;
    if (valor < MIN_VALUE) {
      showNotification(
        `❌ Valor mínimo para cobrança é R$ ${MIN_VALUE.toFixed(2)}. Por favor, escolha um pacote maior ou quantidade personalizada acima deste valor.`,
        'error'
      );
      return;
    }

    try {
      setProcessingCompra(true);
      const response = await api.post('/consultas-avulsas/comprar', {
        quantidade,
        valor
      });
      setPaymentData(response.data.payment);
      setShowPaymentModal(true);
      showNotification('✅ QR Code PIX gerado com sucesso!', 'success');
    } catch (error: any) {
      showNotification('❌ Erro ao gerar cobrança: ' + (error.response?.data?.message || error.message), 'error');
    } finally {
      setProcessingCompra(false);
    }
  };

  // Copiar para clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showNotification('✅ Código PIX copiado!', 'success');
  };

  // Formatar moeda
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 p-8">
      {/* Notificação Toast */}
      {notification.show && (
        <div className={`fixed top-8 right-8 z-50 px-8 py-5 rounded-2xl shadow-2xl border-2 transform transition-all duration-300 ${
          notification.type === 'success' 
            ? 'bg-green-500/20 border-green-500/50 backdrop-blur-xl' 
            : 'bg-red-500/20 border-red-500/50 backdrop-blur-xl'
        }`}>
          <div className="flex items-center gap-4">
            {notification.type === 'success' ? (
              <FaCheckCircle className="text-4xl text-green-400" />
            ) : (
              <FaTimesCircle className="text-4xl text-red-400" />
            )}
            <p className="text-white text-xl font-bold">{notification.message}</p>
          </div>
        </div>
      )}

      <div className="max-w-[1800px] mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button
              onClick={() => router.push('/')}
              className="bg-white/10 hover:bg-white/20 p-4 rounded-xl transition-all duration-200 border-2 border-white/20 hover:border-white/40"
              title="Voltar para Página Inicial"
            >
              <FaArrowLeft className="text-3xl text-white" />
            </button>
            
            <div>
              <h1 className="text-5xl font-black text-white mb-2">
                🔍 Consultar Dados Nova Vida
              </h1>
              <p className="text-2xl text-white/70">
                Consulte CPF e CNPJ com dados cadastrais completos
              </p>
            </div>
          </div>

          {/* Contadores no canto direito */}
          <div className="flex gap-4">
            {/* Contador Diário */}
            {limiteInfo && (
              <div className={`backdrop-blur-sm border-2 rounded-2xl px-8 py-4 min-w-[160px] ${
                limiteInfo.limite_dia > 0 && limiteInfo.limite_dia_atingido 
                  ? 'bg-red-500/20 border-red-400/40' 
                  : limiteInfo.limite_dia > 0 && limiteInfo.consultas_hoje / limiteInfo.limite_dia > 0.8
                    ? 'bg-yellow-500/20 border-yellow-400/40'
                    : 'bg-emerald-500/20 border-emerald-400/40'
              }`}>
                <p className="text-white/60 text-sm font-semibold mb-2">📅 Consultas Hoje</p>
                <p className="text-3xl font-black text-white">
                  {limiteInfo.consultas_hoje}
                  {limiteInfo.limite_dia > 0 && (
                    <span className="text-white/50">/{limiteInfo.limite_dia}</span>
                  )}
                  {limiteInfo.limite_dia <= 0 && (
                    <span className="text-emerald-400 text-sm ml-2">∞</span>
                  )}
                </p>
                <p className="text-white/40 text-xs mt-2">
                  {limiteInfo.limite_dia > 0 ? 'do plano hoje' : 'ilimitado'}
                </p>
              </div>
            )}

            {/* Contador Mensal */}
            {limiteInfo && (
              <div className={`backdrop-blur-sm border-2 rounded-2xl px-8 py-4 min-w-[160px] ${
                limiteInfo.limite_mes > 0 && limiteInfo.limite_mes_atingido 
                  ? 'bg-red-500/20 border-red-400/40' 
                  : limiteInfo.limite_mes > 0 && limiteInfo.consultas_mes / limiteInfo.limite_mes > 0.8
                    ? 'bg-yellow-500/20 border-yellow-400/40'
                    : 'bg-emerald-500/20 border-emerald-400/40'
              }`}>
                <p className="text-white/60 text-sm font-semibold mb-2">📊 Consultas Mês</p>
                <p className="text-3xl font-black text-white">
                  {limiteInfo.consultas_mes}
                  {limiteInfo.limite_mes > 0 && (
                    <span className="text-white/50">/{limiteInfo.limite_mes}</span>
                  )}
                  {limiteInfo.limite_mes <= 0 && (
                    <span className="text-emerald-400 text-sm ml-2">∞</span>
                  )}
                </p>
                <p className="text-white/40 text-xs mt-2">
                  {limiteInfo.limite_mes > 0 ? 'do plano este mês' : 'ilimitado'}
                </p>
              </div>
            )}

            {/* Consultas Avulsas */}
            {limiteInfo && limiteInfo.consultas_avulsas_saldo !== undefined && (
              <div className="bg-gradient-to-br from-blue-500/20 to-purple-500/20 backdrop-blur-sm border-2 border-blue-400/40 rounded-2xl px-8 py-4 min-w-[160px]">
                <p className="text-white/60 text-sm font-semibold mb-2 flex items-center gap-2">
                  💰 Consultas Avulsas
                </p>
                <p className="text-3xl font-black text-blue-300">
                  {limiteInfo.consultas_avulsas_saldo || 0}
                </p>
                <p className="text-white/40 text-xs mt-2">
                  {limiteInfo.consultas_avulsas_usadas || 0} usadas • não expiram
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('single')}
            className={`px-8 py-4 rounded-xl font-bold text-xl transition-all duration-200 ${
              activeTab === 'single'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/40'
                : 'bg-white/10 text-white/70 hover:bg-white/20'
            }`}
          >
            <FaUser className="inline-block mr-3 text-2xl" />
            Consulta Única
          </button>
          
          <button
            onClick={() => setActiveTab('bulk')}
            className={`px-8 py-4 rounded-xl font-bold text-xl transition-all duration-200 ${
              activeTab === 'bulk'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/40'
                : 'bg-white/10 text-white/70 hover:bg-white/20'
            }`}
          >
            <FaUsers className="inline-block mr-3 text-2xl" />
            Consulta em Massa
          </button>
          
          <button
            onClick={() => setActiveTab('database')}
            className={`px-8 py-4 rounded-xl font-bold text-xl transition-all duration-200 ${
              activeTab === 'database'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/40'
                : 'bg-white/10 text-white/70 hover:bg-white/20'
            }`}
          >
            <FaDatabase className="inline-block mr-3 text-2xl" />
            Base de Dados
          </button>
          
          <button
            onClick={() => setActiveTab('verification')}
            className={`px-8 py-4 rounded-xl font-bold text-xl transition-all duration-200 ${
              activeTab === 'verification'
                ? 'bg-green-600 text-white shadow-lg shadow-green-500/40'
                : 'bg-white/10 text-white/70 hover:bg-white/20'
            }`}
          >
            <FaCheckCircle className="inline-block mr-3 text-2xl" />
            Verificação e Higienização
          </button>

          <button
            onClick={() => setActiveTab('lista-restricao')}
            className={`px-8 py-4 rounded-xl font-bold text-xl transition-all duration-200 ${
              activeTab === 'lista-restricao'
                ? 'bg-red-600 text-white shadow-lg shadow-red-500/40'
                : 'bg-white/10 text-white/70 hover:bg-white/20'
            }`}
          >
            <FaBan className="inline-block mr-3 text-2xl" />
            Lista de Restrição
          </button>

          <button
            onClick={() => setActiveTab('comprar-consultas')}
            className={`px-8 py-4 rounded-xl font-bold text-xl transition-all duration-200 ${
              activeTab === 'comprar-consultas'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/40'
                : 'bg-white/10 text-white/70 hover:bg-white/20'
            }`}
          >
            <FaShoppingCart className="inline-block mr-3 text-2xl" />
            Comprar Consultas
          </button>
        </div>

        {/* Consulta Única */}
        {activeTab === 'single' && (
          <div className="bg-gradient-to-br from-dark-800/90 to-dark-900/90 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-8 space-y-6">
            <h2 className="text-3xl font-black text-white mb-4">
              📄 Consulta Individual
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xl font-bold mb-3 text-white">
                  CPF ou CNPJ
                </label>
                <input
                  type="text"
                  placeholder="Digite o CPF (11 dígitos) ou CNPJ (14 dígitos)"
                  value={singleDoc}
                  onChange={(e) => setSingleDoc(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSingleConsult()}
                  className="w-full px-6 py-4 text-xl bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/30 transition-all"
                  disabled={loadingSingle}
                />
              </div>
              
              <button
                onClick={handleSingleConsult}
                disabled={loadingSingle}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-8 py-5 rounded-xl font-bold text-2xl transition-all duration-200 shadow-lg hover:shadow-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingSingle ? (
                  <>
                    <FaSpinner className="inline-block mr-3 text-3xl animate-spin" />
                    Consultando...
                  </>
                ) : (
                  <>
                    <FaSearch className="inline-block mr-3 text-3xl" />
                    Consultar Agora
                  </>
                )}
              </button>
            </div>

            {/* Resultado Consulta Única */}
            {singleResult && (
              <div className={`mt-6 p-6 rounded-xl border-2 ${
                singleResult.success 
                  ? 'bg-green-500/10 border-green-500/50' 
                  : 'bg-red-500/10 border-red-500/50'
              }`}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-2xl font-bold text-white">
                    {singleResult.success ? '✅ Consulta Realizada' : '❌ Erro na Consulta'}
                  </h3>
                  <span className={`px-4 py-2 rounded-lg font-bold ${
                    singleResult.tipo === 'CPF' 
                      ? 'bg-blue-500/20 text-blue-300' 
                      : 'bg-purple-500/20 text-purple-300'
                  }`}>
                    {singleResult.tipo}
                  </span>
                </div>
                
                <p className="text-xl text-white/80 mb-4">
                  <strong>Documento:</strong> {singleResult.documento}
                </p>
                
                {singleResult.erro && (
                  <p className="text-xl text-red-400">
                    <strong>Erro:</strong> {singleResult.erro}
                  </p>
                )}
                
                {singleResult.success && singleResult.dados && (
                  <div className="space-y-4 mt-6">
                    {/* Renderizar dados conforme tipo */}
                    {singleResult.tipo === 'CPF' ? (
                      <RenderCPFData 
                        dados={singleResult.dados} 
                        phonePhotos={phonePhotos}
                        loadingPhones={loadingPhones}
                        consultarWhatsappProfile={consultarWhatsappProfile}
                        setSelectedPhotoModal={setSelectedPhotoModal}
                      />
                    ) : (
                      <RenderCNPJData 
                        dados={singleResult.dados} 
                        phonePhotos={phonePhotos}
                        loadingPhones={loadingPhones}
                        consultarWhatsappProfile={consultarWhatsappProfile}
                        setSelectedPhotoModal={setSelectedPhotoModal}
                      />
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Consulta em Massa */}
        {activeTab === 'bulk' && (
          <div className="space-y-8">
            
            {/* Formulário */}
            <div className="bg-gradient-to-br from-dark-800/90 to-dark-900/90 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-8 space-y-6">
              <h2 className="text-3xl font-black text-white mb-4">
                📋 Consulta em Massa
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xl font-bold mb-3 text-white">
                    Lista de Documentos (um por linha)
                  </label>
                  <textarea
                    placeholder={"12345678901\n98765432000100\n11122233344\n..."}
                    value={bulkDocs}
                    onChange={(e) => setBulkDocs(e.target.value)}
                    rows={8}
                    className="w-full px-6 py-4 text-xl bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/30 transition-all font-mono"
                    disabled={loadingBulk}
                  />
                </div>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xl font-bold mb-3 text-white">
                      Delay entre consultas (segundos)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={delaySeconds}
                      onChange={(e) => setDelaySeconds(parseInt(e.target.value) || 0)}
                      className="w-full px-6 py-4 text-xl bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/30 transition-all"
                      disabled={loadingBulk}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xl font-bold mb-3 text-white">
                      Upload de Excel/CSV
                    </label>
                    <label className="block w-full px-6 py-4 bg-dark-700/80 border-2 border-white/20 rounded-xl text-white/70 hover:text-white hover:border-blue-500 transition-all cursor-pointer text-center">
                      <FaUpload className="inline-block mr-3 text-2xl" />
                      Selecionar Arquivo
                      <input
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        onChange={handleFileUpload}
                        className="hidden"
                        disabled={loadingBulk}
                      />
                    </label>
                  </div>
                </div>
                
                {/* Verificação de WhatsApp */}
                <div className="bg-green-500/10 border-2 border-green-500/30 rounded-xl p-6 space-y-4">
                  <div className="flex items-center gap-4">
                    <input
                      type="checkbox"
                      id="verifyWhatsapp"
                      checked={verifyWhatsapp}
                      onChange={(e) => setVerifyWhatsapp(e.target.checked)}
                      className="w-6 h-6 rounded cursor-pointer"
                      disabled={loadingBulk}
                    />
                    <label htmlFor="verifyWhatsapp" className="text-xl font-bold text-green-300 cursor-pointer flex items-center gap-2">
                      <FaWhatsapp className="text-2xl" />
                      Verificar WhatsApp dos telefones retornados
                    </label>
                  </div>
                  
                  {verifyWhatsapp && (
                    <div className="ml-10">
                      <label className="block text-lg font-bold mb-2 text-white">
                        ⏱️ Delay entre verificações de WhatsApp (segundos)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="60"
                        value={whatsappDelay}
                        onChange={(e) => setWhatsappDelay(parseInt(e.target.value) || 0)}
                        className="w-full md:w-1/2 px-4 py-3 text-lg bg-dark-700/80 border-2 border-green-500/30 rounded-xl text-white focus:border-green-500 focus:ring-4 focus:ring-green-500/30 transition-all"
                        disabled={loadingBulk}
                      />
                      <p className="text-sm text-white/60 mt-2">
                        ⚠️ <strong>Recomendado:</strong> Use delay de 2-5 segundos para evitar banimento das instâncias QR Connect
                      </p>
                    </div>
                  )}
                </div>
                
                <button
                  onClick={handleBulkConsult}
                  disabled={loadingBulk}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-8 py-5 rounded-xl font-bold text-2xl transition-all duration-200 shadow-lg hover:shadow-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingBulk ? (
                    <>
                      <FaSpinner className="inline-block mr-3 text-3xl animate-spin" />
                      Iniciando...
                    </>
                  ) : (
                    <>
                      <FaSearch className="inline-block mr-3 text-3xl" />
                      Iniciar Consulta em Massa
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Jobs Ativos */}
            {activeJobs.size > 0 && (
              <div className="space-y-4">
                <h2 className="text-3xl font-black text-white">
                  🔄 Consultas em Andamento
                </h2>
                
                {Array.from(activeJobs.values()).map(job => {
                  // Calcular estatísticas de telefones
                  const results = job.results || [];
                  let totalTelefones = 0;
                  let telefonesVerificados = 0;
                  let telefonesComWhatsapp = 0;
                  
                  results.forEach((result: any) => {
                    if (result.success && result.dados?.TELEFONES) {
                      const telefones = result.dados.TELEFONES;
                      totalTelefones += telefones.length;
                      
                      telefones.forEach((tel: any) => {
                        if (tel.WHATSAPP_VERIFIED === true) {
                          telefonesVerificados++;
                          if (tel.HAS_WHATSAPP === true) {
                            telefonesComWhatsapp++;
                          }
                        }
                      });
                    }
                  });
                  
                  const telefonesRestantes = totalTelefones - telefonesVerificados;
                  
                  // Debug
                  console.log(`📊 Job #${job.id}:`, {
                    totalTelefones,
                    telefonesVerificados,
                    telefonesComWhatsapp,
                    telefonesRestantes,
                    results: results.length
                  });
                  
                  return (
                    <div key={job.id} className="bg-gradient-to-br from-blue-500/20 to-indigo-500/10 border-2 border-blue-500/40 rounded-2xl p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-2xl font-bold text-white">
                          Job #{job.id}
                        </h3>
                        <span className={`px-4 py-2 rounded-lg font-bold ${
                          job.status === 'running' 
                            ? 'bg-green-500/20 text-green-300' 
                            : 'bg-yellow-500/20 text-yellow-300'
                        }`}>
                          {job.status === 'running' ? '▶️ Em Execucao' : '⏸️ Pausado'}
                        </span>
                      </div>
                      
                      {/* Estatísticas Detalhadas */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        {/* Documentos Consultados */}
                        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
                          <div className="text-blue-300 text-sm font-bold mb-1">📄 Documentos</div>
                          <div className="text-white text-2xl font-black">{job.progress_current}</div>
                          <div className="text-white/60 text-xs">de {job.progress_total} consultados</div>
                        </div>
                        
                        {/* Telefones Encontrados */}
                        <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4">
                          <div className="text-purple-300 text-sm font-bold mb-1">📱 Telefones</div>
                          <div className="text-white text-2xl font-black">{totalTelefones}</div>
                          <div className="text-white/60 text-xs">encontrados</div>
                        </div>
                        
                        {/* WhatsApp Verificados */}
                        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
                          <div className="text-green-300 text-sm font-bold mb-1">✅ Verificados</div>
                          <div className="text-white text-2xl font-black">{telefonesVerificados}</div>
                          <div className="text-white/60 text-xs">{telefonesComWhatsapp} com WhatsApp</div>
                        </div>
                        
                        {/* Restantes */}
                        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                          <div className="text-yellow-300 text-sm font-bold mb-1">⏳ Restantes</div>
                          <div className="text-white text-2xl font-black">{telefonesRestantes}</div>
                          <div className="text-white/60 text-xs">para verificar</div>
                        </div>
                      </div>
                      
                      {/* Barra de Progresso */}
                      <div className="mb-4">
                        <div className="flex justify-between text-white/80 text-lg mb-2">
                          <span>Progresso Geral</span>
                          <span>{Math.round((job.progress_current / job.progress_total) * 100)}%</span>
                        </div>
                        <div className="w-full bg-dark-700/50 rounded-full h-4 overflow-hidden">
                          <div 
                            className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full transition-all duration-300"
                            style={{ width: `${(job.progress_current / job.progress_total) * 100}%` }}
                          />
                        </div>
                      </div>
                      
                      {/* Botões de Controle */}
                      <div className="flex gap-3">
                        <button
                          onClick={() => handlePauseResume(job.id, job.status)}
                          className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white px-6 py-3 rounded-xl font-bold text-lg transition-all"
                        >
                          {job.status === 'running' ? (
                            <>
                              <FaPause className="inline-block mr-2" />
                              Pausar
                            </>
                          ) : (
                            <>
                              <FaPlay className="inline-block mr-2" />
                              Continuar
                            </>
                          )}
                        </button>
                        
                        <button
                          onClick={() => handleCancel(job.id)}
                          className="flex-1 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-bold text-lg transition-all"
                        >
                          <FaTimes className="inline-block mr-2" />
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Botão para Carregar TODAS as Consultas */}
            <div className="flex justify-center">
              <button
                onClick={loadTodasConsultas}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white px-8 py-4 rounded-xl font-bold text-xl transition-all shadow-lg hover:shadow-purple-500/50"
              >
                📚 Ver TODAS as Consultas (Únicas + Massa)
              </button>
            </div>

            {/* TODAS as Consultas */}
            {mostrarTodasConsultas && todasConsultas.length > 0 && (
              <div className="bg-gradient-to-br from-dark-800/90 to-dark-900/90 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-3xl font-black text-white">
                    🗂️ Todas as Consultas ({todasConsultas.length})
                  </h2>
                  <button
                    onClick={() => {
                      setMostrarTodasConsultas(false);
                      setFiltroTipo('todas');
                      setFiltroDataInicio('');
                      setFiltroDataFim('');
                    }}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-bold transition-all"
                  >
                    ✖️ Fechar
                  </button>
                </div>

                {/* Filtros */}
                <div className="bg-dark-700/50 border border-white/10 rounded-xl p-6 mb-6">
                  <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    🔍 Filtros
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Filtro por Tipo */}
                    <div>
                      <label className="block text-white/80 font-bold mb-2">
                        📋 Tipo de Consulta
                      </label>
                      <select
                        value={filtroTipo}
                        onChange={(e) => setFiltroTipo(e.target.value as 'todas' | 'unica' | 'massa')}
                        className="w-full bg-dark-600 border border-white/20 rounded-lg px-4 py-3 text-white font-bold focus:border-blue-500 focus:outline-none"
                      >
                        <option value="todas">📚 Todas</option>
                        <option value="unica">📋 Somente Únicas</option>
                        <option value="massa">📊 Somente em Massa</option>
                      </select>
                    </div>

                    {/* Filtro Data Início */}
                    <div>
                      <label className="block text-white/80 font-bold mb-2">
                        📅 Data Início
                      </label>
                      <input
                        type="date"
                        value={filtroDataInicio}
                        onChange={(e) => setFiltroDataInicio(e.target.value)}
                        className="w-full bg-dark-600 border border-white/20 rounded-lg px-4 py-3 text-white font-bold focus:border-blue-500 focus:outline-none"
                      />
                    </div>

                    {/* Filtro Data Fim */}
                    <div>
                      <label className="block text-white/80 font-bold mb-2">
                        📅 Data Fim
                      </label>
                      <input
                        type="date"
                        value={filtroDataFim}
                        onChange={(e) => setFiltroDataFim(e.target.value)}
                        className="w-full bg-dark-600 border border-white/20 rounded-lg px-4 py-3 text-white font-bold focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Botão Limpar Filtros */}
                  {(filtroTipo !== 'todas' || filtroDataInicio || filtroDataFim) && (
                    <div className="mt-4 flex items-center justify-between">
                      <p className="text-white/60">
                        Mostrando <span className="text-blue-400 font-bold">{consultasFiltradas.length}</span> de <span className="text-white font-bold">{todasConsultas.length}</span> consultas
                      </p>
                      <button
                        onClick={() => {
                          setFiltroTipo('todas');
                          setFiltroDataInicio('');
                          setFiltroDataFim('');
                        }}
                        className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg font-bold transition-all"
                      >
                        🔄 Limpar Filtros
                      </button>
                    </div>
                  )}
                </div>
                
                <div className="space-y-3 max-h-[800px] overflow-y-auto">
                  {consultasFiltradas.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-white/60 text-xl">
                        🔍 Nenhuma consulta encontrada com os filtros aplicados
                      </p>
                    </div>
                  ) : (
                    consultasFiltradas.map((consulta, idx) => (
                    <div key={`${consulta.tipo_consulta}-${consulta.id || idx}`} className="bg-dark-700/50 border border-white/10 rounded-xl p-4 flex items-center justify-between hover:border-blue-500/50 transition-all">
                      <div className="flex-1">
                        {consulta.tipo_consulta === 'unica' ? (
                          // Consulta Única
                          <>
                            <div className="flex items-center gap-3 mb-2">
                              <span className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-lg font-bold text-sm">
                                📋 ÚNICA
                              </span>
                              <span className={`px-3 py-1 rounded-lg font-bold text-sm ${
                                consulta.tipo_documento === 'CPF' 
                                  ? 'bg-green-500/20 text-green-300' 
                                  : 'bg-purple-500/20 text-purple-300'
                              }`}>
                                {consulta.tipo_documento}
                              </span>
                            </div>
                            <p className="text-xl font-bold text-white font-mono">
                              {consulta.documento}
                            </p>
                            <p className="text-lg text-white/60">
                              {new Date(consulta.created_at).toLocaleString('pt-BR')}
                            </p>
                          </>
                        ) : (
                          // Consulta em Massa
                          <>
                            <div className="flex items-center gap-3 mb-2">
                              <span className="px-3 py-1 bg-orange-500/20 text-orange-300 rounded-lg font-bold text-sm">
                                📊 MASSA
                              </span>
                              <span className={`px-3 py-1 rounded-lg font-bold text-sm ${
                                consulta.status === 'completed' 
                                  ? 'bg-green-500/20 text-green-300' 
                                  : consulta.status === 'error'
                                  ? 'bg-red-500/20 text-red-300'
                                  : 'bg-yellow-500/20 text-yellow-300'
                              }`}>
                                {consulta.status === 'completed' && '✅ Completo'}
                                {consulta.status === 'error' && '❌ Erro'}
                                {consulta.status === 'running' && '▶️ Em Execucao'}
                                {consulta.status === 'paused' && '⏸️ Pausado'}
                                {consulta.status === 'cancelled' && '🚫 Cancelado'}
                              </span>
                            </div>
                            <p className="text-xl font-bold text-white">
                              Job #{consulta.id} - {consulta.progress_total} documentos
                            </p>
                            <p className="text-lg text-white/60">
                              {new Date(consulta.created_at).toLocaleString('pt-BR')}
                            </p>
                          </>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-3">
                        {consulta.tipo_consulta === 'unica' ? (
                          <button
                            onClick={() => setModalDetalhes({
                              success: true,
                              tipo: consulta.tipo_documento as 'CPF' | 'CNPJ',
                              documento: consulta.documento,
                              dados: consulta.resultado
                            })}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold transition-all"
                          >
                            👁️ Ver Detalhes
                          </button>
                        ) : (
                          consulta.status === 'completed' && (
                            <button
                              onClick={() => handleLoadJobResults(consulta.id)}
                              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-bold transition-all"
                            >
                              📊 Carregar Resultados
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Histórico de Consultas Únicas */}
        {activeTab === 'single' && (
          <div className="bg-gradient-to-br from-dark-800/90 to-dark-900/90 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-8">
            <h2 className="text-3xl font-black text-white mb-6">
              📚 Histórico de Consultas ({historicoConsultas.length})
            </h2>
            
            {historicoConsultas.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-white/60 text-xl">
                  Nenhuma consulta realizada ainda
                </p>
                <p className="text-white/40 text-sm mt-2">
                  Faça uma consulta acima para ver o histórico aqui
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                {historicoConsultas.map((consulta: any) => (
                  <div key={consulta.id} className="bg-dark-700/50 border border-white/10 rounded-xl p-4 hover:border-blue-500/50 transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`px-3 py-1 rounded-lg font-bold text-sm ${
                            consulta.tipo_documento === 'CPF' 
                              ? 'bg-blue-500/20 text-blue-300' 
                              : 'bg-purple-500/20 text-purple-300'
                          }`}>
                            {consulta.tipo_documento}
                          </span>
                          <span className="text-white font-mono text-lg">{consulta.documento}</span>
                        </div>
                        <p className="text-white/60 text-sm">
                          {new Date(consulta.created_at).toLocaleString('pt-BR')}
                        </p>
                      </div>
                      
                      <button
                        onClick={() => setModalDetalhes({
                          success: true,
                          tipo: consulta.tipo_documento as 'CPF' | 'CNPJ',
                          documento: consulta.documento,
                          dados: consulta.resultado
                        })}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold transition-all"
                      >
                        👁️ Ver Detalhes
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Base de Dados */}
        {activeTab === 'database' && (
          <div className="bg-gradient-to-br from-dark-800/90 to-dark-900/90 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-8">
            <BaseDados />
          </div>
        )}

        {/* Verificação e Higienização */}
        {activeTab === 'verification' && (
          <div className="bg-gradient-to-br from-dark-800/90 to-dark-900/90 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-8 space-y-6">
            <h2 className="text-3xl font-black text-white mb-6">
              🔍 Verificação e Higienização de CPFs
            </h2>
            
            {/* Formulário de entrada */}
            <div className="space-y-6">
              <div>
                <label className="block text-xl font-bold mb-3 text-white">
                  📋 Cole os CPFs (um por linha) ou faça upload de arquivo
                </label>
                <textarea
                  value={verificationCpfs}
                  onChange={(e) => setVerificationCpfs(e.target.value)}
                  placeholder="12345678901&#10;98765432100&#10;..."
                  className="w-full bg-dark-700 border-2 border-white/20 rounded-xl px-4 py-3 text-white text-lg focus:outline-none focus:border-blue-500 transition-all font-mono"
                  rows={10}
                  disabled={verifyingCpfs || hygienizing}
                />
                <p className="text-white/60 text-sm mt-2">
                  💡 Você pode colar CPFs ou CNPJs (apenas números ou com formatação)
                </p>
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-white font-bold mb-2">📁 Ou faça upload de Excel/CSV</label>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleVerificationFileUpload}
                    className="w-full bg-dark-700 border-2 border-white/20 rounded-xl px-4 py-3 text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white file:cursor-pointer hover:file:bg-blue-700"
                    disabled={verifyingCpfs || hygienizing}
                  />
                  <p className="text-white/60 text-sm mt-1">
                    📊 CPFs devem estar na primeira coluna
                  </p>
                </div>
              </div>

              <div className="flex justify-center gap-4">
                <button
                  onClick={handleVerifyCpfs}
                  disabled={verifyingCpfs || hygienizing || !verificationCpfs.trim()}
                  className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-12 py-4 rounded-xl font-bold text-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/30"
                >
                  {verifyingCpfs ? (
                    <>
                      <FaSpinner className="inline-block mr-3 animate-spin text-2xl" />
                      Verificando...
                    </>
                  ) : (
                    <>
                      <FaSearch className="inline-block mr-3 text-2xl" />
                      Verificar CPFs na Base
                    </>
                  )}
                </button>

                {verificationResults && (
                  <button
                    onClick={() => {
                      setVerificationCpfs('');
                      setVerificationResults(null);
                      setAllHygienizedData([]);
                      setVerificationFile(null);
                      showNotification('✅ Tudo limpo! Pronto para nova verificação', 'success');
                    }}
                    disabled={verifyingCpfs || hygienizing}
                    className="bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white px-8 py-4 rounded-xl font-bold text-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FaTimes className="inline-block mr-3 text-2xl" />
                    Nova Verificação
                  </button>
                )}
              </div>
            </div>

            {/* Resultados da verificação */}
            {verificationResults && (
              <div className="mt-8 space-y-6">
                {/* Estatísticas */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-green-500/10 border-2 border-green-500/50 rounded-xl p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-green-300 text-sm font-bold mb-1">✅ CADASTRADOS</p>
                        <p className="text-white text-4xl font-black">{verificationResults.found.length}</p>
                      </div>
                      <FaCheckCircle className="text-6xl text-green-400/30" />
                    </div>
                  </div>

                  <div className="bg-orange-500/10 border-2 border-orange-500/50 rounded-xl p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-orange-300 text-sm font-bold mb-1">❌ NÃO CADASTRADOS</p>
                        <p className="text-white text-4xl font-black">{verificationResults.notFound.length}</p>
                      </div>
                      <FaTimesCircle className="text-6xl text-orange-400/30" />
                    </div>
                  </div>
                </div>

                {/* Configurações de Higienização */}
                {verificationResults.notFound.length > 0 && !hygienizing && (
                  <div className="bg-blue-500/10 border-2 border-blue-500/50 rounded-xl p-6 space-y-4">
                    <h3 className="text-2xl font-bold text-white mb-4">
                      ⚙️ Configurações de Higienização
                    </h3>

                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="block text-white font-bold mb-2">
                          🕐 Delay entre consultas (segundos)
                        </label>
                        <input
                          type="number"
                          value={hygienizationDelay}
                          onChange={(e) => setHygienizationDelay(Number(e.target.value))}
                          min="1"
                          max="10"
                          className="w-full bg-dark-700 border-2 border-white/20 rounded-xl px-4 py-3 text-white text-lg focus:outline-none focus:border-blue-500"
                        />
                        <p className="text-white/60 text-sm mt-1">
                          ⚠️ Recomendado: 2-3 segundos para evitar sobrecarga
                        </p>
                      </div>

                      <div>
                        <label className="block text-white font-bold mb-3">
                          📱 Verificar WhatsApp?
                        </label>
                        <div className="flex items-center gap-4">
                          <button
                            onClick={() => {
                              setVerifyWhatsappCheck(!verifyWhatsappCheck);
                              if (!verifyWhatsappCheck) setShowWhatsappOptions(true);
                              else setShowWhatsappOptions(false);
                            }}
                            className={`px-6 py-3 rounded-xl font-bold transition-all ${
                              verifyWhatsappCheck
                                ? 'bg-green-500/20 border-2 border-green-500/50 text-green-300'
                                : 'bg-red-500/20 border-2 border-red-500/50 text-red-300'
                            }`}
                          >
                            {verifyWhatsappCheck ? '✅ SIM' : '❌ NÃO'}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Opções de coluna WhatsApp */}
                    {verifyWhatsappCheck && showWhatsappOptions && (
                      <div className="bg-yellow-500/10 border-2 border-yellow-500/50 rounded-xl p-4">
                        <p className="text-yellow-300 font-bold mb-3">
                          📱 Qual coluna de telefone verificar?
                        </p>
                        <div className="grid grid-cols-4 gap-3">
                          <button
                            onClick={() => setWhatsappColumnChoice('first')}
                            className={`px-4 py-3 rounded-lg font-bold transition-all ${
                              whatsappColumnChoice === 'first'
                                ? 'bg-blue-600 text-white'
                                : 'bg-white/10 text-white/70 hover:bg-white/20'
                            }`}
                          >
                            1️⃣ Primeira
                          </button>
                          <button
                            onClick={() => setWhatsappColumnChoice('second')}
                            className={`px-4 py-3 rounded-lg font-bold transition-all ${
                              whatsappColumnChoice === 'second'
                                ? 'bg-blue-600 text-white'
                                : 'bg-white/10 text-white/70 hover:bg-white/20'
                            }`}
                          >
                            2️⃣ Segunda
                          </button>
                          <button
                            onClick={() => setWhatsappColumnChoice('third')}
                            className={`px-4 py-3 rounded-lg font-bold transition-all ${
                              whatsappColumnChoice === 'third'
                                ? 'bg-blue-600 text-white'
                                : 'bg-white/10 text-white/70 hover:bg-white/20'
                            }`}
                          >
                            3️⃣ Terceira
                          </button>
                          <button
                            onClick={() => setWhatsappColumnChoice('all')}
                            className={`px-4 py-3 rounded-lg font-bold transition-all ${
                              whatsappColumnChoice === 'all'
                                ? 'bg-blue-600 text-white'
                                : 'bg-white/10 text-white/70 hover:bg-white/20'
                            }`}
                          >
                            🔄 Todas
                          </button>
                        </div>
                        <p className="text-white/60 text-sm mt-3">
                          ⚠️ {
                            whatsappColumnChoice === 'first' ? 'Verificará apenas o primeiro telefone de cada registro' :
                            whatsappColumnChoice === 'second' ? 'Verificará apenas o segundo telefone de cada registro (se existir)' :
                            whatsappColumnChoice === 'third' ? 'Verificará apenas o terceiro telefone de cada registro (se existir)' :
                            'Verificará TODOS os telefones de cada registro (pode levar mais tempo)'
                          }
                        </p>
                      </div>
                    )}

                    <div className="flex gap-4 justify-center">
                      <button
                        onClick={handleHygienize}
                        className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white px-8 py-4 rounded-xl font-bold text-xl transition-all shadow-lg shadow-green-500/30"
                      >
                        <FaCheckCircle className="inline-block mr-3 text-2xl" />
                        Higienizar {verificationResults.notFound.length} CPFs via API
                      </button>
                    </div>
                  </div>
                )}

                {/* Progresso de Higienização */}
                {hygienizing && (
                  <div className="bg-purple-500/10 border-2 border-purple-500/50 rounded-xl p-8">
                    <h3 className="text-2xl font-bold text-white mb-6 text-center">
                      🔄 Higienização em Andamento
                    </h3>
                    
                    <div className="space-y-4">
                      <div className="flex justify-between text-white text-lg">
                        <span>📊 Total:</span>
                        <span className="font-bold">{hygienizationProgress.total}</span>
                      </div>
                      <div className="flex justify-between text-green-300 text-lg">
                        <span>✅ Consultados:</span>
                        <span className="font-bold">{hygienizationProgress.current}</span>
                      </div>
                      <div className="flex justify-between text-orange-300 text-lg">
                        <span>⏳ Faltam:</span>
                        <span className="font-bold">{hygienizationProgress.remaining}</span>
                      </div>

                      {/* Barra de progresso */}
                      <div className="w-full bg-dark-700 rounded-full h-8 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-green-500 to-blue-500 h-full transition-all duration-500 flex items-center justify-center"
                          style={{
                            width: `${(hygienizationProgress.current / hygienizationProgress.total) * 100}%`
                          }}
                        >
                          <span className="text-white font-bold text-sm">
                            {Math.round((hygienizationProgress.current / hygienizationProgress.total) * 100)}%
                          </span>
                        </div>
                      </div>

                      <div className="text-center">
                        <FaSpinner className="inline-block animate-spin text-4xl text-blue-400" />
                        <p className="text-white/70 mt-2">Aguarde, processando...</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Botões de Download */}
                {!hygienizing && (
                  <div className="flex gap-4 justify-center">
                    {verificationResults.found.length > 0 && (
                      <button
                        onClick={handleDownloadFoundOnly}
                        className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-8 py-4 rounded-xl font-bold text-xl transition-all shadow-lg shadow-blue-500/30"
                      >
                        <FaDownload className="inline-block mr-3 text-2xl" />
                        Baixar Somente Cadastrados ({verificationResults.found.length})
                      </button>
                    )}

                    {allHygienizedData.length > 0 && (
                      <button
                        onClick={handleDownloadComplete}
                        className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white px-8 py-4 rounded-xl font-bold text-xl transition-all shadow-lg shadow-purple-500/30"
                      >
                        <FaFileExcel className="inline-block mr-3 text-2xl" />
                        Baixar Base Completa ({verificationResults.found.length + allHygienizedData.length})
                      </button>
                    )}
                  </div>
                )}

                {/* Lista de CPFs Não Encontrados */}
                {verificationResults.notFound.length > 0 && !hygienizing && (
                  <details className="bg-orange-500/10 border-2 border-orange-500/50 rounded-xl p-4">
                    <summary className="text-orange-300 font-bold text-lg cursor-pointer">
                      📋 Ver CPFs Não Cadastrados ({verificationResults.notFound.length})
                    </summary>
                    <div className="mt-4 max-h-60 overflow-y-auto">
                      <div className="grid grid-cols-4 gap-2">
                        {verificationResults.notFound.map((cpf, idx) => (
                          <div key={idx} className="bg-dark-700/50 px-3 py-2 rounded-lg text-white/70 font-mono text-sm">
                            {cpf}
                          </div>
                        ))}
                      </div>
                    </div>
                  </details>
                )}
              </div>
            )}
          </div>
        )}

        {/* Lista de Restrição */}
        {activeTab === 'lista-restricao' && (
          <div className="bg-gradient-to-br from-dark-800/90 to-dark-900/90 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-8 space-y-6">
            <h2 className="text-3xl font-black text-white mb-6">
              🚫 Lista de Restrição
            </h2>
            
            {/* Estatísticas */}
            <div className="bg-gradient-to-br from-red-600 to-red-700 p-6 rounded-xl shadow-xl">
              <div className="text-red-100 text-sm mb-2">Total Bloqueados</div>
              <div className="text-5xl font-bold text-white">{listaRestricaoCpfs.length}</div>
            </div>

            {/* Adicionar CPF */}
            <div className="bg-dark-700 rounded-xl p-6 border border-white/10">
              <h3 className="text-xl font-bold text-white mb-4">Adicionar CPF/CNPJ</h3>
              <div className="flex gap-4">
                <input
                  type="text"
                  value={novoCpfRestricao}
                  onChange={(e) => setNovoCpfRestricao(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && adicionarCpfRestricao()}
                  placeholder="Digite o CPF ou CNPJ"
                  className="flex-1 bg-dark-600 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  disabled={loadingListaRestricao}
                />
                <button
                  onClick={adicionarCpfRestricao}
                  disabled={loadingListaRestricao}
                  className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white px-8 py-3 rounded-xl font-bold transition-all disabled:opacity-50"
                >
                  {loadingListaRestricao ? 'Aguarde...' : 'Adicionar'}
                </button>
              </div>
            </div>

            {/* Upload Excel */}
            <div className="bg-dark-700 rounded-xl p-6 border border-white/10">
              <h3 className="text-xl font-bold text-white mb-4">Upload em Massa</h3>
              <label className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold cursor-pointer transition-all inline-flex items-center gap-2">
                <FaUpload /> Upload Excel/CSV
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleUploadListaRestricao}
                  className="hidden"
                  disabled={loadingListaRestricao}
                />
              </label>
              <p className="text-white/50 text-sm mt-2">
                💡 CPFs devem estar na primeira coluna
              </p>
            </div>

            {/* Lista de CPFs Bloqueados */}
            <div className="bg-dark-700 rounded-xl p-6 border border-white/10">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-white">CPFs Bloqueados ({listaRestricaoCpfs.length})</h3>
                {listaRestricaoCpfs.length > 0 && (
                  <button
                    onClick={excluirTodosCpfsRestricao}
                    disabled={loadingListaRestricao}
                    className="bg-gradient-to-r from-red-700 to-red-800 hover:from-red-800 hover:to-red-900 text-white px-6 py-3 rounded-lg transition-all inline-flex items-center gap-2 font-bold border-2 border-red-400/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={`Excluir todos os ${listaRestricaoCpfs.length} CPFs desta lista`}
                  >
                    <FaTrash /> EXCLUIR TODOS ({listaRestricaoCpfs.length})
                  </button>
                )}
              </div>
              
              {loadingListaRestricao && listaRestricaoCpfs.length === 0 ? (
                <div className="text-center py-12 text-white/50">
                  <FaSpinner className="inline-block text-4xl animate-spin" />
                  <p className="mt-4">Carregando...</p>
                </div>
              ) : listaRestricaoCpfs.length === 0 ? (
                <div className="text-center py-12 text-white/50">
                  Nenhum CPF bloqueado
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left py-3 px-4 text-white">CPF/CNPJ</th>
                        <th className="text-left py-3 px-4 text-white">Data de Bloqueio</th>
                        <th className="text-center py-3 px-4 text-white">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {listaRestricaoCpfs.map((cpf) => (
                        <tr key={cpf.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="py-3 px-4 font-mono text-white">{formatarCpfRestricao(cpf.cpf)}</td>
                          <td className="py-3 px-4 text-white/70">
                            {new Date(cpf.data_adicao).toLocaleString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => removerCpfRestricao(cpf.cpf)}
                              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-all inline-flex items-center gap-2"
                            >
                              <FaTrash /> Remover
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Comprar Consultas Avulsas - REDESENHADO */}
        {activeTab === 'comprar-consultas' && (
          <div className="bg-gradient-to-br from-dark-800/90 to-dark-900/90 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-8 space-y-8">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-500/20 to-blue-500/20 border border-emerald-500/50 rounded-full px-6 py-2 mb-6">
                <FaFire className="text-orange-400 animate-pulse" />
                <span className="text-emerald-400 font-bold text-sm">OFERTA ESPECIAL • CRÉDITOS QUE NÃO EXPIRAM</span>
                <FaFire className="text-orange-400 animate-pulse" />
              </div>
              
              <h2 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-blue-400 to-purple-400 mb-4">
                Compre Consultas Avulsas
              </h2>
              <p className="text-lg text-gray-300">
                💎 Créditos <span className="text-emerald-400 font-bold">vitalícios</span> • Usados automaticamente quando seu plano acabar •
                <span className="text-blue-400 font-bold"> Quanto mais compra, mais economiza!</span>
              </p>
            </div>

            {/* Saldo Atual - Redesenhado */}
            <div className="relative bg-gradient-to-br from-emerald-500/10 via-blue-500/10 to-purple-500/10 border-2 border-emerald-500/30 rounded-2xl p-6 mb-8 overflow-hidden shadow-2xl shadow-emerald-500/20">
              <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl"></div>
              <div className="absolute bottom-0 left-0 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl"></div>
              
              <div className="relative flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                      <FaCheckCircle className="text-xl text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-emerald-400 text-xs font-bold tracking-wider uppercase">Seu Saldo Atual</p>
                    </div>
                  </div>
                  <p className="text-6xl font-black text-white mb-1">{saldoAvulso}</p>
                  <p className="text-gray-400 flex items-center gap-2 text-sm">
                    <FaBolt className="text-yellow-400" />
                    <span className="font-semibold">Pronto para usar a qualquer momento</span>
                  </p>
                </div>
                <div className="hidden md:block">
                  <div className="w-28 h-28 bg-gradient-to-br from-emerald-500/20 to-blue-500/20 rounded-2xl flex items-center justify-center animate-pulse">
                    <FaChartLine className="text-6xl text-emerald-400/30" />
                  </div>
                </div>
              </div>
            </div>

            {/* Pacotes */}
            {loadingPacotes ? (
              <div className="flex justify-center py-12">
                <FaSpinner className="animate-spin text-6xl text-emerald-400" />
              </div>
            ) : (
              <>
                <div className="text-center mb-8">
                  <h3 className="text-4xl font-black text-white mb-3 flex items-center justify-center gap-3">
                    <FaGift className="text-emerald-400" />
                    Pacotes Especiais
                    <FaGift className="text-emerald-400" />
                  </h3>
                  <p className="text-gray-400 text-lg">
                    Escolha o pacote ideal e <span className="text-emerald-400 font-bold">economize até 40%</span>!
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                  {pacotes.map((pacote) => (
                    <div
                      key={pacote.id}
                      className={`relative group cursor-pointer transition-all duration-300 ${
                        pacote.popular ? 'md:-mt-4 md:mb-4 z-10' : ''
                      }`}
                      onClick={() => handleComprarConsultas(pacote.quantidade, pacote.preco)}
                    >
                      <div className={`relative bg-gradient-to-br rounded-2xl p-6 transition-all duration-300 border-2 ${
                        pacote.popular
                          ? 'from-emerald-900/40 via-blue-900/40 to-purple-900/40 border-emerald-500 shadow-2xl shadow-emerald-500/50 group-hover:shadow-emerald-500/70'
                          : 'from-gray-800/50 to-gray-900/50 border-gray-700 group-hover:border-emerald-500 group-hover:shadow-xl group-hover:shadow-emerald-500/30'
                      } group-hover:scale-105 group-hover:-translate-y-2`}>
                        
                        {pacote.popular && (
                          <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                            <div className="bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 text-white text-xs font-black px-4 py-2 rounded-full shadow-lg flex items-center gap-2 animate-pulse">
                              <FaStar className="text-white" />
                              MAIS VENDIDO
                              <FaStar className="text-white" />
                            </div>
                          </div>
                        )}

                        {pacote.desconto > 0 && (
                          <div className="absolute -top-3 -right-3">
                            <div className="relative">
                              <div className="bg-gradient-to-br from-red-500 to-pink-600 text-white font-black text-lg w-16 h-16 rounded-full flex items-center justify-center shadow-xl transform rotate-12 animate-bounce">
                                -{pacote.desconto}%
                              </div>
                              <div className="absolute inset-0 bg-gradient-to-br from-red-500 to-pink-600 rounded-full blur-xl opacity-50 animate-pulse"></div>
                            </div>
                          </div>
                        )}

                        <div className="text-center pt-2">
                          <p className={`text-sm font-bold mb-3 uppercase tracking-wider ${
                            pacote.popular ? 'text-emerald-400' : 'text-gray-400'
                          }`}>
                            {pacote.nome}
                          </p>
                          
                          <div className="mb-4">
                            <p className="text-6xl font-black text-white mb-1">{pacote.quantidade}</p>
                            <p className="text-gray-400 text-sm font-semibold">consultas</p>
                          </div>

                          <div className="bg-black/30 backdrop-blur-sm rounded-xl p-4 mb-4 border border-white/10">
                            <div className="flex items-baseline justify-center gap-1 mb-2">
                              <span className="text-gray-400 text-sm">R$</span>
                              <span className="text-4xl font-black text-emerald-400">{pacote.preco.toFixed(2).split('.')[0]}</span>
                              <span className="text-emerald-400 text-xl">,{pacote.preco.toFixed(2).split('.')[1]}</span>
                            </div>
                            <div className="flex items-center justify-center gap-2 text-xs">
                              <span className="text-gray-500">apenas</span>
                              <span className="text-emerald-400 font-bold">{formatCurrency(pacote.preco_unitario)}</span>
                              <span className="text-gray-500">por consulta</span>
                            </div>
                          </div>

                          {pacote.desconto > 0 && (
                            <div className="flex items-center justify-center gap-2 mb-4">
                              <FaFire className="text-orange-400 animate-pulse" />
                              <span className="text-orange-400 font-bold text-sm">
                                ECONOMIA DE {pacote.desconto}%
                              </span>
                              <FaFire className="text-orange-400 animate-pulse" />
                            </div>
                          )}

                          <button
                            className={`w-full font-black py-4 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 shadow-lg ${
                              pacote.popular
                                ? 'bg-gradient-to-r from-emerald-500 via-blue-500 to-purple-500 hover:from-emerald-600 hover:via-blue-600 hover:to-purple-600 text-white shadow-emerald-500/50 hover:shadow-emerald-500/70 hover:scale-105'
                                : 'bg-emerald-500 hover:bg-emerald-600 text-white hover:shadow-emerald-500/50'
                            }`}
                            disabled={processingCompra}
                          >
                            {processingCompra ? (
                              <FaSpinner className="animate-spin" />
                            ) : (
                              <>
                                <FaShoppingCart />
                                COMPRAR AGORA
                                <FaBolt className="text-yellow-300" />
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Tabela de Faixas de Preço */}
                <div className="bg-gradient-to-br from-blue-900/20 via-purple-900/20 to-pink-900/20 border-2 border-blue-500/30 rounded-2xl p-8 mb-8 shadow-2xl">
                  <div className="text-center mb-6">
                    <div className="inline-flex items-center gap-2 bg-blue-500/20 border border-blue-500/50 rounded-full px-4 py-2 mb-4">
                      <FaInfoCircle className="text-blue-400" />
                      <span className="text-blue-400 font-bold text-sm">TABELA DE PREÇOS</span>
                    </div>
                    <h3 className="text-3xl font-black text-white mb-2">💎 Faixas de Preço por Quantidade</h3>
                    <p className="text-gray-400">Quanto mais você compra, menor o preço unitário!</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <div className="bg-black/30 backdrop-blur-sm border border-blue-500/30 rounded-xl p-4 text-center hover:scale-105 transition-transform">
                      <div className="text-blue-400 font-bold text-xs mb-2">1 - 300 consultas</div>
                      <div className="text-2xl font-black text-white mb-1">R$ 0,08</div>
                      <div className="text-gray-400 text-xs">por consulta</div>
                    </div>
                    
                    <div className="bg-black/30 backdrop-blur-sm border border-purple-500/30 rounded-xl p-4 text-center hover:scale-105 transition-transform">
                      <div className="text-purple-400 font-bold text-xs mb-2">301 - 600 consultas</div>
                      <div className="text-2xl font-black text-white mb-1">R$ 0,07</div>
                      <div className="text-gray-400 text-xs">por consulta</div>
                      <div className="text-green-400 text-xs font-bold mt-1">↓ 12,5% OFF</div>
                    </div>
                    
                    <div className="bg-black/30 backdrop-blur-sm border border-pink-500/30 rounded-xl p-4 text-center hover:scale-105 transition-transform">
                      <div className="text-pink-400 font-bold text-xs mb-2">601 - 999 consultas</div>
                      <div className="text-2xl font-black text-white mb-1">R$ 0,07</div>
                      <div className="text-gray-400 text-xs">por consulta</div>
                      <div className="text-green-400 text-xs font-bold mt-1">↓ 12,5% OFF</div>
                    </div>
                    
                    <div className="bg-gradient-to-br from-yellow-900/30 to-orange-900/30 border-2 border-yellow-500/50 rounded-xl p-4 text-center hover:scale-105 transition-transform relative overflow-hidden">
                      <div className="absolute top-1 right-1">
                        <FaStar className="text-yellow-400 animate-spin" style={{ animationDuration: '3s' }} />
                      </div>
                      <div className="text-yellow-400 font-bold text-xs mb-2">1000+ consultas</div>
                      <div className="text-2xl font-black text-white mb-1">R$ 0,06</div>
                      <div className="text-gray-400 text-xs">por consulta</div>
                      <div className="text-green-400 text-xs font-bold mt-1">↓ 25% MELHOR!</div>
                    </div>
                  </div>

                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 text-center">
                    <p className="text-yellow-400 text-xs font-semibold flex items-center justify-center gap-2">
                      <FaBolt />
                      Quanto maior a quantidade, maior a economia!
                      <FaBolt />
                    </p>
                  </div>
                </div>

                {/* Quantidade Personalizada */}
                <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 border-2 border-gray-700 rounded-2xl p-6 hover:border-emerald-500/50 transition-all">
                  <div className="text-center mb-4">
                    <h3 className="text-2xl font-black text-white mb-2 flex items-center justify-center gap-3">
                      <FaBolt className="text-yellow-400" />
                      Quantidade Personalizada
                      <FaBolt className="text-yellow-400" />
                    </h3>
                    <p className="text-gray-400">
                      Escolha a quantidade exata que você precisa!
                    </p>
                  </div>

                  <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-3 mb-4">
                    <div className="flex items-start gap-2">
                      <FaInfoCircle className="text-orange-400 text-lg mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-orange-400 font-bold text-sm mb-1">⚠️ Atenção: Quantidade Mínima</p>
                        <p className="text-gray-400 text-xs">
                          Para compra personalizada, o mínimo é <span className="text-white font-bold">100 consultas</span>.
                          Para quantidades menores, escolha um dos <span className="text-emerald-400 font-bold">pacotes acima</span>!
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col md:flex-row gap-4">
                    <input
                      type="number"
                      min="100"
                      placeholder="Digite a quantidade (mínimo 100)"
                      value={quantidadeCustomizada}
                      onChange={(e) => setQuantidadeCustomizada(e.target.value)}
                      className="flex-1 bg-black/30 border-2 border-gray-700 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-emerald-500 font-semibold placeholder-gray-500 transition-all"
                    />
                    <button
                      onClick={() => {
                        const qtd = parseInt(quantidadeCustomizada);
                        if (!qtd || qtd < 1) {
                          showNotification('❌ Quantidade inválida', 'error');
                          return;
                        }
                        if (qtd < 100) {
                          showNotification('⚠️ Para quantidade personalizada, o mínimo é 100 consultas!', 'error');
                          return;
                        }
                        let precoUnitario = 1.50;
                        if (qtd >= 1000) precoUnitario = 0.06;
                        else if (qtd >= 601) precoUnitario = 0.07;
                        else if (qtd >= 301) precoUnitario = 0.07;
                        else if (qtd >= 100) precoUnitario = 0.08;
                        const valorTotal = Number((qtd * precoUnitario).toFixed(2));
                        handleComprarConsultas(qtd, valorTotal);
                      }}
                      disabled={processingCompra || !quantidadeCustomizada}
                      className="bg-gradient-to-r from-emerald-500 to-blue-500 hover:from-emerald-600 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black px-8 py-3 rounded-xl transition-all flex items-center justify-center gap-3 shadow-lg hover:shadow-emerald-500/50 hover:scale-105 disabled:hover:scale-100"
                    >
                      {processingCompra ? (
                        <FaSpinner className="animate-spin text-xl" />
                      ) : (
                        <>
                          <FaShoppingCart />
                          COMPRAR AGORA
                          <FaBolt className="text-yellow-300" />
                        </>
                      )}
                    </button>
                  </div>

                  {quantidadeCustomizada && parseInt(quantidadeCustomizada) >= 100 && (
                    <div className="mt-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
                      <div className="flex items-center justify-between text-sm">
                        <div>
                          <p className="text-gray-400 mb-1">Você está comprando:</p>
                          <p className="text-2xl font-black text-white">{quantidadeCustomizada} consultas</p>
                        </div>
                        <div className="text-right">
                          <p className="text-gray-400 mb-1">Valor total:</p>
                          <p className="text-2xl font-black text-emerald-400">
                            {formatCurrency(parseInt(quantidadeCustomizada) * (parseInt(quantidadeCustomizada) >= 1000 ? 0.06 : parseInt(quantidadeCustomizada) >= 601 ? 0.07 : parseInt(quantidadeCustomizada) >= 301 ? 0.07 : 0.08))}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Modal de Pagamento */}
        {showPaymentModal && paymentData && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-[#1e2738] rounded-2xl border border-gray-700 max-w-md w-full p-8 max-h-[90vh] overflow-y-auto">
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  carregarPacotesESaldo();
                }}
                className="float-right text-gray-400 hover:text-white text-2xl leading-none"
              >
                ×
              </button>

              <h2 className="text-2xl font-bold text-white mb-6">✅ Cobrança Gerada!</h2>

              <div className="bg-[#0f1419] rounded-lg p-4 mb-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-400">Quantidade:</span>
                  <span className="text-white font-bold">{paymentData.quantidade_consultas} consultas</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Valor:</span>
                  <span className="text-emerald-400 font-bold text-2xl">{formatCurrency(paymentData.valor)}</span>
                </div>
              </div>

              {paymentData.pix_qr_code && (
                <div className="bg-white rounded-lg p-6 mb-6 text-center">
                  <p className="text-gray-800 font-semibold mb-4">Escaneie o QR Code PIX</p>
                  <img
                    src={paymentData.pix_qr_code}
                    alt="QR Code PIX"
                    className="mx-auto max-w-[250px]"
                  />
                </div>
              )}

              {paymentData.pix_copy_paste && (
                <div className="mb-6">
                  <p className="text-gray-400 text-sm mb-3 text-center">
                    Ou copie o código PIX:
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={paymentData.pix_copy_paste}
                      readOnly
                      className="flex-1 bg-[#0f1419] text-white px-4 py-3 rounded-lg text-sm font-mono border border-gray-700"
                    />
                    <button
                      onClick={() => copyToClipboard(paymentData.pix_copy_paste)}
                      className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-3 rounded-lg font-semibold transition-all whitespace-nowrap flex items-center gap-2"
                    >
                      <FaCopy /> Copiar
                    </button>
                  </div>
                </div>
              )}

              <div className="bg-emerald-900/20 border border-emerald-700/50 rounded-lg p-4 text-center">
                <p className="text-emerald-400 text-sm">
                  ⏳ Após o pagamento, os créditos serão adicionados automaticamente à sua conta!
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Resultados Carregados */}
        {loadedResults.length > 0 && (
          <div id="resultados-section" className="bg-gradient-to-br from-dark-800/90 to-dark-900/90 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-3xl font-black text-white">
                📊 Resultados ({loadedResults.length})
              </h2>
              
              <div className="flex gap-3">
                <button
                  onClick={handleExportExcel}
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-bold text-lg transition-all shadow-lg"
                >
                  <FaFileExcel className="inline-block mr-2 text-xl" />
                  Excel
                </button>
                
                <button
                  onClick={handleExportCSV}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold text-lg transition-all shadow-lg"
                >
                  <FaFileCsv className="inline-block mr-2 text-xl" />
                  CSV
                </button>
                
                <button
                  onClick={() => setLoadedResults([])}
                  className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-bold text-lg transition-all shadow-lg"
                >
                  <FaTimes className="inline-block mr-2 text-xl" />
                  Limpar
                </button>
              </div>
            </div>
            
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
              {loadedResults.map((result, idx) => (
                <div key={idx} className={`p-4 rounded-xl border-2 ${
                  result.success 
                    ? 'bg-green-500/10 border-green-500/30' 
                    : 'bg-red-500/10 border-red-500/30'
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xl font-bold text-white">
                        {result.documento}
                      </p>
                      <p className="text-lg text-white/70">
                        {result.tipo} - {result.success ? '✅ Sucesso' : `❌ ${result.erro}`}
                      </p>
                      {result.success && result.dados && (
                        <p className="text-lg text-white/80 mt-1">
                          {result.tipo === 'CPF' 
                            ? result.dados.CADASTRAIS?.NOME 
                            : result.dados.CADASTRAIS?.RAZAO}
                        </p>
                      )}
                    </div>
                    
                    <span className={`px-4 py-2 rounded-lg font-bold ${
                      result.tipo === 'CPF' 
                        ? 'bg-blue-500/20 text-blue-300' 
                        : 'bg-purple-500/20 text-purple-300'
                    }`}>
                      {result.tipo}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal de Detalhes */}
      {modalDetalhes && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setModalDetalhes(null)}>
          <div className="bg-gradient-to-br from-dark-800 to-dark-900 border-2 border-white/20 rounded-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {/* Cabeçalho do Modal */}
            <div className="sticky top-0 bg-dark-900/95 backdrop-blur-xl border-b-2 border-white/20 p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h2 className="text-3xl font-black text-white">
                  📋 Detalhes da Consulta
                </h2>
                <span className={`px-4 py-2 rounded-lg font-bold ${
                  modalDetalhes.tipo === 'CPF' 
                    ? 'bg-blue-500/20 text-blue-300' 
                    : 'bg-purple-500/20 text-purple-300'
                }`}>
                  {modalDetalhes.tipo}
                </span>
              </div>
              <button
                onClick={() => setModalDetalhes(null)}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-bold text-lg transition-all"
              >
                ✖️ Fechar
              </button>
            </div>

            {/* Conteúdo do Modal */}
            <div className="p-6">
              <p className="text-2xl text-white/80 mb-6">
                <strong>Documento:</strong> {modalDetalhes.documento}
              </p>

              {modalDetalhes.dados && (
                <div className="space-y-6">
                  {modalDetalhes.tipo === 'CPF' ? (
                    <RenderCPFData 
                      dados={modalDetalhes.dados} 
                      phonePhotos={phonePhotos}
                      loadingPhones={loadingPhones}
                      consultarWhatsappProfile={consultarWhatsappProfile}
                      setSelectedPhotoModal={setSelectedPhotoModal}
                    />
                  ) : (
                    <RenderCNPJData 
                      dados={modalDetalhes.dados} 
                      phonePhotos={phonePhotos}
                      loadingPhones={loadingPhones}
                      consultarWhatsappProfile={consultarWhatsappProfile}
                      setSelectedPhotoModal={setSelectedPhotoModal}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Foto Ampliada */}
      {selectedPhotoModal && (
        <div 
          className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
          onClick={() => setSelectedPhotoModal(null)}
        >
          <div 
            className="relative bg-dark-800 rounded-2xl p-6 max-w-[95vw] max-h-[95vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Botão Fechar */}
            <button
              onClick={() => setSelectedPhotoModal(null)}
              className="absolute top-4 right-4 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-bold transition-all z-10"
            >
              ✖️ Fechar
            </button>

            {/* Título */}
            <div className="mb-6 pr-24">
              <h3 className="text-2xl font-bold text-white mb-2">
                📷 Foto de Perfil do WhatsApp
              </h3>
              <p className="text-white/70">
                <strong>Nome:</strong> {selectedPhotoModal.name}
              </p>
              <p className="text-white/70">
                <strong>Telefone:</strong> {selectedPhotoModal.phone}
              </p>
            </div>

            {/* Imagem Ampliada */}
            <div className="flex items-center justify-center">
              <img 
                src={selectedPhotoModal.url} 
                alt={`Foto de ${selectedPhotoModal.name}`}
                className="max-w-[85vw] max-h-[75vh] min-w-[500px] rounded-xl shadow-2xl border-4 border-green-500/50"
                style={{ objectFit: 'contain' }}
              />
            </div>

            {/* Info */}
            <div className="mt-6 text-center text-white/50 text-sm">
              💡 Clique fora da imagem ou no botão "Fechar" para sair
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Componente para renderizar dados de CPF - VERSÃO COMPLETA
function RenderCPFData({ 
  dados, 
  phonePhotos, 
  loadingPhones, 
  consultarWhatsappProfile, 
  setSelectedPhotoModal 
}: { 
  dados: any;
  phonePhotos: Map<string, { url: string | null; name: string; hasWhatsApp?: boolean }>;
  loadingPhones: Set<string>;
  consultarWhatsappProfile: (telefones: any[]) => void;
  setSelectedPhotoModal: (modal: { url: string; name: string; phone: string } | null) => void;
}) {
  const cad = dados.CADASTRAIS || {};
  const enderecos = dados.ENDERECOS || [];
  const telefones = dados.TELEFONES || [];
  const emails = dados.EMAILS || [];
  
  return (
    <div className="space-y-6">
      {/* Dados Cadastrais COMPLETOS */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-6">
        <h4 className="text-2xl font-bold text-blue-300 mb-4 flex items-center gap-2">
          <FaUser /> Dados Cadastrais Completos
        </h4>
        <div className="grid md:grid-cols-2 gap-4 text-white/80">
          <div>
            <p className="mb-2"><strong className="text-white">Nome:</strong> {cad.NOME || '-'}</p>
            <p className="mb-2"><strong className="text-white">Nome da Mãe:</strong> {cad.MAE || cad.NOME_MAE || cad.NOMEMAE || cad.MÃE || '-'}</p>
            <p className="mb-2"><strong className="text-white">Sexo:</strong> {cad.SEXO || '-'}</p>
            <p className="mb-2"><strong className="text-white">Nascimento:</strong> {cad.NASC || '-'} {cad.IDADE ? `(${cad.IDADE} anos)` : ''}</p>
            <p className="mb-2"><strong className="text-white">Estado Civil:</strong> {cad.ESTADOCIVIL || '-'}</p>
            <p className="mb-2"><strong className="text-white">RG:</strong> {cad.RG || '-'} {cad.ORGAOEMISSOR ? `- ${cad.ORGAOEMISSOR}` : ''}</p>
          </div>
          <div>
            <p className="mb-2"><strong className="text-white">Título Eleitor:</strong> {cad.TITULO || '-'}</p>
            <p className="mb-2"><strong className="text-white">Renda:</strong> {cad.RENDA || '-'}</p>
            <p className="mb-2"><strong className="text-white">Tipo:</strong> {cad.TIPO || '-'}</p>
            <p className="mb-2"><strong className="text-white">Score Crédito:</strong> {cad.SCORE || cad.SCORE_CREDITO || '-'}</p>
            <p className="mb-2"><strong className="text-white">Score Digital:</strong> {cad.SCORE_DIGITAL || cad.SCOREDIGITAL || '-'}</p>
            <p className="mb-2"><strong className="text-white">Flag Óbito:</strong> {cad.FLAG_DE_OBITO || cad.OBITO || cad.FLAGOBITO || cad.FLG_OBITO || '-'}</p>
            <p className="mb-2"><strong className="text-white">Flag FGTS:</strong> {cad.FLAG_FGTS || cad.FLAGFGTS || cad.FLG_FGTS || cad.FGTS || '-'}</p>
          </div>
        </div>
      </div>
      
      {/* Contatos */}
      <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xl font-bold text-green-300 flex items-center gap-2">
            <FaPhone /> Contatos ({telefones.length} telefones, {emails.length} emails)
          </h4>
          {telefones.length > 0 && (
            <button
              onClick={() => consultarWhatsappProfile(telefones)}
              disabled={loadingPhones.size > 0}
              className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white px-6 py-3 rounded-lg font-bold transition-all flex items-center gap-2 shadow-lg border-2 border-green-400/30 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Consultar WhatsApp de todos os telefones"
            >
              {loadingPhones.size > 0 ? (
                <>
                  <FaSpinner className="animate-spin text-lg" />
                  Consultando {loadingPhones.size}/{telefones.length}...
                </>
              ) : (
                <>
                  <FaWhatsapp className="text-lg" />
                  Consultar Todos os WhatsApps
                </>
              )}
            </button>
          )}
        </div>
        <div className="space-y-2 text-white/80">
          {telefones.map((tel: any, i: number) => {
            const numeroLimpo = `55${tel.DDD}${tel.TELEFONE}`;
            
            const copiarNumero = () => {
              navigator.clipboard.writeText(numeroLimpo);
              // Toast notification
              const toast = document.createElement('div');
              toast.className = 'fixed top-8 right-8 bg-green-500/90 text-white px-6 py-3 rounded-xl font-bold shadow-2xl z-50 animate-fade-in';
              toast.textContent = `📋 Copiado: ${numeroLimpo}`;
              document.body.appendChild(toast);
              setTimeout(() => toast.remove(), 2000);
            };
            
            const profilePhoto = phonePhotos.get(numeroLimpo);
            const isLoadingPhone = loadingPhones.has(numeroLimpo);
            
            // DEBUG: Ver o que está armazenado
            if (profilePhoto) {
              console.log(`🔍 DEBUG CPF Tel ${i + 1} (${numeroLimpo}):`, {
                temFoto: !!profilePhoto.url,
                hasWhatsApp: profilePhoto.hasWhatsApp,
                nome: profilePhoto.name
              });
            }
            
            // Usar status de WhatsApp da foto consultada OU dos dados originais
            const hasWhatsApp = profilePhoto?.hasWhatsApp !== undefined 
              ? profilePhoto.hasWhatsApp 
              : tel.HAS_WHATSAPP;
            const whatsappVerified = profilePhoto !== undefined || tel.WHATSAPP_VERIFIED;
            
            console.log(`🎨 RENDERIZANDO CPF Tel ${i + 1}:`, {
              hasWhatsApp,
              whatsappVerified,
              corFundo: hasWhatsApp ? 'VERDE' : whatsappVerified ? 'VERMELHO' : 'SEM COR'
            });
            
            return (
              <div 
                key={i} 
                className={`flex items-center justify-between p-3 rounded-lg transition-all ${
                  hasWhatsApp 
                    ? 'bg-green-500/20 border-2 border-green-500/50' 
                    : whatsappVerified 
                    ? 'bg-red-500/10 border-2 border-red-500/30' 
                    : 'bg-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  {isLoadingPhone ? (
                    <div className="w-12 h-12 flex items-center justify-center">
                      <FaSpinner className="text-3xl text-green-400 animate-spin" />
                    </div>
                  ) : profilePhoto?.url ? (
                    <div 
                      className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-green-400 shadow-lg cursor-pointer hover:scale-110 transition-transform"
                      onClick={() => setSelectedPhotoModal({ 
                        url: profilePhoto.url!, 
                        name: profilePhoto.name,
                        phone: numeroLimpo
                      })}
                      title="Clique para ampliar"
                    >
                      <img 
                        src={profilePhoto.url} 
                        alt={`Foto de ${profilePhoto.name}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : hasWhatsApp ? (
                    <FaWhatsapp className="text-3xl text-green-400 animate-pulse" />
                  ) : whatsappVerified ? (
                    <span className="text-3xl">❌</span>
                  ) : null}
                  <div>
                    <p>
                      <strong>Tel {i + 1}:</strong> ({tel.DDD}) {tel.TELEFONE} - {tel.OPERADORA}
                    </p>
                    {isLoadingPhone && (
                      <p className="text-xs text-yellow-300 animate-pulse">
                        🔄 Consultando...
                      </p>
                    )}
                    {profilePhoto?.url && !isLoadingPhone && (
                      <p className="text-xs text-green-300">
                        ✓ Foto carregada - clique para ampliar
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <button
                    onClick={copiarNumero}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg font-bold text-sm transition-all flex items-center gap-2"
                    title={`Copiar ${numeroLimpo}`}
                  >
                    📋 Copiar
                  </button>
                  
                  {whatsappVerified && (
                    <div className="flex flex-col items-end gap-1">
                      <span className={`flex items-center gap-2 px-3 py-1 rounded-lg text-sm font-bold ${
                        hasWhatsApp 
                          ? 'bg-green-500/30 text-green-300' 
                          : 'bg-red-500/30 text-red-300'
                      }`}>
                        <FaWhatsapp className="text-lg" />
                        {hasWhatsApp ? 'Tem WhatsApp' : 'Sem WhatsApp'}
                      </span>
                      <span className="text-xs text-white/50">
                        via {profilePhoto ? 'Consulta' : tel.VERIFIED_BY || 'Sistema'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {emails.map((email: any, i: number) => (
            <p key={i}>
              <FaEnvelope className="inline mr-2" />
              {email.EMAIL}
            </p>
          ))}
        </div>
      </div>
      
      {/* Endereços COMPLETOS */}
      {enderecos.length > 0 && (
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-6">
          <h4 className="text-2xl font-bold text-purple-300 mb-4 flex items-center gap-2">
            <FaMapMarkerAlt /> Endereços ({enderecos.length})
          </h4>
          <div className="space-y-4">
            {enderecos.map((end: any, i: number) => (
              <div key={i} className="bg-dark-800/50 p-4 rounded-lg border border-purple-500/20">
                <p className="font-bold text-purple-300 mb-3 text-lg">📍 Endereço {i + 1}</p>
                <div className="grid md:grid-cols-2 gap-3 text-white/80">
                  <div>
                    <p className="mb-2"><strong className="text-white">Logradouro:</strong> {end.LOGRADOURO || '-'}</p>
                    <p className="mb-2"><strong className="text-white">Número:</strong> {end.NUMERO || '-'}</p>
                    <p className="mb-2"><strong className="text-white">Complemento:</strong> {end.COMPLEMENTO || '-'}</p>
                    <p className="mb-2"><strong className="text-white">Bairro:</strong> {end.BAIRRO || '-'}</p>
                  </div>
                  <div>
                    <p className="mb-2"><strong className="text-white">Cidade:</strong> {end.CIDADE || '-'}</p>
                    <p className="mb-2"><strong className="text-white">UF:</strong> {end.UF || '-'}</p>
                    <p className="mb-2"><strong className="text-white">CEP:</strong> {end.CEP || '-'}</p>
                    <p className="mb-2"><strong className="text-white">Área de Risco:</strong> {end.AREARISCO || '-'}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Componente para renderizar dados de CNPJ - VERSÃO COMPLETA
function RenderCNPJData({ 
  dados, 
  phonePhotos, 
  loadingPhones, 
  consultarWhatsappProfile, 
  setSelectedPhotoModal 
}: { 
  dados: any;
  phonePhotos: Map<string, { url: string | null; name: string; hasWhatsApp?: boolean }>;
  loadingPhones: Set<string>;
  consultarWhatsappProfile: (telefones: any[]) => void;
  setSelectedPhotoModal: (modal: { url: string; name: string; phone: string } | null) => void;
}) {
  const cad = dados.CADASTRAIS || {};
  const enderecos = dados.ENDERECOS || [];
  const telefones = dados.TELEFONES || [];
  const emails = dados.EMAILS || [];
  const qsa = dados.QSA?.[0]?.QSA || [];
  
  return (
    <div className="space-y-6">
      {/* Dados da Empresa COMPLETOS */}
      <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-6">
        <h4 className="text-2xl font-bold text-purple-300 mb-4 flex items-center gap-2">
          <FaBuilding /> Dados da Empresa Completos
        </h4>
        <div className="grid md:grid-cols-2 gap-4 text-white/80">
          <div>
            <p className="mb-2"><strong className="text-white">Razão Social:</strong> {cad.RAZAO || '-'}</p>
            <p className="mb-2"><strong className="text-white">Nome Fantasia:</strong> {cad.NOME_FANTASIA || '-'}</p>
            <p className="mb-2"><strong className="text-white">CNAE:</strong> {cad.CNAE || '-'}</p>
            <p className="mb-2"><strong className="text-white">Descrição CNAE:</strong> {cad.DESC_CNAE || '-'}</p>
          </div>
          <div>
            <p className="mb-2"><strong className="text-white">Data Abertura:</strong> {cad.DATA_ABERTURA || '-'}</p>
            <p className="mb-2"><strong className="text-white">Situação:</strong> {cad.SITUACAO || '-'}</p>
            <p className="mb-2"><strong className="text-white">Score Crédito:</strong> {cad.SCORE || '-'}</p>
            <p className="mb-2"><strong className="text-white">Capital Social:</strong> {cad.CAPITAL_SOCIAL || '-'}</p>
          </div>
        </div>
      </div>
      
      {/* Contatos */}
      <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xl font-bold text-green-300 flex items-center gap-2">
            <FaPhone /> Contatos ({telefones.length} telefones, {emails.length} emails)
          </h4>
          {telefones.length > 0 && (
            <button
              onClick={() => consultarWhatsappProfile(telefones)}
              disabled={loadingPhones.size > 0}
              className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white px-6 py-3 rounded-lg font-bold transition-all flex items-center gap-2 shadow-lg border-2 border-green-400/30 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Consultar WhatsApp de todos os telefones"
            >
              {loadingPhones.size > 0 ? (
                <>
                  <FaSpinner className="animate-spin text-lg" />
                  Consultando {loadingPhones.size}/{telefones.length}...
                </>
              ) : (
                <>
                  <FaWhatsapp className="text-lg" />
                  Consultar Todos os WhatsApps
                </>
              )}
            </button>
          )}
        </div>
        <div className="space-y-2 text-white/80">
          {telefones.map((tel: any, i: number) => {
            const numeroLimpo = `55${tel.DDD}${tel.TELEFONE}`;
            const profilePhoto = phonePhotos.get(numeroLimpo);
            const isLoadingPhone = loadingPhones.has(numeroLimpo);
            
            // Usar status de WhatsApp da foto consultada OU dos dados originais
            const hasWhatsApp = profilePhoto?.hasWhatsApp !== undefined 
              ? profilePhoto.hasWhatsApp 
              : tel.HAS_WHATSAPP;
            const whatsappVerified = profilePhoto !== undefined || tel.WHATSAPP_VERIFIED;
            
            const copiarNumero = () => {
              navigator.clipboard.writeText(numeroLimpo);
              // Toast notification
              const toast = document.createElement('div');
              toast.className = 'fixed top-8 right-8 bg-green-500/90 text-white px-6 py-3 rounded-xl font-bold shadow-2xl z-50 animate-fade-in';
              toast.textContent = `📋 Copiado: ${numeroLimpo}`;
              document.body.appendChild(toast);
              setTimeout(() => toast.remove(), 2000);
            };
            
            return (
              <div 
                key={i} 
                className={`flex items-center justify-between p-3 rounded-lg transition-all ${
                  hasWhatsApp 
                    ? 'bg-green-500/20 border-2 border-green-500/50' 
                    : whatsappVerified 
                    ? 'bg-red-500/10 border-2 border-red-500/30' 
                    : 'bg-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  {isLoadingPhone ? (
                    <div className="w-12 h-12 flex items-center justify-center">
                      <FaSpinner className="text-3xl text-green-400 animate-spin" />
                    </div>
                  ) : profilePhoto?.url ? (
                    <div 
                      className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-green-400 shadow-lg cursor-pointer hover:scale-110 transition-transform"
                      onClick={() => setSelectedPhotoModal({ 
                        url: profilePhoto.url!, 
                        name: profilePhoto.name,
                        phone: numeroLimpo
                      })}
                      title="Clique para ampliar"
                    >
                      <img 
                        src={profilePhoto.url} 
                        alt={`Foto de ${profilePhoto.name}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : hasWhatsApp ? (
                    <FaWhatsapp className="text-3xl text-green-400 animate-pulse" />
                  ) : whatsappVerified ? (
                    <span className="text-3xl">❌</span>
                  ) : null}
                  <div>
                    <p>
                      <strong>Tel {i + 1}:</strong> ({tel.DDD}) {tel.TELEFONE}
                    </p>
                    {isLoadingPhone && (
                      <p className="text-xs text-yellow-300 animate-pulse">
                        🔄 Consultando...
                      </p>
                    )}
                    {profilePhoto?.url && !isLoadingPhone && (
                      <p className="text-xs text-green-300">
                        ✓ Foto carregada - clique para ampliar
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <button
                    onClick={copiarNumero}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg font-bold text-sm transition-all flex items-center gap-2"
                    title={`Copiar ${numeroLimpo}`}
                  >
                    📋 Copiar
                  </button>
                  
                  {whatsappVerified && (
                    <div className="flex flex-col items-end gap-1">
                      <span className={`flex items-center gap-2 px-3 py-1 rounded-lg text-sm font-bold ${
                        hasWhatsApp 
                          ? 'bg-green-500/30 text-green-300' 
                          : 'bg-red-500/30 text-red-300'
                      }`}>
                        <FaWhatsapp className="text-lg" />
                        {hasWhatsApp ? 'Tem WhatsApp' : 'Sem WhatsApp'}
                      </span>
                      <span className="text-xs text-white/50">
                        via {profilePhoto ? 'Consulta' : tel.VERIFIED_BY || 'Sistema'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {emails.map((email: any, i: number) => (
            <p key={i}>
              <FaEnvelope className="inline mr-2" />
              {email.EMAIL}
            </p>
          ))}
        </div>
      </div>
      
      {/* Endereços COMPLETOS */}
      {enderecos.length > 0 && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-6">
          <h4 className="text-2xl font-bold text-blue-300 mb-4 flex items-center gap-2">
            <FaMapMarkerAlt /> Endereços ({enderecos.length})
          </h4>
          <div className="space-y-4">
            {enderecos.map((end: any, i: number) => (
              <div key={i} className="bg-dark-800/50 p-4 rounded-lg border border-blue-500/20">
                <p className="font-bold text-blue-300 mb-3 text-lg">📍 Endereço {i + 1}</p>
                <div className="grid md:grid-cols-2 gap-3 text-white/80">
                  <div>
                    <p className="mb-2"><strong className="text-white">Logradouro:</strong> {end.LOGRADOURO || '-'}</p>
                    <p className="mb-2"><strong className="text-white">Número:</strong> {end.NUMERO || '-'}</p>
                    <p className="mb-2"><strong className="text-white">Complemento:</strong> {end.COMPLEMENTO || '-'}</p>
                    <p className="mb-2"><strong className="text-white">Bairro:</strong> {end.BAIRRO || '-'}</p>
                  </div>
                  <div>
                    <p className="mb-2"><strong className="text-white">Cidade:</strong> {end.CIDADE || '-'}</p>
                    <p className="mb-2"><strong className="text-white">UF:</strong> {end.UF || '-'}</p>
                    <p className="mb-2"><strong className="text-white">CEP:</strong> {end.CEP || '-'}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Sócios (QSA) */}
      {qsa.length > 0 && (
        <div className="md:col-span-2 bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
          <h4 className="text-xl font-bold text-yellow-300 mb-3 flex items-center gap-2">
            <FaUsers /> Quadro Societário ({qsa.length} sócios)
          </h4>
          <div className="space-y-2 text-white/80">
            {qsa.map((socio: any, i: number) => (
              <p key={i}>
                <strong>{socio.NOME}</strong> - {socio.QUALIFICACAO}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

