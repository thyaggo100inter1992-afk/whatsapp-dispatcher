# 🔧 Correção: Profile Name no Lugar Correto

## 🔍 Problema Identificado

O sistema estava buscando o `profileName` em locais **incorretos** na resposta da API UAZ.

### ❌ **ANTES (Errado):**
```javascript
// Estava buscando em vários lugares aleatórios
const profileName = statusResult.data.instance?.profileName ||  // ✅ CORRETO
                   statusResult.data.profileName ||              // ❌ ERRADO
                   statusResult.data.instance?.name ||           // ❌ ERRADO (nome da instância)
                   null;
```

### ✅ **DEPOIS (Correto):**
```javascript
// Agora busca APENAS no lugar correto da documentação
const profileName = statusResult.data.instance?.profileName || null;
```

---

## 📚 **De Acordo com a Documentação Oficial UAZ API**

### Endpoint: `GET /instance/status`

**Estrutura da Resposta:**
```json
{
  "instance": {
    "id": "r183e2ef9597845",
    "name": "minha-instancia",           // ← Nome da INSTÂNCIA (não do perfil)
    "status": "connected",
    "profileName": "Meu WhatsApp",       // ← NOME DO PERFIL (correto!)
    "profilePicUrl": "https://...",
    "isBusiness": true,
    "token": "abc123",
    ...
  },
  "status": {
    "connected": true,
    "loggedIn": true,
    "jid": {...}
  }
}
```

### 🎯 **Caminho Correto:**
- `response.data.instance.profileName` ✅

### ❌ **Caminhos Incorretos:**
- `response.data.profileName` ❌ (não existe no root)
- `response.data.instance.name` ❌ (nome da instância, não do perfil)

---

## 🛠️ **Arquivos Corrigidos**

### 1. **backend/src/routes/uaz.js**

#### `GET /instances/:id/status` (linhas ~877-887)
**ANTES:**
```javascript
profileName = statusResult.data.instance?.profileName || 
              statusResult.data.profileName ||              // ❌
              statusResult.data.instance?.name ||           // ❌
              null;
```

**DEPOIS:**
```javascript
// Busca profileName de acordo com a documentação UAZ API
profileName = statusResult.data.instance?.profileName || null;

console.log('🔍 DEBUG - Estrutura completa de statusResult.data.instance:');
console.log(JSON.stringify(statusResult.data.instance, null, 2));
console.log('🔍 DEBUG - profileName extraído:', profileName);
```

#### `PUT /instances/:id/sync-profile` (linhas ~533-539)
**ANTES:**
```javascript
const profileName = statusResult.data?.instance?.profileName || 
                   statusResult.data?.profileName ||         // ❌
                   statusResult.data?.instance?.name ||      // ❌
                   null;
```

**DEPOIS:**
```javascript
// Extrai o profileName de acordo com a documentação UAZ API
const profileName = statusResult.data?.instance?.profileName || null;

console.log('🔍 DEBUG - profileName buscado:', profileName);
console.log('🔍 DEBUG - Estrutura de statusResult.data.instance:');
console.log(JSON.stringify(statusResult.data?.instance, null, 2));
```

#### `PUT /instances/:id` (linhas ~417-429)
**ANTES:**
```javascript
const realProfileName = statusResult.data.instance?.profileName || 
                       statusResult.data.profileName ||      // ❌
                       statusResult.data.instance?.name ||   // ❌
                       profile_name;
```

**DEPOIS:**
```javascript
// Busca no lugar correto de acordo com a documentação UAZ API
const realProfileName = statusResult.data.instance?.profileName || profile_name;

console.log('🔍 DEBUG - statusResult.data.instance.profileName:', statusResult.data.instance?.profileName);
console.log('🔍 DEBUG - Nome real do perfil:', realProfileName);
```

### 2. **frontend/src/pages/configuracoes-uaz.tsx**

#### `handleEdit()` (linhas ~135-145)
**ANTES:**
```javascript
const profileName = statusResponse.data.profile_name ||
                   statusResponse.data.data?.instance?.profileName || 
                   statusResponse.data.data?.profileName ||          // ❌
                   statusResponse.data.data?.instance?.name ||       // ❌
                   null;
```

**DEPOIS:**
```javascript
// Busca profileName de acordo com a documentação UAZ API
const profileName = statusResponse.data.profile_name ||
                   statusResponse.data.data?.instance?.profileName ||
                   null;

console.log('🔍 Estrutura da resposta de status:');
console.log('   ├─ profile_name (backend):', statusResponse.data.profile_name);
console.log('   ├─ data.instance.profileName (API):', statusResponse.data.data?.instance?.profileName);
console.log('   └─ 🎯 Profile name final:', profileName);
```

---

## 🧪 **Como Testar Agora**

### **1. Reinicie o Backend**

Se o backend ainda não foi reiniciado, **feche a janela do CMD do backend** (Ctrl+C) e execute:

```bash
.\INICIAR_BACKEND.bat
```

### **2. Abra o DevTools (F12)**
- Navegador → Pressione **F12**
- Aba **"Console"**

### **3. Edite uma Conexão Conectada**
- Vá em "Gerenciar Conexões"
- Edite uma conexão com status **VERDE** (conectada)

### **4. Observe os Logs Detalhados**

#### 💻 **No Terminal do Backend:**
```
🔍 ============ VERIFICAÇÃO DE STATUS ============
📋 Instância: [NOME] (ID: [ID])
📊 Resultado:
   └─ Nome do Perfil: [NOME DO PERFIL]  ← DEVE APARECER AQUI

🔍 DEBUG - Estrutura completa de statusResult.data.instance:
{
  "id": "...",
  "name": "minha-instancia",
  "status": "connected",
  "profileName": "Nome Real do WhatsApp",  ← AQUI ESTÁ!
  ...
}
🔍 DEBUG - profileName extraído: Nome Real do WhatsApp
```

#### 📱 **No Console do Browser:**
```
📋 Dados iniciais da instância: { profile_name: "...", ... }

🔍 Buscando nome do perfil atual do WhatsApp...

📦 Resposta completa do status: { success: true, profile_name: "...", ... }

🔍 Estrutura da resposta de status:
   ├─ profile_name (backend): Nome Real do WhatsApp
   ├─ data.instance.profileName (API): Nome Real do WhatsApp
   └─ 🎯 Profile name final: Nome Real do WhatsApp

✅ Nome do perfil atual: Nome Real do WhatsApp
```

### **5. Veja o Campo Preenchido**
- O campo **"👤 Nome do Perfil do WhatsApp"** deve estar preenchido automaticamente

---

## 🚨 **Se AINDA Não Funcionar:**

### **Possíveis Causas:**

1. **profileName está NULL na API UAZ**
   - A API pode retornar `null` se:
     - O perfil ainda não foi definido no WhatsApp
     - A instância foi conectada recentemente e os dados ainda não foram sincronizados
     - A conta não tem um nome de perfil configurado

2. **Backend não foi reiniciado**
   - As alterações só são aplicadas após reiniciar o backend

3. **Cache do browser**
   - Pressione **Ctrl+Shift+R** para forçar recarregamento

---

## 📤 **O Que Me Enviar se Não Funcionar:**

### ✅ **Logs do Backend:**
Copie TODO o bloco:
```
🔍 ============ VERIFICAÇÃO DE STATUS ============
...
🔍 DEBUG - Estrutura completa de statusResult.data.instance:
{...}
🔍 DEBUG - profileName extraído: ...
```

### ✅ **Logs do Console do Browser:**
Copie TODO o bloco que aparece ao clicar em "Editar"

### ✅ **Screenshot:**
- Tire um print do campo "Nome do Perfil do WhatsApp"

---

## 📊 **Resumo da Correção**

| Antes | Depois |
|-------|--------|
| ❌ Buscava em 3-4 lugares diferentes | ✅ Busca APENAS no lugar correto |
| ❌ Incluía `instance.name` (errado) | ✅ Usa APENAS `instance.profileName` |
| ❌ Sem logs de debug | ✅ Logs detalhados em todos os pontos |
| ❌ Documentação desatualizada | ✅ Seguindo documentação oficial UAZ |

---

**Data da Correção:** 15/11/2025  
**Versão:** 3.0 (Corrigido com base na documentação oficial)  
**Status:** ✅ Pronto para Teste










