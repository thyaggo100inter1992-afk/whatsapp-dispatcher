-- ============================================
-- MULTI-TENANT MIGRATION 001
-- Data: 2024-11-20
-- Descrição: Criar tabelas de controle do sistema multi-tenant
-- ============================================

-- ============================================
-- TABELA: tenants (Clientes/Inquilinos)
-- ============================================

CREATE TABLE IF NOT EXISTS tenants (
  id SERIAL PRIMARY KEY,
  uuid UUID DEFAULT gen_random_uuid() UNIQUE,
  
  -- Identificação
  nome VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  telefone VARCHAR(20),
  documento VARCHAR(20), -- CPF/CNPJ do cliente
  
  -- Configuração do Plano
  plano VARCHAR(50) DEFAULT 'basico', -- basico, pro, enterprise, custom
  status VARCHAR(50) DEFAULT 'trial', -- trial, active, suspended, cancelled
  
  -- Limites do Plano
  limite_campanhas_mes INTEGER DEFAULT 10,
  limite_contatos_total INTEGER DEFAULT 1000,
  limite_instancias_whatsapp INTEGER DEFAULT 3,
  limite_usuarios INTEGER DEFAULT 5,
  limite_templates INTEGER DEFAULT 20,
  limite_storage_mb INTEGER DEFAULT 1000,
  limite_mensagens_mes INTEGER DEFAULT 10000,
  
  -- White Label / Personalização
  logo_url TEXT,
  cor_primaria VARCHAR(7) DEFAULT '#3b82f6',
  cor_secundaria VARCHAR(7) DEFAULT '#10b981',
  dominio_customizado VARCHAR(255),
  
  -- Configurações Avançadas (JSONB)
  configuracoes JSONB DEFAULT '{
    "notificacoes_email": true,
    "notificacoes_whatsapp": false,
    "relatorios_automaticos": true,
    "webhook_url": null,
    "api_key": null,
    "timezone": "America/Sao_Paulo",
    "idioma": "pt_BR"
  }'::jsonb,
  
  -- Integrações Externas por cliente (JSONB)
  integracoes JSONB DEFAULT '{
    "novavida": {
      "ativo": false,
      "usuario": null,
      "senha": null
    },
    "uaz": {
      "ativo": false,
      "server_url": null,
      "admin_token": null
    }
  }'::jsonb,
  
  -- Controle de Datas
  data_criacao TIMESTAMP DEFAULT NOW(),
  data_ativacao TIMESTAMP,
  data_expiracao TIMESTAMP,
  data_ultimo_acesso TIMESTAMP,
  data_ultima_cobranca TIMESTAMP,
  proximo_vencimento DATE,
  
  -- Controle
  ativo BOOLEAN DEFAULT true,
  trial_dias_restantes INTEGER DEFAULT 7,
  
  -- Observações internas
  notas_internas TEXT,
  origem_cadastro VARCHAR(100),
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status) WHERE ativo = true;
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_plano ON tenants(plano);
CREATE INDEX IF NOT EXISTS idx_tenants_vencimento ON tenants(proximo_vencimento);
CREATE INDEX IF NOT EXISTS idx_tenants_ativo ON tenants(ativo);

-- Comentários
COMMENT ON TABLE tenants IS 'Clientes/Inquilinos do sistema multi-tenant';
COMMENT ON COLUMN tenants.slug IS 'Identificador único amigável (ex: empresa-abc)';
COMMENT ON COLUMN tenants.configuracoes IS 'Configurações personalizadas por tenant (JSON)';
COMMENT ON COLUMN tenants.integracoes IS 'Credenciais de integrações externas por tenant (JSON)';

-- ============================================
-- TABELA: tenant_users (Usuários por Tenant)
-- ============================================

CREATE TABLE IF NOT EXISTS tenant_users (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  uuid UUID DEFAULT gen_random_uuid() UNIQUE,
  
  -- Dados do Usuário
  nome VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  senha_hash TEXT NOT NULL,
  avatar_url TEXT,
  telefone VARCHAR(20),
  
  -- Controle de Acesso
  role VARCHAR(50) DEFAULT 'user', -- super_admin, tenant_admin, manager, user, operator, viewer
  permissoes JSONB DEFAULT '[]'::jsonb,
  
  -- Status
  ativo BOOLEAN DEFAULT true,
  email_verificado BOOLEAN DEFAULT false,
  
  -- Tokens de Segurança
  token_verificacao TEXT,
  token_reset_senha TEXT,
  token_reset_expira TIMESTAMP,
  
  -- Auditoria
  ultimo_login TIMESTAMP,
  ultimo_ip VARCHAR(100),
  total_logins INTEGER DEFAULT 0,
  
  -- Preferências
  preferencias JSONB DEFAULT '{
    "notificacoes_email": true,
    "notificacoes_push": true,
    "tema": "light",
    "idioma": "pt_BR"
  }'::jsonb,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Cada tenant pode ter o mesmo email (mas unique dentro do tenant)
  UNIQUE(tenant_id, email)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant ON tenant_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_email ON tenant_users(email);
CREATE INDEX IF NOT EXISTS idx_tenant_users_ativo ON tenant_users(tenant_id, ativo);
CREATE INDEX IF NOT EXISTS idx_tenant_users_role ON tenant_users(role);

COMMENT ON TABLE tenant_users IS 'Usuários do sistema, associados a tenants';
COMMENT ON COLUMN tenant_users.role IS 'Papel do usuário: super_admin, tenant_admin, manager, user, operator, viewer';

-- ============================================
-- TABELA: subscriptions (Assinaturas)
-- ============================================

CREATE TABLE IF NOT EXISTS subscriptions (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Plano
  plano VARCHAR(50) NOT NULL,
  valor DECIMAL(10,2) NOT NULL,
  moeda VARCHAR(3) DEFAULT 'BRL',
  periodicidade VARCHAR(20) DEFAULT 'mensal', -- mensal, trimestral, anual
  
  -- Status
  status VARCHAR(50) DEFAULT 'active', -- active, cancelled, past_due, unpaid, trial
  
  -- Datas
  data_inicio TIMESTAMP NOT NULL,
  data_fim TIMESTAMP,
  proximo_pagamento TIMESTAMP,
  data_cancelamento TIMESTAMP,
  
  -- Gateway de Pagamento
  gateway VARCHAR(50), -- stripe, mercadopago, pagseguro, asaas
  gateway_subscription_id VARCHAR(255),
  gateway_customer_id VARCHAR(255),
  
  -- Cupom/Desconto
  cupom_codigo VARCHAR(50),
  cupom_desconto_percentual DECIMAL(5,2),
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_proximo_pag ON subscriptions(proximo_pagamento);

COMMENT ON TABLE subscriptions IS 'Assinaturas e planos dos tenants';

-- ============================================
-- TABELA: payments (Pagamentos)
-- ============================================

CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  subscription_id INTEGER REFERENCES subscriptions(id),
  
  -- Valor
  valor DECIMAL(10,2) NOT NULL,
  taxa DECIMAL(10,2) DEFAULT 0,
  valor_liquido DECIMAL(10,2),
  
  -- Status
  status VARCHAR(50) NOT NULL, -- pending, paid, failed, refunded, cancelled
  metodo VARCHAR(50), -- credit_card, boleto, pix, debit_card
  
  -- Gateway
  gateway VARCHAR(50),
  gateway_transaction_id VARCHAR(255),
  gateway_response JSONB,
  
  -- Datas
  data_pagamento TIMESTAMP,
  data_vencimento DATE,
  
  -- Nota Fiscal
  nf_numero VARCHAR(50),
  nf_url TEXT,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_tenant ON payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_data ON payments(data_pagamento DESC);

COMMENT ON TABLE payments IS 'Histórico de pagamentos dos tenants';

-- ============================================
-- TABELA: tenant_usage (Métricas de Uso)
-- ============================================

CREATE TABLE IF NOT EXISTS tenant_usage (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Período
  data_referencia DATE NOT NULL,
  
  -- Contadores
  campanhas_criadas INTEGER DEFAULT 0,
  campanhas_ativas INTEGER DEFAULT 0,
  mensagens_enviadas INTEGER DEFAULT 0,
  mensagens_entregues INTEGER DEFAULT 0,
  mensagens_lidas INTEGER DEFAULT 0,
  mensagens_falhadas INTEGER DEFAULT 0,
  contatos_ativos INTEGER DEFAULT 0,
  contatos_novos INTEGER DEFAULT 0,
  instancias_ativas INTEGER DEFAULT 0,
  templates_criados INTEGER DEFAULT 0,
  storage_usado_mb INTEGER DEFAULT 0,
  usuarios_ativos INTEGER DEFAULT 0,
  
  -- API Calls (se tiver API pública)
  api_calls_total INTEGER DEFAULT 0,
  api_calls_sucesso INTEGER DEFAULT 0,
  api_calls_erro INTEGER DEFAULT 0,
  
  -- Consultas Externas
  consultas_novavida INTEGER DEFAULT 0,
  consultas_uaz INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(tenant_id, data_referencia)
);

CREATE INDEX IF NOT EXISTS idx_usage_tenant_date ON tenant_usage(tenant_id, data_referencia DESC);

COMMENT ON TABLE tenant_usage IS 'Métricas de uso por tenant (para billing e limites)';

-- ============================================
-- TABELA: audit_logs (Logs de Auditoria)
-- ============================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES tenant_users(id) ON DELETE SET NULL,
  
  -- Ação
  acao VARCHAR(100) NOT NULL, -- create, update, delete, login, logout
  entidade VARCHAR(100), -- campaign, contact, template, whatsapp_account
  entidade_id INTEGER,
  
  -- Dados
  dados_antes JSONB,
  dados_depois JSONB,
  
  -- Request Info
  ip_address VARCHAR(100),
  user_agent TEXT,
  metodo_http VARCHAR(10),
  url_path TEXT,
  
  -- Resultado
  sucesso BOOLEAN DEFAULT true,
  erro_mensagem TEXT,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entidade ON audit_logs(entidade, entidade_id);
CREATE INDEX IF NOT EXISTS idx_audit_acao ON audit_logs(acao);

COMMENT ON TABLE audit_logs IS 'Logs de auditoria de ações dos usuários';

-- ============================================
-- TABELA: schema_migrations (Controle)
-- ============================================

CREATE TABLE IF NOT EXISTS schema_migrations (
  id SERIAL PRIMARY KEY,
  version INTEGER NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  applied_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE schema_migrations IS 'Controle de migrations aplicadas';

-- Registrar esta migration
INSERT INTO schema_migrations (version, name, applied_at) 
VALUES (1, 'create_control_tables', NOW())
ON CONFLICT (version) DO NOTHING;

-- ============================================
-- FIM DA MIGRATION 001
-- ============================================

-- Log de sucesso
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 001: Tabelas de controle criadas com sucesso!';
  RAISE NOTICE '   - tenants';
  RAISE NOTICE '   - tenant_users';
  RAISE NOTICE '   - subscriptions';
  RAISE NOTICE '   - payments';
  RAISE NOTICE '   - tenant_usage';
  RAISE NOTICE '   - audit_logs';
  RAISE NOTICE '   - schema_migrations';
END $$;





