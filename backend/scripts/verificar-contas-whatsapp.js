/**
 * Script para verificar o tenant das contas de WhatsApp
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
    console.log('\n🔍 ===== VERIFICANDO CONTAS DE WHATSAPP =====\n');

    // Verificar contas específicas que aparecem na tela
    const accountNumbers = ['8104-8682', '8203-8223'];
    
    for (const number of accountNumbers) {
      const result = await pool.query(`
        SELECT 
          id,
          name,
          phone_number,
          tenant_id,
          ativo,
          created_at
        FROM whatsapp_accounts
        WHERE phone_number LIKE '%' || $1 || '%'
        ORDER BY created_at DESC
        LIMIT 5
      `, [number]);

      if (result.rows.length > 0) {
        console.log(`📱 CONTA: ${number}`);
        console.log('─────────────────────────────────────');
        result.rows.forEach(row => {
          console.log(`   ID: ${row.id}`);
          console.log(`   Nome: ${row.name}`);
          console.log(`   Tenant ID: ${row.tenant_id || 'NULL'}`);
          console.log(`   Ativo: ${row.ativo}`);
          console.log(`   Criado em: ${row.created_at}`);
          console.log('');
        });
      } else {
        console.log(`⚠️  Conta ${number} não encontrada\n`);
      }
    }

    // Verificar TODAS as contas e seus tenants
    const allAccounts = await pool.query(`
      SELECT 
        tenant_id,
        COUNT(*) as total_contas,
        array_agg(DISTINCT name) as contas
      FROM whatsapp_accounts
      GROUP BY tenant_id
      ORDER BY tenant_id
    `);

    console.log('\n📊 DISTRIBUIÇÃO DE CONTAS POR TENANT:');
    console.log('─────────────────────────────────────');
    allAccounts.rows.forEach(row => {
      console.log(`\n   Tenant ${row.tenant_id || 'NULL'}: ${row.total_contas} contas`);
      if (row.total_contas <= 5) {
        console.log(`   Contas: ${row.contas.join(', ')}`);
      }
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

