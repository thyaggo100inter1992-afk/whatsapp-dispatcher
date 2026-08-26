-- Chaves de API para integrar o disparador ao sistema de vendas
CREATE TABLE IF NOT EXISTS tenant_integration_keys (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL DEFAULT 'Sistema de Vendas',
  key_prefix VARCHAR(20) NOT NULL,
  key_hash VARCHAR(64) NOT NULL UNIQUE,
  last_used_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_integration_keys_tenant
  ON tenant_integration_keys(tenant_id);

CREATE INDEX IF NOT EXISTS idx_tenant_integration_keys_hash
  ON tenant_integration_keys(key_hash);
