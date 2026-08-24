-- Vários corpos de e-mail por campanha (rotação no envio, igual subjects)
ALTER TABLE email_marketing_campaigns
  ADD COLUMN IF NOT EXISTS body_htmls JSONB;
