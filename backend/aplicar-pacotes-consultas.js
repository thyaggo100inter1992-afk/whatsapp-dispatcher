/**
 * Script para aplicar migration de pacotes de consultas avulsas
 * 
 * Uso: node aplicar-pacotes-consultas.js
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
  console.log('  APLICANDO MIGRATION: Pacotes de Consultas Avulsas');
  console.log('========================================\n');

  try {
    // Ler arquivo SQL
    const migrationPath = path.join(__dirname, 'migrations', 'create_consultas_avulsas_pacotes.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Arquivo de migration carregado');
    console.log('🔄 Executando SQL...\n');

    // Executar migration
    await pool.query(migrationSQL);

    console.log('\n✅ Migration aplicada com sucesso!');
    console.log('\n📊 Pacotes padrão inseridos:');
    console.log('   1. Básico: 10 consultas por R$ 15,00');
    console.log('   2. Intermediário: 50 consultas por R$ 60,00 (⭐ Popular)');
    console.log('   3. Avançado: 100 consultas por R$ 100,00');
    console.log('   4. Profissional: 200 consultas por R$ 180,00');

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




