/**
 * Script para aplicar migration do webhook_logs
 * Execute: node aplicar-migration-webhook.js
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Configuração do banco (lê do .env)
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'whatsapp_dispatcher',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres'
});

console.log('📋 Configuração do banco:');
console.log('   Host:', process.env.DB_HOST || 'localhost');
console.log('   Port:', process.env.DB_PORT || '5432');
console.log('   Database:', process.env.DB_NAME || 'whatsapp_dispatcher');
console.log('   User:', process.env.DB_USER || 'postgres');

async function aplicarMigration() {
  console.log('\n🔧 ===== APLICANDO MIGRATION WEBHOOK_LOGS =====\n');

  try {
    // Ler o arquivo SQL
    const sqlPath = path.join(__dirname, '..', 'APLICAR-WEBHOOK-FIX.sql');
    
    if (!fs.existsSync(sqlPath)) {
      console.error('❌ Arquivo SQL não encontrado:', sqlPath);
      console.log('\n📝 Criando tabela manualmente...\n');
      
      // Criar tabela manualmente
      await pool.query(`
        CREATE TABLE IF NOT EXISTS webhook_logs (
          id SERIAL PRIMARY KEY,
          request_type VARCHAR(20) NOT NULL,
          request_method VARCHAR(10) NOT NULL,
          verify_mode VARCHAR(50),
          verify_token VARCHAR(255),
          verify_challenge TEXT,
          verification_success BOOLEAN,
          webhook_object VARCHAR(100),
          event_type VARCHAR(50),
          request_body JSONB,
          request_query JSONB,
          request_headers JSONB,
          processing_status VARCHAR(50) DEFAULT 'success',
          processing_error TEXT,
          messages_processed INTEGER DEFAULT 0,
          statuses_processed INTEGER DEFAULT 0,
          clicks_detected INTEGER DEFAULT 0,
          received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          processed_at TIMESTAMP,
          whatsapp_account_id INTEGER REFERENCES whatsapp_accounts(id) ON DELETE SET NULL,
          ip_address VARCHAR(50),
          user_agent TEXT
        );
      `);

      // Criar índices
      await pool.query('CREATE INDEX IF NOT EXISTS idx_webhook_logs_received_at ON webhook_logs(received_at DESC)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_webhook_logs_request_type ON webhook_logs(request_type)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_webhook_logs_whatsapp_account ON webhook_logs(whatsapp_account_id)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_webhook_logs_processing_status ON webhook_logs(processing_status)');

      console.log('✅ Tabela webhook_logs criada com sucesso!');
    } else {
      // Executar o arquivo SQL
      const sql = fs.readFileSync(sqlPath, 'utf8');
      await pool.query(sql);
      console.log('✅ Migration aplicada com sucesso!');
    }

    // Verificar se a tabela existe
    const result = await pool.query(`
      SELECT COUNT(*) as total 
      FROM webhook_logs
    `);

    console.log(`\n📊 Total de registros na tabela: ${result.rows[0].total}\n`);
    console.log('========================================');
    console.log('✅ PRONTO! A tabela foi criada!');
    console.log('========================================\n');
    console.log('Agora:');
    console.log('  1. Reinicie o backend (Ctrl+C e rode novamente)');
    console.log('  2. Recarregue a página no navegador (F5)');
    console.log('  3. Vá para Configurações → Conta → Webhooks\n');

  } catch (error) {
    console.error('\n❌ ERRO ao aplicar migration:\n');
    console.error(error.message);
    console.error('\n📋 Detalhes do erro:\n', error);
    console.log('\n🔧 Solução alternativa:');
    console.log('  1. Abra o pgAdmin');
    console.log('  2. Conecte ao banco "whatsapp_dispatcher"');
    console.log('  3. Execute o arquivo: APLICAR-WEBHOOK-FIX.sql\n');
  } finally {
    await pool.end();
    process.exit(0);
  }
}

// Executar
aplicarMigration();

