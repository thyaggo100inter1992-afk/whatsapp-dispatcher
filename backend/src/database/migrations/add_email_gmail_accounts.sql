-- Contas Gmail conectadas por IMAP (usuário e senha guardados no sistema)
CREATE TABLE IF NOT EXISTS email_gmail_accounts (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  display_name VARCHAR(255),
  password_encrypted TEXT,
  profile_dir TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT uq_email_gmail_accounts_tenant_email UNIQUE (tenant_id, email)
);

CREATE INDEX IF NOT EXISTS idx_email_gmail_accounts_tenant
  ON email_gmail_accounts (tenant_id);
