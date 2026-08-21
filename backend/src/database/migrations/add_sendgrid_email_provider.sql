-- ============================================================
-- SendGrid como provedor adicional (Mailgun permanece intacto)
-- ============================================================

CREATE TABLE IF NOT EXISTS email_marketing_provider_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  active_provider VARCHAR(20) NOT NULL DEFAULT 'mailgun'
    CHECK (active_provider IN ('mailgun', 'sendgrid')),
  updated_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO email_marketing_provider_settings (id, active_provider)
VALUES (1, 'mailgun')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS sendgrid_credentials (
  id SERIAL PRIMARY KEY,
  api_key TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE email_marketing_domains
  ADD COLUMN IF NOT EXISTS provider VARCHAR(20) DEFAULT 'mailgun';

ALTER TABLE email_marketing_domains
  ADD COLUMN IF NOT EXISTS sendgrid_domain_id VARCHAR(255);

ALTER TABLE email_marketing_recipients
  ADD COLUMN IF NOT EXISTS provider_message_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_em_recipients_provider_msg
  ON email_marketing_recipients(provider_message_id);

-- single_sends (pode já existir em produção)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'email_marketing_single_sends'
  ) THEN
    ALTER TABLE email_marketing_single_sends
      ADD COLUMN IF NOT EXISTS provider_message_id VARCHAR(255);
  END IF;
END $$;
