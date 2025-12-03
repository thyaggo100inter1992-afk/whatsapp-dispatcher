-- Adiciona coluna email_account_id na tabela email_templates
-- Para permitir que cada template use uma conta de email específica

ALTER TABLE email_templates 
ADD COLUMN IF NOT EXISTS email_account_id INTEGER REFERENCES email_accounts(id) ON DELETE SET NULL;

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_email_templates_account_id ON email_templates(email_account_id);

-- Comentário explicativo
COMMENT ON COLUMN email_templates.email_account_id IS 'ID da conta de email a ser usada para este template. Se NULL, usa a conta padrão.';

