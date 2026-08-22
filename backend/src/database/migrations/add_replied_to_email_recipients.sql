-- Resposta do cliente (reply inbound) na campanha de e-mail
ALTER TABLE email_marketing_recipients
  ADD COLUMN IF NOT EXISTS replied_at TIMESTAMP;

ALTER TABLE email_marketing_campaigns
  ADD COLUMN IF NOT EXISTS replied_count INTEGER DEFAULT 0;

ALTER TABLE email_marketing_single_sends
  ADD COLUMN IF NOT EXISTS replied_at TIMESTAMP;

DO $$
BEGIN
  ALTER TABLE email_marketing_recipients DROP CONSTRAINT IF EXISTS email_marketing_recipients_status_check;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE email_marketing_recipients
  ADD CONSTRAINT email_marketing_recipients_status_check
  CHECK (status IN ('pending','sending','sent','failed','opened','clicked','bounced','complained','replied'));

CREATE INDEX IF NOT EXISTS idx_em_recipients_replied_at
  ON email_marketing_recipients(replied_at)
  WHERE replied_at IS NOT NULL;
