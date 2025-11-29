-- ============================================
-- ADICIONAR COLUNA combined_blocks PARA TEMPLATES
-- ============================================
-- Armazena os blocos de mensagens combinadas
-- Ex: [{"id": "1", "type": "text", "order": 0, "text": "Olá!"}, ...]
-- ============================================

ALTER TABLE qr_templates
ADD COLUMN IF NOT EXISTS combined_blocks JSONB DEFAULT NULL;

COMMENT ON COLUMN qr_templates.combined_blocks IS 'Blocos de mensagens combinadas (sequência de diferentes tipos de mensagens)';

-- ============================================
-- FIM DA MIGRATION
-- ============================================








