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

    const sqlPath = path.join(__dirname, 'proteger-upgrade.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('📝 Executando SQL...');
    await client.query(sql);
    console.log('✅ Trigger de proteção criado com sucesso!');
    console.log('');
    console.log('🛡️  PROTEÇÃO ATIVADA:');
    console.log('');
    console.log('  Se um tenant mudar de plano "teste" para qualquer outro:');
    console.log('  ✓ trial_ends_at = NULL');
    console.log('  ✓ blocked_at = NULL');
    console.log('  ✓ will_be_deleted_at = NULL');
    console.log('  ✓ status = active (se estava blocked)');
    console.log('');
    console.log('  🎯 Resultado: NUNCA SERÁ DELETADO!');
    console.log('');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

executeSQLFile();



