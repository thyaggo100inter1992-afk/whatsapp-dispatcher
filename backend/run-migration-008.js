const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigration() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'whatsapp_dispatcher',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  });

  try {
    await client.connect();
    console.log('✅ Conectado ao banco de dados');

    // Ler arquivo de migration
    const migrationPath = path.join(__dirname, 'src', 'database', 'migrations', '008_add_campaign_counters.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('🔄 Executando migration 008_add_campaign_counters.sql...');
    
    await client.query(migrationSQL);
    
    console.log('✅ Migration 008 executada com sucesso!');
    console.log('📊 Novas colunas adicionadas:');
    console.log('   • no_whatsapp_count (números sem WhatsApp)');
    console.log('   • button_clicks_count (total de cliques nos botões)');
    
  } catch (error) {
    console.error('❌ Erro ao executar migration:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();

