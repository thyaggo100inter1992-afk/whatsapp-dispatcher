import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'whatsapp_dispatcher',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: 50,
  idleTimeoutMillis: 30000,
  // Aumentado de 2000ms para 10000ms: evita erros em cascata quando o pool está sob alta carga
  connectionTimeoutMillis: 10000,
  client_encoding: 'UTF8',
});

// Capturar erros do pool sem deixar o processo morrer silenciosamente
pool.on('error', (err) => {
  console.error('❌ [Pool] Erro inesperado no cliente idle do PostgreSQL:', err.message);
});

// Limiar em ms para logar queries lentas (0 = sem log de queries rápidas)
const SLOW_QUERY_THRESHOLD_MS = parseInt(process.env.SLOW_QUERY_MS || '500');

export async function query(text: string, params?: any[]) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  // Logar APENAS queries lentas para não sobrecarregar o Event Loop com I/O de console
  if (duration >= SLOW_QUERY_THRESHOLD_MS) {
    console.warn(`⚠️ [SlowQuery] ${duration}ms — ${text.substring(0, 120)}`);
  }
  return res;
}

export async function testConnection() {
  try {
    const result = await query('SELECT NOW()');
    console.log('✅ Database connected successfully!', result.rows[0]);
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
}


