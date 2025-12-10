/**
 * ========================================
 * SCRIPT DE MIGRAÇÃO: NORMALIZAR CPF/CNPJ
 * ========================================
 * 
 * Este script corrige TODOS os CPFs/CNPJs existentes no banco de dados,
 * adicionando zeros à esquerda para CPFs (11 dígitos) e CNPJs (14 dígitos).
 * 
 * COMO EXECUTAR:
 * node backend/scripts/normalizar-documentos.js
 * 
 * ========================================
 */

const { Pool } = require('pg');
const readline = require('readline');

// Configuração do banco (usar as mesmas variáveis de ambiente do sistema)
require('dotenv').config({ path: '.env.production' });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'whatsapp_dispatcher',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

// Interface para ler entrada do usuário
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function pergunta(texto) {
  return new Promise((resolve) => {
    rl.question(texto, resolve);
  });
}

async function executarMigracao() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  🔧 MIGRAÇÃO: NORMALIZAR CPF/CNPJ NO BANCO DE DADOS       ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('\n');

  try {
    // ========================================
    // ETAPA 1: ESTATÍSTICAS ANTES
    // ========================================
    console.log('📊 ANALISANDO BANCO DE DADOS...\n');
    
    const statsAntes = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN LENGTH(documento) < 11 THEN 1 END) as cpfs_incorretos,
        COUNT(CASE WHEN LENGTH(documento) BETWEEN 12 AND 13 THEN 1 END) as cnpjs_incorretos,
        COUNT(CASE WHEN LENGTH(documento) = 11 THEN 1 END) as cpfs_corretos,
        COUNT(CASE WHEN LENGTH(documento) = 14 THEN 1 END) as cnpjs_corretos
      FROM base_dados_completa
    `);

    const stats = statsAntes.rows[0];
    
    console.log('┌─────────────────────────────────────────────┐');
    console.log('│  📋 SITUAÇÃO ATUAL DO BANCO                 │');
    console.log('├─────────────────────────────────────────────┤');
    console.log(`│  Total de registros: ${stats.total.padEnd(23)}│`);
    console.log('├─────────────────────────────────────────────┤');
    console.log(`│  ✅ CPFs corretos (11 dígitos): ${stats.cpfs_corretos.padEnd(12)}│`);
    console.log(`│  ❌ CPFs incorretos (< 11): ${stats.cpfs_incorretos.padEnd(16)}│`);
    console.log('├─────────────────────────────────────────────┤');
    console.log(`│  ✅ CNPJs corretos (14 dígitos): ${stats.cnpjs_corretos.padEnd(11)}│`);
    console.log(`│  ❌ CNPJs incorretos (12-13): ${stats.cnpjs_incorretos.padEnd(14)}│`);
    console.log('└─────────────────────────────────────────────┘\n');

    const totalParaCorrigir = parseInt(stats.cpfs_incorretos) + parseInt(stats.cnpjs_incorretos);

    if (totalParaCorrigir === 0) {
      console.log('✅ Todos os documentos já estão normalizados!');
      console.log('   Nada a fazer.\n');
      await pool.end();
      rl.close();
      return;
    }

    // ========================================
    // ETAPA 2: MOSTRAR EXEMPLOS
    // ========================================
    console.log(`⚠️  SERÃO CORRIGIDOS ${totalParaCorrigir} DOCUMENTO(S)\n`);
    
    console.log('📝 EXEMPLOS DE CPFs QUE SERÃO CORRIGIDOS:\n');
    const exemplosCPF = await pool.query(`
      SELECT id, documento, nome
      FROM base_dados_completa
      WHERE LENGTH(documento) < 11
      LIMIT 5
    `);

    if (exemplosCPF.rows.length > 0) {
      exemplosCPF.rows.forEach(row => {
        const corrigido = row.documento.padStart(11, '0');
        console.log(`   ${row.documento} → ${corrigido} (${row.nome})`);
      });
      console.log('');
    }

    const exemplosCNPJ = await pool.query(`
      SELECT id, documento, nome
      FROM base_dados_completa
      WHERE LENGTH(documento) BETWEEN 12 AND 13
      LIMIT 5
    `);

    if (exemplosCNPJ.rows.length > 0) {
      console.log('📝 EXEMPLOS DE CNPJs QUE SERÃO CORRIGIDOS:\n');
      exemplosCNPJ.rows.forEach(row => {
        const corrigido = row.documento.padStart(14, '0');
        console.log(`   ${row.documento} → ${corrigido} (${row.nome})`);
      });
      console.log('');
    }

    // ========================================
    // ETAPA 3: CONFIRMAÇÃO
    // ========================================
    console.log('⚠️  ATENÇÃO: Esta operação irá alterar o banco de dados!\n');
    const resposta = await pergunta('Deseja continuar? (digite SIM para confirmar): ');
    
    if (resposta.trim().toUpperCase() !== 'SIM') {
      console.log('\n❌ Operação cancelada pelo usuário.\n');
      await pool.end();
      rl.close();
      return;
    }

    // ========================================
    // ETAPA 4: EXECUTAR CORREÇÃO
    // ========================================
    console.log('\n🔧 INICIANDO CORREÇÃO...\n');
    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Corrigir CPFs
      console.log('   Corrigindo CPFs...');
      const resultCPF = await client.query(`
        UPDATE base_dados_completa
        SET documento = LPAD(documento, 11, '0')
        WHERE LENGTH(documento) < 11
      `);
      console.log(`   ✅ ${resultCPF.rowCount} CPF(s) corrigido(s)`);
      
      // Corrigir CNPJs
      console.log('   Corrigindo CNPJs...');
      const resultCNPJ = await client.query(`
        UPDATE base_dados_completa
        SET documento = LPAD(documento, 14, '0')
        WHERE LENGTH(documento) BETWEEN 12 AND 13
      `);
      console.log(`   ✅ ${resultCNPJ.rowCount} CNPJ(s) corrigido(s)`);
      
      await client.query('COMMIT');
      console.log('\n✅ CORREÇÃO CONCLUÍDA COM SUCESSO!\n');
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('\n❌ ERRO AO EXECUTAR CORREÇÃO:', error.message);
      throw error;
    } finally {
      client.release();
    }

    // ========================================
    // ETAPA 5: ESTATÍSTICAS DEPOIS
    // ========================================
    console.log('📊 VERIFICANDO RESULTADO...\n');
    
    const statsDepois = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN LENGTH(documento) < 11 THEN 1 END) as cpfs_incorretos,
        COUNT(CASE WHEN LENGTH(documento) BETWEEN 12 AND 13 THEN 1 END) as cnpjs_incorretos,
        COUNT(CASE WHEN LENGTH(documento) = 11 THEN 1 END) as cpfs_corretos,
        COUNT(CASE WHEN LENGTH(documento) = 14 THEN 1 END) as cnpjs_corretos
      FROM base_dados_completa
    `);

    const statsNovo = statsDepois.rows[0];
    
    console.log('┌─────────────────────────────────────────────┐');
    console.log('│  🎉 RESULTADO FINAL                         │');
    console.log('├─────────────────────────────────────────────┤');
    console.log(`│  Total de registros: ${statsNovo.total.padEnd(23)}│`);
    console.log('├─────────────────────────────────────────────┤');
    console.log(`│  ✅ CPFs corretos (11 dígitos): ${statsNovo.cpfs_corretos.padEnd(12)}│`);
    console.log(`│  ❌ CPFs incorretos (< 11): ${statsNovo.cpfs_incorretos.padEnd(16)}│`);
    console.log('├─────────────────────────────────────────────┤');
    console.log(`│  ✅ CNPJs corretos (14 dígitos): ${statsNovo.cnpjs_corretos.padEnd(11)}│`);
    console.log(`│  ❌ CNPJs incorretos (12-13): ${statsNovo.cnpjs_incorretos.padEnd(14)}│`);
    console.log('└─────────────────────────────────────────────┘\n');

    if (parseInt(statsNovo.cpfs_incorretos) === 0 && parseInt(statsNovo.cnpjs_incorretos) === 0) {
      console.log('🎉 SUCESSO! Todos os documentos foram normalizados corretamente!\n');
    } else {
      console.log('⚠️  Ainda existem documentos incorretos. Verifique manualmente.\n');
    }

  } catch (error) {
    console.error('\n❌ ERRO:', error.message);
    console.error(error);
  } finally {
    await pool.end();
    rl.close();
  }
}

// Executar migração
executarMigracao();

