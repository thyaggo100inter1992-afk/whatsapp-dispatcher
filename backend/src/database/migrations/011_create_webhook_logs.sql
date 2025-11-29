-- ===================================================================
-- Migration: Criar tabela para logs de webhooks
-- Data: 2025-11-14
-- Descrição: Armazena histórico de todos os webhooks recebidos do WhatsApp
--            para debugging e monitoramento
-- ===================================================================

-- Tabela de logs de webhooks recebidos
CREATE TABLE IF NOT EXISTS webhook_logs (
    id SERIAL PRIMARY KEY,
    
    -- Tipo de requisição
    request_type VARCHAR(20) NOT NULL, -- 'verification' ou 'notification'
    request_method VARCHAR(10) NOT NULL, -- GET ou POST
    
    -- Dados da verificação (GET)
    verify_mode VARCHAR(50),
    verify_token VARCHAR(255),
    verify_challenge TEXT,
    verification_success BOOLEAN,
    
    -- Dados da notificação (POST)
    webhook_object VARCHAR(100), -- 'whatsapp_business_account'
    event_type VARCHAR(50), -- 'messages', 'message_status', etc
    
    -- Payload completo recebido
    request_body JSONB,
    request_query JSONB,
    request_headers JSONB,
    
    -- Status do processamento
    processing_status VARCHAR(50) DEFAULT 'success', -- success, failed, partial
    processing_error TEXT,
    
    -- Resultados processados
    messages_processed INTEGER DEFAULT 0,
    statuses_processed INTEGER DEFAULT 0,
    clicks_detected INTEGER DEFAULT 0,
    
    -- Timestamp
    received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP,
    
    -- Identificação da conta (se detectada)
    whatsapp_account_id INTEGER REFERENCES whatsapp_accounts(id) ON DELETE SET NULL,
    
    -- Metadata
    ip_address VARCHAR(50),
    user_agent TEXT
);

-- Índices para busca rápida
CREATE INDEX IF NOT EXISTS idx_webhook_logs_received_at ON webhook_logs(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_request_type ON webhook_logs(request_type);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_whatsapp_account ON webhook_logs(whatsapp_account_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_processing_status ON webhook_logs(processing_status);

-- Comentários para documentação
COMMENT ON TABLE webhook_logs IS 'Histórico de todos os webhooks recebidos do WhatsApp para debugging';
COMMENT ON COLUMN webhook_logs.request_type IS 'Tipo: verification (GET inicial) ou notification (POST com atualizações)';
COMMENT ON COLUMN webhook_logs.processing_status IS 'Status do processamento: success, failed, partial';

-- Mostrar resultado
SELECT 
    'Tabela webhook_logs criada com sucesso!' as status,
    COUNT(*) as total_logs
FROM webhook_logs;

