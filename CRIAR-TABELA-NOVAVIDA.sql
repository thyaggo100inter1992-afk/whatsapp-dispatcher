-- ============================================
-- TABELA DE CONSULTAS NOVA VIDA
-- ============================================

-- Tabela para histórico de consultas
CREATE TABLE IF NOT EXISTS novavida_consultas (
    id SERIAL PRIMARY KEY,
    tipo_documento VARCHAR(10) NOT NULL, -- 'CPF' ou 'CNPJ'
    documento VARCHAR(20) NOT NULL,
    resultado JSONB NOT NULL,
    user_identifier VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_novavida_consultas_documento 
    ON novavida_consultas(documento);

CREATE INDEX IF NOT EXISTS idx_novavida_consultas_tipo 
    ON novavida_consultas(tipo_documento);

CREATE INDEX IF NOT EXISTS idx_novavida_consultas_data 
    ON novavida_consultas(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_novavida_consultas_user 
    ON novavida_consultas(user_identifier);

-- ============================================
-- TABELA DE JOBS DE CONSULTA EM MASSA
-- ============================================

CREATE TABLE IF NOT EXISTS novavida_jobs (
    id SERIAL PRIMARY KEY,
    user_identifier VARCHAR(255) NOT NULL,
    documentos TEXT[] NOT NULL,
    delay_seconds INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'pending', -- pending, running, paused, completed, cancelled, error
    progress_current INTEGER DEFAULT 0,
    progress_total INTEGER DEFAULT 0,
    results JSONB DEFAULT '[]',
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices para jobs
CREATE INDEX IF NOT EXISTS idx_novavida_jobs_user 
    ON novavida_jobs(user_identifier);

CREATE INDEX IF NOT EXISTS idx_novavida_jobs_status 
    ON novavida_jobs(status);

CREATE INDEX IF NOT EXISTS idx_novavida_jobs_created 
    ON novavida_jobs(created_at DESC);

-- Comentários
COMMENT ON TABLE novavida_consultas IS 'Histórico de consultas individuais à API Nova Vida';
COMMENT ON TABLE novavida_jobs IS 'Jobs de consulta em massa à API Nova Vida';






