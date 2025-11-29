const { query } = require('./src/database/connection');

/**
 * Script para testar o sistema de limite de usuários
 */

async function testarLimiteUsuarios() {
  console.log('\n============================================');
  console.log('   🧪 TESTE DE LIMITE DE USUÁRIOS');
  console.log('============================================\n');

  try {
    // 1. Verificar se as colunas existem
    console.log('1️⃣ Verificando estrutura do banco de dados...\n');
    
    const colunas = await query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'tenants' 
        AND column_name IN ('limite_usuarios_customizado', 'limites_customizados')
      ORDER BY column_name;
    `);

    if (colunas.rows.length === 0) {
      console.log('❌ ERRO: Colunas não encontradas!');
      console.log('   Execute: APLICAR-LIMITES-USUARIOS.bat');
      process.exit(1);
    }

    console.log('✅ Colunas encontradas:');
    colunas.rows.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type})`);
    });

    // 2. Verificar planos
    console.log('\n2️⃣ Verificando planos disponíveis...\n');
    
    const planos = await query(`
      SELECT id, nome, limite_usuarios
      FROM plans
      ORDER BY id;
    `);

    if (planos.rows.length === 0) {
      console.log('⚠️  Nenhum plano encontrado. Execute: criar-tabela-planos.sql');
    } else {
      console.log('✅ Planos disponíveis:');
      planos.rows.forEach(p => {
        console.log(`   - ${p.nome}: ${p.limite_usuarios} usuários`);
      });
    }

    // 3. Verificar tenants e seus limites
    console.log('\n3️⃣ Verificando limites dos tenants...\n');
    
    const tenants = await query(`
      SELECT 
        t.id,
        t.nome,
        t.limites_customizados,
        t.limite_usuarios_customizado,
        p.nome as plano_nome,
        p.limite_usuarios as limite_plano,
        COALESCE(t.limite_usuarios_customizado, p.limite_usuarios, 1) as limite_efetivo,
        COUNT(tu.id) as usuarios_ativos,
        COALESCE(t.limite_usuarios_customizado, p.limite_usuarios, 1) - COUNT(tu.id) as vagas_disponiveis
      FROM tenants t
      LEFT JOIN plans p ON t.plan_id = p.id
      LEFT JOIN tenant_users tu ON tu.tenant_id = t.id AND tu.ativo = true
      GROUP BY 
        t.id, 
        t.nome, 
        t.limites_customizados, 
        t.limite_usuarios_customizado, 
        p.nome,
        p.limite_usuarios
      ORDER BY t.id;
    `);

    if (tenants.rows.length === 0) {
      console.log('⚠️  Nenhum tenant encontrado.');
    } else {
      console.log('📊 Resumo dos Tenants:\n');
      console.log('┌──────┬──────────────────────┬─────────────┬────────────┬───────────────┬─────────┬───────────────┐');
      console.log('│  ID  │       Nome           │    Plano    │   Custom   │ Limite Efetivo│  Ativos │    Vagas     │');
      console.log('├──────┼──────────────────────┼─────────────┼────────────┼───────────────┼─────────┼───────────────┤');
      
      tenants.rows.forEach(t => {
        const id = String(t.id).padEnd(4);
        const nome = String(t.nome).substring(0, 20).padEnd(20);
        const plano = String(t.plano_nome || 'Sem Plano').substring(0, 11).padEnd(11);
        const custom = t.limites_customizados ? '   Sim    ' : '   Não    ';
        const limite = String(t.limite_efetivo).padEnd(13);
        const ativos = String(t.usuarios_ativos).padEnd(7);
        const vagas = String(t.vagas_disponiveis).padEnd(13);
        
        console.log(`│ ${id} │ ${nome} │ ${plano} │ ${custom} │ ${limite} │ ${ativos} │ ${vagas} │`);
      });
      
      console.log('└──────┴──────────────────────┴─────────────┴────────────┴───────────────┴─────────┴───────────────┘');
    }

    // 4. Teste de bloqueio simulado
    console.log('\n4️⃣ Simulando criação de usuário...\n');
    
    if (tenants.rows.length > 0) {
      const tenant = tenants.rows[0];
      const limite = parseInt(tenant.limite_efetivo);
      const atual = parseInt(tenant.usuarios_ativos);
      
      console.log(`Tenant: ${tenant.nome} (ID: ${tenant.id})`);
      console.log(`Limite: ${limite} usuários`);
      console.log(`Atual: ${atual} usuários ativos`);
      
      if (atual >= limite) {
        console.log('\n❌ BLOQUEADO! Limite atingido.');
        console.log('   O middleware bloquearia a criação de novos usuários.');
      } else {
        console.log('\n✅ OK! Ainda há vagas disponíveis.');
        console.log(`   Pode criar mais ${limite - atual} usuário(s).`);
      }
    }

    // 5. Sugestões
    console.log('\n============================================');
    console.log('   ✅ TESTE CONCLUÍDO');
    console.log('============================================\n');
    
    console.log('💡 Próximos passos:\n');
    console.log('1. Para verificar limites em tempo real:');
    console.log('   VERIFICAR-LIMITES-USUARIOS.bat\n');
    console.log('2. Para definir limite customizado:');
    console.log('   TESTAR-LIMITE-USUARIOS.bat\n');
    console.log('3. Para testar via API:');
    console.log('   POST /api/gestao/users (com tenant que atingiu limite)\n');

  } catch (error) {
    console.error('\n❌ ERRO ao executar teste:', error.message);
    console.error(error);
  } finally {
    process.exit(0);
  }
}

// Executar teste
testarLimiteUsuarios();





