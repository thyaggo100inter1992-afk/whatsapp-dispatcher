-- ============================================
-- MULTI-TENANT MIGRATION 004
-- Data: 2024-11-20
-- Descrição: Criar índices básicos tenant_id para performance
-- ============================================

-- Criando índices simples de tenant_id para todas as tabelas

-- whatsapp_accounts
CREATE INDEX IF NOT EXISTS idx_whatsapp_accounts_tenant ON whatsapp_accounts(tenant_id);

-- campaigns
CREATE INDEX IF NOT EXISTS idx_campaigns_tenant ON campaigns(tenant_id);

-- qr_campaigns
CREATE INDEX IF NOT EXISTS idx_qr_campaigns_tenant ON qr_campaigns(tenant_id);

-- templates
CREATE INDEX IF NOT EXISTS idx_templates_tenant ON templates(tenant_id);

-- qr_templates
CREATE INDEX IF NOT EXISTS idx_qr_templates_tenant ON qr_templates(tenant_id);

-- contacts
CREATE INDEX IF NOT EXISTS idx_contacts_tenant ON contacts(tenant_id);

-- messages
CREATE INDEX IF NOT EXISTS idx_messages_tenant ON messages(tenant_id);

-- qr_campaign_templates
CREATE INDEX IF NOT EXISTS idx_qr_campaign_templates_tenant ON qr_campaign_templates(tenant_id);

-- qr_campaign_contacts
CREATE INDEX IF NOT EXISTS idx_qr_campaign_contacts_tenant ON qr_campaign_contacts(tenant_id);

-- qr_campaign_messages
CREATE INDEX IF NOT EXISTS idx_qr_campaign_messages_tenant ON qr_campaign_messages(tenant_id);

-- qr_template_media
CREATE INDEX IF NOT EXISTS idx_qr_template_media_tenant ON qr_template_media(tenant_id);

-- base_dados_completa
CREATE INDEX IF NOT EXISTS idx_base_dados_tenant ON base_dados_completa(tenant_id);

-- novavida_consultas
CREATE INDEX IF NOT EXISTS idx_novavida_consultas_tenant ON novavida_consultas(tenant_id);

-- novavida_jobs
CREATE INDEX IF NOT EXISTS idx_novavida_jobs_tenant ON novavida_jobs(tenant_id);

-- lista_restricao
CREATE INDEX IF NOT EXISTS idx_lista_restricao_tenant ON lista_restricao(tenant_id);

-- webhook_logs
CREATE INDEX IF NOT EXISTS idx_webhook_logs_tenant ON webhook_logs(tenant_id);

-- Tabelas opcionais (com verificação)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'uaz_instances') THEN
    CREATE INDEX IF NOT EXISTS idx_uaz_instances_tenant ON uaz_instances(tenant_id);
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'uaz_logs') THEN
    CREATE INDEX IF NOT EXISTS idx_uaz_logs_tenant ON uaz_logs(tenant_id);
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products') THEN
    CREATE INDEX IF NOT EXISTS idx_products_tenant ON products(tenant_id);
  END IF;
END $$;

-- Registrar esta migration
INSERT INTO schema_migrations (version, name, applied_at) 
VALUES (4, 'create_indexes', NOW())
ON CONFLICT (version) DO NOTHING;
