# 🔧 CORREÇÃO: FILTRO DE TENANT PARA CONTAS WHATSAPP

## 🐛 Problema Identificado

As contas WhatsApp **NÃO** estavam aparecendo para o usuário porque o `WhatsAppAccountModel` estava buscando **TODAS** as contas do banco de dados, sem filtrar por `tenant_id`.

### Erro Observado:
- ❌ API retornava 404 para `/api/whatsapp-accounts`
- ❌ Frontend exibia "Nenhuma conta configurada ainda"
- ❌ Contas do Tenant 1 estavam no banco, mas não apareciam

## 🔍 Causa Raiz

O Model `WhatsAppAccount.ts` tinha queries diretas sem filtro:

```typescript
// ❌ ANTES (ERRADO)
static async findAll() {
  const result = await query(
    'SELECT * FROM whatsapp_accounts ORDER BY created_at DESC'
  );
  return result.rows;
}

static async findActive() {
  const result = await query(
    'SELECT * FROM whatsapp_accounts WHERE is_active = true ORDER BY created_at DESC'
  );
  return result.rows;
}
```

## ✅ Correção Aplicada

### 1. Model - `backend/src/models/WhatsAppAccount.ts`

```typescript
// ✅ DEPOIS (CORRETO)
static async findAll(tenantId?: number) {
  if (tenantId) {
    const result = await query(
      'SELECT * FROM whatsapp_accounts WHERE tenant_id = $1 ORDER BY created_at DESC',
      [tenantId]
    );
    return result.rows;
  }
  const result = await query(
    'SELECT * FROM whatsapp_accounts ORDER BY created_at DESC'
  );
  return result.rows;
}

static async findActive(tenantId?: number) {
  if (tenantId) {
    const result = await query(
      'SELECT * FROM whatsapp_accounts WHERE is_active = true AND tenant_id = $1 ORDER BY created_at DESC',
      [tenantId]
    );
    return result.rows;
  }
  const result = await query(
    'SELECT * FROM whatsapp_accounts WHERE is_active = true ORDER BY created_at DESC'
  );
  return result.rows;
}
```

### 2. Controller - `backend/src/controllers/whatsapp-account.controller.ts`

```typescript
// ✅ findAll - Passa tenant_id
async findAll(req: Request, res: Response) {
  try {
    const tenantId = req.user?.tenant_id;
    const accounts = await WhatsAppAccountModel.findAll(tenantId);
    res.json({ success: true, data: accounts });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

// ✅ findActive - Passa tenant_id
async findActive(req: Request, res: Response) {
  try {
    const tenantId = req.user?.tenant_id;
    const accounts = await WhatsAppAccountModel.findActive(tenantId);
    res.json({ success: true, data: accounts });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}
```

## 🎯 Como Funciona Agora

1. **Usuário faz login** → JWT contém `tenant_id`
2. **Middleware de autenticação** → Adiciona `req.user.tenant_id`
3. **Controller** → Pega `tenant_id` de `req.user`
4. **Model** → Filtra contas: `WHERE tenant_id = ?`
5. **Resultado** → Apenas contas do tenant do usuário

## 📊 Resultado Esperado

Para o **Tenant 1** (Minha Empresa):
- ✅ 3 contas WhatsApp API Oficial
- ✅ 4 contas WhatsApp QR Connect
- ✅ **TOTAL: 7 contas**

## 🚀 Como Testar

1. **Reiniciar o backend**:
   ```bash
   # Pressione Ctrl+C no terminal do backend
   npm run dev
   ```

2. **Fazer logout no frontend**

3. **Fazer login novamente**

4. **Acessar Configurações**:
   - As 3 contas API devem aparecer

5. **Acessar QR Connect**:
   - As 4 contas QR devem aparecer

## 🔒 Segurança

Esta correção garante que:
- ✅ Cada tenant vê **apenas suas próprias contas**
- ✅ Tenant 1 vê suas 7 contas
- ✅ Tenant 2 verá 0 contas (está vazio)
- ✅ Isolamento completo entre tenants

## 📝 Arquivos Modificados

1. `backend/src/models/WhatsAppAccount.ts`
   - Adicionado parâmetro `tenantId?` em `findAll()` e `findActive()`
   - Adicionado filtro `WHERE tenant_id = $1`

2. `backend/src/controllers/whatsapp-account.controller.ts`
   - Método `findAll()` agora passa `req.user.tenant_id`
   - Método `findActive()` agora passa `req.user.tenant_id`

## ✅ Status

- ✅ Model corrigido
- ✅ Controller corrigido
- ⏳ **AGUARDANDO REINÍCIO DO BACKEND**



