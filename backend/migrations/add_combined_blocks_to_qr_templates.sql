-- =============================================
-- ADICIONAR COLUNA combined_blocks
-- =============================================

-- Adicionar coluna combined_blocks na tabela qr_templates
ALTER TABLE qr_templates 
ADD COLUMN IF NOT EXISTS combined_blocks JSONB;

-- Comentário
COMMENT ON COLUMN qr_templates.combined_blocks IS 'Configuração de blocos para mensagens combinadas (múltiplos tipos de mensagem em sequência)';

-- Verificar se foi criada
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'qr_templates' 
  AND column_name = 'combined_blocks';








