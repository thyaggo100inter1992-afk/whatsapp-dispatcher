-- Múltiplos domínios por campanha (rotação)
ALTER TABLE email_marketing_campaigns
  ADD COLUMN IF NOT EXISTS domain_ids JSONB;

UPDATE email_marketing_campaigns
SET domain_ids = jsonb_build_array(domain_id)
WHERE domain_ids IS NULL
  AND domain_id IS NOT NULL;

-- Status intermediário ao processar em paralelo (evita double-send)
DO $$
BEGIN
  ALTER TABLE email_marketing_recipients DROP CONSTRAINT IF EXISTS email_marketing_recipients_status_check;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE email_marketing_recipients
  ADD CONSTRAINT email_marketing_recipients_status_check
  CHECK (status IN ('pending','sending','sent','failed','opened','clicked','bounced','complained'));
