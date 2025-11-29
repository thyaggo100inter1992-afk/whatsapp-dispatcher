-- Adicionar colunas de limites customizados na tabela tenants
-- Esses campos são NULL por padrão, o que significa que o tenant usa os limites do plano padrão
-- Se forem preenchidos, o tenant usa os limites customizados

-- Limite customizado de usuários
DO $$ BEGIN
    ALTER TABLE tenants ADD COLUMN limite_usuarios_customizado INTEGER;
    EXCEPTION WHEN duplicate_column THEN RAISE NOTICE 'Coluna limite_usuarios_customizado já existe.';
END $$;

-- Limite customizado de contas WhatsApp
DO $$ BEGIN
    ALTER TABLE tenants ADD COLUMN limite_whatsapp_customizado INTEGER;
    EXCEPTION WHEN duplicate_column THEN RAISE NOTICE 'Coluna limite_whatsapp_customizado já existe.';
END $$;

-- Limite customizado de campanhas simultâneas
DO $$ BEGIN
    ALTER TABLE tenants ADD COLUMN limite_campanhas_simultaneas_customizado INTEGER;
    EXCEPTION WHEN duplicate_column THEN RAISE NOTICE 'Coluna limite_campanhas_simultaneas_customizado já existe.';
END $$;

-- Limite customizado de mensagens por dia
DO $$ BEGIN
    ALTER TABLE tenants ADD COLUMN limite_mensagens_dia_customizado INTEGER;
    EXCEPTION WHEN duplicate_column THEN RAISE NOTICE 'Coluna limite_mensagens_dia_customizado já existe.';
END $$;

-- Limite customizado de consultas Nova Vida por mês
DO $$ BEGIN
    ALTER TABLE tenants ADD COLUMN limite_novavida_mes_customizado INTEGER;
    EXCEPTION WHEN duplicate_column THEN RAISE NOTICE 'Coluna limite_novavida_mes_customizado já existe.';
END $$;

-- Flag para indicar se os limites são customizados
DO $$ BEGIN
    ALTER TABLE tenants ADD COLUMN limites_customizados BOOLEAN DEFAULT FALSE;
    EXCEPTION WHEN duplicate_column THEN RAISE NOTICE 'Coluna limites_customizados já existe.';
END $$;

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_tenants_limites_customizados ON tenants(limites_customizados);

-- Verificar estrutura
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'tenants' 
  AND column_name LIKE '%limite%'
ORDER BY ordinal_position;

SELECT 'Colunas de limites customizados adicionadas com sucesso!' as status;



