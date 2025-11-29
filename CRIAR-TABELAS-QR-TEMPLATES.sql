-- ============================================
-- SISTEMA DE TEMPLATES QR CONNECT
-- ============================================
-- Criação das tabelas para armazenar templates
-- reutilizáveis do WhatsApp QR Connect (UAZ)
-- ============================================

-- Tabela principal de templates QR Connect
CREATE TABLE IF NOT EXISTS qr_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    type VARCHAR(50) NOT NULL, -- 'text', 'image', 'video', 'audio', 'audio_recorded', 'document', 'list', 'buttons', 'carousel'
    
    -- Conteúdo de texto
    text_content TEXT,
    
    -- Configurações de Menu Lista
    list_config JSONB, -- {buttonText, title, sections: [{title, rows: [{id, title, description}]}]}
    
    -- Configurações de Menu Botões
    buttons_config JSONB, -- {text, buttons: [{id, text}]}
    
    -- Configurações de Carrossel
    carousel_config JSONB, -- {cards: [{header: {type, url}, body, footer, buttons: [{type, text}]}]}
    
    -- Metadados
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_qr_templates_type ON qr_templates(type);
CREATE INDEX IF NOT EXISTS idx_qr_templates_name ON qr_templates(name);

-- Tabela de mídias dos templates
CREATE TABLE IF NOT EXISTS qr_template_media (
    id SERIAL PRIMARY KEY,
    template_id INTEGER NOT NULL REFERENCES qr_templates(id) ON DELETE CASCADE,
    media_type VARCHAR(50) NOT NULL, -- 'image', 'video', 'audio', 'audio_recorded', 'document'
    
    -- Arquivo salvo localmente
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL, -- caminho físico no servidor
    file_size BIGINT, -- tamanho em bytes
    mime_type VARCHAR(100),
    
    -- Metadados opcionais
    caption TEXT, -- legenda para imagem/vídeo
    duration INTEGER, -- duração em segundos (para áudio/vídeo)
    
    -- Específico para carrossel (qual card)
    carousel_card_index INTEGER, -- null se não for carrossel
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_qr_template_media_template_id ON qr_template_media(template_id);
CREATE INDEX IF NOT EXISTS idx_qr_template_media_type ON qr_template_media(media_type);

-- Comentários explicativos
COMMENT ON TABLE qr_templates IS 'Templates reutilizáveis do WhatsApp QR Connect';
COMMENT ON COLUMN qr_templates.type IS 'Tipo de mensagem: text, image, video, audio, audio_recorded, document, list, buttons, carousel';
COMMENT ON COLUMN qr_templates.list_config IS 'Configuração completa do menu tipo lista';
COMMENT ON COLUMN qr_templates.buttons_config IS 'Configuração completa do menu tipo botões';
COMMENT ON COLUMN qr_templates.carousel_config IS 'Configuração completa do carrossel';

COMMENT ON TABLE qr_template_media IS 'Mídias anexadas aos templates (arquivos salvos no servidor)';
COMMENT ON COLUMN qr_template_media.file_path IS 'Caminho físico do arquivo no servidor';
COMMENT ON COLUMN qr_template_media.carousel_card_index IS 'Índice do card no carrossel (0-based), NULL se não for carrossel';

-- ============================================
-- FIM DO SCHEMA
-- ============================================










