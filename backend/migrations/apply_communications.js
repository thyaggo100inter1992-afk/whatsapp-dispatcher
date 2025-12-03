const fs = require('fs');
const path = require('path');
const { pool } = require('../dist/database/connection');

async function applyMigration() {
  try {
    console.log('📋 Aplicando migração: create_admin_communications_tables.sql');
    
    const sqlPath = path.join(__dirname, 'create_admin_communications_tables.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    await pool.query(sql);
    
    console.log('✅ Migração aplicada com sucesso!');
    
    // Verificar se as tabelas foram criadas
    const checkTables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN (
        'admin_email_campaigns',
        'admin_email_campaign_recipients',
        'admin_notifications',
        'admin_notification_reads'
      )
      ORDER BY table_name
    `);
    
    console.log('\n📊 Tabelas criadas:');
    checkTables.rows.forEach(row => {
      console.log(`   ✅ ${row.table_name}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao aplicar migração:', error);
    process.exit(1);
  }
}

applyMigration();

