#!/usr/bin/env node

const http = require('http');

async function aguardar(segundos) {
  console.log(`⏳ Aguardando ${segundos} segundos para compilação...\n`);
  for (let i = segundos; i > 0; i--) {
    process.stdout.write(`\r   ${i} segundos restantes...`);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  console.log('\n');
}

async function verificar(url, nome, tentativas = 5) {
  for (let i = 1; i <= tentativas; i++) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(url, (res) => {
          console.log(`✅ ${nome} está RODANDO! (Status: ${res.statusCode})`);
          resolve(true);
        });
        req.on('error', reject);
        req.setTimeout(2000, () => {
          req.destroy();
          reject(new Error('Timeout'));
        });
      });
      return true;
    } catch (err) {
      if (i < tentativas) {
        console.log(`⏳ ${nome} ainda não está pronto... (tentativa ${i}/${tentativas})`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
  }
  console.log(`❌ ${nome} NÃO respondeu após ${tentativas} tentativas`);
  return false;
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║                                                          ║');
  console.log('║       🔍 VERIFICANDO SISTEMA 🔍                          ║');
  console.log('║                                                          ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  await aguardar(25);

  console.log('━━━━ VERIFICANDO SERVIÇOS ━━━━\n');
  
  const backendOk = await verificar('http://localhost:3000', 'Backend (porta 3000)');
  console.log('');
  const frontendOk = await verificar('http://localhost:3001', 'Frontend (porta 3001)');

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  if (backendOk && frontendOk) {
    console.log('║                                                          ║');
    console.log('║     ✅ SISTEMA 100% OPERACIONAL! ✅                      ║');
    console.log('║                                                          ║');
    console.log('║  🔧 Backend:  http://localhost:3000  ✅                  ║');
    console.log('║  🌐 Frontend: http://localhost:3001  ✅                  ║');
    console.log('║                                                          ║');
    console.log('║  📄 ACESSE AGORA: http://localhost:3001/login            ║');
    console.log('║                                                          ║');
    console.log('║  📧 Email: admin@minhaempresa.com                        ║');
    console.log('║  🔑 Senha: admin123                                      ║');
    console.log('║                                                          ║');
    console.log('║  🎉 PODE USAR! 🎉                                        ║');
    console.log('║                                                          ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');
    process.exit(0);
  } else {
    console.log('║                                                          ║');
    console.log('║     ⚠️  AINDA COMPILANDO... ⚠️                          ║');
    console.log('║                                                          ║');
    console.log(`║  Backend:  ${backendOk ? '✅ OK' : '⏳ Aguarde'}                                      ║`);
    console.log(`║  Frontend: ${frontendOk ? '✅ OK' : '⏳ Aguarde'}                                      ║`);
    console.log('║                                                          ║');
    console.log('║  Verifique as 2 janelas CMD que foram abertas:          ║');
    console.log('║  1. Backend - Porta 3000                                 ║');
    console.log('║  2. Frontend - Porta 3001                                ║');
    console.log('║                                                          ║');
    console.log('║  Aguarde aparecer "Ready" no Frontend!                   ║');
    console.log('║                                                          ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');
    console.log('💡 Execute este script novamente em 30 segundos:');
    console.log('   node backend/scripts/verificar-agora.js\n');
    process.exit(1);
  }
}

main();





