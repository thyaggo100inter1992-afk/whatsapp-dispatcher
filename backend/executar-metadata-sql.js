const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'whatsapp_dispatcher',
  user: 'postgres',
  password: 'Tg130992*',
});

async function executarSQL() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Conectando ao banco de dados...');
    
    // Ler o arquivo SQL
    const sqlPath = path.join(__dirname, 'adicionar-metadata-audit-logs.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📄 Executando script SQL...');
    await client.query(sql);
    
    console.log('✅ Coluna metadata adicionada com sucesso à tabela audit_logs!');
    console.log('✅ Índice criado para buscas rápidas em metadata!');
  } catch (error) {
    console.error('❌ Erro ao executar SQL:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

executarSQL();



