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
 * Grava status da Meta e, se banida/sinalizada/restrita, desativa a conta.
 * Retorna se a conta ficou banida.
 */
export async function syncWhatsAppAccountMetaStatus(opts: {
  accountId: number;
  tenantId: number;
  qualityRating?: string | null;
  accountStatus?: string | null;
}): Promise<{ banned: boolean; deactivated: boolean }> {
  await ensureWhatsAppAccountStatusColumn();
  const quality = opts.qualityRating ? String(opts.qualityRating).toUpperCase() : null;
  const status = opts.accountStatus ? String(opts.accountStatus).toUpperCase() : null;
  const banned = isBannedMetaStatus(status);

  const current = await pool.query(
    `SELECT account_status FROM whatsapp_accounts WHERE id = $1 AND tenant_id = $2`,
    [opts.accountId, opts.tenantId]
  );
  const currentStatus = String(current.rows[0]?.account_status || '').toUpperCase();

  if (banned) {
    await pool.query(
      `UPDATE whatsapp_accounts
       SET is_active = FALSE,
           account_status = $1,
           quality_rating = COALESCE($2, quality_rating),
           updated_at = NOW()
       WHERE id = $3 AND tenant_id = $4`,
      [status, quality, opts.accountId, opts.tenantId]
    );
    console.log(`🚫 Conta ${opts.accountId} banida/sinalizada (${status}) — desativada e oculta dos envios.`);
    return { banned: true, deactivated: true };
  }

  // GET da Meta sem status (ou CONNECTED) não pode apagar banimento já gravado
  if (isBannedMetaStatus(currentStatus)) {
    if (quality) {
      await pool.query(
        `UPDATE whatsapp_accounts
         SET quality_rating = COALESCE($1, quality_rating), updated_at = NOW()
         WHERE id = $2 AND tenant_id = $3`,
        [quality, opts.accountId, opts.tenantId]
      );
    }
    return { banned: true, deactivated: true };
  }

  await pool.query(
    `UPDATE whatsapp_accounts
     SET account_status = COALESCE($1, account_status),
         quality_rating = COALESCE($2, quality_rating),
         updated_at = NOW()
     WHERE id = $3 AND tenant_id = $4`,
    [status, quality, opts.accountId, opts.tenantId]
  );
  return { banned: false, deactivated: false };
}

export function bannedAccountsSqlFilter(alias = 'wa') {
  return `(
    ${alias}.is_active = true
    AND COALESCE(UPPER(${alias}.account_status), '') NOT IN ('BANNED', 'FLAGGED', 'RESTRICTED')
  )`;
}
