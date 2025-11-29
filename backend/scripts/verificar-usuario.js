/**
 * Verificar se usuário padrão existe
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'whatsapp_dispatcher',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
});

async function verificarUsuario() {
  try {
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║                                                          ║');
    console.log('║       🔍 VERIFICANDO USUÁRIO PADRÃO 🔍                   ║');
    console.log('║                                                          ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    // Verificar tenants
    const tenantsResult = await pool.query('SELECT id, nome, slug, email, ativo FROM tenants ORDER BY id LIMIT 5');
    
    console.log('━━━━ TENANTS ━━━━');
    if (tenantsResult.rows.length === 0) {
      console.log('❌ NENHUM TENANT ENCONTRADO!');
      console.log('   O banco não foi populado com os dados padrão!');
    } else {
      console.log('✅ Tenants encontrados:', tenantsResult.rows.length);
      tenantsResult.rows.forEach(t => {
        console.log(`   - ID: ${t.id}, Nome: ${t.nome}, Slug: ${t.slug}, Email: ${t.email}, Ativo: ${t.ativo}`);
      });
    }

    console.log('');

    // Verificar usuários
    const usersResult = await pool.query(`
      SELECT 
        u.id, 
        u.tenant_id, 
        u.nome, 
        u.email, 
        u.role, 
        u.ativo,
        t.nome as tenant_nome
      FROM tenant_users u
      LEFT JOIN tenants t ON t.id = u.tenant_id
      ORDER BY u.id
      LIMIT 10
    `);

    console.log('━━━━ USUÁRIOS ━━━━');
    if (usersResult.rows.length === 0) {
      console.log('❌ NENHUM USUÁRIO ENCONTRADO!');
      console.log('   O usuário padrão não foi criado!');
    } else {
      console.log('✅ Usuários encontrados:', usersResult.rows.length);
      usersResult.rows.forEach(u => {
        console.log(`   - ID: ${u.id}, Email: ${u.email}, Role: ${u.role}, Tenant: ${u.tenant_nome}, Ativo: ${u.ativo}`);
      });
    }

    console.log('');

    // Procurar especificamente pelo admin@minhaempresa.com
    const adminResult = await pool.query(`
      SELECT id, email, role, ativo 
      FROM tenant_users 
      WHERE LOWER(email) = LOWER($1)
    `, ['admin@minhaempresa.com']);

    console.log('━━━━ VERIFICAÇÃO ESPECÍFICA ━━━━');
    if (adminResult.rows.length === 0) {
      console.log('❌ admin@minhaempresa.com NÃO ENCONTRADO!');
      console.log('   Este é o problema: usuário não existe!');
    } else {
      console.log('✅ admin@minhaempresa.com ENCONTRADO!');
      console.log('   Dados:', adminResult.rows[0]);
    }

    console.log('');

    // Verificar se migration 003 foi executada
    const migrationResult = await pool.query(`
      SELECT version, applied_at 
      FROM schema_migrations 
      WHERE version = '003_populate_default_tenant'
    `);

    console.log('━━━━ MIGRATION 003 ━━━━');
    if (migrationResult.rows.length === 0) {
      console.log('❌ MIGRATION 003 NÃO FOI EXECUTADA!');
      console.log('   Esta migration cria o tenant e usuário padrão!');
      console.log('   SOLUÇÃO: Executar a migration 003');
    } else {
      console.log('✅ Migration 003 executada em:', migrationResult.rows[0].applied_at);
    }

    console.log('');
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║                    DIAGNÓSTICO                           ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    
    if (tenantsResult.rows.length === 0 || usersResult.rows.length === 0) {
      console.log('');
      console.log('🔴 PROBLEMA: Banco não foi populado!');
      console.log('');
      console.log('📋 SOLUÇÃO: Executar migrations para popular o banco');
      console.log('');
    } else if (adminResult.rows.length === 0) {
      console.log('');
      console.log('🔴 PROBLEMA: Usuário admin@minhaempresa.com não existe!');
      console.log('');
      console.log('📋 SOLUÇÃO: Criar usuário manualmente ou reexecutar migration 003');
      console.log('');
    } else {
      console.log('');
      console.log('✅ Tudo OK! Usuário existe no banco.');
      console.log('');
      console.log('⚠️  Se o login ainda falha, pode ser problema na senha hash!');
      console.log('');
    }

    await pool.end();
    process.exit(0);

  } catch (error) {
    console.error('❌ Erro ao verificar:', error);
    process.exit(1);
  }
}

verificarUsuario();

