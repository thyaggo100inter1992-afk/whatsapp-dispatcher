const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function addProxyIndex() {
  const client = new Client({
    user: 'postgres',
    host: 'localhost',
    database: 'whatsapp_dispatcher',
    password: 'Tg130992*',
    port: 5432,
  });

  try {
    console.log('🔗 Conectando ao banco de dados...\n');
    await client.connect();

    const sqlPath = path.join(__dirname, '..', 'ADICIONAR-PROXY-INDEX.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('📋 Executando migração...\n');
    await client.query(sql);

    console.log('✅ Campo current_proxy_index adicionado com sucesso!\n');
  } catch (error) {
    console.error('❌ Erro ao adicionar campo:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

addProxyIndex();






