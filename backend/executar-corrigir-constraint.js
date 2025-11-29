/**
 * Script para corrigir a constraint de documento na base_dados_completa
 * Permite que o mesmo CPF/CNPJ exista em tenants diferentes
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

async function corrigirConstraint() {
  const client = await pool.connect();
  
  try {
    console.log('\n🔧 ===== CORRIGINDO CONSTRAINT DE DOCUMENTO =====\n');
    
    // Ler arquivo SQL
    const sqlFilePath = path.join(__dirname, 'CORRIGIR-CONSTRAINT-DOCUMENTO.sql');
    const sql = fs.readFileSync(sqlFilePath, 'utf8');
    
    // Executar SQL
    console.log('📝 Executando correção...\n');
    await client.query(sql);
    
    console.log('✅ Constraint corrigida com sucesso!\n');
    
    // Verificar constraints atuais
    console.log('📊 CONSTRAINTS ATUAIS:\n');
    
    const constraints = await client.query(`
      SELECT 
        constraint_name,
        constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'base_dados_completa'
        AND constraint_type = 'UNIQUE'
    `);
    
    constraints.rows.forEach(c => {
      console.log(`   ✅ ${c.constraint_name} (${c.constraint_type})`);
    });
    
    console.log('\n✅ ===== CORREÇÃO CONCLUÍDA! =====\n');
    console.log('🎉 Agora você pode cadastrar o mesmo CPF em tenants diferentes!\n');
    console.log('👉 Tente fazer a consulta novamente do CPF: 43098754168\n');
    
  } catch (error) {
    console.error('❌ Erro ao corrigir constraint:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

corrigirConstraint().catch(error => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});

