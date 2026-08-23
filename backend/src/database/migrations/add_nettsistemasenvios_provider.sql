-- Provedor SMTP externo nettsistemasenvios.com.br (conexão; servidor fica fora do disparador)
CREATE TABLE IF NOT EXISTS nettsistemasenvios_credentials (
  id SERIAL PRIMARY KEY,
  api_key TEXT NOT NULL,
  api_base_url TEXT NOT NULL DEFAULT 'https://smtp1.nettsistemasenvios.com.br',
  smtp_host VARCHAR(255),
  smtp_port INT DEFAULT 587,
  smtp_port_ssl INT DEFAULT 465,
  smtp_user VARCHAR(255),
  smtp_password TEXT,
  smtp_tls BOOLEAN DEFAULT TRUE,
  webhook_events TEXT,
  webhook_inbound TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE email_marketing_domains
  ADD COLUMN IF NOT EXISTS external_domain_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS webhook_token VARCHAR(64);

-- active_provider pode incluir o novo provedor (se houver CHECK antigo, tenta dropar)
DO $$
BEGIN
  ALTER TABLE email_marketing_provider_settings
    DROP CONSTRAINT IF EXISTS email_marketing_provider_settings_active_provider_check;
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;
