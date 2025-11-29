-- =================================================================
-- MIGRATION: Adicionar Índices de Segurança para Tenant Isolation
-- Data: 26/11/2025
-- Descrição: Adiciona índices compostos em tenant_id para melhorar
--            performance e segurança das queries multi-tenant
-- =================================================================

-- Verificar se os índices já existem antes de criar
-- (Para evitar erros ao executar múltiplas vezes)

-- =================================================================
-- CAMPANHAS (API)
-- =================================================================
CREATE INDEX IF NOT EXISTS idx_campaigns_tenant_id_status 
ON campaigns(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_campaigns_tenant_id_created_at 
ON campaigns(tenant_id, created_at DESC);

-- =================================================================
-- CAMPANHAS (QR CONNECT)
-- =================================================================
CREATE INDEX IF NOT EXISTS idx_qr_campaigns_tenant_id_status 
ON qr_campaigns(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_qr_campaigns_tenant_id_created_at 
ON qr_campaigns(tenant_id, created_at DESC);

-- =================================================================
-- TEMPLATES (API)
-- =================================================================
CREATE INDEX IF NOT EXISTS idx_templates_tenant_id 
ON templates(tenant_id);

CREATE INDEX IF NOT EXISTS idx_templates_tenant_id_status 
ON templates(tenant_id, status);

-- =================================================================
-- TEMPLATES (QR CONNECT)
-- =================================================================
CREATE INDEX IF NOT EXISTS idx_qr_templates_tenant_id 
ON qr_templates(tenant_id);

-- =================================================================
-- CONTATOS
-- =================================================================
CREATE INDEX IF NOT EXISTS idx_contacts_tenant_id_created_at 
ON contacts(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contacts_tenant_id_phone 
ON contacts(tenant_id, phone_number);

-- =================================================================
-- MENSAGENS
-- =================================================================
CREATE INDEX IF NOT EXISTS idx_messages_tenant_id_campaign 
ON messages(tenant_id, campaign_id);

CREATE INDEX IF NOT EXISTS idx_messages_tenant_id_status 
ON messages(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_messages_tenant_id_created_at 
ON messages(tenant_id, created_at DESC);

-- =================================================================
-- CONTAS WHATSAPP (API)
-- =================================================================
CREATE INDEX IF NOT EXISTS idx_whatsapp_accounts_tenant_id_active 
ON whatsapp_accounts(tenant_id, is_active);

-- =================================================================
-- INSTÂNCIAS WHATSAPP (QR CONNECT)
-- =================================================================
CREATE INDEX IF NOT EXISTS idx_uaz_instances_tenant_id_status 
ON uaz_instances(tenant_id, status);

-- =================================================================
-- BASE DE DADOS COMPLETA
-- =================================================================
CREATE INDEX IF NOT EXISTS idx_base_dados_tenant_id_documento 
ON base_dados_completa(tenant_id, documento);

CREATE INDEX IF NOT EXISTS idx_base_dados_tenant_id_created_at 
ON base_dados_completa(tenant_id, created_at DESC);

-- =================================================================
-- CONSULTAS NOVA VIDA
-- =================================================================
CREATE INDEX IF NOT EXISTS idx_novavida_consultas_tenant_id 
ON novavida_consultas(tenant_id);

CREATE INDEX IF NOT EXISTS idx_novavida_consultas_tenant_id_created_at 
ON novavida_consultas(tenant_id, created_at DESC);

-- =================================================================
-- PRODUTOS (CATÁLOGO)
-- =================================================================
-- Nota: Products não tem tenant_id direto, mas pode criar índice
-- no whatsapp_account_id para JOIN com whatsapp_accounts
CREATE INDEX IF NOT EXISTS idx_products_whatsapp_account_id 
ON products(whatsapp_account_id);

-- =================================================================
-- LISTA DE RESTRIÇÃO
-- =================================================================
CREATE INDEX IF NOT EXISTS idx_lista_restricao_tenant_id_cpf 
ON lista_restricao(tenant_id, cpf) WHERE ativo = true;

-- =================================================================
-- PROXIES
-- =================================================================
CREATE INDEX IF NOT EXISTS idx_proxies_tenant_id 
ON proxies(tenant_id);

CREATE INDEX IF NOT EXISTS idx_proxies_tenant_id_status 
ON proxies(tenant_id, status);

-- =================================================================
-- CLIQUES EM BOTÕES
-- =================================================================
CREATE INDEX IF NOT EXISTS idx_button_clicks_tenant_id 
ON button_clicks(tenant_id);

CREATE INDEX IF NOT EXISTS idx_button_clicks_tenant_id_campaign 
ON button_clicks(tenant_id, campaign_id);

-- =================================================================
-- VERIFICAR ÍNDICES CRIADOS
-- =================================================================
-- Execute esta query para verificar os índices criados:
-- SELECT 
--   schemaname,
--   tablename,
--   indexname,
--   indexdef
-- FROM pg_indexes 
-- WHERE indexname LIKE 'idx_%tenant%'
-- ORDER BY tablename, indexname;

-- =================================================================
-- ESTATÍSTICAS DE PERFORMANCE
-- =================================================================
-- Para verificar o uso dos índices:
-- SELECT * FROM pg_stat_user_indexes 
-- WHERE indexrelname LIKE 'idx_%tenant%'
-- ORDER BY idx_scan DESC;

-- =================================================================
-- FIM DA MIGRATION
-- =================================================================

-- Mensagem de sucesso
DO $$
BEGIN
  RAISE NOTICE '✅ Índices de segurança multi-tenant criados com sucesso!';
  RAISE NOTICE '📊 Execute as queries de verificação acima para conferir.';
END $$;



