const axios = require('axios');

/**
 * Script para testar o endpoint de webhook da UAZAP
 * Simula o envio de eventos que a UAZAP enviaria
 */

const BACKEND_URL = 'http://localhost:3000';
const WEBHOOK_ENDPOINT = '/api/qr-webhook/uaz-event';

console.log('🧪 TESTE DE WEBHOOK UAZAP\n');
console.log('='.repeat(60));

// Teste 1: Health Check
async function testeHealthCheck() {
  try {
    console.log('\n1️⃣ Testando Health Check do Webhook...');
    const response = await axios.get(`${BACKEND_URL}/api/qr-webhook/health`);
    console.log('✅ Health Check OK!');
    console.log('   Resposta:', response.data);
    return true;
  } catch (error) {
    console.log('❌ Health Check FALHOU!');
    console.log('   Erro:', error.message);
    if (error.response) {
      console.log('   Status:', error.response.status);
      console.log('   Dados:', error.response.data);
    }
    return false;
  }
}

// Teste 2: Webhook de Status de Mensagem
async function testeWebhookStatus() {
  try {
    console.log('\n2️⃣ Testando Webhook de Status de Mensagem...');
    
    const evento = {
      type: 'message_status',
      data: {
        messageId: 'TEST_MESSAGE_' + Date.now(),
        status: 'delivered',
        phoneNumber: '5562993284885',
        timestamp: new Date().toISOString()
      }
    };
    
    console.log('📤 Enviando evento:', JSON.stringify(evento, null, 2));
    
    const response = await axios.post(`${BACKEND_URL}${WEBHOOK_ENDPOINT}`, evento);
    
    console.log('✅ Webhook de Status RECEBIDO!');
    console.log('   Resposta:', response.data);
    return true;
  } catch (error) {
    console.log('❌ Webhook de Status FALHOU!');
    console.log('   Erro:', error.message);
    if (error.response) {
      console.log('   Status:', error.response.status);
      console.log('   Dados:', error.response.data);
    }
    return false;
  }
}

// Teste 3: Webhook de Mensagem Recebida
async function testeWebhookMensagem() {
  try {
    console.log('\n3️⃣ Testando Webhook de Mensagem Recebida...');
    
    const evento = {
      type: 'messages',
      data: {
        key: {
          id: 'TEST_MSG_' + Date.now(),
          remoteJid: '5562993284885@s.whatsapp.net',
          fromMe: false
        },
        message: {
          conversation: 'Olá, teste de webhook!'
        },
        messageTimestamp: Math.floor(Date.now() / 1000)
      }
    };
    
    console.log('📤 Enviando evento:', JSON.stringify(evento, null, 2));
    
    const response = await axios.post(`${BACKEND_URL}${WEBHOOK_ENDPOINT}`, evento);
    
    console.log('✅ Webhook de Mensagem RECEBIDO!');
    console.log('   Resposta:', response.data);
    return true;
  } catch (error) {
    console.log('❌ Webhook de Mensagem FALHOU!');
    console.log('   Erro:', error.message);
    if (error.response) {
      console.log('   Status:', error.response.status);
      console.log('   Dados:', error.response.data);
    }
    return false;
  }
}

// Teste 4: Webhook de Conexão
async function testeWebhookConexao() {
  try {
    console.log('\n4️⃣ Testando Webhook de Status de Conexão...');
    
    const evento = {
      type: 'connection',
      data: {
        state: 'open',
        instanceToken: 'TEST_TOKEN',
        message: 'Conexão estabelecida'
      }
    };
    
    console.log('📤 Enviando evento:', JSON.stringify(evento, null, 2));
    
    const response = await axios.post(`${BACKEND_URL}${WEBHOOK_ENDPOINT}`, evento);
    
    console.log('✅ Webhook de Conexão RECEBIDO!');
    console.log('   Resposta:', response.data);
    return true;
  } catch (error) {
    console.log('❌ Webhook de Conexão FALHOU!');
    console.log('   Erro:', error.message);
    if (error.response) {
      console.log('   Status:', error.response.status);
      console.log('   Dados:', error.response.data);
    }
    return false;
  }
}

// Executar todos os testes
async function executarTestes() {
  console.log('\n🚀 Iniciando testes de webhook...\n');
  
  const resultados = {
    healthCheck: await testeHealthCheck(),
    webhookStatus: await testeWebhookStatus(),
    webhookMensagem: await testeWebhookMensagem(),
    webhookConexao: await testeWebhookConexao()
  };
  
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 RESULTADOS DOS TESTES:\n');
  
  console.log(`   1️⃣ Health Check:        ${resultados.healthCheck ? '✅ PASSOU' : '❌ FALHOU'}`);
  console.log(`   2️⃣ Webhook Status:       ${resultados.webhookStatus ? '✅ PASSOU' : '❌ FALHOU'}`);
  console.log(`   3️⃣ Webhook Mensagem:     ${resultados.webhookMensagem ? '✅ PASSOU' : '❌ FALHOU'}`);
  console.log(`   4️⃣ Webhook Conexão:      ${resultados.webhookConexao ? '✅ PASSOU' : '❌ FALHOU'}`);
  
  const totalTestes = Object.keys(resultados).length;
  const testesPassaram = Object.values(resultados).filter(r => r).length;
  
  console.log('\n' + '='.repeat(60));
  console.log(`\n📈 Total: ${testesPassaram}/${totalTestes} testes passaram\n`);
  
  if (testesPassaram === totalTestes) {
    console.log('🎉 TODOS OS TESTES PASSARAM! Webhook está funcionando corretamente!\n');
  } else {
    console.log('⚠️  ALGUNS TESTES FALHARAM! Verifique o backend.\n');
    console.log('💡 Dicas:');
    console.log('   - Backend está rodando em http://localhost:4000?');
    console.log('   - Verifique os logs do backend para mais detalhes');
    console.log('   - Execute: npm run dev (na pasta backend)\n');
  }
  
  process.exit(testesPassaram === totalTestes ? 0 : 1);
}

// Executar
executarTestes().catch(error => {
  console.error('\n💥 Erro fatal:', error);
  process.exit(1);
});

