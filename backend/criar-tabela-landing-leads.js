const { query } = require('./src/database/connection');

async function criarTabelaLandingLeads() {
  try {
    console.log('📊 Criando tabela landing_leads...');

    await query(`
      CREATE TABLE IF NOT EXISTS landing_leads (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        telefone VARCHAR(50),
        empresa VARCHAR(255),
        mensagem TEXT,
        origem VARCHAR(50) DEFAULT 'landing_page',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    console.log('✅ Tabela landing_leads criada com sucesso!');

    // Verificar se tem dados
    const count = await query('SELECT COUNT(*) as total FROM landing_leads');
    console.log(`📊 Total de leads: ${count.rows[0].total}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao criar tabela:', error);
    process.exit(1);
  }
}

criarTabelaLandingLeads();
