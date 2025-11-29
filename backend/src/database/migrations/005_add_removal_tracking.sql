-- Adicionar rastreamento de remoções e histórico
-- Permite controlar remoções permanentes após 2x por falhas consecutivas

ALTER TABLE campaign_templates 
ADD COLUMN IF NOT EXISTS removal_count INTEGER DEFAULT 0;

ALTER TABLE campaign_templates 
ADD COLUMN IF NOT EXISTS permanent_removal BOOLEAN DEFAULT false;

ALTER TABLE campaign_templates 
ADD COLUMN IF NOT EXISTS removal_history JSONB DEFAULT '[]'::jsonb;

-- Comentários para documentação
COMMENT ON COLUMN campaign_templates.removal_count IS 'Contador de remoções por falhas consecutivas (não conta remoções por health)';
COMMENT ON COLUMN campaign_templates.permanent_removal IS 'Se true, conta foi removida permanentemente e só volta manualmente';
COMMENT ON COLUMN campaign_templates.removal_history IS 'Histórico JSON de todas as remoções: [{timestamp, reason, removal_number, reactivated_at}]';

-- Índice para melhorar performance
CREATE INDEX IF NOT EXISTS idx_campaign_templates_permanent_removal ON campaign_templates(campaign_id, permanent_removal);

