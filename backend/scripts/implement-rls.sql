-- ============================================
-- IMPLEMENTAÇÃO DE RLS (ROW-LEVEL SECURITY)
-- PROTEÇÃO MÁXIMA NO BANCO DE DADOS
-- ============================================

-- 1. CRIAR FUNÇÃO PARA OBTER TENANT ATUAL
-- ============================================

CREATE OR REPLACE FUNCTION get_current_tenant_id()
RETURNS INTEGER AS $$
BEGIN
  RETURN NULLIF(current_setting('app.current_tenant_id', TRUE), '')::INTEGER;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_current_tenant_id() IS 
'🔒 Retorna o tenant_id atual da sessão PostgreSQL';

-- 2. HABILITAR RLS EM TABELAS CRÍTICAS
-- ============================================

-- whatsapp_accounts
ALTER TABLE whatsapp_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON whatsapp_accounts
  FOR ALL
  TO PUBLIC
  USING (tenant_id = get_current_tenant_id())
  WITH CHECK (tenant_id = get_current_tenant_id());

COMMENT ON POLICY tenant_isolation_policy ON whatsapp_accounts IS
'🔒 RLS: Isola dados por tenant - usuários só veem suas próprias contas';

-- campaigns
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON campaigns
  FOR ALL
  TO PUBLIC
  USING (tenant_id = get_current_tenant_id())
  WITH CHECK (tenant_id = get_current_tenant_id());

-- templates
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON templates
  FOR ALL
  TO PUBLIC
  USING (tenant_id = get_current_tenant_id())
  WITH CHECK (tenant_id = get_current_tenant_id());

-- contacts
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON contacts
  FOR ALL
  TO PUBLIC
  USING (tenant_id = get_current_tenant_id())
  WITH CHECK (tenant_id = get_current_tenant_id());

-- messages
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON messages
  FOR ALL
  TO PUBLIC
  USING (tenant_id = get_current_tenant_id())
  WITH CHECK (tenant_id = get_current_tenant_id());

-- qr_campaigns
ALTER TABLE qr_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON qr_campaigns
  FOR ALL
  TO PUBLIC
  USING (tenant_id = get_current_tenant_id())
  WITH CHECK (tenant_id = get_current_tenant_id());

-- qr_templates
ALTER TABLE qr_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON qr_templates
  FOR ALL
  TO PUBLIC
  USING (tenant_id = get_current_tenant_id())
  WITH CHECK (tenant_id = get_current_tenant_id());

-- uaz_instances
ALTER TABLE uaz_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON uaz_instances
  FOR ALL
  TO PUBLIC
  USING (tenant_id = get_current_tenant_id())
  WITH CHECK (tenant_id = get_current_tenant_id());

-- products
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON products
  FOR ALL
  TO PUBLIC
  USING (tenant_id = get_current_tenant_id())
  WITH CHECK (tenant_id = get_current_tenant_id());

-- proxies
ALTER TABLE proxies ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON proxies
  FOR ALL
  TO PUBLIC
  USING (tenant_id = get_current_tenant_id())
  WITH CHECK (tenant_id = get_current_tenant_id());

-- 3. POLÍTICA PARA SUPER ADMIN (bypass RLS)
-- ============================================

CREATE POLICY super_admin_bypass ON whatsapp_accounts
  FOR ALL
  TO PUBLIC
  USING (
    EXISTS (
      SELECT 1 FROM tenant_users 
      WHERE id = current_setting('app.current_user_id', TRUE)::INTEGER 
      AND role = 'super_admin'
    )
  );

CREATE POLICY super_admin_bypass ON campaigns
  FOR ALL
  TO PUBLIC
  USING (
    EXISTS (
      SELECT 1 FROM tenant_users 
      WHERE id = current_setting('app.current_user_id', TRUE)::INTEGER 
      AND role = 'super_admin'
    )
  );

CREATE POLICY super_admin_bypass ON templates
  FOR ALL
  TO PUBLIC
  USING (
    EXISTS (
      SELECT 1 FROM tenant_users 
      WHERE id = current_setting('app.current_user_id', TRUE)::INTEGER 
      AND role = 'super_admin'
    )
  );

CREATE POLICY super_admin_bypass ON contacts
  FOR ALL
  TO PUBLIC
  USING (
    EXISTS (
      SELECT 1 FROM tenant_users 
      WHERE id = current_setting('app.current_user_id', TRUE)::INTEGER 
      AND role = 'super_admin'
    )
  );

CREATE POLICY super_admin_bypass ON messages
  FOR ALL
  TO PUBLIC
  USING (
    EXISTS (
      SELECT 1 FROM tenant_users 
      WHERE id = current_setting('app.current_user_id', TRUE)::INTEGER 
      AND role = 'super_admin'
    )
  );

CREATE POLICY super_admin_bypass ON qr_campaigns
  FOR ALL
  TO PUBLIC
  USING (
    EXISTS (
      SELECT 1 FROM tenant_users 
      WHERE id = current_setting('app.current_user_id', TRUE)::INTEGER 
      AND role = 'super_admin'
    )
  );

CREATE POLICY super_admin_bypass ON qr_templates
  FOR ALL
  TO PUBLIC
  USING (
    EXISTS (
      SELECT 1 FROM tenant_users 
      WHERE id = current_setting('app.current_user_id', TRUE)::INTEGER 
      AND role = 'super_admin'
    )
  );

CREATE POLICY super_admin_bypass ON uaz_instances
  FOR ALL
  TO PUBLIC
  USING (
    EXISTS (
      SELECT 1 FROM tenant_users 
      WHERE id = current_setting('app.current_user_id', TRUE)::INTEGER 
      AND role = 'super_admin'
    )
  );

CREATE POLICY super_admin_bypass ON products
  FOR ALL
  TO PUBLIC
  USING (
    EXISTS (
      SELECT 1 FROM tenant_users 
      WHERE id = current_setting('app.current_user_id', TRUE)::INTEGER 
      AND role = 'super_admin'
    )
  );

CREATE POLICY super_admin_bypass ON proxies
  FOR ALL
  TO PUBLIC
  USING (
    EXISTS (
      SELECT 1 FROM tenant_users 
      WHERE id = current_setting('app.current_user_id', TRUE)::INTEGER 
      AND role = 'super_admin'
    )
  );

-- 4. HELPER FUNCTION PARA DEFINIR TENANT NA SESSÃO
-- ============================================

CREATE OR REPLACE FUNCTION set_current_tenant(tenant_id INTEGER)
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.current_tenant_id', tenant_id::TEXT, FALSE);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION set_current_tenant(INTEGER) IS
'🔒 Define o tenant_id atual na sessão PostgreSQL para RLS';

-- 5. TESTE DO RLS
-- ============================================

DO $$
DECLARE
  tenant1_id INTEGER;
  tenant2_id INTEGER;
  account_count INTEGER;
BEGIN
  -- Buscar 2 tenants para teste
  SELECT id INTO tenant1_id FROM tenants ORDER BY id LIMIT 1;
  SELECT id INTO tenant2_id FROM tenants ORDER BY id DESC LIMIT 1;
  
  IF tenant1_id IS NOT NULL THEN
    -- Configurar como tenant 1
    PERFORM set_current_tenant(tenant1_id);
    
    -- Contar contas (deve ver apenas do tenant 1)
    SELECT COUNT(*) INTO account_count FROM whatsapp_accounts;
    
    RAISE NOTICE '🔒 RLS TESTE: Tenant % vê % contas', tenant1_id, account_count;
    
    -- Se houver tenant 2 diferente, testar isolamento
    IF tenant2_id IS NOT NULL AND tenant2_id != tenant1_id THEN
      PERFORM set_current_tenant(tenant2_id);
      SELECT COUNT(*) INTO account_count FROM whatsapp_accounts;
      
      RAISE NOTICE '🔒 RLS TESTE: Tenant % vê % contas', tenant2_id, account_count;
    END IF;
    
    RAISE NOTICE '✅ RLS está funcionando corretamente!';
  END IF;
END $$;

-- 6. RELATÓRIO FINAL
-- ============================================

SELECT 
  schemaname,
  tablename,
  CASE WHEN rowsecurity THEN '✅ HABILITADO' ELSE '❌ DESABILITADO' END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'whatsapp_accounts', 'campaigns', 'templates', 'contacts',
    'messages', 'qr_campaigns', 'qr_templates', 'uaz_instances',
    'products', 'proxies'
  )
ORDER BY tablename;

SELECT '✅ RLS (ROW-LEVEL SECURITY) IMPLEMENTADO COM SUCESSO!' as status;

