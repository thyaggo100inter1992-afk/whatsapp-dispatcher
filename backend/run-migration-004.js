const { Client } = require('pg');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

(async () => {
  const client = new Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432'),
  });

  try {
    await client.connect();
    console.log('✅ Conectado ao banco de dados');
    console.log('🔄 Executando migração 004...');

    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'src/database/migrations/004_add_account_management_to_campaign_templates.sql'),
      'utf8'
    );

    await client.query(migrationSQL);

    console.log('✅ Migração 004 concluída com sucesso!');
    console.log('');
    console.log('📋 Alterações aplicadas:');
    console.log('   ✅ Coluna "is_active" adicionada em campaign_templates');
    console.log('   ✅ Coluna "consecutive_failures" adicionada em campaign_templates');
    console.log('   ✅ Coluna "last_error" adicionada em campaign_templates');
    console.log('   ✅ Coluna "removed_at" adicionada em campaign_templates');
    console.log('   ✅ Coluna "auto_remove_account_failures" adicionada em campaigns');
    console.log('   ✅ Índice criado para melhor performance');
    console.log('');
  } catch (error) {
    console.error('❌ Erro ao executar migração:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
})();

