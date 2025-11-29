import { Pool, PoolClient, QueryResult } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Gerenciador de Conexões Multi-Tenant
 * Gerencia um pool único compartilhado para todos os tenants
 */
class TenantConnectionManager {
  private pool: Pool;

  constructor() {
    // Pool único para todos os tenants (banco único)
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'whatsapp_dispatcher',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'Tg130992*', // HARDCODED como fallback
      max: 100, // ⚡ AUMENTADO DE 50 PARA 100 - Suporta mais tenants simultâneos
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    console.log('✅ Pool de conexões multi-tenant criado');
  }

  /**
   * Query simples (sem tenant - para tabelas de controle)
   */
  async query(text: string, params?: any[]): Promise<QueryResult> {
    return this.pool.query(text, params);
  }

  /**
   * Query com tenant automático (usando RLS)
   */
  async queryWithTenant(tenantId: number, text: string, params?: any[]): Promise<QueryResult> {
    const client = await this.pool.connect();

    try {
      // Definir tenant atual na sessão (para RLS)
      await client.query('SELECT set_current_tenant($1)', [tenantId]);

      // Executar query (RLS vai filtrar automaticamente)
      const result = await client.query(text, params);

      return result;
    } finally {
      // Sempre liberar o cliente de volta ao pool
      client.release();
    }
  }

  /**
   * Transação com tenant
   */
  async transaction<T>(
    tenantId: number,
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Definir tenant atual
      await client.query('SELECT set_current_tenant($1)', [tenantId]);

      // Executar callback
      const result = await callback(client);

      await client.query('COMMIT');

      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Obter cliente do pool (uso avançado)
   */
  async getClient(): Promise<PoolClient> {
    return this.pool.connect();
  }

  /**
   * Fechar todas as conexões
   */
  async close(): Promise<void> {
    await this.pool.end();
    console.log('✅ Pool de conexões fechado');
  }

  /**
   * Verificar saúde do pool
   */
  getPoolInfo() {
    return {
      total: this.pool.totalCount,
      idle: this.pool.idleCount,
      waiting: this.pool.waitingCount,
    };
  }
}

// Exportar singleton
const connectionManager = new TenantConnectionManager();

export default connectionManager;

// Exportar tipos
export { TenantConnectionManager, PoolClient };



