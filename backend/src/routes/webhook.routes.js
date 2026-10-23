const express = require('express');
const router = express.Router();

/**
 * Rota Genérica de Webhook
 * Endpoint para receber notificações de serviços externos
 */

const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || 'seu_token_secreto_aqui';

// Importar middlewares ANTES de usar
let authenticate, setTenantContext;
try {
  authenticate = require('../middleware/auth.middleware').authenticate;
  setTenantContext = require('../middleware/tenant.middleware').setTenantContext;
} catch (e) {
  authenticate = require('../../dist/middleware/auth.middleware').authenticate;
  setTenantContext = require('../../dist/middleware/tenant.middleware').setTenantContext;
}

// Obter informações do webhook - REQUER AUTENTICAÇÃO PARA BUSCAR WEBHOOK DO TENANT
router.get('/info', authenticate, setTenantContext, async (req, res) => {
  try {
    const { query } = require('../database/tenant-query');
    const tenantId = req.tenant?.id;

    if (!tenantId) {
      return res.status(401).json({ 
        success: false, 
        error: 'Tenant não identificado' 
      });
    }

    // 🔍 BUSCAR WEBHOOK_URL ESPECÍFICA DO TENANT
    const tenantResult = await query('SELECT webhook_url FROM tenants WHERE id = $1', [tenantId]);
    const tenantWebhookUrl = tenantResult.rows[0]?.webhook_url;

    if (!tenantWebhookUrl) {
      console.warn(`⚠️ Tenant ${tenantId} não tem webhook_url configurada`);
      return res.status(404).json({ 
        success: false, 
        error: 'URL de webhook não configurada para este tenant' 
      });
    }

    let ngrokUrl = null;
    let finalWebhookUrl = tenantWebhookUrl;
    
    // Tentar obter URL do ngrok (server-side, sem problemas de CORS)
    try {
      const http = require('http');
      const options = {
        hostname: 'localhost',
        port: 4040,
        path: '/api/tunnels',
        method: 'GET',
        timeout: 2000
      };

      ngrokUrl = await new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            try {
              const parsed = JSON.parse(data);
              if (parsed.tunnels && parsed.tunnels.length > 0) {
                resolve(parsed.tunnels[0].public_url);
              } else {
                resolve(null);
              }
            } catch (e) {
              resolve(null);
            }
          });
        });
        req.on('error', () => resolve(null));
        req.on('timeout', () => {
          req.destroy();
          resolve(null);
        });
        req.end();
      });

      // Se ngrok está ativo, substituir o domínio base pela URL do ngrok
      if (ngrokUrl) {
        // Extrair apenas o path do webhook do tenant (ex: /api/webhook/tenant-4)
        const webhookPath = new URL(tenantWebhookUrl).pathname;
        finalWebhookUrl = `${ngrokUrl}${webhookPath}`;
      }
    } catch (error) {
      // Ngrok não está rodando, usar URL do banco
      ngrokUrl = null;
    }
    
    return res.json({
      success: true,
      verifyToken: VERIFY_TOKEN,
      webhookUrl: finalWebhookUrl,
      ngrokUrl: ngrokUrl,
      tenantId: tenantId,
      instructions: {
        url: 'Cole a URL completa no campo "URL de callback"',
        token: 'Cole o token no campo "Verify Token"'
      }
    });
  } catch (error) {
    console.error('Erro ao buscar info do webhook:', error);
    return res.status(500).json({ error: 'Erro ao buscar informações' });
  }
});

// Verificação do webhook (GET) - usado para validar o endpoint
router.get('/', (req, res) => {
  try {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    console.log('🔔 Verificação de webhook recebida:', { mode, token, challenge });

    // Verificar se é uma requisição de verificação válida
    if (mode === 'subscribe' && token) {
      // Verificar se o token bate com o configurado
      if (token === VERIFY_TOKEN) {
        console.log('✅ Webhook verificado com sucesso!');
        
        // Responder com o challenge para confirmar o webhook
        return res.status(200).send(challenge);
      } else {
        console.log('❌ Token de verificação inválido:', token);
        return res.status(403).json({ error: 'Token de verificação inválido' });
      }
    }

    // Se não for uma verificação válida
    console.log('❌ Parâmetros de verificação inválidos');
    return res.status(400).json({ error: 'Parâmetros de verificação inválidos' });
  } catch (error) {
    console.error('❌ Erro na verificação do webhook:', error);
    return res.status(500).json({ error: 'Erro ao verificar webhook' });
  }
});

// Importar o WebhookController
let WebhookController;
try {
  WebhookController = require('../controllers/webhook.controller').WebhookController;
} catch (e) {
  WebhookController = require('../../dist/controllers/webhook.controller').WebhookController;
}
const webhookController = new WebhookController();

// ═══════════════════════════════════════════════════════════════
// 🔗 WEBHOOK POR TENANT (NOVA IMPLEMENTAÇÃO)
// ═══════════════════════════════════════════════════════════════

// Verificação do webhook por tenant (GET)
router.get('/tenant-:tenantId', (req, res) => {
  try {
    const { tenantId } = req.params;
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    console.log(`🔔 Verificação de webhook recebida para Tenant ${tenantId}:`, { mode, token });

    if (mode === 'subscribe' && token) {
      if (token === VERIFY_TOKEN) {
        console.log(`✅ Webhook verificado com sucesso para Tenant ${tenantId}!`);
        return res.status(200).send(challenge);
      } else {
        console.log(`❌ Token de verificação inválido para Tenant ${tenantId}:`, token);
        return res.status(403).json({ error: 'Token de verificação inválido' });
      }
    }

    console.log('❌ Parâmetros de verificação inválidos');
    return res.status(400).json({ error: 'Parâmetros de verificação inválidos' });
  } catch (error) {
    console.error('❌ Erro na verificação do webhook:', error);
    return res.status(500).json({ error: 'Erro ao verificar webhook' });
  }
});

// Importar QR Webhook Controller para eventos UAZAPI
let QrWebhookController;
try {
  QrWebhookController = require('../controllers/qr-webhook.controller').QrWebhookController;
} catch (e) {
  try {
    QrWebhookController = require('../../dist/controllers/qr-webhook.controller').QrWebhookController;
  } catch (e2) {
    console.warn('⚠️ QrWebhookController não encontrado');
  }
}
const qrWebhookController = QrWebhookController ? new QrWebhookController() : null;

// Receber eventos do webhook por tenant (POST) - DETECTA AUTOMATICAMENTE SE É UAZAPI OU API OFICIAL
router.post('/tenant-:tenantId', (req, res) => {
  const { tenantId } = req.params;
  
  // ✅ LOG FORÇADO PARA DEBUG
  const timestamp = new Date().toISOString();
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔔 WEBHOOK RECEBIDO ÀS ${timestamp}`);
  console.log(`📍 Tenant ID: ${tenantId}`);
  console.log(`📦 Body Type: ${typeof req.body}`);
  console.log(`📦 Body Keys: ${Object.keys(req.body || {}).join(', ')}`);
  console.log(`📦 Body completo:`, JSON.stringify(req.body, null, 2));
  console.log(`${'='.repeat(60)}\n`);
  
  // Adicionar tenantId ao request para o controller usar
  req.tenantIdFromWebhook = parseInt(tenantId);
  
  // 🔍 DETECTAR SE É EVENTO UAZAPI OU API OFICIAL
  const body = req.body;
  
  // Detectar eventos UAZAPI pelos campos específicos
  const isUazapiEvent = body.instanceName || body.instance_token || body.owner || 
                        body.token || body.messages_update || body.presence || 
                        body.connection || body.message || body.messages ||
                        (body.type && !body.entry) || body.data;
  
  // Detectar API Oficial do WhatsApp
  const isApiOficial = body.object === 'whatsapp_business_account' || body.entry;
  
  if (isUazapiEvent && !isApiOficial) {
    // 📱 É EVENTO UAZAPI (QR CONNECT)
    console.log(`🔗 [UAZAPI] Detectado evento UAZAPI para Tenant ${tenantId}`);
    
    if (qrWebhookController) {
      // Redirecionar para o QR Webhook Controller
      return qrWebhookController.receiveUazEvent(req, res);
    } else {
      console.warn(`⚠️ QrWebhookController não disponível, evento UAZAPI ignorado`);
      return res.status(200).json({ success: true, message: 'Evento UAZAPI recebido (controller não disponível)' });
    }
  }
  
  // 📱 É EVENTO API OFICIAL
  console.log(`📱 [API OFICIAL] Detectado evento API Oficial para Tenant ${tenantId}`);
  webhookController.receive(req, res);
});

// ═══════════════════════════════════════════════════════════════
// 🔗 WEBHOOK ÚNICO (COMPATIBILIDADE RETROATIVA)
// ═══════════════════════════════════════════════════════════════

// Receber eventos do webhook único (POST) - PÚBLICO!
router.post('/', (req, res) => webhookController.receive(req, res));

// Rotas protegidas (requerem autenticação)
router.get('/config', authenticate, setTenantContext, (req, res) => webhookController.getConfig(req, res));
router.get('/stats', authenticate, setTenantContext, (req, res) => webhookController.getStats(req, res));
router.get('/logs', authenticate, setTenantContext, (req, res) => webhookController.getLogs(req, res));
router.get('/status-batch', authenticate, setTenantContext, (req, res) => webhookController.getStatusBatch(req, res));
router.get('/status', authenticate, setTenantContext, (req, res) => webhookController.getStatus(req, res));

module.exports = router;
