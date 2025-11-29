/**
 * Script para habilitar a funcionalidade "base_dados" em todos os planos e tenants
 * Resolve o erro 403 ao acessar a Base de Dados
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

async function executarSQL() {
  const client = await pool.connect();
  
  try {
    console.log('\n🔧 ===== HABILITANDO BASE DE DADOS =====\n');
    
    // Ler arquivo SQL
    const sqlFilePath = path.join(__dirname, 'HABILITAR-BASE-DADOS.sql');
    const sql = fs.readFileSync(sqlFilePath, 'utf8');
    
    // Executar SQL
    console.log('📝 Executando SQL...\n');
    await client.query(sql);
    
    console.log('✅ SQL executado com sucesso!\n');
    
    // Verificar resultados
    console.log('📊 VERIFICANDO RESULTADOS:\n');
    
    const plansResult = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE funcionalidades->>'base_dados' = 'true') as com_base_dados
      FROM plans
    `);
    
    const tenantsResult = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE funcionalidades_config->>'base_dados' = 'true') as com_base_dados
      FROM tenants
    `);
    
    console.log('📦 PLANOS:');
    console.log(`   Total: ${plansResult.rows[0].total}`);
    console.log(`   Com base_dados: ${plansResult.rows[0].com_base_dados}`);
    
    console.log('\n👥 TENANTS:');
    console.log(`   Total: ${tenantsResult.rows[0].total}`);
    console.log(`   Com base_dados: ${tenantsResult.rows[0].com_base_dados}`);
    
    console.log('\n✅ ===== CONCLUÍDO COM SUCESSO! =====\n');
    console.log('🎉 Agora todos os tenants têm acesso à Base de Dados!\n');
    console.log('👉 Reinicie o backend para aplicar as mudanças:\n');
    console.log('   cd backend');
    console.log('   npm run dev\n');
    
  } catch (error) {
    console.error('❌ Erro ao executar SQL:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

executarSQL().catch(error => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});

