# 📋 INSTRUÇÕES ESPECÍFICAS PARA CADA CONTROLLER

Este documento contém as instruções exatas de migração para cada um dos 13 controllers.

---

## ✅ 1. whatsapp-account.controller.ts - **MIGRADO**

**Status:** ✅ COMPLETO

**Mudanças aplicadas:**
```typescript
// Import mudado
import { tenantQuery } from '../database/tenant-query';

// Linha 108 - Query migrada
const statsResult = await tenantQuery(req, `SELECT ...`, [account.id, today]);
```

---

## 2. bulk-profile.controller.ts

**Complexidade:** ⭐ Muito Fácil  
**Queries:** 2

**Mudanças necessárias:**
1. **Import (linha ~4):**
```typescript
// ANTES
import { query } from '../database/connection';
// DEPOIS
import { tenantQuery } from '../database/tenant-query';
```

2. **Substituir todas as 2 queries:**
```typescript
// ANTES
await query(sql, params)
// DEPOIS
await tenantQuery(req, sql, params)
```

---

## 3. template.controller.ts

**Complexidade:** ⭐⭐ Fácil  
**Queries:** 7  
**INSERTs:** 2

**Mudanças necessárias:**
1. **Import:**
```typescript
import { tenantQuery } from '../database/tenant-query';
```

2. **Todas as queries (7x):**
```typescript
await tenantQuery(req, sql, params)
```

3. **INSERTs (adicionar tenant_id):**
```typescript
// ANTES
INSERT INTO templates (name, content) VALUES ($1, $2)
// DEPOIS
INSERT INTO templates (name, content, tenant_id) VALUES ($1, $2, $3)
// Adicionar: req.tenant.id nos params
```

---

## 4. whatsapp-catalog.controller.ts

**Complexidade:** ⭐⭐ Fácil  
**Queries:** 7  
**UPDATEs:** 4

**Mudanças necessárias:**
1. **Import:**
```typescript
import { tenantQuery } from '../database/tenant-query';
```

2. **Todas as queries (7x):**
```typescript
await tenantQuery(req, sql, params)
```

3. **UPDATEs estão OK** (RLS garante isolamento)

---

## 5. analytics.controller.ts

**Complexidade:** ⭐⭐ Fácil  
**Queries:** 8

**Mudanças necessárias:**
1. **Import:**
```typescript
import { tenantQuery } from '../database/tenant-query';
```

2. **Todas as queries (8x):**
```typescript
await tenantQuery(req, sql, params)
```

---

## 6. proxy.controller.ts

**Complexidade:** ⭐⭐ Médio  
**Queries:** 9  
**INSERTs:** 1  
**UPDATEs:** 4

**Mudanças necessárias:**
1. **Import:**
```typescript
import { tenantQuery } from '../database/tenant-query';
```

2. **Todas as queries (9x):**
```typescript
await tenantQuery(req, sql, params)
```

3. **INSERT (adicionar tenant_id):**
```typescript
// Adicionar tenant_id e req.tenant.id nos params
INSERT INTO proxies (..., tenant_id) VALUES (..., $N)
```

---

## 7. qr-webhook.controller.ts

**Complexidade:** ⭐⭐ Médio  
**Queries:** 9  
**INSERTs:** 1  
**UPDATEs:** 6

**Mudanças necessárias:**
1. **Import:**
```typescript
import { tenantQuery } from '../database/tenant-query';
```

2. **Todas as queries (9x):**
```typescript
await tenantQuery(req, sql, params)
```

3. **INSERT (adicionar tenant_id):**
```typescript
INSERT INTO webhook_logs (..., tenant_id) VALUES (..., $N)
```

---

## 8. whatsapp-settings.controller.ts

**Complexidade:** ⭐⭐ Médio  
**Queries:** 11  
**UPDATEs:** 1

**Mudanças necessárias:**
1. **Import:**
```typescript
import { tenantQuery } from '../database/tenant-query';
```

2. **Todas as queries (11x):**
```typescript
await tenantQuery(req, sql, params)
```

---

## 9. proxy-manager.controller.ts

**Complexidade:** ⭐⭐⭐ Médio  
**Queries:** 14  
**INSERTs:** 1  
**UPDATEs:** 3

**Mudanças necessárias:**
1. **Import:**
```typescript
import { tenantQuery } from '../database/tenant-query';
```

2. **Todas as queries (14x):**
```typescript
await tenantQuery(req, sql, params)
```

3. **INSERT (adicionar tenant_id):**
```typescript
INSERT INTO proxy_configs (..., tenant_id) VALUES (..., $N)
```

---

## 10. qr-campaign.controller.ts

**Complexidade:** ⭐⭐⭐ Difícil  
**Queries:** 33  
**INSERTs:** 2  
**UPDATEs:** 4

**Mudanças necessárias:**
1. **Import:**
```typescript
import { tenantQuery, tenantTransaction } from '../database/tenant-query';
```

2. **Todas as queries (33x):**
```typescript
await tenantQuery(req, sql, params)
```

3. **INSERTs (adicionar tenant_id):**
```typescript
// Nos 2 INSERTs, adicionar tenant_id e req.tenant.id
INSERT INTO qr_campaigns (..., tenant_id) VALUES (..., $N)
INSERT INTO qr_campaign_templates (..., tenant_id) VALUES (..., $N)
```

4. **Transações (se houver):**
```typescript
await tenantTransaction(req, async (client) => {
  await client.query(...);
  await client.query(...);
});
```

---

## 11. webhook.controller.ts

**Complexidade:** ⭐⭐⭐⭐ Difícil  
**Queries:** 35  
**INSERTs:** 7  
**UPDATEs:** 11

**⚠️ ATENÇÃO ESPECIAL:** Este é um webhook (pode não ter autenticação)

**Mudanças necessárias:**
1. **Import:**
```typescript
import { tenantQuery, queryNoTenant } from '../database/tenant-query';
```

2. **Para rotas AUTENTICADAS:**
```typescript
await tenantQuery(req, sql, params)
```

3. **Para rotas PÚBLICAS (webhook do WhatsApp):**
```typescript
await queryNoTenant(sql, params)
```

4. **INSERTs (adicionar tenant_id onde aplicável):**
```typescript
// Se tem req.tenant:
INSERT INTO webhook_logs (..., tenant_id) VALUES (..., $N)

// Se é webhook público, buscar tenant_id primeiro:
const accountResult = await queryNoTenant(
  'SELECT tenant_id FROM whatsapp_accounts WHERE id = $1',
  [accountId]
);
const tenantId = accountResult.rows[0].tenant_id;
```

---

## 12. campaign.controller.ts

**Complexidade:** ⭐⭐⭐⭐ Muito Difícil  
**Queries:** 44  
**INSERTs:** 3  
**UPDATEs:** 4

**Mudanças necessárias:**
1. **Import:**
```typescript
import { tenantQuery, tenantTransaction, addTenantId } from '../database/tenant-query';
```

2. **Todas as queries (44x):**
```typescript
await tenantQuery(req, sql, params)
```

3. **INSERTs (adicionar tenant_id):**
```typescript
// Nos 3 INSERTs principais:
INSERT INTO campaigns (..., tenant_id) VALUES (..., $N)
INSERT INTO campaign_contacts (..., tenant_id) VALUES (..., $N)
INSERT INTO campaign_templates (..., tenant_id) VALUES (..., $N)
```

4. **Transações complexas:**
```typescript
await tenantTransaction(req, async (client) => {
  // Criar campanha
  const campaign = await client.query(
    'INSERT INTO campaigns (..., tenant_id) VALUES (..., $N) RETURNING *',
    [..., req.tenant.id]
  );
  
  // Criar contatos
  for (const contact of contacts) {
    await client.query(
      'INSERT INTO campaign_contacts (..., tenant_id) VALUES (..., $N)',
      [..., req.tenant.id]
    );
  }
});
```

5. **Models usados:**
```typescript
// CampaignModel, ContactModel, MessageModel
// Precisarão receber req ou req.tenant.id
```

---

## 13. restriction-list.controller.ts

**Complexidade:** ⭐⭐⭐⭐ Muito Difícil  
**Queries:** 44  
**INSERTs:** 6  
**UPDATEs:** 5

**Mudanças necessárias:**
1. **Import:**
```typescript
import { tenantQuery, tenantTransaction } from '../database/tenant-query';
```

2. **Todas as queries (44x):**
```typescript
await tenantQuery(req, sql, params)
```

3. **INSERTs (adicionar tenant_id):**
```typescript
// Nos 6 INSERTs:
INSERT INTO lista_restricao (..., tenant_id) VALUES (..., $N)
```

4. **UPDATEs estão OK** (RLS garante isolamento)

---

## 🔧 PADRÃO GERAL PARA TODOS

### **Find & Replace Automático:**

1. **Import:**
```
Buscar: import { query } from '../database/connection';
Substituir: import { tenantQuery } from '../database/tenant-query';
```

2. **Queries:**
```
Buscar: await query\(
Substituir: await tenantQuery(req, 
```

3. **Transações (se houver BEGIN/COMMIT):**
```typescript
// ANTES
await query('BEGIN');
try {
  await query('INSERT...');
  await query('UPDATE...');
  await query('COMMIT');
} catch (e) {
  await query('ROLLBACK');
}

// DEPOIS
await tenantTransaction(req, async (client) => {
  await client.query('INSERT...');
  await client.query('UPDATE...');
  // Commit automático
});
```

4. **INSERT com tenant_id:**
```
Padrão: sempre adicionar tenant_id ao final das colunas
Valor: req.tenant.id ao final dos params
```

---

## ✅ CHECKLIST APÓS MIGRAR CADA UM

- [ ] Import mudado
- [ ] Todas as queries com `req` adicionado
- [ ] INSERTs com `tenant_id`
- [ ] Transações usando `tenantTransaction`
- [ ] Teste: Login com 2 tenants diferentes
- [ ] Verificar isolamento

---

## 🚀 AUTOMAÇÃO COM SCRIPT

Você pode usar este comando para fazer parte das mudanças automaticamente:

```bash
# No diretório backend/src/controllers/
# 1. Backup primeiro
cp arquivo.ts arquivo.ts.backup

# 2. Mudar import
sed -i "s/import { query } from '..\/database\/connection'/import { tenantQuery } from '..\/database\/tenant-query'/g" arquivo.ts

# 3. Adicionar req nas queries (CUIDADO: revise manualmente!)
sed -i "s/await query(/await tenantQuery(req, /g" arquivo.ts
```

**⚠️ IMPORTANTE:** Sempre revise manualmente após automação!

---

**Pronto para começar?** Siga controller por controller nesta ordem! 🚀





