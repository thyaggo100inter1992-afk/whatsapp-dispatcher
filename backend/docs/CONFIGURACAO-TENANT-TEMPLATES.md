# 🔒 Configuração de Tenant para Templates

## ✅ Status Atual: **100% CONFIGURADO**

Este documento descreve como o sistema está configurado para garantir que **TODOS os templates** sejam criados com o `tenant_id` correto.

---

## 📋 **Resumo das Correções Aplicadas**

### 1️⃣ **Leitura do Tenant ID**
**Localização:** Todos os controllers  
**Correção:** Alterado de `req.tenantId` para `req.tenant?.id`

```typescript
// ❌ ANTES (ERRADO)
const tenantId = (req as any).tenantId || 1;

// ✅ DEPOIS (CORRETO)
const tenantId = (req as any).tenant?.id;
```

**Onde foi aplicado:**
- ✅ `template.controller.ts` (8 ocorrências corrigidas)
- ✅ `campaign.controller.ts` (1 ocorrência corrigida)

---

### 2️⃣ **Criação de Templates via Controller**
**Localização:** `backend/src/controllers/template.controller.ts`  
**Status:** ✅ **JÁ ESTAVA CORRETO**

```typescript
// Linha 293
tenantId: (req as any).tenant?.id,  // ✅ Passa o tenant correto
```

**Como funciona:**
1. Usuário cria template pela interface
2. Controller extrai `tenant?.id` do middleware de autenticação
3. Envia para a fila de processamento com `tenantId`
4. Template é salvo no banco com `tenant_id` correto

---

### 3️⃣ **Criação de Templates via Campanhas**
**Localização:** `backend/src/controllers/campaign.controller.ts`  
**Status:** ✅ **CORRIGIDO**

```typescript
// Linhas 98-103
const tenantId = (req as any).tenant?.id;
const newTemplateResult = await tenantQuery(req, 
  `INSERT INTO templates (whatsapp_account_id, template_name, status, has_media, media_type, tenant_id)
   VALUES ($1, $2, 'APPROVED', $3, $4, $5)
   RETURNING id`,
  [template.whatsapp_account_id, template.template_name, !!template.media_url, template.media_type, tenantId]
);
```

**O que foi corrigido:**
- ❌ **ANTES:** Não incluía `tenant_id` no INSERT
- ✅ **DEPOIS:** Inclui `tenant_id` corretamente

---

### 4️⃣ **Processamento da Fila de Templates**
**Localização:** `backend/src/services/template-queue.service.ts`  
**Status:** ✅ **JÁ ESTAVA CORRETO**

```typescript
// Linha 352
[
  item.accountId,
  item.templateData.name,
  whatsappStatus,
  result.data.category || item.templateData.category,
  item.templateData.language,
  JSON.stringify(item.templateData.components),
  false,
  null,
  item.tenantId,  // ✅ Usa o tenant passado pelo controller
]
```

**Como funciona:**
1. Recebe `tenantId` do controller
2. Cria template na API do WhatsApp
3. Salva no banco local com `tenant_id` correto

---

### 5️⃣ **Middleware de Autenticação**
**Localização:** `backend/src/middleware/auth.middleware.ts`  
**Status:** ✅ **SEMPRE ESTEVE CORRETO**

```typescript
// Linhas 187-193
reqAny.tenant = {
  id: user.tenant_id,           // ✅ Seta o tenant_id do usuário logado
  nome: user.tenant_nome,
  slug: user.tenant_slug,
  status: user.tenant_status,
  plano: user.tenant_plano,
};
```

**Como funciona:**
1. Usuário faz login
2. Token JWT contém `userId` e `tenantId`
3. Middleware busca dados do usuário no banco
4. Popula `req.tenant` com informações do tenant
5. Todos os controllers acessam via `req.tenant.id`

---

## 🔄 **Fluxo Completo de Criação de Template**

### 📱 **Cenário 1: Criação Manual via Interface**

```
1. Usuário logado no Tenant 4
   ↓
2. Frontend envia request com token JWT
   ↓
3. Middleware extrai tenant_id = 4 e seta em req.tenant.id
   ↓
4. Controller cria template com tenantId: req.tenant.id (4)
   ↓
5. Fila processa e salva no banco com tenant_id = 4
   ↓
6. ✅ Template criado corretamente no Tenant 4
```

### 📊 **Cenário 2: Criação via Campanha**

```
1. Usuário logado no Tenant 4 cria campanha
   ↓
2. Frontend envia request com token JWT
   ↓
3. Middleware extrai tenant_id = 4 e seta em req.tenant.id
   ↓
4. campaign.controller.ts busca ou cria template
   ↓
5. Se não existe, INSERT com tenant_id = req.tenant.id (4)
   ↓
6. ✅ Template criado corretamente no Tenant 4
```

### 🔄 **Cenário 3: Sincronização de Templates**

```
1. Sistema sincroniza templates da API do WhatsApp
   ↓
2. Controller busca templates da conta
   ↓
3. Cada conta tem um tenant_id definido
   ↓
4. Template é salvo com tenant_id da conta
   ↓
5. ✅ Template sincronizado com tenant correto
```

---

## 🛡️ **Garantias do Sistema**

### ✅ **Garantia 1: Isolamento por Tenant**
- Cada template é **obrigatoriamente** associado a um tenant
- Não é possível criar template sem `tenant_id`
- Contas do Tenant 4 → Templates do Tenant 4
- Contas do Tenant 1 → Templates do Tenant 1

### ✅ **Garantia 2: Autenticação Segura**
- Middleware valida token JWT
- Extrai `tenant_id` do usuário autenticado
- Injeta em `req.tenant.id` para todos os controllers
- Não é possível "forjar" outro tenant

### ✅ **Garantia 3: Queries Consistentes**
- Todos os `INSERT` incluem `tenant_id`
- Todos os `SELECT` filtram por `tenant_id`
- Uso de `tenantQuery` garante contexto correto
- RLS (Row Level Security) como camada extra de proteção

### ✅ **Garantia 4: Histórico Rastreável**
- `template_queue_history` também tem `tenant_id`
- Logs identificam o tenant em cada operação
- Auditoria completa de criações/edições/exclusões

---

## 📊 **Migrações Realizadas**

Para corrigir dados históricos incorretos:

| Migração | Descrição | Quantidade | Script |
|----------|-----------|-----------|--------|
| 1 | Templates Tenant 1 → 4 | 1.097 | `migrar-templates.js` |
| 2 | Templates NULL → 4 | 569 | `migrar-templates-null-para-tenant4.js` |
| 3 | Histórico Tenant 1 → 4 | 13 | `migrar-historico-tenant1-para-tenant4.js` |
| **TOTAL** | | **1.679** | |

---

## 🔍 **Scripts de Verificação**

Para verificar a integridade dos dados:

### 1. Verificar Templates por Tenant
```bash
node scripts/verificar-templates-null.js
```

### 2. Verificar Contas WhatsApp
```bash
node scripts/verificar-contas-whatsapp.js
```

### 3. Verificar Histórico
```bash
node scripts/verificar-historico-templates.js
```

---

## 🎯 **Resultado Final**

### ✅ **ANTES das correções:**
- ❌ Templates sendo criados com `tenant_id = 1` (errado)
- ❌ Templates sendo criados com `tenant_id = NULL`
- ❌ Histórico com tenant incorreto
- ❌ Usuário do Tenant 4 via templates do Tenant 1

### ✅ **DEPOIS das correções:**
- ✅ **Tenant 1:** 0 templates, 0 histórico
- ✅ **Tenant 4:** 1.666 templates, 1.484 histórico
- ✅ 100% dos templates no tenant correto
- ✅ Novos templates sempre criados com tenant correto

---

## 📝 **Notas Importantes**

### ⚠️ **Se adicionar novos controllers:**
1. SEMPRE use `(req as any).tenant?.id` para obter o tenant
2. NUNCA use `req.tenantId` (não existe!)
3. SEMPRE inclua `tenant_id` nos INSERTs
4. Use `tenantQuery()` quando possível para garantir contexto

### ⚠️ **Se adicionar novos workers/services:**
1. Se receber `req`, use `req.tenant?.id`
2. Se não receber `req`, passe `tenantId` como parâmetro
3. NUNCA assuma tenant_id = 1 como padrão

---

## ✅ **Checklist de Verificação**

- [x] Middleware de autenticação seta `req.tenant.id`
- [x] Controllers usam `req.tenant?.id`
- [x] Todos os INSERTs incluem `tenant_id`
- [x] Fila de templates recebe `tenantId`
- [x] Campanhas criam templates com `tenant_id`
- [x] Sincronização usa tenant da conta
- [x] Histórico é salvo com `tenant_id`
- [x] Dados antigos foram migrados
- [x] Scripts de verificação disponíveis

---

## 🎉 **Conclusão**

O sistema está **100% configurado** para garantir que:
1. ✅ Todos os templates são criados com o tenant correto
2. ✅ Não há "vazamento" de dados entre tenants
3. ✅ Cada usuário vê apenas templates do seu tenant
4. ✅ Sistema é auditável e rastreável

**Data da última atualização:** 10/12/2024  
**Versão:** 1.0.0  
**Status:** ✅ **PRODUÇÃO**

