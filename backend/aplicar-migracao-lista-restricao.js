const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Carregar variáveis de ambiente
require('dotenv').config();

// Configuração do banco de dados (mesma do projeto)
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'whatsapp_dispatcher',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function aplicarMigracao() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║  🚫 CRIAR TABELA: Lista de Restrição                          ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('\n');

  try {
    // Ler o arquivo SQL
    const sqlPath = path.join(__dirname, 'criar-tabela-lista-restricao.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('📄 Lendo arquivo SQL...');
    console.log('🔌 Conectando ao banco de dados...');

    // Executar a migração
    await pool.query(sql);

    console.log('\n');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log(' ✅ MIGRAÇÃO APLICADA COM SUCESSO!');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('\n');
    console.log('✅ Tabela "lista_restricao" criada com sucesso!');
    console.log('\n');
    console.log('Agora você pode:');
    console.log('1. Iniciar o backend: 3-iniciar-backend.bat');
    console.log('2. Iniciar o frontend: 4-iniciar-frontend.bat');
    console.log('\n');

    process.exit(0);
  } catch (error) {
    console.log('\n');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log(' ❌ ERRO AO APLICAR MIGRAÇÃO');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('\n');
    console.error('Erro:', error.message);
    console.log('\n');
    console.log('Verifique:');
    console.log('- PostgreSQL está instalado e rodando');
    console.log('- Usuário e senha estão corretos no .env');
    console.log('- Banco "consulta_nova_vida" existe');
    console.log('\n');

    process.exit(1);
  }
}

aplicarMigracao();

