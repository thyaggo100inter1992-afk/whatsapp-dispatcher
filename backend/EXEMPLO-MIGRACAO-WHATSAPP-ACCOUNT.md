# 📝 EXEMPLO PRÁTICO: Migração do WhatsAppAccountController

## 🎯 OBJETIVO

Migrar `whatsapp-account.controller.ts` para funcionar com multi-tenancy

---

## ✅ MUDANÇAS NECESSÁRIAS

### 1. **Import - Linha 4**

**ANTES:**
```typescript
import { query } from '../database/connection';
```

**DEPOIS:**
```typescript
import { tenantQuery } from '../database/tenant-query';
```

---

### 2. **Linha 108 - Query de Estatísticas**

**ANTES:**
```typescript
const statsResult = await query(
  `SELECT 
    SUM(CASE WHEN UPPER(t.category) = 'UTILITY' THEN 1 ELSE 0 END) as utility_count,
    ...
   WHERE m.whatsapp_account_id = $1
   AND m.sent_at >= $2
   AND m.status IN ('sent', 'delivered', 'read')`,
  [account.id, today]
);
```

**DEPOIS:**
```typescript
const statsResult = await tenantQuery(
  req,  // ← ADICIONAR req
  `SELECT 
    SUM(CASE WHEN UPPER(t.category) = 'UTILITY' THEN 1 ELSE 0 END) as utility_count,
    ...
   WHERE m.whatsapp_account_id = $1
   AND m.sent_at >= $2
   AND m.status IN ('sent', 'delivered', 'read')`,
  [account.id, today]
);
```

---

## 🔍 ANÁLISE COMPLETA

### **Queries encontradas:**

1. **Linha 108:** `query(...)` para estatísticas
   - ✅ Mudar para: `tenantQuery(req, ...)`
   - ✅ RLS vai filtrar automaticamente por tenant_id

### **Models usados:**

- `WhatsAppAccountModel.create()`
- `WhatsAppAccountModel.findAll()`
- `WhatsAppAccountModel.findById()`

**Esses models também precisam ser atualizados!**

---

## 📦 MODEL: WhatsAppAccount

O modelo `WhatsAppAccountModel` precisa ser atualizado para usar `tenantQuery`:

### **Localização:** `backend/src/models/WhatsAppAccount.ts`

**ANTES (exemplo de método):**
```typescript
static async findAll() {
  const result = await query('SELECT * FROM whatsapp_accounts');
  return result.rows;
}
```

**DEPOIS:**
```typescript
import { queryWithTenantId } from '../database/tenant-query';

static async findAll(tenantId: number) {
  const result = await queryWithTenantId(
    tenantId,
    'SELECT * FROM whatsapp_accounts'
  );
  return result.rows;
}
```

**OU usar RLS diretamente:**
```typescript
import { tenantQuery } from '../database/tenant-query';

static async findAll(req: Request) {
  const result = await tenantQuery(req, 'SELECT * FROM whatsapp_accounts');
  return result.rows;
}
```

---

## ✨ VERSÃO COMPLETA MIGRADA

Aqui está o controller completo migrado (primeiras 50 linhas):

```typescript
import { Request, Response } from 'express';
import { WhatsAppAccountModel } from '../models/WhatsAppAccount';
import { whatsappService } from '../services/whatsapp.service';
import { tenantQuery } from '../database/tenant-query';  // ← MUDADO
import axios, { AxiosRequestConfig } from 'axios';
import { getProxyConfigFromAccount, applyProxyToRequest, formatProxyInfo } from '../helpers/proxy.helper';

export class WhatsAppAccountController {
  async create(req: Request, res: Response) {
    try {
      // Adicionar tenant_id antes de criar
      const data = {
        ...req.body,
        tenant_id: req.tenant.id  // ← ADICIONAR
      };
      const account = await WhatsAppAccountModel.create(data);
      res.status(201).json({ success: true, data: account });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async findAll(req: Request, res: Response) {
    try {
      // Passar req para filtrar por tenant
      const accounts = await WhatsAppAccountModel.findAll(req);  // ← ADICIONAR req
      res.json({ success: true, data: accounts });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getAccountDetails(req: Request, res: Response) {
    console.log('\n🔍 ===== GET ACCOUNT DETAILS =====');
    console.log(`   ID requisitado: ${req.params.id}`);
    console.log(`   Tenant: ${req.tenant.nome} (ID: ${req.tenant.id})`);  // ← LOG TENANT
    
    try {
      const accountId = parseInt(req.params.id);
      
      // Verificar se conta pertence ao tenant (RLS faz isso automaticamente)
      const account = await WhatsAppAccountModel.findById(req, accountId);  // ← ADICIONAR req
      
      if (!account) {
        return res.status(404).json({ 
          success: false, 
          error: 'Conta não encontrada ou não pertence ao seu tenant' 
        });
      }

      // ... resto do código ...

      // Estatísticas (Linha 108)
      const statsResult = await tenantQuery(  // ← MUDADO
        req,  // ← ADICIONAR req
        `SELECT 
          SUM(CASE WHEN UPPER(t.category) = 'UTILITY' THEN 1 ELSE 0 END) as utility_count,
          SUM(CASE WHEN UPPER(t.category) = 'MARKETING' THEN 1 ELSE 0 END) as marketing_count,
          SUM(CASE WHEN UPPER(t.category) = 'AUTHENTICATION' THEN 1 ELSE 0 END) as authentication_count,
          SUM(CASE WHEN UPPER(t.category) = 'SERVICE' THEN 1 ELSE 0 END) as service_count,
          COUNT(*) as total_messages
         FROM messages m
         LEFT JOIN templates t ON m.template_name = t.template_name 
           AND m.whatsapp_account_id = t.whatsapp_account_id
         WHERE m.whatsapp_account_id = $1
         AND m.sent_at >= $2
         AND m.status IN ('sent', 'delivered', 'read')`,
        [account.id, today]
      );

      // ... resto do código ...
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // ... outros métodos ...
}
```

---

## 🎯 RESUMO DAS MUDANÇAS

| Item | ANTES | DEPOIS |
|------|-------|--------|
| **Import** | `import { query }` | `import { tenantQuery }` |
| **Queries** | `query(sql, params)` | `tenantQuery(req, sql, params)` |
| **Create** | `Model.create(data)` | `Model.create({...data, tenant_id: req.tenant.id})` |
| **FindAll** | `Model.findAll()` | `Model.findAll(req)` |
| **FindById** | `Model.findById(id)` | `Model.findById(req, id)` |

---

## ✅ CHECKLIST

- [ ] Mudar import de `query` para `tenantQuery`
- [ ] Adicionar `req` em todas as chamadas de query
- [ ] Adicionar `tenant_id` no create
- [ ] Atualizar Models para aceitar `req`
- [ ] Testar com 2 tenants diferentes
- [ ] Verificar que não vê dados de outro tenant

---

## 🧪 TESTE

```bash
# 1. Login Tenant 1
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@empresa1.com","password":"senha123"}'

# Copiar token

# 2. Listar contas Tenant 1
curl http://localhost:3000/api/whatsapp-accounts \
  -H "Authorization: Bearer TOKEN_TENANT1"

# 3. Login Tenant 2
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@empresa2.com","password":"senha123"}'

# 4. Listar contas Tenant 2
curl http://localhost:3000/api/whatsapp-accounts \
  -H "Authorization: Bearer TOKEN_TENANT2"

# ✅ Deve retornar contas diferentes!
```

---

**Próximo:** Migrar Models (`WhatsAppAccount.ts`, `Campaign.ts`, etc.)





