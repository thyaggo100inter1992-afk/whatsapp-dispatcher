-- ============================================
-- TABELA: lista_restricao
-- Descrição: Armazena CPFs bloqueados para consulta
-- ============================================

CREATE TABLE IF NOT EXISTS lista_restricao (
  id SERIAL PRIMARY KEY,
  cpf VARCHAR(14) UNIQUE NOT NULL,
  data_adicao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ativo BOOLEAN DEFAULT TRUE
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_lista_restricao_cpf ON lista_restricao(cpf);
CREATE INDEX IF NOT EXISTS idx_lista_restricao_ativo ON lista_restricao(ativo);

-- Comentários
COMMENT ON TABLE lista_restricao IS 'Lista de CPFs bloqueados para consulta';
COMMENT ON COLUMN lista_restricao.cpf IS 'CPF bloqueado (apenas números)';
COMMENT ON COLUMN lista_restricao.data_adicao IS 'Data em que o CPF foi adicionado à lista';
COMMENT ON COLUMN lista_restricao.ativo IS 'Se o bloqueio está ativo (soft delete)';






