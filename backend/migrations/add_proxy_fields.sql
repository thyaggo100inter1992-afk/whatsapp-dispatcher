-- Migration: Adicionar campos de proxy para contas WhatsApp
-- Data: 2025-11-14
-- Descrição: Adiciona suporte para configuração de proxy por conta

ALTER TABLE whatsapp_accounts
ADD COLUMN IF NOT EXISTS proxy_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS proxy_type VARCHAR(20) DEFAULT 'socks5',
ADD COLUMN IF NOT EXISTS proxy_host VARCHAR(255),
ADD COLUMN IF NOT EXISTS proxy_port INTEGER,
ADD COLUMN IF NOT EXISTS proxy_username VARCHAR(255),
ADD COLUMN IF NOT EXISTS proxy_password VARCHAR(255),
ADD COLUMN IF NOT EXISTS proxy_last_check TIMESTAMP,
ADD COLUMN IF NOT EXISTS proxy_status VARCHAR(20) DEFAULT 'unchecked',
ADD COLUMN IF NOT EXISTS proxy_last_ip VARCHAR(50),
ADD COLUMN IF NOT EXISTS proxy_location VARCHAR(255);

-- Adicionar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_accounts_proxy_enabled ON whatsapp_accounts(proxy_enabled);

-- Comentários nas colunas
COMMENT ON COLUMN whatsapp_accounts.proxy_enabled IS 'Se o proxy está habilitado para esta conta';
COMMENT ON COLUMN whatsapp_accounts.proxy_type IS 'Tipo de proxy: socks5, http, https';
COMMENT ON COLUMN whatsapp_accounts.proxy_host IS 'Host/IP do servidor proxy';
COMMENT ON COLUMN whatsapp_accounts.proxy_port IS 'Porta do servidor proxy';
COMMENT ON COLUMN whatsapp_accounts.proxy_username IS 'Usuário para autenticação no proxy';
COMMENT ON COLUMN whatsapp_accounts.proxy_password IS 'Senha para autenticação no proxy';
COMMENT ON COLUMN whatsapp_accounts.proxy_last_check IS 'Última vez que o proxy foi verificado';
COMMENT ON COLUMN whatsapp_accounts.proxy_status IS 'Status do proxy: unchecked, working, failed';
COMMENT ON COLUMN whatsapp_accounts.proxy_last_ip IS 'Último IP detectado pelo proxy';
COMMENT ON COLUMN whatsapp_accounts.proxy_location IS 'Localização detectada do proxy (país, cidade)';

