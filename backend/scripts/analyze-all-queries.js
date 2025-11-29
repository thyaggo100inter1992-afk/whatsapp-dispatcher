const fs = require('fs');
const path = require('path');

console.log('🔍 ANALISANDO TODAS AS QUERIES SQL DO SISTEMA\n');
console.log('='.repeat(80));

const srcDir = path.join(__dirname, '../src');
const results = {
  total: 0,
  withTenant: 0,
  withoutTenant: 0,
  suspicious: []
};

// Tabelas que DEVEM ter tenant_id
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
        results.total++;
        
        // Verificar se a query tem tenant_id na mesma linha ou nas próximas 3 linhas
        let queryContext = lines.slice(index, index + 4).join('\n');
        
        const hasTenantId = /tenant_id/i.test(queryContext);
        const hasReqTenant = /req\.tenant/i.test(queryContext);
        const hasTenantParam = /tenantId/i.test(queryContext);
        
        if (hasTenantId || hasReqTenant || hasTenantParam) {
          results.withTenant++;
        } else {
          results.withoutTenant++;
          
          // Query suspeita (sem tenant_id)
          results.suspicious.push({
            file: filePath.replace(srcDir, 'src'),
            line: lineNum,
            table: table,
            query: line.trim().substring(0, 100),
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
console.log('\n📊 RESUMO DA ANÁLISE:');
console.log('='.repeat(80));
console.log(`Total de queries em tabelas críticas: ${results.total}`);
console.log(`✅ Com tenant_id: ${results.withTenant} (${((results.withTenant/results.total)*100).toFixed(1)}%)`);
console.log(`❌ Sem tenant_id: ${results.withoutTenant} (${((results.withoutTenant/results.total)*100).toFixed(1)}%)`);

if (results.suspicious.length > 0) {
  console.log('\n🚨 QUERIES SUSPEITAS (SEM TENANT_ID):');
  console.log('='.repeat(80));
  
  // Agrupar por arquivo
  const byFile = {};
  results.suspicious.forEach(item => {
    if (!byFile[item.file]) byFile[item.file] = [];
    byFile[item.file].push(item);
  });
  
  Object.keys(byFile).sort().forEach(file => {
    console.log(`\n📁 ${file}`);
    byFile[file].forEach(item => {
      console.log(`   Linha ${item.line} | ${item.type} | Tabela: ${item.table}`);
      console.log(`   Query: ${item.query}...`);
    });
  });
  
  console.log('\n' + '='.repeat(80));
  console.log(`\n⚠️  ATENÇÃO: ${results.suspicious.length} queries sem tenant_id encontradas!`);
  console.log('Estas queries podem causar vazamento de dados entre tenants.');
} else {
  console.log('\n✅ Nenhuma query suspeita encontrada!');
}

console.log('\n' + '='.repeat(80));

