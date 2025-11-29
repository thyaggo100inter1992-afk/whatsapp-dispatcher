-- ============================================
-- CORREÇÃO: Erro 403 ao acessar Base de Dados
-- ============================================
-- Problema: Middleware checkDatabase bloqueia acesso porque 
-- o tenant não tem a funcionalidade "base_dados" habilitada
-- ============================================

-- Passo 1: Adicionar coluna de funcionalidades nos planos (se não existir)
ALTER TABLE plans ADD COLUMN IF NOT EXISTS funcionalidades JSONB DEFAULT '{
  "whatsapp_api": true,
  "whatsapp_qr": true,
  "campanhas": true,
  "templates": true,
  "base_dados": true,
  "nova_vida": true,
  "verificar_numeros": true,
  "lista_restricao": true,
  "webhooks": true,
  "catalogo": true,
  "dashboard": true,
  "relatorios": true,
  "envio_imediato": true
}'::jsonb;

-- Passo 2: Atualizar TODOS os planos existentes para ter base_dados habilitado
UPDATE plans 
SET funcionalidades = COALESCE(funcionalidades, '{}'::jsonb) || '{
  "whatsapp_api": true,
  "whatsapp_qr": true,
  "campanhas": true,
  "templates": true,
  "base_dados": true,
  "nova_vida": true,
  "verificar_numeros": true,
  "lista_restricao": true,
  "webhooks": true,
  "catalogo": true,
  "dashboard": true,
  "relatorios": true,
  "envio_imediato": true
}'::jsonb
WHERE funcionalidades IS NULL OR NOT (funcionalidades ? 'base_dados');

-- Passo 3: Adicionar colunas de funcionalidades customizadas nos tenants (se não existirem)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS funcionalidades_customizadas BOOLEAN DEFAULT false;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS funcionalidades_config JSONB DEFAULT NULL;

-- Passo 4: Habilitar funcionalidades para TODOS os tenants
-- Isso garante que todos tenham acesso à Base de Dados
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
    "lista_restricao": true,
    "webhooks": true,
    "catalogo": true,
    "dashboard": true,
    "relatorios": true,
    "envio_imediato": true
  }'::jsonb
WHERE funcionalidades_config IS NULL 
   OR NOT (funcionalidades_config ? 'base_dados');

-- Passo 5: Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_plans_funcionalidades ON plans USING gin(funcionalidades);
CREATE INDEX IF NOT EXISTS idx_tenants_funcionalidades_config ON tenants USING gin(funcionalidades_config);
CREATE INDEX IF NOT EXISTS idx_tenants_funcionalidades_customizadas ON tenants(funcionalidades_customizadas);

-- Verificar resultados
SELECT 
  'PLANOS' as tipo,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE funcionalidades->>'base_dados' = 'true') as com_base_dados
FROM plans
UNION ALL
SELECT 
  'TENANTS' as tipo,
  COUNT(*) as total,
  COUNT(*) FILTER (
    WHERE funcionalidades_config->>'base_dados' = 'true'
  ) as com_base_dados
FROM tenants;

-- Mostrar status atual dos tenants
SELECT 
  id,
  nome,
  plan_id,
  funcionalidades_customizadas,
  funcionalidades_config->>'base_dados' as base_dados_habilitado
FROM tenants
ORDER BY id;

