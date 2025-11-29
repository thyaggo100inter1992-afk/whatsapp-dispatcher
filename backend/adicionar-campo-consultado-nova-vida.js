const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function adicionarCampoConsultadoNovaVida() {
  const client = await pool.connect();
  try {
    console.log('🔧 Adicionando campo "consultado_nova_vida" na tabela base_dados_completa...');
    
    // Verificar se o campo já existe
    const checkField = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'base_dados_completa' 
      AND column_name = 'consultado_nova_vida'
    `);
    
    if (checkField.rows.length > 0) {
      console.log('⚠️ Campo "consultado_nova_vida" já existe!');
      
      // Atualizar registros que vieram de consulta
      console.log('🔄 Atualizando registros de consulta_unica e consulta_massa...');
      const updateResult = await client.query(`
        UPDATE base_dados_completa 
        SET consultado_nova_vida = true 
        WHERE tipo_origem IN ('consulta_unica', 'consulta_massa')
        AND (consultado_nova_vida IS NULL OR consultado_nova_vida = false)
      `);
      console.log(`✅ ${updateResult.rowCount} registros atualizados!`);
      
    } else {
      // Adicionar campo
      await client.query(`
        ALTER TABLE base_dados_completa
        ADD COLUMN consultado_nova_vida BOOLEAN DEFAULT false
      `);
      console.log('✅ Campo "consultado_nova_vida" adicionado com sucesso!');
      
      // Marcar registros que já vieram de consulta
      console.log('🔄 Marcando registros que vieram de consulta...');
      const updateResult = await client.query(`
        UPDATE base_dados_completa 
        SET consultado_nova_vida = true 
        WHERE tipo_origem IN ('consulta_unica', 'consulta_massa')
      `);
      console.log(`✅ ${updateResult.rowCount} registros marcados como consultados!`);
    }
    
    console.log('\n════════════════════════════════════════');
    console.log('  ✅ MIGRAÇÃO APLICADA COM SUCESSO!');
    console.log('════════════════════════════════════════');
    console.log('\n💡 Agora todos os cadastros que forem consultados');
    console.log('   na Nova Vida receberão a tag "🌐 NOVA VIDA"!');
    
  } catch (error) {
    console.error('❌ Erro ao adicionar campo:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

adicionarCampoConsultadoNovaVida().catch(console.error);






