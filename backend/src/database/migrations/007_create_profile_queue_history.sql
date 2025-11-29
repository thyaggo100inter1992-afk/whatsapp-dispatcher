-- Migration: Create profile_queue_history table
-- Description: Histórico de atualizações em massa de perfis de negócio
-- Created: 2025-01-XX

CREATE TABLE IF NOT EXISTS profile_queue_history (
  id SERIAL PRIMARY KEY,
  queue_id VARCHAR(255) UNIQUE NOT NULL,
  status VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  whatsapp_account_id INTEGER NOT NULL REFERENCES whatsapp_accounts(id) ON DELETE CASCADE,
  profile_data JSONB NOT NULL,
  fields_updated TEXT[] NOT NULL,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_profile_queue_status ON profile_queue_history(status);
CREATE INDEX IF NOT EXISTS idx_profile_queue_account ON profile_queue_history(whatsapp_account_id);
CREATE INDEX IF NOT EXISTS idx_profile_queue_created ON profile_queue_history(created_at);

-- Comentários
COMMENT ON TABLE profile_queue_history IS 'Histórico de atualizações em massa de perfis de negócio';
COMMENT ON COLUMN profile_queue_history.queue_id IS 'ID único da fila gerado pelo serviço';
COMMENT ON COLUMN profile_queue_history.status IS 'Status da operação: pending, processing, completed, failed';
COMMENT ON COLUMN profile_queue_history.profile_data IS 'Dados do perfil que foram atualizados (JSON)';
COMMENT ON COLUMN profile_queue_history.fields_updated IS 'Array com nomes dos campos atualizados';
COMMENT ON COLUMN profile_queue_history.error_message IS 'Mensagem de erro caso tenha falhado';

