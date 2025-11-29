-- Migration: Criar tabela de produtos (catálogo)
-- Data: 2024-11-14
-- Descrição: Tabela para gerenciar catálogo de produtos do WhatsApp Business

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  whatsapp_account_id INTEGER NOT NULL REFERENCES whatsapp_accounts(id) ON DELETE CASCADE,
  
  -- Informações básicas do produto
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'BRL',
  
  -- Imagem do produto
  image_url TEXT,
  
  -- Estoque e disponibilidade
  in_stock BOOLEAN DEFAULT true,
  stock_quantity INTEGER DEFAULT 0,
  
  -- Categoria e organização
  category VARCHAR(100),
  sku VARCHAR(100),
  
  -- URL externa (site, loja, etc)
  url TEXT,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Índices
  CONSTRAINT products_sku_account_unique UNIQUE(whatsapp_account_id, sku)
);

-- Índices para melhor performance
CREATE INDEX idx_products_account ON products(whatsapp_account_id);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_active ON products(is_active);
CREATE INDEX idx_products_in_stock ON products(in_stock);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER products_updated_at_trigger
BEFORE UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION update_products_updated_at();

-- Comentários
COMMENT ON TABLE products IS 'Catálogo de produtos do WhatsApp Business';
COMMENT ON COLUMN products.whatsapp_account_id IS 'ID da conta WhatsApp proprietária';
COMMENT ON COLUMN products.name IS 'Nome do produto';
COMMENT ON COLUMN products.description IS 'Descrição detalhada do produto';
COMMENT ON COLUMN products.price IS 'Preço do produto';
COMMENT ON COLUMN products.currency IS 'Moeda do preço (BRL, USD, etc)';
COMMENT ON COLUMN products.image_url IS 'URL da imagem do produto';
COMMENT ON COLUMN products.in_stock IS 'Produto disponível em estoque';
COMMENT ON COLUMN products.stock_quantity IS 'Quantidade em estoque';
COMMENT ON COLUMN products.category IS 'Categoria do produto';
COMMENT ON COLUMN products.sku IS 'SKU (código único do produto)';
COMMENT ON COLUMN products.url IS 'URL externa do produto';
COMMENT ON COLUMN products.is_active IS 'Produto ativo no catálogo';

