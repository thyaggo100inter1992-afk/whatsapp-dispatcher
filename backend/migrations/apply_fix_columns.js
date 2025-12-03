const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'whatsapp_user',
  password: 'Tg130992*',
  database: 'whatsapp_dispatcher'
});

const sql = fs.readFileSync(path.join(__dirname, 'fix_admin_email_campaigns_columns.sql'), 'utf8');

pool.query(sql)
  .then(() => {
    console.log('✅ Migration aplicada com sucesso!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Erro:', err.message);
    process.exit(1);
  });

