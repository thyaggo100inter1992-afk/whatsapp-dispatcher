-- ============================================================================
-- ATUALIZAÇÃO DE FUNCIONALIDADES DOS PLANOS
-- Data: 27/11/2025
-- Objetivo: Manter apenas 5 recursos disponíveis nos planos
-- ============================================================================

/*
  RECURSOS PERMITIDOS (5):
  1. whatsapp_api          - WhatsApp API Oficial
  2. whatsapp_qr           - WhatsApp QR Connect  
  3. nova_vida             - Consulta de Dados (Nova Vida)
  4. verificar_numeros     - Verificar Números
  5. gerenciar_proxies     - Gerenciar Proxies

  RECURSOS REMOVIDOS:
  - campanhas
  - templates
  - base_dados
  - lista_restricao
  - webhooks
  - catalogo
  - dashboard
  - relatorios
  - envio_imediato
  - auditoria
*/

-- ============================================================================
-- 1. ATUALIZAR FUNCIONALIDADES PADRÃO NOS PLANOS EXISTENTES
-- ============================================================================

-- Atualizar TODOS os planos com apenas as 5 funcionalidades permitidas
UPDATE plans 
SET funcionalidades = '{
  "whatsapp_api": true,
  "whatsapp_qr": true,
  "nova_vida": true,
  "verificar_numeros": true,
  "gerenciar_proxies": true
}'::jsonb
WHERE funcionalidades IS NOT NULL;

-- ============================================================================
-- 2. ATUALIZAR FUNCIONALIDADES CUSTOMIZADAS DOS TENANTS
-- ============================================================================

-- Para tenants com funcionalidades customizadas, manter apenas as 5 permitidas
-- e remover todas as outras que possam existir
UPDATE tenants 
SET funcionalidades_config = (
  SELECT jsonb_build_object(
    'whatsapp_api', COALESCE((funcionalidades_config->>'whatsapp_api')::boolean, true),
    'whatsapp_qr', COALESCE((funcionalidades_config->>'whatsapp_qr')::boolean, true),
    'nova_vida', COALESCE((funcionalidades_config->>'nova_vida')::boolean, true),
    'verificar_numeros', COALESCE((funcionalidades_config->>'verificar_numeros')::boolean, true),
    'gerenciar_proxies', COALESCE((funcionalidades_config->>'gerenciar_proxies')::boolean, true)
  )
)
WHERE funcionalidades_customizadas = true 
  AND funcionalidades_config IS NOT NULL;

-- ============================================================================
-- 3. VERIFICAR RESULTADO
-- ============================================================================

-- Mostrar funcionalidades de todos os planos
SELECT 
  id, 
  nome, 
  slug,
  funcionalidades 
FROM plans
ORDER BY ordem, id;

-- Mostrar tenants com funcionalidades customizadas
SELECT 
  id,
  nome,
  funcionalidades_customizadas,
  funcionalidades_config
FROM tenants
WHERE funcionalidades_customizadas = true;

-- ============================================================================
-- MENSAGEM DE SUCESSO
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Funcionalidades dos planos atualizadas com sucesso!';
  RAISE NOTICE '📋 Apenas 5 recursos disponíveis:';
  RAISE NOTICE '   1. WhatsApp API Oficial';
  RAISE NOTICE '   2. WhatsApp QR Connect';
  RAISE NOTICE '   3. Consulta de Dados';
  RAISE NOTICE '   4. Verificar Números';
  RAISE NOTICE '   5. Gerenciar Proxies';
END $$;


