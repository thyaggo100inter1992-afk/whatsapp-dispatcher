-- ============================================
-- MULTI-TENANT MIGRATION 003
-- Data: 2024-11-20
-- Descrição: Criar tenant padrão e popular tenant_id=1 em todos os dados existentes
-- ============================================

-- ============================================
-- CRIAR TENANT PADRÃO (ID=1)
-- ============================================

-- Inserir tenant padrão (seus dados atuais)
INSERT INTO tenants (
  id,
  uuid,
  nome,
  slug,
  email,
  plano,
  status,
  limite_campanhas_mes,
  limite_contatos_total,
  limite_instancias_whatsapp,
  limite_usuarios,
  limite_templates,
  limite_storage_mb,
  limite_mensagens_mes,
  data_criacao,
  data_ativacao,
  ativo,
  notas_internas
)
VALUES (
  1,
  gen_random_uuid(),
  'Minha Empresa',
  'minha-empresa',
  'admin@minhaempresa.com',
  'enterprise',
  'active',
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  NOW(),
  NOW(),
  true,
  'Tenant padrão - Migrado dos dados existentes'
)
ON CONFLICT (id) DO NOTHING;

-- Garantir que o sequence comece do 2 (para novos tenants)
SELECT setval('tenants_id_seq', (SELECT MAX(id) FROM tenants), true);

-- ============================================
-- POPULAR tenant_id=1 EM TODOS OS DADOS EXISTENTES
-- ============================================

-- whatsapp_accounts
UPDATE whatsapp_accounts SET tenant_id = 1 WHERE tenant_id IS NULL;

-- campaigns
UPDATE campaigns SET tenant_id = 1 WHERE tenant_id IS NULL;

-- qr_campaigns
UPDATE qr_campaigns SET tenant_id = 1 WHERE tenant_id IS NULL;

-- templates
UPDATE templates SET tenant_id = 1 WHERE tenant_id IS NULL;

-- qr_templates
UPDATE qr_templates SET tenant_id = 1 WHERE tenant_id IS NULL;

-- contacts
UPDATE contacts SET tenant_id = 1 WHERE tenant_id IS NULL;

-- messages
UPDATE messages SET tenant_id = 1 WHERE tenant_id IS NULL;

-- qr_campaign_templates
UPDATE qr_campaign_templates SET tenant_id = 1 WHERE tenant_id IS NULL;

-- qr_campaign_contacts
UPDATE qr_campaign_contacts SET tenant_id = 1 WHERE tenant_id IS NULL;

-- qr_campaign_messages
UPDATE qr_campaign_messages SET tenant_id = 1 WHERE tenant_id IS NULL;

-- qr_template_media
UPDATE qr_template_media SET tenant_id = 1 WHERE tenant_id IS NULL;

-- base_dados_completa
UPDATE base_dados_completa SET tenant_id = 1 WHERE tenant_id IS NULL;

-- novavida_consultas
UPDATE novavida_consultas SET tenant_id = 1 WHERE tenant_id IS NULL;

-- novavida_jobs
UPDATE novavida_jobs SET tenant_id = 1 WHERE tenant_id IS NULL;

-- lista_restricao
UPDATE lista_restricao SET tenant_id = 1 WHERE tenant_id IS NULL;

-- webhook_logs
UPDATE webhook_logs SET tenant_id = 1 WHERE tenant_id IS NULL;

-- ============================================
-- TABELAS OPCIONAIS (se existirem)
-- ============================================

-- uaz_instances (se existir)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'uaz_instances') THEN
    UPDATE uaz_instances SET tenant_id = 1 WHERE tenant_id IS NULL;
  END IF;
END $$;

-- uaz_logs (se existir)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'uaz_logs') THEN
    UPDATE uaz_logs SET tenant_id = 1 WHERE tenant_id IS NULL;
  END IF;
END $$;

-- products (se existir)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products') THEN
    UPDATE products SET tenant_id = 1 WHERE tenant_id IS NULL;
  END IF;
END $$;

-- ============================================
-- CRIAR USUÁRIO ADMIN PADRÃO
-- ============================================

-- Senha padrão: admin123
-- Hash bcrypt de "admin123": $2b$10$rB5H/5OB3VdN3gEWXyLe8.R3KqE5ZVMxh.FfL.Ld7q7VnN7QlQKFO

INSERT INTO tenant_users (
  tenant_id,
  nome,
  email,
  senha_hash,
  role,
  ativo,
  email_verificado
)
VALUES (
  1,
  'Administrador',
  'admin@minhaempresa.com',
  '$2b$10$rB5H/5OB3VdN3gEWXyLe8.R3KqE5ZVMxh.FfL.Ld7q7VnN7QlQKFO',
  'super_admin',
  true,
  true
)
ON CONFLICT (tenant_id, email) DO NOTHING;

-- ============================================
-- CRIAR REGISTRO DE USO INICIAL
-- ============================================

INSERT INTO tenant_usage (tenant_id, data_referencia)
VALUES (1, CURRENT_DATE)
ON CONFLICT (tenant_id, data_referencia) DO NOTHING;

-- ============================================
-- CRIAR ASSINATURA INICIAL
-- ============================================

INSERT INTO subscriptions (
  tenant_id,
  plano,
  valor,
  status,
  data_inicio,
  proximo_pagamento
)
VALUES (
  1,
  'enterprise',
  0.00,
  'active',
  NOW(),
  NOW() + INTERVAL '1 year'
);

-- Registrar esta migration
INSERT INTO schema_migrations (version, name, applied_at) 
VALUES (3, 'populate_default_tenant', NOW())
ON CONFLICT (version) DO NOTHING;
