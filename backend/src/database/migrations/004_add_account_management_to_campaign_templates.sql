-- Adicionar colunas para gerenciamento de contas em campanhas
-- Permite remover/adicionar contas durante execução da campanha

ALTER TABLE campaign_templates 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

ALTER TABLE campaign_templates 
ADD COLUMN IF NOT EXISTS consecutive_failures INTEGER DEFAULT 0;

ALTER TABLE campaign_templates 
ADD COLUMN IF NOT EXISTS last_error TEXT;

ALTER TABLE campaign_templates 
ADD COLUMN IF NOT EXISTS removed_at TIMESTAMP;

-- Adicionar configuração de limite de falhas nas campanhas
ALTER TABLE campaigns 
ADD COLUMN IF NOT EXISTS auto_remove_account_failures INTEGER DEFAULT 5;

-- Índice para melhorar performance
CREATE INDEX IF NOT EXISTS idx_campaign_templates_is_active ON campaign_templates(campaign_id, is_active);

-- Comentários para documentação
COMMENT ON COLUMN campaign_templates.is_active IS 'Indica se a conta está ativa na campanha (pode ser desativada manualmente ou automaticamente)';
COMMENT ON COLUMN campaign_templates.consecutive_failures IS 'Contador de falhas consecutivas para remoção automática';
COMMENT ON COLUMN campaign_templates.last_error IS 'Última mensagem de erro registrada';
COMMENT ON COLUMN campaign_templates.removed_at IS 'Data/hora em que a conta foi removida da campanha';
COMMENT ON COLUMN campaigns.auto_remove_account_failures IS 'Número de falhas consecutivas antes de remover conta automaticamente (0 = desabilitado)';

