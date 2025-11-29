const { query } = require('./src/database/connection');
const UazService = require('./src/services/uazService');

(async () => {
  try {
    console.log('\n========================================');
    console.log('🔍 TESTANDO CREDENCIAL "UAZAP"');
    console.log('========================================\n');

    // Buscar credencial UAZAP (ID: 1)
    console.log('1. Buscando credencial no banco...');
    const result = await query(`
      SELECT 
        id,
        name,
        server_url,
        admin_token,
        is_active
      FROM uazap_credentials
      WHERE id = 1
    `);

    if (result.rows.length === 0) {
      console.log('❌ Credencial ID 1 não encontrada!');
      process.exit(1);
    }

    const cred = result.rows[0];
    console.log('✅ Credencial encontrada:');
    console.log(`   Nome: ${cred.name}`);
    console.log(`   URL: ${cred.server_url}`);
    console.log(`   Token: ${cred.admin_token.substring(0, 20)}...`);
    console.log(`   Ativa: ${cred.is_active ? 'SIM' : 'NÃO'}`);

    if (!cred.is_active) {
      console.log('\n⚠️  Credencial está INATIVA no banco!');
    }

    console.log('\n2. Testando conexão com a API UAZAP...');
    console.log(`   Tentando conectar em: ${cred.server_url}`);

    // Criar instância do UazService com essa credencial
    const uazService = new UazService(cred.server_url, cred.admin_token);

    // Tentar listar instâncias (teste simples)
    console.log('\n3. Listando instâncias (teste de autenticação)...');
    const fetchResult = await uazService.fetchInstances();

    console.log('\n========================================');
    console.log('📊 RESULTADO DO TESTE:');
    console.log('========================================\n');

    if (fetchResult.success) {
      console.log('✅ CREDENCIAL VÁLIDA!');
      console.log(`✅ Token funcionando corretamente!`);
      console.log(`✅ Total de instâncias na conta: ${fetchResult.instances.length}`);
      
      if (fetchResult.instances.length > 0) {
        console.log('\n📱 Instâncias encontradas:');
        fetchResult.instances.forEach((inst, idx) => {
          console.log(`   ${idx + 1}. ${inst.name || inst.instance_name || 'Sem nome'} (${inst.token?.substring(0, 20)}...)`);
        });
      } else {
        console.log('\n📱 Nenhuma instância criada nesta conta ainda.');
      }
    } else {
      console.log('❌ CREDENCIAL INVÁLIDA!');
      console.log(`❌ Erro: ${fetchResult.error || 'Desconhecido'}`);
      console.log('\n🔧 POSSÍVEIS CAUSAS:');
      console.log('   1. Token expirado ou incorreto');
      console.log('   2. URL da API incorreta');
      console.log('   3. Conta UAZAP desativada/bloqueada');
      console.log('   4. Problema de conexão com o servidor');
    }

    console.log('\n========================================\n');
    process.exit(fetchResult.success ? 0 : 1);

  } catch (error) {
    console.error('\n❌ ERRO NO TESTE:', error.message);
    console.error('\n Stack:', error.stack);
    process.exit(1);
  }
})();






