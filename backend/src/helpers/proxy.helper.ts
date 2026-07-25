import { SocksProxyAgent } from 'socks-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';
import axios, { AxiosRequestConfig } from 'axios';
import dns from 'dns';
import { promisify } from 'util';

const dnsLookup = promisify(dns.lookup);

export interface ProxyConfig {
  enabled: boolean;
  type: 'socks5' | 'http' | 'https';
  host: string;
  port: number;
  username?: string;
  password?: string;
  status?: string; // 'working' | 'failed' | 'unchecked'
  proxyName?: string; // Nome do proxy para logs
}

export interface ProxyTestResult {
  success: boolean;
  ip?: string;
  location?: string;
  latency?: number;
  error?: string;
}

/** Detecta se o host é um IP literal (IPv4/IPv6) ou um hostname/domínio */
function isIpLiteral(host: string): boolean {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  if (host.includes(':') && /^[0-9a-fA-F:]+$/.test(host)) return true;
  return false;
}

/** DNS com timeout — evita travar a request */
async function resolveHostWithTimeout(host: string, timeoutMs = 3000): Promise<string> {
  if (isIpLiteral(host)) return host;

  const lookupPromise = dnsLookup(host).then((r) => r.address);
  const timeoutPromise = new Promise<string>((_, reject) =>
    setTimeout(() => reject(new Error(`DNS timeout ao resolver "${host}"`)), timeoutMs)
  );

  return Promise.race([lookupPromise, timeoutPromise]);
}

/**
 * Resolve hostname → IP (novo formato IPBR usa domínio).
 * Proxies com IP direto funcionam melhor no socks-proxy-agent.
 */
export async function resolveProxyConfig(config: ProxyConfig): Promise<ProxyConfig> {
  const host = (config.host || '').trim();
  if (!host || isIpLiteral(host)) {
    return { ...config, host };
  }

  try {
    const ip = await resolveHostWithTimeout(host);
    console.log(`🔎 Proxy hostname "${host}" resolvido para ${ip}`);
    return { ...config, host: ip };
  } catch (err: any) {
    console.warn(`⚠️ Não foi possível resolver "${host}": ${err.message}. Usando hostname.`);
    return { ...config, host };
  }
}

/**
 * Monta URL de proxy com credenciais corretamente URL-encoded.
 */
function buildProxyUrl(scheme: string, config: ProxyConfig): string {
  const host = config.host.trim();
  const port = Number(config.port);

  if (config.username && config.password) {
    const user = encodeURIComponent(config.username);
    const pass = encodeURIComponent(config.password);
    return `${scheme}://${user}:${pass}@${host}:${port}`;
  }

  return `${scheme}://${host}:${port}`;
}

/**
 * Cria um agent de proxy.
 * Prefira passar host já resolvido (IP) — funciona igual aos proxies antigos.
 */
export function createProxyAgent(config: ProxyConfig, socketTimeoutMs = 8000): any {
  if (!config.enabled || !config.host || !config.port) {
    return null;
  }

  const host = config.host.trim();
  const port = Number(config.port);
  const agentOpts = { timeout: socketTimeoutMs, keepAlive: false };

  if (config.type === 'socks5') {
    // Com IP: socks5. Com hostname: socks5h (DNS remota do destino)
    const scheme = isIpLiteral(host) ? 'socks5' : 'socks5h';
    const proxyUrl = buildProxyUrl(scheme, { ...config, host, port });
    console.log(`🌐 Criando Socks5 Proxy Agent (${scheme}): ${host}:${port}`);
    return new SocksProxyAgent(proxyUrl, agentOpts);
  }

  const proxyUrl = buildProxyUrl(config.type, { ...config, host, port });
  console.log(`🌐 Criando ${config.type.toUpperCase()} Proxy Agent: ${host}:${port}`);
  return new HttpsProxyAgent(proxyUrl, agentOpts);
}

/**
 * Testa se o proxy está funcionando.
 * HARD TIMEOUT 12s — o agent SOCKS às vezes ignora o timeout do Axios.
 */
export async function testProxy(config: ProxyConfig): Promise<ProxyTestResult> {
  const startTime = Date.now();
  const HARD_TIMEOUT_MS = 12000;

  const work = async (): Promise<ProxyTestResult> => {
    if (!config.enabled) {
      return { success: false, error: 'Proxy não está habilitado' };
    }

    if (!config.host || !config.port) {
      return { success: false, error: 'Host ou porta do proxy não configurados' };
    }

    const originalHost = config.host.trim();
    const port = Number(config.port);

    let connectHost = originalHost;
    try {
      connectHost = await resolveHostWithTimeout(originalHost, 2500);
      if (connectHost !== originalHost) {
        console.log(`🔎 Hostname "${originalHost}" → IP ${connectHost}`);
      }
    } catch (dnsErr: any) {
      return {
        success: false,
        error: `Não foi possível resolver o hostname "${originalHost}". ${dnsErr.message}`,
        latency: Date.now() - startTime,
      };
    }

    const hasAuth = !!(config.username && config.password);
    if (!hasAuth) {
      console.warn(`⚠️ Proxy ${originalHost}:${port} SEM usuário/senha`);
    }

    // Teste TCP rápido na porta (3s) — se a porta não abre, falha imediata
    try {
      const net = await import('net');
      await new Promise<void>((resolve, reject) => {
        const socket = net.createConnection({ host: connectHost, port, timeout: 3000 });
        socket.once('connect', () => {
          socket.destroy();
          resolve();
        });
        socket.once('timeout', () => {
          socket.destroy();
          reject(new Error(`Porta ${port} sem resposta em ${connectHost}`));
        });
        socket.once('error', (err) => {
          socket.destroy();
          reject(err);
        });
      });
      console.log(`✅ TCP OK em ${connectHost}:${port}`);
    } catch (tcpErr: any) {
      return {
        success: false,
        error: `Host alcançável via DNS, mas a porta ${port} não responde (${tcpErr.message}). Confira host/porta com o provedor.`,
        latency: Date.now() - startTime,
      };
    }

    const runOnce = async (
      type: 'socks5' | 'http' | 'https',
      hostToUse: string
    ): Promise<ProxyTestResult> => {
      const agent = createProxyAgent(
        { ...config, enabled: true, type, host: hostToUse, port },
        5000
      );

      if (!agent) {
        return { success: false, error: 'Falha ao criar agent de proxy', latency: Date.now() - startTime };
      }

      console.log(`🔍 Testando ${type}://${hostToUse}:${port} (cadastro: ${originalHost}, auth=${hasAuth})...`);

      try {
        const response = await axios.get('https://api.ipify.org?format=json', {
          httpsAgent: agent,
          httpAgent: agent,
          timeout: 5000,
          headers: { 'User-Agent': 'WhatsApp-Dispatcher/1.0' },
          proxy: false,
          transitional: { clarifyTimeoutError: true },
        });

        const ip = response.data?.ip;
        if (!ip) {
          return { success: false, error: 'Resposta inválida do teste de IP', latency: Date.now() - startTime };
        }

        const latency = Date.now() - startTime;
        console.log(`✅ Proxy OK via ${type}! IP saída: ${ip}, latência: ${latency}ms`);
        return { success: true, ip, location: undefined, latency };
      } catch (err: any) {
        const msg = err.message || String(err);
        console.warn(`⚠️ Falha ${type}://${hostToUse}:${port}: ${msg}`);
        return { success: false, error: msg, latency: Date.now() - startTime };
      }
    };

    // 1) Tipo cadastrado
    let result = await runOnce(config.type || 'socks5', connectHost);
    if (result.success) return result;

    // 2) Fallback HTTP se era SOCKS5
    if ((config.type || 'socks5') === 'socks5') {
      console.log('🔄 SOCKS5 falhou — tentando HTTP...');
      const httpResult = await runOnce('http', connectHost);
      if (httpResult.success) {
        return {
          ...httpResult,
          location: 'Conectou via HTTP — mude o tipo do proxy para HTTP',
        };
      }
      result = httpResult;
    }

    let friendly = result.error || 'Erro desconhecido';
    if (/ECONNREFUSED/i.test(friendly)) {
      friendly = `Conexão recusada em ${originalHost}:${port} (${connectHost}). Verifique porta/protocolo.`;
    } else if (/ETIMEDOUT|timeout|Proxy connection timed out/i.test(friendly)) {
      friendly = `Timeout em ${originalHost}:${port}. Usuário/senha incorretos, tipo errado (SOCKS5/HTTP) ou proxy offline.`;
    } else if (/authentication|auth|SOCKS/i.test(friendly)) {
      friendly = `Falha de autenticação em ${originalHost}:${port}. Confira usuário e senha.`;
    }
    if (!hasAuth) {
      friendly += ' Atenção: proxy SEM usuário/senha cadastrados.';
    }

    console.error(`❌ Erro ao testar proxy ${originalHost}:${port}:`, friendly);
    return { success: false, error: friendly, latency: Date.now() - startTime };
  };

  try {
    // Garante resposta mesmo se o agent SOCKS travar ignorando timeout do Axios
    return await Promise.race([
      work(),
      new Promise<ProxyTestResult>((resolve) =>
        setTimeout(
          () =>
            resolve({
              success: false,
              error: `Timeout em ${config.host}:${config.port}. Verifique usuário/senha e se o tipo é SOCKS5 ou HTTP.`,
              latency: Date.now() - startTime,
            }),
          HARD_TIMEOUT_MS
        )
      ),
    ]);
  } catch (error: any) {
    console.error('❌ Erro ao testar proxy:', error.message);
    return {
      success: false,
      error: error.message || 'Erro desconhecido ao testar proxy',
      latency: Date.now() - startTime,
    };
  }
}

/**
 * Aplica configuração de proxy em uma requisição Axios.
 */
export function applyProxyToRequest(
  requestConfig: AxiosRequestConfig,
  proxyConfig: ProxyConfig,
  accountName: string
): AxiosRequestConfig {
  if (!proxyConfig.enabled) {
    console.log(`📡 Requisição SEM proxy para conta: ${accountName}`);
    return requestConfig;
  }

  if (proxyConfig.status === 'failed') {
    console.warn(
      `⚠️ [FALLBACK] Proxy "${proxyConfig.proxyName || proxyConfig.host + ':' + proxyConfig.port}" está com FALHA. ` +
        `Conta "${accountName}" operando em modo DIRETO (sem proxy) automaticamente.`
    );
    return requestConfig;
  }

  let agent: any;
  try {
    agent = createProxyAgent(proxyConfig);
  } catch (err: any) {
    console.warn(
      `⚠️ [FALLBACK] Erro ao criar agent de proxy para conta "${accountName}": ${err.message}. ` +
        `Operando em modo DIRETO (sem proxy).`
    );
    return requestConfig;
  }

  if (!agent) {
    console.warn(
      `⚠️ [FALLBACK] Proxy configurado mas agent não pôde ser criado para conta "${accountName}". ` +
        `Operando em modo DIRETO (sem proxy).`
    );
    return requestConfig;
  }

  console.log(`🌐 Requisição via PROXY ${proxyConfig.host}:${proxyConfig.port} para conta: ${accountName}`);

  return {
    ...requestConfig,
    httpsAgent: agent,
    httpAgent: agent,
    proxy: false,
  };
}

/**
 * Valida configuração de proxy (aceita IP ou hostname/domínio)
 */
export function validateProxyConfig(config: Partial<ProxyConfig>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (config.enabled) {
    const host = (config.host || '').trim();

    if (!host) {
      errors.push('Host do proxy é obrigatório');
    } else if (host.includes('://')) {
      errors.push('Host não deve incluir protocolo (ex: socks5://). Use apenas o domínio ou IP');
    } else if (/\s/.test(host)) {
      errors.push('Host não pode conter espaços');
    }

    if (!config.port || config.port < 1 || config.port > 65535) {
      errors.push('Porta do proxy deve estar entre 1 e 65535');
    }

    if (!config.type || !['socks5', 'http', 'https'].includes(config.type)) {
      errors.push('Tipo de proxy deve ser: socks5, http ou https');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Parseia string de proxy nos formatos comuns dos provedores:
 * - host:port
 * - host:port:user:pass
 * - user:pass@host:port
 * - socks5://user:pass@host:port
 * - user:pass:host:port
 */
function inferIpbrType(port: number): 'socks5' | 'http' | undefined {
  if (port === 10001) return 'http';
  if (port === 10000) return 'socks5';
  return undefined;
}

function cleanHost(host: string): string {
  return host
    .trim()
    .replace(/^:+|:+$/g, '')
    .replace(/\.ipbr\.prox$/i, '.ipbr.pro')
    .replace(/\.ipbr\.pr$/i, '.ipbr.pro');
}

export function parseProxyString(raw: string): {
  type?: 'socks5' | 'http' | 'https';
  host?: string;
  port?: number;
  username?: string;
  password?: string;
} | null {
  if (!raw || typeof raw !== 'string') return null;

  let value = raw
    .replace(/https?\s*proxy\s*:?/gi, '')
    .replace(/socks5?\s*proxy\s*:?/gi, '')
    .replace(/\s+/g, '')
    .trim();
  if (!value) return null;

  let type: 'socks5' | 'http' | 'https' | undefined;

  const schemeMatch = value.match(/^(socks5h?|https?):\/\//i);
  if (schemeMatch) {
    const scheme = schemeMatch[1].toLowerCase();
    type = scheme.startsWith('socks') ? 'socks5' : (scheme as 'http' | 'https');
    value = value.replace(/^[a-z0-9]+:\/\//i, '');
  }

  if (value.includes('@')) {
    const atIdx = value.lastIndexOf('@');
    const creds = value.slice(0, atIdx);
    const hostPort = value.slice(atIdx + 1);
    const [username, ...passParts] = creds.split(':');
    const password = passParts.join(':');
    const lastColon = hostPort.lastIndexOf(':');
    if (lastColon === -1) return null;
    const host = cleanHost(hostPort.slice(0, lastColon));
    const port = parseInt(hostPort.slice(lastColon + 1), 10);
    if (!host || !port) return null;
    return { type: type || inferIpbrType(port), host, port, username, password };
  }

  // Filtrar partes vazias evita host:::porta virar lixo
  const parts = value.split(':').filter((p) => p.length > 0);

  if (parts.length === 2) {
    const host = cleanHost(parts[0]);
    const port = parseInt(parts[1], 10);
    if (!host || !port) return null;
    return { type: type || inferIpbrType(port), host, port };
  }

  if (parts.length >= 4) {
    const p0 = parts[0].trim();
    const p1 = parts[1].trim();
    const p2 = parts[2].trim();
    const p3 = parts.slice(3).join(':').trim();

    // host:port:user:pass (formato IPBR)
    if (/^\d+$/.test(p1) && !/^\d+$/.test(p0)) {
      const port = parseInt(p1, 10);
      return {
        type: type || inferIpbrType(port),
        host: cleanHost(p0),
        port,
        username: p2,
        password: p3,
      };
    }

    // user:pass:host:port
    if (/^\d+$/.test(p3) && !/^\d+$/.test(p0)) {
      const port = parseInt(p3, 10);
      return {
        type: type || inferIpbrType(port),
        username: p0,
        password: p1,
        host: cleanHost(p2),
        port,
      };
    }
  }

  return null;
}

/**
 * Formata informações do proxy para log
 */
export function formatProxyInfo(config: ProxyConfig): string {
  if (!config.enabled) {
    return '❌ SEM PROXY';
  }

  const auth = config.username ? ' (autenticado)' : '';
  return `✅ ${config.type.toUpperCase()} ${config.host}:${config.port}${auth}`;
}

/**
 * Busca configuração de proxy da conta no banco de dados
 */
export async function getProxyConfigFromAccount(
  accountId: string | number,
  tenantId?: number | null
): Promise<ProxyConfig | null> {
  try {
    const { query } = await import('../database/connection');

    let queryText = `SELECT 
        p.type,
        p.host,
        p.port,
        p.username,
        p.password,
        p.status,
        p.name AS proxy_name
      FROM whatsapp_accounts wa
      LEFT JOIN proxies p ON wa.proxy_id = p.id
      WHERE wa.id = $1 AND p.id IS NOT NULL`;

    const params: any[] = [accountId];

    if (tenantId !== undefined && tenantId !== null) {
      queryText += ` AND wa.tenant_id = $2`;
      params.push(tenantId);
    }

    const result = await query(queryText, params);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];

    if (!row.host || !row.port) {
      return null;
    }

    if (row.status === 'failed') {
      console.warn(
        `⚠️ [ProxyHelper] Proxy "${row.proxy_name}" está com status FAILED para conta ${accountId}. Fallback para conexão direta será ativado.`
      );
    }

    const config: ProxyConfig = {
      enabled: true,
      type: row.type || 'socks5',
      host: row.host,
      port: row.port,
      username: row.username,
      password: row.password,
      status: row.status || 'unchecked',
      proxyName: row.proxy_name,
    };

    // Resolver hostname → IP para uso em produção (compatível com novo formato IPBR)
    return await resolveProxyConfig(config);
  } catch (error) {
    console.error('Erro ao buscar configuração de proxy:', error);
    return null;
  }
}
