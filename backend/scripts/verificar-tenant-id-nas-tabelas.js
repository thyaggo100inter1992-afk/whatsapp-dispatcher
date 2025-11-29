const { pool } = require('../dist/database/connection');

async function verificarTenantIdNasTabelas() {
  try {
    console.log('🔍 ===== VERIFICANDO tenant_id NAS TABELAS =====\n');

    const tabelas = [
      'proxies',
      'whatsapp_accounts',
      'campaigns',
      'qr_templates',
      'uaz_instances',
      'messages',
      'contacts',
      'lista_restricao'
    ];

    for (const tabela of tabelas) {
      try {
        const result = await pool.query(`
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_name = $1 AND column_name = 'tenant_id'
        `, [tabela]);

        if (result.rows.length > 0) {
          console.log(`✅ ${tabela} - TEM tenant_id (${result.rows[0].data_type})`);
        } else {
          console.log(`❌ ${tabela} - NÃO TEM tenant_id`);
        }
      } catch (error) {
        console.log(`⚠️  ${tabela} - ERRO: ${error.message}`);
      }
    }

    console.log('\n====================================================\n');

    // Verificar migrations
    console.log('📋 MIGRATIONS EXECUTADAS:\n');
    const migrations = await pool.query(`
      SELECT migration_file, executed_at, success 
      FROM schema_migrations 
      ORDER BY executed_at DESC 
      LIMIT 10
    `);

    migrations.rows.forEach(m => {
      console.log(`${m.success ? '✅' : '❌'} ${m.migration_file} - ${m.executed_at}`);
    });

    console.log('\n====================================================\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  }
}

verificarTenantIdNasTabelas();





