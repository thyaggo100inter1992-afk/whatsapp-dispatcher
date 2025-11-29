-- ============================================================================
-- CORREÇÃO: Atualizar status de tenants em trial para 'active'
-- Data: 27/11/2025
-- Objetivo: Tenants em período de trial devem ter status 'active'
-- ============================================================================

-- Verificar tenants com status 'trial' ANTES da correção
SELECT 
  id, 
  nome, 
  status, 
  ativo,
  trial_ends_at,
  created_at
FROM tenants
WHERE status = 'trial';

-- Atualizar tenants com status 'trial' para 'active'
-- Mantém o trial_ends_at para controlar o período de teste
UPDATE tenants
SET 
  status = 'active',
  ativo = true,
  updated_at = NOW()
WHERE status = 'trial';

-- Verificar resultado APÓS a correção
SELECT 
  id, 
  nome, 
  status, 
  ativo,
  trial_ends_at,
  CASE 
    WHEN trial_ends_at > NOW() THEN 'EM TRIAL ✅'
    WHEN trial_ends_at <= NOW() THEN 'TRIAL EXPIRADO ⚠️'
    ELSE 'SEM TRIAL'
  END as situacao_trial
FROM tenants
WHERE trial_ends_at IS NOT NULL
ORDER BY created_at DESC;

-- Mensagem de sucesso
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM tenants WHERE status = 'active' AND trial_ends_at > NOW();
  RAISE NOTICE '✅ Correção aplicada com sucesso!';
  RAISE NOTICE '📊 Tenants ativos em período de trial: %', v_count;
  RAISE NOTICE '💡 Agora todos os tenants em trial têm status = active';
  RAISE NOTICE '💡 O período de trial é controlado pelo campo trial_ends_at';
END $$;


