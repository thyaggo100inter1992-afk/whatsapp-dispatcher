-- Campos para motivo de falha e reenvio editável de envios únicos
ALTER TABLE email_marketing_single_sends
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS body_html TEXT,
  ADD COLUMN IF NOT EXISTS body_text TEXT,
  ADD COLUMN IF NOT EXISTS reply_to VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_em_single_sends_status ON email_marketing_single_sends(status);
