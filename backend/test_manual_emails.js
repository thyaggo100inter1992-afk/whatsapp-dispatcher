const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'whatsapp_user',
  password: 'Tg130992*',
  database: 'whatsapp_dispatcher'
});

async function testManualEmails() {
  console.log('🧪 Testando envio de emails manuais...\n');

  // 1. Criar campanha de teste com emails manuais
  const testEmails = ['teste1@exemplo.com', 'teste2@exemplo.com', 'teste3@exemplo.com'];
  
  const campaign = await pool.query(
    `INSERT INTO admin_email_campaigns (
      name, subject, content, recipient_type, recipient_list,
      email_accounts, delay_seconds, status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft')
    RETURNING *`,
    [
      'Teste Manual Emails',
      'Assunto de Teste',
      '<h1>Email de Teste</h1>',
      'manual',
      JSON.stringify({ tenant_ids: [], emails: testEmails }),
      JSON.stringify([1, 2]), // IDs das contas de email
      5
    ]
  );

  console.log('✅ Campanha criada:', campaign.rows[0].id);
  console.log('📧 Emails configurados:', testEmails);
  console.log('\n📋 Dados da campanha:');
  console.log(JSON.stringify(campaign.rows[0], null, 2));

  // 2. Simular o que o worker faz
  console.log('\n🔍 Simulando lógica do worker...\n');
  
  const campaignData = campaign.rows[0];
  
  if (campaignData.recipient_type === 'manual') {
    if (campaignData.recipient_list && campaignData.recipient_list.emails && Array.isArray(campaignData.recipient_list.emails)) {
      console.log('✅ recipient_list.emails encontrado:');
      console.log(campaignData.recipient_list.emails);
      console.log(`\n✅ Total de ${campaignData.recipient_list.emails.length} emails encontrados!`);
    } else {
      console.log('❌ recipient_list.emails NÃO encontrado ou inválido!');
      console.log('recipient_list:', campaignData.recipient_list);
    }
  }

  // 3. Limpar teste
  await pool.query('DELETE FROM admin_email_campaigns WHERE id = $1', [campaign.rows[0].id]);
  console.log('\n🗑️ Campanha de teste removida');

  process.exit(0);
}

testManualEmails().catch(err => {
  console.error('❌ Erro:', err);
  process.exit(1);
});

