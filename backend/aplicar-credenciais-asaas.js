/**
 * Script para aplicar migration de credenciais Asaas
 * Executa a migration 043_create_asaas_credentials_table.sql
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Configurar conexão com banco de dados
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'whatsapp_api',
  password: process.env.DB_PASSWORD || 'Tg130992*',
  port: process.env.DB_PORT || 5432
});

console.log('🔐 Conectando ao banco:', {
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'whatsapp_api',
  port: process.env.DB_PORT || 5432
});

async function aplicarMigration() {
  try {
    console.log('📦 Iniciando aplicação da migration de credenciais Asaas...\n');

    // Ler arquivo SQL
    const migrationPath = path.join(__dirname, 'src', 'database', 'migrations', '043_create_asaas_credentials_table.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Arquivo lido: 043_create_asaas_credentials_table.sql');
    console.log('🚀 Aplicando migration...\n');

    // Executar SQL
    await pool.query(sql);

    console.log('\n✅ Migration aplicada com sucesso!');
    console.log('✅ Tabela asaas_credentials criada!');
    console.log('✅ Coluna asaas_credential_id adicionada à tabela tenants!');
    
  } catch (error) {
    console.error('\n❌ Erro ao aplicar migration:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Executar
aplicarMigration();

