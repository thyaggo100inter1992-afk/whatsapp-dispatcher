require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT
});

async function verificarPlanos() {
  console.log('\n📋 PLANOS CADASTRADOS NO SISTEMA:\n');
  console.log('═════════════════════════════════════════════════════\n');
  
  const result = await pool.query(`
    SELECT 
      nome, 
      slug, 
      preco_mensal, 
      preco_anual,
      duracao_trial_dias, 
      limite_usuarios,
      limite_contas_whatsapp,
      limite_mensagens_mes,
      ativo 
    FROM plans 
    ORDER BY preco_mensal
  `);
  
  result.rows.forEach(plano => {
    console.log(`${plano.ativo ? '✅' : '❌'} ${plano.nome.toUpperCase()} (${plano.slug})`);
    console.log(`   💰 Preço: R$ ${plano.preco_mensal}/mês (R$ ${plano.preco_anual || 0}/ano)`);
    console.log(`   🎁 Trial: ${plano.duracao_trial_dias || 0} dias GRÁTIS`);
    console.log(`   👥 Usuários: ${plano.limite_usuarios}`);
    console.log(`   📱 Instâncias WhatsApp: ${plano.limite_contas_whatsapp}`);
    console.log(`   📨 Mensagens/mês: ${plano.limite_mensagens_mes.toLocaleString()}`);
    console.log('');
  });
  
  console.log('═════════════════════════════════════════════════════\n');
  
  // Verificar como o trial funciona
  console.log('❓ COMO FUNCIONA O TRIAL:\n');
  console.log('1. Cliente se CADASTRA no sistema');
  console.log('   → status = "trial"');
  console.log('   → trial_ends_at = hoje + 3 dias\n');
  
  console.log('2. Durante 3 dias: Cliente usa GRÁTIS\n');
  
  console.log('3. Após 3 dias: Sistema BLOQUEIA automaticamente');
  console.log('   → status = "blocked"\n');
  
  console.log('4. Cliente escolhe um PLANO e faz pagamento\n');
  
  console.log('5. Pagamento confirmado: Sistema LIBERA');
  console.log('   → status = "active"');
  console.log('   → Limites do plano aplicados\n');
  
  console.log('═════════════════════════════════════════════════════\n');
  
  await pool.end();
}

verificarPlanos().catch(console.error);





