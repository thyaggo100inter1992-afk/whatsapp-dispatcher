const fs = require('fs');
const path = require('path');

console.log('🔧 Configurando Cloudinary no .env...\n');

const envPath = path.join(__dirname, '.env');

// Credenciais do Cloudinary
const cloudinaryConfig = `
# ========================================
# CLOUDINARY (HOSPEDAGEM DE IMAGENS)
# ========================================
CLOUDINARY_CLOUD_NAME=dibjfh7we
CLOUDINARY_API_KEY=517372631633628
CLOUDINARY_API_SECRET=OPiab0DcDrgf54V2uktydnZHpKg
`;

try {
  // Ler o .env atual
  let envContent = '';
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
    console.log('✅ Arquivo .env encontrado');
  } else {
    console.log('⚠️ Arquivo .env não existe, será criado');
  }

  // Verificar se Cloudinary já está configurado
  if (envContent.includes('CLOUDINARY_CLOUD_NAME')) {
    console.log('\n⚠️ Cloudinary já está configurado no .env');
    console.log('   Atualizando valores...');
    
    // Remover configurações antigas do Cloudinary
    envContent = envContent.replace(/# ={40}\n# CLOUDINARY[\s\S]*?CLOUDINARY_API_SECRET=.*\n/g, '');
  }

  // Adicionar novas configurações
  envContent = envContent.trim() + '\n' + cloudinaryConfig;

  // Salvar
  fs.writeFileSync(envPath, envContent);

  console.log('\n✅ Cloudinary configurado com sucesso!');
  console.log('\n📋 Configurações adicionadas:');
  console.log('   Cloud Name: dibjfh7we');
  console.log('   API Key: 517372631633628');
  console.log('   API Secret: OPiab0Dc... (oculto)');
  console.log('\n🚀 Agora reinicie o backend com: npm run dev\n');

} catch (error) {
  console.error('❌ Erro ao configurar:', error.message);
  process.exit(1);
}




