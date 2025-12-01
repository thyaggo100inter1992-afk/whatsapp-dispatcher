-- Migration: Adicionar coluna updated_at na tabela campaign_templates
-- Data: 2025-12-01
-- Motivo: Corrigir erro "column ct.updated_at does not exist" nos relatórios

-- Adicionar coluna updated_at com valor padrão
ALTER TABLE campaign_templates 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Atualizar registros existentes com a data de created_at
UPDATE campaign_templates 
SET updated_at = created_at 
WHERE updated_at IS NULL;

-- Adicionar trigger para atualizar automaticamente o updated_at
CREATE OR REPLACE FUNCTION update_campaign_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger se não existir
DROP TRIGGER IF EXISTS trigger_update_campaign_templates_updated_at ON campaign_templates;
CREATE TRIGGER trigger_update_campaign_templates_updated_at
    BEFORE UPDATE ON campaign_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_campaign_templates_updated_at();

-- Comentário
COMMENT ON COLUMN campaign_templates.updated_at IS 'Data e hora da última atualização do registro';

