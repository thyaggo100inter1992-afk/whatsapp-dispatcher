const { Pool } = require('pg');
require('dotenv').config();

async function main() {
  const pool = new Pool();
  try {
    await pool.query(`ALTER TABLE whatsapp_accounts ADD COLUMN IF NOT EXISTS app_secret TEXT`);
    await pool.query(`ALTER TABLE whatsapp_accounts ADD COLUMN IF NOT EXISTS webhook_fields_subscribed TEXT`);
    const r = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'whatsapp_accounts'
        AND column_name IN ('app_secret', 'webhook_fields_subscribed')
      ORDER BY 1
    `);
    console.log('OK columns:', r.rows.map((x) => x.column_name).join(', '));
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
