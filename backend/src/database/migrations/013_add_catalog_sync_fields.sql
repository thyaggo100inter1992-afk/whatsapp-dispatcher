-- Migration: Adicionar campos para sincronização com WhatsApp Catalog
-- Data: 2024-11-14
-- Descrição: Adicionar campos para rastrear sincronização com Facebook/WhatsApp Catalog

-- Adicionar facebook_catalog_id na tabela whatsapp_accounts
ALTER TABLE whatsapp_accounts 
ADD COLUMN IF NOT EXISTS facebook_catalog_id VARCHAR(255);

COMMENT ON COLUMN whatsapp_accounts.facebook_catalog_id IS 'ID do catálogo no Facebook Commerce';

-- Adicionar campos de sincronização na tabela products
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS facebook_product_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS synced_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS sync_status VARCHAR(50) DEFAULT 'not_synced';

-- Índices
CREATE INDEX IF NOT EXISTS idx_products_facebook_product_id ON products(facebook_product_id);
CREATE INDEX IF NOT EXISTS idx_products_sync_status ON products(sync_status);

-- Comentários
COMMENT ON COLUMN products.facebook_product_id IS 'ID do produto no catálogo do Facebook';
COMMENT ON COLUMN products.synced_at IS 'Data/hora da última sincronização';
COMMENT ON COLUMN products.sync_status IS 'Status da sincronização: not_synced, synced, error';

