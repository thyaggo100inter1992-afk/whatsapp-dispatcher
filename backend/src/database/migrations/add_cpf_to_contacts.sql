-- CPF do destinatário nas campanhas da API Oficial
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS cpf VARCHAR(20);

COMMENT ON COLUMN contacts.cpf IS 'CPF do contato (campanha API Oficial), opcional';

CREATE INDEX IF NOT EXISTS idx_contacts_tenant_cpf
  ON contacts (tenant_id, cpf)
  WHERE cpf IS NOT NULL AND cpf <> '';
