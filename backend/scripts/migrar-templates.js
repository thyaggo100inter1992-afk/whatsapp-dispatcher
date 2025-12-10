/**
 * Script para migrar templates para o tenant correto
 * Executa a migração de forma segura com confirmação
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
    console.log('\n🔍 ===== VERIFICANDO TEMPLATES PARA MIGRAÇÃO =====\n');

    // Passo 1: Verificar quantos templates serão afetados
    const checkResult = await pool.query(`
      SELECT 
        COUNT(*) as total,
        t.tenant_id as tenant_atual,
        wa.tenant_id as tenant_correto
      FROM templates t
      INNER JOIN whatsapp_accounts wa ON wa.id = t.whatsapp_account_id
      WHERE wa.tenant_id = 4 AND t.tenant_id != 4
      GROUP BY t.tenant_id, wa.tenant_id
    `);

    if (checkResult.rows.length === 0) {
      console.log('✅ Não há templates para migrar. Todos já estão no tenant correto!');
      rl.close();
      process.exit(0);
    }

    console.log('📊 TEMPLATES ENCONTRADOS PARA MIGRAÇÃO:');
    console.log('─────────────────────────────────────────');
    checkResult.rows.forEach(row => {
      console.log(`   • Total: ${row.total} templates`);
      console.log(`   • Tenant Atual: ${row.tenant_atual}`);
      console.log(`   • Tenant Correto: ${row.tenant_correto}`);
    });
    console.log('');

    // Passo 2: Mostrar detalhes dos templates
    const detailsResult = await pool.query(`
      SELECT 
        t.id,
        t.template_name,
        t.tenant_id as tenant_atual,
        wa.tenant_id as tenant_correto,
        wa.name as conta_whatsapp,
        t.status,
        t.category,
        t.created_at
      FROM templates t
      INNER JOIN whatsapp_accounts wa ON wa.id = t.whatsapp_account_id
      WHERE wa.tenant_id = 4 AND t.tenant_id != 4
      ORDER BY t.created_at DESC
      LIMIT 10
    `);

    console.log('📋 PRIMEIROS 10 TEMPLATES QUE SERÃO MIGRADOS:');
    console.log('─────────────────────────────────────────────────');
    detailsResult.rows.forEach((row, index) => {
      console.log(`\n${index + 1}. ${row.template_name}`);
      console.log(`   ID: ${row.id}`);
      console.log(`   Conta: ${row.conta_whatsapp}`);
      console.log(`   Status: ${row.status}`);
      console.log(`   Categoria: ${row.category || 'N/A'}`);
      console.log(`   Tenant Atual → Correto: ${row.tenant_atual} → ${row.tenant_correto}`);
    });
    console.log('');

    // Confirmar migração
    const answer = await ask('\n❓ Deseja prosseguir com a migração? (sim/não): ');
    
    if (answer.toLowerCase() !== 'sim' && answer.toLowerCase() !== 's') {
      console.log('\n❌ Migração cancelada pelo usuário.');
      rl.close();
      process.exit(0);
    }

    console.log('\n🚀 ===== INICIANDO MIGRAÇÃO =====\n');

    // Passo 3: Executar migração em transação
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Atualizar templates
      const updateTemplatesResult = await client.query(`
        UPDATE templates t
        SET tenant_id = 4
        FROM whatsapp_accounts wa
        WHERE t.whatsapp_account_id = wa.id
          AND wa.tenant_id = 4
          AND t.tenant_id != 4
      `);

      console.log(`✅ ${updateTemplatesResult.rowCount} templates migrados para tenant 4`);

      // Atualizar template_queue_history
      const updateHistoryResult = await client.query(`
        UPDATE template_queue_history tqh
        SET tenant_id = 4
        FROM templates t
        INNER JOIN whatsapp_accounts wa ON wa.id = t.whatsapp_account_id
        WHERE tqh.template_name = t.template_name
          AND wa.tenant_id = 4
          AND tqh.tenant_id != 4
      `);

      console.log(`✅ ${updateHistoryResult.rowCount} registros de histórico migrados para tenant 4`);

      await client.query('COMMIT');
      console.log('\n🎉 ===== MIGRAÇÃO CONCLUÍDA COM SUCESSO! =====\n');

      // Verificar resultado final
      const finalCheckResult = await pool.query(`
        SELECT 
          COUNT(*) as total_templates,
          t.tenant_id
        FROM templates t
        INNER JOIN whatsapp_accounts wa ON wa.id = t.whatsapp_account_id
        WHERE wa.tenant_id = 4
        GROUP BY t.tenant_id
      `);

      console.log('📊 RESULTADO FINAL:');
      console.log('────────────────────');
      finalCheckResult.rows.forEach(row => {
        console.log(`   • Tenant ${row.tenant_id}: ${row.total_templates} templates`);
      });
      console.log('');

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Erro durante a migração:', error);
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

