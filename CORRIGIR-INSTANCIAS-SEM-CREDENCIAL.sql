-- =========================================================
-- CORREÇÃO: Vincular credential_id às Instâncias
-- Execute este script para corrigir instâncias sem credential_id
-- =========================================================

\echo '========================================='
\echo 'PASSO 1: Identificar instâncias sem credential_id'
\echo '========================================='

SELECT 
  ui.id as "ID Instância",
  ui.name as "Nome",
  ui.tenant_id as "Tenant ID",
  t.nome as "Nome Tenant",
  ui.credential_id as "Cred Atual (NULL)",
  t.uazap_credential_id as "Cred do Tenant"
FROM uaz_instances ui
JOIN tenants t ON ui.tenant_id = t.id
WHERE ui.credential_id IS NULL;

\echo ''
\echo 'As instâncias acima receberão o credential_id do seu tenant.'
\echo 'Pressione Enter para continuar ou Ctrl+C para cancelar...'
\prompt 'Continuar? (Enter)' dummy

\echo ''
\echo '========================================='
\echo 'PASSO 2: Verificar se todos os tenants têm credencial'
\echo '========================================='

SELECT 
  id as "ID Tenant",
  nome as "Nome",
  uazap_credential_id as "Credencial"
FROM tenants 
WHERE uazap_credential_id IS NULL;

\echo ''
\echo 'Se houver tenants listados acima SEM credencial,'
\echo 'execute PRIMEIRO: CORRIGIR-TENANTS-SEM-CREDENCIAL.sql'
\echo ''
\echo 'Pressione Enter para continuar ou Ctrl+C para cancelar...'
\prompt 'Continuar? (Enter)' dummy

\echo ''
\echo '========================================='
\echo 'PASSO 3: Atualizar instâncias'
\echo '========================================='

-- Atualizar instâncias para usar a credencial do tenant
UPDATE uaz_instances ui
SET credential_id = t.uazap_credential_id,
    updated_at = NOW()
FROM tenants t
WHERE ui.tenant_id = t.id
  AND ui.credential_id IS NULL
  AND t.uazap_credential_id IS NOT NULL;

\echo ''
\echo '========================================='
\echo '✅ CORREÇÃO CONCLUÍDA!'
\echo '========================================='

-- Mostrar o resultado
SELECT 
  ui.id as "ID Instância",
  ui.name as "Nome",
  ui.tenant_id as "Tenant ID",
  t.nome as "Nome Tenant",
  ui.credential_id as "Cred Instância",
  uc1.name as "Nome Credencial",
  t.uazap_credential_id as "Cred Tenant",
  CASE 
    WHEN ui.credential_id IS NULL THEN '⚠️ AINDA SEM CREDENCIAL'
    WHEN ui.credential_id = t.uazap_credential_id THEN '✅ OK'
    ELSE '⚠️ DIFERENTE DO TENANT'
  END as "Status"
FROM uaz_instances ui
JOIN tenants t ON ui.tenant_id = t.id
LEFT JOIN uazap_credentials uc1 ON ui.credential_id = uc1.id
ORDER BY ui.tenant_id, ui.id;

\echo ''
\echo '========================================='
\echo 'VERIFICAÇÃO FINAL'
\echo '========================================='

SELECT 
  (SELECT COUNT(*) FROM uaz_instances WHERE credential_id IS NULL) as "Instâncias Sem Cred",
  (SELECT COUNT(*) FROM uaz_instances WHERE credential_id IS NOT NULL) as "Instâncias Com Cred",
  (SELECT COUNT(*) FROM uaz_instances) as "Total Instâncias";

\echo ''
\echo 'Se "Instâncias Sem Cred" = 0, tudo está correto!'
\echo ''
\echo 'TESTE FINAL:'
\echo '1. Acesse: http://localhost:3000/diagnostic/credentials'
\echo '2. Tente criar uma nova instância'
\echo '3. Tente enviar uma mensagem'
\echo ''






