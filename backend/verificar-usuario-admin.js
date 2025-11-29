const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'whatsapp_dispatcher',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD
});

async function verificarUsuarioAdmin() {
  try {
    console.log('🔍 ===== VERIFICANDO USUÁRIO ADMIN =====\n');

    // Buscar usuário admin
    const usuario = await pool.query(`
      SELECT 
        tu.*,
        t.nome as tenant_nome,
        t.status as tenant_status
      FROM tenant_users tu
      INNER JOIN tenants t ON tu.tenant_id = t.id
      WHERE tu.email = 'admin@minhaempresa.com'
    `);

    if (usuario.rows.length === 0) {
      console.log('❌ Usuário admin@minhaempresa.com não encontrado!\n');
      return;
    }

    const user = usuario.rows[0];
    console.log('📋 INFORMAÇÕES DO USUÁRIO:\n');
    console.log(`  ID: ${user.id}`);
    console.log(`  Nome: ${user.name}`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Role: ${user.role}`);
    console.log(`  Tenant ID: ${user.tenant_id}`);
    console.log(`  Tenant Nome: ${user.tenant_nome}`);
    console.log(`  Tenant Status: ${user.tenant_status}`);
    console.log(`  Usuário Ativo: ${user.ativo ? 'SIM' : 'NÃO'}`);

    // Verificar contas do tenant
    console.log('\n\n📊 CONTAS DO TENANT 1:\n');
    
    const apiContas = await pool.query(`
      SELECT COUNT(*) as total, 
             SUM(CASE WHEN is_active THEN 1 ELSE 0 END) as ativas
      FROM whatsapp_accounts 
      WHERE tenant_id = 1
    `);
    
    console.log(`  WhatsApp API: ${apiContas.rows[0].total} total (${apiContas.rows[0].ativas} ativas)`);

    const qrContas = await pool.query(`
      SELECT COUNT(*) as total,
             SUM(CASE WHEN status = 'connected' THEN 1 ELSE 0 END) as conectadas
      FROM uaz_instances 
      WHERE tenant_id = 1
    `);
    
    console.log(`  WhatsApp QR: ${qrContas.rows[0].total} total (${qrContas.rows[0].conectadas} conectadas)`);

    console.log('\n\n✅ Tudo configurado corretamente!');
    console.log('\n💡 FAÇA LOGOUT E LOGIN NOVAMENTE para ver as contas.\n');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await pool.end();
  }
}

verificarUsuarioAdmin();



