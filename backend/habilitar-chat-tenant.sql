-- ============================================
-- SCRIPT PARA HABILITAR CHAT PARA TENANT ESPECÍFICO
-- ============================================

-- 1. LISTAR TODOS OS TENANTS
SELECT 
  id,
  nome,
  email,
  status,
  funcionalidades_customizadas,
  funcionalidades_config->'permite_chat_atendimento' as chat_habilitado
FROM tenants
ORDER BY id;

-- ============================================
-- 2. HABILITAR CHAT PARA UM TENANT ESPECÍFICO
-- ============================================
-- Substitua X pelo ID do tenant que você quer habilitar

-- Opção A: Se o tenant NÃO tem funcionalidades customizadas
UPDATE tenants 
SET 
  funcionalidades_customizadas = TRUE,
  funcionalidades_config = jsonb_set(
    COALESCE(funcionalidades_config, '{}'::jsonb),
    '{permite_chat_atendimento}',
    'true'::jsonb
  )
WHERE id = X;

-- Opção B: Se o tenant JÁ tem funcionalidades customizadas
UPDATE tenants 
SET 
  funcionalidades_config = jsonb_set(
    funcionalidades_config,
    '{permite_chat_atendimento}',
    'true'::jsonb
  )
WHERE id = X;

-- ============================================
-- 3. HABILITAR CHAT PARA SEU TENANT (ID 1)
-- ============================================
UPDATE tenants 
SET 
  funcionalidades_customizadas = TRUE,
  funcionalidades_config = jsonb_set(
    COALESCE(funcionalidades_config, '{}'::jsonb),
    '{permite_chat_atendimento}',
    'true'::jsonb
  )
WHERE id = 1;

-- ============================================
-- 4. DESABILITAR CHAT PARA UM TENANT
-- ============================================
UPDATE tenants 
SET 
  funcionalidades_config = jsonb_set(
    funcionalidades_config,
    '{permite_chat_atendimento}',
    'false'::jsonb
  )
WHERE id = X;

-- ============================================
-- 5. VERIFICAR SE CHAT ESTÁ HABILITADO
-- ============================================
SELECT 
  id,
  nome,
  email,
  funcionalidades_customizadas,
  funcionalidades_config->'permite_chat_atendimento' as chat_habilitado,
  CASE 
    WHEN funcionalidades_customizadas = TRUE 
      AND funcionalidades_config->>'permite_chat_atendimento' = 'true' 
    THEN '✅ HABILITADO'
    ELSE '❌ DESABILITADO'
  END as status_chat
FROM tenants
WHERE id = 1;

