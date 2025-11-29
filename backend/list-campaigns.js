const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'whatsapp_dispatcher',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function listCampaigns() {
  try {
    const result = await pool.query(
      `SELECT id, name, status, total_contacts, sent_count, created_at
       FROM campaigns
       ORDER BY created_at DESC
       LIMIT 10`
    );
    
    console.log('\n📊 ÚLTIMAS CAMPANHAS:\n');
    result.rows.forEach((c, i) => {
      console.log(`${i+1}. ID: ${c.id} | Nome: ${c.name} | Status: ${c.status} | Total: ${c.total_contacts} | Enviadas: ${c.sent_count}`);
    });
    console.log('');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await pool.end();
  }
}

listCampaigns();





