import axios, { AxiosRequestConfig } from 'axios';
import { getProxyConfigFromAccount, applyProxyToRequest, formatProxyInfo } from './proxy.helper';

/**
 * Inscreve o App Meta na WABA da conta.
 * Sem isso, números novos (WABA nova) não disparam webhook para o mesmo App das contas antigas.
 */
export async function subscribeWhatsAppAppToWaba(opts: {
  accessToken: string;
  businessAccountId?: string | null;
  accountId?: number | null;
  accountName?: string | null;
  tenantId?: number | null;
}): Promise<{ success: boolean; message: string; already?: boolean }> {
  const wabaId = String(opts.businessAccountId || '').trim();
  const token = String(opts.accessToken || '').trim();
  if (!wabaId) {
    return {
      success: false,
      message: 'Informe o Business Account ID (WABA) para inscrever o webhook desta conta.',
    };
  }
  if (!token) {
    return { success: false, message: 'Token de acesso ausente.' };
  }

  try {
    let config: AxiosRequestConfig = {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 20000,
    };

    if (opts.accountId && opts.tenantId) {
      const proxyConfig = await getProxyConfigFromAccount(opts.accountId, opts.tenantId);
      if (proxyConfig) {
        console.log(`🌐 subscribed_apps via proxy ${formatProxyInfo(proxyConfig)} — ${opts.accountName || opts.accountId}`);
        config = applyProxyToRequest(config, proxyConfig, opts.accountName || undefined);
      }
    }

    await axios.post(
      `https://graph.facebook.com/v18.0/${encodeURIComponent(wabaId)}/subscribed_apps`,
      {},
      config
    );

    return {
      success: true,
      message: 'App inscrito na WABA. Os eventos desta conta passam a chegar no webhook.',
    };
  } catch (error: any) {
    const fb = error?.response?.data?.error;
    const code = Number(fb?.code || 0);
    const msg = String(fb?.message || error?.message || 'Falha ao inscrever o App na WABA');
    // Já inscrito / sem mudança
    if (code === 100 || /already|subscribed/i.test(msg)) {
      return { success: true, already: true, message: 'App já estava inscrito nesta WABA.' };
    }
    console.error('❌ subscribed_apps:', msg, fb || '');
    return { success: false, message: msg };
  }
}
