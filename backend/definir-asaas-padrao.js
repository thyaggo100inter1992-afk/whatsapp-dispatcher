/**
 * Script para definir credencial Asaas como padrão
 * Útil quando você cadastra uma credencial mas esquece de marcar como padrão
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'whatsapp_dispatcher',
  password: process.env.DB_PASSWORD || 'Tg130992*',
  port: process.env.DB_PORT || 5432
});

async function definirAsaasPadrao() {
  try {
    console.log('🔍 Buscando credenciais Asaas...\n');

    // Listar credenciais existentes
    const listResult = await pool.query(`
      SELECT id, name, environment, is_default, is_active, created_at
      FROM asaas_credentials
      ORDER BY is_default DESC, created_at ASC
    `);

    if (listResult.rows.length === 0) {
      console.log('❌ Nenhuma credencial Asaas encontrada!');
      console.log('   Cadastre uma credencial no painel de Super Admin primeiro.');
      return;
    }

    console.log(`📋 Credenciais encontradas: ${listResult.rows.length}\n`);
    
    listResult.rows.forEach((cred, index) => {
      console.log(`${index + 1}. ${cred.name}`);
      console.log(`   - ID: ${cred.id}`);
      console.log(`   - Ambiente: ${cred.environment}`);
      console.log(`   - Padrão: ${cred.is_default ? '✅ SIM' : '❌ NÃO'}`);
      console.log(`   - Ativa: ${cred.is_active ? '✅ SIM' : '❌ NÃO'}`);
      console.log(`   - Criada em: ${new Date(cred.created_at).toLocaleString('pt-BR')}\n`);
    });

    // Verificar se já existe padrão
    const temPadrao = listResult.rows.some(c => c.is_default);
    
    if (temPadrao) {
      console.log('✅ Já existe uma credencial padrão configurada!');
      const padrao = listResult.rows.find(c => c.is_default);
      console.log(`   → ${padrao.name} (${padrao.environment})`);
      return;
    }

    // Definir primeira ativa como padrão
    console.log('⚙️  Nenhuma credencial padrão encontrada. Configurando...\n');

    // 1. Desmarcar todas
    await pool.query('UPDATE asaas_credentials SET is_default = false');

    // 2. Marcar primeira ativa como padrão
    const updateResult = await pool.query(`
      UPDATE asaas_credentials 
      SET is_default = true 
      WHERE id = (
        SELECT id 
        FROM asaas_credentials 
        WHERE is_active = true 
        ORDER BY created_at ASC 
        LIMIT 1
      )
      RETURNING *
    `);

    if (updateResult.rows.length > 0) {
      const credencial = updateResult.rows[0];
      console.log('✅ Credencial padrão configurada com sucesso!');
      console.log(`   → ${credencial.name}`);
      console.log(`   → Ambiente: ${credencial.environment}`);
      console.log('\n🎉 Agora você pode testar a geração de pagamentos!');
    } else {
      console.log('❌ Não foi possível definir credencial padrão.');
      console.log('   Verifique se existe alguma credencial ativa.');
    }

  } catch (error) {
    console.error('\n❌ Erro ao configurar credencial padrão:', error.message);
  } finally {
    await pool.end();
  }
}

// Executar
definirAsaasPadrao();





