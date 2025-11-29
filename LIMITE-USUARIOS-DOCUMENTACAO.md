# 📊 SISTEMA DE LIMITE DE USUÁRIOS POR TENANT

## ✅ STATUS: TOTALMENTE IMPLEMENTADO E FUNCIONAL

---

## 🎯 O QUE FOI IMPLEMENTADO

O sistema possui controle completo de quantos usuários cada tenant pode ter, baseado no plano dele ou em limites customizados.

---

## 📝 COMO FUNCIONA

### 1. **Estrutura de Limites**

Cada tenant pode ter usuários limitados de duas formas:

#### A) **Limite do Plano (Padrão)**
- Definido na tabela `plans`
- Campo: `limite_usuarios`
- Exemplos:
  - Plano Básico: 1 usuário
  - Plano Pro: 3 usuários
  - Plano Enterprise: 10 usuários

#### B) **Limite Customizado (Opcional)**
- Definido na tabela `tenants`
- Campos:
  - `limites_customizados` (boolean) - Se TRUE, usa limites customizados
  - `limite_usuarios_customizado` (integer) - Limite customizado de usuários
- Sobrescreve o limite do plano quando ativo

### 2. **Prioridade de Limites**

```sql
COALESCE(t.limite_usuarios_customizado, p.limite_usuarios, 1)
```

A lógica é:
1. Se tenant tem `limite_usuarios_customizado` → usa este
2. Senão, se plano tem `limite_usuarios` → usa este
3. Senão → usa 1 (valor padrão)

---

## 🔒 ONDE ESTÁ ATIVO

### **Middleware: `checkUserLimit`**

Localização: `backend/src/middlewares/tenant-limits.middleware.js`

**Rotas Protegidas:**

1. **POST /api/gestao/users**
   - Criação de usuários pelo admin do tenant
   - Valida antes de criar

2. **POST /api/admin/tenants/:id/users**
   - Criação de usuários pelo Super Admin
   - Valida antes de criar

---

## 🚀 COMO USAR

### **1. Aplicar as Colunas no Banco (Primeira Vez)**

Execute o script batch:

```batch
APLICAR-LIMITES-USUARIOS.bat
```

Ou manualmente no PostgreSQL:

```sql
-- Executar o arquivo
\i backend/adicionar-limites-customizados-tenants.sql
```

---

### **2. Verificar Limites Atuais**

Execute:

```batch
VERIFICAR-LIMITES-USUARIOS.bat
```

Ou consulta SQL:

```sql
SELECT 
  t.id,
  t.nome,
  COALESCE(t.limite_usuarios_customizado, p.limite_usuarios, 1) as limite,
  COUNT(tu.id) as usuarios_ativos,
  p.nome as plano
FROM tenants t
LEFT JOIN plans p ON t.plan_id = p.id
LEFT JOIN tenant_users tu ON tu.tenant_id = t.id AND tu.ativo = true
GROUP BY t.id, t.nome, t.limite_usuarios_customizado, p.limite_usuarios, p.nome
ORDER BY t.id;
```

---

### **3. Definir Limite Customizado para um Tenant**

#### Via Interface (Super Admin):

1. Acesse `/admin/tenants`
2. Clique em "Editar" no tenant
3. Ative "Limites Customizados"
4. Defina o "Limite de Usuários"
5. Salve

#### Via API:

```bash
curl -X PUT http://localhost:5000/api/admin/tenants/1 \
  -H "Authorization: Bearer SEU_TOKEN_SUPER_ADMIN" \
  -H "Content-Type: application/json" \
  -d '{
    "limites_customizados": true,
    "limite_usuarios_customizado": 5
  }'
```

#### Via SQL:

```sql
UPDATE tenants 
SET 
  limites_customizados = true,
  limite_usuarios_customizado = 5
WHERE id = 1;
```

---

### **4. Remover Limite Customizado (Voltar ao Padrão do Plano)**

#### Via Interface (Super Admin):

1. Acesse `/admin/tenants`
2. Clique em "Editar" no tenant
3. Desative "Limites Customizados"
4. Salve

#### Via SQL:

```sql
UPDATE tenants 
SET 
  limites_customizados = false,
  limite_usuarios_customizado = NULL
WHERE id = 1;
```

---

## 🧪 TESTAR A FUNCIONALIDADE

### **Teste 1: Criar Usuário com Limite Disponível**

1. Configure um tenant com limite de 3 usuários
2. Tenant atualmente tem 2 usuários ativos
3. Tente criar um novo usuário
4. **Resultado esperado:** ✅ Usuário criado com sucesso

### **Teste 2: Criar Usuário com Limite Esgotado**

1. Configure um tenant com limite de 2 usuários
2. Tenant atualmente tem 2 usuários ativos
3. Tente criar um novo usuário
4. **Resultado esperado:** ❌ Erro 403

```json
{
  "success": false,
  "message": "❌ Limite de usuários atingido! Máximo: 2, Atual: 2",
  "limite": 2,
  "atual": 2
}
```

### **Teste 3: Super Admin Nunca Tem Limites**

1. Faça login como Super Admin
2. Crie usuários em qualquer tenant
3. **Resultado esperado:** ✅ Sempre funciona (sem verificação de limite)

---

## 📊 ESTRUTURA DO BANCO DE DADOS

### **Tabela: `tenants`**

```sql
-- Colunas relacionadas a limites de usuários
limite_usuarios_customizado INTEGER,           -- Limite customizado (NULL = usa do plano)
limites_customizados BOOLEAN DEFAULT FALSE     -- Flag se usa limites customizados
```

### **Tabela: `plans`**

```sql
-- Limite padrão do plano
limite_usuarios INTEGER DEFAULT 1              -- Limite de usuários do plano
```

### **Tabela: `tenant_users`**

```sql
-- Usuários do tenant
ativo BOOLEAN DEFAULT TRUE                     -- Apenas usuários ativos contam no limite
```

---

## 🔍 LOGS E DEBUG

### **Middleware Logs**

Quando o middleware é executado, ele loga:

```
✅ Limite de usuários OK - Tenant 1: 2/5
```

Ou quando bloqueado:

```
🚫 Limite de usuários atingido - Tenant 1: 5/5
```

### **Verificar no Backend**

Veja os logs no console do backend ao criar um usuário.

---

## 💡 EXEMPLOS PRÁTICOS

### **Exemplo 1: Tenant com Plano Básico**

```sql
-- Tenant ID 1
plan_id: 1 (Plano Básico)
limites_customizados: false
limite_usuarios_customizado: NULL

-- Plano Básico
limite_usuarios: 1

-- Resultado: Tenant pode ter no máximo 1 usuário
```

### **Exemplo 2: Tenant com Limite Customizado**

```sql
-- Tenant ID 2
plan_id: 1 (Plano Básico = 1 usuário)
limites_customizados: true
limite_usuarios_customizado: 10

-- Resultado: Tenant pode ter no máximo 10 usuários (customizado)
```

### **Exemplo 3: Tenant com Plano Pro**

```sql
-- Tenant ID 3
plan_id: 2 (Plano Pro)
limites_customizados: false
limite_usuarios_customizado: NULL

-- Plano Pro
limite_usuarios: 3

-- Resultado: Tenant pode ter no máximo 3 usuários
```

---

## ⚠️ OBSERVAÇÕES IMPORTANTES

1. **Super Admin nunca tem limites**
   - `role = 'super_admin'` bypassa todas as verificações

2. **Apenas usuários ATIVOS contam**
   - Query filtra: `tu.ativo = true`

3. **Contagem em tempo real**
   - Cada vez que tenta criar, o sistema verifica o limite atual

4. **Bloqueio antes da criação**
   - O middleware é executado ANTES de tentar inserir no banco

5. **Mensagem clara de erro**
   - Usuário recebe mensagem com limite máximo e uso atual

---

## 🛠️ SCRIPTS AUXILIARES

### **1. APLICAR-LIMITES-USUARIOS.bat**
- Aplica as colunas necessárias no banco
- Execute apenas uma vez (ou sempre que criar novo banco)

### **2. VERIFICAR-LIMITES-USUARIOS.bat**
- Mostra tabela com limites e uso de cada tenant
- Use para monitorar o sistema

### **3. TESTAR-LIMITE-USUARIOS.bat**
- Interface interativa para testar
- Pode definir, remover e verificar limites

---

## 📞 SUPORTE

Se tiver problemas:

1. Verifique se as colunas existem: `VERIFICAR-LIMITES-USUARIOS.bat`
2. Verifique logs do backend ao criar usuário
3. Teste com Super Admin (deve sempre funcionar)
4. Verifique se o plano tem `limite_usuarios` definido

---

## ✅ CHECKLIST DE IMPLEMENTAÇÃO

- [x] Middleware `checkUserLimit` criado
- [x] Aplicado nas rotas de criação de usuários
- [x] Colunas no banco de dados (`tenants`)
- [x] Integração com tabela `plans`
- [x] Super Admin bypass
- [x] Mensagens de erro claras
- [x] Logs de debug
- [x] Scripts de teste e verificação
- [x] Documentação completa

---

## 🎉 CONCLUSÃO

O sistema de limite de usuários está **100% funcional** e pronto para uso em produção!

**Data de Implementação:** Novembro 2025
**Autor:** Sistema Disparador WhatsApp
**Versão:** 1.0





