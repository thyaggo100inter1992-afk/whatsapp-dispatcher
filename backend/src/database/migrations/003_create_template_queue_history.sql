-- Tabela para histórico da fila de templates
CREATE TABLE IF NOT EXISTS template_queue_history (
  id SERIAL PRIMARY KEY,
  queue_id VARCHAR(255) NOT NULL UNIQUE,
  type VARCHAR(50) NOT NULL, -- 'create' ou 'delete'
  status VARCHAR(50) NOT NULL, -- 'pending', 'processing', 'completed', 'failed'
  
  whatsapp_account_id INTEGER NOT NULL,
  template_name VARCHAR(255) NOT NULL,
  template_data JSONB, -- Dados do template (para criar)
  
  error_message TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Índices para facilitar buscas
CREATE INDEX IF NOT EXISTS idx_queue_history_account_id ON template_queue_history(whatsapp_account_id);
CREATE INDEX IF NOT EXISTS idx_queue_history_status ON template_queue_history(status);
CREATE INDEX IF NOT EXISTS idx_queue_history_template_name ON template_queue_history(template_name);

-- Comentários
COMMENT ON TABLE template_queue_history IS 'Histórico de processamento da fila de templates';
COMMENT ON COLUMN template_queue_history.queue_id IS 'ID único do item na fila';
COMMENT ON COLUMN template_queue_history.type IS 'Tipo de operação: create ou delete';
COMMENT ON COLUMN template_queue_history.status IS 'Status: pending, processing, completed, failed';
COMMENT ON COLUMN template_queue_history.template_data IS 'JSON com os dados do template (usado para re-tentar)';

