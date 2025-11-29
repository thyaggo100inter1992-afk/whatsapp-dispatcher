-- ============================================
-- MIGRATION 043: Adicionar campo para mudança de plano agendada
-- Data: 2024-11-24
-- Descrição: Armazena downgrade agendado para próximo vencimento
-- ============================================

-- Adicionar campo para armazenar mudança de plano agendada
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS plan_change_scheduled_id INTEGER REFERENCES plans(id);

-- Comentário
COMMENT ON COLUMN tenants.plan_change_scheduled_id IS 'ID do plano agendado para mudança no próximo vencimento (downgrade)';

-- Criar índice
CREATE INDEX IF NOT EXISTS idx_tenants_plan_change_scheduled ON tenants(plan_change_scheduled_id) WHERE plan_change_scheduled_id IS NOT NULL;





