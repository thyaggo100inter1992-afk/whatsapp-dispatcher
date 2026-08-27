import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import { getApiBaseUrl } from '@/utils/urlHelpers';
import { EMBED_TOKEN_KEY, EMBED_USER_KEY, EMBED_TENANT_KEY } from '@/utils/embed';

export default function EmbedAuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!router.isReady) return;

    const key = String(router.query.key || '').trim();
    const userId = String(router.query.user_id || '').trim();
    if (!key) {
      setError('Informe a chave de API na URL: ?key=nsk_...');
      return;
    }

    const apiBase = `${getApiBaseUrl()}/api`;

    (async () => {
      try {
        const headers: Record<string, string> = {
          'X-Api-Key': key,
          'Content-Type': 'application/json',
        };
        if (userId) {
          headers['X-Dispatcher-User-Id'] = userId;
        }

        const response = await axios.post(
          `${apiBase}/integration/v1/auth`,
          { api_key: key, user_id: userId ? Number(userId) : undefined },
          { headers }
        );

        const payload = response.data?.data;
        if (!payload?.tokens?.accessToken) {
          throw new Error('Resposta de autenticação inválida');
        }

        localStorage.setItem(EMBED_TOKEN_KEY, payload.tokens.accessToken);
        localStorage.setItem(EMBED_USER_KEY, JSON.stringify(payload.user || {}));
        localStorage.setItem(EMBED_TENANT_KEY, JSON.stringify(payload.tenant || {}));
        setReady(true);
      } catch (err: any) {
        const message =
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          'Não foi possível autenticar a chave de API';
        setError(message);
      }
    })();
  }, [router.isReady, router.query.key, router.query.user_id]);

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-900 border border-red-500/40 rounded-2xl p-6 text-center">
          <p className="text-red-300 font-semibold mb-2">Falha na integração</p>
          <p className="text-slate-300 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-emerald-500 mx-auto"></div>
          <p className="text-white mt-4">Conectando ao disparador...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
