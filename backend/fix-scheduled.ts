import { query } from './src/database/connection';

async function fixScheduled() {
  console.log('\n🔧 REMOVENDO AGENDAMENTO DA CAMPANHA 90\n');
  
  const result = await query(`
    UPDATE campaigns 
    SET scheduled_at = NULL, updated_at = NOW()
    WHERE id = 90
    RETURNING id, name, scheduled_at, status
  `);
  
  if (result.rows.length > 0) {
    console.log('✅ AGENDAMENTO REMOVIDO COM SUCESSO!');
    console.log(`   Campanha: ${result.rows[0].name}`);
    console.log(`   Status: ${result.rows[0].status}`);
    console.log(`   Scheduled At: ${result.rows[0].scheduled_at || 'NULL (processamento imediato)'}`);
    console.log('\n💡 O worker deve começar a processar nos próximos 5 segundos!');
  } else {
    console.log('❌ Erro ao atualizar a campanha');
  }
  
  process.exit(0);
}

fixScheduled().catch(console.error);


