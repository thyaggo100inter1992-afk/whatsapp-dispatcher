/**
 * Simulador de Eventos UAZ
 * Envia eventos de teste para o webhook principal
 * 
 * Execute: node simular-evento-uaz.js
 */

const http = require('http');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function enviarEvento(evento) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(evento);
    
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/api/qr-webhook/uaz-event',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = http.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const json = JSON.parse(responseData);
          resolve(json);
        } catch (e) {
          resolve({ success: true, message: responseData });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

async function simularEventos() {
  console.clear();
  log('━'.repeat(70), 'bright');
  log('🚀 SIMULADOR DE EVENTOS UAZ', 'bright');
  log('━'.repeat(70) + '\n', 'bright');

  const WEBHOOK_URL = 'http://localhost:3001/api/qr-webhook/uaz-event';

  // Evento 1: Mensagem Entregue
  log('📨 Enviando evento: MENSAGEM ENTREGUE...', 'cyan');
  try {
    const evento1 = {
      type: 'messages.update',
      data: {
        key: {
          id: `TEST_${Date.now()}_1`,
          remoteJid: '5511999999999@s.whatsapp.net'
        },
        update: {
          status: 2 // delivered
        }
      }
    };

    const res1 = await enviarEvento(evento1);
    log(`   ✅ ${res1.message}`, 'green');
  } catch (error) {
    log(`   ❌ ERRO: ${error.message}`, 'red');
  }

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Evento 2: Mensagem Lida
  log('\n👁️  Enviando evento: MENSAGEM LIDA...', 'cyan');
  try {
    const evento2 = {
      type: 'messages.update',
      data: {
        key: {
          id: `TEST_${Date.now()}_2`,
          remoteJid: '5511999999999@s.whatsapp.net'
        },
        update: {
          status: 3 // read
        }
      }
    };

    const res2 = await enviarEvento(evento2);
    log(`   ✅ ${res2.message}`, 'green');
  } catch (error) {
    log(`   ❌ ERRO: ${error.message}`, 'red');
  }

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Evento 3: Mensagem Falhou
  log('\n❌ Enviando evento: MENSAGEM FALHOU...', 'cyan');
  try {
    const evento3 = {
      type: 'message_status',
      data: {
        messageId: `TEST_${Date.now()}_3`,
        status: 'failed',
        error: 'Número não registrado no WhatsApp'
      }
    };

    const res3 = await enviarEvento(evento3);
    log(`   ✅ ${res3.message}`, 'green');
  } catch (error) {
    log(`   ❌ ERRO: ${error.message}`, 'red');
  }

  log('\n' + '━'.repeat(70), 'bright');
  log('✅ SIMULAÇÃO CONCLUÍDA!', 'green');
  log('━'.repeat(70), 'bright');

  log('\n💡 VERIFIQUE:', 'yellow');
  log('   1. Os logs do backend devem mostrar:', 'blue');
  log('      📨 Evento UAZ recebido: ...', 'cyan');
  log('   2. Abra o navegador:', 'blue');
  log('      http://localhost:3001/api/qr-webhook/health', 'cyan');
  log('   3. Se funcionar, você está recebendo eventos! ✨\n', 'blue');
}

simularEventos().catch(error => {
  log(`\n❌ ERRO CRÍTICO: ${error.message}`, 'red');
  log('\n⚠️  CERTIFIQUE-SE:', 'yellow');
  log('   • Backend está rodando na porta 3001', 'blue');
  log('   • Execute: npm run dev (no terminal do backend)\n', 'cyan');
  process.exit(1);
});

