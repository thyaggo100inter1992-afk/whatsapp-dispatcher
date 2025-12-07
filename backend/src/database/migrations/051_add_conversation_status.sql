-- Migration: Adicionar campo status às conversas para gerenciar filas
-- Status possíveis:
--   'broadcast' = Disparo (enviado por campanha/envio único, sem resposta do cliente)
--   'pending' = Pendente (cliente respondeu, aguardando atendente aceitar)
--   'open' = Aberto (atendente está atendendo esta conversa)
--   'archived' = Arquivado (atendimento encerrado)

-- Adicionar coluna status
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending';

-- Adicionar coluna para saber qual atendente está atendendo
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS attended_by_user_id INTEGER REFERENCES tenant_users(id) ON DELETE SET NULL;

-- Adicionar coluna para data de quando foi aceito
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP;

-- Criar índice para filtrar por status
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_tenant_status ON conversations(tenant_id, status);

-- Atualizar conversas existentes:
-- Se tem apenas mensagens outbound (sem resposta), marca como 'broadcast'
-- Se está arquivada, marca como 'archived'
-- Se tem mensagens inbound não lidas, marca como 'pending'
-- Senão, marca como 'open' (já está sendo atendida)

-- Primeiro marcar arquivadas
UPDATE conversations 
SET status = 'archived' 
WHERE is_archived = true;

-- Marcar como broadcast: conversas que só têm mensagens outbound (disparos sem resposta)
UPDATE conversations c
SET status = 'broadcast'
WHERE c.is_archived = false 
AND NOT EXISTS (
    SELECT 1 FROM conversation_messages cm 
    WHERE cm.conversation_id = c.id 
    AND cm.message_direction = 'inbound'
);

-- Marcar como pending: conversas com mensagens inbound não lidas por agente
UPDATE conversations c
SET status = 'pending'
WHERE c.is_archived = false 
AND c.status != 'broadcast'
AND EXISTS (
    SELECT 1 FROM conversation_messages cm 
    WHERE cm.conversation_id = c.id 
    AND cm.message_direction = 'inbound'
    AND cm.is_read_by_agent = false
);

-- O resto fica como 'open' (conversas ativas com atendente)
UPDATE conversations 
SET status = 'open'
WHERE is_archived = false 
AND status NOT IN ('broadcast', 'pending', 'archived');

-- Comentário de verificação
COMMENT ON COLUMN conversations.status IS 'Status da conversa: broadcast (disparo sem resposta), pending (aguardando atendente), open (em atendimento), archived (encerrada)';

