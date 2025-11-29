# ⚡ MIGRAÇÃO RÁPIDA: 3 Passos Simples

## 🎯 O QUE MUDAR EM CADA CONTROLLER

### **PASSO 1: Mudar o Import** 📦

**ANTES:**
```typescript
import { query } from '../database/connection';
```

**DEPOIS:**
```typescript
import { tenantQuery } from '../database/tenant-query';
```

---

### **PASSO 2: Substituir query() por tenantQuery()** 🔄

**ANTES:**
```typescript
const result = await query(
  'SELECT * FROM campaigns WHERE id = $1',
  [id]
);
```

**DEPOIS:**
```typescript
const result = await tenantQuery(
  req,  // ← ADICIONAR req como primeiro parâmetro
  'SELECT * FROM campaigns WHERE id = $1',
  [id]
);
```

---

### **PASSO 3: Adicionar tenant_id em INSERT** ➕

**ANTES:**
```typescript
await query(
  'INSERT INTO campaigns (name, status) VALUES ($1, $2)',
  [name, status]
);
```

**DEPOIS:**
```typescript
await tenantQuery(
  req,
  'INSERT INTO campaigns (name, status, tenant_id) VALUES ($1, $2, $3)',
  [name, status, req.tenant.id]  // ← ADICIONAR req.tenant.id
);
```

---

## 📋 EXEMPLO COMPLETO: Campaign Create

### ANTES (sem multi-tenant):
```typescript
async create(req: Request, res: Response) {
  try {
    const { name, templates, contacts } = req.body;

    // Criar campanha
    const campaign = await query(
      `INSERT INTO campaigns (name, status, total_contacts)
       VALUES ($1, $2, $3) RETURNING *`,
      [name, 'pending', contacts.length]
    );

    // Criar contatos
    for (const contact of contacts) {
      await query(
        'INSERT INTO campaign_contacts (campaign_id, contact_id) VALUES ($1, $2)',
        [campaign.rows[0].id, contact.id]
      );
    }

    res.json({ success: true, campaign: campaign.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}
```

### DEPOIS (com multi-tenant):
```typescript
async create(req: Request, res: Response) {
  try {
    const { name, templates, contacts } = req.body;

    // Criar campanha (tenant_id adicionado automaticamente)
    const campaign = await tenantQuery(
      req,  // ← ADICIONAR req
      `INSERT INTO campaigns (name, status, total_contacts, tenant_id)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, 'pending', contacts.length, req.tenant.id]  // ← ADICIONAR req.tenant.id
    );

    // Criar contatos (RLS garante isolamento)
    for (const contact of contacts) {
      await tenantQuery(
        req,  // ← ADICIONAR req
        'INSERT INTO campaign_contacts (campaign_id, contact_id, tenant_id) VALUES ($1, $2, $3)',
        [campaign.rows[0].id, contact.id, req.tenant.id]  // ← ADICIONAR req.tenant.id
      );
    }

    res.json({ success: true, campaign: campaign.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}
```

---

## 🔧 CASOS ESPECIAIS

### **Tabelas de Junção (Many-to-Many)**

**ANTES:**
```typescript
await query(
  'INSERT INTO campaign_templates (campaign_id, template_id) VALUES ($1, $2)',
  [campaignId, templateId]
);
```

**DEPOIS:**
```typescript
await tenantQuery(
  req,
  'INSERT INTO campaign_templates (campaign_id, template_id, tenant_id) VALUES ($1, $2, $3)',
  [campaignId, templateId, req.tenant.id]
);
```

### **Queries com JOIN**

**RLS funciona automaticamente!** Só precisa passar `req`:

```typescript
// RLS filtra automaticamente ambas as tabelas
const result = await tenantQuery(
  req,
  `SELECT c.*, t.template_name 
   FROM campaigns c
   JOIN templates t ON t.id = c.template_id`
);
// Retorna apenas dados do tenant atual!
```

### **Transações**

**ANTES:**
```typescript
await query('BEGIN');
try {
  await query('INSERT INTO campaigns ...');
  await query('INSERT INTO campaign_contacts ...');
  await query('COMMIT');
} catch (error) {
  await query('ROLLBACK');
  throw error;
}
```

**DEPOIS:**
```typescript
import { tenantTransaction } from '../database/tenant-query';

await tenantTransaction(req, async (client) => {
  await client.query('INSERT INTO campaigns ...');
  await client.query('INSERT INTO campaign_contacts ...');
  // Commit automático se não houver erro
});
```

---

## ✅ CHECKLIST POR CONTROLLER

Para cada controller, faça:

- [ ] **Import:** `query` → `tenantQuery`
- [ ] **Todas as queries:** Adicionar `req` como primeiro parâmetro
- [ ] **INSERT/UPDATE:** Adicionar `tenant_id: req.tenant.id`
- [ ] **Testar:** Criar 2 tenants e verificar isolamento

---

## 🚀 ORDEM RECOMENDADA DE MIGRAÇÃO

Migre nesta ordem (do mais simples ao mais complexo):

1. ✅ **template.controller.ts** - Mais simples
2. ✅ **whatsapp-account.controller.ts** - Contas
3. ✅ **message.controller.ts** - Mensagens
4. ✅ **campaign.controller.ts** - Campanhas (mais complexo)
5. ✅ **qr-campaign.controller.ts** - Campanhas QR

---

## 💡 DICA: Find & Replace

Use o Find & Replace do VSCode:

1. **Buscar:** `import { query } from '../database/connection';`
   **Substituir:** `import { tenantQuery } from '../database/tenant-query';`

2. **Buscar:** `await query\(`
   **Substituir:** `await tenantQuery(req, `

3. Depois ajuste manualmente os `tenant_id` nos INSERT/UPDATE

---

## ⚠️ IMPORTANTE: Rotas Públicas

Se a rota NÃO precisa de autenticação (ex: webhook), use:

```typescript
import { queryNoTenant } from '../database/tenant-query';

// Sem autenticação, sem tenant
const result = await queryNoTenant(
  'SELECT * FROM public_data WHERE id = $1',
  [id]
);
```

---

## 🧪 TESTAR ISOLAMENTO

Após migrar cada controller:

```bash
# 1. Login Tenant 1
POST /api/auth/login
{ "email": "admin@empresa1.com", "password": "senha" }

# 2. Criar campanha Tenant 1
POST /api/campaigns
Header: Authorization: Bearer TOKEN1
{ "name": "Campanha Tenant 1" }

# 3. Login Tenant 2
POST /api/auth/login
{ "email": "admin@empresa2.com", "password": "senha" }

# 4. Listar campanhas Tenant 2
GET /api/campaigns
Header: Authorization: Bearer TOKEN2

# ✅ Não deve ver a campanha do Tenant 1!
```

---

## 📞 PRÓXIMO PASSO

Agora vou migrar os controllers principais. Quer que eu:

1. **Migre todos automaticamente** - Faço todos de uma vez
2. **Migre um por um** - Vou explicando cada um
3. **Você migra manualmente** - Sigo este guia

**O que prefere?** 🚀





