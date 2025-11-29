/**
 * Script para Reativar o Tenant 1 (Super Admin)
 * Permite que o Super Admin faça login novamente
 */

const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: process.env.DB_NAME || 'whatsapp_dispatcher',
  user: 'postgres',
  password: 'Tg130992*'
});

async function reativarTenant1() {
  try {
    console.log('🔄 Reativando Tenant 1...\n');

    // Reativar tenant
    const result = await pool.query(`
      UPDATE tenants 
      SET 
        status = 'active',
        ativo = true,
        updated_at = NOW()
      WHERE id = 1
      RETURNING id, nome, email, status, ativo
    `);

    if (result.rows.length === 0) {
      console.log('❌ Tenant 1 não encontrado');
      return;
    }

    const tenant = result.rows[0];

    console.log('✅ TENANT 1 REATIVADO COM SUCESSO!\n');
    console.log('📋 Informações:');
    console.log(`   ID: ${tenant.id}`);
    console.log(`   Nome: ${tenant.nome}`);
    console.log(`   Email: ${tenant.email}`);
    console.log(`   Status: ${tenant.status}`);
    console.log(`   Ativo: ${tenant.ativo}`);
    console.log('');
    console.log('🎉 Agora você pode fazer login com o Super Admin!');
    console.log('');

  } catch (error) {
    console.error('❌ Erro ao reativar tenant:', error.message);
  } finally {
    await pool.end();
  }
}

reativarTenant1();

