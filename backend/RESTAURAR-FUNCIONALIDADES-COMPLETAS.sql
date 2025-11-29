-- ============================================
-- RESTAURAR FUNCIONALIDADES COMPLETAS
-- ============================================
-- Problema: Script anterior não incluiu "gerenciar_proxies"
-- Solução: Atualizar com TODAS as funcionalidades
-- ============================================

-- Atualizar TODOS os tenants com funcionalidades COMPLETAS
UPDATE tenants
SET 
  funcionalidades_customizadas = true,
  funcionalidades_config = '{
    "whatsapp_api": true,
    "whatsapp_qr": true,
    "campanhas": true,
    "templates": true,
    "base_dados": true,
    "nova_vida": true,
    "verificar_numeros": true,
    "gerenciar_proxies": true,
    "lista_restricao": true,
    "webhooks": true,
    "catalogo": true,
    "dashboard": true,
    "relatorios": true,
    "envio_imediato": true
  }'::jsonb;

-- Verificar resultado
SELECT 
  id,
  nome,
  funcionalidades_config->>'base_dados' as base_dados,
  funcionalidades_config->>'gerenciar_proxies' as proxies,
  funcionalidades_config->>'nova_vida' as nova_vida
FROM tenants
ORDER BY id;

