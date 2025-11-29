#!/usr/bin/env node

const http = require('http');

async function aguardar(segundos) {
  console.log(`\n⏳ Aguardando ${segundos} segundos...\n`);
  await new Promise(resolve => setTimeout(resolve, segundos * 1000));
}

async function verificar(url, nome) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      console.log(`✅ ${nome} respondeu! (Status: ${res.statusCode})`);
      resolve(true);
    });
    req.on('error', () => {
      console.log(`❌ ${nome} não está respondendo...`);
      resolve(false);
    });
    req.setTimeout(3000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║                                                          ║');
  console.log('║       🎉 AGUARDANDO INICIALIZAÇÃO 🎉                     ║');
  console.log('║                                                          ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  await aguardar(15);

  console.log('━━━━ VERIFICANDO SERVIÇOS ━━━━\n');
  
  const backendOk = await verificar('http://localhost:3000', 'Backend (porta 3000)');
  const frontendOk = await verificar('http://localhost:3001', 'Frontend (porta 3001)');

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  if (backendOk && frontendOk) {
    console.log('║                                                          ║');
    console.log('║     ✅ SISTEMA 100% OPERACIONAL! ✅                      ║');
    console.log('║                                                          ║');
    console.log('║  🔧 Backend DEV:  http://localhost:3000  ✅              ║');
    console.log('║  🌐 Frontend:     http://localhost:3001  ✅              ║');
    console.log('║                                                          ║');
    console.log('║  📄 ACESSE AGORA: http://localhost:3001/login            ║');
    console.log('║                                                          ║');
    console.log('║  📧 Email: admin@minhaempresa.com                        ║');
    console.log('║  🔑 Senha: admin123                                      ║');
    console.log('║                                                          ║');
    console.log('║  🎉 SISTEMA PRONTO PARA USAR! 🎉                         ║');
    console.log('║                                                          ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');
    process.exit(0);
  } else {
    console.log('║                                                          ║');
    console.log('║     ⚠️  VERIFICANDO STATUS DOS SERVIÇOS ⚠️              ║');
    console.log('║                                                          ║');
    console.log(`║  Backend:  ${backendOk ? '✅ OK' : '❌ NÃO INICIOU'}                                      ║`);
    console.log(`║  Frontend: ${frontendOk ? '✅ OK' : '❌ NÃO INICIOU'}                                      ║`);
    console.log('║                                                          ║');
    console.log('║  Aguarde mais alguns segundos e tente novamente.         ║');
    console.log('║                                                          ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');
    process.exit(1);
  }
}

main();





