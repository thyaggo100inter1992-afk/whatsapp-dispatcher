-- Criar tabela de jobs de verificação em massa
CREATE TABLE IF NOT EXISTS uaz_verification_jobs (
  id SERIAL PRIMARY KEY,
  user_identifier VARCHAR(100),
  instance_ids INTEGER[] NOT NULL,
  numbers TEXT[] NOT NULL,
  delay_seconds DECIMAL(4,1) DEFAULT 2,
  status VARCHAR(20) DEFAULT 'pending', -- pending, running, paused, completed, cancelled, error
  progress_current INTEGER DEFAULT 0,
  progress_total INTEGER NOT NULL,
  results JSONB DEFAULT '[]'::jsonb,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_uaz_verification_jobs_status 
  ON uaz_verification_jobs(status);

CREATE INDEX IF NOT EXISTS idx_uaz_verification_jobs_user 
  ON uaz_verification_jobs(user_identifier);

CREATE INDEX IF NOT EXISTS idx_uaz_verification_jobs_created 
  ON uaz_verification_jobs(created_at DESC);

-- Comentários
COMMENT ON TABLE uaz_verification_jobs IS 'Jobs de verificação em massa que rodam em background';
COMMENT ON COLUMN uaz_verification_jobs.status IS 'Status do job: pending, running, paused, completed, cancelled, error';
COMMENT ON COLUMN uaz_verification_jobs.results IS 'Array JSON com os resultados das verificações';






