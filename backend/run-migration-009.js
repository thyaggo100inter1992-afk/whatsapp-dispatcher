/**
 * Script para executar a Migration 009 - Listas de Restrição
 * Execute: node run-migration-009.js
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'whatsapp_dispatcher',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function runMigration() {
  let client;
  
  try {
    console.log('🚀 Iniciando Migration 009 - Listas de Restrição\n');
    
    // Conectar ao banco
    client = await pool.connect();
    console.log('✅ Conectado ao banco de dados');

    // Ler arquivo SQL
    const migrationPath = path.join(__dirname, 'src', 'database', 'migrations', '009_create_restriction_lists.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Arquivo de migration carregado');
    console.log('⏳ Executando migration...\n');

    // Executar SQL
    await client.query(sql);

    console.log('✅ Migration 009 executada com sucesso!\n');
    console.log('📋 Tabelas criadas:');
    console.log('   - restriction_list_types');
    console.log('   - restriction_list_entries');
    console.log('   - restriction_list_keywords');
    console.log('   - restriction_list_logs');
    console.log('   - restriction_list_stats');
    console.log('');
    console.log('📊 Views criadas:');
    console.log('   - active_restriction_entries');
    console.log('   - restriction_list_overview');
    console.log('');
    console.log('⚡ Triggers e Functions criados:');
    console.log('   - calculate_restriction_expiry()');
    console.log('   - update_restriction_timestamp()');
    console.log('   - log_restriction_action()');
    console.log('');
    console.log('✅ Sistema de Listas de Restrição pronto para uso!');
    console.log('');

    // Verificar se os dados foram inseridos
    const typesResult = await client.query('SELECT * FROM restriction_list_types ORDER BY id');
    console.log('📝 Tipos de lista configurados:');
    typesResult.rows.forEach(type => {
      const retention = type.retention_days ? `${type.retention_days} dias` : 'Permanente';
      console.log(`   - ${type.name} (${type.id}) - ${retention}`);
    });
    console.log('');

  } catch (error) {
    console.error('❌ Erro ao executar migration:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

runMigration();




