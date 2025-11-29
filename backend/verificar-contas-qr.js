const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'whatsapp_dispatcher',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD
});

async function verificarContasQR() {
  try {
    console.log('🔍 ===== VERIFICANDO ESTRUTURA UAZ_INSTANCES =====\n');

    // Verificar colunas da tabela
    const colunas = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'uaz_instances' 
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Colunas da tabela uaz_instances:');
    colunas.rows.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type})`);
    });

    // Buscar todas as contas QR
    console.log('\n\n📱 CONTAS QR CONNECT:');
    const qrContas = await pool.query(`
      SELECT * FROM uaz_instances ORDER BY id
    `);
    
    console.log(`Total de contas QR: ${qrContas.rows.length}\n`);
    qrContas.rows.forEach(conta => {
      console.log(`  ID: ${conta.id} | Nome: ${conta.name || conta.instance_name || 'Sem nome'} | Tenant: ${conta.tenant_id || 'NULL'}`);
    });

    // Associar contas sem tenant ao tenant 1
    const qrSemTenant = qrContas.rows.filter(c => !c.tenant_id);
    console.log(`\n⚠️  Contas QR SEM tenant_id: ${qrSemTenant.length}`);

    if (qrSemTenant.length > 0) {
      console.log('\n🔧 Associando contas QR sem tenant ao TENANT 1...');
      
      for (const conta of qrSemTenant) {
        await pool.query(
          'UPDATE uaz_instances SET tenant_id = 1 WHERE id = $1',
          [conta.id]
        );
        console.log(`  ✅ Conta QR ${conta.id} associada ao tenant 1`);
      }
    }

    // Resultado final
    console.log('\n\n✅ ===== RESULTADO FINAL =====\n');
    
    const finalApi = await pool.query(`
      SELECT tenant_id, COUNT(*) as total 
      FROM whatsapp_accounts 
      GROUP BY tenant_id 
      ORDER BY tenant_id
    `);
    
    console.log('📊 CONTAS API POR TENANT:');
    finalApi.rows.forEach(row => {
      console.log(`  Tenant ${row.tenant_id}: ${row.total} contas`);
    });

    const finalQr = await pool.query(`
      SELECT tenant_id, COUNT(*) as total 
      FROM uaz_instances 
      GROUP BY tenant_id 
      ORDER BY tenant_id
    `);
    
    console.log('\n📊 CONTAS QR POR TENANT:');
    if (finalQr.rows.length === 0) {
      console.log('  (Nenhuma conta QR encontrada)');
    } else {
      finalQr.rows.forEach(row => {
        console.log(`  Tenant ${row.tenant_id || 'NULL'}: ${row.total} contas`);
      });
    }

    console.log('\n✅ Verificação concluída!\n');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await pool.end();
  }
}

verificarContasQR();



