const { pool } = require('../dist/database/connection');

async function verificarEstruturTabelas() {
  try {
    console.log('🔍 ===== ESTRUTURA DAS TABELAS =====\n');

    const tabelas = ['whatsapp_accounts', 'uaz_instances', 'qr_templates'];

    for (const tabela of tabelas) {
      console.log(`\n📋 TABELA: ${tabela}`);
      console.log('─'.repeat(60));
      
      const result = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = $1 
        ORDER BY ordinal_position
      `, [tabela]);

      result.rows.forEach(col => {
        console.log(`   - ${col.column_name} (${col.data_type})`);
      });
    }

    console.log('\n====================================================\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  }
}

verificarEstruturTabelas();





