/**
 * Script para remover role super_admin do usuário tenant normal
 * Deixar apenas o Super Admin dedicado com acesso
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'whatsapp_dispatcher',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'Tg130992*',
});

async function fixRoles() {
  try {
    console.log('🔍 Verificando usuários...\n');

    // 1. Buscar ambos os usuários
    const result = await pool.query(
      `SELECT id, nome, email, role 
       FROM tenant_users 
       WHERE email IN ($1, $2)
       ORDER BY id`,
      ['admin@minhaempresa.com', 'superadmin@nettsistemas.com']
    );

    console.log('📋 Usuários encontrados:');
    result.rows.forEach(user => {
      console.log(`   - ${user.email}`);
      console.log(`     Role atual: ${user.role}`);
      console.log('');
    });

    // 2. Atualizar role do tenant normal para 'admin'
    console.log('🔄 Corrigindo role do usuário tenant...\n');
    
    await pool.query(
      `UPDATE tenant_users 
       SET role = $1 
       WHERE email = $2`,
      ['admin', 'admin@minhaempresa.com']
    );

    // 3. Verificar resultado
    const verify = await pool.query(
      `SELECT id, nome, email, role 
       FROM tenant_users 
       WHERE email IN ($1, $2)
       ORDER BY id`,
      ['admin@minhaempresa.com', 'superadmin@nettsistemas.com']
    );

    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('✅ ROLES CORRIGIDAS COM SUCESSO!');
    console.log('═══════════════════════════════════════════════════════');
    console.log('');
    console.log('📋 CONFIGURAÇÃO ATUAL:');
    console.log('');
    
    verify.rows.forEach(user => {
      if (user.email === 'admin@minhaempresa.com') {
        console.log('👤 USUÁRIO TENANT (Uso Normal):');
        console.log('   Email:', user.email);
        console.log('   Role:', user.role, '✅');
        console.log('   Acesso: Usar sistema normalmente');
        console.log('   Admin Tenants: ❌ NÃO');
      } else {
        console.log('🛡️  SUPER ADMIN (Administração):');
        console.log('   Email:', user.email);
        console.log('   Role:', user.role, '✅');
        console.log('   Acesso: Administração de Tenants');
        console.log('   Admin Tenants: ✅ SIM');
      }
      console.log('');
    });

    console.log('═══════════════════════════════════════════════════════');
    console.log('');
    console.log('📝 PRÓXIMOS PASSOS:');
    console.log('   1. Reinicie o backend');
    console.log('   2. No navegador, faça logout');
    console.log('   3. Faça login novamente com cada usuário');
    console.log('   4. Teste o acesso ao Admin Tenants');
    console.log('');

  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

fixRoles();



