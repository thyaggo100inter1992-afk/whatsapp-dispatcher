// Script temporário para criar a tabela lista_restricao
const { Pool } = require('pg');

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
    console.log('🔄 Conectando ao banco de dados...');
    
    await pool.query(sql);
    
    console.log('✅ Tabela lista_restricao criada com sucesso!');
    
    // Verificar
    const result = await pool.query('SELECT COUNT(*) as total FROM lista_restricao');
    console.log(`📊 Total de registros: ${result.rows[0].total}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao criar tabela:', error.message);
    process.exit(1);
  }
}

criarTabela();





