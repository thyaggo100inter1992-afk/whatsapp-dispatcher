/**
 * Script para migrar registros do histórico de templates
 * que estão com tenant_id = 1 mas pertencem a contas do Tenant 4
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
    console.log('\n🔍 ===== MIGRANDO HISTÓRICO DE TENANT 1 PARA TENANT 4 =====\n');

    // Verificar quantos registros serão afetados
    const countResult = await pool.query(`
      SELECT COUNT(*) as total
      FROM template_queue_history tqh
      INNER JOIN whatsapp_accounts wa ON tqh.whatsapp_account_id = wa.id
      WHERE tqh.tenant_id = 1 AND wa.tenant_id = 4
    `);

    const total = parseInt(countResult.rows[0].total);

    if (total === 0) {
      console.log('✅ Não há registros de histórico para migrar!');
      rl.close();
      process.exit(0);
    }

    console.log(`📊 REGISTROS ENCONTRADOS: ${total}`);
    console.log('─────────────────────────────────────────\n');

    // Mostrar alguns exemplos
    const examples = await pool.query(`
      SELECT 
        tqh.id,
        tqh.template_name,
        tqh.tenant_id as historico_tenant,
        wa.name as conta_nome,
        wa.tenant_id as conta_tenant,
        tqh.status,
        tqh.created_at
      FROM template_queue_history tqh
      INNER JOIN whatsapp_accounts wa ON tqh.whatsapp_account_id = wa.id
      WHERE tqh.tenant_id = 1 AND wa.tenant_id = 4
      ORDER BY tqh.created_at DESC
      LIMIT 10
    `);

    console.log('📋 EXEMPLOS (primeiros 10):');
    examples.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. ${row.template_name} (${row.conta_nome})`);
      console.log(`      Tenant Histórico: ${row.historico_tenant} → Tenant Conta: ${row.conta_tenant}`);
      console.log(`      Status: ${row.status}`);
    });
    console.log('');

    // Confirmar
    const answer = await ask(`\n❓ Migrar ${total} registros de histórico para Tenant 4? (sim/não): `);
    
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

      const updateResult = await client.query(`
        UPDATE template_queue_history tqh
        SET tenant_id = 4
        FROM whatsapp_accounts wa
        WHERE tqh.whatsapp_account_id = wa.id
          AND tqh.tenant_id = 1
          AND wa.tenant_id = 4
      `);

      console.log(`✅ ${updateResult.rowCount} registros de histórico migrados para Tenant 4`);

      await client.query('COMMIT');
      console.log('\n🎉 ===== MIGRAÇÃO CONCLUÍDA COM SUCESSO! =====\n');

      // Verificar resultado
      const finalCheck = await pool.query(`
        SELECT 
          tqh.tenant_id,
          COUNT(*) as total
        FROM template_queue_history tqh
        GROUP BY tqh.tenant_id
        ORDER BY tqh.tenant_id
      `);

      console.log('📊 RESULTADO FINAL (HISTÓRICO):');
      console.log('────────────────────');
      finalCheck.rows.forEach(row => {
        console.log(`   Tenant ${row.tenant_id || 'NULL'}: ${row.total} registros`);
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

