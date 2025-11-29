#!/usr/bin/env node

const http = require('http');

async function aguardar(segundos) {
  console.log(`\n⏳ Aguardando ${segundos} segundos para compilação...\n`);
  await new Promise(resolve => setTimeout(resolve, segundos * 1000));
}

async function verificar(url, nome, tentativas = 10) {
  for (let i = 1; i <= tentativas; i++) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(url, (res) => {
          if (res.statusCode === 200 || res.statusCode === 404 || res.statusCode === 401) {
            console.log(`✅ ${nome} está RODANDO! (${url})`);
            resolve(true);
          } else {
            reject(new Error(`Status: ${res.statusCode}`));
          }
        });
        req.on('error', reject);
        req.setTimeout(2000, () => {
          req.destroy();
          reject(new Error('Timeout'));
        });
      });
      return true;
    } catch (err) {
      console.log(`⏳ Tentativa ${i}/${tentativas} - ${nome} ainda não está pronto...`);
      if (i < tentativas) {
        await aguardar(2);
      }
    }
  }
  console.log(`❌ ${nome} NÃO respondeu após ${tentativas} tentativas`);
  return false;
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║                                                          ║');
  console.log('║       🔍 AGUARDANDO COMPILAÇÃO E VERIFICANDO 🔍          ║');
  console.log('║                                                          ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  // Aguardar inicial
  await aguardar(5);

  // Verificar Backend
  console.log('\n━━━━ VERIFICANDO BACKEND ━━━━\n');
  const backendOk = await verificar('http://localhost:3000', 'Backend (porta 3000)', 5);

  // Verificar Frontend
  console.log('\n━━━━ VERIFICANDO FRONTEND ━━━━\n');
  const frontendOk = await verificar('http://localhost:3001', 'Frontend (porta 3001)', 10);

  // Resultado
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  if (backendOk && frontendOk) {
    console.log('║                                                          ║');
    console.log('║     ✅ SISTEMA 100% OPERACIONAL! ✅                      ║');
    console.log('║                                                          ║');
    console.log('║  🔧 Backend:  http://localhost:3000  ✅                  ║');
    console.log('║  🌐 Frontend: http://localhost:3001  ✅                  ║');
    console.log('║                                                          ║');
    console.log('║  📄 Acesse: http://localhost:3001/login                  ║');
    console.log('║  📧 Email: admin@minhaempresa.com                        ║');
    console.log('║  🔑 Senha: admin123                                      ║');
    console.log('║                                                          ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');
    process.exit(0);
  } else {
    console.log('║                                                          ║');
    console.log('║     ⚠️  ALGUNS SERVIÇOS NÃO INICIARAM ⚠️                ║');
    console.log('║                                                          ║');
    if (!backendOk) console.log('║  ❌ Backend não está rodando                              ║');
    if (!frontendOk) console.log('║  ❌ Frontend não está rodando                             ║');
    console.log('║                                                          ║');
    console.log('║  Verifique as janelas que foram abertas para ver erros.  ║');
    console.log('║                                                          ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');
    process.exit(1);
  }
}

main();





