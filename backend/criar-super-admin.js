/**
 * Script para criar usuário Super Admin
 * Acesso exclusivo para Administração de Tenants
 */

const { Pool } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'whatsapp_dispatcher',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'Tg130992*',
});

async function createSuperAdmin() {
  try {
    console.log('🔐 Criando usuário Super Admin...\n');

    // Credenciais do Super Admin
    const superAdminEmail = 'superadmin@nettsistemas.com';
    const superAdminPassword = 'SuperAdmin@2024';
    const superAdminNome = 'Super Administrador';

    // 1. Verificar se já existe
    const checkExisting = await pool.query(
      'SELECT id, email, role FROM tenant_users WHERE email = $1',
      [superAdminEmail]
    );

    if (checkExisting.rows.length > 0) {
      console.log('⚠️  Usuário Super Admin já existe!');
      console.log('📋 Dados atuais:');
      console.log('   ID:', checkExisting.rows[0].id);
      console.log('   Email:', checkExisting.rows[0].email);
      console.log('   Role:', checkExisting.rows[0].role);
      console.log('');
      console.log('❓ Deseja atualizar a senha? Execute:');
      console.log('   node atualizar-senha-super-admin.js');
      console.log('');
      return;
    }

    // 2. Hash da senha
    console.log('🔒 Gerando hash da senha...');
    const senhaHash = await bcrypt.hash(superAdminPassword, 10);

    // 3. Buscar tenant_id do sistema (usar o primeiro tenant)
    const tenantResult = await pool.query(
      'SELECT id FROM tenants ORDER BY id LIMIT 1'
    );

    if (tenantResult.rows.length === 0) {
      console.log('❌ Erro: Nenhum tenant encontrado no sistema!');
      process.exit(1);
    }

    const tenantId = tenantResult.rows[0].id;

    // 4. Criar usuário Super Admin
    console.log('✅ Criando usuário...\n');
    
    const insertResult = await pool.query(
      `INSERT INTO tenant_users (
        tenant_id,
        nome,
        email,
        senha_hash,
        role,
        ativo,
        email_verificado
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, nome, email, role`,
      [
        tenantId,
        superAdminNome,
        superAdminEmail,
        senhaHash,
        'super_admin',
        true,
        true
      ]
    );

    const newUser = insertResult.rows[0];

    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('🎉 SUPER ADMIN CRIADO COM SUCESSO!');
    console.log('═══════════════════════════════════════════════════════');
    console.log('');
    console.log('📋 DADOS DO USUÁRIO:');
    console.log('   ID:', newUser.id);
    console.log('   Nome:', newUser.nome);
    console.log('   Email:', newUser.email);
    console.log('   Role:', newUser.role);
    console.log('');
    console.log('🔐 CREDENCIAIS DE ACESSO:');
    console.log('   ┌─────────────────────────────────────────┐');
    console.log('   │  📧 Email: superadmin@nettsistemas.com │');
    console.log('   │  🔑 Senha: SuperAdmin@2024             │');
    console.log('   └─────────────────────────────────────────┘');
    console.log('');
    console.log('⚠️  IMPORTANTE: Guarde estas credenciais em local seguro!');
    console.log('');
    console.log('📝 COMO USAR:');
    console.log('   1. Acesse: http://localhost:3001/login');
    console.log('   2. Use as credenciais acima');
    console.log('   3. Clique no botão "Administração de Tenants"');
    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('');

  } catch (error) {
    console.error('❌ Erro ao criar Super Admin:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

createSuperAdmin();



