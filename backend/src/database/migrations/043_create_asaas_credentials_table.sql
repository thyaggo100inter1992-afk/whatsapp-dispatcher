-- Migration: Criar tabela de credenciais Asaas
-- Permite ao Super Admin gerenciar múltiplas credenciais Asaas

-- Criar tabela de credenciais Asaas
CREATE TABLE IF NOT EXISTS asaas_credentials (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  api_key TEXT NOT NULL,
  environment VARCHAR(50) DEFAULT 'production' CHECK (environment IN ('production', 'sandbox')),
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Adicionar coluna na tabela tenants para referenciar a credencial Asaas
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS asaas_credential_id INTEGER REFERENCES asaas_credentials(id) ON DELETE SET NULL;

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_asaas_credentials_is_default ON asaas_credentials(is_default);
CREATE INDEX IF NOT EXISTS idx_asaas_credentials_is_active ON asaas_credentials(is_active);
CREATE INDEX IF NOT EXISTS idx_tenants_asaas_credential_id ON tenants(asaas_credential_id);

-- Garantir que apenas uma credencial seja padrão
CREATE OR REPLACE FUNCTION ensure_single_default_asaas_credential()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE asaas_credentials SET is_default = false WHERE id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ensure_single_default_asaas_credential
AFTER INSERT OR UPDATE OF is_default ON asaas_credentials
FOR EACH ROW
WHEN (NEW.is_default = true)
EXECUTE FUNCTION ensure_single_default_asaas_credential();

-- Comentários
COMMENT ON TABLE asaas_credentials IS 'Armazena credenciais de API da Asaas para pagamentos';
COMMENT ON COLUMN asaas_credentials.name IS 'Nome identificador da credencial';
COMMENT ON COLUMN asaas_credentials.api_key IS 'Chave de API da Asaas (encriptada)';
COMMENT ON COLUMN asaas_credentials.environment IS 'Ambiente: production ou sandbox';
COMMENT ON COLUMN asaas_credentials.is_default IS 'Se é a credencial padrão para novos tenants';
COMMENT ON COLUMN asaas_credentials.is_active IS 'Se a credencial está ativa';
COMMENT ON COLUMN asaas_credentials.metadata IS 'Metadados adicionais em JSON';

COMMENT ON COLUMN tenants.asaas_credential_id IS 'ID da credencial Asaas atribuída ao tenant';

-- Log
DO $$
BEGIN
  RAISE NOTICE '✅ Tabela asaas_credentials criada com sucesso!';
  RAISE NOTICE '✅ Coluna asaas_credential_id adicionada à tabela tenants!';
END $$;





