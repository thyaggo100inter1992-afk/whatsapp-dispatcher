-- ============================================
-- ADICIONAR MAPEAMENTO DE VARIÁVEIS
-- ============================================
-- Adiciona a coluna variables_map para armazenar
-- o mapeamento de variáveis técnicas → nomes descritivos
-- Exemplo: {"nome_cliente": "Nome do Cliente", "valor_pagar": "Valor a Pagar"}
-- ============================================

-- Adicionar coluna variables_map
ALTER TABLE qr_templates 
ADD COLUMN IF NOT EXISTS variables_map JSONB DEFAULT '{}';

-- Adicionar comentário
COMMENT ON COLUMN qr_templates.variables_map IS 'Mapeamento de variáveis técnicas para nomes descritivos: {variavel_tecnica: "Nome Descritivo"}';

-- ============================================
-- FIM DA MIGRATION
-- ============================================








