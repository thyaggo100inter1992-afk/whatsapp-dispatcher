-- =====================================================
-- MIGRATION: Adicionar Telefone de Suporte
-- Descrição: Adiciona configuração de telefone de suporte no sistema
-- Data: 25/11/2024
-- =====================================================

-- Adicionar telefone de suporte nas configurações
INSERT INTO system_settings (setting_key, setting_value, setting_type, description, is_public)
VALUES 
    ('support_phone', '5562998449494', 'string', 'Telefone de WhatsApp do suporte (com código do país)', TRUE)
ON CONFLICT (setting_key) DO UPDATE
SET setting_value = EXCLUDED.setting_value,
    updated_at = NOW();

-- Adicionar nome do sistema (se não existir)
INSERT INTO system_settings (setting_key, setting_value, setting_type, description, is_public)
VALUES 
    ('system_name', 'Disparador WhatsApp', 'string', 'Nome do sistema exibido nas páginas', TRUE)
ON CONFLICT (setting_key) DO NOTHING;

-- Comentário
COMMENT ON TABLE system_settings IS 'Configurações globais do sistema (logo, nome, telefone de suporte, etc)';





