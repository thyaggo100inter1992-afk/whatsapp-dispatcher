-- Permite status 'pending' no envio único (insert antes do send para gerar Reply-To token)
ALTER TABLE email_marketing_single_sends
  DROP CONSTRAINT IF EXISTS email_marketing_single_sends_status_check;

ALTER TABLE email_marketing_single_sends
  ADD CONSTRAINT email_marketing_single_sends_status_check
  CHECK (status IN ('pending','sent','failed','opened','clicked','bounced','complained'));
