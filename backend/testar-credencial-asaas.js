/**
 * Script de teste para verificar se a credencial Asaas está no banco
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'whatsapp_dispatcher',
  password: process.env.DB_PASSWORD || 'Tg130992*',
  port: process.env.DB_PORT || 5432
});

async function testarCredencial() {
  try {
    console.log('🔍 Testando credencial Asaas no banco...\n');

    // Query 1: Listar TODAS as credenciais
    console.log('📋 1. Listando TODAS as credenciais Asaas:');
    console.log('   Query: SELECT * FROM asaas_credentials ORDER BY id');
    const allCreds = await pool.query('SELECT * FROM asaas_credentials ORDER BY id');
    console.log(`   Resultado: ${allCreds.rows.length} credenciais encontradas\n`);
    
    if (allCreds.rows.length > 0) {
      allCreds.rows.forEach(cred => {
        console.log(`   - ID: ${cred.id}`);
        console.log(`     Nome: ${cred.name}`);
        console.log(`     Padrão: ${cred.is_default}`);
        console.log(`     Ativa: ${cred.is_active}`);
        console.log(`     Ambiente: ${cred.environment}`);
        console.log(`     API Key: ${cred.api_key.substring(0, 20)}...`);
        console.log('');
      });
    }

    // Query 2: Buscar credencial padrão (EXATAMENTE como no código)
    console.log('📋 2. Buscando credencial PADRÃO (query do código):');
    const query = `
      SELECT id, api_key, environment
      FROM asaas_credentials
      WHERE is_default = true AND is_active = true
      LIMIT 1
    `;
    console.log('   Query:', query.trim());
    
    const result = await pool.query(query);
    console.log(`   Resultado: ${result.rows.length} credenciais encontradas\n`);
    
    if (result.rows.length > 0) {
      const cred = result.rows[0];
      console.log('   ✅ CREDENCIAL ENCONTRADA!');
      console.log(`   - ID: ${cred.id}`);
      console.log(`   - Ambiente: ${cred.environment}`);
      console.log(`   - API Key: ${cred.api_key.substring(0, 20)}...`);
      console.log('\n🎉 A credencial está correta no banco!');
      console.log('💡 O problema pode ser cache do tsx. Tente:');
      console.log('   1. Parar o backend (Ctrl+C)');
      console.log('   2. Executar: cd backend && npm run dev');
    } else {
      console.log('   ❌ CREDENCIAL NÃO ENCONTRADA!');
      console.log('   💡 Nenhuma credencial está marcada como padrão E ativa');
      console.log('   💡 Execute: node definir-asaas-padrao.js');
    }

  } catch (error) {
    console.error('\n❌ Erro ao testar:', error.message);
  } finally {
    await pool.end();
  }
}

testarCredencial();





