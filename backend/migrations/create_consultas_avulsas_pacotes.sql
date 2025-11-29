-- ================================================
-- MIGRATION: Criar tabela de pacotes de consultas avulsas
-- ================================================

-- Criar tabela de pacotes
CREATE TABLE IF NOT EXISTS consultas_avulsas_pacotes (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  quantidade INTEGER NOT NULL CHECK (quantidade > 0),
  preco DECIMAL(10, 2) NOT NULL CHECK (preco > 0),
  preco_unitario DECIMAL(10, 2) GENERATED ALWAYS AS (preco / NULLIF(quantidade, 0)) STORED,
  desconto INTEGER DEFAULT 0 CHECK (desconto >= 0 AND desconto <= 100),
  popular BOOLEAN DEFAULT false,
  ativo BOOLEAN DEFAULT true,
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE consultas_avulsas_pacotes IS 'Pacotes de consultas avulsas configuráveis';
COMMENT ON COLUMN consultas_avulsas_pacotes.nome IS 'Nome do pacote (ex: Básico, Intermediário, Avançado)';
COMMENT ON COLUMN consultas_avulsas_pacotes.quantidade IS 'Quantidade de consultas no pacote';
COMMENT ON COLUMN consultas_avulsas_pacotes.preco IS 'Preço total do pacote em reais';
COMMENT ON COLUMN consultas_avulsas_pacotes.preco_unitario IS 'Preço por consulta (calculado automaticamente)';
COMMENT ON COLUMN consultas_avulsas_pacotes.desconto IS 'Percentual de desconto do pacote';
COMMENT ON COLUMN consultas_avulsas_pacotes.popular IS 'Marcar como pacote mais popular (destaque)';
COMMENT ON COLUMN consultas_avulsas_pacotes.ativo IS 'Se o pacote está ativo e disponível para compra';
COMMENT ON COLUMN consultas_avulsas_pacotes.ordem IS 'Ordem de exibição do pacote';

-- Índices
CREATE INDEX IF NOT EXISTS idx_consultas_avulsas_pacotes_ativo ON consultas_avulsas_pacotes(ativo);
CREATE INDEX IF NOT EXISTS idx_consultas_avulsas_pacotes_ordem ON consultas_avulsas_pacotes(ordem);

-- Inserir pacotes padrão
INSERT INTO consultas_avulsas_pacotes (nome, quantidade, preco, desconto, popular, ordem) VALUES
  ('Básico', 10, 15.00, 0, false, 1),
  ('Intermediário', 50, 60.00, 20, true, 2),
  ('Avançado', 100, 100.00, 33, false, 3),
  ('Profissional', 200, 180.00, 40, false, 4)
ON CONFLICT DO NOTHING;

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_consultas_avulsas_pacotes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_consultas_avulsas_pacotes_updated_at
  BEFORE UPDATE ON consultas_avulsas_pacotes
  FOR EACH ROW
  EXECUTE FUNCTION update_consultas_avulsas_pacotes_updated_at();

-- Log de sucesso
DO $$
BEGIN
  RAISE NOTICE '✅ Tabela consultas_avulsas_pacotes criada com sucesso!';
END $$;




