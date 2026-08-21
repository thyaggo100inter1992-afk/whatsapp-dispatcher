/**
 * Aplica migration SendGrid no banco (produção/local).
 * Uso: node run-sendgrid-migration.js
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { Pool } = require('pg');

async function main() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || 'whatsapp_dispatcher',
    user: process.env.DB_USER || 'whatsapp_user',
    password: process.env.DB_PASSWORD,
  });

  const sqlPath = path.join(__dirname, 'src/database/migrations/add_sendgrid_email_provider.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  console.log('Aplicando migration SendGrid...');
  await pool.query(sql);
  console.log('OK — tabelas/colunas SendGrid prontas.');
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
