-- Adicionar campos de proxy à tabela messages
-- Para rastrear qual proxy foi usado em cada envio

ALTER TABLE messages
ADD COLUMN IF NOT EXISTS proxy_used BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS proxy_host VARCHAR(255),
ADD COLUMN IF NOT EXISTS proxy_type VARCHAR(20);

-- Comentários
COMMENT ON COLUMN messages.proxy_used IS 'Se a mensagem foi enviada através de um proxy';
COMMENT ON COLUMN messages.proxy_host IS 'Host do proxy usado (ex: 185.14.238.27:6302)';
COMMENT ON COLUMN messages.proxy_type IS 'Tipo do proxy usado (socks5, http, https)';

-- Índice para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_messages_proxy_used ON messages(proxy_used);

