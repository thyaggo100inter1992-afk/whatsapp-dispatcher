-- CPF e telefone opcionais em contatos e destinatários de campanha
ALTER TABLE email_marketing_contacts
  ADD COLUMN IF NOT EXISTS cpf VARCHAR(20),
  ADD COLUMN IF NOT EXISTS phone VARCHAR(30);

ALTER TABLE email_marketing_recipients
  ADD COLUMN IF NOT EXISTS cpf VARCHAR(20),
  ADD COLUMN IF NOT EXISTS phone VARCHAR(30);

CREATE INDEX IF NOT EXISTS idx_em_contacts_cpf ON email_marketing_contacts(cpf) WHERE cpf IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_em_recipients_cpf ON email_marketing_recipients(cpf) WHERE cpf IS NOT NULL;
