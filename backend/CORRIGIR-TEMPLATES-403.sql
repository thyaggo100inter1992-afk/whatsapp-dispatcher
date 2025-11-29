-- ============================================
-- CORREÇÃO: Erro 403 ao acessar fila de templates
-- ============================================
-- Problema: Middleware checkTemplates bloqueia acesso porque 
-- o tenant não tem a funcionalidade "templates" habilitada
-- ============================================

-- Passo 1: Adicionar coluna de funcionalidades nos planos (se não existir)
ALTER TABLE plans ADD COLUMN IF NOT EXISTS funcionalidades JSONB DEFAULT '{
  "whatsapp_api": true,
  "whatsapp_qr": true,
  "campanhas": true,
  "templates": true,
  "base_dados": true,
  "nova_vida": true,
  "lista_restricao": true,
  "webhooks": true,
  "catalogo": true,
  "dashboard": true,
  "relatorios": true,
  "envio_imediato": true
}'::jsonb;

-- Passo 2: Atualizar TODOS os planos existentes para ter templates habilitado
UPDATE plans 
SET funcionalidades = COALESCE(funcionalidades, '{}'::jsonb) || '{
  "whatsapp_api": true,
  "whatsapp_qr": true,
  "campanhas": true,
  "templates": true,
  "base_dados": true,
  "nova_vida": true,
  "lista_restricao": true,
  "webhooks": true,
  "catalogo": true,
  "dashboard": true,
  "relatorios": true,
  "envio_imediato": true
}'::jsonb
WHERE funcionalidades IS NULL OR NOT (funcionalidades ? 'templates');

-- Passo 3: Adicionar colunas de funcionalidades customizadas nos tenants (se não existirem)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS funcionalidades_customizadas BOOLEAN DEFAULT false;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS funcionalidades_config JSONB DEFAULT NULL;

-- Passo 4: Para garantir que TODOS os tenants tenham acesso,
-- vamos habilitar funcionalidades customizadas para os que não têm plano ou estão com problema
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
    "lista_restricao": true,
    "webhooks": true,
    "catalogo": true,
    "dashboard": true,
    "relatorios": true,
    "envio_imediato": true
  }'::jsonb
WHERE plan_id IS NULL 
   OR funcionalidades_config IS NULL 
   OR NOT (funcionalidades_config ? 'templates');

-- Passo 5: Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_plans_funcionalidades ON plans USING gin(funcionalidades);
CREATE INDEX IF NOT EXISTS idx_tenants_funcionalidades_config ON tenants USING gin(funcionalidades_config);
CREATE INDEX IF NOT EXISTS idx_tenants_funcionalidades_customizadas ON tenants(funcionalidades_customizadas);

-- Verificar resultados
SELECT 
  'PLANOS' as tipo,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE funcionalidades->>'templates' = 'true') as com_templates
FROM plans
UNION ALL
SELECT 
  'TENANTS' as tipo,
  COUNT(*) as total,
  COUNT(*) FILTER (
    WHERE (funcionalidades_customizadas = true AND funcionalidades_config->>'templates' = 'true')
       OR (funcionalidades_customizadas = false OR funcionalidades_customizadas IS NULL)
  ) as com_templates
FROM tenants;


