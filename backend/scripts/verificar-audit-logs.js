/**
 * Verificar estrutura da tabela audit_logs
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'whatsapp_dispatcher',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
});

async function verificarAuditLogs() {
  try {
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║                                                          ║');
    console.log('║       🔍 VERIFICANDO AUDIT_LOGS 🔍                       ║');
    console.log('║                                                          ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    // Verificar colunas da tabela audit_logs
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'audit_logs'
      ORDER BY ordinal_position
    `);

    console.log('━━━━ COLUNAS DA TABELA audit_logs ━━━━\n');
    
    if (result.rows.length === 0) {
      console.log('❌ Tabela audit_logs não encontrada!');
    } else {
      console.log('✅ Tabela encontrada com', result.rows.length, 'colunas:\n');
      result.rows.forEach(col => {
        console.log(`   - ${col.column_name.padEnd(25)} | ${col.data_type.padEnd(20)} | Nullable: ${col.is_nullable}`);
      });
    }

    console.log('');

    await pool.end();
    process.exit(0);

  } catch (error) {
    console.error('❌ Erro:', error);
    await pool.end();
    process.exit(1);
  }
}

verificarAuditLogs();





