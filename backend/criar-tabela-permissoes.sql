/**
 * Script para criar sistema de controle de funcionalidades/permissões
 * Permite definir quais funcionalidades cada plano tem por padrão
 * E customizar funcionalidades por tenant individualmente
 */

-- ===================================================
-- 1. ADICIONAR CAMPOS DE FUNCIONALIDADES NOS PLANOS
-- ===================================================

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

COMMENT ON COLUMN plans.funcionalidades IS 'Funcionalidades disponíveis neste plano (JSON)';

-- ===================================================
-- 2. ADICIONAR CAMPOS DE FUNCIONALIDADES NOS TENANTS
-- ===================================================

-- Flag para indicar se o tenant tem funcionalidades customizadas
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS funcionalidades_customizadas BOOLEAN DEFAULT false;

COMMENT ON COLUMN tenants.funcionalidades_customizadas IS 'Se true, usa funcionalidades_config. Se false, usa do plano';

-- Configuração customizada de funcionalidades (sobrescreve o plano)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS funcionalidades_config JSONB DEFAULT NULL;

COMMENT ON COLUMN tenants.funcionalidades_config IS 'Funcionalidades customizadas para este tenant (sobrescreve o plano se funcionalidades_customizadas = true)';

-- ===================================================
-- 3. ATUALIZAR PLANOS EXISTENTES COM FUNCIONALIDADES
-- ===================================================

-- Plano Básico (limitado)
UPDATE plans 
SET funcionalidades = '{
  "whatsapp_api": true,
  "whatsapp_qr": true,
  "campanhas": true,
  "templates": true,
  "base_dados": true,
  "nova_vida": false,
  "lista_restricao": true,
  "webhooks": false,
  "catalogo": false,
  "dashboard": true,
  "relatorios": false,
  "envio_imediato": true
}'::jsonb
WHERE slug = 'basico';

-- Plano Pro (intermediário)
UPDATE plans 
SET funcionalidades = '{
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
WHERE slug = 'pro';

-- Plano Enterprise (tudo liberado)
UPDATE plans 
SET funcionalidades = '{
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
WHERE slug = 'enterprise';

-- Plano Teste (limitado)
UPDATE plans 
SET funcionalidades = '{
  "whatsapp_api": true,
  "whatsapp_qr": true,
  "campanhas": true,
  "templates": true,
  "base_dados": true,
  "nova_vida": false,
  "lista_restricao": false,
  "webhooks": false,
  "catalogo": false,
  "dashboard": true,
  "relatorios": false,
  "envio_imediato": false
}'::jsonb
WHERE slug = 'teste';

-- ===================================================
-- 4. CRIAR ÍNDICES PARA PERFORMANCE
-- ===================================================

CREATE INDEX IF NOT EXISTS idx_plans_funcionalidades ON plans USING gin(funcionalidades);
CREATE INDEX IF NOT EXISTS idx_tenants_funcionalidades_config ON tenants USING gin(funcionalidades_config);
CREATE INDEX IF NOT EXISTS idx_tenants_funcionalidades_customizadas ON tenants(funcionalidades_customizadas);

-- ===================================================
-- 5. FUNÇÃO PARA OBTER FUNCIONALIDADES DE UM TENANT
-- ===================================================

CREATE OR REPLACE FUNCTION get_tenant_funcionalidades(p_tenant_id INTEGER)
RETURNS JSONB AS $$
DECLARE
  v_funcionalidades JSONB;
  v_customizado BOOLEAN;
BEGIN
  -- Buscar se tenant tem funcionalidades customizadas
  SELECT 
    t.funcionalidades_customizadas,
    CASE 
      WHEN t.funcionalidades_customizadas = true THEN t.funcionalidades_config
      ELSE p.funcionalidades
    END as funcionalidades
  INTO v_customizado, v_funcionalidades
  FROM tenants t
  LEFT JOIN plans p ON t.plan_id = p.id
  WHERE t.id = p_tenant_id;

  RETURN v_funcionalidades;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_tenant_funcionalidades IS 'Retorna as funcionalidades de um tenant (customizadas ou do plano)';

-- ===================================================
-- EXEMPLO DE USO DA FUNÇÃO
-- ===================================================

-- SELECT get_tenant_funcionalidades(1);
-- SELECT 
--   id, 
--   nome, 
--   get_tenant_funcionalidades(id) as funcionalidades
-- FROM tenants;

-- ===================================================
-- LISTA DE FUNCIONALIDADES DISPONÍVEIS
-- ===================================================

/*
FUNCIONALIDADES DO SISTEMA:

1. whatsapp_api         - WhatsApp API Oficial (contas, campanhas, templates)
2. whatsapp_qr          - WhatsApp QR Connect (UAZ, campanhas QR, templates QR)
3. campanhas            - Criar e gerenciar campanhas
4. templates            - Criar e gerenciar templates de mensagem
5. base_dados           - Importar e gerenciar base de contatos
6. nova_vida            - Consultas ao sistema Nova Vida
7. lista_restricao      - Gerenciar lista de restrição de contatos
8. webhooks             - Configurar webhooks
9. catalogo             - Gerenciar catálogo de produtos
10. dashboard           - Acessar dashboard com estatísticas
11. relatorios          - Gerar e baixar relatórios
12. envio_imediato      - Enviar mensagens imediatas (fora de campanha)

FORMATO DO JSON:
{
  "whatsapp_api": true/false,
  "whatsapp_qr": true/false,
  "campanhas": true/false,
  "templates": true/false,
  "base_dados": true/false,
  "nova_vida": true/false,
  "lista_restricao": true/false,
  "webhooks": true/false,
  "catalogo": true/false,
  "dashboard": true/false,
  "relatorios": true/false,
  "envio_imediato": true/false
}
*/

-- ===================================================
-- TESTES
-- ===================================================

-- Ver funcionalidades de todos os planos
-- SELECT id, nome, slug, funcionalidades FROM plans;

-- Ver tenants com customizações
-- SELECT id, nome, funcionalidades_customizadas, funcionalidades_config FROM tenants WHERE funcionalidades_customizadas = true;

-- Exemplo de customização para um tenant específico (desabilitar WhatsApp QR)
-- UPDATE tenants SET 
--   funcionalidades_customizadas = true,
--   funcionalidades_config = '{
--     "whatsapp_api": true,
--     "whatsapp_qr": false,
--     "campanhas": true,
--     "templates": true,
--     "base_dados": true,
--     "nova_vida": true,
--     "lista_restricao": true,
--     "webhooks": true,
--     "catalogo": true,
--     "dashboard": true,
--     "relatorios": true,
--     "envio_imediato": true
--   }'::jsonb
-- WHERE id = 1;

PRINT '✅ Sistema de controle de funcionalidades criado com sucesso!';



