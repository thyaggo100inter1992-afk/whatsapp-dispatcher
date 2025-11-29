-- ============================================
-- ADICIONAR tenant_id em tabelas CRÍTICAS
-- Foco em tabelas com dados de usuários
-- ============================================

-- 1. button_clicks
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='button_clicks' AND column_name='tenant_id') THEN
    ALTER TABLE button_clicks ADD COLUMN tenant_id INTEGER;
    CREATE INDEX IF NOT EXISTS idx_button_clicks_tenant_id ON button_clicks(tenant_id);
    RAISE NOTICE '✅ button_clicks: tenant_id adicionado';
  END IF;
END $$;

-- 2. campaign_contacts
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='campaign_contacts' AND column_name='tenant_id') THEN
    ALTER TABLE campaign_contacts ADD COLUMN tenant_id INTEGER;
    CREATE INDEX IF NOT EXISTS idx_campaign_contacts_tenant_id ON campaign_contacts(tenant_id);
    RAISE NOTICE '✅ campaign_contacts: tenant_id adicionado';
  END IF;
END $$;

-- 3. campaign_templates
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='campaign_templates' AND column_name='tenant_id') THEN
    ALTER TABLE campaign_templates ADD COLUMN tenant_id INTEGER;
    CREATE INDEX IF NOT EXISTS idx_campaign_templates_tenant_id ON campaign_templates(tenant_id);
    RAISE NOTICE '✅ campaign_templates: tenant_id adicionado';
  END IF;
END $$;

-- 4. media
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='media' AND column_name='tenant_id') THEN
    ALTER TABLE media ADD COLUMN tenant_id INTEGER;
    CREATE INDEX IF NOT EXISTS idx_media_tenant_id ON media(tenant_id);
    RAISE NOTICE '✅ media: tenant_id adicionado';
  END IF;
END $$;

-- 5. attendants
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='attendants' AND column_name='tenant_id') THEN
    ALTER TABLE attendants ADD COLUMN tenant_id INTEGER;
    CREATE INDEX IF NOT EXISTS idx_attendants_tenant_id ON attendants(tenant_id);
    RAISE NOTICE '✅ attendants: tenant_id adicionado';
  END IF;
END $$;

-- 6. quick_replies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='quick_replies' AND column_name='tenant_id') THEN
    ALTER TABLE quick_replies ADD COLUMN tenant_id INTEGER;
    CREATE INDEX IF NOT EXISTS idx_quick_replies_tenant_id ON quick_replies(tenant_id);
    RAISE NOTICE '✅ quick_replies: tenant_id adicionado';
  END IF;
END $$;

-- 7. uaz_messages
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='uaz_messages' AND column_name='tenant_id') THEN
    ALTER TABLE uaz_messages ADD COLUMN tenant_id INTEGER;
    CREATE INDEX IF NOT EXISTS idx_uaz_messages_tenant_id ON uaz_messages(tenant_id);
    RAISE NOTICE '✅ uaz_messages: tenant_id adicionado';
  END IF;
END $$;

-- 8. uaz_verification_history
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='uaz_verification_history' AND column_name='tenant_id') THEN
    ALTER TABLE uaz_verification_history ADD COLUMN tenant_id INTEGER;
    CREATE INDEX IF NOT EXISTS idx_uaz_verification_history_tenant_id ON uaz_verification_history(tenant_id);
    RAISE NOTICE '✅ uaz_verification_history: tenant_id adicionado';
  END IF;
END $$;

-- 9. uaz_verification_jobs
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='uaz_verification_jobs' AND column_name='tenant_id') THEN
    ALTER TABLE uaz_verification_jobs ADD COLUMN tenant_id INTEGER;
    CREATE INDEX IF NOT EXISTS idx_uaz_verification_jobs_tenant_id ON uaz_verification_jobs(tenant_id);
    RAISE NOTICE '✅ uaz_verification_jobs: tenant_id adicionado';
  END IF;
END $$;

-- 10. whatsapp_groups
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='whatsapp_groups' AND column_name='tenant_id') THEN
    ALTER TABLE whatsapp_groups ADD COLUMN tenant_id INTEGER;
    CREATE INDEX IF NOT EXISTS idx_whatsapp_groups_tenant_id ON whatsapp_groups(tenant_id);
    RAISE NOTICE '✅ whatsapp_groups: tenant_id adicionado';
  END IF;
END $$;

-- 11. chatbot_ai_agents
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='chatbot_ai_agents' AND column_name='tenant_id') THEN
    ALTER TABLE chatbot_ai_agents ADD COLUMN tenant_id INTEGER;
    CREATE INDEX IF NOT EXISTS idx_chatbot_ai_agents_tenant_id ON chatbot_ai_agents(tenant_id);
    RAISE NOTICE '✅ chatbot_ai_agents: tenant_id adicionado';
  END IF;
END $$;

-- 12. chatbot_ai_functions
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='chatbot_ai_functions' AND column_name='tenant_id') THEN
    ALTER TABLE chatbot_ai_functions ADD COLUMN tenant_id INTEGER;
    CREATE INDEX IF NOT EXISTS idx_chatbot_ai_functions_tenant_id ON chatbot_ai_functions(tenant_id);
    RAISE NOTICE '✅ chatbot_ai_functions: tenant_id adicionado';
  END IF;
END $$;

-- 13. chatbot_ai_knowledge
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='chatbot_ai_knowledge' AND column_name='tenant_id') THEN
    ALTER TABLE chatbot_ai_knowledge ADD COLUMN tenant_id INTEGER;
    CREATE INDEX IF NOT EXISTS idx_chatbot_ai_knowledge_tenant_id ON chatbot_ai_knowledge(tenant_id);
    RAISE NOTICE '✅ chatbot_ai_knowledge: tenant_id adicionado';
  END IF;
END $$;

-- 14. conversation_assignments
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='conversation_assignments' AND column_name='tenant_id') THEN
    ALTER TABLE conversation_assignments ADD COLUMN tenant_id INTEGER;
    CREATE INDEX IF NOT EXISTS idx_conversation_assignments_tenant_id ON conversation_assignments(tenant_id);
    RAISE NOTICE '✅ conversation_assignments: tenant_id adicionado';
  END IF;
END $$;

-- ATRIBUIR tenant_id a registros órfãos (apenas se houver 1 tenant)
DO $$
DECLARE
  tenant_count INTEGER;
  first_tenant_id INTEGER;
BEGIN
  SELECT COUNT(*), MIN(id) INTO tenant_count, first_tenant_id FROM tenants;
  
  IF tenant_count = 1 THEN
    RAISE NOTICE '🔧 Atribuindo tenant_id = % a registros órfãos...', first_tenant_id;
    
    UPDATE button_clicks SET tenant_id = first_tenant_id WHERE tenant_id IS NULL;
    UPDATE campaign_contacts SET tenant_id = first_tenant_id WHERE tenant_id IS NULL;
    UPDATE campaign_templates SET tenant_id = first_tenant_id WHERE tenant_id IS NULL;
    UPDATE media SET tenant_id = first_tenant_id WHERE tenant_id IS NULL;
    UPDATE attendants SET tenant_id = first_tenant_id WHERE tenant_id IS NULL;
    UPDATE quick_replies SET tenant_id = first_tenant_id WHERE tenant_id IS NULL;
    UPDATE uaz_messages SET tenant_id = first_tenant_id WHERE tenant_id IS NULL;
    UPDATE uaz_verification_history SET tenant_id = first_tenant_id WHERE tenant_id IS NULL;
    UPDATE uaz_verification_jobs SET tenant_id = first_tenant_id WHERE tenant_id IS NULL;
    UPDATE whatsapp_groups SET tenant_id = first_tenant_id WHERE tenant_id IS NULL;
    UPDATE chatbot_ai_agents SET tenant_id = first_tenant_id WHERE tenant_id IS NULL;
    UPDATE chatbot_ai_functions SET tenant_id = first_tenant_id WHERE tenant_id IS NULL;
    UPDATE chatbot_ai_knowledge SET tenant_id = first_tenant_id WHERE tenant_id IS NULL;
    UPDATE conversation_assignments SET tenant_id = first_tenant_id WHERE tenant_id IS NULL;
    
    RAISE NOTICE '✅ Registros órfãos atribuídos ao tenant %', first_tenant_id;
  END IF;
END $$;

SELECT '✅ TENANT_ID ADICIONADO EM TABELAS CRÍTICAS' as status;

