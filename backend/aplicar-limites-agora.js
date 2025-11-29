const { query } = require('./src/database/connection');

async function aplicarLimites() {
  console.log('\n============================================');
  console.log('   APLICANDO LIMITES DE USUÁRIOS');
  console.log('============================================\n');

  try {
    // 1. Adicionar coluna limite_usuarios_customizado
    console.log('1️⃣ Adicionando coluna limite_usuarios_customizado...');
    try {
      await query('ALTER TABLE tenants ADD COLUMN limite_usuarios_customizado INTEGER');
      console.log('✅ Coluna limite_usuarios_customizado adicionada');
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log('ℹ️  Coluna limite_usuarios_customizado já existe');
      } else {
        throw err;
      }
    }

    // 2. Adicionar coluna limite_whatsapp_customizado
    console.log('\n2️⃣ Adicionando coluna limite_whatsapp_customizado...');
    try {
      await query('ALTER TABLE tenants ADD COLUMN limite_whatsapp_customizado INTEGER');
      console.log('✅ Coluna limite_whatsapp_customizado adicionada');
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log('ℹ️  Coluna limite_whatsapp_customizado já existe');
      } else {
        throw err;
      }
    }

    // 3. Adicionar coluna limite_campanhas_simultaneas_customizado
    console.log('\n3️⃣ Adicionando coluna limite_campanhas_simultaneas_customizado...');
    try {
      await query('ALTER TABLE tenants ADD COLUMN limite_campanhas_simultaneas_customizado INTEGER');
      console.log('✅ Coluna limite_campanhas_simultaneas_customizado adicionada');
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log('ℹ️  Coluna limite_campanhas_simultaneas_customizado já existe');
      } else {
        throw err;
      }
    }

    // 4. Adicionar coluna limite_mensagens_dia_customizado
    console.log('\n4️⃣ Adicionando coluna limite_mensagens_dia_customizado...');
    try {
      await query('ALTER TABLE tenants ADD COLUMN limite_mensagens_dia_customizado INTEGER');
      console.log('✅ Coluna limite_mensagens_dia_customizado adicionada');
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log('ℹ️  Coluna limite_mensagens_dia_customizado já existe');
      } else {
        throw err;
      }
    }

    // 5. Adicionar coluna limite_novavida_mes_customizado
    console.log('\n5️⃣ Adicionando coluna limite_novavida_mes_customizado...');
    try {
      await query('ALTER TABLE tenants ADD COLUMN limite_novavida_mes_customizado INTEGER');
      console.log('✅ Coluna limite_novavida_mes_customizado adicionada');
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log('ℹ️  Coluna limite_novavida_mes_customizado já existe');
      } else {
        throw err;
      }
    }

    // 6. Adicionar coluna limites_customizados (flag)
    console.log('\n6️⃣ Adicionando coluna limites_customizados (flag)...');
    try {
      await query('ALTER TABLE tenants ADD COLUMN limites_customizados BOOLEAN DEFAULT FALSE');
      console.log('✅ Coluna limites_customizados adicionada');
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log('ℹ️  Coluna limites_customizados já existe');
      } else {
        throw err;
      }
    }

    // 7. Criar índice
    console.log('\n7️⃣ Criando índice...');
    try {
      await query('CREATE INDEX IF NOT EXISTS idx_tenants_limites_customizados ON tenants(limites_customizados)');
      console.log('✅ Índice criado');
    } catch (err) {
      console.log('ℹ️  Índice já existe ou erro ao criar:', err.message);
    }

    // 8. Verificar estrutura
    console.log('\n8️⃣ Verificando estrutura...');
    const result = await query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'tenants' 
        AND column_name LIKE '%limite%'
      ORDER BY ordinal_position
    `);

    console.log('\n✅ Colunas de limites na tabela tenants:');
    result.rows.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type})`);
    });

    console.log('\n============================================');
    console.log('   ✅ LIMITES APLICADOS COM SUCESSO!');
    console.log('============================================\n');

    console.log('Próximos passos:');
    console.log('  1. Execute: node testar-limite-usuarios.js');
    console.log('  2. Ou execute: VERIFICAR-LIMITES-USUARIOS.bat\n');

  } catch (error) {
    console.error('\n❌ ERRO ao aplicar limites:', error.message);
    console.error(error);
  } finally {
    process.exit(0);
  }
}

// Executar
aplicarLimites();





