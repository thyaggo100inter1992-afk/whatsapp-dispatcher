const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'nettsistemas',
  password: process.env.DB_PASSWORD || 'postgres',
  port: parseInt(process.env.DB_PORT || '5432'),
});

async function aplicarCorrecao() {
  const client = await pool.connect();
  
  try {
    console.log('========================================');
    console.log('CORRIGINDO ERRO 403 - FILA DE TEMPLATES');
    console.log('========================================\n');

    // Ler o arquivo SQL
    const sqlFile = path.join(__dirname, 'CORRIGIR-TEMPLATES-403.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    console.log('Aplicando correção no banco de dados...\n');

    // Executar o SQL
    await client.query(sql);

    console.log('========================================');
    console.log('CORREÇÃO APLICADA COM SUCESSO!');
    console.log('========================================\n');
    console.log('Agora você pode:');
    console.log('1. Fazer logout do sistema');
    console.log('2. Fazer login novamente');
    console.log('3. Tentar acessar a fila de templates\n');

  } catch (error) {
    console.error('❌ ERRO ao aplicar correção:', error.message);
    console.error('\nDetalhes:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

aplicarCorrecao();


