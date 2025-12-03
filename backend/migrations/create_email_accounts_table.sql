-- Criar tabela para armazenar múltiplas contas de email
CREATE TABLE IF NOT EXISTS email_accounts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    provider VARCHAR(50) NOT NULL, -- 'hostinger', 'gmail', 'smtp', 'sendgrid', 'aws_ses', 'mailgun'
    smtp_host VARCHAR(255),
    smtp_port INTEGER,
    smtp_secure BOOLEAN DEFAULT false,
    smtp_user VARCHAR(255),
    smtp_pass VARCHAR(255),
    email_from VARCHAR(255) NOT NULL,
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Criar índice para busca rápida
CREATE INDEX IF NOT EXISTS idx_email_accounts_active ON email_accounts(is_active);
CREATE INDEX IF NOT EXISTS idx_email_accounts_default ON email_accounts(is_default);

-- Adicionar coluna email_account_id na tabela email_templates
ALTER TABLE email_templates 
ADD COLUMN IF NOT EXISTS email_account_id INTEGER REFERENCES email_accounts(id) ON DELETE SET NULL;

-- Criar índice
CREATE INDEX IF NOT EXISTS idx_email_templates_account ON email_templates(email_account_id);

-- Habilitar RLS
ALTER TABLE email_accounts ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para email_accounts (apenas super admin pode acessar)
CREATE POLICY email_accounts_select_policy ON email_accounts
    FOR SELECT
    USING (true); -- Todos podem ler (para envio de emails)

CREATE POLICY email_accounts_insert_policy ON email_accounts
    FOR INSERT
    WITH CHECK (true); -- Será controlado pela aplicação

CREATE POLICY email_accounts_update_policy ON email_accounts
    FOR UPDATE
    USING (true);

CREATE POLICY email_accounts_delete_policy ON email_accounts
    FOR DELETE
    USING (true);

-- Migrar configuração existente do .env para a tabela (se houver)
-- Isso será feito pela aplicação na primeira vez

