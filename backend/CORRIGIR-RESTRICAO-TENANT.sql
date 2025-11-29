-- ============================================
-- CORREÇÃO CRÍTICA: Adicionar tenant_id em restriction_list_entries
-- ============================================
-- PROBLEMA: Tabela não tem tenant_id, permitindo vazamento de dados
-- SOLUÇÃO: Adicionar tenant_id e migrar dados existentes
-- ============================================

BEGIN;

-- 1. Adicionar coluna tenant_id
ALTER TABLE restriction_list_entries 
ADD COLUMN IF NOT EXISTS tenant_id INTEGER;

-- 2. Popular tenant_id das entradas existentes baseado no whatsapp_account_id
UPDATE restriction_list_entries e
SET tenant_id = wa.tenant_id
FROM whatsapp_accounts wa
WHERE e.whatsapp_account_id = wa.id
  AND e.tenant_id IS NULL;

-- 3. Deletar entradas órfãs (sem whatsapp_account_id E sem tenant_id)
DELETE FROM restriction_list_entries
WHERE whatsapp_account_id IS NULL AND tenant_id IS NULL;

-- 4. Tornar tenant_id obrigatório
ALTER TABLE restriction_list_entries 
ALTER COLUMN tenant_id SET NOT NULL;

-- 5. Adicionar foreign key para tenants
ALTER TABLE restriction_list_entries 
ADD CONSTRAINT fk_restriction_list_tenant
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- 6. Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_restriction_list_tenant_id 
ON restriction_list_entries(tenant_id);

-- 7. Criar índice composto para busca rápida
CREATE INDEX IF NOT EXISTS idx_restriction_list_tenant_phone 
ON restriction_list_entries(tenant_id, phone_number);

-- 8. Verificar resultado
SELECT 
  t.id as tenant_id,
  t.nome as tenant_nome,
  COUNT(e.id) as total_restricoes
FROM tenants t
LEFT JOIN restriction_list_entries e ON e.tenant_id = t.id
GROUP BY t.id, t.nome
ORDER BY t.id;

COMMIT;

SELECT '✅ Correção concluída!' as status;

