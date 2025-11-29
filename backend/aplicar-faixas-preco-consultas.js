/**
 * Script para aplicar migration de faixas de preço
 * 
 * Uso: node aplicar-faixas-preco-consultas.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'whatsapp_api',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function aplicarMigration() {
  console.log('\n========================================');
  console.log('  APLICANDO MIGRATION: Faixas de Preço');
  console.log('========================================\n');

  try {
    // Ler arquivo SQL
    const migrationPath = path.join(__dirname, 'migrations', 'create_consultas_faixas_preco.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Arquivo de migration carregado');
    console.log('🔄 Executando SQL...\n');

    // Executar migration
    await pool.query(migrationSQL);

    console.log('\n✅ Migration aplicada com sucesso!');
    console.log('\n📊 Faixas de preço padrão inseridas:');
    console.log('   1. 1-49 consultas: R$ 1,50 por consulta');
    console.log('   2. 50-99 consultas: R$ 1,20 por consulta');
    console.log('   3. 100-199 consultas: R$ 1,00 por consulta');
    console.log('   4. 200+ consultas: R$ 0,90 por consulta');

  } catch (error) {
    console.error('\n❌ Erro ao aplicar migration:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

// Executar
aplicarMigration()
  .then(() => {
    console.log('\n✅ Processo concluído!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erro fatal:', error);
    process.exit(1);
  });




