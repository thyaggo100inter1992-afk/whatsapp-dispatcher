-- =====================================================
-- MIGRATION: Sistema de Configurações Globais
-- Descrição: Cria tabela para armazenar configurações do sistema (logo, cores, etc)
-- Data: 24/11/2024
-- =====================================================

-- ===================================
-- TABELA: Configurações do Sistema
-- ===================================
CREATE TABLE IF NOT EXISTS system_settings (
    id SERIAL PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    setting_type VARCHAR(50) DEFAULT 'string', -- string, json, boolean, number, file
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE, -- Se pode ser acessado sem autenticação
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_system_settings_public ON system_settings(is_public);

-- Comentários
COMMENT ON TABLE system_settings IS 'Configurações globais do sistema';
COMMENT ON COLUMN system_settings.setting_key IS 'Chave única da configuração';
COMMENT ON COLUMN system_settings.setting_value IS 'Valor da configuração (pode ser URL, JSON, etc)';
COMMENT ON COLUMN system_settings.setting_type IS 'Tipo do valor: string, json, boolean, number, file';
COMMENT ON COLUMN system_settings.is_public IS 'Se TRUE, pode ser acessado sem autenticação';

-- ===================================
-- Configurações Padrão
-- ===================================

-- Logo do Sistema
INSERT INTO system_settings (setting_key, setting_value, setting_type, description, is_public)
VALUES 
    ('system_logo', NULL, 'file', 'Logo principal do sistema exibida em todas as páginas', TRUE),
    ('system_name', 'Disparador NettSistemas', 'string', 'Nome do sistema', TRUE),
    ('system_primary_color', '#10b981', 'string', 'Cor primária do sistema (hex)', TRUE),
    ('system_secondary_color', '#3b82f6', 'string', 'Cor secundária do sistema (hex)', TRUE),
    ('system_favicon', NULL, 'file', 'Favicon do sistema', TRUE),
    ('login_background', NULL, 'file', 'Imagem de fundo da tela de login', TRUE),
    ('maintenance_mode', 'false', 'boolean', 'Modo de manutenção ativado', FALSE),
    ('allow_registration', 'true', 'boolean', 'Permitir novos registros', FALSE)
ON CONFLICT (setting_key) DO NOTHING;

-- ===================================
-- Função para atualizar updated_at
-- ===================================
CREATE OR REPLACE FUNCTION update_system_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_system_settings_updated_at
    BEFORE UPDATE ON system_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_system_settings_updated_at();

-- ===================================
-- Verificação
-- ===================================
SELECT 
    setting_key,
    setting_type,
    description,
    is_public
FROM system_settings
ORDER BY setting_key;

SELECT '✅ Tabela system_settings criada com sucesso!' as status;





