import { query } from './src/database/connection';

async function analyzeCampaign92() {
  console.log('\n🔍 ANALISANDO CAMPANHA 92 E ERRO DE PARÂMETROS\n');
  
  // Buscar templates da campanha
  const templates = await query(`
    SELECT 
      t.template_name,
      t.components,
      w.name as account_name
    FROM campaign_templates ct
    JOIN templates t ON ct.template_id = t.id
    JOIN whatsapp_accounts w ON ct.whatsapp_account_id = w.id
    WHERE ct.campaign_id = 92
  `);
  
  console.log(`📋 TEMPLATES DA CAMPANHA: ${templates.rows.length}\n`);
  
  templates.rows.forEach((t: any, idx: number) => {
    console.log(`${idx + 1}. Template: ${t.template_name}`);
    console.log(`   Conta: ${t.account_name}`);
    
    // Analisar componentes
    const components = t.components;
    let bodyVars = 0;
    let headerVars = 0;
    
    components.forEach((comp: any) => {
      if (comp.type === 'BODY' && comp.text) {
        const matches = comp.text.match(/\{\{\d+\}\}/g) || [];
        bodyVars = matches.length;
        console.log(`   Body: "${comp.text}"`);
        console.log(`   Variáveis no body: ${bodyVars} (${matches.join(', ')})`);
      }
      if (comp.type === 'HEADER' && comp.text) {
        const matches = comp.text.match(/\{\{\d+\}\}/g) || [];
        headerVars = matches.length;
        console.log(`   Header: "${comp.text}"`);
        console.log(`   Variáveis no header: ${headerVars} (${matches.join(', ')})`);
      }
    });
    
    console.log(`   ✅ TOTAL de variáveis esperadas: ${bodyVars + headerVars}\n`);
  });
  
  // Buscar contatos
  const contacts = await query(`
    SELECT c.id, c.phone_number, c.variables
    FROM campaign_contacts cc
    JOIN contacts c ON cc.contact_id = c.id
    WHERE cc.campaign_id = 92
    LIMIT 3
  `);
  
  console.log(`👥 CONTATOS DA CAMPANHA: ${contacts.rows.length} (amostra)\n`);
  
  contacts.rows.forEach((c: any, idx: number) => {
    console.log(`${idx + 1}. ${c.phone_number}`);
    console.log(`   Variáveis:`, c.variables);
    const varCount = c.variables ? Object.keys(c.variables).length : 0;
    console.log(`   Total: ${varCount}\n`);
  });
  
  process.exit(0);
}

analyzeCampaign92().catch(console.error);


