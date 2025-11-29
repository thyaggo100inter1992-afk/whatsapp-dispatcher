-- MIGRAÇÃO CRÍTICA DE SEGURANÇA
-- Adicionar tenant_id em tabelas QR Connect para isolamento de dados

-- 1. Adicionar tenant_id em uaz_instances
ALTER TABLE uaz_instances ADD COLUMN IF NOT EXISTS tenant_id INTEGER;

-- 2. Adicionar tenant_id em qr_campaigns  
ALTER TABLE qr_campaigns ADD COLUMN IF NOT EXISTS tenant_id INTEGER;

-- 3. Adicionar FK constraints
ALTER TABLE uaz_instances 
  ADD CONSTRAINT fk_uaz_instances_tenant 
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE qr_campaigns 
  ADD CONSTRAINT fk_qr_campaigns_tenant 
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- 4. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_uaz_instances_tenant_id ON uaz_instances(tenant_id);
CREATE INDEX IF NOT EXISTS idx_qr_campaigns_tenant_id ON qr_campaigns(tenant_id);

-- 5. IMPORTANTE: Atualizar registros existentes
-- Se houver apenas 1 tenant no sistema, atribuir a ele
-- Caso contrário, será necessário atribuição manual

DO $$
DECLARE
  tenant_count INTEGER;
  first_tenant_id INTEGER;
BEGIN
  SELECT COUNT(*), MIN(id) INTO tenant_count, first_tenant_id FROM tenants;
  
  IF tenant_count = 1 THEN
    -- Se houver apenas 1 tenant, atribuir todos os registros a ele
    UPDATE uaz_instances SET tenant_id = first_tenant_id WHERE tenant_id IS NULL;
    UPDATE qr_campaigns SET tenant_id = first_tenant_id WHERE tenant_id IS NULL;
    
    RAISE NOTICE 'tenant_id atribuído automaticamente ao único tenant (ID: %)', first_tenant_id;
  ELSIF tenant_count > 1 THEN
    -- Se houver múltiplos tenants, marcar registros órfãos
    RAISE WARNING 'Existem múltiplos tenants. Registros sem tenant_id precisam ser atribuídos manualmente!';
    RAISE WARNING 'uaz_instances sem tenant: %', (SELECT COUNT(*) FROM uaz_instances WHERE tenant_id IS NULL);
    RAISE WARNING 'qr_campaigns sem tenant: %', (SELECT COUNT(*) FROM qr_campaigns WHERE tenant_id IS NULL);
  END IF;
END $$;

-- 6. TORNAR tenant_id obrigatório após atribuição
-- DESCOMENTE APÓS GARANTIR QUE TODOS OS REGISTROS TÊM tenant_id
-- ALTER TABLE uaz_instances ALTER COLUMN tenant_id SET NOT NULL;
-- ALTER TABLE qr_campaigns ALTER COLUMN tenant_id SET NOT NULL;

COMMENT ON COLUMN uaz_instances.tenant_id IS 'ID do tenant proprietário da instância (isolamento de dados)';
COMMENT ON COLUMN qr_campaigns.tenant_id IS 'ID do tenant proprietário da campanha (isolamento de dados)';

