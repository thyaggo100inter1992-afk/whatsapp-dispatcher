-- ═══════════════════════════════════════════════════════════════
-- 🔐 VERIFICAR USUÁRIOS MASTER NO BANCO DE DADOS
-- ═══════════════════════════════════════════════════════════════

-- 1️⃣ LISTAR TODOS OS USUÁRIOS MASTER
-- ───────────────────────────────────────────────────────────────
SELECT 
  tu.id,
  tu.tenant_id,
  tu.email,
  tu.nome,
  tu.ativo,
  tu.created_at,
  tu.ultimo_login,
  tu.total_logins,
  t.nome as tenant_nome,
  t.slug as tenant_slug,
  t.plano,
  t.status as tenant_status
FROM tenant_users tu
INNER JOIN tenants t ON tu.tenant_id = t.id
WHERE tu.role = 'super_admin'
ORDER BY tu.created_at DESC;

-- ═══════════════════════════════════════════════════════════════

-- 2️⃣ CONTAR USUÁRIOS MASTER
-- ───────────────────────────────────────────────────────────────
SELECT 
  COUNT(*) as total_masters,
  COUNT(CASE WHEN ativo = true THEN 1 END) as ativos,
  COUNT(CASE WHEN ativo = false THEN 1 END) as inativos,
  COUNT(CASE WHEN ultimo_login IS NULL THEN 1 END) as nunca_usados
FROM tenant_users
WHERE role = 'super_admin';

-- ═══════════════════════════════════════════════════════════════

-- 3️⃣ TENANTS SEM USUÁRIO MASTER
-- ───────────────────────────────────────────────────────────────
SELECT 
  t.id,
  t.nome,
  t.slug,
  t.email,
  t.plano,
  t.status
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 
  FROM tenant_users tu 
  WHERE tu.tenant_id = t.id 
  AND tu.role = 'super_admin'
)
ORDER BY t.id;

-- ═══════════════════════════════════════════════════════════════

-- 4️⃣ USUÁRIO MASTER DE UM TENANT ESPECÍFICO
-- ───────────────────────────────────────────────────────────────
-- Substitua {TENANT_ID} pelo ID do tenant que deseja verificar

SELECT 
  tu.id,
  tu.tenant_id,
  tu.email,
  tu.nome,
  tu.senha_hash,
  tu.ativo,
  tu.created_at,
  tu.ultimo_login,
  tu.total_logins
FROM tenant_users tu
WHERE tu.tenant_id = {TENANT_ID} -- ⚠️ SUBSTITUIR AQUI
AND tu.role = 'super_admin';

-- ═══════════════════════════════════════════════════════════════

-- 5️⃣ MASTERS MAIS ATIVOS (TOP 10)
-- ───────────────────────────────────────────────────────────────
SELECT 
  tu.email,
  tu.total_logins,
  tu.ultimo_login,
  t.nome as tenant_nome
FROM tenant_users tu
INNER JOIN tenants t ON tu.tenant_id = t.id
WHERE tu.role = 'super_admin'
ORDER BY tu.total_logins DESC
LIMIT 10;

-- ═══════════════════════════════════════════════════════════════

-- 6️⃣ MASTERS NUNCA UTILIZADOS
-- ───────────────────────────────────────────────────────────────
SELECT 
  tu.id,
  tu.tenant_id,
  tu.email,
  tu.created_at,
  t.nome as tenant_nome,
  t.plano
FROM tenant_users tu
INNER JOIN tenants t ON tu.tenant_id = t.id
WHERE tu.role = 'super_admin'
AND tu.ultimo_login IS NULL
ORDER BY tu.created_at DESC;

-- ═══════════════════════════════════════════════════════════════

-- 7️⃣ VERIFICAR PADRÃO DE EMAIL
-- ───────────────────────────────────────────────────────────────
-- Verifica se todos os masters seguem o padrão correto

SELECT 
  tu.id,
  tu.tenant_id,
  tu.email,
  CASE 
    WHEN tu.email = CONCAT(tu.tenant_id, '@NETTSISTEMAS.COM.BR') 
    THEN '✅ Correto'
    ELSE '❌ Não segue o padrão'
  END as status_email
FROM tenant_users tu
WHERE tu.role = 'super_admin'
ORDER BY tu.tenant_id;

-- ═══════════════════════════════════════════════════════════════

-- 8️⃣ ESTATÍSTICAS GERAIS
-- ───────────────────────────────────────────────────────────────
SELECT 
  (SELECT COUNT(*) FROM tenants) as total_tenants,
  (SELECT COUNT(*) FROM tenant_users WHERE role = 'super_admin') as total_masters,
  (SELECT COUNT(*) FROM tenants WHERE NOT EXISTS (
    SELECT 1 FROM tenant_users tu 
    WHERE tu.tenant_id = tenants.id AND tu.role = 'super_admin'
  )) as tenants_sem_master,
  ROUND(
    (SELECT COUNT(*)::numeric FROM tenant_users WHERE role = 'super_admin') / 
    NULLIF((SELECT COUNT(*)::numeric FROM tenants), 0) * 100,
    2
  ) as percentual_cobertura;

-- ═══════════════════════════════════════════════════════════════

-- 9️⃣ CRIAR USUÁRIO MASTER MANUALMENTE (SE NECESSÁRIO)
-- ───────────────────────────────────────────────────────────────
-- Use apenas se precisar criar manualmente para um tenant específico
-- Substitua {TENANT_ID} pelo ID do tenant

/*
INSERT INTO tenant_users (
  tenant_id, 
  nome, 
  email, 
  senha_hash, 
  role, 
  ativo, 
  created_at, 
  updated_at
) VALUES (
  {TENANT_ID}, -- ⚠️ SUBSTITUIR AQUI
  'Master Access - NETT Sistemas',
  CONCAT({TENANT_ID}, '@NETTSISTEMAS.COM.BR'), -- ⚠️ SUBSTITUIR AQUI
  '$2a$10$xYzAbC...', -- ⚠️ HASH DA SENHA Tg130992*
  'super_admin',
  true,
  NOW(),
  NOW()
);
*/

-- NOTA: Para gerar o hash da senha, use bcrypt com 10 rounds
-- Senha padrão: master123@nettsistemas

-- ═══════════════════════════════════════════════════════════════

-- 🔟 DELETAR USUÁRIO MASTER (CUIDADO!)
-- ───────────────────────────────────────────────────────────────
-- Use apenas se realmente precisar deletar
-- Substitua {MASTER_USER_ID} pelo ID do usuário master

/*
DELETE FROM tenant_users 
WHERE id = {MASTER_USER_ID} -- ⚠️ SUBSTITUIR AQUI
AND role = 'super_admin';
*/

-- ⚠️ ATENÇÃO: Esta ação é irreversível!

-- ═══════════════════════════════════════════════════════════════

-- 📝 NOTAS IMPORTANTES:
-- ───────────────────────────────────────────────────────────────
-- 
-- 1. Usuários master têm role = 'super_admin'
-- 2. Email segue o padrão: {tenant_id}@NETTSISTEMAS.COM.BR
-- 3. Senha padrão: Tg130992* (armazenada como hash bcrypt)
-- 4. Usuários master são invisíveis nas queries normais devido ao
--    filtro: WHERE role != 'super_admin'
-- 5. Apenas super admins podem ver e gerenciar os masters
--
-- ═══════════════════════════════════════════════════════════════

