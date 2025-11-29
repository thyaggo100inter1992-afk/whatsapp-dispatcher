const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'whatsapp_dispatcher',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function forceStartCampaign(campaignId) {
  try {
    console.log(`\n🚀 FORÇANDO INÍCIO DA CAMPANHA ${campaignId}...\n`);
    
    const result = await pool.query(
      `UPDATE campaigns 
       SET status = 'pending', scheduled_at = NULL
       WHERE id = $1
       RETURNING id, name, status, scheduled_at`,
      [campaignId]
    );
    
    if (result.rows.length > 0) {
      const campaign = result.rows[0];
      console.log(`✅ Campanha atualizada:`);
      console.log(`   ID: ${campaign.id}`);
      console.log(`   Nome: ${campaign.name}`);
      console.log(`   Status: ${campaign.status}`);
      console.log(`   Agendamento: ${campaign.scheduled_at || 'REMOVIDO'}\n`);
      console.log(`⏱️ O worker deve processar em até 10 segundos!\n`);
    } else {
      console.log(`❌ Campanha ${campaignId} não encontrada!\n`);
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await pool.end();
  }
}

const campaignId = process.argv[2] || 34;
forceStartCampaign(campaignId);





