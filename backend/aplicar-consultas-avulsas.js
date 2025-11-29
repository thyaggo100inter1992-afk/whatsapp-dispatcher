/**
 * Script para aplicar migration de consultas avulsas
 * Adiciona o campo consultas_avulsas_saldo na tabela tenants
 */

const { pool } = require('./src/database/connection');
const fs = require('fs');
const path = require('path');

async function aplicarMigration() {
  console.log('\n🚀 ===== APLICANDO MIGRATION: CONSULTAS AVULSAS =====\n');

  try {
    // Ler o arquivo SQL
    const sqlPath = path.join(__dirname, 'migrations', 'add_consultas_avulsas_to_tenants.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('📄 Executando SQL...\n');
    console.log(sql);
    console.log('\n');

    // Executar o SQL
    await pool.query(sql);

    console.log('✅ Migration aplicada com sucesso!\n');
    
    // Verificar se a coluna foi criada
    const checkResult = await pool.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'tenants'
      AND column_name = 'consultas_avulsas_saldo'
    `);

    if (checkResult.rows.length > 0) {
      const col = checkResult.rows[0];
      console.log('📊 Coluna criada com sucesso:');
      console.log(`   Nome: ${col.column_name}`);
      console.log(`   Tipo: ${col.data_type}`);
      console.log(`   Padrão: ${col.column_default || 0}`);
    } else {
      console.log('⚠️  Atenção: Coluna pode já existir ou houve um erro');
    }

    // Verificar campo consultas_avulsas_usadas (pode não existir ainda)
    const checkUsadas = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns
      WHERE table_name = 'tenants'
      AND column_name = 'consultas_avulsas_usadas'
    `);

    if (checkUsadas.rows.length === 0) {
      console.log('\n📝 Criando campo consultas_avulsas_usadas...');
      await pool.query(`
        ALTER TABLE tenants 
        ADD COLUMN IF NOT EXISTS consultas_avulsas_usadas INTEGER DEFAULT 0;
        
        COMMENT ON COLUMN tenants.consultas_avulsas_usadas IS 'Total de consultas avulsas já utilizadas (histórico)';
      `);
      console.log('✅ Campo consultas_avulsas_usadas criado!');
    } else {
      console.log('✅ Campo consultas_avulsas_usadas já existe');
    }

    console.log('\n🎉 ===== MIGRATION CONCLUÍDA COM SUCESSO =====\n');
    
  } catch (error) {
    console.error('\n❌ Erro ao aplicar migration:', error);
    console.error('\nDetalhes:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Executar
aplicarMigration();




