/**
 * Script para analisar controllers e gerar relatório de migração
 * Executa: node backend/scripts/analyze-controllers.js
 */

const fs = require('fs');
const path = require('path');

// Cores para terminal
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

const controllersDir = path.join(__dirname, '../src/controllers');

console.log('');
console.log(colors.cyan + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' + colors.reset);
console.log(colors.bright + '🔍 ANÁLISE DE CONTROLLERS PARA MIGRAÇÃO MULTI-TENANT' + colors.reset);
console.log(colors.cyan + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' + colors.reset);
console.log('');

// Ler todos os arquivos do diretório
const files = fs.readdirSync(controllersDir);
const controllers = files.filter(f => f.endsWith('.ts') || f.endsWith('.js'));

console.log(`📁 Diretório: ${controllersDir}`);
console.log(`📊 Total de controllers: ${colors.yellow}${controllers.length}${colors.reset}`);
console.log('');

let totalNeedsMigration = 0;
let totalUsesQuery = 0;
const report = [];

// Analisar cada controller
for (const file of controllers) {
  const filePath = path.join(controllersDir, file);
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Verificar se já está migrado
  const alreadyMigrated = content.includes('tenantQuery') || content.includes('tenant-query');
  
  // Contar ocorrências de query()
  const queryMatches = content.match(/await\s+query\s*\(/g) || [];
  const queryCount = queryMatches.length;
  
  // Contar imports
  const hasQueryImport = content.includes("from '../database/connection'") || 
                         content.includes('from "../database/connection"');
  
  // Contar INSERT/UPDATE
  const insertMatches = content.match(/INSERT\s+INTO/gi) || [];
  const updateMatches = content.match(/UPDATE\s+\w+\s+SET/gi) || [];
  
  const needsMigration = !alreadyMigrated && hasQueryImport && queryCount > 0;
  
  if (needsMigration) {
    totalNeedsMigration++;
  }
  
  if (queryCount > 0) {
    totalUsesQuery++;
  }
  
  report.push({
    file,
    alreadyMigrated,
    needsMigration,
    queryCount,
    insertCount: insertMatches.length,
    updateCount: updateMatches.length,
    hasQueryImport,
  });
}

// Ordenar: os que precisam de migração primeiro
report.sort((a, b) => {
  if (a.needsMigration && !b.needsMigration) return -1;
  if (!a.needsMigration && b.needsMigration) return 1;
  return b.queryCount - a.queryCount;
});

// Exibir relatório
console.log(colors.cyan + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' + colors.reset);
console.log(colors.bright + '📊 RELATÓRIO DETALHADO' + colors.reset);
console.log(colors.cyan + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' + colors.reset);
console.log('');

for (const item of report) {
  const status = item.alreadyMigrated ? 
    colors.green + '✅ MIGRADO' + colors.reset : 
    (item.needsMigration ? 
      colors.red + '❌ PRECISA MIGRAR' + colors.reset : 
      colors.blue + '⚪ NÃO USA QUERY' + colors.reset);
  
  console.log(`${status} ${colors.bright}${item.file}${colors.reset}`);
  
  if (item.queryCount > 0) {
    console.log(`   📌 Queries: ${colors.yellow}${item.queryCount}${colors.reset}`);
  }
  
  if (item.insertCount > 0) {
    console.log(`   ➕ INSERTs: ${colors.yellow}${item.insertCount}${colors.reset} (adicionar tenant_id)`);
  }
  
  if (item.updateCount > 0) {
    console.log(`   ✏️  UPDATEs: ${colors.yellow}${item.updateCount}${colors.reset}`);
  }
  
  console.log('');
}

// Resumo final
console.log(colors.cyan + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' + colors.reset);
console.log(colors.bright + '📈 RESUMO FINAL' + colors.reset);
console.log(colors.cyan + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' + colors.reset);
console.log('');
console.log(`✅ Já migrados:        ${colors.green}${report.filter(r => r.alreadyMigrated).length}${colors.reset}`);
console.log(`❌ Precisam migrar:    ${colors.red}${totalNeedsMigration}${colors.reset}`);
console.log(`⚪ Não usam query:     ${colors.blue}${controllers.length - totalUsesQuery}${colors.reset}`);
console.log(`📊 Total:              ${colors.yellow}${controllers.length}${colors.reset}`);
console.log('');

if (totalNeedsMigration > 0) {
  console.log(colors.yellow + '⚠️  AÇÃO NECESSÁRIA:' + colors.reset);
  console.log('');
  console.log('1. Migre os controllers marcados com ❌');
  console.log('2. Siga o guia: MIGRACAO-RAPIDA.md');
  console.log('3. Veja exemplo: EXEMPLO-MIGRACAO-WHATSAPP-ACCOUNT.md');
  console.log('');
  console.log(colors.cyan + '💡 Dica: Migre nesta ordem (do mais simples ao mais complexo)' + colors.reset);
  console.log('');
  
  const toMigrate = report.filter(r => r.needsMigration);
  toMigrate.sort((a, b) => a.queryCount - b.queryCount);
  
  toMigrate.forEach((item, index) => {
    console.log(`   ${index + 1}. ${item.file} (${item.queryCount} queries)`);
  });
  console.log('');
} else {
  console.log(colors.green + '🎉 TODOS OS CONTROLLERS JÁ ESTÃO MIGRADOS!' + colors.reset);
  console.log('');
}

console.log(colors.cyan + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' + colors.reset);
console.log('');





