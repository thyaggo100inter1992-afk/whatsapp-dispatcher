const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

async function aplicarMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Iniciando criação da tabela tutorial_videos...');
    
    const sql = fs.readFileSync(
      path.join(__dirname, 'criar-tabela-tutoriais.sql'),
      'utf-8'
    );
    
    await client.query(sql);
    
    console.log('✅ Tabela tutorial_videos criada com sucesso!');
    console.log('📁 Tabela pronta para receber vídeos tutoriais');
    
    // Criar diretório para uploads se não existir
    const uploadsDir = path.join(__dirname, 'uploads', 'tutorials');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
      console.log('📂 Diretório uploads/tutorials criado!');
    }
    
  } catch (error) {
    console.error('❌ Erro ao criar tabela:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

aplicarMigration();





