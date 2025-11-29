-- Adicionar tenant_id à tabela template_queue_history
ALTER TABLE template_queue_history 
ADD COLUMN IF NOT EXISTS tenant_id INTEGER DEFAULT 1;

-- Criar índice para tenant_id
CREATE INDEX IF NOT EXISTS idx_template_queue_history_tenant_id 
ON template_queue_history(tenant_id);

-- Comentário
COMMENT ON COLUMN template_queue_history.tenant_id IS 'ID do tenant para multi-tenancy';




