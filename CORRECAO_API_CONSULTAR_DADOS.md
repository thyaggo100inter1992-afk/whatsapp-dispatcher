# 🔧 Correção: API de Lista de Restrição no Consultar Dados

## 🚨 Problema Original

```
❌ Erro ao adicionar CPF: error: duplicar valor da chave viola a restrição de unicidade "lista_restricao_cpf_key"
Chave (cpf)=(03769336151) já existe.
```

**Causa:** A página `consultar-dados.tsx` estava usando rotas ANTIGAS da API que tentavam acessar a tabela antiga `lista_restricao`.

---

## ✅ Correções Aplicadas

### 1. **carregarListaRestricao()**

**ANTES:**
```typescript
const response = await api.get('/lista-restricao');
setListaRestricaoCpfs(response.data.cpfs);
```

**DEPOIS:**
```typescript
const response = await api.get('/restriction-lists?list_type=blocked&limit=1000');
const cpfsList = response.data.data.map((item: any) => item.phone_number);
setListaRestricaoCpfs(cpfsList);
```

---

### 2. **adicionarCpfRestricao()**

**ANTES:**
```typescript
await api.post('/lista-restricao', { cpf: novoCpfRestricao });
```

**DEPOIS:**
```typescript
await api.post('/restriction-lists', {
  list_type: 'blocked',
  phone_number: novoCpfRestricao,
  contact_name: novoCpfRestricao,
  notes: `Adicionado via Consultar Dados`
});
```

---

### 3. **removerCpfRestricao()**

**ANTES:**
```typescript
await api.delete(`/lista-restricao/${cpf}`);
```

**DEPOIS:**
```typescript
// Buscar o ID do contato primeiro
const searchResponse = await api.get(`/restriction-lists?list_type=blocked&search=${cpf}`);
const entry = searchResponse.data.data.find((item: any) => item.phone_number === cpf);

if (entry) {
  await api.delete(`/restriction-lists/${entry.id}`);
}
```

**Por que?** A nova API requer o **ID** do registro, não o CPF diretamente.

---

### 4. **Verificação em Massa (check-bulk)**

**ANTES:**
```typescript
const restricaoResponse = await api.post('/lista-restricao/verificar-lista', { cpfs });
const cpfsBloqueados = restricaoResponse.data.bloqueados || [];
const cpfsPermitidos = restricaoResponse.data.permitidos || [];
```

**DEPOIS:**
```typescript
const restricaoResponse = await api.post('/restriction-lists/check-bulk', { 
  phone_numbers: cpfs,
  whatsapp_account_id: 1
});

const cpfsBloqueados = restricaoResponse.data.restricted_details?.map((r: any) => r.phone_number) || [];
const cpfsPermitidos = cpfs.filter((cpf: string) => !cpfsBloqueados.includes(cpf));
```

**Mudança na estrutura de resposta:**
```json
{
  "success": true,
  "total_checked": 10,
  "restricted_count": 3,
  "clean_count": 7,
  "restricted_details": [
    {
      "phone_number": "556299336151",
      "matched_number": "556299336151",
      "contact_name": "João",
      "lists": ["blocked"]
    }
  ]
}
```

---

### 5. **Upload de Excel**

**ANTES:**
```typescript
const response = await api.post('/lista-restricao/adicionar-lista', { cpfs });
```

**DEPOIS:**
```typescript
// Adicionar cada CPF individualmente
let adicionados = 0;
let jaExistentes = 0;

for (const cpf of cpfs) {
  try {
    await api.post('/restriction-lists', {
      list_type: 'blocked',
      phone_number: cpf,
      contact_name: cpf,
      notes: 'Importado via Excel',
      added_method: 'import'
    });
    adicionados++;
  } catch (error: any) {
    if (error.response?.status === 409) {
      jaExistentes++;
    }
  }
}
```

**Por que individualmente?** A nova API não tem endpoint específico para adicionar múltiplos de uma vez na rota de uso geral. Para importação em massa, deve-se usar o endpoint de importação de arquivo.

---

## 📊 Resumo das Mudanças de Rotas

| Ação | Rota Antiga | Rota Nova |
|------|-------------|-----------|
| Listar | `GET /lista-restricao` | `GET /restriction-lists?list_type=blocked` |
| Adicionar | `POST /lista-restricao` | `POST /restriction-lists` |
| Remover | `DELETE /lista-restricao/:cpf` | `DELETE /restriction-lists/:id` |
| Verificar Massa | `POST /lista-restricao/verificar-lista` | `POST /restriction-lists/check-bulk` |
| Import Excel | `POST /lista-restricao/adicionar-lista` | `POST /restriction-lists` (loop) |

---

## 🎯 Próximos Passos

### 1. **Recarregue o Navegador**
Pressione: `Ctrl + Shift + R` ou `F5`

### 2. **Teste a Funcionalidade**
1. Acesse: `http://localhost:3000/consultar-dados`
2. Clique na aba "Lista de Restrição"
3. Digite um telefone (ex: `62999336151`)
4. Clique em "Adicionar"
5. Deve aparecer: `✅ Contato adicionado à lista de restrição`

---

## ✅ O que DEVE funcionar agora

- ✅ Adicionar CPF/telefone sem erro 500
- ✅ Listar CPFs bloqueados
- ✅ Remover CPF individual
- ✅ Verificação em massa durante higienização
- ✅ Upload de arquivo Excel

---

## 🔍 Validação

### **Backend (console):**
Ao adicionar um CPF, você deve ver:
```
✅ Versão COM 9 (556299336151) não existe, inserindo...
✅ Versão SEM 9 (55629936151) não existe, inserindo...
```

### **Frontend (DevTools):**
```
✅ Contato adicionado à lista de restrição
✅ X CPFs bloqueados carregados
```

---

## 🆘 Se Ainda Der Erro

### **Erro 409 - Conflict**
**Mensagem:** `Todas as versões deste contato já existem nesta lista`

**Solução:** O CPF já foi cadastrado. Normal! Tente outro número.

### **Erro 400 - Bad Request**
**Mensagem:** `Número de telefone inválido`

**Solução:** Verifique o formato do número:
- ✅ Correto: `62999336151` (11 dígitos com DDD)
- ❌ Errado: `999336151` (sem DDD)

---

## 📁 Arquivo Modificado

- `frontend/src/pages/consultar-dados.tsx` (5 funções corrigidas)

---

## 🎉 Resultado Final

Agora a página "Consultar Dados" usa as mesmas rotas de API que a página "Lista de Restrição", garantindo consistência e eliminando o erro 500!





