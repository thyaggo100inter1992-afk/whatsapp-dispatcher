const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'whatsapp_dispatcher',
  user: 'postgres',
  password: 'Tg130992*',
});

(async () => {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'plans' 
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Colunas da tabela plans:');
    console.log('━'.repeat(60));
    result.rows.forEach(col => {
      console.log(`  ${col.column_name.padEnd(35)} | ${col.data_type}`);
    });
    console.log('━'.repeat(60));
  } catch (error) {
    console.error('Erro:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
})();



