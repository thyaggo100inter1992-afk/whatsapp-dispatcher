-- ============================================
-- SISTEMA DE CHAT COMPLETO
-- ============================================
-- Criado em: 07/12/2025
-- Descrição: Sistema de conversação em tempo real
-- ============================================

-- Tabela de Conversas
CREATE TABLE IF NOT EXISTS conversations (
  id SERIAL PRIMARY KEY,
  phone_number VARCHAR(50) NOT NULL,
  contact_name VARCHAR(255),
  last_message_at TIMESTAMP,
  last_message_text TEXT,
  last_message_direction VARCHAR(10), -- 'inbound' ou 'outbound'
  unread_count INT DEFAULT 0,
  is_archived BOOLEAN DEFAULT FALSE,
  
  -- Relacionamentos
  tenant_id INT,
  whatsapp_account_id INT REFERENCES whatsapp_accounts(id) ON DELETE SET NULL,
  instance_id INT REFERENCES uaz_instances(id) ON DELETE SET NULL,
  
  -- Metadados
  metadata JSONB DEFAULT '{}', -- tags, notas, etc
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Índice único por telefone e tenant
  UNIQUE(phone_number, tenant_id)
);

-- Tabela de Mensagens do Chat
CREATE TABLE IF NOT EXISTS conversation_messages (
  id SERIAL PRIMARY KEY,
  conversation_id INT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  
  -- Direção e tipo
  message_direction VARCHAR(10) NOT NULL, -- 'inbound' (recebida) ou 'outbound' (enviada)
  message_type VARCHAR(50) DEFAULT 'text', -- text, image, video, audio, document, sticker, location
  
  -- Conteúdo
  message_content TEXT,
  media_url VARCHAR(1000),
  media_caption TEXT,
  media_filename VARCHAR(255),
  media_mimetype VARCHAR(100),
  
  -- IDs do WhatsApp
  whatsapp_message_id VARCHAR(255),
  context_message_id VARCHAR(255), -- Para respostas
  
  -- Status (apenas para outbound)
  status VARCHAR(50), -- sent, delivered, read, failed
  error_message TEXT,
  
  -- Quem enviou/recebeu
  sender_name VARCHAR(255), -- Nome de quem enviou
  sent_by_user_id INT, -- ID do usuário que enviou (se outbound)
  tenant_id INT,
  
  -- Timestamps
  sent_at TIMESTAMP DEFAULT NOW(),
  delivered_at TIMESTAMP,
  read_at TIMESTAMP,
  
  -- Controle de leitura pelo atendente
  is_read_by_agent BOOLEAN DEFAULT FALSE, -- Se o atendente já leu
  read_by_agent_at TIMESTAMP,
  read_by_agent_user_id INT,
  
  -- Metadados
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_conversations_phone ON conversations(phone_number);
CREATE INDEX IF NOT EXISTS idx_conversations_tenant ON conversations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_unread ON conversations(unread_count) WHERE unread_count > 0;
CREATE INDEX IF NOT EXISTS idx_conversations_whatsapp_account ON conversations(whatsapp_account_id);
CREATE INDEX IF NOT EXISTS idx_conversations_instance ON conversations(instance_id);
CREATE INDEX IF NOT EXISTS idx_conversations_archived ON conversations(is_archived);

CREATE INDEX IF NOT EXISTS idx_conversation_messages_conversation ON conversation_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_created ON conversation_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_direction ON conversation_messages(message_direction);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_whatsapp_id ON conversation_messages(whatsapp_message_id);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_tenant ON conversation_messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_unread ON conversation_messages(is_read_by_agent) WHERE is_read_by_agent = FALSE;

-- Comentários
COMMENT ON TABLE conversations IS 'Conversas do sistema de chat';
COMMENT ON TABLE conversation_messages IS 'Mensagens das conversas';

COMMENT ON COLUMN conversations.phone_number IS 'Número de telefone do cliente (com DDI)';
COMMENT ON COLUMN conversations.last_message_direction IS 'Direção da última mensagem: inbound ou outbound';
COMMENT ON COLUMN conversations.unread_count IS 'Contador de mensagens não lidas pelo atendente';
COMMENT ON COLUMN conversations.metadata IS 'Tags, notas internas, etc (JSON)';

COMMENT ON COLUMN conversation_messages.message_direction IS 'inbound = recebida do cliente | outbound = enviada para cliente';
COMMENT ON COLUMN conversation_messages.is_read_by_agent IS 'Se o atendente já visualizou esta mensagem';
COMMENT ON COLUMN conversation_messages.sent_by_user_id IS 'Usuário que enviou (se outbound)';

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_conversation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER conversations_updated_at
    BEFORE UPDATE ON conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_updated_at();

CREATE TRIGGER conversation_messages_updated_at
    BEFORE UPDATE ON conversation_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_updated_at();

-- ============================================
-- RLS (Row Level Security) para Multi-Tenant
-- ============================================

-- Habilitar RLS nas tabelas
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;

-- Política para conversations
DROP POLICY IF EXISTS conversations_tenant_isolation ON conversations;
CREATE POLICY conversations_tenant_isolation ON conversations
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::int);

-- Política para conversation_messages
DROP POLICY IF EXISTS conversation_messages_tenant_isolation ON conversation_messages;
CREATE POLICY conversation_messages_tenant_isolation ON conversation_messages
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::int);

-- ============================================
-- PRONTO! ✅
-- ============================================
-- Execute este arquivo para criar as tabelas:
-- psql -U postgres -d whatsapp_dispatcher -f 050_create_chat_system.sql
-- ============================================

