-- ================================================
-- MIGRATION: Atualizar pacotes e faixas de preço padrão
-- Data: 2025-11-25
-- Descrição: Define configuração padrão dos pacotes e faixas
-- ================================================

-- 1. LIMPAR DADOS EXISTENTES
TRUNCATE TABLE consultas_avulsas_pacotes RESTART IDENTITY CASCADE;
TRUNCATE TABLE consultas_faixas_preco RESTART IDENTITY CASCADE;

-- 2. INSERIR PACOTES PADRÃO (conforme telas)
INSERT INTO consultas_avulsas_pacotes (nome, quantidade, preco, desconto, popular, ativo, ordem) VALUES
  ('Básico', 50, 5.00, 0, false, true, 1),
  ('Intermediário', 100, 9.00, 20, true, true, 2),
  ('Avançado', 200, 16.00, 33, false, true, 3),
  ('Profissional', 300, 21.00, 40, false, true, 4);

-- 3. INSERIR FAIXAS DE PREÇO PADRÃO (conforme telas)
-- IMPORTANTE: Compra por faixa só permitida acima de 100 consultas
INSERT INTO consultas_faixas_preco (quantidade_min, quantidade_max, preco_unitario, ativo, ordem) VALUES
  (1, 300, 0.08, true, 1),
  (301, 600, 0.07, true, 2),
  (601, 999, 0.07, true, 3),
  (1000, NULL, 0.06, true, 4);

-- 4. Log de sucesso
DO $$
BEGIN
  RAISE NOTICE '✅ Pacotes e faixas de preço atualizados com sucesso!';
  RAISE NOTICE '📦 4 pacotes configurados: Básico (50), Intermediário (100), Avançado (200), Profissional (300)';
  RAISE NOTICE '💰 4 faixas de preço configuradas';
  RAISE NOTICE '⚠️  REGRA: Compra por faixa só permitida acima de 100 consultas';
END $$;




