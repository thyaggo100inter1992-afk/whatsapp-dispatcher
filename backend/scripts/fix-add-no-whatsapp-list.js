const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  try {
    console.log('🚀 Adicionando lista "Sem WhatsApp"...');
    
    const result = await pool.query(
      `INSERT INTO restriction_list_types (id, name, description, retention_days, auto_add_enabled) 
       VALUES ($1, $2, $3, NULL, true) 
       ON CONFLICT (id) DO NOTHING 
       RETURNING *`,
      ['no_whatsapp', 'Sem WhatsApp', 'Números sem WhatsApp ou inválidos']
    );
    
    if (result.rowCount > 0) {
      console.log('✅ Lista "Sem WhatsApp" adicionada com sucesso!');
    } else {
      console.log('ℹ️ Lista "Sem WhatsApp" já existe no banco.');
    }
    
    // Verificar se foi adicionada
    const check = await pool.query(
      `SELECT * FROM restriction_list_types WHERE id = 'no_whatsapp'`
    );
    
    if (check.rows.length > 0) {
      console.log('✅ Verificação: Lista encontrada no banco!');
      console.log(JSON.stringify(check.rows[0], null, 2));
    } else {
      console.log('❌ Lista não encontrada após inserção!');
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();

