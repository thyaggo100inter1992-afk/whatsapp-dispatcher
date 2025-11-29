import { query } from './src/database/connection';

async function forceProcessCampaign() {
  console.log('\n🔧 FORÇANDO REPROCESSAMENTO DA CAMPANHA 90\n');
  
  try {
    // 1. Resetar sent_count para 0
    const reset = await query(`
      UPDATE campaigns
      SET sent_count = 0,
          updated_at = NOW()
      WHERE id = 90
      RETURNING *
    `);
    
    console.log('✅ sent_count resetado para 0');
    
    // 2. Deletar mensagens antigas (opcional - evita duplicatas)
    const deleted = await query(`
      DELETE FROM messages
      WHERE campaign_id = 90
    `);
    
    console.log(`✅ ${deleted.rowCount} mensagens antigas removidas`);
    
    // 3. Forçar atualização da campanha
    await query(`
      UPDATE campaigns
      SET updated_at = NOW()
      WHERE id = 90
    `);
    
    console.log('✅ Campanha forçada a ser reprocessada');
    console.log('\n💡 O worker deve começar a enviar nos próximos 5 segundos!');
    console.log('📊 Monitore os logs do backend.');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  }
}

forceProcessCampaign();


