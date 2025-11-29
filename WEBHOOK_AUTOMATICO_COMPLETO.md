# 🔔 Webhook Automático Completo - UAZ API

## ✅ O Que Foi Implementado

Agora **TODA VEZ** que você criar uma nova instância, o webhook será configurado **AUTOMATICAMENTE** com **TODOS OS EVENTOS** habilitados!

---

## 🎯 Mudanças Realizadas

### Arquivo Modificado
```
backend/src/services/uazService.js
```

### O Que Mudou

#### ❌ ANTES (Endpoint Errado):
```javascript
// Tentava vários endpoints incorretos
const endpoints = ['/instance/webhook', '/webhook/set', '/config/webhook'];

// Apenas 4 eventos
events: ['messages.update', 'messages.upsert', 'message_status', 'button_click']
```

#### ✅ DEPOIS (Endpoint Correto):
```javascript
// Endpoint correto da UAZ API
await client.post('/webhook', {
  enabled: true,
  url: webhookUrl,
  // 🚀 TODOS OS 14 EVENTOS DISPONÍVEIS
  events: [
    'connection',        // Alterações no estado da conexão
    'history',          // Recebimento de histórico de mensagens
    'messages',         // Novas mensagens recebidas
    'messages_update',  // Atualizações em mensagens existentes
    'call',            // Eventos de chamadas VoIP
    'contacts',        // Atualizações na agenda de contatos
    'presence',        // Alterações no status de presença
    'groups',          // Modificações em grupos
    'labels',          // Gerenciamento de etiquetas
    'chats',           // Eventos de conversas
    'chat_labels',     // Alterações em etiquetas de conversas
    'blocks',          // Bloqueios/desbloqueios
    'leads',           // Atualizações de leads
    'sender'           // Atualizações de campanhas
  ],
  excludeMessages: ['wasSentByApi'] // Evita loops
});
```

---

## 🚀 Como Funciona Agora

### 1️⃣ Criar Nova Instância

Quando você cria uma nova instância:

```
┌────────────────────────────────────────┐
│ 1. VOCÊ CRIA INSTÂNCIA                 │
│    └─> Nome: "MinhaInstancia"         │
└────────────────────────────────────────┘
           │
           ▼
┌────────────────────────────────────────┐
│ 2. SISTEMA CRIA NA UAZ API             │
│    └─> POST /instance/create           │
│    └─> Recebe: token da instância      │
└────────────────────────────────────────┘
           │
           ▼
┌────────────────────────────────────────┐
│ 3. WEBHOOK É CONFIGURADO AUTOMÁTICO    │
│    └─> POST /webhook                   │
│    └─> Habilita TODOS OS 14 EVENTOS   │
│    └─> URL: seu-sistema/webhook       │
└────────────────────────────────────────┘
           │
           ▼
┌────────────────────────────────────────┐
│ 4. INSTÂNCIA SALVA NO BANCO            │
│    └─> Com webhook ATIVO ✅            │
└────────────────────────────────────────┘
```

### 2️⃣ Receber Eventos em Tempo Real

Agora você recebe **TUDO** em tempo real:

```
WhatsApp → UAZ API → Seu Sistema (webhook)
   ↓          ↓            ↓
Evento    Processa    /api/qr-webhook/uaz-event
```

**Velocidade:**
- ❌ **ANTES:** Polling a cada 10 segundos (lento)
- ✅ **AGORA:** Tempo real instantâneo (rápido) 🚀

---

## 📋 Eventos Que Você Vai Receber

### 1. **connection** - Conexão
```json
{
  "event": "connection",
  "data": {
    "status": "connected",
    "qr": null
  }
}
```
**Quando:** Conecta, desconecta, reconecta

---

### 2. **messages** - Mensagens Novas
```json
{
  "event": "messages",
  "data": {
    "key": {...},
    "message": {...},
    "messageType": "conversation"
  }
}
```
**Quando:** Recebe qualquer mensagem nova

---

### 3. **messages_update** - Atualizações de Mensagens
```json
{
  "event": "messages_update",
  "data": {
    "key": {...},
    "update": {
      "status": "READ"
    }
  }
}
```
**Quando:** Mensagem lida, entregue, deletada, editada

---

### 4. **call** - Chamadas
```json
{
  "event": "call",
  "data": {
    "from": "5562999999999",
    "status": "offer"
  }
}
```
**Quando:** Recebe chamada VoIP

---

### 5. **contacts** - Contatos
```json
{
  "event": "contacts",
  "data": {
    "id": "5562999999999@s.whatsapp.net",
    "name": "João Silva"
  }
}
```
**Quando:** Contato é adicionado, atualizado

---

### 6. **presence** - Presença (Online/Offline)
```json
{
  "event": "presence",
  "data": {
    "id": "5562999999999@s.whatsapp.net",
    "presences": {
      "lastKnownPresence": "available"
    }
  }
}
```
**Quando:** Contato fica online, offline, digitando

---

### 7. **groups** - Grupos
```json
{
  "event": "groups",
  "data": {
    "id": "120363012345678901@g.us",
    "subject": "Meu Grupo",
    "participants": [...]
  }
}
```
**Quando:** Grupo criado, atualizado, membro adicionado/removido

---

### 8. **history** - Histórico
```json
{
  "event": "history",
  "data": {
    "messages": [...]
  }
}
```
**Quando:** Recebe histórico de mensagens antigas

---

### 9. **labels** - Etiquetas
```json
{
  "event": "labels",
  "data": {
    "id": "label_123",
    "name": "Importante"
  }
}
```
**Quando:** Etiqueta criada, atualizada, deletada

---

### 10. **chats** - Conversas
```json
{
  "event": "chats",
  "data": {
    "id": "5562999999999@s.whatsapp.net",
    "conversationTimestamp": 1234567890
  }
}
```
**Quando:** Conversa arquivada, desaquivada, fixada

---

### 11. **chat_labels** - Etiquetas de Chat
```json
{
  "event": "chat_labels",
  "data": {
    "chatId": "5562999999999@s.whatsapp.net",
    "labelIds": ["label_123"]
  }
}
```
**Quando:** Etiqueta aplicada/removida de conversa

---

### 12. **blocks** - Bloqueios
```json
{
  "event": "blocks",
  "data": {
    "blockedContacts": ["5562999999999@s.whatsapp.net"]
  }
}
```
**Quando:** Contato bloqueado ou desbloqueado

---

### 13. **leads** - Leads
```json
{
  "event": "leads",
  "data": {
    "id": "lead_123",
    "name": "João",
    "phone": "5562999999999"
  }
}
```
**Quando:** Novo lead capturado

---

### 14. **sender** - Campanhas
```json
{
  "event": "sender",
  "data": {
    "campaignId": "camp_123",
    "status": "completed"
  }
}
```
**Quando:** Campanha inicia ou completa

---

## 🛡️ Proteção Contra Loops

### O Que É `excludeMessages: ['wasSentByApi']`?

Quando você envia uma mensagem via API:

```
Você → API → WhatsApp → Webhook → Você (de novo!)
                            ↑
                         LOOP! ❌
```

**Com o filtro:**
```javascript
excludeMessages: ['wasSentByApi']
```

**O webhook NÃO envia de volta** as mensagens que você mesmo enviou via API, **evitando loops infinitos**! ✅

---

## 📊 Comparação

| Aspecto | ❌ ANTES | ✅ AGORA |
|---------|----------|----------|
| **Endpoint** | `/instance/webhook` (errado) | `/webhook` (correto) |
| **Eventos** | 4 eventos | 14 eventos (TODOS) |
| **Configuração** | Manual/Falha | Automática ✅ |
| **Velocidade** | Polling (10s) | Tempo real ⚡ |
| **Recebe tudo?** | ❌ Não | ✅ Sim |

---

## 🧪 Como Testar

### Teste 1: Criar Nova Instância

```bash
1. Acesse: http://localhost:3000/configuracoes-uaz
2. Clique em "Nova Instância"
3. Preencha o nome
4. Clique em "Adicionar Instância"

✅ Resultado esperado:
   - Instância criada
   - Webhook configurado automaticamente
   - Logs mostram: "Webhook configurado com SUCESSO!"
   - Eventos habilitados: TODOS (14 eventos)
```

### Teste 2: Verificar Logs do Backend

```bash
cd backend
npm start

# Ao criar instância, você vai ver:
🔔 Configurando webhook COMPLETO (TODOS OS EVENTOS)...
   └─ URL: http://localhost:3001/api/qr-webhook/uaz-event
✅ Webhook configurado com SUCESSO!
   ├─ Eventos habilitados: TODOS (14 eventos)
   ├─ Filtro: excludeMessages = wasSentByApi
   └─ Modo: Tempo real (webhooks ativos)
```

### Teste 3: Enviar Mensagem e Verificar Webhook

```bash
1. Conecte uma instância (leia o QR Code)
2. Envie uma mensagem para essa instância
3. Verifique os logs do backend

✅ Resultado esperado:
   - Webhook recebe evento "messages" IMEDIATAMENTE
   - Não precisa esperar 10 segundos (polling)
```

---

## 🎯 Benefícios

### 1. **Automático**
- ✅ Você não precisa fazer nada
- ✅ Webhook criado na hora da instância
- ✅ Sempre com todos os eventos

### 2. **Completo**
- ✅ 14 eventos (tudo que a UAZ API oferece)
- ✅ Você recebe TODAS as informações
- ✅ Nada fica de fora

### 3. **Rápido**
- ✅ Tempo real (instantâneo)
- ✅ Sem delay de polling
- ✅ Melhor experiência do usuário

### 4. **Seguro**
- ✅ Filtro anti-loop ativo
- ✅ Não cria loops infinitos
- ✅ Configuração correta

---

## 🔧 Configuração do Webhook URL

O webhook URL é definido em:

```javascript
const webhookUrl = process.env.WEBHOOK_URL || 
                   'http://localhost:3001/api/qr-webhook/uaz-event';
```

### Para Produção:

Adicione no arquivo `.env`:

```env
WEBHOOK_URL=https://seu-dominio.com/api/qr-webhook/uaz-event
```

---

## 📝 Endpoint Receptor no Seu Sistema

O webhook envia para:

```
POST /api/qr-webhook/uaz-event
```

**Arquivo:** `backend/src/routes/qr-webhook.routes.ts`

Este endpoint **já está implementado** e pronto para receber todos os eventos! ✅

---

## 🏆 Resultado Final

### Fluxo Completo Automatizado

```
┌─────────────────────────────────────────────────┐
│ VOCÊ                                            │
│ └─> Cria instância "MinhaInstancia"            │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ SISTEMA (Automático)                            │
│ ├─> Cria na UAZ API ✅                          │
│ ├─> Configura webhook com 14 eventos ✅         │
│ ├─> Salva no banco ✅                           │
│ └─> Pronto para receber eventos ✅              │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ WhatsApp → UAZ API → Seu Sistema (tempo real)  │
│ └─> Você recebe TUDO instantaneamente! ⚡       │
└─────────────────────────────────────────────────┘
```

---

## ✅ Status

**IMPLEMENTADO E PRONTO!** 🎉

- ✅ Endpoint correto: `/webhook`
- ✅ Todos os 14 eventos habilitados
- ✅ Configuração automática ao criar instância
- ✅ Proteção anti-loop ativa
- ✅ Tempo real (webhooks)

**Agora é só criar uma instância e testar!** 🚀

---

**Data:** 19/11/2025  
**Arquivo modificado:** `backend/src/services/uazService.js`  
**Método:** `configureWebhook()`





