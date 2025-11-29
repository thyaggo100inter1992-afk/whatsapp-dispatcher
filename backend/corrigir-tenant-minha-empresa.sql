-- ============================================
-- CORRIGIR TENANT "Minha Empresa" ACIMA DO LIMITE
-- ============================================

-- Tenant ID: 1
-- Problema: 3 usuários (limite 1), 6 contas WhatsApp (limite 1)

-- SOLUÇÃO: Aumentar limites customizados

BEGIN;

-- Aumentar limite de usuários e contas WhatsApp
UPDATE tenants 
SET 
  limites_customizados = true,
  limite_usuarios_customizado = 10,
  limite_whatsapp_customizado = 10,
  updated_at = NOW()
WHERE id = 1;

-- Verificar o resultado
SELECT 
  id,
  nome,
  limites_customizados,
  limite_usuarios_customizado,
  limite_whatsapp_customizado,
  (SELECT COUNT(*) FROM tenant_users WHERE tenant_id = 1 AND ativo = true) as usuarios_ativos,
  (SELECT COUNT(*) FROM whatsapp_accounts WHERE tenant_id = 1) as contas_api,
  (SELECT COUNT(*) FROM uaz_instances WHERE tenant_id = 1) as contas_qr
FROM tenants
WHERE id = 1;

COMMIT;

-- Mensagem final
SELECT 'Tenant "Minha Empresa" corrigido! Agora permite 10 usuários e 10 contas WhatsApp.' as resultado;





