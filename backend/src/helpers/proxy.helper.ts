import { SocksProxyAgent } from 'socks-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';
import axios, { AxiosRequestConfig } from 'axios';

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

/**
 * Cria um agent de proxy baseado na configuração
 */
export function createProxyAgent(config: ProxyConfig): any {
  if (!config.enabled || !config.host || !config.port) {
    return null;
  }

  const auth = config.username && config.password 
    ? `${config.username}:${config.password}@` 
    : '';

  if (config.type === 'socks5') {
    const proxyUrl = `socks5://${auth}${config.host}:${config.port}`;
    console.log(`🌐 Criando Socks5 Proxy Agent: ${config.host}:${config.port}`);
    return new SocksProxyAgent(proxyUrl);
  } else {
    // HTTP ou HTTPS
    const proxyUrl = `${config.type}://${auth}${config.host}:${config.port}`;
    console.log(`🌐 Criando ${config.type.toUpperCase()} Proxy Agent: ${config.host}:${config.port}`);
    return new HttpsProxyAgent(proxyUrl);
  }
}

/**
 * Testa se o proxy está funcionando
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

    const agent = createProxyAgent(config);
    
    if (!agent) {
      return {
        success: false,
        error: 'Falha ao criar agent de proxy'
      };
    }

    console.log(`🔍 Testando proxy ${config.host}:${config.port}...`);

    // Testar através de ipinfo.io
    const response = await axios.get('https://ipinfo.io/json', {
      httpsAgent: agent,
      httpAgent: agent,
      timeout: 15000, // 15 segundos
      headers: {
        'User-Agent': 'WhatsApp-Dispatcher/1.0'
      }
    });

    const latency = Date.now() - startTime;
    const data = response.data;

    const result: ProxyTestResult = {
      success: true,
      ip: data.ip,
      location: `${data.city}, ${data.region}, ${data.country}`,
      latency
    };

    console.log(`✅ Proxy funcionando! IP: ${result.ip}, Localização: ${result.location}, Latência: ${result.latency}ms`);

    return result;

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
 * Valida configuração de proxy
 */
export function validateProxyConfig(config: Partial<ProxyConfig>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (config.enabled) {
    if (!config.host || config.host.trim() === '') {
      errors.push('Host do proxy é obrigatório');
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

