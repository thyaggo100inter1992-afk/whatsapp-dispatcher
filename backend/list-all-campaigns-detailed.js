/**
 * LISTAR TODAS AS CAMPANHAS COM DETALHES
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function listCampaigns() {
  console.log('📋 ===== TODAS AS CAMPANHAS (ÚLTIMAS 15) =====\n');

  try {
    const campaigns = await pool.query(
      `SELECT id, name, status, scheduled_at, started_at, completed_at, 
              total_contacts, sent_count, delivered_count, read_count, failed_count,
              created_at
       FROM campaigns 
       ORDER BY id DESC
       LIMIT 15`
    );

    campaigns.rows.forEach(c => {
      const statusEmoji = {
        'pending': '⏳',
        'scheduled': '📅',
        'running': '🔵',
        'paused': '⏸️',
        'completed': '✅',
        'cancelled': '❌'
      }[c.status] || '❓';

      console.log(`${statusEmoji} ID ${c.id}: ${c.name}`);
      console.log(`   Status: ${c.status.toUpperCase()}`);
      console.log(`   Total: ${c.total_contacts} | Enviadas: ${c.sent_count} | Entregues: ${c.delivered_count} | Lidas: ${c.read_count} | Falhas: ${c.failed_count}`);
      
      if (c.scheduled_at) {
        console.log(`   📅 Agendada: ${new Date(c.scheduled_at).toLocaleString('pt-BR')}`);
      }
      if (c.started_at) {
        console.log(`   🚀 Iniciada: ${new Date(c.started_at).toLocaleString('pt-BR')}`);
      }
      if (c.completed_at) {
        console.log(`   🏁 Concluída: ${new Date(c.completed_at).toLocaleString('pt-BR')}`);
      }
      
      console.log(`   🕐 Criada: ${new Date(c.created_at).toLocaleString('pt-BR')}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ ERRO:', error.message);
  } finally {
    await pool.end();
  }
}

listCampaigns();





