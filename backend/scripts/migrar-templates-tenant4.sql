-- =====================================================
-- SCRIPT: Migrar templates para o tenant correto
-- DATA: 2025-12-10
-- OBJETIVO: Transferir templates criados com contas do
--           tenant 4 que estão incorretamente no tenant 1
-- =====================================================

BEGIN;

-- ✅ PASSO 1: Verificar quantos templates serão afetados
SELECT 
    'ANTES DA MIGRAÇÃO:' as etapa,
    COUNT(*) as total_templates,
    t.tenant_id as tenant_atual,
    wa.tenant_id as tenant_da_conta
FROM templates t
INNER JOIN whatsapp_accounts wa ON wa.id = t.whatsapp_account_id
WHERE wa.tenant_id = 4 AND t.tenant_id != 4
GROUP BY t.tenant_id, wa.tenant_id;

-- ✅ PASSO 2: Mostrar templates que serão migrados
SELECT 
    t.id,
    t.template_name,
    t.tenant_id as tenant_atual,
    wa.tenant_id as tenant_correto,
    wa.name as conta_whatsapp,
    t.status,
    t.category,
    t.created_at
FROM templates t
INNER JOIN whatsapp_accounts wa ON wa.id = t.whatsapp_account_id
WHERE wa.tenant_id = 4 AND t.tenant_id != 4
ORDER BY t.created_at DESC;

-- ✅ PASSO 3: Atualizar templates para o tenant correto
UPDATE templates t
SET tenant_id = 4
FROM whatsapp_accounts wa
WHERE t.whatsapp_account_id = wa.id
  AND wa.tenant_id = 4
  AND t.tenant_id != 4;

-- ✅ PASSO 4: Verificar após a migração
SELECT 
    'APÓS A MIGRAÇÃO:' as etapa,
    COUNT(*) as total_templates,
    t.tenant_id as tenant_atual,
    wa.tenant_id as tenant_da_conta
FROM templates t
INNER JOIN whatsapp_accounts wa ON wa.id = t.whatsapp_account_id
WHERE wa.tenant_id = 4
GROUP BY t.tenant_id, wa.tenant_id;

-- ✅ PASSO 5: Migrar também os registros relacionados em template_queue_history
UPDATE template_queue_history tqh
SET tenant_id = 4
FROM templates t
INNER JOIN whatsapp_accounts wa ON wa.id = t.whatsapp_account_id
WHERE tqh.template_name = t.template_name
  AND wa.tenant_id = 4
  AND tqh.tenant_id != 4;

-- ✅ PASSO 6: Verificar template_queue_history após migração
SELECT 
    'TEMPLATE_QUEUE_HISTORY APÓS MIGRAÇÃO:' as etapa,
    COUNT(*) as total_registros,
    tqh.tenant_id as tenant_atual
FROM template_queue_history tqh
WHERE tqh.tenant_id = 4
GROUP BY tqh.tenant_id;

-- ✅ COMMIT: Descomente a linha abaixo para aplicar as mudanças
-- COMMIT;

-- ⚠️ ROLLBACK: Descomente a linha abaixo se quiser apenas testar
ROLLBACK;

-- =====================================================
-- INSTRUÇÕES DE USO:
-- 1. Execute o script primeiro para VER o que será alterado
-- 2. Se estiver tudo OK, comente o ROLLBACK e descomente o COMMIT
-- 3. Execute novamente para aplicar as mudanças
-- =====================================================

