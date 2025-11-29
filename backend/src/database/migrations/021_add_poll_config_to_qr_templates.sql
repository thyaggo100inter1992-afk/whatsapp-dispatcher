-- ============================================
-- ADICIONAR SUPORTE A ENQUETES (POLL)
-- ============================================
-- Adiciona a coluna poll_config para templates
-- do tipo 'poll' (enquete)
-- ============================================

-- Adicionar coluna poll_config
ALTER TABLE qr_templates 
ADD COLUMN IF NOT EXISTS poll_config JSONB;

-- Adicionar comentário
COMMENT ON COLUMN qr_templates.poll_config IS 'Configuração de enquete (poll): {options: [string], selectableCount: number}';

-- Atualizar comentário do tipo
COMMENT ON COLUMN qr_templates.type IS 'Tipo de mensagem: text, image, video, audio, audio_recorded, document, list, buttons, carousel, poll';

-- ============================================
-- FIM DA MIGRATION
-- ============================================









