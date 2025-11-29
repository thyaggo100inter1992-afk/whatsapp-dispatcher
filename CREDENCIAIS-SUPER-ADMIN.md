# 🔐 CREDENCIAIS DE ACESSO - SUPER ADMIN

**Data de Criação:** 21/11/2024  
**Status:** ✅ ATIVO

---

## 👤 USUÁRIO SUPER ADMIN

### **Para Administração de Tenants:**

```
┌─────────────────────────────────────────┐
│  📧 Email: superadmin@nettsistemas.com │
│  🔑 Senha: SuperAdmin@2024             │
│  🛡️  Role: super_admin                 │
└─────────────────────────────────────────┘
```

**Permissões:**
- ✅ Acessar Administração de Tenants
- ✅ Ver todos os tenants do sistema
- ✅ Criar, editar e excluir tenants
- ✅ Alterar status dos tenants
- ✅ Ver estatísticas de todos os tenants

---

## 👤 USUÁRIO NORMAL (Tenant)

### **Para Uso Normal do Sistema:**

```
┌─────────────────────────────────────────┐
│  📧 Email: admin@minhaempresa.com      │
│  🔑 Senha: admin123                    │
│  👔 Role: super_admin                  │
└─────────────────────────────────────────┘
```

**Permissões:**
- ✅ Acessar sistema normalmente
- ✅ Criar campanhas
- ✅ Gerenciar contas WhatsApp
- ✅ Usar API Oficial e QR Connect
- ✅ Também pode acessar Administração de Tenants

---

## 🔄 DIFERENÇAS

| Característica | Super Admin | Tenant Admin |
|---------------|-------------|--------------|
| **Email** | superadmin@nettsistemas.com | admin@minhaempresa.com |
| **Senha** | SuperAdmin@2024 | admin123 |
| **Propósito** | Gerenciar tenants | Usar o sistema |
| **Admin Tenants** | ✅ Sim | ✅ Sim |
| **Usar WhatsApp** | ✅ Sim | ✅ Sim |

---

## 🚀 COMO USAR

### **Acesso Super Admin:**

1. **Abra o navegador:**
   ```
   http://localhost:3001/login
   ```

2. **Faça login com:**
   ```
   Email: superadmin@nettsistemas.com
   Senha: SuperAdmin@2024
   ```

3. **Na página inicial:**
   - Você verá o botão laranja: `🛡️ Administração de Tenants`
   - Clique nele para gerenciar todos os tenants

4. **Ou acesse diretamente:**
   ```
   http://localhost:3001/admin/tenants
   ```

---

## 🔒 SEGURANÇA

### **Recomendações:**

1. ✅ **Guarde estas credenciais em local seguro**
2. ✅ **Não compartilhe a senha Super Admin**
3. ✅ **Use Super Admin apenas para administração**
4. ✅ **Use Tenant Admin para uso diário**

### **Alterar Senha do Super Admin:**

Se precisar alterar a senha do Super Admin:

```sql
-- No pgAdmin, execute:
UPDATE tenant_users
SET senha_hash = crypt('SuaNovaSenha', gen_salt('bf'))
WHERE email = 'superadmin@nettsistemas.com';
```

Ou crie um script `atualizar-senha-super-admin.js` similar ao de criação.

---

## 📊 HIERARQUIA DE ACESSOS

```
┌─────────────────────────────────────┐
│  SUPER ADMIN                        │
│  (superadmin@nettsistemas.com)      │
│                                     │
│  • Gerencia TODOS os tenants        │
│  • Cria, edita, exclui tenants      │
│  • Acessa todas as funcionalidades  │
└─────────────────────────────────────┘
            ↓
┌─────────────────────────────────────┐
│  TENANT ADMIN                       │
│  (admin@minhaempresa.com)           │
│                                     │
│  • Administra SEU tenant            │
│  • Cria campanhas                   │
│  • Gerencia contas WhatsApp         │
└─────────────────────────────────────┘
            ↓
┌─────────────────────────────────────┐
│  USUÁRIO COMUM                      │
│  (outros emails)                    │
│                                     │
│  • Usa o sistema                    │
│  • Não pode criar tenants           │
└─────────────────────────────────────┘
```

---

## ✅ VERIFICAR USUÁRIOS

Para ver todos os usuários super_admin no sistema:

```sql
SELECT 
  id,
  nome,
  email,
  role,
  ativo,
  tenant_id
FROM tenant_users
WHERE role = 'super_admin'
ORDER BY id;
```

---

## 🗑️ REMOVER SUPER ADMIN

Se precisar remover o usuário Super Admin:

```sql
DELETE FROM tenant_users
WHERE email = 'superadmin@nettsistemas.com';
```

---

## 📝 NOTAS

- O Super Admin foi criado automaticamente pelo script `criar-super-admin.js`
- Ambos os usuários (Super Admin e Tenant Admin) podem acessar a Administração de Tenants
- A diferença é principalmente organizacional - um para administração, outro para uso normal
- Você pode criar múltiplos Super Admins se necessário

---

## 🔗 LINKS ÚTEIS

- **Login:** http://localhost:3001/login
- **Admin Tenants:** http://localhost:3001/admin/tenants
- **Dashboard API:** http://localhost:3001/dashboard-oficial
- **Dashboard QR:** http://localhost:3001/dashboard-uaz

---

**⚠️ MANTENHA ESTE ARQUIVO SEGURO E NÃO COMPARTILHE AS CREDENCIAIS!**



