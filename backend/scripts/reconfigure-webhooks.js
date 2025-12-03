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

async function reconfigureWebhooks() {
  console.log('\n🔧 ===== RECONFIGURANDO WEBHOOKS DE TODAS AS INSTÂNCIAS =====\n');
  console.log('🔗 Webhook URL:', WEBHOOK_URL);
  
  try {
    // Buscar todas as instâncias ativas com token
    const result = await pool.query(`
      SELECT ui.id, ui.name, ui.instance_token, ui.phone_number, ui.tenant_id,
             tc.uazapi_server_url, tc.uazapi_admin_token,
             p.host as proxy_host, p.port as proxy_port, 
             p.username as proxy_username, p.password as proxy_password
      FROM uaz_instances ui
      JOIN tenants t ON ui.tenant_id = t.id
      LEFT JOIN tenant_credentials tc ON t.id = tc.tenant_id
      LEFT JOIN proxies p ON ui.proxy_id = p.id
      WHERE ui.is_active = true AND ui.instance_token IS NOT NULL
    `);
    
    console.log('📋 Instâncias encontradas:', result.rows.length);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const inst of result.rows) {
      console.log('\n📡 [' + inst.id + '] ' + inst.name + ' (' + (inst.phone_number || 'sem número') + ')');
      
      try {
        const serverUrl = inst.uazapi_server_url || 'https://nettsistemas.uazapi.com';
        
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

