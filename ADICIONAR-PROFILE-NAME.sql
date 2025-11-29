-- =====================================================
-- Adicionar campo profile_name na tabela uaz_instances
-- =====================================================

-- Adiciona coluna para armazenar o nome do perfil do WhatsApp
ALTER TABLE uaz_instances 
ADD COLUMN IF NOT EXISTS profile_name VARCHAR(255);

-- Comentário
COMMENT ON COLUMN uaz_instances.profile_name IS 'Nome do perfil exibido no WhatsApp (visível para contatos)';

-- Mensagem de sucesso
DO $$
BEGIN
    RAISE NOTICE '✅ Campo profile_name adicionado com sucesso!';
    RAISE NOTICE 'ℹ️  Este campo armazena o nome do perfil do WhatsApp';
END $$;










