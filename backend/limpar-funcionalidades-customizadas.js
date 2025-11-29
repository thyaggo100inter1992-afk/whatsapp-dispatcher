/**
 * Script para limpar funcionalidades customizadas dos tenants
 * Para que usem as funcionalidades do plano
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

async function limparFuncionalidadesCustomizadas() {
  const client = await pool.connect();
  
  try {
    console.log('🧹 Limpando funcionalidades customizadas dos tenants...\n');

    // Opção 1: Desativar funcionalidades customizadas para TODOS os tenants
    // Eles passarão a usar as funcionalidades do plano
    const result = await client.query(`
      UPDATE tenants
      SET funcionalidades_customizadas = false,
          funcionalidades_config = NULL
      WHERE funcionalidades_customizadas = true
      RETURNING id, nome;
    `);

    console.log(`✅ ${result.rowCount} tenants atualizados!\n`);
    
    if (result.rowCount > 0) {
      console.log('Tenants que agora usam as funcionalidades do plano:');
      result.rows.forEach(tenant => {
        console.log(`  - ${tenant.nome} (ID: ${tenant.id})`);
      });
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ CONCLUÍDO!');
    console.log('='.repeat(60));
    console.log('\nAgora todos os tenants usam as funcionalidades do plano.');
    console.log('💡 Reinicie o backend e faça login novamente para ver as mudanças.\n');

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

limparFuncionalidadesCustomizadas();


