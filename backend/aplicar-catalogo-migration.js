/**
 * Script para aplicar migration do catálogo de produtos
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
  console.log('\n🔄 ===== APLICANDO MIGRATION DO CATÁLOGO =====\n');
  
  try {
    // Ler arquivo SQL
    const sqlPath = path.join(__dirname, 'src', 'database', 'migrations', '012_create_products.sql');
    console.log(`📄 Lendo migration: ${sqlPath}`);
    
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Executar SQL
    console.log('⚡ Executando SQL...\n');
    await pool.query(sql);
    
    console.log('✅ Migration aplicada com sucesso!');
    console.log('\n📋 Tabela "products" criada com sucesso!');
    console.log('\nColunas criadas:');
    console.log('  - id (SERIAL PRIMARY KEY)');
    console.log('  - whatsapp_account_id (INTEGER)');
    console.log('  - name (VARCHAR)');
    console.log('  - description (TEXT)');
    console.log('  - price (DECIMAL)');
    console.log('  - currency (VARCHAR)');
    console.log('  - image_url (TEXT)');
    console.log('  - in_stock (BOOLEAN)');
    console.log('  - stock_quantity (INTEGER)');
    console.log('  - category (VARCHAR)');
    console.log('  - sku (VARCHAR)');
    console.log('  - url (TEXT)');
    console.log('  - is_active (BOOLEAN)');
    console.log('  - created_at (TIMESTAMP)');
    console.log('  - updated_at (TIMESTAMP)');
    
    console.log('\n========================================');
    console.log('🎉 Catálogo pronto para uso!');
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

