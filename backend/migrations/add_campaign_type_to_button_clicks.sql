-- Migration: Adicionar campaign_type à tabela button_clicks
-- Data: 18/11/2024
-- Descrição: Distinguir entre campanhas WhatsApp Business API e QR Connect

-- Adicionar coluna campaign_type
ALTER TABLE button_clicks
ADD COLUMN IF NOT EXISTS campaign_type VARCHAR(20) DEFAULT 'whatsapp_api';

-- Atualizar registros existentes
-- Assumindo que todos os existentes são da API oficial
UPDATE button_clicks
SET campaign_type = 'whatsapp_api'
WHERE campaign_type IS NULL;

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_button_clicks_campaign_type 
ON button_clicks(campaign_type);

-- Criar índice composto
CREATE INDEX IF NOT EXISTS idx_button_clicks_campaign_id_type 
ON button_clicks(campaign_id, campaign_type);

-- Comentários
COMMENT ON COLUMN button_clicks.campaign_type IS 'Tipo de campanha: whatsapp_api ou qr_connect';

-- Verificar resultado
SELECT 
  campaign_type,
  COUNT(*) as total_clicks,
  COUNT(DISTINCT campaign_id) as unique_campaigns
FROM button_clicks
GROUP BY campaign_type;







