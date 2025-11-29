import { Request, Response } from 'express';
import { tenantQuery } from '../database/tenant-query';
import {
  ProxyConfig,
  testProxy,
  validateProxyConfig,
  formatProxyInfo
} from '../helpers/proxy.helper';

export class ProxyController {
  /**
   * GET /api/whatsapp-accounts/:id/proxy
   * Buscar configuração de proxy da conta
   */
  async getProxyConfig(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const result = await tenantQuery(req, 
        `SELECT 
          p.id as proxy_id,
          p.name as proxy_name,
          p.type as proxy_type,
          p.host as proxy_host,
          p.port as proxy_port,
          p.username as proxy_username,
          p.password as proxy_password,
          p.location as proxy_location,
          p.status as proxy_status,
          p.last_check as proxy_last_check
        FROM whatsapp_accounts wa
        LEFT JOIN proxies p ON wa.proxy_id = p.id
        WHERE wa.id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ 
          success: false, 
          error: 'Conta não encontrada' 
        });
      }

      const account = result.rows[0];

      // Se não tem proxy configurado, retornar valores padrão
      if (!account.proxy_id) {
        return res.json({
          success: true,
          data: {
            name: '',
            enabled: false,
            type: 'socks5',
            host: '',
            port: 0,
            username: '',
            hasPassword: false,
            lastCheck: null,
            status: 'unchecked',
            location: null
          }
        });
      }

      // Não enviar senha para o frontend
      res.json({
        success: true,
        data: {
          name: account.proxy_name || '',
          enabled: true,
          type: account.proxy_type || 'socks5',
          host: account.proxy_host || '',
          port: account.proxy_port || 0,
          username: account.proxy_username || '',
          hasPassword: !!account.proxy_password,
          lastCheck: account.proxy_last_check,
          status: account.proxy_status || 'unchecked',
          location: account.proxy_location
        }
      });

    } catch (error: any) {
      console.error('Erro ao buscar configuração de proxy:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  }

  /**
   * POST /api/whatsapp-accounts/:id/proxy
   * Atualizar configuração de proxy da conta
   */
  async updateProxyConfig(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const {
        name,
        enabled,
        type,
        host,
        port,
        username,
        password
      } = req.body;

      // Validar configuração
      const validation = validateProxyConfig({
        enabled,
        type,
        host,
        port,
        username,
        password
      });

      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: 'Configuração inválida',
          errors: validation.errors
        });
      }

      // Buscar conta
      const accountResult = await tenantQuery(req, 
        'SELECT id, name FROM whatsapp_accounts WHERE id = $1',
        [id]
      );

      if (accountResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Conta não encontrada'
        });
      }

      const account = accountResult.rows[0];

      // Se habilitado, testar proxy antes de salvar
      if (enabled) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`🧪 TESTANDO PROXY ANTES DE SALVAR`);
        console.log(`👤 Conta: ${account.name} (ID: ${id})`);
        console.log(`🌐 Proxy: ${type}://${host}:${port}`);
        console.log(`${'='.repeat(60)}\n`);

        const proxyConfig: ProxyConfig = {
          enabled: true,
          type,
          host,
          port: parseInt(port),
          username,
          password
        };

        const testResult = await testProxy(proxyConfig);

        if (!testResult.success) {
          console.error(`❌ Teste de proxy falhou:`, testResult.error);
          return res.status(400).json({
            success: false,
            error: 'Proxy não está funcionando',
            details: testResult.error
          });
        }

        console.log(`✅ Proxy testado com sucesso!`);
        console.log(`📊 IP: ${testResult.ip}`);
        console.log(`📍 Localização: ${testResult.location}`);
        console.log(`⏱️ Latência: ${testResult.latency}ms\n`);

        // Verificar se a conta já tem um proxy associado
        const currentProxyResult = await tenantQuery(req, 
          'SELECT proxy_id FROM whatsapp_accounts WHERE id = $1',
          [id]
        );

        let proxyId: number;

        if (currentProxyResult.rows[0]?.proxy_id) {
          // Atualizar proxy existente
          proxyId = currentProxyResult.rows[0].proxy_id;
          await tenantQuery(req, 
            `UPDATE proxies 
            SET 
              name = $1,
              type = $2,
              host = $3,
              port = $4,
              username = $5,
              password = $6,
              location = $7,
              status = 'working',
              last_check = NOW(),
              updated_at = NOW()
            WHERE id = $8`,
            [
              name || `Proxy - ${account.name}`,
              type,
              host,
              parseInt(port),
              username || null,
              password || null,
              testResult.location,
              proxyId
            ]
          );
        } else {
          // Criar novo proxy
          const newProxyResult = await tenantQuery(req, 
            `INSERT INTO proxies (name, type, host, port, username, password, location, status, last_check)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'working', NOW())
             RETURNING id`,
            [
              name || `Proxy - ${account.name}`,
              type,
              host,
              parseInt(port),
              username || null,
              password || null,
              testResult.location
            ]
          );

          proxyId = newProxyResult.rows[0].id;

          // Associar proxy à conta
          await tenantQuery(req, 
            'UPDATE whatsapp_accounts SET proxy_id = $1 WHERE id = $2',
            [proxyId, id]
          );
        }

        res.json({
          success: true,
          message: 'Proxy configurado e testado com sucesso!',
          test: {
            ip: testResult.ip,
            location: testResult.location,
            latency: testResult.latency
          }
        });

      } else {
        // Desabilitar proxy (remover associação)
        await tenantQuery(req, 
          'UPDATE whatsapp_accounts SET proxy_id = NULL WHERE id = $1',
          [id]
        );

        console.log(`⚠️ Proxy DESABILITADO para conta: ${account.name}`);

        res.json({
          success: true,
          message: 'Proxy desabilitado com sucesso'
        });
      }

    } catch (error: any) {
      console.error('Erro ao atualizar configuração de proxy:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  }

  /**
   * POST /api/whatsapp-accounts/:id/proxy/test
   * Testar configuração de proxy (sem salvar)
   */
  async testProxyConfig(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { type, host, port, username, password } = req.body;

      // Buscar conta
      const accountResult = await tenantQuery(req, 
        'SELECT id, name FROM whatsapp_accounts WHERE id = $1',
        [id]
      );

      if (accountResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Conta não encontrada'
        });
      }

      const account = accountResult.rows[0];

      console.log(`\n${'='.repeat(60)}`);
      console.log(`🧪 TESTE DE PROXY (SEM SALVAR)`);
      console.log(`👤 Conta: ${account.name} (ID: ${id})`);
      console.log(`🌐 Proxy: ${type}://${host}:${port}`);
      console.log(`${'='.repeat(60)}\n`);

      const proxyConfig: ProxyConfig = {
        enabled: true,
        type,
        host,
        port: parseInt(port),
        username,
        password
      };

      const testResult = await testProxy(proxyConfig);

      if (!testResult.success) {
        console.error(`❌ Teste falhou:`, testResult.error);
        return res.status(400).json({
          success: false,
          error: testResult.error,
          latency: testResult.latency
        });
      }

      console.log(`✅ Teste concluído com sucesso!\n`);

      res.json({
        success: true,
        message: 'Proxy está funcionando!',
        data: {
          ip: testResult.ip,
          location: testResult.location,
          latency: testResult.latency
        }
      });

    } catch (error: any) {
      console.error('Erro ao testar proxy:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  }

  /**
   * DELETE /api/whatsapp-accounts/:id/proxy
   * Remover configuração de proxy
   */
  async deleteProxyConfig(req: Request, res: Response) {
    try {
      const { id } = req.params;

      // Remover associação de proxy da conta
      await tenantQuery(req, 
        'UPDATE whatsapp_accounts SET proxy_id = NULL WHERE id = $1',
        [id]
      );

      console.log(`🗑️ Configuração de proxy removida para conta ID: ${id}`);

      res.json({
        success: true,
        message: 'Configuração de proxy removida com sucesso'
      });

    } catch (error: any) {
      console.error('Erro ao remover configuração de proxy:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  }
}

export const proxyController = new ProxyController();

