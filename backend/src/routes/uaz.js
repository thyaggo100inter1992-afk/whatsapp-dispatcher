const express = require('express');
const router = express.Router();
const { pool } = require('../database/connection');
const { tenantQuery, queryWithTenantId } = require('../database/tenant-query');
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
// 🔍 MIDDLEWARE DE LOG PARA DEBUG
router.use((req, res, next) => {
  console.log(`\n🚀 ============================================`);
  console.log(`🚀 REQUISIÇÃO UAZ: ${req.method} ${req.path}`);
  console.log(`🚀 User ID: ${req.user?.id}`);
  console.log(`🚀 User Role: ${req.user?.role}`);
  console.log(`🚀 Tenant ID: ${req.tenant?.id}`);
  console.log(`🚀 ============================================\n`);
  next();
});



/**
 * ðŸ“ž Normaliza nÃºmero de telefone para comparaÃ§Ã£o
 * Remove caracteres especiais e testa diferentes formatos:
 * - Com/sem cÃ³digo do paÃ­s (55)
 * - Com/sem 9Âº dÃ­gito em celulares
 * 
 * @param {string} phone - NÃºmero a ser normalizado
 * @returns {Array<string>} Array com todas as variaÃ§Ãµes possÃ­veis do nÃºmero
 */
function normalizePhoneNumber(phone) {
  if (!phone) return [];
  
  // Remove tudo que nÃ£o Ã© nÃºmero
  const cleaned = phone.replace(/\D/g, '');
  
  const variations = [cleaned];
  
  // Se tem 55 no inÃ­cio (cÃ³digo do Brasil)
  if (cleaned.startsWith('55') && cleaned.length >= 12) {
    const withoutCountryCode = cleaned.substring(2); // Remove 55
    variations.push(withoutCountryCode);
    
    // Se o nÃºmero tem 11 dÃ­gitos apÃ³s o 55 (celular com 9Âº dÃ­gito)
    if (withoutCountryCode.length === 11) {
      // Remove o 9Âº dÃ­gito (3Âº caractere)
      const without9 = withoutCountryCode.substring(0, 2) + withoutCountryCode.substring(3);
      variations.push(without9);
      variations.push('55' + without9); // Com 55 mas sem 9Âº dÃ­gito
    }
  } 
  // Se NÃƒO tem 55 no inÃ­cio
  else {
    // Tenta adicionar 55
    variations.push('55' + cleaned);
    
    // Se tem 11 dÃ­gitos (celular com 9Âº dÃ­gito)
    if (cleaned.length === 11) {
      // Remove o 9Âº dÃ­gito
      const without9 = cleaned.substring(0, 2) + cleaned.substring(3);
      variations.push(without9);
      variations.push('55' + without9);
    }
    // Se tem 10 dÃ­gitos (sem 9Âº dÃ­gito)
    else if (cleaned.length === 10) {
      // Adiciona o 9Âº dÃ­gito
      const with9 = cleaned.substring(0, 2) + '9' + cleaned.substring(2);
      variations.push(with9);
      variations.push('55' + with9);
    }
  }
  
  // Remove duplicatas e retorna
  return [...new Set(variations)];
}

/**
 * ðŸ” Verifica se dois nÃºmeros de telefone sÃ£o equivalentes
 * Compara considerando diferentes formatos (com/sem 55, com/sem 9Âº dÃ­gito)
 * 
 * @param {string} phone1 - Primeiro nÃºmero
 * @param {string} phone2 - Segundo nÃºmero
 * @returns {boolean} true se os nÃºmeros sÃ£o equivalentes
 */
function phonesMatch(phone1, phone2) {
  const variations1 = normalizePhoneNumber(phone1);
  const variations2 = normalizePhoneNumber(phone2);
  
  console.log(`      ðŸ”¢ VariaÃ§Ãµes de "${phone1}": ${JSON.stringify(variations1)}`);
  console.log(`      ðŸ”¢ VariaÃ§Ãµes de "${phone2}": ${JSON.stringify(variations2)}`);
  
  // Verifica se alguma variaÃ§Ã£o do phone1 existe nas variaÃ§Ãµes do phone2
  const hasMatch = variations1.some(v1 => variations2.includes(v1));
  console.log(`      ðŸŽ¯ Match encontrado? ${hasMatch}`);
  
  return hasMatch;
}

/**
 * Substitui variÃ¡veis no formato {{nome}} pelos valores fornecidos
 * Exemplo: "OlÃ¡ {{nome}}" + {nome: "JoÃ£o"} â†’ "OlÃ¡ JoÃ£o"
 * @param {string} text - Texto com variÃ¡veis
 * @param {object} variables - Objeto com valores das variÃ¡veis
 * @returns {string} Texto com variÃ¡veis substituÃ­das
 */
function replaceVariables(text, variables) {
  if (!text || !variables) return text;
  
  let result = text;
  
  // Para cada variÃ¡vel fornecida
  Object.entries(variables).forEach(([varName, varValue]) => {
    if (varValue !== null && varValue !== undefined) {
      // Substituir {{nome}} ou {{ nome }} (com espaÃ§os opcionais)
      const regex = new RegExp(`{{\\s*${varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*}}`, 'g');
      result = result.replace(regex, String(varValue));
    }
  });
  
  return result;
}

/**
 * Converte arquivo local para Base64 com compressÃ£o para imagens
 * @param {string} fileUrl - URL ou caminho do arquivo
 * @param {boolean} compress - Se deve comprimir imagens (padrÃ£o: true)
 * @returns {object} { success: boolean, file: string, error?: string }
 */
async function convertFileToBase64(fileUrl, compress = true) {
  try {
    // Remove o domÃ­nio da URL, mantendo apenas o path relativo
    let filePath = fileUrl;
    if (fileUrl.startsWith('http')) {
      // Remove qualquer domÃ­nio/porta e mantÃ©m apenas o path
      filePath = '.' + fileUrl.replace(/^https?:\/\/[^\/]+/, '');
    } else {
      filePath = '.' + fileUrl;
    }
    
    console.log('ðŸ“ Convertendo arquivo para Base64:', filePath);
    
    // Detecta MIME type pela extensÃ£o
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
      console.log(`ðŸ”„ Comprimindo imagem (tamanho original: ${(originalSize / 1024).toFixed(2)} KB)...`);
      
      try {
        // Comprimir e redimensionar se necessÃ¡rio
        const image = sharp(fileBuffer);
        const metadata = await image.metadata();
        
        // Limitar tamanho mÃ¡ximo para 1200px para carrossÃ©is (mantendo boa qualidade)
        const maxSize = 1200;
        let resizeOptions = {};
        
        if (metadata.width > maxSize || metadata.height > maxSize) {
          resizeOptions = {
            width: maxSize,
            height: maxSize,
            fit: 'inside',
            withoutEnlargement: true
          };
          console.log(`ðŸ“ Redimensionando de ${metadata.width}x${metadata.height} para max ${maxSize}px`);
        }
        
        // Comprimir com qualidade 85% para manter boa qualidade visual
        fileBuffer = await image
          .resize(resizeOptions.width ? resizeOptions : undefined)
          .jpeg({ quality: 85, progressive: true })
          .toBuffer();
        
        const compressedSize = fileBuffer.length;
        const reduction = ((1 - compressedSize / originalSize) * 100).toFixed(1);
        console.log(`âœ… Imagem comprimida: ${(compressedSize / 1024).toFixed(2)} KB (reduÃ§Ã£o de ${reduction}%)`);
        
        // ForÃ§ar MIME type para JPEG apÃ³s compressÃ£o
        mimeType = 'image/jpeg';
      } catch (compressError) {
        console.warn('âš ï¸ Erro ao comprimir imagem, usando original:', compressError.message);
        // Continua com o buffer original
      }
    }
    
    const base64 = fileBuffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64}`;
    
    console.log(`âœ… Arquivo convertido: ${ext} (${mimeType}) - ${(base64.length / 1024).toFixed(2)} KB em Base64`);
    
    // Avisar se o Base64 estiver muito grande
    if (base64.length > 50 * 1024 * 1024) { // > 50MB
      console.warn(`âš ï¸ AVISO: Arquivo muito grande (${(base64.length / 1024 / 1024).toFixed(2)} MB). Pode causar problemas no envio.`);
    }
    
    return {
      success: true,
      file: dataUrl
    };
  } catch (error) {
    console.error('âŒ Erro ao converter arquivo:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Formata choices de lista para o formato esperado pela API UAZ
 * Formato: ["[SeÃ§Ã£o]", "texto|id|descriÃ§Ã£o", ...]
 * @param {Array<string>} choices - Array de strings com as opÃ§Ãµes
 * @returns {Array<string>} - Array formatado com seÃ§Ã£o e itens
 */
function formatListChoices(choices) {
  const formatted = ["[OpÃ§Ãµes]"]; // SeÃ§Ã£o padrÃ£o
  
  choices.forEach((choice, index) => {
    const id = `option_${index + 1}`;
    const text = choice.substring(0, 24); // WhatsApp limita a 24 caracteres
    const description = choice.length > 24 ? choice.substring(24, 72) : ''; // DescriÃ§Ã£o atÃ© 72 chars
    
    // Formato: texto|id|descriÃ§Ã£o
    formatted.push(`${text}|${id}|${description}`);
  });
  
  return formatted;
}

/**
 * Substitui variÃ¡veis automÃ¡ticas em um texto
 * VariÃ¡veis suportadas: {{data}}, {{hora}}, {{protocolo}}, {{saudacao}}, {{saudaÃ§Ã£o}}
 * @param {string} text - Texto com variÃ¡veis a serem substituÃ­das
 * @returns {string} - Texto com variÃ¡veis substituÃ­das pelos valores atuais
 */
function processAutoVariables(text) {
  if (!text) return text;
  
  // â° USAR TIMEZONE DE BRASÃLIA (America/Sao_Paulo = GMT-3)
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
    saudacao_acentuada: (() => { // variacao com acento
      const hour = brasiliaTime.getHours();
      if (hour >= 6 && hour < 12) return 'Bom dia';
      if (hour >= 12 && hour < 18) return 'Boa tarde';
      return 'Boa noite';
    })()
  };

  let processedText = text;
  
  // Substituir cada variÃ¡vel automÃ¡tica no texto
  Object.entries(autoVariables).forEach(([key, value]) => {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'gi');
    processedText = processedText.replace(regex, value);
  });

  // Log apenas se houve substituiÃ§Ãµes
  if (processedText !== text) {
    console.log('ðŸ”¤ VariÃ¡veis automÃ¡ticas substituÃ­das:', Object.keys(autoVariables).filter(key => {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'gi');
      return regex.test(text);
    }));
  }

  return processedText;
}

// âš ï¸ AVISO: Sistema de Credenciais Multi-Tenant ATIVADO
// As rotas CRÃTICAS agora usam getTenantUazapCredentials() para buscar credenciais dinamicamente:
//   âœ… POST /instances (criar)
//   âœ… GET /instances/:id/qrcode (QR Code)
//   âœ… PUT /instances/:id (atualizar)
//   âœ… GET /instances/:id/status (verificar status)
//
// Outras rotas ainda usam credencial global (temporÃ¡rio para compatibilidade)
const UAZ_SERVER_URL = process.env.UAZ_SERVER_URL || 'https://nettsistemas.uazapi.com';
const UAZ_ADMIN_TOKEN = process.env.UAZ_ADMIN_TOKEN || '';

// ðŸ”„ RELOAD FORÃ‡ADO - Sistema de variÃ¡veis automÃ¡ticas ativo
console.log('âœ… [RELOAD] Arquivo uaz.js carregado com suporte a variÃ¡veis automÃ¡ticas!');

console.log('ðŸ”§ Sistema de Credenciais Multi-Tenant ATIVADO');
console.log('   âœ… Rotas crÃ­ticas usam credenciais por tenant');
console.log('   âš ï¸ Rotas legacy usam credencial global (temporÃ¡rio)');

// InstÃ¢ncia global do uazService (usado apenas por rotas legacy que ainda nÃ£o foram migradas)
const uazService = new UazService(UAZ_SERVER_URL, UAZ_ADMIN_TOKEN);

/**
 * GET /api/uaz/health
 * Verifica saÃºde da API UAZ
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
 * Lista todas as instÃ¢ncias UAZ
 * Query params:
 *  - refresh=true: Atualiza status de todas as instÃ¢ncias antes de retornar
 */
router.get('/instances', async (req, res) => {
    try {
    const { refresh } = req.query;
    
    // 🔒 SEGURANÇA: Filtrar por tenant_id e permissões do usuário
    const tenantId = req.tenant?.id;
    const userId = req.user?.id;
    
    console.log('🔍 [/instances] Buscando instâncias QR...');
    console.log(`   Tenant ID: ${tenantId}`);
    console.log(`   User ID: ${userId}`);
    
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Tenant não identificado'
      });
    }
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Usuário não identificado'
      });
    }
    
    // Verificar se o usuário é o dono do tenant (master) pelo role
    const isTenantOwner = req.user?.role === 'admin' || req.user?.role === 'super_admin';
    console.log(`   É dono do tenant? ${isTenantOwner} (role: ${req.user?.role})`);
    
    let result;
    
    if (isTenantOwner) {
      // Dono do tenant vê TODAS as instâncias
      console.log('   ✅ Usuário master - retornando TODAS as instâncias');
      result = await tenantQuery(req, `
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
    } else {
      // Usuário comum vê apenas suas instâncias autorizadas
      console.log('   🔒 Usuário comum - filtrando por permissões');
      result = await tenantQuery(req, `
        SELECT 
          ui.*,
          p.name as proxy_name,
          p.host as proxy_host,
          p.port as proxy_port,
          p.username as proxy_username,
          p.password as proxy_password,
          p.type as proxy_type
        FROM uaz_instances ui
        INNER JOIN user_uaz_instances uui ON ui.id = uui.uaz_instance_id
        LEFT JOIN proxies p ON ui.proxy_id = p.id
        WHERE uui.user_id = $1 AND uui.tenant_id = $2
        ORDER BY ui.created_at DESC
      `, [userId, tenantId]);
    }
    
    console.log(`   ✅ Total de instâncias retornadas: ${result.rows.length}`);

    // Se refresh=true, atualiza o status de cada instÃ¢ncia
    if (refresh === 'true') {
      console.log('\nðŸ”„ ========================================');
      console.log('ðŸ”„ INICIANDO SINCRONIZAÃ‡ÃƒO DE INSTÃ‚NCIAS UAZ');
      console.log('ðŸ”„ ========================================');
      console.log(`ðŸ“Š Total de instÃ¢ncias no banco: ${result.rows.length}`);
      
      // ðŸ”‘ BUSCAR CREDENCIAIS DO TENANT
      const credentials = await getTenantUazapCredentials(tenantId);
      const tenantUazService = new UazService(credentials.serverUrl, credentials.adminToken);
      
      const instancesWithSync = await Promise.all(result.rows.map(async (instance) => {
        console.log(`\nðŸ” Verificando: ${instance.name} (ID: ${instance.id})`);
        
        // SÃ³ verifica se tiver token
        if (!instance.instance_token) {
          console.log(`   âš ï¸  Sem token, pulando verificaÃ§Ã£o`);
          return instance;
        }

        console.log(`   ðŸ”‘ Token: ${instance.instance_token?.substring(0, 20)}...`);
        
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
            // statusResult.connected jÃ¡ vem da funÃ§Ã£o getStatus
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
              // ðŸ”’ SEGURANÃ‡A: Filtrar por tenant_id
              await tenantQuery(req,
                `UPDATE uaz_instances 
                 SET is_connected = $1, status = $2, phone_number = $3, 
                     profile_name = $4, profile_pic_url = $5, updated_at = NOW()
                 WHERE id = $6 AND tenant_id = $7`,
                [isConnected, status, phoneNumber, profileName, profilePicUrl, instance.id, instance.tenant_id]
              );
              
              console.log(`âœ… InstÃ¢ncia ${instance.name} (${instance.id}): ${status}`);
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
            // âš ï¸ Se getStatus retornou success=false, lanÃ§ar exceÃ§Ã£o para acionar a lÃ³gica de sincronizaÃ§Ã£o
            const error = new Error(statusResult.error || 'Falha ao verificar status');
            error.isUazApiError = true;
            error.originalError = statusResult.error;
            throw error;
          }
        } catch (error) {
          // ðŸš¨ SINCRONIZAÃ‡ÃƒO: Se a instÃ¢ncia nÃ£o existe mais na UAZ API (404 ou 401), deletar do banco local
          const isInvalidToken = error.response?.status === 404 || 
                                 error.response?.status === 401 ||
                                 error.response?.data?.message?.toLowerCase().includes('invalid token') ||
                                 error.message?.toLowerCase().includes('invalid token') ||
                                 error.originalError?.toLowerCase().includes('invalid token') ||
                                 error.message?.toLowerCase().includes('not found') ||
                                 error.message?.toLowerCase().includes('instance not found');
          
          if (isInvalidToken) {
            
            console.log(`\nðŸ—‘ï¸  ========================================`);
            console.log(`ðŸ—‘ï¸  SINCRONIZAÃ‡ÃƒO: InstÃ¢ncia nÃ£o existe mais na UAZ API`);
            console.log(`ðŸ—‘ï¸  ========================================`);
            console.log(`ðŸ“¦ InstÃ¢ncia: ${instance.name} (ID: ${instance.id})`);
            console.log(`ðŸ”‘ Token: ${instance.instance_token?.substring(0, 20)}...`);
            console.log(`âŒ Erro: ${error.response?.status || 'Unknown'} - ${error.response?.data?.message || error.message}`);
            console.log(`ðŸ“ Status: Token invÃ¡lido ou instÃ¢ncia deletada na UAZ API, removendo do banco local...`);
            
            try {
              // Deletar do banco local
              await tenantQuery(req, 
                'DELETE FROM uaz_instances WHERE id = $1 AND tenant_id = $2', 
                [instance.id, instance.tenant_id]
              );
              
              console.log(`âœ… InstÃ¢ncia ${instance.name} (${instance.id}) removida do banco local com sucesso!`);
              console.log(`========================================\n`);
              
              // Retornar null para filtrar depois
              return null;
            } catch (deleteError) {
              console.error(`âŒ Erro ao deletar instÃ¢ncia do banco:`, deleteError.message);
            }
          } else {
            // Outros erros apenas loga e mantÃ©m no banco
            console.error(`âš ï¸ Erro ao verificar status de ${instance.name}:`, error.message);
          }
        }

        return instance;
      }));

      // Filtrar instÃ¢ncias null (que foram deletadas na UAZ API)
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
 * ObtÃ©m detalhes de uma instÃ¢ncia especÃ­fica
 */
router.get('/instances/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // ðŸ”’ SEGURANÃ‡A: Filtrar por tenant_id (usando tenantQuery para respeitar RLS)
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        error: 'Tenant nÃ£o identificado'
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
        error: 'InstÃ¢ncia nÃ£o encontrada'
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
 * Cria nova instÃ¢ncia UAZ
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

    // Gerar nome automÃ¡tico se nÃ£o fornecido
    if (!name || name.trim() === '') {
      const timestamp = Date.now();
      name = `instancia_${timestamp}`;
      console.log(`ðŸ“ Nome nÃ£o fornecido, gerando automaticamente: ${name}`);
    }

    // Gerar session_name automÃ¡tico se nÃ£o fornecido
    if (!session_name || session_name.trim() === '') {
      // Se o nome foi fornecido, usar o nome como base para session_name
      if (name && name.trim() !== '') {
        // Limpar o nome para criar um session_name vÃ¡lido (apenas letras e nÃºmeros)
        session_name = name.toLowerCase().replace(/[^a-z0-9]/g, '');
        console.log(`ðŸ“ Session name nÃ£o fornecido, usando nome da conexÃ£o: ${session_name}`);
      } else {
        // Se ambos estÃ£o vazios, gerar automaticamente
        const timestamp = Date.now();
        const randomSuffix = Math.floor(Math.random() * 1000);
        session_name = `session${timestamp}${randomSuffix}`;
        console.log(`ðŸ“ Session name nÃ£o fornecido, gerando automaticamente: ${session_name}`);
      }
    }

    // ðŸ”’ SEGURANÃ‡A: Obter tenant_id
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        error: 'Tenant nÃ£o identificado'
      });
    }

    // ðŸ”— BUSCAR WEBHOOK URL DO TENANT
    const tenantResult = await pool.query(
      'SELECT webhook_url FROM tenants WHERE id = $1',
      [tenantId]
    );
    
    if (tenantResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Tenant nÃ£o encontrado'
      });
    }
    
    // Usar webhook do tenant (sobrescreve se veio no body)
    webhook_url = tenantResult.rows[0].webhook_url || webhook_url;
    
    console.log('ðŸ”— Webhook do tenant serÃ¡ usado:', webhook_url);

    // Verifica se o session_name jÃ¡ existe no tenant
    const existingSession = await pool.query(
      'SELECT id FROM uaz_instances WHERE session_name = $1 AND tenant_id = $2',
      [session_name, tenantId]
    );
    
    if (existingSession.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'JÃ¡ existe uma instÃ¢ncia com esse nome de sessÃ£o'
      });
    }

    let finalInstanceToken = instance_token;
    let createResponse = null;
    let usedCredentialId = null;

    // Se nÃ£o foi fornecido token, cria automaticamente via API UAZ
    if (!instance_token || instance_token.trim() === '') {
      // ðŸ”‘ BUSCAR CREDENCIAIS DO TENANT
      const credentials = await getTenantUazapCredentials(tenantId);
      console.log(`ðŸ”‘ Usando credencial: "${credentials.credentialName}"`);
      console.log(`   URL: ${credentials.serverUrl}`);
      console.log(`   Credential ID: ${credentials.credentialId}`);

      // ðŸ”– SALVAR qual credencial estÃ¡ sendo usada
      usedCredentialId = credentials.credentialId;

      // Criar instÃ¢ncia do UazService com as credenciais corretas
      const tenantUazService = new UazService(credentials.serverUrl, credentials.adminToken);

      // ObtÃ©m configuraÃ§Ã£o do proxy se existir
      let proxyConfig = null;
      if (proxy_id) {
        // ðŸ”’ SEGURANÃ‡A: Buscar proxy COM filtro de tenant
        const tenantId = req.tenant?.id;
        if (!tenantId) {
          return res.status(401).json({
            success: false,
            message: 'Tenant nÃ£o identificado'
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

      // Cria instÃ¢ncia no UAZ e obtÃ©m o token (usando as credenciais corretas do tenant)
      createResponse = await tenantUazService.createInstance(session_name, proxyConfig);
      
      if (!createResponse.success) {
        return res.status(400).json({
          success: false,
          error: 'Erro ao criar instÃ¢ncia no QR Connect: ' + createResponse.error
        });
      }

      finalInstanceToken = createResponse.instanceToken;

      // ðŸ”— CONFIGURAR WEBHOOK NA UAZ API
      try {
        const tenantUazService = new UazService(credentials.serverUrl, credentials.adminToken);
        await tenantUazService.configureWebhook(finalInstanceToken, proxyConfig, webhook_url);
        console.log('âœ… Webhook configurado na UAZ API');
      } catch (webhookError) {
        console.warn('âš ï¸ Erro ao configurar webhook (nÃ£o crÃ­tico):', webhookError.message);
        // NÃ£o impede a criaÃ§Ã£o da instÃ¢ncia
      }
    }

    // ðŸ”’ SEGURANÃ‡A: Salva no banco com tenant_id E credential_id (usando tenantQuery para respeitar RLS)
    console.log(`ðŸ’¾ Salvando instÃ¢ncia com credencial ID: ${usedCredentialId || 'NULL (token manual)'}`);
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
        ? 'InstÃ¢ncia criada automaticamente com sucesso via QR Connect!'
        : 'InstÃ¢ncia cadastrada com sucesso! Agora vocÃª pode gerar o QR Code.'
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
 * Atualiza instÃ¢ncia UAZ (nome da instÃ¢ncia E nome do perfil do WhatsApp)
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

    // ðŸ”’ SEGURANÃ‡A: Validar tenant
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        error: 'Tenant nÃ£o identificado'
      });
    }

    // Busca a instÃ¢ncia atual para obter o token e proxy (usando tenantQuery para RLS)
    const currentInstance = await tenantQuery(req, `
      SELECT ui.*, p.host, p.port, p.username, p.password
      FROM uaz_instances ui
      LEFT JOIN proxies p ON ui.proxy_id = p.id
      WHERE ui.id = $1 AND ui.tenant_id = $2
    `, [id, tenantId]);

    if (currentInstance.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'InstÃ¢ncia nÃ£o encontrada'
      });
    }

    const inst = currentInstance.rows[0];
    
    // ðŸ”‘ BUSCAR CREDENCIAIS DO TENANT
    const credentials = await getTenantUazapCredentials(tenantId);
    const tenantUazService = new UazService(credentials.serverUrl, credentials.adminToken);
    
    const proxyConfig = inst.host ? {
      host: inst.host,
      port: inst.port,
      username: inst.username,
      password: inst.password
    } : null;

    let messages = [];

    // Atualiza nome da instÃ¢ncia se foi alterado
    if (name && name !== inst.name && inst.instance_token) {
      console.log(`âœï¸ Atualizando nome da instÃ¢ncia ${inst.name} â†’ ${name} (ID: ${id})`);
      
      const updateResult = await tenantUazService.updateInstanceName(
        inst.instance_token, 
        name, 
        proxyConfig
      );

      if (updateResult.success) {
        console.log(`âœ… Nome da instÃ¢ncia atualizado com sucesso na API UAZ`);
        messages.push('Nome da instÃ¢ncia atualizado');
      } else {
        console.warn(`âš ï¸ Aviso ao atualizar nome na API UAZ: ${updateResult.error}`);
      }
    }

    // Atualiza nome do perfil do WhatsApp se foi fornecido
    let updatedProfileName = profile_name;
    if (profile_name && profile_name.trim() !== '' && inst.instance_token && inst.is_connected) {
      console.log(`ðŸ‘¤ Atualizando nome do perfil do WhatsApp: ${profile_name} (ID: ${id})`);
      
      const profileResult = await tenantUazService.updateProfileName(
        inst.instance_token,
        profile_name,
        proxyConfig
      );

      if (profileResult.success) {
        console.log(`âœ… Nome do perfil atualizado com sucesso no WhatsApp`);
        messages.push('Nome do perfil do WhatsApp atualizado');
        
        // â³ AGUARDA 3 SEGUNDOS PARA API UAZ SINCRONIZAR
        console.log(`â³ Aguardando 3 segundos para API UAZ sincronizar o nome...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // ðŸ”„ BUSCA O NOME ATUALIZADO DO WHATSAPP
        console.log(`ðŸ” Buscando nome do perfil atualizado do WhatsApp...`);
        try {
          const statusResult = await tenantUazService.getStatus(inst.instance_token, proxyConfig);
          if (statusResult.success && statusResult.data) {
            // Busca no lugar correto de acordo com a documentaÃ§Ã£o UAZ API
            const realProfileName = statusResult.data.instance?.profileName || profile_name;
            
            console.log('ðŸ” DEBUG - statusResult.data.instance.profileName:', statusResult.data.instance?.profileName);
            console.log('ðŸ” DEBUG - Nome real do perfil:', realProfileName);
            
            if (realProfileName && realProfileName !== profile_name) {
              console.log(`âœ… Nome real do perfil obtido: ${realProfileName} (diferente do enviado: ${profile_name})`);
              updatedProfileName = realProfileName;
            } else {
              console.log(`âœ… Nome do perfil confirmado: ${realProfileName}`);
              updatedProfileName = realProfileName;
            }
          }
        } catch (statusError) {
          console.warn(`âš ï¸ NÃ£o foi possÃ­vel buscar nome atualizado, usando o enviado:`, statusError.message);
        }
      } else {
        console.warn(`âš ï¸ Aviso ao atualizar nome do perfil: ${profileResult.error}`);
        if (profileResult.error.includes('No session')) {
          messages.push('âš ï¸ ConexÃ£o deve estar ativa para atualizar nome do perfil');
        }
      }
    }

    // ðŸ”’ SEGURANÃ‡A: Atualiza no banco de dados local COM filtro tenant_id
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

    console.log(`âœ… InstÃ¢ncia ${result.rows[0].name} (ID: ${id}) atualizada no banco de dados local`);

    const message = messages.length > 0 
      ? messages.join(' e ') 
      : 'InstÃ¢ncia atualizada com sucesso';

    res.json({
      success: true,
      data: result.rows[0],
      message: message
    });
  } catch (error) {
    console.error('âŒ Erro ao atualizar instÃ¢ncia:', error);
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

    // ðŸ”’ SEGURANÃ‡A: Obter tenant_id
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        error: 'Tenant nÃ£o identificado'
      });
    }

    console.log(`ðŸ”„ Sincronizando nome do perfil da instÃ¢ncia ID: ${id}`);

    // Busca a instÃ¢ncia atual (usando tenantQuery para RLS)
    const currentInstance = await tenantQuery(req, `
      SELECT ui.*, p.host, p.port, p.username, p.password
      FROM uaz_instances ui
      LEFT JOIN proxies p ON ui.proxy_id = p.id
      WHERE ui.id = $1 AND ui.tenant_id = $2
    `, [id, tenantId]);

    if (currentInstance.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'InstÃ¢ncia nÃ£o encontrada'
      });
    }

    const inst = currentInstance.rows[0];

    if (!inst.instance_token) {
      return res.status(400).json({
        success: false,
        error: 'InstÃ¢ncia sem token. NÃ£o Ã© possÃ­vel sincronizar.'
      });
    }

    if (!inst.is_connected) {
      return res.status(400).json({
        success: false,
        error: 'InstÃ¢ncia nÃ£o estÃ¡ conectada. Conecte-se primeiro.'
      });
    }

    const proxyConfig = inst.host ? {
      host: inst.host,
      port: inst.port,
      username: inst.username,
      password: inst.password
    } : null;

    // ðŸ”‘ BUSCAR CREDENCIAIS DO TENANT
    const credentials = await getTenantUazapCredentials(tenantId);
    const tenantUazService = new UazService(credentials.serverUrl, credentials.adminToken);

    // Busca o status atual do WhatsApp
    console.log(`ðŸ” Buscando nome do perfil atual do WhatsApp...`);
    const statusResult = await tenantUazService.getStatus(inst.instance_token, proxyConfig);

    if (!statusResult.success) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar status do WhatsApp: ' + statusResult.error
      });
    }

    // Extrai o profileName de acordo com a documentaÃ§Ã£o UAZ API
    // O profileName estÃ¡ em: statusResult.data.instance.profileName
    const profileName = statusResult.data?.instance?.profileName || null;
    
    console.log('ðŸ” DEBUG - profileName buscado em statusResult.data.instance.profileName:', profileName);
    console.log('ðŸ” DEBUG - Estrutura de statusResult.data.instance:');
    console.log(JSON.stringify(statusResult.data?.instance, null, 2));

    if (!profileName) {
      return res.status(404).json({
        success: false,
        error: 'Nome do perfil nÃ£o disponÃ­vel no WhatsApp'
      });
    }

    // ðŸ”’ SEGURANÃ‡A: Atualiza no banco de dados COM tenant_id
    await tenantQuery(req, `
      UPDATE uaz_instances 
      SET profile_name = $1,
          updated_at = NOW()
      WHERE id = $2 AND tenant_id = $3
    `, [profileName, id, tenantId]);

    console.log(`âœ… Nome do perfil sincronizado: ${profileName}`);

    res.json({
      success: true,
      profile_name: profileName,
      message: 'Nome do perfil sincronizado com sucesso'
    });
  } catch (error) {
    console.error('âŒ Erro ao sincronizar perfil:', error);
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

    console.log(`ðŸ“¸ Atualizando foto do perfil da instÃ¢ncia ID: ${id}`);

    if (!image || image.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'URL da imagem Ã© obrigatÃ³ria'
      });
    }

    // Busca a instÃ¢ncia atual
    const currentInstance = await pool.query(`
      SELECT ui.*, p.host, p.port, p.username, p.password
      FROM uaz_instances ui
      LEFT JOIN proxies p ON ui.proxy_id = p.id
      WHERE ui.id = $1
    `, [id]);

    if (currentInstance.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'InstÃ¢ncia nÃ£o encontrada'
      });
    }

    const inst = currentInstance.rows[0];

    if (!inst.instance_token) {
      return res.status(400).json({
        success: false,
        error: 'InstÃ¢ncia sem token. NÃ£o Ã© possÃ­vel atualizar foto.'
      });
    }

    if (!inst.is_connected) {
      return res.status(400).json({
        success: false,
        error: 'InstÃ¢ncia nÃ£o estÃ¡ conectada. Conecte-se primeiro.'
      });
    }

    const proxyConfig = inst.host ? {
      host: inst.host,
      port: inst.port,
      username: inst.username,
      password: inst.password
    } : null;

    // ðŸ”‘ BUSCAR CREDENCIAIS DO TENANT
    const credentials = await getTenantUazapCredentials(tenantId);
    const tenantUazService = new UazService(credentials.serverUrl, credentials.adminToken);

    // Atualiza a foto do perfil
    console.log(`ðŸ“¤ Enviando foto do perfil para API UAZ...`);
    const imageResult = await tenantUazService.updateProfileImage(inst.instance_token, image, proxyConfig);

    if (!imageResult.success) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao atualizar foto do perfil: ' + imageResult.error
      });
    }

    console.log(`âœ… Foto do perfil atualizada com sucesso`);

    res.json({
      success: true,
      message: image === 'remove' || image === 'delete' ? 'Foto do perfil removida com sucesso' : 'Foto do perfil atualizada com sucesso',
      data: imageResult.data
    });
  } catch (error) {
    console.error('âŒ Erro ao atualizar foto do perfil:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/uaz/instances/delete-all
 * Remove TODAS as instÃ¢ncias UAZ (deleta permanentemente da API UAZ tambÃ©m)
 */
router.delete('/instances/delete-all', async (req, res) => {
  try {
    console.log('\nðŸ—‘ï¸ ========================================');
    console.log('ðŸ—‘ï¸ EXCLUINDO TODAS AS INSTÃ‚NCIAS UAZ');
    console.log('ðŸ—‘ï¸ ========================================\n');

    // Busca todas as instÃ¢ncias
    // ðŸ”’ SEGURANÃ‡A: Filtrar por tenant_id
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Tenant nÃ£o identificado'
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
        message: 'Nenhuma instÃ¢ncia para excluir',
        deleted: 0
      });
    }

    console.log(`ðŸ“‹ Total de instÃ¢ncias encontradas: ${instances.length}`);

    // ðŸ”‘ BUSCAR CREDENCIAIS DO TENANT
    const credentials = await getTenantUazapCredentials(tenantId);
    const tenantUazService = new UazService(credentials.serverUrl, credentials.adminToken);

    let deletedFromAPI = 0;
    let failedFromAPI = 0;

    // Deleta cada instÃ¢ncia da API UAZ
    for (const inst of instances) {
      if (inst.instance_token) {
        console.log(`\nðŸ—‘ï¸ Deletando: ${inst.name} (ID: ${inst.id})`);
        
        const proxyConfig = inst.host ? {
          host: inst.host,
          port: inst.port,
          username: inst.username,
          password: inst.password
        } : null;

        const deleteResult = await tenantUazService.deleteInstance(inst.instance_token, proxyConfig);
        
        if (deleteResult.success) {
          console.log(`   âœ… Deletada com sucesso da API UAZ`);
          deletedFromAPI++;
        } else {
          console.warn(`   âš ï¸ Erro ao deletar da API UAZ: ${deleteResult.error}`);
          failedFromAPI++;
        }
      } else {
        console.log(`\n   â„¹ï¸ ${inst.name} (ID: ${inst.id}) - Sem token, pulando API UAZ`);
      }
    }

    // Remove todas as referÃªncias antes de deletar as instÃ¢ncias
    console.log('\nðŸ§¹ Removendo todas as referÃªncias...');
    
    // ðŸ”’ SEGURANÃ‡A: Buscar IDs das instÃ¢ncias do tenant para filtrar
    const instanceIds = instances.map(inst => inst.id);
    
    // 1. Remove apenas de qr_campaign_templates DO TENANT (via instance_id) - usando tenantQuery
    const qrCampaignTemplatesResult = await tenantQuery(req,
      'DELETE FROM qr_campaign_templates WHERE instance_id = ANY($1::int[])',
      [instanceIds]
    );
    console.log(`   â”œâ”€ Removidas ${qrCampaignTemplatesResult.rowCount || 0} referÃªncias em qr_campaign_templates`);
    
    // 2. Atualiza apenas qr_campaign_messages DO TENANT para NULL (preserva histÃ³rico) - usando tenantQuery
    const qrCampaignMessagesResult = await tenantQuery(req,
      'UPDATE qr_campaign_messages SET instance_id = NULL WHERE instance_id = ANY($1::int[])',
      [instanceIds]
    );
    console.log(`   â”œâ”€ Atualizadas ${qrCampaignMessagesResult.rowCount || 0} mensagens em qr_campaign_messages`);
    
    // 3. Deleta todas do banco de dados local DO TENANT (usando tenantQuery para respeitar RLS)
    const deleteResult = await tenantQuery(req, 'DELETE FROM uaz_instances WHERE tenant_id = $1', [tenantId]);
    const deletedLocal = deleteResult.rowCount || 0;

    console.log('\nðŸ“Š ========================================');
    console.log(`ðŸ“Š RESUMO DA EXCLUSÃƒO:`);
    console.log(`   â”œâ”€ Total de instÃ¢ncias: ${instances.length}`);
    console.log(`   â”œâ”€ Deletadas da API UAZ: ${deletedFromAPI}`);
    console.log(`   â”œâ”€ Falhas na API UAZ: ${failedFromAPI}`);
    console.log(`   â””â”€ Removidas do banco local: ${deletedLocal}`);
    console.log('ðŸ“Š ========================================\n');

    res.json({
      success: true,
      message: `${deletedLocal} instÃ¢ncia(s) removida(s) com sucesso`,
      deleted: deletedLocal,
      deletedFromAPI,
      failedFromAPI
    });
  } catch (error) {
    console.error('âŒ Erro ao remover todas as instÃ¢ncias:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/uaz/instances/:id
 * Remove instÃ¢ncia UAZ (deleta permanentemente da API UAZ tambÃ©m)
 */
router.delete('/instances/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Busca a instÃ¢ncia
    // ðŸ”’ SEGURANÃ‡A: Filtrar por tenant_id
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Tenant nÃ£o identificado'
      });
    }
    
    const instance = await tenantQuery(req, 'SELECT * FROM uaz_instances WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    if (instance.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'InstÃ¢ncia nÃ£o encontrada'
      });
    }

    const inst = instance.rows[0];
    
    // ðŸ”‘ BUSCAR CREDENCIAIS DO TENANT
    const credentials = await getTenantUazapCredentials(tenantId);
    const tenantUazService = new UazService(credentials.serverUrl, credentials.adminToken);
    
    // Deleta permanentemente da API UAZ (se tiver token)
    if (inst.instance_token) {
      console.log(`ðŸ—‘ï¸ Deletando instÃ¢ncia ${inst.name} (ID: ${id}) da API UAZ...`);
      
      const deleteResult = await tenantUazService.deleteInstance(inst.instance_token);
      
      if (deleteResult.success) {
        console.log(`âœ… InstÃ¢ncia ${inst.name} deletada com sucesso da API UAZ`);
      } else {
        console.warn(`âš ï¸ Aviso ao deletar da API UAZ: ${deleteResult.error}`);
        console.warn(`   â†’ Continuando com a exclusÃ£o do banco de dados local...`);
      }
    } else {
      console.log(`â„¹ï¸ InstÃ¢ncia ${inst.name} nÃ£o possui token, removendo apenas do banco local`);
    }

    // Remove todas as referÃªncias antes de deletar a instÃ¢ncia
    console.log(`ðŸ§¹ Removendo referÃªncias da instÃ¢ncia ${inst.name}...`);
    
    // 1. Remove de qr_campaign_templates (referÃªncia a instance_id) - usando tenantQuery para RLS
    const qrCampaignTemplatesResult = await tenantQuery(req,
      'DELETE FROM qr_campaign_templates WHERE instance_id = $1',
      [id]
    );
    console.log(`   â”œâ”€ Removidas ${qrCampaignTemplatesResult.rowCount || 0} referÃªncias em qr_campaign_templates`);
    
    // 2. Atualiza qr_campaign_messages para NULL ao invÃ©s de deletar (preserva histÃ³rico)
    const qrCampaignMessagesResult = await tenantQuery(req,
      'UPDATE qr_campaign_messages SET instance_id = NULL WHERE instance_id = $1',
      [id]
    );
    console.log(`   â”œâ”€ Atualizadas ${qrCampaignMessagesResult.rowCount || 0} mensagens em qr_campaign_messages`);
    
    // 3. Remove do banco de dados local (jÃ¡ com tenant_id validado acima)
    await tenantQuery(req, 'DELETE FROM uaz_instances WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    
    console.log(`âœ… InstÃ¢ncia ${inst.name} (ID: ${id}) removida do banco de dados local`);

    res.json({
      success: true,
      message: 'InstÃ¢ncia removida com sucesso da plataforma e do QR Connect'
    });
  } catch (error) {
    console.error('âŒ Erro ao remover instÃ¢ncia:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/uaz/instances/:id/clean-duplicates
 * Limpa duplicatas de uma instÃ¢ncia conectada
 */
router.post('/instances/:id/clean-duplicates', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenant?.id;
    
    if (!tenantId) {
      return res.status(401).json({ success: false, error: 'Tenant nÃ£o identificado' });
    }
    
    console.log('\nðŸ§¹ ========================================');
    console.log('ðŸ§¹ LIMPEZA DE DUPLICATAS - INICIANDO');
    console.log('ðŸ§¹ ========================================');
    console.log('ðŸ“‹ InstÃ¢ncia ID:', id);
    
    // Buscar instÃ¢ncia no banco local
    const localInstance = await tenantQuery(req, `
      SELECT * FROM uaz_instances WHERE id = $1 AND tenant_id = $2
    `, [id, tenantId]);
    
    if (localInstance.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'InstÃ¢ncia nÃ£o encontrada' });
    }
    
    const instance = localInstance.rows[0];
    const phoneNumber = instance.phone_number;
    
    if (!phoneNumber) {
      return res.json({ success: false, error: 'InstÃ¢ncia sem nÃºmero de telefone' });
    }
    
    console.log('ðŸ“± NÃºmero da instÃ¢ncia:', phoneNumber);
    console.log('ðŸ”‘ Token da instÃ¢ncia:', instance.instance_token?.substring(0, 20) + '...');
    
    // Buscar credenciais
    const credentials = await getTenantUazapCredentials(tenantId);
    const tenantUazService = new UazService(credentials.serverUrl, credentials.adminToken);
    
    // Buscar TODAS as instÃ¢ncias na UAZ API
    console.log('ðŸ” Buscando todas as instÃ¢ncias na UAZ API...');
    const fetchResult = await tenantUazService.fetchInstances();
    
    if (!fetchResult.success) {
      return res.json({ success: false, error: 'Falha ao buscar instÃ¢ncias da UAZ API' });
    }
    
    const allInstances = fetchResult.instances || [];
    console.log(`ðŸ“Š Total de instÃ¢ncias na UAZ API: ${allInstances.length}`);
    
    // Procurar duplicatas com o mesmo nÃºmero
    const duplicates = allInstances.filter(uazInst => {
      const uazPhone = uazInst.owner || uazInst.phoneNumber || '';
      const match = phonesMatch(phoneNumber, uazPhone);
      const isDifferent = uazInst.token !== instance.instance_token;
      return match && isDifferent;
    });
    
    console.log(`ðŸ” Duplicatas encontradas: ${duplicates.length}`);
    
    if (duplicates.length === 0) {
      console.log('âœ… Nenhuma duplicata encontrada!');
      console.log('ðŸ§¹ ========================================\n');
      return res.json({ success: true, message: 'Nenhuma duplicata encontrada', deleted: 0 });
    }
    
    // Analisar e tratar duplicatas de acordo com o status
    let deletedCount = 0;
    let keptOldConnected = false;
    
    for (const duplicate of duplicates) {
      const isConnected = duplicate.status === 'connected' || duplicate.state === 'open' || duplicate.connected === true;
      
      console.log('\nðŸ“‹ Duplicata encontrada:');
      console.log('   â””â”€ Token:', duplicate.token?.substring(0, 20) + '...');
      console.log('   â””â”€ Status:', isConnected ? 'ðŸŸ¢ CONECTADA' : 'ðŸ”´ DESCONECTADA');
      console.log('   â””â”€ Nome:', duplicate.name);
      
      if (isConnected) {
        // âœ… CASO 1: Duplicata estÃ¡ CONECTADA
        // REGRA: Deletar a instÃ¢ncia ATUAL e importar a ANTIGA
        console.log('âœ… Duplicata estÃ¡ CONECTADA! Mantendo a antiga e removendo a atual...');
        
        try {
          // 1. Verificar se a duplicata jÃ¡ estÃ¡ no banco local
          const localDuplicate = await tenantQuery(req, `
            SELECT id FROM uaz_instances 
            WHERE instance_token = $1 AND tenant_id = $2
          `, [duplicate.token, tenantId]);
          
          // 2. Se NÃƒO estiver, importar
          if (localDuplicate.rows.length === 0) {
            console.log('ðŸ“¥ Importando instÃ¢ncia conectada para o banco local...');
            
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
            
            console.log('âœ… InstÃ¢ncia conectada importada com sucesso!');
          } else {
            console.log('â„¹ï¸  InstÃ¢ncia conectada jÃ¡ existe no banco local');
          }
          
          // 3. Deletar a instÃ¢ncia ATUAL (nova) do banco local
          console.log('ðŸ—‘ï¸  Deletando instÃ¢ncia atual (nova) do banco local...');
          await tenantQuery(req, `
            DELETE FROM uaz_instances WHERE id = $1 AND tenant_id = $2
          `, [id, tenantId]);
          console.log('âœ… InstÃ¢ncia atual deletada!');
          
          keptOldConnected = true;
          deletedCount++; // Conta como "tratada"
          
        } catch (err) {
          console.error('âŒ Erro ao tratar duplicata conectada:', err.message);
        }
        
      } else {
        // ðŸ—‘ï¸ CASO 2: Duplicata estÃ¡ DESCONECTADA
        // REGRA: Deletar a duplicata antiga e manter a atual
        console.log('ðŸ—‘ï¸  Duplicata estÃ¡ DESCONECTADA! Deletando antiga...');
        
        try {
          // Deletar da UAZ API
          const deleteResult = await tenantUazService.deleteInstance(duplicate.token, null);
          
          if (deleteResult.success) {
            console.log('âœ… Deletada da UAZ API com sucesso!');
            
            // Se estiver no banco local, deletar tambÃ©m
            const localDuplicate = await tenantQuery(req, `
              SELECT id FROM uaz_instances 
              WHERE instance_token = $1 AND tenant_id = $2
            `, [duplicate.token, tenantId]);
            
            if (localDuplicate.rows.length > 0) {
              await tenantQuery(req, `
                DELETE FROM uaz_instances WHERE id = $1 AND tenant_id = $2
              `, [localDuplicate.rows[0].id, tenantId]);
              console.log('âœ… Deletada do banco local tambÃ©m!');
            }
            
            deletedCount++;
          } else {
            console.warn('âš ï¸  Falha ao deletar:', deleteResult.error);
          }
        } catch (err) {
          console.error('âŒ Erro ao deletar duplicata desconectada:', err.message);
        }
      }
    }
    
    console.log(`\nâœ… Limpeza concluÃ­da! ${deletedCount} duplicata(s) tratada(s)`);
    console.log('ðŸ§¹ ========================================\n');
    
    if (keptOldConnected) {
      // Se manteve uma duplicata conectada, a instÃ¢ncia atual foi deletada
      res.json({
        success: true,
        message: 'Duplicata conectada encontrada e mantida. InstÃ¢ncia atual foi removida.',
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
    console.error('âŒ Erro na limpeza de duplicatas:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/uaz/instances/:id/qrcode
 * ObtÃ©m QR Code de uma instÃ¢ncia
 */
router.get('/instances/:id/qrcode', async (req, res) => {
  try {
    const { id } = req.params;

    // ðŸ”’ SEGURANÃ‡A: Obter tenant_id
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        error: 'Tenant nÃ£o identificado'
      });
    }

    // Busca instÃ¢ncia (com validaÃ§Ã£o de tenant, usando tenantQuery para respeitar RLS)
    const instance = await tenantQuery(req, `
      SELECT ui.*, p.host, p.port, p.username, p.password
      FROM uaz_instances ui
      LEFT JOIN proxies p ON ui.proxy_id = p.id
      WHERE ui.id = $1 AND ui.tenant_id = $2
    `, [id, tenantId]);

    if (instance.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'InstÃ¢ncia nÃ£o encontrada'
      });
    }

    const inst = instance.rows[0];

    // Verifica se tem instance_token
    if (!inst.instance_token) {
      return res.status(400).json({
        success: false,
        error: 'InstÃ¢ncia sem token. Recrie a instÃ¢ncia.'
      });
    }

    // ðŸ”‘ BUSCAR CREDENCIAIS DO TENANT
    const credentials = await getTenantUazapCredentials(tenantId);
    const tenantUazService = new UazService(credentials.serverUrl, credentials.adminToken);

    const proxyConfig = inst.host ? {
      host: inst.host,
      port: inst.port,
      username: inst.username,
      password: inst.password
    } : null;

    // ðŸ”— CONFIGURAR WEBHOOK NA UAZ API (antes de obter QR Code)
    try {
      const webhookUrl = inst.webhook_url;
      if (webhookUrl) {
        await tenantUazService.configureWebhook(inst.instance_token, proxyConfig, webhookUrl);
        console.log('âœ… Webhook configurado na UAZ API:', webhookUrl);
      }
    } catch (webhookError) {
      console.warn('âš ï¸ Erro ao configurar webhook (nÃ£o crÃ­tico):', webhookError.message);
    }

    // ObtÃ©m QR Code usando instance_token e credenciais corretas do tenant
    const qrResult = await tenantUazService.getQRCode(inst.instance_token, inst.phone_number, proxyConfig);

    console.log('\nðŸ” ============ VALIDAÃ‡ÃƒO DE CONEXÃƒO ============');
    console.log('ðŸ“‹ InstÃ¢ncia:', inst.name, '(ID:', id, ')');
    
    if (qrResult.success) {
      // VALIDAÃ‡ÃƒO RIGOROSA: MÃºltiplas verificaÃ§Ãµes
      const hasQRCode = qrResult.qrcode && qrResult.qrcode.length > 0;
      const connectedFlag = qrResult.connected === true;
      const loggedInFlag = qrResult.loggedIn === true;
      const instanceState = qrResult.state;
      const instanceStatus = qrResult.data?.instance?.status;
      
      // Considerar vÃ¡lido se:
      // - instance.state Ã© 'open' ou 'connected' OU
      // - instance.status Ã© 'connected' (quando state Ã© undefined)
      const hasValidState = instanceState === 'open' || instanceState === 'connected';
      const hasValidStatus = instanceStatus === 'connected';
      const validSession = hasValidState || hasValidStatus;
      
      // REGRA: Se tem QR code = NÃƒO estÃ¡ conectado (obviamente)
      // REGRA: SÃ³ estÃ¡ conectado se flags E (state OU status) estiverem corretos
      const isConnected = !hasQRCode && (connectedFlag || loggedInFlag) && validSession;
      
      // Status baseado em anÃ¡lise completa
      let status = 'disconnected';
      if (isConnected) {
        status = 'connected';
      } else if (hasQRCode) {
        status = 'connecting'; // Tem QR code = aguardando leitura
      }
      
      console.log('ðŸ“Š AnÃ¡lise:');
      console.log('   â”œâ”€ Tem QR Code:', hasQRCode ? 'âœ… SIM (aguardando leitura)' : 'âŒ NÃƒO');
      console.log('   â”œâ”€ Flag connected:', connectedFlag ? 'âœ…' : 'âŒ');
      console.log('   â”œâ”€ Flag loggedIn:', loggedInFlag ? 'âœ…' : 'âŒ');
      console.log('   â”œâ”€ State:', instanceState || 'nÃ£o informado');
      console.log('   â”œâ”€ Status:', instanceStatus || 'nÃ£o informado');
      console.log('   â”œâ”€ Valid Session:', validSession ? 'âœ…' : 'âŒ');
      console.log('   â””â”€ ðŸŽ¯ DECISÃƒO FINAL:', isConnected ? 'âœ… CONECTADO' : 'âŒ NÃƒO CONECTADO');
      console.log('   â””â”€ ðŸ“Œ STATUS:', status);
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
    
    console.log('âŒ Falha ao obter QR Code:', qrResult.error);
    console.log('============================================\n');

    // ðŸš¨ NOVO COMPORTAMENTO: NÃ£o fazer tratativa no erro 409
    // Apenas retornar o erro para o frontend tentar novamente
    // A tratativa serÃ¡ feita DEPOIS que a conexÃ£o for estabelecida com sucesso
    
    if (qrResult.errorCode === 409) {
      console.log('âš ï¸  ERRO 409 detectado - Retornando para o frontend tentar novamente');
      console.log('   â””â”€ Mensagem:', qrResult.error);
      console.log('   â””â”€ O frontend vai aguardar e tentar de novo atÃ© conseguir conectar');
      console.log('   â””â”€ Tratativa de duplicatas serÃ¡ feita APÃ“S a conexÃ£o ser estabelecida\n');
    }

    // Retorna o erro para o frontend lidar (retry automÃ¡tico)
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
 * ForÃ§a logout/desconexÃ£o de uma instÃ¢ncia
 */
router.post('/instances/:id/logout', async (req, res) => {
  try {
    const { id } = req.params;

    // ðŸ”’ SEGURANÃ‡A: Obter tenant_id
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        error: 'Tenant nÃ£o identificado'
      });
    }

    // Busca instÃ¢ncia usando tenantQuery para RLS
    const instance = await tenantQuery(req, `
      SELECT ui.*, p.host, p.port, p.username, p.password
      FROM uaz_instances ui
      LEFT JOIN proxies p ON ui.proxy_id = p.id
      WHERE ui.id = $1 AND ui.tenant_id = $2
    `, [id, tenantId]);

    if (instance.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'InstÃ¢ncia nÃ£o encontrada'
      });
    }

    const inst = instance.rows[0];

    if (!inst.instance_token) {
      return res.status(400).json({
        success: false,
        error: 'InstÃ¢ncia sem token. Recrie a instÃ¢ncia.'
      });
    }

    const proxyConfig = inst.host ? {
      host: inst.host,
      port: inst.port,
      username: inst.username,
      password: inst.password
    } : null;

    // ðŸ”‘ BUSCAR CREDENCIAIS DO TENANT
    const credentials = await getTenantUazapCredentials(tenantId);
    const tenantUazService = new UazService(credentials.serverUrl, credentials.adminToken);

    console.log('\nðŸ”Œ ============ FORÃ‡ANDO LOGOUT ============');
    console.log('ðŸ“‹ InstÃ¢ncia:', inst.name, '(ID:', id, ')');

    // Tenta fazer logout na API UAZ
    const logoutResult = await tenantUazService.logout(inst.instance_token, proxyConfig);

    console.log('ðŸ“Š Resultado do logout:', logoutResult);
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

    console.log('âœ… InstÃ¢ncia desconectada e resetada no banco de dados');
    console.log('============================================\n');

    res.json({
      success: true,
      message: 'InstÃ¢ncia desconectada com sucesso',
      data: logoutResult
    });

  } catch (error) {
    console.error('âŒ Erro ao fazer logout:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/uaz/instances/:id/status
 * Verifica status de conexÃ£o da instÃ¢ncia
 */
router.get('/instances/:id/status', async (req, res) => {
  try {
    const { id } = req.params;

    // ðŸ”’ SEGURANÃ‡A: Obter tenant_id
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        error: 'Tenant nÃ£o identificado'
      });
    }

    // ðŸ”‘ Buscar instÃ¢ncia com credenciais corretas
    const { instance: inst, credentials, uazService: tenantUazService, proxyConfig } = await getInstanceWithCredentials(id, tenantId);

    if (!inst.instance_token) {
      return res.status(400).json({
        success: false,
        error: 'InstÃ¢ncia sem token. Recrie a instÃ¢ncia.'
      });
    }

    // Verifica status usando instance_token e credenciais corretas DA INSTÃ‚NCIA
    const statusResult = await tenantUazService.getStatus(inst.instance_token, proxyConfig);

    console.log('\nðŸ” ============ VERIFICAÃ‡ÃƒO DE STATUS ============');
    console.log('ðŸ“‹ InstÃ¢ncia:', inst.name, '(ID:', id, ')');

    if (statusResult.success) {
      // VALIDAÃ‡ÃƒO RIGOROSA: uazService jÃ¡ faz a validaÃ§Ã£o, usar o resultado dele
      const isConnected = statusResult.connected === true;
      
      // DEBUG: Verificando onde estÃ¡ o nÃºmero de telefone
      console.log('ðŸ“ž ========== DEBUG NÃšMERO DE TELEFONE ==========');
      console.log('ðŸ” statusResult.data?.jid:', JSON.stringify(statusResult.data?.jid, null, 2));
      console.log('ðŸ” statusResult.data?.status?.jid:', statusResult.data?.status?.jid);
      console.log('ðŸ” statusResult.data?.instance?.owner:', statusResult.data?.instance?.owner);
      console.log('ðŸ” statusResult.data?.phone:', statusResult.data?.phone);
      console.log('ðŸ” statusResult.data?.instance?.wid:', JSON.stringify(statusResult.data?.instance?.wid, null, 2));
      console.log('ðŸ” statusResult.data?.instance?.number:', statusResult.data?.instance?.number);
      console.log('ðŸ” inst.phone_number (banco):', inst.phone_number);
      
      // FunÃ§Ã£o auxiliar para extrair nÃºmero do JID (formato: "5511999999999:3@s.whatsapp.net")
      const extractPhoneFromJid = (jid) => {
        if (!jid) return null;
        // JID pode ser: "5511999999999:3@s.whatsapp.net" ou "5511999999999@s.whatsapp.net"
        const match = jid.match(/^(\d+)/);
        return match ? match[1] : null;
      };
      
      // NÃºmero de telefone pode estar em vÃ¡rios lugares dependendo da versÃ£o da API
      let phoneNumber = null;
      
      // 1. Tenta extrair do owner (campo mais confiÃ¡vel nesta API)
      phoneNumber = statusResult.data?.instance?.owner;
      
      // 2. Se nÃ£o encontrou, tenta extrair do JID no status
      if (!phoneNumber && statusResult.data?.status?.jid) {
        phoneNumber = extractPhoneFromJid(statusResult.data.status.jid);
      }
      
      // 3. Se nÃ£o encontrou, tenta extrair do JID no root
      if (!phoneNumber && statusResult.data?.jid) {
        phoneNumber = extractPhoneFromJid(statusResult.data.jid);
      }
      
      // 4. Outras tentativas (outras versÃµes da API)
      if (!phoneNumber) {
        phoneNumber = statusResult.data?.instance?.wid?.user ||
                     statusResult.data?.instance?.number ||
                     statusResult.data?.phone ||
                     inst.phone_number;
      }
      
      console.log('ðŸŽ¯ NÃšMERO FINAL EXTRAÃDO:', phoneNumber);
      console.log('==============================================\n');
      
      // Busca profileName e profilePicUrl de acordo com a documentaÃ§Ã£o UAZ API
      // O profileName estÃ¡ em: statusResult.data.instance.profileName
      // O profilePicUrl estÃ¡ em: statusResult.data.instance.profilePicUrl
      let profileName = null;
      let profilePicUrl = null;
      if (statusResult.data) {
        // Primeiro tenta buscar no lugar correto (documentaÃ§Ã£o oficial)
        profileName = statusResult.data.instance?.profileName || null;
        profilePicUrl = statusResult.data.instance?.profilePicUrl || null;
        
        console.log('ðŸ” DEBUG - Estrutura completa de statusResult.data.instance:');
        console.log(JSON.stringify(statusResult.data.instance, null, 2));
        console.log('ðŸ” DEBUG - profileName extraÃ­do:', profileName);
        console.log('ðŸ” DEBUG - profilePicUrl extraÃ­do:', profilePicUrl);
      }
      
      // Status baseado na validaÃ§Ã£o rigorosa
      let statusState = 'disconnected';
      if (isConnected) {
        statusState = 'connected';
      } else if (statusResult.qrcode && statusResult.qrcode.length > 0) {
        statusState = 'connecting';
      }

      console.log('ðŸ“Š Resultado:');
      console.log('   â”œâ”€ Conectado:', isConnected ? 'âœ… SIM' : 'âŒ NÃƒO');
      console.log('   â”œâ”€ Status:', statusState);
      console.log('   â”œâ”€ Telefone:', phoneNumber || 'nÃ£o informado');
      console.log('   â”œâ”€ Nome do Perfil:', profileName || 'nÃ£o informado');
      console.log('   â””â”€ Foto do Perfil:', profilePicUrl || 'nÃ£o informada');
      console.log('ðŸ” DEBUG - statusResult.data completo:', JSON.stringify(statusResult.data, null, 2));
      console.log('============================================\n');

      // âœ… Usando tenantQuery para respeitar RLS e garantir tenant correto
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

      // ðŸ” VERIFICAÃ‡ÃƒO DE DUPLICAÃ‡ÃƒO AUTOMÃTICA
      // Se acabou de conectar E tem nÃºmero, verificar se jÃ¡ existe em outra instÃ¢ncia
      if (isConnected && phoneNumber && !inst.phone_number) {
        console.log('\nðŸ” ========================================');
        console.log('ðŸ” VERIFICANDO DUPLICAÃ‡ÃƒO DE NÃšMERO');
        console.log('ðŸ” ========================================');
        console.log('ðŸ“± NÃºmero detectado:', phoneNumber);
        console.log('ðŸ†” InstÃ¢ncia NOVA (acabou de conectar):', inst.name, '(ID:', id, ')');
        
        try {
          // Buscar todas as instÃ¢ncias da UAZ API
          const fetchResult = await uazService.fetchInstances(proxyConfig);
          
          if (fetchResult.success && fetchResult.instances.length > 0) {
            // Procurar se este nÃºmero jÃ¡ existe em OUTRA instÃ¢ncia (conectada OU desconectada)
            const instanciaDuplicada = fetchResult.instances.find(i => 
              i.owner === phoneNumber && 
              i.token !== inst.instance_token
            );
            
            if (instanciaDuplicada) {
              console.log('\nâš ï¸  ========================================');
              console.log('âš ï¸  DUPLICAÃ‡ÃƒO DETECTADA!');
              console.log('âš ï¸  ========================================');
              console.log('ðŸ“± NÃºmero:', phoneNumber);
              console.log('ðŸ“¦ InstÃ¢ncia NOVA:', inst.name, '(ID:', id, ') - Status: CONECTADA');
              console.log('ðŸ“¦ InstÃ¢ncia ANTIGA:', instanciaDuplicada.name, '(Token:', instanciaDuplicada.token?.substring(0, 20) + '...) - Status:', instanciaDuplicada.status.toUpperCase());
              
              // ðŸŽ¯ DECISÃƒO INTELIGENTE: Qual instÃ¢ncia manter?
              const antigaEstaConectada = instanciaDuplicada.status === 'connected';
              
              if (antigaEstaConectada) {
                // âœ… CASO 1: InstÃ¢ncia ANTIGA estÃ¡ CONECTADA â†’ Manter ANTIGA, deletar NOVA
                console.log('\nðŸ’¡ DECISÃƒO: InstÃ¢ncia ANTIGA estÃ¡ CONECTADA');
                console.log('   â”œâ”€ âœ… MANTER: InstÃ¢ncia ANTIGA (jÃ¡ estÃ¡ funcionando)');
                console.log('   â””â”€ âŒ DELETAR: InstÃ¢ncia NOVA (duplicada)');
                
                // 1ï¸âƒ£ DELETAR a instÃ¢ncia NOVA da UAZ API
                console.log('\nðŸ—‘ï¸  Deletando instÃ¢ncia NOVA da UAZ API...');
                const deleteResult = await uazService.deleteInstance(inst.instance_token, proxyConfig);
                
                if (deleteResult.success) {
                  console.log('   âœ… InstÃ¢ncia NOVA deletada da UAZ API');
                } else {
                  console.warn('   âš ï¸  Erro ao deletar da UAZ API:', deleteResult.error);
                }
                
                // 2ï¸âƒ£ DELETAR a instÃ¢ncia NOVA do banco local (COM filtro de tenant)
                console.log('ðŸ—‘ï¸  Deletando instÃ¢ncia NOVA do banco local...');
                await tenantQuery(req, 'DELETE FROM uaz_instances WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
                console.log('   âœ… InstÃ¢ncia NOVA deletada do banco local');
                
                // 3ï¸âƒ£ VERIFICAR se a instÃ¢ncia ANTIGA jÃ¡ estÃ¡ no banco (usando tenantQuery para respeitar RLS)
                const existenteNoBanco = await tenantQuery(req,
                  'SELECT id FROM uaz_instances WHERE instance_token = $1 AND tenant_id = $2',
                  [instanciaDuplicada.token, tenantId]
                );
                
                if (existenteNoBanco.rows.length === 0) {
                  // 4ï¸âƒ£ IMPORTAR a instÃ¢ncia ANTIGA (usando tenantQuery para respeitar RLS)
                  console.log('ðŸ“¥ Importando instÃ¢ncia ANTIGA para o banco local...');
                  
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
                  
                  console.log('   âœ… InstÃ¢ncia ANTIGA importada! Novo ID:', instanciaImportada.id);
                  console.log('========================================\n');
                  
                  // 5ï¸âƒ£ RETORNAR indicaÃ§Ã£o de que houve importaÃ§Ã£o
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
                    message: `âœ… NÃºmero jÃ¡ existente e CONECTADO detectado! Mantivemos a instÃ¢ncia original: ${instanciaImportada.name}`
                  });
                } else {
                  console.log('   â„¹ï¸  InstÃ¢ncia ANTIGA jÃ¡ estÃ¡ no banco (ID:', existenteNoBanco.rows[0].id, ')');
                  console.log('========================================\n');
                  
                  return res.json({
                    ...statusResult,
                    duplicateDetected: true,
                    action: 'kept_old_connected',
                    existingInstance: {
                      id: existenteNoBanco.rows[0].id
                    },
                    message: `âœ… NÃºmero jÃ¡ existente e CONECTADO detectado! A instÃ¢ncia original jÃ¡ estava cadastrada.`
                  });
                }
              } else {
                // âœ… CASO 2: InstÃ¢ncia ANTIGA estÃ¡ DESCONECTADA â†’ Manter NOVA, deletar ANTIGA
                console.log('\nðŸ’¡ DECISÃƒO: InstÃ¢ncia ANTIGA estÃ¡ DESCONECTADA');
                console.log('   â”œâ”€ âœ… MANTER: InstÃ¢ncia NOVA (acabou de conectar)');
                console.log('   â””â”€ âŒ DELETAR: InstÃ¢ncia ANTIGA (nÃ£o estÃ¡ funcionando)');
                
                // 1ï¸âƒ£ DELETAR a instÃ¢ncia ANTIGA da UAZ API
                console.log('\nðŸ—‘ï¸  Deletando instÃ¢ncia ANTIGA da UAZ API...');
                const deleteResult = await uazService.deleteInstance(instanciaDuplicada.token, proxyConfig);
                
                if (deleteResult.success) {
                  console.log('   âœ… InstÃ¢ncia ANTIGA deletada da UAZ API');
                } else {
                  console.warn('   âš ï¸  Erro ao deletar da UAZ API:', deleteResult.error);
                }
                
                // 2ï¸âƒ£ DELETAR a instÃ¢ncia ANTIGA do banco local (se existir) - COM filtro de tenant (usando tenantQuery para respeitar RLS)
                console.log('ðŸ—‘ï¸  Verificando se instÃ¢ncia ANTIGA existe no banco local...');
                const antigaNoBanco = await tenantQuery(req,
                  'SELECT id FROM uaz_instances WHERE instance_token = $1 AND tenant_id = $2',
                  [instanciaDuplicada.token, tenantId]
                );
                
                if (antigaNoBanco.rows.length > 0) {
                  await tenantQuery(req, 'DELETE FROM uaz_instances WHERE instance_token = $1 AND tenant_id = $2', [instanciaDuplicada.token, tenantId]);
                  console.log('   âœ… InstÃ¢ncia ANTIGA deletada do banco local (ID:', antigaNoBanco.rows[0].id, ')');
                } else {
                  console.log('   â„¹ï¸  InstÃ¢ncia ANTIGA nÃ£o estava no banco local');
                }
                
                console.log('âœ… InstÃ¢ncia NOVA mantida! ID:', id);
                console.log('========================================\n');
                
                // 3ï¸âƒ£ RETORNAR indicaÃ§Ã£o de que a nova foi mantida
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
                  message: `âœ… NÃºmero jÃ¡ existente mas DESCONECTADO detectado! Mantivemos a nova conexÃ£o e removemos a antiga.`
                });
              }
            } else {
              console.log('âœ… Nenhuma duplicaÃ§Ã£o encontrada. NÃºmero Ãºnico!');
              console.log('========================================\n');
            }
          }
        } catch (error) {
          console.error('âŒ Erro ao verificar duplicaÃ§Ã£o:', error.message);
          // NÃ£o bloquear o fluxo, apenas logar o erro
        }
      }

      // Retorna os dados com profile_name e profile_pic_url incluÃ­dos explicitamente
      res.json({
        ...statusResult,
        profile_name: profileName,
        profile_pic_url: profilePicUrl,
        phone_number: phoneNumber
      });
    } else {
      console.log('âŒ Erro ao verificar status:', statusResult.error);
      console.log('============================================\n');
      
      // Se o erro for "Invalid token", marcar a instÃ¢ncia como desconectada no banco
      if (statusResult.error && statusResult.error.toLowerCase().includes('invalid token')) {
        console.log('âš ï¸ Token invÃ¡lido detectado! Marcando instÃ¢ncia como desconectada no banco...');
        // âœ… Usando tenantQuery para respeitar RLS e garantir tenant correto
        await tenantQuery(req, `
          UPDATE uaz_instances 
          SET is_connected = false,
              status = 'disconnected',
              updated_at = NOW()
          WHERE id = $1 AND tenant_id = $2
        `, [id, tenantId]);
        console.log('âœ… InstÃ¢ncia marcada como desconectada no banco de dados');
      }
      
      res.json(statusResult);
    }
  } catch (error) {
    console.error('âŒ Erro ao verificar status da instÃ¢ncia:', error);
    console.error('   â””â”€ Stack:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.stack
    });
  }
});

/**
 * POST /api/uaz/instances/:id/disconnect
 * Desconecta instÃ¢ncia
 */
router.post('/instances/:id/disconnect', async (req, res) => {
  try {
    const { id } = req.params;
    
    // ðŸ”’ SEGURANÃ‡A: Filtrar por tenant_id
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Tenant nÃ£o identificado'
      });
    }

    const instance = await tenantQuery(req, 'SELECT * FROM uaz_instances WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    if (instance.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'InstÃ¢ncia nÃ£o encontrada'
      });
    }

    const inst = instance.rows[0];
    if (!inst.instance_token) {
      return res.status(400).json({
        success: false,
        error: 'InstÃ¢ncia sem token. Recrie a instÃ¢ncia.'
      });
    }

    // ðŸ”‘ BUSCAR CREDENCIAIS DO TENANT
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
 * Ativa ou desativa uma instÃ¢ncia (pausa/retoma)
 * 
 * âš ï¸ IMPORTANTE: Quando pausar, a instÃ¢ncia Ã© tratada como DESCONECTADA nas campanhas
 * âš ï¸ Quando despausar, ela Ã© automaticamente REATIVADA nas campanhas
 */
router.post('/instances/:id/toggle-active', async (req, res) => {
  try {
    const { id } = req.params;
    
    // ðŸ”’ SEGURANÃ‡A: Filtrar por tenant_id
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Tenant nÃ£o identificado'
      });
    }

    // Busca instÃ¢ncia atual
    const instance = await tenantQuery(req, 'SELECT * FROM uaz_instances WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    if (instance.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'InstÃ¢ncia nÃ£o encontrada'
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

    console.log(`${newActiveState ? 'â–¶ï¸' : 'â¸ï¸'} InstÃ¢ncia ${inst.name} (ID: ${id}) ${newActiveState ? 'ativada' : 'pausada'}`);

    // ðŸ”„ DESATIVAR templates nas campanhas ATIVAS quando PAUSAR a instÃ¢ncia
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
        console.log(`   âš ï¸  ${totalDeactivated} template(s) desativado(s) nas campanhas ativas`);
      }
    }

    // âœ… REATIVAR templates quando DESPAUSAR (serÃ¡ feito automaticamente pelo worker via checkAndReactivateInstances)
    if (newActiveState) {
      console.log(`   âœ… Templates serÃ£o reativados automaticamente nas campanhas ativas`);
    }

    res.json({
      success: true,
      is_active: newActiveState,
      message: newActiveState 
        ? 'InstÃ¢ncia ativada com sucesso. Templates serÃ£o reativados nas campanhas.' 
        : 'InstÃ¢ncia pausada com sucesso. Templates foram desativados nas campanhas.'
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
 * Pausa todas as instÃ¢ncias
 * 
 * âš ï¸ IMPORTANTE: Todas as instÃ¢ncias sÃ£o tratadas como DESCONECTADAS nas campanhas
 */
router.post('/instances/pause-all', async (req, res) => {
  try {
    // ðŸ”’ SEGURANÃ‡A: Filtrar por tenant_id
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(401).json({ success: false, error: 'Tenant nÃ£o identificado' });
    }
    
    const result = await tenantQuery(req, `
      UPDATE uaz_instances 
      SET is_active = false,
          updated_at = NOW()
      WHERE is_active = true AND tenant_id = $1
      RETURNING id, name
    `, [tenantId]);

    console.log(`â¸ï¸ ${result.rows.length} instÃ¢ncia(s) pausada(s)`);

    // ðŸ”„ DESATIVAR todos os templates nas campanhas ATIVAS
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
      console.log(`   âš ï¸  ${totalDeactivated} template(s) desativado(s) nas campanhas ativas`);
    }
    
    res.json({
      success: true,
      paused_count: result.rows.length,
      deactivated_templates: totalDeactivated,
      instances: result.rows,
      message: `${result.rows.length} instÃ¢ncia(s) pausada(s). ${totalDeactivated} template(s) desativados nas campanhas.`
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
 * Ativa todas as instÃ¢ncias
 * 
 * âœ… Templates serÃ£o automaticamente REATIVADOS nas campanhas pelo worker
 */
router.post('/instances/activate-all', async (req, res) => {
  try {
    // ðŸ”’ SEGURANÃ‡A: Filtrar por tenant_id
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(401).json({ success: false, error: 'Tenant nÃ£o identificado' });
    }
    
    const result = await tenantQuery(req, `
      UPDATE uaz_instances 
      SET is_active = true,
          updated_at = NOW()
      WHERE is_active = false AND tenant_id = $1
      RETURNING id, name
    `, [tenantId]);

    console.log(`â–¶ï¸ ${result.rows.length} instÃ¢ncia(s) ativada(s)`);
    console.log(`   âœ… Templates serÃ£o reativados automaticamente nas campanhas ativas`);
    
    res.json({
      success: true,
      activated_count: result.rows.length,
      instances: result.rows,
      message: `${result.rows.length} instÃ¢ncia(s) ativada(s). Templates serÃ£o reativados nas campanhas.`
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
 * Desativa mÃºltiplas instÃ¢ncias selecionadas
 */
router.post('/instances/deactivate-multiple', async (req, res) => {
  try {
    const { instance_ids } = req.body;
    
    if (!instance_ids || !Array.isArray(instance_ids) || instance_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'instance_ids deve ser um array nÃ£o-vazio'
      });
    }

    console.log(`â¸ï¸ Desativando instÃ¢ncias:`, instance_ids);

    // Converter para nÃºmeros para garantir
    const ids = instance_ids.map(id => parseInt(id, 10));

    const result = await tenantQuery(req, `
      UPDATE uaz_instances 
      SET is_active = false,
          updated_at = NOW()
      WHERE id = ANY($1::int[])
      RETURNING id, name
    `, [ids]);

    console.log(`â¸ï¸ ${result.rows.length} instÃ¢ncia(s) desativada(s)`);

    // Desativar templates nas campanhas (com try-catch para nÃ£o quebrar se a tabela nÃ£o existir)
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
      console.log(`   ðŸ“Š ${totalDeactivated} template(s) desativados nas campanhas ativas`);
    } catch (campErr) {
      console.log(`   â„¹ï¸ Campanhas nÃ£o disponÃ­veis ou jÃ¡ desativadas`);
    }

    res.json({
      success: true,
      deactivated_count: result.rows.length,
      deactivated_templates: totalDeactivated,
      instances: result.rows,
      message: `${result.rows.length} instÃ¢ncia(s) desativada(s). ${totalDeactivated} template(s) desativados nas campanhas.`
    });
  } catch (error) {
    console.error('âŒ Erro ao desativar instÃ¢ncias:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/uaz/instances/deactivate-all
 * Desativa todas as instÃ¢ncias
 */
router.post('/instances/deactivate-all', async (req, res) => {
  try {
    console.log(`â¸ï¸ Desativando TODAS as instÃ¢ncias`);

    const result = await tenantQuery(req, `
      UPDATE uaz_instances 
      SET is_active = false,
          updated_at = NOW()
      RETURNING id, name
    `);

    console.log(`â¸ï¸ ${result.rows.length} instÃ¢ncia(s) desativada(s)`);

    // Desativar todos os templates nas campanhas (com try-catch para nÃ£o quebrar)
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
      console.log(`   ðŸ“Š ${totalDeactivated} template(s) desativados nas campanhas ativas`);
    } catch (campErr) {
      console.log(`   â„¹ï¸ Campanhas nÃ£o disponÃ­veis ou jÃ¡ desativadas`);
    }

    res.json({
      success: true,
      deactivated_count: result.rows.length,
      deactivated_templates: totalDeactivated,
      instances: result.rows,
      message: `${result.rows.length} instÃ¢ncia(s) desativada(s). ${totalDeactivated} template(s) desativados nas campanhas.`
    });
  } catch (error) {
    console.error('âŒ Erro ao desativar todas as instÃ¢ncias:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/uaz/instances/activate-multiple
 * Ativa mÃºltiplas instÃ¢ncias selecionadas
 */
router.post('/instances/activate-multiple', async (req, res) => {
  try {
    const { instance_ids } = req.body;
    
    if (!instance_ids || !Array.isArray(instance_ids) || instance_ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'instance_ids deve ser um array nÃ£o vazio'
      });
    }

    console.log(`âœ… Ativando instÃ¢ncias:`, instance_ids);

    // Converter para nÃºmeros para garantir
    const ids = instance_ids.map(id => parseInt(id, 10));

    const result = await tenantQuery(req, `
      UPDATE uaz_instances
      SET is_active = true, updated_at = NOW()
      WHERE id = ANY($1::int[])
      RETURNING id, name
    `, [ids]);

    console.log(`âœ… ${result.rows.length} instÃ¢ncia(s) ativada(s)`);

    res.json({
      success: true,
      count: result.rows.length,
      message: `${result.rows.length} instÃ¢ncia(s) ativada(s) com sucesso`
    });
  } catch (error) {
    console.error('âŒ Erro ao ativar instÃ¢ncias:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao ativar instÃ¢ncias',
      error: error.message
    });
  }
});

/**
 * POST /api/uaz/instances/activate-all
 * Ativa todas as instÃ¢ncias
 */
router.post('/instances/activate-all', async (req, res) => {
  try {
    console.log(`âœ… Ativando TODAS as instÃ¢ncias`);

    const result = await tenantQuery(req, `
      UPDATE uaz_instances
      SET is_active = true, updated_at = NOW()
      RETURNING id, name
    `);

    console.log(`âœ… ${result.rows.length} instÃ¢ncia(s) ativada(s)`);

    res.json({
      success: true,
      count: result.rows.length,
      message: `${result.rows.length} instÃ¢ncia(s) ativada(s) com sucesso`
    });
  } catch (error) {
    console.error('âŒ Erro ao ativar todas as instÃ¢ncias:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao ativar instÃ¢ncias',
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
        error: 'Tenant nÃ£o identificado'
      });
    }

    if (!number || !text) {
      return res.status(400).json({
        success: false,
        error: 'NÃºmero e texto sÃ£o obrigatÃ³rios'
      });
    }

    // Busca instÃ¢ncia (usando tenantQuery para RLS)
    const instance = await tenantQuery(req, `
      SELECT ui.*, p.host, p.port, p.username, p.password
      FROM uaz_instances ui
      LEFT JOIN proxies p ON ui.proxy_id = p.id
      WHERE ui.id = $1 AND ui.tenant_id = $2
    `, [id, tenantId]);

    if (instance.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'InstÃ¢ncia nÃ£o encontrada'
      });
    }

    const inst = instance.rows[0];
    
    if (!inst.instance_token) {
      return res.status(400).json({
        success: false,
        error: 'InstÃ¢ncia sem token. Recrie a instÃ¢ncia.'
      });
    }
    
    // â¸ï¸ VALIDAÃ‡ÃƒO: Verifica se a instÃ¢ncia estÃ¡ ativa (nÃ£o pausada)
    if (!inst.is_active) {
      console.log(`â¸ï¸ Tentativa de envio bloqueada - InstÃ¢ncia ${inst.name} (ID: ${id}) estÃ¡ PAUSADA`);
      return res.status(400).json({
        success: false,
        error: 'â¸ï¸ ConexÃ£o pausada. Ative a conexÃ£o nas configuraÃ§Ãµes para enviar mensagens.'
      });
    }
    
    if (!inst.is_connected) {
      return res.status(400).json({
        success: false,
        error: 'InstÃ¢ncia nÃ£o estÃ¡ conectada'
      });
    }

    // ðŸš¨ VERIFICAR LISTA DE RESTRIÃ‡ÃƒO (ENVIO ÃšNICO QR)
    console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
    console.log('ðŸ” VERIFICANDO LISTA DE RESTRIÃ‡ÃƒO (ENVIO ÃšNICO QR)');
    console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
    console.log('   ðŸ“ž NÃºmero:', number);
    console.log('   ðŸ“± InstÃ¢ncia ID:', id);
    console.log('   ðŸ¢ Tenant ID:', tenantId);
    
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
        const listNames = detail.list_names?.join(', ') || 'Lista de RestriÃ§Ã£o';
        const types = detail.types || [];
        
        console.log('ðŸš« â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
        console.log('ðŸš« NÃšMERO BLOQUEADO - ESTÃ NA LISTA DE RESTRIÃ‡ÃƒO!');
        console.log('ðŸš« â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
        console.log('   ðŸ“ Listas:', listNames);
        console.log('   ðŸ·ï¸  Tipos:', types.join(', '));
        console.log('   ðŸ“ž NÃºmero:', number);
        console.log('   âŒ ENVIO CANCELADO!');
        console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•\n');
        
        return res.status(403).json({
          success: false,
          error: 'NÃºmero bloqueado',
          message: `Este nÃºmero estÃ¡ na lista de restriÃ§Ã£o: ${listNames}`,
          details: {
            lists: listNames,
            types: types,
            restricted: true
          }
        });
      }
      
      console.log('   âœ… NÃºmero livre - Prosseguindo com envio');
      console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•\n');
    } catch (error) {
      console.error('âŒ Erro ao verificar lista de restriÃ§Ã£o:', error);
      // âš ï¸ Por seguranÃ§a, se der erro na verificaÃ§Ã£o, bloqueamos o envio
      return res.status(500).json({
        success: false,
        error: 'Erro ao verificar lista de restriÃ§Ã£o - Envio bloqueado por seguranÃ§a',
        details: error.message
      });
    }

    const proxyConfig = inst.host ? {
      host: inst.host,
      port: inst.port,
      username: inst.username,
      password: inst.password
    } : null;

    // ðŸ”‘ BUSCAR CREDENCIAIS DO TENANT
    const credentials = await getTenantUazapCredentials(tenantId);
    const tenantUazService = new UazService(credentials.serverUrl, credentials.adminToken);

    // ðŸ”¤ SUBSTITUIR VARIÃVEIS AUTOMÃTICAS NO TEXTO
    console.log('ðŸ” [DEBUG] Texto original recebido:', text);
    let processedText = processAutoVariables(text);
    console.log('ðŸ” [DEBUG] Texto apÃ³s variÃ¡veis automÃ¡ticas:', processedText);
    
    // ðŸ”¤ SUBSTITUIR VARIÃVEIS PERSONALIZADAS (se fornecidas)
    if (variables && Object.keys(variables).length > 0) {
      console.log('ðŸ”¤ [DEBUG] VariÃ¡veis personalizadas recebidas:', variables);
      processedText = replaceVariables(processedText, variables);
      console.log('ðŸ”¤ [DEBUG] Texto apÃ³s variÃ¡veis personalizadas:', processedText);
    }

    // Envia mensagem usando instance_token (com texto processado)
    const sendResult = await tenantUazService.sendText(inst.instance_token, {
      number,
      text: processedText,
      ...options
    }, proxyConfig);

    // Salva no histÃ³rico (com texto processado)
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
        error: 'Tenant nÃ£o identificado'
      });
    }

    if (!number || !image) {
      return res.status(400).json({
        success: false,
        error: 'NÃºmero e imagem sÃ£o obrigatÃ³rios'
      });
    }

    // Busca instÃ¢ncia (usando tenantQuery para RLS)
    const instance = await tenantQuery(req, `
      SELECT ui.*, p.host, p.port, p.username, p.password
      FROM uaz_instances ui
      LEFT JOIN proxies p ON ui.proxy_id = p.id
      WHERE ui.id = $1 AND ui.tenant_id = $2
    `, [id, tenantId]);

    if (instance.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'InstÃ¢ncia nÃ£o encontrada'
      });
    }

    const inst = instance.rows[0];
    
    if (!inst.instance_token) {
      return res.status(400).json({
        success: false,
        error: 'InstÃ¢ncia sem token. Recrie a instÃ¢ncia.'
      });
    }
    
    // â¸ï¸ VALIDAÃ‡ÃƒO: Verifica se a instÃ¢ncia estÃ¡ ativa (nÃ£o pausada)
    if (!inst.is_active) {
      console.log(`â¸ï¸ Tentativa de envio bloqueada - InstÃ¢ncia ${inst.name} (ID: ${id}) estÃ¡ PAUSADA`);
      return res.status(400).json({
        success: false,
        error: 'â¸ï¸ ConexÃ£o pausada. Ative a conexÃ£o nas configuraÃ§Ãµes para enviar mensagens.'
      });
    }
    
    if (!inst.is_connected) {
      return res.status(400).json({
        success: false,
        error: 'InstÃ¢ncia nÃ£o estÃ¡ conectada'
      });
    }

    // ðŸš¨ VERIFICAR LISTA DE RESTRIÃ‡ÃƒO (ENVIO ÃšNICO QR - IMAGEM)
    console.log('ðŸ” VERIFICANDO LISTA DE RESTRIÃ‡ÃƒO (ENVIO IMAGEM QR)');
    console.log('   ðŸ“ž NÃºmero:', number);
    
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
        const listNames = detail.list_names?.join(', ') || 'Lista de RestriÃ§Ã£o';
        
        console.log('ðŸš« NÃšMERO BLOQUEADO - Lista:', listNames);
        
        return res.status(403).json({
          success: false,
          error: 'NÃºmero bloqueado',
          message: `Este nÃºmero estÃ¡ na lista de restriÃ§Ã£o: ${listNames}`,
          details: { lists: listNames, restricted: true }
        });
      }
      
      console.log('   âœ… NÃºmero livre\n');
    } catch (error) {
      console.error('âŒ Erro ao verificar lista de restriÃ§Ã£o:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao verificar lista de restriÃ§Ã£o - Envio bloqueado por seguranÃ§a'
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

    // ðŸ”‘ BUSCAR CREDENCIAIS DO TENANT
    const credentials = await getTenantUazapCredentials(tenantId);
    const tenantUazService = new UazService(credentials.serverUrl, credentials.adminToken);

    // ðŸ”¤ SUBSTITUIR VARIÃVEIS AUTOMÃTICAS NO CAPTION (se houver)
    let processedCaption = processAutoVariables(caption || '');
    
    // ðŸ”¤ SUBSTITUIR VARIÃVEIS PERSONALIZADAS NO CAPTION (se fornecidas)
    const { variables } = req.body;
    if (variables && Object.keys(variables).length > 0) {
      console.log('ðŸ”¤ [DEBUG] Substituindo variÃ¡veis personalizadas no caption da imagem:', variables);
      processedCaption = replaceVariables(processedCaption, variables);
    }

    // Envia imagem usando o endpoint correto /send/media
    console.log('ðŸ“¤ Enviando imagem via UAZ API...', {
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

    console.log('âœ… Resultado do envio:', sendResult);

    // Salva no histÃ³rico (com caption processado)
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
 * Envia mensagem com vÃ­deo
 */
router.post('/instances/:id/send-video', checkMessageLimit, async (req, res) => {
  try {
    const { id } = req.params;
    const { number, video, caption } = req.body;
    const tenantId = req.tenant?.id || req.user?.tenantId;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'Tenant nÃ£o identificado'
      });
    }

    if (!number || !video) {
      return res.status(400).json({
        success: false,
        error: 'NÃºmero e vÃ­deo sÃ£o obrigatÃ³rios'
      });
    }

    // Busca instÃ¢ncia (usando tenantQuery para RLS)
    const instance = await tenantQuery(req, `
      SELECT ui.*, p.host, p.port, p.username, p.password
      FROM uaz_instances ui
      LEFT JOIN proxies p ON ui.proxy_id = p.id
      WHERE ui.id = $1 AND ui.tenant_id = $2
    `, [id, tenantId]);

    if (instance.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'InstÃ¢ncia nÃ£o encontrada'
      });
    }

    const inst = instance.rows[0];
    
    if (!inst.instance_token) {
      return res.status(400).json({
        success: false,
        error: 'InstÃ¢ncia sem token. Recrie a instÃ¢ncia.'
      });
    }
    
    // â¸ï¸ VALIDAÃ‡ÃƒO: Verifica se a instÃ¢ncia estÃ¡ ativa (nÃ£o pausada)
    if (!inst.is_active) {
      console.log(`â¸ï¸ Tentativa de envio bloqueada - InstÃ¢ncia ${inst.name} (ID: ${id}) estÃ¡ PAUSADA`);
      return res.status(400).json({
        success: false,
        error: 'â¸ï¸ ConexÃ£o pausada. Ative a conexÃ£o nas configuraÃ§Ãµes para enviar mensagens.'
      });
    }
    
    if (!inst.is_connected) {
      return res.status(400).json({
        success: false,
        error: 'InstÃ¢ncia nÃ£o estÃ¡ conectada'
      });
    }

    // ðŸš¨ VERIFICAR LISTA DE RESTRIÃ‡ÃƒO (ENVIO ÃšNICO QR - VÃDEO)
    console.log('ðŸ” VERIFICANDO LISTA DE RESTRIÃ‡ÃƒO (ENVIO VÃDEO QR) - NÃºmero:', number);
    
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
        const listNames = restrictionResult.restricted_details[0].list_names?.join(', ') || 'Lista de RestriÃ§Ã£o';
        console.log('ðŸš« BLOQUEADO -', listNames);
        return res.status(403).json({
          success: false,
          error: 'NÃºmero bloqueado',
          message: `Este nÃºmero estÃ¡ na lista de restriÃ§Ã£o: ${listNames}`
        });
      }
      console.log('   âœ… Livre\n');
    } catch (error) {
      console.error('âŒ Erro ao verificar lista:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao verificar lista de restriÃ§Ã£o'
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
          error: 'Erro ao processar vÃ­deo: ' + conversion.error
        });
      }
      fileToSend = conversion.file;
    }

    // ðŸ”‘ BUSCAR CREDENCIAIS DO TENANT
    const credentials = await getTenantUazapCredentials(tenantId);
    const tenantUazService = new UazService(credentials.serverUrl, credentials.adminToken);

    // ðŸ”¤ SUBSTITUIR VARIÃVEIS AUTOMÃTICAS NO CAPTION (se houver)
    let processedCaption = processAutoVariables(caption || '');
    
    // ðŸ”¤ SUBSTITUIR VARIÃVEIS PERSONALIZADAS NO CAPTION (se fornecidas)
    const { variables } = req.body;
    if (variables && Object.keys(variables).length > 0) {
      console.log('ðŸ”¤ [DEBUG] Substituindo variÃ¡veis personalizadas no caption do vÃ­deo:', variables);
      processedCaption = replaceVariables(processedCaption, variables);
    }

    // Envia vÃ­deo usando o endpoint correto /send/media
    const sendResult = await tenantUazService.sendMedia(inst.instance_token, {
      number,
      type: 'video',
      file: fileToSend,
      text: processedCaption
    }, proxyConfig);

    // Salva no histÃ³rico (com caption processado)
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
        error: 'Tenant nÃ£o identificado'
      });
    }

    if (!number || !document) {
      return res.status(400).json({
        success: false,
        error: 'NÃºmero e documento sÃ£o obrigatÃ³rios'
      });
    }

    // Busca instÃ¢ncia (usando tenantQuery para RLS)
    const instance = await tenantQuery(req, `
      SELECT ui.*, p.host, p.port, p.username, p.password
      FROM uaz_instances ui
      LEFT JOIN proxies p ON ui.proxy_id = p.id
      WHERE ui.id = $1 AND ui.tenant_id = $2
    `, [id, tenantId]);

    if (instance.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'InstÃ¢ncia nÃ£o encontrada'
      });
    }

    const inst = instance.rows[0];
    
    if (!inst.instance_token) {
      return res.status(400).json({
        success: false,
        error: 'InstÃ¢ncia sem token. Recrie a instÃ¢ncia.'
      });
    }
    
    // â¸ï¸ VALIDAÃ‡ÃƒO: Verifica se a instÃ¢ncia estÃ¡ ativa (nÃ£o pausada)
    if (!inst.is_active) {
      console.log(`â¸ï¸ Tentativa de envio bloqueada - InstÃ¢ncia ${inst.name} (ID: ${id}) estÃ¡ PAUSADA`);
      return res.status(400).json({
        success: false,
        error: 'â¸ï¸ ConexÃ£o pausada. Ative a conexÃ£o nas configuraÃ§Ãµes para enviar mensagens.'
      });
    }
    
    if (!inst.is_connected) {
      return res.status(400).json({
        success: false,
        error: 'InstÃ¢ncia nÃ£o estÃ¡ conectada'
      });
    }

    // ðŸš¨ VERIFICAR LISTA DE RESTRIÃ‡ÃƒO (ENVIO ÃšNICO QR - DOCUMENTO)
    console.log('ðŸ” VERIFICANDO LISTA DE RESTRIÃ‡ÃƒO (ENVIO DOC QR) - NÃºmero:', number);
    
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
        const listNames = restrictionResult.restricted_details[0].list_names?.join(', ') || 'Lista de RestriÃ§Ã£o';
        console.log('ðŸš« BLOQUEADO -', listNames);
        return res.status(403).json({
          success: false,
          error: 'NÃºmero bloqueado',
          message: `Este nÃºmero estÃ¡ na lista de restriÃ§Ã£o: ${listNames}`
        });
      }
      console.log('   âœ… Livre\n');
    } catch (error) {
      console.error('âŒ Erro ao verificar lista:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao verificar lista de restriÃ§Ã£o'
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

    // ðŸ”‘ BUSCAR CREDENCIAIS DO TENANT
    const credentials = await getTenantUazapCredentials(tenantId);
    const tenantUazService = new UazService(credentials.serverUrl, credentials.adminToken);

    // ðŸ”¤ SUBSTITUIR VARIÃVEIS AUTOMÃTICAS NO CAPTION (se houver)
    let processedCaption = processAutoVariables(caption || '');
    
    // ðŸ”¤ SUBSTITUIR VARIÃVEIS PERSONALIZADAS NO CAPTION (se fornecidas)
    const { variables } = req.body;
    if (variables && Object.keys(variables).length > 0) {
      console.log('ðŸ”¤ [DEBUG] Substituindo variÃ¡veis personalizadas no caption do documento:', variables);
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

    // Salva no histÃ³rico (com caption processado)
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
 * Envia mensagem com Ã¡udio
 */
router.post('/instances/:id/send-audio', checkMessageLimit, async (req, res) => {
  try {
    const { id } = req.params;
    const { number, audio } = req.body;
    const tenantId = req.tenant?.id || req.user?.tenantId;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'Tenant nÃ£o identificado'
      });
    }

    if (!number || !audio) {
      return res.status(400).json({
        success: false,
        error: 'NÃºmero e Ã¡udio sÃ£o obrigatÃ³rios'
      });
    }

    // Busca instÃ¢ncia (usando tenantQuery para RLS)
    const instance = await tenantQuery(req, `
      SELECT ui.*, p.host, p.port, p.username, p.password
      FROM uaz_instances ui
      LEFT JOIN proxies p ON ui.proxy_id = p.id
      WHERE ui.id = $1 AND ui.tenant_id = $2
    `, [id, tenantId]);

    if (instance.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'InstÃ¢ncia nÃ£o encontrada'
      });
    }

    const inst = instance.rows[0];
    
    if (!inst.instance_token) {
      return res.status(400).json({
        success: false,
        error: 'InstÃ¢ncia sem token. Recrie a instÃ¢ncia.'
      });
    }
    
    // â¸ï¸ VALIDAÃ‡ÃƒO: Verifica se a instÃ¢ncia estÃ¡ ativa (nÃ£o pausada)
    if (!inst.is_active) {
      console.log(`â¸ï¸ Tentativa de envio bloqueada - InstÃ¢ncia ${inst.name} (ID: ${id}) estÃ¡ PAUSADA`);
      return res.status(400).json({
        success: false,
        error: 'â¸ï¸ ConexÃ£o pausada. Ative a conexÃ£o nas configuraÃ§Ãµes para enviar mensagens.'
      });
    }
    
    if (!inst.is_connected) {
      return res.status(400).json({
        success: false,
        error: 'InstÃ¢ncia nÃ£o estÃ¡ conectada'
      });
    }

    // ðŸš¨ VERIFICAR LISTA DE RESTRIÃ‡ÃƒO (ENVIO ÃšNICO QR - ÃUDIO)
    console.log('ðŸ” VERIFICANDO LISTA DE RESTRIÃ‡ÃƒO (ENVIO ÃUDIO QR) - NÃºmero:', number);
    
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
        const listNames = restrictionResult.restricted_details[0].list_names?.join(', ') || 'Lista de RestriÃ§Ã£o';
        console.log('ðŸš« BLOQUEADO -', listNames);
        return res.status(403).json({
          success: false,
          error: 'NÃºmero bloqueado',
          message: `Este nÃºmero estÃ¡ na lista de restriÃ§Ã£o: ${listNames}`
        });
      }
      console.log('   âœ… Livre\n');
    } catch (error) {
      console.error('âŒ Erro ao verificar lista:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao verificar lista de restriÃ§Ã£o'
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
      const conversion = await convertFileToBase64(audio, false); // NÃ£o comprimir Ã¡udio
      if (!conversion.success) {
        return res.status(500).json({
          success: false,
          error: 'Erro ao processar Ã¡udio: ' + conversion.error
        });
      }
      fileToSend = conversion.file;
    }

    // ðŸ”‘ BUSCAR CREDENCIAIS DO TENANT
    const credentials = await getTenantUazapCredentials(tenantId);
    const tenantUazService = new UazService(credentials.serverUrl, credentials.adminToken);

    // Envia Ã¡udio usando o endpoint correto /send/media
    const sendResult = await tenantUazService.sendMedia(inst.instance_token, {
      number,
      type: 'audio',
      file: fileToSend
    }, proxyConfig);

    // Salva no histÃ³rico
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
 * Verifica se um nÃºmero existe no WhatsApp
 */
router.post('/instances/:id/check-number', async (req, res) => {
  try {
    const { id } = req.params;
    const { number } = req.body;

    if (!number) {
      return res.status(400).json({
        success: false,
        error: 'NÃºmero Ã© obrigatÃ³rio'
      });
    }

    // Busca instÃ¢ncia (usando tenantQuery para RLS)
    const instance = await tenantQuery(req, `
      SELECT ui.*, p.host, p.port, p.username, p.password
      FROM uaz_instances ui
      LEFT JOIN proxies p ON ui.proxy_id = p.id
      WHERE ui.id = $1 AND ui.tenant_id = $2
    `, [id, tenantId]);

    if (instance.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'InstÃ¢ncia nÃ£o encontrada'
      });
    }

    const inst = instance.rows[0];
    
    if (!inst.instance_token) {
      return res.status(400).json({
        success: false,
        error: 'InstÃ¢ncia sem token. Recrie a instÃ¢ncia.'
      });
    }

    const proxyConfig = inst.host ? {
      host: inst.host,
      port: inst.port,
      username: inst.username,
      password: inst.password
    } : null;

    // ðŸ”‘ BUSCAR CREDENCIAIS DO TENANT
    const credentials = await getTenantUazapCredentials(tenantId);
    const tenantUazService = new UazService(credentials.serverUrl, credentials.adminToken);

    // Verifica nÃºmero usando instance_token
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
 * Verifica mÃºltiplos nÃºmeros no WhatsApp
 */
router.post('/instances/:id/check-numbers', async (req, res) => {
  try {
    const { id } = req.params;
    const { numbers, delaySeconds } = req.body;

    // ðŸ”’ SEGURANÃ‡A: Obter tenant_id do request
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        error: 'Tenant nÃ£o identificado'
      });
    }

    if (!numbers || !Array.isArray(numbers) || numbers.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Array de nÃºmeros Ã© obrigatÃ³rio'
      });
    }

    // Busca instÃ¢ncia (usando tenantQuery para RLS)
    const instance = await tenantQuery(req, `
      SELECT ui.*, p.host, p.port, p.username, p.password
      FROM uaz_instances ui
      LEFT JOIN proxies p ON ui.proxy_id = p.id
      WHERE ui.id = $1 AND ui.tenant_id = $2
    `, [id, tenantId]);

    if (instance.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'InstÃ¢ncia nÃ£o encontrada'
      });
    }

    const inst = instance.rows[0];
    
    if (!inst.instance_token) {
      return res.status(400).json({
        success: false,
        error: 'InstÃ¢ncia sem token. Recrie a instÃ¢ncia.'
      });
    }

    const proxyConfig = inst.host ? {
      host: inst.host,
      port: inst.port,
      username: inst.username,
      password: inst.password
    } : null;

    // ðŸ”‘ BUSCAR CREDENCIAIS DO TENANT
    const credentials = await getTenantUazapCredentials(tenantId);
    const tenantUazService = new UazService(credentials.serverUrl, credentials.adminToken);

    // Verifica nÃºmeros usando instance_token com delay configurÃ¡vel
    const delay = parseFloat(delaySeconds) || 0;
    const checkResult = await tenantUazService.checkNumbers(inst.instance_token, numbers, proxyConfig, delay);

    // ðŸ’¾ SALVAR HISTÃ“RICO DE VERIFICAÃ‡Ã•ES
    if (checkResult.success && checkResult.data) {
      console.log(`ðŸ’¾ Salvando ${checkResult.data.length} verificaÃ§Ãµes no histÃ³rico...`);
      
      for (const result of checkResult.data) {
        try {
          await tenantQuery(req, `
            INSERT INTO uaz_verification_history 
            (tenant_id, instance_id, phone_number, is_in_whatsapp, verified_name, jid, error_message)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [
            tenantId,
            id,
            result.phone,
            result.exists || false,
            result.verifiedName || null,
            result.jid || null,
            result.error || null
          ]);
          
          console.log(`  âœ… HistÃ³rico salvo: ${result.phone} - ${result.exists ? 'TEM WhatsApp' : 'NÃƒO tem WhatsApp'}`);
        } catch (error) {
          console.error(`  âŒ Erro ao salvar histÃ³rico de ${result.phone}:`, error.message);
        }
      }
      
      console.log(`âœ… HistÃ³rico de verificaÃ§Ãµes salvo com sucesso!\n`);
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
 * Lista histÃ³rico de verificaÃ§Ãµes de nÃºmeros
 */
router.get('/verification-history', async (req, res) => {
  try {
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(401).json({ success: false, message: 'Tenant nÃ£o identificado' });
    }

    const { instance_id, limit = 100, offset = 0 } = req.query;

    let query = `
      SELECT 
        vh.*,
        ui.name as instance_name,
        ui.session_name
      FROM uaz_verification_history vh
      JOIN uaz_instances ui ON vh.instance_id = ui.id
      WHERE vh.tenant_id = $1
    `;
    
    const params = [tenantId];
    if (instance_id) {
      query += ' AND vh.instance_id = $2';
      params.push(instance_id);
    }

    query += ' ORDER BY vh.verified_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);

    const result = await tenantQuery(req, query, params);

    // Contar total
    let countQuery = 'SELECT COUNT(*) FROM uaz_verification_history vh WHERE vh.tenant_id = $1';
    const countParams = [tenantId];
    if (instance_id) {
      countQuery += ' AND vh.instance_id = $2';
      countParams.push(instance_id);
    }
    const countResult = await tenantQuery(req, countQuery, countParams);
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
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(401).json({ success: false, message: 'Tenant nÃ£o identificado' });
    }

    const { instance_id, limit = 50, offset = 0 } = req.query;

    // Mensagens de campanhas (qr_campaign_messages)
    let campaignQuery = `
      SELECT 
        qcm.id,
        qcm.instance_id,
        ui.name as instance_name,
        ui.session_name,
        qcm.campaign_id,
        qc.name as campaign_name,
        qcm.phone_number,
        qcm.template_name as message_content,
        'campaign' as message_type,
        qcm.status,
        qcm.whatsapp_message_id as message_id,
        qcm.error_message,
        qcm.sent_at,
        qcm.delivered_at,
        qcm.read_at,
        qcm.created_at,
        qcm.created_at as updated_at
      FROM qr_campaign_messages qcm
      INNER JOIN qr_campaigns qc ON qcm.campaign_id = qc.id
      LEFT JOIN uaz_instances ui ON qcm.instance_id = ui.id
      WHERE qc.tenant_id = $1
    `;

    // Mensagens Ãºnicas (uaz_messages)
    let uniqueQuery = `
      SELECT 
        um.id,
        um.instance_id,
        ui.name as instance_name,
        ui.session_name,
        NULL::int as campaign_id,
        NULL::text as campaign_name,
        um.phone_number,
        um.message_content,
        um.message_type,
        um.status,
        um.message_id,
        um.error_message,
        um.sent_at,
        um.delivered_at,
        um.read_at,
        um.created_at,
        um.updated_at
      FROM uaz_messages um
      INNER JOIN uaz_instances ui ON um.instance_id = ui.id
      WHERE ui.tenant_id = $2
    `;

    const params = [tenantId, tenantId];

    // Filtro por instÃ¢ncia (aplica nos dois blocos)
    if (instance_id) {
      campaignQuery += ` AND qcm.instance_id = $3`;
      uniqueQuery += ` AND um.instance_id = $3`;
      params.push(instance_id);
    }

    const limitIndex = params.length + 1;
    const offsetIndex = params.length + 2;

    const combinedQuery = `
      SELECT * FROM (
        ${campaignQuery}
        UNION ALL
        ${uniqueQuery}
      ) AS messages
      ORDER BY created_at DESC
      LIMIT $${limitIndex} OFFSET $${offsetIndex}
    `;

    params.push(limit);
    params.push(offset);

    const result = await tenantQuery(req, combinedQuery, params);

    // Contagem total (sem paginaÃ§Ã£o)
    const countQuery = `
      SELECT COUNT(*) FROM (
        ${campaignQuery}
        UNION ALL
        ${uniqueQuery}
      ) AS total_messages
    `;
    const countResult = await tenantQuery(req, countQuery, params.slice(0, params.length - 2));
    const total = parseInt(countResult.rows[0]?.count || '0', 10);

    res.json({
      success: true,
      data: result.rows,
      total
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
 * EstatÃ­sticas gerais UAZ com filtros de data e separaÃ§Ã£o por tipo
 */
router.get('/stats', async (req, res) => {
  try {
    // ðŸ”’ SEGURANÃ‡A: Filtrar por tenant_id
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Tenant nÃ£o identificado'
      });
    }

    const { startDate, endDate, filterType } = req.query;

    console.log('ðŸ“Š Buscando estatÃ­sticas UAZ/QR Connect');
    console.log('Filtros:', { startDate, endDate, filterType, tenantId });

    // ===============================================
    // 1. ESTATÃSTICAS DE INSTÃ‚NCIAS (sem filtro de data)
    // ===============================================
    
    // ðŸ› DEBUG: Verificar instÃ¢ncias do tenant
    const debugInstances = await pool.query(`
      SELECT id, name, session_name, tenant_id
      FROM uaz_instances
      WHERE tenant_id = $1
    `, [tenantId]);
    
    console.log('ðŸ” DEBUG - InstÃ¢ncias do tenant:', {
      tenant_id: tenantId,
      total_instances: debugInstances.rows.length,
      instances: debugInstances.rows.map(i => ({
        id: i.id,
        name: i.name,
        session: i.session_name
      }))
    });
    
    const instancesStats = await tenantQuery(req, `
      SELECT 
        COUNT(DISTINCT id) as total_instances,
        COUNT(DISTINCT CASE WHEN is_connected THEN id END) as connected_instances
      FROM uaz_instances
      WHERE tenant_id = $1
    `, [tenantId]);

    // ===============================================
    // 2. ESTATÃSTICAS DE MENSAGENS POR CAMPANHA
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

    const campaignStats = await tenantQuery(req, campaignQuery, campaignParams);

    // ===============================================
    // 3. ESTATÃSTICAS DE MENSAGENS ÃšNICAS (nÃ£o-campanha)
    // ===============================================
    
    // ðŸ› DEBUG: Verificar se hÃ¡ duplicaÃ§Ã£o
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
    
    const debugResult = await tenantQuery(req, debugQuery, [tenantId]);
    console.log('ðŸ” DEBUG - Ãšltimas 10 mensagens Ãºnicas:', {
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

    // Aplicar filtros de data nas mensagens Ãºnicas
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

    const uniqueStats = await tenantQuery(req, uniqueQuery, uniqueParams);
    
    console.log('ðŸ“Š Resultado da query de mensagens Ãºnicas:', uniqueStats.rows[0]);

    // ===============================================
    // 4. CAMPANHAS RECENTES (Ãºltimas 5)
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

    const recentCampaigns = await tenantQuery(req, recentCampaignsQuery, [tenantId]);

    console.log('âœ… EstatÃ­sticas UAZ carregadas:', {
      instances: instancesStats.rows[0],
      campaign_messages: campaignStats.rows[0]?.total_messages || 0,
      unique_messages: uniqueStats.rows[0]?.total_messages || 0,
      recent_campaigns: recentCampaigns.rows.length
    });

    res.json({
      success: true,
      data: {
        // InstÃ¢ncias
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
        
        // Mensagens Ãšnicas (nÃ£o-campanha)
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
    console.error('âŒ Erro ao buscar estatÃ­sticas UAZ:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/uaz/instances/:id/send-menu
 * Envia menu interativo (botÃµes, lista, enquete ou carousel)
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
        error: 'Tenant nÃ£o identificado'
      });
    }

    console.log('ðŸ“¤ Enviando menu interativo:', type);

    // Buscar instÃ¢ncia (usando tenantQuery para RLS)
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
        error: 'InstÃ¢ncia nÃ£o encontrada'
      });
    }

    const instance = result.rows[0];
    
    // Preparar configuraÃ§Ã£o de proxy se existir
    const proxyConfig = instance.proxy_id ? {
      host: instance.proxy_host,
      port: instance.proxy_port,
      username: instance.proxy_username,
      password: instance.proxy_password,
      type: instance.proxy_type
    } : null;

    // ðŸ”‘ BUSCAR CREDENCIAIS DO TENANT
    const credentials = await getTenantUazapCredentials(tenantId);
    const uazService = new UazService(credentials.serverUrl, credentials.adminToken);

    // ValidaÃ§Ãµes
    if (!['button', 'list', 'poll', 'carousel'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Tipo invÃ¡lido. Use: button, list, poll ou carousel'
      });
    }

    if (!choices || !Array.isArray(choices) || choices.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Ã‰ necessÃ¡rio fornecer opÃ§Ãµes (choices)'
      });
    }

    console.log('ðŸ“‹ Tipo:', type);
    console.log('ðŸ“‹ Choices recebidos:', JSON.stringify(choices, null, 2));
    
    // ðŸ”¤ PROCESSAR VARIÃVEIS NO TEXTO E FOOTER
    const { variables } = req.body;
    let processedText = processAutoVariables(text || '');
    let processedFooter = processAutoVariables(footerText || '');
    
    if (variables && Object.keys(variables).length > 0) {
      console.log('ðŸ”¤ [DEBUG] Substituindo variÃ¡veis personalizadas no menu:', variables);
      processedText = replaceVariables(processedText, variables);
      processedFooter = replaceVariables(processedFooter, variables);
    }
    
    // Preparar menuData
    const menuData = {
      number,
      type,
      text: processedText
    };
    
    // Para listas, formatar com [SeÃ§Ã£o] e texto|id|descriÃ§Ã£o
    if (type === 'list') {
      menuData.choices = formatListChoices(choices);
      console.log('ðŸ“‹ Choices formatados para lista:', JSON.stringify(menuData.choices, null, 2));
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
    
    // Processar imageButton se necessÃ¡rio (converter local para Base64)
    if (imageButton) {
      if (imageButton.includes('localhost') || imageButton.startsWith('/uploads/')) {
        console.log('ðŸ”„ Convertendo imagem do botÃ£o para Base64...');
        const conversionResult = await convertFileToBase64(imageButton);
        
        if (conversionResult.success) {
          menuData.imageButton = conversionResult.file;
          console.log(`âœ… Imagem do botÃ£o convertida (tamanho: ${(conversionResult.file.length / 1024).toFixed(2)} KB)`);
        } else {
          console.error('âŒ Erro ao converter imagem:', conversionResult.error);
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
    console.log('ðŸ“¤ Payload completo do menu:', JSON.stringify(menuData, null, 2));
    
    // Enviar via UAZ API usando sendMenu (suporta button, list, poll, carousel)
    console.log(`ðŸ“‹ Enviando ${type.toUpperCase()} via mÃ©todo sendMenu...`);
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
    console.error('âŒ ERRO DETALHADO ao enviar menu:');
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
 * Envia carrossel de mÃ­dia com botÃµes
 */
router.post('/instances/:id/send-carousel', checkMessageLimit, async (req, res) => {
  try {
    const { id } = req.params;
    const { number, text, cards } = req.body;
    const tenantId = req.tenant?.id || req.user?.tenantId;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'Tenant nÃ£o identificado'
      });
    }

    console.log('ðŸ“¤ Enviando carrossel para:', number);
    console.log('ðŸ“¦ Payload recebido:', JSON.stringify({ id, number, text, cards }, null, 2));

    // ValidaÃ§Ãµes bÃ¡sicas
    if (!number) {
      return res.status(400).json({
        success: false,
        error: 'NÃºmero Ã© obrigatÃ³rio'
      });
    }

    // Validar cards
    if (!cards || !Array.isArray(cards) || cards.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Ã‰ necessÃ¡rio fornecer pelo menos um card'
      });
    }

    console.log(`ðŸ“‹ Total de cards recebidos: ${cards.length}`);

    // Buscar instÃ¢ncia (usando tenantQuery para RLS)
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
        error: 'InstÃ¢ncia nÃ£o encontrada'
      });
    }

    const instance = result.rows[0];
    console.log(`âœ… InstÃ¢ncia encontrada: ${instance.name} (Token: ${instance.instance_token ? 'OK' : 'FALTANDO'})`);

    if (!instance.instance_token) {
      return res.status(400).json({
        success: false,
        error: 'InstÃ¢ncia sem token configurado'
      });
    }
    
    // Preparar configuraÃ§Ã£o de proxy se existir
    const proxyConfig = instance.proxy_id ? {
      host: instance.proxy_host,
      port: instance.proxy_port,
      username: instance.proxy_username,
      password: instance.proxy_password,
      type: instance.proxy_type
    } : null;

    // ðŸ”‘ BUSCAR CREDENCIAIS DO TENANT
    const credentials = await getTenantUazapCredentials(tenantId);
    const uazService = new UazService(credentials.serverUrl, credentials.adminToken);

    // ðŸ”¤ PROCESSAR VARIÃVEIS NO TEXTO PRINCIPAL DO CAROUSEL
    const { variables } = req.body;
    let processedText = processAutoVariables(text || '');
    if (variables && Object.keys(variables).length > 0) {
      console.log('ðŸ”¤ [DEBUG] Substituindo variÃ¡veis personalizadas no carousel:', variables);
      processedText = replaceVariables(processedText, variables);
    }

    // Processar cards e converter imagens locais para Base64
    const processedCards = [];
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      console.log(`\nðŸ” Processando card ${i + 1}:`, {
        text: card.text?.substring(0, 50),
        image: card.image?.substring(0, 100),
        buttons: card.buttons?.length
      });

      if (!card.text || !card.image || !card.buttons) {
        console.error('âŒ Card invÃ¡lido:', card);
        return res.status(400).json({
          success: false,
          error: `Card ${i + 1} precisa ter text, image e buttons`
        });
      }

      if (!Array.isArray(card.buttons) || card.buttons.length === 0) {
        console.error('âŒ BotÃµes invÃ¡lidos no card:', card.buttons);
        return res.status(400).json({
          success: false,
          error: `Card ${i + 1} precisa ter pelo menos um botÃ£o`
        });
      }

      // Converter imagem local para Base64 se necessÃ¡rio
      let imageUrl = card.image;
      if (card.image.includes('localhost') || card.image.startsWith('/uploads/')) {
        console.log(`ðŸ”„ Convertendo imagem ${i + 1} para Base64 com compressÃ£o agressiva...`);
        const conversionResult = await convertFileToBase64(card.image, true); // true = comprimir
        
        if (conversionResult.success) {
          imageUrl = conversionResult.file;
          const sizeKB = (imageUrl.length / 1024).toFixed(2);
          console.log(`âœ… Imagem ${i + 1} convertida: ${sizeKB} KB`);
          
          // Avisar se ainda estiver muito grande
          if (imageUrl.length > 10 * 1024 * 1024) { // > 10MB
            console.warn(`âš ï¸ Imagem ${i + 1} muito grande (${sizeKB} KB) apÃ³s compressÃ£o`);
          }
        } else {
          console.error(`âŒ Erro ao converter imagem ${i + 1}:`, conversionResult.error);
          return res.status(400).json({
            success: false,
            error: `Erro ao processar imagem do card ${i + 1}: ${conversionResult.error}`
          });
        }
      }

      // ðŸ”¤ PROCESSAR VARIÃVEIS NO TEXTO DO CARD
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

    console.log(`\nâœ… ${processedCards.length} cards processados com sucesso`);
    
    // Calcular tamanho total do payload
    const payloadStr = JSON.stringify({ number, text, cards: processedCards });
    const payloadSizeKB = (payloadStr.length / 1024).toFixed(2);
    const payloadSizeMB = (payloadStr.length / 1024 / 1024).toFixed(2);
    console.log(`ðŸ“Š Tamanho total do payload: ${payloadSizeKB} KB (${payloadSizeMB} MB)`);
    
    if (payloadStr.length > 200 * 1024 * 1024) {
      console.warn(`âš ï¸ AVISO: Payload extremamente grande (${payloadSizeMB} MB). Pode falhar no envio.`);
    }
    
    console.log('ðŸš€ Enviando para UAZ API...');

    // Enviar carrossel via UAZ API (com texto processado)
    const response = await uazService.sendCarousel(instance.instance_token, number, processedText, processedCards, proxyConfig);

    console.log('âœ… Resposta da UAZ:', response);

    // Registrar mensagem no banco (com texto processado) - usando tenantQuery para RLS
    await tenantQuery(req,
      `INSERT INTO uaz_messages (instance_id, phone_number, message_type, message_content, status)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, number, 'carousel', JSON.stringify({ text: processedText, cards: processedCards }), 'sent']
    );

    console.log('âœ… Mensagem registrada no banco');

    res.json({
      success: true,
      data: response
    });
  } catch (error) {
    console.error('âŒ ERRO DETALHADO ao enviar carrossel:');
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
// HISTÃ“RICO DE MENSAGENS
// ========================================

/**
 * POST /uaz/messages/save
 * Salva uma mensagem no histÃ³rico do banco de dados
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

    console.log('ðŸ’¾ Salvando mensagem no histÃ³rico:', {
      instanceId,
      phoneNumber,
      messageType,
      status
    });

    // Validar dados obrigatÃ³rios
    if (!instanceId || !phoneNumber || !messageType) {
      return res.status(400).json({
        success: false,
        error: 'instanceId, phoneNumber e messageType sÃ£o obrigatÃ³rios'
      });
    }

    // ðŸ› CORREÃ‡ÃƒO: Verificar se jÃ¡ existe mensagem recente (Ãºltimos 5 segundos)
    // para evitar duplicaÃ§Ã£o quando frontend chama apÃ³s o envio
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
      // Mensagem jÃ¡ existe, fazer UPDATE ao invÃ©s de INSERT
      const existingId = checkExisting.rows[0].id;
      console.log(`âš ï¸ Mensagem jÃ¡ existe (ID: ${existingId}), atualizando status...`);
      
      const result = await pool.query(
        `UPDATE uaz_messages 
         SET status = $1::VARCHAR,
             error_message = $2::TEXT,
             sent_at = CASE WHEN $1 = 'completed' THEN NOW() ELSE sent_at END
         WHERE id = $3::INTEGER
         RETURNING id, created_at`,
        [status || 'completed', error || null, existingId]
      );

      console.log(`âœ… Mensagem atualizada (ID: ${existingId})`);

      res.json({
        success: true,
        data: result.rows[0],
        updated: true
      });
    } else {
      // Mensagem nÃ£o existe, fazer INSERT normal
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

      console.log('âœ… Mensagem salva no banco com ID:', savedMessage.id);

      res.json({
        success: true,
        data: savedMessage,
        updated: false
      });
    }

  } catch (error) {
    console.error('âŒ Erro ao salvar mensagem:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /uaz/messages/history
 * Busca histÃ³rico de mensagens com filtros
 * Query params:
 *   - startDate: Data inicial (ISO format)
 *   - endDate: Data final (ISO format)
 *   - instanceId: ID da instÃ¢ncia (opcional)
 *   - status: Status da mensagem (opcional)
 *   - limit: Limite de resultados (padrÃ£o: 100)
 */
router.get('/messages/history', async (req, res) => {
  try {
    const { startDate, endDate, instanceId, status, limit = 100 } = req.query;

    console.log('ðŸ“Š Buscando histÃ³rico de mensagens:', {
      startDate,
      endDate,
      instanceId,
      status,
      limit
    });

    // Construir query dinÃ¢mica
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

    // Filtro por instÃ¢ncia
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

    console.log('ðŸ” Query SQL:', query);
    console.log('ðŸ” ParÃ¢metros:', params);

    const result = await pool.query(query, params);

    console.log(`âœ… ${result.rows.length} mensagens encontradas no histÃ³rico`);

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });

  } catch (error) {
    console.error('âŒ Erro ao buscar histÃ³rico:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /uaz/messages/stats
 * Retorna estatÃ­sticas do histÃ³rico de mensagens
 */
router.get('/messages/stats', async (req, res) => {
  try {
    const { startDate, endDate, instanceId } = req.query;

    console.log('ðŸ“Š Buscando estatÃ­sticas de mensagens');

    // Construir query de estatÃ­sticas
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

    console.log('âœ… EstatÃ­sticas:', stats);

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
    console.error('âŒ Erro ao buscar estatÃ­sticas:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/uaz/instances/:id/history
 * ObtÃ©m histÃ³rico completo de eventos de uma instÃ¢ncia
 */
router.get('/instances/:id/history', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verifica se instÃ¢ncia existe
    // ðŸ”’ SEGURANÃ‡A: Filtrar por tenant_id
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Tenant nÃ£o identificado'
      });
    }
    
    const instance = await tenantQuery(req, 'SELECT * FROM uaz_instances WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    if (instance.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'InstÃ¢ncia nÃ£o encontrada'
      });
    }
    
    const inst = instance.rows[0];
    
    // Busca histÃ³rico
    const history = await getInstanceHistory(id);
    
    console.log(`ðŸ“ HistÃ³rico da instÃ¢ncia "${inst.name}" (ID: ${id}) - ${history.length} eventos`);
    
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
    console.error('âŒ Erro ao buscar histÃ³rico:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/uaz/verification-jobs
 * Cria um novo job de verificaÃ§Ã£o em massa para rodar em background
 */
router.post('/verification-jobs', async (req, res) => {
  try {
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(401).json({ success: false, message: 'Tenant nÃ£o identificado' });
    }

    const { instanceIds, numbers, delaySeconds = 2, userIdentifier = 'default' } = req.body;

    if (!instanceIds || instanceIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Selecione pelo menos uma instÃ¢ncia'
      });
    }

    if (!numbers || numbers.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'ForneÃ§a pelo menos um nÃºmero'
      });
    }

    console.log(`\nðŸš€ Criando job de verificaÃ§Ã£o em massa:`);
    console.log(`   ðŸ“± InstÃ¢ncias: ${instanceIds.length} - IDs: [${instanceIds.join(', ')}]`);
    console.log(`   ðŸ“ž NÃºmeros: ${numbers.length}`);
    console.log(`   â±ï¸  Delay: ${delaySeconds}s`);

    // Criar job no banco
    const result = await tenantQuery(req, `
      INSERT INTO uaz_verification_jobs 
      (tenant_id, user_identifier, instance_ids, numbers, delay_seconds, progress_total, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'pending')
      RETURNING *
    `, [tenantId, userIdentifier, instanceIds, numbers, delaySeconds, numbers.length]);

    const job = result.rows[0];

    console.log(`âœ… Job criado com ID: ${job.id}`);

    // Iniciar processamento em background
    processVerificationJob(job.id, tenantId).catch(err => {
      console.error(`âŒ Erro ao processar job ${job.id}:`, err);
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
    console.error('âŒ Erro ao criar job:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/uaz/verification-jobs/:id
 * ObtÃ©m status e progresso de um job
 */
router.get('/verification-jobs/:id', async (req, res) => {
  try {
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(401).json({ success: false, message: 'Tenant não identificado' });
    }

    const { id } = req.params;

    const result = await tenantQuery(req, 'SELECT * FROM uaz_verification_jobs WHERE id = $1 AND tenant_id = $2', [id, tenantId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Job nÃ£o encontrado'
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
    console.error('âŒ Erro ao buscar job:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/uaz/verification-jobs
 * Lista todos os jobs do usuÃ¡rio
 */
router.get('/verification-jobs', async (req, res) => {
  try {
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(401).json({ success: false, message: 'Tenant não identificado' });
    }

    const { userIdentifier = 'default', limit = 50 } = req.query;

    const result = await tenantQuery(req, `
      SELECT * FROM uaz_verification_jobs 
      WHERE user_identifier = $1 AND tenant_id = $2
      ORDER BY created_at DESC 
      LIMIT $3
    `, [userIdentifier, tenantId, limit]);

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
    console.error('âŒ Erro ao listar jobs:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/uaz/verification-jobs/:id/pause
 * Pausa um job em execuÃ§Ã£o
 */
router.post('/verification-jobs/:id/pause', async (req, res) => {
  try {
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(401).json({ success: false, message: 'Tenant não identificado' });
    }

    const { id } = req.params;

    await tenantQuery(req, `
      UPDATE uaz_verification_jobs 
      SET status = 'paused', updated_at = NOW() 
      WHERE id = $1 AND tenant_id = $2 AND status = 'running'
    `, [id, tenantId]);

    console.log(`â¸ï¸ Job ${id} pausado`);

    res.json({ success: true, message: 'Job pausado' });

  } catch (error) {
    console.error('âŒ Erro ao pausar job:', error);
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
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(401).json({ success: false, message: 'Tenant não identificado' });
    }

    const { id } = req.params;

    await tenantQuery(req, `
      UPDATE uaz_verification_jobs 
      SET status = 'running', updated_at = NOW() 
      WHERE id = $1 AND tenant_id = $2 AND status = 'paused'
    `, [id, tenantId]);

    console.log(`â–¶ï¸ Job ${id} retomado`);

    res.json({ success: true, message: 'Job retomado' });

  } catch (error) {
    console.error('âŒ Erro ao retomar job:', error);
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
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(401).json({ success: false, message: 'Tenant não identificado' });
    }

    const { id } = req.params;

    await tenantQuery(req, `
      UPDATE uaz_verification_jobs 
      SET status = 'cancelled', completed_at = NOW(), updated_at = NOW() 
      WHERE id = $1 AND tenant_id = $2 AND status IN ('pending', 'running', 'paused')
    `, [id, tenantId]);

    console.log(`â›” Job ${id} cancelado`);

    res.json({ success: true, message: 'Job cancelado' });

  } catch (error) {
    console.error('âŒ Erro ao cancelar job:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * FunÃ§Ã£o para processar job em background
 */
async function processVerificationJob(jobId, tenantId) {
  try {
    console.log(`\n✅ Iniciando processamento do job ${jobId}...`);

    // Buscar job
    const jobResult = await queryWithTenantId(tenantId, 'SELECT * FROM uaz_verification_jobs WHERE id = $1', [jobId]);
    if (jobResult.rows.length === 0) {
      console.error(`❌ Job ${jobId} não encontrado`);
      return;
    }

    const job = jobResult.rows[0];

    // Atualizar para status "running"
    await queryWithTenantId(tenantId, `
      UPDATE uaz_verification_jobs 
      SET status = 'running', started_at = NOW(), updated_at = NOW() 
      WHERE id = $1
    `, [jobId]);

    const results = [];
    const numbers = job.numbers;
    const instanceIds = job.instance_ids;

    // Buscar instâncias (incluir tenant_id para buscar credenciais corretas)
    const instancesResult = await queryWithTenantId(tenantId, `
      SELECT id, name, instance_token, is_connected, tenant_id FROM uaz_instances WHERE id = ANY($1)
    `, [instanceIds]);

    const allInstances = instancesResult.rows || [];

    // Usar apenas instâncias conectadas e com token válido
    let instances = allInstances.filter(inst => inst.is_connected && !!inst.instance_token);

    // Se o status "is_connected" estiver desatualizado, fazer fallback para qualquer instância com token
    if (instances.length === 0 && allInstances.length > 0) {
      console.warn(`⚠️ Job ${jobId}: nenhuma instância marcada como conectada; usando fallback com todas as instâncias com token.`);
      instances = allInstances.filter(inst => !!inst.instance_token);
    }

    // Falha rápida se não houver instância válida (nem com fallback)
    if (instances.length === 0) {
      const msg = 'Nenhuma instância válida encontrada para este job. Conecte uma instância e tente novamente.';
      console.error(`⚠️ Job ${jobId}: ${msg}`);
      await queryWithTenantId(tenantId, `
        UPDATE uaz_verification_jobs 
        SET status = 'error', error_message = $1, updated_at = NOW(), completed_at = NOW() 
        WHERE id = $2
      `, [msg, jobId]);
      return;
    }

    // ✅ BUSCAR CREDENCIAIS DO TENANT (usando a primeira instância para obter o tenant)
    if (!tenantId) {
      throw new Error('Tenant ID não encontrado nas instâncias');
    }
    const credentials = await getTenantUazapCredentials(tenantId);
    const uazService = new UazService(credentials.serverUrl, credentials.adminToken);

    console.log(`🔍 Processando ${numbers.length} números com ${instances.length} instância(s):`);
    instances.forEach((inst, idx) => {
      console.log(`   ${idx + 1}. ID: ${inst.id} | Nome: ${inst.name} | Conectada: ${inst.is_connected ? '✅' : '❌'}`);
    });

    // Processar números
    for (let i = 0; i < numbers.length; i++) {
      // Verificar se foi pausado ou cancelado
      const statusCheck = await queryWithTenantId(tenantId, 'SELECT status FROM uaz_verification_jobs WHERE id = $1', [jobId]);
      const currentStatus = statusCheck.rows[0].status;

      if (currentStatus === 'cancelled') {
        console.log(`⚠️ Job ${jobId} foi cancelado`);
        break;
      }

      // Aguardar se pausado
      while (currentStatus === 'paused') {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const pauseCheck = await queryWithTenantId(tenantId, 'SELECT status FROM uaz_verification_jobs WHERE id = $1', [jobId]);
        if (pauseCheck.rows[0].status !== 'paused') break;
      }

      const phone = numbers[i];
      const instanceIndex = i % instances.length;
      const instance = instances[instanceIndex];

      try {
        console.log(`\n🔍 [${i + 1}/${numbers.length}] Verificando ${phone}`);
        console.log(`   ✅ Usando instância [${instanceIndex + 1}/${instances.length}]: ID=${instance.id} | ${instance.name}`);

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
        await queryWithTenantId(tenantId, `
          INSERT INTO uaz_verification_history
          (tenant_id, instance_id, phone_number, is_in_whatsapp, verified_name, jid)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [tenantId, instance.id, phone, result.exists, result.verifiedName, result.jid]);

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
      await queryWithTenantId(tenantId, `
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
    const finalStatus = await queryWithTenantId(tenantId, 'SELECT status FROM uaz_verification_jobs WHERE id = $1', [jobId]);
    if (finalStatus.rows[0].status !== 'cancelled') {
      await queryWithTenantId(tenantId, `
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
    await queryWithTenantId(tenantId, `
      UPDATE uaz_verification_jobs 
      SET status = 'error', error_message = $1, completed_at = NOW(), updated_at = NOW() 
      WHERE id = $2
    `, [error.message, jobId]);
  }
}

/**
 * GET /api/uaz/fetch-instances?phoneNumber=5562981045992
 * Busca UMA instÃ¢ncia especÃ­fica na UAZ API filtrando por nÃºmero de telefone
 * 
 * @query {string} phoneNumber - NÃºmero de telefone para buscar (obrigatÃ³rio)
 */
router.get('/fetch-instances', async (req, res) => {
  try {
    console.log('\nðŸ“¥ ========================================');
    console.log('ðŸ“¥ BUSCANDO INSTÃ‚NCIA ESPECÃFICA NA UAZ API');
    console.log('ðŸ“¥ ========================================\n');

    // ðŸ”’ Verificar tenant ANTES de tudo
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        error: 'Tenant nÃ£o identificado'
      });
    }

    // ðŸ“ž OBRIGATÃ“RIO: Receber nÃºmero de telefone
    const { phoneNumber } = req.query;
    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        error: 'NÃºmero de telefone Ã© obrigatÃ³rio'
      });
    }

    console.log(`ðŸ“ž Buscando instÃ¢ncia com nÃºmero: ${phoneNumber}`);

    // ðŸ”‘ BUSCAR CREDENCIAIS DO TENANT
    console.log(`ðŸ”‘ Buscando credenciais UAZAP para tenant ${tenantId}...`);
    const credentials = await getTenantUazapCredentials(tenantId);
    const tenantUazService = new UazService(credentials.serverUrl, credentials.adminToken);

    // Buscar TODAS as instÃ¢ncias da UAZ API (mas vamos filtrar depois)
    const fetchResult = await tenantUazService.fetchInstances();

    if (!fetchResult.success) {
      return res.status(500).json({
        success: false,
        error: fetchResult.error
      });
    }

    const allInstances = fetchResult.instances || [];
    console.log(`ðŸ“Š Total de instÃ¢ncias na UAZ API: ${allInstances.length}`);

    if (allInstances.length === 0) {
      console.log('âš ï¸  Nenhuma instÃ¢ncia encontrada na UAZ API');
      return res.json({
        success: true,
        found: false,
        message: 'Nenhuma instÃ¢ncia encontrada na UAZ API',
        instance: null
      });
    }

    // ðŸ” FILTRAR: Buscar APENAS a instÃ¢ncia com o nÃºmero informado
    console.log(`ðŸ” Filtrando instÃ¢ncias pelo nÃºmero: ${phoneNumber}`);
    console.log(`ðŸ“Š Testando ${allInstances.length} instÃ¢ncias...`);
    
    const matchedInstance = allInstances.find(inst => {
      const instancePhone = inst.owner || inst.phoneNumber || '';
      console.log(`   ðŸ”Ž Testando: ${instancePhone} (owner) vs ${phoneNumber} (buscado)`);
      
      const matches = phonesMatch(phoneNumber, instancePhone);
      console.log(`      â””â”€ Resultado: ${matches ? 'âœ… MATCH!' : 'âŒ NÃ£o bateu'}`);
      
      if (matches) {
        console.log(`   âœ…âœ…âœ… ENCONTRADO: ${instancePhone} corresponde a ${phoneNumber}`);
      }
      
      return matches;
    });

    if (!matchedInstance) {
      console.log(`âŒ Nenhuma instÃ¢ncia encontrada com o nÃºmero: ${phoneNumber}`);
      console.log('========================================\n');
      return res.json({
        success: true,
        found: false,
        message: `Nenhuma instÃ¢ncia encontrada com o nÃºmero ${phoneNumber}`,
        instance: null
      });
    }

    console.log(`âœ… InstÃ¢ncia encontrada: ${matchedInstance.name || matchedInstance.id}`);
    
    // ðŸ”’ Verificar se jÃ¡ estÃ¡ cadastrada no banco local DO TENANT
    const localInstances = await tenantQuery(req, 
      'SELECT instance_token FROM uaz_instances WHERE tenant_id = $1 AND instance_token = $2', 
      [tenantId, matchedInstance.token]
    );
    
    const alreadyImported = localInstances.rows.length > 0;

    if (alreadyImported) {
      console.log(`âš ï¸  Esta instÃ¢ncia jÃ¡ estÃ¡ importada no sistema`);
    }

    console.log('========================================\n');

    res.json({
      success: true,
      found: true,
      alreadyImported,
      message: alreadyImported 
        ? 'Esta instÃ¢ncia jÃ¡ estÃ¡ importada no sistema' 
        : 'InstÃ¢ncia encontrada! Deseja importÃ¡-la?',
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
    console.error('âŒ Erro ao buscar instÃ¢ncias:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/uaz/import-instances
 * Importa instÃ¢ncias selecionadas da UAZ API para o banco local
 */
router.post('/import-instances', async (req, res) => {
  try {
    const { instances } = req.body;
    const tenantId = req.tenant.id; // âœ… Obter tenant_id do request

    if (!instances || !Array.isArray(instances) || instances.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Selecione pelo menos uma instÃ¢ncia para importar'
      });
    }

    console.log('\nðŸ"¥ ========================================');
    console.log('ðŸ"¥ IMPORTANDO INSTÃ‚NCIAS DA UAZ API');
    console.log('ðŸ"¥ ========================================\n');
    console.log(`ðŸ"Š Total de instÃ¢ncias a importar: ${instances.length}`);
    console.log(`ðŸ"¦ Dados recebidos da UAZAPI:`, JSON.stringify(instances, null, 2));

    const imported = [];
    const errors = [];
    const namesUsed = new Set(); // ðŸŽ¯ Rastrear nomes jÃ¡ usados nesta importaÃ§Ã£o

    for (const inst of instances) {
      try {
        let instanceName = inst.name || inst.owner || `instancia_${Date.now()}`;
        let sessionName = inst.name || inst.id || `session_${Date.now()}`;
        
        console.log(`\nðŸ"¥ Importando: ${inst.name || inst.token}`);
        console.log(`   â""â"€ Token: ${inst.token?.substring(0, 20)}...`);
        console.log(`   â""â"€ Status: ${inst.status}`);
        console.log(`   â""â"€ Owner: ${inst.owner || 'nÃ£o informado'}`);
        console.log(`   â""â"€ Nome que serÃ¡ usado: ${instanceName}`);
        console.log(`   â""â"€ Session que serÃ¡ usado: ${sessionName}`);

        // ðŸŽ¯ Verificar se esse nome jÃ¡ foi usado nesta importaÃ§Ã£o
        if (namesUsed.has(instanceName)) {
          console.log(`   âš ï¸  NOME DUPLICADO nesta importaÃ§Ã£o! Pulando...`);
          errors.push({
            instance: inst.name || inst.token,
            error: `Nome duplicado na lista de importaÃ§Ã£o: ${instanceName}`
          });
          continue;
        }
        namesUsed.add(instanceName);

        // ðŸŽ¯ Verificar se já existe uma instância com esse token OU nome no tenant
        const existingCheck = await tenantQuery(req, `
          SELECT id, name, instance_token FROM uaz_instances 
          WHERE (instance_token = $1 OR name = $2) AND tenant_id = $3
        `, [inst.token, instanceName, tenantId]);
        
        // Também verificar GLOBALMENTE (sem RLS) se o nome já existe em outro tenant
        const { queryNoTenant } = require('../database/tenant-query');
        const globalNameCheck = await queryNoTenant(`
          SELECT id, name, tenant_id FROM uaz_instances 
          WHERE name = $1
        `, [instanceName]);
        
        if (globalNameCheck.rows.length > 0 && globalNameCheck.rows[0].tenant_id !== tenantId) {
          console.log(`   âš ï¸  Nome "${instanceName}" jÃ¡ existe em outro tenant (ID: ${globalNameCheck.rows[0].tenant_id})`);
          // Adicionar sufixo para tornar único
          const uniqueName = `${instanceName} (Tenant ${tenantId})`;
          console.log(`   ðŸ"„ Renomeando para: ${uniqueName}`);
          instanceName = uniqueName;
        }

        let result;
        if (existingCheck.rows.length > 0) {
          // Já existe - ATUALIZAR
          console.log(`   âš ï¸  Instância já existe (ID: ${existingCheck.rows[0].id}) - Atualizando...`);
          result = await tenantQuery(req, `
            UPDATE uaz_instances SET
              name = $1,
              session_name = $2,
              phone_number = $3,
              profile_name = $4,
              profile_pic_url = $5,
              is_connected = $6,
              status = $7,
              is_active = $8,
              updated_at = NOW()
            WHERE instance_token = $9 AND tenant_id = $10
            RETURNING *
          `, [
            instanceName,
            sessionName,
            inst.owner || null,
            inst.profileName || null,
            inst.profilePicUrl || null,
            inst.status === 'connected',
            inst.status || 'disconnected',
            true,
            inst.token,
            tenantId
          ]);
        } else {
          // Não existe - CRIAR
          console.log(`   âž• Nova instância - Criando...`);
          result = await tenantQuery(req, `
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
            instanceName,
            sessionName,
            inst.token,
            inst.owner || null,
            inst.profileName || null,
            inst.profilePicUrl || null,
            inst.status === 'connected',
            inst.status || 'disconnected',
            true,
            tenantId
          ]);
        }

        const importedInstance = result.rows[0];
        imported.push(importedInstance);

        console.log(`   âœ… Sucesso (ID: ${importedInstance.id})`);

      } catch (error) {
        console.error(`   âŒ Erro ao importar ${inst.name}:`, error.message);
        errors.push({
          instance: inst.name || inst.token,
          error: error.message
        });
      }
    }

    console.log('\nðŸ"Š ========================================');
    console.log(`ðŸ"Š RESUMO DA IMPORTAÃ‡ÃƒO:`);
    console.log(`   â"œâ"€ Total solicitado: ${instances.length}`);
    console.log(`   â"œâ"€ Importadas com sucesso: ${imported.length}`);
    console.log(`   â""â"€ Erros: ${errors.length}`);
    console.log('ðŸ"Š ========================================\n');

    // ðŸŽ¯ Retornar success=false se nenhuma instÃ¢ncia foi importada
    const hasSuccess = imported.length > 0;
    const hasErrors = errors.length > 0;

    if (!hasSuccess && hasErrors) {
      // Todas falharam
      return res.status(400).json({
        success: false,
        error: `Falha ao importar todas as instÃ¢ncias. Erros: ${errors.map(e => e.error).join(', ')}`,
        imported: 0,
        errors: errors.length,
        errorDetails: errors
      });
    }

    res.json({
      success: hasSuccess,
      imported: imported.length,
      errors: errors.length,
      instances: imported,
      errorDetails: errors,
      message: hasErrors 
        ? `${imported.length} importada(s) com sucesso, ${errors.length} com erro(s)`
        : `${imported.length} instÃ¢ncia(s) importada(s) com sucesso!`
    });

  } catch (error) {
    console.error('âŒ Erro ao importar instÃ¢ncias:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/uaz/contact/details
 * ObtÃ©m detalhes completos de um contato, incluindo foto de perfil
 */
router.post('/contact/details', async (req, res) => {
  try {
    const { instance_id, phone_number, preview = false } = req.body;

    // ðŸ”’ SEGURANÃ‡A: Obter tenant_id do request
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        error: 'Tenant nÃ£o identificado'
      });
    }

    if (!instance_id || !phone_number) {
      return res.status(400).json({
        success: false,
        error: 'instance_id e phone_number sÃ£o obrigatÃ³rios'
      });
    }

    console.log('\nðŸ“¸ ========================================');
    console.log('ðŸ“¸ BUSCANDO DETALHES DO CONTATO');
    console.log('ðŸ“¸ ========================================');
    console.log(`   â”œâ”€ InstÃ¢ncia ID: ${instance_id}`);
    console.log(`   â”œâ”€ NÃºmero: ${phone_number}`);
    console.log(`   â””â”€ Tamanho foto: ${preview ? 'Preview (pequeno)' : 'Full (original)'}`);

    // Busca instÃ¢ncia e proxy com filtro de tenant
    const instance = await tenantQuery(req, `
      SELECT ui.*, p.host, p.port, p.username, p.password
      FROM uaz_instances ui
      LEFT JOIN proxies p ON ui.proxy_id = p.id
      WHERE ui.id = $1 AND ui.tenant_id = $2
    `, [instance_id, tenantId]);

    if (instance.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'InstÃ¢ncia nÃ£o encontrada'
      });
    }

    const inst = instance.rows[0];

    if (!inst.instance_token) {
      return res.status(400).json({
        success: false,
        error: 'InstÃ¢ncia nÃ£o possui token'
      });
    }

    // ConfiguraÃ§Ã£o do proxy
    const proxyConfig = inst.host ? {
      host: inst.host,
      port: inst.port,
      username: inst.username,
      password: inst.password
    } : null;

    // ðŸ”‘ BUSCAR CREDENCIAIS DO TENANT
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

    // ðŸ“¸ Se houver foto de perfil, baixar e salvar localmente
    let localProfilePicUrl = null;
    if (result.profilePicUrl && result.profilePicUrl.includes('pps.whatsapp.net')) {
      try {
        console.log('ðŸ“¥ Baixando foto de perfil para salvar localmente...');
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

        // Gerar nome Ãºnico para o arquivo
        const hash = crypto.createHash('md5').update(phone_number).digest('hex');
        const timestamp = Date.now();
        const filename = `profile_${hash}_${timestamp}.jpg`;
        const filepath = path.join(__dirname, '../../uploads/profile-pics', filename);

        // Criar diretÃ³rio se nÃ£o existir
        const dir = path.dirname(filepath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
          console.log('   ðŸ“ DiretÃ³rio criado:', dir);
        }

        // Salvar arquivo
        fs.writeFileSync(filepath, Buffer.from(imageResponse.data));
        
        // URL relativa para retornar ao frontend
        localProfilePicUrl = `/uploads/profile-pics/${filename}`;
        
        console.log('âœ… Foto salva localmente:', localProfilePicUrl);
        console.log('   Caminho completo:', filepath);
      } catch (downloadError) {
        console.error('âŒ Erro ao baixar foto:', downloadError.message);
        console.error('   Status:', downloadError.response?.status);
        console.error('   URL tentada:', result.profilePicUrl);
        // Se falhar, retorna null (nÃ£o usa a URL original que nÃ£o funciona)
        localProfilePicUrl = null;
      }
    } else if (result.profilePicUrl) {
      // Se nÃ£o for URL do WhatsApp, usa direto
      localProfilePicUrl = result.profilePicUrl;
    }

    console.log('âœ… Detalhes do contato retornados com sucesso!');
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
    console.error('âŒ Erro ao buscar detalhes do contato:', error);
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
        error: 'URL Ã© obrigatÃ³ria'
      });
    }

    console.log('ðŸ–¼ï¸ Proxy de imagem solicitado:', url);

    // Fazer requisiÃ§Ã£o para buscar a imagem
    const axios = require('axios');
    const imageResponse = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    // Detectar tipo de conteÃºdo
    const contentType = imageResponse.headers['content-type'] || 'image/jpeg';
    
    // Definir headers corretos
    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=86400'); // Cache por 24h
    res.set('Access-Control-Allow-Origin', '*');
    
    // Enviar imagem
    res.send(Buffer.from(imageResponse.data));

    console.log('âœ… Imagem proxy servida com sucesso!');

  } catch (error) {
    console.error('âŒ Erro ao fazer proxy da imagem:', error.message);
    console.error('   â””â”€ Status:', error.response?.status);
    console.error('   â””â”€ StatusText:', error.response?.statusText);
    console.error('   â””â”€ URL:', url);
    
    // Se o erro for de rede/timeout, retornar um placeholder ou erro mais especÃ­fico
    const statusCode = error.response?.status || 500;
    res.status(statusCode).json({
      success: false,
      error: 'Erro ao carregar imagem: ' + error.message
    });
  }
});

/**
 * POST /api/uaz/reconfigure-webhooks
 * Reconfigura webhooks de TODAS as instÃ¢ncias ativas do tenant
 * Ãštil quando a URL do webhook muda ou para corrigir configuraÃ§Ãµes
 */
router.post('/reconfigure-webhooks', async (req, res) => {
  try {
    console.log('\nðŸ”§ ===== RECONFIGURANDO WEBHOOKS DE TODAS AS INSTÃ‚NCIAS =====');
    
    // ðŸ”’ SEGURANÃ‡A: Verificar tenant
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        error: 'Tenant nÃ£o identificado'
      });
    }

    // Buscar todas as instÃ¢ncias ativas do tenant
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
    console.log(`ðŸ“‹ Encontradas ${instances.length} instÃ¢ncias ativas`);

    if (instances.length === 0) {
      return res.json({
        success: true,
        message: 'Nenhuma instÃ¢ncia ativa encontrada',
        results: []
      });
    }

    // URL do webhook QR Connect
    const webhookUrl = process.env.QR_WEBHOOK_URL || 
      (process.env.WEBHOOK_BASE_URL ? `${process.env.WEBHOOK_BASE_URL}/api/qr-webhook/uaz-event` : null) ||
      'https://api.sistemasnettsistemas.com.br/api/qr-webhook/uaz-event';

    console.log(`ðŸ”— Webhook URL: ${webhookUrl}`);

    // ðŸ”‘ Buscar credenciais do tenant
    const credentials = await getTenantUazapCredentials(tenantId);
    const tenantUazService = new UazService(credentials.serverUrl, credentials.adminToken);

    const results = [];

    for (const inst of instances) {
      try {
        console.log(`\nðŸ“¡ Configurando webhook para: ${inst.name} (ID: ${inst.id})`);

        if (!inst.instance_token) {
          console.log('   âš ï¸ Sem token, pulando...');
          results.push({
            id: inst.id,
            name: inst.name,
            success: false,
            error: 'InstÃ¢ncia sem token'
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
          console.log(`   âœ… Webhook configurado com sucesso!`);
          results.push({
            id: inst.id,
            name: inst.name,
            success: true,
            webhookUrl: webhookUrl
          });
        } else {
          console.log(`   âŒ Erro: ${result.error}`);
          results.push({
            id: inst.id,
            name: inst.name,
            success: false,
            error: result.error
          });
        }
      } catch (error) {
        console.error(`   âŒ ExceÃ§Ã£o: ${error.message}`);
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

    console.log(`\nðŸ“Š Resumo: ${successCount} sucesso, ${failCount} falhas`);
    console.log('===== FIM DA RECONFIGURAÃ‡ÃƒO =====\n');

    res.json({
      success: true,
      message: `Webhooks reconfigurados: ${successCount} sucesso, ${failCount} falhas`,
      webhookUrl: webhookUrl,
      results: results
    });

  } catch (error) {
    console.error('âŒ Erro ao reconfigurar webhooks:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/uaz/instances/:id/reconfigure-webhook
 * Reconfigura webhook de uma instÃ¢ncia especÃ­fica
 */
router.post('/instances/:id/reconfigure-webhook', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`\nðŸ”§ Reconfigurando webhook da instÃ¢ncia ${id}...`);
    
    // ðŸ”’ SEGURANÃ‡A: Verificar tenant
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        error: 'Tenant nÃ£o identificado'
      });
    }

    // Buscar instÃ¢ncia
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
        error: 'InstÃ¢ncia nÃ£o encontrada'
      });
    }

    const inst = instanceResult.rows[0];

    if (!inst.instance_token) {
      return res.status(400).json({
        success: false,
        error: 'InstÃ¢ncia sem token'
      });
    }

    // URL do webhook QR Connect
    const webhookUrl = process.env.QR_WEBHOOK_URL || 
      (process.env.WEBHOOK_BASE_URL ? `${process.env.WEBHOOK_BASE_URL}/api/qr-webhook/uaz-event` : null) ||
      'https://api.sistemasnettsistemas.com.br/api/qr-webhook/uaz-event';

    // ðŸ”‘ Buscar credenciais do tenant
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
      console.log(`âœ… Webhook configurado para ${inst.name}`);
      res.json({
        success: true,
        message: `Webhook configurado com sucesso para ${inst.name}`,
        webhookUrl: webhookUrl,
        data: result.data
      });
    } else {
      console.log(`âŒ Erro ao configurar webhook: ${result.error}`);
      res.status(500).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    console.error('âŒ Erro ao reconfigurar webhook:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/uaz/debug/all-instances
 * [TEMPORÁRIO] Busca TODAS as instâncias UAZ no sistema para debug
 * [SEM AUTENTICAÇÃO - APENAS PARA DEBUG]
 */
router.get('/debug/all-instances', async (req, res) => {
  try {
    console.log('\n🔍 ========================================');
    console.log('🔍 DEBUG: BUSCANDO TODAS INSTÂNCIAS UAZ');
    console.log('🔍 ========================================\n');

    // Buscar TODAS as instâncias (sem filtro de tenant) usando pool diretamente
    const allInstances = await pool.query(`
      SELECT 
        id,
        name,
        session_name,
        instance_token,
        tenant_id,
        phone_number,
        is_active,
        is_connected,
        status,
        created_at
      FROM uaz_instances 
      ORDER BY tenant_id NULLS FIRST, id
    `);

    console.log(`📊 Total encontrado: ${allInstances.rows.length}`);

    // Agrupar por tenant
    const byTenant = {};
    const orphans = [];

    allInstances.rows.forEach(inst => {
      if (inst.tenant_id === null) {
        orphans.push(inst);
      } else {
        if (!byTenant[inst.tenant_id]) {
          byTenant[inst.tenant_id] = [];
        }
        byTenant[inst.tenant_id].push(inst);
      }
    });

    console.log(`   Órfãs (sem tenant): ${orphans.length}`);
    Object.keys(byTenant).forEach(tid => {
      console.log(`   Tenant ${tid}: ${byTenant[tid].length}`);
    });

    // Procurar instância específica
    const nettcredInstances = allInstances.rows.filter(inst => 
      inst.name && (inst.name.includes('8104-5992') || inst.name.includes('NETTCRED'))
    );

    if (nettcredInstances.length > 0) {
      console.log(`\n✅ Encontradas ${nettcredInstances.length} instâncias NETTCRED:\n`);
      nettcredInstances.forEach(inst => {
        console.log(`   ID: ${inst.id} | Nome: ${inst.name} | Tenant: ${inst.tenant_id}`);
      });
    }

    // Retornar HTML formatado para facilitar leitura
    let html = '<html><head><meta charset="utf-8"><style>body{font-family:monospace;padding:20px;background:#1e1e1e;color:#fff;}pre{background:#2d2d2d;padding:15px;border-radius:5px;overflow-x:auto;}.success{color:#4ec9b0;}.error{color:#f48771;}.warning{color:#dcdcaa;}</style></head><body>';
    html += '<h1>🔍 DEBUG: TODAS INSTÂNCIAS UAZ</h1>';
    html += `<p class="success">📊 Total: ${allInstances.rows.length} instância(s)</p>`;
    
    if (orphans.length > 0) {
      html += `<h2 class="warning">⚠️  Instâncias Órfãs (sem tenant): ${orphans.length}</h2><pre>`;
      orphans.forEach(inst => {
        html += `ID: ${inst.id} | Nome: ${inst.name} | Tel: ${inst.phone_number || 'N/A'} | Status: ${inst.status}\n`;
      });
      html += '</pre>';
    }
    
    Object.keys(byTenant).sort().forEach(tid => {
      html += `<h2>📦 Tenant ${tid}: ${byTenant[tid].length} instância(s)</h2><pre>`;
      byTenant[tid].forEach(inst => {
        html += `ID: ${inst.id} | Nome: ${inst.name} | Tel: ${inst.phone_number || 'N/A'} | Status: ${inst.status} | Ativa: ${inst.is_active}\n`;
      });
      html += '</pre>';
    });
    
    if (nettcredInstances.length > 0) {
      html += `<h2 class="success">✅ INSTÂNCIAS NETTCRED: ${nettcredInstances.length}</h2><pre>`;
      nettcredInstances.forEach(inst => {
        html += `ID: ${inst.id} | Nome: ${inst.name} | Tenant: ${inst.tenant_id} | Tel: ${inst.phone_number}\n`;
      });
      html += '</pre>';
    } else {
      html += '<h2 class="error">❌ NENHUMA instância NETTCRED encontrada</h2>';
    }
    
    html += '<hr><h3>📋 Dados JSON Completos:</h3><pre>' + JSON.stringify({
      success: true,
      total: allInstances.rows.length,
      byTenantCount: Object.keys(byTenant).reduce((acc, tid) => {
        acc[tid] = byTenant[tid].length;
        return acc;
      }, {}),
      orphansCount: orphans.length,
      nettcredCount: nettcredInstances.length,
      instances: allInstances.rows
    }, null, 2) + '</pre>';
    html += '</body></html>';

    res.send(html);

  } catch (error) {
    console.error('❌ Erro ao buscar instâncias:', error);
    res.status(500).send(`<html><body style="font-family:monospace;padding:20px;background:#1e1e1e;color:#f48771;"><h1>❌ Erro</h1><pre>${error.message}\n\n${error.stack}</pre></body></html>`);
  }
});

module.exports = router;

