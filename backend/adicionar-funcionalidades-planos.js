const { query } = require('./src/database/connection');

async function adicionarFuncionalidadesPlanos() {
  try {
    console.log('🔧 ADICIONANDO FUNCIONALIDADES AOS PLANOS\n');
    console.log('='.repeat(60));

    // Buscar todos os planos
    const planos = await query(`
      SELECT id, nome, slug
      FROM plans
      ORDER BY id
    `);

    if (planos.rows.length === 0) {
      console.log('❌ Nenhum plano encontrado!');
      process.exit(0);
    }

    console.log(`✅ ${planos.rows.length} plano(s) encontrado(s)\n`);

    // Definir funcionalidades padrão baseado no slug do plano
    const funcionalidadesPorPlano = {
      'teste': {
        whatsapp_api: true,
        whatsapp_qr: true,
        consulta_dados: false,
        verificar_numeros: false,
        gerenciar_proxies: false,
        campanhas: true,
        templates: true,
        lista_restricao: false,
        webhooks: false,
        relatorios: false,
        nova_vida: false,
        envio_imediato: true,
        catalogo: false,
        dashboard: true
      },
      'basico': {
        whatsapp_api: true,
        whatsapp_qr: true,
        consulta_dados: true,
        verificar_numeros: true,
        gerenciar_proxies: true,
        campanhas: true,
        templates: true,
        lista_restricao: true,
        webhooks: false,
        relatorios: false,
        nova_vida: true,
        envio_imediato: true,
        catalogo: true,
        dashboard: true
      },
      'profissional': {
        whatsapp_api: true,
        whatsapp_qr: true,
        consulta_dados: true,
        verificar_numeros: true,
        gerenciar_proxies: true,
        campanhas: true,
        templates: true,
        lista_restricao: true,
        webhooks: true,
        relatorios: true,
        nova_vida: true,
        envio_imediato: true,
        catalogo: true,
        dashboard: true
      },
      'enterprise': {
        whatsapp_api: true,
        whatsapp_qr: true,
        consulta_dados: true,
        verificar_numeros: true,
        gerenciar_proxies: true,
        campanhas: true,
        templates: true,
        lista_restricao: true,
        webhooks: true,
        relatorios: true,
        nova_vida: true,
        envio_imediato: true,
        catalogo: true,
        dashboard: true
      }
    };

    // Padrão para planos não mapeados (libera tudo)
    const funcionalidadesPadrao = {
      whatsapp_api: true,
      whatsapp_qr: true,
      consulta_dados: true,
      verificar_numeros: true,
      gerenciar_proxies: true,
      campanhas: true,
      templates: true,
      lista_restricao: true,
      webhooks: true,
      relatorios: true,
      nova_vida: true,
      envio_imediato: true,
      catalogo: true,
      dashboard: true
    };

    // Atualizar cada plano
    for (const plano of planos.rows) {
      console.log(`\n📋 Atualizando plano: ${plano.nome} (${plano.slug})`);
      
      // Escolher funcionalidades baseado no slug
      const funcionalidades = funcionalidadesPorPlano[plano.slug] || funcionalidadesPadrao;
      
      // Atualizar no banco
      await query(`
        UPDATE plans
        SET funcionalidades = $1::jsonb
        WHERE id = $2
      `, [JSON.stringify(funcionalidades), plano.id]);
      
      console.log('   ✅ Funcionalidades atualizadas:');
      Object.keys(funcionalidades).forEach(key => {
        const status = funcionalidades[key] ? '✅' : '❌';
        console.log(`      ${status} ${key}`);
      });
    }

    console.log('\n' + '='.repeat(60));
    console.log('🎉 FUNCIONALIDADES ADICIONADAS COM SUCESSO!\n');
    console.log('📝 Próximos passos:');
    console.log('   1. Reinicie o backend: npm run dev');
    console.log('   2. Acesse a página de funcionalidades do tenant');
    console.log('   3. Agora só aparecerão as funcionalidades do plano!\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  }
}

adicionarFuncionalidadesPlanos();

