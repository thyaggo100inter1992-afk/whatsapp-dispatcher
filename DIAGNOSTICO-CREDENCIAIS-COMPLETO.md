# 🔍 DIAGNÓSTICO COMPLETO: Sistema de Credenciais WhatsApp (UAZAP)

**Data:** 24/11/2024  
**Status:** Análise do Sistema de Credenciais

---

## 📋 RESUMO DO SISTEMA DE CREDENCIAIS

### Como o Sistema Funciona

O sistema possui **3 níveis** de organização de credenciais:

```
┌─────────────────────────────────────────────────┐
│  1. TABELA: uazap_credentials                   │
│     └─ Armazena TODAS as credenciais UAZAP     │
│     └─ Pode ter VÁRIAS credenciais cadastradas │
│     └─ UMA pode ser marcada como PADRÃO         │
└─────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────┐
│  2. TABELA: tenants                             │
│     └─ Campo: uazap_credential_id               │
│     └─ Aponta para QUAL credencial usar         │
│     └─ Quando tenant é criado, recebe           │
│        a credencial marcada como PADRÃO         │
└─────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────┐
│  3. TABELA: uaz_instances                       │
│     └─ Campo: credential_id                     │
│     └─ Cada instância LEMBRA qual credencial    │
│        foi usada para criá-la                   │
└─────────────────────────────────────────────────┘
```

---

## 🔑 HIERARQUIA DE BUSCA DE CREDENCIAIS

Quando o sistema precisa usar credenciais do WhatsApp, ele segue esta ordem:

### 1️⃣ PRIORIDADE MÁXIMA: Credencial da Instância
```javascript
// Arquivo: backend/src/helpers/instance-credentials.helper.js
// Se a instância tem credential_id, USA ELA!
if (instance.credential_id && instance.credential_url) {
  ✅ Usa a credencial específica da instância
  ✅ Garante que sempre use a conta correta
}
```

### 2️⃣ FALLBACK: Credencial do Tenant
```javascript
// Arquivo: backend/src/helpers/uaz-credentials.helper.js
// Se instância não tem credential_id, busca do tenant
const credentials = await getTenantUazapCredentials(tenantId);
```

### 3️⃣ ÚLTIMO RECURSO: Credencial Padrão
```sql
SELECT * FROM uazap_credentials 
WHERE is_default = true AND is_active = true 
LIMIT 1
```

---

## 🚨 PROBLEMA MAIS COMUM

### **Tenant Não Reconhece Qual Credencial Foi Criado**

**Sintomas:**
- ❌ Tenant cria instâncias, mas depois não consegue usar
- ❌ Erro "Invalid token"
- ❌ Sistema procura na credencial errada

**Causa Raiz:**
Existem 2 causas possíveis:

#### CAUSA 1: Tenant sem `uazap_credential_id`
```sql
-- Verificar
SELECT id, nome, uazap_credential_id 
FROM tenants;

-- Se uazap_credential_id for NULL:
-- ❌ Tenant não tem credencial vinculada!
```

#### CAUSA 2: Instâncias sem `credential_id`
```sql
-- Verificar
SELECT id, name, credential_id, tenant_id 
FROM uaz_instances;

-- Se credential_id for NULL:
-- ❌ Instância não sabe qual credencial foi usada!
```

---

## ✅ COMO CORRIGIR

### SOLUÇÃO 1: Verificar e Vincular Credencial ao Tenant

1. **Verificar credenciais cadastradas:**
```sql
SELECT id, name, is_default, is_active 
FROM uazap_credentials 
ORDER BY is_default DESC;
```

2. **Verificar qual credencial o tenant tem:**
```sql
SELECT 
  t.id,
  t.nome,
  t.uazap_credential_id,
  uc.name as credencial_nome
FROM tenants t
LEFT JOIN uazap_credentials uc ON t.uazap_credential_id = uc.id;
```

3. **Se tenant estiver sem credencial (NULL), vincular:**
```sql
-- Opção A: Vincular à credencial padrão
UPDATE tenants 
SET uazap_credential_id = (
  SELECT id FROM uazap_credentials 
  WHERE is_default = true 
  LIMIT 1
)
WHERE uazap_credential_id IS NULL;

-- Opção B: Vincular a uma credencial específica (ex: ID 1)
UPDATE tenants 
SET uazap_credential_id = 1 
WHERE id = <ID_DO_TENANT>;
```

### SOLUÇÃO 2: Corrigir Instâncias Sem credential_id

1. **Verificar instâncias sem credential_id:**
```sql
SELECT 
  ui.id,
  ui.name,
  ui.session_name,
  ui.tenant_id,
  ui.credential_id,
  t.nome as tenant_nome,
  t.uazap_credential_id
FROM uaz_instances ui
JOIN tenants t ON ui.tenant_id = t.id
WHERE ui.credential_id IS NULL;
```

2. **Corrigir automaticamente (via código):**
```javascript
// Já existe função no sistema!
// Arquivo: backend/src/helpers/instance-credentials.helper.js

const { fixInstancesCredentials } = require('./helpers/instance-credentials.helper');

// Corrigir todas as instâncias do tenant
await fixInstancesCredentials(tenantId);
```

3. **Corrigir manualmente (via SQL):**
```sql
-- Atualizar instâncias para usar a credencial do tenant
UPDATE uaz_instances ui
SET credential_id = t.uazap_credential_id,
    updated_at = NOW()
FROM tenants t
WHERE ui.tenant_id = t.id
  AND ui.credential_id IS NULL
  AND t.uazap_credential_id IS NOT NULL;
```

---

## 🔍 FERRAMENTAS DE DIAGNÓSTICO

### 1. **Página de Diagnóstico (Frontend)**
```
URL: http://localhost:3000/diagnostic/credentials
```

**O que mostra:**
- ✅ Lista todos os tenants
- ✅ Mostra qual credencial cada tenant usa
- ✅ Lista instâncias de cada tenant
- ✅ Mostra qual credencial cada instância tem
- ✅ Identifica instâncias sem credential_id

### 2. **API de Diagnóstico (Backend)**
```
GET /api/diagnostic-credentials
GET /api/diagnostic-credentials/tenant/:tenantId
```

---

## 📊 QUERIES ÚTEIS PARA DIAGNÓSTICO

### 1. Ver todas as credenciais e quantos tenants usam cada uma:
```sql
SELECT 
  uc.id,
  uc.name,
  uc.is_default,
  uc.is_active,
  COUNT(t.id) as tenants_usando
FROM uazap_credentials uc
LEFT JOIN tenants t ON t.uazap_credential_id = uc.id
GROUP BY uc.id
ORDER BY uc.is_default DESC, tenants_usando DESC;
```

### 2. Ver tenants sem credencial:
```sql
SELECT 
  id,
  nome,
  email,
  uazap_credential_id
FROM tenants 
WHERE uazap_credential_id IS NULL;
```

### 3. Ver instâncias sem credential_id:
```sql
SELECT 
  ui.id,
  ui.name,
  ui.tenant_id,
  t.nome as tenant_nome,
  ui.credential_id,
  t.uazap_credential_id as credencial_do_tenant
FROM uaz_instances ui
JOIN tenants t ON ui.tenant_id = t.id
WHERE ui.credential_id IS NULL;
```

### 4. Ver instâncias usando credencial diferente do tenant:
```sql
SELECT 
  ui.id,
  ui.name,
  ui.tenant_id,
  t.nome as tenant_nome,
  ui.credential_id as credencial_da_instancia,
  t.uazap_credential_id as credencial_do_tenant,
  uc1.name as nome_cred_instancia,
  uc2.name as nome_cred_tenant
FROM uaz_instances ui
JOIN tenants t ON ui.tenant_id = t.id
LEFT JOIN uazap_credentials uc1 ON ui.credential_id = uc1.id
LEFT JOIN uazap_credentials uc2 ON t.uazap_credential_id = uc2.id
WHERE ui.credential_id != t.uazap_credential_id
  AND ui.credential_id IS NOT NULL
  AND t.uazap_credential_id IS NOT NULL;
```

---

## 🎯 FLUXO CORRETO DE CRIAÇÃO

### Quando um Tenant é Criado:
```javascript
// backend/src/controllers/admin/tenants.controller.js (linha 59-81)

1. Sistema busca credencial padrão:
   SELECT id FROM uazap_credentials WHERE is_default = true LIMIT 1

2. Cria tenant com essa credencial:
   INSERT INTO tenants (..., uazap_credential_id, ...)
   VALUES (..., <ID_CREDENCIAL_PADRAO>, ...)

3. ✅ Tenant já nasce vinculado à credencial correta!
```

### Quando uma Instância é Criada:
```javascript
// backend/src/routes/uaz.js

1. Busca credencial do tenant:
   const credentials = await getTenantUazapCredentials(tenantId);

2. Cria instância no UAZAP usando essa credencial:
   const tenantUazService = new UazService(credentials.serverUrl, credentials.adminToken);
   await tenantUazService.createInstance(session_name, proxyConfig);

3. Salva no banco COM credential_id:
   INSERT INTO uaz_instances (..., credential_id, ...)
   VALUES (..., <credentials.credentialId>, ...)

4. ✅ Instância sabe exatamente qual credencial foi usada!
```

---

## 🛠️ AÇÕES RECOMENDADAS

### 1. **Verificar Estado Atual**
Execute as queries de diagnóstico acima para identificar:
- [ ] Quantas credenciais estão cadastradas
- [ ] Qual está marcada como padrão
- [ ] Quantos tenants estão sem credencial
- [ ] Quantas instâncias estão sem credential_id

### 2. **Corrigir Tenants Sem Credencial**
```sql
-- Vincular todos os tenants à credencial padrão
UPDATE tenants 
SET uazap_credential_id = (
  SELECT id FROM uazap_credentials 
  WHERE is_default = true 
  LIMIT 1
)
WHERE uazap_credential_id IS NULL;
```

### 3. **Corrigir Instâncias Sem credential_id**
```sql
-- Vincular instâncias à credencial do tenant
UPDATE uaz_instances ui
SET credential_id = t.uazap_credential_id,
    updated_at = NOW()
FROM tenants t
WHERE ui.tenant_id = t.id
  AND ui.credential_id IS NULL
  AND t.uazap_credential_id IS NOT NULL;
```

### 4. **Testar Após Correção**
1. Acessar: `http://localhost:3000/diagnostic/credentials`
2. Verificar se todos os tenants têm credencial
3. Verificar se todas as instâncias têm credential_id
4. Tentar criar nova instância
5. Tentar enviar mensagem por instância existente

---

## 📝 LOGS IMPORTANTES

### Ao Criar Instância:
```
🔍 Buscando credenciais UAZAP para tenant 1...
✅ Usando credencial específica do tenant: "UAZAP Padrão"
   URL: https://nettsistemas.uazapi.com
```

### Ao Enviar Mensagem:
```
🔍 ============ BUSCAR INSTÂNCIA COM CREDENCIAIS ============
📋 Instância ID: 123
👤 Tenant ID: 1
✅ Usando credencial DA INSTÂNCIA:
   ID: 1
   Nome: UAZAP Padrão
   URL: https://nettsistemas.uazapi.com
🎯 Credencial correta encontrada! (DA INSTÂNCIA)
```

### Se Algo Estiver Errado:
```
⚠️  Instância SEM credential_id específico
🔄 Usando credencial do TENANT como fallback...
⚠️  ATENÇÃO: Esta instância deveria ter credential_id!
   Recomendação: Recriar a instância para vinculá-la à credencial correta
```

---

## 🔐 ARQUIVOS IMPORTANTES

```
backend/src/
├── controllers/admin/
│   └── credentials.controller.js      # CRUD de credenciais
├── routes/
│   ├── admin/credentials.routes.js    # Rotas admin de credenciais
│   ├── diagnostic-credentials.js      # API de diagnóstico
│   └── uaz.js                         # Rotas de instâncias (USA credenciais)
├── helpers/
│   ├── uaz-credentials.helper.js      # Busca credencial do tenant
│   └── instance-credentials.helper.js # Busca credencial da instância
└── database/migrations/
    ├── 027_create_credentials_system.sql      # Cria tabelas de credenciais
    └── 028_add_credential_to_instances.sql    # Adiciona credential_id em instâncias

frontend/src/pages/
├── admin/
│   └── credentials.tsx                # Página admin de credenciais
└── diagnostic/
    └── credentials.tsx                # Página de diagnóstico
```

---

## ✅ CHECKLIST DE VERIFICAÇÃO

- [ ] Há pelo menos UMA credencial cadastrada em `uazap_credentials`?
- [ ] Há UMA credencial marcada como `is_default = true`?
- [ ] Todos os tenants têm `uazap_credential_id` preenchido?
- [ ] Todas as instâncias têm `credential_id` preenchido?
- [ ] O sistema consegue criar novas instâncias?
- [ ] O sistema consegue enviar mensagens por instâncias existentes?

---

## 🆘 SUPORTE

Se após seguir este guia o problema persistir, verifique:

1. **Logs do backend** ao criar instância
2. **Logs do backend** ao enviar mensagem
3. **Console do navegador** na página de diagnóstico
4. **Resultado das queries** de diagnóstico

E então documente:
- Qual tenant está com problema
- Qual instância está com problema
- Mensagem de erro exata
- Resultado das queries de diagnóstico






