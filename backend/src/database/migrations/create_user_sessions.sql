-- =====================================================
-- CONTROLE DE SESSÕES DE USUÁRIO
-- Previne múltiplos logins simultâneos do mesmo usuário
-- =====================================================

-- Criar tabela de sessões ativas
CREATE TABLE IF NOT EXISTS user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    tenant_id INTEGER NOT NULL,
    session_token VARCHAR(500) NOT NULL UNIQUE,
    device_info JSONB DEFAULT '{}',
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    last_activity TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT true,
    
    -- Foreign keys
    CONSTRAINT fk_user_sessions_user 
        FOREIGN KEY (user_id) 
        REFERENCES tenant_users(id) 
        ON DELETE CASCADE,
    
    CONSTRAINT fk_user_sessions_tenant 
        FOREIGN KEY (tenant_id) 
        REFERENCES tenants(id) 
        ON DELETE CASCADE
);

-- Índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_tenant_id ON user_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);

-- Função para limpar sessões expiradas automaticamente
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
    UPDATE user_sessions 
    SET is_active = false 
    WHERE expires_at < NOW() AND is_active = true;
END;
$$ LANGUAGE plpgsql;

-- Comentários na tabela
COMMENT ON TABLE user_sessions IS 'Armazena sessões ativas dos usuários para controle de acesso simultâneo';
COMMENT ON COLUMN user_sessions.session_token IS 'Token único da sessão (hash do JWT)';
COMMENT ON COLUMN user_sessions.device_info IS 'Informações do dispositivo (navegador, SO, etc)';
COMMENT ON COLUMN user_sessions.is_active IS 'Se false, a sessão foi invalidada por um novo login';

