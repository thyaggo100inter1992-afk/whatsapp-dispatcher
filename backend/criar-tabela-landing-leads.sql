-- ============================================
-- CRIAR TABELA DE LEADS DA LANDING PAGE
-- ============================================

-- Tabela para armazenar leads vindos da landing page
CREATE TABLE IF NOT EXISTS landing_leads (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  telefone VARCHAR(50),
  empresa VARCHAR(255),
  mensagem TEXT,
  origem VARCHAR(50) DEFAULT 'landing_page',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_landing_leads_email ON landing_leads(email);
CREATE INDEX IF NOT EXISTS idx_landing_leads_created ON landing_leads(created_at DESC);

-- Comentário
COMMENT ON TABLE landing_leads IS 'Leads e contatos vindos da landing page';

-- Inserir dados de exemplo (opcional)
-- INSERT INTO landing_leads (nome, email, telefone, empresa, mensagem)
-- VALUES 
--   ('João Silva', 'joao@example.com', '(11) 98765-4321', 'Empresa Teste', 'Gostaria de saber mais'),
--   ('Maria Santos', 'maria@example.com', '(21) 99876-5432', 'Tech Solutions', 'Interesse em planos');

SELECT 'Tabela landing_leads criada com sucesso!' as status;

