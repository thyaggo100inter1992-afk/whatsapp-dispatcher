/**
 * Atualizar senha do admin
 */

require('dotenv').config();
const bcrypt = require('bcrypt');
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'whatsapp_dispatcher',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
});

async function atualizarSenha() {
  try {
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║                                                          ║');
    console.log('║       🔐 ATUALIZANDO SENHA DO ADMIN 🔐                   ║');
    console.log('║                                                          ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    // 1. Buscar usuário
    const userResult = await pool.query(`
      SELECT id, email, senha_hash 
      FROM tenant_users 
      WHERE LOWER(email) = LOWER($1)
    `, ['admin@minhaempresa.com']);

    if (userResult.rows.length === 0) {
      console.log('❌ Usuário não encontrado!');
      await pool.end();
      process.exit(1);
    }

    const user = userResult.rows[0];

    console.log('━━━━ USUÁRIO ENCONTRADO ━━━━');
    console.log('ID:', user.id);
    console.log('Email:', user.email);
    console.log('Hash atual:', user.senha_hash);
    console.log('');

    // 2. Testar senha atual
    const senhaAtual = 'admin123';
    console.log('━━━━ TESTANDO SENHA ATUAL ━━━━');
    console.log('Senha testada:', senhaAtual);

    const hashAtualMatch = await bcrypt.compare(senhaAtual, user.senha_hash);
    console.log('Hash atual funciona?', hashAtualMatch ? '✅ SIM' : '❌ NÃO');
    console.log('');

    if (hashAtualMatch) {
      console.log('✅ A senha já está correta!');
      console.log('   O problema pode ser outro.');
      console.log('');
      await pool.end();
      process.exit(0);
    }

    // 3. Gerar novo hash
    console.log('━━━━ GERANDO NOVO HASH ━━━━');
    const novoHash = await bcrypt.hash(senhaAtual, 10);
    console.log('Novo hash gerado:', novoHash);
    console.log('');

    // 4. Testar novo hash
    const novoHashMatch = await bcrypt.compare(senhaAtual, novoHash);
    console.log('Novo hash funciona?', novoHashMatch ? '✅ SIM' : '❌ NÃO');
    console.log('');

    if (!novoHashMatch) {
      console.log('❌ Erro ao gerar hash!');
      await pool.end();
      process.exit(1);
    }

    // 5. Atualizar no banco
    console.log('━━━━ ATUALIZANDO NO BANCO ━━━━');
    await pool.query(`
      UPDATE tenant_users 
      SET senha_hash = $1 
      WHERE id = $2
    `, [novoHash, user.id]);

    console.log('✅ Senha atualizada com sucesso!');
    console.log('');

    // 6. Verificar atualização
    const verificacao = await pool.query(`
      SELECT senha_hash 
      FROM tenant_users 
      WHERE id = $1
    `, [user.id]);

    const hashVerificacao = verificacao.rows[0].senha_hash;
    const verificacaoMatch = await bcrypt.compare(senhaAtual, hashVerificacao);

    console.log('━━━━ VERIFICAÇÃO FINAL ━━━━');
    console.log('Hash no banco:', hashVerificacao);
    console.log('Senha funciona?', verificacaoMatch ? '✅ SIM' : '❌ NÃO');
    console.log('');

    if (verificacaoMatch) {
      console.log('╔══════════════════════════════════════════════════════════╗');
      console.log('║                                                          ║');
      console.log('║        ✅ SENHA ATUALIZADA COM SUCESSO! ✅               ║');
      console.log('║                                                          ║');
      console.log('║  📧 Email: admin@minhaempresa.com                        ║');
      console.log('║  🔑 Senha: admin123                                      ║');
      console.log('║                                                          ║');
      console.log('║  🎯 TESTE NOVAMENTE O LOGIN! 🎯                          ║');
      console.log('║                                                          ║');
      console.log('╚══════════════════════════════════════════════════════════╝');
    } else {
      console.log('❌ Algo deu errado na atualização!');
    }

    console.log('');

    await pool.end();
    process.exit(0);

  } catch (error) {
    console.error('❌ Erro:', error);
    await pool.end();
    process.exit(1);
  }
}

atualizarSenha();

