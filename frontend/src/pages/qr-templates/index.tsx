import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  FaPlus, FaEdit, FaTrash, FaArrowLeft, FaSearch, FaCopy,
  FaFileAlt, FaImage, FaVideo, FaMusic, FaMicrophone,
  FaFile, FaList, FaThList, FaMobileAlt, FaDownload, FaUpload, FaTimes
} from 'react-icons/fa';
import api from '@/services/api';

interface Template {
  id: number;
  name: string;
  description: string;
  type: string;
  text_content: string;
  media_files: any[];
  variables_map?: any;
  list_config?: any;
  buttons_config?: any;
  carousel_config?: any;
  created_at: string;
  updated_at: string;
}

export default function QrTemplates() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterVariables, setFilterVariables] = useState<'all' | 'with' | 'without'>('all');
  
  // Estados para visualização mobile
  const [mobilePreview, setMobilePreview] = useState<Template | null>(null);
  const [showMobileModal, setShowMobileModal] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const response = await api.get('/qr-templates');
      
      if (response.data.success) {
        setTemplates(response.data.data);
      }
    } catch (error) {
      console.error('Erro ao carregar templates:', error);
      alert('Erro ao carregar templates');
    } finally {
      setLoading(false);
    }
  };

  const handleClone = async (id: number) => {
    try {
      // Buscar dados completos do template
      const response = await api.get(`/qr-templates/${id}`);
      
      if (response.data.success) {
        const templateData = response.data.data;
        
        // Salvar no sessionStorage para pré-preencher a página de criar
        sessionStorage.setItem('templateToClone', JSON.stringify({
          ...templateData,
          name: `${templateData.name} (Cópia)`, // Adicionar " (Cópia)" no nome
          id: undefined // Remover o ID para criar um novo
        }));
        
        // Redirecionar para página de criar
        router.push('/qr-templates/criar');
      }
    } catch (error) {
      console.error('Erro ao clonar template:', error);
      alert('Erro ao clonar template');
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Tem certeza que deseja deletar o template "${name}"?\n\nEsta ação não pode ser desfeita!`)) {
      return;
    }

    try {
      const response = await api.delete(`/qr-templates/${id}`);
      
      if (response.data.success) {
        alert('Template deletado com sucesso!');
        loadTemplates();
      }
    } catch (error: any) {
      console.error('Erro ao deletar template:', error);
      
      // Verificar se é erro de campanha em andamento
      if (error.response?.status === 400 && error.response?.data?.error === 'Campanha em andamento') {
        alert(`❌ ${error.response.data.message}`);
      } else {
        alert('Erro ao deletar template');
      }
    }
  };

  const handleDeleteAll = async () => {
    if (templates.length === 0) {
      alert('Não há templates para deletar');
      return;
    }

    const confirmed = window.confirm(
      `⚠️ Tem certeza que deseja excluir TODOS os templates?\n\n` +
      `Isso irá deletar:\n` +
      `• ${templates.length} template(s)\n` +
      `• Todas as campanhas QR\n` +
      `• Todos os arquivos de mídia\n\n` +
      `Esta ação não pode ser desfeita!`
    );
    
    if (!confirmed) {
      return;
    }

    try {
      setLoading(true);
      const response = await api.delete(`/qr-templates/all`);
      
      if (response.data.success) {
        const { deletedCampaigns, deletedCount, deletedFiles } = response.data;
        alert(
          `✅ Excluído com sucesso!\n\n` +
          `${deletedCampaigns || 0} campanha(s)\n` +
          `${deletedCount} template(s)\n` +
          `${deletedFiles} arquivo(s)`
        );
        loadTemplates();
      }
    } catch (error: any) {
      console.error('Erro ao deletar todos os templates:', error);
      
      // Verificar se é erro de campanhas em andamento
      if (error.response?.status === 400 && error.response?.data?.error === 'Campanhas em andamento') {
        alert(`❌ ${error.response.data.message}`);
      } else {
        alert('Erro ao deletar todos os templates');
      }
    } finally {
      setLoading(false);
    }
  };

  const getTypeIcon = (type: string) => {
    const icons: any = {
      text: <FaFileAlt />,
      image: <FaImage />,
      video: <FaVideo />,
      audio: <FaMusic />,
      audio_recorded: <FaMicrophone />,
      document: <FaFile />,
      list: <FaList />,
      buttons: <FaThList />,
      carousel: <FaThList />
    };
    return icons[type] || <FaFileAlt />;
  };

  const getTypeName = (type: string) => {
    const names: any = {
      text: 'Texto',
      image: 'Imagem',
      video: 'Vídeo',
      audio: 'Áudio',
      audio_recorded: 'Áudio Gravado',
      document: 'Documento',
      list: 'Menu Lista',
      buttons: 'Menu Botões',
      carousel: 'Carrossel'
    };
    return names[type] || type;
  };

  const getTypeColor = (type: string) => {
    const colors: any = {
      text: 'bg-blue-500',
      image: 'bg-green-500',
      video: 'bg-purple-500',
      audio: 'bg-pink-500',
      audio_recorded: 'bg-red-500',
      document: 'bg-yellow-500',
      list: 'bg-indigo-500',
      buttons: 'bg-cyan-500',
      carousel: 'bg-orange-500'
    };
    return colors[type] || 'bg-gray-500';
  };

  // 📱 Abrir visualização mobile
  const handleMobilePreview = async (template: Template) => {
    try {
      // Buscar dados completos do template
      const response = await api.get(`/qr-templates/${template.id}`);
      
      if (response.data.success) {
        setMobilePreview(response.data.data);
        setShowMobileModal(true);
      }
    } catch (error) {
      console.error('Erro ao carregar template para preview:', error);
      alert('Erro ao carregar preview do template');
    }
  };

  // 💾 Download de template individual
  const handleDownloadTemplate = async (template: Template) => {
    try {
      // Buscar dados completos do template
      const response = await api.get(`/qr-templates/${template.id}`);
      
      if (response.data.success) {
        const templateData = response.data.data;
        
        // Criar arquivo JSON
        const dataStr = JSON.stringify(templateData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        // Download
        const url = window.URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `template_${templateData.name.replace(/[^a-z0-9]/gi, '_')}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        alert('✅ Template baixado com sucesso!');
      }
    } catch (error) {
      console.error('Erro ao baixar template:', error);
      alert('❌ Erro ao baixar template');
    }
  };

  // 💾 Download de todos os templates
  const handleDownloadAllTemplates = async () => {
    if (templates.length === 0) {
      alert('Não há templates para baixar');
      return;
    }

    try {
      setLoading(true);
      
      // Buscar todos os templates com dados completos
      const promises = templates.map(t => api.get(`/qr-templates/${t.id}`));
      const responses = await Promise.all(promises);
      
      const allTemplatesData = responses
        .filter(r => r.data.success)
        .map(r => r.data.data);
      
      // Criar arquivo JSON
      const dataStr = JSON.stringify(allTemplatesData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      
      // Download
      const url = window.URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `todos_templates_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      alert(`✅ ${allTemplatesData.length} template(s) baixado(s) com sucesso!`);
    } catch (error) {
      console.error('Erro ao baixar todos os templates:', error);
      alert('❌ Erro ao baixar templates');
    } finally {
      setLoading(false);
    }
  };

  // 📤 Upload/Importar template
  const handleUploadTemplate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const templateData = JSON.parse(text);
      
      // Verificar se é um array (múltiplos templates) ou objeto único
      const templatesArray = Array.isArray(templateData) ? templateData : [templateData];
      
      let importedCount = 0;
      let errorCount = 0;
      
      for (const tpl of templatesArray) {
        try {
          // Remover ID para criar novo
          delete tpl.id;
          delete tpl.created_at;
          delete tpl.updated_at;
          
          // Verificar se já existe template com mesmo nome
          const existingTemplate = templates.find(t => t.name === tpl.name);
          if (existingTemplate) {
            // Adicionar sufixo " (Importado)" se já existir
            tpl.name = `${tpl.name} (Importado)`;
          }
          
          // Criar template
          await api.post('/qr-templates', tpl);
          importedCount++;
        } catch (error) {
          console.error('Erro ao importar template:', error);
          errorCount++;
        }
      }
      
      // Recarregar lista
      await loadTemplates();
      
      if (errorCount === 0) {
        alert(`✅ ${importedCount} template(s) importado(s) com sucesso!`);
      } else {
        alert(`⚠️ ${importedCount} template(s) importado(s)\n❌ ${errorCount} erro(s)`);
      }
    } catch (error) {
      console.error('Erro ao processar arquivo:', error);
      alert('❌ Erro ao processar arquivo. Certifique-se de que é um JSON válido.');
    }
    
    // Limpar input
    e.target.value = '';
  };

  // Verificar se template tem variáveis e contar quantas
  const getVariablesInfo = (template: Template): { hasVariables: boolean; count: number; names: string[] } => {
    const variables = new Set<string>();
    
    // Verificar variables_map
    if (template.variables_map) {
      try {
        const varsMap = typeof template.variables_map === 'string' 
          ? JSON.parse(template.variables_map) 
          : template.variables_map;
        
        Object.keys(varsMap).forEach(key => variables.add(key));
      } catch (e) {
        // Ignorar erros de parse
      }
    }
    
    // Verificar se tem {{variavel}} no texto
    if (template.text_content) {
      const variableRegex = /\{\{([^}]+)\}\}/g;
      let match;
      while ((match = variableRegex.exec(template.text_content)) !== null) {
        variables.add(match[1].trim());
      }
    }
    
    return {
      hasVariables: variables.size > 0,
      count: variables.size,
      names: Array.from(variables)
    };
  };

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (template.description && template.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesType = filterType === 'all' || template.type === filterType;
    
    // Filtro de variáveis
    const varsInfo = getVariablesInfo(template);
    const matchesVariables = filterVariables === 'all' || 
                             (filterVariables === 'with' && varsInfo.hasVariables) ||
                             (filterVariables === 'without' && !varsInfo.hasVariables);
    
    return matchesSearch && matchesType && matchesVariables;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-20 w-20 border-b-4 border-blue-500 mb-4"></div>
          <p className="text-2xl text-white/70">Carregando templates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 py-8 px-4">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* HEADER */}
        <div className="bg-gradient-to-r from-blue-600/30 via-indigo-500/20 to-blue-600/30 backdrop-blur-xl border-2 border-blue-500/40 rounded-3xl p-8 shadow-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/dashboard-uaz')}
                className="bg-white/10 hover:bg-white/20 p-4 rounded-xl transition-all duration-200"
              >
                <FaArrowLeft className="text-2xl text-white" />
              </button>
              
              <div>
                <h1 className="text-5xl font-black text-white mb-2">
                  📋 Templates QR Connect
                </h1>
                <p className="text-xl text-white/80">
                  Gerencie seus templates de mensagens reutilizáveis
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              {templates.length > 0 && (
                <>
                  <button
                    onClick={handleDownloadAllTemplates}
                    className="flex items-center gap-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 px-8 py-4 rounded-xl text-white text-lg font-bold transition-all duration-200 shadow-lg hover:shadow-blue-500/50"
                    title="Baixar todos os templates em um arquivo JSON"
                  >
                    <FaDownload className="text-xl" />
                    Baixar Todos ({templates.length})
                  </button>
                  
                  <button
                    onClick={handleDeleteAll}
                    className="flex items-center gap-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 px-8 py-4 rounded-xl text-white text-lg font-bold transition-all duration-200 shadow-lg hover:shadow-red-500/50"
                  >
                    <FaTrash className="text-xl" />
                    Excluir Todos ({templates.length})
                  </button>
                </>
              )}
              
              <label className="flex items-center gap-3 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 px-8 py-4 rounded-xl text-white text-lg font-bold transition-all duration-200 shadow-lg hover:shadow-purple-500/50 cursor-pointer">
                <FaUpload className="text-xl" />
                Importar Template(s)
                <input
                  type="file"
                  accept=".json"
                  onChange={handleUploadTemplate}
                  className="hidden"
                />
              </label>
              
              <button
                onClick={() => router.push('/qr-templates/criar')}
                className="flex items-center gap-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 px-8 py-4 rounded-xl text-white text-lg font-bold transition-all duration-200 shadow-lg hover:shadow-green-500/50"
              >
                <FaPlus className="text-xl" />
                Criar Novo Template
              </button>
            </div>
          </div>
        </div>

        {/* FILTROS */}
        <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-6">
          <div className="grid md:grid-cols-3 gap-4">
            {/* Busca */}
            <div className="relative">
              <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 text-xl" />
              <input
                type="text"
                placeholder="Buscar templates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-dark-700 border-2 border-white/10 rounded-xl px-12 py-4 text-white placeholder-white/50 focus:outline-none focus:border-blue-500 transition-all"
              />
            </div>

            {/* Filtro por tipo */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-dark-700 border-2 border-white/10 rounded-xl px-4 py-4 text-white focus:outline-none focus:border-blue-500 transition-all"
            >
              <option value="all">📝 Todos os Tipos</option>
              <option value="text">Texto</option>
              <option value="image">Imagem</option>
              <option value="video">Vídeo</option>
              <option value="audio">Áudio</option>
              <option value="audio_recorded">Áudio Gravado</option>
              <option value="document">Documento</option>
              <option value="list">Menu Lista</option>
              <option value="buttons">Menu Botões</option>
              <option value="carousel">Carrossel</option>
            </select>

            {/* Filtro por variáveis */}
            <select
              value={filterVariables}
              onChange={(e) => setFilterVariables(e.target.value as 'all' | 'with' | 'without')}
              className="bg-dark-700 border-2 border-white/10 rounded-xl px-4 py-4 text-white focus:outline-none focus:border-blue-500 transition-all"
            >
              <option value="all">🔧 Todos (com/sem variáveis)</option>
              <option value="with">✅ Apenas com variáveis</option>
              <option value="without">❌ Apenas sem variáveis</option>
            </select>
          </div>
        </div>

        {/* CONTADOR */}
        <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <p className="text-xl text-white">
              <span className="font-bold text-blue-400">{filteredTemplates.length}</span> template(s) encontrado(s)
            </p>
            <p className="text-white/60">
              Total: {templates.length} template(s)
            </p>
          </div>
        </div>

        {/* LISTA DE TEMPLATES */}
        {filteredTemplates.length === 0 ? (
          <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-12 text-center">
            <p className="text-2xl text-white/60 mb-4">
              {searchTerm || filterType !== 'all' 
                ? 'Nenhum template encontrado com os filtros aplicados' 
                : 'Nenhum template criado ainda'}
            </p>
            <button
              onClick={() => router.push('/qr-templates/criar')}
              className="inline-flex items-center gap-2 bg-blue-500 hover:bg-blue-600 px-6 py-3 rounded-xl text-white font-bold transition-all"
            >
              <FaPlus />
              Criar Primeiro Template
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTemplates.map((template) => (
              <div
                key={template.id}
                className="bg-dark-800/60 backdrop-blur-xl border-2 border-white/10 hover:border-blue-500/50 rounded-2xl p-6 transition-all duration-200 hover:scale-105 flex flex-col h-full"
              >
                {/* Conteúdo do Card (cresce para empurrar botões para baixo) */}
                <div className="flex-1 flex flex-col">
                  {/* Badges */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {/* Badge do Tipo */}
                    <div className={`inline-flex items-center gap-2 ${getTypeColor(template.type)} px-4 py-2 rounded-lg text-white font-bold`}>
                      {getTypeIcon(template.type)}
                      {getTypeName(template.type)}
                    </div>

                    {/* Badge de Variáveis */}
                    {(() => {
                      const varsInfo = getVariablesInfo(template);
                      if (varsInfo.hasVariables) {
                        return (
                          <div 
                            className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-2 rounded-lg text-white font-bold cursor-help"
                            title={`Variáveis: ${varsInfo.names.map(v => `{{${v}}}`).join(', ')}`}
                          >
                            🔧 {varsInfo.count} Variável{varsInfo.count > 1 ? 'eis' : ''}
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>

                  {/* Nome */}
                  <h3 className="text-2xl font-bold text-white mb-2">
                    {template.name}
                  </h3>

                  {/* Descrição */}
                  {template.description && (
                    <p className="text-white/70 mb-4 line-clamp-2">
                      {template.description}
                    </p>
                  )}

                  {/* Prévia do conteúdo */}
                  {template.text_content && (
                    <div className="bg-dark-700/50 rounded-lg p-3 mb-4">
                      <p className="text-white/60 text-sm line-clamp-3">
                        {template.text_content}
                      </p>
                    </div>
                  )}

                  {/* Mídias */}
                  {template.media_files && template.media_files.length > 0 && (
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-white/60 text-sm">
                        📎 {template.media_files.length} arquivo(s)
                      </span>
                    </div>
                  )}

                  {/* Data */}
                  <p className="text-white/40 text-sm mb-4">
                    Criado em: {new Date(template.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>

                {/* Ações (sempre no final do card) */}
                <div className="space-y-3">
                  {/* Linha 1: Editar (completo) */}
                  <button
                    onClick={() => router.push(`/qr-templates/editar/${template.id}`)}
                    className="w-full flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 px-4 py-3 rounded-xl text-white font-bold transition-all"
                  >
                    <FaEdit />
                    Editar
                  </button>
                  
                  {/* Linha 2: Visualizar Mobile e Download */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleMobilePreview(template)}
                      className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 px-4 py-3 rounded-xl text-white font-bold transition-all"
                      title="Visualizar como ficaria no celular"
                    >
                      <FaMobileAlt />
                      Prévia
                    </button>
                    <button
                      onClick={() => handleDownloadTemplate(template)}
                      className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 px-4 py-3 rounded-xl text-white font-bold transition-all"
                      title="Baixar template em JSON"
                    >
                      <FaDownload />
                      Baixar
                    </button>
                  </div>
                  
                  {/* Linha 3: Clonar e Deletar */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleClone(template.id)}
                      className="flex-1 flex items-center justify-center gap-2 bg-purple-500 hover:bg-purple-600 px-4 py-3 rounded-xl text-white font-bold transition-all"
                      title="Clonar template"
                    >
                      <FaCopy />
                      Clonar
                    </button>
                    <button
                      onClick={() => handleDelete(template.id, template.name)}
                      className="flex-1 flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 px-4 py-3 rounded-xl text-white font-bold transition-all"
                    >
                      <FaTrash />
                      Deletar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* MODAL DE VISUALIZAÇÃO MOBILE */}
        {showMobileModal && mobilePreview && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-dark-800 rounded-3xl p-8 max-w-4xl w-full max-h-[90vh] overflow-auto">
              {/* Header do Modal */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-3xl font-black text-white flex items-center gap-3">
                  <FaMobileAlt className="text-green-500" />
                  Prévia Mobile: {mobilePreview.name}
                </h2>
                <button
                  onClick={() => {
                    setShowMobileModal(false);
                    setMobilePreview(null);
                  }}
                  className="bg-red-500 hover:bg-red-600 p-3 rounded-xl transition-all"
                >
                  <FaTimes className="text-white text-xl" />
                </button>
              </div>

              {/* Simulação de Celular */}
              <div className="flex justify-center">
                <div className="relative" style={{ width: '375px' }}>
                  {/* Moldura do Celular */}
                  <div className="bg-gradient-to-b from-gray-900 to-gray-800 rounded-[50px] p-4 shadow-2xl border-8 border-gray-900">
                    {/* Notch (entalhe superior) */}
                    <div className="bg-black h-6 rounded-b-3xl mx-auto w-40 mb-2"></div>
                    
                    {/* Tela do WhatsApp */}
                    <div className="bg-[#0a1014] rounded-3xl overflow-hidden" style={{ height: '667px' }}>
                      {/* Header do WhatsApp */}
                      <div className="bg-[#202c33] px-4 py-3 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center text-white font-bold">
                          ?
                        </div>
                        <div className="flex-1">
                          <p className="text-white font-semibold">Prévia do Template</p>
                          <p className="text-gray-400 text-xs">online</p>
                        </div>
                      </div>

                      {/* Área de Mensagens */}
                      <div 
                        className="p-4 overflow-y-auto" 
                        style={{ 
                          height: 'calc(667px - 56px)',
                          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 30l30-30v60z' fill='%23ffffff' fill-opacity='0.03'/%3E%3C/svg%3E")`,
                          backgroundColor: '#0a1014'
                        }}
                      >
                        {/* Bolha de Mensagem (Recebida - da empresa) */}
                        <div className="flex justify-start mb-4">
                          <div className="max-w-[80%]">
                            {/* Badge do Tipo */}
                            <div className="mb-2">
                              <span className={`inline-flex items-center gap-1 ${getTypeColor(mobilePreview.type)} px-3 py-1 rounded-full text-white text-xs font-bold`}>
                                {getTypeIcon(mobilePreview.type)}
                                {getTypeName(mobilePreview.type)}
                              </span>
                            </div>

                            <div className="bg-[#202c33] rounded-xl px-4 py-3 shadow-lg">
                              {/* Texto */}
                              {mobilePreview.text_content && (
                                <p className="text-white whitespace-pre-wrap break-words mb-2">
                                  {mobilePreview.text_content}
                                </p>
                              )}

                              {/* Menu Lista */}
                              {mobilePreview.type === 'list' && mobilePreview.list_config && (
                                <div className="mt-3 border-t border-gray-700 pt-3">
                                  <button className="w-full bg-[#00a884] text-white px-4 py-2 rounded-lg font-semibold flex items-center justify-between">
                                    <span>{(mobilePreview.list_config as any)?.buttonText || 'Ver opções'}</span>
                                    <span>▼</span>
                                  </button>
                                  <div className="mt-2 text-xs text-gray-400">
                                    {(mobilePreview.list_config as any)?.sections?.length || 0} seção(ões)
                                  </div>
                                </div>
                              )}

                              {/* Menu Botões */}
                              {mobilePreview.type === 'buttons' && mobilePreview.buttons_config && (
                                <div className="mt-3 space-y-2">
                                  {((mobilePreview.buttons_config as any)?.buttons || []).map((btn: any, idx: number) => (
                                    <button
                                      key={idx}
                                      className="w-full bg-[#1f2c34] hover:bg-[#2a3942] text-[#00a884] px-4 py-2 rounded-lg font-semibold border border-[#00a884]"
                                    >
                                      {btn.text}
                                    </button>
                                  ))}
                                </div>
                              )}

                              {/* Carrossel */}
                              {mobilePreview.type === 'carousel' && mobilePreview.carousel_config && (
                                <div className="mt-3 text-xs text-gray-400">
                                  🎠 {((mobilePreview.carousel_config as any)?.cards || []).length} card(s)
                                </div>
                              )}

                              {/* Mídia */}
                              {mobilePreview.media_files && mobilePreview.media_files.length > 0 && (
                                <div className="mt-3 text-xs text-gray-400">
                                  📎 {mobilePreview.media_files.length} arquivo(s) anexado(s)
                                </div>
                              )}

                              {/* Hora */}
                              <p className="text-gray-500 text-xs text-right mt-2">
                                {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Botão Home (círculo inferior) */}
                  <div className="flex justify-center mt-2">
                    <div className="w-32 h-1 bg-gray-700 rounded-full"></div>
                  </div>
                </div>
              </div>

              {/* Informações Adicionais */}
              <div className="mt-6 bg-dark-700 rounded-xl p-4">
                <h3 className="text-white font-bold mb-2">ℹ️ Informações do Template</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-400">Nome:</p>
                    <p className="text-white font-semibold">{mobilePreview.name}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Tipo:</p>
                    <p className="text-white font-semibold">{getTypeName(mobilePreview.type)}</p>
                  </div>
                  {mobilePreview.description && (
                    <div className="col-span-2">
                      <p className="text-gray-400">Descrição:</p>
                      <p className="text-white">{mobilePreview.description}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}



