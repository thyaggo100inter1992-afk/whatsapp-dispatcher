-- =====================================================
-- MIGRATION: Add current_proxy_index to proxies table
-- Descrição: Adiciona coluna para rastrear qual proxy do pool está ativo
-- Data: 2024
-- =====================================================

-- Adicionar campo current_proxy_index para proxies rotativos
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'proxies' AND column_name = 'current_proxy_index'
    ) THEN
        ALTER TABLE proxies ADD COLUMN current_proxy_index INTEGER DEFAULT 0;
        
        -- Comentário na coluna
        COMMENT ON COLUMN proxies.current_proxy_index IS 'Índice do proxy atual no pool (para proxies rotativos)';
        
        RAISE NOTICE '✅ Coluna current_proxy_index adicionada à tabela proxies';
    ELSE
        RAISE NOTICE '⚠️ Coluna current_proxy_index já existe';
    END IF;
END $$;






