const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'whatsapp_api',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres'
});

async function limparIdsLocais() {
  try {
    console.log('🧹 ===== LIMPANDO IDs LOCAIS DO BANCO =====\n');

    // Buscar produtos com IDs locais
    const result = await pool.query(
      `SELECT id, name, facebook_product_id 
       FROM products 
       WHERE facebook_product_id LIKE 'local_%'`
    );

    console.log(`📦 Encontrados ${result.rows.length} produtos com IDs locais\n`);

    if (result.rows.length > 0) {
      console.log('Produtos que serão limpos:');
      result.rows.forEach(product => {
        console.log(`  - ID ${product.id}: ${product.name} (${product.facebook_product_id})`);
      });

      // Limpar os IDs locais
      await pool.query(
        `UPDATE products 
         SET facebook_product_id = NULL, 
             synced_at = NULL, 
             sync_status = NULL 
         WHERE facebook_product_id LIKE 'local_%'`
      );

      console.log(`\n✅ ${result.rows.length} produtos limpos com sucesso!`);
      console.log('📝 Os produtos agora podem ser sincronizados novamente\n');
    } else {
      console.log('✅ Nenhum produto com ID local encontrado\n');
    }

  } catch (error) {
    console.error('❌ Erro ao limpar IDs locais:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

limparIdsLocais();

