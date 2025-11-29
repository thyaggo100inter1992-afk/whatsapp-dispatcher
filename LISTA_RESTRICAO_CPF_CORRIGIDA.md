# ✅ Lista de Restrição de CPF - CORREÇÃO FINAL

## 📋 **Entendimento Correto**

A **Lista de Restrição** é uma lista de **CPFs BLOQUEADOS** para consulta de dados.

### **NÃO É:**
- ❌ Lista de telefones do WhatsApp
- ❌ Lista de bloqueio de mensagens
- ❌ Relacionada ao sistema de disparos

### **É:**
- ✅ Lista de CPFs que **NÃO podem ser consultados**
- ✅ Bloqueia consultas na Nova Vida (CPF/CNPJ)
- ✅ Impede verificação desses CPFs

---

## 🎯 **Finalidade**

Quando um **CPF** está na Lista de Restrição:

### ❌ **NÃO PODE** ser consultado em:
1. **Consulta Única** - Consulta individual de CPF/CNPJ
2. **Consulta em Massa** - Upload de planilha com vários CPFs
3. **Verificação e Higienização** - Limpeza e validação de base de dados

### ✅ **PODE:**
- Ser adicionado manualmente
- Ser importado via Excel
- Ser removido individualmente

---

## 🔧 **Correção Aplicada**

Revertidas todas as rotas para usar a **API ANTIGA de CPF** (`/lista-restricao`):

### 1. **Carregar Lista**
```typescript
// ANTES (ERRADO - telefones):
GET /restriction-lists?list_type=blocked

// AGORA (CORRETO - CPFs):
GET /lista-restricao
```

### 2. **Adicionar CPF**
```typescript
// ANTES (ERRADO):
POST /restriction-lists
{ list_type, phone_number, contact_name, notes }

// AGORA (CORRETO):
POST /lista-restricao
{ cpf: "03769336151" }
```

### 3. **Remover CPF**
```typescript
// ANTES (ERRADO - por ID):
DELETE /restriction-lists/{id}

// AGORA (CORRETO - por CPF):
DELETE /lista-restricao/{cpf}
```

### 4. **Verificação em Massa**
```typescript
// ANTES (ERRADO):
POST /restriction-lists/check-bulk
{ phone_numbers, whatsapp_account_id }

// AGORA (CORRETO):
POST /lista-restricao/verificar-lista
{ cpfs: ["03769336151", "12345678901"] }
```

### 5. **Upload Excel**
```typescript
// ANTES (ERRADO - loop individual):
for (cpf of cpfs) {
  POST /restriction-lists { ... }
}

// AGORA (CORRETO - bulk):
POST /lista-restricao/adicionar-lista
{ cpfs: ["03769336151", "12345678901", ...] }
```

---

## 📊 **Formato do CPF**

O sistema aceita CPF em **dois formatos**:

### ✅ **Sem Formatação (Recomendado):**
```
03769336151
```
- 11 dígitos
- Apenas números
- Mais rápido de digitar

### ✅ **Com Formatação:**
```
037.693.361-51
```
- 14 caracteres (com pontos e hífen)
- O sistema remove automaticamente

---

## 🚀 **Como Usar**

### **Adicionar CPF Individual:**
1. Vá em: **Consultar Dados** > **Lista de Restrição**
2. Digite o CPF: `03769336151`
3. Clique em **"Adicionar"**
4. CPF será bloqueado para consultas

### **Adicionar Múltiplos CPFs (Excel):**
1. Prepare planilha com CPFs na **primeira coluna**
2. Clique em **"Upload Excel/CSV"**
3. Selecione o arquivo
4. Sistema adiciona todos os CPFs

### **Remover CPF:**
1. Encontre o CPF na lista
2. Clique no botão **"Remover"** (ícone de lixeira)
3. Confirme a exclusão

---

## 🔍 **Fluxo de Verificação**

### **Quando você faz uma consulta em massa:**

```
1. Usuário envia planilha com 100 CPFs
   ↓
2. Sistema verifica Lista de Restrição
   ↓
3. Remove CPFs bloqueados (ex: 5 CPFs)
   ↓
4. Consulta apenas os 95 CPFs permitidos
   ↓
5. Retorna resultado mostrando:
   - 95 consultados
   - 5 bloqueados (não consultados)
```

---

## 📁 **Estrutura da Tabela no Banco**

```sql
CREATE TABLE lista_restricao (
  id SERIAL PRIMARY KEY,
  cpf VARCHAR(14) UNIQUE NOT NULL,  -- CPF sem formatação
  motivo TEXT,                       -- Motivo do bloqueio (opcional)
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Chave Única:** `cpf` - Garante que o mesmo CPF não seja adicionado duas vezes

---

## 🎯 **Casos de Uso**

### **Exemplo 1: Consulta Única**
```
Usuário tenta consultar: 03769336151
Sistema verifica: Este CPF está na Lista de Restrição
Resultado: ❌ Consulta bloqueada
Mensagem: "CPF bloqueado - não pode ser consultado"
```

### **Exemplo 2: Consulta em Massa**
```
Planilha com 10 CPFs:
- 03769336151 ❌ (bloqueado)
- 12345678901 ✅
- 98765432100 ✅
- 03769336151 ❌ (bloqueado)
... (6 CPFs permitidos)

Resultado:
- 8 CPFs consultados
- 2 CPFs bloqueados (não consultados)
```

---

## ✅ **Testes de Validação**

### **Teste 1: Adicionar CPF**
1. Digite: `03769336151`
2. Clique: "Adicionar"
3. Resultado esperado: `✅ CPF adicionado à lista de restrição`

### **Teste 2: Adicionar CPF Duplicado**
1. Tente adicionar o mesmo CPF novamente
2. Resultado esperado: `❌ CPF já existe na lista`

### **Teste 3: Remover CPF**
1. Clique no botão "Remover" ao lado do CPF
2. Confirme a exclusão
3. Resultado esperado: `✅ CPF removido da lista`

### **Teste 4: Consulta Bloqueada**
1. Adicione CPF `12345678901` na lista
2. Tente consultar esse CPF na "Consulta Única"
3. Resultado esperado: Consulta bloqueada

---

## 📄 **Arquivo Modificado**

- `frontend/src/pages/consultar-dados.tsx`
  - Função `carregarListaRestricao()`
  - Função `adicionarCpfRestricao()`
  - Função `removerCpfRestricao()`
  - Função de verificação em massa
  - Função de upload Excel

---

## 🎉 **Próximo Passo**

1. **Recarregue o navegador:** Pressione `F5` ou `Ctrl + Shift + R`
2. **Acesse:** Consultar Dados > Lista de Restrição
3. **Digite um CPF:** `03769336151`
4. **Clique:** "Adicionar"
5. **Resultado:** `✅ CPF adicionado à lista de restrição`

---

## 🔒 **Diferença Entre as Duas Listas**

### **Lista de Restrição de CPF** (`/lista-restricao`)
- **Onde:** Consultar Dados
- **Bloqueia:** CPFs de serem consultados na Nova Vida
- **Propósito:** Privacidade/Compliance de dados

### **Lista de Restrição de Telefone** (`/restriction-lists`)
- **Onde:** Configurações UAZ / Listas de Restrição
- **Bloqueia:** Telefones de receberem mensagens WhatsApp
- **Propósito:** Do Not Disturb / Opt-out de marketing

**São sistemas DIFERENTES!** 🎯





