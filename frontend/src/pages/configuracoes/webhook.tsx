import React, { useState, useEffect } from 'react';
import { FaCopy, FaCheckCircle, FaExternalLinkAlt, FaServer, FaKey, FaLink, FaHome, FaArrowLeft, FaSignOutAlt, FaUser } from 'react-icons/fa';
import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';

export default function WebhookConfigPage() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [webhookUrl, setWebhookUrl] = useState('');
  const [verifyToken, setVerifyToken] = useState('WhatsApp_Webhook_2025_Thyag_Secure_Token_9X7K2P4M');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [backendUrl] = useState((process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace('/api', ''));
  const [ngrokUrl, setNgrokUrl] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWebhookInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadWebhookInfo = async () => {
    try {
      setLoading(true);
      
      // Buscar informações do backend (que vai retornar webhook específico do tenant)
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${backendUrl}/api/webhook/info`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          
          if (data.success && data.webhookUrl) {
            // Usar a URL específica do tenant retornada pelo backend
            setWebhookUrl(data.webhookUrl);
            
            // Verificar se ngrok está ativo
            if (data.ngrokUrl) {
              setNgrokUrl(data.ngrokUrl);
            }
            
            // Configurar token de verificação
            if (data.verifyToken) {
              setVerifyToken(data.verifyToken);
            }
          } else {
            console.error('❌ Erro ao carregar webhook:', data.error);
            setWebhookUrl(`${backendUrl}/api/webhook`);
          }
        } else {
          console.error('❌ Erro na resposta:', response.status);
          setWebhookUrl(`${backendUrl}/api/webhook`);
        }
      } catch (error) {
        console.error('❌ Erro ao buscar webhook:', error);
        setWebhookUrl(`${backendUrl}/api/webhook`);
      }

    } catch (error) {
      console.error('Erro ao carregar informações:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, type: 'url' | 'token') => {
    navigator.clipboard.writeText(text).then(() => {
      if (type === 'url') {
        setCopiedUrl(true);
        setTimeout(() => setCopiedUrl(false), 2000);
      } else {
        setCopiedToken(true);
        setTimeout(() => setCopiedToken(false), 2000);
      }
    });
  };

  const testWebhook = () => {
    const testUrl = `${webhookUrl}?hub.mode=subscribe&hub.verify_token=${verifyToken}&hub.challenge=test123`;
    window.open(testUrl, '_blank');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <header className="bg-gradient-to-r from-gray-900 to-gray-800 border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-green-500 p-3 rounded-2xl">
                <FaServer className="text-white text-2xl" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-white">Webhook NettSistemas</h1>
                <p className="text-sm text-gray-400">Configurações de Webhook</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.back()}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-bold transition-all flex items-center gap-2"
              >
                <FaArrowLeft /> Voltar
              </button>
              <button
                onClick={() => router.push('/')}
                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-bold transition-all flex items-center gap-2"
              >
                <FaHome /> Início
              </button>

              {/* Separador */}
              <div className="w-px h-8 bg-white/20"></div>

              {/* Usuário e Logout */}
              <button
                onClick={() => router.push('/perfil')}
                className="bg-white/10 backdrop-blur-sm px-3 py-2 rounded-lg border border-white/20 hover:bg-white/20 hover:border-white/30 transition-all flex items-center gap-3"
                title="Editar perfil"
              >
                {user?.avatar ? (
                  <img 
                    src={`${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:3001'}/uploads/avatars/${user.avatar}`}
                    alt={user?.nome}
                    className="w-10 h-10 rounded-full object-cover border-2 border-green-400"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center border-2 border-green-400">
                    <FaUser className="text-white text-lg" />
                  </div>
                )}
                <p className="text-white text-sm font-medium">
                  {user?.nome || 'Administrador'}
                </p>
              </button>
              <button
                onClick={() => {
                  signOut();
                  router.push('/login');
                }}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-bold transition-all flex items-center gap-2 shadow-lg hover:shadow-xl"
                title="Sair do sistema"
              >
                <FaSignOutAlt /> Sair
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-8 pt-12">
        <div className="mb-8">
          <p className="text-gray-400 text-center text-lg">
            Configure webhooks para receber notificações em tempo real sobre alterações e atualizações
          </p>
        </div>

        <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-2 border-blue-500/30 rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-4 h-4 rounded-full ${ngrokUrl ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
              <span className="text-white font-bold text-lg">
                {ngrokUrl ? 'Webhook Público Ativo' : 'Webhook Local (Apenas Testes)'}
              </span>
            </div>
            <button
              onClick={loadWebhookInfo}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-bold transition-all"
              disabled={loading}
            >
              {loading ? 'Carregando...' : 'Atualizar'}
            </button>
          </div>
        </div>

        <div className="bg-gradient-to-br from-white/10 to-white/5 border-2 border-white/20 rounded-2xl p-8 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <FaLink className="text-blue-400 text-2xl" />
            <h2 className="text-2xl font-black text-white">URL de Callback</h2>
          </div>
          
          <p className="text-gray-400 mb-4">
            Use esta URL para configurar webhooks em serviços externos (WhatsApp Business API, etc.)
          </p>

          <div className="bg-black/30 rounded-xl p-4 mb-4">
            <code className="text-green-400 text-sm break-all">{webhookUrl}</code>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => copyToClipboard(webhookUrl, 'url')}
              className={`flex-1 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                copiedUrl
                  ? 'bg-green-500 text-white'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
            >
              {copiedUrl ? (
                <>
                  <FaCheckCircle /> Copiado!
                </>
              ) : (
                <>
                  <FaCopy /> Copiar URL
                </>
              )}
            </button>

            <button
              onClick={testWebhook}
              className="px-6 py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-xl font-bold transition-all flex items-center gap-2"
            >
              <FaExternalLinkAlt /> Testar
            </button>
          </div>
        </div>

        <div className="bg-gradient-to-br from-white/10 to-white/5 border-2 border-white/20 rounded-2xl p-8 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <FaKey className="text-yellow-400 text-2xl" />
            <h2 className="text-2xl font-black text-white">Token de Verificação</h2>
          </div>

          <p className="text-gray-400 mb-4">
            Use este token para autenticar requisições do webhook
          </p>

          <div className="bg-black/30 rounded-xl p-4 mb-4">
            <code className="text-yellow-400 text-sm break-all">{verifyToken}</code>
          </div>

          <button
            onClick={() => copyToClipboard(verifyToken, 'token')}
            className={`w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
              copiedToken
                ? 'bg-green-500 text-white'
                : 'bg-yellow-500 hover:bg-yellow-600 text-white'
            }`}
          >
            {copiedToken ? (
              <>
                <FaCheckCircle /> Copiado!
              </>
            ) : (
              <>
                <FaCopy /> Copiar Token
              </>
            )}
          </button>
        </div>

        <div className="bg-gradient-to-br from-indigo-500/10 to-indigo-600/5 border-2 border-indigo-500/30 rounded-2xl p-8">
          <h3 className="text-xl font-black text-white mb-4">📋 Como Configurar</h3>
          
          <div className="space-y-4 text-gray-300">
            <div className="flex gap-3">
              <span className="flex-shrink-0 w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center font-bold text-white">
                1
              </span>
              <div>
                <p className="font-bold text-white">Copie a URL de Callback</p>
                <p className="text-sm">Cole no campo URL de callback ou Webhook URL do serviço externo</p>
              </div>
            </div>

            <div className="flex gap-3">
              <span className="flex-shrink-0 w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center font-bold text-white">
                2
              </span>
              <div>
                <p className="font-bold text-white">Copie o Token de Verificação</p>
                <p className="text-sm">Cole no campo Verify Token ou Token de verificação</p>
              </div>
            </div>

            <div className="flex gap-3">
              <span className="flex-shrink-0 w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center font-bold text-white">
                3
              </span>
              <div>
                <p className="font-bold text-white">Salve e Teste</p>
                <p className="text-sm">Clique em Verificar e Salvar no serviço externo</p>
              </div>
            </div>
          </div>

          {!ngrokUrl && (
            <div className="mt-6 bg-yellow-500/20 border-2 border-yellow-500/50 rounded-xl p-4">
              <p className="text-yellow-300 font-bold flex items-center gap-2">
                ⚠️ Aviso: Ngrok não detectado
              </p>
              <p className="text-yellow-200/80 text-sm mt-2">
                O webhook está usando URL local. Para receber webhooks de serviços externos, 
                inicie o ngrok com: <code className="bg-black/30 px-2 py-1 rounded">ngrok http 3001</code>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
