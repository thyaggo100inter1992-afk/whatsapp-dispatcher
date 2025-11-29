const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'whatsapp_dispatcher',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD
});

async function verificarECorrigirContas() {
  try {
    console.log('🔍 ===== VERIFICANDO CONTAS WHATSAPP =====\n');

    // 1. Verificar todas as contas WhatsApp API
    console.log('📱 CONTAS WHATSAPP API:');
    const apiContas = await pool.query(`
      SELECT id, name, phone_number, tenant_id, is_active 
      FROM whatsapp_accounts 
      ORDER BY id
    `);
    
    console.log(`Total de contas API: ${apiContas.rows.length}\n`);
    apiContas.rows.forEach(conta => {
      console.log(`  ID: ${conta.id} | Nome: ${conta.name} | Tenant: ${conta.tenant_id || 'NULL'} | Ativo: ${conta.is_active}`);
    });

    // 2. Verificar contas sem tenant_id
    const contasSemTenant = apiContas.rows.filter(c => !c.tenant_id);
    console.log(`\n⚠️  Contas SEM tenant_id: ${contasSemTenant.length}`);

    // 3. Associar contas sem tenant ao tenant 1
    if (contasSemTenant.length > 0) {
      console.log('\n🔧 Associando contas sem tenant ao TENANT 1...');
      
      for (const conta of contasSemTenant) {
        await pool.query(
          'UPDATE whatsapp_accounts SET tenant_id = 1 WHERE id = $1',
          [conta.id]
        );
        console.log(`  ✅ Conta ${conta.id} (${conta.name}) associada ao tenant 1`);
      }
    }

    // 4. Verificar contas QR Connect (UAZ)
    console.log('\n\n📱 CONTAS QR CONNECT (UAZ):');
    const qrContas = await pool.query(`
      SELECT id, name, instance_id, tenant_id, status 
      FROM uaz_instances 
      ORDER BY id
    `);
    
    console.log(`Total de contas QR: ${qrContas.rows.length}\n`);
    qrContas.rows.forEach(conta => {
      console.log(`  ID: ${conta.id} | Nome: ${conta.name} | Tenant: ${conta.tenant_id || 'NULL'} | Status: ${conta.status}`);
    });

    // 5. Associar contas QR sem tenant ao tenant 1
    const qrSemTenant = qrContas.rows.filter(c => !c.tenant_id);
    console.log(`\n⚠️  Contas QR SEM tenant_id: ${qrSemTenant.length}`);

    if (qrSemTenant.length > 0) {
      console.log('\n🔧 Associando contas QR sem tenant ao TENANT 1...');
      
      for (const conta of qrSemTenant) {
        await pool.query(
          'UPDATE uaz_instances SET tenant_id = 1 WHERE id = $1',
          [conta.id]
        );
        console.log(`  ✅ Conta QR ${conta.id} (${conta.name}) associada ao tenant 1`);
      }
    }

    // 6. Verificar resultado final
    console.log('\n\n✅ ===== RESULTADO FINAL =====\n');
    
    const finalApi = await pool.query(`
      SELECT tenant_id, COUNT(*) as total 
      FROM whatsapp_accounts 
      GROUP BY tenant_id 
      ORDER BY tenant_id
    `);
    
    console.log('📊 CONTAS API POR TENANT:');
    finalApi.rows.forEach(row => {
      console.log(`  Tenant ${row.tenant_id || 'NULL'}: ${row.total} contas`);
    });

    const finalQr = await pool.query(`
      SELECT tenant_id, COUNT(*) as total 
      FROM uaz_instances 
      GROUP BY tenant_id 
      ORDER BY tenant_id
    `);
    
    console.log('\n📊 CONTAS QR POR TENANT:');
    finalQr.rows.forEach(row => {
      console.log(`  Tenant ${row.tenant_id || 'NULL'}: ${row.total} contas`);
    });

    console.log('\n✅ Verificação concluída!\n');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await pool.end();
  }
}

verificarECorrigirContas();



