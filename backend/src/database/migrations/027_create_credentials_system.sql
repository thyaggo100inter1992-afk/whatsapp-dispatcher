-- =====================================================
-- MIGRATION: Sistema de Credenciais Multi-Tenant
-- Descrição: Cria tabelas para gerenciar credenciais de UAZAP e Nova Vida
-- Data: 22/11/2024
-- =====================================================

-- ===================================
-- TABELA: Credenciais UAZAP
-- ===================================
CREATE TABLE IF NOT EXISTS uazap_credentials (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    server_url VARCHAR(500) NOT NULL,
    admin_token VARCHAR(500) NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ===================================
-- TABELA: Credenciais Nova Vida
-- ===================================
CREATE TABLE IF NOT EXISTS novavida_credentials (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    usuario VARCHAR(255) NOT NULL,
    senha VARCHAR(255) NOT NULL,
    cliente VARCHAR(255),
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ===================================
-- Adicionar colunas na tabela TENANTS
-- ===================================
DO $$ 
BEGIN
    -- Adicionar referência para credencial UAZAP
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tenants' AND column_name = 'uazap_credential_id'
    ) THEN
        ALTER TABLE tenants ADD COLUMN uazap_credential_id INTEGER REFERENCES uazap_credentials(id) ON DELETE SET NULL;
        COMMENT ON COLUMN tenants.uazap_credential_id IS 'Credencial UAZAP vinculada ao tenant';
    END IF;

    -- Adicionar referência para credencial Nova Vida
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tenants' AND column_name = 'novavida_credential_id'
    ) THEN
        ALTER TABLE tenants ADD COLUMN novavida_credential_id INTEGER REFERENCES novavida_credentials(id) ON DELETE SET NULL;
        COMMENT ON COLUMN tenants.novavida_credential_id IS 'Credencial Nova Vida vinculada ao tenant';
    END IF;
END $$;

-- ===================================
-- Índices para Performance
-- ===================================
CREATE INDEX IF NOT EXISTS idx_uazap_credentials_default ON uazap_credentials(is_default) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS idx_uazap_credentials_active ON uazap_credentials(is_active);
CREATE INDEX IF NOT EXISTS idx_novavida_credentials_default ON novavida_credentials(is_default) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS idx_novavida_credentials_active ON novavida_credentials(is_active);
CREATE INDEX IF NOT EXISTS idx_tenants_uazap_credential ON tenants(uazap_credential_id);
CREATE INDEX IF NOT EXISTS idx_tenants_novavida_credential ON tenants(novavida_credential_id);

-- ===================================
-- Comentários nas Tabelas
-- ===================================
COMMENT ON TABLE uazap_credentials IS 'Credenciais UAZAP para uso pelos tenants';
COMMENT ON TABLE novavida_credentials IS 'Credenciais Nova Vida para uso pelos tenants';
COMMENT ON COLUMN uazap_credentials.is_default IS 'Define se esta é a credencial padrão para novos tenants';
COMMENT ON COLUMN novavida_credentials.is_default IS 'Define se esta é a credencial padrão para novos tenants';

-- ===================================
-- Triggers para atualizar updated_at
-- ===================================
CREATE OR REPLACE FUNCTION update_credentials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER uazap_credentials_updated_at
    BEFORE UPDATE ON uazap_credentials
    FOR EACH ROW
    EXECUTE FUNCTION update_credentials_updated_at();

CREATE TRIGGER novavida_credentials_updated_at
    BEFORE UPDATE ON novavida_credentials
    FOR EACH ROW
    EXECUTE FUNCTION update_credentials_updated_at();

-- ===================================
-- Constraint: Apenas uma credencial padrão por tipo
-- ===================================
-- Função para garantir apenas uma credencial padrão de UAZAP
CREATE OR REPLACE FUNCTION ensure_single_default_uazap()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_default = true THEN
        -- Remove o default de todas as outras credenciais
        UPDATE uazap_credentials 
        SET is_default = false 
        WHERE id != NEW.id AND is_default = true;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Função para garantir apenas uma credencial padrão de Nova Vida
CREATE OR REPLACE FUNCTION ensure_single_default_novavida()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_default = true THEN
        -- Remove o default de todas as outras credenciais
        UPDATE novavida_credentials 
        SET is_default = false 
        WHERE id != NEW.id AND is_default = true;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar triggers
DROP TRIGGER IF EXISTS ensure_single_default_uazap_trigger ON uazap_credentials;
CREATE TRIGGER ensure_single_default_uazap_trigger
    BEFORE INSERT OR UPDATE ON uazap_credentials
    FOR EACH ROW
    WHEN (NEW.is_default = true)
    EXECUTE FUNCTION ensure_single_default_uazap();

DROP TRIGGER IF EXISTS ensure_single_default_novavida_trigger ON novavida_credentials;
CREATE TRIGGER ensure_single_default_novavida_trigger
    BEFORE INSERT OR UPDATE ON novavida_credentials
    FOR EACH ROW
    WHEN (NEW.is_default = true)
    EXECUTE FUNCTION ensure_single_default_novavida();

-- ===================================
-- Inserir Credenciais de Exemplo (Padrão)
-- ===================================
-- UAZAP Padrão
INSERT INTO uazap_credentials (name, description, server_url, admin_token, is_default, is_active)
VALUES (
    'UAZAP Padrão',
    'Credencial padrão UAZAP para novos tenants',
    'https://nettsistemas.uazapi.com',
    'HUYo6XgQybENZoXWTisCC59BQCzG2EaaURPUFBBfOSFsfr4pjO',
    true,
    true
)
ON CONFLICT DO NOTHING;

-- Nova Vida Padrão
INSERT INTO novavida_credentials (name, description, usuario, senha, cliente, is_default, is_active)
VALUES (
    'Nova Vida Padrão',
    'Credencial padrão Nova Vida para novos tenants',
    'MAYCON.NETTCRED@GMAIL.COM',
    'Tg130992*',
    'NETCRED',
    true,
    true
)
ON CONFLICT DO NOTHING;

-- ===================================
-- SUCESSO!
-- ===================================
DO $$
BEGIN
    RAISE NOTICE '✅ Sistema de Credenciais criado com sucesso!';
    RAISE NOTICE '📦 Tabelas criadas: uazap_credentials, novavida_credentials';
    RAISE NOTICE '🔗 Tenants agora podem vincular credenciais específicas';
    RAISE NOTICE '⭐ Credenciais padrão inseridas automaticamente';
END $$;

