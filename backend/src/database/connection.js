// Wrapper para permitir que arquivos .js importem connection.ts
// Quando rodando com tsx, ele consegue importar .ts diretamente

try {
  // Importa o módulo TypeScript
  const tsConnection = require('./connection.ts');
  
  // Re-exporta tudo
  module.exports = tsConnection;
} catch (error) {
  // Fallback para versão compilada
  console.log('⚠️ Usando conexão compilada (dist)');
  module.exports = require('../../dist/database/connection');
}
