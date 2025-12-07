require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('🚀 Aplicando migration de status das conversas...');
    
    const migrationPath = path.join(__dirname, 'src/database/migrations/051_add_conversation_status.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    await client.query(sql);
    
    console.log('✅ Migration aplicada com sucesso!');
    
    // Verificar resultado
    const result = await client.query(`
      SELECT status, COUNT(*) as total 
      FROM conversations 
      GROUP BY status 
      ORDER BY status
    `);
    
    console.log('\n📊 Distribuição de conversas por status:');
    result.rows.forEach(row => {
      console.log(`   ${row.status}: ${row.total} conversas`);
    });
    
  } catch (error) {
    console.error('❌ Erro ao aplicar migration:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();

