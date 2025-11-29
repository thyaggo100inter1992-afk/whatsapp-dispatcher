const PROD_API_BASE = 'https://api.sistemasnettsistemas.com.br';
const DEV_API_BASE = 'http://localhost:3001';

export const getApiBaseUrl = (): string => {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;

  if (envUrl) {
    try {
      const parsed = new URL(envUrl);
      const envBase = parsed.origin;
      const isEnvLocal = ['localhost', '127.0.0.1'].includes(parsed.hostname);

      if (typeof window !== 'undefined') {
        const isBrowserHttps = window.location.protocol === 'https:';
        const isBrowserLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);

        // Se estamos em produção (host não é localhost) mas a env aponta para localhost, força o host oficial
        if (!isBrowserLocalhost && isEnvLocal) {
          return PROD_API_BASE;
        }

        if (isBrowserHttps && envBase.startsWith('http://')) {
          return envBase.replace(/^http:\/\//, 'https://');
        }
      } else if (process.env.NODE_ENV === 'production' && isEnvLocal) {
        // Build rodando em produção não deve usar localhost
        return PROD_API_BASE;
      }

      return envBase;
    } catch (error) {
      console.warn('Não foi possível interpretar NEXT_PUBLIC_API_URL', envUrl, error);
    }
  }

  if (typeof window !== 'undefined') {
    const { protocol, hostname, port } = window.location;
    const normalizedPort = port ? `:${port}` : '';
    return `${protocol}//${hostname}${normalizedPort}`;
  }

  // Fallback seguro para produção
  return process.env.NODE_ENV === 'production' ? PROD_API_BASE : DEV_API_BASE;
};

export const buildFileUrl = (path?: string | null): string | null => {
  if (!path) return null;
  const trimmed = path.trim();

  if (trimmed.startsWith('http')) {
    try {
      const url = new URL(trimmed);

      // For URLs que ainda apontam para localhost, força o host configurado na API
      if (['localhost', '127.0.0.1'].includes(url.hostname)) {
        const apiBase = getApiBaseUrl();
        const normalizedBase = apiBase.replace(/\/$/, '');
        return `${normalizedBase}${url.pathname}${url.search}${url.hash}`;
      }

      // Se a página está em HTTPS e a URL é HTTP, faz upgrade automático
      if (typeof window !== 'undefined' && window.location.protocol === 'https:' && url.protocol === 'http:') {
        url.protocol = 'https:';
        return url.toString();
      }

      return url.toString();
    } catch (error) {
      console.warn('Não foi possível normalizar URL', trimmed, error);
      // Se der erro na normalização, retorna o valor original para não quebrar renderização
      return trimmed;
    }
  }

  const baseUrl = getApiBaseUrl().replace(/\/$/, '');
  const normalizedPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;

  return `${baseUrl}${normalizedPath}`;
};
