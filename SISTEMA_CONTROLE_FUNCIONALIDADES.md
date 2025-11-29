# 🔐 SISTEMA DE CONTROLE DE FUNCIONALIDADES/MENUS

## 📋 VISÃO GERAL

Sistema completo para controlar quais funcionalidades/menus cada tenant e plano pode acessar no sistema.

**Funcionalidades:**
- ✅ Controle por PLANO (padrão)
- ✅ Controle por TENANT (customizado, sobrescreve o plano)
- ✅ 12 funcionalidades disponíveis
- ✅ Flexível e escalável

---

## 🎯 FUNCIONALIDADES DISPONÍVEIS

| ID | Nome | Descrição |
|----|------|-----------|
| 1 | `whatsapp_api` | WhatsApp API Oficial (contas, campanhas, templates) |
| 2 | `whatsapp_qr` | WhatsApp QR Connect (UAZ, campanhas QR) |
| 3 | `campanhas` | Criar e gerenciar campanhas |
| 4 | `templates` | Criar e gerenciar templates de mensagem |
| 5 | `base_dados` | Importar e gerenciar base de contatos |
| 6 | `nova_vida` | Consultas ao sistema Nova Vida |
| 7 | `lista_restricao` | Gerenciar lista de restrição |
| 8 | `webhooks` | Configurar webhooks |
| 9 | `catalogo` | Gerenciar catálogo de produtos |
| 10 | `dashboard` | Acessar dashboard com estatísticas |
| 11 | `relatorios` | Gerar e baixar relatórios |
| 12 | `envio_imediato` | Enviar mensagens imediatas |

---

## 📊 ESTRUTURA DO BANCO DE DADOS

### Tabela `plans`

**Novas Colunas:**
```sql
funcionalidades JSONB DEFAULT '{
  "whatsapp_api": true,
  "whatsapp_qr": true,
  "campanhas": true,
  "templates": true,
  "base_dados": true,
  "nova_vida": true,
  "lista_restricao": true,
  "webhooks": true,
  "catalogo": true,
  "dashboard": true,
  "relatorios": true,
  "envio_imediato": true
}'::jsonb
```

**Funcionalidades por Plano (após migration):**

#### **Básico**
```json
{
  "whatsapp_api": true,
  "whatsapp_qr": true,
  "campanhas": true,
  "templates": true,
  "base_dados": true,
  "nova_vida": false,       // ❌
  "lista_restricao": true,
  "webhooks": false,         // ❌
  "catalogo": false,         // ❌
  "dashboard": true,
  "relatorios": false,       // ❌
  "envio_imediato": true
}
```

#### **Pro**
```json
{
  "whatsapp_api": true,
  "whatsapp_qr": true,
  "campanhas": true,
  "templates": true,
  "base_dados": true,
  "nova_vida": true,
  "lista_restricao": true,
  "webhooks": true,
  "catalogo": true,
  "dashboard": true,
  "relatorios": true,
  "envio_imediato": true
}
```

#### **Enterprise / Ilimitado**
```json
// Todas as funcionalidades = true
```

#### **Teste Grátis**
```json
{
  "whatsapp_api": true,
  "whatsapp_qr": true,
  "campanhas": true,
  "templates": true,
  "base_dados": true,
  "nova_vida": false,        // ❌
  "lista_restricao": false,  // ❌
  "webhooks": false,          // ❌
  "catalogo": false,          // ❌
  "dashboard": true,
  "relatorios": false,        // ❌
  "envio_imediato": false     // ❌
}
```

---

### Tabela `tenants`

**Novas Colunas:**
```sql
funcionalidades_customizadas BOOLEAN DEFAULT false
funcionalidades_config JSONB DEFAULT NULL
```

**Lógica:**
- Se `funcionalidades_customizadas = false` → Usa as funcionalidades do **plano**
- Se `funcionalidades_customizadas = true` → Usa `funcionalidades_config` (customizado)

**Exemplo de Tenant com Customização:**
```sql
UPDATE tenants SET 
  funcionalidades_customizadas = true,
  funcionalidades_config = '{
    "whatsapp_api": true,
    "whatsapp_qr": false,  -- ❌ Desabilitar WhatsApp QR para este tenant
    "campanhas": true,
    "templates": true,
    "base_dados": true,
    "nova_vida": true,
    "lista_restricao": true,
    "webhooks": true,
    "catalogo": true,
    "dashboard": true,
    "relatorios": true,
    "envio_imediato": true
  }'::jsonb
WHERE id = 1;
```

---

## 🔧 FUNÇÃO SQL AUXILIAR

```sql
CREATE FUNCTION get_tenant_funcionalidades(p_tenant_id INTEGER)
RETURNS JSONB
```

**Uso:**
```sql
-- Obter funcionalidades de um tenant específico
SELECT get_tenant_funcionalidades(1);

-- Listar funcionalidades de todos os tenants
SELECT 
  id, 
  nome, 
  get_tenant_funcionalidades(id) as funcionalidades
FROM tenants;
```

Esta função retorna automaticamente:
- `funcionalidades_config` se o tenant tem customizações
- `plans.funcionalidades` se o tenant usa o plano padrão

---

## 🔙 BACKEND - API

### **Tenants Controller**

#### `GET /api/admin/tenants`
Retorna todos os tenants com:
```json
{
  "id": 1,
  "nome": "Minha Empresa",
  "funcionalidades_customizadas": true,
  "funcionalidades_config": {...},
  "plano_funcionalidades": {...}
}
```

#### `GET /api/admin/tenants/:id`
Retorna um tenant com:
```json
{
  "id": 1,
  "nome": "Minha Empresa",
  "funcionalidades_customizadas": true,
  "funcionalidades_config": {...},
  "plano_funcionalidades": {...}
}
```

#### `PUT /api/admin/tenants/:id`
Atualiza tenant, aceita:
```json
{
  "funcionalidades_customizadas": true,
  "funcionalidades_config": {
    "whatsapp_api": true,
    "whatsapp_qr": false,
    ...
  }
}
```

**Lógica:**
- Se `funcionalidades_customizadas = false`, `funcionalidades_config` é setado para `null`
- Se `funcionalidades_customizadas = true`, `funcionalidades_config` é salvo

---

### **Plans Controller**

#### `GET /api/admin/plans`
Retorna todos os planos com:
```json
{
  "id": 1,
  "nome": "Básico",
  "funcionalidades": {...}
}
```

#### `PUT /api/admin/plans/:id`
Atualiza plano, aceita:
```json
{
  "funcionalidades": {
    "whatsapp_api": true,
    "whatsapp_qr": true,
    ...
  }
}
```

---

## 🎨 FRONTEND - PRÓXIMOS PASSOS

### **1. Modal de Edição de Tenant** (`frontend/src/pages/admin/tenants.tsx`)

Adicionar seção de funcionalidades:

```tsx
{/* Checkbox para customizar funcionalidades */}
<div className="bg-purple-500/10 border-2 border-purple-500/30 rounded-lg p-4">
  <label className="flex items-center gap-3 cursor-pointer">
    <input
      type="checkbox"
      checked={editForm.funcionalidades_customizadas}
      onChange={(e) => setEditForm({ 
        ...editForm, 
        funcionalidades_customizadas: e.target.checked 
      })}
    />
    <div>
      <span className="text-white font-bold">Customizar Funcionalidades</span>
      <p className="text-gray-400 text-sm">Se desmarcado, usa as funcionalidades do plano</p>
    </div>
  </label>
</div>

{/* Grid de funcionalidades (mostrar apenas se checkbox marcado) */}
{editForm.funcionalidades_customizadas && (
  <div className="grid grid-cols-2 gap-4">
    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={editForm.funcionalidades_config.whatsapp_api}
        onChange={(e) => setEditForm({
          ...editForm,
          funcionalidades_config: {
            ...editForm.funcionalidades_config,
            whatsapp_api: e.target.checked
          }
        })}
      />
      <span>WhatsApp API Oficial</span>
    </label>

    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={editForm.funcionalidades_config.whatsapp_qr}
        onChange={(e) => setEditForm({
          ...editForm,
          funcionalidades_config: {
            ...editForm.funcionalidades_config,
            whatsapp_qr: e.target.checked
          }
        })}
      />
      <span>WhatsApp QR Connect</span>
    </label>

    {/* Repetir para todas as 12 funcionalidades */}
  </div>
)}
```

---

### **2. Página de Planos** (`frontend/src/pages/admin/plans.tsx`)

Adicionar grid de funcionalidades no modal de edição:

```tsx
<div className="grid grid-cols-2 gap-4">
  <label className="flex items-center gap-2">
    <input
      type="checkbox"
      checked={editForm.funcionalidades.whatsapp_api}
      onChange={(e) => setEditForm({
        ...editForm,
        funcionalidades: {
          ...editForm.funcionalidades,
          whatsapp_api: e.target.checked
        }
      })}
    />
    <span>WhatsApp API Oficial</span>
  </label>

  {/* Repetir para todas as funcionalidades */}
</div>
```

---

### **3. Middleware/Guard de Permissões**

Criar arquivo `frontend/src/hooks/usePermissions.ts`:

```typescript
import { useAuth } from '@/contexts/AuthContext';

export function usePermissions() {
  const { user, tenant } = useAuth();

  // Função para verificar se tenant tem acesso a uma funcionalidade
  const hasPermission = (feature: string): boolean => {
    // Se for super admin, sempre tem acesso
    if (user?.role === 'super_admin') return true;

    // Pegar funcionalidades do tenant (customizadas ou do plano)
    const funcionalidades = tenant?.funcionalidades_customizadas
      ? tenant?.funcionalidades_config
      : tenant?.plano_funcionalidades;

    return funcionalidades?.[feature] === true;
  };

  return { hasPermission };
}
```

**Uso nos componentes:**

```tsx
import { usePermissions } from '@/hooks/usePermissions';

function Layout() {
  const { hasPermission } = usePermissions();

  return (
    <nav>
      {hasPermission('whatsapp_api') && (
        <Link href="/api-oficial">WhatsApp API</Link>
      )}

      {hasPermission('whatsapp_qr') && (
        <Link href="/qrconnect">WhatsApp QR</Link>
      )}

      {hasPermission('campanhas') && (
        <Link href="/campanhas">Campanhas</Link>
      )}

      {/* ... outros menus */}
    </nav>
  );
}
```

---

### **4. Atualizar AuthContext**

Adicionar funcionalidades no contexto de autenticação:

```typescript
interface TenantData {
  id: number;
  nome: string;
  funcionalidades_customizadas: boolean;
  funcionalidades_config: object | null;
  plano_funcionalidades: object;
}

interface AuthContextData {
  user: UserData | null;
  tenant: TenantData | null;
  // ... outros campos
}
```

---

## ✅ CHECKLIST DE IMPLEMENTAÇÃO

### Backend
- ✅ Criar tabela/colunas no banco de dados
- ✅ Atualizar planos existentes com funcionalidades
- ✅ Criar índices para performance
- ✅ Criar função SQL `get_tenant_funcionalidades()`
- ✅ Atualizar `tenants.controller.js`:
  - ✅ `getAllTenants` retorna funcionalidades
  - ✅ `getTenantById` retorna funcionalidades
  - ✅ `updateTenant` aceita funcionalidades
- ✅ Atualizar `plans.controller.js`:
  - ✅ `getAllPlans` retorna funcionalidades (já retorna p.*)
  - ✅ `updatePlan` aceita funcionalidades

### Frontend
- ⏳ Atualizar modal de edição de tenants
- ⏳ Adicionar checkboxes de funcionalidades
- ⏳ Atualizar modal de edição de planos
- ⏳ Criar hook `usePermissions`
- ⏳ Atualizar `AuthContext` para incluir funcionalidades
- ⏳ Aplicar guard nos menus/componentes

---

## 🚀 COMO TESTAR

### 1. Verificar Planos
```sql
SELECT id, nome, funcionalidades FROM plans;
```

### 2. Customizar Tenant
```sql
UPDATE tenants SET 
  funcionalidades_customizadas = true,
  funcionalidades_config = '{
    "whatsapp_api": true,
    "whatsapp_qr": false,
    "campanhas": true,
    "templates": true,
    "base_dados": true,
    "nova_vida": false,
    "lista_restricao": true,
    "webhooks": false,
    "catalogo": false,
    "dashboard": true,
    "relatorios": false,
    "envio_imediato": true
  }'::jsonb
WHERE id = 1;
```

### 3. Testar Função SQL
```sql
SELECT 
  id,
  nome,
  funcionalidades_customizadas,
  get_tenant_funcionalidades(id) as funcionalidades_efetivas
FROM tenants
WHERE id = 1;
```

### 4. Testar API
```bash
# Listar tenants
curl http://localhost:3001/api/admin/tenants \
  -H "Authorization: Bearer TOKEN"

# Atualizar tenant com funcionalidades
curl -X PUT http://localhost:3001/api/admin/tenants/1 \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "funcionalidades_customizadas": true,
    "funcionalidades_config": {
      "whatsapp_api": true,
      "whatsapp_qr": false,
      "campanhas": true
    }
  }'
```

---

## 📝 EXEMPLO COMPLETO

### Cenário: Tenant que só pode usar WhatsApp API

**1. Editar tenant via Super Admin:**
```json
{
  "funcionalidades_customizadas": true,
  "funcionalidades_config": {
    "whatsapp_api": true,       // ✅ PERMITIDO
    "whatsapp_qr": false,        // ❌ BLOQUEADO
    "campanhas": true,
    "templates": true,
    "base_dados": true,
    "nova_vida": false,
    "lista_restricao": true,
    "webhooks": false,
    "catalogo": false,
    "dashboard": true,
    "relatorios": false,
    "envio_imediato": true
  }
}
```

**2. No frontend, o menu do tenant mostrará:**
- ✅ WhatsApp API Oficial
- ❌ WhatsApp QR Connect (escondido)
- ✅ Campanhas
- ✅ Templates
- ✅ Base de Dados
- ❌ Nova Vida (escondido)
- ... etc

---

## 🎯 RESULTADO FINAL

✅ **Controle total** sobre o que cada tenant pode acessar  
✅ **Flexível**: Pode usar o plano padrão ou customizar  
✅ **Escalável**: Fácil adicionar novas funcionalidades  
✅ **Performance**: Índices JSONB para buscas rápidas  
✅ **Segurança**: Validação no backend + ocultação no frontend

---

**Data**: ${new Date().toLocaleString('pt-BR')}  
**Status Backend**: ✅ 100% COMPLETO  
**Status Frontend**: ⏳ AGUARDANDO IMPLEMENTAÇÃO



