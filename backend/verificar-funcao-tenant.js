/**
 * Script para verificar se a função set_current_tenant existe
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

async function verificarFuncaoTenant() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Verificando função set_current_tenant...\n');

    // Verificar se a função existe
    const result = await client.query(`
      SELECT EXISTS (
        SELECT 1 
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' 
        AND p.proname = 'set_current_tenant'
      ) as exists;
    `);

    if (result.rows[0].exists) {
      console.log('✅ Função set_current_tenant JÁ EXISTE no banco de dados!\n');
    } else {
      console.log('❌ Função set_current_tenant NÃO EXISTE!\n');
      console.log('🔧 Criando função...\n');
      
      // Criar a função
      await client.query(`
        CREATE OR REPLACE FUNCTION set_current_tenant(p_tenant_id INTEGER)
        RETURNS VOID AS $$
        BEGIN
          -- Define o tenant_id na sessão atual
          PERFORM set_config('app.current_tenant_id', p_tenant_id::text, false);
        END;
        $$ LANGUAGE plpgsql;
      `);
      
      console.log('✅ Função set_current_tenant criada com sucesso!\n');
    }

    // Testar a função
    console.log('🧪 Testando função...\n');
    await client.query('SELECT set_current_tenant($1)', [1]);
    console.log('✅ Função funciona corretamente!\n');

    console.log('='.repeat(60));
    console.log('✅ TUDO OK!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

verificarFuncaoTenant();


