/**
 * Script para adicionar ENCRYPTION_KEY ao .env
 */

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

console.log('\n🔐 ===== ADICIONANDO ENCRYPTION_KEY =====\n');

try {
  const envPath = path.join(__dirname, '.env');
  
  // Verificar se .env existe
  if (!fs.existsSync(envPath)) {
    console.error('❌ Arquivo .env não encontrado!');
    console.log('\n📝 Crie o arquivo .env primeiro copiando de .env.example\n');
    process.exit(1);
  }

  // Ler .env atual
  let envContent = fs.readFileSync(envPath, 'utf8');

  // Verificar se já tem ENCRYPTION_KEY
  if (envContent.includes('ENCRYPTION_KEY=')) {
    console.log('⚠️  ENCRYPTION_KEY já existe no .env');
    console.log('\n✅ Nada a fazer!\n');
    process.exit(0);
  }

  // Gerar chave aleatória de 32 caracteres
  const key = crypto.randomBytes(32).toString('hex').substring(0, 32);

  // Adicionar ao .env
  if (!envContent.endsWith('\n')) {
    envContent += '\n';
  }
  
  envContent += '\n# Chave de criptografia para dados sensíveis (Facebook tokens)\n';
  envContent += `ENCRYPTION_KEY=${key}\n`;

  // Salvar
  fs.writeFileSync(envPath, envContent, 'utf8');

  console.log('✅ ENCRYPTION_KEY adicionada com sucesso!');
  console.log(`📋 Chave gerada: ${key}`);
  console.log('\n========================================');
  console.log('✅ PRONTO! Agora reinicie o backend!');
  console.log('========================================\n');
  console.log('Passos:');
  console.log('  1. Pressione Ctrl+C no terminal do backend');
  console.log('  2. Execute: 3-iniciar-backend.bat');
  console.log('  3. Tente salvar a integração novamente\n');

} catch (error) {
  console.error('\n❌ ERRO:', error.message);
  console.log('\n🔧 Solução manual:');
  console.log('  1. Abra o arquivo: backend\\.env');
  console.log('  2. Adicione esta linha no final:');
  console.log('     ENCRYPTION_KEY=abcdef0123456789abcdef0123456789');
  console.log('  3. Salve e reinicie o backend\n');
  process.exit(1);
}

