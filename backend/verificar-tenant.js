require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT
});

async function verificarTenant() {
  console.log('\n📊 VERIFICANDO DADOS DO TENANT:\n');
  
  const result = await pool.query(`
    SELECT 
      id, nome, email, status, plano, ativo,
      trial_ends_at, blocked_at, proximo_vencimento,
      asaas_customer_id, asaas_subscription_id
    FROM tenants 
    ORDER BY id
  `);
  
  result.rows.forEach(tenant => {
    console.log('════════════════════════════════════════');
    console.log('ID:', tenant.id);
    console.log('Nome:', tenant.nome);
    console.log('Email:', tenant.email);
    console.log('Status:', tenant.status);
    console.log('Plano:', tenant.plano);
    console.log('Ativo:', tenant.ativo);
    console.log('Trial ends:', tenant.trial_ends_at);
    console.log('Bloqueado:', tenant.blocked_at);
    console.log('Próx venc:', tenant.proximo_vencimento);
    console.log('Asaas Customer:', tenant.asaas_customer_id);
    console.log('Asaas Subscription:', tenant.asaas_subscription_id);
    console.log('');
  });
  
  await pool.end();
}

verificarTenant().catch(console.error);





