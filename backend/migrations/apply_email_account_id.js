const fs = require('fs');
const path = require('path');
const { pool } = require('../dist/database/connection');

async function applyMigration() {
  try {
    console.log('📋 Aplicando migração: add_email_account_id_to_email_templates.sql');
    
    const sqlPath = path.join(__dirname, 'add_email_account_id_to_email_templates.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    await pool.query(sql);
    
    console.log('✅ Migração aplicada com sucesso!');
    
    // Verificar se a coluna foi criada
    const checkResult = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'email_templates' 
      AND column_name = 'email_account_id'
    `);
    
    if (checkResult.rows.length > 0) {
      console.log('✅ Coluna email_account_id criada com sucesso!');
      console.log('   Tipo:', checkResult.rows[0].data_type);
    } else {
      console.log('⚠️ Coluna não foi criada');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao aplicar migração:', error);
    process.exit(1);
  }
}

applyMigration();

