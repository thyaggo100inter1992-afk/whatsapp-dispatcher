/**
 * Script para aplicar migration de sincronização do catálogo
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

async function aplicarMigration() {
  console.log('\n🔄 ===== APLICANDO MIGRATION DE SINCRONIZAÇÃO =====\n');
  
  try {
    const sqlPath = path.join(__dirname, 'src', 'database', 'migrations', '013_add_catalog_sync_fields.sql');
    console.log(`📄 Lendo migration: ${sqlPath}`);
    
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('⚡ Executando SQL...\n');
    await pool.query(sql);
    
    console.log('✅ Migration aplicada com sucesso!');
    console.log('\n📋 Campos adicionados:');
    console.log('\n  whatsapp_accounts:');
    console.log('    - facebook_catalog_id (VARCHAR)');
    console.log('\n  products:');
    console.log('    - facebook_product_id (VARCHAR)');
    console.log('    - synced_at (TIMESTAMP)');
    console.log('    - sync_status (VARCHAR)');
    
    console.log('\n========================================');
    console.log('🎉 Sincronização com WhatsApp pronta!');
    console.log('========================================\n');
    
  } catch (error) {
    console.error('\n❌ ERRO ao aplicar migration:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

aplicarMigration();

