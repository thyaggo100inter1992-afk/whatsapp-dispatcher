-- Adicionar coluna duracao_trial_dias se não existir
ALTER TABLE plans ADD COLUMN IF NOT EXISTS duracao_trial_dias INTEGER DEFAULT NULL;
COMMENT ON COLUMN plans.duracao_trial_dias IS 'Duração do período de teste em dias (NULL = não é plano teste)';

-- Adicionar colunas de controle de trial aos tenants
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP DEFAULT NULL;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMP DEFAULT NULL;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS will_be_deleted_at TIMESTAMP DEFAULT NULL;

COMMENT ON COLUMN tenants.trial_ends_at IS 'Data/hora em que o período de teste termina';
COMMENT ON COLUMN tenants.blocked_at IS 'Data/hora em que o tenant foi bloqueado (após trial expirar)';
COMMENT ON COLUMN tenants.will_be_deleted_at IS 'Data/hora em que o tenant será deletado automaticamente';

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_tenants_trial_ends_at ON tenants(trial_ends_at);
CREATE INDEX IF NOT EXISTS idx_tenants_blocked_at ON tenants(blocked_at);
CREATE INDEX IF NOT EXISTS idx_tenants_will_be_deleted_at ON tenants(will_be_deleted_at);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);

-- Criar plano de TESTE/TRIAL gratuito
INSERT INTO plans (
  nome,
  slug,
  descricao,
  preco_mensal,
  preco_anual,
  limite_usuarios,
  limite_contas_whatsapp,
  limite_campanhas_mes,
  limite_mensagens_dia,
  limite_consultas_mes,
  duracao_trial_dias,
  ativo,
  created_at
) VALUES (
  'Teste Grátis',
  'teste',
  'Plano de teste gratuito por 3 dias. Após 3 dias, a conta é bloqueada. Após 15 dias sem upgrade, a conta é deletada automaticamente.',
  0.00,
  0.00,
  2,              -- Limite de 2 usuários
  1,              -- Limite de 1 conta WhatsApp
  10,             -- 10 campanhas por mês
  100,            -- 100 mensagens por dia
  50,             -- 50 consultas Nova Vida por mês
  3,              -- 3 dias de trial
  true,
  NOW()
) ON CONFLICT (slug) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  duracao_trial_dias = 3,
  updated_at = NOW();

