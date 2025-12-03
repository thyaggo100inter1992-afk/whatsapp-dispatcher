import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { FaEnvelope, FaEye, FaPaperPlane, FaSave, FaToggleOn, FaToggleOff, FaExclamationTriangle, FaCog, FaArrowLeft } from 'react-icons/fa';
import api from '@/services/api';

interface EmailTemplate {
  id: number;
  event_type: string;
  name: string;
  description: string;
  subject: string;
  html_content: string;
  is_active: boolean;
  variables: string[];
  created_at: string;
  updated_at: string;
}

export default function EmailTemplates() {
  const router = useRouter();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [editedSubject, setEditedSubject] = useState('');
  const [editedHtml, setEditedHtml] = useState('');
  const [preview, setPreview] = useState('');
  const [testEmail, setTestEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Ícones para cada tipo de evento
  const eventIcons: Record<string, string> = {
    welcome: '🎉',
    trial_start: '🚀',
    trial_expired: '🔒',
    expiry_3days: '⚠️',
    expiry_2days: '⚠️',
    expiry_1day: '🚨',
    blocked: '🔒',
    deletion_warning: '🗑️',
    pix_generated: '💰',
    payment_confirmed: '✅'
  };

  // Carregar templates
  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/email-templates');
      
      if (response.data.success) {
        setTemplates(response.data.templates);
        
        // Selecionar primeiro template automaticamente
        if (response.data.templates.length > 0 && !selectedTemplate) {
          const first = response.data.templates[0];
          setSelectedTemplate(first);
          setEditedSubject(first.subject);
          setEditedHtml(first.html_content);
        }
      }
    } catch (error) {
      console.error('❌ Erro ao carregar templates:', error);
      alert('Erro ao carregar templates de email');
    } finally {
      setLoading(false);
    }
  };

  const selectTemplate = (template: EmailTemplate) => {
    setSelectedTemplate(template);
    setEditedSubject(template.subject);
    setEditedHtml(template.html_content);
    setShowPreview(false);
  };

  // Verificar se uma variável está sendo usada no template
  const checkVariableUsage = (variable: string, content: string, subject: string): {
    used: boolean;
    inSubject: boolean;
    inContent: boolean;
    count: number;
  } => {
    const varPattern = new RegExp(`\\{\\{${variable}\\}\\}`, 'g');
    const inSubject = varPattern.test(subject);
    const contentMatches = content.match(varPattern);
    const inContent = contentMatches !== null;
    const count = (contentMatches?.length || 0) + (inSubject ? 1 : 0);
    
    return {
      used: inSubject || inContent,
      inSubject,
      inContent,
      count
    };
  };

  const saveTemplate = async () => {
    if (!selectedTemplate) return;

    try {
      setSaving(true);
      
      const response = await api.put(
        `/admin/email-templates/${selectedTemplate.id}`,
        {
          subject: editedSubject,
          html_content: editedHtml
        }
      );

      if (response.data.success) {
        alert('✅ Template atualizado com sucesso!');
        loadTemplates();
      }
    } catch (error) {
      console.error('❌ Erro ao salvar template:', error);
      alert('Erro ao salvar template');
    } finally {
      setSaving(false);
    }
  };

  const toggleTemplate = async (template: EmailTemplate) => {
    try {
      const response = await api.patch(
        `/admin/email-templates/${template.id}/toggle`
      );

      if (response.data.success) {
        loadTemplates();
      }
    } catch (error) {
      console.error('❌ Erro ao alterar status:', error);
      alert('Erro ao alterar status do template');
    }
  };

  const generatePreview = async () => {
    if (!selectedTemplate) return;

    try {
      const response = await api.post(
        '/admin/email-templates/preview',
        {
          html_content: editedHtml,
          event_type: selectedTemplate.event_type
        }
      );

      if (response.data.success) {
        setPreview(response.data.preview);
        setShowPreview(true);
      }
    } catch (error) {
      console.error('❌ Erro ao gerar preview:', error);
      alert('Erro ao gerar preview');
    }
  };

  const sendTestEmail = async () => {
    if (!selectedTemplate || !testEmail) {
      alert('❌ Preencha o email de destino');
      return;
    }

    try {
      const response = await api.post(
        '/admin/email-templates/test',
        {
          to: testEmail,
          subject: editedSubject,
          html_content: editedHtml,
          event_type: selectedTemplate.event_type
        }
      );

      if (response.data.success) {
        alert('✅ Email de teste enviado com sucesso!');
        setTestEmail('');
      }
    } catch (error: any) {
      console.error('❌ Erro ao enviar email de teste:', error);
      alert(error.response?.data?.message || 'Erro ao enviar email de teste');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black p-8 flex items-center justify-center">
        <div className="text-white text-2xl">Carregando templates...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black p-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl shadow-2xl p-8 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <FaEnvelope className="text-5xl text-white" />
              <div>
                <h1 className="text-4xl font-bold text-white">Templates de Email</h1>
                <p className="text-blue-100 mt-2">
                  Configure emails personalizados para cada evento do sistema
                </p>
              </div>
            </div>
            <button
              onClick={() => router.push('/admin/credentials?tab=email')}
              className="px-6 py-3 bg-white/20 hover:bg-white/30 text-white rounded-xl font-bold transition-all flex items-center gap-2 backdrop-blur-sm"
              title="Voltar para Configurações SMTP"
            >
              <FaCog /> Configurar SMTP
            </button>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          
          {/* Lista de Templates (Sidebar) */}
          <div className="col-span-12 lg:col-span-4">
            <div className="bg-gray-800 rounded-xl shadow-lg p-6 sticky top-8">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                📋 Templates Disponíveis
              </h2>
              
              <div className="space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    onClick={() => selectTemplate(template)}
                    className={`p-4 rounded-lg cursor-pointer transition-all ${
                      selectedTemplate?.id === template.id
                        ? 'bg-gradient-to-r from-blue-600 to-purple-600 shadow-lg scale-105'
                        : 'bg-gray-700 hover:bg-gray-600'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-2xl">{eventIcons[template.event_type]}</span>
                          <h3 className="font-bold text-white">{template.name}</h3>
                        </div>
                        <p className="text-sm text-gray-300 mb-2">{template.description}</p>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleTemplate(template);
                            }}
                            className="text-xs px-2 py-1 rounded"
                          >
                            {template.is_active ? (
                              <FaToggleOn className="text-green-400 text-xl" />
                            ) : (
                              <FaToggleOff className="text-gray-400 text-xl" />
                            )}
                          </button>
                          <span className={`text-xs px-2 py-1 rounded ${
                            template.is_active 
                              ? 'bg-green-500/20 text-green-300' 
                              : 'bg-gray-500/20 text-gray-400'
                          }`}>
                            {template.is_active ? 'Ativo' : 'Inativo'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Editor de Template */}
          <div className="col-span-12 lg:col-span-8 space-y-6">
            
            {selectedTemplate ? (
              <>
                {/* Informações e Ações */}
                <div className="bg-gray-800 rounded-xl shadow-lg p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        {eventIcons[selectedTemplate.event_type]} {selectedTemplate.name}
                      </h2>
                      <p className="text-gray-400 mt-1">{selectedTemplate.description}</p>
                      
                      {/* Status Geral das Variáveis */}
                      <div className="mt-3 flex items-center gap-4">
                        {(() => {
                          const totalVars = selectedTemplate.variables.length;
                          const usedVars = selectedTemplate.variables.filter(v => 
                            checkVariableUsage(v, editedHtml, editedSubject).used
                          ).length;
                          const percentage = totalVars > 0 ? Math.round((usedVars / totalVars) * 100) : 0;
                          const allConfigured = usedVars === totalVars;
                          
                          return (
                            <>
                              <div className={`flex items-center gap-2 px-3 py-1 rounded-lg ${
                                allConfigured 
                                  ? 'bg-green-900/30 border border-green-600' 
                                  : 'bg-yellow-900/30 border border-yellow-600'
                              }`}>
                                <span className="text-lg">
                                  {allConfigured ? '✅' : '⚠️'}
                                </span>
                                <span className="text-sm font-semibold text-white">
                                  {usedVars} / {totalVars} variáveis configuradas
                                </span>
                              </div>
                              
                              <div className="flex-1 max-w-xs">
                                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full transition-all ${
                                      percentage === 100 ? 'bg-green-500' : 'bg-yellow-500'
                                    }`}
                                    style={{ width: `${percentage}%` }}
                                  />
                                </div>
                                <span className="text-xs text-gray-400 mt-1 block">
                                  {percentage}% completo
                                </span>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={generatePreview}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                      >
                        <FaEye /> Preview
                      </button>
                      <button
                        onClick={saveTemplate}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
                      >
                        <FaSave /> {saving ? 'Salvando...' : 'Salvar'}
                      </button>
                    </div>
                  </div>

                  {/* Variáveis Disponíveis com Status */}
                  <div className="bg-blue-900/30 border border-blue-600 rounded-lg p-4 mb-4">
                    <h3 className="text-sm font-bold text-blue-300 mb-3 flex items-center gap-2">
                      💡 Variáveis Disponíveis e Status de Uso:
                    </h3>
                    
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {selectedTemplate.variables.map((v) => {
                        const usage = checkVariableUsage(v, editedHtml, editedSubject);
                        return (
                          <div
                            key={v}
                            className={`flex items-center justify-between p-2 rounded-lg ${
                              usage.used 
                                ? 'bg-green-900/30 border border-green-600' 
                                : 'bg-yellow-900/30 border border-yellow-600'
                            }`}
                          >
                            <div className="flex items-center gap-2 flex-1">
                              <span className="text-lg">
                                {usage.used ? '✅' : '⚠️'}
                              </span>
                              <code
                                className="text-xs font-mono bg-gray-800 text-blue-200 px-2 py-1 rounded cursor-pointer hover:bg-gray-700"
                                onClick={() => {
                                  navigator.clipboard.writeText(`{{${v}}}`);
                                  alert(`✅ Copiado: {{${v}}}`);
                                }}
                                title="Clique para copiar"
                              >
                                {`{{${v}}}`}
                              </code>
                              <span className="text-xs text-gray-400">
                                {usage.used ? (
                                  <>
                                    Usado {usage.count}x
                                    {usage.inSubject && ' (assunto)'}
                                    {usage.inContent && ' (conteúdo)'}
                                  </>
                                ) : (
                                  'Não utilizado'
                                )}
                              </span>
                            </div>
                            {!usage.used && (
                              <span className="text-xs text-yellow-400 font-semibold">
                                Não configurado
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    
                    <div className="mt-3 pt-3 border-t border-blue-700">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-400">
                          💡 Clique em uma variável para copiar
                        </span>
                        <span className="text-blue-300">
                          {selectedTemplate.variables.filter(v => 
                            checkVariableUsage(v, editedHtml, editedSubject).used
                          ).length} / {selectedTemplate.variables.length} configuradas
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Assunto */}
                  <div className="mb-4">
                    <label className="block text-sm font-bold text-gray-300 mb-2">
                      📧 Assunto do Email:
                    </label>
                    <input
                      type="text"
                      value={editedSubject}
                      onChange={(e) => setEditedSubject(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                      placeholder="Assunto do email..."
                    />
                  </div>

                  {/* Editor HTML */}
                  <div>
                    <label className="block text-sm font-bold text-gray-300 mb-2">
                      📝 Conteúdo HTML:
                    </label>
                    <textarea
                      value={editedHtml}
                      onChange={(e) => setEditedHtml(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-blue-500"
                      rows={20}
                      placeholder="HTML do email..."
                    />
                  </div>
                </div>

                {/* Preview */}
                {showPreview && (
                  <div className="bg-gray-800 rounded-xl shadow-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <FaEye /> Preview do Email
                      </h3>
                      <button
                        onClick={() => setShowPreview(false)}
                        className="text-gray-400 hover:text-white transition-colors"
                      >
                        ✕ Fechar
                      </button>
                    </div>
                    <div className="bg-white rounded-lg p-8 border-4 border-gray-700 shadow-2xl overflow-auto max-h-[600px]">
                      <style dangerouslySetInnerHTML={{ __html: `
                        .email-preview * {
                          color: inherit !important;
                        }
                        .email-preview {
                          color: #1f2937 !important;
                          background-color: #ffffff !important;
                        }
                        .email-preview a {
                          color: #2563eb !important;
                          text-decoration: underline !important;
                        }
                        .email-preview h1, .email-preview h2, .email-preview h3 {
                          color: #111827 !important;
                        }
                        .email-preview p {
                          color: #374151 !important;
                        }
                      ` }} />
                      <div
                        dangerouslySetInnerHTML={{ __html: preview }}
                        className="email-preview"
                      />
                    </div>
                  </div>
                )}

                {/* Enviar Email de Teste */}
                <div className="bg-gray-800 rounded-xl shadow-lg p-6">
                  <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <FaPaperPlane /> Enviar Email de Teste
                  </h3>
                  <div className="flex gap-4">
                    <input
                      type="email"
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                      className="flex-1 px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                      placeholder="email@exemplo.com"
                    />
                    <button
                      onClick={sendTestEmail}
                      className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                    >
                      <FaPaperPlane /> Enviar Teste
                    </button>
                  </div>
                  <p className="text-sm text-gray-400 mt-2">
                    ⚠️ O email será enviado com dados de exemplo para teste
                  </p>
                </div>

                {/* Aviso Importante */}
                <div className="bg-yellow-900/30 border border-yellow-600 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-yellow-300 mb-2 flex items-center gap-2">
                    <FaExclamationTriangle /> Atenção
                  </h3>
                  <ul className="text-yellow-200 space-y-1 text-sm">
                    <li>• Os emails só serão enviados se o template estiver <strong>ATIVO</strong></li>
                    <li>• Use as variáveis disponíveis para personalizar o conteúdo</li>
                    <li>• Teste sempre antes de ativar um template</li>
                    <li>• As configurações de email devem estar corretas na aba "Credenciais"</li>
                  </ul>
                </div>
              </>
            ) : (
              <div className="bg-gray-800 rounded-xl shadow-lg p-12 text-center">
                <FaEnvelope className="text-6xl text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 text-lg">
                  Selecione um template ao lado para começar a editar
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

