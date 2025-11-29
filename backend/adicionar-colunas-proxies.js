/**
 * Script para adicionar colunas rotation_interval e proxy_pool na tabela proxies
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'disparador_nettsistemas',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function adicionarColunas() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Adicionando colunas rotation_interval e proxy_pool...\n');

    // Adicionar coluna rotation_interval
    await client.query(`
      ALTER TABLE proxies 
      ADD COLUMN IF NOT EXISTS rotation_interval INTEGER;
    `);
    console.log('✅ Coluna rotation_interval adicionada!');

    // Adicionar coluna proxy_pool
    await client.query(`
      ALTER TABLE proxies 
      ADD COLUMN IF NOT EXISTS proxy_pool JSONB;
    `);
    console.log('✅ Coluna proxy_pool adicionada!');

    // Adicionar comentários
    await client.query(`
      COMMENT ON COLUMN proxies.rotation_interval IS 'Intervalo de rotação em minutos (para proxies rotativos)';
      COMMENT ON COLUMN proxies.proxy_pool IS 'Pool de proxies para rotação (JSON array)';
    `);
    console.log('✅ Comentários adicionados!\n');

    // Verificar colunas após adição
    const result = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' 
      AND table_name = 'proxies'
      AND column_name IN ('rotation_interval', 'proxy_pool')
      ORDER BY ordinal_position;
    `);

    console.log('📋 Colunas adicionadas:\n');
    result.rows.forEach(col => {
      console.log(`  ✅ ${col.column_name}: ${col.data_type}`);
    });

    console.log('\n' + '='.repeat(60));
    console.log('✅ COLUNAS ADICIONADAS COM SUCESSO!');
    console.log('='.repeat(60));
    console.log('\n💡 Agora você pode criar proxies rotativos!\n');

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

adicionarColunas();


