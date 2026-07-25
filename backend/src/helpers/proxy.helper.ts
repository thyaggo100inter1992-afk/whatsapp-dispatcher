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
  // IPv4
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  // IPv6 simples (contém :)
  if (host.includes(':') && /^[0-9a-fA-F:]+$/.test(host)) return true;
  return false;
}

/**
 * Monta URL de proxy com credenciais corretamente URL-encoded.
 * Necessário para senhas/usuários com @ : # % etc (comum em proxies novos).
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
 * Cria um agent de proxy baseado na configuração.
 * Suporta host como IP OU hostname (ex: proxy22-br-hz.ipbr.pro).
 */
export function createProxyAgent(config: ProxyConfig): any {
  if (!config.enabled || !config.host || !config.port) {
    return null;
  }

  const host = config.host.trim();
  const port = Number(config.port);

  if (config.type === 'socks5') {
    // socks5h = DNS do destino resolvida pelo proxy (melhor p/ gateways com hostname)
    // socks5  = DNS local (melhor p/ IP literal)
    const preferredScheme = isIpLiteral(host) ? 'socks5' : 'socks5h';
    const proxyUrl = buildProxyUrl(preferredScheme, { ...config, host, port });
    console.log(`🌐 Criando Socks5 Proxy Agent (${preferredScheme}): ${host}:${port}`);
    try {
      return new SocksProxyAgent(proxyUrl);
    } catch (err: any) {
      // Fallback para socks5 clássico se socks5h não for aceito
      console.warn(`⚠️ Fallback para socks5://: ${err.message}`);
      return new SocksProxyAgent(buildProxyUrl('socks5', { ...config, host, port }));
    }
  }

  // HTTP ou HTTPS
  const proxyUrl = buildProxyUrl(config.type, { ...config, host, port });
  console.log(`🌐 Criando ${config.type.toUpperCase()} Proxy Agent: ${host}:${port}`);
  return new HttpsProxyAgent(proxyUrl);
}

/**
 * Testa se o proxy está funcionando.
 * Aceita host como IP ou hostname (ex: proxy22-br-hz.ipbr.pro).
 */
export async function testProxy(config: ProxyConfig): Promise<ProxyTestResult> {
  const startTime = Date.now();
  
  try {
    if (!config.enabled) {
      return {
        success: false,
        error: 'Proxy não está habilitado'
      };
    }

    if (!config.host || !config.port) {
      return {
        success: false,
        error: 'Host ou porta do proxy não configurados'
      };
    }

    const host = config.host.trim();
    const port = Number(config.port);

    // Se for hostname (não IP), validar DNS antes de tentar conectar
    if (!isIpLiteral(host)) {
      try {
        const resolved = await dnsLookup(host);
        console.log(`🔎 Hostname "${host}" resolvido para ${resolved.address}`);
      } catch (dnsErr: any) {
        console.error(`❌ DNS falhou para hostname "${host}":`, dnsErr.message);
        return {
          success: false,
          error: `Não foi possível resolver o hostname "${host}". Verifique se o domínio está correto e se o DNS do servidor consegue resolvê-lo.`,
          latency: Date.now() - startTime
        };
      }
    }

    const agent = createProxyAgent({ ...config, host, port });
    
    if (!agent) {
      return {
        success: false,
        error: 'Falha ao criar agent de proxy'
      };
    }

    console.log(`🔍 Testando proxy ${host}:${port} (tipo: ${config.type})...`);
    if (!config.username || !config.password) {
      console.warn(`⚠️ Proxy ${host}:${port} sem usuário/senha — muitos gateways (IPBR) exigem autenticação`);
    }

    // 1 endpoint rápido + 1 fallback. Timeout curto para NÃO deixar a tela girando 45s
    const testEndpoints = [
      { url: 'https://api.ipify.org?format=json', parse: (d: any) => ({ ip: d.ip, location: undefined as string | undefined }) },
      { url: 'https://ipinfo.io/json', parse: (d: any) => ({ ip: d.ip, location: [d.city, d.region, d.country].filter(Boolean).join(', ') }) },
    ];

    const tryWithAgent = async (testAgent: any, label: string): Promise<ProxyTestResult | null> => {
      let lastError = 'Erro desconhecido';
      for (const endpoint of testEndpoints) {
        try {
          const response = await axios.get(endpoint.url, {
            httpsAgent: testAgent,
            httpAgent: testAgent,
            timeout: 8000, // 8s — falha rápido
            headers: { 'User-Agent': 'WhatsApp-Dispatcher/1.0' },
            proxy: false,
          });
          const parsed = endpoint.parse(response.data);
          if (!parsed.ip) {
            lastError = `Resposta inválida de ${endpoint.url}`;
            continue;
          }
          const latency = Date.now() - startTime;
          console.log(`✅ Proxy funcionando via ${label}! IP: ${parsed.ip}, Latência: ${latency}ms`);
          return { success: true, ip: parsed.ip, location: parsed.location, latency };
        } catch (err: any) {
          lastError = err.message || String(err);
          console.warn(`⚠️ [${label}] Falha em ${endpoint.url}: ${lastError}`);
        }
      }
      return { success: false, error: lastError, latency: Date.now() - startTime };
    };

    // Tentativa 1: tipo configurado (socks5/http)
    let result = await tryWithAgent(agent, config.type);
    if (result?.success) return result;

    // Tentativa 2: se SOCKS5 falhou, tentar HTTP (provedores trocam o protocolo no novo formato)
    if (config.type === 'socks5') {
      console.log(`🔄 SOCKS5 falhou — tentando HTTP no mesmo host:porta...`);
      try {
        const httpAgent = createProxyAgent({ ...config, host, port, type: 'http' });
        if (httpAgent) {
          const httpResult = await tryWithAgent(httpAgent, 'http');
          if (httpResult?.success) {
            return {
              ...httpResult,
              // Aviso embutido no location para o usuário perceber que o tipo correto é HTTP
              location: httpResult.location
                ? `${httpResult.location} (conectou via HTTP — considere mudar o tipo)`
                : 'Conectou via HTTP — considere mudar o tipo do proxy para HTTP',
            };
          }
          if (httpResult?.error) result = httpResult;
        }
      } catch (e: any) {
        console.warn(`⚠️ Fallback HTTP também falhou: ${e.message}`);
      }
    }

    const latency = Date.now() - startTime;
    let lastError = result?.error || 'Erro desconhecido ao testar proxy';
    let friendly = lastError;
    if (/ECONNREFUSED/i.test(lastError)) {
      friendly = `Conexão recusada em ${host}:${port}. Verifique host/porta ou protocolo (SOCKS5 vs HTTP).`;
    } else if (/ETIMEDOUT|timeout|Proxy connection timed out/i.test(lastError)) {
      friendly = `Timeout em ${host}:${port}. Possíveis causas: usuário/senha incorretos, protocolo errado (tente HTTP) ou proxy offline.`;
    } else if (/ENOTFOUND/i.test(lastError)) {
      friendly = `Hostname "${host}" não encontrado (DNS).`;
    } else if (/authentication|auth|username|password|SOCKS/i.test(lastError)) {
      friendly = `Falha de autenticação. Verifique usuário e senha. Detalhe: ${lastError}`;
    }
    if (!config.username || !config.password) {
      friendly += ' Atenção: este proxy está SEM usuário/senha cadastrados.';
    }

    console.error(`❌ Erro ao testar proxy ${host}:${port}:`, friendly);
    return {
      success: false,
      error: friendly,
      latency
    };

  } catch (error: any) {
    const latency = Date.now() - startTime;
    console.error(`❌ Erro ao testar proxy:`, error.message);
    
    return {
      success: false,
      error: error.message || 'Erro desconhecido ao testar proxy',
      latency
    };
  }
}

/**
 * Aplica configuração de proxy em uma requisição Axios.
 * Se o proxy falhar (status = 'failed' ou agent não puder ser criado),
 * faz fallback automático para conexão direta sem proxy.
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

  // ⚠️ FALLBACK: Se o proxy está marcado como 'failed', usa conexão direta
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
    proxy: false // Desabilita proxy automático do Axios (usamos agent)
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
    errors
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
export function parseProxyString(raw: string): {
  type?: 'socks5' | 'http' | 'https';
  host?: string;
  port?: number;
  username?: string;
  password?: string;
} | null {
  if (!raw || typeof raw !== 'string') return null;

  let value = raw.trim();
  if (!value) return null;

  let type: 'socks5' | 'http' | 'https' | undefined;

  // Remover esquema se presente
  const schemeMatch = value.match(/^(socks5h?|https?):\/\//i);
  if (schemeMatch) {
    const scheme = schemeMatch[1].toLowerCase();
    type = scheme.startsWith('socks') ? 'socks5' : (scheme as 'http' | 'https');
    value = value.replace(/^[a-z0-9]+:\/\//i, '');
  }

  // Formato: user:pass@host:port
  if (value.includes('@')) {
    const atIdx = value.lastIndexOf('@');
    const creds = value.slice(0, atIdx);
    const hostPort = value.slice(atIdx + 1);
    const [username, ...passParts] = creds.split(':');
    const password = passParts.join(':');
    const lastColon = hostPort.lastIndexOf(':');
    if (lastColon === -1) return null;
    const host = hostPort.slice(0, lastColon).trim();
    const port = parseInt(hostPort.slice(lastColon + 1), 10);
    if (!host || !port) return null;
    return { type, host, port, username, password };
  }

  const parts = value.split(':');

  // host:port
  if (parts.length === 2) {
    const host = parts[0].trim();
    const port = parseInt(parts[1], 10);
    if (!host || !port) return null;
    return { type, host, port };
  }

  // host:port:user:pass  OU  user:pass:host:port
  if (parts.length >= 4) {
    const p0 = parts[0].trim();
    const p1 = parts[1].trim();
    const p2 = parts[2].trim();
    const p3 = parts.slice(3).join(':').trim();

    // Se parts[1] é porta numérica → host:port:user:pass
    if (/^\d+$/.test(p1) && !/^\d+$/.test(p0)) {
      return {
        type,
        host: p0,
        port: parseInt(p1, 10),
        username: p2,
        password: p3,
      };
    }

    // Se parts[3] é porta → user:pass:host:port
    if (/^\d+$/.test(p3) && !/^\d+$/.test(p0)) {
      return {
        type,
        username: p0,
        password: p1,
        host: p2,
        port: parseInt(p3, 10),
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
 * @param accountId ID da conta WhatsApp
 * @param tenantId (Opcional) ID do tenant para garantir isolamento
 */
export async function getProxyConfigFromAccount(
  accountId: string | number, 
  tenantId?: number | null
): Promise<ProxyConfig | null> {
  try {
    // Import dinâmico para evitar dependência circular
    const { query } = await import('../database/connection');
    
    // 🔒 SEGURANÇA: Adicionar filtro de tenant_id quando fornecido
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

    // Verificar se tem dados essenciais
    if (!row.host || !row.port) {
      return null;
    }

    // ⚠️ Se o proxy está marcado como 'failed', retorna config com status para acionar fallback
    if (row.status === 'failed') {
      console.warn(`⚠️ [ProxyHelper] Proxy "${row.proxy_name}" está com status FAILED para conta ${accountId}. Fallback para conexão direta será ativado.`);
    }

    return {
      enabled: true,
      type: row.type || 'socks5',
      host: row.host,
      port: row.port,
      username: row.username,
      password: row.password,
      status: row.status || 'unchecked',
      proxyName: row.proxy_name
    };
  } catch (error) {
    console.error('Erro ao buscar configuração de proxy:', error);
    return null;
  }
}

