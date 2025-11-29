-- ============================================
-- CRIAR TABELA LISTA_RESTRICAO
-- ============================================
-- Tabela para armazenar CPFs bloqueados para consulta
-- CPFs nesta lista NÃO podem ser consultados em:
--   - Consulta Única
--   - Consulta em Massa
--   - Verificação e Higienização
-- ============================================

-- Remover tabela se existir
DROP TABLE IF EXISTS lista_restricao CASCADE;

-- Criar tabela
CREATE TABLE lista_restricao (
  id SERIAL PRIMARY KEY,
  cpf VARCHAR(14) NOT NULL UNIQUE,  -- CPF sem formatação (11 dígitos) ou CNPJ (14 dígitos)
  motivo TEXT,                       -- Motivo do bloqueio (opcional)
  ativo BOOLEAN DEFAULT true,        -- Se está ativo ou não
  data_adicao TIMESTAMP DEFAULT NOW(), -- Data de adição
  adicionado_por VARCHAR(100),       -- Usuário que adicionou (opcional)
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_lista_restricao_cpf ON lista_restricao(cpf);
CREATE INDEX idx_lista_restricao_ativo ON lista_restricao(ativo);

-- Comentários
COMMENT ON TABLE lista_restricao IS 'Lista de CPFs/CNPJs bloqueados para consulta de dados';
COMMENT ON COLUMN lista_restricao.cpf IS 'CPF ou CNPJ sem formatação (apenas números)';
COMMENT ON COLUMN lista_restricao.ativo IS 'Indica se o bloqueio está ativo';
COMMENT ON COLUMN lista_restricao.motivo IS 'Motivo do bloqueio (opcional)';

-- Log
SELECT 'Tabela lista_restricao criada com sucesso!' as status;





