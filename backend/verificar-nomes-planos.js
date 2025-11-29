require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT
});

async function verificar() {
  console.log('\n📋 PLANOS NO BANCO:\n');
  
  const plans = await pool.query('SELECT slug, nome FROM plans ORDER BY preco_mensal');
  
  plans.rows.forEach(p => {
    console.log(`Slug: ${p.slug.padEnd(15)} → Nome: ${p.nome}`);
  });
  
  console.log('\n📊 TENANT ATUAL:\n');
  
  const tenant = await pool.query('SELECT id, nome, plano FROM tenants WHERE id = 1');
  
  if (tenant.rows[0]) {
    const t = tenant.rows[0];
    console.log(`Tenant: ${t.nome}`);
    console.log(`Plano (slug): ${t.plano}`);
    
    const planInfo = await pool.query('SELECT nome FROM plans WHERE slug = $1', [t.plano]);
    if (planInfo.rows[0]) {
      console.log(`Nome do plano: ${planInfo.rows[0].nome}`);
    }
  }
  
  await pool.end();
}

verificar().catch(console.error);





