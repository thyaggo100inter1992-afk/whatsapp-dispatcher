const { pool } = require('../src/database/connection');
const fs = require('fs');
const path = require('path');

async function apply() {
  try {
    const sql = fs.readFileSync(path.join(__dirname, 'create_email_accounts_table.sql'), 'utf8');
    await pool.query(sql);
    console.log('✅ Migration email_accounts aplicada!');
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error);
    await pool.end();
    process.exit(1);
  }
}

apply();

