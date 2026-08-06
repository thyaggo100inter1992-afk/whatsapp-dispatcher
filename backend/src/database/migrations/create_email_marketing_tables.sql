-- ============================================================
-- EMAIL MARKETING MODULE - TABELAS ISOLADAS POR TENANT
-- ============================================================

-- Credenciais Mailgun (SuperAdmin) - chave API do provedor
CREATE TABLE IF NOT EXISTS mailgun_credentials (
  id SERIAL PRIMARY KEY,
  api_key TEXT NOT NULL,
  region VARCHAR(10) DEFAULT 'us' CHECK (region IN ('us', 'eu')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Domínios de envio por tenant (configurados via API Mailgun)
CREATE TABLE IF NOT EXISTS email_marketing_domains (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  domain VARCHAR(255) NOT NULL,
  mailgun_domain_id VARCHAR(255),
  smtp_login VARCHAR(255),
  smtp_password VARCHAR(255),
  status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending','active','failed','unverified')),
  dns_records JSONB,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id, domain)
);

-- Listas de contatos por tenant
CREATE TABLE IF NOT EXISTS email_marketing_lists (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  total_contacts INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Contatos de cada lista (isolados por tenant)
CREATE TABLE IF NOT EXISTS email_marketing_contacts (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  list_id INTEGER NOT NULL REFERENCES email_marketing_lists(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  extra_data JSONB,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','unsubscribed','bounced','complained')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(list_id, email)
);

-- Templates de e-mail por tenant
CREATE TABLE IF NOT EXISTS email_marketing_templates (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  subject VARCHAR(500) NOT NULL,
  body_html TEXT,
  body_text TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Campanhas de e-mail por tenant
CREATE TABLE IF NOT EXISTS email_marketing_campaigns (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  subject VARCHAR(500) NOT NULL,
  from_name VARCHAR(255) NOT NULL,
  from_email VARCHAR(255) NOT NULL,
  reply_to VARCHAR(255),
  domain_id INTEGER REFERENCES email_marketing_domains(id),
  list_id INTEGER REFERENCES email_marketing_lists(id),
  template_id INTEGER REFERENCES email_marketing_templates(id),
  body_html TEXT,
  body_text TEXT,
  delay_seconds INTEGER DEFAULT 1,
  status VARCHAR(30) DEFAULT 'draft' CHECK (status IN ('draft','sending','paused','completed','failed','cancelled')),
  total_contacts INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  opened_count INTEGER DEFAULT 0,
  clicked_count INTEGER DEFAULT 0,
  bounced_count INTEGER DEFAULT 0,
  complained_count INTEGER DEFAULT 0,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Destinatários de cada campanha (controle de envio)
CREATE TABLE IF NOT EXISTS email_marketing_recipients (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  campaign_id INTEGER NOT NULL REFERENCES email_marketing_campaigns(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','opened','clicked','bounced','complained')),
  mailgun_message_id VARCHAR(255),
  error_message TEXT,
  sent_at TIMESTAMP,
  opened_at TIMESTAMP,
  clicked_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_em_domains_tenant ON email_marketing_domains(tenant_id);
CREATE INDEX IF NOT EXISTS idx_em_lists_tenant ON email_marketing_lists(tenant_id);
CREATE INDEX IF NOT EXISTS idx_em_contacts_list ON email_marketing_contacts(list_id);
CREATE INDEX IF NOT EXISTS idx_em_contacts_tenant ON email_marketing_contacts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_em_templates_tenant ON email_marketing_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_em_campaigns_tenant ON email_marketing_campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_em_recipients_campaign ON email_marketing_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_em_recipients_status ON email_marketing_recipients(status);
