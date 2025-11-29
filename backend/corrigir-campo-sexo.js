const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function corrigirCampoSexo() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Corrigindo campo SEXO na tabela base_dados_completa...');
    console.log('');
    
    // Alterar o campo sexo para aceitar valores maiores
    await client.query(`
      ALTER TABLE base_dados_completa 
      ALTER COLUMN sexo TYPE VARCHAR(20);
    `);
    
    console.log('✅ Campo SEXO alterado de VARCHAR(1) para VARCHAR(20)');
    console.log('');
    console.log('════════════════════════════════════════');
    console.log('  ✅ CORREÇÃO APLICADA COM SUCESSO!');
    console.log('════════════════════════════════════════');
    console.log('');
    console.log('💾 Agora os valores como "MASCULINO" e "FEMININO" serão aceitos.');
    console.log('');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    
    // Se o erro for que a tabela não existe, criar ela
    if (error.message.includes('does not exist')) {
      console.log('');
      console.log('⚠️  A tabela base_dados_completa não existe.');
      console.log('💡 Execute: VERIFICAR-E-CRIAR-TABELA-BASE.bat');
      console.log('');
    }
    
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

corrigirCampoSexo().catch(console.error);






