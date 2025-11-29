-- ============================================
-- Migration: Adicionar campos url e original_name
-- Tabela: qr_template_media
-- Data: 2025-11-16
-- ============================================

-- Adicionar coluna url
ALTER TABLE qr_template_media
ADD COLUMN IF NOT EXISTS url VARCHAR(500);

-- Adicionar coluna original_name
ALTER TABLE qr_template_media
ADD COLUMN IF NOT EXISTS original_name VARCHAR(255);

-- Comentários
COMMENT ON COLUMN qr_template_media.url IS 'URL relativa do arquivo de mídia (ex: /uploads/media/arquivo.pdf)';
COMMENT ON COLUMN qr_template_media.original_name IS 'Nome original do arquivo antes do upload';








