/**
 * Script para testar a API de custos
 */

const fetch = require('node-fetch');

async function testarAPI() {
  console.log('\n🧪 ===== TESTE DA API DE CUSTOS =====\n');
  
  const accountId = 3; // ID da conta
  const url = `http://localhost:3001/api/whatsapp-accounts/${accountId}/details`;
  
  console.log(`📡 Chamando: ${url}\n`);
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    console.log('📦 Status:', response.status);
    console.log('📦 Resposta completa:', JSON.stringify(data, null, 2));
    
    if (data.success && data.data) {
      console.log('\n💰 CUSTOS:');
      console.log(`   Total: R$ ${data.data.total_cost || 0}`);
      console.log(`   Utility: R$ ${data.data.cost_utility || 0}`);
      console.log(`   Marketing: R$ ${data.data.cost_marketing || 0}`);
      console.log(`   Authentication: R$ ${data.data.cost_authentication || 0}`);
      console.log(`   Service: R$ ${data.data.cost_service || 0}`);
      
      console.log('\n📊 MENSAGENS:');
      console.log(`   Utility: ${data.data.stats_utility || 0}`);
      console.log(`   Marketing: ${data.data.stats_marketing || 0}`);
      
      console.log('\n========================================');
      console.log('✅ API funcionando corretamente!');
      console.log('========================================\n');
    } else {
      console.log('\n❌ Erro:', data.error);
    }
  } catch (error) {
    console.error('\n❌ ERRO:', error.message);
  }
}

testarAPI();

