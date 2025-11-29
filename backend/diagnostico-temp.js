const { query } = require('./src/database/connection');

(async () => {
  try {
    console.log('\n========================================');
    console.log('1. CREDENCIAIS UAZAP CADASTRADAS');
    console.log('========================================\n');
    
    const creds = await query(`
      SELECT 
        id,
        name as "Nome",
        server_url as "URL",
        CASE WHEN is_default THEN '⭐ SIM' ELSE 'Não' END as "Padrão?",
        CASE WHEN is_active THEN '✅ Ativa' ELSE '❌ Inativa' END as "Status",
        (SELECT COUNT(*) FROM tenants WHERE uazap_credential_id = uazap_credentials.id) as "Tenants Usando"
      FROM uazap_credentials
      ORDER BY is_default DESC, id
    `);
    
    console.table(creds.rows);

    console.log('\n========================================');
    console.log('2. TENANTS E SUAS CREDENCIAIS');
    console.log('========================================\n');
    
    const tenants = await query(`
      SELECT 
        t.id as "ID",
        t.nome as "Nome Tenant",
        t.email as "Email",
        t.uazap_credential_id as "ID Credencial",
        COALESCE(uc.name, '⚠️ SEM CREDENCIAL!') as "Credencial Usada",
        (SELECT COUNT(*) FROM uaz_instances WHERE tenant_id = t.id) as "Total Instâncias",
        (SELECT COUNT(*) FROM uaz_instances WHERE tenant_id = t.id AND credential_id IS NULL) as "Inst Sem Cred",
        (SELECT COUNT(*) FROM uaz_instances WHERE tenant_id = t.id AND is_connected = true) as "Conectadas"
      FROM tenants t
      LEFT JOIN uazap_credentials uc ON t.uazap_credential_id = uc.id
      ORDER BY t.id
    `);
    
    console.table(tenants.rows);

    console.log('\n========================================');
    console.log('3. INSTÂNCIAS POR TENANT (Resumo)');
    console.log('========================================\n');
    
    const instances = await query(`
      SELECT 
        ui.tenant_id as "Tenant ID",
        t.nome as "Nome Tenant",
        COUNT(*) as "Total Instâncias",
        COUNT(CASE WHEN ui.credential_id IS NULL THEN 1 END) as "Sem Credential ID",
        COUNT(CASE WHEN ui.is_connected THEN 1 END) as "Conectadas"
      FROM uaz_instances ui
      JOIN tenants t ON ui.tenant_id = t.id
      GROUP BY ui.tenant_id, t.nome
      ORDER BY ui.tenant_id
    `);
    
    console.table(instances.rows);

    console.log('\n========================================');
    console.log('4. RESUMO GERAL');
    console.log('========================================\n');
    
    const resumo = await query(`
      SELECT 
        (SELECT COUNT(*) FROM uazap_credentials) as "Total Credenciais",
        (SELECT COUNT(*) FROM uazap_credentials WHERE is_default = true) as "Creds Padrão",
        (SELECT COUNT(*) FROM tenants) as "Total Tenants",
        (SELECT COUNT(*) FROM tenants WHERE uazap_credential_id IS NULL) as "Tenants Sem Cred",
        (SELECT COUNT(*) FROM uaz_instances) as "Total Instâncias",
        (SELECT COUNT(*) FROM uaz_instances WHERE credential_id IS NULL) as "Inst Sem Cred"
    `);
    
    console.table(resumo.rows);

    console.log('\n========================================');
    console.log('✅ DIAGNÓSTICO COMPLETO!');
    console.log('========================================\n');
    
    process.exit(0);
  } catch(err) {
    console.error('\n❌ ERRO:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
})();






