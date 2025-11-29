-- ================================================
-- MIGRATION: Criar tabela de faixas de preço para quantidade personalizada
-- ================================================

-- Criar tabela de faixas de preço
CREATE TABLE IF NOT EXISTS consultas_faixas_preco (
  id SERIAL PRIMARY KEY,
  quantidade_min INTEGER NOT NULL CHECK (quantidade_min >= 0),
  quantidade_max INTEGER CHECK (quantidade_max IS NULL OR quantidade_max > quantidade_min),
  preco_unitario DECIMAL(10, 2) NOT NULL CHECK (preco_unitario > 0),
  ativo BOOLEAN DEFAULT true,
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(quantidade_min, quantidade_max)
);

COMMENT ON TABLE consultas_faixas_preco IS 'Faixas de preço para quantidade personalizada de consultas avulsas';
COMMENT ON COLUMN consultas_faixas_preco.quantidade_min IS 'Quantidade mínima da faixa (ex: 1, 50, 100, 200)';
COMMENT ON COLUMN consultas_faixas_preco.quantidade_max IS 'Quantidade máxima da faixa (NULL = sem limite)';
COMMENT ON COLUMN consultas_faixas_preco.preco_unitario IS 'Preço por consulta nesta faixa';
COMMENT ON COLUMN consultas_faixas_preco.ativo IS 'Se a faixa está ativa';
COMMENT ON COLUMN consultas_faixas_preco.ordem IS 'Ordem de exibição/aplicação';

-- Índices
CREATE INDEX IF NOT EXISTS idx_consultas_faixas_preco_ativo ON consultas_faixas_preco(ativo);
CREATE INDEX IF NOT EXISTS idx_consultas_faixas_preco_ordem ON consultas_faixas_preco(ordem);
CREATE INDEX IF NOT EXISTS idx_consultas_faixas_preco_quantidade ON consultas_faixas_preco(quantidade_min, quantidade_max);

-- Inserir faixas de preço padrão
INSERT INTO consultas_faixas_preco (quantidade_min, quantidade_max, preco_unitario, ordem) VALUES
  (1, 49, 1.50, 1),
  (50, 99, 1.20, 2),
  (100, 199, 1.00, 3),
  (200, NULL, 0.90, 4)
ON CONFLICT DO NOTHING;

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_consultas_faixas_preco_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_consultas_faixas_preco_updated_at
  BEFORE UPDATE ON consultas_faixas_preco
  FOR EACH ROW
  EXECUTE FUNCTION update_consultas_faixas_preco_updated_at();

-- Log de sucesso
DO $$
BEGIN
  RAISE NOTICE '✅ Tabela consultas_faixas_preco criada com sucesso!';
END $$;




