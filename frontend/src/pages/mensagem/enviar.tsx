import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { FaPaperPlane, FaSearch, FaTimes, FaArrowLeft } from 'react-icons/fa';
import { whatsappAccountsAPI, messagesAPI } from '@/services/api';
import MediaUpload from '@/components/MediaUpload';
import { useConfirm } from '@/hooks/useConfirm';

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

export default function EnviarMensagemImediata() {
  const router = useRouter();
  const { confirm, ConfirmDialog } = useConfirm();
  
  const [accounts, setAccounts] = useState<WhatsAppAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number>(0);
  const [phoneNumber, setPhoneNumber] = useState('');
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
  
  // Rastrear templates enviados por conta: { accountId: { templateName: count } }
  const [sentTemplates, setSentTemplates] = useState<Record<number, Record<string, number>>>({});
  
  // Controlar visibilidade de templates enviados (marcado por padrão)
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

    // Buscar por nome
    if (searchQuery.trim()) {
      filtered = filtered.filter(t => 
        t.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Excluir templates
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
    loadTemplates(accountId);
    // Não resetar marcações ao trocar de conta - mantém histórico
  };

  // Marcar template como enviado
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

  // Verificar se template foi enviado
  const isTemplateSent = (templateName: string): boolean => {
    const accountTemplates = sentTemplates[selectedAccountId];
    return accountTemplates && accountTemplates[templateName] > 0;
  };

  // Obter contagem de envios
  const getSentCount = (templateName: string): number => {
    const accountTemplates = sentTemplates[selectedAccountId];
    return accountTemplates?.[templateName] || 0;
  };

  // Limpar marcações da conta atual
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
    setSelectedTemplate(template);
    
    // Extrair variáveis do template
    const templateVars = extractVariablesFromTemplate(template);
    const newVariables: Record<string, string> = {};
    templateVars.forEach(varNum => {
      newVariables[varNum] = '';
    });
    setVariables(newVariables);
  };

  const handleMediaUpload = (data: any) => {
    const type = data.mime_type.startsWith('image/') ? 'image' 
                : data.mime_type.startsWith('video/') ? 'video' 
                : data.mime_type.startsWith('audio/') ? 'audio' 
                : 'document';
    
    // Se a URL já começar com http, é uma URL externa
    // Caso contrário, usa a URL base da API ou fallback para localhost
    const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace(/\/api$/, '');
    const finalUrl = data.url.startsWith('http') 
      ? data.url 
      : `${apiBaseUrl}${data.url}`;
    
    setMediaUrl(finalUrl);
    setMediaType(type);
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      UTILITY: 'badge-info',
      MARKETING: 'badge-warning',
      AUTHENTICATION: 'badge-success',
    };
    return colors[category] || 'badge-info';
  };

  const hasVariables = (template: Template) => {
    return template.components.some((c: any) => 
      c.type === 'BODY' && c.text && c.text.includes('{{')
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedTemplate) {
      await confirm({
        title: '⚠️ Template Não Selecionado',
        message: 'Selecione um template!',
        type: 'warning',
        confirmText: 'OK',
        showCancel: false
      });
      return;
    }

    // Validar variáveis obrigatórias
    const requiredVars = Object.keys(variables);
    if (requiredVars.length > 0) {
      const emptyVars = requiredVars.filter(varNum => !variables[varNum].trim());
      if (emptyVars.length > 0) {
        await confirm({
          title: '⚠️ Variáveis Obrigatórias',
          message: `Preencha todas as variáveis obrigatórias: ${emptyVars.join(', ')}`,
          type: 'warning',
          confirmText: 'OK',
          showCancel: false
        });
        return;
      }
    }

    setLoading(true);

    try {
      // 🚨 VERIFICAR SE O NÚMERO ESTÁ NA LISTA DE RESTRIÇÃO
      console.log('🔍 Verificando restrições para:', phoneNumber);
      
      const restrictionCheck = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/restriction-lists/check-bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('@WhatsAppDispatcher:token')}`, // ✅ ADICIONAR TOKEN
        },
        body: JSON.stringify({
          phone_numbers: [phoneNumber],
          whatsapp_account_ids: [selectedAccountId],
        }),
      });

      if (restrictionCheck.ok) {
        const restrictionResult = await restrictionCheck.json();
        
        if (restrictionResult.restricted_count > 0) {
          // ❌ NÚMERO RESTRITO - NÃO ENVIAR!
          const detail = restrictionResult.restricted_details[0];
          const listNames = detail.list_names.join(', ');
          
          console.log('🚫 Número restrito encontrado:', detail);
          
          await confirm({
            title: '🚫 NÚMERO RESTRITO!',
            message: `Este contato está na lista:\n\n${listNames}\n\nA mensagem NÃO foi enviada.`,
            type: 'danger',
            confirmText: 'OK',
            showCancel: false
          });
          
          setLoading(false);
          return; // ❌ BLOQUEAR ENVIO
        }
        
        console.log('✅ Número livre para envio');
      }

      const data = {
        whatsapp_account_id: selectedAccountId,
        phone_number: phoneNumber,
        template_name: selectedTemplate.name,
        variables: variables,
        media_url: mediaUrl,
        media_type: mediaType,
      };

      const response = await messagesAPI.sendImmediate(data);
      
      if (response.data.success) {
        // Marcar template como enviado
        markTemplateAsSent(selectedAccountId, selectedTemplate.name);
        
        await confirm({
          title: '✅ Mensagem Enviada!',
          message: 'Mensagem enviada com sucesso!\n\n💡 Template marcado como enviado.\nVocê pode continuar enviando para outros números.',
          type: 'success',
          confirmText: 'OK',
          showCancel: false
        });
        
        // Limpar apenas o número e variáveis, manter template selecionado e conta
        setPhoneNumber('');
        setMediaUrl('');
        setMediaType('');
        // Não limpar template nem conta para facilitar envios sequenciais
      }
    } catch (error: any) {
      await confirm({
        title: '❌ Erro ao Enviar',
        message: 'Erro ao enviar mensagem: ' + (error.response?.data?.error || error.message),
        type: 'danger',
        confirmText: 'OK',
        showCancel: false
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in max-w-5xl mx-auto">
      <div className="card mb-6 bg-gradient-to-r from-blue-600/20 to-blue-700/20 border-blue-500/30">
        <div className="flex items-center gap-4 mb-4">
          {/* Botão Voltar */}
          <button
            onClick={() => router.push('/dashboard-oficial')}
            className="bg-white/10 hover:bg-white/20 p-3 rounded-xl transition-all duration-200 border-2 border-white/20 hover:border-white/40"
            title="Voltar para o Dashboard API Oficial"
          >
            <FaArrowLeft className="text-2xl text-white" />
          </button>
          
          <h1 className="card-header mb-0">
            <FaPaperPlane className="text-blue-500" />
            Enviar Mensagem Imediata
          </h1>
        </div>
        <p className="text-white/70">
          Envie mensagens individuais instantaneamente usando seus templates
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Número de Origem e Destinatário */}
        <div className="card">
          <h2 className="card-header">
            📱 Informações Básicas
          </h2>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Número de Origem *
              </label>
              <select
                required
                className="input"
                value={selectedAccountId}
                onChange={(e) => handleAccountChange(parseInt(e.target.value))}
              >
                <option value="0">Selecione...</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} - {account.phone_number} ✅ ATIVO
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Número do Destinatário *
              </label>
              <input
                type="text"
                required
                className="input"
                placeholder="Ex: 5562912345678"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
              />
              <p className="text-xs text-white/50 mt-1">
                Formato: Código do país + DDD + número (sem espaços ou símbolos)
              </p>
            </div>
          </div>
        </div>

        {/* Seleção de Template */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="card-header mb-0">
              📝 Selecionar Template
            </h2>
            
            {/* Botão para limpar marcações */}
            {Object.keys(sentTemplates[selectedAccountId] || {}).length > 0 && (
              <button
                type="button"
                onClick={clearSentMarks}
                className="btn btn-secondary text-sm"
                title="Limpar marcações de templates enviados"
              >
                🔄 Limpar Marcações ({Object.keys(sentTemplates[selectedAccountId] || {}).length})
              </button>
            )}
          </div>

          {/* Filtros */}
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium mb-2">
                <FaSearch className="inline mr-2" />
                Buscar template pelo nome...
              </label>
              <input
                type="text"
                className="input"
                placeholder="Digite para buscar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                <FaTimes className="inline mr-2" />
                Excluir templates que contenham...
              </label>
              <input
                type="text"
                className="input"
                placeholder="Digite para excluir..."
                value={excludeQuery}
                onChange={(e) => setExcludeQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Checkbox para ocultar templates enviados */}
          {Object.keys(sentTemplates[selectedAccountId] || {}).length > 0 && (
            <div className="mb-4 p-3 bg-white/5 rounded-lg border border-white/10">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hideSentTemplates}
                  onChange={(e) => setHideSentTemplates(e.target.checked)}
                  className="w-5 h-5 rounded border-white/20 bg-white/10 checked:bg-primary-500 checked:border-primary-500 cursor-pointer"
                />
                <span className="text-sm font-medium">
                  👁️ Ocultar templates enviados ({Object.keys(sentTemplates[selectedAccountId] || {}).length})
                </span>
              </label>
              <p className="text-xs text-white/50 mt-2 ml-8">
                Marque para focar apenas nos templates que ainda não foram enviados
              </p>
            </div>
          )}

          {/* Lista de Templates */}
          {loadingTemplates ? (
            <div className="text-center py-12">
              <div className="animate-spin text-4xl mb-4">⏳</div>
              <p className="text-white/60">Carregando templates...</p>
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="text-center py-12 text-white/50">
              {templates.length === 0 
                ? 'Nenhum template disponível. Configure seus templates no Meta Business.' 
                : 'Nenhum template encontrado com os filtros aplicados.'}
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto">
              {filteredTemplates
                .filter(template => {
                  // Se "ocultar enviados" estiver marcado, filtrar apenas não enviados
                  if (hideSentTemplates) {
                    return !isTemplateSent(template.name);
                  }
                  return true;
                })
                .map((template, index) => {
                const isSent = isTemplateSent(template.name);
                const sentCount = getSentCount(template.name);
                
                return (
                  <div
                    key={index}
                    onClick={() => handleTemplateSelect(template)}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      isSent 
                        ? 'border-green-500/50 bg-green-500/10 hover:border-green-500'
                        : selectedTemplate?.name === template.name
                        ? 'border-primary-500 bg-primary-500/20'
                        : 'border-white/10 bg-white/5 hover:border-primary-500/50'
                    }`}
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <div className={`${
                        isSent ? 'bg-green-500/20' : 'bg-primary-500/20'
                      } p-3 rounded-full flex-shrink-0`}>
                        <FaPaperPlane className={`${
                          isSent ? 'text-green-400' : 'text-primary-400'
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold truncate">{template.name}</h3>
                          {isSent && (
                            <span className="text-green-400 text-xl flex-shrink-0">✓</span>
                          )}
                        </div>
                        <div className="flex gap-2 mt-1 flex-wrap">
                          {isSent && (
                            <span className="badge bg-green-500/20 text-green-300 border-green-500/30 text-xs font-bold">
                              ENVIADO {sentCount}x
                            </span>
                          )}
                          <span className="badge badge-success text-xs">UTILITY</span>
                          {hasVariables(template) && (
                            <span className="badge badge-info text-xs">COM VARIÁVEL</span>
                          )}
                          <span className="badge badge-success text-xs">APROVADO</span>
                        </div>
                      </div>
                    </div>

                    {selectedTemplate?.name === template.name && (
                      <div className="mt-3 p-3 bg-white/5 rounded text-sm">
                        <p className="text-white/70">✅ Template selecionado</p>
                      </div>
                    )}
                  </div>
                );
              })}
              
              {/* Mensagem quando todos estão ocultos */}
              {hideSentTemplates && 
               filteredTemplates.filter(t => !isTemplateSent(t.name)).length === 0 && (
                <div className="col-span-2 text-center py-12">
                  <div className="text-6xl mb-4">🎉</div>
                  <p className="text-lg font-bold text-green-400 mb-2">
                    Todos os templates foram enviados!
                  </p>
                  <p className="text-white/60 mb-4">
                    Desmarque "Ocultar templates enviados" para vê-los novamente
                  </p>
                  <button
                    type="button"
                    onClick={() => setHideSentTemplates(false)}
                    className="btn btn-primary"
                  >
                    👁️ Mostrar Todos os Templates
                  </button>
                </div>
              )}
            </div>
          )}

          {filteredTemplates.length > 0 && (
            <div className="mt-4 text-sm text-white/50 text-center">
              {hideSentTemplates ? (
                <>
                  Mostrando {filteredTemplates.filter(t => !isTemplateSent(t.name)).length} de {filteredTemplates.length} templates 
                  <span className="text-green-400 ml-2">
                    ({Object.keys(sentTemplates[selectedAccountId] || {}).length} ocultos)
                  </span>
                </>
              ) : (
                <>
                  Mostrando {filteredTemplates.length} de {templates.length} templates
                </>
              )}
            </div>
          )}
        </div>

        {/* Upload de Mídia - Apenas se o template tiver header de mídia */}
        {hasMediaHeader(selectedTemplate) && (
          <div className="card">
            <h2 className="card-header">
              🖼️ Mídia ({getMediaHeaderType(selectedTemplate).toUpperCase()}) - Obrigatória
            </h2>
            
            <p className="text-white/60 text-sm mb-4">
              Este template requer uma mídia do tipo: <span className="font-bold text-primary-300">{getMediaHeaderType(selectedTemplate).toUpperCase()}</span>
            </p>
            
            <MediaUpload onUploadSuccess={handleMediaUpload} />
          </div>
        )}

        {/* Variáveis do Template */}
        {selectedTemplate && Object.keys(variables).length > 0 && (
          <div className="card">
            <h2 className="card-header">
              🔤 Variáveis do Template
            </h2>
            
            <div className="space-y-4">
              <p className="text-white/70 text-sm">
                Este template possui variáveis que precisam ser preenchidas:
              </p>
              
              {Object.keys(variables).sort().map((varNum) => (
                <div key={varNum}>
                  <label className="block text-sm font-medium mb-2">
                    Variável {varNum} *
                  </label>
                  <input
                    type="text"
                    required
                    className="input"
                    placeholder={`Digite o valor para {{${varNum}}}`}
                    value={variables[varNum]}
                    onChange={(e) => setVariables({
                      ...variables,
                      [varNum]: e.target.value
                    })}
                  />
                  <p className="text-xs text-white/50 mt-1">
                    Esta variável será substituída no template
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Resumo e Envio */}
        {selectedTemplate && phoneNumber && (
          <div className="card bg-primary-500/10 border-primary-500/30">
            <h2 className="card-header">
              ✅ Resumo do Envio
            </h2>
            
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-white/60">Conta:</span>{' '}
                <span className="font-medium">
                  {accounts.find(a => a.id === selectedAccountId)?.name}
                </span>
              </p>
              <p>
                <span className="text-white/60">Destinatário:</span>{' '}
                <span className="font-medium">{phoneNumber}</span>
              </p>
              <p>
                <span className="text-white/60">Template:</span>{' '}
                <span className="font-medium">{selectedTemplate.name}</span>
              </p>
              {Object.keys(variables).length > 0 && (
                <div>
                  <p className="text-white/60 mb-1">Variáveis:</p>
                  {Object.keys(variables).sort().map(varNum => (
                    <p key={varNum} className="ml-4 text-sm">
                      <span className="text-white/50">{`{{${varNum}}}`}:</span>{' '}
                      <span className="font-medium text-primary-300">
                        {variables[varNum] || '(não preenchida)'}
                      </span>
                    </p>
                  ))}
                </div>
              )}
              {mediaUrl && (
                <p>
                  <span className="text-white/60">Mídia:</span>{' '}
                  <span className="font-medium">✅ Anexada ({mediaType})</span>
                </p>
              )}
            </div>
          </div>
        )}

        {/* Botões */}
        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading || !selectedTemplate}
            className="btn btn-primary flex-1"
          >
            {loading ? (
              <>Enviando...</>
            ) : (
              <>
                <FaPaperPlane />
                Enviar Mensagem Agora
              </>
            )}
          </button>
          
          <button
            type="button"
            onClick={() => router.push('/')}
            className="btn btn-secondary"
          >
            Cancelar
          </button>
        </div>
      </form>
      
      {/* Modal de Confirmação Elegante */}
      <ConfirmDialog />
    </div>
  );
}

