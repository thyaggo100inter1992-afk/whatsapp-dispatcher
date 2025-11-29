const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigration() {
  const client = new Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432'),
  });

  try {
    await client.connect();
    console.log('✅ Conectado ao banco de dados para migração.');

    const migrationFile = path.join(__dirname, 'src', 'database', 'migrations', '003_create_template_queue_history.sql');
    const migrationSql = fs.readFileSync(migrationFile, 'utf8');

    console.log(`📋 Executando migration: ${path.basename(migrationFile)}`);
    await client.query(migrationSql);
    console.log('✅ Migration executada com sucesso!');
    console.log('✅ Tabela "template_queue_history" criada!');
    console.log('✅ Sistema de re-tentativa pronto para usar!');

  } catch (error) {
    console.error('❌ Erro ao executar migration:', error.message);
    if (error.message.includes('already exists')) {
      console.log('⚠️ Tabela já existe, pulando...');
    }
  } finally {
    await client.end();
  }
}

runMigration();

