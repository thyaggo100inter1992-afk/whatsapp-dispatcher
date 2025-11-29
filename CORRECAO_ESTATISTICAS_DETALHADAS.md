# 🔧 CORREÇÃO: ESTATÍSTICAS DETALHADAS DO TENANT

## 📋 Problemas Reportados

O usuário solicitou as seguintes correções nas estatísticas dos tenants:

### 1. **Usuários**
- ❌ "Você colocou dois ativos e um admin. Por que dois ativos, sendo que só tem um admin?"
- ✅ **Solução**: Adicionado campo "Inativos" para mostrar usuários desativados

### 2. **WhatsApp API Oficial**
- ❌ "Você colocou três ativas. Eu quero que coloque também a observação se tiver alguma desativada ou desconectada"
- ✅ **Solução**: Adicionado campo "Inativas" para mostrar contas desativadas

### 3. **WhatsApp QR Connect**
- ❌ "Tem quatro conectadas, que era a mesma informação. WhatsApp não conectado ou... Deslocou ou desativada"
- ✅ **Solução**: Adicionado campo "Desconectadas" para mostrar contas não conectadas

### 4. **Nova Vida e Lista de Restrição**
- ❌ "Na parte da nova vida, a parte de... de lista de restrição também tem que ser atualizada"
- ✅ **Solução**: Atualizadas para usar a estrutura correta de dados do backend

---

## ✅ Correções Aplicadas

### Backend: `backend/src/controllers/admin/tenants.controller.js`

#### 1. **Query SQL Atualizada**

**ANTES:**
```sql
-- USUÁRIOS
(SELECT COUNT(*) FROM tenant_users WHERE tenant_id = $1) as total_usuarios,
(SELECT COUNT(*) FROM tenant_users WHERE tenant_id = $1 AND ativo = true) as usuarios_ativos,
(SELECT COUNT(*) FROM tenant_users WHERE tenant_id = $1 AND role = 'admin') as usuarios_admins,

-- CONTAS WHATSAPP API
(SELECT COUNT(*) FROM whatsapp_accounts WHERE tenant_id = $1) as total_contas_api,
(SELECT COUNT(*) FROM whatsapp_accounts WHERE tenant_id = $1 AND is_active = true) as contas_api_ativas,

-- CONTAS WHATSAPP QR
(SELECT COUNT(*) FROM uaz_instances WHERE tenant_id = $1) as total_contas_qr,
(SELECT COUNT(*) FROM uaz_instances WHERE tenant_id = $1 AND status = 'connected') as contas_qr_conectadas,
```

**DEPOIS:**
```sql
-- USUÁRIOS
(SELECT COUNT(*) FROM tenant_users WHERE tenant_id = $1) as total_usuarios,
(SELECT COUNT(*) FROM tenant_users WHERE tenant_id = $1 AND ativo = true) as usuarios_ativos,
(SELECT COUNT(*) FROM tenant_users WHERE tenant_id = $1 AND ativo = false) as usuarios_inativos, -- NOVO
(SELECT COUNT(*) FROM tenant_users WHERE tenant_id = $1 AND role = 'admin') as usuarios_admins,

-- CONTAS WHATSAPP API
(SELECT COUNT(*) FROM whatsapp_accounts WHERE tenant_id = $1) as total_contas_api,
(SELECT COUNT(*) FROM whatsapp_accounts WHERE tenant_id = $1 AND is_active = true) as contas_api_ativas,
(SELECT COUNT(*) FROM whatsapp_accounts WHERE tenant_id = $1 AND is_active = false) as contas_api_inativas, -- NOVO

-- CONTAS WHATSAPP QR
(SELECT COUNT(*) FROM uaz_instances WHERE tenant_id = $1) as total_contas_qr,
(SELECT COUNT(*) FROM uaz_instances WHERE tenant_id = $1 AND status = 'connected') as contas_qr_conectadas,
(SELECT COUNT(*) FROM uaz_instances WHERE tenant_id = $1 AND status != 'connected') as contas_qr_desconectadas, -- NOVO
```

#### 2. **Resposta JSON Atualizada**

**ANTES:**
```javascript
usuarios: {
  total: parseInt(stats.total_usuarios),
  ativos: parseInt(stats.usuarios_ativos),
  inativos: parseInt(stats.total_usuarios) - parseInt(stats.usuarios_ativos), // Calculado
  admins: parseInt(stats.usuarios_admins),
  usuarios_normais: parseInt(stats.total_usuarios) - parseInt(stats.usuarios_admins)
},
```

**DEPOIS:**
```javascript
usuarios: {
  total: parseInt(stats.total_usuarios),
  ativos: parseInt(stats.usuarios_ativos),
  inativos: parseInt(stats.usuarios_inativos || 0), // Direto da query
  admins: parseInt(stats.usuarios_admins),
  usuarios_normais: parseInt(stats.total_usuarios) - parseInt(stats.usuarios_admins)
},
```

---

### Frontend: `frontend/src/pages/admin/tenants/[id].tsx`

#### 1. **Resumo Rápido (Cards no Topo)**

**ANTES:**
```tsx
<p className="text-4xl font-black text-white">{stats?.total_usuarios || 0}</p>
```

**DEPOIS:**
```tsx
<p className="text-4xl font-black text-white">{stats?.usuarios?.total || 0}</p>
<p className="text-xs text-gray-400 mt-1">Ativos: {stats?.usuarios?.ativos || 0} | Inativos: {stats?.usuarios?.inativos || 0}</p>
```

**Card de Contas WhatsApp - ANTES:**
```tsx
<p className="text-xs text-gray-400 mt-1">API: {stats?.total_contas_api || 0} | QR: {stats?.total_contas_qr || 0}</p>
```

**Card de Contas WhatsApp - DEPOIS:**
```tsx
<p className="text-xs text-gray-400 mt-1">
  API: {stats?.contas?.api?.total || 0} ({stats?.contas?.api?.ativas || 0} ✓) | 
  QR: {stats?.contas?.qr?.total || 0} ({stats?.contas?.qr?.conectadas || 0} ✓)
</p>
```

#### 2. **Seção Usuários**

**ANTES:**
```tsx
<div className="grid grid-cols-2 gap-2 text-sm">
  <div><span>Total:</span><span>{stats.total_usuarios || 0}</span></div>
  <div><span>Ativos:</span><span>{stats.usuarios_ativos || 0}</span></div>
  <div><span>Admins:</span><span>{stats.usuarios_admins || 0}</span></div>
</div>
```

**DEPOIS:**
```tsx
<div className="grid grid-cols-2 gap-2 text-sm">
  <div><span>Total:</span><span>{stats.usuarios?.total || 0}</span></div>
  <div><span>Ativos:</span><span className="text-green-300">{stats.usuarios?.ativos || 0}</span></div>
  <div><span>Inativos:</span><span className="text-red-300">{stats.usuarios?.inativos || 0}</span></div>
  <div><span>Admins:</span><span>{stats.usuarios?.admins || 0}</span></div>
</div>
```

#### 3. **Seção WhatsApp API**

**ANTES:**
```tsx
<div className="grid grid-cols-2 gap-2 text-sm">
  <div><span>Total:</span><span>{stats.total_contas_api || 0}</span></div>
  <div><span>Ativas:</span><span>{stats.contas_api_ativas || 0}</span></div>
</div>
```

**DEPOIS:**
```tsx
<div className="grid grid-cols-2 gap-2 text-sm">
  <div><span>Total:</span><span>{stats.contas?.api?.total || 0}</span></div>
  <div><span>Ativas:</span><span className="text-green-300">{stats.contas?.api?.ativas || 0}</span></div>
  <div><span>Inativas:</span><span className="text-red-300">{stats.contas?.api?.inativas || 0}</span></div>
</div>
```

#### 4. **Seção WhatsApp QR Connect**

**ANTES:**
```tsx
<div className="grid grid-cols-2 gap-2 text-sm">
  <div><span>Total:</span><span>{stats.total_contas_qr || 0}</span></div>
  <div><span>Conectadas:</span><span>{stats.contas_qr_conectadas || 0}</span></div>
</div>
```

**DEPOIS:**
```tsx
<div className="grid grid-cols-2 gap-2 text-sm">
  <div><span>Total:</span><span>{stats.contas?.qr?.total || 0}</span></div>
  <div><span>Conectadas:</span><span className="text-green-300">{stats.contas?.qr?.conectadas || 0}</span></div>
  <div><span>Desconectadas:</span><span className="text-red-300">{stats.contas?.qr?.desconectadas || 0}</span></div>
</div>
```

#### 5. **Seção Nova Vida**

**ANTES:**
```tsx
<div><span>Total:</span><span>{stats.total_novavida || 0}</span></div>
<div><span>Este Mês:</span><span>{stats.novavida_mes || 0}</span></div>
```

**DEPOIS:**
```tsx
<div><span>Total:</span><span>{stats.nova_vida?.total_consultas || 0}</span></div>
<div><span>Este Mês:</span><span>{stats.nova_vida?.consultas_este_mes || 0}</span></div>
```

#### 6. **Seção Lista de Restrição**

**ANTES:**
```tsx
<div><span>Bloqueados:</span><span>{stats.total_restricoes || 0}</span></div>
```

**DEPOIS:**
```tsx
<div><span>Números Bloqueados:</span><span>{stats.lista_restricao?.total_bloqueados || 0}</span></div>
```

---

## 🎨 Melhorias Visuais

### Cores Indicativas

- ✅ **Verde** (`text-green-300`): Valores positivos (ativos, conectadas, ativas)
- ❌ **Vermelho** (`text-red-300`): Valores negativos (inativos, desconectadas, inativas)
- ⚪ **Branco** (`text-white`): Valores neutros (total)
- 🟣 **Roxo** (`text-purple-300`): Admins/especiais

### Símbolos Visuais

- ✓ (checkmark): Indica quantidade ativa/conectada nos cards de resumo
- Cores diferenciadas para fácil identificação

---

## 📊 Exemplo de Dados Retornados

```json
{
  "success": true,
  "data": {
    "usuarios": {
      "total": 2,
      "ativos": 1,
      "inativos": 1,
      "admins": 1,
      "usuarios_normais": 1
    },
    "contas": {
      "api": {
        "total": 3,
        "ativas": 3,
        "inativas": 0
      },
      "qr": {
        "total": 4,
        "conectadas": 3,
        "desconectadas": 1
      },
      "total": 7
    },
    "nova_vida": {
      "total_consultas": 150,
      "consultas_este_mes": 25
    },
    "lista_restricao": {
      "total_bloqueados": 10
    }
  }
}
```

---

## 🚀 Como Testar

### 1. **Reiniciar o Backend**
```bash
# No terminal do backend:
Ctrl+C
npm run dev
```

### 2. **Recarregar o Frontend**
```
F5 no navegador
```

### 3. **Verificar as Estatísticas**

1. Acesse: `http://localhost:3000/admin/tenants`
2. Clique em "Editar" em qualquer tenant
3. Role até a seção "Estatísticas Completas"
4. Clique em "Atualizar" para carregar os dados

### 4. **Verificar Dados Exibidos**

#### Usuários:
- ✅ Total: 2
- ✅ Ativos: 1 (verde)
- ✅ Inativos: 1 (vermelho)
- ✅ Admins: 1

#### WhatsApp API:
- ✅ Total: 3
- ✅ Ativas: 3 (verde)
- ✅ Inativas: 0 (vermelho)

#### WhatsApp QR:
- ✅ Total: 4
- ✅ Conectadas: 3 (verde)
- ✅ Desconectadas: 1 (vermelho)

---

## 📝 Arquivos Modificados

1. **Backend**:
   - `backend/src/controllers/admin/tenants.controller.js`
     - Query SQL expandida (3 novos campos)
     - Resposta JSON atualizada

2. **Frontend**:
   - `frontend/src/pages/admin/tenants/[id].tsx`
     - Cards de resumo atualizados
     - 6 seções de estatísticas atualizadas
     - Cores indicativas adicionadas

---

## ✅ Status

- ✅ Backend: Query SQL atualizada
- ✅ Backend: Resposta JSON corrigida
- ✅ Frontend: Cards de resumo atualizados
- ✅ Frontend: Estatísticas detalhadas atualizadas
- ✅ Frontend: Cores indicativas adicionadas
- ⏳ **Aguardando**: Reinício do backend
- ⏳ **Aguardando**: Teste pelo usuário

---

## 🎯 Resultado Final

Agora as estatísticas mostram:

| Seção | Antes | Depois |
|-------|-------|--------|
| Usuários | Total, Ativos, Admins | Total, Ativos, **Inativos**, Admins |
| WhatsApp API | Total, Ativas | Total, Ativas, **Inativas** |
| WhatsApp QR | Total, Conectadas | Total, Conectadas, **Desconectadas** |
| Nova Vida | ✅ Atualizado | ✅ Estrutura correta |
| Lista Restrição | ✅ Atualizado | ✅ Estrutura correta |

**Todas as informações solicitadas agora estão visíveis e coloridas para fácil identificação!** 🎉



