-- ============================================
-- ADD CONSULTAS LIMITS TO PLANS AND TENANTS
-- Data: 2024-11-25
-- Descrição: Adicionar campos de limite de consultas Nova Vida aos planos e tenants
-- ============================================

-- 1. Adicionar campos de limite de consultas à tabela plans
ALTER TABLE plans 
ADD COLUMN IF NOT EXISTS limite_consultas_dia INTEGER DEFAULT 50,
ADD COLUMN IF NOT EXISTS limite_consultas_mes INTEGER DEFAULT 500;

-- 2. Adicionar campos customizados à tabela tenants
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS limite_nova_vida_dia_customizado INTEGER,
ADD COLUMN IF NOT EXISTS limite_novavida_mes_customizado INTEGER,
ADD COLUMN IF NOT EXISTS consultas_avulsas_saldo INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS consultas_avulsas_usadas INTEGER DEFAULT 0;

-- 3. Atualizar planos existentes com limites padrão
-- Plano Básico: 50/dia, 500/mês
UPDATE plans 
SET 
  limite_consultas_dia = 50,
  limite_consultas_mes = 500
WHERE slug = 'basico';

-- Plano Profissional: 200/dia, 3000/mês
UPDATE plans 
SET 
  limite_consultas_dia = 200,
  limite_consultas_mes = 3000
WHERE slug = 'profissional';

-- Plano Empresarial: 1000/dia, 15000/mês (ou ilimitado: -1)
UPDATE plans 
SET 
  limite_consultas_dia = 1000,
  limite_consultas_mes = 15000
WHERE slug = 'empresarial';

-- 4. Comentários
COMMENT ON COLUMN plans.limite_consultas_dia IS 'Limite diário de consultas Nova Vida no plano';
COMMENT ON COLUMN plans.limite_consultas_mes IS 'Limite mensal de consultas Nova Vida no plano';
COMMENT ON COLUMN tenants.limite_nova_vida_dia_customizado IS 'Limite diário customizado de consultas (sobrescreve o do plano)';
COMMENT ON COLUMN tenants.limite_novavida_mes_customizado IS 'Limite mensal customizado de consultas (sobrescreve o do plano)';
COMMENT ON COLUMN tenants.consultas_avulsas_saldo IS 'Saldo de consultas avulsas compradas';
COMMENT ON COLUMN tenants.consultas_avulsas_usadas IS 'Total de consultas avulsas já utilizadas';

-- 5. Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_tenants_consultas_avulsas ON tenants(consultas_avulsas_saldo) 
WHERE consultas_avulsas_saldo > 0;




