-- Adicionar coluna quality_rating para cache da qualidade da conta do WhatsApp
-- Isso evita falhas na exibição quando a API do WhatsApp está inacessível

ALTER TABLE whatsapp_accounts
ADD COLUMN IF NOT EXISTS quality_rating VARCHAR(20);

-- Criar índice para melhor performance em consultas
CREATE INDEX IF NOT EXISTS idx_whatsapp_accounts_quality_rating 
ON whatsapp_accounts (tenant_id, quality_rating);

COMMENT ON COLUMN whatsapp_accounts.quality_rating IS 'Cache do rating de qualidade da conta (GREEN, YELLOW, RED, FLAGGED)';

