/**
 * Script para executar a migration de controle de funcionalidades
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: process.env.DB_NAME || 'whatsapp_dispatcher',
  user: 'postgres',
  password: 'Tg130992*'
});

async function executarMigration() {
  try {
    console.log('🔄 Executando migration de controle de funcionalidades...\n');

    // Ler arquivo SQL
    const sqlPath = path.join(__dirname, 'criar-tabela-permissoes.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Remover comandos PRINT (não suportados pelo PostgreSQL)
    const cleanSql = sql.replace(/PRINT .+;/g, '');

    // Executar SQL
    await pool.query(cleanSql);

    console.log('✅ Migration executada com sucesso!\n');
    console.log('📋 Alterações aplicadas:');
    console.log('   1. Coluna "funcionalidades" adicionada em plans');
    console.log('   2. Colunas de funcionalidades adicionadas em tenants');
    console.log('   3. Planos atualizados com funcionalidades padrão');
    console.log('   4. Índices criados para performance');
    console.log('   5. Função get_tenant_funcionalidades() criada');
    console.log('');
    console.log('🎯 Funcionalidades disponíveis:');
    console.log('   - whatsapp_api: WhatsApp API Oficial');
    console.log('   - whatsapp_qr: WhatsApp QR Connect');
    console.log('   - campanhas: Criar campanhas');
    console.log('   - templates: Gerenciar templates');
    console.log('   - base_dados: Base de contatos');
    console.log('   - nova_vida: Consultas Nova Vida');
    console.log('   - lista_restricao: Lista de restrição');
    console.log('   - webhooks: Configurar webhooks');
    console.log('   - catalogo: Catálogo de produtos');
    console.log('   - dashboard: Dashboard e estatísticas');
    console.log('   - relatorios: Gerar relatórios');
    console.log('   - envio_imediato: Envio imediato de mensagens');
    console.log('');

    // Verificar planos
    const planosResult = await pool.query(`
      SELECT id, nome, slug, funcionalidades 
      FROM plans 
      ORDER BY id
    `);

    console.log('📊 Funcionalidades por plano:');
    planosResult.rows.forEach(plano => {
      console.log(`\n   ${plano.nome} (${plano.slug}):`);
      const funcs = plano.funcionalidades;
      Object.keys(funcs).forEach(key => {
        const status = funcs[key] ? '✅' : '❌';
        console.log(`      ${status} ${key}`);
      });
    });

    console.log('');
    console.log('✅ Sistema pronto para uso!');
    console.log('');

  } catch (error) {
    console.error('❌ Erro ao executar migration:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

executarMigration();



