-- Evita destinatários duplicados na mesma campanha
CREATE UNIQUE INDEX IF NOT EXISTS idx_em_recipients_campaign_email
  ON email_marketing_recipients (campaign_id, email);
