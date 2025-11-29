-- =====================================================
-- CORRIGIR CREDENCIAL PADRÃO DO SISTEMA
-- Trocar o padrão de "TESTE" para "UAZAP Padrão"
-- =====================================================

-- 1. VERIFICAR SITUAÇÃO ATUAL
SELECT 
    id,
    name,
    server_url,
    is_default,
    is_active,
    (SELECT COUNT(*) FROM tenants WHERE uazap_credential_id = uazap_credentials.id) as tenants_usando
FROM uazap_credentials
ORDER BY is_default DESC, name;

-- =====================================================
-- CORREÇÃO
-- =====================================================

-- 2. REMOVER "TESTE" COMO PADRÃO
UPDATE uazap_credentials
SET is_default = false
WHERE name = 'TESTE' OR server_url LIKE '%free.uazapi%';

-- 3. DEFINIR "UAZAP Padrão" COMO PADRÃO
UPDATE uazap_credentials
SET is_default = true
WHERE name = 'UAZAP Padrão' OR server_url LIKE '%nettsistemas.uazapi%';

-- 4. GARANTIR QUE APENAS UMA CREDENCIAL SEJA PADRÃO
-- (Remove padrão de todas exceto a que queremos)
UPDATE uazap_credentials
SET is_default = false
WHERE name != 'UAZAP Padrão';

UPDATE uazap_credentials
SET is_default = true
WHERE name = 'UAZAP Padrão';

-- =====================================================
-- VERIFICAÇÃO FINAL
-- =====================================================

-- 5. VERIFICAR RESULTADO
SELECT 
    id,
    name,
    server_url,
    is_default as padrao,
    is_active as ativa,
    (SELECT COUNT(*) FROM tenants WHERE uazap_credential_id = uazap_credentials.id) as tenants_usando,
    created_at
FROM uazap_credentials
ORDER BY is_default DESC, name;

-- =====================================================
-- ATUALIZAR TENANTS QUE ESTÃO USANDO A CREDENCIAL ERRADA
-- =====================================================

-- 6. OPCIONAL: Trocar todos os tenants que estão usando "TESTE" 
-- para usar "UAZAP Padrão"
UPDATE tenants
SET uazap_credential_id = (
    SELECT id FROM uazap_credentials WHERE name = 'UAZAP Padrão' LIMIT 1
)
WHERE uazap_credential_id = (
    SELECT id FROM uazap_credentials WHERE name = 'TESTE' LIMIT 1
);

-- 7. VERIFICAR TENANTS ATUALIZADOS
SELECT 
    t.id,
    t.nome,
    t.slug,
    uc.name as credencial_uazap,
    uc.server_url
FROM tenants t
LEFT JOIN uazap_credentials uc ON t.uazap_credential_id = uc.id
ORDER BY t.id;

-- =====================================================
-- RESULTADO ESPERADO
-- =====================================================
-- ✅ "UAZAP Padrão" deve aparecer com is_default = true
-- ✅ "TESTE" deve aparecer com is_default = false
-- ✅ Novas conexões vão usar "UAZAP Padrão"
-- =====================================================






