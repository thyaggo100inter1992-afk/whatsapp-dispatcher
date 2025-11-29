/**
 * Script para aplicar migrations do sistema de pagamentos
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Configuração do banco (carrega do .env)
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'whatsapp_api',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432,
});

console.log('🔐 Conectando ao banco:', {
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'whatsapp_api',
  port: process.env.DB_PORT || 5432
});

async function aplicarMigration(filePath, nome) {
  console.log(`\n📄 Aplicando: ${nome}...`);
  
  try {
    const sql = fs.readFileSync(filePath, 'utf8');
    await pool.query(sql);
    console.log(`✅ ${nome} aplicada com sucesso!`);
    return true;
  } catch (error) {
    console.error(`❌ Erro ao aplicar ${nome}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('============================================');
  console.log('  APLICAR MIGRATIONS - SISTEMA PAGAMENTOS');
  console.log('============================================\n');
  
  const migrations = [
    {
      file: 'src/database/migrations/040_add_trial_and_asaas_fields.sql',
      nome: 'Migration 040 - Trial de 3 dias e campos Asaas'
    },
    {
      file: 'src/database/migrations/041_insert_payment_plans.sql',
      nome: 'Migration 041 - Inserir Planos de Pagamento'
    },
    {
      file: 'src/database/migrations/042_update_payments_table.sql',
      nome: 'Migration 042 - Tabela de Pagamentos'
    }
  ];
  
  let sucessos = 0;
  
  for (const migration of migrations) {
    const filePath = path.join(__dirname, migration.file);
    
    // Verificar se arquivo existe
    if (!fs.existsSync(filePath)) {
      console.error(`❌ Arquivo não encontrado: ${migration.file}`);
      continue;
    }
    
    const sucesso = await aplicarMigration(filePath, migration.nome);
    if (sucesso) sucessos++;
  }
  
  console.log('\n============================================');
  if (sucessos === migrations.length) {
    console.log('  ✅ TODAS AS MIGRATIONS APLICADAS!');
  } else {
    console.log(`  ⚠️  ${sucessos}/${migrations.length} migrations aplicadas`);
  }
  console.log('============================================\n');
  
  console.log('📋 Verificando planos criados...\n');
  
  try {
    const result = await pool.query('SELECT nome, slug, preco_mensal FROM plans ORDER BY ordem');
    
    if (result.rows.length > 0) {
      console.log('✅ Planos disponíveis:');
      result.rows.forEach(plan => {
        console.log(`   - ${plan.nome} (${plan.slug}): R$ ${plan.preco_mensal}`);
      });
    } else {
      console.log('⚠️  Nenhum plano encontrado');
    }
  } catch (error) {
    console.log('⚠️  Não foi possível verificar planos:', error.message);
  }
  
  console.log('\n✅ Próximos passos:');
  console.log('1. Configurar ASAAS_API_KEY no .env');
  console.log('2. Configurar webhook no Asaas');
  console.log('3. Reiniciar o backend\n');
  
  await pool.end();
}

main().catch(error => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});

