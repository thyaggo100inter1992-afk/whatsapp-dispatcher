-- Adicionar coluna is_consulta_avulsa à tabela novavida_jobs
ALTER TABLE novavida_jobs
ADD COLUMN IF NOT EXISTS is_consulta_avulsa BOOLEAN DEFAULT FALSE;

-- Comentário explicativo
COMMENT ON COLUMN novavida_jobs.is_consulta_avulsa IS 'Indica se o job está usando consultas avulsas (TRUE) ou consultas do plano (FALSE)';




