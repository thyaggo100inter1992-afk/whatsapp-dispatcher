-- ============================================
-- CRIAÇÃO DA TABELA DE PLANOS
-- ============================================

-- Tabela de planos do sistema
CREATE TABLE IF NOT EXISTS plans (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(100) NOT NULL UNIQUE,
  descricao TEXT,
  preco_mensal DECIMAL(10, 2) DEFAULT 0,
  preco_anual DECIMAL(10, 2) DEFAULT 0,
  
  -- Limites de uso
  limite_usuarios INTEGER DEFAULT 1,
  limite_contas_whatsapp INTEGER DEFAULT 1,
  limite_campanhas_mes INTEGER DEFAULT 10,
  limite_mensagens_dia INTEGER DEFAULT 100,
  limite_mensagens_mes INTEGER DEFAULT 3000,
  limite_templates INTEGER DEFAULT 5,
  limite_contatos INTEGER DEFAULT 1000,
  
  -- Limites de consultas (Nova Vida ou outro sistema de consulta)
  limite_consultas_dia INTEGER DEFAULT 10,
  limite_consultas_mes INTEGER DEFAULT 300,
  permite_consulta_cpf BOOLEAN DEFAULT true,
  permite_consulta_cnpj BOOLEAN DEFAULT true,
  permite_consulta_telefone BOOLEAN DEFAULT false,
  
  -- Recursos disponíveis
  permite_api_oficial BOOLEAN DEFAULT true,
  permite_qr_connect BOOLEAN DEFAULT true,
  permite_webhook BOOLEAN DEFAULT true,
  permite_agendamento BOOLEAN DEFAULT true,
  permite_relatorios BOOLEAN DEFAULT false,
  permite_export_dados BOOLEAN DEFAULT false,
  suporte_prioritario BOOLEAN DEFAULT false,
  
  -- Status
  ativo BOOLEAN DEFAULT true,
  visivel BOOLEAN DEFAULT true,
  ordem INTEGER DEFAULT 0,
  
  -- Metadados
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Inserir planos padrão
INSERT INTO plans (nome, slug, descricao, preco_mensal, preco_anual, 
  limite_usuarios, limite_contas_whatsapp, limite_campanhas_mes, 
  limite_mensagens_dia, limite_mensagens_mes, limite_templates, limite_contatos,
  limite_consultas_dia, limite_consultas_mes,
  permite_consulta_cpf, permite_consulta_cnpj, permite_consulta_telefone,
  permite_relatorios, permite_export_dados, suporte_prioritario, ordem, ativo, visivel)
VALUES 
  -- Plano Básico
  ('Básico', 'basico', 'Plano ideal para começar', 97.00, 970.00,
   1, 1, 10, 100, 3000, 5, 1000,
   10, 300,
   true, false, false,
   false, false, false, 1, true, true),
  
  -- Plano Pro
  ('Pro', 'pro', 'Plano para pequenas empresas', 197.00, 1970.00,
   3, 3, 50, 500, 15000, 20, 5000,
   50, 1500,
   true, true, false,
   true, false, false, 2, true, true),
  
  -- Plano Enterprise
  ('Enterprise', 'enterprise', 'Plano para grandes empresas', 497.00, 4970.00,
   10, 10, 200, 2000, 60000, 100, 50000,
   200, 6000,
   true, true, true,
   true, true, true, 3, true, true),
  
  -- Plano Ilimitado (para demonstração)
  ('Ilimitado', 'ilimitado', 'Sem limites', 997.00, 9970.00,
   -1, -1, -1, -1, -1, -1, -1,
   -1, -1,
   true, true, true,
   true, true, true, 4, true, false)
ON CONFLICT (slug) DO NOTHING;

-- Adicionar campo plan_id na tabela tenants se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='tenants' AND column_name='plan_id') THEN
    ALTER TABLE tenants ADD COLUMN plan_id INTEGER REFERENCES plans(id);
  END IF;
END $$;

-- Atualizar tenants existentes para usar o plano básico
UPDATE tenants 
SET plan_id = (SELECT id FROM plans WHERE slug = 'basico' LIMIT 1)
WHERE plan_id IS NULL;

-- Criar tabela para histórico de uso (para controle de limites)
CREATE TABLE IF NOT EXISTS tenant_usage (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  data_referencia DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Contadores do dia
  mensagens_enviadas_dia INTEGER DEFAULT 0,
  consultas_realizadas_dia INTEGER DEFAULT 0,
  consultas_cpf_dia INTEGER DEFAULT 0,
  consultas_cnpj_dia INTEGER DEFAULT 0,
  consultas_telefone_dia INTEGER DEFAULT 0,
  
  -- Contadores do mês
  mensagens_enviadas_mes INTEGER DEFAULT 0,
  consultas_realizadas_mes INTEGER DEFAULT 0,
  campanhas_criadas_mes INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(tenant_id, data_referencia)
);

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_tenant_usage_tenant_data ON tenant_usage(tenant_id, data_referencia);
CREATE INDEX IF NOT EXISTS idx_plans_slug ON plans(slug);
CREATE INDEX IF NOT EXISTS idx_plans_ativo ON plans(ativo);

-- Criar tabela de logs de ações do super admin
CREATE TABLE IF NOT EXISTS admin_logs (
  id SERIAL PRIMARY KEY,
  admin_user_id INTEGER NOT NULL REFERENCES tenant_users(id),
  acao VARCHAR(100) NOT NULL,
  entidade VARCHAR(50) NOT NULL,
  entidade_id INTEGER,
  descricao TEXT,
  dados_anteriores JSONB,
  dados_novos JSONB,
  ip_address VARCHAR(50),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_logs_user ON admin_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created ON admin_logs(created_at DESC);

COMMENT ON TABLE plans IS 'Planos de assinatura do sistema';
COMMENT ON TABLE tenant_usage IS 'Controle de uso e limites por tenant';
COMMENT ON TABLE admin_logs IS 'Logs de ações administrativas';



