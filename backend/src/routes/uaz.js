const express = require('express');
const router = express.Router();
const { pool } = require('../database/connection');
const { tenantQuery } = require('../database/tenant-query');
const UazService = require('../services/uazService');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { checkWhatsAppLimit, checkMessageLimit } = require('../middlewares/tenant-limits.middleware');
const { checkWhatsAppQR } = require('../middlewares/check-feature.middleware');
const { RestrictionListController } = require('../controllers/restriction-list.controller');

// Importar helpers de log
const {
  logInstanceCreated,
  logInstanceConnected,
  logInstanceDisconnected,
  logInstanceDeleted,
  logInstanceUpdated,
  logStatusCheck,
  logQRCodeGenerated,
  getInstanceHistory
} = require('../helpers/uaz-log.helper');

// Importar helper de credenciais
const { getTenantUazapCredentials, getDefaultUazapCredentials } = require('../helpers/uaz-credentials.helper');
const { getInstanceWithCredentials } = require('../helpers/instance-credentials.helper');

/**
 * 📞 Normaliza número de telefone para comparação
 * Remove caracteres especiais e testa diferentes formatos:
 * - Com/sem código do país (55)
 * - Com/sem 9º dígito em celulares
 * 
 * @param {string} phone - Número a ser normalizado
 * @returns {Array<string>} Array com todas as variações possíveis do número
 */
function normalizePhoneNumber(phone) {
  if (!phone) return [];
  
  // Remove tudo que não é número
  const cleaned = phone.replace(/\D/g, '');
  
  const variations = [cleaned];
  
  // Se tem 55 no início (código do Brasil)
  if (cleaned.startsWith('55') && cleaned.length >= 12) {
    const withoutCountryCode = cleaned.substring(2); // Remove 55
    variations.push(withoutCountryCode);
    
    // Se o número tem 11 dígitos após o 55 (celular com 9º dígito)
    if (withoutCountryCode.length === 11) {
      // Remove o 9º dígito (3º caractere)
      const without9 = withoutCountryCode.substring(0, 2) + withoutCountryCode.substring(3);
      variations.push(without9);
      variations.push('55' + without9); // Com 55 mas sem 9º dígito
    }
  } 
  // Se NÃO tem 55 no início
  else {
    // Tenta adicionar 55
    variations.push('55' + cleaned);
    
    // Se tem 11 dígitos (celular com 9º dígito)
    if (cleaned.length === 11) {
      // Remove o 9º dígito
      const without9 = cleaned.substring(0, 2) + cleaned.substring(3);
      variations.push(without9);
      variations.push('55' + without9);
    }
    // Se tem 10 dígitos (sem 9º dígito)
    else if (cleaned.length === 10) {
      // Adiciona o 9º dígito
      const with9 = cleaned.substring(0, 2) + '9' + cleaned.substring(2);
      variations.push(with9);
      variations.push('55' + with9);
    }
  }
  
  // Remove duplicatas e retorna
  return [...new Set(variations)];
}

/**
 * 🔍 Verifica se dois números de telefone são equivalentes
 * Compara considerando diferentes formatos (com/sem 55, com/sem 9º dígito)
 * 
 * @param {string} phone1 - Primeiro número
 * @param {string} phone2 - Segundo número
 * @returns {boolean} true se os números são equivalentes
 */
function phonesMatch(phone1, phone2) {
  const variations1 = normalizePhoneNumber(phone1);
  const variations2 = normalizePhoneNumber(phone2);
  
  console.log(`      🔢 Variações de "${phone1}": ${JSON.stringify(variations1)}`);
  console.log(`      🔢 Variações de "${phone2}": ${JSON.stringify(variations2)}`);
  
  // Verifica se alguma variação do phone1 existe nas variações do phone2
  const hasMatch = variations1.some(v1 => variations2.includes(v1));
  console.log(`      🎯 Match encontrado? ${hasMatch}`);
  
  return hasMatch;
}

/**
 * Substitui variáveis no formato {{nome}} pelos valores fornecidos
 * Exemplo: "Olá {{nome}}" + {nome: "João"} → "Olá João"
 * @param {string} text - Texto com variáveis
 * @param {object} variables - Objeto com valores das variáveis
 * @returns {string} Texto com variáveis substituídas
 */
function replaceVariables(text, variables) {
  if (!text || !variables) return text;
  
  let result = text;
  
  // Para cada variável fornecida
  Object.entries(variables).forEach(([varName, varValue]) => {
    if (varValue !== null && varValue !== undefined) {
      // Substituir {{nome}} ou {{ nome }} (com espaços opcionais)
      const regex = new RegExp(`{{\\s*${varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*}}`, 'g');
      result = result.replace(regex, String(varValue));
    }
  });
  
  return result;
}

/**
 * Converte arquivo local para Base64 com compressão para imagens
 * @param {string} fileUrl - URL ou caminho do arquivo
 * @param {boolean} compress - Se deve comprimir imagens (padrão: true)
 * @returns {object} { success: boolean, file: string, error?: string }
 */
async function convertFileToBase64(fileUrl, compress = true) {
  try {
    // Remove o domínio da URL, mantendo apenas o path relativo
    let filePath = fileUrl;
    if (fileUrl.startsWith('http')) {
      // Remove qualquer domínio/porta e mantém apenas o path
      filePath = '.' + fileUrl.replace(/^https?:\/\/[^\/]+/, '');
    } else {
      filePath = '.' + fileUrl;
    }
    
    console.log('📁 Convertendo arquivo para Base64:', filePath);
    
    // Detecta MIME type pela extensão
    const ext = path.extname(filePath).toLowerCase();
    let mimeType = 'application/octet-stream';
    
    const mimeTypes = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.mp4': 'video/mp4',
      '.avi': 'video/x-msvideo',
      '.mov': 'video/quicktime',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };
    
    mimeType = mimeTypes[ext] || mimeType;
    
    let fileBuffer = fs.readFileSync(filePath);
    const originalSize = fileBuffer.length;
    
    // Comprimir imagens se for o caso
    const isImage = ['.png', '.jpg', '.jpeg', '.webp'].includes(ext);
    if (isImage && compress) {
      console.log(`🔄 Comprimindo imagem (tamanho original: ${(originalSize / 1024).toFixed(2)} KB)...`);
      
      try {
        // Comprimir e redimensionar se necessário
        const image = sharp(fileBuffer);
        const metadata = await image.metadata();
        
        // Limitar tamanho máximo para 1200px para carrosséis (mantendo boa qualidade)
        const maxSize = 1200;
        let resizeOptions = {};
        
        if (metadata.width > maxSize || metadata.height > maxSize) {
          resizeOptions = {
            width: maxSize,
            height: maxSize,
            fit: 'inside',
            withoutEnlargement: true
          };
          console.log(`📐 Redimensionando de ${metadata.width}x${metadata.height} para max ${maxSize}px`);
        }
        
        // Comprimir com qualidade 85% para manter boa qualidade visual
        fileBuffer = await image
          .resize(resizeOptions.width ? resizeOptions : undefined)
          .jpeg({ quality: 85, progressive: true })
          .toBuffer();
        
        const compressedSize = fileBuffer.length;
        const reduction = ((1 - compressedSize / originalSize) * 100).toFixed(1);
        console.log(`✅ Imagem comprimida: ${(compressedSize / 1024).toFixed(2)} KB (redução de ${reduction}%)`);
        
        // Forçar MIME type para JPEG após compressão
        mimeType = 'image/jpeg';
      } catch (compressError) {
        console.warn('⚠️ Erro ao comprimir imagem, usando original:', compressError.message);
        // Continua com o buffer original
      }
    }
    
    const base64 = fileBuffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64}`;
    
    console.log(`✅ Arquivo convertido: ${ext} (${mimeType}) - ${(base64.length / 1024).toFixed(2)} KB em Base64`);
    
    // Avisar se o Base64 estiver muito grande
    if (base64.length > 50 * 1024 * 1024) { // > 50MB
      console.warn(`⚠️ AVISO: Arquivo muito grande (${(base64.length / 1024 / 1024).toFixed(2)} MB). Pode causar problemas no envio.`);
    }
    
    return {
      success: true,
      file: dataUrl
    };
  } catch (error) {
    console.error('❌ Erro ao converter arquivo:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Formata choices de lista para o formato esperado pela API UAZ
 * Formato: ["[Seção]", "texto|id|descrição", ...]
 * @param {Array<string>} choices - Array de strings com as opções
 * @returns {Array<string>} - Array formatado com seção e itens
 */
function formatListChoices(choices) {
  const formatted = ["[Opções]"]; // Seção padrão
  
  choices.forEach((choice, index) => {
    const id = `option_${index + 1}`;
    const text = choice.substring(0, 24); // WhatsApp limita a 24 caracteres
    const description = choice.length > 24 ? choice.substring(24, 72) : ''; // Descrição até 72 chars
    
    // Formato: texto|id|descrição
    formatted.push(`${text}|${id}|${description}`);
  });
  
  return formatted;
}

/**
 * Substitui variáveis automáticas em um texto
 * Variáveis suportadas: {{data}}, {{hora}}, {{protocolo}}, {{saudacao}}, {{saudação}}
 * @param {string} text - Texto com variáveis a serem substituídas
 * @returns {string} - Texto com variáveis substituídas pelos valores atuais
 */
function processAutoVariables(text) {
  if (!text) return text;
  
  // ⏰ USAR TIMEZONE DE BRASÍLIA (America/Sao_Paulo = GMT-3)
  const now = new Date();
  const brasiliaTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  
  const autoVariables = {
    data: brasiliaTime.toLocaleDateString('pt-BR'),
    hora: brasiliaTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    protocolo: `${now.getTime()}${Math.floor(Math.random() * 1000)}`,
    saudacao: (() => {
      const hour = brasiliaTime.getHours();
      if (hour >= 6 && hour < 12) return 'Bom dia';
      if (hour >= 12 && hour < 18) return 'Boa tarde';
      return 'Boa noite';
    })(),
    saudação: (() => { // variação com acento
      const hour = brasiliaTime.getHours();
      if (hour >= 6 && hour < 12) return 'Bom dia';
      if (hour >= 12 && hour < 18) return 'Boa tarde';
      return 'Boa noite';
    })()
  };

  let processedText = text;
  
  // Substituir cada variável automática no texto
  Object.entries(autoVariables).forEach(([key, value]) => {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'gi');
    processedText = processedText.replace(regex, value);
  });

  // Log apenas se houve substituições
  if (processedText !== text) {
    console.log('🔤 Variáveis automáticas substituídas:', Object.keys(autoVariables).filter(key => {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'gi');
      return regex.test(text);
    }));
  }

  return processedText;
}

// ⚠️ AVISO: Sistema de Credenciais Multi-Tenant ATIVADO
// As rotas CRÍTICAS agora usam getTenantUazapCredentials() para buscar credenciais dinamicamente:
//   ✅ POST /instances (criar)
//   ✅ GET /instances/:id/qrcode (QR Code)
//   ✅ PUT /instances/:id (atualizar)
//   ✅ GET /instances/:id/status (verificar status)
//
// Outras rotas ainda usam credencial global (temporário para compatibilidade)
const UAZ_SERVER_URL = process.env.UAZ_SERVER_URL || 'https://nettsistemas.uazapi.com';
const UAZ_ADMIN_TOKEN = process.env.UAZ_ADMIN_TOKEN || '';

// 🔄 RELOAD FORÇADO - Sistema de variáveis automáticas ativo
console.log('✅ [RELOAD] Arquivo uaz.js carregado com suporte a variáveis automáticas!');

console.log('🔧 Sistema de Credenciais Multi-Tenant ATIVADO');
console.log('   ✅ Rotas críticas usam credenciais por tenant');
console.log('   ⚠️ Rotas legacy usam credencial global (temporário)');

// Instância global do uazService (usado apenas por rotas legacy que ainda não foram migradas)
const uazService = new UazService(UAZ_SERVER_URL, UAZ_ADMIN_TOKEN);

/**
 * GET /api/uaz/health
 * Verifica saúde da API UAZ
 */
router.get('/health', async (req, res) => {
  try {
    const result = await uazService.healthCheck();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/uaz/instances
 * Lista todas as instâncias UAZ
 * Query params:
 *  - refresh=true: Atualiza status de todas as instâncias antes de retornar
 */
router.get('/instances', async (req, res) => {
  try {
    const { refresh } = req.query;
    
    // 🔒 SEGURANÇA: Filtrar por tenant_id (usando tenantQuery para respeitar RLS)
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Tenant não identificado'
      });
    }
    
    const result = await tenantQuery(req, `
      SELECT 
        ui.*,
        p.name as proxy_name,
        p.host as proxy_host,
        p.port as proxy_port,
        p.username as proxy_username,
        p.password as proxy_password,
        p.type as proxy_type
      FROM uaz_instances ui
      LEFT JOIN proxies p ON ui.proxy_id = p.id
      WHERE ui.tenant_id = $1
      ORDER BY ui.created_at DESC
    `, [tenantId]);

    // Se refresh=true, atualiza o status de cada instância
    if (refresh === 'true') {
      console.log('\n🔄 ========================================');
      console.log('🔄 INICIANDO SINCRONIZAÇÃO DE INSTÂNCIAS UAZ');
      console.log('🔄 ========================================');
      console.log(`📊 Total de instâncias no banco: ${result.rows.length}`);
      
      // 🔑 BUSCAR CREDENCIAIS DO TENANT
      const credentials = await getTenantUazapCredentials(tenantId);
      const tenantUazService = new UazService(credentials.serverUrl, credentials.adminToken);
      
      const instancesWithSync = await Promise.all(result.rows.map(async (instance) => {
        console.log(`\n🔍 Verificando: ${instance.name} (ID: ${instance.id})`);
        
        // Só verifica se tiver token
        if (!instance.instance_token) {
          console.log(`   ⚠️  Sem token, pulando verificação`);
          return instance;
        }

        console.log(`   🔑 Token: ${instance.instance_token?.substring(0, 20)}...`);
        
        try {
          const proxyConfig = instance.proxy_host ? {
            host: instance.proxy_host,
            port: instance.proxy_port,
            username: instance.proxy_username,
            password: instance.proxy_password
          } : null;

          // Verifica status na UAZ API
          const statusResult = await tenantUazService.getStatus(instance.instance_token, proxyConfig);

          if (statusResult.success) {
            // statusResult.connected já vem da função getStatus
            const isConnected = statusResult.connected || false;
            const status = isConnected ? 'connected' : 'disconnected';
            
            // Extrai dados do perfil
            const profileName = statusResult.data?.instance?.profileName || 
                              statusResult.data?.instance?.profile_name || 
                              instance.profile_name;
            
            const profilePicUrl = statusResult.data?.instance?.profilePicUrl || 
                                statusResult.data?.instance?.profile_pic_url || 
                                instance.profile_pic_url;
            
            const phoneNumber = statusResult.data?.instance?.owner || 
                              statusResult.data?.status?.jid?.split('@')[0] ||
                              statusResult.data?.instance?.phoneNumber || 
                              statusResult.data?.phone || 
                              instance.phone_number;

            // Atualiza no banco se mudou
            if (instance.is_connected !== isConnected || instance.status !== status) {
              // 🔒 SEGURANÇA: Filtrar por tenant_id
              await tenantQuery(req,
                `UPDATE uaz_instances 
                 SET is_connected = $1, status = $2, phone_number = $3, 
                     profile_name = $4, profile_pic_url = $5, updated_at = NOW()
                 WHERE id = $6 AND tenant_id = $7`,
                [isConnected, status, phoneNumber, profileName, profilePicUrl, instance.id, instance.tenant_id]
              );
              
              console.log(`✅ Instância ${instance.name} (${instance.id}): ${status}`);
            }

            // Retorna dados atualizados
            return {
              ...instance,
              is_connected: isConnected,
              status: status,
              phone_number: phoneNumber,
              profile_name: profileName,
              profile_pic_url: profilePicUrl
            };
          } else {
            // ⚠️ Se getStatus retornou success=false, lançar exceção para acionar a lógica de sincronização
            const error = new Error(statusResult.error || 'Falha ao verificar status');
            error.isUazApiError = true;
            error.originalError = statusResult.error;
            throw error;
          }
        } catch (error) {
          // 🚨 SINCRONIZAÇÃO: Se a instância não existe mais na UAZ API (404 ou 401), deletar do banco local
          const isInvalidToken = error.response?.status === 404 || 
                                 error.response?.status === 401 ||
                                 error.response?.data?.message?.toLowerCase().includes('invalid token') ||
                                 error.message?.toLowerCase().includes('invalid token') ||
                                 error.originalError?.toLowerCase().includes('invalid token') ||
                                 error.message?.toLowerCase().includes('not found') ||
                                 error.message?.toLowerCase().includes('instance not found');
          
          if (isInvalidToken) {
            
            console.log(`\n🗑️  ========================================`);
            console.log(`🗑️  SINCRONIZAÇÃO: Instância não existe mais na UAZ API`);
            console.log(`🗑️  ========================================`);
            console.log(`📦 Instância: ${instance.name} (ID: ${instance.id})`);
            console.log(`🔑 Token: ${instance.instance_token?.substring(0, 20)}...`);
            console.log(`❌ Erro: ${error.response?.status || 'Unknown'} - ${error.response?.data?.message || error.message}`);
            console.log(`📝 Status: Token inválido ou instância deletada na UAZ API, removendo do banco local...`);
            
            try {
              // Deletar do banco local
              await tenantQuery(req, 
                'DELETE FROM uaz_instances WHERE id = $1 AND tenant_id = $2', 
                [instance.id, instance.tenant_id]
              );
              
              console.log(`✅ Instância ${instance.name} (${instance.id}) removida do banco local com sucesso!`);
              console.log(`========================================\n`);
              
              // Retornar null para filtrar depois
              return null;
            } catch (deleteError) {
              console.error(`❌ Erro ao deletar instância do banco:`, deleteError.message);
            }
          } else {
            // Outros erros apenas loga e mantém no banco
            console.error(`⚠️ Erro ao verificar status de ${instance.name}:`, error.message);
          }
        }

        return instance;
      }));

      // Filtrar instâncias null (que foram deletadas na UAZ API)
      const updatedInstances = instancesWithSync.filter(instance => instance !== null);
      
      return res.json({
        success: true,
        data: updatedInstances
      });
    }

    // Retorno normal (sem refresh)
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/uaz/instances/:id
 * Obtém detalhes de uma instância específica
 */
router.get('/instances/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 🔒 SEGURANÇA: Filtrar por tenant_id (usando tenantQuery para respeitar RLS)
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        error: 'Tenant não identificado'
      });
    }
    
    const result = await tenantQuery(req, `
      SELECT 
        ui.*,
        p.name as proxy_name,
        p.host as proxy_host,
        p.port as proxy_port,
        p.username as proxy_username,
        p.password as proxy_password,
        p.type as proxy_type
      FROM uaz_instances ui
      LEFT JOIN proxies p ON ui.proxy_id = p.id
      WHERE ui.id = $1 AND ui.tenant_id = $2
    `, [id, tenantId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Instância não encontrada'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/uaz/instances
 * Cria nova instância UAZ
 */
router.post('/instances', checkWhatsAppQR, checkWhatsAppLimit, async (req, res) => {
  try {
    let {
      name,
      session_name,
      instance_token,
      webhook_url,
      proxy_id,
      is_active = true
    } = req.body;

    // Gerar nome automático se não fornecido
    if (!name || name.trim() === '') {
      const timestamp = Date.now();
      name = `instancia_${timestamp}`;
      console.log(`📝 Nome não fornecido, gerando automaticamente: ${name}`);
    }

    // Gerar session_name automático se não fornecido
    if (!session_name || session_name.trim() === '') {
      // Se o nome foi fornecido, usar o nome como base para session_name
      if (name && name.trim() !== '') {
        // Limpar o nome para criar um session_name válido (apenas letras e números)
        session_name = name.toLowerCase().replace(/[^a-z0-9]/g, '');
        console.log(`📝 Session name não fornecido, usando nome da conexão: ${session_name}`);
      } else {
        // Se ambos estão vazios, gerar automaticamente
        const timestamp = Date.now();
        const randomSuffix = Math.floor(Math.random() * 1000);
        session_name = `session${timestamp}${randomSuffix}`;
        console.log(`📝 Session name não fornecido, gerando automaticamente: ${session_name}`);
      }
    }

    // 🔒 SEGURANÇA: Obter tenant_id
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        error: 'Tenant não identificado'
      });
    }

    // 🔗 BUSCAR WEBHOOK URL DO TENANT
    const tenantResult = await pool.query(
      'SELECT webhook_url FROM tenants WHERE id = $1',
      [tenantId]
    );
    
    if (tenantResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Tenant não encontrado'
      });
    }
    
    // Usar webhook do tenant (sobrescreve se veio no body)
    webhook_url = tenantResult.rows[0].webhook_url || webhook_url;
    
    console.log('🔗 Webhook do tenant será usado:', webhook_url);

    // Verifica se o session_name já existe no tenant
    const existingSession = await pool.query(
      'SELECT id FROM uaz_instances WHERE session_name = $1 AND tenant_id = $2',
      [session_name, tenantId]
    );
    
    if (existingSession.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Já existe uma instância com esse nome de sessão'
      });
    }

    let finalInstanceToken = instance_token;
    let createResponse = null;
    let usedCredentialId = null;

    // Se não foi fornecido token, cria automaticamente via API UAZ
    if (!instance_token || instance_token.trim() === '') {
      // 🔑 BUSCAR CREDENCIAIS DO TENANT
      const credentials = await getTenantUazapCredentials(tenantId);
      console.log(`🔑 Usando credencial: "${credentials.credentialName}"`);
      console.log(`   URL: ${credentials.serverUrl}`);
      console.log(`   Credential ID: ${credentials.credentialId}`);

      // 🔖 SALVAR qual credencial está sendo usada
      usedCredentialId = credentials.credentialId;

      // Criar instância do UazService com as credenciais corretas
      const tenantUazService = new UazService(credentials.serverUrl, credentials.adminToken);

      // Obtém configuração do proxy se existir
      let proxyConfig = null;
      if (proxy_id) {
        // 🔒 SEGURANÇA: Buscar proxy COM filtro de tenant
        const tenantId = req.tenant?.id;
        if (!tenantId) {
          return res.status(401).json({
            success: false,
            message: 'Tenant não identificado'
          });
        }
        
        const proxyResult = await pool.query('SELECT * FROM proxies WHERE id = $1 AND tenant_id = $2', [proxy_id, tenantId]);
        if (proxyResult.rows.length > 0) {
          const proxy = proxyResult.rows[0];
          proxyConfig = {
            host: proxy.host,
            port: proxy.port,
            username: proxy.username,
            password: proxy.password
          };
        }
      }

      // Cria instância no UAZ e obtém o token (usando as credenciais corretas do tenant)
      createResponse = await tenantUazService.createInstance(session_name, proxyConfig);
      
      if (!createResponse.success) {
        return res.status(400).json({
          success: false,
          error: 'Erro ao criar instância no QR Connect: ' + createResponse.error
        });
      }

      finalInstanceToken = createResponse.instanceToken;

      // 🔗 CONFIGURAR WEBHOOK NA UAZ API
      try {
        const tenantUazService = new UazService(credentials.serverUrl, credentials.adminToken);
        await tenantUazService.configureWebhook(finalInstanceToken, proxyConfig, webhook_url);
        console.log('✅ Webhook configurado na UAZ API');
      } catch (webhookError) {
        console.warn('⚠️ Erro ao configurar webhook (não crítico):', webhookError.message);
        // Não impede a criação da instância
      }
    }

    // 🔒 SEGURANÇA: Salva no banco com tenant_id E credential_id (usando tenantQuery para respeitar RLS)
    console.log(`💾 Salvando instância com credencial ID: ${usedCredentialId || 'NULL (token manual)'}`);
    const insertResult = await tenantQuery(req, `
      INSERT INTO uaz_instances (
        name, session_name, instance_token, webhook_url, proxy_id, 
        is_active, status, tenant_id, credential_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [name, session_name, finalInstanceToken, webhook_url, proxy_id, is_active, 'disconnected', tenantId, usedCredentialId]);

    res.json({
      success: true,
      data: insertResult.rows[0],
      uaz_response: createResponse,
      message: createResponse 
        ? 'Instância criada automaticamente com sucesso via QR Connect!'
        : 'Instância cadastrada com sucesso! Agora você pode gerar o QR Code.'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/uaz/instances/:id
 * Atualiza instância UAZ (nome da instância E nome do perfil do WhatsApp)
 */
router.put('/instances/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      profile_name,
      webhook_url,
      proxy_id,
      is_active
    } = req.body;

    // 🔒 SEGURANÇA: Validar tenant
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        error: 'Tenant não identificado'
      });
    }

    // Busca a instância atual para obter o token e proxy (usando tenantQuery para RLS)
    const currentInstance = await tenantQuery(req, `
      SELECT ui.*, p.host, p.port, p.username, p.password
      FROM uaz_instances ui
      LEFT JOIN proxies p ON ui.proxy_id = p.id
      WHERE ui.id = $1 AND ui.tenant_id = $2
    `, [id, tenantId]);

    if (currentInstance.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Instância não encontrada'
      });
    }

    const inst = currentInstance.rows[0];
    
    // 🔑 BUSCAR CREDENCIAIS DO TENANT
    const credentials = await getTenantUazapCredentials(tenantId);
    const tenantUazService = new UazService(credentials.serverUrl, credentials.adminToken);
    
    const proxyConfig = inst.host ? {
      host: inst.host,
      port: inst.port,
      username: inst.username,
      password: inst.password
    } : null;

    let messages = [];

    // Atualiza nome da instância se foi alterado
    if (name && name !== inst.name && inst.instance_token) {
      console.log(`✏️ Atualizando nome da instância ${inst.name} → ${name} (ID: ${id})`);
      
      const updateResult = await tenantUazService.updateInstanceName(
        inst.instance_token, 
        name, 
        proxyConfig
      );

      if (updateResult.success) {
        console.log(`✅ Nome da instância atualizado com sucesso na API UAZ`);
        messages.push('Nome da instância atualizado');
      } else {
        console.warn(`⚠️ Aviso ao atualizar nome na API UAZ: ${updateResult.error}`);
      }
    }

    // Atualiza nome do perfil do WhatsApp se foi fornecido
    let updatedProfileName = profile_name;
    if (profile_name && profile_name.trim() !== '' && inst.instance_token && inst.is_connected) {
      console.log(`👤 Atualizando nome do perfil do WhatsApp: ${profile_name} (ID: ${id})`);
      
      const profileResult = await tenantUazService.updateProfileName(
        inst.instance_token,
        profile_name,
        proxyConfig
      );

      if (profileResult.success) {
        console.log(`✅ Nome do perfil atualizado com sucesso no WhatsApp`);
        messages.push('Nome do perfil do WhatsApp atualizado');
        
        // ⏳ AGUARDA 3 SEGUNDOS PARA API UAZ SINCRONIZAR
        console.log(`⏳ Aguardando 3 segundos para API UAZ sincronizar o nome...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // 🔄 BUSCA O NOME ATUALIZADO DO WHATSAPP
        console.log(`🔍 Buscando nome do perfil atualizado do WhatsApp...`);
        try {
          const statusResult = await tenantUazService.getStatus(inst.instance_token, proxyConfig);
          if (statusResult.success && statusResult.data) {
            // Busca no lugar correto de acordo com a documentação UAZ API
            const realProfileName = statusResult.data.instance?.profileName || profile_name;
            
            console.log('🔍 DEBUG - statusResult.data.instance.profileName:', statusResult.data.instance?.profileName);
            console.log('🔍 DEBUG - Nome real do perfil:', realProfileName);
            
            if (realProfileName && realProfileName !== profile_name) {
              console.log(`✅ Nome real do perfil obtido: ${realProfileName} (diferente do enviado: ${profile_name})`);
              updatedProfileName = realProfileName;
            } else {
              console.log(`✅ Nome do perfil confirmado: ${realProfileName}`);
              updatedProfileName = realProfileName;
            }
          }
        } catch (statusError) {
          console.warn(`⚠️ Não foi possível buscar nome atualizado, usando o enviado:`, statusError.message);
        }
      } else {
        console.warn(`⚠️ Aviso ao atualizar nome do perfil: ${profileResult.error}`);
        if (profileResult.error.includes('No session')) {
          messages.push('⚠️ Conexão deve estar ativa para atualizar nome do perfil');
        }
      }
    }

    // 🔒 SEGURANÇA: Atualiza no banco de dados local COM filtro tenant_id
    const result = await tenantQuery(req, `
      UPDATE uaz_instances 
      SET name = COALESCE($1, name),
          profile_name = COALESCE($2, profile_name),
          webhook_url = COALESCE($3, webhook_url),
          proxy_id = $4,
          is_active = COALESCE($5, is_active),
          updated_at = NOW()
      WHERE id = $6 AND tenant_id = $7
      RETURNING *
    `, [name, updatedProfileName, webhook_url, proxy_id, is_active, id, tenantId]);

    console.log(`✅ Instância ${result.rows[0].name} (ID: ${id}) atualizada no banco de dados local`);

    const message = messages.length > 0 
      ? messages.join(' e ') 
      : 'Instância atualizada com sucesso';

    res.json({
      success: true,
      data: result.rows[0],
      message: message
    });
  } catch (error) {
    console.error('❌ Erro ao atualizar instância:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/uaz/instances/:id/sync-profile
 * Sincroniza o nome do perfil do WhatsApp com o banco de dados
 */
router.put('/instances/:id/sync-profile', async (req, res) => {
  try {
    const { id } = req.params;

    // 🔒 SEGURANÇA: Obter tenant_id
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        error: 'Tenant não identificado'
      });
    }

    console.log(`🔄 Sincronizando nome do perfil da instância ID: ${id}`);

    // Busca a instância atual (usando tenantQuery para RLS)
    const currentInstance = await tenantQuery(req, `
      SELECT ui.*, p.host, p.port, p.username, p.password
      FROM uaz_instances ui
      LEFT JOIN proxies p ON ui.proxy_id = p.id
      WHERE ui.id = $1 AND ui.tenant_id = $2
    `, [id, tenantId]);

    if (currentInstance.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Instância não encontrada'
      });
    }

    const inst = currentInstance.rows[0];

    if (!inst.instance_token) {
      return res.status(400).json({
        success: false,
        error: 'Instância sem token. Não é possível sincronizar.'
      });
    }

    if (!inst.is_connected) {
      return res.status(400).json({
        success: false,
        error: 'Instância não está conectada. Conecte-se primeiro.'
      });
    }

    const proxyConfig = inst.host ? {
      host: inst.host,
      port: inst.port,
      username: inst.username,
      password: inst.password
    } : null;

    // 🔑 BUSCAR CREDENCIAIS DO TENANT
    const credentials = await getTenantUazapCredentials(tenantId);
    const tenantUazService = new UazService(credentials.serverUrl, credentials.adminToken);

    // Busca o status atual do WhatsApp
    console.log(`🔍 Buscando nome do perfil atual do WhatsApp...`);
    const statusResult = await tenantUazService.getStatus(inst.instance_token, proxyConfig);

    if (!statusResult.success) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar status do WhatsApp: ' + statusResult.error
      });
    }

    // Extrai o profileName de acordo com a documentação UAZ API
    // O profileName está em: statusResult.data.instance.profileName
    const profileName = statusResult.data?.instance?.profileName || null;
    
    console.log('🔍 DEBUG - profileName buscado em statusResult.data.instance.profileName:', profileName);
    console.log('🔍 DEBUG - Estrutura de statusResult.data.instance:');
    console.log(JSON.stringify(statusResult.data?.instance, null, 2));

    if (!profileName) {
      return res.status(404).json({
        success: false,
        error: 'Nome do perfil não disponível no WhatsApp'
      });
    }

    // 🔒 SEGURANÇA: Atualiza no banco de dados COM tenant_id
    await tenantQuery(req, `
      UPDATE uaz_instances 
      SET profile_name = $1,
          updated_at = NOW()
      WHERE id = $2 AND tenant_id = $3
    `, [profileName, id, tenantId]);

    console.log(`✅ Nome do perfil sincronizado: ${profileName}`);

    res.json({
      success: true,
      profile_name: profileName,
      message: 'Nome do perfil sincronizado com sucesso'
    });
  } catch (error) {
    console.error('❌ Erro ao sincronizar perfil:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/uaz/instances/:id/profile-image
 * Atualiza a foto do perfil do WhatsApp
 */
router.post('/instances/:id/profile-image', async (req, res) => {
  try {
    const { id } = req.params;
    const { image } = req.body;

    console.log(`📸 Atualizando foto do perfil da instância ID: ${id}`);

    if (!image || image.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'URL da imagem é obrigatória'
      });
    }

    // Busca a instância atual
    const currentInstance = await pool.query(`
      SELECT ui.*, p.host, p.port, p.username, p.password
      FROM uaz_instances ui
      LEFT JOIN proxies p ON ui.proxy_id = p.id
      WHERE ui.id = $1
    `, [id]);

    if (currentInstance.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Instância não encontrada'
      });
    }

    const inst = currentInstance.rows[0];

    if (!inst.instance_token) {
      return res.status(400).json({
        success: false,
        error: 'Instância sem token. Não é possível atualizar foto.'
      });
    }

    if (!inst.is_connected) {
      return res.status(400).json({
        success: false,
        error: 'Instância não está conectada. Conecte-se primeiro.'
      });
    }

    const proxyConfig = inst.host ? {
      host: inst.host,
      port: inst.port,
      username: inst.username,
      password: inst.password
    } : null;

    // 🔑 BUSCAR CREDENCIAIS DO TENANT
    const credentials = await getTenantUazapCredentials(tenantId);
    const tenantUazService = new UazService(credentials.serverUrl, credentials.adminToken);

    // Atualiza a foto do perfil
    console.log(`📤 Enviando foto do perfil para API UAZ...`);
    const imageResult = await tenantUazService.updateProfileImage(inst.instance_token, image, proxyConfig);

    if (!imageResult.success) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao atualizar foto do perfil: ' + imageResult.error
      });
    }

    console.log(`✅ Foto do perfil atualizada com sucesso`);

    res.json({
      success: true,
      message: image === 'remove' || image === 'delete' ? 'Foto do perfil removida com sucesso' : 'Foto do perfil atualizada com sucesso',
      data: imageResult.data
    });
  } catch (error) {
    console.error('❌ Erro ao atualizar foto do perfil:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/uaz/instances/delete-all
 * Remove TODAS as instâncias UAZ (deleta permanentemente da API UAZ também)
 */
router.delete('/instances/delete-all', async (req, res) => {
  try {
    console.log('\n🗑️ ========================================');
    console.log('🗑️ EXCLUINDO TODAS AS INSTÂNCIAS UAZ');
    console.log('🗑️ ========================================\n');

    // Busca todas as instâncias
    // 🔒 SEGURANÇA: Filtrar por tenant_id
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Tenant não identificado'
      });
    }
    
    const allInstances = await pool.query(`
      SELECT ui.*, p.host, p.port, p.username, p.password
      FROM uaz_instances ui
      LEFT JOIN proxies p ON ui.proxy_id = p.id
      WHERE ui.tenant_id = $1
    `, [tenantId]);

    const instances = allInstances.rows;
    
    if (instances.length === 0) {
      return res.json({
        success: true,
        message: 'Nenhuma instância para excluir',
        deleted: 0
      });
    }

    console.log(`📋 Total de instâncias encontradas: ${instances.length}`);

    // 🔑 BUSCAR CREDENCIAIS DO TENANT
    const credentials = await getTenantUazapCredentials(tenantId);
    const tenantUazService = new UazService(credentials.serverUrl, credentials.adminToken);

    let deletedFromAPI = 0;
    let failedFromAPI = 0;

    // Deleta cada instância da API UAZ
    for (const inst of instances) {
      if (inst.instance_token) {
        console.log(`\n🗑️ Deletando: ${inst.name} (ID: ${inst.id})`);
        
        const proxyConfig = inst.host ? {
          host: inst.host,
          port: inst.port,
          username: inst.username,
          password: inst.password
        } : null;

        const deleteResult = await tenantUazService.deleteInstance(inst.instance_token, proxyConfig);
        
        if (deleteResult.success) {
          console.log(`   ✅ Deletada com sucesso da API UAZ`);
          deletedFromAPI++;
        } else {
          console.warn(`   ⚠️ Erro ao deletar da API UAZ: ${deleteResult.error}`);
          failedFromAPI++;
        }
      } else {
        console.log(`\n   ℹ️ ${inst.name} (ID: ${inst.id}) - Sem token, pulando API UAZ`);
      }
    }

    // Remove todas as referências antes de deletar as instâncias
    console.log('\n🧹 Removendo todas as referências...');
    
    // 🔒 SEGURANÇA: Buscar IDs das instâncias do tenant para filtrar
    const instanceIds = instances.map(inst => inst.id);
    
    // 1. Remove apenas de qr_campaign_templates DO TENANT (via instance_id) - usando tenantQuery
    const qrCampaignTemplatesResult = await tenantQuery(req,
      'DELETE FROM qr_campaign_templates WHERE instance_id = ANY($1::int[])',
      [instanceIds]
    );
    console.log(`   ├─ Removidas ${qrCampaignTemplatesResult.rowCount || 0} referências em qr_campaign_templates`);
    
    // 2. Atualiza apenas qr_campaign_messages DO TENANT para NULL (preserva histórico) - usando tenantQuery
    const qrCampaignMessagesResult = await tenantQuery(req,
      'UPDATE qr_campaign_messages SET instance_id = NULL WHERE instance_id = ANY($1::int[])',
      [instanceIds]
    );
    console.log(`   ├─ Atualizadas ${qrCampaignMessagesResult.rowCount || 0} mensagens em qr_campaign_messages`);
    
    // 3. Deleta todas do banco de dados local DO TENANT (usando tenantQuery para respeitar RLS)
    const deleteResult = await tenantQuery(req, 'DELETE FROM uaz_instances WHERE tenant_id = $1', [tenantId]);
    const deletedLocal = deleteResult.rowCount || 0;

    console.log('\n📊 ========================================');
    console.log(`📊 RESUMO DA EXCLUSÃO:`);
    console.log(`   ├─ Total de instâncias: ${instances.length}`);
    console.log(`   ├─ Deletadas da API UAZ: ${deletedFromAPI}`);
    console.log(`   ├─ Falhas na API UAZ: ${failedFromAPI}`);
    console.log(`   └─ Removidas do banco local: ${deletedLocal}`);
    console.log('📊 ========================================\n');

    res.json({
      success: true,
      message: `${deletedLocal} instância(s) removida(s) com sucesso`,
      deleted: deletedLocal,
      deletedFromAPI,
      failedFromAPI
    });
  } catch (error) {
    console.error('❌ Erro ao remover todas as instâncias:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/uaz/instances/:id
 * Remove instância UAZ (deleta permanentemente da API UAZ também)
 */
router.delete('/instances/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Busca a instância
    // 🔒 SEGURANÇA: Filtrar por tenant_id
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Tenant não identificado'
      });
    }
    
    const instance = await tenantQuery(req, 'SELECT * FROM uaz_instances WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    if (instance.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Instância não encontrada'
      });
    }

    const inst = instance.rows[0];
    
    // 🔑 BUSCAR CREDENCIAIS DO TENANT
    const credentials = await getTenantUazapCredentials(tenantId);
    const tenantUazService = new UazService(credentials.serverUrl, credentials.adminToken);
    
    // Deleta permanentemente da API UAZ (se tiver token)
    if (inst.instance_token) {
      console.log(`🗑️ Deletando instância ${inst.name} (ID: ${id}) da API UAZ...`);
      
      const deleteResult = await tenantUazService.deleteInstance(inst.instance_token);
      
      if (deleteResult.success) {
        console.log(`✅ Instância ${inst.name} deletada com sucesso da API UAZ`);
      } else {
        console.warn(`⚠️ Aviso ao deletar da API UAZ: ${deleteResult.error}`);
        console.warn(`   → Continuando com a exclusão do banco de dados local...`);
      }
    } else {
      console.log(`ℹ️ Instância ${inst.name} não possui token, removendo apenas do banco local`);
    }

    // Remove todas as referências antes de deletar a instância
    console.log(`🧹 Removendo referências da instância ${inst.name}...`);
    
    // 1. Remove de qr_campaign_templates (referência a instance_id) - usando tenantQuery para RLS
    const qrCampaignTemplatesResult = await tenantQuery(req,
      'DELETE FROM qr_campaign_templates WHERE instance_id = $1',
      [id]
    );
    console.log(`   ├─ Removidas ${qrCampaignTemplatesResult.rowCount || 0} referências em qr_campaign_templates`);
    
    // 2. Atualiza qr_campaign_messages para NULL ao invés de deletar (preserva histórico)
    const qrCampaignMessagesResult = await tenantQuery(req,
      'UPDATE qr_campaign_messages SET instance_id = NULL WHERE instance_id = $1',
      [id]
    );
    console.log(`   ├─ Atualizadas ${qrCampaignMessagesResult.rowCount || 0} mensagens em qr_campaign_messages`);
    
    // 3. Remove do banco de dados local (já com tenant_id validado acima)
    await tenantQuery(req, 'DELETE FROM uaz_instances WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    
    console.log(`✅ Instância ${inst.name} (ID: ${id}) removida do banco de dados local`);

    res.json({
      success: true,
      message: 'Instância removida com sucesso da plataforma e do QR Connect'
    });
  } catch (error) {
    console.error('❌ Erro ao remover instância:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/uaz/instances/:id/clean-duplicates
 * Limpa duplicatas de uma instância conectada
 */
router.post('/instances/:id/clean-duplicates', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenant?.id;
    
    if (!tenantId) {
      return res.status(401).json({ success: false, error: 'Tenant não identificado' });
    }
    
    console.log('\n🧹 ========================================');
    console.log('🧹 LIMPEZA DE DUPLICATAS - INICIANDO');
    console.log('🧹 ========================================');
    console.log('📋 Instância ID:', id);
    
    // Buscar instância no banco local
    const localInstance = await tenantQuery(req, `
      SELECT * FROM uaz_instances WHERE id = $1 AND tenant_id = $2
    `, [id, tenantId]);
    
    if (localInstance.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Instância não encontrada' });
    }
    
    const instance = localInstance.rows[0];
    const phoneNumber = instance.phone_number;
    
    if (!phoneNumber) {
      return res.json({ success: false, error: 'Instância sem número de telefone' });
    }
    
    console.log('📱 Número da instância:', phoneNumber);
    console.log('🔑 Token da instância:', instance.instance_token?.substring(0, 20) + '...');
    
    // Buscar credenciais
    const credentials = await getTenantUazapCredentials(tenantId);
    const tenantUazService = new UazService(credentials.serverUrl, credentials.adminToken);
    
    // Buscar TODAS as instâncias na UAZ API
    console.log('🔍 Buscando todas as instâncias na UAZ API...');
    const fetchResult = await tenantUazService.fetchInstances();
    
    if (!fetchResult.success) {
      return res.json({ success: false, error: 'Falha ao buscar instâncias da UAZ API' });
    }
    
    const allInstances = fetchResult.instances || [];
    console.log(`📊 Total de instâncias na UAZ API: ${allInstances.length}`);
    
    // Procurar duplicatas com o mesmo número
    const duplicates = allInstances.filter(uazInst => {
      const uazPhone = uazInst.owner || uazInst.phoneNumber || '';
      const match = phonesMatch(phoneNumber, uazPhone);
      const isDifferent = uazInst.token !== instance.instance_token;
      return match && isDifferent;
    });
    
    console.log(`🔍 Duplicatas encontradas: ${duplicates.length}`);
    
    if (duplicates.length === 0) {
      console.log('✅ Nenhuma duplicata encontrada!');
      console.log('🧹 ========================================\n');
      return res.json({ success: true, message: 'Nenhuma duplicata encontrada', deleted: 0 });
    }
    
    // Analisar e tratar duplicatas de acordo com o status
    let deletedCount = 0;
    let keptOldConnected = false;
    
    for (const duplicate of duplicates) {
      const isConnected = duplicate.status === 'connected' || duplicate.state === 'open' || duplicate.connected === true;
      
      console.log('\n📋 Duplicata encontrada:');
      console.log('   └─ Token:', duplicate.token?.substring(0, 20) + '...');
      console.log('   └─ Status:', isConnected ? '🟢 CONECTADA' : '🔴 DESCONECTADA');
      console.log('   └─ Nome:', duplicate.name);
      
      if (isConnected) {
        // ✅ CASO 1: Duplicata está CONECTADA
        // REGRA: Deletar a instância ATUAL e importar a ANTIGA
        console.log('✅ Duplicata está CONECTADA! Mantendo a antiga e removendo a atual...');
        
        try {
          // 1. Verificar se a duplicata já está no banco local
          const localDuplicate = await tenantQuery(req, `
            SELECT id FROM uaz_instances 
            WHERE instance_token = $1 AND tenant_id = $2
          `, [duplicate.token, tenantId]);
          
          // 2. Se NÃO estiver, importar
          if (localDuplicate.rows.length === 0) {
            console.log('📥 Importando instância conectada para o banco local...');
            
            const proxyConfig = instance.proxy_id ? await tenantQuery(req, `
              SELECT * FROM proxies WHERE id = $1
            `, [instance.proxy_id]) : null;
            
            const proxyId = proxyConfig && proxyConfig.rows.length > 0 ? proxyConfig.rows[0].id : null;
            
            await tenantQuery(req, `
              INSERT INTO uaz_instances (
                tenant_id, name, session_name, instance_token, 
                phone_number, is_connected, webhook_url, proxy_id, created_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
            `, [
              tenantId,
              duplicate.name,
              duplicate.name,
              duplicate.token,
              duplicate.owner || duplicate.phoneNumber || null,
              true,
              instance.webhook_url || null,
              proxyId
            ]);
            
            console.log('✅ Instância conectada importada com sucesso!');
          } else {
            console.log('ℹ️  Instância conectada já existe no banco local');
          }
          
          // 3. Deletar a instância ATUAL (nova) do banco local
          console.log('🗑️  Deletando instância atual (nova) do banco local...');
          await tenantQuery(req, `
            DELETE FROM uaz_instances WHERE id = $1 AND tenant_id = $2
          `, [id, tenantId]);
          console.log('✅ Instância atual deletada!');
          
          keptOldConnected = true;
          deletedCount++; // Conta como "tratada"
          
        } catch (err) {
          console.error('❌ Erro ao tratar duplicata conectada:', err.message);
        }
        
      } else {
        // 🗑️ CASO 2: Duplicata está DESCONECTADA
        // REGRA: Deletar a duplicata antiga e manter a atual
        console.log('🗑️  Duplicata está DESCONECTADA! Deletando antiga...');
        
        try {
          // Deletar da UAZ API
          const deleteResult = await tenantUazService.deleteInstance(duplicate.token, null);
          
          if (deleteResult.success) {
            console.log('✅ Deletada da UAZ API com sucesso!');
            
            // Se estiver no banco local, deletar também
            const localDuplicate = await tenantQuery(req, `
              SELECT id FROM uaz_instances 
              WHERE instance_token = $1 AND tenant_id = $2
            `, [duplicate.token, tenantId]);
            
            if (localDuplicate.rows.length > 0) {
              await tenantQuery(req, `
                DELETE FROM uaz_instances WHERE id = $1 AND tenant_id = $2
              `, [localDuplicate.rows[0].id, tenantId]);
              console.log('✅ Deletada do banco local também!');
            }
            
            deletedCount++;
          } else {
            console.warn('⚠️  Falha ao deletar:', deleteResult.error);
          }
        } catch (err) {
          console.error('❌ Erro ao deletar duplicata desconectada:', err.message);
        }
      }
    }
    
    console.log(`\n✅ Limpeza concluída! ${deletedCount} duplicata(s) tratada(s)`);
    console.log('🧹 ========================================\n');
    
    if (keptOldConnected) {
      // Se manteve uma duplicata conectada, a instância atual foi deletada
      res.json({
        success: true,
        message: 'Duplicata conectada encontrada e mantida. Instância atual foi removida.',
        deleted: deletedCount,
        keptOldConnected: true,
        redirect: true
      });
    } else {
      // Se deletou duplicatas desconectadas
      res.json({
        success: true,
        message: `${deletedCount} duplicata(s) desconectada(s) removida(s) com sucesso`,
        deleted: deletedCount,
        keptOldConnected: false,
        redirect: false
      });
    }
    
  } catch (error) {
    console.error('❌ Erro na limpeza de duplicatas:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/uaz/instances/:id/qrcode
 * Obtém QR Code de uma instância
 */
router.get('/instances/:id/qrcode', async (req, res) => {
  try {
    const { id } = req.params;

    // 🔒 SEGURANÇA: Obter tenant_id
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        error: 'Tenant não identificado'
      });
    }

    // Busca instância (com validação de tenant, usando tenantQuery para respeitar RLS)
    const instance = await tenantQuery(req, `
      SELECT ui.*, p.host, p.port, p.username, p.password
      FROM uaz_instances ui
      LEFT JOIN proxies p ON ui.proxy_id = p.id
      WHERE ui.id = $1 AND ui.tenant_id = $2
    `, [id, tenantId]);

    if (instance.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Instância não encontrada'
      });
    }

    const inst = instance.rows[0];

    // Verifica se tem instance_token
    if (!inst.instance_token) {
      return res.status(400).json({
        success: false,
        error: 'Instância sem token. Recrie a instância.'
      });
    }

    // 🔑 BUSCAR CREDENCIAIS DO TENANT
    const credentials = await getTenantUazapCredentials(tenantId);
    const tenantUazService = new UazService(credentials.serverUrl, credentials.adminToken);

    const proxyConfig = inst.host ? {
      host: inst.host,
      port: inst.port,
      username: inst.username,
      password: inst.password
    } : null;

    // 🔗 CONFIGURAR WEBHOOK NA UAZ API (antes de obter QR Code)
    try {
      const webhookUrl = inst.webhook_url;
      if (webhookUrl) {
        await tenantUazService.configureWebhook(inst.instance_token, proxyConfig, webhookUrl);
        console.log('✅ Webhook configurado na UAZ API:', webhookUrl);
      }
    } catch (webhookError) {
      console.warn('⚠️ Erro ao configurar webhook (não crítico):', webhookError.message);
    }

    // Obtém QR Code usando instance_token e credenciais corretas do tenant
    const qrResult = await tenantUazService.getQRCode(inst.instance_token, inst.phone_number, proxyConfig);

    console.log('\n🔍 ============ VALIDAÇÃO DE CONEXÃO ============');
    console.log('📋 Instância:', inst.name, '(ID:', id, ')');
    
    if (qrResult.success) {
      // VALIDAÇÃO RIGOROSA: Múltiplas verificações
      const hasQRCode = qrResult.qrcode && qrResult.qrcode.length > 0;
      const connectedFlag = qrResult.connected === true;
      const loggedInFlag = qrResult.loggedIn === true;
      const instanceState = qrResult.state;
      const instanceStatus = qrResult.data?.instance?.status;
      
      // Considerar válido se:
      // - instance.state é 'open' ou 'connected' OU
      // - instance.status é 'connected' (quando state é undefined)
      const hasValidState = instanceState === 'open' || instanceState === 'connected';
      const hasValidStatus = instanceStatus === 'connected';
      const validSession = hasValidState || hasValidStatus;
      
      // REGRA: Se tem QR code = NÃO está conectado (obviamente)
      // REGRA: Só está conectado se flags E (state OU status) estiverem corretos
      const isConnected = !hasQRCode && (connectedFlag || loggedInFlag) && validSession;
      
      // Status baseado em análise completa
      let status = 'disconnected';
      if (isConnected) {
        status = 'connected';
      } else if (hasQRCode) {
        status = 'connecting'; // Tem QR code = aguardando leitura
      }
      
      console.log('📊 Análise:');
      console.log('   ├─ Tem QR Code:', hasQRCode ? '✅ SIM (aguardando leitura)' : '❌ NÃO');
      console.log('   ├─ Flag connected:', connectedFlag ? '✅' : '❌');
      console.log('   ├─ Flag loggedIn:', loggedInFlag ? '✅' : '❌');
      console.log('   ├─ State:', instanceState || 'não informado');
      console.log('   ├─ Status:', instanceStatus || 'não informado');
      console.log('   ├─ Valid Session:', validSession ? '✅' : '❌');
      console.log('   └─ 🎯 DECISÃO FINAL:', isConnected ? '✅ CONECTADO' : '❌ NÃO CONECTADO');
      console.log('   └─ 📌 STATUS:', status);
      console.log('============================================\n');
      
      // Atualiza no banco (incluindo is_connected!) - usando tenantQuery para respeitar RLS
      await tenantQuery(req, `
        UPDATE uaz_instances 
        SET qr_code = $1, 
            status = $2, 
            is_connected = $3,
            last_connected_at = CASE WHEN $3 = true THEN NOW() ELSE last_connected_at END,
            updated_at = NOW()
        WHERE id = $4 AND tenant_id = $5
      `, [qrResult.qrcode || '', status, isConnected, id, tenantId]);
      
      // Retorna com o QR Code formatado
      return res.json({
        success: true,
        qrcode: qrResult.qrcode || null,
        connected: isConnected,
        loggedIn: loggedInFlag,
        state: qrResult.state,
        data: qrResult.data
      });
    }
    
    console.log('❌ Falha ao obter QR Code:', qrResult.error);
    console.log('============================================\n');

    // 🚨 NOVO COMPORTAMENTO: Não fazer tratativa no erro 409
    // Apenas retornar o erro para o frontend tentar novamente
    // A tratativa será feita DEPOIS que a conexão for estabelecida com sucesso
    
    if (qrResult.errorCode === 409) {
      console.log('⚠️  ERRO 409 detectado - Retornando para o frontend tentar novamente');
      console.log('   └─ Mensagem:', qrResult.error);
      console.log('   └─ O frontend vai aguardar e tentar de novo até conseguir conectar');
      console.log('   └─ Tratativa de duplicatas será feita APÓS a conexão ser estabelecida\n');
    }

    // Retorna o erro para o frontend lidar (retry automático)
    res.json(qrResult);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/uaz/instances/:id/logout
 * Força logout/desconexão de uma instância
 */
router.post('/instances/:id/logout', async (req, res) => {
  try {
    const { id } = req.params;

    // 🔒 SEGURANÇA: Obter tenant_id
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        error: 'Tenant não identificado'
      });
    }

    // Busca instância usando tenantQuery para RLS
    const instance = await tenantQuery(req, `
      SELECT ui.*, p.host, p.port, p.username, p.password
      FROM uaz_instances ui
      LEFT JOIN proxies p ON ui.proxy_id = p.id
      WHERE ui.id = $1 AND ui.tenant_id = $2
    `, [id, tenantId]);

    if (instance.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Instância não encontrada'
      });
    }

    const inst = instance.rows[0];

    if (!inst.instance_token) {
      return res.status(400).json({
        success: false,
        error: 'Instância sem token. Recrie a instância.'
      });
    }

    const proxyConfig = inst.host ? {
      host: inst.host,
      port: inst.port,
      username: inst.username,
      password: inst.password
    } : null;

    // 🔑 BUSCAR CREDENCIAIS DO TENANT
    const credentials = await getTenantUazapCredentials(tenantId);
    const tenantUazService = new UazService(credentials.serverUrl, credentials.adminToken);

    console.log('\n🔌 ============ FORÇANDO LOGOUT ============');
    console.log('📋 Instância:', inst.name, '(ID:', id, ')');

    // Tenta fazer logout na API UAZ
    const logoutResult = await tenantUazService.logout(inst.instance_token, proxyConfig);

    console.log('📊 Resultado do logout:', logoutResult);
    await tenantQuery(req, `
      UPDATE uaz_instances 
      SET is_connected = false,
          status = 'disconnected',
          qr_code = '',
          phone_number = NULL,
          profile_name = NULL,
          profile_pic_url = NULL,
          updated_at = NOW()
      WHERE id = $1 AND tenant_id = $2
    `, [id, tenantId]);

    console.log('✅ Instância desconectada e resetada no banco de dados');
    console.log('============================================\n');

    res.json({
      success: true,
      message: 'Instância desconectada com sucesso',
      data: logoutResult
    });

  } catch (error) {
    console.error('❌ Erro ao fazer logout:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/uaz/instances/:id/status
 * Verifica status de conexão da instância
 */
router.get('/instances/:id/status', async (req, res) => {
  try {
    const { id } = req.params;

    // 🔒 SEGURANÇA: Obter tenant_id
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        error: 'Tenant não identificado'
      });
    }

    // 🔑 Buscar instância com credenciais corretas
    const { instance: inst, credentials, uazService: tenantUazService, proxyConfig } = await getInstanceWithCredentials(id, tenantId);

    if (!inst.instance_token) {
      return res.status(400).json({
        success: false,
        error: 'Instância sem token. Recrie a instância.'
      });
    }

    // Verifica status usando instance_token e credenciais corretas DA INSTÂNCIA
    const statusResult = await tenantUazService.getStatus(inst.instance_token, proxyConfig);

    console.log('\n🔍 ============ VERIFICAÇÃO DE STATUS ============');
    console.log('📋 Instância:', inst.name, '(ID:', id, ')');

    if (statusResult.success) {
      // VALIDAÇÃO RIGOROSA: uazService já faz a validação, usar o resultado dele
      const isConnected = statusResult.connected === true;
      
      // DEBUG: Verificando onde está o número de telefone
      console.log('📞 ========== DEBUG NÚMERO DE TELEFONE ==========');
      console.log('🔍 statusResult.data?.jid:', JSON.stringify(statusResult.data?.jid, null, 2));
      console.log('🔍 statusResult.data?.status?.jid:', statusResult.data?.status?.jid);
      console.log('🔍 statusResult.data?.instance?.owner:', statusResult.data?.instance?.owner);
      console.log('🔍 statusResult.data?.phone:', statusResult.data?.phone);
      console.log('🔍 statusResult.data?.instance?.wid:', JSON.stringify(statusResult.data?.instance?.wid, null, 2));
      console.log('🔍 statusResult.data?.instance?.number:', statusResult.data?.instance?.number);
      console.log('🔍 inst.phone_number (banco):', inst.phone_number);
      
      // Função auxiliar para extrair número do JID (formato: "5511999999999:3@s.whatsapp.net")
      const extractPhoneFromJid = (jid) => {
        if (!jid) return null;
        // JID pode ser: "5511999999999:3@s.whatsapp.net" ou "5511999999999@s.whatsapp.net"
        const match = jid.match(/^(\d+)/);
        return match ? match[1] : null;
      };
      
      // Número de telefone pode estar em vários lugares dependendo da versão da API
      let phoneNumber = null;
      
      // 1. Tenta extrair do owner (campo mais confiável nesta API)
      phoneNumber = statusResult.data?.instance?.owner;
      
      // 2. Se não encontrou, tenta extrair do JID no status
      if (!phoneNumber && statusResult.data?.status?.jid) {
        phoneNumber = extractPhoneFromJid(statusResult.data.status.jid);
      }
      
      // 3. Se não encontrou, tenta extrair do JID no root
      if (!phoneNumber && statusResult.data?.jid) {
        phoneNumber = extractPhoneFromJid(statusResult.data.jid);
      }
      
      // 4. Outras tentativas (outras versões da API)
      if (!phoneNumber) {
        phoneNumber = statusResult.data?.instance?.wid?.user ||
                     statusResult.data?.instance?.number ||
                     statusResult.data?.phone ||
                     inst.phone_number;
      }
      
      console.log('🎯 NÚMERO FINAL EXTRAÍDO:', phoneNumber);
      console.log('==============================================\n');
      
      // Busca profileName e profilePicUrl de acordo com a documentação UAZ API
      // O profileName está em: statusResult.data.instance.profileName
      // O profilePicUrl está em: statusResult.data.instance.profilePicUrl
      let profileName = null;
      let profilePicUrl = null;
      if (statusResult.data) {
        // Primeiro tenta buscar no lugar correto (documentação oficial)
        profileName = statusResult.data.instance?.profileName || null;
        profilePicUrl = statusResult.data.instance?.profilePicUrl || null;
        
        console.log('🔍 DEBUG - Estrutura completa de statusResult.data.instance:');
        console.log(JSON.stringify(statusResult.data.instance, null, 2));
        console.log('🔍 DEBUG - profileName extraído:', profileName);
        console.log('🔍 DEBUG - profilePicUrl extraído:', profilePicUrl);
      }
      
      // Status baseado na validação rigorosa
      let statusState = 'disconnected';
      if (isConnected) {
        statusState = 'connected';
      } else if (statusResult.qrcode && statusResult.qrcode.length > 0) {
        statusState = 'connecting';
      }

      console.log('📊 Resultado:');
      console.log('   ├─ Conectado:', isConnected ? '✅ SIM' : '❌ NÃO');
      console.log('   ├─ Status:', statusState);
      console.log('   ├─ Telefone:', phoneNumber || 'não informado');
      console.log('   ├─ Nome do Perfil:', profileName || 'não informado');
      console.log('   └─ Foto do Perfil:', profilePicUrl || 'não informada');
      console.log('🔍 DEBUG - statusResult.data completo:', JSON.stringify(statusResult.data, null, 2));
      console.log('============================================\n');

      // ✅ Usando tenantQuery para respeitar RLS e garantir tenant correto
      await tenantQuery(req, `
        UPDATE uaz_instances 
        SET is_connected = $1,
            status = $2,
            phone_number = $3,
            profile_name = COALESCE($4, profile_name),
            profile_pic_url = COALESCE($5, profile_pic_url),
            last_connected_at = CASE WHEN $1 = true THEN NOW() ELSE last_connected_at END,
            updated_at = NOW()
        WHERE id = $6 AND tenant_id = $7
      `, [isConnected, statusState, phoneNumber, profileName, profilePicUrl, id, tenantId]);

      // 🔍 VERIFICAÇÃO DE DUPLICAÇÃO AUTOMÁTICA
      // Se acabou de conectar E tem número, verificar se já existe em outra instância
      if (isConnected && phoneNumber && !inst.phone_number) {
        console.log('\n🔍 ========================================');
        console.log('🔍 VERIFICANDO DUPLICAÇÃO DE NÚMERO');
        console.log('🔍 ========================================');
        console.log('📱 Número detectado:', phoneNumber);
        console.log('🆔 Instância NOVA (acabou de conectar):', inst.name, '(ID:', id, ')');
        
        try {
          // Buscar todas as instâncias da UAZ API
          const fetchResult = await uazService.fetchInstances(proxyConfig);
          
          if (fetchResult.success && fetchResult.instances.length > 0) {
            // Procurar se este número já existe em OUTRA instância (conectada OU desconectada)
            const instanciaDuplicada = fetchResult.instances.find(i => 
              i.owner === phoneNumber && 
              i.token !== inst.instance_token
            );
            
            if (instanciaDuplicada) {
              console.log('\n⚠️  ========================================');
              console.log('⚠️  DUPLICAÇÃO DETECTADA!');
              console.log('⚠️  ========================================');
              console.log('📱 Número:', phoneNumber);
              console.log('📦 Instância NOVA:', inst.name, '(ID:', id, ') - Status: CONECTADA');
              console.log('📦 Instância ANTIGA:', instanciaDuplicada.name, '(Token:', instanciaDuplicada.token?.substring(0, 20) + '...) - Status:', instanciaDuplicada.status.toUpperCase());
              
              // 🎯 DECISÃO INTELIGENTE: Qual instância manter?
              const antigaEstaConectada = instanciaDuplicada.status === 'connected';
              
              if (antigaEstaConectada) {
                // ✅ CASO 1: Instância ANTIGA está CONECTADA → Manter ANTIGA, deletar NOVA
                console.log('\n💡 DECISÃO: Instância ANTIGA está CONECTADA');
                console.log('   ├─ ✅ MANTER: Instância ANTIGA (já está funcionando)');
                console.log('   └─ ❌ DELETAR: Instância NOVA (duplicada)');
                
                // 1️⃣ DELETAR a instância NOVA da UAZ API
                console.log('\n🗑️  Deletando instância NOVA da UAZ API...');
                const deleteResult = await uazService.deleteInstance(inst.instance_token, proxyConfig);
                
                if (deleteResult.success) {
                  console.log('   ✅ Instância NOVA deletada da UAZ API');
                } else {
                  console.warn('   ⚠️  Erro ao deletar da UAZ API:', deleteResult.error);
                }
                
                // 2️⃣ DELETAR a instância NOVA do banco local (COM filtro de tenant)
                console.log('🗑️  Deletando instância NOVA do banco local...');
                await tenantQuery(req, 'DELETE FROM uaz_instances WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
                console.log('   ✅ Instância NOVA deletada do banco local');
                
                // 3️⃣ VERIFICAR se a instância ANTIGA já está no banco (usando tenantQuery para respeitar RLS)
                const existenteNoBanco = await tenantQuery(req,
                  'SELECT id FROM uaz_instances WHERE instance_token = $1 AND tenant_id = $2',
                  [instanciaDuplicada.token, tenantId]
                );
                
                if (existenteNoBanco.rows.length === 0) {
                  // 4️⃣ IMPORTAR a instância ANTIGA (usando tenantQuery para respeitar RLS)
                  console.log('📥 Importando instância ANTIGA para o banco local...');
                  
                  const importResult = await tenantQuery(req, `
                    INSERT INTO uaz_instances (
                      name, 
                      session_name, 
                      instance_token, 
                      phone_number, 
                      profile_name, 
                      profile_pic_url, 
                      is_connected, 
                      status,
                      is_active,
                      tenant_id
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                    RETURNING *
                  `, [
                    instanciaDuplicada.name || phoneNumber,
                    instanciaDuplicada.name || instanciaDuplicada.id,
                    instanciaDuplicada.token,
                    instanciaDuplicada.owner,
                    instanciaDuplicada.profileName,
                    instanciaDuplicada.profilePicUrl,
                    instanciaDuplicada.status === 'connected',
                    instanciaDuplicada.status,
                    true,
                    tenantId
                  ]);
                  
                  const instanciaImportada = importResult.rows[0];
                  
                  console.log('   ✅ Instância ANTIGA importada! Novo ID:', instanciaImportada.id);
                  console.log('========================================\n');
                  
                  // 5️⃣ RETORNAR indicação de que houve importação
                  return res.json({
                    ...statusResult,
                    duplicateDetected: true,
                    action: 'kept_old_connected',
                    importedInstance: {
                      id: instanciaImportada.id,
                      name: instanciaImportada.name,
                      phone_number: instanciaImportada.phone_number,
                      profile_name: instanciaImportada.profile_name
                    },
                    message: `✅ Número já existente e CONECTADO detectado! Mantivemos a instância original: ${instanciaImportada.name}`
                  });
                } else {
                  console.log('   ℹ️  Instância ANTIGA já está no banco (ID:', existenteNoBanco.rows[0].id, ')');
                  console.log('========================================\n');
                  
                  return res.json({
                    ...statusResult,
                    duplicateDetected: true,
                    action: 'kept_old_connected',
                    existingInstance: {
                      id: existenteNoBanco.rows[0].id
                    },
                    message: `✅ Número já existente e CONECTADO detectado! A instância original já estava cadastrada.`
                  });
                }
              } else {
                // ✅ CASO 2: Instância ANTIGA está DESCONECTADA → Manter NOVA, deletar ANTIGA
                console.log('\n💡 DECISÃO: Instância ANTIGA está DESCONECTADA');
                console.log('   ├─ ✅ MANTER: Instância NOVA (acabou de conectar)');
                console.log('   └─ ❌ DELETAR: Instância ANTIGA (não está funcionando)');
                
                // 1️⃣ DELETAR a instância ANTIGA da UAZ API
                console.log('\n🗑️  Deletando instância ANTIGA da UAZ API...');
                const deleteResult = await uazService.deleteInstance(instanciaDuplicada.token, proxyConfig);
                
                if (deleteResult.success) {
                  console.log('   ✅ Instância ANTIGA deletada da UAZ API');
                } else {
                  console.warn('   ⚠️  Erro ao deletar da UAZ API:', deleteResult.error);
                }
                
                // 2️⃣ DELETAR a instância ANTIGA do banco local (se existir) - COM filtro de tenant (usando tenantQuery para respeitar RLS)
                console.log('🗑️  Verificando se instância ANTIGA existe no banco local...');
                const antigaNoBanco = await tenantQuery(req,
                  'SELECT id FROM uaz_instances WHERE instance_token = $1 AND tenant_id = $2',
                  [instanciaDuplicada.token, tenantId]
                );
                
                if (antigaNoBanco.rows.length > 0) {
                  await tenantQuery(req, 'DELETE FROM uaz_instances WHERE instance_token = $1 AND tenant_id = $2', [instanciaDuplicada.token, tenantId]);
                  console.log('   ✅ Instância ANTIGA deletada do banco local (ID:', antigaNoBanco.rows[0].id, ')');
                } else {
                  console.log('   ℹ️  Instância ANTIGA não estava no banco local');
                }
                
                console.log('✅ Instância NOVA mantida! ID:', id);
                console.log('========================================\n');
                
                // 3️⃣ RETORNAR indicação de que a nova foi mantida
                return res.json({
                  ...statusResult,
                  duplicateDetected: true,
                  action: 'kept_new_deleted_old',
                  keptInstance: {
                    id: id,
                    name: inst.name,
                    phone_number: phoneNumber,
                    profile_name: profileName
                  },
                  message: `✅ Número já existente mas DESCONECTADO detectado! Mantivemos a nova conexão e removemos a antiga.`
                });
              }
            } else {
              console.log('✅ Nenhuma duplicação encontrada. Número único!');
              console.log('========================================\n');
            }
          }
        } catch (error) {
          console.error('❌ Erro ao verificar duplicação:', error.message);
          // Não bloquear o fluxo, apenas logar o erro
        }
      }

      // Retorna os dados com profile_name e profile_pic_url incluídos explicitamente
      res.json({
        ...statusResult,
        profile_name: profileName,
        profile_pic_url: profilePicUrl,
        phone_number: phoneNumber
      });
    } else {
      console.log('❌ Erro ao verificar status:', statusResult.error);
      console.log('============================================\n');
      
      // Se o erro for "Invalid token", marcar a instância como desconectada no banco
      if (statusResult.error && statusResult.error.toLowerCase().includes('invalid token')) {
        console.log('⚠️ Token inválido detectado! Marcando instância como desconectada no banco...');
        // ✅ Usando tenantQuery para respeitar RLS e garantir tenant correto
        await tenantQuery(req, `
          UPDATE uaz_instances 
          SET is_connected = false,
              status = 'disconnected',
              updated_at = NOW()
          WHERE id = $1 AND tenant_id = $2
        `, [id, tenantId]);
        console.log('✅ Instância marcada como desconectada no banco de dados');
      }
      
      res.json(statusResult);
    }
  } catch (error) {
    console.error('❌ Erro ao verificar status da instância:', error);
    console.error('   └─ Stack:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.stack
    });
  }
});

/**
 * POST /api/uaz/instances/:id/disconnect
 * Desconecta instância
 */
router.post('/instances/:id/disconnect', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 🔒 SEGURANÇA: Filtrar por tenant_id
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Tenant não identificado'
      });
    }

    const instance = await tenantQuery(req, 'SELECT * FROM uaz_instances WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    if (instance.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Instância não encontrada'
      });
    }

    const inst = instance.rows[0];
    if (!inst.instance_token) {
      return res.status(400).json({
        success: false,
        error: 'Instância sem token. Recrie a instância.'
      });
    }

    // 🔑 BUSCAR CREDENCIAIS DO TENANT
    const credentials = await getTenantUazapCredentials(tenantId);
    const tenantUazService = new UazService(credentials.serverUrl, credentials.adminToken);

    const result = await tenantUazService.disconnect(inst.instance_token);

    if (result.success) {
      await pool.query(`
        UPDATE uaz_instances 
        SET is_connected = false, 
            status = 'disconnected',
            updated_at = NOW()
        WHERE id = $1 AND tenant_id = $2
      `, [id, tenantId]);
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/uaz/instances/:id/toggle-active
 * Ativa ou desativa uma instância (pausa/retoma)
 * 
 * ⚠️ IMPORTANTE: Quando pausar, a instância é tratada como DESCONECTADA nas campanhas
 * ⚠️ Quando despausar, ela é automaticamente REATIVADA nas campanhas
 */
router.post('/instances/:id/toggle-active', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 🔒 SEGURANÇA: Filtrar por tenant_id
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Tenant não identificado'
      });
    }

    // Busca instância atual
    const instance = await tenantQuery(req, 'SELECT * FROM uaz_instances WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    if (instance.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Instância não encontrada'
      });
    }

    const inst = instance.rows[0];
    const newActiveState = !inst.is_active;

    await tenantQuery(req, `
      UPDATE uaz_instances 
      SET is_active = $1,
          updated_at = NOW()
      WHERE id = $2 AND tenant_id = $3
    `, [newActiveState, id, tenantId]);

    console.log(`${newActiveState ? '▶️' : '⏸️'} Instância ${inst.name} (ID: ${id}) ${newActiveState ? 'ativada' : 'pausada'}`);

    // 🔄 DESATIVAR templates nas campanhas ATIVAS quando PAUSAR a instância
    if (!newActiveState) {
      // Desativa templates de campanhas tradicionais
      const deactivatedCampaigns = await pool.query(`
        UPDATE campaign_templates
        SET is_active = false,
            removed_at = NOW(),
            removal_reason = 'instance_paused'
        WHERE instance_id = $1
        AND is_active = true
        RETURNING campaign_id
      `, [id]);

      // Desativa templates de campanhas QR
      const deactivatedQrCampaigns = await pool.query(`
        UPDATE qr_campaign_templates
        SET is_active = false,
            removed_at = NOW(),
            removal_reason = 'instance_paused'
        WHERE instance_id = $1
        AND is_active = true
        RETURNING campaign_id
      `, [id]);

      const totalDeactivated = deactivatedCampaigns.rows.length + deactivatedQrCampaigns.rows.length;
      if (totalDeactivated > 0) {
        console.log(`   ⚠️  ${totalDeactivated} template(s) desativado(s) nas campanhas ativas`);
      }
    }

    // ✅ REATIVAR templates quando DESPAUSAR (será feito automaticamente pelo worker via checkAndReactivateInstances)
    if (newActiveState) {
      console.log(`   ✅ Templates serão reativados automaticamente nas campanhas ativas`);
    }

    res.json({
      success: true,
      is_active: newActiveState,
      message: newActiveState 
        ? 'Instância ativada com sucesso. Templates serão reativados nas campanhas.' 
        : 'Instância pausada com sucesso. Templates foram desativados nas campanhas.'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/uaz/instances/pause-all
 * Pausa todas as instâncias
 * 
 * ⚠️ IMPORTANTE: Todas as instâncias são tratadas como DESCONECTADAS nas campanhas
 */
router.post('/instances/pause-all', async (req, res) => {
  try {
    // 🔒 SEGURANÇA: Filtrar por tenant_id
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(401).json({ success: false, error: 'Tenant não identificado' });
    }
    
    const result = await tenantQuery(req, `
      UPDATE uaz_instances 
      SET is_active = false,
          updated_at = NOW()
      WHERE is_active = true AND tenant_id = $1
      RETURNING id, name
    `, [tenantId]);

    console.log(`⏸️ ${result.rows.length} instância(s) pausada(s)`);

    // 🔄 DESATIVAR todos os templates nas campanhas ATIVAS
    const deactivatedCampaigns = await pool.query(`
      UPDATE campaign_templates
      SET is_active = false,
          removed_at = NOW(),
          removal_reason = 'instance_paused'
      WHERE is_active = true
      RETURNING campaign_id
    `);

    const deactivatedQrCampaigns = await pool.query(`
      UPDATE qr_campaign_templates
      SET is_active = false,
          removed_at = NOW(),
          removal_reason = 'instance_paused'
      WHERE is_active = true
      RETURNING campaign_id
    `);

    const totalDeactivated = deactivatedCampaigns.rows.length + deactivatedQrCampaigns.rows.length;
    if (totalDeactivated > 0) {
      console.log(`   ⚠️  ${totalDeactivated} template(s) desativado(s) nas campanhas ativas`);
    }
    
    res.json({
      success: true,
      paused_count: result.rows.length,
      deactivated_templates: totalDeactivated,
      instances: result.rows,
      message: `${result.rows.length} instância(s) pausada(s). ${totalDeactivated} template(s) desativados nas campanhas.`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/uaz/instances/activate-all
 * Ativa todas as instâncias
 * 
 * ✅ Templates serão automaticamente REATIVADOS nas campanhas pelo worker
 */
router.post('/instances/activate-all', async (req, res) => {
  try {
    // 🔒 SEGURANÇA: Filtrar por tenant_id
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(401).json({ success: false, error: 'Tenant não identificado' });
    }
    
    const result = await tenantQuery(req, `
      UPDATE uaz_instances 
      SET is_active = true,
          updated_at = NOW()
      WHERE is_active = false AND tenant_id = $1
      RETURNING id, name
    `, [tenantId]);

    console.log(`▶️ ${result.rows.length} instância(s) ativada(s)`);
    console.log(`   ✅ Templates serão reativados automaticamente nas campanhas ativas`);
    
    res.json({
      success: true,
      activated_count: result.rows.length,
      instances: result.rows,
      message: `${result.rows.length} instância(s) ativada(s). Templates serão reativados nas campanhas.`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/uaz/instances/deactivate-multiple
 * Desativa múltiplas instâncias selecionadas
 */
router.post('/instances/deactivate-multiple', async (req, res) => {
  try {
    const { instance_ids } = req.body;
    
    if (!instance_ids || !Array.isArray(instance_ids) || instance_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'instance_ids deve ser um array não-vazio'
      });
    }

    console.log(`⏸️ Desativando instâncias:`, instance_ids);

    // Converter para números para garantir
    const ids = instance_ids.map(id => parseInt(id, 10));

    const result = await tenantQuery(req, `
      UPDATE uaz_instances 
      SET is_active = false,
          updated_at = NOW()
      WHERE id = ANY($1::int[])
      RETURNING id, name
    `, [ids]);

    console.log(`⏸️ ${result.rows.length} instância(s) desativada(s)`);

    // Desativar templates nas campanhas (com try-catch para não quebrar se a tabela não existir)
    let totalDeactivated = 0;
    try {
      const deactivatedCampaigns = await pool.query(`
        UPDATE campaign_templates
        SET is_active = false,
            updated_at = NOW()
        WHERE instance_id = ANY($1::int[])
          AND campaign_id IN (
            SELECT id FROM qr_campaigns 
            WHERE status = 'in_progress'
            AND tenant_id = $2
          )
        RETURNING id, campaign_id, instance_id
      `, [ids]);
      totalDeactivated = deactivatedCampaigns.rows.length;
      console.log(`   📊 ${totalDeactivated} template(s) desativados nas campanhas ativas`);
    } catch (campErr) {
      console.log(`   ℹ️ Campanhas não disponíveis ou já desativadas`);
    }

    res.json({
      success: true,
      deactivated_count: result.rows.length,
      deactivated_templates: totalDeactivated,
      instances: result.rows,
      message: `${result.rows.length} instância(s) desativada(s). ${totalDeactivated} template(s) desativados nas campanhas.`
    });
  } catch (error) {
    console.error('❌ Erro ao desativar instâncias:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/uaz/instances/deactivate-all
 * Desativa todas as instâncias
 */
router.post('/instances/deactivate-all', async (req, res) => {
  try {
    console.log(`⏸️ Desativando TODAS as instâncias`);

    const result = await tenantQuery(req, `
      UPDATE uaz_instances 
      SET is_active = false,
          updated_at = NOW()
      RETURNING id, name
    `);

    console.log(`⏸️ ${result.rows.length} instância(s) desativada(s)`);

    // Desativar todos os templates nas campanhas (com try-catch para não quebrar)
    let totalDeactivated = 0;
    try {
      const deactivatedCampaigns = await pool.query(`
        UPDATE campaign_templates
        SET is_active = false,
            updated_at = NOW()
        WHERE campaign_id IN (
          SELECT id FROM qr_campaigns 
          WHERE status = 'in_progress'
        )
        RETURNING id, campaign_id, instance_id
      `);
      totalDeactivated = deactivatedCampaigns.rows.length;
      console.log(`   📊 ${totalDeactivated} template(s) desativados nas campanhas ativas`);
    } catch (campErr) {
      console.log(`   ℹ️ Campanhas não disponíveis ou já desativadas`);
    }

    res.json({
      success: true,
      deactivated_count: result.rows.length,
      deactivated_templates: totalDeactivated,
      instances: result.rows,
      message: `${result.rows.length} instância(s) desativada(s). ${totalDeactivated} template(s) desativados nas campanhas.`
    });
  } catch (error) {
    console.error('❌ Erro ao desativar todas as instâncias:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/uaz/instances/activate-multiple
 * Ativa múltiplas instâncias selecionadas
 */
router.post('/instances/activate-multiple', async (req, res) => {
  try {
    const { instance_ids } = req.body;
    
    if (!instance_ids || !Array.isArray(instance_ids) || instance_ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'instance_ids deve ser um array não vazio'
      });
    }

    console.log(`✅ Ativando instâncias:`, instance_ids);

    // Converter para números para garantir
    const ids = instance_ids.map(id => parseInt(id, 10));

    const result = await tenantQuery(req, `
      UPDATE uaz_instances
      SET is_active = true, updated_at = NOW()
      WHERE id = ANY($1::int[])
      RETURNING id, name
    `, [ids]);

    console.log(`✅ ${result.rows.length} instância(s) ativada(s)`);

    res.json({
      success: true,
      count: result.rows.length,
      message: `${result.rows.length} instância(s) ativada(s) com sucesso`
    });
  } catch (error) {
    console.error('❌ Erro ao ativar instâncias:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao ativar instâncias',
      error: error.message
    });
  }
});

/**
 * POST /api/uaz/instances/activate-all
 * Ativa todas as instâncias
 */
router.post('/instances/activate-all', async (req, res) => {
  try {
    console.log(`✅ Ativando TODAS as instâncias`);

    const result = await tenantQuery(req, `
      UPDATE uaz_instances
      SET is_active = true, updated_at = NOW()
      RETURNING id, name
    `);

    console.log(`✅ ${result.rows.length} instância(s) ativada(s)`);

    res.json({
      success: true,
      count: result.rows.length,
      message: `${result.rows.length} instância(s) ativada(s) com sucesso`
    });
  } catch (error) {
    console.error('❌ Erro ao ativar todas as instâncias:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao ativar instâncias',
      error: error.message
    });
  }
});

/**
 * POST /api/uaz/instances/:id/send-text
 * Envia mensagem de texto
 */
router.post('/instances/:id/send-text', checkMessageLimit, async (req, res) => {
  try {
    const { id } = req.params;
    const { number, text, variables, ...options } = req.body;
    const tenantId = req.tenant?.id || req.user?.tenantId;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'Tenant não identificado'
      });
    }

    if (!number || !text) {
      return res.status(400).json({
        success: false,
        error: 'Número e texto são obrigatórios'
      });
    }

    // Busca instância (usando tenantQuery para RLS)
    const instance = await tenantQuery(req, `
      SELECT ui.*, p.host, p.port, p.username, p.password
      FROM uaz_instances ui
      LEFT JOIN proxies p ON ui.proxy_id = p.id
      WHERE ui.id = $1 AND ui.tenant_id = $2
    `, [id, tenantId]);

    if (instance.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Instância não encontrada'
      });
    }

    const inst = instance.rows[0];
    
    if (!inst.instance_token) {
      return res.status(400).json({
        success: false,
        error: 'Instância sem token. Recrie a instância.'
      });
    }
    
    // ⏸️ VALIDAÇÃO: Verifica se a instância está ativa (não pausada)
    if (!inst.is_active) {
      console.log(`⏸️ Tentativa de envio bloqueada - Instância ${inst.name} (ID: ${id}) está PAUSADA`);
      return res.status(400).json({
        success: false,
        error: '⏸️ Conexão pausada. Ative a conexão nas configurações para enviar mensagens.'
      });
    }
    
    if (!inst.is_connected) {
      return res.status(400).json({
        success: false,
        error: 'Instância não está conectada'
      });
    }

    // 🚨 VERIFICAR LISTA DE RESTRIÇÃO (ENVIO ÚNICO QR)
    console.log('═══════════════════════════════════════════════════════');
    console.log('🔍 VERIFICANDO LISTA DE RESTRIÇÃO (ENVIO ÚNICO QR)');
    console.log('═══════════════════════════════════════════════════════');
    console.log('   📞 Número:', number);
    console.log('   📱 Instância ID:', id);
    console.log('   🏢 Tenant ID:', tenantId);
    
    try {
      const restrictionController = new RestrictionListController();
      
      // Criar request fake para o controller
      const fakeReq = {
        body: {
          phone_numbers: [number],
          whatsapp_account_ids: [id], // Usar instance_id como identificador
        },
        tenant: { id: tenantId },
      };
      
      let restrictionResult = null;
      const fakeRes = {
        json: (data) => {
          restrictionResult = data;
        },
        status: () => fakeRes,
      };
      
      await restrictionController.checkBulk(fakeReq, fakeRes);
      
      if (restrictionResult && restrictionResult.restricted_count > 0) {
        const detail = restrictionResult.restricted_details[0];
        const listNames = detail.list_names?.join(', ') || 'Lista de Restrição';
        const types = detail.types || [];
        
        console.log('🚫 ═══════════════════════════════════════════════════');
        console.log('🚫 NÚMERO BLOQUEADO - ESTÁ NA LISTA DE RESTRIÇÃO!');
        console.log('🚫 ═══════════════════════════════════════════════════');
        console.log('   📝 Listas:', listNames);
        console.log('   🏷️  Tipos:', types.join(', '));
        console.log('   📞 Número:', number);
        console.log('   ❌ ENVIO CANCELADO!');
        console.log('═══════════════════════════════════════════════════════\n');
        
        return res.status(403).json({
          success: false,
          error: 'Número bloqueado',
          message: `Este número está na lista de restrição: ${listNames}`,
          details: {
            lists: listNames,
            types: types,
            restricted: true
          }
        });
      }
      
      console.log('   ✅ Número livre - Prosseguindo com envio');
      console.log('═══════════════════════════════════════════════════════\n');
    } catch (error) {
      console.error('❌ Erro ao verificar lista de restrição:', error);
      // ⚠️ Por segurança, se der erro na verificação, bloqueamos o envio
      return res.status(500).json({
        success: false,
        error: 'Erro ao verificar lista de restrição - Envio bloqueado por segurança',
        details: error.message
      });
    }

    const proxyConfig = inst.host ? {
      host: inst.host,
      port: inst.port,
      username: inst.username,
      password: inst.password
    } : null;

    // 🔑 BUSCAR CREDENCIAIS DO TENANT
    const credentials = await getTenantUazapCredentials(tenantId);
    const tenantUazService = new UazService(credentials.serverUrl, credentials.adminToken);

    // 🔤 SUBSTITUIR VARIÁVEIS AUTOMÁTICAS NO TEXTO
    console.log('🔍 [DEBUG] Texto original recebido:', text);
    let processedText = processAutoVariables(text);
    console.log('🔍 [DEBUG] Texto após variáveis automáticas:', processedText);
    
    // 🔤 SUBSTITUIR VARIÁVEIS PERSONALIZADAS (se fornecidas)
    if (variables && Object.keys(variables).length > 0) {
      console.log('🔤 [DEBUG] Variáveis personalizadas recebidas:', variables);
      processedText = replaceVariables(processedText, variables);
      console.log('🔤 [DEBUG] Texto após variáveis personalizadas:', processedText);
    }

    // Envia mensagem usando instance_token (com texto processado)
    const sendResult = await tenantUazService.sendText(inst.instance_token, {
      number,
      text: processedText,
      ...options
    }, proxyConfig);

    // Salva no histórico (com texto processado)
    await pool.query(`
      INSERT INTO uaz_messages (
        instance_id, phone_number, message_type, 
        message_content, status, message_id, sent_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `, [
      id, 
      number, 
      'text', 
      processedText, 
      sendResult.success ? 'sent' : 'failed',
      sendResult.data?.id || null
    ]);

    res.json(sendResult);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/uaz/instances/:id/send-image
 * Envia mensagem com imagem
 */
router.post('/instances/:id/send-image', checkMessageLimit, async (req, res) => {
  try {
    const { id } = req.params;
    const { number, image, caption } = req.body;
    const tenantId = req.tenant?.id || req.user?.tenantId;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'Tenant não identificado'
      });
    }

    if (!number || !image) {
      return res.status(400).json({
        success: false,
        error: 'Número e imagem são obrigatórios'
      });
    }

    // Busca instância (usando tenantQuery para RLS)
    const instance = await tenantQuery(req, `
      SELECT ui.*, p.host, p.port, p.username, p.password
      FROM uaz_instances ui
      LEFT JOIN proxies p ON ui.proxy_id = p.id
      WHERE ui.id = $1 AND ui.tenant_id = $2
    `, [id, tenantId]);

    if (instance.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Instância não encontrada'
      });
    }

    const inst = instance.rows[0];
    
    if (!inst.instance_token) {
      return res.status(400).json({
        success: false,
        error: 'Instância sem token. Recrie a instância.'
      });
    }
    
    // ⏸️ VALIDAÇÃO: Verifica se a instância está ativa (não pausada)
    if (!inst.is_active) {
      console.log(`⏸️ Tentativa de envio bloqueada - Instância ${inst.name} (ID: ${id}) está PAUSADA`);
      return res.status(400).json({
        success: false,
        error: '⏸️ Conexão pausada. Ative a conexão nas configurações para enviar mensagens.'
      });
    }
    
    if (!inst.is_connected) {
      return res.status(400).json({
        success: false,
        error: 'Instância não está conectada'
      });
    }

    // 🚨 VERIFICAR LISTA DE RESTRIÇÃO (ENVIO ÚNICO QR - IMAGEM)
    console.log('🔍 VERIFICANDO LISTA DE RESTRIÇÃO (ENVIO IMAGEM QR)');
    console.log('   📞 Número:', number);
    
    try {
      const restrictionController = new RestrictionListController();
      const fakeReq = {
        body: {
          phone_numbers: [number],
          whatsapp_account_ids: [id],
        },
        tenant: { id: tenantId },
      };
      
      let restrictionResult = null;
      const fakeRes = {
        json: (data) => { restrictionResult = data; },
        status: () => fakeRes,
      };
      
      await restrictionController.checkBulk(fakeReq, fakeRes);
      
      if (restrictionResult && restrictionResult.restricted_count > 0) {
        const detail = restrictionResult.restricted_details[0];
        const listNames = detail.list_names?.join(', ') || 'Lista de Restrição';
        
        console.log('🚫 NÚMERO BLOQUEADO - Lista:', listNames);
        
        return res.status(403).json({
          success: false,
          error: 'Número bloqueado',
          message: `Este número está na lista de restrição: ${listNames}`,
          details: { lists: listNames, restricted: true }
        });
      }
      
      console.log('   ✅ Número livre\n');
    } catch (error) {
      console.error('❌ Erro ao verificar lista de restrição:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao verificar lista de restrição - Envio bloqueado por segurança'
      });
    }

    const proxyConfig = inst.host ? {
      host: inst.host,
      port: inst.port,
      username: inst.username,
      password: inst.password
    } : null;

    // Converte arquivo para Base64 se for URL local
    let fileToSend = image;
    if (image.startsWith('http://localhost') || image.startsWith('/uploads/')) {
      const conversion = await convertFileToBase64(image);
      if (!conversion.success) {
        return res.status(500).json({
          success: false,
          error: 'Erro ao processar arquivo: ' + conversion.error
        });
      }
      fileToSend = conversion.file;
    }

    // 🔑 BUSCAR CREDENCIAIS DO TENANT
    const credentials = await getTenantUazapCredentials(tenantId);
    const tenantUazService = new UazService(credentials.serverUrl, credentials.adminToken);

    // 🔤 SUBSTITUIR VARIÁVEIS AUTOMÁTICAS NO CAPTION (se houver)
    let processedCaption = processAutoVariables(caption || '');
    
    // 🔤 SUBSTITUIR VARIÁVEIS PERSONALIZADAS NO CAPTION (se fornecidas)
    const { variables } = req.body;
    if (variables && Object.keys(variables).length > 0) {
      console.log('🔤 [DEBUG] Substituindo variáveis personalizadas no caption da imagem:', variables);
      processedCaption = replaceVariables(processedCaption, variables);
    }

    // Envia imagem usando o endpoint correto /send/media
    console.log('📤 Enviando imagem via UAZ API...', {
      number,
      type: 'image',
      isBase64: fileToSend.startsWith('data:'),
      hasCaption: !!processedCaption
    });
    
    const sendResult = await tenantUazService.sendMedia(inst.instance_token, {
      number,
      type: 'image',
      file: fileToSend,
      text: processedCaption
    }, proxyConfig);

    console.log('✅ Resultado do envio:', sendResult);

    // Salva no histórico (com caption processado)
    await pool.query(`
      INSERT INTO uaz_messages (
        instance_id, phone_number, message_type, message_content, media_url, status
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `, [id, number, 'image', processedCaption, image, sendResult.success ? 'sent' : 'failed']);

    res.json(sendResult);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/uaz/instances/:id/send-video
 * Envia mensagem com vídeo
 */
router.post('/instances/:id/send-video', checkMessageLimit, async (req, res) => {
  try {
    const { id } = req.params;
    const { number, video, caption } = req.body;
    const tenantId = req.tenant?.id || req.user?.tenantId;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'Tenant não identificado'
      });
    }

    if (!number || !video) {
      return res.status(400).json({
        success: false,
        error: 'Número e vídeo são obrigatórios'
      });
    }

    // Busca instância (usando tenantQuery para RLS)
    const instance = await tenantQuery(req, `
      SELECT ui.*, p.host, p.port, p.username, p.password
      FROM uaz_instances ui
      LEFT JOIN proxies p ON ui.proxy_id = p.id
      WHERE ui.id = $1 AND ui.tenant_id = $2
    `, [id, tenantId]);

    if (instance.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Instância não encontrada'
      });
    }

    const inst = instance.rows[0];
    
    if (!inst.instance_token) {
      return res.status(400).json({
        success: false,
        error: 'Instância sem token. Recrie a instância.'
      });
    }
    
    // ⏸️ VALIDAÇÃO: Verifica se a instância está ativa (não pausada)
    if (!inst.is_active) {
      console.log(`⏸️ Tentativa de envio bloqueada - Instância ${inst.name} (ID: ${id}) está PAUSADA`);
      return res.status(400).json({
        success: false,
        error: '⏸️ Conexão pausada. Ative a conexão nas configurações para enviar mensagens.'
      });
    }
    
    if (!inst.is_connected) {
      return res.status(400).json({
        success: false,
        error: 'Instância não está conectada'
      });
    }

    // 🚨 VERIFICAR LISTA DE RESTRIÇÃO (ENVIO ÚNICO QR - VÍDEO)
    console.log('🔍 VERIFICANDO LISTA DE RESTRIÇÃO (ENVIO VÍDEO QR) - Número:', number);
    
    try {
      const restrictionController = new RestrictionListController();
      const fakeReq = {
        body: { phone_numbers: [number], whatsapp_account_ids: [id] },
        tenant: { id: tenantId },
      };
      
      let restrictionResult = null;
      await restrictionController.checkBulk(fakeReq, {
        json: (data) => { restrictionResult = data; },
        status: () => ({ json: () => {} }),
      });
      
      if (restrictionResult && restrictionResult.restricted_count > 0) {
        const listNames = restrictionResult.restricted_details[0].list_names?.join(', ') || 'Lista de Restrição';
        console.log('🚫 BLOQUEADO -', listNames);
        return res.status(403).json({
          success: false,
          error: 'Número bloqueado',
          message: `Este número está na lista de restrição: ${listNames}`
        });
      }
      console.log('   ✅ Livre\n');
    } catch (error) {
      console.error('❌ Erro ao verificar lista:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao verificar lista de restrição'
      });
    }

    const proxyConfig = inst.host ? {
      host: inst.host,
      port: inst.port,
      username: inst.username,
      password: inst.password
    } : null;

    // Converte arquivo para Base64 se for URL local
    let fileToSend = video;
    if (video.startsWith('http://localhost') || video.startsWith('/uploads/')) {
      const conversion = await convertFileToBase64(video);
      if (!conversion.success) {
        return res.status(500).json({
          success: false,
          error: 'Erro ao processar vídeo: ' + conversion.error
        });
      }
      fileToSend = conversion.file;
    }

    // 🔑 BUSCAR CREDENCIAIS DO TENANT
    const credentials = await getTenantUazapCredentials(tenantId);
    const tenantUazService = new UazService(credentials.serverUrl, credentials.adminToken);

    // 🔤 SUBSTITUIR VARIÁVEIS AUTOMÁTICAS NO CAPTION (se houver)
    let processedCaption = processAutoVariables(caption || '');
    
    // 🔤 SUBSTITUIR VARIÁVEIS PERSONALIZADAS NO CAPTION (se fornecidas)
    const { variables } = req.body;
    if (variables && Object.keys(variables).length > 0) {
      console.log('🔤 [DEBUG] Substituindo variáveis personalizadas no caption do vídeo:', variables);
      processedCaption = replaceVariables(processedCaption, variables);
    }

    // Envia vídeo usando o endpoint correto /send/media
    const sendResult = await tenantUazService.sendMedia(inst.instance_token, {
      number,
      type: 'video',
      file: fileToSend,
      text: processedCaption
    }, proxyConfig);

    // Salva no histórico (com caption processado)
    await pool.query(`
      INSERT INTO uaz_messages (
        instance_id, phone_number, message_type, message_content, media_url, status
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `, [id, number, 'video', processedCaption, video, sendResult.success ? 'sent' : 'failed']);

    res.json(sendResult);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/uaz/instances/:id/send-document
 * Envia mensagem com documento
 */
router.post('/instances/:id/send-document', checkMessageLimit, async (req, res) => {
  try {
    const { id } = req.params;
    const { number, document, filename, caption } = req.body;
    const tenantId = req.tenant?.id || req.user?.tenantId;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'Tenant não identificado'
      });
    }

    if (!number || !document) {
      return res.status(400).json({
        success: false,
        error: 'Número e documento são obrigatórios'
      });
    }

    // Busca instância (usando tenantQuery para RLS)
    const instance = await tenantQuery(req, `
      SELECT ui.*, p.host, p.port, p.username, p.password
      FROM uaz_instances ui
      LEFT JOIN proxies p ON ui.proxy_id = p.id
      WHERE ui.id = $1 AND ui.tenant_id = $2
    `, [id, tenantId]);

    if (instance.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Instância não encontrada'
      });
    }

    const inst = instance.rows[0];
    
    if (!inst.instance_token) {
      return res.status(400).json({
        success: false,
        error: 'Instância sem token. Recrie a instância.'
      });
    }
    
    // ⏸️ VALIDAÇÃO: Verifica se a instância está ativa (não pausada)
    if (!inst.is_active) {
      console.log(`⏸️ Tentativa de envio bloqueada - Instância ${inst.name} (ID: ${id}) está PAUSADA`);
      return res.status(400).json({
        success: false,
        error: '⏸️ Conexão pausada. Ative a conexão nas configurações para enviar mensagens.'
      });
    }
    
    if (!inst.is_connected) {
      return res.status(400).json({
        success: false,
        error: 'Instância não está conectada'
      });
    }

    // 🚨 VERIFICAR LISTA DE RESTRIÇÃO (ENVIO ÚNICO QR - DOCUMENTO)
    console.log('🔍 VERIFICANDO LISTA DE RESTRIÇÃO (ENVIO DOC QR) - Número:', number);
    
    try {
      const restrictionController = new RestrictionListController();
      const fakeReq = {
        body: { phone_numbers: [number], whatsapp_account_ids: [id] },
        tenant: { id: tenantId },
      };
      
      let restrictionResult = null;
      await restrictionController.checkBulk(fakeReq, {
        json: (data) => { restrictionResult = data; },
        status: () => ({ json: () => {} }),
      });
      
      if (restrictionResult && restrictionResult.restricted_count > 0) {
        const listNames = restrictionResult.restricted_details[0].list_names?.join(', ') || 'Lista de Restrição';
        console.log('🚫 BLOQUEADO -', listNames);
        return res.status(403).json({
          success: false,
          error: 'Número bloqueado',
          message: `Este número está na lista de restrição: ${listNames}`
        });
      }
      console.log('   ✅ Livre\n');
    } catch (error) {
      console.error('❌ Erro ao verificar lista:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao verificar lista de restrição'
      });
    }

    const proxyConfig = inst.host ? {
      host: inst.host,
      port: inst.port,
      username: inst.username,
      password: inst.password
    } : null;

    // Converte arquivo para Base64 se for URL local
    let fileToSend = document;
    if (document.startsWith('http://localhost') || document.startsWith('/uploads/')) {
      const conversion = await convertFileToBase64(document);
      if (!conversion.success) {
        return res.status(500).json({
          success: false,
          error: 'Erro ao processar documento: ' + conversion.error
        });
      }
      fileToSend = conversion.file;
    }

    // 🔑 BUSCAR CREDENCIAIS DO TENANT
    const credentials = await getTenantUazapCredentials(tenantId);
    const tenantUazService = new UazService(credentials.serverUrl, credentials.adminToken);

    // 🔤 SUBSTITUIR VARIÁVEIS AUTOMÁTICAS NO CAPTION (se houver)
    let processedCaption = processAutoVariables(caption || '');
    
    // 🔤 SUBSTITUIR VARIÁVEIS PERSONALIZADAS NO CAPTION (se fornecidas)
    const { variables } = req.body;
    if (variables && Object.keys(variables).length > 0) {
      console.log('🔤 [DEBUG] Substituindo variáveis personalizadas no caption do documento:', variables);
      processedCaption = replaceVariables(processedCaption, variables);
    }

    // Envia documento usando o endpoint correto /send/media
    const sendResult = await tenantUazService.sendMedia(inst.instance_token, {
      number,
      type: 'document',
      file: fileToSend,
      docname: filename || 'documento.pdf',
      text: processedCaption
    }, proxyConfig);

    // Salva no histórico (com caption processado)
    await pool.query(`
      INSERT INTO uaz_messages (
        instance_id, phone_number, message_type, message_content, media_url, status
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `, [id, number, 'document', processedCaption, document, sendResult.success ? 'sent' : 'failed']);

    res.json(sendResult);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/uaz/instances/:id/send-audio
 * Envia mensagem com áudio
 */
router.post('/instances/:id/send-audio', checkMessageLimit, async (req, res) => {
  try {
    const { id } = req.params;
    const { number, audio } = req.body;
    const tenantId = req.tenant?.id || req.user?.tenantId;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'Tenant não identificado'
      });
    }

    if (!number || !audio) {
      return res.status(400).json({
        success: false,
        error: 'Número e áudio são obrigatórios'
      });
    }

    // Busca instância (usando tenantQuery para RLS)
    const instance = await tenantQuery(req, `
      SELECT ui.*, p.host, p.port, p.username, p.password
      FROM uaz_instances ui
      LEFT JOIN proxies p ON ui.proxy_id = p.id
      WHERE ui.id = $1 AND ui.tenant_id = $2
    `, [id, tenantId]);

    if (instance.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Instância não encontrada'
      });
    }

    const inst = instance.rows[0];
    
    if (!inst.instance_token) {
      return res.status(400).json({
        success: false,
        error: 'Instância sem token. Recrie a instância.'
      });
    }
    
    // ⏸️ VALIDAÇÃO: Verifica se a instância está ativa (não pausada)
    if (!inst.is_active) {
      console.log(`⏸️ Tentativa de envio bloqueada - Instância ${inst.name} (ID: ${id}) está PAUSADA`);
      return res.status(400).json({
        success: false,
        error: '⏸️ Conexão pausada. Ative a conexão nas configurações para enviar mensagens.'
      });
    }
    
    if (!inst.is_connected) {
      return res.status(400).json({
        success: false,
        error: 'Instância não está conectada'
      });
    }

    // 🚨 VERIFICAR LISTA DE RESTRIÇÃO (ENVIO ÚNICO QR - ÁUDIO)
    console.log('🔍 VERIFICANDO LISTA DE RESTRIÇÃO (ENVIO ÁUDIO QR) - Número:', number);
    
    try {
      const restrictionController = new RestrictionListController();
      const fakeReq = {
        body: { phone_numbers: [number], whatsapp_account_ids: [id] },
        tenant: { id: tenantId },
      };
      
      let restrictionResult = null;
      await restrictionController.checkBulk(fakeReq, {
        json: (data) => { restrictionResult = data; },
        status: () => ({ json: () => {} }),
      });
      
      if (restrictionResult && restrictionResult.restricted_count > 0) {
        const listNames = restrictionResult.restricted_details[0].list_names?.join(', ') || 'Lista de Restrição';
        console.log('🚫 BLOQUEADO -', listNames);
        return res.status(403).json({
          success: false,
          error: 'Número bloqueado',
          message: `Este número está na lista de restrição: ${listNames}`
        });
      }
      console.log('   ✅ Livre\n');
    } catch (error) {
      console.error('❌ Erro ao verificar lista:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao verificar lista de restrição'
      });
    }

    const proxyConfig = inst.host ? {
      host: inst.host,
      port: inst.port,
      username: inst.username,
      password: inst.password
    } : null;

    // Converte arquivo para Base64 se for URL local
    let fileToSend = audio;
    if (audio.startsWith('http://localhost') || audio.startsWith('/uploads/')) {
      const conversion = await convertFileToBase64(audio, false); // Não comprimir áudio
      if (!conversion.success) {
        return res.status(500).json({
          success: false,
          error: 'Erro ao processar áudio: ' + conversion.error
        });
      }
      fileToSend = conversion.file;
    }

    // 🔑 BUSCAR CREDENCIAIS DO TENANT
    const credentials = await getTenantUazapCredentials(tenantId);
    const tenantUazService = new UazService(credentials.serverUrl, credentials.adminToken);

    // Envia áudio usando o endpoint correto /send/media
    const sendResult = await tenantUazService.sendMedia(inst.instance_token, {
      number,
      type: 'audio',
      file: fileToSend
    }, proxyConfig);

    // Salva no histórico
    await pool.query(`
      INSERT INTO uaz_messages (
        instance_id, phone_number, message_type, message_content, media_url, status
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `, [id, number, 'audio', '', audio, sendResult.success ? 'sent' : 'failed']);

    res.json(sendResult);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/uaz/instances/:id/check-number
 * Verifica se um número existe no WhatsApp
 */
router.post('/instances/:id/check-number', async (req, res) => {
  try {
    const { id } = req.params;
    const { number } = req.body;

    if (!number) {
      return res.status(400).json({
        success: false,
        error: 'Número é obrigatório'
      });
    }

    // Busca instância (usando tenantQuery para RLS)
    const instance = await tenantQuery(req, `
      SELECT ui.*, p.host, p.port, p.username, p.password
      FROM uaz_instances ui
      LEFT JOIN proxies p ON ui.proxy_id = p.id
      WHERE ui.id = $1 AND ui.tenant_id = $2
    `, [id, tenantId]);

    if (instance.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Instância não encontrada'
      });
    }

    const inst = instance.rows[0];
    
    if (!inst.instance_token) {
      return res.status(400).json({
        success: false,
        error: 'Instância sem token. Recrie a instância.'
      });
    }

    const proxyConfig = inst.host ? {
      host: inst.host,
      port: inst.port,
      username: inst.username,
      password: inst.password
    } : null;

    // 🔑 BUSCAR CREDENCIAIS DO TENANT
    const credentials = await getTenantUazapCredentials(tenantId);
    const tenantUazService = new UazService(credentials.serverUrl, credentials.adminToken);

    // Verifica número usando instance_token
    const checkResult = await tenantUazService.checkNumber(inst.instance_token, number, proxyConfig);

    res.json(checkResult);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/uaz/instances/:id/check-numbers
 * Verifica múltiplos números no WhatsApp
 */
router.post('/instances/:id/check-numbers', async (req, res) => {
  try {
    const { id } = req.params;
    const { numbers, delaySeconds } = req.body;

    // 🔒 SEGURANÇA: Obter tenant_id do request
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        error: 'Tenant não identificado'
      });
    }

    if (!numbers || !Array.isArray(numbers) || numbers.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Array de números é obrigatório'
      });
    }

    // Busca instância (usando tenantQuery para RLS)
    const instance = await tenantQuery(req, `
      SELECT ui.*, p.host, p.port, p.username, p.password
      FROM uaz_instances ui
      LEFT JOIN proxies p ON ui.proxy_id = p.id
      WHERE ui.id = $1 AND ui.tenant_id = $2
    `, [id, tenantId]);

    if (instance.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Instância não encontrada'
      });
    }

    const inst = instance.rows[0];
    
    if (!inst.instance_token) {
      return res.status(400).json({
        success: false,
        error: 'Instância sem token. Recrie a instância.'
      });
    }

    const proxyConfig = inst.host ? {
      host: inst.host,
      port: inst.port,
      username: inst.username,
      password: inst.password
    } : null;

    // 🔑 BUSCAR CREDENCIAIS DO TENANT
    const credentials = await getTenantUazapCredentials(tenantId);
    const tenantUazService = new UazService(credentials.serverUrl, credentials.adminToken);

    // Verifica números usando instance_token com delay configurável
    const delay = parseFloat(delaySeconds) || 0;
    const checkResult = await tenantUazService.checkNumbers(inst.instance_token, numbers, proxyConfig, delay);

    // 💾 SALVAR HISTÓRICO DE VERIFICAÇÕES
    if (checkResult.success && checkResult.data) {
      console.log(`💾 Salvando ${checkResult.data.length} verificações no histórico...`);
      
      for (const result of checkResult.data) {
        try {
          await pool.query(`
            INSERT INTO uaz_verification_history 
            (instance_id, phone_number, is_in_whatsapp, verified_name, jid, error_message)
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [
            id,
            result.phone,
            result.exists || false,
            result.verifiedName || null,
            result.jid || null,
            result.error || null
          ]);
          
          console.log(`  ✅ Histórico salvo: ${result.phone} - ${result.exists ? 'TEM WhatsApp' : 'NÃO tem WhatsApp'}`);
        } catch (error) {
          console.error(`  ❌ Erro ao salvar histórico de ${result.phone}:`, error.message);
        }
      }
      
      console.log(`✅ Histórico de verificações salvo com sucesso!\n`);
    }

    res.json(checkResult);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/uaz/verification-history
 * Lista histórico de verificações de números
 */
router.get('/verification-history', async (req, res) => {
  try {
    const { instance_id, limit = 100, offset = 0 } = req.query;

    let query = `
      SELECT 
        vh.*,
        ui.name as instance_name,
        ui.session_name
      FROM uaz_verification_history vh
      JOIN uaz_instances ui ON vh.instance_id = ui.id
    `;
    
    const params = [];
    if (instance_id) {
      query += ' WHERE vh.instance_id = $1';
      params.push(instance_id);
    }

    query += ' ORDER BY vh.verified_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Contar total
    let countQuery = 'SELECT COUNT(*) FROM uaz_verification_history vh';
    if (instance_id) {
      countQuery += ' WHERE vh.instance_id = $1';
    }
    const countResult = await pool.query(countQuery, instance_id ? [instance_id] : []);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: (parseInt(offset) + parseInt(limit)) < total
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/uaz/messages
 * Lista mensagens enviadas
 */
router.get('/messages', async (req, res) => {
  try {
    const { instance_id, limit = 50 } = req.query;

    let query = `
      SELECT 
        um.*,
        ui.name as instance_name,
        ui.session_name
      FROM uaz_messages um
      JOIN uaz_instances ui ON um.instance_id = ui.id
    `;
    
    const params = [];
    if (instance_id) {
      query += ' WHERE um.instance_id = $1';
      params.push(instance_id);
    }

    query += ' ORDER BY um.created_at DESC LIMIT $' + (params.length + 1);
    params.push(limit);

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/uaz/stats
 * Estatísticas gerais UAZ com filtros de data e separação por tipo
 */
router.get('/stats', async (req, res) => {
  try {
    // 🔒 SEGURANÇA: Filtrar por tenant_id
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Tenant não identificado'
      });
    }

    const { startDate, endDate, filterType } = req.query;

    console.log('📊 Buscando estatísticas UAZ/QR Connect');
    console.log('Filtros:', { startDate, endDate, filterType, tenantId });

    // ===============================================
    // 1. ESTATÍSTICAS DE INSTÂNCIAS (sem filtro de data)
    // ===============================================
    
    // 🐛 DEBUG: Verificar instâncias do tenant
    const debugInstances = await pool.query(`
      SELECT id, name, session_name, tenant_id
      FROM uaz_instances
      WHERE tenant_id = $1
    `, [tenantId]);
    
    console.log('🔍 DEBUG - Instâncias do tenant:', {
      tenant_id: tenantId,
      total_instances: debugInstances.rows.length,
      instances: debugInstances.rows.map(i => ({
        id: i.id,
        name: i.name,
        session: i.session_name
      }))
    });
    
    const instancesStats = await pool.query(`
      SELECT 
        COUNT(DISTINCT id) as total_instances,
        COUNT(DISTINCT CASE WHEN is_connected THEN id END) as connected_instances
      FROM uaz_instances
      WHERE tenant_id = $1
    `, [tenantId]);

    // ===============================================
    // 2. ESTATÍSTICAS DE MENSAGENS POR CAMPANHA
    // ===============================================
    let campaignQuery = `
      SELECT 
        COUNT(qcm.id) as total_messages,
        COUNT(CASE WHEN qcm.status = 'sent' THEN 1 END) as sent_messages,
        COUNT(CASE WHEN qcm.status = 'delivered' THEN 1 END) as delivered_messages,
        COUNT(CASE WHEN qcm.status = 'read' THEN 1 END) as read_messages,
        COUNT(CASE WHEN qcm.status = 'failed' THEN 1 END) as failed_messages,
        COUNT(DISTINCT qcm.campaign_id) as total_campaigns
      FROM qr_campaign_messages qcm
      INNER JOIN qr_campaigns qc ON qcm.campaign_id = qc.id
      WHERE qc.tenant_id = $1
    `;

    const campaignParams = [tenantId];
    let paramIndex = 2;

    // Aplicar filtros de data nas mensagens de campanha
    if (startDate) {
      campaignQuery += ` AND qcm.created_at >= $${paramIndex}::timestamp`;
      campaignParams.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      campaignQuery += ` AND qcm.created_at <= ($${paramIndex}::timestamp + INTERVAL '1 day')`;
      campaignParams.push(endDate);
      paramIndex++;
    }

    const campaignStats = await pool.query(campaignQuery, campaignParams);

    // ===============================================
    // 3. ESTATÍSTICAS DE MENSAGENS ÚNICAS (não-campanha)
    // ===============================================
    
    // 🐛 DEBUG: Verificar se há duplicação
    const debugQuery = `
      SELECT 
        um.id,
        um.phone_number,
        um.status,
        um.created_at,
        ui.name as instance_name,
        ui.tenant_id
      FROM uaz_messages um
      INNER JOIN uaz_instances ui ON um.instance_id = ui.id
      WHERE ui.tenant_id = $1
      ORDER BY um.created_at DESC
      LIMIT 10
    `;
    
    const debugResult = await pool.query(debugQuery, [tenantId]);
    console.log('🔍 DEBUG - Últimas 10 mensagens únicas:', {
      total_found: debugResult.rows.length,
      messages: debugResult.rows.map(m => ({
        id: m.id,
        phone: m.phone_number,
        status: m.status,
        instance: m.instance_name,
        created: m.created_at
      }))
    });

    let uniqueQuery = `
      SELECT 
        COUNT(DISTINCT um.id) as total_messages,
        COUNT(DISTINCT CASE WHEN um.status IN ('sent', 'completed') THEN um.id END) as sent_messages,
        COUNT(DISTINCT CASE WHEN um.status = 'delivered' THEN um.id END) as delivered_messages,
        COUNT(DISTINCT CASE WHEN um.status = 'read' THEN um.id END) as read_messages,
        COUNT(DISTINCT CASE WHEN um.status = 'failed' THEN um.id END) as failed_messages
      FROM uaz_messages um
      INNER JOIN uaz_instances ui ON um.instance_id = ui.id
      WHERE ui.tenant_id = $1
    `;

    const uniqueParams = [tenantId];
    let uniqueParamIndex = 2;

    // Aplicar filtros de data nas mensagens únicas
    if (startDate) {
      uniqueQuery += ` AND um.created_at >= $${uniqueParamIndex}::timestamp`;
      uniqueParams.push(startDate);
      uniqueParamIndex++;
    }

    if (endDate) {
      uniqueQuery += ` AND um.created_at <= ($${uniqueParamIndex}::timestamp + INTERVAL '1 day')`;
      uniqueParams.push(endDate);
      uniqueParamIndex++;
    }

    const uniqueStats = await pool.query(uniqueQuery, uniqueParams);
    
    console.log('📊 Resultado da query de mensagens únicas:', uniqueStats.rows[0]);

    // ===============================================
    // 4. CAMPANHAS RECENTES (últimas 5)
    // ===============================================
    const recentCampaignsQuery = `
      SELECT 
        id, name, status, total_contacts, sent_count, 
        delivered_count, read_count, failed_count, 
        created_at, started_at, completed_at
      FROM qr_campaigns
      WHERE tenant_id = $1
      ORDER BY created_at DESC
      LIMIT 5
    `;

    const recentCampaigns = await pool.query(recentCampaignsQuery, [tenantId]);

    console.log('✅ Estatísticas UAZ carregadas:', {
      instances: instancesStats.rows[0],
      campaign_messages: campaignStats.rows[0]?.total_messages || 0,
      unique_messages: uniqueStats.rows[0]?.total_messages || 0,
      recent_campaigns: recentCampaigns.rows.length
    });

    res.json({
      success: true,
      data: {
        // Instâncias
        instances: {
          total: parseInt(instancesStats.rows[0].total_instances) || 0,
          connected: parseInt(instancesStats.rows[0].connected_instances) || 0,
          disconnected: (parseInt(instancesStats.rows[0].total_instances) || 0) - (parseInt(instancesStats.rows[0].connected_instances) || 0)
        },
        
        // Mensagens por Campanha
        campaign_messages: {
          total: parseInt(campaignStats.rows[0]?.total_messages) || 0,
          sent: parseInt(campaignStats.rows[0]?.sent_messages) || 0,
          delivered: parseInt(campaignStats.rows[0]?.delivered_messages) || 0,
          read: parseInt(campaignStats.rows[0]?.read_messages) || 0,
          failed: parseInt(campaignStats.rows[0]?.failed_messages) || 0,
          total_campaigns: parseInt(campaignStats.rows[0]?.total_campaigns) || 0
        },
        
        // Mensagens Únicas (não-campanha)
        unique_messages: {
          total: parseInt(uniqueStats.rows[0]?.total_messages) || 0,
          sent: parseInt(uniqueStats.rows[0]?.sent_messages) || 0,
          delivered: parseInt(uniqueStats.rows[0]?.delivered_messages) || 0,
          read: parseInt(uniqueStats.rows[0]?.read_messages) || 0,
          failed: parseInt(uniqueStats.rows[0]?.failed_messages) || 0
        },

        // Campanhas recentes
        recent_campaigns: recentCampaigns.rows,

        // Filtros aplicados
        filters: {
          startDate: startDate || null,
          endDate: endDate || null,
          filterType: filterType || 'all'
        }
      }
    });
  } catch (error) {
    console.error('❌ Erro ao buscar estatísticas UAZ:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/uaz/instances/:id/send-menu
 * Envia menu interativo (botões, lista, enquete ou carousel)
 */
router.post('/instances/:id/send-menu', checkMessageLimit, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      number,
      type,
      text,
      choices,
      footerText,
      listButton,
      selectableCount,
      imageButton
    } = req.body;
    const tenantId = req.tenant?.id || req.user?.tenantId;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'Tenant não identificado'
      });
    }

    console.log('📤 Enviando menu interativo:', type);

    // Buscar instância (usando tenantQuery para RLS)
    const result = await tenantQuery(req,
      `SELECT 
        ui.*,
        p.name as proxy_name,
        p.host as proxy_host,
        p.port as proxy_port,
        p.username as proxy_username,
        p.password as proxy_password,
        p.type as proxy_type
      FROM uaz_instances ui
      LEFT JOIN proxies p ON ui.proxy_id = p.id
      WHERE ui.id = $1 AND ui.tenant_id = $2`,
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Instância não encontrada'
      });
    }

    const instance = result.rows[0];
    
    // Preparar configuração de proxy se existir
    const proxyConfig = instance.proxy_id ? {
      host: instance.proxy_host,
      port: instance.proxy_port,
      username: instance.proxy_username,
      password: instance.proxy_password,
      type: instance.proxy_type
    } : null;

    // 🔑 BUSCAR CREDENCIAIS DO TENANT
    const credentials = await getTenantUazapCredentials(tenantId);
    const uazService = new UazService(credentials.serverUrl, credentials.adminToken);

    // Validações
    if (!['button', 'list', 'poll', 'carousel'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Tipo inválido. Use: button, list, poll ou carousel'
      });
    }

    if (!choices || !Array.isArray(choices) || choices.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'É necessário fornecer opções (choices)'
      });
    }

    console.log('📋 Tipo:', type);
    console.log('📋 Choices recebidos:', JSON.stringify(choices, null, 2));
    
    // 🔤 PROCESSAR VARIÁVEIS NO TEXTO E FOOTER
    const { variables } = req.body;
    let processedText = processAutoVariables(text || '');
    let processedFooter = processAutoVariables(footerText || '');
    
    if (variables && Object.keys(variables).length > 0) {
      console.log('🔤 [DEBUG] Substituindo variáveis personalizadas no menu:', variables);
      processedText = replaceVariables(processedText, variables);
      processedFooter = replaceVariables(processedFooter, variables);
    }
    
    // Preparar menuData
    const menuData = {
      number,
      type,
      text: processedText
    };
    
    // Para listas, formatar com [Seção] e texto|id|descrição
    if (type === 'list') {
      menuData.choices = formatListChoices(choices);
      console.log('📋 Choices formatados para lista:', JSON.stringify(menuData.choices, null, 2));
    } else {
      menuData.choices = choices;  // Para buttons e polls, usar choices direto
    }

    // Adicionar campos opcionais baseado no tipo
    if (type === 'button' || type === 'list') {
      if (processedFooter) menuData.footerText = processedFooter;
    }
    
    if (type === 'list') {
      if (listButton) menuData.listButton = listButton;
    }
    
    if (type === 'poll') {
      if (selectableCount) menuData.selectableCount = selectableCount;
    }
    
    // Processar imageButton se necessário (converter local para Base64)
    if (imageButton) {
      if (imageButton.includes('localhost') || imageButton.startsWith('/uploads/')) {
        console.log('🔄 Convertendo imagem do botão para Base64...');
        const conversionResult = await convertFileToBase64(imageButton);
        
        if (conversionResult.success) {
          menuData.imageButton = conversionResult.file;
          console.log(`✅ Imagem do botão convertida (tamanho: ${(conversionResult.file.length / 1024).toFixed(2)} KB)`);
        } else {
          console.error('❌ Erro ao converter imagem:', conversionResult.error);
          return res.status(400).json({
            success: false,
            error: `Erro ao processar imagem: ${conversionResult.error}`
          });
        }
      } else {
        menuData.imageButton = imageButton;
      }
    }

    // Log do payload completo
    console.log('📤 Payload completo do menu:', JSON.stringify(menuData, null, 2));
    
    // Enviar via UAZ API usando sendMenu (suporta button, list, poll, carousel)
    console.log(`📋 Enviando ${type.toUpperCase()} via método sendMenu...`);
    const response = await uazService.sendMenu(instance.instance_token, menuData, proxyConfig);

    // Registrar no banco
    await pool.query(
      `INSERT INTO uaz_messages (instance_id, phone_number, message_type, message_content, status)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, number, `menu_${type}`, JSON.stringify(menuData), 'sent']
    );

    res.json({
      success: true,
      data: response
    });
  } catch (error) {
    console.error('❌ ERRO DETALHADO ao enviar menu:');
    console.error('   Mensagem:', error.message);
    console.error('   Stack:', error.stack);
    
    if (error.response) {
      console.error('   Resposta da API UAZ:');
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data, null, 2));
    }
    
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.response?.data || undefined
    });
  }
});

/**
 * POST /api/uaz/instances/:id/send-carousel
 * Envia carrossel de mídia com botões
 */
router.post('/instances/:id/send-carousel', checkMessageLimit, async (req, res) => {
  try {
    const { id } = req.params;
    const { number, text, cards } = req.body;
    const tenantId = req.tenant?.id || req.user?.tenantId;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'Tenant não identificado'
      });
    }

    console.log('📤 Enviando carrossel para:', number);
    console.log('📦 Payload recebido:', JSON.stringify({ id, number, text, cards }, null, 2));

    // Validações básicas
    if (!number) {
      return res.status(400).json({
        success: false,
        error: 'Número é obrigatório'
      });
    }

    // Validar cards
    if (!cards || !Array.isArray(cards) || cards.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'É necessário fornecer pelo menos um card'
      });
    }

    console.log(`📋 Total de cards recebidos: ${cards.length}`);

    // Buscar instância (usando tenantQuery para RLS)
    const result = await tenantQuery(req,
      `SELECT 
        ui.*,
        p.name as proxy_name,
        p.host as proxy_host,
        p.port as proxy_port,
        p.username as proxy_username,
        p.password as proxy_password,
        p.type as proxy_type
      FROM uaz_instances ui
      LEFT JOIN proxies p ON ui.proxy_id = p.id
      WHERE ui.id = $1 AND ui.tenant_id = $2`,
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Instância não encontrada'
      });
    }

    const instance = result.rows[0];
    console.log(`✅ Instância encontrada: ${instance.name} (Token: ${instance.instance_token ? 'OK' : 'FALTANDO'})`);

    if (!instance.instance_token) {
      return res.status(400).json({
        success: false,
        error: 'Instância sem token configurado'
      });
    }
    
    // Preparar configuração de proxy se existir
    const proxyConfig = instance.proxy_id ? {
      host: instance.proxy_host,
      port: instance.proxy_port,
      username: instance.proxy_username,
      password: instance.proxy_password,
      type: instance.proxy_type
    } : null;

    // 🔑 BUSCAR CREDENCIAIS DO TENANT
    const credentials = await getTenantUazapCredentials(tenantId);
    const uazService = new UazService(credentials.serverUrl, credentials.adminToken);

    // 🔤 PROCESSAR VARIÁVEIS NO TEXTO PRINCIPAL DO CAROUSEL
    const { variables } = req.body;
    let processedText = processAutoVariables(text || '');
    if (variables && Object.keys(variables).length > 0) {
      console.log('🔤 [DEBUG] Substituindo variáveis personalizadas no carousel:', variables);
      processedText = replaceVariables(processedText, variables);
    }

    // Processar cards e converter imagens locais para Base64
    const processedCards = [];
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      console.log(`\n🔍 Processando card ${i + 1}:`, {
        text: card.text?.substring(0, 50),
        image: card.image?.substring(0, 100),
        buttons: card.buttons?.length
      });

      if (!card.text || !card.image || !card.buttons) {
        console.error('❌ Card inválido:', card);
        return res.status(400).json({
          success: false,
          error: `Card ${i + 1} precisa ter text, image e buttons`
        });
      }

      if (!Array.isArray(card.buttons) || card.buttons.length === 0) {
        console.error('❌ Botões inválidos no card:', card.buttons);
        return res.status(400).json({
          success: false,
          error: `Card ${i + 1} precisa ter pelo menos um botão`
        });
      }

      // Converter imagem local para Base64 se necessário
      let imageUrl = card.image;
      if (card.image.includes('localhost') || card.image.startsWith('/uploads/')) {
        console.log(`🔄 Convertendo imagem ${i + 1} para Base64 com compressão agressiva...`);
        const conversionResult = await convertFileToBase64(card.image, true); // true = comprimir
        
        if (conversionResult.success) {
          imageUrl = conversionResult.file;
          const sizeKB = (imageUrl.length / 1024).toFixed(2);
          console.log(`✅ Imagem ${i + 1} convertida: ${sizeKB} KB`);
          
          // Avisar se ainda estiver muito grande
          if (imageUrl.length > 10 * 1024 * 1024) { // > 10MB
            console.warn(`⚠️ Imagem ${i + 1} muito grande (${sizeKB} KB) após compressão`);
          }
        } else {
          console.error(`❌ Erro ao converter imagem ${i + 1}:`, conversionResult.error);
          return res.status(400).json({
            success: false,
            error: `Erro ao processar imagem do card ${i + 1}: ${conversionResult.error}`
          });
        }
      }

      // 🔤 PROCESSAR VARIÁVEIS NO TEXTO DO CARD
      let cardText = processAutoVariables(card.text);
      if (variables && Object.keys(variables).length > 0) {
        cardText = replaceVariables(cardText, variables);
      }
      
      processedCards.push({
        text: cardText,
        image: imageUrl,
        buttons: card.buttons
      });
    }

    console.log(`\n✅ ${processedCards.length} cards processados com sucesso`);
    
    // Calcular tamanho total do payload
    const payloadStr = JSON.stringify({ number, text, cards: processedCards });
    const payloadSizeKB = (payloadStr.length / 1024).toFixed(2);
    const payloadSizeMB = (payloadStr.length / 1024 / 1024).toFixed(2);
    console.log(`📊 Tamanho total do payload: ${payloadSizeKB} KB (${payloadSizeMB} MB)`);
    
    if (payloadStr.length > 200 * 1024 * 1024) {
      console.warn(`⚠️ AVISO: Payload extremamente grande (${payloadSizeMB} MB). Pode falhar no envio.`);
    }
    
    console.log('🚀 Enviando para UAZ API...');

    // Enviar carrossel via UAZ API (com texto processado)
    const response = await uazService.sendCarousel(instance.instance_token, number, processedText, processedCards, proxyConfig);

    console.log('✅ Resposta da UAZ:', response);

    // Registrar mensagem no banco (com texto processado) - usando tenantQuery para RLS
    await tenantQuery(req,
      `INSERT INTO uaz_messages (instance_id, phone_number, message_type, message_content, status)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, number, 'carousel', JSON.stringify({ text: processedText, cards: processedCards }), 'sent']
    );

    console.log('✅ Mensagem registrada no banco');

    res.json({
      success: true,
      data: response
    });
  } catch (error) {
    console.error('❌ ERRO DETALHADO ao enviar carrossel:');
    console.error('Mensagem:', error.message);
    console.error('Stack:', error.stack);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
    
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.response?.data || undefined
    });
  }
});

// ========================================
// HISTÓRICO DE MENSAGENS
// ========================================

/**
 * POST /uaz/messages/save
 * Salva uma mensagem no histórico do banco de dados
 */
router.post('/messages/save', async (req, res) => {
  try {
    const {
      instanceId,
      phoneNumber,
      messageType,
      messageContent,
      status,
      error,
      jobId
    } = req.body;

    console.log('💾 Salvando mensagem no histórico:', {
      instanceId,
      phoneNumber,
      messageType,
      status
    });

    // Validar dados obrigatórios
    if (!instanceId || !phoneNumber || !messageType) {
      return res.status(400).json({
        success: false,
        error: 'instanceId, phoneNumber e messageType são obrigatórios'
      });
    }

    // 🐛 CORREÇÃO: Verificar se já existe mensagem recente (últimos 5 segundos)
    // para evitar duplicação quando frontend chama após o envio
    const checkExisting = await pool.query(
      `SELECT id, status FROM uaz_messages 
       WHERE instance_id = $1 
       AND phone_number = $2 
       AND message_type = $3
       AND created_at > NOW() - INTERVAL '5 seconds'
       ORDER BY created_at DESC
       LIMIT 1`,
      [instanceId, phoneNumber, messageType]
    );

    if (checkExisting.rows.length > 0) {
      // Mensagem já existe, fazer UPDATE ao invés de INSERT
      const existingId = checkExisting.rows[0].id;
      console.log(`⚠️ Mensagem já existe (ID: ${existingId}), atualizando status...`);
      
      const result = await pool.query(
        `UPDATE uaz_messages 
         SET status = $1::VARCHAR,
             error_message = $2::TEXT,
             sent_at = CASE WHEN $1 = 'completed' THEN NOW() ELSE sent_at END
         WHERE id = $3::INTEGER
         RETURNING id, created_at`,
        [status || 'completed', error || null, existingId]
      );

      console.log(`✅ Mensagem atualizada (ID: ${existingId})`);

      res.json({
        success: true,
        data: result.rows[0],
        updated: true
      });
    } else {
      // Mensagem não existe, fazer INSERT normal
      const result = await pool.query(
        `INSERT INTO uaz_messages (
          instance_id, 
          phone_number, 
          message_type, 
          message_content, 
          status, 
          error_message,
          metadata,
          sent_at,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        RETURNING id, created_at`,
        [
          instanceId,
          phoneNumber,
          messageType,
          messageContent ? JSON.stringify(messageContent) : null,
          status || 'pending',
          error || null,
          JSON.stringify({ jobId: jobId || null }),
          status === 'completed' ? 'NOW()' : null
        ]
      );

      const savedMessage = result.rows[0];

      console.log('✅ Mensagem salva no banco com ID:', savedMessage.id);

      res.json({
        success: true,
        data: savedMessage,
        updated: false
      });
    }

  } catch (error) {
    console.error('❌ Erro ao salvar mensagem:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /uaz/messages/history
 * Busca histórico de mensagens com filtros
 * Query params:
 *   - startDate: Data inicial (ISO format)
 *   - endDate: Data final (ISO format)
 *   - instanceId: ID da instância (opcional)
 *   - status: Status da mensagem (opcional)
 *   - limit: Limite de resultados (padrão: 100)
 */
router.get('/messages/history', async (req, res) => {
  try {
    const { startDate, endDate, instanceId, status, limit = 100 } = req.query;

    console.log('📊 Buscando histórico de mensagens:', {
      startDate,
      endDate,
      instanceId,
      status,
      limit
    });

    // Construir query dinâmica
    let query = `
      SELECT 
        m.id,
        m.instance_id,
        m.phone_number,
        m.message_type,
        m.message_content,
        m.status,
        m.error_message,
        m.metadata,
        m.sent_at,
        m.created_at,
        m.updated_at,
        i.name as instance_name,
        i.phone_number as instance_phone
      FROM uaz_messages m
      LEFT JOIN uaz_instances i ON m.instance_id = i.id
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    // Filtro por data
    if (startDate) {
      query += ` AND m.created_at >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND m.created_at <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    // Filtro por instância
    if (instanceId) {
      query += ` AND m.instance_id = $${paramIndex}`;
      params.push(instanceId);
      paramIndex++;
    }

    // Filtro por status
    if (status) {
      query += ` AND m.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    // Ordenar por mais recente
    query += ` ORDER BY m.created_at DESC`;

    // Limitar resultados
    query += ` LIMIT $${paramIndex}`;
    params.push(limit);

    console.log('🔍 Query SQL:', query);
    console.log('🔍 Parâmetros:', params);

    const result = await pool.query(query, params);

    console.log(`✅ ${result.rows.length} mensagens encontradas no histórico`);

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });

  } catch (error) {
    console.error('❌ Erro ao buscar histórico:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /uaz/messages/stats
 * Retorna estatísticas do histórico de mensagens
 */
router.get('/messages/stats', async (req, res) => {
  try {
    const { startDate, endDate, instanceId } = req.query;

    console.log('📊 Buscando estatísticas de mensagens');

    // Construir query de estatísticas
    let query = `
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'error') as errors,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
        COUNT(*) FILTER (WHERE status = 'sending' OR status = 'pending') as in_progress
      FROM uaz_messages
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (startDate) {
      query += ` AND created_at >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND created_at <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    if (instanceId) {
      query += ` AND instance_id = $${paramIndex}`;
      params.push(instanceId);
      paramIndex++;
    }

    const result = await pool.query(query, params);
    const stats = result.rows[0];

    console.log('✅ Estatísticas:', stats);

    res.json({
      success: true,
      data: {
        total: parseInt(stats.total),
        completed: parseInt(stats.completed),
        errors: parseInt(stats.errors),
        cancelled: parseInt(stats.cancelled),
        inProgress: parseInt(stats.in_progress)
      }
    });

  } catch (error) {
    console.error('❌ Erro ao buscar estatísticas:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/uaz/instances/:id/history
 * Obtém histórico completo de eventos de uma instância
 */
router.get('/instances/:id/history', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verifica se instância existe
    // 🔒 SEGURANÇA: Filtrar por tenant_id
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Tenant não identificado'
      });
    }
    
    const instance = await tenantQuery(req, 'SELECT * FROM uaz_instances WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    if (instance.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Instância não encontrada'
      });
    }
    
    const inst = instance.rows[0];
    
    // Busca histórico
    const history = await getInstanceHistory(id);
    
    console.log(`📝 Histórico da instância "${inst.name}" (ID: ${id}) - ${history.length} eventos`);
    
    res.json({
      success: true,
      instance: {
        id: inst.id,
        name: inst.name,
        session_name: inst.session_name,
        is_connected: inst.is_connected,
        status: inst.status,
        created_at: inst.created_at
      },
      history: history,
      total: history.length
    });
  } catch (error) {
    console.error('❌ Erro ao buscar histórico:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/uaz/verification-jobs
 * Cria um novo job de verificação em massa para rodar em background
 */
router.post('/verification-jobs', async (req, res) => {
  try {
    const { instanceIds, numbers, delaySeconds = 2, userIdentifier = 'default' } = req.body;

    if (!instanceIds || instanceIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Selecione pelo menos uma instância'
      });
    }

    if (!numbers || numbers.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Forneça pelo menos um número'
      });
    }

    console.log(`\n🚀 Criando job de verificação em massa:`);
    console.log(`   📱 Instâncias: ${instanceIds.length} - IDs: [${instanceIds.join(', ')}]`);
    console.log(`   📞 Números: ${numbers.length}`);
    console.log(`   ⏱️  Delay: ${delaySeconds}s`);

    // Criar job no banco
    const result = await pool.query(`
      INSERT INTO uaz_verification_jobs 
      (user_identifier, instance_ids, numbers, delay_seconds, progress_total, status)
      VALUES ($1, $2, $3, $4, $5, 'pending')
      RETURNING *
    `, [userIdentifier, instanceIds, numbers, delaySeconds, numbers.length]);

    const job = result.rows[0];

    console.log(`✅ Job criado com ID: ${job.id}`);

    // Iniciar processamento em background
    processVerificationJob(job.id).catch(err => {
      console.error(`❌ Erro ao processar job ${job.id}:`, err);
    });

    res.json({
      success: true,
      data: {
        jobId: job.id,
        status: job.status,
        total: job.progress_total
      }
    });

  } catch (error) {
    console.error('❌ Erro ao criar job:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/uaz/verification-jobs/:id
 * Obtém status e progresso de um job
 */
router.get('/verification-jobs/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query('SELECT * FROM uaz_verification_jobs WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Job não encontrado'
      });
    }

    const job = result.rows[0];

    res.json({
      success: true,
      data: {
        id: job.id,
        status: job.status,
        progress: {
          current: job.progress_current,
          total: job.progress_total,
          percentage: Math.round((job.progress_current / job.progress_total) * 100)
        },
        results: job.results || [],
        error: job.error_message,
        createdAt: job.created_at,
        startedAt: job.started_at,
        completedAt: job.completed_at
      }
    });

  } catch (error) {
    console.error('❌ Erro ao buscar job:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/uaz/verification-jobs
 * Lista todos os jobs do usuário
 */
router.get('/verification-jobs', async (req, res) => {
  try {
    const { userIdentifier = 'default', limit = 50 } = req.query;

    const result = await pool.query(`
      SELECT * FROM uaz_verification_jobs 
      WHERE user_identifier = $1 
      ORDER BY created_at DESC 
      LIMIT $2
    `, [userIdentifier, limit]);

    res.json({
      success: true,
      data: result.rows.map(job => ({
        id: job.id,
        status: job.status,
        progress: {
          current: job.progress_current,
          total: job.progress_total,
          percentage: Math.round((job.progress_current / job.progress_total) * 100)
        },
        createdAt: job.created_at,
        completedAt: job.completed_at
      }))
    });

  } catch (error) {
    console.error('❌ Erro ao listar jobs:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/uaz/verification-jobs/:id/pause
 * Pausa um job em execução
 */
router.post('/verification-jobs/:id/pause', async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(`
      UPDATE uaz_verification_jobs 
      SET status = 'paused', updated_at = NOW() 
      WHERE id = $1 AND status = 'running'
    `, [id]);

    console.log(`⏸️ Job ${id} pausado`);

    res.json({ success: true, message: 'Job pausado' });

  } catch (error) {
    console.error('❌ Erro ao pausar job:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/uaz/verification-jobs/:id/resume
 * Retoma um job pausado
 */
router.post('/verification-jobs/:id/resume', async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(`
      UPDATE uaz_verification_jobs 
      SET status = 'running', updated_at = NOW() 
      WHERE id = $1 AND status = 'paused'
    `, [id]);

    console.log(`▶️ Job ${id} retomado`);

    res.json({ success: true, message: 'Job retomado' });

  } catch (error) {
    console.error('❌ Erro ao retomar job:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/uaz/verification-jobs/:id/cancel
 * Cancela um job
 */
router.post('/verification-jobs/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(`
      UPDATE uaz_verification_jobs 
      SET status = 'cancelled', completed_at = NOW(), updated_at = NOW() 
      WHERE id = $1 AND status IN ('pending', 'running', 'paused')
    `, [id]);

    console.log(`⛔ Job ${id} cancelado`);

    res.json({ success: true, message: 'Job cancelado' });

  } catch (error) {
    console.error('❌ Erro ao cancelar job:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Função para processar job em background
 */
async function processVerificationJob(jobId) {
  try {
    console.log(`\n🔄 Iniciando processamento do job ${jobId}...`);

    // Buscar job
    const jobResult = await pool.query('SELECT * FROM uaz_verification_jobs WHERE id = $1', [jobId]);
    if (jobResult.rows.length === 0) {
      console.error(`❌ Job ${jobId} não encontrado`);
      return;
    }

    const job = jobResult.rows[0];

    // Atualizar para status "running"
    await pool.query(`
      UPDATE uaz_verification_jobs 
      SET status = 'running', started_at = NOW(), updated_at = NOW() 
      WHERE id = $1
    `, [jobId]);

    const results = [];
    const numbers = job.numbers;
    const instanceIds = job.instance_ids;

    // Buscar instâncias (incluir tenant_id para buscar credenciais corretas)
    const instancesResult = await pool.query(`
      SELECT id, name, instance_token, is_connected, tenant_id FROM uaz_instances WHERE id = ANY($1)
    `, [instanceIds]);
    const instances = instancesResult.rows;

    // 🔑 BUSCAR CREDENCIAIS DO TENANT (usando a primeira instância para obter o tenant)
    const tenantId = instances.length > 0 ? instances[0].tenant_id : null;
    if (!tenantId) {
      throw new Error('Tenant ID não encontrado nas instâncias');
    }
    const credentials = await getTenantUazapCredentials(tenantId);
    const uazService = new UazService(credentials.serverUrl, credentials.adminToken);

    console.log(`📊 Processando ${numbers.length} números com ${instances.length} instância(s):`);
    instances.forEach((inst, idx) => {
      console.log(`   ${idx + 1}. ID: ${inst.id} | Nome: ${inst.name} | Conectada: ${inst.is_connected ? '✅' : '❌'}`);
    });

    // Processar números
    for (let i = 0; i < numbers.length; i++) {
      // Verificar se foi pausado ou cancelado
      const statusCheck = await pool.query('SELECT status FROM uaz_verification_jobs WHERE id = $1', [jobId]);
      const currentStatus = statusCheck.rows[0].status;

      if (currentStatus === 'cancelled') {
        console.log(`⛔ Job ${jobId} foi cancelado`);
        break;
      }

      // Aguardar se pausado
      while (currentStatus === 'paused') {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const pauseCheck = await pool.query('SELECT status FROM uaz_verification_jobs WHERE id = $1', [jobId]);
        if (pauseCheck.rows[0].status !== 'paused') break;
      }

      const phone = numbers[i];
      const instanceIndex = i % instances.length;
      const instance = instances[instanceIndex];

      try {
        console.log(`\n🔍 [${i + 1}/${numbers.length}] Verificando ${phone}`);
        console.log(`   └─ Usando instância [${instanceIndex + 1}/${instances.length}]: ID=${instance.id} | ${instance.name}`);

        const checkResult = await uazService.checkNumber(instance.instance_token, phone);

        if (!checkResult.success) {
          throw new Error(checkResult.error || 'Erro na verificação');
        }

        const apiData = checkResult.data || {};
        
        const result = {
          phone,
          exists: checkResult.exists || false,
          verifiedName: apiData.verifiedName || null,
          jid: apiData.jid || null,
          instanceName: instance.name,
          instanceId: instance.id
        };

        console.log(`   ${result.exists ? '✅ TEM WhatsApp' : '❌ NÃO tem WhatsApp'} | Instância: ${instance.name}`);

        results.push(result);

        // Salvar histórico individual
        await pool.query(`
          INSERT INTO uaz_verification_history
          (instance_id, phone_number, is_in_whatsapp, verified_name, jid)
          VALUES ($1, $2, $3, $4, $5)
        `, [instance.id, phone, result.exists, result.verifiedName, result.jid]);

      } catch (error) {
        console.error(`❌ Erro ao verificar ${phone} com ${instance.name}:`, error.message);
        results.push({
          phone,
          exists: false,
          error: error.message,
          instanceName: instance.name,
          instanceId: instance.id
        });
      }

      // Atualizar progresso
      await pool.query(`
        UPDATE uaz_verification_jobs 
        SET progress_current = $1, results = $2, updated_at = NOW() 
        WHERE id = $3
      `, [i + 1, JSON.stringify(results), jobId]);

      // Aplicar delay
      if (i < numbers.length - 1 && job.delay_seconds > 0) {
        await new Promise(resolve => setTimeout(resolve, job.delay_seconds * 1000));
      }
    }

    // Finalizar job
    const finalStatus = await pool.query('SELECT status FROM uaz_verification_jobs WHERE id = $1', [jobId]);
    if (finalStatus.rows[0].status !== 'cancelled') {
      await pool.query(`
        UPDATE uaz_verification_jobs 
        SET status = 'completed', completed_at = NOW(), updated_at = NOW() 
        WHERE id = $1
      `, [jobId]);

      console.log(`✅ Job ${jobId} finalizado com sucesso!`);
      console.log(`   ✅ Válidos: ${results.filter(r => r.exists).length}`);
      console.log(`   ❌ Inválidos: ${results.filter(r => !r.exists).length}`);
    }

  } catch (error) {
    console.error(`❌ Erro ao processar job ${jobId}:`, error);
    await pool.query(`
      UPDATE uaz_verification_jobs 
      SET status = 'error', error_message = $1, completed_at = NOW(), updated_at = NOW() 
      WHERE id = $2
    `, [error.message, jobId]);
  }
}

/**
 * GET /api/uaz/fetch-instances?phoneNumber=5562981045992
 * Busca UMA instância específica na UAZ API filtrando por número de telefone
 * 
 * @query {string} phoneNumber - Número de telefone para buscar (obrigatório)
 */
router.get('/fetch-instances', async (req, res) => {
  try {
    console.log('\n📥 ========================================');
    console.log('📥 BUSCANDO INSTÂNCIA ESPECÍFICA NA UAZ API');
    console.log('📥 ========================================\n');

    // 🔒 Verificar tenant ANTES de tudo
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        error: 'Tenant não identificado'
      });
    }

    // 📞 OBRIGATÓRIO: Receber número de telefone
    const { phoneNumber } = req.query;
    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        error: 'Número de telefone é obrigatório'
      });
    }

    console.log(`📞 Buscando instância com número: ${phoneNumber}`);

    // 🔑 BUSCAR CREDENCIAIS DO TENANT
    console.log(`🔑 Buscando credenciais UAZAP para tenant ${tenantId}...`);
    const credentials = await getTenantUazapCredentials(tenantId);
    const tenantUazService = new UazService(credentials.serverUrl, credentials.adminToken);

    // Buscar TODAS as instâncias da UAZ API (mas vamos filtrar depois)
    const fetchResult = await tenantUazService.fetchInstances();

    if (!fetchResult.success) {
      return res.status(500).json({
        success: false,
        error: fetchResult.error
      });
    }

    const allInstances = fetchResult.instances || [];
    console.log(`📊 Total de instâncias na UAZ API: ${allInstances.length}`);

    if (allInstances.length === 0) {
      console.log('⚠️  Nenhuma instância encontrada na UAZ API');
      return res.json({
        success: true,
        found: false,
        message: 'Nenhuma instância encontrada na UAZ API',
        instance: null
      });
    }

    // 🔍 FILTRAR: Buscar APENAS a instância com o número informado
    console.log(`🔍 Filtrando instâncias pelo número: ${phoneNumber}`);
    console.log(`📊 Testando ${allInstances.length} instâncias...`);
    
    const matchedInstance = allInstances.find(inst => {
      const instancePhone = inst.owner || inst.phoneNumber || '';
      console.log(`   🔎 Testando: ${instancePhone} (owner) vs ${phoneNumber} (buscado)`);
      
      const matches = phonesMatch(phoneNumber, instancePhone);
      console.log(`      └─ Resultado: ${matches ? '✅ MATCH!' : '❌ Não bateu'}`);
      
      if (matches) {
        console.log(`   ✅✅✅ ENCONTRADO: ${instancePhone} corresponde a ${phoneNumber}`);
      }
      
      return matches;
    });

    if (!matchedInstance) {
      console.log(`❌ Nenhuma instância encontrada com o número: ${phoneNumber}`);
      console.log('========================================\n');
      return res.json({
        success: true,
        found: false,
        message: `Nenhuma instância encontrada com o número ${phoneNumber}`,
        instance: null
      });
    }

    console.log(`✅ Instância encontrada: ${matchedInstance.name || matchedInstance.id}`);
    
    // 🔒 Verificar se já está cadastrada no banco local DO TENANT
    const localInstances = await tenantQuery(req, 
      'SELECT instance_token FROM uaz_instances WHERE tenant_id = $1 AND instance_token = $2', 
      [tenantId, matchedInstance.token]
    );
    
    const alreadyImported = localInstances.rows.length > 0;

    if (alreadyImported) {
      console.log(`⚠️  Esta instância já está importada no sistema`);
    }

    console.log('========================================\n');

    res.json({
      success: true,
      found: true,
      alreadyImported,
      message: alreadyImported 
        ? 'Esta instância já está importada no sistema' 
        : 'Instância encontrada! Deseja importá-la?',
      instance: {
        token: matchedInstance.token,
        id: matchedInstance.id,
        name: matchedInstance.name,
        status: matchedInstance.status,
        owner: matchedInstance.owner,
        profileName: matchedInstance.profileName,
        profilePicUrl: matchedInstance.profilePicUrl,
        created: matchedInstance.created,
        isConnected: matchedInstance.status === 'connected'
      }
    });

  } catch (error) {
    console.error('❌ Erro ao buscar instâncias:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/uaz/import-instances
 * Importa instâncias selecionadas da UAZ API para o banco local
 */
router.post('/import-instances', async (req, res) => {
  try {
    const { instances } = req.body;
    const tenantId = req.tenant.id; // ✅ Obter tenant_id do request

    if (!instances || !Array.isArray(instances) || instances.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Selecione pelo menos uma instância para importar'
      });
    }

    console.log('\n📥 ========================================');
    console.log('📥 IMPORTANDO INSTÂNCIAS DA UAZ API');
    console.log('📥 ========================================\n');
    console.log(`📊 Total de instâncias a importar: ${instances.length}`);

    const imported = [];
    const errors = [];

    for (const inst of instances) {
      try {
        console.log(`\n📥 Importando: ${inst.name || inst.token}`);
        console.log(`   └─ Token: ${inst.token?.substring(0, 20)}...`);
        console.log(`   └─ Status: ${inst.status}`);
        console.log(`   └─ Owner: ${inst.owner || 'não informado'}`);

        // Inserir no banco (usando tenantQuery para respeitar RLS)
        const result = await tenantQuery(req, `
          INSERT INTO uaz_instances (
            name, 
            session_name, 
            instance_token, 
            phone_number, 
            profile_name, 
            profile_pic_url, 
            is_connected, 
            status,
            is_active,
            tenant_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING *
        `, [
          inst.name || inst.owner || `instancia_${Date.now()}`,
          inst.name || inst.id || `session_${Date.now()}`,
          inst.token,
          inst.owner || null,
          inst.profileName || null,
          inst.profilePicUrl || null,
          inst.status === 'connected',
          inst.status || 'disconnected',
          true,
          tenantId
        ]);

        const importedInstance = result.rows[0];
        imported.push(importedInstance);

        console.log(`   ✅ Importada com sucesso (ID: ${importedInstance.id})`);

      } catch (error) {
        console.error(`   ❌ Erro ao importar ${inst.name}:`, error.message);
        errors.push({
          instance: inst.name || inst.token,
          error: error.message
        });
      }
    }

    console.log('\n📊 ========================================');
    console.log(`📊 RESUMO DA IMPORTAÇÃO:`);
    console.log(`   ├─ Total solicitado: ${instances.length}`);
    console.log(`   ├─ Importadas com sucesso: ${imported.length}`);
    console.log(`   └─ Erros: ${errors.length}`);
    console.log('📊 ========================================\n');

    res.json({
      success: true,
      imported: imported.length,
      errors: errors.length,
      instances: imported,
      errorDetails: errors
    });

  } catch (error) {
    console.error('❌ Erro ao importar instâncias:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/uaz/contact/details
 * Obtém detalhes completos de um contato, incluindo foto de perfil
 */
router.post('/contact/details', async (req, res) => {
  try {
    const { instance_id, phone_number, preview = false } = req.body;

    // 🔒 SEGURANÇA: Obter tenant_id do request
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        error: 'Tenant não identificado'
      });
    }

    if (!instance_id || !phone_number) {
      return res.status(400).json({
        success: false,
        error: 'instance_id e phone_number são obrigatórios'
      });
    }

    console.log('\n📸 ========================================');
    console.log('📸 BUSCANDO DETALHES DO CONTATO');
    console.log('📸 ========================================');
    console.log(`   ├─ Instância ID: ${instance_id}`);
    console.log(`   ├─ Número: ${phone_number}`);
    console.log(`   └─ Tamanho foto: ${preview ? 'Preview (pequeno)' : 'Full (original)'}`);

    // Busca instância e proxy com filtro de tenant
    const instance = await pool.query(`
      SELECT ui.*, p.host, p.port, p.username, p.password
      FROM uaz_instances ui
      LEFT JOIN proxies p ON ui.proxy_id = p.id
      WHERE ui.id = $1 AND ui.tenant_id = $2
    `, [instance_id, tenantId]);

    if (instance.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Instância não encontrada'
      });
    }

    const inst = instance.rows[0];

    if (!inst.instance_token) {
      return res.status(400).json({
        success: false,
        error: 'Instância não possui token'
      });
    }

    // Configuração do proxy
    const proxyConfig = inst.host ? {
      host: inst.host,
      port: inst.port,
      username: inst.username,
      password: inst.password
    } : null;

    // 🔑 BUSCAR CREDENCIAIS DO TENANT
    const credentials = await getTenantUazapCredentials(tenantId);
    const tenantUazService = new UazService(credentials.serverUrl, credentials.adminToken);

    // Busca detalhes do contato via UAZ API
    const result = await tenantUazService.getContactDetails(
      inst.instance_token,
      phone_number,
      preview,
      proxyConfig
    );

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error
      });
    }

    // 📸 Se houver foto de perfil, baixar e salvar localmente
    let localProfilePicUrl = null;
    if (result.profilePicUrl && result.profilePicUrl.includes('pps.whatsapp.net')) {
      try {
        console.log('📥 Baixando foto de perfil para salvar localmente...');
        console.log('   URL original:', result.profilePicUrl);
        
        const axios = require('axios');
        const crypto = require('crypto');
        
        // Baixar a imagem
        const imageResponse = await axios.get(result.profilePicUrl, {
          responseType: 'arraybuffer',
          timeout: 15000, // Aumentar timeout
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive'
          },
          maxRedirects: 5
        });

        console.log('   Status do download:', imageResponse.status);
        console.log('   Tamanho:', imageResponse.data.length, 'bytes');

        // Gerar nome único para o arquivo
        const hash = crypto.createHash('md5').update(phone_number).digest('hex');
        const timestamp = Date.now();
        const filename = `profile_${hash}_${timestamp}.jpg`;
        const filepath = path.join(__dirname, '../../uploads/profile-pics', filename);

        // Criar diretório se não existir
        const dir = path.dirname(filepath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
          console.log('   📁 Diretório criado:', dir);
        }

        // Salvar arquivo
        fs.writeFileSync(filepath, Buffer.from(imageResponse.data));
        
        // URL relativa para retornar ao frontend
        localProfilePicUrl = `/uploads/profile-pics/${filename}`;
        
        console.log('✅ Foto salva localmente:', localProfilePicUrl);
        console.log('   Caminho completo:', filepath);
      } catch (downloadError) {
        console.error('❌ Erro ao baixar foto:', downloadError.message);
        console.error('   Status:', downloadError.response?.status);
        console.error('   URL tentada:', result.profilePicUrl);
        // Se falhar, retorna null (não usa a URL original que não funciona)
        localProfilePicUrl = null;
      }
    } else if (result.profilePicUrl) {
      // Se não for URL do WhatsApp, usa direto
      localProfilePicUrl = result.profilePicUrl;
    }

    console.log('✅ Detalhes do contato retornados com sucesso!');
    console.log('========================================\n');

    res.json({
      success: true,
      contact: {
        phone: phone_number,
        name: result.contactName,
        profilePicUrl: localProfilePicUrl,
        isGroup: result.isGroup,
        hasWhatsApp: result.hasWhatsApp,
        fullDetails: result.data
      }
    });

  } catch (error) {
    console.error('❌ Erro ao buscar detalhes do contato:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/uaz/proxy-image
 * Proxy para imagens do WhatsApp (resolve problemas de CORS)
 */
router.get('/proxy-image', async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL é obrigatória'
      });
    }

    console.log('🖼️ Proxy de imagem solicitado:', url);

    // Fazer requisição para buscar a imagem
    const axios = require('axios');
    const imageResponse = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    // Detectar tipo de conteúdo
    const contentType = imageResponse.headers['content-type'] || 'image/jpeg';
    
    // Definir headers corretos
    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=86400'); // Cache por 24h
    res.set('Access-Control-Allow-Origin', '*');
    
    // Enviar imagem
    res.send(Buffer.from(imageResponse.data));

    console.log('✅ Imagem proxy servida com sucesso!');

  } catch (error) {
    console.error('❌ Erro ao fazer proxy da imagem:', error.message);
    console.error('   └─ Status:', error.response?.status);
    console.error('   └─ StatusText:', error.response?.statusText);
    console.error('   └─ URL:', url);
    
    // Se o erro for de rede/timeout, retornar um placeholder ou erro mais específico
    const statusCode = error.response?.status || 500;
    res.status(statusCode).json({
      success: false,
      error: 'Erro ao carregar imagem: ' + error.message
    });
  }
});

/**
 * POST /api/uaz/reconfigure-webhooks
 * Reconfigura webhooks de TODAS as instâncias ativas do tenant
 * Útil quando a URL do webhook muda ou para corrigir configurações
 */
router.post('/reconfigure-webhooks', async (req, res) => {
  try {
    console.log('\n🔧 ===== RECONFIGURANDO WEBHOOKS DE TODAS AS INSTÂNCIAS =====');
    
    // 🔒 SEGURANÇA: Verificar tenant
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        error: 'Tenant não identificado'
      });
    }

    // Buscar todas as instâncias ativas do tenant
    const instancesResult = await tenantQuery(req, `
      SELECT 
        ui.*,
        p.host as proxy_host,
        p.port as proxy_port,
        p.username as proxy_username,
        p.password as proxy_password
      FROM uaz_instances ui
      LEFT JOIN proxies p ON ui.proxy_id = p.id
      WHERE ui.tenant_id = $1 AND ui.is_active = true
    `, [tenantId]);

    const instances = instancesResult.rows;
    console.log(`📋 Encontradas ${instances.length} instâncias ativas`);

    if (instances.length === 0) {
      return res.json({
        success: true,
        message: 'Nenhuma instância ativa encontrada',
        results: []
      });
    }

    // URL do webhook QR Connect
    const webhookUrl = process.env.QR_WEBHOOK_URL || 
      (process.env.WEBHOOK_BASE_URL ? `${process.env.WEBHOOK_BASE_URL}/api/qr-webhook/uaz-event` : null) ||
      'https://api.sistemasnettsistemas.com.br/api/qr-webhook/uaz-event';

    console.log(`🔗 Webhook URL: ${webhookUrl}`);

    // 🔑 Buscar credenciais do tenant
    const credentials = await getTenantUazapCredentials(tenantId);
    const tenantUazService = new UazService(credentials.serverUrl, credentials.adminToken);

    const results = [];

    for (const inst of instances) {
      try {
        console.log(`\n📡 Configurando webhook para: ${inst.name} (ID: ${inst.id})`);

        if (!inst.instance_token) {
          console.log('   ⚠️ Sem token, pulando...');
          results.push({
            id: inst.id,
            name: inst.name,
            success: false,
            error: 'Instância sem token'
          });
          continue;
        }

        const proxyConfig = inst.proxy_host ? {
          host: inst.proxy_host,
          port: inst.proxy_port,
          username: inst.proxy_username,
          password: inst.proxy_password
        } : null;

        // Configurar webhook
        const result = await tenantUazService.configureWebhook(
          inst.instance_token, 
          proxyConfig, 
          webhookUrl
        );

        if (result.success) {
          console.log(`   ✅ Webhook configurado com sucesso!`);
          results.push({
            id: inst.id,
            name: inst.name,
            success: true,
            webhookUrl: webhookUrl
          });
        } else {
          console.log(`   ❌ Erro: ${result.error}`);
          results.push({
            id: inst.id,
            name: inst.name,
            success: false,
            error: result.error
          });
        }
      } catch (error) {
        console.error(`   ❌ Exceção: ${error.message}`);
        results.push({
          id: inst.id,
          name: inst.name,
          success: false,
          error: error.message
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`\n📊 Resumo: ${successCount} sucesso, ${failCount} falhas`);
    console.log('===== FIM DA RECONFIGURAÇÃO =====\n');

    res.json({
      success: true,
      message: `Webhooks reconfigurados: ${successCount} sucesso, ${failCount} falhas`,
      webhookUrl: webhookUrl,
      results: results
    });

  } catch (error) {
    console.error('❌ Erro ao reconfigurar webhooks:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/uaz/instances/:id/reconfigure-webhook
 * Reconfigura webhook de uma instância específica
 */
router.post('/instances/:id/reconfigure-webhook', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`\n🔧 Reconfigurando webhook da instância ${id}...`);
    
    // 🔒 SEGURANÇA: Verificar tenant
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        error: 'Tenant não identificado'
      });
    }

    // Buscar instância
    const instanceResult = await tenantQuery(req, `
      SELECT 
        ui.*,
        p.host as proxy_host,
        p.port as proxy_port,
        p.username as proxy_username,
        p.password as proxy_password
      FROM uaz_instances ui
      LEFT JOIN proxies p ON ui.proxy_id = p.id
      WHERE ui.id = $1 AND ui.tenant_id = $2
    `, [id, tenantId]);

    if (instanceResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Instância não encontrada'
      });
    }

    const inst = instanceResult.rows[0];

    if (!inst.instance_token) {
      return res.status(400).json({
        success: false,
        error: 'Instância sem token'
      });
    }

    // URL do webhook QR Connect
    const webhookUrl = process.env.QR_WEBHOOK_URL || 
      (process.env.WEBHOOK_BASE_URL ? `${process.env.WEBHOOK_BASE_URL}/api/qr-webhook/uaz-event` : null) ||
      'https://api.sistemasnettsistemas.com.br/api/qr-webhook/uaz-event';

    // 🔑 Buscar credenciais do tenant
    const credentials = await getTenantUazapCredentials(tenantId);
    const tenantUazService = new UazService(credentials.serverUrl, credentials.adminToken);

    const proxyConfig = inst.proxy_host ? {
      host: inst.proxy_host,
      port: inst.proxy_port,
      username: inst.proxy_username,
      password: inst.proxy_password
    } : null;

    // Configurar webhook
    const result = await tenantUazService.configureWebhook(
      inst.instance_token, 
      proxyConfig, 
      webhookUrl
    );

    if (result.success) {
      console.log(`✅ Webhook configurado para ${inst.name}`);
      res.json({
        success: true,
        message: `Webhook configurado com sucesso para ${inst.name}`,
        webhookUrl: webhookUrl,
        data: result.data
      });
    } else {
      console.log(`❌ Erro ao configurar webhook: ${result.error}`);
      res.status(500).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    console.error('❌ Erro ao reconfigurar webhook:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
