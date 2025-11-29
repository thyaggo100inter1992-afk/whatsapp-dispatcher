const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const client = new Client({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'whatsapp_api',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'Tg130992*'
});

async function executeSQLFile() {
  try {
    console.log('🔌 Conectando ao banco de dados...');
    await client.connect();
    console.log('✅ Conectado!');

    const sqlPath = path.join(__dirname, 'criar-tabela-arquivos-publicos.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('📝 Executando SQL...');
    await client.query(sql);
    console.log('✅ Tabela public_files criada com sucesso!');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

executeSQLFile();



