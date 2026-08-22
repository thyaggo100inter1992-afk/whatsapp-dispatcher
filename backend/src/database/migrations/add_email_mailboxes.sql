-- Caixas de e-mail por tenant (endereços criados em cima dos domínios)
ALTER TABLE email_marketing_domains
  ADD COLUMN IF NOT EXISTS inbound_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS inbound_status VARCHAR(30) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS inbound_dns_records JSONB;

CREATE TABLE IF NOT EXISTS email_mailboxes (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  domain_id INTEGER NOT NULL REFERENCES email_marketing_domains(id) ON DELETE CASCADE,
  local_part VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  display_name VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT uq_email_mailboxes_tenant_email UNIQUE (tenant_id, email),
  CONSTRAINT uq_email_mailboxes_domain_local UNIQUE (domain_id, local_part)
);

CREATE INDEX IF NOT EXISTS idx_email_mailboxes_tenant ON email_mailboxes (tenant_id);
CREATE INDEX IF NOT EXISTS idx_email_mailboxes_email ON email_mailboxes (lower(email));
CREATE INDEX IF NOT EXISTS idx_email_mailboxes_domain ON email_mailboxes (domain_id);

CREATE TABLE IF NOT EXISTS email_mailbox_messages (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  mailbox_id INTEGER NOT NULL REFERENCES email_mailboxes(id) ON DELETE CASCADE,
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  folder VARCHAR(20) NOT NULL DEFAULT 'inbox'
    CHECK (folder IN ('inbox', 'sent', 'drafts', 'trash')),
  from_email VARCHAR(255),
  from_name VARCHAR(255),
  to_email VARCHAR(255),
  to_name VARCHAR(255),
  cc TEXT,
  subject TEXT,
  body_html TEXT,
  body_text TEXT,
  message_id VARCHAR(255),
  in_reply_to VARCHAR(255),
  is_read BOOLEAN DEFAULT FALSE,
  provider_message_id VARCHAR(255),
  status VARCHAR(30) DEFAULT 'received',
  error_message TEXT,
  received_at TIMESTAMP,
  sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_mailbox_msgs_mailbox
  ON email_mailbox_messages (mailbox_id, folder, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_mailbox_msgs_tenant
  ON email_mailbox_messages (tenant_id);
CREATE INDEX IF NOT EXISTS idx_email_mailbox_msgs_unread
  ON email_mailbox_messages (mailbox_id) WHERE is_read = FALSE AND folder = 'inbox';
