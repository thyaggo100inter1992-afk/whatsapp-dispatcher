/**
 * Script para verificar o histórico de templates
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'whatsapp_dispatcher',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
});

async function main() {
  try {
    console.log('\n🔍 ===== VERIFICANDO HISTÓRICO DE TEMPLATES =====\n');

    // Verificar templates do histórico que começam com "01_port_refin"
    const result = await pool.query(`
      SELECT 
        tqh.id,
        tqh.tenant_id as historico_tenant,
        tqh.template_name,
        tqh.whatsapp_account_id,
        tqh.status,
        tqh.created_at,
        wa.id as conta_id,
        wa.name as conta_nome,
        wa.tenant_id as conta_tenant,
        wa.is_active as conta_ativa
      FROM template_queue_history tqh
      LEFT JOIN whatsapp_accounts wa ON tqh.whatsapp_account_id = wa.id
      WHERE tqh.template_name LIKE '01_port_refin%'
      OR tqh.template_name LIKE '02_port_refin%'
      ORDER BY tqh.created_at DESC
      LIMIT 10
    `);

    console.log(`📊 RESULTADOS: ${result.rows.length} registros encontrados\n`);
    console.log('─────────────────────────────────────────────────\n');

    result.rows.forEach((row, index) => {
      console.log(`${index + 1}. Template: ${row.template_name}`);
      console.log(`   Histórico Tenant: ${row.historico_tenant || 'NULL'}`);
      console.log(`   Account ID (histórico): ${row.whatsapp_account_id}`);
      console.log(`   Status: ${row.status}`);
      console.log(`   Criado em: ${row.created_at}`);
      
      if (row.conta_id) {
        console.log(`   ✅ CONTA EXISTE:`);
        console.log(`      - Nome: ${row.conta_nome}`);
        console.log(`      - Tenant: ${row.conta_tenant}`);
        console.log(`      - Ativa: ${row.conta_ativa}`);
      } else {
        console.log(`   ❌ CONTA NÃO EXISTE (foi deletada ou ID incorreto)`);
      }
      console.log('');
    });

    // Verificar quantos registros do histórico têm contas deletadas
    const deletedAccountsResult = await pool.query(`
      SELECT 
        COUNT(*) as total
      FROM template_queue_history tqh
      LEFT JOIN whatsapp_accounts wa ON tqh.whatsapp_account_id = wa.id
      WHERE wa.id IS NULL
    `);

    console.log('\n📊 ESTATÍSTICAS:');
    console.log('─────────────────────────────────────────────────');
    console.log(`   Registros com contas deletadas: ${deletedAccountsResult.rows[0].total}`);

    // Verificar distribuição por tenant no histórico
    const tenantDist = await pool.query(`
      SELECT 
        COALESCE(tqh.tenant_id::text, 'NULL') as tenant,
        COUNT(*) as total
      FROM template_queue_history tqh
      GROUP BY tqh.tenant_id
      ORDER BY tqh.tenant_id
    `);

    console.log('\n📊 DISTRIBUIÇÃO POR TENANT (HISTÓRICO):');
    console.log('─────────────────────────────────────────────────');
    tenantDist.rows.forEach(row => {
      console.log(`   Tenant ${row.tenant}: ${row.total} registros`);
    });

    console.log('\n');

  } catch (error) {
    console.error('\n❌ ERRO:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();

