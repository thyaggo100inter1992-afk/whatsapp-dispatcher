const { query } = require('./src/database/connection');

async function corrigirTenant() {
  console.log('\n🔧 CORRIGINDO TENANT "Minha Empresa"...\n');

  try {
    // Atualizar limites customizados
    await query(`
      UPDATE tenants 
      SET 
        limites_customizados = true,
        limite_usuarios_customizado = 10,
        limite_whatsapp_customizado = 10,
        updated_at = NOW()
      WHERE id = 1
    `);

    console.log('✅ Limites customizados aplicados!\n');

    // Verificar resultado
    const result = await query(`
      SELECT 
        id,
        nome,
        limites_customizados,
        limite_usuarios_customizado,
        limite_whatsapp_customizado,
        (SELECT COUNT(*) FROM tenant_users WHERE tenant_id = 1 AND ativo = true) as usuarios_ativos,
        (SELECT COUNT(*) FROM whatsapp_accounts WHERE tenant_id = 1) as contas_api,
        (SELECT COUNT(*) FROM uaz_instances WHERE tenant_id = 1) as contas_qr
      FROM tenants
      WHERE id = 1
    `);

    const tenant = result.rows[0];

    console.log('📊 RESULTADO:\n');
    console.log(`Tenant: ${tenant.nome} (ID: ${tenant.id})`);
    console.log(`Limites Customizados: ${tenant.limites_customizados ? 'SIM' : 'NÃO'}`);
    console.log(`\nLimites Atuais:`);
    console.log(`  - Usuários: ${tenant.limite_usuarios_customizado}`);
    console.log(`  - Contas WhatsApp: ${tenant.limite_whatsapp_customizado}`);
    console.log(`\nUso Atual:`);
    console.log(`  - Usuários Ativos: ${tenant.usuarios_ativos}`);
    console.log(`  - Contas API: ${tenant.contas_api}`);
    console.log(`  - Contas QR: ${tenant.contas_qr}`);
    console.log(`  - Total Contas: ${parseInt(tenant.contas_api) + parseInt(tenant.contas_qr)}`);

    const usuariosOK = parseInt(tenant.usuarios_ativos) <= parseInt(tenant.limite_usuarios_customizado);
    const contasOK = (parseInt(tenant.contas_api) + parseInt(tenant.contas_qr)) <= parseInt(tenant.limite_whatsapp_customizado);

    console.log(`\nStatus:`);
    console.log(`  ${usuariosOK ? '✅' : '❌'} Usuários: ${usuariosOK ? 'DENTRO DO LIMITE' : 'ACIMA DO LIMITE'}`);
    console.log(`  ${contasOK ? '✅' : '❌'} Contas WhatsApp: ${contasOK ? 'DENTRO DO LIMITE' : 'ACIMA DO LIMITE'}`);

    if (usuariosOK && contasOK) {
      console.log('\n🎉 PROBLEMA RESOLVIDO! Tenant está dentro dos limites.\n');
    } else {
      console.log('\n⚠️  ATENÇÃO: Tenant ainda está acima dos limites. Considere aumentar mais.\n');
    }

  } catch (error) {
    console.error('\n❌ ERRO:', error.message);
    console.error(error);
  } finally {
    process.exit(0);
  }
}

corrigirTenant();





