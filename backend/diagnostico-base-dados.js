/**
 * Script de diagnóstico para verificar por que consultas
 * não estão sendo salvas na base_dados_completa
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

async function diagnosticar() {
  console.log('\n🔍 ===== DIAGNÓSTICO BASE DE DADOS =====\n');
  
  try {
    // 1. Verificar se tabela existe
    console.log('📋 1. Verificando se tabela base_dados_completa existe...');
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'base_dados_completa'
      );
    `);
    
    if (tableCheck.rows[0].exists) {
      console.log('   ✅ Tabela existe!\n');
    } else {
      console.log('   ❌ Tabela NÃO existe!\n');
      return;
    }
    
    // 2. Verificar total de registros
    console.log('📊 2. Contando registros na tabela...');
    const countResult = await pool.query('SELECT COUNT(*) as total FROM base_dados_completa');
    console.log(`   Total geral: ${countResult.rows[0].total} registros\n`);
    
    // 3. Verificar por tenant
    console.log('👥 3. Verificando registros por tenant...');
    const tenantResult = await pool.query(`
      SELECT 
        t.id,
        t.nome as tenant_nome,
        COUNT(bdc.id) as registros
      FROM tenants t
      LEFT JOIN base_dados_completa bdc ON bdc.tenant_id = t.id
      GROUP BY t.id, t.nome
      ORDER BY t.id
    `);
    
    tenantResult.rows.forEach(row => {
      console.log(`   Tenant #${row.id} (${row.tenant_nome}): ${row.registros} registros`);
    });
    console.log('');
    
    // 4. Verificar últimos 10 registros
    console.log('📝 4. Últimos 10 registros salvos:');
    const recentResult = await pool.query(`
      SELECT 
        id,
        tenant_id,
        tipo_origem,
        tipo_documento,
        documento,
        nome,
        data_adicao
      FROM base_dados_completa
      ORDER BY data_adicao DESC
      LIMIT 10
    `);
    
    if (recentResult.rows.length === 0) {
      console.log('   ⚠️ Nenhum registro encontrado!\n');
    } else {
      recentResult.rows.forEach(row => {
        console.log(`   [${row.data_adicao.toISOString().split('T')[0]}] ${row.tipo_documento} ${row.documento} - ${row.nome || '(sem nome)'} - Tenant ${row.tenant_id} - Origem: ${row.tipo_origem}`);
      });
      console.log('');
    }
    
    // 5. Verificar funcionalidade base_dados habilitada
    console.log('🔧 5. Verificando funcionalidade "base_dados" habilitada...');
    const funcResult = await pool.query(`
      SELECT 
        id,
        nome,
        funcionalidades_customizadas,
        funcionalidades_config->>'base_dados' as base_dados_habilitado
      FROM tenants
    `);
    
    funcResult.rows.forEach(row => {
      const status = row.base_dados_habilitado === 'true' ? '✅' : '❌';
      console.log(`   ${status} Tenant #${row.id} (${row.nome}): base_dados = ${row.base_dados_habilitado || 'null'}`);
    });
    console.log('');
    
    // 6. Verificar se há consultas no histórico
    console.log('📊 6. Verificando histórico de consultas Nova Vida...');
    const consultasResult = await pool.query(`
      SELECT COUNT(*) as total FROM novavida_consultas
    `);
    console.log(`   Total de consultas registradas: ${consultasResult.rows[0].total}\n`);
    
    // 7. Últimas consultas
    console.log('📝 7. Últimas 10 consultas Nova Vida:');
    const recentConsultas = await pool.query(`
      SELECT 
        id,
        tenant_id,
        tipo_documento,
        documento,
        created_at
      FROM novavida_consultas
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    if (recentConsultas.rows.length === 0) {
      console.log('   ⚠️ Nenhuma consulta encontrada!\n');
    } else {
      recentConsultas.rows.forEach(row => {
        console.log(`   [${row.created_at.toISOString().split('T')[0]}] ${row.tipo_documento} ${row.documento} - Tenant ${row.tenant_id}`);
      });
      console.log('');
    }
    
    // 8. Comparar consultas vs registros salvos
    console.log('🔍 8. Comparando consultas com registros salvos...');
    const compareResult = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM novavida_consultas) as consultas,
        (SELECT COUNT(*) FROM base_dados_completa WHERE tipo_origem IN ('consulta_unica', 'consulta_massa')) as salvos
    `);
    
    const consultas = parseInt(compareResult.rows[0].consultas);
    const salvos = parseInt(compareResult.rows[0].salvos);
    
    console.log(`   Consultas realizadas: ${consultas}`);
    console.log(`   Registros salvos: ${salvos}`);
    
    if (consultas > salvos) {
      console.log(`   ⚠️ ALERTA: ${consultas - salvos} consultas NÃO foram salvas na base de dados!\n`);
    } else {
      console.log(`   ✅ Todas as consultas foram salvas!\n`);
    }
    
    console.log('✅ ===== DIAGNÓSTICO CONCLUÍDO =====\n');
    
  } catch (error) {
    console.error('❌ Erro no diagnóstico:', error);
  } finally {
    await pool.end();
  }
}

diagnosticar();

