const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'whatsapp_user',
  password: 'Tg130992*',
  database: 'whatsapp_dispatcher'
});

pool.query('SELECT * FROM admin_email_campaign_recipients WHERE campaign_id = 6 LIMIT 10')
  .then(r => {
    console.log('=== RECIPIENTS DA CAMPANHA 6 ===');
    console.log(`Total: ${r.rows.length}`);
    r.rows.forEach((row, idx) => {
      console.log(`${idx + 1}. ${row.email} - Status: ${row.status} - Enviado em: ${row.sent_at}`);
    });
    process.exit(0);
  })
  .catch(err => {
    console.error('Erro:', err.message);
    process.exit(1);
  });

