import React, { useState, useEffect } from 'react';
import { FaSearch, FaFlask, FaArrowLeft, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useToast } from '@/hooks/useToast';
import api, { whatsappAccountsAPI } from '@/services/api';

interface WhatsAppAccount {
  id: number;
  name: string;
  phone_number: string;
  is_active: boolean;
}

interface AnalysisResult {
  success: boolean;
  existingTemplates?: any[];
  analysis?: string[];
  recommendedFormat?: any;
  error?: string;
}

interface TestResult {
  format: string;
  success: boolean;
  templateId?: string;
  error?: string;
  errorDetails?: any;
}

export default function AnalisarTemplate() {
  const router = useRouter();
  const toast = useToast();

  const [accounts, setAccounts] = useState<WhatsAppAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [testResults, setTestResults] = useState<TestResult[] | null>(null);
  const [testImageUrl, setTestImageUrl] = useState('');

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      // 🔧 Carregar APENAS contas de API Oficial (não QR Connect)
      const response = await whatsappAccountsAPI.getActive('api');
      const accountsData = response.data.data || response.data || [];
      setAccounts(Array.isArray(accountsData) ? accountsData : []);
    } catch (error) {
      console.error('Erro ao carregar contas:', error);
      toast.error('Erro ao carregar contas do WhatsApp');
    }
  };

  const analyzeExisting = async () => {
    if (!selectedAccountId) {
      toast.error('Selecione uma conta');
      return;
    }

    setLoading(true);
    setAnalysisResult(null);
    setTestResults(null);

    try {
      toast.info('🔍 Analisando templates existentes...');
      
      const response = await api.get(`/template-analyzer/${selectedAccountId}/analyze`);
      
      setAnalysisResult(response.data);

      if (response.data.success) {
        if (response.data.existingTemplates && response.data.existingTemplates.length > 0) {
          toast.success(`✅ ${response.data.existingTemplates.length} template(s) com imagem encontrado(s)!`);
        } else {
          toast.warning('⚠️ Nenhum template com imagem encontrado nesta conta');
        }
      } else {
        toast.error(response.data.error || 'Erro ao analisar templates');
      }
    } catch (error: any) {
      console.error('Erro ao analisar:', error);
      toast.error(error.response?.data?.error || 'Erro ao analisar templates');
    } finally {
      setLoading(false);
    }
  };

  const testFormats = async () => {
    if (!selectedAccountId) {
      toast.error('Selecione uma conta');
      return;
    }

    if (!testImageUrl.trim()) {
      toast.error('Forneça uma URL de imagem para teste');
      return;
    }

    setLoading(true);
    setTestResults(null);

    try {
      toast.info('🧪 Testando diferentes formatos...');
      toast.warning('⚠️ Isso criará templates de teste na sua conta do WhatsApp');
      
      const response = await api.post(`/template-analyzer/${selectedAccountId}/test-formats`, {
        testImageUrl: testImageUrl.trim(),
      });

      setTestResults(response.data.results || []);

      const workingFormat = response.data.results?.find((r: TestResult) => r.success);
      if (workingFormat) {
        toast.success(`🎉 Formato correto encontrado: ${workingFormat.format}!`);
      } else {
        toast.error('❌ Nenhum formato funcionou. Verifique o console do backend para detalhes.');
      }
    } catch (error: any) {
      console.error('Erro ao testar formatos:', error);
      toast.error(error.response?.data?.error || 'Erro ao testar formatos');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <button
          onClick={() => router.push('/configuracoes')}
          className="mb-6 px-6 py-3 bg-dark-700 hover:bg-dark-600 text-white rounded-xl transition-all flex items-center gap-2 font-bold"
        >
          <FaArrowLeft /> Voltar
        </button>

        <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl p-8 shadow-2xl">
          <h1 className="text-4xl font-black text-white mb-2">
            🔬 Analisador de Templates
          </h1>
          <p className="text-white/80 text-lg">
            Descubra o formato correto para criar templates com imagens
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Painel de Controle */}
        <div className="space-y-6">
          {/* Seleção de Conta */}
          <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-6 shadow-xl">
            <h2 className="text-2xl font-black text-white mb-4">📱 Selecionar Conta</h2>
            <select
              value={selectedAccountId || ''}
              onChange={(e) => setSelectedAccountId(Number(e.target.value))}
              className="w-full p-4 bg-dark-700 border-2 border-white/10 rounded-xl text-white focus:border-purple-500 focus:outline-none"
            >
              <option value="">Selecione uma conta...</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name || account.phone_number}
                </option>
              ))}
            </select>
          </div>

          {/* Analisar Templates Existentes */}
          <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-6 shadow-xl">
            <h2 className="text-2xl font-black text-white mb-4">🔍 Analisar Templates Existentes</h2>
            <p className="text-white/70 mb-4">
              Busca templates com imagens já criados na sua conta e mostra como foram estruturados.
            </p>
            <button
              onClick={analyzeExisting}
              disabled={loading || !selectedAccountId}
              className="w-full px-6 py-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FaSearch className="text-xl" />
              {loading ? 'Analisando...' : 'Analisar Templates'}
            </button>
          </div>

          {/* Testar Formatos */}
          <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-6 shadow-xl">
            <h2 className="text-2xl font-black text-white mb-4">🧪 Testar Formatos</h2>
            <p className="text-white/70 mb-4">
              Testa diferentes formatos de criação de template com uma imagem de teste.
            </p>
            <p className="text-yellow-400 text-sm mb-4">
              ⚠️ Atenção: Isso criará templates de teste reais na sua conta do WhatsApp!
            </p>
            <input
              type="text"
              value={testImageUrl}
              onChange={(e) => setTestImageUrl(e.target.value)}
              placeholder="URL da imagem de teste (ex: https://...)"
              className="w-full p-4 mb-4 bg-dark-700 border-2 border-white/10 rounded-xl text-white placeholder-white/50 focus:border-purple-500 focus:outline-none"
            />
            <button
              onClick={testFormats}
              disabled={loading || !selectedAccountId || !testImageUrl.trim()}
              className="w-full px-6 py-4 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FaFlask className="text-xl" />
              {loading ? 'Testando...' : 'Testar Formatos'}
            </button>
          </div>
        </div>

        {/* Resultados */}
        <div className="space-y-6">
          {/* Resultado da Análise */}
          {analysisResult && (
            <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-6 shadow-xl">
              <h2 className="text-2xl font-black text-white mb-4">📊 Resultado da Análise</h2>
              
              {analysisResult.success ? (
                <div className="space-y-4">
                  {analysisResult.existingTemplates && analysisResult.existingTemplates.length > 0 ? (
                    <>
                      <p className="text-green-400 font-bold">
                        ✅ {analysisResult.existingTemplates.length} template(s) com imagem encontrado(s)
                      </p>
                      
                      {analysisResult.analysis && (
                        <div className="bg-dark-700/50 rounded-xl p-4">
                          <h3 className="text-white font-bold mb-2">📋 Análise:</h3>
                          {analysisResult.analysis.map((line, idx) => (
                            <p key={idx} className="text-white/80 text-sm mb-1 font-mono">
                              {line}
                            </p>
                          ))}
                        </div>
                      )}

                      {analysisResult.recommendedFormat && (
                        <div className="bg-green-500/10 border-2 border-green-500/30 rounded-xl p-4">
                          <h3 className="text-green-400 font-bold mb-2">💡 Formato Recomendado:</h3>
                          <pre className="text-white/80 text-xs overflow-x-auto">
                            {JSON.stringify(analysisResult.recommendedFormat, null, 2)}
                          </pre>
                        </div>
                      )}

                      <div className="bg-blue-500/10 border-2 border-blue-500/30 rounded-xl p-4">
                        <h3 className="text-blue-400 font-bold mb-2">📝 Templates Encontrados:</h3>
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                          {analysisResult.existingTemplates.map((template, idx) => (
                            <div key={idx} className="bg-dark-700/50 rounded p-3">
                              <p className="text-white font-bold">{template.name}</p>
                              <p className="text-white/60 text-sm">Status: {template.status}</p>
                              <pre className="text-white/70 text-xs mt-2 overflow-x-auto">
                                {JSON.stringify(template.components, null, 2)}
                              </pre>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="bg-yellow-500/10 border-2 border-yellow-500/30 rounded-xl p-4">
                      <p className="text-yellow-400">
                        ⚠️ Nenhum template com imagem encontrado nesta conta
                      </p>
                      {analysisResult.analysis && analysisResult.analysis.map((line, idx) => (
                        <p key={idx} className="text-white/70 text-sm mt-2">{line}</p>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-red-500/10 border-2 border-red-500/30 rounded-xl p-4">
                  <p className="text-red-400">❌ Erro: {analysisResult.error}</p>
                </div>
              )}
            </div>
          )}

          {/* Resultado dos Testes */}
          {testResults && testResults.length > 0 && (
            <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-6 shadow-xl">
              <h2 className="text-2xl font-black text-white mb-4">🧪 Resultado dos Testes</h2>
              
              <div className="space-y-3">
                {testResults.map((result, idx) => (
                  <div
                    key={idx}
                    className={`rounded-xl p-4 border-2 ${
                      result.success
                        ? 'bg-green-500/10 border-green-500/30'
                        : 'bg-red-500/10 border-red-500/30'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      {result.success ? (
                        <FaCheckCircle className="text-green-400 text-xl" />
                      ) : (
                        <FaTimesCircle className="text-red-400 text-xl" />
                      )}
                      <h3 className={`font-bold ${result.success ? 'text-green-400' : 'text-red-400'}`}>
                        {result.format}
                      </h3>
                    </div>
                    
                    {result.success ? (
                      <div>
                        <p className="text-white/80 text-sm">
                          ✅ Template ID: {result.templateId}
                        </p>
                        <p className="text-green-400 text-sm font-bold mt-2">
                          🎉 Este é o formato correto! Use este para criar seus templates.
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-white/80 text-sm">❌ Erro: {result.error}</p>
                        {result.errorDetails && (
                          <pre className="text-white/60 text-xs mt-2 overflow-x-auto">
                            {JSON.stringify(result.errorDetails, null, 2)}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Instruções */}
          {!analysisResult && !testResults && (
            <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-6 shadow-xl">
              <h2 className="text-2xl font-black text-white mb-4">ℹ️ Como Usar</h2>
              <div className="space-y-3 text-white/80">
                <p>1️⃣ <strong>Selecione uma conta</strong> do WhatsApp API</p>
                <p>2️⃣ <strong>Analisar Templates Existentes:</strong> Descobre como templates com imagens já criados estão estruturados</p>
                <p>3️⃣ <strong>Testar Formatos:</strong> Testa 4 formatos diferentes de criação e mostra qual funciona</p>
                <p className="text-yellow-400 text-sm mt-4">
                  💡 Dica: Comece analisando templates existentes antes de testar novos formatos
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}




