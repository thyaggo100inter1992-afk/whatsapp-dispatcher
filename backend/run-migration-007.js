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
    const migrationPath = path.join(__dirname, 'src', 'database', 'migrations', '007_add_button_clicks.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('🔄 Executando migration 007_add_button_clicks.sql...');
    
    await client.query(migrationSQL);
    
    console.log('✅ Migration 007 executada com sucesso!');
    console.log('✅ Tabela button_clicks criada');
    
  } catch (error) {
    console.error('❌ Erro ao executar migration:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();





