-- Adicionar coluna tenant_id à tabela base_dados_completa
ALTER TABLE base_dados_completa
ADD COLUMN IF NOT EXISTS tenant_id INTEGER;

-- Criar índice para melhorar performance
CREATE INDEX IF NOT EXISTS idx_base_dados_tenant_id ON base_dados_completa(tenant_id);

-- Criar índice composto para buscas por documento e tenant
CREATE INDEX IF NOT EXISTS idx_base_dados_documento_tenant ON base_dados_completa(documento, tenant_id);

-- Comentário explicativo
COMMENT ON COLUMN base_dados_completa.tenant_id IS 'ID do tenant proprietário do registro';




