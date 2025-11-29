-- =========================================================
-- DIAGNÓSTICO COMPLETO: Sistema de Credenciais WhatsApp
-- Execute este script no pgAdmin ou psql para ver o estado
-- =========================================================

\echo '========================================='
\echo '1. CREDENCIAIS UAZAP CADASTRADAS'
\echo '========================================='

SELECT 
  id,
  name as "Nome",
  server_url as "URL",
  CASE 
    WHEN is_default THEN '⭐ SIM'
    ELSE 'Não'
  END as "Padrão?",
  CASE 
    WHEN is_active THEN '✅ Ativa'
    ELSE '❌ Inativa'
  END as "Status",
  (SELECT COUNT(*) FROM tenants WHERE uazap_credential_id = uazap_credentials.id) as "Tenants Usando",
  created_at as "Criada em"
FROM uazap_credentials
ORDER BY is_default DESC, id;

\echo ''
\echo '========================================='
\echo '2. TENANTS E SUAS CREDENCIAIS'
\echo '========================================='

SELECT 
  t.id as "ID",
  t.nome as "Nome Tenant",
  t.uazap_credential_id as "ID Credencial",
  COALESCE(uc.name, '⚠️ SEM CREDENCIAL!') as "Credencial Usada",
  COALESCE(uc.server_url, 'N/A') as "URL",
  (SELECT COUNT(*) FROM uaz_instances WHERE tenant_id = t.id) as "Total Instâncias",
  (SELECT COUNT(*) FROM uaz_instances WHERE tenant_id = t.id AND credential_id IS NULL) as "Instâncias Sem Cred",
  (SELECT COUNT(*) FROM uaz_instances WHERE tenant_id = t.id AND is_connected = true) as "Conectadas"
FROM tenants t
LEFT JOIN uazap_credentials uc ON t.uazap_credential_id = uc.id
ORDER BY t.id;

\echo ''
\echo '========================================='
\echo '3. INSTÂNCIAS E SUAS CREDENCIAIS'
\echo '========================================='

SELECT 
  ui.id as "ID Inst",
  ui.name as "Nome Instância",
  ui.tenant_id as "Tenant",
  t.nome as "Nome Tenant",
  ui.credential_id as "Cred Instância",
  uc1.name as "Nome Cred Inst",
  t.uazap_credential_id as "Cred Tenant",
  uc2.name as "Nome Cred Tenant",
  CASE 
    WHEN ui.credential_id IS NULL THEN '⚠️ SEM CREDENCIAL!'
    WHEN ui.credential_id != t.uazap_credential_id THEN '⚠️ DIFERENTE DO TENANT!'
    ELSE '✅ OK'
  END as "Status",
  CASE 
    WHEN ui.is_connected THEN '✅ Conectada'
    ELSE '❌ Desconectada'
  END as "Conexão",
  ui.created_at as "Criada em"
FROM uaz_instances ui
JOIN tenants t ON ui.tenant_id = t.id
LEFT JOIN uazap_credentials uc1 ON ui.credential_id = uc1.id
LEFT JOIN uazap_credentials uc2 ON t.uazap_credential_id = uc2.id
ORDER BY ui.tenant_id, ui.id;

\echo ''
\echo '========================================='
\echo '4. PROBLEMAS IDENTIFICADOS'
\echo '========================================='

\echo ''
\echo '--- 4.1) Tenants SEM credencial vinculada:'
SELECT 
  id as "ID Tenant",
  nome as "Nome",
  email as "Email",
  '⚠️ PRECISA VINCULAR CREDENCIAL!' as "Problema"
FROM tenants 
WHERE uazap_credential_id IS NULL;

\echo ''
\echo '--- 4.2) Instâncias SEM credential_id:'
SELECT 
  ui.id as "ID Instância",
  ui.name as "Nome",
  ui.tenant_id as "Tenant ID",
  t.nome as "Nome Tenant",
  '⚠️ PRECISA DEFINIR credential_id!' as "Problema"
FROM uaz_instances ui
JOIN tenants t ON ui.tenant_id = t.id
WHERE ui.credential_id IS NULL;

\echo ''
\echo '--- 4.3) Instâncias com credencial DIFERENTE do tenant:'
SELECT 
  ui.id as "ID Instância",
  ui.name as "Nome",
  ui.tenant_id as "Tenant ID",
  t.nome as "Nome Tenant",
  ui.credential_id as "Cred Instância",
  uc1.name as "Nome Cred Inst",
  t.uazap_credential_id as "Cred Tenant",
  uc2.name as "Nome Cred Tenant",
  '⚠️ PODE CAUSAR PROBLEMAS!' as "Aviso"
FROM uaz_instances ui
JOIN tenants t ON ui.tenant_id = t.id
LEFT JOIN uazap_credentials uc1 ON ui.credential_id = uc1.id
LEFT JOIN uazap_credentials uc2 ON t.uazap_credential_id = uc2.id
WHERE ui.credential_id IS NOT NULL 
  AND t.uazap_credential_id IS NOT NULL
  AND ui.credential_id != t.uazap_credential_id;

\echo ''
\echo '========================================='
\echo '5. RESUMO GERAL'
\echo '========================================='

SELECT 
  (SELECT COUNT(*) FROM uazap_credentials) as "Total Credenciais",
  (SELECT COUNT(*) FROM uazap_credentials WHERE is_default = true) as "Credenciais Padrão",
  (SELECT COUNT(*) FROM uazap_credentials WHERE is_active = true) as "Credenciais Ativas",
  (SELECT COUNT(*) FROM tenants) as "Total Tenants",
  (SELECT COUNT(*) FROM tenants WHERE uazap_credential_id IS NULL) as "Tenants Sem Credencial",
  (SELECT COUNT(*) FROM uaz_instances) as "Total Instâncias",
  (SELECT COUNT(*) FROM uaz_instances WHERE credential_id IS NULL) as "Instâncias Sem Cred",
  (SELECT COUNT(*) FROM uaz_instances WHERE is_connected = true) as "Instâncias Conectadas";

\echo ''
\echo '========================================='
\echo '✅ DIAGNÓSTICO COMPLETO!'
\echo '========================================='
\echo ''
\echo 'PRÓXIMOS PASSOS:'
\echo '1. Se houver tenants sem credencial, execute: CORRIGIR-TENANTS-SEM-CREDENCIAL.sql'
\echo '2. Se houver instâncias sem credential_id, execute: CORRIGIR-INSTANCIAS-SEM-CREDENCIAL.sql'
\echo '3. Se tudo estiver OK, teste criando uma nova instância'
\echo ''






