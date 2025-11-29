import { query } from './src/database/connection';

async function fixCampaign91() {
  console.log('\n🔧 CORRIGINDO CAMPANHA 91\n');
  
  const result = await query(`
    UPDATE campaigns 
    SET scheduled_at = NULL, updated_at = NOW()
    WHERE id = 91
    RETURNING id, name, scheduled_at, status
  `);
  
  if (result.rows.length > 0) {
    console.log('✅ Campanha corrigida!');
    console.log(`   ID: ${result.rows[0].id}`);
    console.log(`   Nome: ${result.rows[0].name}`);
    console.log(`   Status: ${result.rows[0].status}`);
    console.log(`   Scheduled At: ${result.rows[0].scheduled_at || 'NULL (processará imediatamente)'}`);
    console.log('\n💡 O worker deve retomar em 5 segundos!');
  }
  
  process.exit(0);
}

fixCampaign91().catch(console.error);


