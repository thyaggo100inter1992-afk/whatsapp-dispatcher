-- Lista de restrição (opt-out) do E-mail Marketing — por tenant
CREATE TABLE IF NOT EXISTS email_marketing_restrictions (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  reason VARCHAR(255) DEFAULT 'opt_out',
  source VARCHAR(80) DEFAULT 'unsubscribe_link',
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT uq_em_restrictions_tenant_email UNIQUE (tenant_id, email)
);

CREATE INDEX IF NOT EXISTS idx_em_restrictions_tenant
  ON email_marketing_restrictions (tenant_id);

CREATE INDEX IF NOT EXISTS idx_em_restrictions_email
  ON email_marketing_restrictions (lower(email));

-- Campanha pode optar por ignorar restrição (usuário confirmou "enviar mesmo assim")
ALTER TABLE email_marketing_campaigns
  ADD COLUMN IF NOT EXISTS ignore_email_restrictions BOOLEAN DEFAULT FALSE;
