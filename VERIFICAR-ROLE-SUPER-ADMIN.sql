-- ========================================
-- VERIFICAR E CORRIGIR ROLE DO USUÁRIO
-- ========================================

-- 1. VERIFICAR ROLE ATUAL
SELECT 
  id,
  nome,
  email,
  role,
  ativo,
  tenant_id
FROM tenant_users
WHERE email = 'admin@minhaempresa.com';

-- 2. SE A ROLE NÃO FOR 'super_admin', EXECUTE ISTO:
UPDATE tenant_users
SET role = 'super_admin'
WHERE email = 'admin@minhaempresa.com';

-- 3. VERIFICAR SE FOI ATUALIZADO
SELECT 
  id,
  nome,
  email,
  role,
  ativo
FROM tenant_users
WHERE email = 'admin@minhaempresa.com';

-- ========================================
-- ROLES DISPONÍVEIS:
-- ========================================
-- 'super_admin' - Acesso total (vê todos os tenants)
-- 'admin'       - Administrador do tenant
-- 'user'        - Usuário comum
-- ========================================



