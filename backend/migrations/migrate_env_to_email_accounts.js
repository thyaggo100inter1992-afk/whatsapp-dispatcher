/**
 * Script para migrar configuração de email do .env para a tabela email_accounts
 * Execute este script apenas uma vez após aplicar a migration create_email_accounts_table.sql
 */

require('dotenv').config();
const { pool } = require('../src/database/connection');

async function migrateEmailConfig() {
  try {
    console.log('🔄 Iniciando migração de configuração de email...');

    // Verificar se já existe alguma conta
    const existing = await pool.query('SELECT COUNT(*) as count FROM email_accounts');
    if (parseInt(existing.rows[0].count) > 0) {
      console.log('✅ Já existem contas de email cadastradas. Migração não necessária.');
      return;
    }

    // Verificar se há configuração no .env
    const {
      SMTP_HOST,
      SMTP_PORT,
      SMTP_SECURE,
      SMTP_USER,
      SMTP_PASS,
      EMAIL_FROM
    } = process.env;

    if (!SMTP_HOST || !SMTP_USER || !EMAIL_FROM) {
      console.log('⚠️  Não há configuração de email no .env para migrar.');
      console.log('💡 Você pode criar contas de email diretamente no painel de admin.');
      return;
    }

    // Determinar o provedor baseado no host
    let provider = 'smtp';
    let name = 'Conta Migrada do .env';
    
    if (SMTP_HOST.includes('hostinger')) {
      provider = 'hostinger';
      name = 'Hostinger (Migrado)';
    } else if (SMTP_HOST.includes('gmail')) {
      provider = 'gmail';
      name = 'Gmail (Migrado)';
    }

    // Criar conta na tabela
    const result = await pool.query(
      `INSERT INTO email_accounts (
        name, provider, smtp_host, smtp_port, smtp_secure,
        smtp_user, smtp_pass, email_from, is_default, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, true)
      RETURNING *`,
      [
        name,
        provider,
        SMTP_HOST,
        parseInt(SMTP_PORT || '587'),
        SMTP_SECURE === 'true',
        SMTP_USER,
        SMTP_PASS,
        EMAIL_FROM
      ]
    );

    console.log('✅ Configuração de email migrada com sucesso!');
    console.log('📧 Conta criada:', {
      id: result.rows[0].id,
      name: result.rows[0].name,
      email_from: result.rows[0].email_from,
      is_default: result.rows[0].is_default
    });

    console.log('\n💡 Dica: Você pode agora gerenciar múltiplas contas de email no painel /admin/email-accounts');
    console.log('⚠️  As variáveis de email no .env ainda serão usadas como fallback se não houver contas cadastradas.');

  } catch (error) {
    console.error('❌ Erro na migração:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Executar migração
migrateEmailConfig()
  .then(() => {
    console.log('\n✅ Migração concluída!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migração falhou:', error);
    process.exit(1);
  });

