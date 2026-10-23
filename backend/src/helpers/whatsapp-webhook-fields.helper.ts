import axios from 'axios';
import { pool } from '../database/connection';

/** Campos de webhook WhatsApp (App Dashboard / Meta). Padrão = todos. */
export const WHATSAPP_WEBHOOK_FIELDS = [
  'account_alerts',
  'account_review_update',
  'account_settings_update',
  'account_update',
  'automatic_events',
  'business_capability_update',
  'business_status_update',
  'business_username_update',
  'calls',
  'flows',
  'group_lifecycle_update',
  'group_participant_update',
  'group_settings_update',
  'group_status_update',
  'history',
  'message_echoes',
  'message_template_components_update',
  'message_template_quality_update',
  'message_template_status_update',
  'messages',
  'messaging_handovers',
  'partner_solutions',
  'payment_configuration_update',
  'phone_number_name_update',
  'phone_number_quality_update',
  'security',
  'smb_app_state_sync',
  'smb_message_echoes',
  'standby',
  'template_category_update',
  'template_correct_category_detection',
  'tracking_events',
  'user_preferences',
] as const;

export type WhatsAppWebhookField = (typeof WHATSAPP_WEBHOOK_FIELDS)[number];

export function normalizeWebhookFields(input?: string[] | null): string[] {
  if (!Array.isArray(input) || input.length === 0) {
    return [...WHATSAPP_WEBHOOK_FIELDS];
  }
  const allowed = new Set<string>(WHATSAPP_WEBHOOK_FIELDS as unknown as string[]);
  const picked = input.map((f) => String(f || '').trim()).filter((f) => allowed.has(f));
  return picked.length > 0 ? Array.from(new Set(picked)) : [...WHATSAPP_WEBHOOK_FIELDS];
}

async function ensureAppSecretColumn() {
  await pool
    .query(`ALTER TABLE whatsapp_accounts ADD COLUMN IF NOT EXISTS app_secret TEXT`)
    .catch(() => undefined);
  await pool
    .query(`ALTER TABLE whatsapp_accounts ADD COLUMN IF NOT EXISTS webhook_fields_subscribed TEXT`)
    .catch(() => undefined);
}

/**
 * Tenta assinar os campos de webhook do App na Meta.
 * Observação: a Meta documenta que WhatsApp webhooks devem ser configurados no App Dashboard;
 * a API /{app-id}/subscriptions pode falhar. Mesmo assim tentamos com app_id|app_secret.
 */
export async function subscribeWhatsAppWebhookFields(opts: {
  appId: string;
  appSecret: string;
  callbackUrl: string;
  verifyToken: string;
  fields?: string[] | null;
}): Promise<{ success: boolean; message: string; fields: string[]; dashboardOnly?: boolean }> {
  const appId = String(opts.appId || '').trim();
  const appSecret = String(opts.appSecret || '').trim();
  const callbackUrl = String(opts.callbackUrl || '').trim();
  const verifyToken = String(opts.verifyToken || '').trim();
  const fields = normalizeWebhookFields(opts.fields);

  if (!appId || !appSecret) {
    return { success: false, message: 'App ID e App Secret são obrigatórios.', fields };
  }
  if (!callbackUrl) {
    return { success: false, message: 'URL de webhook do tenant não configurada.', fields };
  }
  if (!verifyToken) {
    return { success: false, message: 'Verify token do webhook não configurado.', fields };
  }

  const appToken = `${appId}|${appSecret}`;

  try {
    const response = await axios.post(
      `https://graph.facebook.com/v21.0/${encodeURIComponent(appId)}/subscriptions`,
      null,
      {
        params: {
          object: 'whatsapp_business_account',
          callback_url: callbackUrl,
          verify_token: verifyToken,
          fields: fields.join(','),
          include_values: true,
          access_token: appToken,
        },
        timeout: 30000,
      }
    );

    const ok = response.data?.success === true || response.status < 300;
    return {
      success: ok,
      fields,
      message: ok
        ? `Campos de webhook assinados na Meta (${fields.length}).`
        : 'Meta não confirmou a assinatura dos campos.',
    };
  } catch (error: any) {
    const fb = error?.response?.data?.error;
    const msg = String(fb?.message || error?.message || 'Falha ao assinar campos de webhook');
    // Meta bloqueia WhatsApp em /subscriptions — campos ficam só no Dashboard
    const dashboardOnly =
      /not supported|app dashboard|whatsapp/i.test(msg) || Number(fb?.code) === 100;

    console.warn('⚠️ subscribeWhatsAppWebhookFields:', msg, fb || '');
    return {
      success: false,
      fields,
      dashboardOnly,
      message: dashboardOnly
        ? `A Meta exige marcar os campos no App Dashboard (uma vez por App). Tentativa API: ${msg}`
        : msg,
    };
  }
}

export async function persistAccountWebhookMeta(opts: {
  accountId: number;
  tenantId: number;
  appSecret?: string | null;
  fields?: string[] | null;
}) {
  await ensureAppSecretColumn();
  const fields = normalizeWebhookFields(opts.fields);
  await pool.query(
    `UPDATE whatsapp_accounts
     SET app_secret = COALESCE(NULLIF($1, ''), app_secret),
         webhook_fields_subscribed = $2,
         updated_at = NOW()
     WHERE id = $3 AND tenant_id = $4`,
    [opts.appSecret || '', fields.join(','), opts.accountId, opts.tenantId]
  );
}

export async function getTenantWebhookConfig(tenantId: number): Promise<{
  callbackUrl: string;
  verifyToken: string;
}> {
  const tenant = await pool.query(`SELECT webhook_url FROM tenants WHERE id = $1`, [tenantId]);
  const callbackUrl = String(tenant.rows[0]?.webhook_url || '').trim();
  const verifyToken = String(process.env.WEBHOOK_VERIFY_TOKEN || 'seu_token_secreto_aqui').trim();
  return { callbackUrl, verifyToken };
}
