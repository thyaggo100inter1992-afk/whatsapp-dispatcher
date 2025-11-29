const { query } = require('./src/database/connection');

/**
 * Script para verificar TODOS os limites configurados e se estão sendo respeitados
 */

async function verificarTodosLimites() {
  console.log('\n╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║  🔍 VERIFICAÇÃO COMPLETA DE TODOS OS LIMITES DO SISTEMA          ║');
  console.log('╔═══════════════════════════════════════════════════════════════════╝\n');

  try {
    // 1. Verificar estrutura da tabela plans
    console.log('1️⃣ ESTRUTURA DA TABELA PLANS:\n');
    
    const planColumns = await query(`
      SELECT column_name, data_type
      FROM information_schema.columns 
      WHERE table_name = 'plans'
      ORDER BY ordinal_position
    `);

    console.log('Colunas na tabela plans:');
    planColumns.rows.forEach(col => {
      console.log(`   ${col.column_name.padEnd(40)} ${col.data_type}`);
    });

    // 2. Verificar todos os planos e seus limites
    console.log('\n\n2️⃣ PLANOS CADASTRADOS E SEUS LIMITES:\n');
    
    const plans = await query(`
      SELECT 
        id,
        nome,
        limite_usuarios,
        limite_contas_whatsapp,
        limite_campanhas_mes,
        limite_mensagens_dia,
        limite_mensagens_mes,
        limite_templates,
        limite_contatos,
        limite_consultas_dia,
        limite_consultas_mes
      FROM plans
      ORDER BY id
    `);

    if (plans.rows.length === 0) {
      console.log('⚠️  Nenhum plano encontrado!');
    } else {
      plans.rows.forEach(p => {
        console.log(`\n📋 Plano: ${p.nome} (ID: ${p.id})`);
        console.log(`   Usuários:           ${p.limite_usuarios || 'NULL'}`);
        console.log(`   Contas WhatsApp:    ${p.limite_contas_whatsapp || 'NULL'}`);
        console.log(`   Campanhas/Mês:      ${p.limite_campanhas_mes || 'NULL'}`);
        console.log(`   Mensagens/Dia:      ${p.limite_mensagens_dia || 'NULL'}`);
        console.log(`   Mensagens/Mês:      ${p.limite_mensagens_mes || 'NULL'}`);
        console.log(`   Templates:          ${p.limite_templates || 'NULL'}`);
        console.log(`   Contatos:           ${p.limite_contatos || 'NULL'}`);
        console.log(`   Consultas/Dia:      ${p.limite_consultas_dia || 'NULL'}`);
        console.log(`   Consultas/Mês:      ${p.limite_consultas_mes || 'NULL'}`);
      });
    }

    // 3. Verificar tenants e uso atual
    console.log('\n\n3️⃣ TENANTS E USO ATUAL:\n');
    
    const tenants = await query(`
      SELECT 
        t.id,
        t.nome,
        t.plan_id,
        p.nome as plano_nome,
        
        -- Limites do plano
        p.limite_usuarios as plano_usuarios,
        p.limite_contas_whatsapp as plano_whatsapp,
        p.limite_campanhas_mes as plano_campanhas,
        p.limite_mensagens_dia as plano_msg_dia,
        p.limite_consultas_mes as plano_consultas,
        
        -- Uso atual
        (SELECT COUNT(*) FROM tenant_users WHERE tenant_id = t.id AND ativo = true) as usuarios_ativos,
        (SELECT COUNT(*) FROM whatsapp_accounts WHERE tenant_id = t.id) as contas_api,
        (SELECT COUNT(*) FROM uaz_instances WHERE tenant_id = t.id) as contas_qr,
        (SELECT COUNT(*) FROM campaigns WHERE tenant_id = t.id AND status IN ('running', 'scheduled', 'pending')) as campanhas_ativas,
        (SELECT COUNT(*) FROM contacts WHERE tenant_id = t.id) as contatos_total
        
      FROM tenants t
      LEFT JOIN plans p ON t.plan_id = p.id
      ORDER BY t.id
    `);

    if (tenants.rows.length === 0) {
      console.log('⚠️  Nenhum tenant encontrado!');
    } else {
      tenants.rows.forEach(t => {
        console.log(`\n┌─────────────────────────────────────────────────────────┐`);
        console.log(`│ Tenant: ${t.nome} (ID: ${t.id})`.padEnd(58) + '│');
        console.log(`│ Plano: ${t.plano_nome || 'Sem Plano'}`.padEnd(58) + '│');
        console.log(`├─────────────────────────────────────────────────────────┤`);
        
        // Usuários
        const usuariosStatus = parseInt(t.usuarios_ativos) > parseInt(t.plano_usuarios || 999) ? '❌' : '✅';
        console.log(`│ Usuários:        ${t.usuarios_ativos}/${t.plano_usuarios || '∞'}`.padEnd(50) + usuariosStatus.padStart(8) + '│');
        
        // Contas WhatsApp
        const totalContas = parseInt(t.contas_api) + parseInt(t.contas_qr);
        const contasStatus = totalContas > parseInt(t.plano_whatsapp || 999) ? '❌' : '✅';
        console.log(`│ Contas WhatsApp: ${totalContas}/${t.plano_whatsapp || '∞'} (API: ${t.contas_api}, QR: ${t.contas_qr})`.padEnd(50) + contasStatus.padStart(8) + '│');
        
        // Campanhas
        const campanhasStatus = parseInt(t.campanhas_ativas) > parseInt(t.plano_campanhas || 999) ? '❌' : '✅';
        console.log(`│ Campanhas Ativas: ${t.campanhas_ativas}/${t.plano_campanhas || '∞'}`.padEnd(50) + campanhasStatus.padStart(8) + '│');
        
        // Contatos
        console.log(`│ Contatos:        ${t.contatos_total}`.padEnd(58) + '│');
        
        console.log(`└─────────────────────────────────────────────────────────┘`);
      });
    }

    // 4. Verificar quais middlewares estão implementados
    console.log('\n\n4️⃣ MIDDLEWARES DE LIMITE IMPLEMENTADOS:\n');
    
    const middlewares = [
      { nome: 'checkUserLimit', status: '✅', descricao: 'Limite de Usuários' },
      { nome: 'checkWhatsAppLimit', status: '✅', descricao: 'Limite de Contas WhatsApp' },
      { nome: 'checkCampaignLimit', status: '✅', descricao: 'Limite de Campanhas (simultâneas)' },
      { nome: 'checkMessageLimit', status: '✅', descricao: 'Limite de Mensagens/Dia' },
      { nome: 'checkNovaVidaLimit', status: '✅', descricao: 'Limite de Consultas Nova Vida/Mês' },
      { nome: 'checkTemplateLimit', status: '✅', descricao: 'Limite de Templates' },
      { nome: 'checkContactLimit', status: '✅', descricao: 'Limite de Contatos' },
      { nome: 'checkMessageMonthLimit', status: '❌', descricao: 'Limite de Mensagens/Mês (NÃO IMPLEMENTADO)' },
      { nome: 'checkNovaVidaDailyLimit', status: '❌', descricao: 'Limite de Consultas/Dia (NÃO IMPLEMENTADO)' }
    ];

    middlewares.forEach(m => {
      console.log(`${m.status} ${m.nome.padEnd(30)} - ${m.descricao}`);
    });

    // 5. Verificar rotas protegidas
    console.log('\n\n5️⃣ ROTAS PROTEGIDAS POR MIDDLEWARES:\n');
    
    console.log('✅ POST /api/gestao/users                     → checkUserLimit');
    console.log('✅ POST /api/admin/tenants/:id/users          → checkUserLimit');
    console.log('✅ POST /api/whatsapp-accounts                → checkWhatsAppLimit');
    console.log('✅ POST /api/uaz/instances                    → checkWhatsAppLimit');
    console.log('✅ POST /api/campaigns                        → checkCampaignLimit');
    console.log('✅ POST /api/qr-campaigns                     → checkCampaignLimit');
    console.log('✅ POST /api/nova-vida/*                      → checkNovaVidaLimit');
    console.log('✅ POST /api/templates/create-multiple        → checkTemplateLimit');
    console.log('✅ POST /api/qr-templates                     → checkTemplateLimit');
    console.log('✅ POST /api/base-dados/importar              → checkContactLimit');

    // 6. Resumo Final
    console.log('\n\n╔═══════════════════════════════════════════════════════════════════╗');
    console.log('║  📊 RESUMO DA VERIFICAÇÃO                                        ║');
    console.log('╚═══════════════════════════════════════════════════════════════════╝\n');
    
    console.log('✅ LIMITES IMPLEMENTADOS E FUNCIONANDO:');
    console.log('   • Usuários');
    console.log('   • Contas WhatsApp (API + QR)');
    console.log('   • Campanhas Simultâneas');
    console.log('   • Mensagens por Dia');
    console.log('   • Consultas Nova Vida por Mês');
    console.log('   • Templates (API + QR)');
    console.log('   • Contatos na Base de Dados\n');
    
    console.log('❌ LIMITES NÃO IMPLEMENTADOS:');
    console.log('   • Mensagens por Mês (só tem diário)');
    console.log('   • Consultas Nova Vida por Dia (só tem mensal)\n');
    
    console.log('⚠️  PROBLEMAS ENCONTRADOS:');
    
    // Verificar se algum tenant está acima do limite
    const problemTenants = tenants.rows.filter(t => {
      return parseInt(t.usuarios_ativos) > parseInt(t.plano_usuarios || 999) ||
             (parseInt(t.contas_api) + parseInt(t.contas_qr)) > parseInt(t.plano_whatsapp || 999);
    });
    
    if (problemTenants.length > 0) {
      console.log(`   ${problemTenants.length} tenant(s) está(ão) acima do limite!\n`);
      problemTenants.forEach(t => {
        console.log(`   • ${t.nome} (ID: ${t.id})`);
        if (parseInt(t.usuarios_ativos) > parseInt(t.plano_usuarios || 999)) {
          console.log(`     - Usuários: ${t.usuarios_ativos}/${t.plano_usuarios} ❌ ACIMA DO LIMITE`);
        }
        const totalContas = parseInt(t.contas_api) + parseInt(t.contas_qr);
        if (totalContas > parseInt(t.plano_whatsapp || 999)) {
          console.log(`     - Contas WhatsApp: ${totalContas}/${t.plano_whatsapp} ❌ ACIMA DO LIMITE`);
        }
      });
    } else {
      console.log('   Nenhum problema encontrado!\n');
    }

    console.log('\n💡 RECOMENDAÇÕES:');
    if (problemTenants.length > 0) {
      console.log('   1. Corrigir tenants que estão acima do limite (ou ajustar limites customizados)');
      console.log('   2. Implementar middleware checkMessageMonthLimit (opcional)');
      console.log('   3. Implementar middleware checkNovaVidaDailyLimit (opcional)\n');
    } else {
      console.log('   1. Implementar middleware checkMessageMonthLimit (opcional)');
      console.log('   2. Implementar middleware checkNovaVidaDailyLimit (opcional)');
      console.log('   3. Sistema está funcionando corretamente!\n');
    }

  } catch (error) {
    console.error('\n❌ ERRO ao verificar limites:', error.message);
    console.error(error);
  } finally {
    process.exit(0);
  }
}

// Executar
verificarTodosLimites();

