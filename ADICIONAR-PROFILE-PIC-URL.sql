-- =====================================================
-- Adicionar campo profile_pic_url na tabela uaz_instances
-- =====================================================

-- Adiciona coluna para armazenar a URL da foto do perfil do WhatsApp
ALTER TABLE uaz_instances 
ADD COLUMN IF NOT EXISTS profile_pic_url TEXT;

-- Comentário
COMMENT ON COLUMN uaz_instances.profile_pic_url IS 'URL da foto do perfil do WhatsApp';

-- Mensagem de sucesso
DO $$
BEGIN
    RAISE NOTICE '✅ Campo profile_pic_url adicionado com sucesso!';
    RAISE NOTICE 'ℹ️  Este campo armazena a URL da foto do perfil do WhatsApp';
END $$;










