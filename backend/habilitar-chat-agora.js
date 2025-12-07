const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'whatsapp_dispatcher',
  password: process.env.DB_PASSWORD || '',
  port: process.env.DB_PORT || 5432,
});

async function habilitarChat() {
  try {
    console.log('🔧 Habilitando Chat de Atendimento para tenant ID 1...');
    
    const result = await pool.query(`
      UPDATE tenants 
      SET 
        funcionalidades_customizadas = TRUE,
        funcionalidades_config = jsonb_set(
          COALESCE(funcionalidades_config, '{}'::jsonb),
          '{permite_chat_atendimento}',
          'true'::jsonb
        )
      WHERE id = 1
      RETURNING id, nome, funcionalidades_config->'permite_chat_atendimento' as chat_habilitado
    `);
    
    console.log('✅ Chat habilitado com sucesso!');
    console.log('Tenant:', result.rows[0]);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao habilitar chat:', error);
    process.exit(1);
  }
}

habilitarChat();

