-- ============================================
-- Migration 044: Adicionar coluna results na tabela uaz_verification_jobs
-- Necessário para armazenar os resultados de verificações em massa
-- ============================================

ALTER TABLE IF NOT EXISTS uaz_verification_jobs
  ADD COLUMN IF NOT EXISTS results JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN uaz_verification_jobs.results IS 'Resultados das verificações em massa (array de objetos)';
