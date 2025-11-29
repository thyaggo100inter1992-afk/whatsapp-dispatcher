-- ═══════════════════════════════════════════════════════════════
-- 🔗 ADICIONAR WEBHOOK POR TENANT
-- ═══════════════════════════════════════════════════════════════
--
-- OBJETIVO: Cada tenant terá seu próprio webhook
-- URL: https://seudominio.com/webhook/tenant-{ID}
--
-- ═══════════════════════════════════════════════════════════════

-- 1. Adicionar coluna webhook_url na tabela tenants
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS webhook_url TEXT;

-- 2. Adicionar índice para busca rápida
CREATE INDEX IF NOT EXISTS idx_tenants_webhook_url 
ON tenants(webhook_url);

-- 3. Gerar webhook_url para tenants existentes
-- IMPORTANTE: Substitua 'https://seudominio.com' pela sua URL real
UPDATE tenants 
SET webhook_url = CONCAT('https://seudominio.com/api/webhook/tenant-', id)
WHERE webhook_url IS NULL;

-- 4. Adicionar comentário
COMMENT ON COLUMN tenants.webhook_url IS 'URL única do webhook deste tenant para receber eventos do WhatsApp';

-- 5. Verificar resultado
SELECT 
  id,
  nome,
  webhook_url
FROM tenants
ORDER BY id;

-- ═══════════════════════════════════════════════════════════════
-- ✅ PRONTO!
-- ═══════════════════════════════════════════════════════════════
--
-- Agora cada tenant tem seu webhook:
-- - Tenant 1: https://seudominio.com/api/webhook/tenant-1
-- - Tenant 2: https://seudominio.com/api/webhook/tenant-2
-- - Tenant 3: https://seudominio.com/api/webhook/tenant-3
--
-- ═══════════════════════════════════════════════════════════════


