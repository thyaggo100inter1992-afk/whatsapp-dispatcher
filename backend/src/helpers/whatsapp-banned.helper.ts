import { pool } from '../database/connection';

/** Status Meta em que a conta não pode mais enviar e some das telas de uso. */
export const BANNED_ACCOUNT_STATUSES = ['BANNED', 'FLAGGED', 'RESTRICTED'] as const;

let accountStatusColumnReady = false;

export async function ensureWhatsAppAccountStatusColumn() {
  if (accountStatusColumnReady) return;
  await pool.query(
    `ALTER TABLE whatsapp_accounts ADD COLUMN IF NOT EXISTS account_status VARCHAR(40)`
  ).catch(() => undefined);
  accountStatusColumnReady = true;
}

export function isBannedMetaStatus(status?: string | null): boolean {
  const value = String(status || '').trim().toUpperCase();
  return (BANNED_ACCOUNT_STATUSES as readonly string[]).includes(value);
}

export function extractBanStatusFromMetaError(error: any): string | null {
  const data = error?.response?.data?.error || {};
  const code = Number(data.code || 0);
  const subcode = Number(data.error_subcode || 0);
  const blob = `${data.message || ''} ${data.error_user_msg || ''} ${error?.message || ''}`.toLowerCase();

  if (
    code === 131031 ||
    code === 368 ||
    subcode === 2494055 ||
    /account has been banned|banned from|blocked from messaging|conta banida/.test(blob)
  ) {
    return 'BANNED';
  }
  if (/flagged/.test(blob)) return 'FLAGGED';
  if (/restrict/.test(blob)) return 'RESTRICTED';
  return null;
}

export function inferBanStatusFromText(text?: string | null): string | null {
  const blob = String(text || '').toUpperCase();
  if (!blob) return null;
  if (blob.includes('BANNED') || blob.includes('BANIDA')) return 'BANNED';
  if (blob.includes('FLAGGED') || blob.includes('SINALIZADA')) return 'FLAGGED';
  if (blob.includes('RESTRICTED') || blob.includes('RESTRITA')) return 'RESTRICTED';
  return null;
}

/**
 * O que a Meta usa de fato para "Banido" no WhatsApp Manager:
 * 1) GET /{phone-number-id}?fields=status → status = BANNED
 *    (qualidade pode continuar GREEN / "Alta")
 * 2) GET ?fields=health_status → entity WABA/PHONE com error_code 141014
 *    ("The WABA is banned.")
 * Qualidade NÃO decreta banimento. health_status.can_send_message=BLOCKED sozinho
 * também não (pode ser nome, SIP, template, etc.).
 */
export function extractBanFromMetaPhonePayload(data: any): string | null {
  const status = String(data?.status || data?.account_status || '').toUpperCase();
  if (status === 'BANNED') return 'BANNED';
  if (status === 'FLAGGED' || status === 'RESTRICTED') return status;

  const entities = data?.health_status?.entities || [];
  for (const entity of entities) {
    for (const err of entity.errors || []) {
      const code = Number(err.error_code || 0);
      const desc = String(err.error_description || '').toLowerCase();
      if (
        code === 141014 ||
        desc.includes('waba is banned') ||
        desc.includes('phone number is banned') ||
        desc.includes('the account is banned')
      ) {
        return 'BANNED';
      }
    }
  }
  return null;
}

async function pauseCampaignsForBannedAccount(accountId: number, status: string) {
  await pool.query(
    `UPDATE campaign_templates
     SET is_active = false,
         removed_at = NOW(),
         last_error = $1
     WHERE whatsapp_account_id = $2
       AND is_active = true`,
    [`CONTA BANIDA pela Meta (${status})`, accountId]
  ).catch(() => undefined);
}

async function restoreCampaignsAfterUnban(accountId: number) {
  await pool.query(
    `UPDATE campaign_templates
     SET is_active = true,
         consecutive_failures = 0,
         last_error = NULL,
         removed_at = NULL
     WHERE whatsapp_account_id = $1
       AND (
         last_error ILIKE '%BANID%'
         OR last_error ILIKE '%BANNED%'
         OR last_error ILIKE '%FLAGGED%'
         OR last_error ILIKE '%SINALIZ%'
         OR last_error ILIKE '%RESTRICT%'
         OR last_error ILIKE '%RESTRITA%'
       )`,
    [accountId]
  ).catch(() => undefined);
}

/**
 * Grava status da Meta:
 * - Banida → desativa a conta e tira das campanhas/funcionalidades.
 * - Meta devolve CONNECTED depois do banimento → reativa automaticamente.
 */
export async function syncWhatsAppAccountMetaStatus(opts: {
  accountId: number;
  tenantId: number;
  qualityRating?: string | null;
  accountStatus?: string | null;
}): Promise<{ banned: boolean; deactivated: boolean; reactivated: boolean }> {
  await ensureWhatsAppAccountStatusColumn();
  const quality = opts.qualityRating ? String(opts.qualityRating).toUpperCase() : null;
  const status = opts.accountStatus ? String(opts.accountStatus).toUpperCase() : null;
  const banned = isBannedMetaStatus(status);
  const confirmedConnected = status === 'CONNECTED';

  let currentStatus = '';
  try {
    const current = await pool.query(
      `SELECT account_status FROM whatsapp_accounts WHERE id = $1 AND tenant_id = $2`,
      [opts.accountId, opts.tenantId]
    );
    currentStatus = String(current.rows[0]?.account_status || '').toUpperCase();
  } catch (error: any) {
    if (!/account_status/i.test(String(error?.message || ''))) throw error;
    console.warn('⚠️ Coluna account_status ausente — status Meta não será persistido.');
  }

  if (banned) {
    try {
      await pool.query(
        `UPDATE whatsapp_accounts
         SET is_active = FALSE,
             account_status = $1,
             quality_rating = COALESCE($2, quality_rating),
             updated_at = NOW()
         WHERE id = $3 AND tenant_id = $4`,
        [status, quality, opts.accountId, opts.tenantId]
      );
    } catch (error: any) {
      await pool.query(
        `UPDATE whatsapp_accounts
         SET is_active = FALSE,
             quality_rating = COALESCE($1, quality_rating),
             updated_at = NOW()
         WHERE id = $2 AND tenant_id = $3`,
        [quality, opts.accountId, opts.tenantId]
      ).catch(() => undefined);
      console.warn(`⚠️ Não persistiu account_status=${status} na conta ${opts.accountId}: ${error?.message}`);
    }
    await pauseCampaignsForBannedAccount(opts.accountId, status || 'BANNED');
    console.log(`🚫 Conta ${opts.accountId} banida (${status}) — desativada e oculta das funcionalidades.`);
    return { banned: true, deactivated: true, reactivated: false };
  }

  // Só desbloqueia se a Meta confirmar CONNECTED. Status vazio não tira o banimento.
  if (isBannedMetaStatus(currentStatus) && confirmedConnected) {
    try {
      await pool.query(
        `UPDATE whatsapp_accounts
         SET is_active = TRUE,
             account_status = 'CONNECTED',
             quality_rating = COALESCE($1, quality_rating),
             updated_at = NOW()
         WHERE id = $2 AND tenant_id = $3`,
        [quality, opts.accountId, opts.tenantId]
      );
    } catch (error: any) {
      await pool.query(
        `UPDATE whatsapp_accounts
         SET is_active = TRUE,
             quality_rating = COALESCE($1, quality_rating),
             updated_at = NOW()
         WHERE id = $2 AND tenant_id = $3`,
        [quality, opts.accountId, opts.tenantId]
      ).catch(() => undefined);
      console.warn(`⚠️ Reativou a conta ${opts.accountId} sem gravar account_status: ${error?.message}`);
    }
    await restoreCampaignsAfterUnban(opts.accountId);
    console.log(`✅ Conta ${opts.accountId} desbanida pela Meta — reativada no sistema.`);
    return { banned: false, deactivated: false, reactivated: true };
  }

  if (isBannedMetaStatus(currentStatus)) {
    if (quality) {
      await pool.query(
        `UPDATE whatsapp_accounts
         SET quality_rating = COALESCE($1, quality_rating), updated_at = NOW()
         WHERE id = $2 AND tenant_id = $3`,
        [quality, opts.accountId, opts.tenantId]
      ).catch(() => undefined);
    }
    return { banned: true, deactivated: true, reactivated: false };
  }

  try {
    await pool.query(
      `UPDATE whatsapp_accounts
       SET account_status = COALESCE($1, account_status),
           quality_rating = COALESCE($2, quality_rating),
           updated_at = NOW()
       WHERE id = $3 AND tenant_id = $4`,
      [status, quality, opts.accountId, opts.tenantId]
    );
  } catch (error: any) {
    if (quality) {
      await pool.query(
        `UPDATE whatsapp_accounts
         SET quality_rating = COALESCE($1, quality_rating), updated_at = NOW()
         WHERE id = $2 AND tenant_id = $3`,
        [quality, opts.accountId, opts.tenantId]
      ).catch(() => undefined);
    }
    if (!/account_status/i.test(String(error?.message || ''))) throw error;
  }
  return { banned: false, deactivated: false, reactivated: false };
}

export function bannedAccountsSqlFilter(alias = 'wa') {
  return `(
    ${alias}.is_active = true
    AND COALESCE(UPPER(${alias}.account_status), '') NOT IN ('BANNED', 'FLAGGED', 'RESTRICTED')
  )`;
}
