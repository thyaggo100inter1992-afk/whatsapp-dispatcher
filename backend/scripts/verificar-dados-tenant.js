const { pool } = require('../dist/database/connection');

async function verificarDadosTenant() {
  try {
    console.log('🔍 ===== VERIFICANDO DADOS DO TENANT 1 =====\n');

    // Verificar tenant
    const tenant = await pool.query('SELECT * FROM tenants WHERE id = 1');
    console.log('📊 TENANT:');
    console.log(tenant.rows[0] || '❌ Nenhum tenant encontrado');
    console.log();

    // Verificar usuário
    const users = await pool.query('SELECT * FROM tenant_users WHERE tenant_id = 1');
    console.log(`👤 USUÁRIOS: ${users.rows.length}`);
    if (users.rows.length > 0) {
      users.rows.forEach(user => {
        console.log(`   - ${user.email} (${user.role}) - ativo: ${user.is_active}`);
      });
    } else {
      console.log('   ❌ Nenhum usuário encontrado');
    }
    console.log();

    // Verificar proxies
    const proxies = await pool.query('SELECT id, name, host, port FROM proxies WHERE tenant_id = 1');
    console.log(`🔌 PROXIES: ${proxies.rows.length}`);
    proxies.rows.forEach(p => {
      console.log(`   - ${p.name} (${p.host}:${p.port})`);
    });
    console.log();

    // Verificar whatsapp_accounts
    const accounts = await pool.query('SELECT id, name, phone_number FROM whatsapp_accounts WHERE tenant_id = 1');
    console.log(`📱 CONTAS WHATSAPP: ${accounts.rows.length}`);
    accounts.rows.forEach(a => {
      console.log(`   - ${a.name} (${a.phone_number || 'sem número'})`);
    });
    console.log();

    // Verificar campanhas
    const campaigns = await pool.query('SELECT id, name, status FROM campaigns WHERE tenant_id = 1');
    console.log(`📋 CAMPANHAS: ${campaigns.rows.length}`);
    campaigns.rows.forEach(c => {
      console.log(`   - ${c.name} (${c.status})`);
    });
    console.log();

    // Verificar templates QR
    const templates = await pool.query('SELECT id, name FROM qr_templates WHERE tenant_id = 1');
    console.log(`📝 TEMPLATES QR: ${templates.rows.length}`);
    templates.rows.forEach(t => {
      console.log(`   - ${t.name}`);
    });
    console.log();

    // Verificar instâncias UAZ
    const instances = await pool.query('SELECT id, name, status FROM uaz_instances WHERE tenant_id = 1');
    console.log(`🔗 INSTÂNCIAS UAZ: ${instances.rows.length}`);
    instances.rows.forEach(i => {
      console.log(`   - ${i.name} (${i.status})`);
    });
    console.log();

    // Verificar mensagens
    const messages = await pool.query('SELECT COUNT(*) as count FROM messages WHERE tenant_id = 1');
    console.log(`💬 MENSAGENS: ${messages.rows[0].count}`);
    console.log();

    // Verificar contatos
    const contacts = await pool.query('SELECT COUNT(*) as count FROM contacts WHERE tenant_id = 1');
    console.log(`📞 CONTATOS: ${contacts.rows[0].count}`);
    console.log();

    console.log('====================================================\n');

    if (
      proxies.rows.length === 0 &&
      accounts.rows.length === 0 &&
      campaigns.rows.length === 0 &&
      templates.rows.length === 0 &&
      instances.rows.length === 0
    ) {
      console.log('⚠️  ATENÇÃO: O tenant 1 NÃO tem dados configurados!');
      console.log('');
      console.log('ISSO SIGNIFICA:');
      console.log('  - O sistema está funcionando corretamente');
      console.log('  - Mas você precisa CRIAR as configurações do zero');
      console.log('  - Como se fosse um sistema novo');
      console.log('');
      console.log('POSSÍVEIS CAUSAS:');
      console.log('  1. O banco estava vazio antes da migração');
      console.log('  2. As migrations foram executadas em banco limpo');
      console.log('  3. Os dados antigos não foram migrados corretamente');
      console.log('');
      console.log('SOLUÇÃO:');
      console.log('  - Configure o sistema manualmente pelas páginas');
      console.log('  - OU restaure um backup do banco antes da migração');
      console.log('');
    } else {
      console.log('✅ O tenant 1 tem dados configurados!');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao verificar dados:', error);
    process.exit(1);
  }
}

verificarDadosTenant();

