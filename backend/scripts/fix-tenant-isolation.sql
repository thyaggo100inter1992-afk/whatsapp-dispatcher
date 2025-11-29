-- ============================================
-- SCRIPT DE CORREÇÃO CRÍTICA DE SEGURANÇA
-- Adiciona PROTEÇÃO em nível de banco de dados
-- ============================================

-- 1. ADICIONAR tenant_id em TODAS as tabelas que não têm
-- ============================================

-- Verificar e adicionar em templates
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='templates' AND column_name='tenant_id') THEN
    ALTER TABLE templates ADD COLUMN tenant_id INTEGER;
    ALTER TABLE templates ADD CONSTRAINT fk_templates_tenant 
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_templates_tenant_id ON templates(tenant_id);
  END IF;
END $$;

-- Verificar e adicionar em contacts
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='contacts' AND column_name='tenant_id') THEN
    ALTER TABLE contacts ADD COLUMN tenant_id INTEGER;
    ALTER TABLE contacts ADD CONSTRAINT fk_contacts_tenant 
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_contacts_tenant_id ON contacts(tenant_id);
  END IF;
END $$;

-- Verificar e adicionar em messages
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='messages' AND column_name='tenant_id') THEN
    ALTER TABLE messages ADD COLUMN tenant_id INTEGER;
    ALTER TABLE messages ADD CONSTRAINT fk_messages_tenant 
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_messages_tenant_id ON messages(tenant_id);
  END IF;
END $$;

-- Verificar e adicionar em qr_templates
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='qr_templates' AND column_name='tenant_id') THEN
    ALTER TABLE qr_templates ADD COLUMN tenant_id INTEGER;
    ALTER TABLE qr_templates ADD CONSTRAINT fk_qr_templates_tenant 
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_qr_templates_tenant_id ON qr_templates(tenant_id);
  END IF;
END $$;

-- Verificar e adicionar em webhooks
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='webhooks' AND column_name='tenant_id') THEN
    ALTER TABLE webhooks ADD COLUMN tenant_id INTEGER;
    ALTER TABLE webhooks ADD CONSTRAINT fk_webhooks_tenant 
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_webhooks_tenant_id ON webhooks(tenant_id);
  END IF;
END $$;

-- Verificar e adicionar em products
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='products' AND column_name='tenant_id') THEN
    ALTER TABLE products ADD COLUMN tenant_id INTEGER;
    ALTER TABLE products ADD CONSTRAINT fk_products_tenant 
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_products_tenant_id ON products(tenant_id);
  END IF;
END $$;

-- Verificar e adicionar em restriction_lists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='restriction_lists' AND column_name='tenant_id') THEN
    ALTER TABLE restriction_lists ADD COLUMN tenant_id INTEGER;
    ALTER TABLE restriction_lists ADD CONSTRAINT fk_restriction_lists_tenant 
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_restriction_lists_tenant_id ON restriction_lists(tenant_id);
  END IF;
END $$;

-- Verificar e adicionar em proxies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='proxies' AND column_name='tenant_id') THEN
    ALTER TABLE proxies ADD COLUMN tenant_id INTEGER;
    ALTER TABLE proxies ADD CONSTRAINT fk_proxies_tenant 
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_proxies_tenant_id ON proxies(tenant_id);
  END IF;
END $$;

-- 2. ATRIBUIR tenant_id a registros órfãos (se houver apenas 1 tenant)
-- ============================================

DO $$
DECLARE
  tenant_count INTEGER;
  first_tenant_id INTEGER;
  updated_count INTEGER;
BEGIN
  SELECT COUNT(*), MIN(id) INTO tenant_count, first_tenant_id FROM tenants;
  
  IF tenant_count = 1 THEN
    RAISE NOTICE '🔧 Atribuindo tenant_id automaticamente (apenas 1 tenant encontrado)...';
    
    -- Templates
    UPDATE templates SET tenant_id = first_tenant_id WHERE tenant_id IS NULL;
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    IF updated_count > 0 THEN
      RAISE NOTICE '✅ templates: % registros atualizados', updated_count;
    END IF;
    
    -- Contacts
    UPDATE contacts SET tenant_id = first_tenant_id WHERE tenant_id IS NULL;
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    IF updated_count > 0 THEN
      RAISE NOTICE '✅ contacts: % registros atualizados', updated_count;
    END IF;
    
    -- Messages
    UPDATE messages SET tenant_id = first_tenant_id WHERE tenant_id IS NULL;
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    IF updated_count > 0 THEN
      RAISE NOTICE '✅ messages: % registros atualizados', updated_count;
    END IF;
    
    -- QR Templates
    UPDATE qr_templates SET tenant_id = first_tenant_id WHERE tenant_id IS NULL;
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    IF updated_count > 0 THEN
      RAISE NOTICE '✅ qr_templates: % registros atualizados', updated_count;
    END IF;
    
    -- Webhooks
    UPDATE webhooks SET tenant_id = first_tenant_id WHERE tenant_id IS NULL;
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    IF updated_count > 0 THEN
      RAISE NOTICE '✅ webhooks: % registros atualizados', updated_count;
    END IF;
    
    -- Products
    UPDATE products SET tenant_id = first_tenant_id WHERE tenant_id IS NULL;
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    IF updated_count > 0 THEN
      RAISE NOTICE '✅ products: % registros atualizados', updated_count;
    END IF;
    
    -- Restriction Lists
    UPDATE restriction_lists SET tenant_id = first_tenant_id WHERE tenant_id IS NULL;
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    IF updated_count > 0 THEN
      RAISE NOTICE '✅ restriction_lists: % registros atualizados', updated_count;
    END IF;
    
    -- Proxies
    UPDATE proxies SET tenant_id = first_tenant_id WHERE tenant_id IS NULL;
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    IF updated_count > 0 THEN
      RAISE NOTICE '✅ proxies: % registros atualizados', updated_count;
    END IF;
    
    RAISE NOTICE '✅ Todos os registros foram atribuídos ao tenant %', first_tenant_id;
  ELSIF tenant_count > 1 THEN
    RAISE WARNING '⚠️ Múltiplos tenants detectados! Atribuição manual necessária.';
  END IF;
END $$;

-- 3. VERIFICAR REGISTROS ÓRFÃOS RESTANTES
-- ============================================

DO $$
DECLARE
  orphan_count INTEGER;
BEGIN
  RAISE NOTICE '📊 Verificando registros órfãos...';
  
  SELECT COUNT(*) INTO orphan_count FROM templates WHERE tenant_id IS NULL;
  IF orphan_count > 0 THEN RAISE WARNING 'templates: % registros sem tenant_id', orphan_count; END IF;
  
  SELECT COUNT(*) INTO orphan_count FROM contacts WHERE tenant_id IS NULL;
  IF orphan_count > 0 THEN RAISE WARNING 'contacts: % registros sem tenant_id', orphan_count; END IF;
  
  SELECT COUNT(*) INTO orphan_count FROM messages WHERE tenant_id IS NULL;
  IF orphan_count > 0 THEN RAISE WARNING 'messages: % registros sem tenant_id', orphan_count; END IF;
  
  SELECT COUNT(*) INTO orphan_count FROM qr_templates WHERE tenant_id IS NULL;
  IF orphan_count > 0 THEN RAISE WARNING 'qr_templates: % registros sem tenant_id', orphan_count; END IF;
  
  SELECT COUNT(*) INTO orphan_count FROM webhooks WHERE tenant_id IS NULL;
  IF orphan_count > 0 THEN RAISE WARNING 'webhooks: % registros sem tenant_id', orphan_count; END IF;
  
  SELECT COUNT(*) INTO orphan_count FROM products WHERE tenant_id IS NULL;
  IF orphan_count > 0 THEN RAISE WARNING 'products: % registros sem tenant_id', orphan_count; END IF;
  
  SELECT COUNT(*) INTO orphan_count FROM restriction_lists WHERE tenant_id IS NULL;
  IF orphan_count > 0 THEN RAISE WARNING 'restriction_lists: % registros sem tenant_id', orphan_count; END IF;
  
  SELECT COUNT(*) INTO orphan_count FROM proxies WHERE tenant_id IS NULL;
  IF orphan_count > 0 THEN RAISE WARNING 'proxies: % registros sem tenant_id', orphan_count; END IF;
  
  SELECT COUNT(*) INTO orphan_count FROM uaz_instances WHERE tenant_id IS NULL;
  IF orphan_count > 0 THEN RAISE WARNING 'uaz_instances: % registros sem tenant_id', orphan_count; END IF;
  
  SELECT COUNT(*) INTO orphan_count FROM qr_campaigns WHERE tenant_id IS NULL;
  IF orphan_count > 0 THEN RAISE WARNING 'qr_campaigns: % registros sem tenant_id', orphan_count; END IF;
END $$;

-- 4. COMENTÁRIOS FINAIS
COMMENT ON COLUMN templates.tenant_id IS '🔒 SEGURANÇA: Isolamento de dados por tenant';
COMMENT ON COLUMN contacts.tenant_id IS '🔒 SEGURANÇA: Isolamento de dados por tenant';
COMMENT ON COLUMN messages.tenant_id IS '🔒 SEGURANÇA: Isolamento de dados por tenant';
COMMENT ON COLUMN qr_templates.tenant_id IS '🔒 SEGURANÇA: Isolamento de dados por tenant';
COMMENT ON COLUMN webhooks.tenant_id IS '🔒 SEGURANÇA: Isolamento de dados por tenant';
COMMENT ON COLUMN products.tenant_id IS '🔒 SEGURANÇA: Isolamento de dados por tenant';
COMMENT ON COLUMN restriction_lists.tenant_id IS '🔒 SEGURANÇA: Isolamento de dados por tenant';
COMMENT ON COLUMN proxies.tenant_id IS '🔒 SEGURANÇA: Isolamento de dados por tenant';

-- 5. RELATÓRIO FINAL
SELECT 
  '✅ MIGRATION COMPLETA - TENANT ISOLATION IMPLEMENTADO' as status,
  NOW() as executed_at;

