-- ============================================
-- MIGRATION 040: Adicionar campos de Trial e Asaas
-- Data: 2024-11-24
-- Descrição: Adicionar trial_ends_at, blocked_at e campos Asaas
-- ============================================

-- Adicionar campos de controle de trial e bloqueio na tabela tenants
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS will_be_deleted_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS asaas_customer_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS asaas_subscription_id VARCHAR(100);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_tenants_trial_ends ON tenants(trial_ends_at) WHERE trial_ends_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tenants_blocked ON tenants(blocked_at) WHERE blocked_at IS NOT NULL;

-- Atualizar tenants existentes em trial para ter 3 dias de trial a partir de agora
UPDATE tenants 
SET trial_ends_at = NOW() + INTERVAL '3 days'
WHERE status = 'trial' AND trial_ends_at IS NULL;

-- Comentários
COMMENT ON COLUMN tenants.trial_ends_at IS 'Data de término do período trial (3 dias)';
COMMENT ON COLUMN tenants.blocked_at IS 'Data em que o tenant foi bloqueado por falta de pagamento';
COMMENT ON COLUMN tenants.will_be_deleted_at IS 'Data em que o tenant será deletado (7 dias após bloqueio)';
COMMENT ON COLUMN tenants.asaas_customer_id IS 'ID do cliente no Asaas';
COMMENT ON COLUMN tenants.asaas_subscription_id IS 'ID da assinatura no Asaas';





