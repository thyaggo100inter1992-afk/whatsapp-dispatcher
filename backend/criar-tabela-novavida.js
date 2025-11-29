const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'whatsapp_dispatcher',
  password: 'Tg130992*',
  port: 5432,
});

async function runMigration() {
  console.log('🔗 Conectando ao banco de dados...');
  const client = await pool.connect();
  try {
    console.log('\n📋 Executando migração Nova Vida...');
    const sql = fs.readFileSync(
      path.join(__dirname, '..', 'CRIAR-TABELA-NOVAVIDA.sql'),
      'utf8'
    );
    await client.query(sql);
    console.log('\n✅ Tabelas Nova Vida criadas com sucesso!');
    console.log('   - novavida_consultas');
    console.log('   - novavida_jobs');
  } catch (error) {
    console.error('❌ Erro ao executar migração:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();






