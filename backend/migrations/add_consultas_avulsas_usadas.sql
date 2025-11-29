-- Adicionar campo para rastrear consultas avulsas usadas
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS consultas_avulsas_usadas INTEGER DEFAULT 0;

COMMENT ON COLUMN tenants.consultas_avulsas_usadas IS 'Quantidade total de consultas avulsas já utilizadas (histórico acumulado)';

-- Criar índice
CREATE INDEX IF NOT EXISTS idx_tenants_consultas_avulsas_usadas ON tenants(consultas_avulsas_usadas);




