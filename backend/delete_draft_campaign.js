const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'whatsapp_user',
  password: 'Tg130992*',
  database: 'whatsapp_dispatcher'
});

pool.query("DELETE FROM admin_email_campaigns WHERE name LIKE 'Nome da Campanha%' AND status = 'draft'")
  .then(result => {
    console.log(`✅ ${result.rowCount} campanha(s) deletada(s)!`);
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Erro:', err.message);
    process.exit(1);
  });

