-- Adicionar campo data_atualizacao à tabela base_dados_completa

-- Verificar se a coluna já existe antes de adicionar
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'base_dados_completa' 
        AND column_name = 'data_atualizacao'
    ) THEN
        ALTER TABLE base_dados_completa 
        ADD COLUMN data_atualizacao TIMESTAMP DEFAULT NOW();
        
        RAISE NOTICE '✅ Coluna data_atualizacao adicionada com sucesso!';
    ELSE
        RAISE NOTICE '⚠️ Coluna data_atualizacao já existe!';
    END IF;
END $$;

-- Atualizar registros existentes que não têm data_atualizacao
UPDATE base_dados_completa 
SET data_atualizacao = data_adicao 
WHERE data_atualizacao IS NULL;

SELECT '✅ Migração concluída com sucesso!' as status;






