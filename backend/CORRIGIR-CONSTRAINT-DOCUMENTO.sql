-- ============================================
-- CORREÇÃO CRÍTICA: Constraint de documento
-- ============================================
-- PROBLEMA: Constraint impede mesmo CPF em tenants diferentes
-- SOLUÇÃO: Mudar de UNIQUE(documento) para UNIQUE(documento, tenant_id)
-- ============================================

BEGIN;

-- 1. Remover constraint antiga (se existir)
ALTER TABLE base_dados_completa 
DROP CONSTRAINT IF EXISTS base_dados_completa_documento_key;

ALTER TABLE base_dados_completa 
DROP CONSTRAINT IF EXISTS base_dados_completa_documento_tenant_id_key;

-- 2. Criar nova constraint correta (documento + tenant_id)
ALTER TABLE base_dados_completa 
ADD CONSTRAINT base_dados_completa_documento_tenant_id_key 
UNIQUE (documento, tenant_id);

-- 3. Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_base_dados_documento_tenant 
ON base_dados_completa(documento, tenant_id);

-- 4. Verificar constraint criada
SELECT 
  constraint_name,
  constraint_type,
  table_name
FROM information_schema.table_constraints
WHERE table_name = 'base_dados_completa'
  AND constraint_type = 'UNIQUE';

COMMIT;

-- Mostrar resultado
SELECT 
  '✅ Constraint corrigida!' as status,
  'Agora permite o mesmo CPF em tenants diferentes' as descricao;

