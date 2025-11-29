const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'whatsapp_dispatcher',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: 5,
});

async function applyMigrations() {
  const client = await pool.connect();
  
  try {
    console.log('━'.repeat(60));
    console.log('🚀 APLICANDO MIGRATIONS MULTI-TENANT');
    console.log('━'.repeat(60));
    console.log('');
    
    // Testar conexão
    const testResult = await client.query('SELECT NOW()');
    console.log('✅ Conectado ao banco:', process.env.DB_NAME);
    console.log('⏰ Timestamp:', testResult.rows[0].now);
    console.log('');
    
    // Lista de migrations em ordem
    const migrations = [
      '001_create_control_tables.sql',
      '002_add_tenant_id_to_tables.sql',
      '003_populate_default_tenant.sql',
      '004_create_indexes.sql',
      '005_enable_rls.sql'
    ];
    
    const migrationsDir = path.join(__dirname, '../database/migrations/multi-tenant');
    
    for (let i = 0; i < migrations.length; i++) {
      const migrationFile = migrations[i];
      const migrationNumber = i + 1;
      
      console.log(`━`.repeat(60));
      console.log(`📄 Migration ${migrationNumber}/${migrations.length}: ${migrationFile}`);
      console.log(`━`.repeat(60));
      
      // Ler arquivo SQL
      const migrationPath = path.join(migrationsDir, migrationFile);
      
      if (!fs.existsSync(migrationPath)) {
        console.error(`❌ Arquivo não encontrado: ${migrationPath}`);
        process.exit(1);
      }
      
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
      
      try {
        // Executar migration
        await client.query(migrationSQL);
        console.log(`✅ Migration ${migrationNumber} aplicada com sucesso!`);
      } catch (error) {
        console.error(`❌ Erro na migration ${migrationNumber}:`, error.message);
        console.error('');
        console.error('Stack:', error.stack);
        throw error;
      }
      
      console.log('');
    }
    
    console.log('━'.repeat(60));
    console.log('🎉 TODAS AS MIGRATIONS APLICADAS COM SUCESSO!');
    console.log('━'.repeat(60));
    console.log('');
    
    // Verificar tenant criado
    const tenantResult = await client.query('SELECT * FROM tenants WHERE id = 1');
    if (tenantResult.rows.length > 0) {
      const tenant = tenantResult.rows[0];
      console.log('✅ Tenant padrão criado:');
      console.log(`   ID: ${tenant.id}`);
      console.log(`   Nome: ${tenant.nome}`);
      console.log(`   Slug: ${tenant.slug}`);
      console.log(`   Email: ${tenant.email}`);
      console.log(`   Plano: ${tenant.plano}`);
      console.log(`   Status: ${tenant.status}`);
      console.log('');
    }
    
    // Verificar usuário criado
    const userResult = await client.query('SELECT * FROM tenant_users WHERE tenant_id = 1');
    if (userResult.rows.length > 0) {
      const user = userResult.rows[0];
      console.log('✅ Usuário admin criado:');
      console.log(`   Nome: ${user.nome}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Senha padrão: admin123`);
      console.log('');
      console.log('   ⚠️  IMPORTANTE: Altere a senha após o primeiro login!');
      console.log('');
    }
    
    // Estatísticas de dados migrados
    console.log('📊 Dados migrados para Tenant 1:');
    
    const tables = [
      { name: 'whatsapp_accounts', label: 'Contas WhatsApp' },
      { name: 'campaigns', label: 'Campanhas (API)' },
      { name: 'qr_campaigns', label: 'Campanhas (QR)' },
      { name: 'templates', label: 'Templates' },
      { name: 'qr_templates', label: 'Templates QR' },
      { name: 'contacts', label: 'Contatos' },
      { name: 'messages', label: 'Mensagens' },
      { name: 'base_dados_completa', label: 'Base de Dados' },
      { name: 'novavida_consultas', label: 'Consultas Nova Vida' },
      { name: 'lista_restricao', label: 'Lista Restrição' },
    ];
    
    for (const table of tables) {
      try {
        const result = await client.query(`SELECT COUNT(*) FROM ${table.name} WHERE tenant_id = 1`);
        const count = parseInt(result.rows[0].count);
        if (count > 0) {
          console.log(`   ✅ ${table.label}: ${count} registros`);
        }
      } catch (error) {
        // Tabela pode não existir
      }
    }
    
    console.log('');
    console.log('━'.repeat(60));
    console.log('🎯 PRÓXIMOS PASSOS:');
    console.log('━'.repeat(60));
    console.log('');
    console.log('1. ✅ Fase 1 concluída (Banco de dados)');
    console.log('2. ⏳ Fase 2: Implementar autenticação e middleware');
    console.log('3. ⏳ Fase 3: Atualizar controllers do backend');
    console.log('4. ⏳ Fase 4: Implementar frontend (login/cadastro)');
    console.log('5. ⏳ Fase 5: Testes finais');
    console.log('');
    console.log('📖 Consulte o arquivo MULTI-TENANT-IMPLEMENTATION.md');
    console.log('   para acompanhar o progresso!');
    console.log('');
    
  } catch (error) {
    console.error('');
    console.error('━'.repeat(60));
    console.error('❌ ERRO AO APLICAR MIGRATIONS');
    console.error('━'.repeat(60));
    console.error('');
    console.error('Erro:', error.message);
    console.error('');
    console.error('⚠️  O banco pode estar em estado inconsistente!');
    console.error('');
    console.error('Para restaurar o backup:');
    console.error('  psql -h localhost -U postgres -d whatsapp_dispatcher < backups/backup_before_multi_tenant_XXXXX.sql');
    console.error('');
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Executar
console.log('');
console.log('⚠️  ATENÇÃO: Esta operação irá modificar o banco de dados!');
console.log('');
console.log('Certifique-se de que:');
console.log('1. ✅ Você fez backup do banco de dados');
console.log('2. ✅ O backend está parado');
console.log('3. ✅ Nenhum usuário está usando o sistema');
console.log('');

// Aguardar 3 segundos para dar tempo de cancelar
setTimeout(() => {
  applyMigrations().catch(console.error);
}, 3000);

console.log('Aplicando migrations em 3 segundos...');
console.log('Pressione Ctrl+C para cancelar!');
console.log('');



