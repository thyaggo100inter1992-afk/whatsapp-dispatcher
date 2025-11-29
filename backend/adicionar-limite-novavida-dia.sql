-- ============================================
-- Adicionar coluna para limite customizado de consultas Nova Vida por DIA
-- ============================================

-- Adicionar coluna limite_nova_vida_dia_customizado
DO $$ BEGIN
    ALTER TABLE tenants ADD COLUMN limite_nova_vida_dia_customizado INTEGER;
    RAISE NOTICE '✅ Coluna limite_nova_vida_dia_customizado adicionada';
EXCEPTION
    WHEN duplicate_column THEN 
        RAISE NOTICE 'ℹ️  Coluna limite_nova_vida_dia_customizado já existe';
END $$;

-- Verificar se foi adicionada
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'tenants' 
  AND column_name LIKE '%nova_vida%'
ORDER BY column_name;

-- Mostrar valores atuais (se houver)
SELECT 
  id,
  nome,
  limite_nova_vida_dia_customizado,
  limite_novavida_mes_customizado
FROM tenants
WHERE limite_nova_vida_dia_customizado IS NOT NULL 
   OR limite_novavida_mes_customizado IS NOT NULL;





