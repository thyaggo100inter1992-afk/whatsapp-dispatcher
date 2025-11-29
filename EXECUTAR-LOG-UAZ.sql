-- =====================================================
-- CRIAR TABELA DE LOGS DE INSTÂNCIAS UAZ
-- Execute este arquivo no seu PostgreSQL
-- =====================================================

-- Tabela de Logs de Instâncias UAZ
CREATE TABLE IF NOT EXISTS uaz_instance_logs (
    id SERIAL PRIMARY KEY,
    instance_id INTEGER REFERENCES uaz_instances(id) ON DELETE CASCADE,
    instance_name VARCHAR(255),
    session_name VARCHAR(255),
    event_type VARCHAR(50) NOT NULL,
    event_description TEXT,
    old_value JSONB,
    new_value JSONB,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_uaz_logs_instance_id ON uaz_instance_logs(instance_id);
CREATE INDEX IF NOT EXISTS idx_uaz_logs_event_type ON uaz_instance_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_uaz_logs_created_at ON uaz_instance_logs(created_at);

-- Comentários
COMMENT ON TABLE uaz_instance_logs IS 'Histórico completo de eventos de cada instância UAZ';
COMMENT ON COLUMN uaz_instance_logs.event_type IS 'Tipos: created, connected, disconnected, deleted, updated, status_check, qr_code_generated, error';
COMMENT ON COLUMN uaz_instance_logs.event_description IS 'Descrição legível do evento';
COMMENT ON COLUMN uaz_instance_logs.old_value IS 'Valor anterior (para updates)';
COMMENT ON COLUMN uaz_instance_logs.new_value IS 'Valor novo (para updates)';
COMMENT ON COLUMN uaz_instance_logs.metadata IS 'Dados adicionais do evento (IP, user, etc)';

-- Inserir logs de criação para instâncias existentes
INSERT INTO uaz_instance_logs (instance_id, instance_name, session_name, event_type, event_description, new_value, created_at)
SELECT 
    id,
    name,
    session_name,
    'created',
    'Instância criada no sistema',
    jsonb_build_object(
        'name', name,
        'session_name', session_name,
        'is_active', is_active
    ),
    created_at
FROM uaz_instances
WHERE NOT EXISTS (
    SELECT 1 FROM uaz_instance_logs WHERE instance_id = uaz_instances.id AND event_type = 'created'
);

-- Mensagem de sucesso
DO $$
BEGIN
    RAISE NOTICE '✅ Tabela uaz_instance_logs criada com sucesso!';
    RAISE NOTICE '✅ Logs de criação inseridos para instâncias existentes!';
END $$;










