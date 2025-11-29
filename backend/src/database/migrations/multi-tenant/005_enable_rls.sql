-- ============================================
-- MULTI-TENANT MIGRATION 005
-- Data: 2024-11-20
-- Descrição: Habilitar Row Level Security (RLS) para isolamento automático
-- ============================================

-- Habilitando Row Level Security (RLS)...
-- Isso garante isolamento automático entre tenants!

-- ============================================
-- FUNÇÕES AUXILIARES
-- ============================================

-- Função para definir tenant atual na sessão
CREATE OR REPLACE FUNCTION set_current_tenant(p_tenant_id INTEGER)
RETURNS void AS $$
BEGIN
  PERFORM set_config('app.current_tenant_id', p_tenant_id::TEXT, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION set_current_tenant IS 'Define o tenant atual para a sessão (usado pelo RLS)';

-- Função para obter tenant atual
CREATE OR REPLACE FUNCTION get_current_tenant()
RETURNS INTEGER AS $$
BEGIN
  RETURN NULLIF(current_setting('app.current_tenant_id', true), '')::INTEGER;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_current_tenant IS 'Retorna o tenant_id da sessão atual';

-- ============================================
-- HABILITAR RLS NAS TABELAS
-- ============================================

-- whatsapp_accounts
ALTER TABLE whatsapp_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON whatsapp_accounts
  USING (tenant_id = get_current_tenant());

CREATE POLICY tenant_insert_policy ON whatsapp_accounts
  FOR INSERT
  WITH CHECK (tenant_id = get_current_tenant());

-- campaigns
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON campaigns
  USING (tenant_id = get_current_tenant());

CREATE POLICY tenant_insert_policy ON campaigns
  FOR INSERT
  WITH CHECK (tenant_id = get_current_tenant());

-- qr_campaigns
ALTER TABLE qr_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON qr_campaigns
  USING (tenant_id = get_current_tenant());

CREATE POLICY tenant_insert_policy ON qr_campaigns
  FOR INSERT
  WITH CHECK (tenant_id = get_current_tenant());

-- templates
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON templates
  USING (tenant_id = get_current_tenant());

CREATE POLICY tenant_insert_policy ON templates
  FOR INSERT
  WITH CHECK (tenant_id = get_current_tenant());

-- qr_templates
ALTER TABLE qr_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON qr_templates
  USING (tenant_id = get_current_tenant());

CREATE POLICY tenant_insert_policy ON qr_templates
  FOR INSERT
  WITH CHECK (tenant_id = get_current_tenant());

-- contacts
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON contacts
  USING (tenant_id = get_current_tenant());

CREATE POLICY tenant_insert_policy ON contacts
  FOR INSERT
  WITH CHECK (tenant_id = get_current_tenant());

-- messages
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON messages
  USING (tenant_id = get_current_tenant());

CREATE POLICY tenant_insert_policy ON messages
  FOR INSERT
  WITH CHECK (tenant_id = get_current_tenant());

-- qr_campaign_templates
ALTER TABLE qr_campaign_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON qr_campaign_templates
  USING (tenant_id = get_current_tenant());

CREATE POLICY tenant_insert_policy ON qr_campaign_templates
  FOR INSERT
  WITH CHECK (tenant_id = get_current_tenant());

-- qr_campaign_contacts
ALTER TABLE qr_campaign_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON qr_campaign_contacts
  USING (tenant_id = get_current_tenant());

CREATE POLICY tenant_insert_policy ON qr_campaign_contacts
  FOR INSERT
  WITH CHECK (tenant_id = get_current_tenant());

-- qr_campaign_messages
ALTER TABLE qr_campaign_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON qr_campaign_messages
  USING (tenant_id = get_current_tenant());

CREATE POLICY tenant_insert_policy ON qr_campaign_messages
  FOR INSERT
  WITH CHECK (tenant_id = get_current_tenant());

-- qr_template_media
ALTER TABLE qr_template_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON qr_template_media
  USING (tenant_id = get_current_tenant());

CREATE POLICY tenant_insert_policy ON qr_template_media
  FOR INSERT
  WITH CHECK (tenant_id = get_current_tenant());

-- base_dados_completa
ALTER TABLE base_dados_completa ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON base_dados_completa
  USING (tenant_id = get_current_tenant());

CREATE POLICY tenant_insert_policy ON base_dados_completa
  FOR INSERT
  WITH CHECK (tenant_id = get_current_tenant());

-- novavida_consultas
ALTER TABLE novavida_consultas ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON novavida_consultas
  USING (tenant_id = get_current_tenant());

CREATE POLICY tenant_insert_policy ON novavida_consultas
  FOR INSERT
  WITH CHECK (tenant_id = get_current_tenant());

-- novavida_jobs
ALTER TABLE novavida_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON novavida_jobs
  USING (tenant_id = get_current_tenant());

CREATE POLICY tenant_insert_policy ON novavida_jobs
  FOR INSERT
  WITH CHECK (tenant_id = get_current_tenant());

-- lista_restricao
ALTER TABLE lista_restricao ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON lista_restricao
  USING (tenant_id = get_current_tenant());

CREATE POLICY tenant_insert_policy ON lista_restricao
  FOR INSERT
  WITH CHECK (tenant_id = get_current_tenant());

-- webhook_logs
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON webhook_logs
  USING (tenant_id = get_current_tenant());

CREATE POLICY tenant_insert_policy ON webhook_logs
  FOR INSERT
  WITH CHECK (tenant_id = get_current_tenant());

-- ============================================
-- RLS PARA TABELAS OPCIONAIS
-- ============================================

-- uaz_instances
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'uaz_instances') THEN
    EXECUTE 'ALTER TABLE uaz_instances ENABLE ROW LEVEL SECURITY';
    EXECUTE 'CREATE POLICY tenant_isolation_policy ON uaz_instances USING (tenant_id = get_current_tenant())';
    EXECUTE 'CREATE POLICY tenant_insert_policy ON uaz_instances FOR INSERT WITH CHECK (tenant_id = get_current_tenant())';
  END IF;
END $$;

-- uaz_logs
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'uaz_logs') THEN
    EXECUTE 'ALTER TABLE uaz_logs ENABLE ROW LEVEL SECURITY';
    EXECUTE 'CREATE POLICY tenant_isolation_policy ON uaz_logs USING (tenant_id = get_current_tenant())';
    EXECUTE 'CREATE POLICY tenant_insert_policy ON uaz_logs FOR INSERT WITH CHECK (tenant_id = get_current_tenant())';
  END IF;
END $$;

-- products
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products') THEN
    EXECUTE 'ALTER TABLE products ENABLE ROW LEVEL SECURITY';
    EXECUTE 'CREATE POLICY tenant_isolation_policy ON products USING (tenant_id = get_current_tenant())';
    EXECUTE 'CREATE POLICY tenant_insert_policy ON products FOR INSERT WITH CHECK (tenant_id = get_current_tenant())';
  END IF;
END $$;

-- ============================================
-- POLÍTICA DE BYPASS PARA SUPER ADMINS
-- ============================================

-- Criar função para verificar se é super admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN COALESCE(current_setting('app.is_super_admin', true)::BOOLEAN, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permitir super admins verem tudo (para gerenciamento)
CREATE POLICY super_admin_bypass_policy ON tenants
  USING (is_super_admin() OR id = get_current_tenant());

-- Registrar esta migration
INSERT INTO schema_migrations (version, name, applied_at) 
VALUES (5, 'enable_rls', NOW())
ON CONFLICT (version) DO NOTHING;

-- Migration 005: Row Level Security habilitado com sucesso!
