import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function createDatabase() {
  // Conectar ao postgres padrão
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: 'postgres', // Conecta ao banco postgres padrão
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  });

  try {
    console.log('🔄 Verificando se banco existe...');
    
    const result = await pool.query(
      "SELECT 1 FROM pg_database WHERE datname = 'whatsapp_dispatcher'"
    );

    if (result.rows.length === 0) {
      console.log('📦 Criando banco de dados...');
      await pool.query('CREATE DATABASE whatsapp_dispatcher');
      console.log('✅ Banco de dados criado com sucesso!');
    } else {
      console.log('✅ Banco de dados já existe!');
    }

    await pool.end();
    return true;
  } catch (error) {
    console.error('❌ Erro ao criar banco:', error);
    await pool.end();
    return false;
  }
}

createDatabase().then(() => process.exit(0));


