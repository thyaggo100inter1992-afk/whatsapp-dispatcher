/**
 * Script para restaurar TODAS as funcionalidades incluindo gerenciar_proxies
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

async function restaurarFuncionalidades() {
  const client = await pool.connect();
  
  try {
    console.log('\n🔧 ===== RESTAURANDO FUNCIONALIDADES COMPLETAS =====\n');
    
    // Ler arquivo SQL
    const sqlFilePath = path.join(__dirname, 'RESTAURAR-FUNCIONALIDADES-COMPLETAS.sql');
    const sql = fs.readFileSync(sqlFilePath, 'utf8');
    
    // Executar SQL
    console.log('📝 Restaurando funcionalidades...\n');
    const result = await client.query(sql);
    
    console.log('✅ Funcionalidades restauradas com sucesso!\n');
    
    // Mostrar resultado para cada tenant
    console.log('📊 FUNCIONALIDADES POR TENANT:\n');
    
    const tenants = await client.query(`
      SELECT 
        id,
        nome,
        funcionalidades_config->>'base_dados' as base_dados,
        funcionalidades_config->>'gerenciar_proxies' as proxies,
        funcionalidades_config->>'nova_vida' as nova_vida,
        funcionalidades_config->>'verificar_numeros' as verificar_numeros
      FROM tenants
      ORDER BY id
    `);
    
    tenants.rows.forEach(t => {
      console.log(`   Tenant #${t.id} (${t.nome}):`);
      console.log(`      Base Dados: ${t.base_dados === 'true' ? '✅' : '❌'}`);
      console.log(`      Proxies: ${t.proxies === 'true' ? '✅' : '❌'}`);
      console.log(`      Nova Vida: ${t.nova_vida === 'true' ? '✅' : '❌'}`);
      console.log(`      Verificar Números: ${t.verificar_numeros === 'true' ? '✅' : '❌'}`);
      console.log('');
    });
    
    console.log('✅ ===== CONCLUÍDO! =====\n');
    console.log('🎉 Todas as funcionalidades restauradas!\n');
    console.log('👉 Recarregue a página (F5) e veja as funcionalidades liberadas!\n');
    
  } catch (error) {
    console.error('❌ Erro ao restaurar funcionalidades:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

restaurarFuncionalidades().catch(error => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});

