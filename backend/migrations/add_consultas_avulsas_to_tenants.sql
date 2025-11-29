-- Adicionar campo de consultas avulsas na tabela tenants
-- Consultas avulsas são compradas separadamente e não expiram

-- Primeiro remover a coluna antiga se existir (por segurança)
ALTER TABLE tenants DROP COLUMN IF EXISTS consultas_avulsas;

-- Criar a coluna com o nome correto
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS consultas_avulsas_saldo INTEGER DEFAULT 0;

-- Adicionar comentário explicativo
COMMENT ON COLUMN tenants.consultas_avulsas_saldo IS 'Saldo de consultas avulsas compradas. Não expiram mensalmente e são consumidas após as consultas do plano.';

-- Criar índice para otimizar consultas
CREATE INDEX IF NOT EXISTS idx_tenants_consultas_avulsas_saldo ON tenants(consultas_avulsas_saldo);

-- Log da migration
INSERT INTO audit_logs (
  tenant_id,
  user_id,
  acao,
  entidade,
  metadata,
  created_at
) VALUES (
  NULL,
  NULL,
  'MIGRATION',
  'tenants',
  '{"migration": "add_consultas_avulsas_to_tenants", "description": "Adiciona campo de consultas avulsas aos tenants"}'::jsonb,
  NOW()
);

