const fs = require('fs');
const path = require('path');

/**
 * Script para verificar quais middlewares de limite estão aplicados nas rotas
 */

console.log('\n╔═══════════════════════════════════════════════════════════════════╗');
console.log('║  ✅ VERIFICAÇÃO DE MIDDLEWARES APLICADOS                         ║');
console.log('╚═══════════════════════════════════════════════════════════════════╝\n');

const arquivosParaVerificar = [
  {
    arquivo: 'src/routes/qr-templates.routes.ts',
    middleware: 'checkTemplateLimit',
    rota: 'POST /api/qr-templates'
  },
  {
    arquivo: 'src/routes/template.routes.ts',
    middleware: 'checkTemplateLimit',
    rota: 'POST /api/templates/create-multiple'
  },
  {
    arquivo: 'src/routes/baseDados.ts',
    middleware: 'checkContactLimit',
    rota: 'POST /api/base-dados/importar'
  },
  {
    arquivo: 'src/routes/gestao.routes.js',
    middleware: 'checkUserLimit',
    rota: 'POST /api/gestao/users'
  },
  {
    arquivo: 'src/routes/whatsapp-accounts.routes.js',
    middleware: 'checkWhatsAppLimit',
    rota: 'POST /api/whatsapp-accounts'
  },
  {
    arquivo: 'src/routes/uaz.js',
    middleware: 'checkWhatsAppLimit',
    rota: 'POST /api/uaz/instances'
  },
  {
    arquivo: 'src/routes/campaigns.routes.js',
    middleware: 'checkCampaignLimit',
    rota: 'POST /api/campaigns'
  },
  {
    arquivo: 'src/routes/qr-campaigns.routes.ts',
    middleware: 'checkCampaignLimit',
    rota: 'POST /api/qr-campaigns'
  }
];

console.log('🔍 Verificando arquivos...\n');

let totalVerificados = 0;
let totalEncontrados = 0;
let totalNaoEncontrados = 0;

arquivosParaVerificar.forEach(item => {
  const caminhoCompleto = path.join(__dirname, item.arquivo);
  
  try {
    const conteudo = fs.readFileSync(caminhoCompleto, 'utf8');
    const temMiddleware = conteudo.includes(item.middleware);
    
    totalVerificados++;
    
    if (temMiddleware) {
      console.log(`✅ ${item.rota}`);
      console.log(`   Arquivo: ${item.arquivo}`);
      console.log(`   Middleware: ${item.middleware} ✓\n`);
      totalEncontrados++;
    } else {
      console.log(`❌ ${item.rota}`);
      console.log(`   Arquivo: ${item.arquivo}`);
      console.log(`   Middleware: ${item.middleware} ✗ NÃO ENCONTRADO\n`);
      totalNaoEncontrados++;
    }
  } catch (error) {
    console.log(`⚠️  ${item.rota}`);
    console.log(`   Arquivo: ${item.arquivo}`);
    console.log(`   Erro ao ler arquivo: ${error.message}\n`);
    totalVerificados++;
    totalNaoEncontrados++;
  }
});

console.log('\n╔═══════════════════════════════════════════════════════════════════╗');
console.log('║  📊 RESUMO DA VERIFICAÇÃO                                        ║');
console.log('╚═══════════════════════════════════════════════════════════════════╝\n');

console.log(`Total de rotas verificadas: ${totalVerificados}`);
console.log(`✅ Middlewares aplicados: ${totalEncontrados}`);
console.log(`❌ Middlewares não aplicados: ${totalNaoEncontrados}\n`);

const percentual = ((totalEncontrados / totalVerificados) * 100).toFixed(1);
console.log(`📈 Percentual de cobertura: ${percentual}%\n`);

if (totalNaoEncontrados === 0) {
  console.log('🎉 SUCESSO! Todos os middlewares estão aplicados!\n');
} else {
  console.log(`⚠️  ATENÇÃO: ${totalNaoEncontrados} middleware(s) ainda precisa(m) ser aplicado(s).\n`);
}

process.exit(totalNaoEncontrados > 0 ? 1 : 0);





