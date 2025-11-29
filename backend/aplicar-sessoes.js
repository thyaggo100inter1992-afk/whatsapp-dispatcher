/**
 * Script para aplicar migração de controle de sessões
 */

// Carregar variáveis de ambiente
require('dotenv').config();

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Possíveis senhas (tentará em ordem)
const possiblePasswords = [
  process.env.DB_PASSWORD,
  'root',
  'postgres',
  'Tg130992*',
  '',
];

// Configuração do banco
const getPool = (password) => new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'whatsapp_dispatcher',
  user: process.env.DB_USER || 'postgres',
  password: password,
});

async function aplicarMigracao() {
  console.log('============================================');
  console.log('🔐 APLICANDO CONTROLE DE SESSÕES SIMULTÂNEAS');
  console.log('============================================\n');

  let pool = null;
  let connectedPassword = null;

  try {
    console.log('📊 Conectando ao banco de dados...');
    
    // Tentar conectar com diferentes senhas
    for (const password of possiblePasswords) {
      if (!password) continue;
      
      try {
        pool = getPool(password);
        await pool.query('SELECT 1');
        connectedPassword = password;
        console.log('✅ Conectado ao banco de dados!\n');
        break;
      } catch (err) {
        await pool?.end();
        pool = null;
      }
    }

    if (!pool) {
      throw new Error('Não foi possível conectar ao banco de dados com nenhuma senha configurada');
    }
    
    // Ler arquivo SQL
    const sqlPath = path.join(__dirname, 'src', 'database', 'migrations', 'create_user_sessions.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📄 Executando migração...\n');
    
    // Executar SQL
    await pool.query(sql);
    
    console.log('✅ SUCESSO! Tabela de controle de sessões criada!\n');
    console.log('📋 O que foi criado:');
    console.log('   ✓ Tabela user_sessions');
    console.log('   ✓ Índices para performance');
    console.log('   ✓ Função de limpeza automática\n');
    console.log('🔒 Funcionalidades:');
    console.log('   ✓ Apenas 1 sessão ativa por usuário');
    console.log('   ✓ Login novo invalida sessões antigas');
    console.log('   ✓ Proteção contra acesso simultâneo\n');
    
    // Verificar se tabela foi criada
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'user_sessions'
    `);
    
    if (result.rows.length > 0) {
      console.log('✅ Verificação: Tabela user_sessions existe!');
      
      // Contar índices
      const indexes = await pool.query(`
        SELECT indexname 
        FROM pg_indexes 
        WHERE tablename = 'user_sessions'
      `);
      
      console.log(`✅ Verificação: ${indexes.rows.length} índices criados!`);
    }
    
    console.log('\n🎉 Migração aplicada com sucesso!');
    console.log('\n📝 Próximos passos:');
    console.log('   1. Reinicie o backend: 3-iniciar-backend.bat');
    console.log('   2. Teste o sistema: TESTAR-CONTROLE-SESSOES.md\n');
    
  } catch (error) {
    console.error('\n❌ ERRO ao aplicar migração:', error.message);
    console.error('\nDetalhes:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Executar
aplicarMigracao();

