-- Script para adicionar campos de telefone e documento aos usuários

-- Adicionar campos na tabela tenant_users (tabela principal de usuários)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tenant_users' AND column_name = 'telefone') THEN
        ALTER TABLE tenant_users ADD COLUMN telefone VARCHAR(20);
        RAISE NOTICE 'Campo telefone adicionado na tabela tenant_users';
    ELSE
        RAISE NOTICE 'Campo telefone já existe na tabela tenant_users';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tenant_users' AND column_name = 'documento') THEN
        ALTER TABLE tenant_users ADD COLUMN documento VARCHAR(20);
        RAISE NOTICE 'Campo documento adicionado na tabela tenant_users';
    ELSE
        RAISE NOTICE 'Campo documento já existe na tabela tenant_users';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tenant_users' AND column_name = 'avatar') THEN
        ALTER TABLE tenant_users ADD COLUMN avatar VARCHAR(255);
        RAISE NOTICE 'Campo avatar adicionado na tabela tenant_users';
    ELSE
        RAISE NOTICE 'Campo avatar já existe na tabela tenant_users';
    END IF;
END $$;

-- Adicionar campos na tabela tenants (para permitir edição)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tenants' AND column_name = 'telefone') THEN
        ALTER TABLE tenants ADD COLUMN telefone VARCHAR(20);
        RAISE NOTICE 'Campo telefone adicionado na tabela tenants';
    ELSE
        RAISE NOTICE 'Campo telefone já existe na tabela tenants';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tenants' AND column_name = 'documento') THEN
        ALTER TABLE tenants ADD COLUMN documento VARCHAR(20);
        RAISE NOTICE 'Campo documento adicionado na tabela tenants';
    ELSE
        RAISE NOTICE 'Campo documento já existe na tabela tenants';
    END IF;
END $$;

SELECT 'Campos adicionados com sucesso!' as resultado;

