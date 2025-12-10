/**
 * Script para adicionar coluna batch_size na tabela novavida_jobs
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'whatsapp_dispatcher',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
});

async function main() {
  try {
    console.log('\n🔧 ===== EXECUTANDO MIGRATION: ADD BATCH_SIZE =====\n');

    // Ler o arquivo SQL
    const sqlPath = path.join(__dirname, '../migrations/add_batch_size_to_novavida_jobs.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('📝 SQL a ser executado:');
    console.log(sql);
    console.log('\n🚀 Executando...\n');

    // Executar
    await pool.query(sql);

    console.log('✅ Migration executada com sucesso!');
    console.log('✅ Coluna batch_size adicionada à tabela novavida_jobs\n');

  } catch (error) {
    console.error('\n❌ ERRO:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();

