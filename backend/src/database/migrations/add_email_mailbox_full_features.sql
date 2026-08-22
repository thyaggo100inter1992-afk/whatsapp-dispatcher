-- ============================================================
-- Caixa de e-mail completa: pastas, flags, assinatura, templates
-- ============================================================

-- Pastas personalizadas
CREATE TABLE IF NOT EXISTS email_mailbox_folders (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  mailbox_id INTEGER REFERENCES email_mailboxes(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(20) DEFAULT '#22d3ee',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_email_mailbox_folders_tenant ON email_mailbox_folders (tenant_id);
CREATE INDEX IF NOT EXISTS idx_email_mailbox_folders_mailbox ON email_mailbox_folders (mailbox_id);

-- Respostas rápidas
CREATE TABLE IF NOT EXISTS email_mailbox_quick_replies (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  mailbox_id INTEGER REFERENCES email_mailboxes(id) ON DELETE CASCADE,
  title VARCHAR(150) NOT NULL,
  body_html TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_email_mailbox_qr_tenant ON email_mailbox_quick_replies (tenant_id);

-- Assinatura por caixa
ALTER TABLE email_mailboxes
  ADD COLUMN IF NOT EXISTS signature_html TEXT,
  ADD COLUMN IF NOT EXISTS signature_enabled BOOLEAN DEFAULT TRUE;

-- Mensagens: flags e campos extras
ALTER TABLE email_mailbox_messages
  ADD COLUMN IF NOT EXISTS is_starred BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS cc TEXT,
  ADD COLUMN IF NOT EXISTS bcc TEXT,
  ADD COLUMN IF NOT EXISTS thread_key VARCHAR(255),
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS has_attachments BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS request_read_receipt BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS custom_folder_id INTEGER REFERENCES email_mailbox_folders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS labels JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS snipped_html TEXT;

-- Expandir pastas do sistema (drop check antigo se existir)
DO $$
BEGIN
  ALTER TABLE email_mailbox_messages DROP CONSTRAINT IF EXISTS email_mailbox_messages_folder_check;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE email_mailbox_messages
  ADD CONSTRAINT email_mailbox_messages_folder_check
  CHECK (folder IN ('inbox', 'sent', 'drafts', 'trash', 'archive', 'spam'));

CREATE INDEX IF NOT EXISTS idx_email_mailbox_msgs_starred
  ON email_mailbox_messages (mailbox_id) WHERE is_starred = TRUE;
CREATE INDEX IF NOT EXISTS idx_email_mailbox_msgs_thread
  ON email_mailbox_messages (mailbox_id, thread_key);
CREATE INDEX IF NOT EXISTS idx_email_mailbox_msgs_scheduled
  ON email_mailbox_messages (scheduled_at) WHERE scheduled_at IS NOT NULL AND status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_email_mailbox_msgs_search
  ON email_mailbox_messages USING gin (
    to_tsvector('simple', coalesce(subject,'') || ' ' || coalesce(from_email,'') || ' ' || coalesce(body_text,''))
  );

-- Marcar anexos já existentes
UPDATE email_mailbox_messages
SET has_attachments = TRUE
WHERE has_attachments IS DISTINCT FROM TRUE
  AND attachments IS NOT NULL
  AND jsonb_typeof(attachments) = 'array'
  AND jsonb_array_length(attachments) > 0;
