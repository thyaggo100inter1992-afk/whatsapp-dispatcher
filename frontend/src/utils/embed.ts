export const EMBED_TOKEN_KEY = '@WhatsAppDispatcher:embed:token';
export const EMBED_USER_KEY = '@WhatsAppDispatcher:embed:user';
export const EMBED_TENANT_KEY = '@WhatsAppDispatcher:embed:tenant';

export function isEmbedPath(pathname?: string) {
  const path = pathname || (typeof window !== 'undefined' ? window.location.pathname : '');
  return path.startsWith('/embed');
}
