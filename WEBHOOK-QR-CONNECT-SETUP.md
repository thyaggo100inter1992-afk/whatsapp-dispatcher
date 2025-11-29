# 📡 Sistema de Webhooks QR Connect - Documentação Completa

## 🎯 Visão Geral

Sistema completo de rastreamento em tempo real para campanhas QR Connect com:
- ✅ **Entregues (Delivered)**
- ✅ **Lidas (Read)**
- ✅ **Falhas (Failed)**
- ✅ **Sem WhatsApp**
- ⚠️ **Cliques em Botões** (limitado)

---

## 🏗️ Arquitetura

```
┌─────────────┐      ┌──────────────┐      ┌─────────────────┐
│   UAZ API   │─────▶│   Webhook    │─────▶│    Database     │
│   (Externo) │      │   Controller │      │  (PostgreSQL)   │
└─────────────┘      └──────────────┘      └─────────────────┘
       │                     │                       │
       │                     ▼                       │
       │            ┌──────────────────┐            │
       │            │ Status Monitor   │────────────┘
       │            │  (Polling 10s)   │
       │            └──────────────────┘
       │                     │
       └─────────────────────┴────────▶ Atualização em Tempo Real
```

---

## 📦 Componentes Criados

### 1. **QrWebhookController** (`backend/src/controllers/qr-webhook.controller.ts`)
Processa eventos de status de mensagens:
- `POST /api/qr-webhook/message-status` - Atualizar status de mensagem
- `POST /api/qr-webhook/button-click` - Registrar clique em botão
- `POST /api/qr-webhook/uaz-event` - Receber eventos do UAZ
- `GET /api/qr-webhook/health` - Health check

### 2. **QrWebhookHelper** (`backend/src/services/qr-webhook-helper.ts`)
Helper para notificar o webhook interno:
- `notifyDelivered()` - Notificar mensagem entregue
- `notifyRead()` - Notificar mensagem lida
- `notifyFailed()` - Notificar falha no envio
- `notifyButtonClick()` - Notificar clique em botão

### 3. **QrStatusMonitor** (`backend/src/services/qr-status-monitor.ts`)
Monitor automático que:
- Verifica status de mensagens a cada 10 segundos
- Processa eventos recebidos do UAZ
- Atualiza banco de dados automaticamente

### 4. **Rotas** (`backend/src/routes/qr-webhook.routes.ts`)
Todas as rotas do webhook registradas em `/api/qr-webhook/*`

---

## 🔧 Configuração do UAZ

### Opção 1: Webhook do UAZ (Recomendado)

Configure o UAZ para enviar eventos para:

```
URL do Webhook: http://SEU_SERVIDOR:3001/api/qr-webhook/uaz-event
```

**Formato esperado do evento:**

```json
{
  "type": "message_status",
  "data": {
    "messageId": "3EB0F...",
    "status": "delivered",  // ou "read", "failed"
    "error": "mensagem de erro (se failed)"
  }
}
```

**Para cliques em botões:**

```json
{
  "type": "button_click",
  "data": {
    "phoneNumber": "5511999999999",
    "buttonText": "Texto do Botão",
    "buttonPayload": "payload_do_botao",
    "messageId": "3EB0F..."
  }
}
```

### Opção 2: Monitor Automático (Já Ativo)

O `QrStatusMonitor` já está rodando automaticamente e:
- Inicia 5 segundos após o servidor ligar
- Verifica mensagens pendentes a cada 10 segundos
- Processa eventos manualmente se o UAZ não enviar webhooks

---

## 📊 Fluxo de Dados

### 1. **Envio de Mensagem**

```
1. Worker envia mensagem via UAZ
2. Salva whatsapp_message_id no banco
3. Status inicial: "sent"
```

### 2. **Atualização de Status**

```
1. UAZ detecta mudança (delivered/read/failed)
2. UAZ envia evento para /api/qr-webhook/uaz-event
3. Controller processa e atualiza banco
4. Contadores da campanha são atualizados
```

### 3. **Exibição no Frontend**

```
1. Frontend faz polling a cada 3 segundos
2. Busca dados atualizados da campanha
3. Cards exibem contadores em tempo real:
   - Entregues
   - Lidas
   - Falhas
   - Sem WhatsApp
   - Cliques
```

---

## 🔍 Testando o Sistema

### 1. Health Check

```bash
curl http://localhost:3001/api/qr-webhook/health
```

**Resposta esperada:**
```json
{
  "success": true,
  "message": "Webhook QR Connect está funcionando",
  "timestamp": "2025-11-17T..."
}
```

### 2. Simular Atualização de Status

```bash
curl -X POST http://localhost:3001/api/qr-webhook/message-status \
  -H "Content-Type: application/json" \
  -d '{
    "whatsapp_message_id": "3EB0F...",
    "status": "delivered",
    "timestamp": "2025-11-17T12:00:00Z",
    "instance_id": 1
  }'
```

### 3. Simular Clique em Botão

```bash
curl -X POST http://localhost:3001/api/qr-webhook/button-click \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "5511999999999",
    "button_text": "Ver Mais",
    "button_payload": "ver_mais",
    "campaign_id": 1,
    "whatsapp_message_id": "3EB0F..."
  }'
```

---

## 📈 Monitoramento

### Logs do Monitor

O monitor exibe logs no console:

```
🚀 Iniciando monitor de status QR Connect...
🔍 Verificando status de 15 mensagens...
✅ Webhook notificado: Mensagem 3EB0F... entregue
📊 Contadores atualizados para campanha 1
```

### Verificar Status do Monitor

O monitor inicia automaticamente. Para verificar:

```typescript
// No código backend
import { QrStatusMonitor } from './services/qr-status-monitor';

// Parar monitor (se necessário)
QrStatusMonitor.stop();

// Iniciar monitor
QrStatusMonitor.start();
```

---

## ⚙️ Configurações

### Variáveis de Ambiente

```env
# URL da API UAZ
UAZ_API_URL=http://localhost:8000

# Intervalo de verificação (em ms)
QR_STATUS_CHECK_INTERVAL=10000
```

### Ajustar Intervalo do Monitor

Edite `backend/src/services/qr-status-monitor.ts`:

```typescript
private static readonly CHECK_INTERVAL = 10000; // 10 segundos
```

---

## 🐛 Troubleshooting

### Problema: Status não atualiza

**Solução:**
1. Verificar se o UAZ está enviando webhooks
2. Verificar logs do backend
3. Testar endpoint manualmente (veja seção "Testando")
4. Verificar se o `whatsapp_message_id` foi salvo corretamente

### Problema: Contadores errados

**Solução:**
1. Verificar método `updateCampaignCounters` no controller
2. Rodar query manual para verificar dados:

```sql
SELECT 
  status, 
  COUNT(*) 
FROM qr_campaign_messages 
WHERE campaign_id = 1 
GROUP BY status;
```

### Problema: Monitor não está rodando

**Solução:**
1. Verificar logs do backend ao iniciar
2. Verificar se há erro ao importar `QrStatusMonitor`
3. Reiniciar servidor backend

---

## 🎯 Limitações Conhecidas

### 1. **Cliques em Botões de URL**
O WhatsApp **NÃO** notifica quando usuário clica em botão de URL.
- ✅ **Funciona**: Botões de resposta rápida
- ❌ **Não funciona**: Botões de URL externa

### 2. **Delay nas Atualizações**
- Status podem levar alguns segundos para atualizar
- Depende da velocidade do UAZ em enviar eventos

### 3. **Números sem WhatsApp**
- Detectado apenas quando o envio falha
- Erro típico: "not registered", "unregistered", código 131026

---

## 📝 Próximos Passos

### Melhorias Futuras:
1. ✅ **WebSockets** - Atualização instantânea sem polling
2. ✅ **Retry automático** - Reenviar mensagens que falharam
3. ✅ **Dashboard de status** - Visualização em tempo real
4. ✅ **Alertas** - Notificações quando muitas falhas

---

## 🎉 Conclusão

O sistema está **100% funcional** e pronto para uso!

**URLs importantes:**
- Health Check: `http://localhost:3001/api/qr-webhook/health`
- Webhook UAZ: `http://localhost:3001/api/qr-webhook/uaz-event`
- Status de mensagem: `http://localhost:3001/api/qr-webhook/message-status`
- Cliques em botões: `http://localhost:3001/api/qr-webhook/button-click`

**Autor:** Sistema de Webhooks QR Connect  
**Data:** 17/11/2025  
**Versão:** 1.0.0







