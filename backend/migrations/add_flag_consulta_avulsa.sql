-- Adicionar flag para identificar consultas feitas com créditos avulsos
ALTER TABLE novavida_consultas
ADD COLUMN IF NOT EXISTS is_consulta_avulsa BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN novavida_consultas.is_consulta_avulsa IS 'Indica se a consulta foi feita usando créditos avulsos (TRUE) ou do plano (FALSE)';

-- Criar índice para otimizar queries
CREATE INDEX IF NOT EXISTS idx_novavida_consultas_is_avulsa ON novavida_consultas(is_consulta_avulsa);
CREATE INDEX IF NOT EXISTS idx_novavida_consultas_tenant_avulsa ON novavida_consultas(tenant_id, is_consulta_avulsa);




