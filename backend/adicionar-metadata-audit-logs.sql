-- Adicionar coluna 'metadata' à tabela audit_logs se não existir
DO $$ BEGIN
    ALTER TABLE audit_logs ADD COLUMN metadata JSONB;
    EXCEPTION WHEN duplicate_column THEN RAISE NOTICE 'Coluna metadata já existe em audit_logs.';
END $$;

-- Criar índice para metadata (para buscas rápidas)
CREATE INDEX IF NOT EXISTS idx_audit_logs_metadata ON audit_logs USING gin(metadata);

-- Verificar estrutura
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'audit_logs'
ORDER BY ordinal_position;



