/**
 * CRIAR CAMPANHA DE TESTE PARA CLIQUES
 * 
 * Cria uma campanha rápida para testar se os cliques estão sendo registrados
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function criarCampanhaTeste() {
  console.log('🧪 ===== CRIANDO CAMPANHA DE TESTE =====\n');

  try {
    // 1. Buscar uma conta ativa
    const accountResult = await pool.query(
      `SELECT id, name, phone_number_id 
       FROM whatsapp_accounts 
       WHERE is_active = true 
       LIMIT 1`
    );

    if (accountResult.rows.length === 0) {
      console.error('❌ ERRO: Nenhuma conta WhatsApp ativa encontrada!');
      console.log('   Configure uma conta primeiro.');
      process.exit(1);
    }

    const account = accountResult.rows[0];
    console.log('✅ Conta encontrada:', account.name, `(${account.phone_number_id})`);

    // 2. Buscar templates com botões dessa conta
    const templatesResult = await pool.query(
      `SELECT id, template_name, category, language, status 
       FROM templates 
       WHERE whatsapp_account_id = $1 
       AND status = 'APPROVED'
       AND (
         components::text ILIKE '%button%' 
         OR components::text ILIKE '%interactive%'
       )
       LIMIT 5`,
      [account.id]
    );

    if (templatesResult.rows.length === 0) {
      console.error('❌ ERRO: Nenhum template com botões encontrado!');
      console.log('   Crie um template com botões primeiro.');
      process.exit(1);
    }

    console.log(`\n📋 Templates disponíveis com botões:`);
    templatesResult.rows.forEach((t, i) => {
      console.log(`   ${i + 1}. ${t.template_name} (${t.language})`);
    });

    const templateToUse = templatesResult.rows[0];
    console.log(`\n✅ Usando template: ${templateToUse.template_name}\n`);

    // 3. Criar campanha
    const campaignResult = await pool.query(
      `INSERT INTO campaigns (
        name, 
        status, 
        total_contacts,
        created_at
      ) VALUES ($1, $2, $3, NOW())
      RETURNING id, name`,
      [
        'TESTE CLIQUE - ' + new Date().toLocaleTimeString('pt-BR'),
        'pending',
        1 // 1 contato
      ]
    );

    const campaign = campaignResult.rows[0];
    console.log('✅ Campanha criada:', campaign.name, `(ID: ${campaign.id})`);

    // 4. Associar template à campanha
    await pool.query(
      `INSERT INTO campaign_templates (
        campaign_id, 
        whatsapp_account_id,
        template_id
      ) VALUES ($1, $2, $3)`,
      [campaign.id, account.id, templateToUse.id]
    );

    console.log('✅ Template associado:', templateToUse.template_name);

    // 5. Criar contato de teste
    const variables = {
      var1: 'João',
      var2: 'R$ 100,00',
      var3: 'Hoje',
      var4: 'Produto Teste',
      var5: '10 unidades'
    };

    const contactResult = await pool.query(
      `INSERT INTO contacts (
        name,
        phone_number,
        variables,
        created_at
      ) VALUES ($1, $2, $3, NOW())
      RETURNING id, name, phone_number`,
      ['Teste Clique', '556291785664', JSON.stringify(variables)]
    );

    const contact = contactResult.rows[0];
    console.log('✅ Contato criado:', contact.name, `(${contact.phone_number})`);
    console.log('   Variáveis:', JSON.stringify(variables, null, 2));

    // 6. Associar contato à campanha
    await pool.query(
      `INSERT INTO campaign_contacts (
        campaign_id,
        contact_id
      ) VALUES ($1, $2)`,
      [campaign.id, contact.id]
    );

    console.log('✅ Contato associado à campanha');

    console.log('\n🎯 ===== CAMPANHA CRIADA COM SUCESSO! =====\n');
    console.log('📋 Detalhes:');
    console.log(`   • ID: ${campaign.id}`);
    console.log(`   • Nome: ${campaign.name}`);
    console.log(`   • Para: 556291785664`);
    console.log(`   • Template: ${templateToUse.template_name}`);
    console.log(`   • Status: PENDING (vai iniciar automaticamente)\n`);

    console.log('⏳ AGUARDE:');
    console.log('   1. O worker vai processar em até 10 segundos');
    console.log('   2. Você vai receber a mensagem no WhatsApp');
    console.log('   3. CLIQUE no botão da mensagem');
    console.log('   4. Aguarde 2-3 segundos');
    console.log('   5. Recarregue a página da campanha');
    console.log('   6. Veja o contador de cliques! 👆\n');

    console.log('🔗 Abra no navegador:');
    console.log(`   http://localhost:3000/campanha/${campaign.id}\n`);

  } catch (error) {
    console.error('\n❌ ERRO:', error.message);
    if (error.constraint) {
      console.error('   Constraint:', error.constraint);
    }
  } finally {
    await pool.end();
  }
}

criarCampanhaTeste();

