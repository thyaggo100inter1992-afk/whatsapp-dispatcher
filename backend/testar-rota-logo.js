const axios = require('axios');

async function testarRota() {
  try {
    console.log('\n🧪 Testando rota /api/system-settings/public...\n');
    
    const response = await axios.get('http://localhost:3001/api/system-settings/public');
    
    console.log('✅ Rota funcionando!');
    console.log('📊 Status:', response.status);
    console.log('📦 Dados recebidos:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('❌ Erro ao testar rota:');
    console.error('   Status:', error.response?.status);
    console.error('   Mensagem:', error.response?.data || error.message);
  } finally {
    process.exit();
  }
}

testarRota();





