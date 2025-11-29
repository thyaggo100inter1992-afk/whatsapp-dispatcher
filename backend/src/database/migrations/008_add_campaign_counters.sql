-- Adicionar contadores de 'sem WhatsApp' e 'cliques nos botões' às campanhas

ALTER TABLE campaigns 
ADD COLUMN IF NOT EXISTS no_whatsapp_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS button_clicks_count INTEGER DEFAULT 0;

-- Atualizar valores existentes baseados nos dados atuais
UPDATE campaigns SET no_whatsapp_count = (
    SELECT COUNT(*) 
    FROM messages 
    WHERE campaign_id = campaigns.id 
    AND status = 'failed' 
    AND (
        error_message ILIKE '%not registered%' 
        OR error_message ILIKE '%no whatsapp%'
        OR error_message ILIKE '%invalid phone%'
    )
);

UPDATE campaigns SET button_clicks_count = (
    SELECT COUNT(*) 
    FROM button_clicks 
    WHERE campaign_id = campaigns.id
);

-- Comentário explicativo
COMMENT ON COLUMN campaigns.no_whatsapp_count IS 'Contador de números que não possuem WhatsApp';
COMMENT ON COLUMN campaigns.button_clicks_count IS 'Contador total de cliques nos botões da campanha';





