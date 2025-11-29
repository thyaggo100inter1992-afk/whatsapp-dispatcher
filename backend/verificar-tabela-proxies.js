/**
 * Script para verificar estrutura da tabela proxies
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

async function verificarTabelaProxies() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Verificando estrutura da tabela proxies...\n');

    // Verificar se a tabela existe
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'proxies'
      ) as exists;
    `);

    if (!tableExists.rows[0].exists) {
      console.log('❌ Tabela proxies NÃO EXISTE!\n');
      console.log('Criando tabela...\n');
      
      // Criar tabela
      await client.query(`
        CREATE TABLE IF NOT EXISTS proxies (
          id SERIAL PRIMARY KEY,
          tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL,
          type VARCHAR(50) DEFAULT 'socks5',
          host VARCHAR(255),
          port INTEGER,
          username VARCHAR(255),
          password VARCHAR(255),
          location VARCHAR(255),
          description TEXT,
          rotation_interval INTEGER,
          proxy_pool JSONB,
          current_proxy_index INTEGER DEFAULT 0,
          status VARCHAR(50) DEFAULT 'unknown',
          last_check TIMESTAMP,
          last_ip VARCHAR(50),
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_proxies_tenant_id ON proxies(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_proxies_type ON proxies(type);
        CREATE INDEX IF NOT EXISTS idx_proxies_is_active ON proxies(is_active);
      `);
      
      console.log('✅ Tabela proxies criada com sucesso!\n');
    } else {
      console.log('✅ Tabela proxies existe!\n');
    }

    // Verificar colunas
    const columns = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' 
      AND table_name = 'proxies'
      ORDER BY ordinal_position;
    `);

    console.log('📋 Colunas da tabela proxies:\n');
    columns.rows.forEach(col => {
      const nullable = col.is_nullable === 'YES' ? '(NULL permitido)' : '(NOT NULL)';
      const defaultVal = col.column_default ? `[padrão: ${col.column_default}]` : '';
      console.log(`  - ${col.column_name}: ${col.data_type} ${nullable} ${defaultVal}`);
    });

    console.log('\n' + '='.repeat(60));
    console.log('✅ VERIFICAÇÃO CONCLUÍDA!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Erro:', error);
    console.error('\nDetalhes:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

verificarTabelaProxies();


