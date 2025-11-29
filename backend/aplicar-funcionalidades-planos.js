/**
 * Script para atualizar funcionalidades dos planos
 * Mantém apenas os 5 recursos permitidos
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Carregar variáveis de ambiente do arquivo .env
require('dotenv').config();

// Configuração do banco de dados
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'disparador_nettsistemas',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

console.log('🔌 Conectando ao banco de dados...');
console.log(`   Host: ${process.env.DB_HOST || 'localhost'}`);
console.log(`   Database: ${process.env.DB_NAME || 'disparador_nettsistemas'}`);
console.log(`   User: ${process.env.DB_USER || 'postgres'}`);
console.log('');

async function aplicarAtualizacao() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Iniciando atualização das funcionalidades dos planos...\n');

    // 1. Atualizar funcionalidades padrão nos planos
    console.log('📋 Atualizando funcionalidades dos planos...');
    const resultPlans = await client.query(`
      UPDATE plans 
      SET funcionalidades = '{
        "whatsapp_api": true,
        "whatsapp_qr": true,
        "nova_vida": true,
        "verificar_numeros": true,
        "gerenciar_proxies": true
      }'::jsonb
      WHERE funcionalidades IS NOT NULL
      RETURNING id, nome;
    `);
    
    console.log(`✅ ${resultPlans.rowCount} planos atualizados!`);
    resultPlans.rows.forEach(row => {
      console.log(`   - ${row.nome} (ID: ${row.id})`);
    });
    console.log('');

    // 2. Atualizar funcionalidades customizadas dos tenants
    console.log('📋 Atualizando funcionalidades customizadas dos tenants...');
    const resultTenants = await client.query(`
      UPDATE tenants 
      SET funcionalidades_config = (
        SELECT jsonb_build_object(
          'whatsapp_api', COALESCE((funcionalidades_config->>'whatsapp_api')::boolean, true),
          'whatsapp_qr', COALESCE((funcionalidades_config->>'whatsapp_qr')::boolean, true),
          'nova_vida', COALESCE((funcionalidades_config->>'nova_vida')::boolean, true),
          'verificar_numeros', COALESCE((funcionalidades_config->>'verificar_numeros')::boolean, true),
          'gerenciar_proxies', COALESCE((funcionalidades_config->>'gerenciar_proxies')::boolean, true)
        )
      )
      WHERE funcionalidades_customizadas = true 
        AND funcionalidades_config IS NOT NULL
      RETURNING id, nome;
    `);
    
    console.log(`✅ ${resultTenants.rowCount} tenants atualizados!`);
    if (resultTenants.rowCount > 0) {
      resultTenants.rows.forEach(row => {
        console.log(`   - ${row.nome} (ID: ${row.id})`);
      });
    }
    console.log('');

    // 3. Mostrar resultado final
    console.log('📊 Verificando resultado...\n');
    
    const plansResult = await client.query(`
      SELECT id, nome, slug, funcionalidades 
      FROM plans 
      ORDER BY ordem, id;
    `);

    console.log('✅ Funcionalidades dos planos:');
    plansResult.rows.forEach(plan => {
      console.log(`\n📌 ${plan.nome} (${plan.slug})`);
      const funcs = plan.funcionalidades;
      Object.keys(funcs).forEach(key => {
        const status = funcs[key] ? '✅' : '❌';
        console.log(`   ${status} ${key}: ${funcs[key]}`);
      });
    });

    console.log('\n');
    console.log('================================================================');
    console.log('✅ ATUALIZAÇÃO CONCLUÍDA COM SUCESSO!');
    console.log('================================================================');
    console.log('');
    console.log('📋 Apenas 5 recursos disponíveis:');
    console.log('   1. WhatsApp API Oficial (whatsapp_api)');
    console.log('   2. WhatsApp QR Connect (whatsapp_qr)');
    console.log('   3. Consulta de Dados (nova_vida)');
    console.log('   4. Verificar Números (verificar_numeros)');
    console.log('   5. Gerenciar Proxies (gerenciar_proxies)');
    console.log('');
    console.log('💡 IMPORTANTE: Reinicie o backend para aplicar as mudanças!');
    console.log('');

  } catch (error) {
    console.error('❌ Erro ao aplicar atualização:', error);
    console.error('\nDetalhes:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Executar
aplicarAtualizacao();

