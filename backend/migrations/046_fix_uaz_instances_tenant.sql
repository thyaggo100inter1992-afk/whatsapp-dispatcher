-- ============================================
-- Migration 046: Atribuir tenant_id às instâncias UAZ existentes
-- ============================================

-- Descobrir um tenant padrão (primeiro da lista)
WITH first_tenant AS (
  SELECT id FROM tenants ORDER BY id LIMIT 1
)
UPDATE uaz_instances
SET tenant_id = (SELECT id FROM first_tenant)
WHERE tenant_id IS NULL;

-- Opcional: garantir NOT NULL no futuro (comentado para evitar quebra)
-- ALTER TABLE uaz_instances ALTER COLUMN tenant_id SET NOT NULL;
