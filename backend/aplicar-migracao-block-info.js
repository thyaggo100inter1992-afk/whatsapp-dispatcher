/**
 * Script para aplicar migração: adicionar block_id e block_order
 * Execute: node aplicar-migracao-block-info.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// CONFIGURAR SUAS CREDENCIAIS DO BANCO AQUI:
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'whatsapp_dispatcher',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'Tg130992*', // ⚠️ COLOQUE A SENHA CORRETA AQUI
});

async function aplicarMigracao() {
  let client;
  try {
    console.log('📊 Conectando ao banco de dados...');
    client = await pool.connect();
    
    console.log('📄 Lendo arquivo de migração...');
    const sql = fs.readFileSync(
      path.join(__dirname, 'src/database/migrations/025_add_block_info_to_qr_template_media.sql'),
      'utf8'
    );
    
    console.log('🚀 Aplicando migração...');
    await client.query(sql);
    
    console.log('✅ ============================================');
    console.log('✅ MIGRAÇÃO APLICADA COM SUCESSO!');
    console.log('✅ Colunas block_id e block_order adicionadas');
    console.log('✅ ============================================');
    
    // Verificar se as colunas foram criadas
    const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'qr_template_media' 
      AND column_name IN ('block_id', 'block_order')
    `);
    
    console.log('\n📋 Colunas verificadas:');
    result.rows.forEach(row => {
      console.log(`   ✓ ${row.column_name} (${row.data_type})`);
    });
    
  } catch (error) {
    console.error('❌ Erro ao aplicar migração:', error.message);
    process.exit(1);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

aplicarMigracao();

