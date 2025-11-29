require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT
});

async function removerDuplicado() {
  console.log('\n🔧 REMOVENDO PLANO DUPLICADO...\n');
  
  // 1. Verificar os dois planos
  const planos = await pool.query(`
    SELECT slug, nome, preco_mensal 
    FROM plans 
    WHERE slug IN ('enterprise', 'empresarial')
  `);
  
  console.log('📋 Planos encontrados:');
  planos.rows.forEach(p => {
    console.log(`  ${p.slug}: ${p.nome} - R$ ${p.preco_mensal}`);
  });
  
  // 2. Atualizar tenants que usam "enterprise" para usar "empresarial"
  const updated = await pool.query(`
    UPDATE tenants 
    SET plano = 'empresarial'
    WHERE plano = 'enterprise'
    RETURNING id, nome
  `);
  
  if (updated.rows.length > 0) {
    console.log('\n✅ Tenants atualizados:');
    updated.rows.forEach(t => {
      console.log(`  - ${t.nome} (ID: ${t.id}) agora usa "empresarial"`);
    });
  }
  
  // 3. Deletar o plano "enterprise" (inglês)
  await pool.query(`
    DELETE FROM plans 
    WHERE slug = 'enterprise'
  `);
  
  console.log('\n✅ Plano "enterprise" (inglês) removido');
  console.log('✅ Todos os tenants agora usam "empresarial" (português)');
  console.log('\n🎉 Duplicação resolvida!');
  
  await pool.end();
}

removerDuplicado().catch(console.error);





