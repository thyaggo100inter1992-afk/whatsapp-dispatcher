-- =====================================================
-- MIGRATION: Adicionar credencial_id às instâncias
-- Descrição: Cada instância guarda qual credencial UAZAP foi usada para criá-la
-- Data: 24/11/2024
-- =====================================================

-- Adicionar coluna credential_id na tabela uaz_instances
DO $$ 
BEGIN
    -- Adicionar referência para credencial UAZAP
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'uaz_instances' AND column_name = 'credential_id'
    ) THEN
        ALTER TABLE uaz_instances 
        ADD COLUMN credential_id INTEGER REFERENCES uazap_credentials(id) ON DELETE SET NULL;
        
        COMMENT ON COLUMN uaz_instances.credential_id IS 'Credencial UAZAP usada para criar esta instância';
        
        RAISE NOTICE '✅ Coluna credential_id adicionada à tabela uaz_instances';
    ELSE
        RAISE NOTICE 'ℹ️  Coluna credential_id já existe';
    END IF;
END $$;

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_uaz_instances_credential 
ON uaz_instances(credential_id);

-- =====================================================
-- POPULAR DADOS EXISTENTES
-- =====================================================
-- Para instâncias existentes, tentar descobrir qual credencial foi usada
-- baseado no tenant_id e sua credencial atual

DO $$
DECLARE
    affected_rows INTEGER;
BEGIN
    -- Atualizar instâncias que não tem credential_id
    -- Usar a credencial atual do tenant como "melhor palpite"
    UPDATE uaz_instances ui
    SET credential_id = t.uazap_credential_id
    FROM tenants t
    WHERE ui.tenant_id = t.id 
      AND ui.credential_id IS NULL
      AND t.uazap_credential_id IS NOT NULL;
    
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    
    IF affected_rows > 0 THEN
        RAISE NOTICE '✅ % instâncias atualizadas com credential_id baseado no tenant', affected_rows;
    END IF;
    
    -- Para instâncias sem tenant com credencial, usar a credencial padrão
    UPDATE uaz_instances
    SET credential_id = (
        SELECT id FROM uazap_credentials 
        WHERE is_default = true AND is_active = true 
        LIMIT 1
    )
    WHERE credential_id IS NULL;
    
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    
    IF affected_rows > 0 THEN
        RAISE NOTICE '✅ % instâncias atualizadas com credencial padrão', affected_rows;
    END IF;
END $$;

-- =====================================================
-- VERIFICAÇÃO FINAL
-- =====================================================
DO $$
DECLARE
    total_instances INTEGER;
    instances_without_credential INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_instances FROM uaz_instances;
    SELECT COUNT(*) INTO instances_without_credential 
    FROM uaz_instances WHERE credential_id IS NULL;
    
    RAISE NOTICE '';
    RAISE NOTICE '📊 RESUMO DA MIGRAÇÃO';
    RAISE NOTICE '   Total de instâncias: %', total_instances;
    RAISE NOTICE '   Sem credencial: %', instances_without_credential;
    RAISE NOTICE '   Com credencial: %', (total_instances - instances_without_credential);
    
    IF instances_without_credential > 0 THEN
        RAISE WARNING '⚠️  % instâncias ainda sem credential_id - precisam ser recriadas ou atribuídas manualmente', instances_without_credential;
    ELSE
        RAISE NOTICE '✅ Todas as instâncias têm credential_id!';
    END IF;
END $$;

-- =====================================================
-- SUCESSO!
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '✅ ============================================';
    RAISE NOTICE '✅ Migration 028 concluída com sucesso!';
    RAISE NOTICE '✅ Instâncias agora guardam sua credencial';
    RAISE NOTICE '✅ ============================================';
END $$;
