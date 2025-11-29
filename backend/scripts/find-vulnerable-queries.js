const fs = require('fs');
const path = require('path');

console.log('🔍 PROCURANDO QUERIES VULNERÁVEIS (sem tenantQuery)\n');
console.log('='.repeat(80));

const srcDir = path.join(__dirname, '../src');
const results = {
  vulnerable: [],
  safe: []
};

const criticalTables = [
  'whatsapp_accounts',
  'campaigns',
  'messages',
  'contacts',
  'templates',
  'qr_campaigns',
  'uaz_instances',
  'webhooks',
  'restriction_lists',
  'restriction_list_entries',
  'files',
  'novavida_queries',
  'audit_logs',
  'proxies',
  'products',
  'button_clicks',
  'webhook_logs',
  'uaz_instance_logs'
];

function analyzeFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  lines.forEach((line, index) => {
    const lineNum = index + 1;
    
    // Detectar queries SQL
    const selectMatch = line.match(/SELECT\s+.*?\s+FROM\s+(\w+)/i);
    const insertMatch = line.match(/INSERT\s+INTO\s+(\w+)/i);
    const updateMatch = line.match(/UPDATE\s+(\w+)\s+SET/i);
    const deleteMatch = line.match(/DELETE\s+FROM\s+(\w+)/i);
    
    const matches = [selectMatch, insertMatch, updateMatch, deleteMatch].filter(Boolean);
    
    matches.forEach(match => {
      const table = match[1];
      
      // Verificar se é uma tabela crítica
      if (criticalTables.includes(table)) {
        // Verificar se usa tenantQuery (SEGURO)
        const usesTenantQuery = lines.slice(Math.max(0, index - 3), index + 1)
          .join('\n')
          .includes('tenantQuery');
        
        // Verificar se usa query ou pool.query DIRETO (VULNERÁVEL)
        const usesDirectQuery = lines.slice(Math.max(0, index - 3), index + 1)
          .join('\n')
          .match(/\b(query|pool\.query)\s*\(/);
        
        // Verificar se tem tenant_id na própria query
        const hasTenantIdInQuery = /tenant_id/i.test(line);
        
        if (usesTenantQuery) {
          // Usa tenantQuery = SEGURO
          return;
        }
        
        if (usesDirectQuery && !hasTenantIdInQuery) {
          // Usa query direto SEM tenant_id = VULNERÁVEL
          results.vulnerable.push({
            file: filePath.replace(srcDir, 'src'),
            line: lineNum,
            table: table,
            query: line.trim(),
            type: match[0].split(' ')[0].toUpperCase()
          });
        }
      }
    });
  });
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory() && !file.includes('node_modules') && !file.includes('.git')) {
      walkDir(fullPath);
    } else if (file.endsWith('.ts') || file.endsWith('.js')) {
      analyzeFile(fullPath);
    }
  });
}

// Executar análise
walkDir(srcDir);

// Exibir resultados
console.log('\n🚨 QUERIES VULNERÁVEIS (query/pool.query SEM tenant_id):');
console.log('='.repeat(80));

if (results.vulnerable.length > 0) {
  // Agrupar por arquivo
  const byFile = {};
  results.vulnerable.forEach(item => {
    if (!byFile[item.file]) byFile[item.file] = [];
    byFile[item.file].push(item);
  });
  
  console.log(`\n📊 Total: ${results.vulnerable.length} queries vulneráveis\n`);
  
  Object.keys(byFile).sort().forEach((file, fileIndex) => {
    console.log(`\n${fileIndex + 1}. 📁 ${file}`);
    byFile[file].forEach((item, itemIndex) => {
      console.log(`   ${String.fromCharCode(97 + itemIndex)}) Linha ${item.line} | ${item.type} | ${item.table}`);
      console.log(`      ${item.query.substring(0, 100)}...`);
    });
  });
  
  console.log('\n' + '='.repeat(80));
  console.log(`\n⚠️  ${results.vulnerable.length} queries precisam ser corrigidas!`);
} else {
  console.log('\n✅ Nenhuma query vulnerável encontrada!');
}

console.log('\n' + '='.repeat(80));

