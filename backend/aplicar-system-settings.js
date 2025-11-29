const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Usar as configurações do arquivo de conexão
const { pool } = require('./src/database/connection');

async function aplicarMigration() {
  try {
    console.log('\n╔══════════════════════════════════════════════════════╗');
    console.log('║  📦 Aplicando Migration: System Settings            ║');
    console.log('╚══════════════════════════════════════════════════════╝\n');

    const sqlPath = path.join(__dirname, 'src/database/migrations/030_create_system_settings.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('🔄 Executando SQL...\n');
    
    const result = await pool.query(sql);
    
    console.log('\n✅ Migration aplicada com sucesso!');
    console.log('\n📊 Configurações criadas:');
    
    // Listar configurações
    const settings = await pool.query(`
      SELECT setting_key, setting_type, description, is_public
      FROM system_settings
      ORDER BY setting_key
    `);
    
    settings.rows.forEach(row => {
      const publicTag = row.is_public ? '🌐 Pública' : '🔒 Privada';
      console.log(`   ${publicTag} ${row.setting_key} (${row.setting_type})`);
      console.log(`      ${row.description}`);
    });
    
    console.log('\n🎉 Sistema de configurações pronto para uso!\n');
    
  } catch (error) {
    console.error('\n❌ Erro ao aplicar migration:', error.message);
    if (error.message.includes('already exists')) {
      console.log('\n✅ Tabela já existe! Sistema já está configurado.\n');
    }
  } finally {
    await pool.end();
  }
}

aplicarMigration();

