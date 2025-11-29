-- ============================================
-- Migration: Adicionar campos block_id e block_order
-- Tabela: qr_template_media
-- Data: 2025-11-17
-- Descrição: Suporte para carrosséis em mensagens combinadas
-- ============================================

-- Adicionar coluna block_id (ID do bloco em mensagens combinadas)
ALTER TABLE qr_template_media
ADD COLUMN IF NOT EXISTS block_id VARCHAR(100);

-- Adicionar coluna block_order (Ordem do bloco em mensagens combinadas)
ALTER TABLE qr_template_media
ADD COLUMN IF NOT EXISTS block_order INTEGER;

-- Comentários
COMMENT ON COLUMN qr_template_media.block_id IS 'ID do bloco em mensagens combinadas (para carrosséis dentro de combined)';
COMMENT ON COLUMN qr_template_media.block_order IS 'Ordem do bloco em mensagens combinadas';

-- Índice para melhorar performance em queries
CREATE INDEX IF NOT EXISTS idx_qr_template_media_block ON qr_template_media(block_id, block_order);








