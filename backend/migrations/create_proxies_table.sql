-- Migration: Criar tabela de gerenciamento de proxies
-- Data: 2025-11-14
-- Descrição: Tabela centralizada para gerenciar proxies reutilizáveis

CREATE TABLE IF NOT EXISTS proxies (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  type VARCHAR(20) NOT NULL DEFAULT 'socks5',
  host VARCHAR(255) NOT NULL,
  port INTEGER NOT NULL,
  username VARCHAR(255),
  password VARCHAR(255),
  location VARCHAR(255),
  description TEXT,
  status VARCHAR(20) DEFAULT 'unchecked',
  last_check TIMESTAMP,
  last_ip VARCHAR(50),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Adicionar coluna proxy_id na tabela whatsapp_accounts
ALTER TABLE whatsapp_accounts
ADD COLUMN IF NOT EXISTS proxy_id INTEGER REFERENCES proxies(id) ON DELETE SET NULL;

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_proxies_status ON proxies(status);
CREATE INDEX IF NOT EXISTS idx_proxies_is_active ON proxies(is_active);
CREATE INDEX IF NOT EXISTS idx_whatsapp_accounts_proxy_id ON whatsapp_accounts(proxy_id);

-- Comentários
COMMENT ON TABLE proxies IS 'Tabela centralizada para gerenciamento de proxies';
COMMENT ON COLUMN proxies.name IS 'Nome identificador único do proxy';
COMMENT ON COLUMN proxies.type IS 'Tipo: socks5, http, https';
COMMENT ON COLUMN proxies.host IS 'Host/IP do servidor proxy';
COMMENT ON COLUMN proxies.port IS 'Porta do servidor proxy';
COMMENT ON COLUMN proxies.username IS 'Usuário para autenticação (opcional)';
COMMENT ON COLUMN proxies.password IS 'Senha para autenticação (opcional)';
COMMENT ON COLUMN proxies.location IS 'Localização do proxy (ex: Brasil - São Paulo)';
COMMENT ON COLUMN proxies.description IS 'Descrição ou notas sobre o proxy';
COMMENT ON COLUMN proxies.status IS 'Status: working, failed, unchecked';
COMMENT ON COLUMN proxies.last_check IS 'Data/hora da última verificação';
COMMENT ON COLUMN proxies.last_ip IS 'Último IP detectado';
COMMENT ON COLUMN proxies.is_active IS 'Se o proxy está ativo para uso';
COMMENT ON COLUMN whatsapp_accounts.proxy_id IS 'Referência ao proxy usado por esta conta';

