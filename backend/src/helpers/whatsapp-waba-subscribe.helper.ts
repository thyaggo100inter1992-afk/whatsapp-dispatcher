import axios, { AxiosRequestConfig } from 'axios';
import { pool } from '../database/connection';
import { getProxyConfigFromAccount, applyProxyToRequest, formatProxyInfo } from './proxy.helper';

async function withProxyConfig(
  base: AxiosRequestConfig,
  opts: { accountId?: number | null; accountName?: string | null; tenantId?: number | null }
) {
  let config = { ...base };
  if (opts.accountId && opts.tenantId) {
    const proxyConfig = await getProxyConfigFromAccount(opts.accountId, opts.tenantId);
    if (proxyConfig) {
      console.log(`🌐 subscribed_apps via proxy ${formatProxyInfo(proxyConfig)} — ${opts.accountName || opts.accountId}`);
      config = applyProxyToRequest(config, proxyConfig, opts.accountName || undefined);
    }
  }
  return config;
}

/** Descobre o ID da WABA quando o cadastro não trouxe business_account_id. */
export async function resolveWhatsAppWabaId(opts: {
  accessToken: string;
  phoneNumberId?: string | null;
  businessAccountId?: string | null;
  accountId?: number | null;
  accountName?: string | null;
  tenantId?: number | null;
}): Promise<string> {
  const fromBody = String(opts.businessAccountId || '').trim();
  if (fromBody) return fromBody;

  const token = String(opts.accessToken || '').trim();
  const phoneNumberId = String(opts.phoneNumberId || '').trim();
  if (!token || !phoneNumberId) return '';

  try {
    const config = await withProxyConfig(
      {
        params: { fields: 'whatsapp_business_account{id},id' },
        headers: { Authorization: `Bearer ${token}` },
        timeout: 20000,
      },
      opts
    );
    const response = await axios.get(
      `https://graph.facebook.com/v18.0/${encodeURIComponent(phoneNumberId)}`,
      config
    );
    const waba =
      response.data?.whatsapp_business_account?.id ||
      response.data?.whatsapp_business_account ||
      '';
    return String(waba || '').trim();
  } catch (error: any) {
    console.warn('⚠️ Não consegui descobrir a WABA pelo phone_number_id:', error?.response?.data || error?.message);
    return '';
  }
}

/**
 * Inscreve o App Meta na WABA da conta.
 * Sem isso, números novos (WABA nova) não disparam webhook para o mesmo App das contas antigas.
 */
export async function subscribeWhatsAppAppToWaba(opts: {
  accessToken: string;
  businessAccountId?: string | null;
  phoneNumberId?: string | null;
  accountId?: number | null;
  accountName?: string | null;
  tenantId?: number | null;
  persistWaba?: boolean;
}): Promise<{ success: boolean; message: string; already?: boolean; wabaId?: string }> {
  const token = String(opts.accessToken || '').trim();
  if (!token) {
    return { success: false, message: 'Token de acesso ausente.' };
  }

  let wabaId = await resolveWhatsAppWabaId(opts);
  if (!wabaId) {
    return {
      success: false,
      message: 'Informe o Business Account ID (WABA) ou um Phone Number ID válido para inscrever o webhook.',
    };
  }

  if (opts.persistWaba && opts.accountId && opts.tenantId) {
    await pool.query(
      `UPDATE whatsapp_accounts
       SET business_account_id = COALESCE(NULLIF(business_account_id, ''), $1),
           updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3`,
      [wabaId, opts.accountId, opts.tenantId]
    ).catch(() => undefined);
  }

  try {
    const config = await withProxyConfig(
      {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 20000,
      },
      opts
    );

    await axios.post(
      `https://graph.facebook.com/v18.0/${encodeURIComponent(wabaId)}/subscribed_apps`,
      {},
      config
    );

    return {
      success: true,
      wabaId,
      message: 'App inscrito na WABA. Os eventos desta conta passam a chegar no webhook.',
    };
  } catch (error: any) {
    const fb = error?.response?.data?.error;
    const code = Number(fb?.code || 0);
    const msg = String(fb?.message || error?.message || 'Falha ao inscrever o App na WABA');
    // Já inscrito / sem mudança
    if (code === 100 || /already|subscribed/i.test(msg)) {
      return { success: true, already: true, wabaId, message: 'App já estava inscrito nesta WABA.' };
    }
    console.error('❌ subscribed_apps:', msg, fb || '');
    return { success: false, wabaId, message: msg };
  }
}
