-- ===================================================================
-- FIX: Criar tabela webhook_logs se não existir
-- Execute este script no seu banco de dados
-- ===================================================================

-- Verificar se a tabela já existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'webhook_logs') THEN
        -- Criar a tabela
        CREATE TABLE webhook_logs (
            id SERIAL PRIMARY KEY,
            
            -- Tipo de requisição
            request_type VARCHAR(20) NOT NULL,
            request_method VARCHAR(10) NOT NULL,
            
            -- Dados da verificação (GET)
            verify_mode VARCHAR(50),
            verify_token VARCHAR(255),
            verify_challenge TEXT,
            verification_success BOOLEAN,
            
            -- Dados da notificação (POST)
            webhook_object VARCHAR(100),
            event_type VARCHAR(50),
            
            -- Payload completo recebido
            request_body JSONB,
            request_query JSONB,
            request_headers JSONB,
            
            -- Status do processamento
            processing_status VARCHAR(50) DEFAULT 'success',
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
        CREATE INDEX idx_webhook_logs_received_at ON webhook_logs(received_at DESC);
        CREATE INDEX idx_webhook_logs_request_type ON webhook_logs(request_type);
        CREATE INDEX idx_webhook_logs_whatsapp_account ON webhook_logs(whatsapp_account_id);
        CREATE INDEX idx_webhook_logs_processing_status ON webhook_logs(processing_status);

        RAISE NOTICE '✅ Tabela webhook_logs criada com sucesso!';
    ELSE
        RAISE NOTICE '⚠️ Tabela webhook_logs já existe!';
    END IF;
END $$;

-- Verificar resultado
SELECT 
    'webhook_logs' as tabela,
    COUNT(*) as total_registros
FROM webhook_logs;

SELECT '✅ Migration aplicada com sucesso!' as status;

