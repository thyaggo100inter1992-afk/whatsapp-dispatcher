-- Script para corrigir status de pagamentos que já foram pagos mas ainda estão como PENDING
-- Execute este script no banco de dados

-- 1. Verificar pagamentos com status incorreto
SELECT 
  id,
  tenant_id,
  valor,
  status,
  paid_at,
  confirmed_at,
  created_at
FROM payments
WHERE status IN ('PENDING', 'pending')
  AND (paid_at IS NOT NULL OR confirmed_at IS NOT NULL);

-- 2. Corrigir automaticamente os pagamentos que têm data de pagamento mas status PENDING
UPDATE payments
SET 
  status = 'CONFIRMED',
  updated_at = CURRENT_TIMESTAMP
WHERE status IN ('PENDING', 'pending')
  AND (paid_at IS NOT NULL OR confirmed_at IS NOT NULL);

-- 3. Verificar resultado
SELECT 
  id,
  tenant_id,
  valor,
  status,
  paid_at,
  confirmed_at,
  created_at
FROM payments
WHERE id IN (
  SELECT id FROM payments 
  WHERE updated_at > CURRENT_TIMESTAMP - INTERVAL '1 minute'
);




