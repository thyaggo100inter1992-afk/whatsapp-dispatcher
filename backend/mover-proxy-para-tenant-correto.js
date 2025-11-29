/**
 * Script para mover proxy para o tenant correto
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

async function moverProxy() {
  const client = await pool.connect();
  
  try {
    // Listar tenants
    console.log('📋 TENANTS DISPONÍVEIS:\n');
    const tenants = await client.query(`
      SELECT id, nome, email
      FROM tenants
      ORDER BY id;
    `);

    tenants.rows.forEach(t => {
      console.log(`${t.id} - ${t.nome} (${t.email})`);
    });

    console.log('\n' + '='.repeat(60) + '\n');

    // Listar proxies
    const proxies = await client.query(`
      SELECT 
        p.id,
        p.name,
        p.tenant_id,
        t.nome as tenant_nome,
        p.host,
        p.port
      FROM proxies p
      LEFT JOIN tenants t ON p.tenant_id = t.id
      ORDER BY p.id DESC;
    `);

    console.log('📊 PROXIES NO BANCO:\n');
    proxies.rows.forEach(p => {
      console.log(`ID: ${p.id} | Nome: "${p.name}" | Tenant: ${p.tenant_nome} (ID: ${p.tenant_id}) | ${p.host}:${p.port}`);
    });

    console.log('\n' + '='.repeat(60));
    console.log('AÇÕES DISPONÍVEIS:');
    console.log('='.repeat(60));
    console.log('1 - Mover proxy específico para outro tenant');
    console.log('2 - Deletar proxy específico');
    console.log('3 - Deletar TODOS os proxies e começar do zero');
    console.log('4 - Sair sem fazer nada');
    console.log('='.repeat(60) + '\n');

    const action = await question('Digite sua escolha (1-4): ');

    if (action === '1') {
      const proxyId = await question('\nDigite o ID do proxy: ');
      const newTenantId = await question('Digite o ID do tenant de destino: ');
      
      await client.query(
        'UPDATE proxies SET tenant_id = $1 WHERE id = $2',
        [parseInt(newTenantId), parseInt(proxyId)]
      );
      
      console.log(`\n✅ Proxy ID ${proxyId} movido para Tenant ID ${newTenantId}!\n`);
      
    } else if (action === '2') {
      const proxyId = await question('\nDigite o ID do proxy para deletar: ');
      
      await client.query('DELETE FROM proxies WHERE id = $1', [parseInt(proxyId)]);
      console.log(`\n✅ Proxy ID ${proxyId} deletado!\n`);
      
    } else if (action === '3') {
      const confirm = await question('\n⚠️ Tem CERTEZA que deseja deletar TODOS os proxies? (sim/não): ');
      
      if (confirm.toLowerCase() === 'sim') {
        const result = await client.query('DELETE FROM proxies RETURNING id');
        console.log(`\n✅ ${result.rowCount} proxy(s) deletado(s)!\n`);
      } else {
        console.log('\n❌ Operação cancelada.\n');
      }
      
    } else {
      console.log('\n✅ Nenhuma alteração feita.\n');
    }

    console.log('💡 Reinicie o backend e recarregue a página!\n');

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    rl.close();
    client.release();
    await pool.end();
  }
}

moverProxy();


