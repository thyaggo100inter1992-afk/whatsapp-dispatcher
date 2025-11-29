# 🔧 Configuração de Webhooks no UAZ API

## 📡 URLs dos Webhooks

Configure o UAZ para enviar eventos para:

```
http://SEU_IP:3001/api/qr-webhook/uaz-event
```

**Exemplo:**
- Local: `http://localhost:3001/api/qr-webhook/uaz-event`
- Produção: `http://192.168.1.100:3001/api/qr-webhook/uaz-event`

---

## ⚙️ **MÉTODO 1: Via API do UAZ**

### Passo 1: Definir Webhook ao Criar Instância

```bash
curl -X POST http://localhost:8000/instance/init \
  -H "Content-Type: application/json" \
  -H "AdminToken: SEU_ADMIN_TOKEN" \
  -d '{
    "name": "minha_instancia",
    "webhook": {
      "url": "http://localhost:3001/api/qr-webhook/uaz-event",
      "events": [
        "messages.upsert",
        "messages.update",
        "message_status",
        "button_click"
      ]
    }
  }'
```

### Passo 2: Atualizar Webhook de Instância Existente

```bash
curl -X PUT http://localhost:8000/instance/webhook \
  -H "Content-Type: application/json" \
  -H "token: TOKEN_DA_INSTANCIA" \
  -d '{
    "url": "http://localhost:3001/api/qr-webhook/uaz-event",
    "events": [
      "messages.upsert",
      "messages.update",
      "message_status",
      "button_click"
    ]
  }'
```

---

## ⚙️ **MÉTODO 2: Via Arquivo de Configuração**

Se o UAZ usar arquivo `.env` ou `config.json`:

### Opção A: Arquivo `.env`

```env
# Webhook global para todas as instâncias
WEBHOOK_URL=http://localhost:3001/api/qr-webhook/uaz-event

# Eventos que serão enviados
WEBHOOK_EVENTS=messages.upsert,messages.update,message_status,button_click

# Ativar webhook
WEBHOOK_ENABLED=true
```

### Opção B: Arquivo `config.json`

```json
{
  "webhook": {
    "enabled": true,
    "url": "http://localhost:3001/api/qr-webhook/uaz-event",
    "events": [
      "messages.upsert",
      "messages.update",
      "message_status",
      "button_click"
    ],
    "retries": 3,
    "timeout": 30000
  }
}
```

---

## ⚙️ **MÉTODO 3: Via Interface do UAZ**

Se o UAZ tiver interface web:

1. Acesse: `http://localhost:8000` (ou porta configurada)
2. Vá em: **Configurações** → **Webhooks**
3. Configure:
   - **URL**: `http://localhost:3001/api/qr-webhook/uaz-event`
   - **Eventos**:
     - ✅ Atualização de Status de Mensagens
     - ✅ Mensagens Recebidas
     - ✅ Cliques em Botões
   - **Método**: `POST`
   - **Headers**: `Content-Type: application/json`

---

## 📋 **EVENTOS IMPORTANTES**

Configure para receber estes eventos:

### 1. **messages.update** (ESSENCIAL)
Envia quando status da mensagem muda:
- `pending` → `sent`
- `sent` → `delivered`
- `delivered` → `read`
- `sent` → `failed`

**Formato esperado:**
```json
{
  "type": "messages.update",
  "data": {
    "key": {
      "id": "3EB0F123456...",
      "remoteJid": "5511999999999@s.whatsapp.net"
    },
    "update": {
      "status": 2  // 0=pending, 1=sent, 2=delivered, 3=read
    }
  }
}
```

### 2. **message_status** (ALTERNATIVO)
Formato simplificado:
```json
{
  "type": "message_status",
  "data": {
    "messageId": "3EB0F123456...",
    "status": "delivered",  // ou "read", "failed"
    "timestamp": "2025-11-17T12:00:00Z"
  }
}
```

### 3. **button_click** (OPCIONAL)
Para cliques em botões de resposta rápida:
```json
{
  "type": "button_click",
  "data": {
    "phoneNumber": "5511999999999",
    "buttonText": "Sim, aceito",
    "buttonPayload": "aceitar",
    "messageId": "3EB0F123456...",
    "timestamp": "2025-11-17T12:00:00Z"
  }
}
```

---

## 🔍 **TESTANDO A CONFIGURAÇÃO**

### 1. Verificar se Webhook está configurado

```bash
curl http://localhost:8000/instance/webhook \
  -H "token: TOKEN_DA_INSTANCIA"
```

**Resposta esperada:**
```json
{
  "success": true,
  "webhook": {
    "url": "http://localhost:3001/api/qr-webhook/uaz-event",
    "events": ["messages.update", "message_status"],
    "enabled": true
  }
}
```

### 2. Testar envio de webhook

```bash
# Enviar mensagem de teste
curl -X POST http://localhost:8000/send/text \
  -H "Content-Type: application/json" \
  -H "token: TOKEN_DA_INSTANCIA" \
  -d '{
    "phone": "5511999999999",
    "text": "Teste de webhook"
  }'

# Verificar logs do seu backend
# Você deve ver: 📨 Evento UAZ recebido: ...
```

---

## 🚨 **PROBLEMAS COMUNS**

### 1. Webhook não está sendo chamado

**Soluções:**
```bash
# Verificar se URL está acessível do UAZ
curl http://localhost:3001/api/qr-webhook/health

# Verificar logs do UAZ
docker logs uaz-api  # Se estiver em Docker

# Verificar firewall
# Certifique-se que porta 3001 está aberta
```

### 2. UAZ não tem suporte a webhooks

Se o UAZ não tiver webhooks nativos, você tem 2 opções:

**Opção A: Polling (Já implementado)**
- O `QrStatusMonitor` já faz verificação a cada 10 segundos
- Funciona sem webhooks, mas com pequeno delay

**Opção B: WebSocket (Recomendado)**
- Conectar diretamente via Socket.IO ao UAZ
- Receber eventos em tempo real

---

## 🔄 **ALTERNATIVA: USAR SOCKET.IO**

Se o UAZ não tiver webhooks HTTP, ele provavelmente tem Socket.IO:

```typescript
// Em backend/src/services/uaz-socket-listener.ts
import { io } from 'socket.io-client';

const socket = io('http://localhost:8000', {
  extraHeaders: {
    token: 'TOKEN_DA_INSTANCIA'
  }
});

// Escutar eventos de status
socket.on('messages.update', (data) => {
  // Processar atualização de status
  QrWebhookHelper.notifyDelivered(data.id, instanceId);
});

socket.on('message_status', (data) => {
  // Processar status
});
```

---

## 📝 **RESUMO - CHECKLIST**

Faça isso para configurar:

- [ ] 1. Obter URL do webhook: `http://SEU_IP:3001/api/qr-webhook/uaz-event`
- [ ] 2. Configurar no UAZ (via API, arquivo ou interface)
- [ ] 3. Ativar eventos: `messages.update`, `message_status`
- [ ] 4. Testar com `curl http://localhost:3001/api/qr-webhook/health`
- [ ] 5. Enviar mensagem de teste
- [ ] 6. Verificar logs do backend
- [ ] 7. Conferir se status atualiza no banco de dados

---

## 🆘 **PRECISA DE AJUDA?**

Se o UAZ não tiver documentação clara:

1. Verifique se existe endpoint `/webhook` ou `/config`
2. Procure por `socket.io` no UAZ
3. Verifique variáveis de ambiente disponíveis
4. O sistema já funciona com **Polling** mesmo sem webhooks!

---

## ✅ **FUNCIONAMENTO SEM CONFIGURAÇÃO**

**Importante:** Mesmo SEM configurar webhooks, o sistema já funciona!

- ✅ Monitor automático roda a cada 10 segundos
- ✅ Verifica status das mensagens
- ✅ Atualiza banco de dados automaticamente

**Com webhooks = Instantâneo (0-2s)**  
**Sem webhooks = Polling (10s de delay)**

Ambos funcionam perfeitamente! 🚀







