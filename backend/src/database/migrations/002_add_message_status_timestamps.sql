-- ===================================================================
-- Migration: Adicionar campos de timestamp para status das mensagens
-- Data: 2025-11-11
-- Descrição: Adiciona campos delivered_at, read_at e failed_at
--            para rastrear quando as mensagens foram entregues,
--            lidas ou falharam (via webhooks do WhatsApp)
-- ===================================================================

-- Adicionar colunas de timestamp se não existirem
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS read_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS failed_at TIMESTAMP;

-- Criar índice para busca rápida por status
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);
CREATE INDEX IF NOT EXISTS idx_messages_whatsapp_message_id ON messages(whatsapp_message_id);

-- Comentários nas colunas para documentação
COMMENT ON COLUMN messages.delivered_at IS 'Timestamp de quando a mensagem foi entregue (atualizado via webhook)';
COMMENT ON COLUMN messages.read_at IS 'Timestamp de quando a mensagem foi lida (atualizado via webhook)';
COMMENT ON COLUMN messages.failed_at IS 'Timestamp de quando a mensagem falhou (atualizado via webhook)';

-- Mostrar resultado
SELECT 
    column_name, 
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'messages' 
AND column_name IN ('delivered_at', 'read_at', 'failed_at', 'sent_at')
ORDER BY column_name;

