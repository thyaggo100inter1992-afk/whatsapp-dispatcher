const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'whatsapp_dispatcher',
  user: 'postgres',
  password: 'Tg130992*',
});

async function runMigration() {
  try {
    console.log('🚀 Executando migration 005...');

    const sql = fs.readFileSync(
      path.join(__dirname, 'src/database/migrations/005_add_removal_tracking.sql'),
      'utf8'
    );

    await pool.query(sql);

    console.log('✅ Migration 005 executada com sucesso!');
    console.log('📊 Colunas adicionadas:');
    console.log('   - removal_count (contador de remoções)');
    console.log('   - permanent_removal (remoção permanente)');
    console.log('   - removal_history (histórico JSON)');

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao executar migration:', error.message);
    await pool.end();
    process.exit(1);
  }
}

runMigration();

