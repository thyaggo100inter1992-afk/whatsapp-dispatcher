require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT
});

async function atualizarTrialPlanos() {
  console.log('\n🔧 PADRONIZANDO TRIAL PARA 3 DIAS EM TODOS OS PLANOS...\n');
  
  try {
    // Atualizar todos os planos para 3 dias de trial (incluindo NULL)
    const updateResult = await pool.query(`
      UPDATE plans 
      SET duracao_trial_dias = 3,
          updated_at = NOW()
      WHERE duracao_trial_dias IS NULL OR duracao_trial_dias != 3
    `);
    
    console.log(`✅ ${updateResult.rowCount} plano(s) atualizado(s)\n`);
    
    // Verificar resultado
    const result = await pool.query(`
      SELECT 
        nome, 
        slug, 
        preco_mensal, 
        duracao_trial_dias,
        ativo
      FROM plans 
      ORDER BY preco_mensal
    `);
    
    console.log('═════════════════════════════════════════════════════');
    console.log('📋 TODOS OS PLANOS AGORA TÊM 3 DIAS DE TRIAL:\n');
    
    result.rows.forEach(plano => {
      console.log(`${plano.ativo ? '✅' : '❌'} ${plano.nome} (${plano.slug})`);
      console.log(`   💰 R$ ${plano.preco_mensal}/mês`);
      console.log(`   🎁 ${plano.duracao_trial_dias} dias de trial GRÁTIS`);
      console.log('');
    });
    
    console.log('═════════════════════════════════════════════════════');
    console.log('\n✅ PADRONIZAÇÃO CONCLUÍDA!\n');
    console.log('🎯 COMO FUNCIONA:');
    console.log('   1. Cliente se cadastra → 3 dias GRÁTIS');
    console.log('   2. Após 3 dias → Sistema bloqueia');
    console.log('   3. Cliente escolhe QUALQUER plano');
    console.log('   4. Cliente paga → Sistema libera\n');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await pool.end();
  }
}

atualizarTrialPlanos();

