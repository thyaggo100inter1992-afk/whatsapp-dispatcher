import axios, { AxiosRequestConfig } from 'axios';
import { query } from '../database/connection';
import { ProxyConfig, applyProxyToRequest, formatProxyInfo, getProxyConfigFromAccount } from '../helpers/proxy.helper';

interface SendMessageParams {
  accessToken: string;
  phoneNumberId: string;
  to: string;
  templateName: string;
  languageCode?: string;
  components?: any[];
  variableValues?: string[]; // Array de valores para as variáveis
  mediaUrl?: string;
  mediaType?: string;
  accountId?: number; // Para buscar configuração de proxy
  accountName?: string; // Para logs
  tenantId?: number; // Para buscar configuração de proxy
}

interface TemplateComponent {
  type: string;
  parameters?: any[];
}

export class WhatsAppService {
  private baseUrl = 'https://graph.facebook.com/v18.0';

  async sendTemplateMessage(params: SendMessageParams) {
    try {
      const {
        accessToken,
        phoneNumberId,
        to,
        templateName,
        languageCode = 'pt_BR',
        components = [],
        variableValues = [],
        mediaUrl,
        mediaType,
      } = params;

      const template: any = {
        name: templateName,
        language: {
          code: languageCode,
        },
      };

      // Se variableValues foi fornecido, converter para components
      if (variableValues.length > 0 && components.length === 0) {
        const bodyComponent: TemplateComponent = {
          type: 'body',
          parameters: variableValues.map(value => ({
            type: 'text',
            text: value
          }))
        };
        template.components = [bodyComponent];
      }
      // Adicionar componentes se houver
      else if (components.length > 0) {
        template.components = components;
      }
      // Se não tem nem variableValues nem components, mas tem mídia, 
      // ainda precisa inicializar components como array vazio
      else if (!template.components) {
        template.components = [];
      }

      // Adicionar mídia se houver
      if (mediaUrl && mediaType) {
        // Detectar se é media_id ou URL
        const isMediaId = mediaType.endsWith('_id');
        let actualMediaType = mediaType;
        
        // Se terminar com '_id', extrair o tipo real (ex: 'video_id' -> 'video')
        if (isMediaId) {
          actualMediaType = mediaType.replace('_id', '');
        }
        
        const typeKey = actualMediaType === 'image' ? 'image' 
                      : actualMediaType === 'video' ? 'video' 
                      : actualMediaType === 'audio' ? 'audio'
                      : 'document';
        
        console.log('📋 Construindo media component:', { 
          mediaType, 
          isMediaId, 
          actualMediaType, 
          typeKey,
          mediaUrl: isMediaId ? 'media_id: ' + mediaUrl : 'url: ' + mediaUrl 
        });
        
        const mediaComponent: TemplateComponent = {
          type: 'header',
          parameters: [
            {
              type: typeKey,
              [typeKey]: isMediaId 
                ? { id: mediaUrl }  // Usar media_id
                : { link: mediaUrl } // Usar URL
            },
          ],
        };

        if (!template.components) {
          template.components = [];
        }
        template.components.unshift(mediaComponent);
      }

      // 🔍 LOG DETALHADO: Ver exatamente o que está sendo enviado
      console.log('📤 Enviando para WhatsApp API:');
      console.log('   Template:', templateName);
      console.log('   Para:', to);
      console.log('   Components:', JSON.stringify(template.components, null, 2));

      // Aplicar proxy se configurado
      let requestConfig: AxiosRequestConfig = {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      };

      const proxyConfig = params.accountId && params.tenantId ? await getProxyConfigFromAccount(params.accountId, params.tenantId) : null;
      if (proxyConfig) {
        console.log(`🌐 WhatsApp Service - Aplicando proxy: ${formatProxyInfo(proxyConfig)}${params.accountName ? ` - Conta: ${params.accountName}` : ''}`);
        requestConfig = applyProxyToRequest(requestConfig, proxyConfig, params.accountName || 'WhatsApp Service');
      } else {
        console.log(`📤 WhatsApp Service - Requisição SEM proxy${params.accountName ? ` - Conta: ${params.accountName}` : ''}`);
      }

      const response = await axios.post(
        `${this.baseUrl}/${phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: to,
          type: 'template',
          template: template,
        },
        requestConfig
      );

      console.log('✅ Resposta da API WhatsApp:');
      console.log('   Status:', response.status);
      console.log('   Message ID:', response.data.messages?.[0]?.id);
      console.log('   Resposta completa:', JSON.stringify(response.data, null, 2));

      return {
        success: true,
        messageId: response.data.messages[0].id,
        data: response.data,
        proxyUsed: !!proxyConfig,
        proxyHost: proxyConfig ? `${proxyConfig.host}:${proxyConfig.port}` : null,
        proxyType: proxyConfig?.type || null,
      };
    } catch (error: any) {
      console.error('Error sending WhatsApp message:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message,
        errorData: error.response?.data,
      };
    }
  }

  async getTemplates(accessToken: string, businessAccountId: string, accountId?: number, accountName?: string, tenantId?: number) {
    try {
      let requestConfig: AxiosRequestConfig = {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        params: {
          limit: 100,
        },
      };

      // Aplicar proxy se configurado
      const proxyConfig = accountId && tenantId ? await getProxyConfigFromAccount(accountId, tenantId) : null;
      if (proxyConfig) {
        console.log(`🌐 WhatsApp Service (getTemplates) - Aplicando proxy: ${formatProxyInfo(proxyConfig)}${accountName ? ` - Conta: ${accountName}` : ''}`);
        requestConfig = applyProxyToRequest(requestConfig, proxyConfig, accountName || 'WhatsApp Service');
      } else {
        console.log(`📤 WhatsApp Service (getTemplates) - Requisição SEM proxy${accountName ? ` - Conta: ${accountName}` : ''}`);
      }

      const response = await axios.get(
        `${this.baseUrl}/${businessAccountId}/message_templates`,
        requestConfig
      );

      return {
        success: true,
        templates: response.data.data,
        proxyUsed: !!proxyConfig,
        proxyHost: proxyConfig ? `${proxyConfig.host}:${proxyConfig.port}` : null,
        proxyType: proxyConfig?.type || null,
      };
    } catch (error: any) {
      console.error('Error fetching templates:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message,
      };
    }
  }

  /**
   * Upload usando Resumable Upload API (retorna handle 4::xxx)
   * Usado quando há App ID configurado
   */
  async uploadMediaWithAppId(appId: string, accessToken: string, fileBuffer: Buffer, mimeType: string, fileName: string, accountId?: number, accountName?: string, tenantId?: number) {
    try {
      console.log('📱 Usando Resumable Upload API com App ID');
      console.log(`   App ID: ${appId}`);
      console.log(`   Arquivo: ${fileName}`);
      console.log(`   Tamanho: ${fileBuffer.length} bytes`);
      
      // Passo 1: Criar sessão de upload
      const sessionUrl = `https://graph.facebook.com/v18.0/${appId}/uploads`;
      const sessionPayload = {
        file_length: fileBuffer.length,
        file_type: mimeType,
        file_name: fileName
      };
      
      let requestConfig: AxiosRequestConfig = {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      };
      
      // Aplicar proxy se configurado
      const proxyConfig = accountId && tenantId ? await getProxyConfigFromAccount(accountId, tenantId) : null;
      if (proxyConfig) {
        console.log(`🌐 Aplicando proxy: ${formatProxyInfo(proxyConfig)}`);
        requestConfig = applyProxyToRequest(requestConfig, proxyConfig, accountName || 'WhatsApp Service');
      }
      
      console.log('📤 Passo 1: Criando sessão de upload...');
      const sessionResponse = await axios.post(sessionUrl, sessionPayload, requestConfig);
      const uploadSessionId = sessionResponse.data.id;
      
      console.log(`✅ Sessão criada: ${uploadSessionId}`);
      
      // Passo 2: Fazer upload do arquivo
      const uploadUrl = `https://graph.facebook.com/v18.0/${uploadSessionId}`;
      const FormData = require('form-data');
      const form = new FormData();
      form.append('file', fileBuffer, {
        contentType: mimeType,
        filename: fileName,
      });
      
      let uploadConfig: AxiosRequestConfig = {
        headers: {
          ...form.getHeaders(),
          'Authorization': `OAuth ${accessToken}`,
          'file_offset': '0'
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity
      };
      
      if (proxyConfig) {
        uploadConfig = applyProxyToRequest(uploadConfig, proxyConfig, accountName || 'WhatsApp Service');
      }
      
      console.log('📤 Passo 2: Fazendo upload do arquivo...');
      const uploadResponse = await axios.post(uploadUrl, form, uploadConfig);
      const mediaHandle = uploadResponse.data.h;
      
      console.log(`✅ Upload concluído! Handle: ${mediaHandle}`);
      
      return {
        success: true,
        mediaHandle: mediaHandle, // Handle no formato 4::xxx
        uploadSessionId: uploadSessionId,
        proxyUsed: !!proxyConfig
      };
      
    } catch (error: any) {
      console.error('❌ Erro na Resumable Upload API:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message,
      };
    }
  }

  async uploadMedia(accessToken: string, phoneNumberId: string, fileBuffer: Buffer, mimeType: string, accountId?: number, accountName?: string, tenantId?: number) {
    try {
      const FormData = require('form-data');
      const form = new FormData();
      form.append('messaging_product', 'whatsapp');
      form.append('file', fileBuffer, {
        contentType: mimeType,
        filename: 'media_file',
      });

      let requestConfig: AxiosRequestConfig = {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${accessToken}`,
        },
      };

      // Aplicar proxy se configurado
      const proxyConfig = accountId && tenantId ? await getProxyConfigFromAccount(accountId, tenantId) : null;
      if (proxyConfig) {
        console.log(`🌐 WhatsApp Service (uploadMedia) - Aplicando proxy: ${formatProxyInfo(proxyConfig)}${accountName ? ` - Conta: ${accountName}` : ''}`);
        requestConfig = applyProxyToRequest(requestConfig, proxyConfig, accountName || 'WhatsApp Service');
      } else {
        console.log(`📤 WhatsApp Service (uploadMedia) - Requisição SEM proxy${accountName ? ` - Conta: ${accountName}` : ''}`);
      }

      const response = await axios.post(
        `${this.baseUrl}/${phoneNumberId}/media`,
        form,
        requestConfig
      );

      console.log('📊 Resposta COMPLETA do WhatsApp Upload API:');
      console.log(JSON.stringify(response.data, null, 2));

      // Extrair o handle no formato correto para templates (4::xxx)
      const mediaId = response.data.id;
      const mediaHandle = response.data.h || response.data.handle;
      
      console.log(`🔍 Media ID extraído: ${mediaId}`);
      console.log(`🔍 Media Handle extraído: ${mediaHandle || 'NÃO ENCONTRADO NA RESPOSTA'}`);
      
      if (mediaHandle) {
        console.log(`✅ Handle no formato correto encontrado: ${mediaHandle}`);
      } else {
        console.log(`⚠️  Handle não encontrado - usando Media ID como fallback`);
      }

      return {
        success: true,
        mediaId: mediaId,
        mediaHandle: mediaHandle || mediaId, // ← NOVO: handle no formato 4::xxx (ou Media ID como fallback)
        proxyUsed: !!proxyConfig,
        proxyHost: proxyConfig ? `${proxyConfig.host}:${proxyConfig.port}` : null,
        proxyType: proxyConfig?.type || null,
      };
    } catch (error: any) {
      console.error('Error uploading media:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message,
      };
    }
  }

  async getMediaUrl(accessToken: string, mediaId: string, accountId?: number, accountName?: string, tenantId?: number) {
    try {
      let requestConfig: AxiosRequestConfig = {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      };

      // Aplicar proxy se configurado
      const proxyConfig = accountId && tenantId ? await getProxyConfigFromAccount(accountId, tenantId) : null;
      if (proxyConfig) {
        console.log(`🌐 WhatsApp Service (getMediaUrl) - Aplicando proxy: ${formatProxyInfo(proxyConfig)}${accountName ? ` - Conta: ${accountName}` : ''}`);
        requestConfig = applyProxyToRequest(requestConfig, proxyConfig, accountName || 'WhatsApp Service');
      } else {
        console.log(`📤 WhatsApp Service (getMediaUrl) - Requisição SEM proxy${accountName ? ` - Conta: ${accountName}` : ''}`);
      }

      const response = await axios.get(
        `${this.baseUrl}/${mediaId}`,
        requestConfig
      );

      console.log('✅ URL do Media ID obtida:', response.data.url);

      return {
        success: true,
        url: response.data.url,
        proxyUsed: !!proxyConfig,
        proxyHost: proxyConfig ? `${proxyConfig.host}:${proxyConfig.port}` : null,
        proxyType: proxyConfig?.type || null,
      };
    } catch (error: any) {
      console.error('❌ Erro ao obter URL do Media ID:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message,
      };
    }
  }

  async testConnection(accessToken: string, phoneNumberId: string, accountId?: number, accountName?: string, tenantId?: number) {
    try {
      let requestConfig: AxiosRequestConfig = {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      };

      // Aplicar proxy se configurado
      const proxyConfig = accountId && tenantId ? await getProxyConfigFromAccount(accountId, tenantId) : null;
      if (proxyConfig) {
        console.log(`🌐 WhatsApp Service (testConnection) - Aplicando proxy: ${formatProxyInfo(proxyConfig)}${accountName ? ` - Conta: ${accountName}` : ''}`);
        requestConfig = applyProxyToRequest(requestConfig, proxyConfig, accountName || 'WhatsApp Service');
      } else {
        console.log(`📤 WhatsApp Service (testConnection) - Requisição SEM proxy${accountName ? ` - Conta: ${accountName}` : ''}`);
      }

      const response = await axios.get(
        `${this.baseUrl}/${phoneNumberId}`,
        requestConfig
      );

      return {
        success: true,
        data: response.data,
        proxyUsed: !!proxyConfig,
        proxyHost: proxyConfig ? `${proxyConfig.host}:${proxyConfig.port}` : null,
        proxyType: proxyConfig?.type || null,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message,
      };
    }
  }

  buildTemplateComponents(variables: Record<string, any>) {
    if (!variables || Object.keys(variables).length === 0) {
      return [];
    }

    const parameters = Object.values(variables).map((value) => ({
      type: 'text',
      text: String(value),
    }));

    return [
      {
        type: 'body',
        parameters: parameters,
      },
    ];
  }

  /**
   * Envia mensagem de texto livre (NÃO template)
   * Só funciona após o cliente iniciar conversa ou dentro de 24h após ele responder
   */
  async sendFreeTextMessage(params: {
    accessToken: string;
    phoneNumberId: string;
    to: string;
    text: string;
    accountId?: number;
    accountName?: string;
    tenantId?: number;
  }) {
    try {
      const { accessToken, phoneNumberId, to, text, accountId, accountName, tenantId } = params;

      const url = `${this.baseUrl}/${phoneNumberId}/messages`;

      const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: this.formatPhoneNumber(to),
        type: 'text',
        text: {
          body: text
        }
      };

      console.log(`📤 Enviando mensagem de texto livre para ${to}`);
      console.log(`   Conta: ${accountName || accountId || 'N/A'}`);

      // Buscar configuração de proxy
      let proxyConfig: ProxyConfig | null = null;
      let axiosConfig: AxiosRequestConfig = {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        }
      };

      if (accountId && tenantId) {
        proxyConfig = await getProxyConfigFromAccount(accountId, tenantId);
        if (proxyConfig) {
          axiosConfig = applyProxyToRequest(axiosConfig, proxyConfig, accountName || `Account ${accountId}`);
          console.log(`   🌐 Usando proxy: ${formatProxyInfo(proxyConfig)}`);
        }
      }

      const response = await axios.post(url, payload, axiosConfig);

      console.log('✅ Mensagem de texto livre enviada com sucesso!');
      console.log('   Message ID:', response.data.messages?.[0]?.id);

      return {
        success: true,
        messageId: response.data.messages?.[0]?.id,
        proxyUsed: !!proxyConfig,
        proxyHost: proxyConfig?.host || null,
        proxyType: proxyConfig?.type || null
      };

    } catch (error: any) {
      console.error('❌ Erro ao enviar mensagem de texto livre:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message
      };
    }
  }

  formatPhoneNumber(phoneNumber: string): string {
    // Remove todos os caracteres não numéricos
    let cleaned = phoneNumber.replace(/\D/g, '');

    // Se não começar com código do país, adiciona o código do Brasil (55)
    if (!cleaned.startsWith('55') && cleaned.length <= 11) {
      cleaned = '55' + cleaned;
    }

    return cleaned;
  }

  /**
   * Criar um template via API do WhatsApp
   */
  async createTemplate(params: {
    accessToken: string;
    businessAccountId: string;
    templateData: {
      name: string;
      category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
      language: string;
      components: any[];
    };
    accountId?: number;
    accountName?: string;
    tenantId?: number;
  }) {
    try {
      const { accessToken, businessAccountId, templateData, accountId, accountName, tenantId } = params;

      console.log('\n');
      console.log('='.repeat(100));
      console.log('📤 CRIANDO TEMPLATE VIA API WHATSAPP - ANÁLISE COMPLETA DO PAYLOAD');
      console.log('='.repeat(100));
      console.log('');
      console.log('🏢 INFORMAÇÕES DA CONTA:');
      console.log('   Business Account ID:', businessAccountId);
      console.log('   Access Token:', accessToken.substring(0, 20) + '...' + accessToken.substring(accessToken.length - 10));
      console.log('   Conta:', accountName, `(ID: ${accountId})`);
      console.log('');
      console.log('📋 DADOS DO TEMPLATE:');
      console.log('   Nome:', templateData.name);
      console.log('   Categoria:', templateData.category);
      console.log('   Idioma:', templateData.language);
      console.log('');
      console.log('🧩 COMPONENTS (' + templateData.components.length + ' componentes):');
      templateData.components.forEach((comp: any, index: number) => {
        console.log(`   [${index}] Tipo: ${comp.type}${comp.format ? ` | Format: ${comp.format}` : ''}${comp.text ? ` | Text: ${comp.text.substring(0, 50)}...` : ''}`);
      });
      console.log('');
      
      // Verificar se há example DENTRO do componente HEADER
      const headerComponent = templateData.components.find((c: any) => c.type === 'HEADER');
      if (headerComponent && headerComponent.example) {
        console.log('✅ EXAMPLE DENTRO DO COMPONENTE HEADER (FORMATO CORRETO):');
        console.log(JSON.stringify(headerComponent.example, null, 2));
        console.log('');
        if (headerComponent.example.header_handle) {
          console.log('🔗 HEADER_HANDLE (URL/Media ID):');
          const headerHandles = headerComponent.example.header_handle;
          if (Array.isArray(headerHandles)) {
            headerHandles.forEach((handle: string, idx: number) => {
              console.log(`   [${idx}] ${handle}`);
              const tipoDetalhado = handle.startsWith('http://') || handle.startsWith('https://') 
                ? (handle.includes('cloudinary') ? '🌥️  URL Cloudinary (Pública e Permanente)' 
                   : handle.includes('fbsbx.com') ? '📱 URL WhatsApp (Temporária - pode expirar)'
                   : '🌐 URL Pública')
                : '🆔 Media ID do WhatsApp (pode expirar rapidamente)';
              console.log(`   └─ Tipo: ${tipoDetalhado}`);
              console.log(`   └─ Tamanho: ${handle.length} caracteres`);
              console.log(`   └─ Conta: ${accountName} (ID: ${accountId})`);
              if (handle.startsWith('http')) {
                console.log(`   ⚠️  ATENÇÃO: Documentação diz que deve ser Media ID, não URL!`);
              }
            });
          }
        }
      } else {
        console.log('⚠️  Nenhum example no componente HEADER (pode ser template sem mídia)');
      }
      console.log('');
      console.log('📦 PAYLOAD COMPLETO (JSON):');
      console.log('-'.repeat(100));
      console.log(JSON.stringify(templateData, null, 2));
      console.log('-'.repeat(100));
      console.log('');

      let requestConfig: AxiosRequestConfig = {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      };

      // Aplicar proxy se configurado
      const proxyConfig = accountId && tenantId ? await getProxyConfigFromAccount(accountId, tenantId) : null;
      if (proxyConfig) {
        console.log(`🌐 WhatsApp Service (createTemplate) - Aplicando proxy: ${formatProxyInfo(proxyConfig)}${accountName ? ` - Conta: ${accountName}` : ''}`);
        requestConfig = applyProxyToRequest(requestConfig, proxyConfig, accountName || 'WhatsApp Service');
      } else {
        console.log(`📤 WhatsApp Service (createTemplate) - Requisição SEM proxy${accountName ? ` - Conta: ${accountName}` : ''}`);
      }

      const url = `${this.baseUrl}/${businessAccountId}/message_templates`;
      
      console.log('');
      console.log('🚀 ENVIANDO REQUISIÇÃO PARA WHATSAPP API:');
      console.log('   URL:', url);
      console.log('   Método: POST');
      console.log('   Headers:');
      console.log('     - Authorization: Bearer ' + accessToken.substring(0, 20) + '...');
      console.log('     - Content-Type:', requestConfig.headers?.['Content-Type']);
      if (proxyConfig) {
        console.log('   Proxy:', `${proxyConfig.type.toUpperCase()} ${proxyConfig.host}:${proxyConfig.port}`);
      }
      console.log('');
      console.log('⏳ Aguardando resposta do WhatsApp...');

      const response = await axios.post(
        url,
        templateData,
        requestConfig
      );

      console.log('');
      console.log('✅ RESPOSTA RECEBIDA DO WHATSAPP:');
      console.log('   Status HTTP:', response.status, response.statusText);
      console.log('   Template ID:', response.data.id);
      console.log('   Status:', response.data.status);
      console.log('   Category:', response.data.category);
      console.log('   Resposta Completa:', JSON.stringify(response.data, null, 2));
      console.log('='.repeat(100));
      console.log('');

      return {
        success: true,
        data: response.data,
        message: response.data.category !== templateData.category 
          ? `Template criado, mas categoria foi alterada de ${templateData.category} para ${response.data.category}` 
          : 'Template criado com sucesso',
        proxyUsed: !!proxyConfig,
        proxyHost: proxyConfig ? `${proxyConfig.host}:${proxyConfig.port}` : null,
        proxyType: proxyConfig?.type || null,
      };
    } catch (error: any) {
      console.log('');
      console.log('='.repeat(100));
      console.log('❌ ERRO AO CRIAR TEMPLATE - ANÁLISE COMPLETA');
      console.log('='.repeat(100));
      console.log('');
      
      if (error.response) {
        console.log('📥 RESPOSTA DE ERRO DO WHATSAPP:');
        console.log('   Status HTTP:', error.response.status, error.response.statusText);
        console.log('   URL:', error.response.config?.url);
        console.log('');
        console.log('🔴 DETALHES DO ERRO:');
        console.log(JSON.stringify(error.response.data, null, 2));
        console.log('');
        
        if (error.response.data?.error) {
          const errorData = error.response.data.error;
          console.log('📋 INFORMAÇÕES DO ERRO:');
          console.log('   Mensagem:', errorData.message);
          console.log('   Tipo:', errorData.type);
          console.log('   Código:', errorData.code);
          console.log('   Sub-código:', errorData.error_subcode);
          console.log('   Transitório:', errorData.is_transient);
          if (errorData.error_user_title) {
            console.log('   Título (Usuário):', errorData.error_user_title);
          }
          if (errorData.error_user_msg) {
            console.log('   Mensagem (Usuário):', errorData.error_user_msg);
          }
          if (errorData.fbtrace_id) {
            console.log('   Trace ID:', errorData.fbtrace_id);
          }
        }
      } else {
        console.log('❌ ERRO NA REQUISIÇÃO (sem resposta do servidor):');
        console.log('   Mensagem:', error.message);
        console.log('   Stack:', error.stack);
      }
      
      console.log('='.repeat(100));
      console.log('');
      
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message,
        errorDetails: error.response?.data?.error || null,
      };
    }
  }

  /**
   * Deletar um template via API do WhatsApp
   */
  async deleteTemplate(params: {
    accessToken: string;
    businessAccountId: string;
    templateName: string;
    accountId?: number;
    accountName?: string;
    tenantId?: number;
  }) {
    try {
      const { accessToken, businessAccountId, templateName, accountId, accountName, tenantId } = params;

      console.log('🗑️ Deletando template via API WhatsApp:');
      console.log('   Business Account ID:', businessAccountId);
      console.log('   Template Name:', templateName);

      let requestConfig: AxiosRequestConfig = {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        params: {
          name: templateName,
        },
      };

      // Aplicar proxy se configurado
      const proxyConfig = accountId && tenantId ? await getProxyConfigFromAccount(accountId, tenantId) : null;
      if (proxyConfig) {
        console.log(`🌐 WhatsApp Service (deleteTemplate) - Aplicando proxy: ${formatProxyInfo(proxyConfig)}${accountName ? ` - Conta: ${accountName}` : ''}`);
        requestConfig = applyProxyToRequest(requestConfig, proxyConfig, accountName || 'WhatsApp Service');
      } else {
        console.log(`📤 WhatsApp Service (deleteTemplate) - Requisição SEM proxy${accountName ? ` - Conta: ${accountName}` : ''}`);
      }

      const response = await axios.delete(
        `${this.baseUrl}/${businessAccountId}/message_templates`,
        requestConfig
      );

      console.log('✅ Template deletado com sucesso!');

      return {
        success: true,
        data: response.data,
        proxyUsed: !!proxyConfig,
        proxyHost: proxyConfig ? `${proxyConfig.host}:${proxyConfig.port}` : null,
        proxyType: proxyConfig?.type || null,
      };
    } catch (error: any) {
      console.error('❌ Erro ao deletar template:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message,
        errorDetails: error.response?.data?.error || null,
      };
    }
  }

  /**
   * Baixa imagem de URL e faz upload via Resumable API (retorna handle 4::xxx)
   */
  async downloadAndUploadFromUrl(params: {
    accessToken: string;
    appId: string;
    imageUrl: string;
    accountId?: number;
    accountName?: string;
  }) {
    try {
      const { accessToken, appId, imageUrl, accountId, accountName } = params;

      console.log(`\n🔗 ========== BAIXANDO IMAGEM DA URL ==========`);
      console.log(`   URL: ${imageUrl}`);

      // Baixar a imagem
      const imageResponse = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 30000, // 30 segundos
      });

      const fileBuffer = Buffer.from(imageResponse.data);
      const mimeType = imageResponse.headers['content-type'] || 'image/jpeg';
      const fileName = imageUrl.split('/').pop() || 'image.jpg';

      console.log(`✅ Imagem baixada com sucesso!`);
      console.log(`   Tamanho: ${fileBuffer.length} bytes`);
      console.log(`   MIME Type: ${mimeType}`);
      console.log(`==============================================\n`);

      // Fazer upload via Resumable API
      return await this.uploadMediaWithAppId(
        appId,
        accessToken,
        fileBuffer,
        mimeType,
        fileName,
        accountId,
        accountName
      );
    } catch (error: any) {
      console.error(`\n❌ ERRO AO BAIXAR/FAZER UPLOAD DA IMAGEM:`);
      console.error(`   Mensagem: ${error.message}`);
      console.log(`==============================================\n`);

      return {
        success: false,
        error: error.message,
        mediaHandle: null,
      };
    }
  }

  /**
   * 📱 Verifica se um número tem WhatsApp usando a API Oficial do WhatsApp Business
   * @param phoneNumberId - ID do número de telefone da API do WhatsApp
   * @param phoneNumber - Número de telefone para verificar (formato internacional)
   * @param accessToken - Token de acesso da API do WhatsApp
   * @param tenantId - ID do tenant (para proxy)
   * @returns Objeto com success, exists e wa_id
   */
  async checkPhoneNumber(
    phoneNumberId: string,
    phoneNumber: string,
    accessToken: string,
    tenantId?: number
  ): Promise<{ success: boolean; exists: boolean; wa_id?: string; error?: string }> {
    try {
      console.log(`📱 [WhatsApp API] Verificando número: ${phoneNumber}`);
      
      // Limpar número (remover caracteres especiais, manter apenas dígitos e +)
      const cleanPhone = phoneNumber.replace(/[^\d+]/g, '');
      
      // Endpoint da API do WhatsApp para verificar números
      const url = `${this.baseUrl}/${phoneNumberId}/contacts`;
      
      const requestConfig: AxiosRequestConfig = {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000, // 30 segundos
      };
      
      // Aplicar proxy se configurado
      if (tenantId) {
        const proxyConfig = await getProxyConfigFromAccount(null, tenantId);
        if (proxyConfig) {
          applyProxyToRequest(requestConfig, proxyConfig, 'WhatsApp API');
          console.log(`🌐 [WhatsApp API] Usando proxy: ${formatProxyInfo(proxyConfig)}`);
        }
      }
      
      const payload = {
        blocking: 'wait', // Aguardar resposta
        contacts: [cleanPhone],
        force_check: true // Forçar verificação mesmo se já estiver em cache
      };
      
      console.log(`📤 [WhatsApp API] Enviando requisição para: ${url}`);
      console.log(`📦 [WhatsApp API] Payload:`, payload);
      
      const response = await axios.post(url, payload, requestConfig);
      
      console.log(`📬 [WhatsApp API] Resposta recebida:`, JSON.stringify(response.data, null, 2));
      
      // A resposta vem no formato:
      // {
      //   "contacts": [
      //     {
      //       "input": "5511999887766",
      //       "wa_id": "5511999887766",
      //       "status": "valid"
      //     }
      //   ]
      // }
      
      const contacts = response.data?.contacts || [];
      
      if (contacts.length === 0) {
        console.log(`❌ [WhatsApp API] Nenhum contato retornado`);
        return {
          success: true,
          exists: false
        };
      }
      
      const contact = contacts[0];
      const exists = contact.status === 'valid' && !!contact.wa_id;
      const wa_id = contact.wa_id || null;
      
      console.log(`${exists ? '✅' : '❌'} [WhatsApp API] ${phoneNumber}: ${exists ? 'TEM WhatsApp' : 'NÃO tem WhatsApp'}`);
      if (wa_id) {
        console.log(`   📱 [WhatsApp API] WA ID: ${wa_id}`);
      }
      
      return {
        success: true,
        exists: exists,
        wa_id: wa_id
      };
    } catch (error: any) {
      console.error(`❌ [WhatsApp API] Erro ao verificar número ${phoneNumber}:`, error.message);
      
      if (error.response) {
        console.error(`   Status: ${error.response.status}`);
        console.error(`   Resposta:`, JSON.stringify(error.response.data, null, 2));
      }
      
      return {
        success: false,
        exists: false,
        error: error.response?.data?.error?.message || error.message
      };
    }
  }
}

export const whatsappService = new WhatsAppService();

