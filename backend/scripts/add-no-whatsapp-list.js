const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function runMigration() {
  try {
    console.log('🚀 Iniciando migration: Adicionar lista "Sem WhatsApp"...');
    
    // Ler o arquivo SQL
    const sqlPath = path.join(__dirname, '..', 'src', 'database', 'migrations', '010_add_no_whatsapp_list.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Executar a migration
    await pool.query(sql);
    
    console.log('✅ Migration executada com sucesso!');
    console.log('📋 Nova lista "Sem WhatsApp" (no_whatsapp) adicionada ao sistema.');
    
  } catch (error) {
    console.error('❌ Erro ao executar migration:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();

