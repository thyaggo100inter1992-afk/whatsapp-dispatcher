require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'whatsapp_dispatcher',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres'
});

const sqlFile = path.join(__dirname, 'backend', 'src', 'database', 'migrations', '014_create_uaz_tables.sql');

console.log('📄 Lendo arquivo SQL:', sqlFile);
const sql = fs.readFileSync(sqlFile, 'utf8');

console.log('🔄 Aplicando migration UAZ...');

pool.query(sql)
  .then(() => {
    console.log('✅ Migration UAZ aplicada com sucesso!');
    console.log('');
    console.log('Tabelas criadas:');
    console.log('  - uaz_instances');
    console.log('  - uaz_messages');
    console.log('  - uaz_campaigns');
    console.log('  - proxies (campos adicionados: type, rotation_interval, proxy_pool)');
    console.log('');
    pool.end();
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Erro ao aplicar migration:', err.message);
    console.error('');
    console.error('Detalhes do erro:');
    console.error(err);
    pool.end();
    process.exit(1);
  });

