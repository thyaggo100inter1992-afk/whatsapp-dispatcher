/**
 * Script para testar o webhook do Asaas
 * Simula uma notificação de pagamento confirmado
 */

const axios = require('axios');

async function testarWebhookAsaas() {
  console.log('\n🧪 ===== TESTANDO WEBHOOK ASAAS =====\n');

  // URL do webhook (ajuste se necessário)
  const webhookUrl = 'http://localhost:3001/api/payments/webhook';

  // Dados simulados de um webhook do Asaas
  const webhookData = {
    event: 'PAYMENT_CONFIRMED',
    payment: {
      id: 'pay_test_12345',
      customer: 'cus_000005401977',
      billingType: 'PIX',
      value: 15.00,
      netValue: 14.55,
      status: 'CONFIRMED',
      description: 'Compra de 10 consultas avulsas',
      externalReference: 'consultas_avulsas_1_1732577000000',
      confirmedDate: new Date().toISOString(),
      paymentDate: new Date().toISOString()
    }
  };

  console.log('📍 URL do Webhook:', webhookUrl);
  console.log('📦 Dados enviados:');
  console.log(JSON.stringify(webhookData, null, 2));
  console.log('\n🚀 Enviando webhook...\n');

  try {
    const response = await axios.post(webhookUrl, webhookData);
    
    console.log('✅ WEBHOOK RECEBIDO COM SUCESSO!');
    console.log('📊 Status:', response.status);
    console.log('📄 Resposta:', JSON.stringify(response.data, null, 2));
    console.log('\n🎉 Teste concluído com sucesso!\n');
    
  } catch (error) {
    console.error('❌ ERRO ao enviar webhook:');
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Dados:', error.response.data);
    } else if (error.request) {
      console.error('Nenhuma resposta recebida do servidor');
      console.error('Verifique se o backend está rodando em http://localhost:3001');
    } else {
      console.error('Erro:', error.message);
    }
    
    console.log('\n❌ Teste falhou!\n');
  }
}

// Executar teste
testarWebhookAsaas();




