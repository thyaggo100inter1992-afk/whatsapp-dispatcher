-- ============================================
-- MIGRATION 042: Atualizar tabela de pagamentos
-- Data: 2024-11-24
-- Descrição: Adicionar campos específicos do Asaas
-- ============================================

-- Adicionar campos específicos do Asaas na tabela payments (se já existir)
DO $$ 
BEGIN
  -- Verificar se a tabela existe
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payments') THEN
    -- Adicionar colunas se não existirem
    ALTER TABLE payments 
    ADD COLUMN IF NOT EXISTS asaas_payment_id VARCHAR(100) UNIQUE,
    ADD COLUMN IF NOT EXISTS asaas_invoice_url TEXT,
    ADD COLUMN IF NOT EXISTS asaas_bank_slip_url TEXT,
    ADD COLUMN IF NOT EXISTS asaas_pix_qr_code TEXT,
    ADD COLUMN IF NOT EXISTS asaas_pix_copy_paste TEXT,
    ADD COLUMN IF NOT EXISTS payment_type VARCHAR(50) DEFAULT 'BOLETO',
    ADD COLUMN IF NOT EXISTS due_date DATE,
    ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMP;
    
    -- Criar índice
    CREATE INDEX IF NOT EXISTS idx_payments_asaas_id ON payments(asaas_payment_id);
  ELSE
    -- Se não existir, criar a tabela completa
    CREATE TABLE payments (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      plan_id INTEGER REFERENCES plans(id),
      
      -- Asaas IDs
      asaas_payment_id VARCHAR(100) UNIQUE,
      asaas_customer_id VARCHAR(100),
      asaas_subscription_id VARCHAR(100),
      
      -- Valores
      valor DECIMAL(10,2) NOT NULL,
      valor_pago DECIMAL(10,2),
      descricao TEXT,
      
      -- Tipo e Status
      payment_type VARCHAR(50) DEFAULT 'BOLETO', -- BOLETO, PIX, CREDIT_CARD
      status VARCHAR(50) DEFAULT 'pending', -- pending, confirmed, received, overdue, cancelled, refunded
      
      -- Datas
      due_date DATE NOT NULL,
      paid_at TIMESTAMP,
      confirmed_at TIMESTAMP,
      refunded_at TIMESTAMP,
      
      -- URLs de pagamento
      asaas_invoice_url TEXT,
      asaas_bank_slip_url TEXT,
      asaas_pix_qr_code TEXT,
      asaas_pix_copy_paste TEXT,
      
      -- Metadata
      metadata JSONB DEFAULT '{}'::jsonb,
      
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
    
    -- Índices
    CREATE INDEX idx_payments_tenant ON payments(tenant_id);
    CREATE INDEX idx_payments_status ON payments(status);
    CREATE INDEX idx_payments_asaas_id ON payments(asaas_payment_id);
    CREATE INDEX idx_payments_due_date ON payments(due_date);
    
    -- Comentários
    COMMENT ON TABLE payments IS 'Registros de pagamentos dos tenants';
  END IF;
END $$;





