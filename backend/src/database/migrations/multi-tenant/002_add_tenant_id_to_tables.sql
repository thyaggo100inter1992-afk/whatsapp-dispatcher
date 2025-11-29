-- ============================================
-- MULTI-TENANT MIGRATION 002
-- Data: 2024-11-20
-- Descrição: Adicionar coluna tenant_id em todas as tabelas existentes
-- ============================================

-- ============================================
-- ADICIONAR tenant_id NAS TABELAS PRINCIPAIS
-- ============================================

-- whatsapp_accounts
ALTER TABLE whatsapp_accounts 
  ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE;

-- campaigns (API Oficial)
ALTER TABLE campaigns 
  ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE;

-- qr_campaigns
ALTER TABLE qr_campaigns 
  ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE;

-- templates
ALTER TABLE templates 
  ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE;

-- qr_templates
ALTER TABLE qr_templates 
  ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE;

-- contacts
ALTER TABLE contacts 
  ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE;

-- messages
ALTER TABLE messages 
  ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE;

-- qr_campaign_templates
ALTER TABLE qr_campaign_templates 
  ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE;

-- qr_campaign_contacts
ALTER TABLE qr_campaign_contacts 
  ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE;

-- qr_campaign_messages
ALTER TABLE qr_campaign_messages 
  ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE;

-- qr_template_media
ALTER TABLE qr_template_media 
  ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE;

-- ============================================
-- BASE DE DADOS E CONSULTAS
-- ============================================

-- base_dados_completa
ALTER TABLE base_dados_completa 
  ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE;

-- novavida_consultas
ALTER TABLE novavida_consultas 
  ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE;

-- novavida_jobs
ALTER TABLE novavida_jobs 
  ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE;

-- lista_restricao
ALTER TABLE lista_restricao 
  ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE;

-- ============================================
-- WEBHOOK E LOGS
-- ============================================

-- webhook_logs
ALTER TABLE webhook_logs 
  ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE;

-- ============================================
-- TABELAS UAZ (se existirem)
-- ============================================

-- Verificar se tabela uaz_instances existe antes de adicionar coluna
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'uaz_instances') THEN
    ALTER TABLE uaz_instances 
      ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE;
    RAISE NOTICE '   - tenant_id adicionado em uaz_instances';
  END IF;
END $$;

-- Verificar se tabela uaz_logs existe
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'uaz_logs') THEN
    ALTER TABLE uaz_logs 
      ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE;
    RAISE NOTICE '   - tenant_id adicionado em uaz_logs';
  END IF;
END $$;

-- ============================================
-- OUTRAS TABELAS (caso existam)
-- ============================================

-- products (catálogo)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products') THEN
    ALTER TABLE products 
      ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE;
    RAISE NOTICE '   - tenant_id adicionado em products';
  END IF;
END $$;

-- Registrar esta migration
INSERT INTO schema_migrations (version, name, applied_at) 
VALUES (2, 'add_tenant_id_to_tables', NOW())
ON CONFLICT (version) DO NOTHING;

-- ============================================
-- FIM DA MIGRATION 002
-- ============================================

-- Log de sucesso
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 002: Coluna tenant_id adicionada em todas as tabelas!';
  RAISE NOTICE '   Próximo passo: Popular tenant_id=1 nos dados existentes';
END $$;





