const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'whatsapp_user',
  password: 'Tg130992*',
  database: 'whatsapp_dispatcher'
});

pool.query('SELECT id, name, subject, recipient_type, recipient_list, email_account_ids, manual_recipients, specific_tenants, status FROM admin_email_campaigns ORDER BY id DESC LIMIT 1')
  .then(r => {
    console.log('=== ÚLTIMA CAMPANHA ===');
    console.log(JSON.stringify(r.rows[0], null, 2));
    
    // Também mostrar quantos tenants existem
    return pool.query("SELECT COUNT(*) as total FROM tenants WHERE email IS NOT NULL AND email != ''");
  })
  .then(r => {
    console.log('\n=== TOTAL DE TENANTS COM EMAIL ===');
    console.log(r.rows[0].total);
    process.exit(0);
  })
  .catch(err => {
    console.error('Erro:', err.message);
    process.exit(1);
  });

