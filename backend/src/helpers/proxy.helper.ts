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
 * Normaliza config do proxy.
 * Mantém hostname (não resolve para IP): IPBR exige socks5h + domínio;
 * resolver para IP quebra a saída IPv6 (HostUnreachable em destinos IPv4).
 */
export async function resolveProxyConfig(config: ProxyConfig): Promise<ProxyConfig> {
  return { ...config, host: (config.host || '').trim() };
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
 * SOCKS sempre usa socks5h (DNS do destino no proxy) — necessário para
 * gateways IPBR com saída IPv6; também funciona com proxies IP antigos.
 */
export function createProxyAgent(config: ProxyConfig, socketTimeoutMs = 8000): any {
  if (!config.enabled || !config.host || !config.port) {
    return null;
  }

  const host = config.host.trim();
  const port = Number(config.port);
  const agentOpts = { timeout: socketTimeoutMs, keepAlive: false };

  if (config.type === 'socks5') {
    const proxyUrl = buildProxyUrl('socks5h', { ...config, host, port });
    console.log(`🌐 Criando Socks5 Proxy Agent (socks5h): ${host}:${port}`);
    return new SocksProxyAgent(proxyUrl, agentOpts);
  }

  const proxyUrl = buildProxyUrl(config.type, { ...config, host, port });
  console.log(`🌐 Criando ${config.type.toUpperCase()} Proxy Agent: ${host}:${port}`);
  return new HttpsProxyAgent(proxyUrl, agentOpts);
}

/** Endpoints de teste — api64/icanhazip suportam saída IPv6 do IPBR; api.ipify (IPv4) costuma falhar. */
const PROXY_TEST_ENDPOINTS: Array<{
  url: string;
  parse: (data: any) => string | undefined;
}> = [
  {
    url: 'https://api64.ipify.org?format=json',
    parse: (d) => (typeof d?.ip === 'string' ? d.ip : undefined),
  },
  {
    url: 'https://icanhazip.com',
    parse: (d) => {
      const t = (typeof d === 'string' ? d : String(d ?? '')).trim();
      return t || undefined;
    },
  },
  {
    url: 'https://ifconfig.co/ip',
    parse: (d) => {
      const t = (typeof d === 'string' ? d : String(d ?? '')).trim();
      return t || undefined;
    },
  },
];

/**
 * Testa se o proxy está funcionando.
 * HARD TIMEOUT 15s — o agent SOCKS às vezes ignora o timeout do Axios.
 */
export async function testProxy(config: ProxyConfig): Promise<ProxyTestResult> {
  const startTime = Date.now();
  const HARD_TIMEOUT_MS = 15000;

  const work = async (): Promise<ProxyTestResult> => {
    if (!config.enabled) {
      return { success: false, error: 'Proxy não está habilitado' };
    }

    if (!config.host || !config.port) {
      return { success: false, error: 'Host ou porta do proxy não configurados' };
    }

    const originalHost = config.host.trim();
    const port = Number(config.port);

    // DNS só para validar que o host existe e para o check TCP
    let resolvedIp = originalHost;
    try {
      resolvedIp = await resolveHostWithTimeout(originalHost, 2500);
      if (resolvedIp !== originalHost) {
        console.log(`🔎 Hostname "${originalHost}" → IP ${resolvedIp}`);
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
        const socket = net.createConnection({ host: resolvedIp, port, timeout: 3000 });
        socket.once('connect', () => {
          socket.destroy();
          resolve();
        });
        socket.once('timeout', () => {
          socket.destroy();
          reject(new Error(`Porta ${port} sem resposta em ${resolvedIp}`));
        });
        socket.once('error', (err) => {
          socket.destroy();
          reject(err);
        });
      });
      console.log(`✅ TCP OK em ${resolvedIp}:${port}`);
    } catch (tcpErr: any) {
      return {
        success: false,
        error: `Host alcançável via DNS, mas a porta ${port} não responde (${tcpErr.message}). Confira host/porta com o provedor.`,
        latency: Date.now() - startTime,
      };
    }

    // Agent usa o hostname original (socks5h) — NÃO o IP resolvido
    const agentHost = originalHost;

    const runOnce = async (
      type: 'socks5' | 'http' | 'https',
      hostToUse: string,
      portToUse: number
    ): Promise<ProxyTestResult> => {
      const agent = createProxyAgent(
        { ...config, enabled: true, type, host: hostToUse, port: portToUse },
        8000
      );

      if (!agent) {
        return { success: false, error: 'Falha ao criar agent de proxy', latency: Date.now() - startTime };
      }

      console.log(`🔍 Testando ${type}://${hostToUse}:${portToUse} (auth=${hasAuth})...`);

      let lastError = 'Falha no teste do proxy';
      for (const endpoint of PROXY_TEST_ENDPOINTS) {
        try {
          const response = await axios.get(endpoint.url, {
            httpsAgent: agent,
            httpAgent: agent,
            timeout: 8000,
            headers: { 'User-Agent': 'WhatsApp-Dispatcher/1.0' },
            proxy: false,
            transitional: { clarifyTimeoutError: true },
            responseType: endpoint.url.includes('format=json') ? 'json' : 'text',
          });

          const ip = endpoint.parse(response.data);
          if (!ip) {
            lastError = `Resposta inválida de ${endpoint.url}`;
            continue;
          }

          const latency = Date.now() - startTime;
          console.log(`✅ Proxy OK via ${type}! IP saída: ${ip}, latência: ${latency}ms (${endpoint.url})`);
          return { success: true, ip, location: undefined, latency };
        } catch (err: any) {
          lastError = err.message || String(err);
          console.warn(`⚠️ Falha ${type}://${hostToUse}:${portToUse} → ${endpoint.url}: ${lastError}`);
        }
      }

      return { success: false, error: lastError, latency: Date.now() - startTime };
    };

    // 1) Tipo cadastrado no hostname (socks5h)
    let result = await runOnce(config.type || 'socks5', agentHost, port);
    if (result.success) return result;
    const socksError = result.error;

    // 2) Fallback HTTP na porta 10001 (padrão IPBR) se SOCKS estava em 10000
    if ((config.type || 'socks5') === 'socks5') {
      const httpPort = port === 10000 ? 10001 : port;
      console.log(`🔄 SOCKS5 falhou — tentando HTTP :${httpPort}...`);
      const httpResult = await runOnce('http', agentHost, httpPort);
      if (httpResult.success) {
        return {
          ...httpResult,
          location:
            httpPort !== port
              ? `Conectou via HTTP porta ${httpPort} — cadastre tipo HTTP e porta ${httpPort}`
              : 'Conectou via HTTP — mude o tipo do proxy para HTTP',
        };
      }
      // Preferir erro SOCKS real (HostUnreachable etc.) em vez do ruído CONNECT do HTTP
      result = { ...result, error: socksError || httpResult.error };
    }

    let friendly = result.error || 'Erro desconhecido';
    if (/HostUnreachable/i.test(friendly)) {
      friendly = `Proxy rejeitou o destino (HostUnreachable) em ${originalHost}:${port}. Confira usuário/senha e se o tipo é SOCKS5 porta 10000.`;
    } else if (/ECONNREFUSED/i.test(friendly)) {
      friendly = `Conexão recusada em ${originalHost}:${port}. Verifique porta/protocolo.`;
    } else if (/ETIMEDOUT|timeout|Proxy connection timed out/i.test(friendly)) {
      friendly = `Timeout em ${originalHost}:${port}. Usuário/senha incorretos, tipo errado (SOCKS5/HTTP) ou proxy offline.`;
    } else if (/authentication|NotAllowed|SOCKS.*auth/i.test(friendly)) {
      friendly = `Falha de autenticação em ${originalHost}:${port}. Confira usuário e senha.`;
    } else if (/CONNECT response/i.test(friendly)) {
      friendly = `Porta ${port} não é HTTP. Para IPBR use SOCKS5 porta 10000 (ou HTTP porta 10001).`;
    }
    if (!hasAuth) {
      friendly += ' Atenção: proxy SEM usuário/senha cadastrados.';
    }

    console.error(`❌ Erro ao testar proxy ${originalHost}:${port}:`, friendly);
    return { success: false, error: friendly, latency: Date.now() - startTime };
  };

  try {
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
