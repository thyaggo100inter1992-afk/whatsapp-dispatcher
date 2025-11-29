-- ============================================
-- MIGRATION 041: Criar tabela de planos
-- Data: 2024-11-24
-- Descrição: Criar tabela de planos com preços e limites
-- ============================================

-- Criar tabela de planos disponíveis
CREATE TABLE IF NOT EXISTS plans (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(50) NOT NULL UNIQUE,
  descricao TEXT,
  
  -- Preços
  preco_mensal DECIMAL(10,2) NOT NULL,
  preco_anual DECIMAL(10,2),
  
  -- Limites do Plano
  limite_usuarios INTEGER NOT NULL DEFAULT 5,
  limite_instancias_whatsapp INTEGER NOT NULL DEFAULT 3,
  limite_mensagens_mes INTEGER NOT NULL DEFAULT 10000,
  limite_campanhas_mes INTEGER NOT NULL DEFAULT 10,
  limite_contatos_total INTEGER NOT NULL DEFAULT 1000,
  limite_templates INTEGER NOT NULL DEFAULT 20,
  limite_storage_mb INTEGER NOT NULL DEFAULT 1000,
  
  -- Recursos inclusos
  recursos JSONB DEFAULT '{
    "api_acesso": false,
    "relatorios_avancados": false,
    "suporte_prioritario": false,
    "whitelabel": false,
    "webhook": false,
    "integracao_novavida": false,
    "backup_automatico": false
  }'::jsonb,
  
  -- Status
  ativo BOOLEAN DEFAULT true,
  destaque BOOLEAN DEFAULT false,
  ordem INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Inserir planos padrão
INSERT INTO plans (nome, slug, descricao, preco_mensal, preco_anual, limite_usuarios, limite_instancias_whatsapp, limite_mensagens_mes, limite_campanhas_mes, limite_contatos_total, ordem, recursos) VALUES
('Básico', 'basico', 'Ideal para começar', 97.00, 970.00, 3, 1, 5000, 5, 500, 1, '{
  "api_acesso": false,
  "relatorios_avancados": false,
  "suporte_prioritario": false,
  "whitelabel": false,
  "webhook": false,
  "integracao_novavida": false,
  "backup_automatico": false
}'::jsonb),

('Profissional', 'profissional', 'Para empresas em crescimento', 197.00, 1970.00, 10, 3, 20000, 20, 5000, 2, '{
  "api_acesso": true,
  "relatorios_avancados": true,
  "suporte_prioritario": true,
  "whitelabel": false,
  "webhook": true,
  "integracao_novavida": true,
  "backup_automatico": true
}'::jsonb),

('Empresarial', 'empresarial', 'Para grandes volumes', 497.00, 4970.00, 50, 10, 100000, 100, 50000, 3, '{
  "api_acesso": true,
  "relatorios_avancados": true,
  "suporte_prioritario": true,
  "whitelabel": true,
  "webhook": true,
  "integracao_novavida": true,
  "backup_automatico": true
}'::jsonb)
ON CONFLICT (slug) DO NOTHING;

-- Índices
CREATE INDEX IF NOT EXISTS idx_plans_ativo ON plans(ativo);
CREATE INDEX IF NOT EXISTS idx_plans_slug ON plans(slug);

-- Comentários
COMMENT ON TABLE plans IS 'Planos disponíveis para assinatura';
COMMENT ON COLUMN plans.recursos IS 'Recursos inclusos no plano (JSON)';





