const axios = require('axios');
const https = require('https');
const { HttpsProxyAgent } = require('hpagent');
const { SocksProxyAgent } = require('socks-proxy-agent');

function buildUazProxyUrl(scheme, proxyConfig) {
  const host = String(proxyConfig.host || '').trim();
  const port = Number(proxyConfig.port);
  if (proxyConfig.username && proxyConfig.password) {
    const user = encodeURIComponent(proxyConfig.username);
    const pass = encodeURIComponent(proxyConfig.password);
    return `${scheme}://${user}:${pass}@${host}:${port}`;
  }
  return `${scheme}://${host}:${port}`;
}

function isRetryableProxyError(error) {
  const msg = String(error?.message || error?.code || '');
  return /socket hang up|ECONNRESET|ETIMEDOUT|ECONNREFUSED|EPROTO|ECONNABORTED|timeout|Proxy connection ended|SOCKS|socket disconnected/i.test(msg)
    || ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'ECONNABORTED', 'EPROTO'].includes(error?.code);
}

function createUazProxyAgent(proxyConfig, timeout = 15000) {
  if (!proxyConfig || !proxyConfig.host || !proxyConfig.port) return null;

  const type = String(proxyConfig.type || 'socks5').toLowerCase();
  const opts = { timeout, keepAlive: false, rejectUnauthorized: false };

  if (type === 'socks5' || type === 'socks' || type === 'socks5h') {
    const proxyUrl = buildUazProxyUrl('socks5h', proxyConfig);
    console.log(`🌐 [UAZ Service] SOCKS5h ${proxyConfig.host}:${proxyConfig.port}`);
    return new SocksProxyAgent(proxyUrl, opts);
  }

  const scheme = type === 'https' ? 'https' : 'http';
  const proxyUrl = buildUazProxyUrl(scheme, proxyConfig);
  console.log(`🌐 [UAZ Service] ${scheme.toUpperCase()} proxy ${proxyConfig.host}:${proxyConfig.port}`);
  return new HttpsProxyAgent({
    proxy: proxyUrl,
    keepAlive: false,
    keepAliveMsecs: 30000,
    rejectUnauthorized: false
  });
}

class UazService {
  constructor(serverUrl, adminToken) {
    this.serverUrl = serverUrl;
    this.adminToken = adminToken;
  }

  createHttpClient(instanceToken = null, useAdminToken = false, proxyConfig = null, timeout = 30000) {
    const config = {
      baseURL: this.serverUrl,
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: timeout, // Timeout configurável (padrão 30s)
      maxBodyLength: 50 * 1024 * 1024, // 50MB
      maxContentLength: 50 * 1024 * 1024, // 50MB
      httpsAgent: new https.Agent({
        rejectUnauthorized: false,
        keepAlive: true,
        keepAliveMsecs: 30000
      })
    };

    // Define o header de autenticação apropriado
    if (useAdminToken) {
      config.headers['AdminToken'] = this.adminToken;
    } else if (instanceToken) {
      config.headers['token'] = instanceToken;
    }

    // Configura proxy se fornecido
    // MAS IGNORA proxy se a UAZ API for localhost (não faz sentido usar proxy para conexão local)
    const isLocalhost = this.serverUrl && (
      this.serverUrl.includes('localhost') || 
      this.serverUrl.includes('127.0.0.1') ||
      this.serverUrl.includes('0.0.0.0')
    );
    
    if (proxyConfig && proxyConfig.host && !isLocalhost) {
      try {
        const agent = createUazProxyAgent(proxyConfig, timeout);
        if (agent) {
          config.httpsAgent = agent;
          config.httpAgent = agent;
          config.proxy = false;
        }
      } catch (error) {
        console.error('⚠️  [UAZ Service] Erro ao configurar proxy, usando conexão direta:', error.message);
      }
    } else if (isLocalhost && proxyConfig) {
      console.log('📡 [UAZ Service] Conexão LOCAL detectada (localhost), IGNORANDO proxy configurado');
      console.log('   ℹ️  Proxies só são usados para conexões externas, não para localhost');
    } else {
      console.log('📡 [UAZ Service] Usando conexão direta (sem proxy)');
    }

    const client = axios.create(config);

    if (proxyConfig && proxyConfig.host && !isLocalhost) {
      client.interceptors.response.use(
        (response) => response,
        async (error) => {
          if (error.config?.__uazDirectRetry || !isRetryableProxyError(error)) {
            return Promise.reject(error);
          }
          console.warn(`⚠️ [UAZ Service] Proxy falhou (${error.message}). Tentando conexão DIRETA com a UAZ API...`);
          const directClient = this.createHttpClient(instanceToken, useAdminToken, null, timeout);
          return directClient.request({
            ...error.config,
            httpsAgent: new https.Agent({
              rejectUnauthorized: false,
              keepAlive: true,
              keepAliveMsecs: 30000
            }),
            httpAgent: undefined,
            proxy: false,
            __uazDirectRetry: true
          });
        }
      );
    }

    return client;
  }

  /**
   * Configura webhook para uma instância
   * @param {string} instanceToken - Token da instância
   * @param {object} proxyConfig - Configuração de proxy (opcional)
   * @param {string} customWebhookUrl - URL customizada do webhook (opcional)
   * @returns {Promise<object>}
   */
  async configureWebhook(instanceToken, proxyConfig = null, customWebhookUrl = null) {
    try {
      // URL do webhook do nosso sistema para QR Connect
      // PRIORIDADE: customWebhookUrl > process.env.QR_WEBHOOK_URL > process.env.WEBHOOK_BASE_URL + path > fallback
      const webhookUrl = customWebhookUrl || 
        process.env.QR_WEBHOOK_URL || 
        (process.env.WEBHOOK_BASE_URL ? `${process.env.WEBHOOK_BASE_URL}/api/qr-webhook/uaz-event` : null) ||
        'http://localhost:3001/api/qr-webhook/uaz-event';
      
      console.log('🔔 Configurando webhook COMPLETO (TODOS OS EVENTOS)...');
      console.log('   └─ URL:', webhookUrl);
      
      const client = this.createHttpClient(instanceToken, false, proxyConfig);
      
      // 🎯 ENDPOINT CORRETO DA UAZ API (conforme documentação oficial)
      const response = await client.post('/webhook', {
        enabled: true,
        url: webhookUrl,
        // 🚀 TODOS OS EVENTOS DISPONÍVEIS (conforme documentação UAZ API)
        events: [
          'connection',        // Alterações no estado da conexão
          'history',          // Recebimento de histórico de mensagens
          'messages',         // Novas mensagens recebidas
          'messages_update',  // Atualizações em mensagens existentes
          'call',            // Eventos de chamadas VoIP
          'contacts',        // Atualizações na agenda de contatos
          'presence',        // Alterações no status de presença
          'groups',          // Modificações em grupos
          'labels',          // Gerenciamento de etiquetas
          'chats',           // Eventos de conversas
          'chat_labels',     // Alterações em etiquetas de conversas
          'blocks',          // Bloqueios/desbloqueios
          'leads',           // Atualizações de leads
          'sender'           // Atualizações de campanhas
        ],
        // ⚠️ IMPORTANTE: Evita loops infinitos em automações
        excludeMessages: ['wasSentByApi']
      });
      
      console.log('✅ Webhook configurado com SUCESSO!');
      console.log('   ├─ Eventos habilitados: TODOS (14 eventos)');
      console.log('   ├─ Filtro: excludeMessages = wasSentByApi');
      console.log('   └─ Modo: Tempo real (webhooks ativos)');
      
      return {
        success: true,
        data: response.data,
        message: 'Webhook configurado com todos os eventos habilitados'
      };
    } catch (error) {
      console.error('❌ Erro ao configurar webhook:', error.message);
      console.error('   └─ Response:', error.response?.data);
      
      return {
        success: false,
        error: error.response?.data?.error || error.message
      };
    }
  }

  /**
   * Cria uma nova instância no UAZ API
   * @param {string} instanceName - Nome da instância
   * @param {object} proxyConfig - Configuração de proxy (opcional)
   * @returns {Promise<object>}
   */
  async createInstance(instanceName, proxyConfig = null) {
    try {
      const client = this.createHttpClient(null, true, proxyConfig); // true = usar AdminToken
      const response = await client.post(`/instance/init`, {
        name: instanceName
      });

      const instanceToken = response.data?.instance?.token || response.data?.token;
      
      // Tentar configurar webhook automaticamente
      if (instanceToken) {
        await this.configureWebhook(instanceToken, proxyConfig);
      }
      
      return {
        success: true,
        data: response.data,
        instanceToken: instanceToken,
        instanceId: response.data?.instance?.id
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Busca todas as instâncias criadas na UAZ API
   * @param {object} proxyConfig - Configuração de proxy (opcional)
   * @returns {Promise<object>}
   */
  async fetchInstances(proxyConfig = null) {
    try {
      const client = this.createHttpClient(null, true, proxyConfig); // true = usar AdminToken
      
      console.log('📥 Buscando todas as instâncias da UAZ API...');
      console.log('   └─ Endpoint: GET /instance/all');
      
      const response = await client.get(`/instance/all`);
      
      // A resposta vem como um array direto, não como {instances: [...]}
      const instances = Array.isArray(response.data) ? response.data : [];
      
      console.log('✅ Instâncias encontradas:', instances.length);
      
      return {
        success: true,
        instances: instances,
        data: response.data
      };
    } catch (error) {
      console.error('❌ Erro ao buscar instâncias da UAZ API:', error.message);
      console.error('   └─ Response:', error.response?.data);
      
      return {
        success: false,
        error: error.response?.data?.error || error.response?.data?.message || error.message,
        instances: []
      };
    }
  }

  /**
   * Inicia uma sessão e obtém o QR Code
   * @param {string} instanceToken - Token da instância
   * @param {string} phoneNumber - Número de telefone (opcional)
   * @param {object} proxyConfig - Configuração de proxy (opcional)
   * @returns {Promise<object>}
   */
  async getQRCode(instanceToken, phoneNumber = null, proxyConfig = null) {
    try {
      const client = this.createHttpClient(instanceToken, false, proxyConfig);
      const body = phoneNumber ? { phone: phoneNumber } : {};
      
      console.log('📞 Chamando UAZ API /instance/connect...');
      console.log('   └─ Token:', instanceToken?.substring(0, 20) + '...');
      console.log('   └─ Phone:', phoneNumber || 'não fornecido');
      
      const response = await client.post(`/instance/connect`, body);
      
      console.log('📦 Resposta completa da UAZ API:');
      console.log(JSON.stringify(response.data, null, 2));
      
      // Extrair QR code de possíveis localizações
      const qrCode = response.data?.instance?.qrcode || response.data?.qrcode || null;
      
      // VALIDAÇÃO RIGOROSA DO STATUS DE CONEXÃO
      // Verificar múltiplos campos para confirmar se realmente está conectado
      const instanceState = response.data?.instance?.state || response.data?.state;
      const instanceStatus = response.data?.instance?.status;
      const isConnected = response.data?.connected === true;
      const isLoggedIn = response.data?.loggedIn === true;
      
      // Considerar válido se:
      // - instance.state é 'open' ou 'connected' OU
      // - instance.status é 'connected' (quando state é undefined)
      const hasValidState = instanceState === 'open' || instanceState === 'connected';
      const hasValidStatus = instanceStatus === 'connected';
      const hasValidSession = hasValidState || hasValidStatus;
      
      // Só considera conectado se TODOS os critérios forem satisfeitos
      const actuallyConnected = (isConnected || isLoggedIn) && hasValidSession;
      
      // Se tem QR code, definitivamente NÃO está conectado
      const hasQRCode = qrCode && qrCode.length > 0;
      const finalConnectedStatus = hasQRCode ? false : actuallyConnected;
      
      console.log('🔍 Análise de Status:');
      console.log('   └─ QR Code presente:', hasQRCode ? 'SIM (NÃO conectado)' : 'NÃO');
      console.log('   └─ response.data.connected:', isConnected);
      console.log('   └─ response.data.loggedIn:', isLoggedIn);
      console.log('   └─ instance.state:', instanceState || 'não informado');
      console.log('   └─ instance.status:', instanceStatus || 'não informado');
      console.log('   └─ Valid Session:', hasValidSession ? '✅' : '❌');
      console.log('   └─ Status final:', finalConnectedStatus ? '✅ CONECTADO' : '❌ NÃO CONECTADO');
      
      return {
        success: true,
        data: response.data,
        qrcode: qrCode,
        connected: finalConnectedStatus,
        loggedIn: isLoggedIn,
        state: instanceState
      };
    } catch (error) {
      console.error('❌ Erro ao obter QR Code da UAZ API:');
      console.error('   └─ Mensagem:', error.message);
      console.error('   └─ Response:', error.response?.data);
      
      // 🚨 CASO ESPECIAL: Erro 409 - "Connection attempt in progress"
      // Isso significa que JÁ EXISTE uma conexão ativa ou em andamento com este número
      if (error.response?.status === 409) {
        const errorResponse = error.response.data;
        const errorMessage = errorResponse?.response || errorResponse?.error || errorResponse?.message || '';
        
        // Se a mensagem indica que há uma tentativa de conexão em andamento
        if (errorMessage.toLowerCase().includes('connection attempt in progress') || 
            errorMessage.toLowerCase().includes('please wait')) {
          console.warn('⚠️  ERRO 409: Já existe uma conexão ativa ou tentativa em andamento!');
          console.warn('   └─ Número:', errorResponse?.instance?.owner || 'não identificado');
          console.warn('   └─ Status:', errorResponse?.instance?.status || 'desconhecido');
          
          return {
            success: false,
            error: 'JÁ EXISTE UMA CONEXÃO ATIVA OU EM ANDAMENTO COM ESTE NÚMERO. Aguarde 2 minutos ou delete a instância antiga.',
            errorCode: 409,
            existingConnection: true,
            phoneNumber: errorResponse?.instance?.owner || null,
            instanceToken: errorResponse?.instance?.token || null,
            instanceId: errorResponse?.instance?.id || null,
            instanceName: errorResponse?.instance?.name || null,
            instanceStatus: errorResponse?.instance?.status || 'unknown'
          };
        }
      }
      
      return {
        success: false,
        error: error.response?.data?.error || error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Verifica o status da conexão
   * @param {string} instanceToken - Token da instância
   * @param {object} proxyConfig - Configuração de proxy (opcional)
   * @returns {Promise<object>}
   */
  async getStatus(instanceToken, proxyConfig = null) {
    try {
      const client = this.createHttpClient(instanceToken, false, proxyConfig);
      
      console.log('📞 Verificando status da instância...');
      console.log('   └─ Token:', instanceToken?.substring(0, 20) + '...');
      
      const response = await client.get(`/instance/status`);
      
      console.log('📦 Status retornado da UAZ API:');
      console.log(JSON.stringify(response.data, null, 2));
      
      const qrCode = response.data?.qrcode;
      const pairCode = response.data?.paircode;
      const statusData = response.data?.status;
      const instanceState = response.data?.instance?.state || response.data?.state;
      const instanceStatus = response.data?.instance?.status;
      
      // VALIDAÇÃO RIGOROSA DO STATUS
      const hasQRCode = qrCode && qrCode.length > 0;
      const connectedFlag = response.data?.connected === true || statusData?.connected === true;
      const loggedInFlag = response.data?.loggedIn === true || statusData?.loggedIn === true;
      
      // Considerar válido se:
      // - instance.state é 'open' ou 'connected' OU
      // - instance.status é 'connected' (quando state é undefined)
      const hasValidState = instanceState === 'open' || instanceState === 'connected';
      const hasValidStatus = instanceStatus === 'connected';
      const validSession = hasValidState || hasValidStatus;
      
      // Se tem QR code = definitivamente NÃO está conectado
      const isConnected = !hasQRCode && (connectedFlag || loggedInFlag) && validSession;
      
      console.log('🔍 Análise de Status:');
      console.log('   ├─ Tem QR Code:', hasQRCode ? 'SIM (NÃO conectado)' : 'NÃO');
      console.log('   ├─ Flag connected:', connectedFlag ? '✅' : '❌');
      console.log('   ├─ Flag loggedIn:', loggedInFlag ? '✅' : '❌');
      console.log('   ├─ State:', instanceState || 'não informado');
      console.log('   ├─ Status:', instanceStatus || 'não informado');
      console.log('   ├─ Valid Session:', validSession ? '✅' : '❌');
      console.log('   └─ 🎯 CONECTADO:', isConnected ? '✅ SIM' : '❌ NÃO');
      
      return {
        success: true,
        data: response.data,
        qrcode: qrCode,
        paircode: pairCode,
        status: statusData,
        state: instanceState,
        connected: isConnected
      };
    } catch (error) {
      console.error('❌ Erro ao verificar status:');
      console.error('   └─ Mensagem:', error.message);
      console.error('   └─ Response:', error.response?.data);
      
      return {
        success: false,
        error: error.response?.data?.error || error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Desconecta a instância
   * @param {string} instanceToken - Token da instância
   * @param {object} proxyConfig - Configuração de proxy (opcional)
   * @returns {Promise<object>}
   */
  async disconnect(instanceToken, proxyConfig = null) {
    try {
      const client = this.createHttpClient(instanceToken, false, proxyConfig);
      const response = await client.post(`/instance/disconnect`);
      
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Deleta permanentemente a instância da API UAZ
   * @param {string} instanceToken - Token da instância
   * @param {object} proxyConfig - Configuração de proxy (opcional)
   * @returns {Promise<object>}
   */
  async deleteInstance(instanceToken, proxyConfig = null) {
    try {
      const client = this.createHttpClient(instanceToken, false, proxyConfig);
      
      console.log('🗑️ Deletando instância da API UAZ...');
      console.log('   └─ Token:', instanceToken?.substring(0, 20) + '...');
      
      const response = await client.delete(`/instance`);
      
      console.log('✅ Instância deletada com sucesso da API UAZ');
      console.log('   └─ Response:', response.data?.response || 'Instance Deleted');
      
      return {
        success: true,
        data: response.data,
        message: response.data?.info || 'Instância removida com sucesso da API UAZ'
      };
    } catch (error) {
      console.error('❌ Erro ao deletar instância da API UAZ:', error.message);
      console.error('   └─ Response:', error.response?.data);
      
      return {
        success: false,
        error: error.response?.data?.error || error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Atualiza o nome da instância na API UAZ
   * @param {string} instanceToken - Token da instância
   * @param {string} newName - Novo nome para a instância
   * @param {object} proxyConfig - Configuração de proxy (opcional)
   * @returns {Promise<object>}
   */
  async updateInstanceName(instanceToken, newName, proxyConfig = null) {
    try {
      const client = this.createHttpClient(instanceToken, false, proxyConfig);
      
      console.log('✏️ Atualizando nome da instância na API UAZ...');
      console.log('   └─ Token:', instanceToken?.substring(0, 20) + '...');
      console.log('   └─ Novo nome:', newName);
      console.log('   └─ Endpoint: POST /instance/updateInstanceName');
      
      const response = await client.post(`/instance/updateInstanceName`, {
        name: newName
      });
      
      console.log('✅ Nome da instância atualizado com sucesso na API UAZ');
      console.log('   └─ Nome atualizado:', response.data?.name || newName);
      console.log('   └─ Response completa:', JSON.stringify(response.data, null, 2));
      
      return {
        success: true,
        data: response.data,
        message: 'Nome da instância atualizado com sucesso na API UAZ'
      };
    } catch (error) {
      console.error('❌ Erro ao atualizar nome da instância na API UAZ:', error.message);
      console.error('   └─ Response:', error.response?.data);
      console.error('   └─ Status:', error.response?.status);
      
      return {
        success: false,
        error: error.response?.data?.error || error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Atualiza o nome do perfil do WhatsApp (visível para contatos)
   * @param {string} instanceToken - Token da instância
   * @param {string} profileName - Novo nome do perfil
   * @param {object} proxyConfig - Configuração de proxy (opcional)
   * @returns {Promise<object>}
   */
  async updateProfileName(instanceToken, profileName, proxyConfig = null) {
    try {
      const client = this.createHttpClient(instanceToken, false, proxyConfig);
      
      console.log('👤 Atualizando nome do perfil do WhatsApp...');
      console.log('   └─ Token:', instanceToken?.substring(0, 20) + '...');
      console.log('   └─ Novo nome do perfil:', profileName);
      console.log('   └─ Endpoint: POST /profile/name');
      
      const response = await client.post(`/profile/name`, {
        name: profileName
      });
      
      console.log('✅ Nome do perfil atualizado com sucesso no WhatsApp');
      console.log('   └─ Nome do perfil:', response.data?.profile?.name || profileName);
      console.log('   └─ Response:', JSON.stringify(response.data, null, 2));
      
      return {
        success: true,
        data: response.data,
        profile_name: response.data?.profile?.name || profileName,
        message: 'Nome do perfil atualizado com sucesso no WhatsApp'
      };
    } catch (error) {
      console.error('❌ Erro ao atualizar nome do perfil no WhatsApp:', error.message);
      console.error('   └─ Response:', error.response?.data);
      console.error('   └─ Status:', error.response?.status);
      
      return {
        success: false,
        error: error.response?.data?.error || error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Atualiza a foto do perfil do WhatsApp
   * @param {string} instanceToken - Token da instância
   * @param {string} imageUrl - URL da imagem, base64 ou "remove"/"delete"
   * @param {object} proxyConfig - Configuração de proxy (opcional)
   * @returns {Promise<object>}
   */
  async updateProfileImage(instanceToken, imageUrl, proxyConfig = null) {
    try {
      const client = this.createHttpClient(instanceToken, false, proxyConfig);
      
      console.log('📸 Atualizando foto do perfil do WhatsApp...');
      console.log('   └─ Token:', instanceToken?.substring(0, 20) + '...');
      console.log('   └─ Imagem:', imageUrl === 'remove' || imageUrl === 'delete' ? 'REMOVER' : 'ATUALIZAR');
      console.log('   └─ Endpoint: POST /profile/image');
      
      const response = await client.post(`/profile/image`, {
        image: imageUrl
      });
      
      console.log('✅ Foto do perfil atualizada com sucesso no WhatsApp');
      console.log('   └─ Response:', JSON.stringify(response.data, null, 2));
      
      return {
        success: true,
        data: response.data,
        message: imageUrl === 'remove' || imageUrl === 'delete' 
          ? 'Foto do perfil removida com sucesso' 
          : 'Foto do perfil atualizada com sucesso'
      };
    } catch (error) {
      console.error('❌ Erro ao atualizar foto do perfil no WhatsApp:', error.message);
      console.error('   └─ Response:', error.response?.data);
      console.error('   └─ Status:', error.response?.status);
      
      return {
        success: false,
        error: error.response?.data?.error || error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Envia mensagem de texto
   * @param {string} instanceToken - Token da instância
   * @param {object} data - Dados da mensagem { phone, message }
   * @param {object} proxyConfig - Configuração de proxy (opcional)
   * @returns {Promise<object>}
   */
  async sendText(instanceToken, data, proxyConfig = null) {
    try {
      const client = this.createHttpClient(instanceToken, false, proxyConfig);
      const response = await client.post(`/send/text`, data);
      
      console.log('📩 UAZ Response completa:', JSON.stringify(response.data, null, 2));
      
      // Verificar se houve erro na resposta da UAZ (mesmo com status 200)
      if (response.data?.error || response.data?.status === false || response.data?.status === 'error') {
        const rawError = response.data?.error;
        const errorMsg = (typeof rawError === 'string' && rawError)
          ? rawError
          : (rawError === true ? 'Instância desconectada ou sem resposta do WhatsApp. Verifique a conexão.' : null)
          || (response.data?.message ? String(response.data.message) : null)
          || 'Erro desconhecido na UAZ API';
        console.error('❌ UAZ API retornou erro:', rawError, '→ Mensagem:', errorMsg);
        return {
          success: false,
          error: errorMsg,
          details: response.data
        };
      }
      
      // Extrair o messageId da resposta da UAZ
      const messageId = response.data?.key?.id || response.data?.messageId || response.data?.messageid || response.data?.id || null;
      
      // Se não conseguiu extrair messageId, pode ser um problema
      if (!messageId) {
        console.warn('⚠️ UAZ Response sem Message ID:', response.data);
      } else {
        console.log('✅ UAZ Message ID:', messageId);
      }
      
      return {
        success: true,
        messageId: messageId,
        data: response.data
      };
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message;
      
      // Se o erro for de parsing HTTP e há proxy configurado, tentar sem proxy
      if (proxyConfig && (errorMessage.includes('Parse Error') || errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ETIMEDOUT'))) {
        console.warn('⚠️  [UAZ Service] Erro com proxy, tentando sem proxy...', errorMessage);
        try {
          const clientWithoutProxy = this.createHttpClient(instanceToken, false, null);
          const retryResponse = await clientWithoutProxy.post(`/send/text`, data);
          
          const messageId = retryResponse.data?.key?.id || retryResponse.data?.messageId || retryResponse.data?.id || null;
          console.log('✅ [UAZ Service] Sucesso na segunda tentativa SEM proxy!');
          console.log('📩 UAZ Response - Message ID:', messageId);
          
          return {
            success: true,
            messageId: messageId,
            data: retryResponse.data,
            usedFallback: true
          };
        } catch (retryError) {
          console.error('❌ [UAZ Service] Falhou também sem proxy:', retryError.message);
          return {
            success: false,
            error: retryError.response?.data?.message || retryError.message,
            details: retryError.response?.data
          };
        }
      }
      
      return {
        success: false,
        error: errorMessage,
        details: error.response?.data
      };
    }
  }

  /**
   * Envia mensagem com mídia (imagem, vídeo, áudio, documento)
   * @param {string} instanceToken - Token da instância
   * @param {object} data - { number, type, file, text (opcional), docname (opcional) }
   *   - number: Número do destinatário (obrigatório)
   *   - type: "image", "video", "document", "audio", "sticker" (obrigatório)
   *   - file: URL base64 ou URL do arquivo (obrigatório)
   *   - text: Legenda/Caption (opcional)
   *   - docname: Nome do documento (opcional, para type="document")
   * @param {object} proxyConfig - Configuração de proxy (opcional)
   * @returns {Promise<object>}
   */
  async sendMedia(instanceToken, data, proxyConfig = null) {
    try {
      const client = this.createHttpClient(instanceToken, false, proxyConfig);
      const response = await client.post(`/send/media`, data);
      
      console.log('📩 UAZ Response completa:', JSON.stringify(response.data, null, 2));
      
      // Verificar se houve erro na resposta da UAZ (mesmo com status 200)
      if (response.data?.error || response.data?.status === false || response.data?.status === 'error') {
        const rawError = response.data?.error;
        const errorMsg = (typeof rawError === 'string' && rawError)
          ? rawError
          : (rawError === true ? 'Instância desconectada ou sem resposta do WhatsApp. Verifique a conexão.' : null)
          || (response.data?.message ? String(response.data.message) : null)
          || 'Erro desconhecido na UAZ API';
        console.error('❌ UAZ API retornou erro:', rawError, '→ Mensagem:', errorMsg);
        return {
          success: false,
          error: errorMsg,
          details: response.data
        };
      }
      
      // Extrair o messageId da resposta da UAZ
      const messageId = response.data?.key?.id || response.data?.messageId || response.data?.messageid || response.data?.id || null;
      
      // Se não conseguiu extrair messageId, pode ser um problema
      if (!messageId) {
        console.warn('⚠️ UAZ Response sem Message ID:', response.data);
      } else {
        console.log('✅ UAZ Message ID:', messageId);
      }
      
      return {
        success: true,
        messageId: messageId,
        data: response.data
      };
    } catch (error) {
      console.error('❌ Erro ao enviar mídia:', error.message);
      console.error('   Detalhes:', error.response?.data);
      return {
        success: false,
        error: error.response?.data?.message || error.response?.data?.error || error.message,
        details: error.response?.data
      };
    }
  }

  /**
   * Verifica se um número está registrado no WhatsApp
   * @param {string} instanceToken - Token da instância
   * @param {string} phoneNumber - Número de telefone
   * @param {object} proxyConfig - Configuração de proxy (opcional)
   * @returns {Promise<object>}
   */
  async checkNumber(instanceToken, phoneNumber, proxyConfig = null) {
    try {
      console.log(`🔍 Verificando número único: ${phoneNumber}`);
      
      const client = this.createHttpClient(instanceToken, false, proxyConfig);
      
      // ✅ ROTA CORRETA: POST /chat/check com array de números
      const response = await client.post(`/chat/check`, {
        numbers: [phoneNumber]
      });
      
      console.log(`📋 Resposta da API para ${phoneNumber}:`, JSON.stringify(response.data, null, 2));
      
      // A resposta é um array de objetos
      const result = Array.isArray(response.data) && response.data.length > 0 ? response.data[0] : {};
      
      // Campo correto da API: isInWhatsapp
      const exists = result?.isInWhatsapp || false;
      
      console.log(`   └─ isInWhatsapp: ${exists}`);
      console.log(`   └─ verifiedName: ${result?.verifiedName || 'N/A'}`);
      console.log(`   └─ jid: ${result?.jid || 'N/A'}`);
      
      return {
        success: true,
        data: {
          verifiedName: result?.verifiedName || null,
          jid: result?.jid || null,
          isInWhatsapp: exists
        },
        exists: exists
      };
    } catch (error) {
      console.error(`❌ Erro ao verificar número ${phoneNumber}:`, error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message,
        exists: false
      };
    }
  }


  /**
   * Verifica múltiplos números com delay configurável
   * @param {string} instanceToken - Token da instância
   * @param {array} phoneNumbers - Array de números
   * @param {object} proxyConfig - Configuração de proxy (opcional)
   * @param {number} delaySeconds - Delay entre verificações em segundos (opcional)
   * @returns {Promise<object>}
   */
  async checkNumbers(instanceToken, phoneNumbers, proxyConfig = null, delaySeconds = 0) {
    try {
      const client = this.createHttpClient(instanceToken, false, proxyConfig);
      
      console.log(`📞 Verificando ${phoneNumbers.length} números...`);
      console.log(`📋 Números a verificar:`, phoneNumbers);
      console.log(`⏱️ Delay configurado: ${delaySeconds}s entre verificações`);
      
      const results = [];
      
      // Verificar números com delay entre cada um
      for (let i = 0; i < phoneNumbers.length; i++) {
        const phone = phoneNumbers[i];
        
        try {
          console.log(`🔍 [${i + 1}/${phoneNumbers.length}] Verificando: ${phone}`);
          
          // ✅ ROTA CORRETA: POST /chat/check
          const response = await client.post(`/chat/check`, {
            numbers: [phone]
          });
          
          const apiResult = Array.isArray(response.data) && response.data.length > 0 ? response.data[0] : {};
          const exists = apiResult?.isInWhatsapp || false;
          
          console.log(`${exists ? '✅' : '❌'} ${phone}: ${exists ? 'TEM WhatsApp' : 'NÃO tem WhatsApp'}`);
          
          results.push({
            phone: phone,
            exists: exists,
            valid: true,
            verifiedName: apiResult?.verifiedName || null,
            jid: apiResult?.jid || null
          });
          
          // Aplicar delay entre verificações (exceto na última)
          if (delaySeconds > 0 && i < phoneNumbers.length - 1) {
            console.log(`⏳ Aguardando ${delaySeconds}s antes da próxima verificação...`);
            await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
          }
          
        } catch (error) {
          console.error(`❌ Erro ao verificar ${phone}:`, error.response?.data || error.message);
          results.push({
            phone: phone,
            exists: false,
            valid: false,
            error: error.response?.data?.message || error.message
          });
        }
      }
      
      console.log(`\n📊 Resumo da verificação:`);
      console.log(`   Total: ${phoneNumbers.length}`);
      console.log(`   ✅ Válidos: ${results.filter(r => r.exists).length}`);
      console.log(`   ❌ Inválidos: ${results.filter(r => !r.exists).length}\n`);
      
      return {
        success: true,
        data: results,
        total: phoneNumbers.length,
        valid: results.filter(r => r.exists).length,
        invalid: results.filter(r => !r.exists).length
      };
    } catch (error) {
      console.error(`❌ Erro geral ao verificar números:`, error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Envia menu interativo (botões, lista, enquete ou carousel)
   * @param {string} instanceToken - Token da instância
   * @param {object} menuData - Dados do menu
   * @param {object} proxyConfig - Configuração de proxy (opcional)
   * @returns {Promise<object>}
   */
  async sendMenu(instanceToken, menuData, proxyConfig = null) {
    try {
      const client = this.createHttpClient(instanceToken, false, proxyConfig);
      const payload = {
        ...menuData,
        text: (menuData.text && String(menuData.text).trim()) ? menuData.text : 'Mensagem com botões',
        readchat: menuData.readchat !== false
      };
      if (!payload.footerText) {
        delete payload.footerText;
      }
      
      console.log('📤 Enviando menu via UAZ API:', JSON.stringify({
        ...payload,
        imageButton: payload.imageButton
          ? `[${String(payload.imageButton).startsWith('data:') ? 'base64' : 'url'} ${Math.round(String(payload.imageButton).length / 1024)} KB]`
          : undefined
      }, null, 2));
      console.log(`🔗 URL: ${this.serverUrl}/send/menu`);
      console.log(`🎯 Tipo: ${payload.type}`);
      console.log(`📝 Choices: ${payload.choices?.length || 0} itens`);
      
      if (payload.type === 'list' && payload.choices) {
        const sections = payload.choices.filter(c => c.startsWith('[')).length;
        const items = payload.choices.filter(c => !c.startsWith('[')).length;
        console.log(`   └─ Seções: ${sections}, Itens: ${items}`);
      }
      
      const response = await client.post(`/send/menu`, payload);
      
      console.log('✅ Resposta da UAZ API:', JSON.stringify(response.data, null, 2));
      
      // Verificar se houve erro na resposta da UAZ (mesmo com status 200)
      if (response.data?.error || response.data?.status === false || response.data?.status === 'error') {
        const rawError = response.data?.error;
        // Tratar error:true (boolean) - geralmente significa instância desconectada
        let errorMsg;
        if (typeof rawError === 'string' && rawError) {
          errorMsg = rawError;
        } else if (rawError === true) {
          errorMsg = 'Instância desconectada ou sem resposta do WhatsApp. Verifique a conexão em "Gerenciar Conexões".';
        } else {
          errorMsg = (response.data?.message ? String(response.data.message) : null) || 'Erro desconhecido na UAZ API';
        }
        console.error('❌ UAZ API retornou erro:', rawError, '→ Mensagem:', errorMsg);
        throw new Error(errorMsg);
      }
      
      // Extrair o messageId da resposta da UAZ
      const messageId = response.data?.key?.id || response.data?.messageId || response.data?.messageid || response.data?.id || null;
      
      console.log('📊 Content da resposta:', JSON.stringify(response.data.content, null, 2));
      
      // Se não conseguiu extrair messageId, pode ser um problema
      if (!messageId) {
        console.warn('⚠️ UAZ Response sem Message ID:', response.data);
      } else {
        console.log('✅ UAZ Message ID:', messageId);
      }
      
      return {
        success: true,
        messageId: messageId,
        data: response.data
      };
    } catch (error) {
      console.error('❌ Erro ao enviar menu:', error.response?.data || error.message);
      if (error.response?.data) {
        console.error('📋 Payload que causou erro:', JSON.stringify(menuData, null, 2));
      }
      // Preservar mensagem de erro já formatada (lançada internamente)
      if (!error.response) {
        throw error; // Relancar erro interno sem re-wrap
      }
      const rawErrData = error.response?.data?.error;
      const errMsg = (typeof rawErrData === 'string' && rawErrData)
        ? rawErrData
        : (rawErrData === true ? 'Instância desconectada ou sem resposta do WhatsApp.' : null)
        || error.response?.data?.message
        || error.message;
      throw new Error(errMsg);
    }
  }

  /**
   * Envia carrossel de mídia com botões
   * @param {string} instanceToken - Token da instância
   * @param {string} number - Número de destino
   * @param {string} text - Texto principal (opcional)
   * @param {Array} cards - Array de cards com imagem e botões
   * @param {object} proxyConfig - Configuração de proxy (opcional)
   * @returns {Promise<object>}
   */
  async sendCarousel(instanceToken, number, text, cards, proxyConfig = null) {
    try {
      // Timeout maior para carrossel (60 segundos) pois pode ter várias imagens
      const client = this.createHttpClient(instanceToken, false, proxyConfig, 60000);
      
      // VALIDAÇÕES ANTES DE ENVIAR
      if (!cards || cards.length === 0) {
        throw new Error('Carrossel deve ter pelo menos 1 card');
      }
      
      if (cards.length > 10) {
        console.warn(`⚠️ AVISO: Carrossel com ${cards.length} cards (máximo recomendado: 10)`);
      }
      
      // Converter cards para o formato correto da UAZ API
      // A API UAZ espera "carousel" com botões tendo campos separados
      const carousel = cards.map((card, cardIndex) => {
        // VALIDAR CARD
        if (!card.image) {
          console.warn(`⚠️ Card ${cardIndex + 1} sem imagem!`);
        }
        
        if (!card.buttons || card.buttons.length === 0) {
          console.warn(`⚠️ Card ${cardIndex + 1} sem botões!`);
        }
        
        if (card.buttons && card.buttons.length > 3) {
          console.warn(`⚠️ Card ${cardIndex + 1} com ${card.buttons.length} botões (máximo recomendado: 3)`);
        }
        
        return {
          text: card.text || '',
          image: card.image || '',
          buttons: (card.buttons || []).map((btn, btnIndex) => {
            // VALIDAR BOTÃO
            if (!btn.text) {
              console.warn(`⚠️ Card ${cardIndex + 1}, Botão ${btnIndex + 1} sem texto!`);
            }
            
            // ✅ FORMATO CORRETO PARA /send/carousel: Objeto com id, text, type
            // Se btn já for string (formato antigo "text|value"), converter para objeto
            if (typeof btn === 'string') {
              const parts = btn.split('|');
              const buttonText = parts[0] || `Botão ${btnIndex + 1}`;
              const buttonValue = parts[1] || buttonText;
              
              // Detectar tipo pelo valor
              let buttonType = 'REPLY';
              let buttonId = buttonValue;
              
              if (buttonValue.startsWith('http://') || buttonValue.startsWith('https://')) {
                buttonType = 'URL';
                buttonId = buttonValue;
              } else if (buttonValue.startsWith('call:')) {
                buttonType = 'CALL';
                buttonId = buttonValue.replace('call:', '');
              } else if (buttonValue.startsWith('copy:')) {
                buttonType = 'COPY';
                buttonId = buttonValue.replace('copy:', '');
              }
              
              return {
                id: buttonId,
                text: buttonText,
                type: buttonType
              };
            }
            
            // Se já for objeto, usar diretamente (mas garantir formato correto)
            const buttonText = btn.text || `Botão ${btnIndex + 1}`;
            let buttonType = btn.type || 'REPLY';
            let buttonId = btn.id;
            
            // Se não tiver id, criar baseado no tipo
            if (!buttonId) {
              switch (buttonType) {
                case 'URL':
                  buttonId = btn.url || buttonText;
                  break;
                case 'CALL':
                  buttonId = btn.phone_number || buttonText;
                  break;
                case 'COPY':
                  buttonId = btn.copy_code || buttonText;
                  break;
                case 'REPLY':
                default:
                  buttonId = btn.id || buttonText;
                  break;
              }
            }
            
            // Garantir que o id está correto para cada tipo
            if (buttonType === 'URL' && btn.url) {
              buttonId = btn.url;
            } else if (buttonType === 'CALL' && btn.phone_number) {
              buttonId = btn.phone_number;
            } else if (buttonType === 'COPY' && btn.copy_code) {
              buttonId = btn.copy_code;
            }
            
            console.log(`   📍 Card ${cardIndex + 1}, Botão ${btnIndex + 1}: ${buttonType} - "${buttonText}" (id: ${buttonId})`);
            
            return {
              id: buttonId,
              text: buttonText,
              type: buttonType
            };
          })
        };
      });

      // ✅ VALIDAR ESTRUTURA DOS CARDS ANTES DE ENVIAR
      console.log(`🔍 Validando ${carousel.length} card(s) antes de enviar...`);
      const validCards = carousel.filter((card, idx) => {
        let isValid = true;
        const issues = [];
        
        // Verificar imagem
        if (!card.image || card.image.trim() === '') {
          issues.push('sem imagem');
          isValid = false;
        } else {
          console.log(`   ✅ Card ${idx + 1}: imagem presente (${card.image.length > 100 ? 'Base64' : 'URL'})`);
        }
        
        // Verificar botões
        if (!card.buttons || card.buttons.length === 0) {
          issues.push('sem botões');
          isValid = false;
        } else {
          console.log(`   ✅ Card ${idx + 1}: ${card.buttons.length} botão(ões) presente(s)`);
        }
        
        if (!isValid) {
          console.error(`❌ Card ${idx + 1} INVÁLIDO: ${issues.join(', ')} - será removido`);
          console.error(`   Estrutura do card:`, JSON.stringify({
            hasText: !!card.text,
            textPreview: card.text ? card.text.substring(0, 50) : null,
            hasImage: !!card.image,
            imageLength: card.image ? card.image.length : 0,
            buttonsCount: card.buttons?.length || 0
          }, null, 2));
        }
        
        return isValid;
      });
      
      if (validCards.length === 0) {
        console.error(`❌ ERRO: Nenhum card válido após validação!`);
        console.error(`   Total de cards recebidos: ${carousel.length}`);
        console.error(`   Cards removidos: ${carousel.length - validCards.length}`);
        throw new Error('Nenhum card válido para enviar (todos os cards precisam ter imagem e pelo menos 1 botão)');
      }
      
      if (validCards.length < carousel.length) {
        console.warn(`⚠️ ${carousel.length - validCards.length} card(s) inválido(s) removido(s). Enviando ${validCards.length} card(s) válido(s)`);
      } else {
        console.log(`✅ Todos os ${validCards.length} card(s) são válidos!`);
      }

      const payload = {
        number,
        text: text || '', // Texto opcional para carrossel
        carousel: validCards, // UAZ API usa "carousel" ao invés de "cards" ou "choices"
        readchat: true
      };

      console.log('📤 Enviando carrossel via UAZ API...');
      console.log(`📊 Total de cards válidos: ${validCards.length} (de ${carousel.length} total)`);
      console.log(`🔗 Endpoint: /send/carousel`);
      console.log(`🌐 URL: ${this.serverUrl}/send/carousel`);
      console.log(`📋 Payload structure:`, {
        number: payload.number,
        text: payload.text ? `"${payload.text.substring(0, 30)}..."` : '(vazio)',
        carousel: `${payload.carousel.length} cards`,
        totalButtons: validCards.reduce((sum, card) => sum + (card.buttons?.length || 0), 0)
      });
      
      // Log detalhado de cada card
      validCards.forEach((card, idx) => {
        const buttonTexts = card.buttons?.map((b) => {
          if (typeof b === 'string') {
            return b.split('|')[0];
          }
          return b.text || b.id || 'N/A';
        }).join(', ') || 'N/A';
        
        console.log(`   📦 Card ${idx + 1}:`, {
          hasImage: !!card.image,
          imageSize: card.image ? `${(card.image.length / 1024).toFixed(1)} KB` : 'N/A',
          text: card.text ? `"${card.text.substring(0, 30)}..."` : '(vazio)',
          buttons: card.buttons?.length || 0,
          buttonTexts: buttonTexts
        });
      });
      
      // Calcular tamanho total do payload
      const payloadSize = JSON.stringify(payload).length;
      console.log(`📦 Tamanho do payload: ${(payloadSize / 1024).toFixed(2)} KB`);
      
      if (payloadSize > 10 * 1024 * 1024) { // > 10MB
        console.warn(`⚠️ AVISO: Payload muito grande (${(payloadSize / 1024 / 1024).toFixed(2)} MB)`);
      }
      
      // Usar endpoint /send/carousel (formato correto da UAZ API)
      console.log(`🚀 Fazendo requisição POST...`);
      
      // ✅ LOG COMPLETO DO PAYLOAD ANTES DE ENVIAR (para debug)
      console.log('📋 PAYLOAD COMPLETO QUE SERÁ ENVIADO:');
      console.log(JSON.stringify({
        number: payload.number,
        text: payload.text,
        carousel: payload.carousel.map((card, idx) => ({
          index: idx + 1,
          hasText: !!card.text,
          textPreview: card.text ? card.text.substring(0, 50) : null,
          hasImage: !!card.image,
          imageType: card.image ? (card.image.startsWith('http') ? 'URL' : 'Base64') : null,
          imageSize: card.image ? `${(card.image.length / 1024).toFixed(1)} KB` : null,
          buttonsCount: card.buttons?.length || 0,
          buttons: card.buttons?.map((b, bi) => ({
            index: bi + 1,
            id: b.id,
            text: b.text,
            type: b.type
          })) || []
        })),
        readchat: payload.readchat
      }, null, 2));
      
      const response = await client.post(`/send/carousel`, payload);
      
      // ✅ VALIDAR RESPOSTA DA API
      console.log('📬 Resposta completa da API:', JSON.stringify(response.data, null, 2));
      
      // Verificar se há erro na resposta (mesmo com status 200)
      if (response.data?.error) {
        console.error('❌ API retornou erro na resposta:', response.data.error);
        throw new Error(response.data.error || 'Erro ao enviar carrossel');
      }
      
      // Verificar se a resposta indica sucesso
      if (response.data?.status === 'error' || response.data?.success === false) {
        const errorMsg = response.data?.message || response.data?.error || 'Erro desconhecido ao enviar carrossel';
        console.error('❌ API indicou falha:', errorMsg);
        throw new Error(errorMsg);
      }
      
      // Verificar se há messageId (indica que foi enviado)
      const messageId = response.data?.key?.id || response.data?.messageId || response.data?.id || null;
      
      if (!messageId) {
        console.warn('⚠️ API não retornou messageId - pode indicar que o carrossel não foi enviado corretamente');
        console.warn('⚠️ Resposta completa:', JSON.stringify(response.data, null, 2));
        // Não falhar, mas avisar
      }
      
      // Verificar tipo de mensagem na resposta
      const messageType = response.data?.messageType || response.data?.type || null;
      
      // ✅ VERIFICAR SE O CARROSSEL FOI ENVIADO CORRETAMENTE
      // A API pode retornar "InteractiveMessage" com CarouselMessage dentro de content.InteractiveMessage.CarouselMessage
      const hasCarousel = response.data?.content?.InteractiveMessage?.CarouselMessage?.cards ||
                         messageType === 'CarouselMessage' ||
                         (messageType && messageType.includes('Carousel'));
      
      if (!hasCarousel) {
        // Se retornou ExtendedTextMessage, significa que apenas o texto foi enviado
        if (messageType === 'ExtendedTextMessage') {
          console.error(`❌ ERRO CRÍTICO: API retornou apenas texto (ExtendedTextMessage) ao invés de carrossel!`);
          console.error(`   Resposta completa:`, JSON.stringify(response.data, null, 2));
          throw new Error('A API retornou apenas texto (ExtendedTextMessage) ao invés de carrossel. Verifique se os cards têm imagem e botões válidos.');
        }
        
        // Se for InteractiveMessage mas não tem CarouselMessage dentro, avisar
        if (messageType === 'InteractiveMessage') {
          console.warn(`⚠️ Tipo InteractiveMessage retornado, mas não encontrado CarouselMessage na estrutura.`);
          console.warn(`   Estrutura de content:`, JSON.stringify(response.data?.content, null, 2));
        } else {
          console.warn(`⚠️ Tipo de mensagem retornado: ${messageType} (esperado: InteractiveMessage com CarouselMessage ou CarouselMessage)`);
        }
      } else {
        // Carrossel foi enviado corretamente!
        const cardsCount = response.data?.content?.InteractiveMessage?.CarouselMessage?.cards?.length || 0;
        console.log(`✅ Carrossel confirmado! ${cardsCount} card(s) na resposta.`);
      }
      
      console.log('✅ Carrossel enviado com sucesso!');
      console.log('📩 UAZ Response - Message ID:', messageId);
      console.log('📋 Tipo de mensagem:', messageType || 'não informado');
      
      return {
        success: true,
        messageId: messageId,
        data: response.data
      };
    } catch (error) {
      console.error('❌ Erro ao enviar carrossel:');
      console.error('   🔍 Detalhes do erro:');
      
      if (error.code === 'ECONNRESET') {
        console.error('   → Conexão foi resetada. Possíveis causas:');
        console.error('      1. Payload muito grande');
        console.error('      2. Timeout da API');
        console.error('      3. Problema de rede');
      } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
        console.error('   → Timeout: A API demorou muito para responder');
      } else if (error.response) {
        console.error('   → Status HTTP:', error.response.status);
        console.error('   → Resposta da API:', JSON.stringify(error.response.data, null, 2));
        
        // Se for erro 500, mostrar mais detalhes
        if (error.response.status === 500) {
          console.error('   ⚠️ ERRO 500 - Erro interno da API UAZ');
          console.error('   📦 Dados enviados:');
          console.error('      Número:', number);
          console.error('      Texto:', text ? `"${text.substring(0, 50)}..."` : '(vazio)');
          console.error('      Total de cards:', cards?.length || 0);
          
          // Mostrar resumo de cada card
          if (cards && cards.length > 0) {
            cards.forEach((c, i) => {
              console.error(`      Card ${i + 1}:`, {
                hasImage: !!c.image,
                imageSize: c.image ? `${(c.image.length / 1024).toFixed(1)} KB` : 'N/A',
                text: c.text ? `"${c.text.substring(0, 30)}..."` : '(vazio)',
                buttons: c.buttons?.length || 0
              });
            });
          }
        }
      } else {
        console.error('   → Erro:', error.message);
      }
      
      throw new Error(error.response?.data?.error || error.response?.data?.message || error.message);
    }
  }

  /**
   * Envia mensagem com lista interativa
   * @param {string} instanceToken - Token da instância
   * @param {object} listData - Dados da lista (number, title, description, buttonText, sections)
   * @param {object} proxyConfig - Configuração de proxy (opcional)
   * @returns {Promise<object>}
   */
  async sendList(instanceToken, listData, proxyConfig = null) {
    try {
      const client = this.createHttpClient(instanceToken, false, proxyConfig);
      
      // Converter formato para o que a UAZ API espera
      const choices = [];
      
      if (listData.sections && listData.sections.length > 0) {
        listData.sections.forEach(section => {
          // Adicionar seção (com colchetes)
          if (section.title) {
            choices.push(`[${section.title}]`);
          }
          
          // Adicionar itens da seção
          if (section.rows && section.rows.length > 0) {
            section.rows.forEach(row => {
              choices.push(row.title || row.description);
            });
          }
        });
      }
      
      const payload = {
        number: listData.number,
        text: listData.description || 'Selecione uma opção',
        type: 'list',
        choices: choices,
        listButton: listData.buttonText || 'Ver opções',
        footerText: listData.footer || '',
        readchat: true
      };
      
      console.log('📤 Enviando lista via UAZ API...');
      console.log(`🔗 Endpoint: /send/menu`);
      console.log(`📋 Choices: ${choices.length} itens`);
      
      const response = await client.post(`/send/menu`, payload);
      
      // Extrair o messageId da resposta da UAZ
      const messageId = response.data?.key?.id || response.data?.messageId || response.data?.id || null;
      
      console.log('✅ Lista enviada com sucesso');
      console.log('📩 UAZ Response - Message ID:', messageId);
      
      return {
        success: true,
        messageId: messageId,
        data: response.data
      };
    } catch (error) {
      console.error('❌ Erro ao enviar lista:', error.response?.data || error.message);
      throw new Error(error.response?.data?.error || error.response?.data?.message || error.message);
    }
  }

  /**
   * Envia mensagem com botões
   * @param {string} instanceToken - Token da instância
   * @param {object} buttonsData - Dados dos botões (number, text, buttons)
   * @param {object} proxyConfig - Configuração de proxy (opcional)
   * @returns {Promise<object>}
   */
  async sendButtons(instanceToken, buttonsData, proxyConfig = null) {
    try {
      const client = this.createHttpClient(instanceToken, false, proxyConfig);
      
      // Converter botões para o formato da UAZ API: texto|valor
      const choices = [];
      
      if (buttonsData.buttons && buttonsData.buttons.length > 0) {
        buttonsData.buttons.forEach(btn => {
          let choice = btn.text;
          
          // Formatar baseado no tipo do botão
          switch (btn.type) {
            case 'URL':
              choice += `|${btn.url || ''}`;
              break;
            case 'CALL':
              choice += `|call:${btn.phone_number || ''}`;
              break;
            case 'COPY':
              choice += `|copy:${btn.copy_code || ''}`;
              break;
            case 'REPLY':
            default:
              choice += `|${btn.id || btn.text}`;
              break;
          }
          
          choices.push(choice);
          console.log(`   📍 Botão formatado: ${btn.type} => ${choice}`);
        });
      }
      
      const payload = {
        number: buttonsData.number,
        text: buttonsData.text || 'Mensagem com botões',
        type: 'button',
        choices: choices,
        footerText: buttonsData.footer || '',
        readchat: true
      };
      
      console.log('📤 Enviando botões via UAZ API...');
      console.log(`🔗 Endpoint: /send/menu`);
      console.log(`📋 Botões: ${choices.length} itens`);
      console.log(`📦 Choices formatados:`, JSON.stringify(choices, null, 2));
      
      const response = await client.post(`/send/menu`, payload);
      
      // Extrair o messageId da resposta da UAZ
      const messageId = response.data?.key?.id || response.data?.messageId || response.data?.id || null;
      
      console.log('✅ Botões enviados com sucesso');
      console.log('📩 UAZ Response - Message ID:', messageId);
      
      return {
        success: true,
        messageId: messageId,
        data: response.data
      };
    } catch (error) {
      console.error('❌ Erro ao enviar botões:', error.response?.data || error.message);
      throw new Error(error.response?.data?.error || error.response?.data?.message || error.message);
    }
  }

  /**
   * Envia enquete (poll)
   * @param {string} instanceToken - Token da instância
   * @param {object} pollData - Dados da enquete (number, pollname, options, selectableCount)
   * @param {object} proxyConfig - Configuração de proxy (opcional)
   * @returns {Promise<object>}
   */
  async sendPoll(instanceToken, pollData, proxyConfig = null) {
    try {
      const client = this.createHttpClient(instanceToken, false, proxyConfig);
      
      const payload = {
        number: pollData.number,
        pollname: pollData.pollname || 'Enquete',
        options: pollData.options || [],
        selectableCount: pollData.selectableCount || 1,
        readchat: true
      };
      
      console.log('📤 Enviando enquete via UAZ API...');
      console.log(`🔗 Endpoint: /send/poll`);
      console.log(`📋 Opções: ${payload.options.length} itens`);
      console.log(`🔢 Selecionáveis: ${payload.selectableCount}`);
      
      const response = await client.post(`/send/poll`, payload);
      
      // Extrair o messageId da resposta da UAZ
      const messageId = response.data?.key?.id || response.data?.messageId || response.data?.id || null;
      
      console.log('✅ Enquete enviada com sucesso');
      console.log('📩 UAZ Response - Message ID:', messageId);
      
      return {
        success: true,
        messageId: messageId,
        data: response.data
      };
    } catch (error) {
      console.error('❌ Erro ao enviar enquete:', error.response?.data || error.message);
      throw new Error(error.response?.data?.error || error.response?.data?.message || error.message);
    }
  }

  /**
   * Faz logout/desconecta uma instância
   * @param {string} instanceToken - Token da instância
   * @param {object} proxyConfig - Configuração de proxy (opcional)
   * @returns {Promise<object>}
   */
  async logout(instanceToken, proxyConfig = null) {
    try {
      console.log('🔌 Tentando fazer logout da instância...');
      
      const client = this.createHttpClient(instanceToken, false, proxyConfig, 15000); // 15s timeout
      
      // Tentar diferentes endpoints de logout
      const logoutEndpoints = [
        '/instance/logout',
        '/logout',
        '/disconnect',
        '/close',
        '/instance/close'
      ];
      
      for (const endpoint of logoutEndpoints) {
        try {
          console.log(`   Tentando: ${endpoint}`);
          const response = await client.post(endpoint);
          
          console.log(`✅ Logout bem-sucedido via ${endpoint}`);
          return {
            success: true,
            endpoint: endpoint,
            data: response.data
          };
        } catch (error) {
          console.log(`   ❌ Falha em ${endpoint}:`, error.response?.status || error.message);
          // Continuar tentando outros endpoints
          continue;
        }
      }
      
      // Se nenhum endpoint funcionou, retornar sucesso parcial
      // (a instância será resetada no banco de qualquer forma)
      console.log('⚠️  Nenhum endpoint de logout funcionou, mas instância será resetada no banco');
      return {
        success: true,
        message: 'Instância será resetada (logout não suportado pela API)',
        fallback: true
      };
      
    } catch (error) {
      console.error('❌ Erro geral ao fazer logout:', error.message);
      return {
        success: true, // Retornar success mesmo assim para resetar no banco
        message: 'Instância será resetada (erro ao contactar API)',
        error: error.message,
        fallback: true
      };
    }
  }

  /**
   * Obtém detalhes completos de um contato, incluindo foto de perfil
   * @param {string} instanceToken - Token da instância
   * @param {string} phoneNumber - Número do telefone (sem caracteres especiais)
   * @param {boolean} preview - Se true, retorna imagem preview (menor), se false retorna imagem full (original)
   * @param {object} proxyConfig - Configuração de proxy (opcional)
   * @returns {Promise<object>}
   */
  async getContactDetails(instanceToken, phoneNumber, preview = false, proxyConfig = null) {
    try {
      const client = this.createHttpClient(instanceToken, false, proxyConfig);
      
      console.log('📸 Buscando detalhes do contato (incluindo foto de perfil)...');
      console.log('   ├─ Número:', phoneNumber);
      console.log('   └─ Tamanho:', preview ? 'Preview (pequeno)' : 'Full (original)');
      
      // Buscar detalhes do contato (foto)
      const response = await client.post('/chat/details', {
        number: phoneNumber,
        preview: preview
      });
      
      console.log('📋 Resposta completa da API:', JSON.stringify(response.data, null, 2));
      
      const profilePicUrl = response.data.image || response.data.imagePreview || null;
      
      if (profilePicUrl) {
        console.log('✅ Foto de perfil encontrada!');
        console.log('   └─ URL completa:', profilePicUrl);
      } else {
        console.log('ℹ️  Contato não possui foto de perfil ou foto não disponível');
        console.log('   └─ Resposta da API:', response.data);
      }

      // Verificar se tem WhatsApp usando o mesmo endpoint da verificação em massa
      console.log('📱 Verificando se número tem WhatsApp...');
      let hasWhatsApp = false;
      try {
        // ✅ ENDPOINT CORRETO: /chat/check (igual à verificação em massa)
        const checkResponse = await client.post('/chat/check', {
          numbers: [phoneNumber]  // Array de números
        });
        
        console.log('📡 Resposta do /chat/check:', checkResponse.data);
        
        if (checkResponse.data && Array.isArray(checkResponse.data)) {
          const result = checkResponse.data[0];
          hasWhatsApp = result?.isInWhatsapp || false;
          console.log(`   └─ ${hasWhatsApp ? '✅ TEM WhatsApp' : '❌ SEM WhatsApp'}`);
        } else {
          console.log('   └─ ⚠️ Resposta inesperada:', checkResponse.data);
        }
      } catch (checkError) {
        console.log('   └─ ⚠️ Erro ao verificar WhatsApp:', checkError.response?.data || checkError.message);
      }
      
      return {
        success: true,
        data: response.data,
        profilePicUrl: profilePicUrl,
        contactName: response.data.wa_name || response.data.name || phoneNumber,
        isGroup: response.data.wa_isGroup || false,
        hasWhatsApp: hasWhatsApp
      };
    } catch (error) {
      console.error('❌ Erro ao buscar detalhes do contato:', error.message);
      console.error('   └─ Response:', error.response?.data);
      
      return {
        success: false,
        error: error.response?.data?.error || error.message
      };
    }
  }
}

module.exports = UazService;
