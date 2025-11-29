-- =====================================================
-- MIGRATION: Add profile columns to uaz_instances
-- Descrição: Adiciona colunas para nome e foto do perfil
-- Data: 2024-11-15
-- =====================================================

-- Adiciona colunas de perfil do WhatsApp
ALTER TABLE uaz_instances 
ADD COLUMN IF NOT EXISTS profile_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS profile_pic_url TEXT;

-- Cria índice para busca por nome de perfil
CREATE INDEX IF NOT EXISTS idx_uaz_instances_profile ON uaz_instances(profile_name);










