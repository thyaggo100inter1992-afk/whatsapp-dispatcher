-- ============================================
-- Migration 045: Criar tabelas de associação de usuários x contas WhatsApp (API e QR)
-- ============================================

-- Tabela para contas da API Oficial
CREATE TABLE IF NOT EXISTS user_whatsapp_accounts (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES tenant_users(id) ON DELETE CASCADE,
  whatsapp_account_id INTEGER REFERENCES whatsapp_accounts(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, whatsapp_account_id)
);

CREATE INDEX IF NOT EXISTS idx_user_whatsapp_accounts_tenant ON user_whatsapp_accounts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_whatsapp_accounts_user ON user_whatsapp_accounts(user_id);

-- Tabela para instâncias QR/UAZ
CREATE TABLE IF NOT EXISTS user_uaz_instances (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES tenant_users(id) ON DELETE CASCADE,
  uaz_instance_id INTEGER REFERENCES uaz_instances(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, uaz_instance_id)
);

CREATE INDEX IF NOT EXISTS idx_user_uaz_instances_tenant ON user_uaz_instances(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_uaz_instances_user ON user_uaz_instances(user_id);
