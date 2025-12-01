import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { FaArrowLeft, FaSync, FaCheckCircle, FaQrcode, FaWhatsapp } from 'react-icons/fa';
import api from '@/services/api';
import { useToast } from '@/hooks/useToast';
import ToastContainer from '@/components/ToastContainer';

interface UazInstance {
  id: number;
  name: string;
  session_name: string;
  is_connected: boolean;
  phone_number?: string;
}

export default function QrCodeUaz() {
  const router = useRouter();
  const { instance } = router.query;
  const { toasts, addToast, removeToast, warning, error, success } = useToast();
  
  const [instanceData, setInstanceData] = useState<UazInstance | null>(null);
  const [qrCode, setQrCode] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [processing409, setProcessing409] = useState(false); // Flag para evitar processamento duplicado

  const loadInstance = async () => {
    if (!instance) return;
    
    try {
      const response = await api.get(`/uaz/instances/${instance}`);
      if (response.data.success) {
        setInstanceData(response.data.data);
        
        // Se já está conectado, não precisa buscar QR Code
        if (!response.data.data.is_connected) {
          await loadQRCode();
        }
      }
    } catch (error: any) {
      console.error('Erro ao carregar instância:', error);
      
      // 🚨 Erro 404 = Instância foi deletada
      if (error.response?.status === 404) {
        console.log('❌ Instância não encontrada (404) ao carregar dados!');
        setAutoRefresh(false);
        
        warning(
          `⚠️ Instância não encontrada! Redirecionando para configurações...`
        );
        
        setTimeout(() => {
          router.push('/configuracoes-uaz');
        }, 3000);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadQRCode = async () => {
    if (!instance) return;
    
    setRefreshing(true);
    try {
      const response = await api.get(`/uaz/instances/${instance}/qrcode`);
      console.log('📋 Response completa da API:', response.data);
      
      if (response.data.success) {
        // Se já está conectado, atualiza a instância e para de buscar QR code
        if (response.data.connected || response.data.loggedIn) {
          console.log('✅ Instância já conectada! Atualizando estado...');
          await loadInstance();
          setAutoRefresh(false); // Para o auto-refresh
          return;
        }
        
        // QR Code vem em response.data.qrcode
        const qr = response.data.qrcode;
        console.log('🔍 QR Code recebido:', qr);
        
        // Verifica se o QR code é válido e não está vazio
        if (qr && typeof qr === 'string' && qr.length > 0) {
          console.log('✅ QR Code válido, definindo no estado');
          setQrCode(qr);
        } else {
          console.warn('⚠️ QR Code vazio ou inválido:', qr);
        }
      }
    } catch (err: any) {
      console.error('❌ Erro ao obter QR Code:', err);
      console.error('📦 Response error:', err.response?.data);
      
      // 🚨 Erro 404 = Instância foi deletada
      if (err.response?.status === 404) {
        console.log('❌ Instância não encontrada (404) - Foi deletada durante carregamento do QR Code!');
        setAutoRefresh(false); // Para o auto-refresh
        
        warning(
          `⚠️ Instância removida durante conexão (duplicação detectada). Redirecionando...`
        );
        
        setTimeout(() => {
          router.push('/configuracoes-uaz');
        }, 3000);
        
      // Erro 409 geralmente significa que já está conectado OU há conexão existente
      } else if (err.response?.status === 409) {
        const errorData = err.response?.data;
        
        setAutoRefresh(false); // Para o auto-refresh IMEDIATAMENTE
        
        // ⚠️ Evitar processamento duplicado
        if (processing409) {
          console.log('⏭️ Erro 409 já está sendo processado, ignorando...');
          return;
        }
        
        // Se for erro de conexão existente
        if (errorData?.existingConnection) {
          setProcessing409(true); // Marca que está processando
          
          console.log('🔄 ERRO 409: Já existe uma conexão na UAZ API! Verificando status...');
          console.log('   └─ Número detectado:', errorData?.phoneNumber);
          console.log('   └─ Status da instância existente:', errorData?.instanceStatus);
          
          // 🎯 TRATATIVA AUTOMÁTICA E SILENCIOSA
          try {
            // Buscar pelo número do telefone da instância atual
            let phoneToSearch = errorData?.phoneNumber || instanceData?.phone_number;
            
            if (!phoneToSearch) {
              console.log('ℹ️ Erro 409 sem número detectado - Ignorando silenciosamente');
              setProcessing409(false);
              // Não faz nada, apenas ignora o erro silenciosamente
              // Na próxima tentativa, se o QR Code for gerado com sucesso, vai funcionar
              return;
            }
            
            console.log(`🔍 Buscando instância existente com número: ${phoneToSearch}`);
            const searchResponse = await api.get(`/uaz/fetch-instances?phoneNumber=${encodeURIComponent(phoneToSearch)}`);
            
            if (searchResponse.data.success && searchResponse.data.found) {
              const foundInstance = searchResponse.data.instance;
              const isConnected = foundInstance.isConnected || foundInstance.status === 'connected';
              
              console.log(`📊 Instância encontrada! Status: ${isConnected ? 'CONECTADA' : 'DESCONECTADA'}`);
              
              if (isConnected) {
                // ✅ CASO 1: Instância está CONECTADA → IMPORTAR
                console.log('✅ Conexão está CONECTADA! Importando para a plataforma...');
                
                const importResponse = await api.post('/uaz/import-instances', {
                  instances: [foundInstance]
                });
                
                if (importResponse.data.success) {
                  console.log('✅ Instância importada automaticamente com sucesso!');
                  success('✅ Conexão importada com sucesso!');
                  
                  setTimeout(() => {
                    router.push('/configuracoes-uaz');
                  }, 2000);
                } else {
                  console.error('❌ Falha ao importar instância:', importResponse.data.error);
                  warning('⚠️ Não foi possível importar a conexão. Redirecionando...');
                  setTimeout(() => router.push('/configuracoes-uaz'), 2000);
                }
              } else {
                // 🗑️ CASO 2: Instância está DESCONECTADA → DELETAR + CONTINUAR
                console.log('🗑️ Conexão está DESCONECTADA! Deletando antiga e continuando...');
                
                try {
                  // Primeiro, buscar se essa instância já está no banco local
                  const localInstancesResponse = await api.get('/uaz/instances');
                  const localInstances = Array.isArray(localInstancesResponse.data) 
                    ? localInstancesResponse.data 
                    : (localInstancesResponse.data?.data || []);
                  
                  // Procurar instância pelo token
                  const localInstance = localInstances.find((inst: any) => 
                    inst.instance_token === foundInstance.token
                  );
                  
                  if (localInstance) {
                    // Se está no banco local, deletar usando o ID
                    console.log(`🗑️ Instância encontrada no banco local (ID: ${localInstance.id}). Deletando...`);
                    await api.delete(`/uaz/instances/${localInstance.id}`);
                    console.log('✅ Instância antiga deletada com sucesso do banco e da UAZ API!');
                  } else {
                    // Se não está no banco, apenas logar
                    console.log('ℹ️ Instância não está no banco local, apenas na UAZ API');
                    console.log('⏩ A nova conexão irá substituir a antiga automaticamente');
                  }
                  
                  // Aguardar 1 segundo para garantir que foi processado
                  await new Promise(resolve => setTimeout(resolve, 1000));
                  
                  // Deletar a instância atual que está causando conflito
                  if (instance) {
                    console.log(`🗑️ Deletando instância conflitante atual (ID: ${instance})...`);
                    try {
                      await api.delete(`/uaz/instances/${instance}`);
                      console.log('✅ Instância conflitante deletada!');
                    } catch (delError: any) {
                      console.warn('⚠️ Erro ao deletar instância conflitante:', delError.message);
                    }
                  }
                  
                  // Redirecionar para criar uma nova conexão
                  console.log('✅ Redirecionando para criar nova conexão...');
                  warning('⏩ Criando nova conexão...');
                  setTimeout(() => {
                    router.push('/configuracoes-uaz');
                  }, 1500);
                  
                } catch (deleteError: any) {
                  console.error('❌ Erro ao deletar instância antiga:', deleteError);
                  // Em caso de erro, redireciona para configurações
                  warning('⚠️ Redirecionando para gerenciar conexões...');
                  setTimeout(() => router.push('/configuracoes-uaz'), 2000);
                }
              }
            } else {
              console.log('ℹ️ Instância não encontrada na busca, tentando continuar fluxo normal...');
              // Se não encontrou, tenta continuar com o fluxo normal
              await loadQRCode();
            }
          } catch (treatmentError: any) {
            console.error('❌ Erro durante tratativa automática:', treatmentError);
            // Em caso de erro, apenas para e não mostra nada (QR Code já foi gerado)
            console.log('ℹ️ QR Code já foi gerado, parando processamento silencioso');
            setProcessing409(false);
          }
        } else {
          // Erro 409 genérico - provavelmente já conectado
          console.log('ℹ️ Erro 409 - Instância já conectada, atualizando estado...');
          await loadInstance();
          setAutoRefresh(false);
          setProcessing409(false);
        }
      } else {
        // Outros erros só mostram se o auto-refresh estiver ativo
        // (para não incomodar o usuário com erros repetidos)
        if (!autoRefresh) {
          error('❌ Erro ao obter QR Code: ' + (err.response?.data?.error || err.message));
        } else {
          console.warn('⚠️ Erro ao obter QR Code (será tentado novamente no próximo refresh)');
        }
      }
    } finally {
      setRefreshing(false);
    }
  };

  const checkStatus = async () => {
    if (!instance) return;
    
    try {
      const response = await api.get(`/uaz/instances/${instance}/status`);
      
      // 🔍 Verifica se houve detecção de duplicação
      if (response.data.duplicateDetected) {
        console.log('⚠️ DUPLICAÇÃO DETECTADA NA PÁGINA QR CODE!', response.data);
        setAutoRefresh(false); // Para o auto-refresh imediatamente
        
        const action = response.data.action;
        
        if (action === 'kept_old_connected') {
          // CASO 1: Antiga estava conectada, nova foi deletada
          const instanceName = response.data.importedInstance?.name || response.data.existingInstance?.name || 'Instância existente';
          const phoneNumber = response.data.duplicateNumber || 'N/A';
          
          warning(
            `⚠️ DUPLICAÇÃO DETECTADA! Esta instância foi removida porque já existe outra conectada com o mesmo número (${phoneNumber}). Instância mantida: ${instanceName}. Redirecionando...`
          );
          
          // Redireciona após 3 segundos
          setTimeout(() => {
            router.push('/configuracoes-uaz');
          }, 3000);
          
        } else if (action === 'kept_new_deleted_old') {
          // CASO 2: Antiga estava desconectada, nova foi mantida
          const instanceName = response.data.keptInstance?.name || 'Esta instância';
          const phoneNumber = response.data.keptInstance?.phone_number || 'N/A';
          
          success(
            `✅ DUPLICAÇÃO RESOLVIDA! Instância antiga desconectada foi removida. Mantida: ${instanceName} (${phoneNumber})`
          );
          
          // Recarrega a instância para atualizar o estado
          await loadInstance();
        }
      } else if (response.data.success) {
        await loadInstance();
      }
    } catch (error: any) {
      console.error('Erro ao verificar status:', error);
      
      // 🚨 Erro 404 = Instância foi deletada (provavelmente por duplicação)
      if (error.response?.status === 404) {
        console.log('❌ Instância não encontrada (404) - Foi deletada!');
        setAutoRefresh(false); // Para o auto-refresh
        
        warning(
          `⚠️ Instância não encontrada! Foi removida do sistema (duplicação ou exclusão manual). Redirecionando...`
        );
        
        // Redireciona após 3 segundos
        setTimeout(() => {
          router.push('/configuracoes-uaz');
        }, 3000);
      }
    }
  };

  useEffect(() => {
    loadInstance();
  }, [instance]);

  useEffect(() => {
    if (!autoRefresh || !instance || instanceData?.is_connected) return;

    const interval = setInterval(() => {
      checkStatus();
      if (!instanceData?.is_connected) {
        loadQRCode();
      }
    }, 3001); // Atualiza a cada 5 segundos

    return () => clearInterval(interval);
  }, [autoRefresh, instance, instanceData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-20 w-20 border-b-4 border-blue-500 mb-4"></div>
          <p className="text-2xl text-white/70">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!instanceData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-2xl text-white/70">Instância não encontrada</p>
          <button
            onClick={() => router.push('/configuracoes-uaz')}
            className="mt-6 px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold"
          >
            Voltar para Configurações
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 py-8 px-4">
      {/* Toast Container */}
      <ToastContainer toasts={toasts} onClose={removeToast} />
      
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* CABEÇALHO */}
        <div className="bg-gradient-to-r from-blue-600/30 via-indigo-500/20 to-blue-600/30 backdrop-blur-xl border-2 border-blue-500/40 rounded-3xl p-10 shadow-2xl">
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <button
                onClick={() => router.push('/configuracoes-uaz')}
                className="bg-white/10 hover:bg-white/20 p-4 rounded-xl transition-all duration-200 border-2 border-white/20 hover:border-white/40"
              >
                <FaArrowLeft className="text-3xl text-white" />
              </button>
              
              <div>
                <h1 className="text-5xl font-black text-white tracking-tight mb-2">
                  Conectar via QR Code
                </h1>
                <p className="text-xl text-white/80 font-medium">
                  {instanceData.name}
                </p>
              </div>
            </div>

            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center gap-3 px-6 py-4 rounded-xl text-lg font-bold transition-all duration-200 ${
                autoRefresh 
                  ? 'bg-green-500 hover:bg-green-600 text-white shadow-lg' 
                  : 'bg-white/10 hover:bg-white/20 text-white/80 border-2 border-white/20'
              }`}
            >
              <FaSync className={`${autoRefresh ? 'animate-spin' : ''}`} />
              Auto-refresh
            </button>
          </div>
        </div>

        {/* STATUS ATUAL */}
        {instanceData.is_connected ? (
          <div className="bg-green-500/20 border-2 border-green-500/40 rounded-2xl p-10 text-center">
            <div className="flex justify-center mb-6">
              <div className="bg-green-500/30 p-8 rounded-full">
                <FaCheckCircle className="text-8xl text-green-300" />
              </div>
            </div>
            <h2 className="text-4xl font-black text-white mb-4">✅ Instância Conectada!</h2>
            <p className="text-2xl text-green-300 mb-2">Número: {instanceData.phone_number}</p>
            <p className="text-white/70 text-lg">Você já pode enviar mensagens</p>
            
            <div className="mt-8 flex gap-4 justify-center">
              <button
                onClick={() => router.push('/uaz/enviar-mensagem-unificado')}
                className="px-8 py-4 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white text-lg font-bold rounded-xl shadow-lg"
              >
                Enviar Mensagem
              </button>
              <button
                onClick={() => router.push('/dashboard-uaz')}
                className="px-8 py-4 bg-white/10 hover:bg-white/20 text-white text-lg font-bold rounded-xl border-2 border-white/20"
              >
                Ir para Dashboard
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-blue-500/40 rounded-2xl p-10">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-black text-white mb-4">📱 Escaneie o QR Code</h2>
              <p className="text-white/70 text-lg">
                Abra o WhatsApp no seu celular e escaneie o código abaixo
              </p>
            </div>

            {/* QR CODE */}
            <div className="bg-white p-8 rounded-2xl flex items-center justify-center min-h-[400px] relative">
              {refreshing && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-2xl">
                  <FaSync className="text-6xl text-white animate-spin" />
                </div>
              )}
              
              {qrCode && typeof qrCode === 'string' ? (
                <img 
                  src={(() => {
                    // Remove duplicação do prefixo data:image se existir
                    let cleanQr = qrCode;
                    const duplicatedPrefix = 'data:image/png;base64,data:image/png;base64,';
                    if (cleanQr.startsWith(duplicatedPrefix)) {
                      cleanQr = cleanQr.replace(duplicatedPrefix, 'data:image/png;base64,');
                    }
                    // Adiciona o prefixo apenas se não existir
                    return cleanQr.startsWith('data:') ? cleanQr : `data:image/png;base64,${cleanQr}`;
                  })()}
                  alt="QR Code" 
                  className="max-w-full max-h-96"
                />
              ) : (
                <div className="text-center">
                  <FaQrcode className="text-8xl text-gray-300 mb-4 mx-auto" />
                  <p className="text-gray-500 text-lg">
                    {loading ? 'Gerando QR Code...' : 'Nenhum QR Code disponível'}
                  </p>
                </div>
              )}
            </div>

            {/* INSTRUÇÕES */}
            <div className="mt-8 bg-blue-500/10 border-2 border-blue-500/30 rounded-xl p-6">
              <h3 className="text-xl font-bold text-white mb-4">📋 Como conectar:</h3>
              <ol className="space-y-3 text-white/80">
                <li className="flex items-start gap-3">
                  <span className="bg-blue-500/30 text-blue-300 font-bold rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">1</span>
                  <span>Abra o WhatsApp no seu celular</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="bg-blue-500/30 text-blue-300 font-bold rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">2</span>
                  <span>Toque em <strong>Mais opções</strong> (⋮) e depois em <strong>Dispositivos conectados</strong></span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="bg-blue-500/30 text-blue-300 font-bold rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">3</span>
                  <span>Toque em <strong>Conectar um dispositivo</strong></span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="bg-blue-500/30 text-blue-300 font-bold rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">4</span>
                  <span>Aponte seu celular para esta tela para escanear o QR Code</span>
                </li>
              </ol>
            </div>

            {/* BOTÃO ATUALIZAR MANUAL */}
            <div className="mt-6 text-center">
              <button
                onClick={loadQRCode}
                disabled={refreshing}
                className="px-8 py-4 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border-2 border-blue-500/40 rounded-xl font-bold transition-all flex items-center gap-3 mx-auto disabled:opacity-50"
              >
                <FaSync className={refreshing ? 'animate-spin' : ''} />
                {refreshing ? 'Atualizando...' : 'Atualizar QR Code'}
              </button>
            </div>
          </div>
        )}

        {/* AVISO */}
        <div className="bg-yellow-500/10 border-2 border-yellow-500/30 rounded-xl p-6">
          <p className="text-yellow-300 text-center">
            <strong>💡 Dica:</strong> O QR Code expira após alguns segundos. Se não conseguir escanear, clique em "Atualizar QR Code"
          </p>
        </div>
      </div>
    </div>
  );
}

