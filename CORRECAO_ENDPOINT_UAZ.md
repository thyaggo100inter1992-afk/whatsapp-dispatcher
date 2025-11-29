# 🔧 CORREÇÃO: Endpoint da UAZ API

**Data:** 19/11/2025  
**Status:** ✅ CORRIGIDO

---

## ❌ O PROBLEMA

Ao tentar importar instâncias, o sistema retornava erro 404:

```
❌ Erro ao buscar instâncias da UAZ API: Request failed with status code 404
   └─ Response: { code: 404, message: 'Not Found.', data: {} }
```

---

## 🔍 CAUSA

O endpoint estava **ERRADO**:

```javascript
// ❌ ERRADO (não existe)
GET /instance/fetchInstances
```

---

## ✅ SOLUÇÃO

Consultei a documentação oficial da UAZ API (`DOCUMENTAÇÃO UAZAPI/uazapi-openapi-spec.yaml`) e encontrei o endpoint correto:

```javascript
// ✅ CORRETO
GET /instance/all
```

### Documentação Oficial:

```yaml
/instance/all:
  get:
    tags:
      - Admininstração
    summary: Listar todas as instâncias
    security:
      - admintoken: []
    description: |
      Retorna uma lista completa de todas as instâncias do sistema
    responses:
      '200':
        description: Lista de instâncias retornada com sucesso
        content:
          application/json:
            schema:
              type: array
              items:
                $ref: ../schemas/instance.yaml#/Instance
```

---

## 🔧 ALTERAÇÕES FEITAS

### 1. backend/src/services/uazService.js

**ANTES:**
```javascript
const response = await client.get(`/instance/fetchInstances`);
const instances = response.data?.instances || [];
```

**DEPOIS:**
```javascript
const response = await client.get(`/instance/all`);
// A resposta vem como um array direto, não como {instances: [...]}
const instances = Array.isArray(response.data) ? response.data : [];
```

### 2. backend/src/routes/uaz.js

**Adicionado:**
```javascript
if (uazInstances.length === 0) {
  console.log('⚠️  Nenhuma instância encontrada na UAZ API');
  return res.json({
    success: true,
    total: 0,
    available: 0,
    alreadyImported: 0,
    instances: []
  });
}
```

---

## 📊 FORMATO DA RESPOSTA

### Resposta da UAZ API:

```json
[
  {
    "id": "r07433c48fe801f",
    "token": "3739c539-f323-47bd-96e0-7b517b75d085",
    "name": "556281045992",
    "status": "connected",
    "profileName": "NettCred Financeira",
    "profilePicUrl": "https://...",
    "owner": "556281045992",
    "created": "2025-11-17T23:24:55.008Z",
    "updated": "2025-11-17T23:24:55.008Z"
  },
  {
    "id": "r0d145825f4ce36",
    "token": "69aae9d1-1353-41d5-81cb-d1a989a2c457",
    "name": "556298669726",
    "status": "connected",
    ...
  }
]
```

**Nota:** A resposta é um **ARRAY DIRETO**, não um objeto com `{instances: [...]}`.

---

## ✅ COMO TESTAR AGORA

1. **Reinicie o backend:**
   ```bash
   Ctrl+C no terminal
   npm run dev
   ```

2. **Acesse:** `Configurações UAZ`

3. **Clique:** Botão **"Importar Instâncias"**

4. **Resultado esperado:**
   - ✅ Modal abre com lista de instâncias
   - ✅ Mostra instâncias da UAZ API
   - ✅ Permite selecionar e importar

---

## 🎓 APRENDIZADO

Sempre consultar a **documentação oficial** da API antes de implementar!

Arquivo: `DOCUMENTAÇÃO UAZAPI/uazapi-openapi-spec.yaml`

---

**🚀 CORREÇÃO APLICADA! Reinicie o backend e teste novamente!**





