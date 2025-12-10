/**
 * Script para verificar templates com tenant_id NULL
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
    console.log('\n🔍 ===== INVESTIGANDO TEMPLATES COM TENANT_ID NULL =====\n');

    // Verificar quantos templates NULL existem por conta
    const countByAccount = await pool.query(`
      SELECT 
        wa.id as account_id,
        wa.name as account_name,
        wa.tenant_id as tenant_da_conta,
        COUNT(*) as total_templates_null
      FROM templates t
      INNER JOIN whatsapp_accounts wa ON wa.id = t.whatsapp_account_id
      WHERE t.tenant_id IS NULL
      GROUP BY wa.id, wa.name, wa.tenant_id
      ORDER BY total_templates_null DESC
    `);

    console.log('📊 TEMPLATES NULL POR CONTA:');
    console.log('─────────────────────────────────────────');
    let totalNull = 0;
    countByAccount.rows.forEach(row => {
      totalNull += parseInt(row.total_templates_null);
      console.log(`\n📱 Conta: ${row.account_name} (ID: ${row.account_id})`);
      console.log(`   Tenant da Conta: ${row.tenant_da_conta}`);
      console.log(`   Templates NULL: ${row.total_templates_null}`);
    });
    console.log(`\n📊 TOTAL: ${totalNull} templates com tenant_id NULL\n`);

    // Mostrar alguns exemplos
    const examples = await pool.query(`
      SELECT 
        t.id,
        t.template_name,
        t.status,
        t.category,
        t.tenant_id,
        wa.id as account_id,
        wa.name as account_name,
        wa.tenant_id as tenant_da_conta,
        t.created_at
      FROM templates t
      INNER JOIN whatsapp_accounts wa ON wa.id = t.whatsapp_account_id
      WHERE t.tenant_id IS NULL
      ORDER BY t.created_at DESC
      LIMIT 10
    `);

    console.log('📋 EXEMPLOS DE TEMPLATES NULL:');
    console.log('─────────────────────────────────────────');
    examples.rows.forEach((row, index) => {
      console.log(`\n${index + 1}. ${row.template_name}`);
      console.log(`   ID: ${row.id}`);
      console.log(`   Conta: ${row.account_name} (Tenant: ${row.tenant_da_conta})`);
      console.log(`   Status: ${row.status}`);
      console.log(`   Categoria: ${row.category || 'N/A'}`);
      console.log(`   Template Tenant: NULL → Deveria ser: ${row.tenant_da_conta}`);
      console.log(`   Criado em: ${row.created_at}`);
    });

    // Verificar se TODOS os templates NULL pertencem a contas do Tenant 4
    const tenantCheck = await pool.query(`
      SELECT 
        wa.tenant_id as tenant_da_conta,
        COUNT(*) as total
      FROM templates t
      INNER JOIN whatsapp_accounts wa ON wa.id = t.whatsapp_account_id
      WHERE t.tenant_id IS NULL
      GROUP BY wa.tenant_id
    `);

    console.log('\n\n📊 DISTRIBUIÇÃO POR TENANT DAS CONTAS:');
    console.log('─────────────────────────────────────────');
    tenantCheck.rows.forEach(row => {
      console.log(`   Tenant ${row.tenant_da_conta}: ${row.total} templates NULL`);
    });

    // Verificar se há templates NULL de outros tenants
    const otherTenants = tenantCheck.rows.filter(row => row.tenant_da_conta != 4);
    
    console.log('\n\n💡 ANÁLISE:');
    console.log('─────────────────────────────────────────');
    if (otherTenants.length === 0) {
      console.log('✅ TODOS os templates NULL pertencem a contas do Tenant 4');
      console.log('✅ É SEGURO migrar todos para Tenant 4');
    } else {
      console.log('⚠️  ATENÇÃO: Existem templates NULL de outros tenants:');
      otherTenants.forEach(row => {
        console.log(`   - Tenant ${row.tenant_da_conta}: ${row.total} templates`);
      });
      console.log('⚠️  Requer análise manual antes de migrar');
    }

    console.log('\n');

  } catch (error) {
    console.error('\n❌ ERRO:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();

