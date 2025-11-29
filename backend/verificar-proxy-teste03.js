/**
 * Script para verificar qual tenant tem o proxy TESTE 03
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

async function verificarProxy() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Procurando proxy "TESTE 03"...\n');

    const result = await client.query(`
      SELECT 
        p.id,
        p.name,
        p.tenant_id,
        t.nome as tenant_nome,
        p.type,
        p.host,
        p.port,
        p.username,
        p.created_at
      FROM proxies p
      LEFT JOIN tenants t ON p.tenant_id = t.id
      WHERE p.name ILIKE '%TESTE%'
      ORDER BY p.created_at DESC;
    `);

    if (result.rowCount === 0) {
      console.log('❌ Nenhum proxy com "TESTE" no nome encontrado.\n');
    } else {
      console.log(`📊 Encontrados ${result.rowCount} proxy(s) com "TESTE" no nome:\n`);
      
      result.rows.forEach((proxy, index) => {
        console.log(`${index + 1}. Proxy: "${proxy.name}"`);
        console.log(`   ID: ${proxy.id}`);
        console.log(`   Tenant ID: ${proxy.tenant_id}`);
        console.log(`   Tenant Nome: ${proxy.tenant_nome || 'N/A'}`);
        console.log(`   Tipo: ${proxy.type}`);
        console.log(`   Host/Porta: ${proxy.host}:${proxy.port}`);
        console.log(`   Username: ${proxy.username || 'N/A'}`);
        console.log(`   Criado em: ${new Date(proxy.created_at).toLocaleString('pt-BR')}`);
        console.log('');
      });
    }

    // Listar todos os tenants
    console.log('='.repeat(60));
    console.log('📋 TODOS OS TENANTS NO SISTEMA:');
    console.log('='.repeat(60) + '\n');

    const tenants = await client.query(`
      SELECT id, nome, email, status, ativo
      FROM tenants
      ORDER BY id;
    `);

    tenants.rows.forEach(t => {
      const statusIcon = t.ativo && t.status === 'active' ? '✅' : '❌';
      console.log(`${statusIcon} Tenant ID: ${t.id} | ${t.nome} | ${t.email} | Status: ${t.status}`);
    });

    console.log('');

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

verificarProxy();


