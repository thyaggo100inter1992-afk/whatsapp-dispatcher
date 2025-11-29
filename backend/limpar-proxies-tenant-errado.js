/**
 * Script para mover ou deletar proxies criados no tenant errado
 */

const { Pool } = require('pg');
const readline = require('readline');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'disparador_nettsistemas',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function limparProxies() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Verificando proxies...\n');

    // Listar todos os proxies
    const result = await client.query(`
      SELECT 
        p.id, 
        p.name, 
        p.tenant_id,
        t.nome as tenant_nome,
        p.type,
        p.host,
        p.port,
        p.created_at
      FROM proxies p
      LEFT JOIN tenants t ON p.tenant_id = t.id
      ORDER BY p.created_at DESC;
    `);

    if (result.rowCount === 0) {
      console.log('✅ Nenhum proxy encontrado.\n');
      rl.close();
      await pool.end();
      return;
    }

    console.log(`📊 Total de proxies: ${result.rowCount}\n`);

    result.rows.forEach((proxy, index) => {
      console.log(`${index + 1}. Proxy: "${proxy.name}"`);
      console.log(`   ID: ${proxy.id}`);
      console.log(`   Tenant: ${proxy.tenant_nome || 'N/A'} (ID: ${proxy.tenant_id})`);
      console.log(`   Tipo: ${proxy.type} | ${proxy.host}:${proxy.port}`);
      console.log(`   Criado em: ${new Date(proxy.created_at).toLocaleString('pt-BR')}`);
      console.log('');
    });

    console.log('='.repeat(60));
    console.log('Escolha uma ação:');
    console.log('1 - Deletar TODOS os proxies');
    console.log('2 - Deletar apenas proxies do Tenant ID 1');
    console.log('3 - Não fazer nada');
    console.log('='.repeat(60));
    
    const answer = await question('\nDigite sua escolha (1, 2 ou 3): ');

    if (answer === '1') {
      await client.query('DELETE FROM proxies');
      console.log('\n✅ Todos os proxies foram deletados!\n');
    } else if (answer === '2') {
      const deleteResult = await client.query('DELETE FROM proxies WHERE tenant_id = 1 RETURNING id, name');
      console.log(`\n✅ ${deleteResult.rowCount} proxy(s) do Tenant ID 1 deletados!\n`);
      deleteResult.rows.forEach(p => {
        console.log(`  - ${p.name} (ID: ${p.id})`);
      });
    } else {
      console.log('\n✅ Nenhuma alteração feita.\n');
    }

    console.log('💡 Reinicie o backend para aplicar as mudanças!\n');

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    rl.close();
    client.release();
    await pool.end();
  }
}

limparProxies();


