-- Adicionar colunas faltantes na tabela admin_email_campaigns

-- Adicionar updated_at se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'admin_email_campaigns' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE admin_email_campaigns ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

-- Adicionar finished_at se não existir (renomear de completed_at se necessário)
DO $$ 
BEGIN
    -- Se completed_at existe mas finished_at não, renomear
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'admin_email_campaigns' AND column_name = 'completed_at'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'admin_email_campaigns' AND column_name = 'finished_at'
    ) THEN
        ALTER TABLE admin_email_campaigns RENAME COLUMN completed_at TO finished_at;
    END IF;
    
    -- Se finished_at não existe, criar
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'admin_email_campaigns' AND column_name = 'finished_at'
    ) THEN
        ALTER TABLE admin_email_campaigns ADD COLUMN finished_at TIMESTAMP;
    END IF;
END $$;

-- Criar trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_admin_email_campaigns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_admin_email_campaigns_updated_at_trigger ON admin_email_campaigns;

CREATE TRIGGER update_admin_email_campaigns_updated_at_trigger
BEFORE UPDATE ON admin_email_campaigns
FOR EACH ROW
EXECUTE FUNCTION update_admin_email_campaigns_updated_at();

-- Mensagem de sucesso
DO $$
BEGIN
    RAISE NOTICE 'Colunas updated_at e finished_at adicionadas com sucesso!';
END $$;

