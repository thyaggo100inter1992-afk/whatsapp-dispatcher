const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'whatsapp_dispatcher',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'Tg130992*',
});

async function verificar() {
  try {
    console.log('\n========================================');
    console.log('  VERIFICANDO STATUS DAS CONTAS');
    console.log('========================================\n');

    const tenantId = 1;

    // WHATSAPP API
    console.log('📱 WHATSAPP API (whatsapp_accounts):');
    const apiResult = await pool.query(`
      SELECT 
        id,
        name,
        is_active,
        created_at
      FROM whatsapp_accounts
      WHERE tenant_id = $1
      ORDER BY created_at DESC
    `, [tenantId]);

    console.log(`   Total: ${apiResult.rows.length}`);
    apiResult.rows.forEach(row => {
      const status = row.is_active ? '✅ ATIVA' : '❌ INATIVA';
      console.log(`   - ${row.name}: ${status}`);
    });

    const ativas = apiResult.rows.filter(r => r.is_active === true).length;
    const inativas = apiResult.rows.filter(r => r.is_active === false).length;
    console.log(`\n   RESUMO API:`);
    console.log(`   ✅ Ativas: ${ativas}`);
    console.log(`   ❌ Inativas: ${inativas}`);

    // WHATSAPP QR
    console.log('\n📲 WHATSAPP QR CONNECT (uaz_instances):');
    const qrResult = await pool.query(`
      SELECT 
        id,
        name,
        status,
        created_at
      FROM uaz_instances
      WHERE tenant_id = $1
      ORDER BY created_at DESC
    `, [tenantId]);

    console.log(`   Total: ${qrResult.rows.length}`);
    qrResult.rows.forEach(row => {
      const status = row.status === 'connected' ? '✅ CONECTADA' : `❌ ${row.status.toUpperCase()}`;
      console.log(`   - ${row.name}: ${status}`);
    });

    const conectadas = qrResult.rows.filter(r => r.status === 'connected').length;
    const desconectadas = qrResult.rows.filter(r => r.status !== 'connected').length;
    console.log(`\n   RESUMO QR:`);
    console.log(`   ✅ Conectadas: ${conectadas}`);
    console.log(`   ❌ Desconectadas: ${desconectadas}`);

    // QUERY QUE O BACKEND USA
    console.log('\n========================================');
    console.log('  TESTANDO QUERY DO BACKEND');
    console.log('========================================\n');

    const statsResult = await pool.query(`
      SELECT 
        -- CONTAS WHATSAPP API
        (SELECT COUNT(*) FROM whatsapp_accounts WHERE tenant_id = $1) as total_contas_api,
        (SELECT COUNT(*) FROM whatsapp_accounts WHERE tenant_id = $1 AND is_active = true) as contas_api_ativas,
        (SELECT COUNT(*) FROM whatsapp_accounts WHERE tenant_id = $1 AND is_active = false) as contas_api_inativas,
        
        -- CONTAS WHATSAPP QR
        (SELECT COUNT(*) FROM uaz_instances WHERE tenant_id = $1) as total_contas_qr,
        (SELECT COUNT(*) FROM uaz_instances WHERE tenant_id = $1 AND status = 'connected') as contas_qr_conectadas,
        (SELECT COUNT(*) FROM uaz_instances WHERE tenant_id = $1 AND status != 'connected') as contas_qr_desconectadas
    `, [tenantId]);

    const stats = statsResult.rows[0];
    console.log('📊 RESULTADO DA QUERY:');
    console.log(`   API Total: ${stats.total_contas_api}`);
    console.log(`   API Ativas: ${stats.contas_api_ativas}`);
    console.log(`   API Inativas: ${stats.contas_api_inativas}`);
    console.log(`   QR Total: ${stats.total_contas_qr}`);
    console.log(`   QR Conectadas: ${stats.contas_qr_conectadas}`);
    console.log(`   QR Desconectadas: ${stats.contas_qr_desconectadas}`);

    console.log('\n========================================\n');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

verificar();

