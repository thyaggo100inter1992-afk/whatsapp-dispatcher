-- Adicionar coluna batch_size na tabela novavida_jobs para processamento paralelo
ALTER TABLE novavida_jobs 
ADD COLUMN IF NOT EXISTS batch_size INTEGER DEFAULT 20;

-- Atualizar jobs existentes com valor padrão
UPDATE novavida_jobs 
SET batch_size = 20 
WHERE batch_size IS NULL;

-- Comentário
COMMENT ON COLUMN novavida_jobs.batch_size IS 'Quantidade de CPFs processados simultaneamente (processamento paralelo)';

