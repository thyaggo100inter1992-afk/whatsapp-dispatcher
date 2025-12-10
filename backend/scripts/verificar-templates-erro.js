/**
 * Script para verificar templates com erro no histórico
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
    console.log('\n🔍 ===== VERIFICANDO TEMPLATES COM ERRO =====\n');

    // Verificar quantos templates com erro existem
    const countResult = await pool.query(`
      SELECT 
        COUNT(*) as total,
        status
      FROM template_queue_history
      WHERE tenant_id = 4
      GROUP BY status
      ORDER BY status
    `);

    console.log('📊 DISTRIBUIÇÃO POR STATUS (TENANT 4):');
    console.log('─────────────────────────────────────────');
    let totalGeral = 0;
    countResult.rows.forEach(row => {
      totalGeral += parseInt(row.total);
      console.log(`   ${row.status || 'NULL'}: ${row.total} registros`);
    });
    console.log(`\n   TOTAL: ${totalGeral} registros\n`);

    // Verificar exemplos de templates com erro
    const errorTemplates = await pool.query(`
      SELECT 
        id,
        template_name,
        status,
        error_message,
        created_at
      FROM template_queue_history
      WHERE tenant_id = 4 AND (status = 'error' OR status = 'failed')
      ORDER BY created_at DESC
      LIMIT 10
    `);

    if (errorTemplates.rows.length > 0) {
      console.log('📋 EXEMPLOS DE TEMPLATES COM ERRO:');
      console.log('─────────────────────────────────────────');
      errorTemplates.rows.forEach((row, index) => {
        console.log(`\n${index + 1}. ID: ${row.id}`);
        console.log(`   Template: ${row.template_name}`);
        console.log(`   Status: ${row.status}`);
        console.log(`   Erro: ${row.error_message ? row.error_message.substring(0, 100) : 'N/A'}`);
        console.log(`   Data: ${row.created_at}`);
      });
    } else {
      console.log('✅ Nenhum template com erro encontrado!');
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

