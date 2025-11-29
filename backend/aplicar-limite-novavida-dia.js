const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'Tg130992*',
  database: process.env.DB_NAME || 'whatsapp_dispatcher'
});

async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  console.log('⚡ Query executada:', { duration: `${duration}ms`, rows: res.rowCount });
  return res;
}

async function aplicarMigration() {
  console.log('\n============================================');
  console.log('🔧 APLICANDO MIGRATION: Limite Nova Vida Diário');
  console.log('============================================\n');

  try {
    // 1. Adicionar coluna limite_nova_vida_dia_customizado
    console.log('1️⃣ Adicionando coluna limite_nova_vida_dia_customizado...');
    try {
      await query('ALTER TABLE tenants ADD COLUMN limite_nova_vida_dia_customizado INTEGER');
      console.log('✅ Coluna limite_nova_vida_dia_customizado adicionada com sucesso!');
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log('ℹ️  Coluna limite_nova_vida_dia_customizado já existe');
      } else {
        throw err;
      }
    }

    // 2. Verificar estrutura
    console.log('\n2️⃣ Verificando estrutura...');
    const result = await query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'tenants' 
        AND column_name LIKE '%nova_vida%'
      ORDER BY column_name
    `);

    console.log('\n📊 Colunas Nova Vida na tabela tenants:');
    result.rows.forEach(row => {
      console.log(`   - ${row.column_name} (${row.data_type}) ${row.is_nullable === 'YES' ? '[NULL]' : '[NOT NULL]'}`);
    });

    // 3. Verificar tenants com limites customizados
    console.log('\n3️⃣ Verificando tenants com limites customizados...');
    const tenants = await query(`
      SELECT 
        t.id,
        t.nome,
        t.plan_id,
        p.nome as plano_nome,
        p.limite_consultas_dia as plano_limite_dia,
        p.limite_consultas_mes as plano_limite_mes,
        t.limite_nova_vida_dia_customizado,
        t.limite_novavida_mes_customizado,
        (
          SELECT COUNT(*) FROM nova_vida_consultas
          WHERE tenant_id = t.id
          AND created_at::date = CURRENT_DATE
        ) as consultas_hoje,
        (
          SELECT COUNT(*) FROM nova_vida_consultas
          WHERE tenant_id = t.id
          AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)
        ) as consultas_mes
      FROM tenants t
      LEFT JOIN plans p ON t.plan_id = p.id
      WHERE t.ativo = true
      ORDER BY t.id
    `);

    console.log(`\n📋 ${tenants.rows.length} tenants ativos encontrados:\n`);
    tenants.rows.forEach(tenant => {
      console.log(`┌─ Tenant: ${tenant.nome} (ID: ${tenant.id})`);
      console.log(`├─ Plano: ${tenant.plano_nome || 'N/A'}`);
      console.log(`├─ Limite Diário: ${tenant.plano_limite_dia || 'Ilimitado'} (Customizado: ${tenant.limite_nova_vida_dia_customizado || 'Não'})`);
      console.log(`├─ Limite Mensal: ${tenant.plano_limite_mes || 'Ilimitado'} (Customizado: ${tenant.limite_novavida_mes_customizado || 'Não'})`);
      console.log(`├─ Consultas Hoje: ${tenant.consultas_hoje}`);
      console.log(`└─ Consultas Este Mês: ${tenant.consultas_mes}\n`);
    });

    console.log('============================================');
    console.log('✅ MIGRATION APLICADA COM SUCESSO!');
    console.log('============================================\n');

  } catch (error) {
    console.error('\n❌ Erro ao aplicar migration:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Executar
aplicarMigration()
  .then(() => {
    console.log('✅ Script finalizado com sucesso!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });

