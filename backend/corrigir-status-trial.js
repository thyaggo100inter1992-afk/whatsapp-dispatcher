/**
 * Script para corrigir status de tenants em trial
 * Atualiza de 'trial' para 'active'
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'disparador_nettsistemas',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function corrigirStatusTrial() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Verificando tenants com status "trial"...\n');

    // Buscar tenants com status 'trial'
    const beforeResult = await client.query(`
      SELECT 
        id, 
        nome, 
        status, 
        ativo,
        trial_ends_at,
        created_at
      FROM tenants
      WHERE status = 'trial'
      ORDER BY created_at DESC;
    `);

    if (beforeResult.rowCount === 0) {
      console.log('✅ Nenhum tenant com status "trial" encontrado.');
      console.log('💡 Todos os tenants já estão com status correto!\n');
      return;
    }

    console.log(`📊 Encontrados ${beforeResult.rowCount} tenants com status "trial":\n`);
    beforeResult.rows.forEach(tenant => {
      const trialStatus = tenant.trial_ends_at > new Date() ? '✅ EM TRIAL' : '⚠️ EXPIRADO';
      console.log(`  - ${tenant.nome} (ID: ${tenant.id}) | ${trialStatus}`);
    });

    console.log('\n🔧 Corrigindo status para "active"...\n');

    // Atualizar para 'active'
    const updateResult = await client.query(`
      UPDATE tenants
      SET 
        status = 'active',
        ativo = true,
        updated_at = NOW()
      WHERE status = 'trial'
      RETURNING id, nome, status, trial_ends_at;
    `);

    console.log(`✅ ${updateResult.rowCount} tenants atualizados!\n`);

    // Verificar resultado
    const afterResult = await client.query(`
      SELECT 
        id, 
        nome, 
        status, 
        ativo,
        trial_ends_at,
        CASE 
          WHEN trial_ends_at > NOW() THEN 'EM TRIAL ✅'
          WHEN trial_ends_at <= NOW() THEN 'TRIAL EXPIRADO ⚠️'
          ELSE 'SEM TRIAL'
        END as situacao_trial
      FROM tenants
      WHERE trial_ends_at IS NOT NULL
      ORDER BY created_at DESC;
    `);

    console.log('📊 Status após correção:\n');
    afterResult.rows.forEach(tenant => {
      console.log(`  - ${tenant.nome} (ID: ${tenant.id})`);
      console.log(`    Status: ${tenant.status} | Ativo: ${tenant.ativo}`);
      console.log(`    Situação: ${tenant.situacao_trial}\n`);
    });

    console.log('='.repeat(60));
    console.log('✅ CORREÇÃO CONCLUÍDA COM SUCESSO!');
    console.log('='.repeat(60));
    console.log('\n💡 Agora todos os tenants em trial têm status = "active"');
    console.log('💡 O período de trial é controlado pelo campo "trial_ends_at"');
    console.log('\n🚀 Reinicie o backend para aplicar as mudanças!\n');

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

corrigirStatusTrial();


