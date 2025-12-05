import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { 
  FaPaperPlane, FaSearch, FaTimes, FaRocket, FaPhone, FaCheckCircle,
  FaImage, FaVideo, FaMusic, FaFileAlt, FaBolt, FaExclamationTriangle, FaMobileAlt, FaCopy
} from 'react-icons/fa';
import { whatsappAccountsAPI, messagesAPI } from '@/services/api';
import MediaUpload from '@/components/MediaUpload';
import { useNotifications } from '@/contexts/NotificationContext';
import TemplatePreview from '@/components/TemplatePreview';

interface WhatsAppAccount {
  id: number;
  name: string;
  phone_number: string;
  is_active: boolean;
}

interface Template {
  name: string;
  status: string;
  language: string;
  category: string;
  components: any[];
}

export default function EnviarMensagemImediataV2() {
  const router = useRouter();
  const notify = useNotifications();
  const [accounts, setAccounts] = useState<WhatsAppAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number>(0);
  const [phoneNumber, setPhoneNumber] = useState('55');
  const [showPrefix, setShowPrefix] = useState(true);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [excludeQuery, setExcludeQuery] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [variables, setVariables] = useState<Record<string, string>>({});
  
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  
  // Rastrear templates enviados por conta
  const [sentTemplates, setSentTemplates] = useState<Record<number, Record<string, number>>>({});
  const [hideSentTemplates, setHideSentTemplates] = useState(true);

  useEffect(() => {
    loadAccounts();
  }, []);

  useEffect(() => {
    filterTemplates();
  }, [templates, searchQuery, excludeQuery]);

  const loadAccounts = async () => {
    try {
      // 🔧 Carregar APENAS contas de API Oficial (não QR Connect)
      const response = await whatsappAccountsAPI.getActive('api');
      setAccounts(response.data.data);
      
      if (response.data.data.length > 0) {
        setSelectedAccountId(response.data.data[0].id);
        loadTemplates(response.data.data[0].id);
      }
    } catch (error) {
      console.error('Erro ao carregar contas:', error);
    }
  };

  const loadTemplates = async (accountId: number) => {
    setLoadingTemplates(true);
    
    try {
      const response = await whatsappAccountsAPI.getTemplates(accountId);
      if (response.data.success) {
        const approvedTemplates = response.data.templates.filter((t: Template) => t.status === 'APPROVED');
        setTemplates(approvedTemplates);
        setFilteredTemplates(approvedTemplates);
      }
    } catch (error) {
      console.error('Erro ao carregar templates:', error);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const filterTemplates = () => {
    let filtered = [...templates];

    if (searchQuery.trim()) {
      filtered = filtered.filter(t => 
        t.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (excludeQuery.trim()) {
      filtered = filtered.filter(t => 
        !t.name.toLowerCase().includes(excludeQuery.toLowerCase())
      );
    }

    setFilteredTemplates(filtered);
  };

  const handleAccountChange = (accountId: number) => {
    setSelectedAccountId(accountId);
    setSelectedTemplate(null);
    setMediaUrl('');
    setMediaType('');
    setVariables({});
    loadTemplates(accountId);
  };

  const markTemplateAsSent = (accountId: number, templateName: string) => {
    setSentTemplates(prev => {
      const accountTemplates = prev[accountId] || {};
      const currentCount = accountTemplates[templateName] || 0;
      
      return {
        ...prev,
        [accountId]: {
          ...accountTemplates,
          [templateName]: currentCount + 1,
        },
      };
    });
  };

  const isTemplateSent = (templateName: string): boolean => {
    const accountTemplates = sentTemplates[selectedAccountId];
    return accountTemplates && accountTemplates[templateName] > 0;
  };

  const getSentCount = (templateName: string): number => {
    const accountTemplates = sentTemplates[selectedAccountId];
    return accountTemplates?.[templateName] || 0;
  };

  const clearSentMarks = () => {
    setSentTemplates(prev => ({
      ...prev,
      [selectedAccountId]: {},
    }));
  };

  const extractVariablesFromTemplate = (template: Template): string[] => {
    const variables: string[] = [];
    
    template.components.forEach((component: any) => {
      if (component.type === 'BODY' && component.text) {
        const matches = component.text.match(/\{\{(\d+)\}\}/g);
        if (matches) {
          matches.forEach((match: string) => {
            const varNum = match.replace(/[{}]/g, '');
            if (!variables.includes(varNum)) {
              variables.push(varNum);
            }
          });
        }
      }
    });
    
    return variables.sort();
  };

  const handleTemplateSelect = (template: Template) => {
    console.log('🎯 Template selecionado:', template.name);
    
    setSelectedTemplate(template);
    
    // Limpar mídia anterior quando troca de template
    setMediaUrl('');
    setMediaType('');
    console.log('🧹 Mídia limpa ao trocar de template');
    
    const templateVars = extractVariablesFromTemplate(template);
    const newVariables: Record<string, string> = {};
    templateVars.forEach(varNum => {
      newVariables[varNum] = '';
    });
    setVariables(newVariables);
  };

  const handlePreviewTemplate = (template: Template, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent template selection
    setPreviewTemplate(template);
    setShowPreview(true);
  };

  const parseTemplateForPreview = (template: Template) => {
    const headerComp = template.components?.find((c: any) => c.type === 'HEADER');
    const bodyComp = template.components?.find((c: any) => c.type === 'BODY');
    const footerComp = template.components?.find((c: any) => c.type === 'FOOTER');
    const buttonsComp = template.components?.find((c: any) => c.type === 'BUTTONS');

    return {
      name: template.name,
      category: template.category,
      header_type: headerComp?.format,
      header_text: headerComp?.text,
      body_text: bodyComp?.text || '',
      footer_text: footerComp?.text,
      buttons: buttonsComp?.buttons?.map((btn: any) => ({
        type: btn.type,
        text: btn.text,
        url: btn.url,
        phone_number: btn.phone_number,
      })) || [],
    };
  };

  const handleMediaUpload = (data: any) => {
    console.log('📎 handleMediaUpload chamado:', data);
    
    // ✅ CORRIGIDO: Backend retorna "mimetype" não "mime_type"
    const mimeType = data.mimetype || data.mime_type || '';
    console.log('   mimetype recebido:', mimeType);
    
    const type = mimeType.startsWith('image/') ? 'image' 
                : mimeType.startsWith('video/') ? 'video' 
                : mimeType.startsWith('audio/') ? 'audio' 
                : 'document';
    
    // Remove /api do final da URL base para uploads de mídia
    const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace(/\/api$/, '');
    const finalUrl = data.url.startsWith('http') 
      ? data.url 
      : `${apiBaseUrl}${data.url}`;
    
    console.log('✅ Setando mediaUrl:', finalUrl);
    console.log('✅ Setando mediaType:', type);
    
    setMediaUrl(finalUrl);
    setMediaType(type);
    
    // Notificação de sucesso
    notify.success(
      'Mídia carregada!',
      `${type.toUpperCase()} carregado com sucesso e pronto para envio.`,
      3000
    );
  };

  const hasMediaHeader = (template: Template | null): boolean => {
    if (!template) return false;
    
    return template.components.some((c: any) => 
      c.type === 'HEADER' && 
      (c.format === 'IMAGE' || c.format === 'VIDEO' || c.format === 'DOCUMENT' || c.format === 'AUDIO')
    );
  };

  const getMediaHeaderType = (template: Template | null): string => {
    if (!template) return '';
    
    const headerComponent = template.components.find((c: any) => 
      c.type === 'HEADER' && 
      (c.format === 'IMAGE' || c.format === 'VIDEO' || c.format === 'DOCUMENT' || c.format === 'AUDIO')
    );
    
    return headerComponent?.format?.toLowerCase() || '';
  };

  const hasVariables = (template: Template) => {
    return template.components.some((c: any) => 
      c.type === 'BODY' && c.text && c.text.includes('{{')
    );
  };

  // Funções para modelos rápidos de variáveis
  const getGreeting = (): string => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) return 'Bom dia';
    if (hour >= 12 && hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const generateProtocol = (): string => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  const addToVariable = (varNum: string, value: string) => {
    const currentValue = variables[varNum] || '';
    const newValue = currentValue.trim() 
      ? `${currentValue} ${value}` 
      : value;
    
    setVariables({
      ...variables,
      [varNum]: newValue
    });
  };

  const handleQuickFill = (varNum: string, type: 'greeting' | 'protocol' | 'protocolNumber') => {
    switch (type) {
      case 'greeting':
        addToVariable(varNum, getGreeting());
        break;
      case 'protocol':
        const protocolNum = generateProtocol();
        addToVariable(varNum, `Seu Numero de Protocolo e :${protocolNum}!`);
        break;
      case 'protocolNumber':
        addToVariable(varNum, generateProtocol());
        break;
    }
  };

  const getCategoryInfo = (category: string) => {
    const categories: Record<string, { label: string; color: string; emoji: string }> = {
      UTILITY: { label: 'UTILITÁRIO', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30', emoji: '🔧' },
      MARKETING: { label: 'MARKETING', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30', emoji: '📢' },
      AUTHENTICATION: { label: 'AUTENTICAÇÃO', color: 'bg-green-500/20 text-green-300 border-green-500/30', emoji: '🔐' },
    };
    return categories[category] || { label: category, color: 'bg-gray-500/20 text-gray-300 border-gray-500/30', emoji: '📝' };
  };

  const getMediaInfo = (template: Template) => {
    const headerComponent = template.components.find((c: any) => 
      c.type === 'HEADER' && 
      (c.format === 'IMAGE' || c.format === 'VIDEO' || c.format === 'DOCUMENT' || c.format === 'AUDIO')
    );
    
    if (!headerComponent) return null;

    const mediaTypes: Record<string, { label: string; emoji: string; color: string }> = {
      IMAGE: { label: 'IMAGEM', emoji: '🖼️', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' },
      VIDEO: { label: 'VÍDEO', emoji: '🎥', color: 'bg-pink-500/20 text-pink-300 border-pink-500/30' },
      AUDIO: { label: 'ÁUDIO', emoji: '🎵', color: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
      DOCUMENT: { label: 'DOCUMENTO', emoji: '📄', color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
    };

    return mediaTypes[headerComponent.format] || null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedTemplate) {
      notify.warning('Template não selecionado', 'Por favor, selecione um template antes de enviar.');
      return;
    }

    const requiredVars = Object.keys(variables);
    if (requiredVars.length > 0) {
      const emptyVars = requiredVars.filter(varNum => !variables[varNum].trim());
      if (emptyVars.length > 0) {
        notify.warning(
          'Variáveis obrigatórias',
          `Por favor, preencha todas as variáveis obrigatórias:\n${emptyVars.join(', ')}`
        );
        return;
      }
    }

    // Verificar se o template requer mídia
    const templateComponents = selectedTemplate.components || [];
    const headerComponent = templateComponents.find((c: any) => c.type === 'HEADER');
    
    console.log('🔍 Verificando mídia obrigatória...');
    console.log('   headerComponent:', headerComponent);
    console.log('   mediaUrl atual:', mediaUrl);
    console.log('   mediaType atual:', mediaType);
    
    if (headerComponent) {
      const headerFormat = headerComponent.format;
      console.log('   headerFormat esperado:', headerFormat);
      
      if (headerFormat === 'IMAGE' && (!mediaUrl || !mediaUrl.trim())) {
        console.log('❌ Validação falhou: IMAGE esperado mas mediaUrl está vazio');
        notify.error(
          'Imagem obrigatória!',
          `Este template requer uma IMAGEM.\n\nFaça upload de uma imagem antes de enviar.`,
          8000
        );
        return;
      }
      
      if (headerFormat === 'VIDEO' && (!mediaUrl || !mediaUrl.trim())) {
        console.log('❌ Validação falhou: VIDEO esperado mas mediaUrl está vazio');
        notify.error(
          'Vídeo obrigatório!',
          `Este template requer um VÍDEO.\n\nFaça upload de um vídeo antes de enviar.`,
          8000
        );
        return;
      }
      
      if (headerFormat === 'DOCUMENT' && (!mediaUrl || !mediaUrl.trim())) {
        console.log('❌ Validação falhou: DOCUMENT esperado mas mediaUrl está vazio');
        notify.error(
          'Documento obrigatório!',
          `Este template requer um DOCUMENTO.\n\nFaça upload de um arquivo antes de enviar.`,
          8000
        );
        return;
      }
      
      console.log('✅ Validação de mídia passou!');
    }

    setLoading(true);

    try {
      // 🚨 VERIFICAR SE O NÚMERO ESTÁ NA LISTA DE RESTRIÇÃO (FRONTEND + BACKEND)
      console.log('🔍 Verificando restrições para:', phoneNumber);
      
      try {
        const restrictionCheck = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/restriction-lists/check-bulk`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('@WhatsAppDispatcher:token')}`,
          },
          body: JSON.stringify({
            phone_numbers: [phoneNumber],
            whatsapp_account_ids: [selectedAccountId],
          }),
        });

        if (!restrictionCheck.ok) {
          // ❌ ERRO NA API DE VERIFICAÇÃO - BLOQUEAR POR SEGURANÇA
          console.error('❌ Erro ao verificar restrições:', restrictionCheck.status);
          notify.error(
            'Erro ao verificar restrições!',
            'Não foi possível verificar se o número está bloqueado.\n\nPor segurança, o envio foi cancelado.',
            8000
          );
          setLoading(false);
          return; // ❌ BLOQUEAR ENVIO
        }
        
        const restrictionResult = await restrictionCheck.json();
        
        if (restrictionResult.restricted_count > 0) {
          // ❌ NÚMERO RESTRITO - NÃO ENVIAR!
          const detail = restrictionResult.restricted_details[0];
          const listNames = detail.list_names?.join(', ') || 'Lista de Restrição';
          const types = detail.types?.join(', ') || detail.lists?.join(', ') || 'restrito';
          
          console.log('🚫 Número restrito encontrado:', detail);
          console.log('   Listas:', listNames);
          console.log('   Tipos:', types);
          console.log('   Número encontrado no banco:', detail.phone_number_found);
          console.log('   Nome do contato:', detail.contact_name);
          
          let message = `Este contato está na Lista de Restrição!\n\n📝 Lista(s): ${listNames}\n🏷️  Tipo(s): ${types}`;
          
          if (detail.contact_name && detail.contact_name !== detail.phone_number) {
            message += `\n👤 Nome: ${detail.contact_name}`;
          }
          
          if (detail.phone_number_found && detail.phone_number_found !== detail.phone_number) {
            message += `\n📞 Encontrado como: ${detail.phone_number_found}`;
          }
          
          message += `\n\n❌ A mensagem NÃO foi enviada.`;
          
          notify.error(
            '🚫 Número bloqueado!',
            message,
            12000
          );
          
          setLoading(false);
          return; // ❌ BLOQUEAR ENVIO
        }
        
        console.log('✅ Número livre para envio');
      } catch (error: any) {
        // ❌ ERRO DE REDE OU TIMEOUT - BLOQUEAR POR SEGURANÇA
        console.error('❌ Exceção ao verificar restrições:', error);
        console.error('   Detalhes completos:', {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status
        });
        
        notify.error(
          'Erro ao verificar restrições!',
          `Não foi possível consultar a lista de restrições.\n\n⚠️ Erro: ${error.response?.data?.error || error.message}\n\nPor segurança, o envio foi cancelado.`,
          10000
        );
        setLoading(false);
        return; // ❌ BLOQUEAR ENVIO
      }

      const data = {
        whatsapp_account_id: selectedAccountId,
        phone_number: phoneNumber,
        template_name: selectedTemplate.name,
        variables: variables,
        media_url: mediaUrl,
        media_type: mediaType,
      };

      console.log('📤 Enviando dados para o backend:');
      console.log('   whatsapp_account_id:', data.whatsapp_account_id);
      console.log('   phone_number:', data.phone_number);
      console.log('   template_name:', data.template_name);
      console.log('   variables:', data.variables);
      console.log('   media_url:', data.media_url);
      console.log('   media_type:', data.media_type);
      console.log('   media_url está vazio?', !data.media_url || data.media_url === '');

      const response = await messagesAPI.sendImmediate(data);
      
      if (response.data.success) {
        markTemplateAsSent(selectedAccountId, selectedTemplate.name);
        
        notify.success(
          'Mensagem enviada!',
          'Mensagem enviada com sucesso!\n\nTemplate marcado como enviado. Continue enviando para outros números!',
          6000
        );
        
        setPhoneNumber('');
        setMediaUrl('');
        setMediaType('');
      }
    } catch (error: any) {
      console.error('❌ Erro ao enviar:', error);
      
      // Verificar se é erro de restrição (403)
      if (error.response?.status === 403 && error.response?.data?.restricted) {
        const details = error.response.data.details;
        const lists = details?.lists || details?.list_names?.join?.(', ') || 'Lista de Restrição';
        const types = details?.types?.join?.(', ') || 'restrito';
        const contactName = details?.contact_name || '';
        
        console.log('🚫 Bloqueio detectado pelo backend!');
        console.log('   Detalhes completos:', details);
        console.log('   Listas:', lists);
        console.log('   Tipos:', types);
        
        let message = `Este número está na Lista de Restrição!\n\n📝 Lista(s): ${lists}\n🏷️  Tipo(s): ${types}`;
        
        if (contactName && contactName !== details.phone) {
          message += `\n👤 Nome: ${contactName}`;
        }
        
        message += `\n\n❌ A mensagem NÃO foi enviada.`;
        
        notify.error(
          '🚫 Número bloqueado!',
          message,
          10000
        );
      } else {
        // Outros erros
        notify.error(
          'Erro ao enviar mensagem',
          error.response?.data?.error || error.message || 'Não foi possível enviar a mensagem. Tente novamente.',
          7000
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Envio Rápido | Disparador NettSistemas</title>
      </Head>
      
      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 py-8 px-4">
        <div className="max-w-7xl mx-auto space-y-8">
          
          {/* 🎨 CABEÇALHO PRINCIPAL - MUITO MAIS VISUAL */}
          <div className="relative overflow-hidden bg-gradient-to-r from-blue-600/30 via-blue-500/20 to-blue-600/30 backdrop-blur-xl border-2 border-blue-500/40 rounded-3xl p-10 shadow-2xl shadow-blue-500/20">
            <div className="absolute inset-0 bg-grid-white/[0.02]"></div>
            <div className="relative">
              <div className="flex items-center gap-6 mb-4">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-2xl shadow-lg shadow-blue-500/50">
                  <FaBolt className="text-5xl text-white" />
                </div>
                <div>
                  <h1 className="text-5xl font-black text-white mb-2 tracking-tight">
                    Envio Rápido
                  </h1>
                  <p className="text-xl text-white/80 font-medium">
                    Envie mensagens individuais instantaneamente para seus clientes
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Layout 2 Colunas */}
          <div className="grid grid-cols-12 gap-8">
            
            {/* COLUNA ESQUERDA - Formulário */}
            <div className="col-span-12 lg:col-span-5 space-y-6">
              
              <form onSubmit={handleSubmit} className="space-y-6">
                
                {/* Informações Básicas */}
                <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-primary-500/30 rounded-2xl p-8 shadow-xl hover:border-primary-500/50 transition-all duration-300">
                  <h2 className="text-2xl font-black text-white mb-6 flex items-center gap-3">
                    <div className="bg-primary-500/20 p-3 rounded-xl">
                      <FaPhone className="text-2xl text-primary-400" />
                    </div>
                    Informações Básicas
                  </h2>
                  
                  <div className="space-y-5">
                    <div>
                      <label className="block text-lg font-bold mb-3 text-white/90">
                        Número de Origem *
                      </label>
                      <select
                        required
                        className="w-full px-6 py-4 text-lg bg-dark-700/80 backdrop-blur-md border-2 border-white/20 rounded-xl text-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/30 transition-all duration-200"
                        value={selectedAccountId}
                        onChange={(e) => handleAccountChange(parseInt(e.target.value))}
                      >
                        <option value={0}>Selecione uma conta</option>
                        {accounts.map(account => (
                          <option key={account.id} value={account.id}>
                            {account.name} - {account.phone_number}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-lg font-bold mb-3 text-white/90">
                        Número do Destinatário *
                      </label>
                      <div className="flex items-center gap-0">
                        {showPrefix && (
                          <div className="flex items-center bg-green-600/30 border-2 border-green-500/50 rounded-l-xl px-4 py-4">
                            <span className="text-white text-lg font-bold font-mono">+55</span>
                            <button
                              type="button"
                              onClick={() => {
                                setShowPrefix(false);
                                setPhoneNumber('');
                              }}
                              className="ml-2 text-red-400 hover:text-red-300 transition-colors"
                              title="Remover prefixo +55"
                            >
                              <FaTimes className="text-sm" />
                            </button>
                          </div>
                        )}
                        <input
                          type="text"
                          required
                          className={`flex-1 px-6 py-4 text-lg bg-dark-700/80 backdrop-blur-md border-2 border-white/20 ${
                            showPrefix ? 'rounded-r-xl border-l-0' : 'rounded-xl'
                          } text-white placeholder-white/40 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/30 transition-all duration-200 font-mono`}
                          placeholder={showPrefix ? "62912345678" : "5562912345678"}
                          value={showPrefix ? phoneNumber.replace(/^55/, '') : phoneNumber}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, ''); // Apenas números
                            if (showPrefix) {
                              setPhoneNumber('55' + value);
                            } else {
                              setPhoneNumber(value);
                            }
                          }}
                          onPaste={(e) => {
                            const pastedText = e.clipboardData.getData('text');
                            const cleanedText = pastedText.replace(/\D/g, ''); // Remove tudo que não é dígito
                            e.preventDefault(); // Previne a colagem padrão
                            if (showPrefix) {
                              setPhoneNumber('55' + cleanedText);
                            } else {
                              setPhoneNumber(cleanedText);
                            }
                          }}
                        />
                      </div>
                      {!showPrefix && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowPrefix(true);
                            if (!phoneNumber.startsWith('55')) {
                              setPhoneNumber('55' + phoneNumber);
                            }
                          }}
                          className="mt-2 text-sm text-green-400 hover:text-green-300 underline"
                        >
                          + Adicionar prefixo +55
                        </button>
                      )}
                      <p className="text-sm text-white/60 mt-3 flex items-center gap-2">
                        <span>💡</span>
                        <span>Digite apenas DDD + número (sem espaços, traços ou parênteses)</span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Variáveis do Template */}
                {selectedTemplate && Object.keys(variables).length > 0 && (
                  <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-primary-500/30 rounded-2xl p-8 shadow-xl hover:border-primary-500/50 transition-all duration-300">
                    <h2 className="text-2xl font-black text-white mb-6 flex items-center gap-3">
                      <div className="bg-primary-500/20 p-3 rounded-xl">
                        <span className="text-2xl">🔤</span>
                      </div>
                      Variáveis do Template
                    </h2>
                    
                    <div className="space-y-5">
                      {Object.keys(variables).sort().map((varNum) => (
                        <div key={varNum}>
                          <label className="block text-base font-bold mb-3 text-white/90">
                            Variável {varNum} *
                          </label>
                          <input
                            type="text"
                            required
                            className="w-full px-4 py-3 text-base bg-dark-700/80 border-2 border-white/20 rounded-xl text-white placeholder-white/40 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30 transition-all"
                            placeholder={`Digite o valor para {{${varNum}}}`}
                            value={variables[varNum]}
                            onChange={(e) => setVariables({
                              ...variables,
                              [varNum]: e.target.value
                            })}
                          />
                          
                          {/* Botões de Preenchimento Rápido */}
                          <div className="mt-3">
                            <p className="text-sm text-white/60 mb-2 font-medium">💡 Preencher com modelo:</p>
                            <div className="flex gap-2 flex-wrap">
                              <button
                                type="button"
                                onClick={() => handleQuickFill(varNum, 'greeting')}
                                className="px-4 py-2 text-sm font-bold rounded-lg bg-blue-500/20 text-blue-300 border-2 border-blue-500/30 hover:bg-blue-500/30 hover:scale-105 transition-all duration-200"
                                title="Adiciona saudação automática (Bom dia/Boa tarde/Boa noite)"
                              >
                                👋 Saudação
                              </button>
                              
                              <button
                                type="button"
                                onClick={() => handleQuickFill(varNum, 'protocol')}
                                className="px-4 py-2 text-sm font-bold rounded-lg bg-purple-500/20 text-purple-300 border-2 border-purple-500/30 hover:bg-purple-500/30 hover:scale-105 transition-all duration-200"
                                title="Adiciona: Seu Numero de Protocolo e :[número]!"
                              >
                                📋 Protocolo
                              </button>
                              
                              <button
                                type="button"
                                onClick={() => handleQuickFill(varNum, 'protocolNumber')}
                                className="px-4 py-2 text-sm font-bold rounded-lg bg-green-500/20 text-green-300 border-2 border-green-500/30 hover:bg-green-500/30 hover:scale-105 transition-all duration-200"
                                title="Adiciona apenas o número do protocolo"
                              >
                                🔢 Nº Protocolo
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Mídia */}
                {hasMediaHeader(selectedTemplate) && (
                  <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-cyan-500/30 rounded-2xl p-8 shadow-xl hover:border-cyan-500/50 transition-all duration-300">
                    <h2 className="text-2xl font-black text-white mb-6 flex items-center gap-3">
                      <div className="bg-cyan-500/20 p-3 rounded-xl">
                        <FaImage className="text-2xl text-cyan-400" />
                      </div>
                      Mídia ({getMediaHeaderType(selectedTemplate).toUpperCase()})
                    </h2>
                    
                    <div className="p-4 bg-cyan-500/10 border-2 border-cyan-500/30 rounded-xl mb-4">
                      <p className="text-base text-cyan-300 font-medium">
                        Este template requer mídia do tipo: <span className="font-black">{getMediaHeaderType(selectedTemplate).toUpperCase()}</span>
                      </p>
                    </div>
                    
                    <MediaUpload onUploadSuccess={handleMediaUpload} />
                  </div>
                )}

                {/* Botão Enviar */}
                <button
                  type="submit"
                  disabled={loading || !selectedTemplate}
                  className="w-full flex items-center justify-center gap-3 px-8 py-6 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white text-2xl font-black rounded-2xl transition-all duration-200 shadow-xl shadow-green-500/40 hover:shadow-green-500/60 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  <FaRocket className="text-3xl" />
                  {loading ? 'Enviando...' : 'Enviar Agora'}
                </button>

                {/* Resumo */}
                {selectedTemplate && (
                  <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-primary-500/30 rounded-2xl p-6 shadow-xl">
                    <h3 className="text-lg font-black mb-4 text-primary-300 flex items-center gap-2">
                      <FaCheckCircle />
                      Resumo do Envio
                    </h3>
                    <div className="space-y-2 text-base text-white/80">
                      <p><strong className="text-white">Conta:</strong> {accounts.find(a => a.id === selectedAccountId)?.phone_number}</p>
                      <p><strong className="text-white">Destino:</strong> {phoneNumber || '(não preenchido)'}</p>
                      <p><strong className="text-white">Template:</strong> {selectedTemplate.name}</p>
                      {Object.keys(variables).length > 0 && (
                        <div>
                          <strong className="text-white">Variáveis:</strong>
                          {Object.keys(variables).map(v => (
                            <div key={v} className="ml-4 text-sm">• {v}: {variables[v] || '(vazio)'}</div>
                          ))}
                        </div>
                      )}
                      {mediaUrl && <p><strong className="text-white">Mídia:</strong> ✅ Anexada</p>}
                    </div>
                  </div>
                )}
              </form>
              
            </div>

            {/* COLUNA DIREITA - Templates */}
            <div className="col-span-12 lg:col-span-7">
              <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-primary-500/30 rounded-2xl p-8 shadow-xl hover:border-primary-500/50 transition-all duration-300 h-full">
                <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
                  <h2 className="text-2xl font-black text-white flex items-center gap-3">
                    <div className="bg-primary-500/20 p-3 rounded-xl">
                      <FaPaperPlane className="text-2xl text-primary-400" />
                    </div>
                    Selecionar Template
                  </h2>
                  
                  {Object.keys(sentTemplates[selectedAccountId] || {}).length > 0 && (
                    <button
                      type="button"
                      onClick={clearSentMarks}
                      className="px-6 py-3 bg-dark-700 hover:bg-dark-600 text-white font-bold rounded-xl transition-all duration-200 border-2 border-white/20 hover:border-white/40"
                    >
                      🔄 Limpar ({Object.keys(sentTemplates[selectedAccountId] || {}).length})
                    </button>
                  )}
                </div>

                {/* Filtros */}
                <div className="grid md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <input
                      type="text"
                      className="w-full px-4 py-3 text-base bg-dark-700/80 border-2 border-white/20 rounded-xl text-white placeholder-white/40 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30 transition-all"
                      placeholder="🔍 Buscar template..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>

                  <div>
                    <input
                      type="text"
                      className="w-full px-4 py-3 text-base bg-dark-700/80 border-2 border-white/20 rounded-xl text-white placeholder-white/40 focus:border-red-500 focus:ring-2 focus:ring-red-500/30 transition-all"
                      placeholder="❌ Excluir que contenham..."
                      value={excludeQuery}
                      onChange={(e) => setExcludeQuery(e.target.value)}
                    />
                  </div>
                </div>

                {/* Checkbox Ocultar */}
                {Object.keys(sentTemplates[selectedAccountId] || {}).length > 0 && (
                  <div className="mb-6 p-4 bg-dark-700/50 rounded-xl border-2 border-white/10">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hideSentTemplates}
                        onChange={(e) => setHideSentTemplates(e.target.checked)}
                        className="w-6 h-6 rounded-lg border-2 border-white/30 bg-dark-900 checked:bg-primary-500 checked:border-primary-500 cursor-pointer focus:ring-4 focus:ring-primary-500/30"
                      />
                      <span className="text-base font-bold text-white">
                        👁️ Ocultar templates enviados ({Object.keys(sentTemplates[selectedAccountId] || {}).length})
                      </span>
                    </label>
                  </div>
                )}

                {/* Lista de Templates - Com scroll vertical fixo */}
                <div className="overflow-y-auto max-h-[700px] pr-2 custom-scrollbar">
                  {loadingTemplates ? (
                    <div className="text-center py-20">
                      <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-4 border-primary-500 mb-4"></div>
                      <p className="text-xl text-white/70">Carregando templates...</p>
                    </div>
                  ) : filteredTemplates.length === 0 ? (
                    <div className="text-center py-20 text-white/50">
                      <FaExclamationTriangle className="text-5xl mx-auto mb-4" />
                      <p className="text-xl">Nenhum template disponível</p>
                    </div>
                  ) : (
                    <div className="grid md:grid-cols-2 gap-4">
                      {filteredTemplates
                        .filter(template => {
                          if (hideSentTemplates) {
                            return !isTemplateSent(template.name);
                          }
                          return true;
                        })
                        .map((template, index) => {
                          const isSent = isTemplateSent(template.name);
                          const sentCount = getSentCount(template.name);
                          const categoryInfo = getCategoryInfo(template.category);
                          const mediaInfo = getMediaInfo(template);
                          
                          return (
                            <div
                              key={index}
                              className={`group p-5 rounded-xl border-2 cursor-pointer transition-all duration-200 relative min-h-[150px] ${
                                isSent 
                                  ? 'border-green-500/50 bg-gradient-to-br from-green-500/20 to-green-600/10 hover:border-green-500'
                                  : selectedTemplate?.name === template.name
                                  ? 'border-primary-500 bg-gradient-to-br from-primary-500/30 to-primary-600/20 shadow-lg shadow-primary-500/30'
                                  : 'border-white/10 bg-dark-700/50 hover:border-primary-500/50 hover:bg-dark-700/80'
                              }`}
                            >
                              <div onClick={() => handleTemplateSelect(template)}>
                                <div className="flex items-start gap-3">
                                  <div className={`${isSent ? 'bg-green-500/20' : 'bg-primary-500/20'} p-3 rounded-xl flex-shrink-0`}>
                                    <FaPaperPlane className={`text-xl ${isSent ? 'text-green-400' : 'text-primary-400'}`} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-2 pr-12">
                                      <h3 className="font-bold text-base text-white leading-tight break-all whitespace-normal w-full">
                                        {template.name}
                                      </h3>
                                      {isSent && <span className="text-green-400 text-xl">✓</span>}
                                    </div>
                                  
                                  {/* Badges de Informações */}
                                  <div className="flex gap-2 flex-wrap">
                                    {/* Status de Envio */}
                                    {isSent && (
                                      <span className="px-3 py-1 rounded-lg text-xs font-bold border bg-green-500/20 text-green-300 border-green-500/30">
                                        ✓ ENVIADO {sentCount}x
                                      </span>
                                    )}
                                    
                                    {/* Categoria */}
                                    <span className={`px-3 py-1 rounded-lg text-xs font-bold border ${categoryInfo.color}`}>
                                      {categoryInfo.emoji} {categoryInfo.label}
                                    </span>
                                    
                                    {/* Variáveis */}
                                    {hasVariables(template) && (
                                      <span className="px-3 py-1 rounded-lg text-xs font-bold border bg-indigo-500/20 text-indigo-300 border-indigo-500/30">
                                        🔤 VAR
                                      </span>
                                    )}
                                    
                                    {/* Tipo de Mídia */}
                                    {mediaInfo && (
                                      <span className={`px-3 py-1 rounded-lg text-xs font-bold border ${mediaInfo.color}`}>
                                        {mediaInfo.emoji} {mediaInfo.label}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              </div>
                              
                              {/* Botão de Preview */}
                              <button
                                onClick={(e) => handlePreviewTemplate(template, e)}
                                className="absolute top-4 right-4 p-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border-2 border-purple-500/40 rounded-lg transition-all duration-200 z-10"
                                title="Visualizar template"
                              >
                                <FaMobileAlt className="text-base" />
                              </button>
                              
                              {/* Indicador de Selecionado */}
                              {selectedTemplate?.name === template.name && (
                                <div className="mt-3 text-sm text-primary-300 font-bold flex items-center gap-2">
                                  <FaCheckCircle />
                                  Template selecionado
                                </div>
                              )}
                            </div>
                          );
                      })}
                      
                      {hideSentTemplates && 
                       filteredTemplates.filter(t => !isTemplateSent(t.name)).length === 0 && (
                        <div className="col-span-2 text-center py-20">
                          <div className="text-6xl mb-4">🎉</div>
                          <p className="text-2xl font-bold text-green-400 mb-3">
                            Todos os templates foram enviados!
                          </p>
                          <button
                            type="button"
                            onClick={() => setHideSentTemplates(false)}
                            className="px-8 py-4 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white font-bold rounded-xl transition-all duration-200 shadow-lg shadow-primary-500/40 hover:shadow-primary-500/60 transform hover:scale-105"
                          >
                            👁️ Mostrar Todos
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Contador */}
                {filteredTemplates.length > 0 && (
                  <div className="mt-6 text-base text-white/60 text-center border-t-2 border-white/10 pt-6">
                    {hideSentTemplates ? (
                      <>
                        Mostrando <strong className="text-white">{filteredTemplates.filter(t => !isTemplateSent(t.name)).length}</strong> de <strong className="text-white">{filteredTemplates.length}</strong> templates 
                        <span className="text-green-400 ml-2 font-bold">
                          ({Object.keys(sentTemplates[selectedAccountId] || {}).length} ocultos)
                        </span>
                      </>
                    ) : (
                      <>Mostrando <strong className="text-white">{filteredTemplates.length}</strong> de <strong className="text-white">{templates.length}</strong> templates</>
                    )}
                  </div>
                )}
              </div>
            </div>
            
          </div>
        </div>
      </div>
      
      {/* Preview do Template */}
      {previewTemplate && (
        <TemplatePreview
          isOpen={showPreview}
          onClose={() => {
            setShowPreview(false);
            setPreviewTemplate(null);
          }}
          template={parseTemplateForPreview(previewTemplate)}
        />
      )}
      
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #10b981;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #059669;
        }
        .bg-grid-white {
          background-image: 
            linear-gradient(to right, rgba(255, 255, 255, 0.1) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.1) 1px, transparent 1px);
          background-size: 20px 20px;
        }
      `}</style>
    </>
  );
}
