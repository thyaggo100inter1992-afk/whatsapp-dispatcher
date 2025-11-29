/**
 * Script para aplicar migration 015 - Adicionar colunas de perfil
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'whatsapp_dispatcher',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD
});

console.log('\n🔧 Configuração do banco:');
console.log('   Host:', process.env.DB_HOST || 'localhost');
console.log('   Port:', process.env.DB_PORT || '5432');
console.log('   Database:', process.env.DB_NAME || 'whatsapp_dispatcher');
console.log('   User:', process.env.DB_USER || 'postgres');

async function runMigration() {
  console.log('\n🔄 ===== APLICANDO MIGRATION 015 =====\n');

  try {
    // Ler o arquivo SQL
    const sqlPath = path.join(__dirname, 'src', 'database', 'migrations', '015_add_profile_columns_uaz.sql');
    
    console.log(`📄 Lendo migration: ${sqlPath}`);
    
    if (!fs.existsSync(sqlPath)) {
      console.error('❌ Arquivo SQL não encontrado:', sqlPath);
      process.exit(1);
    }
    
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Executar o arquivo SQL
    console.log('⚡ Executando SQL...\n');
    await pool.query(sql);
    
    console.log('✅ Migration aplicada com sucesso!');
    
    // Verificar se as colunas foram criadas
    const columns = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'uaz_instances'
        AND column_name IN ('profile_name', 'profile_pic_url')
      ORDER BY column_name
    `);

    console.log('\n📋 Colunas de perfil criadas:');
    console.table(columns.rows);
    
    console.log('\n========================================');
    console.log('✅ PRONTO! Agora o sistema pode armazenar:');
    console.log('   - Nome do perfil do WhatsApp');
    console.log('   - URL da foto do perfil');
    console.log('   - Número de telefone da conexão');
    console.log('========================================\n');
    
    console.log('📌 Próximos passos:');
    console.log('   1. Reinicie o backend');
    console.log('   2. Clique em "Status" nas suas conexões');
    console.log('   3. O número de telefone será exibido automaticamente\n');

  } catch (error) {
    console.error('\n❌ ERRO ao aplicar migration:\n');
    console.error(error.message);
    console.error('\n📋 Detalhes do erro:\n', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

// Executar
runMigration();










