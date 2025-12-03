/**
 * Script para reconfigurar webhooks de todas as instâncias UAZAPI
 * Execute: node scripts/reconfigure-webhooks.js
 */

const { Pool } = require('pg');
const axios = require('axios');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'whatsapp_dispatcher',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD
});

const WEBHOOK_URL = 'https://api.sistemasnettsistemas.com.br/api/qr-webhook/uaz-event';

async function getCredentials(tenantId) {
  try {
    // Buscar credencial do tenant
    const result = await pool.query(`
      SELECT 
        uc.server_url,
        uc.admin_token
      FROM tenants t
      LEFT JOIN uazap_credentials uc ON t.uazap_credential_id = uc.id
      WHERE t.id = $1 AND uc.is_active = true
    `, [tenantId]);

    if (result.rows.length > 0 && result.rows[0].server_url) {
      return {
        serverUrl: result.rows[0].server_url,
        adminToken: result.rows[0].admin_token
      };
    }

    // Buscar credencial padrão
    const defaultResult = await pool.query(`
      SELECT server_url, admin_token
      FROM uazap_credentials
      WHERE is_default = true AND is_active = true
      LIMIT 1
    `);

    if (defaultResult.rows.length > 0) {
      return {
        serverUrl: defaultResult.rows[0].server_url,
        adminToken: defaultResult.rows[0].admin_token
      };
    }

    // Fallback
    return {
      serverUrl: process.env.UAZ_SERVER_URL || 'https://nettsistemas.uazapi.com',
      adminToken: process.env.UAZ_ADMIN_TOKEN || ''
    };
  } catch (error) {
    return {
      serverUrl: process.env.UAZ_SERVER_URL || 'https://nettsistemas.uazapi.com',
      adminToken: process.env.UAZ_ADMIN_TOKEN || ''
    };
  }
}

async function reconfigureWebhooks() {
  console.log('\n🔧 ===== RECONFIGURANDO WEBHOOKS DE TODAS AS INSTÂNCIAS =====\n');
  console.log('🔗 Webhook URL:', WEBHOOK_URL);
  
  try {
    // DEBUG: Ver todas as instâncias
    const allInstances = await pool.query('SELECT id, name, is_active, instance_token IS NOT NULL as has_token FROM uaz_instances');
    console.log('📋 TODAS as instâncias no banco:', allInstances.rows.length);
    allInstances.rows.forEach(i => {
      console.log(`   [${i.id}] ${i.name} - ativo: ${i.is_active}, token: ${i.has_token}`);
    });
    
    // Buscar todas as instâncias com token (independente de is_active)
    const result = await pool.query(`
      SELECT ui.id, ui.name, ui.instance_token, ui.phone_number, ui.tenant_id, ui.is_active,
             p.host as proxy_host, p.port as proxy_port, 
             p.username as proxy_username, p.password as proxy_password
      FROM uaz_instances ui
      LEFT JOIN proxies p ON ui.proxy_id = p.id
      WHERE ui.instance_token IS NOT NULL
    `);
    
    console.log('📋 Instâncias encontradas:', result.rows.length);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const inst of result.rows) {
      console.log('\n📡 [' + inst.id + '] ' + inst.name + ' (' + (inst.phone_number || 'sem número') + ')');
      
      try {
        // Buscar credenciais do tenant
        const credentials = await getCredentials(inst.tenant_id);
        const serverUrl = credentials.serverUrl;
        
        console.log('   🔑 Server:', serverUrl);
        
        const response = await axios.post(
          serverUrl + '/webhook',
          {
            enabled: true,
            url: WEBHOOK_URL,
            events: [
              'connection',
              'history',
              'messages',
              'messages_update',
              'call',
              'contacts',
              'presence',
              'groups',
              'labels',
              'chats',
              'chat_labels',
              'blocks',
              'leads',
              'sender'
            ],
            excludeMessages: ['wasSentByApi']
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'token': inst.instance_token
            },
            timeout: 15000
          }
        );
        
        console.log('   ✅ Webhook configurado com sucesso!');
        successCount++;
      } catch (error) {
        console.log('   ❌ Erro:', error.response?.data?.error || error.message);
        errorCount++;
      }
    }
    
    console.log('\n📊 ===== RESUMO =====');
    console.log('   ✅ Sucesso:', successCount);
    console.log('   ❌ Falhas:', errorCount);
    console.log('   📋 Total:', result.rows.length);
    console.log('=========================\n');
    
  } catch (error) {
    console.error('❌ Erro ao consultar banco:', error.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

reconfigureWebhooks();
