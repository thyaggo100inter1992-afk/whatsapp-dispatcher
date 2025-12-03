-- Criar tabela de histórico de verificações
CREATE TABLE IF NOT EXISTS uaz_verification_history (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  instance_id INTEGER NOT NULL REFERENCES uaz_instances(id) ON DELETE CASCADE,
  phone_number VARCHAR(20) NOT NULL,
  is_in_whatsapp BOOLEAN DEFAULT FALSE,
  verified_name VARCHAR(255),
  jid VARCHAR(255),
  error_message TEXT,
  verified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_verification_history_tenant ON uaz_verification_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_verification_history_instance ON uaz_verification_history(instance_id);
CREATE INDEX IF NOT EXISTS idx_verification_history_phone ON uaz_verification_history(phone_number);
CREATE INDEX IF NOT EXISTS idx_verification_history_verified_at ON uaz_verification_history(verified_at DESC);

-- RLS para uaz_verification_history
ALTER TABLE uaz_verification_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_verification_history ON uaz_verification_history;
CREATE POLICY tenant_isolation_verification_history ON uaz_verification_history
  USING (tenant_id = COALESCE(
    NULLIF(current_setting('app.current_tenant_id', TRUE), '')::INTEGER,
    (SELECT id FROM tenants LIMIT 1)
  ));

-- Criar tabela de jobs de verificação em massa
CREATE TABLE IF NOT EXISTS uaz_verification_jobs (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_identifier VARCHAR(255) DEFAULT 'default',
  instance_ids INTEGER[] NOT NULL,
  numbers TEXT[] NOT NULL,
  delay_seconds INTEGER DEFAULT 2,
  status VARCHAR(50) DEFAULT 'pending', -- pending, running, paused, completed, cancelled, error
  progress_current INTEGER DEFAULT 0,
  progress_total INTEGER NOT NULL,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_verification_jobs_tenant ON uaz_verification_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_verification_jobs_status ON uaz_verification_jobs(status);
CREATE INDEX IF NOT EXISTS idx_verification_jobs_user ON uaz_verification_jobs(user_identifier);
CREATE INDEX IF NOT EXISTS idx_verification_jobs_created_at ON uaz_verification_jobs(created_at DESC);

-- RLS para uaz_verification_jobs
ALTER TABLE uaz_verification_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_verification_jobs ON uaz_verification_jobs;
CREATE POLICY tenant_isolation_verification_jobs ON uaz_verification_jobs
  USING (tenant_id = COALESCE(
    NULLIF(current_setting('app.current_tenant_id', TRUE), '')::INTEGER,
    (SELECT id FROM tenants LIMIT 1)
  ));

-- Comentários
COMMENT ON TABLE uaz_verification_history IS 'Histórico de verificações de números no WhatsApp';
COMMENT ON TABLE uaz_verification_jobs IS 'Jobs de verificação em massa de números';

