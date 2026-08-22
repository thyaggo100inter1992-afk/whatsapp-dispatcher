-- Guarda remetente/domínio usados em cada envio (para log da campanha / rotação)
ALTER TABLE email_marketing_recipients
  ADD COLUMN IF NOT EXISTS sent_from_email VARCHAR(255);

ALTER TABLE email_marketing_recipients
  ADD COLUMN IF NOT EXISTS sent_domain VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_em_recipients_sent_domain
  ON email_marketing_recipients(sent_domain)
  WHERE sent_domain IS NOT NULL;
