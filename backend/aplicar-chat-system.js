const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'whatsapp_dispatcher',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function applyMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Iniciando criação das tabelas do sistema de chat...\n');
    
    // Ler o arquivo SQL
    const fs = require('fs');
    const path = require('path');
    const sqlPath = path.join(__dirname, 'src', 'database', 'migrations', '050_create_chat_system.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');
    
    console.log('📄 Executando migration 050_create_chat_system.sql...');
    
    // Executar o SQL
    await client.query(sql);
    
    console.log('✅ Tabelas do sistema de chat criadas com sucesso!\n');
    
    // Verificar se as tabelas foram criadas
    console.log('🔍 Verificando tabelas criadas...\n');
    
    const checkConversations = await client.query(`
      SELECT COUNT(*) as count FROM information_schema.tables 
      WHERE table_name = 'conversations'
    `);
    
    const checkMessages = await client.query(`
      SELECT COUNT(*) as count FROM information_schema.tables 
      WHERE table_name = 'conversation_messages'
    `);
    
    if (checkConversations.rows[0].count > 0) {
      console.log('✅ Tabela conversations criada');
    }
    
    if (checkMessages.rows[0].count > 0) {
      console.log('✅ Tabela conversation_messages criada');
    }
    
    // Verificar índices
    const checkIndexes = await client.query(`
      SELECT indexname FROM pg_indexes 
      WHERE tablename IN ('conversations', 'conversation_messages')
      ORDER BY indexname
    `);
    
    console.log(`\n✅ ${checkIndexes.rows.length} índices criados para performance\n`);
    
    console.log('🎉 MIGRATION CONCLUÍDA COM SUCESSO!\n');
    console.log('📊 Sistema de chat pronto para uso!\n');
    
  } catch (error) {
    console.error('❌ Erro ao aplicar migration:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Executar
applyMigration();

