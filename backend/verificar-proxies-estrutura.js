const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'whatsapp_dispatcher',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'Tg130992*',
});

async function verificar() {
  try {
    console.log('\n📋 VERIFICANDO TABELA PROXIES...\n');

    // 1. Verificar se a tabela existe
    const tabelaResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'proxies'
      );
    `);
    
    if (!tabelaResult.rows[0].exists) {
      console.log('❌ Tabela "proxies" NÃO EXISTE!');
      process.exit(1);
    }
    
    console.log('✅ Tabela "proxies" existe');

    // 2. Listar colunas
    const colunasResult = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'proxies'
      ORDER BY ordinal_position;
    `);

    console.log('\n📊 COLUNAS DA TABELA:');
    colunasResult.rows.forEach(col => {
      const nullable = col.is_nullable === 'YES' ? '(nullable)' : '(not null)';
      console.log(`  - ${col.column_name}: ${col.data_type} ${nullable}`);
    });

    // 3. Verificar coluna tenant_id
    const temTenantId = colunasResult.rows.some(col => col.column_name === 'tenant_id');
    if (temTenantId) {
      console.log('\n✅ Coluna "tenant_id" EXISTE');
    } else {
      console.log('\n❌ Coluna "tenant_id" NÃO EXISTE!');
    }

    // 4. Verificar função set_current_tenant
    const funcaoResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.proname = 'set_current_tenant'
      );
    `);

    if (funcaoResult.rows[0].exists) {
      console.log('✅ Função "set_current_tenant" EXISTE');
    } else {
      console.log('❌ Função "set_current_tenant" NÃO EXISTE!');
    }

    // 5. Contar proxies por tenant
    if (temTenantId) {
      const countResult = await pool.query(`
        SELECT 
          tenant_id,
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE is_active = true) as ativos
        FROM proxies
        GROUP BY tenant_id
        ORDER BY tenant_id;
      `);

      console.log('\n📊 PROXIES POR TENANT:');
      if (countResult.rows.length === 0) {
        console.log('  (Nenhum proxy cadastrado)');
      } else {
        countResult.rows.forEach(row => {
          const tenantInfo = row.tenant_id ? `Tenant ${row.tenant_id}` : 'SEM TENANT';
          console.log(`  - ${tenantInfo}: ${row.total} proxies (${row.ativos} ativos)`);
        });
      }
    }

    console.log('\n✅ Verificação concluída!\n');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

verificar();



