-- =====================================================
-- MIGRATION: UAZ API TABLES
-- Descrição: Cria tabelas para integração com UAZ API
-- Data: 2024
-- =====================================================

-- Tabela de Instâncias UAZ
CREATE TABLE IF NOT EXISTS uaz_instances (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    session_name VARCHAR(255) NOT NULL UNIQUE,
    instance_token VARCHAR(500),
    phone_number VARCHAR(50),
    is_connected BOOLEAN DEFAULT FALSE,
    qr_code TEXT,
    status VARCHAR(50) DEFAULT 'disconnected',
    webhook_url VARCHAR(500),
    proxy_id INTEGER REFERENCES proxies(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_connected_at TIMESTAMP,
    CONSTRAINT unique_session_name UNIQUE(session_name)
);

-- Tabela de Mensagens UAZ
CREATE TABLE IF NOT EXISTS uaz_messages (
    id SERIAL PRIMARY KEY,
    instance_id INTEGER NOT NULL REFERENCES uaz_instances(id) ON DELETE CASCADE,
    phone_number VARCHAR(50) NOT NULL,
    contact_name VARCHAR(255),
    message_type VARCHAR(50) DEFAULT 'text',
    message_content TEXT,
    media_url VARCHAR(1000),
    status VARCHAR(50) DEFAULT 'pending',
    message_id VARCHAR(255),
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_uaz_instances_session ON uaz_instances(session_name);
CREATE INDEX IF NOT EXISTS idx_uaz_instances_status ON uaz_instances(status);
CREATE INDEX IF NOT EXISTS idx_uaz_instances_active ON uaz_instances(is_active);
CREATE INDEX IF NOT EXISTS idx_uaz_messages_instance ON uaz_messages(instance_id);
CREATE INDEX IF NOT EXISTS idx_uaz_messages_phone ON uaz_messages(phone_number);
CREATE INDEX IF NOT EXISTS idx_uaz_messages_status ON uaz_messages(status);
CREATE INDEX IF NOT EXISTS idx_uaz_messages_created ON uaz_messages(created_at DESC);

-- Tabela de Campanhas UAZ (para FASE 2)
CREATE TABLE IF NOT EXISTS uaz_campaigns (
    id SERIAL PRIMARY KEY,
    instance_id INTEGER NOT NULL REFERENCES uaz_instances(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    total_contacts INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    delivered_count INTEGER DEFAULT 0,
    read_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    scheduled_at TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Adicionar campo de tipo ao proxy (para proxy rotativo)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'proxies' AND column_name = 'type'
    ) THEN
        ALTER TABLE proxies ADD COLUMN type VARCHAR(20) DEFAULT 'fixed';
        ALTER TABLE proxies ADD COLUMN rotation_interval INTEGER;
        ALTER TABLE proxies ADD COLUMN proxy_pool JSONB;
        
        -- Comentários nas colunas novas
        COMMENT ON COLUMN proxies.type IS 'Tipo: fixed (fixo) ou rotating (rotativo)';
        COMMENT ON COLUMN proxies.proxy_pool IS 'Pool de proxies para rotação (JSON array)';
    END IF;
END $$;

-- Comentários nas tabelas
COMMENT ON TABLE uaz_instances IS 'Instâncias/sessões do UAZ API';
COMMENT ON TABLE uaz_messages IS 'Mensagens enviadas via UAZ API';
COMMENT ON TABLE uaz_campaigns IS 'Campanhas de envio em massa via UAZ API';
COMMENT ON COLUMN uaz_instances.session_name IS 'Nome único da sessão no UAZ';
COMMENT ON COLUMN uaz_instances.instance_token IS 'Token específico da instância';
COMMENT ON COLUMN uaz_instances.qr_code IS 'QR Code atual para conexão';

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_uaz_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER uaz_instances_updated_at
    BEFORE UPDATE ON uaz_instances
    FOR EACH ROW
    EXECUTE FUNCTION update_uaz_updated_at();

CREATE TRIGGER uaz_messages_updated_at
    BEFORE UPDATE ON uaz_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_uaz_updated_at();

CREATE TRIGGER uaz_campaigns_updated_at
    BEFORE UPDATE ON uaz_campaigns
    FOR EACH ROW
    EXECUTE FUNCTION update_uaz_updated_at();

