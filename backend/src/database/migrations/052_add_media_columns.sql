-- Adicionar colunas de mídia na tabela conversation_messages
ALTER TABLE conversation_messages
ADD COLUMN IF NOT EXISTS media_id VARCHAR(255);

ALTER TABLE conversation_messages
ADD COLUMN IF NOT EXISTS media_type VARCHAR(100);

ALTER TABLE conversation_messages
ADD COLUMN IF NOT EXISTS media_url TEXT;

ALTER TABLE conversation_messages
ADD COLUMN IF NOT EXISTS button_text VARCHAR(255);

ALTER TABLE conversation_messages
ADD COLUMN IF NOT EXISTS button_payload VARCHAR(255);

-- Criar índice para media_id
CREATE INDEX IF NOT EXISTS idx_conversation_messages_media_id ON conversation_messages (media_id);

