const fs = require('fs');

let content = fs.readFileSync('/root/whatsapp-dispatcher/backend/src/routes/permissions.routes.js', 'utf8');

// Adicionar log antes de retornar funcionalidadesFinais
const searchStr = "console.log('🔑 Funcionalidades FINAIS (AND lógico) enviadas ao frontend:', funcionalidadesFinais);";
const replaceStr = `console.log('🔑 Funcionalidades FINAIS (AND lógico) enviadas ao frontend:', funcionalidadesFinais);
    console.log('🔒 CONFIGURACOES especificamente:', funcionalidadesFinais.configuracoes);
    console.log('🔒 permissoesUsuario.configuracoes:', permissoesUsuario.configuracoes);`;

if (content.includes(searchStr)) {
  content = content.replace(searchStr, replaceStr);
  fs.writeFileSync('/root/whatsapp-dispatcher/backend/src/routes/permissions.routes.js', content);
  console.log('Log de debug adicionado!');
} else {
  // Tenta encontrar pelo texto parcial
  const altSearch = "Funcionalidades FINAIS";
  if (content.includes(altSearch)) {
    console.log('Texto parcial encontrado, mas formato diferente');
    console.log('Procurando por alternativa...');
    
    // Adiciona o log após funcionalidadesFinais
    content = content.replace(
      /console\.log\([^)]*Funcionalidades FINAIS[^)]*\);/,
      `$&
    console.log('CONFIGURACOES DEBUG:', funcionalidadesFinais.configuracoes, permissoesUsuario.configuracoes);`
    );
    fs.writeFileSync('/root/whatsapp-dispatcher/backend/src/routes/permissions.routes.js', content);
    console.log('Log alternativo adicionado!');
  } else {
    console.log('Texto nao encontrado!');
  }
}

