require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT
});

async function padronizar() {
  console.log('\n🔧 PADRONIZANDO PLANOS...\n');
  
  // 1. Renomear plano "enterprise" para "Empresarial" em português
  await pool.query(`
    UPDATE plans 
    SET nome = 'Empresarial'
    WHERE slug = 'enterprise'
  `);
  console.log('✅ Plano "enterprise" renomeado para "Empresarial"');
  
  // 2. Verificar se há planos duplicados
  const duplicados = await pool.query(`
    SELECT slug, nome, preco_mensal 
    FROM plans 
    WHERE slug IN ('enterprise', 'empresarial')
    ORDER BY preco_mensal
  `);
  
  console.log('\n📋 Planos "Empresarial":');
  duplicados.rows.forEach(p => {
    console.log(`  - ${p.slug}: ${p.nome} - R$ ${p.preco_mensal}`);
  });
  
  // 3. Verificar qual tenant está usando
  const tenants = await pool.query(`
    SELECT id, nome, plano 
    FROM tenants 
    WHERE plano IN ('enterprise', 'empresarial')
  `);
  
  console.log('\n👥 Tenants usando esses planos:');
  tenants.rows.forEach(t => {
    console.log(`  - ${t.nome}: ${t.plano}`);
  });
  
  console.log('\n✅ Padronização concluída!');
  
  await pool.end();
}

padronizar().catch(console.error);





