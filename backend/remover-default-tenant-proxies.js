/**
 * Script para remover o valor DEFAULT da coluna tenant_id
 * Isso garante que sempre seja passado explicitamente
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

async function removerDefault() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Removendo DEFAULT da coluna tenant_id...\n');

    // Remover o DEFAULT
    await client.query(`
      ALTER TABLE proxies 
      ALTER COLUMN tenant_id DROP DEFAULT;
    `);
    
    console.log('✅ DEFAULT removido da coluna tenant_id!');
    console.log('💡 Agora o tenant_id DEVE ser passado explicitamente.\n');

    // Verificar proxies existentes
    const result = await client.query(`
      SELECT 
        id, 
        name, 
        tenant_id,
        type,
        host,
        port
      FROM proxies
      ORDER BY tenant_id, id;
    `);

    console.log('📊 Proxies existentes no banco:\n');
    
    const groupedByTenant = result.rows.reduce((acc, proxy) => {
      if (!acc[proxy.tenant_id]) {
        acc[proxy.tenant_id] = [];
      }
      acc[proxy.tenant_id].push(proxy);
      return acc;
    }, {});

    Object.keys(groupedByTenant).forEach(tenantId => {
      console.log(`\n🏢 Tenant ID: ${tenantId}`);
      groupedByTenant[tenantId].forEach(proxy => {
        console.log(`  - ID: ${proxy.id} | ${proxy.name} | ${proxy.type} | ${proxy.host}:${proxy.port}`);
      });
    });

    console.log('\n' + '='.repeat(60));
    console.log('✅ CORREÇÃO APLICADA!');
    console.log('='.repeat(60));
    console.log('\n💡 Reinicie o backend para aplicar as mudanças!\n');

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

removerDefault();


