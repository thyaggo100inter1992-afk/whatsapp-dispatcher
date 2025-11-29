-- Adicionar coluna plan_id na tabela tenants
DO $$ BEGIN
    ALTER TABLE tenants ADD COLUMN plan_id INTEGER REFERENCES plans(id);
    EXCEPTION WHEN duplicate_column THEN RAISE NOTICE 'Coluna plan_id já existe em tenants.';
END $$;

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_tenants_plan_id ON tenants(plan_id);

-- Verificar estrutura
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'tenants' 
  AND column_name IN ('plan_id', 'plano')
ORDER BY ordinal_position;

SELECT 'Coluna plan_id adicionada com sucesso!' as status;



