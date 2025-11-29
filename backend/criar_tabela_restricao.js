// Script para criar tabela lista_restricao
require('dotenv').config();
const { Pool } = require('pg');

// Criar pool de conexão
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'whatsapp_dispatcher',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'Tg130992*',
});

const sql = `
-- CRIAR TABELA
CREATE TABLE IF NOT EXISTS lista_restricao (
  id SERIAL PRIMARY KEY,
  cpf VARCHAR(14) NOT NULL UNIQUE,
  motivo TEXT,
  ativo BOOLEAN DEFAULT true,
  data_adicao TIMESTAMP DEFAULT NOW(),
  adicionado_por VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- INDICES
CREATE INDEX IF NOT EXISTS idx_lista_restricao_cpf ON lista_restricao(cpf);
CREATE INDEX IF NOT EXISTS idx_lista_restricao_ativo ON lista_restricao(ativo);
`;

async function criarTabela() {
  try {
    console.log('\n========================================');
    console.log('🔄 CRIANDO TABELA LISTA_RESTRICAO');
    console.log('========================================\n');
    
    console.log('📡 Conectando ao banco de dados...');
    
    await pool.query(sql);
    
    console.log('✅ Tabela lista_restricao criada com sucesso!');
    
    // Verificar
    const result = await pool.query('SELECT COUNT(*) as total FROM lista_restricao');
    console.log(`📊 Total de registros na tabela: ${result.rows[0].total}`);
    
    console.log('\n========================================');
    console.log('✅ CONCLUÍDO COM SUCESSO!');
    console.log('========================================');
    console.log('\nPróximos passos:');
    console.log('  1. Recarregue o navegador (F5)');
    console.log('  2. Tente adicionar um CPF');
    console.log('  3. Deve funcionar agora!\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n========================================');
    console.error('❌ ERRO AO CRIAR TABELA');
    console.error('========================================');
    console.error('Erro:', error.message);
    console.error('\nDetalhes:', error);
    process.exit(1);
  }
}

criarTabela();

