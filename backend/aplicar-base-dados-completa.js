const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function aplicarMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Criando tabela base_dados_completa...');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS base_dados_completa (
        id SERIAL PRIMARY KEY,
        
        -- Origem e Tipo
        tipo_origem VARCHAR(50) NOT NULL, -- 'consulta_unica', 'consulta_massa', 'manual', 'importacao'
        tipo_documento VARCHAR(10) NOT NULL, -- 'CPF' ou 'CNPJ'
        documento VARCHAR(20) NOT NULL,
        
        -- Dados Cadastrais Principais
        nome TEXT,
        nome_mae TEXT,
        sexo VARCHAR(1),
        data_nascimento DATE,
        renda DECIMAL(12,2),
        titulo VARCHAR(20),
        
        -- Dados Adicionais CPF
        score_credito INTEGER,
        score_digital INTEGER,
        flag_obito BOOLEAN,
        flag_fgts BOOLEAN,
        
        -- Dados CNPJ
        razao_social TEXT,
        nome_fantasia TEXT,
        cnae TEXT,
        situacao_cnpj VARCHAR(50),
        capital_social DECIMAL(15,2),
        data_abertura DATE,
        
        -- Contatos (JSON Arrays)
        telefones JSONB, -- [{ ddd, telefone, operadora, has_whatsapp, verified_by, procon }]
        emails JSONB, -- [{ email }]
        
        -- Endereços (JSON Arrays)
        enderecos JSONB, -- [{ logradouro, numero, complemento, bairro, cidade, uf, cep, area_risco }]
        
        -- Verificação WhatsApp
        whatsapp_verificado BOOLEAN DEFAULT FALSE,
        data_verificacao_whatsapp TIMESTAMP,
        
        -- Observações e Controle
        observacoes TEXT,
        tags TEXT[], -- Array de tags para categorização
        
        -- Timestamps
        data_adicao TIMESTAMP DEFAULT NOW(),
        data_atualizacao TIMESTAMP DEFAULT NOW(),
        
        -- Criado por
        usuario_id VARCHAR(100),
        
        -- Índices para busca rápida
        UNIQUE(documento)
      );
    `);
    
    console.log('✅ Tabela base_dados_completa criada!');
    
    // Criar índices
    console.log('📑 Criando índices...');
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_base_documento ON base_dados_completa(documento);
      CREATE INDEX IF NOT EXISTS idx_base_nome ON base_dados_completa(nome);
      CREATE INDEX IF NOT EXISTS idx_base_tipo_origem ON base_dados_completa(tipo_origem);
      CREATE INDEX IF NOT EXISTS idx_base_tipo_documento ON base_dados_completa(tipo_documento);
      CREATE INDEX IF NOT EXISTS idx_base_data_adicao ON base_dados_completa(data_adicao);
      CREATE INDEX IF NOT EXISTS idx_base_whatsapp ON base_dados_completa(whatsapp_verificado);
      CREATE INDEX IF NOT EXISTS idx_base_telefones ON base_dados_completa USING GIN(telefones);
      CREATE INDEX IF NOT EXISTS idx_base_emails ON base_dados_completa USING GIN(emails);
      CREATE INDEX IF NOT EXISTS idx_base_enderecos ON base_dados_completa USING GIN(enderecos);
      CREATE INDEX IF NOT EXISTS idx_base_tags ON base_dados_completa USING GIN(tags);
    `);
    
    console.log('✅ Índices criados!');
    
    // Verificar se há dados em historico_novavida para migrar
    console.log('🔄 Verificando dados para migrar...');
    
    try {
      const migrationResult = await client.query(`
        INSERT INTO base_dados_completa (
          tipo_origem,
          tipo_documento,
          documento,
          nome,
          telefones,
          emails,
          enderecos,
          observacoes,
          data_adicao
        )
        SELECT 
          'consulta_unica'::VARCHAR(50) as tipo_origem,
          tipo_documento,
          documento,
          (resultado->>'NOME') as nome,
          '[]'::JSONB as telefones,
          '[]'::JSONB as emails,
          '[]'::JSONB as enderecos,
          'Migrado automaticamente do histórico'::TEXT as observacoes,
          created_at as data_adicao
        FROM historico_novavida
        WHERE NOT EXISTS (
          SELECT 1 FROM base_dados_completa WHERE base_dados_completa.documento = historico_novavida.documento
        )
        ON CONFLICT (documento) DO NOTHING
        RETURNING id;
      `);
      
      console.log(`✅ ${migrationResult.rowCount} registros migrados do histórico!`);
    } catch (migrationError) {
      console.log('ℹ️ Nenhum dado para migrar (tabela histórico não existe ainda)');
    }
    
    console.log('');
    console.log('════════════════════════════════════════');
    console.log('  ✅ BASE DE DADOS COMPLETA CRIADA!');
    console.log('════════════════════════════════════════');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

aplicarMigration().catch(console.error);

