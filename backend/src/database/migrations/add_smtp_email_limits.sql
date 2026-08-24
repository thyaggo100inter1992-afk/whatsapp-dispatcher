-- Limites de envio SMTP (nettsistemasenvios) por tenant
-- 0 = sem limite; NULL = usar padrão das credenciais / 0
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS email_smtp_daily_limit INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS email_smtp_monthly_limit INTEGER DEFAULT NULL;

ALTER TABLE nettsistemasenvios_credentials
  ADD COLUMN IF NOT EXISTS default_daily_limit INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS default_monthly_limit INTEGER DEFAULT 0;

COMMENT ON COLUMN tenants.email_smtp_daily_limit IS 'Limite diário de e-mails no SMTP (0=ilimitado)';
COMMENT ON COLUMN tenants.email_smtp_monthly_limit IS 'Limite mensal de e-mails no SMTP (0=ilimitado)';
