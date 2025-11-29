-- ============================================
-- SCRIPT: Corrigir Pagamentos Antigos
-- Data: 25/11/2025
-- Descrição: Corrige QR Codes duplicados e adiciona metadata aos pagamentos de consultas avulsas
-- ============================================

-- 1. Corrigir QR Codes com prefixo duplicado
UPDATE payments 
SET asaas_pix_qr_code = REPLACE(
  asaas_pix_qr_code, 
  'data:image/png;base64,data:image/png;base64,', 
  'data:image/png;base64,'
)
WHERE asaas_pix_qr_code LIKE '%data:image/png;base64,data:image/png;base64,%';

-- 2. Adicionar metadata aos pagamentos de consultas avulsas sem metadata
UPDATE payments 
SET metadata = jsonb_build_object(
  'tipo', 'consultas_avulsas',
  'quantidade_consultas', 
  CASE 
    -- Tentar extrair quantidade da descrição "Compra de X consultas avulsas"
    WHEN descricao ~ 'Compra de [0-9]+ consultas' THEN 
      (regexp_match(descricao, 'Compra de ([0-9]+) consultas'))[1]::int
    -- Se não encontrar, estimar pela valor (R$ 0,07 por consulta em média)
    ELSE 
      ROUND(valor / 0.07)::int
  END
)
WHERE descricao LIKE '%consultas avulsas%'
  AND (metadata IS NULL OR NOT metadata ? 'tipo');

-- 3. Adicionar metadata aos pagamentos de plano sem metadata
UPDATE payments 
SET metadata = jsonb_build_object(
  'tipo', 
  CASE 
    WHEN descricao LIKE '%upgrade%' OR descricao LIKE '%Upgrade%' THEN 'upgrade'
    WHEN descricao LIKE '%renovação%' OR descricao LIKE '%Renovação%' THEN 'renovacao'
    ELSE 'primeiro_pagamento'
  END
)
WHERE plan_id IS NOT NULL
  AND (metadata IS NULL OR NOT metadata ? 'tipo');

-- 4. Verificar resultados
SELECT 
  'QR Codes Corrigidos' as acao,
  COUNT(*) as total
FROM payments 
WHERE asaas_pix_qr_code NOT LIKE '%data:image/png;base64,data:image/png;base64,%'
  AND asaas_pix_qr_code IS NOT NULL
UNION ALL
SELECT 
  'Consultas Avulsas com Metadata' as acao,
  COUNT(*) as total
FROM payments 
WHERE metadata->>'tipo' = 'consultas_avulsas'
UNION ALL
SELECT 
  'Pagamentos de Plano com Metadata' as acao,
  COUNT(*) as total
FROM payments 
WHERE metadata->>'tipo' IN ('upgrade', 'renovacao', 'primeiro_pagamento');

-- 5. Mostrar exemplos de pagamentos corrigidos
SELECT 
  id,
  descricao,
  valor,
  metadata->>'tipo' as tipo,
  metadata->>'quantidade_consultas' as quantidade,
  LEFT(asaas_pix_qr_code, 50) as qr_code_inicio
FROM payments
WHERE descricao LIKE '%consultas%'
ORDER BY id DESC
LIMIT 5;




