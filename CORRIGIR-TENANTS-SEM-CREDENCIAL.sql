-- =========================================================
-- CORREÇÃO: Vincular Credencial Padrão aos Tenants
-- Execute este script para corrigir tenants sem credencial
-- =========================================================

\echo '========================================='
\echo 'PASSO 1: Verificar credencial padrão'
\echo '========================================='

SELECT 
  id,
  name as "Nome",
  server_url as "URL",
  is_default as "Padrão?",
  is_active as "Ativa?"
FROM uazap_credentials
WHERE is_default = true AND is_active = true;

\echo ''
\echo 'Se NÃO houver nenhuma credencial padrão listada acima,'
\echo 'você precisa PRIMEIRO definir uma como padrão!'
\echo ''
\echo 'Execute no pgAdmin:'
\echo 'UPDATE uazap_credentials SET is_default = true WHERE id = <ID_DA_CREDENCIAL>;'
\echo ''
\echo 'Pressione Enter para continuar ou Ctrl+C para cancelar...'
\prompt 'Continuar? (Enter)' dummy

\echo ''
\echo '========================================='
\echo 'PASSO 2: Vincular tenants à credencial padrão'
\echo '========================================='

-- Mostrar o que será feito
SELECT 
  t.id as "ID Tenant",
  t.nome as "Nome",
  t.email as "Email",
  t.uazap_credential_id as "Cred Atual (NULL)",
  (SELECT id FROM uazap_credentials WHERE is_default = true LIMIT 1) as "Nova Cred (Padrão)"
FROM tenants t
WHERE t.uazap_credential_id IS NULL;

\echo ''
\echo 'Os tenants acima serão vinculados à credencial padrão.'
\echo 'Pressione Enter para confirmar ou Ctrl+C para cancelar...'
\prompt 'Confirmar? (Enter)' dummy

-- Executar a correção
UPDATE tenants 
SET uazap_credential_id = (
  SELECT id FROM uazap_credentials 
  WHERE is_default = true AND is_active = true
  LIMIT 1
),
updated_at = NOW()
WHERE uazap_credential_id IS NULL;

\echo ''
\echo '========================================='
\echo '✅ CORREÇÃO CONCLUÍDA!'
\echo '========================================='

-- Mostrar o resultado
SELECT 
  t.id as "ID Tenant",
  t.nome as "Nome",
  t.uazap_credential_id as "ID Credencial",
  uc.name as "Nome Credencial",
  uc.server_url as "URL"
FROM tenants t
LEFT JOIN uazap_credentials uc ON t.uazap_credential_id = uc.id
ORDER BY t.id;

\echo ''
\echo 'Todos os tenants agora têm credencial vinculada!'
\echo ''
\echo 'PRÓXIMO PASSO:'
\echo 'Se houver instâncias sem credential_id, execute: CORRIGIR-INSTANCIAS-SEM-CREDENCIAL.sql'
\echo ''






