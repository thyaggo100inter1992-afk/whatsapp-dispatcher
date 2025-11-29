/**
 * Script para aplicar configuração padrão de pacotes e faixas de consultas avulsas
 * Define os pacotes e faixas conforme especificação do sistema
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'whatsapp_dispatcher',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'Tg130992*',
});

async function aplicarConfiguracao() {
  console.log('\n🔧 ========================================');
  console.log('🔧 APLICAR CONFIGURAÇÃO PADRÃO');
  console.log('🔧 Pacotes e Faixas de Consultas Avulsas');
  console.log('🔧 ========================================\n');

  try {
    // Ler arquivo de migration
    const migrationPath = path.join(__dirname, 'migrations', 'update_consultas_defaults.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Executando migration: update_consultas_defaults.sql\n');

    // Executar migration
    await pool.query(migrationSQL);

    console.log('\n✅ ========================================');
    console.log('✅ CONFIGURAÇÃO APLICADA COM SUCESSO!');
    console.log('✅ ========================================\n');

    // Verificar pacotes criados
    const pacotesResult = await pool.query('SELECT * FROM consultas_avulsas_pacotes ORDER BY ordem');
    console.log('📦 PACOTES CONFIGURADOS:');
    console.log('─────────────────────────────────────────');
    pacotesResult.rows.forEach(p => {
      const precoUnit = parseFloat(p.preco_unitario);
      const destaque = p.popular ? '⭐ POPULAR' : '';
      console.log(`   ${p.ordem}. ${p.nome.padEnd(16)} | ${String(p.quantidade).padStart(3)} consultas | R$ ${parseFloat(p.preco).toFixed(2).padStart(6)} | R$ ${precoUnit.toFixed(2)}/un | ${p.desconto}% OFF ${destaque}`);
    });

    // Verificar faixas criadas
    const faixasResult = await pool.query('SELECT * FROM consultas_faixas_preco ORDER BY ordem');
    console.log('\n💰 FAIXAS DE PREÇO CONFIGURADAS:');
    console.log('─────────────────────────────────────────');
    faixasResult.rows.forEach(f => {
      const max = f.quantidade_max ? f.quantidade_max : '∞';
      console.log(`   ${f.ordem}. ${String(f.quantidade_min).padStart(4)}-${String(max).padEnd(4)} consultas | R$ ${parseFloat(f.preco_unitario).toFixed(2)}/consulta`);
    });

    console.log('\n⚠️  REGRA IMPORTANTE:');
    console.log('   Compra por quantidade personalizada (faixa)');
    console.log('   só é permitida ACIMA DE 100 CONSULTAS');
    console.log('   Para quantidades menores, use os pacotes pré-definidos!\n');

    console.log('🎯 Esta configuração é GLOBAL e vale para todos os tenants!\n');

  } catch (error) {
    console.error('\n❌ ERRO ao aplicar configuração:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Executar
aplicarConfiguracao();




