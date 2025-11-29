import { query } from './src/database/connection';

async function disableProxy() {
  try {
    console.log('🔧 Desabilitando proxy da instância 556291785664...');
    
    const result = await query(
      "UPDATE uaz_instances SET proxy_id = NULL WHERE phone_number = '556291785664'"
    );
    
    console.log('✅ Proxy desabilitado com sucesso!');
    
    const check = await query(
      "SELECT phone_number, proxy_id, is_connected FROM uaz_instances WHERE phone_number = '556291785664'"
    );
    
    if (check.rows.length > 0) {
      console.log('\n📋 Status atual da instância:');
      console.log('   Telefone:', check.rows[0].phone_number);
      console.log('   Proxy ID:', check.rows[0].proxy_id || 'N/A (DESABILITADO)');
      console.log('   Conectado:', check.rows[0].is_connected ? '✅ SIM' : '❌ NÃO');
    }
    
    console.log('\n✅ PRONTO! Agora tente enviar a mensagem novamente.');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Erro ao desabilitar proxy:', error.message);
    process.exit(1);
  }
}

disableProxy();

