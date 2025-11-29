const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'whatsapp_dispatcher',
  user: 'postgres',
  password: 'Tg130992*',
});

async function executarSQL() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Conectando ao banco de dados...');
    
    // Ler o arquivo SQL
    const sqlPath = path.join(__dirname, 'adicionar-limites-customizados-tenants.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📄 Executando script SQL...');
    const result = await client.query(sql);
    
    console.log('✅ Colunas de limites customizados adicionadas com sucesso!');
    console.log('✅ Agora cada tenant pode ter limites personalizados!');
    console.log('');
    console.log('📋 Colunas adicionadas:');
    console.log('  - limite_usuarios_customizado');
    console.log('  - limite_whatsapp_customizado');
    console.log('  - limite_campanhas_simultaneas_customizado');
    console.log('  - limite_mensagens_dia_customizado');
    console.log('  - limite_novavida_mes_customizado');
    console.log('  - limites_customizados (flag)');
  } catch (error) {
    console.error('❌ Erro ao executar SQL:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

executarSQL();



