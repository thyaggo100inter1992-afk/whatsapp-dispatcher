/**
 * Script para migrar templates com tenant_id NULL para o tenant correto
 */

const { Pool } = require('pg');
const readline = require('readline');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'whatsapp_dispatcher',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function main() {
  try {
    console.log('\n🔍 ===== MIGRANDO TEMPLATES NULL PARA TENANT 4 =====\n');

    // Verificar quantos templates NULL existem
    const countResult = await pool.query(`
      SELECT COUNT(*) as total
      FROM templates t
      INNER JOIN whatsapp_accounts wa ON wa.id = t.whatsapp_account_id
      WHERE t.tenant_id IS NULL AND wa.tenant_id = 4
    `);

    const totalNull = parseInt(countResult.rows[0].total);

    if (totalNull === 0) {
      console.log('✅ Não há templates NULL para migrar!');
      rl.close();
      process.exit(0);
    }

    console.log(`📊 TEMPLATES NULL ENCONTRADOS: ${totalNull}`);
    console.log('─────────────────────────────────────────\n');

    // Mostrar alguns exemplos
    const examples = await pool.query(`
      SELECT 
        t.id,
        t.template_name,
        t.status,
        wa.name as account_name
      FROM templates t
      INNER JOIN whatsapp_accounts wa ON wa.id = t.whatsapp_account_id
      WHERE t.tenant_id IS NULL AND wa.tenant_id = 4
      ORDER BY t.created_at DESC
      LIMIT 10
    `);

    console.log('📋 EXEMPLOS (primeiros 10):');
    examples.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. ${row.template_name} (${row.account_name}) - ${row.status}`);
    });
    console.log('');

    // Confirmar
    const answer = await ask(`\n❓ Migrar ${totalNull} templates NULL para Tenant 4? (sim/não): `);
    
    if (answer.toLowerCase() !== 'sim' && answer.toLowerCase() !== 's') {
      console.log('\n❌ Migração cancelada.');
      rl.close();
      process.exit(0);
    }

    console.log('\n🚀 ===== INICIANDO MIGRAÇÃO =====\n');

    // Executar migração
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Migrar templates
      const updateResult = await client.query(`
        UPDATE templates t
        SET tenant_id = 4
        FROM whatsapp_accounts wa
        WHERE t.whatsapp_account_id = wa.id
          AND t.tenant_id IS NULL
          AND wa.tenant_id = 4
      `);

      console.log(`✅ ${updateResult.rowCount} templates migrados para Tenant 4`);

      // Migrar histórico relacionado
      const updateHistoryResult = await client.query(`
        UPDATE template_queue_history tqh
        SET tenant_id = 4
        FROM templates t
        INNER JOIN whatsapp_accounts wa ON wa.id = t.whatsapp_account_id
        WHERE tqh.template_name = t.template_name
          AND tqh.tenant_id IS NULL
          AND wa.tenant_id = 4
      `);

      console.log(`✅ ${updateHistoryResult.rowCount} registros de histórico migrados`);

      await client.query('COMMIT');
      console.log('\n🎉 ===== MIGRAÇÃO CONCLUÍDA COM SUCESSO! =====\n');

      // Verificar resultado
      const finalCheck = await pool.query(`
        SELECT 
          COALESCE(t.tenant_id::text, 'NULL') as tenant,
          COUNT(*) as total
        FROM templates t
        INNER JOIN whatsapp_accounts wa ON wa.id = t.whatsapp_account_id
        WHERE wa.tenant_id = 4
        GROUP BY t.tenant_id
        ORDER BY t.tenant_id
      `);

      console.log('📊 RESULTADO FINAL:');
      console.log('────────────────────');
      finalCheck.rows.forEach(row => {
        console.log(`   Tenant ${row.tenant}: ${row.total} templates`);
      });
      console.log('');

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Erro durante migração:', error);
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('\n❌ ERRO:', error.message);
    process.exit(1);
  } finally {
    rl.close();
    await pool.end();
  }
}

main();

