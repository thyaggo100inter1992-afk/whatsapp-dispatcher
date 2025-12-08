import React, { useState, useEffect } from 'react';
import {
  FaSearch, FaPlus, FaFilter, FaDownload, FaFileExcel,
  FaFileCsv, FaTrash, FaEdit, FaWhatsapp, FaUser,
  FaPhone, FaEnvelope, FaMapMarkerAlt, FaUpload, FaCopy, FaSpinner
} from 'react-icons/fa';
import api from '@/services/api';
import * as XLSX from 'xlsx';

interface Registro {
  id: number;
  tipo_origem: string;
  tipo_documento: string;
  documento: string;
  nome: string;
  nome_mae?: string;
  telefones: any[];
  emails: any[];
  enderecos: any[];
  whatsapp_verificado: boolean;
  consultado_nova_vida?: boolean;
  data_adicao: string;
  observacoes?: string;
  tags?: string[];
}

interface Filtros {
  cpf_cnpj: string;
  nome: string;
  telefone: string;
  email: string;
  cidade: string;
  uf: string;
  whatsapp: 'todos' | 'sim' | 'nao';
  tipo_documento: 'todos' | 'CPF' | 'CNPJ';
  tipo_origem: 'todos' | 'consulta_unica' | 'consulta_massa' | 'manual' | 'importacao';
  data_inicio: string;
  data_fim: string;
}

export default function BaseDados() {
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [mostrarCadastro, setMostrarCadastro] = useState(false);
  const [mostrarImportacao, setMostrarImportacao] = useState(false);
  const [estadoSelecionados, setEstadoSelecionados] = useState<Set<number>>(new Set());
  
  // Dados do formulário de cadastro (SIMPLIFICADO)
  const [formCadastro, setFormCadastro] = useState({
    tipo_documento: 'CPF',
    documento: '',
    nome: '',
    telefones: [{ ddd: '', telefone: '' }]
  });
  
  const [salvandoCliente, setSalvandoCliente] = useState(false);
  const [mostrarConfirmacaoExcluirTudo, setMostrarConfirmacaoExcluirTudo] = useState(false);
  const [mostrarDadosCliente, setMostrarDadosCliente] = useState(false);
  const [clienteSelecionado, setClienteSelecionado] = useState<any>(null);
  const [consultandoCliente, setConsultandoCliente] = useState(false);
  const [modoEdicao, setModoEdicao] = useState(false);
  const [dadosEdicao, setDadosEdicao] = useState<any>(null);
  
  // Estado para notificações toast
  const [notifications, setNotifications] = useState<Array<{ id: number; message: string; type: 'success' | 'error' | 'info' | 'warning' }>>([]);
  
  // Função de notificação toast moderna
  const showNotification = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type }]);
    
    // Remover automaticamente após 5 segundos
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };
  
  // Busca rápida
  const [buscaRapida, setBuscaRapida] = useState('');
  const [buscandoRapido, setBuscandoRapido] = useState(false);
  const [resultadosBusca, setResultadosBusca] = useState<Registro[]>([]);
  const [mostrarResultadosBusca, setMostrarResultadosBusca] = useState(false);
  const [mostrarConfirmacaoCadastro, setMostrarConfirmacaoCadastro] = useState(false);
  const [termoBuscaNaoEncontrado, setTermoBuscaNaoEncontrado] = useState('');
  const [mostrarPedirCPF, setMostrarPedirCPF] = useState(false);
  const [cpfParaConsulta, setCpfParaConsulta] = useState('');
  const [consultandoNovaVida, setConsultandoNovaVida] = useState(false);
  
  // Estados para WhatsApp com fotos
  const [phonePhotos, setPhonePhotos] = useState<Map<string, { url: string | null; name: string; hasWhatsApp?: boolean }>>(new Map());
  const [loadingPhones, setLoadingPhones] = useState<Set<string>>(new Set());
  const [selectedPhotoModal, setSelectedPhotoModal] = useState<{ url: string; name: string; phone: string } | null>(null);
  const [verificandoWhatsApp, setVerificandoWhatsApp] = useState(false);
  
  // Função para copiar texto para clipboard
  const copiarTexto = async (texto: string, tipo: string = 'texto') => {
    try {
      await navigator.clipboard.writeText(texto);
      showNotification(`✅ ${tipo} copiado!`, 'success');
    } catch (error) {
      showNotification('❌ Erro ao copiar', 'error');
    }
  };

  // Cadastro via Consulta Nova Vida
  const handleCadastroViaConsulta = () => {
    setMostrarConfirmacaoCadastro(false);
    
    // Detecta se o termo é CPF/CNPJ (apenas números com 11 ou 14 dígitos)
    const apenasNumeros = termoBuscaNaoEncontrado.replace(/\D/g, '');
    const ehDocumento = apenasNumeros.length === 11 || apenasNumeros.length === 14;
    
    if (ehDocumento) {
      // Se já é CPF/CNPJ, consulta direto na Nova Vida
      consultarNovaVida(apenasNumeros);
    } else {
      // Se não é documento, pede CPF/CNPJ para consultar
      setMostrarPedirCPF(true);
      showNotification('📝 Digite o CPF/CNPJ', 'info');
    }
    
    setBuscaRapida('');
    setTermoBuscaNaoEncontrado('');
  };
  
  // Cadastro Manual
  const handleCadastroManual = () => {
    setMostrarConfirmacaoCadastro(false);
    
    // Detecta se o termo é CPF/CNPJ e preenche o formulário
    const apenasNumeros = termoBuscaNaoEncontrado.replace(/\D/g, '');
    const ehDocumento = apenasNumeros.length === 11 || apenasNumeros.length === 14;
    
    if (ehDocumento) {
      // Se é CPF/CNPJ, preenche o campo
      setFormCadastro({
        ...formCadastro,
        documento: apenasNumeros
      });
    } else {
      // Se não é documento, limpa o formulário
      setFormCadastro({
        tipo_documento: 'CPF',
        documento: '',
        nome: '',
        telefones: [{ ddd: '', telefone: '' }]
      });
    }
    
    setMostrarCadastro(true);
    showNotification('📝 Preencha os dados', 'info');
    setBuscaRapida('');
    setTermoBuscaNaoEncontrado('');
  };
  
  // Consultar Nova Vida após confirmar cadastro
  const consultarNovaVida = async (documento: string) => {
    setConsultandoNovaVida(true);
    try {
      showNotification('🔍 Consultando...', 'info');
      
      const response = await api.post('/novavida/consultar', {
        documento,
        verificarWhatsapp: true
      });
      
      if (response.data.success) {
        showNotification('✅ Dados encontrados e salvos!', 'success');
        
        // Recarrega a lista
        loadRegistros();
        loadEstatisticas();
        
        // Mostra os dados do cliente consultado
        if (response.data.dados) {
          setClienteSelecionado({
            ...response.data.dados,
            _isNovaVidaData: true
          });
          setMostrarDadosCliente(true);
        }
      } else {
        showNotification(`❌ ${response.data.erro || 'Erro ao consultar'}`, 'error');
      }
    } catch (error: any) {
      console.error('Erro ao consultar Nova Vida:', error);
      showNotification('❌ Erro ao consultar: ' + (error.response?.data?.message || error.message), 'error');
    } finally {
      setConsultandoNovaVida(false);
      setMostrarPedirCPF(false);
      setCpfParaConsulta('');
    }
  };
  
  // Confirmar CPF e consultar Nova Vida
  const handleConfirmarCPF = () => {
    const apenasNumeros = cpfParaConsulta.replace(/\D/g, '');
    
    if (apenasNumeros.length !== 11 && apenasNumeros.length !== 14) {
      showNotification('⚠️ Digite um CPF (11 dígitos) ou CNPJ (14 dígitos) válido', 'warning');
      return;
    }
    
    consultarNovaVida(apenasNumeros);
  };
  
  // Cancelar cadastro após busca não encontrada
  const handleCancelarCadastro = () => {
    setMostrarConfirmacaoCadastro(false);
    setTermoBuscaNaoEncontrado('');
    showNotification('❌ Cadastro cancelado', 'info');
  };

  // Busca rápida (Nome, CPF ou Telefone)
  const handleBuscaRapida = async () => {
    if (!buscaRapida.trim()) {
      showNotification('⚠️ Digite algo para buscar', 'warning');
      return;
    }

    setBuscandoRapido(true);
    try {
      const termoBusca = buscaRapida.trim();
      const apenasNumeros = termoBusca.replace(/\D/g, '');
      
      console.log('🔍 Busca rápida:', { termoBusca, apenasNumeros, tamanho: apenasNumeros.length });
      
      // Detecta se é número (CPF/Telefone) ou texto (Nome)
      // Se conseguiu extrair números, é uma busca numérica
      const ehNumero = apenasNumeros.length >= 4; // Mínimo 4 dígitos para busca numérica
      
      let resultados: Registro[] = [];
      
      if (ehNumero) {
        // Se é número, busca inteligente
        if (apenasNumeros.length === 11) {
          // 11 dígitos: Pode ser CPF OU Telefone - BUSCA NOS DOIS!
          try {
            console.log('📄 Buscando por CPF:', apenasNumeros);
            // Busca por CPF
            const respCpf = await api.get('/base-dados/buscar', {
              params: { cpf_cnpj: apenasNumeros }
            });
            resultados = respCpf.data.registros || [];
            console.log('📄 Resultados CPF:', resultados.length);
            
            // Se não encontrou por CPF, busca por telefone
            if (resultados.length === 0) {
              console.log('📱 Buscando por Telefone:', apenasNumeros);
              const respTel = await api.get('/base-dados/buscar', {
                params: { telefone: apenasNumeros }
              });
              resultados = respTel.data.registros || [];
              console.log('📱 Resultados Telefone:', resultados.length);
            }
          } catch (error) {
            console.error('Erro na busca dupla:', error);
          }
        } else if (apenasNumeros.length <= 10) {
          // Até 10 dígitos: Telefone (parcial ou completo sem DDD)
          console.log('📱 Buscando telefone parcial:', apenasNumeros);
          const response = await api.get('/base-dados/buscar', {
            params: { telefone: apenasNumeros }
          });
          resultados = response.data.registros || [];
          console.log('📱 Resultados:', resultados.length);
        } else {
          // 12+ dígitos: CPF/CNPJ
          console.log('📄 Buscando CPF/CNPJ:', apenasNumeros);
          const response = await api.get('/base-dados/buscar', {
            params: { cpf_cnpj: apenasNumeros }
          });
          resultados = response.data.registros || [];
          console.log('📄 Resultados:', resultados.length);
        }
      } else {
        // Se tem letras, busca por nome
        console.log('👤 Buscando por nome:', termoBusca);
        const response = await api.get('/base-dados/buscar', {
          params: { nome: termoBusca }
        });
        resultados = response.data.registros || [];
        console.log('👤 Resultados:', resultados.length);
      }
      
      if (resultados.length === 0) {
        // Nenhum cadastro encontrado - Pergunta se deseja cadastrar
        setTermoBuscaNaoEncontrado(termoBusca);
        setMostrarConfirmacaoCadastro(true);
        setResultadosBusca([]);
      } else if (resultados.length === 1) {
        // Se encontrou apenas 1, abre automaticamente
        showNotification('✅ Cadastro encontrado!', 'success');
        handleConsultarCliente(resultados[0]);
      } else {
        // Se encontrou vários, mostra lista para escolher
        showNotification(`✅ ${resultados.length} cadastros encontrados`, 'info');
        setResultadosBusca(resultados);
        setMostrarResultadosBusca(true);
      }
      
    } catch (error: any) {
      console.error('Erro na busca rápida:', error);
      showNotification('❌ Erro ao buscar: ' + (error.response?.data?.message || error.message), 'error');
    } finally {
      setBuscandoRapido(false);
    }
  };
  
  // Arquivo de importação
  const [arquivoImportacao, setArquivoImportacao] = useState<File | null>(null);
  
  const [filtros, setFiltros] = useState<Filtros>({
    cpf_cnpj: '',
    nome: '',
    telefone: '',
    email: '',
    cidade: '',
    uf: '',
    whatsapp: 'todos',
    tipo_documento: 'todos',
    tipo_origem: 'todos',
    data_inicio: '',
    data_fim: ''
  });

  const [estatisticas, setEstatisticas] = useState<any>(null);

  // Carregar estatísticas
  const loadEstatisticas = async () => {
    try {
      const response = await api.get('/base-dados/estatisticas');
      setEstatisticas(response.data.estatisticas);
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    }
  };

  // Carregar registros
  const loadRegistros = async (resetOffset = false) => {
    setLoading(true);
    try {
      const currentOffset = resetOffset ? 0 : offset;
      
      const response = await api.get('/base-dados/buscar', {
        params: {
          ...filtros,
          limit: 50,
          offset: currentOffset
        }
      });

      setRegistros(response.data.registros);
      setTotal(response.data.total);
      if (resetOffset) setOffset(0);
      
    } catch (error) {
      console.error('Erro ao carregar registros:', error);
    } finally {
      setLoading(false);
    }
  };

  // Aplicar filtros
  const handleAplicarFiltros = () => {
    loadRegistros(true);
    setMostrarFiltros(false);
  };

  // Limpar filtros
  const handleLimparFiltros = () => {
    setFiltros({
      cpf_cnpj: '',
      nome: '',
      telefone: '',
      email: '',
      cidade: '',
      uf: '',
      whatsapp: 'todos',
      tipo_documento: 'todos',
      tipo_origem: 'todos',
      data_inicio: '',
      data_fim: ''
    });
    loadRegistros(true);
  };

  // Cadastrar manualmente COM verificação automática de WhatsApp
  const handleCadastrar = async () => {
    setSalvandoCliente(true);
    
    try {
      const response = await api.post('/base-dados/adicionar', {
        ...formCadastro,
        emails: [],
        enderecos: [],
        observacoes: 'Cadastro manual',
        tags: []
      });
      
      // Notificação de sucesso com info de WhatsApp
      showNotification('✅ Cliente cadastrado com sucesso!', 'success');
      
      if (response.data.whatsapp_verificado) {
        showNotification(`📱 WhatsApp verificado automaticamente`, 'success');
        showNotification(`✅ ${response.data.telefones_com_whatsapp} de ${response.data.total_telefones} telefone(s) com WhatsApp`, 'info');
      } else if (response.data.total_telefones > 0) {
        showNotification('⚠️ Nenhuma instância disponível para verificar WhatsApp', 'warning');
      }
      
      setMostrarCadastro(false);
      // Limpar formulário
      setFormCadastro({
        tipo_documento: 'CPF',
        documento: '',
        nome: '',
        telefones: [{ ddd: '', telefone: '' }]
      });
      loadRegistros();
      loadEstatisticas();
    } catch (error: any) {
      console.error('Erro ao cadastrar:', error);
      showNotification('❌ Erro ao cadastrar: ' + (error.response?.data?.message || error.message), 'error');
    } finally {
      setSalvandoCliente(false);
    }
  };
  
  // Adicionar novo telefone
  const adicionarTelefone = () => {
    setFormCadastro({
      ...formCadastro,
      telefones: [...formCadastro.telefones, { ddd: '', telefone: '' }]
    });
  };
  
  // Remover telefone
  const removerTelefone = (index: number) => {
    const novosTelefones = formCadastro.telefones.filter((_, i) => i !== index);
    setFormCadastro({
      ...formCadastro,
      telefones: novosTelefones.length > 0 ? novosTelefones : [{ ddd: '', telefone: '' }]
    });
  };
  
  // Atualizar telefone
  const atualizarTelefone = (index: number, campo: 'ddd' | 'telefone', valor: string) => {
    const novosTelefones = [...formCadastro.telefones];
    novosTelefones[index] = { ...novosTelefones[index], [campo]: valor.replace(/\D/g, '') };
    setFormCadastro({ ...formCadastro, telefones: novosTelefones });
  };

  // Excluir registros selecionados
  const handleExcluirSelecionados = async () => {
    if (estadoSelecionados.size === 0) return;
    
    const confirmacao = window.confirm(
      `⚠️ Tem certeza que deseja excluir ${estadoSelecionados.size} registro(s)?\n\nEsta ação não pode ser desfeita!`
    );
    
    if (!confirmacao) return;
    
    try {
      const ids = Array.from(estadoSelecionados);
      const response = await api.post('/base-dados/excluir-lote', { ids });
      
      showNotification(`✅ ${response.data.excluidos} registro(s) excluído(s) com sucesso!`, 'success');
      
      setEstadoSelecionados(new Set());
      loadRegistros();
      loadEstatisticas();
    } catch (error: any) {
      console.error('Erro ao excluir:', error);
      showNotification('❌ Erro ao excluir registros: ' + (error.response?.data?.message || error.message), 'error');
    }
  };

  // Excluir TODA a base
  const handleExcluirTudo = async () => {
    try {
      const response = await api.delete('/base-dados/excluir-tudo', {
        data: { confirmacao: 'EXCLUIR_TUDO' }
      });
      
      showNotification(`✅ ${response.data.message}`, 'success');
      
      setMostrarConfirmacaoExcluirTudo(false);
      setEstadoSelecionados(new Set());
      loadRegistros();
      loadEstatisticas();
    } catch (error: any) {
      console.error('Erro ao excluir base:', error);
      showNotification('❌ Erro ao excluir base: ' + (error.response?.data?.message || error.message), 'error');
    }
  };

  // Mostrar dados do cliente já cadastrado (SEM consultar Nova Vida)
  const handleConsultarCliente = (registro: Registro) => {
    setClienteSelecionado(registro);
    setMostrarDadosCliente(true);
  };

  // Nova consulta na API Nova Vida (atualiza dados)
  const handleNovaConsulta = async (documento: string) => {
    setConsultandoCliente(true);
    setMostrarDadosCliente(true);
    setClienteSelecionado(null);
    
    try {
      const response = await api.post('/novavida/consultar', {
        documento,
        verificarWhatsapp: true
      });
      
      if (response.data.success) {
        setClienteSelecionado({
          ...response.data.dados,
          _isNovaVidaData: true // Flag para identificar dados da Nova Vida
        });
        showNotification('✅ Dados consultados e atualizados com sucesso!', 'success');
        // Recarregar para atualizar dados
        loadRegistros();
        loadEstatisticas();
      } else {
        showNotification('❌ Erro: ' + response.data.erro, 'error');
        setMostrarDadosCliente(false);
      }
    } catch (error: any) {
      console.error('Erro ao consultar:', error);
      
      // Extrair mensagem de erro do backend (message ou error)
      let errorMessage = 'Erro ao consultar';
      
      if (error.response?.data) {
        errorMessage = error.response.data.message || error.response.data.error || error.message;
        
        // Se é erro de limite/crédito, mostrar mensagem mais clara
        if (error.response.status === 403 && errorMessage.includes('Limite')) {
          showNotification(`❌ ${errorMessage}\n\n⚠️ Entre em contato com o administrador para adicionar consultas avulsas.`, 'error');
        } else if (error.response.data.bloqueado) {
          showNotification('🚫 CPF está na Lista de Restrição. Consulta bloqueada.', 'error');
        } else {
          showNotification(`❌ ${errorMessage}`, 'error');
        }
      } else {
        showNotification(`❌ ${error.message}`, 'error');
      }
      
      setMostrarDadosCliente(false);
    } finally {
      setConsultandoCliente(false);
    }
  };

  // Verificar WhatsApp dos telefones de um cliente
  const handleVerificarWhatsApp = async () => {
    setVerificandoWhatsApp(true);
    
    try {
      // Buscar instâncias ativas
      const instancesResponse = await api.get('/uaz/instances');
      console.log('📡 Resposta das instâncias:', instancesResponse.data);
      
      let instances = [];
      if (instancesResponse.data.success && instancesResponse.data.data) {
        instances = instancesResponse.data.data;
      } else if (Array.isArray(instancesResponse.data)) {
        instances = instancesResponse.data;
      } else if (instancesResponse.data.instances) {
        instances = instancesResponse.data.instances;
      }
      
      // 🔄 ROTATIVIDADE: Filtrar todas as instâncias conectadas
      const activeInstances = instances.filter((inst: any) => 
        inst.is_active && inst.status === 'connected'
      );
      
      if (activeInstances.length === 0) {
        showNotification('❌ Nenhuma instância ativa e conectada encontrada', 'error');
        setVerificandoWhatsApp(false);
        return;
      }
      
      console.log(`✅ ${activeInstances.length} instância(s) conectada(s) para rotação:`, activeInstances.map((i: any) => i.name).join(', '));
      
      // Pegar todos os telefones do cliente
      const telefones = (clienteSelecionado.TELEFONES || clienteSelecionado.telefones || []);
      
      if (telefones.length === 0) {
        showNotification('⚠️ Nenhum telefone encontrado', 'info');
        setVerificandoWhatsApp(false);
        return;
      }
      
      console.log(`🔍 Consultando ${telefones.length} telefone(s)...`);
      
      // Notificação inicial automática
      showNotification(`🔍 Verificando ${telefones.length} número${telefones.length > 1 ? 's' : ''} usando ${activeInstances.length} instância(s)...`, 'info');
      
      let fotosEncontradas = 0;
      let comWhatsApp = 0;
      let semWhatsApp = 0;
      let instanceIndex = 0; // 🔄 Índice para rotação
      
      // Iterar pelos telefones
      for (let i = 0; i < telefones.length; i++) {
        const tel = telefones[i];
        const ddd = tel.DDD || tel.ddd || '';
        const telefone = tel.TELEFONE || tel.telefone || '';
        const numeroLimpo = `55${ddd}${telefone}`;
        const numeroFormatado = `(${ddd}) ${telefone}`;
        
        if (!ddd || !telefone) continue;
        
        // 🔄 ROTATIVIDADE: Selecionar próxima instância (round-robin)
        const selectedInstance = activeInstances[instanceIndex % activeInstances.length];
        instanceIndex++;
        
        // Marcar como loading
        setLoadingPhones(prev => {
          const newSet = new Set(prev);
          newSet.add(numeroLimpo);
          return newSet;
        });
        
        try {
          console.log(`📞 [${selectedInstance.name}] Consultando ${i + 1}/${telefones.length}: ${numeroFormatado}`);
          
          const response = await api.post('/uaz/contact/details', {
            instance_id: selectedInstance.id,
            phone_number: numeroLimpo,
            preview: false
          });
          
          console.log(`📊 [${numeroFormatado}] Resposta completa da API:`, response.data);
          console.log(`📊 [${numeroFormatado}] response.data.contact:`, response.data.contact);
          console.log(`📊 [${numeroFormatado}] response.data.contact?.profilePicUrl:`, response.data.contact?.profilePicUrl);
          
          let photoUrl = response.data.contact?.profilePicUrl || 
                          response.data.contact?.image || 
                          response.data.profilePicUrl ||
                          response.data.contact?.imageUrl;

          console.log(`📸 [${numeroFormatado}] photoUrl ANTES da transformação:`, photoUrl);

          // Se a foto for uma URL relativa, construir URL completa do BACKEND
          if (photoUrl && (photoUrl.startsWith('/uploads/') || photoUrl.startsWith('/api/'))) {
            // Usar a URL do backend (onde as fotos estão salvas)
            const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/api$/, '') || 'https://api.sistemasnettsistemas.com.br';
            photoUrl = `${API_BASE}${photoUrl}`;
            console.log(`🖼️ [${numeroFormatado}] URL completa da foto:`, photoUrl);
          }
          
          const hasWhatsApp = response.data.contact?.hasWhatsApp ?? false;
          
          console.log(`📸 [${numeroFormatado}] Foto FINAL extraída:`, photoUrl || 'Sem foto');
          console.log(`📱 [${numeroFormatado}] Tem WhatsApp:`, hasWhatsApp);
          
          if (hasWhatsApp) {
            comWhatsApp++;
          } else {
            semWhatsApp++;
          }
          
          if (response.data.success) {
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
              console.log(`✅ Foto encontrada para ${numeroFormatado}`);
            } else {
              console.log(`⚠️ Sem foto para ${numeroFormatado}`);
            }
          }
        } catch (error: any) {
          console.error(`❌ Erro ao consultar ${numeroFormatado}:`, error);
        } finally {
          // Remove do loading
          setLoadingPhones(prev => {
            const newSet = new Set(prev);
            newSet.delete(numeroLimpo);
            return newSet;
          });
        }
        
        // Delay de 2 segundos entre consultas
        if (i < telefones.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      console.log(`✅ Consulta concluída! ${fotosEncontradas} foto(s) encontrada(s)`);
      console.log(`   ├─ Com WhatsApp: ${comWhatsApp}`);
      console.log(`   └─ Sem WhatsApp: ${semWhatsApp}`);
      
      showNotification(`✅ Verificação concluída! ${comWhatsApp} com WhatsApp`, 'success');
      
    } catch (error: any) {
      console.error('Erro ao verificar WhatsApp:', error);
      showNotification('❌ Erro ao verificar WhatsApp', 'error');
    } finally {
      setVerificandoWhatsApp(false);
    }
  };

  // Iniciar edição de dados
  const handleIniciarEdicao = () => {
    // Extrair telefones
    const telefonesAtuais = clienteSelecionado.telefones || clienteSelecionado.TELEFONES || [];
    const telefonesMapeados = telefonesAtuais.map((tel: any) => ({
      ddd: tel.DDD || tel.ddd || '',
      telefone: tel.TELEFONE || tel.telefone || '',
      operadora: tel.OPERADORA || tel.operadora || '',
      has_whatsapp: tel.HAS_WHATSAPP || tel.has_whatsapp || false
    }));

    // Extrair e-mails
    const emailsAtuais = clienteSelecionado.emails || clienteSelecionado.EMAILS || [];
    const emailsMapeados = emailsAtuais.map((email: any) => ({
      email: email.EMAIL || email.email || ''
    }));

    // Extrair endereços
    const enderecosAtuais = clienteSelecionado.enderecos || clienteSelecionado.ENDERECOS || [];
    const enderecosMapeados = enderecosAtuais.map((end: any) => ({
      logradouro: end.LOGRADOURO || end.logradouro || '',
      numero: end.NUMERO || end.numero || '',
      complemento: end.COMPLEMENTO || end.complemento || '',
      bairro: end.BAIRRO || end.bairro || '',
      cidade: end.CIDADE || end.cidade || '',
      uf: end.UF || end.uf || '',
      cep: end.CEP || end.cep || ''
    }));

    setDadosEdicao({
      id: clienteSelecionado.id,
      nome: clienteSelecionado.nome || clienteSelecionado.CADASTRAIS?.NOME || '',
      nome_mae: clienteSelecionado.nome_mae || clienteSelecionado.CADASTRAIS?.MAE || '',
      sexo: clienteSelecionado.sexo || clienteSelecionado.CADASTRAIS?.SEXO || '',
      data_nascimento: clienteSelecionado.data_nascimento || clienteSelecionado.CADASTRAIS?.NASC || '',
      telefones: telefonesMapeados.length > 0 ? telefonesMapeados : [{ ddd: '', telefone: '', operadora: '', has_whatsapp: false }],
      emails: emailsMapeados.length > 0 ? emailsMapeados : [{ email: '' }],
      enderecos: enderecosMapeados.length > 0 ? enderecosMapeados : [{ logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '', cep: '' }],
      observacoes: clienteSelecionado.observacoes || ''
    });
    setModoEdicao(true);
  };

  // Cancelar edição
  const handleCancelarEdicao = () => {
    setModoEdicao(false);
    setDadosEdicao(null);
  };

  // Salvar edição
  const handleSalvarEdicao = async () => {
    try {
      await api.put(`/base-dados/${dadosEdicao.id}`, dadosEdicao);
      
      showNotification('✅ Dados atualizados com sucesso!', 'success');
      setModoEdicao(false);
      setDadosEdicao(null);
      setMostrarDadosCliente(false);
      loadRegistros();
      loadEstatisticas();
    } catch (error: any) {
      console.error('Erro ao atualizar:', error);
      showNotification('❌ Erro ao atualizar: ' + (error.response?.data?.message || error.message), 'error');
    }
  };

  // Funções para gerenciar telefones na edição
  const adicionarTelefoneEdicao = () => {
    setDadosEdicao({
      ...dadosEdicao,
      telefones: [...dadosEdicao.telefones, { ddd: '', telefone: '', operadora: '', has_whatsapp: false }]
    });
  };

  const removerTelefoneEdicao = (index: number) => {
    const novosTelefones = dadosEdicao.telefones.filter((_: any, i: number) => i !== index);
    setDadosEdicao({ ...dadosEdicao, telefones: novosTelefones });
  };

  const atualizarTelefoneEdicao = (index: number, campo: string, valor: any) => {
    const novosTelefones = [...dadosEdicao.telefones];
    novosTelefones[index] = { ...novosTelefones[index], [campo]: valor };
    setDadosEdicao({ ...dadosEdicao, telefones: novosTelefones });
  };

  // Funções para gerenciar e-mails na edição
  const adicionarEmailEdicao = () => {
    setDadosEdicao({
      ...dadosEdicao,
      emails: [...dadosEdicao.emails, { email: '' }]
    });
  };

  const removerEmailEdicao = (index: number) => {
    const novosEmails = dadosEdicao.emails.filter((_: any, i: number) => i !== index);
    setDadosEdicao({ ...dadosEdicao, emails: novosEmails });
  };

  const atualizarEmailEdicao = (index: number, valor: string) => {
    const novosEmails = [...dadosEdicao.emails];
    novosEmails[index] = { email: valor };
    setDadosEdicao({ ...dadosEdicao, emails: novosEmails });
  };

  // Funções para gerenciar endereços na edição
  const adicionarEnderecoEdicao = () => {
    setDadosEdicao({
      ...dadosEdicao,
      enderecos: [...dadosEdicao.enderecos, {
        logradouro: '', numero: '', complemento: '',
        bairro: '', cidade: '', uf: '', cep: ''
      }]
    });
  };

  const removerEnderecoEdicao = (index: number) => {
    const novosEnderecos = dadosEdicao.enderecos.filter((_: any, i: number) => i !== index);
    setDadosEdicao({ ...dadosEdicao, enderecos: novosEnderecos });
  };

  const atualizarEnderecoEdicao = (index: number, campo: string, valor: string) => {
    const novosEnderecos = [...dadosEdicao.enderecos];
    novosEnderecos[index] = { ...novosEnderecos[index], [campo]: valor };
    setDadosEdicao({ ...dadosEdicao, enderecos: novosEnderecos });
  };

  // Importar arquivo
  const handleImportar = async () => {
    if (!arquivoImportacao) {
      showNotification('⚠️ Selecione um arquivo para importar', 'warning');
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet);

        // Validar limite de 100 mil registros
        if (json.length > 100000) {
          showNotification('❌ Arquivo excede o limite de 100.000 registros!', 'error');
          showNotification(`📊 Seu arquivo tem ${json.length.toLocaleString()} registros`, 'warning');
          showNotification('💡 Divida em arquivos menores', 'info');
          return;
        }

        // Mapear dados do Excel para formato da API
        const dados = json.map((row: any) => {
          // Processar telefones de múltiplas colunas (TELEFONE1, TELEFONE2, TELEFONE3, etc)
          const telefonesArray: any[] = [];
          
          // Função para processar um telefone
          const processarTelefone = (tel: string) => {
            if (!tel) return null;
            
            const apenasNumeros = String(tel).replace(/\D/g, '');
            
            if (apenasNumeros.length >= 10) {
              let ddd = '';
              let numero = '';
              
              // Detectar formato: com ou sem 55
              if (apenasNumeros.length === 13 && apenasNumeros.startsWith('55')) {
                // 5562994396869 (13 dígitos com 55)
                ddd = apenasNumeros.substring(2, 4);
                numero = apenasNumeros.substring(4);
              } else if (apenasNumeros.length === 12 && apenasNumeros.startsWith('55')) {
                // 556294396869 (12 dígitos com 55, sem 9)
                ddd = apenasNumeros.substring(2, 4);
                numero = apenasNumeros.substring(4);
              } else if (apenasNumeros.length === 11) {
                // 62994396869 (11 dígitos)
                ddd = apenasNumeros.substring(0, 2);
                numero = apenasNumeros.substring(2);
              } else if (apenasNumeros.length === 10) {
                // 6294396869 (10 dígitos, sem 9)
                ddd = apenasNumeros.substring(0, 2);
                numero = apenasNumeros.substring(2);
              }
              
              if (ddd && numero) {
                return { ddd, telefone: numero };
              }
            }
            return null;
          };
          
          // Buscar por colunas TELEFONE1, TELEFONE2, TELEFONE3, ... até TELEFONE10
          for (let i = 1; i <= 10; i++) {
            const coluna = `TELEFONE${i}`;
            const telefone = row[coluna] || row[coluna.toLowerCase()] || row[`Telefone${i}`];
            
            if (telefone) {
              const telProcessado = processarTelefone(telefone);
              if (telProcessado) {
                telefonesArray.push(telProcessado);
              }
            }
          }
          
          // Também aceitar coluna única "TELEFONE" com vírgulas (retrocompatibilidade)
          const telefoneUnico = row['TELEFONE'] || row['Telefone'] || row['TELEFONES'] || row['Telefones'] || '';
          if (telefoneUnico && telefoneUnico.includes(',')) {
            const telefonesSeparados = String(telefoneUnico).split(/[,;\n]/).map(t => t.trim()).filter(t => t);
            telefonesSeparados.forEach((tel: string) => {
              const telProcessado = processarTelefone(tel);
              if (telProcessado) {
                telefonesArray.push(telProcessado);
              }
            });
          } else if (telefoneUnico && telefonesArray.length === 0) {
            // Se não tem TELEFONE1, TELEFONE2, etc, usa TELEFONE único
            const telProcessado = processarTelefone(telefoneUnico);
            if (telProcessado) {
              telefonesArray.push(telProcessado);
            }
          }

          return {
            tipo_documento: row['TIPO'] || row['Tipo'] || 'CPF',
            documento: String(row['CPF'] || row['CNPJ'] || row['CPF/CNPJ'] || row['Documento'] || '').replace(/\D/g, ''),
            nome: row['NOME'] || row['Nome'] || '',
            telefones: telefonesArray,
            emails: [],
            enderecos: [],
            observacoes: 'Importado via arquivo'
          };
        });

        showNotification('⏳ Processando importação...', 'info');
        
        const response = await api.post('/base-dados/importar', { dados });
        
        showNotification('✅ Importação concluída!', 'success');
        showNotification(`📊 Importados: ${response.data.importados} | Atualizados: ${response.data.atualizados}`, 'info');
        
        if (response.data.erros?.length > 0) {
          showNotification(`⚠️ Erros: ${response.data.erros.length}`, 'warning');
        }

        setMostrarImportacao(false);
        setArquivoImportacao(null);
        loadRegistros();
        loadEstatisticas();
      };
      reader.readAsBinaryString(arquivoImportacao);
    } catch (error) {
      console.error('Erro ao importar:', error);
      showNotification('❌ Erro ao importar arquivo', 'error');
    }
  };

  // Baixar modelo Excel para importação
  const handleBaixarModelo = () => {
    try {
      // Criar dados do modelo com colunas separadas para telefones
      const modeloData = [
        {
          'TIPO': 'CPF',
          'CPF/CNPJ': '12345678901',
          'NOME': 'João da Silva',
          'TELEFONE1': '62994396869',
          'TELEFONE2': '',
          'TELEFONE3': ''
        },
        {
          'TIPO': 'CNPJ',
          'CPF/CNPJ': '12345678000190',
          'NOME': 'Empresa XYZ LTDA',
          'TELEFONE1': '62995786988',
          'TELEFONE2': '62999887766',
          'TELEFONE3': ''
        },
        {
          'TIPO': 'CPF',
          'CPF/CNPJ': '98765432100',
          'NOME': 'Maria Oliveira',
          'TELEFONE1': '11987654321',
          'TELEFONE2': '11976543210',
          'TELEFONE3': '11965432109'
        }
      ];

      // Criar workbook
      const ws = XLSX.utils.json_to_sheet(modeloData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Modelo');

      // Ajustar largura das colunas
      ws['!cols'] = [
        { wch: 10 },  // TIPO
        { wch: 20 },  // CPF/CNPJ
        { wch: 40 },  // NOME
        { wch: 18 },  // TELEFONE1
        { wch: 18 },  // TELEFONE2
        { wch: 18 }   // TELEFONE3
      ];

      // Baixar arquivo
      XLSX.writeFile(wb, 'modelo-importacao-base-dados.xlsx');
      showNotification('✅ Modelo baixado com sucesso!', 'success');
    } catch (error) {
      console.error('Erro ao gerar modelo:', error);
      showNotification('❌ Erro ao baixar modelo', 'error');
    }
  };

  // Exportar selecionados
  const handleExportar = async (formato: 'excel' | 'csv') => {
    try {
      const ids = Array.from(estadoSelecionados);
      const response = await api.post('/base-dados/exportar', { ids });

      const dados = response.data.registros;

      if (formato === 'excel') {
        exportarExcel(dados);
      } else {
        exportarCSV(dados);
      }
    } catch (error) {
      console.error('Erro ao exportar:', error);
    }
  };

  const exportarExcel = (dados: any[]) => {
    const linhas = dados.map(reg => {
      const telefones = reg.telefones || [];
      const emails = reg.emails || [];
      const enderecos = reg.enderecos || [];

      return {
        'CPF/CNPJ': reg.documento,
        'Tipo': reg.tipo_documento,
        'Nome': reg.nome,
        'Nome Mãe': reg.nome_mae || '',
        'Telefone 1': telefones[0] ? `55${telefones[0].ddd}${telefones[0].telefone}` : '',
        'Telefone 1 - WhatsApp': telefones[0]?.has_whatsapp ? 'Sim' : 'Não',
        'Telefone 2': telefones[1] ? `55${telefones[1].ddd}${telefones[1].telefone}` : '',
        'Telefone 2 - WhatsApp': telefones[1]?.has_whatsapp ? 'Sim' : 'Não',
        'Email 1': emails[0]?.email || '',
        'Email 2': emails[1]?.email || '',
        'Endereço': enderecos[0] ? `${enderecos[0].logradouro}, ${enderecos[0].numero} - ${enderecos[0].cidade}/${enderecos[0].uf}` : '',
        'Origem': reg.tipo_origem,
        'Data Adição': new Date(reg.data_adicao).toLocaleString('pt-BR'),
        'Observações': reg.observacoes || ''
      };
    });

    const ws = XLSX.utils.json_to_sheet(linhas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Base de Dados');
    XLSX.writeFile(wb, `base-dados-${Date.now()}.xlsx`);
  };

  const exportarCSV = (dados: any[]) => {
    // Similar ao Excel mas em CSV
    const linhas = dados.map(reg => {
      const telefones = reg.telefones || [];
      const emails = reg.emails || [];
      const enderecos = reg.enderecos || [];

      return [
        reg.documento,
        reg.tipo_documento,
        reg.nome,
        reg.nome_mae || '',
        telefones[0] ? `55${telefones[0].ddd}${telefones[0].telefone}` : '',
        telefones[0]?.has_whatsapp ? 'Sim' : 'Não',
        telefones[1] ? `55${telefones[1].ddd}${telefones[1].telefone}` : '',
        telefones[1]?.has_whatsapp ? 'Sim' : 'Não',
        emails[0]?.email || '',
        emails[1]?.email || '',
        enderecos[0] ? `${enderecos[0].logradouro}, ${enderecos[0].numero} - ${enderecos[0].cidade}/${enderecos[0].uf}` : '',
        reg.tipo_origem,
        new Date(reg.data_adicao).toLocaleString('pt-BR'),
        reg.observacoes || ''
      ];
    });

    const headers = [
      'CPF/CNPJ', 'Tipo', 'Nome', 'Nome Mãe',
      'Telefone 1', 'Telefone 1 - WhatsApp',
      'Telefone 2', 'Telefone 2 - WhatsApp',
      'Email 1', 'Email 2', 'Endereço', 'Origem',
      'Data Adição', 'Observações'
    ];

    const csvContent = [
      headers.join(','),
      ...linhas.map(linha => linha.map(campo => `"${campo}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `base-dados-${Date.now()}.csv`;
    link.click();
  };

  // Excluir registros duplicados (mantém apenas o mais recente de cada CPF/CNPJ)
  const handleExcluirDuplicadas = async () => {
    if (!confirm('⚠️ ATENÇÃO!\n\nEsta ação irá:\n\n1. Identificar todos os CPF/CNPJ duplicados\n2. Manter apenas o registro MAIS RECENTE de cada documento\n3. EXCLUIR permanentemente os registros mais antigos\n\nEsta ação NÃO PODE SER DESFEITA!\n\nDeseja continuar?')) {
      return;
    }

    try {
      setLoading(true);
      showNotification('🔄 Identificando duplicadas...', 'info');
      
      const response = await api.delete('/base-dados/duplicadas');
      
      if (response.data.success) {
        showNotification(
          `✅ ${response.data.excluidos} registro(s) duplicado(s) excluído(s)!\n` +
          `📊 ${response.data.mantidos} registro(s) mantido(s) (mais recentes)\n` +
          `🎯 ${response.data.documentos_processados} documento(s) único(s) encontrado(s)`,
          'success'
        );
        await loadRegistros(true);
        await loadEstatisticas();
      }
    } catch (error: any) {
      console.error('Erro ao excluir duplicadas:', error);
      showNotification(error.response?.data?.error || 'Erro ao excluir registros duplicados', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRegistros();
    loadEstatisticas();
  }, []);

  return (
    <div className="space-y-6">
      {/* Busca Rápida */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-6 shadow-2xl">
        <h3 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
          🔍 Busca Rápida
        </h3>
        <p className="text-white/80 text-sm mb-4">
          Digite: <strong>Nome</strong>, <strong>CPF</strong> ou <strong>Telefone</strong> (tudo no mesmo campo)
        </p>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Ex: João Silva, 12345678900, 62991785664..."
            value={buscaRapida}
            onChange={(e) => setBuscaRapida(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleBuscaRapida();
              }
            }}
            className="flex-1 bg-white/10 backdrop-blur-sm border-2 border-white/30 rounded-xl px-6 py-4 text-white text-lg placeholder-white/50 focus:border-white focus:outline-none"
            disabled={buscandoRapido}
          />
          <button
            onClick={handleBuscaRapida}
            disabled={buscandoRapido}
            className="bg-white hover:bg-white/90 text-blue-600 px-8 py-4 rounded-xl font-bold text-lg transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {buscandoRapido ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                Buscando...
              </>
            ) : (
              <>
                <FaSearch /> Buscar
              </>
            )}
          </button>
        </div>
      </div>
      
      {/* Estatísticas */}
      {estatisticas && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-500/20 border border-blue-500/50 rounded-xl p-4">
            <p className="text-blue-300 text-sm font-bold">Total de Registros</p>
            <p className="text-4xl font-black text-white">{estatisticas.total_registros}</p>
          </div>
          <div className="bg-green-500/20 border border-green-500/50 rounded-xl p-4">
            <p className="text-green-300 text-sm font-bold">Com WhatsApp</p>
            <p className="text-4xl font-black text-white">{estatisticas.total_com_whatsapp}</p>
          </div>
          <div className="bg-purple-500/20 border border-purple-500/50 rounded-xl p-4">
            <p className="text-purple-300 text-sm font-bold">CPF</p>
            <p className="text-4xl font-black text-white">{estatisticas.total_cpf}</p>
          </div>
          <div className="bg-orange-500/20 border border-orange-500/50 rounded-xl p-4">
            <p className="text-orange-300 text-sm font-bold">CNPJ</p>
            <p className="text-4xl font-black text-white">{estatisticas.total_cnpj}</p>
          </div>
        </div>
      )}

      {/* Barra de Ações */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => setMostrarFiltros(!mostrarFiltros)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2"
        >
          <FaFilter /> Filtros
        </button>
        
        <button
          onClick={() => setMostrarCadastro(true)}
          className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2"
        >
          <FaPlus /> Cadastrar
        </button>
        
        <button
          onClick={() => setMostrarImportacao(true)}
          className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2"
        >
          <FaUpload /> Importar
        </button>
        
        <button
          onClick={handleExcluirDuplicadas}
          className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2"
        >
          <FaTrash /> Excluir Duplicadas
        </button>
        
        {estadoSelecionados.size > 0 && (
          <>
            <button
              onClick={() => handleExportar('excel')}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2"
            >
              <FaFileExcel /> Excel ({estadoSelecionados.size})
            </button>
            
            <button
              onClick={() => handleExportar('csv')}
              className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2"
            >
              <FaFileCsv /> CSV ({estadoSelecionados.size})
            </button>
            
            <button
              onClick={handleExcluirSelecionados}
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2"
            >
              <FaTrash /> Excluir ({estadoSelecionados.size})
            </button>
          </>
        )}
        
        <div className="ml-auto flex gap-3">
          <button
            onClick={() => setMostrarConfirmacaoExcluirTudo(true)}
            className="bg-red-900 hover:bg-red-800 border-2 border-red-600 text-white px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2"
          >
            <FaTrash /> Excluir Tudo
          </button>
        </div>
      </div>

      {/* Painel de Filtros */}
      {mostrarFiltros && (
        <div className="bg-dark-700/50 border border-white/10 rounded-xl p-6">
          <h3 className="text-2xl font-bold text-white mb-4">🔍 Filtros Avançados</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <input
              type="text"
              placeholder="CPF/CNPJ (somente números)"
              value={filtros.cpf_cnpj}
              onChange={(e) => {
                const apenasNumeros = e.target.value.replace(/\D/g, '');
                setFiltros({...filtros, cpf_cnpj: apenasNumeros});
              }}
              className="bg-dark-600 border border-white/20 rounded-lg px-4 py-3 text-white"
              maxLength={14}
            />
            
            <input
              type="text"
              placeholder="Nome"
              value={filtros.nome}
              onChange={(e) => setFiltros({...filtros, nome: e.target.value})}
              className="bg-dark-600 border border-white/20 rounded-lg px-4 py-3 text-white"
            />
            
            <input
              type="text"
              placeholder="Telefone (somente números)"
              value={filtros.telefone}
              onChange={(e) => {
                const apenasNumeros = e.target.value.replace(/\D/g, '');
                setFiltros({...filtros, telefone: apenasNumeros});
              }}
              className="bg-dark-600 border border-white/20 rounded-lg px-4 py-3 text-white"
              maxLength={13}
            />
            
            <input
              type="text"
              placeholder="Email"
              value={filtros.email}
              onChange={(e) => setFiltros({...filtros, email: e.target.value})}
              className="bg-dark-600 border border-white/20 rounded-lg px-4 py-3 text-white"
            />
            
            <input
              type="text"
              placeholder="Cidade"
              value={filtros.cidade}
              onChange={(e) => setFiltros({...filtros, cidade: e.target.value})}
              className="bg-dark-600 border border-white/20 rounded-lg px-4 py-3 text-white"
            />
            
            <input
              type="text"
              placeholder="UF"
              maxLength={2}
              value={filtros.uf}
              onChange={(e) => setFiltros({...filtros, uf: e.target.value.toUpperCase()})}
              className="bg-dark-600 border border-white/20 rounded-lg px-4 py-3 text-white"
            />
            
            <select
              value={filtros.whatsapp}
              onChange={(e) => setFiltros({...filtros, whatsapp: e.target.value as any})}
              className="bg-dark-600 border border-white/20 rounded-lg px-4 py-3 text-white"
            >
              <option value="todos">Todos (WhatsApp)</option>
              <option value="sim">Com WhatsApp</option>
              <option value="nao">Sem WhatsApp</option>
            </select>
            
            <select
              value={filtros.tipo_documento}
              onChange={(e) => setFiltros({...filtros, tipo_documento: e.target.value as any})}
              className="bg-dark-600 border border-white/20 rounded-lg px-4 py-3 text-white"
            >
              <option value="todos">Todos (Tipo)</option>
              <option value="CPF">CPF</option>
              <option value="CNPJ">CNPJ</option>
            </select>
            
            <select
              value={filtros.tipo_origem}
              onChange={(e) => setFiltros({...filtros, tipo_origem: e.target.value as any})}
              className="bg-dark-600 border border-white/20 rounded-lg px-4 py-3 text-white"
            >
              <option value="todos">Todos (Origem)</option>
              <option value="consulta_unica">Consulta Única</option>
              <option value="consulta_massa">Consulta em Massa</option>
              <option value="manual">Cadastro Manual</option>
              <option value="importacao">Importação</option>
            </select>
            
            <input
              type="date"
              placeholder="Data Início"
              value={filtros.data_inicio}
              onChange={(e) => setFiltros({...filtros, data_inicio: e.target.value})}
              className="bg-dark-600 border border-white/20 rounded-lg px-4 py-3 text-white"
            />
            
            <input
              type="date"
              placeholder="Data Fim"
              value={filtros.data_fim}
              onChange={(e) => setFiltros({...filtros, data_fim: e.target.value})}
              className="bg-dark-600 border border-white/20 rounded-lg px-4 py-3 text-white"
            />
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={handleAplicarFiltros}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-bold transition-all"
            >
              🔍 Buscar
            </button>
            
            <button
              onClick={handleLimparFiltros}
              className="bg-yellow-600 hover:bg-yellow-700 text-white px-6 py-2 rounded-lg font-bold transition-all"
            >
              🔄 Limpar
            </button>
          </div>
        </div>
      )}

      {/* Lista de Registros */}
      <div className="bg-dark-800/50 border border-white/10 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-2xl font-bold text-white">
            📋 Registros ({total})
          </h3>
          
          {registros.length > 0 && (
            <button
              onClick={() => {
                if (estadoSelecionados.size === registros.length) {
                  setEstadoSelecionados(new Set());
                } else {
                  setEstadoSelecionados(new Set(registros.map(r => r.id)));
                }
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold text-sm transition-all"
            >
              {estadoSelecionados.size === registros.length ? '❌ Desmarcar Todos' : '☑️ Selecionar Todos'}
            </button>
          )}
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-white/60 text-xl">Carregando registros...</p>
          </div>
        ) : registros.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-white/60 text-xl">Nenhum registro encontrado</p>
            <p className="text-white/40 text-sm mt-2">
              Tente ajustar os filtros ou faça uma consulta
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {registros.map(reg => {
              const telefones = reg.telefones || [];
              const telefonesComWhatsApp = telefones.filter(t => t.has_whatsapp);

              return (
                <div
                  key={reg.id}
                  className={`border rounded-xl p-4 transition-all ${
                    estadoSelecionados.has(reg.id)
                      ? 'bg-blue-500/20 border-blue-500/50'
                      : 'bg-dark-700/50 border-white/10 hover:border-blue-500/30'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <input
                      type="checkbox"
                      checked={estadoSelecionados.has(reg.id)}
                      onChange={(e) => {
                        const newSet = new Set(estadoSelecionados);
                        if (e.target.checked) {
                          newSet.add(reg.id);
                        } else {
                          newSet.delete(reg.id);
                        }
                        setEstadoSelecionados(newSet);
                      }}
                      className="mt-1 w-5 h-5"
                    />
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`px-3 py-1 rounded-lg font-bold text-sm ${
                          reg.tipo_documento === 'CPF'
                            ? 'bg-green-500/20 text-green-300'
                            : 'bg-purple-500/20 text-purple-300'
                        }`}>
                          {reg.tipo_documento}
                        </span>
                        
                        <span className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-lg font-bold text-sm">
                          {reg.tipo_origem.replace('_', ' ').toUpperCase()}
                        </span>
                        
                        {/* TAG NOVA VIDA - Para QUALQUER cadastro que JÁ FOI consultado na Nova Vida */}
                        {(reg.consultado_nova_vida === true || reg.tipo_origem === 'consulta_unica' || reg.tipo_origem === 'consulta_massa') && (
                          <span className="px-3 py-1 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/50 text-cyan-300 rounded-lg font-bold text-sm flex items-center gap-2">
                            🌐 NOVA VIDA
                          </span>
                        )}
                        
                        {telefonesComWhatsApp.length > 0 && (
                          <span className="px-3 py-1 bg-green-500/20 text-green-300 rounded-lg font-bold text-sm flex items-center gap-2">
                            <FaWhatsapp /> {telefonesComWhatsApp.length} WhatsApp
                          </span>
                        )}
                      </div>
                      
                      <p className="text-2xl font-bold text-white mb-1">
                        {reg.nome}
                      </p>
                      
                      <p className="text-lg text-white/70 font-mono mb-2">
                        {reg.documento}
                      </p>
                      
                      {telefones.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-2">
                          {telefones.map((tel, i) => (
                            <span key={i} className="text-white/60 text-sm flex items-center gap-1">
                              <FaPhone className="text-xs" />
                              ({tel.ddd}) {tel.telefone}
                              {tel.has_whatsapp && <FaWhatsapp className="text-green-400" />}
                            </span>
                          ))}
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between mt-3">
                        <p className="text-white/50 text-sm">
                          Adicionado em {new Date(reg.data_adicao).toLocaleString('pt-BR')}
                        </p>
                        
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleConsultarCliente(reg)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2"
                          >
                            <FaSearch /> Consultar
                          </button>
                          <button
                            onClick={() => handleNovaConsulta(reg.documento)}
                            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2"
                          >
                            🔄 Nova Consulta
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Paginação */}
      {total > 50 && (
        <div className="flex justify-center gap-3">
          <button
            disabled={offset === 0}
            onClick={() => {
              setOffset(Math.max(0, offset - 50));
              loadRegistros();
            }}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-bold transition-all"
          >
            ← Anterior
          </button>
          
          <span className="text-white flex items-center px-4">
            {offset + 1} - {Math.min(offset + 50, total)} de {total}
          </span>
          
          <button
            disabled={offset + 50 >= total}
            onClick={() => {
              setOffset(offset + 50);
              loadRegistros();
            }}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-bold transition-all"
          >
            Próximo →
          </button>
        </div>
      )}

      {/* Modal Cadastro SIMPLIFICADO */}
      {mostrarCadastro && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border-2 border-primary-500/40 rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-3xl font-bold text-white flex items-center gap-3">
                <span className="text-4xl">➕</span>
                Cadastrar Cliente
              </h3>
              <button
                onClick={() => setMostrarCadastro(false)}
                className="text-white/70 hover:text-white text-2xl transition-all hover:rotate-90"
              >
                ✖️
              </button>
            </div>

            <div className="space-y-6">
              {/* CPF */}
              <div>
                <label className="block text-white font-bold mb-2 text-lg">
                  📄 CPF <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formCadastro.documento}
                  onChange={(e) => setFormCadastro({...formCadastro, documento: e.target.value.replace(/\D/g, '')})}
                  maxLength={11}
                  placeholder="00000000000"
                  className="w-full bg-dark-600 border-2 border-white/20 rounded-xl px-4 py-3 text-white text-lg focus:border-primary-500 focus:ring-4 focus:ring-primary-500/30 transition-all"
                />
              </div>

              {/* Nome */}
              <div>
                <label className="block text-white font-bold mb-2 text-lg">
                  👤 Nome Completo <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formCadastro.nome}
                  onChange={(e) => setFormCadastro({...formCadastro, nome: e.target.value})}
                  placeholder="Digite o nome completo"
                  className="w-full bg-dark-600 border-2 border-white/20 rounded-xl px-4 py-3 text-white text-lg focus:border-primary-500 focus:ring-4 focus:ring-primary-500/30 transition-all"
                />
              </div>

              {/* Telefones */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-white font-bold text-lg">
                    📱 Telefones
                  </label>
                  <button
                    onClick={adicionarTelefone}
                    className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-bold transition-all flex items-center gap-2"
                  >
                    <FaPlus /> Adicionar
                  </button>
                </div>

                <div className="space-y-3">
                  {formCadastro.telefones.map((tel, index) => (
                    <div key={index} className="flex gap-3 items-center bg-dark-700/50 p-4 rounded-xl border border-white/10">
                      <div className="flex-none">
                        <input
                          type="text"
                          value={tel.ddd}
                          onChange={(e) => atualizarTelefone(index, 'ddd', e.target.value)}
                          maxLength={2}
                          placeholder="DDD"
                          className="w-20 bg-dark-600 border border-white/20 rounded-lg px-3 py-2 text-white text-center focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30 transition-all"
                        />
                      </div>
                      <div className="flex-1">
                        <input
                          type="text"
                          value={tel.telefone}
                          onChange={(e) => atualizarTelefone(index, 'telefone', e.target.value)}
                          maxLength={9}
                          placeholder="999999999"
                          className="w-full bg-dark-600 border border-white/20 rounded-lg px-3 py-2 text-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30 transition-all"
                        />
                      </div>
                      {formCadastro.telefones.length > 1 && (
                        <button
                          onClick={() => removerTelefone(index)}
                          className="flex-none bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg transition-all"
                        >
                          <FaTrash />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                
                <div className="mt-3 bg-blue-500/20 border border-blue-500/40 rounded-lg p-3">
                  <p className="text-blue-200 text-sm">
                    📱 <strong>Verificação Automática:</strong> Ao salvar, o sistema verifica automaticamente se os telefones têm WhatsApp (se houver instâncias disponíveis).
                  </p>
                </div>
              </div>

              {/* Botões */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleCadastrar}
                  disabled={!formCadastro.documento || !formCadastro.nome || salvandoCliente}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-6 py-4 rounded-xl font-bold text-lg transition-all transform hover:scale-105 disabled:hover:scale-100 flex items-center justify-center gap-2"
                >
                  {salvandoCliente ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Salvando e verificando WhatsApp...
                    </>
                  ) : (
                    <>💾 Salvar</>
                  )}
                </button>
                <button
                  onClick={() => setMostrarCadastro(false)}
                  disabled={salvandoCliente}
                  className="px-6 py-4 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-xl font-bold text-lg transition-all transform hover:scale-105 disabled:hover:scale-100"
                >
                  ❌ Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Importação */}
      {mostrarImportacao && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border-2 border-white/20 rounded-2xl p-8 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-3xl font-bold text-white">📤 Importar Base de Dados</h3>
              <button
                onClick={() => setMostrarImportacao(false)}
                className="text-white/70 hover:text-white text-2xl"
              >
                ✖️
              </button>
            </div>

            <div className="space-y-6">
              {/* Botão Baixar Modelo */}
              <div className="bg-gradient-to-r from-green-500/20 to-blue-500/20 border-2 border-green-500/50 rounded-xl p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h4 className="text-white font-bold text-lg mb-2">📥 Não sabe como criar o arquivo?</h4>
                    <p className="text-white/80 text-sm mb-3">
                      Baixe nosso modelo Excel pronto para usar! Ele já vem com exemplos e as colunas configuradas.
                    </p>
                    <p className="text-green-300 text-sm font-bold">
                      ✅ Preencha o modelo e importe de volta!
                    </p>
                  </div>
                  <button
                    onClick={handleBaixarModelo}
                    className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2 whitespace-nowrap"
                  >
                    📥 Baixar Modelo
                  </button>
                </div>
              </div>

              {/* Informações dos campos */}
              <div className="bg-blue-500/20 border border-blue-500/50 rounded-xl p-5">
                <p className="text-white font-bold text-lg mb-3">📋 Campos do Arquivo:</p>
                
                <div className="space-y-4">
                  {/* Tabela de campos */}
                  <div className="bg-dark-700/50 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-blue-600/20 border-b border-blue-500/30">
                          <th className="text-left text-white font-bold p-3 w-1/5">Coluna</th>
                          <th className="text-left text-white font-bold p-3 w-1/5">Obrigatório</th>
                          <th className="text-left text-white font-bold p-3 w-3/5">Descrição</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-white/10">
                          <td className="p-3 text-yellow-300 font-mono font-bold">CPF/CNPJ</td>
                          <td className="p-3">
                            <span className="bg-red-500/20 text-red-300 px-2 py-1 rounded text-xs font-bold">SIM</span>
                          </td>
                          <td className="p-3 text-white/80">
                            Número do CPF (11 dígitos) ou CNPJ (14 dígitos)<br/>
                            <span className="text-white/60 text-xs">Ex: 12345678901 ou 12345678000190</span>
                          </td>
                        </tr>
                        <tr className="border-b border-white/10">
                          <td className="p-3 text-yellow-300 font-mono font-bold">NOME</td>
                          <td className="p-3">
                            <span className="bg-red-500/20 text-red-300 px-2 py-1 rounded text-xs font-bold">SIM</span>
                          </td>
                          <td className="p-3 text-white/80">
                            Nome completo da pessoa ou empresa<br/>
                            <span className="text-white/60 text-xs">Ex: João da Silva ou Empresa XYZ LTDA</span>
                          </td>
                        </tr>
                        <tr className="border-b border-white/10">
                          <td className="p-3 text-green-300 font-mono font-bold">TELEFONE1</td>
                          <td className="p-3">
                            <span className="bg-blue-500/20 text-blue-300 px-2 py-1 rounded text-xs font-bold">NÃO</span>
                          </td>
                          <td className="p-3 text-white/80">
                            Primeiro telefone com DDD<br/>
                            <span className="text-white/60 text-xs">Ex: 62994396869</span>
                          </td>
                        </tr>
                        <tr className="border-b border-white/10">
                          <td className="p-3 text-green-300 font-mono font-bold">TELEFONE2</td>
                          <td className="p-3">
                            <span className="bg-blue-500/20 text-blue-300 px-2 py-1 rounded text-xs font-bold">NÃO</span>
                          </td>
                          <td className="p-3 text-white/80">
                            Segundo telefone (se tiver)<br/>
                            <span className="text-white/60 text-xs">Ex: 62995786988</span>
                          </td>
                        </tr>
                        <tr className="border-b border-white/10">
                          <td className="p-3 text-green-300 font-mono font-bold">TELEFONE3</td>
                          <td className="p-3">
                            <span className="bg-blue-500/20 text-blue-300 px-2 py-1 rounded text-xs font-bold">NÃO</span>
                          </td>
                          <td className="p-3 text-white/80">
                            Terceiro telefone (se tiver) - e assim por diante...<br/>
                            <span className="text-white/60 text-xs">Ex: 11987654321 (aceita até TELEFONE10)</span>
                          </td>
                        </tr>
                        <tr>
                          <td className="p-3 text-green-300 font-mono font-bold">TIPO</td>
                          <td className="p-3">
                            <span className="bg-blue-500/20 text-blue-300 px-2 py-1 rounded text-xs font-bold">NÃO</span>
                          </td>
                          <td className="p-3 text-white/80">
                            Tipo de documento: "CPF" ou "CNPJ"<br/>
                            <span className="text-white/60 text-xs">Se não informar, será detectado automaticamente</span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Observações importantes */}
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                    <p className="text-yellow-300 font-bold mb-2">⚠️ Observações Importantes:</p>
                    <ul className="text-white/80 text-sm space-y-1">
                      <li>• <strong>Múltiplos telefones:</strong> Use colunas separadas (TELEFONE1, TELEFONE2, TELEFONE3...)</li>
                      <li>• <strong>Até 10 telefones:</strong> Sistema aceita de TELEFONE1 até TELEFONE10</li>
                      <li>• <strong>Telefones:</strong> Com ou sem DDD, com ou sem 55, com ou sem formatação</li>
                      <li>• <strong>WhatsApp:</strong> Sistema NÃO verifica WhatsApp na importação (mais rápido)</li>
                      <li>• <strong>Limite:</strong> Máximo de 100.000 registros por arquivo</li>
                      <li>• O sistema aceita colunas com nomes variados: "CPF", "CNPJ", "Documento", "CPF/CNPJ"</li>
                      <li>• Também aceita "NOME"/"Nome", "TELEFONE1"/"Telefone1", etc</li>
                      <li>• Números podem ter ou não formatação (pontos, traços, barras)</li>
                      <li>• Linhas duplicadas serão atualizadas automaticamente</li>
                      <li>• Formatos aceitos: .xlsx, .xls, .csv</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-white font-bold mb-2">Selecionar Arquivo</label>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => setArquivoImportacao(e.target.files?.[0] || null)}
                  className="w-full bg-dark-600 border border-white/20 rounded-lg px-4 py-3 text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white file:cursor-pointer"
                />
                {arquivoImportacao && (
                  <p className="text-green-400 mt-2">✅ {arquivoImportacao.name}</p>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleImportar}
                  disabled={!arquivoImportacao}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl font-bold transition-all"
                >
                  ⬆️ Importar
                </button>
                <button
                  onClick={() => {
                    setMostrarImportacao(false);
                    setArquivoImportacao(null);
                  }}
                  className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-all"
                >
                  ❌ Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmação Excluir Tudo */}
      {mostrarConfirmacaoExcluirTudo && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border-2 border-red-500/50 rounded-2xl p-8 max-w-md w-full">
            <div className="text-center mb-6">
              <div className="text-6xl mb-4">⚠️</div>
              <h3 className="text-3xl font-bold text-white mb-2">ATENÇÃO!</h3>
              <p className="text-red-400 font-bold text-xl">
                Você está prestes a excluir TODA a base de dados!
              </p>
            </div>

            <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 mb-6">
              <p className="text-white text-sm">
                <strong>⚠️ Esta ação é irreversível!</strong>
              </p>
              <p className="text-white/80 text-sm mt-2">
                • Todos os {estatisticas?.total_registros || 0} registros serão excluídos
              </p>
              <p className="text-white/80 text-sm">
                • Os dados NÃO poderão ser recuperados
              </p>
              <p className="text-white/80 text-sm">
                • Esta ação afeta TODA a base
              </p>
            </div>

            <p className="text-white text-center mb-6 font-bold">
              Tem certeza que deseja continuar?
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setMostrarConfirmacaoExcluirTudo(false)}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-xl font-bold transition-all"
              >
                ❌ Cancelar
              </button>
              <button
                onClick={handleExcluirTudo}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-bold transition-all"
              >
                🗑️ Sim, Excluir Tudo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Dados do Cliente */}
      {mostrarDadosCliente && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border-2 border-blue-500/40 rounded-2xl p-8 max-w-[90vw] w-full max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-3xl font-bold text-white">
                📋 Dados do Cliente
              </h3>
              <div className="flex items-center gap-3">
                {!modoEdicao && clienteSelecionado && (
                  <button
                    onClick={handleIniciarEdicao}
                    className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2"
                  >
                    <FaEdit /> Editar Dados
                  </button>
                )}
                <button
                  onClick={() => {
                    setMostrarDadosCliente(false);
                    setModoEdicao(false);
                    setDadosEdicao(null);
                  }}
                  className="text-white/70 hover:text-white text-2xl transition-all"
                >
                  ✖️
                </button>
              </div>
            </div>

            {consultandoCliente ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-green-500 mx-auto mb-4"></div>
                <p className="text-white text-xl">Consultando dados na Nova Vida...</p>
                <p className="text-white/60 text-sm mt-2">Aguarde, isso pode levar alguns segundos</p>
              </div>
            ) : modoEdicao && dadosEdicao ? (
              <div className="space-y-4">
                <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-xl p-4 mb-4">
                  <p className="text-yellow-200 text-sm">
                    ✏️ <strong>Modo de Edição</strong> - Altere os dados abaixo e clique em "Salvar Alterações"
                  </p>
                </div>

                {/* Dados Cadastrais */}
                <div className="bg-dark-700/50 border border-white/10 rounded-xl p-6">
                  <h4 className="text-xl font-bold text-white mb-4">👤 Dados Cadastrais</h4>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-white/60 text-sm block mb-2">Nome Completo *</label>
                        <input
                          type="text"
                          value={dadosEdicao.nome}
                          onChange={(e) => setDadosEdicao({ ...dadosEdicao, nome: e.target.value })}
                          className="w-full bg-dark-600 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-blue-500 focus:outline-none"
                          placeholder="Nome completo"
                        />
                      </div>
                      <div>
                        <label className="text-white/60 text-sm block mb-2">Nome da Mãe</label>
                        <input
                          type="text"
                          value={dadosEdicao.nome_mae}
                          onChange={(e) => setDadosEdicao({ ...dadosEdicao, nome_mae: e.target.value })}
                          className="w-full bg-dark-600 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-blue-500 focus:outline-none"
                          placeholder="Nome da mãe"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-white/60 text-sm block mb-2">Sexo</label>
                        <select
                          value={dadosEdicao.sexo}
                          onChange={(e) => setDadosEdicao({ ...dadosEdicao, sexo: e.target.value })}
                          className="w-full bg-dark-600 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-blue-500 focus:outline-none"
                        >
                          <option value="">Selecione...</option>
                          <option value="M">Masculino</option>
                          <option value="F">Feminino</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-white/60 text-sm block mb-2">Data de Nascimento</label>
                        <input
                          type="text"
                          value={dadosEdicao.data_nascimento}
                          onChange={(e) => setDadosEdicao({ ...dadosEdicao, data_nascimento: e.target.value })}
                          className="w-full bg-dark-600 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-blue-500 focus:outline-none"
                          placeholder="DD/MM/AAAA"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Telefones */}
                <div className="bg-dark-700/50 border border-white/10 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-xl font-bold text-white">📱 Telefones</h4>
                    <button
                      onClick={adicionarTelefoneEdicao}
                      className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-lg text-sm font-bold transition-all"
                    >
                      + Adicionar Telefone
                    </button>
                  </div>
                  <div className="space-y-3">
                    {dadosEdicao.telefones.map((tel: any, i: number) => (
                      <div key={i} className="bg-dark-600/50 p-4 rounded-lg">
                        <div className="flex gap-3 items-start">
                          <div className="grid grid-cols-3 gap-3 flex-1">
                            <div>
                              <label className="text-white/60 text-xs block mb-1">DDD</label>
                              <input
                                type="text"
                                value={tel.ddd}
                                onChange={(e) => atualizarTelefoneEdicao(i, 'ddd', e.target.value)}
                                className="w-full bg-dark-600 border border-white/10 rounded px-3 py-2 text-white text-sm"
                                placeholder="11"
                                maxLength={2}
                              />
                            </div>
                            <div>
                              <label className="text-white/60 text-xs block mb-1">Telefone</label>
                              <input
                                type="text"
                                value={tel.telefone}
                                onChange={(e) => atualizarTelefoneEdicao(i, 'telefone', e.target.value)}
                                className="w-full bg-dark-600 border border-white/10 rounded px-3 py-2 text-white text-sm"
                                placeholder="987654321"
                              />
                            </div>
                            <div>
                              <label className="text-white/60 text-xs block mb-1">Operadora</label>
                              <input
                                type="text"
                                value={tel.operadora}
                                onChange={(e) => atualizarTelefoneEdicao(i, 'operadora', e.target.value)}
                                className="w-full bg-dark-600 border border-white/10 rounded px-3 py-2 text-white text-sm"
                                placeholder="VIVO"
                              />
                            </div>
                          </div>
                          <button
                            onClick={() => removerTelefoneEdicao(i)}
                            className="bg-red-600 hover:bg-red-700 text-white p-2 rounded transition-all mt-6"
                            title="Remover telefone"
                          >
                            <FaTrash />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* E-mails */}
                <div className="bg-dark-700/50 border border-white/10 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-xl font-bold text-white">📧 E-mails</h4>
                    <button
                      onClick={adicionarEmailEdicao}
                      className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-lg text-sm font-bold transition-all"
                    >
                      + Adicionar E-mail
                    </button>
                  </div>
                  <div className="space-y-3">
                    {dadosEdicao.emails.map((email: any, i: number) => (
                      <div key={i} className="bg-dark-600/50 p-3 rounded-lg flex gap-3">
                        <input
                          type="email"
                          value={email.email}
                          onChange={(e) => atualizarEmailEdicao(i, e.target.value)}
                          className="flex-1 bg-dark-600 border border-white/10 rounded px-3 py-2 text-white"
                          placeholder="email@example.com"
                        />
                        <button
                          onClick={() => removerEmailEdicao(i)}
                          className="bg-red-600 hover:bg-red-700 text-white p-2 rounded transition-all"
                          title="Remover e-mail"
                        >
                          <FaTrash />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Endereços */}
                <div className="bg-dark-700/50 border border-white/10 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-xl font-bold text-white">📍 Endereços</h4>
                    <button
                      onClick={adicionarEnderecoEdicao}
                      className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-lg text-sm font-bold transition-all"
                    >
                      + Adicionar Endereço
                    </button>
                  </div>
                  <div className="space-y-4">
                    {dadosEdicao.enderecos.map((end: any, i: number) => (
                      <div key={i} className="bg-dark-600/50 p-4 rounded-lg">
                        <div className="space-y-3">
                          <div className="grid grid-cols-3 gap-3">
                            <div className="col-span-2">
                              <label className="text-white/60 text-xs block mb-1">Logradouro</label>
                              <input
                                type="text"
                                value={end.logradouro}
                                onChange={(e) => atualizarEnderecoEdicao(i, 'logradouro', e.target.value)}
                                className="w-full bg-dark-600 border border-white/10 rounded px-3 py-2 text-white text-sm"
                                placeholder="Rua, Avenida..."
                              />
                            </div>
                            <div>
                              <label className="text-white/60 text-xs block mb-1">Número</label>
                              <input
                                type="text"
                                value={end.numero}
                                onChange={(e) => atualizarEnderecoEdicao(i, 'numero', e.target.value)}
                                className="w-full bg-dark-600 border border-white/10 rounded px-3 py-2 text-white text-sm"
                                placeholder="123"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <label className="text-white/60 text-xs block mb-1">Complemento</label>
                              <input
                                type="text"
                                value={end.complemento}
                                onChange={(e) => atualizarEnderecoEdicao(i, 'complemento', e.target.value)}
                                className="w-full bg-dark-600 border border-white/10 rounded px-3 py-2 text-white text-sm"
                                placeholder="Apto, Bloco..."
                              />
                            </div>
                            <div>
                              <label className="text-white/60 text-xs block mb-1">Bairro</label>
                              <input
                                type="text"
                                value={end.bairro}
                                onChange={(e) => atualizarEnderecoEdicao(i, 'bairro', e.target.value)}
                                className="w-full bg-dark-600 border border-white/10 rounded px-3 py-2 text-white text-sm"
                                placeholder="Centro"
                              />
                            </div>
                            <div>
                              <label className="text-white/60 text-xs block mb-1">CEP</label>
                              <input
                                type="text"
                                value={end.cep}
                                onChange={(e) => atualizarEnderecoEdicao(i, 'cep', e.target.value)}
                                className="w-full bg-dark-600 border border-white/10 rounded px-3 py-2 text-white text-sm"
                                placeholder="12345-678"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            <div className="col-span-2">
                              <label className="text-white/60 text-xs block mb-1">Cidade</label>
                              <input
                                type="text"
                                value={end.cidade}
                                onChange={(e) => atualizarEnderecoEdicao(i, 'cidade', e.target.value)}
                                className="w-full bg-dark-600 border border-white/10 rounded px-3 py-2 text-white text-sm"
                                placeholder="São Paulo"
                              />
                            </div>
                            <div>
                              <label className="text-white/60 text-xs block mb-1">UF</label>
                              <input
                                type="text"
                                value={end.uf}
                                onChange={(e) => atualizarEnderecoEdicao(i, 'uf', e.target.value)}
                                className="w-full bg-dark-600 border border-white/10 rounded px-3 py-2 text-white text-sm uppercase"
                                placeholder="SP"
                                maxLength={2}
                              />
                            </div>
                          </div>
                          <div className="flex justify-end">
                            <button
                              onClick={() => removerEnderecoEdicao(i)}
                              className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded transition-all text-sm"
                            >
                              <FaTrash className="inline mr-1" /> Remover Endereço
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Observações */}
                <div className="bg-dark-700/50 border border-white/10 rounded-xl p-6">
                  <h4 className="text-xl font-bold text-white mb-4">📝 Observações</h4>
                  <textarea
                    value={dadosEdicao.observacoes}
                    onChange={(e) => setDadosEdicao({ ...dadosEdicao, observacoes: e.target.value })}
                    className="w-full bg-dark-600 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-blue-500 focus:outline-none"
                    placeholder="Observações adicionais..."
                    rows={4}
                  />
                </div>

                {/* Botões de Ação */}
                <div className="flex gap-3 justify-end sticky bottom-0 bg-dark-800 pt-4 pb-2 border-t border-white/10">
                  <button
                    onClick={handleCancelarEdicao}
                    className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-bold transition-all"
                  >
                    ❌ Cancelar
                  </button>
                  <button
                    onClick={handleSalvarEdicao}
                    className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-bold transition-all"
                  >
                    💾 Salvar Alterações
                  </button>
                </div>
              </div>
            ) : clienteSelecionado ? (
              <div>
                {/* Indicador de origem dos dados */}
                {clienteSelecionado._isNovaVidaData && (
                  <div className="bg-green-500/20 border border-green-500/50 rounded-xl p-4 mb-4">
                    <p className="text-green-200 text-sm">
                      🔄 <strong>Dados atualizados da Nova Vida!</strong> As informações foram consultadas agora e salvas na base de dados.
                    </p>
                  </div>
                )}
                
                {!clienteSelecionado._isNovaVidaData && (
                  <div className="bg-blue-500/20 border border-blue-500/50 rounded-xl p-4 mb-4">
                    <p className="text-blue-200 text-sm">
                      💾 <strong>Dados do cadastro local</strong> - Estas são as informações que já estão salvas na base de dados.
                    </p>
                  </div>
                )}

                {/* Layout em Grid de 2 colunas */}
                <div className="grid grid-cols-2 gap-6">
                  {/* ========== COLUNA ESQUERDA ========== */}
                  <div className="space-y-4">
                    {/* Dados Cadastrais */}
                    <div className="bg-dark-700/50 border border-white/10 rounded-xl p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-xl font-bold text-white">👤 Dados Cadastrais</h4>
                        <button
                          onClick={() => handleNovaConsulta(clienteSelecionado.documento)}
                          disabled={consultandoCliente}
                          className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-4 py-2 rounded-lg font-bold transition-all flex items-center gap-2 disabled:opacity-50"
                          title="Fazer nova consulta na Nova Vida"
                        >
                          🔄 Consultar Nova Vida
                        </button>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <p className="text-white/60 text-sm">Nome</p>
                          <p className="text-white font-bold">{clienteSelecionado.nome || clienteSelecionado.CADASTRAIS?.NOME || '-'}</p>
                        </div>
                        <div>
                          <p className="text-white/60 text-sm">CPF/CNPJ</p>
                          <p className="text-white font-bold font-mono">{clienteSelecionado.documento || '-'}</p>
                        </div>
                        <div>
                          <p className="text-white/60 text-sm">Nome da Mãe</p>
                          <p className="text-white font-bold">{clienteSelecionado.nome_mae || clienteSelecionado.CADASTRAIS?.MAE || '-'}</p>
                        </div>
                        <div>
                          <p className="text-white/60 text-sm">Sexo</p>
                          <p className="text-white font-bold">{clienteSelecionado.sexo || clienteSelecionado.CADASTRAIS?.SEXO || '-'}</p>
                        </div>
                        {clienteSelecionado.CADASTRAIS?.NASC && (
                          <div>
                            <p className="text-white/60 text-sm">Data de Nascimento</p>
                            <p className="text-white font-bold">{clienteSelecionado.CADASTRAIS.NASC}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Telefones */}
                    {((clienteSelecionado.telefones && clienteSelecionado.telefones.length > 0) || 
                      (clienteSelecionado.TELEFONES && clienteSelecionado.TELEFONES.length > 0)) && (
                      <div className="bg-dark-700/50 border border-white/10 rounded-xl p-6">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-xl font-bold text-white">📱 Telefones ({(clienteSelecionado.TELEFONES || clienteSelecionado.telefones || []).length})</h4>
                          <button
                            onClick={handleVerificarWhatsApp}
                            disabled={verificandoWhatsApp}
                            className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white px-4 py-2 rounded-lg font-bold transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Buscar fotos e verificar WhatsApp"
                          >
                            {verificandoWhatsApp ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                Consultando...
                              </>
                            ) : (
                              <>
                                <FaWhatsapp /> Consultar Todos os WhatsApps
                              </>
                            )}
                          </button>
                        </div>
                        <div className="space-y-2">
                          {(clienteSelecionado.TELEFONES || clienteSelecionado.telefones || []).map((tel: any, i: number) => {
                            const ddd = tel.DDD || tel.ddd;
                            const telefone = tel.TELEFONE || tel.telefone;
                            const telefoneCompleto = `(${ddd}) ${telefone}`;
                            const telefoneNumeros = `${ddd}${telefone}`;
                            const numeroLimpo = `55${ddd}${telefone}`;
                            
                            // Buscar foto e status do WhatsApp
                            const profilePhoto = phonePhotos.get(numeroLimpo);
                            const isLoadingPhone = loadingPhones.has(numeroLimpo);
                            
                            // Determinar status de WhatsApp
                            const hasWhatsApp = profilePhoto?.hasWhatsApp !== undefined 
                              ? profilePhoto.hasWhatsApp 
                              : (tel.HAS_WHATSAPP || tel.has_whatsapp);
                            const whatsappVerified = profilePhoto !== undefined || (tel.HAS_WHATSAPP !== undefined || tel.has_whatsapp !== undefined);
                            
                            return (
                              <div 
                                key={i} 
                                className={`flex items-center justify-between p-3 rounded-lg transition-all ${
                                  hasWhatsApp 
                                    ? 'bg-green-500/20 border-2 border-green-500/50' 
                                    : whatsappVerified 
                                    ? 'bg-red-500/10 border-2 border-red-500/30' 
                                    : 'bg-dark-600/50'
                                }`}
                              >
                                <div className="flex items-center gap-3 flex-1">
                                  {/* Foto do perfil ou ícone */}
                                  {isLoadingPhone ? (
                                    <div className="w-12 h-12 flex items-center justify-center">
                                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-400"></div>
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
                                    <FaWhatsapp className="text-3xl text-green-400" />
                                  ) : whatsappVerified ? (
                                    <span className="text-3xl">❌</span>
                                  ) : null}
                                  
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-white font-mono text-lg">
                                        {telefoneCompleto}
                                      </span>
                                      <button
                                        onClick={() => copiarTexto(numeroLimpo, 'Telefone')}
                                        className="bg-blue-500/20 hover:bg-blue-500/40 text-blue-300 px-2 py-1 rounded text-sm transition-all flex items-center gap-1"
                                        title="Copiar telefone"
                                      >
                                        <FaCopy /> Copiar
                                      </button>
                                    </div>
                                    
                                    {isLoadingPhone && (
                                      <p className="text-xs text-yellow-300 animate-pulse mt-1">
                                        🔄 Consultando...
                                      </p>
                                    )}
                                    
                                    {profilePhoto?.url && !isLoadingPhone && (
                                      <p className="text-xs text-green-300 mt-1">
                                        ✓ Foto carregada - clique para ampliar
                                      </p>
                                    )}
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                  {(tel.OPERADORA || tel.operadora) && (
                                    <span className="text-white/60 text-sm">{tel.OPERADORA || tel.operadora}</span>
                                  )}
                                  
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
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ========== COLUNA DIREITA ========== */}
                  <div className="space-y-4">
                    {/* Emails */}
                    {((clienteSelecionado.emails && clienteSelecionado.emails.length > 0) ||
                      (clienteSelecionado.EMAILS && clienteSelecionado.EMAILS.length > 0)) && (
                      <div className="bg-dark-700/50 border border-white/10 rounded-xl p-6">
                        <h4 className="text-xl font-bold text-white mb-4">📧 E-mails</h4>
                        <div className="space-y-2">
                          {(clienteSelecionado.EMAILS || clienteSelecionado.emails || []).map((email: any, i: number) => {
                            const emailTexto = email.EMAIL || email.email;
                            return (
                              <div key={i} className="bg-dark-600/50 p-3 rounded-lg flex items-center justify-between">
                                <span className="text-white">{emailTexto}</span>
                                <button
                                  onClick={() => copiarTexto(emailTexto, 'E-mail')}
                                  className="bg-blue-500/20 hover:bg-blue-500/40 text-blue-300 px-2 py-1 rounded text-sm transition-all flex items-center gap-1"
                                  title="Copiar e-mail"
                                >
                                  <FaCopy /> Copiar
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Endereços */}
                    {((clienteSelecionado.enderecos && clienteSelecionado.enderecos.length > 0) ||
                      (clienteSelecionado.ENDERECOS && clienteSelecionado.ENDERECOS.length > 0)) && (
                      <div className="bg-dark-700/50 border border-white/10 rounded-xl p-6">
                        <h4 className="text-xl font-bold text-white mb-4">📍 Endereços</h4>
                        <div className="space-y-3">
                          {(clienteSelecionado.ENDERECOS || clienteSelecionado.enderecos || []).map((end: any, i: number) => (
                            <div key={i} className="bg-dark-600/50 p-4 rounded-lg">
                              <p className="text-white">
                                {end.LOGRADOURO || end.logradouro}, {end.NUMERO || end.numero}
                                {(end.COMPLEMENTO || end.complemento) && ` - ${end.COMPLEMENTO || end.complemento}`}
                              </p>
                              <p className="text-white/60 text-sm mt-1">
                                {end.BAIRRO || end.bairro} - {end.CIDADE || end.cidade}/{end.UF || end.uf} - CEP: {end.CEP || end.cep}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-white/60">Nenhum dado disponível</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de Foto Ampliada */}
      {selectedPhotoModal && (
        <div 
          className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
          onClick={() => setSelectedPhotoModal(null)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setSelectedPhotoModal(null)}
              className="absolute -top-4 -right-4 bg-red-600 hover:bg-red-700 text-white rounded-full w-10 h-10 flex items-center justify-center font-bold text-xl transition-all z-10 shadow-lg"
              title="Fechar"
            >
              ✖
            </button>
            
            <div className="bg-dark-800 border-4 border-white/20 rounded-2xl overflow-hidden shadow-2xl">
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4">
                <h3 className="text-white font-bold text-xl text-center">{selectedPhotoModal.name}</h3>
                <p className="text-white/80 text-center text-sm mt-1">
                  📱 {selectedPhotoModal.phone}
                </p>
              </div>
              
              <div className="p-4 bg-dark-900 flex items-center justify-center">
                <img 
                  src={selectedPhotoModal.url} 
                  alt={`Foto de ${selectedPhotoModal.name}`}
                  className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-xl"
                  style={{ minWidth: '500px' }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmação de Cadastro (Nenhum resultado encontrado) */}
      {mostrarConfirmacaoCadastro && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border-2 border-yellow-500/50 rounded-2xl p-8 max-w-lg w-full">
            <div className="text-center mb-6">
              <div className="text-6xl mb-4">❌</div>
              <h3 className="text-3xl font-bold text-white mb-2">Nenhum Cadastro Encontrado</h3>
              <p className="text-white/70 text-lg">
                Não encontramos nenhum cadastro para:
              </p>
              <p className="text-yellow-400 font-bold text-xl mt-2">
                "{termoBuscaNaoEncontrado}"
              </p>
            </div>

            <div className="bg-blue-500/20 border border-blue-500/50 rounded-xl p-4 mb-6">
              <p className="text-white text-center font-bold text-lg">
                Deseja cadastrar este cliente?
              </p>
            </div>

            {/* Grid de 3 botões */}
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={handleCancelarCadastro}
                className="bg-red-500/20 hover:bg-red-500/30 border-2 border-red-500/50 text-white font-bold py-4 px-4 rounded-xl transition-all flex flex-col items-center gap-2"
              >
                <span className="text-3xl">❌</span>
                <span className="text-sm">Não</span>
              </button>
              
              <button
                onClick={handleCadastroViaConsulta}
                className="bg-blue-500/20 hover:bg-blue-500/30 border-2 border-blue-500/50 text-white font-bold py-4 px-4 rounded-xl transition-all flex flex-col items-center gap-2"
              >
                <span className="text-3xl">🔍</span>
                <span className="text-sm text-center">Consulta Nova Vida</span>
              </button>
              
              <button
                onClick={handleCadastroManual}
                className="bg-green-500/20 hover:bg-green-500/30 border-2 border-green-500/50 text-white font-bold py-4 px-4 rounded-xl transition-all flex flex-col items-center gap-2"
              >
                <span className="text-3xl">✍️</span>
                <span className="text-sm text-center">Cadastro Manual</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Pedir CPF/CNPJ para Consulta Nova Vida */}
      {mostrarPedirCPF && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border-2 border-blue-500/50 rounded-2xl p-8 max-w-md w-full">
            <div className="text-center mb-6">
              <div className="text-6xl mb-4">📄</div>
              <h3 className="text-3xl font-bold text-white mb-2">Consultar Nova Vida</h3>
              <p className="text-white/70 text-lg">
                Digite o CPF ou CNPJ para consultar
              </p>
            </div>

            <div className="mb-6">
              <input
                type="text"
                value={cpfParaConsulta}
                onChange={(e) => {
                  const apenasNumeros = e.target.value.replace(/\D/g, '');
                  setCpfParaConsulta(apenasNumeros);
                }}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleConfirmarCPF();
                  }
                }}
                placeholder="Digite o CPF ou CNPJ"
                className="w-full bg-dark-700 border-2 border-white/20 rounded-xl px-4 py-3 text-white text-lg font-mono focus:outline-none focus:border-blue-500 transition-all"
                maxLength={14}
                autoFocus
                disabled={consultandoNovaVida}
              />
              <p className="text-white/50 text-sm mt-2">
                {cpfParaConsulta.length === 0 && 'CPF: 11 dígitos | CNPJ: 14 dígitos'}
                {cpfParaConsulta.length > 0 && cpfParaConsulta.length < 11 && `${cpfParaConsulta.length}/11 dígitos`}
                {cpfParaConsulta.length === 11 && '✅ CPF completo'}
                {cpfParaConsulta.length > 11 && cpfParaConsulta.length < 14 && `${cpfParaConsulta.length}/14 dígitos`}
                {cpfParaConsulta.length === 14 && '✅ CNPJ completo'}
              </p>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => {
                  setMostrarPedirCPF(false);
                  setCpfParaConsulta('');
                }}
                className="flex-1 bg-red-500/20 hover:bg-red-500/30 border-2 border-red-500/50 text-white font-bold py-3 px-6 rounded-xl transition-all"
                disabled={consultandoNovaVida}
              >
                ❌ Cancelar
              </button>
              <button
                onClick={handleConfirmarCPF}
                className="flex-1 bg-green-500/20 hover:bg-green-500/30 border-2 border-green-500/50 text-white font-bold py-3 px-6 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={consultandoNovaVida || cpfParaConsulta.length < 11}
              >
                {consultandoNovaVida ? '🔍 Consultando...' : '✅ Consultar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Resultados da Busca Rápida */}
      {mostrarResultadosBusca && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border-2 border-blue-500/40 rounded-2xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-3xl font-bold text-white">
                📊 {resultadosBusca.length} Cadastros Encontrados
              </h3>
              <button
                onClick={() => {
                  setMostrarResultadosBusca(false);
                  setResultadosBusca([]);
                }}
                className="text-white/70 hover:text-white text-2xl transition-all"
              >
                ✖️
              </button>
            </div>

            <p className="text-white/60 mb-6">
              Selecione qual cadastro deseja visualizar:
            </p>

            <div className="space-y-3">
              {resultadosBusca.map((registro) => (
                <div
                  key={registro.id}
                  onClick={() => {
                    setMostrarResultadosBusca(false);
                    handleConsultarCliente(registro);
                  }}
                  className="bg-dark-700/50 border border-white/10 rounded-xl p-4 hover:border-blue-500/50 hover:bg-dark-700 cursor-pointer transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-white font-bold text-lg">{registro.nome}</p>
                      <p className="text-white/60 text-sm">CPF/CNPJ: {registro.documento}</p>
                      {registro.telefones && registro.telefones.length > 0 && (
                        <p className="text-white/60 text-sm">
                          📱 {registro.telefones.map((t: any) => `(${t.ddd}) ${t.telefone}`).join(', ')}
                        </p>
                      )}
                      {registro.whatsapp_verificado && (
                        <span className="inline-block bg-green-500/20 text-green-300 px-2 py-1 rounded text-xs mt-2">
                          ✅ WhatsApp
                        </span>
                      )}
                    </div>
                    <div className="ml-4">
                      <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold transition-all">
                        Ver Dados →
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 text-center">
              <button
                onClick={() => {
                  setMostrarResultadosBusca(false);
                  setResultadosBusca([]);
                }}
                className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-xl font-bold transition-all"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🔔 NOTIFICAÇÕES TOAST MODERNAS E BONITAS */}
      <div className="fixed top-20 right-6 z-[9999] space-y-3 max-w-md pointer-events-none">
        {notifications.map(notification => (
          <div
            key={notification.id}
            className={`
              pointer-events-auto
              animate-toast-enter
              backdrop-blur-xl rounded-2xl overflow-hidden shadow-2xl border-2
              transform transition-all duration-300 hover:scale-105 hover:shadow-3xl
              ${notification.type === 'success' ? 'bg-gradient-to-r from-green-500 to-emerald-600 border-green-400' : ''}
              ${notification.type === 'error' ? 'bg-gradient-to-r from-red-500 to-rose-600 border-red-400' : ''}
              ${notification.type === 'info' ? 'bg-gradient-to-r from-blue-500 to-cyan-600 border-blue-400' : ''}
            `}
          >
            <div className="p-5">
              <div className="flex items-start gap-4">
                {/* Ícone animado */}
                <div className="flex-shrink-0">
                  {notification.type === 'success' && (
                    <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center animate-icon-bounce">
                      <span className="text-3xl">✅</span>
                    </div>
                  )}
                  {notification.type === 'error' && (
                    <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center animate-icon-bounce">
                      <span className="text-3xl">❌</span>
                    </div>
                  )}
                  {notification.type === 'info' && (
                    <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center animate-icon-bounce">
                      <span className="text-3xl">💡</span>
                    </div>
                  )}
                </div>
                
                {/* Mensagem */}
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold text-base leading-snug break-words">
                    {notification.message}
                  </p>
                </div>
                
                {/* Botão fechar */}
                <button
                  onClick={() => setNotifications(prev => prev.filter(n => n.id !== notification.id))}
                  className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white transition-all"
                  title="Fechar"
                >
                  <span className="text-xl font-bold">×</span>
                </button>
              </div>
            </div>
            
            {/* Barra de progresso */}
            <div className="h-1 bg-white/30">
              <div 
                className="h-full bg-white animate-progress"
                style={{ animationDuration: '5s' }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

