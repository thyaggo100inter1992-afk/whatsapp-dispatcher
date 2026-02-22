import { Request, Response } from 'express';
import { tenantQuery } from '../database/tenant-query';
import { testProxy as testProxyConnection, formatProxyInfo, ProxyConfig } from '../helpers/proxy.helper';

export class ProxyManagerController {
  /**
   * GET /api/proxies
   * Listar todos os proxies
   */
  async listAll(req: Request, res: Response) {
    try {
      console.log('🔍 [ProxyManager] listAll chamado');
      
      // Usar pool direto com filtro de tenant_id
      const { Pool } = require('pg');
      const pool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'whatsapp_dispatcher',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
      });

      const tenantId = (req as any).user?.tenant_id || (req as any).tenant?.id;
      console.log('   tenant_id:', tenantId);

      const result = await pool.query(
        `SELECT 
          id, name, type, host, port, username, location, description,
          status, last_check, last_ip, is_active, created_at, updated_at,
          (SELECT COUNT(*) FROM whatsapp_accounts WHERE proxy_id = proxies.id AND tenant_id = $1) as accounts_count
        FROM proxies 
        WHERE tenant_id = $1
        ORDER BY created_at DESC`,
        [tenantId]
      );

      console.log('✅ [ProxyManager] Proxies encontrados:', result.rows.length);
      res.json({ success: true, data: result.rows });
    } catch (error: any) {
      console.error('❌ [ProxyManager] Erro ao listar proxies:', error);
      console.error('   Stack:', error.stack);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/proxies/active
   * Listar apenas proxies ativos
   */
  async listActive(req: Request, res: Response) {
    try {
      console.log('🔍 [ProxyManager] listActive chamado');
      console.log('   req.user:', req.user);
      console.log('   req.tenant:', (req as any).tenant);
      
      // Usar pool direto com filtro de tenant_id (solução temporária)
      const { Pool } = require('pg');
      const pool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'whatsapp_dispatcher',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
      });

      const tenantId = (req as any).user?.tenant_id || (req as any).tenant?.id;
      console.log('   tenant_id:', tenantId);

      const result = await pool.query(
        `SELECT id, name, type, host, port, location, status 
        FROM proxies 
        WHERE is_active = TRUE AND tenant_id = $1
        ORDER BY name`,
        [tenantId]
      );

      console.log('✅ [ProxyManager] Proxies encontrados:', result.rows.length);
      res.json({ success: true, data: result.rows });
    } catch (error: any) {
      console.error('❌ [ProxyManager] Erro ao listar proxies ativos:', error);
      console.error('   Stack:', error.stack);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/proxies/:id
   * Buscar proxy por ID
   */
  async findById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      console.log('🔍 [ProxyManager] findById:', id);

      // Usar pool direto com filtro de tenant_id
      const { Pool } = require('pg');
      const pool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'whatsapp_dispatcher',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
      });

      const tenantId = (req as any).user?.tenant_id || (req as any).tenant?.id;

      const result = await pool.query(
        'SELECT * FROM proxies WHERE id = $1 AND tenant_id = $2',
        [id, tenantId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Proxy não encontrado' });
      }

      console.log('✅ [ProxyManager] Proxy encontrado');
      res.json({ success: true, data: result.rows[0] });
    } catch (error: any) {
      console.error('❌ [ProxyManager] Erro ao buscar proxy:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/proxies
   * Criar novo proxy
   */
  async create(req: Request, res: Response) {
    try {
      const { name, type, host, port, username, password, location, description, rotation_interval, proxy_pool } = req.body;

      // Validações
      if (!name) {
        return res.status(400).json({
          success: false,
          error: 'Nome é obrigatório'
        });
      }

      if (type === 'rotating') {
        if (!proxy_pool || !Array.isArray(proxy_pool) || proxy_pool.length === 0) {
          return res.status(400).json({
            success: false,
            error: 'Proxy rotativo precisa ter pelo menos 1 proxy no pool'
          });
        }
      } else {
        if (!host || !port) {
          return res.status(400).json({
            success: false,
            error: 'Host e porta são obrigatórios para proxies fixos'
          });
        }
      }

      // Verificar se o nome já existe
      const existingResult = await tenantQuery(req, 
        'SELECT id FROM proxies WHERE name = $1',
        [name]
      );

      if (existingResult.rows.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Já existe um proxy com este nome'
        });
      }

      // 🔒 SEGURANÇA: Obter tenant_id do request
      const tenantId = (req as any).tenant?.id;
      if (!tenantId) {
        return res.status(401).json({
          success: false,
          error: 'Tenant não identificado'
        });
      }

      const result = await tenantQuery(req, 
        `INSERT INTO proxies 
        (tenant_id, name, type, host, port, username, password, location, description, rotation_interval, proxy_pool, current_proxy_index) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
        RETURNING *`,
        [
          tenantId, // 🔒 IMPORTANTE: tenant_id explícito
          name, 
          type || 'socks5', 
          host || '', 
          port || 0, 
          username, 
          password, 
          location, 
          description,
          type === 'rotating' ? rotation_interval : null,
          type === 'rotating' ? JSON.stringify(proxy_pool) : null,
          type === 'rotating' ? 0 : null // Inicia no primeiro proxy do pool
        ]
      );

      console.log(`✅ Proxy criado para tenant ${tenantId}: ${name} ${type === 'rotating' ? `(Rotativo com ${proxy_pool?.length} proxies)` : `(${host}:${port})`}`);
      res.json({ success: true, data: result.rows[0] });
    } catch (error: any) {
      console.error('Erro ao criar proxy:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * PUT /api/proxies/:id
   * Atualizar proxy
   */
  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { name, type, host, port, username, password, location, description, is_active, rotation_interval, proxy_pool } = req.body;

      // Verificar se proxy existe
      const existingResult = await tenantQuery(req, 'SELECT id FROM proxies WHERE id = $1', [id]);
      if (existingResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Proxy não encontrado' });
      }

      // Verificar se o novo nome já existe (exceto o próprio proxy)
      if (name) {
        const nameCheck = await tenantQuery(req, 
          'SELECT id FROM proxies WHERE name = $1 AND id != $2',
          [name, id]
        );
        if (nameCheck.rows.length > 0) {
          return res.status(400).json({
            success: false,
            error: 'Já existe outro proxy com este nome'
          });
        }
      }

      // Validações para proxy rotativo
      if (type === 'rotating') {
        if (!proxy_pool || !Array.isArray(proxy_pool) || proxy_pool.length === 0) {
          return res.status(400).json({
            success: false,
            error: 'Proxy rotativo precisa ter pelo menos 1 proxy no pool'
          });
        }
      }

      const result = await tenantQuery(req, 
        `UPDATE proxies SET 
          name = COALESCE($1, name),
          type = COALESCE($2, type),
          host = COALESCE($3, host),
          port = COALESCE($4, port),
          username = $5,
          password = $6,
          location = $7,
          description = $8,
          is_active = COALESCE($9, is_active),
          rotation_interval = $10,
          proxy_pool = $11,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $12
        RETURNING *`,
        [
          name, 
          type, 
          host, 
          port, 
          username, 
          password, 
          location, 
          description, 
          is_active,
          type === 'rotating' ? rotation_interval : null,
          type === 'rotating' ? JSON.stringify(proxy_pool) : null,
          id
        ]
      );

      console.log(`✅ Proxy atualizado: ID ${id}`);
      res.json({ success: true, data: result.rows[0] });
    } catch (error: any) {
      console.error('Erro ao atualizar proxy:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * DELETE /api/proxies/:id
   * Deletar proxy
   */
  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;

      // Verificar se proxy está em uso
      const usageCheck = await tenantQuery(req, 
        'SELECT COUNT(*) as count FROM whatsapp_accounts WHERE proxy_id = $1',
        [id]
      );

      if (parseInt(usageCheck.rows[0].count) > 0) {
        return res.status(400).json({
          success: false,
          error: 'Este proxy está sendo usado por contas. Remova das contas antes de deletar.'
        });
      }

      const result = await tenantQuery(req, 'DELETE FROM proxies WHERE id = $1 RETURNING *', [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Proxy não encontrado' });
      }

      console.log(`🗑️ Proxy deletado: ID ${id}`);
      res.json({ success: true, message: 'Proxy deletado com sucesso' });
    } catch (error: any) {
      console.error('Erro ao deletar proxy:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/proxies/:id/test
   * Testar proxy
   */
  async test(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const result = await tenantQuery(req, 'SELECT * FROM proxies WHERE id = $1', [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Proxy não encontrado' });
      }

      const proxy = result.rows[0];

      const proxyConfig: ProxyConfig = {
        enabled: true,
        type: proxy.type,
        host: proxy.host,
        port: proxy.port,
        username: proxy.username,
        password: proxy.password
      };

      console.log(`🧪 Testando proxy: ${proxy.name} (${proxy.host}:${proxy.port})`);

      const testResult = await testProxyConnection(proxyConfig);

      // Atualizar status no banco
      await tenantQuery(req, 
        `UPDATE proxies SET 
          status = $1,
          last_check = CURRENT_TIMESTAMP,
          last_ip = $2,
          location = $3
        WHERE id = $4`,
        [
          testResult.success ? 'working' : 'failed',
          testResult.ip || null,
          testResult.location || proxy.location,
          id
        ]
      );

      res.json(testResult);
    } catch (error: any) {
      console.error('Erro ao testar proxy:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/proxies/test-all
   * Testar todos os proxies ativos
   */
  async testAll(req: Request, res: Response) {
    try {
      const result = await tenantQuery(req, 'SELECT * FROM proxies WHERE is_active = TRUE');
      const proxies = result.rows;

      console.log(`🧪 Testando ${proxies.length} proxies...`);

      const testResults = [];

      for (const proxy of proxies) {
        const proxyConfig: ProxyConfig = {
          enabled: true,
          type: proxy.type,
          host: proxy.host,
          port: proxy.port,
          username: proxy.username,
          password: proxy.password
        };

        const testResult = await testProxyConnection(proxyConfig);

        // Atualizar status no banco
        await tenantQuery(req, 
          `UPDATE proxies SET 
            status = $1,
            last_check = CURRENT_TIMESTAMP,
            last_ip = $2,
            location = $3
          WHERE id = $4`,
          [
            testResult.success ? 'working' : 'failed',
            testResult.ip || null,
            testResult.location || proxy.location,
            proxy.id
          ]
        );

        testResults.push({
          id: proxy.id,
          name: proxy.name,
          ...testResult
        });
      }

      const successCount = testResults.filter(r => r.success).length;
      console.log(`✅ Testes concluídos: ${successCount}/${proxies.length} funcionando`);

      res.json({
        success: true,
        tested: proxies.length,
        working: successCount,
        failed: proxies.length - successCount,
        results: testResults
      });
    } catch (error: any) {
      console.error('Erro ao testar proxies:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/proxies/:id/accounts
   * Listar contas que estão usando este proxy
   */
  async listAccounts(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const { Pool } = require('pg');
      const pool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'whatsapp_dispatcher',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
      });

      const tenantId = (req as any).user?.tenant_id || (req as any).tenant?.id;

      // Verificar se proxy existe e pertence ao tenant
      const proxyCheck = await pool.query(
        'SELECT id, name FROM proxies WHERE id = $1 AND tenant_id = $2',
        [id, tenantId]
      );
      if (proxyCheck.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Proxy não encontrado' });
      }

      const result = await pool.query(
        `SELECT 
          wa.id, wa.name, wa.phone_number, wa.status, wa.is_active, wa.created_at
        FROM whatsapp_accounts wa
        WHERE wa.proxy_id = $1 AND wa.tenant_id = $2
        ORDER BY wa.name ASC`,
        [id, tenantId]
      );

      res.json({
        success: true,
        proxy: proxyCheck.rows[0],
        data: result.rows,
        total: result.rows.length
      });
    } catch (error: any) {
      console.error('❌ [ProxyManager] Erro ao listar contas do proxy:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/proxies/transfer-accounts
   * Transferir contas em massa de um proxy para outro
   * Body: { from_proxy_id, to_proxy_id, account_ids? }
   */
  async transferAccounts(req: Request, res: Response) {
    try {
      const { from_proxy_id, to_proxy_id, account_ids } = req.body;

      if (!from_proxy_id || !to_proxy_id) {
        return res.status(400).json({
          success: false,
          error: 'from_proxy_id e to_proxy_id são obrigatórios'
        });
      }

      if (from_proxy_id === to_proxy_id) {
        return res.status(400).json({
          success: false,
          error: 'Os proxies de origem e destino devem ser diferentes'
        });
      }

      const { Pool } = require('pg');
      const pool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'whatsapp_dispatcher',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
      });

      const tenantId = (req as any).user?.tenant_id || (req as any).tenant?.id;

      // Verificar se proxies existem e pertencem ao tenant
      const proxyCheck = await pool.query(
        'SELECT id, name FROM proxies WHERE id = ANY($1) AND tenant_id = $2',
        [[from_proxy_id, to_proxy_id], tenantId]
      );
      if (proxyCheck.rows.length < 2) {
        return res.status(404).json({ success: false, error: 'Um ou ambos os proxies não foram encontrados' });
      }

      let result;

      if (account_ids && Array.isArray(account_ids) && account_ids.length > 0) {
        // Transferir apenas as contas selecionadas
        result = await pool.query(
          `UPDATE whatsapp_accounts
           SET proxy_id = $1
           WHERE proxy_id = $2 AND id = ANY($3) AND tenant_id = $4
           RETURNING id, name, phone_number`,
          [to_proxy_id, from_proxy_id, account_ids, tenantId]
        );
      } else {
        // Transferir todas as contas do proxy origem
        result = await pool.query(
          `UPDATE whatsapp_accounts
           SET proxy_id = $1
           WHERE proxy_id = $2 AND tenant_id = $3
           RETURNING id, name, phone_number`,
          [to_proxy_id, from_proxy_id, tenantId]
        );
      }

      const fromProxy = proxyCheck.rows.find((p: any) => p.id == from_proxy_id);
      const toProxy = proxyCheck.rows.find((p: any) => p.id == to_proxy_id);

      console.log(`✅ [ProxyManager] ${result.rows.length} conta(s) transferidas de "${fromProxy?.name}" para "${toProxy?.name}"`);

      res.json({
        success: true,
        transferred: result.rows.length,
        accounts: result.rows,
        from_proxy: fromProxy,
        to_proxy: toProxy
      });
    } catch (error: any) {
      console.error('❌ [ProxyManager] Erro ao transferir contas:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

export const proxyManagerController = new ProxyManagerController();


