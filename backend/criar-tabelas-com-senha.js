/**
 * Script para criar tabelas de templates QR Connect
 * Execute: node criar-tabelas-com-senha.js
 */

const { Pool } = require('pg');

// Configuração do banco com senha correta
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'whatsapp_dispatcher',
  user: 'postgres',
  password: 'Tg130992*',
});

const SQL = `
-- Tabela principal de templates QR Connect
CREATE TABLE IF NOT EXISTS qr_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    type VARCHAR(50) NOT NULL,
    text_content TEXT,
    list_config JSONB,
    buttons_config JSONB,
    carousel_config JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_qr_templates_type ON qr_templates(type);
CREATE INDEX IF NOT EXISTS idx_qr_templates_name ON qr_templates(name);

-- Tabela de mídias
CREATE TABLE IF NOT EXISTS qr_template_media (
    id SERIAL PRIMARY KEY,
    template_id INTEGER NOT NULL REFERENCES qr_templates(id) ON DELETE CASCADE,
    media_type VARCHAR(50) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT,
    mime_type VARCHAR(100),
    caption TEXT,
    duration INTEGER,
    carousel_card_index INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_qr_template_media_template_id ON qr_template_media(template_id);
CREATE INDEX IF NOT EXISTS idx_qr_template_media_type ON qr_template_media(media_type);

-- Comentários
COMMENT ON TABLE qr_templates IS 'Templates reutilizáveis do WhatsApp QR Connect';
COMMENT ON TABLE qr_template_media IS 'Mídias anexadas aos templates';
`;

async function criarTabelas() {
  let client;
  
  try {
    console.log('🔄 Conectando ao banco de dados...');
    client = await pool.connect();
    
    console.log('✅ Conectado!');
    console.log('');
    console.log('🔄 Criando tabelas...');
    
    await client.query(SQL);
    
    console.log('✅ Tabelas criadas com sucesso!');
    console.log('');
    
    // Verificar se foram criadas
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name LIKE 'qr_%' 
      ORDER BY table_name
    `);
    
    console.log('📋 Tabelas criadas:');
    result.rows.forEach(row => {
      console.log(`   ✓ ${row.table_name}`);
    });
    
    console.log('');
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║                                                  ║');
    console.log('║  ✅ MIGRATION APLICADA COM SUCESSO!              ║');
    console.log('║                                                  ║');
    console.log('║  Próximo passo:                                  ║');
    console.log('║  → Reinicie o backend (Ctrl+C e iniciar)         ║');
    console.log('║  → Aguarde 10 segundos                           ║');
    console.log('║  → Atualize a página (F5)                        ║');
    console.log('║                                                  ║');
    console.log('╚══════════════════════════════════════════════════╝');
    console.log('');
    
  } catch (error) {
    console.error('');
    console.error('╔══════════════════════════════════════════════════╗');
    console.error('║  ❌ ERRO AO CRIAR TABELAS                        ║');
    console.error('╚══════════════════════════════════════════════════╝');
    console.error('');
    console.error('Detalhes do erro:');
    console.error(error.message);
    console.error('');
    
    if (error.code === 'ECONNREFUSED') {
      console.error('💡 Solução:');
      console.error('   - Verifique se o PostgreSQL está rodando');
      console.error('');
    }
    
    process.exit(1);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

// Executar
criarTabelas();










