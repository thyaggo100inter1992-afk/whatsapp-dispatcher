const { query } = require('./src/database/connection');

async function verificar() {
  try {
    console.log('\n🔍 Verificando logo no banco de dados...\n');
    
    const result = await query(`
      SELECT setting_key, setting_value, setting_type 
      FROM system_settings 
      WHERE setting_key = 'system_logo'
    `);
    
    if (result.rows.length > 0) {
      console.log('✅ Logo encontrada no banco:');
      console.log('   Chave:', result.rows[0].setting_key);
      console.log('   Valor:', result.rows[0].setting_value);
      console.log('   Tipo:', result.rows[0].setting_type);
    } else {
      console.log('❌ Nenhuma logo encontrada no banco!');
    }
    
    console.log('\n📊 Todas as configurações:');
    const allSettings = await query('SELECT * FROM system_settings ORDER BY setting_key');
    allSettings.rows.forEach(row => {
      console.log(`   ${row.setting_key}: ${row.setting_value || '(vazio)'}`);
    });
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    process.exit();
  }
}

verificar();





