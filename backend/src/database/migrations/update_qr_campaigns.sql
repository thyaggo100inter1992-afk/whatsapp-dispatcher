-- ============================================
-- ATUALIZAÇÃO: CAMPANHAS QR CONNECT
-- Adicionar colunas faltantes para paridade 100%
-- ============================================

-- Adicionar colunas na tabela qr_campaigns
ALTER TABLE qr_campaigns 
ADD COLUMN IF NOT EXISTS no_whatsapp_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS button_clicks_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS auto_remove_account_failures INT DEFAULT 0;

-- Adicionar colunas de rastreamento de remoções em qr_campaign_templates
ALTER TABLE qr_campaign_templates
ADD COLUMN IF NOT EXISTS removal_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS permanent_removal BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS removal_history JSONB DEFAULT '[]'::jsonb;

-- Comentários
COMMENT ON COLUMN qr_campaigns.no_whatsapp_count IS 'Contador de números sem WhatsApp';
COMMENT ON COLUMN qr_campaigns.button_clicks_count IS 'Contador de cliques em botões';
COMMENT ON COLUMN qr_campaigns.auto_remove_account_failures IS 'Número de falhas para remoção automática (0=desabilitado)';
COMMENT ON COLUMN qr_campaign_templates.removal_count IS 'Quantas vezes a instância foi removida';
COMMENT ON COLUMN qr_campaign_templates.permanent_removal IS 'Se foi removida permanentemente';
COMMENT ON COLUMN qr_campaign_templates.removal_history IS 'Histórico de remoções e reativações';

-- ============================================
-- PRONTO! ✅
-- ============================================
-- Execute: psql -U postgres -d whatsapp_dispatcher -f update_qr_campaigns.sql
-- ============================================








