# 📚 Funcionalidades Disponíveis - Perfil e Status do WhatsApp (API UAZ)

## 📋 **Resumo Baseado na Documentação Oficial UAZ API**

---

## 🔵 **1. PERFIL DO WHATSAPP (Profile)**

### ✅ **1.1 Nome do Perfil**

#### **📝 Alterar Nome do Perfil**
- **Endpoint:** `POST /profile/name`
- **Função:** Altera o nome de exibição do perfil
- **Autenticação:** Requer `token` da instância
- **Requisitos:**
  - ✅ Instância deve estar **conectada**
  - ✅ Nome máximo: **25 caracteres**
  - ⚠️ Pode haver **limite de alterações por período** (WhatsApp)

**Exemplo de Request:**
```json
POST /profile/name
{
  "name": "Minha Empresa - Atendimento"
}
```

**Exemplo de Response:**
```json
{
  "success": true,
  "message": "Nome do perfil alterado com sucesso",
  "profile": {
    "name": "Minha Empresa - Atendimento",
    "updated_at": 1704067200
  }
}
```

**Status Codes:**
- ✅ `200` - Alterado com sucesso
- ❌ `400` - Nome inválido ou muito longo
- ❌ `401` - Sem sessão ativa (`No session`)
- ❌ `403` - Limite de alterações excedido
- ❌ `500` - Erro interno

---

#### **🔍 Consultar Nome do Perfil**
- **Endpoint:** `GET /instance/status`
- **Retorna:** `profileName` dentro de `instance`
- **Estrutura:**
  ```json
  {
    "instance": {
      "id": "...",
      "name": "instancia-1",
      "profileName": "Nome Atual do Perfil",  // ← AQUI
      "profilePicUrl": "...",
      ...
    }
  }
  ```

---

### ✅ **1.2 Foto do Perfil**

#### **📝 Alterar Foto do Perfil**
- **Endpoint:** `POST /profile/image`
- **Função:** Altera ou remove a foto de perfil
- **Autenticação:** Requer `token` da instância
- **Requisitos:**
  - ✅ Instância deve estar **conectada**
  - ✅ Formato: **JPEG**
  - ✅ Tamanho: **640x640 pixels**

**Formas de enviar a imagem:**

**Opção 1: URL**
```json
POST /profile/image
{
  "image": "https://example.com/foto.jpg"
}
```

**Opção 2: Base64**
```json
POST /profile/image
{
  "image": "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
}
```

**Opção 3: Remover Foto**
```json
POST /profile/image
{
  "image": "remove"
}
```
ou
```json
POST /profile/image
{
  "image": "delete"
}
```

**Exemplo de Response:**
```json
{
  "success": true,
  "message": "Imagem do perfil alterada com sucesso",
  "profile": {
    "image_updated": true,
    "image_removed": false,
    "updated_at": 1704067200
  }
}
```

**Status Codes:**
- ✅ `200` - Alterado com sucesso
- ❌ `400` - Formato inválido ou URL inacessível
- ❌ `401` - Sem sessão ativa
- ❌ `403` - Limite de alterações excedido
- ❌ `413` - Imagem muito grande
- ❌ `500` - Erro interno

---

#### **🔍 Consultar Foto do Perfil**
- **Endpoint:** `GET /instance/status`
- **Retorna:** `profilePicUrl` dentro de `instance`
- **Estrutura:**
  ```json
  {
    "instance": {
      "profileName": "...",
      "profilePicUrl": "https://example.com/profile.jpg",  // ← AQUI
      ...
    }
  }
  ```

---

## 🔵 **2. STATUS/RECADO (Status Message)**

### ✅ **2.1 Recado Personalizado**

#### **📝 Alterar Recado (Status)**
- **Endpoint:** `POST /instance/privacy` (seção: `status`)
- **Função:** Altera o recado que aparece embaixo do nome
- **Exemplo:** "Disponível", "Ocupado", "No trabalho", etc.

**⚠️ IMPORTANTE:** 
- **"Status"** na API UAZ = **Recado personalizado** (ex: "Disponível")
- **"Broadcast"** = **Stories/Reels** (fotos/vídeos temporários)
- ❌ **NÃO é possível** alterar privacidade de Broadcast via API

**Configurações de Privacidade do Status:**
```json
POST /instance/privacy
{
  "readreceipts": "all",      // Confirmação de leitura
  "status": "contacts",       // Quem vê seu recado
  "online": "all",           // Quem vê quando está online
  "profile": "all",          // Quem vê sua foto de perfil
  "last": "all",             // Quem vê "visto por último"
  "groupadd": "all"          // Quem pode adicionar a grupos
}
```

**Opções para `status`:**
- `"all"` - Todos
- `"contacts"` - Apenas contatos
- `"contact_blacklist"` - Contatos exceto alguns
- `"none"` - Ninguém

#### **🔍 Consultar Configurações de Privacidade**
- **Endpoint:** `GET /instance/privacy`
- **Retorna:** Todas as configurações de privacidade
- **Estrutura:**
  ```json
  {
    "readreceipts": "all",
    "status": "contacts",
    "online": "all",
    "profile": "all",
    "last": "all",
    "groupadd": "all"
  }
  ```

---

### ✅ **2.2 Stories/Status (Broadcast)**

#### **📝 Enviar Story/Status**
- **Endpoint:** `POST /story/text` ou `/story/image` ou `/story/video`
- **Função:** Envia um story (status temporário)
- **Tipos:** Texto, Imagem, Vídeo, Áudio

**Exemplo - Story de Texto:**
```json
POST /story/text
{
  "text": "Novidade! Confira nossos produtos",
  "backgroundColor": "#FF5733",
  "font": 1
}
```

**Exemplo - Story de Imagem:**
```json
POST /story/image
{
  "image": "https://example.com/imagem.jpg",
  "caption": "Confira nossa promoção!"
}
```

---

## 🔵 **3. PRESENÇA/DISPONIBILIDADE (Presence)**

### ✅ **3.1 Status de Presença Global**

#### **📝 Atualizar Presença Global**
- **Endpoint:** `POST /instance/presence`
- **Função:** Define se está **disponível** (online) ou **indisponível**
- **Autenticação:** Requer `token` da instância

**Opções:**
```json
POST /instance/presence
{
  "state": "available"  // ou "unavailable"
}
```

**Estados:**
- `"available"` - Aparece como **online**
- `"unavailable"` - Aparece como **offline**

---

### ✅ **3.2 Status de Presença por Chat**

#### **📝 Atualizar Presença em Chat Específico**
- **Endpoint:** `POST /chat/presence`
- **Função:** Simula "digitando...", "gravando áudio...", etc.

**Opções:**
```json
POST /chat/presence
{
  "phone": "5511999999999",
  "state": "composing"  // ou "recording", "paused"
}
```

**Estados:**
- `"composing"` - Digitando...
- `"recording"` - Gravando áudio...
- `"paused"` - Para de mostrar ação

---

## 🔵 **4. INSTÂNCIA (Instance)**

### ✅ **4.1 Status da Instância**

#### **🔍 Verificar Status da Instância**
- **Endpoint:** `GET /instance/status`
- **Função:** Retorna status completo da instância
- **Autenticação:** Requer `token` da instância

**Retorna:**
```json
{
  "instance": {
    "id": "r183e2ef9597845",
    "name": "minha-instancia",
    "status": "connected",            // Estado da conexão
    "profileName": "Meu WhatsApp",    // ← Nome do perfil
    "profilePicUrl": "https://...",   // ← URL da foto
    "isBusiness": true,
    "token": "abc123...",
    ...
  },
  "status": {
    "connected": true,
    "loggedIn": true,
    "jid": {...}
  }
}
```

**Estados possíveis da instância:**
- `"disconnected"` - Desconectado
- `"connecting"` - Conectando (aguardando QR Code)
- `"connected"` - Conectado e autenticado ✅

---

## 📊 **RESUMO DE FUNCIONALIDADES**

### ✅ **O QUE VOCÊ PODE FAZER:**

| Funcionalidade | Criar | Editar | Consultar | Apagar/Remover | Endpoint |
|----------------|-------|--------|-----------|----------------|----------|
| **Nome do Perfil** | ❌ | ✅ | ✅ | ❌ | `POST /profile/name`<br>`GET /instance/status` |
| **Foto do Perfil** | ✅ | ✅ | ✅ | ✅ | `POST /profile/image`<br>`GET /instance/status` |
| **Recado (Status)** | ✅ | ✅ | ✅ | ❌ | `POST /instance/privacy` (status)<br>`GET /instance/privacy` |
| **Story/Status (Broadcast)** | ✅ | ❌ | ❌ | ❌ | `POST /story/text|image|video` |
| **Presença Global** | ❌ | ✅ | ✅ | ❌ | `POST /instance/presence`<br>`GET /instance/status` |
| **Presença em Chat** | ❌ | ✅ | ❌ | ❌ | `POST /chat/presence` |
| **Status da Instância** | ❌ | ❌ | ✅ | ❌ | `GET /instance/status` |
| **Privacidade** | ❌ | ✅ | ✅ | ❌ | `POST /instance/privacy`<br>`GET /instance/privacy` |

---

## 🔍 **DETALHAMENTO:**

### **1. Nome do Perfil:**
- ✅ **EDITAR** - `POST /profile/name` - Alterar nome (máx 25 caracteres)
- ✅ **CONSULTAR** - `GET /instance/status` - Ver nome atual em `instance.profileName`
- ❌ **CRIAR** - Não se aplica (perfil já existe ao conectar)
- ❌ **APAGAR** - Não é possível apagar, apenas alterar

### **2. Foto do Perfil:**
- ✅ **CRIAR** - `POST /profile/image` - Upload de foto
- ✅ **EDITAR** - `POST /profile/image` - Trocar foto
- ✅ **CONSULTAR** - `GET /instance/status` - Ver URL em `instance.profilePicUrl`
- ✅ **APAGAR** - `POST /profile/image` com `{"image": "remove"}`

### **3. Recado (Status Message):**
- ✅ **CRIAR** - `POST /instance/privacy` - Definir recado
- ✅ **EDITAR** - `POST /instance/privacy` - Alterar recado
- ✅ **CONSULTAR** - `GET /instance/privacy` - Ver configurações de privacidade do recado
- ❌ **APAGAR** - Não é possível apagar, apenas alterar privacidade

### **4. Story/Status (Broadcast):**
- ✅ **CRIAR** - `POST /story/text|image|video` - Enviar story
- ❌ **EDITAR** - Não é possível editar stories (são temporários)
- ❌ **CONSULTAR** - Não há endpoint específico
- ❌ **APAGAR** - Stories expiram automaticamente (24h)

### **5. Status da Instância:**
- ✅ **CONSULTAR** - `GET /instance/status` - Ver tudo:
  - Estado de conexão (connected/disconnected)
  - Nome do perfil (`profileName`)
  - URL da foto (`profilePicUrl`)
  - Se é Business (`isBusiness`)
  - QR Code (se conectando)
  - Timestamp de conexão/desconexão

---

## 📝 **IMPORTANTE - Limitações:**

### ❌ **NÃO É POSSÍVEL via API:**

1. **Privacidade de Broadcast (Stories):**
   - Não é possível alterar quem vê seus stories via API
   - Configuração deve ser feita no app WhatsApp

2. **Apagar Nome do Perfil:**
   - Não é possível deixar sem nome
   - Apenas alterar para outro nome

3. **Editar Stories:**
   - Stories são temporários e não podem ser editados
   - Apenas criar novos

4. **Receber Atualizações Automáticas:**
   - API não envia notificações de mudanças de perfil
   - Você precisa **consultar** via `GET /instance/status`
   - Use **webhooks** para receber eventos de conexão

---

## 🎯 **RECOMENDAÇÕES:**

### **Para Sincronizar Dados do Perfil:**

1. **Ao Conectar:**
   - Chame `GET /instance/status` após conexão
   - Salve `profileName` e `profilePicUrl` no banco

2. **Após Alterar:**
   - Aguarde **3 segundos** (cache da API)
   - Chame `GET /instance/status` novamente
   - Atualize banco com dados reais

3. **Periodicamente:**
   - Verifique `GET /instance/status` a cada X minutos
   - Detecte mudanças feitas diretamente no app WhatsApp
   - Sincronize com seu banco

4. **Use Webhooks:**
   - Configure webhook para eventos de `connection`
   - Receba notificações quando conectar/desconectar
   - Sincronize perfil automaticamente

---

## 📚 **Endpoints Resumidos:**

| Endpoint | Método | Função | Autenticação |
|----------|--------|--------|--------------|
| `/profile/name` | POST | Alterar nome do perfil | `token` |
| `/profile/image` | POST | Alterar foto do perfil | `token` |
| `/instance/status` | GET | Consultar status completo | `token` |
| `/instance/privacy` | GET | Consultar privacidade | `token` |
| `/instance/privacy` | POST | Alterar privacidade | `token` |
| `/instance/presence` | POST | Alterar presença global | `token` |
| `/chat/presence` | POST | Simular ação em chat | `token` |
| `/story/text` | POST | Enviar story de texto | `token` |
| `/story/image` | POST | Enviar story de imagem | `token` |
| `/story/video` | POST | Enviar story de vídeo | `token` |

---

## ✅ **Confirmação das Suas Perguntas:**

### **1. Alterações que você pode fazer no Status do WhatsApp:**
- ✅ Alterar nome do perfil
- ✅ Alterar foto do perfil
- ✅ Alterar recado (status message)
- ✅ Enviar stories
- ✅ Alterar presença (online/offline)
- ✅ Alterar privacidade

### **2. Consultas que você pode fazer:**
- ✅ Consultar status da instância (conectado/desconectado)
- ✅ Consultar nome do perfil atual
- ✅ Consultar URL da foto do perfil
- ✅ Consultar configurações de privacidade
- ✅ Consultar se é conta Business

### **3. O que você pode CRIAR:**
- ✅ Foto do perfil (upload inicial)
- ✅ Stories (texto, imagem, vídeo)

### **4. O que você pode EDITAR:**
- ✅ Nome do perfil
- ✅ Foto do perfil (trocar)
- ✅ Recado (status message)
- ✅ Configurações de privacidade
- ✅ Presença global (disponível/indisponível)

### **5. O que você pode APAGAR:**
- ✅ Foto do perfil (remover)
- ⚠️ Stories expiram automaticamente (24h)

### **6. O que você pode RECEBER (via Webhook):**
- ✅ Eventos de conexão/desconexão
- ✅ Mensagens recebidas
- ✅ Atualizações de mensagens
- ✅ Chamadas
- ✅ Contatos
- ✅ Grupos
- ⚠️ **NÃO:** Mudanças de perfil diretas (precisa consultar)

---

**Documentação Completa:** Arquivo `DOCUMENTAÇÃO UAZAPI/uazapi-openapi-spec.yaml`  
**Data:** 15/11/2025  
**Versão API:** 2.0










