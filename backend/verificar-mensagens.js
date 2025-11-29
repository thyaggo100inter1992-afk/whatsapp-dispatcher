/**
 * Script para verificar mensagens no banco
 */

// IMPORTANTE: Carregar .env PRIMEIRO
require('dotenv').config();

const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'whatsapp_dispatcher',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres'
});

async function verificarMensagens() {
  console.log('\n🔍 ===== DIAGNÓSTICO DE MENSAGENS =====\n');

  try {
    // 1. Total de mensagens
    const totalResult = await pool.query(
      'SELECT COUNT(*) as total FROM messages'
    );
    console.log(`📊 Total de mensagens no banco: ${totalResult.rows[0].total}`);

    // 2. Mensagens de hoje
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayResult = await pool.query(
      'SELECT COUNT(*) as total FROM messages WHERE sent_at >= $1',
      [today]
    );
    console.log(`📅 Mensagens de hoje: ${todayResult.rows[0].total}`);

    // 3. Mensagens por status
    const statusResult = await pool.query(`
      SELECT status, COUNT(*) as count 
      FROM messages 
      WHERE sent_at >= $1
      GROUP BY status
      ORDER BY count DESC
    `, [today]);
    
    console.log('\n📋 Mensagens de hoje por status:');
    statusResult.rows.forEach(row => {
      console.log(`   ${row.status}: ${row.count}`);
    });

    // 4. Verificar templates
    const templatesResult = await pool.query(`
      SELECT 
        m.template_name,
        t.category,
        COUNT(*) as count
      FROM messages m
      LEFT JOIN templates t ON m.template_name = t.template_name 
        AND m.whatsapp_account_id = t.whatsapp_account_id
      WHERE m.sent_at >= $1
      GROUP BY m.template_name, t.category
      ORDER BY count DESC
      LIMIT 10
    `, [today]);

    console.log('\n📝 Templates usados hoje:');
    templatesResult.rows.forEach(row => {
      console.log(`   ${row.template_name} (${row.category || 'SEM CATEGORIA'}): ${row.count} msgs`);
    });

    // 5. Mensagens sem template/categoria
    const noTemplateResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM messages m
      LEFT JOIN templates t ON m.template_name = t.template_name 
        AND m.whatsapp_account_id = t.whatsapp_account_id
      WHERE m.sent_at >= $1
      AND t.category IS NULL
    `, [today]);

    console.log(`\n⚠️  Mensagens sem categoria: ${noTemplateResult.rows[0].count}`);

    // 6. Contas ativas
    const accountsResult = await pool.query(`
      SELECT id, name, phone_number 
      FROM whatsapp_accounts 
      WHERE is_active = true
    `);

    console.log('\n👤 Contas ativas:');
    accountsResult.rows.forEach(acc => {
      console.log(`   ID ${acc.id}: ${acc.name} (${acc.phone_number})`);
    });

    // 7. Mensagens por conta
    const perAccountResult = await pool.query(`
      SELECT 
        wa.id,
        wa.name,
        COUNT(m.id) as total_messages
      FROM whatsapp_accounts wa
      LEFT JOIN messages m ON m.whatsapp_account_id = wa.id 
        AND m.sent_at >= $1
      WHERE wa.is_active = true
      GROUP BY wa.id, wa.name
      ORDER BY total_messages DESC
    `, [today]);

    console.log('\n📊 Mensagens por conta (hoje):');
    perAccountResult.rows.forEach(row => {
      console.log(`   Conta ${row.id} (${row.name}): ${row.total_messages} mensagens`);
    });

    console.log('\n========================================');
    console.log('✅ Diagnóstico concluído!');
    console.log('========================================\n');

  } catch (error) {
    console.error('\n❌ ERRO:', error.message);
    console.error(error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

// Executar
verificarMensagens();

