-- ================================================================================
-- SCRIPT PARA CORRIGIR ERRO DE PROXY
-- "Parse Error: Expected HTTP/, RTSP/ or ICE/"
-- ================================================================================
--
-- Este erro acontece quando o proxy configurado não está funcionando corretamente
-- ou está retornando respostas inválidas.
--
-- SOLUÇÃO: Desabilitar o proxy da instância com problema
-- ================================================================================

-- 1. VERIFICAR INSTÂNCIAS COM PROXY CONFIGURADO
SELECT 
    id,
    session_name,
    phone_number,
    proxy_host,
    proxy_port,
    proxy_enabled,
    is_connected,
    is_active
FROM uaz_instances
WHERE proxy_host IS NOT NULL
ORDER BY id;

-- ================================================================================
-- 2. DESABILITAR PROXY DA INSTÂNCIA 556291785664 (que está com problema)
-- ================================================================================

-- Opção A: Desabilitar proxy mantendo as configurações
UPDATE uaz_instances
SET proxy_enabled = false
WHERE phone_number = '556291785664';

-- OU

-- Opção B: Remover completamente as configurações de proxy
UPDATE uaz_instances
SET 
    proxy_host = NULL,
    proxy_port = NULL,
    proxy_username = NULL,
    proxy_password = NULL,
    proxy_enabled = false
WHERE phone_number = '556291785664';

-- ================================================================================
-- 3. VERIFICAR SE FOI APLICADO
-- ================================================================================

SELECT 
    id,
    session_name,
    phone_number,
    proxy_host,
    proxy_port,
    proxy_enabled,
    is_connected,
    is_active
FROM uaz_instances
WHERE phone_number = '556291785664';

-- ================================================================================
-- 4. SE QUISER DESABILITAR PROXY DE TODAS AS INSTÂNCIAS
-- ================================================================================

-- Desabilitar proxy de TODAS as instâncias
-- UPDATE uaz_instances
-- SET proxy_enabled = false;

-- OU remover proxy de TODAS as instâncias
-- UPDATE uaz_instances
-- SET 
--     proxy_host = NULL,
--     proxy_port = NULL,
--     proxy_username = NULL,
--     proxy_password = NULL,
--     proxy_enabled = false;

-- ================================================================================
-- NOTAS:
-- ================================================================================
-- 
-- Após executar este script:
-- 1. Reinicie o backend: npm run stop-backend && npm run start-backend
-- 2. Tente enviar a mensagem novamente
-- 3. O sistema agora usará conexão direta (sem proxy)
-- 
-- Se ainda assim falhar:
-- 1. Verifique se a URL do UAZ API está correta no .env:
--    UAZ_API_URL=http://localhost:8081
-- 
-- 2. Teste se o UAZ está acessível:
--    curl http://localhost:8081/instance/status
-- 
-- ================================================================================







