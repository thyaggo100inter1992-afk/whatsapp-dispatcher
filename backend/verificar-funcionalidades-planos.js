const { query } = require('./src/database/connection');

async function verificarFuncionalidadesPlanos() {
  try {
    console.log('🔍 VERIFICANDO FUNCIONALIDADES DOS PLANOS\n');
    console.log('='.repeat(60));

    // Buscar todos os planos
    const planos = await query(`
      SELECT 
        id,
        nome,
        slug,
        funcionalidades
      FROM plans
      ORDER BY id
    `);

    if (planos.rows.length === 0) {
      console.log('❌ Nenhum plano encontrado!');
      process.exit(0);
    }

    console.log(`✅ ${planos.rows.length} plano(s) encontrado(s)\n`);

    for (const plano of planos.rows) {
      console.log('-'.repeat(60));
      console.log(`📋 Plano: ${plano.nome} (${plano.slug})`);
      console.log(`   ID: ${plano.id}`);
      
      if (!plano.funcionalidades) {
        console.log('   ❌ SEM FUNCIONALIDADES CONFIGURADAS!');
        console.log('   ⚠️  Este plano precisa ser atualizado!');
      } else {
        console.log('   ✅ Funcionalidades configuradas:');
        const funcs = plano.funcionalidades;
        
        // Listar funcionalidades
        Object.keys(funcs).forEach(key => {
          const status = funcs[key] ? '✅' : '❌';
          console.log(`      ${status} ${key}: ${funcs[key]}`);
        });
      }
      console.log('');
    }

    console.log('='.repeat(60));
    console.log('\n📊 RESUMO:');
    
    const planosComFuncionalidades = planos.rows.filter(p => p.funcionalidades).length;
    const planosSemFuncionalidades = planos.rows.length - planosComFuncionalidades;
    
    console.log(`   ✅ Planos COM funcionalidades: ${planosComFuncionalidades}`);
    console.log(`   ❌ Planos SEM funcionalidades: ${planosSemFuncionalidades}`);
    
    if (planosSemFuncionalidades > 0) {
      console.log('\n⚠️  AÇÃO NECESSÁRIA:');
      console.log('   Execute: node backend/adicionar-funcionalidades-planos.js');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  }
}

verificarFuncionalidadesPlanos();
