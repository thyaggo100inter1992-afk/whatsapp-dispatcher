import { query } from './src/database/connection';

async function migratePauseField() {
  console.log('\n🔧 ADICIONANDO CAMPO pause_started_at\n');
  
  try {
    await query(`
      ALTER TABLE campaigns 
      ADD COLUMN IF NOT EXISTS pause_started_at TIMESTAMP
    `);
    
    console.log('✅ Campo pause_started_at adicionado com sucesso!');
    console.log('   Este campo armazenará quando a pausa programada iniciou.');
    console.log('   NULL = não está em pausa');
    
  } catch (error: any) {
    console.error('❌ Erro ao adicionar campo:', error.message);
    process.exit(1);
  }
  
  process.exit(0);
}

migratePauseField().catch(console.error);


