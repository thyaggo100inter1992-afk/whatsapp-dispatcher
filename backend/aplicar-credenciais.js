const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function aplicarMigration() {
  console.log('========================================');
  console.log('🔐 SISTEMA DE CREDENCIAIS MULTI-TENANT');
  console.log('========================================');
  console.log('');
  
  // Configuração do banco de dados
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'whatsapp_dispatcher',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'Tg130992*',
  });

  try {
    console.log('📡 Conectando ao banco de dados...');
    console.log(`   Host: ${pool.options.host}`);
    console.log(`   Porta: ${pool.options.port}`);
    console.log(`   Banco: ${pool.options.database}`);
    console.log(`   Usuário: ${pool.options.user}`);
    console.log('');
    
    // Testar conexão
    await pool.query('SELECT NOW()');
    console.log('✅ Conectado ao banco de dados!');
    console.log('');
    
    // Ler o arquivo SQL da migration
    const migrationPath = path.join(__dirname, 'src', 'database', 'migrations', '027_create_credentials_system.sql');
    console.log('📄 Lendo migration:', migrationPath);
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log('');
    
    console.log('🔄 Executando migration...');
    console.log('');
    
    // Executar a migration
    await pool.query(migrationSQL);
    
    console.log('');
    console.log('========================================');
    console.log('✅ SISTEMA DE CREDENCIAIS INSTALADO!');
    console.log('========================================');
    console.log('');
    console.log('📋 O que foi criado:');
    console.log('  ✅ Tabela: uazap_credentials');
    console.log('  ✅ Tabela: novavida_credentials');
    console.log('  ✅ Campos adicionados em tenants');
    console.log('  ✅ Credenciais padrão inseridas');
    console.log('  ✅ Triggers de validação criados');
    console.log('');
    console.log('🎯 Próximos passos:');
    console.log('  1. Reinicie o backend: cd backend && npm run dev');
    console.log('  2. Reinicie o frontend: cd frontend && npm run dev');
    console.log('  3. Acesse: http://localhost:3000/admin/credentials');
    console.log('  4. Gerencie suas credenciais!');
    console.log('');
    console.log('========================================');
    console.log('');
    
  } catch (error) {
    console.error('');
    console.error('❌ ERRO ao aplicar migration!');
    console.error('');
    console.error('Detalhes do erro:');
    console.error(error.message);
    console.error('');
    
    if (error.code === 'ECONNREFUSED') {
      console.error('🔍 Possíveis causas:');
      console.error('  - PostgreSQL não está rodando');
      console.error('  - Porta incorreta');
      console.error('  - Host incorreto');
    } else if (error.code === '42P07') {
      console.error('🔍 Tabelas já existem!');
      console.error('  O sistema de credenciais já foi instalado anteriormente.');
    } else if (error.code === '42701') {
      console.error('🔍 Colunas já existem!');
      console.error('  Os campos já foram adicionados na tabela tenants.');
    } else {
      console.error('🔍 Verifique:');
      console.error('  - As credenciais do banco de dados');
      console.error('  - Se o banco de dados existe');
      console.error('  - Se há permissões suficientes');
    }
    console.error('');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Executar
aplicarMigration();

